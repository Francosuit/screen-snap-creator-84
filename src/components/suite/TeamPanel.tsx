import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, Pill, SectionTitle } from "@/components/suite/ui";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, Copy, Share2, UserPlus } from "lucide-react";
import { ROLE_LABELS, STAFF_ROLES, type HotelRole } from "@/lib/suite/cloud";
import { MODULE_LABELS, ROLE_MODULES, clampModules } from "@/lib/suite/staff-access";

interface Invite { email: string; role: HotelRole; full_name: string; position: string; modules: string[] | null; token: string; expires_at: string; revoked_at: string | null; accepted_at: string | null }
const inviteLink = (t: string) => `${window.location.origin}/invitacion?token=${t}`;
const inviteState = (i: Invite) => i.revoked_at ? "Anulada" : i.accepted_at ? "Aceptada" : new Date(i.expires_at) <= new Date() ? "Caducada" : `Caduca ${new Date(i.expires_at).toLocaleDateString("es-ES")}`;
const in7 = () => new Date(Date.now() + 7 * 864e5).toISOString();
interface Member { user_id: string; role: HotelRole; full_name: string; email: string; position: string; active: boolean; modules: string[] | null }
interface Audit { id: number; entity: string; entity_key: string; action: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null; at: string }

const FIELDS: Record<string, string> = { name: "nombre", type: "tipo", rate: "tarifa", capacity: "capacidad", beds: "camas", bath: "baño", view: "vista", sqm: "m²", terrace: "terraza", notes: "observaciones", floor: "planta", archived: "archivada", city: "ciudad", address: "dirección", category: "categoría", zones: "zonas" };

function useCloudHotel(key: string) {
  const [h, setH] = useState<{ id: string; name: string } | null | undefined>(undefined);
  const [signedIn, setSignedIn] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    let live = true;
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!live) return;
      setSignedIn(!!s.session);
      if (!s.session) { setH(null); return; }
      const { data } = await supabase.from("hotels").select("id, name").eq("key", key).maybeSingle();
      if (live) setH(data ?? null);
    })();
    return () => { live = false; };
  }, [key]);
  return { hotel: h, signedIn };
}
function useCloudHotelId(key: string) { const { hotel } = useCloudHotel(key); return hotel === undefined ? undefined : hotel?.id ?? null; }

/** Module checkboxes limited to what the role may ever reach (the database clamps the same way) */
function ModulePicker({ role, value, onChange }: { role: HotelRole; value: string[] | null; onChange: (v: string[] | null) => void }) {
  const all = ROLE_MODULES[role];
  const cur = value ? clampModules(role, value) : all;
  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map((m) => {
        const on = cur.includes(m);
        return (
          <button key={m} type="button" aria-pressed={on} onClick={() => { const next = on ? cur.filter((x) => x !== m) : [...cur, m]; onChange(next.length === all.length ? null : next); }}
            className={`rounded-full border px-2.5 py-0.5 text-xs ${on ? "border-brand bg-brand/10 text-foreground" : "text-muted-foreground line-through"}`}>{MODULE_LABELS[m]}</button>
        );
      })}
    </div>
  );
}

const isLive = (i: Invite) => !i.revoked_at && !i.accepted_at && new Date(i.expires_at) > new Date();
const STATE_STYLE: Record<string, string> = {
  pending: "border-brand/40 bg-brand/10 text-foreground", accepted: "border-st-ready/30 bg-st-ready/10 text-st-ready",
  expired: "bg-muted text-muted-foreground", revoked: "border-destructive/30 bg-destructive/10 text-destructive",
};
const stateKey = (i: Invite) => i.revoked_at ? "revoked" : i.accepted_at ? "accepted" : new Date(i.expires_at) <= new Date() ? "expired" : "pending";
const fmtDate = (d: string) => new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

function Stat({ label, value }: { label: string; value: number }) {
  return <Card className="py-4"><div className="text-3xl font-semibold tabular-nums">{value}</div><div className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div></Card>;
}

