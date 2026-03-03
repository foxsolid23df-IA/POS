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
import { useProducts } from "../../contexts/ProductContext";

const EntradasModal = ({ show, onClose, onSuccess }) => {
  const { productos: allProducts } = useProducts();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cantidadEntrante, setCantidadEntrante] = useState("");
  const [cantidadMerma, setCantidadMerma] = useState("");
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

    const entrante = parseInt(cantidadEntrante) || 0;
    const merma = parseInt(cantidadMerma) || 0;

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
      await productService.registrarEntrada(
        selectedProduct.id,
        entrante,
        merma,
      );

      Swal.fire({
        icon: "success",
        title: "Entrada registrada",
        text: "El inventario se ha actualizado correctamente.",
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
          <h2>Registrar Entradas y Merma</h2>
          <p>
            Busque un producto para registrar la entrada del proveedor o piezas
            de intercambio.
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
                  <label>Cantidad que ingresa a la tienda</label>
                  <div className="input-with-hint">
                    <input
                      type="number"
                      min="0"
                      placeholder="Ej: 10"
                      value={cantidadEntrante}
                      onChange={(e) => setCantidadEntrante(e.target.value)}
                      disabled={isSubmitting}
                    />
                    <small>Sumará al total de existencia</small>
                  </div>
                </div>

                <div className="form-group error-input">
                  <label>Cantidad en intercambio (Merma)</label>
                  <div className="input-with-hint">
                    <input
                      type="number"
                      min="0"
                      placeholder="Ej: 2"
                      value={cantidadMerma}
                      onChange={(e) => setCantidadMerma(e.target.value)}
                      disabled={isSubmitting}
                    />
                    <small>Piezas devueltas al proveedor o dadas de baja</small>
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
