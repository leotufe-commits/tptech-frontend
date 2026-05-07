// src/lib/pricing/__tests__/normalize-strict-v1.test.ts
// =============================================================================
// FASE 1.2 paso 2 — verifica el comportamiento de normalizeArticlePricingPreview
// detrás del feature flag tptech_pricing_strict_v1.
//
// Política:
//   · Flag OFF (default): legacy idéntico — escala unitX × qty con r2().
//   · Flag ON: lee top-level del backend (G3 commit 539c437):
//       result.lineTotal / lineTaxAmount / lineTotalWithTax.
//     Si el campo NO viene (backend legacy desplegado), cae a r2 legacy.
//
// Cubre Priority 1 (frontend reader-only para simulador).
//
// GAPs documentados pero no migrados acá:
//   G3.1 — lineDiscount (backend no emite top-level). Legacy bajo ambos flags.
//   G3.2 — channelDoc / couponDoc (escalan con r2). Out of scope.
// =============================================================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { normalizeArticlePricingPreview } from "../normalizePricingPreviewResult";
import {
  setFeatureFlag,
  resetAllFeatureFlags,
  FEATURE_FLAGS,
} from "../../featureFlags";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeArticleResult(overrides: any = {}) {
  return {
    basePrice:    "1000",
    unitPrice:    "1000",
    taxAmount:    "210",
    totalWithTax: "1210",
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
    ...overrides,
  };
}

beforeEach(() => { resetAllFeatureFlags(); });
afterEach(()  => { resetAllFeatureFlags(); });

// =============================================================================
// 1. Flag OFF (default) — comportamiento legacy idéntico al baseline
// =============================================================================

describe("normalizeArticlePricingPreview — flag OFF (legacy)", () => {
  it("baseline correct: lineTotal escala con r2(unitPrice × qty)", () => {
    const result = makeArticleResult({ unitPrice: "100.00" });
    const norm = normalizeArticlePricingPreview({
      result: result as any, articleId: "a1", quantity: 3,
    });
    expect(norm.lines[0].lineTotal).toBe(300);
  });

  it("baseline correct: lineTaxAmount escala con r2(unitTax × qty)", () => {
    const result = makeArticleResult({ taxAmount: "21.00" });
    const norm = normalizeArticlePricingPreview({
      result: result as any, articleId: "a1", quantity: 4,
    });
    expect(norm.lines[0].lineTaxAmount).toBe(84);
  });

  it("baseline correct: lineTotalWithTax escala con r2(unitTotalWithTax × qty)", () => {
    const result = makeArticleResult({ totalWithTax: "1210" });
    const norm = normalizeArticlePricingPreview({
      result: result as any, articleId: "a1", quantity: 5,
    });
    expect(norm.lines[0].lineTotalWithTax).toBe(6050);
  });

  it("baseline correct: ignora result.lineTotal si viene (no migra bajo OFF)", () => {
    // Aunque el backend G3 emita el campo, bajo OFF lo ignora y escala legacy.
    const result = makeArticleResult({
      unitPrice: "100",
      lineTotal: 9999, // backend dice 9999, legacy ignora y calcula 100*3=300
    });
    const norm = normalizeArticlePricingPreview({
      result: result as any, articleId: "a1", quantity: 3,
    });
    expect(norm.lines[0].lineTotal).toBe(300); // legacy gana
  });
});

// =============================================================================
// 2. Flag ON — passthrough con G3 backend
// =============================================================================

