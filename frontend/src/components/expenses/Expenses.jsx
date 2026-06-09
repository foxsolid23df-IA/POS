import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { useAuth } from "../../hooks/useAuth";
import {
  cashMovementService,
  EXPENSE_CATEGORIES,
} from "../../services/cashMovementService";
import { cashCutService } from "../../services/cashCutService";
import "./Expenses.css";

const initialForm = {
  amount: "",
  concept: "",
  category: "Proveedor",
  reference: "",
  notes: "",
};

const formatMoney = (amount) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(parseFloat(amount || 0));

const formatDateTime = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

export const Expenses = () => {
  const { activeStaff, user } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [daySummary, setDaySummary] = useState(null);
  const [range, setRange] = useState("turno");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [searchTerm, setSearchTerm] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const cashboxMode = user?.cashbox_mode || "terminal";
      const [shiftData, dayData] = await Promise.all([
        cashCutService.getCurrentShiftSummary("turno", cashboxMode),
        cashCutService.getCurrentShiftSummary("dia", cashboxMode),
      ]);
      setSummary(shiftData);
      setDaySummary(dayData);
    } catch (error) {
      console.error("Error cargando gastos:", error);
      Swal.fire(
        "Error",
        error.message || "No se pudieron cargar los gastos de caja",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.cashbox_mode]);

  const activeSummary = range === "dia" ? daySummary : summary;
  const expenses = activeSummary?.expenses || [];

  const filteredExpenses = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return expenses.filter((expense) => {
      const matchesCategory =
        categoryFilter === "Todas" || expense.category === categoryFilter;
      const matchesSearch =
        !query ||
        String(expense.concept || "").toLowerCase().includes(query) ||
        String(expense.reference || "").toLowerCase().includes(query) ||
        String(expense.notes || "").toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [expenses, categoryFilter, searchTerm]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const amount = parseFloat(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Swal.fire("Error", "Ingresa un monto mayor a 0.", "warning");
      return;
    }

    const concept = form.concept.trim();
    if (!concept) {
      Swal.fire("Error", "Captura el concepto del gasto.", "warning");
      return;
    }

    setSubmitting(true);
    try {
      await cashMovementService.registerExpense(
        amount,
        concept,
        activeStaff?.name,
        user?.cashbox_mode || "terminal",
        {
          category: form.category,
          reference: form.reference,
          notes: form.notes,
          createdByStaffId: activeStaff?.id || activeStaff?.staff_id || null,
        },
      );

      Swal.fire({
        title: "Gasto registrado",
        text: "El gasto fue aplicado al corte de caja.",
        icon: "success",
        timer: 1400,
        showConfirmButton: false,
      });
      setForm(initialForm);
      await loadData();
    } catch (error) {
      console.error("Error registrando gasto:", error);
      Swal.fire(
        "Error",
        error.message || "No se pudo registrar el gasto.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="expenses-page">
      <header className="expenses-header">
        <div>
          <span className="expenses-eyebrow">Caja</span>
          <h1>Gastos</h1>
        </div>
        <button
          type="button"
          className="expenses-refresh"
          onClick={loadData}
          disabled={loading}
          title="Actualizar gastos"
        >
          <span className="material-symbols-rounded">refresh</span>
        </button>
      </header>

      <section className="expenses-summary">
        <div className="expenses-metric">
          <span className="material-symbols-rounded">point_of_sale</span>
          <div>
            <p>Turno</p>
            <strong>{formatMoney(summary?.expensesTotal || 0)}</strong>
          </div>
        </div>
        <div className="expenses-metric">
          <span className="material-symbols-rounded">calendar_month</span>
          <div>
            <p>Día</p>
            <strong>{formatMoney(daySummary?.expensesTotal || 0)}</strong>
          </div>
        </div>
        <div className="expenses-metric">
          <span className="material-symbols-rounded">receipt_long</span>
          <div>
            <p>Registros</p>
            <strong>{expenses.length}</strong>
          </div>
        </div>
      </section>

      <div className="expenses-layout">
        <section className="expenses-form-panel">
          <div className="expenses-section-title">
            <span className="material-symbols-rounded">payments</span>
            <h2>Registrar gasto</h2>
          </div>
          <form onSubmit={handleSubmit} className="expenses-form">
            <label>
              <span>Categoría</span>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
              >
                {EXPENSE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Monto</span>
              <div className="expenses-money-input">
                <span>$</span>
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={handleChange}
                  placeholder="0.00"
                  required
                />
              </div>
            </label>

            <label>
              <span>Concepto</span>
              <input
                name="concept"
                value={form.concept}
                onChange={handleChange}
                placeholder="Pago a proveedor"
                required
              />
            </label>

            <label>
              <span>Referencia</span>
              <input
                name="reference"
                value={form.reference}
                onChange={handleChange}
                placeholder="Folio, nota o recibo"
              />
            </label>

            <label>
              <span>Notas</span>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows="3"
                placeholder="Detalle interno"
              />
            </label>

            <button type="submit" disabled={submitting}>
              <span className="material-symbols-rounded">
                {submitting ? "progress_activity" : "save"}
              </span>
              {submitting ? "Registrando" : "Registrar gasto"}
            </button>
          </form>
        </section>

        <section className="expenses-list-panel">
          <div className="expenses-toolbar">
            <div className="expenses-tabs" role="tablist" aria-label="Rango">
              <button
                type="button"
                className={range === "turno" ? "active" : ""}
                onClick={() => setRange("turno")}
              >
                Turno
              </button>
              <button
                type="button"
                className={range === "dia" ? "active" : ""}
                onClick={() => setRange("dia")}
              >
                Día
              </button>
            </div>
            <div className="expenses-filters">
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="Todas">Todas</option>
                {EXPENSE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar"
              />
            </div>
          </div>

          <div className="expenses-category-strip">
            {(activeSummary?.expensesByCategory || []).map((item) => (
              <div key={item.category}>
                <span>{item.category}</span>
                <strong>{formatMoney(item.total)}</strong>
              </div>
            ))}
          </div>

          <div className="expenses-list">
            {loading ? (
              <div className="expenses-empty">Cargando gastos...</div>
            ) : filteredExpenses.length === 0 ? (
              <div className="expenses-empty">Sin gastos registrados</div>
            ) : (
              filteredExpenses.map((expense) => (
                <article key={expense.id} className="expense-row">
                  <div className="expense-row-icon">
                    <span className="material-symbols-rounded">receipt</span>
                  </div>
                  <div className="expense-row-main">
                    <div className="expense-row-title">
                      <strong>{expense.concept}</strong>
                      <span>{formatMoney(expense.amount)}</span>
                    </div>
                    <div className="expense-row-meta">
                      <span>{expense.category || "Otros"}</span>
                      <span>{formatDateTime(expense.created_at)}</span>
                      {expense.reference && <span>{expense.reference}</span>}
                    </div>
                    {expense.notes && (
                      <p className="expense-row-notes">{expense.notes}</p>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Expenses;
