import { beforeAll, describe, expect, it } from 'vitest';
import { webcrypto } from 'node:crypto';
import { planRevision } from '../lib/suite/api/inbound';
import type { ExternalReservation, InboundBinding, PlanContext } from '../lib/suite/api/inbound';
import { handleQuendooWebhook, receiveRevision, signDelivery, testSigningKey } from '../lib/suite/api/inbound.server';
import type { InboundOutcome, InboundStore } from '../lib/suite/api/inbound.server';
import { ymdToOffset } from '../lib/suite/clock';
import type { Guest } from '../lib/suite/data';

beforeAll(() => { if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true }); });

const binding: InboundBinding = { hotelId: '11111111-1111-4111-8111-111111111111', organizationId: '22222222-2222-4222-8222-222222222222', propertyId: 'prop-1', environment: 'test', roomTypes: { 'DBL-STD': 'Doble Estándar', 'DBL-SUP': 'Doble Superior' } };
const rooms = [{ number: '101', type: 'Doble Estándar', rate: 120, oos: false, capacity: 2 }, { number: '201', type: 'Doble Estándar', rate: 120, oos: false, capacity: 2 }, { number: '102', type: 'Doble Superior', rate: 150, oos: false, capacity: 2 }];
const NOW = new Date('2026-11-28T10:00:00Z');
const today = ymdToOffset('2026-11-28');
function rev(id: number, type: string, over: Record<string, unknown> = {}, item: Record<string, unknown> = {}) {
  return { id, booking_code: 'SBX-AAA111', property_id: 'prop-1', revision_type: type, created_at: '2026-11-28T09:00:00Z',
    payload: { status: type === 'cancelled' ? 'CANCELLED' : 'CREATED', checkin_date: '2026-12-01', checkout_date: '2026-12-03', total_amount: 240, currency: 'EUR', bs_ota_code: 'QCN', client: { name: 'Ana Test', email: 'a@t.invalid' }, booking_items: [{ room_id: 1, ext_room_id: 'DBL-STD', num_adults: 2, ...item }], ...over } };
}
const ctx = (reservations: ExternalReservation[] = []): PlanContext => ({ reservations, rooms, guest: null, today, nowIso: NOW.toISOString(), time: '11:00' });

function memoryStore() {
  const reservations = new Map<string, { data: ExternalReservation; version: number }>();
  const guests = new Map<string, Guest>();
  const log: InboundOutcome[] = [];
  const store: InboundStore = {
    async hotel(id) { return id === binding.hotelId ? { id, organizationId: binding.organizationId, timezone: 'Europe/Madrid' } : null; },
    async load(_h, rid, gid) { return { reservations: [...reservations.values()].map(r => r.data), rooms, guest: guests.get(gid) ?? null, version: reservations.get(rid)?.version ?? null }; },
    async saveGuest(_h, g) { guests.set(g.id, g); },
    async saveReservation(_h, r, expected) {
      const cur = reservations.get(r.id);
      if ((cur?.version ?? null) !== expected) return false;
      reservations.set(r.id, { data: structuredClone(r), version: (cur?.version ?? 0) + 1 });
      return true;
    },
    async read(_h, id) { return reservations.get(id)?.data ?? null; },
    async log(_h, _b, o) { log.push(o); },
  };
  return { store, reservations, guests, log };
}

describe('planRevision — validación y mapeo', () => {
  it('crea la reserva en una habitación libre del tipo mapeado, con fechas reales y sin PII en el registro', () => {
    const plan = planRevision(rev(10, 'created'), binding, ctx());
    expect(plan.kind).toBe('apply');
    if (plan.kind !== 'apply') return;
    expect(plan.reservation).toMatchObject({ id: 'Q-SBX-AAA111', room: '101', checkInDate: '2026-12-01', checkOutDate: '2026-12-03', inDay: ymdToOffset('2026-12-01'), outDay: ymdToOffset('2026-12-03'), pax: 2, amount: 240, status: 'confirmed', stay: 'none' });
    expect(plan.reservation.external?.revisionId).toBe(10);
    expect(plan.guest.name).toBe('Ana Test');
  });
  it('rechaza otra propiedad, tipo sin correspondencia, moneda distinta y varias habitaciones', () => {
    expect(planRevision({ ...rev(1, 'created'), property_id: 'otra' }, binding, ctx())).toMatchObject({ kind: 'rejected', reason: 'property_mismatch' });
    expect(planRevision(rev(1, 'created', {}, { ext_room_id: 'SUITE' }), binding, ctx())).toMatchObject({ kind: 'rejected', reason: 'room_type_unmapped' });
    expect(planRevision(rev(1, 'created', { currency: 'BGN' }), binding, ctx())).toMatchObject({ kind: 'rejected', reason: 'currency_unsupported' });
    const two = rev(1, 'created'); (two.payload as { booking_items: unknown[] }).booking_items.push({ ext_room_id: 'DBL-STD', num_adults: 1 });
    expect(planRevision(two, binding, ctx())).toMatchObject({ kind: 'rejected', reason: 'multi_room_unsupported' });
    expect(planRevision(rev(1, 'created', {}, { num_adults: 3 }), binding, ctx())).toMatchObject({ kind: 'rejected', reason: 'capacity_exceeded' });
  });
  it('no bloquea habitaciones por solicitudes pendientes y evita sobreventa', () => {
    expect(planRevision(rev(1, 'requested', { status: 'REQUESTED' }), binding, ctx())).toMatchObject({ kind: 'ignored', reason: 'request_pending' });
    const busy = (id: string, room: string) => ({ id, guestId: 'g', room, inDay: ymdToOffset('2026-12-02'), outDay: ymdToOffset('2026-12-04'), eta: '', pax: 1, channel: 'Recepción', amount: 1, status: 'confirmed', stay: 'none', notes: '', createdDay: 0 }) as ExternalReservation;
    expect(planRevision(rev(1, 'created'), binding, ctx([busy('A', '101'), busy('B', '201')]))).toMatchObject({ kind: 'rejected', reason: 'no_room_available' });
  });
});

