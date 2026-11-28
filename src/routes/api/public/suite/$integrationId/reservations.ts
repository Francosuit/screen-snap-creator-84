import { createFileRoute } from "@tanstack/react-router";

/** Suite Hotel OS own API. The integration id selects no hotel by itself: credentials are checked server-side. */
export const Route = createFileRoute("/api/public/suite/$integrationId/reservations")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const raw = await request.text();
        const root = process.env["SUITE_API_CREDENTIAL_KEY"];
        if (!root) return Response.json({ error: "credential_configuration" }, { status: 503 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { handleSuiteApiRequest } = await import("@/lib/suite/api/suite-api.server");
        try {
          return await handleSuiteApiRequest(
            supabaseAdmin,
            params.integrationId,
            raw,
            request.headers,
            root,
          );
        } catch {
          return Response.json(
            { error: "temporary_failure" },
            { status: 503, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
      GET: async ({ request, params }) => {
        const root = process.env["SUITE_API_CREDENTIAL_KEY"];
        if (!root) return Response.json({ error: "credential_configuration" }, { status: 503 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { handleSuiteApiRead } = await import("@/lib/suite/api/suite-api.server");
        try {
          return await handleSuiteApiRead(
            supabaseAdmin,
            params.integrationId,
            "reservations",
            request.headers,
            root,
          );
        } catch {
          return Response.json(
            { error: "temporary_failure" },
            { status: 503, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
