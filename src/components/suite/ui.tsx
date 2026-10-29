import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Priority, RoomState, TaskStatus } from "@/lib/suite/data";
import type { ResDisplay } from "@/lib/suite/store";

export const ROOM_STATE: Record<RoomState, { label: string; dot: string; tint: string; text: string }> = {
  ready: { label: "Lista", dot: "bg-st-ready", tint: "bg-st-ready/10 border-st-ready/30", text: "text-st-ready" },
  occupied: { label: "Ocupada", dot: "bg-st-occupied", tint: "bg-st-occupied/10 border-st-occupied/30", text: "text-st-occupied" },
  dirty: { label: "Pendiente limpieza", dot: "bg-st-dirty", tint: "bg-st-dirty/15 border-st-dirty/50", text: "text-foreground" },
  cleaning: { label: "Limpieza en proceso", dot: "bg-st-cleaning", tint: "bg-st-cleaning/12 border-st-cleaning/40", text: "text-st-cleaning" },
  maintenance: { label: "Mantenimiento", dot: "bg-st-maint", tint: "bg-st-maint/10 border-st-maint/35", text: "text-st-maint" },
  oos: { label: "Fuera de servicio", dot: "bg-st-oos", tint: "bg-st-oos/10 border-st-oos/30", text: "text-muted-foreground" },
};

export function Dot({ className }: { className?: string }) {
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", className)} />;
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium", className)}>{children}</span>;
}

export function RoomPill({ state }: { state: RoomState }) {
  const s = ROOM_STATE[state];
  return <Pill className={cn(s.tint, s.text)}><Dot className={s.dot} />{s.label}</Pill>;
}

const RES_STYLE: Record<ResDisplay, string> = {
  Confirmada: "bg-muted text-foreground border-border",
  "Check-in pendiente": "bg-st-ready/10 text-st-ready border-st-ready/30",
  "IN HOUSE": "bg-st-occupied/10 text-st-occupied border-st-occupied/30",
  "Check-out pendiente": "bg-st-cleaning/10 text-st-cleaning border-st-cleaning/30",
  Finalizada: "bg-muted text-muted-foreground border-border",
  Cancelada: "bg-st-maint/10 text-st-maint border-st-maint/30",
  "No-show": "bg-st-oos/15 text-muted-foreground border-st-oos/30",
};
export const ResPill = ({ status }: { status: ResDisplay }) => <Pill className={RES_STYLE[status]}>{status}</Pill>;

const PRIO: Record<Priority, string> = {
  baja: "bg-muted text-muted-foreground border-border",
  media: "bg-st-dirty/15 text-foreground border-st-dirty/40",
  alta: "bg-st-cleaning/12 text-st-cleaning border-st-cleaning/35",
  urgente: "bg-st-maint/12 text-st-maint border-st-maint/35",
};
export const PrioPill = ({ p }: { p: Priority }) => <Pill className={PRIO[p]}>{p.toUpperCase()}</Pill>;

const TS: Record<TaskStatus, [string, string]> = {
  pendiente: ["Pendiente", "bg-st-dirty/15 border-st-dirty/40"],
  en_proceso: ["En proceso", "bg-st-cleaning/12 text-st-cleaning border-st-cleaning/35"],
  completada: ["Completada", "bg-st-ready/10 text-st-ready border-st-ready/30"],
  bloqueada: ["Bloqueada", "bg-st-maint/10 text-st-maint border-st-maint/30"],
};
export const TaskPill = ({ s }: { s: TaskStatus }) => <Pill className={TS[s][1]}>{TS[s][0]}</Pill>;

export function Card({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <div style={style} className={cn("rounded-2xl border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]", className)}>{children}</div>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{children}</h2>
      {right}
    </div>
  );
}

export function PageHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Kpi({ label, value, delta, hint, className, accent }: { label: string; value: string; delta?: string; hint?: string; className?: string; accent?: string }) {
  return (
    <Card className={cn("p-4", className)} style={accent ? ({ "--kpi-accent": accent } as CSSProperties) : undefined}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tnum mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {delta && <span className={cn("font-medium", delta.startsWith("-") ? "text-st-maint" : "text-st-ready")}>{delta}</span>}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </Card>
  );
}

export function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

export function NoAccess() {
  return (
    <Card className="mx-auto mt-16 max-w-md text-center">
      <div className="text-lg font-semibold">Sin acceso con este rol</div>
      <p className="mt-2 text-sm text-muted-foreground">Cambia de usuario en el selector superior para ver este módulo.</p>
    </Card>
  );
}
