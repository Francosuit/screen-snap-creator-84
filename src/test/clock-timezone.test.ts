import { describe, it, expect } from "vitest";
import { resolveTimeZone, hotelToday, hotelTime, isTimeZone } from "@/lib/suite/clock";

describe("hotel time zone", () => {
  it("missing or invalid zone falls back to Europe/Madrid", () => {
    expect(resolveTimeZone(null)).toBe("Europe/Madrid");
    expect(resolveTimeZone("Mars/Base")).toBe("Europe/Madrid");
    expect(resolveTimeZone("America/New_York")).toBe("America/New_York");
  });
  it("day changes at local midnight per zone", () => {
    const now = new Date("2026-11-12T23:30:00Z");
    expect(hotelToday("real", "Europe/Madrid", now).ymd).toBe("2026-11-13");
    expect(hotelToday("real", "America/New_York", now).ymd).toBe("2026-11-12");
    expect(hotelToday("real", "Europe/Madrid", now).offset).toBe(3);
  });
  it("rejects invalid configuration instead of silently saving Madrid", () => {
    expect(isTimeZone("Mars/Base")).toBe(false);
    expect(isTimeZone(" Europe/Madrid")).toBe(false);
    expect(isTimeZone("America/New_York")).toBe(true);
  });
  it("uses the correct local time across summer and winter clock changes", () => {
    expect(hotelTime("Europe/Madrid", new Date("2026-03-29T01:30:00Z"))).toBe("03:30");
    expect(hotelTime("Europe/Madrid", new Date("2026-10-25T01:30:00Z"))).toBe("02:30");
    expect(hotelTime("America/New_York", new Date("2026-03-08T06:59:00Z"))).toBe("01:59");
    expect(hotelTime("America/New_York", new Date("2026-03-08T07:00:00Z"))).toBe("03:00");
  });
  it("demo stays fixed on 10 Nov 2026", () => {
    expect(hotelToday("demo", "Asia/Tokyo", new Date("2027-01-01T00:00:00Z")).ymd).toBe("2026-11-10");
  });
});
