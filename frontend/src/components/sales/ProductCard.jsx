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

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onAddToCart(product, "PZA");
    }
  };

  return (
    <div
      className={`product-card ${isOutOfStock ? 'out-of-stock' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${name}, precio ${displayPrice}, ${stockText}`}
      onClick={() => onAddToCart(product, 'PZA')}
      onKeyDown={handleKeyDown}
      style={{
        opacity: isOutOfStock ? 0.6 : 1
      }}
    >
      <div 
        className="product-card-name" 
        title={name}
      >
        {name}
      </div>

        <div 
          className="product-card-price" 
          aria-label={`Precio: ${displayPrice}`}
        >
          {!isOutOfStock && (
            <div className="product-card-price-dot" />
          )}
          {displayPrice}
        </div>

        <span 
          className={stockClass} 
          aria-label={`Stock: ${stockText}`}
        >
          {stockText}
        </span>
    </div>
  );
};

export default ProductCard;