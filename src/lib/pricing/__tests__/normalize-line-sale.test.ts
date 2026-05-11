// src/lib/pricing/__tests__/normalize-line-sale.test.ts
// =============================================================================
// F1.5 #A+ / #A++ — verifica que el normalizer propaga `lineSale` per cost-line
// desde el raw response del backend a `NormalizedComposition`.
//
// `lineSale` es la fuente de verdad canónica emitida por el pricing-engine
// para el sale-side per fila (POLICY R4.1). El simulator y el grid de Factura
// lo leen passthrough; este test garantiza que el normalizer no lo descarta
// ni lo deriva localmente.
//
// Cubre:
//   · METAL.lineSale propagado.
//   · HECHURA.lineSale propagado.
//   · PRODUCT/SERVICE.lineSale propagado.
//   · Campo ausente en raw (snapshot legacy) → null.
//   · Campo no finito en raw (NaN, string) → null defensivo.
//   · Paridad agregada: Σ metals.lineSale === metalSale del breakdown.
// =============================================================================

import { describe, it, expect } from "vitest";
import { normalizeArticlePricingPreview } from "../normalizePricingPreviewResult";

function makeResultWithComposition(composition: any, breakdown: any = null) {
  return {
    basePrice: "1500", unitPrice: "1500",
    taxAmount: "0", totalWithTax: "1500",
    quantityDiscountAmount: "0", promotionDiscountAmount: "0",
    priceSource: "PRICE_LIST",
    appliedPriceListId: "pl-1", appliedPriceListName: "Lista test",
    appliedPromotionId: null, appliedPromotionName: null,
    appliedDiscountId: null,
    unitCost: "500", unitMargin: "1000", marginPercent: "200",
    costMode: "COST_LINES", costPartial: false,
    taxBreakdown: [], appliedRounding: null,
    partial: false, taxExemptByEntity: false,
    composition, metalHechuraBreakdown: breakdown,
    componentSaleBreakdown: null,
    costOverrideContext: null,
    documentTotals: {
      subtotalBeforeDiscounts: 1500, lineDiscountAmount: 0,
      subtotalAfterLineDiscounts: 1500, channelAdjustmentAmount: 0,
      couponDiscountAmount: 0, paymentAdjustmentAmount: 0,
      shippingAmount: 0, globalDiscountAmount: 0,
      taxableBase: 1500, taxAmount: 0, roundingAdjustment: 0,
      totalBeforeTax: 1500, totalWithTax: 1500, total: 1500,
    },
  };
}

describe("normalize — F1.5 #A++ METAL.lineSale propagado", () => {
  it("metales con lineSale → se propaga 1:1", () => {
    const raw = makeResultWithComposition({
      metals: [
        { costLineId: "m1", metalVariantId: "mv-1", metalName: "Oro", purity: 0.75,
          purityLabel: "18k", appliedGrams: 5, appliedMermaPct: 0, lineCost: 300, lineSale: 450 },
        { costLineId: "m2", metalVariantId: "mv-2", metalName: "Oro", purity: 0.916,
          purityLabel: "22k", appliedGrams: 3, appliedMermaPct: 0, lineCost: 275, lineSale: 412.5 },
      ],
      hechuras: [], products: [], services: [], taxes: [],
    }, { metalCost: 575, metalSale: 862.5, metalMarginPct: 50, hechuraCost: 0, hechuraSale: 0, hechuraMarginPct: 0 });

    const norm = normalizeArticlePricingPreview({ result: raw as any, articleId: "a1", quantity: 1 });
    const metals = norm.lines[0].composition?.metals ?? [];
    expect(metals).toHaveLength(2);
    expect(metals[0].lineSale).toBe(450);
    expect(metals[1].lineSale).toBe(412.5);
  });

  it("paridad: Σ metals.lineSale === metalHechuraBreakdown.metalSale", () => {
    // Caso real del usuario: 4 metales (Oro 18k/22k/24k/Chafalonia).
    const raw = makeResultWithComposition({
      metals: [
        { costLineId: "m1", metalName: "Oro", appliedGrams: 5, lineCost: 300, lineSale: 450 },
        { costLineId: "m2", metalName: "Oro", appliedGrams: 3, lineCost: 275, lineSale: 412.5 },
        { costLineId: "m3", metalName: "Oro", appliedGrams: 1, lineCost: 100, lineSale: 150 },
        { costLineId: "m4", metalName: "Chafalonia", appliedGrams: 1, lineCost: 125, lineSale: 187.5 },
      ],
      hechuras: [], products: [], services: [], taxes: [],
    }, { metalCost: 800, metalSale: 1200, metalMarginPct: 50, hechuraCost: 0, hechuraSale: 0, hechuraMarginPct: 0 });

    const norm = normalizeArticlePricingPreview({ result: raw as any, articleId: "a1", quantity: 1 });
    const sum = (norm.lines[0].composition?.metals ?? []).reduce((acc, m) => acc + (m.lineSale ?? 0), 0);
    expect(Math.abs(sum - 1200)).toBeLessThan(0.001);
  });

  it("snapshot legacy: metal sin lineSale → null (no inventa)", () => {
    const raw = makeResultWithComposition({
      metals: [
        { costLineId: "m1", metalName: "Oro", appliedGrams: 5, lineCost: 300 /* sin lineSale */ },
      ],
      hechuras: [], products: [], services: [], taxes: [],
    });
    const norm = normalizeArticlePricingPreview({ result: raw as any, articleId: "a1", quantity: 1 });
    expect(norm.lines[0].composition?.metals?.[0].lineSale).toBeNull();
  });

  it("lineSale no finito (string 'NaN', valor inválido) → null defensivo", () => {
    const raw = makeResultWithComposition({
      metals: [
        { costLineId: "m1", metalName: "Oro", appliedGrams: 5, lineCost: 300, lineSale: "NaN" },
      ],
      hechuras: [], products: [], services: [], taxes: [],
    });
    const norm = normalizeArticlePricingPreview({ result: raw as any, articleId: "a1", quantity: 1 });
    expect(norm.lines[0].composition?.metals?.[0].lineSale).toBeNull();
  });
});

