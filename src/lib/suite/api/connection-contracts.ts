import { z } from 'zod';

/** Browser submits only the internal hotel. Property and credentials are backend-owned. */
export const connectionHotelInput = z.object({ hotelId: z.string().uuid() }).strict();
export type SetupIssue = 'binding_missing' | 'binding_invalid' | 'credentials_missing' | 'credentials_invalid';
export interface ConnectionSetup {
  provider: 'quendoo';
  environment: 'staging';
  hotelId: string;
  hotelName: string;
  hotelTimezone: string;
  state: 'authorization_required' | 'configured' | 'configuration_error';
  issue: SetupIssue | null;
  propertyId: string | null;
  // A configured secret or successful probe does not activate the PMS writer.
  incoming: 'not_active';
  outgoing: 'not_active';
  persistence: 'activation_pending';
}
export type ConnectionProbe =
  | { status: 'blocked'; setup: ConnectionSetup }
  | { status: 'failed'; checkedAt: string; code: 'provider_auth' | 'rate_limit' | 'unavailable' | 'invalid_data' | 'unknown' }
  | { status: 'verified'; checkedAt: string; property: { id: string; name: string | null; mode: string; currency: string; timezone: string }; timezoneMatches: boolean; roomTypes: { id: string; name: string; qty: number }[]; ratePlans: { id: string; room_type_id: string; name: string; sell_type: string }[] };