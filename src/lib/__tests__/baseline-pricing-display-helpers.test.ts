// src/lib/__tests__/baseline-pricing-display-helpers.test.ts
// =============================================================================
// FASE 1.0 — PR1 baseline. Congela `composeDocumentPricingDetail` de
// `pricing-display-helpers.ts`. Cubre Priority 6 (composeDocumentPricingDetail)
// y, indirectamente, splitLineDiscounts (Priority 7) que usa la misma
// agregación qty × unitDiscount + round2.
//
// Dado que el helper agrega legacy (`qty × qtyDiscUnit`, `qty × promoDiscUnit`)
// y aplica round2 sobre campos del backend (que ya están redondeados), los
// tests marcan esos comportamientos como `baseline legacy` para que la
// migración Fase 1.2 los detecte y los reemplace cuando el backend exponga
// `quantityDiscountTotal` y `promotionDiscountTotal` doc-level (Gap G8).
// =============================================================================

import { describe, it, expect } from "vitest";
import { composeDocumentPricingDetail } from "../pricing-display-helpers";

// ── Mocks ────────────────────────────────────────────────────────────────────

function makePreview(overrides: any = {}) {
  return {
    lines: [
      {
        articleId: "art-1",
        quantity:  2,
        basePrice: 1000,
        unitPrice: 900,
        quantityDiscountAmount:  50,    // per-unit
        promotionDiscountAmount: 0,
        appliedPriceListName: "Lista A",
        appliedPromotionName: null,
        priceSource:          "PRICE_LIST",
        taxBreakdown: [
          { taxId: "iva", name: "IVA", rate: 21, taxAmount: 189, base: 900 },
        ],
        componentSaleBreakdown: null,
      },
    ],
    documentTotals: {
      subtotalBeforeDiscounts:    2000,
      lineDiscountAmount:         100,
      subtotalAfterLineDiscounts: 1900,
      channelAdjustmentAmount:    0,
      couponDiscountAmount:       0,
      paymentAdjustmentAmount:    0,
      shippingAmount:             0,
      globalDiscountAmount:       0,
      taxableBase:                1900,
      taxAmount:                  399,
      roundingAdjustment:         0,
      totalBeforeTax:             1900,
      totalWithTax:               2299,
      total:                      2299,
    },
    channelResult:  null,
    couponResult:   null,
    checkoutResult: null,
    clientCommercialRules: null,
    ...overrides,
  };
}

// =============================================================================
// 1. Sin preview → fallback con todos los campos null (correct)
// =============================================================================

describe("composeDocumentPricingDetail — sin preview (fallback)", () => {
  it("baseline correct: total = fallbackTotal y campos derivados null", () => {
    const r = composeDocumentPricingDetail({
      preview:       null,
      lines:         [],
      fallbackTotal: 1234,
    });
    expect(r.total).toBe(1234);
    expect(r.fromBackend).toBe(false);
    expect(r.subtotalGross).toBeNull();
    expect(r.subtotalNet).toBeNull();
    expect(r.taxes).toEqual([]);
    expect(r.taxTotal).toBe(0);
  });

  it("baseline correct: shipping refleja fallbackShipping cuando >0 (sin preview)", () => {
    const r = composeDocumentPricingDetail({
      preview:          null,
      lines:            [],
      fallbackTotal:    1500,
      fallbackShipping: 300,
    });
    expect(r.shipping).toBe(300);
  });

  it("baseline correct: shipping null cuando fallbackShipping es 0 o undefined", () => {
    const r = composeDocumentPricingDetail({
      preview:       null,
      lines:         [],
      fallbackTotal: 0,
    });
    expect(r.shipping).toBeNull();
  });
});

// =============================================================================
// 2. Con preview → passthrough de documentTotals (correct)
// =============================================================================

