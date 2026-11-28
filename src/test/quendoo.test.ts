import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { QuendooClient, createQuendooAdapter } from '../lib/suite/api/quendoo.server';
import type { QuendooRevisionWriter } from '../lib/suite/api/quendoo.server';
import { qcAvailability, qcRates, qcRestrictions } from '../lib/suite/api/quendoo-contracts';
import { ProviderRegistry, runApiOperation } from '../lib/suite/api/engine.server';
import type { ApiRepository } from '../lib/suite/api/engine.server';
import type { ApiRequest } from '../lib/suite/api/contracts';

// Transport fixtures only: never a sandbox result or an app repository.
const scope = { organizationId: 'org-test', hotelId: 'hotel-test', connectionId: 'conn-test', propertyId: 'property-test' };
const revision = { id: 12, property_id: 'property-test', booking_code: 'TESTBOOK', revision_type: 'created', created_at: '2026-11-28T08:00:00Z', payload: { booking_id: 987, client: { name: 'Isolated test' } } };
const row = { room_type_id: 'DBL', date_from: '2026-12-01', date_to: '2026-12-02' };
const writeResult = { written: 2, unchanged: 0, skipped_out_of_window: 0, dry: false, dry_reason: null, warnings: [] };
const request: ApiRequest = { organizationId: scope.organizationId, hotelId: scope.hotelId, connectionId: scope.connectionId, operation: 'reservations.pull', idempotencyKey: 'test-run', payload: {} };
const credentials = { token: 'synthetic-token-not-a-credential' };
function fixture() {
  const http = vi.fn<typeof fetch>(async input => String(input).includes('/ack')
    ? Response.json({ status: 'ok', data: [] })
    : Response.json({ status: 'ok', data: { booking_revisions: [revision], next_cursor: 12 } }));
  const writer: QuendooRevisionWriter = { apply: vi.fn(async () => {}), committed: vi.fn(async () => true) };
  const client = new QuendooClient('staging', http);
  const adapter = createQuendooAdapter(scope, writer, client, () => new Date('2026-11-28T08:00:00Z'));
  return { http, writer, client, adapter };
}
describe('Quendoo documented HTTP contract, isolated transport only', () => {
  beforeEach(() => vi.stubGlobal('crypto', webcrypto));
  afterEach(() => vi.unstubAllGlobals());
  it('pulls the scoped feed then applies, reads back, and ACKs the revision id (not booking id)', async () => {
    const f = fixture(); const events: string[] = [];
    vi.mocked(f.writer.apply).mockImplementation(async () => { events.push('apply'); });
    vi.mocked(f.writer.committed).mockImplementation(async () => { events.push('readback'); return true; });
    f.http.mockImplementation(async input => {
      if (String(input).endsWith('/12/ack')) { events.push('ack'); return Response.json({ status: 'ok', data: [] }); }
      return Response.json({ status: 'ok', data: { booking_revisions: [revision], next_cursor: 12 } });
    });
    await f.adapter.execute(request, credentials);
    expect(events).toEqual(['apply', 'readback', 'ack']);
    const [url, init] = f.http.mock.calls[0] ?? [];
    expect(url).toBe('https://staging-api.quendoo.com/v1/qc/booking_revisions/feed?property_id=property-test&since=0&limit=50');
    expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${credentials.token}`);
    expect(init?.redirect).toBe('manual');
    expect(f.writer.apply).toHaveBeenCalledWith(scope, expect.objectContaining({ id: 12, booking_code: 'TESTBOOK' }));
  });
  it.each(['modified', 'cancelled', 'no_show', 'requested', 'approved', 'confirmed'])('preserves the provider %s event without fabricating a new booking', async revision_type => {
    const f = fixture(); f.http.mockResolvedValueOnce(Response.json({ status: 'ok', data: { booking_revisions: [{ ...revision, revision_type }], next_cursor: 12 } }));
    await f.adapter.execute(request, credentials);
    expect(f.writer.apply).toHaveBeenCalledWith(scope, expect.objectContaining({ revision_type }));
  });
  it('never ACKs when the PMS write fails', async () => {
    const f = fixture(); vi.mocked(f.writer.apply).mockRejectedValue(new Error('isolated write failed'));
    await expect(f.adapter.execute(request, credentials)).rejects.toThrow(); expect(f.http).toHaveBeenCalledTimes(1);
    expect(f.writer.committed).not.toHaveBeenCalled();
  });
  it('never ACKs when durable read-back cannot confirm application', async () => {
    const f = fixture(); vi.mocked(f.writer.committed).mockResolvedValue(false);
    await expect(f.adapter.execute(request, credentials)).rejects.toMatchObject({ code: 'unavailable' }); expect(f.http).toHaveBeenCalledTimes(1);
  });
  it.each([
    [{ ...revision, property_id: 'other-hotel' }],
    [revision, { ...revision, id: 11 }],
    [revision, revision],
    [{ ...revision, property_id: null }],
  ].map(booking_revisions => ({ booking_revisions })))('rejects an invalid/cross-property/out-of-order page before any write', async ({ booking_revisions }) => {
    const f = fixture(); f.http.mockResolvedValueOnce(Response.json({ status: 'ok', data: { booking_revisions, next_cursor: 12 } }));
    await expect(f.adapter.execute(request, credentials)).rejects.toMatchObject({ code: 'invalid_data' });
    expect(f.writer.apply).not.toHaveBeenCalled(); expect(f.http).toHaveBeenCalledTimes(1);
  });
  it('rejects a different internal hotel before retrieving credentials or calling HTTP', async () => {
    const f = fixture(); await expect(f.adapter.execute({ ...request, hotelId: 'other' }, credentials)).rejects.toThrow(); expect(f.http).not.toHaveBeenCalled();
  });
  it('rejects provider-id injection in feed payload', () => expect(() => fixture().adapter.validate('reservations.pull', { property_id: 'other' })).toThrow());
  it('does not expose a fictional generic reservation write operation', () => {
    const f = fixture(); expect(f.adapter.operations).not.toContain('reservation.upsert');
    expect(() => f.adapter.validate('reservation.cancel', {})).toThrow();
  });
  it.each([[401, 'provider_auth'], [403, 'provider_auth'], [429, 'rate_limit'], [503, 'unavailable'], [302, 'invalid_data'], [422, 'invalid_data']])('sanitizes HTTP %s without leaking provider messages', async (status, code) => {
    const f = fixture(); f.http.mockResolvedValueOnce(new Response('private-provider-detail', { status: Number(status) }));
    await expect(f.client.feed(credentials.token, scope.propertyId, {})).rejects.toMatchObject({ message: code, code, retryable: false });
  });
  it('rejects malformed and oversized responses', async () => {
    const f = fixture(); f.http.mockResolvedValueOnce(new Response('not json'));
    await expect(f.client.feed(credentials.token, scope.propertyId, {})).rejects.toMatchObject({ code: 'invalid_data' });
    f.http.mockResolvedValueOnce(new Response('x'.repeat(2097153)));
    await expect(f.client.feed(credentials.token, scope.propertyId, {})).rejects.toMatchObject({ code: 'invalid_data' });
  });
  it('uses OAuth client_credentials on the documented staging endpoint without caching tokens', async () => {
    const f = fixture(); f.http.mockImplementation(async () => Response.json({ access_token: 'synthetic-access-token', token_type: 'Bearer', expires_in: 3600 }));
    await expect(f.client.token({ clientId: 'test-client', clientSecret: 'test-secret' })).resolves.toBe('synthetic-access-token');
    expect(f.http.mock.calls[0]?.[0]).toBe('https://staging-api.quendoo.com/v1/qc/oauth/token');
    const params = new URLSearchParams(String(f.http.mock.calls[0]?.[1]?.body));
    expect(params.get('grant_type')).toBe('client_credentials'); expect(params.get('client_id')).toBe('test-client');
  });
  it('reads the documented property envelope and pagination without inventing wrapper fields', async () => {
    const f = fixture(); const property = { id: 'property-test', name: 'Isolated property', mode: 'live', currency: 'EUR', timezone: 'Europe/Sofia' };
    f.http.mockResolvedValueOnce(Response.json({ status: 'ok', data: property }));
    expect(await f.client.property(credentials.token, scope.propertyId)).toEqual(property);
    f.http.mockResolvedValueOnce(Response.json({ status: 'ok', data: { properties: [property], meta: { total: 1, page: 1, per_page: 50, last_page: 1 } } }));
    expect((await f.client.properties(credentials.token)).meta.last_page).toBe(1);
  });
  it('reads real room-type and rate-plan identifiers for later mapping', async () => {
    const f = fixture(); f.http.mockResolvedValueOnce(Response.json({ status: 'ok', data: { room_types: [{ id: 'DBL', name: 'Double', qty: 2 }] } }));
    expect((await f.client.roomTypes(credentials.token, scope.propertyId)).room_types[0]?.id).toBe('DBL');
    f.http.mockResolvedValueOnce(Response.json({ status: 'ok', data: { rate_plans: [{ id: 'BB', room_type_id: 'DBL', name: 'Breakfast', sell_type: 'per_room' }] } }));
    expect((await f.client.ratePlans(credentials.token, scope.propertyId)).rate_plans[0]?.room_type_id).toBe('DBL');
  });
  it.each(['availability.push', 'rates.push', 'restrictions.push'] as const)('uses the documented %s write', async operation => {
    const f = fixture(); f.http.mockResolvedValueOnce(Response.json({ status: 'ok', data: writeResult }, { status: 202 }));
    const value = operation === 'availability.push' ? { ...row, availability: 2 } : operation === 'rates.push' ? { ...row, rate_plan_id: 'BB', rate: 125 } : { ...row, rate_plan_id: 'BB', min_los: 2 };
    await f.client.inventory(credentials.token, scope.propertyId, operation, { values: [value] });
    expect(f.http.mock.calls[0]?.[0]).toBe(`https://staging-api.quendoo.com/v1/qc/properties/property-test/inventory/${operation.split('.')[0]}`);
    expect(JSON.parse(String(f.http.mock.calls[0]?.[1]?.body))).toEqual({ values: [value] });
  });
  it.each([{ dry: true }, { warnings: [{ index: 0, code: 'errors.qc.unknown_field' }] }, { skipped_out_of_window: 1 }, { written: 0 }])('never reports a partial/dry 202 as stored', async override => {
    const f = fixture(); f.http.mockResolvedValueOnce(Response.json({ status: 'ok', data: { ...writeResult, ...override } }, { status: 202 }));
    await expect(f.client.inventory(credentials.token, scope.propertyId, 'availability.push', { values: [{ ...row, availability: 2 }] })).rejects.toMatchObject({ code: 'invalid_data' });
  });
  it('validates actual calendar ranges, changes and provider batch limits', () => {
    expect(qcAvailability.safeParse({ values: [{ ...row, date_from: '2026-02-30', availability: 2 }] }).success).toBe(false);
    expect(qcAvailability.safeParse({ values: [{ ...row, date_to: '2026-11-30', availability: 2 }] }).success).toBe(false);
    expect(qcAvailability.safeParse({ values: Array.from({ length: 1001 }, () => ({ ...row, availability: 2 })) }).success).toBe(false);
    expect(qcAvailability.safeParse({ values: [{ ...row, availability: 2, date_to: '2090-01-01' }] }).success).toBe(false);
    expect(qcRates.safeParse({ values: [{ ...row, rate_plan_id: 'BB', rate: 100, prices: { A2: 200 } }] }).success).toBe(false);
    expect(qcRestrictions.safeParse({ values: [{ ...row, rate_plan_id: 'BB', min_stay: 2 }] }).success).toBe(false);
    expect(qcRestrictions.safeParse({ values: [{ ...row, rate_plan_id: 'BB', min_los: null }] }).success).toBe(true);
  });
  it('checks webhook raw-body HMAC and the five-minute window', async () => {
    const f = fixture(); const body = '{"data":{"property_id":"property-test"}}'; const timestamp = String(Date.parse('2026-11-28T08:00:00Z') / 1000);
    const secret = 'isolated-signature-test';
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${body}`)));
    const hex = Array.from(signature, x => x.toString(16).padStart(2, '0')).join('');
    const headers = new Headers({ 'X-Qc-Timestamp': timestamp, 'X-Qc-Signature-256': `sha256=${hex}`, 'X-Qc-Event-Id': 'event-test' });
    const verify = f.adapter.verifyWebhook;
    if (!verify) throw new Error('Missing verification');
    expect(await verify(body, headers, { signingSecret: secret })).toBe(true);
    expect(await verify(body + ' ', headers, { signingSecret: secret })).toBe(false);
    headers.set('X-Qc-Timestamp', String(Number(timestamp) - 301));
    expect(await verify(body, headers, { signingSecret: secret })).toBe(false);
  });
  it('runs through the existing engine and journals metadata, not guest payloads', async () => {
    const f = fixture(); const providers = new ProviderRegistry(); providers.register(f.adapter);
    const repo: ApiRepository = { authorize: vi.fn(async () => true), connection: vi.fn(async () => ({ id: scope.connectionId, organizationId: scope.organizationId, hotelId: scope.hotelId, providerId: 'quendoo', authorizedUserId: 'user-test', status: 'connected' as const, credentialRef: 'test-only-reference' })), claim: vi.fn(async () => ({ kind: 'claimed' as const, runId: 'run-test' })), attempt: vi.fn(async () => {}), finish: vi.fn(async () => {}) };
    const outcome = await runApiOperation(request, 'user-test', { repository: repo, providers, credentials: async () => credentials, sleep: vi.fn(), now: () => new Date('2026-11-28T08:00:00Z') });
    expect(outcome).toEqual({ status: 'succeeded', attempts: 1 });
    expect(repo.finish).toHaveBeenCalledWith('run-test', outcome); expect(f.writer.committed).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(repo.finish).mock.calls)).not.toContain('Isolated test');
  });
});