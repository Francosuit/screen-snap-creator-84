import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/integrations/supabase/types";
import type { AuthorizedHotel } from "./connection.server";
import {
  newSuiteCredentials,
  openSigningSecret,
  sha256Hex,
  signSuiteBody,
  verifySuiteSignature,
  equalHex,
} from "./suite-api-crypto.server";
import { suiteApiRequestBody, suiteApiDateQuery } from "./suite-api-contracts";
import type {
  CreateSuiteApiInput,
  ConfigureSuiteApiInput,
  SuiteApiCredentials,
  SuiteApiEventDto,
  SuiteApiIntegrationDto,
  SuiteApiOverview,
  SuiteApiTestResult,
} from "./suite-api-contracts";
import type { InboundBinding } from "./inbound";
import { receiveRevision, supabaseInboundStore } from "./inbound.server";
import { distributionSnapshot, reservationSnapshot } from "./pms";
import type { ExternalReservation } from "./inbound";

// The additive schema is applied separately; these DTOs keep this module compilable before regeneration.
export type SuiteAdmin = SupabaseClient;
interface IntegrationRow {
  id: string; hotel_id: string; organization_id: string; name: string; status: string;
  property_id: string; key_prefix: string; key_hash: string; api_key_ciphertext: string; permissions: string[];
  signing_secret_ciphertext: string; request_limit_per_minute: number; credential_version: number;
  created_at: string; rotated_at: string | null; revoked_at: string | null; last_used_at: string | null;
}
interface MappingRow { integration_id: string; hotel_id: string; external_code: string; room_number: string }
const json = (v: unknown): Json => JSON.parse(JSON.stringify(v));
const keyPattern = /^sk_suite_[a-f0-9]{64}$/;
const integrationIdPattern = z.string().uuid();

function dto(row: IntegrationRow, mappings: MappingRow[]): SuiteApiIntegrationDto {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    organizationId: row.organization_id,
    name: row.name,
    status: row.status as SuiteApiIntegrationDto["status"],
    propertyId: row.property_id,
    keyPrefix: row.key_prefix,
    permissions: row.permissions as SuiteApiIntegrationDto["permissions"],
    roomMappings: mappings.map((m) => ({
      externalCode: m.external_code,
      roomNumber: m.room_number,
    })),
    endpoint: `/api/public/suite/${row.id}/reservations`,
    createdAt: row.created_at,
    rotatedAt: row.rotated_at,
    revokedAt: row.revoked_at,
    lastUsedAt: row.last_used_at,
    requestLimitPerMinute: row.request_limit_per_minute,
    credentialVersion: row.credential_version,
  };
}
async function mappings(admin: SuiteAdmin, integrationIds: string[]): Promise<MappingRow[]> {
  if (!integrationIds.length) return [];
  const { data, error } = await admin
    .from("suite_api_mappings")
    .select("*")
    .in("integration_id", integrationIds)
    .order("external_code");
  if (error) throw new Error("No se pudieron leer las correspondencias API.");
  return data;
}
async function integration(
  admin: SuiteAdmin,
  hotelId: string,
  integrationId: string,
): Promise<IntegrationRow | null> {
  const { data, error } = await admin
    .from("suite_api_integrations")
    .select("*")
    .eq("id", integrationId)
    .eq("hotel_id", hotelId)
    .maybeSingle();
  if (error) throw new Error("No se pudo leer la integración API.");
  return data;
}
async function view(admin: SuiteAdmin, row: IntegrationRow): Promise<SuiteApiIntegrationDto> {
  return dto(row, await mappings(admin, [row.id]));
}

export async function suiteApiOverview(
  admin: SuiteAdmin,
  hotelId: string,
): Promise<SuiteApiOverview> {
  const [integrations, events] = await Promise.all([
    admin
      .from("suite_api_integrations")
      .select("*")
      .eq("hotel_id", hotelId)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("suite_api_events")
      .select("*")
      .eq("hotel_id", hotelId)
      .order("received_at", { ascending: false })
      .limit(100),
  ]);
  if (integrations.error || events.error) throw new Error("No se pudo leer el centro API.");
  const maps = await mappings(
    admin,
    integrations.data.map((i) => i.id),
  );
  const eventDtos: SuiteApiEventDto[] = events.data.map((e) => ({
    id: e.id,
    integrationId: e.integration_id,
    eventId: e.event_id,
    eventType: e.event_type,
    direction: e.direction as SuiteApiEventDto["direction"],
    status: e.status,
    httpStatus: e.http_status,
    errorCode: e.error_code,
    reservationId: e.reservation_id,
    attempts: e.attempts,
    receivedAt: e.received_at,
    processedAt: e.processed_at,
  }));
  const active = integrations.data.filter((i) => i.status === "active").length;
  return {
    integrations: integrations.data.map((i) =>
      dto(
        i,
        maps.filter((m) => m.integration_id === i.id),
      ),
    ),
    events: eventDtos,
    summary: {
      active,
      revoked: integrations.data.length - active,
      errors: eventDtos.filter((e) => e.status === "rejected" || e.status === "pending").length,
      received: eventDtos.filter((e) => e.direction === "inbound").length,
      sent: eventDtos.filter((e) => e.direction === "outbound").length,
      lastActivity: eventDtos[0]?.receivedAt ?? null,
    },
  };
}

