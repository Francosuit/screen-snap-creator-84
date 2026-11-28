import { createServerFn } from '@tanstack/react-start';
import { setResponseHeader } from '@tanstack/react-start/server';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { connectionHotelInput } from './connection-contracts';

export const inspectHotelConnection = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(connectionHotelInput)
  .handler(async ({ data, context }) => {
    setResponseHeader('Cache-Control', 'no-store');
    const { authorizeConnectionHotel, hotelAccessReader, prepareConnection } = await import('./connection.server');
    const hotel = await authorizeConnectionHotel(hotelAccessReader(context.supabase), data.hotelId, context.userId);
    return prepareConnection(hotel, { bindings: process.env['SUITE_QUENDOO_BINDINGS'], credentials: process.env['SUITE_QUENDOO_CREDENTIALS'] }).setup;
  });

export const testHotelConnection = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(connectionHotelInput)
  .handler(async ({ data, context }) => {
    setResponseHeader('Cache-Control', 'no-store');
    const { authorizeConnectionHotel, hotelAccessReader, probeConnection } = await import('./connection.server');
    const hotel = await authorizeConnectionHotel(hotelAccessReader(context.supabase), data.hotelId, context.userId);
    return probeConnection(hotel, { bindings: process.env['SUITE_QUENDOO_BINDINGS'], credentials: process.env['SUITE_QUENDOO_CREDENTIALS'] });
  });