export function TeamPanel({ hotelKey }: { hotelKey: string }) {
  const { hotel, signedIn } = useCloudHotel(hotelKey);
  const id = hotel?.id;
  const [invites, setInvites] = useState<Invite[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<string | null>(null); // email of the invite just created
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ email: "", name: "", position: "" });
  const [role, setRole] = useState<HotelRole>("reception");
  const [mods, setMods] = useState<string[] | null>(null);
  const reload = async (hid: string) => {
    const [i, m] = await Promise.all([
      supabase.from("hotel_invites").select("email, role, full_name, position, modules, token, expires_at, revoked_at, accepted_at").eq("hotel_id", hid).order("created_at", { ascending: false }),
      supabase.from("hotel_members").select("user_id, role, full_name, email, position, active, modules").eq("hotel_id", hid),
    ]);
    if (i.error || m.error) toast.error("No se pudo leer el equipo", { description: (i.error ?? m.error)?.message });
    setInvites((i.data ?? []) as Invite[]); setMembers((m.data ?? []) as Member[]);
  };
  useEffect(() => { if (id) void reload(id); }, [id]);

  if (hotel === undefined) return <Card><p className="text-sm text-muted-foreground">Cargando…</p></Card>;
  if (!hotel) return (
    <Card className="border-dashed">
      <SectionTitle>Equipo no disponible todavía</SectionTitle>
      <p className="text-sm text-muted-foreground">
        {signedIn === false
          ? "No hay una sesión iniciada en la nube. Inicia sesión con tu cuenta confirmada: sin ella el hotel solo existe en este navegador y no se puede invitar a nadie."
          : "Este hotel aún no está guardado en la nube. Espera a ver «Guardado en la nube» arriba; hasta entonces no se pueden crear invitaciones."}
      </p>
    </Card>
  );

  const add = async () => {
    const e = f.email.trim().toLowerCase();
    if (!f.name.trim()) { toast.error("Indica el nombre"); return; }
    if (!/^\S+@\S+\.\S+$/.test(e)) { toast.error("Correo no válido"); return; }
    setBusy(true);
    const { error } = await supabase.from("hotel_invites").upsert({ hotel_id: hotel.id, email: e, role, full_name: f.name.trim(), position: f.position.trim(), modules: mods, revoked_at: null, expires_at: in7() });
    setBusy(false);
    if (error) { toast.error("No se pudo crear la invitación", { description: error.message }); return; }
    setF({ email: "", name: "", position: "" }); setMods(null);
    await reload(hotel.id);
    setCreated(e);
  };
  const revoke = async (e: string) => {
    const { error } = await supabase.from("hotel_invites").update({ revoked_at: new Date().toISOString() }).eq("hotel_id", hotel.id).eq("email", e);
    if (error) toast.error("No se pudo anular", { description: error.message }); else { toast.success("Invitación anulada"); void reload(hotel.id); }
  };
  const renew = async (e: string) => {
    const { error } = await supabase.from("hotel_invites").update({ revoked_at: null, expires_at: in7() }).eq("hotel_id", hotel.id).eq("email", e);
    if (error) toast.error("No se pudo renovar", { description: error.message }); else { toast.success("Enlace nuevo creado; el anterior deja de valer"); void reload(hotel.id); }
  };
  const copy = async (t: string) => {
    try { await navigator.clipboard.writeText(inviteLink(t)); toast.success("Enlace copiado"); }
    catch { toast.error("No se pudo copiar; selecciona el enlace y cópialo a mano"); }
  };
  const share = async (i: Invite) => {
    const url = inviteLink(i.token);
    if (navigator.share) { try { await navigator.share({ title: `Invitación a ${hotel.name}`, text: `Únete al equipo de ${hotel.name} en Suite Hotel OS`, url }); } catch { /* cancelled */ } }
    else window.location.href = `mailto:${i.email}?subject=${encodeURIComponent(`Invitación a ${hotel.name}`)}&body=${encodeURIComponent(`Únete al equipo de ${hotel.name}: ${url}`)}`;
  };
  const patch = async (uid: string, p: Partial<Pick<Member, "active" | "modules">>) => {
    const { error } = await supabase.from("hotel_members").update(p).eq("hotel_id", hotel.id).eq("user_id", uid);
    if (error) toast.error("No se pudo guardar", { description: error.message }); else void reload(hotel.id);
  };

  const pending = invites.filter((i) => !i.accepted_at);
  const result = created ? invites.find((i) => i.email === created) : undefined;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Hotel: <b className="text-foreground">{hotel.name}</b> · guardado en la nube</p>
        <Button onClick={() => { setCreated(null); setOpen(true); }}><UserPlus className="mr-1.5 h-4 w-4" />Invitar empleado</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Empleados activos" value={members.filter((m) => m.active).length} />
        <Stat label="Invitaciones pendientes" value={invites.filter(isLive).length} />
        <Stat label="Accesos desactivados" value={members.filter((m) => !m.active).length} />
      </div>

      <section>
        <SectionTitle>Equipo</SectionTitle>
        {!members.length ? (
          <Card className="flex flex-col items-center gap-3 border-dashed py-10 text-center">
            <p className="text-sm text-muted-foreground">Todavía no hay empleados. Aparecerán aquí cuando acepten su invitación.</p>
            <Button variant="outline" onClick={() => { setCreated(null); setOpen(true); }}>+ Invitar empleado</Button>
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {members.map((m) => (
              <Card key={m.user_id} className={m.active ? "" : "opacity-70"}>
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold ring-1 ring-border">{(m.full_name || m.email || "?").split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{m.full_name || m.email || "Empleado"}</div>
                    <div className="truncate text-xs text-muted-foreground">{m.email}{m.position ? ` · ${m.position}` : ""}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Pill>{ROLE_LABELS[m.role]}</Pill><Pill className="bg-muted">{hotel.name}</Pill>
                      <Pill className={m.active ? "border-st-ready/30 bg-st-ready/10 text-st-ready" : "bg-muted text-muted-foreground"}>{m.active ? "Acceso activo" : "Acceso desactivado"}</Pill>
                    </div>
                  </div>
                  <Button size="sm" variant={m.active ? "outline" : "default"} onClick={() => patch(m.user_id, { active: !m.active })}>{m.active ? "Desactivar" : "Reactivar"}</Button>
                </div>
                {m.active ? <div className="mt-3"><ModulePicker role={m.role} value={m.modules} onChange={(v) => patch(m.user_id, { modules: v })} /></div>
                  : <p className="mt-3 text-xs text-muted-foreground">Su historial y tareas se conservan.</p>}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle>Invitaciones pendientes</SectionTitle>
        {!pending.length ? <Card className="border-dashed"><p className="text-sm text-muted-foreground">No hay invitaciones pendientes.</p></Card> : (
          <Card className="divide-y p-0">
            {pending.map((i) => { const k = stateKey(i); return (
              <div key={i.email} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="font-medium">{i.full_name || i.email}</div>
                  <div className="truncate text-xs text-muted-foreground">{i.email} · {ROLE_LABELS[i.role]}{i.position ? ` · ${i.position}` : ""} · {hotel.name}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Pill className={STATE_STYLE[k]}>{inviteState(i)}</Pill>
                  {isLive(i) && <Button size="sm" variant="outline" onClick={() => copy(i.token)}><Copy className="mr-1 h-3.5 w-3.5" />Copiar enlace</Button>}
                  {isLive(i) ? <Button size="sm" variant="ghost" onClick={() => revoke(i.email)}>Anular</Button> : <Button size="sm" variant="ghost" onClick={() => renew(i.email)}>Nuevo enlace</Button>}
                </div>
              </div>
            ); })}
          </Card>
        )}
        {invites.some((i) => i.accepted_at) && <p className="mt-2 text-xs text-muted-foreground">Aceptadas: {invites.filter((i) => i.accepted_at).map((i) => i.full_name || i.email).join(", ")}</p>}
      </section>
      <p className="text-xs text-muted-foreground">Solo el propietario da o quita accesos. Los permisos de cada persona nunca superan los de su rol y se comprueban en la nube.</p>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setCreated(null); }}>
        <DialogContent className="max-w-lg">
          {result ? (<>
            <DialogHeader><DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-st-ready" />Enlace de invitación creado</DialogTitle>
              <DialogDescription>No se envía ningún correo automático: copia el enlace y compártelo con la persona.</DialogDescription></DialogHeader>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Para</dt><dd className="font-medium">{result.full_name} · {result.email}</dd>
              <dt className="text-muted-foreground">Rol</dt><dd>{ROLE_LABELS[result.role]}{result.position ? ` · ${result.position}` : ""}</dd>
              <dt className="text-muted-foreground">Hotel</dt><dd>{hotel.name}</dd>
              <dt className="text-muted-foreground">Estado</dt><dd>{isLive(result) ? `Válido hasta el ${fmtDate(result.expires_at)}` : inviteState(result)}</dd>
            </dl>
            {isLive(result) ? <>
              <Input readOnly value={inviteLink(result.token)} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
              <Button size="lg" className="w-full" onClick={() => copy(result.token)}><Copy className="mr-2 h-4 w-4" />Copiar enlace de invitación</Button>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => share(result)}><Share2 className="mr-1.5 h-4 w-4" />Compartir</Button>
                <Button variant="outline" className="flex-1" onClick={() => renew(result.email)}>Nuevo enlace</Button>
                <Button variant="ghost" className="flex-1 text-destructive" onClick={() => revoke(result.email)}>Anular</Button>
              </div>
            </> : <Button variant="outline" onClick={() => renew(result.email)}>Generar enlace nuevo</Button>}
          </>) : (<>
            <DialogHeader><DialogTitle>Invitar empleado</DialogTitle>
              <DialogDescription>La persona entrará con su propia cuenta usando este correo.</DialogDescription></DialogHeader>
            <div className="grid gap-3">
              <label className="grid gap-1 text-sm">Nombre y apellidos<Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
              <label className="grid gap-1 text-sm">Correo electrónico<Input type="email" placeholder="correo@hotel.com" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">Puesto<Input placeholder="Recepcionista de noche" value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })} /></label>
                <label className="grid gap-1 text-sm">Rol
                  <select className="h-9 rounded-md border bg-background px-2 text-sm" value={role} onChange={(e) => { setRole(e.target.value as HotelRole); setMods(null); }}>
                    {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select></label>
              </div>
              <div className="text-sm">Hotel asignado<div className="mt-1"><Pill className="bg-muted">{hotel.name}</Pill></div></div>
              <div className="text-sm">Permisos disponibles para este rol<div className="mt-1.5"><ModulePicker role={role} value={mods} onChange={setMods} /></div></div>
            </div>
            <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={busy} onClick={add}>{busy ? "Creando…" : "Crear invitación"}</Button></DialogFooter>
          </>)}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function HistoryPanel({ hotelKey }: { hotelKey: string }) {
  const id = useCloudHotelId(hotelKey);
  const [rows, setRows] = useState<Audit[] | null>(null);
  useEffect(() => {
    if (!id) return;
    supabase.from("audit_log").select("id, entity, entity_key, action, before, after, at").eq("hotel_id", id).order("at", { ascending: false }).limit(100)
      .then(({ data }) => setRows((data ?? []) as Audit[]));
  }, [id]);
  if (id === null) return <Card><p className="text-sm text-muted-foreground">Este hotel aún no está guardado en la nube.</p></Card>;
  if (!rows) return <Card><p className="text-sm text-muted-foreground">Cargando…</p></Card>;
  return (
    <Card>
      <SectionTitle>Historial guardado</SectionTitle>
      {!rows.length && <p className="text-sm text-muted-foreground">Sin cambios registrados.</p>}
      <ul className="space-y-2 text-sm">
        {rows.map((r) => {
          const changed = r.before && r.after ? Object.keys(FIELDS).filter((k) => JSON.stringify(r.before![k]) !== JSON.stringify(r.after![k])) : [];
          return (
            <li key={r.id} className="rounded-md border px-3 py-2">
              <div className="flex justify-between gap-2"><b>{r.entity === "hotels" ? "Hotel" : `Habitación ${r.entity_key}`}</b><span className="text-muted-foreground">{new Date(r.at).toLocaleString("es-ES")}</span></div>
              <div className="text-muted-foreground">
                {r.action === "insert" ? "Creado" : changed.length ? changed.map((k) => `${FIELDS[k]}: ${String(r.before![k] ?? "—")} → ${String(r.after![k] ?? "—")}`).join(" · ") : "Actualizado"}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
