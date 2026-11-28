import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { isTimeZone, resolveTimeZone } from '../clock';
import { ProviderFailure } from './engine.server';
import { qcId } from './quendoo-contracts';
import { QuendooClient } from './quendoo.server';
import type { ConnectionProbe, ConnectionSetup, SetupIssue } from './connection-contracts';

export interface AuthorizedHotel { id: string; name: string; organizationId: string; timezone: string }
export interface HotelAccessReader {
  canManage(hotelId: string, userId: string): Promise<boolean>;
  hotel(hotelId: string): Promise<AuthorizedHotel | null>;
}
/** Both module ceiling and active owner/director role must pass in the database. */
export function hotelAccessReader(client: SupabaseClient<Database>): HotelAccessReader {
  return {
    async canManage(hotelId, userId) {
      const [module, role] = await Promise.all([
        client.rpc('suite_can_access', { _hotel: hotelId, _module: 'integraciones' }),
        client.rpc('has_hotel_role', { _hotel: hotelId, _uid: userId, _roles: ['owner', 'director'] }),
      ]);
      if (module.error || role.error) throw new Error('No se pudieron comprobar los permisos. Reintenta.');
      return module.data === true && role.data === true;
    },
    async hotel(hotelId) {
      const { data, error } = await client.from('hotels').select('id,name,org_owner,timezone').eq('id', hotelId).eq('archived', false).maybeSingle();
      if (error) throw new Error('No se pudo consultar el hotel. Reintenta.');
      return data ? { id: data.id, name: data.name, organizationId: data.org_owner, timezone: resolveTimeZone(data.timezone) } : null;
    },
  };
}
export async function authorizeConnectionHotel(reader: HotelAccessReader, hotelId: string, verifiedUserId: string): Promise<AuthorizedHotel> {
  if (!verifiedUserId || !await reader.canManage(hotelId, verifiedUserId)) throw new Error('No tienes permiso para administrar las integraciones de este hotel.');
  const hotel = await reader.hotel(hotelId);
  if (!hotel || hotel.id !== hotelId) throw new Error('No tienes permiso para administrar las integraciones de este hotel.');
  return hotel;
}

const bindingSchema = z.object({ hotelId: z.string().uuid(), organizationId: z.string().uuid(), propertyId: qcId, environment: z.literal('staging') }).strict();
const secret = z.string().min(1).max(8192).refine(v => !/[\r\n]/.test(v));
const credentialsSchema = z.union([
  z.object({ token: secret }).strict(),
  z.object({ clientId: secret, clientSecret: secret }).strict(),
]);
export interface ConnectionConfiguration { bindings?: string | undefined; credentials?: string | undefined }
interface Prepared { setup: ConnectionSetup; credentials: Readonly<Record<string, string>> | null }

/** Server environment only. No client-selected property/ref, no plaintext DB column,
 * no global credential cache. Inactive/malformed configuration fails closed. */
export function prepareConnection(hotel: AuthorizedHotel, config: ConnectionConfiguration): Prepared {
  const base: ConnectionSetup = { provider: 'quendoo', environment: 'staging', hotelId: hotel.id, hotelName: hotel.name, hotelTimezone: hotel.timezone, state: 'authorization_required', issue: null, propertyId: null, incoming: 'not_active', outgoing: 'not_active', persistence: 'activation_pending' };
  const blocked = (issue: SetupIssue): Prepared => ({ setup: { ...base, issue, state: issue.endsWith('_invalid') ? 'configuration_error' : 'authorization_required' }, credentials: null });
  if (!config.bindings) return blocked('binding_missing');
  let bindings: z.infer<typeof bindingSchema>[];
  try { bindings = z.array(bindingSchema).max(500).parse(JSON.parse(config.bindings)); }
  catch { return blocked('binding_invalid'); }
  // Every external property has one owner; duplicate bindings are never ambiguous routing.
  if (new Set(bindings.map(b => b.hotelId)).size !== bindings.length || new Set(bindings.map(b => b.propertyId)).size !== bindings.length) return blocked('binding_invalid');
  const binding = bindings.find(b => b.hotelId === hotel.id);
  if (!binding) return blocked('binding_missing');
  if (binding.organizationId !== hotel.organizationId) return blocked('binding_invalid');
  base.propertyId = binding.propertyId;
  if (!config.credentials) return blocked('credentials_missing');
  let raw: unknown;
  try { raw = JSON.parse(config.credentials); } catch { return blocked('credentials_invalid'); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return blocked('credentials_invalid');
  // Own-key lookup prevents prototype keys from resolving another credential.
  if (!Object.prototype.hasOwnProperty.call(raw, hotel.id)) return blocked('credentials_missing');
  const parsed = credentialsSchema.safeParse((raw as Record<string, unknown>)[hotel.id]);
  if (!parsed.success) return blocked('credentials_invalid');
  return { setup: { ...base, state: 'configured' }, credentials: parsed.data };
}

/** Read-only real HTTP probe. Never pulls reservations, writes inventory or ACKs. */
export async function probeConnection(hotel: AuthorizedHotel, config: ConnectionConfiguration, client = new QuendooClient('staging'), now: () => Date = () => new Date()): Promise<ConnectionProbe> {
  const prepared = prepareConnection(hotel, config);
  const { setup, credentials } = prepared;
  if (!credentials || !setup.propertyId) return { status: 'blocked', setup };
  try {
    const token = await client.token(credentials);
    const property = await client.property(token, setup.propertyId);
    if (property.id !== setup.propertyId || !isTimeZone(property.timezone) || property.mode === 'disabled') throw new ProviderFailure('invalid_data', false);
    const [rooms, plans] = await Promise.all([client.roomTypes(token, property.id), client.ratePlans(token, property.id)]);
    const roomIds = new Set(rooms.room_types.map(r => r.id));
    if (roomIds.size !== rooms.room_types.length || new Set(plans.rate_plans.map(p => p.id)).size !== plans.rate_plans.length || plans.rate_plans.some(p => !roomIds.has(p.room_type_id))) throw new ProviderFailure('invalid_data', false);
    const zoneId = (zone: string) => new Intl.DateTimeFormat('en', { timeZone: zone }).resolvedOptions().timeZone;
    return { status: 'verified', checkedAt: now().toISOString(), property, timezoneMatches: zoneId(property.timezone) === zoneId(hotel.timezone), roomTypes: rooms.room_types, ratePlans: plans.rate_plans };
  } catch (error) {
    return { status: 'failed', checkedAt: now().toISOString(), code: error instanceof ProviderFailure ? error.code : 'unknown' };
  }
}