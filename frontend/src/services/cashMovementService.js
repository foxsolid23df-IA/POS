import { supabase } from '../supabase';
import { cashSessionService } from './cashSessionService';
import { terminalService } from './terminalService';

const isMissingColumnError = (error, columnName) =>
    error?.code === '42703' && (!columnName || error?.message?.includes(columnName));

export const EXPENSE_CATEGORIES = [
    'Proveedor',
    'Servicios',
    'Flete',
    'Comida',
    'Mantenimiento',
    'Compras menores',
    'Otros'
];

const normalizeExpenseCategory = (category) => {
    const clean = String(category || '').trim();
    return EXPENSE_CATEGORIES.includes(clean) ? clean : 'Otros';
};

const stripExpenseFields = (payload) => {
    const {
        category,
        reference,
        notes,
        created_by_staff_id,
        is_expense,
        ...legacyPayload
    } = payload;
    return legacyPayload;
};

export const cashMovementService = {
    /**
     * Registra un movimiento de caja (entrada o salida) asociado a la sesión actual
     * @param {string} type - 'entrada' o 'salida'
     * @param {number} amount - monto del movimiento
     * @param {string} concept - concepto explicativo
     * @param {string} staffName - nombre del empleado que hace el movimiento
     * @returns {Promise<Object>} el movimiento registrado
     */
    async registerMovement(type, amount, concept, staffName, cashboxMode = 'terminal', options = {}) {
        if (type !== 'entrada' && type !== 'salida') {
            throw new Error('Tipo de movimiento inválido. Debe ser "entrada" o "salida".');
        }

        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            throw new Error('El monto debe ser numérico y mayor a 0.');
        }

        const session = await cashSessionService.getActiveSession(cashboxMode);
        if (!session) {
            throw new Error('No hay una sesión de caja activa en esta terminal para registrar el movimiento.');
        }

        const payload = {
            session_id: session.id,
            terminal_id: terminalService.getTerminalId(),
            movement_type: type,
            amount: numericAmount,
            concept: concept,
            staff_name: staffName || session.staff_name || 'Cajero', // Usar fallback
        };

        if (options.isExpense === true || options.is_expense === true) {
            payload.is_expense = true;
            payload.category = normalizeExpenseCategory(options.category);
            payload.reference = String(options.reference || '').trim() || null;
            payload.notes = String(options.notes || '').trim() || null;
            payload.created_by_staff_id = options.createdByStaffId || options.created_by_staff_id || null;
        }

        const { data, error } = await supabase
            .from('cash_movements')
            .insert([payload])
            .select()
            .single();

        if (error) {
            if (isMissingColumnError(error, 'terminal_id')) {
                const { terminal_id, ...legacyPayload } = payload;
                const { data: legacyData, error: legacyError } = await supabase
                    .from('cash_movements')
                    .insert([stripExpenseFields(legacyPayload)])
                    .select()
                    .single();

                if (legacyError) {
                    console.error('Error al registrar movimiento de caja legacy:', legacyError);
                    throw legacyError;
                }

                return legacyData;
            }

            if (
                isMissingColumnError(error, 'category') ||
                isMissingColumnError(error, 'reference') ||
                isMissingColumnError(error, 'notes') ||
                isMissingColumnError(error, 'created_by_staff_id') ||
                isMissingColumnError(error, 'is_expense')
            ) {
                const { data: legacyData, error: legacyError } = await supabase
                    .from('cash_movements')
                    .insert([stripExpenseFields(payload)])
                    .select()
                    .single();

                if (legacyError) {
                    console.error('Error al registrar movimiento de caja sin campos de gasto:', legacyError);
                    throw legacyError;
                }

                return legacyData;
            }

            console.error('Error al registrar movimiento de caja:', error);
            throw error;
        }

        return data;
    },

    async registerExpense(amount, concept, staffName, cashboxMode = 'terminal', options = {}) {
        return this.registerMovement('salida', amount, concept, staffName, cashboxMode, {
            ...options,
            isExpense: true,
            category: normalizeExpenseCategory(options.category),
        });
    },

    /**
     * Obtiene los movimientos de caja asociados a una sesión
     * @param {number} sessionId - ID de la sesión
     * @returns {Promise<Array>} lista de movimientos
     */
    async getMovementsBySession(sessionId) {
        if (!sessionId) return [];

        const { data, error } = await supabase
            .from('cash_movements')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error obteniendo movimientos de la sesión:', error);
            throw error;
        }

        return data || [];
    },

    async getExpenses({ sessionId = null, startTime = null, endTime = null } = {}) {
        let query = supabase
            .from('cash_movements')
            .select('*')
            .eq('movement_type', 'salida')
            .order('created_at', { ascending: false });

        if (sessionId) query = query.eq('session_id', sessionId);
        if (startTime) query = query.gte('created_at', startTime);
        if (endTime) query = query.lte('created_at', endTime);

        const { data, error } = await query;

        if (error) {
            console.error('Error obteniendo gastos de caja:', error);
            throw error;
        }

        return (data || []).filter((movement) => movement.is_expense === true);
    },

    async getExpenseSummary(params = {}) {
        const expenses = await this.getExpenses(params);
        const total = expenses.reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0);
        const byCategory = expenses.reduce((acc, expense) => {
            const category = expense.category || 'Otros';
            acc[category] = (acc[category] || 0) + (parseFloat(expense.amount) || 0);
            return acc;
        }, {});

        return {
            total,
            count: expenses.length,
            expenses,
            byCategory
        };
    },

    /**
     * Calcula los totales de entradas y salidas de una sesión
     * @param {number} sessionId - ID de la sesión
     * @returns {Promise<{totalEntradas: number, totalSalidas: number, movements: Array}>}  
     */
    async getSessionTotals(sessionId) {
        const movements = await this.getMovementsBySession(sessionId);

        let totalEntradas = 0;
        let totalSalidas = 0;

        movements.forEach(mov => {
            const amt = parseFloat(mov.amount) || 0;
            if (mov.movement_type === 'entrada') {
                totalEntradas += amt;
            } else if (mov.movement_type === 'salida') {
                totalSalidas += amt;
            }
        });

        return {
            totalEntradas,
            totalSalidas,
            movements
        };
    }
};
