// src/lib/pricing/__tests__/g4-1-normalize-composition-items.test.ts
// =============================================================================
// FASE F1.3 G4.1 (frontend #6) — types/plumbing del normalize.
//
// Alcance del commit:
//   1. composition.products[] / services[] tipados y normalizados como arrays.
//   2. componentSaleBreakdown.salePreManualDiscount tipado y propagado.
//   3. Retrocompat snapshots viejos (sin products/services/salePreManualDiscount).
//
// NO tocamos UI en este commit (LineAdvancedOverridesPanel / fila Pre-bonif. /
// labels — todo pendiente para #7-#9).
//
// Reglas verificadas:
//   · Passthrough puro — cero matemática derivada.
//   · Defaults seguros — array []; salePreManualDiscount → null si ausente.
//   · Tipos discriminados (lineAdjKind / lineAdjType) caen a null si raw inválido.
// =============================================================================

import { describe, it, expect } from "vitest";
import { normalizeArticlePricingPreview } from "../normalizePricingPreviewResult";

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
    discountAmount:       "0",
    partial: false,
    appliedPriceList:     null,
    appliedPromotion:     null,
    appliedQuantityDiscount: null,
    composition: {
      metal:   null,
      hechura: null,
      taxes:   [],
      ...overrides.composition,
    },
    cost:                       null,
    purchaseTaxAmount:          0,
    purchaseTaxBreakdown:       [],
    clientCommercialRules:      null,
    appliedClientCommercialRule: null,
    ...overrides,
  };
}

// =============================================================================
// 1. composition.products[] / composition.services[] — defaults seguros
// =============================================================================

