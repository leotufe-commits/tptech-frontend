// src/lib/sales/__tests__/discount-dup-article-lines.test.ts
// ============================================================================
// Auditoría Bonificación: MISMO artículo en varias líneas con bonif distinta.
// El override de descuento debe viajar POR LÍNEA y la hidratación posicional
// NO debe compartir snapshot entre líneas del mismo artículo.
// ============================================================================

import { describe, it, expect } from "vitest";
import { buildSalePreviewPayload } from "../buildSalePreviewPayload";
import { applySalePreviewToDraft } from "../applySalePreviewToDraft";
import type { SalesInvoice } from "../types";
import type { DocumentLine } from "../../document-types";

function line(id: string, extra: Partial<DocumentLine> = {}): DocumentLine {
  return {
    id, articleId: "ART-1", article: "Anillo", quantity: 1,
    unitPrice: 100_000, discountAmount: 0, subtotal: 100_000,
    taxAmount: 0, lineTotal: 100_000, lineTotalWithTax: 100_000,
    pricingMeta: { priceSource: "PRICE_LIST", basePrice: 100_000 },
    ...extra,
  } as unknown as DocumentLine;
}
function draft(lines: DocumentLine[]): SalesInvoice {
  return {
    id: "fv1", number: "FV", date: "", dueDate: "", client: "",
    salesOrderNumber: "", deliveryNumber: "", currency: "ARS", fxRate: 1,
    taxPercent: 0, seller: "", warehouse: "", paymentTerm: "",
    referenceNumber: "", notes: "", terms: "", subtotal: 0, discountAmount: 0,
    taxAmount: 0, total: 0, paidAmount: 0, lines, status: "DRAFT",
  } as SalesInvoice;
}

describe("payload — bonif por línea, no compartida", () => {
  it("línea A 10%, línea B 30%, línea C limpia (0) → overrides distintos por línea", () => {
    const A = line("A", {
      manualOverrides: { discount: true },
      pricingMeta: { priceSource: "PRICE_LIST", basePrice: 100_000,
        manualDiscount: { mode: "PERCENT", value: 10, appliesTo: "TOTAL" } } as any,
    });
    const B = line("B", {
      manualOverrides: { discount: true },
      pricingMeta: { priceSource: "PRICE_LIST", basePrice: 100_000,
        manualDiscount: { mode: "PERCENT", value: 30, appliesTo: "TOTAL" } } as any,
    });
    const C = line("C", {
      manualOverrides: { discount: true },
      pricingMeta: { priceSource: "PRICE_LIST", basePrice: 100_000,
        manualDiscount: { mode: "PERCENT", value: 0, appliesTo: "TOTAL" } } as any,
    });
    const { payload } = buildSalePreviewPayload(draft([A, B, C]));
    expect(payload.lines).toHaveLength(3);
    expect((payload.lines[0] as any).manualDiscountOverride).toEqual({ mode: "PERCENT", value: 10, appliesTo: "TOTAL" });
    expect((payload.lines[1] as any).manualDiscountOverride).toEqual({ mode: "PERCENT", value: 30, appliesTo: "TOTAL" });
    // limpiar = 0 explícito (no undefined / no fantasma)
    expect((payload.lines[2] as any).manualDiscountOverride).toEqual({ mode: "PERCENT", value: 0, appliesTo: "TOTAL" });
  });

  it("sin flag discount → no viaja override aunque exista en meta", () => {
    const L = line("A", {
      pricingMeta: { priceSource: "PRICE_LIST", basePrice: 100_000,
        manualDiscount: { mode: "PERCENT", value: 10, appliesTo: "TOTAL" } } as any,
    });
    const { payload } = buildSalePreviewPayload(draft([L]));
    expect((payload.lines[0] as any).manualDiscountOverride).toBeNull();
  });
});

describe("hidratación — bonif no comparte snapshot entre líneas iguales", () => {
  it("línea A 10% y línea B 30% del mismo artículo → totales distintos por línea", () => {
    const A = line("A", { manualOverrides: { discount: true },
      pricingMeta: { basePrice: 100_000, manualDiscount: { mode: "PERCENT", value: 10, appliesTo: "TOTAL" } } as any });
    const B = line("B", { manualOverrides: { discount: true },
      pricingMeta: { basePrice: 100_000, manualDiscount: { mode: "PERCENT", value: 30, appliesTo: "TOTAL" } } as any });

    const preview: any = {
      lines: [
        { articleId: "ART-1", variantId: null, quantity: 1, unitPrice: 90_000,
          basePrice: 100_000, lineTotal: 90_000, lineDiscount: 10_000,
          unitTaxAmount: 0, unitTotalWithTax: 90_000, lineTaxAmount: 0,
          lineTotalWithTax: 90_000, taxBreakdown: [] },
        { articleId: "ART-1", variantId: null, quantity: 1, unitPrice: 70_000,
          basePrice: 100_000, lineTotal: 70_000, lineDiscount: 30_000,
          unitTaxAmount: 0, unitTotalWithTax: 70_000, lineTaxAmount: 0,
          lineTotalWithTax: 70_000, taxBreakdown: [] },
      ],
      documentTotals: {
        subtotalAfterLineDiscounts: 160_000, lineDiscountAmount: 40_000,
        couponDiscountAmount: 0, globalDiscountAmount: 0, taxAmount: 0, total: 160_000,
      },
    };
    const out = applySalePreviewToDraft(draft([A, B]), preview);
    expect(out.lines[0].unitPrice).toBe(90_000);
    expect(out.lines[0].discountAmount).toBe(10_000);
    expect(out.lines[0].lineTotalWithTax).toBe(90_000);
    expect(out.lines[1].unitPrice).toBe(70_000);
    expect(out.lines[1].discountAmount).toBe(30_000);
    expect(out.lines[1].lineTotalWithTax).toBe(70_000);
    expect(out.lines[0].lineTotalWithTax).not.toBe(out.lines[1].lineTotalWithTax);
  });
});
