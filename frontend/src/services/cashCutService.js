import { supabase } from '../supabase';
import { salesService } from './salesService';
import { terminalService } from './terminalService';
import { isExpenseCancelled } from './cashMovementService';
import { buildCashCutTicketHtml, hasFullCashCutSnapshot } from '../utils/cashCutTicketFormatter';

const isMissingColumnError = (error, columnName) =>
    error?.code === '42703' && (!columnName || error?.message?.includes(columnName));
const isMissingRelationshipError = (error) =>
    error?.code === 'PGRST200' || error?.message?.includes('relationship');
const isMissingTableError = (error) =>
    ['42P01', 'PGRST205'].includes(error?.code) || error?.message?.toLowerCase?.().includes('could not find the table');

const getTodayStartIso = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString();
};

const normalizeMethod = (method = '') =>
    String(method || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

const isCancelledSale = (sale = {}) =>
    ['cancelled', 'returned', 'canceled'].includes(normalizeMethod(sale.sale_status));

const isCashRefundMovement = (movement = {}) => {
    const concept = normalizeMethod(movement.concept);
    return concept.includes('devolucion') || concept.includes('cancelacion venta');
};

const emptyPaymentTotals = () => ({
    efectivo: 0,
    tarjeta: 0,
    transferencia: 0,
    deposito: 0,
    cheque: 0,
    dolares: 0,
    otros: 0,
    usdExpected: 0,
    cashMxnExpected: 0
});

const getPaymentBucket = (method = '', currency = 'MXN') => {
    const normalized = normalizeMethod(method);
    const normalizedCurrency = String(currency || 'MXN').toUpperCase();

    if (normalizedCurrency === 'USD' || normalized === 'dolares' || normalized === 'usd') return 'dolares';
    if (['efectivo', 'cash'].includes(normalized)) return 'efectivo';
    if (['tarjeta', 'card', 'debito', 'credito bancario', 'tarjeta credito', 'tarjeta debito'].includes(normalized)) return 'tarjeta';
    if (['transferencia', 'transfer', 'spei', 'wire'].includes(normalized)) return 'transferencia';
    if (['deposito', 'deposito bancario', 'dep'].includes(normalized)) return 'deposito';
    if (['cheque', 'chq'].includes(normalized)) return 'cheque';
    return 'otros';
};

const addPaymentToTotals = (totals, payment = {}) => {
    const amount = parseFloat(payment.amount || 0);
    const received = parseFloat(payment.amount_received || amount || 0);
    const change = parseFloat(payment.change_amount || 0);
    const bucket = getPaymentBucket(payment.payment_method || payment.method, payment.currency);

    totals[bucket] += amount;

    if (bucket === 'efectivo') {
        totals.cashMxnExpected += amount;
    } else if (bucket === 'dolares') {
        totals.usdExpected += received;
        totals.cashMxnExpected -= change;
    }
};

const addFallbackSalePayment = (totals, sale) => {
    addPaymentToTotals(totals, {
        payment_method: sale.payment_method,
        amount: sale.total,
        amount_received: sale.total,
        change_amount: 0,
        currency: sale.currency || 'MXN'
    });

    if (getPaymentBucket(sale.payment_method, sale.currency) === 'dolares') {
        totals.usdExpected += parseFloat(sale.amount_usd || 0);
    }
};

const calculateRawPaymentTotals = (payments = []) => {
    const totals = emptyPaymentTotals();
    payments.forEach((payment) => addPaymentToTotals(totals, payment));
    return totals;
};

const calculatePaymentTotals = (sales) => {
    const totals = emptyPaymentTotals();
    const hasDetailedPayments = sales.some((sale) => Array.isArray(sale.sale_payments) && sale.sale_payments.length > 0);

    if (!hasDetailedPayments) {
        sales.forEach((sale) => addFallbackSalePayment(totals, sale));
        return totals;
    }

    sales.forEach((sale) => {
        const payments = Array.isArray(sale.sale_payments) ? sale.sale_payments : [];
        if (payments.length === 0) {
            if (isCreditSale(sale) && parseFloat(sale.paid_amount || 0) <= 0) return;
            addFallbackSalePayment(totals, sale);
            return;
        }

        payments.forEach((payment) => addPaymentToTotals(totals, payment));
    });

    return totals;
};

const buildTerminalBreakdown = (sales) => {
    const byTerminal = new Map();

    sales.forEach((sale) => {
        const key = sale.terminal_id || 'sin-terminal';
        const current = byTerminal.get(key) || {
            terminal_id: sale.terminal_id || null,
            terminal_name: sale.terminals?.name || 'Terminal desconocida',
            sales_count: 0,
            sales_total: 0
        };

        current.sales_count += 1;
        current.sales_total += parseFloat(sale.total || 0);
        byTerminal.set(key, current);
    });

    return Array.from(byTerminal.values()).sort((a, b) =>
        String(a.terminal_name).localeCompare(String(b.terminal_name), 'es')
    );
};

const buildExpensesByCategory = (expenses = []) => {
    return expenses.reduce((acc, expense) => {
        const category = expense.category || 'Otros';
        const current = acc[category] || { category, count: 0, total: 0 };
        current.count += 1;
        current.total += parseFloat(expense.amount || 0);
        acc[category] = current;
        return acc;
    }, {});
};

const buildRefundBreakdown = (sales = []) => {
    const cancelledSales = sales.filter(isCancelledSale);
    const total = cancelledSales.reduce((sum, sale) => sum + parseFloat(sale.refunded_amount || sale.total || 0), 0);
    const paymentTotals = calculatePaymentTotals(cancelledSales);

    return {
        cancelledSales,
        cancelledSalesCount: cancelledSales.length,
        cancelledSalesTotal: total,
        cancelledCashTotal: paymentTotals.efectivo,
        cancelledCardTotal: paymentTotals.tarjeta,
        cancelledTransferTotal: paymentTotals.transferencia,
        cancelledDepositTotal: paymentTotals.deposito,
        cancelledCheckTotal: paymentTotals.cheque,
        cancelledUsdTotal: paymentTotals.dolares,
        cancelledOtherTotal: paymentTotals.otros
    };
};

const saleTotal = (sale = {}) => parseFloat(sale.total || 0);

const isCreditSale = (sale = {}) => ['credit', 'credito'].includes(normalizeMethod(sale.sale_type));
const isOrderSale = (sale = {}) => ['pedido', 'order'].includes(normalizeMethod(sale.sale_type));
const isCashSale = (sale = {}) => !isCreditSale(sale) && !isOrderSale(sale);

const summarizeSalesGroup = (sales = [], predicate) => {
    const filtered = sales.filter(predicate);
    return {
        count: filtered.length,
        total: filtered.reduce((sum, sale) => sum + saleTotal(sale), 0),
        sales: filtered
    };
};

const buildSalesSummary = (activeSales = [], creditPayments = []) => ({
    cash: summarizeSalesGroup(activeSales, isCashSale),
    credits: summarizeSalesGroup(activeSales, isCreditSale),
    orders: summarizeSalesGroup(activeSales, isOrderSale),
    payments: {
        count: creditPayments.length,
        total: creditPayments.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0),
        payments: creditPayments
    }
});

