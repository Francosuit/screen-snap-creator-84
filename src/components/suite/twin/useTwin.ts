import { useCallback, useMemo } from "react";
import type { Incident, Room } from "@/lib/suite/data";
import { useSuite } from "@/lib/suite/store";
import { floorsOf, layoutHotel, roomMeta } from "./geometry";
import type { RoomInfo, StaffMarker } from "./IsoBuilding";

/** Where a technician is, derived purely from incident state */
export function techPhase(i: Incident): "base" | "route" | "onsite" | "done" {
  if (i.status === "resuelta") return "done";
  if (i.status === "abierta") return "base";
  return i.arrivedAt ? "onsite" : "route";
}

/** Binds the twin to the live store: layout from hotel config, visuals from room state */
export function useTwin() {
  const { s, hotel, roomState, occupant, guest } = useSuite();
  const layout = useMemo(() => layoutHotel(hotel, s.rooms), [hotel, s.rooms]);
  const floors = useMemo(() => floorsOf(hotel, s.rooms), [hotel, s.rooms]);
  const info = useCallback((r: Room): RoomInfo => {
    const occ = occupant(r.number);
    return { state: roomState(r.number), guest: occ ? guest(occ.guestId)?.name : undefined, type: r.type, capacity: roomMeta(r).capacity };
  }, [roomState, occupant, guest]);
  const staff = useMemo<StaffMarker[]>(() => s.incidents.flatMap((i) => {
    const ph = techPhase(i);
    return ph === "route" || ph === "onsite" ? [{ id: i.id, name: i.assignee, room: i.room, phase: ph }] : [];
  }), [s.incidents]);
  return { layout, floors, info, staff };
}
