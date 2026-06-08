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
let printWorkerWindow = null;
let printWorkerReadyPromise = null;
let printQueue = [];
let isPrintQueueRunning = false;
let nextPrintJobId = 1;
let rawPrintQueue = [];
let isRawPrintQueueRunning = false;
let rawPrintHelperProcess = null;
let rawPrintHelperReady = false;
let rawPrintHelperId = 1;
let rawPrintHelperStdout = '';
const rawPrintPending = new Map();

const PRINT_WORKER_SHELL = `data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Print Worker</title>
  </head>
  <body></body>
</html>`)}`;

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
        resetPrintWorker();
        stopRawPrintHelper();
    });

    preparePrintWorker();
}

// ═══════════════════════════════════════════════════════════
// MANEJADORES DE IMPRESIÓN PARA TICKETS (IPC)
// ═══════════════════════════════════════════════════════════

// Imprimir ticket — modo silencioso (directo a impresora por defecto)
function getPrintWorkerWindow() {
    if (printWorkerWindow && !printWorkerWindow.isDestroyed()) {
        return printWorkerWindow;
    }

    printWorkerWindow = new BrowserWindow({
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    printWorkerWindow.on('closed', () => {
        printWorkerWindow = null;
        printWorkerReadyPromise = null;
    });

    return printWorkerWindow;
}

function ensurePrintWorkerReady(worker) {
    if (worker.webContents.isDestroyed()) {
        return Promise.reject(new Error('El worker de impresion fue destruido.'));
    }

    if (!printWorkerReadyPromise) {
        const currentUrl = worker.webContents.getURL();
        printWorkerReadyPromise = currentUrl
            ? Promise.resolve()
            : worker.loadURL(PRINT_WORKER_SHELL).then(() => undefined);

        printWorkerReadyPromise = printWorkerReadyPromise.catch((error) => {
            printWorkerReadyPromise = null;
            throw error;
        });
    }

    return printWorkerReadyPromise;
}

function preparePrintWorker() {
    try {
        const worker = getPrintWorkerWindow();
        ensurePrintWorkerReady(worker).catch((error) => {
            console.warn('[Print] No se pudo precalentar el worker:', error.message);
        });
        startRawPrintHelper();
        return true;
    } catch (error) {
        console.warn('[Print] No se pudo preparar el worker:', error.message);
        return false;
    }
}

function resetPrintWorker() {
    if (printWorkerWindow && !printWorkerWindow.isDestroyed()) {
        printWorkerWindow.destroy();
    }
    printWorkerWindow = null;
    printWorkerReadyPromise = null;
}

function getRawPrintHelperScript() {
    return `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static bool SendBytesToPrinter(string printerName, byte[] bytes, string docName, out int written) {
        written = 0;
        IntPtr hPrinter = IntPtr.Zero;
        IntPtr unmanagedBytes = IntPtr.Zero;
        bool success = false;

        DOCINFOA docInfo = new DOCINFOA();
        docInfo.pDocName = docName;
        docInfo.pDataType = "RAW";

        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) return false;

        try {
            if (StartDocPrinter(hPrinter, 1, docInfo)) {
                try {
                    if (StartPagePrinter(hPrinter)) {
                        try {
                            unmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
                            Marshal.Copy(bytes, 0, unmanagedBytes, bytes.Length);
                            success = WritePrinter(hPrinter, unmanagedBytes, bytes.Length, out written);
                        } finally {
                            if (unmanagedBytes != IntPtr.Zero) Marshal.FreeCoTaskMem(unmanagedBytes);
                            EndPagePrinter(hPrinter);
                        }
                    }
                } finally {
                    EndDocPrinter(hPrinter);
                }
            }
        } finally {
            ClosePrinter(hPrinter);
        }

        return success && written == bytes.Length;
    }
}
"@

