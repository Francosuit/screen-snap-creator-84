import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Camera, LogIn, LogOut, Wrench } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { eur, fmtDay, resDisplay, useSuite } from "@/lib/suite/store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { futureReservations, BED_KINDS, OCCUPANCY, ROOM_EXTRAS, BATH_OPTIONS, WINDOW_SIDES, type WindowSide, bedSleeps, bedsText, parseBeds, validateRoomEdit, type Room, type RoomEdit } from "@/lib/suite/data";
import { PrioPill, ResPill, RoomPill, Row, TaskPill } from "./ui";
import { roomHistory } from "@/lib/suite/cloud";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t px-6 py-4">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</div>
      <div className="divide-y divide-border/60">{children}</div>
    </div>
  );
}

function StayActions({ resId }: { resId: string }) {
  const { s, actions, roomState } = useSuite();
  const r = s.reservations.find((x) => x.id === resId)!;
  const [confirm, setConfirm] = useState<null | "in" | "out">(null);
  const canIn = r.status === "confirmed" && r.stay === "none" && r.inDay <= 0;
  const canOut = r.stay === "inhouse";
  const roomReady = roomState(r.room) === "ready";
  if (!["owner", "director", "reception"].includes(s.role)) return null;
  return (
    <div className="flex gap-2 border-t px-6 py-4">
      <Button className="flex-1" disabled={!canIn} onClick={() => setConfirm("in")}><LogIn className="mr-1.5 h-4 w-4" />Hacer check-in</Button>
      <Button className="flex-1" variant="outline" disabled={!canOut} onClick={() => setConfirm("out")}><LogOut className="mr-1.5 h-4 w-4" />Hacer check-out</Button>
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "in" ? `Check-in · habitación ${r.room}` : `Check-out · habitación ${r.room}`}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Suite ejecutará automáticamente:</p>
                <ul className="space-y-1">
                  {(confirm === "in"
                    ? ["Reserva → IN HOUSE", "Huésped → alojado", "Habitación → ocupada", "Mensajes In-House → activados", "Dashboard → actualizado"]
                    : ["Estancia → finalizada", "Mensajes → detenidos", "Habitación → pendiente de limpieza", "Tarea housekeeping → creada con prioridad", "Dashboard → actualizado"]
                  ).map((x) => <li key={x} className="flex gap-2"><span className="text-brand">→</span>{x}</li>)}
                </ul>
                {confirm === "in" && !roomReady && (
                  <p className="rounded-lg bg-st-maint/10 p-2 font-medium text-st-maint">La habitación aún no está LISTA. Suite no permitirá el check-in.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => (confirm === "in" ? actions.checkIn(r.id) : actions.checkOut(r.id))}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function ReservationSheet({ resId, onClose }: { resId: string | null; onClose: () => void }) {
  const { s, guest } = useSuite();
  const r = resId ? s.reservations.find((x) => x.id === resId) : undefined;
  const g = r ? guest(r.guestId) : undefined;
  return (
    <Sheet open={!!r} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-md">
        {r && g && (
          <>
            <SheetHeader className="px-6 pt-6">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="font-mono">{r.id}</span><ResPill status={resDisplay(r)} /></div>
              <SheetTitle className="text-xl">{g.name}</SheetTitle>
              <SheetDescription>Habitación {r.room} · {fmtDay(r.inDay)} → {fmtDay(r.outDay)}</SheetDescription>
            </SheetHeader>
            <div className="mt-4" />
            <Section title="Huésped">
              <Row k="Documento" v={g.doc} /><Row k="Teléfono" v={g.phone} /><Row k="Email" v={<span className="break-all">{g.email}</span>} /><Row k="Idioma" v={g.lang} />
              <Row k="Comunicaciones" v={g.messaging ? <span className="text-st-ready">Activas</span> : <span className="text-muted-foreground">Detenidas</span>} />
            </Section>
            <Section title="Estancia">
              <Row k="Entrada" v={`${fmtDay(r.inDay)}${r.stay === "none" && r.eta !== "—" ? ` · ${r.eta}` : ""}`} />
              <Row k="Salida" v={`${fmtDay(r.outDay)} · 11:00`} />
              <Row k="Noches" v={r.outDay - r.inDay} /><Row k="Huéspedes" v={r.pax} />
              <Row k="Habitación" v={`${r.room} · ${s.rooms.find((x) => x.number === r.room)!.type}`} />
              <Row k="Canal" v={r.channel === "Recepción" ? "Manual" : r.channel === "Web directa" ? "Motor directo" : r.channel} /><Row k="Importe total" v={eur(r.amount)} />
              {r.outDay > r.inDay && <Row k="Tarifa media / noche" v={eur(r.amount / (r.outDay - r.inDay))} />}
              {r.outDay > r.inDay && <Row k="Desglose por noche" v={<span className="text-right text-xs">{Array.from({ length: r.outDay - r.inDay }, (_, i) => `${fmtDay(r.inDay + i)}: ${eur(r.amount / (r.outDay - r.inDay))}`).join(" · ")}<br /><span className="text-muted-foreground">Tarifa única guardada para toda la estancia</span></span>} />}
            </Section>
            <Section title="Notas"><p className="py-2 text-sm">{r.notes || g.notes || "—"}</p></Section>
            <div className="px-6 pb-2"><Link to="/hotel" search={{ room: r.room }} onClick={onClose} className="inline-flex w-full items-center justify-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent">Localizar habitación {r.room} en Mi mundo</Link></div>
            <Section title="Historial">{s.log.filter((l) => l.text.includes(r.id)).map((l) => <p key={l.id} className="py-1 text-xs"><span className="tnum text-muted-foreground">{l.time}</span> · {l.text}</p>)}{!s.log.some((l) => l.text.includes(r.id)) && <p className="py-2 text-xs text-muted-foreground">Sin cambios registrados.</p>}</Section>
            <StayActions resId={r.id} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Editable characteristics of one room; never touches reservations, tasks or incidents */
function RoomEditor({ num, initiallyEditing = false }: { num: string; initiallyEditing?: boolean }) {
  const { s, actions, canEditRoomConfig } = useSuite();
  const rm: Room | undefined = s.rooms.find((x: Room) => x.number === num);
  const [edit, setEdit] = useState(initiallyEditing && canEditRoomConfig);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<RoomEdit>(() => ({ type: rm?.type ?? "", rate: rm?.rate ?? 0, capacity: rm?.capacity, beds: rm?.beds ?? "", bath: rm?.bath ?? "", view: rm?.view ?? "", sqm: rm?.sqm, terrace: !!rm?.terrace, notes: rm?.notes ?? "", extras: rm?.extras ?? [], window: rm?.window }));
  if (!rm) return null;
  const future = futureReservations(s.reservations, num);
  const priceChange = f.type !== rm.type || f.rate !== rm.rate;
  const err = validateRoomEdit(f);
  const num0 = (v: string) => (v === "" ? undefined : Number(v));
  const field = (label: string, el: ReactNode) => <div className="space-y-1"><Label className="text-xs">{label}</Label>{el}</div>;
  if (!edit || !canEditRoomConfig) return (
    <Section title="Características">
      <Row k="Capacidad" v={rm.capacity ?? "—"} /><Row k="Camas" v={rm.beds || "—"} /><Row k="Baño" v={rm.bath || "—"} />
      <Row k="Vista" v={rm.view || "—"} /><Row k="Superficie" v={rm.sqm ? `${rm.sqm} m²` : "—"} /><Row k="Terraza" v={rm.terrace ? "Sí" : "No"} /><Row k="Ventana" v={WINDOW_SIDES.find((w) => w.v === rm.window)?.label ?? "—"} /><Row k="Equipamiento" v={rm.extras?.length ? rm.extras.join(", ") : "—"} />
      {rm.notes && <p className="py-2 text-sm text-muted-foreground">{rm.notes}</p>}
      {canEditRoomConfig && <Button size="sm" variant="outline" className="mt-2" onClick={() => { setF({ type: rm.type, rate: rm.rate, capacity: rm.capacity, beds: rm.beds ?? "", bath: rm.bath ?? "", view: rm.view ?? "", sqm: rm.sqm, terrace: !!rm.terrace, notes: rm.notes ?? "", extras: rm.extras ?? [], window: rm.window }); setEdit(true); }}>Editar habitación</Button>}
    </Section>
  );
  return (
    <Section title="Editar habitación">
      <fieldset disabled={saving} className="grid grid-cols-2 gap-3 py-2">
        {field("Tipo", <Input value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} />)}
        {field("Tarifa base (€)", <Input type="number" min={1} value={f.rate || ""} onChange={(e) => setF({ ...f, rate: Number(e.target.value) })} />)}
        {field("Capacidad", <Input type="number" min={1} max={10} value={f.capacity ?? ""} onChange={(e) => setF({ ...f, capacity: num0(e.target.value) })} />)}
        {field("Superficie (m²)", <Input type="number" min={1} value={f.sqm ?? ""} onChange={(e) => setF({ ...f, sqm: num0(e.target.value) })} />)}
        <div className="col-span-2 space-y-1"><Label className="text-xs">Ocupación</Label>
          <div className="flex flex-wrap gap-1">{OCCUPANCY.map((o) => <Button key={o.n} type="button" size="sm" variant={f.capacity === o.n ? "default" : "outline"} onClick={() => setF({ ...f, capacity: o.n })}>{o.label}</Button>)}</div>
        </div>
        <div className="col-span-2 space-y-1"><Label className="text-xs">Camas {f.beds ? `· ${f.beds}` : ""}</Label>
          <div className="grid grid-cols-2 gap-2">{BED_KINDS.map((k) => { const c = parseBeds(f.beds); const n = c[k.key] ?? 0; const set = (v: number) => setF({ ...f, beds: bedsText({ ...c, [k.key]: Math.max(0, Math.min(6, v)) }) }); return (
            <div key={k.key} className="flex items-center justify-between rounded-md border px-2 py-1 text-sm"><span className="capitalize">{k.one}</span>
              <span className="flex items-center gap-1"><Button type="button" size="sm" variant="ghost" aria-label={`Quitar ${k.one}`} onClick={() => set(n - 1)}>−</Button><b className="w-4 text-center">{n}</b><Button type="button" size="sm" variant="ghost" aria-label={`Añadir ${k.one}`} onClick={() => set(n + 1)}>+</Button></span>
            </div>); })}</div>
          <p className="text-xs text-muted-foreground">Duermen {bedSleeps(parseBeds(f.beds))} persona(s).</p>
        </div>
        <div className="col-span-2 space-y-1"><Label className="text-xs">Equipamiento y extras</Label>
          <div className="flex flex-wrap gap-1">{ROOM_EXTRAS.map((x) => { const on = (f.extras ?? []).includes(x); return <Button key={x} type="button" size="sm" variant={on ? "default" : "outline"} onClick={() => setF({ ...f, extras: on ? (f.extras ?? []).filter((y) => y !== x) : [...(f.extras ?? []), x] })}>{x}</Button>; })}</div>
        </div>
        {field("Baño", <select aria-label="Baño" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={f.bath ?? ""} onChange={(e) => setF({ ...f, bath: e.target.value })}><option value="">—</option>{BATH_OPTIONS.map((b) => <option key={b}>{b}</option>)}</select>)}
        {field("Ventana", <select aria-label="Ventana" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={f.window ?? ""} onChange={(e) => setF({ ...f, window: (e.target.value || undefined) as WindowSide | undefined })}><option value="">Sin indicar</option>{WINDOW_SIDES.map((w) => <option key={w.v} value={w.v}>{w.label}</option>)}</select>)}
        {field("Vista", <Input value={f.view ?? ""} onChange={(e) => setF({ ...f, view: e.target.value })} />)}
        <div className="flex items-end gap-2 pb-2"><Switch checked={!!f.terrace} onCheckedChange={(v) => setF({ ...f, terrace: v })} /><Label className="text-xs">Terraza</Label></div>
        <div className="col-span-2">{field("Observaciones internas", <Textarea rows={2} value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} />)}</div>
      </fieldset>
      {priceChange && future.length > 0 && <p className="rounded-md border border-st-maint/40 p-2 text-xs text-st-maint">Esta habitación tiene {future.length} reserva(s) futura(s). Sus importes no cambiarán.</p>}
      {err && <p className="py-1 text-xs text-destructive">{err}</p>}
      <div className="mt-2 flex gap-2">
        <Button size="sm" disabled={!!err || saving} onClick={async () => { setSaving(true); try { if (await actions.updateRoom(num, f)) setEdit(false); } finally { setSaving(false); } }}>{saving ? "Guardando…" : "Guardar"}</Button>
        <Button size="sm" variant="ghost" disabled={saving} onClick={() => setEdit(false)}>Cancelar</Button>
      </div>
    </Section>
  );
}

export function RoomSheet({ room, onClose, onOpenRes, edit = false }: { room: string | null; onClose: () => void; onOpenRes?: (id: string) => void; edit?: boolean }) {
  const { s, occupant, nextArrival, guest, roomState, cloudHotelId, canEditRoomConfig } = useSuite();
  const [history, setHistory] = useState<Awaited<ReturnType<typeof roomHistory>>>([]);
  useEffect(() => {
    setHistory([]);
    if (!room || !cloudHotelId || !canEditRoomConfig) return;
    let active = true;
    roomHistory(cloudHotelId, room).then((rows) => { if (active) setHistory(rows); });
    return () => { active = false; };
  }, [room, cloudHotelId, canEditRoomConfig, s.rooms]);
  const rm = room ? s.rooms.find((x) => x.number === room) : undefined;
  const occ = room ? occupant(room) : undefined;
  const next = room ? nextArrival(room) : undefined;
  const tasks = room ? s.tasks.filter((t) => t.room === room && t.status !== "completada") : [];
  const incs = room ? s.incidents.filter((i) => i.room === room) : [];
  const hkLabel = { clean: "Limpia", dirty: "Sucia", inspect: "Repaso", cleaning: "En proceso" } as const;
  return (
    <Sheet open={!!rm} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-md">
        {rm && (
          <>
            <SheetHeader className="px-6 pt-6">
              <RoomPill state={roomState(rm.number)} />
              <SheetTitle className="text-2xl">Habitación {rm.number}</SheetTitle>
              <SheetDescription>{rm.type} · planta {rm.floor} · {eur(rm.rate)}/noche</SheetDescription>
            </SheetHeader>
            <div className="mt-4" />
            <RoomEditor key={`${rm.number}-${edit}`} num={rm.number} initiallyEditing={edit} />
            <Section title="Historial de cambios">
              {history.map((entry) => <div key={`audit-${entry.id}`} className="py-1.5 text-xs"><span className="text-muted-foreground">{new Date(entry.at).toLocaleString("es-ES")}</span> — {entry.action === "insert" ? "Habitación registrada" : "Configuración actualizada"}</div>)}
              {s.log.filter((l: { text: string }) => l.text.startsWith(`Habitación ${rm.number} `)).slice(0, 8).map((l: { id: string; time: string; actor: string; text: string }) => (
                <div key={l.id} className="py-1.5 text-xs"><span className="text-muted-foreground">{l.time} · {l.actor}</span> — {l.text}</div>
              ))}
              {!history.length && !s.log.some((l: { text: string }) => l.text.startsWith(`Habitación ${rm.number} `)) && <p className="py-2 text-sm text-muted-foreground">Sin cambios registrados.</p>}
            </Section>
            <Section title="Estados (separados)">
              <Row k="Habitación" v={<RoomPill state={roomState(rm.number)} />} />
              <Row k="Estancia" v={occ ? "IN HOUSE" : "Sin huésped"} />
              <Row k="Reserva" v={occ ? resDisplay(occ) : next ? resDisplay(next) : "—"} />
              <Row k="Housekeeping" v={hkLabel[rm.hk]} />
              <Row k="Mantenimiento" v={incs.some((i) => i.status !== "resuelta") ? <span className="text-st-maint">Incidencia abierta</span> : rm.oos ? "Fuera de servicio" : "Sin incidencias"} />
            </Section>
            <Section title="Huésped actual">
              {occ ? (
                <>
                  <Row k="Huésped" v={<button className="underline-offset-2 hover:underline" onClick={() => onOpenRes?.(occ.id)}>{guest(occ.guestId).name}</button>} />
                  <Row k="Llegada" v={fmtDay(occ.inDay)} /><Row k="Salida" v={`${fmtDay(occ.outDay)} · 11:00`} /><Row k="Reserva" v={occ.id} />
                </>
              ) : <p className="py-2 text-sm text-muted-foreground">Sin huésped alojado.</p>}
            </Section>
            <Section title="Próximo huésped">
              {next ? (
                <>
                  <Row k="Huésped" v={<button className="hover:underline" onClick={() => onOpenRes?.(next.id)}>{guest(next.guestId).name}</button>} />
                  <Row k="Llegada" v={`${fmtDay(next.inDay)} · ${next.eta}`} /><Row k="Reserva" v={next.id} />
                </>
              ) : <p className="py-2 text-sm text-muted-foreground">Sin llegadas previstas.</p>}
            </Section>
            <Section title="Tareas abiertas">
              {tasks.length ? tasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0"><div className="truncate font-medium">{t.title}</div><div className="text-xs text-muted-foreground">{t.assignee} · límite {t.deadline}</div></div>
                  <div className="flex shrink-0 gap-1"><PrioPill p={t.priority} /><TaskPill s={t.status} /></div>
                </div>
              )) : <p className="py-2 text-sm text-muted-foreground">Ninguna.</p>}
            </Section>
            <Section title="Incidencias">
              {incs.length ? incs.map((i) => (
                <div key={i.id} className="py-2 text-sm">
                  <div className="flex items-center justify-between"><span className="font-medium">{i.category}</span><span className="text-xs text-muted-foreground">{i.status} · {i.createdAt}</span></div>
                  <div className="text-muted-foreground">{i.description}</div>
                </div>
              )) : <p className="py-2 text-sm text-muted-foreground">Ninguna.</p>}
            </Section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function ReportIssueDialog({ open, onOpenChange, defaultRoom }: { open: boolean; onOpenChange: (o: boolean) => void; defaultRoom?: string | undefined }) {
  const { s, actions } = useSuite();
  const [room, setRoom] = useState(defaultRoom ?? "204");
  const [category, setCategory] = useState("Climatización");
  const [description, setDescription] = useState("Aire acondicionado no funciona.");
  const [photo, setPhoto] = useState(false);
  const [blocking, setBlocking] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (o && defaultRoom) setRoom(defaultRoom); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wrench className="h-4 w-4" />Reportar problema</DialogTitle>
          <DialogDescription>Suite creará automáticamente una tarea para mantenimiento.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-xs text-muted-foreground">Habitación
              <Select value={room} onValueChange={setRoom}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{s.rooms.map((r) => <SelectItem key={r.number} value={r.number}>{r.number}</SelectItem>)}</SelectContent></Select>
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">Categoría
              <Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Climatización", "Fontanería", "Electricidad", "Carpintería", "Cerrajería", "Otros"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
            </label>
          </div>
          <label className="grid gap-1 text-xs text-muted-foreground">Descripción
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </label>
          <button type="button" onClick={() => setPhoto(!photo)}
            className={`flex h-20 items-center justify-center gap-2 rounded-xl border border-dashed text-sm ${photo ? "border-st-ready bg-st-ready/10 text-st-ready" : "text-muted-foreground hover:bg-accent"}`}>
            <Camera className="h-4 w-4" />{photo ? "Foto adjunta (simulada) ✓" : "Añadir foto (simulada)"}
          </button>
          <label className="flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm">Bloquear habitación<Switch checked={blocking} onCheckedChange={setBlocking} /></label>
          <Button disabled={!description.trim()} onClick={() => { actions.reportIssue({ room, category, description, photo, blocking }); onOpenChange(false); }}>Crear incidencia</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
