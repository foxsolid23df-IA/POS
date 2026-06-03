import { supabase } from '../supabase';
import { safeSupabaseOperation, handleAuthError, createServiceLogger } from '../utils/supabaseErrorHandler';
import { terminalService } from './terminalService';

const logger = createServiceLogger('activeCartService');
const isMissingColumnError = (error, columnName) =>
    error?.code === '42703' && (!columnName || error?.message?.includes(columnName));
const isMissingConstraintError = (error) =>
    error?.code === '42P10' || error?.message?.includes('no unique or exclusion constraint');

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
            const terminalId = terminalService.getTerminalId();
            if (!terminalId) {
                logger.warn('No terminalId available, skipping DB update.');
                return null;
            }

            const { data, error } = await supabase
                .from('active_carts')
                .upsert({
                    user_id: user.id,
                    session_id: sessionId,
                    terminal_id: terminalId,
                    cart_data: cartData,
                    total: total,
                    status: 'active',
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'session_id,terminal_id'
                })
                .select()
                .single();

            if (isMissingColumnError(error, 'terminal_id') || isMissingConstraintError(error)) {
                const { data: legacyData, error: legacyError } = await supabase
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

                if (legacyError) throw legacyError;
                return legacyData;
            }

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
            const terminalId = terminalService.getTerminalId();
            if (terminalId) {
                query = query.eq('terminal_id', terminalId);
            }

            const { data, error } = await query.select().maybeSingle();
            if (isMissingColumnError(error, 'terminal_id')) {
                let legacyQuery = supabase
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
                    legacyQuery = legacyQuery.eq('session_id', paymentInfo.sessionId);
                }

                const { data: legacyData, error: legacyError } = await legacyQuery.select().maybeSingle();
                if (legacyError) throw legacyError;
                return legacyData;
            }

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
    clearCart: async (status = 'completed', sessionId = null) => {
        return safeSupabaseOperation(async () => {
            const authResult = await supabase.auth.getUser();
            const user = handleAuthError(authResult, '[activeCartService]');
            
            if (!user) return null;
            
            let query = supabase
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

            // IMPORTANTE: En multicaja, solo limpiar el carrito de la sesión actual
            if (sessionId) {
                query = query.eq('session_id', sessionId);
            } else {
                logger.warn('clearCart called without sessionId. This might clear ALL carts for this user.');
            }
            const terminalId = terminalService.getTerminalId();
            if (terminalId) {
                query = query.eq('terminal_id', terminalId);
            }
                
            const { error } = await query;

            if (isMissingColumnError(error, 'terminal_id')) {
                let legacyQuery = supabase
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

                if (sessionId) {
                    legacyQuery = legacyQuery.eq('session_id', sessionId);
                }

                const { error: legacyError } = await legacyQuery;
                if (legacyError) throw legacyError;
                return true;
            }

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
    getActiveCart: async (userId, sessionId = null, terminalId = terminalService.getTerminalId()) => {
        return safeSupabaseOperation(async () => {
            let query = supabase
                .from('active_carts')
                .select('*')
                .eq('user_id', userId);
            
            if (sessionId) {
                query = query.eq('session_id', sessionId);
            }
            if (terminalId) {
                query = query.eq('terminal_id', terminalId);
            }

            // Usamos limit(1) y single/maybeSingle para evitar errores si por alguna razón hay duplicados
            const { data, error } = await query
                .limit(1)
                .maybeSingle();

            if (isMissingColumnError(error, 'terminal_id')) {
                let legacyQuery = supabase
                    .from('active_carts')
                    .select('*')
                    .eq('user_id', userId);

                if (sessionId) {
                    legacyQuery = legacyQuery.eq('session_id', sessionId);
                }

                const { data: legacyData, error: legacyError } = await legacyQuery
                    .limit(1)
                    .maybeSingle();

                if (legacyError) throw legacyError;
                return legacyData;
            }

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
    subscribeToCart: (userId, sessionId, callback, terminalId = terminalService.getTerminalId()) => {
        console.log('Suscrito a cambios del carrito para:', { userId, sessionId, terminalId });
        
        // Supabase Realtime solo soporta UN filtro por columna en la suscripción directa.
        // Dado que session_id es único, filtramos por él si existe.
        const filter = sessionId ? `session_id=eq.${sessionId}` : `user_id=eq.${userId}`;

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
                    if (!sessionId || !terminalId || payload.new?.terminal_id === terminalId) {
                        callback(payload.new);
                    }
                }
            )
            .subscribe((status) => {
                console.log('Estado de la suscripción Realtime:', status);
            });
    }
};
