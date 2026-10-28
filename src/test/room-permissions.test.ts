import { describe, expect, it, vi, beforeEach } from "vitest";
import { canEditRoom } from "@/lib/suite/room-permissions";
import { saveRoomConfig } from "@/lib/suite/cloud";
import type { Room } from "@/lib/suite/data";

const mock = vi.hoisted(() => ({ role: "owner", owner: "u", rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "u" } } }) },
  from: (table: string) => { const chain = { select: () => chain, eq: () => chain, single: async () => ({ data: { org_owner: mock.owner } }), maybeSingle: async () => ({ data: table === "hotel_members" ? { role: mock.role } : null }) }; return chain; },
  rpc: mock.rpc,
} }));
const room: Room = { number: "101", floor: 1, type: "Doble", rate: 120, hk: "dirty", oos: false };
const edit = { type: "Twin", rate: 120, capacity: 2, beds: "2 individuales", extras: ["Escritorio"], window: "izquierda" as const };
describe("room configuration authorization", () => {
  beforeEach(() => { mock.owner = "u"; mock.role = "owner"; mock.rpc.mockReset(); mock.rpc.mockResolvedValue({ data: { ...edit, hotel_id: "h", number: "101", window_side: "izquierda", floor: 1 }, error: null }); });
  it("Owner can persist individual beds and equipment without changing operational state", async () => {
    const saved = await saveRoomConfig("h", room, edit);
    expect(saved.beds).toBe("2 individuales"); expect(saved.extras).toEqual(["Escritorio"]); expect(saved.window).toBe("izquierda"); expect(saved.hk).toBe("dirty"); expect(saved.number).toBe("101"); expect(mock.rpc).toHaveBeenCalledOnce();
  });
  it("Director can save configuration in their hotel", async () => { mock.owner = "other"; mock.role = "director"; await saveRoomConfig("h", room, edit); expect(mock.rpc).toHaveBeenCalledOnce(); });
  it("Reception cannot save technical configuration", async () => { mock.owner = "other"; mock.role = "reception"; await expect(saveRoomConfig("h", room, edit)).rejects.toThrow(/permiso/); expect(mock.rpc).not.toHaveBeenCalled(); });
  it("membership in another company does not authorize this hotel", async () => { mock.owner = "other"; mock.role = ""; await expect(saveRoomConfig("h", room, edit)).rejects.toThrow(/permiso/); expect(mock.rpc).not.toHaveBeenCalled(); });
  it("database refusal does not report a successful save", async () => { mock.rpc.mockResolvedValue({ data: null, error: { message: "denied" } }); await expect(saveRoomConfig("h", room, edit)).rejects.toThrow("denied"); });
  it.each(["reception", "housekeeping", "maintenance", "revenue"] as const)("%s has no editor access", (role) => expect(canEditRoom(role)).toBe(false));
  it.each(["owner", "director"] as const)("%s has editor access", (role) => expect(canEditRoom(role)).toBe(true));
});