const paymentRowsFromTotals = ({ incomeTotals = emptyPaymentTotals(), expenseTotals = emptyPaymentTotals() } = {}) => ([
    { key: 'TAR', label: 'TAR', income: incomeTotals.tarjeta, expense: expenseTotals.tarjeta },
    { key: 'TRA', label: 'TRA', income: incomeTotals.transferencia, expense: expenseTotals.transferencia },
    { key: 'DEP', label: 'DEP', income: incomeTotals.deposito, expense: expenseTotals.deposito },
    { key: 'CHQ', label: 'CHQ', income: incomeTotals.cheque, expense: expenseTotals.cheque },
    { key: 'D.E.', label: 'D.E.', income: incomeTotals.dolares, expense: expenseTotals.dolares },
    { key: 'IDP', label: 'IDP', income: incomeTotals.otros, expense: expenseTotals.otros }
]).map((row) => ({
    ...row,
    total: (parseFloat(row.income || 0) - parseFloat(row.expense || 0))
}));

const buildCashCutSnapshot = (cutData = {}) => ({
    snapshotVersion: 1,
    staffName: cutData.staffName,
    staffRole: cutData.staffRole,
    cutType: cutData.cutType,
    startTime: cutData.startTime,
    salesCount: cutData.salesCount,
    salesTotal: cutData.salesTotal,
    expectedCash: cutData.expectedCash,
    actualCash: cutData.actualCash || 0,
    difference: cutData.difference || 0,
    expectedUSD: cutData.expectedUSD || 0,
    actualUSD: cutData.actualUSD || 0,
    differenceUSD: cutData.differenceUSD || 0,
    openingFund: cutData.openingFund || 0,
    cardTotal: cutData.cardTotal || 0,
    transferTotal: cutData.transferTotal || 0,
    cashTotal: cutData.cashTotal || 0,
    paymentTotals: cutData.paymentTotals || {},
    collectedPaymentTotals: cutData.collectedPaymentTotals || {},
    creditPaymentTotals: cutData.creditPaymentTotals || {},
    creditPayments: cutData.creditPayments || [],
    commercialSalesSummary: cutData.commercialSalesSummary || {},
    otherPaymentRows: cutData.otherPaymentRows || [],
    otherPaymentsIncomeTotal: cutData.otherPaymentsIncomeTotal || 0,
    otherPaymentsExpenseTotal: cutData.otherPaymentsExpenseTotal || 0,
    otherPaymentsNetTotal: cutData.otherPaymentsNetTotal || 0,
    terminalBreakdown: cutData.terminalBreakdown || [],
    entradasTotal: cutData.entradasTotal || cutData.entradas_total || 0,
    salidasTotal: cutData.salidasTotal || cutData.salidas_total || 0,
    withdrawals: cutData.withdrawals || [],
    expensesTotal: cutData.expensesTotal || cutData.expenses_total || 0,
    expenses: cutData.expenses || [],
    expensesByCategory: cutData.expensesByCategory || cutData.expenses_by_category || [],
    refundsCashTotal: cutData.refundsCashTotal || cutData.refunds_cash_total || 0,
    cashRefunds: cutData.cashRefunds || cutData.cash_refunds || [],
    cancelledSales: cutData.cancelledSales || cutData.cancelled_sales || [],
    cancelledSalesCount: cutData.cancelledSalesCount || cutData.cancelled_sales_count || 0,
    cancelledSalesTotal: cutData.cancelledSalesTotal || cutData.cancelled_sales_total || 0,
    cancelledCashTotal: cutData.cancelledCashTotal || cutData.cancelled_cash_total || 0,
    cancelledCardTotal: cutData.cancelledCardTotal || cutData.cancelled_card_total || 0,
    cancelledTransferTotal: cutData.cancelledTransferTotal || cutData.cancelled_transfer_total || 0,
});

