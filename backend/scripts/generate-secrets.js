/**
 * Script para generar secretos criptográficamente seguros
 * Uso: node scripts/generate-secrets.js
 * 
 * Este script genera valores seguros para JWT_SECRET y MASTER_PIN
 * usando crypto.randomBytes() y los muestra listos para copiar al .env
 */

const crypto = require('crypto');

function generateSecret(bytes = 64) {
    return crypto.randomBytes(bytes).toString('hex');
}

function generatePin(length = 12) {
    return crypto.randomBytes(length).toString('hex');
}

const jwtSecret = generateSecret(64);
const masterPin = generatePin(16);

console.log('═══════════════════════════════════════════════════════');
console.log('  SECRETOS GENERADOS - COPIAR AL ARCHIVO .env');
console.log('═══════════════════════════════════════════════════════');
console.log('');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`MASTER_PIN=${masterPin}`);
console.log('');
console.log('═══════════════════════════════════════════════════════');
console.log('  INSTRUCCIONES:');
console.log('═══════════════════════════════════════════════════════');
console.log('  1. Copia las líneas de arriba a tu archivo backend/.env');
console.log('  2. NUNCA compartas ni hagas commit de estos valores');
console.log('  3. Si usas Git, verifica que .env está en .gitignore');
console.log('  4. Reinicia el servidor después de actualizar .env');
console.log('═══════════════════════════════════════════════════════');
