// src/lib/sales/__tests__/g4-1-pricing-meta-plumbing.test.ts
// =============================================================================
// FASE F1.3 G4.x #7 — frontend plumbing.
//
// Verifica que los nuevos campos del backend FLUYEN tipados hasta los
// consumidores (pricingMeta, SalePreviewLine), SIN renderizarlos todavía.
//
// Cubre:
//   1. SalePreviewLine permite composition.products[] / services[].
//   2. SalePreviewLine permite componentSaleBreakdown.{metal,hechura}.salePreManualDiscount.
//   3. DocumentLine.pricingMeta permite los mismos campos.
//   4. Retrocompat: SalePreviewLine SIN esos campos sigue siendo válido.
//   5. Type-level — el plumbing está disponible para consumers de #8/#9.
//
// NO testea render — eso es el commit #8.
// =============================================================================

import { describe, it, expect } from "vitest";
import type { SalePreviewLine } from "../../../services/sales";
import type { DocumentLine } from "../../document-types";

// =============================================================================
// 1. SalePreviewLine — composition.products[] / services[] tipados
// =============================================================================

describe("F1.3 G4.x #7 — SalePreviewLine plumbing", () => {
  it("baseline correct: composition.products[] aceptado en el tipo", () => {
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
        products: [{
          costLineId:      "cl-p1",
          catalogItemId:   "art-P",
          catalogItemCode: "ZAF-01",
          catalogItemName: "Zafiro 0.5ct",
          quantity:        2,
          unitValue:       50,
          totalValue:      100,
          currencyId:      null,
          lineAdjKind:     "BONUS" as const,
          lineAdjType:     "PERCENTAGE" as const,
          lineAdjValue:    10,
          lineAdjAmount:   5,
          affectsStock:    true,
        }],
        services: [],
        taxes: [],
      },
    } satisfies Partial<SalePreviewLine> as SalePreviewLine;

    // Acceso tipado — no requiere `as any`. Plumbing OK.
    const p0 = pl.composition!.products![0];
    expect(p0.catalogItemCode).toBe("ZAF-01");
    expect(p0.lineAdjKind).toBe("BONUS");
    expect(p0.affectsStock).toBe(true);
  });

  it("baseline correct: componentSaleBreakdown.{metal,hechura}.salePreManualDiscount tipado", () => {
    const pl = {
      articleId: "a1", variantId: null, quantity: 1,
      unitPrice: 540, basePrice: 600, lineSubtotal: 540, lineTotal: 540,
      lineDiscount: 60, unitTaxAmount: 0, unitTotalWithTax: 540,
      lineTaxAmount: 0, lineTotalWithTax: 540,
      quantityDiscountAmount: null, promotionDiscountAmount: null,
      priceSource: "MANUAL_OVERRIDE",
      appliedPriceListId: null, appliedPriceListName: null,
      appliedPromotionId: null, appliedPromotionName: null,
      appliedDiscountId: null,
      unitCost: null, unitMargin: null, marginPercent: null,
      costPartial: false, costMode: "MANUAL",
      policy: { canConfirm: true, blockingAlerts: [] },
      taxBreakdown: [],
      metalHechuraBreakdown: null,
      pricingSnapshot: {} as any,
      componentSaleBreakdown: {
        metal: {
          base: 600, final: 600,
          salePreManualDiscount: 600,
          adjustments: [],
        },
        hechura: {
          base: 400, final: 360,
          salePreManualDiscount: 400,   // pre = base − customerRule, sin manual
          adjustments: [
            { kind: "MANUAL_DISCOUNT", amount: 40, applyOn: "HECHURA", label: "Bonif" },
          ],
        },
      },
    } satisfies Partial<SalePreviewLine> as SalePreviewLine;

    expect(pl.componentSaleBreakdown!.metal.salePreManualDiscount).toBe(600);
    expect(pl.componentSaleBreakdown!.hechura.salePreManualDiscount).toBe(400);
    expect(pl.componentSaleBreakdown!.hechura.final).toBe(360);
    // pre !== final ⇒ la UI (commit #8) renderearía la fila.
    const h = pl.componentSaleBreakdown!.hechura;
    expect(h.salePreManualDiscount !== h.final).toBe(true);
  });
});

// =============================================================================
// 2. DocumentLine.pricingMeta — espejo del shape SalePreviewLine
// =============================================================================

