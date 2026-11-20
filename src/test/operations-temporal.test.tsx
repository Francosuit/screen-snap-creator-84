import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SuiteProvider, useSuite } from '@/lib/suite/store';
import type { Reservation } from '@/lib/suite/data';
import type { Operations } from '@/lib/suite/operations';

const mock = vi.hoisted(() => ({ real: true, stored: {} as Operations, save: vi.fn(), timezone: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: {
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    getSession: async () => ({ data: { session: mock.real ? { user: { id: 'temporal-user' } } : null } }),
    getUser: async () => ({ data: { user: { id: 'temporal-user', email: 'temporal@example.test' } } }),
  },
  from: (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === 'profiles' ? { display_name: 'Prueba Temporal' } : null, error: null }) }) }) }),
} }));
vi.mock('@/lib/suite/cloud', () => ({
  loadConfig: async () => ({
    hotels: [{ id: 'temporal-hotel', key: 'temporal', name: 'Hotel temporal aislado', org_owner: 'other-owner', archived: false }],
    rooms: [
      { hotel_id: 'temporal-hotel', number: '101', floor: 1, type: 'Doble', rate: 120 },
      { hotel_id: 'temporal-hotel', number: '102', floor: 1, type: 'Doble', rate: 120 },
    ],
    floors: [],
  }),
  myMemberships: async () => [{ hotel_id: 'temporal-hotel', role: 'director', modules: null }],
  overlayHotel: (hotel: unknown, rooms: unknown) => ({ hotel, rooms }), saveRoomConfig: vi.fn(), saveHotelTimezone: (...args: unknown[]) => mock.timezone(...args), persistHotelTimezones: async () => false,
}));
vi.mock('@/lib/suite/operations', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/suite/operations')>(),
  loadOperations: async () => structuredClone(mock.stored),
  saveOperations: (...args: unknown[]) => mock.save(...args),
}));

const reservation = (overrides: Partial<Reservation>): Reservation => ({
  id: 'r-base', guestId: 'g-test', room: '101', inDay: 6, outDay: 9, eta: '—', pax: 2,
  channel: 'Recepción', amount: 360, status: 'confirmed', stay: 'inhouse', notes: '', createdDay: 5,
  ...overrides,
});

