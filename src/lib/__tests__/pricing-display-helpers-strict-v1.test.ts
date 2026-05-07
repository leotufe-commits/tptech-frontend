// src/lib/__tests__/pricing-display-helpers-strict-v1.test.ts
// =============================================================================
// FASE 1.2 paso 1 — verifica el comportamiento de composeDocumentPricingDetail
// detrás del feature flag tptech_pricing_strict_v1.
//
// Política:
//   · Flag OFF (default): legacy — round2 redondea a 2 decimales.
//   · Flag ON:            passthrough — el motor backend emite redondeado;
//     local helper devuelve el valor sin tocar.
//
// REGLA: flag OFF debe dejar comportamiento idéntico al baseline. Las
// fixtures de baseline (baseline-pricing-display-helpers.test.ts) no tocan
// el flag y siguen pasando. Estos tests cubren ON.
// =============================================================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { composeDocumentPricingDetail } from "../pricing-display-helpers";
import {
  setFeatureFlag,
  resetAllFeatureFlags,
  FEATURE_FLAGS,
} from "../featureFlags";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makePreview(overrides: any = {}) {
  return {
    lines: [
      {
        articleId: "art-1",
        quantity:  3,                  // qty=3 para amplificar drift
        basePrice: 1000,
        unitPrice: 900,
        // Valor que dispara float drift: 0.1 * 3 = 0.30000000000000004
        quantityDiscountAmount:  0.1,
        promotionDiscountAmount: 0,
        appliedPriceListName: "Lista A",
        appliedPromotionName: null,
        priceSource:          "PRICE_LIST",
        taxBreakdown: [
          // Valores con drift potencial al sumar.
          { taxId: "iva", name: "IVA", rate: 21, taxAmount: 0.1 },
          { taxId: "iva", name: "IVA", rate: 21, taxAmount: 0.2 },
        ],
        componentSaleBreakdown: null,
      },
    ],
    documentTotals: {
      // Valores ya redondeados desde backend (round2 sería idempotente).
      subtotalBeforeDiscounts:    2700.50,
      lineDiscountAmount:         100.25,
      subtotalAfterLineDiscounts: 2600.25,
      channelAdjustmentAmount:    0,
      couponDiscountAmount:       0,
      paymentAdjustmentAmount:    0,
      shippingAmount:             0,
      globalDiscountAmount:       0,
      taxableBase:                2600.25,
      taxAmount:                  546.05,
      roundingAdjustment:         0,
      totalBeforeTax:             2600.25,
      totalWithTax:               3146.30,
      total:                      3146.30,
    },
    channelResult:  null,
    couponResult:   null,
    checkoutResult: null,
    clientCommercialRules: null,
    ...overrides,
  };
}

beforeEach(() => {
  // Asegura estado limpio del flag en cada test.
  resetAllFeatureFlags();
});
afterEach(() => {
  resetAllFeatureFlags();
});

// =============================================================================
// 1. Flag OFF (default) — comportamiento legacy idéntico
// =============================================================================

describe("composeDocumentPricingDetail — flag OFF (legacy)", () => {
  it("baseline correct: dt.total se mantiene tras round2 (idempotente)", () => {
    const r = composeDocumentPricingDetail({
      preview:       makePreview() as any,
      lines:         makePreview().lines,
      fallbackTotal: 0,
    });
    // round2(3146.30) → 3146.30
    expect(r.total).toBe(3146.30);
  });

  it("baseline correct: agregación qtyDiscTotal queda redondeada (sin drift visible)", () => {
    const r = composeDocumentPricingDetail({
      preview:       makePreview() as any,
      lines:         makePreview().lines,
      fallbackTotal: 0,
    });
    // qty=3 × qtyDiscUnit=0.1 = 0.30000000000000004 → round2 → 0.3
    expect(r.quantityDiscount).toBe(0.3);
  });

  it("baseline correct: tax aggregation queda redondeada", () => {
    const r = composeDocumentPricingDetail({
      preview:       makePreview() as any,
      lines:         makePreview().lines,
      fallbackTotal: 0,
    });
    // 0.1 + 0.2 = 0.30000000000000004 → round2 → 0.3
    expect(r.taxes[0].amount).toBe(0.3);
    expect(r.taxTotal).toBe(0.3);
  });
});

// =============================================================================
// 2. Flag ON — passthrough puro (drift micro permitido, fmtMoney lo absorbe)
// =============================================================================