describe("F1.3 G4.x #7 — DocumentLine.pricingMeta plumbing", () => {
  it("baseline correct: pricingMeta.composition.products/services tipados", () => {
    const line: Pick<DocumentLine, "pricingMeta"> = {
      pricingMeta: {
        composition: {
          metal: null, hechura: null,
          products: [{
            costLineId: "cl-x", catalogItemId: "art-X",
            catalogItemCode: "X-01", catalogItemName: "X",
            quantity: 1, unitValue: 10, totalValue: 10,
            currencyId: null,
            lineAdjKind: null, lineAdjType: null,
            lineAdjValue: null, lineAdjAmount: null,
            affectsStock: false,
          }],
          services: [],
          taxes: [],
        },
      },
    };
    expect(line.pricingMeta!.composition!.products![0].catalogItemCode).toBe("X-01");
  });

  it("baseline correct: pricingMeta.componentSaleBreakdown.{metal,hechura}.salePreManualDiscount tipado", () => {
    const line: Pick<DocumentLine, "pricingMeta"> = {
      pricingMeta: {
        componentSaleBreakdown: {
          metal:   { base: 100, final: 100, salePreManualDiscount: 100, adjustments: [] },
          hechura: { base: 50,  final: 40,  salePreManualDiscount: 50,  adjustments: [
            { kind: "MANUAL_DISCOUNT", amount: 10, applyOn: "HECHURA" },
          ] },
        },
      },
    };
    expect(line.pricingMeta!.componentSaleBreakdown!.metal!.salePreManualDiscount).toBe(100);
    expect(line.pricingMeta!.componentSaleBreakdown!.hechura!.salePreManualDiscount).toBe(50);
  });
});

// =============================================================================
// 3. RETROCOMPAT — payloads viejos sin los campos siguen válidos
// =============================================================================

describe("F1.3 G4.x #7 — retrocompat snapshots viejos", () => {
  it("baseline correct: SalePreviewLine sin products/services en composition → válido", () => {
    const plLegacy = {
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
        // Sin products / services — shape v3 antiguo.
        taxes: [],
      },
    } satisfies Partial<SalePreviewLine> as SalePreviewLine;

    // Type-level: el campo `composition.products` queda undefined → no crashea.
    expect(plLegacy.composition?.products).toBeUndefined();
    expect(plLegacy.composition?.services).toBeUndefined();
    // Lectura defensiva (la UI hará `?? []` en commit #8).
    expect(plLegacy.composition?.products ?? []).toEqual([]);
    expect(plLegacy.composition?.services ?? []).toEqual([]);
  });

  it("baseline correct: SalePreviewLine sin componentSaleBreakdown → válido", () => {
    const plLegacy = {
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
      // sin componentSaleBreakdown.
    } satisfies Partial<SalePreviewLine> as SalePreviewLine;

    expect(plLegacy.componentSaleBreakdown).toBeUndefined();
    // Lectura defensiva — no crashea.
    expect(plLegacy.componentSaleBreakdown ?? null).toBeNull();
  });

  it("baseline correct: pricingMeta legacy (sin componentSaleBreakdown.salePreManualDiscount) sigue válido", () => {
    const line: Pick<DocumentLine, "pricingMeta"> = {
      pricingMeta: {
        componentSaleBreakdown: {
          metal:   { base: 100, final: 100, adjustments: [] },
          hechura: { base: 50,  final: 50,  adjustments: [] },
          // sin salePreManualDiscount — shape v3.
        },
      },
    };
    expect(line.pricingMeta!.componentSaleBreakdown!.metal!.salePreManualDiscount).toBeUndefined();
    expect(line.pricingMeta!.componentSaleBreakdown!.hechura!.salePreManualDiscount).toBeUndefined();
    // Lectura defensiva — la UI lo trata como "no mostrar fila".
    const m = line.pricingMeta!.componentSaleBreakdown!.metal!;
    const pre = m.salePreManualDiscount ?? null;
    expect(pre).toBeNull();
  });
});

// =============================================================================
// 4. PASSTHROUGH PURO — el plumbing copia el objeto, no recalcula
// =============================================================================

describe("F1.3 G4.x #7 — passthrough puro (cero recálculo en plumbing)", () => {
  it("baseline correct: simulación applySalePreviewToDraft propaga products/services tal cual", () => {
    // Reproducción del patrón usado en VentasFacturas.tsx:
    //   pricingMeta.composition = (pl as any).composition ?? null;
    // Lo importante: el spread/cast NO modifica el shape del payload.
    const pl = {
      composition: {
        metal: null, hechura: null,
        products: [{ catalogItemCode: "P-1", quantity: 1, unitValue: 50, totalValue: 50 }],
        services: [{ catalogItemCode: "S-1", quantity: 2, unitValue: 30, totalValue: 60 }],
        taxes: [],
      },
      componentSaleBreakdown: {
        metal:   { base: 600, final: 540, salePreManualDiscount: 600, adjustments: [] },
        hechura: { base: 400, final: 380, salePreManualDiscount: 400, adjustments: [] },
      },
    } as any;

    // Esto es lo que hace el caller en applySalePreviewToDraft:
    const pricingMeta: any = {
      composition:            pl.composition            ?? null,
      componentSaleBreakdown: pl.componentSaleBreakdown ?? null,
    };

    // Cero transformación: products/services llegan idénticos.
    expect(pricingMeta.composition.products).toBe(pl.composition.products);
    expect(pricingMeta.composition.services).toBe(pl.composition.services);
    expect(pricingMeta.componentSaleBreakdown.metal.salePreManualDiscount).toBe(600);
    expect(pricingMeta.componentSaleBreakdown.hechura.salePreManualDiscount).toBe(400);
  });
});
