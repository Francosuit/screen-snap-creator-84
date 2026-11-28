import { z } from 'zod';
import type { Channel, Guest, Reservation, Room } from '../data';
import { availableRooms } from '../reservations';
import { isCalendarDate, ymdToOffset } from '../clock';
import { reservationCalendar } from '../temporal';
import { qcId, qcRevision } from './quendoo-contracts';
import type { QuendooRevision } from './quendoo-contracts';

/**
 * Inbound booking processing for Quendoo revisions (official BookingRevision shape,
 * payload = PMS v1 `Booking/getBookings` booking). Pure: no I/O, no clock reads.
 * The PMS remains the source of truth; this only plans a write through existing rules.
 */

export const inboundBinding = z.object({
  hotelId: z.string().uuid(), organizationId: z.string().uuid(), propertyId: qcId,
  provider: z.enum(['quendoo', 'suite']).default('quendoo'),
  integrationId: z.string().uuid().optional(),
  environment: z.enum(['test', 'staging', 'production']),
  /** Provider room code (ext_room_id or room_id) → Suite room type (hotel_rooms.type). */
  roomTypes: z.record(z.string().min(1).max(191), z.string().min(1).max(120)),
  /** Optional exact external-room → internal-room mapping. It never falls back to another room. */
  roomMappings: z.record(z.string().min(1).max(80), z.string().min(1).max(40)).optional(),
}).strict();
export type InboundBinding = z.infer<typeof inboundBinding>;

export interface ExternalRef {
  provider: 'quendoo' | 'suite'; environment: InboundBinding['environment']; propertyId: string; bookingCode: string;
  integrationId?: string; revisionId: number; revisionType: QuendooRevision['revision_type']; otaCode: string | null; roomCode: string; receivedAt: string;
}
export type ExternalReservation = Reservation & { external?: ExternalRef };

const num = z.coerce.number().finite();
const item = z.object({
  booking_item_status: z.string().optional(), room_id: z.union([z.string(), z.number()]).optional(), ext_room_id: z.union([z.string(), z.number()]).nullable().optional(),
  num_adults: num.optional(), adults: num.optional(), num_children: num.optional(), children: num.optional(),
  amount: num.optional(), price: num.optional(),
}).passthrough();
export const qcBooking = z.object({
  status: z.string().optional(), checkin_date: z.string(), checkout_date: z.string(),
  total_amount: num.optional(), total_price: z.object({ amount: num, currency: z.string() }).optional(), currency: z.string().optional(),
  num_adults: num.optional(), num_children: num.optional(),
  client: z.object({ name: z.string().optional(), first_name: z.string().optional(), last_name: z.string().optional(), email: z.string().optional(), phone: z.string().optional(), nationality: z.string().optional(), country: z.string().optional() }).passthrough().optional(),
  bs_ota_code: z.string().nullable().optional(), additional_notes: z.string().nullable().optional(),
  booking_items: z.array(item).max(50).default([]),
}).passthrough();

export type RejectReason = 'property_mismatch' | 'invalid_payload' | 'invalid_dates' | 'currency_unsupported' | 'multi_room_unsupported'
  | 'room_type_unmapped' | 'no_room_available' | 'capacity_exceeded' | 'stay_in_progress';
export type IgnoreReason = 'request_pending' | 'unknown_booking' | 'past_stay';
export type InboundAction = 'created' | 'modified' | 'cancelled' | 'no_show';
export type Plan =
  | { kind: 'apply'; action: InboundAction; reservation: ExternalReservation; guest: Guest }
  | { kind: 'duplicate'; reservationId: string }
  | { kind: 'ignored'; reason: IgnoreReason; reservationId: string }
  | { kind: 'rejected'; reason: RejectReason; reservationId: string };

export type PlanRoom = Pick<Room, 'number' | 'type' | 'rate' | 'oos'> & { capacity?: number | undefined };
export interface PlanContext {
  reservations: ExternalReservation[]; rooms: PlanRoom[]; guest: Guest | null;
  today: number; nowIso: string; time: string;
}

