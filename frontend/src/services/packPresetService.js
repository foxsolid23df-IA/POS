import { supabase } from '../supabase';

export const packPresetService = {
    // Obtener presets para un producto específico
    getPresetsByProductId: async (productId) => {
        const { data, error } = await supabase
            .from('pack_presets')
            .select('*')
            .eq('product_id', productId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('[PackPresetService] Error fetching presets:', error);
            return [];
        }
        return data || [];
    },

    // Crear un nuevo preset
    createPreset: async (preset) => {
        const { data: userData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;

        const { data, error } = await supabase
            .from('pack_presets')
            .insert([{
                product_id: preset.product_id,
                units: parseFloat(preset.units),
                price: parseFloat(preset.price),
                label: preset.label || null,
                user_id: userData.user.id
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Eliminar un preset
    deletePreset: async (id) => {
        const { error } = await supabase
            .from('pack_presets')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
