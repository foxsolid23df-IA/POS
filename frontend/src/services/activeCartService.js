import { supabase } from '../supabase';
import { safeSupabaseOperation, handleAuthError, createServiceLogger } from '../utils/supabaseErrorHandler';

const logger = createServiceLogger('activeCartService');

export const activeCartService = {
    // Actualizar el carrito activo
    updateCart: async (cartData, total, sessionId) => {
        return safeSupabaseOperation(async () => {
            const authResult = await supabase.auth.getUser();
            const user = handleAuthError(authResult, '[activeCartService]');
            
            if (!user) return null;

            // Si no hay sesión, no guardamos en DB para evitar conflictos
            // En modo multicaja, la sesión es obligatoria para identificar el checkout
            if (!sessionId) {
                logger.warn('No sessionId provided, skipping DB update.');
                return null;
            }

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
                    onConflict: 'session_id' 
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        }, {
            context: '[activeCartService.updateCart]',
            defaultValue: null,
            throwOnError: false,
            ignoreAbort: true
        });
    },

    // Actualizar la información de pago
    updatePaymentInfo: async (paymentInfo) => {
        return safeSupabaseOperation(async () => {
            const authResult = await supabase.auth.getUser();
            const user = handleAuthError(authResult, '[activeCartService]');
            
            if (!user) return null;

            let query = supabase
                .from('active_carts')
                .update({
                    payment_method: paymentInfo.method,
                    amount_received: paymentInfo.received,
                    change_amount: paymentInfo.change,
                    status: paymentInfo.status || 'processing',
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', user.id);

            if (paymentInfo.sessionId) {
                query = query.eq('session_id', paymentInfo.sessionId);
            }

            const { data, error } = await query.select().maybeSingle();
                
            if (error) throw error;
            return data;
        }, {
            context: '[activeCartService.updatePaymentInfo]',
            defaultValue: null,
            throwOnError: false,
            ignoreAbort: true
        });
    },

    // Limpiar el carrito (al completar o cancelar)
    clearCart: async (status = 'completed') => {
        return safeSupabaseOperation(async () => {
            const authResult = await supabase.auth.getUser();
            const user = handleAuthError(authResult, '[activeCartService]');
            
            if (!user) return null;
            
            // Ídem anterior: borrar por user_id borra el de TODAS las cajas de ese usuario.
            // Para multicaja real, necesitamos session_id aquí.
            // PERO ActiveCartService se usa en Sales.jsx que SI tiene session.
            // Vamos a dejarlo "global" por usuario por ahora para asegurar limpieza,
            // pero sabiendo que en Multicaja con mismo user cerraría el display del otro.
            // FIX PARCIAL: Solo limpiar el que esté activo/procesando? 
            
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
            return true;
        }, {
            context: '[activeCartService.clearCart]',
            defaultValue: null,
            throwOnError: true,
            ignoreAbort: true
        });
    },

    // Obtener el carrito actual (para la carga inicial de la pantalla)
    getActiveCart: async (userId, sessionId = null) => {
        return safeSupabaseOperation(async () => {
            let query = supabase
                .from('active_carts')
                .select('*')
                .eq('user_id', userId);
            
            if (sessionId) {
                query = query.eq('session_id', sessionId);
            }

            // Usamos limit(1) y single/maybeSingle para evitar errores si por alguna razón hay duplicados
            const { data, error } = await query
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            return data;
        }, {
            context: '[activeCartService.getActiveCart]',
            defaultValue: null,
            throwOnError: false, // No lanzar error, devolver null
            ignoreAbort: true // Ignorar errores de abort (rojos en consola)
        });
    },

    // [Fallback] Obtener CUALQUIER carrito activo del usuario (ignora session_id)
    // Útil cuando el session_id de la URL no coincide con la BD por algún motivo
    getAnyActiveCartForUser: async (userId) => {
        return safeSupabaseOperation(async () => {
             const { data, error } = await supabase
                .from('active_carts')
                .select('*')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false }) // El más reciente
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            return data;
        }, {
            context: '[activeCartService.getAnyActiveCartForUser]',
            defaultValue: null,
            throwOnError: false,
            ignoreAbort: true
        });
    },

    // Suscribirse a cambios en tiempo real
    subscribeToCart: (userId, sessionId, callback) => {
        console.log('Suscrito a cambios del carrito para:', { userId, sessionId });
        
        let filter = `user_id=eq.${userId}`;
        if (sessionId) {
            filter += `&session_id=eq.${sessionId}`;
        }

        return supabase
            .channel(`active_cart_changes_${userId}_${sessionId || 'global'}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'active_carts',
                    filter: filter
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
