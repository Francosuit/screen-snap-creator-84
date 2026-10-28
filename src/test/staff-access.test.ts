import { describe, expect, it } from "vitest";
import { clampModules, effectiveNav } from "@/lib/suite/staff-access";
import { NAV_ACCESS } from "@/lib/suite/store";

describe("staff module permissions", () => {
  it("housekeeping can never be given reservations or settings", () => {
    expect(clampModules("housekeeping", ["tareas", "reservas", "configuracion"])).toEqual(["tareas"]);
  });
  it("no custom list keeps the full menu of the role", () => {
    expect(effectiveNav(NAV_ACCESS.reception, "reception", null)).toEqual(NAV_ACCESS.reception);
  });
  it("a receptionist limited to reservations loses guests and messages but keeps their home", () => {
    const nav = effectiveNav(NAV_ACCESS.reception, "reception", ["reservas"]);
    expect(nav).toContain("/reservas"); expect(nav).toContain("/");
    expect(nav).not.toContain("/huespedes"); expect(nav).not.toContain("/mensajes");
  });
});
