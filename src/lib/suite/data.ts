// Suite demo data — all fictitious, internally consistent.
// Demo "today" = Tuesday 10 Nov 2026 (day offset 0). Demo clock starts 13:15.

export type RoleKey = "owner" | "director" | "reception" | "housekeeping" | "maintenance" | "revenue";
export type HotelKey = string;

export type Channel = "Booking.com" | "Expedia" | "Web directa" | "Recepción" | "Airbnb";
/** Commercial state of the booking */
export type BookingStatus = "confirmed" | "cancelled" | "noshow";
/** Physical stay state */
export type StayStatus = "none" | "inhouse" | "finished";
/** Housekeeping state of the room */
export type HkStatus = "clean" | "dirty" | "inspect" | "cleaning";
/** Derived display state of a room */
export type RoomState = "ready" | "occupied" | "dirty" | "cleaning" | "maintenance" | "oos";

export type Priority = "baja" | "media" | "alta" | "urgente";
export type TaskStatus = "pendiente" | "en_proceso" | "completada" | "bloqueada";
export type Dept = "housekeeping" | "mantenimiento" | "recepcion" | "revenue";

export interface Room {
  number: string; floor: number; type: string; hk: HkStatus; oos: boolean; rate: number;
  /** Physical configuration (optional: older rooms fall back to defaults by type) */
  capacity?: number; beds?: string; bath?: string; terrace?: boolean; view?: string; sqm?: number;
  /** Internal staff notes */
  notes?: string;
  /** Equipment and extras of the room */
  extras?: string[];
  /** Position inside its floor plan: column along the corridor + side of the corridor */
  x?: number; side?: "left" | "right";
}

/** Fields a manager may edit on a room; number/floor/state are intentionally excluded */
export type RoomEdit = Pick<Room, "type" | "rate"> & { [K in "capacity" | "beds" | "bath" | "terrace" | "view" | "sqm" | "notes" | "extras"]?: Room[K] | undefined };
export const ROOM_EDIT_LABELS: Record<keyof RoomEdit, string> = {
  type: "tipo", rate: "tarifa", capacity: "capacidad", beds: "camas", bath: "baño", terrace: "terraza", view: "vista", sqm: "m²", notes: "observaciones", extras: "equipamiento",
};

/** Returns an error message, or null when the edit is valid */
export function validateRoomEdit(e: RoomEdit): string | null {
  if (!e.type?.trim()) return "El tipo es obligatorio";
  if (!Number.isFinite(e.rate) || e.rate <= 0) return "La tarifa debe ser mayor que 0";
  if (e.capacity != null && (!Number.isInteger(e.capacity) || e.capacity < 1 || e.capacity > 10)) return "La capacidad debe estar entre 1 y 10";
  if (e.sqm != null && (!Number.isFinite(e.sqm) || e.sqm <= 0)) return "Los metros deben ser positivos";
  if (e.capacity != null && e.beds && bedSleeps(parseBeds(e.beds)) < e.capacity) return `Las camas no alcanzan para ${e.capacity} huéspedes`;
  return null;
}

/** Applies only allowed fields; returns the new room and the list of changed field labels */
export function applyRoomEdit(room: Room, e: RoomEdit): { room: Room; changed: string[] } {
  const next: Room = { ...room };
  const changed: string[] = [];
  (Object.keys(ROOM_EDIT_LABELS) as (keyof RoomEdit)[]).forEach((k) => {
    if (!(k in e)) return;
    const v = e[k];
    if (JSON.stringify(room[k] ?? null) !== JSON.stringify(v ?? null)) { (next as unknown as Record<string, unknown>)[k] = v; changed.push(ROOM_EDIT_LABELS[k]); }
  });
  return { room: next, changed };
}

