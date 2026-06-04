import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getUser: vi.fn(),
  getTerminalId: vi.fn(),
  channel: vi.fn(),
  queries: [],
}));

vi.mock('../../supabase', () => ({
  supabase: {
    from: mocks.from,
    auth: {
      getUser: mocks.getUser,
    },
    channel: mocks.channel,
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
    conflict: null,
  };
  const query = {
    select: vi.fn(() => query),
    upsert: vi.fn((payload, options) => {
      state.action = 'upsert';
      state.payload = payload;
      state.conflict = options?.onConflict;
      return query;
    }),
    update: vi.fn((payload) => {
      state.action = 'update';
      state.payload = payload;
      return query;
    }),
    eq: vi.fn((column, value) => {
      state.filters.push({ op: 'eq', column, value });
      return query;
    }),
    single: vi.fn(() => Promise.resolve(resolver(state))),
    maybeSingle: vi.fn(() => Promise.resolve(resolver(state))),
  };
  query.then = (resolve, reject) => Promise.resolve(resolver(state)).then(resolve, reject);
  mocks.queries.push(state);
  return query;
};

describe('activeCartService terminal isolation', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.queries.length = 0;
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mocks.getTerminalId.mockReturnValue('terminal-a');
    mocks.from.mockImplementation((table) =>
      createQuery(table, (state) => ({
        data: { id: 'cart-1', ...state.payload },
        error: null,
      })),
    );
  });

  it('guarda carritos compartiendo sesion pero separados por terminal', async () => {
    const { activeCartService } = await import('../activeCartService');

    await activeCartService.updateCart([{ id: 'p1', quantity: 1 }], 100, 'shared-session');

    expect(mocks.queries[0].action).toBe('upsert');
    expect(mocks.queries[0].conflict).toBe('session_id,terminal_id');
    expect(mocks.queries[0].payload).toEqual(
      expect.objectContaining({
        user_id: 'user-1',
        session_id: 'shared-session',
        terminal_id: 'terminal-a',
        total: 100,
      }),
    );
  });

  it('limpia solo el carrito de la sesion y terminal actuales', async () => {
    const { activeCartService } = await import('../activeCartService');

    await activeCartService.clearCart('completed', 'shared-session');

    expect(mocks.queries[0].action).toBe('update');
    expect(mocks.queries[0].filters).toEqual(
      expect.arrayContaining([
        { op: 'eq', column: 'user_id', value: 'user-1' },
        { op: 'eq', column: 'session_id', value: 'shared-session' },
        { op: 'eq', column: 'terminal_id', value: 'terminal-a' },
      ]),
    );
  });

  it('ignora eventos realtime de otra terminal en la misma sesion', async () => {
    const callback = vi.fn();
    const subscription = { unsubscribe: vi.fn() };
    let realtimeHandler;
    const channelApi = {
      on: vi.fn((_event, _options, handler) => {
        realtimeHandler = handler;
        return channelApi;
      }),
      subscribe: vi.fn(() => subscription),
    };
    mocks.channel.mockReturnValue(channelApi);

    const { activeCartService } = await import('../activeCartService');
    activeCartService.subscribeToCart('user-1', 'shared-session', callback, 'terminal-a');

    realtimeHandler({ new: { id: 'cart-b', terminal_id: 'terminal-b' } });
    realtimeHandler({ new: { id: 'cart-a', terminal_id: 'terminal-a' } });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ id: 'cart-a', terminal_id: 'terminal-a' });
  });
});
