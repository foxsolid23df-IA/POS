import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getTerminalId: vi.fn(),
  getSalesSince: vi.fn(),
  getTodaySales: vi.fn(),
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

vi.mock('../salesService', () => ({
  salesService: {
    getSalesSince: mocks.getSalesSince,
    getTodaySales: mocks.getTodaySales,
  },
}));

const createQuery = (table, resolver) => {
  const state = {
    table,
    action: null,
    filters: [],
  };
  const query = {
    select: vi.fn((columns) => {
      state.action ||= 'select';
      state.columns = columns;
      return query;
    }),
    eq: vi.fn((column, value) => {
      state.filters.push({ op: 'eq', column, value });
      return query;
    }),
    neq: vi.fn((column, value) => {
      state.filters.push({ op: 'neq', column, value });
      return query;
    }),
    gte: vi.fn((column, value) => {
      state.filters.push({ op: 'gte', column, value });
      return query;
    }),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    single: vi.fn(() => Promise.resolve(resolver(state))),
  };
  query.then = (resolve, reject) => Promise.resolve(resolver(state)).then(resolve, reject);
  mocks.queries.push(state);
  return query;
};

const setupSupabase = ({ sessionResult, movementsResult, blockingResult, creditPaymentsResult } = {}) => {
  mocks.from.mockImplementation((table) =>
    createQuery(table, (state) => {
      if (table === 'cash_sessions' && state.filters.some((filter) => filter.op === 'neq')) {
        return blockingResult || { data: [], error: null };
      }
      if (table === 'cash_sessions') {
        return sessionResult || { data: null, error: { code: 'PGRST116' } };
      }
      if (table === 'cash_movements') {
        return movementsResult || { data: [], error: null };
      }
      if (table === 'credit_payments') {
        return creditPaymentsResult || { data: [], error: null };
      }
      return { data: null, error: null };
    }),
  );
};

