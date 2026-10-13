import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, LogIn, LogOut, Play, CheckCircle2, Sparkles, Ban, Plus, Globe2, Wrench, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtDay, resDisplay, useSuite, eur } from "@/lib/suite/store";
import { IsoBuilding, TwinLegend } from "@/components/suite/twin/IsoBuilding";
import { RoomInterior } from "@/components/suite/twin/RoomInterior";
import { FloorChips, SimToggle } from "@/components/suite/twin/LiveHotel";
import { useTwin, techPhase } from "@/components/suite/twin/useTwin";
import { roomMeta, STATE_VAR } from "@/components/suite/twin/geometry";
import { PageHeader, RoomPill, Row } from "@/components/suite/ui";
import { ReportIssueDialog } from "@/components/suite/panels";
import type { RoomState } from "@/lib/suite/data";

export const Route = createFileRoute("/hotel")({
  head: () => ({
    meta: [
      { title: "Hotel digital — Suite Hotel OS" },
      { name: "description", content: "Gemelo digital isométrico del hotel: plantas, habitaciones y estados operativos en tiempo real." },
      { property: "og:title", content: "Hotel digital — Suite Hotel OS" },
      { property: "og:description", content: "Explora tu hotel planta por planta, en tiempo real." },
    ],
  }),
  validateSearch: (q: Record<string, unknown>): { room?: string } => (typeof q["room"] === "string" ? { room: q["room"] as string } : {}),
  component: HotelTwin,
});

