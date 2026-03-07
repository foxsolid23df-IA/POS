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
  barcode: [
    "Codigo",
    "SKU",
    "Codigo de Barras",
    "Barcode",
    "Código",
    "Código de Barras",
    "Code",
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
  ],
  cost_price: [
    "Precio Costo",
    "Costo",
    "Cost",
    "Precio de Costo",
    "Costo Unitario",
  ],
  price: ["Precio Venta", "Precio", "Venta", "Price", "Precio de Venta", "PVP"],
  wholesale_price: ["Precio Mayoreo", "Mayoreo", "Wholesale"],
  stock: [
    "Existencia",
    "Existencias",
    "Cantidad",
    "Stock",
    "Inventario",
    "Qty",
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

// Map a single Excel row to a product object
const mapRowToProduct = (row) => {
  const get = (field) => getValueFromRow(row, COLUMN_ALIASES[field]);

  const barcodeVal = get("barcode");
  const nameVal = get("name");
  const costVal = get("cost_price");
  const priceVal = get("price");
  const wholesaleVal = get("wholesale_price");
  const stockVal = get("stock");
  const minStockVal = get("min_stock");
  const categoryVal = get("category");

  return {
    barcode: barcodeVal !== null ? String(barcodeVal) : null,
    name: nameVal !== null ? String(nameVal) : "Producto Sin Nombre",
    cost_price: parseFloat(costVal || 0),
    price: parseFloat(priceVal || 0),
    wholesale_price: parseFloat(wholesaleVal || 0),
    stock: parseInt(stockVal || 0),
    min_stock: parseInt(minStockVal || 0),
    category: categoryVal !== null ? String(categoryVal) : "General",
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
    const ws = XLSX.utils.json_to_sheet([
      {
        Codigo: "PRUEBA01",
        Descripcion: "Producto de Ejemplo",
        "Precio Costo": 10.0,
        "Precio Venta": 15.0,
        "Precio Mayoreo": 12.5,
        Existencia: 10,
        "Inv. Minimo": 5,
        Departamento: "General",
      },
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
      return {
        Codigo: sku,
        Descripcion: p.name,
        "Precio Costo": parseFloat(p.cost_price || 0),
        "Precio Venta": parseFloat(p.price || 0),
        "Precio Mayoreo": parseFloat(p.wholesale_price || 0),
        Existencia: parseInt(p.stock || 0),
        "Inv. Minimo": parseInt(p.min_stock || 0),
        Departamento: productCategory,
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Adjust column widths
    const columnWidths = [
      { wch: 20 },
      { wch: 30 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
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
                      <th>Código</th>
                      <th>Producto</th>
                      <th>Costo</th>
                      <th>Precio</th>
                      <th>Existencia</th>
                      <th>Categoría</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappedPreview.slice(0, 10).map((product, index) => (
                      <tr key={index}>
                        <td>{product.barcode || "-"}</td>
                        <td>{product.name}</td>
                        <td>${Number(product.cost_price || 0).toFixed(2)}</td>
                        <td>${Number(product.price || 0).toFixed(2)}</td>
                        <td>{product.stock}</td>
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
