import { act, cleanup, renderHook, waitFor, render, screen, fireEvent } from '@testing-library/react';
import { GuestEditor } from '@/components/suite/GuestEditor';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { SuiteProvider, useSuite } from '@/lib/suite/store';
import { operationSnapshot, overlayOperations, operationChanges, type Operations } from '@/lib/suite/operations';
import { todayOffset } from '@/lib/suite/clock';

const mock = vi.hoisted(() => ({ real: true, stored: {} as Operations, save: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: {
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    getSession: async () => ({ data: { session: mock.real ? { user: { id: 'isolated-user' } } : null } }),
    getUser: async () => ({ data: { user: { id: 'isolated-user', email: 'test@example.test' } } }),
  },
  from: (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === 'profiles' ? { display_name: 'Usuario Prueba' } : null, error: null }) }) }) }),
} }));
vi.mock('@/lib/suite/cloud', () => ({
  loadConfig: async () => ({ hotels: [{ id: 'isolated-hotel', key: 'isolated', name: 'Prueba aislada', org_owner: 'other-owner', archived: false }], rooms: [{ hotel_id: 'isolated-hotel', number: '101', floor: 1, type: 'Doble', rate: 120 }], floors: [] }),
  myMemberships: async () => [{ hotel_id: 'isolated-hotel', role: 'director', modules: null }],
  overlayHotel: (hotel: unknown, rooms: unknown) => ({ hotel, rooms }), saveRoomConfig: vi.fn(), saveHotelTimezone: vi.fn(), persistHotelTimezones: async () => false,
}));
vi.mock('@/lib/suite/operations', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/suite/operations')>(),
  loadOperations: async () => structuredClone(mock.stored),
  saveOperations: (...args: unknown[]) => mock.save(...args),
}));

beforeEach(() => {
  localStorage.clear(); mock.real = true; mock.save.mockReset();
  mock.stored = { guests: [{ id: 'g-test', name: 'Huésped Prueba', doc: '—', phone: '—', email: '—', lang: '—', country: '—', companions: [], notes: '', messaging: true }],
    reservations: [{ id: 'r-test', guestId: 'g-test', room: '101', inDay: -1, outDay: 0, stay: 'inhouse', status: 'confirmed', channel: 'Recepción', amount: 120, pax: 2, eta: '—', notes: '', createdDay: -1 }],
    tasks: [], incidents: [], room_operations: [{ number: '101', hk: 'clean', oos: false }] };
  mock.save.mockImplementation(async (_hotel, changes) => {
    for (const change of changes) {
      const rows = mock.stored[change.entity as keyof Operations] as Array<Record<string, unknown>>;
      const index = rows.findIndex(row => String(row['id'] ?? row['number']) === change.id);
      if (index >= 0) rows.splice(index, 1);
      if (change.after) rows.push(structuredClone(change.after));
    }
  });
});

describe('Sprint 02 — informes válidos', () => {
  it('rechaza una habitación ajena al hotel sin crear tarea ni incidencia', async () => {
    const { result } = await mount();
    act(() => { expect(result.current.actions.reportIssue({ room: '999', category: 'Otros', description: 'Problema', photo: false, blocking: false })).toBe(false); });
    expect(result.current.s.incidents).toHaveLength(0);
    expect(result.current.s.tasks).toHaveLength(0);
    expect(mock.save).not.toHaveBeenCalled();
  });
  it('rechaza descripción vacía y guarda una descripción válida sin espacios sobrantes', async () => {
    const { result } = await mount();
    act(() => { expect(result.current.actions.reportIssue({ room: '101', category: 'Otros', description: '   ', photo: false, blocking: false })).toBe(false); });
    expect(result.current.s.incidents).toHaveLength(0);
    await act(async () => { result.current.actions.reportIssue({ room: '101', category: 'Otros', description: '  Luz rota  ', photo: false, blocking: false }); });
    expect(mock.stored.incidents[0]?.description).toBe('Luz rota');
  });
});

