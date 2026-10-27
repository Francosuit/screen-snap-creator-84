import { describe, expect, it } from "vitest";
import { overlayHotel, type CloudConfig } from "@/lib/suite/cloud";
import type { Hotel, Room } from "@/lib/suite/data";

const hotel: Hotel = { id: "h1", name: "Local", address: "", city: "", category: "", rooms: 2, logo: "", status: "activo", owner: "a@x.com" };
const rooms: Room[] = [
  { number: "101", floor: 1, type: "Doble", hk: "dirty", oos: false, rate: 100 },
  { number: "102", floor: 1, type: "Doble", hk: "clean", oos: false, rate: 100 },
];
const cfg: CloudConfig = {
  hotels: [{ id: "u1", key: "h1", name: "Nube", address: "C/ 1", city: "Madrid", category: "4★", check_in: null, check_out: null, zones: ["Spa"], departments: [], archived: false, org_owner: "o" }],
  floors: [{ hotel_id: "u1", number: 1, name: "Planta 1" }],
  rooms: [{ hotel_id: "u1", number: "101", floor: 1, type: "Suite", rate: 250, capacity: 3, beds: null, bath: null, terrace: null, view: "Mar", sqm: null, notes: null, archived: false }],
};

describe("overlayHotel", () => {
  it("uses the stored room rate and type", () => {
    const r = overlayHotel(hotel, rooms, cfg).rooms[0]!;
    expect(r.rate).toBe(250); expect(r.type).toBe("Suite"); expect(r.capacity).toBe(3);
  });
  it("keeps the room's cleaning state", () => {
    expect(overlayHotel(hotel, rooms, cfg).rooms[0]!.hk).toBe("dirty");
  });
  it("keeps rooms without a stored record unchanged", () => {
    expect(overlayHotel(hotel, rooms, cfg).rooms[1]!.rate).toBe(100);
  });
  it("ignores another company's hotel key", () => {
    const other = { ...hotel, id: "h2" };
    expect(overlayHotel(other, rooms, cfg).hotel.name).toBe("Local");
  });
});
