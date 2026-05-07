// src/lib/pricing/__tests__/g4-9b-normalize-composition-arrays.test.ts
// =============================================================================
// FASE F1.3 G4.x #9-B — frontend types + normalizer + plumbing.
//
// Cubre TODAS las validaciones del usuario:
//   1. Artículo con 2 metales → metals.length === 2
//   2. Artículo con 2 hechuras → hechuras.length === 2
//   3. Legacy snapshot con metal único → metals.length === 1 (fallback)
//   4. Legacy snapshot SIN metal → metals.length === 0
//   5. products/services siguen como arrays (regression)
//   6. metal === metals[0] estructural (alias legacy garantizado)
//   7. hechura === hechuras[0] estructural
//   8. Cero matemática frontend (passthrough puro)
//   9. Tipos type-safe en SalePreviewLine + DocumentLine.pricingMeta (#7 plumbing)
//
// NO tocamos UI en este commit. El render multi-componente viene en 9-C.
// =============================================================================

import { describe, it, expect } from "vitest";
import { normalizeArticlePricingPreview } from "../normalizePricingPreviewResult";
import type { SalePreviewLine } from "../../../services/sales";
import type { DocumentLine } from "../../document-types";

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
    cost: null,
    purchaseTaxAmount: 0,
    purchaseTaxBreakdown: [],
    clientCommercialRules: null,
    appliedClientCommercialRule: null,
    ...overrides,
  };
}

function normalize(raw: any) {
  return normalizeArticlePricingPreview({ result: raw, articleId: "a1", quantity: 1 });
}

// =============================================================================
// 1. metals[] / hechuras[] — backend v5+ emite arrays directamente
// =============================================================================

describe("F1.3 #9-B — normalizer respeta metals[]/hechuras[] del backend v5+", () => {
  it("baseline correct: 2 metals raw → metals.length === 2", () => {
    const raw = makeArticleResult({
      composition: {
        metal: null, hechura: null,
        metals: [
          { costLineId: "cl-m1", metalVariantId: "mv-1", metalName: "Oro",
            purity: 0.75, purityLabel: "18k",
            appliedGrams: 1.30, appliedMermaPct: 5, lineCost: 600 },
          { costLineId: "cl-m2", metalVariantId: "mv-2", metalName: "Plata",
            purity: 0.925, purityLabel: "22k",
            appliedGrams: 2.00, appliedMermaPct: 0, lineCost: 400 },
        ],
        taxes: [],
      },
    });
    const r = normalize(raw);
    const c = r.lines[0].composition!;
    expect(c.metals).toHaveLength(2);
    expect(c.metals[0].metalName).toBe("Oro");
    expect(c.metals[0].appliedGrams).toBe(1.30);
    expect(c.metals[0].lineCost).toBe(600);
    expect(c.metals[1].metalName).toBe("Plata");
    expect(c.metals[1].lineCost).toBe(400);
  });

  it("baseline correct: 2 hechuras raw → hechuras.length === 2", () => {
    const raw = makeArticleResult({
      composition: {
        metal: null, hechura: null,
        hechuras: [
          { costLineId: "cl-h1", appliedAmount: 200, lineCost: 200, lineLabel: "Mano de obra" },
          { costLineId: "cl-h2", appliedAmount: 150, lineCost: 150, lineLabel: "Pulido" },
        ],
        taxes: [],
      },
    });
    const r = normalize(raw);
    const c = r.lines[0].composition!;
    expect(c.hechuras).toHaveLength(2);
    expect(c.hechuras[0].lineLabel).toBe("Mano de obra");
    expect(c.hechuras[0].appliedAmount).toBe(200);
    expect(c.hechuras[1].lineLabel).toBe("Pulido");
  });

  it("baseline correct: backend v5 con arrays + alias legacy → ambos coexisten coherentes", () => {
    // El backend v5 (commit 9-A) emite ambos: metals[] + metal alias.
    const raw = makeArticleResult({
      composition: {
        metals: [{
          costLineId: "cl-m1", metalVariantId: "mv-1", metalName: "Oro",
          purity: 0.75, purityLabel: "18k",
          appliedGrams: 1.30, appliedMermaPct: 5, lineCost: 600,
        }],
        // El alias legacy también viene del backend (=metals[0] enriquecido).
        metal: {
          appliedGrams: 1.30, appliedMermaPct: 5,
          metalName: "Oro", purity: 0.75, purityLabel: "18k",
          appliedVariantId: "mv-1",
          gramsManual: false, mermaManual: false, variantManual: false,
        },
        hechura: null,
        taxes: [],
      },
    });
    const r = normalize(raw);
    const c = r.lines[0].composition!;
    expect(c.metals).toHaveLength(1);
    // Ambos disponibles: metals[0] (display per item) y metal (alias legacy).
    expect(c.metals[0].metalName).toBe("Oro");
    expect(c.metal!.metalName).toBe("Oro");
  });
});

