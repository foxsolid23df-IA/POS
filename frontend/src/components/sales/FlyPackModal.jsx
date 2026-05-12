import React from "react";

export const FlyPackModal = ({
  isOpen,
  onClose,
  item,
  presets,
  empaqueForm,
  setEmpaqueForm,
  handleSelectPreset,
  handleDeletePreset,
  guardarComoPreset,
  setGuardarComoPreset,
  handleConfirmarEmpaque,
  formatearDinero
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in fade-in duration-200 overflow-hidden flex flex-col max-h-[90vh]">
        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-500">
            inventory_2
          </span>
          Empaque al Vuelo
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          {item?.name}
        </p>

        <div className="overflow-y-auto pr-1 flex-1 space-y-4">
          {/* Presets Guardados */}
          {presets.length > 0 && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Configuraciones Guardadas
              </label>
              <div className="grid grid-cols-2 gap-2">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className={`group relative p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col ${
                      Number(empaqueForm.piezas) === Number(preset.units) &&
                      Number(empaqueForm.precio) === Number(preset.price)
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800"
                    }`}
                  >
                    <span className="text-lg font-bold text-slate-800 dark:text-white">
                      {preset.units}{" "}
                      <span className="text-[10px] font-normal">Pzas</span>
                    </span>
                    <span className="text-xs font-mono text-blue-600 dark:text-blue-400">
                      {formatearDinero(preset.price)}
                    </span>
                    <button
                      onClick={(e) => handleDeletePreset(e, preset.id)}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        close
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form
            onSubmit={handleConfirmarEmpaque}
            className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Piezas por Caja
                </label>
                <input
                  type="number"
                  required
                  autoFocus
                  min="1"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white font-bold"
                  value={empaqueForm.piezas}
                  onChange={(e) =>
                    setEmpaqueForm({
                      ...empaqueForm,
                      piezas: e.target.value,
                    })
                  }
                  placeholder="12"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Precio Total (MXN)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white font-mono font-bold"
                  value={empaqueForm.precio}
                  onChange={(e) =>
                    setEmpaqueForm({
                      ...empaqueForm,
                      precio: e.target.value,
                    })
                  }
                  placeholder="0.00"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer group p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  guardarComoPreset
                    ? "bg-blue-500 border-blue-500"
                    : "border-slate-300 dark:border-slate-600"
                }`}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={guardarComoPreset}
                  onChange={(e) => setGuardarComoPreset(e.target.checked)}
                />
                {guardarComoPreset && (
                  <span className="material-symbols-outlined text-[14px] text-white font-bold">
                    check
                  </span>
                )}
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200">
                Guardar como configuración rápida
              </span>
            </label>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-medium shadow-sm hover:shadow-md"
              >
                Confirmar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
