import { supabase } from '../supabase';

export const exchangeRateService = {
    // Obtener tipo de cambio activo
    getActiveRate: async () => {
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            
            // Ignorar errores de señales abortadas
            if (authError) {
                if (authError.message?.includes('aborted') || authError.name === 'AbortError') {
                    return null;
                }
                console.error('[exchangeRateService] Auth error:', authError);
                return null;
            }
            
            if (!user) return null;

            const { data, error } = await supabase
                .from('exchange_rates')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 is "The result contains 0 rows"
                console.error('[exchangeRateService] Error fetching exchange rate:', error);
                return null;
            }
            return data;
        } catch (error) {
            // Ignorar errores de señales abortadas
            if (error?.message?.includes('aborted') || error?.name === 'AbortError') {
                return null;
            }
            console.error('[exchangeRateService] Error in getActiveRate:', error.message || error);
            return null;
        }
    },

    // Actualizar o crear nuevo tipo de cambio
    updateRate: async (rate) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuario no autenticado');

        // Primero desactivamos el anterior si existe (opcional, pero buena práctica para historial)
        // En este diseño simple, podemos simplemente insertar uno nuevo como activo
        // O actualizar el existente si solo queremos mantener uno.
        // Vamos a insertar uno nuevo para tener historial y marcar los demás como inactivos.
        
        // Desactivar todos los anteriores
        await supabase
            .from('exchange_rates')
            .update({ is_active: false })
            .eq('user_id', user.id);

        // Insertar nuevo rate
        const { data, error } = await supabase
            .from('exchange_rates')
            .insert([{
                user_id: user.id,
                rate: rate,
                currency_code: 'USD',
                is_active: true
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Activar/Desactivar pagos en USD
    toggleActive: async (isActive) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Buscamos el último rate creado
        const { data: currentRate } = await supabase
            .from('exchange_rates')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (currentRate) {
            const { error } = await supabase
                .from('exchange_rates')
                .update({ is_active: isActive })
                .eq('id', currentRate.id);
                
            if (error) throw error;
        } else if (isActive) {
            // Si no existe y lo quieren activar, creamos uno por defecto (ej: 0)
            await exchangeRateService.updateRate(0);
        }
    }
};
