// src/lib/pricing/__tests__/baseline-normalize-current-behavior.test.ts
// =============================================================================
// FASE 1.0 — PR1 baseline. Congela el comportamiento ACTUAL del normalizador
// (legacy + correct) antes de la migración a "frontend reader-only".
//
// Convención de naming:
//   · "baseline correct: ..."     comportamiento ya alineado con POLICY.md.
//   · "baseline legacy: ..."      comportamiento que migraremos en Fase 1.2+.
//   · "baseline suspicious: ..."  comportamiento dudoso a revisar.
//
// REGLA: este archivo NO arregla bugs. Solo documenta el estado actual.
// Si algo se ve mal acá, queda igual hasta la migración correspondiente.
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  normalizeArticlePricingPreview,
  normalizeSalesPreview,
} from "../normalizePricingPreviewResult";

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
    metalHechuraBreakdown:  null,
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

function makeSalesPreview(overrides: Record<string, any> = {}) {
  return {
    lines: [
      {
        articleId: "art-1",
        variantId: null,
        quantity:  2,
        basePrice: 1000,
        unitPrice: 900,
        unitTaxAmount:    189,
        unitTotalWithTax: 1089,
        quantityDiscountAmount:  100,
        promotionDiscountAmount: 0,
        // El backend de sales emite per-line ya escalado por qty:
        lineTotal:        1800,
        lineTaxAmount:    378,
        lineTotalWithTax: 2178,
        lineDiscount:     200,
        priceSource:          "PRICE_LIST",
        appliedPriceListId:   "pl-1",
        appliedPriceListName: "Lista A",
        appliedPriceListMode: null,
        appliedPromotionId:   null,
        appliedPromotionName: null,
        appliedDiscountId:    null,
        unitCost:      500,
        unitMargin:    400,
        marginPercent: 44.44,
        costMode:      "COST_LINES",
        costPartial:   false,
        taxBreakdown:  [],
        appliedRounding: null,
        metalHechuraBreakdown: null,
      },
    ],
    documentTotals: {
      subtotalBeforeDiscounts:    2000,
      lineDiscountAmount:         200,
      subtotalAfterLineDiscounts: 1800,
      channelAdjustmentAmount:    0,
      couponDiscountAmount:       0,
      paymentAdjustmentAmount:    0,
      shippingAmount:             0,
      globalDiscountAmount:       0,
      taxableBase:                1800,
      taxAmount:                  378,
      roundingAdjustment:         0,
      totalBeforeTax:             1800,
      totalWithTax:               2178,
      total:                      2178,
    },
    channelResult:  null,
    couponResult:   null,
    checkoutResult: null,
    ...overrides,
  };
}

// =============================================================================
// 1. ARTICLE_PRICING_PREVIEW — comportamiento legacy de escalado per-unit×qty
//    Estos tests capturan el bug que migraremos en Fase 1.2 (POLICY.md R4.5).
// =============================================================================

