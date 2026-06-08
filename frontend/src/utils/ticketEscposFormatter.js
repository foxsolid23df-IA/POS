import { formatearDinero } from "./formatters";

const ESC = 0x1b;
const GS = 0x1d;

const defaults = {
  business_name: "TICKET DE VENTA",
  owner_name: "",
  rfc: "",
  curp: "",
  email: "",
  address: "",
  phone: "",
  footer_message: "GRACIAS POR SU COMPRA",
  paper_width: "58mm",
  show_business_name: true,
  show_owner_name: true,
  show_rfc: true,
  show_curp: true,
  show_email: true,
  show_address: true,
  show_phone: true,
  show_footer: true,
  show_billing_section: true,
};

const getSettings = (settings) => ({ ...defaults, ...(settings || {}) });

const getColumns = (settings) => (settings?.paper_width === "80mm" ? 42 : 32);

const normalizeText = (value) => String(value ?? "")
  .replace(/¿/g, "?")
  .replace(/¡/g, "!")
  .replace(/Ñ/g, "N")
  .replace(/ñ/g, "n")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^\x20-\x7E]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const pad2 = (value) => String(value).padStart(2, "0");

const formatDate = (value) => {
  const date = new Date(value || new Date());
  if (Number.isNaN(date.getTime())) return "";
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
};

const formatTime = (value) => {
  const date = new Date(value || new Date());
  if (Number.isNaN(date.getTime())) return "";
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

const formatQty = (value) => {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) return "0";
  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(2);
};

const getSaleDate = (sale) => sale?.createdAt || sale?.created_at || new Date();

const getItems = (sale) => sale?.productos || sale?.items || sale?.sale_items || [];

const getItemName = (item) => item?.name || item?.product_name || "PRODUCTO";

const getItemCode = (item) =>
  item?.sku ||
  item?.product_sku ||
  item?.metadata?.sku ||
  item?.barcode ||
  item?.product_code ||
  item?.product_id ||
  "";

const getItemTotal = (item) => {
  const explicitTotal = parseFloat(item?.total);
  if (Number.isFinite(explicitTotal)) return explicitTotal;
  return (parseFloat(item?.price) || 0) * (parseFloat(item?.quantity) || 0);
};

const getUnitText = (item) => {
  const unit = String(item?.unit_sold || item?.unit || "PZA").toUpperCase();
  const factor = parseFloat(item?.conversion_factor || item?.stock_multiplier || item?.box_units || 1);
  if (unit === "CAJA") return `CAJA C/${formatQty(factor || 1)}`;
  return unit;
};

const getPaymentLabel = (payment, fallback = "EFECTIVO") => {
  const method = String(payment?.method || payment?.payment_method || fallback || "EFECTIVO").toUpperCase();
  if (method === "CASH") return "EFECTIVO";
  if (method === "CARD") return "TARJETA";
  if (method === "TRANSFER") return "TRANSFERENCIA";
  return method;
};

const wrapLine = (text, columns) => {
  const clean = normalizeText(text);
  if (!clean) return [""];
  const words = clean.split(" ");
  const lines = [];
  let current = "";

  words.forEach((word) => {
    if (word.length > columns) {
      if (current) {
        lines.push(current);
        current = "";
      }
      for (let i = 0; i < word.length; i += columns) {
        lines.push(word.slice(i, i + columns));
      }
      return;
    }

    const next = current ? `${current} ${word}` : word;
    if (next.length > columns) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });

  if (current) lines.push(current);
  return lines.length ? lines : [""];
};

const center = (text, columns) => {
  const clean = normalizeText(text).slice(0, columns);
  const left = Math.max(0, Math.floor((columns - clean.length) / 2));
  return `${" ".repeat(left)}${clean}`;
};

const leftRight = (left, right, columns) => {
  const l = normalizeText(left);
  const r = normalizeText(right);
  const maxLeft = Math.max(0, columns - r.length - 1);
  const safeLeft = l.length > maxLeft ? l.slice(0, maxLeft) : l;
  const spaces = Math.max(1, columns - safeLeft.length - r.length);
  return `${safeLeft}${" ".repeat(spaces)}${r}`;
};

const separator = (columns) => "-".repeat(columns);

