/**
 * SecureStorage - Wrapper con integridad y timeout de sesion
 *
 * Estrategia: localStorage con HMAC de integridad + session timeout
 *
 * Por que no cookies HttpOnly?
 * - Supabase ya gestiona sesiones internamente con su propio mecanismo
 * - Este POS corre principalmente en Electron (contexto controlado)
 * - Los datos en localStorage NO son credenciales (son estado UI)
 * - Supabase maneja sus propios tokens de forma segura
 *
 * Protecciones:
 * 1. HMAC-SHA256 para detectar manipulacion de datos
 * 2. Timeout automatico por inactividad (15 min configurable)
 * 3. Limpieza automatica al detectar corrupcion
 * 4. Uso de sessionStorage para datos temporales criticos
 */

import React from 'react';

// Semilla de integridad derivada del entorno
function _getIntegritySeed() {
    return `${window.location.hostname || 'localhost'}_${navigator.userAgent.slice(0, 50)}`;
}

/**
 * Genera un hash de integridad simple usando SubtleCrypto (Web Crypto API)
 */
async function _computeHMAC(message) {
    const seed = _getIntegritySeed();
    const encoder = new TextEncoder();
    const keyData = encoder.encode(seed + '__pos_integrity');
    const msgData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
        'raw', keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false, ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Almacena un dato con proteccion de integridad
 * @param {string} key
 * @param {*} value
 * @param {'local'|'session'} type
 */
export async function secureSet(key, value, type = 'local') {
    try {
        const serialized = JSON.stringify(value);
        const hmac = await _computeHMAC(serialized);
        const record = JSON.stringify({
            d: serialized,   // data (comprimido)
            h: hmac,         // hmac signature
            t: Date.now()    // timestamp
        });
        const storage = type === 'session' ? sessionStorage : localStorage;
        storage.setItem(key, record);
    } catch (err) {
        console.error('[SecureStorage] Error guardando', key, err);
    }
}

/**
 * Recupera un dato verificando integridad y edad
 * @param {string} key
 * @param {number} maxAgeMs - 0 = sin limite
 * @param {'local'|'session'} type
 * @returns {*|null}
 */
export async function secureGet(key, maxAgeMs = 0, type = 'local') {
    try {
        const storage = type === 'session' ? sessionStorage : localStorage;
        const raw = storage.getItem(key);
        if (!raw) return null;

        const record = JSON.parse(raw);
        if (!record.d || !record.h) {
            // Formato legacy (sin proteccion), limpiar
            storage.removeItem(key);
            return null;
        }

        // Verificar integridad
        const expected = await _computeHMAC(record.d);
        if (expected !== record.h) {
            console.warn('[SecureStorage] Integridad fallida para', key, '- datos manipulados');
            storage.removeItem(key);
            return null;
        }

        // Verificar expiracion
        if (maxAgeMs > 0 && (Date.now() - record.t) > maxAgeMs) {
            storage.removeItem(key);
            return null;
        }

        return JSON.parse(record.d);
    } catch (err) {
        // Corrupcion total - limpiar
        try {
            const storage = type === 'session' ? sessionStorage : localStorage;
            storage.removeItem(key);
        } catch (_) { /* noop */ }
        return null;
    }
}

/**
 * Elimina un dato
 */
export function secureRemove(key, type = 'local') {
    const storage = type === 'session' ? sessionStorage : localStorage;
    storage.removeItem(key);
}

/**
 * Registra actividad del usuario (para timeout de sesion)
 */
export function touchActivity() {
    try {
        localStorage.setItem('_lastActivity', String(Date.now()));
    } catch (_) { /* noop */ }
}

/**
 * Verifica si la sesion expiro por inactividad
 * @param {number} timeoutMs - Default 15 minutos
 * @returns {boolean}
 */
export function isSessionExpired(timeoutMs = 15 * 60 * 1000) {
    try {
        const last = localStorage.getItem('_lastActivity');
        if (!last) return false; // Sin registro = no aplicar timeout
        return (Date.now() - parseInt(last, 10)) > timeoutMs;
    } catch {
        return false;
    }
}

/**
 * Limpia todos los datos de sesion del POS
 */
export function purgeSessionData() {
    const keys = [
        'activeStaff', '_lastActivity',
        'terminal_id', 'terminal_name', 'is_main_terminal',
        'pos_terminal_id', 'pos_terminal_name', 'pos_is_main_terminal',
        'scanner_mode', 'theme', 'customCategories'
    ];
    keys.forEach(key => {
        try {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
        } catch (_) { /* noop */ }
    });
}

/**
 * Hook para timeout automatico de sesion por inactividad
 * @param {Function} onTimeout - Callback a ejecutar cuando expire la sesion
 * @param {number} timeoutMs - Tiempo de timeout en ms (default 15 minutos)
 */
export function useSessionTimeout(onTimeout, timeoutMs = 15 * 60 * 1000) {
    React.useEffect(() => {
        let timeoutId = null;
        let intervalId = null;

        const resetTimer = () => {
            touchActivity();
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            timeoutId = setTimeout(() => {
                if (isSessionExpired(timeoutMs)) {
                    onTimeout();
                }
            }, timeoutMs);
        };

        // Verificar cada minuto si la sesion expiro
        intervalId = setInterval(() => {
            if (isSessionExpired(timeoutMs)) {
                onTimeout();
            }
        }, 60 * 1000);

        // Escuchar eventos de actividad del usuario
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
        events.forEach(event => {
            window.addEventListener(event, resetTimer, { passive: true });
        });

        // Iniciar timer
        resetTimer();

        // Cleanup
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            if (intervalId) clearInterval(intervalId);
            events.forEach(event => {
                window.removeEventListener(event, resetTimer);
            });
        };
    }, [onTimeout, timeoutMs]);
}