async function mount() {
  const hook = renderHook(useSuite, { wrapper: SuiteProvider });
  await waitFor(() => expect(mock.real ? hook.result.current.authReady : hook.result.current.ready).toBe(true));
  return hook;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-11-18T08:00:00Z')); // Madrid: 18/11/2026, desplazamiento 8.
  localStorage.clear();
  mock.real = true;
  mock.save.mockReset();
  mock.timezone.mockReset();
  mock.stored = {
    guests: [
      { id: 'g-test', name: 'Huésped Actual', doc: '—', phone: '—', email: '—', lang: '—', country: '—', companions: [], notes: '', messaging: true },
      { id: 'g-next', name: 'Huésped Siguiente', doc: '—', phone: '—', email: '—', lang: '—', country: '—', companions: [], notes: '', messaging: false },
    ],
    reservations: [
      reservation({}),
      reservation({ id: 'r-next', guestId: 'g-next', inDay: 9, outDay: 11, stay: 'none', eta: '15:00', amount: 240 }),
    ],
    tasks: [], incidents: [],
    room_operations: [
      { number: '101', hk: 'clean', oos: false },
      { number: '102', hk: 'clean', oos: false },
    ],
  };
  mock.save.mockImplementation(async (_hotel, changes) => {
    for (const change of changes) {
      const rows = mock.stored[change.entity as keyof Operations] as Array<Record<string, unknown>>;
      const index = rows.findIndex(row => String(row['id'] ?? row['number']) === change.id);
      if (index >= 0) rows.splice(index, 1);
      if (change.after) rows.push(structuredClone(change.after));
    }
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('operaciones con el día real del hotel', () => {
  it('checkout crea limpieza fechada hoy, conserva desplazamientos y fija la llegada de mañana', async () => {
    const { result } = await mount();
    await act(async () => { expect(result.current.actions.checkOut('r-base')).toBe(true); });
    const task = result.current.s.tasks[0];
    expect(task).toMatchObject({ day: 8, taskDate: '2026-11-18', nextCheckIn: '2026-11-19 15:00', status: 'pendiente' });
    expect(result.current.s.reservations.find(r => r.id === 'r-base')).toMatchObject({ inDay: 6, outDay: 8, createdDay: 5, stay: 'finished' });
    expect(result.current.s.rooms.find(r => r.number === '101')?.hk).toBe('dirty');
    await waitFor(() => expect(mock.stored.tasks[0]).toMatchObject({ day: 8, taskDate: '2026-11-18' }));
    // La reserva antigua no se convierte de forma implícita antes de la migración aprobada.
    expect(mock.stored.reservations.find(r => r.id === 'r-base')?.checkInDate).toBeUndefined();
  });

  it('incidencias y limpiezas del hotel digital guardan la fecha real sin perder el desplazamiento', async () => {
    const { result } = await mount();
    await act(async () => {
      expect(result.current.actions.reportIssue({ room: '101', category: 'Electricidad', description: 'PRUEBA TEMPORAL', photo: false, blocking: false })).toBe(true);
      expect(result.current.actions.roomOp('102', 'dirty')).toBe(true);
    });
    expect(result.current.s.tasks).toHaveLength(2);
    for (const task of result.current.s.tasks) expect(task).toMatchObject({ day: 8, taskDate: '2026-11-18' });
    await waitFor(() => expect(mock.stored.tasks).toHaveLength(2));
    expect(mock.stored.tasks.every(task => task.day === 8 && task.taskDate === '2026-11-18')).toBe(true);
  });

  it('las alertas cuentan la llegada de hoy y no una llegada del día demo', async () => {
    mock.stored.reservations = [
      reservation({ id: 'r-today', inDay: 8, outDay: 10, stay: 'none', eta: '09:00' }),
      reservation({ id: 'r-old', room: '102', inDay: 0, outDay: 2, stay: 'none', eta: '09:00' }),
    ];
    mock.stored.room_operations = mock.stored.room_operations.map(room => ({ ...room, hk: 'dirty' }));
    const { result } = await mount();
    expect(result.current.alerts.filter(alert => alert.id.startsWith('a-ci-')).map(alert => alert.id)).toEqual(['a-ci-r-today']);
  });

  it('reserva manual y cambio de estancia mantienen ambos formatos y persisten tras recargar', async () => {
    const first = await mount();
    let id = '';
    await act(async () => {
      expect(first.result.current.actions.createReservation({ name: 'Reserva Temporal', room: '102', inDay: 9, outDay: 11, pax: 2, notes: 'PRUEBA' })).toBe(true);
    });
    const created = first.result.current.s.reservations.find(r => r.room === '102');
    if (!created) throw new Error('Falta la reserva creada');
    id = created.id;
    expect(created).toMatchObject({ inDay: 9, outDay: 11, createdDay: 8, checkInDate: '2026-11-19', checkOutDate: '2026-11-21', createdDate: '2026-11-18' });
    await act(async () => { expect(first.result.current.actions.changeStay(id, 12)).toBe(true); });
    expect(first.result.current.s.reservations.find(r => r.id === id)).toMatchObject({ inDay: 9, outDay: 12, createdDay: 8, checkInDate: '2026-11-19', checkOutDate: '2026-11-22', createdDate: '2026-11-18', amount: 360 });
    await waitFor(() => expect(mock.stored.reservations.find(r => r.id === id)?.checkOutDate).toBe('2026-11-22'));
    first.unmount();
    const second = await mount();
    expect(second.result.current.s.reservations.find(r => r.id === id)).toMatchObject({ inDay: 9, outDay: 12, checkOutDate: '2026-11-22', createdDate: '2026-11-18' });
  });
});

describe('validaciones temporales imprescindibles', () => {
  it('rechaza reservas manuales pasadas, fraccionadas o sin noches', async () => {
    const { result } = await mount();
    const before = result.current.s.reservations.length;
    await act(async () => {
      expect(result.current.actions.createReservation({ name: 'Pasada', room: '102', inDay: 7, outDay: 9, pax: 2, notes: '' })).toBe(false);
      expect(result.current.actions.createReservation({ name: 'Fraccionada', room: '102', inDay: 8.5, outDay: 10, pax: 2, notes: '' })).toBe(false);
      expect(result.current.actions.createReservation({ name: 'Sin noches', room: '102', inDay: 8, outDay: 8, pax: 2, notes: '' })).toBe(false);
    });
    expect(result.current.s.reservations).toHaveLength(before);
    expect(mock.save).not.toHaveBeenCalled();
  });

  it('check-in exige una reserva confirmada y vigente hoy', async () => {
    mock.stored.reservations = [
      reservation({ id: 'r-future', inDay: 9, outDay: 11, stay: 'none' }),
      reservation({ id: 'r-expired', room: '102', inDay: 5, outDay: 7, stay: 'none' }),
      reservation({ id: 'r-current', inDay: 8, outDay: 10, stay: 'none' }),
    ];
    const { result } = await mount();
    await act(async () => {
      expect(result.current.actions.checkIn('r-future')).toBe(false);
      expect(result.current.actions.checkIn('r-expired')).toBe(false);
      expect(result.current.actions.checkIn('r-current')).toBe(true);
    });
    expect(result.current.s.reservations.find(r => r.id === 'r-current')?.stay).toBe('inhouse');
    expect(result.current.s.reservations.find(r => r.id === 'r-future')?.stay).toBe('none');
    expect(result.current.s.reservations.find(r => r.id === 'r-expired')?.stay).toBe('none');
  });

  it('checkout no convierte una estancia en cero noches', async () => {
    mock.stored.reservations = [reservation({ inDay: 8, outDay: 10, stay: 'inhouse' })];
    const { result } = await mount();
    await act(async () => { expect(result.current.actions.checkOut('r-base')).toBe(false); });
    expect(result.current.s.reservations[0]).toMatchObject({ stay: 'inhouse', inDay: 8, outDay: 10 });
    expect(mock.save).not.toHaveBeenCalled();
  });

  it('guarda la zona del hotel y recalcula día y hora sin alterar fechas de reservas', async () => {
    vi.setSystemTime(new Date('2026-11-18T23:30:00Z'));
    const { result } = await mount();
    const before = structuredClone(result.current.s.reservations);
    await act(async () => { expect(await result.current.actions.updateHotelTimezone('America/New_York')).toBe(true); });
    expect(mock.timezone).toHaveBeenCalledWith('temporal-hotel', 'America/New_York');
    expect(result.current.timeZone).toBe('America/New_York');
    expect(result.current.todayYmd).toBe('2026-11-18');
    expect(result.current.hotelClock).toBe('18:30');
    expect(result.current.s.reservations).toEqual(before);
  });

  it('no cambia la zona local si el guardado falla', async () => {
    mock.timezone.mockRejectedValueOnce(new Error('sin permiso'));
    const { result } = await mount();
    await act(async () => { expect(await result.current.actions.updateHotelTimezone('America/New_York')).toBe(false); });
    expect(result.current.timeZone).toBe('Europe/Madrid');
    expect(result.current.todayYmd).toBe('2026-11-18');
  });
});

describe('la demostración conserva su reloj separado', () => {
  it('checkout, incidencias y hotel digital usan el día 0 sin fechas de producción', async () => {
    mock.real = false;
    const { result } = await mount();
    const current = result.current.s.reservations.find(r => r.stay === 'inhouse');
    if (!current) throw new Error('Falta estancia demo');
    await act(async () => {
      result.current.actions.checkOut(current.id);
      result.current.actions.reportIssue({ room: '101', category: 'Electricidad', description: 'PRUEBA DEMO', photo: false, blocking: false });
      result.current.actions.roomOp('102', 'dirty');
    });
    const created = result.current.s.tasks.filter(task => task.day === 0);
    expect(created.length).toBeGreaterThanOrEqual(3);
    expect(created.every(task => task.taskDate === undefined)).toBe(true);
    expect(result.current.s.reservations.every(r => r.checkInDate === undefined && r.checkOutDate === undefined && r.createdDate === undefined)).toBe(true);
    expect(mock.save).not.toHaveBeenCalled();
  });

  it('reserva manual y alertas de demo siguen ancladas al 10/11/2026', async () => {
    mock.real = false;
    const { result } = await mount();
    await act(async () => {
      expect(result.current.actions.createReservation({ name: 'Reserva Demo', room: '305', inDay: 1, outDay: 3, pax: 2, notes: '' })).toBe(true);
    });
    const created = result.current.s.reservations.find(r => r.room === '305' && r.inDay === 1);
    expect(created).toMatchObject({ inDay: 1, outDay: 3, createdDay: 0 });
    expect(created?.checkInDate).toBeUndefined();
    expect(result.current.alerts.some(alert => alert.id === 'a-ci-R-2044')).toBe(true);
    expect(result.current.today).toBe(0);
    expect(result.current.todayYmd).toBe('2026-11-10');
  });

  it('cambiar la zona demo no altera su fecha ni escribe en Cloud', async () => {
    mock.real = false;
    const { result } = await mount();
    await act(async () => { expect(await result.current.actions.updateHotelTimezone('Asia/Tokyo')).toBe(true); });
    expect(result.current.timeZone).toBe('Asia/Tokyo');
    expect(result.current.todayYmd).toBe('2026-11-10');
    expect(mock.timezone).not.toHaveBeenCalled();
    expect(mock.save).not.toHaveBeenCalled();
  });
});
