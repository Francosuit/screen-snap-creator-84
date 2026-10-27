import { parseBeds, BED_KINDS, type RoomState } from "@/lib/suite/data";
import { box, center, pts, STATE_VAR, type Pt, type Rect, type RoomMeta } from "./geometry";

/**
 * Simulated isometric interior. Rendered through a single component so it can
 * later be swapped for a real 3D model (same props: meta + live state).
 */
export function RoomInterior({ meta, state, number }: { meta: RoomMeta; state: RoomState; number: string }) {
  const U = 26;
  const W = 6, D = 4.6;
  const c = STATE_VAR[state];
  type Item = { r: Rect; h: number; top: string; side: string; label?: string };
  const items: Item[] = [
    { r: { x: 0, y: 0, w: 2, d: 0.08 }, h: 1.2, top: "var(--twin-wall)", side: "var(--twin-wall-dark)" },
    { r: { x: 1.95, y: 0, w: 0.08, d: 2 }, h: 1.2, top: "var(--twin-wall)", side: "var(--twin-wall-dark)" },
    { r: { x: 0.2, y: 0.25, w: 1.4, d: 0.75 }, h: 0.45, top: "var(--twin-text)", side: "var(--twin-muted)", label: meta.bath.startsWith("Sin") ? "LAVABO" : meta.bath.includes("Bañera") && !meta.bath.includes("Ducha") ? "BAÑERA" : meta.bath.includes("+") ? "DUCHA+BAÑERA" : "DUCHA" },
    { r: { x: 0.25, y: 1.3, w: 0.6, d: 0.5 }, h: 0.6, top: "var(--twin-text)", side: "var(--twin-muted)" },
    { r: { x: 1.0, y: 2.2, w: 0.55, d: 1.0 }, h: 1.4, top: "var(--twin-floor)", side: "var(--twin-wall-dark)", label: "ARMARIO" },
    { r: { x: 3.6, y: 0.1, w: 2.2, d: 0.2 }, h: 0.9, top: "var(--twin-wall)", side: "var(--twin-wall-dark)" },
    { r: { x: 0.3, y: 3.5, w: 1.8, d: 0.7 }, h: 0.75, top: "var(--twin-floor)", side: "var(--twin-wall-dark)", label: "ESCRITORIO" },
    { r: { x: 0.9, y: 3.0, w: 0.5, d: 0.45 }, h: 0.45, top: "var(--twin-wall)", side: "var(--twin-wall-dark)" },
  ];
  // Desk only when the room has one (rooms without configured extras keep it by default)
  if (meta.extras && !meta.extras.includes("Escritorio")) {
    const i = items.findIndex((it) => it.label === "ESCRITORIO");
    if (i >= 0) items.splice(i, 2);
  }
  // Window on the chosen wall
  const WIN: Record<string, Rect> = { fondo: { x: 3.4, y: -0.02, w: 1.8, d: 0.1 }, izquierda: { x: -0.02, y: 2.2, w: 0.1, d: 1.6 }, derecha: { x: W - 0.08, y: 1.6, w: 0.1, d: 1.6 }, frente: { x: 3.4, y: D - 0.08, w: 1.8, d: 0.1 } };
  const win = meta.window && meta.window !== "ninguna" ? WIN[meta.window] : undefined;
  if (win) items.push({ r: win, h: 1.1, top: "var(--st-clean, #7dd3fc)", side: "color-mix(in oklab, #7dd3fc 60%, var(--twin-wall))", label: "VENTANA" });
  // One block per configured bed, laid out from the back wall
  const SIZE: Record<string, [number, number]> = { doble: [1.9, 2.0], king: [2.1, 2.1], individual: [0.95, 1.95], sofa: [1.6, 0.8], litera: [0.95, 1.95], cuna: [0.7, 0.6] };
  const counts = parseBeds(meta.beds);
  const beds = BED_KINDS.flatMap((k) => Array.from({ length: Math.min(counts[k.key] ?? 0, 4) }, () => k));
  if (!beds.length) beds.push(BED_KINDS[0]);
  let bx = 2.4, by = 0.75, rowD = 0;
  beds.forEach((k) => {
    const [w, d] = SIZE[k.key]!;
    if (bx + w > W - 0.05) { bx = 2.4; by += rowD + 0.25; rowD = 0; }
    const label = k.key === "litera" ? "LITERA" : k.one.toUpperCase();
    items.push({ r: { x: bx, y: by, w, d }, h: k.key === "litera" ? 1.3 : 0.45, top: `color-mix(in oklab, ${c} 35%, var(--twin-text))`, side: "var(--twin-wall)", label });
    bx += w + 0.2; rowD = Math.max(rowD, d);
  });
  const floor = box({ x: 0, y: 0, w: W, d: D }, -0.12, 0.12, U);
  const terrace = meta.terrace ? box({ x: 0, y: D + 0.1, w: W, d: 1.3 }, -0.12, 0.08, U) : null;
  const rail = meta.terrace ? box({ x: 0, y: D + 1.32, w: W, d: 0.06 }, 0, 0.45, U) : null;
  const sorted = [...items].sort((a, b) => a.r.x + a.r.y - (b.r.x + b.r.y));
  const all: Pt[] = [...floor.top, ...floor.south, ...floor.east, ...(terrace ? terrace.south : []), ...(rail ? rail.south : [])];
  sorted.forEach((it) => { const b = box(it.r, 0, it.h, U); all.push(...b.top); });
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
  const vb = `${Math.min(...xs) - 16} ${Math.min(...ys) - 16} ${Math.max(...xs) - Math.min(...xs) + 32} ${Math.max(...ys) - Math.min(...ys) + 32}`;
  return (
    <svg viewBox={vb} className="w-full" role="img" aria-label={`Vista digital de la habitación ${number}`}>
      <polygon points={pts(floor.east)} style={{ fill: "var(--twin-slab-side)" }} />
      <polygon points={pts(floor.south)} style={{ fill: "var(--twin-slab-side)" }} />
      <polygon points={pts(floor.top)} style={{ fill: "var(--twin-slab)", stroke: c, strokeWidth: 1.2 }} />
      {terrace && rail && (
        <>
          <polygon points={pts(terrace.top)} style={{ fill: "var(--twin-floor)", opacity: 0.7 }} />
          <text x={center(terrace.top)[0]} y={center(terrace.top)[1]} textAnchor="middle" style={{ fill: "var(--twin-muted)", fontSize: 8, letterSpacing: "0.1em" }}>TERRAZA · VISTA {meta.view.toUpperCase()}</text>
          <polygon points={pts(rail.south)} style={{ fill: "var(--twin-text)", opacity: 0.25 }} />
        </>
      )}
      {sorted.map((it, i) => {
        const b = box(it.r, 0, it.h, U);
        const ct = center(b.top);
        return (
          <g key={i}>
            <polygon points={pts(b.east)} style={{ fill: it.side }} />
            <polygon points={pts(b.south)} style={{ fill: it.side, opacity: 0.85 }} />
            <polygon points={pts(b.top)} style={{ fill: it.top }} />
            {it.label && <text x={ct[0]} y={ct[1]} textAnchor="middle" dominantBaseline="middle" style={{ fill: "var(--twin-bg)", fontSize: 6.5, fontWeight: 600, letterSpacing: "0.06em" }}>{it.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}
