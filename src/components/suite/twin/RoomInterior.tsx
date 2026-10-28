import type { Room, RoomState } from "@/lib/suite/data";
import { FURNITURE, ROOM_D, ROOM_W, footprint, roomLayout, type FurnitureItem } from "@/lib/suite/layout";
import { box, center, pts, STATE_VAR, type Pt, type Rect } from "./geometry";

/**
 * Isometric interior drawn only from the room's saved configuration:
 * walls, door, window side, terrace and the furniture arrangement.
 */
export function RoomInterior({ room, state, layout, selected, onSelect }: {
  room: Room; state: RoomState; layout?: FurnitureItem[]; selected?: string | null; onSelect?: (id: string | null) => void;
}) {
  const U = 26;
  const W = ROOM_W, D = ROOM_D;
  const c = STATE_VAR[state];
  type Item = { id?: string; r: Rect; h: number; top: string; side: string; label?: string };
  const wall = { top: "var(--twin-wall)", side: "var(--twin-wall-dark)" };
  const items: Item[] = [
    { r: { x: 0, y: -0.08, w: W, d: 0.08 }, h: 1.2, ...wall },
    { r: { x: -0.08, y: 0, w: 0.08, d: D }, h: 1.2, ...wall },
  ];
  // Door: fixed on the corridor wall (front-right)
  items.push({ r: { x: W - 1.2, y: D - 0.06, w: 0.9, d: 0.08 }, h: 0.05, top: "var(--twin-text)", side: "var(--twin-muted)", label: "PUERTA" });
  const WIN: Record<string, Rect> = { fondo: { x: 3.4, y: -0.1, w: 1.8, d: 0.1 }, izquierda: { x: -0.1, y: 2.2, w: 0.1, d: 1.6 }, derecha: { x: W - 0.08, y: 1.6, w: 0.1, d: 1.6 }, frente: { x: 1.4, y: D - 0.08, w: 1.8, d: 0.1 } };
  const win = room.window && room.window !== "ninguna" ? WIN[room.window] : undefined;
  if (win) items.push({ r: win, h: 1.1, top: "color-mix(in oklab, var(--st-occupied) 45%, var(--twin-text))", side: "color-mix(in oklab, var(--st-occupied) 60%, var(--twin-wall))", label: "VENTANA" });
  (layout ?? roomLayout(room)).forEach((it) => {
    const f = FURNITURE[it.kind];
    const { w, d } = footprint(it);
    const bed = ["doble", "king", "individual", "sofa", "litera", "cuna"].includes(it.kind);
    const sel = selected === it.id;
    items.push({
      id: it.id, r: { x: it.x, y: it.y, w, d }, h: f.h,
      top: sel ? "var(--brand)" : bed ? `color-mix(in oklab, ${c} 35%, var(--twin-text))` : it.kind === "bano" ? "var(--twin-text)" : "var(--twin-floor)",
      side: sel ? "color-mix(in oklab, var(--brand) 70%, black)" : "var(--twin-wall-dark)",
      label: (it.kind === "bano" ? room.bath ?? "Baño" : f.label.replace("Cama ", "")).toUpperCase(),
    });
  });
  const floor = box({ x: 0, y: 0, w: W, d: D }, -0.12, 0.12, U);
  const terrace = room.terrace ? box({ x: 0, y: D + 0.1, w: W, d: 1.3 }, -0.12, 0.08, U) : null;
  const sorted = [...items].sort((a, b) => a.r.x + a.r.y - (b.r.x + b.r.y));
  const all: Pt[] = [...floor.top, ...floor.south, ...floor.east, ...(terrace ? terrace.south : [])];
  sorted.forEach((it) => { all.push(...box(it.r, 0, it.h, U).top); });
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
  const vb = `${Math.min(...xs) - 16} ${Math.min(...ys) - 16} ${Math.max(...xs) - Math.min(...xs) + 32} ${Math.max(...ys) - Math.min(...ys) + 32}`;
  return (
    <svg viewBox={vb} className="w-full" role="img" aria-label={`Vista digital de la habitación ${room.number}`} onClick={() => onSelect?.(null)}>
      <polygon points={pts(floor.east)} style={{ fill: "var(--twin-slab-side)" }} />
      <polygon points={pts(floor.south)} style={{ fill: "var(--twin-slab-side)" }} />
      <polygon points={pts(floor.top)} style={{ fill: "var(--twin-slab)", stroke: c, strokeWidth: 1.2 }} />
      {terrace && (
        <>
          <polygon points={pts(terrace.top)} style={{ fill: "var(--twin-floor)", opacity: 0.7 }} />
          <text x={center(terrace.top)[0]} y={center(terrace.top)[1]} textAnchor="middle" style={{ fill: "var(--twin-muted)", fontSize: 8, letterSpacing: "0.1em" }}>TERRAZA{room.view ? ` · VISTA ${room.view.toUpperCase()}` : ""}</text>
        </>
      )}
      {sorted.map((it, i) => {
        const b = box(it.r, 0, it.h, U);
        const ct = center(b.top);
        const pick = it.id && onSelect;
        return (
          <g key={it.id ?? i} data-item={it.id} style={pick ? { cursor: "pointer" } : undefined}
            onClick={pick ? (e) => { e.stopPropagation(); onSelect(it.id!); } : undefined}>
            <polygon points={pts(b.east)} style={{ fill: it.side }} />
            <polygon points={pts(b.south)} style={{ fill: it.side, opacity: 0.85 }} />
            <polygon points={pts(b.top)} style={{ fill: it.top }} />
            {it.label && <text x={ct[0]} y={ct[1]} textAnchor="middle" dominantBaseline="middle" style={{ fill: "var(--twin-bg)", fontSize: 6, fontWeight: 600, letterSpacing: "0.06em", pointerEvents: "none" }}>{it.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}
