import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { salesService } from "../../services/salesService";
import { returnService } from "../../services/returnService";
import { printerService } from "../../services/printerService";
import { useAuth } from "../../hooks/useAuth";
import { useSettings } from "../../contexts/SettingsContext";
import { formatearDinero, formatearFechaHora } from "../../utils";
import { generateTicketHtml } from "../../utils/ticketFormatter";
import { isWebAdminMode } from "../../utils/appMode";
import "./Orders.css";

const ROWS_PER_PAGE = 25;
const REPLACEMENT_TICKET_STORAGE_KEY = "nexum:replacement-ticket";

const toLocalDateStr = (date) => {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatFolio = (id) => `#${id}`;

const DATE_PRESETS = {
  today: { label: "Hoy", getRange: () => {
    const now = new Date();
    return { from: toLocalDateStr(now), to: toLocalDateStr(now) };
  }},
  yesterday: { label: "Ayer", getRange: () => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return { from: toLocalDateStr(y), to: toLocalDateStr(y) };
  }},
  last7: { label: "Últimos 7 días", getRange: () => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 6);
    return { from: toLocalDateStr(from), to: toLocalDateStr(to) };
  }},
  thisMonth: { label: "Este mes", getRange: () => {
    const now = new Date();
    return { from: toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1)), to: toLocalDateStr(now) };
  }},
};

const CREDIT_STATUS_LABELS = {
  pendiente: { label: 'Pendiente', class: 'pending' },
  parcial:   { label: 'Parcial',   class: 'partial' },
  pagado:    { label: 'Pagado',    class: 'paid' },
  vencido:   { label: 'Vencido',   class: 'overdue' },
};

const getPaymentMethod = (sale) => {
  if (sale.sale_type === 'credit') return "credito";
  const method = (sale.metodoPago || sale.payment_method || "").toLowerCase();
  if (method === "múltiple" || method === "multiple") return "múltiple";
  if (method === "efectivo" || method === "cash") return "efectivo";
  if (method === "tarjeta" || method === "card" || method === "debito") return "tarjeta";
  if (method === "transferencia" || method === "transfer") return "transferencia";
  if (method === "credito") return "credito";
  return "otro";
};

const getPaymentChipClass = (method) => {
  switch (method) {
    case "efectivo": return "cash";
    case "tarjeta": return "card";
    case "transferencia": return "transfer";
    case "credito": return "credit";
    default: return "otro";
  }
};