describe("normalize — F1.5 #A+ HECHURA/PRODUCT/SERVICE.lineSale propagado", () => {
  it("hechuras con lineSale → se propaga", () => {
    const raw = makeResultWithComposition({
      metals: [],
      hechuras: [
        { costLineId: "h1", appliedAmount: 200, lineCost: 200, lineSale: 300, lineLabel: "Mano de obra" },
        { costLineId: "h2", appliedAmount: 100, lineCost: 100, lineSale: 150, lineLabel: "Pulido" },
      ],
      products: [], services: [], taxes: [],
    });
    const norm = normalizeArticlePricingPreview({ result: raw as any, articleId: "a1", quantity: 1 });
    const hech = norm.lines[0].composition?.hechuras ?? [];
    expect(hech[0].lineSale).toBe(300);
    expect(hech[1].lineSale).toBe(150);
  });

  it("products + services con lineSale → se propaga", () => {
    const raw = makeResultWithComposition({
      metals: [], hechuras: [],
      products: [
        { costLineId: "p1", catalogItemId: "art-P", quantity: 1, unitValue: 150, totalValue: 150,
          currencyId: null, lineAdjKind: null, lineAdjType: null, lineAdjValue: null,
          lineAdjAmount: null, affectsStock: null, lineSale: 225 },
      ],
      services: [
        { costLineId: "s1", catalogItemId: "art-S", quantity: 1, unitValue: 80, totalValue: 80,
          currencyId: null, lineAdjKind: null, lineAdjType: null, lineAdjValue: null,
          lineAdjAmount: null, affectsStock: null, lineSale: 120 },
      ],
      taxes: [],
    });
    const norm = normalizeArticlePricingPreview({ result: raw as any, articleId: "a1", quantity: 1 });
    expect(norm.lines[0].composition?.products?.[0].lineSale).toBe(225);
    expect(norm.lines[0].composition?.services?.[0].lineSale).toBe(120);
  });

  it("snapshot legacy: hechura/product/service sin lineSale → null", () => {
    const raw = makeResultWithComposition({
      metals: [],
      hechuras: [
        { costLineId: "h1", appliedAmount: 200, lineCost: 200, lineLabel: "Mano de obra" /* sin lineSale */ },
      ],
      products: [
        { costLineId: "p1", catalogItemId: "art-P", quantity: 1, unitValue: 150, totalValue: 150,
          currencyId: null, lineAdjKind: null, lineAdjType: null, lineAdjValue: null,
          lineAdjAmount: null, affectsStock: null /* sin lineSale */ },
      ],
      services: [], taxes: [],
    });
    const norm = normalizeArticlePricingPreview({ result: raw as any, articleId: "a1", quantity: 1 });
    expect(norm.lines[0].composition?.hechuras?.[0].lineSale).toBeNull();
    expect(norm.lines[0].composition?.products?.[0].lineSale).toBeNull();
  });
});

describe("normalize — multi-moneda y casos edge", () => {
  it("multi-moneda: lineSale viene en moneda display, normalizer es agnóstico", () => {
    // El normalizer NO convierte monedas. Si el backend emite lineSale=450 ya
    // convertido, el normalizer lo pasa 1:1. Test simbólico: cualquier número
    // se preserva.
    const raw = makeResultWithComposition({
      metals: [
        { costLineId: "m1", metalName: "Oro", appliedGrams: 1, lineCost: 100, lineSale: 200 },
      ],
      hechuras: [], products: [], services: [], taxes: [],
    });
    const norm = normalizeArticlePricingPreview({ result: raw as any, articleId: "a1", quantity: 1 });
    expect(norm.lines[0].composition?.metals?.[0].lineSale).toBe(200);
  });

  it("composition null (artículo sin desglose) → no rompe", () => {
    const raw = makeResultWithComposition(null);
    const norm = normalizeArticlePricingPreview({ result: raw as any, articleId: "a1", quantity: 1 });
    expect(norm.lines[0].composition?.metals ?? []).toEqual([]);
    expect(norm.lines[0].composition?.hechuras ?? []).toEqual([]);
  });
});
