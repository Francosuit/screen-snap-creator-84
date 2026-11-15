import { describe, it, expect } from "vitest";
import { gateAllows } from "@/lib/suite/demo-access";
describe("demo access gate", () => {
  it("signed-out without opt-in is sent to login", () => expect(gateAllows({ user: undefined, isDemo: true, demoOptIn: false })).toBe(false));
  it("signed-out with explicit opt-in sees the demo", () => expect(gateAllows({ user: undefined, isDemo: true, demoOptIn: true })).toBe(true));
  it("opt-in never grants access to a real session without a loaded account", () => expect(gateAllows({ user: undefined, isDemo: false, demoOptIn: true })).toBe(false));
});
