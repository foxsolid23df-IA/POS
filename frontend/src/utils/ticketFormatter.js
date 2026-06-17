import { formatearDinero } from "./formatters";
import { generateQrDataUrl } from "./qrCode";

const defaults = {
  business_name: "TICKET DE VENTA",
  owner_name: "",
  rfc: "",
  curp: "",
  email: "",
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
  show_business_name: true,
  show_owner_name: true,
  show_rfc: true,
  show_curp: true,
  show_email: true,
  show_address: true,
  show_phone: true,
  show_footer: true,
  show_billing_section: true,
  qr_code_size: "medium",
};

const QR_SIZES = { small: 90, medium: 130, large: 170 };

const getSettings = (s) => ({ ...defaults, ...(s || {}) });

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const safeImageSrc = (value, options = {}) => {
  const { allowRemote = true } = options;
  const src = String(value || "").trim();
  if (!src) return "";
  if (/^data:image\//i.test(src)) return escapeHtml(src);
  if (allowRemote && /^(https?:|blob:)/i.test(src)) return escapeHtml(src);
  return "";
};

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

const pad2 = (value) => String(value).padStart(2, "0");

const getSaleDate = (sale, isPreSale) =>
  new Date(isPreSale ? new Date() : (sale?.createdAt || sale?.created_at || new Date()));

const formatTicketDate = (date) =>
  `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;

const formatTicketTime = (date) => {
  let hours = date.getHours();
  const minutes = pad2(date.getMinutes());
  const suffix = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${pad2(hours)}:${minutes} ${suffix}`;
};

const formatQty = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
};

const getLocalTerminalName = () => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem("pos_terminal_name") || "";
    }
  } catch {
    return "";
  }
  return "";
};

const getItemName = (item) => item.name || item.product_name || "PRODUCTO";

const getItemCode = (item) =>
  item.sku ||
  item.product_sku ||
  item.metadata?.sku ||
  item.barcode ||
  item.product_code ||
  item.product_id ||
  "";

const getItemImporte = (item) => {
  const explicitTotal = parseFloat(item.total);
  if (Number.isFinite(explicitTotal)) return explicitTotal;
  return (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 0);
};

const getItemUnitText = (item) => {
  const unit = String(item.unit_sold || item.unit || "PZA").toUpperCase();
  const factor = parseFloat(item.conversion_factor || item.stock_multiplier || item.box_units || 1);
  if (unit === "CAJA") {
    return `CAJA(S) C/${formatQty(factor || 1)} PZA`;
  }
  return unit;
};

const getPaymentLabel = (payment, fallback = "EFECTIVO") => {
  const method = String(payment?.method || payment?.payment_method || fallback || "EFECTIVO").toUpperCase();
  if (method === "CASH") return "EFECTIVO";
  if (method === "CARD") return "TARJETA";
  return method;
};

