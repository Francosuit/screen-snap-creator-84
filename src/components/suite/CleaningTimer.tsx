import { useEffect, useState } from "react";

/** Elapsed time derived from persisted timestamps; local ticks only repaint. */
export function elapsed(startIso: string, endIso?: string, now = Date.now()) {
  const start = Date.parse(startIso), end = endIso ? Date.parse(endIso) : now;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const sec = Math.max(0, Math.floor((end - start) / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(sec / 3600))}:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)}`;
}
export function hotelTime(iso: string, timeZone: string) {
  try { return new Date(iso).toLocaleTimeString("es-ES", { timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit" }); } catch { return ""; }
}
export function CleaningTimer({ startIso, endIso }: { startIso: string; endIso?: string | undefined }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (endIso) return; const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, [endIso]);
  return <span className="tnum font-mono" aria-label="Cronómetro de limpieza">{elapsed(startIso, endIso, now) ?? "--:--:--"}</span>;
}
