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
      const index = rows.findIndex(row => String(row.id ?? row.number) === change.id);
      if (index >= 0) rows.splice(index, 1);
      if (change.after) rows.push(structuredClone(change.after));
    }
  });
});
afterEach(cleanup);
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