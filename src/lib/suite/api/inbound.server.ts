import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/integrations/supabase/types';
import type { Guest } from '../data';
import { hotelTime, hotelToday, resolveTimeZone } from '../clock';
import { qcId, qcRevision } from './quendoo-contracts';
import type { QuendooRevision } from './quendoo-contracts';
import { QuendooClient, verifyQuendooSignature } from './quendoo.server';
import type { QuendooRevisionWriter } from './quendoo.server';
import { externalIds, inboundBinding, planRevision } from './inbound';
import type { ExternalReservation, IgnoreReason, InboundAction, InboundBinding, PlanRoom, RejectReason } from './inbound';

/** Isolated test hotel for end-to-end inbound validation. Only it may receive test-signed deliveries. */
export const TEST_BINDINGS: readonly InboundBinding[] = Object.freeze([{
  hotelId: '8acd9d61-1519-4083-bce4-b22288f36344', organizationId: '3bb2396f-77b9-4263-bc2d-6d3899511546',
  propertyId: 'suite-sandbox-p0', environment: 'test', roomTypes: { 'DBL-STD': 'Doble Estándar', 'DBL-SUP': 'Doble Superior' },
}]);

export type InboundOutcome =
  | { status: 'applied'; action: InboundAction; reservationId: string; room: string; revisionId: number; bookingCode: string }
  | { status: 'duplicate'; reservationId: string; revisionId: number; bookingCode: string }
  | { status: 'ignored'; reason: IgnoreReason; reservationId: string; revisionId: number; bookingCode: string }
  | { status: 'rejected'; reason: RejectReason | 'hotel_mismatch' | 'write_conflict'; reservationId: string; revisionId: number; bookingCode: string };

export interface InboundHotel { id: string; organizationId: string; timezone: string }
export interface InboundSnapshot { reservations: ExternalReservation[]; rooms: PlanRoom[]; guest: Guest | null; version: number | null }
export interface InboundStore {
  hotel(hotelId: string): Promise<InboundHotel | null>;
  load(hotelId: string, reservationId: string, guestId: string): Promise<InboundSnapshot>;
  saveGuest(hotelId: string, guest: Guest): Promise<void>;
  /** Insert when expectedVersion is null, otherwise compare-and-set on the row version. False = concurrent change. */
  saveReservation(hotelId: string, reservation: ExternalReservation, expectedVersion: number | null): Promise<boolean>;
  read(hotelId: string, reservationId: string): Promise<ExternalReservation | null>;
  log(hotelId: string, binding: InboundBinding, outcome: InboundOutcome, revisionType: string): Promise<void>;
}

class Overlap extends Error {}

/** Receive → validate → map → persist → durable read-back. Every outcome is logged without guest data. */
export async function receiveRevision(store: InboundStore, binding: InboundBinding, input: unknown, now: Date): Promise<InboundOutcome> {
  const parsed = qcRevision.safeParse(input);
  const code = parsed.success ? parsed.data.booking_code : 'desconocida';
  const revisionId = parsed.success ? parsed.data.id : 0;
  const { reservationId, guestId } = externalIds(code);
  const base = { reservationId, revisionId, bookingCode: code };
  const finish = async (o: InboundOutcome) => { await store.log(binding.hotelId, binding, o, parsed.success ? parsed.data.revision_type : 'invalid'); return o; };
  const hotel = await store.hotel(binding.hotelId);
  if (!hotel || hotel.organizationId !== binding.organizationId) return finish({ status: 'rejected', reason: 'hotel_mismatch', ...base });
  const tz = resolveTimeZone(hotel.timezone);
  for (let attempt = 0; attempt < 2; attempt++) {
    const snap = await store.load(binding.hotelId, reservationId, guestId);
    const plan = planRevision(input, binding, { reservations: snap.reservations, rooms: snap.rooms, guest: snap.guest, today: hotelToday('real', tz, now).offset, nowIso: now.toISOString(), time: hotelTime(tz, now) });
    if (plan.kind === 'duplicate') return finish({ status: 'duplicate', ...base });
    if (plan.kind === 'ignored') return finish({ status: 'ignored', reason: plan.reason, ...base });
    if (plan.kind === 'rejected') return finish({ status: 'rejected', reason: plan.reason, ...base });
    try {
      await store.saveGuest(binding.hotelId, plan.guest);
      if (!await store.saveReservation(binding.hotelId, plan.reservation, snap.version)) continue;
    } catch (error) {
      if (error instanceof Overlap) return finish({ status: 'rejected', reason: 'no_room_available', ...base });
      throw error;
    }
    const stored = await store.read(binding.hotelId, reservationId);
    if (!stored?.external || stored.external.revisionId < revisionId) throw new Error('Inbound read-back failed');
    return finish({ status: 'applied', action: plan.action, room: stored.room, ...base });
  }
  return finish({ status: 'rejected', reason: 'write_conflict', ...base });
}

