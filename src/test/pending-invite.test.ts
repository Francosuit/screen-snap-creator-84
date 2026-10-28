import { describe, it, expect, beforeEach } from "vitest";
import { invitePath, rememberInvite, takeInvite } from "@/lib/suite/pending-invite";

const T = "0b0e1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c2d";
const mem: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(mem)) delete mem[k];
  (globalThis as any).sessionStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; } };
  (globalThis as any).window = globalThis;
});

describe("pending invite redirect", () => {
  it("returns to the same invite after sign-in, once", () => {
    rememberInvite(T);
    expect(takeInvite()).toBe(`/invitacion?token=${T}`);
    expect(takeInvite()).toBeNull();
  });
  it("rejects external or malformed destinations", () => {
    expect(invitePath("https://evil.com/invitacion?token=" + T)).toBeNull();
    expect(invitePath("//evil.com")).toBeNull();
    expect(invitePath("/invitacion?token=abc")).toBeNull();
    expect(invitePath(`/invitacion?token=${T}&x=1`)).toBeNull();
  });
});
