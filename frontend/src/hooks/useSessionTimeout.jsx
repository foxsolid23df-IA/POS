import { useEffect, useCallback, useRef } from 'react';
import { touchActivity, isSessionExpired, purgeSessionData } from '../utils/secureStorage';

/**
 * useSessionTimeout - Hook para cerrar sesion automatica por inactividad
 *
 * Detecta actividad del usuario (mousemove, keydown, click, touch)
 * y cierra la sesion automaticamente tras 15 minutos sin actividad.
 *
 * @param {Function} onTimeout - Funcion a ejecutar al expirar (ej: logout)
 * @param {number} timeoutMs - Tiempo maximo de inactividad (default: 15 min)
 */
const SESSION_EVENTS = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];

export function useSessionTimeout(onTimeout, timeoutMs = 15 * 60 * 1000) {
    const timeoutRef = useRef(null);
    const onTimeoutRef = useRef(onTimeout);
    onTimeoutRef.current = onTimeout;

    const scheduleTimeout = useCallback(() => {
        // Registrar actividad
        touchActivity();

        // Limpiar timer anterior
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Programar nuevo timer
        timeoutRef.current = setTimeout(() => {
            if (isSessionExpired(timeoutMs)) {
                console.warn('[SessionTimeout] Sesion expirada por inactividad');
                onTimeoutRef.current?.();
            }
        }, timeoutMs);
    }, [timeoutMs]);

    useEffect(() => {
        // Verificar si ya esta expirado al montar
        if (isSessionExpired(timeoutMs)) {
            console.warn('[SessionTimeout] Sesion ya expirada al iniciar');
            onTimeout();
            return;
        }

        // Iniciar monitoreo
        scheduleTimeout();

        // Registrar listeners de actividad
        const handleActivity = () => scheduleTimeout();
        SESSION_EVENTS.forEach(event => {
            window.addEventListener(event, handleActivity, { passive: true });
        });

        // Cleanup
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            SESSION_EVENTS.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });
        };
    }, [scheduleTimeout, onTimeout, timeoutMs]);
}

/**
 * useActivityTracker - Hook liviano que solo registra actividad
 * (sin cerrar sesion automaticamente)
 */
export function useActivityTracker() {
    useEffect(() => {
        touchActivity();

        const handleActivity = () => touchActivity();
        SESSION_EVENTS.forEach(event => {
            window.addEventListener(event, handleActivity, { passive: true });
        });

        return () => {
            SESSION_EVENTS.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });
        };
    }, []);
}
