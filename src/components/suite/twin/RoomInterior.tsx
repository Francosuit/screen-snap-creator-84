import type { Room, RoomState } from "@/lib/suite/data";
import { FURNITURE, ROOM_D, ROOM_W, roomLayout, type FurnitureItem, type FurnitureKind } from "@/lib/suite/layout";
import { box, center, proj, pts, rotRect, STATE_VAR, type Pt, type Rect } from "./geometry";

/**
 * Isometric interior drawn only from the room's saved configuration:
 * walls, door, window side, terrace, bathroom type and the furniture arrangement.
 * Each piece is composed of several volumes (frame, mattress, pillows…) in its
 * own unrotated frame, then rotated into its saved footprint — positions,
 * rotations and kinds are never altered here.
 */
type Part = { r: Rect; z: number; h: number; top: string; side: string; front?: string };
const C = {
  wood: "var(--int-wood)", woodD: "var(--int-wood-dark)", trim: "var(--int-trim)", linen: "var(--int-linen)", shade: "var(--int-linen-shade)",
  throw: "var(--int-throw)", fab: "var(--int-fabric)", fabD: "var(--int-fabric-dark)", tile: "var(--int-tile)", tileL: "var(--int-tile-line)",
  glass: "var(--int-glass)", lamp: "var(--int-lamp)", wall: "var(--int-wall)", wallS: "var(--int-wall-side)",
};
const P = (x: number, y: number, w: number, d: number, z: number, h: number, top: string, side = top, front?: string): Part => ({ r: { x, y, w, d }, z, h, top, side, ...(front ? { front } : {}) });
const legs = (w: number, d: number, h: number, t = 0.05, col = C.trim) => [P(0.02, 0.02, t, t, 0, h, col), P(w - t - 0.02, 0.02, t, t, 0, h, col), P(0.02, d - t - 0.02, t, t, 0, h, col), P(w - t - 0.02, d - t - 0.02, t, t, 0, h, col)];

function bed(w: number, d: number, pillows: number): Part[] {
  const out = [
    P(0, 0, w, d, 0, 0.22, C.woodD, C.woodD, C.wood), // base frame
    P(0.04, 0.12, w - 0.08, d - 0.16, 0.22, 0.2, C.linen, C.shade), // mattress
    P(0, 0, w, 0.1, 0, 1.05, C.fabD, C.fabD, C.fab), // upholstered headboard
    P(0.03, d * 0.4, w - 0.06, d * 0.6 - 0.06, 0.42, 0.05, C.linen, C.shade), // duvet
    P(0.02, d - 0.55, w - 0.04, 0.34, 0.47, 0.025, C.throw, C.throw), // bed runner
  ];
  const pw = (w - 0.2) / pillows;
  for (let i = 0; i < pillows; i++) out.push(P(0.1 + i * pw + 0.03, 0.18, pw - 0.06, 0.36, 0.42, 0.12, C.linen, C.shade));
  return out;
}