describe("composeDocumentPricingDetail — con preview, passthrough", () => {
  it("baseline correct: total = dt.total (passthrough)", () => {
    const preview = makePreview();
    const r = composeDocumentPricingDetail({
      preview:       preview as any,
      lines:         preview.lines,
      fallbackTotal: 0, // no se usa
    });
    expect(r.total).toBe(2299);
    expect(r.fromBackend).toBe(true);
  });

  it("baseline correct: subtotalGross y subtotalNet son passthrough de documentTotals", () => {
    const preview = makePreview();
    const r = composeDocumentPricingDetail({
      preview:       preview as any,
      lines:         preview.lines,
      fallbackTotal: 0,
    });
    expect(r.subtotalGross).toBe(2000);
    expect(r.subtotalNet).toBe(1900);
  });

  it("baseline correct: priceListName 'Lista A' cuando todas las líneas usan la misma", () => {
    const preview = makePreview();
    const r = composeDocumentPricingDetail({
      preview:       preview as any,
      lines:         preview.lines,
      fallbackTotal: 0,
    });
    expect(r.priceListName).toBe("Lista A");
    expect(r.priceListNamesUnique).toEqual(["Lista A"]);
  });

  it("baseline correct: priceListName='Mixta' cuando hay ≥2 listas distintas", () => {
    const preview = makePreview({
      lines: [
        { ...makePreview().lines[0], appliedPriceListName: "Lista A" },
        { ...makePreview().lines[0], articleId: "art-2", appliedPriceListName: "Lista B" },
      ],
    });
    const r = composeDocumentPricingDetail({
      preview:       preview as any,
      lines:         preview.lines,
      fallbackTotal: 0,
    });
    expect(r.priceListName).toBe("Mixta");
    expect(r.priceListNamesUnique.sort()).toEqual(["Lista A", "Lista B"]);
  });
});

// =============================================================================
// 3. Agregación qtyDiscTotal / promoDiscTotal (legacy — Priority 7)
// =============================================================================

describe("composeDocumentPricingDetail — agregación de descuentos por línea (legacy)", () => {
  it("baseline legacy: quantityDiscount = round2(Σ qty × qtyDiscUnit)", () => {
    const preview = makePreview();
    // Línea: qty=2, qtyDiscUnit=50 → 2 × 50 = 100
    const r = composeDocumentPricingDetail({
      preview:       preview as any,
      lines:         preview.lines,
      fallbackTotal: 0,
    });
    expect(r.quantityDiscount).toBe(100);
  });

  it("baseline legacy: promotion = round2(Σ qty × promoDiscUnit)", () => {
    const preview = makePreview({
      lines: [
        {
          ...makePreview().lines[0],
          quantityDiscountAmount:  0,
          promotionDiscountAmount: 30, // per-unit
          appliedPromotionName:    "Black Friday",
        },
      ],
    });
    // qty=2, promo=30 → 60
    const r = composeDocumentPricingDetail({
      preview:       preview as any,
      lines:         preview.lines,
      fallbackTotal: 0,
    });
    expect(r.promotion).toBe(60);
    expect(r.promotionName).toBe("Black Friday");
  });

  it("baseline correct: quantityDiscount = null cuando suma 0", () => {
    const preview = makePreview({
      lines: [
        {
          ...makePreview().lines[0],
          quantityDiscountAmount:  0,
          promotionDiscountAmount: 0,
        },
      ],
    });
    const r = composeDocumentPricingDetail({
      preview:       preview as any,
      lines:         preview.lines,
      fallbackTotal: 0,
    });
    expect(r.quantityDiscount).toBeNull();
    expect(r.promotion).toBeNull();
  });

  it("baseline legacy: manualDiscount agrega cuando priceSource=MANUAL_OVERRIDE y qtyDiscUnit>0", () => {
    const preview = makePreview({
      lines: [
        {
          ...makePreview().lines[0],
          priceSource:             "MANUAL_OVERRIDE",
          quantityDiscountAmount:  75,  // per-unit, en realidad es manual
          promotionDiscountAmount: 0,
        },
      ],
    });
    const r = composeDocumentPricingDetail({
      preview:       preview as any,
      lines:         preview.lines,
      fallbackTotal: 0,
    });
    // qty=2 × 75 = 150 (manual, no qty)
    expect(r.manualDiscount).toBe(150);
    expect(r.quantityDiscount).toBeNull();
  });
});