describe("composeDocumentPricingDetail — flag ON (strict v1 passthrough)", () => {
  beforeEach(() => {
    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, true);
  });

  it("baseline correct: dt.total — passthrough idéntico (campo backend ya redondeado)", () => {
    const r = composeDocumentPricingDetail({
      preview:       makePreview() as any,
      lines:         makePreview().lines,
      fallbackTotal: 0,
    });
    // 3146.30 — pasa sin tocar; idéntico a OFF.
    expect(r.total).toBe(3146.30);
  });

  it("baseline correct: dt.* campos del backend — idéntico a OFF (idempotencia)", () => {
    const r = composeDocumentPricingDetail({
      preview:       makePreview() as any,
      lines:         makePreview().lines,
      fallbackTotal: 0,
    });
    expect(r.subtotalGross).toBe(2700.50);
    expect(r.subtotalNet).toBe(2600.25);
    expect(r.total).toBe(3146.30);
  });

  it("baseline suspicious: agregación local qtyDiscTotal expone float drift (G8 lo cierra)", () => {
    const r = composeDocumentPricingDetail({
      preview:       makePreview() as any,
      lines:         makePreview().lines,
      fallbackTotal: 0,
    });
    // qty=3 × qtyDiscUnit=0.1 = 0.30000000000000004 (drift JS de float64).
    // Sin round2, el helper devuelve el valor crudo. fmtMoney lo absorbe a
    // "0,30" en display → cero regresión visual. Cuando G8 cierre, el
    // backend emitirá quantityDiscountTotal per-doc ya redondeado.
    expect(r.quantityDiscount).toBeCloseTo(0.3, 10); // close, no exact
    // Verificamos explícitamente que el drift está presente:
    expect(r.quantityDiscount).not.toBe(0.3);
  });

  it("baseline suspicious: tax aggregation expone drift (G8 lo cierra)", () => {
    const r = composeDocumentPricingDetail({
      preview:       makePreview() as any,
      lines:         makePreview().lines,
      fallbackTotal: 0,
    });
    expect(r.taxes[0].amount).toBeCloseTo(0.3, 10);
    expect(r.taxes[0].amount).not.toBe(0.3);
  });

  it("baseline correct: comparación '> 0' sigue clasificando correctamente con drift", () => {
    // Aún con drift, 0.30000000000000004 > 0 → la fila quantityDiscount
    // se muestra (no cae al null branch).
    const r = composeDocumentPricingDetail({
      preview:       makePreview() as any,
      lines:         makePreview().lines,
      fallbackTotal: 0,
    });
    expect(r.quantityDiscount).not.toBeNull();
  });

  it("baseline correct: descuentos en cero siguen devolviendo null", () => {
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

  it("baseline correct: shape del response idéntico entre OFF y ON", () => {
    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, false);
    const off = composeDocumentPricingDetail({
      preview:       makePreview() as any,
      lines:         makePreview().lines,
      fallbackTotal: 0,
    });
    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, true);
    const on = composeDocumentPricingDetail({
      preview:       makePreview() as any,
      lines:         makePreview().lines,
      fallbackTotal: 0,
    });
    expect(Object.keys(on).sort()).toEqual(Object.keys(off).sort());
  });
});

// =============================================================================
// 3. Equivalencia OFF ≈ ON cuando no hay drift (smoke de regresión)
// =============================================================================

describe("composeDocumentPricingDetail — OFF ≈ ON con valores limpios", () => {
  it("baseline correct: sin drift, OFF y ON devuelven el mismo total", () => {
    const cleanPreview = makePreview({
      lines: [
        {
          ...makePreview().lines[0],
          // Valores enteros — sin drift.
          quantityDiscountAmount: 50,
          taxBreakdown: [{ taxId: "iva", name: "IVA", rate: 21, taxAmount: 100 }],
        },
      ],
    });

    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, false);
    const off = composeDocumentPricingDetail({
      preview:       cleanPreview as any,
      lines:         cleanPreview.lines,
      fallbackTotal: 0,
    });

    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, true);
    const on = composeDocumentPricingDetail({
      preview:       cleanPreview as any,
      lines:         cleanPreview.lines,
      fallbackTotal: 0,
    });

    expect(on.total).toBe(off.total);
    expect(on.subtotalGross).toBe(off.subtotalGross);
    expect(on.subtotalNet).toBe(off.subtotalNet);
    expect(on.taxTotal).toBe(off.taxTotal);
    expect(on.quantityDiscount).toBe(off.quantityDiscount);
  });
});
