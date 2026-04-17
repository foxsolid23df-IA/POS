const fs = require('fs');
const path = require('path');

async function convertPngToIco(pngPath, icoPath) {
    const pngBuffer = fs.readFileSync(pngPath);
    
    // Cabecera ICO (Icon Header)
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // Reserved
    header.writeUInt16LE(1, 2); // Type 1 = Icon
    header.writeUInt16LE(1, 4); // Count = 1 layer
    
    // Icon Directory Entry
    const entry = Buffer.alloc(16);
    entry.writeUInt8(0, 0); // Width 0 means 256
    entry.writeUInt8(0, 1); // Height 0 means 256
    entry.writeUInt8(0, 2); // Color count
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(pngBuffer.length, 8); // Image size
    entry.writeUInt32LE(22, 12); // Offset to image data (6 header + 16 entry = 22)
    
    const icoBuffer = Buffer.concat([header, entry, pngBuffer]);
    fs.writeFileSync(icoPath, icoBuffer);
    console.log(`✅ Convertido ${pngPath} a ${icoPath} (${icoBuffer.length} bytes)`);
}

convertPngToIco('icon.png', 'icon.ico')
    .then(() => convertPngToIco('icon.png', 'build/icon.ico'))
    .catch(console.error);
