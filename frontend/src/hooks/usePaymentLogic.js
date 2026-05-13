import { useState, useMemo, useRef, useEffect } from 'react';

export const usePaymentLogic = ({ totalVenta, tipoCambio = 1 }) => {
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [montoRecibido, setMontoRecibido] = useState('');
  const [pagosRealizados, setPagosRealizados] = useState([]);
  const [facturar, setFacturar] = useState(false);
  
  // Datos adicionales según el método
  const [paymentDetails, setPaymentDetails] = useState({
    authCode: '',
    last4: '',
    bank: '',
    reference: ''
  });

  // Para evitar problemas de stale closures en listeners de teclado
  const montoRecibidoRef = useRef(montoRecibido);
  useEffect(() => {
    montoRecibidoRef.current = montoRecibido;
  }, [montoRecibido]);

  // Cálculos derivados
  const totalAbonado = useMemo(() => {
    return pagosRealizados.reduce((sum, p) => sum + p.amount, 0);
  }, [pagosRealizados]);

  const saldoPendiente = useMemo(() => {
    return Math.max(0, totalVenta - totalAbonado);
  }, [totalVenta, totalAbonado]);

  const manejarTecladoNumerico = (valor) => {
    setMontoRecibido((prev) => {
      if (valor === 'backspace') {
        return prev.slice(0, -1);
      } else if (valor === '.') {
        if (!prev.includes('.')) {
          return prev + '.';
        }
        return prev;
      } else {
        if (prev.includes('.')) {
          const parts = prev.split('.');
          if (parts[1] && parts[1].length >= 2) {
            return prev;
          }
        }
        return prev + valor;
      }
    });
  };

  const calcularCambio = () => {
    const monto = parseFloat(montoRecibidoRef.current || montoRecibido) || 0;

    if (metodoPago === 'dolares' && tipoCambio) {
      const totalEnPesos = monto * tipoCambio;
      return Math.max(0, totalEnPesos - saldoPendiente);
    }

    return Math.max(0, monto - saldoPendiente);
  };

  const agregarPago = () => {
    const montoStr = montoRecibidoRef.current || montoRecibido;
    const montoNum = parseFloat(montoStr) || 0;

    if (montoNum <= 0) return false;
    if (saldoPendiente <= 0) return false; // Ya no hay saldo que cubrir

    let montoAbonado = montoNum;
    let cambio = 0;

    if (metodoPago === 'efectivo') {
      if (montoNum > saldoPendiente) {
        montoAbonado = saldoPendiente;
        cambio = montoNum - saldoPendiente;
      }
    } else if (metodoPago === 'dolares') {
      const enPesos = montoNum * tipoCambio;
      if (enPesos > saldoPendiente) {
        montoAbonado = saldoPendiente;
        cambio = enPesos - saldoPendiente;
      } else {
        montoAbonado = enPesos;
      }
    } else {
      // Tarjeta, Transferencia (normalmente exactos, pero pueden pasarse)
      if (montoNum > saldoPendiente) {
        montoAbonado = saldoPendiente;
        cambio = montoNum - saldoPendiente;
      }
    }

    const nuevoPago = {
      id: Date.now(),
      method: metodoPago,
      amount: montoAbonado,
      received: montoNum,
      change: cambio,
      currency: metodoPago === 'dolares' ? 'USD' : 'MXN',
      exchange_rate: metodoPago === 'dolares' ? tipoCambio : null,
      details: { ...paymentDetails } // guardamos la copia actual
    };

    setPagosRealizados((prev) => [...prev, nuevoPago]);
    setMontoRecibido('');
    setPaymentDetails({ authCode: '', last4: '', bank: '', reference: '' }); // Reset
    return true;
  };

  const eliminarPago = (id) => {
    setPagosRealizados((prev) => prev.filter((p) => p.id !== id));
  };

  const resetearPagos = () => {
    setPagosRealizados([]);
    setMontoRecibido((totalVenta).toFixed(2));
    setMetodoPago('efectivo');
    setFacturar(false);
    setPaymentDetails({ authCode: '', last4: '', bank: '', reference: '' });
  };

  const updatePaymentDetails = (field, value) => {
    setPaymentDetails(prev => ({ ...prev, [field]: value }));
  };

  const isSaleFullyCovered = saldoPendiente <= 0;

  return {
    metodoPago,
    setMetodoPago,
    montoRecibido,
    setMontoRecibido,
    montoRecibidoRef,
    pagosRealizados,
    facturar,
    setFacturar,
    paymentDetails,
    updatePaymentDetails,
    totalAbonado,
    saldoPendiente,
    manejarTecladoNumerico,
    calcularCambio,
    agregarPago,
    eliminarPago,
    resetearPagos,
    isSaleFullyCovered
  };
};
