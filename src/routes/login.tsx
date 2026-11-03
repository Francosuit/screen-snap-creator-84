import { peekInvite } from "@/lib/suite/pending-invite";
import { authenticatedDestination } from "@/lib/suite/auth-flow";
import { ConstructionScene } from "@/components/suite/login/ConstructionScene";
import logo from "@/assets/suite-solutions-logo.png.asset.json";
import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogIn, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSuite } from "@/lib/suite/store";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar en Suite — Construye tu hotel digital" },
      { name: "description", content: "Inicia sesión o crea tu cuenta para construir digitalmente tu hotel con Suite Hotel OS." },
      { property: "og:title", content: "Entrar en Suite — Construye tu hotel digital" },
      { property: "og:description", content: "Registra tu empresa y construye tu hotel conectado en minutos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

type Mode = "home" | "login" | "signup" | "confirmation";

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function LoginPage() {
  const { actions, ready, authReady, user, hotels, cloud } = useSuite();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("home");
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const navigating = useRef(false);
  const [f, setF] = useState({ email: "", password: "", name: "", surname: "", position: "Director/a", phone: "", company: "", tradeName: "", country: "España", city: "", type: "Hotel independiente", employees: "" });
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  // One continuation handles sign-in, immediate signup and restored sessions.
  useEffect(() => {
    const next = authenticatedDestination(!!user && authReady, ready, peekInvite(), hotels.length > 0);
    if (!next || busy || navigating.current) return;
    navigating.current = true;
    if (next.startsWith("/invitacion?token=")) {
      navigate({ to: "/invitacion", search: { token: next.split("token=")[1] ?? "" }, replace: true });
    } else {
      navigate({ to: next === "/crear-hotel" ? "/crear-hotel" : "/mundo", replace: true });
    }
  }, [user, authReady, ready, hotels.length, busy, navigate]);

  const doLogin = async () => {
    if (busy) return;
    setBusy(true);
    try { await actions.signIn(f.email.trim(), f.password); }
    finally { setBusy(false); }
  };
  const doSignup = async () => {
    if (busy) return;
    setBusy(true);
    const invite = peekInvite();
    try {
    const result = await actions.signUp({
      email: f.email.trim(), password: f.password, name: f.name, surname: f.surname, position: f.position, role: "Owner / Admin",
      org: { name: f.company, owner: `${f.name} ${f.surname}`.trim(), email: f.email.trim(), tradeName: f.tradeName, country: f.country, city: f.city, phone: f.phone, type: f.type, employees: f.employees },
    }, invite ?? undefined);
    if (result === "confirmation") { setMode("confirmation"); set("password") (""); }
    } finally { setBusy(false); }
  };
  const step0 = f.email.includes("@") && f.password.length >= 4 && f.name.trim();
  const step1 = f.company.trim() && f.city.trim();

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="flex flex-col p-6 sm:p-10">
        <div className="flex items-center gap-3">
          <img src={logo.url} alt="Suite Solutions" className="h-11 w-11 rounded-full shadow-md" />
          <div className="leading-tight"><div className="text-sm font-semibold tracking-[0.2em]">SUITE SOLUTIONS</div><div className="text-xs text-muted-foreground">Suite Hotel OS</div></div>
        </div>
        <div className="relative -mx-6 mt-4 overflow-hidden rounded-2xl lg:hidden" style={{ background: "linear-gradient(180deg, var(--login-night), var(--login-deep))" }}>
          <ConstructionScene className="mx-auto block h-44 w-full" />
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
        <div className="w-full max-w-md space-y-6">
          {!ready && <p role="status" className="text-sm text-muted-foreground">Cargando tu cuenta…</p>}
          {cloud === "error" && !authReady && <div role="alert" className="space-y-2 text-sm text-destructive">
            <p>No se pudo validar la sesión o cargar tu cuenta. No continuaremos hasta comprobarla.</p>
            <Button variant="outline" onClick={() => window.location.reload()}>Reintentar</Button>
          </div>}
          {mode === "confirmation" && <div className="space-y-4" role="status">
            <h2 className="text-2xl font-semibold">Confirma tu correo</h2>
            <p className="text-muted-foreground">Revisa el mensaje enviado a {f.email} y abre el enlace de confirmación. Después, inicia sesión.</p>
            {peekInvite() && <p className="text-sm text-muted-foreground">Tu invitación sigue pendiente. Podrás revisarla y aceptarla al iniciar sesión.</p>}
            <Button className="w-full" onClick={() => setMode("login")}>Iniciar sesión</Button>
          </div>}
          {mode === "home" && (
            <>
              <div><h2 className="text-3xl font-semibold">Empecemos</h2><p className="mt-1 text-muted-foreground">Vamos a construir digitalmente tu hotel.</p></div>
              <div className="grid gap-3">
                <Button size="lg" onClick={() => { setMode("signup"); setStep(0); }}><Sparkles className="mr-2 h-4 w-4" />Crear mi hotel</Button>
                <Button size="lg" variant="outline" onClick={() => { setMode("signup"); setStep(0); }}>Crear mi cuenta</Button>
                <Button size="lg" variant="ghost" onClick={() => setMode("login")}><LogIn className="mr-2 h-4 w-4" />Iniciar sesión</Button>
              </div>
            </>
          )}

          {mode === "login" && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); doLogin(); }}>
              <h2 className="text-2xl font-semibold">Iniciar sesión</h2>
              <Field label="Email" type="email" value={f.email} onChange={set("email")} />
              <Field label="Contraseña" type="password" value={f.password} onChange={set("password")} />
              <Button type="submit" className="w-full" disabled={busy || !ready}>{busy ? "Comprobando…" : "Entrar"}</Button>
              <Button type="button" variant="link" className="w-full" onClick={() => setMode("signup")}>¿No tienes cuenta? Créala</Button>
            </form>
          )}

          {mode === "signup" && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Paso {step + 1} de 2</p>
                <h2 className="text-2xl font-semibold">{step === 0 ? "Tu perfil" : "Tu empresa"}</h2>
                {step === 0 && <p className="text-sm text-muted-foreground">Serás el Owner / Admin de la organización.</p>}
              </div>
              {step === 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nombre" value={f.name} onChange={set("name")} />
                  <Field label="Apellidos" value={f.surname} onChange={set("surname")} />
                  <Field label="Cargo" value={f.position} onChange={set("position")} />
                  <Field label="Teléfono" value={f.phone} onChange={set("phone")} />
                  <div className="col-span-2"><Field label="Email" type="email" value={f.email} onChange={set("email")} /></div>
                  <div className="col-span-2"><Field label="Contraseña (mín. 4)" type="password" value={f.password} onChange={set("password")} /></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Field label="Nombre de la empresa" value={f.company} onChange={set("company")} /></div>
                  <Field label="Nombre comercial" value={f.tradeName} onChange={set("tradeName")} />
                  <Field label="Nº empleados" value={f.employees} onChange={set("employees")} />
                  <Field label="País" value={f.country} onChange={set("country")} />
                  <Field label="Ciudad" value={f.city} onChange={set("city")} />
                  <div className="col-span-2 space-y-1.5">
                    <Label>Tipo de empresa</Label>
                    <div className="flex flex-wrap gap-2">
                      {["Hotel independiente", "Grupo hotelero", "Cadena"].map((t) => (
                        <Button key={t} type="button" size="sm" variant={f.type === t ? "default" : "outline"} onClick={() => set("type")(t)}>{t}</Button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" disabled={busy} onClick={() => (step === 0 ? setMode("home") : setStep(0))}>Atrás</Button>
                {step === 0
                  ? <Button className="flex-1" disabled={!step0} onClick={() => setStep(1)}>Continuar</Button>
                  : <Button className="flex-1" disabled={!step1 || busy || !ready} onClick={doSignup}>{busy ? "Creando cuenta…" : "Crear cuenta y construir mi hotel"}</Button>}
              </div>
            </div>
          )}
        </div>
        </div>
        <p className="text-center text-xs text-muted-foreground lg:text-left">Un solo sistema. Todo conectado.</p>
      </div>

      <div className="relative hidden overflow-hidden lg:block" style={{ background: "radial-gradient(120% 90% at 60% 30%, var(--login-night), var(--login-deep))", color: "var(--login-ivory)" }}>
        <div className="absolute left-12 right-12 top-12 z-10">
          <p className="text-xs uppercase tracking-[0.3em]" style={{ color: "var(--login-gold)" }}>Bienvenido a Suite</p>
          <h1 className="mt-3 max-w-lg text-4xl font-semibold leading-tight">Construye y gestiona tu propio mundo hotelero</h1>
          <p className="mt-3 max-w-md text-sm opacity-75">Tú nos cuentas cómo es tu hotel; Suite crea sus plantas, habitaciones, zonas y su gemelo digital en vivo.</p>
        </div>
        <ConstructionScene className="absolute inset-x-0 bottom-0 h-[78%] w-full" />
        <p className="absolute bottom-6 right-8 text-[11px] opacity-50">Ilustración</p>
      </div>
    </div>
  );
}
