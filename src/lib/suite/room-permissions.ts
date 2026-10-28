import type { RoleKey } from "./data";

/** UI/demo guard only; cloud writes must also pass database authorization. */
export function canEditRoom(role: RoleKey | undefined): boolean {
  return role === "owner" || role === "director";
}