/** Upcoming, non-cancelled reservations for a room (not yet checked in) */
export function futureReservations(list: Reservation[], room: string): Reservation[] {
  return list.filter((r) => r.room === room && r.status === "confirmed" && r.stay === "none");
}
export interface Floor { number: number; name: string }
export interface Guest {
  id: string; name: string; doc: string; phone: string; email: string; lang: string;
  companions: string[]; notes: string; country: string; messaging: boolean;
}
export interface Reservation {
  id: string; guestId: string; room: string; inDay: number; outDay: number; eta: string;
  pax: number; channel: Channel; amount: number; status: BookingStatus; stay: StayStatus; notes: string; createdDay: number;
}
export interface Task {
  id: string; title: string; room: string; assignee: string; dept: Dept; priority: Priority;
  day: number; deadline: string; status: TaskStatus; comments: string; nextCheckIn?: string | undefined;
  kind: "limpieza" | "repaso" | "mantenimiento" | "general"; incidentId?: string; startedAt?: string; endedAt?: string;
}
export interface Incident {
  id: string; room: string; category: string; description: string; photo: boolean; blocking: boolean;
  status: "abierta" | "en_proceso" | "resuelta"; createdAt: string; reporter: string; assignee: string;
  startedAt?: string; arrivedAt?: string; resolvedAt?: string; taskId?: string;
}
export interface LogEntry { id: string; time: string; actor: string; text: string; kind: "human" | "suite" | "channel" | "revenue" }
export interface Notification { id: string; roles: RoleKey[]; text: string; time: string; read: boolean; tone: "urgent" | "info" | "ok" }
export interface Opportunity {
  id: string; title: string; dates: string; level: "alta" | "media"; occupancy: number; pickup: string; compset: string;
  event: string; reasons: string[]; impact: number; confidence: "alta" | "media" | "baja"; status: "nueva" | "revisada" | "ignorada";
}
export interface Activity { id: string; name: string; description: string; schedule: string; days: number[]; price: string; spots: number; location: string; bookable: boolean; icon: string }
export interface MessageRule { id: string; name: string; trigger: string; time: string; audience: string; content: string; active: boolean }
export interface SentMessage { id: string; time: string; guest: string; rule: string; result: "enviado" | "omitido"; reason?: string }

export const DEMO_DATE = new Date(2026, 10, 10);
export const START_CLOCK = 13 * 60 + 15;

export const ROLES: Record<RoleKey, { label: string; person: string; title: string }> = {
  owner: { label: "Owner", person: "Juan Ibarra", title: "Owner" },
  director: { label: "Director", person: "Laura Vidal", title: "Directora" },
  reception: { label: "Recepción", person: "Ana Torres", title: "Recepción" },
  housekeeping: { label: "Housekeeping", person: "María López", title: "Housekeeping" },
  maintenance: { label: "Mantenimiento", person: "Carlos Ruiz", title: "Mantenimiento" },
  revenue: { label: "Revenue", person: "David Sanz", title: "Revenue Manager" },
};

export interface Hotel { id: string; name: string; address: string; city: string; category: string; rooms: number; logo: string; status: "activo" | "configurando"; floors?: Floor[]; description?: string; zones?: string[]; departments?: string[]; checkIn?: string; checkOut?: string; owner?: string | undefined }
export interface Organization { name: string; owner: string; email: string; tradeName?: string; country?: string; city?: string; phone?: string; type?: string; employees?: string }
export interface Account { email: string; password: string; name: string; surname: string; position: string; role: string; org: Organization }
/** Common zones a hotel can declare; each one becomes a visible object in the Digital World */
export const ZONE_OPTIONS = ["Recepción", "Lobby", "Restaurante", "Bar", "Piscina", "Gimnasio", "Spa", "Parking", "Cocina", "Lavandería", "Jardín", "Salas de reuniones", "Mantenimiento"];
export const DEPT_OPTIONS = ["Recepción", "Housekeeping", "Mantenimiento", "Restaurante", "Cocina", "Dirección", "Revenue", "Ventas", "Eventos", "Seguridad"];
export const seedHotels: Hotel[] = [
  { id: "grand", name: "Hotel Suite Grand", address: "Calle de Alcalá 120", city: "Madrid", category: "Urbano 4★", rooms: 15, logo: "SG", status: "activo", zones: ["Recepción", "Lobby", "Restaurante", "Bar", "Gimnasio", "Parking", "Mantenimiento"] },
  { id: "beach", name: "Suite Beach Resort", address: "Paseo Marítimo 8", city: "Marbella", category: "Vacacional 5★", rooms: 20, logo: "SB", status: "activo", zones: ["Recepción", "Restaurante", "Piscina", "Spa", "Jardín", "Mantenimiento"] },
];

const r = (number: string, type: string, rate: number, hk: HkStatus = "clean", oos = false): Room => ({
  number, floor: Number(number[0]), type, hk, oos, rate,
});

