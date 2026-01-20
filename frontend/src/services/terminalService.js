import { supabase } from '../supabase';

const TERMINAL_ID_KEY = 'pos_terminal_id';
const TERMINAL_NAME_KEY = 'pos_terminal_name';

export const terminalService = {
    getTerminalId: () => localStorage.getItem(TERMINAL_ID_KEY),
    getTerminalName: () => localStorage.getItem(TERMINAL_NAME_KEY),

    async registerTerminal(name, location = '') {
        // Verificar si ya existe una terminal con ese nombre
        const { data: existing, error: searchError } = await supabase
            .from('terminals')
            .select('*')
            .eq('name', name)
            .single();

        if (existing) {
             // Si existe, la usamos
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
            .insert([{ name, location }])
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
    }
};
