import { fmtDay } from "./store";
import { validatedTaskDate } from "./temporal";

/**
 * Demo tasks keep their fixed demo-relative label. Real tasks get a calendar
 * label only when their stored absolute date agrees with the legacy offset.
 */
export function taskDayLabel(day: number | undefined, mode: "demo" | "real", taskDate?: string, today = 0): string {
  if (typeof day !== "number" || !Number.isInteger(day)) return "Fecha sin validar";
  if (mode === "demo") return fmtDay(day, 0);
  const validated = validatedTaskDate(taskDate === undefined ? { day } : { day, taskDate });
  return validated ? fmtDay(day, today) : "Fecha sin validar";
}
