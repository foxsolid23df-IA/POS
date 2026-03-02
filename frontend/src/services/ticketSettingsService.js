import { supabase } from '../supabase';

export const ticketSettingsService = {
    // Obtener configuración del ticket para el usuario actual
    getSettings: async () => {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) return null;

        const { data, error } = await supabase
            .from('ticket_settings')
            .select('*')
            .eq('user_id', userData.user.id)
            .maybeSingle();

        if (error) {
            console.error('[ticketSettingsService] Error obteniendo configuración:', error);
            throw error;
        }

        return data;
    },

    // Guardar o actualizar configuración
    saveSettings: async (settings) => {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) throw new Error('Usuario no autenticado');

        const { data: existing } = await supabase
            .from('ticket_settings')
            .select('id')
            .eq('user_id', userData.user.id)
            .maybeSingle();

        const settingsData = {
            ...settings,
            user_id: userData.user.id,
            updated_at: new Date().toISOString()
        };

        let result;
        if (existing) {
            result = await supabase
                .from('ticket_settings')
                .update(settingsData)
                .eq('id', existing.id)
                .select()
                .single();
        } else {
            result = await supabase
                .from('ticket_settings')
                .insert([settingsData])
                .select()
                .single();
        }

        if (result.error) {
            console.error('[ticketSettingsService] Error guardando configuración:', result.error);
            throw result.error;
        }

        return result.data;
    }
};
