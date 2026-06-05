// ===== ELECTRON MAIN PROCESS =====
// Este archivo inicia el backend y abre la ventana de Electron

const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const crypto = require('crypto');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let backendProcess;
let backendPort = 3001;

// Función para obtener un puerto libre asignado por el SO
function obtenerPuertoLibre() {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.unref();
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            server.close(() => {
                resolve(port);
            });
        });
    });
}

const isDev = process.env.NODE_ENV === 'development';

function generateHexSecret(bytes) {
    return crypto.randomBytes(bytes).toString('hex');
}

function ensureBackendRuntimeSecrets(userDataPath) {
    const fs = require('fs');
    const secretsPath = path.join(userDataPath, 'backend-runtime-secrets.json');
    const requiredSecrets = ['JWT_SECRET', 'MASTER_PIN'];

    let secrets = {};
    if (fs.existsSync(secretsPath)) {
        try {
            secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
        } catch (error) {
            console.warn('[Backend Env] No se pudieron leer secretos locales, se regeneraran.', error.message);
        }
    }

    let changed = false;
    if (!secrets.JWT_SECRET) {
        secrets.JWT_SECRET = generateHexSecret(64);
        changed = true;
    }
    if (!secrets.MASTER_PIN) {
        secrets.MASTER_PIN = generateHexSecret(16);
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(secretsPath, JSON.stringify(secrets, null, 2), 'utf8');
    }

    return requiredSecrets.reduce((env, key) => {
        if (!process.env[key]) env[key] = secrets[key];
        return env;
    }, {});
}

const updateState = {
    checking: false,
    downloading: false,
    downloaded: false,
    updateInfo: null,
    lastStatus: null
};

function normalizeUpdateError(error) {
    return {
        message: error?.message || 'No se pudo completar la operacion de actualizacion.',
        code: error?.code || null
    };
}

function sendUpdateStatus(type, payload = {}) {
    const status = {
        type,
        currentVersion: app.getVersion(),
        timestamp: new Date().toISOString(),
        ...payload
    };

    updateState.lastStatus = status;

    BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
            win.webContents.send('updates:status', status);
        }
    });

    return status;
}

function getUpdaterAvailability() {
    if (isDev || !app.isPackaged) {
        return {
            available: false,
            reason: 'Las actualizaciones solo estan disponibles en la aplicacion instalada.'
        };
    }

    if (process.platform !== 'win32') {
        return {
            available: false,
            reason: 'Las actualizaciones automaticas estan configuradas solo para Windows.'
        };
    }

    return { available: true };
}

function configureAutoUpdater() {
    autoUpdater.logger = log;
    autoUpdater.autoDownload = false;
    autoUpdater.allowPrerelease = false;

    log.transports.file.level = 'info';

    autoUpdater.on('checking-for-update', () => {
        updateState.checking = true;
        sendUpdateStatus('checking');
    });

    autoUpdater.on('update-available', (info) => {
        updateState.checking = false;
        updateState.downloaded = false;
        updateState.downloading = false;
        updateState.updateInfo = info;
        sendUpdateStatus('available', { updateInfo: info });
    });

    autoUpdater.on('update-not-available', (info) => {
        updateState.checking = false;
        updateState.downloaded = false;
        updateState.downloading = false;
        updateState.updateInfo = null;
        sendUpdateStatus('not-available', { updateInfo: info });
    });

    autoUpdater.on('download-progress', (progress) => {
        updateState.downloading = true;
        sendUpdateStatus('downloading', { progress });
    });

    autoUpdater.on('update-downloaded', (info) => {
        updateState.downloading = false;
        updateState.downloaded = true;
        updateState.updateInfo = info;
        sendUpdateStatus('downloaded', { updateInfo: info });
    });

    autoUpdater.on('error', (error) => {
        updateState.checking = false;
        updateState.downloading = false;
        sendUpdateStatus('error', { error: normalizeUpdateError(error) });
    });
}

configureAutoUpdater();

