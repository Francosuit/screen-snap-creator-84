import { visibleHotels, sameIdentity } from "./isolation";
import { authTimeout, signupResult, type SignupResult } from "./auth-flow";
export { visibleHotels } from "./isolation";
import { effectiveNav } from "./staff-access";
import { loadConfig, overlayHotel, myMemberships, saveRoomConfig, saveHotelTimezone, persistHotelTimezones, type CloudConfig, type HotelRole } from "./cloud";
import { canEditRoom } from "./room-permissions";
import { loadOperations, saveOperations, operationChanges, overlayOperations } from './operations';
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
import { DEFAULT_TZ, hotelToday, hotelMinutes, hotelTime, isTimeZone, offsetToYmd } from "./clock";
import { availableRooms, canCancel, canNoShow, checkReservationEdit, withEvent, type ResEdit } from "./reservations";
import { syncReservationCalendar, withReservationCalendar, withTaskCalendar } from "./temporal";
import { deriveRoomState } from "./room-state";
import { supabase } from "@/integrations/supabase/client";
interface CloudState { account?: Account; hotels?: Hotel[]; data?: Record<string, Data> }
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
/** Relative label against `today` (defaults to the demo day 0, so unconnected screens keep their behaviour). */
export const fmtDay = (off: number, today = 0) => {
  if (off === today) return "Hoy";
  if (off === today + 1) return "Mañana";
  if (off === today - 1) return "Ayer";
  return dayDate(off).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
};
export const eur = (n: number) => `${Math.round(n).toLocaleString("es-ES")} €`;

