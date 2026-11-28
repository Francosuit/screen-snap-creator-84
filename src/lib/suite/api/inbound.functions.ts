import { createServerFn } from '@tanstack/react-start';
import { setResponseHeader } from '@tanstack/react-start/server';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { connectionHotelInput } from './connection-contracts';
import { testRevisionInput } from './inbound-contracts';
import type { InboundStatus, SyncLogEntry } from './inbound-contracts';

export const inboundStatus = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(connectionHotelInput)
  .handler(async ({ data, context }): Promise<InboundStatus> => {
    setResponseHeader('Cache-Control', 'no-store');
    const { authorizeConnectionHotel, hotelAccessReader } = await import('./connection.server');
    const { configuredBindings } = await import('./inbound.server');
    const hotel = await authorizeConnectionHotel(hotelAccessReader(context.supabase), data.hotelId, context.userId);
    const binding = configuredBindings(process.env).find(b => b.hotelId === hotel.id && b.organizationId === hotel.organizationId);
    // Sync log is read with the caller's own permissions (owner/director RLS on audit_log).
    const { data: rows, error } = await context.supabase.from('audit_log').select('at,action,entity_key,after').eq('hotel_id', hotel.id).eq('entity', 'quendoo_sync').order('at', { ascending: false }).limit(25);
    if (error) throw new Error('No se pudo leer el registro de sincronización.');
    const field = (o: unknown, k: string) => { const v = (o as Record<string, unknown> | null)?.[k]; return typeof v === 'string' || typeof v === 'number' ? String(v) : null; };
    const log: SyncLogEntry[] = rows.map(r => ({ at: r.at, status: r.action, revisionId: r.entity_key, bookingCode: field(r.after, 'bookingCode'), revisionType: field(r.after, 'revisionType'), reservationId: field(r.after, 'reservationId'), room: field(r.after, 'room'), reason: field(r.after, 'reason'), action: field(r.after, 'action') }));
    return { mode: binding?.environment ?? 'none', propertyId: binding?.propertyId ?? null, roomTypes: binding ? Object.entries(binding.roomTypes).map(([code, type]) => ({ code, type })) : [], endpoint: '/api/public/quendoo/webhook', log };
  });

/** Isolated test hotel only: builds an official-shape BookingRevision, signs it and runs it through the public webhook handler. */
export const sendTestRevision = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(testRevisionInput)
  .handler(async ({ data, context }) => {
    setResponseHeader('Cache-Control', 'no-store');
    const { authorizeConnectionHotel, hotelAccessReader } = await import('./connection.server');
    const { TEST_BINDINGS, handleQuendooWebhook, signDelivery, testSigningKey, webhookDeps } = await import('./inbound.server');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const hotel = await authorizeConnectionHotel(hotelAccessReader(context.supabase), data.hotelId, context.userId);
    const binding = TEST_BINDINGS.find(b => b.hotelId === hotel.id && b.organizationId === hotel.organizationId);
    if (!binding) throw new Error('Este hotel no es el entorno aislado de pruebas.');
    if (!Object.prototype.hasOwnProperty.call(binding.roomTypes, data.roomCode)) throw new Error('Código de habitación no mapeado.');
    const key = await testSigningKey(process.env['SUPABASE_SERVICE_ROLE_KEY']);
    if (!key) throw new Error('Firma de pruebas no disponible en el servidor.');
    const now = new Date();
    const bookingCode = data.bookingCode ?? `SBX-${crypto.getRandomValues(new Uint32Array(1))[0]!.toString(36).toUpperCase().padStart(6, '0').slice(-6)}`;
    const type = data.action === 'create' ? 'created' : data.action === 'modify' ? 'modified' : 'cancelled';
    const cancelled = data.action === 'cancel';
    const revision = {
      id: now.getTime(), booking_code: bookingCode, property_id: binding.propertyId, revision_type: type, created_at: now.toISOString(),
      payload: {
        booking_code: bookingCode, revision_id: `sbx${now.getTime().toString(16)}`, revision_number: String(now.getTime()), booking_id: now.getTime() % 1000000,
        booking_status: data.action === 'create' ? 'new' : cancelled ? 'cancelled' : 'modified', status: cancelled ? 'CANCELLED' : 'CREATED', payment_status: 'WAITING',
        property_id: binding.propertyId, ext_property_id: binding.propertyId, bs_ota_code: 'QCN', checkin_date: data.checkIn, checkout_date: data.checkOut,
        total_amount: data.amount, currency: 'EUR', client: { name: data.guestName, email: 'sandbox@example.invalid', phone: '—' },
        additional_notes: 'PRUEBA API — entorno aislado', booking_items: [{ booking_item_id: 1, room_id: data.roomCode, ext_room_id: data.roomCode, num_adults: data.adults, booking_item_status: cancelled ? 'cancelled' : 'active' }], payments_plans: [],
      },
    };
    const raw = JSON.stringify({ event: `booking.${type}`, property_id: binding.propertyId, booking_revision: revision });
    const headers = await signDelivery(raw, key, `booking.${type}`, `evt_sbx_${now.getTime()}`, now);
    const result = await handleQuendooWebhook(raw, headers, await webhookDeps(process.env, supabaseAdmin));
    return { httpStatus: result.status, bookingCode, result: JSON.parse(JSON.stringify(result.body)) as Record<string, string | number | boolean> };
  });