// Función para verificar si el servidor está listo
function esperarServidor(url, intentos = 120) {
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
    return new Promise(async (resolve, reject) => {
        console.log('🚀 Iniciando servidor backend...');

        try {
            backendPort = await obtenerPuertoLibre();
            console.log(`📌 Puerto dinámico asignado para el backend: ${backendPort}`);
        } catch (err) {
            console.error('❌ Error al obtener puerto libre, usando 3001 de fallback:', err);
            backendPort = 3001;
        }

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
        const backendRuntimeSecrets = ensureBackendRuntimeSecrets(userDataPath);
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

        // Configurar archivo de log para el backend
        const logFilePath = path.join(userDataPath, 'backend.log');
        const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
        logStream.write(`\n\n--- INICIO BACKEND: ${new Date().toISOString()} ---\n`);
        logStream.write(`Backend Path: ${backendPath}\n`);
        logStream.write(`Node Path: ${nodePath}\n`);
        logStream.write(`DB Path: ${path.join(dbDataDir, 'sistema-pos.db')}\n`);

        // Iniciar el servidor backend
        backendProcess = spawn(nodePath, ['index.js'], {
            cwd: backendPath,
            env: {
                ...process.env,
                ...backendRuntimeSecrets,
                NODE_ENV: 'production',
                DB_PATH: path.join(dbDataDir, 'sistema-pos.db'),
                HOST: '127.0.0.1',
                PORT: backendPort.toString()
            },
            stdio: 'pipe',
            windowsHide: true
        });

        let backendOutput = '';

        backendProcess.stdout.on('data', (data) => {
            const msg = data.toString();
            backendOutput += msg;
            console.log(`[Backend]: ${msg}`);
            logStream.write(`[STDOUT] ${msg}`);
        });

        backendProcess.stderr.on('data', (data) => {
            const msg = data.toString();
            backendOutput += msg;
            console.error(`[Backend Error]: ${msg}`);
            logStream.write(`[STDERR] ${msg}`);
        });

        backendProcess.on('error', (error) => {
            console.error('❌ Error al iniciar backend:', error);
            logStream.write(`[ERROR] Error al iniciar backend: ${error.stack || error.message}\n`);
            reject(error);
        });

        // Detectar si el proceso se cierra inesperadamente durante el arranque
        let resolved = false;
        backendProcess.on('exit', (code) => {
            logStream.write(`[EXIT] El backend se cerró con código ${code}\n`);
            if (!resolved && code !== 0) {
                const msg = `El backend se cerró con código ${code}.\n\nSalida:\n${backendOutput.slice(-500)}`;
                console.error(`❌ ${msg}`);
                reject(new Error(msg));
            }
        });

        // Esperar a que el servidor esté listo
        setTimeout(() => {
            esperarServidor(`http://127.0.0.1:${backendPort}/api/health`)
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
                { label: 'Restablecer zoom', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
                { label: 'Acercar (+)', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
                { label: 'Alejar (-)', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
                { type: 'separator' },
                { label: 'Alternar pantalla completa', role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Ventana',
            submenu: [
                { label: 'Minimizar', role: 'minimize' },
                { label: 'Maximizar', role: 'zoom' },
                { type: 'separator' },
                { label: 'Acercar (+)', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
                { label: 'Alejar (-)', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
                { label: 'Restablecer Zoom', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
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
                            message: `NEXUM POS v${app.getVersion()}`,
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
ipcMain.on('print-ticket', (event, htmlContent, options = {}) => {
    console.log('[Print] Recibido print-ticket via IPC');
    
    const paperWidth = options.paperWidth === '58mm' ? 58000 : 80000;
    const printerName = options.printerName || null;

    const workerWindow = new BrowserWindow({
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    workerWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    workerWindow.webContents.on('did-finish-load', () => {
        const printOptions = {
            silent: true,
            printBackground: true,
            margins: { marginType: 'none' },
            pageSize: { width: paperWidth, height: 297000 } // Altura dinámica o grande para rollos
        };

        if (printerName) {
            printOptions.deviceName = printerName;
        }

        workerWindow.webContents.print(printOptions, (success, failureReason) => {
            if (success) {
                console.log(`[Print] ✅ Ticket impreso silenciosamente (${options.paperWidth || '80mm'})`);
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

    // Timeout de seguridad
    setTimeout(() => {
        if (!workerWindow.isDestroyed()) {
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

// Obtener la URL de la API del backend dinámica
ipcMain.on('get-api-url-sync', (event) => {
    event.returnValue = `http://127.0.0.1:${backendPort}`;
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

// Manejadores de actualizacion de la app
ipcMain.handle('updates:get-current-version', async () => {
    return {
        ok: true,
        version: app.getVersion(),
        isPackaged: app.isPackaged,
        platform: process.platform,
        updaterAvailable: getUpdaterAvailability().available,
        lastStatus: updateState.lastStatus
    };
});

ipcMain.handle('updates:check', async () => {
    const availability = getUpdaterAvailability();
    if (!availability.available) {
        const status = sendUpdateStatus('disabled', { reason: availability.reason });
        return { ok: false, ...availability, currentVersion: app.getVersion(), status };
    }

    if (updateState.checking) {
        return { ok: true, checking: true, currentVersion: app.getVersion() };
    }

    try {
        updateState.checking = true;
        const result = await autoUpdater.checkForUpdates();
        return {
            ok: true,
            currentVersion: app.getVersion(),
            updateInfo: result?.updateInfo || null
        };
    } catch (error) {
        const normalized = normalizeUpdateError(error);
        sendUpdateStatus('error', { error: normalized });
        return { ok: false, error: normalized, currentVersion: app.getVersion() };
    } finally {
        updateState.checking = false;
    }
});

ipcMain.handle('updates:download', async () => {
    const availability = getUpdaterAvailability();
    if (!availability.available) {
        const status = sendUpdateStatus('disabled', { reason: availability.reason });
        return { ok: false, ...availability, currentVersion: app.getVersion(), status };
    }

    if (!updateState.updateInfo) {
        return {
            ok: false,
            error: { message: 'Primero busca una actualizacion disponible.', code: 'NO_UPDATE_INFO' },
            currentVersion: app.getVersion()
        };
    }

    if (updateState.downloading) {
        return { ok: true, downloading: true, currentVersion: app.getVersion() };
    }

    try {
        updateState.downloading = true;
        sendUpdateStatus('download-started', { updateInfo: updateState.updateInfo });
        await autoUpdater.downloadUpdate();
        return { ok: true, currentVersion: app.getVersion() };
    } catch (error) {
        const normalized = normalizeUpdateError(error);
        sendUpdateStatus('error', { error: normalized });
        return { ok: false, error: normalized, currentVersion: app.getVersion() };
    } finally {
        updateState.downloading = false;
    }
});

ipcMain.handle('updates:install', async () => {
    const availability = getUpdaterAvailability();
    if (!availability.available) {
        const status = sendUpdateStatus('disabled', { reason: availability.reason });
        return { ok: false, ...availability, currentVersion: app.getVersion(), status };
    }

    if (!updateState.downloaded) {
        return {
            ok: false,
            error: { message: 'La actualizacion todavia no se ha descargado.', code: 'UPDATE_NOT_DOWNLOADED' },
            currentVersion: app.getVersion()
        };
    }

    sendUpdateStatus('installing', { updateInfo: updateState.updateInfo });
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
    return { ok: true, currentVersion: app.getVersion() };
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