export const seedRooms: Room[] = [
  r("101", "Doble Superior", 145), r("102", "Doble Superior", 145), r("103", "Doble Estándar", 120, "dirty"),
  r("104", "Doble Estándar", 120), r("105", "Individual", 95, "clean", true),
  r("201", "Doble Superior", 150), r("202", "Doble Estándar", 125), r("203", "Junior Suite", 210),
  r("204", "Doble Superior", 150), r("205", "Doble Estándar", 125),
  r("301", "Suite", 290), r("302", "Junior Suite", 220), r("303", "Doble Superior", 155, "inspect"),
  r("304", "Doble Estándar", 130), r("305", "Suite", 290),
];

const g = (id: string, name: string, country: string, lang: string, phone: string, companions: string[] = [], notes = ""): Guest => ({
  id, name, country, lang, phone, companions, notes, messaging: false,
  doc: `${country === "ES" ? "DNI" : "PAS"} ${(id.charCodeAt(1) * 731911).toString().slice(0, 8)}${country === "ES" ? "K" : ""}`,
  email: `${name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, ".")}@demo-mail.com`,
});

export const seedGuests: Guest[] = [
  g("g1", "Juan Pérez", "ES", "Español", "+34 611 204 118", ["Marta Gil"], "Aniversario. Prefiere almohada firme."),
  g("g2", "Sofía Martín", "ES", "Español", "+34 622 101 455", [], "Viaje de trabajo. Factura a empresa."),
  g("g3", "Hans Müller", "DE", "Alemán", "+49 151 2233 4410", ["Greta Müller"], "Solicita taxi al aeropuerto 12:00."),
  g("g4", "Emma Wilson", "GB", "Inglés", "+44 7700 900 123", ["Jack Wilson", "Lily Wilson"], "Viaja con niña de 6 años. Cuna no necesaria."),
  g("g5", "Pierre Dubois", "FR", "Francés", "+33 6 12 34 56 78", [], ""),
  g("g6", "Lucía Fernández", "ES", "Español", "+34 633 201 900", ["Pablo Ruiz"], "Alergia a frutos secos."),
  g("g7", "Marco Rossi", "IT", "Italiano", "+39 347 555 0192", ["Giulia Rossi"], "Cliente repetidor (4ª estancia)."),
  g("g8", "Anna Kowalski", "PL", "Inglés", "+48 501 222 333", [], "Late check-out solicitado."),
  g("g9", "Kenji Tanaka", "JP", "Inglés", "+81 90 1234 5678", ["Yuki Tanaka"], "Llegada tardía prevista."),
  g("g10", "Olivia Brown", "US", "Inglés", "+1 415 555 0144", ["Noah Brown"], "Luna de miel. Cava de bienvenida."),
  g("g11", "Lucas Moreau", "FR", "Francés", "+33 7 88 41 22 10", [], "Salió hoy 11:54."),
  g("g12", "Elena García", "ES", "Español", "+34 644 300 120", ["Iván García"], ""),
  g("g13", "Tom Baker", "GB", "Inglés", "+44 7911 123456", [], "Canceló por cambio de vuelo."),
  g("g14", "Raúl Ortiz", "ES", "Español", "+34 655 400 777", [], "No se presentó. Garantía cobrada."),
  g("g15", "Laura Smith", "US", "Inglés", "+1 212 555 0101", ["Mark Smith"], "Asistirá al concierto del 18."),
  g("g16", "Chen Wei", "CN", "Inglés", "+86 139 1000 2222", [], ""),
];

const res = (
  id: string, guestId: string, room: string, inDay: number, outDay: number, eta: string, pax: number,
  channel: Channel, stay: StayStatus, notes = "", status: BookingStatus = "confirmed", createdDay = -20,
): Reservation => {
  const rate = seedRooms.find((x) => x.number === room)!.rate;
  return { id, guestId, room, inDay, outDay, eta, pax, channel, amount: rate * (outDay - inDay), status, stay, notes, createdDay };
};