/** Writer for the official feed: rejected revisions are NOT acknowledged, so they come back after a fix. */
export function revisionWriter(store: InboundStore, binding: InboundBinding, now: () => Date = () => new Date()): QuendooRevisionWriter {
  const outcomes = new Map<number, InboundOutcome>();
  return {
    async apply(_scope, revision) {
      const outcome = await receiveRevision(store, binding, revision, now());
      if (outcome.status === 'rejected') throw new Error(`Revision ${revision.id} rejected: ${outcome.reason}`);
      outcomes.set(revision.id, outcome);
    },
    async committed(_scope, revision) {
      const outcome = outcomes.get(revision.id);
      if (!outcome) return false;
      if (outcome.status === 'ignored') return true;
      const stored = await store.read(binding.hotelId, outcome.reservationId);
      return !!stored?.external && stored.external.revisionId >= revision.id;
    },
  };
}

export function supabaseInboundStore(admin: SupabaseClient<Database>): InboundStore {
  return {
    async hotel(hotelId) {
      const { data, error } = await admin.from('hotels').select('id,org_owner,timezone').eq('id', hotelId).eq('archived', false).maybeSingle();
      if (error) throw new Error('hotel read failed');
      return data ? { id: data.id, organizationId: data.org_owner, timezone: resolveTimeZone(data.timezone) } : null;
    },
    async load(hotelId, reservationId, guestId) {
      const [res, rooms, ops, guest] = await Promise.all([
        admin.from('hotel_reservations').select('id,data,version').eq('hotel_id', hotelId).range(0, 4999),
        admin.from('hotel_rooms').select('number,type,rate,capacity').eq('hotel_id', hotelId).eq('archived', false),
        admin.from('hotel_room_operations').select('id,data').eq('hotel_id', hotelId),
        admin.from('hotel_guests').select('data').eq('hotel_id', hotelId).eq('id', guestId).maybeSingle(),
      ]);
      if (res.error || rooms.error || ops.error || guest.error) throw new Error('inbound load failed');
      const oos = new Set(ops.data.filter(o => (o.data as { oos?: unknown })?.oos === true).map(o => o.id));
      return {
        reservations: res.data.map(r => r.data as unknown as ExternalReservation),
        rooms: rooms.data.map(r => ({ number: r.number, type: r.type, rate: Number(r.rate), capacity: r.capacity ?? undefined, oos: oos.has(r.number) })),
        guest: (guest.data?.data as unknown as Guest | undefined) ?? null,
        version: res.data.find(r => r.id === reservationId)?.version ?? null,
      };
    },
    async saveGuest(hotelId, guest) {
      const { error } = await admin.from('hotel_guests').upsert({ hotel_id: hotelId, id: guest.id, data: guest as unknown as Json }, { onConflict: 'hotel_id,id' });
      if (error) throw new Error('guest write failed');
    },
    async saveReservation(hotelId, r, expectedVersion) {
      const row = { data: r as unknown as Json }; // guest_id is generated from data.guestId
      const result = expectedVersion === null
        ? await admin.from('hotel_reservations').insert({ hotel_id: hotelId, id: r.id, ...row }).select('id')
        : await admin.from('hotel_reservations').update(row).eq('hotel_id', hotelId).eq('id', r.id).eq('version', expectedVersion).select('id');
      if (result.error) {
        if (result.error.code === '23P01' || /overlaps/i.test(result.error.message)) throw new Overlap();
        if (result.error.code === '23505') return false; // concurrent insert of the same booking
        console.error('[inbound] reservation write failed', result.error.code, result.error.message);
        throw new Error('reservation write failed');
      }
      return result.data.length === 1;
    },
    async read(hotelId, reservationId) {
      const { data, error } = await admin.from('hotel_reservations').select('data').eq('hotel_id', hotelId).eq('id', reservationId).maybeSingle();
      if (error) throw new Error('read-back failed');
      return (data?.data as unknown as ExternalReservation | undefined) ?? null;
    },
    async log(hotelId, binding, o, revisionType) {
      const after = { provider: 'quendoo', environment: binding.environment, propertyId: binding.propertyId, revisionType, ...o };
      const { error } = await admin.from('audit_log').insert({ hotel_id: hotelId, entity: 'quendoo_sync', entity_key: String(o.revisionId), action: o.status, after: after as unknown as Json });
      if (error) throw new Error('sync log write failed');
    },
  };
}

/** Test-mode signing key, derived server-side; never sent to the browser or stored in code. */
export async function testSigningKey(root: string | undefined): Promise<string | undefined> {
  if (!root) return undefined;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(root), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('suite-quendoo-test-webhook-v1')));
  return Array.from(mac, b => b.toString(16).padStart(2, '0')).join('');
}

