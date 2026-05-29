import React, { useState, useEffect } from "react";
import {
  FiX,
  FiSearch,
  FiCheck,
  FiPackage,
  FiAlertCircle,
} from "react-icons/fi";
import Swal from "sweetalert2";
import "./EntradasModal.css";
import { productService } from "../../services/productService";
import { purchaseService } from "../../services/purchaseService";
import { useProducts } from "../../contexts/ProductContext";

const EntradasModal = ({ show, onClose, onSuccess }) => {
  const { productos: allProducts } = useProducts();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cantidadEntrante, setCantidadEntrante] = useState("");
  const [cantidadMerma, setCantidadMerma] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [purchaseUnit, setPurchaseUnit] = useState("PZA");
  const [conversionFactor, setConversionFactor] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [marginPercent, setMarginPercent] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Búsqueda local de productos al escribir
  useEffect(() => {
    if (!searchTerm) {
      setSearchResults([]);
      return;
    }

    const lowerTerm = searchTerm.toLowerCase();
    const matches = allProducts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(lowerTerm) ||
          (p.barcode && p.barcode.includes(searchTerm)),
      )
      .slice(0, 10); // Limitar a 10 resultados para no saturar

    setSearchResults(matches);
  }, [searchTerm, allProducts]);

  // Limpiar el estado al cerrar/abrir
  useEffect(() => {
    if (!show) {
      setSearchTerm("");
      setSearchResults([]);
      setSelectedProduct(null);
      setCantidadEntrante("");
      setCantidadMerma("");
      setSupplierName("");
      setInvoiceNumber("");
      setPurchaseUnit("PZA");
      setConversionFactor("1");
      setUnitCost("");
      setSalePrice("");
      setMarginPercent("");
      setNotes("");
    }
  }, [show]);

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setSearchTerm("");
    setSearchResults([]);
  };

  const handleDeselectProduct = () => {
    setSelectedProduct(null);
    setCantidadEntrante("");
    setCantidadMerma("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedProduct) {
      Swal.fire("Atención", "Debes seleccionar un producto primero", "warning");
      return;
    }

    const entrante = parseFloat(cantidadEntrante) || 0;
    const merma = parseFloat(cantidadMerma) || 0;
    const factor = Math.max(parseFloat(conversionFactor) || 1, 1);

    if (entrante === 0 && merma === 0) {
      Swal.fire(
        "Atención",
        "Ingresa una cantidad entrante o de merma mayor a 0",
        "warning",
      );
      return;
    }

    try {
      setIsSubmitting(true);
      if (entrante > 0) {
        await purchaseService.registerPurchase({
          supplierName: supplierName || selectedProduct.supplier || "Proveedor no especificado",
          invoiceNumber,
          notes,
          items: [{
            ...selectedProduct,
            product_id: selectedProduct.id,
            quantity: entrante,
            unit: purchaseUnit,
            conversion_factor: factor,
            unit_cost: unitCost,
            sale_price: salePrice,
            margin_percent: marginPercent,
          }],
        });
      }

      if (merma > 0) {
        await productService.registrarEntrada(selectedProduct.id, 0, merma);
      }

      Swal.fire({
        icon: "success",
        title: "Entrada registrada",
        text: "La entrada quedo registrada con inventario, costo y auditoria.",
        timer: 2000,
        showConfirmButton: false,
      });

      onSuccess(); // Llamar callback (ej. recargar data/cerrar)
      onClose();
    } catch (error) {
      console.error("Error al registrar entrada:", error);
      Swal.fire(
        "Error",
        error.message || "No se pudo registrar la entrada",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!show) return null;

  return (
    <div className="entradas-modal-overlay">
      <div className="entradas-modal-container">
        <div className="entradas-modal-header">
          <h2>Registrar Compra, Entrada y Merma</h2>
          <p>
            Busque un producto para registrar entrada de proveedor, costo,
            factura o piezas de intercambio.
          </p>
          <button
            className="entradas-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <FiX />
          </button>
        </div>

        <div className="entradas-modal-body">
          {!selectedProduct ? (
            <div className="entradas-search-section">
              <div className="entradas-search-input-wrapper">
                <FiSearch className="entradas-search-icon" />
                <input
                  type="text"
                  placeholder="Buscar producto por nombre o código de barras..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                  className="entradas-search-input"
                />
              </div>

              {searchResults.length > 0 && (
                <div className="entradas-search-results">
                  {searchResults.map((product) => (
                    <div
                      key={product.id}
                      className="entradas-search-result-item"
                      onClick={() => handleSelectProduct(product)}
                    >
                      <div className="result-img">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} />
                        ) : (
                          <FiPackage />
                        )}
                      </div>
                      <div className="result-info">
                        <div className="result-name">{product.name}</div>
                        <div className="result-meta">
                          Stock actual: {product.stock} | Precio: $
                          {parseFloat(product.price).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {searchTerm && searchResults.length === 0 && (
                <div className="entradas-no-results">
                  <FiAlertCircle className="no-results-icon" />
                  <p>No se encontraron productos similares a "{searchTerm}"</p>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="entradas-form">
              <div className="selected-product-card">
                <div className="selected-product-header">
                  <h3>Producto Seleccionado</h3>
                  <button
                    type="button"
                    className="change-product-btn"
                    onClick={handleDeselectProduct}
                    disabled={isSubmitting}
                  >
                    Cambiar producto
                  </button>
                </div>
                <div className="selected-product-details">
                  <div className="selected-img">
                    {selectedProduct.image_url ? (
                      <img
                        src={selectedProduct.image_url}
                        alt={selectedProduct.name}
                      />
                    ) : (
                      <FiPackage size={32} />
                    )}
                  </div>
                  <div className="selected-info">
                    <h4>{selectedProduct.name}</h4>
                    <div className="selected-stats">
                      <span className="stat-badge">
                        Existencia actual:{" "}
                        <strong>{selectedProduct.stock}</strong>
                      </span>
                      <span className="stat-badge error">
                        Merma acumulada:{" "}
                        <strong>{selectedProduct.merma || 0}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="entradas-inputs-row">
                <div className="form-group success-input">
                  <label>Cantidad comprada</label>
                  <div className="input-with-hint">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ej: 10"
                      value={cantidadEntrante}
                      onChange={(e) => setCantidadEntrante(e.target.value)}
                      disabled={isSubmitting}
                    />
                    <small>Se convierte a existencia base segun unidad</small>
                  </div>
                </div>

                <div className="form-group error-input">
                  <label>Cantidad en intercambio (Merma)</label>
                  <div className="input-with-hint">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ej: 2"
                      value={cantidadMerma}
                      onChange={(e) => setCantidadMerma(e.target.value)}
                      disabled={isSubmitting}
                    />
                    <small>Piezas devueltas al proveedor o dadas de baja</small>
                  </div>
                </div>
              </div>

              <div className="entradas-inputs-row">
                <div className="form-group">
                  <label>Proveedor</label>
                  <div className="input-with-hint">
                    <input
                      type="text"
                      placeholder="Ej: Aceros del Norte"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      disabled={isSubmitting}
                    />
                    <small>Queda en historial de compras</small>
                  </div>
                </div>

                <div className="form-group">
                  <label>Factura / Remision</label>
                  <div className="input-with-hint">
                    <input
                      type="text"
                      placeholder="Ej: F-1028"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      disabled={isSubmitting}
                    />
                    <small>Opcional</small>
                  </div>
                </div>
              </div>

              <div className="entradas-inputs-row">
                <div className="form-group">
                  <label>Unidad de entrada</label>
                  <div className="input-with-hint">
                    <select
                      value={purchaseUnit}
                      onChange={(e) => setPurchaseUnit(e.target.value)}
                      disabled={isSubmitting}
                    >
                      <option value="PZA">PZA</option>
                      <option value="CAJA">CAJA</option>
                      <option value="M">M</option>
                      <option value="KG">KG</option>
                      <option value="L">L</option>
                      <option value="PAQ">PAQ</option>
                      <option value="TRAMO">TRAMO</option>
                      <option value="ROLLO">ROLLO</option>
                      <option value="JGO">JGO</option>
                    </select>
                    <small>Ferreteria: caja, metro, kilo, litro, tramo</small>
                  </div>
                </div>

                <div className="form-group">
                  <label>Equivalencia base</label>
                  <div className="input-with-hint">
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      placeholder="Ej: 12"
                      value={conversionFactor}
                      onChange={(e) => setConversionFactor(e.target.value)}
                      disabled={isSubmitting}
                    />
                    <small>Ej: 1 caja = 12 piezas</small>
                  </div>
                </div>
              </div>

              <div className="entradas-inputs-row">
                <div className="form-group">
                  <label>Costo unitario</label>
                  <div className="input-with-hint">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ej: 45.50"
                      value={unitCost}
                      onChange={(e) => setUnitCost(e.target.value)}
                      disabled={isSubmitting}
                    />
                    <small>Costo por unidad de entrada</small>
                  </div>
                </div>

                <div className="form-group">
                  <label>Precio venta sugerido</label>
                  <div className="input-with-hint">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Opcional"
                      value={salePrice}
                      onChange={(e) => setSalePrice(e.target.value)}
                      disabled={isSubmitting}
                    />
                    <small>Actualiza precio si lo capturas</small>
                  </div>
                </div>
              </div>

              <div className="entradas-inputs-row">
                <div className="form-group">
                  <label>Margen %</label>
                  <div className="input-with-hint">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ej: 30"
                      value={marginPercent}
                      onChange={(e) => setMarginPercent(e.target.value)}
                      disabled={isSubmitting}
                    />
                    <small>Referencia para analisis de utilidad</small>
                  </div>
                </div>

                <div className="form-group">
                  <label>Notas</label>
                  <div className="input-with-hint">
                    <input
                      type="text"
                      placeholder="Lote, ubicacion, observaciones"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={isSubmitting}
                    />
                    <small>Opcional</small>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>

        <div className="entradas-modal-footer">
          <button
            type="button"
            className="entradas-btn-cancel"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="entradas-btn-submit"
            onClick={handleSubmit}
            disabled={!selectedProduct || isSubmitting}
          >
            {isSubmitting ? (
              "Registrando..."
            ) : (
              <>
                <FiCheck /> Registrar Entrada
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EntradasModal;
