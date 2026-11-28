import { z } from "zod";
import { isCalendarDate } from "../clock";

export const suiteApiPermissions = [
  "reservations:read",
  "reservations:write",
  "availability:read",
] as const;
export type SuiteApiPermission = (typeof suiteApiPermissions)[number];
export const suiteApiPermissionSchema = z.enum(suiteApiPermissions);

const externalCode = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/, "Código externo no válido");
const internalRoom = z.string().trim().min(1).max(40);
export const suiteApiMapping = z.object({ externalCode, roomNumber: internalRoom }).strict();
export type SuiteApiMapping = z.infer<typeof suiteApiMapping>;

export const createSuiteApiInput = z
  .object({
    hotelId: z.string().uuid(),
    name: z.string().trim().min(2).max(100),
    permissions: z.array(suiteApiPermissionSchema).min(1).max(suiteApiPermissions.length),
    roomMappings: z.array(suiteApiMapping).max(100),
  })
  .strict()
  .refine((v) => new Set(v.permissions).size === v.permissions.length, "Permiso repetido")
  .refine(
    (v) => new Set(v.roomMappings.map((m) => m.externalCode)).size === v.roomMappings.length,
    "Código externo repetido",
  );
export type CreateSuiteApiInput = z.infer<typeof createSuiteApiInput>;

export const configureSuiteApiInput = z
  .object({
    hotelId: z.string().uuid(),
    integrationId: z.string().uuid(),
    name: z.string().trim().min(2).max(100),
    permissions: z.array(suiteApiPermissionSchema).min(1).max(suiteApiPermissions.length),
    roomMappings: z.array(suiteApiMapping).max(100),
  })
  .strict()
  .refine((v) => new Set(v.permissions).size === v.permissions.length, "Permiso repetido")
  .refine(
    (v) => new Set(v.roomMappings.map((m) => m.externalCode)).size === v.roomMappings.length,
    "Código externo repetido",
  );
export type ConfigureSuiteApiInput = z.infer<typeof configureSuiteApiInput>;

export const suiteApiIntegrationInput = z
  .object({ hotelId: z.string().uuid(), integrationId: z.string().uuid() })
  .strict();
export type SuiteApiIntegrationInput = z.infer<typeof suiteApiIntegrationInput>;

export const suiteApiRequestBody = z
  .object({
    event_id: z.string().trim().min(1).max(160),
    event_type: z.string().trim().min(1).max(80).default("booking.created"),
    booking_revision: z.unknown().optional(),
  })
  .strict();
export type SuiteApiRequestBody = z.infer<typeof suiteApiRequestBody>;

export const suiteApiDateQuery = z.string().refine(isCalendarDate, "Fecha inválida");

export interface SuiteApiIntegrationDto {
  id: string;
  hotelId: string;
  organizationId: string;
  name: string;
  status: "active" | "revoked";
  propertyId: string;
  keyPrefix: string;
  permissions: SuiteApiPermission[];
  roomMappings: SuiteApiMapping[];
  endpoint: string;
  createdAt: string;
  rotatedAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  requestLimitPerMinute: number;
  credentialVersion: number;
}
export interface SuiteApiEventDto {
  id: string;
  integrationId: string | null;
  eventId: string;
  eventType: string;
  direction: "inbound" | "outbound";
  status: string;
  httpStatus: number | null;
  errorCode: string | null;
  reservationId: string | null;
  attempts: number;
  receivedAt: string;
  processedAt: string | null;
}
export interface SuiteApiSummary {
  active: number;
  revoked: number;
  errors: number;
  received: number;
  sent: number;
  lastActivity: string | null;
}
export interface SuiteApiOverview {
  integrations: SuiteApiIntegrationDto[];
  events: SuiteApiEventDto[];
  summary: SuiteApiSummary;
}
export interface SuiteApiCredentials {
  integration: SuiteApiIntegrationDto;
  apiKey: string;
  signingSecret: string;
}
export interface SuiteApiTestResult {
  ok: boolean;
  status: number;
  message: string;
}
