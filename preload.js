const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    print: (html) => ipcRenderer.send('print-ticket', html),
    isElectron: true
});
