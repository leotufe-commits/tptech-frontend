// src/lib/__tests__/pricing-display-helpers-strict-v1-visual-cases.test.ts
// =============================================================================
// FASE 1.2 paso 1 — proxy automatizado del check visual.
//
// Para cada uno de los 6 casos del playbook (1, 2, 3, 4, 6, 9), corre
// composeDocumentPricingDetail con el MISMO input bajo flag OFF y bajo
// flag ON y verifica que cada valor "que se muestra" coincide.
//
// QUÉ COBERTURA DA:
//   ✅ Detecta cualquier diferencia numérica >= 0.01 entre OFF/ON.
//   ✅ Detecta si un campo cambia de null a número o viceversa.
//   ✅ Detecta si una key del response cambia o desaparece.
//
// QUÉ NO COBERTURA:
//   ❌ Layout, colores, tonos, tipografía. Eso requiere ojo humano + el
//      playbook docs/fase-1-2-visual-regression-playbook.md.
//
// Si este test pasa, la migración no introduce regresión NUMÉRICA. Si
// además los screenshots manuales del operador no muestran diff de
// layout, el paso 1 está aprobado para merge.
// =============================================================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { composeDocumentPricingDetail } from "../pricing-display-helpers";
import type { PricingComposition } from "../pricing-display-helpers";
import {
  setFeatureFlag,
  resetAllFeatureFlags,
  FEATURE_FLAGS,
} from "../featureFlags";

// ─────────────────────────────────────────────────────────────────────────────
// Helper: corre el helper bajo OFF y bajo ON, devuelve ambos.
// ─────────────────────────────────────────────────────────────────────────────

function runBothFlags(args: Parameters<typeof composeDocumentPricingDetail>[0]): {
  off: PricingComposition;
  on:  PricingComposition;
} {
  setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, false);
  const off = composeDocumentPricingDetail(args);
  setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, true);
  const on = composeDocumentPricingDetail(args);
  return { off, on };
}

/**
 * Compara los campos "visibles" (los que la UI muestra al operador) y
 * verifica que el delta es < 0.01 para cada importe. Acepta drift micro
 * (porque fmtMoney lo absorbe en display) pero no diferencias > 1 centavo.
 */
