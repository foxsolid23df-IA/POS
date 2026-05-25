import React, { forwardRef } from "react";
import { useSettings } from "../../contexts/SettingsContext";
import { useAuth } from "../../hooks/useAuth";
import { generateTicketHtml } from "../../utils/ticketFormatter";
import "./TicketVenta.css";

const TicketVenta = forwardRef(({ venta }, ref) => {
  const { ticketSettings } = useSettings();
  const { user } = useAuth();

  if (!venta) return null;

  const html = generateTicketHtml(venta, ticketSettings, user);

  return (
    <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
  );
});

export default TicketVenta;
