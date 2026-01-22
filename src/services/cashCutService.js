import { supabase } from '../supabase';
import { salesService } from './salesService';

export const cashCutService = {
    // Obtener el último corte de caja (para saber dónde empezó el turno)
    getLastCut: async () => {
        const { data, error } = await supabase
            .from('cash_cuts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
        return data;
    },

    // Obtener ventas desde una fecha
    getSalesSince: async (startTime) => {
        return await salesService.getSalesSince(startTime);
    },

    // Obtener ventas del día actual
    getTodaySales: async () => {
        return await salesService.getTodaySales();
    },

    // Crear un corte de caja
    createCashCut: async (cutData) => {
        const { data: userData } = await supabase.auth.getUser();

        const { data, error } = await supabase
            .from('cash_cuts')
            .insert([{
                staff_name: cutData.staffName,
                staff_role: cutData.staffRole,
                cut_type: cutData.cutType, // 'turno' | 'dia' | 'parcial'
                start_time: cutData.startTime,
                end_time: new Date().toISOString(),
                sales_count: cutData.salesCount,
                sales_total: cutData.salesTotal,
                expected_cash: cutData.expectedCash,
                actual_cash: cutData.actualCash || null,
                difference: cutData.actualCash ? (cutData.actualCash - cutData.expectedCash) : null,
                notes: cutData.notes || null,
                user_id: userData.user.id
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Obtener historial de cortes
    getCashCuts: async (limit = 30) => {
        const { data, error } = await supabase
            .from('cash_cuts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    },

    // Calcular resumen de turno actual
    getCurrentShiftSummary: async () => {
        // Obtener último corte para saber cuándo empezó el turno
        let lastCut = null;
        try {
            lastCut = await cashCutService.getLastCut();
        } catch (e) {
            // No hay cortes previos
        }

        // Si no hay corte previo, usar el inicio del día
        const startTime = lastCut
            ? lastCut.end_time
            : new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

        // Obtener ventas desde el último corte
        const sales = await cashCutService.getSalesSince(startTime);

        const salesCount = sales.length;
        const salesTotal = sales.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);

        return {
            startTime,
            salesCount,
            salesTotal,
            sales
        };
    }
};
