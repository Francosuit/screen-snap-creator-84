import { z } from 'zod';
import { calendarDate } from './contracts';

/** Observations must be supplied by a real source; no scraping, fixtures or recommended rates. */
export const priceObservation = z.object({
  hotelId: z.string().min(1), competitorId: z.string().min(1),
  date: calendarDate, currency: z.string().regex(/^[A-Z]{3}$/),
  price: z.number().finite().nonnegative(), roomCategory: z.string().min(1),
  occupancy: z.number().int().min(1), mealPlan: z.string().min(1),
  refundable: z.boolean(), taxesIncluded: z.boolean(),
  source: z.string().url(), observedAt: z.string().datetime({ offset: true }),
}).strict();
export type PriceObservation = z.infer<typeof priceObservation>;

/** Comparable nightly price: same date, currency, category, occupancy, board and conditions. */
export function comparePrices(ownInput: unknown, competitorInput: unknown) {
  const own = priceObservation.parse(ownInput), competitor = priceObservation.parse(competitorInput);
  const keys = ['hotelId', 'date', 'currency', 'roomCategory', 'occupancy', 'mealPlan', 'refundable', 'taxesIncluded'] as const;
  if (keys.some(key => own[key] !== competitor[key])) return null;
  return { difference: own.price - competitor.price, percentage: competitor.price === 0 ? null : (own.price - competitor.price) / competitor.price * 100,
    source: competitor.source, observedAt: competitor.observedAt };
}