export const Orders = () => {
  const navigate = useNavigate();
  const { user, validateMasterPin } = useAuth();
  const { ticketSettings } = useSettings();
  const webAdminMode = isWebAdminMode();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activePreset, setActivePreset] = useState(null);
  const [activePaymentFilter, setActivePaymentFilter] = useState(null);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [returningOrderId, setReturningOrderId] = useState(null);
  const [page, setPage] = useState(0);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const filteredOrders = useMemo(() => {
    let result = [...orders];

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      result = result.filter((o) => {
        const idMatch = o.id?.toString().includes(term);
        const folioMatch = o.folio?.toString().toLowerCase().includes(term);
        const pinMatch = o.pin_facturacion?.toLowerCase().includes(term);
        const nameMatch = o.users?.name?.toLowerCase().includes(term);
        const totalMatch = o.total?.toString().includes(term);
        const barcodeMatch = o.sale_items?.some((item) =>
          item.barcode?.toLowerCase().includes(term)
        );
        return idMatch || folioMatch || pinMatch || nameMatch || totalMatch || barcodeMatch;
      });
    }

    if (dateFrom || dateTo) {
      result = result.filter((o) => {
        const localDate = toLocalDateStr(o.created_at);
        if (dateFrom && localDate < dateFrom) return false;
        if (dateTo && localDate > dateTo) return false;
        return true;
      });
    }

    if (activePaymentFilter) {
      result = result.filter((o) => getPaymentMethod(o) === activePaymentFilter);
    }

    return result;
  }, [orders, searchTerm, dateFrom, dateTo, activePaymentFilter]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredOrders.length / ROWS_PER_PAGE)), [filteredOrders.length]);

  useEffect(() => {
    if (page >= totalPages) {
      setPage(Math.max(0, totalPages - 1));
    }
  }, [totalPages, page]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const filters = {};
    if (dateFrom) {
      try {
        const d = new Date(`${dateFrom}T00:00:00`);
        filters.createdAfter = d.toISOString();
      } catch (e) {
        console.error("Invalid dateFrom:", dateFrom);
      }
    }
    if (dateTo) {
      try {
        const d = new Date(`${dateTo}T23:59:59.999`);
        filters.createdBefore = d.toISOString();
      } catch (e) {
        console.error("Invalid dateTo:", dateTo);
      }
    }
    if (debouncedSearchTerm.trim()) {
      filters.searchTerm = debouncedSearchTerm.trim();
    }

    salesService.getSales(500, filters)
      .then((data) => {
        if (!cancelled) {
          setOrders(data || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Error al cargar órdenes");
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [dateFrom, dateTo, debouncedSearchTerm]);

  const handlePresetClick = useCallback((key) => {
    if (activePreset === key) {
      setActivePreset(null);
      setDateFrom("");
      setDateTo("");
      return;
    }
    setActivePreset(key);
    const range = DATE_PRESETS[key].getRange();
    setDateFrom(range.from);
    setDateTo(range.to);
  }, [activePreset]);

  const handleClearFilters = useCallback(() => {
    setSearchTerm("");
    setDateFrom("");
    setDateTo("");
    setActivePreset(null);
    setActivePaymentFilter(null);
    setPage(0);
  }, []);

  const paginatedOrders = useMemo(() => {
    const start = page * ROWS_PER_PAGE;
    return filteredOrders.slice(start, start + ROWS_PER_PAGE);
  }, [filteredOrders, page]);

  const metrics = useMemo(() => {
    const totalVentas = filteredOrders.length;
    let totalEfectivo = 0;
    let totalTarjetaTransferencia = 0;
    let totalCredito = 0;
    let saldoPendiente = 0;

    filteredOrders.forEach((o) => {
      const amount = parseFloat(o.total) || 0;
      const method = getPaymentMethod(o);
      if (method === "efectivo") {
        totalEfectivo += amount;
      } else if (method === "tarjeta" || method === "transferencia") {
        totalTarjetaTransferencia += amount;
      } else if (method === "credito") {
        totalCredito += amount;
        saldoPendiente += parseFloat(o.balance) || 0;
      }
    });

    return { totalVentas, totalEfectivo, totalTarjetaTransferencia, totalCredito, saldoPendiente };
  }, [filteredOrders]);

  const handleReprint = useCallback(async (order) => {
    try {
      printerService.printSaleTicketFast(order, ticketSettings, user, {
        paperWidth: ticketSettings?.paper_width || "58mm",
      });
    } catch (err) {
      console.error("[Orders] Error al reimprimir ticket:", err);
    }
  }, [ticketSettings, user]);

  const handleCopyToCurrentSale = useCallback(async (order) => {
    if (!order?.id) return;

    if (webAdminMode) {
      await Swal.fire(
        "Solo lectura en web admin",
        "Copiar un ticket a venta actual solo esta disponible en el POS local.",
        "info",
      );
      return;
    }

    if (order.sale_status === "cancelled" || order.sale_status === "returned") {
      await Swal.fire("Venta ya procesada", "No se puede copiar una venta cancelada o devuelta.", "info");
      return;
    }

    if (order.sale_type === "credit") {
      await Swal.fire(
        "No disponible para credito",
        "Por ahora solo se pueden reemplazar tickets de venta normal.",
        "info",
      );
      return;
    }

    const items = order.sale_items || order.items || order.productos || [];
    if (items.length === 0) {
      await Swal.fire("Ticket sin productos", "No hay partidas para copiar a la venta actual.", "warning");
      return;
    }

    sessionStorage.setItem(
      REPLACEMENT_TICKET_STORAGE_KEY,
      JSON.stringify({
        sale: order,
        copied_at: new Date().toISOString(),
      }),
    );
    setSelectedOrder(null);
    navigate("/ventas");
  }, [navigate, webAdminMode]);

  const handleCancelSale = useCallback(async (order) => {
    if (!order?.id || returningOrderId) return;

    if (webAdminMode) {
      await Swal.fire(
        "Solo lectura en web admin",
        "Cancelar o devolver ventas registra movimientos de caja y solo esta disponible en el POS local.",
        "info",
      );
      return;
    }

    if (order.sale_status === "cancelled" || order.sale_status === "returned") {
      await Swal.fire("Venta ya procesada", "Esta venta ya fue cancelada o devuelta.", "info");
      return;
    }

    const authorization = await Swal.fire({
      title: "Autorizacion requerida",
      text: "Ingresa el PIN maestro para cancelar o devolver este ticket.",
      input: "password",
      inputLabel: "PIN maestro",
      inputPlaceholder: "PIN maestro",
      inputAttributes: {
        autocapitalize: "off",
        autocomplete: "off",
        inputmode: "numeric",
      },
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Autorizar",
      cancelButtonText: "Volver",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      preConfirm: async (pin) => {
        try {
          await validateMasterPin(pin);
          return true;
        } catch (err) {
          Swal.showValidationMessage(err.message || "PIN maestro incorrecto");
          return false;
        }
      },
    });

    if (!authorization.isConfirmed) {
      return;
    }

    const reason = "Cancelacion de venta";
    const defaultRefundAmount = parseFloat(order.paid_amount ?? order.total ?? 0) || 0;

    try {
      setReturningOrderId(order.id);
      await returnService.cancelSaleWithRestock({
        saleId: order.id,
        reason,
        refundAmount: null,
        restock: true,
      });

      const updatedOrder = {
        ...order,
        sale_status: "cancelled",
        cancellation_reason: reason,
        refunded_amount: defaultRefundAmount,
      };

      setOrders((prev) => prev.map((item) => item.id === order.id ? updatedOrder : item));
      setSelectedOrder(updatedOrder);
      await Swal.fire("Listo", "Venta cancelada/devolucion registrada correctamente.", "success");
    } catch (err) {
      console.error("[Orders] Error al cancelar/devolver venta:", err);
      await Swal.fire("Error", err.message || "No se pudo cancelar la venta.", "error");
    } finally {
      setReturningOrderId(null);
    }
  }, [returningOrderId, validateMasterPin, webAdminMode]);

  const renderSkeleton = () => (
    <div className="orders-skeleton">
      {Array.from({ length: 6 }).map((_, i) => (
        <div className="skeleton-row" key={i}>
          <div className="skeleton-block" style={{ width: "3rem" }} />
          <div className="skeleton-block" style={{ width: "60%" }} />
          <div className="skeleton-block" style={{ width: "5rem" }} />
          <div className="skeleton-block" style={{ width: "5rem" }} />
          <div className="skeleton-block" style={{ width: "4rem" }} />
        </div>
      ))}
    </div>
  );

  const renderEmpty = () => (
    <div className="orders-empty">
      <span className="material-icons-outlined orders-empty-icon">receipt_long</span>
      <div className="orders-empty-title">
        {searchTerm || dateFrom || activePaymentFilter
          ? "No se encontraron órdenes"
          : "Aún no hay órdenes registradas"}
      </div>
      <div className="orders-empty-sub">
        {searchTerm || dateFrom || activePaymentFilter
          ? "Intenta con otros filtros de búsqueda"
          : "Las ventas realizadas aparecerán aquí"}
      </div>
    </div>
  );

  const renderModal = () => {
    if (!selectedOrder) return null;
    const order = selectedOrder;
    const items = order.sale_items || order.items || order.productos || [];
    const method = getPaymentMethod(order);
    const methodChipClass = getPaymentChipClass(method);
    const totalVal = parseFloat(order.total) || 0;
    const isCancelled = order.sale_status === "cancelled" || order.sale_status === "returned";

    const subtotalStored = parseFloat(order.subtotal);
    const taxAmountStored = parseFloat(order.tax_amount);
    const taxRate = parseFloat(order.tax_percentage);

    let displaySubtotal = totalVal;
    let displayTax = 0;
    if (!isNaN(subtotalStored) && !isNaN(taxAmountStored)) {
      displaySubtotal = subtotalStored;
      displayTax = taxAmountStored;
    } else if (!isNaN(taxRate) && taxRate > 0) {
      displaySubtotal = totalVal / (1 + taxRate / 100);
      displayTax = totalVal - displaySubtotal;
    }

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedOrder(null)}>
        <div className="order-modal-wrap" onClick={(e) => e.stopPropagation()}>
          <div className="order-modal-header">
            <div className="order-modal-title-group">
              <span className="order-modal-eyebrow">Detalle de Orden</span>
              <h3 className="order-modal-title">Orden {formatFolio(order.id)}</h3>
              {isCancelled && (
                <span className="credit-status-badge overdue" style={{ width: "fit-content", marginTop: "0.35rem" }}>
                  Cancelada
                </span>
              )}
            </div>
            <button className="order-modal-close" onClick={() => setSelectedOrder(null)}>
              <span className="material-icons-outlined text-[18px]">close</span>
            </button>
          </div>

          <div className="order-modal-body">
              <div className="modal-summary-grid">
                <div className="modal-summary-card accent">
                  <span className="modal-summary-label">Total</span>
                  <span className="modal-summary-value">{formatearDinero(totalVal)}</span>
                </div>
                <div className="modal-summary-card">
                  <span className="modal-summary-label">Método de Pago</span>
                  <span className={`payment-badge ${methodChipClass}`} style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    {method === "múltiple" ? "Múltiple" : method === "credito" ? "Crédito" : method.charAt(0).toUpperCase() + method.slice(1)}
                  </span>
                  {order.sale_type === 'credit' && order.credit_status && (
                    <span className={`credit-status-badge ${CREDIT_STATUS_LABELS[order.credit_status]?.class || ''}`} style={{ marginTop: '0.35rem', fontSize: '0.65rem' }}>
                      {CREDIT_STATUS_LABELS[order.credit_status]?.label || order.credit_status}
                    </span>
                  )}
                </div>
                <div className="modal-summary-card">
                  <span className="modal-summary-label">Subtotal</span>
                  <span className="modal-summary-value">{formatearDinero(displaySubtotal)}</span>
                </div>
                <div className="modal-summary-card">
                  <span className="modal-summary-label">{displayTax > 0 ? `IVA (${taxRate || 16}%)` : "Impuestos"}</span>
                  <span className="modal-summary-value">{formatearDinero(displayTax)}</span>
                </div>
                {order.sale_type === 'credit' && (
                  <>
                    <div className="modal-summary-card">
                      <span className="modal-summary-label">Abonado</span>
                      <span className="modal-summary-value">{formatearDinero(order.paid_amount || 0)}</span>
                    </div>
                    <div className="modal-summary-card accent-orange">
                      <span className="modal-summary-label">Saldo Pendiente</span>
                      <span className="modal-summary-value">{formatearDinero(order.balance || 0)}</span>
                    </div>
                  </>
                )}
              </div>

            <div className="modal-folio-bar">
              <div className="folio-info-group">
                <div className="folio-item">
                  <span className="folio-item-label">Folio</span>
                  <span className="folio-item-value">{formatFolio(order.id)}</span>
                </div>
                <div className="folio-item">
                  <span className="folio-item-label">Fecha</span>
                  <span className="folio-item-value">{formatearFechaHora(order.created_at)}</span>
                </div>
                {order.pin_facturacion && (
                  <div className="folio-item">
                    <span className="folio-item-label">PIN Facturación</span>
                    <span className="folio-item-value pin">{order.pin_facturacion}</span>
                  </div>
                )}
                {order.sale_type === 'credit' && (
                  <div className="folio-item">
                    <span className="folio-item-label">Cliente</span>
                    <span className="folio-item-value">{order.customers?.name || order.customer_id || '—'}</span>
                  </div>
                )}
              </div>
            </div>

            {isCancelled && order.cancellation_reason && (
              <div className="modal-folio-bar">
                <div className="folio-info-group">
                  <div className="folio-item">
                    <span className="folio-item-label">Motivo</span>
                    <span className="folio-item-value">{order.cancellation_reason}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="modal-products-header">
              <span className="modal-products-title">Productos ({items.length})</span>
            </div>

            <div className="modal-products-table">
              <div className="modal-table-head">
                <span>Producto</span>
                <span>Cant.</span>
                <span>Precio</span>
                <span>Total</span>
              </div>
              {items.map((item, idx) => (
                <div className="modal-table-row" key={idx}>
                  <div className="modal-col-name">
                    {item.name || item.product_name}
                    {item.barcode && <span className="modal-col-barcode">{item.barcode}</span>}
                  </div>
                  <div className="modal-col-qty">{item.quantity} {item.unit_sold || ""}</div>
                  <div className="modal-col-price">{formatearDinero(item.price)}</div>
                  <div className="modal-col-total">{formatearDinero((item.price || 0) * (item.quantity || 1))}</div>
                </div>
              ))}
            </div>

            <div className="ticket-preview-section">
              <div className="ticket-preview-label">
                <span className="material-icons-outlined">receipt</span>
                Vista previa del ticket
              </div>
              <div className="ticket-preview-paper">
                <div className="ticket-preview-content" dangerouslySetInnerHTML={{
                  __html: generateTicketHtml(order, ticketSettings, user)
                }} />
              </div>
            </div>
          </div>

          <div className="order-modal-footer">
            <button className="modal-btn secondary" onClick={() => setSelectedOrder(null)}>
              <span className="material-icons-outlined">close</span>
              Cerrar
            </button>
            {webAdminMode ? (
              <span className="text-xs font-bold text-slate-500">
                Modo web admin: orden solo lectura.
              </span>
            ) : (
              <>
                <button className="modal-btn print" onClick={() => handleReprint(order)}>
                  <span className="material-icons-outlined">print</span>
                  Reimprimir Ticket
                </button>
                {!isCancelled && (
                  <button
                    className="modal-btn primary"
                    onClick={() => handleCopyToCurrentSale(order)}
                  >
                    <span className="material-icons-outlined">content_copy</span>
                    Copiar a venta actual
                  </button>
                )}
                {!isCancelled && (
                  <button
                    className="modal-btn secondary protected-danger"
                    onClick={() => handleCancelSale(order)}
                    disabled={returningOrderId === order.id}
                    title="Requiere PIN maestro"
                  >
                    <span className="material-icons-outlined">lock</span>
                    {returningOrderId === order.id ? "Registrando..." : "Cancelar / Devolver"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <div className="orders-page">
        <div className="orders-empty">
          <span className="material-icons-outlined orders-empty-icon" style={{ color: '#ef4444' }}>error_outline</span>
          <div className="orders-empty-title">Error al cargar órdenes</div>
          <div className="orders-empty-sub">{error}</div>
          <button className="orders-btn" style={{ marginTop: '1rem' }} onClick={() => window.location.reload()}>
            <span className="material-icons-outlined">refresh</span>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="orders-page">
      <div className="orders-header">
        <div className="orders-header-inner">
          <div className="orders-title-group">
            <span className="orders-eyebrow">Nexum POS</span>
            <h1 className="orders-title">Órdenes</h1>
            <p className="orders-subtitle">
              {orders.length} {orders.length === 1 ? "transacción" : "transacciones"} registradas
            </p>
          </div>

          <div className="orders-metrics">
            <div className="metric-card accent-green">
              <span className="metric-card-label">Ventas</span>
              <span className="metric-card-value">{metrics.totalVentas}</span>
            </div>
            <div className="metric-card accent-blue">
              <span className="metric-card-label">Efectivo</span>
              <span className="metric-card-value">{formatearDinero(metrics.totalEfectivo)}</span>
            </div>
            <div className="metric-card accent-violet">
              <span className="metric-card-label">Tarjeta / Transfer</span>
              <span className="metric-card-value">{formatearDinero(metrics.totalTarjetaTransferencia)}</span>
            </div>
            <div className="metric-card accent-credit">
              <span className="metric-card-label">Crédito</span>
              <span className="metric-card-value">{formatearDinero(metrics.totalCredito)}</span>
              {metrics.saldoPendiente > 0 && (
                <span className="metric-card-sub">Saldo: {formatearDinero(metrics.saldoPendiente)}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="orders-filters">
        <div className="orders-filters-inner">
          <div className="filters-row">
            <div className="preset-chips">
              {Object.entries(DATE_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  className={`preset-chip ${activePreset === key ? "active" : ""}`}
                  onClick={() => handlePresetClick(key)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="orders-search-wrap">
              <span className="material-icons-outlined orders-search-icon">search</span>
              <input
                type="text"
                className="orders-search-input"
                placeholder="Buscar por folio, código, PIN, cliente, monto..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
              />
            </div>
          </div>

          <div className="filters-row">
            <div className="payment-chips">
              <button
                className={`payment-chip all ${activePaymentFilter === null ? "active" : ""}`}
                onClick={() => { setActivePaymentFilter(null); setPage(0); }}
              >
                Todos
              </button>
              <button
                className={`payment-chip cash ${activePaymentFilter === "efectivo" ? "active" : ""}`}
                onClick={() => { setActivePaymentFilter(activePaymentFilter === "efectivo" ? null : "efectivo"); setPage(0); }}
              >
                Efectivo
              </button>
              <button
                className={`payment-chip card ${activePaymentFilter === "tarjeta" ? "active" : ""}`}
                onClick={() => { setActivePaymentFilter(activePaymentFilter === "tarjeta" ? null : "tarjeta"); setPage(0); }}
              >
                Tarjeta
              </button>
              <button
                className={`payment-chip transfer ${activePaymentFilter === "transferencia" ? "active" : ""}`}
                onClick={() => { setActivePaymentFilter(activePaymentFilter === "transferencia" ? null : "transferencia"); setPage(0); }}
              >
                Transferencia
              </button>
              <button
                className={`payment-chip credit ${activePaymentFilter === "credito" ? "active" : ""}`}
                onClick={() => { setActivePaymentFilter(activePaymentFilter === "credito" ? null : "credito"); setPage(0); }}
              >
                Crédito
              </button>
            </div>

            <div className="date-range-group">
              <span className="date-range-label">Desde</span>
              <input
                type="date"
                className="orders-date-input"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setActivePreset(null); setPage(0); }}
              />
              <span className="date-range-label">Hasta</span>
              <input
                type="date"
                className="orders-date-input"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setActivePreset(null); setPage(0); }}
              />
            </div>

            {(searchTerm || dateFrom || dateTo || activePaymentFilter) && (
              <button className="orders-btn" onClick={handleClearFilters} title="Limpiar filtros">
                <span className="material-icons-outlined">clear_all</span>
                Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="orders-content">
        <div className="orders-content-inner">
          {loading ? (
            renderSkeleton()
          ) : paginatedOrders.length === 0 ? (
            renderEmpty()
          ) : (
            <>
              <div className="orders-table-head">
                <span>Folio</span>
                <span>Fecha / Hora</span>
                <span>Productos</span>
                <span>Pago</span>
                <span>Total</span>
                <span className="credit-col-head">Crédito</span>
              </div>

              <div className="orders-list">
                {paginatedOrders.map((order) => {
                  const method = getPaymentMethod(order);
                  const items = order.sale_items || order.items || order.productos || [];
                  const firstItem = items[0];
                  const extraCount = items.length - 1;
                  const totalVal = parseFloat(order.total) || 0;

                  return (
                    <div
                      className="order-row"
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                    >
                      <div className="order-folio">
                        <span className="order-folio-num">{formatFolio(order.id)}</span>
                        <span className="order-folio-label">Folio</span>
                      </div>

                      <div className="order-datetime">
                        <span className="order-date">
                          {new Date(order.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                        </span>
                        <span className="order-time">
                          {new Date(order.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      <div className="order-products">
                        <span className="order-products-main">
                          {firstItem ? (firstItem.name || firstItem.product_name) : "—"}
                        </span>
                        {extraCount > 0 && (
                          <span>y {extraCount} más</span>
                        )}
                      </div>

                      <span className={`payment-badge ${getPaymentChipClass(method)}`}>
                        {method === "múltiple" ? "Múltiple" : method === "credito" ? "Crédito" : method}
                      </span>

                      <span className="order-total">{formatearDinero(totalVal)}</span>

                      {order.sale_type === 'credit' && order.credit_status ? (
                        <span className={`credit-status-badge ${CREDIT_STATUS_LABELS[order.credit_status]?.class || ''}`}>
                          {CREDIT_STATUS_LABELS[order.credit_status]?.label || order.credit_status}
                          {parseFloat(order.balance) > 0 && (
                            <span className="credit-balance-sub">{formatearDinero(order.balance)}</span>
                          )}
                        </span>
                      ) : (
                        <span className="credit-col-empty">—</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="orders-pagination">
                  <div className="pagination-nav">
                    <button
                      className="page-btn"
                      disabled={page === 0}
                      onClick={() => setPage(0)}
                      title="Primera página"
                    >
                      <span className="material-icons-outlined">first_page</span>
                    </button>
                    <button
                      className="page-btn"
                      disabled={page === 0}
                      onClick={() => setPage(page - 1)}
                    >
                      <span className="material-icons-outlined">chevron_left</span>
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i;
                      } else if (page < 2) {
                        pageNum = i;
                      } else if (page > totalPages - 3) {
                        pageNum = totalPages - 5 + i;
                      } else {
                        pageNum = page - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          className={`page-btn ${page === pageNum ? "active" : ""}`}
                          onClick={() => setPage(pageNum)}
                        >
                          {pageNum + 1}
                        </button>
                      );
                    })}
                    <button
                      className="page-btn"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage(page + 1)}
                    >
                      <span className="material-icons-outlined">chevron_right</span>
                    </button>
                    <button
                      className="page-btn"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage(totalPages - 1)}
                      title="Última página"
                    >
                      <span className="material-icons-outlined">last_page</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selectedOrder && renderModal()}
    </div>
  );
};

export default Orders;
