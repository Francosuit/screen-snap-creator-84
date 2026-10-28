import { FACADE_PRIMARY, FACADE_SECONDARY, facadeVars, type Facade } from "@/lib/suite/facade";
import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSuite } from "@/lib/suite/store";
import { BATH_OPTIONS, BED_KINDS, DEPT_OPTIONS, OCCUPANCY, ROOM_EXTRAS, WINDOW_SIDES, ZONE_OPTIONS, bedSleeps, bedsText, parseBeds, type Floor, type Room, type TypeDetail, type WindowSide } from "@/lib/suite/data";

export const Route = createFileRoute("/crear-hotel")({
  head: () => ({
    meta: [
      { title: "Construye tu hotel — Suite Hotel OS" },
      { name: "description", content: "Asistente paso a paso para construir tu hotel digital: plantas, habitaciones y zonas." },
      { property: "og:title", content: "Construye tu hotel — Suite Hotel OS" },
      { property: "og:description", content: "Configura tu hotel y míralo cobrar vida en tiempo real." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Builder,
});

const STEPS = ["Hotel", "Plantas", "Habitaciones", "Zonas", "Resumen"];
const TYPES = [
  { type: "Doble Estándar", rate: 120 }, { type: "Doble Superior", rate: 150 },
  { type: "Junior Suite", rate: 210 }, { type: "Suite", rate: 290 },
];
const DEFAULT_DETAIL: Record<string, TypeDetail & { rate: number }> = {
  "Doble Estándar": { rate: 120, capacity: 2, beds: "1 doble", bath: "Ducha", window: "fondo", sqm: 22, extras: ["Escritorio", "Aire acondicionado", "Smart TV"] },
  "Doble Superior": { rate: 150, capacity: 2, beds: "1 king", bath: "Ducha", window: "fondo", sqm: 26, extras: ["Escritorio", "Aire acondicionado", "Smart TV", "Minibar", "Caja fuerte"] },
  "Junior Suite": { rate: 210, capacity: 3, beds: "1 king + 1 sofá cama", bath: "Bañera", window: "fondo", sqm: 34, extras: ["Escritorio", "Sofá", "Aire acondicionado", "Smart TV", "Minibar", "Cafetera", "Caja fuerte"] },
  Suite: { rate: 290, capacity: 4, beds: "1 king + 2 individuales", bath: "Ducha + bañera", window: "fondo", sqm: 48, extras: ["Escritorio", "Sofá", "Aire acondicionado", "Smart TV", "Minibar", "Cafetera", "Caja fuerte", "Bañera de hidromasaje"] },
};

function TypeDetailCard({ type, d, onChange }: { type: string; d: TypeDetail & { rate: number }; onChange: (d: TypeDetail & { rate: number }) => void }) {
  const beds = parseBeds(d.beds);
  const sleeps = bedSleeps(beds);
  const sel = "h-9 w-full rounded-md border bg-background px-2 text-sm";
  return (
    <details className="rounded-lg border p-3">
      <summary className="cursor-pointer text-sm font-medium">{type} <span className="font-normal text-muted-foreground">· {d.capacity} pers. · {d.beds} · {d.bath} · {WINDOW_SIDES.find((w) => w.v === d.window)?.label} · {d.rate} €</span></summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs">Tarifa por noche (€)<Input type="number" min={1} value={d.rate} onChange={(e) => onChange({ ...d, rate: Math.max(1, Number(e.target.value) || 1) })} /></label>
        <label className="space-y-1 text-xs">Superficie (m²)<Input type="number" min={5} value={d.sqm} onChange={(e) => onChange({ ...d, sqm: Math.max(5, Number(e.target.value) || 5) })} /></label>
        <div className="space-y-1 text-xs sm:col-span-2">Ocupación
          <div className="flex flex-wrap gap-1">{OCCUPANCY.map((o) => <Button key={o.n} type="button" size="sm" variant={d.capacity === o.n ? "default" : "outline"} onClick={() => onChange({ ...d, capacity: o.n })}>{o.label}</Button>)}</div>
        </div>
        <div className="space-y-1 text-xs sm:col-span-2">Camas · duermen {sleeps}{sleeps < d.capacity && <span className="text-destructive"> · no alcanzan para {d.capacity}</span>}
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">{BED_KINDS.map((k) => { const n = beds[k.key] ?? 0; const set = (v: number) => onChange({ ...d, beds: bedsText({ ...beds, [k.key]: Math.max(0, Math.min(6, v)) }) }); return (
            <div key={k.key} className="flex items-center justify-between rounded-md border px-2 text-sm"><span className="capitalize">{k.one}</span>
              <span className="flex items-center"><Button type="button" size="sm" variant="ghost" aria-label={`Quitar ${k.one} en ${type}`} onClick={() => set(n - 1)}>−</Button><b className="w-4 text-center">{n}</b><Button type="button" size="sm" variant="ghost" aria-label={`Añadir ${k.one} en ${type}`} onClick={() => set(n + 1)}>+</Button></span>
            </div>); })}</div>
        </div>
        <label className="space-y-1 text-xs">Baño<select className={sel} value={d.bath} onChange={(e) => onChange({ ...d, bath: e.target.value })}>{BATH_OPTIONS.map((b) => <option key={b}>{b}</option>)}</select></label>
        <label className="space-y-1 text-xs">Ventana<select className={sel} value={d.window} onChange={(e) => onChange({ ...d, window: e.target.value as WindowSide })}>{WINDOW_SIDES.map((w) => <option key={w.v} value={w.v}>{w.label}</option>)}</select></label>
        <div className="space-y-1 text-xs sm:col-span-2">Equipamiento
          <div className="flex flex-wrap gap-1">{ROOM_EXTRAS.map((x) => { const on = d.extras.includes(x); return <Button key={x} type="button" size="sm" variant={on ? "default" : "outline"} onClick={() => onChange({ ...d, extras: on ? d.extras.filter((y) => y !== x) : [...d.extras, x] })}>{x}</Button>; })}</div>
        </div>
      </div>
    </details>
  );
}