describe("F1.3 G4.1 — composition.products/services normalize", () => {
  it("baseline correct: snapshot v3 sin products/services → arrays vacíos (no crash)", () => {
    const raw = makeArticleResult();   // composition sin products/services
    const r = normalizeArticlePricingPreview({ result: raw as any, articleId: "a1", quantity: 1 });
    expect(r.lines[0].composition).not.toBeNull();
    expect(r.lines[0].composition!.products).toEqual([]);
    expect(r.lines[0].composition!.services).toEqual([]);
  });

  it("baseline correct: products/services con items → preserva los 13 campos", () => {
    const raw = makeArticleResult({
      composition: {
        products: [{
          costLineId:      "cl-p1",
          catalogItemId:   "art-P",
          catalogItemCode: "ZAF-01",
          catalogItemName: "Zafiro 0.5ct",
          quantity:        2,
          unitValue:       50,
          totalValue:      100,
          currencyId:      null,
          lineAdjKind:     "BONUS",
          lineAdjType:     "PERCENTAGE",
          lineAdjValue:    10,
          lineAdjAmount:   5,
          affectsStock:    true,
        }],
        services: [{
          costLineId:      "cl-s1",
          catalogItemId:   "art-S",
          catalogItemCode: "ENG-01",
          catalogItemName: "Engaste profesional",
          quantity:        1,
          unitValue:       80,
          totalValue:      80,
          currencyId:      "USD",
          lineAdjKind:     "SURCHARGE",
          lineAdjType:     "FIXED_AMOUNT",
          lineAdjValue:    20,
          lineAdjAmount:   20,
          affectsStock:    false,
        }],
      },
    });
    const r = normalizeArticlePricingPreview({ result: raw as any, articleId: "a1", quantity: 1 });
    expect(r.lines[0].composition!.products).toHaveLength(1);
    expect(r.lines[0].composition!.products[0]).toEqual({
      costLineId:      "cl-p1",
      catalogItemId:   "art-P",
      catalogItemCode: "ZAF-01",
      catalogItemName: "Zafiro 0.5ct",
      quantity:        2,
      unitValue:       50,
      totalValue:      100,
      currencyId:      null,
      lineAdjKind:     "BONUS",
      lineAdjType:     "PERCENTAGE",
      lineAdjValue:    10,
      lineAdjAmount:   5,
      affectsStock:    true,
    });
    expect(r.lines[0].composition!.services[0]).toEqual({
      costLineId:      "cl-s1",
      catalogItemId:   "art-S",
      catalogItemCode: "ENG-01",
      catalogItemName: "Engaste profesional",
      quantity:        1,
      unitValue:       80,
      totalValue:      80,
      currencyId:      "USD",
      lineAdjKind:     "SURCHARGE",
      lineAdjType:     "FIXED_AMOUNT",
      lineAdjValue:    20,
      lineAdjAmount:   20,
      affectsStock:    false,
    });
  });

  it("baseline correct: lineAdjKind con valor inválido cae a null (defensa de tipos)", () => {
    const raw = makeArticleResult({
      composition: {
        products: [{
          costLineId: null, catalogItemId: null,
          catalogItemCode: null, catalogItemName: null,
          quantity: 1, unitValue: 10, totalValue: 10, currencyId: null,
          lineAdjKind: "INVALIDO",       // raw corrupto
          lineAdjType: "PERCENTAGE",
          lineAdjValue: null, lineAdjAmount: null, affectsStock: null,
        }],
      },
    });
    const r = normalizeArticlePricingPreview({ result: raw as any, articleId: "a1", quantity: 1 });
    expect(r.lines[0].composition!.products[0].lineAdjKind).toBeNull();
    expect(r.lines[0].composition!.products[0].lineAdjType).toBe("PERCENTAGE");
  });

  it("baseline correct: lineAdjAmount/lineAdjValue ausentes → null (no 0)", () => {
    const raw = makeArticleResult({
      composition: {
        services: [{
          costLineId: null, catalogItemId: null,
          catalogItemCode: null, catalogItemName: null,
          quantity: 1, unitValue: 80, totalValue: 80, currencyId: null,
          lineAdjKind: null, lineAdjType: null,
          // lineAdjValue / lineAdjAmount NO emitidos por backend.
          affectsStock: null,
        }],
      },
    });
    const r = normalizeArticlePricingPreview({ result: raw as any, articleId: "a1", quantity: 1 });
    expect(r.lines[0].composition!.services[0].lineAdjAmount).toBeNull();
    expect(r.lines[0].composition!.services[0].lineAdjValue).toBeNull();
  });

  it("baseline correct: affectsStock fuera de boolean → null (no se asume false)", () => {
    const raw = makeArticleResult({
      composition: {
        services: [{
          costLineId: null, catalogItemId: null,
          catalogItemCode: null, catalogItemName: null,
          quantity: 1, unitValue: 80, totalValue: 80, currencyId: null,
          lineAdjKind: null, lineAdjType: null,
          lineAdjValue: null, lineAdjAmount: null,
          affectsStock: "yes",  // raw inválido
        }],
      },
    });
    const r = normalizeArticlePricingPreview({ result: raw as any, articleId: "a1", quantity: 1 });
    expect(r.lines[0].composition!.services[0].affectsStock).toBeNull();
  });

  it("baseline correct: products no-array (raw corrupto) → []", () => {
    const raw = makeArticleResult({
      composition: { products: "not-an-array", services: null as any },
    });
    const r = normalizeArticlePricingPreview({ result: raw as any, articleId: "a1", quantity: 1 });
    expect(r.lines[0].composition!.products).toEqual([]);
    expect(r.lines[0].composition!.services).toEqual([]);
  });

  it("baseline correct: passthrough — quantity/unitValue/totalValue NO se recalculan", () => {
    // Si el backend dijera totalValue=999 con quantity=2 y unitValue=50,
    // el frontend NO debe corregir a 100. POLICY R4.5: cero matemática.
    const raw = makeArticleResult({
      composition: {
        products: [{
          costLineId: null, catalogItemId: null,
          catalogItemCode: null, catalogItemName: null,
          quantity: 2, unitValue: 50, totalValue: 999,    // intencional
          currencyId: null,
          lineAdjKind: null, lineAdjType: null,
          lineAdjValue: null, lineAdjAmount: null, affectsStock: null,
        }],
      },
    });
    const r = normalizeArticlePricingPreview({ result: raw as any, articleId: "a1", quantity: 1 });
    expect(r.lines[0].composition!.products[0].totalValue).toBe(999);
    expect(r.lines[0].composition!.products[0].quantity).toBe(2);
    expect(r.lines[0].composition!.products[0].unitValue).toBe(50);
  });
});

// =============================================================================
// 2. componentSaleBreakdown.salePreManualDiscount — passthrough puro
// =============================================================================

