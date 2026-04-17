const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Imprimir HTML del ticket directamente
    print: (html) => ipcRenderer.send('print-ticket', html),
    
    // Imprimir silenciosamente a impresora específica
    printSilent: (html, printerName) => ipcRenderer.send('print-ticket-silent', html, printerName),
    
    // Obtener lista de impresoras del sistema
    getPrinters: () => ipcRenderer.invoke('get-printers'),
    
    // Obtener Hardware ID de la máquina actual
    getMachineId: () => ipcRenderer.invoke('get-machine-id'),
    
    // Flag para detectar que estamos en Electron
    isElectron: true
});