while (($line = [Console]::In.ReadLine()) -ne $null) {
    $started = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    try {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $job = $line | ConvertFrom-Json
        $printerName = [string]$job.printerName
        if ([string]::IsNullOrWhiteSpace($printerName)) {
            $printerName = (New-Object System.Drawing.Printing.PrinterSettings).PrinterName
        }
        $bytes = [Convert]::FromBase64String([string]$job.rawBase64)
        $written = 0
        $ok = [RawPrinterHelper]::SendBytesToPrinter($printerName, $bytes, "NEXUM POS Ticket", [ref]$written)
        $elapsed = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - $started
        if (-not $ok) { throw "WritePrinter fallo o escribio bytes incompletos ($written/$($bytes.Length))" }
        @{ id = $job.id; ok = $true; ms = $elapsed; printerName = $printerName; written = $written } | ConvertTo-Json -Compress
    } catch {
        $elapsed = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - $started
        @{ id = $job.id; ok = $false; ms = $elapsed; error = $_.Exception.Message } | ConvertTo-Json -Compress
    }
}
`;
}

function getPowerShellCommand() {
    return process.env.SystemRoot
        ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
        : 'powershell.exe';
}

function stopRawPrintHelper() {
    rawPrintHelperReady = false;
    rawPrintHelperStdout = '';
    rawPrintPending.forEach(({ reject, timer }) => {
        clearTimeout(timer);
        reject(new Error('El helper RAW de impresion se cerro.'));
    });
    rawPrintPending.clear();

    if (rawPrintHelperProcess && !rawPrintHelperProcess.killed) {
        rawPrintHelperProcess.kill();
    }
    rawPrintHelperProcess = null;
}

function startRawPrintHelper() {
    if (process.platform !== 'win32') {
        return false;
    }

    if (rawPrintHelperProcess && !rawPrintHelperProcess.killed) {
        return true;
    }

    const encodedScript = Buffer.from(getRawPrintHelperScript(), 'utf16le').toString('base64');
    rawPrintHelperProcess = spawn(getPowerShellCommand(), [
        '-NoLogo',
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-EncodedCommand',
        encodedScript
    ], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
    });

    rawPrintHelperReady = true;
    rawPrintHelperStdout = '';

    rawPrintHelperProcess.stdout.on('data', (chunk) => {
        rawPrintHelperStdout += chunk.toString('utf8');
        const lines = rawPrintHelperStdout.split(/\r?\n/);
        rawPrintHelperStdout = lines.pop() || '';

        lines.forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed) return;
            let response;
            try {
                response = JSON.parse(trimmed);
            } catch (error) {
                console.warn('[PrintRaw] Respuesta no JSON del helper:', trimmed);
                return;
            }

            const pending = rawPrintPending.get(response.id);
            if (!pending) return;
            clearTimeout(pending.timer);
            rawPrintPending.delete(response.id);

            if (response.ok) {
                pending.resolve(response);
            } else {
                pending.reject(new Error(response.error || 'Error RAW desconocido'));
            }
        });
    });

    rawPrintHelperProcess.stderr.on('data', (chunk) => {
        const message = chunk.toString('utf8').trim();
        if (message) console.warn('[PrintRaw helper]', message);
    });

    rawPrintHelperProcess.on('exit', (code) => {
        console.warn(`[PrintRaw] Helper cerrado con codigo ${code}`);
        stopRawPrintHelper();
    });

    rawPrintHelperProcess.on('error', (error) => {
        console.warn('[PrintRaw] No se pudo iniciar helper RAW:', error.message);
        stopRawPrintHelper();
    });

    console.log('[PrintRaw] Helper RAW preparado.');
    return true;
}

function sendRawToSpooler(rawBase64, options = {}) {
    return new Promise((resolve, reject) => {
        if (!rawBase64) {
            reject(new Error('Payload RAW vacio.'));
            return;
        }

        if (!startRawPrintHelper() || !rawPrintHelperReady || !rawPrintHelperProcess?.stdin?.writable) {
            reject(new Error('Helper RAW no disponible.'));
            return;
        }

        const id = rawPrintHelperId++;
        const timer = setTimeout(() => {
            rawPrintPending.delete(id);
            reject(new Error(`Timeout escribiendo RAW #${id}`));
        }, options.timeoutMs || 5000);

        rawPrintPending.set(id, { resolve, reject, timer });

        const payload = {
            id,
            rawBase64,
            printerName: options.printerName || ''
        };

        try {
            rawPrintHelperProcess.stdin.write(`${JSON.stringify(payload)}\n`, 'utf8');
        } catch (error) {
            clearTimeout(timer);
            rawPrintPending.delete(id);
            reject(error);
        }
    });
}

