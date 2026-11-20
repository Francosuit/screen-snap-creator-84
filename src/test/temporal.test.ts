import { describe, expect, it } from "vitest";
import type { Reservation, Task } from "@/lib/suite/data";
import { convertTemporalData, reservationCalendar, syncReservationCalendar, validatedTaskDate, withReservationCalendar, withTaskCalendar } from "@/lib/suite/temporal";
import { offsetToYmd, ymdToOffset } from "@/lib/suite/clock";

const reservation = (overrides: Partial<Reservation> = {}): Reservation => ({
  id: "R-TEMP", guestId: "G-TEMP", room: "101", inDay: 0, outDay: 2, createdDay: -1,
  eta: "15:00", pax: 2, channel: "Recepción", amount: 240, status: "confirmed", stay: "none", notes: "sin tocar", ...overrides,
});
const task = (overrides: Partial<Task> = {}): Task => ({
  id: "T-TEMP", title: "PRUEBA TEMPORAL", room: "101", assignee: "", dept: "housekeeping", priority: "media",
  day: 0, deadline: "14:00", status: "pendiente", comments: "sin tocar", kind: "limpieza", ...overrides,
});

describe("núcleo temporal persistente y compatible", () => {
  it("conserva el significado exacto de la época existente", () => {
    expect(reservationCalendar(0, 2, -1)).toEqual({ checkInDate: "2026-11-10", checkOutDate: "2026-11-12", createdDate: "2026-11-09" });
    expect(reservationCalendar(6, 8, 6)).toEqual({ checkInDate: "2026-11-16", checkOutDate: "2026-11-18", createdDate: "2026-11-16" });
  });

  it("añade fechas sin borrar desplazamientos ni cambiar otros campos", () => {
    const before = reservation();
    const original = structuredClone(before);
    const converted = withReservationCalendar(before);
    expect(converted).toMatchObject({ inDay: 0, outDay: 2, createdDay: -1, checkInDate: "2026-11-10", checkOutDate: "2026-11-12", createdDate: "2026-11-09", notes: "sin tocar" });
    expect(before).toEqual(original);
    expect(converted).not.toBe(before);
  });

  it("convierte reservas y tareas juntas sin mutar los datos originales", () => {
    const before = { reservations: [reservation()], tasks: [task({ day: 6 })], untouched: true };
    const converted = convertTemporalData(before);
    expect(converted.reservations[0]?.checkInDate).toBe("2026-11-10");
    expect(converted.tasks[0]).toMatchObject({ day: 6, taskDate: "2026-11-16" });
    expect(before.reservations[0]?.checkInDate).toBeUndefined();
    expect(before.tasks[0]?.taskDate).toBeUndefined();
    expect(converted.untouched).toBe(true);
  });

  it("detiene la conversión si una fecha absoluta contradice el desplazamiento", () => {
    expect(() => withReservationCalendar(reservation({ checkInDate: "2026-11-11" }))).toThrow("no coincide");
    expect(() => withTaskCalendar(task({ taskDate: "2026-11-11" }))).toThrow("no coincide");
  });

  it("rechaza fechas inexistentes y desplazamientos incompletos", () => {
    expect(() => withReservationCalendar(reservation({ checkInDate: "2026-02-30" }))).toThrow();
    expect(() => withTaskCalendar(task({ day: 0.5 }))).toThrow("día de calendario");
  });

  it("rechaza estancias sin noches y conversiones directas inválidas", () => {
    expect(() => reservationCalendar(2, 2, 0)).toThrow("al menos 1 noche");
    expect(() => ymdToOffset("2026-02-30")).toThrow("Fecha de calendario inválida");
    expect(() => offsetToYmd(0.5)).toThrow("Desplazamiento de calendario inválido");
  });

  it("una modificación posterior mantiene sincronizadas ambas representaciones", () => {
    const converted = withReservationCalendar(reservation());
    const changed = syncReservationCalendar({ ...converted, outDay: 4 });
    expect(changed).toMatchObject({ outDay: 4, checkOutDate: "2026-11-14", checkInDate: "2026-11-10" });
  });

  it("no convierte implícitamente una reserva antigua durante otra operación", () => {
    const legacy = reservation({ outDay: 3 });
    expect(syncReservationCalendar(legacy)).toBe(legacy);
    expect(legacy.checkInDate).toBeUndefined();
  });

  it("solo valida para mostrar una fecha de tarea cuando ambas fuentes coinciden", () => {
    expect(validatedTaskDate(task({ day: 6, taskDate: "2026-11-16" }))).toBe("2026-11-16");
    expect(validatedTaskDate(task({ day: 6, taskDate: "2026-11-10" }))).toBeNull();
    expect(validatedTaskDate(task({ day: 6 }))).toBeNull();
  });
});
