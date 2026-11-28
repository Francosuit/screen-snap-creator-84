import { useState } from 'react';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { ArrowDownToLine, LoaderCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pill } from './ui';
import { inboundStatus, sendTestRevision } from '@/lib/suite/api/inbound.functions';

const reasons: Record<string, string> = {
  property_mismatch: 'La propiedad no corresponde a este hotel', invalid_payload: 'Formato de reserva no válido', invalid_dates: 'Fechas no válidas',
  currency_unsupported: 'Moneda no admitida', multi_room_unsupported: 'Reservas de varias habitaciones aún no admitidas', room_type_unmapped: 'Tipo de habitación sin correspondencia',
  no_room_available: 'Sin habitación libre de ese tipo (sobreventa evitada)', capacity_exceeded: 'Supera la capacidad de la habitación', stay_in_progress: 'Estancia en curso: revisión manual en recepción',
  hotel_mismatch: 'Hotel u organización no coinciden', write_conflict: 'Cambio simultáneo: reintentar', request_pending: 'Solicitud pendiente: no bloquea habitación',
  unknown_booking: 'Reserva desconocida', past_stay: 'Estancia ya terminada',
};
const statusLabel: Record<string, string> = { applied: 'Guardada', duplicate: 'Duplicado ignorado', ignored: 'Ignorada', rejected: 'Rechazada' };
/** Validation errors arrive as a serialized issue list; show only the first readable message. */
const errorText = (e: unknown) => {
  const m = e instanceof Error ? e.message : '';
  try { const issues = JSON.parse(m) as { message?: string }[]; if (Array.isArray(issues) && issues[0]?.message) return issues[0].message; } catch { /* plain message */ }
  return m || 'No se pudo enviar.';
};
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const plus = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };

export const inboundQuery = (hotelId: string, identity: string, fn: (o: { data: { hotelId: string } }) => ReturnType<typeof inboundStatus>) =>
  queryOptions({ queryKey: ['hotel-api-inbound', hotelId, identity], queryFn: () => fn({ data: { hotelId } }), staleTime: 0, retry: false, refetchOnWindowFocus: false });

