import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dayDate, eur, useSuite } from "@/lib/suite/store";
import { RevenueBoard } from "@/components/suite/RevenueBoard";
import { Card, Kpi, PageHeader, Pill, SectionTitle } from "@/components/suite/ui";

export const Route = createFileRoute("/control")({
  head: () => ({
    meta: [
      { title: "Control · Revenue Intelligence — Suite" },
      { name: "description", content: "Ocupación, ADR, RevPAR, pickup, pace y recomendaciones de revenue explicadas." },
      { property: "og:title", content: "Control · Revenue Intelligence — Suite" },
      { property: "og:description", content: "Revenue recomienda. Una persona decide." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Control,
});

const forecast = Array.from({ length: 21 }, (_, i) => {
  const base = [64, 70, 58, 52, 61, 78, 81, 66, 60, 72, 84, 82, 79, 63, 48, 44, 41, 55, 69, 74, 71][i] ?? 60;
  return { d: dayDate(i).getDate(), dia: dayDate(i).toLocaleDateString("es-ES", { weekday: "short" }), off: i, occ: base, ly: base - 8 + ((i * 7) % 11) - 5 };
});
const pickup = [["L", 3], ["M", 5], ["X", 2], ["J", 7], ["V", 9], ["S", 6], ["D", 4]].map(([d, v]) => ({ d, v }));
const pace = ["Sep", "Oct", "Nov", "Dic", "Ene", "Feb"].map((m, i) => ({ m, actual: [58, 66, 74, 61, 45, 52][i], ly: [55, 62, 63, 59, 47, 49][i] }));
const bookingWindow = [["0–3 d", 18], ["4–7 d", 24], ["8–14 d", 21], ["15–30 d", 19], ["31–60 d", 12], ["60+ d", 6]].map(([k, v]) => ({ k, v }));
const cancels = ["Jun", "Jul", "Ago", "Sep", "Oct", "Nov"].map((m, i) => ({ m, v: [6.2, 7.8, 9.1, 5.4, 4.8, 3.9][i] }));
const bookings = ["S40", "S41", "S42", "S43", "S44", "S45"].map((w, i) => ({ w, v: [21, 24, 19, 28, 33, 37][i] }));

const ax = { fontSize: 11, fill: "var(--muted-foreground)" };
const tip = { contentStyle: { borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 } };

function Chart({ title, children, h = 180 }: { title: string; children: React.ReactElement; h?: number }) {
  return (
    <Card><SectionTitle>{title}</SectionTitle><div style={{ height: h }}><ResponsiveContainer>{children}</ResponsiveContainer></div></Card>
  );
}

function Control() {
  const { s, actions } = useSuite();
  const [open, setOpen] = useState<string | null>(null);
  const o = s.opportunities.find((x) => x.id === open);
  return (
    <div>
      <PageHeader title="Control" sub="Revenue Intelligence · Suite recomienda, una persona decide" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Ocupación (mes)" value="71%" delta="+6 pp" hint="vs. LY" />
        <Kpi label="ADR (mes)" value="162 €" delta="+4,2%" />
        <Kpi label="RevPAR (mes)" value="115 €" delta="+13,1%" />
        <Kpi label="Pickup 7 días" value="+36 rn" delta="+31%" />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Indicadores, calendario y gráficos de abajo: datos de demostración.</p>

      <RevenueBoard />

      <Card className="mt-6">
        <SectionTitle right={<span className="text-xs text-muted-foreground">Próximos 21 días · forecast ocupación</span>}>Calendario Revenue</SectionTitle>
        <div className="grid grid-cols-7 gap-1.5">
          {forecast.map((f) => {
            const opp = f.off >= 7 && f.off <= 9;
            return (
              <button key={f.off} onClick={() => opp && setOpen("O-1")}
                className={cn("rounded-xl border p-2 text-left transition", opp ? "border-brand bg-brand/10 ring-1 ring-brand hover:bg-brand/15" : "bg-background",
                  f.off === 0 && "ring-1 ring-foreground/30")}>
                <div className="text-[10px] uppercase text-muted-foreground">{f.dia} {f.d}</div>
                <div className={cn("tnum text-base font-semibold sm:text-lg", f.occ >= 80 ? "text-brand" : f.occ < 50 ? "text-st-maint" : "")}>{f.occ}%</div>
                <div className="mt-1 h-1 rounded-full bg-muted"><div className={cn("h-1 rounded-full", f.occ >= 80 ? "bg-brand" : f.occ < 50 ? "bg-st-maint" : "bg-foreground/40")} style={{ width: `${f.occ}%` }} /></div>
                {opp && f.off === 7 && <div className="mt-1 hidden text-[10px] font-semibold text-brand sm:block">OPORTUNIDAD ALTA</div>}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="mt-6">
        <SectionTitle>Recomendaciones</SectionTitle>
        <div className="grid gap-3 lg:grid-cols-3">
          {s.opportunities.map((x) => (
            <Card key={x.id} className={cn(x.status !== "nueva" && "opacity-60")}>
              <div className="flex items-center justify-between">
                <Pill className={x.level === "alta" ? "border-brand/40 bg-brand/10 text-brand" : "bg-muted"}>OPORTUNIDAD {x.level.toUpperCase()}</Pill>
                <span className="text-xs text-muted-foreground">{x.status === "nueva" ? "Nueva" : x.status === "revisada" ? "En revisión" : "Ignorada"}</span>
              </div>
              <div className="mt-3 text-lg font-semibold tracking-tight">{x.title}</div>
              <div className="text-sm text-muted-foreground">{x.dates} · {x.event}</div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                {[["Ocupación", `${x.occupancy}%`], ["Pickup", x.pickup], ["Compset", x.compset]].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-muted py-2"><div className="tnum font-semibold">{v}</div><div className="text-muted-foreground">{k}</div></div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between text-sm"><span className="text-muted-foreground">Impacto potencial</span><span className="tnum font-semibold text-st-ready">+{eur(x.impact)}</span></div>
              <Button variant="outline" className="mt-3 w-full" onClick={() => setOpen(x.id)}>Ver detalle</Button>
            </Card>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Chart title="Forecast ocupación vs. año pasado">
          <AreaChart data={forecast}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="d" tick={ax} axisLine={false} tickLine={false} /><YAxis tick={ax} axisLine={false} tickLine={false} width={28} /><Tooltip {...tip} />
            <Area dataKey="ly" stroke="var(--chart-5)" fill="transparent" strokeDasharray="4 4" name="LY" /><Area dataKey="occ" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.12} strokeWidth={2} name="Forecast" /></AreaChart>
        </Chart>
        <Chart title="Pace · ocupación reservada">
          <LineChart data={pace}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="m" tick={ax} axisLine={false} tickLine={false} /><YAxis tick={ax} axisLine={false} tickLine={false} width={28} /><Tooltip {...tip} />
            <Line dataKey="ly" stroke="var(--chart-5)" strokeDasharray="4 4" dot={false} name="LY" /><Line dataKey="actual" stroke="var(--chart-2)" strokeWidth={2} name="2026" /></LineChart>
        </Chart>
        <Chart title="Pickup últimos 7 días (room nights)">
          <BarChart data={pickup}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="d" tick={ax} axisLine={false} tickLine={false} /><YAxis tick={ax} axisLine={false} tickLine={false} width={28} /><Tooltip {...tip} /><Bar dataKey="v" fill="var(--chart-1)" radius={[6, 6, 0, 0]} name="RN" /></BarChart>
        </Chart>
        <Chart title="Booking window (%)">
          <BarChart data={bookingWindow}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="k" tick={ax} axisLine={false} tickLine={false} /><YAxis tick={ax} axisLine={false} tickLine={false} width={28} /><Tooltip {...tip} /><Bar dataKey="v" fill="var(--chart-2)" radius={[6, 6, 0, 0]} name="%" /></BarChart>
        </Chart>
        <Chart title="Cancelaciones (%)">
          <LineChart data={cancels}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="m" tick={ax} axisLine={false} tickLine={false} /><YAxis tick={ax} axisLine={false} tickLine={false} width={28} /><Tooltip {...tip} /><Line dataKey="v" stroke="var(--chart-4)" strokeWidth={2} name="%" /></LineChart>
        </Chart>
        <Chart title="Evolución reservas (semanal)">
          <AreaChart data={bookings}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="w" tick={ax} axisLine={false} tickLine={false} /><YAxis tick={ax} axisLine={false} tickLine={false} width={28} /><Tooltip {...tip} /><Area dataKey="v" stroke="var(--chart-3)" fill="var(--chart-3)" fillOpacity={0.2} strokeWidth={2} name="Reservas" /></AreaChart>
        </Chart>
      </div>

      <Dialog open={!!o} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {o && (
            <>
              <DialogHeader>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">Recomendación · {o.dates}</div>
                <DialogTitle className="text-xl">{o.title}</DialogTitle>
                <DialogDescription>{o.event}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div><div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Por qué</div>
                  <ul className="space-y-1">{o.reasons.map((r) => <li key={r} className="flex gap-2"><span className="text-brand">•</span>{r}</li>)}</ul></div>
                <div><div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Evidencia</div>
                  <div className="grid grid-cols-3 gap-2 text-center">{[["Ocupación", `${o.occupancy}%`], ["Pickup", o.pickup], ["Compset", o.compset]].map(([k, v]) => <div key={k} className="rounded-lg bg-muted py-2"><div className="tnum font-semibold">{v}</div><div className="text-xs text-muted-foreground">{k}</div></div>)}</div></div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border p-3"><div className="text-xs text-muted-foreground">Impacto potencial</div><div className="tnum text-lg font-semibold text-st-ready">+{eur(o.impact)}</div></div>
                  <div className="rounded-xl border p-3"><div className="text-xs text-muted-foreground">Nivel de confianza</div><div className="text-lg font-semibold">{o.confidence.toUpperCase()}</div></div>
                </div>
                <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">Suite nunca cambia tarifas automáticamente. Revenue recomienda, una persona decide.</p>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => { actions.decideOpportunity(o.id, "revisada"); setOpen(null); }}>Revisar</Button>
                  <Button className="flex-1" variant="outline" onClick={() => { actions.decideOpportunity(o.id, "ignorada"); setOpen(null); }}>Ignorar</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
