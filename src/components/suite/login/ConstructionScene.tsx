import { box, proj, pts, type Pt, type Rect } from "@/components/suite/twin/geometry";

/** Illustrative boutique hotel under construction for the sign-in screen.
 *  Same isometric projection and facade palette as Mi mundo / Hotel en vivo; shows no data. */
const U = 30;
const W = 8, D = 5, FH = 1.05, FLOORS = 5, DONE = 3; // floors 0..2 finished, 3 half clad, 4 bare frame

function Box({ r, z, h, top, side, front, className }: { r: Rect; z: number; h: number; top: string; side: string; front?: string; className?: string }) {
  const b = box(r, z, h, U);
  return (
    <g className={className}>
      <polygon points={pts(b.east)} style={{ fill: side }} />
      <polygon points={pts(b.south)} style={{ fill: front ?? side }} />
      <polygon points={pts(b.top)} style={{ fill: top }} />
    </g>
  );
}
const quad = (a: Pt, b: Pt, c: Pt, d: Pt) => pts([a, b, c, d]);
const S = (x: number, z: number) => proj(x, D, z, U); // south face point
const E = (y: number, z: number) => proj(W, y, z, U); // east face point

export function ConstructionScene({ className = "" }: { className?: string }) {
  const winsS: { x: number; f: number }[] = [];
  const winsE: { y: number; f: number }[] = [];
  for (let f = 0; f < DONE + 1; f++) {
    for (let x = 0.5; x < W - 0.6; x += 1.25) if (f < DONE || x < 4) winsS.push({ x, f });
    for (let y = 0.5; y < D - 0.6; y += 1.2) if (f < DONE) winsE.push({ y, f });
  }
  const lit = (i: number) => i % 3 !== 1; // some windows light up, staggered
  const trees: [number, number, number][] = [[-2.2, 6.2, 1], [10.5, 1.5, 1.2], [11, 4.8, 0.9], [-1.5, 8.5, 1.1], [5.6, 9.4, 0.8]];
  const lamps: [number, number][] = [[1, 6.6], [4, 6.6], [7, 6.6]];
  const [mx, my] = proj(W + 2.2, -1.4, 0, U);
  const [, mtop] = proj(W + 2.2, -1.4, FLOORS * FH + 3.4, U);

  return (
    <svg viewBox="-390 -320 830 580" className={`login-scene ${className}`} role="img" aria-label="Ilustración: hotel boutique en construcción">
      <defs>
        <radialGradient id="ls-glow" cx="50%" cy="60%" r="60%"><stop offset="0" stopColor="var(--login-gold)" stopOpacity="0.18" /><stop offset="1" stopColor="var(--login-gold)" stopOpacity="0" /></radialGradient>
        <radialGradient id="ls-lamp"><stop offset="0" stopColor="var(--int-lamp)" stopOpacity="0.7" /><stop offset="1" stopColor="var(--int-lamp)" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="0" cy="120" rx="360" ry="190" fill="url(#ls-glow)" />
      {/* ground: lawn plot, plaza, path */}
      <polygon points={pts(box({ x: -4, y: -3, w: 17, d: 14 }, -0.3, 0.3, U).top)} style={{ fill: "color-mix(in oklab, var(--fac-grass) 55%, var(--login-night))" }} />
      <Box r={{ x: -4, y: -3, w: 17, d: 14 }} z={-0.3} h={0.3} top="transparent" side="color-mix(in oklab, var(--fac-grass) 30%, var(--login-night))" />
      <polygon points={pts(box({ x: -0.6, y: -0.6, w: W + 1.2, d: D + 2.4 }, 0, 0.02, U).top)} style={{ fill: "var(--fac-stone-top)", opacity: 0.55 }} />
      <polygon points={pts(box({ x: 3.4, y: D + 1.8, w: 1.2, d: 9 - D }, 0, 0.02, U).top)} style={{ fill: "var(--fac-stone-top)", opacity: 0.45 }} />
      {/* site office / secondary building */}
      <Box r={{ x: 10, y: 6.2, w: 2.4, d: 1.6 }} z={0} h={0.9} top="var(--fac-stone-top)" side="var(--fac-stone-side)" front="var(--fac-stone)" />
      <polygon points={quad(proj(10.4, 7.8, 0.3, U), proj(11.6, 7.8, 0.3, U), proj(11.6, 7.8, 0.7, U), proj(10.4, 7.8, 0.7, U))} className="login-win" style={{ animationDelay: "2.4s" }} />
      {/* building floors */}
      {Array.from({ length: FLOORS }, (_, f) => {
        const z = f * FH;
        const frame = f >= DONE + 1;
        return (
          <g key={f} className="login-rise" style={{ animationDelay: `${0.15 * f}s` }}>
            {f === 0 && <Box r={{ x: 0, y: 0, w: W, d: D }} z={0} h={FH} top="var(--fac-stone-top)" side="var(--fac-stone-side)" front="color-mix(in oklab, var(--fac-stone) 88%, var(--login-gold))" />}
            {f > 0 && !frame && <Box r={{ x: 0, y: 0, w: f === DONE ? 4.4 : W, d: D }} z={z} h={FH - 0.08} top="var(--fac-stone-top)" side="var(--fac-stone-side)" front="var(--fac-stone)" />}
            {f === DONE && <Box r={{ x: 4.4, y: 0, w: W - 4.4, d: D }} z={z} h={0.08} top="var(--fac-stone-top)" side="var(--fac-stone-side)" />}
            {(f === DONE || frame) && [0.1, 2.6, 5.2, W - 0.3].flatMap((x) => [0.1, D - 0.3].map((y) => (f === DONE && x < 4) ? null : <Box key={`${x}-${y}`} r={{ x, y, w: 0.2, d: 0.2 }} z={z} h={FH} top="var(--fac-stone-top)" side="var(--fac-stone-side)" front="var(--fac-stone)" />))}
            {f < FLOORS - 1 && /* slab / cornice */ (
            <Box r={{ x: -0.08, y: -0.08, w: W + 0.16, d: D + 0.16 }} z={z + FH - 0.08} h={0.1} top={frame ? "color-mix(in oklab, var(--fac-stone-top) 70%, var(--login-night))" : "var(--fac-stone-top)"} side="var(--fac-trim)" front="color-mix(in oklab, var(--fac-trim) 70%, var(--fac-stone))" />)}
          </g>
        );
      })}
      {/* entrance with gold canopy */}
      <polygon points={quad(S(3.2, 0), S(4.8, 0), S(4.8, 0.78), S(3.2, 0.78))} style={{ fill: "var(--fac-glass)" }} />
      <Box r={{ x: 2.9, y: D, w: 2.2, d: 0.7 }} z={0.82} h={0.06} top="var(--login-gold)" side="color-mix(in oklab, var(--login-gold) 70%, black)" />
      {/* windows + balconies */}
      {winsS.map(({ x, f }, i) => (f === 0 && x > 2.6 && x < 5) ? null : (
        <g key={`s${i}`}>
          <polygon points={quad(S(x, f * FH + 0.22), S(x + 0.8, f * FH + 0.22), S(x + 0.8, f * FH + 0.85), S(x, f * FH + 0.85))} style={{ fill: "var(--fac-glass)", stroke: "var(--fac-trim)", strokeWidth: 1 }} />
          {lit(i) && <polygon points={quad(S(x, f * FH + 0.22), S(x + 0.8, f * FH + 0.22), S(x + 0.8, f * FH + 0.85), S(x, f * FH + 0.85))} className="login-win" style={{ animationDelay: `${(i * 0.37) % 4}s` }} />}
          {f > 0 && <Box r={{ x: x - 0.1, y: D, w: 1, d: 0.35 }} z={f * FH} h={0.04} top="var(--fac-stone-top)" side="var(--fac-trim)" />}
          {f > 0 && <polygon points={quad(proj(x - 0.1, D + 0.35, f * FH + 0.04, U), proj(x + 0.9, D + 0.35, f * FH + 0.04, U), proj(x + 0.9, D + 0.35, f * FH + 0.36, U), proj(x - 0.1, D + 0.35, f * FH + 0.36, U))} style={{ fill: "var(--int-glass)", opacity: 0.35, stroke: "var(--fac-trim)", strokeWidth: 0.6 }} />}
        </g>
      ))}
      {winsE.map(({ y, f }, i) => (
        <g key={`e${i}`}>
          <polygon points={quad(E(y, f * FH + 0.22), E(y + 0.7, f * FH + 0.22), E(y + 0.7, f * FH + 0.85), E(y, f * FH + 0.85))} style={{ fill: "color-mix(in oklab, var(--fac-glass) 70%, black)", stroke: "var(--fac-trim)", strokeWidth: 1 }} />
          {i % 2 === 0 && <polygon points={quad(E(y, f * FH + 0.22), E(y + 0.7, f * FH + 0.22), E(y + 0.7, f * FH + 0.85), E(y, f * FH + 0.85))} className="login-win" style={{ animationDelay: `${(i * 0.53 + 1) % 4}s` }} />}
        </g>
      ))}
      {/* scaffolding on the unfinished corner */}
      <g style={{ stroke: "var(--login-gold)", strokeWidth: 1, opacity: 0.75 }}>
        {[4.6, 5.8, 7, 8.2].map((x) => <line key={x} x1={S(x, DONE * FH)[0]} y1={proj(x, D + 0.5, DONE * FH, U)[1]} x2={S(x, FLOORS * FH)[0]} y2={proj(x, D + 0.5, FLOORS * FH, U)[1]} />)}
        {[0, 0.5, 1, 1.5, 2].map((k) => { const z = DONE * FH + k; const a = proj(4.6, D + 0.5, z, U), b = proj(8.2, D + 0.5, z, U); return <line key={k} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />; })}
        {[0, 1].map((k) => { const a = proj(4.6, D + 0.5, DONE * FH + k, U), b = proj(5.8, D + 0.5, DONE * FH + k + 1, U); return <line key={`d${k}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />; })}
      </g>
      {/* crane */}
      <g style={{ stroke: "var(--login-gold)", strokeWidth: 1.4 }}>
        <line x1={mx - 3} y1={my} x2={mx - 3} y2={mtop} /><line x1={mx + 3} y1={my} x2={mx + 3} y2={mtop} />
        {Array.from({ length: 14 }, (_, k) => { const y0 = my - ((my - mtop) * k) / 14, y1 = my - ((my - mtop) * (k + 1)) / 14; return <line key={k} x1={k % 2 ? mx - 3 : mx + 3} y1={y0} x2={k % 2 ? mx + 3 : mx - 3} y2={y1} strokeWidth={0.6} />; })}
        <g className="login-crane" style={{ transformOrigin: `${mx}px ${mtop}px` }}>
          <line x1={mx + 60} y1={mtop} x2={mx - 210} y2={mtop + 4} />
          <line x1={mx} y1={mtop - 18} x2={mx - 210} y2={mtop + 4} strokeWidth={0.7} />
          <line x1={mx} y1={mtop - 18} x2={mx + 60} y2={mtop} strokeWidth={0.7} />
          <rect x={mx + 40} y={mtop} width={18} height={10} style={{ fill: "var(--fac-trim)", stroke: "none" }} />
          <g className="login-hook"><line x1={mx - 150} y1={mtop + 3} x2={mx - 150} y2={mtop + 70} strokeWidth={0.6} /><rect x={mx - 158} y={mtop + 70} width={16} height={8} style={{ fill: "var(--fac-wood)", stroke: "none" }} /></g>
        </g>
      </g>
      {/* lamps + trees */}
      {lamps.map(([x, y], i) => { const [px, py] = proj(x, y, 0, U); return <g key={i}><circle cx={px} cy={py - 26} r={16} fill="url(#ls-lamp)" /><line x1={px} y1={py} x2={px} y2={py - 26} style={{ stroke: "var(--fac-trim)", strokeWidth: 1.4 }} /><circle cx={px} cy={py - 27} r={2} style={{ fill: "var(--int-lamp)" }} /></g>; })}
      {trees.map(([x, y, s], i) => { const [px, py] = proj(x, y, 0, U); return <g key={i}><line x1={px} y1={py} x2={px} y2={py - 18 * s} style={{ stroke: "var(--fac-wood)", strokeWidth: 2.5 }} /><circle cx={px} cy={py - 26 * s} r={13 * s} style={{ fill: "var(--fac-leaf)" }} /><circle cx={px - 4 * s} cy={py - 30 * s} r={7 * s} style={{ fill: "var(--fac-grass)", opacity: 0.7 }} /></g>; })}
    </svg>
  );
}
