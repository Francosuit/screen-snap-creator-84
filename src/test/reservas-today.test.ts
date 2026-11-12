import { describe, it, expect } from "vitest";
import { fmtDay, dayDate } from "@/lib/suite/store";
import { hotelToday, offsetToYmd } from "@/lib/suite/clock";

describe("Reservas today labels", () => {
  it("demo keeps day 0 as Hoy", () => {
    expect(fmtDay(0)).toBe("Hoy");
    expect(hotelToday("demo", null, new Date("2026-11-12T10:00:00Z")).offset).toBe(0);
  });
  it("real hotel on 12 Nov 2026: day 2 is Hoy, day 0 is a past date", () => {
    const t = hotelToday("real", "Europe/Madrid", new Date("2026-11-12T10:00:00Z")).offset;
    expect(t).toBe(2);
    expect(fmtDay(2, t)).toBe("Hoy");
    expect(fmtDay(1, t)).toBe("Ayer");
    expect(fmtDay(3, t)).toBe("Mañana");
    expect(fmtDay(0, t)).not.toBe("Hoy");
  });
  it("stored days keep their absolute calendar date regardless of today", () => {
    expect(offsetToYmd(0)).toBe("2026-11-10");
    expect(dayDate(5).getDate()).toBe(15);
    expect(offsetToYmd(-3)).toBe("2026-11-07");
  });
});