export const cashCutService = {
    getLastCut: async () => {
        try {
            const { data, error } = await supabase
                .from('cash_cuts')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return data;
        } catch (error) {
            console.error('Error en getLastCut:', error);
            return null;
        }
    },

    getLastDayCut: async () => {
        const { data, error } = await supabase
            .from('cash_cuts')
            .select('*')
            .eq('cut_type', 'dia')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    getSalesSince: async (startTime) => salesService.getSalesSince(startTime),

    getTodaySales: async () => salesService.getTodaySales(),

    createCashCut: async (cutData, userId) => {
        if (!userId) throw new Error('Usuario no autenticado');

        const snapshot = buildCashCutSnapshot(cutData);
        const payload = {
            staff_name: cutData.staffName,
            staff_role: cutData.staffRole,
            cut_type: cutData.cutType,
            start_time: cutData.startTime,
            end_time: new Date().toISOString(),
            sales_count: cutData.salesCount,
            sales_total: cutData.salesTotal,
            expected_cash: cutData.expectedCash,
            actual_cash: cutData.actualCash || null,
            difference: cutData.difference,
            expected_usd: cutData.expectedUSD || 0,
            actual_usd: cutData.actualUSD || 0,
            difference_usd: cutData.differenceUSD || 0,
            card_total: cutData.cardTotal || 0,
            transfer_total: cutData.transferTotal || 0,
            entradas_total: cutData.entradasTotal || cutData.entradas_total || 0,
            salidas_total: cutData.salidasTotal || cutData.salidas_total || 0,
            payment_totals: cutData.paymentTotals || {},
            terminal_breakdown: cutData.terminalBreakdown || [],
            opening_fund: cutData.openingFund || 0,
            snapshot_version: 1,
            cash_cut_snapshot: snapshot,
            notes: cutData.notes || null,
            user_id: userId,
            terminal_id: terminalService.getTerminalId()
        };

        const { data, error } = await supabase
            .from('cash_cuts')
            .insert([payload])
            .select()
            .single();

        if (
            isMissingColumnError(error, 'payment_totals') ||
            isMissingColumnError(error, 'terminal_breakdown') ||
            isMissingColumnError(error, 'entradas_total') ||
            isMissingColumnError(error, 'salidas_total') ||
            isMissingColumnError(error, 'opening_fund') ||
            isMissingColumnError(error, 'snapshot_version') ||
            isMissingColumnError(error, 'cash_cut_snapshot')
        ) {
            const { payment_totals, terminal_breakdown, entradas_total, salidas_total, opening_fund, snapshot_version, cash_cut_snapshot, ...legacyPayload } = payload;
            const { data: legacyData, error: legacyError } = await supabase
                .from('cash_cuts')
                .insert([legacyPayload])
                .select()
                .single();

            if (legacyError) throw legacyError;
            return legacyData;
        }

        if (error) throw error;
        return data;
    },

    checkBlockingSessions: async () => {
        const currentTerminalId = terminalService.getTerminalId();
        if (!currentTerminalId) return [];

        const { data, error } = await supabase
            .from('cash_sessions')
            .select('*, terminals (name)')
            .eq('status', 'open')
            .eq('session_scope', 'terminal')
            .neq('terminal_id', currentTerminalId);

        if (isMissingColumnError(error, 'session_scope')) {
            const { data: legacyData, error: legacyError } = await supabase
                .from('cash_sessions')
                .select('*, terminals (name)')
                .eq('status', 'open')
                .neq('terminal_id', currentTerminalId);

            if (legacyError) {
                console.error('Error verificando sesiones bloqueantes legacy:', legacyError);
                throw legacyError;
            }

            return legacyData || [];
        }

        if (error) {
            console.error('Error verificando sesiones bloqueantes:', error);
            throw error;
        }

        return data || [];
    },

    getCashCuts: async (filters = {}) => {
        const normalizedFilters = typeof filters === 'number' ? { limit: filters } : (filters || {});
        const {
            from,
            to,
            type,
            staff,
            limit = 50
        } = normalizedFilters;

        let query = supabase
            .from('cash_cuts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (from) query = query.gte('end_time', from);
        if (to) query = query.lte('end_time', to);
        if (type && type !== 'todos') query = query.eq('cut_type', type);
        if (staff) query = query.ilike('staff_name', '%' + staff + '%');

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    reprintCashCut: async (cut, ticketSettings = {}, storeName = 'Royal Tape', options = {}) => {
        const { printerService } = await import('./printerService');
        const html = buildCashCutTicketHtml(cut, {
            storeName,
            openingFund: cut?.opening_fund,
            display: options.display,
        });

        printerService.printHtmlTicket(html, {
            paperWidth: ticketSettings?.paper_width || '58mm',
        });

        return {
            html,
            hasFullSnapshot: hasFullCashCutSnapshot(cut),
        };
    },

    getCurrentShiftSummary: async (cutType = 'turno', cashboxMode = 'terminal') => {
        let startTime = null;
        let sessionId = null;
        let sales = [];

        try {
            if (cutType === 'turno') {
                const terminalId = terminalService.getTerminalId();
                if (!terminalId) {
                    startTime = getTodayStartIso();
                    sales = await salesService.getSalesSince(startTime, null);
                } else if (cashboxMode === 'shared_cashbox') {
                    const { data: session, error: sessionError } = await supabase
                        .from('cash_sessions')
                        .select('id, opened_at')
                        .eq('session_scope', 'shared_cashbox')
                        .eq('status', 'open')
                        .order('opened_at', { ascending: false })
                        .limit(1)
                        .single();

                    if (isMissingColumnError(sessionError, 'session_scope')) {
                        throw new Error('La base de datos aun no tiene la migracion de caja compartida. Aplica la migracion 20260602_shared_cashbox.sql en Supabase.');
                    }

                    if (sessionError && sessionError.code !== 'PGRST116') throw sessionError;

                    sessionId = session?.id || null;
                    startTime = session?.opened_at || getTodayStartIso();
                    sales = await salesService.getSalesSince(startTime, null);
                } else {
                    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                    if (!uuidRegex.test(terminalId)) {
                        throw new Error(`ID de terminal invalido: ${terminalId}`);
                    }

                    const { data: session, error: sessionError } = await supabase
                        .from('cash_sessions')
                        .select('id, opened_at')
                        .eq('terminal_id', terminalId)
                        .eq('status', 'open')
                        .order('opened_at', { ascending: false })
                        .limit(1)
                        .single();

                    if (sessionError && sessionError.code !== 'PGRST116') {
                        console.error('Error buscando sesion:', sessionError);
                    }

                    sessionId = session?.id || null;
                    if (session?.opened_at) {
                        startTime = session.opened_at;
                    } else {
                        const lastCut = await cashCutService.getLastCut();
                        startTime = lastCut ? lastCut.end_time : getTodayStartIso();
                    }
                    sales = await salesService.getSalesSince(startTime, terminalId);
                }
            } else {
                const lastDayCut = await cashCutService.getLastDayCut();
                startTime = lastDayCut ? lastDayCut.end_time : getTodayStartIso();
                sales = await salesService.getSalesSince(startTime, null);
            }

            let creditPayments = [];
            let creditPaymentsQuery = supabase
                .from('credit_payments')
                .select('*')
                .gte('created_at', startTime);

            const { data: creditPaymentsData, error: creditPaymentsError } = await creditPaymentsQuery;
            if (creditPaymentsError && !isMissingColumnError(creditPaymentsError) && !isMissingTableError(creditPaymentsError)) {
                throw creditPaymentsError;
            }
            creditPayments = creditPaymentsData || [];

            const activeSales = sales.filter((sale) => !isCancelledSale(sale));
            const refundBreakdown = buildRefundBreakdown(sales);
            const collectedPaymentTotals = calculatePaymentTotals(sales);
            const creditPaymentTotals = calculateRawPaymentTotals(creditPayments.map((payment) => ({
                ...payment,
                amount_received: payment.amount,
                change_amount: 0,
                currency: 'MXN'
            })));
            const salesCount = activeSales.length;
            const salesTotal = activeSales.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);
            const paymentTotals = calculatePaymentTotals(activeSales);
            const commercialSalesSummary = buildSalesSummary(activeSales, creditPayments);

            let movementsQuery = supabase
                .from('cash_movements')
                .select('*, terminals(name)')
                .gte('created_at', startTime);

            if (sessionId) {
                movementsQuery = movementsQuery.eq('session_id', sessionId);
            }

            let { data: movementsData, error: movementsError } = await movementsQuery;
            if (isMissingColumnError(movementsError, 'terminal_id') || isMissingRelationshipError(movementsError)) {
                let legacyMovementsQuery = supabase
                    .from('cash_movements')
                    .select('*')
                    .gte('created_at', startTime);

                if (sessionId) {
                    legacyMovementsQuery = legacyMovementsQuery.eq('session_id', sessionId);
                }

                const legacyResult = await legacyMovementsQuery;
                movementsData = legacyResult.data;
                movementsError = legacyResult.error;
            }

            if (movementsError) throw movementsError;

            const movements = movementsData || [];
            const activeCashMovements = movements.filter((movement) => !isExpenseCancelled(movement));
            const entradas = activeCashMovements
                .filter((m) => m.movement_type === 'entrada')
                .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
            const entradasTotal = entradas
                .reduce((sum, m) => sum + parseFloat(m.amount || 0), 0);
            const cashRefunds = activeCashMovements
                .filter((m) => m.movement_type === 'salida' && m.is_expense !== true && isCashRefundMovement(m))
                .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
            const movementRefundsCashTotal = cashRefunds
                .reduce((sum, m) => sum + parseFloat(m.amount || 0), 0);
            const refundsCashTotal = Math.max(
                movementRefundsCashTotal,
                refundBreakdown.cancelledCashTotal || 0
            );
            const withdrawals = activeCashMovements
                .filter((m) => m.movement_type === 'salida' && m.is_expense !== true && !isCashRefundMovement(m))
                .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
            const salidasTotal = withdrawals
                .reduce((sum, m) => sum + parseFloat(m.amount || 0), 0);
            const expenses = activeCashMovements
                .filter((m) => m.movement_type === 'salida' && m.is_expense === true)
                .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
            const expensesTotal = expenses
                .reduce((sum, m) => sum + parseFloat(m.amount || 0), 0);
            const expensesByCategory = Object.values(buildExpensesByCategory(expenses))
                .sort((a, b) => b.total - a.total);
            const otherIncomeTotals = emptyPaymentTotals();
            const otherExpenseTotals = emptyPaymentTotals();
            ['tarjeta', 'transferencia', 'deposito', 'cheque', 'dolares', 'otros'].forEach((key) => {
                otherIncomeTotals[key] = (paymentTotals[key] || 0) + (creditPaymentTotals[key] || 0);
                otherExpenseTotals[key] = refundBreakdown[
                    key === 'tarjeta' ? 'cancelledCardTotal' :
                    key === 'transferencia' ? 'cancelledTransferTotal' :
                    key === 'deposito' ? 'cancelledDepositTotal' :
                    key === 'cheque' ? 'cancelledCheckTotal' :
                    key === 'dolares' ? 'cancelledUsdTotal' :
                    'cancelledOtherTotal'
                ] || 0;
            });
            const otherPaymentRows = paymentRowsFromTotals({
                incomeTotals: otherIncomeTotals,
                expenseTotals: otherExpenseTotals
            });
            const otherPaymentsIncomeTotal = otherPaymentRows.reduce((sum, row) => sum + parseFloat(row.income || 0), 0);
            const otherPaymentsExpenseTotal = otherPaymentRows.reduce((sum, row) => sum + parseFloat(row.expense || 0), 0);
            const otherPaymentsNetTotal = otherPaymentRows.reduce((sum, row) => sum + parseFloat(row.total || 0), 0);

            return {
                startTime,
                sessionId,
                salesCount,
                salesTotal,
                cardTotal: paymentTotals.tarjeta,
                transferTotal: paymentTotals.transferencia,
                cashTotal: paymentTotals.efectivo,
                usdTotal: paymentTotals.dolares,
                cashMxnExpected: collectedPaymentTotals.cashMxnExpected + creditPaymentTotals.cashMxnExpected,
                usdExpected: paymentTotals.usdExpected,
                paymentTotals,
                collectedPaymentTotals,
                creditPaymentTotals,
                creditPayments,
                commercialSalesSummary,
                otherPaymentRows,
                otherPaymentsIncomeTotal,
                otherPaymentsExpenseTotal,
                otherPaymentsNetTotal,
                terminalBreakdown: buildTerminalBreakdown(activeSales),
                entradasTotal,
                entradas,
                salidasTotal,
                withdrawals,
                withdrawalsTotal: salidasTotal,
                refundsCashTotal,
                cashRefunds,
                expensesTotal,
                expenses,
                expensesByCategory,
                activeSales,
                ...refundBreakdown,
                movements,
                sales
            };
        } catch (error) {
            console.error('Error detallado en getCurrentShiftSummary:', error);
            throw error;
        }
    }
};