function parts(kind: FurnitureKind, room: Room): Part[] {
  const { w, d } = FURNITURE[kind];
  switch (kind) {
    case "king": return bed(w, d, 2);
    case "doble": return bed(w, d, 2);
    case "individual": return bed(w, d, 1);
    case "litera": return [
      ...legs(w, d, 1.3, 0.07, C.woodD),
      P(0.04, 0.04, w - 0.08, d - 0.08, 0.18, 0.06, C.wood), P(0.06, 0.06, w - 0.12, d - 0.12, 0.24, 0.14, C.linen, C.shade),
      P(0.14, 0.12, w - 0.28, 0.32, 0.38, 0.1, C.linen, C.shade),
      P(0.04, 0.04, w - 0.08, d - 0.08, 0.86, 0.06, C.wood), P(0.06, 0.06, w - 0.12, d - 0.12, 0.92, 0.14, C.linen, C.shade),
      P(0.14, 0.12, w - 0.28, 0.32, 1.06, 0.1, C.linen, C.shade), P(0.02, d * 0.35, 0.05, d * 0.3, 1.06, 0.18, C.woodD),
    ];
    case "sofa": return [
      P(0, 0, w, d, 0, 0.24, C.fabD), P(0, 0, w, 0.22, 0.24, 0.42, C.fabD, C.fabD, C.fab),
      P(0, 0.22, 0.16, d - 0.22, 0.24, 0.24, C.fabD), P(w - 0.16, 0.22, 0.16, d - 0.22, 0.24, 0.24, C.fabD),
      P(0.18, 0.24, (w - 0.36) / 2 - 0.02, d - 0.28, 0.24, 0.12, C.fab, C.fabD), P(w / 2 + 0.02, 0.24, (w - 0.36) / 2 - 0.02, d - 0.28, 0.24, 0.12, C.fab, C.fabD),
      P(0.24, 0.24, 0.3, 0.12, 0.36, 0.26, C.throw),
    ];
    case "cuna": return [
      ...legs(w, d, 0.5, 0.04, C.wood), P(0.04, 0.04, w - 0.08, d - 0.08, 0.22, 0.08, C.linen, C.shade),
      P(0, 0, w, 0.03, 0.22, 0.28, C.wood), P(0, d - 0.03, w, 0.03, 0.22, 0.28, C.wood),
      P(0, 0, 0.03, d, 0.46, 0.04, C.wood), P(w - 0.03, 0, 0.03, d, 0.46, 0.04, C.wood),
    ];
    case "armario": return [
      P(0, 0, w, d, 0, 0.06, C.trim), P(0, 0, w, d, 0.06, 1.34, C.wood, C.woodD, C.wood),
      P(w / 2 - 0.006, d - 0.005, 0.012, 0.01, 0.1, 1.24, C.woodD), P(w / 2 - 0.12, d - 0.01, 0.04, 0.02, 0.6, 0.22, C.trim), P(w / 2 + 0.08, d - 0.01, 0.04, 0.02, 0.6, 0.22, C.trim),
    ];
    case "escritorio": return [
      ...legs(w, d, 0.7), P(0, 0, w, d, 0.7, 0.05, C.wood, C.woodD), P(0.05, 0.02, 0.45, d - 0.1, 0.5, 0.2, C.woodD, C.woodD, C.wood),
      P(w - 0.3, 0.08, 0.14, 0.14, 0.75, 0.04, C.trim), P(w - 0.25, 0.12, 0.04, 0.04, 0.79, 0.28, C.trim), P(w - 0.34, 0.04, 0.22, 0.22, 1.05, 0.12, C.lamp),
      P(0.7, 0.12, 0.4, 0.28, 0.75, 0.02, C.trim),
    ];
    case "silla": return [...legs(w, d, 0.42, 0.04), P(0, 0, w, d, 0.42, 0.06, C.fab, C.fabD), P(0, 0, w, 0.06, 0.48, 0.42, C.fabD, C.fabD, C.fab)];
    case "mesilla": return [
      P(0, 0, w, d, 0, 0.5, C.wood, C.woodD, C.wood), P(0.04, d - 0.005, w - 0.08, 0.01, 0.27, 0.005, C.woodD),
      P(w / 2 - 0.06, d / 2 - 0.06, 0.12, 0.12, 0.5, 0.18, C.trim), P(w / 2 - 0.12, d / 2 - 0.12, 0.24, 0.24, 0.68, 0.16, C.lamp),
    ];
    case "bano": {
      const b = (room.bath ?? "").toLowerCase();
      const out: Part[] = [P(0, 0, w, d, 0, 0.02, C.tile, C.tileL), P(0, d - 0.04, w * 0.55, 0.04, 0.02, 1.2, C.wall, C.wallS), P(w - 0.04, 0, 0.04, d - 0.8, 0.02, 1.2, C.wall, C.wallS)];
      if (b.includes("bañera")) out.push(P(0.05, 0.05, w - 0.15, 0.72, 0.02, 0.48, C.linen, C.shade), P(0.12, 0.12, w - 0.29, 0.58, 0.5, 0.005, C.glass));
      if (b.includes("ducha")) {
        const y = 0.05;
        if (b.includes("bañera")) out.push(P(w * 0.45, y, 0.02, 0.72, 0.5, 0.7, C.glass));
        else out.push(P(0.05, y, 0.85, 0.85, 0.02, 0.05, C.tile, C.tileL), P(0.9, y, 0.02, 0.85, 0.07, 1.0, C.glass));
      }
      out.push(P(0.05, d - 0.56, 0.6, 0.46, 0.02, 0.78, C.wood, C.woodD), P(0.15, d - 0.48, 0.4, 0.3, 0.8, 0.04, C.linen, C.shade)); // vanity + basin
      out.push(P(0.08, d - 0.08, 0.54, 0.02, 1.0, 0.45, C.glass)); // mirror
      out.push(P(w - 0.5, d - 1.25, 0.38, 0.5, 0.02, 0.38, C.linen, C.shade), P(w - 0.5, d - 1.25, 0.38, 0.14, 0.4, 0.3, C.linen, C.shade)); // WC + cistern
      return out;
    }
  }
}

