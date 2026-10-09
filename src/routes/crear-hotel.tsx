import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSuite } from "@/lib/suite/store";
import { DEPT_OPTIONS, ZONE_OPTIONS, type Floor, type Room } from "@/lib/suite/data";

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

function Builder() {
  const { actions, org, user } = useSuite();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [h, setH] = useState({ name: "", category: "4★", address: "", city: org?.city ?? "", description: "", checkIn: "14:00", checkOut: "12:00" });
  const [floors, setFloors] = useState(3);
  const [perFloor, setPerFloor] = useState(8);
  const [mix, setMix] = useState([50, 30, 15, 5]);
  const [zones, setZones] = useState<string[]>(["Recepción", "Lobby", "Restaurante", "Mantenimiento"]);
  const [depts, setDepts] = useState<string[]>(["Recepción", "Housekeeping", "Mantenimiento", "Dirección"]);

  const floorList: Floor[] = useMemo(() => Array.from({ length: floors }, (_, i) => ({ number: i + 1, name: `Planta ${i + 1}` })), [floors]);
  const rooms: Room[] = useMemo(() => {
    const total = mix.reduce((a, b) => a + b, 0) || 1;
    const out: Room[] = [];
    floorList.forEach((fl) => {
      for (let i = 0; i < perFloor; i++) {
        const pct = (i / perFloor) * 100;
        let acc = 0, t = 0;
        for (let k = 0; k < mix.length; k++) { acc += (mix[k]! / total) * 100; if (pct < acc) { t = k; break; } t = k; }
        const T = TYPES[t]!;
        out.push({ number: `${fl.number}${String(i + 1).padStart(2, "0")}`, floor: fl.number, type: T.type, rate: T.rate, hk: "clean", oos: false, x: Math.floor(i / 2), side: i % 2 ? "right" : "left" });
      }
    });
    return out;
  }, [floorList, perFloor, mix]);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const canNext = step !== 0 || (h.name.trim() && h.city.trim());

  const build = () => {
    actions.createHotel({ ...h, floors: floorList, rooms, zones, departments: depts });
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