export const seedReservations: Reservation[] = [
  res("R-2041", "g1", "204", 0, 2, "14:00", 2, "Web directa", "none", "Aniversario: preparar detalle de bienvenida."),
  res("R-2032", "g2", "101", -2, 2, "—", 1, "Booking.com", "inhouse"),
  res("R-2018", "g3", "102", -3, 0, "—", 2, "Expedia", "inhouse", "Salida hoy 11:00 — taxi 12:00."),
  res("R-2044", "g4", "103", 0, 4, "14:00", 3, "Booking.com", "none", "Familia. Cama supletoria preparada."),
  res("R-2027", "g5", "104", -1, 3, "—", 1, "Recepción", "inhouse"),
  res("R-2035", "g6", "201", -1, 1, "—", 2, "Airbnb", "inhouse"),
  res("R-2021", "g7", "203", -4, 0, "—", 2, "Web directa", "inhouse", "Cliente repetidor."),
  res("R-2039", "g8", "205", -2, 4, "—", 1, "Expedia", "inhouse", "Late check-out mañana pendiente de confirmar."),
  res("R-2046", "g9", "301", 0, 3, "18:00", 2, "Booking.com", "none"),
  res("R-2030", "g10", "302", -3, 2, "—", 2, "Web directa", "inhouse", "Luna de miel."),
  res("R-2012", "g11", "103", -3, 0, "—", 1, "Booking.com", "finished", "Check-out 11:54."),
  res("R-1988", "g12", "202", -9, -6, "—", 2, "Recepción", "finished"),
  res("R-2040", "g13", "202", 1, 3, "15:00", 1, "Expedia", "none", "Cancelada por el huésped.", "cancelled"),
  res("R-2036", "g14", "304", -1, 1, "20:00", 1, "Booking.com", "none", "No-show. Garantía cobrada.", "noshow"),
  res("R-2050", "g15", "302", 7, 9, "15:00", 2, "Web directa", "none", "Concierto 18 nov.", "confirmed", 0),
  res("R-2049", "g16", "202", 1, 3, "13:00", 1, "Booking.com", "none", "", "confirmed", 0),
  res("R-2051", "g12", "304", 1, 4, "17:00", 2, "Web directa", "none", "Repite estancia.", "confirmed", 0),
];

export const seedTasks: Task[] = [
  { id: "T-1", title: "Limpieza post check-out", room: "103", assignee: "María López", dept: "housekeeping", priority: "alta", day: 0, deadline: "13:30", status: "pendiente", comments: "Check-in Emma Wilson 14:00 · familia con cama supletoria.", nextCheckIn: "14:00", kind: "limpieza" },
  { id: "T-2", title: "Repaso habitación", room: "303", assignee: "María López", dept: "housekeeping", priority: "media", day: 0, deadline: "15:30", status: "pendiente", comments: "Revisión tras mantenimiento de grifo.", kind: "repaso" },
  { id: "T-3", title: "Limpieza diaria", room: "304", assignee: "María López", dept: "housekeeping", priority: "baja", day: 0, deadline: "13:00", status: "completada", comments: "", kind: "limpieza", startedAt: "12:10", endedAt: "12:43" },
  { id: "T-4", title: "Reparar aire acondicionado", room: "305", assignee: "Carlos Ruiz", dept: "mantenimiento", priority: "alta", day: 0, deadline: "15:00", status: "en_proceso", comments: "Compresor no arranca. Posible técnico externo.", kind: "mantenimiento", incidentId: "I-1", startedAt: "12:21" },
  { id: "T-5", title: "Cambiar bombilla lectura", room: "201", assignee: "Carlos Ruiz", dept: "mantenimiento", priority: "baja", day: 0, deadline: "18:00", status: "pendiente", comments: "", kind: "mantenimiento", incidentId: "I-2" },
  { id: "T-6", title: "Confirmar late check-out", room: "205", assignee: "Ana Torres", dept: "recepcion", priority: "media", day: 0, deadline: "17:00", status: "pendiente", comments: "Anna Kowalski pide salida 14:00 el sábado.", kind: "general" },
  { id: "T-7", title: "Preparar cava luna de miel", room: "302", assignee: "Ana Torres", dept: "recepcion", priority: "baja", day: 0, deadline: "19:00", status: "completada", comments: "", kind: "general" },
];