export const formatSaleToEscposText = (sale, settings, user, options = {}) => {
  const s = getSettings(settings);
  const columns = getColumns(s);
  const items = getItems(sale);
  const total = parseFloat(sale?.total ?? options.total ?? 0) || 0;
  const payments = sale?.payments || [];
  const saleDate = getSaleDate(sale);
  const cashier = sale?.cashier_name || sale?.users?.name || user?.full_name || user?.name || "CAJERO";
  const customer = sale?.customers?.name || sale?.customer?.name || sale?.customerName || sale?.customer_name || "MOSTRADOR";
  const folio = sale?.id?.toString() || options.transactionId?.toString() || "N/A";
  const lines = [];

  if (s.show_business_name !== false && s.business_name) lines.push(center(s.business_name, columns));
  if (s.show_owner_name !== false && s.owner_name) lines.push(center(s.owner_name, columns));
  if (s.show_rfc !== false && s.rfc) lines.push(center(`RFC ${s.rfc}`, columns));
  if (s.show_curp !== false && s.curp) lines.push(center(`CURP ${s.curp}`, columns));
  if (s.show_address !== false && s.address) wrapLine(s.address, columns).forEach((line) => lines.push(center(line, columns)));
  if (s.show_phone !== false && s.phone) lines.push(center(`Tel. ${s.phone}`, columns));
  if (s.show_email !== false && s.email) lines.push(center(s.email, columns));

  lines.push(separator(columns));
  lines.push(center("VENTA", columns));
  lines.push(leftRight(`Folio: ${folio}`, `Hora: ${formatTime(saleDate)}`, columns));
  lines.push(leftRight(`Fecha: ${formatDate(saleDate)}`, `Caja: ${cashier}`, columns));
  lines.push(`CLIENTE: ${normalizeText(customer).slice(0, Math.max(0, columns - 9))}`);
  lines.push(separator(columns));
  lines.push(leftRight("CANT / PRODUCTO", "IMPORTE", columns));
  lines.push(separator(columns));

  items.forEach((item) => {
    const qty = formatQty(item?.quantity || 1);
    const unit = getUnitText(item);
    const price = formatearDinero(parseFloat(item?.price) || 0);
    const amount = formatearDinero(getItemTotal(item));
    wrapLine(getItemName(item), columns).forEach((line) => lines.push(line));
    lines.push(leftRight(`${qty} ${unit} x ${price}`, amount, columns));
    const code = getItemCode(item);
    if (code) lines.push(`COD: ${normalizeText(code).slice(0, Math.max(0, columns - 5))}`);
  });

  lines.push(separator(columns));
  lines.push(leftRight("TOTAL", formatearDinero(total), columns));

  if (payments.length > 0) {
    payments.forEach((payment) => {
      lines.push(leftRight(getPaymentLabel(payment, sale?.metodoPago), formatearDinero(payment?.received || payment?.amount || 0), columns));
    });
  } else {
    const received = parseFloat(sale?.montoRecibido) || total;
    lines.push(leftRight(getPaymentLabel(null, sale?.metodoPago || "EFECTIVO"), formatearDinero(received), columns));
  }
  lines.push(leftRight("CAMBIO", formatearDinero(parseFloat(sale?.cambio) || 0), columns));

  if (s.show_footer !== false && s.footer_message) {
    lines.push(separator(columns));
    wrapLine(s.footer_message, columns).forEach((line) => lines.push(center(line, columns)));
  }

  if (sale?.pin_facturacion && s.show_billing_section !== false) {
    const billingUrl = ((import.meta.env.VITE_BILLING_PORTAL_URL || "https://pos-autofactura.vercel.app").replace(/\/$/, ""));
    lines.push(separator(columns));
    lines.push(center("FACTURACION", columns));
    lines.push(leftRight("FOLIO", folio, columns));
    lines.push(leftRight("PIN", sale.pin_facturacion, columns));
    wrapLine(billingUrl.replace(/^https?:\/\//, ""), columns).forEach((line) => lines.push(center(line, columns)));
  }

  lines.push("");
  lines.push("");
  lines.push("");
  return lines.join("\n");
};

const pushText = (bytes, text) => {
  const clean = normalizeText(text);
  for (let i = 0; i < clean.length; i += 1) {
    bytes.push(clean.charCodeAt(i) & 0xff);
  }
};

const pushLine = (bytes, text = "") => {
  pushText(bytes, text);
  bytes.push(0x0a);
};

export const formatSaleToEscposBytes = (sale, settings, user, options = {}) => {
  const bytes = [];
  bytes.push(ESC, 0x40); // Initialize
  bytes.push(ESC, 0x74, 0x02); // PC850 where supported
  bytes.push(ESC, 0x61, 0x00); // Left align

  const text = formatSaleToEscposText(sale, settings, user, options);
  text.split("\n").forEach((line) => pushLine(bytes, line));

  if (options.cut !== false) {
    bytes.push(GS, 0x56, 0x00);
  }

  return Uint8Array.from(bytes);
};

export const bytesToBase64 = (bytes) => {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

export const buildEscposPrintPayload = (sale, settings, user, options = {}) => {
  const bytes = formatSaleToEscposBytes(sale, settings, user, options);
  return {
    rawBase64: bytesToBase64(bytes),
    byteLength: bytes.length,
    paperWidth: settings?.paper_width === "80mm" ? "80mm" : "58mm",
    format: "escpos",
  };
};