describe("normalizeArticlePricingPreview — flag ON (strict v1, G3 passthrough)", () => {
  beforeEach(() => {
    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, true);
  });

  it("baseline correct: lineTotal usa result.lineTotal del backend (no escala local)", () => {
    const result = makeArticleResult({
      unitPrice: "100.00",
      // backend ya escaló: 100 × 3 = 300, pero podría tener redondeo distinto
      lineTotal: 300,
    });
    const norm = normalizeArticlePricingPreview({
      result: result as any, articleId: "a1", quantity: 3,
    });
    expect(norm.lines[0].lineTotal).toBe(300);
  });

  it("baseline correct: backend emite valor distinto al cálculo local — gana backend", () => {
    // Caso real: lista con redondeo a 50. Backend devuelve 9500, legacy
    // calcularía 9509.68. Bajo ON, ganan los 9500 del motor.
    const result = makeArticleResult({
      unitPrice:    "950.968",
      lineTotal:    9500,    // backend con redondeo de lista
      lineTaxAmount:    1995,
      lineTotalWithTax: 11495,
    });
    const norm = normalizeArticlePricingPreview({
      result: result as any, articleId: "a1", quantity: 10,
    });
    expect(norm.lines[0].lineTotal).toBe(9500);          // backend, NO 9509.68
    expect(norm.lines[0].lineTaxAmount).toBe(1995);      // backend
    expect(norm.lines[0].lineTotalWithTax).toBe(11495);  // backend
  });

  it("baseline correct: si backend NO emite lineTotal (legacy backend), cae a legacy r2", () => {
    const result = makeArticleResult({ unitPrice: "100" });
    // Sin lineTotal en el response — simula backend pre-G3.
    const norm = normalizeArticlePricingPreview({
      result: result as any, articleId: "a1", quantity: 3,
    });
    // Cae a legacy: r2(100 * 3) = 300
    expect(norm.lines[0].lineTotal).toBe(300);
  });

  it("baseline correct: lineTaxAmount=0 del backend se respeta (no es 'falsy')", () => {
    const result = makeArticleResult({
      taxAmount:     "999",  // legacy calcularía 999*qty
      lineTaxAmount: 0,       // backend dice 0 (artículo exento)
    });
    const norm = normalizeArticlePricingPreview({
      result: result as any, articleId: "a1", quantity: 5,
    });
    expect(norm.lines[0].lineTaxAmount).toBe(0); // backend, no 4995
  });

  it("baseline correct: lineDiscount usa result.lineDiscount del backend (G3.1 cerrado)", () => {
    // G3.1 cerrado — backend emite lineDiscount top-level.
    const result = makeArticleResult({
      basePrice:    "1000",
      unitPrice:    "900",
      lineTotal:    1800,
      lineDiscount: 200,  // backend lo emite plano (= (1000-900) × 2)
    });
    const norm = normalizeArticlePricingPreview({
      result: result as any, articleId: "a1", quantity: 2,
    });
    expect(norm.lines[0].lineDiscount).toBe(200); // backend, no derivación local
  });

  it("baseline correct: backend emite lineDiscount distinto al legacy → gana backend", () => {
    // Caso edge: el backend computó con redondeo distinto al naive.
    const result = makeArticleResult({
      basePrice:    "1000",
      unitPrice:    "900",
      lineDiscount: 199.50,  // backend con redondeo de lista (no 200)
    });
    const norm = normalizeArticlePricingPreview({
      result: result as any, articleId: "a1", quantity: 2,
    });
    expect(norm.lines[0].lineDiscount).toBe(199.50); // backend, NO 200
  });

  it("baseline correct: lineDiscount=0 del backend se respeta", () => {
    const result = makeArticleResult({
      basePrice:    "1000",
      unitPrice:    "1000",
      lineDiscount: 0,
    });
    const norm = normalizeArticlePricingPreview({
      result: result as any, articleId: "a1", quantity: 2,
    });
    expect(norm.lines[0].lineDiscount).toBe(0);
  });

  it("baseline correct: lineDiscount negativo (override sube precio) se respeta", () => {
    // unitPrice > basePrice por override manual → discount negativo
    // semánticamente "recargo manual". El backend lo emite sin clamp.
    const result = makeArticleResult({
      basePrice:    "1000",
      unitPrice:    "1100",
      lineDiscount: -200,
    });
    const norm = normalizeArticlePricingPreview({
      result: result as any, articleId: "a1", quantity: 2,
    });
    expect(norm.lines[0].lineDiscount).toBe(-200);
  });

  it("baseline correct: si backend NO emite lineDiscount (legacy backend), cae a r2 local", () => {
    const result = makeArticleResult({
      basePrice: "1000",
      unitPrice: "900",
      // lineDiscount AUSENTE — simula backend pre-G3.1
    });
    const norm = normalizeArticlePricingPreview({
      result: result as any, articleId: "a1", quantity: 2,
    });
    // Cae a legacy: r2((1000-900) × 2) = 200
    expect(norm.lines[0].lineDiscount).toBe(200);
  });
});

// =============================================================================
// 3. Equivalencia OFF ≈ ON cuando backend respeta cálculo legacy
// =============================================================================

describe("normalizeArticlePricingPreview — paridad OFF vs ON con backend coherente", () => {
  it("baseline correct: backend emite los mismos números que legacy → OFF y ON coinciden", () => {
    const buildResult = () => makeArticleResult({
      unitPrice:        "1000",
      taxAmount:        "210",
      totalWithTax:     "1210",
      lineTotal:        2000, // 1000 × 2
      lineTaxAmount:    420,  // 210 × 2
      lineTotalWithTax: 2420, // 1210 × 2
    });

    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, false);
    const off = normalizeArticlePricingPreview({
      result: buildResult() as any, articleId: "a1", quantity: 2,
    });

    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, true);
    const on = normalizeArticlePricingPreview({
      result: buildResult() as any, articleId: "a1", quantity: 2,
    });

    expect(on.lines[0].lineTotal).toBe(off.lines[0].lineTotal);
    expect(on.lines[0].lineTaxAmount).toBe(off.lines[0].lineTaxAmount);
    expect(on.lines[0].lineTotalWithTax).toBe(off.lines[0].lineTotalWithTax);
    expect(on.lines[0].lineDiscount).toBe(off.lines[0].lineDiscount);
  });

  it("baseline correct: shape del response idéntico entre OFF y ON", () => {
    const result = makeArticleResult({
      lineTotal: 2000, lineTaxAmount: 420, lineTotalWithTax: 2420,
    });

    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, false);
    const off = normalizeArticlePricingPreview({
      result: result as any, articleId: "a1", quantity: 2,
    });

    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, true);
    const on = normalizeArticlePricingPreview({
      result: result as any, articleId: "a1", quantity: 2,
    });

    expect(Object.keys(on.lines[0]).sort()).toEqual(Object.keys(off.lines[0]).sort());
    expect(Object.keys(on).sort()).toEqual(Object.keys(off).sort());
  });
});

