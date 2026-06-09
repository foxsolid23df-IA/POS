import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";
import {
  FiUploadCloud,
  FiFileText,
  FiX,
  FiCheck,
  FiAlertTriangle,
  FiDownload,
} from "react-icons/fi";
import { productService } from "../../services/productService";
import "./BulkImportModal.css";

// ===== COLUMN ALIAS MAP =====
// Each DB field maps to an array of possible Excel header names.
// Matching is case-insensitive and accent-insensitive.
const COLUMN_ALIASES = {
  sku: [
    "SKU",
    "Sku",
    "Codigo",
    "Codigo de Barras",
    "Code",
    "codigo",
    "sku",
  ],
  barcode: [
    "Codigo",
    "SKU",
    "Sku",
    "Codigo de Barras",
    "Barcode",
    "Código",
    "Código de Barras",
    "Code",
    "codigo",
    "sku",
  ],
  name: [
    "Descripcion",
    "Descripción",
    "Producto",
    "Nombre",
    "Artículo",
    "Articulo",
    "Nombre del Producto",
    "Product",
    "producto",
  ],
  cost_price: [
    "Precio Costo",
    "Costo",
    "Cost",
    "Precio de Costo",
    "Costo Unitario",
    "precio_compra",
    "Precio Compra",
    "PrecioCompra",
    "costo",
  ],
  price: [
    "Precio Venta",
    "Precio",
    "Venta",
    "Price",
    "Precio de Venta",
    "PVP",
    "precio_men",
    "Precio Menudeo",
    "PrecioMenor",
    "Precio Men",
    "Menudeo",
    "precio",
  ],
  wholesale_price: [
    "Precio Mayoreo",
    "Mayoreo",
    "Wholesale",
    "precio_may",
    "Precio May",
    "PrecioMayoreo",
    "mayoreo",
  ],
  box_units: [
    "Piezas por Caja",
    "Pzas Caja",
    "Factor Caja",
    "Contenido Caja",
    "Unidades por Caja",
    "Box Units",
    "box_units",
  ],
  box_price: [
    "Precio Caja",
    "Precio por Caja",
    "Caja",
    "Box Price",
    "box_price",
  ],
  box_barcode: [
    "Codigo Caja",
    "Código Caja",
    "Código de Caja",
    "Codigo de Caja",
    "SKU Caja",
    "Barcode Caja",
    "Box Barcode",
    "box_barcode",
  ],
  sell_by_box_only: [
    "Solo Caja",
    "Vender solo caja",
    "Solo vender por caja",
    "sell_by_box_only",
  ],
  stock: [
    "Existencia",
    "Existencias",
    "Cantidad",
    "Stock",
    "Inventario",
    "Qty",
    "existencia",
    "stock",
  ],
  branch_stock: [
    "suc1",
    "Suc1",
    "Sucursal 1",
    "Stock Sucursal",
    "Existencia Sucursal",
  ],
  min_stock: [
    "Inv. Minimo",
    "Inv Minimo",
    "Minimo",
    "Mínimo",
    "Stock Minimo",
    "Stock Mínimo",
    "Inventario Minimo",
  ],
  category: [
    "Departamento",
    "Categoria",
    "Categoría",
    "Línea",
    "Linea",
    "Depto",
    "Category",
    "Rubro",
    "categoria",
  ],
  // ===== ADVANCED FIELDS =====
  notes: [
    "Notas",
    "notas",
    "Notes",
    "Observaciones",
    "Comentarios",
    "Nota",
  ],
  unit: [
    "Unidad",
    "unidad",
    "Unit",
    "Medida",
    "Unidad de Medida",
    "UdM",
    "udm",
  ],
  iva: [
    "IVA",
    "iva",
    "Iva",
    "IVA %",
    "Impuesto",
    "Tax",
    "iva%",
  ],
  special_price: [
    "Precio Especial",
    "P. Especial",
    "precio_esp",
    "PrecioEspecial",
    "Especial",
    "Special Price",
    "Precio Esp",
  ],
  special_price_2: [
    "Precio Especial 2",
    "P. Especial 2",
    "precio_esp_2",
    "PrecioEspecial2",
    "Especial 2",
    "Special Price 2",
  ],
  suggested_price: [
    "Precio Sugerido",
    "P. Sugerido",
    "precio_sugerido",
    "PrecioSugerido",
    "Sugerido",
    "Suggested Price",
    "MSRP",
  ],
  wholesale_from_qty: [
    "Mayoreo desde",
    "Precio Mayoreo desde",
    "Mayoreo a partir de",
    "wholesale_from_qty",
  ],
  special_from_qty: [
    "Especial desde",
    "Precio Especial desde",
    "Especial a partir de",
    "special_from_qty",
  ],
  wholesale_unit: [
    "Unidad Mayoreo",
    "Und. Mayoreo",
    "umay",
    "Umay",
    "UMay",
    "Unidad May",
    "Wholesale Unit",
    "und_mayoreo",
  ],
  brand: [
    "Marca",
    "marca",
    "Brand",
    "Fabricante",
    "Manufacturer",
  ],
  supplier: [
    "Proveedor",
    "proveedor",
    "Supplier",
    "Vendor",
    "Distribuidor",
  ],
};

