import { describe, expect, it } from 'vitest';
import { distributionSnapshot, prepareReservationChange, reservationSnapshot, revenueNightSnapshot, invalidReservationCalendarIds } from '../lib/suite/api/pms';
import { comparePrices } from '../lib/suite/api/competitive';
import type { Reservation, Room } from '../lib/suite/data';

const rooms: Room[] = [{ number: '101', floor: 1, type: 'Doble', hk: 'dirty', oos: false, rate: 120 }, { number: '102', floor: 1, type: 'Doble', hk: 'clean', oos: true, rate: 120 }];
const reservation: Reservation = { id: 'local-a', guestId: 'private-guest', room: '101', inDay: 18, outDay: 20, createdDay: 17, eta: '14:00', pax: 2, channel: 'Recepción', amount: 240, status: 'confirmed', stay: 'none', notes: 'private-notes' };
describe('API PMS projections use existing rules without writes', () => {
  it('identifies invalid historical calendars without changing them or inventing nights', () => {
    const invalid = { ...reservation, id: 'historical-zero-night', inDay: 0, outDay: 0, stay: 'finished' as const };
    const before = JSON.stringify(invalid);
    expect(invalidReservationCalendarIds([reservation, invalid])).toEqual(['historical-zero-night']);
    expect(JSON.stringify(invalid)).toBe(before);
    expect(invalidReservationCalendarIds([reservation])).toEqual([]);
  });
  it('uses PMS overlap and out-of-service availability, not housekeeping state', () => {
    expect(distributionSnapshot([reservation], rooms, '2026-11-28').map(r => r.available)).toEqual([false, false]);
    expect(distributionSnapshot([{ ...reservation, status: 'cancelled' }], rooms, '2026-11-28').map(r => r.available)).toEqual([true, false]);
    expect(distributionSnapshot([reservation], rooms, '2026-11-30')[0]?.available).toBe(true);
  });
  it('exports true dates without mutating legacy rows or leaking guest data', () => {
    const before = JSON.stringify(reservation); const snapshot = reservationSnapshot(reservation);
    expect(snapshot.checkInDate).toBe('2026-11-28'); expect(snapshot.checkOutDate).toBe('2026-11-30');
    expect(JSON.stringify(reservation)).toBe(before); expect(snapshot).not.toHaveProperty('guestId'); expect(snapshot).not.toHaveProperty('notes');
  });
  it('rejects inconsistent stored calendars', () => {
    expect(() => reservationSnapshot({ ...reservation, checkInDate: '2026-11-29' })).toThrow();
    expect(() => distributionSnapshot([{ ...reservation, checkInDate: '2026-11-29' }], rooms, '2026-11-28')).toThrow();
  });
  it('normalizes external changes preserving absolute dates and legacy offsets', () => {
    const input = { externalId: 'ext-a', revision: 'v1', action: 'create', room: '101', checkInDate: '2026-11-28', checkOutDate: '2026-11-30', pax: 2, amount: 240, currency: 'EUR' };
    expect(prepareReservationChange(input)).toMatchObject({ inDay: 18, outDay: 20, checkInDate: '2026-11-28' });
    expect(() => prepareReservationChange({ ...input, checkOutDate: '2026-11-27' })).toThrow();
    expect(() => prepareReservationChange({ ...input, checkInDate: '2026-02-30' })).toThrow();
  });
  it('reuses Revenue nights and excludes cancellations/no-shows', () => {
    expect(revenueNightSnapshot([reservation, { ...reservation, id: 'cancel', status: 'cancelled' }, { ...reservation, id: 'noshow', status: 'noshow' }])).toEqual([
      { reservationId: 'local-a', date: '2026-11-28', amount: 120 }, { reservationId: 'local-a', date: '2026-11-29', amount: 120 },
    ]);
  });
});
const price = { hotelId: 'hotel-a', competitorId: 'own', date: '2026-11-28', currency: 'EUR', price: 120, roomCategory: 'double', occupancy: 2, mealPlan: 'room-only', refundable: true, taxesIncluded: true, source: 'https://source.example/observations', observedAt: '2026-11-28T08:00:00Z' };
describe('competitive observations are comparable and sourced', () => {
  it('calculates difference and percentage only from supplied observations', () => {
    expect(comparePrices(price, { ...price, competitorId: 'comp-a', price: 100 })).toMatchObject({ difference: 20, percentage: 20, source: price.source, observedAt: price.observedAt });
  });
  it.each([{ currency: 'USD' }, { occupancy: 1 }, { mealPlan: 'breakfast' }, { refundable: false }, { taxesIncluded: false }, { date: '2026-11-29' }, { roomCategory: 'suite' }, { hotelId: 'other' }])('rejects inequivalent conditions %j', change => {
    expect(comparePrices(price, { ...price, ...change })).toBeNull();
  });
  it('does not invent percentage against zero price or accept missing source', () => {
    expect(comparePrices(price, { ...price, price: 0 })?.percentage).toBeNull();
    expect(() => comparePrices(price, { ...price, source: '' })).toThrow();
  });
});