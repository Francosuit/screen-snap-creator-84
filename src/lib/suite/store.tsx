import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  DEMO_DATE, ROLES, START_CLOCK, seedGuests, seedIncidents, seedLog, seedNotifications, seedOpportunities,
  seedReservations, seedRooms, seedRules, seedTasks, seedHotels, type Hotel,
  type Guest, type HotelKey, type Incident, type LogEntry, type Notification, type Opportunity, type Priority,
  type Reservation, type RoleKey, type Room, type RoomState, type SentMessage, type Task, type MessageRule,
} from "./data";

interface Data {
  clock: number;
  rooms: Room[]; guests: Guest[]; reservations: Reservation[]; tasks: Task[]; incidents: Incident[];
  log: LogEntry[]; notifications: Notification[]; opportunities: Opportunity[]; rules: MessageRule[]; sent: SentMessage[];
}
/** Merged view of the active hotel — what screens read */
interface State extends Data { role: RoleKey; hotel: HotelKey }
interface Root { role: RoleKey; hotel: HotelKey; hotels: Hotel[]; data: Record<string, Data> }

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
const STORAGE = "suite-demo-v2";

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
  useEffect(() => {
    try { const raw = localStorage.getItem(STORAGE); if (raw) setRoot(JSON.parse(raw) as Root); } catch { /* ignore corrupt storage */ }
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) localStorage.setItem(STORAGE, JSON.stringify(root)); }, [root, loaded]);

  const s: State = useMemo(() => ({ ...root.data[root.hotel]!, role: root.role, hotel: root.hotel }), [root]);
  const hotel = root.hotels.find((h) => h.id === root.hotel)!;
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

    return {
      setRole: (role: RoleKey) => setS((p) => ({ ...p, role })),
      setHotel: (h: HotelKey) => setRoot((r) => ({ ...r, hotel: h })),
      resetDemo: () => { setRoot(initialRoot()); toast.success("Demo reiniciada", { description: "Datos iniciales restaurados." }); },
      createHotel: (input: { name: string; address: string; city: string; rooms: number; category: string }) => {
        const hid = id("h");
        const h: Hotel = { ...input, id: hid, logo: input.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(), status: "configurando" };
        const d = emptyData(generateRooms(input.rooms));
        d.log = [{ id: id("l"), time: fmtClock(START_CLOCK), actor: "Suite", text: `Hotel creado con ${input.rooms} habitaciones. Listo para añadir personal y reservas.`, kind: "suite" }];
        setRoot((r) => ({ ...r, hotel: hid, hotels: [...r.hotels, h], data: { ...r.data, [hid]: d } }));
        toast.success("Hotel creado", { description: `✓ ${input.rooms} habitaciones generadas\n✓ Entorno listo` });
      },
      readAll: () => setS((p) => ({ ...p, notifications: p.notifications.map((n) => (n.roles.includes(p.role) ? { ...n, read: true } : n)) })),

      checkIn: (resId: string) => {
        const r = s.reservations.find((x) => x.id === resId)!;
        const gName = helpers.guest(r.guestId).name;
        if (helpers.roomState(r.room) !== "ready") {
          toast.error(`Habitación ${r.room} no está lista`, { description: "Suite bloquea el check-in hasta que housekeeping la marque como LISTA." });
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
        toast.success("Check-in realizado", { description: "✓ Habitación actualizada\n✓ Huésped ahora está IN HOUSE\n✓ Comunicaciones In-House activadas" });
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
        toast.success("Check-out completado", { description: "✓ Comunicaciones detenidas\n✓ Limpieza creada automáticamente" });
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
        toast(t.dept === "housekeeping" ? `Limpieza en proceso · ${t.room}` : `Tarea iniciada · ${t.room}`, { description: "Recepción y dirección ven el cambio en tiempo real." });
      },

      finishTask: (taskId: string) => {
        const t = s.tasks.find((x) => x.id === taskId)!;
        setS((p) => {
          let n: State = {
            ...p,
            tasks: p.tasks.map((x) => (x.id === taskId ? { ...x, status: "completada", endedAt: fmtClock(p.clock + 1) } : x)),
            rooms: t.dept === "housekeeping" ? p.rooms.map((x) => (x.number === t.room ? { ...x, hk: "clean" } : x)) : p.rooms,
            incidents: t.incidentId ? p.incidents.map((i) => (i.id === t.incidentId ? { ...i, status: "resuelta", resolvedAt: fmtClock(p.clock + 1) } : i)) : p.incidents,
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
        toast.success(t.dept === "housekeeping" ? `Habitación ${t.room} LISTA` : `Resuelto · ${t.room}`, {
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
        toast.success("Incidencia reportada", { description: "✓ Tarea de mantenimiento creada\n✓ Carlos Ruiz notificado" });
      },

      decideOpportunity: (oid: string, decision: "revisada" | "ignorada") => {
        const o = s.opportunities.find((x) => x.id === oid)!;
        setS((p) => push({ ...p, opportunities: p.opportunities.map((x) => (x.id === oid ? { ...x, status: decision } : x)) }, [
          { actor, text: `${decision === "revisada" ? "Marcó para revisar" : "Ignoró"} recomendación “${o.title}” (${o.dates}). Tarifa sin cambios automáticos.`, kind: "revenue" },
        ]));
        toast(decision === "revisada" ? "Recomendación enviada a revisión" : "Recomendación ignorada", { description: "Suite recomienda. Una persona decide." });
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
        toast.success(`“${rule.name}” simulada`, { description: `${sent} enviados · ${entries.length - sent} omitidos por estado` });
      },
    };
  }, [s, helpers]);

  return { s, hotel, hotels: root.hotels, ...helpers, alerts, actions };
}

type Ctx = ReturnType<typeof useSuiteState>;
const SuiteCtx = createContext<Ctx | null>(null);
export function SuiteProvider({ children }: { children: ReactNode }) {
  const v = useSuiteState();
  return <SuiteCtx.Provider value={v}>{children}</SuiteCtx.Provider>;
}
export function useSuite() {
  const v = useContext(SuiteCtx);
  if (!v) throw new Error("SuiteProvider missing");
  return v;
}

export const NAV_ACCESS: Record<RoleKey, string[]> = {
  owner: ["/", "/reservas", "/habitaciones", "/control", "/personal", "/tareas", "/huespedes", "/mensajes", "/integraciones", "/configuracion"],
  director: ["/", "/reservas", "/habitaciones", "/control", "/personal", "/tareas", "/huespedes", "/mensajes", "/configuracion"],
  reception: ["/", "/reservas", "/habitaciones", "/huespedes", "/tareas", "/mensajes"],
  housekeeping: ["/", "/habitaciones", "/tareas"],
  maintenance: ["/", "/habitaciones", "/tareas"],
  revenue: ["/", "/control", "/reservas", "/habitaciones"],
};
