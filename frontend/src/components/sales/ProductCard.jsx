import React from "react";
import { formatearDinero } from "../../utils";

export const ProductCard = ({
  product,
  onAddToCart,
  isLowStock = false,
  hasBoxConfiguration = false,
}) => {
  const {
    name,
    price,
    stock = 0,
    box_price,
  } = product;

  const displayPrice = formatearDinero(price);
  const displayBoxPrice = box_price ? formatearDinero(box_price) : null;

  const stockText = stock > 0
    ? `${stock} ${stock === 1 ? "pza" : "pzas"}`
    : "Agotado";

  const isOutOfStock = stock <= 0;

  let stockClass = "product-card-stock";
  if (isOutOfStock) stockClass += " out-of-stock";
  else if (isLowStock) stockClass += " low";

  const handleKeyDownPza = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onAddToCart(product, "PZA");
    }
  };

  const handleKeyDownCaja = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onAddToCart(product, "CAJA");
    }
  };

  if (hasBoxConfiguration && !isOutOfStock) {
    return (
      <div
        className={`product-card product-card-split ${isOutOfStock ? 'out-of-stock' : ''}`}
        style={{ opacity: isOutOfStock ? 0.6 : 1 }}
      >
        <div className="product-card-name" title={name}>
          {name}
        </div>

        <div className="product-card-split-buttons">
          <button
            type="button"
            className="product-card-btn product-card-btn-pza"
            onClick={(e) => { e.stopPropagation(); onAddToCart(product, 'PZA'); }}
            onKeyDown={handleKeyDownPza}
            aria-label={`Agregar ${name} como pieza, precio ${displayPrice}`}
          >
            <span className="product-card-btn-label">PZA</span>
            <span className="product-card-btn-price">{displayPrice}</span>
          </button>

          <button
            type="button"
            className="product-card-btn product-card-btn-caja"
            onClick={(e) => { e.stopPropagation(); onAddToCart(product, 'CAJA'); }}
            onKeyDown={handleKeyDownCaja}
            aria-label={`Agregar ${name} como caja, precio ${displayBoxPrice}`}
          >
            <span className="product-card-btn-label">CAJA</span>
            <span className="product-card-btn-price">{displayBoxPrice}</span>
          </button>
        </div>

        <span className={stockClass} aria-label={`Stock: ${stockText}`}>
          {stockText}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`product-card ${isOutOfStock ? 'out-of-stock' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${name}, precio ${displayPrice}, ${stockText}`}
      onClick={() => onAddToCart(product, 'PZA')}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAddToCart(product, "PZA");
        }
      }}
      style={{ opacity: isOutOfStock ? 0.6 : 1 }}
    >
      <div className="product-card-name" title={name}>
        {name}
      </div>

      <div className="product-card-price" aria-label={`Precio: ${displayPrice}`}>
        {!isOutOfStock && <div className="product-card-price-dot" />}
        {displayPrice}
      </div>

      <span className={stockClass} aria-label={`Stock: ${stockText}`}>
        {stockText}
      </span>
    </div>
  );
};

export default ProductCard;