// Normalize: trim, lowercase, remove accents, remove extra spaces
const normalizeStr = (str) =>
  String(str)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

// Given a row object and an array of aliases, find the value
const getValueFromRow = (row, aliases) => {
  const rowKeys = Object.keys(row);
  for (const alias of aliases) {
    const normalizedAlias = normalizeStr(alias);
    const foundKey = rowKeys.find((k) => normalizeStr(k) === normalizedAlias);
    if (foundKey !== undefined) {
      const val = row[foundKey];
      // Return value if it's not undefined and not empty string
      if (val !== undefined && val !== null && val !== "") {
        return val;
      }
    }
  }
  return null;
};

const cleanText = (value) => {
  if (value === undefined || value === null) return null;
  const cleaned = String(value).trim();
  return cleaned === "" ? null : cleaned;
};

const toNumber = (value, fallback = 0) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value)
    .trim()
    .replace(/\$/g, "")
    .replace(/\s+/g, "")
    .replace(/,/g, ".");
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toInteger = (value, fallback = 0) => {
  const parsed = toNumber(value, fallback);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
};

const toBoolean = (value) => {
  const normalized = cleanText(value)
    ?.toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return ["SI", "TRUE", "1", "X"].includes(normalized);
};

const normalizeUnit = (value) => {
  const unit = cleanText(value)?.toUpperCase() || "PZA";
  if (["PIEZA", "PIEZAS", "PZAS"].includes(unit)) return "PZA";
  return unit;
};

const extractBoxUnits = (...values) => {
  const text = values
    .map((value) => cleanText(value))
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  if (!text) return null;

  const patterns = [
    /\b(?:CAJA|CAJAC|CJA|PAQUETE|PAQ)\s*\.?\s*C\s*\/?\s*(\d{1,4})\b/,
    /\b(?:CAJA|CJA|PAQUETE|PAQ)\s*(?:CON|DE)\s*(\d{1,4})\b/,
    /\bC\s*\/\s*(\d{1,4})\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const units = match ? parseInt(match[1], 10) : 0;
    if (Number.isFinite(units) && units > 1) return units;
  }

  return null;
};

const getStockValue = (branchStockVal, stockVal) => {
  const branchStock = toInteger(branchStockVal, Number.NaN);
  if (Number.isFinite(branchStock)) return Math.max(0, branchStock);

  const stock = toInteger(stockVal, 0);
  return Math.max(0, stock);
};

const getBoxPriceValue = (boxPriceVal, boxUnits, price, wholesalePrice) => {
  const explicitBoxPrice = toNumber(boxPriceVal, 0);
  if (explicitBoxPrice > 0) return explicitBoxPrice;
  if (!boxUnits || boxUnits <= 1) return null;

  const unitPrice = price > 0 ? price : wholesalePrice;
  return unitPrice > 0 ? Number((unitPrice * boxUnits).toFixed(2)) : null;
};

const toSianInventoryRow = (product, { category = "General", sku } = {}) => ({
  SKU: sku || product.metadata?.sku || product.barcode || "",
  barcode: product.barcode || "",
  Descripcion: product.name || "",
  notas: product.notes || (product.box_units ? `CAJA C/${product.box_units}` : ""),
  unidad: product.unit || "PZA",
  iva: toNumber(product.iva, 0),
  precio_compra: toNumber(product.cost_price, 0),
  precio_men: toNumber(product.price, 0),
  precio_may: toNumber(product.wholesale_price, 0),
  "Solo Caja": product.sell_by_box_only ? "SI" : "",
  precio_esp: toNumber(product.special_price, 0),
  precio_esp_2: toNumber(product.special_price_2, 0),
  precio_sugerido: toNumber(product.suggested_price, 0),
  mayoreo_desde: toNumber(product.wholesale_from_qty, 0) || "",
  especial_desde: toNumber(product.special_from_qty, 0) || "",
  umay: product.wholesale_unit || 1,
  existencia: toInteger(product.stock, 0),
  suc1: toInteger(product.stock, 0),
  Categoria: category,
  Marca: product.brand || "",
  Proveedor: product.supplier || "",
});

