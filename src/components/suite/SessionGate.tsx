import { useEffect, useState, type ReactNode } from "react";
import { gateAllows, hasDemoAccess } from "@/lib/suite/demo-access";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useSuite } from "@/lib/suite/store";
import { AppShell } from "@/components/suite/AppShell";

const BARE = ["/login", "/crear-hotel", "/invitacion"];

/** Sends visitors without a session to /login; login and builder render full-screen. */
export function SessionGate({ children }: { children: ReactNode }) {
  const { ready, user, isDemo } = useSuite();
  const [demoOptIn, setDemoOptIn] = useState<boolean | null>(null);
  const path = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const bare = BARE.includes(path);
  useEffect(() => { setDemoOptIn(hasDemoAccess()); }, [path]);
  const allowed = gateAllows({ user, isDemo, demoOptIn: !!demoOptIn });
  useEffect(() => {
    // A demo opt-in can be written immediately before navigating from /login.
    // Re-read it here so this effect cannot redirect with the previous render's stale value.
    const currentlyAllowed = gateAllows({ user, isDemo, demoOptIn: hasDemoAccess() });
    if (ready && demoOptIn !== null && !currentlyAllowed && !bare) navigate({ to: "/login" });
  }, [ready, user, isDemo, demoOptIn, bare, path, navigate]);
  if (bare) return <>{children}</>;
  if (!ready || !allowed) return <div className="min-h-screen bg-background" />;
  return <AppShell>{children}</AppShell>;
}
