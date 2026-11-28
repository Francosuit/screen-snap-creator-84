import { Component, Suspense, useState } from 'react';
import type { ReactNode } from 'react';
import { QueryErrorResetBoundary, queryOptions, useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { ArrowDownToLine, ArrowUpFromLine, ExternalLink, LoaderCircle, Plug, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pill } from './ui';
import { inspectHotelConnection, testHotelConnection } from '@/lib/suite/api/connection.functions';
import type { ConnectionSetup, SetupIssue } from '@/lib/suite/api/connection-contracts';

const issues: Record<SetupIssue, string> = {
  binding_missing: 'Falta asociar una propiedad de pruebas autorizada a este hotel: SUITE_QUENDOO_BINDINGS.',
  binding_invalid: 'La asociación de hotel, organización o propiedad no es válida. Revisar SUITE_QUENDOO_BINDINGS.',
  credentials_missing: 'Faltan credenciales de pruebas para este hotel: SUITE_QUENDOO_CREDENTIALS.',
  credentials_invalid: 'La configuración segura de este hotel no es válida. Revisar SUITE_QUENDOO_CREDENTIALS.',
};
const errorLabels = { provider_auth: 'El proveedor rechazó las credenciales o los permisos de esta propiedad.', rate_limit: 'El proveedor alcanzó su límite de consultas. Espera antes de reintentar.', unavailable: 'El proveedor no respondió correctamente. Reintenta más tarde.', invalid_data: 'La propiedad o su catálogo no coincide con el contrato esperado.', unknown: 'No se pudo completar la comprobación. Revisa la configuración y reintenta.' };

class ConnectionErrorBoundary extends Component<{ children: ReactNode; reset: () => void }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() {
    if (!this.state.failed) return this.props.children;
    return <div role="alert" className="border-y py-6"><p className="text-sm">No se pudo comprobar esta integración. Verifica tu sesión y los permisos de propietario o dirección.</p><Button className="mt-3" variant="outline" onClick={() => { this.props.reset(); this.setState({ failed: false }); }}><RefreshCw className="size-4" />Reintentar</Button></div>;
  }
}

