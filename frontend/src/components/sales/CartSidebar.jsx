import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { customerService } from '../../services/customerService';

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
  abrirModalPago,
  onCotizar,
  selectedCustomer,
  onSelectCustomer
}) => {
  const { activeStaff } = useAuth();
  const [toasts, setToasts] = useState([]);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddCreditLimit, setQuickAddCreditLimit] = useState('');
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const customerSearchRef = useRef(null);
  
  // Cálculos básicos - respetar configuración de impuestos
  const taxEnabled = user?.tax_enabled !== false;
  const subtotal = taxEnabled ? total / 1.16 : total;
  const iva = taxEnabled ? total - subtotal : 0;
  const totalPiezas = carrito.reduce((acc, item) => acc + item.quantity, 0);

  // Estado para controlar los avisos de stock bajo
  const [showLowStockWarning, setShowLowStockWarning] = useState(() => {
    const saved = localStorage.getItem('showLowStockWarning');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Guardar preferencia de aviso de stock
  useEffect(() => {
    localStorage.setItem('showLowStockWarning', JSON.stringify(showLowStockWarning));
  }, [showLowStockWarning]);

  // Monitorear stock bajo para notificaciones
  useEffect(() => {
    if (!showLowStockWarning) return;

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

  // Customer search debounce
  useEffect(() => {
    if (!customerSearch.trim()) { setCustomerResults([]); return; }
    const t = setTimeout(async () => {
      setSearchingCustomers(true);
      try {
        const res = await customerService.search(customerSearch.trim());
        setCustomerResults(res || []);
      } catch { setCustomerResults([]); }
      setSearchingCustomers(false);
    }, 300);
    return () => clearTimeout(t);
  }, [customerSearch]);

  // Cerrar búsqueda al hacer clic fuera
  useEffect(() => {
    const h = (e) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target)) {
        setShowCustomerSearch(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

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
          </div>
        </div>
        <div className="cart-sidebar-stats" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            onClick={() => setShowLowStockWarning(!showLowStockWarning)}
            title={showLowStockWarning ? "Ocultar avisos de stock bajo" : "Mostrar avisos de stock bajo"}
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              padding: '4px',
              borderRadius: '50%',
              color: showLowStockWarning ? '#f59e0b' : 'var(--text-muted, #9ca3af)',
              backgroundColor: showLowStockWarning ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
              transition: 'all 0.2s ease'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>
              {showLowStockWarning ? 'notifications_active' : 'notifications_off'}
            </span>
          </button>
          <span className="item-count-badge">
            {totalPiezas} piezas
          </span>
        </div>
      </div>

      {/* Cuerpo central - Se expande para empujar el footer al fondo */}
      <div className="cart-sidebar-body">
        {carrito.length === 0 ? (
          <div className="empty-cart-modern-container">
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="empty-cart-icon-circle premium-float"
            >
              <span className="material-symbols-outlined">
                {isSupervising ? 'lock' : 'inbox'}
              </span>
            </motion.div>
            <p className="empty-cart-main-text">
              {isSupervising ? 'Caja Cerrada' : 'Carrito vacío'}
            </p>
            <p className="empty-cart-subtext">
              {isSupervising ? 'Abra la caja para comenzar a vender' : 'Escanee productos para comenzar'}
            </p>
            {isSupervising && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setMostrarModalFondo(true)}
                className="ct-btn-primary"
                style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b', marginTop: '1.5rem', padding: '0.75rem 2rem', flexDirection: 'row' }}
              >
                <span className="material-symbols-outlined">key</span>
                Abrir Caja
              </motion.button>
            )}
          </div>
        ) : (
          <>
            {/* Panel de Operador y Tendencia */}
            <div className="operator-mini-card">
              <div className="op-info">
                <div className="op-avatar relative">
                  {user?.full_name?.charAt(0) || 'O'}
                  <span className="op-status-dot"></span>
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

            {/* Rejilla de 4 Tarjetas de Información de Venta */}
            <div className="cart-info-grid">
              <div className="info-card info-card-cliente" style={{ cursor: 'pointer', position: 'relative' }} onClick={() => { if (!showCustomerSearch) setShowCustomerSearch(true); }}>
                <span className="material-symbols-outlined card-icon">contact_mail</span>
                <div className="card-texts">
                  <span className="card-label">Cliente</span>
                  <span className="card-value" style={selectedCustomer ? { color: '#059669', fontWeight: 700 } : {}}>
                    {selectedCustomer ? selectedCustomer.name : 'Público General'}
                  </span>
                </div>
                {selectedCustomer && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onSelectCustomer(null); }}
                    className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-gray-200 dark:bg-slate-700 text-gray-500 hover:bg-red-200 hover:text-red-600 transition-colors"
                    style={{ fontSize: '12px', lineHeight: 1 }}
                    title="Quitar cliente"
                  >
                    ×
                  </button>
                )}
                {showCustomerSearch && (
                  <div
                    ref={customerSearchRef}
                    className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl p-2 max-h-64 overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      autoFocus
                      placeholder="Buscar cliente..."
                      className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 mb-2"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                    />
                    {searchingCustomers && <p className="text-xs text-gray-400 p-2">Buscando...</p>}
                    {customerResults.length === 0 && customerSearch.trim() && !searchingCustomers && (
                      <p className="text-xs text-gray-400 p-2">Sin resultados</p>
                    )}
                    {customerResults.map(c => (
                      <button
                        key={c.id}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                        onClick={() => { onSelectCustomer(c); setShowCustomerSearch(false); setCustomerSearch(''); setCustomerResults([]); }}
                      >
                        <span className="font-semibold">{c.name}</span>
                        {c.rfc && <span className="text-xs text-gray-400 ml-2">{c.rfc}</span>}
                      </button>
                    ))}
                    <button
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors mt-1"
                      onClick={() => setShowQuickAdd(true)}
                    >
                      + Agregar Cliente Nuevo
                    </button>
                  </div>
                )}
              </div>
              {showQuickAdd && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl p-3" onClick={(e) => e.stopPropagation()}>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">Nuevo Cliente</p>
                  <input
                    type="text"
                    autoFocus
                    placeholder="Nombre *"
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 mb-2"
                    value={quickAddName}
                    onChange={(e) => setQuickAddName(e.target.value)}
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Límite de crédito (opcional)"
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 mb-2 font-mono"
                    value={quickAddCreditLimit}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9.]/g, '');
                      const parts = raw.split('.');
                      if (parts.length > 2) return;
                      if (parts[1] && parts[1].length > 2) return;
                      setQuickAddCreditLimit(raw);
                    }}
                    onFocus={() => setQuickAddCreditLimit(prev => prev ? prev.replace(/[^0-9.]/g, '') : '')}
                    onBlur={() => {
                      setQuickAddCreditLimit(prev => {
                        if (!prev) return prev;
                        const num = parseFloat(prev.replace(/[^0-9.]/g, ''));
                        if (isNaN(num)) return prev;
                        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                      });
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowQuickAdd(false); setQuickAddName(''); setQuickAddCreditLimit(''); }}
                      className="flex-1 py-2 text-xs text-gray-500 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      disabled={!quickAddName.trim() || quickAddSaving}
                      onClick={async () => {
                        if (!quickAddName.trim()) return;
                        setQuickAddSaving(true);
                        try {
                          const newCust = await customerService.create({
                            name: quickAddName.trim(),
                            credit_limit: parseFloat(quickAddCreditLimit.replace(/[^0-9.]/g, '')) || 0
                          });
                          onSelectCustomer(newCust);
                          setShowQuickAdd(false);
                          setShowCustomerSearch(false);
                          setQuickAddName('');
                          setQuickAddCreditLimit('');
                        } catch (err) {
                          console.error(err);
                        }
                        setQuickAddSaving(false);
                      }}
                      className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:bg-emerald-400 transition-colors"
                    >
                      {quickAddSaving ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                </div>
              )}
              <div className="info-card info-card-vendedor">
                <span className="material-symbols-outlined card-icon">person</span>
                <div className="card-texts">
                  <span className="card-label">Vendedor</span>
                  <span className="card-value">{activeStaff?.name || user?.full_name?.split(' ')[0] || "Vendedor"}</span>
                </div>
              </div>
              <div className="info-card info-card-piezas">
                <span className="material-symbols-outlined card-icon">inventory_2</span>
                <div className="card-texts">
                  <span className="card-label">Piezas</span>
                  <span className="card-value">{totalPiezas}</span>
                </div>
              </div>
              <div className="info-card info-card-metodo">
                <span className="material-symbols-outlined card-icon">payments</span>
                <div className="card-texts">
                  <span className="card-label">Método</span>
                  <span className="card-value">Efectivo</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer con totales y acciones */}
      <div className="cart-table-footer">
        <div className="cart-table-summary">
          {taxEnabled && (
            <>
              <div className="ct-summary-row">
                <span className="ct-summary-label">Subtotal</span>
                <span className="ct-summary-value">{formatearDinero(subtotal)}</span>
              </div>
              <div className="ct-summary-row">
                <span className="ct-summary-label">IVA (16%)</span>
                <span className="ct-summary-value">{formatearDinero(iva)}</span>
              </div>
            </>
          )}
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

          <button
            onClick={onCotizar}
            disabled={isSupervising || carrito.length === 0}
            className={`ct-btn-cotizar ${carrito.length === 0 ? "ct-btn-disabled" : ""}`}
            title="Generar cotización"
          >
            <span className="material-symbols-outlined">request_quote</span>
            Cotizar
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

