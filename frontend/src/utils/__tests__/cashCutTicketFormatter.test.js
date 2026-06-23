import { describe, expect, it } from "vitest";
import {
  buildCashCutTicketHtml,
  hasFullCashCutSnapshot,
  normalizeCashCutForTicket,
} from "../cashCutTicketFormatter";

describe("cashCutTicketFormatter", () => {
  it("genera ticket completo desde snapshot guardado", () => {
    const cut = {
      id: 10,
      snapshot_version: 1,
      opening_fund: 100,
      cash_cut_snapshot: {
        staffName: "R.Tape",
        sessionId: "turno-1",
        startTime: "2026-06-23T10:00:00.000Z",
        expectedCash: 250,
        actualCash: 250,
        salesCount: 2,
        salesTotal: 300,
        collectedPaymentTotals: { efectivo: 200 },
        creditPaymentTotals: { efectivo: 50 },
        expensesTotal: 20,
        expenses: [{ concept: "Proveedor", amount: 20 }],
        expensesByCategory: [{ category: "Proveedor", count: 1, total: 20 }],
        refundsCashTotal: 30,
        cashRefunds: [{ concept: "Devolucion/cancelacion venta #5", amount: 30 }],
        commercialSalesSummary: {
          cash: { count: 2, total: 300 },
          credits: { count: 0, total: 0 },
          orders: { count: 0, total: 0 },
          payments: { count: 1, total: 50 },
        },
        otherPaymentRows: [
          { key: "TRA", label: "TRA", income: 80, expense: 0, total: 80 },
        ],
      },
    };

    const html = buildCashCutTicketHtml(cut, { storeName: "Royal Tape" });

    expect(hasFullCashCutSnapshot(cut)).toBe(true);
    expect(html).toContain("RESUMEN DE VENTAS");
    expect(html).toContain("MANEJO DE EFECTIVO");
    expect(html).toContain("OTRAS FORMAS DE PAGO");
    expect(html).toContain("Proveedor");
    expect(html).toContain("Devolucion/cancelacion venta");
  });

  it("normaliza cortes antiguos sin snapshot con informacion disponible", () => {
    const cut = {
      staff_name: "Caja 1",
      cut_type: "dia",
      sales_count: 4,
      sales_total: 1000,
      expected_cash: 500,
      actual_cash: 480,
      difference: -20,
      payment_totals: { efectivo: 500 },
    };

    const normalized = normalizeCashCutForTicket(cut);
    const html = buildCashCutTicketHtml(cut);

    expect(hasFullCashCutSnapshot(cut)).toBe(false);
    expect(normalized.staffName).toBe("Caja 1");
    expect(normalized.salesCount).toBe(4);
    expect(html).toContain("CORTE DE CAJA");
    expect(html).toContain("EFECTIVO ESPERADO");
  });
});
