const numberValue = (value, fallback = 0) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const pick = (source, camelKey, snakeKey, fallback) => {
  if (source?.[camelKey] !== undefined && source?.[camelKey] !== null) return source[camelKey];
  if (source?.[snakeKey] !== undefined && source?.[snakeKey] !== null) return source[snakeKey];
  return fallback;
};

const toArray = (value) => (Array.isArray(value) ? value : []);
const toObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

export const hasFullCashCutSnapshot = (cut = {}) => {
  const snapshot = toObject(cut.cash_cut_snapshot || cut.cashCutSnapshot);
  return numberValue(cut.snapshot_version ?? snapshot.snapshotVersion, 0) >= 1;
};

export const normalizeCashCutForTicket = (cut = {}, options = {}) => {
  const snapshot = toObject(cut.cash_cut_snapshot || cut.cashCutSnapshot);
  const source = { ...cut, ...snapshot };
  const expectedCash = numberValue(pick(source, "expectedCash", "expected_cash", source.expectedMXN), 0);
  const actualCash = numberValue(options.actualCash ?? pick(source, "actualCash", "actual_cash", 0), 0);
  const expectedUSD = numberValue(pick(source, "expectedUSD", "expected_usd", source.totalUSD), 0);
  const actualUSD = numberValue(pick(source, "actualUSD", "actual_usd", 0), 0);
  const paymentTotals = toObject(pick(source, "paymentTotals", "payment_totals", {}));
  const collectedPaymentTotals = toObject(pick(source, "collectedPaymentTotals", "collected_payment_totals", paymentTotals));
  const creditPaymentTotals = toObject(pick(source, "creditPaymentTotals", "credit_payment_totals", {}));
  const commercialSalesSummary = toObject(pick(source, "commercialSalesSummary", "commercial_sales_summary", {}));

  return {
    id: source.id,
    startTime: pick(source, "startTime", "start_time", null),
    endTime: pick(source, "endTime", "end_time", source.created_at || new Date().toISOString()),
    staffName: pick(source, "staffName", "staff_name", "Operador"),
    sessionId: pick(source, "sessionId", "session_id", "-"),
    cutType: pick(source, "cutType", "cut_type", "turno"),
    salesCount: numberValue(pick(source, "salesCount", "sales_count", 0), 0),
    salesTotal: numberValue(pick(source, "salesTotal", "sales_total", 0), 0),
    expectedCash,
    actualCash,
    difference: numberValue(pick(source, "difference", "difference", actualCash - expectedCash), actualCash - expectedCash),
    expectedUSD,
    actualUSD,
    differenceUSD: numberValue(pick(source, "differenceUSD", "difference_usd", actualUSD - expectedUSD), actualUSD - expectedUSD),
    openingFund: numberValue(options.openingFund ?? pick(source, "openingFund", "opening_fund", 0), 0),
    cashTotal: numberValue(pick(source, "cashTotal", "cash_total", paymentTotals.efectivo), 0),
    cardTotal: numberValue(pick(source, "cardTotal", "card_total", paymentTotals.tarjeta), 0),
    transferTotal: numberValue(pick(source, "transferTotal", "transfer_total", paymentTotals.transferencia), 0),
    entradasTotal: numberValue(pick(source, "entradasTotal", "entradas_total", 0), 0),
    salidasTotal: numberValue(pick(source, "salidasTotal", "salidas_total", 0), 0),
    expensesTotal: numberValue(pick(source, "expensesTotal", "expenses_total", 0), 0),
    refundsCashTotal: numberValue(pick(source, "refundsCashTotal", "refunds_cash_total", 0), 0),
    cancelledSalesTotal: numberValue(pick(source, "cancelledSalesTotal", "cancelled_sales_total", 0), 0),
    cancelledCashTotal: numberValue(pick(source, "cancelledCashTotal", "cancelled_cash_total", 0), 0),
    collectedPaymentTotals,
    creditPaymentTotals,
    commercialSalesSummary,
    otherPaymentRows: toArray(pick(source, "otherPaymentRows", "other_payment_rows", [])),
    otherPaymentsNetTotal: numberValue(pick(source, "otherPaymentsNetTotal", "other_payments_net_total", 0), 0),
    terminalBreakdown: toArray(pick(source, "terminalBreakdown", "terminal_breakdown", [])),
    withdrawals: toArray(pick(source, "withdrawals", "withdrawals", [])),
    expenses: toArray(pick(source, "expenses", "expenses", [])),
    expensesByCategory: toArray(pick(source, "expensesByCategory", "expenses_by_category", [])),
    cashRefunds: toArray(pick(source, "cashRefunds", "cash_refunds", [])),
    cancelledSales: toArray(pick(source, "cancelledSales", "cancelled_sales", [])),
    hasFullSnapshot: hasFullCashCutSnapshot(cut),
  };
};

