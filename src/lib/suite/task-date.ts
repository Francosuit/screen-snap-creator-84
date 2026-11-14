import { fmtDay } from "./store";

/**
 * Date label for a task row. Demo tasks keep their demo-relative label.
 * Real tasks still store a day offset whose meaning is not validated (pending date migration),
 * so no calendar date is claimed for them.
 */
export function taskDayLabel(day: number | undefined, mode: "demo" | "real"): string {
  if (mode === "real" || typeof day !== "number" || !Number.isFinite(day)) return "Fecha sin validar";
  return fmtDay(day, 0);
}
