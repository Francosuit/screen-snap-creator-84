import type { Reservation, Room } from "./data";

/** One persisted event in a reservation's own history. */
export interface ResEvent { at: string; day: number; actor: string; text: string }

/** Active reservations block a room; cancelled, no-show and finished ones never do. */
export const blocksRoom = (r: Reservation) => r.status === "confirmed" && r.stay !== "finished";

export function canCancel(r: Reservation): boolean { return r.status === "confirmed" && r.stay === "none"; }
/** No-show only once the arrival day has come and the guest never checked in. */
export function canNoShow(r: Reservation, today: number): boolean { return canCancel(r) && r.inDay <= today; }

/** Rooms free for the whole range [inDay, outDay), optionally ignoring one reservation. */
export function availableRooms(list: Reservation[], rooms: Room[], inDay: number, outDay: number, ignoreId?: string): Room[] {
  if (!Number.isInteger(inDay) || !Number.isInteger(outDay) || outDay <= inDay) return [];
  return rooms.filter((rm) => !rm.oos && !list.some((x) => x.id !== ignoreId && x.room === rm.number && blocksRoom(x) && x.inDay < outDay && inDay < x.outDay));
}

export interface ResEdit { room: string; inDay: number; outDay: number; pax: number; notes: string }

/** Validates a full reservation edit. In-house stays keep their arrival; a room change then means a move from today. */
export function checkReservationEdit(list: Reservation[], rooms: Room[], id: string, e: ResEdit, today: number): { amount: number; moved: boolean } | { error: string } {
  const r = list.find((x) => x.id === id);
  if (!r) return { error: "Reserva no encontrada" };
  if (!blocksRoom(r)) return { error: "Esta reserva ya no se puede modificar" };
  if (![e.inDay, e.outDay, e.pax].every(Number.isInteger) || e.pax < 1) return { error: "Revisa fechas y número de huéspedes" };
  if (r.stay === "inhouse" && e.inDay !== r.inDay) return { error: "La entrada de una estancia en curso no se puede cambiar" };
  if (r.stay === "none" && e.inDay < today) return { error: "La entrada no puede ser anterior a hoy" };
  if (e.outDay <= e.inDay) return { error: "La estancia debe tener al menos 1 noche" };
  if (e.outDay < today || (r.stay === "inhouse" && e.outDay <= today && e.room !== r.room)) return { error: "La salida no puede ser anterior a hoy" };
  const room = rooms.find((x) => x.number === e.room);
  if (!room || room.oos) return { error: "Habitación no disponible" };
  if (room.capacity && e.pax > room.capacity) return { error: `La habitación ${room.number} admite ${room.capacity} personas` };
  const moved = e.room !== r.room;
  // A move mid-stay only needs the new room from today on.
  const from = r.stay === "inhouse" && moved ? today : e.inDay;
  const clash = list.find((x) => x.id !== id && x.room === e.room && blocksRoom(x) && x.inDay < e.outDay && from < x.outDay);
  if (clash) return { error: `Habitación ${e.room} ocupada: choca con ${clash.id}` };
  const nights = e.outDay - e.inDay;
  const nightly = moved ? room.rate : Math.round(r.amount / Math.max(1, r.outDay - r.inDay));
  return { amount: nightly * nights, moved };
}

export const withEvent = (r: Reservation, ev: ResEvent): Reservation => ({ ...r, history: [...(r.history ?? []), ev] });
