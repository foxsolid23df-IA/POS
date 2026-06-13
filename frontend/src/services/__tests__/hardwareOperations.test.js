import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  getTerminalId: vi.fn(() => 'terminal-1'),
  invalidateProduct: vi.fn(),
}));

vi.mock('../../supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
  },
}));

vi.mock('../terminalService', () => ({
  terminalService: {
    getTerminalId: mocks.getTerminalId,
  },
}));

vi.mock('../productService', () => ({
  productService: {
    invalidateProduct: mocks.invalidateProduct,
  },
}));

describe('hardware operation services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: { id: 'ok' }, error: null });
  });

  it('registerPurchase envia compra formal con equivalencia base', async () => {
    const { purchaseService } = await import('../purchaseService');

    await purchaseService.registerPurchase({
      supplierName: 'Proveedor Norte',
      invoiceNumber: 'F-100',
      items: [{
        id: 12,
        name: 'Taquete 1/4',
        quantity: 2,
        unit: 'CAJA',
        conversion_factor: 100,
        unit_cost: 80,
      }],
    });

    expect(mocks.rpc).toHaveBeenCalledWith('register_purchase', expect.objectContaining({
      p_supplier_name: 'Proveedor Norte',
      p_invoice_number: 'F-100',
      p_items: [expect.objectContaining({
        product_id: 12,
        unit: 'CAJA',
        quantity: 2,
        conversion_factor: 100,
        base_quantity: 200,
      })],
    }));
  });

  it('cancelSaleWithRestock envia motivo, reingreso y monto de devolucion', async () => {
    const { returnService } = await import('../returnService');

    await returnService.cancelSaleWithRestock({
      saleId: 50,
      reason: 'Cliente regreso material',
      refundAmount: 125,
      restock: true,
    });

    expect(mocks.rpc).toHaveBeenCalledWith('cancel_sale_with_restock', {
      p_sale_id: 50,
      p_reason: 'Cliente regreso material',
      p_refund_amount: 125,
      p_restock: true,
    });
  });

  it('cancelSaleWithRestock permite cancelacion rapida con defaults', async () => {
    const { returnService } = await import('../returnService');

    await returnService.cancelSaleWithRestock({
      saleId: 51,
    });

    expect(mocks.rpc).toHaveBeenCalledWith('cancel_sale_with_restock', {
      p_sale_id: 51,
      p_reason: 'Cancelacion de venta',
      p_refund_amount: null,
      p_restock: true,
    });
  });

  it('createQuotation conserva unidad y base_quantity para ferreteria', async () => {
    const { quotationService } = await import('../quotationService');

    await quotationService.createQuotation({
      customerName: 'Obra Centro',
      items: [{
        product_id: 9,
        name: 'Cable THW',
        quantity: 12.5,
        price: 18,
        unit_sold: 'M',
      }],
    });

    expect(mocks.rpc).toHaveBeenCalledWith('create_quotation', expect.objectContaining({
      p_customer_name: 'Obra Centro',
      p_items: [expect.objectContaining({
        product_id: 9,
        unit_sold: 'M',
        quantity: 12.5,
        base_quantity: 12.5,
      })],
    }));
  });
});
