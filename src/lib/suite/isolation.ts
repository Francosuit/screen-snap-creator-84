import type { Hotel } from "./data";

/** Cloud RLS grants membership visibility; browser ownership only preserves pending own creations. */
export function visibleHotels(hotels: Hotel[], email: string | undefined, authorized: string[] = []): Hotel[] {
  if (!email) return hotels.filter((h) => !h.owner);
  const keys = new Set(authorized);
  return hotels.filter((h) => Boolean(h.owner) && (h.owner === email || keys.has(h.id)));
}

export function sameIdentity(started: string | null, current: string | null): boolean {
  return started !== null && started === current;
}