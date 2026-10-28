import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSuite } from "@/lib/suite/store";
import { Card, PageHeader, PrioPill, TaskPill } from "@/components/suite/ui";
import { ReportIssueDialog } from "@/components/suite/panels";

export const Route = createFileRoute("/tareas")({
  head: () => ({
    meta: [
      { title: "Tareas — Suite Hotel OS" },
      { name: "description", content: "Tareas de housekeeping, mantenimiento y recepción con prioridad y hora límite." },
      { property: "og:title", content: "Tareas — Suite Hotel OS" },
      { property: "og:description", content: "Tareas operativas con prioridad y trazabilidad." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Tareas,
});

const DEPT = { housekeeping: "Housekeeping", mantenimiento: "Mantenimiento", recepcion: "Recepción", revenue: "Revenue" } as const;

function Tareas() {
  const { s, actions } = useSuite();
  const scope = s.role === "housekeeping" ? "housekeeping" : s.role === "maintenance" ? "mantenimiento" : null;
  const [dept, setDept] = useState<string>("todas");
  const [report, setReport] = useState(false);
  const list = s.tasks.filter((t) => (scope ? t.dept === scope : dept === "todas" || t.dept === dept));
  return (
    <div>
      <PageHeader title="Tareas" sub={`${list.filter((t) => t.status !== "completada").length} abiertas · ${s.incidents.filter((i) => i.status !== "resuelta").length} incidencias activas`}
        right={<Button variant="outline" onClick={() => setReport(true)}><AlertTriangle className="mr-1.5 h-4 w-4" />Reportar problema</Button>} />
      {!scope && (
        <Tabs value={dept} onValueChange={setDept} className="mb-4">
          <TabsList><TabsTrigger value="todas">Todas</TabsTrigger><TabsTrigger value="housekeeping">Housekeeping</TabsTrigger><TabsTrigger value="mantenimiento">Mantenimiento</TabsTrigger><TabsTrigger value="recepcion">Recepción</TabsTrigger></TabsList>
        </Tabs>
      )}
      <div className="grid gap-3">
        {list.map((t) => (
          <Card key={t.id} className="p-4">
            <div className="grid gap-3 md:grid-cols-[64px_minmax(0,1fr)_auto] md:items-center">
              <div className="flex items-center gap-3 md:block">
                <div className="grid h-12 w-14 place-items-center rounded-xl bg-muted text-base font-semibold">{t.room}</div>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{t.title}</span><PrioPill p={t.priority} /><TaskPill s={t.status} /></div>
                <div className="tnum mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{t.assignee}</span><span>{DEPT[t.dept]}</span><span>Hoy · límite {t.deadline}</span>
                  {t.nextCheckIn && <span>Próx. check-in {t.nextCheckIn}</span>}
                  {t.startedAt && <span>Inicio {t.startedAt}</span>}{t.endedAt && <span>Fin {t.endedAt}</span>}
                </div>
                {t.comments && <div className="mt-1 text-sm text-muted-foreground">{t.comments}</div>}
              </div>
              <div className="flex gap-2">
                {t.status === "pendiente" && <Button size="sm" onClick={() => actions.startTask(t.id)}>{t.dept === "housekeeping" ? "Empezar limpieza" : "Empezar"}</Button>}
                {t.status === "en_proceso" && <Button size="sm" onClick={() => actions.finishTask(t.id)}>{t.dept === "housekeeping" ? "Finalizar limpieza" : "Resuelto"}</Button>}
              </div>
            </div>
          </Card>
        ))}
      </div>
      <ReportIssueDialog open={report} onOpenChange={setReport} />
    </div>
  );
}
