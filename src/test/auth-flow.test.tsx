import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SuiteProvider, useSuite } from "@/lib/suite/store";
import { authenticatedDestination, authTimeout, signupResult } from "@/lib/suite/auth-flow";
import { peekInvite, rememberInvite } from "@/lib/suite/pending-invite";
import type { Account } from "@/lib/suite/data";

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; email: string } },
  listener: (_event: string, _session: unknown) => {},
  signup: vi.fn(), login: vi.fn(), getUser: vi.fn(), loadConfig: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: {
    onAuthStateChange: (cb: typeof mocks.listener) => { mocks.listener = cb; return { data: { subscription: { unsubscribe: vi.fn() } } }; },
    getSession: async () => ({ data: { session: mocks.session } }),
    getUser: mocks.getUser, signUp: mocks.signup, signInWithPassword: mocks.login,
  },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
} }));
vi.mock("@/lib/suite/cloud", () => ({
  loadConfig: mocks.loadConfig, myMemberships: async () => [], overlayHotel: (hotel: unknown, rooms: unknown) => ({ hotel, rooms }), saveRoomConfig: vi.fn(),
}));

const session = { user: { id: "verified-user", email: "owner@example.test" } };
const account = { email: session.user.email, password: "test-only-password", name: "Owner", surname: "Test", org: { name: "Company", email: session.user.email } } as Account;
const invite = "0b0e1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c2d";

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); mocks.session = null;
  mocks.getUser.mockResolvedValue({ data: { user: session.user }, error: null });
  mocks.loadConfig.mockResolvedValue({ hotels: [], rooms: [], floors: [] });
});
afterEach(cleanup);

describe("P0 verified authentication", () => {
  it("keeps confirmation-only registration signed out and preserves its invitation", async () => {
    mocks.signup.mockResolvedValue({ data: { user: session.user, session: null }, error: null });
    const { result } = renderHook(useSuite, { wrapper: SuiteProvider });
    await waitFor(() => expect(result.current.ready).toBe(true));
    rememberInvite(invite);
    let outcome: unknown;
    await act(async () => { outcome = await result.current.actions.signUp(account, peekInvite() ?? undefined); });
    expect(outcome).toBe("confirmation");
    expect(result.current.user).toBeUndefined();
    expect(result.current.authReady).toBe(false);
    expect(peekInvite()).toBe(`/invitacion?token=${invite}`);
    expect(authenticatedDestination(false, true, peekInvite(), false)).toBeNull();
    expect(result.current.actions.createHotel({ name: "Blocked", address: "", city: "", category: "", floors: [], rooms: [] })).toBeUndefined();
  });

  it("waits for verified profile and hotel hydration after immediate signup", async () => {
    let finish: ((value: { hotels: []; rooms: []; floors: [] }) => void) | undefined;
    mocks.loadConfig.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    mocks.signup.mockImplementation(async () => {
      mocks.session = session; mocks.listener("SIGNED_IN", session);
      return { data: { user: session.user, session }, error: null };
    });
    const { result } = renderHook(useSuite, { wrapper: SuiteProvider });
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { expect(await result.current.actions.signUp(account)).toBe("session"); });
    expect(result.current.authReady).toBe(false);
    expect(authenticatedDestination(false, result.current.ready, null, false)).toBeNull();
    await act(async () => { finish?.({ hotels: [], rooms: [], floors: [] }); });
    await waitFor(() => expect(result.current.authReady).toBe(true));
    expect(authenticatedDestination(true, result.current.ready, null, false)).toBe("/crear-hotel");
  });

  it("continues existing and newly confirmed users to a pending invitation after sign-in", async () => {
    mocks.login.mockImplementation(async () => {
      mocks.session = session; mocks.listener("SIGNED_IN", session); return { error: null };
    });
    rememberInvite(invite);
    const { result } = renderHook(useSuite, { wrapper: SuiteProvider });
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { expect(await result.current.actions.signIn(account.email, account.password)).toBe(true); });
    await waitFor(() => expect(result.current.authReady).toBe(true));
    expect(mocks.getUser).toHaveBeenCalled();
    expect(authenticatedDestination(true, result.current.ready, peekInvite(), false)).toBe(`/invitacion?token=${invite}`);
    // Repeated SIGNED_IN must not restart loading or leave the account stuck.
    act(() => mocks.listener("SIGNED_IN", session));
    expect(result.current.ready).toBe(true);
  });

  it("restores and revalidates the session after remount without using cached authentication", async () => {
    mocks.session = session;
    const first = renderHook(useSuite, { wrapper: SuiteProvider });
    await waitFor(() => expect(first.result.current.authReady).toBe(true));
    first.unmount();
    const second = renderHook(useSuite, { wrapper: SuiteProvider });
    await waitFor(() => expect(second.result.current.authReady).toBe(true));
    expect(mocks.getUser).toHaveBeenCalledTimes(2);
    expect(second.result.current.hotels).toEqual([]);
  });

  it("never continues if session verification fails", async () => {
    mocks.session = session;
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("Invalid session") });
    const { result } = renderHook(useSuite, { wrapper: SuiteProvider });
    await waitFor(() => expect(result.current.cloud).toBe("error"));
    expect(result.current.authReady).toBe(false);
  });

  it("bounds requests instead of waiting forever", async () => {
    await expect(authTimeout(new Promise(() => {}), 5)).rejects.toThrow("Vuelve a intentarlo");
  });

  it("requires a returned user and preserves existing-user destination", () => {
    expect(signupResult({ user: null, session: null })).toBe("error");
    expect(authenticatedDestination(true, true, null, true)).toBe("/mundo");
  });
});