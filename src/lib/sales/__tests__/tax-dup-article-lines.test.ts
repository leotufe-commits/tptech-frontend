// src/lib/sales/__tests__/tax-dup-article-lines.test.ts
// ============================================================================
// Regresión: MISMO artículo en dos líneas, una con impuesto heredado 21% y
// otra con override manual de impuesto 0 ("Sin impuesto").
//
// Debe poder distinguirse línea por línea (por identidad de LÍNEA, NO por
// artículo): el payload manda overrides distintos por posición, y la
// hidratación posicional NO debe copiar el resultado de una línea sobre la
// otra. La línea con tax 0 debe quedar con lineTotalWithTax == neto.
// ============================================================================

import { describe, it, expect } from "vitest";
import { buildSalePreviewPayload } from "../buildSalePreviewPayload";
import { applySalePreviewToDraft } from "../applySalePreviewToDraft";
import { matchPreviewLines } from "../matchPreviewLines";
import type { SalesInvoice } from "../types";
import type { DocumentLine } from "../../document-types";

function lineGravada(): DocumentLine {
  return {
    id: "L-A", articleId: "ART-1", article: "Anillo", quantity: 1,
    unitPrice: 2_246_830.59, discountAmount: 0, subtotal: 2_246_830.59,
    taxAmount: 471_834.42, lineTotal: 2_718_665.01, lineTotalWithTax: 2_718_665.01,
    pricingMeta: { priceSource: "PRICE_LIST", basePrice: 2_246_830.59,
      taxBreakdown: [{ name: "IVA", rate: 21, taxAmount: 471_834.42 }] },
  } as unknown as DocumentLine;
}
function lineSinImpuesto(): DocumentLine {
  // Mismo artículo, pero el operador limpió el impuesto (X / 0).
  return {
    id: "L-B", articleId: "ART-1", article: "Anillo", quantity: 1,
    unitPrice: 2_246_830.59, discountAmount: 0, subtotal: 2_246_830.59,
    taxAmount: 471_834.42, lineTotal: 2_718_665.01, lineTotalWithTax: 2_718_665.01,
    manualOverrides: { tax: true },
    pricingMeta: { priceSource: "PRICE_LIST", basePrice: 2_246_830.59,
      taxBreakdown: [{ name: "IVA", rate: 21, taxAmount: 471_834.42 }],
      taxOverride: { mode: "PERCENT", value: 0, appliesTo: "TOTAL" } },
  } as unknown as DocumentLine;
}
function makeDraft(lines: DocumentLine[]): SalesInvoice {
  return {
    id: "fv1", number: "FV", date: "", dueDate: "", client: "",
    salesOrderNumber: "", deliveryNumber: "", currency: "ARS", fxRate: 1,
    taxPercent: 21, seller: "", warehouse: "", paymentTerm: "",
    referenceNumber: "", notes: "", terms: "", subtotal: 0, discountAmount: 0,
    taxAmount: 0, total: 0, paidAmount: 0, lines, status: "DRAFT",
  } as SalesInvoice;
}

describe("dos líneas mismo artículo — payload por línea", () => {
  it("la línea sin override NO manda taxOverride; la línea limpia manda 0 explícito", () => {
    const { payload } = buildSalePreviewPayload(
      makeDraft([lineGravada(), lineSinImpuesto()]),
    );
    expect(payload.lines).toHaveLength(2);
    expect((payload.lines[0] as any).taxOverride).toBeNull();
    expect((payload.lines[1] as any).taxOverride).toEqual({
      mode: "PERCENT", value: 0, appliesTo: "TOTAL",
    });
  });
});

describe("dos líneas mismo artículo — matchPreviewLines posicional", () => {
  it("empareja por posición/identidad de línea, no por artículo", () => {
    const draft = makeDraft([lineGravada(), lineSinImpuesto()]);
    const preview = [{ tag: "A" }, { tag: "B" }];
    const matched = matchPreviewLines(draft.lines, preview);
    expect(matched).toEqual([{ tag: "A" }, { tag: "B" }]);
  });
});

describe("dos líneas mismo artículo — hidratación NO comparte snapshot", () => {
  it("línea gravada conserva 21%; línea limpia queda en neto (taxAmount 0)", () => {
    const draft = makeDraft([lineGravada(), lineSinImpuesto()]);
    const preview: any = {
      lines: [
        { // A — gravada 21%
          articleId: "ART-1", variantId: null, quantity: 1,
          unitPrice: 2_246_830.59, basePrice: 2_246_830.59,
          lineTotal: 2_246_830.59, lineDiscount: 0,
          unitTaxAmount: 471_834.42, unitTotalWithTax: 2_718_665.01,
          lineTaxAmount: 471_834.42, lineTotalWithTax: 2_718_665.01,
          taxBreakdown: [{ name: "IVA", rate: 21, taxAmount: 471_834.42 }],
        },
        { // B — override 0
          articleId: "ART-1", variantId: null, quantity: 1,
          unitPrice: 2_246_830.59, basePrice: 2_246_830.59,
          lineTotal: 2_246_830.59, lineDiscount: 0,
          unitTaxAmount: 0, unitTotalWithTax: 2_246_830.59,
          lineTaxAmount: 0, lineTotalWithTax: 2_246_830.59,
          taxBreakdown: [],
        },
      ],
      documentTotals: {
        subtotalAfterLineDiscounts: 4_493_661.18, lineDiscountAmount: 0,
        couponDiscountAmount: 0, globalDiscountAmount: 0,
        taxAmount: 471_834.42, total: 4_965_495.60,
      },
    };
    const out = applySalePreviewToDraft(draft, preview);

    // Línea A (gravada)
    expect(out.lines[0].taxAmount).toBe(471_834.42);
    expect(out.lines[0].lineTotalWithTax).toBe(2_718_665.01);
    // Línea B (sin impuesto) — NO debe heredar el total de A
    expect(out.lines[1].taxAmount).toBe(0);
    expect(out.lines[1].lineTotalWithTax).toBe(2_246_830.59);
    expect(out.lines[1].lineTotalWithTax).not.toBe(out.lines[0].lineTotalWithTax);
    // Footer impuestos = solo la línea gravada
    expect(out.taxAmount).toBe(471_834.42);
  });
});
