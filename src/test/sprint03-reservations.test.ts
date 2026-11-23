import { describe, expect, it } from "vitest";
import { availableRooms, canCancel, canNoShow, checkReservationEdit, withEvent } from "@/lib/suite/reservations";
import type { Reservation, Room } from "@/lib/suite/data";

const room = (number: string, rate = 100, extra: Partial<Room> = {}) => ({ number, type: "Doble", rate, floor: 1, hk: "clean", oos: false, capacity: 2, ...extra }) as unknown as Room;
const res = (id: string, roomNo: string, inDay: number, outDay: number, extra: Partial<Reservation> = {}): Reservation => ({ id, guestId: "g", room: roomNo, inDay, outDay, eta: "—", pax: 2, channel: "Recepción", amount: 100 * (outDay - inDay), status: "confirmed", stay: "none", notes: "", createdDay: 0, ...extra });
const rooms = [room("101"), room("102", 150), room("103", 100, { oos: true })];

describe("Sprint 03 reservation rules", () => {
  it("cancelled reservation frees its room for the same dates", () => {
    const list = [res("A", "101", 2, 4)];
    expect(availableRooms(list, rooms, 2, 4).map((r) => r.number)).toEqual(["102"]);
    expect(availableRooms([{ ...list[0]!, status: "cancelled" }], rooms, 2, 4).map((r) => r.number)).toEqual(["101", "102"]);
  });
  it("no-show frees the room and needs arrival day reached", () => {
    const r = res("A", "101", 2, 4);
    expect(canNoShow(r, 1)).toBe(false);
    expect(canNoShow(r, 2)).toBe(true);
    expect(availableRooms([{ ...r, status: "noshow" }], rooms, 2, 4)).toHaveLength(2);
  });
  it("in-house stays cannot be cancelled", () => {
    expect(canCancel(res("A", "101", 0, 2, { stay: "inhouse" }))).toBe(false);
  });
  it("edit rejects overlapping room and recalculates amount", () => {
    const list = [res("A", "101", 2, 4), res("B", "102", 3, 5)];
    expect(checkReservationEdit(list, rooms, "A", { room: "102", inDay: 2, outDay: 4, pax: 2, notes: "" }, 0)).toEqual({ error: "Habitación 102 ocupada: choca con B" });
    expect(checkReservationEdit(list, rooms, "A", { room: "101", inDay: 2, outDay: 5, pax: 2, notes: "" }, 0)).toEqual({ amount: 300, moved: false });
  });
  it("edit rejects past arrival, out-of-service room and over capacity", () => {
    const list = [res("A", "101", 2, 4)];
    expect("error" in checkReservationEdit(list, rooms, "A", { room: "101", inDay: 0, outDay: 3, pax: 2, notes: "" }, 1)).toBe(true);
    expect(checkReservationEdit(list, rooms, "A", { room: "103", inDay: 2, outDay: 4, pax: 2, notes: "" }, 0)).toEqual({ error: "Habitación no disponible" });
    expect(checkReservationEdit(list, rooms, "A", { room: "101", inDay: 2, outDay: 4, pax: 3, notes: "" }, 0)).toEqual({ error: "La habitación 101 admite 2 personas" });
  });
  it("mid-stay move only needs the new room from today and uses its rate", () => {
    const list = [res("A", "101", 0, 4, { stay: "inhouse" }), res("B", "102", -3, 2, { stay: "finished" })];
    expect(checkReservationEdit(list, rooms, "A", { room: "102", inDay: 0, outDay: 4, pax: 2, notes: "" }, 2)).toEqual({ amount: 600, moved: true });
    expect("error" in checkReservationEdit(list, rooms, "A", { room: "101", inDay: 1, outDay: 4, pax: 2, notes: "" }, 2)).toBe(true);
  });
  it("history keeps prior events", () => {
    const r = withEvent(withEvent(res("A", "101", 0, 1), { at: "10:00", day: 0, actor: "x", text: "creada" }), { at: "11:00", day: 0, actor: "x", text: "cancelada" });
    expect(r.history?.map((e) => e.text)).toEqual(["creada", "cancelada"]);
  });
});
