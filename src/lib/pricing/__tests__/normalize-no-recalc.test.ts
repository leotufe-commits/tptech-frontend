// src/lib/pricing/__tests__/normalize-no-recalc.test.ts
// =============================================================================
// SPRINT 2 — Frontend Reader Pure (POLICY.md §4)
//
// Verifica que el normalizador NO reconstruye campos comerciales:
//   · pureGramsBase / pureGramsSale: passthrough del backend (Sprint 1 los
//     dejó null hasta que el motor propague purity).
//   · customerDiscountAmount: el helper composeDocumentPricingDetail no lo
//     deriva como (lineDiscountAmount − qty − promo); usa adjustments del
//     backend cuando existen, null cuando no.
//   · resolveLegacyShippingAmount: marcado @deprecated; emite warning.
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { normalizeArticlePricingPreview } from "../normalizePricingPreviewResult";
import { resolveLegacyShippingAmount } from "../buildPricingPreviewPayload";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeArticleResult(overrides: Record<string, any> = {}) {
  return {
    basePrice:    "1000",
    unitPrice:    "1000",
    taxAmount:    "0",
    totalWithTax: "1000",
    quantityDiscountAmount:  "0",
    promotionDiscountAmount: "0",
    priceSource:  "PRICE_LIST",
    appliedPriceListId:   "pl-1",
    appliedPriceListName: "Lista test",
    appliedPromotionId:   null,
    appliedPromotionName: null,
    appliedDiscountId:    null,
    unitCost:      "500",
    unitMargin:    "500",
    marginPercent: "50",
    costMode:      "COST_LINES",
    costPartial:   false,
    taxBreakdown:  [],
    appliedRounding: null,
    partial:           false,
    taxExemptByEntity: false,
    composition:       null,
    metalHechuraBreakdown: null,
    componentSaleBreakdown: null,
    costOverrideContext:    null,
    documentTotals:    {
      subtotalBeforeDiscounts:    1000,
      lineDiscountAmount:         0,
      subtotalAfterLineDiscounts: 1000,
      channelAdjustmentAmount:    0,
      couponDiscountAmount:       0,
      paymentAdjustmentAmount:    0,
      shippingAmount:             0,
      globalDiscountAmount:       0,
      taxableBase:                1000,
      taxAmount:                  0,
      roundingAdjustment:         0,
      totalBeforeTax:             1000,
      totalWithTax:               1000,
      total:                      1000,
    },
    ...overrides,
  };
}

// =============================================================================
// 1. pureGramsBase / pureGramsSale — passthrough del backend
// =============================================================================

describe("normalizeArticlePricingPreview — pureGrams (Sprint 2 / POLICY.md R4.1)", () => {
  it("propaga pureGramsBase null si el backend lo emite null", () => {
    const result = makeArticleResult({
      composition: {
        metal: {
          appliedGrams:    5,
          purity:          0.75,
          appliedMermaPct: 10,
          // pureGramsBase NO viene del backend → null
          pureGramsBase: null,
          pureGramsSale: null,
        },
      },
    });

    const norm = normalizeArticlePricingPreview({
      result: result as any,
      articleId: "a1",
      quantity:  1,
    });

    expect(norm.lines[0].composition?.metal?.pureGramsBase).toBeNull();
    expect(norm.lines[0].composition?.metal?.pureGramsSale).toBeNull();
  });

  it("NO calcula pureGramsBase desde appliedGrams × purity localmente", () => {
    // Sprint 1 / POLICY.md §4 R4.3 — antes el frontend hacía:
    //   pureGramsBase = appliedGrams × purity × (1 + merma%/100) = 5 × 0.75 × 1.10
    // Ese cálculo está prohibido. Si el backend no emite el campo, el
    // resultado es null aunque haya datos suficientes para reconstruirlo.
    const result = makeArticleResult({
      composition: {
        metal: {
          appliedGrams:    5,
          purity:          0.75,
          appliedMermaPct: 10,
          // backend no lo emite
          pureGramsBase: undefined,
          pureGramsSale: undefined,
        },
      },
      metalHechuraBreakdown: { metalMarginPct: 25 } as any,
    });

    const norm = normalizeArticlePricingPreview({
      result: result as any,
      articleId: "a1",
      quantity:  1,
    });

    expect(norm.lines[0].composition?.metal?.pureGramsBase).toBeNull();
    expect(norm.lines[0].composition?.metal?.pureGramsSale).toBeNull();
  });

  it("propaga pureGramsBase y pureGramsSale tal cual cuando el backend los emite", () => {
    const result = makeArticleResult({
      composition: {
        metal: {
          appliedGrams:    5,
          purity:          0.75,
          appliedMermaPct: 10,
          pureGramsBase:   4.125,
          pureGramsSale:   5.156,
        },
      },
    });

    const norm = normalizeArticlePricingPreview({
      result: result as any,
      articleId: "a1",
      quantity:  1,
    });

    expect(norm.lines[0].composition?.metal?.pureGramsBase).toBe(4.125);
    expect(norm.lines[0].composition?.metal?.pureGramsSale).toBe(5.156);
  });
});

