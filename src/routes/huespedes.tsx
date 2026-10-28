import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fmtDay, resDisplay, useSuite } from "@/lib/suite/store";
import { Card, PageHeader, ResPill, Row } from "@/components/suite/ui";
import { ReservationSheet } from "@/components/suite/panels";

export const Route = createFileRoute("/huespedes")({
  head: () => ({
    meta: [
      { title: "Huéspedes — Suite Hotel OS" },
      { name: "description", content: "Huéspedes in house, llegadas, salidas e histórico con ficha completa." },
      { property: "og:title", content: "Huéspedes — Suite Hotel OS" },
      { property: "og:description", content: "Fichas de huéspedes conectadas a reservas y habitaciones." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Huespedes,
});

function Huespedes() {
  const { s, guest } = useSuite();
  const [tab, setTab] = useState("inhouse");
  const [open, setOpen] = useState<string | null>(null);
  const [res, setRes] = useState<string | null>(null);
  const filt = {
    inhouse: s.reservations.filter((r) => r.stay === "inhouse"),
    llegadas: s.reservations.filter((r) => r.status === "confirmed" && r.stay === "none" && r.inDay >= 0 && r.inDay <= 1),
    salidas: s.reservations.filter((r) => r.outDay === 0 && r.status === "confirmed" && r.inDay < 0),
    historico: s.reservations.filter((r) => r.stay === "finished" || r.status !== "confirmed"),
  }[tab]!;
  const r = s.reservations.find((x) => x.id === open);
  const g = r && guest(r.guestId);
  return (
    <div>
      <PageHeader title="Huéspedes" sub="Una sola ficha alimenta reservas, habitaciones y mensajes" />
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList><TabsTrigger value="inhouse">IN HOUSE</TabsTrigger><TabsTrigger value="llegadas">Llegadas</TabsTrigger><TabsTrigger value="salidas">Salidas</TabsTrigger><TabsTrigger value="historico">Histórico</TabsTrigger></TabsList>
      </Tabs>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filt.map((x) => {
          const gg = guest(x.guestId);
          return (
            <button key={x.id} onClick={() => setOpen(x.id)} className="text-left">
              <Card className="transition hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold ring-1 ring-border">{gg.name.split(" ").map((p) => p[0]).join("")}</div>
                  <div className="min-w-0 flex-1"><div className="truncate font-medium">{gg.name}</div><div className="text-xs text-muted-foreground">Hab. {x.room} · {fmtDay(x.inDay)} → {fmtDay(x.outDay)}</div></div>
                </div>
                <div className="mt-3 flex items-center justify-between"><ResPill status={resDisplay(x)} /><span className="text-xs text-muted-foreground">{gg.lang}</span></div>
              </Card>
            </button>
          );
        })}
        {filt.length === 0 && <Card className="text-sm text-muted-foreground">Nadie en esta lista ahora mismo.</Card>}
      </div>
      <Sheet open={!!r} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {r && g && (
            <>
              <SheetHeader className="p-0"><ResPill status={resDisplay(r)} /><SheetTitle className="text-xl">{g.name}</SheetTitle><SheetDescription>{g.country} · {g.lang}</SheetDescription></SheetHeader>
              <div className="mt-4 divide-y">
                <Row k="Documento" v={g.doc} /><Row k="Teléfono" v={g.phone} /><Row k="Email" v={<span className="break-all">{g.email}</span>} />
                <Row k="Habitación" v={r.room} /><Row k="Entrada" v={fmtDay(r.inDay)} /><Row k="Salida" v={fmtDay(r.outDay)} />
                <Row k="Acompañantes" v={g.companions.join(", ") || "—"} /><Row k="Idioma" v={g.lang} />
                <Row k="Mensajes" v={g.messaging ? "Activos" : "Detenidos"} />
              </div>
              <p className="mt-4 rounded-xl bg-muted p-3 text-sm">{g.notes || "Sin notas."}</p>
              <button className="mt-4 text-sm font-medium text-brand hover:underline" onClick={() => { setOpen(null); setRes(r.id); }}>Abrir reserva {r.id} →</button>
            </>
          )}
        </SheetContent>
      </Sheet>
      <ReservationSheet resId={res} onClose={() => setRes(null)} />
    </div>
  );
}
