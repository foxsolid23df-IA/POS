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

// Manejador para impresión de tickets
ipcMain.on('print-ticket', (event, htmlContent) => {
    if (!mainWindow) return;

    // Crear una ventana oculta para la impresión
    let workerWindow = new BrowserWindow({
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // Cargar el contenido HTML
    workerWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    workerWindow.webContents.on('did-finish-load', () => {
        // Imprimir usando el diálogo del sistema (evita el error de preview de Chrome)
        workerWindow.webContents.print({
            silent: false,
            printBackground: true,
            deviceName: '' // Usar la predeterminada
        }, (success, failureReason) => {
            if (!success) console.error('Error al imprimir:', failureReason);
            workerWindow.close();
        });
    });
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
