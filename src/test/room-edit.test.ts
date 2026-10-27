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

import { bedsText, parseBeds, bedSleeps, validateRoomEdit as vre } from "@/lib/suite/data";
describe("bed configuration", () => {
  it("writes and reads a twin room with separate beds", () => {
    const t = bedsText({ individual: 2 });
    expect(t).toBe("2 individuales"); expect(parseBeds(t)).toEqual({ individual: 2 });
  });
  it("a triple with 1 double + 1 single sleeps 3", () => {
    expect(bedSleeps(parseBeds("1 doble + 1 individual"))).toBe(3);
  });
  it("cribs do not count as guests", () => { expect(bedSleeps({ cuna: 1, doble: 1 })).toBe(2); });
  it("rejects capacity larger than the beds", () => {
    expect(vre({ type: "Triple", rate: 100, capacity: 3, beds: "1 doble" })).toMatch(/no alcanzan/);
  });
});

import { checkStayChange } from "@/lib/suite/data";
import type { Reservation } from "@/lib/suite/data";
const R = (id: string, room: string, inDay: number, outDay: number): Reservation => ({ id, guestId: "g", room, inDay, outDay, eta: "", pax: 2, channel: "Recepción" as Reservation["channel"], amount: 100 * (outDay - inDay), status: "confirmed", stay: "none", notes: "", createdDay: 0 });
describe("stay change", () => {
  const list = [R("A", "101", 0, 2), R("B", "101", 4, 6)];
  it("extending 2 → 4 nights at 100 €/night costs 400 €", () => { expect(checkStayChange(list, "A", 4, 100)).toEqual({ amount: 400 }); });
  it("blocks extending into the next booking", () => { expect(checkStayChange(list, "A", 5, 100)).toHaveProperty("error"); });
  it("shortening to 1 night costs 100 €", () => { expect(checkStayChange(list, "A", 1, 100)).toEqual({ amount: 100 }); });
  it("cannot shorten to 0 nights", () => { expect(checkStayChange(list, "A", 0, 100)).toHaveProperty("error"); });
});
