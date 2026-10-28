import { supabase } from "@/integrations/supabase/client";
import { applyRoomEdit, validateRoomEdit, type Hotel, type Room, type RoomEdit, type WindowSide } from "./data";
import { canEditRoom } from "./room-permissions";

export type HotelRole = "owner" | "director" | "reception" | "housekeeping" | "maintenance" | "revenue";
export const ROLE_LABELS: Record<HotelRole, string> = {
  owner: "Propietario", director: "Dirección", reception: "Recepción",
  housekeeping: "Housekeeping", maintenance: "Mantenimiento", revenue: "Revenue",
};
export const STAFF_ROLES: HotelRole[] = ["director", "reception", "housekeeping", "maintenance", "revenue"];

export interface CloudHotel { id: string; key: string; name: string; address: string; city: string; category: string; check_in: string | null; check_out: string | null; zones: string[]; departments: string[]; archived: boolean; org_owner: string }
export interface CloudFloor { hotel_id: string; number: number; name: string }
export interface CloudRoom { hotel_id: string; number: string; floor: number; type: string; rate: number; capacity: number | null; beds: string | null; bath: string | null; terrace: boolean | null; view: string | null; sqm: number | null; notes: string | null; archived: boolean; extras?: string[]; window_side?: string | null }
export interface CloudConfig { hotels: CloudHotel[]; floors: CloudFloor[]; rooms: CloudRoom[] }

const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
const nn = <T,>(v: T | null): T | undefined => (v === null ? undefined : v);

/** Applies the stored records (source of truth for configuration) over a hotel and its rooms.
 *  Operational fields (housekeeping, out-of-service, plan position) stay as they are. */
export function overlayHotel(h: Hotel, rooms: Room[], cfg: CloudConfig): { hotel: Hotel; rooms: Room[] } {
  const ch = cfg.hotels.find((x) => x.key === h.id && !x.archived);
  if (!ch) return { hotel: h, rooms };
  const floors = cfg.floors.filter((f) => f.hotel_id === ch.id).sort((a, b) => a.number - b.number);
  const recs = new Map(cfg.rooms.filter((r) => r.hotel_id === ch.id && !r.archived).map((r) => [r.number, r]));
  const hotel = clean({
    ...h, name: ch.name || h.name, address: ch.address, city: ch.city, category: ch.category,
    zones: ch.zones, departments: ch.departments, checkIn: nn(ch.check_in) ?? h.checkIn, checkOut: nn(ch.check_out) ?? h.checkOut,
    floors: floors.length ? floors.map((f) => ({ number: f.number, name: f.name })) : h.floors,
  }) as Hotel;
  const out = rooms.map((r) => {
    const c = recs.get(r.number);
    if (!c) return r;
    return clean({ ...r, floor: c.floor, type: c.type, rate: Number(c.rate), capacity: nn(c.capacity), beds: nn(c.beds), bath: nn(c.bath), terrace: nn(c.terrace), view: nn(c.view), sqm: c.sqm == null ? undefined : Number(c.sqm), notes: nn(c.notes), extras: c.extras ?? r.extras, window: c.window_side === undefined ? r.window : nn(c.window_side) }) as Room;
  });
  return { hotel, rooms: out };
}

export async function loadConfig(): Promise<CloudConfig | null> {
  const [h, f, r] = await Promise.all([
    supabase.from("hotels").select("*"),
    supabase.from("hotel_floors").select("hotel_id, number, name"),
    supabase.from("hotel_rooms").select("*"),
  ]);
  if (h.error || f.error || r.error) return null;
  return { hotels: h.data as CloudHotel[], floors: f.data as CloudFloor[], rooms: r.data as unknown as CloudRoom[] };
}

export async function claimInvites() { await supabase.rpc("suite_claim_invites"); }

export async function myMemberships() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data } = await supabase.from("hotel_members").select("hotel_id, role").eq("user_id", u.user.id);
  return (data ?? []) as { hotel_id: string; role: HotelRole }[];
}

/** Database validates identity, hotel membership and fields again; never trusts a UI role. */
export async function saveRoomConfig(hotelId: string, room: Room, edit: RoomEdit): Promise<Room> {
  const error = validateRoomEdit(edit);
  if (error) throw new Error(error);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Inicia sesión para guardar esta habitación");
  const { data: hotel } = await supabase.from("hotels").select("org_owner").eq("id", hotelId).single();
  const { data: membership } = await supabase.from("hotel_members").select("role").eq("hotel_id", hotelId).eq("user_id", auth.user.id).maybeSingle();
  if (hotel?.org_owner !== auth.user.id && !canEditRoom(membership?.role)) throw new Error("No tienes permiso para editar esta habitación");
  const payload = Object.fromEntries(Object.entries(edit).map(([k, v]) => [k, v ?? null]));
  const { data, error: failure } = await supabase.rpc("suite_edit_room", { _hotel: hotelId, _number: room.number, _edit: payload });
  if (failure) throw new Error(failure.message);
  const saved = data as unknown as CloudRoom;
  return applyRoomEdit(room, { type: saved.type, rate: Number(saved.rate), capacity: nn(saved.capacity), beds: nn(saved.beds), bath: nn(saved.bath), terrace: nn(saved.terrace), view: nn(saved.view), sqm: nn(saved.sqm), notes: nn(saved.notes), extras: saved.extras ?? [], window: nn(saved.window_side ?? null) as WindowSide | undefined }).room;
}

export async function roomHistory(hotelId: string, number: string) {
  const { data } = await supabase.from("audit_log").select("id, at, action, before, after").eq("hotel_id", hotelId).eq("entity", "hotel_rooms").eq("entity_key", number).order("at", { ascending: false }).limit(8);
  return data ?? [];
}