export function InboundPanel({ hotelId, identity, timezone }: { hotelId: string; identity: string; timezone: string }) {
  const status = useServerFn(inboundStatus);
  const send = useServerFn(sendTestRevision);
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery(inboundQuery(hotelId, identity, status));
  const [form, setForm] = useState({ guestName: 'PRUEBA API', checkIn: plus(3), checkOut: plus(5), adults: 2, roomCode: 'DBL-STD', amount: 240 });
  const [booking, setBooking] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (action: 'create' | 'modify' | 'cancel') => send({ data: { hotelId, action, ...form, ...(action === 'create' ? {} : { bookingCode: booking ?? undefined }) } }),
    onSuccess: r => { if (r.result['status'] !== 'rejected') setBooking(r.bookingCode); void qc.invalidateQueries({ queryKey: ['hotel-api-inbound', hotelId] }); },
    retry: false,
  });
  if (isLoading) return <p role="status" className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />Comprobando recepción de reservas…</p>;
  if (isError || !data) return <p role="alert" className="mt-5 text-sm text-st-maint">No se pudo leer la recepción de reservas.</p>;
  const r = mutation.data?.result;
  return <div className="mt-6 border-t pt-5">
    <div className="flex flex-wrap items-center gap-2"><h3 className="flex items-center gap-2 text-base font-semibold"><ArrowDownToLine className="size-4" />Recepción de reservas por API</h3>
      {data.mode === 'test' ? <Pill className="bg-st-ready/15 text-st-ready">ACTIVA · ENTORNO AISLADO</Pill> : data.mode === 'staging' ? <Pill>STAGING</Pill> : <Pill className="bg-muted text-muted-foreground">NO ACTIVADA</Pill>}</div>
    <p className="mt-1 break-all text-xs text-muted-foreground">Dirección de recepción: {data.endpoint} · firma X-Qc-Signature-256 obligatoria</p>
    {data.mode === 'none' && <p className="mt-3 text-sm">Este hotel no tiene una propiedad externa asociada para recibir reservas.</p>}
    {data.mode !== 'none' && <p className="mt-2 text-sm">Propiedad {data.propertyId} · {data.roomTypes.map(t => `${t.code} → ${t.type}`).join(' · ')}</p>}
    {data.mode === 'test' && <form className="mt-4 grid gap-3 sm:grid-cols-3" onSubmit={e => { e.preventDefault(); mutation.mutate('create'); }}>
      <p className="text-xs text-muted-foreground sm:col-span-3">Envía una reserva con el formato oficial de Quendoo, firmada como la enviaría el proveedor. Recorre la misma recepción, validación y guardado que una reserva real.</p>
      <div className="grid gap-1"><Label htmlFor="ib-name">Huésped</Label><Input id="ib-name" value={form.guestName} maxLength={120} onChange={e => setForm({ ...form, guestName: e.target.value })} /></div>
      <div className="grid gap-1"><Label htmlFor="ib-in">Entrada</Label><Input id="ib-in" type="date" value={form.checkIn} onChange={e => setForm({ ...form, checkIn: e.target.value })} /></div>
      <div className="grid gap-1"><Label htmlFor="ib-out">Salida</Label><Input id="ib-out" type="date" value={form.checkOut} onChange={e => setForm({ ...form, checkOut: e.target.value })} /></div>
      <div className="grid gap-1"><Label htmlFor="ib-room">Tipo (código externo)</Label><select id="ib-room" className="h-9 rounded-md border bg-background px-2 text-sm" value={form.roomCode} onChange={e => setForm({ ...form, roomCode: e.target.value })}>{data.roomTypes.map(t => <option key={t.code} value={t.code}>{t.code} · {t.type}</option>)}</select></div>
      <div className="grid gap-1"><Label htmlFor="ib-pax">Adultos</Label><Input id="ib-pax" type="number" min={1} max={10} value={form.adults} onChange={e => setForm({ ...form, adults: Number(e.target.value) })} /></div>
      <div className="grid gap-1"><Label htmlFor="ib-amount">Importe total (€)</Label><Input id="ib-amount" type="number" min={0} value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} /></div>
      <div className="flex flex-wrap gap-2 sm:col-span-3">
        <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : <Send className="size-4" />}Enviar reserva nueva</Button>
        <Button type="button" variant="outline" disabled={!/^SBX-[A-Z0-9]{6}$/.test(booking ?? '') || mutation.isPending} onClick={() => mutation.mutate('modify')}>Enviar modificación</Button>
        <Button type="button" variant="outline" disabled={!/^SBX-[A-Z0-9]{6}$/.test(booking ?? '') || mutation.isPending} onClick={() => mutation.mutate('cancel')}>Enviar cancelación</Button>
      </div>
      <div className="grid gap-1 sm:col-span-3 sm:max-w-xs"><Label htmlFor="ib-code">Código de reserva externa (para modificar o cancelar)</Label><Input id="ib-code" value={booking ?? ''} placeholder="SBX-XXXXXX" maxLength={10} onChange={e => setBooking(e.target.value.toUpperCase() || null)} /></div>
      <p className="text-xs text-muted-foreground sm:col-span-3">La modificación envía las fechas y datos del formulario para ese código.</p>
    </form>}
    {mutation.isError && <p role="alert" className="mt-3 text-sm text-st-maint">{errorText(mutation.error)}</p>}
    {r && <p role="status" className="mt-3 text-sm">Respuesta {mutation.data?.httpStatus}: {statusLabel[String(r['status'])] ?? String(r['status'])}{r['room'] ? ` · habitación ${String(r['room'])}` : ''}{r['reservationId'] ? ` · ${String(r['reservationId'])}` : ''}{r['reason'] ? ` · ${reasons[String(r['reason'])] ?? String(r['reason'])}` : ''}</p>}
    <h4 className="mt-5 text-sm font-semibold">Registro de sincronización</h4>
    {data.log.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Sin reservas recibidas todavía.</p> :
      <ul className="mt-2 divide-y text-sm">{data.log.map(e => <li key={`${e.revisionId}-${e.at}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 py-2">
        <span className="min-w-0 break-words">{e.bookingCode ?? '—'} · {e.revisionType ?? '—'}{e.room ? ` · hab. ${e.room}` : ''}{e.reason ? ` · ${reasons[e.reason] ?? e.reason}` : ''}<span className="block text-xs text-muted-foreground">{new Date(e.at).toLocaleString('es', { timeZone: timezone })} · rev {e.revisionId}</span></span>
        <span className="shrink-0 text-xs">{statusLabel[e.status] ?? e.status}</span></li>)}</ul>}
  </div>;
}
