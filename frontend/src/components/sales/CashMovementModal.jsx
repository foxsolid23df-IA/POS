import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { cashMovementService } from "../../services/cashMovementService";
import Swal from "sweetalert2";

export const CashMovementModal = ({ onClose, onSuccess }) => {
  const { activeStaff } = useAuth();
  const [type, setType] = useState("salida");
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!amount || parseFloat(amount) <= 0) {
      Swal.fire("Error", "Ingrese un monto válido mayor a 0", "warning");
      return;
    }

    if (!concept.trim()) {
      Swal.fire("Error", "Ingrese un concepto para el movimiento", "warning");
      return;
    }

    try {
      setSubmitting(true);
      await cashMovementService.registerMovement(
        type,
        parseFloat(amount),
        concept,
        activeStaff?.name,
      );

      Swal.fire({
        title: "¡Éxito!",
        text: "Movimiento registrado correctamente",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });

      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (error) {
      console.error("Error registrando movimiento:", error);
      Swal.fire(
        "Error",
        error.message || "No se pudo registrar el movimiento",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-xl">
              <span className="material-symbols-rounded text-emerald-600 dark:text-emerald-400">
                app_registration
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
              Movimiento de Caja
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setType("entrada")}
              className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all flex justify-center items-center gap-2 ${
                type === "entrada"
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              <span className="material-symbols-rounded text-[20px]">
                arrow_downward
              </span>
              Depósito
            </button>
            <button
              type="button"
              onClick={() => setType("salida")}
              className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all flex justify-center items-center gap-2 ${
                type === "salida"
                  ? "bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              <span className="material-symbols-rounded text-[20px]">
                arrow_upward
              </span>
              Retiro
            </button>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              Cantidad
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border bg-transparent border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent text-slate-900 dark:text-white"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              Concepto / Motivo
            </label>
            <input
              type="text"
              required
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border bg-transparent border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent text-slate-900 dark:text-white"
              placeholder={
                type === "salida" ? "Ej. Pago de agua" : "Ej. Cambio inicial"
              }
            />
          </div>

          <div className="flex gap-3 justify-end mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-6 py-2.5 rounded-xl font-bold text-white transition-all flex items-center gap-2 ${
                type === "entrada"
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-rose-600 hover:bg-rose-700"
              } disabled:opacity-50`}
            >
              {submitting && (
                <span className="animate-spin material-symbols-rounded text-sm">
                  progress_activity
                </span>
              )}
              {type === "entrada" ? "Registrar Depósito" : "Registrar Retiro"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
