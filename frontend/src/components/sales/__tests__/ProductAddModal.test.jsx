import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProductAddModal from '../ProductAddModal';

const formatearDinero = (amount) => `$${Number(amount || 0).toFixed(2)}`;

const baseProduct = {
  id: 'p1',
  name: 'Producto caja',
  price: 75,
  stock: 500,
  box_units: 24,
  box_price: 1800,
  box_special_price: 500,
  box_special_from_qty: 4,
};

describe('ProductAddModal', () => {
  it('muestra precio especial de caja al llegar al minimo y no lo manda como precio manual', async () => {
    const onAdd = vi.fn();

    render(
      <ProductAddModal
        product={baseProduct}
        onClose={vi.fn()}
        onAdd={onAdd}
        formatearDinero={formatearDinero}
        hasBoxConfig
        boxUnits={24}
        boxPrice={1800}
      />,
    );

    const cajasInput = screen.getByDisplayValue('0');
    fireEvent.change(cajasInput, { target: { value: '4' } });

    await waitFor(() => {
      expect(screen.getByDisplayValue(500)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /agregar al carrito/i }));

    expect(onAdd).toHaveBeenCalledWith(1, 4, 75, undefined);
  });

  it('manda precio manual de caja cuando el cajero lo edita', async () => {
    const onAdd = vi.fn();

    render(
      <ProductAddModal
        product={baseProduct}
        onClose={vi.fn()}
        onAdd={onAdd}
        formatearDinero={formatearDinero}
        hasBoxConfig
        boxUnits={24}
        boxPrice={1800}
      />,
    );

    const cajasInput = screen.getByDisplayValue('0');
    fireEvent.change(cajasInput, { target: { value: '4' } });

    const priceInput = await screen.findByDisplayValue(500);
    fireEvent.change(priceInput, { target: { value: '450' } });

    fireEvent.click(screen.getByRole('button', { name: /agregar al carrito/i }));

    expect(onAdd).toHaveBeenCalledWith(1, 4, 75, 450);
  });
});