export const generateTicketHtml = (sale, settings, user, options = {}) => {
  const s = getSettings(settings);
  const fastPrint = options.fastPrint === true;

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

  const saleDate = getSaleDate(sale, isPreSale);
  const terminalName =
    sale?.terminals?.name ||
    sale?.terminal_name ||
    options.terminalName ||
    getLocalTerminalName() ||
    userName;
  const customerName =
    sale?.customers?.name ||
    sale?.customer?.name ||
    sale?.customerName ||
    sale?.customer_name ||
    options.customerName ||
    "MOSTRADOR";
  const platformName = sale?.platform || sale?.plataforma || "Local";
  const totalPartidas = productosList.length;
  const totalPaquetes = productosList.reduce((acc, p) => {
    const unit = String(p.unit_sold || p.unit || "PZA").toUpperCase();
    return acc + (unit === "CAJA" ? (parseFloat(p.quantity) || 0) : 0);
  }, 0);
  const totalArticulos = productosList.reduce((acc, p) => {
    const qty = parseFloat(p.quantity) || 0;
    const unit = String(p.unit_sold || p.unit || "PZA").toUpperCase();
    return acc + (unit === "CAJA" ? 0 : qty);
  }, 0);

  const footerMsg = isCotizacion
    ? "ESTE DOCUMENTO ES UNA COTIZACIÓN Y NO CONSTITUYE UN COMPROBANTE DE COMPRA. PRECIOS SUJETOS A CAMBIOS SIN PREVIO AVISO. VÁLIDA POR 7 DÍAS."
    : s.footer_message;

  let html = `<div class="ticket-venta">`;

  // ── HEADER ──
  html += `<div class="tv-header">`;
  const logoSrc = safeImageSrc(s.logo_url, { allowRemote: !fastPrint });
  if (s.show_logo && logoSrc) {
    html += `<div class="tv-logo-wrap"><img src="${logoSrc}" class="tv-logo" alt="Logo"></div>`;
  }
  if (s.show_business_name !== false && s.business_name) {
    html += `<div class="tv-business-name">${escapeHtml(isCotizacion ? (s.business_name || "COTIZACIÓN") : s.business_name)}</div>`;
  }
  if (isCotizacion && s.business_name) {
    html += `<div class="tv-cotizacion-badge">*** COTIZACIÓN ***</div>`;
  }
  if (s.show_owner_name !== false && s.owner_name) {
    html += `<div class="tv-info tv-owner-name">${escapeHtml(s.owner_name)}</div>`;
  }
  if (s.show_rfc !== false && s.rfc) {
    const hasRfcPrefix = /^[Rr]\.?[Ff]\.?[Cc]\.?\b/.test(s.rfc.trim());
    const rfcLabel = hasRfcPrefix ? "" : "R.F.C. ";
    html += `<div class="tv-info tv-rfc">${escapeHtml(rfcLabel + s.rfc)}</div>`;
  }
  if (s.show_curp !== false && s.curp) {
    const hasCurpPrefix = /^[Cc]\.?[Uu]\.?[Rr]\.?[Pp]\.?\b/.test(s.curp.trim());
    const curpLabel = hasCurpPrefix ? "" : "C.U.R.P. ";
    html += `<div class="tv-info tv-curp">${escapeHtml(curpLabel + s.curp)}</div>`;
  }
  if (s.show_address !== false && s.address) {
    html += `<div class="tv-info">${escapeHtml(s.address)}</div>`;
  }
  if (s.show_phone !== false && s.phone) {
    const hasPhonePrefix = /^[Tt]el\b/.test(s.phone.trim());
    const phoneLabel = hasPhonePrefix ? "" : "Tel.";
    html += `<div class="tv-info">${escapeHtml(phoneLabel + s.phone)}</div>`;
  }
  if (s.show_email !== false && s.email) {
    html += `<div class="tv-info tv-email">${escapeHtml(s.email)}</div>`;
  }
  html += `</div>`;

  html += `<div class="tv-doc-title">*** ${escapeHtml(isCotizacion ? "COTIZACION" : "VENTA")} ***</div>`;

  // ── META ──
  html += `<div class="tv-meta">`;
  html += `<div class="tv-meta-grid">`;
  html += `<div class="tv-meta-left">`;
  html += `<div><span>Folio:</span> ${escapeHtml(folio)}</div>`;
  html += `<div><span>Fecha:</span> ${escapeHtml(formatTicketDate(saleDate))}</div>`;
  html += `<div><span>Plataforma:</span> ${escapeHtml(platformName)}</div>`;
  html += `</div>`;
  html += `<div class="tv-meta-right">`;
  html += `<div><span>Cajero:</span> ${escapeHtml(userName)}</div>`;
  html += `<div><span>Hora:</span> ${escapeHtml(formatTicketTime(saleDate))}</div>`;
  html += `</div>`;
  html += `</div>`;
  html += `<div class="tv-client"><span>CLIENTE:</span> ${escapeHtml(customerName)}</div>`;
  html += `</div>`;

  // ── ITEMS TABLE ──
  html += `<div class="tv-divider"></div>`;
  html += `<div class="tv-table-hdr"><span class="tv-th-cant">CANT.</span><span class="tv-th-precio">PRECIO</span><span class="tv-th-importe">IMPORTE</span></div>`;
  html += `<div class="tv-divider tv-divider-sm"></div>`;
  html += `<div class="tv-items">`;
  productosList.forEach((p) => {
    const code = getItemCode(p);
    html += `<div class="tv-item">`;
    html += `<div class="tv-item-main">`;
    html += `<span class="tv-item-cant">${escapeHtml(formatQty(p.quantity || 1))}</span>`;
    html += `<span class="tv-item-precio">${escapeHtml(getItemUnitText(p))}</span>`;
    html += `<span class="tv-item-importe">${formatearDinero(getItemImporte(p))}</span>`;
    html += `</div>`;
    html += `<div class="tv-item-desc">${escapeHtml(getItemName(p))}</div>`;
    html += `<div class="tv-item-subline"><span></span><span>${formatearDinero(parseFloat(p.price) || 0)}</span></div>`;
    if (code) {
      html += `<div class="tv-item-code">COD: ${escapeHtml(code)}</div>`;
    }
    html += `</div>`;
  });
  html += `</div>`;

  // ── SUMMARY ──
  html += `<div class="tv-divider"></div>`;
  html += `<div class="tv-summary">`;
  if (taxData.taxAmount > 0) {
    html += `<div class="tv-summary-row"><span class="tv-summary-lbl">SUBTOTAL</span><span class="tv-summary-val">${formatearDinero(taxData.subtotal)}</span></div>`;
    html += `<div class="tv-summary-row"><span class="tv-summary-lbl">IVA (${taxData.taxRate || 16}%)</span><span class="tv-summary-val">${formatearDinero(taxData.taxAmount)}</span></div>`;
  }
  html += `<div class="tv-summary-row tv-total-row"><span class="tv-summary-lbl">TOTAL</span><span class="tv-summary-val">${formatearDinero(totalVal)}</span></div>`;

  if (!isCotizacion) {
    if (payments.length > 0) {
      payments.forEach((p) => {
        const lbl = getPaymentLabel(p, sale?.metodoPago || "EFECTIVO");
        html += `<div class="tv-summary-row"><span class="tv-summary-lbl">${escapeHtml(lbl)}</span><span class="tv-summary-val">${formatearDinero(p.received || p.amount)}</span></div>`;
      });
    } else if (!isPreSale) {
      html += `<div class="tv-summary-row"><span class="tv-summary-lbl">${escapeHtml(getPaymentLabel(null, sale?.metodoPago || "EFECTIVO"))}</span><span class="tv-summary-val">${formatearDinero(montoRecibido)}</span></div>`;
    }
    html += `<div class="tv-summary-row"><span class="tv-summary-lbl">CAMBIO</span><span class="tv-summary-val">${formatearDinero(cambioTotal)}</span></div>`;
  }

  html += `</div>`;

  // ── FOOTER ──
  html += `<div class="tv-divider"></div>`;
  html += `<div class="tv-counts">PART: ${formatQty(totalPartidas)} &nbsp; PAQ: ${formatQty(totalPaquetes)} &nbsp; ARTS: ${formatQty(totalArticulos)} &nbsp; PESO: 0.00Kg m3: 0.00</div>`;
  html += `<div class="tv-attended">LE ATENDIO: ${escapeHtml(terminalName)}</div>`;
  if (s.show_footer !== false) {
    html += `<div class="tv-footer">${escapeHtml(footerMsg)}</div>`;
  }

  // ── BILLING SECTION ──
  const showBilling = !isPreSale && !isCotizacion && sale?.pin_facturacion && s.show_billing_section !== false;
  if (showBilling) {
    const qrPx = qrSizeToPx(s.qr_code_size);
    const billingUrl = ((import.meta.env.VITE_BILLING_PORTAL_URL || "https://pos-autofactura.vercel.app").replace(/\/$/, ""));
    const qrData = `${billingUrl}/?folio=${sale.id}&pin=${sale.pin_facturacion}`;
    const displayUrl = billingUrl.replace(/^https?:\/\//, "");
    const qrDataUrl = safeImageSrc(
      options.billingQrDataUrl || sale.billing_qr_data_url || generateQrDataUrl(qrData),
      { allowRemote: false }
    );

    html += `<div class="tv-divider"></div>`;
    html += `<div class="tv-billing-box">`;
    html += `<div class="tv-billing-title">¿FACTURAR ESTA COMPRA?</div>`;
    if (qrDataUrl) {
      html += `<div class="tv-billing-qr-wrap"><img src="${qrDataUrl}" width="${qrPx}" height="${qrPx}" alt="QR" class="tv-billing-qr"></div>`;
    }
    html += `<div class="tv-billing-row"><span class="tv-billing-lbl">FOLIO</span><span class="tv-billing-val">${escapeHtml(folio)}</span></div>`;
    html += `<div class="tv-billing-row"><span class="tv-billing-lbl">PIN</span><span class="tv-billing-val">${escapeHtml(sale.pin_facturacion)}</span></div>`;
    html += `<div class="tv-billing-hint">Escanea o ingresa al portal</div>`;
    html += `<div class="tv-billing-url">${escapeHtml(displayUrl)}</div>`;
    html += `</div>`;
    if (sale.ticket_uuid) {
      html += `<div class="tv-ticket-uuid">ID: ${escapeHtml(sale.ticket_uuid)}</div>`;
    }
  }

  html += `</div>`;
  return html;
};

export const wrapTicketForPrinting = (ticketHtml, settings) => {
  const s = getSettings(settings);
  const printableTicketHtml = String(ticketHtml || "").replace(
    /<img\b[^>]*\bsrc\s*=\s*(["'])(https?:\/\/|blob:)[\s\S]*?\1[^>]*>/gi,
    ""
  );
  const pw = s.paper_width === "80mm" ? "80mm" : "58mm";
  const fw = s.paper_width === "80mm" ? "260px" : "188px";
  const ticketPadding = s.paper_width === "80mm" ? "3px 4px" : "3px";
  const userMargin = parseInt(s.margin, 10) || 0;
  const leftOffset = `${(s.paper_width === "80mm" ? 10 : 7) + userMargin}px`;
  const topOffset = `${userMargin}px`;
  const ff = s.font_family === "Sistema" ? "system-ui, -apple-system, sans-serif" : "Courier New, Courier, monospace";
  const fs = s.font_size || 13;

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Ticket</title>
<style>
  @media print {
    @page { size: ${pw} auto; margin: 0; }
    body { margin: 0; padding: 0; background: none !important; }
    .ticket-venta {
      width: ${fw} !important;
      max-width: ${fw} !important;
      margin: ${topOffset} 0 0 ${leftOffset} !important;
      padding: ${ticketPadding} !important;
      box-shadow: none !important;
    }
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
    max-width: ${fw};
    margin: ${topOffset} 0 0 ${leftOffset};
    padding: ${ticketPadding};
    font-weight: ${s.is_bold ? "bold" : "normal"};
  }

  /* HEADER */
  .tv-header { text-align: center; margin-bottom: 8px; }
  .tv-logo-wrap { margin-bottom: 4px; }
  .tv-logo { max-width: 100%; max-height: 90px; display: block; margin: 0 auto; }
  .tv-business-name { font-size: 1.25em; font-weight: bold; text-transform: uppercase; letter-spacing: 0.02em; }
  .tv-cotizacion-badge { font-size: 1.1em; font-weight: bold; margin-top: 2px; letter-spacing: 0.15em; }
  .tv-info { font-size: 0.95em; white-space: pre-line; margin-top: 1px; }
  .tv-doc-title { text-align: center; font-weight: bold; margin: 6px 0 4px; letter-spacing: 0.06em; }

  /* META */
  .tv-meta { margin: 6px 0; font-size: 0.82em; line-height: 1.2; }
  .tv-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .tv-meta span, .tv-client span { font-weight: bold; }
  .tv-meta-right { text-align: left; }
  .tv-client { margin-top: 2px; text-transform: uppercase; }

  /* DIVIDERS */
  .tv-divider { border: none; border-top: 1px dashed #000; margin: 5px 0; height: 0; }
  .tv-divider-sm { margin: 3px 0; }
  .tv-divider-double { border: none; border-top: 3px double #000; margin: 8px 0 6px; height: 0; }

  /* TABLE */
  .tv-table-hdr, .tv-item-main {
    display: grid;
    grid-template-columns: 17% 47% 36%;
    column-gap: 2px;
    align-items: baseline;
  }
  .tv-table-hdr { font-size: 0.78em; text-transform: uppercase; padding: 1px 0; }
  .tv-th-precio { text-align: left; }
  .tv-th-importe { text-align: right; }

  .tv-items { margin-bottom: 4px; }
  .tv-item { font-size: 0.82em; text-transform: uppercase; padding: 2px 0 4px; break-inside: avoid; }
  .tv-item-cant { text-align: right; padding-right: 3px; white-space: nowrap; }
  .tv-item-precio { text-align: left; word-break: break-word; }
  .tv-item-importe { text-align: right; white-space: nowrap; }
  .tv-item-desc { margin-left: 17%; padding-left: 2px; word-break: break-word; line-height: 1.18; }
  .tv-item-subline {
    display: grid;
    grid-template-columns: 17% 47% 36%;
    column-gap: 2px;
    line-height: 1.15;
  }
  .tv-item-subline span:last-child { grid-column: 2; text-align: left; white-space: nowrap; }
  .tv-item-code { margin-left: 17%; padding-left: 2px; line-height: 1.15; }

  /* SUMMARY */
  .tv-summary { margin: 2px 0; display: flex; flex-direction: column; align-items: flex-end; }
  .tv-summary-row { display: grid; grid-template-columns: 1fr 38%; width: 72%; padding: 1px 0; font-size: 0.9em; }
  .tv-summary-lbl { text-align: left; white-space: nowrap; }
  .tv-summary-val { text-align: right; white-space: nowrap; }
  .tv-total-row { font-weight: bold; padding-top: 2px; }

  /* FOOTER */
  .tv-counts { font-size: 0.82em; line-height: 1.2; }
  .tv-attended { font-size: 0.86em; margin-top: 8px; text-transform: uppercase; }
  .tv-footer { text-align: left; font-size: 0.86em; margin-top: 2px; white-space: pre-line; text-transform: uppercase; }

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
</head><body>${printableTicketHtml}</body></html>`;
};
