// Hotel calendar clock. Stored day offsets (inDay/outDay/day) are absolute:
// offset 0 = 10 Nov 2026 (the date the UI showed as "Hoy" when every existing
// row was written). Real hotels read "today" from the real clock in their own
// time zone; the demo keeps its fixed clock. Pure calendar-day arithmetic in UTC
// so a time zone never moves a reservation to another day.
export const EPOCH_YMD = "2026-11-10";
export const DEFAULT_TZ = "Europe/Madrid";
const DAY = 86_400_000;
const utcOf = (ymd: string) => { const [y, m, d] = ymd.split("-").map(Number); return Date.UTC(y, m - 1, d); };

/** Calendar date (YYYY-MM-DD) at instant `now` in time zone `tz`. */
export function hotelYmd(tz: string, now: Date): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g("year")}-${g("month")}-${g("day")}`;
}
export const ymdToOffset = (ymd: string) => Math.round((utcOf(ymd) - utcOf(EPOCH_YMD)) / DAY);
export const offsetToYmd = (off: number) => new Date(utcOf(EPOCH_YMD) + off * DAY).toISOString().slice(0, 10);
/** Absolute offset of "today": demo is fixed at 0, real hotels follow the real clock in their zone. */
export const todayOffset = (mode: "demo" | "real", tz: string = DEFAULT_TZ, now: Date = new Date()) =>
  mode === "demo" ? 0 : ymdToOffset(hotelYmd(tz, now));
/** Nights of a stay: arrival included, departure excluded. */
export const nightsOf = (inDay: number, outDay: number) => Math.max(0, outDay - inDay);
export type StayPhase = "historica" | "futura" | "llegada_hoy" | "en_curso" | "salida_hoy";
export function stayPhase(inDay: number, outDay: number, today: number): StayPhase {
  if (outDay < today) return "historica";
  if (inDay > today) return "futura";
  if (inDay === today) return "llegada_hoy";
  if (outDay === today) return "salida_hoy";
  return "en_curso";
}
