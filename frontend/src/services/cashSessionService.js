import { supabase } from '../supabase';
import { terminalService } from './terminalService';
import { isAbortError } from '../utils/supabaseErrorHandler';

const isMissingColumnError = (error, columnName) =>
    error?.code === '42703' && (!columnName || error?.message?.includes(columnName));

export const cashSessionService = {
    async getLegacyActiveSession(terminalId) {
        const { data, error } = await supabase
            .from('cash_sessions')
            .select('id, user_id, staff_id, staff_name, opening_fund, status, opened_at, closed_at, terminal_id')
            .eq('status', 'open')
            .eq('terminal_id', terminalId)
            .order('opened_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') {
            if (!isAbortError(error)) {
                console.error('Error obteniendo sesion activa legacy:', error);
            }
            if (isAbortError(error)) return null;
            throw error;
        }

        return data ? { ...data, session_scope: 'terminal' } : null;
    },

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

        if (isMissingColumnError(error, 'session_scope')) {
            return this.getLegacyActiveSession(terminalId);
        }

        if (error && error.code !== 'PGRST116') {
            if (!isAbortError(error)) {
                console.error('Error obteniendo sesion activa:', error);
            }
            if (isAbortError(error)) return null;
            throw error;
        }

        return data ? { ...data, session_scope: data.session_scope || 'terminal' } : null;
    },

    async openSession(staffName, openingFund, staffId = null, cashboxMode = 'terminal') {
        const isTerminalValid = await terminalService.validateTerminalExistence();
        if (!isTerminalValid) {
            throw new Error('La terminal de esta computadora ya no esta registrada. Configura la terminal nuevamente para abrir caja.');
        }

        const terminalId = terminalService.getTerminalId();
        if (!terminalId) throw new Error('Terminal no configurada');

        if (cashboxMode === 'shared_cashbox') {
            const existingSession = await this.getActiveSession('shared_cashbox');
            if (existingSession) return existingSession;
        }

        const payload = {
            staff_name: staffName,
            staff_id: staffId,
            opening_fund: openingFund,
            status: 'open',
            opened_at: new Date().toISOString(),
            terminal_id: terminalId,
            session_scope: cashboxMode === 'shared_cashbox' ? 'shared_cashbox' : 'terminal'
        };

        const { data, error } = await supabase
            .from('cash_sessions')
            .insert([payload])
            .select()
            .single();

        if (error) {
            if (isMissingColumnError(error, 'session_scope')) {
                if (cashboxMode === 'shared_cashbox') {
                    throw new Error('La base de datos aun no tiene la migracion de caja compartida. Aplica la migracion 20260602_shared_cashbox.sql en Supabase.');
                }

                const { session_scope, ...legacyPayload } = payload;
                const { data: legacyData, error: legacyError } = await supabase
                    .from('cash_sessions')
                    .insert([legacyPayload])
                    .select()
                    .single();

                if (legacyError) {
                    console.error('Error abriendo sesion de caja legacy:', legacyError);
                    throw legacyError;
                }

                return { ...legacyData, session_scope: 'terminal' };
            }

            if (cashboxMode === 'shared_cashbox' && error.code === '23505') {
                const existingSession = await this.getActiveSession('shared_cashbox');
                if (existingSession) return existingSession;
            }

            if (error.code === '23503' && error.message?.includes('cash_sessions_terminal_id_fkey')) {
                terminalService.resetLocalTerminal();
                throw new Error('La terminal local ya no existe en el sistema. Configura esta terminal nuevamente antes de abrir caja.');
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

        if (isMissingColumnError(error, 'session_scope')) {
            const { data: legacyData, error: legacyError } = await supabase
                .from('cash_sessions')
                .select('id, staff_name, opening_fund, status, opened_at, closed_at, terminal_id, terminals(name)')
                .order('opened_at', { ascending: false })
                .limit(limit);

            if (legacyError) {
                console.error('Error obteniendo historial legacy:', legacyError);
                throw legacyError;
            }

            return (legacyData || []).map((session) => ({ ...session, session_scope: 'terminal' }));
        }

        if (error) {
            console.error('Error obteniendo historial:', error);
            throw error;
        }

        return data || [];
    }
};
