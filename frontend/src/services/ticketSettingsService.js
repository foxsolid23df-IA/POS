import { supabase } from '../supabase';

const AUTO_DISPLAY_KEY = 'pos_auto_customer_display';

export const ticketSettingsService = {
    // Obtener configuración del ticket para el usuario actual
    // userId se recibe como parámetro para evitar llamadas HTTP extra a supabase.auth.getUser()
    getSettings: async (userId) => {
        if (!userId) return null;

        // Intentar SELECT con la columna auto_customer_display
        // Si falla (columna no existe), hacer SELECT sin ella
        let data = null;
        let error = null;

        const resultConColumna = await supabase
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
                auto_customer_display,
                updated_at
            `)
            .eq('user_id', userId)
            .maybeSingle();

        if (resultConColumna.error) {
            console.warn('[ticketSettingsService] Columna auto_customer_display no existe aún, usando SELECT sin ella');
            // Fallback: SELECT sin la columna
            const resultSinColumna = await supabase
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

            data = resultSinColumna.data;
            error = resultSinColumna.error;
        } else {
            data = resultConColumna.data;
        }

        if (error) {
            console.error('[ticketSettingsService] Error obteniendo configuración:', error);
            throw error;
        }

        // Completar con valor de localStorage si la columna no existe en DB
        if (data && data.auto_customer_display === undefined) {
            data.auto_customer_display = localStorage.getItem(AUTO_DISPLAY_KEY) === 'true';
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

        // Guardar auto_customer_display en localStorage como respaldo
        if (settings.auto_customer_display !== undefined) {
            localStorage.setItem(AUTO_DISPLAY_KEY, settings.auto_customer_display ? 'true' : 'false');
        }

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
