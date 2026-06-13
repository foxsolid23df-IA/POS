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

const createInsertQuery = (table, resolver) => {
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

const createUpdateQuery = (result = { data: {}, error: null }) => {
  const query = {
    update: vi.fn(() => query),
    eq: vi.fn(() => query),
    select: vi.fn(() => query),
    single: vi.fn().mockResolvedValue(result),
  };
  return query;
};

const createSelectQuery = (result = { data: [], error: null }) => {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    gte: vi.fn(() => query),
    lte: vi.fn(() => query),
    then: (resolve) => Promise.resolve(result).then(resolve),
  };
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
      createInsertQuery(table, (state) => ({ data: { id: 'move-1', ...state.payload[0] }, error: null })),
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
      createInsertQuery(table, (state) => {
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

  it('actualiza un gasto registrado con datos de auditoria', async () => {
    const updateQuery = createUpdateQuery({
      data: { id: 15, amount: 250, concept: 'Proveedor corregido' },
      error: null,
    });
    mocks.from.mockReturnValue(updateQuery);

    const { cashMovementService } = await import('../cashMovementService');
    const result = await cashMovementService.updateExpense(
      15,
      {
        amount: '250',
        concept: 'Proveedor corregido',
        category: 'Proveedor',
        reference: 'F-123',
        notes: 'Captura corregida',
      },
      'Ana',
    );

    expect(result).toEqual({ id: 15, amount: 250, concept: 'Proveedor corregido' });
    expect(mocks.from).toHaveBeenCalledWith('cash_movements');
    expect(updateQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      amount: 250,
      concept: 'Proveedor corregido',
      category: 'Proveedor',
      reference: 'F-123',
      notes: 'Captura corregida',
      edited_by_staff_name: 'Ana',
      edit_reason: 'Correccion de gasto',
    }));
    expect(updateQuery.eq).toHaveBeenCalledWith('id', 15);
    expect(updateQuery.eq).toHaveBeenCalledWith('movement_type', 'salida');
    expect(updateQuery.eq).toHaveBeenCalledWith('is_expense', true);
  });

  it('cancela un gasto sin borrarlo', async () => {
    const updateQuery = createUpdateQuery({
      data: { id: 20, expense_status: 'cancelled' },
      error: null,
    });
    mocks.from.mockReturnValue(updateQuery);

    const { cashMovementService } = await import('../cashMovementService');
    const result = await cashMovementService.cancelExpense(20, 'Cantidad equivocada', 'Luis');

    expect(result).toEqual({ id: 20, expense_status: 'cancelled' });
    expect(updateQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      expense_status: 'cancelled',
      cancelled_by_staff_name: 'Luis',
      cancellation_reason: 'Cantidad equivocada',
    }));
    expect(updateQuery.eq).toHaveBeenCalledWith('id', 20);
    expect(updateQuery.eq).toHaveBeenCalledWith('movement_type', 'salida');
    expect(updateQuery.eq).toHaveBeenCalledWith('is_expense', true);
  });

  it('excluye gastos cancelados del total del resumen', async () => {
    const selectQuery = createSelectQuery({
      data: [
        { id: 1, movement_type: 'salida', is_expense: true, amount: 100, category: 'Proveedor' },
        { id: 2, movement_type: 'salida', is_expense: true, amount: 50, category: 'Flete', expense_status: 'cancelled' },
      ],
      error: null,
    });
    mocks.from.mockReturnValue(selectQuery);

    const { cashMovementService } = await import('../cashMovementService');
    const summary = await cashMovementService.getExpenseSummary();

    expect(summary.total).toBe(100);
    expect(summary.count).toBe(1);
    expect(summary.expenses).toHaveLength(2);
    expect(summary.byCategory).toEqual({ Proveedor: 100 });
  });
});
