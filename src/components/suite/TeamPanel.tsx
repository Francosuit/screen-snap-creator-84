import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, SectionTitle } from "@/components/suite/ui";
import { ROLE_LABELS, STAFF_ROLES, type HotelRole } from "@/lib/suite/cloud";

interface Invite { email: string; role: HotelRole }
interface Member { user_id: string; role: HotelRole }
interface Audit { id: number; entity: string; entity_key: string; action: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null; at: string }

const FIELDS: Record<string, string> = { name: "nombre", type: "tipo", rate: "tarifa", capacity: "capacidad", beds: "camas", bath: "baño", view: "vista", sqm: "m²", terrace: "terraza", notes: "observaciones", floor: "planta", archived: "archivada", city: "ciudad", address: "dirección", category: "categoría", zones: "zonas" };

function useCloudHotelId(key: string) {
  const [id, setId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    supabase.from("hotels").select("id").eq("key", key).maybeSingle().then(({ data }) => setId(data?.id ?? null));
  }, [key]);
  return id;
}

export function TeamPanel({ hotelKey }: { hotelKey: string }) {
  const id = useCloudHotelId(hotelKey);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState(""); const [role, setRole] = useState<HotelRole>("reception");
  const reload = async (hid: string) => {
    const [i, m] = await Promise.all([
      supabase.from("hotel_invites").select("email, role").eq("hotel_id", hid),
      supabase.from("hotel_members").select("user_id, role").eq("hotel_id", hid),
    ]);
    setInvites((i.data ?? []) as Invite[]); setMembers((m.data ?? []) as Member[]);
  };
  useEffect(() => { if (id) void reload(id); }, [id]);
  if (id === undefined) return <Card><p className="text-sm text-muted-foreground">Cargando…</p></Card>;
  if (id === null) return <Card><p className="text-sm text-muted-foreground">Este hotel aún no está guardado en la nube. Inicia sesión con tu cuenta y espera a «Guardado en la nube».</p></Card>;

  const add = async () => {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) { toast.error("Correo no válido"); return; }
    const { error } = await supabase.from("hotel_invites").upsert({ hotel_id: id, email: e, role });
    if (error) { toast.error("No tienes permiso para dar accesos", { description: error.message }); return; }
    setEmail(""); toast.success("Acceso creado", { description: `${e} entrará como ${ROLE_LABELS[role]} al registrarse o iniciar sesión.` });
    void reload(id);
  };
  const remove = async (e: string) => {
    const { error } = await supabase.from("hotel_invites").delete().eq("hotel_id", id).eq("email", e);
    if (error) toast.error(error.message); else void reload(id);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <SectionTitle>Dar acceso al personal</SectionTitle>
        <p className="mb-3 text-sm text-muted-foreground">La persona entra con este correo y recibe su puesto. Los permisos se comprueban en la nube, no solo en pantalla.</p>
        <div className="flex flex-wrap gap-2">
          <Input className="min-w-48 flex-1" placeholder="correo@hotel.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select aria-label="Puesto" className="rounded-md border bg-background px-2 text-sm" value={role} onChange={(e) => setRole(e.target.value as HotelRole)}>
            {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <Button onClick={add}>Dar acceso</Button>
        </div>
        <ul className="mt-4 space-y-2 text-sm">
          {invites.map((i) => (
            <li key={i.email} className="flex items-center justify-between rounded-md border px-3 py-2">
              <span>{i.email} · <b>{ROLE_LABELS[i.role]}</b></span>
              <Button size="sm" variant="ghost" onClick={() => remove(i.email)}>Quitar</Button>
            </li>
          ))}
          {!invites.length && <li className="text-muted-foreground">Aún no has dado accesos.</li>}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">{members.length} persona(s) con acceso activo.</p>
      </Card>
      <Card>
        <SectionTitle>Qué puede hacer cada puesto</SectionTitle>
        <ul className="space-y-1 text-sm">
          <li><b>Propietario / Dirección:</b> ver y editar hotel, plantas y habitaciones; ver historial.</li>
          <li><b>Revenue:</b> editar tarifas y datos de habitaciones.</li>
          <li><b>Recepción, Housekeeping, Mantenimiento:</b> consultar el hotel y sus habitaciones.</li>
          <li><b>Solo el propietario</b> da o quita accesos.</li>
        </ul>
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
