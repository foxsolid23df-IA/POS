import { supabase } from '../supabase';

const TERMINAL_ID_KEY = 'pos_terminal_id';
const TERMINAL_NAME_KEY = 'pos_terminal_name';

export const terminalService = {
    getTerminalId: () => localStorage.getItem(TERMINAL_ID_KEY),
    getTerminalName: () => localStorage.getItem(TERMINAL_NAME_KEY),

    async registerTerminal(name, location = '', isMain = false) {
        // Enforcing Single Main Register Rule:
        // Si esta terminal será la principal, primero quitamos el privilegio a cualquier otra.
        if (isMain) {
            await supabase
                .from('terminals')
                .update({ is_main: false })
                .eq('is_main', true);
        }

        // Verificar si ya existe una terminal con ese nombre
        const { data: existing, error: searchError } = await supabase
            .from('terminals')
            .select('*')
            .eq('name', name)
            .single();

        if (existing) {
             // Si existe, la usamos (y actualizamos si es main si se solicita)
             if (isMain !== undefined && existing.is_main !== isMain) {
                 await supabase.from('terminals').update({ is_main: isMain }).eq('id', existing.id);
                 existing.is_main = isMain;
             }
             // Si forzamos isMain true arriba, aseguramos que este específico quede true (por si el update global lo afectó, aunque el orden de ejecución debería prevenirlo, es mejor ser explícito en el siguiente paso o confiar en la lógica actual).
             // En este bloque 'if (existing)', si isMain es true, ya hicimos update global false, y luego update local true. Correcto.

             localStorage.setItem(TERMINAL_ID_KEY, existing.id);
             localStorage.setItem(TERMINAL_NAME_KEY, existing.name);
             return existing;
        }

        // Si no existe y no hubo error de conexión (PGRST116 es "no found", que está bien aquí)
        if (searchError && searchError.code !== 'PGRST116') {
            throw searchError;
        }

        // Crear nueva terminal
        const { data, error } = await supabase
            .from('terminals')
            .insert([{ name, location, is_main: isMain }])
            .select()
            .single();
        
        if (error) throw error;

        localStorage.setItem(TERMINAL_ID_KEY, data.id);
        localStorage.setItem(TERMINAL_NAME_KEY, data.name);
        return data;
    },

    async getTerminals() {
         const { data, error } = await supabase
            .from('terminals')
            .select('*')
            .order('name');
         if (error) throw error;
         return data;
    },
    
    // Función para resetear la terminal local (útil para pruebas o reconfiguración)
    resetLocalTerminal() {
        localStorage.removeItem(TERMINAL_ID_KEY);
        localStorage.removeItem(TERMINAL_NAME_KEY);
    },

    async checkIfMainTerminal() {
        const terminalId = this.getTerminalId();
        if (!terminalId) return false;

        const { data, error } = await supabase
            .from('terminals')
            .select('is_main')
            .eq('id', terminalId)
            .single();

        if (error) {
            console.error('Error verificando terminal principal:', error);
            return false;
        }

        return data?.is_main || false;
    },

    /**
     * Valida si el ID de terminal en localStorage realmente existe en la DB
     */
    async validateTerminalExistence() {
        const terminalId = this.getTerminalId();
        if (!terminalId) return false;

        const { data, error } = await supabase
            .from('terminals')
            .select('id')
            .eq('id', terminalId)
            .single();

        if (error || !data) {
            if (error && error.code !== 'PGRST116') {
                console.error('Error validando terminal:', error);
            }
            // Si no existe o hay error, limpiar para forzar re-configuración
            this.resetLocalTerminal();
            return false;
        }

        return true;
    }
};
