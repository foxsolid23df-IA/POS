import { buildEscposPrintPayload } from "../utils/ticketEscposFormatter";
import { generateTicketHtml, wrapTicketForPrinting } from "../utils/ticketFormatter";

export const TICKET_PRINT_MODE_STORAGE_KEY = "nexum:ticket-print-mode";
export const TICKET_PRINT_MODES = {
  AUTO: "auto",
  RAW: "raw",
  HTML: "html",
};

const isElectronPrinter = () =>
  typeof window !== "undefined" &&
  window.electronAPI &&
  window.electronAPI.isElectron;

const prepareElectronPrinter = () => {
  if (!isElectronPrinter() || typeof window.electronAPI.preparePrinter !== "function") return;

  window.electronAPI.preparePrinter().catch((error) => {
    console.warn("[PrinterService] No se pudo preparar la impresora:", error);
  });
};

prepareElectronPrinter();

export const getTicketPrintMode = () => {
  try {
    const value = window.localStorage?.getItem(TICKET_PRINT_MODE_STORAGE_KEY);
    if (Object.values(TICKET_PRINT_MODES).includes(value)) return value;
  } catch {
    // Storage no disponible.
  }
  return TICKET_PRINT_MODES.AUTO;
};

export const setTicketPrintMode = (mode) => {
  const nextMode = Object.values(TICKET_PRINT_MODES).includes(mode)
    ? mode
    : TICKET_PRINT_MODES.AUTO;
  try {
    window.localStorage?.setItem(TICKET_PRINT_MODE_STORAGE_KEY, nextMode);
  } catch {
    // Storage no disponible.
  }
  return nextMode;
};

export const buildFastTicketHtml = (sale, settings, user) => {
  const html = generateTicketHtml(sale, settings, user, { fastPrint: true });
  return wrapTicketForPrinting(html, settings);
};

export const printHtmlTicket = (htmlContent, options = {}) => {
  try {
    if (isElectronPrinter()) {
      prepareElectronPrinter();
      window.electronAPI.print(htmlContent, {
        paperWidth: options.paperWidth || "58mm",
        printerName: options.printerName || null,
      });
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.style.visibility = "hidden";
    iframe.style.position = "absolute";
    iframe.style.width = "0px";
    iframe.style.height = "0px";
    iframe.style.border = "none";

    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow || iframe.contentDocument.document || iframe.contentDocument;
    iframeDoc.document.open();
    iframeDoc.document.write(htmlContent);
    iframeDoc.document.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();

      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 5000);
    }, 300);
  } catch (error) {
    console.error("Error al intentar imprimir el ticket:", error);
    throw error;
  }
};

export const printSaleTicketFast = (sale, settings, user, options = {}) => {
  const paperWidth = options.paperWidth || settings?.paper_width || "58mm";
  const printerName = options.printerName || null;
  const mode = options.mode || getTicketPrintMode();
  const fallbackHtml = options.fallbackHtml || buildFastTicketHtml(sale, settings, user);

  if (!isElectronPrinter() || mode === TICKET_PRINT_MODES.HTML) {
    printHtmlTicket(fallbackHtml, { paperWidth, printerName });
    return;
  }

  if (typeof window.electronAPI.printEscposTicket !== "function") {
    console.warn("[PrinterService] ESC/POS no disponible en esta app; usando HTML.");
    printHtmlTicket(fallbackHtml, { paperWidth, printerName });
    return;
  }

  try {
    const payload = buildEscposPrintPayload(sale, { ...settings, paper_width: paperWidth }, user, {
      cut: options.cut !== false,
    });
    prepareElectronPrinter();
    window.electronAPI.printEscposTicket(payload, {
      paperWidth,
      printerName,
      fallbackHtml,
    });
  } catch (error) {
    console.warn("[PrinterService] No se pudo generar ESC/POS; usando HTML:", error);
    printHtmlTicket(fallbackHtml, { paperWidth, printerName });
  }
};

export const printerService = {
  printHtmlTicket,
  printSaleTicketFast,
  getTicketPrintMode,
  setTicketPrintMode,
  TICKET_PRINT_MODES,
};
