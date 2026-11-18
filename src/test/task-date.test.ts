import { describe, it, expect } from "vitest";
import { taskDayLabel } from "@/lib/suite/task-date";

describe("taskDayLabel", () => {
  it("demo: day 0 is Hoy", () => expect(taskDayLabel(0, "demo")).toBe("Hoy"));
  it("demo: day 1 is Mañana", () => expect(taskDayLabel(1, "demo")).toBe("Mañana"));
  it("demo: day -1 is Ayer", () => expect(taskDayLabel(-1, "demo")).toBe("Ayer"));
  it("demo: other day is not Hoy", () => expect(taskDayLabel(5, "demo")).not.toBe("Hoy"));
  it("real: never claims Hoy or a date without a validated absolute date", () => expect(taskDayLabel(0, "real")).toBe("Fecha sin validar"));
  it("real: a matching absolute date uses the shared hotel day", () => expect(taskDayLabel(8, "real", "2026-11-18", 8)).toBe("Hoy"));
  it("real: tomorrow keeps its calendar meaning", () => expect(taskDayLabel(9, "real", "2026-11-19", 8)).toBe("Mañana"));
  it("real: a contradictory absolute date stays unvalidated", () => expect(taskDayLabel(8, "real", "2026-11-10", 8)).toBe("Fecha sin validar"));
  it("missing day is not Hoy", () => expect(taskDayLabel(undefined, "demo")).toBe("Fecha sin validar"));
});