export const seedIncidents: Incident[] = [
  { id: "I-1", room: "305", category: "Climatización", description: "Aire acondicionado no enfría. Habitación bloqueada.", photo: true, blocking: true, status: "en_proceso", createdAt: "09:40", reporter: "María López", assignee: "Carlos Ruiz", startedAt: "12:21", taskId: "T-4" },
  { id: "I-2", room: "201", category: "Electricidad", description: "Bombilla de lectura fundida (lado izquierdo).", photo: false, blocking: false, status: "abierta", createdAt: "12:05", reporter: "Lucía Fernández (huésped)", assignee: "Carlos Ruiz", taskId: "T-5" },
];

export const seedLog: LogEntry[] = [
  { id: "l1", time: "12:44", actor: "Suite", text: "Recepción recibió actualización: 304 disponible.", kind: "suite" },
  { id: "l2", time: "12:44", actor: "Suite", text: "Habitación 304 cambió a LISTA.", kind: "suite" },
  { id: "l3", time: "12:43", actor: "María López", text: "Terminó limpieza habitación 304.", kind: "human" },
  { id: "l4", time: "12:37", actor: "Booking.com", text: "Nueva reserva R-2049 · Chen Wei · 11–13 nov.", kind: "channel" },
  { id: "l5", time: "12:21", actor: "Carlos Ruiz", text: "Comenzó mantenimiento habitación 305.", kind: "human" },
  { id: "l6", time: "11:55", actor: "Suite", text: "Tarea de limpieza 103 creada · prioridad ALTA (check-in 14:00).", kind: "suite" },
  { id: "l7", time: "11:54", actor: "Ana Torres", text: "Check-out habitación 103 · Lucas Moreau.", kind: "human" },
  { id: "l8", time: "11:32", actor: "Revenue", text: "Nueva oportunidad detectada: 17–19 nov.", kind: "revenue" },
  { id: "l9", time: "09:40", actor: "María López", text: "Reportó incidencia climatización 305.", kind: "human" },
];

export const seedNotifications: Notification[] = [
  { id: "n1", roles: ["reception", "director", "owner", "housekeeping"], text: "Check-in 103 en 45 min · habitación no lista.", time: "13:15", read: false, tone: "urgent" },
  { id: "n2", roles: ["housekeeping"], text: "Nueva habitación asignada: 103 (post check-out).", time: "11:55", read: false, tone: "info" },
  { id: "n3", roles: ["maintenance", "director", "owner"], text: "Nueva incidencia: bombilla 201.", time: "12:05", read: false, tone: "info" },
  { id: "n4", roles: ["revenue", "director", "owner"], text: "Nueva oportunidad Revenue: 17–19 nov.", time: "11:32", read: false, tone: "info" },
  { id: "n5", roles: ["reception", "owner"], text: "Nueva reserva Booking.com · Chen Wei.", time: "12:37", read: true, tone: "ok" },
];

export const seedOpportunities: Opportunity[] = [
  {
    id: "O-1", title: "Revisar tarifa", dates: "17–19 nov", level: "alta", occupancy: 82, pickup: "+31%", compset: "+12%",
    event: "Concierto en el WiZink Center (18 nov)",
    reasons: ["Ocupación superior al histórico (+18 pp)", "Pickup acelerado en los últimos 7 días", "Competencia aumentando precios (+12%)", "Evento confirmado en la ciudad"],
    impact: 1250, confidence: "alta", status: "nueva",
  },
  {
    id: "O-2", title: "Activar estancia mínima 2 noches", dates: "27–28 nov", level: "media", occupancy: 68, pickup: "+14%", compset: "+5%",
    event: "Black Friday · puente regional",
    reasons: ["Demanda concentrada en viernes", "Búsquedas web +22%", "Competencia con restricción de 2 noches"],
    impact: 640, confidence: "media", status: "nueva",
  },
  {
    id: "O-3", title: "Promoción directa entre semana", dates: "23–25 nov", level: "media", occupancy: 41, pickup: "-6%", compset: "-3%",
    event: "Sin eventos relevantes",
    reasons: ["Ocupación por debajo del histórico", "Ventana de reserva corta (6 días)", "Canal directo con mejor margen"],
    impact: 480, confidence: "baja", status: "nueva",
  },
];