describe('Sprint 02 — limpieza consistente', () => {
  it.each([true, false])('reutiliza limpieza abierta y bloquea repeticiones incluso en la misma llamada (real=%s)', async real => {
    mock.real = real;
    const { result } = await mount();
    const room = real ? '101' : result.current.s.rooms.find(r => !r.oos && !result.current.s.tasks.some(t => t.room === r.number && t.dept === 'housekeeping' && t.status !== 'completada'))?.number ?? '';
    const before = result.current.s.tasks.filter(t => t.room === room).length;
    await act(async () => {
      result.current.actions.roomOp(room, 'dirty');
      result.current.actions.roomOp(room, 'dirty');
    });
    expect(result.current.s.tasks.filter(t => t.room === room)).toHaveLength(before + 1);
    const task = result.current.s.tasks.find(t => t.room === room && t.status === 'pendiente');
    if (!task) throw new Error('Missing cleaning');
    const clock = result.current.s.clock;
    await act(async () => {
      result.current.actions.finishTask(task.id);
      result.current.actions.startTask(task.id);
      result.current.actions.startTask(task.id);
    });
    expect(result.current.s.clock).toBe(clock + (real ? 0 : 1));
    expect(result.current.s.rooms.find(r => r.number === room)?.hk).toBe('cleaning');
    await act(async () => {
      result.current.actions.roomOp(room, 'dirty');
      result.current.actions.finishTask(task.id);
      result.current.actions.finishTask(task.id);
      result.current.actions.startTask(task.id);
    });
    expect(result.current.s.clock).toBe(clock + (real ? 0 : 2));
    expect(result.current.s.rooms.find(r => r.number === room)?.hk).toBe('inspect');
    await act(async () => { result.current.actions.roomOp(room, 'dirty'); });
    expect(result.current.s.tasks.filter(t => t.room === room)).toHaveLength(before + 2);
  });
  it('checkout repetido no duplica limpieza y reutiliza una tarea existente', async () => {
    const { result } = await mount();
    await act(async () => {
      result.current.actions.roomOp('101', 'dirty');
      result.current.actions.checkOut('r-test');
      result.current.actions.checkOut('r-test');
    });
    expect(result.current.s.tasks).toHaveLength(1);
    expect(result.current.s.reservations[0]?.stay).toBe('finished');
  });
});
afterEach(cleanup);
describe('Sprint 02 — operaciones honestas', () => {
  it.each([true, false])('check-in solo simula bienvenida en demo (real=%s)', async real => {
    mock.real = real;
    const arrivalDay = real ? todayOffset('real', 'Europe/Madrid') : 0;
    mock.stored.reservations = mock.stored.reservations.map(r => ({ ...r, stay: 'none', inDay: arrivalDay, outDay: arrivalDay + 2 }));
    const { result } = await mount();
    const reservation = result.current.s.reservations.find(r => r.stay === 'none' && ['ready', 'arrival'].includes(result.current.roomState(r.room)));
    if (!reservation) throw new Error('Missing arrival');
    const count = result.current.s.sent.length;
    await act(async () => { result.current.actions.checkIn(reservation.id); });
    expect(result.current.s.sent).toHaveLength(count + (real ? 0 : 1));
    expect(result.current.s.reservations.find(r => r.id === reservation.id)?.stay).toBe('inhouse');
  });
  it('cuenta real no guarda fotos ficticias ni simula envíos', async () => {
    const { result } = await mount();
    await act(async () => {
      result.current.actions.reportIssue({ room: '101', category: 'Otros', description: 'Problema', photo: true, blocking: false });
      result.current.actions.simulateRule('m1');
    });
    expect(mock.stored.incidents[0]?.photo).toBe(false);
    expect(result.current.s.sent).toHaveLength(0);
  });
});
it('ficha de huésped guarda desde el formulario y lee el resultado tras remontar', async () => {
  function Harness() {
    const suite = useSuite();
    const guest = suite.s.guests.find(g => g.id === 'g-test');
    return suite.authReady && guest ? <GuestEditor guest={guest} onClose={() => {}} /> : null;
  }
  const first = render(<SuiteProvider><Harness /></SuiteProvider>);
  const name = await screen.findByLabelText('Nombre');
  fireEvent.change(name, { target: { value: 'Nombre Formulario' } });
  fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'form@example.test' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Guardar' })); });
  expect(mock.stored.guests[0]?.name).toBe('Nombre Formulario');
  first.unmount();
  render(<SuiteProvider><Harness /></SuiteProvider>);
  expect(await screen.findByLabelText('Nombre')).toHaveValue('Nombre Formulario');
  expect(screen.getByLabelText('Correo')).toHaveValue('form@example.test');
});
describe('Sprint 02 — ficha persistente', () => {
  it('edita los seis campos, conserva identidad/reserva y los recupera tras recarga aislada', async () => {
    const first = await mount();
    const fields = { name: 'Nombre Editado', doc: 'DOC-123', phone: '+34 600123123', email: 'guest@example.test', lang: 'Inglés', notes: 'Nota real' };
    await act(async () => { expect(first.result.current.actions.updateGuest('g-test', fields)).toBe(true); });
    expect(mock.stored.guests[0]).toMatchObject({ id: 'g-test', ...fields });
    expect(mock.stored.reservations[0]?.guestId).toBe('g-test');
    first.unmount();
    const second = await mount();
    expect(second.result.current.s.guests[0]).toMatchObject(fields);
  });
  it('rechaza nombres vacíos y huéspedes ausentes sin guardar', async () => {
    const { result } = await mount();
    const fields = { name: '', doc: '', phone: '', email: '', lang: '', notes: '' };
    act(() => {
      expect(result.current.actions.updateGuest('g-test', fields)).toBe(false);
      expect(result.current.actions.updateGuest('unknown', { ...fields, name: 'Nombre' })).toBe(false);
    });
    expect(mock.save).not.toHaveBeenCalled();
  });
});
async function mount() {
  const hook = renderHook(useSuite, { wrapper: SuiteProvider });
  await waitFor(() => expect(mock.real ? hook.result.current.authReady : hook.result.current.ready).toBe(true));
  return hook;
}

