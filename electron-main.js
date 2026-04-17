// ===== ELECTRON MAIN PROCESS =====
// Este archivo inicia el backend y abre la ventana de Electron

const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let backendProcess;

const PORT = 3001;
const isDev = process.env.NODE_ENV === 'development';

// Función para verificar si el servidor está listo
function esperarServidor(url, intentos = 30) {
    return new Promise((resolve, reject) => {
        const verificar = (intento) => {
            if (intento >= intentos) {
                reject(new Error('Timeout esperando al servidor'));
                return;
            }

            http.get(url, (res) => {
                if (res.statusCode === 200) {
                    console.log('✅ Servidor backend listo');
                    resolve();
                } else {
                    setTimeout(() => verificar(intento + 1), 500);
                }
            }).on('error', () => {
                setTimeout(() => verificar(intento + 1), 500);
            });
        };
        verificar(0);
    });
}

// Función para iniciar el servidor backend
function iniciarBackend() {
    return new Promise((resolve, reject) => {
        console.log('🚀 Iniciando servidor backend...');

        const backendPath = isDev
            ? path.join(__dirname, 'backend')
            : path.join(process.resourcesPath, 'app', 'backend');

        console.log(`📂 Backend path: ${backendPath}`);

        // Verificar que el directorio del backend existe
        const fs = require('fs');
        if (!fs.existsSync(backendPath)) {
            const msg = `No se encontró la carpeta del backend en: ${backendPath}`;
            console.error(`❌ ${msg}`);
            reject(new Error(msg));
            return;
        }

        if (!fs.existsSync(path.join(backendPath, 'index.js'))) {
            const msg = `No se encontró index.js en: ${backendPath}`;
            console.error(`❌ ${msg}`);
            reject(new Error(msg));
            return;
        }

        // Determinar ruta escribible para la base de datos
        // En producción, Program Files es de solo lectura,
        // así que usamos AppData del usuario
        const userDataPath = app.getPath('userData');
        const dbDataDir = isDev
            ? path.join(__dirname, 'backend', 'data')
            : path.join(userDataPath, 'data');

        // Asegurar que la carpeta de datos existe
        if (!fs.existsSync(dbDataDir)) {
            fs.mkdirSync(dbDataDir, { recursive: true });
            console.log(`📂 Carpeta de datos creada: ${dbDataDir}`);
        }

        console.log(`💾 Base de datos en: ${dbDataDir}`);

        // Determinar ruta de Node.js
        // En producción usamos el node.exe bundleado, en desarrollo usamos el del sistema
        const nodePath = isDev
            ? 'node'
            : path.join(process.resourcesPath, 'bin', 'node.exe');

        console.log(`🔧 Node.js path: ${nodePath}`);

        // Verificar que node.exe existe en producción
        if (!isDev && !fs.existsSync(nodePath)) {
            const msg = `No se encontró node.exe en: ${nodePath}`;
            console.error(`❌ ${msg}`);
            reject(new Error(msg));
            return;
        }

        // Iniciar el servidor backend
        backendProcess = spawn(nodePath, ['index.js'], {
            cwd: backendPath,
            env: {
                ...process.env,
                NODE_ENV: 'production',
                DB_PATH: path.join(dbDataDir, 'sistema-pos.db')
            },
            stdio: 'pipe',
            windowsHide: true
        });

        let backendOutput = '';

        backendProcess.stdout.on('data', (data) => {
            const msg = data.toString();
            backendOutput += msg;
            console.log(`[Backend]: ${msg}`);
        });

        backendProcess.stderr.on('data', (data) => {
            const msg = data.toString();
            backendOutput += msg;
            console.error(`[Backend Error]: ${msg}`);
        });

        backendProcess.on('error', (error) => {
            console.error('❌ Error al iniciar backend:', error);
            reject(error);
        });

        // Detectar si el proceso se cierra inesperadamente durante el arranque
        let resolved = false;
        backendProcess.on('exit', (code) => {
            if (!resolved && code !== 0) {
                const msg = `El backend se cerró con código ${code}.\n\nSalida:\n${backendOutput.slice(-500)}`;
                console.error(`❌ ${msg}`);
                reject(new Error(msg));
            }
        });

        // Esperar a que el servidor esté listo
        setTimeout(() => {
            esperarServidor(`http://localhost:${PORT}/api/products`)
                .then(() => {
                    resolved = true;
                    resolve();
                })
                .catch(reject);
        }, 2000);
    });
}

