import React, { useState, useEffect, useCallback } from "react";
import { cashSessionService } from "../../services/cashSessionService";
import { cashMovementService } from "../../services/cashMovementService";
import { salesService } from "../../services/salesService";
import { formatCurrency } from "../../utils/formatters";
import { useAuth } from "../../hooks/useAuth";
import Swal from "sweetalert2";

export const SessionReportModal = ({ onClose }) => {
  const { user, cashSession } = useAuth();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [totals, setTotals] = useState({
    ventasPza: 0,
    ventasCaja: 0,
    totalVentas: 0,
    entradas: 0,
    salidas: 0,
    neto: 0,
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const activeSession =
        cashSession ||
        (await cashSessionService.getActiveSession(user?.cashbox_mode || "terminal"));
      if (!activeSession) {
        Swal.fire("Info", "No hay una sesión de caja activa", "info");
        onClose();
        return;
      }
      setSession(activeSession);

      // Obtener movimientos
      const movementTotals = await cashMovementService.getSessionTotals(activeSession.id);
      
      // Obtener ventas de la sesión
      // NOTA: Idealmente filtraríamos por terminal y desde opened_at
      const sales = await salesService.getSalesSince(
        activeSession.opened_at,
        activeSession.session_scope === "shared_cashbox" ? null : activeSession.terminal_id,
      );
      
      let vPza = 0;
      let vCaja = 0;
      let vTotal = 0;

      sales.forEach(s => {
        vTotal += parseFloat(s.total) || 0;
        // Discriminar por unidad en los items
        if (s.sale_items) {
          s.sale_items.forEach(item => {
            const itemTotal = parseFloat(item.total) || 0;
            if (item.unit_sold === 'CAJA') {
              vCaja += itemTotal;
            } else {
              vPza += itemTotal;
            }
          });
        }
      });

      setTotals({
        ventasPza: vPza,
        ventasCaja: vCaja,
        totalVentas: vTotal,
        entradas: movementTotals.totalEntradas,
        salidas: movementTotals.totalSalidas,
        neto: (activeSession.opening_fund || 0) + vTotal + movementTotals.totalEntradas - movementTotals.totalSalidas,
      });

    } catch (error) {
      console.error("Error cargando reporte de sesión:", error);
      Swal.fire("Error", "No se pudo cargar el reporte de sesión", "error");
    } finally {
      setLoading(false);
    }
  }, [cashSession, onClose, user?.cashbox_mode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[1100]">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-2xl flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400 font-bold">Generando reporte...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-xl text-primary">
              <span className="material-symbols-rounded">analytics</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                Resumen de Sesión Actual
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">
                {session?.staff_name} • Terminal: {session?.terminal_id?.split('-')[0]}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {/* Header Info */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-500 font-bold uppercase">Apertura</span>
              <p className="text-lg font-bold text-slate-700 dark:text-white">
                {formatCurrency(session?.opening_fund || 0)}
              </p>
              <p className="text-[10px] text-slate-400">
                {new Date(session?.opened_at).toLocaleString()}
              </p>
            </div>
            <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
              <span className="text-xs text-primary font-bold uppercase">Ventas Totales</span>
              <p className="text-lg font-bold text-primary">
                {formatCurrency(totals.totalVentas)}
              </p>
              <p className="text-[10px] text-primary/60">
                Suma de todos los métodos de pago
              </p>
            </div>
          </div>

          {/* Breakdown Section */}
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-widest px-1">
            Detalle de Ventas por Unidad
          </h3>
          <div className="space-y-2 mb-6">
            <div className="flex justify-between items-center p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Ventas por Pieza (PZA)</span>
              </div>
              <span className="font-bold text-slate-800 dark:text-white">{formatCurrency(totals.ventasPza)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-purple-50/50 dark:bg-purple-900/10 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Ventas por Caja (CAJA)</span>
              </div>
              <span className="font-bold text-slate-800 dark:text-white">{formatCurrency(totals.ventasCaja)}</span>
            </div>
          </div>

          {/* Cash Movements Section */}
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-widest px-1">
            Movimientos de Caja
          </h3>
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="flex justify-between items-center p-3 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100/50 dark:border-emerald-800/20">
              <div className="flex items-center gap-2">
                <span className="material-symbols-rounded text-emerald-500 text-sm">arrow_downward</span>
                <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Entradas</span>
              </div>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">+{formatCurrency(totals.entradas)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-rose-50/50 dark:bg-rose-900/10 rounded-xl border border-rose-100/50 dark:border-rose-800/20">
              <div className="flex items-center gap-2">
                <span className="material-symbols-rounded text-rose-500 text-sm">arrow_upward</span>
                <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Salidas</span>
              </div>
              <span className="font-bold text-rose-600 dark:text-rose-400">-{formatCurrency(totals.salidas)}</span>
            </div>
          </div>

          {/* Final Balance */}
          <div className="p-6 bg-slate-900 dark:bg-black rounded-2xl text-white shadow-xl flex flex-col items-center">
            <span className="text-xs font-bold text-slate-400 uppercase mb-1">Saldo en Caja Estimado</span>
            <span className="text-4xl font-black text-emerald-400 mb-1">
              {formatCurrency(totals.neto)}
            </span>
            <p className="text-[10px] text-slate-500 text-center max-w-[80%]">
              Este monto incluye el fondo inicial, ventas totales y entradas, menos las salidas registradas.
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-center">
          <button
            onClick={onClose}
            className="w-full max-w-xs py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
