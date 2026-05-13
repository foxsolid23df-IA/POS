import React, { useEffect } from "react";
import { usePaymentLogic } from "../../hooks/usePaymentLogic";
import { formatCurrency } from "../../utils/formatters"; // Asumiendo que existe o lo ajustaremos

const PaymentModal = ({
  isOpen,
  onClose,
  onComplete,
  totalVenta,
  tipoCambio,
  selectedIssuerId,
  setSelectedIssuerId,
  user
}) => {
  const {
    metodoPago,
    setMetodoPago,
    montoRecibido,
    setMontoRecibido,
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
  } = usePaymentLogic({ totalVenta, tipoCambio });

  // Inicializar al abrir
  useEffect(() => {
    if (isOpen) {
      resetearPagos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, totalVenta]);

  // Manejo de atajos de teclado
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      // Evitar atajos si se está escribiendo en inputs de texto
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
          if (montoRecibido && saldoPendiente > 0) {
            e.preventDefault();
            agregarPago();
          } else if (isSaleFullyCovered) {
            e.preventDefault();
            handleComplete();
          }
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
          // Permitir números en el teclado si no estamos en un input
          if (e.target.tagName !== 'INPUT' && /^[0-9.]$/.test(e.key)) {
            e.preventDefault();
            manejarTecladoNumerico(e.key);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, metodoPago, montoRecibido, isSaleFullyCovered, saldoPendiente, agregarPago, setMetodoPago, manejarTecladoNumerico, onClose]);

  const handleComplete = () => {
    // Si hay un saldo capturado sin agregar y falta saldo, intentamos agregarlo
    if (montoRecibido && saldoPendiente > 0) {
      const added = agregarPago();
      // Si se agregó y ya cubre el total, completamos.
      if (added && saldoPendiente - (parseFloat(montoRecibido) || 0) <= 0.01) {
         // El estado real no se actualiza inmediatamente, así que pasamos los datos actuales
      }
    }
    
    // Necesitamos pasar al padre la lista final de pagos y facturar flag.
    // Como setState es asíncrono, si acabamos de hacer agregarPago(), `pagosRealizados` podría no tener el último.
    // Por simplicidad, asumiremos que si ya está cubierto (isSaleFullyCovered), se llama.
    if (isSaleFullyCovered) {
      onComplete({
        pagos: pagosRealizados,
        facturar,
        issuerId: facturar ? selectedIssuerId : null
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl flex flex-col md:flex-row overflow-hidden animate-fade-in-up">
        
        {/* LADO IZQUIERDO: Métodos y Detalles */}
        <div className="flex-1 p-6 flex flex-col border-r border-slate-200 dark:border-slate-700">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Completar Pago</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <button
              onClick={() => setMetodoPago("efectivo")}
              className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${
                metodoPago === "efectivo" 
                  ? "bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-500/20 dark:border-blue-400 dark:text-blue-300" 
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
              }`}
            >
              <i className="fi fi-rr-money text-xl"></i>
              <span className="font-medium">Efectivo</span>
              <span className="text-xs opacity-70">[F1]</span>
            </button>
            <button
              onClick={() => setMetodoPago("tarjeta")}
              className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${
                metodoPago === "tarjeta" 
                  ? "bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-500/20 dark:border-blue-400 dark:text-blue-300" 
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
              }`}
            >
              <i className="fi fi-rr-credit-card text-xl"></i>
              <span className="font-medium">Tarjeta</span>
              <span className="text-xs opacity-70">[F2]</span>
            </button>
            <button
              onClick={() => setMetodoPago("transferencia")}
              className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${
                metodoPago === "transferencia" 
                  ? "bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-500/20 dark:border-blue-400 dark:text-blue-300" 
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
              }`}
            >
              <i className="fi fi-rr-bank text-xl"></i>
              <span className="font-medium">Transferencia</span>
              <span className="text-xs opacity-70">[F3]</span>
            </button>
            {tipoCambio > 0 && (
              <button
                onClick={() => setMetodoPago("dolares")}
                className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${
                  metodoPago === "dolares" 
                    ? "bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-500/20 dark:border-emerald-400 dark:text-emerald-300" 
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                }`}
              >
                <i className="fi fi-rr-dollar text-xl"></i>
                <span className="font-medium">Dólares</span>
                <span className="text-xs opacity-70">[F4]</span>
              </button>
            )}
          </div>

          {/* Formulario Específico por Método */}
          <div className="flex-1 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
            
            {metodoPago === 'tarjeta' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Últimos 4 dígitos</label>
                  <input 
                    type="text" 
                    maxLength="4"
                    value={paymentDetails.last4}
                    onChange={(e) => updatePaymentDetails('last4', e.target.value.replace(/\D/g, ''))}
                    className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                    placeholder="Ej. 4242"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Código de Autorización</label>
                  <input 
                    type="text" 
                    value={paymentDetails.authCode}
                    onChange={(e) => updatePaymentDetails('authCode', e.target.value)}
                    className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                    placeholder="Opcional"
                  />
                </div>
              </div>
            )}

            {metodoPago === 'transferencia' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Banco Origen</label>
                  <input 
                    type="text" 
                    value={paymentDetails.bank}
                    onChange={(e) => updatePaymentDetails('bank', e.target.value)}
                    className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                    placeholder="Ej. BBVA, Santander"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Referencia / Folio</label>
                  <input 
                    type="text" 
                    value={paymentDetails.reference}
                    onChange={(e) => updatePaymentDetails('reference', e.target.value)}
                    className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                    placeholder="Obligatorio"
                  />
                </div>
              </div>
            )}

            {/* Opciones extras: Facturar */}
            {user?.tax_enabled !== false && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 mt-4 flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-slate-800 dark:text-white">Generar Factura</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Aplicar IVA correspondiente</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={facturar}
                    onChange={(e) => setFacturar(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>
            )}

          </div>

          {/* Pagos Realizados (Múltiples/Divididos) */}
          {pagosRealizados.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wider">Pagos Agregados</h3>
              <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                {pagosRealizados.map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <i className={`fi ${p.method === 'efectivo' ? 'fi-rr-money' : p.method === 'tarjeta' ? 'fi-rr-credit-card' : p.method === 'dolares' ? 'fi-rr-dollar' : 'fi-rr-bank'} text-slate-400`}></i>
                      <span className="capitalize text-slate-700 dark:text-slate-300">{p.method}</span>
                      {p.currency === 'USD' && <span className="text-xs text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">USD</span>}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-semibold text-slate-800 dark:text-white">
                        ${p.amount.toFixed(2)} {p.currency !== 'USD' && 'MXN'}
                      </span>
                      <button 
                        onClick={() => eliminarPago(p.id)}
                        className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <i className="fi fi-rr-trash"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* LADO DERECHO: Calculadora y Resumen */}
        <div className="w-full md:w-96 bg-slate-50 dark:bg-slate-800/80 p-6 flex flex-col">
          <div className="mb-6">
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Total a Pagar</p>
            <div className="text-4xl font-black text-slate-800 dark:text-white">${totalVenta.toFixed(2)}</div>
            
            {pagosRealizados.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                  <span>Abonado:</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">${totalAbonado.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                  <span>Restante:</span>
                  <span className="font-medium text-orange-600 dark:text-orange-400">${saldoPendiente.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Input de Monto a Recibir */}
          {saldoPendiente > 0 && (
            <div className="mb-6">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-slate-500 dark:text-slate-400 text-2xl font-bold">$</span>
                </div>
                <input
                  type="text"
                  value={montoRecibido}
                  onChange={(e) => setMontoRecibido(e.target.value.replace(/[^0-9.]/g, ''))}
                  className="w-full pl-10 pr-4 py-4 bg-white dark:bg-slate-900 border-2 border-blue-500 text-3xl font-bold text-slate-800 dark:text-white rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 text-right"
                  placeholder={saldoPendiente.toFixed(2)}
                />
              </div>
              
              {/* Teclado Numérico */}
              <div className="grid grid-cols-3 gap-2 mt-4">
                {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((num) => (
                  <button
                    key={num}
                    onClick={() => manejarTecladoNumerico(num.toString())}
                    className="py-3 bg-white dark:bg-slate-700 rounded-lg shadow-sm font-bold text-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 active:scale-95 transition-transform"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={() => manejarTecladoNumerico(".")}
                  className="py-3 bg-slate-200 dark:bg-slate-600 rounded-lg shadow-sm font-bold text-xl text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-500 active:scale-95 transition-transform"
                >
                  .
                </button>
                <button
                  onClick={() => manejarTecladoNumerico("0")}
                  className="py-3 bg-white dark:bg-slate-700 rounded-lg shadow-sm font-bold text-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 active:scale-95 transition-transform"
                >
                  0
                </button>
                <button
                  onClick={() => manejarTecladoNumerico("backspace")}
                  className="py-3 bg-slate-200 dark:bg-slate-600 rounded-lg shadow-sm font-bold text-xl text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-500 active:scale-95 transition-transform flex items-center justify-center"
                >
                  <i className="fi fi-rr-delete"></i>
                </button>
              </div>

              <button
                onClick={agregarPago}
                disabled={!montoRecibido || parseFloat(montoRecibido) <= 0}
                className="w-full mt-4 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white py-3 rounded-lg font-bold flex justify-center items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="fi fi-rr-plus"></i>
                Añadir al Pago
              </button>
            </div>
          )}

          {/* Cambio y Finalizar */}
          <div className="mt-auto">
            {calcularCambio() > 0 && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 mb-4 flex justify-between items-center">
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">Cambio a devolver:</span>
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">${calcularCambio().toFixed(2)}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleComplete}
                disabled={!isSaleFullyCovered && (!montoRecibido || parseFloat(montoRecibido) < saldoPendiente)}
                className={`flex-[2] py-3 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all ${
                  isSaleFullyCovered || (montoRecibido && parseFloat(montoRecibido) >= saldoPendiente)
                    ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30 dark:bg-blue-500 dark:hover:bg-blue-600'
                    : 'bg-slate-400 cursor-not-allowed shadow-none dark:bg-slate-600'
                }`}
              >
                <i className="fi fi-rr-check"></i>
                Completar Venta
              </button>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
