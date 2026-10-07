import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { integrations } from "@/lib/suite/data";
import { Card, PageHeader, Pill } from "@/components/suite/ui";

export const Route = createFileRoute("/integraciones")({
  head: () => ({
    meta: [
      { title: "Integraciones — Suite Hotel OS" },
      { name: "description", content: "Canales y servicios conectados: Booking.com, Expedia, web, WhatsApp y más." },
      { property: "og:title", content: "Integraciones — Suite Hotel OS" },
      { property: "og:description", content: "Canales y servicios conectados a Suite." },
    ],
  }),
  component: Integraciones,
});

const ST = {
  conectado: ["CONECTADO", "border-st-ready/30 bg-st-ready/10 text-st-ready"],
  pendiente: ["PENDIENTE", "border-st-dirty/50 bg-st-dirty/15"],
  disponible: ["DISPONIBLE", "bg-muted text-muted-foreground"],
} as const;

function Integraciones() {
  return (
    <div>
      <PageHeader title="Integraciones" sub="Simulado en esta demo · sin conexiones reales" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {integrations.map((i) => (
          <Card key={i.name} className="flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-muted text-sm font-bold">{i.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</div>
              <Pill className={ST[i.status][1]}>{ST[i.status][0]}</Pill>
            </div>
            <div className="mt-3 font-semibold">{i.name}</div>
            <div className="text-sm text-muted-foreground">{i.desc}</div>
            <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
              <span>Última sincronización: {i.sync}</span>
              {i.status !== "conectado" && <Button size="sm" variant="outline" onClick={() => toast("Simulación", { description: "En la versión real aquí se conectaría el servicio." })}>{i.status === "pendiente" ? "Completar" : "Conectar"}</Button>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
