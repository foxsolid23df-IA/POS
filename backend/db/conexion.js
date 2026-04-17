// Importa la clase Sequelize para manejar la conexión y los modelos
const { Sequelize } = require('sequelize');
// Importa path para construir rutas de archivos de forma segura
const path = require('path');

// Configuración con SQLite
// En producción (Electron), DB_PATH apunta a AppData (escribible)
// En desarrollo, usa la carpeta local backend/data/
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'sistema-pos.db');

console.log(`📁 Ruta de base de datos: ${dbPath}`);

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: false
});

// Exporta la instancia para usarla en modelos y servicios
module.exports = sequelize;