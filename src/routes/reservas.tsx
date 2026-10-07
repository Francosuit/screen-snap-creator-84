import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { dayDate, eur, fmtDay, resDisplay, useSuite } from "@/lib/suite/store";
import { Card, PageHeader, ResPill } from "@/components/suite/ui";
import { ReservationSheet } from "@/components/suite/panels";

export const Route = createFileRoute("/reservas")({
  head: () => ({
    meta: [
      { title: "Reservas — Suite Hotel OS" },
      { name: "description", content: "Listado y calendario de reservas por canal, estado y habitación." },
      { property: "og:title", content: "Reservas — Suite Hotel OS" },
      { property: "og:description", content: "Listado y calendario de reservas por canal, estado y habitación." },
    ],
  }),
  component: Reservas,
});

const STATUSES = ["Todas", "Confirmada", "Check-in pendiente", "IN HOUSE", "Check-out pendiente", "Finalizada", "Cancelada", "No-show"];
const CHANNELS = ["Todos", "Booking.com", "Expedia", "Web directa", "Recepción", "Airbnb"];

function Reservas() {
  const { s, guest } = useSuite();
  const [q, setQ] = useState("");
  const [st, setSt] = useState("Todas");
  const [ch, setCh] = useState("Todos");
  const [view, setView] = useState("lista");
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => s.reservations.filter((r) => {
    const g = guest(r.guestId);
    return (!q || `${g.name} ${r.room} ${r.id}`.toLowerCase().includes(q.toLowerCase()))
      && (st === "Todas" || resDisplay(r) === st) && (ch === "Todos" || r.channel === ch);
  }).sort((a, b) => a.inDay - b.inDay), [s, q, st, ch, guest]);

  return (
    <div>
      <PageHeader title="Reservas" sub={`${s.reservations.length} reservas · datos sincronizados con canales`}
        right={<Tabs value={view} onValueChange={setView}><TabsList><TabsTrigger value="lista">Lista</TabsTrigger><TabsTrigger value="calendario">Calendario</TabsTrigger></TabsList></Tabs>} />
      <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px_180px]">
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar huésped, habitación o reserva…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Select value={st} onValueChange={setSt}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
        <Select value={ch} onValueChange={setCh}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CHANNELS.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
      </div>

      {view === "lista" ? (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>{["Huésped", "Hab.", "Entrada", "Salida", "Noches", "Pax", "Canal", "Importe", "Estado"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => setOpen(r.id)} className="cursor-pointer border-b last:border-0 hover:bg-accent/60">
                    <td className="px-4 py-3"><div className="font-medium">{guest(r.guestId).name}</div><div className="font-mono text-[11px] text-muted-foreground">{r.id}</div></td>
                    <td className="px-4 py-3 font-medium">{r.room}</td>
                    <td className="px-4 py-3">{fmtDay(r.inDay)}</td>
                    <td className="px-4 py-3">{fmtDay(r.outDay)}</td>
                    <td className="tnum px-4 py-3">{r.outDay - r.inDay}</td>
                    <td className="tnum px-4 py-3">{r.pax}</td>
                    <td className="px-4 py-3">{r.channel}</td>
                    <td className="tnum px-4 py-3">{eur(r.amount)}</td>
                    <td className="px-4 py-3"><ResPill status={resDisplay(r)} /></td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Sin resultados.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      ) : <Timeline ids={new Set(rows.map((r) => r.id))} onOpen={setOpen} />}
      <ReservationSheet resId={open} onClose={() => setOpen(null)} />
    </div>
  );
}

const BAR: Record<string, string> = {
  "IN HOUSE": "bg-st-occupied text-primary-foreground", "Check-out pendiente": "bg-st-occupied/70 text-primary-foreground",
  "Check-in pendiente": "bg-st-ready text-primary-foreground", Confirmada: "bg-foreground/80 text-background",
  Finalizada: "bg-muted-foreground/30 text-foreground", Cancelada: "bg-st-maint/20 text-st-maint line-through", "No-show": "bg-st-oos/30 text-foreground",
};

function Timeline({ ids, onOpen }: { ids: Set<string>; onOpen: (id: string) => void }) {
  const { s, guest } = useSuite();
  const START = -4, DAYS = 14, W = 64;
  const days = Array.from({ length: DAYS }, (_, i) => START + i);
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <div style={{ width: 72 + DAYS * W }}>
          <div className="flex border-b bg-muted/50 text-xs text-muted-foreground">
            <div className="w-[72px] shrink-0 px-3 py-2">Hab.</div>
            {days.map((d) => (
              <div key={d} style={{ width: W }} className={cn("shrink-0 border-l px-1 py-2 text-center", d === 0 && "bg-brand/10 font-semibold text-foreground")}>
                <div>{dayDate(d).toLocaleDateString("es-ES", { weekday: "short" })}</div><div className="tnum">{dayDate(d).getDate()}</div>
              </div>
            ))}
          </div>
          {s.rooms.map((room) => (
            <div key={room.number} className="relative flex h-11 border-b last:border-0">
              <div className="w-[72px] shrink-0 px-3 py-3 text-sm font-medium">{room.number}</div>
              {days.map((d) => <div key={d} style={{ width: W }} className={cn("shrink-0 border-l", d === 0 && "bg-brand/5")} />)}
              {s.reservations.filter((r) => r.room === room.number && ids.has(r.id) && r.outDay > START && r.inDay < START + DAYS).map((r) => {
                const from = Math.max(r.inDay, START) - START, to = Math.min(r.outDay, START + DAYS) - START;
                return (
                  <button key={r.id} onClick={() => onOpen(r.id)} title={guest(r.guestId).name}
                    style={{ left: 72 + from * W + W / 2, width: (to - from) * W - 4 }}
                    className={cn("absolute top-1.5 h-8 truncate rounded-md px-2 text-left text-xs font-medium shadow-sm transition hover:brightness-110", BAR[resDisplay(r)])}>
                    {guest(r.guestId).name}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
