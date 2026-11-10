import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { SuiteProvider, useSuite } from '@/lib/suite/store';
import { operationSnapshot, overlayOperations, operationChanges, type Operations } from '@/lib/suite/operations';

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
  overlayHotel: (hotel: unknown, rooms: unknown) => ({ hotel, rooms }), saveRoomConfig: vi.fn(),
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
    expect(result.current.s.clock).toBe(clock + 1);
    expect(result.current.s.rooms.find(r => r.number === room)?.hk).toBe('cleaning');
    await act(async () => {
      result.current.actions.roomOp(room, 'dirty');
      result.current.actions.finishTask(task.id);
      result.current.actions.finishTask(task.id);
      result.current.actions.startTask(task.id);
    });
    expect(result.current.s.clock).toBe(clock + 2);
    expect(result.current.s.rooms.find(r => r.number === room)?.hk).toBe('clean');
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