describe('Sprint 02 — personal sin inventar', () => {
  it('checkout real crea limpieza pendiente sin responsable y conserva estancia/habitación', async () => {
    const { result } = await mount();
    act(() => result.current.actions.checkOut('r-test'));
    expect(result.current.s.tasks[0]?.assignee).toBe('');
    expect(result.current.s.reservations[0]?.stay).toBe('finished');
    expect(result.current.s.rooms[0]?.hk).toBe('dirty');
    await waitFor(() => expect(mock.stored.tasks[0]?.assignee).toBe(''));
  });
  it('solicitar limpieza real no asigna; empezar registra al usuario verificado', async () => {
    const { result } = await mount();
    act(() => result.current.actions.roomOp('101', 'dirty'));
    expect(result.current.s.tasks[0]?.assignee).toBe('');
    const task = result.current.s.tasks[0];
    if (!task) throw new Error('Missing task');
    act(() => result.current.actions.startTask(task.id));
    expect(result.current.s.tasks[0]?.assignee).toBe('Usuario Prueba');
  });
  it('limpieza directa iniciada registra al usuario real', async () => {
    const { result } = await mount();
    act(() => result.current.actions.roomOp('101', 'start'));
    expect(result.current.s.tasks[0]?.assignee).toBe('Usuario Prueba');
    expect(result.current.s.tasks[0]?.status).toBe('en_proceso');
  });
  it('incidencia real y tarea nacen sin Carlos Ruiz y la tarea toma al iniciador', async () => {
    const { result } = await mount();
    act(() => result.current.actions.reportIssue({ room: '101', category: 'Electricidad', description: 'Luz rota', photo: false, blocking: true }));
    expect(result.current.s.incidents[0]?.assignee).toBe('');
    expect(result.current.s.tasks[0]?.assignee).toBe('');
    const task = result.current.s.tasks[0];
    if (!task) throw new Error('Missing task');
    act(() => result.current.actions.startTask(task.id));
    expect(result.current.s.tasks[0]?.assignee).toBe('Usuario Prueba');
  });
  it('demo conserva María López en checkout y limpieza y Carlos Ruiz en incidencias', async () => {
    mock.real = false;
    const { result } = await mount();
    const reservation = result.current.s.reservations.find(r => r.stay === 'inhouse');
    if (!reservation) throw new Error('Missing demo stay');
    act(() => result.current.actions.checkOut(reservation.id));
    expect(result.current.s.tasks[0]?.assignee).toBe('María López');
    act(() => result.current.actions.roomOp('101', 'dirty'));
    expect(result.current.s.tasks[0]?.assignee).toBe('María López');
    act(() => result.current.actions.reportIssue({ room: '101', category: 'Electricidad', description: 'Luz rota', photo: false, blocking: false }));
    expect(result.current.s.incidents[0]?.assignee).toBe('Carlos Ruiz');
    expect(result.current.s.tasks[0]?.assignee).toBe('Carlos Ruiz');
    expect(mock.save).not.toHaveBeenCalled();
  });
  it('responsable nuevo viaja en el cambio operativo y se recupera tras recarga aislada', async () => {
    const first = await mount();
    act(() => first.result.current.actions.roomOp('101', 'start'));
    await waitFor(() => expect(mock.stored.tasks[0]?.assignee).toBe('Usuario Prueba'));
    expect(operationChanges(overlayOperations(first.result.current.s, { ...mock.stored, tasks: [] }), first.result.current.s).some(c => c.entity === 'tasks')).toBe(true);
    first.unmount();
    const second = await mount();
    expect(operationSnapshot(second.result.current.s).tasks[0]?.assignee).toBe('Usuario Prueba');
  });
});
describe('Sprint 05 — ciclo de limpieza con cronómetro', () => {
  it('registra inicio/fin persistidos, duración, revisión, devolución y nuevo ciclo sin sobrescribir', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-11-26T10:00:00Z') });
    try {
      const { result } = await mount();
      const hk = () => result.current.s.rooms.find(r => r.number === '101')?.hk;
      const resBefore = JSON.stringify(result.current.s.reservations);
      vi.setSystemTime(new Date('2026-11-26T10:00:00Z'));
      await act(async () => { result.current.actions.roomOp('101', 'start'); });
      const c1 = result.current.s.tasks.find(t => t.room === '101' && t.status === 'en_proceso');
      expect(c1?.startedIso).toBe('2026-11-26T10:00:00.000Z');
      expect(c1?.cleanedBy).toBeTruthy();
      expect(hk()).toBe('cleaning');
      expect(mock.stored.tasks.find(t => t.id === c1?.id)?.startedIso).toBe('2026-11-26T10:00:00.000Z');
      await act(async () => { expect(result.current.actions.roomOp('101', 'start')).toBe(false); });
      expect(result.current.s.tasks.filter(t => t.room === '101' && t.status === 'en_proceso')).toHaveLength(1);
      vi.setSystemTime(new Date('2026-11-26T10:25:30Z'));
      await act(async () => { result.current.actions.roomOp('101', 'finish'); });
      const done = result.current.s.tasks.find(t => t.id === c1?.id);
      expect(done?.durationSec).toBe(1530);
      expect(done?.endedIso).toBe('2026-11-26T10:25:30.000Z');
      expect(hk()).toBe('inspect');
      expect(result.current.roomState('101')).not.toBe('ready');
      await act(async () => { result.current.actions.roomOp('101', 'return', 'Baño sin reponer'); });
      expect(hk()).toBe('dirty');
      const old = result.current.s.tasks.find(t => t.id === c1?.id);
      expect(old?.returnReason).toBe('Baño sin reponer');
      expect(old?.durationSec).toBe(1530);
      vi.setSystemTime(new Date('2026-11-26T10:25:30Z'));
      await act(async () => { result.current.actions.roomOp('101', 'start'); });
      vi.setSystemTime(new Date('2026-11-26T10:40:30Z'));
      await act(async () => { result.current.actions.roomOp('101', 'finish'); });
      vi.setSystemTime(new Date('2026-11-26T10:40:30Z'));
      await act(async () => { result.current.actions.roomOp('101', 'approve'); });
      expect(hk()).toBe('clean');
      const cycles = result.current.s.tasks.filter(t => t.room === '101' && t.dept === 'housekeeping');
      expect(cycles).toHaveLength(2);
      expect(cycles.find(t => t.id !== c1?.id)?.durationSec).toBe(900);
      expect(cycles.find(t => t.id !== c1?.id)?.approvedIso).toBe('2026-11-26T10:40:30.000Z');
      expect(cycles.every(t => t.status === 'completada')).toBe(true);
      expect(JSON.stringify(result.current.s.reservations)).toBe(resBefore);
    } finally { vi.useRealTimers(); }
  });
  it('el cronómetro se calcula desde las horas guardadas', async () => {
    const { elapsed } = await import('@/components/suite/CleaningTimer');
    expect(elapsed('2026-11-26T10:00:00Z', '2026-11-26T11:02:03Z')).toBe('01:02:03');
    expect(elapsed('2026-11-26T10:00:00Z', undefined, Date.parse('2026-11-26T10:00:59Z'))).toBe('00:00:59');
  });
});
