import React, { useState, useEffect } from 'react';
import { customerService } from '../../services/customerService';

const CustomerRegister = ({ onCustomerAdded, editData, onCancelEdit }) => {
  const [form, setForm] = useState({ name: '', rfc: '', phone: '' });
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState(false);

  const isEditing = !!editData;

  useEffect(() => {
    if (editData) {
      setForm({
        name: editData.name || '',
        rfc: editData.rfc || '',
        phone: editData.phone || ''
      });
    }
  }, [editData]);

  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    setExito(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setGuardando(true);
    try {
      if (isEditing) {
        await customerService.update(editData.id, {
          name: form.name.trim(),
          rfc: form.rfc.trim(),
          phone: form.phone.trim()
        });
      } else {
        await customerService.create({
          name: form.name.trim(),
          rfc: form.rfc.trim(),
          phone: form.phone.trim()
        });
      }
      setForm({ name: '', rfc: '', phone: '' });
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
