import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getTerminalId: vi.fn(),
  getActiveSession: vi.fn(),
  queries: [],
}));

vi.mock('../../supabase', () => ({
  supabase: {
    from: mocks.from,
  },
}));

vi.mock('../terminalService', () => ({
  terminalService: {
    getTerminalId: mocks.getTerminalId,
  },
}));

vi.mock('../cashSessionService', () => ({
  cashSessionService: {
    getActiveSession: mocks.getActiveSession,
  },
}));

const createQuery = (table, resolver) => {
  const state = {
    table,
    action: null,
    payload: null,
  };
  const query = {
    insert: vi.fn((payload) => {
      state.action = 'insert';
      state.payload = payload;
      return query;
    }),
    select: vi.fn(() => query),
    single: vi.fn(() => Promise.resolve(resolver(state))),
  };
  mocks.queries.push(state);
  return query;
};

describe('cashMovementService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.queries.length = 0;
    mocks.getTerminalId.mockReturnValue('terminal-a');
    mocks.getActiveSession.mockResolvedValue({ id: 'shared-session', staff_name: 'Ana' });
    mocks.from.mockImplementation((table) =>
      createQuery(table, (state) => ({ data: { id: 'move-1', ...state.payload[0] }, error: null })),
    );
  });

  it('registra entradas y salidas con sesion y terminal actuales', async () => {
    const { cashMovementService } = await import('../cashMovementService');

    const movement = await cashMovementService.registerMovement(
      'entrada',
      '250.50',
      'Cambio adicional',
      'Ana',
      'shared_cashbox',
    );

    expect(mocks.getActiveSession).toHaveBeenCalledWith('shared_cashbox');
    expect(movement).toEqual(
      expect.objectContaining({
        session_id: 'shared-session',
        terminal_id: 'terminal-a',
        movement_type: 'entrada',
        amount: 250.5,
        concept: 'Cambio adicional',
        staff_name: 'Ana',
      }),
    );
  });

  it('bloquea movimientos sin sesion activa', async () => {
    mocks.getActiveSession.mockResolvedValue(null);
    const { cashMovementService } = await import('../cashMovementService');

    await expect(
      cashMovementService.registerMovement('salida', 50, 'Pago proveedor', 'Ana'),
    ).rejects.toThrow(/No hay una sesi.n de caja activa/);
  });
});
