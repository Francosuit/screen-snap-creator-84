import { BED_KINDS, parseBeds, type Room } from "./data";

/** Room floor plan size used by the interior drawing (metres-ish units) */
export const ROOM_W = 6;
export const ROOM_D = 4.6;
export const STEP = 0.25;

export type FurnitureKind = "doble" | "king" | "individual" | "sofa" | "litera" | "cuna" | "armario" | "escritorio" | "silla" | "mesilla" | "bano";
export type Rot = 0 | 90 | 180 | 270;
export interface FurnitureItem { id: string; kind: FurnitureKind; x: number; y: number; rot: Rot }

export const FURNITURE: Record<FurnitureKind, { label: string; w: number; d: number; h: number }> = {
  doble: { label: "Cama doble", w: 1.9, d: 2.0, h: 0.45 },
  king: { label: "Cama king", w: 2.1, d: 2.1, h: 0.45 },
  individual: { label: "Cama individual", w: 0.95, d: 1.95, h: 0.45 },
  sofa: { label: "Sofá cama", w: 1.6, d: 0.8, h: 0.45 },
  litera: { label: "Litera", w: 0.95, d: 1.95, h: 1.3 },
  cuna: { label: "Cuna", w: 0.7, d: 0.6, h: 0.5 },
  armario: { label: "Armario", w: 1.0, d: 0.55, h: 1.4 },
  escritorio: { label: "Escritorio", w: 1.6, d: 0.6, h: 0.75 },
  silla: { label: "Silla", w: 0.5, d: 0.5, h: 0.45 },
  mesilla: { label: "Mesilla", w: 0.45, d: 0.4, h: 0.5 },
  bano: { label: "Zona de baño", w: 1.5, d: 1.8, h: 0.3 },
};
export const FURNITURE_KINDS = Object.keys(FURNITURE) as FurnitureKind[];

/** Footprint after rotation */
export function footprint(it: FurnitureItem) {
  const f = FURNITURE[it.kind];
  return it.rot === 90 || it.rot === 270 ? { w: f.d, d: f.w } : { w: f.w, d: f.d };
}

/** Keeps an item fully inside the room */
export function clampItem(it: FurnitureItem): FurnitureItem {
  const { w, d } = footprint(it);
  const r = (v: number) => Math.round(v * 100) / 100;
  return { ...it, x: r(Math.min(Math.max(0, it.x), Math.max(0, ROOM_W - w))), y: r(Math.min(Math.max(0, it.y), Math.max(0, ROOM_D - d))) };
}

export const moveItem = (it: FurnitureItem, dx: number, dy: number) => clampItem({ ...it, x: it.x + dx, y: it.y + dy });
export const rotateItem = (it: FurnitureItem) => clampItem({ ...it, rot: ((it.rot + 90) % 360) as Rot });

export function isInside(it: FurnitureItem): boolean {
  const { w, d } = footprint(it);
  return it.x >= 0 && it.y >= 0 && it.x + w <= ROOM_W + 1e-6 && it.y + d <= ROOM_D + 1e-6;
}

export function newItem(kind: FurnitureKind, existing: FurnitureItem[]): FurnitureItem {
  let n = 1;
  while (existing.some((e) => e.id === `${kind}-${n}`)) n++;
  return clampItem({ id: `${kind}-${n}`, kind, x: ROOM_W / 2 - FURNITURE[kind].w / 2, y: ROOM_D / 2 - FURNITURE[kind].d / 2, rot: 0 });
}

/** Starting arrangement built only from what the room actually has configured (beds, bath, desk).
 *  Nothing is invented: an unconfigured room starts empty. */
export function autoLayout(room: Room): FurnitureItem[] {
  const out: FurnitureItem[] = [];
  if (room.bath && !room.bath.startsWith("Sin")) out.push({ id: "bano-1", kind: "bano", x: 0.1, y: 0.1, rot: 0 });
  const counts = parseBeds(room.beds);
  let bx = 2.2, by = 0.4, rowD = 0;
  BED_KINDS.forEach((k) => {
    for (let i = 0; i < Math.min(counts[k.key] ?? 0, 4); i++) {
      const f = FURNITURE[k.key];
      if (bx + f.w > ROOM_W) { bx = 2.2; by += rowD + 0.2; rowD = 0; }
      out.push(clampItem({ id: `${k.key}-${i + 1}`, kind: k.key, x: bx, y: by, rot: 0 }));
      bx += f.w + 0.2; rowD = Math.max(rowD, f.d);
    }
  });
  if (room.extras?.includes("Escritorio")) out.push(clampItem({ id: "escritorio-1", kind: "escritorio", x: 0.2, y: ROOM_D - 0.7, rot: 0 }));
  return out;
}

/** The layout the drawing shows: the saved one, otherwise the automatic one */
export const roomLayout = (room: Room) => room.layout ?? autoLayout(room);