// =============================================================================
// 4. Tax aggregation (legacy con round2 pero conceptualmente correct)
// =============================================================================

describe("composeDocumentPricingDetail — agregación de taxBreakdown", () => {
  it("baseline correct: taxes agrupa por (name + rate)", () => {
    const preview = makePreview({
      lines: [
        {
          ...makePreview().lines[0],
          taxBreakdown: [
            { taxId: "iva", name: "IVA", rate: 21, taxAmount: 189 },
          ],
        },
        {
          ...makePreview().lines[0],
          articleId: "art-2",
          taxBreakdown: [
            { taxId: "iva",  name: "IVA",  rate: 21,  taxAmount: 100 },
            { taxId: "iibb", name: "IIBB", rate: 3.5, taxAmount: 35 },
          ],
        },
      ],
    });
    const r = composeDocumentPricingDetail({
      preview:       preview as any,
      lines:         preview.lines,
      fallbackTotal: 0,
    });
    expect(r.taxes).toHaveLength(2);
    const iva  = r.taxes.find(t => t.name === "IVA");
    const iibb = r.taxes.find(t => t.name === "IIBB");
    expect(iva?.amount).toBe(289);   // 189 + 100
    expect(iibb?.amount).toBe(35);
  });

  it("baseline correct: taxes ordenados por rate descendente", () => {
    const preview = makePreview({
      lines: [
        {
          ...makePreview().lines[0],
          taxBreakdown: [
            { name: "IIBB", rate: 3.5, taxAmount: 35 },
            { name: "IVA",  rate: 21,  taxAmount: 189 },
          ],
        },
      ],
    });
    const r = composeDocumentPricingDetail({
      preview:       preview as any,
      lines:         preview.lines,
      fallbackTotal: 0,
    });
    expect(r.taxes[0].rate).toBe(21);
    expect(r.taxes[1].rate).toBe(3.5);
  });

  it("baseline correct: taxTotal = Σ taxes[i].amount", () => {
    const preview = makePreview();
    const r = composeDocumentPricingDetail({
      preview:       preview as any,
      lines:         preview.lines,
      fallbackTotal: 0,
    });
    expect(r.taxTotal).toBe(189);
  });
});

// =============================================================================
// 5. Channel / Coupon / Payment / Shipping passthrough
// =============================================================================