export const activities: Activity[] = [
  { id: "a1", name: "Piscina climatizada", description: "Piscina interior con hamacas y servicio de toallas.", schedule: "09:00–20:00", days: [0, 1, 2, 3, 4, 5, 6], price: "Incluido", spots: 30, location: "Planta -1", bookable: false, icon: "🏊" },
  { id: "a2", name: "Tenis", description: "Pista de tierra batida con raquetas incluidas.", schedule: "17:00 · 18:00", days: [1, 2, 3, 4, 5], price: "15 €/hora", spots: 2, location: "Club exterior", bookable: true, icon: "🎾" },
  { id: "a3", name: "Spa & circuito termal", description: "Circuito de 90 minutos con sauna y jacuzzi.", schedule: "10:00–21:00", days: [0, 1, 2, 3, 4, 5, 6], price: "35 €", spots: 8, location: "Planta -1", bookable: true, icon: "💆" },
  { id: "a4", name: "Restaurante Raíz", description: "Cocina de temporada. Menú degustación.", schedule: "Desde 20:30", days: [1, 2, 3, 4, 5, 6], price: "Carta", spots: 14, location: "Planta 0", bookable: true, icon: "🍽" },
  { id: "a5", name: "Kids Club", description: "Talleres y juegos para niños de 4 a 12 años.", schedule: "10:00–13:00", days: [5, 6, 0], price: "Incluido", spots: 12, location: "Jardín", bookable: true, icon: "🧸" },
  { id: "a6", name: "Excursión Toledo", description: "Ruta guiada de día completo con transporte.", schedule: "09:00–18:00", days: [3], price: "65 €", spots: 6, location: "Salida desde recepción", bookable: true, icon: "🚌" },
  { id: "a7", name: "Gimnasio", description: "Sala de fitness con máquinas Technogym.", schedule: "24 horas", days: [0, 1, 2, 3, 4, 5, 6], price: "Incluido", spots: 10, location: "Planta 1", bookable: false, icon: "🏋️" },
];

export const seedRules: MessageRule[] = [
  { id: "m1", name: "Buenos días", trigger: "Todos los días", time: "08:00", audience: "Solo huéspedes IN HOUSE", content: "Clima, actividades del día e información del hotel.", active: true },
  { id: "m2", name: "Plan de mañana", trigger: "Todos los días", time: "20:00", audience: "Solo huéspedes que seguirán alojados mañana", content: "Actividades del día siguiente.", active: true },
  { id: "m3", name: "Bienvenida", trigger: "Evento: CHECK-IN", time: "Inmediato", audience: "Huésped que realiza check-in", content: "Wi-Fi, horarios y contacto de recepción.", active: true },
];

export const staff = [
  { id: "st1", roleKey: "owner", name: "Juan Ibarra", role: "Owner", dept: "Dirección", phone: "+34 600 100 001", shift: "—", status: "Disponible" },
  { id: "st2", roleKey: "director", name: "Laura Vidal", role: "Directora", dept: "Dirección", phone: "+34 600 100 002", shift: "09:00–18:00", status: "En turno" },
  { id: "st3", roleKey: "reception", name: "Ana Torres", role: "Recepción", dept: "Front Office", phone: "+34 600 100 003", shift: "07:00–15:00", status: "En turno" },
  { id: "st4", roleKey: "housekeeping", name: "María López", role: "Housekeeping", dept: "Pisos", phone: "+34 600 100 004", shift: "08:00–16:00", status: "En turno" },
  { id: "st5", roleKey: "maintenance", name: "Carlos Ruiz", role: "Mantenimiento", dept: "Técnico", phone: "+34 600 100 005", shift: "08:00–17:00", status: "En turno" },
  { id: "st6", roleKey: "revenue", name: "David Sanz", role: "Revenue Manager", dept: "Comercial", phone: "+34 600 100 006", shift: "10:00–19:00", status: "En turno" },
];

export const externals = [
  { name: "Electricidad Rivas", specialty: "Electricista", phone: "+34 910 220 330", notes: "Contrato anual. Urgencias 24h.", availability: "Disponible hoy" },
  { name: "Fontanería Núñez", specialty: "Fontanero", phone: "+34 910 440 551", notes: "Responde en < 2h.", availability: "Disponible hoy" },
  { name: "Taller Roble", specialty: "Carpintero", phone: "+34 910 660 772", notes: "Presupuesto previo obligatorio.", availability: "Desde el jueves" },
  { name: "Cerrajería Sol", specialty: "Cerrajero", phone: "+34 910 880 993", notes: "Cerraduras electrónicas Salto.", availability: "Disponible hoy" },
  { name: "ClimaPro Servicios", specialty: "Técnico climatización", phone: "+34 910 112 234", notes: "Mantenimiento equipos Daikin.", availability: "Mañana 09:00" },
];

