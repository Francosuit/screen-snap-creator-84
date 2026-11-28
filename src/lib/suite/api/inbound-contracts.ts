import { z } from 'zod';
import { isCalendarDate } from '../clock';

const day = z.string().refine(isCalendarDate, 'Fecha inválida');
/** Browser submits only the internal hotel and a booking draft; property, keys and signing stay on the server. */
export const testRevisionInput = z.object({
  hotelId: z.string().uuid(),
  action: z.enum(['create', 'modify', 'cancel']),
  bookingCode: z.string().regex(/^SBX-[A-Z0-9]{6}$/).optional(),
  guestName: z.string().trim().min(1).max(120),
  checkIn: day, checkOut: day,
  adults: z.number().int().min(1).max(10),
  roomCode: z.string().min(1).max(40),
  amount: z.number().finite().min(0).max(100000),
}).strict().refine(v => v.checkOut > v.checkIn, 'La salida debe ser posterior a la entrada')
  .refine(v => v.action === 'create' || !!v.bookingCode, 'Falta el código de reserva');
export type TestRevisionInput = z.infer<typeof testRevisionInput>;

export interface SyncLogEntry { at: string; status: string; revisionId: string; bookingCode: string | null; revisionType: string | null; reservationId: string | null; room: string | null; reason: string | null; action: string | null }
export interface InboundStatus { mode: 'test' | 'staging' | 'production' | 'none'; propertyId: string | null; roomTypes: { code: string; type: string }[]; endpoint: string; log: SyncLogEntry[] }
