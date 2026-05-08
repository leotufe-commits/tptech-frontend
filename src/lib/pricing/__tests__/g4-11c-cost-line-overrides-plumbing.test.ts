// src/lib/pricing/__tests__/g4-11c-cost-line-overrides-plumbing.test.ts
// =============================================================================
// FASE F1.4 G5 #11-C — frontend types + normalizer + plumbing.
//
// Cubre TODAS las validaciones del usuario:
//   1. Snapshot v5/v6 retrocompat: campo ausente → array vacío.
//   2. costLineOverridesApplied passthrough exacto del backend.
//   3. 2 metals → 2 costLineIds preservados sin colapso.
//   4. PRODUCT + SERVICE simultáneos → ids preservados.
//   5. Null normalization correcta (campos numéricos, adjustment*).
//   6. debugWarnings defensivo (codes inválidos descartados).
//   7. pricingMeta.costLineOverridesApplied preserva array.
//   8. Tipos type-safe en SalePreviewLine + DocumentLine.
//
// CERO UI testeada — eso es 11-D.
// =============================================================================

import { describe, it, expect } from "vitest";
import { normalizeArticlePricingPreview } from "../normalizePricingPreviewResult";
import type { SalePreviewLine, CostLineOverride, DebugWarning } from "../../../services/sales";
import type { DocumentLine } from "../../document-types";

function makeArticleResult(overrides: Record<string, any> = {}) {
  return {
    basePrice: "1000", unitPrice: "1000", taxAmount: "0",
    totalWithTax: "1000",
    quantityDiscountAmount: "0", promotionDiscountAmount: "0",
    priceSource: "PRICE_LIST",
    appliedPriceListId: "pl-1", appliedPriceListName: "Lista test",
    appliedPromotionId: null, appliedPromotionName: null,
    appliedDiscountId: null, discountAmount: "0",
    partial: false,
    appliedPriceList: null, appliedPromotion: null, appliedQuantityDiscount: null,
    composition: { metal: null, hechura: null, taxes: [] },
    cost: null,
    purchaseTaxAmount: 0, purchaseTaxBreakdown: [],
    clientCommercialRules: null, appliedClientCommercialRule: null,
    ...overrides,
  };
}

function normalize(raw: any) {
  return normalizeArticlePricingPreview({ result: raw, articleId: "a1", quantity: 1 });
}

// =============================================================================
// 1. Retrocompat snapshots viejos
// =============================================================================

describe("F1.4 #11-C — retrocompat snapshots v5/anteriores", () => {
  it("baseline correct: result sin costLineOverridesApplied → array vacío", () => {
    const raw = makeArticleResult();
    const r = normalize(raw);
    expect(r.lines[0].costLineOverridesApplied).toEqual([]);
    expect(r.lines[0].debugWarnings).toEqual([]);
  });

  it("baseline correct: result con costLineOverridesApplied=null → array vacío", () => {
    const raw = makeArticleResult({ costLineOverridesApplied: null });
    const r = normalize(raw);
    expect(r.lines[0].costLineOverridesApplied).toEqual([]);
  });

  it("baseline correct: result con costLineOverridesApplied=string corrupto → array vacío", () => {
    const raw = makeArticleResult({ costLineOverridesApplied: "not-an-array" });
    const r = normalize(raw);
    expect(r.lines[0].costLineOverridesApplied).toEqual([]);
  });
});

// =============================================================================
// 2. Passthrough exacto
// =============================================================================

describe("F1.4 #11-C — passthrough exacto del backend", () => {
  it("baseline correct: 1 override completo → todos los campos preservados", () => {
    const raw = makeArticleResult({
      costLineOverridesApplied: [{
        costLineId: "cl-h1",
        type:       "HECHURA",
        quantityOverride:    2,
        unitValueOverride:   150,
        mermaPercentOverride: null,
        adjustmentKind:    "BONUS",
        adjustmentType:    "PERCENTAGE",
        adjustmentValue:   10,
      }],
    });
    const r = normalize(raw);
    expect(r.lines[0].costLineOverridesApplied).toHaveLength(1);
    expect(r.lines[0].costLineOverridesApplied[0]).toEqual({
      costLineId: "cl-h1",
      type:       "HECHURA",
      quantityOverride:    2,
      unitValueOverride:   150,
      mermaPercentOverride: null,
      adjustmentKind:    "BONUS",
      adjustmentType:    "PERCENTAGE",
      adjustmentValue:   10,
    });
  });

  it("baseline correct: 2 metales con costLineIds distintos → 2 entries preservadas", () => {
    const raw = makeArticleResult({
      costLineOverridesApplied: [
        { costLineId: "cl-m1", type: "METAL", quantityOverride: 1.5 },
        { costLineId: "cl-m2", type: "METAL", quantityOverride: 0.8 },
      ],
    });
    const r = normalize(raw);
    expect(r.lines[0].costLineOverridesApplied).toHaveLength(2);
    expect(r.lines[0].costLineOverridesApplied[0].costLineId).toBe("cl-m1");
    expect(r.lines[0].costLineOverridesApplied[1].costLineId).toBe("cl-m2");
    expect(r.lines[0].costLineOverridesApplied[0].quantityOverride).toBe(1.5);
    expect(r.lines[0].costLineOverridesApplied[1].quantityOverride).toBe(0.8);
  });

  it("baseline correct: PRODUCT + SERVICE simultáneos → ids preservados", () => {
    const raw = makeArticleResult({
      costLineOverridesApplied: [
        { costLineId: "cl-p1", type: "PRODUCT", quantityOverride: 3, unitValueOverride: 80 },
        { costLineId: "cl-s1", type: "SERVICE", adjustmentKind: "SURCHARGE", adjustmentType: "PERCENTAGE", adjustmentValue: 25 },
      ],
    });
    const r = normalize(raw);
    expect(r.lines[0].costLineOverridesApplied).toHaveLength(2);
    expect(r.lines[0].costLineOverridesApplied[0].type).toBe("PRODUCT");
    expect(r.lines[0].costLineOverridesApplied[1].type).toBe("SERVICE");
  });
});

