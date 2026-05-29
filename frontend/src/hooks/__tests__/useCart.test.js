import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useCart } from '../useCart';

describe('useCart Hook', () => {
  const mockMostrarError = vi.fn();
  const mockUserAllowNegativeStock = false;

  const mockProducto = {
    id: 'p1',
    name: 'Coca Cola',
    price: 10,
    stock: 20,
    box_units: 12,
    box_price: 100,
    unit_sold: 'PZA'
  };

  it('debe agregar un producto correctamente', () => {
    const { result } = renderHook(() => useCart(mockMostrarError, mockUserAllowNegativeStock));

    act(() => {
      result.current.agregarProducto(mockProducto);
    });

    expect(result.current.carrito).toHaveLength(1);
    expect(result.current.carrito[0].name).toBe('Coca Cola');
    expect(result.current.total).toBe(10);
  });

  it('debe validar stock al agregar producto', () => {
    const { result } = renderHook(() => useCart(mockMostrarError, false));
    const productoSinStock = { ...mockProducto, stock: 0 };

    act(() => {
      result.current.agregarProducto(productoSinStock);
    });

    expect(result.current.carrito).toHaveLength(0);
    expect(mockMostrarError).toHaveBeenCalledWith(expect.stringContaining('Stock insuficiente'));
  });

  it('debe cambiar de PZA a CAJA correctamente (conversión configurada)', () => {
    const { result } = renderHook(() => useCart(mockMostrarError, false));

    act(() => {
      result.current.agregarProducto(mockProducto);
    });

    act(() => {
      result.current.cambiarUnidadVenta(result.current.carrito[0].id, 'CAJA');
    });

    const item = result.current.carrito[0];
    expect(item.unit_sold).toBe('CAJA');
    expect(item.price).toBe(100); // box_price
    expect(item.conversion_factor).toBe(12); // box_units
    expect(result.current.total).toBe(100);
  });

  it('debe permitir cambio a CAJA "al vuelo" aunque no esté configurado', () => {
    const { result } = renderHook(() => useCart(mockMostrarError, false));
    const productoSinCaja = { id: 'p2', name: 'Sabritas', price: 15, stock: 50 };

    act(() => {
      result.current.agregarProducto(productoSinCaja);
    });

    // Cambiar a caja con 10 piezas personalizadas
    // El ID real en el carrito es 'p2::PZA'
    act(() => {
      const cartItem = result.current.carrito[0];
      result.current.cambiarUnidadVenta(cartItem.id, 'CAJA', 10);
    });

    const item = result.current.carrito[0];
    expect(item.unit_sold).toBe('CAJA');
    expect(item.conversion_factor).toBe(10);
    expect(item.price).toBe(150); // 15 * 10
  });

  it('no debe permitir cambio a CAJA si no hay stock suficiente', () => {
    const { result } = renderHook(() => useCart(mockMostrarError, false));
    // Stock 10, pero queremos cambiar a CAJA de 12
    const productoBajoStock = { ...mockProducto, stock: 10 };

    act(() => {
      result.current.agregarProducto(productoBajoStock);
    });

    act(() => {
      result.current.cambiarUnidadVenta(result.current.carrito[0].id, 'CAJA');
    });

    // Se mantiene en PZA porque no hubo stock para la caja
    expect(result.current.carrito[0].unit_sold).toBe('PZA');
    expect(mockMostrarError).toHaveBeenCalled();
  });

  it('debe calcular el total correctamente con múltiples productos', () => {
    const { result } = renderHook(() => useCart(mockMostrarError, false));

    act(() => {
      result.current.agregarProducto(mockProducto);
      result.current.agregarProducto({ id: 'p2', name: 'Pan', price: 5, stock: 10 });
    });

    expect(result.current.total).toBe(15);
  });

  it('debe vaciar el carrito correctamente', () => {
    const { result } = renderHook(() => useCart(mockMostrarError, false));

    act(() => {
      result.current.agregarProducto(mockProducto);
      result.current.vaciarCarrito();
    });

    expect(result.current.carrito).toHaveLength(0);
    expect(result.current.total).toBe(0);
  });

  it('debe conservar unidades reales de ferreteria como metro o kilo', () => {
    const { result } = renderHook(() => useCart(mockMostrarError, false));
    const cable = { id: 'cable-1', name: 'Cable THW', price: 12.5, stock: 100, unit: 'M' };

    act(() => {
      result.current.agregarProducto(cable, 'M');
    });

    expect(result.current.carrito[0].unit_sold).toBe('M');
    expect(result.current.carrito[0].conversion_factor).toBe(1);
    expect(result.current.total).toBe(12.5);
  });

  it('debe convertir un item a paquete personalizado usando convertirAPaquete', () => {
    const { result } = renderHook(() => useCart(mockMostrarError));
    
    act(() => {
        result.current.agregarProducto(mockProducto);
    });

    const item = result.current.carrito[0];

    act(() => {
        // convertirAPaquete(idProducto, piezasPorCaja, precioTotalCaja)
        result.current.convertirAPaquete(item.id, 5, 45);
    });

    expect(result.current.carrito[0].unit_sold).toBe('CAJA');
    expect(result.current.carrito[0].price).toBe(45);
    expect(result.current.carrito[0].conversion_factor).toBe(5);
    expect(result.current.carrito[0].is_custom_pack).toBe(true);
  });
});
