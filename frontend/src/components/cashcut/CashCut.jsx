import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { cashCutService } from "../../services/cashCutService";
import { salesService } from "../../services/salesService";
import { terminalService } from "../../services/terminalService";
import { cashSessionService } from "../../services/cashSessionService";
import { CashMovementModal } from "../sales/CashMovementModal";
import { useSettings } from "../../contexts/SettingsContext";
import { buildCashCutTicketHtml, hasFullCashCutSnapshot } from "../../utils/cashCutTicketFormatter";
import Swal from "sweetalert2";
import "./CashCut.css";

export const CashCut = ({ onClose }) => {
  const {
    activeStaff,
    activeRole,
    lockScreen,
    storeName,
    closeCashSession,
    cashSession,
    isAdmin,
        user,
  } = useAuth();
  const { ticketSettings } = useSettings();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [salesDetails, setSalesDetails] = useState([]);
  const [actualCash, setActualCash] = useState("");
  const [actualUSD, setActualUSD] = useState("");
  const [notes, setNotes] = useState("");
  const [cutType, setCutType] = useState("turno");
  const [submitting, setSubmitting] = useState(false);
  const [showTicket, setShowTicket] = useState(false);
  const [cutResult, setCutResult] = useState(null);
  const [mostrarModalMovimiento, setMostrarModalMovimiento] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [cutHistory, setCutHistory] = useState([]);
  const [historyFilters, setHistoryFilters] = useState({
    from: "",
    to: "",
    type: "todos",
    staff: "",
  });

  const ticketRef = useRef(null);

  // Variables de configuración del ticket (definidas a nivel de componente para renderizado y carga)
  const showInitialFund = ticketSettings?.cc_show_initial_fund !== false;
  const showCardSales = ticketSettings?.cc_show_card_sales !== false;
  const showTransferSales = ticketSettings?.cc_show_transfer_sales !== false;
  const showWithdrawals = ticketSettings?.cc_show_withdrawals !== false;
  const showSalesCount = ticketSettings?.cc_show_sales_count !== false;
  const showExpectedCash = ticketSettings?.cc_show_expected_cash !== false;
  const showCountedCash = ticketSettings?.cc_show_counted_cash !== false;
  const showDifferences = ticketSettings?.cc_show_differences !== false;
  const showOperatorName = ticketSettings?.cc_show_operator_name !== false;

  useEffect(() => {
    loadSummary();
  }, [cutType, user?.cashbox_mode]);

  const loadSummary = async () => {
    try {
      setLoading(true);
      const data = await cashCutService.getCurrentShiftSummary(
        cutType,
        user?.cashbox_mode || "terminal",
      );

      // Calculate Expectatives
      const sales = data.sales || [];

      // 1. Calculate Expected USD
      const totalUSD = data.usdExpected || 0;

      // 2. Calculate Expected MXN
      // Start with opening fund
      let expectedMXN = parseFloat(cashSession?.opening_fund) || 0;

      expectedMXN += data.cashMxnExpected || 0;

      // 3. Add entries and subtract real cash outs.
      const entradasTotal = data.entradasTotal || 0;
      const salidasTotal = data.salidasTotal || 0;
      const expensesTotal = data.expensesTotal || 0;
      const refundsCashTotal = data.refundsCashTotal || 0;
      expectedMXN += entradasTotal;
      expectedMXN -= salidasTotal;
      expectedMXN -= expensesTotal;
      expectedMXN -= refundsCashTotal;

      setSummary({
        ...data,
        totalUSD,
        expectedMXN,
        entradasTotal,
        salidasTotal,
        expensesTotal,
        expenses: data.expenses || [],
        expensesByCategory: data.expensesByCategory || [],
        withdrawals: data.withdrawals || [],
        refundsCashTotal,
        cashRefunds: data.cashRefunds || [],
        cancelledSales: data.cancelledSales || [],
        cancelledSalesCount: data.cancelledSalesCount || 0,
        cancelledSalesTotal: data.cancelledSalesTotal || 0,
        cancelledCashTotal: data.cancelledCashTotal || 0,
        cancelledCardTotal: data.cancelledCardTotal || 0,
        cancelledTransferTotal: data.cancelledTransferTotal || 0,
        cardTotal: data.cardTotal || 0,
        transferTotal: data.transferTotal || 0,
        cashTotal: data.cashTotal || 0,
        paymentTotals: data.paymentTotals || {},
        collectedPaymentTotals: data.collectedPaymentTotals || {},
        creditPaymentTotals: data.creditPaymentTotals || {},
        creditPayments: data.creditPayments || [],
        commercialSalesSummary: data.commercialSalesSummary || {},
        otherPaymentRows: data.otherPaymentRows || [],
        otherPaymentsIncomeTotal: data.otherPaymentsIncomeTotal || 0,
        otherPaymentsExpenseTotal: data.otherPaymentsExpenseTotal || 0,
        otherPaymentsNetTotal: data.otherPaymentsNetTotal || 0,
        terminalBreakdown: data.terminalBreakdown || [],
      });
      setSalesDetails(sales);

      // Initialize inputs
      // We don't autofill actual cash to prevent assumption
    } catch (error) {
      console.error("Error cargando resumen:", error);
      Swal.fire(
        "Error",
        error.message || "No se pudo cargar el resumen del turno",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (amount, currency = "MXN") => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("es-MX", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleSubmit = async () => {
    if (submitting) return;

    if (submitting) return;

    // Validaciones para Cierre de Día
    try {
      if (cutType === "dia") {
        const blockingSessions = await cashCutService.checkBlockingSessions();
        if (blockingSessions.length > 0) {
          const sessionList = blockingSessions
            .map(
              (s) =>
                `<li><strong>${
                  s.terminals?.name || "Terminal desconocida"
                }</strong>: ${s.staff_name}</li>`,
            )
            .join("");

          if (true) {
            // Permitir a todos (incluyendo cajeros) forzar el cierre para fluidez
            const forceResult = await Swal.fire({
              title: "Cajas pendientes",
              html: `
                              <p>Las siguientes cajas aún no han cerrado su turno:</p>
                              <ul style="text-align: left; margin-top: 10px; margin-bottom: 10px;">${sessionList}</ul>
                              <p style="color: #d32f2f; font-weight: bold;">¿Deseas forzar su cierre para continuar con el Cierre de Día?</p>
                          `,
              icon: "warning",
              showCancelButton: true,
              confirmButtonText: "Sí, forzar cierre",
              cancelButtonText: "Cancelar",
              confirmButtonColor: "#d32f2f",
            });

            if (forceResult.isConfirmed) {
              setSubmitting(true);
              try {
                // Cerrar forzosamente cada sesión bloqueante
                for (let session of blockingSessions) {
                  await cashSessionService.closeSession(session.id);
                }
              } catch (closeErr) {
                console.error("Error forzando cierre de sesiones:", closeErr);
                Swal.fire(
                  "Error",
                  "No se pudieron forzar los cierres de caja.",
                  "error",
                );
                setSubmitting(false);
                return;
              }
              setSubmitting(false);
              // Proceder con el Cierre de Día normalmente
            } else {
              return; // Canceló
            }
          }
        }
      }
    } catch (error) {
      console.error("Error en validaciones de cierre:", error);
      Swal.fire(
        "Error",
        "Ocurrió un error verificando los permisos de cierre. Por favor revisa la conexión.",
        "error",
      );
      return;
    }

    const diffMXN = (parseFloat(actualCash) || 0) - (summary?.expectedMXN || 0);
    const diffUSD = (parseFloat(actualUSD) || 0) - (summary?.totalUSD || 0);

    const result = await Swal.fire({
      title: cutType === "dia" ? "¿Cerrar el día?" : "¿Cerrar turno?",
      html: `
                <div style="text-align: left; font-size: 0.9em;">
                    <p><strong>Fondo Inicial:</strong> ${formatMoney(
                      parseFloat(cashSession?.opening_fund) || 0,
                    )}</p>
                    <hr style="margin: 5px 0;">
                    ${
                      summary.entradasTotal > 0
                        ? `<p><strong>Entradas Extras:</strong> ${formatMoney(
                            summary.entradasTotal,
                          )}</p>`
                        : ""
                    }
                    ${
                      summary.salidasTotal > 0
                        ? `<p><strong>Retiros de Caja:</strong> -${formatMoney(
                            summary.salidasTotal,
                          )}</p>`
                        : ""
                    }
                    ${
                      summary.expensesTotal > 0
                        ? `<p><strong>Gastos Registrados:</strong> -${formatMoney(
                            summary.expensesTotal,
                          )}</p>`
                        : ""
                    }
                    ${
                      summary.refundsCashTotal > 0
                        ? `<p><strong>Devoluciones en Efectivo:</strong> -${formatMoney(
                            summary.refundsCashTotal,
                          )}</p>`
                        : ""
                    }
                    <hr style="margin: 5px 0;">
                    <p><strong>Esperado MXN:</strong> ${formatMoney(
                      summary.expectedMXN || 0,
                    )}</p>
                    <p><strong>Contado MXN:</strong> ${formatMoney(
                      parseFloat(actualCash) || 0,
                    )}</p>
                    <p style="color: ${
                      diffMXN !== 0 ? "red" : "green"
                    }"><strong>Diferencia MXN:</strong> ${formatMoney(
        diffMXN,
      )}</p>
                    <hr style="margin: 5px 0;">
                    <p><strong>Esperado USD:</strong> ${formatMoney(
                      summary.totalUSD || 0,
                      "USD",
                    )}</p>
                    <p><strong>Contado USD:</strong> ${formatMoney(
                      parseFloat(actualUSD) || 0,
                      "USD",
                    )}</p>
                    <p style="color: ${
                      diffUSD !== 0 ? "red" : "green"
                    }"><strong>Diferencia USD:</strong> ${formatMoney(
        diffUSD,
        "USD",
      )}</p>
                </div>
            `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, cerrar",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    setSubmitting(true);

    try {
      const cutData = {
        staffName: activeStaff?.name || "Desconocido",
        staffRole: activeRole,
        cutType,
        startTime: summary.startTime,
        salesCount: summary.salesCount,
        salesTotal: summary.salesTotal,
        expectedCash: summary.expectedMXN,
        actualCash: parseFloat(actualCash) || 0,
        difference: diffMXN,
        expectedUSD: summary.totalUSD,
        actualUSD: parseFloat(actualUSD) || 0,
        differenceUSD: diffUSD,
        cardTotal: summary.cardTotal,
        transferTotal: summary.transferTotal,
        cashTotal: summary.cashTotal || 0,
        openingFund: parseFloat(cashSession?.opening_fund) || 0,
        paymentTotals: summary.paymentTotals || {},
        collectedPaymentTotals: summary.collectedPaymentTotals || {},
        creditPaymentTotals: summary.creditPaymentTotals || {},
        creditPayments: summary.creditPayments || [],
        commercialSalesSummary: summary.commercialSalesSummary || {},
        otherPaymentRows: summary.otherPaymentRows || [],
        otherPaymentsIncomeTotal: summary.otherPaymentsIncomeTotal || 0,
        otherPaymentsExpenseTotal: summary.otherPaymentsExpenseTotal || 0,
        otherPaymentsNetTotal: summary.otherPaymentsNetTotal || 0,
        terminalBreakdown: summary.terminalBreakdown || [],
        entradas_total: summary.entradasTotal,
        salidas_total: summary.salidasTotal,
        withdrawals: summary.withdrawals || [],
        expenses_total: summary.expensesTotal || 0,
        expenses: summary.expenses || [],
        expenses_by_category: summary.expensesByCategory || [],
        refunds_cash_total: summary.refundsCashTotal || 0,
        cash_refunds: summary.cashRefunds || [],
        cancelled_sales: summary.cancelledSales || [],
        cancelled_sales_count: summary.cancelledSalesCount || 0,
        cancelled_sales_total: summary.cancelledSalesTotal || 0,
        cancelled_cash_total: summary.cancelledCashTotal || 0,
        cancelled_card_total: summary.cancelledCardTotal || 0,
        cancelled_transfer_total: summary.cancelledTransferTotal || 0,
        notes,
      };

      const savedCut = await cashCutService.createCashCut(cutData, user?.id);

      // Guardar resultado para el ticket
      setCutResult({
        ...savedCut,
        ...cutData,
        endTime: new Date().toISOString(),
        difference: diffMXN,
        differenceUSD: diffUSD,
      });

      // Mostrar ticket antes de bloquear
      setShowTicket(true);
    } catch (error) {
      console.error("Error al crear corte:", error);
      Swal.fire("Error", "No se pudo realizar el corte", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const ticketDisplayOptions = {
    showExpectedCash,
    showCountedCash,
    showDifferences,
  };

  const printCashCut = async (cut, extraOptions = {}) => {
    const { printerService } = await import("../../services/printerService");
    const htmlPrint = buildCashCutTicketHtml(cut, {
      storeName: storeName || "Royal Tape",
      openingFund: extraOptions.openingFund ?? cut?.opening_fund ?? (parseFloat(cashSession?.opening_fund) || 0),
      actualCash: extraOptions.actualCash,
      display: ticketDisplayOptions,
    });

    printerService.printHtmlTicket(htmlPrint, {
      paperWidth: ticketSettings?.paper_width || "58mm",
    });
  };

  const handlePrint = () => {
    if (!ticketRef.current) return;
    printCashCut(cutResult || summary, { actualCash }).catch((error) => {
      console.error("Error al imprimir corte:", error);
      Swal.fire("Error", "No se pudo imprimir el corte", "error");
    });
  };

  const loadCutHistory = async (filters = historyFilters) => {
    try {
      setHistoryLoading(true);
      const from = filters.from ? new Date(filters.from + "T00:00:00").toISOString() : null;
      const to = filters.to ? new Date(filters.to + "T23:59:59").toISOString() : null;
      const cuts = await cashCutService.getCashCuts({
        from,
        to,
        type: filters.type,
        staff: filters.staff?.trim(),
        limit: 80,
      });
      setCutHistory(cuts);
    } catch (error) {
      console.error("Error cargando historial de cortes:", error);
      Swal.fire("Error", "No se pudo cargar el historial de cortes", "error");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleOpenHistory = () => {
    const nextValue = !showHistory;
    setShowHistory(nextValue);
    if (nextValue && cutHistory.length === 0) {
      loadCutHistory();
    }
  };

  const handleHistoryFilterChange = (field, value) => {
    setHistoryFilters((current) => ({ ...current, [field]: value }));
  };

  const handleReprintCut = async (cut) => {
    try {
      if (!hasFullCashCutSnapshot(cut)) {
        await Swal.fire({
          icon: "info",
          title: "Corte anterior al nuevo formato",
          text: "Este corte es anterior al nuevo formato; se reimprimira con la informacion disponible.",
          confirmButtonText: "Reimprimir",
        });
      }

      await cashCutService.reprintCashCut(cut, ticketSettings, storeName || "Royal Tape", {
        display: ticketDisplayOptions,
      });
    } catch (error) {
      console.error("Error reimprimiendo corte:", error);
      Swal.fire("Error", "No se pudo reimprimir el corte", "error");
    }
  };

  const handleFinish = async () => {
    Swal.fire({
      title: "¡Corte realizado!",
      text:
        cutType === "dia"
          ? "El día ha sido cerrado exitosamente"
          : "Tu turno ha sido cerrado exitosamente",
      icon: "success",
      timer: 2000,
      showConfirmButton: false,
    });

    // Cerrar la sesión de visualización de caja
    await closeCashSession();

    lockScreen();
    if (onClose) onClose();
  };

  // Cálculos en tiempo real para la UI
  const expectedMXN = summary?.expectedMXN || 0;
  const diffMXN = (parseFloat(actualCash) || 0) - expectedMXN;

  const expectedUSD = summary?.totalUSD || 0;
  const diffUSD = (parseFloat(actualUSD) || 0) - expectedUSD;

  // Efecto para recargar el resumen si cambia el tipo (proactivo por si el servicio se expande)
  useEffect(() => {
    loadSummary();
  }, [cutType]);

  if (loading && !summary) {
    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[1050] p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-4 animate-pulse">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
          <p className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest text-xs">
            Cargando Resumen...
          </p>
        </div>
      </div>
    );
  }

  // Modal de Ticket
  if (showTicket && cutResult) {
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[1050] p-4">
        <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-300">
          <div className="px-8 py-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-lg">
                <span className="material-symbols-rounded text-emerald-600 dark:text-emerald-400">
                  receipt_long
                </span>
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                Corte Exitoso
              </h2>
            </div>
            <button
              onClick={handleFinish}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <span className="material-symbols-rounded">close</span>
            </button>
          </div>

          <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50 dark:bg-slate-950/20">
            <div
              className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 font-mono text-sm"
              ref={ticketRef}
            >
              <div className="text-center border-b-2 border-dashed border-slate-200 dark:border-slate-700 pb-6 mb-6">
                <div className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tighter">
                  {storeName || "MI TIENDA"}
                </div>
                <div className="text-[10px] mt-1 text-slate-500 font-sans uppercase tracking-[0.2em] font-bold">
                  {cutType === "dia"
                    ? "CIERRE FINAL DEL DÍA"
                    : "CORTE DE TURNO"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-2 mb-6 text-slate-600 dark:text-slate-400 border-b border-dashed border-slate-200 dark:border-slate-700 pb-6">
                <span>Fecha:</span>{" "}
                <span className="text-right font-bold text-slate-900 dark:text-white">
                  {formatDate(cutResult.endTime)}
                </span>
                <span>Hora:</span>{" "}
                <span className="text-right font-bold text-slate-900 dark:text-white">
                  {new Date(cutResult.endTime).toLocaleTimeString("es-MX")}
                </span>
                <span>Operador:</span>{" "}
                <span className="text-right font-bold text-slate-900 dark:text-white truncate ml-4">
                  {cutResult.staffName}
                </span>
              </div>

              <div className="space-y-3 mb-6">
                {showInitialFund && (
                  <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
                    <span className="text-xs uppercase font-bold text-slate-400">
                      Fondo Inicial:
                    </span>
                    <span className="font-bold">
                      {formatMoney(parseFloat(cashSession?.opening_fund) || 0)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center p-3">
                  <span className="text-xs uppercase font-bold text-slate-400">
                    Total Ventas{" "}
                    {showSalesCount ? `(${cutResult.salesCount})` : ""}:
                  </span>
                  <span className="font-bold">
                    {formatMoney(cutResult.salesTotal)}
                  </span>
                </div>

                {showExpectedCash && (
                  <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/20">
                    <span className="text-xs uppercase font-bold text-emerald-600 dark:text-emerald-400">
                      Total Esperado (MXN):
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">
                      {formatMoney(cutResult.expectedCash)}
                    </span>
                  </div>
                )}

                {cutResult.expectedUSD > 0 && showExpectedCash && (
                  <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-900/20">
                    <span className="text-xs uppercase font-bold text-blue-600 dark:text-blue-400">
                      Total Esperado (USD):
                    </span>
                    <span className="font-bold text-blue-600 dark:text-blue-400 text-lg">
                      {formatMoney(cutResult.expectedUSD, "USD")}
                    </span>
                  </div>
                )}

                {cutResult.cardTotal > 0 && showCardSales && (
                  <div className="flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/10 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900/20">
                    <span className="text-xs uppercase font-bold text-indigo-600 dark:text-indigo-400">
                      Ventas Tarjeta:
                    </span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 text-lg">
                      {formatMoney(cutResult.cardTotal)}
                    </span>
                  </div>
                )}

                {cutResult.transferTotal > 0 && showTransferSales && (
                  <div className="flex justify-between items-center bg-purple-50 dark:bg-purple-900/10 p-3 rounded-lg border border-purple-100 dark:border-purple-900/20">
                    <span className="text-xs uppercase font-bold text-purple-600 dark:text-purple-400">
                      Ventas Transferencia:
                    </span>
                    <span className="font-bold text-purple-600 dark:text-purple-400 text-lg">
                      {formatMoney(cutResult.transferTotal)}
                    </span>
                  </div>
                )}

                {cutResult.entradas_total > 0 && (
                  <div className="flex justify-between items-center bg-amber-50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-100 dark:border-amber-900/20">
                    <span className="text-xs uppercase font-bold text-amber-600 dark:text-amber-400">
                      Entradas Extra:
                    </span>
                    <span className="font-bold text-amber-600 dark:text-amber-400 text-lg">
                      +{formatMoney(cutResult.entradas_total)}
                    </span>
                  </div>
                )}

                {cutResult.salidas_total > 0 && showWithdrawals && (
                  <div className="flex justify-between items-center bg-rose-50 dark:bg-rose-900/10 p-3 rounded-lg border border-rose-100 dark:border-rose-900/20">
                    <span className="text-xs uppercase font-bold text-rose-600 dark:text-rose-400">
                      Retiros de Caja:
                    </span>
                    <span className="font-bold text-rose-600 dark:text-rose-400 text-lg">
                      -{formatMoney(cutResult.salidas_total)}
                    </span>
                  </div>
                )}

                {cutResult.expenses_total > 0 && showWithdrawals && (
                  <div className="bg-rose-50 dark:bg-rose-900/10 p-3 rounded-lg border border-rose-100 dark:border-rose-900/20 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs uppercase font-bold text-rose-600 dark:text-rose-400">
                        Gastos registrados:
                      </span>
                      <span className="font-bold text-rose-600 dark:text-rose-400 text-lg">
                        -{formatMoney(cutResult.expenses_total)}
                      </span>
                    </div>
                    {(cutResult.expenses_by_category || []).map((item) => (
                      <div key={item.category} className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                        <span>{item.category}</span>
                        <span>{formatMoney(item.total)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {cutResult.refunds_cash_total > 0 && showWithdrawals && (
                  <div className="flex justify-between items-center bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-100 dark:border-red-900/20">
                    <span className="text-xs uppercase font-bold text-red-600 dark:text-red-400">
                      Devoluciones en efectivo:
                    </span>
                    <span className="font-bold text-red-600 dark:text-red-400 text-lg">
                      -{formatMoney(cutResult.refunds_cash_total)}
                    </span>
                  </div>
                )}

                {cutResult.cancelled_sales_count > 0 && (
                  <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-xs uppercase font-bold text-slate-600 dark:text-slate-300">
                      Cancelaciones/Devoluciones ({cutResult.cancelled_sales_count}):
                    </span>
                    <span className="font-bold text-slate-700 dark:text-slate-200 text-lg">
                      {formatMoney(cutResult.cancelled_sales_total)}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t-2 border-dashed border-slate-200 dark:border-slate-700 text-center space-y-2">
                {showCountedCash && (
                  <div className="flex justify-between text-slate-900 dark:text-white font-bold">
                    <span>EFECTIVO MXN:</span>
                    <span>{formatMoney(cutResult.actualCash || 0)}</span>
                  </div>
                )}

                {showDifferences && (
                  <div
                    className={`flex justify-between font-black text-lg ${
                      cutResult.difference === 0
                        ? "text-slate-900 dark:text-white"
                        : cutResult.difference > 0
                        ? "text-blue-500"
                        : "text-red-500"
                    }`}
                  >
                    <span>DIFERENCIA MXN:</span>
                    <span>
                      {cutResult.difference === 0
                        ? "CORRECTO"
                        : formatMoney(cutResult.difference)}
                    </span>
                  </div>
                )}
                {cutResult.expectedUSD > 0 && (
                  <>
                    <div className="flex justify-between text-slate-900 dark:text-white font-bold mt-2 pt-2 border-t border-dotted border-slate-300">
                      <span>EFECTIVO USD:</span>
                      <span>
                        {formatMoney(cutResult.actualUSD || 0, "USD")}
                      </span>
                    </div>
                    <div
                      className={`flex justify-between font-black text-lg ${
                        cutResult.differenceUSD === 0
                          ? "text-slate-900 dark:text-white"
                          : cutResult.differenceUSD > 0
                          ? "text-blue-500"
                          : "text-red-500"
                      }`}
                    >
                      <span>DIFERENCIA USD:</span>
                      <span>
                        {cutResult.differenceUSD === 0
                          ? "CORRECTO"
                          : formatMoney(cutResult.differenceUSD, "USD")}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex gap-4">
            <button
              onClick={handleFinish}
              className="flex-1 py-4 px-6 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
            >
              Cerrar
            </button>
            <button
              onClick={handlePrint}
              className="flex-[1.5] py-4 px-6 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:opacity-90 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-rounded">print</span>
              Imprimir Ticket
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[1050] p-4">
      <style>{`
                .material-symbols-rounded { font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; }
            `}</style>

      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl flex flex-col max-h-[95vh] lg:max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-8 py-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-2xl shadow-inner shadow-amber-200/50 dark:shadow-none">
              <span className="material-symbols-rounded text-amber-600 dark:text-amber-400 text-3xl">
                savings
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight leading-none">
                Cierre de Caja
              </h1>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                Control de Efectivo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors bg-slate-100 dark:bg-slate-800 p-2 rounded-xl"
          >
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8">
          {/* Selector de Tipo de Corte */}
          <div className="flex p-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-2xl gap-1">
            <button
              onClick={() => setCutType("turno")}
              className={`flex-1 flex items-center justify-center gap-3 py-3 px-4 rounded-xl transition-all font-bold text-sm ${
                cutType === "turno"
                  ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800"
              }`}
            >
              <span className="material-symbols-rounded">person</span>
              Cierre de Turno
            </button>
            <button
              onClick={() => setCutType("dia")}
              className={`flex-1 flex items-center justify-center gap-3 py-3 px-4 rounded-xl transition-all font-bold text-sm ${
                cutType === "dia"
                  ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800"
              }`}
            >
              <span className="material-symbols-rounded">dark_mode</span>
              Cierre del Día
            </button>
          </div>

          {/* Resumen Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-black uppercase tracking-widest text-xs">
                <span className="material-symbols-rounded text-blue-500 text-lg">
                  analytics
                </span>
                Resumen del Período
              </div>
              <span className="text-[10px] text-slate-500 font-bold uppercase bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                Inicio: {formatTime(summary?.startTime)}
              </span>
            </div>

            <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-950/20 rounded-2xl border border-slate-100 dark:border-slate-800/50">
              <div className="flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">
                  ¿Olvidaste registrar un gasto o ingreso?
                </p>
                <button
                  onClick={() => setMostrarModalMovimiento(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm font-black hover:scale-[1.02] transition-all border-2 border-emerald-100 dark:border-emerald-900/30 shadow-sm"
                >
                  <span className="material-symbols-rounded">payments</span>
                  REGISTRAR RETIRO / DEPOSITO
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button
                type="button"
                onClick={handleOpenHistory}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors"
              >
                <span className="flex items-center gap-3">
                  <span className="material-symbols-rounded text-slate-500">history</span>
                  <span>
                    <span className="block text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">
                      Historial / Reimprimir Cortes
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      Busca cierres de turno o de dia ya guardados.
                    </span>
                  </span>
                </span>
                <span className="material-symbols-rounded text-slate-400">
                  {showHistory ? "expand_less" : "expand_more"}
                </span>
              </button>

              {showHistory && (
                <div className="border-t border-slate-200 dark:border-slate-700 p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input
                      type="date"
                      value={historyFilters.from}
                      onChange={(e) => handleHistoryFilterChange("from", e.target.value)}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
                    />
                    <input
                      type="date"
                      value={historyFilters.to}
                      onChange={(e) => handleHistoryFilterChange("to", e.target.value)}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
                    />
                    <select
                      value={historyFilters.type}
                      onChange={(e) => handleHistoryFilterChange("type", e.target.value)}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
                    >
                      <option value="todos">Todos</option>
                      <option value="turno">Turno</option>
                      <option value="dia">Dia</option>
                    </select>
                    <input
                      type="text"
                      value={historyFilters.staff}
                      onChange={(e) => handleHistoryFilterChange("staff", e.target.value)}
                      placeholder="Cajero"
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => loadCutHistory()}
                    disabled={historyLoading}
                    className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black uppercase tracking-widest disabled:opacity-50"
                  >
                    <span className="material-symbols-rounded text-base">search</span>
                    {historyLoading ? "Buscando..." : "Buscar cortes"}
                  </button>

                  <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                    {cutHistory.length === 0 && !historyLoading && (
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                        No hay cortes para los filtros seleccionados.
                      </div>
                    )}

                    {cutHistory.map((cut) => (
                      <div
                        key={cut.id}
                        className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4"
                      >
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div>
                            <p className="font-black uppercase text-slate-400">Tipo</p>
                            <p className="font-bold text-slate-800 dark:text-slate-100">{cut.cut_type === "dia" ? "Dia" : "Turno"}</p>
                          </div>
                          <div>
                            <p className="font-black uppercase text-slate-400">Cajero</p>
                            <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{cut.staff_name || "-"}</p>
                          </div>
                          <div>
                            <p className="font-black uppercase text-slate-400">Corte</p>
                            <p className="font-bold text-slate-800 dark:text-slate-100">{formatTime(cut.end_time || cut.created_at)}</p>
                          </div>
                          <div>
                            <p className="font-black uppercase text-slate-400">Diferencia</p>
                            <p className={Number(cut.difference || 0) === 0 ? "font-bold text-emerald-600" : "font-bold text-rose-600"}>
                              {formatMoney(cut.difference || 0)}
                            </p>
                          </div>
                          <div>
                            <p className="font-black uppercase text-slate-400">Ventas</p>
                            <p className="font-bold text-slate-800 dark:text-slate-100">{cut.sales_count || 0} / {formatMoney(cut.sales_total || 0)}</p>
                          </div>
                          <div>
                            <p className="font-black uppercase text-slate-400">Esperado</p>
                            <p className="font-bold text-slate-800 dark:text-slate-100">{formatMoney(cut.expected_cash || 0)}</p>
                          </div>
                          <div>
                            <p className="font-black uppercase text-slate-400">Contado</p>
                            <p className="font-bold text-slate-800 dark:text-slate-100">{formatMoney(cut.actual_cash || 0)}</p>
                          </div>
                          <div>
                            <p className="font-black uppercase text-slate-400">Formato</p>
                            <p className={hasFullCashCutSnapshot(cut) ? "font-bold text-emerald-600" : "font-bold text-amber-600"}>
                              {hasFullCashCutSnapshot(cut) ? "Completo" : "Legacy"}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleReprintCut(cut)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-slate-800 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500"
                        >
                          <span className="material-symbols-rounded text-base">print</span>
                          Reimprimir
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="text-2xl font-black text-slate-900 dark:text-white mb-1 leading-none">
                  {summary?.salesCount || 0}
                </div>
                <div className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">
                  Ventas Realizadas
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="text-2xl font-black text-slate-900 dark:text-white mb-1 leading-none">
                  {formatMoney(summary?.salesTotal || 0)}
                </div>
                <div className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">
                  Monto en Ventas
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="text-2xl font-black text-slate-900 dark:text-white mb-1 leading-none">
                  {formatMoney(parseFloat(cashSession?.opening_fund) || 0)}
                </div>
                <div className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">
                  Fondo de Caja
                </div>
              </div>
              <div className="bg-emerald-500 p-5 rounded-2xl shadow-lg shadow-emerald-500/20">
                <div className="text-2xl font-black text-white mb-1 leading-none">
                  {formatMoney(expectedMXN)}
                </div>
                <div className="text-[9px] uppercase font-bold text-emerald-50 tracking-widest">
                  Esperado MXN
                </div>
              </div>
            </div>

            {summary?.terminalBreakdown?.length > 1 && (
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-rounded text-slate-500">
                    point_of_sale
                  </span>
                  <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">
                    Desglose por Terminal
                  </h3>
                </div>
                <div className="space-y-2">
                  {summary.terminalBreakdown.map((terminal) => (
                    <div
                      key={terminal.terminal_id || terminal.terminal_name}
                      className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-900/40 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                          {terminal.terminal_name}
                        </p>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                          {terminal.sales_count} venta(s)
                        </p>
                      </div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">
                        {formatMoney(terminal.sales_total)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Totales Secundarios (Tarjeta, Transferencia, USD) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {summary?.cardTotal > 0 && (
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border-2 border-indigo-100 dark:border-indigo-900/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-xl">
                      <span className="material-symbols-rounded text-indigo-600 dark:text-indigo-400 text-lg">
                        credit_card
                      </span>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">
                        Tarjeta
                      </p>
                      <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                        {formatMoney(summary.cardTotal)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {summary?.transferTotal > 0 && (
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border-2 border-purple-100 dark:border-purple-900/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-xl">
                      <span className="material-symbols-rounded text-purple-600 dark:text-purple-400 text-lg">
                        account_balance
                      </span>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">
                        Transferencia
                      </p>
                      <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                        {formatMoney(summary.transferTotal)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border-2 border-emerald-100 dark:border-emerald-900/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-xl">
                    <span className="material-symbols-rounded text-emerald-600 dark:text-emerald-400 text-lg">
                      add_circle
                    </span>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">
                      Entradas Extra
                    </p>
                    <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                      +{formatMoney(summary?.entradasTotal || 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border-2 border-rose-100 dark:border-rose-900/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-rose-100 dark:bg-rose-900/30 p-2 rounded-xl">
                    <span className="material-symbols-rounded text-rose-600 dark:text-rose-400 text-lg">
                      remove_circle
                    </span>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">
                      Retiros de Caja
                    </p>
                    <p className="text-lg font-black text-rose-600 dark:text-rose-400 leading-tight">
                      -{formatMoney(summary?.salidasTotal || 0)}
                    </p>
                  </div>
                </div>
              </div>

              {summary?.refundsCashTotal > 0 && (
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border-2 border-red-100 dark:border-red-900/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-xl">
                      <span className="material-symbols-rounded text-red-600 dark:text-red-400 text-lg">
                        assignment_return
                      </span>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">
                        Dev. Efectivo
                      </p>
                      <p className="text-lg font-black text-red-600 dark:text-red-400 leading-tight">
                        -{formatMoney(summary.refundsCashTotal)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {summary?.cancelledSalesCount > 0 && (
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-100 dark:bg-slate-700 p-2 rounded-xl">
                      <span className="material-symbols-rounded text-slate-600 dark:text-slate-300 text-lg">
                        cancel
                      </span>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">
                        Canceladas ({summary.cancelledSalesCount})
                      </p>
                      <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                        {formatMoney(summary.cancelledSalesTotal)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {summary?.totalUSD > 0 && (
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border-2 border-emerald-100 dark:border-emerald-900/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-xl">
                      <span className="material-symbols-rounded text-emerald-600 dark:text-emerald-400 text-lg">
                        currency_exchange
                      </span>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">
                        Dólares
                      </p>
                      <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                        {formatMoney(summary.totalUSD, "USD")}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {showWithdrawals && summary?.expensesTotal > 0 && (
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-rose-100 dark:border-rose-900/30">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-rose-100 dark:bg-rose-900/30 p-2 rounded-xl">
                      <span className="material-symbols-rounded text-rose-600 dark:text-rose-400">
                        receipt_long
                      </span>
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">
                        Gastos registrados
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {summary.expenses.length} movimiento(s)
                      </p>
                    </div>
                  </div>
                  <p className="text-xl font-black text-rose-600 dark:text-rose-400">
                    -{formatMoney(summary.expensesTotal)}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {summary.expensesByCategory.map((item) => (
                    <div
                      key={item.category}
                      className="flex items-center justify-between rounded-xl bg-rose-50 dark:bg-rose-950/20 px-4 py-3"
                    >
                      <span className="text-xs font-bold text-rose-700 dark:text-rose-300">
                        {item.category}
                      </span>
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        {formatMoney(item.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Efectivo en Caja Inputs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section>
              <label className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-black uppercase tracking-widest text-xs mb-4">
                <span className="material-symbols-rounded text-emerald-500">
                  payments
                </span>
                Efectivo en Caja (MXN)
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                  <span className="text-3xl font-black text-emerald-500 transition-all duration-300 group-focus-within:scale-120">
                    $
                  </span>
                </div>
                <input
                  className="block w-full pl-14 pr-6 py-7 bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-100 dark:border-slate-700 rounded-3xl text-4xl font-black text-slate-900 dark:text-white focus:ring-0 focus:border-emerald-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 shadow-inner"
                  placeholder="0.00"
                  type="number"
                  step="0.01"
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                />
                <div className="absolute top-2 right-4 text-[10px] font-bold text-slate-400">
                  ESPERADO: {formatMoney(expectedMXN)}
                </div>
              </div>
            </section>

            {/* USD Input Section */}
            {(summary?.totalUSD > 0 || actualUSD > 0) && (
              <section>
                <label className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-black uppercase tracking-widest text-xs mb-4">
                  <span className="material-symbols-rounded text-emerald-500">
                    currency_exchange
                  </span>
                  Efectivo en Caja (USD)
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                    <span className="text-2xl font-black text-emerald-500 transition-all duration-300 group-focus-within:scale-120">
                      US$
                    </span>
                  </div>
                  <input
                    className="block w-full pl-16 pr-6 py-7 bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-100 dark:border-slate-700 rounded-3xl text-4xl font-black text-slate-900 dark:text-white focus:ring-0 focus:border-emerald-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 shadow-inner"
                    placeholder="0.00"
                    type="number"
                    step="0.01"
                    value={actualUSD}
                    onChange={(e) => setActualUSD(e.target.value)}
                  />
                  <div className="absolute top-2 right-4 text-[10px] font-bold text-slate-400">
                    ESPERADO: {formatMoney(expectedUSD, "USD")}
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* Diferencia Display con feedback visual mejorado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div
              className={`p-6 rounded-2xl border-2 flex items-center justify-between transition-all duration-500 ${
                diffMXN === 0
                  ? "bg-emerald-50 dark:bg-emerald-500/5 border-emerald-100 dark:border-emerald-500/20"
                  : diffMXN > 0
                  ? "bg-blue-50 dark:bg-blue-500/5 border-blue-100 dark:border-blue-500/20"
                  : "bg-rose-50 dark:bg-rose-500/5 border-rose-100 dark:border-rose-500/20"
              }`}
            >
              <div>
                <span
                  className={`text-[10px] font-black uppercase tracking-[0.2em] block mb-1 ${
                    diffMXN === 0
                      ? "text-emerald-500"
                      : diffMXN > 0
                      ? "text-blue-500"
                      : "text-rose-500"
                  }`}
                >
                  Balance MXN
                </span>
                <span
                  className={`text-sm font-bold ${
                    diffMXN === 0
                      ? "text-emerald-700 dark:text-emerald-300"
                      : diffMXN > 0
                      ? "text-blue-700 dark:text-blue-300"
                      : "text-rose-700 dark:text-rose-300"
                  }`}
                >
                  {diffMXN === 0
                    ? "OK MXN Correcto"
                    : diffMXN > 0
                    ? "Sobrante MXN"
                    : "Faltante MXN"}
                </span>
              </div>
              <span
                className={`text-4xl font-black tabular-nums transition-all ${
                  diffMXN === 0
                    ? "text-emerald-600"
                    : diffMXN > 0
                    ? "text-blue-600"
                    : "text-rose-600"
                }`}
              >
                {diffMXN === 0 ? "OK" : formatMoney(diffMXN)}
              </span>
            </div>

            {(summary?.totalUSD > 0 || actualUSD > 0) && (
              <div
                className={`p-6 rounded-2xl border-2 flex items-center justify-between transition-all duration-500 ${
                  diffUSD === 0
                    ? "bg-emerald-50 dark:bg-emerald-500/5 border-emerald-100 dark:border-emerald-500/20"
                    : diffUSD > 0
                    ? "bg-blue-50 dark:bg-blue-500/5 border-blue-100 dark:border-blue-500/20"
                    : "bg-rose-50 dark:bg-rose-500/5 border-rose-100 dark:border-rose-500/20"
                }`}
              >
                <div>
                  <span
                    className={`text-[10px] font-black uppercase tracking-[0.2em] block mb-1 ${
                      diffUSD === 0
                        ? "text-emerald-500"
                        : diffUSD > 0
                        ? "text-blue-500"
                        : "text-rose-500"
                    }`}
                  >
                    Balance USD
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      diffUSD === 0
                        ? "text-emerald-700 dark:text-emerald-300"
                        : diffUSD > 0
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-rose-700 dark:text-rose-300"
                    }`}
                  >
                    {diffUSD === 0
                      ? "OK USD Correcto"
                      : diffUSD > 0
                      ? "Sobrante USD"
                      : "Faltante USD"}
                  </span>
                </div>
                <span
                  className={`text-4xl font-black tabular-nums transition-all ${
                    diffUSD === 0
                      ? "text-emerald-600"
                      : diffUSD > 0
                      ? "text-blue-600"
                      : "text-rose-600"
                  }`}
                >
                  {diffUSD === 0 ? "OK" : formatMoney(diffUSD, "USD")}
                </span>
              </div>
            )}
          </div>

          {/* Observaciones */}
          <section>
            <label className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-black uppercase tracking-widest text-xs mb-4">
              <span className="material-symbols-rounded text-slate-400">
                notes
              </span>
              Observaciones (Opcional)
            </label>
            <textarea
              className="block w-full p-6 bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-slate-700 dark:text-slate-300 focus:ring-0 focus:border-emerald-500 transition-all resize-none shadow-inner"
              placeholder="Anota cualquier detalle relevante del corte..."
              rows="3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            ></textarea>
          </section>
        </div>

        {/* Footer and Actions */}
        <div className="p-8 border-t border-slate-100 dark:border-slate-800 space-y-4 bg-slate-50/30 dark:bg-slate-900/40">
          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 py-5 px-6 rounded-2xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-black uppercase tracking-widest text-xs hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-95"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-[2.5] py-5 px-6 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-[0.2em] text-sm hover:translate-y-[-2px] hover:shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:translate-y-0"
            >
              {submitting
                ? "Procesando Corte..."
                : `Ejecutar ${
                    cutType === "dia" ? "Cierre de Día" : "Cierre de Turno"
                  }`}
              {!submitting && (
                <span className="material-symbols-rounded">chevron_right</span>
              )}
            </button>
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
            <p className="text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Autenticado como:{" "}
              <span className="text-slate-600 dark:text-slate-300">
                {activeStaff?.name || "Desconocido"}
              </span>
            </p>
            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
          </div>
        </div>
      </div>

      {mostrarModalMovimiento && (
        <CashMovementModal
          onClose={() => setMostrarModalMovimiento(false)}
          onSuccess={() => {
            loadSummary();
            setMostrarModalMovimiento(false);
          }}
        />
      )}
    </div>
  );
};