function assertVisibleParity(off: PricingComposition, on: PricingComposition) {
  const numericFields: Array<keyof PricingComposition> = [
    "subtotalGross",
    "subtotalNet",
    "customerDiscount",
    "customerDiscountPercent",
    "channelAdjustment",
    "quantityDiscount",
    "manualDiscount",
    "promotion",
    "coupon",
    "globalDiscount",
    "shipping",
    "paymentAdjustment",
    "taxTotal",
    "rounding",
    "total",
  ];
  for (const f of numericFields) {
    const a = off[f];
    const b = on[f];
    if (a == null || b == null) {
      // null debe coincidir entre ambos (no puede pasar de null a número).
      expect(b, `campo ${String(f)} debe ser ${a === null ? "null" : "número"} en ON`).toBe(a);
    } else if (typeof a === "number" && typeof b === "number") {
      const delta = Math.abs(b - a);
      expect(delta, `campo ${String(f)} drift=${delta}`).toBeLessThan(0.01);
    } else {
      expect(b).toEqual(a);
    }
  }
  // Strings — deben ser iguales exactos.
  expect(on.priceListName).toBe(off.priceListName);
  expect(on.promotionName).toBe(off.promotionName);
  expect(on.couponName).toBe(off.couponName);
  expect(on.couponCode).toBe(off.couponCode);
  expect(on.channelName).toBe(off.channelName);
  expect(on.customerDiscountApplyOn).toBe(off.customerDiscountApplyOn);
  expect(on.fromBackend).toBe(off.fromBackend);
  // Taxes array — verifica longitud y valores con tolerancia.
  expect(on.taxes).toHaveLength(off.taxes.length);
  off.taxes.forEach((t, i) => {
    expect(on.taxes[i].name).toBe(t.name);
    expect(on.taxes[i].rate).toBe(t.rate);
    expect(Math.abs(on.taxes[i].amount - t.amount)).toBeLessThan(0.01);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mocks de los 6 casos (1, 2, 3, 4, 6, 9 del playbook)
// ─────────────────────────────────────────────────────────────────────────────

function caseSimplePreview() {
  return {
    lines: [
      {
        articleId: "art-1",
        quantity:  1,
        basePrice: 1000,
        unitPrice: 1000,
        unitTaxAmount:    0,
        unitTotalWithTax: 1000,
        quantityDiscountAmount:  0,
        promotionDiscountAmount: 0,
        lineTotal:        1000,
        lineTaxAmount:    0,
        lineTotalWithTax: 1000,
        lineDiscount:     0,
        priceSource:          "PRICE_LIST",
        appliedPriceListName: "Lista A",
        appliedPromotionName: null,
        taxBreakdown:         [],
        componentSaleBreakdown: null,
      },
    ],
    documentTotals: {
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
    channelResult: null, couponResult: null, checkoutResult: null,
    clientCommercialRules: null,
  };
}

function caseIva21Preview() {
  const p = caseSimplePreview() as any;
  p.lines[0].unitTaxAmount    = 210;
  p.lines[0].unitTotalWithTax = 1210;
  p.lines[0].lineTaxAmount    = 210;
  p.lines[0].lineTotalWithTax = 1210;
  p.lines[0].taxBreakdown = [{ taxId: "iva", name: "IVA", rate: 21, taxAmount: 210 }];
  p.documentTotals.taxAmount    = 210;
  p.documentTotals.totalWithTax = 1210;
  p.documentTotals.total        = 1210;
  return p;
}

function casePromoPreview() {
  const p = caseIva21Preview() as any;
  p.lines[0].quantity              = 2;
  p.lines[0].unitPrice             = 900;     // 10% off de 1000
  p.lines[0].promotionDiscountAmount = 100;   // per-unit
  p.lines[0].lineTotal             = 1800;
  p.lines[0].lineTaxAmount         = 378;
  p.lines[0].lineTotalWithTax      = 2178;
  p.lines[0].lineDiscount          = 200;
  p.lines[0].priceSource           = "PROMOTION";
  p.lines[0].appliedPromotionName  = "Black Friday";
  p.lines[0].taxBreakdown[0].taxAmount = 378;
  p.documentTotals.subtotalBeforeDiscounts    = 2000;
  p.documentTotals.lineDiscountAmount         = 200;
  p.documentTotals.subtotalAfterLineDiscounts = 1800;
  p.documentTotals.taxableBase                = 1800;
  p.documentTotals.taxAmount                  = 378;
  p.documentTotals.totalBeforeTax             = 1800;
  p.documentTotals.totalWithTax               = 2178;
  p.documentTotals.total                      = 2178;
  return p;
}

function caseQtyDiscountPreview() {
  const p = casePromoPreview() as any;
  p.lines[0].quantity = 10;
  // Para no inventar números, mantengo proporcional.
  p.lines[0].quantityDiscountAmount  = 50;   // per-unit qty discount
  p.lines[0].promotionDiscountAmount = 0;
  p.lines[0].priceSource             = "QUANTITY_DISCOUNT";
  p.lines[0].appliedPromotionName    = null;
  p.lines[0].unitPrice               = 950;  // 1000 - 50
  p.lines[0].lineTotal               = 9500;
  p.lines[0].lineTaxAmount           = 1995;
  p.lines[0].lineTotalWithTax        = 11495;
  p.lines[0].lineDiscount            = 500;
  p.lines[0].taxBreakdown[0].taxAmount = 1995;
  p.documentTotals.subtotalBeforeDiscounts    = 10000;
  p.documentTotals.lineDiscountAmount         = 500;
  p.documentTotals.subtotalAfterLineDiscounts = 9500;
  p.documentTotals.taxableBase                = 9500;
  p.documentTotals.taxAmount                  = 1995;
  p.documentTotals.totalBeforeTax             = 9500;
  p.documentTotals.totalWithTax               = 11495;
  p.documentTotals.total                      = 11495;
  return p;
}

function caseMetalHechuraPreview() {
  const p = caseIva21Preview() as any;
  p.lines[0].metalHechuraBreakdown = {
    metalCost:        600,
    metalSale:        750,
    metalMarginPct:   25,
    hechuraCost:      200,
    hechuraSale:      250,
    hechuraMarginPct: 25,
  };
  return p;
}

function caseRedondeoListaPreview() {
  const p = caseIva21Preview() as any;
  // Lista que redondea a 50 absorbe 30 del total.
  p.documentTotals.roundingAdjustment = 20;
  p.documentTotals.total              = 1230;       // 1210 + 20 redondeo
  p.documentTotals.totalWithTax       = 1230;
  p.documentTotals.roundingInfo = {
    source:        "PRICE_LIST",
    priceListId:   "pl-1",
    priceListName: "Lista A",
    applyOn:       "TOTAL",
    mode:          "DECIMAL",
    direction:     "NEAREST",
  };
  return p;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests — un test por caso del playbook
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => { resetAllFeatureFlags(); });
afterEach(()  => { resetAllFeatureFlags(); });

describe("F1.2 paso 1 — proxy visual OFF vs ON (6 casos del playbook)", () => {
  it("Caso 1 — Producto simple (qty=1, sin descuento, sin tax)", () => {
    const preview = caseSimplePreview();
    const { off, on } = runBothFlags({
      preview:       preview as any,
      lines:         preview.lines,
      fallbackTotal: 0,
    });
    expect(on.total).toBe(off.total);
    assertVisibleParity(off, on);
  });

  it("Caso 2 — IVA 21% (verificar desglose tax)", () => {
    const preview = caseIva21Preview();
    const { off, on } = runBothFlags({
      preview:       preview as any,
      lines:         preview.lines,
      fallbackTotal: 0,
    });
    expect(on.total).toBe(1210);
    expect(on.taxTotal).toBe(off.taxTotal);
    expect(on.taxes[0].amount).toBe(210);
    assertVisibleParity(off, on);
  });

  it("Caso 3 — Promoción (10% off + IVA, qty=2)", () => {
    const preview = casePromoPreview();
    const { off, on } = runBothFlags({
      preview:       preview as any,
      lines:         preview.lines,
      fallbackTotal: 0,
    });
    expect(on.total).toBe(2178);
    expect(on.promotion).toBe(off.promotion);   // 100 × 2 = 200
    expect(on.promotionName).toBe("Black Friday");
    assertVisibleParity(off, on);
  });

  it("Caso 4 — Quantity discount (qty=10 con QD per-unit=50)", () => {
    const preview = caseQtyDiscountPreview();
    const { off, on } = runBothFlags({
      preview:       preview as any,
      lines:         preview.lines,
      fallbackTotal: 0,
    });
    expect(on.total).toBe(11495);
    expect(on.quantityDiscount).toBe(off.quantityDiscount); // 10 × 50 = 500
    assertVisibleParity(off, on);
  });

  it("Caso 6 — Metal + hechura (verificar TPPriceCompositionKpis input)", () => {
    const preview = caseMetalHechuraPreview();
    const { off, on } = runBothFlags({
      preview:       preview as any,
      lines:         preview.lines,
      fallbackTotal: 0,
    });
    // composeDocumentPricingDetail no procesa metalHechuraBreakdown
    // directamente, pero verificamos que totales no se vean afectados
    // por la presencia del breakdown.
    expect(on.total).toBe(1210);
    expect(on.taxTotal).toBe(210);
    assertVisibleParity(off, on);
  });

  it("Caso 9 — Redondeo lista (roundingAdjustment + roundingInfo)", () => {
    const preview = caseRedondeoListaPreview();
    const { off, on } = runBothFlags({
      preview:       preview as any,
      lines:         preview.lines,
      fallbackTotal: 0,
    });
    expect(on.total).toBe(1230);
    expect(on.rounding).toBe(off.rounding);     // 20
    expect(on.roundingInfo?.source).toBe("PRICE_LIST");
    expect(on.roundingInfo?.priceListName).toBe("Lista A");
    assertVisibleParity(off, on);
  });
});

// =============================================================================
// Smoke test agregado: shape del response idéntico para los 6 casos.
// =============================================================================

describe("F1.2 paso 1 — shape estable del response entre OFF y ON", () => {
  const cases = [
    { name: "Caso 1 simple",       build: caseSimplePreview },
    { name: "Caso 2 iva21",        build: caseIva21Preview },
    { name: "Caso 3 promo",        build: casePromoPreview },
    { name: "Caso 4 qty discount", build: caseQtyDiscountPreview },
    { name: "Caso 6 metal+hechura",build: caseMetalHechuraPreview },
    { name: "Caso 9 redondeo",     build: caseRedondeoListaPreview },
  ];

  for (const c of cases) {
    it(`baseline correct: ${c.name} — Object.keys(off) === Object.keys(on)`, () => {
      const preview = c.build();
      const { off, on } = runBothFlags({
        preview:       preview as any,
        lines:         preview.lines,
        fallbackTotal: 0,
      });
      expect(Object.keys(on).sort()).toEqual(Object.keys(off).sort());
    });
  }
});
