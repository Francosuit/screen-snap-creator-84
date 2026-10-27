import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { dayDate, eur, fmtDay, resDisplay, useSuite } from "@/lib/suite/store";
import { dragToStay, stayAmount } from "@/lib/suite/data";
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
  const [view, setView] = useState("calendario");
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
        <Select value={ch} onValueChange={setCh}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CHANNELS.map((x) => <SelectItem key={x} value={x}>{CH_LABEL[x] ?? x}</SelectItem>)}</SelectContent></Select>
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
                    <td className="px-4 py-3"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: CH_COLOR[r.channel] }} />{CH_LABEL[r.channel] ?? r.channel}</span></td>
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
  "IN HOUSE": "ring-2 ring-st-occupied", "Check-out pendiente": "ring-2 ring-st-occupied/60",
  "Check-in pendiente": "ring-2 ring-st-ready", Confirmada: "", Finalizada: "opacity-50",
  Cancelada: "line-through opacity-60", "No-show": "opacity-60",
};
/** Channel colour is separate from booking status (status = ring/opacity) */
export const CH_COLOR: Record<string, string> = {
  "Booking.com": "var(--ch-booking)", Expedia: "var(--ch-expedia)", Airbnb: "var(--ch-airbnb)", "Web directa": "var(--ch-direct)", "Recepción": "var(--ch-manual)",
};
export const CH_LABEL: Record<string, string> = { "Web directa": "Motor directo", "Recepción": "Manual" };

const SPANS = { dia: 1, semana: 7, mes: 30 } as const;