describe('receiveRevision — guardado, duplicados, modificación y cancelación', () => {
  it('una reserva recorre creación → duplicado → modificación → cancelación como una sola fila', async () => {
    const m = memoryStore();
    expect(await receiveRevision(m.store, binding, rev(10, 'created'), NOW)).toMatchObject({ status: 'applied', action: 'created', room: '101' });
    expect(await receiveRevision(m.store, binding, rev(10, 'created'), NOW)).toMatchObject({ status: 'duplicate' });
    const mod = await receiveRevision(m.store, binding, rev(11, 'modified', { checkout_date: '2026-12-05', total_amount: 480 }), NOW);
    expect(mod).toMatchObject({ status: 'applied', action: 'modified', room: '101' });
    expect(m.reservations.get('Q-SBX-AAA111')?.data).toMatchObject({ checkOutDate: '2026-12-05', amount: 480, status: 'confirmed' });
    expect(await receiveRevision(m.store, binding, rev(10, 'created'), NOW)).toMatchObject({ status: 'duplicate' }); // older revision never overwrites newer
    expect(await receiveRevision(m.store, binding, rev(12, 'cancelled'), NOW)).toMatchObject({ status: 'applied', action: 'cancelled' });
    expect(m.reservations.size).toBe(1);
    const final = m.reservations.get('Q-SBX-AAA111')!;
    expect(final.data).toMatchObject({ status: 'cancelled', checkOutDate: '2026-12-05', amount: 480 });
    expect(final.data.history).toHaveLength(3);
    expect(m.log.map(l => l.status)).toEqual(['applied', 'duplicate', 'applied', 'duplicate', 'applied']);
    expect(JSON.stringify(m.log)).not.toContain('Ana Test');
  });
  it('una estancia en curso no se modifica desde fuera', async () => {
    const m = memoryStore();
    await receiveRevision(m.store, binding, rev(10, 'created'), NOW);
    m.reservations.get('Q-SBX-AAA111')!.data.stay = 'inhouse';
    expect(await receiveRevision(m.store, binding, rev(11, 'cancelled'), NOW)).toMatchObject({ status: 'rejected', reason: 'stay_in_progress' });
  });
});

describe('handleQuendooWebhook — autenticación del proveedor', () => {
  it('rechaza firmas ausentes o falsas y acepta la firma oficial', async () => {
    const m = memoryStore();
    const secret = (await testSigningKey('root-for-tests'))!;
    const deps = { bindings: [binding], secretFor: () => secret, store: m.store, now: () => NOW };
    const raw = JSON.stringify({ property_id: 'prop-1', booking_revision: rev(10, 'created') });
    expect((await handleQuendooWebhook(raw, new Headers(), deps)).status).toBe(401);
    const wrong = await signDelivery(raw, 'otro-secreto', 'booking.created', 'evt_1', NOW);
    expect((await handleQuendooWebhook(raw, wrong, deps)).status).toBe(401);
    const tampered = await signDelivery(raw, secret, 'booking.created', 'evt_1', NOW);
    expect((await handleQuendooWebhook(raw.replace('240', '1'), tampered, deps)).status).toBe(401);
    expect(m.reservations.size).toBe(0);
    const ok = await handleQuendooWebhook(raw, await signDelivery(raw, secret, 'booking.created', 'evt_1', NOW), deps);
    expect(ok).toMatchObject({ status: 200, body: { status: 'applied' } });
    expect(m.reservations.size).toBe(1);
  });
  it('staging trata el aviso como timbre y exige lectura del feed', async () => {
    const m = memoryStore();
    const staging = { ...binding, environment: 'staging' as const };
    const raw = JSON.stringify({ property_id: 'prop-1' });
    const res = await handleQuendooWebhook(raw, await signDelivery(raw, 's', 'booking.created', 'e', NOW), { bindings: [staging], secretFor: () => 's', store: m.store, now: () => NOW });
    expect(res.status).toBe(503);
    expect(m.reservations.size).toBe(0);
  });
});
