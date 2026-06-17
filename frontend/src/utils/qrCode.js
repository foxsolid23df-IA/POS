import QRCode from "qrcode";

export const DEFAULT_BILLING_PORTAL_URL = "https://pos-autofactura.vercel.app";

export const normalizeBillingPortalUrl = (value) => {
  const raw = String(value || DEFAULT_BILLING_PORTAL_URL).trim();
  return (raw || DEFAULT_BILLING_PORTAL_URL).replace(/\/+$/, "");
};

export const buildBillingPortalUrl = (folio, pin, baseUrl) => {
  const url = new URL(normalizeBillingPortalUrl(baseUrl));
  url.searchParams.set("folio", String(folio ?? ""));
  url.searchParams.set("pin", String(pin ?? ""));
  return url.toString();
};

export const createQrMatrix = (value, options = {}) => {
  const quiet = options.quietZone ?? 4;
  const qr = QRCode.create(String(value ?? ""), {
    errorCorrectionLevel: options.errorCorrectionLevel || "M",
  });
  const size = qr.modules.size;
  const totalModules = size + quiet * 2;

  return {
    size,
    totalModules,
    quietZone: quiet,
    isDark(row, col) {
      const qrRow = row - quiet;
      const qrCol = col - quiet;
      if (qrRow < 0 || qrCol < 0 || qrRow >= size || qrCol >= size) return false;
      return Boolean(qr.modules.get(qrRow, qrCol));
    },
  };
};

export const generateQrSvg = (value, options = {}) => {
  const scale = options.scale || 4;
  const matrix = createQrMatrix(value, options);
  const rects = [];

  for (let row = 0; row < matrix.totalModules; row += 1) {
    for (let col = 0; col < matrix.totalModules; col += 1) {
      if (matrix.isDark(row, col)) {
        rects.push(`<rect x="${col}" y="${row}" width="1" height="1"/>`);
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${matrix.totalModules * scale}" height="${matrix.totalModules * scale}" viewBox="0 0 ${matrix.totalModules} ${matrix.totalModules}" shape-rendering="crispEdges"><path fill="#fff" d="M0 0h${matrix.totalModules}v${matrix.totalModules}H0z"/><g fill="#000">${rects.join("")}</g></svg>`;
};

export const generateQrPngDataUrl = (value, options = {}) => {
  if (typeof document === "undefined") return "";
  if (typeof window !== "undefined" && /jsdom/i.test(window.navigator?.userAgent || "")) return "";

  const scale = options.scale || 4;
  const matrix = createQrMatrix(value, options);
  const pixels = matrix.totalModules * scale;
  const canvas = document.createElement("canvas");
  canvas.width = pixels;
  canvas.height = pixels;

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return "";

  context.fillStyle = "#fff";
  context.fillRect(0, 0, pixels, pixels);
  context.fillStyle = "#000";

  for (let row = 0; row < matrix.totalModules; row += 1) {
    for (let col = 0; col < matrix.totalModules; col += 1) {
      if (matrix.isDark(row, col)) {
        context.fillRect(col * scale, row * scale, scale, scale);
      }
    }
  }

  return canvas.toDataURL("image/png");
};

export const generateQrDataUrl = (value, options = {}) => {
  const png = generateQrPngDataUrl(value, options);
  if (png) return png;

  const svg = generateQrSvg(value, options);
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};
