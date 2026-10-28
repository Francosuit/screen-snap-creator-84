import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { RoomState } from "@/lib/suite/data";
import { fmtDay, useSuite } from "@/lib/suite/store";
import { Dot, PageHeader, ROOM_STATE } from "@/components/suite/ui";
import { ReservationSheet, RoomSheet } from "@/components/suite/panels";

export const Route = createFileRoute("/habitaciones")({
  head: () => ({
    meta: [
      { title: "Habitaciones — Suite Hotel OS" },
      { name: "description", content: "Mapa visual de habitaciones con estado, huésped y housekeeping en tiempo real." },
      { property: "og:title", content: "Habitaciones — Suite Hotel OS" },
      { property: "og:description", content: "Mapa visual de habitaciones en tiempo real." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Habitaciones,
});

function Habitaciones() {
  const { s, roomState, occupant, nextArrival, guest } = useSuite();
  const [room, setRoom] = useState<string | null>(null);
  const [res, setRes] = useState<string | null>(null);
  const counts = {} as Record<RoomState, number>;
  s.rooms.forEach((r) => { const st = roomState(r.number); counts[st] = (counts[st] ?? 0) + 1; });

  return (
    <div>
      <PageHeader title="Habitaciones" sub="Mapa en tiempo real · pulsa una habitación para ver su detalle" />
      <div className="mb-6 flex flex-wrap gap-2">
        {(Object.keys(ROOM_STATE) as RoomState[]).map((k) => (
          <span key={k} className="flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs">
            <Dot className={ROOM_STATE[k].dot} />{ROOM_STATE[k].label}<span className="tnum font-semibold">{counts[k] ?? 0}</span>
          </span>
        ))}
      </div>
      <div className="space-y-6">
        {[3, 2, 1].map((floor) => (
          <div key={floor}>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Planta {floor}</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {s.rooms.filter((r) => r.floor === floor).map((r) => {
                const st = roomState(r.number);
                const occ = occupant(r.number);
                const next = nextArrival(r.number);
                const S = ROOM_STATE[st];
                return (
                  <button key={r.number} onClick={() => setRoom(r.number)}
                    className={cn("group relative flex min-h-[132px] flex-col rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md", S.tint)}>
                    <span className={cn("absolute inset-x-0 top-0 h-1 rounded-t-2xl", S.dot)} />
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-semibold tracking-tight">{r.number}</span>
                      <Dot className={cn("h-2.5 w-2.5", S.dot)} />
                    </div>
                    <div className="text-[11px] text-muted-foreground">{r.type}</div>
                    <div className="mt-auto pt-3 text-xs">
                      {occ ? (
                        <>
                          <div className="truncate text-sm font-medium">{guest(occ.guestId).name}</div>
                          <div className="font-semibold text-st-occupied">IN HOUSE</div>
                          <div className="text-muted-foreground">Salida: {fmtDay(occ.outDay)} 11:00</div>
                        </>
                      ) : (
                        <>
                          <div className={cn("font-semibold", S.text)}>{S.label.toUpperCase()}</div>
                          {next && next.inDay <= 1 && <div className="truncate text-muted-foreground">Llega {fmtDay(next.inDay).toLowerCase()} {next.eta} · {guest(next.guestId).name}</div>}
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <RoomSheet room={room} onClose={() => setRoom(null)} onOpenRes={(id) => { setRoom(null); setRes(id); }} />
      <ReservationSheet resId={res} onClose={() => setRes(null)} />
    </div>
  );
}