export function IntegrationConsole({ hotelId, identity }: { hotelId: string; identity: string }) {
  return <QueryErrorResetBoundary>{({ reset }) => <ConnectionErrorBoundary key={`${hotelId}:${identity}`} reset={reset}><Suspense fallback={<div role="status" className="flex items-center gap-2 border-y py-8 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />Comprobando configuración del hotel…</div>}><HotelConsole hotelId={hotelId} identity={identity} /></Suspense></ConnectionErrorBoundary>}</QueryErrorResetBoundary>;
}

function HotelConsole({ hotelId, identity }: { hotelId: string; identity: string }) {
  const inspect = useServerFn(inspectHotelConnection);
  const test = useServerFn(testHotelConnection);
  const { data: setup, refetch, isFetching } = useSuspenseQuery(queryOptions({ queryKey: ['hotel-api-setup', hotelId, identity], queryFn: () => inspect({ data: { hotelId } }), staleTime: 0, retry: false, refetchOnWindowFocus: false }));
  const [connecting, setConnecting] = useState(false);
  const probe = useMutation({ mutationFn: () => test({ data: { hotelId } }), retry: false });
  const result = probe.data;
  const currentSetup: ConnectionSetup = result?.status === 'blocked' ? result.setup : setup;
  const busy = isFetching || probe.isPending;
  return <section className="border-y py-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">Quendoo Connect</h2><Pill className="bg-muted text-muted-foreground">NO CONECTADA</Pill><Pill>PRUEBAS</Pill></div><p className="text-sm text-muted-foreground">Conectividad externa · PMS central: Suite Hotel OS</p><p className="mt-1 break-words text-sm">{setup.hotelName}</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" size="icon" disabled={busy} aria-label="Actualizar configuración" title="Actualizar configuración" onClick={() => { probe.reset(); void refetch(); }}><RefreshCw className={`size-4 ${isFetching ? 'animate-spin motion-reduce:animate-none' : ''}`} /></Button><Button variant="outline" disabled={busy} onClick={() => setConnecting(true)}><Plug className="size-4" />Conectar</Button><Button disabled={busy} onClick={() => probe.mutate()}>{probe.isPending ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : <ShieldCheck className="size-4" />}Probar conexión</Button></div>
    </div>
    <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
      <div><dt className="text-xs text-muted-foreground">Autorización</dt><dd className="mt-1 text-sm">{currentSetup.state === 'configured' ? 'Configurada · pendiente de prueba' : currentSetup.state === 'configuration_error' ? 'Requiere intervención' : 'Pendiente de autorización'}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Propiedad externa</dt><dd className="mt-1 break-all text-sm">{currentSetup.propertyId ?? 'Sin asociar'}</dd></div>
      <div><dt className="flex items-center gap-1 text-xs text-muted-foreground"><ArrowDownToLine className="size-3" />Reservas entrantes</dt><dd className="mt-1 text-sm">No activadas</dd></div>
      <div><dt className="flex items-center gap-1 text-xs text-muted-foreground"><ArrowUpFromLine className="size-3" />Disponibilidad, tarifas y restricciones</dt><dd className="mt-1 text-sm">No activadas</dd></div>
    </dl>
    {currentSetup.issue && <div className="mt-5 border-l-2 border-st-dirty pl-3 text-sm">{issues[currentSetup.issue]}</div>}
    <p className="mt-3 text-xs text-muted-foreground">Activación y guardado de conexiones: pendiente de autorización. Ningún canal OTA está confirmado.</p>
    {probe.isError && <p role="alert" className="mt-4 text-sm text-st-maint">No se pudo comprobar la conexión. Verifica la sesión y reintenta.</p>}
    {result?.status === 'failed' && <div role="alert" className="mt-4 border-l-2 border-st-maint pl-3 text-sm"><p>{errorLabels[result.code]}</p><p className="mt-1 text-xs text-muted-foreground">Comprobación: {new Date(result.checkedAt).toLocaleString('es', { timeZone: setup.hotelTimezone })}</p></div>}
    {result?.status === 'verified' && <div className="mt-5 border-t pt-4"><h3 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4 text-st-ready" />Autenticación de pruebas verificada</h3><p className="mt-1 text-xs text-muted-foreground">{new Date(result.checkedAt).toLocaleString('es', { timeZone: setup.hotelTimezone })} · No activa sincronizaciones ni guarda reservas.</p><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-muted-foreground">Propiedad</dt><dd className="break-words">{result.property.name ?? result.property.id}</dd></div><div><dt className="text-muted-foreground">Moneda / modo</dt><dd>{result.property.currency} / {result.property.mode}</dd></div><div><dt className="text-muted-foreground">Zona horaria</dt><dd>{result.property.timezone}</dd></div></dl>{!result.timezoneMatches && <p role="alert" className="mt-3 text-sm text-st-maint">Zona horaria distinta de la del hotel: {setup.hotelTimezone}. Resolver antes de activar.</p>}<h4 className="mt-4 text-sm font-semibold">Catálogo autorizado</h4><div className="mt-2 grid gap-4 text-sm sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Tipos de habitación</p>{result.roomTypes.length ? result.roomTypes.map(r => <div key={r.id} className="break-words border-b py-2">{r.name} · {r.qty}<span className="block break-all text-xs text-muted-foreground">{r.id}</span></div>) : <p className="mt-2">Sin tipos de habitación.</p>}</div><div><p className="text-xs text-muted-foreground">Planes tarifarios</p>{result.ratePlans.length ? result.ratePlans.map(p => <div key={p.id} className="break-words border-b py-2">{p.name}<span className="block break-all text-xs text-muted-foreground">{p.id} → {p.room_type_id}</span></div>) : <p className="mt-2">Sin planes tarifarios.</p>}</div></div></div>}
    <Dialog open={connecting} onOpenChange={setConnecting}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Conectar Quendoo · entorno de pruebas</DialogTitle></DialogHeader><ol className="space-y-4 text-sm"><li><strong>1. Autorizar acceso de pruebas.</strong><p className="mt-1 text-muted-foreground">Quendoo entrega client_id y client_secret por solicitud; no ofrece alta OAuth automática.</p><Button asChild variant="outline" className="mt-2"><a href="mailto:office@quendoo.com?subject=Suite%20Hotel%20OS%20%E2%80%94%20sandbox%20Quendoo%20Connect"><ExternalLink className="size-4" />Solicitar acceso oficial</a></Button></li><li><strong>2. Asociar la propiedad autorizada.</strong><p className="mt-1 break-words text-muted-foreground">SUITE_QUENDOO_BINDINGS vincula hotel, organización y propiedad en staging. Configuración exclusiva del servidor.</p></li><li><strong>3. Cargar credenciales de forma segura.</strong><p className="mt-1 break-words text-muted-foreground">Ajustes del proyecto → Secrets → SUITE_QUENDOO_CREDENTIALS. No pegues tokens ni secretos en el chat.</p></li><li><strong>4. Probar conexión.</strong><p className="mt-1 text-muted-foreground">Comprobación autenticada de propiedad, tipos de habitación y planes tarifarios. La importación requiere guardado y correspondencias autorizados.</p></li></ol><div className="flex flex-wrap justify-end gap-2"><Button asChild variant="ghost"><a href="https://api.quendoo.com/v1/qc/docs/authentication.md" target="_blank" rel="noreferrer">Autorización oficial<ExternalLink className="size-4" /></a></Button><Button disabled={busy} onClick={() => { setConnecting(false); probe.mutate(); }}>Probar conexión</Button></div></DialogContent></Dialog>
  </section>;
}