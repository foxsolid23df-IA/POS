import React, { useState, useMemo } from "react";
import { ProductCard } from "./ProductCard";

export const ProductGrid = ({
  products,
  onAddProduct,
  isLoading = false,
  searchQuery = "",
}) => {
  const [selectedCategory, setSelectedCategory] = useState("all");

  const categories = useMemo(() => {
    const uniqueCategories = new Set();
    products.forEach((p) => {
      if (p.category) {
        uniqueCategories.add(p.category);
      }
    });
    return ["all", ...Array.from(uniqueCategories).sort()];
  }, [products]);

  const filteredProducts = useMemo(() => {
    let filtered = products;

    if (selectedCategory !== "all") {
      filtered = filtered.filter((p) => p.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (p) =>
          p?.name?.toLowerCase().includes(query) ||
          p?.barcode?.toLowerCase().includes(query) ||
          p?.box_barcode?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [products, selectedCategory, searchQuery]);

  const isLowStock = (product) => {
    const stock = parseInt(product?.stock || 0);
    return stock > 0 && stock <= 5;
  };

  const hasBoxConfig = (product) => {
    return (
      parseInt(product?.box_units || 0) > 1 &&
      parseFloat(product?.box_price || 0) > 0
    );
  };

  const handleAddProduct = (product, unit = "PZA") => {
    onAddProduct(product, unit);
  };

  if (isLoading) {
    return (
      <div className="product-grid-container" role="status" aria-label="Cargando productos">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="product-card"
            style={{
              background: "#f1f5f9",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
            aria-hidden="true"
          >
            <div
              style={{
                width: "100%",
                height: "80px",
                background: "#e2e8f0",
                borderRadius: "0.5rem",
                marginBottom: "0.75rem",
              }}
            />
            <div
              style={{
                height: "14px",
                background: "#e2e8f0",
                borderRadius: "4px",
                marginBottom: "0.5rem",
              }}
            />
            <div
              style={{
                height: "20px",
                width: "60%",
                background: "#e2e8f0",
                borderRadius: "4px",
              }}
            />
          </div>
        ))}
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </div>
    );
  }

  if (filteredProducts.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "3rem 1rem",
          textAlign: "center",
        }}
        role="status"
        aria-live="polite"
      >
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: "3rem",
            color: "#cbd5e1",
            marginBottom: "1rem",
          }}
          aria-hidden="true"
        >
          search_off
        </span>
        <p style={{ color: "#64748b", fontSize: "0.875rem", fontWeight: 500 }}>
          {searchQuery
            ? `No se encontraron productos para "${searchQuery}"`
            : selectedCategory !== "all"
            ? "No hay productos en esta categoría"
            : "No hay productos disponibles"}
        </p>
        {selectedCategory !== "all" && (
          <button
            onClick={() => setSelectedCategory("all")}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
            aria-label="Ver todos los productos"
          >
            Ver todos los productos
          </button>
        )}
      </div>
    );
  }

  return (
    <section aria-label="Catálogo de productos">
      <div className="product-grid-header">
        <span className="product-count-badge" aria-live="polite">
          {filteredProducts.length} producto{filteredProducts.length !== 1 ? "s" : ""}
        </span>

        {categories.length > 1 && (
          <div
            className="category-filters"
            role="group"
            aria-label="Filtrar por categoría"
          >
            {categories.map((cat) => (
              <button
                key={cat}
                className={`category-chip ${selectedCategory === cat ? "active" : ""}`}
                onClick={() => setSelectedCategory(cat)}
                aria-pressed={selectedCategory === cat}
                type="button"
              >
                {cat === "all" ? "Todos" : cat}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className="product-grid-container"
        role="list"
        aria-label="Productos disponibles"
      >
        {filteredProducts.map((product) => (
          <div key={product.id} role="listitem">
            <ProductCard
              product={product}
              onAddToCart={handleAddProduct}
              isLowStock={isLowStock(product)}
              hasBoxConfiguration={hasBoxConfig(product)}
            />
          </div>
        ))}
      </div>
    </section>
  );
};

export default ProductGrid;