export type ResDisplay = "Confirmada" | "Check-in pendiente" | "IN HOUSE" | "Check-out pendiente" | "Finalizada" | "Cancelada" | "No-show";
/** Display status relative to the hotel day `today` (demo default 0). */
export function resDisplay(r: Reservation, today = 0): ResDisplay {
  if (r.status === "cancelled") return "Cancelada";
  if (r.status === "noshow") return "No-show";
  if (r.stay === "finished") return "Finalizada";
  if (r.stay === "inhouse") return r.outDay <= today ? "Check-out pendiente" : "IN HOUSE";
  if (r.inDay === today) return "Check-in pendiente";
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
  const remoteLoaded = useRef<string | null>(null);
  const currentUid = useRef<string | null>(null);
  const saveSeq = useRef(0);
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  const rootRef = useRef(root);
  rootRef.current = root;
  const operationChain = useRef<Promise<unknown>>(Promise.resolve());
  const operationPending = useRef(0);
  const operationGeneration = useRef(0);
  const [operationCloud, setOperationCloud] = useState<'saved' | 'pending' | 'error'>('saved');
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!uid) return;
    const update = () => setNow(new Date());
    update();
    const timer = setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, [uid]);
  useEffect(() => {
    let alive = true, authEvent = false;
    const identify = (next: string | null) => {
      if (!alive) return;
      if (currentUid.current !== next) {
        currentUid.current = next;
        remoteLoaded.current = null;
        saveSeq.current++;
        operationGeneration.current++;
        operationPending.current = 0;
        setOperationCloud('saved');
        setConfig(null); setMemberships([]);
        setRoot(initialRoot());
        setCloud(next ? "loading" : "local");
      }
      setUid(next); setLoaded(true);
    };
    const { data: sub } = supabase.auth.onAuthStateChange((ev, sess) => {
      if (["SIGNED_IN", "SIGNED_OUT", "INITIAL_SESSION"].includes(ev)) {
        authEvent = true; identify(sess?.user.id ?? null);
      }
    });
    authTimeout(supabase.auth.getSession()).then(({ data }) => { if (!authEvent) identify(data.session?.user.id ?? null); }).catch(() => { if (!authEvent) identify(null); });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    if (uid && remoteLoaded.current === uid) localStorage.setItem(`${STORAGE}:${uid}`, JSON.stringify(root));
    else if (!uid && !root.user) localStorage.setItem(`${STORAGE}:demo`, JSON.stringify(root));
  }, [root, loaded, uid]);

  /** Hydrate only the verified identity; never merge another account or demo into a real world. */
  useEffect(() => {
    let cancelled = false;
    const valid = () => !cancelled && sameIdentity(uid, currentUid.current);
    remoteLoaded.current = null;
    setConfig(null); setMemberships([]);
    if (!uid) { setCloud("local"); return; }
    setCloud("loading");
    const load = async () => {
      const { data: auth, error: authError } = await authTimeout(supabase.auth.getUser());
      if (!valid()) return;
      if (authError || auth.user?.id !== uid || !auth.user.email) throw new Error("Sesión no válida");
      const email = auth.user.email;
      const [world, profile, cfg, roles] = await authTimeout(Promise.all([
        supabase.from("company_worlds").select("state").eq("owner_id", uid).maybeSingle(),
        supabase.from("profiles").select("display_name, company_name").eq("id", uid).maybeSingle(),
        loadConfig(), myMemberships(),
      ]));
      if (!valid()) return;
      if (world.error || profile.error || !cfg) throw new Error(world.error?.message ?? profile.error?.message ?? "No se pudieron recuperar los hoteles");
      const st = world.data?.state as CloudState | undefined;
      let cached: Root | undefined;
      try {
        const raw = localStorage.getItem(`${STORAGE}:${uid}`) ?? localStorage.getItem(STORAGE);
        if (raw) cached = JSON.parse(raw) as Root;
      } catch { /* corrupt cache must not replace remote data */ }
      const oldAccount = cached?.accounts?.find((a) => a.email === email);
      const [name = "", ...rest] = (profile.data?.display_name ?? "").split(" ");
      const org = st?.account?.org ?? oldAccount?.org ?? { name: profile.data?.company_name ?? "", email } as Organization;
      const account: Account = { ...(oldAccount ?? st?.account), email, password: "", name, surname: rest.join(" "), position: "", role: "owner", org };
      // Retain unsaved own hotels from the legacy cache only when no Cloud world exists.
      const own = world.data ? (st?.hotels ?? []).filter((h) => h.owner === email) : visibleHotels(cached?.hotels ?? [], email);
      const source = world.data ? st?.data : cached?.data;
      const hotels: Hotel[] = [];
      const data: Record<string, Data> = {};
      for (const h of own) {
        const d = source?.[h.id] ?? emptyData([]);
        const over = overlayHotel(h, d.rooms, cfg);
        hotels.push(over.hotel); data[h.id] = { ...d, rooms: over.rooms };
      }
      for (const h of cfg.hotels.filter((h) => !h.archived)) {
        if (hotels.some((x) => x.id === h.key)) continue;
        const base: Hotel = { id: h.key, name: h.name, address: h.address, city: h.city, category: h.category, owner: h.org_owner === uid ? email : `cloud:${h.org_owner}`, rooms: 0, logo: h.name.slice(0, 2), status: "activo" };
        const rooms: Room[] = cfg.rooms.filter((x) => x.hotel_id === h.id && !x.archived).map((x) => ({ number: x.number, floor: x.floor, type: x.type, rate: Number(x.rate), hk: "clean", oos: false }));
        const over = overlayHotel(base, rooms, cfg);
        hotels.push({ ...over.hotel, rooms: rooms.length }); data[h.key] = emptyData(over.rooms);
      }
      await Promise.all(cfg.hotels.filter(h => !h.archived).map(async h => {
        const stored = await loadOperations(h.id);
        const slice = data[h.key];
        if (slice) data[h.key] = overlayOperations(slice, stored);
      }));
      if (!valid()) return;
      const selected = hotels.find((h) => h.id === cached?.hotel) ?? hotels[0];
      setConfig(cfg); setMemberships(roles);
      remoteLoaded.current = uid;
      setRoot({ role: "owner", hotel: selected?.id ?? "", hotels, data, accounts: [account], user: email, org, sim: false });
      setCloud(world.data || cfg.hotels.length ? "saved" : "local");
    };
    load().catch((error) => { if (valid()) { setCloud("error"); toast.error("No se pudieron cargar tus hoteles", { description: error instanceof Error ? error.message : "Inténtalo de nuevo" }); } });
    return () => { cancelled = true; };
  }, [uid]);

  /** Serialize saves and discard queued writes after an identity transition. */
  useEffect(() => {
    if (!uid || remoteLoaded.current !== uid || !root.user) return;
    const account = root.accounts?.find((a) => a.email === root.user);
    const hotels = root.hotels.filter((h) => h.owner === root.user);
    if (!account || !hotels.length) return;
    const seq = ++saveSeq.current;
    setCloud("pending");
    const t = setTimeout(() => {
      const data: Record<string, Data> = {};
      hotels.forEach((h) => { const d = root.data[h.id]; if (d) data[h.id] = d; });
      const state = JSON.parse(JSON.stringify({ account: { ...account, password: "" }, hotels, data }));
      saveChain.current = saveChain.current.catch(() => undefined).then(async () => {
        if (!sameIdentity(uid, currentUid.current) || remoteLoaded.current !== uid) return;
        const { error } = await supabase.from("company_worlds").upsert({ owner_id: uid, name: "Mi Isla", state }, { onConflict: "owner_id" });
        if (!sameIdentity(uid, currentUid.current) || !isLatest(seq, saveSeq.current)) return;
        if (error) { setCloud("error"); toast.error("Error al guardar en la nube", { description: error.message }); return; }
        try {
          let fresh = await loadConfig();
          if (fresh && await persistHotelTimezones(hotels, fresh)) fresh = await loadConfig();
          if (sameIdentity(uid, currentUid.current) && isLatest(seq, saveSeq.current)) {
            if (fresh) setConfig(fresh);
            setCloud("saved");
          }
        } catch (error) {
          if (sameIdentity(uid, currentUid.current) && isLatest(seq, saveSeq.current)) {
            setCloud("error");
            toast.error("La zona horaria no terminó de guardarse", { description: error instanceof Error ? error.message : "Inténtalo de nuevo" });
          }
        }
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [root, uid]);

  // Poll shared rows without reinstalling the world or overwriting in-flight local actions.
  useEffect(() => {
    if (!uid || remoteLoaded.current !== uid || !config) return;
    let stopped = false, busy = false;
    const refresh = async () => {
      if (busy || operationPending.current || !sameIdentity(uid, currentUid.current)) return;
      busy = true;
      const generation = operationGeneration.current;
      try {
        const rows = await Promise.all(config.hotels.filter(h => !h.archived).map(async h => ({ key: h.key, stored: await loadOperations(h.id) })));
        if (stopped || operationPending.current || generation !== operationGeneration.current || !sameIdentity(uid, currentUid.current)) return;
        setRoot(r => {
          const data = { ...r.data };
          for (const { key, stored } of rows) {
            const slice = data[key];
            if (slice) data[key] = overlayOperations(slice, stored);
          }
          return JSON.stringify(data) === JSON.stringify(r.data) ? r : { ...r, data };
        });
      } catch { if (!stopped && sameIdentity(uid, currentUid.current)) setOperationCloud('error'); }
      finally { busy = false; }
    };
    const timer = setInterval(() => void refresh(), 8000);
    const focus = () => void refresh();
    window.addEventListener('focus', focus);
    return () => { stopped = true; clearInterval(timer); window.removeEventListener('focus', focus); };
  }, [uid, config]);

  const visible = visibleHotels(root.hotels, uid ? root.user ?? "__loading__" : undefined, config?.hotels.filter((h) => !h.archived).map((h) => h.key));
  const hotel: Hotel = visible.find((h) => h.id === root.hotel) ?? visible[0] ?? { id: "", name: "Sin hoteles", address: "", city: "", category: "", rooms: 0, logo: "", status: "activo" };
  // Single source of "today": demo keeps its fixed day, real hotels use the real clock in their zone.
  const today = hotelToday(uid ? "real" : "demo", hotel.timezone, now);
  const T = today.offset;
  const clockNow = hotelMinutes(today.zone, now);
  /** Real rows get both representations; demo rows stay offset-only so demo and production never mix. */
  const stampTask = (t: Task): Task => (uid ? withTaskCalendar(t) : t);
  const stampRes = (r: Reservation): Reservation => (uid ? withReservationCalendar(r) : r);
  const record = config?.hotels.find((h) => h.key === hotel.id && !h.archived);
  const memberRole = record ? record.org_owner === uid ? "owner" : memberships.find((m) => m.hotel_id === record.id)?.role : undefined;
  const membership = record && memberRole !== "owner" ? memberships.find((m) => m.hotel_id === record.id) : undefined;
  const navAccess = membership ? effectiveNav(NAV_ACCESS[membership.role], membership.role, membership.modules) : uid && record && !memberRole ? [] : NAV_ACCESS[memberRole ?? root.role];
  const canEditRoomConfig = record ? canEditRoom(memberRole) : !uid && !hotel.owner && canEditRoom(root.role);
  const canEditHotelConfig = record ? canEditRoom(memberRole) : !uid && canEditRoom(root.role);
  const s: State = useMemo(() => {
    const data = root.data[hotel.id] ?? emptyData([]);
    return { ...data, clock: uid ? clockNow : data.clock, role: memberRole ?? root.role, hotel: hotel.id };
  }, [root, hotel.id, memberRole, uid, clockNow]);
  const setS = (fn: (p: State) => State) => {
    const r = rootRef.current;
    const d = r.data[hotel.id];
    if (!d || !visible.some((h) => h.id === hotel.id)) return;
    const { role, hotel: h, ...next } = fn({ ...d, clock: uid ? clockNow : d.clock, role: memberRole ?? r.role, hotel: hotel.id });
    const changes = operationChanges(d, next);
    if (uid && changes.length && (!record || remoteLoaded.current !== uid)) { toast.error('Espera a que el hotel termine de guardarse en la nube'); return; }
    const updated = { ...r, role, hotel: h, data: { ...r.data, [hotel.id]: next } };
    rootRef.current = updated;
    setRoot(updated);
    if (!uid || !record || !changes.length) return;
    const identity = uid, hotelId = record.id, key = hotel.id;
    const generation = operationGeneration.current;
    operationPending.current++;
    setOperationCloud('pending');
    operationChain.current = operationChain.current.catch(() => undefined).then(async () => {
      if (!sameIdentity(identity, currentUid.current) || generation !== operationGeneration.current) return;
      try {
        await saveOperations(hotelId, changes);
        if (sameIdentity(identity, currentUid.current) && generation === operationGeneration.current) {
          operationPending.current--;
          if (!operationPending.current) { setOperationCloud('saved'); toast.success('Operación guardada en la nube'); }
        }
      } catch (error) {
        if (!sameIdentity(identity, currentUid.current) || generation !== operationGeneration.current) return;
        operationGeneration.current++;
        operationPending.current = 0;
        setOperationCloud('error');
        toast.error('No se guardó la operación', { description: error instanceof Error ? error.message : 'Inténtalo de nuevo' });
        try {
          const stored = await loadOperations(hotelId);
          if (!sameIdentity(identity, currentUid.current)) return;
          setRoot(current => {
            const slice = current.data[key];
            return slice ? { ...current, data: { ...current.data, [key]: overlayOperations(slice, stored) } } : current;
          });
        } catch { /* Keep error visible; never report a failed write as saved. */ }
      }
    });
  };

  const helpers = useMemo(() => {
    const occupant = (room: string) => s.reservations.find((r) => r.room === room && r.stay === "inhouse");
    const nextArrival = (room: string) =>
      s.reservations.filter((r) => r.room === room && r.status === "confirmed" && r.stay === "none" && r.inDay >= T).sort((a, b) => a.inDay - b.inDay)[0];
    const guest = (gid: string) => s.guests.find((g) => g.id === gid)!;
    const roomState = (num: string): RoomState => {
      const room = s.rooms.find((x) => x.number === num)!;
      return deriveRoomState(room, s.reservations, s.incidents, T);
    };
    return { occupant, nextArrival, guest, roomState, today: T, todayYmd: today.ymd, timeZone: today.zone };
  }, [s, T, today.ymd, today.zone]);

  /** Exceptions & action center — computed from live state */
  const alerts = useMemo(() => {
    const out: { id: string; level: "URGENTE" | "ALTA" | "MEDIA" | "OPORTUNIDAD"; title: string; detail: string; link: string; notify?: string }[] = [];
    s.reservations.filter((r) => r.inDay === T && r.stay === "none" && r.status === "confirmed").forEach((r) => {
      const st = helpers.roomState(r.room);
      const mins = toMin(r.eta) - s.clock;
      if (st !== "ready" && st !== "arrival" && mins <= 120) {
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
  }, [s, helpers, T]);

  const actions = useMemo(() => {
    const account = root.accounts?.find((a) => a.email === root.user);
    const actor = uid ? [account?.name, account?.surname].filter(Boolean).join(" ").trim() || root.user || uid : ROLES[s.role].person;
    const push = (st: State, entries: Omit<LogEntry, "id" | "time">[], minutes = 1): State => {
      const clock = uid ? clockNow : st.clock + minutes;
      const t = fmtClock(clock);
      return { ...st, clock, log: [...entries.map((e) => ({ ...e, id: id("l"), time: t })).reverse(), ...st.log] };
    };
    const actionClock = (st: State, minutes = 1) => uid ? st.clock : st.clock + minutes;
    const notify = (st: State, roles: RoleKey[], text: string, tone: Notification["tone"] = "info"): State => ({
      ...st, notifications: [{ id: id("n"), roles, text, time: fmtClock(uid ? clockNow : st.clock), read: false, tone }, ...st.notifications],
    });

    const api = {
      setRole: (role: RoleKey) => { if (!uid) setS((p) => ({ ...p, role })); },
      setHotel: (h: HotelKey) => { if (visible.some((x) => x.id === h)) setRoot((r) => ({ ...r, hotel: h })); },
      resetDemo: () => { if (uid) return; setRoot(initialRoot()); say.success("Demo reiniciada", { description: "Datos iniciales restaurados." }); },
      setOrg: (org: Organization) => setRoot((r) => ({ ...r, org })),
      signUp: async (a: Account, returnPath?: string): Promise<SignupResult> => {
        // Create the secure account first; never continue with a browser-only account if it is rejected
        const redirect = returnPath?.startsWith("/invitacion?token=") ? `${window.location.origin}${returnPath}` : window.location.origin;
        try {
          const { data, error } = await authTimeout(supabase.auth.signUp({ email: a.email, password: a.password, options: { emailRedirectTo: redirect, data: { display_name: `${a.name} ${a.surname}`.trim(), company_name: a.org.name } } }));
          if (error) { say.error("No se pudo crear la cuenta", { description: error.code === "weak_password" ? "La contraseña es demasiado débil o aparece en filtraciones conocidas. Elige otra más larga y única." : error.message }); return "error"; }
          // Only verified Cloud hydration may install the signed-in account.
          return signupResult(data);
        } catch (error) {
          say.error("No se pudo crear la cuenta", { description: error instanceof Error ? error.message : "Inténtalo de nuevo" });
          return "error";
        }
      },
      signIn: async (email: string, password: string) => {
        try {
        const { error } = await authTimeout(supabase.auth.signInWithPassword({ email, password }));
        if (!error) return true; // saved world loads automatically
        // Never fall back to a browser-only session: it would look signed in while nothing reaches the cloud
        const reason = error.code === "email_not_confirmed" ? "Confirma tu correo con el enlace que te enviamos y vuelve a intentarlo." : error.code === "invalid_credentials" ? "Email o contraseña incorrectos." : error.message;
        say.error("No se pudo iniciar sesión en la nube", { description: reason });
        return false;
        } catch (error) {
          say.error("No se pudo iniciar sesión", { description: error instanceof Error ? error.message : "Inténtalo de nuevo" });
          return false;
        }
      },
      signOut: () => { currentUid.current = null; remoteLoaded.current = null; saveSeq.current++; setUid(null); setRoot(initialRoot()); supabase.auth.signOut(); },
      createHotel: (input: { name: string; address: string; city: string; category: string; description?: string; floors: Floor[]; rooms: Room[]; zones?: string[]; departments?: string[]; checkIn?: string; checkOut?: string; timezone?: string; facade?: { primary: string; secondary: string } }) => {
        if (!uid || remoteLoaded.current !== uid || !root.user || (record && record.org_owner !== uid)) { say.error("Inicia sesión como propietario para crear un hotel"); return; }
        const timezone = input.timezone ?? DEFAULT_TZ;
        if (!isTimeZone(timezone)) { say.error("Selecciona una zona horaria válida"); return; }
        const hid = id("h");
        const h: Hotel = {
          id: hid, name: input.name, address: input.address, city: input.city, category: input.category, description: input.description ?? "",
          rooms: input.rooms.length, floors: input.floors, owner: root.user, status: "activo", zones: input.zones ?? [], departments: input.departments ?? [], checkIn: input.checkIn ?? "14:00", checkOut: input.checkOut ?? "12:00", timezone,
          logo: input.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
          ...(input.facade ? { facade: input.facade } : {}),
        };
        const d = emptyData(input.rooms);
        d.log = [{ id: id("l"), time: fmtClock(uid ? clockNow : START_CLOCK), actor: "Suite", text: `Hotel digital generado: ${input.floors.length} plantas · ${input.rooms.length} habitaciones · ${(input.zones ?? []).length} zonas.`, kind: "suite" }];
        setRoot((r) => ({ ...r, hotel: hid, hotels: [...r.hotels, h], data: { ...r.data, [hid]: d } }));
        return hid;
      },
      setSim: (on: boolean) => { if (!uid) setRoot((r) => ({ ...r, sim: on })); },
      readAll: () => setS((p) => ({ ...p, notifications: p.notifications.map((n) => (n.roles.includes(p.role) ? { ...n, read: true } : n)) })),

      checkIn: (resId: string) => {
        const r = s.reservations.find((x) => x.id === resId);
        if (!r || r.status !== "confirmed" || r.stay !== "none" || r.inDay > T || r.outDay <= T) {
          say.error("La reserva no está disponible para check-in hoy");
          return false;
        }
        const gName = helpers.guest(r.guestId).name;
        if (!["ready", "arrival"].includes(helpers.roomState(r.room))) {
          say.error(`Habitación ${r.room} no está lista`, { description: "Suite bloquea el check-in hasta que housekeeping la marque como LISTA." });
          return false;
        }
        setS((p) => {
          let n: State = {
            ...p,
            reservations: p.reservations.map((x) => (x.id === resId ? withEvent({ ...x, stay: "inhouse" }, { at: fmtClock(actionClock(p)), day: T, actor, text: `Check-in en habitación ${x.room}` }) : x)),
            guests: uid ? p.guests : p.guests.map((g) => (g.id === r.guestId ? { ...g, messaging: true } : g)),
            sent: uid ? p.sent : [{ id: id("s"), time: fmtClock(actionClock(p)), guest: gName, rule: "Bienvenida", result: "enviado" }, ...p.sent],
          };
          n = push(n, [
            { actor, text: `Check-in habitación ${r.room} · ${gName}.`, kind: "human" },
            { actor: "Suite", text: `Reserva ${r.id} → IN HOUSE · habitación ${r.room} → OCUPADA.`, kind: "suite" },
            ...(!uid ? [{ actor: "Suite", text: `Comunicaciones In-House activadas para ${gName}. Bienvenida enviada.`, kind: "suite" as const }] : []),
          ]);
          return notify(n, ["director", "owner"], `Check-in completado: ${gName} · ${r.room}.`, "ok");
        });
        say.success("Check-in realizado", { description: "✓ Habitación actualizada\n✓ Huésped ahora está IN HOUSE\n✓ Comunicaciones In-House activadas" });
        return true;
      },

      checkOut: (resId: string) => {
        const current = rootRef.current.data[hotel.id];
        const r = current?.reservations.find((x) => x.id === resId);
        if (!r || r.stay !== "inhouse" || !Number.isInteger(r.inDay) || T <= r.inDay) return false;
        const gName = helpers.guest(r.guestId).name;
        const next = s.reservations.find((x) => x.room === r.room && x.id !== r.id && x.status === "confirmed" && x.stay === "none" && x.inDay === T);
        const nextTom = s.reservations.find((x) => x.room === r.room && x.id !== r.id && x.status === "confirmed" && x.stay === "none" && x.inDay === T + 1);
        const deadlineMin = next ? Math.max(toMin(next.eta) - 30, s.clock + 30) : s.clock + 180;
        const priority: Priority = next ? (toMin(next.eta) - s.clock < 120 ? "urgente" : "alta") : nextTom ? "media" : "baja";
        const task: Task = stampTask({
          id: id("T"), title: "Limpieza post check-out", room: r.room, assignee: uid ? "" : "María López", dept: "housekeeping", priority,
          day: T, deadline: fmtClock(deadlineMin), status: "pendiente", kind: "limpieza",
          // Real hotels store the explicit date instead of a relative word that goes stale.
          nextCheckIn: next ? next.eta : nextTom ? `${uid ? offsetToYmd(T + 1) : "Mañana"} ${nextTom.eta}` : undefined,
          comments: next ? `Próximo check-in hoy ${next.eta} · ${helpers.guest(next.guestId).name}.` : "Creada automáticamente por Suite.",
        });
        setS((p) => {
          let n: State = {
            ...p,
            reservations: p.reservations.map((x) => (x.id === resId ? withEvent(syncReservationCalendar({ ...x, stay: "finished", outDay: Math.min(x.outDay, T) }), { at: fmtClock(actionClock(p)), day: T, actor, text: `Check-out de habitación ${x.room}` }) : x)),
            guests: p.guests.map((g) => (g.id === r.guestId ? { ...g, messaging: false } : g)),
            rooms: p.rooms.map((x) => (x.number === r.room ? { ...x, hk: "dirty" } : x)),
            tasks: p.tasks.some(t => t.room === r.room && t.dept === "housekeeping" && t.status !== "completada") ? p.tasks : [task, ...p.tasks],
          };
          n = push(n, [
            { actor, text: `Check-out habitación ${r.room} · ${gName}.`, kind: "human" },
            { actor: "Suite", text: `Estancia finalizada. Mensajes detenidos para ${gName}.`, kind: "suite" },
            { actor: "Suite", text: `Habitación ${r.room} → PENDIENTE DE LIMPIEZA. Tarea creada · prioridad ${priority.toUpperCase()}.`, kind: "suite" },
          ]);
          return notify(n, ["housekeeping"], `Nueva limpieza pendiente: ${r.room} (post check-out).`);
        });
        say.success("Check-out completado", { description: "✓ Comunicaciones detenidas\n✓ Limpieza creada automáticamente" });
        return true;
      },

      startTask: (taskId: string) => {
        const t = rootRef.current.data[hotel.id]?.tasks.find((x) => x.id === taskId);
        if (!t || t.status !== "pendiente") return false;
        setS((p) => {
          let n: State = {
            ...p,
            tasks: p.tasks.map((x) => (x.id === taskId ? { ...x, status: "en_proceso", startedAt: fmtClock(actionClock(p)), assignee: x.assignee || actor, ...(t.dept === "housekeeping" ? { startedIso: new Date().toISOString(), cleanedBy: actor } : {}) } : x)),
            rooms: t.dept === "housekeeping" ? p.rooms.map((x) => (x.number === t.room ? { ...x, hk: "cleaning" } : x)) : p.rooms,
            incidents: t.incidentId ? p.incidents.map((i) => (i.id === t.incidentId ? { ...i, status: "en_proceso", startedAt: fmtClock(actionClock(p)) } : i)) : p.incidents,
          };
          n = push(n, [
            { actor, text: `${t.dept === "housekeeping" ? "Empezó limpieza" : "Empezó"} · ${t.title.toLowerCase()} habitación ${t.room}.`, kind: "human" },
            ...(t.dept === "housekeeping" ? [{ actor: "Suite", text: `Habitación ${t.room} → LIMPIEZA EN PROCESO.`, kind: "suite" as const }] : []),
          ]);
          return n;
        });
        say(t.dept === "housekeeping" ? `Limpieza en proceso · ${t.room}` : `Tarea iniciada · ${t.room}`, { description: "Recepción y dirección ven el cambio en tiempo real." });
        return true;
      },

      finishTask: (taskId: string) => {
        const t = rootRef.current.data[hotel.id]?.tasks.find((x) => x.id === taskId);
        if (!t || t.status !== "en_proceso") return false;
        setS((p) => {
          let n: State = {
            ...p,
            tasks: p.tasks.map((x) => (x.id === taskId ? { ...x, status: "completada", endedAt: fmtClock(actionClock(p)), ...(t.dept === "housekeeping" ? cycleEnd(x) : {}) } : x)),
            rooms: t.dept === "housekeeping" ? p.rooms.map((x) => (x.number === t.room ? { ...x, hk: "inspect" } : x)) : p.rooms,
            incidents: t.incidentId ? p.incidents.map((i) => (i.id === t.incidentId ? { ...i, status: "resuelta", arrivedAt: i.arrivedAt ?? fmtClock(actionClock(p)), resolvedAt: fmtClock(actionClock(p)) } : i)) : p.incidents,
          };
          if (t.dept === "housekeeping") {
            n = push(n, [
              { actor, text: `Terminó limpieza habitación ${t.room}.`, kind: "human" },
              { actor: "Suite", text: `Habitación ${t.room} → A REVISAR.`, kind: "suite" },
            ]);
            n = notify(n, ["housekeeping", "director", "owner"], `Habitación ${t.room} lista para revisión.`, "info");
          } else {
            n = push(n, [
              { actor, text: `Resolvió: ${t.title.toLowerCase()} habitación ${t.room}.`, kind: "human" },
              ...(t.incidentId ? [{ actor: "Suite", text: `Incidencia ${t.incidentId} cerrada. Habitación ${t.room} desbloqueada.`, kind: "suite" as const }] : []),
            ]);
            n = notify(n, ["reception", "director", "owner"], `Resuelto: ${t.title} · ${t.room}.`, "ok");
          }
          return n;
        });
        say.success(t.dept === "housekeeping" ? `Habitación ${t.room} A REVISAR` : `Resuelto · ${t.room}`, {
          description: uid ? "Estado operativo actualizado" : t.dept === "housekeeping" ? "✓ Recepción notificada\n✓ Alerta de check-in actualizada" : "✓ Incidencia cerrada\n✓ Responsables notificados",
        });
        return true;
      },

      reportIssue: (input: { room: string; category: string; description: string; photo: boolean; blocking: boolean }) => {
        if (!s.rooms.some(r => r.number === input.room) || !input.description.trim()) {
          say.error("Selecciona una habitación del hotel y describe el problema");
          return false;
        }
        input = { ...input, description: input.description.trim(), photo: uid ? false : input.photo };
        const incId = id("I");
        const taskId = id("T");
        setS((p) => {
          const t = fmtClock(actionClock(p));
          let n: State = {
            ...p,
            incidents: [{ ...input, id: incId, status: "abierta", createdAt: t, reporter: actor, assignee: uid ? "" : "Carlos Ruiz", taskId }, ...p.incidents],
            tasks: [stampTask({
              id: taskId, title: `${input.category}: ${input.description.slice(0, 40)}`, room: input.room, assignee: uid ? "" : "Carlos Ruiz", dept: "mantenimiento",
              priority: input.blocking ? "alta" : "media", day: T, deadline: fmtClock(actionClock(p, 120)), status: "pendiente", comments: input.description,
              kind: "mantenimiento", incidentId: incId,
            }), ...p.tasks],
          };
          n = push(n, [
            { actor, text: `Reportó incidencia ${input.category.toLowerCase()} habitación ${input.room}.`, kind: "human" },
            { actor: "Suite", text: `Tarea de mantenimiento creada${uid ? " sin responsable" : " y asignada a Carlos Ruiz"}${input.blocking ? " · habitación BLOQUEADA" : ""}.`, kind: "suite" },
          ]);
          return notify(n, ["maintenance", "director", "owner"], `Nueva incidencia: ${input.category} · ${input.room}.`, "urgent");
        });
        say.success("Incidencia reportada", { description: uid ? "Tarea de mantenimiento creada sin responsable" : "✓ Tarea de mantenimiento creada\n✓ Carlos Ruiz notificado" });
        return true;
      },

      /** Technician reaches the room of an incident in progress */
      arriveIncident: (incId: string) => {
        const inc = s.incidents.find((i) => i.id === incId);
        if (!inc || inc.status !== "en_proceso" || inc.arrivedAt) return;
        setS((p) => push({ ...p, incidents: p.incidents.map((i) => (i.id === incId ? { ...i, arrivedAt: fmtClock(actionClock(p)) } : i)) }, [
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
        if (uid) { say.error("No hay un servicio de envío conectado"); return; }
        const rule = s.rules.find((r) => r.id === rid)!;
        const candidates = s.reservations.filter((r) => r.status === "confirmed" && (r.stay === "inhouse" || (r.stay === "finished" && r.outDay === T)));
        const entries: SentMessage[] = candidates.map((r) => {
          const g = helpers.guest(r.guestId);
          if (r.stay !== "inhouse") return { id: id("s"), time: rule.time, guest: g.name, rule: rule.name, result: "omitido", reason: "Check-out realizado — no se envía" };
          if (rid === "m2" && r.outDay <= T + 1) return { id: id("s"), time: rule.time, guest: g.name, rule: rule.name, result: "omitido", reason: "Sale mañana — no aplica" };
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
    const cycleEnd = (x: Task) => {
      const endedIso = new Date().toISOString();
      const start = x.startedIso ? Date.parse(x.startedIso) : NaN;
      return { endedIso, cleanedBy: x.cleanedBy || actor, ...(Number.isFinite(start) ? { durationSec: Math.max(0, Math.round((Date.parse(endedIso) - start) / 1000)) } : {}) };
    };
    const roomOp = (num: string, op: "dirty" | "start" | "finish" | "oos" | "approve" | "return", reason = "") => {
      const current = rootRef.current.data[hotel.id];
      const room = current?.rooms.find((r) => r.number === num);
      if (!room) return false;
      const open = current?.tasks.find((t) => t.room === num && t.dept === "housekeeping" && t.status !== "completada");
      if (op === "oos") {
        setS((p) => push({ ...p, rooms: p.rooms.map((r) => (r.number === num ? { ...r, oos: !r.oos } : r)) }, [
          { actor, text: `Habitación ${num} → ${room.oos ? "EN SERVICIO" : "FUERA DE SERVICIO"}.`, kind: "human" },
        ]));
        say(room.oos ? `Habitación ${num} en servicio` : `Habitación ${num} fuera de servicio`);
        return;
      }
      if (op === "approve" || op === "return") {
        const cycle = room.hk === "inspect" && !open ? current?.tasks.find((t) => t.room === num && t.dept === "housekeeping" && t.status === "completada" && !t.approvedIso && !t.returnedIso) : undefined;
        if (!cycle) return false;
        const at = new Date().toISOString();
        if (op === "approve") {
          setS((p) => notify(push({ ...p, tasks: p.tasks.map((t) => (t.id === cycle.id ? { ...t, approvedBy: actor, approvedIso: at } : t)), rooms: p.rooms.map((r) => (r.number === num ? { ...r, hk: "clean" } : r)) }, [
            { actor, text: `Aprobó limpieza habitación ${num}.`, kind: "human" },
            { actor: "Suite", text: `Habitación ${num} → LISTA.`, kind: "suite" },
          ]), ["reception", "director", "owner"], `Habitación ${num} lista para check-in.`, "ok"));
          say.success(`Habitación ${num} LISTA`);
          return true;
        }
        const task: Task = stampTask({ id: id("T"), title: "Limpieza devuelta", room: num, assignee: cycle.cleanedBy || cycle.assignee, dept: "housekeeping", priority: "alta", day: T, deadline: fmtClock(s.clock + 60), status: "pendiente", comments: reason.trim() ? `Devuelta: ${reason.trim()}` : "Devuelta en revisión.", kind: "repaso" });
        setS((p) => notify(push({ ...p, tasks: [task, ...p.tasks.map((t) => (t.id === cycle.id ? { ...t, returnedBy: actor, returnedIso: at, ...(reason.trim() ? { returnReason: reason.trim() } : {}) } : t))], rooms: p.rooms.map((r) => (r.number === num ? { ...r, hk: "dirty" } : r)) }, [
          { actor, text: `Devolvió limpieza habitación ${num}${reason.trim() ? ` · ${reason.trim()}` : ""}.`, kind: "human" },
          { actor: "Suite", text: `Habitación ${num} → PENDIENTE DE LIMPIEZA.`, kind: "suite" },
        ]), ["housekeeping"], `Limpieza devuelta: ${num}.`));
        say(`Habitación ${num} devuelta a limpieza`);
        return true;
      }
      if (op === "start" && open && open.status === "pendiente") return api.startTask(open.id);
      if (op === "finish" && open && open.status === "en_proceso") return api.finishTask(open.id);
      if (open || op === "finish") return false;
      if (op === "dirty" || (op === "start" && !open)) {
        const task: Task = stampTask({ id: id("T"), title: op === "dirty" ? "Limpieza solicitada" : "Limpieza", room: num, assignee: uid ? op === "start" ? actor : "" : "María López", dept: "housekeeping", priority: "media", day: T, deadline: fmtClock(s.clock + 90), status: op === "start" ? "en_proceso" : "pendiente", comments: "Creada desde el hotel digital.", kind: "limpieza", ...(op === "start" ? { startedAt: fmtClock(s.clock + 1), startedIso: new Date().toISOString(), cleanedBy: actor } : {}) });
        setS((p) => notify(push({ ...p, tasks: [task, ...p.tasks], rooms: p.rooms.map((r) => (r.number === num ? { ...r, hk: op === "start" ? "cleaning" : "dirty" } : r)) }, [
          { actor, text: op === "dirty" ? `Marcó habitación ${num} pendiente de limpieza.` : `Empezó limpieza habitación ${num}.`, kind: "human" },
          { actor: "Suite", text: `Habitación ${num} → ${op === "dirty" ? "PENDIENTE DE LIMPIEZA" : "LIMPIEZA EN PROCESO"}. ${uid ? "Tarea creada." : "Tarea asignada a María López."}`, kind: "suite" },
        ]), ["housekeeping"], `Limpieza de habitación: ${num}.`));
        say(op === "dirty" ? `Habitación ${num} pendiente de limpieza` : `Limpieza en proceso · ${num}`, { description: "✓ Tarea de housekeeping creada" });
        return true;
      }
      return false;
    };

    const NAMES = ["Lucía Romero", "Thomas Weber", "Sara Conti", "Ahmed Nasser", "Julia Novak", "Diego Castro", "Mia Jensen", "Oliver King", "Nora Silva", "Leo Fischer"];
    const CHANNELS: Channel[] = ["Booking.com", "Expedia", "Web directa", "Recepción", "Airbnb"];
    const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;
    const addBooking = (today: boolean) => {
      const free = s.rooms.filter((r) => !r.oos && !s.reservations.some((x) => x.room === r.number && x.status === "confirmed" && x.stay !== "finished"));
      if (!free.length) return false;
      const room = pick(free), name = pick(NAMES), gid = id("g"), inDay = today ? T : T + 1 + Math.floor(Math.random() * 6), nights = 1 + Math.floor(Math.random() * 4);
      const channel = pick(CHANNELS);
      const g: Guest = { id: gid, name, doc: `PAS ${gid.slice(-6).toUpperCase()}`, phone: "+34 600 000 000", email: `${gid}@demo-mail.com`, lang: "Español", companions: [], notes: "", country: "ES", messaging: false };
      const res: Reservation = { id: id("R"), guestId: gid, room: room.number, inDay, outDay: inDay + nights, eta: fmtClock(s.clock + 20), pax: 2, channel, amount: room.rate * nights, status: "confirmed", stay: "none", notes: "", createdDay: T };
      setS((p) => notify(push({ ...p, guests: [g, ...p.guests], reservations: [res, ...p.reservations] }, [
        { actor: channel, text: `Nueva reserva ${res.id} · ${name} · habitación ${room.number} · ${fmtDay(inDay, T).toLowerCase()}.`, kind: "channel" },
      ]), ["reception", "owner", "director"], `Nueva reserva ${channel} · ${name}.`, "ok"));
      return true;
    };

    /** One controlled event that mutates the real demo state */
    /** Manual booking from reception — rejects overlapping stays in the same room */
    const createReservation = (input: { name: string; room: string; inDay: number; outDay: number; pax: number; notes: string; guestId?: string }) => {
      const existing = input.guestId ? s.guests.find((g) => g.id === input.guestId) : undefined;
      if (input.guestId && !existing) { say.error("Huésped no encontrado"); return false; }
      if (existing) input = { ...input, name: existing.name };
      if (!input.name.trim() || !Number.isInteger(input.inDay) || !Number.isInteger(input.outDay) || !Number.isInteger(input.pax) || input.inDay < T || input.outDay <= input.inDay || input.pax < 1) {
        say.error("Revisa nombre, fechas y número de huéspedes; la entrada no puede ser anterior a hoy");
        return false;
      }
      const room = s.rooms.find((r) => r.number === input.room);
      if (!room || room.oos) { say.error("Habitación no disponible"); return false; }
      const clash = s.reservations.find((x) => x.room === input.room && x.status === "confirmed" && x.stay !== "finished" && x.inDay < input.outDay && input.inDay < x.outDay);
      if (clash) { say.error(`Habitación ${input.room} ocupada en esas fechas`, { description: `Choca con ${clash.id}` }); return false; }
      const gid = existing?.id ?? id("g");
      const g: Guest = existing ?? { id: gid, name: input.name.trim(), doc: "—", phone: "—", email: "—", lang: "—", companions: [], notes: "", country: "—", messaging: false };
      const created: Reservation = stampRes({ id: id("R"), guestId: gid, room: room.number, inDay: input.inDay, outDay: input.outDay, eta: "—", pax: input.pax, channel: "Recepción", amount: stayAmount(room.rate, input.outDay - input.inDay), status: "confirmed", stay: "none", notes: input.notes, createdDay: T });
      const res = withEvent(created, { at: fmtClock(s.clock), day: T, actor, text: `Reserva creada · habitación ${room.number} · ${input.outDay - input.inDay} noche(s) · ${input.pax} pax` });
      setS((p) => notify(push({ ...p, guests: existing ? p.guests : [g, ...p.guests], reservations: [res, ...p.reservations] }, [
        { actor, text: `Reserva manual ${res.id} · ${g.name} · habitación ${room.number} · ${fmtDay(input.inDay, T).toLowerCase()} → ${fmtDay(input.outDay, T).toLowerCase()}.`, kind: "human" },
      ]), ["reception", "owner", "director"], `Reserva manual · ${g.name} · ${room.number}.`, "ok"));
      say.success("Reserva creada");
      return true;
    };
    /** Extend or shorten a stay: rechecks availability and recalculates the amount at the current nightly rate */
    const changeStay = (rid: string, outDay: number) => {
      const r = s.reservations.find((x) => x.id === rid);
      const nightly = r ? Math.round(r.amount / Math.max(1, r.outDay - r.inDay)) : 0;
      const res = checkStayChange(s.reservations, rid, outDay, nightly, T);
      if ("error" in res) { say.error(res.error); return false; }
      if (!r || r.outDay === outDay) return false;
      const longer = outDay > r.outDay;
      setS((p) => notify(push({ ...p, reservations: p.reservations.map((x) => x.id === rid ? withEvent(syncReservationCalendar({ ...x, outDay, amount: res.amount }), { at: fmtClock(actionClock(p)), day: T, actor, text: `Salida ${fmtDay(r.outDay, T).toLowerCase()} → ${fmtDay(outDay, T).toLowerCase()} · ${res.amount} €` }) : x) }, [
        { actor, text: `Estancia ${rid} ${longer ? "ampliada" : "acortada"}: salida ${fmtDay(r.outDay, T).toLowerCase()} → ${fmtDay(outDay, T).toLowerCase()} · importe ${r.amount} € → ${res.amount} €.`, kind: "human" },
      ]), ["reception", "housekeeping", "owner", "director"], `Habitación ${r.room}: salida ${longer ? "retrasada" : "adelantada"} a ${fmtDay(outDay, T).toLowerCase()}. Ajusta la limpieza de salida.`, "info"));
      say.success(longer ? "Estancia ampliada" : "Estancia acortada", { description: `Nuevo importe: ${res.amount} €` });
      return true;
    };
    /** Cancel or mark no-show: keeps the row (traceability) and frees the room for new bookings */
    const closeReservation = (rid: string, kind: "cancelled" | "noshow", reason: string) => {
      const r = rootRef.current.data[hotel.id]?.reservations.find((x) => x.id === rid);
      if (!r || !(kind === "cancelled" ? canCancel(r) : canNoShow(r, T))) { say.error(kind === "cancelled" ? "Solo se pueden cancelar reservas sin check-in" : "No-show solo es posible desde el día de llegada y sin check-in"); return false; }
      const label = kind === "cancelled" ? "cancelada" : "marcada como no presentado";
      const why = reason.trim();
      setS((p) => notify(push({ ...p, reservations: p.reservations.map((x) => x.id === rid ? withEvent({ ...x, status: kind }, { at: fmtClock(actionClock(p)), day: T, actor, text: `Reserva ${label}${why ? ` · motivo: ${why}` : ""}` }) : x) }, [
        { actor, text: `Reserva ${rid} ${label} · habitación ${r.room} liberada${why ? ` · ${why}` : ""}.`, kind: "human" },
      ]), ["reception", "owner", "director"], `Reserva ${rid} ${label} · habitación ${r.room} libre.`, "info"));
      say.success(kind === "cancelled" ? "Reserva cancelada" : "Marcada como no presentado", { description: `Habitación ${r.room} disponible en esas fechas` });
      return true;
    };
    const cancelReservation = (rid: string, reason = "") => closeReservation(rid, "cancelled", reason);
    const markNoShow = (rid: string, reason = "") => closeReservation(rid, "noshow", reason);
    /** Full edit: dates, room (moves mid-stay leave the old room dirty with a cleaning task), pax and notes */
    const editReservation = (rid: string, e: ResEdit) => {
      const r = rootRef.current.data[hotel.id]?.reservations.find((x) => x.id === rid);
      const res = checkReservationEdit(s.reservations, s.rooms, rid, e, T);
      if ("error" in res) { say.error(res.error); return false; }
      if (!r) return false;
      const parts: string[] = [];
      if (e.room !== r.room) parts.push(`habitación ${r.room} → ${e.room}`);
      if (e.inDay !== r.inDay) parts.push(`entrada ${fmtDay(r.inDay, T).toLowerCase()} → ${fmtDay(e.inDay, T).toLowerCase()}`);
      if (e.outDay !== r.outDay) parts.push(`salida ${fmtDay(r.outDay, T).toLowerCase()} → ${fmtDay(e.outDay, T).toLowerCase()}`);
      if (e.pax !== r.pax) parts.push(`huéspedes ${r.pax} → ${e.pax}`);
      if (e.notes.trim() !== r.notes) parts.push("observaciones");
      if (!parts.length) { say("Sin cambios"); return true; }
      if (res.amount !== r.amount) parts.push(`importe ${r.amount} € → ${res.amount} €`);
      const moveInHouse = res.moved && r.stay === "inhouse";
      const task: Task | null = moveInHouse ? stampTask({ id: id("T"), title: "Limpieza tras cambio de habitación", room: r.room, assignee: "", dept: "housekeeping", priority: "media", day: T, deadline: fmtClock(s.clock + 120), status: "pendiente", kind: "limpieza", comments: `Huésped trasladado a ${e.room}.` }) : null;
      setS((p) => notify(push({
        ...p,
        reservations: p.reservations.map((x) => x.id === rid ? withEvent(syncReservationCalendar({ ...x, room: e.room, inDay: e.inDay, outDay: e.outDay, pax: e.pax, notes: e.notes.trim(), amount: res.amount }), { at: fmtClock(actionClock(p)), day: T, actor, text: `Editada: ${parts.join(" · ")}` }) : x),
        rooms: moveInHouse ? p.rooms.map((x) => x.number === r.room ? { ...x, hk: "dirty" } : x) : p.rooms,
        tasks: task && !p.tasks.some((t) => t.room === r.room && t.dept === "housekeeping" && t.status !== "completada") ? [task, ...p.tasks] : p.tasks,
      }, [{ actor, text: `Reserva ${rid} editada: ${parts.join(" · ")}.`, kind: "human" }]),
      moveInHouse ? ["reception", "housekeeping", "owner", "director"] : ["reception", "owner", "director"], moveInHouse ? `Cambio de habitación ${r.room} → ${e.room}. Limpieza pendiente en ${r.room}.` : `Reserva ${rid} actualizada.`, "info"));
      say.success(res.moved ? `Reserva movida a la habitación ${e.room}` : "Reserva actualizada");
      return true;
    };
    const freeRooms = (inDay: number, outDay: number, ignoreId?: string) => availableRooms(s.reservations, s.rooms, inDay, outDay, ignoreId);
    const simulateStep = () => {
      const opts: (() => unknown)[] = [];
      const inhouse = s.reservations.filter((r) => r.stay === "inhouse");
      const arrivals = s.reservations.filter((r) => r.inDay === T && r.status === "confirmed" && r.stay === "none" && ["ready", "arrival"].includes(helpers.roomState(r.room)));
      const hkPend = s.tasks.filter((t) => t.dept === "housekeeping" && t.status === "pendiente" && helpers.roomState(t.room) === "dirty");
      const hkProg = s.tasks.filter((t) => t.dept === "housekeeping" && t.status === "en_proceso");
      const mtPend = s.tasks.filter((t) => t.dept === "mantenimiento" && t.status === "pendiente");
      const mtProg = s.tasks.filter((t) => t.dept === "mantenimiento" && t.status === "en_proceso");
      if (inhouse.length) opts.push(() => api.checkOut(pick(inhouse.filter((r) => r.outDay <= T).length ? inhouse.filter((r) => r.outDay <= T) : inhouse).id));
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

    const updateHotelTimezone = async (timezone: string): Promise<boolean> => {
      if (!canEditHotelConfig) { say.error("Solo propietario o dirección pueden cambiar la zona horaria"); return false; }
      if (!isTimeZone(timezone)) { say.error("Selecciona una zona horaria IANA válida"); return false; }
      const hotelKey = hotel.id;
      const hotelRecord = record;
      if (hotelRecord) {
        try { await saveHotelTimezone(hotelRecord.id, timezone); }
        catch (error) { say.error("No se pudo guardar la zona horaria", { description: error instanceof Error ? error.message : "Inténtalo de nuevo" }); return false; }
      }
      setRoot((r) => ({ ...r, hotels: r.hotels.map((h) => h.id === hotelKey ? { ...h, timezone } : h) }));
      setConfig((current) => current ? { ...current, hotels: current.hotels.map((h) => h.id === hotelRecord?.id ? { ...h, timezone } : h) } : current);
      say.success("Zona horaria actualizada", { description: "Las fechas guardadas no se han modificado." });
      return true;
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

    const updateGuest = (guestId: string, input: Pick<Guest, "name" | "doc" | "phone" | "email" | "lang" | "notes">) => {
      if (!input.name.trim() || !rootRef.current.data[hotel.id]?.guests.some(g => g.id === guestId)) return false;
      const fields = { name: input.name.trim(), doc: input.doc.trim(), phone: input.phone.trim(), email: input.email.trim(), lang: input.lang.trim(), notes: input.notes.trim() };
      setS(p => push({ ...p, guests: p.guests.map(g => g.id === guestId ? { ...g, ...fields } : g) }, [
        { actor, text: `Ficha de huésped actualizada: ${fields.name}.`, kind: "human" },
      ]));
      if (!uid) say.success("Ficha actualizada");
      return true;
    };
    const collection = { ...api, roomOp, simulateStep, createReservation, updateRoom, updateHotelTimezone, changeStay, updateGuest, cancelReservation, markNoShow, editReservation, freeRooms };
    // Cloud actions report success only after the atomic write, not optimistic UI changes.
    if (!uid) return collection;
    const persisted = new Set(['checkIn','checkOut','startTask','finishTask','reportIssue','arriveIncident','roomOp','createReservation','changeStay','updateGuest','cancelReservation','markNoShow','editReservation']);
    return Object.fromEntries(Object.entries(collection).map(([name, action]) => [name, persisted.has(name) ? (...args: unknown[]) => {
      quiet = true;
      try { return (action as (...values: unknown[]) => unknown)(...args); }
      finally { quiet = false; }
    } : action])) as typeof collection;
  }, [s, helpers, canEditRoomConfig, canEditHotelConfig, record, hotel.id, uid, root.user, root.accounts, clockNow]);

  // Activity simulator: fires a real action every few seconds while enabled
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  useEffect(() => {
    if (uid || !root.sim) return;
    const t = setInterval(() => actionsRef.current.simulateStep(), 2800);
    return () => clearInterval(t);
  }, [root.sim, uid]);

  const effectiveCloud = operationCloud === 'error' ? 'error' : operationCloud === 'pending' ? 'pending' : cloud;
  return { s, authReady: !!uid && remoteLoaded.current === uid && !!root.user, isDemo: !uid, sim: !uid && !!root.sim, hotel, hotels: visible, world: root.data, org: root.org, ready: loaded && cloud !== "loading", cloud: effectiveCloud, cloudHotelId: record?.id, hotelClock: uid ? hotelTime(today.zone, now) : fmtClock(s.clock), canEditRoomConfig, canEditHotelConfig, navAccess, user: (root.accounts ?? []).find((a) => a.email === root.user), ...helpers, alerts, actions };
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
