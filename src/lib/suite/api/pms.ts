import type { Reservation, Room } from '../data';
import { availableRooms } from '../reservations';
import { offsetToYmd, ymdToOffset } from '../clock';
import { withReservationCalendar } from '../temporal';
import { counts, nightlyRates } from '../revenue';
import { calendarDate, reservationChange } from './contracts';
import type { DistributionDay } from './contracts';

/** Identify invalid PMS calendars without rewriting history or returning guest data. */
export function invalidReservationCalendarIds(reservations: Reservation[]): string[] {
  return reservations.filter(reservation => {
    try { withReservationCalendar(reservation); return false; }
    catch { return true; }
  }).map(reservation => reservation.id);
}

/**
 * Split invalid calendars for read APIs. A legacy stay with no nights (outDay <= inDay)
 * occupies no room-night, so it can be excluded from projections and reported by id;
 * any other inconsistency still blocks reads because it could hide real occupancy.
 */
export function partitionInvalidCalendars(reservations: Reservation[]) {
  const invalid = new Set(invalidReservationCalendarIds(reservations));
  const zeroNight: string[] = [];
  const blocking: string[] = [];
  for (const r of reservations) {
    if (!invalid.has(r.id)) continue;
    if (typeof r.inDay === 'number' && typeof r.outDay === 'number' && r.outDay <= r.inDay) zeroNight.push(r.id);
    else blocking.push(r.id);
  }
  const excluded = new Set(zeroNight);
  return { valid: reservations.filter(r => !excluded.has(r.id)), zeroNight, blocking };
}

/** Read-only distribution projection. Uses PMS availability, including OOS and cancellations. */
export function distributionSnapshot(reservations: Reservation[], rooms: Room[], date: string): DistributionDay[] {
  const day = ymdToOffset(calendarDate.parse(date));
  // Apply the same calendar consistency check as reservation/revenue exports.
  // Do not publish availability from conflicting absolute and legacy dates.
  reservations.forEach(reservation => withReservationCalendar(reservation));
  const free = new Set(availableRooms(reservations, rooms, day, day + 1).map(r => r.number));
  return rooms.map(r => ({ date, room: r.number, available: free.has(r.number), rate: r.rate }));
}

/** Validate normalized external changes; no booking writes or external-id mappings are fabricated. */
export function prepareReservationChange(input: unknown) {
  const change = reservationChange.parse(input);
  return { ...change, inDay: ymdToOffset(change.checkInDate), outDay: ymdToOffset(change.checkOutDate) };
}

/** Export existing rows without mutation; conflicts in absolute/legacy dates stop export. No guest PII. */
export function reservationSnapshot(reservation: Reservation) {
  const r = withReservationCalendar(reservation);
  return { localId: r.id, room: r.room, checkInDate: r.checkInDate, checkOutDate: r.checkOutDate, pax: r.pax, amount: r.amount, status: r.status };
}

/** Revenue source only: the existing Revenue counting/rate rules remain authoritative. */
export function revenueNightSnapshot(reservations: Reservation[]) {
  return reservations.filter(counts).flatMap(r => {
    withReservationCalendar(r);
    return nightlyRates(r).map((amount, index) => ({ reservationId: r.id, date: offsetToYmd(r.inDay + index), amount }));
  });
}