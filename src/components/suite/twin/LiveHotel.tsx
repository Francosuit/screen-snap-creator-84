import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSuite } from "@/lib/suite/store";
import { IsoBuilding, TwinLegend } from "./IsoBuilding";
import { useTwin } from "./useTwin";
import { RoomSheet, ReservationSheet } from "@/components/suite/panels";

export function FloorChips({ floors, value, onChange, dark }: { floors: { number: number }[]; value: number | null; onChange: (v: number | null) => void; dark?: boolean }) {
  const base = dark ? "border-twin-line text-twin-muted hover:text-twin-text" : "border-border text-muted-foreground hover:text-foreground";
  const on = dark ? "border-twin-text bg-twin-text text-twin-bg" : "border-foreground bg-foreground text-background";
  return (
    <div className="flex flex-wrap gap-1">
      <button onClick={() => onChange(null)} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition", value == null ? on : base)}>Todas</button>
      {floors.map((f) => (
        <button key={f.number} onClick={() => onChange(f.number)} className={cn("tnum min-w-8 rounded-full border px-2.5 py-1 text-xs font-medium transition", value === f.number ? on : base)}>{f.number}</button>
      ))}
    </div>
  );
}

export function SimToggle({ dark }: { dark?: boolean }) {
  const { sim, actions } = useSuite();
  return (
    <button onClick={() => actions.setSim(!sim)}
      className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
        sim ? "border-st-ready/60 bg-st-ready/15 text-st-ready" : dark ? "border-twin-line text-twin-muted hover:text-twin-text" : "border-border text-muted-foreground hover:text-foreground")}>
      {sim ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}{sim ? "Simulando…" : "Simular actividad"}
    </button>
  );
}

export function LiveHotel() {
  const { hotel } = useSuite();
  const { layout, floors, info } = useTwin();
  const [floor, setFloor] = useState<number | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [res, setRes] = useState<string | null>(null);
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-twin-bg text-twin-text">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 pt-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-twin-muted">
            Hotel en tiempo real
            <span className="flex items-center gap-1 text-st-ready"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-st-ready" />Live</span>
          </div>
          <div className="truncate text-lg font-semibold tracking-tight">{hotel.name}</div>
        </div>
        <Link to="/hotel" className="flex items-center gap-1 rounded-full border border-twin-line px-3 py-1 text-xs text-twin-muted hover:text-twin-text">Explorar<ArrowUpRight className="h-3 w-3" /></Link>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-3">
        <FloorChips floors={floors} value={floor} onChange={setFloor} dark />
        <SimToggle dark />
      </div>
      <IsoBuilding facade={hotel.facade} layout={layout} info={info} focusFloor={floor} selected={room} onSelect={setRoom} compact className="mt-2 h-[340px] flex-1 rounded-none sm:h-[400px]" />
      <TwinLegend className="px-5 pb-4 pt-2" />
      <RoomSheet room={room} onClose={() => setRoom(null)} onOpenRes={(id) => { setRoom(null); setRes(id); }} />
      <ReservationSheet resId={res} onClose={() => setRes(null)} />
    </div>
  );
}
