import { z } from 'zod';
import { calendarDate } from './contracts';
import { isCalendarDate, ymdToOffset } from '../clock';

// Source: https://api.quendoo.com/v1/qc/openapi.yaml (28 Nov 2026).
export const qcId = z.string().trim().min(1).max(191);
const sequence = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const qcFeedInput = z.object({ since: sequence.default(0), limit: z.number().int().min(1).max(200).default(50) }).strict();
export const qcRevision = z.object({
  id: sequence.refine(id => id > 0), booking_code: qcId,
  // Require the provider's canonical property_id; never trust ext_property_id as an internal hotel id.
  property_id: qcId,
  revision_type: z.enum(['created', 'modified', 'cancelled', 'no_show', 'confirmed', 'requested', 'approved']),
  payload: z.record(z.unknown()), created_at: z.string().datetime({ offset: true }),
});
export type QuendooRevision = z.infer<typeof qcRevision>;
export const qcFeed = z.object({ booking_revisions: z.array(qcRevision).max(200), next_cursor: sequence });
export const qcProperty = z.object({ id: qcId, name: z.string().nullable(), mode: z.enum(['legacy', 'shadow', 'live', 'disabled']), currency: z.string().regex(/^[A-Z]{3}$/), timezone: z.string().min(1).max(100) });
export const qcRoomType = z.object({ id: qcId, name: z.string(), qty: z.number().int().nonnegative() });
export const qcRatePlan = z.object({ id: qcId, room_type_id: qcId, name: z.string(), sell_type: z.enum(['per_room', 'per_person', 'per_occupancy']) });
const dates = { room_type_id: qcId, date_from: calendarDate, date_to: calendarDate };
const range = (v: { date_from: string; date_to: string }) => v.date_to >= v.date_from;
const availabilityRow = z.object({ ...dates, availability: z.number().int().min(0).max(9999).optional(), opened: z.boolean().optional(), closed: z.boolean().optional() }).strict()
  .refine(range, 'Invalid date range').refine(v => v.availability !== undefined || v.opened !== undefined || v.closed !== undefined, 'Missing availability change');
const ratesRow = z.object({ ...dates, rate_plan_id: qcId, rate: z.number().finite().nonnegative().optional(), prices: z.record(z.string().min(1).max(40), z.number().finite().nonnegative()).optional() }).strict()
  .refine(range, 'Invalid date range').refine(v => (v.rate !== undefined) !== (v.prices !== undefined), 'Supply rate OR prices')
  .refine(v => !v.prices || (Object.keys(v.prices).length >= 1 && Object.keys(v.prices).length <= 64), 'Invalid occupancy price count');
const restrictionsRow = z.object({ ...dates, rate_plan_id: qcId, min_los: z.number().int().min(1).max(365).nullable().optional(), max_los: z.number().int().min(1).max(365).nullable().optional(), stop_sell: z.boolean().nullable().optional(), closed_to_arrival: z.boolean().nullable().optional(), closed_to_departure: z.boolean().nullable().optional() }).strict()
  .refine(range, 'Invalid date range').refine(v => Object.keys(v).some(k => !['room_type_id', 'rate_plan_id', 'date_from', 'date_to'].includes(k)), 'Missing restriction')
  .refine(v => v.min_los == null || v.max_los == null || v.min_los <= v.max_los, 'Invalid stay range');
function batch<T extends z.ZodType<{ date_from: string; date_to: string }>>(row: T) {
  return z.object({ values: z.array(row).min(1).max(1000) }).strict().refine(v => v.values.every(x => isCalendarDate(x.date_from) && isCalendarDate(x.date_to)) && v.values.reduce((sum, x) => sum + ymdToOffset(x.date_to) - ymdToOffset(x.date_from) + 1, 0) <= 20000, 'Batch exceeds 20000 nights or has invalid dates');
}
export const qcAvailability = batch(availabilityRow);
export const qcRates = batch(ratesRow);
export const qcRestrictions = batch(restrictionsRow);
export const qcWriteResult = z.object({ written: sequence, unchanged: sequence, skipped_out_of_window: sequence, dry: z.boolean(), dry_reason: z.enum(['property_dry', 'platform_disabled']).nullable(), warnings: z.array(z.object({ index: sequence, code: z.string().min(1).max(200) })).max(1000) });