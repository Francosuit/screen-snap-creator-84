import { useEffect, useState } from "react";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  Ban,
  BookOpen,
  Check,
  Copy,
  KeyRound,
  LoaderCircle,
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Pill } from "./ui";
import {
  configureSuiteApiIntegration,
  createSuiteApiIntegration,
  getSuiteApiOverview,
  revokeSuiteApiIntegration,
  rotateSuiteApiIntegration,
  testSuiteApiIntegration,
} from "@/lib/suite/api/suite-api.functions";
import { suiteApiPermissions } from "@/lib/suite/api/suite-api-contracts";
import type {
  SuiteApiCredentials,
  SuiteApiIntegrationDto,
  SuiteApiPermission,
} from "@/lib/suite/api/suite-api-contracts";

const permissionLabels: Record<SuiteApiPermission, string> = {
  "reservations:read": "Consultar reservas",
  "reservations:write": "Recibir y modificar reservas",
  "availability:read": "Consultar disponibilidad",
};
const statusLabels: Record<string, string> = {
  processing: "Procesando",
  applied: "Aplicada",
  duplicate: "Duplicada",
  ignored: "Ignorada",
  rejected: "Rechazada",
  pending: "Pendiente de mapeo",
};
type FormState = { name: string; permissions: SuiteApiPermission[]; mappingsText: string };
const blank: FormState = {
  name: "",
  permissions: ["reservations:read", "reservations:write"],
  mappingsText: "",
};
const mappingsText = (items: SuiteApiIntegrationDto["roomMappings"]) =>
  items.map((m) => `${m.externalCode}=${m.roomNumber}`).join("\n");
function parseMappings(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [externalCode, roomNumber, ...rest] = line.split("=");
      if (!externalCode?.trim() || !roomNumber?.trim() || rest.length)
        throw new Error(
          "Usa una correspondencia por línea: CODIGO=habitación. Ejemplo: DBL-STD=101",
        );
      return { externalCode: externalCode.trim(), roomNumber: roomNumber.trim() };
    });
}
const dateText = (value: string | null) => (value ? new Date(value).toLocaleString("es") : "Nunca");

