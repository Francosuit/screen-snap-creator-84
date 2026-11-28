import { z } from 'zod';
import { isCalendarDate } from '../clock';

export const apiOperation = z.enum(['reservations.pull', 'reservation.upsert', 'reservation.cancel', 'availability.push', 'rates.push', 'restrictions.push']);
export type ApiOperation = z.infer<typeof apiOperation>;
const id = z.string().trim().min(1).max(160);
export const apiRequest = z.object({
  organizationId: id, hotelId: id, connectionId: id,
  operation: apiOperation, idempotencyKey: id,
  // Adapters own provider-specific validation; never log payloads or return them in history.
  payload: z.record(z.unknown()),
}).strict();
export type ApiRequest = z.infer<typeof apiRequest>;
export interface Connection {
  id: string; organizationId: string; hotelId: string; providerId: string;
  authorizedUserId: string;
  status: 'unconfigured' | 'connected' | 'disabled' | 'error';
  /** Reference only. Actual credentials are resolved in the server boundary. */
  credentialRef: string;
}
export type ApiErrorCode = 'provider_auth' | 'rate_limit' | 'unavailable' | 'invalid_data' | 'unknown';
export type ApiOutcome = { status: 'succeeded'; attempts: number } | { status: 'failed'; attempts: number; code: ApiErrorCode };

export const calendarDate = z.string().refine(isCalendarDate, 'Invalid calendar date');
/** Canonical inbound data, not a second reservation entity. Applying it requires the existing PMS command. */
export const reservationChange = z.object({
  externalId: id, revision: id, action: z.enum(['create', 'modify', 'cancel']),
  room: id, checkInDate: calendarDate, checkOutDate: calendarDate,
  pax: z.number().int().min(1).max(100), amount: z.number().finite().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
}).strict().refine(r => r.checkOutDate > r.checkInDate, 'Departure must follow arrival');

export interface DistributionDay {
  date: string; room: string; available: boolean; rate: number;
  /** No invented restrictions: absent until a real PMS source exists. */
  restrictions?: { minStay?: number; closedArrival?: boolean; closedDeparture?: boolean };
}