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
    if (ready && demoOptIn !== null && !allowed && !bare) navigate({ to: "/login" });
  }, [ready, allowed, demoOptIn, bare, path, navigate]);
  if (bare) return <>{children}</>;
  if (!ready || !allowed) return <div className="min-h-screen bg-background" />;
  return <AppShell>{children}</AppShell>;
}
