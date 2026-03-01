import * as XLSX from 'xlsx';

/**
 * Exporta datos a un archivo Excel
 * @param {Array} data - Array de objetos a exportar
 * @param {string} filename - Nombre del archivo (sin extensión)
 * @param {string} sheetName - Nombre de la hoja (opcional)
 */
export const exportToExcel = (data, filename = 'reporte', sheetName = 'Datos') => {
    if (!data || data.length === 0) {
        alert('No hay datos para exportar');
        return;
    }

    // Crear un nuevo libro de trabajo
    const workbook = XLSX.utils.book_new();

    // Convertir los datos a una hoja de trabajo
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Ajustar el ancho de las columnas
    const maxWidth = 50;
    const colWidths = [];
    
    // Obtener todas las claves (columnas)
    const keys = Object.keys(data[0]);
    
    keys.forEach(key => {
        let maxLen = key.length;
        data.forEach(row => {
            const value = row[key];
            if (value !== null && value !== undefined) {
                const cellValue = String(value);
                if (cellValue.length > maxLen) {
                    maxLen = cellValue.length;
                }
            }
        });
        colWidths.push({ wch: Math.min(maxLen + 2, maxWidth) });
    });

    worksheet['!cols'] = colWidths;

    // Agregar la hoja al libro
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Generar el archivo Excel y descargarlo
    XLSX.writeFile(workbook, `${filename}.xlsx`);
};

/**
 * Exporta múltiples hojas a un archivo Excel
 * @param {Array} sheets - Array de objetos { name, data }
 * @param {string} filename - Nombre del archivo (sin extensión)
 */
export const exportMultipleSheets = (sheets, filename = 'reporte') => {
    if (!sheets || sheets.length === 0) {
        alert('No hay datos para exportar');
        return;
    }

    const workbook = XLSX.utils.book_new();

    sheets.forEach(({ name, data }) => {
        if (data && data.length > 0) {
            const worksheet = XLSX.utils.json_to_sheet(data);

            // Ajustar ancho de columnas
            const keys = Object.keys(data[0]);
            const colWidths = keys.map(() => ({ wch: 20 }));
            worksheet['!cols'] = colWidths;

            XLSX.utils.book_append_sheet(workbook, worksheet, name);
        }
    });

    XLSX.writeFile(workbook, `${filename}.xlsx`);
};
