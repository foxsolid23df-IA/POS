import { formatearDinero, formatearFechaHora } from "./formatters";

const defaults = {
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
  show_logo: true,
  show_billing_section: true,
  qr_code_size: "medium",
};

const QR_SIZES = { small: 90, medium: 130, large: 170 };

const getSettings = (s) => ({ ...defaults, ...(s || {}) });

const calcSubtotalTax = (sale) => {
  const totalVal = parseFloat(sale.total) || 0;
  const sub = parseFloat(sale.subtotal);
  const taxAmt = parseFloat(sale.tax_amount);
  const taxRate = parseFloat(sale.tax_percentage);
  let subtotal = totalVal, taxAmount = 0;
  if (!isNaN(sub) && !isNaN(taxAmt)) {
    subtotal = sub; taxAmount = taxAmt;
  } else if (!isNaN(taxRate) && taxRate > 0) {
    subtotal = totalVal / (1 + taxRate / 100);
    taxAmount = totalVal - subtotal;
  }
  return { subtotal, taxAmount, taxRate: !isNaN(taxRate) ? taxRate : 0 };
};

const qrSizeToPx = (size) => QR_SIZES[size] || QR_SIZES.medium;

export const generateTicketHtml = (sale, settings, user, options = {}) => {
  const s = getSettings(settings);

  const isPreSale = options.isPreSale === true;
  const isCotizacion = !isPreSale && sale?.isCotizacion === true;

  const productosList = isPreSale
    ? (options.cartItems || [])
    : (sale?.productos || sale?.items || sale?.sale_items || []);

  const totalVal = isPreSale
    ? (parseFloat(options.total) || 0)
    : (parseFloat(sale?.total) || 0);

  const taxData = isPreSale
    ? (options.taxData || { subtotal: totalVal, taxAmount: 0, taxRate: 0 })
    : calcSubtotalTax(sale);

  const payments = isPreSale
    ? (options.payments || [])
    : (sale?.payments || []);

  const montoRecibido = isPreSale
    ? (parseFloat(options.montoRecibido) || 0)
    : (parseFloat(sale?.montoRecibido) || totalVal);

  const cambioTotal = isPreSale
    ? (parseFloat(options.cambio) || 0)
    : (payments.length > 0
      ? payments.reduce((acc, p) => acc + (parseFloat(p.change) || 0), 0)
      : (parseFloat(sale?.cambio) || 0));

  const folio = isPreSale
    ? (options.transactionId?.toString() || "N/A")
    : (sale?.id?.toString() || "N/A");

  const userName = isPreSale
    ? (user?.full_name || user?.name || "CAJERO")
    : (sale?.cashier_name || sale?.users?.name || user?.full_name || "USUARIO CAJERO");

  const totalArticulos = productosList.reduce((acc, p) => acc + (p.quantity || 1), 0);

  const footerMsg = isCotizacion
    ? "ESTE DOCUMENTO ES UNA COTIZACIÓN Y NO CONSTITUYE UN COMPROBANTE DE COMPRA. PRECIOS SUJETOS A CAMBIOS SIN PREVIO AVISO. VÁLIDA POR 7 DÍAS."
    : s.footer_message;

  let html = `<div class="ticket-venta">`;

  // ── HEADER ──
  html += `<div class="tv-header">`;
  if (s.show_logo && s.logo_url) {
    html += `<div class="tv-logo-wrap"><img src="${s.logo_url}" class="tv-logo" alt="Logo"></div>`;
  }
  html += `<div class="tv-business-name">${isCotizacion ? (s.business_name || "COTIZACIÓN") : s.business_name}</div>`;
  if (isCotizacion && s.business_name) {
    html += `<div class="tv-cotizacion-badge">*** COTIZACIÓN ***</div>`;
  }
  if (s.address) html += `<div class="tv-info">${s.address}</div>`;
  if (s.phone) html += `<div class="tv-info">${s.phone}</div>`;
  html += `</div>`;

  // ── META ──
  html += `<div class="tv-meta">`;
  html += `<div class="tv-meta-row"><span class="tv-meta-lbl">FOLIO:</span><span class="tv-meta-val">${folio}</span></div>`;
  html += `<div class="tv-meta-row"><span class="tv-meta-lbl">FECHA:</span><span class="tv-meta-val">${formatearFechaHora(isPreSale ? new Date() : (sale?.createdAt || sale?.created_at || new Date()))}</span></div>`;
  html += `<div class="tv-meta-row"><span class="tv-meta-lbl">CAJERO:</span><span class="tv-meta-val">${userName}</span></div>`;
  html += `</div>`;

  // ── ITEMS TABLE ──
  html += `<div class="tv-divider"></div>`;
  html += `<div class="tv-table-hdr"><span class="tv-th-cant">CANT</span><span class="tv-th-desc">DESCRIPCIÓN</span><span class="tv-th-total">TOTAL</span></div>`;
  html += `<div class="tv-divider tv-divider-sm"></div>`;
  html += `<div class="tv-items">`;
  productosList.forEach((p) => {
    html += `<div class="tv-item">`;
    html += `<span class="tv-item-cant">${p.quantity}${p.unit_sold ? " " + p.unit_sold : ""}</span>`;
    html += `<span class="tv-item-desc">${p.name || p.product_name || ""}</span>`;
    html += `<span class="tv-item-total">${formatearDinero(parseFloat(p.price) * parseFloat(p.quantity))}</span>`;
    html += `</div>`;
  });
  html += `</div>`;

  // ── SUMMARY ──
  html += `<div class="tv-divider"></div>`;
  html += `<div class="tv-summary">`;
  html += `<div class="tv-summary-articles">ARTÍCULOS: ${totalArticulos}</div>`;
  if (taxData.taxAmount > 0) {
    html += `<div class="tv-summary-row"><span class="tv-summary-lbl">SUBTOTAL</span><span class="tv-summary-val">${formatearDinero(taxData.subtotal)}</span></div>`;
    html += `<div class="tv-summary-row"><span class="tv-summary-lbl">IVA (${taxData.taxRate || 16}%)</span><span class="tv-summary-val">${formatearDinero(taxData.taxAmount)}</span></div>`;
  } else {
    html += `<div class="tv-summary-row"><span class="tv-summary-lbl">SUBTOTAL</span><span class="tv-summary-val">${formatearDinero(taxData.subtotal)}</span></div>`;
  }
  html += `<div class="tv-divider-double"></div>`;
  html += `<div class="tv-summary-row tv-total-row"><span class="tv-summary-lbl">TOTAL</span><span class="tv-summary-val">${formatearDinero(totalVal)}</span></div>`;

  if (!isCotizacion) {
    if (payments.length > 0) {
      payments.forEach((p) => {
        const lbl = payments.length > 1
          ? `PAGO (${(p.method || p.payment_method || "").toUpperCase()})`
          : "PAGO";
        html += `<div class="tv-summary-row"><span class="tv-summary-lbl">${lbl}</span><span class="tv-summary-val">${formatearDinero(p.received || p.amount)}</span></div>`;
      });
    } else if (!isPreSale) {
      html += `<div class="tv-summary-row"><span class="tv-summary-lbl">PAGO</span><span class="tv-summary-val">${formatearDinero(montoRecibido)}</span></div>`;
    }
    html += `<div class="tv-summary-row"><span class="tv-summary-lbl">CAMBIO</span><span class="tv-summary-val">${formatearDinero(cambioTotal)}</span></div>`;
  }

  html += `</div>`;

  // ── FOOTER ──
  html += `<div class="tv-divider"></div>`;
  html += `<div class="tv-footer">${footerMsg}</div>`;

  // ── BILLING SECTION ──
  const showBilling = !isPreSale && !isCotizacion && sale?.pin_facturacion && s.show_billing_section !== false;
  if (showBilling) {
    const qrPx = qrSizeToPx(s.qr_code_size);
    const billingUrl = ((import.meta.env.VITE_BILLING_PORTAL_URL || "https://pos-autofactura.vercel.app").replace(/\/$/, ""));
    const qrData = `${billingUrl}/?folio=${sale.id}&pin=${sale.pin_facturacion}`;
    const displayUrl = billingUrl.replace(/^https?:\/\//, "");

    html += `<div class="tv-divider"></div>`;
    html += `<div class="tv-billing-box">`;
    html += `<div class="tv-billing-title">¿FACTURAR ESTA COMPRA?</div>`;
    html += `<div class="tv-billing-qr-wrap"><img src="https://api.qrserver.com/v1/create-qr-code/?size=${qrPx}x${qrPx}&data=${encodeURIComponent(qrData)}" alt="QR" class="tv-billing-qr"></div>`;
    html += `<div class="tv-billing-row"><span class="tv-billing-lbl">FOLIO</span><span class="tv-billing-val">${folio}</span></div>`;
    html += `<div class="tv-billing-row"><span class="tv-billing-lbl">PIN</span><span class="tv-billing-val">${sale.pin_facturacion}</span></div>`;
    html += `<div class="tv-billing-hint">Escanea o ingresa al portal</div>`;
    html += `<div class="tv-billing-url">${displayUrl}</div>`;
    html += `</div>`;
    if (sale.ticket_uuid) {
      html += `<div class="tv-ticket-uuid">ID: ${sale.ticket_uuid}</div>`;
    }
  }

  html += `</div>`;
  return html;
};

export const wrapTicketForPrinting = (ticketHtml, settings) => {
  const s = getSettings(settings);
  const pw = s.paper_width === "80mm" ? "80mm" : "58mm";
  const fw = s.paper_width === "80mm" ? "302px" : "219px";
  const ff = s.font_family === "Sistema" ? "system-ui, -apple-system, sans-serif" : "Courier New, Courier, monospace";
  const fs = s.font_size || 13;

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Ticket</title>
<style>
  @media print {
    @page { size: ${pw} auto; margin: 0; }
    body { margin: 0; padding: 0; background: none !important; }
    .ticket-venta { width: 100% !important; margin: 0 !important; box-shadow: none !important; }
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: ${ff};
    font-size: ${fs}px;
    line-height: 1.35;
    color: #000;
    background: #fff;
  }
  .ticket-venta {
    width: ${fw};
    margin: ${s.margin || 0}px auto;
    padding: 4px 6px;
    font-weight: ${s.is_bold ? "bold" : "normal"};
  }

  /* HEADER */
  .tv-header { text-align: center; margin-bottom: 8px; }
  .tv-logo-wrap { margin-bottom: 4px; }
  .tv-logo { max-width: 100%; max-height: 90px; display: block; margin: 0 auto; }
  .tv-business-name { font-size: 1.25em; font-weight: bold; text-transform: uppercase; letter-spacing: 0.02em; }
  .tv-cotizacion-badge { font-size: 1.1em; font-weight: bold; margin-top: 2px; letter-spacing: 0.15em; }
  .tv-info { font-size: 0.95em; white-space: pre-line; margin-top: 1px; }

  /* META */
  .tv-meta { margin: 6px 0; font-size: 0.95em; text-transform: uppercase; }
  .tv-meta-row { display: flex; justify-content: space-between; padding: 0 0; }
  .tv-meta-lbl { font-weight: bold; flex-shrink: 0; }
  .tv-meta-val { text-align: right; }

  /* DIVIDERS */
  .tv-divider { border: none; border-top: 1px solid #000; margin: 6px 0; height: 0; }
  .tv-divider-sm { margin: 3px 0; opacity: 0.5; }
  .tv-divider-double { border: none; border-top: 3px double #000; margin: 8px 0 6px; height: 0; }

  /* TABLE */
  .tv-table-hdr { display: flex; font-size: 0.85em; font-weight: bold; text-transform: uppercase; padding: 2px 0; letter-spacing: 0.03em; }
  .tv-th-cant { width: 22%; text-align: left; }
  .tv-th-desc { width: 48%; text-align: left; }
  .tv-th-total { width: 30%; text-align: right; }

  .tv-items { margin-bottom: 4px; }
  .tv-item { display: flex; font-size: 0.95em; text-transform: uppercase; padding: 1px 0; align-items: flex-start; }
  .tv-item-cant { width: 22%; text-align: left; white-space: nowrap; }
  .tv-item-desc { width: 48%; text-align: left; word-break: break-word; padding-right: 4px; }
  .tv-item-total { width: 30%; text-align: right; white-space: nowrap; }

  /* SUMMARY */
  .tv-summary { margin: 2px 0; display: flex; flex-direction: column; align-items: flex-end; }
  .tv-summary-articles { width: 100%; text-align: center; font-size: 0.85em; margin-bottom: 6px; text-transform: uppercase; }
  .tv-summary-row { display: flex; justify-content: flex-end; width: 100%; padding: 1px 0; font-size: 0.95em; }
  .tv-summary-lbl { margin-right: 8px; text-align: right; white-space: nowrap; }
  .tv-summary-val { width: 40%; text-align: right; white-space: nowrap; }
  .tv-total-row { font-size: 1.2em; font-weight: bold; padding: 4px 0 2px; }

  /* FOOTER */
  .tv-footer { text-align: center; font-size: 0.9em; margin-top: 2px; white-space: pre-line; text-transform: uppercase; letter-spacing: 0.03em; }

  /* BILLING BOX */
  .tv-billing-box { border: 1.5px dashed #555; padding: 10px 8px; margin: 8px 0; text-align: center; border-radius: 2px; }
  .tv-billing-title { font-size: 0.9em; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px; }
  .tv-billing-qr-wrap { margin: 6px 0; display: flex; justify-content: center; }
  .tv-billing-qr { display: block; background: #fff; padding: 4px; border: 1px solid #ccc; }
  .tv-billing-row { display: flex; justify-content: center; gap: 8px; font-size: 0.9em; text-transform: uppercase; margin: 2px 0; }
  .tv-billing-lbl { font-weight: bold; }
  .tv-billing-val { font-weight: bold; letter-spacing: 0.1em; }
  .tv-billing-hint { font-size: 0.75em; margin-top: 6px; color: #555; text-transform: uppercase; letter-spacing: 0.05em; }
  .tv-billing-url { font-size: 0.7em; color: #555; word-break: break-all; margin-top: 2px; }
  .tv-ticket-uuid { text-align: center; font-size: 0.6em; color: #888; margin-top: 2px; }
</style>
</head><body>${ticketHtml}</body></html>`;
};
