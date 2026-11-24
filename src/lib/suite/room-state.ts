import type { Incident, Reservation, Room, RoomState } from "./data";

/** Single operational derivation shared by the store and digital views.
 * Without a hotel day, city overviews retain their occupied/ready summary.
 */
export function deriveRoomState(room: Room, reservations: Reservation[], incidents: Incident[], today?: number): RoomState {
  if (room.oos) return "oos";
  if (incidents.some((i) => i.room === room.number && i.blocking && i.status !== "resuelta")) return "maintenance";
  const current = reservations.find((r) => r.room === room.number && r.stay === "inhouse");
  if (current) return today !== undefined && current.outDay <= today ? "departure" : "occupied";
  if (room.hk === "cleaning") return "cleaning";
  if (room.hk === "dirty" || room.hk === "inspect") return "dirty";
  if (today !== undefined && reservations.some((r) => r.room === room.number && r.status === "confirmed" && r.stay === "none" && r.inDay === today)) return "arrival";
  return "ready";
}
