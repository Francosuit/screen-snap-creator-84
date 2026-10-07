import { createFileRoute } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { activities } from "@/lib/suite/data";
import { dayDate, fmtDay, useSuite } from "@/lib/suite/store";
import { Card, PageHeader, Pill, SectionTitle } from "@/components/suite/ui";

export const Route = createFileRoute("/mensajes")({
  head: () => ({
    meta: [
      { title: "Mensajes y experiencia — Suite Hotel OS" },
      { name: "description", content: "Automatizaciones del huésped que verifican su estado antes de enviar, y actividades del hotel." },
      { property: "og:title", content: "Mensajes y experiencia — Suite Hotel OS" },
      { property: "og:description", content: "Comunicaciones que solo llegan a quien sigue alojado." },
    ],
  }),
  component: Mensajes,
});

function Mensajes() {
  const { s, actions } = useSuite();
  const juanRes = s.reservations.find((r) => r.id === "R-2041")!;
  const juan = s.guests.find((g) => g.id === "g1")!;
  const stayDays = Array.from({ length: juanRes.outDay - juanRes.inDay + 1 }, (_, i) => dayDate(juanRes.inDay + i).getDay());
  const recos = activities.filter((a) => a.days.some((d) => stayDays.includes(d)));
  return (
    <div>
      <PageHeader title="Mensajes" sub="Automatizaciones del huésped · siempre verifican el estado actual antes de enviar" />
      <Tabs defaultValue="auto">
        <TabsList className="mb-4"><TabsTrigger value="auto">Automatizaciones</TabsTrigger><TabsTrigger value="act">Actividades</TabsTrigger></TabsList>
        <TabsContent value="auto">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-6">
              <div className="grid gap-3">
                {s.rules.map((r) => (
                  <Card key={r.id} className="p-4">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{r.name}</span><Pill className="bg-muted font-mono">{r.time}</Pill><span className="text-xs text-muted-foreground">{r.trigger}</span></div>
                        <div className="mt-1 text-sm"><span className="text-muted-foreground">Destinatarios:</span> {r.audience}</div>
                        <div className="text-sm text-muted-foreground">{r.content}</div>
                      </div>
                      <Switch checked={r.active} onCheckedChange={() => actions.toggleRule(r.id)} />
                    </div>
                    {r.id !== "m3" && <Button size="sm" variant="outline" className="mt-3" disabled={!r.active} onClick={() => actions.simulateRule(r.id)}><Play className="mr-1.5 h-3.5 w-3.5" />Simular envío ahora</Button>}
                  </Card>
                ))}
              </div>
              <Card>
                <SectionTitle>Registro de envíos</SectionTitle>
                <div className="divide-y text-sm">
                  {s.sent.slice(0, 14).map((m) => (
                    <div key={m.id} className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 py-2">
                      <span className="tnum text-xs text-muted-foreground">{m.time}</span>
                      <div className="min-w-0"><span className="font-medium">{m.guest}</span> <span className="text-muted-foreground">· {m.rule}</span>{m.reason && <div className="text-xs text-muted-foreground">{m.reason}</div>}</div>
                      <Pill className={m.result === "enviado" ? "border-st-ready/30 bg-st-ready/10 text-st-ready" : "bg-muted text-muted-foreground"}>{m.result === "enviado" ? "Enviado" : "Omitido"}</Pill>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div>
              <SectionTitle>Vista del huésped · Juan Pérez</SectionTitle>
              <div className="mx-auto max-w-[360px] rounded-[2rem] border-8 border-foreground/90 bg-muted p-3 shadow-xl">
                <div className="mb-3 flex items-center justify-between px-1 text-xs">
                  <span className="font-semibold">Hotel Suite Grand</span>
                  <span className={cn("rounded-full px-2 py-0.5", juan.messaging ? "bg-st-ready/15 text-st-ready" : "bg-background text-muted-foreground")}>{juan.messaging ? "In-House activo" : "Inactivo"}</span>
                </div>
                {juan.messaging ? (
                  <div className="space-y-2">
                    <div className="rounded-2xl rounded-tl-sm bg-card p-3 text-sm leading-relaxed shadow-sm">
                      <p>Buenos días Juan 👋</p>
                      <p className="mt-2">Hoy tendremos 24°C y cielo despejado.</p>
                      <p className="mt-2">🏊 Piscina abierta hasta las 20:00.<br />🎾 Quedan plazas para tenis a las 17:00.<br />🍽 Restaurante desde las 20:30.</p>
                      <div className="tnum mt-1 text-right text-[10px] text-muted-foreground">08:00</div>
                    </div>
                    {["Ver actividades", "Reservar", "Hablar con recepción"].map((b) => (
                      <button key={b} className="w-full rounded-xl bg-card py-2 text-sm font-medium text-brand shadow-sm hover:bg-accent">{b}</button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">
                    Estancia {fmtDay(juanRes.inDay).toLowerCase()} → {fmtDay(juanRes.outDay).toLowerCase()} (martes → jueves).
                    <br /><br />{juanRes.stay === "finished" ? "Check-out realizado: Suite ha detenido las comunicaciones." : "Las comunicaciones se activarán automáticamente al hacer check-in."}
                  </div>
                )}
              </div>
              <Card className="mt-4">
                <SectionTitle>Recomendadas durante su estancia</SectionTitle>
                <div className="flex flex-wrap gap-2">{recos.map((a) => <Pill key={a.id} className="bg-muted">{a.icon} {a.name}</Pill>)}</div>
              </Card>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="act">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {activities.map((a) => (
              <Card key={a.id}>
                <div className="flex items-start justify-between"><span className="text-3xl">{a.icon}</span><Pill className={a.bookable ? "border-brand/30 bg-brand/10 text-brand" : "bg-muted"}>{a.bookable ? "Reservable" : "Acceso libre"}</Pill></div>
                <div className="mt-3 font-semibold">{a.name}</div>
                <p className="text-sm text-muted-foreground">{a.description}</p>
                <div className="mt-3 grid grid-cols-2 gap-y-1 text-xs">
                  <span className="text-muted-foreground">Horario</span><span>{a.schedule}</span>
                  <span className="text-muted-foreground">Días</span><span>{a.days.length === 7 ? "Todos" : a.days.map((d) => ["D", "L", "M", "X", "J", "V", "S"][d]).join(" ")}</span>
                  <span className="text-muted-foreground">Precio</span><span>{a.price}</span>
                  <span className="text-muted-foreground">Plazas</span><span>{a.spots}</span>
                  <span className="text-muted-foreground">Ubicación</span><span>{a.location}</span>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
