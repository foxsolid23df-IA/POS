/**
 * Script para generar TODOS los iconos Android desde assets/icon.png
 * Genera: ic_launcher.png, ic_launcher_round.png, ic_launcher_foreground.png
 * En todas las densidades: ldpi, mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi
 */
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const SOURCE = join(process.cwd(), 'assets', 'icon.png');
const ANDROID_RES = join(process.cwd(), 'android', 'app', 'src', 'main', 'res');

// Densidades Android y sus tamaños de ícono en px
const DENSITIES = {
    'mipmap-ldpi': { icon: 36, foreground: 54 },
    'mipmap-mdpi': { icon: 48, foreground: 72 },
    'mipmap-hdpi': { icon: 72, foreground: 108 },
    'mipmap-xhdpi': { icon: 96, foreground: 144 },
    'mipmap-xxhdpi': { icon: 144, foreground: 216 },
    'mipmap-xxxhdpi': { icon: 192, foreground: 288 },
};

async function generateIcons() {
    console.log('🎨 Generando iconos Android desde assets/icon.png...\n');

    if (!existsSync(SOURCE)) {
        console.error('❌ No se encontró assets/icon.png');
        process.exit(1);
    }

    const sourceBuffer = await sharp(SOURCE).toBuffer();
    const metadata = await sharp(sourceBuffer).metadata();
    console.log(`📐 Imagen fuente: ${metadata.width}x${metadata.height}px\n`);

    for (const [folder, sizes] of Object.entries(DENSITIES)) {
        const dir = join(ANDROID_RES, folder);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

        // ic_launcher.png - ícono principal (con bordes redondeados simulados)
        await sharp(sourceBuffer)
            .resize(sizes.icon, sizes.icon, { fit: 'cover' })
            .png()
            .toFile(join(dir, 'ic_launcher.png'));
        console.log(`  ✅ ${folder}/ic_launcher.png (${sizes.icon}x${sizes.icon})`);

        // ic_launcher_round.png - ícono circular
        // Crear máscara circular
        const roundMask = Buffer.from(
            `<svg width="${sizes.icon}" height="${sizes.icon}">
        <circle cx="${sizes.icon / 2}" cy="${sizes.icon / 2}" r="${sizes.icon / 2}" fill="white"/>
      </svg>`
        );
        await sharp(sourceBuffer)
            .resize(sizes.icon, sizes.icon, { fit: 'cover' })
            .composite([{ input: roundMask, blend: 'dest-in' }])
            .png()
            .toFile(join(dir, 'ic_launcher_round.png'));
        console.log(`  ✅ ${folder}/ic_launcher_round.png (${sizes.icon}x${sizes.icon} circular)`);

        // ic_launcher_foreground.png - para adaptive icons
        // El foreground necesita padding extra (Android recorta ~18% por cada lado)
        await sharp({
            create: {
                width: sizes.foreground,
                height: sizes.foreground,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            }
        })
            .composite([{
                input: await sharp(sourceBuffer)
                    .resize(
                        Math.round(sizes.foreground * 0.70),
                        Math.round(sizes.foreground * 0.70),
                        { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } }
                    )
                    .toBuffer(),
                gravity: 'center'
            }])
            .png()
            .toFile(join(dir, 'ic_launcher_foreground.png'));
        console.log(`  ✅ ${folder}/ic_launcher_foreground.png (${sizes.foreground}x${sizes.foreground})`);

        // ic_launcher_background.png - fondo blanco sólido para adaptive icons
        await sharp({
            create: {
                width: sizes.foreground,
                height: sizes.foreground,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            }
        })
            .png()
            .toFile(join(dir, 'ic_launcher_background.png'));
        console.log(`  ✅ ${folder}/ic_launcher_background.png (fondo blanco)`);
    }

    console.log('\n🎉 ¡Todos los iconos generados exitosamente!');
    console.log('📱 Tu icono de NEXUM POS se verá en el escritorio del dispositivo Android.');
}

generateIcons().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
