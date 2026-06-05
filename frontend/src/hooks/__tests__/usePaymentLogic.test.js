import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePaymentLogic } from '../usePaymentLogic';

describe('usePaymentLogic', () => {
  it('agrega un pago exacto por el total cuando no hay pagos previos', () => {
    const { result } = renderHook(() => usePaymentLogic({ totalVenta: 125 }));

    let response;
    act(() => {
      response = result.current.agregarPagoExacto();
    });

    expect(response.success).toBe(true);
    expect(response.fullyCovered).toBe(true);
    expect(result.current.pagosRealizados).toHaveLength(1);
    expect(result.current.pagosRealizados[0]).toEqual(
      expect.objectContaining({
        method: 'efectivo',
        amount: 125,
        received: 125,
        change: 0,
        currency: 'MXN',
      }),
    );
  });

  it('cubre solo el saldo restante despues de un pago parcial', () => {
    const { result } = renderHook(() => usePaymentLogic({ totalVenta: 100 }));

    act(() => {
      result.current.setMontoRecibido('25');
    });

    act(() => {
      result.current.agregarPago();
    });

    expect(result.current.saldoPendiente).toBe(75);

    let response;
    act(() => {
      response = result.current.agregarPagoExacto();
    });

    expect(response.success).toBe(true);
    expect(response.fullyCovered).toBe(true);
    expect(result.current.pagosRealizados).toHaveLength(2);
    expect(result.current.pagosRealizados[1]).toEqual(
      expect.objectContaining({
        amount: 75,
        received: 75,
        change: 0,
      }),
    );
  });

  it('no agrega pago exacto si ya no hay saldo pendiente', () => {
    const { result } = renderHook(() => usePaymentLogic({ totalVenta: 0 }));

    let response;
    act(() => {
      response = result.current.agregarPagoExacto();
    });

    expect(response.success).toBe(false);
    expect(result.current.pagosRealizados).toHaveLength(0);
  });

  it('no agrega pago exacto en dolares para evitar conversion implicita', () => {
    const { result } = renderHook(() => usePaymentLogic({ totalVenta: 100, tipoCambio: 20 }));

    act(() => {
      result.current.setMetodoPago('dolares');
    });

    let response;
    act(() => {
      response = result.current.agregarPagoExacto();
    });

    expect(response.success).toBe(false);
    expect(result.current.pagosRealizados).toHaveLength(0);
  });
});
