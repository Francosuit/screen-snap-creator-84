import { createFileRoute } from '@tanstack/react-router';

/** Quendoo Connect webhook receiver. Signature (X-Qc-Signature-256) is verified over the raw body before anything else. */
export const Route = createFileRoute('/api/public/quendoo/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { handleQuendooWebhook, webhookDeps } = await import('@/lib/suite/api/inbound.server');
        try {
          const result = await handleQuendooWebhook(raw, request.headers, await webhookDeps(process.env, supabaseAdmin));
          return Response.json(result.body, { status: result.status, headers: { 'Cache-Control': 'no-store' } });
        } catch {
          // Non-2xx makes the provider retry; never echo internals.
          return Response.json({ error: 'temporary_failure' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
        }
      },
    },
  },
});
