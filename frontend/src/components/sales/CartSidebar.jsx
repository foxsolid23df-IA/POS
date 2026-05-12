import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [toasts, setToasts] = useState([]);
  
  // Cálculos básicos
  const subtotal = total / 1.16;
  const iva = total - subtotal;

  // Monitorear stock bajo para notificaciones
  useEffect(() => {
    carrito.forEach(item => {
      if (item.stock <= 5 && !toasts.find(t => t.id === item.id)) {
        const newToast = {
          id: item.id,
          name: item.name,
          stock: item.stock,
          timestamp: Date.now()
        };
        setToasts(prev => [...prev, newToast]);
        
        // Auto-eliminar toast después de 5 segundos
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== item.id));
        }, 5000);
      }
    });
  }, [carrito]);

  // Datos ficticios para el mini gráfico de tendencia (en producción vendrían de una API)
  const trendData = [30, 45, 25, 60, 40, 85, 50];
  const maxVal = Math.max(...trendData);
  const chartPoints = trendData.map((val, i) => `${i * 20},${60 - (val / maxVal) * 40}`).join(' ');

  return (
    <div className="cart-sidebar cart-sidebar-table-mode">
      {/* Notificaciones Toast */}
      <div className="cart-toasts-container">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div 
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              className="stock-toast warning"
            >
              <span className="material-symbols-outlined">warning</span>
              <div className="toast-content">
                <p className="toast-title">Stock Bajo</p>
                <p className="toast-desc">{toast.name}: {toast.stock} pzas</p>
              </div>
              <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header Superior del Carrito */}
      <div className="cart-sidebar-header">
        <div className="cart-sidebar-title">
          <div className="header-icon-main">
            <span className="material-symbols-outlined">shopping_cart_checkout</span>
          </div>
          <div className="header-text-main">
            <h3>Resumen de Venta</h3>
            <span className="terminal-id">ID: #TX-{new Date().getTime().toString().slice(-6)}</span>
          </div>
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
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="empty-icon-wrapper"
            >
              <span className="material-symbols-outlined">inbox</span>
            </motion.div>
            <p>Carrito vacío</p>
            <span className="empty-sub">Escanee productos para comenzar</span>
          </div>
        ) : (
          <>
            {/* Panel de Operador y Tendencia */}
            <div className="operator-mini-card">
              <div className="op-info">
                <div className="op-avatar">
                  {user?.full_name?.charAt(0) || 'O'}
                </div>
                <div className="op-details">
                  <span className="op-name">{user?.full_name || 'Operador'}</span>
                  <span className="op-role">Caja Activa</span>
                </div>
              </div>
              <div className="op-trend">
                <svg width="120" height="40" className="mini-chart">
                  <path 
                    d={`M 0,40 L ${chartPoints} L 120,40`} 
                    fill="url(#chartGradient)" 
                    opacity="0.2"
                  />
                  <polyline
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    points={chartPoints}
                  />
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="transparent" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="trend-label">Hoy: +15%</span>
              </div>
            </div>

            <div className="cart-table-container">
              <table className="cart-main-table">
                <thead>
                  <tr>
                    <th className="col-desc">Producto</th>
                    <th className="col-qty">Cant.</th>
                    <th className="col-price">Precio</th>
                    <th className="col-total">Total</th>
                    <th className="col-actions"></th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {carrito.map((item, index) => (
                      <motion.tr 
                        key={`${item.id}-${index}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className={`cart-row ${activeCartItemId === item.id ? 'active' : ''}`}
                        onClick={() => setActiveCartItemId(item.id)}
                      >
                        <td className="col-desc">
                          <div className="product-name-cell">
                            <span className="p-name">{item.name}</span>
                            {item.is_package && <span className="pack-badge">PACK</span>}
                            {item.stock <= 5 && <span className="low-stock-dot" title="Stock Bajo"></span>}
                          </div>
                        </td>
                        <td className="col-qty">
                          <div className="qty-controls">
                            <button 
                              className="qty-btn"
                              onClick={(e) => { e.stopPropagation(); cambiarCantidad(item.id, -1); }}
                            >
                              <span className="material-symbols-outlined">remove</span>
                            </button>
                            <span className="qty-value">{item.quantity}</span>
                            <button 
                              className="qty-btn"
                              onClick={(e) => { e.stopPropagation(); cambiarCantidad(item.id, 1); }}
                            >
                              <span className="material-symbols-outlined">add</span>
                            </button>
                          </div>
                        </td>
                        <td className="col-price">
                          {formatearDinero(item.price)}
                        </td>
                        <td className="col-total">
                          {formatearDinero(item.quantity * item.price)}
                        </td>
                        <td className="col-actions">
                          <button 
                            className="delete-btn"
                            onClick={(e) => { e.stopPropagation(); quitarProducto(item.id); }}
                          >
                            <span className="material-symbols-outlined">delete</span>
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </>
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
          <motion.div 
            key={total}
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="ct-summary-row ct-summary-total"
          >
            <span className="ct-summary-label">TOTAL</span>
            <span className="ct-summary-value">{formatearDinero(total)}</span>
          </motion.div>
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
          
          {isSupervising ? (
            <button
              onClick={() => setMostrarModalFondo(true)}
              className="ct-btn-primary"
              style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b' }}
              title="Abrir caja para iniciar ventas"
            >
              <span className="material-symbols-outlined">key</span>
              Abrir Caja
            </button>
          ) : (
            <button
              onClick={abrirModalPago}
              disabled={vendiendo || carrito.length === 0}
              className={`ct-btn-primary payment-pulse ${carrito.length === 0 ? "ct-btn-disabled" : ""}`}
              title="Proceder al pago (F12)"
            >
              <span className="material-symbols-outlined">payments</span>
              Pagar
              <kbd>F12</kbd>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CartSidebar;

