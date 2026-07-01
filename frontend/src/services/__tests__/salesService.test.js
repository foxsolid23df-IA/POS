import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  getUser: vi.fn(),
  getTerminalId: vi.fn(),
}));

vi.mock('../../supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    auth: {
      getUser: mocks.getUser,
    },
  },
}));

vi.mock('../terminalService', () => ({
  terminalService: {
    getTerminalId: mocks.getTerminalId,
  },
}));

const baseSaleData = {
  user_id: 'user-1',
  total: 100,
  subtotal: 100,
  tax_amount: 0,
  metodoPago: 'efectivo',
  items: [
    {
      id: '1::PZA',
      product_id: 1,
      name: 'Producto',
      quantity: 2,
      price: 50,
      unit_sold: 'PZA',
      conversion_factor: 1,
      base_quantity: 2,
    },
  ],
  payments: [
    {
      method: 'efectivo',
      amount: 100,
      received: 100,
      change: 0,
    },
  ],
};

describe('salesService.createSale', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.getTerminalId.mockReturnValue('terminal-1');
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  });

  it('mantiene process_perfect_sale para ventas normales', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: { id: 10, total: 100 }, error: null });

    const { salesService } = await import('../salesService');
    const sale = await salesService.createSale(baseSaleData);

    expect(sale).toEqual({ id: 10, total: 100 });
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'validate_sale_stock', expect.objectContaining({
      p_items: [
        expect.objectContaining({
          product_id: 1,
          requested_base_qty: 2,
        }),
      ],
    }));
    expect(mocks.rpc).toHaveBeenNthCalledWith(
      2,
      'process_perfect_sale',
      expect.objectContaining({
        p_total: 100,
        p_items: expect.any(Array),
        p_payments: expect.any(Array),
      }),
    );
  });

  it('usa replace_sale_with_new_sale y omite validacion previa al reemplazar ticket', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { id: 11, total: 75 }, error: null });

    const { salesService } = await import('../salesService');
    const sale = await salesService.createSale({
      ...baseSaleData,
      total: 75,
      replacement_sale_id: 7,
      replacement_reason: 'Reemplazo por nuevo ticket #7',
      replacement_refund_amount: 100,
    });

    expect(sale).toEqual({ id: 11, total: 75 });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith(
      'replace_sale_with_new_sale',
      expect.objectContaining({
        p_original_sale_id: 7,
        p_replacement_reason: 'Reemplazo por nuevo ticket #7',
        p_refund_amount: 100,
        p_restock: true,
        p_total: 75,
      }),
    );
  });
});

describe('salesService.createCreditSale', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.getTerminalId.mockReturnValue('terminal-1');
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  });

  it('llama process_credit_sale con la firma canonica sin p_user_id', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { id: 12, total: 100 }, error: null });

    const { salesService } = await import('../salesService');
    const sale = await salesService.createCreditSale({
      ...baseSaleData,
      metodoPago: 'credito',
      customer_id: 'customer-1',
      paid_amount: 0,
      balance: 100,
    });

    expect(sale).toEqual({ id: 12, total: 100 });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith(
      'process_credit_sale',
      expect.objectContaining({
        p_total: 100,
        p_customer_id: 'customer-1',
        p_paid_amount: 0,
        p_balance: 100,
        p_due_date: null,
      }),
    );

    const [, params] = mocks.rpc.mock.calls[0];
    expect(params).not.toHaveProperty('p_user_id');
  });
});
