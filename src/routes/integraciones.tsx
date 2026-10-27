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
  demo: ["MODO DEMO", "border-st-dirty/50 bg-st-dirty/15"],
  credenciales: ["FALTAN CREDENCIALES", "border-st-maint/40 bg-st-maint/10 text-st-maint"],
  disponible: ["DISPONIBLE", "bg-muted text-muted-foreground"],
} as const;

function Integraciones() {
  const cats = [...new Set(integrations.map((i) => i.cat))];
  return (
    <div>
      <PageHeader title="Integraciones" sub="Ninguna integración está conectada todavía · estado real de cada una" />
      {cats.map((c) => (
        <section key={c} className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{c}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {integrations.filter((i) => i.cat === c).map((i) => (
              <Card key={i.name} className="flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-muted text-sm font-bold">{i.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</div>
                  <Pill className={ST[i.status][1]}>{ST[i.status][0]}</Pill>
                </div>
                <div className="mt-3 font-semibold">{i.name}</div>
                <div className="text-sm text-muted-foreground">{i.desc}</div>
                <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
                  <span>{i.note}</span>
                  <Button size="sm" variant="outline" onClick={() => toast("Aún no disponible", { description: "Esta conexión necesita el acceso oficial del proveedor. Te avisaremos cuando pueda activarse." })}>Solicitar</Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
