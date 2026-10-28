import { effectiveNav } from "./staff-access";
import { claimInvites, loadConfig, overlayHotel, myMemberships, saveRoomConfig, type CloudConfig, type HotelRole } from "./cloud";
import { canEditRoom } from "./room-permissions";
import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

/** Toasts are muted while the activity simulator drives actions */
let quiet = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const say: any = Object.assign((...a: any[]) => (quiet ? undefined : (toast as any)(...a)), {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  success: (...a: any[]) => (quiet ? undefined : (toast.success as any)(...a)),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (...a: any[]) => (quiet ? undefined : (toast.error as any)(...a)),
});
import {
  DEMO_DATE, ROLES, START_CLOCK, seedGuests, seedIncidents, seedLog, seedNotifications, seedOpportunities,
  seedReservations, seedRooms, seedRules, seedTasks, seedHotels, type Hotel, type Floor, type Organization, type Channel,
  type Guest, type HotelKey, type Incident, type LogEntry, type Notification, type Opportunity, type Priority,
  type Reservation, type Account, type RoleKey, type Room, type RoomState, type SentMessage, type Task, type MessageRule,
  type RoomEdit, validateRoomEdit, applyRoomEdit, checkStayChange, stayAmount,
} from "./data";
import { SuiteCtx } from "./context";
import { supabase } from "@/integrations/supabase/client";
interface CloudState { account?: Account; hotels?: Hotel[]; data?: Record<string, Data> }
/** Hotels a user may see: shared demo hotels plus their own — never another account's */
export function visibleHotels(hotels: Hotel[], user: string | undefined): Hotel[] {
  return hotels.filter((h) => !h.owner || (!!user && h.owner === user));
}
/** Only the most recent save may set the save status */
export function isLatest(seq: number, current: number): boolean { return seq === current; }

interface Data {
  clock: number;
  rooms: Room[]; guests: Guest[]; reservations: Reservation[]; tasks: Task[]; incidents: Incident[];
  log: LogEntry[]; notifications: Notification[]; opportunities: Opportunity[]; rules: MessageRule[]; sent: SentMessage[];
}
/** Merged view of the active hotel — what screens read */
interface State extends Data { role: RoleKey; hotel: HotelKey }
interface Root { role: RoleKey; hotel: HotelKey; hotels: Hotel[]; data: Record<string, Data>; sim?: boolean; org?: Organization; accounts?: Account[]; user?: string | undefined }

const grandData: Data = {
  clock: START_CLOCK,
  rooms: seedRooms, guests: seedGuests.map((g) => ({ ...g, messaging: ["g2", "g3", "g5", "g6", "g7", "g8", "g10"].includes(g.id) })),
  reservations: seedReservations, tasks: seedTasks, incidents: seedIncidents, log: seedLog,
  notifications: seedNotifications, opportunities: seedOpportunities, rules: seedRules,
  sent: [
    { id: "s1", time: "08:00", guest: "Sofía Martín", rule: "Buenos días", result: "enviado" },
    { id: "s2", time: "08:00", guest: "Marco Rossi", rule: "Buenos días", result: "enviado" },
    { id: "s3", time: "08:00", guest: "Elena García", rule: "Buenos días", result: "omitido", reason: "Check-out realizado — no se envía" },
  ],
};

const TYPES = ["Doble Estándar", "Doble Superior", "Junior Suite", "Suite"];
const RATES = [120, 150, 210, 290];
/** Generates rooms for a new hotel: 10 per floor, numbered 101, 102… */
export function generateRooms(count: number, rateBoost = 0): Room[] {
  return Array.from({ length: count }, (_, i) => {
    const floor = Math.floor(i / 10) + 1, t = i % 10 < 5 ? 0 : i % 10 < 8 ? 1 : i % 10 < 9 ? 2 : 3;
    return { number: `${floor}${String((i % 10) + 1).padStart(2, "0")}`, floor, type: TYPES[t]!, rate: RATES[t]! + rateBoost, hk: "clean", oos: false };
  });
}
export function emptyData(rooms: Room[]): Data {
  return { clock: START_CLOCK, rooms, guests: [], reservations: [], tasks: [], incidents: [], log: [], notifications: [], opportunities: [], rules: seedRules, sent: [] };
}

function beachData(): Data {
  const rooms = generateRooms(20, 60);
  const mk = (id: string, name: string, country: string, lang: string): Guest => ({ id, name, country, lang, doc: `PAS ${id.toUpperCase()}8841`, phone: "+34 600 900 " + id.slice(1).padStart(3, "0"), email: `${id}@demo-mail.com`, companions: [], notes: "", messaging: true });
  const guests = [mk("b1", "Sven Larsen", "SE", "Inglés"), mk("b2", "Claire Martin", "FR", "Francés"), mk("b3", "Javier Morales", "ES", "Español"), mk("b4", "Ingrid Berg", "NO", "Inglés"), { ...mk("b5", "Paula Navarro", "ES", "Español"), messaging: false }];
  const rate = (n: string) => rooms.find((r) => r.number === n)!.rate;
  const R = (id: string, g: string, room: string, i: number, o: number, eta: string, stay: Reservation["stay"], channel: Reservation["channel"]): Reservation =>
    ({ id, guestId: g, room, inDay: i, outDay: o, eta, pax: 2, channel, amount: rate(room) * (o - i), status: "confirmed", stay, notes: "", createdDay: -10 });
  return {
    ...emptyData(rooms.map((r) => (r.number === "106" ? { ...r, hk: "dirty" as const } : r))),
    guests,
    reservations: [R("B-301", "b1", "101", -3, 2, "—", "inhouse", "Booking.com"), R("B-302", "b2", "102", -1, 0, "—", "inhouse", "Expedia"),
      R("B-303", "b3", "106", 0, 3, "15:00", "none", "Web directa"), R("B-304", "b4", "201", -2, 4, "—", "inhouse", "Airbnb"), R("B-305", "b5", "107", 1, 5, "16:00", "none", "Recepción")],
    tasks: [{ id: "BT-1", title: "Limpieza post check-out", room: "106", assignee: "María López", dept: "housekeeping", priority: "alta", day: 0, deadline: "14:30", status: "pendiente", comments: "Check-in Javier Morales 15:00.", nextCheckIn: "15:00", kind: "limpieza" }],
    log: [{ id: "bl1", time: "11:20", actor: "Ana Torres", text: "Check-out habitación 106.", kind: "human" }],
  };
}

