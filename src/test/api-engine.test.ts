import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { ProviderFailure, ProviderRegistry, runApiOperation } from '../lib/suite/api/engine.server';
import type { ApiDependencies, ApiRepository, ProviderAdapter } from '../lib/suite/api/engine.server';
import type { ApiOutcome, ApiRequest, Connection } from '../lib/suite/api/contracts';

const request: ApiRequest = { organizationId: 'org-a', hotelId: 'hotel-a', connectionId: 'conn-a', operation: 'rates.push', idempotencyKey: 'key-a', payload: { rate: 120 } };
const connection: Connection = { id: 'conn-a', organizationId: 'org-a', hotelId: 'hotel-a', providerId: 'test-only', authorizedUserId: 'user-a', status: 'connected', credentialRef: 'protected-ref' };
function fixture() {
  const repo: ApiRepository = {
    authorize: vi.fn(async () => true), connection: vi.fn(async () => connection),
    claim: vi.fn(async () => ({ kind: 'claimed' as const, runId: 'run-a' })),
    attempt: vi.fn(async () => {}), finish: vi.fn(async () => {}),
  };
  const adapter: ProviderAdapter = { id: 'test-only', operations: ['rates.push'], idempotentOperations: ['rates.push'], validate: vi.fn(), execute: vi.fn(async () => {}) };
  const providers = new ProviderRegistry(); providers.register(adapter);
  const deps: ApiDependencies = { repository: repo, providers, credentials: vi.fn(async () => ({ token: 'isolated-test-value' })), sleep: vi.fn(async () => {}), now: () => new Date('2026-11-28T08:00:00Z') };
  return { deps, repo, adapter };
}
describe('API engine: isolated dependencies, no network or production repository', () => {
  beforeEach(() => vi.stubGlobal('crypto', webcrypto));
  afterEach(() => vi.unstubAllGlobals());
  it('starts with no fictitious providers and rejects duplicates', () => {
    const f = fixture(); expect(() => new ProviderRegistry().get('unknown')).toThrow();
    expect(() => f.deps.providers.register(f.adapter)).toThrow();
  });
  it('checks backend authorization before reading connections or credentials', async () => {
    const f = fixture(); vi.mocked(f.repo.authorize).mockResolvedValue(false);
    await expect(runApiOperation(request, 'user-a', f.deps)).rejects.toThrow('Forbidden');
    expect(f.repo.connection).not.toHaveBeenCalled(); expect(f.deps.credentials).not.toHaveBeenCalled();
  });
  it.each(['organizationId', 'hotelId', 'id', 'authorizedUserId'] as const)('rejects mismatched connection %s', async field => {
    const f = fixture(); vi.mocked(f.repo.connection).mockResolvedValue({ ...connection, [field]: 'other' });
    await expect(runApiOperation(request, 'user-a', f.deps)).rejects.toThrow('Forbidden');
    expect(f.repo.claim).not.toHaveBeenCalled(); expect(f.deps.credentials).not.toHaveBeenCalled();
  });
  it.each(['unconfigured', 'disabled', 'error'] as const)('never runs a %s connection', async status => {
    const f = fixture(); vi.mocked(f.repo.connection).mockResolvedValue({ ...connection, status });
    await expect(runApiOperation(request, 'user-a', f.deps)).rejects.toThrow('Connection not ready');
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it('rejects unsupported and adapter-invalid payloads before claiming', async () => {
    const f = fixture(); await expect(runApiOperation({ ...request, operation: 'reservation.cancel' }, 'user-a', f.deps)).rejects.toThrow('Unsupported');
    vi.mocked(f.adapter.validate).mockImplementation(() => { throw new Error('Invalid'); });
    await expect(runApiOperation(request, 'user-a', f.deps)).rejects.toThrow('Invalid'); expect(f.repo.claim).not.toHaveBeenCalled();
  });
  it('journals successful operations without credentials or payloads', async () => {
    const f = fixture(); expect(await runApiOperation(request, 'user-a', f.deps)).toEqual({ status: 'succeeded', attempts: 1 });
    expect(f.repo.attempt).toHaveBeenCalledWith('run-a', 1, '2026-11-28T08:00:00.000Z');
    expect(f.repo.finish).toHaveBeenCalledWith('run-a', { status: 'succeeded', attempts: 1 });
  });
  it('replays without remote execution or credential retrieval', async () => {
    const f = fixture(); const outcome: ApiOutcome = { status: 'succeeded', attempts: 1 };
    vi.mocked(f.repo.claim).mockResolvedValue({ kind: 'replay', outcome });
    expect(await runApiOperation(request, 'user-a', f.deps)).toEqual(outcome);
    expect(f.adapter.execute).not.toHaveBeenCalled(); expect(f.deps.credentials).not.toHaveBeenCalled();
  });
  it.each(['busy', 'conflict'] as const)('rejects atomic claim %s', async kind => {
    const f = fixture(); vi.mocked(f.repo.claim).mockResolvedValue({ kind });
    await expect(runApiOperation(request, 'user-a', f.deps)).rejects.toThrow(); expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it('hashes reordered JSON identically and changed payloads differently', async () => {
    const f = fixture();
    for (const payload of [{ a: 1, b: 2 }, { b: 2, a: 1 }, { a: 3, b: 2 }]) await runApiOperation({ ...request, payload }, 'user-a', f.deps);
    const calls = vi.mocked(f.repo.claim).mock.calls;
    expect(calls[0]?.[1]).toMatch(/^[a-f0-9]{64}$/);
    expect(calls[0]?.[1]).toBe(calls[1]?.[1]); expect(calls[0]?.[1]).not.toBe(calls[2]?.[1]);
  });
  it('caps safe transient retries at 3 with 1s/2s delays', async () => {
    const f = fixture(); vi.mocked(f.adapter.execute).mockRejectedValue(new ProviderFailure('unavailable', true));
    expect(await runApiOperation(request, 'user-a', f.deps)).toEqual({ status: 'failed', attempts: 3, code: 'unavailable' });
    expect(f.deps.sleep).toHaveBeenNthCalledWith(1, 1000); expect(f.deps.sleep).toHaveBeenNthCalledWith(2, 2000);
  });
  it('does not retry non-idempotent writes', async () => {
    const f = fixture(); f.adapter.idempotentOperations = [];
    vi.mocked(f.adapter.execute).mockRejectedValue(new ProviderFailure('unavailable', true));
    expect(await runApiOperation(request, 'user-a', f.deps)).toEqual({ status: 'failed', attempts: 1, code: 'unavailable' }); expect(f.deps.sleep).not.toHaveBeenCalled();
  });
  it.each(['provider_auth', 'invalid_data', 'unknown'] as const)('never retries a permanent %s failure, even if mislabelled', async code => {
    const f = fixture(); vi.mocked(f.adapter.execute).mockRejectedValue(new ProviderFailure(code, true));
    expect(await runApiOperation(request, 'user-a', f.deps)).toEqual({ status: 'failed', attempts: 1, code });
    expect(f.adapter.execute).toHaveBeenCalledTimes(1); expect(f.deps.sleep).not.toHaveBeenCalled();
    expect(f.repo.attempt).toHaveBeenLastCalledWith('run-a', 1, '2026-11-28T08:00:00.000Z', code);
  });
  it('records credential resolution failure without a remote call', async () => {
    const f = fixture(); vi.mocked(f.deps.credentials).mockRejectedValue(new Error('private credential detail'));
    expect(await runApiOperation(request, 'user-a', f.deps)).toEqual({ status: 'failed', attempts: 0, code: 'unknown' });
    expect(f.adapter.execute).not.toHaveBeenCalled();
    expect(f.repo.finish).toHaveBeenCalledWith('run-a', { status: 'failed', attempts: 0, code: 'unknown' });
  });
  it('leaves uncertain completion unreplayed when history finalization fails', async () => {
    const f = fixture(); vi.mocked(f.repo.finish).mockRejectedValue(new Error('History unavailable'));
    await expect(runApiOperation(request, 'user-a', f.deps)).rejects.toThrow('History unavailable');
    vi.mocked(f.repo.claim).mockResolvedValue({ kind: 'busy' });
    await expect(runApiOperation(request, 'user-a', f.deps)).rejects.toThrow('Operation in progress');
    expect(f.adapter.execute).toHaveBeenCalledTimes(1);
  });
  it('sanitizes unknown errors and never retries them', async () => {
    const f = fixture(); vi.mocked(f.adapter.execute).mockRejectedValue(new Error('secret-provider-response'));
    const outcome = await runApiOperation(request, 'user-a', f.deps);
    expect(outcome).toEqual({ status: 'failed', attempts: 1, code: 'unknown' });
    expect(JSON.stringify(vi.mocked(f.repo.finish).mock.calls)).not.toContain('secret-provider-response');
  });
  it('does not call provider if durable history is unavailable', async () => {
    const f = fixture(); vi.mocked(f.repo.attempt).mockRejectedValue(new Error('Journal unavailable'));
    await expect(runApiOperation(request, 'user-a', f.deps)).rejects.toThrow(); expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it('runs one concurrent operation, replays completion and rejects changed-key reuse', async () => {
    const f = fixture();
    // Test-only atomic repository. Never exported or used by the app.
    let claimedDigest: string | null = null;
    let savedOutcome: ApiOutcome | null = null;
    vi.mocked(f.repo.claim).mockImplementation(async (_request, digest) => {
      if (claimedDigest !== null) {
        if (claimedDigest !== digest) return { kind: 'conflict' };
        return savedOutcome ? { kind: 'replay', outcome: savedOutcome } : { kind: 'busy' };
      }
      claimedDigest = digest; return { kind: 'claimed', runId: 'run-a' };
    });
    vi.mocked(f.repo.finish).mockImplementation(async (_id, outcome) => { savedOutcome = outcome; });
    let release = () => {};
    let started = () => {};
    const executing = new Promise<void>(resolve => { started = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; });
    vi.mocked(f.adapter.execute).mockImplementation(async () => { started(); await held; });
    const first = runApiOperation(request, 'user-a', f.deps);
    await executing;
    await expect(runApiOperation(request, 'user-a', f.deps)).rejects.toThrow('Operation in progress');
    release();
    expect(await first).toEqual({ status: 'succeeded', attempts: 1 });
    expect(await runApiOperation(request, 'user-a', f.deps)).toEqual({ status: 'succeeded', attempts: 1 });
    await expect(runApiOperation({ ...request, payload: { rate: 140 } }, 'user-a', f.deps)).rejects.toThrow('Idempotency conflict');
    expect(f.adapter.execute).toHaveBeenCalledTimes(1);
  });
});