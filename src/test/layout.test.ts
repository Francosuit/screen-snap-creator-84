import { describe, expect, it } from "vitest";
import { autoLayout, clampItem, isInside, moveItem, rotateItem, ROOM_W, roomLayout } from "@/lib/suite/layout";
import { applyRoomEdit, type Room } from "@/lib/suite/data";

const room: Room = { number: "304", floor: 3, type: "Doble Superior", rate: 150, hk: "clean", oos: false };

describe("room furniture layout", () => {
  it("an unconfigured room starts empty instead of using category defaults", () => {
    expect(autoLayout(room)).toEqual([]);
  });
  it("automatic layout only contains configured beds, bath and desk", () => {
    const kinds = autoLayout({ ...room, beds: "2 individuales", bath: "Ducha", extras: ["Escritorio"] }).map((i) => i.kind).sort();
    expect(kinds).toEqual(["bano", "escritorio", "individual", "individual"]);
  });
  it("furniture cannot be moved outside the room", () => {
    const it0 = { id: "armario-1", kind: "armario" as const, x: ROOM_W - 1, y: 0, rot: 0 as const };
    const moved = moveItem(it0, 5, -5);
    expect(moved.x).toBe(5); expect(moved.y).toBe(0); expect(isInside(moved)).toBe(true);
  });
  it("rotating swaps footprint and stays inside", () => {
    const r = rotateItem(clampItem({ id: "e", kind: "escritorio", x: 5, y: 4, rot: 0 }));
    expect(r.rot).toBe(90); expect(isInside(r)).toBe(true);
  });
  it("saved layout belongs to that room only and wins over the automatic one", () => {
    const layout = [{ id: "silla-1", kind: "silla" as const, x: 1, y: 1, rot: 0 as const }];
    const { room: next, changed } = applyRoomEdit(room, { type: room.type, rate: room.rate, layout });
    expect(roomLayout(next)).toEqual(layout); expect(changed).toContain("distribución");
    expect(room.layout).toBeUndefined();
  });
});

import { screenToFloor, placeItem, duplicateItem } from "@/lib/suite/layout";
describe("editor fase 1", () => {
  it("arrastrar en pantalla se convierte en desplazamiento real del suelo", () => {
    const U = 26; const { dx, dy } = screenToFloor(0.866 * U, 0.5 * U, U); // proj(1,0)
    expect(dx).toBeCloseTo(1); expect(dy).toBeCloseTo(0);
  });
  it("arrastrar fuera nunca saca el mueble de la habitación", () => {
    const it0 = { id: "silla-1", kind: "silla" as const, x: 1, y: 1, rot: 0 as const };
    const p = placeItem(it0, 99, -99);
    expect(p.y).toBe(0); expect(p.x).toBeLessThanOrEqual(6);
  });
  it("duplicar crea un id nuevo", () => {
    const a = { id: "silla-1", kind: "silla" as const, x: 1, y: 1, rot: 0 as const };
    expect(duplicateItem(a, [a]).id).toBe("silla-2");
  });
});
