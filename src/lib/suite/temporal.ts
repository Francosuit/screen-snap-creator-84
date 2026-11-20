import type { Reservation, Task } from "./data";
import { isCalendarDate, offsetToYmd, ymdToOffset } from "./clock";

export type ReservationCalendar = Pick<Reservation, "checkInDate" | "checkOutDate" | "createdDate">;

function assertOffset(value: number, field: string): void {
  if (!Number.isInteger(value)) throw new Error(`${field} debe ser un día de calendario válido`);
}

/** Builds the absolute representation without discarding the legacy offsets. */
export function reservationCalendar(inDay: number, outDay: number, createdDay: number): Required<ReservationCalendar> {
  assertOffset(inDay, "inDay");
  assertOffset(outDay, "outDay");
  assertOffset(createdDay, "createdDay");
  if (outDay <= inDay) throw new Error("La estancia debe tener al menos 1 noche");
  return {
    checkInDate: offsetToYmd(inDay),
    checkOutDate: offsetToYmd(outDay),
    createdDate: offsetToYmd(createdDay),
  };
}

/**
 * Adds or verifies absolute dates. Existing absolute values are never overwritten:
 * a disagreement between the two representations stops the conversion.
 */
export function withReservationCalendar<T extends Reservation>(reservation: T): T {
  const expected = reservationCalendar(reservation.inDay, reservation.outDay, reservation.createdDay);
  for (const key of Object.keys(expected) as (keyof ReservationCalendar)[]) {
    const stored = reservation[key];
    if (stored !== undefined && stored !== expected[key]) {
      throw new Error(`La fecha ${key} no coincide con el desplazamiento guardado en ${reservation.id}`);
    }
    if (stored !== undefined && !isCalendarDate(stored)) throw new Error(`Fecha absoluta inválida en ${reservation.id}`);
  }
  return { ...reservation, ...expected };
}

/** Updates both representations only after migration/new creation; legacy rows stay untouched. */
export function syncReservationCalendar<T extends Reservation>(reservation: T): T {
  if (reservation.checkInDate === undefined && reservation.checkOutDate === undefined && reservation.createdDate === undefined) return reservation;
  // Offsets were just edited legitimately: recompute absolute dates from them.
  return { ...reservation, ...reservationCalendar(reservation.inDay, reservation.outDay, reservation.createdDay) };
}

export function withTaskCalendar<T extends Task>(task: T): T {
  assertOffset(task.day, "day");
  const expected = offsetToYmd(task.day);
  if (task.taskDate !== undefined && task.taskDate !== expected) {
    throw new Error(`La fecha de la tarea ${task.id} no coincide con su desplazamiento`);
  }
  if (task.taskDate !== undefined && !isCalendarDate(task.taskDate)) throw new Error(`Fecha absoluta inválida en ${task.id}`);
  return { ...task, taskDate: expected };
}

/** Conversion used by the rehearsed migration; input data is never mutated. */
export function convertTemporalData<T extends { reservations: Reservation[]; tasks: Task[] }>(data: T): T {
  return {
    ...data,
    reservations: data.reservations.map(withReservationCalendar),
    tasks: data.tasks.map(withTaskCalendar),
  };
}

/** A persisted absolute date is trusted for labels only when it agrees with its legacy offset. */
export function validatedTaskDate(task: Pick<Task, "day" | "taskDate">): string | null {
  if (!isCalendarDate(task.taskDate) || !Number.isInteger(task.day)) return null;
  return ymdToOffset(task.taskDate) === task.day ? task.taskDate : null;
}
