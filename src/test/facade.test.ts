import { describe, it, expect } from "vitest";
import { facadeOf, facadeVars } from "@/lib/suite/facade";

describe("hotel facade colors", () => {
  it("old hotels without colors keep the default look", () => {
    expect(facadeVars(undefined)).toBeUndefined();
    expect(facadeOf({ primary: "#c9bba4" })).toBeNull();
  });
  it("rejects anything that is not a hex color", () => {
    expect(facadeOf({ primary: "red;}", secondary: "#000000" })).toBeNull();
  });
  it("applies primary to facade and secondary to frames", () => {
    const v = facadeVars({ primary: "#b8735a", secondary: "#c9a84c" }) as Record<string, string>;
    expect(v["--fac-stone"]).toBe("#b8735a");
    expect(v["--fac-trim"]).toBe("#c9a84c");
  });
});