// Función para crear la ventana principal
function crearVentana() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'icon.ico'),
        autoHideMenuBar: false, // Menú siempre visible para facilitar la navegación
        title: 'NEXUM POS'
    });

    // Cargar el frontend
    const frontendUrl = isDev
        ? 'http://localhost:5173' // URL de desarrollo de Vite
        : `file://${path.join(__dirname, 'frontend', 'dist', 'index.html')}`; // Archivos estáticos en producción

    mainWindow.loadURL(frontendUrl);

    // Configurar Menú de la Aplicación Estándar
    const template = [
        {
            label: 'Archivo',
            submenu: [
                { label: 'Nueva Ventana', click: () => { crearVentana(); } },
                { type: 'separator' },
                { label: 'Configuración...', accelerator: 'CmdOrCtrl+,', click: () => { mainWindow.webContents.send('navigate-to', '/config'); } },
                { type: 'separator' },
                { label: 'Salir', role: 'quit' }
            ]
        },
        {
            label: 'Editar',
            submenu: [
                { label: 'Deshacer', role: 'undo' },
                { label: 'Rehacer', role: 'redo' },
                { type: 'separator' },
                { label: 'Cortar', role: 'cut' },
                { label: 'Copiar', role: 'copy' },
                { label: 'Pegar', role: 'paste' },
                { label: 'Pegar con el mismo estilo', role: 'pasteAndMatchStyle' },
                { label: 'Eliminar', role: 'delete' },
                { label: 'Seleccionar todo', role: 'selectAll' }
            ]
        },
        {
            label: 'Ver',
            submenu: [
                { label: 'Recargar', role: 'reload' },
                { label: 'Forzar recarga', role: 'forceReload' },
                { label: 'Alternar herramientas de desarrollador', role: 'toggleDevTools' },
                { type: 'separator' },
                { label: 'Restablecer zoom', role: 'resetZoom' },
                { label: 'Acercar', role: 'zoomIn' },
                { label: 'Alejar', role: 'zoomOut' },
                { type: 'separator' },
                { label: 'Alternar pantalla completa', role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Ventana',
            submenu: [
                { label: 'Minimizar', role: 'minimize' },
                { label: 'Zoom', role: 'zoom' },
                { type: 'separator' },
                { label: 'Cerrar', role: 'close' }
            ]
        },
        {
            label: 'Ayuda',
            submenu: [
                {
                    label: 'Documentación Online',
                    click: async () => {
                        const { shell } = require('electron');
                        await shell.openExternal('https://github.com/nexumpos/docs');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Acerca de NEXUM POS',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'Acerca de NEXUM POS',
                            message: 'NEXUM POS v1.1.2',
                            detail: 'Sistema punto de venta profesional.\nTodos los derechos reservados © 2026',
                            buttons: ['Aceptar']
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    // Abrir DevTools automáticamente solo en modo desarrollo
    if (isDev) {
        // En desarrollo siempre abierto por defecto
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ═══════════════════════════════════════════════════════════
// MANEJADORES DE IMPRESIÓN PARA TICKETS (IPC)
// ═══════════════════════════════════════════════════════════

// Imprimir ticket — modo silencioso (directo a impresora por defecto)
ipcMain.on('print-ticket', (event, htmlContent) => {
    console.log('[Print] Recibido print-ticket via IPC');

    const workerWindow = new BrowserWindow({
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    workerWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    workerWindow.webContents.on('did-finish-load', () => {
        // Obtener la lista de impresoras para log
        const printers = workerWindow.webContents.getPrintersAsync
            ? null // handled below
            : workerWindow.webContents.getPrinters?.() || [];

        if (printers && printers.length > 0) {
            const defaultPrinter = printers.find(p => p.isDefault);
            console.log(`[Print] Impresora por defecto: ${defaultPrinter?.name || 'ninguna'}`);
            console.log(`[Print] Total impresoras: ${printers.length}`);
        }

        // Primero intentar SILENCIOSO (directo a impresora por defecto)
        workerWindow.webContents.print({
            silent: true,
            printBackground: true,
            margins: { marginType: 'none' },
            pageSize: { width: 80000, height: 297000 } // 80mm x ~infinito en micrones
        }, (success, failureReason) => {
            if (success) {
                console.log('[Print] ✅ Ticket impreso silenciosamente');
            } else {
                console.warn(`[Print] ⚠️ Impresión silenciosa falló: ${failureReason}`);
                console.log('[Print] Reintentando con diálogo del sistema...');

                // Fallback: abrir diálogo del sistema
                workerWindow.webContents.print({
                    silent: false,
                    printBackground: true
                }, (success2, reason2) => {
                    if (!success2) {
                        console.error(`[Print] ❌ Impresión con diálogo también falló: ${reason2}`);
                    }
                    workerWindow.close();
                });
                return; // No cerrar aún, esperar al fallback
            }
            workerWindow.close();
        });
    });

    // Timeout de seguridad para no dejar ventanas zombies
    setTimeout(() => {
        if (!workerWindow.isDestroyed()) {
            console.warn('[Print] ⚠️ Timeout — cerrando ventana de impresión');
            workerWindow.close();
        }
    }, 15000);
});

// Imprimir a impresora específica por nombre
ipcMain.on('print-ticket-silent', (event, htmlContent, printerName) => {
    console.log(`[Print] Impresión dirigida a: ${printerName}`);

    const workerWindow = new BrowserWindow({
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    workerWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    workerWindow.webContents.on('did-finish-load', () => {
        workerWindow.webContents.print({
            silent: true,
            printBackground: true,
            deviceName: printerName,
            margins: { marginType: 'none' },
            pageSize: { width: 80000, height: 297000 }
        }, (success, failureReason) => {
            if (!success) console.error(`[Print] ❌ Error: ${failureReason}`);
            else console.log(`[Print] ✅ Impreso en ${printerName}`);
            workerWindow.close();
        });
    });
});

// Listar impresoras del sistema
ipcMain.handle('get-printers', async (event) => {
    try {
        // Electron 39+ usa getPrintersAsync
        if (mainWindow && mainWindow.webContents.getPrintersAsync) {
            return await mainWindow.webContents.getPrintersAsync();
        }
        // Fallback para versiones anteriores
        if (mainWindow && mainWindow.webContents.getPrinters) {
            return mainWindow.webContents.getPrinters();
        }
        return [];
    } catch (err) {
        console.error('[Print] Error listando impresoras:', err);
        return [];
    }
});

// Obtener ID único de la máquina (Hardware ID)
ipcMain.handle('get-machine-id', async () => {
    try {
        const { machineId } = require('node-machine-id');
        const id = await machineId();
        return id;
    } catch (err) {
        console.error('[MachineID] Error obteniendo Machine ID:', err);
        return null;
    }
});

// Cuando Electron esté listo
app.whenReady().then(async () => {
    try {
        // Iniciar el backend
        await iniciarBackend();

        // Crear la ventana
        crearVentana();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                crearVentana();
            }
        });
    } catch (error) {
        console.error('❌ Error al iniciar la aplicación:', error);
        dialog.showErrorBox(
            'NEXUM POS - Error al iniciar',
            `No se pudo iniciar la aplicación.\n\n${error.message}\n\nSi el problema persiste, contacta a soporte técnico.`
        );
        app.quit();
    }
});

// Cerrar la aplicación cuando todas las ventanas estén cerradas
app.on('window-all-closed', () => {
    // Detener el servidor backend
    if (backendProcess) {
        console.log('🛑 Deteniendo servidor backend...');
        backendProcess.kill();
    }

    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Asegurarse de cerrar el backend cuando la app se cierre
app.on('quit', () => {
    if (backendProcess) {
        backendProcess.kill();
    }
});