describe("normalizeArticlePricingPreview — escalado per-unit×qty (legacy)", () => {
  it("baseline legacy: lineTotal = r2(unitPrice × qty) escalado por el normalizador", () => {
    const result = makeArticleResult({ unitPrice: "100.00", basePrice: "100.00" });
    const norm = normalizeArticlePricingPreview({
      result: result as any,
      articleId: "a1",
      quantity:  3,
    });
    // Hoy el normalizador hace `r2(unitPrice * qty)` = r2(300) = 300.
    // Cuando el backend exponga `lineTotal` per-línea (Gap G3), este test
    // se cambiará a passthrough.
    expect(norm.lines[0].lineTotal).toBe(300);
  });

  it("baseline legacy: lineTaxAmount = r2(unitTax × qty) escalado por el normalizador", () => {
    const result = makeArticleResult({ taxAmount: "21.00" });
    const norm = normalizeArticlePricingPreview({
      result: result as any,
      articleId: "a1",
      quantity:  4,
    });
    // r2(21 * 4) = 84. Hoy lo computa el frontend.
    expect(norm.lines[0].lineTaxAmount).toBe(84);
  });

  it("baseline legacy: lineTotalWithTax = r2(unitTotalWithTax × qty) escalado", () => {
    const result = makeArticleResult({ totalWithTax: "1210" });
    const norm = normalizeArticlePricingPreview({
      result: result as any,
      articleId: "a1",
      quantity:  5,
    });
    expect(norm.lines[0].lineTotalWithTax).toBe(6050);
  });

  it("baseline legacy: lineDiscount = r2((basePrice - unitPrice) × qty)", () => {
    const result = makeArticleResult({ basePrice: "1000", unitPrice: "900" });
    const norm = normalizeArticlePricingPreview({
      result: result as any,
      articleId: "a1",
      quantity:  3,
    });
    expect(norm.lines[0].lineDiscount).toBe(300);
  });

  it("baseline legacy: channel.amount = r2(channelPerUnit × qty)", () => {
    const result = makeArticleResult({
      channelResult: {
        channelId:     "ch-1",
        channelName:   "Mayorista",
        channelAmount: 50,
        applyMode:     "DISCOUNT",
        applyValue:    5,
      },
    });
    const norm = normalizeArticlePricingPreview({
      result: result as any,
      articleId: "a1",
      quantity:  3,
    });
    // 50 × 3 = 150. Migración Fase 1.2 lo va a leer de documentTotals.channelAdjustmentAmount.
    expect(norm.channel?.amount).toBe(150);
  });

  it("baseline legacy: coupon.amount = r2(couponPerUnit × qty) cuando applied=true", () => {
    const result = makeArticleResult({
      couponResult: {
        couponCode:     "DESC10",
        couponName:     "10% off",
        applied:        true,
        discountAmount: 100,
      },
    });
    const norm = normalizeArticlePricingPreview({
      result: result as any,
      articleId: "a1",
      quantity:  2,
    });
    expect(norm.coupon?.amount).toBe(200);
    expect(norm.coupon?.applied).toBe(true);
  });

  it("baseline correct: coupon.amount = 0 cuando applied=false (no escala el rejected)", () => {
    const result = makeArticleResult({
      couponResult: {
        couponCode:     "INVALIDO",
        applied:        false,
        reason:         "expirado",
        discountAmount: 100,
      },
    });
    const norm = normalizeArticlePricingPreview({
      result: result as any,
      articleId: "a1",
      quantity:  3,
    });
    expect(norm.coupon?.amount).toBe(0);
    expect(norm.coupon?.applied).toBe(false);
  });
});

// =============================================================================
// 2. ARTICLE_PRICING_PREVIEW — passthrough de documentTotals (correct)
//    El backend del simulador YA emite documentTotals per-doc desde el motor.
//    Este es el camino que reemplazará al escalado per-unit×qty.
// =============================================================================

describe("normalizeArticlePricingPreview — documentTotals (passthrough correcto)", () => {
  it("baseline correct: documentTotals.total es passthrough exacto", () => {
    const result = makeArticleResult({
      documentTotals: {
        subtotalBeforeDiscounts:    1234.56,
        lineDiscountAmount:         12.34,
        subtotalAfterLineDiscounts: 1222.22,
        channelAdjustmentAmount:    11.11,
        couponDiscountAmount:       22.22,
        paymentAdjustmentAmount:    0,
        shippingAmount:             0,
        globalDiscountAmount:       0,
        taxableBase:                1211.11,
        taxAmount:                  254.33,
        roundingAdjustment:         0,
        totalBeforeTax:             1211.11,
        totalWithTax:               1465.44,
        total:                      1465.44,
      },
    });
    const norm = normalizeArticlePricingPreview({
      result: result as any,
      articleId: "a1",
      quantity:  1,
    });
    expect(norm.documentTotals.total).toBe(1465.44);
    expect(norm.documentTotals.taxAmount).toBe(254.33);
    expect(norm.documentTotals.channelAdjustmentAmount).toBe(11.11);
    expect(norm.documentTotals.couponDiscountAmount).toBe(22.22);
  });

  it("baseline correct: documentTotals con todos los campos en 0 cuando el backend no los emite", () => {
    const result = makeArticleResult({ documentTotals: undefined });
    const norm = normalizeArticlePricingPreview({
      result: result as any,
      articleId: "a1",
      quantity:  1,
    });
    expect(norm.documentTotals.total).toBe(0);
    expect(norm.documentTotals.taxAmount).toBe(0);
    expect(norm.documentTotals.subtotalBeforeDiscounts).toBe(0);
  });
});

