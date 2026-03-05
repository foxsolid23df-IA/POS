// ===== ELECTRON MAIN PROCESS =====
// Este archivo inicia el backend y abre la ventana de Electron

const { app, BrowserWindow, Menu } = require('electron');
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

        // Iniciar el servidor backend
        backendProcess = spawn('node', ['index.js'], {
            cwd: backendPath,
            env: { ...process.env, NODE_ENV: 'production' },
            stdio: 'inherit'
        });

        backendProcess.on('error', (error) => {
            console.error('❌ Error al iniciar backend:', error);
            reject(error);
        });

        // Esperar a que el servidor esté listo
        setTimeout(() => {
            esperarServidor(`http://localhost:${PORT}/api/products`)
                .then(resolve)
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
            webSecurity: true
        },
        icon: path.join(__dirname, 'icon.ico'),
        autoHideMenuBar: !isDev, // Muestra el menú en desarrollo, lo oculta en producción (Alt para ver)
        title: 'Sistema de Ventas'
    });

    // Cargar el frontend
    const frontendUrl = isDev
        ? 'http://localhost:5173' // URL de desarrollo de Vite
        : `file://${path.join(__dirname, 'dist', 'index.html')}`; // Archivos estáticos en producción

    mainWindow.loadURL(frontendUrl);

    // Configurar Menú de la Aplicación para permitir Recarga y Consola
    const template = [
        {
            label: 'Sistema',
            submenu: [
                { label: 'Recargar App', accelerator: 'F5', click: () => { mainWindow.reload(); } },
                { label: 'Forzar Recarga', accelerator: 'CmdOrCtrl+Shift+R', click: () => { mainWindow.webContents.reloadIgnoringCache(); } },
                { type: 'separator' },
                {
                    label: 'Ver Consola (Modo Soporte)',
                    accelerator: 'F12',
                    click: () => { mainWindow.webContents.toggleDevTools(); }
                },
                {
                    label: 'Consola (Alternativo)',
                    accelerator: 'CmdOrCtrl+Shift+I',
                    click: () => { mainWindow.webContents.toggleDevTools(); }
                },
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
                { label: 'Seleccionar todo', role: 'selectAll' }
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
