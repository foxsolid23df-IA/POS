import { supabase } from '../supabase';
import { salesService } from './salesService';
import { terminalService } from './terminalService';

export const cashCutService = {
    // Obtener el último corte de caja (para saber dónde empezó el turno)
    getLastCut: async () => {
        try {
            const { data, error } = await supabase
                .from('cash_cuts')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error en getLastCut:', error);
                throw error;
            }
            return data;
        } catch (error) {
            console.error('Excepción en getLastCut:', error);
            return null;
        }
    },

    // Obtener el último corte DE TIPO DÍA
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
                difference: cutData.difference,
                expected_usd: cutData.expectedUSD || 0,
                actual_usd: cutData.actualUSD || 0,
                difference_usd: cutData.differenceUSD || 0,
                card_total: cutData.cardTotal || 0,
                transfer_total: cutData.transferTotal || 0,
                notes: cutData.notes || null,
                user_id: userData.user.id,
                terminal_id: terminalService.getTerminalId()
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Verificar si hay sesiones abiertas en OTRAS terminales
    checkBlockingSessions: async () => {
        const currentTerminalId = terminalService.getTerminalId();
        if (!currentTerminalId) return [];

        // Buscar sesiones abiertas en terminales distintas a la actual
        const { data, error } = await supabase
            .from('cash_sessions')
            .select(`
                *,
                terminals (name)
            `) // Usamos staff_name que ya está en la tabla
            .eq('status', 'open')
            .neq('terminal_id', currentTerminalId);

        if (error) {
            console.error('Error verificando sesiones bloqueantes:', error);
            throw error;
        }

        return data || [];
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

    // Calcular resumen de turno actual o día
    getCurrentShiftSummary: async (cutType = 'turno') => {
        let startTime = null;
        let sales = [];

        try {
            if (cutType === 'turno') {
                const terminalId = terminalService.getTerminalId();
                
                if (terminalId) {
                    // Validar si es un UUID válido para evitar errores de Postgres
                    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                    if (!uuidRegex.test(terminalId)) {
                        console.error('ID de terminal inválido:', terminalId);
                        throw new Error(`ID de terminal inválido: ${terminalId}`);
                    }

                    const { data: session, error: sessionError } = await supabase
                        .from('cash_sessions')
                        .select('opened_at')
                        .eq('terminal_id', terminalId)
                        .eq('status', 'open')
                        .order('opened_at', { ascending: false })
                        .limit(1)
                        .single();
                    
                    if (sessionError && sessionError.code !== 'PGRST116') {
                        console.error('Error buscando sesión:', sessionError);
                    }

                    if (session && session.opened_at) {
                        startTime = session.opened_at;
                    } else {
                        const lastCut = await cashCutService.getLastCut();
                        startTime = lastCut ? lastCut.end_time : new Date(new Date().setHours(0,0,0,0)).toISOString();
                    }
                    sales = await salesService.getSalesSince(startTime, terminalId);
                } else {
                    console.warn("Terminal ID not found in localStorage");
                    startTime = new Date(new Date().setHours(0,0,0,0)).toISOString();
                    sales = await salesService.getSalesSince(startTime, null);
                }
            } else {
                const lastDayCut = await cashCutService.getLastDayCut();
                startTime = lastDayCut ? lastDayCut.end_time : new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
                sales = await salesService.getSalesSince(startTime, null);
            }

            const salesCount = sales.length;
            const salesTotal = sales.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);

            // Calcular totales por método de pago para el resumen
            const cardTotal = sales
                .filter(s => s.payment_method === 'tarjeta')
                .reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);
            
            const transferTotal = sales
                .filter(s => s.payment_method === 'transferencia')
                .reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);

            const cashTotal = sales
                .filter(s => s.payment_method === 'efectivo')
                .reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);

            return {
                startTime,
                salesCount,
                salesTotal,
                cardTotal,
                transferTotal,
                cashTotal,
                sales
            };
        } catch (error) {
            console.error('Error detallado en getCurrentShiftSummary:', error);
            throw error;
        }
    }
};
