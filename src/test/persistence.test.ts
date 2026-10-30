import { describe, expect, it } from "vitest";
import { isLatest, visibleHotels } from "@/lib/suite/store";
import { sameIdentity } from "@/lib/suite/isolation";
import type { Hotel } from "@/lib/suite/data";

const h = (id: string, owner?: string) => ({ id, owner }) as unknown as Hotel;

describe("cloud persistence rules", () => {
  it("does not show another account's hotels", () => {
    const list = [h("demo"), h("a1", "a@x.com"), h("b1", "b@x.com")];
    expect(visibleHotels(list, "b@x.com").map((x) => x.id)).toEqual(["b1"]);
  });
  it("shows no owned hotels when signed out", () => {
    expect(visibleHotels([h("a1", "a@x.com")], undefined)).toEqual([]);
  });
  it("only the latest save sets the status", () => {
    expect(isLatest(1, 2)).toBe(false);
    expect(isLatest(2, 2)).toBe(true);
  });
  it("starts a real account without hotels empty, not with demo hotels", () => {
    expect(visibleHotels([h("demo"), h("a1", "a@x.com")], "new@x.com")).toEqual([]);
  });
  it("hydrates only authorized employee hotels without the demo", () => {
    expect(visibleHotels([h("demo"), h("a1", "cloud:a"), h("b1", "cloud:b")], "staff@x.com", ["b1"]).map((x) => x.id)).toEqual(["b1"]);
  });
  it("rejects loading and saving results from a different session", () => {
    expect(sameIdentity("a", "b")).toBe(false);
    expect(sameIdentity("a", null)).toBe(false);
    expect(sameIdentity("a", "a")).toBe(true);
  });
});
