import { describe, it, expect } from "vitest";
import { resolveTimeZone, hotelToday } from "@/lib/suite/clock";

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
  it("demo stays fixed on 10 Nov 2026", () => {
    expect(hotelToday("demo", "Asia/Tokyo", new Date("2027-01-01T00:00:00Z")).ymd).toBe("2026-11-10");
  });
});