// =============================================================================
// 3. Null normalization
// =============================================================================

describe("F1.4 #11-C — null normalization defensiva", () => {
  it("baseline correct: campos numéricos no finitos → null", () => {
    const raw = makeArticleResult({
      costLineOverridesApplied: [{
        costLineId: "cl-x", type: "PRODUCT",
        quantityOverride:    NaN,
        unitValueOverride:   "not-a-number",
        mermaPercentOverride: undefined,
        adjustmentKind:    null,
        adjustmentValue:   undefined,
      }],
    });
    const r = normalize(raw);
    const ov = r.lines[0].costLineOverridesApplied[0];
    expect(ov.quantityOverride).toBeNull();
    expect(ov.unitValueOverride).toBeNull();
    expect(ov.mermaPercentOverride).toBeNull();
    expect(ov.adjustmentValue).toBeNull();
  });

  it("baseline correct: adjustmentKind fuera del set → null", () => {
    const raw = makeArticleResult({
      costLineOverridesApplied: [{
        costLineId: "cl-x", type: "HECHURA",
        adjustmentKind: "INVALIDO",
        adjustmentType: "WTF",
      }],
    });
    const r = normalize(raw);
    const ov = r.lines[0].costLineOverridesApplied[0];
    expect(ov.adjustmentKind).toBeNull();
    expect(ov.adjustmentType).toBeNull();
  });

  it("baseline correct: entry sin costLineId → descartada", () => {
    const raw = makeArticleResult({
      costLineOverridesApplied: [
        { costLineId: "cl-1", type: "METAL" },
        { /* sin costLineId */ type: "HECHURA" },
        { costLineId: "", type: "PRODUCT" },
      ],
    });
    const r = normalize(raw);
    expect(r.lines[0].costLineOverridesApplied).toHaveLength(1);
    expect(r.lines[0].costLineOverridesApplied[0].costLineId).toBe("cl-1");
  });

  it("baseline correct: entry con type fuera del set → descartada", () => {
    const raw = makeArticleResult({
      costLineOverridesApplied: [
        { costLineId: "cl-1", type: "INVALID_TYPE" },
        { costLineId: "cl-2", type: "METAL" },
      ],
    });
    const r = normalize(raw);
    expect(r.lines[0].costLineOverridesApplied).toHaveLength(1);
    expect(r.lines[0].costLineOverridesApplied[0].costLineId).toBe("cl-2");
  });
});

// =============================================================================
// 4. debugWarnings defensivo
// =============================================================================

describe("F1.4 #11-C — debugWarnings defensivo", () => {
  it("baseline correct: warnings con codes válidos preservados", () => {
    const raw = makeArticleResult({
      debugWarnings: [
        { code: "COST_LINE_OVERRIDE_NOT_FOUND", message: "no existe", costLineId: "cl-x" },
        { code: "COST_LINE_OVERRIDE_TYPE_MISMATCH", message: "tipo erróneo", costLineId: "cl-y" },
      ],
    });
    const r = normalize(raw);
    expect(r.lines[0].debugWarnings).toHaveLength(2);
  });

  it("baseline correct: code fuera del set → entry descartada", () => {
    const raw = makeArticleResult({
      debugWarnings: [
        { code: "INVALID_CODE", message: "x" },
        { code: "COST_LINE_OVERRIDE_NOT_FOUND", message: "y" },
      ],
    });
    const r = normalize(raw);
    expect(r.lines[0].debugWarnings).toHaveLength(1);
    expect(r.lines[0].debugWarnings[0].code).toBe("COST_LINE_OVERRIDE_NOT_FOUND");
  });

  it("baseline correct: warning sin message → descartada", () => {
    const raw = makeArticleResult({
      debugWarnings: [
        { code: "COST_LINE_OVERRIDE_NOT_FOUND" /* sin message */ },
        { code: "COST_LINE_OVERRIDE_NOT_FOUND", message: "ok" },
      ],
    });
    const r = normalize(raw);
    expect(r.lines[0].debugWarnings).toHaveLength(1);
  });

  it("baseline correct: costLineId opcional preservado correctamente", () => {
    const raw = makeArticleResult({
      debugWarnings: [
        { code: "COST_LINE_OVERRIDE_NOT_FOUND", message: "x", costLineId: "cl-1" },
        { code: "COST_LINE_OVERRIDE_NOT_FOUND", message: "y" /* sin costLineId */ },
        { code: "COST_LINE_OVERRIDE_NOT_FOUND", message: "z", costLineId: 123 /* tipo inválido */ },
      ],
    });
    const r = normalize(raw);
    expect(r.lines[0].debugWarnings[0].costLineId).toBe("cl-1");
    expect(r.lines[0].debugWarnings[1].costLineId).toBeNull();
    expect(r.lines[0].debugWarnings[2].costLineId).toBeNull();
  });
});