export const integrations = [
  { name: "Booking.com", desc: "Reservas, disponibilidad y tarifas", status: "conectado", sync: "hace 2 min" },
  { name: "Expedia", desc: "Reservas y disponibilidad", status: "conectado", sync: "hace 4 min" },
  { name: "Web Booking Engine", desc: "Motor de reservas directo", status: "conectado", sync: "hace 1 min" },
  { name: "WhatsApp", desc: "Comunicación con huéspedes", status: "conectado", sync: "hace 30 s" },
  { name: "Airbnb", desc: "Reservas y mensajería", status: "pendiente", sync: "Autorización pendiente" },
  { name: "PMS externo", desc: "Migración o convivencia con tu PMS", status: "disponible", sync: "—" },
  { name: "Channel Manager", desc: "Distribución a más canales", status: "disponible", sync: "—" },
] as const;

export const actionRules = [
  { event: "CHECK-OUT", conditions: ["Habitación asignada"], actions: ["Finalizar estancia", "Detener mensajes", "Habitación → pendiente limpieza", "Crear tarea housekeeping", "Comprobar próximo check-in", "Calcular prioridad", "Notificar responsable"] },
  { event: "CHECK-IN", conditions: ["Reserva confirmada", "Habitación LISTA"], actions: ["Estancia → IN HOUSE", "Habitación → ocupada", "Activar comunicaciones In-House", "Enviar bienvenida", "Actualizar dashboard"] },
  { event: "LIMPIEZA FINALIZADA", conditions: ["Sin incidencias bloqueantes"], actions: ["Habitación → LISTA", "Notificar recepción", "Cerrar alerta de check-in"] },
  { event: "INCIDENCIA REPORTADA", conditions: ["Categoría técnica"], actions: ["Crear tarea mantenimiento", "Bloquear habitación (si procede)", "Notificar mantenimiento y dirección", "Vigilar resolución > 3 h"] },
];

/** Bed configuration of a room. Stored as readable text in `Room.beds` (e.g. "1 doble + 2 individuales") */
export const BED_KINDS = [
  { key: "doble", one: "doble", many: "dobles", sleeps: 2 },
  { key: "king", one: "king", many: "king", sleeps: 2 },
  { key: "individual", one: "individual", many: "individuales", sleeps: 1 },
  { key: "sofa", one: "sofá cama", many: "sofás cama", sleeps: 1 },
  { key: "litera", one: "litera", many: "literas", sleeps: 2 },
  { key: "cuna", one: "cuna", many: "cunas", sleeps: 0 },
] as const;
export type BedKey = (typeof BED_KINDS)[number]["key"];
export type BedCounts = Partial<Record<BedKey, number>>;

export function bedsText(c: BedCounts): string {
  return BED_KINDS.filter((k) => (c[k.key] ?? 0) > 0).map((k) => `${c[k.key]} ${c[k.key] === 1 ? k.one : k.many}`).join(" + ");
}
export function parseBeds(text: string | undefined): BedCounts {
  const out: BedCounts = {};
  for (const part of (text ?? "").toLowerCase().split("+")) {
    const m = part.trim().match(/^(?:(\d+)\s+)?(.+)$/);
    if (!m) continue;
    const k = BED_KINDS.find((b) => m[2] === b.one || m[2] === b.many);
    if (k) out[k.key] = (out[k.key] ?? 0) + Number(m[1] ?? 1);
  }
  return out;
}
/** People the beds can sleep (cribs don't count) */
export function bedSleeps(c: BedCounts): number {
  return BED_KINDS.reduce((n, k) => n + (c[k.key] ?? 0) * k.sleeps, 0);
}
export const OCCUPANCY = [{ label: "Individual", n: 1 }, { label: "Doble", n: 2 }, { label: "Triple", n: 3 }, { label: "Cuádruple", n: 4 }] as const;
export const ROOM_EXTRAS = ["Minibar", "Cafetera", "Caja fuerte", "Aire acondicionado", "Bañera de hidromasaje", "Escritorio", "Sofá", "Smart TV", "Adaptada (accesible)", "Comunicada", "Cuna disponible", "Mascotas"];
