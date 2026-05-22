import React, { useEffect, useState, useMemo } from "react";
import { usePaymentLogic } from "../../hooks/usePaymentLogic";
import { formatearDinero } from "../../utils/formatters";

const PaymentModal = ({
  isOpen,
  onClose,
  onComplete,
  total,
  taxRate = 0,
  tipoCambio,
  selectedIssuerId,
  setSelectedIssuerId,
  issuers = [],
  user,
  transactionId
}) => {
  const [facturar, setFacturar] = useState(false);

  const totalVenta = useMemo(() => {
    if (!facturar) return total;
    
    // Si el IVA ya está incluido en los precios, el total no cambia al facturar
    if (user?.tax_included !== false) {
      return total;
    }
    
    // Si el IVA NO está incluido, lo sumamos al total original
    return total * (1 + taxRate / 100);
  }, [total, taxRate, facturar, user?.tax_included]);

  const {
    metodoPago,
    setMetodoPago,
    montoRecibido,
    setMontoRecibido,
    pagosRealizados,
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
  } = usePaymentLogic({ totalVenta, tipoCambio });

  const { subtotal, taxAmount } = useMemo(() => {
    let sub = totalVenta;
    let tax = 0;

    if (facturar && taxRate > 0) {
      if (user?.tax_included !== false) {
        // IVA incluido: Extraemos el IVA del total
        tax = totalVenta - (totalVenta / (1 + taxRate / 100));
        sub = totalVenta - tax;
      } else {
        // IVA no incluido: El totalVenta ya tiene el IVA sumado
        sub = total;
        tax = totalVenta - total;
      }
    }

    return { subtotal: sub, taxAmount: tax };
  }, [total, totalVenta, facturar, taxRate, user?.tax_included]);

  useEffect(() => {
    if (isOpen) {
      resetearPagos();
    }
  }, [isOpen]);

  const handleComplete = () => {
    let finalPayments = pagosRealizados;
    let covered = isSaleFullyCovered;

    // Si hay un monto ingresado, primero intentamos agregarlo
    if (montoRecibido && saldoPendiente > 0) {
      const result = agregarPago();
      if (result && result.success) {
        finalPayments = result.updatedPayments;
        covered = result.fullyCovered;
      } else {
        // Si falló agregar el pago (monto inválido), no continuamos
        return;
      }
    }

    // Si después de (posiblemente) agregar el pago, la venta está cubierta, finalizamos
    if (covered) {
      onComplete({
        pagos: finalPayments,
        facturar,
        issuerId: facturar ? selectedIssuerId : null
      });
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' && e.target.type === 'text') return;

      switch (e.key) {
        case "F1":
          e.preventDefault();
          setMetodoPago("efectivo");
          break;
        case "F2":
          e.preventDefault();
          setMetodoPago("tarjeta");
          break;
        case "F3":
          e.preventDefault();
          setMetodoPago("transferencia");
          break;
        case "F4":
          e.preventDefault();
          if (tipoCambio) setMetodoPago("dolares");
          break;
        case "Enter":
          e.preventDefault();
          handleComplete();
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        case "Backspace":
          if (e.target.tagName !== 'INPUT') {
            e.preventDefault();
            manejarTecladoNumerico("backspace");
          }
          break;
        default:
          if (e.target.tagName !== 'INPUT' && /^[0-9.]$/.test(e.key)) {
            e.preventDefault();
            manejarTecladoNumerico(e.key);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, metodoPago, montoRecibido, isSaleFullyCovered, saldoPendiente, agregarPago, setMetodoPago, manejarTecladoNumerico, onClose, tipoCambio, handleComplete]);

  if (!isOpen) return null;

  const methods = [
    { id: "efectivo", icon: "payments", label: "Efectivo", key: "F1" },
    { id: "tarjeta", icon: "credit_card", label: "Tarjeta", key: "F2" },
    { id: "transferencia", icon: "account_balance", label: "Transferencia", key: "F3" },
    { id: "dolares", icon: "currency_exchange", label: "Dólares", key: "F4", hidden: !tipoCambio },
  ];

  const cambio = saldoPendiente > 0
    ? calcularCambio()
    : (pagosRealizados.length > 0 ? pagosRealizados[pagosRealizados.length - 1].change : 0);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[1100px] flex flex-col md:flex-row overflow-hidden max-h-[95vh] animate-fade-in-up">

        {/* LEFT COLUMN */}
        <div className="flex-1 p-8 flex flex-col overflow-y-auto">

          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Completar Pago</h2>
            {transactionId && (
              <span className="text-sm font-medium text-gray-400 bg-gray-100 px-3 py-1 rounded-lg">
                #{transactionId}
              </span>
            )}
          </div>

          {/* Method Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            {methods.filter(m => !m.hidden).map(method => {
              const isSelected = metodoPago === method.id;
              return (
                <button
                  key={method.id}
                  onClick={() => setMetodoPago(method.id)}
                  className={`relative p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                      : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700"
                  }`}
                >
                  <span className="material-symbols-outlined text-[1.75rem]">{method.icon}</span>
                  <span className="font-semibold text-sm leading-tight">{method.label}</span>
                  <span className={`text-[11px] font-medium ${isSelected ? "text-blue-400" : "text-gray-400"}`}>[{method.key}]</span>
                </button>
              );
            })}
          </div>

          {/* Conditional forms for card/transfer */}
          {(metodoPago === 'tarjeta' || metodoPago === 'transferencia') && (
            <div className="bg-gray-50 rounded-xl p-5 mb-6 border border-gray-200 space-y-4">
              {metodoPago === 'tarjeta' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">Últimos 4 dígitos</label>
                    <input
                      type="text" maxLength="4"
                      value={paymentDetails.last4}
                      onChange={(e) => updatePaymentDetails('last4', e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      placeholder="Ej. 4242"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">Código de Autorización</label>
                    <input
                      type="text"
                      value={paymentDetails.authCode}
                      onChange={(e) => updatePaymentDetails('authCode', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      placeholder="Opcional"
                    />
                  </div>
                </div>
              )}
              {metodoPago === 'transferencia' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">Banco Origen</label>
                    <input
                      type="text"
                      value={paymentDetails.bank}
                      onChange={(e) => updatePaymentDetails('bank', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      placeholder="Ej. BBVA, Santander"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">Referencia / Folio</label>
                    <input
                      type="text"
                      value={paymentDetails.reference}
                      onChange={(e) => updatePaymentDetails('reference', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      placeholder="Obligatorio"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Invoice Toggle */}
          {user?.tax_enabled !== false && (
            <div className="flex items-center justify-between py-4 px-5 bg-gray-50 rounded-xl border border-gray-200 mb-6">
              <div>
                <h4 className="font-semibold text-gray-800">Generar Factura</h4>
                <p className="text-sm text-gray-500">Aplicar IVA correspondiente ({taxRate}%)</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={facturar}
                  onChange={(e) => setFacturar(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          )}

          {/* Issuer Selector */}
          {facturar && issuers.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Emisor de Factura</label>
              <select
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                value={selectedIssuerId}
                onChange={(e) => setSelectedIssuerId(e.target.value)}
              >
                {issuers.map((i) => (
                  <option key={i.id} value={i.id}>{i.razon_social}</option>
                ))}
              </select>
            </div>
          )}

          {/* Registered Payments List */}
          {pagosRealizados.length > 0 && (
            <div className="mt-auto">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-base">receipt_long</span>
                Pagos Agregados
              </h3>
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {pagosRealizados.map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-gray-400 text-xl">
                        {p.method === 'efectivo' ? 'payments' : p.method === 'tarjeta' ? 'credit_card' : p.method === 'dolares' ? 'currency_exchange' : 'account_balance'}
                      </span>
                      <div>
                        <span className="capitalize text-sm font-medium text-gray-700">{p.method}</span>
                        {p.currency === 'USD' && (
                          <span className="ml-2 text-[11px] text-emerald-600 bg-emerald-50 font-semibold px-1.5 py-0.5 rounded">USD</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-800">{formatearDinero(p.amount)}</span>
                      <button
                        onClick={() => eliminarPago(p.id)}
                        className="text-red-300 hover:text-red-500 p-1 rounded-md hover:bg-red-50 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">close</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN */}
        <div className="w-full md:w-[400px] lg:w-[420px] bg-gray-50/90 p-8 flex flex-col border-t md:border-t-0 md:border-l border-gray-200">

          {/* Total Display */}
          <div className="mb-7">
            {(facturar || taxAmount > 0) && (
              <div className="space-y-1 mb-4 pb-4 border-b border-gray-200/60">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">Subtotal</span>
                  <span className="text-gray-900 font-bold">{formatearDinero(subtotal)}</span>
                </div>
                {taxAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 font-medium">IVA ({taxRate}%)</span>
                    <span className="text-gray-900 font-bold">{formatearDinero(taxAmount)}</span>
                  </div>
                )}
              </div>
            )}

            <p className="text-sm font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Total a Pagar</p>
            <div className="text-4xl lg:text-5xl font-black text-gray-900 tracking-tight leading-none">
              {formatearDinero(totalVenta)}
            </div>
            {pagosRealizados.length > 0 && (
              <div className="mt-4 space-y-2 pt-4 border-t border-gray-200">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Abonado:</span>
                  <span className="font-semibold text-emerald-600">{formatearDinero(totalAbonado)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Restante:</span>
                  <span className="font-semibold text-orange-500">{formatearDinero(saldoPendiente)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Amount Input + Numpad */}
          {saldoPendiente > 0 && (
            <>
              <div className="relative mb-5">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                  <span className="text-gray-400 text-2xl font-bold">$</span>
                </div>
                <input
                  type="text"
                  value={montoRecibido}
                  onChange={(e) => setMontoRecibido(e.target.value.replace(/[^0-9.]/g, ''))}
                  className="w-full pl-10 pr-4 py-3.5 bg-white border-2 border-blue-500 text-3xl font-bold text-gray-900 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/20 text-right transition-shadow"
                  placeholder={saldoPendiente.toFixed(2)}
                />
              </div>

              {/* Numpad */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((num) => (
                  <button
                    key={num}
                    onClick={() => manejarTecladoNumerico(num.toString())}
                    className="py-3.5 bg-white rounded-xl shadow-sm border border-gray-100 font-bold text-xl text-gray-700 hover:bg-gray-100 active:scale-95 transition-all"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={() => manejarTecladoNumerico(".")}
                  className="py-3.5 bg-white rounded-xl shadow-sm border border-gray-100 font-bold text-xl text-gray-700 hover:bg-gray-100 active:scale-95 transition-all"
                >
                  .
                </button>
                <button
                  onClick={() => manejarTecladoNumerico("0")}
                  className="py-3.5 bg-white rounded-xl shadow-sm border border-gray-100 font-bold text-xl text-gray-700 hover:bg-gray-100 active:scale-95 transition-all"
                >
                  0
                </button>
                <button
                  onClick={() => manejarTecladoNumerico("backspace")}
                  className="py-3.5 bg-white rounded-xl shadow-sm border border-gray-100 font-bold text-xl text-gray-700 hover:bg-gray-100 active:scale-95 transition-all flex items-center justify-center"
                >
                  <span className="material-symbols-outlined">backspace</span>
                </button>
              </div>

              {/* Add to Payment */}
              <button
                onClick={agregarPago}
                disabled={!montoRecibido || parseFloat(montoRecibido) <= 0}
                className="w-full py-3.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed mb-2"
              >
                <span className="material-symbols-outlined">add</span>
                Añadir al Pago
              </button>

              {/* Exchange rate info */}
              {metodoPago === "dolares" && tipoCambio && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1 mb-3">
                  <span className="material-symbols-outlined text-sm">info</span>
                  1 USD = ${tipoCambio} MXN
                </div>
              )}
            </>
          )}

          {/* Spacer */}
          <div className="flex-1 min-h-4" />

          {/* Change Display */}
          {cambio > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4 flex justify-between items-center">
              <span className="text-emerald-700 font-medium flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-500">currency_exchange</span>
                Cambio a devolver
              </span>
              <span className="text-2xl font-bold text-emerald-600">{formatearDinero(cambio)}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3.5 bg-white border-2 border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98] transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleComplete}
              disabled={!isSaleFullyCovered}
              className="flex-[2] py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none active:scale-[0.98]"
            >
              <span className="material-symbols-outlined">check_circle</span>
              Completar Venta
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
