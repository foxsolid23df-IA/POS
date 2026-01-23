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

        // NOTA: Se ha eliminado el cierre forzoso de sesiones previas al abrir una nueva.
        // En multicaja, si dos dispositivos comparten el mismo ID de terminal (mismo nombre),
        // abrir uno cerraría el otro. Es responsabilidad del sistema manejar sesiones colgadas de otra forma.

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

        // NOTA: Hemos eliminado la limpieza agresiva que cerraba TODAS las sesiones del usuario en la terminal.
        // En un entorno multicaja, esto causaba que al cerrar una caja se cerraran todas las demás 
        // si compartían el mismo usuario o nombre de terminal.
        // La sesión específica ya se cerró arriba mediante su ID único.

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
