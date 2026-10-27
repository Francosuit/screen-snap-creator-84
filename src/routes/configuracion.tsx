import { createFileRoute, Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { actionRules } from "@/lib/suite/data";
import { useSuite } from "@/lib/suite/store";
import { Card, PageHeader, SectionTitle } from "@/components/suite/ui";
import { HistoryPanel, TeamPanel } from "@/components/suite/TeamPanel";

export const Route = createFileRoute("/configuracion")({
  head: () => ({
    meta: [
      { title: "Configuración · Action Engine — Suite" },
      { name: "description", content: "El cerebro de Suite: eventos, condiciones y acciones automáticas, con trazabilidad completa." },
      { property: "og:title", content: "Configuración · Action Engine — Suite" },
      { property: "og:description", content: "Evento → contexto → reglas → acciones → verificación." },
    ],
  }),
  component: Configuracion,
});

function Configuracion() {
  const { s, hotels } = useSuite();
  return (
    <div>
      <PageHeader title="Configuración" sub="Evento → Contexto → Reglas → Acciones → Verificación" />
      <Tabs defaultValue="engine">
        <TabsList className="mb-4"><TabsTrigger value="engine">Action Engine</TabsTrigger><TabsTrigger value="log">Trazabilidad</TabsTrigger><TabsTrigger value="team">Personal y puestos</TabsTrigger><TabsTrigger value="history">Historial</TabsTrigger><TabsTrigger value="group">Multi-hotel</TabsTrigger><TabsTrigger value="new">Crear hotel</TabsTrigger></TabsList>
        <TabsContent value="team"><TeamPanel hotelKey={s.hotel} /></TabsContent>
        <TabsContent value="history"><HistoryPanel hotelKey={s.hotel} /></TabsContent>
        <TabsContent value="engine">
          <div className="grid gap-4 lg:grid-cols-2">
            {actionRules.map((r) => (
              <Card key={r.event}>
                <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
                  <div className="space-y-3">
                    <div><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Evento</div><div className="mt-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground">{r.event}</div></div>
                    <div><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Condiciones</div>
                      {r.conditions.map((c) => <div key={c} className="mt-1 rounded-lg border px-2.5 py-1.5 text-xs">{c}</div>)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Acciones</div>
                    <ol className="mt-1 space-y-1.5">
                      {r.actions.map((a, i) => (
                        <li key={a} className="flex items-center gap-2.5 text-sm"><span className="tnum grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand/15 text-[10px] font-semibold text-brand">{i + 1}</span>{a}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="log">
          <Card>
            <SectionTitle>Historial de acciones</SectionTitle>
            <div className="divide-y">
              {s.log.map((l) => (
                <div key={l.id} className="grid grid-cols-[48px_120px_minmax(0,1fr)] gap-3 py-2.5 text-sm max-sm:grid-cols-[48px_minmax(0,1fr)]">
                  <span className="tnum text-xs text-muted-foreground">{l.time}</span>
                  <span className={cn("font-medium max-sm:hidden", l.actor === "Suite" && "text-brand")}>{l.actor}</span>
                  <span><span className={cn("font-medium sm:hidden", l.actor === "Suite" && "text-brand")}>{l.actor} · </span>{l.text}</span>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="group">
          <Card className="max-w-xl">
            <SectionTitle>Estructura</SectionTitle>
            <div className="text-sm">
              <div className="rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground">Grupo Suite</div>
              {hotels.map((h) => (
                <div key={h.name} className="ml-5 mt-2 border-l pl-4">
                  <div className="rounded-lg border px-3 py-2 font-medium">{h.name} <span className="text-muted-foreground">· {h.city}</span></div>
                  <div className="ml-5 mt-2 border-l pl-4 text-muted-foreground"><div className="rounded-lg bg-muted px-3 py-2">{h.rooms} habitaciones</div></div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="new"><CreateHotel /></TabsContent>
      </Tabs>
    </div>
  );
}

function CreateHotel() {
  return (
    <Card className="max-w-xl">
      <SectionTitle>Nuevo hotel</SectionTitle>
      <p className="mb-4 text-sm text-muted-foreground">El constructor guiado crea organización, plantas, habitaciones, zonas y equipo, y genera el hotel digital automáticamente.</p>
      <Button asChild><Link to="/crear-hotel">Abrir constructor de hotel</Link></Button>
    </Card>
  );
}
