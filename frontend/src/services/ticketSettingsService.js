import { supabase } from '../supabase';

export const ticketSettingsService = {
    // Obtener configuración del ticket para el usuario actual
    // userId se recibe como parámetro para evitar llamadas HTTP extra a supabase.auth.getUser()
    getSettings: async (userId) => {
        if (!userId) return null;

        const { data, error } = await supabase
            .from('ticket_settings')
            .select(`
                id,
                user_id,
                business_name,
                owner_name,
                rfc,
                curp,
                email,
                address,
                phone,
                logo_url,
                footer_message,
                paper_width,
                font_size,
                margin,
                font_family,
                is_bold,
                show_logo,
                show_business_name,
                show_owner_name,
                show_rfc,
                show_curp,
                show_email,
                show_address,
                show_phone,
                show_footer,
                show_billing_section,
                qr_code_size,
                cc_show_initial_fund,
                cc_show_card_sales,
                cc_show_transfer_sales,
                cc_show_withdrawals,
                cc_show_sales_count,
                cc_show_expected_cash,
                cc_show_counted_cash,
                cc_show_differences,
                cc_show_operator_name,
                cc_enable_day_cut,
                updated_at
            `)
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            console.error('[ticketSettingsService] Error obteniendo configuración:', error);
            throw error;
        }

        return data;
    },

    // Guardar o actualizar configuración
    // userId se recibe como parámetro para evitar llamadas HTTP extra a supabase.auth.getUser()
    saveSettings: async (settings, userId) => {
        if (!userId) throw new Error('Usuario no autenticado');

        const { data: existing } = await supabase
            .from('ticket_settings')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();

        const settingsData = {
            ...settings,
            user_id: userId,
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