const initialRoot = (): Root => ({ role: "owner", hotel: "grand", hotels: seedHotels, data: { grand: grandData, beach: beachData() } });
const STORAGE = "suite-demo-v3";

export const fmtClock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const toMin = (t: string) => { const [h = 0, m = 0] = t.split(":").map(Number); return h * 60 + (m || 0); };
export const dayDate = (off: number) => new Date(DEMO_DATE.getFullYear(), DEMO_DATE.getMonth(), DEMO_DATE.getDate() + off);
export const fmtDay = (off: number) => {
  if (off === 0) return "Hoy";
  if (off === 1) return "Mañana";
  if (off === -1) return "Ayer";
  return dayDate(off).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
};
export const eur = (n: number) => `${Math.round(n).toLocaleString("es-ES")} €`;

export type ResDisplay = "Confirmada" | "Check-in pendiente" | "IN HOUSE" | "Check-out pendiente" | "Finalizada" | "Cancelada" | "No-show";
export function resDisplay(r: Reservation): ResDisplay {
  if (r.status === "cancelled") return "Cancelada";
  if (r.status === "noshow") return "No-show";
  if (r.stay === "finished") return "Finalizada";
  if (r.stay === "inhouse") return r.outDay <= 0 ? "Check-out pendiente" : "IN HOUSE";
  if (r.inDay === 0) return "Check-in pendiente";
  return "Confirmada";
}

