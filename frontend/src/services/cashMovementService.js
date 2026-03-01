import { supabase } from '../supabase';
import { cashSessionService } from './cashSessionService';

export const cashMovementService = {
    /**
     * Registra un movimiento de caja (entrada o salida) asociado a la sesión actual
     * @param {string} type - 'entrada' o 'salida'
     * @param {number} amount - monto del movimiento
     * @param {string} concept - concepto explicativo
     * @param {string} staffName - nombre del empleado que hace el movimiento
     * @returns {Promise<Object>} el movimiento registrado
     */
    async registerMovement(type, amount, concept, staffName) {
        if (type !== 'entrada' && type !== 'salida') {
            throw new Error('Tipo de movimiento inválido. Debe ser "entrada" o "salida".');
        }

        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            throw new Error('El monto debe ser numérico y mayor a 0.');
        }

        const session = await cashSessionService.getActiveSession();
        if (!session) {
            throw new Error('No hay una sesión de caja activa en esta terminal para registrar el movimiento.');
        }

        const { data, error } = await supabase
            .from('cash_movements')
            .insert([{
                session_id: session.id,
                movement_type: type,
                amount: numericAmount,
                concept: concept,
                staff_name: staffName || session.staff_name || 'Cajero', // Usar fallback
            }])
            .select()
            .single();

        if (error) {
            console.error('Error al registrar movimiento de caja:', error);
            throw error;
        }

        return data;
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
