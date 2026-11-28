import { describe, expect, it } from 'vitest';
import type { Reservation } from '../lib/suite/data';
import { roomRevenueForOffsets } from '../lib/suite/revenue';

const base: Reservation & { nightly: number[] } = { id: 'isolated', guestId: 'guest-test', room: '101', inDay: 0, outDay: 2, eta: '', notes: '', pax: 2, amount: 300, nightly: [100, 200], channel: 'Recepción', status: 'confirmed', stay: 'none', createdDay: 0 };
describe('shared dashboard / Revenue counting', () => {
  it('uses the stored nightly price, not an average', () => expect(roomRevenueForOffsets([base], 1, 2)).toEqual({ revenue: 200, roomNights: 1 }));
  it('excludes checkout night even for an inhouse row', () => expect(roomRevenueForOffsets([{ ...base, stay: 'inhouse' }], 2, 3)).toEqual({ revenue: 0, roomNights: 0 }));
  it.each(['cancelled', 'noshow'] as const)('excludes %s from current-month revenue', status => expect(roomRevenueForOffsets([{ ...base, status }], 0, 2)).toEqual({ revenue: 0, roomNights: 0 }));
  it('splits a stay at the selected period boundary', () => expect(roomRevenueForOffsets([base], 0, 1)).toEqual({ revenue: 100, roomNights: 1 }));
});