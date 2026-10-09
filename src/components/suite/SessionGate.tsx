import { useEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useSuite } from "@/lib/suite/store";
import { AppShell } from "@/components/suite/AppShell";

const BARE = ["/login", "/crear-hotel"];

/** Sends visitors without a session to /login; login and builder render full-screen. */
export function SessionGate({ children }: { children: ReactNode }) {
  const { ready, user } = useSuite();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const bare = BARE.includes(path);
  useEffect(() => {
    if (ready && !user && path !== "/login") navigate({ to: "/login" });
  }, [ready, user, path, navigate]);
  if (bare) return <>{children}</>;
  if (!ready || !user) return <div className="min-h-screen bg-background" />;
  return <AppShell>{children}</AppShell>;
}
