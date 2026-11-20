import { describe, expect, it } from "vitest";
import { buildForecast } from "@/routes/control";
import { offsetToYmd } from "@/lib/suite/clock";

const ymd = offsetToYmd;

describe("Control — calendario conectado al día del hotel", () => {
  it("mantiene la demo del 10 al 30 de noviembre", () => {
    const forecast = buildForecast(0);
    expect(ymd(0)).toBe("2026-11-10");
    expect(forecast).toHaveLength(21);
    expect(forecast[0]?.d).toBe(10);
    expect(forecast[20]?.d).toBe(30);
  });

  it("usa el día real y conserva 21 días al cruzar de mes", () => {
    const forecast = buildForecast(10); // 20/11/2026
    expect(ymd(10)).toBe("2026-11-20");
    expect(ymd(30)).toBe("2026-12-10");
    expect(forecast[0]?.d).toBe(20);
    expect(forecast[20]?.d).toBe(10);
    expect(forecast.map((day) => day.off)).toEqual(Array.from({ length: 21 }, (_, i) => i));
  });
});
