import { z } from 'zod';
import type { ApiOperation, ApiRequest } from './contracts';
import { ProviderFailure } from './engine.server';
import type { ProviderAdapter } from './engine.server';
import { qcAvailability, qcFeed, qcFeedInput, qcId, qcProperty, qcRatePlan, qcRates, qcRestrictions, qcRoomType, qcWriteResult } from './quendoo-contracts';
import type { QuendooRevision } from './quendoo-contracts';

const bases = { staging: 'https://staging-api.quendoo.com/v1/qc', production: 'https://api.quendoo.com/v1/qc' } as const;
type Transport = typeof fetch;
const credential = z.string().min(1).max(8192).refine(v => !/[\r\n]/.test(v));
const schemas = { 'availability.push': qcAvailability, 'rates.push': qcRates, 'restrictions.push': qcRestrictions };
const paths = { 'availability.push': 'availability', 'rates.push': 'rates', 'restrictions.push': 'restrictions' };
type InventoryOperation = keyof typeof schemas;

/** Server-only HTTP implementation. No credentials cache, arbitrary base URL, redirects or logging of bodies. */
export class QuendooClient {
  private readonly base: string;
  constructor(environment: keyof typeof bases = 'staging', private readonly transport: Transport = fetch) {
    if (!(environment in bases)) throw new ProviderFailure('invalid_data', false);
    this.base = bases[environment];
  }
  private async json(path: string, init: RequestInit): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await this.transport(`${this.base}${path}`, { ...init, redirect: 'manual', signal: controller.signal });
      if (!response.ok) {
        // Never return provider messages: they may contain contact data or credentials.
        if (response.status === 401 || response.status === 403) throw new ProviderFailure('provider_auth', false);
        if (response.status === 429) throw new ProviderFailure('rate_limit', false); // defer; do not violate Retry-After with the engine's 1s/2s retry
        if (response.status >= 500) throw new ProviderFailure('unavailable', false);
        throw new ProviderFailure('invalid_data', false);
      }
      // Bound PII-bearing responses before parsing, including chunked responses.
      if (Number(response.headers.get('content-length')) > 2097152 || !response.body) throw new ProviderFailure('invalid_data', false);
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = []; let length = 0;
      try {
        for (;;) {
          const chunk = await reader.read(); if (chunk.done) break;
          length += chunk.value.byteLength;
          if (length > 2097152) { await reader.cancel(); throw new ProviderFailure('invalid_data', false); }
          chunks.push(chunk.value);
        }
      } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(length); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (error) {
      if (error instanceof ProviderFailure) throw error;
      throw new ProviderFailure(error instanceof SyntaxError ? 'invalid_data' : 'unavailable', false);
    } finally { clearTimeout(timeout); }
  }
  private async call<T>(path: string, token: string, schema: z.ZodType<T>, body?: unknown): Promise<T> {
    credential.parse(token);
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' };
    const init: RequestInit = body === undefined ? { method: 'GET', headers } : { method: 'POST', headers, body: JSON.stringify(body) };
    const raw = await this.json(path, init);
    const envelope = z.object({ status: z.literal('ok'), data: z.unknown() }).safeParse(raw);
    if (!envelope.success) throw new ProviderFailure('invalid_data', false);
    const result = schema.safeParse(envelope.data.data);
    if (!result.success) throw new ProviderFailure('invalid_data', false);
    return result.data;
  }
  async token(credentials: Readonly<Record<string, string>>): Promise<string> {
    if (credentials['token']) return credential.parse(credentials['token']);
    const clientId = credential.parse(credentials['clientId']);
    const clientSecret = credential.parse(credentials['clientSecret']);
    const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret });
    const raw = await this.json('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
    const result = z.object({ access_token: credential, token_type: z.literal('Bearer'), expires_in: z.number().int().positive() }).safeParse(raw);
    if (!result.success) throw new ProviderFailure('provider_auth', false);
    return result.data.access_token;
  }
  async properties(token: string, page = 1) {
    z.number().int().min(1).max(10000).parse(page);
    return this.call(`/properties?page=${page}&limit=50`, token, z.object({ properties: z.array(qcProperty).max(50), meta: z.object({ total: z.number().int().nonnegative(), page: z.number().int().positive(), per_page: z.number().int().positive(), last_page: z.number().int().positive() }) }));
  }
  async property(token: string, propertyId: string) {
    return this.call(`/properties/${encodeURIComponent(qcId.parse(propertyId))}`, token, qcProperty);
  }
  async roomTypes(token: string, propertyId: string) {
    return this.call(`/properties/${encodeURIComponent(qcId.parse(propertyId))}/room_types`, token, z.object({ room_types: z.array(qcRoomType).max(10000) }));
  }
  async ratePlans(token: string, propertyId: string) {
    return this.call(`/properties/${encodeURIComponent(qcId.parse(propertyId))}/rate_plans`, token, z.object({ rate_plans: z.array(qcRatePlan).max(10000) }));
  }
  async feed(token: string, propertyId: string, input: unknown) {
    const { since, limit } = qcFeedInput.parse(input);
    const query = new URLSearchParams({ property_id: qcId.parse(propertyId), since: String(since), limit: String(limit) });
    const data = await this.call(`/booking_revisions/feed?${query}`, token, qcFeed);
    let previous = since;
    for (const revision of data.booking_revisions) {
      // Validate the entire page before invoking any PMS command or ACK.
      if (revision.property_id !== propertyId || revision.id <= previous || revision.id > data.next_cursor) throw new ProviderFailure('invalid_data', false);
      previous = revision.id;
    }
    if (data.next_cursor < since) throw new ProviderFailure('invalid_data', false);
    return data;
  }
  async acknowledge(token: string, revisionId: number) {
    z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).parse(revisionId);
    await this.call(`/booking_revisions/${revisionId}/ack`, token, z.array(z.unknown()).length(0), {});
  }
  async inventory(token: string, propertyId: string, operation: InventoryOperation, input: unknown) {
    const body = schemas[operation].parse(input);
    const result = await this.call(`/properties/${encodeURIComponent(qcId.parse(propertyId))}/inventory/${paths[operation]}`, token, qcWriteResult, body);
    // HTTP 202 is NOT proof that all requested values were stored.
    if (result.dry || result.dry_reason || result.warnings.length || result.skipped_out_of_window > 0 || result.written + result.unchanged === 0) throw new ProviderFailure('invalid_data', false);
    return result;
  }
}