// =============================================================================
// 4. Casos del playbook visual (subset aplicable al simulador)
// =============================================================================

describe("F1.2 paso 2 — proxy visual OFF vs ON (casos del simulador)", () => {
  function runBoth(result: any, qty: number) {
    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, false);
    const off = normalizeArticlePricingPreview({
      result, articleId: "a1", quantity: qty,
    });
    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, true);
    const on = normalizeArticlePricingPreview({
      result, articleId: "a1", quantity: qty,
    });
    return { off, on };
  }

  it("Caso 1 — Producto simple (qty=1)", () => {
    const result = makeArticleResult({
      unitPrice: "1000", taxAmount: "0", totalWithTax: "1000",
      lineTotal: 1000, lineTaxAmount: 0, lineTotalWithTax: 1000,
    });
    const { off, on } = runBoth(result, 1);
    expect(on.lines[0].lineTotal).toBe(off.lines[0].lineTotal);
    expect(on.lines[0].lineTotalWithTax).toBe(off.lines[0].lineTotalWithTax);
  });

  it("Caso 2 — IVA 21%", () => {
    const result = makeArticleResult({
      unitPrice: "1000", taxAmount: "210", totalWithTax: "1210",
      lineTotal: 1000, lineTaxAmount: 210, lineTotalWithTax: 1210,
    });
    const { off, on } = runBoth(result, 1);
    expect(on.lines[0].lineTaxAmount).toBe(off.lines[0].lineTaxAmount);
    expect(Math.abs(on.lines[0].lineTaxAmount - 210)).toBeLessThan(0.01);
  });

  it("Caso 3 — Promoción (qty=2)", () => {
    const result = makeArticleResult({
      basePrice: "1000", unitPrice: "900",
      taxAmount: "189", totalWithTax: "1089",
      promotionDiscountAmount: "100",
      priceSource: "PROMOTION",
      appliedPromotionName: "Black Friday",
      lineTotal: 1800, lineTaxAmount: 378, lineTotalWithTax: 2178,
    });
    const { off, on } = runBoth(result, 2);
    expect(on.lines[0].lineTotal).toBe(off.lines[0].lineTotal);
    expect(on.lines[0].lineDiscount).toBe(off.lines[0].lineDiscount);
  });

  it("Caso 4 — Quantity discount (qty=10)", () => {
    const result = makeArticleResult({
      basePrice: "1000", unitPrice: "950",
      taxAmount: "199.5", totalWithTax: "1149.5",
      quantityDiscountAmount: "50",
      priceSource: "QUANTITY_DISCOUNT",
      lineTotal: 9500, lineTaxAmount: 1995, lineTotalWithTax: 11495,
    });
    const { off, on } = runBoth(result, 10);
    expect(on.lines[0].lineTotal).toBe(off.lines[0].lineTotal);
    expect(on.lines[0].lineDiscount).toBe(off.lines[0].lineDiscount);
  });

  it("Caso 9 — Redondeo lista (backend emite redondeado, ON gana)", () => {
    // Lista con redondeo a 50: backend devuelve 1850 en vez de 1849.32.
    // Bajo ON, el frontend muestra 1850. Bajo OFF, calcula 949.66 * 2 = 1899.32.
    const result = makeArticleResult({
      unitPrice:        "924.66",
      taxAmount:        "194.18",
      totalWithTax:     "1118.84",
      lineTotal:        1850,    // backend con redondeo de lista
      lineTaxAmount:    388.36,
      lineTotalWithTax: 2237.68,
    });
    const { off, on } = runBoth(result, 2);
    // ON respeta el redondeo de la lista (1850); OFF lo recalcula (1849.32).
    expect(on.lines[0].lineTotal).toBe(1850);
    expect(off.lines[0].lineTotal).toBe(1849.32);
    // El delta documenta exactamente el bug que resolvemos: bajo ON, el
    // frontend respeta el redondeo del motor (POLICY R4.5).
  });
});
