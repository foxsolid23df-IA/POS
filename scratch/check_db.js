const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'backend', 'data', 'sistema-pos.db');
console.log(`Checking DB at: ${dbPath}`);

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: false
});

async function checkDuplicates() {
    try {
        const Product = sequelize.define('Product', {
            barcode: { type: DataTypes.STRING },
            box_barcode: { type: DataTypes.STRING }
        }, { 
            tableName: 'Product',
            timestamps: false 
        });

        const products = await Product.findAll();
        console.log(`Total products: ${products.length}`);

        const barcodes = {};
        const boxBarcodes = {};
        const duplicates = [];

        products.forEach(p => {
            if (p.barcode) {
                if (barcodes[p.barcode]) {
                    duplicates.push(`Duplicate barcode: ${p.barcode}`);
                }
                barcodes[p.barcode] = true;
            }
            if (p.box_barcode) {
                if (boxBarcodes[p.box_barcode]) {
                    duplicates.push(`Duplicate box_barcode: ${p.box_barcode}`);
                }
                boxBarcodes[p.box_barcode] = true;
            }
        });

        if (duplicates.length > 0) {
            console.log('Found duplicates:');
            duplicates.forEach(d => console.log(d));
        } else {
            console.log('No duplicates found in non-null values.');
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await sequelize.close();
    }
}

checkDuplicates();