// =============================================================================
// 3. SALES_PREVIEW — passthrough puro (camino objetivo de la migración)
//    El endpoint /api/sales/preview ya emite per-line y per-doc desde el motor.
// =============================================================================

describe("normalizeSalesPreview — passthrough puro (correct)", () => {
  it("baseline correct: lineTotal es passthrough exacto del backend (NO escala por qty)", () => {
    const raw = makeSalesPreview();
    const norm = normalizeSalesPreview(raw as any);
    // El backend emite lineTotal=1800 (qty=2 × unitPrice=900). El frontend
    // NO multiplica acá: lo lee tal cual.
    expect(norm.lines[0].lineTotal).toBe(1800);
    expect(norm.lines[0].lineTaxAmount).toBe(378);
    expect(norm.lines[0].lineTotalWithTax).toBe(2178);
    expect(norm.lines[0].lineDiscount).toBe(200);
  });

  it("baseline correct: documentTotals.* son passthrough exacto", () => {
    const raw = makeSalesPreview();
    const norm = normalizeSalesPreview(raw as any);
    expect(norm.documentTotals.total).toBe(2178);
    expect(norm.documentTotals.taxAmount).toBe(378);
    expect(norm.documentTotals.lineDiscountAmount).toBe(200);
    expect(norm.documentTotals.subtotalAfterLineDiscounts).toBe(1800);
  });

  it("baseline correct: unitPrice / basePrice no se redondean ni reformatean", () => {
    const raw = makeSalesPreview({
      lines: [
        {
          ...makeSalesPreview().lines[0],
          basePrice: 1234.567,
          unitPrice: 987.6543,
        },
      ],
    });
    const norm = normalizeSalesPreview(raw as any);
    expect(norm.lines[0].basePrice).toBe(1234.567);
    expect(norm.lines[0].unitPrice).toBe(987.6543);
  });

  it("baseline correct: documentTotals con shippingAmount > 0 produce shipping object", () => {
    const raw = makeSalesPreview({
      documentTotals: {
        ...makeSalesPreview().documentTotals,
        shippingAmount: 500,
      },
    });
    const norm = normalizeSalesPreview(raw as any);
    expect(norm.shipping).not.toBeNull();
    expect(norm.shipping?.amount).toBe(500);
  });

  it("baseline correct: shippingAmount=0 produce shipping=null", () => {
    const raw = makeSalesPreview();
    const norm = normalizeSalesPreview(raw as any);
    expect(norm.shipping).toBeNull();
  });
});

// =============================================================================
// 4. taxBreakdown — passthrough sin alterar valores
// =============================================================================

