import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Minus, Plus, RotateCw, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Room, RoomState } from "@/lib/suite/data";
import { ROOM_STATE } from "@/components/suite/ui";
import {
  FLOOR_GAP, ROOM_H, SLAB, STATE_VAR, STATUS_LAYER, box, center, pts, rotRect,
  type HotelLayout, type Pt, type Rect, type TwinLayer,
} from "./geometry";

/** Staff shown inside the twin: derived from incident/task state, never stored as coordinates */
export interface StaffMarker { id: string; name: string; room: string; phase: "route" | "onsite" }
export interface RoomInfo { state: RoomState; guest?: string | undefined; type: string; capacity?: number | undefined }

interface Props {
  layout: HotelLayout;
  info: (room: Room) => RoomInfo;
  focusFloor: number | null;
  selected?: string | null | undefined;
  onSelect?: (room: string) => void;
  layer?: TwinLayer;
  compact?: boolean;
  className?: string;
  toolbar?: ReactNode;
  staff?: StaffMarker[];
}

type Shape =
  | { k: "poly"; key: string; p: Pt[]; fill: string; stroke?: string; sw?: number; op?: number; glow?: boolean }
  | { k: "text"; key: string; at: Pt; text: string; size: number; fill: string; weight?: number; anchor?: "start" | "middle" }
  | { k: "anchor"; key: string; floor: number; at: Pt }
  | { k: "room"; key: string; room: Room; faces: ReturnType<typeof box>; win: Pt[]; info: RoomInfo; topC: Pt; markAt: Pt; size: number };

const mix = (c: string, pct: number, base = "var(--twin-slab)") => `color-mix(in oklab, ${c} ${pct}%, ${base})`;

