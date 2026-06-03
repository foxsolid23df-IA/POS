import { supabase } from '../supabase';
import { salesService } from './salesService';
import { terminalService } from './terminalService';

const isMissingColumnError = (error, columnName) =>
    error?.code === '42703' && (!columnName || error?.message?.includes(columnName));
const isMissingRelationshipError = (error) =>
    error?.code === 'PGRST200' || error?.message?.includes('relationship');

const getTodayStartIso = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString();
};

const normalizeMethod = (method = '') => String(method).toLowerCase();

const emptyPaymentTotals = () => ({
    efectivo: 0,
    tarjeta: 0,
    transferencia: 0,
    dolares: 0,
    otros: 0,
    usdExpected: 0,
    cashMxnExpected: 0
});

const addFallbackSalePayment = (totals, sale) => {
    const method = normalizeMethod(sale.payment_method);
    const amount = parseFloat(sale.total || 0);

    if (method === 'tarjeta') totals.tarjeta += amount;
    else if (method === 'transferencia') totals.transferencia += amount;
    else if (method === 'dolares') {
        totals.dolares += amount;
        totals.usdExpected += parseFloat(sale.amount_usd || 0);
        totals.cashMxnExpected += amount - ((parseFloat(sale.amount_usd || 0) * parseFloat(sale.exchange_rate || 0)) || 0);
    } else if (method === 'efectivo') {
        totals.efectivo += amount;
        totals.cashMxnExpected += amount;
    } else {
        totals.otros += amount;
    }
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
            addFallbackSalePayment(totals, sale);
            return;
        }

        payments.forEach((payment) => {
            const method = normalizeMethod(payment.payment_method);
            const amount = parseFloat(payment.amount || 0);
            const received = parseFloat(payment.amount_received || amount || 0);
            const change = parseFloat(payment.change_amount || 0);
            const currency = String(payment.currency || 'MXN').toUpperCase();

            if (currency === 'USD' || method === 'dolares') {
                totals.dolares += amount;
                totals.usdExpected += received;
                totals.cashMxnExpected -= change;
                return;
            }

            if (method === 'tarjeta') totals.tarjeta += amount;
            else if (method === 'transferencia') totals.transferencia += amount;
            else if (method === 'efectivo') {
                totals.efectivo += amount;
                totals.cashMxnExpected += amount;
            } else {
                totals.otros += amount;
            }
        });
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
            payment_totals: cutData.paymentTotals || {},
            terminal_breakdown: cutData.terminalBreakdown || [],
            notes: cutData.notes || null,
            user_id: userId,
            terminal_id: terminalService.getTerminalId()
        };

        const { data, error } = await supabase
            .from('cash_cuts')
            .insert([payload])
            .select()
            .single();

        if (isMissingColumnError(error, 'payment_totals') || isMissingColumnError(error, 'terminal_breakdown')) {
            const { payment_totals, terminal_breakdown, ...legacyPayload } = payload;
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

    getCashCuts: async (limit = 30) => {
        const { data, error } = await supabase
            .from('cash_cuts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
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

            const salesCount = sales.length;
            const salesTotal = sales.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);
            const paymentTotals = calculatePaymentTotals(sales);

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
            const entradasTotal = movements
                .filter((m) => m.movement_type === 'entrada')
                .reduce((sum, m) => sum + parseFloat(m.amount || 0), 0);
            const salidasTotal = movements
                .filter((m) => m.movement_type === 'salida')
                .reduce((sum, m) => sum + parseFloat(m.amount || 0), 0);

            return {
                startTime,
                sessionId,
                salesCount,
                salesTotal,
                cardTotal: paymentTotals.tarjeta,
                transferTotal: paymentTotals.transferencia,
                cashTotal: paymentTotals.efectivo,
                usdTotal: paymentTotals.dolares,
                cashMxnExpected: paymentTotals.cashMxnExpected,
                usdExpected: paymentTotals.usdExpected,
                paymentTotals,
                terminalBreakdown: buildTerminalBreakdown(sales),
                entradasTotal,
                salidasTotal,
                movements,
                sales
            };
        } catch (error) {
            console.error('Error detallado en getCurrentShiftSummary:', error);
            throw error;
        }
    }
};