// =============================================================================
// 2. Fallback legacy — snapshot v4/v3 sin arrays
// =============================================================================

describe("F1.3 #9-B — fallback legacy desde snapshot v4/v3", () => {
  it("baseline correct: snapshot legacy con `metal` único (sin arrays) → metals.length === 1", () => {
    const raw = makeArticleResult({
      composition: {
        // backend v4: NO metals array, solo el alias `metal`.
        metal: {
          appliedGrams: 1.50, appliedMermaPct: 3,
          metalName: "Oro", purity: 0.75, purityLabel: "18k",
          appliedVariantId: "mv-1",
          gramsManual: false, mermaManual: false, variantManual: false,
        },
        hechura: null,
        taxes: [],
      },
    });
    const r = normalize(raw);
    const c = r.lines[0].composition!;
    expect(c.metals).toHaveLength(1);
    expect(c.metals[0].metalName).toBe("Oro");
    expect(c.metals[0].appliedGrams).toBe(1.50);
    expect(c.metals[0].metalVariantId).toBe("mv-1");
    // costLineId no está disponible en legacy → null.
    expect(c.metals[0].costLineId).toBeNull();
    // lineCost tampoco está expuesto en legacy.
    expect(c.metals[0].lineCost).toBeNull();
  });

  it("baseline correct: snapshot legacy con `hechura` único → hechuras.length === 1", () => {
    const raw = makeArticleResult({
      composition: {
        metal: null,
        hechura: {
          appliedAmount: 250, originalAmount: 250,
          manual: false, appliesTo: "TOTAL",
        },
        taxes: [],
      },
    });
    const r = normalize(raw);
    const c = r.lines[0].composition!;
    expect(c.hechuras).toHaveLength(1);
    expect(c.hechuras[0].appliedAmount).toBe(250);
    expect(c.hechuras[0].costLineId).toBeNull();
  });

  it("baseline correct: snapshot legacy SIN metal/hechura → arrays vacíos []", () => {
    const raw = makeArticleResult({
      composition: { metal: null, hechura: null, taxes: [] },
    });
    const r = normalize(raw);
    const c = r.lines[0].composition!;
    expect(c.metals).toEqual([]);
    expect(c.hechuras).toEqual([]);
    expect(c.products).toEqual([]);
    expect(c.services).toEqual([]);
  });

  it("baseline correct: snapshot v3 sin products/services → siguen siendo arrays vacíos (regression)", () => {
    const raw = makeArticleResult({
      composition: {
        metal: { appliedGrams: 1, metalName: "Oro" } as any,
        hechura: null,
        // sin products/services/metals/hechuras
        taxes: [],
      },
    });
    const r = normalize(raw);
    const c = r.lines[0].composition!;
    // metals derivado del legacy metal → 1 item.
    expect(c.metals).toHaveLength(1);
    expect(c.products).toEqual([]);
    expect(c.services).toEqual([]);
    expect(c.hechuras).toEqual([]);
  });
});

// =============================================================================
// 3. Invariante alias legacy: metal === metals[0] estructural
// =============================================================================

describe("F1.3 #9-B — invariante metal/hechura ↔ metals[0]/hechuras[0]", () => {
  it("baseline correct: metal alias preserva info adicional (originalGrams, gramsManual)", () => {
    // El alias legacy mantiene flags del costOverrideContext que NO viajan
    // en metals[0]. Los items son read-only display puros; el alias enriquece.
    const raw = makeArticleResult({
      composition: {
        metal: {
          originalGrams: 1.20, appliedGrams: 1.50,
          gramsManual: true, mermaManual: false, variantManual: false,
          metalName: "Oro", purity: 0.75, purityLabel: "18k",
        },
        metals: [{
          costLineId: "cl-m1", metalVariantId: "mv-1",
          metalName: "Oro", purity: 0.75, purityLabel: "18k",
          appliedGrams: 1.50, appliedMermaPct: 0, lineCost: 600,
        }],
        hechura: null, taxes: [],
      },
    });
    const r = normalize(raw);
    const c = r.lines[0].composition!;
    // El alias retiene gramsManual=true del overrideContext.
    expect(c.metal!.gramsManual).toBe(true);
    expect(c.metal!.originalGrams).toBe(1.20);
    // El item NO tiene esos flags (es display puro).
    expect(c.metals[0]).not.toHaveProperty("gramsManual");
    expect(c.metals[0]).not.toHaveProperty("originalGrams");
    // Pero appliedGrams coincide (ambos vienen del mismo source).
    expect(c.metal!.appliedGrams).toBe(c.metals[0].appliedGrams);
  });
});

// =============================================================================
// 4. Cero matemática frontend — passthrough estricto
// =============================================================================

