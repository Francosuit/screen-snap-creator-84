import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/suite/$integrationId/availability")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const root = process.env["SUITE_API_CREDENTIAL_KEY"];
        if (!root) return Response.json({ error: "credential_configuration" }, { status: 503 });
        const date = new URL(request.url).searchParams.get("date") ?? undefined;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { handleSuiteApiRead } = await import("@/lib/suite/api/suite-api.server");
        try {
          return await handleSuiteApiRead(
            supabaseAdmin,
            params.integrationId,
            "availability",
            request.headers,
            root,
            date,
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
