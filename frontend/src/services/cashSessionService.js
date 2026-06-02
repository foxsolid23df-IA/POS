import { supabase } from '../supabase';
import { terminalService } from './terminalService';
import { isAbortError } from '../utils/supabaseErrorHandler';

export const cashSessionService = {
    async getActiveSession(cashboxMode = 'terminal') {
        const terminalId = terminalService.getTerminalId();
        if (!terminalId) return null;

        let query = supabase
            .from('cash_sessions')
            .select('id, user_id, staff_id, staff_name, opening_fund, status, opened_at, closed_at, terminal_id, session_scope')
            .eq('status', 'open')
            .order('opened_at', { ascending: false })
            .limit(1);

        if (cashboxMode === 'shared_cashbox') {
            query = query.eq('session_scope', 'shared_cashbox');
        } else {
            query = query.eq('terminal_id', terminalId);
        }

        const { data, error } = await query.single();

        if (error && error.code !== 'PGRST116') {
            if (!isAbortError(error)) {
                console.error('Error obteniendo sesion activa:', error);
            }
            if (isAbortError(error)) return null;
            throw error;
        }

        return data;
    },

    async openSession(staffName, openingFund, staffId = null, cashboxMode = 'terminal') {
        const terminalId = terminalService.getTerminalId();
        if (!terminalId) throw new Error('Terminal no configurada');

        if (cashboxMode === 'shared_cashbox') {
            const existingSession = await this.getActiveSession('shared_cashbox');
            if (existingSession) return existingSession;
        }

        const { data, error } = await supabase
            .from('cash_sessions')
            .insert([{
                staff_name: staffName,
                staff_id: staffId,
                opening_fund: openingFund,
                status: 'open',
                opened_at: new Date().toISOString(),
                terminal_id: terminalId,
                session_scope: cashboxMode === 'shared_cashbox' ? 'shared_cashbox' : 'terminal'
            }])
            .select()
            .single();

        if (error) {
            if (cashboxMode === 'shared_cashbox' && error.code === '23505') {
                const existingSession = await this.getActiveSession('shared_cashbox');
                if (existingSession) return existingSession;
            }
            console.error('Error abriendo sesion de caja:', error);
            throw error;
        }

        return data;
    },

    async closeSession(sessionId) {
        const { data, error } = await supabase
            .from('cash_sessions')
            .update({
                status: 'closed',
                closed_at: new Date().toISOString()
            })
            .eq('id', sessionId)
            .select()
            .single();

        if (error) {
            console.error('Error cerrando sesion de caja:', error);
            throw error;
        }

        return data;
    },

    async getSessionHistory(limit = 10) {
        const { data, error } = await supabase
            .from('cash_sessions')
            .select('id, staff_name, opening_fund, status, opened_at, closed_at, terminal_id, session_scope, terminals(name)')
            .order('opened_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error obteniendo historial:', error);
            throw error;
        }

        return data || [];
    }
};
