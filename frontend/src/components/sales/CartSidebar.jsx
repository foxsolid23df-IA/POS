import React from 'react';

const CartSidebar = ({
  carrito,
  activeCartItemId,
  setActiveCartItemId,
  stockDisplayMode,
  toggleStockDisplayMode,
  showTableDetails,
  toggleTableDetails,
  cambiarCantidad,
  quitarProducto,
  cambiarUnidadVenta,
  abrirModalEmpaque,
  tieneCajaConfigurada,
  formatStockDisplay,
  formatearDinero,
  user,
  total,
  isSupervising,
  vendiendo,
  setMostrarModalFondo,
  setMostrarModalPaqueteTodo,
  abrirModalPago
}) => {
  // Cálculos básicos
  const subtotal = total / 1.16;
  const iva = total - subtotal;

  return (
    <div className="cart-sidebar cart-sidebar-table-mode">
      {/* Header Superior del Carrito */}
      <div className="cart-sidebar-header">
        <div className="cart-sidebar-title">
          <span className="material-symbols-outlined">shopping_cart_checkout</span>
          <h3>Resumen de Venta</h3>
        </div>
        <div className="cart-sidebar-stats">
          <span className="item-count-badge">
            {carrito.reduce((acc, item) => acc + item.quantity, 0)} piezas
          </span>
        </div>
      </div>

      {/* Cuerpo central - Se expande para empujar el footer al fondo */}
      <div className="cart-sidebar-body">
        {carrito.length === 0 ? (
          <div className="cart-sidebar-empty">
            <span className="material-symbols-outlined">inbox</span>
            <p>Carrito vacío</p>
          </div>
        ) : (
          <div className="cart-sidebar-status">
            <div className="status-item">
              <span className="material-symbols-outlined">person</span>
              <span>{user?.full_name || 'Operador'}</span>
            </div>
            <div className="status-item">
              <span className="material-symbols-outlined">schedule</span>
              <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer con totales y acciones */}
      <div className="cart-table-footer">
        <div className="cart-table-summary">
          <div className="ct-summary-row">
            <span className="ct-summary-label">Subtotal</span>
            <span className="ct-summary-value">{formatearDinero(subtotal)}</span>
          </div>
          <div className="ct-summary-row">
            <span className="ct-summary-label">IVA (16%)</span>
            <span className="ct-summary-value">{formatearDinero(iva)}</span>
          </div>
          <div className="ct-summary-row ct-summary-total">
            <span className="ct-summary-label">TOTAL</span>
            <span className="ct-summary-value">{formatearDinero(total)}</span>
          </div>
        </div>

        <div className="ct-action-group">
          <button
            onClick={() => setMostrarModalPaqueteTodo(true)}
            disabled={isSupervising || carrito.length === 0}
            className={`ct-btn-secondary ${carrito.length === 0 ? "ct-btn-disabled" : ""}`}
            title="Empacar todos los productos"
          >
            <span className="material-symbols-outlined">package_2</span>
            Empacar Todo
          </button>
          
          <button
            onClick={abrirModalPago}
            disabled={vendiendo || carrito.length === 0}
            className={`ct-btn-primary ${carrito.length === 0 ? "ct-btn-disabled" : ""}`}
            title="Proceder al pago (F12)"
          >
            <span className="material-symbols-outlined">payments</span>
            Pagar
            <kbd>F12</kbd>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CartSidebar;
