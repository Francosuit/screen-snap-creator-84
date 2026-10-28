import type { CSSProperties } from "react";

/** Building identity: facade (primary) and frames/details (secondary). Never used for room status. */
export interface Facade { primary: string; secondary: string }

export const FACADE_PRIMARY = [
  { label: "Piedra", v: "#c9bba4" }, { label: "Arena", v: "#d8c39a" }, { label: "Terracota", v: "#b8735a" },
  { label: "Blanco", v: "#e9e6df" }, { label: "Grafito", v: "#5b5f66" }, { label: "Azul noche", v: "#3e4e6b" },
] as const;
export const FACADE_SECONDARY = [
  { label: "Antracita", v: "#2f2c29" }, { label: "Bronce", v: "#8a6a3b" }, { label: "Oro", v: "#c9a84c" }, { label: "Blanco", v: "#f4f1ea" },
] as const;

const HEX = /^#[0-9a-f]{6}$/i;
/** Valid saved facade or null → old hotels keep the default look */
export function facadeOf(f: Partial<Facade> | undefined | null): Facade | null {
  return f && HEX.test(f.primary ?? "") && HEX.test(f.secondary ?? "") ? { primary: f.primary!, secondary: f.secondary! } : null;
}

/** CSS variable overrides consumed by the existing building drawings */
export function facadeVars(f: Partial<Facade> | undefined | null): CSSProperties | undefined {
  const v = facadeOf(f);
  if (!v) return undefined;
  const p = v.primary;
  return {
    "--fac-stone": p,
    "--fac-stone-side": `color-mix(in oklab, ${p} 78%, black)`,
    "--fac-stone-top": `color-mix(in oklab, ${p} 75%, white)`,
    "--fac-trim": v.secondary,
    "--twin-wall": p,
    "--twin-wall-dark": `color-mix(in oklab, ${p} 70%, black)`,
  } as CSSProperties;
}
