import React, { forwardRef } from "react";
import { formatearDinero, formatearFechaHora } from "../../utils";
import { useSettings } from "../../contexts/SettingsContext";
import "./TicketVenta.css";

// Componente para mostrar el ticket de venta (simple y profesional)
const TicketVenta = forwardRef(({ venta }, ref) => {
  const { ticketSettings } = useSettings();

  if (!venta) return null;

  const settings = ticketSettings || {
    business_name: "Ticket de Venta",
    address: "",
    phone: "",
    logo_url: "",
    footer_message: "¡Gracias por su compra!",
    font_size: 12,
    paper_width: "58mm",
    font_family: "Sistema",
    is_bold: false,
    margin: 0,
  };

  const ticketStyles = {
    fontSize: `${settings.font_size}px`,
    fontWeight: settings.is_bold ? "bold" : "normal",
    fontFamily: settings.font_family === "Sistema" ? "inherit" : "monospace",
    margin: `${settings.margin}px auto`,
    width: settings.paper_width === "58mm" ? "100%" : "100%", // El CSS maneja el max-width
  };

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
          {settings.business_name || "Ticket de Venta"}
        </div>
        {settings.address && (
          <div className="ticket-info">{settings.address}</div>
        )}
        {settings.phone && <div className="ticket-info">{settings.phone}</div>}
        <div className="ticket-fecha">
          {formatearFechaHora(venta.createdAt)}
        </div>
        <div className="ticket-id">
          Caja: {venta.terminal_id?.substring(0, 8) || "N/A"}
        </div>
      </div>
      <div className="ticket-linea" />
      <div className="ticket-items">
        {venta.productos.map((producto, idx) => (
          <div key={idx} className="ticket-producto">
            <div className="ticket-producto-nombre">{producto.name}</div>
            <div className="ticket-producto-detalle">
              <span>
                {producto.quantity} x {formatearDinero(producto.price)}
              </span>
              <span>{formatearDinero(producto.price * producto.quantity)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="ticket-linea" />

      {venta.payments && venta.payments.length > 0 && (
        <div className="ticket-pagos">
          {venta.payments.map((pago, idx) => (
            <div key={idx} className="ticket-pago-row">
              <span className="capitalize">{pago.payment_method}:</span>
              <span>{formatearDinero(pago.amount)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="ticket-total">TOTAL: {formatearDinero(venta.total)}</div>

      <div className="ticket-linea" />
      <div className="ticket-footer">{settings.footer_message}</div>
    </div>
  );
});

export default TicketVenta;