describe("F1.3 G4.3 — componentSaleBreakdown.salePreManualDiscount normalize", () => {
  it("baseline correct: snapshot v3 sin salePreManualDiscount → null seguro", () => {
    const raw = makeArticleResult({
      componentSaleBreakdown: {
        metal:   { base: 600, final: 540, adjustments: [] },
        hechura: { base: 400, final: 400, adjustments: [] },
      },
    });
    const r = normalizeArticlePricingPreview({ result: raw as any, articleId: "a1", quantity: 1 });
    expect(r.lines[0].componentSaleBreakdown).not.toBeNull();
    expect(r.lines[0].componentSaleBreakdown!.metal.salePreManualDiscount).toBeNull();
    expect(r.lines[0].componentSaleBreakdown!.hechura.salePreManualDiscount).toBeNull();
  });

  it("baseline correct: salePreManualDiscount presente → preserva tal cual", () => {
    const raw = makeArticleResult({
      componentSaleBreakdown: {
        metal: {
          base: 600, final: 540, salePreManualDiscount: 600,   // sin manual
          adjustments: [{ kind: "ENTITY_RULE", amount: 60, applyOn: "METAL", label: "Cliente" }],
        },
        hechura: {
          base: 400, final: 380, salePreManualDiscount: 400,
          adjustments: [{ kind: "MANUAL_DISCOUNT", amount: 20, applyOn: "HECHURA", label: "Bonif" }],
        },
      },
    });
    const r = normalizeArticlePricingPreview({ result: raw as any, articleId: "a1", quantity: 1 });
    expect(r.lines[0].componentSaleBreakdown!.metal.salePreManualDiscount).toBe(600);
    expect(r.lines[0].componentSaleBreakdown!.hechura.salePreManualDiscount).toBe(400);
  });

  it("baseline correct: pre === final ⇒ threshold visual cumplido (UI no rendereiza)", () => {
    // Contractual: cuando la UI implemente la fila Pre-bonif. (commit #7+),
    // debe usar `pre != null && pre !== final`. Acá documentamos el invariante.
    const raw = makeArticleResult({
      componentSaleBreakdown: {
        metal:   { base: 600, final: 600, salePreManualDiscount: 600, adjustments: [] },
        hechura: { base: 400, final: 400, salePreManualDiscount: 400, adjustments: [] },
      },
    });
    const r = normalizeArticlePricingPreview({ result: raw as any, articleId: "a1", quantity: 1 });
    const m = r.lines[0].componentSaleBreakdown!.metal;
    expect(m.salePreManualDiscount).toBe(m.final);   // threshold
  });

  it("baseline correct: salePreManualDiscount no-numérico → null (defensivo)", () => {
    const raw = makeArticleResult({
      componentSaleBreakdown: {
        metal:   { base: 600, final: 600, salePreManualDiscount: "muchos", adjustments: [] },
        hechura: { base: 400, final: 400, salePreManualDiscount: NaN,       adjustments: [] },
      },
    });
    const r = normalizeArticlePricingPreview({ result: raw as any, articleId: "a1", quantity: 1 });
    expect(r.lines[0].componentSaleBreakdown!.metal.salePreManualDiscount).toBeNull();
    expect(r.lines[0].componentSaleBreakdown!.hechura.salePreManualDiscount).toBeNull();
  });

  it("baseline correct: salePreManualDiscount 0 (legítimo, clamp del motor) preserva 0, NO null", () => {
    const raw = makeArticleResult({
      componentSaleBreakdown: {
        metal:   { base: 100, final: 0, salePreManualDiscount: 0, adjustments: [] },
        hechura: { base: 50,  final: 0, salePreManualDiscount: 0, adjustments: [] },
      },
    });
    const r = normalizeArticlePricingPreview({ result: raw as any, articleId: "a1", quantity: 1 });
    expect(r.lines[0].componentSaleBreakdown!.metal.salePreManualDiscount).toBe(0);
    expect(r.lines[0].componentSaleBreakdown!.hechura.salePreManualDiscount).toBe(0);
  });
});

// =============================================================================
// 3. Cero matemática frontend — el campo NO se deriva
// =============================================================================

describe("F1.3 #6 — passthrough puro (cero recálculo frontend)", () => {
  it("baseline correct: el frontend NUNCA recalcula salePreManualDiscount", () => {
    // Si el backend emite un valor "raro" (ej. pre < final por un edge case
    // que el motor decidió permitir), el frontend lo respeta sin "corregir".
    const raw = makeArticleResult({
      componentSaleBreakdown: {
        metal:   { base: 600, final: 540, salePreManualDiscount: 510, adjustments: [] },
        hechura: { base: 400, final: 400, salePreManualDiscount: 400, adjustments: [] },
      },
    });
    const r = normalizeArticlePricingPreview({ result: raw as any, articleId: "a1", quantity: 1 });
    // pre=510 a pesar que base-Σadj sería 600 — passthrough estricto.
    expect(r.lines[0].componentSaleBreakdown!.metal.salePreManualDiscount).toBe(510);
  });
});
