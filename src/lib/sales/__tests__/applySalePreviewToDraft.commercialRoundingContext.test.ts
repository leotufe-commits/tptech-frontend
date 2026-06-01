// src/lib/sales/__tests__/applySalePreviewToDraft.commercialRoundingContext.test.ts
// =============================================================================
// Etapa D' (cierre conceptual) — Anti-regresión del transporte del campo
// `commercialRoundingContext` desde `preview.lines[i]` hasta
// `draft.lines[i].pricingMeta.commercialRoundingContext`.
//
// Bug detectado en audit end-to-end: el handler `applySalePreviewToDraft`
// omitía copiar este campo a `pricingMeta`, lo que hacía que el bloque
// "Redondeo comercial" del card de artículo NUNCA renderizara (recibía
// `null` aunque el backend lo emitía).
//
// REGLA DE ORO verificada:
//   - El frontend no recalcula nada — solo verifica que el campo viaja.
//   - El valor del campo viene del backend tal cual (passthrough).
//   - Cuando es `null`, el draft lo persiste como `null`.
// =============================================================================

import { describe, it, expect } from "vitest";
import { applySalePreviewToDraft } from "../applySalePreviewToDraft";
import type { SalesInvoice } from "../types";
import type { SalePreviewResult } from "../../../services/sales";

function makeLine(): SalesInvoice["lines"][number] {
  return {
    id:             "line-1",
    type:           "ARTICLE",
    article:        "Anillo Oro 18K",
    variant:        "",
    articleId:      "art-1",
    quantity:       1,
    unitPrice:      0,
    discountAmount: 0,
    subtotal:       0,
    taxAmount:      0,
    lineTotal:      0,
  } as any;
}

function makeDraft(): SalesInvoice {
  return { lines: [makeLine()] } as SalesInvoice;
}

function makePreview(commercialRoundingContext: any): SalePreviewResult {
  return {
    lines: [{
      articleId:               "art-1",
      variantId:               null,
      quantity:                1,
      basePrice:               115000,
      unitPrice:               115000,
      unitTaxAmount:           0,
      unitTotalWithTax:        115000,
      quantityDiscountAmount:  0,
      promotionDiscountAmount: 0,
      lineSubtotal:            115000,
      lineTotal:               115000,
      lineDiscount:            0,
      lineTaxAmount:           0,
      lineTotalWithTax:        115000,
      priceSource:             "PRICE_LIST",
      appliedPriceListId:      "pl-doc",
      appliedPriceListName:    "Lista PER_DOCUMENT",
      appliedPromotionId:      null,
      appliedPromotionName:    null,
      unitCost:                60400,
      unitMargin:              54600,
      marginPercent:           90.4,
      metalHechuraBreakdown:   null,
      taxBreakdown:            [],
      commercialRoundingContext,
    }] as any,
    documentTotals: {
      subtotalBeforeDiscounts:    115000,
      lineDiscountAmount:         0,
      subtotalAfterLineDiscounts: 115000,
      couponDiscountAmount:       0,
      globalDiscountAmount:       0,
      taxAmount:                  0,
      shippingAmount:             0,
      total:                      115000,
    },
  } as any;
}

// Fixture del caso real auditado: saldo monetario 182091.10 → 182100.
const CTX_BREAKDOWN_HECHURA = {
  source:             "PRICE_LIST",
  scope:              "BREAKDOWN",
  appliedAt:          "DOCUMENT",
  appliedToLineCount: 1,
  totalAdjustment:    8.90,
  breakdown: {
    metals: [],
    metalMonetaryEquivalent: 0,
    hechura: {
      preRoundingSaldoMonetario:  182091.10,
      postRoundingSaldoMonetario: 182100,
      deltaSaldoMonetario:        8.90,
      mode:                       "HUNDRED",
      direction:                  "NEAREST",
      source:                     "PRICE_LIST_HECHURA",
    },
    combinedAdjustment: 8.90,
  },
} as const;

describe("applySalePreviewToDraft — transporte de commercialRoundingContext", () => {
  it("BREAKDOWN — copia el snapshot completo a pricingMeta tal cual", () => {
    const draft = makeDraft();
    const out   = applySalePreviewToDraft(draft, makePreview(CTX_BREAKDOWN_HECHURA));
    const ctx   = (out.lines[0] as any).pricingMeta?.commercialRoundingContext;
    expect(ctx).not.toBeNull();
    expect(ctx).not.toBeUndefined();
    // Passthrough byte-equivalente — el frontend NO recalcula nada.
    expect(JSON.stringify(ctx)).toBe(JSON.stringify(CTX_BREAKDOWN_HECHURA));
  });

  it("UNIFIED — copia el snapshot UNIFIED tal cual", () => {
    const ctxUnified = {
      source:             "PRICE_LIST",
      scope:              "UNIFIED",
      appliedAt:          "DOCUMENT",
      appliedToLineCount: 3,
      totalAdjustment:    -8.90,
      unified: { pre: 200, post: 191.10, adjustment: -8.90, mode: "HUNDRED", direction: "DOWN" },
    };
    const out = applySalePreviewToDraft(makeDraft(), makePreview(ctxUnified));
    const ctx = (out.lines[0] as any).pricingMeta?.commercialRoundingContext;
    expect(JSON.stringify(ctx)).toBe(JSON.stringify(ctxUnified));
    expect(ctx.appliedAt).toBe("DOCUMENT");
    expect(ctx.appliedToLineCount).toBe(3);
  });

  it("null — pricingMeta.commercialRoundingContext queda null (PER_LINE_LEGACY o mixed-list)", () => {
    const out = applySalePreviewToDraft(makeDraft(), makePreview(null));
    expect((out.lines[0] as any).pricingMeta?.commercialRoundingContext).toBeNull();
  });

  it("undefined en el preview — pricingMeta.commercialRoundingContext queda null (defensa)", () => {
    const out = applySalePreviewToDraft(makeDraft(), makePreview(undefined));
    expect((out.lines[0] as any).pricingMeta?.commercialRoundingContext).toBeNull();
  });

  it("metadata appliedToLineCount viene del backend, NUNCA del frontend", () => {
    // El backend cuenta líneas y emite appliedToLineCount: N.
    // El frontend NUNCA hace `lines.length` para inferirlo.
    const ctxBigDoc = {
      source:             "PRICE_LIST",
      scope:              "BREAKDOWN",
      appliedAt:          "DOCUMENT",
      appliedToLineCount: 7,         // ← backend dice 7 (aunque el preview de test tiene solo 1)
      totalAdjustment:    0,
      breakdown: {
        metals: [],
        metalMonetaryEquivalent: 0,
        hechura: {
          preRoundingSaldoMonetario:  100,
          postRoundingSaldoMonetario: 100,
          deltaSaldoMonetario:        0,
          mode:                       "HUNDRED",
          direction:                  "NEAREST",
          source:                     "PRICE_LIST_HECHURA",
        },
        combinedAdjustment: 0,
      },
    };
    const out = applySalePreviewToDraft(makeDraft(), makePreview(ctxBigDoc));
    const ctx = (out.lines[0] as any).pricingMeta?.commercialRoundingContext;
    // El frontend RESPETA el conteo del backend — no lo recalcula.
    expect(ctx.appliedToLineCount).toBe(7);
  });
});