// =============================================================================
// 5. Type-safety en SalePreviewLine + DocumentLine.pricingMeta
// =============================================================================

describe("F1.4 #11-C — types type-safe (plumbing)", () => {
  it("baseline correct: SalePreviewLine acepta costLineOverridesApplied + debugWarnings", () => {
    const pl: Partial<SalePreviewLine> = {
      articleId: "a1",
      costLineOverridesApplied: [
        { costLineId: "cl-h1", type: "HECHURA", quantityOverride: 1, unitValueOverride: 200 },
      ],
      debugWarnings: [
        { code: "COST_LINE_OVERRIDE_NOT_FOUND", message: "x", costLineId: "cl-x" },
      ],
    };
    expect(pl.costLineOverridesApplied?.[0].costLineId).toBe("cl-h1");
    expect(pl.debugWarnings?.[0].code).toBe("COST_LINE_OVERRIDE_NOT_FOUND");
  });

  it("baseline correct: DocumentLine.pricingMeta acepta el array", () => {
    const line: Pick<DocumentLine, "pricingMeta"> = {
      pricingMeta: {
        costLineOverridesApplied: [
          {
            costLineId: "cl-m1", type: "METAL",
            quantityOverride: 1.5, mermaPercentOverride: 10,
          },
        ],
      },
    };
    expect(line.pricingMeta!.costLineOverridesApplied![0].costLineId).toBe("cl-m1");
    expect(line.pricingMeta!.costLineOverridesApplied![0].quantityOverride).toBe(1.5);
  });

  it("baseline correct: tipos discriminados — type field es union cerrado", () => {
    // Test contractual: TS rechaza type fuera del set en compile time.
    // En runtime, pasamos un type válido y verificamos type-safety.
    const ov: CostLineOverride = {
      costLineId: "cl-x", type: "PRODUCT",
      quantityOverride: 1, unitValueOverride: 100,
    };
    const validTypes: CostLineOverride["type"][] = ["METAL", "HECHURA", "PRODUCT", "SERVICE"];
    expect(validTypes.includes(ov.type)).toBe(true);
  });

  it("baseline correct: DebugWarning.code es union cerrado type-safe", () => {
    const w: DebugWarning = {
      code: "COST_LINE_OVERRIDE_INVALID_FIELD",
      message: "x", costLineId: "cl-1",
    };
    const validCodes: DebugWarning["code"][] = [
      "COST_LINE_OVERRIDE_NOT_FOUND",
      "COST_LINE_OVERRIDE_TYPE_MISMATCH",
      "COST_LINE_OVERRIDE_INVALID_FIELD",
    ];
    expect(validCodes.includes(w.code)).toBe(true);
  });
});

// =============================================================================
// 6. Mapeo estable por costLineId (preparación 11-D)
// =============================================================================

describe("F1.4 #11-C — mapeo estable por costLineId (preparación 11-D)", () => {
  it("baseline correct: tabla futura puede indexar overrides como Map<costLineId, override>", () => {
    const raw = makeArticleResult({
      costLineOverridesApplied: [
        { costLineId: "cl-m1", type: "METAL",   quantityOverride: 1.5 },
        { costLineId: "cl-h1", type: "HECHURA", unitValueOverride: 200 },
        { costLineId: "cl-p1", type: "PRODUCT", quantityOverride: 2 },
      ],
    });
    const r = normalize(raw);
    const map = new Map(
      r.lines[0].costLineOverridesApplied.map(ov => [ov.costLineId, ov]),
    );
    // Lookup O(1) por costLineId — patrón que la tabla editable (11-D) usará.
    expect(map.get("cl-m1")?.quantityOverride).toBe(1.5);
    expect(map.get("cl-h1")?.unitValueOverride).toBe(200);
    expect(map.get("cl-p1")?.quantityOverride).toBe(2);
    expect(map.get("inexistente")).toBeUndefined();
  });

  it("baseline correct: dos metales con costLineIds distintos → no colapso silencioso", () => {
    const raw = makeArticleResult({
      costLineOverridesApplied: [
        { costLineId: "cl-m1", type: "METAL", quantityOverride: 1 },
        { costLineId: "cl-m2", type: "METAL", quantityOverride: 2 },
      ],
    });
    const r = normalize(raw);
    const ids = r.lines[0].costLineOverridesApplied.map(ov => ov.costLineId);
    expect(new Set(ids).size).toBe(2);
  });
});
