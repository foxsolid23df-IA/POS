import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  cashMovementService,
  EXPENSE_CATEGORIES,
} from "../../services/cashMovementService";
import Swal from "sweetalert2";

const initialExpense = {
  category: "Proveedor",
  reference: "",
  notes: "",
};

export const CashMovementModal = ({
  onClose,
  onSuccess,
  defaultType = "salida",
  expenseOnly = false,
}) => {
  const { activeStaff, user } = useAuth();
  const [type, setType] = useState(defaultType);
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");
  const [expenseData, setExpenseData] = useState(initialExpense);
  const [submitting, setSubmitting] = useState(false);

  const isExpense = type === "salida";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!amount || parseFloat(amount) <= 0) {
      Swal.fire("Error", "Ingrese un monto valido mayor a 0", "warning");
      return;
    }

    if (!concept.trim()) {
      Swal.fire("Error", "Ingrese un concepto para el movimiento", "warning");
      return;
    }

    try {
      setSubmitting(true);
      if (isExpense) {
        await cashMovementService.registerExpense(
          parseFloat(amount),
          concept,
          activeStaff?.name,
          user?.cashbox_mode || "terminal",
          {
            category: expenseData.category,
            reference: expenseData.reference,
            notes: expenseData.notes,
            createdByStaffId: activeStaff?.id || activeStaff?.staff_id || null,
          },
        );
      } else {
        await cashMovementService.registerMovement(
          "entrada",
          parseFloat(amount),
          concept,
          activeStaff?.name,
          user?.cashbox_mode || "terminal",
        );
      }

      Swal.fire({
        title: isExpense ? "Gasto registrado" : "Deposito registrado",
        text: isExpense
          ? "El gasto fue aplicado al corte de caja."
          : "La entrada fue aplicada al corte de caja.",
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
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl ${
                isExpense
                  ? "bg-rose-100 dark:bg-rose-900/30"
                  : "bg-emerald-100 dark:bg-emerald-900/30"
              }`}
            >
              <span
                className={`material-symbols-rounded ${
                  isExpense
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {isExpense ? "payments" : "account_balance_wallet"}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
              {isExpense ? "Registrar gasto" : "Entrada de efectivo"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            type="button"
          >
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          {!expenseOnly && (
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setType("entrada")}
                className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all flex justify-center items-center gap-2 ${
                  type === "entrada"
                    ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <span className="material-symbols-rounded text-[20px]">
                  add_circle
                </span>
                Entrada
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
                  payments
                </span>
                Gasto
              </button>
            </div>
          )}

          {isExpense && (
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                Categoria
              </label>
              <select
                value={expenseData.category}
                onChange={(e) =>
                  setExpenseData({ ...expenseData, category: e.target.value })
                }
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-900 dark:text-white"
              >
                {EXPENSE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              Cantidad
            </label>
            <div className="relative">
              <span
                className={`absolute left-4 top-1/2 -translate-y-1/2 font-bold ${
                  isExpense ? "text-rose-500" : "text-emerald-500"
                }`}
              >
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`w-full pl-8 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:border-transparent text-slate-900 dark:text-white ${
                  isExpense ? "focus:ring-rose-500" : "focus:ring-emerald-500"
                }`}
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              Concepto
            </label>
            <input
              type="text"
              required
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:border-transparent text-slate-900 dark:text-white ${
                isExpense ? "focus:ring-rose-500" : "focus:ring-emerald-500"
              }`}
              placeholder={isExpense ? "Pago a proveedor" : "Cambio inicial"}
            />
          </div>

          {isExpense && (
            <>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Referencia
                </label>
                <input
                  type="text"
                  value={expenseData.reference}
                  onChange={(e) =>
                    setExpenseData({
                      ...expenseData,
                      reference: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-900 dark:text-white"
                  placeholder="Folio, nota o recibo"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Notas
                </label>
                <textarea
                  value={expenseData.notes}
                  onChange={(e) =>
                    setExpenseData({ ...expenseData, notes: e.target.value })
                  }
                  rows="3"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-900 dark:text-white resize-y"
                  placeholder="Detalle interno"
                />
              </div>
            </>
          )}

          <div className="flex gap-3 justify-end mt-1">
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
                isExpense
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              } disabled:opacity-50`}
            >
              {submitting && (
                <span className="animate-spin material-symbols-rounded text-sm">
                  progress_activity
                </span>
              )}
              {isExpense ? "Registrar gasto" : "Registrar entrada"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
