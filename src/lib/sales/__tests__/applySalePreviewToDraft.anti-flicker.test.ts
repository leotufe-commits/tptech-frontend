// src/lib/sales/__tests__/applySalePreviewToDraft.anti-flicker.test.ts
// =============================================================================
// Anti-flicker — `applySalePreviewToDraft` debe escribir `previewQuantity` en
// `pricingMeta` como passthrough puro de `SalePreviewLine.quantity`. Sin ese
// ancla, el editor de líneas mezclaría la nueva quantity local (que el
// operador acaba de tipear) con `subtotal`/`lineDiscount` del preview
// anterior — produciendo un % intermedio incorrecto en la celda de
// Bonificación hasta que llegara el siguiente preview (~200-500 ms).
//
// El test fija la INVARIANTE en la frontera adapter→draft: el meta de salida
// expone la qty del snapshot del motor, distinta de `line.quantity` si el
// operador la cambió mientras el preview viajaba.
// =============================================================================

import { describe, it, expect } from "vitest";
import { applySalePreviewToDraft } from "../applySalePreviewToDraft";
import type { SalesInvoice } from "../types";
import type { SalePreviewResult } from "../../../services/sales";

function makeLine(): SalesInvoice["lines"][number] {
  return {
    id:             "line-1",
    type:           "ARTICLE",
    article:        "Anillo",
    variant:        "",
    articleId:      "art-1",
    // El operador YA cambió la quantity de 1 a 2 — el preview todavía
    // refleja qty=1. Esta es la ventana de flicker.
    quantity:       2,
    unitPrice:      900,
    discountAmount: 100,
    subtotal:       900,
    taxAmount:      189,
    lineTotal:      900,
  } as any;
}

function makeDraft(): SalesInvoice {
  return {
    lines: [makeLine()],
  } as SalesInvoice;
}

function makePreviewLine(quantity: number): any {
  return {
    articleId:               "art-1",
    variantId:               null,
    quantity,
    basePrice:               1000,
    unitPrice:               900,
    unitTaxAmount:           189,
    unitTotalWithTax:        1089,
    quantityDiscountAmount:  0,
    promotionDiscountAmount: 0,
    lineSubtotal:            900 * quantity,
    lineTotal:               900 * quantity,
    lineDiscount:            100 * quantity,
    lineTaxAmount:           189 * quantity,
    lineTotalWithTax:        1089 * quantity,
    priceSource:             "PRICE_LIST",
    appliedPriceListId:      null,
    appliedPriceListName:    null,
    appliedPromotionId:      null,
    appliedPromotionName:    null,
    unitCost:                500,
    unitMargin:              400,
    marginPercent:           80,
    metalHechuraBreakdown:   null,
    taxBreakdown:            [],
  };
}

function makePreview(quantity: number): SalePreviewResult {
  return {
    lines: [makePreviewLine(quantity)],
    documentTotals: {
      subtotalBeforeDiscounts:    900 * quantity,
      lineDiscountAmount:         100 * quantity,
      subtotalAfterLineDiscounts: 900 * quantity,
      couponDiscountAmount:       0,
      globalDiscountAmount:       0,
      taxAmount:                  189 * quantity,
      shippingAmount:             0,
      total:                      1089 * quantity,
    },
  } as any;
}

describe("applySalePreviewToDraft — passthrough de previewQuantity (anti-flicker)", () => {
  it("escribe `previewQuantity` con la cantidad del SNAPSHOT del motor (no la del draft)", () => {
    const draft   = makeDraft();        // draft.lines[0].quantity = 2 (operador)
    const preview = makePreview(1);     // preview.lines[0].quantity = 1 (snapshot anterior)

    const out = applySalePreviewToDraft(draft, preview);

    // La quantity local del draft se preserva (el operador la cambió).
    expect(out.lines[0].quantity).toBe(2);
    // El previewQuantity refleja la qty CON LA QUE el motor calculó.
    expect(out.lines[0].pricingMeta?.previewQuantity).toBe(1);
  });

  it("cuando el siguiente preview llega con la quantity nueva, previewQuantity converge", () => {
    const draft        = makeDraft();
    const firstPreview = makePreview(1);
    const stage1       = applySalePreviewToDraft(draft, firstPreview);
    expect(stage1.lines[0].pricingMeta?.previewQuantity).toBe(1);

    // Llega el preview con la qty nueva — el ancla converge.
    const finalPreview = makePreview(2);
    const stage2       = applySalePreviewToDraft(stage1, finalPreview);
    expect(stage2.lines[0].quantity).toBe(2);
    expect(stage2.lines[0].pricingMeta?.previewQuantity).toBe(2);
    // Y los importes también convergen al snapshot nuevo.
    expect(stage2.lines[0].discountAmount).toBe(200);
    expect(stage2.lines[0].subtotal).toBe(1800);
  });
});
