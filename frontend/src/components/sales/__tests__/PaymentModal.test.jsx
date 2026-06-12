import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PaymentModal from '../PaymentModal';

const mocks = vi.hoisted(() => ({
  getCustomerCreditDetail: vi.fn(),
  searchCustomers: vi.fn(),
  createCustomer: vi.fn(),
}));

vi.mock('../../../services/creditService', () => ({
  creditService: {
    getCustomerCreditDetail: mocks.getCustomerCreditDetail,
  },
}));

vi.mock('../../../services/customerService', () => ({
  customerService: {
    search: mocks.searchCustomers,
    create: mocks.createCustomer,
  },
}));

const renderPaymentModal = (props = {}) => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onComplete: vi.fn(),
    total: 100,
    taxRate: 0,
    tipoCambio: null,
    selectedIssuerId: '',
    setSelectedIssuerId: vi.fn(),
    issuers: [],
    user: { tax_enabled: false, tax_included: true },
    transactionId: '12345',
    selectedCustomer: {
      id: 'customer-1',
      name: 'Cliente de Credito',
      credit_limit: 500,
      credit_balance: 75,
    },
  };

  return {
    ...render(<PaymentModal {...defaultProps} {...props} />),
    props: { ...defaultProps, ...props },
  };
};

describe('PaymentModal credit flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCustomerCreditDetail.mockResolvedValue({
      customer: {
        id: 'customer-1',
        name: 'Cliente de Credito',
        credit_limit: 500,
        credit_balance: 75,
      },
      sales: [],
      payments: [],
    });
  });

  it('completa la venta a credito con el id del cliente seleccionado', async () => {
    const onComplete = vi.fn();
    renderPaymentModal({ onComplete });

    fireEvent.click(screen.getByText('[F5]').closest('button'));

    await waitFor(() => {
      expect(mocks.getCustomerCreditDetail).toHaveBeenCalledWith('customer-1');
    });

    fireEvent.click(screen.getByText(/Completar Venta/).closest('button'));

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      isCreditSale: true,
      customerId: 'customer-1',
      creditBalance: 75,
      creditLimit: 500,
    }));
  });
});
