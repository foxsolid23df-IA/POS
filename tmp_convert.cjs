
const sharp = require('sharp');
const path = require('path');

const source = 'C:/Users/foxso/.gemini/antigravity/brain/1ed615e9-39e8-4de8-8daf-13151c836292/media__1772724193919.jpg';
const targets = [
    'c:/POS/frontend/src/assets/logo.png',
    'c:/POS/frontend/src/assets/icon.png',
    'c:/POS/frontend/assets/logo.png',
    'c:/POS/frontend/assets/icon.png',
    'c:/POS/frontend/assets/splash.png'
];

async function convert() {
    for (const target of targets) {
        await sharp(source)
            .png()
            .toFile(target);
        console.log(`Converted to ${target}`);
    }
}

convert().catch(console.error);
