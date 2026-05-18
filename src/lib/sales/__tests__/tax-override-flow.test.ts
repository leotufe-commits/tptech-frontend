// src/lib/sales/__tests__/tax-override-flow.test.ts
// ============================================================================
// Contrato del flujo de OVERRIDE de impuesto por línea en Factura.
//
// Bug cubierto: "al modificar/limpiar el impuesto, el Total línea c/ imp.
// no parecía relacionarse con el TPNumber". El pipeline de datos (payload →
// motor → hidratación) ES correcto y este test lo fija para que no regrese:
//
//   1. Si `manualOverrides.tax` está activo, `buildSalePreviewPayload`
//      DEBE mandar `taxOverride` al backend — incluso con value 0 (el
//      operador limpió el impuesto: 0 es una intención explícita, NO
//      "sin cambio").
//   2. Sin el flag `tax`, el override NO viaja (no se filtra un override
//      fantasma).
//   3. `applySalePreviewToDraft` hidrata `taxAmount` / `lineTotalWithTax`
//      con lo que devuelve el motor y PRESERVA `taxOverride` (para que el
//      label no reviva el importe viejo tras el round-trip).
//
// El consumo visual (que el "+$" del input y el "Total línea c/ imp." salgan
// del MISMO `l.taxAmount` del motor) lo garantizan `selectInvoiceLineView`
// (ver su test) + `isTaxClearedOverride` (ver tax-cleared-override.test.ts).
// ============================================================================

import { describe, it, expect } from "vitest";
import { buildSalePreviewPayload } from "../buildSalePreviewPayload";
import { applySalePreviewToDraft } from "../applySalePreviewToDraft";
import type { SalesInvoice } from "../types";
import type { DocumentLine } from "../../document-types";

function makeLine(o: Partial<DocumentLine> = {}): DocumentLine {
  return {
    id: "l1", articleId: "a1", article: "ART-001",
    quantity: 2, unitPrice: 100, discountAmount: 0,
    taxAmount: 42, subtotal: 200, lineTotal: 242, lineTotalWithTax: 242,
    ...o,
  } as DocumentLine;
}
function makeDraft(o: Partial<SalesInvoice> = {}): SalesInvoice {
  return {
    id: "fv1", number: "FV", date: "", dueDate: "", client: "",
    salesOrderNumber: "", deliveryNumber: "", currency: "ARS", fxRate: 1,
    taxPercent: 21, seller: "", warehouse: "", paymentTerm: "",
    referenceNumber: "", notes: "", terms: "", subtotal: 0, discountAmount: 0,
    taxAmount: 0, total: 0, paidAmount: 0, lines: [], status: "DRAFT", ...o,
  } as SalesInvoice;
}

describe("tax override flow — payload", () => {
  it("LIMPIAR: flag tax + taxOverride{value:0} → el payload manda el override (0 explícito)", () => {
    const line = makeLine({
      manualOverrides: { tax: true },
      pricingMeta: { taxOverride: { mode: "PERCENT", value: 0, appliesTo: "TOTAL" } } as any,
    });
    const { payload } = buildSalePreviewPayload(makeDraft({ lines: [line] }));
    expect((payload.lines[0] as any).taxOverride).toEqual({ mode: "PERCENT", value: 0, appliesTo: "TOTAL" });
  });

  it("MODIFICAR: taxOverride{value:10} → el payload manda el override", () => {
    const line = makeLine({
      manualOverrides: { tax: true },
      pricingMeta: { taxOverride: { mode: "PERCENT", value: 10, appliesTo: "TOTAL" } } as any,
    });
    const { payload } = buildSalePreviewPayload(makeDraft({ lines: [line] }));
    expect((payload.lines[0] as any).taxOverride).toEqual({ mode: "PERCENT", value: 10, appliesTo: "TOTAL" });
  });

  it("SIN flag tax → NO viaja taxOverride aunque exista en meta (no fantasma)", () => {
    const line = makeLine({
      pricingMeta: { taxOverride: { mode: "PERCENT", value: 0, appliesTo: "TOTAL" } } as any,
    });
    const { payload } = buildSalePreviewPayload(makeDraft({ lines: [line] }));
    expect((payload.lines[0] as any).taxOverride).toBeNull();
  });
});

describe("tax override flow — hidratación", () => {
  it("backend devuelve tax 0 → taxAmount 0, lineTotalWithTax = neto, taxOverride preservado", () => {
    const line = makeLine({
      manualOverrides: { tax: true },
      pricingMeta: { taxOverride: { mode: "PERCENT", value: 0, appliesTo: "TOTAL" } } as any,
    });
    const preview: any = {
      lines: [{
        articleId: "a1", variantId: null, quantity: 2,
        unitPrice: 100, basePrice: 100, lineTotal: 200, lineDiscount: 0,
        unitTaxAmount: 0, unitTotalWithTax: 100, lineTaxAmount: 0,
        lineTotalWithTax: 200, taxBreakdown: [],
      }],
      documentTotals: {
        subtotalAfterLineDiscounts: 200, lineDiscountAmount: 0,
        couponDiscountAmount: 0, globalDiscountAmount: 0, taxAmount: 0, total: 200,
      },
    };
    const out = applySalePreviewToDraft(makeDraft({ lines: [line] }), preview);
    expect(out.lines[0].taxAmount).toBe(0);
    expect(out.lines[0].lineTotalWithTax).toBe(200);
    expect((out.lines[0].pricingMeta as any).taxOverride).toEqual({ mode: "PERCENT", value: 0, appliesTo: "TOTAL" });
  });

  it("backend devuelve tax modificado → taxAmount y lineTotalWithTax salen del motor", () => {
    const line = makeLine({
      manualOverrides: { tax: true },
      pricingMeta: { taxOverride: { mode: "PERCENT", value: 10, appliesTo: "TOTAL" } } as any,
    });
    const preview: any = {
      lines: [{
        articleId: "a1", variantId: null, quantity: 2,
        unitPrice: 100, basePrice: 100, lineTotal: 200, lineDiscount: 0,
        unitTaxAmount: 10, unitTotalWithTax: 110, lineTaxAmount: 20,
        lineTotalWithTax: 220, taxBreakdown: [],
      }],
      documentTotals: {
        subtotalAfterLineDiscounts: 200, lineDiscountAmount: 0,
        couponDiscountAmount: 0, globalDiscountAmount: 0, taxAmount: 20, total: 220,
      },
    };
    const out = applySalePreviewToDraft(makeDraft({ lines: [line] }), preview);
    expect(out.lines[0].taxAmount).toBe(20);
    expect(out.lines[0].lineTotalWithTax).toBe(220);
  });
});
