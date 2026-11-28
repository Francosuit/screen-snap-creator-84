import { beforeAll, describe, expect, it } from "vitest";
import { webcrypto } from "node:crypto";
import {
  newSuiteCredentials,
  openSigningSecret,
  sealSigningSecret,
  signSuiteBody,
  verifySuiteSignature,
} from "../lib/suite/api/suite-api-crypto.server";
import { planRevision } from "../lib/suite/api/inbound";
import type { InboundBinding, PlanContext } from "../lib/suite/api/inbound";
import { ymdToOffset } from "../lib/suite/clock";
import { suiteApiRequestBody } from "../lib/suite/api/suite-api-contracts";

beforeAll(() => {
  if (!globalThis.crypto?.subtle)
    Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
});
const root = "test-only-root-that-is-long-enough-for-encryption";
const binding: InboundBinding = {
  hotelId: "11111111-1111-4111-8111-111111111111",
  organizationId: "22222222-2222-4222-8222-222222222222",
  propertyId: "suite-prop",
  provider: "suite",
  integrationId: "33333333-3333-4333-8333-333333333333",
  environment: "production",
  roomTypes: {},
  roomMappings: { "EXT-101": "101" },
};
const context: PlanContext = {
  reservations: [],
  rooms: [
    { number: "101", type: "Doble", rate: 100, oos: false, capacity: 2 },
    { number: "102", type: "Doble", rate: 100, oos: false, capacity: 2 },
  ],
  guest: null,
  today: ymdToOffset("2026-11-28"),
  nowIso: "2026-11-28T10:00:00Z",
  time: "11:00",
};
function revision(code = "EXT-1") {
  return {
    id: 1,
    booking_code: code,
    property_id: "suite-prop",
    revision_type: "created",
    created_at: "2026-11-28T09:00:00Z",
    payload: {
      status: "CREATED",
      checkin_date: "2026-12-01",
      checkout_date: "2026-12-03",
      total_amount: 200,
      currency: "EUR",
      client: { name: "API Test" },
      booking_items: [{ ext_room_id: "EXT-101", num_adults: 2 }],
    },
  };
}

describe("Suite API credentials and signatures", () => {
  it("generates independent credentials and never stores plaintext in hashes/ciphertext", async () => {
    const c = await newSuiteCredentials(root);
    expect(c.apiKey).toMatch(/^sk_suite_[a-f0-9]{64}$/);
    expect(c.signingSecret).toMatch(/^whsec_suite_[a-f0-9]{64}$/);
    expect(c.keyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(c.keyHash).not.toContain(c.apiKey);
    expect(c.encryptedApiKey).not.toContain(c.apiKey);
    expect(c.encryptedSecret).not.toContain(c.signingSecret);
    expect(await openSigningSecret(c.encryptedApiKey, root)).toBe(c.apiKey);
    expect(await openSigningSecret(c.encryptedSecret, root)).toBe(c.signingSecret);
  });
  it("detects ciphertext tampering and wrong encryption roots", async () => {
    const sealed = await sealSigningSecret("secret", root);
    await expect(openSigningSecret(sealed.replace(/.$/, "A"), root)).rejects.toThrow();
    await expect(
      openSigningSecret(sealed, "another-root-that-is-long-enough-too"),
    ).rejects.toThrow();
  });
  it("accepts only a fresh valid HMAC over the exact raw body", async () => {
    const now = new Date("2026-11-28T10:00:00Z");
    const body = JSON.stringify({ event_id: "e1", amount: 200 });
    const timestamp = String(Math.floor(now.getTime() / 1000));
    const signature = await signSuiteBody(body, "signing-secret", timestamp);
    const headers = new Headers({
      "X-Suite-Timestamp": timestamp,
      "X-Suite-Signature-256": signature,
    });
    expect(await verifySuiteSignature(body, headers, "signing-secret", now)).toBe(true);
    expect(await verifySuiteSignature(`${body} `, headers, "signing-secret", now)).toBe(false);
    expect(await verifySuiteSignature(body, headers, "wrong", now)).toBe(false);
    expect(
      await verifySuiteSignature(body, headers, "signing-secret", new Date(now.getTime() + 301000)),
    ).toBe(false);
  });
});

describe("Suite API mapping and request contracts", () => {
  it("uses the exact mapped internal room and preserves one deterministic PMS identity", () => {
    const plan = planRevision(revision(), binding, context);
    expect(plan.kind).toBe("apply");
    if (plan.kind !== "apply") return;
    expect(plan.reservation.id).toBe("A-EXT-1");
    expect(plan.reservation.guestId).toBe("ga-EXT-1");
    expect(plan.reservation.room).toBe("101");
    expect(plan.reservation.external).toMatchObject({
      provider: "suite",
      integrationId: binding.integrationId,
      revisionId: 1,
    });
  });
  it("does not substitute another room when the mapped room is occupied", () => {
    const occupied = {
      id: "existing",
      guestId: "g",
      room: "101",
      inDay: ymdToOffset("2026-12-01"),
      outDay: ymdToOffset("2026-12-03"),
      eta: "",
      pax: 2,
      channel: "Recepción" as const,
      amount: 200,
      status: "confirmed" as const,
      stay: "none" as const,
      notes: "",
      createdDay: 0,
    };
    expect(
      planRevision(revision(), binding, { ...context, reservations: [occupied] }),
    ).toMatchObject({ kind: "rejected", reason: "no_room_available" });
  });
  it("does not let another integration modify the same external booking identity", () => {
    const first = planRevision(revision(), binding, context);
    expect(first.kind).toBe("apply");
    if (first.kind !== "apply") return;
    const other = { ...binding, integrationId: "44444444-4444-4444-8444-444444444444" };
    expect(
      planRevision(revision(), other, { ...context, reservations: [first.reservation] }),
    ).toMatchObject({ kind: "rejected", reason: "property_mismatch" });
  });
  it("rejects unmapped rooms and cross-property payloads", () => {
    expect(
      planRevision({ ...revision(), property_id: "other-hotel" }, binding, context),
    ).toMatchObject({ kind: "rejected", reason: "property_mismatch" });
    const unknown = revision();
    (unknown.payload.booking_items[0] as { ext_room_id: string }).ext_room_id = "UNKNOWN";
    expect(planRevision(unknown, binding, context)).toMatchObject({
      kind: "rejected",
      reason: "room_type_unmapped",
    });
  });
  it("requires an event id and rejects unexpected request fields", () => {
    expect(suiteApiRequestBody.safeParse({ event_type: "booking.created" }).success).toBe(false);
    expect(
      suiteApiRequestBody.safeParse({
        event_id: "e1",
        event_type: "booking.created",
        hotelId: "injected",
      }).success,
    ).toBe(false);
  });
});
