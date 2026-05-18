// src/lib/pricing/adapters/saleSnapshotToNormalized.test.ts
// ============================================================================
// Tests del adapter snapshot v6 → NormalizedPricingLine + steps[].
//
// Garantías que se validan:
//   1. La línea normalizada es passthrough de normalizeSalesLine.
//   2. Steps sintéticos reflejan composition.{metals,hechuras,products,services}.
//   3. Sin composition → steps vacío excepto baseStep.
//   4. discStep/promoStep aparecen solo cuando hay appliedDiscountId/PromotionId.
//   5. baseStep.key respeta priceSource.
// ============================================================================

import { describe, it, expect } from "vitest";
import { saleSnapshotToNormalized } from "./saleSnapshotToNormalized";
import type { SalePreviewLine, SalePreviewPricingSnapshot } from "../../../services/sales";

function makeSnapshot(o: Partial<SalePreviewPricingSnapshot> = {}): SalePreviewPricingSnapshot {
  return {
    unitPrice:            1000,
    basePrice:            1000,
    discountAmount:       0,
    taxAmount:            0,
    totalWithTax:         1000,
    priceSource:          "PRICE_LIST",
    baseSource:           "PRICE_LIST",
    unitCost:             600,
    unitMargin:           400,
    marginPercent:        40,
    markupPercent:        66.67,
    costPartial:          false,
    costMode:             "MANUAL",
    partial:              false,
    appliedPriceListId:   "pl1",
    appliedPriceListName: "General",
    appliedPromotionId:   null,
    appliedPromotionName: null,
    appliedDiscountId:    null,
    resolvedAt:           new Date().toISOString(),
    ...o,
  };
}

function makeLine(o: Partial<SalePreviewLine> = {}): SalePreviewLine {
  return {
    articleId:        "a1",
    variantId:        null,
    quantity:         1,
    unitPrice:        1000,
    basePrice:        1000,
    lineSubtotal:     1000,
    lineTotal:        1000,
    lineDiscount:     0,
    unitTaxAmount:    0,
    unitTotalWithTax: 1000,
    lineTaxAmount:    0,
    lineTotalWithTax: 1000,
    quantityDiscountAmount:  null,
    promotionDiscountAmount: null,
    priceSource:          "PRICE_LIST",
    appliedPriceListId:   "pl1",
    appliedPriceListName: "General",
    appliedPromotionId:   null,
    appliedPromotionName: null,
    appliedDiscountId:    null,
    unitCost:             600,
    unitMargin:           400,
    marginPercent:        40,
    markupPercent:        66.67,
    costPartial:          false,
    costMode:             "MANUAL",
    policy:               { canConfirm: true, blockingAlerts: [] },
    taxBreakdown:         [],
    metalHechuraBreakdown: null,
    pricingSnapshot:      makeSnapshot(),
    ...o,
  } as SalePreviewLine;
}

describe("saleSnapshotToNormalized", () => {
  it("mapea passthrough la línea (normalized)", () => {
    const line = makeLine({ unitPrice: 1500, unitCost: 900 });
    const out  = saleSnapshotToNormalized(line);
    expect(out.line.unitPrice).toBe(1500);
    expect(out.line.unitCost).toBe(900);
    expect(out.line.markupPercent).toBe(66.67);
  });

  it("genera baseStep PRICE_LIST cuando priceSource es PRICE_LIST", () => {
    const line = makeLine({ priceSource: "PRICE_LIST" });
    const { steps } = saleSnapshotToNormalized(line);
    expect(steps.find(s => s.key === "PRICE_LIST")).toBeTruthy();
  });

  it("genera baseStep MANUAL_OVERRIDE cuando priceSource es MANUAL_OVERRIDE", () => {
    const line = makeLine({ priceSource: "MANUAL_OVERRIDE" });
    const { steps } = saleSnapshotToNormalized(line);
    expect(steps.find(s => s.key === "MANUAL_OVERRIDE")).toBeTruthy();
  });

  it("sin composition → solo baseStep", () => {
    const line = makeLine();
    const { steps } = saleSnapshotToNormalized(line);
    expect(steps.length).toBe(1);
    expect(steps[0].key).toBe("PRICE_LIST");
  });

  it("con composition.metals[] → genera COST_LINES_METAL steps", () => {
    const line = makeLine({
      composition: {
        metal:   null,
        hechura: null,
        metals: [{
          costLineId: "cl1", metalVariantId: "mv1",
          metalName: "Oro", purity: 0.75, purityLabel: "AU18K",
          appliedGrams: 2, appliedMermaPct: 0.5, lineCost: 3000,
          quotePrice: 1500, variantName: "Oro 18K",
        }] as any,
      } as any,
    });
    const { steps } = saleSnapshotToNormalized(line);
    const metalSteps = steps.filter(s => s.key === "COST_LINES_METAL");
    expect(metalSteps.length).toBe(1);
    expect(metalSteps[0].value).toBe("3000");
    expect((metalSteps[0] as any).meta.metalName).toBe("Oro");
    expect((metalSteps[0] as any).meta.purity).toBe(0.75);
  });

  it("con composition.hechuras[] → genera COST_LINES_HECHURA steps", () => {
    const line = makeLine({
      composition: {
        metal: null, hechura: null,
        hechuras: [{
          costLineId: "hl1", appliedAmount: 500, lineCost: 500,
          lineLabel: "Engaste",
        }] as any,
      } as any,
    });
    const { steps } = saleSnapshotToNormalized(line);
    const hSteps = steps.filter(s => s.key === "COST_LINES_HECHURA");
    expect(hSteps.length).toBe(1);
    expect(hSteps[0].value).toBe("500");
    expect((hSteps[0] as any).meta.lineLabel).toBe("Engaste");
  });

  it("genera discStep cuando hay appliedDiscountId + quantityDiscountAmount", () => {
    const line = makeLine({
      basePrice: 1000,
      quantityDiscountAmount: 100,
      appliedDiscountId: "qd1",
    });
    const { steps } = saleSnapshotToNormalized(line);
    const disc = steps.find(s => s.key === "QUANTITY_DISCOUNT");
    expect(disc).toBeTruthy();
    expect(disc!.value).toBe("900"); // 1000 - 100
  });

  it("NO genera discStep si no hay appliedDiscountId", () => {
    const line = makeLine({
      basePrice: 1000,
      quantityDiscountAmount: 100,
      appliedDiscountId: null,
    });
    const { steps } = saleSnapshotToNormalized(line);
    expect(steps.find(s => s.key === "QUANTITY_DISCOUNT")).toBeUndefined();
  });

  it("genera promoStep cuando hay appliedPromotionId", () => {
    const line = makeLine({
      basePrice: 1000,
      promotionDiscountAmount: 50,
      appliedPromotionId: "p1",
    });
    const { steps } = saleSnapshotToNormalized(line);
    const promo = steps.find(s => s.key === "PROMOTION");
    expect(promo).toBeTruthy();
    expect(promo!.value).toBe("950");
  });

  it("preserva markupPercent en la línea normalizada", () => {
    const line = makeLine({ unitCost: 500, unitMargin: 500, markupPercent: 100 });
    const { line: norm } = saleSnapshotToNormalized(line);
    expect(norm.markupPercent).toBe(100);
  });
});
