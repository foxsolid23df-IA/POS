// ===== SERVIDOR BACKEND PRINCIPAL =====
// Este archivo inicia el servidor Express, importa modelos y rutas, y deja todo listo para funcionar en cualquier PC.

// Cargar variables de entorno desde .env
require('dotenv').config();

// ===== VALIDACIÓN DE SECRETOS CRÍTICOS =====
// Estos secretos son obligatorios para la seguridad de la aplicación
const requiredSecrets = ['JWT_SECRET', 'MASTER_PIN'];
const missingSecrets = requiredSecrets.filter(secret => !process.env[secret]);

if (missingSecrets.length > 0) {
    const isProduction = process.env.NODE_ENV === 'production';
    const errorMsg = `
╔═══════════════════════════════════════════════════════════╗
║  ERROR: Faltan variables de entorno obligatorias          ║
╠═══════════════════════════════════════════════════════════╣
║  Variables faltantes: ${missingSecrets.join(', ')}
║                                                           ║
║  Para generar secretos seguros, ejecuta:                  ║
║    node scripts/generate-secrets.js                       ║
║                                                           ║
║  Luego copia los valores generados a backend/.env         ║
╚═══════════════════════════════════════════════════════════╝
`;
    if (isProduction) {
        console.error(errorMsg);
        process.exit(1);
    }
    console.warn('⚠️  ADVERTENCIA: Usando secretos por defecto (INSEGURO)');
    console.warn('   Ejecuta: node scripts/generate-secrets.js');
    // Fallback solo en desarrollo para no romper el flujo local
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_do_not_use_in_production';
    process.env.MASTER_PIN = process.env.MASTER_PIN || 'dev_pin_do_not_use';
}

const express = require('express');
const cors = require('cors');
const sequelize = require('./db/conexion');

// Importar modelos para que Sequelize los registre antes de sync
require('./models/Product');
require('./models/Sale');
const User = require('./models/User');
require('./models/SystemLog');
require('./models/Terminal'); // <--- Registro de terminales

// Crear la app de Express
const app = express();

// ── Configuración segura de CORS ──────────────────────────────
/**
 * Parsea FRONTEND_URL en un array de orígenes válidos.
 * Soporta múltiples dominios separados por coma.
 * Valida que cada URL comience con http:// o https://
 * Rechaza wildcards (*) en producción.
 */
function parseAllowedOrigins() {
    const raw = process.env.FRONTEND_URL;
    const isProduction = process.env.NODE_ENV === 'production';

    // Valores por defecto según entorno
    const defaultOrigins = isProduction
        ? [] // En producción NO hay defaults — se deben configurar explícitamente
        : ['http://localhost:5173', 'http://localhost:3001', 'http://localhost:3000'];

    if (!raw) return defaultOrigins;

    const origins = raw.split(',').map(u => u.trim()).filter(Boolean);
    const validOrigins = [];
    const invalidOrigins = [];

    for (const origin of origins) {
        // Rechazar wildcard explícitamente
        if (origin === '*') {
            invalidOrigins.push(origin);
            console.error('❌ CORS: wildcard (*) no está permitido en FRONTEND_URL');
            continue;
        }
        // Validar formato de URL
        try {
            const url = new URL(origin);
            if (url.protocol === 'http:' || url.protocol === 'https:') {
                validOrigins.push(origin);
            } else {
                invalidOrigins.push(origin);
            }
        } catch {
            invalidOrigins.push(origin);
        }
    }

    if (invalidOrigins.length > 0) {
        console.warn(`⚠️  CORS: orígenes rechazados por formato inválido: ${invalidOrigins.join(', ')}`);
    }

    // En producción, si no hay orígenes válidos, es un error crítico
    if (isProduction && validOrigins.length === 0) {
        console.error('╔═══════════════════════════════════════════════════════════╗');
        console.error('║  ERROR: No hay orígenes CORS válidos configurados         ║');
        console.error('║  Configura FRONTEND_URL en .env con URLs válidas          ║');
        console.error('║  Ejemplo: https://miapp.com,https://staging.miapp.com     ║');
        console.error('╚═══════════════════════════════════════════════════════════╝');
        if (isProduction) {
            process.exit(1);
        }
    }

    // En desarrollo, mezclar con defaults de localhost
    const finalOrigins = isProduction ? validOrigins : [...new Set([...validOrigins, ...defaultOrigins])];
    return finalOrigins;
}

const allowedOrigins = parseAllowedOrigins();

const corsOptions = {
    origin: function (origin, callback) {
        // Permitir requests sin Origin (apps móviles, curl, Postman, Electron)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        callback(new Error(`Origen no permitido por CORS: ${origin}`));
    },
    credentials: true,
    optionsSuccessStatus: 200
};

// Misma configuración segura para todos los entornos
app.use(cors(corsOptions));

// ── Content Security Policy (CSP) Headers ─────────────────────
// Protege contra XSS al restringir fuentes de contenido ejecutable
app.use((req, res, next) => {
    // Política estricta: solo permitir recursos del mismo origen
    // y fuentes conocidas (Supabase para auth)
    res.setHeader(
        'Content-Security-Policy',
        [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co https://*.supabase.in",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "img-src 'self' data: blob: https://*.supabase.co",
            "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co wss://*.supabase.in",
            "font-src 'self' https://fonts.gstatic.com",
            "frame-src 'none'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'"
        ].join('; ')
    );
    // Headers de seguridad adicionales
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0'); // Deshabilitado porque CSP ya protege
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
});

app.use(express.json({ limit: '50mb' }));

// ── Sanitización global de entradas ────────────────────────────
// Limpia XSS en body, query y params antes de que lleguen a las rutas
const { sanitizeInputs } = require('./middleware/sanitizeInputs');
app.use(sanitizeInputs);

// Importar y usar rutas
const productRoutes = require('./routes/productRoutes');
const saleRoutes = require('./routes/saleRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes'); // <--- Nueva ruta

app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes); // <--- Nueva ruta

// ── Middleware global de manejo de errores ─────────────────────
// DEBE ir después de todas las rutas
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// Puerto y host configurables por variable de entorno
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
    try {
        await sequelize.sync({ alter: true }); // Sincroniza modelos con la base de datos (altera tablas si es necesario)

        // Crear administrador inicial si no existe
        const adminExists = await User.findOne({ where: { profile: 'admin' } });
        if (!adminExists) {
            // Genera un PIN numérico aleatorio de 6 dígitos
            const randomPin = String(Math.floor(100000 + Math.random() * 900000));
            console.log('🌱 Creando administrador inicial con PIN aleatorio...');
            await User.create({
                name: 'Administrador',
                profile: 'admin',
                pin: randomPin
            });
            console.log('');
            console.log('╔═══════════════════════════════════════════════════════════╗');
            console.log('║  ⚠️  ADMINISTRADOR INICIAL CREADO                        ║');
            console.log('╠═══════════════════════════════════════════════════════════╣');
            console.log(`║  PIN de acceso: ${randomPin}                                    ║`);
            console.log('║  CAMBIA este PIN inmediatamente desde el panel de admin   ║');
            console.log('╚═══════════════════════════════════════════════════════════╝');
            console.log('');
        }

        // Iniciar servidor
        app.listen(PORT, () => {
            console.log(`✅ Backend escuchando en http://${HOST}:${PORT}`);
        });
    } catch (err) {
        console.error('❌ Error al sincronizar la base de datos:', err.message);
        process.exit(1);
    }
}

startServer();