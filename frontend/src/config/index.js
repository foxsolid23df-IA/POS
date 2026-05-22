let dynamicApiUrl = 'http://127.0.0.1:3001';
if (window.electronAPI && window.electronAPI.getApiUrlSync) {
    try {
        dynamicApiUrl = window.electronAPI.getApiUrlSync();
    } catch (err) {
        console.error('Error al obtener la URL dinámica de la API:', err);
    }
}

export const config = {
    api: {
        // Usa la variable de entorno VITE_API_URL o la URL dinámica de Electron
        baseUrl: import.meta.env.VITE_API_URL || dynamicApiUrl
    },
    app: {
        name: import.meta.env.VITE_APP_NAME || 'Sistema ventas',
        version: import.meta.env.VITE_APP_VERSION || '1.0.0',
        billingPortalUrl: import.meta.env.VITE_BILLING_PORTAL_URL || 'http://127.0.0.1:5174'
    },
    dev: {
        mode: import.meta.env.VITE_DEV_MODE === 'true' || false
    }
}

// Helper para logs en desarrollo
export const devLog = (...args) => {
    if (config.dev.mode) {
        console.log('[DEV]', ...args)
    }
}