import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Plug,
  RefreshCw,
  Settings2,
  SquareArrowOutUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Pill } from "./ui";
import { providerCatalog } from "@/lib/suite/api/catalog";

/** Catalog entries describe possible work, never an authenticated connection. */
export function ProviderCatalog() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {providerCatalog.map((provider) => (
        <Card key={provider.id} className="flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-muted text-sm font-bold">
              {provider.name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)}
            </div>
            <Pill className="bg-muted text-muted-foreground">NO CONECTADA</Pill>
          </div>
          <div className="mt-3 font-semibold">{provider.name}</div>
          <p className="mt-1 text-sm text-muted-foreground">{provider.description}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            {provider.category} ·{" "}
            {provider.direction === "inbound" ? (
              <>
                <ArrowDownToLine className="mr-1 inline size-3" />
                Entrada
              </>
            ) : provider.direction === "outbound" ? (
              <>
                <ArrowUpFromLine className="mr-1 inline size-3" />
                Salida
              </>
            ) : (
              "Entrada y salida"
            )}
          </p>
          <p className="mt-3 text-xs">
            Capacidades documentadas: {provider.capabilities.join(" · ")}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{provider.access}</p>
          <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
            <Button
              size="sm"
              variant="outline"
              disabled={provider.id !== "custom-api"}
              onClick={
                provider.id === "custom-api"
                  ? () =>
                      document
                        .getElementById("suite-api-title")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  : undefined
              }
              title={
                provider.id === "custom-api"
                  ? "Usa el administrador API de esta página"
                  : "Requiere un adaptador y acceso oficial"
              }
            >
              <Plug className="size-3" />
              {provider.id === "custom-api" ? "Configurar arriba" : "Conectar"}
            </Button>
            <Button size="sm" variant="ghost" disabled>
              <Settings2 className="size-3" />
              Configurar
            </Button>
            <Button size="sm" variant="ghost" disabled>
              <RefreshCw className="size-3" />
              Sincronizar
            </Button>
          </div>
          {provider.id !== "custom-api" && (
            <p className="mt-2 text-xs text-muted-foreground">
              <SquareArrowOutUpRight className="mr-1 inline size-3" />
              Sin credenciales, conexión ni sincronización verificadas.
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}