export function IsoBuilding({ layout, info, focusFloor, selected, onSelect, layer = STATUS_LAYER, compact, className, toolbar, staff = [] }: Props) {
  const [rot, setRot] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<{ room: Room; x: number; y: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null);
  const view = useRef({ zoom, off });
  view.current = { zoom, off };

  const U = focusFloor != null ? 34 : compact ? 15 : 20;
  const W = focusFloor == null ? layout.GW : layout.W, D = focusFloor == null ? layout.GD : layout.D;
  const RW_ = rot % 2 ? D : W, RD_ = rot % 2 ? W : D;
  const R = (r: Rect) => rotRect(r, rot, W, D);

  const shapes = useMemo(() => {
    const out: Shape[] = [];
    const floors = layout.floors.filter((f) => focusFloor == null || f.floor.number === focusFloor);
    const showLabels = focusFloor != null || !compact;
    // ground plate
    const g = box({ x: -1.2, y: -1.2, w: RW_ + 2.4, d: RD_ + 2.4 }, -0.5, 0.06, U);
    out.push({ k: "poly", key: "ground", p: g.top, fill: "var(--twin-panel)", stroke: "var(--twin-line)", sw: 0.6, op: 0.7 });

    if (focusFloor == null) {
      layout.outdoor.forEach((o, i) => {
        const b = box(R(o.rect), -0.44, o.h, U);
        out.push({ k: "poly", key: `oz${i}e`, p: b.east, fill: mix(o.tone, 35, "var(--twin-slab-side)") });
        out.push({ k: "poly", key: `oz${i}s`, p: b.south, fill: mix(o.tone, 45, "var(--twin-slab-side)") });
        out.push({ k: "poly", key: `oz${i}t`, p: b.top, fill: mix(o.tone, 55), stroke: o.tone, sw: 0.8 });
        out.push({ k: "text", key: `oz${i}l`, at: center(b.top), text: o.label.toUpperCase(), size: compact ? 7 : 9, fill: "var(--twin-text)", weight: 600, anchor: "middle" });
      });
    }
    const slabRect = R({ x: 0, y: 0, w: layout.W, d: layout.D });
    floors.forEach((fl, i) => {
      const z = focusFloor != null ? 0 : i * FLOOR_GAP;
      const slab = box(slabRect, z - SLAB, SLAB, U);
      const f = fl.floor.number;
      out.push({ k: "poly", key: `s${f}e`, p: slab.east, fill: "var(--twin-slab-side)" });
      out.push({ k: "poly", key: `s${f}s`, p: slab.south, fill: "var(--twin-slab-side)" });
      out.push({ k: "poly", key: `s${f}t`, p: slab.top, fill: "var(--twin-slab)", stroke: "var(--twin-line)", sw: 0.6 });
      const cor = box(R(fl.corridor), z, 0.01, U);
      out.push({ k: "poly", key: `c${f}`, p: cor.top, fill: "var(--twin-floor)", op: 0.8 });
      if (focusFloor != null) out.push({ k: "text", key: `ct${f}`, at: center(cor.top), text: "PASILLO", size: U * 0.3, fill: "var(--twin-muted)", anchor: "middle" });
      // floor label at west-most slab corner
      const west = slab.top.reduce((a, p) => (p[0] < a[0] ? p : a));
      out.push({ k: "text", key: `fl${f}`, at: [west[0] - 10, west[1] + 4], text: `P${f}`, size: compact ? 10 : 12, fill: "var(--twin-muted)", weight: 600, anchor: "middle" });

      type Item = { depth: number; draw: () => void };
      const items: Item[] = [];
      const service = (r: Rect, h: number, label: string, key: string, tone: string) => {
        const rr = R(r);
        items.push({
          depth: rr.x + rr.y + rr.w / 2 + rr.d / 2,
          draw: () => {
            const b = box(rr, z, h, U);
            out.push({ k: "poly", key: `${key}e`, p: b.east, fill: "var(--twin-wall-dark)" });
            out.push({ k: "poly", key: `${key}s`, p: b.south, fill: "var(--twin-wall)" });
            out.push({ k: "poly", key: `${key}t`, p: b.top, fill: tone, stroke: "var(--twin-line)", sw: 0.6 });
            if (focusFloor != null) out.push({ k: "text", key: `${key}l`, at: center(b.top), text: label, size: U * 0.28, fill: "var(--twin-muted)", anchor: "middle" });
          },
        });
      };
      service(fl.elevator, ROOM_H, "ASCENSORES", `el${f}`, "var(--twin-floor)");
      out.push({ k: "anchor", key: `an${f}`, floor: f, at: center(box(R(fl.elevator), z, ROOM_H, U).top) });
      service(fl.stairs, ROOM_H * 0.7, "ESCALERAS", `st${f}`, "var(--twin-floor)");
      service(fl.common, 0.35, fl.commonLabel.toUpperCase(), `cm${f}`, mix("var(--brand)", 18));

      fl.rooms.forEach(({ room, rect }) => {
        const rr = R(rect);
        items.push({
          depth: rr.x + rr.y + rr.w / 2 + rr.d / 2,
          draw: () => {
            const faces = box(rr, z, ROOM_H, U);
            const s = faces.south;
            // window strip on the front wall
            const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
            const bl = lerp(s[0]!, s[3]!, 0.45), br = lerp(s[1]!, s[2]!, 0.45), tr = lerp(s[1]!, s[2]!, 0.82), tl = lerp(s[0]!, s[3]!, 0.82);
            const win: Pt[] = [lerp(bl, br, 0.15), lerp(bl, br, 0.85), lerp(tl, tr, 0.85), lerp(tl, tr, 0.15)];
            const topC = center(faces.top);
            out.push({ k: "room", key: `r${room.number}`, room, faces, win, info: info(room), topC, markAt: [topC[0], topC[1] - U * 0.9], size: showLabels ? U * 0.42 : 0 });
          },
        });
      });
      items.sort((a, b) => a.depth - b.depth).forEach((it) => it.draw());
    });
    return out;
  }, [layout, focusFloor, rot, U, compact, info, RW_, RD_]);

  const vb = useMemo(() => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const eat = (p: Pt[]) => p.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
    shapes.forEach((s) => (s.k === "poly" ? eat(s.p) : s.k === "room" ? eat([...s.faces.top, ...s.faces.south, ...s.faces.east, s.markAt]) : eat([s.at])));
    const pad = 24;
    return `${x0 - pad} ${y0 - pad} ${x1 - x0 + pad * 2} ${y1 - y0 + pad * 2}`;
  }, [shapes]);

  // wheel zoom anchored at cursor (non-passive listener)
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { zoom: z, off: o } = view.current;
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const next = Math.min(3, Math.max(0.6, z * Math.exp(-dy * 0.0015)));
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top, k = next / z;
      setZoom(next);
      setOff({ x: px - (px - o.x) * k, y: py - (py - o.y) * k });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = (f: number) => {
    const el = wrap.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = Math.min(3, Math.max(0.6, zoom * f));
    const px = rect.width / 2, py = rect.height / 2, k = next / zoom;
    setZoom(next);
    setOff({ x: px - (px - off.x) * k, y: py - (py - off.y) * k });
  };
  const reset = () => { setZoom(1); setOff({ x: 0, y: 0 }); setRot(0); };

  const hoverInfo = hover ? info(hover.room) : null;

  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-twin-bg", className)}>
      <div
        ref={wrap}
        className="h-full w-full touch-none select-none"
        style={{ cursor: drag.current ? "grabbing" : "grab" }}
        onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y, moved: false }; }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d && e.buttons) {
            const dx = e.clientX - d.x, dy = e.clientY - d.y;
            if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
            if (d.moved) setOff({ x: d.ox + dx, y: d.oy + dy });
          }
        }}
        onPointerUp={() => { setTimeout(() => (drag.current = null), 0); }}
        onPointerLeave={() => { drag.current = null; setHover(null); }}
      >
        <div style={{ transform: `translate(${off.x}px, ${off.y}px) scale(${zoom})`, transformOrigin: "0 0" }} className="h-full w-full">
          <svg viewBox={vb} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
            <defs>
              <filter id="twin-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" /></filter>
            </defs>
            {shapes.map((s) => {
              if (s.k === "anchor") return null;
              if (s.k === "poly") return <polygon key={s.key} points={pts(s.p)} style={{ fill: s.fill, stroke: s.stroke ?? "none", strokeWidth: s.sw ?? 0, opacity: s.op ?? 1 }} />;
              if (s.k === "text") return <text key={s.key} x={s.at[0]} y={s.at[1]} textAnchor={s.anchor ?? "start"} dominantBaseline="middle" style={{ fill: s.fill, fontSize: s.size, fontWeight: s.weight ?? 500, letterSpacing: "0.08em", fontFamily: "var(--font-sans)" }}>{s.text}</text>;
              const c = STATE_VAR[s.info.state];
              const sel = selected === s.room.number;
              const dim = selected && !sel;
              const badge = layer.badge(s.room, s.info.state);
              const lit = s.info.state === "occupied";
              return (
                <g key={s.key} className="twin-room" style={{ opacity: dim ? 0.55 : 1 }}
                  onPointerEnter={(e) => { const r = wrap.current!.getBoundingClientRect(); setHover({ room: s.room, x: e.clientX - r.left, y: e.clientY - r.top }); }}
                  onPointerMove={(e) => { const r = wrap.current!.getBoundingClientRect(); setHover({ room: s.room, x: e.clientX - r.left, y: e.clientY - r.top }); }}
                  onPointerLeave={() => setHover(null)}
                  onClick={() => { if (!drag.current?.moved) onSelect?.(s.room.number); }}
                >
                  <polygon points={pts(s.faces.east)} style={{ fill: "var(--twin-wall-dark)" }} />
                  <polygon points={pts(s.faces.south)} style={{ fill: "var(--twin-wall)" }} />
                  <polygon points={pts(s.win)} style={{ fill: c, opacity: lit ? 0.9 : 0.55 }} filter="url(#twin-glow)" />
                  <polygon points={pts(s.win)} style={{ fill: lit ? mix(c, 60, "white") : c, opacity: lit ? 1 : 0.75 }} />
                  <polygon points={pts(s.faces.top)} style={{ fill: mix(c, sel ? 70 : 42), stroke: sel ? "var(--twin-text)" : c, strokeWidth: sel ? 2 : 1 }} />
                  {s.size > 0 && (
                    <text x={s.topC[0]} y={s.topC[1]} textAnchor="middle" dominantBaseline="middle" style={{ fill: "var(--twin-text)", fontSize: s.size, fontWeight: 600, fontFamily: "var(--font-sans)", pointerEvents: "none" }}>{s.room.number}</text>
                  )}
                  {badge && (
                    <g style={{ pointerEvents: "none" }}>
                      <line x1={s.topC[0]} y1={s.topC[1] - 2} x2={s.markAt[0]} y2={s.markAt[1]} style={{ stroke: badge.color, strokeWidth: 1, opacity: 0.7 }} />
                      {badge.pulse && <circle cx={s.markAt[0]} cy={s.markAt[1]} r={3.5} className="twin-pulse" style={{ fill: badge.color }} />}
                      <circle cx={s.markAt[0]} cy={s.markAt[1]} r={3.5} style={{ fill: badge.color, stroke: "var(--twin-bg)", strokeWidth: 1.2 }} />
                    </g>
                  )}
                </g>
              );
            })}
            {staff.map((m) => {
              const rs = shapes.find((x) => x.k === "room" && x.room.number === m.room) as Extract<Shape, { k: "room" }> | undefined;
              if (!rs) return null;
              const an = shapes.find((x) => x.k === "anchor" && x.floor === rs.room.floor) as Extract<Shape, { k: "anchor" }> | undefined;
              const to: Pt = [rs.topC[0] + U * 0.35, rs.topC[1] - U * 0.15];
              const from: Pt = an ? an.at : to;
              const r = Math.max(4, U * 0.22);
              return (
                <g key={m.id} style={{ pointerEvents: "none" }}>
                  {m.phase === "route" && (
                    <>
                      <path d={`M${from[0]},${from[1]} L${to[0]},${to[1]}`} style={{ stroke: "var(--st-maint)", strokeWidth: 1.4, strokeDasharray: "4 3", fill: "none" }} className="twin-route" />
                      <circle r={r} style={{ fill: "var(--st-maint)", stroke: "var(--twin-text)", strokeWidth: 1.4 }}>
                        <animateMotion dur="2.4s" repeatCount="indefinite" path={`M${from[0]},${from[1]} L${to[0]},${to[1]}`} />
                      </circle>
                    </>
                  )}
                  {m.phase === "onsite" && (
                    <>
                      <circle cx={to[0]} cy={to[1]} r={r} className="twin-pulse" style={{ fill: "var(--twin-text)" }} />
                      <circle cx={to[0]} cy={to[1]} r={r} style={{ fill: "var(--st-maint)", stroke: "var(--twin-text)", strokeWidth: 1.4 }} />
                    </>
                  )}
                  {(focusFloor != null || !compact) && (
                    <text x={(m.phase === "route" ? (from[0] + to[0]) / 2 : to[0]) + r + 3} y={(m.phase === "route" ? (from[1] + to[1]) / 2 : to[1])} dominantBaseline="middle" style={{ fill: "var(--twin-text)", fontSize: Math.max(8, U * 0.3), fontWeight: 600, fontFamily: "var(--font-sans)" }}>
                      {m.name.split(" ")[0]}{m.phase === "route" ? " · en camino" : ""}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {hover && hoverInfo && (
        <div className="pointer-events-none absolute z-10 w-52 rounded-xl border border-twin-line bg-twin-panel/95 p-3 text-xs text-twin-text shadow-xl backdrop-blur"
          style={{ left: Math.min(hover.x + 14, (wrap.current?.clientWidth ?? 400) - 220), top: Math.max(8, hover.y - 10) }}>
          <div className="text-[10px] uppercase tracking-[0.14em] text-twin-muted">Habitación</div>
          <div className="text-lg font-semibold">{hover.room.number}</div>
          <div className="text-twin-muted">{hoverInfo.type}{hoverInfo.capacity ? ` · ${hoverInfo.capacity} huéspedes` : ""}</div>
          <div className="mt-2 flex items-center gap-1.5 font-medium">
            <span className="h-2 w-2 rounded-full" style={{ background: STATE_VAR[hoverInfo.state] }} />
            {hoverInfo.state === "occupied" ? "IN HOUSE" : ROOM_STATE[hoverInfo.state].label.toUpperCase()}
          </div>
          {hoverInfo.guest && <div className="mt-1 text-twin-muted">Huésped: <span className="text-twin-text">{hoverInfo.guest}</span></div>}
        </div>
      )}

      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-xl border border-twin-line bg-twin-panel/90 p-1 text-twin-text backdrop-blur">
        {toolbar}
        {[
          { l: "Acercar", i: Plus, f: () => zoomBy(1.25) },
          { l: "Alejar", i: Minus, f: () => zoomBy(0.8) },
          { l: "Rotar", i: RotateCw, f: () => setRot((r) => (r + 1) % 4) },
          { l: "Restablecer", i: Maximize2, f: reset },
        ].map(({ l, i: I, f }) => (
          <button key={l} onClick={f} aria-label={l} title={l} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-twin-line/60"><I className="h-4 w-4" /></button>
        ))}
      </div>
    </div>
  );
}

export function TwinLegend({ className, counts }: { className?: string; counts?: Partial<Record<RoomState, number>> }) {
  return (
    <div className={cn("flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-twin-muted", counts && "gap-2", className)}>
      {(Object.keys(STATE_VAR) as RoomState[]).map((k) => (
        <span key={k} className={cn("flex items-center gap-1.5", counts && "rounded-full border border-twin-wall px-2.5 py-1", counts && !counts[k] && "opacity-50")}><span className="h-2 w-2 rounded-full" style={{ background: STATE_VAR[k] }} />{k === "occupied" ? "In house" : ROOM_STATE[k].label}{counts && <b className="tnum text-twin-text">{counts[k] ?? 0}</b>}</span>
      ))}
    </div>
  );
}