// =============================================================================
// 2. Valores numéricos del snapshot — no se alteran
// =============================================================================

describe("normalizeArticlePricingPreview — no altera valores numéricos del backend", () => {
  it("unitPrice y basePrice llegan tal cual del backend", () => {
    const result = makeArticleResult({
      basePrice: "1234.56",
      unitPrice: "987.65",
    });

    const norm = normalizeArticlePricingPreview({
      result: result as any,
      articleId: "a1",
      quantity:  1,
    });

    expect(norm.lines[0].basePrice).toBe(1234.56);
    expect(norm.lines[0].unitPrice).toBe(987.65);
  });

  it("documentTotals.total es passthrough exacto", () => {
    const result = makeArticleResult({
      documentTotals: {
        subtotalBeforeDiscounts:    1000,
        lineDiscountAmount:         100,
        subtotalAfterLineDiscounts: 900,
        channelAdjustmentAmount:    0,
        couponDiscountAmount:       0,
        paymentAdjustmentAmount:    0,
        shippingAmount:             0,
        globalDiscountAmount:       0,
        taxableBase:                900,
        taxAmount:                  189,
        roundingAdjustment:         0,
        totalBeforeTax:             900,
        totalWithTax:               1089,
        total:                      1089,
      },
    });

    const norm = normalizeArticlePricingPreview({
      result: result as any,
      articleId: "a1",
      quantity:  1,
    });

    expect(norm.documentTotals.total).toBe(1089);
    expect(norm.documentTotals.taxAmount).toBe(189);
    expect(norm.documentTotals.lineDiscountAmount).toBe(100);
  });
});

// =============================================================================
// 3. resolveLegacyShippingAmount — deprecada, emite warning
// =============================================================================

describe("resolveLegacyShippingAmount — deprecada (Sprint 2)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("emite console.warn cuando se invoca con shipping FIXED", () => {
    const result = resolveLegacyShippingAmount({ mode: "FIXED", value: 500, weight: null });
    expect(result).toBe(500);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(/deprecado/i);
  });

  it("emite console.warn cuando se invoca con shipping BY_WEIGHT", () => {
    const result = resolveLegacyShippingAmount({ mode: "BY_WEIGHT", value: 100, weight: 2 });
    expect(result).toBe(200);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("NO emite warning para FREE (no hay cálculo)", () => {
    const result = resolveLegacyShippingAmount({ mode: "FREE", value: null, weight: null });
    expect(result).toBe(0);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("NO emite warning cuando shipping es null/undefined", () => {
    expect(resolveLegacyShippingAmount(null)).toBeNull();
    expect(resolveLegacyShippingAmount(undefined)).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