function Timeline({ ids, onOpen }: { ids: Set<string>; onOpen: (id: string) => void }) {
  const { s, guest } = useSuite();
  const [span, setSpan] = useState<keyof typeof SPANS>("semana");
  const [start, setStart] = useState(-1);
  const [roomQ, setRoomQ] = useState("Todas");
  const [creating, setCreating] = useState(false);
  const [prefill, setPrefill] = useState<{ room: string; inDay: number; nights: number } | undefined>();
  const [sel, setSel] = useState<{ room: string; a: number; b: number } | null>(null);
  const [rs, setRs] = useState<{ id: string; x0: number; out0: number; out: number } | null>(null);
  const { actions } = useSuite();
  const DAYS = SPANS[span], W = span === "mes" ? 40 : span === "dia" ? 320 : 96, START = start;
  const days = Array.from({ length: DAYS }, (_, i) => START + i);
  const rooms = s.rooms.filter((r) => roomQ === "Todas" || r.number === roomQ);
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <Tabs value={span} onValueChange={(v) => setSpan(v as keyof typeof SPANS)}><TabsList><TabsTrigger value="dia">Día</TabsTrigger><TabsTrigger value="semana">Semana</TabsTrigger><TabsTrigger value="mes">Mes</TabsTrigger></TabsList></Tabs>
        <Button variant="outline" size="icon" onClick={() => setStart(start - DAYS)} aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="outline" size="sm" onClick={() => setStart(span === "dia" ? 0 : -1)}>Hoy</Button>
        <Button variant="outline" size="icon" onClick={() => setStart(start + DAYS)} aria-label="Siguiente"><ChevronRight className="h-4 w-4" /></Button>
        <span className="text-sm text-muted-foreground">{dayDate(START).toLocaleDateString("es-ES", { day: "numeric", month: "short" })} – {dayDate(START + DAYS - 1).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}</span>
        <Select value={roomQ} onValueChange={setRoomQ}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Todas">Todas las hab.</SelectItem>{s.rooms.map((r) => <SelectItem key={r.number} value={r.number}>Hab. {r.number}</SelectItem>)}</SelectContent></Select>
        <Button size="sm" className="ml-auto" onClick={() => { setPrefill(undefined); setCreating(true); }}><Plus className="mr-1 h-4 w-4" />Nueva reserva</Button>
      </div>
      <div className="flex flex-wrap gap-3 border-b px-3 py-2 text-xs text-muted-foreground">
        {Object.entries(CH_COLOR).map(([k, c]) => <span key={k} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />{CH_LABEL[k] ?? k}</span>)}
        <span>Arrastra sobre días libres para reservar · estira el borde derecho de una reserva para cambiar la salida</span>
        <span className="ml-auto">Borde verde: llega hoy · azul: en curso · tachado: cancelada</span>
      </div>
      <div className="overflow-x-auto">
        <div style={{ width: 72 + DAYS * W }} className="select-none"
          onPointerMove={(e) => { if (rs) setRs({ ...rs, out: Math.max(rs.out0 + Math.round((e.clientX - rs.x0) / W), 0) }); }}
          onPointerUp={() => {
            if (rs) { if (rs.out !== rs.out0) actions.changeStay(rs.id, rs.out); setRs(null); }
            if (sel) { const st = dragToStay(sel.a, sel.b); setSel(null); if (st) { setPrefill({ room: sel.room, inDay: st.inDay, nights: st.nights }); setCreating(true); } }
          }}
          onPointerLeave={() => { setSel(null); setRs(null); }}>
          <div className="flex border-b bg-muted/50 text-xs text-muted-foreground">
            <div className="w-[72px] shrink-0 px-3 py-2">Hab.</div>
            {days.map((d) => (
              <div key={d} style={{ width: W }} className={cn("shrink-0 border-l px-1 py-2 text-center", d === 0 && "bg-brand/10 font-semibold text-foreground")}>
                <div>{dayDate(d).toLocaleDateString("es-ES", { weekday: "short" })}</div><div className="tnum">{dayDate(d).getDate()}</div>
              </div>
            ))}
          </div>
          {rooms.map((room) => (
            <div key={room.number} className="relative flex h-11 border-b last:border-0">
              <div className="w-[72px] shrink-0 px-3 py-3 text-sm font-medium">{room.number}</div>
              {days.map((d) => {
                const st = sel && sel.room === room.number ? dragToStay(sel.a, sel.b) : null;
                const on = !!st && d >= st.inDay && d < st.outDay;
                return <div key={d} style={{ width: W }} className={cn("shrink-0 cursor-crosshair border-l", d === 0 && "bg-brand/5", on && "bg-brand/25")}
                  onPointerDown={() => { if (d >= 0 && !room.oos) setSel({ room: room.number, a: d, b: d }); }}
                  onPointerEnter={() => { if (sel && sel.room === room.number) setSel({ ...sel, b: d }); }} />;
              })}
              {(() => { const st = sel && sel.room === room.number ? dragToStay(sel.a, sel.b) : null; return st && <div data-testid="drag-label" className="pointer-events-none absolute -top-5 z-10 whitespace-nowrap rounded bg-foreground px-1.5 text-[10px] text-background" style={{ left: 72 + (st.inDay - START) * W }}>{st.nights} noche(s) · {fmtDay(st.inDay)} → {fmtDay(st.outDay)} · {stayAmount(room.rate, st.nights)} €</div>; })()}
              {s.reservations.filter((r) => r.room === room.number && ids.has(r.id) && r.outDay > START && r.inDay < START + DAYS).map((r) => {
                // Bars run from mid check-in day to mid check-out day, so same-day turnovers never overlap
                const out = rs?.id === r.id ? rs.out : r.outDay;
                const from = Math.max(r.inDay - START + 0.5, 0), to = Math.min(out - START + 0.5, DAYS);
                const editable = r.status === "confirmed" && r.stay !== "finished";
                return (
                  <button key={r.id} onClick={() => onOpen(r.id)} title={`${guest(r.guestId).name} · ${r.channel} · ${resDisplay(r)}`}
                    style={{ left: 72 + from * W, width: Math.max((to - from) * W - 3, 6), background: CH_COLOR[r.channel] ?? "var(--ch-manual)" }}
                    className={cn("absolute top-1.5 h-8 truncate rounded-md px-2 text-left text-xs font-medium text-primary-foreground shadow-sm transition hover:brightness-110", BAR[resDisplay(r)])}>
                    {guest(r.guestId).name}{rs?.id === r.id && ` · ${out - r.inDay} noches`}
                    {editable && <span role="slider" aria-label="Cambiar salida" aria-valuenow={out} className="absolute right-0 top-0 h-full w-2 cursor-ew-resize rounded-r-md bg-background/40"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => { e.stopPropagation(); setRs({ id: r.id, x0: e.clientX, out0: r.outDay, out: r.outDay }); }} />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <NewReservation key={JSON.stringify(prefill)} open={creating} onOpenChange={setCreating} prefill={prefill} />
    </Card>
  );
}

function NewReservation({ open, onOpenChange, prefill }: { open: boolean; onOpenChange: (o: boolean) => void; prefill?: { room: string; inDay: number; nights: number } | undefined }) {
  const { s, actions } = useSuite();
  const [f, setF] = useState({ name: "", room: prefill?.room ?? s.rooms[0]?.number ?? "", inDay: prefill?.inDay ?? 0, nights: prefill?.nights ?? 1, pax: 2, notes: "" });
  const save = () => { if (actions.createReservation({ name: f.name, room: f.room, inDay: f.inDay, outDay: f.inDay + f.nights, pax: f.pax, notes: f.notes })) onOpenChange(false); };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nueva reserva manual</DialogTitle><DialogDescription>Se registra como canal «Manual». Suite comprueba que la habitación esté libre.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <Input placeholder="Nombre del huésped" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Select value={f.room} onValueChange={(v) => setF({ ...f, room: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{s.rooms.map((r) => <SelectItem key={r.number} value={r.number}>Hab. {r.number} · {r.type}</SelectItem>)}</SelectContent></Select>
            <Select value={String(f.inDay)} onValueChange={(v) => setF({ ...f, inDay: Number(v) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 30 }, (_, i) => <SelectItem key={i} value={String(i)}>Entrada {fmtDay(i)}</SelectItem>)}</SelectContent></Select>
            <label className="text-xs text-muted-foreground">Noches<Input type="number" min={1} value={f.nights} onChange={(e) => setF({ ...f, nights: Math.max(1, Number(e.target.value)) })} /></label>
            <label className="text-xs text-muted-foreground">Huéspedes<Input type="number" min={1} value={f.pax} onChange={(e) => setF({ ...f, pax: Math.max(1, Number(e.target.value)) })} /></label>
          </div>
          <p className="text-sm text-muted-foreground">Importe: {(s.rooms.find((r) => r.number === f.room)?.rate ?? 0)} € × {f.nights} noche(s) = <b className="text-foreground">{stayAmount(s.rooms.find((r) => r.number === f.room)?.rate ?? 0, f.nights)} €</b> · salida {fmtDay(f.inDay + f.nights)}</p>
          <Input placeholder="Observaciones (opcional)" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </div>
        <DialogFooter><Button onClick={save}>Crear reserva</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