describe("normalizeTaxBreakdown — passthrough (correct)", () => {
  it("baseline correct: taxBreakdown items son passthrough con casteo defensivo a Number", () => {
    const result = makeArticleResult({
      taxBreakdown: [
        { taxId: "t1", name: "IVA",  rate: "21",   base: "1000", taxAmount: "210", applyOn: "TOTAL" },
        { taxId: "t2", name: "IIBB", rate: "3.5", base: "1000", taxAmount: "35",  applyOn: "TOTAL" },
      ],
    });
    const norm = normalizeArticlePricingPreview({
      result: result as any,
      articleId: "a1",
      quantity:  1,
    });
    expect(norm.lines[0].taxBreakdown).toHaveLength(2);
    expect(norm.lines[0].taxBreakdown[0]).toMatchObject({
      taxId:      "t1",
      name:       "IVA",
      rate:       21,
      baseAmount: 1000,
      taxAmount:  210,
      applyOn:    "TOTAL",
    });
    expect(norm.lines[0].taxBreakdown[1].rate).toBe(3.5);
  });

  it("baseline correct: taxBreakdown vacío o null devuelve []", () => {
    const result = makeArticleResult({ taxBreakdown: null });
    const norm = normalizeArticlePricingPreview({
      result: result as any,
      articleId: "a1",
      quantity:  1,
    });
    expect(norm.lines[0].taxBreakdown).toEqual([]);
  });
});

// =============================================================================
// 5. composition — passthrough (incluyendo nulls)
// =============================================================================

describe("normalizeComposition — passthrough (correct)", () => {
  it("baseline correct: composition con metal pasa todos los campos sin recálculo", () => {
    const result = makeArticleResult({
      composition: {
        metal: {
          originalGrams:    5,
          appliedGrams:     5,
          gramsManual:      false,
          appliedMermaPct:  10,
          purity:           0.75,
          purityLabel:      "18k",
          metalName:        "Oro",
          pureGramsBase:    4.125,
          pureGramsSale:    5.156,
        },
        hechura: { originalAmount: 200, appliedAmount: 200, manual: false, appliesTo: "UNIT" },
        taxes:   [],
      },
    });
    const norm = normalizeArticlePricingPreview({
      result: result as any,
      articleId: "a1",
      quantity:  1,
    });
    expect(norm.lines[0].composition?.metal).toMatchObject({
      appliedGrams:    5,
      appliedMermaPct: 10,
      purity:          0.75,
      pureGramsBase:   4.125,
      pureGramsSale:   5.156,
    });
    expect(norm.lines[0].composition?.hechura?.appliedAmount).toBe(200);
  });

  it("baseline correct: composition null cuando el backend no lo emite", () => {
    const result = makeArticleResult({ composition: null });
    const norm = normalizeArticlePricingPreview({
      result: result as any,
      articleId: "a1",
      quantity:  1,
    });
    expect(norm.lines[0].composition).toBeNull();
  });
});

// =============================================================================
// 6. priceSource y metadata — passthrough
// =============================================================================

describe("normalizeArticlePricingPreview — metadata passthrough", () => {
  it("baseline correct: priceSource, applied{PriceList,Promotion,Discount} son passthrough", () => {
    const result = makeArticleResult({
      priceSource:          "PROMOTION",
      appliedPriceListId:   "pl-1",
      appliedPriceListName: "Lista oro",
      appliedPromotionId:   "promo-1",
      appliedPromotionName: "Black Friday",
      appliedDiscountId:    "disc-1",
    });
    const norm = normalizeArticlePricingPreview({
      result: result as any,
      articleId: "a1",
      quantity:  1,
    });
    expect(norm.lines[0].priceSource).toBe("PROMOTION");
    expect(norm.lines[0].appliedPromotionId).toBe("promo-1");
    expect(norm.lines[0].appliedPromotionName).toBe("Black Friday");
    expect(norm.lines[0].appliedDiscountId).toBe("disc-1");
  });

  it("baseline correct: source del result raíz indica el endpoint origen", () => {
    const articleNorm = normalizeArticlePricingPreview({
      result: makeArticleResult() as any,
      articleId: "a1",
      quantity:  1,
    });
    const salesNorm = normalizeSalesPreview(makeSalesPreview() as any);
    expect(articleNorm.source).toBe("ARTICLE_PRICING_PREVIEW");
    expect(salesNorm.source).toBe("SALES_PREVIEW");
  });
});
