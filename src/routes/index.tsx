import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ROLES } from "@/lib/suite/data";
import { eur, useSuite } from "@/lib/suite/store";
import { Card, Kpi, PageHeader, SectionTitle } from "@/components/suite/ui";
import { HousekeepingHome, MaintenanceHome } from "@/components/suite/RoleHomes";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Inicio — Suite Hotel OS" },
      { name: "description", content: "Qué está pasando hoy en tu hotel: facturación, ocupación, llegadas, salidas y lo que requiere tu atención." },
      { property: "og:title", content: "Inicio — Suite Hotel OS" },
      { property: "og:description", content: "Qué está pasando hoy en tu hotel, en una sola pantalla." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  const { s } = useSuite();
  if (s.role === "housekeeping") return <HousekeepingHome />;
  if (s.role === "maintenance") return <MaintenanceHome />;
  return <Dashboard />;
}

const LEVEL = {
  URGENTE: "bg-st-maint text-primary-foreground",
  ALTA: "bg-st-cleaning text-primary-foreground",
  MEDIA: "bg-st-dirty text-foreground",
  OPORTUNIDAD: "bg-brand text-primary-foreground",
} as const;

function Dashboard() {
  const { s, alerts, roomState, hotel } = useSuite();
  const nav = useNavigate();
  const [openAlert, setOpenAlert] = useState<string | null>(null);
  const AVAIL = s.rooms.filter((r) => !r.oos).length;
  const inhouse = s.reservations.filter((r) => r.stay === "inhouse");
  const arrivalsToday = s.reservations.filter((r) => r.inDay === 0 && r.status === "confirmed" && r.stay !== "finished" || (r.inDay === 0 && r.stay === "inhouse"));
  const pendingIn = s.reservations.filter((r) => r.inDay === 0 && r.status === "confirmed" && r.stay === "none");
  const departures = s.reservations.filter((r) => r.outDay === 0 && r.status === "confirmed" && r.inDay < 0);
  const nightly = (r: (typeof s.reservations)[number]) => r.amount / Math.max(1, r.outDay - r.inDay);
  const sold = [...inhouse, ...pendingIn];
  const revToday = sold.reduce((a, r) => a + nightly(r), 0);
  const occ = AVAIL ? Math.round((sold.length / AVAIL) * 100) : 0;
  const adr = sold.length ? revToday / sold.length : 0;
  // Month revenue: room-nights from 1 Nov (day offset -9) through today, from real bookings
  const monthRev = s.reservations.filter((r) => r.status !== "cancelled").reduce((acc, r) => {
    const from = Math.max(r.inDay, -9), to = Math.min(r.outDay, 1);
    return acc + Math.max(0, to - from) * nightly(r);
  }, 0);
  const tomorrowStays = s.reservations.filter((r) => r.status === "confirmed" && r.stay !== "finished" && r.inDay <= 1 && r.outDay > 1);
  const isRevenue = s.role === "revenue";
  const a = alerts.find((x) => x.id === openAlert);
  const counts = { ready: 0, dirty: 0 };
  s.rooms.forEach((r) => { const st = roomState(r.number); if (st === "ready") counts.ready++; if (st === "dirty" || st === "cleaning") counts.dirty++; });

  return (
    <div>
      <PageHeader title={`Buenas tardes, ${ROLES[s.role].person.split(" ")[0]}`} sub={`Esto es lo que está pasando hoy en ${hotel.name}.`} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Facturación hoy" value={eur(revToday)} hint={`${sold.length} hab. vendidas`} />
        <Kpi label="Facturación mes" value={eur(monthRev)} hint="1–10 nov" />
        <Kpi label="Ocupación" value={`${occ}%`} hint={`${sold.length}/${AVAIL} hab.`} />
        <Kpi label="ADR" value={eur(adr)} hint="tarifa media" />
        <Kpi label="RevPAR" value={eur(AVAIL ? revToday / AVAIL : 0)} hint="por hab. disponible" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <SectionTitle right={<span className="tnum text-xs text-muted-foreground">{alerts.length} elementos</span>}>Requiere tu atención</SectionTitle>
            <div className="divide-y">
              {alerts.filter((x) => !isRevenue || x.level === "OPORTUNIDAD").map((x) => (
                <button key={x.id} onClick={() => setOpenAlert(x.id)} className="group flex w-full items-start gap-3 py-3 text-left">
                  <span className={cn("mt-0.5 w-[92px] shrink-0 rounded-md px-2 py-1 text-center text-[10px] font-semibold tracking-wider", LEVEL[x.level])}>{x.level}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{x.title}</div>
                    <div className="text-sm text-muted-foreground">{x.detail}</div>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                </button>
              ))}
              {alerts.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">Todo en orden. Nada requiere tu atención.</div>}
            </div>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <SectionTitle>Hoy</SectionTitle>
              <Stats items={[
                ["Huéspedes IN HOUSE", inhouse.reduce((a, r) => a + r.pax, 0)],
                ["Check-ins", `${arrivalsToday.length - pendingIn.length}/${arrivalsToday.length}`],
                ["Check-outs", `${departures.filter((r) => r.stay === "finished").length}/${departures.length}`],
                ["Reservas nuevas", s.reservations.filter((r) => r.createdDay === 0).length],
                ["Habitaciones disponibles", counts.ready],
                ["Pendientes de limpieza", counts.dirty],
              ]} />
            </Card>
            <Card>
              <SectionTitle>Mañana</SectionTitle>
              <Stats items={[
                ["Check-ins", s.reservations.filter((r) => r.inDay === 1 && r.status === "confirmed").length],
                ["Check-outs", s.reservations.filter((r) => r.outDay === 1 && r.status === "confirmed" && r.stay !== "finished").length],
                ["Ocupación prevista", `${AVAIL ? Math.round((tomorrowStays.length / AVAIL) * 100) : 0}%`],
                ["Reservas previstas", tomorrowStays.length],
              ]} />
            </Card>
          </div>
        </div>

        <Card>
          <SectionTitle right={<span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-st-ready" />En vivo</span>}>Actividad en tiempo real</SectionTitle>
          <ol className="relative space-y-4 before:absolute before:left-[47px] before:top-1 before:h-[calc(100%-8px)] before:w-px before:bg-border">
            {s.log.slice(0, 11).map((l) => (
              <li key={l.id} className="relative flex gap-3 text-sm">
                <span className="tnum w-10 shrink-0 pt-0.5 text-xs text-muted-foreground">{l.time}</span>
                <span className={cn("relative z-10 mt-1.5 h-2 w-2 shrink-0 rounded-full ring-4 ring-card",
                  l.kind === "suite" ? "bg-brand" : l.kind === "channel" ? "bg-st-occupied" : l.kind === "revenue" ? "bg-st-cleaning" : "bg-foreground")} />
                <div className="min-w-0"><span className="font-medium">{l.actor === "Suite" ? <span className="inline-flex items-center gap-1 text-brand"><Sparkles className="h-3 w-3" />Suite</span> : l.actor}</span> <span className="text-muted-foreground">{l.text}</span></div>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Dialog open={!!a} onOpenChange={(o) => !o && setOpenAlert(null)}>
        <DialogContent>
          {a && (
            <>
              <DialogHeader>
                <span className={cn("w-fit rounded-md px-2 py-1 text-[10px] font-semibold tracking-wider", LEVEL[a.level])}>{a.level}</span>
                <DialogTitle>{a.title}</DialogTitle>
                <DialogDescription>{a.detail}</DialogDescription>
              </DialogHeader>
              {a.notify && <div className="rounded-xl bg-muted p-3 text-sm"><span className="text-muted-foreground">Suite ha notificado a:</span> <b>{a.notify}</b></div>}
              <Button onClick={() => { setOpenAlert(null); nav({ to: a.link as "/" }); }}>Ir a resolver<ArrowRight className="ml-1.5 h-4 w-4" /></Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stats({ items }: { items: [string, string | number][] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-4">
      {items.map(([k, v]) => (
        <div key={k}><div className="tnum text-2xl font-semibold tracking-tight">{v}</div><div className="text-xs text-muted-foreground">{k}</div></div>
      ))}
    </div>
  );
}
