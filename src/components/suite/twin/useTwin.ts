import { useCallback, useMemo } from "react";
import type { Room } from "@/lib/suite/data";
import { useSuite } from "@/lib/suite/store";
import { floorsOf, layoutHotel, roomMeta } from "./geometry";
import type { RoomInfo } from "./IsoBuilding";

/** Binds the twin to the live store: layout from hotel config, visuals from room state */
export function useTwin() {
  const { s, hotel, roomState, occupant, guest } = useSuite();
  const layout = useMemo(() => layoutHotel(hotel, s.rooms), [hotel, s.rooms]);
  const floors = useMemo(() => floorsOf(hotel, s.rooms), [hotel, s.rooms]);
  const info = useCallback((r: Room): RoomInfo => {
    const occ = occupant(r.number);
    return { state: roomState(r.number), guest: occ ? guest(occ.guestId)?.name : undefined, type: r.type, capacity: roomMeta(r).capacity };
  }, [roomState, occupant, guest]);
  return { layout, floors, info };
}
