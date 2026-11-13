import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { ReservationSheet } from "@/components/suite/panels";
import { SuiteCtx } from "@/lib/suite/context";
import { dayDate } from "@/lib/suite/store";
import type { Reservation } from "@/lib/suite/data";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

const guest = { id: "g1", name: "Huésped Aislado", doc: "DOC", phone: "+34 600000000", email: "guest@example.test", lang: "Español", country: "ES", companions: [], notes: "", messaging: true };
const reservation = (inDay: number, outDay: number): Reservation => ({
  id: "r1", guestId: guest.id, room: "101", inDay, outDay, eta: "—", pax: 2,
  channel: "Recepción", amount: (outDay - inDay) * 120, status: "confirmed", stay: "none", notes: "", createdDay: -10,
});
const absolute = (offset: number) => dayDate(offset).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
const rowValue = (label: string) => screen.getByText(label, { selector: "span.text-muted-foreground" }).parentElement?.lastElementChild?.textContent ?? "";

function renderSheet(r: Reservation, mode: "demo" | "real" = "real", timezone = "Europe/Madrid") {
  const value = {
    s: { role: "housekeeping", reservations: [r], rooms: [{ number: "101", type: "Doble" }], log: [] },
    guest: () => guest,
    roomState: () => "ready",
    isDemo: mode === "demo",
    hotel: { timezone },
  };
  return render(<SuiteCtx.Provider value={value}><ReservationSheet resId={r.id} onClose={() => {}} /></SuiteCtx.Provider>);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-12T10:00:00Z")); // Madrid: offset 2
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Sprint 02 — reloj de la ficha de reserva", () => {
  it("mantiene las fechas absolutas de una reserva pasada", () => {
    renderSheet(reservation(-2, -1));
    expect(rowValue("Entrada")).toBe(absolute(-2));
    expect(rowValue("Salida")).toBe(`${absolute(-1)} · 11:00`);
  });

  it("marca una entrada de hoy según el hotel real", () => {
    renderSheet({ ...reservation(2, 4), eta: "15:00" });
    expect(rowValue("Entrada")).toBe("Hoy · 15:00");
    expect(rowValue("Salida")).toBe(`${absolute(4)} · 11:00`);
  });

  it("marca una salida de hoy sin cambiar la entrada", () => {
    renderSheet(reservation(1, 2));
    expect(rowValue("Entrada")).toBe("Ayer");
    expect(rowValue("Salida")).toBe("Hoy · 11:00");
  });

  it("marca una reserva futura respecto al hoy del hotel", () => {
    renderSheet(reservation(3, 5));
    expect(rowValue("Entrada")).toBe("Mañana");
    expect(rowValue("Salida")).toBe(`${absolute(5)} · 11:00`);
  });

  it("usa el mismo hoy en cabecera y desglose de una estancia de varias noches", () => {
    renderSheet(reservation(2, 5));
    expect(screen.getByText(/Habitación 101 ·/)).toHaveTextContent(`Habitación 101 · Hoy → ${absolute(5)}`);
    expect(rowValue("Noches")).toBe("3");
    expect(rowValue("Desglose por noche")).toContain(`Hoy: 120 € · Mañana: 120 € · ${absolute(4)}: 120 €`);
  });

  it("conserva el 10/11/2026 como hoy fijo de demostración", () => {
    vi.setSystemTime(new Date("2026-11-13T10:00:00Z"));
    renderSheet(reservation(0, 2), "demo", "America/New_York");
    expect(rowValue("Entrada")).toBe("Hoy");
    expect(rowValue("Salida")).toBe(`${absolute(2)} · 11:00`);
  });

  it("aplica la zona horaria guardada del hotel", () => {
    vi.setSystemTime(new Date("2026-11-12T23:30:00Z"));
    const first = renderSheet(reservation(2, 4), "real", "America/New_York");
    expect(rowValue("Entrada")).toBe("Hoy");
    first.unmount();
    renderSheet(reservation(2, 4), "real", "Europe/Madrid");
    expect(rowValue("Entrada")).toBe("Ayer");
  });

  it("recupera las mismas fechas tras recargar sin modificar la reserva", () => {
    const stored = reservation(2, 5);
    const before = structuredClone(stored);
    const first = renderSheet(stored);
    expect(rowValue("Entrada")).toBe("Hoy");
    first.unmount();
    renderSheet(stored);
    expect(rowValue("Entrada")).toBe("Hoy");
    expect(rowValue("Salida")).toBe(`${absolute(5)} · 11:00`);
    expect(stored).toEqual(before);
  });
});
