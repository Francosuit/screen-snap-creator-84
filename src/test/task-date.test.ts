import { describe, it, expect } from "vitest";
import { taskDayLabel } from "@/lib/suite/task-date";

describe("taskDayLabel", () => {
  it("demo: day 0 is Hoy", () => expect(taskDayLabel(0, "demo")).toBe("Hoy"));
  it("demo: day 1 is Mañana", () => expect(taskDayLabel(1, "demo")).toBe("Mañana"));
  it("demo: day -1 is Ayer", () => expect(taskDayLabel(-1, "demo")).toBe("Ayer"));
  it("demo: other day is not Hoy", () => expect(taskDayLabel(5, "demo")).not.toBe("Hoy"));
  it("real: never claims Hoy or a date", () => expect(taskDayLabel(0, "real")).toBe("Fecha sin validar"));
  it("missing day is not Hoy", () => expect(taskDayLabel(undefined, "demo")).toBe("Fecha sin validar"));
});
