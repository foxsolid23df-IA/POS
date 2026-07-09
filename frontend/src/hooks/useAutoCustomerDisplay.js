import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { useSettings } from '../contexts/SettingsContext';
import { terminalService } from '../services/terminalService';

const AUTO_DISPLAY_KEY = 'pos_auto_customer_display';

export const useAutoCustomerDisplay = () => {
    const { user, cashSession } = useAuth();
    const { ticketSettings } = useSettings();
    const hasOpenedRef = useRef(false);

    useEffect(() => {
        if (!window.electronAPI?.isElectron) return;
        if (!user || !cashSession) return;

        // Verificar si está habilitado (Supabase o localStorage como fallback)
        const autoOpen = ticketSettings?.auto_customer_display ?? (localStorage.getItem(AUTO_DISPLAY_KEY) === 'true');
        if (!autoOpen) return;

        // Evitar abrir múltiples veces
        if (hasOpenedRef.current) return;

        const openDisplay = async () => {
            try {
                const status = await window.electronAPI.getCustomerDisplayStatus();
                if (status.isOpen) return;

                if (!status.hasSecondDisplay) {
                    console.log('[AutoCustomerDisplay] No hay segunda pantalla disponible');
                    return;
                }

                const terminalId = terminalService.getTerminalId();
                const result = await window.electronAPI.openCustomerDisplay({
                    userId: user.id,
                    sessionId: cashSession.id,
                    terminalId: terminalId || ''
                });

                if (result.ok) {
                    hasOpenedRef.current = true;
                    console.log('[AutoCustomerDisplay] Pantalla del cliente abierta automáticamente');
                }
            } catch (error) {
                console.error('[AutoCustomerDisplay] Error:', error);
            }
        };

        // Intentar abrir inmediatamente si todo está listo
        openDisplay();

        // También escuchar el evento de Electron cuando la app esté lista
        const cleanup = window.electronAPI.onAutoOpenCustomerDisplay(() => {
            openDisplay();
        });

        return () => {
            if (cleanup) cleanup();
        };
    }, [user, cashSession, ticketSettings?.auto_customer_display]);

    // Resetear el flag cuando se cierra la sesión
    useEffect(() => {
        if (!user) {
            hasOpenedRef.current = false;
        }
    }, [user]);
};
