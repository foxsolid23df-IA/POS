import { supabase } from '../supabase';
import { terminalService } from './terminalService';
import { isAbortError } from '../utils/supabaseErrorHandler';

export const cashSessionService = {
    /**
     * Obtiene la sesión de caja activa del usuario actual en ESTA terminal
     */
    async getActiveSession() {
        const terminalId = terminalService.getTerminalId();
        if (!terminalId) return null;

        const { data, error } = await supabase
            .from('cash_sessions')
            .select('*')
            .eq('status', 'open')
            .eq('terminal_id', terminalId)
            .order('opened_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') {
             if (!isAbortError(error)) {
                console.error('Error obteniendo sesión activa:', error);
             }
             // Si es abort, podríamos retornar null o re-lanzar, pero para getActiveSession
             // suele ser mejor devolver null si se canceló la carga.
             if (isAbortError(error)) return null;
             
             throw error;
        }

        return data;
    },

    /**
     * Abre una nueva sesión de caja con el fondo inicial
     */
    async openSession(staffName, openingFund, staffId = null) {
        const terminalId = terminalService.getTerminalId();
        if (!terminalId) throw new Error("Terminal no configurada");

        // 1. Seguridad: Cerrar cualquier sesión que haya quedado abierta por error EN ESTA TERMINAL
        try {
            const { data: userData, error: authError } = await supabase.auth.getUser();
            
            // Ignorar errores de señales abortadas
            if (authError && !authError.message?.includes('aborted') && authError.name !== 'AbortError') {
                console.warn('[cashSessionService] Error getting user:', authError);
            }
            
            if (userData?.user) {
                await supabase
                    .from('cash_sessions')
                    .update({ 
                        status: 'closed', 
                        closed_at: new Date().toISOString() 
                    })
                    .eq('user_id', userData.user.id)
                    .eq('terminal_id', terminalId)
                    .eq('status', 'open');
            }
        } catch (e) {
            // Ignorar errores de señales abortadas
            if (!e?.message?.includes('aborted') && e?.name !== 'AbortError') {
                console.warn('[cashSessionService] No se pudieron cerrar sesiones previas:', e.message || e);
            }
        }

        // 2. Abrir la nueva sesión
        const { data, error } = await supabase
            .from('cash_sessions')
            .insert([{
                staff_name: staffName,
                staff_id: staffId,
                opening_fund: openingFund,
                status: 'open',
                opened_at: new Date().toISOString(),
                terminal_id: terminalId
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
        const terminalId = terminalService.getTerminalId();

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
        // para este usuario EN ESTA TERMINAL (para evitar el problema de "vuelve a abrir con el monto anterior")
        try {
            const { data: userData, error: authError } = await supabase.auth.getUser();
            
            // Ignorar errores de señales abortadas
            if (authError && !authError.message?.includes('aborted') && authError.name !== 'AbortError') {
                console.warn('[cashSessionService] Error getting user in closeSession:', authError);
            }
            
            if (userData?.user && terminalId) {
                await supabase
                    .from('cash_sessions')
                    .update({ 
                        status: 'closed', 
                        closed_at: new Date().toISOString() 
                    })
                    .eq('user_id', userData.user.id)
                    .eq('terminal_id', terminalId)
                    .eq('status', 'open');
            }
        } catch (e) {
            // Ignorar errores de señales abortadas
            if (!e?.message?.includes('aborted') && e?.name !== 'AbortError') {
                console.error('[cashSessionService] Error en limpieza de sesiones:', e.message || e);
            }
        }

        if (error) {
            console.error('Error cerrando sesión de caja:', error);
            throw error;
        }

        return data;
    },

    /**
     * Obtiene el historial de sesiones de caja (filtrado por terminal opcionalmente, 
     * pero generalmente el historial muestra todo, aunque para reportes locales quizás solo terminal)
     * Por ahora mostramos todo para el admin, o filtrado por usuario si es cajero.
     */
    async getSessionHistory(limit = 10) {
        const { data, error } = await supabase
            .from('cash_sessions')
            .select('*, terminals(name)')
            .order('opened_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error obteniendo historial:', error);
            throw error;
        }

        return data || [];
    }
};
