import React, { useState, useEffect } from 'react';
import { customerService } from '../../services/customerService';

function formatCurrency(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return '';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function unformat(value) {
  return value.replace(/[^0-9.]/g, '');
}

const CustomerRegister = ({ onCustomerAdded, editData, onCancelEdit }) => {
  const [form, setForm] = useState({ name: '', rfc: '', phone: '', credit_limit: '', payment_terms: 30, credit_notes: '', credit_hold: false });
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState(false);

  const isEditing = !!editData;

  useEffect(() => {
    if (editData) {
      setForm({
        name: editData.name || '',
        rfc: editData.rfc || '',
        phone: editData.phone || '',
        credit_limit: editData.credit_limit ? String(editData.credit_limit) : '',
        payment_terms: editData.payment_terms || 30,
        credit_notes: editData.credit_notes || '',
        credit_hold: editData.credit_hold || false
      });
    }
  }, [editData]);

  const handleChange = (field) => (e) => {
    setExito(false);
    if (field === 'credit_limit') {
      const raw = unformat(e.target.value);
      const parts = raw.split('.');
      if (parts.length > 2) return;
      if (parts[1] && parts[1].length > 2) return;
      setForm(prev => ({ ...prev, credit_limit: raw }));
      return;
    }
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleBlurCreditLimit = () => {
    setForm(prev => ({
      ...prev,
      credit_limit: prev.credit_limit ? formatCurrency(prev.credit_limit) : ''
    }));
  };

  const handleFocusCreditLimit = () => {
    setForm(prev => ({
      ...prev,
      credit_limit: prev.credit_limit ? unformat(prev.credit_limit) : ''
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setGuardando(true);
    try {
      const payload = {
        name: form.name.trim(),
        rfc: form.rfc.trim(),
        phone: form.phone.trim(),
        credit_limit: form.credit_limit ? parseFloat(unformat(form.credit_limit)) : null,
        payment_terms: parseInt(form.payment_terms) || 30,
        credit_notes: form.credit_notes.trim(),
        credit_hold: form.credit_hold
      };
      if (isEditing) {
        await customerService.update(editData.id, payload);
      } else {
        await customerService.create(payload);
      }
      setForm({ name: '', rfc: '', phone: '', credit_limit: '', payment_terms: 30, credit_notes: '', credit_hold: false });
      setExito(true);
      setTimeout(() => setExito(false), 3000);
      if (onCustomerAdded) onCustomerAdded();
    } catch (err) {
      console.error('Error al guardar cliente:', err);
    } finally {
      setGuardando(false);
    }
  };

  const handleCancel = () => {
    setForm({ name: '', rfc: '', phone: '' });
    if (onCancelEdit) onCancelEdit();
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded-lg">
            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-xl">
              {isEditing ? 'edit' : 'person_add'}
            </span>
          </div>
          <span className="font-bold text-gray-800 dark:text-white text-sm">
            {isEditing ? 'Editar Cliente' : 'Registro de Cliente'}
          </span>
        </div>
      </div>

      <div className="px-4 pb-4 border-t border-gray-100 dark:border-slate-700">
        <form onSubmit={handleSubmit} className="space-y-3 pt-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nombre</label>
            <input
              type="text"
              value={form.name}
              onChange={handleChange('name')}
              placeholder="Nombre del cliente"
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">RFC</label>
              <input
                type="text"
                value={form.rfc}
                onChange={handleChange('rfc')}
                placeholder="RFC"
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Teléfono</label>
              <input
                type="tel"
                value={form.phone}
                onChange={handleChange('phone')}
                placeholder="Teléfono"
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-slate-700 pt-3 mt-2">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">credit_score</span>
              Configuración de Crédito
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Límite de Crédito ($)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.credit_limit}
                  onChange={handleChange('credit_limit')}
                  onFocus={handleFocusCreditLimit}
                  onBlur={handleBlurCreditLimit}
                  placeholder="Límite de crédito (opcional)"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Días de Crédito</label>
                <select
                  value={form.payment_terms}
                  onChange={handleChange('payment_terms')}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                >
                  <option value={7}>7 Días</option>
                  <option value={15}>15 Días</option>
                  <option value={30}>30 Días</option>
                  <option value={45}>45 Días</option>
                  <option value={60}>60 Días</option>
                </select>
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notas de Crédito</label>
              <input
                type="text"
                value={form.credit_notes}
                onChange={handleChange('credit_notes')}
                placeholder="Referencias, condiciones, etc."
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.credit_hold}
                onChange={(e) => setForm(prev => ({ ...prev, credit_hold: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Bloquear crédito (no permitir ventas a crédito)</span>
            </label>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={!form.name.trim() || guardando}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5"
            >
              {guardando ? (
                <span className="material-symbols-outlined text-base animate-spin">refresh</span>
              ) : (
                <span className="material-symbols-outlined text-base">{isEditing ? 'check' : 'save'}</span>
              )}
              {guardando ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Guardar')}
            </button>

            {isEditing && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 text-sm font-semibold rounded-lg transition-colors"
              >
                Cancelar
              </button>
            )}

            {exito && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-base">check_circle</span>
                {isEditing ? 'Cliente actualizado' : 'Cliente registrado'}
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerRegister;
