// Hotel calendar clock. Stored day offsets (inDay/outDay/day) are absolute:
// offset 0 = 10 Nov 2026 (the date the UI showed as "Hoy" when every existing
// row was written). Real hotels read "today" from the real clock in their own
// time zone; the demo keeps its fixed clock. Pure calendar-day arithmetic in UTC
// so a time zone never moves a reservation to another day.
export const EPOCH_YMD = "2026-11-10";
export const DEFAULT_TZ = "Europe/Madrid";
const DAY = 86_400_000;
const utcOf = (ymd: string) => { const [y = 0, m = 1, d = 1] = ymd.split("-").map(Number); return Date.UTC(y, m - 1, d); };

/** Strict YYYY-MM-DD validation: impossible or normalized dates are rejected. */
export function isCalendarDate(ymd: unknown): ymd is string {
  if (typeof ymd !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  return new Date(utcOf(ymd)).toISOString().slice(0, 10) === ymd;
}

function assertCalendarDate(ymd: string): void {
  if (!isCalendarDate(ymd)) throw new Error(`Fecha de calendario inválida: ${ymd}`);
}

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
/** Strict validation for configuration writes; legacy reads still use the safe fallback below. */
export function isTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.trim() !== tz) return false;
  try { new Intl.DateTimeFormat("en-CA", { timeZone: tz }); return true; } catch { return false; }
}
/** Hotel time zone: stored IANA zone if valid, else the default. Never throws. */
export function resolveTimeZone(tz?: string | null): string {
  return isTimeZone(tz) ? tz : DEFAULT_TZ;
}
/** Minutes and HH:mm at the same instant and hotel zone; no browser-zone conversion. */
export function hotelMinutes(tz: string, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: resolveTimeZone(tz), hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}
export const hotelTime = (tz: string, now: Date = new Date()) => {
  const minutes = hotelMinutes(tz, now);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};
/** Full IANA catalog where available, with a portable fallback for older runtimes. */
export function timeZoneOptions(): string[] {
  try { return Intl.supportedValuesOf("timeZone"); }
  catch { return [DEFAULT_TZ, "UTC", "America/New_York", "America/Argentina/Buenos_Aires", "America/Mexico_City", "Asia/Tokyo", "Australia/Sydney"]; }
}
/** Single entry point for "today" of a hotel (offset + calendar date). */
export function hotelToday(mode: "demo" | "real", tz?: string | null, now: Date = new Date()) {
  const zone = resolveTimeZone(tz);
  const offset = todayOffset(mode, zone, now);
  return { zone, offset, ymd: offsetToYmd(offset) };
}
