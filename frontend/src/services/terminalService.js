import { supabase } from '../supabase';

const TERMINAL_ID_KEY = 'pos_terminal_id';
const TERMINAL_NAME_KEY = 'pos_terminal_name';

export const terminalService = {
    getTerminalId: () => localStorage.getItem(TERMINAL_ID_KEY),
    getTerminalName: () => localStorage.getItem(TERMINAL_NAME_KEY),

    async registerTerminal(name, location = '', isMain = false) {
        const trimmedName = name.trim();
        
        let machineId = null;
        if (window.electronAPI && window.electronAPI.isElectron) {
            try {
                machineId = await window.electronAPI.getMachineId();
            } catch (err) {
                console.warn('[TerminalService] No se pudo obtener el Machine ID:', err);
            }
        }

        // 0. Enforcing Single Main Register Rule:
        if (isMain) {
            await supabase
                .from('terminals')
                .update({ is_main: false })
                .eq('is_main', true);
        }

        // 1. Verificar si ya existe una terminal con ese nombre
        const { data: existingByName, error: fetchError } = await supabase
            .from('terminals')
            .select('*')
            .eq('name', trimmedName)
            .maybeSingle();

        if (fetchError) throw fetchError;

        if (existingByName) {
            // Si el Machine ID coincide, podemos reutilizarla (o si no hay machineId en ninguno)
            const sameMachine = (machineId && existingByName.machine_id === machineId) || 
                              (!machineId && !existingByName.machine_id);

            if (sameMachine) {
                console.log('[TerminalService] Reutilizando terminal existente (Misma máquina o sin Machine ID)');
                
                // Actualizar info por si cambió ubicación o rol
                const { data: updated, error: updateError } = await supabase
                    .from('terminals')
                    .update({ 
                        location: location.trim(),
                        is_main: isMain,
                        is_active: true // Asegurar que esté activa
                    })
                    .eq('id', existingByName.id)
                    .select()
                    .single();

                if (updateError) throw updateError;

                localStorage.setItem(TERMINAL_ID_KEY, updated.id);
                localStorage.setItem(TERMINAL_NAME_KEY, updated.name);
                return updated;
            } else {
                // El nombre está tomado por OTRA máquina
                const conflictError = new Error('NAME_ALREADY_EXISTS');
                conflictError.details = `El nombre "${trimmedName}" ya está registrado para otro equipo en la red.`;
                throw conflictError;
            }
        }

        // 2. Si no existe, crear nueva
        const { data, error } = await supabase
            .from('terminals')
            .insert([{
                name: trimmedName,
                location: location.trim(),
                is_main: isMain,
                machine_id: machineId
            }])
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
            .eq('is_active', true) // Solo terminales activas
            .order('name');
        if (error) throw error;
        return data;
    },

    async deleteTerminal(id) {
        // En un sistema contable, no borramos físicamente si hay historial. 
        // Inactivamos la terminal (Soft Delete).
        const { error } = await supabase
            .from('terminals')
            .update({ is_active: false })
            .eq('id', id);

        if (error) throw error;

        // Si inactivamos la terminal actual, limpiar localStorage
        if (id === this.getTerminalId()) {
            this.resetLocalTerminal();
        }
        return true;
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

    async hasMainTerminal() {
        const { data, error } = await supabase
            .from('terminals')
            .select('id')
            .eq('is_main', true)
            .limit(1);

        if (error) {
            console.error('Error verificando existencia de terminal principal:', error);
            return false; // Default to not having one if there's an error, or true? False is safer to allow config if error happens.
        }

        return data && data.length > 0;
    },

    /**
     * Valida si el ID de terminal en localStorage realmente existe en la DB
     */
    async validateTerminalExistence() {
        const terminalId = this.getTerminalId();
        const terminalName = this.getTerminalName();

        console.log(`[TerminalService] Validando terminal: ${terminalName} (${terminalId})`);

        try {
            // Pequeña espera para asegurar que la sesión de Supabase esté estable
            await new Promise(resolve => setTimeout(resolve, 500));

            if (!terminalId) {
                console.log('[TerminalService] No hay terminal configurada localmente. Intentando auto-recuperar por Machine ID...');
                if (window.electronAPI && window.electronAPI.isElectron) {
                    try {
                        const machineId = await window.electronAPI.getMachineId();
                        if (machineId) {
                            const { data: mData, error: mError } = await supabase
                                .from('terminals')
                                .select('id, name')
                                .eq('machine_id', machineId)
                                .eq('is_active', true)
                                .maybeSingle();
                            
                            if (mData && !mError) {
                                console.log(`[TerminalService] ¡Caja encontrada por Machine ID! Asociando como: ${mData.name}`);
                                localStorage.setItem(TERMINAL_ID_KEY, mData.id);
                                localStorage.setItem(TERMINAL_NAME_KEY, mData.name);
                                return true;
                            }
                        }
                    } catch (err) {
                        console.error('[TerminalService] Error en búsqueda por Machine ID:', err);
                    }
                }
                return false;
            }

            const { data, error } = await supabase
                .from('terminals')
                .select('id, name')
                .eq('id', terminalId)
                .maybeSingle(); // Usar maybeSingle para evitar errores si no existe

            if (error) {
                console.error('[TerminalService] Error de DB validando terminal:', error);
                // Si es un error de red o similar, no borrar configuración
                return true;
            }

            if (!data) {
                console.warn(`[TerminalService] La terminal ${terminalId} no existe en la base de datos.`);
                // Solo borrar si estamos SEGUROS de que no existe (es decir, data es null y no hay error)
                this.resetLocalTerminal();
                return false;
            }

            console.log(`[TerminalService] Terminal validada con éxito: ${data.name}`);
            return true;
        } catch (err) {
            console.error('[TerminalService] Error crítico en validación:', err);
            return true; // No borrar en caso de error desconocido
        }
    }
};
