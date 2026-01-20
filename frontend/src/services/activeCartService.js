import { supabase } from '../supabase';

export const activeCartService = {
    // Actualizar el carrito activo
    updateCart: async (cartData, total, sessionId = null) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('active_carts')
                .upsert({
                    user_id: user.id,
                    session_id: sessionId,
                    cart_data: cartData,
                    total: total,
                    status: 'active',
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id'
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error updating active cart:', error);
            throw error;
        }
    },

    // Actualizar la información de pago
    updatePaymentInfo: async (paymentInfo) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('active_carts')
                .update({
                    payment_method: paymentInfo.method,
                    amount_received: paymentInfo.received,
                    change_amount: paymentInfo.change,
                    status: paymentInfo.status || 'processing',
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', user.id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error updating payment info:', error);
            throw error;
        }
    },

    // Limpiar el carrito (al completar o cancelar)
    clearCart: async (status = 'completed') => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('active_carts')
                .update({
                    cart_data: [],
                    total: 0,
                    payment_method: null,
                    amount_received: null,
                    change_amount: null,
                    status: status,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', user.id);

            if (error) throw error;
        } catch (error) {
            console.error('Error clearing active cart:', error);
            throw error;
        }
    },

    // Obtener el carrito actual (para la carga inicial de la pantalla)
    getActiveCart: async (userId) => {
        try {
            const { data, error } = await supabase
                .from('active_carts')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching active cart:', error);
            throw error;
        }
    },

    // Suscribirse a cambios en tiempo real
    subscribeToCart: (userId, callback) => {
        console.log('Suscrito a cambios del carrito para usuario:', userId);
        return supabase
            .channel(`active_cart_changes_${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'active_carts',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    console.log('Cambio detectado en tiempo real:', payload);
                    callback(payload.new);
                }
            )
            .subscribe((status) => {
                console.log('Estado de la suscripción Realtime:', status);
            });
    }
};
