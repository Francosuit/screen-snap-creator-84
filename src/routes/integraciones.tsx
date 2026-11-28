import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { integrations } from "@/lib/suite/data";
import { useSuite } from "@/lib/suite/store";
import { Card, PageHeader, Pill } from "@/components/suite/ui";
import { IntegrationConsole } from "@/components/suite/IntegrationConsole";

export const Route = createFileRoute("/integraciones")({
  head: () => ({
    meta: [
      { title: "Integraciones — Suite Hotel OS" },
      { name: "description", content: "Administración y comprobación de conectividad externa del PMS Suite Hotel OS, con autorización independiente por hotel." },
      { property: "og:title", content: "Integraciones — Suite Hotel OS" },
      { property: "og:description", content: "Consola de autorización y prueba de proveedores externos para el PMS Suite Hotel OS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Integraciones,
});

const ST = {
  demo: ["MODO DEMO", "border-st-dirty/50 bg-st-dirty/15"],
  credenciales: ["FALTAN CREDENCIALES", "border-st-maint/40 bg-st-maint/10 text-st-maint"],
  disponible: ["NO IMPLEMENTADA", "bg-muted text-muted-foreground"],
} as const;

function Integraciones() {
  const { isDemo, authReady, cloudHotelId, hotel, user } = useSuite();
  const cats = [...new Set(integrations.map((i) => i.cat))];
  return (
    <div>
      <PageHeader title="Integraciones" sub={`Suite Hotel OS · PMS central · ${hotel.name}`} />
      {isDemo ? <section className="border-y py-5"><h2 className="text-lg font-semibold">Conectividad externa</h2><p className="mt-2 text-sm text-muted-foreground">Modo demo · no se autentican proveedores ni se sincronizan reservas.</p></section>
        : authReady && cloudHotelId && user ? <IntegrationConsole key={`${cloudHotelId}:${user.email}`} hotelId={cloudHotelId} identity={user.email} />
        : <p className="border-y py-5 text-sm text-muted-foreground">{authReady ? "Selecciona un hotel autorizado para administrar conexiones." : "Cargando tu hotel autorizado…"}</p>}
      <details className="mt-6">
      <summary className="mb-5 cursor-pointer text-sm font-semibold text-muted-foreground">{isDemo ? "Catálogo de demostración" : "Otros servicios · sin adaptador activo"}</summary>
      {cats.map((c) => (
        <section key={c} className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{c}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {integrations.filter((i) => i.cat === c).map((i) => (
              <Card key={i.name} className="flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-muted text-sm font-bold">{i.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</div>
                  <Pill className={isDemo ? ST[i.status][1] : "bg-muted text-muted-foreground"}>{isDemo ? ST[i.status][0] : "NO CONECTADA"}</Pill>
                </div>
                <div className="mt-3 font-semibold">{i.name}</div>
                <div className="text-sm text-muted-foreground">{i.desc}</div>
                <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
                  <span>{isDemo ? i.note : "Sin conexión autenticada ni sincronizaciones verificadas."}</span>
                  <Button size="sm" variant="outline" disabled>No conectada</Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}
      </details>
    </div>
  );
}
