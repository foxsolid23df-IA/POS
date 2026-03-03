import React, { forwardRef } from "react";
import { formatearDinero, formatearFechaHora } from "../../utils";
import { useSettings } from "../../contexts/SettingsContext";
import "./TicketVenta.css";

// Componente para mostrar el ticket de venta (formato clásico monospaced)
const TicketVenta = forwardRef(({ venta }, ref) => {
  const { ticketSettings } = useSettings();

  if (!venta) return null;

  const settings = ticketSettings || {
    business_name: "TICKET DE VENTA",
    address: "",
    phone: "",
    logo_url: "",
    footer_message: "GRACIAS POR SU COMPRA",
    font_size: 13,
    paper_width: "58mm",
    font_family: "monospace",
    is_bold: false,
    margin: 0,
  };

  const ticketStyles = {
    fontSize: `${settings.font_size || 13}px`,
    fontWeight: settings.is_bold ? "bold" : "normal",
    fontFamily:
      settings.font_family === "Sistema"
        ? "system-ui, sans-serif"
        : "monospace",
    margin: `${settings.margin || 0}px auto`,
    width: settings.paper_width === "80mm" ? "302px" : "219px",
  };

  const productosList = venta.productos || venta.items || [];
  const totalArticulos = productosList.reduce(
    (acc, p) => acc + (p.quantity || 1),
    0,
  );

  // Calculate pagos and cambio safely
  const isMultiple = venta.payments && venta.payments.length > 0;
  let cambioTotal = isMultiple
    ? venta.payments.reduce((acc, p) => acc + (parseFloat(p.change) || 0), 0)
    : parseFloat(venta.cambio) || 0;

  const dividerString =
    settings.paper_width === "80mm"
      ? "======================================================"
      : "=================================";

  const userName = venta.cashier_name || venta.users?.name || "USUARIO CAJERO";
  const folio = venta.id ? venta.id.toString() : "N/A";

  return (
    <div
      ref={ref}
      className={`ticket-venta ${settings.paper_width === "80mm" ? "ticket-80mm" : "ticket-58mm"}`}
      style={ticketStyles}
    >
      <div className="ticket-header">
        {settings.logo_url && (
          <div className="ticket-logo-container">
            <img src={settings.logo_url} alt="Logo" className="ticket-logo" />
          </div>
        )}
        <div className="ticket-title">
          {settings.business_name || "TICKET DE VENTA"}
        </div>
        {settings.address && (
          <div className="ticket-info">{settings.address}</div>
        )}
        {settings.phone && <div className="ticket-info">{settings.phone}</div>}
      </div>

      <div className="ticket-datetime">
        {formatearFechaHora(venta.createdAt || new Date())}
      </div>

      <div className="ticket-meta">
        <div className="ticket-meta-row">
          <span className="ticket-meta-label">CAJERO:</span>
          <span className="ticket-meta-value">{userName}</span>
        </div>
        <div className="ticket-meta-row">
          <span className="ticket-meta-label">FOLIO:</span>
          <span className="ticket-meta-value">{folio}</span>
        </div>
      </div>

      <div className="ticket-table-header">
        <div className="ticket-col-cant">CANT.</div>
        <div className="ticket-col-desc">DESCRIPCION</div>
        <div className="ticket-col-imp">IMPORTE</div>
      </div>
      <div className="ticket-divider-eq">{dividerString}</div>

      <div className="ticket-items">
        {productosList.map((producto, idx) => (
          <div key={idx} className="ticket-item">
            <div className="ticket-item-cant">{producto.quantity}</div>
            <div className="ticket-item-desc">{producto.name}</div>
            <div className="ticket-item-imp">
              {formatearDinero(producto.price * parseFloat(producto.quantity))}
            </div>
          </div>
        ))}
      </div>

      <div className="ticket-summary">
        <div className="ticket-summary-articles">
          NO. DE ARTICULOS: {totalArticulos}
        </div>

        <div className="ticket-summary-row ticket-summary-bold">
          <span className="ticket-summary-label">TOTAL:</span>
          <span className="ticket-summary-value">
            {formatearDinero(venta.total)}
          </span>
        </div>

        {/* Payments breakdown */}
        {venta.payments &&
          venta.payments.length > 0 &&
          venta.payments.map((pago, idx) => (
            <div key={idx} className="ticket-summary-row ticket-summary-bold">
              <span className="ticket-summary-label">
                {venta.payments.length > 1
                  ? `PAGO CON (${pago.method?.toUpperCase() || pago.payment_method?.toUpperCase()}):`
                  : "PAGO CON:"}
              </span>
              <span className="ticket-summary-value">
                {formatearDinero(pago.received || pago.amount)}
              </span>
            </div>
          ))}
        {(!venta.payments || venta.payments.length === 0) &&
          venta.montoRecibido >= 0 && (
            <div className="ticket-summary-row ticket-summary-bold">
              <span className="ticket-summary-label">PAGO CON:</span>
              <span className="ticket-summary-value">
                {formatearDinero(venta.montoRecibido || venta.total)}
              </span>
            </div>
          )}

        <div className="ticket-summary-row ticket-summary-bold">
          <span className="ticket-summary-label">SU CAMBIO:</span>
          <span className="ticket-summary-value">
            {formatearDinero(cambioTotal)}
          </span>
        </div>
      </div>

      <div className="ticket-footer">{settings.footer_message}</div>
    </div>
  );
});

export default TicketVenta;
