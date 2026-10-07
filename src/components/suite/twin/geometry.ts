// Digital twin geometry: turns hotel + room configuration into isometric shapes.
// Pure functions only — the twin never owns state; it renders the store's rooms.
import type { Floor, Hotel, Room, RoomState } from "@/lib/suite/data";

export const RW = 2.4; // room width along corridor
export const RD = 2.3; // room depth
export const COR = 1.3; // corridor depth
export const CORE = 2.4; // lifts + stairs
export const COMMON = 3.2; // common area / office
export const ROOM_H = 1.15;
export const SLAB = 0.22;
export const FLOOR_GAP = 2.2;

export type Rect = { x: number; y: number; w: number; d: number };
export type Pt = [number, number];

export interface RoomMeta { capacity: number; beds: string; bath: string; terrace: boolean; view: string; sqm: number; price: number }

const META_BY_TYPE: Record<string, Omit<RoomMeta, "price">> = {
  Individual: { capacity: 1, beds: "1 individual", bath: "Ducha", terrace: false, view: "Interior", sqm: 16 },
  "Doble Estándar": { capacity: 2, beds: "1 doble", bath: "Ducha", terrace: false, view: "Ciudad", sqm: 22 },
  "Doble Superior": { capacity: 2, beds: "1 king", bath: "Ducha", terrace: true, view: "Ciudad", sqm: 26 },
  "Junior Suite": { capacity: 3, beds: "1 king + sofá cama", bath: "Bañera", terrace: true, view: "Jardín", sqm: 34 },
  Suite: { capacity: 4, beds: "1 king + 2 individuales", bath: "Bañera + ducha", terrace: true, view: "Panorámica", sqm: 48 },
};
export const ROOM_TYPES = Object.keys(META_BY_TYPE);

export function roomMeta(r: Room): RoomMeta {
  const d = META_BY_TYPE[r.type] ?? META_BY_TYPE["Doble Estándar"]!;
  return {
    capacity: r.capacity ?? d.capacity, beds: r.beds ?? d.beds, bath: r.bath ?? d.bath,
    terrace: r.terrace ?? d.terrace, view: r.view ?? d.view, sqm: r.sqm ?? d.sqm, price: r.rate,
  };
}
export const defaultsForType = (type: string) => META_BY_TYPE[type] ?? META_BY_TYPE["Doble Estándar"]!;

export function floorsOf(hotel: Hotel, rooms: Room[]): Floor[] {
  if (hotel.floors?.length) return hotel.floors;
  return [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b).map((n) => ({ number: n, name: n === 1 ? "Planta 1" : `Planta ${n}` }));
}

/** Room position inside its floor — explicit config wins, otherwise alternate sides along the corridor */
export function roomSlots(rooms: Room[]) {
  return rooms.map((r, i) => ({ room: r, x: r.x ?? Math.floor(i / 2), side: r.side ?? (i % 2 === 0 ? "left" : "right") }));
}

export interface FloorLayout {
  floor: Floor; rooms: { room: Room; rect: Rect }[];
  elevator: Rect; stairs: Rect; corridor: Rect; common: Rect; commonLabel: string;
}
export interface HotelLayout { W: number; D: number; floors: FloorLayout[] }

export function layoutHotel(hotel: Hotel, allRooms: Room[]): HotelLayout {
  const floors = floorsOf(hotel, allRooms);
  const slotted = floors.map((f) => roomSlots(allRooms.filter((r) => r.floor === f.number)));
  const cols = Math.max(2, ...slotted.map((s) => (s.length ? Math.max(...s.map((x) => x.x)) + 1 : 1)));
  const coreX = cols * RW;
  const W = coreX + CORE + COMMON;
  const D = RD * 2 + COR;
  const inset = (r: Rect): Rect => ({ x: r.x + 0.06, y: r.y + 0.06, w: r.w - 0.12, d: r.d - 0.12 });
  return {
    W, D,
    floors: floors.map((floor, i) => ({
      floor,
      rooms: slotted[i]!.map(({ room, x, side }) => ({ room, rect: inset({ x: x * RW, y: side === "left" ? 0 : RD + COR, w: RW, d: RD }) })),
      elevator: inset({ x: coreX, y: 0, w: CORE, d: RD }),
      stairs: inset({ x: coreX, y: RD + COR, w: CORE, d: RD }),
      corridor: { x: 0, y: RD, w: coreX + CORE, d: COR },
      common: inset({ x: coreX + CORE, y: 0, w: COMMON, d: D }),
      commonLabel: i === 0 ? "Lobby · Recepción" : "Office · Zona común",
    })),
  };
}

/** Rotate an axis-aligned rect by 90° steps inside a W×D footprint */
export function rotRect(r: Rect, rot: number, W: number, D: number): Rect {
  const p = (x: number, y: number): Pt => {
    switch (rot % 4) {
      case 1: return [D - y, x];
      case 2: return [W - x, D - y];
      case 3: return [y, W - x];
      default: return [x, y];
    }
  };
  const a = p(r.x, r.y), b = p(r.x + r.w, r.y + r.d);
  return { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), d: Math.abs(b[1] - a[1]) };
}

export const proj = (x: number, y: number, z: number, U: number): Pt => [(x - y) * 0.866 * U, (x + y) * 0.5 * U - z * U];

export function box(r: Rect, z0: number, h: number, U: number) {
  const x1 = r.x + r.w, y1 = r.y + r.d, z1 = z0 + h;
  return {
    top: [proj(r.x, r.y, z1, U), proj(x1, r.y, z1, U), proj(x1, y1, z1, U), proj(r.x, y1, z1, U)],
    south: [proj(r.x, y1, z0, U), proj(x1, y1, z0, U), proj(x1, y1, z1, U), proj(r.x, y1, z1, U)],
    east: [proj(x1, r.y, z0, U), proj(x1, y1, z0, U), proj(x1, y1, z1, U), proj(x1, r.y, z1, U)],
  };
}
export const pts = (p: Pt[]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
export const center = (p: Pt[]): Pt => [p.reduce((a, q) => a + q[0], 0) / p.length, p.reduce((a, q) => a + q[1], 0) / p.length];

export const STATE_VAR: Record<RoomState, string> = {
  ready: "var(--st-ready)", occupied: "var(--st-occupied)", dirty: "var(--st-dirty)",
  cleaning: "var(--st-cleaning)", maintenance: "var(--st-maint)", oos: "var(--st-oos)",
};

/**
 * Twin layers: each layer decorates rooms with a badge. Only the operational
 * "status" layer is active today; future layers (IoT temperature, energy,
 * staff location, cameras…) plug in with the same shape.
 */
export interface TwinLayer { id: string; label: string; badge: (room: Room, state: RoomState) => { color: string; pulse: boolean } | null }
export const STATUS_LAYER: TwinLayer = {
  id: "status", label: "Estado operativo",
  badge: (_r, st) => (st === "dirty" || st === "cleaning" || st === "maintenance" ? { color: STATE_VAR[st], pulse: st !== "cleaning" } : null),
};
