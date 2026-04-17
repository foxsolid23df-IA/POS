// Script para crear un ICO válido desde icon.png
const fs = require('fs');
const path = require('path');

const pngPath = path.join(__dirname, '..', 'icon.png');
const icoPath = path.join(__dirname, '..', 'icon.ico');

// Verificar que icon.png existe
if (!fs.existsSync(pngPath)) {
    console.error('ERROR: icon.png no encontrado');
    process.exit(1);
}

async function main() {
    const mod = await import('png-to-ico');
    const pngToIco = mod.default || mod;
    
    console.log('Convirtiendo icon.png -> icon.ico...');
    console.log('Tipo de módulo:', typeof pngToIco);
    
    const buf = await pngToIco(pngPath);
    
    // Backup del ICO anterior
    if (fs.existsSync(icoPath)) {
        fs.copyFileSync(icoPath, icoPath + '.bak');
        console.log('Backup del ICO anterior: icon.ico.bak');
    }
    
    fs.writeFileSync(icoPath, buf);
    
    // Verificar resultado
    const result = fs.readFileSync(icoPath);
    const type = result.readUInt16LE(2);
    const count = result.readUInt16LE(4);
    console.log(`ICO creado: ${result.length} bytes, tipo: ${type}, imágenes: ${count}`);
    
    if (type === 1 && count > 0) {
        console.log('✅ ICO válido generado exitosamente');
    } else {
        console.error('❌ El ICO generado parece inválido');
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