export async function signDelivery(body: string, secret: string, event: string, eventId: string, now: Date): Promise<Headers> {
  const timestamp = String(Math.floor(now.getTime() / 1000));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${body}`)));
  return new Headers({ 'Content-Type': 'application/json', 'X-Qc-Timestamp': timestamp, 'X-Qc-Signature-256': `sha256=${Array.from(mac, b => b.toString(16).padStart(2, '0')).join('')}`, 'X-Qc-Event': event, 'X-Qc-Event-Id': eventId, 'X-Qc-Api-Version': 'v1', 'X-Qc-Attempt': '1' });
}

export interface WebhookDeps {
  bindings: readonly InboundBinding[];
  secretFor(binding: InboundBinding): string | undefined;
  store: InboundStore;
  now(): Date;
  /** Official doorbell semantics for staging: read the feed (needs credentials). Undefined = not configured. */
  pullFeed?: ((binding: InboundBinding) => Promise<number>) | undefined;
}
export interface WebhookResult { status: number; body: Record<string, unknown> }

const deliveryBody = z.object({ property_id: qcId, booking_revision: z.unknown().optional() }).passthrough();

/** Public endpoint core: signature over raw bytes first, then routing by backend binding only. */
export async function handleQuendooWebhook(raw: string, headers: Headers, deps: WebhookDeps): Promise<WebhookResult> {
  if (new TextEncoder().encode(raw).byteLength > 262144) return { status: 413, body: { error: 'payload_too_large' } };
  const now = deps.now();
  const verified: InboundBinding[] = [];
  for (const binding of deps.bindings) {
    if (await verifyQuendooSignature(raw, headers, deps.secretFor(binding), now)) verified.push(binding);
  }
  if (!verified.length) return { status: 401, body: { error: 'invalid_signature' } };
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return { status: 400, body: { error: 'invalid_json' } }; }
  const body = deliveryBody.safeParse(json);
  if (!body.success) return { status: 400, body: { error: 'invalid_body' } };
  const binding = verified.find(b => b.propertyId === body.data.property_id);
  if (!binding) return { status: 404, body: { error: 'unknown_property' } };
  const event = headers.get('X-Qc-Event') ?? '';
  if (event === 'webhook.test') return { status: 200, body: { ok: true } };
  if (!event.startsWith('booking.')) return { status: 200, body: { ok: true, ignored: event } };
  if (binding.environment === 'test') {
    if (body.data.booking_revision === undefined) return { status: 400, body: { error: 'missing_revision' } };
    const outcome = await receiveRevision(deps.store, binding, body.data.booking_revision, now);
    return { status: outcome.status === 'rejected' ? 422 : 200, body: { ...outcome } };
  }
  // Staging/production: the webhook is a doorbell; the feed is the truth.
  if (!deps.pullFeed) return { status: 503, body: { error: 'feed_not_configured' } };
  const processed = await deps.pullFeed(binding);
  return { status: 200, body: { ok: true, processed } };
}

const stagingSchema = z.array(inboundBinding.refine(b => b.environment === 'staging')).max(500);
/** Staging bindings and secrets come only from server configuration. Malformed config fails closed. */
export function configuredBindings(env: Record<string, string | undefined>): InboundBinding[] {
  let staging: InboundBinding[] = [];
  try { staging = env['SUITE_QUENDOO_INBOUND'] ? stagingSchema.parse(JSON.parse(env['SUITE_QUENDOO_INBOUND'])) : []; } catch { staging = []; }
  const all = [...TEST_BINDINGS, ...staging];
  return all.filter(b => all.filter(x => x.propertyId === b.propertyId || x.hotelId === b.hotelId).length === 1);
}

export async function webhookDeps(env: Record<string, string | undefined>, admin: SupabaseClient<Database>): Promise<WebhookDeps> {
  const testKey = await testSigningKey(env['SUPABASE_SERVICE_ROLE_KEY']);
  let stagingSecrets: Record<string, unknown> = {};
  try { stagingSecrets = env['SUITE_QUENDOO_WEBHOOK_SECRETS'] ? z.record(z.string()).parse(JSON.parse(env['SUITE_QUENDOO_WEBHOOK_SECRETS'])) : {}; } catch { stagingSecrets = {}; }
  let credentials: Record<string, unknown> = {};
  try { credentials = env['SUITE_QUENDOO_CREDENTIALS'] ? JSON.parse(env['SUITE_QUENDOO_CREDENTIALS']) as Record<string, unknown> : {}; } catch { credentials = {}; }
  const store = supabaseInboundStore(admin);
  const own = (o: Record<string, unknown>, k: string) => Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined;
  return {
    bindings: configuredBindings(env), store, now: () => new Date(),
    secretFor: b => b.environment === 'test' ? testKey : (typeof own(stagingSecrets, b.propertyId) === 'string' ? own(stagingSecrets, b.propertyId) as string : undefined),
    pullFeed: Object.keys(credentials).length ? async (binding) => {
      const creds = own(credentials, binding.hotelId);
      if (!creds || typeof creds !== 'object') throw new Error('credentials missing');
      const client = new QuendooClient('staging');
      const token = await client.token(creds as Record<string, string>);
      const page = await client.feed(token, binding.propertyId, { since: 0, limit: 50 });
      const writer = revisionWriter(store, binding);
      const scope = { organizationId: binding.organizationId, hotelId: binding.hotelId, connectionId: binding.propertyId, propertyId: binding.propertyId };
      let acknowledged = 0;
      for (const revision of page.booking_revisions as QuendooRevision[]) {
        await writer.apply(scope, revision);
        if (!await writer.committed(scope, revision)) break;
        await client.acknowledge(token, revision.id); // ACK only after durable read-back
        acknowledged++;
      }
      return acknowledged;
    } : undefined,
  };
}
