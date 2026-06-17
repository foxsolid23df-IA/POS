import { describe, expect, it } from "vitest";
import {
  buildEscposPrintPayload,
  formatSaleToEscposBytes,
  formatSaleToEscposText,
} from "../ticketEscposFormatter";

const settings = {
  business_name: "RTape",
  footer_message: "Gracias por su compra",
  paper_width: "58mm",
  show_billing_section: true,
};

describe("ticketEscposFormatter", () => {
  it("genera texto ESC/POS para una venta normal", () => {
    const text = formatSaleToEscposText(
      {
        id: 123,
        total: 50,
        metodoPago: "efectivo",
        items: [{ quantity: 2, name: "CINTA TRANSPARENTE", price: 25, barcode: "ABC" }],
      },
      settings,
      { full_name: "Caja 1" },
    );

    expect(text).toContain("RTape");
    expect(text).toContain("Folio: 123");
    expect(text).toContain("CINTA TRANSPARENTE");
    expect(text).toContain("TOTAL");
    expect(text).toContain("$ 50");
  });

  it("incluye unidad CAJA y factor de piezas", () => {
    const text = formatSaleToEscposText(
      {
        id: 124,
        total: 504,
        items: [
          {
            quantity: 1,
            unit_sold: "CAJA",
            box_units: 36,
            name: "DUCTO POLYFILM 48X10",
            price: 504,
          },
        ],
      },
      settings,
      { full_name: "Caja 1" },
    );

    expect(text).toContain("CAJA C/36");
    expect(text).toContain("DUCTO POLYFILM");
  });

  it("imprime pagos multiples y datos de facturacion como texto", () => {
    const text = formatSaleToEscposText(
      {
        id: 125,
        total: 100,
        pin_facturacion: "9876",
        payments: [
          { method: "efectivo", received: 60 },
          { method: "tarjeta", received: 40 },
        ],
        items: [{ quantity: 1, name: "Producto", price: 100 }],
      },
      settings,
      { full_name: "Caja 1" },
    );

    expect(text).toContain("EFECTIVO");
    expect(text).toContain("TARJETA");
    expect(text).toContain("FACTURACION");
    expect(text).toContain("9876");
  });

  it("parte nombres largos y genera payload base64 con comandos ESC/POS", () => {
    const sale = {
      id: 126,
      total: 10,
      items: [{ quantity: 1, name: "PRODUCTO CON NOMBRE MUY LARGO PARA VALIDAR COLUMNAS", price: 10 }],
    };
    const bytes = formatSaleToEscposBytes(sale, settings, { full_name: "Caja 1" });
    const payload = buildEscposPrintPayload(sale, settings, { full_name: "Caja 1" });

    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x40);
    expect(bytes[bytes.length - 3]).toBe(0x1d);
    expect(payload.rawBase64).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(payload.byteLength).toBe(bytes.length);
  });

  it("agrega comando QR nativo cuando la venta tiene PIN de facturacion", () => {
    const bytes = Array.from(formatSaleToEscposBytes(
      {
        id: 127,
        total: 10,
        pin_facturacion: "A0E39F",
        items: [{ quantity: 1, name: "Producto", price: 10 }],
      },
      settings,
      { full_name: "Caja 1" },
      { cut: false },
    ));

    const qrPrintCommand = [0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30];
    const hasQrPrintCommand = bytes.some((_, index) =>
      qrPrintCommand.every((value, offset) => bytes[index + offset] === value)
    );

    expect(hasQrPrintCommand).toBe(true);
  });
});
