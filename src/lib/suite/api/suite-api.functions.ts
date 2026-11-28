import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { connectionHotelInput } from "./connection-contracts";
import {
  configureSuiteApiInput,
  createSuiteApiInput,
  suiteApiIntegrationInput,
} from "./suite-api-contracts";

async function authorized(
  context: { supabase: SupabaseClient<Database>; userId: string },
  hotelId: string,
) {
  const { authorizeConnectionHotel, hotelAccessReader } = await import("./connection.server");
  return authorizeConnectionHotel(hotelAccessReader(context.supabase), hotelId, context.userId);
}

export const getSuiteApiOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(connectionHotelInput)
  .handler(async ({ data, context }) => {
    setResponseHeader("Cache-Control", "no-store");
    const hotel = await authorized(context, data.hotelId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { suiteApiOverview } = await import("./suite-api.server");
    return suiteApiOverview(supabaseAdmin, hotel.id);
  });

export const createSuiteApiIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(createSuiteApiInput)
  .handler(async ({ data, context }) => {
    setResponseHeader("Cache-Control", "no-store");
    const hotel = await authorized(context, data.hotelId);
    const root = process.env["SUITE_API_CREDENTIAL_KEY"];
    if (!root) throw new Error("La configuración segura de credenciales no está disponible.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createSuiteApi } = await import("./suite-api.server");
    return createSuiteApi(supabaseAdmin, hotel, data, context.userId, root);
  });

export const configureSuiteApiIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(configureSuiteApiInput)
  .handler(async ({ data, context }) => {
    setResponseHeader("Cache-Control", "no-store");
    const hotel = await authorized(context, data.hotelId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { configureSuiteApi } = await import("./suite-api.server");
    return configureSuiteApi(supabaseAdmin, hotel, data);
  });

export const rotateSuiteApiIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(suiteApiIntegrationInput)
  .handler(async ({ data, context }) => {
    setResponseHeader("Cache-Control", "no-store");
    const hotel = await authorized(context, data.hotelId);
    const root = process.env["SUITE_API_CREDENTIAL_KEY"];
    if (!root) throw new Error("La configuración segura de credenciales no está disponible.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rotateSuiteApi } = await import("./suite-api.server");
    return rotateSuiteApi(supabaseAdmin, hotel, data.integrationId, root);
  });

export const revokeSuiteApiIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(suiteApiIntegrationInput)
  .handler(async ({ data, context }) => {
    setResponseHeader("Cache-Control", "no-store");
    const hotel = await authorized(context, data.hotelId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { revokeSuiteApi } = await import("./suite-api.server");
    await revokeSuiteApi(supabaseAdmin, hotel, data.integrationId);
    return { ok: true };
  });

export const testSuiteApiIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(suiteApiIntegrationInput)
  .handler(async ({ data, context }) => {
    setResponseHeader("Cache-Control", "no-store");
    const hotel = await authorized(context, data.hotelId);
    const root = process.env["SUITE_API_CREDENTIAL_KEY"];
    if (!root) throw new Error("La configuración segura de credenciales no está disponible.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { testSuiteApiCredential } = await import("./suite-api.server");
    return testSuiteApiCredential(supabaseAdmin, hotel, data.integrationId, root);
  });