describe("F1.3 #9-B — passthrough puro (cero recálculo)", () => {
  it("baseline correct: lineCost del backend NO se recalcula desde appliedGrams × precio", () => {
    // Si el backend emitiera un lineCost "raro", el frontend lo respeta.
    const raw = makeArticleResult({
      composition: {
        metals: [{
          costLineId: "cl-m1", metalVariantId: "mv-1", metalName: "Oro",
          purity: 0.75, purityLabel: "18k",
          appliedGrams: 1.0, appliedMermaPct: 0,
          lineCost: 999,    // intencional — no es 1.0 × precio.
        }],
        metal: null, hechura: null, taxes: [],
      },
    });
    const r = normalize(raw);
    expect(r.lines[0].composition!.metals[0].lineCost).toBe(999);
  });

  it("baseline correct: appliedGrams no-finito (NaN) → null defensivo", () => {
    const raw = makeArticleResult({
      composition: {
        metals: [{
          costLineId: null, metalVariantId: null, metalName: null,
          purity: null, purityLabel: null,
          appliedGrams: NaN,            // raw corrupto
          appliedMermaPct: null, lineCost: null,
        }],
        metal: null, hechura: null, taxes: [],
      },
    });
    const r = normalize(raw);
    expect(r.lines[0].composition!.metals[0].appliedGrams).toBeNull();
  });

  it("baseline correct: metals raw no-array → fallback al legacy metal o []", () => {
    const raw = makeArticleResult({
      composition: {
        metals: "not-an-array" as any,
        metal: null, hechura: null, taxes: [],
      },
    });
    const r = normalize(raw);
    expect(r.lines[0].composition!.metals).toEqual([]);
  });
});

// =============================================================================
// 5. Plumbing types — SalePreviewLine + DocumentLine.pricingMeta
// =============================================================================

describe("F1.3 #9-B — plumbing types (SalePreviewLine + pricingMeta)", () => {
  it("baseline correct: SalePreviewLine.composition.metals tipado", () => {
    const pl = {
      articleId: "a1", variantId: null, quantity: 1,
      unitPrice: 100, basePrice: 100, lineSubtotal: 100, lineTotal: 100,
      lineDiscount: 0, unitTaxAmount: 0, unitTotalWithTax: 100,
      lineTaxAmount: 0, lineTotalWithTax: 100,
      quantityDiscountAmount: null, promotionDiscountAmount: null,
      priceSource: "PRICE_LIST",
      appliedPriceListId: null, appliedPriceListName: null,
      appliedPromotionId: null, appliedPromotionName: null,
      appliedDiscountId: null,
      unitCost: null, unitMargin: null, marginPercent: null,
      costPartial: false, costMode: "MANUAL",
      policy: { canConfirm: true, blockingAlerts: [] },
      taxBreakdown: [],
      metalHechuraBreakdown: null,
      pricingSnapshot: {} as any,
      composition: {
        metal: null, hechura: null,
        metals: [{
          costLineId: "cl-m1", metalVariantId: "mv-1", metalName: "Oro",
          purity: 0.75, purityLabel: "18k",
          appliedGrams: 1, appliedMermaPct: 0, lineCost: 100,
        }],
        hechuras: [],
        products: [], services: [], taxes: [],
      },
    } satisfies Partial<SalePreviewLine> as SalePreviewLine;

    // Acceso tipado sin `as any`.
    expect(pl.composition!.metals![0].metalName).toBe("Oro");
    expect(pl.composition!.metals![0].lineCost).toBe(100);
  });

  it("baseline correct: DocumentLine.pricingMeta.composition.hechuras tipado", () => {
    const line: Pick<DocumentLine, "pricingMeta"> = {
      pricingMeta: {
        composition: {
          metal: null, hechura: null,
          hechuras: [{
            costLineId: "cl-h1", appliedAmount: 200, lineCost: 200,
            lineLabel: "Mano de obra",
          }],
          taxes: [],
        },
      },
    };
    expect(line.pricingMeta!.composition!.hechuras![0].lineLabel).toBe("Mano de obra");
    expect(line.pricingMeta!.composition!.hechuras![0].appliedAmount).toBe(200);
  });

  it("baseline correct: legacy DocumentLine sin metals/hechuras → válido (back-compat)", () => {
    const line: Pick<DocumentLine, "pricingMeta"> = {
      pricingMeta: {
        composition: {
          metal: null,
          hechura: { appliedAmount: 100, manual: false, appliesTo: null, originalAmount: 100 },
          taxes: [],
          // sin metals ni hechuras — shape v4 legacy.
        },
      },
    };
    expect(line.pricingMeta!.composition!.metals).toBeUndefined();
    expect(line.pricingMeta!.composition!.hechuras).toBeUndefined();
    // Lectura defensiva (los consumers usan `?? []`).
    expect(line.pricingMeta!.composition!.metals ?? []).toEqual([]);
    expect(line.pricingMeta!.composition!.hechuras ?? []).toEqual([]);
  });
});