describe("composeDocumentPricingDetail — channel/coupon/payment/shipping", () => {
  it("baseline correct: channelAdjustment passthrough cuando |amount| >= 0.01", () => {
    const preview = makePreview({
      channelResult: { channelId: "ch-1", channelName: "Web", channelAmount: 50 },
      documentTotals: {
        ...makePreview().documentTotals,
        channelAdjustmentAmount: 50,
      },
    });
    const r = composeDocumentPricingDetail({
      preview:       preview as any,
      lines:         preview.lines,
      fallbackTotal: 0,
    });
    expect(r.channelAdjustment).toBe(50);
    expect(r.channelName).toBe("Web");
  });

  it("baseline correct: channelAdjustment null cuando |amount| < 0.01", () => {
    const preview = makePreview({
      channelResult: { channelId: "ch-1", channelName: "Web", channelAmount: 0 },
    });
    const r = composeDocumentPricingDetail({
      preview:       preview as any,
      lines:         preview.lines,
      fallbackTotal: 0,
    });
    expect(r.channelAdjustment).toBeNull();
  });

  it("baseline correct: coupon passthrough cuando dt.couponDiscountAmount > 0", () => {
    const preview = makePreview({
      couponResult: { couponCode: "DESC10", couponName: "10% off", applied: true },
      documentTotals: { ...makePreview().documentTotals, couponDiscountAmount: 100 },
    });
    const r = composeDocumentPricingDetail({
      preview:       preview as any,
      lines:         preview.lines,
      fallbackTotal: 0,
    });
    expect(r.coupon).toBe(100);
    expect(r.couponCode).toBe("DESC10");
    expect(r.couponName).toBe("10% off");
  });

  it("baseline correct: shipping passthrough cuando dt.shippingAmount > 0", () => {
    const preview = makePreview({
      documentTotals: { ...makePreview().documentTotals, shippingAmount: 500 },
    });
    const r = composeDocumentPricingDetail({
      preview:       preview as any,
      lines:         preview.lines,
      fallbackTotal: 0,
    });
    expect(r.shipping).toBe(500);
  });

  it("baseline correct: paymentAdjustment passthrough cuando |adj| >= 0.01", () => {
    const preview = makePreview({
      documentTotals: { ...makePreview().documentTotals, paymentAdjustmentAmount: -25 },
    });
    const r = composeDocumentPricingDetail({
      preview:       preview as any,
      lines:         preview.lines,
      fallbackTotal: 0,
    });
    expect(r.paymentAdjustment).toBe(-25);
  });

  it("baseline correct: rounding y roundingInfo passthrough", () => {
    const preview = makePreview({
      documentTotals: {
        ...makePreview().documentTotals,
        roundingAdjustment: 0.5,
        roundingInfo: {
          source:        "PRICE_LIST",
          priceListName: "Lista A",
          applyOn:       "TOTAL",
          mode:          "DECIMAL",
          direction:     "NEAREST",
        },
      },
    });
    const r = composeDocumentPricingDetail({
      preview:       preview as any,
      lines:         preview.lines,
      fallbackTotal: 0,
    });
    expect(r.rounding).toBe(0.5);
    expect(r.roundingInfo?.source).toBe("PRICE_LIST");
    expect(r.roundingInfo?.priceListName).toBe("Lista A");
  });
});

// =============================================================================
// 6. Customer discount desde componentSaleBreakdown (legacy aggregation)
// =============================================================================

describe("composeDocumentPricingDetail — customerDiscount", () => {
  it("baseline legacy: agrega ENTITY_RULE/CLIENT adjustments per-unit × qty", () => {
    const preview = makePreview({
      lines: [
        {
          ...makePreview().lines[0],
          quantity: 2,
          componentSaleBreakdown: {
            metal: {
              base:  600,
              final: 540,
              adjustments: [
                {
                  kind:   "ENTITY_RULE",
                  source: "CLIENT",
                  amount: 30,    // per-unit
                  percentage: 5,
                },
              ],
            },
            hechura: { base: 200, final: 200, adjustments: [] },
          },
        },
      ],
      clientCommercialRules: { ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 5, applyOn: "METAL" },
    });
    const r = composeDocumentPricingDetail({
      preview:       preview as any,
      lines:         preview.lines,
      fallbackTotal: 0,
    });
    // 30 per-unit × 2 qty = 60
    expect(r.customerDiscount).toBe(60);
    expect(r.customerDiscountApplyOn).toBe("METAL");
    expect(r.customerDiscountPercent).toBe(5);
  });

  it("baseline correct: customerDiscount=null cuando no hay adjustments y no hay rule activa", () => {
    const preview = makePreview();
    const r = composeDocumentPricingDetail({
      preview:       preview as any,
      lines:         preview.lines,
      fallbackTotal: 0,
    });
    expect(r.customerDiscount).toBeNull();
    expect(r.customerDiscountApplyOn).toBeNull();
  });

  it("baseline correct: cuando rule activa pero motor no emite adjustments por componente, applyOn cae al de la rule", () => {
    const preview = makePreview({
      clientCommercialRules: { ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 10, applyOn: "TOTAL" },
    });
    const r = composeDocumentPricingDetail({
      preview:       preview as any,
      lines:         preview.lines,
      fallbackTotal: 0,
    });
    // POLICY R4.4 — sin adjustments el motor no expone monto desglosado.
    // El frontend NO deriva — devuelve null y la UI muestra "—".
    expect(r.customerDiscount).toBeNull();
    expect(r.customerDiscountApplyOn).toBe("TOTAL");
    expect(r.customerDiscountPercent).toBe(10);
  });
});
