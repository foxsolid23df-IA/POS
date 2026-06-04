import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getTerminalId: vi.fn(),
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

const createQuery = (table, resolver) => {
  const state = {
    table,
    action: null,
    payload: null,
    filters: [],
    orders: [],
    limitValue: null,
    conflict: null,
  };
  const query = {
    select: vi.fn((columns) => {
      state.action ||= 'select';
      state.columns = columns;
      return query;
    }),
    insert: vi.fn((payload) => {
      state.action = 'insert';
      state.payload = payload;
      return query;
    }),
    eq: vi.fn((column, value) => {
      state.filters.push({ op: 'eq', column, value });
      return query;
    }),
    order: vi.fn((column, options) => {
      state.orders.push({ column, options });
      return query;
    }),
    limit: vi.fn((value) => {
      state.limitValue = value;
      return query;
    }),
    single: vi.fn(() => Promise.resolve(resolver(state))),
  };
  query.then = (resolve, reject) => Promise.resolve(resolver(state)).then(resolve, reject);
  mocks.queries.push(state);
  return query;
};

const setupSupabase = ({ selectResults = [], insertResults = [] } = {}) => {
  const queues = {
    select: [...selectResults],
    insert: [...insertResults],
  };

  mocks.from.mockImplementation((table) =>
    createQuery(table, (state) => {
      const queue = queues[state.action] || [];
      return queue.length > 0 ? queue.shift() : { data: null, error: null };
    }),
  );
};

describe('cashSessionService shared cashbox', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.queries.length = 0;
    mocks.getTerminalId.mockReturnValue('11111111-1111-4111-8111-111111111111');
  });

  it('reutiliza una sesion compartida abierta en lugar de crear otra', async () => {
    setupSupabase({
      selectResults: [{ data: { id: 'shared-session', session_scope: 'shared_cashbox' }, error: null }],
    });

    const { cashSessionService } = await import('../cashSessionService');
    const session = await cashSessionService.openSession('Ana', 500, 'staff-1', 'shared_cashbox');

    expect(session.id).toBe('shared-session');
    expect(mocks.queries.some((query) => query.action === 'insert')).toBe(false);
    expect(mocks.queries[0].filters).toEqual(
      expect.arrayContaining([
        { op: 'eq', column: 'status', value: 'open' },
        { op: 'eq', column: 'session_scope', value: 'shared_cashbox' },
      ]),
    );
    expect(mocks.queries[0].filters).not.toEqual(
      expect.arrayContaining([{ op: 'eq', column: 'terminal_id', value: expect.any(String) }]),
    );
  });

  it('recupera la sesion compartida si otra terminal gana la carrera de creacion', async () => {
    setupSupabase({
      selectResults: [
        { data: null, error: { code: 'PGRST116' } },
        { data: { id: 'winner-session', session_scope: 'shared_cashbox' }, error: null },
      ],
      insertResults: [{ data: null, error: { code: '23505', message: 'duplicate key' } }],
    });

    const { cashSessionService } = await import('../cashSessionService');
    const session = await cashSessionService.openSession('Ana', 500, 'staff-1', 'shared_cashbox');

    expect(session.id).toBe('winner-session');
    expect(mocks.queries.filter((query) => query.action === 'insert')).toHaveLength(1);
  });

  it('mantiene el modo por terminal filtrando por terminal_id', async () => {
    setupSupabase({
      selectResults: [{ data: { id: 'terminal-session', session_scope: 'terminal' }, error: null }],
    });

    const { cashSessionService } = await import('../cashSessionService');
    const session = await cashSessionService.getActiveSession('terminal');

    expect(session.id).toBe('terminal-session');
    expect(mocks.queries[0].filters).toEqual(
      expect.arrayContaining([
        { op: 'eq', column: 'status', value: 'open' },
        { op: 'eq', column: 'terminal_id', value: '11111111-1111-4111-8111-111111111111' },
      ]),
    );
  });

  it('avisa claramente cuando falta la migracion de caja compartida', async () => {
    setupSupabase({
      selectResults: [{ data: null, error: { code: 'PGRST116' } }],
      insertResults: [
        {
          data: null,
          error: { code: '42703', message: 'column "session_scope" does not exist' },
        },
      ],
    });

    const { cashSessionService } = await import('../cashSessionService');

    await expect(
      cashSessionService.openSession('Ana', 500, 'staff-1', 'shared_cashbox'),
    ).rejects.toThrow('migracion de caja compartida');
  });
});
