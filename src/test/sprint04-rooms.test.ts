import { describe, expect, it } from "vitest";
import { deriveRoomState } from "@/lib/suite/room-state";
import { floorsOf } from "@/components/suite/twin/geometry";
import type { Hotel, Reservation, Room } from "@/lib/suite/data";

const room: Room = { number: "401", floor: 4, type: "Doble", rate: 120, hk: "clean", oos: false };
const reservation = (extra: Partial<Reservation>): Reservation => ({ id: "R-S04", guestId: "G-S04", room: "401", inDay: 14, outDay: 16, eta: "15:00", pax: 2, channel: "Recepción", amount: 240, status: "confirmed", stay: "none", notes: "", createdDay: 14, ...extra });

describe("Sprint 04 operational rooms", () => {
  it("a clean room with a confirmed arrival today is an arrival", () => {
    expect(deriveRoomState(room, [reservation({})], [], 14)).toBe("arrival");
  });
  it("an in-house room due out today is a departure", () => {
    expect(deriveRoomState(room, [reservation({ stay: "inhouse", outDay: 14 })], [], 14)).toBe("departure");
    expect(deriveRoomState(room, [reservation({ stay: "inhouse", outDay: 16 })], [], 14)).toBe("occupied");
  });
  it("cleaning and blocking incidents keep operational priority over arrival", () => {
    expect(deriveRoomState({ ...room, hk: "dirty" }, [reservation({})], [], 14)).toBe("dirty");
    expect(deriveRoomState(room, [reservation({})], [{ room: "401", blocking: true, status: "abierta" } as never], 14)).toBe("maintenance");
  });
  it("custom floors are retained even when a floor has no rooms", () => {
    const hotel: Hotel = { id: "test", name: "Test", address: "", city: "", category: "", rooms: 1, logo: "T", status: "activo", floors: [{ number: 1, name: "Baja" }, { number: 4, name: "Ático" }] };
    expect(floorsOf(hotel, [{ ...room, floor: 1 }]).map((f) => f.number)).toEqual([1, 4]);
  });
});