export const buildCashCutTicketHtml = (cut = {}, options = {}) => {
  const data = normalizeCashCutForTicket(cut, options);
  const display = options.display || {};
  const showExpectedCash = display.showExpectedCash !== false;
  const showCountedCash = display.showCountedCash !== false;
  const showDifferences = display.showDifferences !== false;
  const storeName = options.storeName || "Royal Tape";

  const formatMoney = (amount, currency = "MXN") => new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
  }).format(numberValue(amount));

  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
  const shortText = (value, size = 28) => escapeHtml(value || "").slice(0, size);
  const money = (amount) => formatMoney(numberValue(amount));
  const signedMoney = (amount, sign = "") => `${sign}${money(amount)}`;
  const dateTime = (value) => value ? new Date(value).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
  const formatElapsed = (start, end) => {
    if (!start || !end) return "-";
    const ms = Math.max(0, new Date(end).getTime() - new Date(start).getTime());
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}:${String(minutes).padStart(2, "0")}`;
  };
  const movementLabel = (movement, fallback) => {
    const concept = movement.concept || fallback;
    const ref = movement.reference ? ` ${movement.reference}` : "";
    return shortText(`${concept}${ref}`, 28);
  };
  const saleLabel = (sale) => shortText(`#${sale.id || "?"} ${sale.cancellation_reason || sale.sale_status || "cancelada"}`, 28);
  const section = (title) => `<div class="separator"></div><div class="section-title">${title}</div><div class="separator"></div>`;
  const row = (label, value, className = "") => `<div class="row ${className}"><span class="label">${label}</span><span class="value">${value}</span></div>`;
  const salesRow = (label, count, total) => row(`${label.padEnd(8, " ")} ${String(count).padStart(3, " ")} Total`, money(total));
  const paymentTableRow = (label, income, expense, total) => `<div class="pay-row"><span>${label}</span><span>${money(income)}</span><span>${money(expense)}</span><span>${money(total)}</span></div>`;

  const commercialSummary = data.commercialSalesSummary;
  const creditPaymentsTotal = numberValue(commercialSummary.payments?.total, 0);
  const creditPaymentsCount = numberValue(commercialSummary.payments?.count, 0);
  const creditSalesTotal = numberValue(commercialSummary.credits?.total, 0);
  const orderSalesTotal = numberValue(commercialSummary.orders?.total, 0);
  const cashSalesCount = commercialSummary.cash?.count ?? data.salesCount;
  const cashSalesTotal = commercialSummary.cash?.total ?? data.salesTotal;
  const creditSalesCount = commercialSummary.credits?.count || 0;
  const orderSalesCount = commercialSummary.orders?.count || 0;
  const creditAccountAmount = Math.max(0, creditSalesTotal - creditPaymentsTotal);
  const cashCollectedTotal = data.collectedPaymentTotals.efectivo ?? data.cashTotal;
  const cashCreditPaymentsTotal = data.creditPaymentTotals.efectivo || 0;
  const totalCash = data.expectedCash;
  const effectiveCashCancellations = data.refundsCashTotal || data.cancelledCashTotal || 0;
  const cashFormulaTotal = data.openingFund + cashCollectedTotal + data.entradasTotal + cashCreditPaymentsTotal - data.refundsCashTotal - data.expensesTotal - data.salidasTotal;

  let htmlPrint = `<!DOCTYPE html>
    <html><head><title>Corte de Caja</title>
    <style>
      @media print { @page { margin: 0; } body { margin: 0; padding: 0; background: none !important; } }
      body { font-family: 'Courier New', monospace; padding: 10px; max-width: 300px; margin: 0 auto; font-size: 12px; color: black; }
      .ticket-header { text-align: center; padding-bottom: 6px; }
      .store-name { font-size: 18px; font-weight: bold; }
      .ticket-title { font-size: 13px; margin-top: 3px; letter-spacing: 1px; }
      .section-title { font-weight: bold; font-size: 13px; margin: 5px 0 2px; text-transform: uppercase; }
      .row { display: flex; justify-content: space-between; gap: 8px; margin: 2px 0; }
      .label { color: #000; white-space: pre-wrap; overflow-wrap: anywhere; }
      .value { font-weight: bold; text-align: right; white-space: nowrap; }
      .total-row { font-size: 13px; font-weight: bold; margin-top: 5px; }
      .separator { border-top: 1px dashed #000; margin: 6px 0; }
      .negative { font-weight: bold; }
      .pay-head, .pay-row { display: grid; grid-template-columns: 38px 1fr 1fr 1fr; column-gap: 4px; margin: 2px 0; }
      .pay-head span, .pay-row span { text-align: right; }
      .pay-head span:first-child, .pay-row span:first-child { text-align: left; }
      .footer { text-align: center; margin-top: 12px; font-size: 12px; font-weight: bold; }
    </style>
    </head><body>
      <div class="ticket-header">
        <div class="store-name">${escapeHtml(storeName)}</div>
        <div class="ticket-title">CORTE DE CAJA</div>
      </div>
      <div class="separator"></div>
      ${row("Cajero", shortText(data.staffName, 18))}
      ${row("Turno", escapeHtml(data.sessionId))}
      ${row("Inicio", dateTime(data.startTime))}
      ${row("Corte", dateTime(data.endTime))}
      ${row("Tiempo", formatElapsed(data.startTime, data.endTime))}
      ${section("RESUMEN DE VENTAS")}
      ${salesRow("Contado", cashSalesCount, cashSalesTotal)}
      ${salesRow("Creditos", creditSalesCount, creditSalesTotal)}
      ${salesRow("Pedidos", orderSalesCount, orderSalesTotal)}
      ${salesRow("Abonos", creditPaymentsCount, creditPaymentsTotal)}
      ${section("GASTOS")}
  `;

  if (data.expenses.length === 0) {
    htmlPrint += row("Sin gastos", money(0));
  } else {
    data.expensesByCategory.forEach((item) => {
      htmlPrint += row(`CAT ${shortText(item.category, 18)} (${item.count})`, signedMoney(item.total, "-"));
    });
    data.expenses.forEach((expense) => {
      htmlPrint += row(movementLabel(expense, "Gasto"), signedMoney(expense.amount, "-"));
    });
  }

  htmlPrint += `
      ${section("MANEJO DE EFECTIVO")}
      ${row("Saldo Inicial", money(data.openingFund))}
      ${row("Venta al contado", money(cashCollectedTotal))}
      ${row("Anticipos pedidos", money(0))}
      ${row("A cta. creditos", money(creditAccountAmount))}
      ${row("Abonos", money(cashCreditPaymentsTotal))}
      ${row("Cancelaciones", signedMoney(effectiveCashCancellations, "-"), "negative")}
      ${row("Abonos cancelados", signedMoney(0, "-"), "negative")}
      ${row("Gastos", signedMoney(data.expensesTotal, "-"), "negative")}
      ${row("Retiros Efectivo", signedMoney(data.salidasTotal, "-"), "negative")}
  `;

  data.withdrawals.forEach((movement) => {
    htmlPrint += row(movementLabel(movement, "Retiro"), signedMoney(movement.amount, "-"));
  });
  if (data.cancelledSales.length > 0) {
    htmlPrint += section("CANCELACIONES");
    data.cancelledSales.forEach((sale) => {
      htmlPrint += row(saleLabel(sale), signedMoney(sale.refunded_amount || sale.total, "-"));
    });
  }

  htmlPrint += `
      <div class="separator"></div>
      ${row("TOTAL EFECTIVO", money(totalCash), "total-row")}
      ${Math.abs(cashFormulaTotal - totalCash) >= 0.01 ? row("AJUSTE SISTEMA", money(totalCash - cashFormulaTotal)) : ""}
      ${showExpectedCash ? row("EFECTIVO ESPERADO", money(data.expectedCash)) : ""}
      ${showCountedCash ? row("EFECTIVO CONTADO", money(data.actualCash)) : ""}
      ${showDifferences ? row("DIFERENCIA", money(data.difference)) : ""}
      ${section("OTRAS FORMAS DE PAGO")}
      <div class="pay-head"><span></span><span>INGRESOS</span><span>EGRESOS</span><span>TOTAL</span></div>
  `;

  data.otherPaymentRows.forEach((item) => {
    htmlPrint += paymentTableRow(item.label, item.income, item.expense, item.total);
  });

  if (data.terminalBreakdown.length > 0) {
    htmlPrint += section("VENTAS POR TERMINAL");
    data.terminalBreakdown.forEach((terminal) => {
      htmlPrint += row(`${shortText(terminal.terminal_name, 18)} (${terminal.sales_count})`, money(terminal.sales_total));
    });
  }

  htmlPrint += `
      <div class="separator"></div>
      ${row("INGRESO TOTAL", money(totalCash + data.otherPaymentsNetTotal), "total-row")}
      <div class="footer">TERMINA</div>
    </body></html>`;

  return htmlPrint;
};
