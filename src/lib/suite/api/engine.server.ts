import { apiRequest } from './contracts';
import type { ApiErrorCode, ApiOperation, ApiOutcome, ApiRequest, Connection } from './contracts';

export class ProviderFailure extends Error {
  constructor(public readonly code: ApiErrorCode, public readonly retryable: boolean) { super(code); }
}
export interface ProviderAdapter {
  id: string;
  operations: readonly ApiOperation[];
  /** Only these operations may be retried after uncertain remote outcomes. */
  idempotentOperations: readonly ApiOperation[];
  validate(operation: ApiOperation, payload: Record<string, unknown>): void;
  execute(request: ApiRequest, credentials: Readonly<Record<string, string>>): Promise<void>;
  /** Must verify the RAW body/signature before parsing. No public endpoint is installed yet. */
  verifyWebhook?: (body: string, headers: Headers, credentials: Readonly<Record<string, string>>) => Promise<boolean>;
}
export class ProviderRegistry {
  private readonly adapters = new Map<string, ProviderAdapter>();
  register(adapter: ProviderAdapter): void {
    if (!adapter.id.trim() || this.adapters.has(adapter.id)) throw new Error('Duplicate or invalid provider');
    this.adapters.set(adapter.id, adapter);
  }
  get(id: string): ProviderAdapter {
    const adapter = this.adapters.get(id);
    if (!adapter) throw new Error('Provider not configured');
    return adapter;
  }
}

/** Durable implementations required. No worker-global state, demo repository or credential cache. */
export interface ApiRepository {
  /** Must check verified identity, active hotel membership, organization and API permission in backend. */
  authorize(userId: string, organizationId: string, hotelId: string): Promise<boolean>;
  connection(organizationId: string, hotelId: string, id: string): Promise<Connection | null>;
  /** Atomic unique claim by organization/hotel/connection/operation/key. Check digest before replay.
   * A running/uncertain operation MUST NOT be reclaimed automatically. */
  claim(request: ApiRequest, digest: string, actorId: string): Promise<
    { kind: 'claimed'; runId: string } | { kind: 'replay'; outcome: ApiOutcome } | { kind: 'busy' | 'conflict' }
  >;
  /** Persist metadata only; never raw credentials, payloads or provider messages. */
  attempt(runId: string, attempt: number, at: string, code?: ApiErrorCode): Promise<void>;
  finish(runId: string, outcome: ApiOutcome): Promise<void>;
}
export interface ApiDependencies {
  repository: ApiRepository; providers: ProviderRegistry;
  credentials(connection: Connection): Promise<Readonly<Record<string, string>>>;
  sleep(ms: number): Promise<void>;
  now(): Date;
}

function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  throw new Error('Payload must be JSON');
}

/** Server utility only. No RPC, external calls or production writes until authorized dependencies exist. */
export async function runApiOperation(input: unknown, verifiedUserId: string, deps: ApiDependencies): Promise<ApiOutcome> {
  const request = apiRequest.parse(input);
  const repo = deps.repository;
  if (!verifiedUserId || !await repo.authorize(verifiedUserId, request.organizationId, request.hotelId)) throw new Error('Forbidden');
  const connection = await repo.connection(request.organizationId, request.hotelId, request.connectionId);
  if (!connection || connection.organizationId !== request.organizationId || connection.hotelId !== request.hotelId || connection.id !== request.connectionId || connection.authorizedUserId !== verifiedUserId) throw new Error('Forbidden');
  if (connection.status !== 'connected' || !connection.credentialRef) throw new Error('Connection not ready');
  const adapter = deps.providers.get(connection.providerId);
  if (!adapter.operations.includes(request.operation)) throw new Error('Unsupported operation');
  adapter.validate(request.operation, request.payload);
  const encoded = canonical(request.payload);
  if (new TextEncoder().encode(encoded).byteLength > 262144) throw new Error('Payload too large');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(encoded));
  const digest = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  const claim = await repo.claim(request, digest, verifiedUserId);
  if (claim.kind === 'replay') return claim.outcome;
  if (claim.kind !== 'claimed') throw new Error(claim.kind === 'busy' ? 'Operation in progress' : 'Idempotency conflict');
  let outcome: ApiOutcome = { status: 'failed', attempts: 0, code: 'unknown' };
  let credentials: Readonly<Record<string, string>>;
  try { credentials = await deps.credentials(connection); }
  catch { await repo.finish(claim.runId, outcome); return outcome; }
  const maxAttempts = adapter.idempotentOperations.includes(request.operation) ? 3 : 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Journal BEFORE a remote call. A journal outage prevents untracked operations.
    await repo.attempt(claim.runId, attempt, deps.now().toISOString());
    try {
      await adapter.execute(request, credentials);
      outcome = { status: 'succeeded', attempts: attempt };
      break;
    } catch (error) {
      const code = error instanceof ProviderFailure ? error.code : 'unknown';
      outcome = { status: 'failed', attempts: attempt, code };
      await repo.attempt(claim.runId, attempt, deps.now().toISOString(), code);
      // Authentication and input errors cannot be repaired by repeating the same call,
      // even when an adapter incorrectly labels them retryable.
      const transient = code === 'unavailable' || code === 'rate_limit';
      if (!(error instanceof ProviderFailure) || !error.retryable || !transient || attempt === maxAttempts) break;
      await deps.sleep(1000 * 2 ** (attempt - 1));
    }
  }
  await repo.finish(claim.runId, outcome);
  return outcome;
}