const safe = (code: string) => code.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64);
/** Deterministic hotel-scoped ids: the same external booking can only ever be one PMS row. */
export const externalIds = (bookingCode: string, provider: 'quendoo' | 'suite' = 'quendoo') => provider === 'suite'
  ? { reservationId: `A-${safe(bookingCode)}`, guestId: `ga-${safe(bookingCode)}` }
  : { reservationId: `Q-${safe(bookingCode)}`, guestId: `gq-${safe(bookingCode)}` };
const channelOf = (ota: string | null | undefined): Channel => ota === 'BDC' ? 'Booking.com' : ota === 'EXP' ? 'Expedia' : ota === 'ABB' || ota === 'AIR' ? 'Airbnb' : 'Web directa';
const text = (v: string | undefined, max: number) => (v ?? '').trim().slice(0, max);

export function planRevision(input: unknown, binding: InboundBinding, ctx: PlanContext): Plan {
  const parsedRevision = qcRevision.safeParse(input);
  const fallbackId = externalIds(typeof (input as { booking_code?: unknown })?.booking_code === 'string' ? (input as { booking_code: string }).booking_code : 'desconocida', binding.provider).reservationId;
  if (!parsedRevision.success) return { kind: 'rejected', reason: 'invalid_payload', reservationId: fallbackId };
  const revision = parsedRevision.data;
  const { reservationId, guestId } = externalIds(revision.booking_code, binding.provider);
  const reject = (reason: RejectReason): Plan => ({ kind: 'rejected', reason, reservationId });
  // Routing comes from the backend binding only; never accept another property's booking.
  if (revision.property_id !== binding.propertyId) return reject('property_mismatch');
  const existing = ctx.reservations.find(r => r.id === reservationId);
  if (existing?.external && binding.provider === 'suite' && existing.external.integrationId !== binding.integrationId) return reject('property_mismatch');
  if (existing?.external && existing.external.revisionId >= revision.id) return { kind: 'duplicate', reservationId };
  const parsed = qcBooking.safeParse(revision.payload);
  if (!parsed.success) return reject('invalid_payload');
  const b = parsed.data;
  const status = (b.status ?? '').toUpperCase();
  const cancelled = revision.revision_type === 'cancelled' || status === 'CANCELLED';
  const noShow = revision.revision_type === 'no_show';
  // Requests hold no rooms until approved (official feed semantics).
  if (!cancelled && (revision.revision_type === 'requested' || status === 'REQUESTED')) return { kind: 'ignored', reason: 'request_pending', reservationId };
  if ((cancelled || noShow) && !existing) return { kind: 'ignored', reason: 'unknown_booking', reservationId };
  if (!isCalendarDate(b.checkin_date) || !isCalendarDate(b.checkout_date)) return reject('invalid_dates');
  const inDay = ymdToOffset(b.checkin_date), outDay = ymdToOffset(b.checkout_date);
  if (outDay <= inDay) return reject('invalid_dates');
  const currency = b.currency ?? b.total_price?.currency ?? 'EUR';
  if (currency.toUpperCase() !== 'EUR') return reject('currency_unsupported');
  const active = b.booking_items.filter(i => (i.booking_item_status ?? '').toLowerCase() !== 'cancelled');
  const items = active.length ? active : b.booking_items;
  if (items.length !== 1) return reject(items.length ? 'multi_room_unsupported' : 'invalid_payload');
  const it = items[0]!;
  const roomCode = String(it.ext_room_id ?? it.room_id ?? '');
  const own = (key: string) => Object.prototype.hasOwnProperty.call(binding.roomTypes, key) ? binding.roomTypes[key] : undefined;
  const type = own(roomCode) ?? (it.room_id !== undefined ? own(String(it.room_id)) : undefined);
  const mappedRoom = binding.roomMappings?.[roomCode] ?? (it.room_id !== undefined ? binding.roomMappings?.[String(it.room_id)] : undefined);
  if (!type && !mappedRoom) return reject('room_type_unmapped');
  const adults = it.num_adults ?? it.adults ?? b.num_adults ?? 1;
  const children = it.num_children ?? it.children ?? b.num_children ?? 0;
  const pax = Math.max(1, Math.round(adults + children));
  const amount = Math.max(0, Math.round((b.total_amount ?? b.total_price?.amount ?? it.amount ?? it.price ?? 0) * 100) / 100);
  const action: InboundAction = cancelled ? 'cancelled' : noShow ? 'no_show' : existing ? 'modified' : 'created';

  if (existing && existing.stay !== 'none') {
    // In-house/finished stays are reception's responsibility; a remote change needs manual review.
    return reject('stay_in_progress');
  }
  if (!existing && outDay <= ctx.today) return { kind: 'ignored', reason: 'past_stay', reservationId };

  let room = existing?.room ?? '';
  if (!cancelled && !noShow) {
    const candidates = (mappedRoom ? ctx.rooms.filter(r => r.number === mappedRoom) : ctx.rooms.filter(r => r.type === type)).sort((a, b2) => a.number.localeCompare(b2.number, 'en', { numeric: true }));
    if (!candidates.length) return reject('room_type_unmapped');
    const fits = candidates.filter(r => !r.capacity || pax <= r.capacity);
    if (!fits.length) return reject('capacity_exceeded');
    const free = availableRooms(ctx.reservations, fits as Room[], inDay, outDay, reservationId).map(r => r.number);
    room = existing && free.includes(existing.room) ? existing.room : free[0] ?? '';
    if (!room) return reject('no_room_available');
  }
  const client = b.client ?? {};
  const name = text(client.name, 120) || text(`${client.first_name ?? ''} ${client.last_name ?? ''}`, 120) || `Reserva ${revision.booking_code}`;
  const previous = ctx.guest;
  const guest: Guest = {
    id: guestId, name, doc: previous?.doc ?? '—', lang: previous?.lang ?? '—', companions: previous?.companions ?? [], notes: previous?.notes ?? '', messaging: previous?.messaging ?? false,
    phone: text(client.phone, 40) || previous?.phone || '—', email: text(client.email, 200) || previous?.email || '—',
    country: text(client.nationality ?? client.country, 60) || previous?.country || '—',
  };
  const createdDay = existing?.createdDay ?? ctx.today;
  const keepDates = cancelled || noShow;
  const base = existing ?? null;
  const dates = keepDates && base ? { inDay: base.inDay, outDay: base.outDay } : { inDay, outDay };
  const source = binding.provider === 'suite' ? 'API Suite Hotel OS' : 'API Quendoo';
  const labels: Record<InboundAction, string> = { created: `Reserva recibida por ${source}`, modified: `Modificación recibida por ${source}`, cancelled: `Cancelación recibida por ${source}`, no_show: `No-show recibido por ${source}` };
  const reservation: ExternalReservation = {
    id: reservationId, guestId, room, ...dates, eta: base?.eta ?? '—', pax: keepDates && base ? base.pax : pax,
    channel: channelOf(b.bs_ota_code), amount: keepDates && base ? base.amount : amount,
    status: cancelled ? 'cancelled' : noShow ? 'noshow' : 'confirmed', stay: 'none',
    notes: text(b.additional_notes ?? base?.notes ?? '', 1000), createdDay,
    ...reservationCalendar(dates.inDay, dates.outDay, createdDay),
    history: [...(base?.history ?? []), { at: ctx.time, day: ctx.today, actor: 'Quendoo', text: `${labels[action]} · rev ${revision.id} · ${revision.booking_code}${room ? ` · habitación ${room}` : ''}` }].slice(-50),
    external: { provider: binding.provider, environment: binding.environment, propertyId: binding.propertyId, bookingCode: revision.booking_code, ...(binding.integrationId ? { integrationId: binding.integrationId } : {}), revisionId: revision.id, revisionType: revision.revision_type, otaCode: b.bs_ota_code ?? null, roomCode, receivedAt: ctx.nowIso },
  };
  return { kind: 'apply', action, reservation, guest };
}