export async function createSuiteApi(
  admin: SuiteAdmin,
  hotel: AuthorizedHotel,
  input: CreateSuiteApiInput,
  userId: string,
  root: string,
): Promise<SuiteApiCredentials> {
  const credentials = await newSuiteCredentials(root);
  const id = crypto.randomUUID();
  const { error } = await admin.rpc("suite_create_api_integration", {
    _id: id,
    _hotel: hotel.id,
    _name: input.name,
    _permissions: input.permissions,
    _key_prefix: credentials.keyPrefix,
    _key_hash: credentials.keyHash,
    _api_key_ciphertext: credentials.encryptedApiKey,
    _secret: credentials.encryptedSecret,
    _created_by: userId,
    _mappings: json(input.roomMappings),
  });
  if (error) throw new Error("No se pudo crear la integración. Revisa las habitaciones mapeadas.");
  const row = await integration(admin, hotel.id, id);
  if (!row) throw new Error("La integración no quedó disponible después de crearla.");
  return {
    integration: await view(admin, row),
    apiKey: credentials.apiKey,
    signingSecret: credentials.signingSecret,
  };
}
export async function configureSuiteApi(
  admin: SuiteAdmin,
  hotel: AuthorizedHotel,
  input: ConfigureSuiteApiInput,
): Promise<SuiteApiIntegrationDto> {
  const { error } = await admin.rpc("suite_configure_api_integration", {
    _integration: input.integrationId,
    _hotel: hotel.id,
    _name: input.name,
    _permissions: input.permissions,
    _mappings: json(input.roomMappings),
  });
  if (error)
    throw new Error("No se pudo configurar la integración. Revisa las habitaciones mapeadas.");
  const row = await integration(admin, hotel.id, input.integrationId);
  if (!row) throw new Error("Integración no encontrada.");
  return view(admin, row);
}
export async function rotateSuiteApi(
  admin: SuiteAdmin,
  hotel: AuthorizedHotel,
  integrationId: string,
  root: string,
): Promise<SuiteApiCredentials> {
  const credentials = await newSuiteCredentials(root);
  const { error } = await admin.rpc("suite_rotate_api_integration", {
    _integration: integrationId,
    _hotel: hotel.id,
    _prefix: credentials.keyPrefix,
    _hash: credentials.keyHash,
    _api_key_ciphertext: credentials.encryptedApiKey,
    _secret: credentials.encryptedSecret,
  });
  if (error) throw new Error("No se pudo rotar la credencial.");
  const row = await integration(admin, hotel.id, integrationId);
  if (!row) throw new Error("Integración no encontrada.");
  return {
    integration: await view(admin, row),
    apiKey: credentials.apiKey,
    signingSecret: credentials.signingSecret,
  };
}
export async function revokeSuiteApi(
  admin: SuiteAdmin,
  hotel: AuthorizedHotel,
  integrationId: string,
): Promise<void> {
  const { error } = await admin.rpc("suite_revoke_api_integration", {
    _integration: integrationId,
    _hotel: hotel.id,
  });
  if (error) throw new Error("No se pudo revocar la credencial.");
}