export interface QuendooBinding {
  organizationId: string; hotelId: string; connectionId: string; propertyId: string;
}
export interface QuendooRevisionWriter {
  /** Must atomically apply through the EXISTING PMS, mappings and monotonic revision ledger.
   * Unsupported requests/overbooking/missing mappings must reject, never return success. */
  apply(binding: Readonly<QuendooBinding>, revision: QuendooRevision): Promise<void>;
  /** Separate durable read-back of applied OR safely superseded revision before ACK. */
  committed(binding: Readonly<QuendooBinding>, revision: QuendooRevision): Promise<boolean>;
}

/** Construct only from an authorized backend connection, NEVER a client-supplied property binding.
 * No production registry is installed until a durable writer/repository has been authorized and tested. */
export function createQuendooAdapter(binding: QuendooBinding, writer: QuendooRevisionWriter, client = new QuendooClient(), now: () => Date = () => new Date()): ProviderAdapter {
  const scope = Object.freeze({ ...binding });
  Object.values(scope).forEach(v => qcId.parse(v));
  const operations: readonly ApiOperation[] = ['reservations.pull', 'availability.push', 'rates.push', 'restrictions.push'];
  return {
    id: 'quendoo', operations,
    // Don't blindly retry a whole feed containing local writes, or overwrite newer queued ARI.
    idempotentOperations: [],
    validate(operation, payload) {
      if (operation === 'reservations.pull') qcFeedInput.parse(payload);
      else if (operation === 'availability.push' || operation === 'rates.push' || operation === 'restrictions.push') schemas[operation].parse(payload);
      else throw new ProviderFailure('invalid_data', false);
    },
    async execute(request: ApiRequest, credentials) {
      if (request.organizationId !== scope.organizationId || request.hotelId !== scope.hotelId || request.connectionId !== scope.connectionId) throw new ProviderFailure('invalid_data', false);
      this.validate(request.operation, request.payload);
      const token = await client.token(credentials);
      if (request.operation === 'reservations.pull') {
        const page = await client.feed(token, scope.propertyId, request.payload);
        for (const revision of page.booking_revisions) {
          await writer.apply(scope, revision);
          if (!await writer.committed(scope, revision)) throw new ProviderFailure('unavailable', false);
          await client.acknowledge(token, revision.id);
        }
        // No persisted cursor is advanced here. Poll since=0 until a scoped durable cursor exists.
      } else if (request.operation === 'availability.push' || request.operation === 'rates.push' || request.operation === 'restrictions.push') {
        await client.inventory(token, scope.propertyId, request.operation, request.payload);
      } else throw new ProviderFailure('invalid_data', false);
    },
    async verifyWebhook(body, headers, credentials) {
      const secret = credentials['signingSecret'];
      const timestamp = headers.get('X-Qc-Timestamp');
      const signature = headers.get('X-Qc-Signature-256');
      if (!secret || !timestamp || !/^\d{1,12}$/.test(timestamp) || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature) || !headers.get('X-Qc-Event-Id')) return false;
      if (Math.abs(now().getTime() - Number(timestamp) * 1000) > 300000 || new TextEncoder().encode(body).byteLength > 262144) return false;
      try {
        const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
        const bytes = Uint8Array.from(signature.slice(7).match(/.{2}/g) ?? [], x => parseInt(x, 16));
        return await crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(`${timestamp}.${body}`));
      } catch { return false; }
    },
  };
}