// Map a single Excel row to a product object
const mapRowToProduct = (row) => {
  const get = (field) => getValueFromRow(row, COLUMN_ALIASES[field]);

  const skuVal = get("sku");
  const barcodeVal = getValueFromRow(row, [
    "barcode",
    "Barcode",
    "Codigo de Barras",
    "CÃ³digo de Barras",
  ]);
  const nameVal = get("name");
  const costVal = get("cost_price");
  const priceVal = get("price");
  const wholesaleVal = get("wholesale_price");
  const boxUnitsVal = get("box_units");
  const boxPriceVal = get("box_price");
  const boxBarcodeVal = get("box_barcode");
  const sellByBoxOnlyVal = get("sell_by_box_only");
  const stockVal = get("stock");
  const branchStockVal = get("branch_stock");
  const minStockVal = get("min_stock");
  const categoryVal = get("category");

  // Advanced fields
  const notesVal = get("notes");
  const unitVal = get("unit");
  const ivaVal = get("iva");
  const specialPriceVal = get("special_price");
  const specialPrice2Val = get("special_price_2");
  const suggestedPriceVal = get("suggested_price");
  const wholesaleFromQtyVal = get("wholesale_from_qty");
  const specialFromQtyVal = get("special_from_qty");
  const wholesaleUnitVal = get("wholesale_unit");
  const brandVal = get("brand");
  const supplierVal = get("supplier");
  const sku = cleanText(skuVal);
  const barcode = cleanText(barcodeVal) || sku;
  const price = toNumber(priceVal, 0);
  const wholesalePrice = toNumber(wholesaleVal, 0);
  const explicitBoxUnits = toInteger(boxUnitsVal, 0);
  const inferredBoxUnits =
    explicitBoxUnits > 1 ? explicitBoxUnits : extractBoxUnits(notesVal, wholesaleUnitVal);
  const fallbackBoxUnits =
    inferredBoxUnits || (toInteger(wholesaleUnitVal, 0) > 1 ? toInteger(wholesaleUnitVal, 0) : null);
  const boxPrice = getBoxPriceValue(boxPriceVal, fallbackBoxUnits, price, wholesalePrice);
  const boxBarcode =
    cleanText(boxBarcodeVal) ||
    (fallbackBoxUnits && barcode ? `${barcode}-CAJA` : null);

  return {
    barcode,
    name: cleanText(nameVal) || "Producto Sin Nombre",
    cost_price: toNumber(costVal, 0),
    price,
    wholesale_price: wholesalePrice,
    box_units: fallbackBoxUnits,
    box_price: boxPrice,
    box_barcode: boxBarcode,
    sell_by_box_only: toBoolean(sellByBoxOnlyVal),
    stock: getStockValue(branchStockVal, stockVal),
    min_stock: toInteger(minStockVal, 0),
    category: cleanText(categoryVal) || "General",
    // Advanced fields
    notes: cleanText(notesVal) || "",
    unit: normalizeUnit(unitVal),
    iva: toNumber(ivaVal, 0),
    special_price: toNumber(specialPriceVal, 0),
    special_price_2: toNumber(specialPrice2Val, 0),
    suggested_price: toNumber(suggestedPriceVal, 0),
    wholesale_from_qty: toNumber(wholesaleFromQtyVal, 0) || null,
    special_from_qty: toNumber(specialFromQtyVal, 0) || null,
    wholesale_unit: cleanText(wholesaleUnitVal) || "",
    brand: cleanText(brandVal) || "",
    supplier: cleanText(supplierVal) || "",
    metadata: {
      sku,
      stock_source: branchStockVal !== null ? "suc1" : "existencia",
    },
  };
};

