import { describe, expect, it, vi } from 'vitest';
import { connectionHotelInput } from '../lib/suite/api/connection-contracts';
import { authorizeConnectionHotel, prepareConnection, probeConnection } from '../lib/suite/api/connection.server';
import { QuendooClient } from '../lib/suite/api/quendoo.server';

// Synthetic fixtures, no provider access or hotel writes.
const hotel = { id: '00000000-0000-4000-8000-000000000001', name: 'Isolated test', organizationId: '00000000-0000-4000-8000-000000000002', timezone: 'Europe/Madrid' };
const binding = { hotelId: hotel.id, organizationId: hotel.organizationId, propertyId: 'test-property', environment: 'staging' };
const credentials = { token: 'synthetic-token-only' };
const configured = { bindings: JSON.stringify([binding]), credentials: JSON.stringify({ [hotel.id]: credentials }) };
function fixture() {
  const property = { id: 'test-property', name: 'Test property', mode: 'shadow', currency: 'EUR', timezone: 'Europe/Madrid' };
  const http = vi.fn<typeof fetch>(async input => {
    const url = String(input);
    const data = url.endsWith('/room_types') ? { room_types: [{ id: 'DBL', name: 'Double', qty: 2 }] }
      : url.endsWith('/rate_plans') ? { rate_plans: [{ id: 'BB', room_type_id: 'DBL', name: 'Breakfast', sell_type: 'per_room' }] } : property;
    return Response.json({ status: 'ok', data });
  });
  return { property, http, client: new QuendooClient('staging', http) };
}
describe('Hotel connection setup and isolated read-only probe', () => {
  it('denies unauthorized hotel before reading its organization or configuration', async () => {
    const reader = { canManage: vi.fn(async () => false), hotel: vi.fn(async () => hotel) };
    await expect(authorizeConnectionHotel(reader, hotel.id, 'user')).rejects.toThrow();
    expect(reader.hotel).not.toHaveBeenCalled();
  });
  it('accepts only the hotel fetched under a verified authorized identity', async () => {
    const reader = { canManage: vi.fn(async () => true), hotel: vi.fn(async () => hotel) };
    expect(await authorizeConnectionHotel(reader, hotel.id, 'user')).toEqual(hotel);
    await expect(authorizeConnectionHotel(reader, '00000000-0000-4000-8000-000000000003', 'user')).rejects.toThrow();
    await expect(authorizeConnectionHotel(reader, hotel.id, '')).rejects.toThrow();
  });
  it('rejects client-selected property, organization and credential references', () => {
    expect(connectionHotelInput.safeParse({ hotelId: hotel.id }).success).toBe(true);
    for (const field of ['propertyId', 'organizationId', 'credentialRef']) expect(connectionHotelInput.safeParse({ hotelId: hotel.id, [field]: 'injected' }).success).toBe(false);
  });
  it('does not contact the provider when the backend binding is missing', async () => {
    const f = fixture();
    expect(await probeConnection(hotel, {}, f.client)).toMatchObject({ status: 'blocked', setup: { issue: 'binding_missing', incoming: 'not_active', outgoing: 'not_active' } });
    expect(f.http).not.toHaveBeenCalled();
  });
  it('rejects another organization before accessing its credentials', () => {
    expect(prepareConnection(hotel, { ...configured, bindings: JSON.stringify([{ ...binding, organizationId: '00000000-0000-4000-8000-000000000003' }]) }).setup.issue).toBe('binding_invalid');
  });
  it('rejects production and duplicate property/hotel routing', () => {
    for (const bindings of [[{ ...binding, environment: 'production' }], [binding, binding], [binding, { ...binding, hotelId: '00000000-0000-4000-8000-000000000003' }]]) {
      expect(prepareConnection(hotel, { ...configured, bindings: JSON.stringify(bindings) }).setup.issue).toBe('binding_invalid');
    }
  });
  it('never resolves a credential belonging to another hotel', () => {
    expect(prepareConnection(hotel, { ...configured, credentials: JSON.stringify({ other: credentials }) }).setup.issue).toBe('credentials_missing');
  });
  it.each(['not-json', JSON.stringify({ [hotel.id]: { token: 'bad\nheader' } }), JSON.stringify({ [hotel.id]: { clientId: 'test' } })])('fails closed on malformed credentials', credentials => {
    expect(prepareConnection(hotel, { ...configured, credentials }).setup.issue).toBe('credentials_invalid');
  });
  it('supports the documented OAuth credentials without sending a token to the browser DTO', () => {
    const result = prepareConnection(hotel, { ...configured, credentials: JSON.stringify({ [hotel.id]: { clientId: 'test-client', clientSecret: 'synthetic-secret' } }) });
    expect(result.setup.state).toBe('configured');
    expect(JSON.stringify(result.setup)).not.toContain('synthetic-secret');
    expect(result.setup).toMatchObject({ incoming: 'not_active', outgoing: 'not_active', persistence: 'activation_pending' });
  });
  it('verifies property, types and plans with GETs only and never imports or ACKs', async () => {
    const f = fixture();
    const result = await probeConnection(hotel, configured, f.client, () => new Date('2026-11-28T09:00:00Z'));
    expect(result).toMatchObject({ status: 'verified', checkedAt: '2026-11-28T09:00:00.000Z', timezoneMatches: true, property: { id: binding.propertyId } });
    expect(f.http).toHaveBeenCalledTimes(3);
    for (const [input, init] of f.http.mock.calls) { expect(init?.method).toBe('GET'); expect(String(input)).not.toMatch(/feed|ack|inventory/); }
    expect(JSON.stringify(result)).not.toContain(credentials.token);
  });
  it('detects timezone differences without rewriting PMS dates', async () => {
    const f = fixture(); f.property.timezone = 'Asia/Tokyo';
    expect(await probeConnection(hotel, configured, f.client)).toMatchObject({ status: 'verified', timezoneMatches: false });
    expect(hotel.timezone).toBe('Europe/Madrid');
  });
  it.each([{ id: 'other-property' }, { timezone: 'invalid/timezone' }, { mode: 'disabled' }])('rejects inconsistent property before catalogue reads', async override => {
    const f = fixture(); f.http.mockResolvedValueOnce(Response.json({ status: 'ok', data: { ...f.property, ...override } }));
    expect(await probeConnection(hotel, configured, f.client)).toMatchObject({ status: 'failed', code: 'invalid_data' });
    expect(f.http).toHaveBeenCalledTimes(1);
  });
  it('rejects plans pointing to unknown room types', async () => {
    const f = fixture(); f.http.mockImplementation(async input => Response.json({ status: 'ok', data: String(input).endsWith('/rate_plans') ? { rate_plans: [{ id: 'BB', room_type_id: 'unknown', name: 'Test', sell_type: 'per_room' }] } : String(input).endsWith('/room_types') ? { room_types: [] } : f.property }));
    expect(await probeConnection(hotel, configured, f.client)).toMatchObject({ status: 'failed', code: 'invalid_data' });
  });
  it('sanitizes provider errors without recording or returning response bodies', async () => {
    const f = fixture(); f.http.mockResolvedValue(new Response('private-provider-content', { status: 401 }));
    const result = await probeConnection(hotel, configured, f.client);
    expect(result).toMatchObject({ status: 'failed', code: 'provider_auth' });
    expect(JSON.stringify(result)).not.toContain('private-provider-content');
  });
});