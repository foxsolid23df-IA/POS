import React, { useState, useEffect } from 'react';
import { creditService } from '../../services/creditService';
import { formatearDinero } from '../../utils/formatters';

export const RegisterPaymentModal = ({ customer, onClose, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingSales, setPendingSales] = useState([]);
  const [selectedSaleId, setSelectedSaleId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const sales = await creditService.getPendingCreditSales(customer.id);
        setPendingSales(sales || []);
      } catch (err) {
        console.error(err);
      }
    };
    if (customer?.id) load();
  }, [customer?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!val || val <= 0) { setError('Ingrese un monto válido'); return; }
    if (val > parseFloat(customer.credit_balance || 0)) {
      setError(`El abono no puede ser mayor al saldo pendiente (${formatearDinero(customer.credit_balance)})`);
      return;
    }

    setSaving(true);
    setError('');
    try {
      await creditService.registerPayment({
        customerId: customer.id,
        saleId: selectedSaleId || null,
        amount: val,
        paymentMethod,
        reference,
        notes
      });
      onSuccess();
    } catch (err) {
      setError(err.message || 'Error al registrar el abono');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden animate-fade-in-up">
        <div className="px-6 pt-5 pb-3 border-b border-gray-100 dark:border-slate-700">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600">payments</span>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Registrar Abono</h3>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{customer.name}</p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Saldo actual:</span>
              <span className="font-bold text-gray-900 dark:text-white">{formatearDinero(customer.credit_balance)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Límite de crédito:</span>
              <span className="font-bold text-gray-900 dark:text-white">{formatearDinero(customer.credit_limit)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Disponible:</span>
              <span className="font-bold text-emerald-600">{formatearDinero(Math.max(0, parseFloat(customer.credit_limit || 0) - parseFloat(customer.credit_balance || 0)))}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Monto del Abono *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={customer.credit_balance}
              required
              autoFocus
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white font-mono text-lg font-bold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Método de Pago</label>
            <select
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </div>

          {pendingSales.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vincular a Venta (opcional)</label>
              <select
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                value={selectedSaleId}
                onChange={(e) => setSelectedSaleId(e.target.value)}
              >
                <option value="">Sin vincular</option>
                {pendingSales.map(s => (
                  <option key={s.id} value={s.id}>
                    V-{s.id} - {formatearDinero(s.total)} (Saldo: {formatearDinero(s.balance)})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Referencia</label>
            <input
              type="text"
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="Folio, autorización, etc."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notas</label>
            <textarea
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
              rows="2"
              placeholder="Notas opcionales"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm font-medium">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !amount || parseFloat(amount) <= 0}
              className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/25 disabled:shadow-none"
            >
              {saving ? (
                <span className="material-symbols-outlined animate-spin">refresh</span>
              ) : (
                <span className="material-symbols-outlined">check</span>
              )}
              {saving ? 'Registrando...' : 'Registrar Abono'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterPaymentModal;