interface AuthenticatedSuiteRequest {
  row: IntegrationRow;
  apiKey: string;
}
async function authenticateSuiteRequest(
  admin: SuiteAdmin,
  integrationId: string,
  raw: string,
  headers: Headers,
  root: string,
  now: Date,
): Promise<AuthenticatedSuiteRequest | { response: Response }> {
  if (new TextEncoder().encode(raw).byteLength > 262144)
    return { response: Response.json({ error: "payload_too_large" }, { status: 413 }) };
  if (!integrationIdPattern.safeParse(integrationId).success)
    return { response: Response.json({ error: "invalid_integration" }, { status: 404 }) };
  const apiKey = headers.get("Authorization")?.replace(/^Bearer\s+/, "") ?? "";
  if (!keyPattern.test(apiKey))
    return { response: Response.json({ error: "invalid_credentials" }, { status: 401 }) };
  const { data: row, error } = await admin
    .from("suite_api_integrations")
    .select("*")
    .eq("id", integrationId)
    .eq("key_prefix", apiKey.slice(0, 25))
    .maybeSingle();
  if (error) return { response: Response.json({ error: "temporary_failure" }, { status: 503 }) };
  if (!row || row.status !== "active" || !equalHex(row.key_hash, await sha256Hex(apiKey)))
    return { response: Response.json({ error: "invalid_credentials" }, { status: 401 }) };
  let secret: string;
  try {
    secret = await openSigningSecret(row.signing_secret_ciphertext, root);
  } catch {
    return { response: Response.json({ error: "credential_configuration" }, { status: 503 }) };
  }
  if (!(await verifySuiteSignature(raw, headers, secret, now)))
    return { response: Response.json({ error: "invalid_signature" }, { status: 401 }) };
  const { data: allowed, error: limitError } = await admin.rpc("suite_api_consume_rate_limit", {
    _integration: row.id,
    _limit: row.request_limit_per_minute,
  });
  if (limitError)
    return { response: Response.json({ error: "temporary_failure" }, { status: 503 }) };
  if (!allowed)
    return {
      response: Response.json(
        { error: "rate_limited" },
        { status: 429, headers: { "Retry-After": "60" } },
      ),
    };
  await admin
    .from("suite_api_integrations")
    .update({ last_used_at: now.toISOString() })
    .eq("id", row.id);
  return { row, apiKey };
}
function responseFor(outcome: Record<string, unknown>, status: number): Response {
  return Response.json(outcome, { status, headers: { "Cache-Control": "no-store" } });
}
async function finishEvent(
  admin: SuiteAdmin,
  integrationId: string,
  eventId: string,
  status: string,
  httpStatus: number,
  outcome: Record<string, unknown>,
  errorCode: string | null = null,
): Promise<void> {
  const reservationId =
    typeof outcome["reservationId"] === "string" ? outcome["reservationId"] : null;
  const { error } = await admin.rpc("suite_api_finish_event", {
    _integration: integrationId,
    _event_id: eventId,
    _status: status,
    _http_status: httpStatus,
    _error_code: errorCode,
    _reservation_id: reservationId,
    _response: json(outcome),
  });
  if (error) throw new Error("No se pudo cerrar el registro API.");
}

/** Public inbound command. Authentication, hotel scope, mapping, idempotency and PMS write happen here. */
export async function handleSuiteApiRequest(
  admin: SuiteAdmin,
  integrationId: string,
  raw: string,
  headers: Headers,
  root: string,
  now = new Date(),
): Promise<Response> {
  const auth = await authenticateSuiteRequest(admin, integrationId, raw, headers, root, now);
  if ("response" in auth) return auth.response;
  const { row } = auth;
  let parsed: ReturnType<typeof suiteApiRequestBody.safeParse>;
  try {
    parsed = suiteApiRequestBody.safeParse(JSON.parse(raw));
  } catch {
    return responseFor({ error: "invalid_json" }, 400);
  }
  if (!parsed.success) return responseFor({ error: "invalid_body" }, 400);
  const body = parsed.data;
  const idempotency = headers.get("Idempotency-Key");
  if (idempotency && idempotency !== body.event_id)
    return responseFor({ error: "idempotency_mismatch" }, 400);
  if (body.event_type !== "webhook.test" && !body.event_type.startsWith("booking."))
    return responseFor({ error: "unsupported_event" }, 400);
  if (body.event_type !== "webhook.test" && !row.permissions.includes("reservations:write"))
    return responseFor({ error: "permission_denied" }, 403);
  const digest = await sha256Hex(raw);
  const { data: claim, error: claimError } = await admin.rpc("suite_api_claim_event", {
    _integration: row.id,
    _event_id: body.event_id,
    _event_type: body.event_type,
    _payload_hash: digest,
  });
  if (claimError) return responseFor({ error: "temporary_failure" }, 503);
  const claimKind = (claim as { kind?: unknown } | null)?.kind;
  if (claimKind === "conflict") return responseFor({ error: "idempotency_conflict" }, 409);
  if (claimKind === "busy") return responseFor({ error: "event_in_progress" }, 409);
  if (claimKind === "replay") {
    const prior = claim as { response?: unknown; httpStatus?: unknown };
    return responseFor(
      typeof prior.response === "object" && prior.response !== null
        ? (prior.response as Record<string, unknown>)
        : { ok: true },
      typeof prior.httpStatus === "number" ? prior.httpStatus : 200,
    );
  }
  if (body.event_type === "webhook.test") {
    const result = {
      ok: true,
      integrationId: row.id,
      hotelId: row.hotel_id,
      mode: "credential_check",
    };
    await finishEvent(admin, row.id, body.event_id, "applied", 200, result);
    return responseFor(result, 200);
  }
  if (body.booking_revision === undefined) {
    const result = { error: "missing_revision" };
    await finishEvent(admin, row.id, body.event_id, "rejected", 400, result, "missing_revision");
    return responseFor(result, 400);
  }
  const maps = await mappings(admin, [row.id]);
  const binding: InboundBinding = {
    hotelId: row.hotel_id,
    organizationId: row.organization_id,
    propertyId: row.property_id,
    provider: "suite",
    integrationId: row.id,
    environment: "production",
    roomTypes: {},
    roomMappings: Object.fromEntries(maps.map((m) => [m.external_code, m.room_number])),
  };
  try {
    const outcome = await receiveRevision(
      supabaseInboundStore(admin, row.id),
      binding,
      body.booking_revision,
      now,
    );
    const status = outcome.status === "rejected" ? 422 : 200;
    const result = { ...outcome, integrationId: row.id, hotelId: row.hotel_id };
    const eventStatus =
      outcome.status === "rejected" && outcome.reason === "room_type_unmapped"
        ? "pending"
        : outcome.status;
    await finishEvent(
      admin,
      row.id,
      body.event_id,
      eventStatus,
      status,
      result,
      outcome.status === "rejected" ? outcome.reason : null,
    );
    return responseFor(result, status);
  } catch {
    // Leave a processing event recoverable by the durable claim after the timeout.
    return responseFor({ error: "temporary_failure" }, 503);
  }
}

