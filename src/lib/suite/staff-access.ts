import type { HotelRole } from "./cloud";

/** Mirror of suite_role_modules() in the database — the database clamps and enforces it. */
export const MODULES = ["dashboard", "hotel", "reservas", "habitaciones", "control", "personal", "tareas", "huespedes", "mensajes", "integraciones", "configuracion"] as const;
export type ModuleKey = (typeof MODULES)[number];
export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: "Dashboard", hotel: "Hotel en vivo", reservas: "Reservas", habitaciones: "Habitaciones", control: "Control",
  personal: "Personal", tareas: "Tareas", huespedes: "Huéspedes", mensajes: "Mensajes", integraciones: "Integraciones", configuracion: "Configuración",
};
export const ROLE_MODULES: Record<HotelRole, ModuleKey[]> = {
  owner: [...MODULES], director: [...MODULES],
  reception: ["hotel", "reservas", "habitaciones", "huespedes", "mensajes", "tareas"],
  housekeeping: ["hotel", "habitaciones", "tareas"],
  maintenance: ["hotel", "habitaciones", "tareas"],
  revenue: ["dashboard", "reservas", "habitaciones", "control"],
};

/** Keeps only modules the role is allowed to have (same rule as the database) */
export const clampModules = (role: HotelRole, modules: string[]) => modules.filter((m): m is ModuleKey => (ROLE_MODULES[role] as string[]).includes(m));

export const moduleOfPath = (path: string): ModuleKey | null => {
  if (path === "/") return "dashboard";
  const m = path.slice(1) as ModuleKey;
  return (MODULES as readonly string[]).includes(m) ? m : null;
};

/** Narrows the role's menu with the person's own module list (null = everything their role allows) */
export function effectiveNav(roleNav: string[], role: HotelRole, modules: string[] | null | undefined): string[] {
  const allowed = new Set<string>(modules ? clampModules(role, modules) : ROLE_MODULES[role]);
  return roleNav.filter((p) => { const m = moduleOfPath(p); return m === null || allowed.has(m); });
}