function enqueueEscposPrintJob(payload = {}, options = {}) {
    const job = {
        id: nextPrintJobId++,
        payload,
        options,
        receivedAt: Date.now()
    };

    rawPrintQueue.push(job);
    console.log(`[PrintRaw] Job #${job.id} recibido. Cola RAW: ${rawPrintQueue.length}`);
    processRawPrintQueue();
}

async function processRawPrintQueue() {
    if (isRawPrintQueueRunning) return;

    const job = rawPrintQueue.shift();
    if (!job) return;

    isRawPrintQueueRunning = true;
    const startedAt = Date.now();

    try {
        const result = await sendRawToSpooler(job.payload.rawBase64, {
            printerName: job.options.printerName || job.payload.printerName || null,
            timeoutMs: job.options.timeoutMs || 5000
        });
        const totalMs = Date.now() - startedAt;
        console.log(`[PrintRaw] Job #${job.id} enviado al spooler en ${totalMs}ms (helper ${result.ms ?? 'n/a'}ms, bytes ${result.written ?? job.payload.byteLength ?? 'n/a'})`);
    } catch (error) {
        console.warn(`[PrintRaw] Job #${job.id} fallo: ${error.message}`);
        if (job.options.fallbackHtml) {
            console.warn(`[PrintRaw] Job #${job.id} fallback HTML`);
            enqueuePrintJob(job.options.fallbackHtml, {
                paperWidth: job.options.paperWidth || job.payload.paperWidth || '58mm',
                printerName: job.options.printerName || job.payload.printerName || null
            });
        }
    } finally {
        isRawPrintQueueRunning = false;
        setImmediate(processRawPrintQueue);
    }
}

function stripRemotePrintAssets(htmlContent) {
    let removedAssets = 0;
    const html = String(htmlContent || '').replace(
        /<img\b[^>]*\bsrc\s*=\s*(["'])(https?:\/\/|blob:)[\s\S]*?\1[^>]*>/gi,
        () => {
            removedAssets += 1;
            return '';
        }
    );

    if (removedAssets > 0) {
        console.warn(`[Print] ${removedAssets} imagen(es) remota(s) omitida(s) para no bloquear la impresion.`);
    }

    return html;
}

async function renderHtmlInPrintWorker(worker, htmlContent) {
    await ensurePrintWorkerReady(worker);

    const safeHtml = stripRemotePrintAssets(htmlContent);
    return worker.webContents.executeJavaScript(`
        (() => new Promise((resolve) => {
            const startedAt = performance.now();
            const html = ${JSON.stringify(safeHtml)};
            const parsed = new DOMParser().parseFromString(html, 'text/html');
            document.head.innerHTML = parsed.head ? parsed.head.innerHTML : '';
            document.body.innerHTML = parsed.body ? parsed.body.innerHTML : html;
            document.title = parsed.title || 'Ticket';

            const finish = () => requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    resolve({
                        renderMs: Math.round(performance.now() - startedAt),
                        bodyLength: document.body ? document.body.innerText.length : 0
                    });
                });
            });

            if (document.fonts && document.fonts.ready) {
                document.fonts.ready.then(finish).catch(finish);
                return;
            }

            finish();
        }))()
    `, true);
}

function withTimeout(promise, ms, message) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
    });

    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function printFromWorker(worker, printOptions) {
    return new Promise((resolve) => {
        const sentAt = Date.now();
        worker.webContents.print(printOptions, (success, failureReason) => {
            const driverMs = Date.now() - sentAt;
            if (success) {
                resolve({ success: true, driverMs });
                return;
            }

            console.warn(`[Print] Impresion silenciosa fallo tras ${driverMs}ms: ${failureReason}`);
            console.log('[Print] Reintentando con dialogo del sistema...');

            const fallbackSentAt = Date.now();
            worker.webContents.print({
                ...printOptions,
                silent: false
            }, (fallbackSuccess, fallbackReason) => {
                const fallbackMs = Date.now() - fallbackSentAt;
                if (!fallbackSuccess) {
                    console.error(`[Print] Impresion con dialogo tambien fallo tras ${fallbackMs}ms: ${fallbackReason}`);
                    resolve({ success: false, failureReason: fallbackReason || failureReason, driverMs });
                    return;
                }
                resolve({ success: true, usedFallback: true, driverMs: driverMs + fallbackMs });
            });
        });
    });
}

