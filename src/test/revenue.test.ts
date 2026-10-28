import { describe, expect, it } from "vitest";
import type { Reservation } from "@/lib/suite/data";
import { avgNightly, deviation, forecastYear, monthlyAdr, monthlyRevenue, nights, splitBudget, yoy } from "@/lib/suite/revenue";

const base = new Date(2026, 9, 28);
const toDate = (off: number) => new Date(2026, 9, 28 + off);
const r = (id: string, inDay: number, outDay: number, amount: number, status: Reservation["status"] = "confirmed"): Reservation =>
  ({ id, guestId: "g", room: "101", inDay, outDay, eta: "", pax: 1, channel: "Recepción", amount, status, stay: "none", notes: "", createdDay: 0 });

describe("revenue rules", () => {
  it("excludes cancelled and no-show reservations", () => {
    const ns = nights([r("a", 0, 2, 200), r("b", 0, 2, 999, "cancelled"), r("c", 0, 1, 50, "noshow")], toDate);
    expect(ns.reduce((s, n) => s + n.amount, 0)).toBe(200);
  });
  it("splits a stay crossing months by night", () => {
    const ns = nights([r("a", 3, 6, 300)], toDate); // 31 Oct, 1 Nov, 2 Nov
    const m = monthlyRevenue(ns, 2026);
    expect(m[9]).toBe(100);
    expect(m[10]).toBe(200);
  });
  it("reports months without stored data as unavailable, not zero", () => {
    const m = monthlyRevenue(nights([r("a", 0, 1, 100)], toDate), 2026);
    expect(m[0]).toBeNull();
    expect(monthlyAdr(nights([r("a", 0, 1, 100)], toDate), 2025)[9]).toBeNull();
  });
  it("ADR is revenue per room night", () => {
    expect(avgNightly(r("a", 0, 4, 480))).toBe(120);
    expect(monthlyAdr(nights([r("a", 0, 2, 200), r("b", 0, 1, 160)], toDate), 2026)[9]).toBe(120);
  });
  it("YoY has no previous value without last-year data", () => {
    const y = yoy(nights([r("a", 0, 1, 100)], toDate), "ytd", 2026, base);
    expect(y.previous).toBeNull();
    expect(y.current).toBe(100);
  });
  it("YoY compares equivalent periods", () => {
    const ns = nights([r("a", 0, 1, 150), r("b", -365, -364, 100)], toDate);
    const y = yoy(ns, "mes", 2026, base);
    expect(y).toEqual({ current: 150, previous: 100, diff: 50, pct: 50 });
  });
  it("forecast = accrued + on the books", () => {
    const f = forecastYear(nights([r("a", -1, 1, 200), r("b", 5, 6, 90)], toDate), 2026, base);
    expect(f).toEqual({ actual: 200, otb: 90, total: 290 });
  });
  it("deviation and budget split", () => {
    expect(deviation(1000, 900)).toEqual({ diff: -100, pct: -10 });
    const s = splitBudget(1000);
    expect(s.reduce((a, b) => a + b, 0)).toBeCloseTo(1000, 2);
  });
});
