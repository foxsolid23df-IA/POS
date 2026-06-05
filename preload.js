const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Imprimir HTML del ticket directamente
    print: (html, options) => ipcRenderer.send('print-ticket', html, options),
    
    // Imprimir silenciosamente a impresora específica
    printSilent: (html, printerName) => ipcRenderer.send('print-ticket-silent', html, printerName),
    
    // Obtener lista de impresoras del sistema
    getPrinters: () => ipcRenderer.invoke('get-printers'),
    
    // Obtener Hardware ID de la máquina actual
    getMachineId: () => ipcRenderer.invoke('get-machine-id'),
    
    // Obtener la URL de la API del backend dinámica
    getApiUrlSync: () => ipcRenderer.sendSync('get-api-url-sync'),

    // Actualizaciones de la app instalada
    getVersion: () => ipcRenderer.invoke('updates:get-current-version'),
    checkForUpdates: () => ipcRenderer.invoke('updates:check'),
    downloadUpdate: () => ipcRenderer.invoke('updates:download'),
    installUpdate: () => ipcRenderer.invoke('updates:install'),
    onUpdateStatus: (callback) => {
        if (typeof callback !== 'function') return () => {};

        const listener = (_event, status) => callback(status);
        ipcRenderer.on('updates:status', listener);

        return () => {
            ipcRenderer.removeListener('updates:status', listener);
        };
    },

    // Flag para detectar que estamos en Electron
    isElectron: true
});
