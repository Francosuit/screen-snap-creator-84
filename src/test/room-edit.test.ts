import { describe, expect, it } from "vitest";
import { applyRoomEdit, futureReservations, validateRoomEdit, type Reservation, type Room } from "@/lib/suite/data";

const room: Room = { number: "101", floor: 1, type: "Doble", hk: "clean", oos: false, rate: 120 };

describe("room editing rules", () => {
  it("rejects a rate of 0", () => expect(validateRoomEdit({ type: "Doble", rate: 0 })).not.toBeNull());
  it("rejects capacity above 10", () => expect(validateRoomEdit({ type: "Doble", rate: 100, capacity: 11 })).not.toBeNull());
  it("rejects an empty type", () => expect(validateRoomEdit({ type: " ", rate: 100 })).not.toBeNull());
  it("accepts a valid edit", () => expect(validateRoomEdit({ type: "Suite", rate: 290, capacity: 3, sqm: 40 })).toBeNull());
  it("never changes number, floor or operational state", () => {
    const { room: next, changed } = applyRoomEdit(room, { type: "Suite", rate: 290 });
    expect(next.number).toBe("101"); expect(next.floor).toBe(1); expect(next.hk).toBe("clean"); expect(next.oos).toBe(false);
    expect(changed).toEqual(["tipo", "tarifa"]);
  });
  it("counts only upcoming confirmed reservations", () => {
    const r = (id: string, status: Reservation["status"], stay: Reservation["stay"]) => ({ id, room: "101", status, stay }) as Reservation;
    expect(futureReservations([r("a", "confirmed", "none"), r("b", "cancelled", "none"), r("c", "confirmed", "inhouse")], "101").map((x) => x.id)).toEqual(["a"]);
  });
});
