import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { Guest, Reservation, Task, Incident, Room } from './data';

export interface Operations {
  guests: Guest[]; reservations: Reservation[]; tasks: Task[]; incidents: Incident[];
  room_operations: Pick<Room, 'number' | 'hk' | 'oos'>[];
}
export type OperationalSlice = Pick<Operations, 'guests' | 'reservations' | 'tasks' | 'incidents'> & { rooms: Room[] };
export interface OperationChange { entity: keyof Operations; id: string; before: Json; after: Json }
const entities: (keyof Operations)[] = ['guests', 'reservations', 'tasks', 'incidents', 'room_operations'];
const json = (value: unknown): Json => JSON.parse(JSON.stringify(value));
export function operationSnapshot(slice: OperationalSlice): Operations {
  return { guests: slice.guests, reservations: slice.reservations, tasks: slice.tasks, incidents: slice.incidents,
    room_operations: slice.rooms.map(({ number, hk, oos }) => ({ number, hk, oos })) };
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
export function operationChanges(before: OperationalSlice, after: OperationalSlice): OperationChange[] {
  const a = operationSnapshot(before), b = operationSnapshot(after), changes: OperationChange[] = [];
  for (const entity of entities) {
    const key = (row: object) => 'id' in row ? String(row.id) : 'number' in row ? String(row.number) : '';
    const old = new Map(a[entity].map(row => [key(row), row]));
    const next = new Map(b[entity].map(row => [key(row), row]));
    for (const id of new Set([...old.keys(), ...next.keys()])) {
      const previous = old.get(id) ?? null, current = next.get(id) ?? null;
      if (canonical(previous) !== canonical(current)) changes.push({ entity, id, before: json(previous), after: json(current) });
    }
  }
  // Delete dependants first; insert guests before reservations.
  return changes.sort((a, b) => a.after === null && b.after === null ? entities.indexOf(b.entity) - entities.indexOf(a.entity) : a.after === null ? -1 : b.after === null ? 1 : entities.indexOf(a.entity) - entities.indexOf(b.entity));
}
export function overlayOperations<T extends OperationalSlice>(slice: T, stored: Operations): T {
  const rooms = new Map(stored.room_operations.map(row => [row.number, row]));
  return { ...slice, guests: stored.guests, reservations: stored.reservations, tasks: stored.tasks, incidents: stored.incidents,
    rooms: slice.rooms.map(room => ({ ...room, ...rooms.get(room.number) })) };
}
export async function loadOperations(hotelId: string): Promise<Operations> {
  const { data, error } = await supabase.rpc('suite_load_operations', { _hotel: hotelId });
  if (error) throw new Error(error.message);
  return data as unknown as Operations;
}
export async function saveOperations(hotelId: string, changes: OperationChange[]): Promise<void> {
  const { error } = await supabase.rpc('suite_apply_operations', { _hotel: hotelId, _changes: json(changes) });
  if (error) throw new Error(error.code === '40001' ? 'Otra persona cambió estos datos. Se recargaron; vuelve a intentarlo.' : error.code === '23P01' ? 'Otra reserva ocupa esa habitación en esas fechas.' : error.code === '42501' ? 'Tu perfil no tiene permiso para guardar esta operación.' : error.message);
}