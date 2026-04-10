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

// Configurar CORS para producción
const corsOptions = {
    origin: process.env.FRONTEND_URL || ['http://localhost:5173', 'http://localhost:3001'],
    credentials: true,
    optionsSuccessStatus: 200
};

// En modo Electron, permitir todas las conexiones locales
if (process.env.NODE_ENV === 'production') {
    app.use(cors());
} else {
    app.use(cors(corsOptions));
}
app.use(express.json({ limit: '50mb' }));

// Importar y usar rutas
const productRoutes = require('./routes/productRoutes');
const saleRoutes = require('./routes/saleRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes'); // <--- Nueva ruta

app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes); // <--- Nueva ruta

// Puerto y host configurables por variable de entorno
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
    try {
        await sequelize.sync({ alter: true }); // Sincroniza modelos con la base de datos (altera tablas si es necesario)

        // Crear administrador inicial si no existe
        const adminExists = await User.findOne({ where: { profile: 'admin' } });
        if (!adminExists) {
            console.log('🌱 Creando administrador inicial...');
            await User.create({
                name: 'Administrador',
                profile: 'admin',
                pin: '1234'
            });
            console.log('✅ Administrador creado con PIN: 1234');
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