const id = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function useSuiteState() {
  const [root, setRoot] = useState<Root>(initialRoot);
  const [loaded, setLoaded] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [config, setConfig] = useState<CloudConfig | null>(null);
  const [memberships, setMemberships] = useState<{ hotel_id: string; role: HotelRole; modules: string[] | null }[]>([]);
  const [cloud, setCloud] = useState<"local" | "loading" | "saved" | "pending" | "error">("local");
  const remoteLoaded = useRef(false);
  useEffect(() => {
    try { const raw = localStorage.getItem(STORAGE); if (raw) setRoot(JSON.parse(raw) as Root); } catch { /* ignore corrupt storage */ }
    setLoaded(true);
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((ev, sess) => {
      if (ev === "SIGNED_IN" || ev === "SIGNED_OUT" || ev === "INITIAL_SESSION") setUid(sess?.user.id ?? null);
      // Session ended anywhere (expiry, other tab): stop showing the previous user
      if (ev === "SIGNED_OUT") setRoot((r) => ({ ...r, user: undefined }));
      // A different real account signed in: never keep the previous user's identity
      if (ev === "SIGNED_IN" && sess?.user.email) setRoot((r) => (r.user && r.user !== sess.user.email ? { ...r, user: undefined } : r));
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (loaded) localStorage.setItem(STORAGE, JSON.stringify(root)); }, [root, loaded]);

  /** Load the company's saved world from the backend once signed in */
  useEffect(() => {
    remoteLoaded.current = false;
    setConfig(null); setMemberships([]);
    if (!uid) { setCloud("local"); return; }
    setCloud("loading");
    supabase.from("company_worlds").select("state").eq("owner_id", uid).maybeSingle().then(async ({ data, error }) => {
      if (error) { setCloud("error"); return; }
      const st = data?.state as CloudState | undefined; const sh = st?.hotels ?? [];
      if (st?.account && Array.isArray(st.hotels)) {
        setRoot((r) => {
          const email = st.account!.email;
          const keep = r.hotels.filter((h) => h.owner !== email);
          const accounts = [...(r.accounts ?? []).filter((a) => a.email !== email), st.account!];
          const mine = sh[0]?.id;
          return { ...r, accounts, user: email, org: st.account!.org, role: "owner", hotels: [...keep, ...sh], data: { ...r.data, ...st.data }, hotel: mine ?? r.hotel };
        });
      } else {
        // No saved world yet: bind the real signed-in user so their first changes get saved
        const { data: u } = await supabase.auth.getUser();
        const email = u.user?.email;
        if (email) {
          const { data: p } = await supabase.from("profiles").select("display_name, company_name").eq("id", uid).maybeSingle();
          setRoot((r) => {
            const existing = (r.accounts ?? []).find((a) => a.email === email);
            if (existing) return { ...r, user: email, org: existing.org, role: "owner" };
            const [name = "", ...rest] = (p?.display_name ?? "").split(" ");
            const org = { ...(r.org ?? {}), name: p?.company_name || r.org?.name || "" } as Organization;
            const acc: Account = { email, password: "", name, surname: rest.join(" "), position: "", role: "owner", org };
            return { ...r, accounts: [...(r.accounts ?? []), acc], user: email, org, role: "owner" };
          });
        }
      }
      // Stored hotel/floor/room records are the source of truth for configuration
      await claimInvites();
      const [cfg, roles] = await Promise.all([loadConfig(), myMemberships()]);
      setConfig(cfg); setMemberships(roles);
      if (cfg) setRoot((r) => {
        const hotels = [...r.hotels]; const data = { ...r.data };
        hotels.forEach((h, i) => {
          if (!h.owner || !data[h.id]) return;
          const o = overlayHotel(h, data[h.id]!.rooms, cfg);
          hotels[i] = o.hotel; data[h.id] = { ...data[h.id]!, rooms: o.rooms };
        });
        cfg.hotels.filter((h) => !h.archived && !hotels.some((x) => x.id === h.key)).forEach((h) => {
          const base: Hotel = { id: h.key, name: h.name, address: h.address, city: h.city, category: h.category, owner: `cloud:${h.org_owner}`, rooms: 0, logo: h.name.slice(0, 2), status: "activo" };
          const rooms: Room[] = cfg.rooms.filter((x) => x.hotel_id === h.id && !x.archived).map((x) => ({ number: x.number, floor: x.floor, type: x.type, rate: Number(x.rate), hk: "clean", oos: false }));
          const over = overlayHotel(base, rooms, cfg);
          hotels.push({ ...over.hotel, rooms: rooms.length }); data[h.key] = emptyData(over.rooms);
        });
        return { ...r, hotels, data };
      });
      remoteLoaded.current = true;
      setCloud("saved");
    });
  }, [uid]);

  /** Save the signed-in owner's hotels + operational data (debounced, written strictly in order) */
  const saveSeq = useRef(0);
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    if (!uid || !remoteLoaded.current || !root.user) return;
    const account = (root.accounts ?? []).find((a) => a.email === root.user);
    if (!account) return;
    setCloud("pending");
    const t = setTimeout(() => {
      const hotels = root.hotels.filter((h) => h.owner === root.user);
      const data: Record<string, Data> = {};
      hotels.forEach((h) => { if (root.data[h.id]) data[h.id] = root.data[h.id]!; });
      const state = JSON.parse(JSON.stringify({ account: { ...account, password: "" }, hotels, data }));
      const seq = ++saveSeq.current;
      saveChain.current = saveChain.current.then(async () => {
        const { error } = await supabase.from("company_worlds").upsert({ owner_id: uid, name: "Mi Isla", state }, { onConflict: "owner_id" });
        if (!error) {
          const fresh = await loadConfig();
          if (fresh && isLatest(seq, saveSeq.current)) setConfig(fresh);
        }
        if (error) { console.error("[Suite] cloud save failed", error.message); toast.error("Error al guardar en la nube", { description: error.message }); }
        if (isLatest(seq, saveSeq.current)) setCloud(error ? "error" : "saved");
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [root, uid]);

  const visible = root.hotels.filter((h) => visibleHotels([h], root.user).length || config?.hotels.some((c) => c.key === h.id && !c.archived));
  const hotel = visible.find((h) => h.id === root.hotel) ?? visible[0] ?? root.hotels.find((h) => !h.owner) ?? root.hotels[0]!;
  const record = config?.hotels.find((h) => h.key === hotel.id && !h.archived);
  const memberRole = record ? record.org_owner === uid ? "owner" : memberships.find((m) => m.hotel_id === record.id)?.role : undefined;
  const membership = record && memberRole !== "owner" ? memberships.find((m) => m.hotel_id === record.id) : undefined;
  const navAccess = membership ? effectiveNav(NAV_ACCESS[membership.role], membership.role, membership.modules) : NAV_ACCESS[(memberRole ?? root.role) as RoleKey];
  const canEditRoomConfig = record ? canEditRoom(memberRole) : !hotel.owner && canEditRoom(root.role);
  const s: State = useMemo(() => ({ ...(root.data[hotel.id] ?? root.data[root.hotels[0]!.id])!, role: memberRole ?? root.role, hotel: hotel.id }), [root, hotel.id, memberRole]);
  /** All actions write through the active hotel's slice — single source of truth */
  const setS = (fn: (p: State) => State) => setRoot((r) => {
    const { role, hotel: h, ...d } = fn({ ...r.data[r.hotel]!, role: r.role, hotel: r.hotel });
    return { ...r, role, hotel: h, data: { ...r.data, [r.hotel]: d } };
  });

  const helpers = useMemo(() => {
    const occupant = (room: string) => s.reservations.find((r) => r.room === room && r.stay === "inhouse");
    const nextArrival = (room: string) =>
      s.reservations.filter((r) => r.room === room && r.status === "confirmed" && r.stay === "none" && r.inDay >= 0).sort((a, b) => a.inDay - b.inDay)[0];
    const guest = (gid: string) => s.guests.find((g) => g.id === gid)!;
    const roomState = (num: string): RoomState => {
      const room = s.rooms.find((x) => x.number === num)!;
      if (room.oos) return "oos";
      if (s.incidents.some((i) => i.room === num && i.blocking && i.status !== "resuelta")) return "maintenance";
      if (occupant(num)) return "occupied";
      if (room.hk === "cleaning") return "cleaning";
      if (room.hk === "dirty" || room.hk === "inspect") return "dirty";
      return "ready";
    };
    return { occupant, nextArrival, guest, roomState };
  }, [s]);

  /** Exceptions & action center — computed from live state */
  const alerts = useMemo(() => {
    const out: { id: string; level: "URGENTE" | "ALTA" | "MEDIA" | "OPORTUNIDAD"; title: string; detail: string; link: string; notify?: string }[] = [];
    s.reservations.filter((r) => r.inDay === 0 && r.stay === "none" && r.status === "confirmed").forEach((r) => {
      const st = helpers.roomState(r.room);
      const mins = toMin(r.eta) - s.clock;
      if (st !== "ready" && mins <= 120) {
        out.push({
          id: `a-ci-${r.id}`, level: "URGENTE",
          title: `Habitación ${r.room} todavía no está lista.`,
          detail: `Check-in ${helpers.guest(r.guestId).name} ${mins > 0 ? `en ${mins} minutos` : "con retraso"} · estado: ${st === "cleaning" ? "LIMPIEZA EN PROCESO" : st === "dirty" ? "PENDIENTE DE LIMPIEZA" : "BLOQUEADA"}.`,
          link: "/habitaciones", notify: "Housekeeping · Recepción · Dirección",
        });
      }
    });
    s.incidents.filter((i) => i.status !== "resuelta").forEach((i) => {
      const age = s.clock - toMin(i.createdAt);
      if (age > 180) out.push({ id: `a-inc-${i.id}`, level: "ALTA", title: `Incidencia sin resolver · ${i.category.toLowerCase()} habitación ${i.room}.`, detail: `Abierta hace ${Math.floor(age / 60)} h ${age % 60} min · ${i.assignee}.`, link: "/tareas", notify: "Mantenimiento · Dirección" });
      else if (i.blocking) out.push({ id: `a-inc-${i.id}`, level: "ALTA", title: `Incidencia ${i.category.toLowerCase()} habitación ${i.room}.`, detail: i.description, link: "/tareas" });
    });
    const dirty = s.rooms.filter((r) => ["dirty"].includes(helpers.roomState(r.number))).length;
    if (dirty > 0) out.push({ id: "a-dirty", level: "MEDIA", title: `${dirty} ${dirty > 1 ? "habitaciones" : "habitación"} pendiente${dirty > 1 ? "s" : ""} de limpieza.`, detail: "Asignadas a housekeeping.", link: "/tareas" });
    s.opportunities.filter((o) => o.status === "nueva" && o.level === "alta").forEach((o) =>
      out.push({ id: `a-op-${o.id}`, level: "OPORTUNIDAD", title: `Revenue detectó una oportunidad para ${o.dates}.`, detail: `Ocupación ${o.occupancy}% · pickup ${o.pickup} · impacto +${eur(o.impact)}.`, link: "/control" }));
    return out;
  }, [s, helpers]);

  const actions = useMemo(() => {
    const actor = ROLES[s.role].person;
    const push = (st: State, entries: Omit<LogEntry, "id" | "time">[], minutes = 1): State => {
      const clock = st.clock + minutes;
      const t = fmtClock(clock);
      return { ...st, clock, log: [...entries.map((e) => ({ ...e, id: id("l"), time: t })).reverse(), ...st.log] };
    };
    const notify = (st: State, roles: RoleKey[], text: string, tone: Notification["tone"] = "info"): State => ({
      ...st, notifications: [{ id: id("n"), roles, text, time: fmtClock(st.clock), read: false, tone }, ...st.notifications],
    });

    const api = {
      setRole: (role: RoleKey) => setS((p) => ({ ...p, role })),
      setHotel: (h: HotelKey) => setRoot((r) => ({ ...r, hotel: h })),
      resetDemo: () => { setRoot(initialRoot()); say.success("Demo reiniciada", { description: "Datos iniciales restaurados." }); },
      setOrg: (org: Organization) => setRoot((r) => ({ ...r, org })),
      signUp: async (a: Account, returnPath?: string) => {
        if ((root.accounts ?? []).some((x) => x.email === a.email)) { say.error("Ese email ya tiene cuenta"); return false; }
        // Create the secure account first; never continue with a browser-only account if it is rejected
        const redirect = returnPath?.startsWith("/invitacion?token=") ? `${window.location.origin}${returnPath}` : window.location.origin;
        const { data, error } = await supabase.auth.signUp({ email: a.email, password: a.password, options: { emailRedirectTo: redirect, data: { display_name: `${a.name} ${a.surname}`.trim(), company_name: a.org.name } } });
        if (error) { say.error("No se pudo crear la cuenta", { description: error.code === "weak_password" ? "La contraseña es demasiado débil o aparece en filtraciones conocidas. Elige otra más larga y única." : error.message }); return false; }
        setRoot((r) => ({ ...r, accounts: [...(r.accounts ?? []), a], user: a.email, org: a.org, role: "owner" as RoleKey }));
        if (!data.session) say("Revisa tu correo", { description: "Confirma tu email para guardar tu hotel en la nube." });
        return true;
      },
      signIn: async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error) return true; // saved world loads automatically
        // Never fall back to a browser-only session: it would look signed in while nothing reaches the cloud
        const reason = error.code === "email_not_confirmed" ? "Confirma tu correo con el enlace que te enviamos y vuelve a intentarlo." : error.code === "invalid_credentials" ? "Email o contraseña incorrectos." : error.message;
        say.error("No se pudo iniciar sesión en la nube", { description: reason });
        return false;
      },
      signOut: () => { supabase.auth.signOut(); setRoot((r) => ({ ...r, user: undefined })); },
      createHotel: (input: { name: string; address: string; city: string; category: string; description?: string; floors: Floor[]; rooms: Room[]; zones?: string[]; departments?: string[]; checkIn?: string; checkOut?: string; facade?: { primary: string; secondary: string } }) => {
        const hid = id("h");
        const h: Hotel = {
          id: hid, name: input.name, address: input.address, city: input.city, category: input.category, description: input.description ?? "",
          rooms: input.rooms.length, floors: input.floors, owner: root.user, status: "activo", zones: input.zones ?? [], departments: input.departments ?? [], checkIn: input.checkIn ?? "14:00", checkOut: input.checkOut ?? "12:00",
          logo: input.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
          ...(input.facade ? { facade: input.facade } : {}),
        };
        const d = emptyData(input.rooms);
        d.log = [{ id: id("l"), time: fmtClock(START_CLOCK), actor: "Suite", text: `Hotel digital generado: ${input.floors.length} plantas · ${input.rooms.length} habitaciones · ${(input.zones ?? []).length} zonas.`, kind: "suite" }];
        setRoot((r) => ({ ...r, hotel: hid, hotels: [...r.hotels, h], data: { ...r.data, [hid]: d } }));
        return hid;
      },
      setSim: (on: boolean) => setRoot((r) => ({ ...r, sim: on })),
      readAll: () => setS((p) => ({ ...p, notifications: p.notifications.map((n) => (n.roles.includes(p.role) ? { ...n, read: true } : n)) })),

      checkIn: (resId: string) => {
        const r = s.reservations.find((x) => x.id === resId)!;
        const gName = helpers.guest(r.guestId).name;
        if (helpers.roomState(r.room) !== "ready") {
          say.error(`Habitación ${r.room} no está lista`, { description: "Suite bloquea el check-in hasta que housekeeping la marque como LISTA." });
          return false;
        }
        setS((p) => {
          let n: State = {
            ...p,
            reservations: p.reservations.map((x) => (x.id === resId ? { ...x, stay: "inhouse" } : x)),
            guests: p.guests.map((g) => (g.id === r.guestId ? { ...g, messaging: true } : g)),
            sent: [{ id: id("s"), time: fmtClock(p.clock + 1), guest: gName, rule: "Bienvenida", result: "enviado" }, ...p.sent],
          };
          n = push(n, [
            { actor, text: `Check-in habitación ${r.room} · ${gName}.`, kind: "human" },
            { actor: "Suite", text: `Reserva ${r.id} → IN HOUSE · habitación ${r.room} → OCUPADA.`, kind: "suite" },
            { actor: "Suite", text: `Comunicaciones In-House activadas para ${gName}. Bienvenida enviada.`, kind: "suite" },
          ]);
          return notify(n, ["director", "owner"], `Check-in completado: ${gName} · ${r.room}.`, "ok");
        });
        say.success("Check-in realizado", { description: "✓ Habitación actualizada\n✓ Huésped ahora está IN HOUSE\n✓ Comunicaciones In-House activadas" });
        return true;
      },

      checkOut: (resId: string) => {
        const r = s.reservations.find((x) => x.id === resId)!;
        const gName = helpers.guest(r.guestId).name;
        const next = s.reservations.find((x) => x.room === r.room && x.id !== r.id && x.status === "confirmed" && x.stay === "none" && x.inDay === 0);
        const nextTom = s.reservations.find((x) => x.room === r.room && x.id !== r.id && x.status === "confirmed" && x.stay === "none" && x.inDay === 1);
        const deadlineMin = next ? Math.max(toMin(next.eta) - 30, s.clock + 30) : s.clock + 180;
        const priority: Priority = next ? (toMin(next.eta) - s.clock < 120 ? "urgente" : "alta") : nextTom ? "media" : "baja";
        const task: Task = {
          id: id("T"), title: "Limpieza post check-out", room: r.room, assignee: "María López", dept: "housekeeping", priority,
          day: 0, deadline: fmtClock(deadlineMin), status: "pendiente", kind: "limpieza",
          nextCheckIn: next ? next.eta : nextTom ? `Mañana ${nextTom.eta}` : undefined,
          comments: next ? `Próximo check-in hoy ${next.eta} · ${helpers.guest(next.guestId).name}.` : "Creada automáticamente por Suite.",
        };
        setS((p) => {
          let n: State = {
            ...p,
            reservations: p.reservations.map((x) => (x.id === resId ? { ...x, stay: "finished", outDay: Math.min(x.outDay, 0) } : x)),
            guests: p.guests.map((g) => (g.id === r.guestId ? { ...g, messaging: false } : g)),
            rooms: p.rooms.map((x) => (x.number === r.room ? { ...x, hk: "dirty" } : x)),
            tasks: [task, ...p.tasks],
          };
          n = push(n, [
            { actor, text: `Check-out habitación ${r.room} · ${gName}.`, kind: "human" },
            { actor: "Suite", text: `Estancia finalizada. Mensajes detenidos para ${gName}.`, kind: "suite" },
            { actor: "Suite", text: `Habitación ${r.room} → PENDIENTE DE LIMPIEZA. Tarea creada · prioridad ${priority.toUpperCase()}.`, kind: "suite" },
          ]);
          return notify(n, ["housekeeping"], `Nueva habitación asignada: ${r.room} (post check-out).`);
        });
        say.success("Check-out completado", { description: "✓ Comunicaciones detenidas\n✓ Limpieza creada automáticamente" });
      },

      startTask: (taskId: string) => {
        const t = s.tasks.find((x) => x.id === taskId)!;
        setS((p) => {
          let n: State = {
            ...p,
            tasks: p.tasks.map((x) => (x.id === taskId ? { ...x, status: "en_proceso", startedAt: fmtClock(p.clock + 1), assignee: x.assignee || actor } : x)),
            rooms: t.dept === "housekeeping" ? p.rooms.map((x) => (x.number === t.room ? { ...x, hk: "cleaning" } : x)) : p.rooms,
            incidents: t.incidentId ? p.incidents.map((i) => (i.id === t.incidentId ? { ...i, status: "en_proceso", startedAt: fmtClock(p.clock + 1) } : i)) : p.incidents,
          };
          n = push(n, [
            { actor, text: `${t.dept === "housekeeping" ? "Empezó limpieza" : "Empezó"} · ${t.title.toLowerCase()} habitación ${t.room}.`, kind: "human" },
            ...(t.dept === "housekeeping" ? [{ actor: "Suite", text: `Habitación ${t.room} → LIMPIEZA EN PROCESO.`, kind: "suite" as const }] : []),
          ]);
          return n;
        });
        say(t.dept === "housekeeping" ? `Limpieza en proceso · ${t.room}` : `Tarea iniciada · ${t.room}`, { description: "Recepción y dirección ven el cambio en tiempo real." });
      },

      finishTask: (taskId: string) => {
        const t = s.tasks.find((x) => x.id === taskId)!;
        setS((p) => {
          let n: State = {
            ...p,
            tasks: p.tasks.map((x) => (x.id === taskId ? { ...x, status: "completada", endedAt: fmtClock(p.clock + 1) } : x)),
            rooms: t.dept === "housekeeping" ? p.rooms.map((x) => (x.number === t.room ? { ...x, hk: "clean" } : x)) : p.rooms,
            incidents: t.incidentId ? p.incidents.map((i) => (i.id === t.incidentId ? { ...i, status: "resuelta", arrivedAt: i.arrivedAt ?? fmtClock(p.clock + 1), resolvedAt: fmtClock(p.clock + 1) } : i)) : p.incidents,
          };
          if (t.dept === "housekeeping") {
            n = push(n, [
              { actor, text: `Marcó habitación ${t.room} como limpia.`, kind: "human" },
              { actor: "Suite", text: `Habitación ${t.room} → LISTA.`, kind: "suite" },
              { actor: "Suite", text: `Recepción recibió actualización: ${t.room} disponible.`, kind: "suite" },
            ]);
            n = notify(n, ["reception", "director", "owner"], `Habitación ${t.room} lista para check-in.`, "ok");
          } else {
            n = push(n, [
              { actor, text: `Resolvió: ${t.title.toLowerCase()} habitación ${t.room}.`, kind: "human" },
              ...(t.incidentId ? [{ actor: "Suite", text: `Incidencia ${t.incidentId} cerrada. Habitación ${t.room} desbloqueada.`, kind: "suite" as const }] : []),
            ]);
            n = notify(n, ["reception", "director", "owner"], `Resuelto: ${t.title} · ${t.room}.`, "ok");
          }
          return n;
        });
        say.success(t.dept === "housekeeping" ? `Habitación ${t.room} LISTA` : `Resuelto · ${t.room}`, {
          description: t.dept === "housekeeping" ? "✓ Recepción notificada\n✓ Alerta de check-in actualizada" : "✓ Incidencia cerrada\n✓ Responsables notificados",
        });
      },

      reportIssue: (input: { room: string; category: string; description: string; photo: boolean; blocking: boolean }) => {
        const incId = id("I");
        const taskId = id("T");
        setS((p) => {
          const t = fmtClock(p.clock + 1);
          let n: State = {
            ...p,
            incidents: [{ ...input, id: incId, status: "abierta", createdAt: t, reporter: actor, assignee: "Carlos Ruiz", taskId }, ...p.incidents],
            tasks: [{
              id: taskId, title: `${input.category}: ${input.description.slice(0, 40)}`, room: input.room, assignee: "Carlos Ruiz", dept: "mantenimiento",
              priority: input.blocking ? "alta" : "media", day: 0, deadline: fmtClock(p.clock + 120), status: "pendiente", comments: input.description,
              kind: "mantenimiento", incidentId: incId,
            }, ...p.tasks],
          };
          n = push(n, [
            { actor, text: `Reportó incidencia ${input.category.toLowerCase()} habitación ${input.room}.`, kind: "human" },
            { actor: "Suite", text: `Tarea de mantenimiento creada y asignada a Carlos Ruiz${input.blocking ? " · habitación BLOQUEADA" : ""}.`, kind: "suite" },
          ]);
          return notify(n, ["maintenance", "director", "owner"], `Nueva incidencia: ${input.category} · ${input.room}.`, "urgent");
        });
        say.success("Incidencia reportada", { description: "✓ Tarea de mantenimiento creada\n✓ Carlos Ruiz notificado" });
      },

      /** Technician reaches the room of an incident in progress */
      arriveIncident: (incId: string) => {
        const inc = s.incidents.find((i) => i.id === incId);
        if (!inc || inc.status !== "en_proceso" || inc.arrivedAt) return;
        setS((p) => push({ ...p, incidents: p.incidents.map((i) => (i.id === incId ? { ...i, arrivedAt: fmtClock(p.clock + 1) } : i)) }, [
          { actor: inc.assignee, text: `Llegó a habitación ${inc.room} · incidencia ${inc.category.toLowerCase()}.`, kind: "human" },
        ], 2));
        say(`${inc.assignee} en habitación ${inc.room}`);
      },

      decideOpportunity: (oid: string, decision: "revisada" | "ignorada") => {
        const o = s.opportunities.find((x) => x.id === oid)!;
        setS((p) => push({ ...p, opportunities: p.opportunities.map((x) => (x.id === oid ? { ...x, status: decision } : x)) }, [
          { actor, text: `${decision === "revisada" ? "Marcó para revisar" : "Ignoró"} recomendación “${o.title}” (${o.dates}). Tarifa sin cambios automáticos.`, kind: "revenue" },
        ]));
        say(decision === "revisada" ? "Recomendación enviada a revisión" : "Recomendación ignorada", { description: "Suite recomienda. Una persona decide." });
      },

      toggleRule: (rid: string) => setS((p) => ({ ...p, rules: p.rules.map((r) => (r.id === rid ? { ...r, active: !r.active } : r)) })),

      simulateRule: (rid: string) => {
        const rule = s.rules.find((r) => r.id === rid)!;
        const candidates = s.reservations.filter((r) => r.status === "confirmed" && (r.stay === "inhouse" || (r.stay === "finished" && r.outDay === 0)));
        const entries: SentMessage[] = candidates.map((r) => {
          const g = helpers.guest(r.guestId);
          if (r.stay !== "inhouse") return { id: id("s"), time: rule.time, guest: g.name, rule: rule.name, result: "omitido", reason: "Check-out realizado — no se envía" };
          if (rid === "m2" && r.outDay <= 1) return { id: id("s"), time: rule.time, guest: g.name, rule: rule.name, result: "omitido", reason: "Sale mañana — no aplica" };
          return { id: id("s"), time: rule.time, guest: g.name, rule: rule.name, result: "enviado" };
        });
        const sent = entries.filter((e) => e.result === "enviado").length;
        setS((p) => push({ ...p, sent: [...entries, ...p.sent] }, [
          { actor: "Suite", text: `Regla “${rule.name}” ejecutada: ${sent} enviados, ${entries.length - sent} omitidos tras verificar estado del huésped.`, kind: "suite" },
        ], 0));
        say.success(`“${rule.name}” simulada`, { description: `${sent} enviados · ${entries.length - sent} omitidos por estado` });
      },
    };

    /** Direct room operations from the digital twin — all go through the same tasks/state */
    const roomOp = (num: string, op: "dirty" | "start" | "finish" | "oos") => {
      const room = s.rooms.find((r) => r.number === num)!;
      const open = s.tasks.find((t) => t.room === num && t.dept === "housekeeping" && t.status !== "completada");
      if (op === "oos") {
        setS((p) => push({ ...p, rooms: p.rooms.map((r) => (r.number === num ? { ...r, oos: !r.oos } : r)) }, [
          { actor, text: `Habitación ${num} → ${room.oos ? "EN SERVICIO" : "FUERA DE SERVICIO"}.`, kind: "human" },
        ]));
        say(room.oos ? `Habitación ${num} en servicio` : `Habitación ${num} fuera de servicio`);
        return;
      }
      if (op === "start" && open && open.status === "pendiente") return api.startTask(open.id);
      if (op === "finish" && open && open.status === "en_proceso") return api.finishTask(open.id);
      if (op === "dirty" || (op === "start" && !open)) {
        const task: Task = { id: id("T"), title: op === "dirty" ? "Limpieza solicitada" : "Limpieza", room: num, assignee: "María López", dept: "housekeeping", priority: "media", day: 0, deadline: fmtClock(s.clock + 90), status: op === "start" ? "en_proceso" : "pendiente", comments: "Creada desde el hotel digital.", kind: "limpieza", ...(op === "start" ? { startedAt: fmtClock(s.clock + 1) } : {}) };
        setS((p) => notify(push({ ...p, tasks: [task, ...p.tasks], rooms: p.rooms.map((r) => (r.number === num ? { ...r, hk: op === "start" ? "cleaning" : "dirty" } : r)) }, [
          { actor, text: op === "dirty" ? `Marcó habitación ${num} pendiente de limpieza.` : `Empezó limpieza habitación ${num}.`, kind: "human" },
          { actor: "Suite", text: `Habitación ${num} → ${op === "dirty" ? "PENDIENTE DE LIMPIEZA" : "LIMPIEZA EN PROCESO"}. Tarea asignada a María López.`, kind: "suite" },
        ]), ["housekeeping"], `Nueva habitación asignada: ${num}.`));
        say(op === "dirty" ? `Habitación ${num} pendiente de limpieza` : `Limpieza en proceso · ${num}`, { description: "✓ Tarea de housekeeping creada" });
      }
    };

    const NAMES = ["Lucía Romero", "Thomas Weber", "Sara Conti", "Ahmed Nasser", "Julia Novak", "Diego Castro", "Mia Jensen", "Oliver King", "Nora Silva", "Leo Fischer"];
    const CHANNELS: Channel[] = ["Booking.com", "Expedia", "Web directa", "Recepción", "Airbnb"];
    const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;
    const addBooking = (today: boolean) => {
      const free = s.rooms.filter((r) => !r.oos && !s.reservations.some((x) => x.room === r.number && x.status === "confirmed" && x.stay !== "finished"));
      if (!free.length) return false;
      const room = pick(free), name = pick(NAMES), gid = id("g"), inDay = today ? 0 : 1 + Math.floor(Math.random() * 6), nights = 1 + Math.floor(Math.random() * 4);
      const channel = pick(CHANNELS);
      const g: Guest = { id: gid, name, doc: `PAS ${gid.slice(-6).toUpperCase()}`, phone: "+34 600 000 000", email: `${gid}@demo-mail.com`, lang: "Español", companions: [], notes: "", country: "ES", messaging: false };
      const res: Reservation = { id: id("R"), guestId: gid, room: room.number, inDay, outDay: inDay + nights, eta: fmtClock(s.clock + 20), pax: 2, channel, amount: room.rate * nights, status: "confirmed", stay: "none", notes: "", createdDay: 0 };
      setS((p) => notify(push({ ...p, guests: [g, ...p.guests], reservations: [res, ...p.reservations] }, [
        { actor: channel, text: `Nueva reserva ${res.id} · ${name} · habitación ${room.number} · ${fmtDay(inDay).toLowerCase()}.`, kind: "channel" },
      ]), ["reception", "owner", "director"], `Nueva reserva ${channel} · ${name}.`, "ok"));
      return true;
    };

    /** One controlled event that mutates the real demo state */
    /** Manual booking from reception — rejects overlapping stays in the same room */
    const createReservation = (input: { name: string; room: string; inDay: number; outDay: number; pax: number; notes: string }) => {
      if (!input.name.trim() || input.outDay <= input.inDay) { say.error("Revisa nombre y fechas"); return false; }
      const room = s.rooms.find((r) => r.number === input.room);
      if (!room || room.oos) { say.error("Habitación no disponible"); return false; }
      const clash = s.reservations.find((x) => x.room === input.room && x.status === "confirmed" && x.stay !== "finished" && x.inDay < input.outDay && input.inDay < x.outDay);
      if (clash) { say.error(`Habitación ${input.room} ocupada en esas fechas`, { description: `Choca con ${clash.id}` }); return false; }
      const gid = id("g");
      const g: Guest = { id: gid, name: input.name.trim(), doc: "—", phone: "—", email: "—", lang: "—", companions: [], notes: "", country: "—", messaging: false };
      const res: Reservation = { id: id("R"), guestId: gid, room: room.number, inDay: input.inDay, outDay: input.outDay, eta: "—", pax: input.pax, channel: "Recepción", amount: stayAmount(room.rate, input.outDay - input.inDay), status: "confirmed", stay: "none", notes: input.notes, createdDay: 0 };
      setS((p) => notify(push({ ...p, guests: [g, ...p.guests], reservations: [res, ...p.reservations] }, [
        { actor, text: `Reserva manual ${res.id} · ${g.name} · habitación ${room.number} · ${fmtDay(input.inDay).toLowerCase()} → ${fmtDay(input.outDay).toLowerCase()}.`, kind: "human" },
      ]), ["reception", "owner", "director"], `Reserva manual · ${g.name} · ${room.number}.`, "ok"));
      say.success("Reserva creada");
      return true;
    };
    /** Extend or shorten a stay: rechecks availability and recalculates the amount at the current nightly rate */
    const changeStay = (rid: string, outDay: number) => {
      const r = s.reservations.find((x) => x.id === rid);
      const nightly = r ? Math.round(r.amount / Math.max(1, r.outDay - r.inDay)) : 0;
      const res = checkStayChange(s.reservations, rid, outDay, nightly);
      if ("error" in res) { say.error(res.error); return false; }
      if (!r || r.outDay === outDay) return false;
      const longer = outDay > r.outDay;
      setS((p) => notify(push({ ...p, reservations: p.reservations.map((x) => x.id === rid ? { ...x, outDay, amount: res.amount } : x) }, [
        { actor, text: `Estancia ${rid} ${longer ? "ampliada" : "acortada"}: salida ${fmtDay(r.outDay).toLowerCase()} → ${fmtDay(outDay).toLowerCase()} · importe ${r.amount} € → ${res.amount} €.`, kind: "human" },
      ]), ["reception", "housekeeping", "owner", "director"], `Habitación ${r.room}: salida ${longer ? "retrasada" : "adelantada"} a ${fmtDay(outDay).toLowerCase()}. Ajusta la limpieza de salida.`, "info"));
      say.success(longer ? "Estancia ampliada" : "Estancia acortada", { description: `Nuevo importe: ${res.amount} €` });
      return true;
    };
    const simulateStep = () => {
      const opts: (() => unknown)[] = [];
      const inhouse = s.reservations.filter((r) => r.stay === "inhouse");
      const arrivals = s.reservations.filter((r) => r.inDay === 0 && r.status === "confirmed" && r.stay === "none" && helpers.roomState(r.room) === "ready");
      const hkPend = s.tasks.filter((t) => t.dept === "housekeeping" && t.status === "pendiente" && helpers.roomState(t.room) === "dirty");
      const hkProg = s.tasks.filter((t) => t.dept === "housekeeping" && t.status === "en_proceso");
      const mtPend = s.tasks.filter((t) => t.dept === "mantenimiento" && t.status === "pendiente");
      const mtProg = s.tasks.filter((t) => t.dept === "mantenimiento" && t.status === "en_proceso");
      if (inhouse.length) opts.push(() => api.checkOut(pick(inhouse.filter((r) => r.outDay <= 0).length ? inhouse.filter((r) => r.outDay <= 0) : inhouse).id));
      if (arrivals.length) opts.push(() => api.checkIn(pick(arrivals).id), () => api.checkIn(pick(arrivals).id));
      if (hkPend.length) opts.push(() => api.startTask(pick(hkPend).id));
      if (hkProg.length) opts.push(() => api.finishTask(pick(hkProg).id), () => api.finishTask(pick(hkProg).id));
      if (mtPend.length) opts.push(() => api.startTask(pick(mtPend).id));
      const enRoute = s.incidents.filter((i) => i.status === "en_proceso" && !i.arrivedAt);
      if (enRoute.length) opts.push(() => api.arriveIncident(pick(enRoute).id), () => api.arriveIncident(pick(enRoute).id));
      const onsite = mtProg.filter((t) => !t.incidentId || s.incidents.find((i) => i.id === t.incidentId)?.arrivedAt);
      if (onsite.length) opts.push(() => api.finishTask(pick(onsite).id));
      opts.push(() => addBooking(true), () => addBooking(false));
      if (Math.random() < 0.25) {
        const cand = s.rooms.filter((r) => !r.oos && !s.incidents.some((i) => i.room === r.number && i.status !== "resuelta"));
        if (cand.length) opts.push(() => api.reportIssue({ room: pick(cand).number, category: pick(["Electricidad", "Fontanería", "Climatización"]), description: pick(["Luz de baño parpadea.", "Grifo del lavabo gotea.", "Termostato no responde."]), photo: false, blocking: false }));
      }
      quiet = true;
      try { pick(opts)(); } finally { quiet = false; }
    };

    /** Edit a room's characteristics only; reservations, tasks and incidents stay untouched */
    const updateRoom = async (num: string, edit: RoomEdit): Promise<boolean> => {
      if (!canEditRoomConfig) { say.error("No tienes permiso para editar esta habitación"); return false; }
      const err = validateRoomEdit(edit);
      if (err) { say.error(err); return false; }
      const room = s.rooms.find((r) => r.number === num);
      if (!room) return false;
      let { room: next, changed } = applyRoomEdit(room, edit);
      if (!changed.length) { say("Sin cambios"); return true; }
      if (record) {
        try { next = await saveRoomConfig(record.id, room, edit); }
        catch (error) { say.error("No se pudo guardar la habitación", { description: error instanceof Error ? error.message : "Inténtalo de nuevo" }); return false; }
      }
      // Capture the original hotel: a delayed cloud response must not edit another hotel's room.
      setRoot((r) => {
        const d = r.data[hotel.id];
        if (!d) return r;
        const updated = push({ ...d, role: r.role, hotel: hotel.id, rooms: d.rooms.map((x) => x.number === num ? applyRoomEdit(x, next).room : x) }, [
          { actor, text: `Habitación ${num} editada: ${changed.join(", ")}.`, kind: "human" },
        ]);
        const { role: _role, hotel: _hotel, ...slice } = updated;
        return { ...r, data: { ...r.data, [hotel.id]: slice } };
      });
      say.success(`Habitación ${num} actualizada`);
      return true;
    };

    return { ...api, roomOp, simulateStep, createReservation, updateRoom, changeStay };
  }, [s, helpers, canEditRoomConfig, record, hotel.id]);

  // Activity simulator: fires a real action every few seconds while enabled
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  useEffect(() => {
    if (!root.sim) return;
    const t = setInterval(() => actionsRef.current.simulateStep(), 2800);
    return () => clearInterval(t);
  }, [root.sim]);

  return { s, sim: !!root.sim, hotel, hotels: visible, world: root.data, org: root.org, ready: loaded && cloud !== "loading", cloud, cloudHotelId: record?.id, canEditRoomConfig, navAccess, user: (root.accounts ?? []).find((a) => a.email === root.user), ...helpers, alerts, actions };
}

type Ctx = ReturnType<typeof useSuiteState>;
export function SuiteProvider({ children }: { children: ReactNode }) {
  const v = useSuiteState();
  return <SuiteCtx.Provider value={v}>{children}</SuiteCtx.Provider>;
}
export function useSuite() {
  const v = useContext(SuiteCtx) as Ctx | null;
  if (!v) throw new Error("SuiteProvider missing");
  return v;
}

export const NAV_ACCESS: Record<RoleKey, string[]> = {
  owner: ["/", "/mundo", "/hotel", "/reservas", "/habitaciones", "/control", "/personal", "/tareas", "/huespedes", "/mensajes", "/integraciones", "/configuracion", "/crear-hotel"],
  director: ["/", "/mundo", "/hotel", "/reservas", "/habitaciones", "/control", "/personal", "/tareas", "/huespedes", "/mensajes", "/configuracion", "/crear-hotel"],
  reception: ["/", "/mundo", "/hotel", "/reservas", "/habitaciones", "/huespedes", "/tareas", "/mensajes"],
  housekeeping: ["/", "/mundo", "/hotel", "/habitaciones", "/tareas"],
  maintenance: ["/", "/mundo", "/hotel", "/habitaciones", "/tareas"],
  revenue: ["/", "/mundo", "/hotel", "/control", "/reservas", "/habitaciones"],
};