function Swatches({ label, options, value, onChange }: { label: string; options: readonly { label: string; v: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5 text-xs text-muted-foreground">{label}
      <div className="flex flex-wrap gap-2">{options.map((o) => (
        <button key={o.v} type="button" title={o.label} aria-label={`${label}: ${o.label}`} aria-pressed={value === o.v} onClick={() => onChange(o.v)}
          className={`h-8 w-8 rounded-full border-2 ring-offset-2 ring-offset-background transition ${value === o.v ? "border-foreground ring-2 ring-brand" : "border-border"}`} style={{ background: o.v }} />
      ))}</div>
    </div>
  );
}

/** Small isometric preview using the same facade variables as the real building */
function FacadePreview({ facade, floors }: { facade: Facade; floors: number }) {
  const fh = 18, h = floors * fh, top = 150 - h;
  return (
    <svg viewBox="0 0 180 190" className="h-44 w-full rounded-md bg-twin-bg" style={facadeVars(facade)} role="img" aria-label="Vista previa del edificio">
      <polygon points={`90,${top - 30} 160,${top} 90,${top + 30} 20,${top}`} style={{ fill: "var(--fac-stone-top)", stroke: "var(--fac-trim)" }} />
      <polygon points={`20,${top} 90,${top + 30} 90,${top + 30 + h} 20,${top + h}`} style={{ fill: "var(--fac-stone)" }} />
      <polygon points={`90,${top + 30} 160,${top} 160,${top + h} 90,${top + 30 + h}`} style={{ fill: "var(--fac-stone-side)" }} />
      {Array.from({ length: floors }).flatMap((_, f) => [0, 1, 2].map((k) => {
        const x = 28 + k * 21, y = top + f * fh + 5 + (x - 20) * 30 / 70;
        return <polygon key={`${f}-${k}`} points={`${x},${y} ${x + 12},${y + 5} ${x + 12},${y + 15} ${x},${y + 10}`} style={{ fill: "var(--fac-glass)", stroke: "var(--fac-trim)", strokeWidth: 1.5 }} />;
      }))}
    </svg>
  );
}

function Builder() {
  const { actions, org, user } = useSuite();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [h, setH] = useState({ name: "", category: "4★", address: "", city: org?.city ?? "", description: "", checkIn: "14:00", checkOut: "12:00" });
  const [floors, setFloors] = useState(3);
  const [facade, setFacade] = useState<Facade>({ primary: FACADE_PRIMARY[0].v, secondary: FACADE_SECONDARY[0].v });
  const [perFloor, setPerFloor] = useState(8);
  const [custom, setCustom] = useState<Record<number, number>>({});
  const countFor = (n: number) => custom[n] ?? perFloor;
  const [details, setDetails] = useState(DEFAULT_DETAIL);
  const [mix, setMix] = useState([50, 30, 15, 5]);
  const [zones, setZones] = useState<string[]>(["Recepción", "Lobby", "Restaurante", "Mantenimiento"]);
  const [depts, setDepts] = useState<string[]>(["Recepción", "Housekeeping", "Mantenimiento", "Dirección"]);

  const floorList: Floor[] = useMemo(() => Array.from({ length: floors }, (_, i) => ({ number: i + 1, name: `Planta ${i + 1}` })), [floors]);
  const rooms: Room[] = useMemo(() => {
    const total = mix.reduce((a, b) => a + b, 0) || 1;
    const out: Room[] = [];
    floorList.forEach((fl) => {
      const count = custom[fl.number] ?? perFloor;
      for (let i = 0; i < count; i++) {
        const pct = (i / count) * 100;
        let acc = 0, t = 0;
        for (let k = 0; k < mix.length; k++) { acc += (mix[k]! / total) * 100; if (pct < acc) { t = k; break; } t = k; }
        const T = TYPES[t]!; const D = details[T.type]!;
        out.push({ number: `${fl.number}${String(i + 1).padStart(2, "0")}`, floor: fl.number, type: T.type, rate: D.rate, capacity: D.capacity, beds: D.beds, bath: D.bath, window: D.window, sqm: D.sqm, extras: D.extras, hk: "clean", oos: false, x: Math.floor(i / 2), side: i % 2 ? "right" : "left" });
      }
    });
    return out;
  }, [floorList, perFloor, mix, custom, details]);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const canNext = step !== 0 || (h.name.trim() && h.city.trim());

  const build = () => {
    actions.createHotel({ ...h, floors: floorList, rooms, zones, departments: depts, facade });
    actions.setSim(true);
    navigate({ to: "/hotel" });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-muted-foreground">{user ? `Hola ${user.name} · ${org?.name ?? ""}` : "Suite Hotel OS"}</p>
        <h1 className="mt-1 text-3xl font-semibold">Vamos a construir tu hotel</h1>

        <ol className="mt-6 flex flex-wrap gap-2">
          {STEPS.map((s, i) => (
            <li key={s} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${i === step ? "border-primary bg-primary text-primary-foreground" : i < step ? "border-primary text-primary" : "text-muted-foreground"}`}>
              {i < step ? <Check className="h-3.5 w-3.5" /> : <span>{i + 1}</span>}{s}
            </li>
          ))}
        </ol>

        <div className="mt-8 rounded-xl border bg-card p-6">
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1.5"><Label>Nombre del hotel</Label><Input value={h.name} onChange={(e) => setH({ ...h, name: e.target.value })} placeholder="Hotel Mirador" /></div>
              <div className="space-y-1.5"><Label>Categoría</Label>
                <div className="flex gap-2">{["2★", "3★", "4★", "5★"].map((c) => <Button key={c} size="sm" variant={h.category === c ? "default" : "outline"} onClick={() => setH({ ...h, category: c })}>{c}</Button>)}</div>
              </div>
              <div className="space-y-1.5"><Label>Ciudad</Label><Input value={h.city} onChange={(e) => setH({ ...h, city: e.target.value })} /></div>
              <div className="sm:col-span-2 space-y-1.5"><Label>Dirección</Label><Input value={h.address} onChange={(e) => setH({ ...h, address: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Hora check-in</Label><Input type="time" value={h.checkIn} onChange={(e) => setH({ ...h, checkIn: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Hora check-out</Label><Input type="time" value={h.checkOut} onChange={(e) => setH({ ...h, checkOut: e.target.value })} /></div>
              <div className="sm:col-span-2 grid gap-4 rounded-lg border p-4 sm:grid-cols-[1fr_180px]">
                <div className="space-y-3">
                  <Label>Identidad del edificio</Label>
                  <Swatches label="Fachada" options={FACADE_PRIMARY} value={facade.primary} onChange={(v) => setFacade({ ...facade, primary: v })} />
                  <Swatches label="Marcos y detalles" options={FACADE_SECONDARY} value={facade.secondary} onChange={(v) => setFacade({ ...facade, secondary: v })} />
                  <p className="text-xs text-muted-foreground">Solo cambia el aspecto del edificio. Los colores de estado de las habitaciones no cambian.</p>
                </div>
                <FacadePreview facade={facade} floors={Math.min(Math.max(floors, 1), 6)} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <Label>¿Cuántas plantas con habitaciones tiene tu hotel?</Label>
              <div className="flex items-center gap-4">
                <Input type="number" min={1} max={12} className="w-28" value={floors} onChange={(e) => setFloors(Math.max(1, Math.min(12, Number(e.target.value) || 1)))} />
                <span className="text-muted-foreground">plantas (1–12)</span>
              </div>
              <div className="flex flex-col-reverse gap-1">
                {floorList.map((f) => <div key={f.number} className="rounded-md border bg-muted px-3 py-2 text-sm">{f.name}</div>)}
                <div className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">Planta baja · zonas comunes</div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <Label>Habitaciones por planta</Label>
                <Input type="number" min={2} max={20} className="w-28" value={perFloor} onChange={(e) => setPerFloor(Math.max(2, Math.min(20, Number(e.target.value) || 2)))} />
                <span className="text-xs text-muted-foreground">Valor para todas las plantas; ajústalo en cada una abajo.</span>
              </div>
              <div className="space-y-2">
                <Label>Habitaciones en cada planta</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {floorList.map((fl) => (
                    <div key={fl.number} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
                      <span>{fl.name}{custom[fl.number] === 0 && <span className="text-muted-foreground"> · sin habitaciones</span>}</span>
                      <span className="flex items-center gap-1">
                        <Button type="button" size="sm" variant="ghost" aria-label={`Quitar habitación en ${fl.name}`} onClick={() => setCustom({ ...custom, [fl.number]: Math.max(0, countFor(fl.number) - 1) })}>−</Button>
                        <Input type="number" min={0} max={40} aria-label={`Habitaciones en ${fl.name}`} className="h-8 w-16 text-center" value={countFor(fl.number)} onChange={(e) => setCustom({ ...custom, [fl.number]: Math.max(0, Math.min(40, Number(e.target.value) || 0)) })} />
                        <Button type="button" size="sm" variant="ghost" aria-label={`Añadir habitación en ${fl.name}`} onClick={() => setCustom({ ...custom, [fl.number]: Math.min(40, countFor(fl.number) + 1) })}>+</Button>
                      </span>
                    </div>
                  ))}
                </div>
                {Object.keys(custom).length > 0 && <Button type="button" size="sm" variant="link" className="px-0" onClick={() => setCustom({})}>Usar el mismo número en todas</Button>}
              </div>
              <div className="space-y-3">
                <Label>Reparto de tipos (%)</Label>
                {TYPES.map((t, i) => (
                  <div key={t.type} className="flex items-center gap-3">
                    <span className="w-36 text-sm">{t.type}</span>
                    <input type="range" min={0} max={100} value={mix[i]} onChange={(e) => setMix(mix.map((m, k) => (k === i ? Number(e.target.value) : m)))} className="flex-1 accent-primary" />
                    <span className="w-10 text-right text-sm text-muted-foreground">{mix[i]}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Label>Detalle de cada tipo</Label>
                <p className="text-xs text-muted-foreground">Se aplica a todas las habitaciones de ese tipo. Después puedes ajustar cada habitación por separado desde su ficha.</p>
                {TYPES.map((t) => <TypeDetailCard key={t.type} type={t.type} d={details[t.type]!} onChange={(d) => setDetails({ ...details, [t.type]: d })} />)}
              </div>
              <p className="text-sm text-muted-foreground">Suite generará <b className="text-foreground">{rooms.length} habitaciones</b>: {rooms[0]?.number}–{rooms[rooms.length - 1]?.number}.</p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div><Label>Zonas del hotel</Label>
                <div className="mt-2 flex flex-wrap gap-2">{ZONE_OPTIONS.map((z) => <Button key={z} size="sm" variant={zones.includes(z) ? "default" : "outline"} onClick={() => toggle(zones, setZones, z)}>{z}</Button>)}</div>
              </div>
              <div><Label>Departamentos</Label>
                <div className="mt-2 flex flex-wrap gap-2">{DEPT_OPTIONS.map((d) => <Button key={d} size="sm" variant={depts.includes(d) ? "default" : "outline"} onClick={() => toggle(depts, setDepts, d)}>{d}</Button>)}</div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3 text-sm">
              <h2 className="text-xl font-semibold">{h.name} <span className="text-muted-foreground">{h.category}</span></h2>
              <p className="text-muted-foreground">{h.address} {h.city}</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                <li className="rounded-md bg-muted p-3"><b>{floors}</b> plantas</li>
                <li className="rounded-md bg-muted p-3"><b>{rooms.length}</b> habitaciones</li>
                <li className="rounded-md bg-muted p-3"><b>{zones.length}</b> zonas</li>
                <li className="rounded-md bg-muted p-3"><b>{depts.length}</b> departamentos</li>
              </ul>
              <p className="text-muted-foreground">Al construir, Suite crea todo y activa la vista en vivo de tu hotel.</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-between">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>Atrás</Button>
          {step < STEPS.length - 1
            ? <Button disabled={!canNext} onClick={() => setStep(step + 1)}>Continuar</Button>
            : <Button size="lg" onClick={build}><Sparkles className="mr-2 h-4 w-4" />Construir mi hotel digital</Button>}
        </div>
      </div>
    </div>
  );
}