/** Authenticated read-only API: no guest identity or private notes leave the PMS projection. */
export async function handleSuiteApiRead(
  admin: SuiteAdmin,
  integrationId: string,
  kind: "reservations" | "availability",
  headers: Headers,
  root: string,
  date?: string,
  now = new Date(),
): Promise<Response> {
  const auth = await authenticateSuiteRequest(admin, integrationId, "", headers, root, now);
  if ("response" in auth) return auth.response;
  const permission = kind === "reservations" ? "reservations:read" : "availability:read";
  if (!auth.row.permissions.includes(permission))
    return responseFor({ error: "permission_denied" }, 403);
  if (kind === "availability" && (!date || !suiteApiDateQuery.safeParse(date).success))
    return responseFor({ error: "invalid_date" }, 400);
  const store = supabaseInboundStore(admin);
  const snapshot = await store.load(auth.row.hotel_id, "__read__", "__guest__");
  const payloadHash = await sha256Hex(`${kind}:${date ?? ""}`);
  const recordRead = async () => {
    const { error } = await admin.from("suite_api_events").insert({
      integration_id: auth.row.id,
      hotel_id: auth.row.hotel_id,
      event_id: `read-${crypto.randomUUID()}`,
      event_type: `${kind}.read`,
      direction: "outbound",
      status: "applied",
      payload_hash: payloadHash,
      http_status: 200,
      processed_at: now.toISOString(),
    });
    if (error) throw new Error("No se pudo registrar la consulta API.");
  };
  if (kind === "reservations") {
    const rows = snapshot.reservations.slice(0, 500).map((r) => {
      const external = (r as ExternalReservation).external;
      return {
        ...reservationSnapshot(r),
        externalId: external?.bookingCode ?? null,
        provider: external?.provider ?? null,
      };
    });
    await recordRead();
    return responseFor({ hotelId: auth.row.hotel_id, reservations: rows }, 200);
  }
  const availability = distributionSnapshot(snapshot.reservations, snapshot.rooms as never, date!);
  await recordRead();
  return responseFor({ hotelId: auth.row.hotel_id, date, availability }, 200);
}

export async function testSuiteApiCredential(
  admin: SuiteAdmin,
  hotel: AuthorizedHotel,
  integrationId: string,
  root: string,
): Promise<SuiteApiTestResult> {
  const row = await integration(admin, hotel.id, integrationId);
  if (!row || row.status !== "active")
    return { ok: false, status: 404, message: "La integración no está activa." };
  let secret: string;
  try {
    secret = await openSigningSecret(row.signing_secret_ciphertext, root);
  } catch {
    return { ok: false, status: 503, message: "La credencial cifrada no está disponible." };
  }
  const body = JSON.stringify({
    event_id: `credential-${crypto.randomUUID()}`,
    event_type: "webhook.test",
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  // A synthetic key is never used: decrypt only in backend and exercise the public handler.
  let apiKey: string;
  try {
    apiKey = await openSigningSecret(row.api_key_ciphertext, root);
  } catch {
    return { ok: false, status: 503, message: "La clave cifrada no está disponible." };
  }
  const signature = await signSuiteBody(body, secret, timestamp);
  const headers = new Headers({
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-Suite-Timestamp": timestamp,
    "X-Suite-Signature-256": signature,
    "Idempotency-Key": JSON.parse(body).event_id,
  });
  const response = await handleSuiteApiRequest(admin, integrationId, body, headers, root);
  return {
    ok: response.ok,
    status: response.status,
    message: response.ok
      ? "Credencial y endpoint verificados sin crear una reserva."
      : "La credencial no superó la verificación.",
  };
}