function HotelTwin() {
  const { s, hotel, roomState } = useSuite();
  const { layout, floors, info, staff } = useTwin();
  const { room: wanted } = Route.useSearch();
  const [floor, setFloor] = useState<number | null>(() => s.rooms.find((r) => r.number === wanted)?.floor ?? null);
  const [sel, setSel] = useState<string | null>(wanted && s.rooms.some((r) => r.number === wanted) ? wanted : null);
  const counts = {} as Record<RoomState, number>;
  s.rooms.forEach((r) => { const st = roomState(r.number); counts[st] = (counts[st] ?? 0) + 1; });

  return (
    <div>
      <PageHeader title="Hotel digital" sub={`${hotel.name} · ${floors.length} plantas · ${s.rooms.length} habitaciones`}
        right={<div className="flex gap-2"><Button asChild variant="outline" size="sm"><Link to="/mundo"><Globe2 className="mr-1 h-4 w-4" />Volver a la ciudad</Link></Button><Button asChild variant="outline" size="sm"><Link to="/crear-hotel"><Plus className="mr-1 h-4 w-4" />Crear hotel</Link></Button></div>} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="overflow-hidden rounded-2xl bg-twin-bg text-twin-text">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-twin-muted">Mapa del hotel</div>
              <div className="text-sm">{floor == null ? "Todas las plantas" : floors.find((f) => f.number === floor)?.name}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2"><FloorChips floors={floors} value={floor} onChange={(v) => { setFloor(v); }} dark /><SimToggle dark /></div>
          </div>
          <IsoBuilding layout={layout} info={info} staff={staff} focusFloor={floor} selected={sel} onSelect={(n) => { setSel(n); }} className="h-[460px] rounded-none sm:h-[600px]" />
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-4 pt-2">
            <TwinLegend />
            <div className="tnum flex gap-3 text-[11px] text-twin-muted">
              {(Object.keys(STATE_VAR) as RoomState[]).map((k) => <span key={k}><b className="text-twin-text">{counts[k] ?? 0}</b></span>)}
            </div>
          </div>
        </div>
        <div className="xl:sticky xl:top-20 xl:self-start">
          {sel ? <RoomPanel num={sel} onClose={() => setSel(null)} onFloor={setFloor} /> : (
            <div className="rounded-2xl border bg-card p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Cómo explorar</div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>Elige una planta para verla ampliada con pasillo, ascensores y zonas comunes.</li>
                <li>Pasa el ratón por una habitación para ver su estado; pulsa para abrir su ficha.</li>
                <li>Rueda o botones para hacer zoom, arrastra para mover, y rota el edificio.</li>
                <li>"Simular actividad" genera eventos reales: check-ins, salidas, limpiezas, reservas e incidencias.</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RoomPanel({ num, onClose, onFloor }: { num: string; onClose: () => void; onFloor: (f: number) => void }) {
  const { s, actions, roomState, occupant, nextArrival, guest } = useSuite();
  const [report, setReport] = useState(false);
  const room = s.rooms.find((r) => r.number === num);
  if (!room) return null;
  const st = roomState(num);
  const meta = roomMeta(room);
  const occ = occupant(num);
  const next = nextArrival(num);
  const task = s.tasks.find((t) => t.room === num && t.dept === "housekeeping" && t.status !== "completada");
  const incs = s.incidents.filter((i) => i.room === num && i.status !== "resuelta");
  const hk = { clean: "Limpia", dirty: "Sucia", inspect: "Repaso", cleaning: "En proceso" }[room.hk];

  return (
    <div className="rounded-2xl border bg-card">
      <div className="flex items-start justify-between gap-3 p-5 pb-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Habitación · planta {room.floor}</div>
          <div className="text-3xl font-semibold tracking-tight">{room.number}</div>
          <div className="text-sm text-muted-foreground">{room.type} · {meta.capacity} huéspedes · {meta.sqm} m²</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <RoomPill state={st} />
          <button onClick={() => { onFloor(room.floor); }} className="text-xs text-brand hover:underline">Ver planta {room.floor}</button>
        </div>
      </div>
      <div className="mx-5 rounded-xl bg-twin-bg p-2"><RoomInterior meta={meta} state={st} number={room.number} /></div>

      <div className="grid gap-2 p-5">
        {occ && <Button onClick={() => actions.checkOut(occ.id)}><LogOut className="mr-1.5 h-4 w-4" />Hacer check-out · {guest(occ.guestId).name}</Button>}
        {!occ && next && next.inDay === 0 && <Button disabled={st !== "ready"} onClick={() => actions.checkIn(next.id)}><LogIn className="mr-1.5 h-4 w-4" />Hacer check-in · {guest(next.guestId).name}</Button>}
        {st === "dirty" && <Button variant="secondary" onClick={() => actions.roomOp(num, "start")}><Play className="mr-1.5 h-4 w-4" />Empezar limpieza</Button>}
        {st === "cleaning" && <Button variant="secondary" onClick={() => actions.roomOp(num, "finish")}><CheckCircle2 className="mr-1.5 h-4 w-4" />Finalizar limpieza</Button>}
        {st === "ready" && <Button variant="outline" onClick={() => actions.roomOp(num, "dirty")}><Sparkles className="mr-1.5 h-4 w-4" />Marcar pendiente de limpieza</Button>}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => setReport(true)}><AlertTriangle className="mr-1.5 h-3.5 w-3.5" />Incidencia</Button>
          <Button variant="outline" size="sm" disabled={!!occ} onClick={() => actions.roomOp(num, "oos")}><Ban className="mr-1.5 h-3.5 w-3.5" />{room.oos ? "Poner en servicio" : "Fuera de servicio"}</Button>
        </div>
      </div>

      {s.incidents.filter((i) => i.room === num).slice(0, 2).map((i) => <IncidentCard key={i.id} id={i.id} />)}

      <div className="divide-y border-t px-5 py-2">
        <Row k="Huésped" v={occ ? guest(occ.guestId).name : "—"} />
        <Row k="Reserva" v={occ ? `${occ.id} · ${resDisplay(occ)}` : "—"} />
        <Row k="Entrada / salida" v={occ ? `${fmtDay(occ.inDay)} → ${fmtDay(occ.outDay)}` : "—"} />
        <Row k="Próximo huésped" v={next ? `${guest(next.guestId).name} · ${fmtDay(next.inDay)} ${next.eta}` : "—"} />
        <Row k="Housekeeping" v={task ? `${hk} · ${task.assignee.split(" ")[0]} (${task.status.replace("_", " ")})` : hk} />
        <Row k="Mantenimiento" v={incs.length ? <span className="text-st-maint">{incs.map((i) => i.category).join(", ")}</span> : room.oos ? "Fuera de servicio" : "Sin incidencias"} />
        <Row k="Camas" v={meta.beds} /><Row k="Baño" v={meta.bath} />
        <Row k="Terraza / vista" v={`${meta.terrace ? "Sí" : "No"} · ${meta.view}`} />
        <Row k="Precio base" v={eur(meta.price)} />
      </div>
      <div className="px-5 pb-4"><button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Cerrar ficha</button></div>
      <ReportIssueDialog open={report} onOpenChange={setReport} defaultRoom={num} />
    </div>
  );
}

/** Incident lifecycle with technician movement — every step is a store action and lands in the history */
function IncidentCard({ id }: { id: string }) {
  const { s, actions } = useSuite();
  const i = s.incidents.find((x) => x.id === id);
  if (!i) return null;
  const ph = techPhase(i);
  const steps: [string, string | undefined][] = [
    [`Creada · ${i.reporter}`, i.createdAt], [`Asignada a ${i.assignee}`, i.createdAt],
    ["Técnico sale de la base", i.startedAt], ["Técnico llega a la habitación", i.arrivedAt], ["Resuelta y cerrada", i.resolvedAt],
  ];
  return (
    <div className="mx-5 mb-4 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold"><Wrench className="h-4 w-4 text-st-maint" />Incidencia {i.id} · {i.category}</div>
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{{ base: "En base", route: "En camino", onsite: "En habitación", done: "Cerrada" }[ph]}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{i.description}</p>
      <ol className="mt-3 space-y-1.5">
        {steps.map(([l, t]) => (
          <li key={l} className="flex items-center gap-2 text-xs">
            <span className={`h-2 w-2 rounded-full ${t ? "bg-st-ready" : "bg-muted"}`} />
            <span className="tnum w-10 text-muted-foreground">{t ?? "—"}</span>
            <span className={t ? "" : "text-muted-foreground"}>{l}</span>
          </li>
        ))}
      </ol>
      {ph !== "done" && i.taskId && (
        <div className="mt-3">
          {ph === "base" && <Button size="sm" className="w-full" onClick={() => actions.startTask(i.taskId!)}><MapPin className="mr-1.5 h-3.5 w-3.5" />Enviar a {i.assignee.split(" ")[0]}</Button>}
          {ph === "route" && <Button size="sm" className="w-full" onClick={() => actions.arriveIncident(i.id)}>Marcar llegada del técnico</Button>}
          {ph === "onsite" && <Button size="sm" className="w-full" onClick={() => actions.finishTask(i.taskId!)}><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Cerrar incidencia</Button>}
        </div>
      )}
    </div>
  );
}
