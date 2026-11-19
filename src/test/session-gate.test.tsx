import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SessionGate } from "@/components/suite/SessionGate";

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), path: "/login" }));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: mocks.path } }),
}));
vi.mock("@/lib/suite/store", () => ({
  useSuite: () => ({ ready: true, user: null, isDemo: true }),
}));
vi.mock("@/components/suite/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("SessionGate — entrada demo desde login", () => {
  beforeEach(() => {
    sessionStorage.clear();
    mocks.navigate.mockReset();
    mocks.path = "/login";
  });
  afterEach(cleanup);

  it("no redirige al login cuando el opt-in se escribe justo antes de navegar", async () => {
    const view = render(<SessionGate><div>Contenido demo</div></SessionGate>);
    sessionStorage.setItem("suite-demo-access", "1");
    mocks.path = "/";
    view.rerender(<SessionGate><div>Contenido demo</div></SessionGate>);

    await screen.findByText("Contenido demo");
    await waitFor(() => expect(mocks.navigate).not.toHaveBeenCalled());
  });
});
