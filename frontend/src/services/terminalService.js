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
        localStorage.removeItem('terminal_validated_global');
        sessionStorage.removeItem('terminal_validated');
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
            // 1. Asegurar que la sesión de Supabase esté lista antes de consultar
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData?.session) {
                console.log('[TerminalService] Sesión no lista aún, esperando...');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // 2. Si no hay terminal ID, intentar recuperar
            if (!terminalId) {
                console.log('[TerminalService] No hay terminal configurada localmente. Intentando auto-recuperar...');
                
                // Primero: intentar por Machine ID (Electron)
                if (window.electronAPI?.isElectron) {
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
                        console.warn('[TerminalService] Error en búsqueda por Machine ID:', err);
                    }
                }

                // Segundo: intentar por nombre de terminal guardado en sessionStorage (web)
                const savedTerminalName = sessionStorage.getItem('last_terminal_name');
                if (savedTerminalName) {
                    console.log(`[TerminalService] Intentando recuperar por nombre: ${savedTerminalName}`);
                    try {
                        const { data: tData, error: tError } = await supabase
                            .from('terminals')
                            .select('id, name')
                            .eq('name', savedTerminalName)
                            .eq('is_active', true)
                            .maybeSingle();

                        if (tData && !tError) {
                            console.log(`[TerminalService] ¡Caja recuperada por nombre! Asociando como: ${tData.name}`);
                            localStorage.setItem(TERMINAL_ID_KEY, tData.id);
                            localStorage.setItem(TERMINAL_NAME_KEY, tData.name);
                            return true;
                        }
                    } catch (err) {
                        console.warn('[TerminalService] Error en búsqueda por nombre:', err);
                    }
                }

                console.log('[TerminalService] No se pudo recuperar terminal automáticamente');
                return false;
            }

            // 3. Validar que el ID guardado existe en la DB
            const { data, error } = await supabase
                .from('terminals')
                .select('id, name')
                .eq('id', terminalId)
                .eq('is_active', true)
                .maybeSingle();

            // Error de red o similar - NO borrar configuración
            if (error) {
                console.error('[TerminalService] Error de DB validando terminal:', error);
                // Verificar si es error de red (código 0 o similar)
                if (error.message?.includes('network') || error.message?.includes('fetch') || error.status === 0) {
                    console.log('[TerminalService] Error de red, manteniendo configuración local');
                    return true;
                }
                return true; // Mantener configuración ante cualquier error
            }

            // La terminal NO existe en la DB o está inactiva
            if (!data) {
                console.warn(`[TerminalService] La terminal ${terminalId} ya no existe o está inactiva en la DB.`);
                // Intentar buscar por el nombre guardado por si fue migrada o recreada
                if (terminalName) {
                    const { data: tData, error: tError } = await supabase
                        .from('terminals')
                        .select('id, name')
                        .eq('name', terminalName)
                        .eq('is_active', true)
                        .maybeSingle();
                    
                    if (tData && !tError) {
                        console.log(`[TerminalService] Terminal reactivada/renombrada. Nueva ID: ${tData.id}`);
                        localStorage.setItem(TERMINAL_ID_KEY, tData.id);
                        sessionStorage.setItem('last_terminal_name', tData.name);
                        return true;
                    }
                }
                
                // No borrar - dejar que el usuario configure de nuevo
                this.resetLocalTerminal();
                sessionStorage.removeItem('last_terminal_name');
                return false;
            }

            // 4. Todo bien - guardar el nombre para recuperación futura
            console.log(`[TerminalService] Terminal validada con éxito: ${data.name}`);
            sessionStorage.setItem('last_terminal_name', data.name);
            return true;
        } catch (err) {
            console.error('[TerminalService] Error crítico en validación:', err);
            // No borrar configuración ante errores desconocidos
            return terminalId ? true : false;
        }
    }
};
