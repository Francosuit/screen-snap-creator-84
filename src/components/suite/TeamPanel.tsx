import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, SectionTitle } from "@/components/suite/ui";
import { ROLE_LABELS, STAFF_ROLES, type HotelRole } from "@/lib/suite/cloud";
import { MODULE_LABELS, ROLE_MODULES, clampModules } from "@/lib/suite/staff-access";

interface Invite { email: string; role: HotelRole; full_name: string; position: string; modules: string[] | null }
interface Member { user_id: string; role: HotelRole; full_name: string; email: string; position: string; active: boolean; modules: string[] | null }
interface Audit { id: number; entity: string; entity_key: string; action: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null; at: string }

const FIELDS: Record<string, string> = { name: "nombre", type: "tipo", rate: "tarifa", capacity: "capacidad", beds: "camas", bath: "baño", view: "vista", sqm: "m²", terrace: "terraza", notes: "observaciones", floor: "planta", archived: "archivada", city: "ciudad", address: "dirección", category: "categoría", zones: "zonas" };

function useCloudHotelId(key: string) {
  const [id, setId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    supabase.from("hotels").select("id").eq("key", key).maybeSingle().then(({ data }) => setId(data?.id ?? null));
  }, [key]);
  return id;
}

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

export function TeamPanel({ hotelKey }: { hotelKey: string }) {
  const id = useCloudHotelId(hotelKey);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [f, setF] = useState({ email: "", name: "", position: "" });
  const [role, setRole] = useState<HotelRole>("reception");
  const [mods, setMods] = useState<string[] | null>(null);
  const reload = async (hid: string) => {
    const [i, m] = await Promise.all([
      supabase.from("hotel_invites").select("email, role, full_name, position, modules").eq("hotel_id", hid),
      supabase.from("hotel_members").select("user_id, role, full_name, email, position, active, modules").eq("hotel_id", hid),
    ]);
    setInvites((i.data ?? []) as Invite[]); setMembers((m.data ?? []) as Member[]);
  };
  useEffect(() => { if (id) void reload(id); }, [id]);
  if (id === undefined) return <Card><p className="text-sm text-muted-foreground">Cargando…</p></Card>;
  if (id === null) return <Card><p className="text-sm text-muted-foreground">Este hotel aún no está guardado en la nube. Inicia sesión con tu cuenta y espera a «Guardado en la nube».</p></Card>;

  const joined = new Set(members.map((m) => m.email.toLowerCase()));
  const add = async () => {
    const e = f.email.trim().toLowerCase();
    if (!f.name.trim()) { toast.error("Indica el nombre"); return; }
    if (!/^\S+@\S+\.\S+$/.test(e)) { toast.error("Correo no válido"); return; }
    const { error } = await supabase.from("hotel_invites").upsert({ hotel_id: id, email: e, role, full_name: f.name.trim(), position: f.position.trim(), modules: mods });
    if (error) { toast.error("No tienes permiso para dar accesos", { description: error.message }); return; }
    setF({ email: "", name: "", position: "" }); setMods(null);
    toast.success("Invitación creada", { description: `${e} recibirá el puesto ${ROLE_LABELS[role]} al crear su cuenta o iniciar sesión con ese correo. No se envía ningún email automático: compártele el enlace de la app.` });
    void reload(id);
  };
  const remove = async (e: string) => {
    const { error } = await supabase.from("hotel_invites").delete().eq("hotel_id", id).eq("email", e);
    if (error) toast.error(error.message); else void reload(id);
  };
  const patch = async (uid: string, p: Partial<Pick<Member, "active" | "modules">>) => {
    const { error } = await supabase.from("hotel_members").update(p).eq("hotel_id", id).eq("user_id", uid);
    if (error) toast.error("No se pudo guardar", { description: error.message }); else void reload(id);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <SectionTitle>Nuevo empleado</SectionTitle>
        <p className="mb-3 text-sm text-muted-foreground">Crea su ficha; la persona entra con su propia cuenta usando este correo. Los permisos se comprueban en la nube.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input placeholder="Nombre y apellidos" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <Input placeholder="correo@hotel.com" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <Input placeholder="Puesto (p. ej. Recepcionista de noche)" value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })} />
          <select aria-label="Rol" className="h-9 rounded-md border bg-background px-2 text-sm" value={role} onChange={(e) => { setRole(e.target.value as HotelRole); setMods(null); }}>
            {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>
        <div className="mt-3 text-xs font-medium text-muted-foreground">Secciones permitidas</div>
        <div className="mt-1.5"><ModulePicker role={role} value={mods} onChange={setMods} /></div>
        <Button className="mt-3" onClick={add}>Crear ficha e invitar</Button>

        <div className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Invitaciones pendientes</div>
        <ul className="mt-2 space-y-2 text-sm">
          {invites.filter((i) => !joined.has(i.email.toLowerCase())).map((i) => (
            <li key={i.email} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
              <span className="min-w-0"><b>{i.full_name || i.email}</b> · {ROLE_LABELS[i.role]}<span className="block truncate text-xs text-muted-foreground">{i.email}{i.position ? ` · ${i.position}` : ""} · sin cuenta todavía</span></span>
              <Button size="sm" variant="ghost" onClick={() => remove(i.email)}>Anular</Button>
            </li>
          ))}
          {!invites.some((i) => !joined.has(i.email.toLowerCase())) && <li className="text-muted-foreground">No hay invitaciones pendientes.</li>}
        </ul>
      </Card>
      <Card>
        <SectionTitle>Equipo con cuenta</SectionTitle>
        <ul className="space-y-3 text-sm">
          {members.map((m) => (
            <li key={m.user_id} className={`rounded-md border p-3 ${m.active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><b>{m.full_name || m.email || "Empleado"}</b> · {ROLE_LABELS[m.role]}<div className="truncate text-xs text-muted-foreground">{m.email}{m.position ? ` · ${m.position}` : ""}</div></div>
                <Button size="sm" variant={m.active ? "outline" : "default"} onClick={() => patch(m.user_id, { active: !m.active })}>{m.active ? "Desactivar acceso" : "Reactivar acceso"}</Button>
              </div>
              <div className="mt-2 text-xs">{m.active ? <span className="text-st-ready">Acceso activo</span> : <span className="text-muted-foreground">Acceso desactivado · su historial y tareas se conservan</span>}</div>
              {m.active && <div className="mt-2"><ModulePicker role={m.role} value={m.modules} onChange={(v) => patch(m.user_id, { modules: v })} /></div>}
            </li>
          ))}
          {!members.length && <li className="text-muted-foreground">Nadie ha entrado todavía con una invitación.</li>}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">Solo el propietario da o quita accesos. Las secciones de cada persona nunca superan las de su rol.</p>
      </Card>
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