export function RoomInterior({ room, state, layout, selected, onSelect }: {
  room: Room; state: RoomState; layout?: FurnitureItem[]; selected?: string | null; onSelect?: (id: string | null) => void;
}) {
  const U = 26;
  const W = ROOM_W, D = ROOM_D, WH = 1.45;
  const st = STATE_VAR[state];
  const floor = box({ x: 0, y: 0, w: W, d: D }, -0.14, 0.14, U);
  const terrace = room.terrace ? box({ x: 0, y: D + 0.12, w: W, d: 1.3 }, -0.14, 0.1, U) : null;
  const backWall = box({ x: -0.1, y: -0.1, w: W + 0.1, d: 0.1 }, 0, WH, U);
  const leftWall = box({ x: -0.1, y: 0, w: 0.1, d: D }, 0, WH, U);
  const L = (a: Pt, b: Pt, k?: string | number) => <line key={k} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />;

  // Window opening drawn on the wall the room actually has it on
  const win = room.window && room.window !== "ninguna" ? room.window : null;
  const windowEls = (() => {
    if (!win) return null;
    if (win === "fondo" || win === "izquierda") {
      const onBack = win === "fondo";
      const a = onBack ? 3.2 : 2.0, len = 1.9, z0 = 0.35, z1 = 1.25;
      const q = (t: number, z: number): Pt => (onBack ? proj(a + t, 0, z, U) : proj(0, a + t, z, U));
      const glass = [q(0, z0), q(len, z0), q(len, z1), q(0, z1)];
      const cur = (t0: number, t1: number) => [q(t0, 0.05), q(t1, 0.05), q(t1, 1.38), q(t0, 1.38)];
      return (
        <g aria-label="Ventana">
          <polygon points={pts(glass)} style={{ fill: "var(--int-glass)" }} />
          <polygon points={pts([q(0.05, z0 + 0.05), q(len * 0.45, z0 + 0.05), q(len * 0.2, z1 - 0.05), q(0.05, z1 - 0.05)])} style={{ fill: "var(--int-linen)", opacity: 0.35 }} />
          <g style={{ stroke: "var(--int-trim)", strokeWidth: 1.6, fill: "none" }}><polygon points={pts(glass)} />{L(q(len / 2, z0), q(len / 2, z1))}</g>
          <polygon points={pts([q(-0.08, z0 - 0.04), q(len + 0.08, z0 - 0.04), q(len + 0.08, z0), q(-0.08, z0)])} style={{ fill: "var(--int-trim)" }} />
          <polygon points={pts(cur(-0.35, 0.05))} style={{ fill: "var(--int-curtain)", opacity: 0.95 }} />
          <polygon points={pts(cur(len - 0.05, len + 0.35))} style={{ fill: "var(--int-curtain)", opacity: 0.95 }} />
          <polygon points={pts([q(-0.4, 1.38), q(len + 0.4, 1.38), q(len + 0.4, 1.42), q(-0.4, 1.42)])} style={{ fill: "var(--int-trim)" }} />
        </g>
      );
    }
    // Window on an open (cut-away) wall: sill + glass marker on the floor edge
    const r: Rect = win === "derecha" ? { x: W - 0.06, y: 1.5, w: 0.06, d: 1.8 } : { x: 1.4, y: D - 0.06, w: 1.9, d: 0.06 };
    const b = box(r, 0, 0.5, U);
    return <g aria-label="Ventana"><polygon points={pts(b.east)} style={{ fill: "var(--int-glass)" }} /><polygon points={pts(b.south)} style={{ fill: "var(--int-glass)" }} /><polygon points={pts(b.top)} style={{ fill: "var(--int-trim)" }} /></g>;
  })();

  // Door on the corridor wall (front-right): threshold + open leaf
  const door = box({ x: W - 1.25, y: D - 0.05, w: 0.95, d: 0.05 }, 0, 0.02, U);
  const leaf = [proj(W - 0.3, D, 0, U), proj(W - 0.3, D - 0.9, 0, U), proj(W - 0.3, D - 0.9, 1.3, U), proj(W - 0.3, D, 1.3, U)];

  const items = (layout ?? roomLayout(room)).map((it) => {
    const f = FURNITURE[it.kind];
    const steps = ((it.rot / 90) | 0) % 4;
    const ps = parts(it.kind, room).map((p) => {
      const rr = rotRect(p.r, steps, f.w, f.d);
      return { ...p, r: { ...rr, x: rr.x + it.x, y: rr.y + it.y } };
    });
    const fw = steps % 2 ? f.d : f.w, fd = steps % 2 ? f.w : f.d;
    return { it, ps, depth: it.x + fw / 2 + it.y + fd / 2, foot: { x: it.x, y: it.y, w: fw, d: fd } };
  }).sort((a, b) => a.depth - b.depth);

  const all: Pt[] = [...floor.top, ...floor.south, ...floor.east, ...backWall.top, ...leftWall.top, ...(terrace ? [...terrace.south, ...terrace.top] : [])];
  items.forEach(({ ps }) => ps.forEach((p) => all.push(...box(p.r, p.z, p.h, U).top)));
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
  const vb = `${Math.min(...xs) - 40} ${Math.min(...ys) - 16} ${Math.max(...xs) - Math.min(...xs) + 56} ${Math.max(...ys) - Math.min(...ys) + 32}`;
  const planks = Array.from({ length: Math.floor(W / 0.32) }, (_, i) => (i + 1) * 0.32);

  return (
    <svg viewBox={vb} className="w-full" role="img" aria-label={`Vista digital de la habitación ${room.number}`} onClick={() => onSelect?.(null)}>
      <defs>
        <radialGradient id={`warm-${room.number}`} cx="45%" cy="40%" r="65%"><stop offset="0%" stopColor="var(--int-lamp)" stopOpacity="0.35" /><stop offset="100%" stopColor="var(--int-lamp)" stopOpacity="0" /></radialGradient>
        <filter id="int-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.5" /></filter>
      </defs>
      {/* slab */}
      <polygon points={pts(floor.east)} style={{ fill: "var(--twin-slab-side)" }} />
      <polygon points={pts(floor.south)} style={{ fill: "var(--twin-slab-side)" }} />
      {terrace && (
        <>
          <polygon points={pts(terrace.south)} style={{ fill: "var(--twin-slab-side)" }} />
          <polygon points={pts(terrace.top)} style={{ fill: "var(--int-wood-dark)", opacity: 0.85 }} />
          <g style={{ stroke: "var(--int-trim)", strokeWidth: 0.6, opacity: 0.5 }}>{Array.from({ length: 14 }, (_, i) => L(proj((i + 1) * 0.4, D + 0.12, 0, U), proj((i + 1) * 0.4, D + 1.42, 0, U), i))}</g>
          <g style={{ stroke: "var(--int-glass)", strokeWidth: 1.4, opacity: 0.9 }}>{L(proj(0, D + 1.42, 0.55, U), proj(W, D + 1.42, 0.55, U), "a")}{L(proj(W, D + 0.12, 0.55, U), proj(W, D + 1.42, 0.55, U), "b")}</g>
          <text x={center(terrace.top)[0]} y={center(terrace.top)[1] + 4} textAnchor="middle" style={{ fill: "var(--twin-text)", fontSize: 7, letterSpacing: "0.12em" }}>TERRAZA{room.view ? ` · VISTA ${room.view.toUpperCase()}` : ""}</text>
        </>
      )}
      {/* wood floor with planks + warm light pool */}
      <polygon points={pts(floor.top)} style={{ fill: "var(--int-wood)" }} />
      <g style={{ stroke: "var(--int-wood-line)", strokeWidth: 0.7 }}>{planks.map((x, i) => L(proj(x, 0, 0, U), proj(x, D, 0, U), `p${i}`))}{planks.map((x, i) => i % 3 === 0 ? null : L(proj(x - 0.32, ((i * 1.7) % D), 0, U), proj(x, ((i * 1.7) % D), 0, U), `j${i}`))}</g>
      <polygon points={pts(floor.top)} style={{ fill: `url(#warm-${room.number})` }} />
      <polygon points={pts(floor.top)} style={{ fill: "none", stroke: st, strokeWidth: 1.4 }} />
      {/* walls + baseboards */}
      <polygon points={pts(backWall.south)} style={{ fill: "var(--int-wall)" }} />
      <polygon points={pts(backWall.top)} style={{ fill: "var(--int-trim)" }} />
      <polygon points={pts(leftWall.east)} style={{ fill: "var(--int-wall-side)" }} />
      <polygon points={pts(leftWall.top)} style={{ fill: "var(--int-trim)" }} />
      <polygon points={pts(box({ x: 0, y: -0.02, w: W, d: 0.02 }, 0, 0.09, U).south)} style={{ fill: "var(--int-trim)", opacity: 0.85 }} />
      <polygon points={pts(box({ x: -0.02, y: 0, w: 0.02, d: D }, 0, 0.09, U).east)} style={{ fill: "var(--int-trim)", opacity: 0.85 }} />
      {windowEls}
      {/* door */}
      <polygon points={pts(door.top)} style={{ fill: "var(--int-trim)" }} />
      <polygon points={pts(leaf)} style={{ fill: "var(--int-wood-dark)", opacity: 0.9 }} aria-label="Puerta" />
      {/* furniture */}
      {items.map(({ it, ps, foot }) => {
        const sel = selected === it.id;
        const pick = onSelect;
        const sh = box({ x: foot.x + 0.08, y: foot.y + 0.12, w: foot.w, d: foot.d }, 0, 0, U).top;
        const order = [...ps].sort((a, b) => a.z - b.z || (a.r.x + a.r.y + a.r.w / 2 + a.r.d / 2) - (b.r.x + b.r.y + b.r.w / 2 + b.r.d / 2));
        return (
          <g key={it.id} data-item={it.id} style={pick ? { cursor: "pointer" } : undefined}
            onClick={pick ? (e) => { e.stopPropagation(); onSelect(it.id); } : undefined}>
            <title>{it.kind === "bano" ? room.bath ?? "Baño" : FURNITURE[it.kind].label}</title>
            <polygon points={pts(sh)} style={{ fill: "var(--int-trim)", opacity: 0.35 }} filter="url(#int-soft)" />
            {order.map((p, i) => {
              const b = box(p.r, p.z, p.h, U);
              const stroke = sel ? { stroke: "var(--brand)", strokeWidth: 1.2 } : { stroke: "color-mix(in oklab, black 25%, transparent)", strokeWidth: 0.35 };
              return (
                <g key={i}>
                  {p.h > 0.004 && <polygon points={pts(b.east)} style={{ fill: `color-mix(in oklab, ${p.side} 82%, black)`, ...stroke }} />}
                  {p.h > 0.004 && <polygon points={pts(b.south)} style={{ fill: p.front ?? p.side, ...stroke }} />}
                  <polygon points={pts(b.top)} style={{ fill: p.top, ...stroke }} />
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
