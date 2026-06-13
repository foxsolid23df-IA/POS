import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Orders } from '../Orders';
import Swal from 'sweetalert2';

const mocks = vi.hoisted(() => ({
  getSales: vi.fn(),
  cancelSaleWithRestock: vi.fn(),
  validateMasterPin: vi.fn(),
  navigate: vi.fn(),
  printSaleTicketFast: vi.fn(),
  isWebAdminMode: vi.fn(() => false),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('sweetalert2', () => ({
  default: {
    fire: vi.fn(),
    isLoading: vi.fn(() => false),
    showValidationMessage: vi.fn(),
  },
}));

vi.mock('../../../services/salesService', () => ({
  salesService: {
    getSales: mocks.getSales,
  },
}));

vi.mock('../../../services/returnService', () => ({
  returnService: {
    cancelSaleWithRestock: mocks.cancelSaleWithRestock,
  },
}));

vi.mock('../../../services/printerService', () => ({
  printerService: {
    printSaleTicketFast: mocks.printSaleTicketFast,
  },
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', tax_enabled: false },
    validateMasterPin: mocks.validateMasterPin,
  }),
}));

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    ticketSettings: {},
  }),
}));

vi.mock('../../../utils/ticketFormatter', () => ({
  generateTicketHtml: () => '<div>Ticket</div>',
}));

vi.mock('../../../utils/appMode', () => ({
  isWebAdminMode: () => mocks.isWebAdminMode(),
}));

const order = {
  id: 1128,
  total: 302.5,
  paid_amount: 302.5,
  payment_method: 'efectivo',
  sale_status: 'completed',
  created_at: '2026-06-13T12:00:00.000Z',
  sale_items: [
    {
      id: 1,
      product_name: 'Producto prueba',
      quantity: 1,
      price: 302.5,
      total: 302.5,
      unit_sold: 'PZA',
    },
  ],
};

describe('Orders quick cancellation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSales.mockResolvedValue([order]);
    mocks.cancelSaleWithRestock.mockResolvedValue({ id: 'return-1' });
    mocks.validateMasterPin.mockResolvedValue(true);
    Swal.fire.mockImplementation(async (optionsOrTitle) => {
      if (typeof optionsOrTitle === 'object' && optionsOrTitle.title === 'Autorizacion requerida') {
        if (optionsOrTitle.preConfirm) {
          await optionsOrTitle.preConfirm('1234');
        }
        return { isConfirmed: true, value: true };
      }
      return { isConfirmed: true };
    });
  });

  it('cancela con PIN maestro sin pedir motivo ni monto', async () => {
    render(<Orders />);

    fireEvent.click(await screen.findByText('#1128'));
    fireEvent.click(screen.getByRole('button', { name: /cancelar \/ devolver/i }));

    await waitFor(() => {
      expect(mocks.cancelSaleWithRestock).toHaveBeenCalledWith({
        saleId: 1128,
        reason: 'Cancelacion de venta',
        refundAmount: null,
        restock: true,
      });
    });

    expect(Swal.fire).not.toHaveBeenCalledWith(expect.objectContaining({
      title: 'Cancelar / Devolver #1128',
    }));
    expect(screen.queryByText(/monto a devolver/i)).not.toBeInTheDocument();
    expect(document.getElementById('orders-return-reason')).toBeNull();
    expect(document.getElementById('orders-return-refund')).toBeNull();
  });
});
