import { describe, expect, it } from "vitest";
import { dragToStay, stayAmount, checkStayChange, type Reservation } from "@/lib/suite/data";
import { dayDate } from "@/lib/suite/store";

describe("calendar drag → stay (check-in included, check-out excluded)", () => {
  it("one cell = 1 night, check-out next day", () => expect(dragToStay(2, 2)).toEqual({ inDay: 2, outDay: 3, nights: 1 }));
  it("two cells = 2 nights", () => expect(dragToStay(2, 3)?.nights).toBe(2));
  it("three cells = 3 nights", () => expect(dragToStay(4, 6)).toEqual({ inDay: 4, outDay: 7, nights: 3 }));
  it("a week = 7 nights", () => expect(dragToStay(0, 6)?.nights).toBe(7));
  it("reverse drag gives the same stay", () => expect(dragToStay(6, 4)).toEqual(dragToStay(4, 6)));
  it("past days are cut off: dragging yesterday→tomorrow books today and tomorrow", () => expect(dragToStay(-1, 1)).toEqual({ inDay: 0, outDay: 2, nights: 2 }));
  it("a drag only over past days books nothing", () => expect(dragToStay(-3, -1)).toBeNull());
  it("month change: nights equal calendar days between dates", () => {
    // find the offset of the last day of the current month
    let d = 0; while (dayDate(d + 1).getDate() !== 1) d++;
    const st = dragToStay(d - 1, d + 1)!; // 2 days of this month + 1st of next
    expect(st.nights).toBe(3);
    expect(Math.round((dayDate(st.outDay).getTime() - dayDate(st.inDay).getTime()) / 864e5)).toBe(3);
  });
  it("amount = nightly rate × nights", () => expect(stayAmount(120, 3)).toBe(360));
});

const R = (id: string, inDay: number, outDay: number, extra: Partial<Reservation> = {}): Reservation => ({ id, guestId: "g", room: "101", inDay, outDay, eta: "", pax: 2, channel: "Recepción" as Reservation["channel"], amount: 120 * (outDay - inDay), status: "confirmed", stay: "none", notes: "", createdDay: 0, ...extra });
describe("moving check-out", () => {
  const list = [R("A", 0, 3), R("B", 3, 5)];
  it("same-day turnover is allowed (A leaves day 3, B arrives day 3)", () => expect(checkStayChange(list, "A", 3, 120)).toEqual({ amount: 360 }));
  it("blocks overlap with the next booking", () => expect(checkStayChange(list, "A", 4, 120)).toHaveProperty("error"));
  it("ignores a cancelled booking when checking overlap", () => {
    expect(checkStayChange([R("A", 0, 3), R("C", 3, 5, { status: "cancelled" as Reservation["status"] })], "A", 5, 120)).toEqual({ amount: 600 }));
  });
  it("finished stays cannot be changed", () => expect(checkStayChange([R("A", 0, 3, { stay: "finished" as Reservation["stay"] })], "A", 4, 120)).toHaveProperty("error"));
});