export function ApiManager({ hotelId, identity }: { hotelId: string; identity: string }) {
  const qc = useQueryClient();
  const overviewFn = useServerFn(getSuiteApiOverview);
  const createFn = useServerFn(createSuiteApiIntegration);
  const configureFn = useServerFn(configureSuiteApiIntegration);
  const rotateFn = useServerFn(rotateSuiteApiIntegration);
  const revokeFn = useServerFn(revokeSuiteApiIntegration);
  const testFn = useServerFn(testSuiteApiIntegration);
  const { data } = useSuspenseQuery(
    queryOptions({
      queryKey: ["suite-api-overview", hotelId, identity],
      queryFn: () => overviewFn({ data: { hotelId } }),
      staleTime: 0,
      retry: false,
      refetchOnWindowFocus: false,
    }),
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SuiteApiIntegrationDto | null>(null);
  const [form, setForm] = useState<FormState>(blank);
  const [secrets, setSecrets] = useState<SuiteApiCredentials | null>(null);
  const [docs, setDocs] = useState<SuiteApiIntegrationDto | null>(null);
  const [origin, setOrigin] = useState("");
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["suite-api-overview", hotelId, identity] });
  const create = useMutation({
    mutationFn: (input: {
      name: string;
      permissions: SuiteApiPermission[];
      roomMappings: { externalCode: string; roomNumber: string }[];
    }) => createFn({ data: { hotelId, ...input } }),
    onSuccess: (value) => {
      setSecrets(value);
      setFormOpen(false);
      setNotice("Integración creada. Guarda ahora las credenciales.");
      void refresh();
    },
    retry: false,
  });
  const configure = useMutation({
    mutationFn: (input: {
      integrationId: string;
      name: string;
      permissions: SuiteApiPermission[];
      roomMappings: { externalCode: string; roomNumber: string }[];
    }) => configureFn({ data: { hotelId, ...input } }),
    onSuccess: () => {
      setFormOpen(false);
      setEditing(null);
      setNotice("Configuración guardada.");
      void refresh();
    },
    retry: false,
  });
  const rotate = useMutation({
    mutationFn: (integrationId: string) => rotateFn({ data: { hotelId, integrationId } }),
    onSuccess: (value) => {
      setSecrets(value);
      setNotice("Credenciales rotadas. La clave anterior dejó de funcionar.");
      void refresh();
    },
    retry: false,
  });
  const revoke = useMutation({
    mutationFn: (integrationId: string) => revokeFn({ data: { hotelId, integrationId } }),
    onSuccess: () => {
      setNotice("Credencial revocada. Las reservas ya recibidas se conservan.");
      void refresh();
    },
    retry: false,
  });
  const test = useMutation({
    mutationFn: (integrationId: string) => testFn({ data: { hotelId, integrationId } }),
    onSuccess: (value) => {
      setNotice(value.message);
      void refresh();
    },
    retry: false,
  });
  const busy =
    create.isPending ||
    configure.isPending ||
    rotate.isPending ||
    revoke.isPending ||
    test.isPending;
  const openCreate = () => {
    setEditing(null);
    setForm(blank);
    setFormError("");
    setFormOpen(true);
  };
  const openConfigure = (integration: SuiteApiIntegrationDto) => {
    setEditing(integration);
    setForm({
      name: integration.name,
      permissions: integration.permissions,
      mappingsText: mappingsText(integration.roomMappings),
    });
    setFormError("");
    setFormOpen(true);
  };
  const submit = () => {
    try {
      const roomMappings = parseMappings(form.mappingsText);
      if (!form.name.trim()) throw new Error("Escribe un nombre para la integración.");
      if (!form.permissions.length) throw new Error("Selecciona al menos un permiso.");
      if (editing)
        configure.mutate({
          integrationId: editing.id,
          name: form.name,
          permissions: form.permissions,
          roomMappings,
        });
      else create.mutate({ name: form.name, permissions: form.permissions, roomMappings });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Revisa el formulario.");
    }
  };
  const togglePermission = (permission: SuiteApiPermission) =>
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(permission)
        ? f.permissions.filter((p) => p !== permission)
        : [...f.permissions, permission],
    }));
  return (
    <section className="border-y py-6" aria-labelledby="suite-api-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <KeyRound className="size-5" />
            <h2 id="suite-api-title" className="text-lg font-semibold">
              API DE SUITE HOTEL OS
            </h2>
            <Pill className="bg-st-ready/15 text-st-ready">PMS CENTRAL</Pill>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Credenciales propias para que aplicaciones autorizadas envíen reservas y consulten
            información de este hotel. Cada clave queda limitada a este hotel.
          </p>
        </div>
        <Button onClick={openCreate} disabled={busy}>
          <Plus className="size-4" />
          Crear integración API
        </Button>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Activas", data.summary.active],
          ["Revocadas", data.summary.revoked],
          ["Errores", data.summary.errors],
          ["Recibidas", data.summary.received],
          ["Enviadas", data.summary.sent],
          ["Última actividad", dateText(data.summary.lastActivity)],
        ].map(([label, value]) => (
          <div key={String(label)} className="border-l pl-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 break-words text-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {notice && (
        <p role="status" className="mt-4 border-l-2 border-st-ready pl-3 text-sm">
          {notice}
        </p>
      )}
      {(create.isError ||
        configure.isError ||
        rotate.isError ||
        revoke.isError ||
        test.isError) && (
        <p role="alert" className="mt-4 text-sm text-st-maint">
          No se pudo completar la operación. Revisa permisos, correspondencias y vuelve a
          intentarlo.
        </p>
      )}
      <div className="mt-6 space-y-4">
        {data.integrations.length === 0 && (
          <div className="border border-dashed p-5 text-sm text-muted-foreground">
            Todavía no hay integraciones propias. Crea una para generar su endpoint y sus
            credenciales.
          </div>
        )}
        {data.integrations.map((integration) => (
          <article key={integration.id} className="border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{integration.name}</h3>
                  <Pill
                    className={
                      integration.status === "active"
                        ? "bg-st-ready/15 text-st-ready"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {integration.status === "active" ? "ACTIVA" : "REVOCADA"}
                  </Pill>
                </div>
                <p className="mt-1 break-all text-xs text-muted-foreground">
                  {integration.keyPrefix}… · versión {integration.credentialVersion} ·{" "}
                  {integration.hotelId}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || integration.status !== "active"}
                  onClick={() => test.mutate(integration.id)}
                >
                  {test.isPending ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-4" />
                  )}
                  Probar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || integration.status !== "active"}
                  onClick={() => openConfigure(integration)}
                >
                  <Settings2 className="size-4" />
                  Configurar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || integration.status !== "active"}
                  onClick={() => rotate.mutate(integration.id)}
                >
                  <RotateCcw className="size-4" />
                  Rotar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || integration.status !== "active"}
                  onClick={() => {
                    if (
                      window.confirm(
                        "¿Revocar esta credencial? Las reservas guardadas no se borrarán.",
                      )
                    )
                      revoke.mutate(integration.id);
                  }}
                >
                  <Ban className="size-4" />
                  Revocar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDocs(integration)}>
                  <BookOpen className="size-4" />
                  Documentación
                </Button>
              </div>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-xs text-muted-foreground">Propiedad externa</dt>
                <dd className="break-all">{integration.propertyId}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Creada</dt>
                <dd>{dateText(integration.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Último uso</dt>
                <dd>{dateText(integration.lastUsedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Límite</dt>
                <dd>{integration.requestLimitPerMinute} peticiones/min</dd>
              </div>
            </dl>
            <p className="mt-3 break-all text-xs text-muted-foreground">
              POST {origin}
              {integration.endpoint}
            </p>
            <p className="mt-2 text-xs">
              {integration.permissions.map((p) => permissionLabels[p]).join(" · ")}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Mapeo de habitaciones:{" "}
              {integration.roomMappings.length
                ? integration.roomMappings
                    .map((m) => `${m.externalCode} → ${m.roomNumber}`)
                    .join(" · ")
                : "Sin configurar: las reservas quedarán pendientes de correspondencia."}
            </p>
          </article>
        ))}
      </div>
      <div className="mt-7 border-t pt-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Activity className="size-4" />
          Actividad y registros
        </h3>
        {data.events.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Sin peticiones registradas.</p>
        ) : (
          <ul className="mt-2 divide-y text-sm">
            {data.events.slice(0, 25).map((event) => (
              <li key={event.id} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0 break-words">
                  <span className="font-medium">{event.eventType}</span> · {event.eventId}
                  {event.reservationId ? ` · ${event.reservationId}` : ""}
                  {event.errorCode ? ` · ${event.errorCode}` : ""}
                  <span className="block text-xs text-muted-foreground">
                    {dateText(event.receivedAt)} · intentos {event.attempts}
                    {event.httpStatus ? ` · HTTP ${event.httpStatus}` : ""}
                  </span>
                </div>
                <Pill
                  className={
                    event.status === "rejected"
                      ? "bg-st-maint/10 text-st-maint"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {statusLabels[event.status] ?? event.status}
                </Pill>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Configurar integración API" : "Crear integración API"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="api-name">Nombre</Label>
              <Input
                id="api-name"
                value={form.name}
                maxLength={100}
                placeholder="Motor de reservas del hotel"
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <fieldset>
              <legend className="text-sm font-medium">Permisos de esta credencial</legend>
              <div className="mt-2 space-y-2">
                {suiteApiPermissions.map((permission) => (
                  <label key={permission} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.permissions.includes(permission)}
                      onChange={() => togglePermission(permission)}
                    />
                    {permissionLabels[permission]}
                    <span className="text-xs text-muted-foreground">{permission}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-2">
              <Label htmlFor="api-mappings">Mapeo de habitaciones (una por línea)</Label>
              <Textarea
                id="api-mappings"
                value={form.mappingsText}
                onChange={(e) => setForm({ ...form, mappingsText: e.target.value })}
                placeholder={"DBL-STD=101\nDBL-SUP=201"}
                rows={5}
              />
              <p className="text-xs text-muted-foreground">
                El código externo se relaciona con una habitación interna existente. No se asignan
                habitaciones desconocidas.
              </p>
            </div>
            {formError && (
              <p role="alert" className="text-sm text-st-maint">
                {formError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button disabled={busy} onClick={submit}>
                {busy ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                {editing ? "Guardar configuración" : "Crear y generar claves"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!secrets}
        onOpenChange={(open) => {
          if (!open) setSecrets(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Guarda estas credenciales ahora</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Por seguridad no volverán a mostrarse. La API Key y el secreto de firma son distintos de
            las credenciales de cualquier proveedor externo.
          </p>
          {secrets && (
            <div className="mt-4 space-y-4">
              {(
                [
                  ["API Key", secrets.apiKey],
                  ["Secreto de firma", secrets.signingSecret],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <Label>{label}</Label>
                  <div className="mt-1 flex gap-2">
                    <code className="min-w-0 flex-1 break-all rounded-md bg-muted p-3 text-xs">
                      {value}
                    </code>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      aria-label={`Copiar ${label}`}
                      onClick={() => {
                        void navigator.clipboard?.writeText(value);
                      }}
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <p className="break-all text-xs text-muted-foreground">
                Endpoint: {origin}
                {secrets.integration.endpoint}
              </p>
              <Button className="w-full" onClick={() => setSecrets(null)}>
                Entendido, las he guardado
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!docs}
        onOpenChange={(open) => {
          if (!open) setDocs(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Documentación · {docs?.name}</DialogTitle>
          </DialogHeader>
          {docs && (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                Endpoints implementados para esta integración. Todas las peticiones exigen API Key,
                timestamp y firma HMAC-SHA256.
              </p>
              <div className="border p-3">
                <strong>Recibir reservas</strong>
                <p className="mt-1 break-all font-mono text-xs">
                  POST {origin}
                  {docs.endpoint}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Permiso: reservations:write · Respuesta 200: aplicada, duplicada o ignorada · 422:
                  validación o disponibilidad rechazada.
                </p>
              </div>
              <div className="border p-3">
                <strong>Consultar reservas</strong>
                <p className="mt-1 break-all font-mono text-xs">
                  GET {origin}
                  {docs.endpoint}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Permiso: reservations:read · No incluye datos personales del huésped.
                </p>
              </div>
              <div className="border p-3">
                <strong>Consultar disponibilidad</strong>
                <p className="mt-1 break-all font-mono text-xs">
                  GET {origin}
                  {docs.endpoint.replace("/reservations", "/availability")}?date=2027-01-15
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Permiso: availability:read · Usa las reservas y habitaciones persistidas del PMS.
                </p>
              </div>
              <div>
                <strong>Cabeceras</strong>
                <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">{`Authorization: Bearer <API_KEY>\nX-Suite-Timestamp: <unix_seconds>\nX-Suite-Signature-256: sha256=<HMAC_SHA256(timestamp + "." + cuerpo, SIGNING_SECRET)>\nIdempotency-Key: <event_id>`}</pre>
              </div>
              <div>
                <strong>Ejemplo de reserva</strong>
                <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(
                    {
                      event_id: "evt-001",
                      event_type: "booking.created",
                      booking_revision: {
                        id: 1,
                        booking_code: "EXT-001",
                        property_id: docs.propertyId,
                        revision_type: "created",
                        created_at: "2027-01-01T10:00:00Z",
                        payload: {
                          status: "CREATED",
                          checkin_date: "2027-01-15",
                          checkout_date: "2027-01-17",
                          total_amount: 240,
                          currency: "EUR",
                          client: { name: "Nombre del huésped" },
                          booking_items: [
                            {
                              ext_room_id:
                                docs.roomMappings[0]?.externalCode ?? "CODIGO_HABITACION",
                              num_adults: 2,
                            },
                          ],
                        },
                      },
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
              <p className="text-xs text-muted-foreground">
                Errores: 401 credencial/firma · 403 permiso · 409 evento repetido con otro contenido
                · 413 cuerpo demasiado grande · 429 límite · 503 fallo recuperable.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
