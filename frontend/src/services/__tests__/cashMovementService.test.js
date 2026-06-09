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

  it('registra gastos con categoria y metadatos de caja', async () => {
    const { cashMovementService } = await import('../cashMovementService');

    const movement = await cashMovementService.registerExpense(
      120,
      'Pago de agua',
      'Ana',
      'terminal',
      {
        category: 'Servicios',
        reference: 'REC-10',
        notes: 'Recibo mensual',
        createdByStaffId: 'staff-1',
      },
    );

    expect(movement).toEqual(
      expect.objectContaining({
        session_id: 'shared-session',
        terminal_id: 'terminal-a',
        movement_type: 'salida',
        amount: 120,
        concept: 'Pago de agua',
        staff_name: 'Ana',
        is_expense: true,
        category: 'Servicios',
        reference: 'REC-10',
        notes: 'Recibo mensual',
        created_by_staff_id: 'staff-1',
      }),
    );
  });

  it('registra el gasto como salida legacy si Supabase no refresco campos de gasto', async () => {
    let insertCount = 0;
    mocks.from.mockImplementation((table) =>
      createQuery(table, (state) => {
        insertCount += 1;

        if (insertCount === 1) {
          return {
            data: null,
            error: {
              code: 'PGRST204',
              message: "Could not find the 'category' column of 'cash_movements' in the schema cache",
            },
          };
        }

        return { data: { id: 'move-legacy', ...state.payload[0] }, error: null };
      }),
    );

    const { cashMovementService } = await import('../cashMovementService');

    const movement = await cashMovementService.registerExpense(
      75,
      'Compra menor',
      'Ana',
      'terminal',
      { category: 'Compras menores' },
    );

    expect(mocks.queries[0].payload[0]).toEqual(
      expect.objectContaining({
        movement_type: 'salida',
        is_expense: true,
        category: 'Compras menores',
      }),
    );
    expect(mocks.queries[1].payload[0]).toEqual(
      expect.not.objectContaining({
        is_expense: expect.anything(),
        category: expect.anything(),
      }),
    );
    expect(movement).toEqual(
      expect.objectContaining({
        movement_type: 'salida',
        amount: 75,
        concept: 'Compra menor',
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
