/**
 * Formatos de importación de Excel predefinidos por giro de negocio.
 * Cada giro define las columnas que espera en el Excel, el mapeo
 * a campos del sistema y transformaciones de limpieza de datos.
 */

const importFormats = {
  // ============================================================
  // FORMATO GENERAL — Plantilla completa estándar del sistema
  // ============================================================
  general: {
    label: "Formato General (Estándar)",
    description: "Plantilla completa del sistema con todos los campos disponibles.",
    columns: [
      "SKU",
      "Producto",
      "Notas",
      "Unidad",
      "IVA",
      "Precio Compra",
      "Precio Venta",
      "Precio Mayoreo",
      "Piezas por Caja",
      "Precio Caja",
      "Código Caja",
      "Precio Especial",
      "Precio Especial 2",
      "Precio Sugerido",
      "Mayoreo desde",
      "Especial desde",
      "Und. Mayoreo",
      "Existencia",
      "Inv. Minimo",
      "Categoria",
      "Marca",
      "Proveedor",
    ],
    // Mapeo directo: columna Excel → campo interno (null = usar COLUMN_ALIASES genérico)
    columnMap: null,
    defaults: {
      unit: "PZA",
      iva: 0,
    },
    transformations: {},
    templateRows: [
      {
        SKU: "PRUEBA01",
        Producto: "Producto de Ejemplo",
        Notas: "",
        Unidad: "PZA",
        IVA: 16,
        "Precio Compra": 10.0,
        "Precio Venta": 15.0,
        "Precio Mayoreo": 12.5,
        "Piezas por Caja": 24,
        "Precio Caja": 300.0,
        "Código Caja": "PRUEBA01-CAJA",
        "Precio Especial": 0,
        "Precio Especial 2": 0,
        "Precio Sugerido": 0,
        "Mayoreo desde": 20,
        "Especial desde": 48,
        "Und. Mayoreo": "",
        Existencia: 10,
        "Inv. Minimo": 5,
        Categoria: "General",
        Marca: "",
        Proveedor: "",
      },
    ],
  },

  // ============================================================
  // FORMATO ABARROTES — Exportación típica de minisupers / SIAN
  // ============================================================
  abarrotes: {
    label: "Abarrotes / Minisuper",
    description:
      "Formato de exportación de sistemas como SIAN. 8 columnas básicas con códigos de barras, precios y existencias.",
    columns: [
      "Codigo",
      "Descripcion",
      "Precio Costo",
      "Precio Venta",
      "Precio Mayoreo",
      "Inventario",
      "Inv. Minimo",
      "Departamento",
    ],
    columnMap: {
      Codigo: "barcode",
      Descripcion: "name",
      "Precio Costo": "cost_price",
      "Precio Venta": "price",
      "Precio Mayoreo": "wholesale_price",
      Inventario: "stock",
      "Inv. Minimo": "min_stock",
      Departamento: "category",
    },
    defaults: {
      unit: "PZA",
      iva: 0,
      wholesale_from_qty: 0,
      special_price: 0,
      suggested_price: 0,
      brand: "",
      supplier: "",
      notes: "",
    },
    transformations: {
      barcode: (val) => String(val || "").trim(),
      name: (val) => {
        const cleaned = String(val || "").trim();
        return cleaned || null; // null = será marcado como "Producto Sin Nombre"
      },
      category: (val) => {
        const raw = String(val || "").trim();
        // Eliminar sufijos como "Eliminado 27/01/2026 10:39:56"
        const cleaned = raw.replace(/\s*Eliminado.*$/i, "").trim();
        return cleaned || "General";
      },
      cost_price: (val) => {
        const n = parseFloat(String(val || "0").replace(/[$,\s]/g, ""));
        return Number.isFinite(n) ? n : 0;
      },
      price: (val) => {
        const n = parseFloat(String(val || "0").replace(/[$,\s]/g, ""));
        return Number.isFinite(n) ? n : 0;
      },
      wholesale_price: (val) => {
        const n = parseFloat(String(val || "0").replace(/[$,\s]/g, ""));
        return Number.isFinite(n) ? n : 0;
      },
      stock: (val) => {
        const n = parseInt(String(val || "0").replace(/[,\s]/g, ""), 10);
        return Number.isFinite(n) ? Math.max(0, n) : 0;
      },
      min_stock: (val) => {
        const n = parseInt(String(val || "0").replace(/[,\s]/g, ""), 10);
        return Number.isFinite(n) ? n : 0;
      },
    },
    templateRows: [
      {
        Codigo: "7501234567890",
        Descripcion: "Aceite Vegetal 1L",
        "Precio Costo": 18.5,
        "Precio Venta": 25.0,
        "Precio Mayoreo": 22.0,
        Inventario: 48,
        "Inv. Minimo": 10,
        Departamento: "Abarrotes General",
      },
      {
        Codigo: "7509876543210",
        Descripcion: "Refresco Cola 600ml",
        "Precio Costo": 8.0,
        "Precio Venta": 14.0,
        "Precio Mayoreo": 12.0,
        Inventario: 72,
        "Inv. Minimo": 20,
        Departamento: "Bebidas",
      },
    ],
  },

  // ============================================================
  // FORMATO FERRETERÍA — Completo con unidades de medida
  // ============================================================
  ferreteria: {
    label: "Ferretería",
    description:
      "Formato completo con soporte para unidades de medida variadas (M, KG, L, PAQ, TRAMO, ROLLO, JGO).",
    columns: [
      "SKU",
      "Producto",
      "Notas",
      "Unidad",
      "IVA",
      "Precio Compra",
      "Precio Venta",
      "Precio Mayoreo",
      "Piezas por Caja",
      "Precio Caja",
      "Código Caja",
      "Precio Especial",
      "Precio Sugerido",
      "Mayoreo desde",
      "Und. Mayoreo",
      "Existencia",
      "Inv. Minimo",
      "Categoria",
      "Marca",
      "Proveedor",
    ],
    columnMap: null, // Usar COLUMN_ALIASES genérico
    defaults: {
      unit: "PZA",
      iva: 16,
    },
    transformations: {},
    templateRows: [
      {
        SKU: "FERR001",
        Producto: "Tornillo 1/4 x 2\"",
        Notas: "Caja con 100 piezas",
        Unidad: "PZA",
        IVA: 16,
        "Precio Compra": 2.5,
        "Precio Venta": 4.0,
        "Precio Mayoreo": 3.2,
        "Piezas por Caja": 100,
        "Precio Caja": 320.0,
        "Código Caja": "FERR001-CAJA",
        "Precio Especial": 3.0,
        "Precio Sugerido": 4.5,
        "Mayoreo desde": 50,
        "Und. Mayoreo": "",
        Existencia: 500,
        "Inv. Minimo": 100,
        Categoria: "Tornillería",
        Marca: "Genérico",
        Proveedor: "Distribuidora XYZ",
      },
    ],
  },

  // ============================================================
  // FORMATO REFACCIONARIA — Simplificado con kits
  // ============================================================
  refaccionaria: {
    label: "Refaccionaria",
    description: "Formato simplificado con soporte para kits y juegos de refacciones.",
    columns: [
      "SKU",
      "Producto",
      "Unidad",
      "Precio Compra",
      "Precio Venta",
      "Precio Mayoreo",
      "Existencia",
      "Inv. Minimo",
      "Categoria",
      "Marca",
    ],
    columnMap: null,
    defaults: {
      unit: "PZA",
      iva: 16,
    },
    transformations: {},
    templateRows: [
      {
        SKU: "REF001",
        Producto: "Filtro de Aceite Genérico",
        Unidad: "PZA",
        "Precio Compra": 45.0,
        "Precio Venta": 75.0,
        "Precio Mayoreo": 60.0,
        Existencia: 30,
        "Inv. Minimo": 10,
        Categoria: "Filtros",
        Marca: "Genérico",
      },
    ],
  },

  // ============================================================
  // FORMATO PAPELERÍA — Simplificado con paquetes
  // ============================================================
  papeleria: {
    label: "Papelería",
    description: "Formato simplificado con soporte para paquetes y cajas de papelería.",
    columns: [
      "SKU",
      "Producto",
      "Unidad",
      "Precio Compra",
      "Precio Venta",
      "Precio Mayoreo",
      "Piezas por Caja",
      "Precio Caja",
      "Existencia",
      "Inv. Minimo",
      "Categoria",
      "Marca",
    ],
    columnMap: null,
    defaults: {
      unit: "PZA",
      iva: 16,
    },
    transformations: {},
    templateRows: [
      {
        SKU: "PAP001",
        Producto: "Cuaderno 100 Hojas",
        Unidad: "PZA",
        "Precio Compra": 15.0,
        "Precio Venta": 25.0,
        "Precio Mayoreo": 20.0,
        "Piezas por Caja": 30,
        "Precio Caja": 600.0,
        Existencia: 120,
        "Inv. Minimo": 30,
        Categoria: "Cuadernos",
        Marca: "Estrella",
      },
    ],
  },
};

/**
 * Obtiene el formato de importación para un giro dado.
 * @param {string} businessVertical - ID del giro (general, abarrotes, etc.)
 * @returns {object} Formato de importación
 */
export const getImportFormat = (businessVertical) => {
  return importFormats[businessVertical] || importFormats.general;
};

/**
 * Lista de todos los giros disponibles con su información básica.
 */
export const getAllVerticals = () =>
  Object.entries(importFormats).map(([id, fmt]) => ({
    id,
    label: fmt.label,
    description: fmt.description,
    columnCount: fmt.columns.length,
  }));

export default importFormats;