function enqueuePrintJob(htmlContent, options = {}) {
    const job = {
        id: nextPrintJobId++,
        htmlContent,
        options,
        receivedAt: Date.now()
    };

    printQueue.push(job);
    console.log(`[Print] Job #${job.id} recibido por IPC. Cola: ${printQueue.length}`);
    processPrintQueue();
}

async function processPrintQueue() {
    if (isPrintQueueRunning) return;

    const job = printQueue.shift();
    if (!job) return;

    isPrintQueueRunning = true;
    const startedAt = Date.now();
    const queueWaitMs = startedAt - job.receivedAt;

    try {
        const worker = getPrintWorkerWindow();
        const paperWidth = job.options.paperWidth === '80mm' ? 80000 : 58000;
        const printerName = job.options.printerName || null;
        const printOptions = {
            silent: true,
            printBackground: true,
            margins: { marginType: 'none' },
            pageSize: { width: paperWidth, height: 297000 }
        };

        if (printerName) {
            printOptions.deviceName = printerName;
        }

        const renderStartedAt = Date.now();
        const renderInfo = await withTimeout(
            renderHtmlInPrintWorker(worker, job.htmlContent),
            2500,
            `Timeout renderizando HTML del ticket #${job.id}`
        );
        const renderMs = Date.now() - renderStartedAt;
        console.log(`[Print] Job #${job.id} render listo en ${renderMs}ms (browser ${renderInfo?.renderMs ?? 'n/a'}ms, cola ${queueWaitMs}ms)`);

        const beforePrintMs = Date.now() - startedAt;
        console.log(`[Print] Job #${job.id} enviado al driver en ${beforePrintMs}ms (${job.options.paperWidth || '58mm'})`);
        const result = await withTimeout(
            printFromWorker(worker, printOptions),
            15000,
            `Timeout imprimiendo ticket #${job.id}`
        );

        const totalMs = Date.now() - startedAt;
        if (result.success) {
            console.log(`[Print] Job #${job.id} callback terminado en ${totalMs}ms (driver ${result.driverMs ?? 'n/a'}ms)`);
        } else {
            console.warn(`[Print] Job #${job.id} termino con error en ${totalMs}ms: ${result.failureReason || 'sin detalle'}`);
        }
    } catch (error) {
        console.error(`[Print] Error en job #${job.id}:`, error.message);
    } finally {
        isPrintQueueRunning = false;
        setImmediate(processPrintQueue);
    }
}

ipcMain.handle('prepare-printer', async () => {
    return { ok: preparePrintWorker() };
});

ipcMain.on('print-ticket', (event, htmlContent, options = {}) => {
    enqueuePrintJob(htmlContent, options);
});

ipcMain.on('print-escpos-ticket', (event, payload = {}, options = {}) => {
    enqueueEscposPrintJob(payload, options);
});

ipcMain.on('print-ticket-silent', (event, htmlContent, printerName) => {
    console.log(`[Print] Impresion dirigida a: ${printerName}`);
    enqueuePrintJob(htmlContent, { printerName, paperWidth: '80mm' });
});

ipcMain.on('print-ticket-legacy', (event, htmlContent, options = {}) => {
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
ipcMain.on('print-ticket-silent-legacy', (event, htmlContent, printerName) => {
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
    stopRawPrintHelper();
    if (backendProcess) {
        backendProcess.kill();
    }
});
