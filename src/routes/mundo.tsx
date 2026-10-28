import { facadeVars } from "@/lib/suite/facade";
import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Minus, Plus, Maximize2, Wrench, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/suite/ui";
import { useSuite } from "@/lib/suite/store";
import type { Hotel, Room, RoomState } from "@/lib/suite/data";
import { box, center, pts, STATE_VAR, type Pt } from "@/components/suite/twin/geometry";
import { techPhase } from "@/components/suite/twin/useTwin";

export const Route = createFileRoute("/mundo")({
  head: () => ({
    meta: [
      { title: "Digital World — Suite Hotel OS" },
      { name: "description", content: "Tu grupo hotelero como una ciudad digital: hoteles, base de mantenimiento y técnicos en tiempo real." },
      { property: "og:title", content: "Digital World — Suite Hotel OS" },
      { property: "og:description", content: "Aléjate para ver todos tus hoteles, entra en uno y opera en tiempo real." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: World,
});

type Slice = ReturnType<typeof useSuite>["world"][string];

/** Same derivation rules as the store's roomState, applied to any hotel slice */
function stateOf(d: Slice, r: Room): RoomState {
  if (r.oos) return "oos";
  if (d.incidents.some((i) => i.room === r.number && i.blocking && i.status !== "resuelta")) return "maintenance";
  if (d.reservations.some((x) => x.room === r.number && x.stay === "inhouse")) return "occupied";
  if (r.hk === "cleaning") return "cleaning";
  if (r.hk === "dirty" || r.hk === "inspect") return "dirty";
  return "ready";
}

function stats(h: Hotel, d: Slice) {
  const st = d.rooms.map((r) => stateOf(d, r));
  const floors = h.floors?.length ?? new Set(d.rooms.map((r) => r.floor)).size;
  return {
    floors, rooms: d.rooms.length,
    occupied: st.filter((x) => x === "occupied").length,
    ready: st.filter((x) => x === "ready").length,
    pending: st.filter((x) => x === "dirty" || x === "cleaning").length,
    incidents: d.incidents.filter((i) => i.status !== "resuelta").length,
    tasks: d.tasks.filter((t) => t.status !== "completada").length,
    techs: d.incidents.filter((i) => ["route", "onsite"].includes(techPhase(i))),
  };
}

const U = 13;
const LOT = 15; // spacing between hotel lots

function World() {
  const { hotels, world, hotel: active, actions, org } = useSuite();
  const nav = useNavigate();
  const [sel, setSel] = useState<string | null>(active.id);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null);

  const scene = useMemo(() => {
    const items = hotels.map((h, i) => {
      const d = world[h.id]!;
      const s = stats(h, d);
      const col = i % 3, row = Math.floor(i / 3);
      const x = col * LOT, y = row * LOT;
      const perFloor = Math.max(4, ...Object.values(d.rooms.reduce<Record<number, number>>((a, r) => ({ ...a, [r.floor]: (a[r.floor] ?? 0) + 1 }), {})));
      const w = Math.min(10, 3 + perFloor * 0.6), dep = 4;
      const floorsArr = h.floors?.length ? h.floors.map((f) => f.number) : [...new Set(d.rooms.map((r) => r.floor))].sort();
      const fh = 0.9;
      const b = box({ x: x + 2, y: y + 2, w, d: dep }, 0, floorsArr.length * fh, U);
      // façade windows: each room of each floor, coloured by its live state
      const wins: { p: Pt[]; c: string; key: string }[] = [];
      floorsArr.forEach((fn, fi) => {
        const rooms = d.rooms.filter((r) => r.floor === fn);
        const n = Math.max(rooms.length, 1);
        rooms.forEach((r, ri) => {
          const x0 = x + 2 + (w / n) * ri + 0.12, x1 = x + 2 + (w / n) * (ri + 1) - 0.12;
          const z0 = fi * fh + 0.25, z1 = fi * fh + 0.7, yy = y + 2 + dep;
          const pr = (a: number, zz: number): Pt => [(a - yy) * 0.866 * U, (a + yy) * 0.5 * U - zz * U];
          wins.push({ key: `${h.id}-${r.number}`, c: STATE_VAR[stateOf(d, r)], p: [pr(x0, z0), pr(x1, z0), pr(x1, z1), pr(x0, z1)] });
        });
        if (!rooms.length) {
          const yy = y + 2 + dep, z0 = fi * fh + 0.2, z1 = fi * fh + 0.75;
          const pr = (a: number, zz: number): Pt => [(a - yy) * 0.866 * U, (a + yy) * 0.5 * U - zz * U];
          wins.push({ key: `${h.id}-lobby${fn}`, c: "var(--brand)", p: [pr(x + 2.3, z0), pr(x + 2 + w - 0.3, z0), pr(x + 2 + w - 0.3, z1), pr(x + 2.3, z1)] });
        }
      });
      const lot = box({ x, y, w: LOT - 2, d: LOT - 3 }, -0.1, 0.1, U);
      const zones = (h.zones ?? []).filter((z) => ["Piscina", "Jardín", "Parking"].includes(z)).map((z, k) => ({
        z, b: box({ x: x + 1 + k * 4, y: y + 7.5, w: 3.4, d: 2.6 }, 0, 0.05, U),
        tone: z === "Piscina" ? "var(--st-occupied)" : z === "Jardín" ? "var(--st-ready)" : "var(--twin-floor)",
      }));
      // Architectural detail (decorative only, never status): balconies, cornices, side windows, roof, entrance, shadow
      const P = (px: number, py: number, pz: number): Pt => [(px - py) * 0.866 * U, (px + py) * 0.5 * U - pz * U];
      const bx = x + 2, by = y + 2, yy = by + dep, xe = bx + w, H = floorsArr.length * fh;
      const shadow = [P(bx + 0.4, by + 0.6, 0), P(xe + 1.6, by + 0.6, 0), P(xe + 1.6, yy + 1.2, 0), P(bx + 0.4, yy + 1.2, 0)];
      const cornices = floorsArr.slice(1).map((_, fi) => { const z = (fi + 1) * fh; return [P(bx, yy, z), P(xe, yy, z), P(xe, by, z)]; });
      const balconies: { slab: Pt[]; rail: Pt[] }[] = [];
      floorsArr.forEach((fn, fi) => {
        if (fi === 0) return;
        const n = Math.max(d.rooms.filter((r) => r.floor === fn).length, 1);
        for (let ri = 0; ri < n; ri++) {
          const x0 = bx + (w / n) * ri + 0.08, x1 = bx + (w / n) * (ri + 1) - 0.08, z = fi * fh + 0.04;
          balconies.push({ slab: [P(x0, yy, z), P(x1, yy, z), P(x1, yy + 0.32, z), P(x0, yy + 0.32, z)], rail: [P(x0, yy + 0.32, z), P(x0, yy + 0.32, z + 0.2), P(x1, yy + 0.32, z + 0.2), P(x1, yy + 0.32, z)] });
        }
      });
      const sideWins: Pt[][] = [];
      floorsArr.forEach((_, fi) => { for (let k = 0; k < 3; k++) { const y0 = by + 0.4 + k * 1.2, y1 = y0 + 0.7, z0 = fi * fh + 0.28, z1 = fi * fh + 0.68; sideWins.push([P(xe, y0, z0), P(xe, y1, z0), P(xe, y1, z1), P(xe, y0, z1)]); } });
      const roofKind = [...h.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 3; // stable per-hotel silhouette
      const roofInset = box({ x: bx + 0.5, y: by + 0.5, w: w - 1, d: dep - 1 }, H, 0.04, U);
      const roofUnit = box({ x: bx + w * 0.6, y: by + 0.8, w: Math.min(2, w * 0.25), d: 1.4 }, H, 0.35, U);
      const parapet = [P(bx + 0.15, by + 0.15, H + 0.01), P(xe - 0.15, by + 0.15, H + 0.01), P(xe - 0.15, yy - 0.15, H + 0.01), P(bx + 0.15, yy - 0.15, H + 0.01)];
      const canopy = box({ x: bx + w / 2 - 0.9, y: yy, w: 1.8, d: 0.9 }, 0.62, 0.08, U);
      const walk = [P(bx + w / 2 - 0.5, yy, 0.01), P(bx + w / 2 + 0.5, yy, 0.01), P(bx + w / 2 + 0.5, y + LOT - 3, 0.01), P(bx + w / 2 - 0.5, y + LOT - 3, 0.01)];
      const zoneArt = zones.map((zn) => {
        const r = { x: x + 1 + zones.indexOf(zn) * 4, y: y + 7.5, w: 3.4, d: 2.6 };
        const inner = box({ x: r.x + 0.35, y: r.y + 0.35, w: r.w - 0.7, d: r.d - 0.7 }, 0, 0.06, U);
        const lines = zn.z === "Parking" ? [0.8, 1.6, 2.4].map((v) => [P(r.x + v, r.y + 0.3, 0.06), P(r.x + v, r.y + 1.3, 0.06)] as Pt[]) : zn.z === "Piscina" ? [1, 1.7].map((v) => [P(r.x + 0.5, r.y + v - 0.4, 0.07), P(r.x + r.w - 0.5, r.y + v - 0.4, 0.07)] as Pt[]) : [];
        const bushes = zn.z === "Jardín" ? [P(r.x + 0.9, r.y + 1, 0.1), P(r.x + 2.4, r.y + 1.6, 0.1), P(r.x + 1.7, r.y + 0.7, 0.1)] : [];
        return { ...zn, inner, lines, bushes };
      });
      const top = center(b.top);
      return { h, s, b, wins, lot, zones: zoneArt, shadow, cornices, balconies, sideWins, roofUnit, parapet, canopy, walk, roofKind, roofInset, label: [top[0], b.top.reduce((m, p) => Math.min(m, p[1]), Infinity) - 14] as Pt, door: center(box({ x: x + 2, y: y + 2 + dep, w, d: 0.5 }, 0, 0, U).top) };
    });
    const rows = Math.ceil(hotels.length / 3);
    const baseX = Math.min(hotels.length, 3) * LOT, baseY = 0;
    const base = box({ x: baseX + 1, y: baseY + 3, w: 4, d: 3 }, 0, 1, U);
    const baseDoor = center(box({ x: baseX + 1, y: baseY + 6, w: 4, d: 0.3 }, 0, 0, U).top);
    const ground = box({ x: -3, y: -3, w: baseX + 9, d: rows * LOT + 3 }, -0.3, 0.2, U);
    const roads = [
      ...Array.from({ length: rows }, (_, r) => box({ x: -3, y: r * LOT + LOT - 3, w: baseX + 9, d: 1.6 }, -0.1, 0.02, U)),
      box({ x: baseX - 2, y: -3, w: 1.6, d: rows * LOT + 3 }, -0.1, 0.02, U),
    ];
    const trees: Pt[] = [];
    for (let i = 0; i < hotels.length; i++) for (let t = 0; t < 4; t++) {
      const x = (i % 3) * LOT + 1 + t * 3.2, y = Math.floor(i / 3) * LOT + 11;
      trees.push([(x - y) * 0.866 * U, (x + y) * 0.5 * U]);
    }
    const P0 = (px: number, py: number): Pt => [(px - py) * 0.866 * U, (px + py) * 0.5 * U];
    const lanes: Pt[][] = [...Array.from({ length: rows }, (_, r) => [P0(-3, r * LOT + LOT - 2.2), P0(baseX + 6, r * LOT + LOT - 2.2)]), [P0(baseX - 1.2, -3), P0(baseX - 1.2, rows * LOT)]];
    const lamps: Pt[] = [];
    for (let r = 0; r < rows; r++) for (let k = 0; k * 4 < baseX + 6; k++) lamps.push(P0(-1 + k * 4, r * LOT + LOT - 3.2));
    const gx0 = -3, gx1 = baseX + 6, gy1 = rows * LOT;
    const beach = box({ x: gx0, y: gy1, w: gx1 - gx0, d: 2.6 }, -0.35, 0.15, U);
    const sea = [P0(gx0 - 6, gy1 + 2.6), P0(gx1 + 6, gy1 + 2.6), P0(gx1 + 6, gy1 + 12), P0(gx0 - 6, gy1 + 12)];
    const waves = [3.4, 5, 7, 9.5].map((d, k) => [P0(gx0 + k * 2, gy1 + d), P0(gx1 - k * 3, gy1 + d)]);
    const umbrellas = Array.from({ length: Math.max(3, Math.floor((gx1 - gx0) / 5)) }, (_, k) => P0(gx0 + 2 + k * 5, gy1 + 1.3));
    const cross = Array.from({ length: rows }, (_, r) => [0.2, 0.6, 1, 1.4].map((v) => [P0(baseX - 2.6, r * LOT + LOT - 3 + v), P0(baseX - 2.1, r * LOT + LOT - 3 + v)] as Pt[])).flat();
    return { items, base, baseDoor, ground, roads, trees, lanes, lamps, beach, sea, waves, umbrellas, cross };
  }, [hotels, world]);

  const vb = useMemo(() => {
    const all = [...scene.ground.top, ...scene.ground.south, ...scene.ground.east, ...scene.sea, ...scene.items.map((i) => i.label), ...scene.base.top];
    const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
    const x0 = Math.min(...xs) - 20, y0 = Math.min(...ys) - 30;
    return `${x0} ${y0} ${Math.max(...xs) - x0 + 20} ${Math.max(...ys) - y0 + 20}`;
  }, [scene]);

  const selItem = scene.items.find((i) => i.h.id === sel);
  const allTechs = scene.items.flatMap((i) => i.s.techs.map((t) => ({ t, hotel: i.h.name })));
  const enter = (id: string) => { actions.setHotel(id); nav({ to: "/hotel" }); };

  return (
    <div>
      <PageHeader title="Digital World" sub={`${org?.name ?? "Grupo Suite"} · ${hotels.length} ${hotels.length === 1 ? "hotel" : "hoteles"} · base de mantenimiento`}
        right={<Button asChild variant="outline" size="sm"><Link to="/crear-hotel"><Plus className="mr-1 h-4 w-4" />Crear hotel</Link></Button>} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative overflow-hidden rounded-2xl bg-twin-bg text-twin-text">
          <div className="absolute left-5 top-4 z-10">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-twin-muted">Ciudad digital</div>
            <div className="text-sm">Pulsa un hotel para ver su estado · doble clic para entrar</div>
          </div>
          <div className="h-[480px] touch-none select-none sm:h-[620px]" style={{ cursor: "grab" }}
            onWheel={(e) => setZoom((z) => Math.min(3, Math.max(0.6, z * Math.exp(-e.deltaY * 0.0015))))}
            onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y, moved: false }; }}
            onPointerMove={(e) => { const d = drag.current; if (d && e.buttons) { const dx = e.clientX - d.x, dy = e.clientY - d.y; if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true; if (d.moved) setOff({ x: d.ox + dx, y: d.oy + dy }); } }}
            onPointerUp={() => setTimeout(() => (drag.current = null), 0)}>
            <div className="h-full w-full" style={{ transform: `translate(${off.x}px, ${off.y}px) scale(${zoom})`, transformOrigin: "50% 50%", transition: drag.current ? "none" : "transform 200ms ease" }}>
              <svg viewBox={vb} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
                <polygon points={pts(scene.ground.east)} style={{ fill: "var(--twin-slab-side)" }} />
                <polygon points={pts(scene.ground.south)} style={{ fill: "var(--twin-slab-side)" }} />
                <defs>
                  <linearGradient id="world-ground" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="color-mix(in oklab, var(--fac-grass) 42%, var(--twin-bg))" /><stop offset="1" stopColor="color-mix(in oklab, var(--fac-leaf) 30%, var(--twin-bg))" /></linearGradient>
                  <linearGradient id="world-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="color-mix(in oklab, var(--fac-water) 75%, white)" /><stop offset="1" stopColor="color-mix(in oklab, var(--fac-water) 45%, var(--twin-bg))" /></linearGradient>
                  <linearGradient id="world-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="white" stopOpacity="0.22" /><stop offset="0.45" stopColor="white" stopOpacity="0" /><stop offset="1" stopColor="black" stopOpacity="0.18" /></linearGradient>
                  <radialGradient id="world-lamp"><stop offset="0" stopColor="var(--int-lamp)" stopOpacity="0.55" /><stop offset="1" stopColor="var(--int-lamp)" stopOpacity="0" /></radialGradient>
                </defs>
                <polygon points={pts(scene.sea)} style={{ fill: "url(#world-sea)" }} />
                {scene.waves.map((l, i) => <polyline key={i} points={pts(l)} style={{ fill: "none", stroke: "color-mix(in oklab, var(--fac-water) 40%, white)", strokeWidth: 0.7, strokeDasharray: "14 10", opacity: 0.45 }} />)}
                <polygon points={pts(scene.beach.south)} style={{ fill: "color-mix(in oklab, var(--fac-stone) 70%, var(--fac-wood))" }} />
                <polygon points={pts(scene.beach.top)} style={{ fill: "color-mix(in oklab, var(--fac-stone-top) 70%, var(--int-lamp))" }} />
                {scene.umbrellas.map((u, i) => <g key={i} style={{ pointerEvents: "none" }}><line x1={u[0]} y1={u[1]} x2={u[0]} y2={u[1] - 7} style={{ stroke: "var(--fac-trim)", strokeWidth: 0.8 }} /><ellipse cx={u[0]} cy={u[1] - 7} rx={5} ry={2} style={{ fill: i % 2 ? "var(--int-lamp)" : "var(--fac-stone-top)" }} /><rect x={u[0] + 3} y={u[1] - 1} width={5} height={1.6} style={{ fill: "var(--int-linen, var(--fac-stone-top))" }} /></g>)}
                <polygon points={pts(scene.ground.top)} style={{ fill: "url(#world-ground)" }} />
                {scene.roads.map((r, i) => <polygon key={i} points={pts(r.top)} style={{ fill: "var(--fac-asphalt)", stroke: "color-mix(in oklab, var(--fac-stone-top) 45%, var(--fac-asphalt))", strokeWidth: 1.2 }} />)}
                {scene.cross.map((c, i) => <polyline key={`x${i}`} points={pts(c)} style={{ fill: "none", stroke: "var(--fac-stone-top)", strokeWidth: 1.6, opacity: 0.8 }} />)}
                {scene.lanes.map((l, i) => <polyline key={i} points={pts(l)} style={{ fill: "none", stroke: "var(--int-lamp)", strokeWidth: 0.8, strokeDasharray: "5 6", opacity: 0.55 }} />)}
                {scene.lamps.map((l, i) => <g key={i} style={{ pointerEvents: "none" }}><circle cx={l[0]} cy={l[1]} r={9} style={{ fill: "url(#world-lamp)" }} /><line x1={l[0]} y1={l[1]} x2={l[0]} y2={l[1] - 9} style={{ stroke: "var(--fac-trim)", strokeWidth: 1 }} /><circle cx={l[0]} cy={l[1] - 9} r={1.6} style={{ fill: "var(--int-lamp)" }} /></g>)}
                {scene.items.map(({ h, s, b, wins, lot, zones, label, shadow, cornices, balconies, sideWins, roofUnit, parapet, canopy, walk, roofKind, roofInset }) => {
                  const on = sel === h.id;
                  return (
                    <g key={h.id} style={facadeVars(h.facade)} className="cursor-pointer" onClick={() => { if (!drag.current?.moved) setSel(h.id); }} onDoubleClick={() => enter(h.id)}>
                      <polygon points={pts(lot.top)} style={{ fill: on ? "color-mix(in oklab, var(--brand) 22%, var(--fac-grass))" : "color-mix(in oklab, var(--fac-grass) 70%, var(--twin-bg))", stroke: on ? "var(--brand)" : "color-mix(in oklab, var(--fac-stone-top) 60%, transparent)", strokeWidth: on ? 1.8 : 1.4, transition: "fill 300ms" }} />
                      <polygon points={pts(walk)} style={{ fill: "var(--fac-stone-top)", opacity: 0.75 }} />
                      {zones.map((z) => (
                        <g key={z.z}>
                          <polygon points={pts(z.b.east)} style={{ fill: "var(--fac-stone-side)" }} />
                          <polygon points={pts(z.b.top)} style={{ fill: z.z === "Jardín" ? "var(--fac-grass)" : "var(--fac-stone-top)" }} />
                          <polygon points={pts(z.inner.top)} style={{ fill: z.z === "Piscina" ? "var(--fac-water)" : z.z === "Parking" ? "var(--fac-asphalt)" : "color-mix(in oklab, var(--fac-grass) 80%, white)" }} />
                          {z.lines.map((l, k) => <polyline key={k} points={pts(l)} style={{ fill: "none", stroke: z.z === "Piscina" ? "color-mix(in oklab, var(--fac-water) 50%, white)" : "var(--fac-stone-top)", strokeWidth: 0.8 }} />)}
                          {z.z === "Piscina" && [0.2, 0.45, 0.7].map((v) => { const t = z.b.top; const a = t[3]!, bb = t[2]!; const p: Pt = [a[0] + (bb[0] - a[0]) * v, a[1] + (bb[1] - a[1]) * v]; return <rect key={v} x={p[0] - 3} y={p[1] - 3.5} width={6} height={2} rx={0.6} style={{ fill: "var(--fac-stone-top)", stroke: "var(--fac-wood)", strokeWidth: 0.4 }} />; })}
                          {z.bushes.map((p, k) => <circle key={k} cx={p[0]} cy={p[1] - 3} r={3.4} style={{ fill: "var(--fac-leaf)", stroke: "color-mix(in oklab, var(--fac-leaf) 60%, black)", strokeWidth: 0.5 }} />)}
                          <text x={center(z.b.top)[0]} y={center(z.b.top)[1] + 14} textAnchor="middle" style={{ fill: "var(--twin-text)", fontSize: 6, fontWeight: 600, letterSpacing: "0.08em", opacity: 0.8 }}>{z.z.toUpperCase()}</text>
                        </g>
                      ))}
                      <polygon points={pts(shadow)} style={{ fill: "var(--twin-bg)", opacity: 0.4 }} />
                      <polygon points={pts(b.east)} style={{ fill: "var(--fac-stone-side)" }} />
                      <polygon points={pts(b.south)} style={{ fill: "var(--fac-stone)" }} />
                      <polygon points={pts(b.top)} style={{ fill: "color-mix(in oklab, var(--fac-stone-top) 70%, var(--twin-floor))", stroke: on ? "var(--brand)" : "var(--fac-trim)", strokeWidth: on ? 1.8 : 0.8 }} />
                      <polygon points={pts(parapet)} style={{ fill: "color-mix(in oklab, var(--twin-floor) 80%, black)", opacity: 0.6 }} />
                      {roofKind === 0 && <><polygon points={pts(roofUnit.east)} style={{ fill: "var(--fac-stone-side)" }} /><polygon points={pts(roofUnit.south)} style={{ fill: "var(--fac-stone)" }} /><polygon points={pts(roofUnit.top)} style={{ fill: "var(--fac-stone-top)" }} /></>}
                      {roofKind === 1 && <><polygon points={pts(roofInset.top)} style={{ fill: "var(--fac-wood)", opacity: 0.85 }} /><polygon points={pts(roofUnit.top)} style={{ fill: "var(--fac-water)", stroke: "var(--fac-stone-top)", strokeWidth: 1 }} /></>}
                      {roofKind === 2 && <><polygon points={pts(roofInset.top)} style={{ fill: "var(--fac-grass)" }} />{[0.2, 0.5, 0.8].map((v) => { const c = center(roofInset.top), t = roofInset.top[0]!; const p: Pt = [t[0] + (c[0] - t[0]) * 2 * v, t[1] + (c[1] - t[1]) * 2 * v]; return <circle key={v} cx={p[0]} cy={p[1] - 2} r={2.6} style={{ fill: "var(--fac-leaf)" }} />; })}</>}
                      {sideWins.map((p, k) => <polygon key={k} points={pts(p)} style={{ fill: "color-mix(in oklab, var(--int-lamp) 35%, var(--fac-glass))", stroke: "var(--fac-trim)", strokeWidth: 0.6, opacity: 0.85 }} />)}
                      {wins.map((w) => <polygon key={w.key} points={pts(w.p)} style={{ fill: w.c, opacity: 0.92, stroke: "var(--fac-trim)", strokeWidth: 0.7, transition: "fill 400ms" }} />)}
                      <polygon points={pts(b.south)} style={{ fill: "url(#world-glass)", pointerEvents: "none" }} />
                      {cornices.map((c, k) => <polyline key={k} points={pts(c)} style={{ fill: "none", stroke: "var(--fac-trim)", strokeWidth: 1.1, opacity: 0.7 }} />)}
                      {balconies.map((bl, k) => <g key={k}><polygon points={pts(bl.slab)} style={{ fill: "var(--fac-stone-top)" }} /><polygon points={pts(bl.rail)} style={{ fill: "color-mix(in oklab, var(--fac-glass) 45%, transparent)", stroke: "var(--fac-trim)", strokeWidth: 0.5 }} /></g>)}
                      <polygon points={pts(canopy.south)} style={{ fill: "var(--fac-trim)" }} /><polygon points={pts(canopy.top)} style={{ fill: "var(--int-lamp)", opacity: 0.85 }} />
                      <g transform={`translate(${label[0]},${label[1]})`}>
                        <rect x={-62} y={-14} width={124} height={26} rx={8} style={{ fill: "var(--twin-panel)", stroke: on ? "var(--brand)" : "var(--twin-line)" }} />
                        <text textAnchor="middle" y={-3} style={{ fill: "var(--twin-text)", fontSize: 9, fontWeight: 700 }}>{h.name}</text>
                        <text textAnchor="middle" y={8} style={{ fill: "var(--twin-muted)", fontSize: 7 }}>{s.occupied}/{s.rooms} ocupadas · {s.incidents} incid.</text>
                        {s.incidents > 0 && <circle cx={58} cy={-12} r={4} className="twin-pulse" style={{ fill: "var(--st-maint)" }} />}
                      </g>
                    </g>
                  );
                })}
                {scene.trees.map((t, i) => {
                  const sc = 0.8 + ((i * 37) % 5) * 0.1;
                  return i % 3 === 1 ? (
                    <g key={i} style={{ pointerEvents: "none" }}>
                      <ellipse cx={t[0] + 3} cy={t[1] + 1} rx={6 * sc} ry={2.5 * sc} style={{ fill: "var(--twin-bg)", opacity: 0.35 }} />
                      <line x1={t[0]} y1={t[1]} x2={t[0]} y2={t[1] - 6 * sc} style={{ stroke: "var(--fac-wood)", strokeWidth: 1.6 }} />
                      <circle cx={t[0]} cy={t[1] - 9 * sc} r={5.5 * sc} style={{ fill: "color-mix(in oklab, var(--fac-leaf) 80%, black)" }} />
                      <circle cx={t[0] - 1.5} cy={t[1] - 10.5 * sc} r={3.6 * sc} style={{ fill: "color-mix(in oklab, var(--fac-leaf) 75%, var(--fac-grass))" }} />
                    </g>
                  ) : (
                    <g key={i} style={{ pointerEvents: "none" }} transform={`translate(${t[0]} ${t[1]}) scale(${sc}) translate(${-t[0]} ${-t[1]})`}>
                      <ellipse cx={t[0] + 3} cy={t[1] + 1} rx={6} ry={2.5} style={{ fill: "var(--twin-bg)", opacity: 0.35 }} />
                      <path d={`M${t[0]},${t[1]} Q${t[0] + 3},${t[1] - 7} ${t[0] + 1.5},${t[1] - 13}`} style={{ stroke: "var(--fac-wood)", strokeWidth: 1.6, fill: "none" }} />
                      {[-1, 1, -0.4, 0.5].map((dir, k) => <ellipse key={k} cx={t[0] + 1.5 + dir * 4} cy={t[1] - 13 + Math.abs(dir) * 1.5} rx={5} ry={1.8} transform={`rotate(${dir * 25} ${t[0] + 1.5 + dir * 4} ${t[1] - 13})`} style={{ fill: k % 2 ? "var(--fac-leaf)" : "color-mix(in oklab, var(--fac-leaf) 70%, var(--fac-grass))" }} />)}
                    </g>
                  );
                })}
                {/* Maintenance base */}
                <g>
                  <polygon points={pts(scene.base.east)} style={{ fill: "color-mix(in oklab, var(--st-maint) 30%, var(--twin-wall-dark))" }} />
                  <polygon points={pts(scene.base.south)} style={{ fill: "color-mix(in oklab, var(--st-maint) 40%, var(--twin-wall))" }} />
                  <polygon points={pts(scene.base.top)} style={{ fill: "color-mix(in oklab, var(--st-maint) 50%, var(--twin-floor))", stroke: "var(--st-maint)" }} />
                  <text x={center(scene.base.top)[0]} y={center(scene.base.top)[1] - 22} textAnchor="middle" style={{ fill: "var(--twin-text)", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em" }}>MANTENIMIENTO</text>
                </g>
                {/* Technicians moving base → hotel, or on site */}
                {scene.items.flatMap(({ h, s, door }) => s.techs.map((t) => {
                  const from = scene.baseDoor, path = `M${from[0]},${from[1]} L${door[0]},${door[1]}`;
                  const route = techPhase(t) === "route";
                  return (
                    <g key={`${h.id}-${t.id}`} style={{ pointerEvents: "none" }}>
                      {route ? (
                        <>
                          <path d={path} className="twin-route" style={{ stroke: "var(--st-maint)", strokeWidth: 1.4, strokeDasharray: "4 3", fill: "none" }} />
                          <circle r={4.5} style={{ fill: "var(--st-maint)", stroke: "var(--twin-text)", strokeWidth: 1.2 }}><animateMotion dur="3s" repeatCount="indefinite" path={path} /></circle>
                        </>
                      ) : (
                        <circle cx={door[0]} cy={door[1]} r={4.5} style={{ fill: "var(--st-maint)", stroke: "var(--twin-text)", strokeWidth: 1.2 }} />
                      )}
                    </g>
                  );
                }))}
              </svg>
            </div>
          </div>
          <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-xl border border-twin-line bg-twin-panel/90 p-1 backdrop-blur">
            {[{ l: "Acercar", i: Plus, f: () => setZoom((z) => Math.min(3, z * 1.25)) }, { l: "Alejar", i: Minus, f: () => setZoom((z) => Math.max(0.6, z * 0.8)) }, { l: "Ver todos", i: Maximize2, f: () => { setZoom(1); setOff({ x: 0, y: 0 }); } }].map(({ l, i: I, f }) => (
              <button key={l} onClick={f} aria-label={l} title={l} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-twin-line/60"><I className="h-4 w-4" /></button>
            ))}
          </div>
        </div>

        <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          {selItem ? (
            <div className="rounded-2xl border bg-card p-5">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"><Building2 className="h-3.5 w-3.5" />{selItem.h.city} · {selItem.h.category}</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">{selItem.h.name}</div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[["Plantas", selItem.s.floors], ["Habitaciones", selItem.s.rooms], ["Ocupación", `${selItem.s.rooms ? Math.round((selItem.s.occupied / selItem.s.rooms) * 100) : 0}%`], ["Listas", selItem.s.ready], ["Pendientes", selItem.s.pending], ["Incidencias", selItem.s.incidents]].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-muted/60 px-2 py-2.5"><div className="tnum text-lg font-semibold">{v}</div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</div></div>
                ))}
              </div>
              {(selItem.h.zones?.length ?? 0) > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{selItem.h.zones!.map((z) => <span key={z} className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">{z}</span>)}</div>}
              <Button className="mt-4 w-full" onClick={() => enter(selItem.h.id)}>Entrar en el hotel<ArrowRight className="ml-1.5 h-4 w-4" /></Button>
            </div>
          ) : null}
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"><Wrench className="h-3.5 w-3.5" />Base de mantenimiento</div>
            {allTechs.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Todo el equipo técnico está en la base. Sin desplazamientos activos.</p> : (
              <ul className="mt-3 space-y-2 text-sm">
                {allTechs.map(({ t, hotel }) => (
                  <li key={t.id} className="flex items-start gap-2"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-st-maint" />
                    <span><b className="font-medium">{t.assignee}</b> {techPhase(t) === "route" ? "en camino a" : "trabajando en"} {hotel} · hab. {t.room} <span className="text-muted-foreground">({t.category.toLowerCase()})</span></span></li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
