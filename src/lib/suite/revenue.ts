/**
 * SUIT REVENUE · pure calculation rules (no UI, no storage).
 *
 * Counting rules (applied everywhere so totals never double count):
 * - Only reservations with status "confirmed" (pending, in house or finished) count.
 *   Cancelled and no-show reservations are excluded: the system stores no payment
 *   or refund records, so any guarantee charged cannot be verified.
 * - A reservation is one record; editing it replaces its amount, so modifications never duplicate.
 * - Revenue is accrued per night on the night's date (a stay crossing months is split).
 * - Amounts are taken as stored (taxes included as entered; no separate tax data exists).
 * - ADR = room revenue / room nights sold for the nights in the period.
 */
import type { Reservation } from "./data";

export interface Night { date: Date; amount: number; res: string }

export const nightsOf = (r: Pick<Reservation, "inDay" | "outDay">) => Math.max(0, r.outDay - r.inDay);

/** Per-night rates. Uses r.nightly when the reservation stores different prices per night. */
export function nightlyRates(r: Reservation & { nightly?: number[] }): number[] {
  const n = nightsOf(r);
  if (r.nightly && r.nightly.length === n) return r.nightly;
  return n ? Array.from({ length: n }, () => r.amount / n) : [];
}
export const avgNightly = (r: Reservation) => (nightsOf(r) ? r.amount / nightsOf(r) : 0);
export const counts = (r: Reservation) => r.status === "confirmed";

export function nights(list: Reservation[], toDate: (off: number) => Date): Night[] {
  return list.filter(counts).flatMap((r) => nightlyRates(r).map((amount, i) => ({ date: toDate(r.inDay + i), amount, res: r.id })));
}

/** First and last month (yyyy*12+m) with stored nights; outside it data is "not available". */
export function coverage(ns: Night[]): [number, number] | null {
  if (!ns.length) return null;
  const k = ns.map((n) => n.date.getFullYear() * 12 + n.date.getMonth());
  return [Math.min(...k), Math.max(...k)];
}
const inCov = (cov: [number, number] | null, y: number, m: number) => !!cov && y * 12 + m >= cov[0] && y * 12 + m <= cov[1];

/** Monthly revenue for a year; null = no data stored for that month. */
export function monthlyRevenue(ns: Night[], year: number): (number | null)[] {
  const cov = coverage(ns);
  return Array.from({ length: 12 }, (_, m) => inCov(cov, year, m)
    ? ns.filter((n) => n.date.getFullYear() === year && n.date.getMonth() === m).reduce((a, n) => a + n.amount, 0) : null);
}

/** Monthly ADR for a year; null when no room nights were sold. */
export function monthlyAdr(ns: Night[], year: number): (number | null)[] {
  return Array.from({ length: 12 }, (_, m) => {
    const x = ns.filter((n) => n.date.getFullYear() === year && n.date.getMonth() === m);
    return x.length ? x.reduce((a, n) => a + n.amount, 0) / x.length : null;
  });
}

export type Period = "mes" | "trimestre" | "ytd" | "anio";
/** Period [from, to) in a year, ending at "today" for running periods. */
export function periodRange(p: Period, year: number, today: Date): [Date, Date] {
  const m = today.getMonth();
  const end = new Date(year, m, today.getDate() + 1);
  if (p === "mes") return [new Date(year, m, 1), end];
  if (p === "trimestre") return [new Date(year, m - (m % 3), 1), end];
  if (p === "ytd") return [new Date(year, 0, 1), end];
  return [new Date(year, 0, 1), new Date(year + 1, 0, 1)];
}

export interface Yoy { current: number; previous: number | null; diff: number | null; pct: number | null }
/** Same period this year vs last year. previous=null when last year has no stored data. */
export function yoy(ns: Night[], p: Period, year: number, today: Date): Yoy {
  const sum = (y: number) => { const [a, b] = periodRange(p, y, today); return ns.filter((n) => n.date >= a && n.date < b).reduce((s, n) => s + n.amount, 0); };
  const cov = coverage(ns);
  const [a] = periodRange(p, year - 1, today);
  const current = sum(year);
  if (!inCov(cov, year - 1, a.getMonth()) && !inCov(cov, year - 1, 11)) return { current, previous: null, diff: null, pct: null };
  const previous = sum(year - 1);
  return { current, previous, diff: current - previous, pct: previous ? ((current - previous) / previous) * 100 : null };
}

/** Year-end forecast = revenue already accrued up to today + confirmed future nights this year (on the books). */
export function forecastYear(ns: Night[], year: number, today: Date) {
  const cut = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const inYear = ns.filter((n) => n.date.getFullYear() === year);
  const actual = inYear.filter((n) => n.date < cut).reduce((s, n) => s + n.amount, 0);
  const otb = inYear.filter((n) => n.date >= cut).reduce((s, n) => s + n.amount, 0);
  return { actual, otb, total: actual + otb };
}

export const deviation = (budget: number, real: number) => ({ diff: real - budget, pct: budget ? ((real - budget) / budget) * 100 : null });

/** Split an annual amount evenly into 12 months (rounded to cents, remainder on December). */
export function splitBudget(total: number): number[] {
  const m = Math.floor((total / 12) * 100) / 100;
  const arr = Array.from({ length: 12 }, () => m);
  arr[11] = Math.round((total - m * 11) * 100) / 100;
  return arr;
}
