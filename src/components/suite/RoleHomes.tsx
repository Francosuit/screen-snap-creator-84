import { useState } from "react";
import { AlertTriangle, Clock, Play, CheckCircle2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useSuite } from "@/lib/suite/store";
import type { Task } from "@/lib/suite/data";
import { Card, PageHeader, PrioPill, RoomPill, Row, TaskPill } from "./ui";
import { ReportIssueDialog } from "./panels";

const prioRank = { urgente: 0, alta: 1, media: 2, baja: 3 } as const;

export function HousekeepingHome() {
  const { s, actions, roomState } = useSuite();
  const [open, setOpen] = useState<string | null>(null);
  const [report, setReport] = useState(false);
  const mine = s.tasks.filter((t) => t.dept === "housekeeping" && t.assignee === "María López")
    .sort((a, b) => (a.status === "completada" ? 1 : 0) - (b.status === "completada" ? 1 : 0) || prioRank[a.priority] - prioRank[b.priority]);
  const t = mine.find((x) => x.id === open);
  const pending = mine.filter((x) => x.status !== "completada");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Mis habitaciones" sub={`Hola María · ${pending.length} pendientes hoy`}
        right={<Button variant="outline" onClick={() => setReport(true)}><AlertTriangle className="mr-1.5 h-4 w-4" />Reportar problema</Button>} />
      <div className="grid gap-3 sm:grid-cols-2">
        {mine.map((x) => (
          <button key={x.id} onClick={() => setOpen(x.id)} className="text-left">
            <Card className={`transition hover:-translate-y-0.5 hover:shadow-md ${x.status === "completada" ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between">
                <div className="text-3xl font-semibold tracking-tight">{x.room}</div>
                <PrioPill p={x.priority} />
              </div>
              <div className="mt-1 text-sm font-medium">{x.kind === "repaso" ? "Repaso" : x.title}</div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Límite {x.deadline}</span>
                {x.nextCheckIn && <span>Próx. check-in {x.nextCheckIn}</span>}
              </div>
              <div className="mt-3 flex items-center gap-2"><TaskPill s={x.status} /><RoomPill state={roomState(x.room)} /></div>
            </Card>
          </button>
        ))}
      </div>
      <TaskSheet task={t} onClose={() => setOpen(null)} onStart={() => t && actions.startTask(t.id)} onFinish={() => t && actions.finishTask(t.id)} startLabel="Empezar limpieza" finishLabel="Finalizar limpieza" onReport={() => setReport(true)} />
      <ReportIssueDialog open={report} onOpenChange={setReport} defaultRoom={t?.room} />
    </div>
  );
}

function TaskSheet({ task, onClose, onStart, onFinish, startLabel, finishLabel, onReport }: {
  task?: Task; onClose: () => void; onStart: () => void; onFinish: () => void; startLabel: string; finishLabel: string; onReport?: () => void;
}) {
  return (
    <Sheet open={!!task} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {task && (
          <>
            <SheetHeader className="p-0">
              <div className="flex gap-2"><PrioPill p={task.priority} /><TaskPill s={task.status} /></div>
              <SheetTitle className="text-3xl">Habitación {task.room}</SheetTitle>
              <SheetDescription>{task.title}</SheetDescription>
            </SheetHeader>
            <div className="mt-6 divide-y">
              <Row k="Responsable" v={task.assignee} /><Row k="Hora límite" v={task.deadline} />
              {task.nextCheckIn && <Row k="Próximo check-in" v={task.nextCheckIn} />}
              <Row k="Inicio" v={task.startedAt ?? "—"} /><Row k="Fin" v={task.endedAt ?? "—"} />
            </div>
            {task.comments && <p className="mt-4 rounded-xl bg-muted p-3 text-sm">{task.comments}</p>}
            <div className="mt-6 grid gap-2">
              {task.status === "pendiente" && <Button size="lg" onClick={onStart}><Play className="mr-1.5 h-4 w-4" />{startLabel}</Button>}
              {task.status === "en_proceso" && <Button size="lg" onClick={onFinish}><CheckCircle2 className="mr-1.5 h-4 w-4" />{finishLabel}</Button>}
              {task.status === "completada" && <div className="rounded-xl bg-st-ready/10 p-3 text-center text-sm font-medium text-st-ready">Completada a las {task.endedAt}</div>}
              {onReport && <Button variant="outline" onClick={onReport}><AlertTriangle className="mr-1.5 h-4 w-4" />Reportar problema</Button>}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function MaintenanceHome() {
  const { s, actions } = useSuite();
  const [open, setOpen] = useState<string | null>(null);
  const mine = s.tasks.filter((t) => t.dept === "mantenimiento")
    .sort((a, b) => (a.status === "completada" ? 1 : 0) - (b.status === "completada" ? 1 : 0) || prioRank[a.priority] - prioRank[b.priority]);
  const t = mine.find((x) => x.id === open);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Mis incidencias" sub={`Hola Carlos · ${mine.filter((x) => x.status !== "completada").length} abiertas`} />
      <div className="grid gap-3">
        {mine.map((x) => {
          const inc = s.incidents.find((i) => i.id === x.incidentId);
          return (
            <Card key={x.id} className={x.status === "completada" ? "opacity-60" : ""}>
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                <div className="grid h-14 w-14 place-items-center rounded-xl bg-muted text-lg font-semibold">{x.room}</div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{inc?.category ?? x.title}</span><PrioPill p={x.priority} /><TaskPill s={x.status} /></div>
                  <div className="mt-0.5 text-sm text-muted-foreground">{inc?.description ?? x.comments}</div>
                  <div className="tnum mt-1 text-xs text-muted-foreground">
                    Reportada {inc?.createdAt ?? "—"} · Inicio {x.startedAt ?? "—"} · Fin {x.endedAt ?? "—"} · {x.assignee}
                  </div>
                </div>
                <div className="col-span-2 flex gap-2 sm:col-span-1">
                  {x.status === "pendiente" && <Button onClick={() => actions.startTask(x.id)}><Wrench className="mr-1.5 h-4 w-4" />Empezar</Button>}
                  {x.status === "en_proceso" && <Button onClick={() => actions.finishTask(x.id)}><CheckCircle2 className="mr-1.5 h-4 w-4" />Resuelto</Button>}
                  <Button variant="ghost" onClick={() => setOpen(x.id)}>Detalle</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <TaskSheet task={t} onClose={() => setOpen(null)} onStart={() => t && actions.startTask(t.id)} onFinish={() => t && actions.finishTask(t.id)} startLabel="Empezar" finishLabel="Resuelto" />
    </div>
  );
}