const BulkImportModal = ({
  onClose,
  onSuccess,
  currentProducts = [],
  getCategory,
  getSKU,
}) => {
  const [step, setStep] = useState(1); // 1: Upload, 2: Preview
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [mappedPreview, setMappedPreview] = useState([]); // Store already-mapped products for preview
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Download template
  const handleDownloadTemplate = () => {
    const templateRows = [
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
    ];
    const exampleProduct = mapRowToProduct(templateRows[0]);
    const ws = XLSX.utils.json_to_sheet([
      toSianInventoryRow(exampleProduct, {
        category: exampleProduct.category,
        sku: exampleProduct.metadata?.sku,
      }),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, "plantilla_inventario.xlsx");
  };

  // Export current inventory layout for easy update
  const handleExportCurrentInventory = () => {
    if (!currentProducts || currentProducts.length === 0) {
      Swal.fire(
        "Atención",
        "No hay productos en el inventario actual para exportar.",
        "info",
      );
      return;
    }

    const data = currentProducts.map((p) => {
      const productCategory = getCategory
        ? p.category || getCategory(p.name).name
        : p.category || "General";
      const sku = getSKU ? getSKU(p) : p.barcode || p.id;
      return toSianInventoryRow(p, { category: productCategory, sku });
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Adjust column widths
    const columnWidths = [
      { wch: 20 },
      { wch: 30 },
      { wch: 20 },
      { wch: 10 },
      { wch: 8 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 20 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
      { wch: 20 },
    ];
    ws["!cols"] = columnWidths;

    XLSX.utils.book_append_sheet(wb, ws, "Inventario Actual");
    const fileName = `plantilla_actualizacion_${
      new Date().toISOString().split("T")[0]
    }.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Handle File Selection
  const handleFile = (selectedFile) => {
    if (!selectedFile) return;

    const fileType = selectedFile.name.split(".").pop().toLowerCase();
    if (fileType !== "xlsx" && fileType !== "xls") {
      Swal.fire(
        "Error",
        "Por favor selecciona un archivo Excel (.xlsx o .xls)",
        "error",
      );
      return;
    }

    setFile(selectedFile);
    parseExcel(selectedFile);
  };

  // Parse Excel File
  const parseExcel = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (jsonData.length === 0) {
          Swal.fire("Error", "El archivo parece estar vacío", "warning");
          setFile(null);
          return;
        }

        // Log detected headers for debugging
        const headers = Object.keys(jsonData[0]);
        console.log("📋 Excel headers detected:", headers);
        console.log("📋 First row raw data:", jsonData[0]);

        // Map all rows immediately so we can preview the MAPPED data
        const mapped = jsonData
          .map(mapRowToProduct)
          .filter((p) => p.name && p.price >= 0);
        console.log("📋 First mapped product:", mapped[0]);
        console.log(
          `📋 Total mapped: ${mapped.length} of ${jsonData.length} rows`,
        );

        setPreviewData(jsonData);
        setMappedPreview(mapped);
        setStep(2);
      } catch (error) {
        console.error("Error parsing excel:", error);
        Swal.fire("Error", "No se pudo leer el archivo Excel", "error");
        setFile(null);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Drag and Drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // Process and Upload Data
  const handleUpload = async () => {
    setUploading(true);
    try {
      // Use the already-mapped products
      const mappedProducts = mappedPreview;

      if (mappedProducts.length === 0) {
        throw new Error("No se encontraron productos válidos para importar");
      }

      console.log("🚀 Uploading", mappedProducts.length, "products");
      console.log("🚀 Sample product:", mappedProducts[0]);

      // Step 1: Clean up broken products from previous failed imports
      try {
        const deletedCount = await productService.bulkDeleteBrokenProducts();
        if (deletedCount > 0) {
          console.log(
            `🧹 Cleaned up ${deletedCount} broken 'Producto Sin Nombre' entries`,
          );
        }
      } catch (cleanupErr) {
        console.warn("⚠️ Cleanup warning (non-fatal):", cleanupErr);
      }

      // Step 2: Import products
      const result = await productService.bulkCreateProducts(mappedProducts);

      Swal.fire({
        icon: "success",
        title: "Importación Completada",
        html: `<div style="text-align:left;padding:0 10px;">
          <p>✅ <strong>${result.insertedCount}</strong> productos nuevos creados</p>
          <p>🔄 <strong>${result.updatedCount}</strong> productos existentes actualizados</p>
        </div>`,
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Upload error:", error);
      Swal.fire(
        "Error",
        "Hubo un problema al guardar los productos. " + (error.message || ""),
        "error",
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content bulk-import-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="close-btn" onClick={onClose}>
          <FiX />
        </button>

        <div className="modal-header">
          <h2>
            <FiUploadCloud className="icon-mr" /> Importación Masiva
          </h2>
          <p>Sube tu inventario usando una plantilla de Excel</p>
        </div>

        <div className="modal-body">
          {step === 1 && (
            <div className="upload-step">
              <div
                className={`drop-zone ${dragActive ? "active" : ""}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={(e) => handleFile(e.target.files[0])}
                  style={{ display: "none" }}
                />
                <div className="drop-content">
                  <FiUploadCloud className="upload-icon" />
                  <h3>Arrastra tu archivo Excel aquí</h3>
                  <p>o haz clic para seleccionar</p>
                  <span className="file-types">Soporta .xlsx, .xls</span>
                </div>
              </div>

              <div className="template-section">
                <p>
                  ¿No tienes la plantilla o quieres actualizar existencias
                  actuales?
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    justifyContent: "center",
                    marginTop: "10px",
                  }}
                >
                  <button
                    className="text-btn outline-btn"
                    onClick={handleDownloadTemplate}
                    style={{
                      border: "1px solid #e2e8f0",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      background: "#f8fafc",
                    }}
                  >
                    <FiDownload /> Descargar Plantilla Vacía
                  </button>
                  <button
                    className="text-btn primary-btn"
                    onClick={handleExportCurrentInventory}
                    style={{
                      background: "#3b82f6",
                      color: "white",
                      padding: "8px 16px",
                      borderRadius: "8px",
                    }}
                  >
                    <FiDownload /> Exportar Inventario Actual
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="preview-step">
              <div className="preview-header">
                <div className="file-info">
                  <FiFileText />
                  <span>{file?.name}</span>
                  <span className="badge">
                    {mappedPreview.length} productos válidos
                  </span>
                </div>
                <button
                  className="text-link"
                  onClick={() => {
                    setStep(1);
                    setFile(null);
                    setMappedPreview([]);
                  }}
                >
                  Cambiar archivo
                </button>
              </div>

              <div className="preview-table-wrapper">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Producto</th>
                      <th>Costo</th>
                      <th>Venta</th>
                      <th>Mayoreo</th>
                      <th>Pzas/Caja</th>
                      <th>Caja</th>
                      <th>Solo Caja</th>
                      <th>P.Esp</th>
                      <th>P.Esp2</th>
                      <th>P.Sug</th>
                      <th>May Desde</th>
                      <th>Esp Desde</th>
                      <th>Stock</th>
                      <th>Und</th>
                      <th>IVA</th>
                      <th>Marca</th>
                      <th>Proveedor</th>
                      <th>Categoría</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappedPreview.slice(0, 10).map((product, index) => (
                      <tr key={index}>
                        <td>{product.metadata?.sku || product.barcode || "-"}</td>
                        <td>{product.name}</td>
                        <td>${Number(product.cost_price || 0).toFixed(2)}</td>
                        <td>${Number(product.price || 0).toFixed(2)}</td>
                        <td>${Number(product.wholesale_price || 0).toFixed(2)}</td>
                        <td>{product.box_units || "-"}</td>
                        <td>
                          {product.box_price
                            ? `$${Number(product.box_price || 0).toFixed(2)}`
                            : "-"}
                        </td>
                        <td>{product.sell_by_box_only ? "SI" : "NO"}</td>
                        <td>${Number(product.special_price || 0).toFixed(2)}</td>
                        <td>${Number(product.special_price_2 || 0).toFixed(2)}</td>
                        <td>${Number(product.suggested_price || 0).toFixed(2)}</td>
                        <td>{product.wholesale_from_qty || "-"}</td>
                        <td>{product.special_from_qty || "-"}</td>
                        <td>{product.stock}</td>
                        <td>{product.unit || "PZA"}</td>
                        <td>{product.iva || 0}%</td>
                        <td>{product.brand || "-"}</td>
                        <td>{product.supplier || "-"}</td>
                        <td>{product.category}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {mappedPreview.length > 10 && (
                  <div className="preview-footer">
                    ... y {mappedPreview.length - 10} más
                  </div>
                )}
              </div>

              <div className="validation-warning">
                <FiAlertTriangle />
                <p>
                  Asegúrate de que los códigos de barras sean únicos para evitar
                  duplicados.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose} disabled={uploading}>
            Cancelar
          </button>
          {step === 2 && (
            <button
              className="confirm-btn"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? "Importando..." : "Importar Productos"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkImportModal;
