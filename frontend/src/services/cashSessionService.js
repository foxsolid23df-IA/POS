import { supabase } from '../supabase';

export const cashSessionService = {
    /**
     * Obtiene la sesión de caja activa del usuario actual
     */
    async getActiveSession() {
        const { data, error } = await supabase
            .from('cash_sessions')
            .select('*')
            .eq('status', 'open')
            .order('opened_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error obteniendo sesión activa:', error);
            throw error;
        }

        return data;
    },

    /**
     * Abre una nueva sesión de caja con el fondo inicial
     */
    async openSession(staffName, openingFund, staffId = null) {
        // 1. Seguridad: Cerrar cualquier sesión que haya quedado abierta por error
        try {
            const { data: userData } = await supabase.auth.getUser();
            if (userData?.user) {
                await supabase
                    .from('cash_sessions')
                    .update({ 
                        status: 'closed', 
                        closed_at: new Date().toISOString() 
                    })
                    .eq('user_id', userData.user.id)
                    .eq('status', 'open');
            }
        } catch (e) {
            console.warn('No se pudieron cerrar sesiones previas:', e);
        }

        // 2. Abrir la nueva sesión
        const { data, error } = await supabase
            .from('cash_sessions')
            .insert([{
                staff_name: staffName,
                staff_id: staffId,
                opening_fund: openingFund,
                status: 'open',
                opened_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) {
            console.error('Error abriendo sesión de caja:', error);
            throw error;
        }

        return data;
    },

    /**
     * Cierra la sesión de caja actual
     */
    async closeSession(sessionId) {
        // Primero intentamos cerrar la sesión específica
        const { data, error } = await supabase
            .from('cash_sessions')
            .update({
                status: 'closed',
                closed_at: new Date().toISOString()
            })
            .eq('id', sessionId)
            .select()
            .single();

        // Como medida de seguridad adicional, nos aseguramos de que NO queden otras sesiones abiertas
        // para este usuario (para evitar el problema de "vuelve a abrir con el monto anterior")
        try {
            const { data: userData } = await supabase.auth.getUser();
            if (userData?.user) {
                await supabase
                    .from('cash_sessions')
                    .update({ 
                        status: 'closed', 
                        closed_at: new Date().toISOString() 
                    })
                    .eq('user_id', userData.user.id)
                    .eq('status', 'open');
            }
        } catch (e) {
            console.error('Error en limpieza de sesiones:', e);
        }

        if (error) {
            console.error('Error cerrando sesión de caja:', error);
            throw error;
        }

        return data;
    },

    /**
     * Obtiene el historial de sesiones de caja
     */
    async getSessionHistory(limit = 10) {
        const { data, error } = await supabase
            .from('cash_sessions')
            .select('*')
            .order('opened_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error obteniendo historial:', error);
            throw error;
        }

        return data || [];
    }
};
