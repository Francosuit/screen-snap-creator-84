import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, type HotelRole } from "@/lib/suite/cloud";
import { rememberInvite } from "@/lib/suite/pending-invite";

export const Route = createFileRoute("/invitacion")({
  validateSearch: (s: Record<string, unknown>) => ({ token: typeof s["token"] === "string" ? (s["token"] as string) : "" }),
  head: () => ({
    meta: [
      { title: "Invitación al equipo — Suite Hotel OS" },
      { name: "description", content: "Acepta tu invitación personal para unirte al equipo de un hotel." },
      { property: "og:title", content: "Invitación al equipo — Suite Hotel OS" },
      { property: "og:description", content: "Únete al equipo de tu hotel con tu propia cuenta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Invitacion,
});

type Info = { status: string; hotel?: string; role?: HotelRole; position?: string };
const MSG: Record<string, string> = {
  invalid: "Este enlace no es válido.", revoked: "El propietario anuló esta invitación.",
  expired: "Esta invitación ha caducado. Pide un enlace nuevo.", used: "Esta invitación ya se usó.",
  wrong_email: "Esta invitación es para otro correo. Inicia sesión con el correo invitado.",
};

function Invitacion() {
  const { token } = Route.useSearch();
  const [info, setInfo] = useState<Info | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) { setInfo({ status: "signin" }); return; }
      if (!/^[0-9a-f-]{36}$/i.test(token)) { setInfo({ status: "invalid" }); return; }
      const { data, error } = await supabase.rpc("suite_invite_info", { _token: token });
      setInfo(error ? { status: "invalid" } : (data as Info));
    })();
  }, [token]);
  const signIn = () => { rememberInvite(token); window.location.assign("/login"); };
  const accept = async () => {
    setBusy(true); setErr("");
    const { error } = await supabase.rpc("suite_accept_invite", { _token: token });
    setBusy(false);
    if (error) setErr(error.message); else window.location.assign("/");
  };
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Invitación al equipo</h1>
        {!info && <p className="mt-3 text-sm text-muted-foreground">Comprobando…</p>}
        {info?.status === "signin" && <>
          <p className="mt-3 text-sm text-muted-foreground">Inicia sesión o crea tu cuenta con el correo al que llegó la invitación.</p>
          <Button className="mt-4" onClick={signIn}>Iniciar sesión</Button>
        </>}
        {info?.status === "ok" && <>
          <p className="mt-3 text-sm">Te unirás a <b>{info.hotel}</b> como <b>{ROLE_LABELS[info.role!]}</b>{info.position ? ` (${info.position})` : ""}.</p>
          <Button className="mt-4" disabled={busy} onClick={accept}>{busy ? "Aceptando…" : "Aceptar invitación"}</Button>
          {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
        </>}
        {info && MSG[info.status] && <p className="mt-3 text-sm text-muted-foreground">{MSG[info.status]}</p>}
      </div>
    </div>
  );
}