describe('cashCutService summaries', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.queries.length = 0;
    mocks.getTerminalId.mockReturnValue('11111111-1111-4111-8111-111111111111');
    mocks.getSalesSince.mockResolvedValue([]);
    setupSupabase();
  });

  it('separa ventas netas, cancelaciones, gastos, retiros y devoluciones de efectivo', async () => {
    setupSupabase({
      sessionResult: {
        data: { id: 'shared-session', opened_at: '2026-06-02T15:00:00.000Z' },
        error: null,
      },
      creditPaymentsResult: {
        data: [
          { amount: 20, payment_method: 'efectivo', created_at: '2026-06-02T17:00:00.000Z' },
          { amount: 15, payment_method: 'transferencia', created_at: '2026-06-02T17:05:00.000Z' },
        ],
        error: null,
      },
      movementsResult: {
        data: [
          { movement_type: 'entrada', amount: 20, concept: 'Cambio extra' },
          { movement_type: 'salida', amount: 5, is_expense: true, category: 'Servicios', concept: 'Agua' },
          { movement_type: 'salida', amount: 7, is_expense: false, concept: 'Retiro parcial' },
          { movement_type: 'salida', amount: 30, is_expense: false, concept: 'Devolucion/cancelacion venta #4' },
        ],
        error: null,
      },
    });
    mocks.getSalesSince.mockResolvedValue([
      {
        id: 1,
        total: 100,
        terminal_id: 'terminal-a',
        terminals: { name: 'PC A' },
        sale_status: 'completed',
        sale_payments: [{ payment_method: 'efectivo', amount: 100, currency: 'MXN' }],
      },
      {
        id: 2,
        total: 50,
        terminal_id: 'terminal-b',
        terminals: { name: 'PC B' },
        sale_status: 'completed',
        sale_payments: [{ payment_method: 'tarjeta', amount: 50, currency: 'MXN' }],
      },
      {
        id: 3,
        total: 200,
        terminal_id: 'terminal-b',
        terminals: { name: 'PC B' },
        sale_status: 'completed',
        sale_payments: [
          {
            payment_method: 'dolares',
            amount: 200,
            amount_received: 10,
            change_amount: 0,
            currency: 'USD',
          },
        ],
      },
      {
        id: 5,
        total: 80,
        terminal_id: 'terminal-a',
        terminals: { name: 'PC A' },
        sale_status: 'completed',
        sale_type: 'credito',
        sale_payments: [],
      },
      {
        id: 4,
        total: 30,
        refunded_amount: 30,
        terminal_id: 'terminal-a',
        terminals: { name: 'PC A' },
        sale_status: 'cancelled',
        sale_payments: [{ payment_method: 'efectivo', amount: 30, currency: 'MXN' }],
      },
    ]);

    const { cashCutService } = await import('../cashCutService');
    const summary = await cashCutService.getCurrentShiftSummary('turno', 'shared_cashbox');

    expect(mocks.getSalesSince).toHaveBeenCalledWith('2026-06-02T15:00:00.000Z', null);
    expect(summary.salesCount).toBe(4);
    expect(summary.salesTotal).toBe(430);
    expect(summary.cancelledSalesCount).toBe(1);
    expect(summary.cancelledSalesTotal).toBe(30);
    expect(summary.cancelledCashTotal).toBe(30);
    expect(summary.cashTotal).toBe(100);
    expect(summary.cardTotal).toBe(50);
    expect(summary.cashMxnExpected).toBe(150);
    expect(summary.usdExpected).toBe(10);
    expect(summary.entradasTotal).toBe(20);
    expect(summary.salidasTotal).toBe(7);
    expect(summary.withdrawals).toHaveLength(1);
    expect(summary.refundsCashTotal).toBe(30);
    expect(summary.cashRefunds).toHaveLength(1);
    expect(summary.expensesTotal).toBe(5);
    expect(summary.expenses).toHaveLength(1);
    expect(summary.expensesByCategory).toEqual([
      { category: 'Servicios', count: 1, total: 5 },
    ]);
    expect(summary.commercialSalesSummary.cash).toMatchObject({ count: 3, total: 350 });
    expect(summary.commercialSalesSummary.credits).toMatchObject({ count: 1, total: 80 });
    expect(summary.commercialSalesSummary.orders).toMatchObject({ count: 0, total: 0 });
    expect(summary.commercialSalesSummary.payments).toMatchObject({ count: 2, total: 35 });
    expect(summary.creditPaymentTotals.efectivo).toBe(20);
    expect(summary.creditPaymentTotals.transferencia).toBe(15);
    expect(summary.otherPaymentRows).toEqual([
      { key: 'TAR', label: 'TAR', income: 50, expense: 0, total: 50 },
      { key: 'TRA', label: 'TRA', income: 15, expense: 0, total: 15 },
      { key: 'DEP', label: 'DEP', income: 0, expense: 0, total: 0 },
      { key: 'CHQ', label: 'CHQ', income: 0, expense: 0, total: 0 },
      { key: 'D.E.', label: 'D.E.', income: 200, expense: 0, total: 200 },
      { key: 'IDP', label: 'IDP', income: 0, expense: 0, total: 0 },
    ]);
    expect(summary.terminalBreakdown).toEqual([
      { terminal_id: 'terminal-a', terminal_name: 'PC A', sales_count: 2, sales_total: 180 },
      { terminal_id: 'terminal-b', terminal_name: 'PC B', sales_count: 2, sales_total: 250 },
    ]);
  });

  it('en modo terminal consulta ventas solo de la terminal actual', async () => {
    setupSupabase({
      sessionResult: {
        data: { id: 'terminal-session', opened_at: '2026-06-02T16:00:00.000Z' },
        error: null,
      },
      movementsResult: { data: [], error: null },
    });

    const { cashCutService } = await import('../cashCutService');
    await cashCutService.getCurrentShiftSummary('turno', 'terminal');

    expect(mocks.getSalesSince).toHaveBeenCalledWith(
      '2026-06-02T16:00:00.000Z',
      '11111111-1111-4111-8111-111111111111',
    );
  });

  it('detecta sesiones bloqueantes de otras terminales para cierre de dia', async () => {
    setupSupabase({
      blockingResult: {
        data: [{ id: 'session-b', terminal_id: 'terminal-b', terminals: { name: 'PC B' } }],
        error: null,
      },
    });

    const { cashCutService } = await import('../cashCutService');
    const blocking = await cashCutService.checkBlockingSessions();

    expect(blocking).toHaveLength(1);
    expect(mocks.queries[0].filters).toEqual(
      expect.arrayContaining([
        { op: 'eq', column: 'status', value: 'open' },
        { op: 'eq', column: 'session_scope', value: 'terminal' },
        { op: 'neq', column: 'terminal_id', value: '11111111-1111-4111-8111-111111111111' },
      ]),
    );
  });
});
