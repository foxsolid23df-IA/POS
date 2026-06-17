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

export const generateQrSvg = (value, options = {}) => {
  const quiet = options.quietZone ?? 4;
  const scale = options.scale || 4;
  const qr = QRCode.create(String(value ?? ""), {
    errorCorrectionLevel: options.errorCorrectionLevel || "M",
  });
  const size = qr.modules.size;
  const totalModules = size + quiet * 2;
  const rects = [];

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (qr.modules.get(row, col)) {
        rects.push(`<rect x="${col + quiet}" y="${row + quiet}" width="1" height="1"/>`);
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalModules * scale}" height="${totalModules * scale}" viewBox="0 0 ${totalModules} ${totalModules}" shape-rendering="crispEdges"><path fill="#fff" d="M0 0h${totalModules}v${totalModules}H0z"/><g fill="#000">${rects.join("")}</g></svg>`;
};

export const generateQrDataUrl = (value, options = {}) => {
  const svg = generateQrSvg(value, options);
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};
