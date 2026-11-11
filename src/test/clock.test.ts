import { describe, it, expect } from "vitest";
import { hotelYmd, ymdToOffset, offsetToYmd, todayOffset, nightsOf, stayPhase } from "@/lib/suite/clock";

describe("reloj hotelero", () => {
  it("las reservas existentes conservan su fecha: offset 0 = 10 nov 2026", () => {
    expect(offsetToYmd(0)).toBe("2026-11-10");
    expect(offsetToYmd(2)).toBe("2026-11-12");
    expect(ymdToOffset("2026-11-10")).toBe(0);
    expect(offsetToYmd(-400)).toBe("2025-10-06");
    expect(ymdToOffset(offsetToYmd(-400))).toBe(-400);
  });
  it("modo demo queda fijo e independiente del reloj real", () => {
    expect(todayOffset("demo", "Asia/Tokyo", new Date("2030-01-01T12:00:00Z"))).toBe(0);
  });
  it("cuenta real usa la fecha real del hotel", () => {
    expect(todayOffset("real", "Europe/Madrid", new Date("2026-11-11T10:00:00Z"))).toBe(1);
  });
  it("medianoche cambia el día según la zona del hotel, no UTC", () => {
    const t = new Date("2026-11-11T23:30:00Z"); // 00:30 del 12 en Madrid
    expect(hotelYmd("Europe/Madrid", t)).toBe("2026-11-12");
    expect(hotelYmd("UTC", t)).toBe("2026-11-11");
    expect(hotelYmd("America/Argentina/Buenos_Aires", t)).toBe("2026-11-11");
    expect(todayOffset("real", "Europe/Madrid", new Date("2026-11-11T22:59:00Z"))).toBe(1);
    expect(todayOffset("real", "Europe/Madrid", new Date("2026-11-11T23:00:00Z"))).toBe(2);
  });
  it("cambio de horario de verano no altera los días", () => {
    expect(ymdToOffset("2027-03-29") - ymdToOffset("2027-03-27")).toBe(2);
  });
  it("noches: entrada incluida, salida excluida", () => {
    expect(nightsOf(0, 1)).toBe(1);
    expect(nightsOf(0, 2)).toBe(2);
    expect(nightsOf(3, 10)).toBe(7);
    expect(nightsOf(5, 5)).toBe(0);
  });
  it("fases: histórica, futura, check-in, en curso y checkout", () => {
    expect(stayPhase(-5, -2, 1)).toBe("historica");
    expect(stayPhase(4, 6, 1)).toBe("futura");
    expect(stayPhase(1, 3, 1)).toBe("llegada_hoy");
    expect(stayPhase(0, 3, 1)).toBe("en_curso");
    expect(stayPhase(-1, 1, 1)).toBe("salida_hoy");
  });
});
