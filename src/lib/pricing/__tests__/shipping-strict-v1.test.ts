// src/lib/pricing/__tests__/shipping-strict-v1.test.ts
// =============================================================================
// FASE 1.2 paso 4 — verifica el comportamiento de toSalesPreviewArgs respecto
// al envío detrás del feature flag tptech_pricing_strict_v1.
//
// Política:
//   · Flag OFF (default): legacy idéntico — frontend resuelve el monto vía
//     resolveLegacyShippingAmount y manda `shippingAmount: number`.
//   · Flag ON: pasa `shipping: { mode, value, weight }` crudo al backend.
//     NO se manda shippingAmount. El backend resuelve via
//     resolveShippingAmount (POLICY.md §5 capa 10).
//
// Cubre Factura Ventas (la única pantalla que usa toSalesPreviewArgs;
// el simulador llama directo a articlesApi.getPricingPreview con
// shippingMode/Value/Weight separados — no pasa por este helper).
// =============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { toSalesPreviewArgs } from "../buildPricingPreviewPayload";
import {
  setFeatureFlag,
  resetAllFeatureFlags,
  FEATURE_FLAGS,
} from "../../featureFlags";

beforeEach(() => { resetAllFeatureFlags(); });
afterEach(()  => { resetAllFeatureFlags(); });

function makePayload(overrides: any = {}) {
  return {
    lines: [
      { articleId: "art-1", quantity: 1 },
    ],
    clientId:        null,
    paymentMethodId: null,
    channelId:       null,
    couponCode:      null,
    shipping:        null,
    globalDiscount:  null,
    priceListId:     null,
    currencyId:      null,
    ...overrides,
  };
}

// =============================================================================
// 1. Flag OFF — comportamiento legacy
// =============================================================================

describe("toSalesPreviewArgs shipping — flag OFF (legacy resolveLegacyShippingAmount)", () => {
  it("baseline correct: shipping null → shippingAmount=null, NO shipping field", () => {
    const args = toSalesPreviewArgs(makePayload({ shipping: null }) as any);
    expect(args.shippingAmount).toBeNull();
    expect((args as any).shipping).toBeUndefined();
  });

  it("baseline correct: FIXED 500 → shippingAmount=500 (resuelto en frontend)", () => {
    const args = toSalesPreviewArgs(
      makePayload({ shipping: { mode: "FIXED", value: 500, weight: null } }) as any,
    );
    expect(args.shippingAmount).toBe(500);
    expect((args as any).shipping).toBeUndefined();
  });

  it("baseline correct: BY_WEIGHT 100/kg × 2kg → shippingAmount=200", () => {
    // resolveLegacyShippingAmount emite console.warn — silenciar.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const args = toSalesPreviewArgs(
      makePayload({ shipping: { mode: "BY_WEIGHT", value: 100, weight: 2 } }) as any,
    );
    expect(args.shippingAmount).toBe(200);
    warnSpy.mockRestore();
  });

  it("baseline correct: FREE → shippingAmount=0", () => {
    const args = toSalesPreviewArgs(
      makePayload({ shipping: { mode: "FREE", value: null, weight: null } }) as any,
    );
    expect(args.shippingAmount).toBe(0);
  });
});

// =============================================================================
// 2. Flag ON — passthrough crudo del input shipping
// =============================================================================

describe("toSalesPreviewArgs shipping — flag ON (strict v1 — passthrough crudo)", () => {
  beforeEach(() => {
    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, true);
  });

  it("baseline correct: shipping null → shipping=null, NO shippingAmount", () => {
    const args = toSalesPreviewArgs(makePayload({ shipping: null }) as any);
    expect(args.shipping).toBeNull();
    expect(args.shippingAmount).toBeUndefined();
  });

  it("baseline correct: FIXED 500 → shipping={mode,value} crudo, sin resolver", () => {
    const args = toSalesPreviewArgs(
      makePayload({ shipping: { mode: "FIXED", value: 500, weight: null } }) as any,
    );
    // El backend resolverá el monto. El frontend NO lo calcula.
    expect(args.shipping).toEqual({ mode: "FIXED", value: 500, weight: null });
    expect(args.shippingAmount).toBeUndefined();
  });

  it("baseline correct: BY_WEIGHT 100/kg × 2kg → passthrough sin multiplicar", () => {
    // CRÍTICO: NO debe haber multiplicación local. El backend hace 100 × 2.
    const args = toSalesPreviewArgs(
      makePayload({ shipping: { mode: "BY_WEIGHT", value: 100, weight: 2 } }) as any,
    );
    expect(args.shipping).toEqual({ mode: "BY_WEIGHT", value: 100, weight: 2 });
    expect(args.shippingAmount).toBeUndefined();
  });

  it("baseline correct: FREE → shipping={mode:FREE} crudo", () => {
    const args = toSalesPreviewArgs(
      makePayload({ shipping: { mode: "FREE", value: null, weight: null } }) as any,
    );
    expect(args.shipping).toEqual({ mode: "FREE", value: null, weight: null });
    expect(args.shippingAmount).toBeUndefined();
  });

  it("baseline correct: NO emite console.warn de legacy bajo flag ON", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    toSalesPreviewArgs(
      makePayload({ shipping: { mode: "BY_WEIGHT", value: 100, weight: 2 } }) as any,
    );
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("baseline correct: NO redondea, NO convierte moneda, NO transforma mode", () => {
    // Valores con drift potencial; bajo ON deben llegar EXACTOS al backend.
    const args = toSalesPreviewArgs(
      makePayload({ shipping: { mode: "BY_WEIGHT", value: 100.333, weight: 2.5 } }) as any,
    );
    // Bajo ON: sin Math.round, sin r2, sin transformar a FIXED.
    expect(args.shipping?.value).toBe(100.333);
    expect(args.shipping?.weight).toBe(2.5);
    expect(args.shipping?.mode).toBe("BY_WEIGHT");
  });
});

// =============================================================================
// 3. Equivalencia funcional OFF / ON cuando backend está al día
// =============================================================================

describe("toSalesPreviewArgs shipping — paridad OFF/ON con backend coherente", () => {
  it("baseline correct: con shipping null, ambos flags producen el mismo efecto neto (sin envío)", () => {
    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, false);
    const off = toSalesPreviewArgs(makePayload({ shipping: null }) as any);
    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, true);
    const on  = toSalesPreviewArgs(makePayload({ shipping: null }) as any);

    // OFF: shippingAmount: null, sin field shipping.
    // ON:  shipping: null, sin field shippingAmount.
    // Para el backend ambos significan "sin envío".
    expect(off.shippingAmount).toBeNull();
    expect(on.shipping).toBeNull();
  });
});

// =============================================================================
// 4. Visual proxy — los 5 casos del playbook que aplican a shipping
// =============================================================================

describe("F1.2 paso 4 — proxy visual de los casos del playbook", () => {
  function runBoth(shipping: any) {
    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, false);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const off = toSalesPreviewArgs(makePayload({ shipping }) as any);
    warnSpy.mockRestore();
    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, true);
    const on = toSalesPreviewArgs(makePayload({ shipping }) as any);
    return { off, on };
  }

  it("Caso shipping simple — FIXED 500 (sin moneda extranjera)", () => {
    const { off, on } = runBoth({ mode: "FIXED", value: 500, weight: null });
    // OFF: shippingAmount=500 (resuelto local); ON: shipping crudo.
    expect(off.shippingAmount).toBe(500);
    expect(on.shipping).toEqual({ mode: "FIXED", value: 500, weight: null });
  });

  it("Caso BY_WEIGHT — 100/kg × 2kg (legacy resuelve a 200)", () => {
    const { off, on } = runBoth({ mode: "BY_WEIGHT", value: 100, weight: 2 });
    expect(off.shippingAmount).toBe(200);
    expect(on.shipping).toEqual({ mode: "BY_WEIGHT", value: 100, weight: 2 });
  });

  it("Caso FIXED amount con value=0 (envío gratis explícito como FIXED)", () => {
    const { off, on } = runBoth({ mode: "FIXED", value: 0, weight: null });
    expect(off.shippingAmount).toBe(0);
    expect(on.shipping).toEqual({ mode: "FIXED", value: 0, weight: null });
  });

  it("Caso moneda extranjera — el frontend NO convierte; backend usa currencyId", () => {
    // bajo flag ON, el value viaja crudo (en la moneda del documento, lo que
    // sea); el backend interpreta segun currencyId del request. Frontend
    // no toca ni convierte.
    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, true);
    const args = toSalesPreviewArgs(
      makePayload({
        shipping:   { mode: "FIXED", value: 50, weight: null },
        currencyId: "usd-id",
      }) as any,
    );
    // value=50 viaja crudo (ej: 50 USD); backend convierte si hace falta.
    expect(args.shipping).toEqual({ mode: "FIXED", value: 50, weight: null });
    expect(args.currencyId).toBe("usd-id");
  });

  it("Caso shipping + promo — cada concepto viaja independiente", () => {
    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, true);
    const args = toSalesPreviewArgs(
      makePayload({
        shipping:       { mode: "BY_WEIGHT", value: 100, weight: 1.5 },
        couponCode:     "PROMO20",
        globalDiscount: { type: "PERCENT", value: 20 },
      }) as any,
    );
    expect(args.shipping?.weight).toBe(1.5);
    expect(args.couponCode).toBe("PROMO20");
    expect(args.globalDiscount).toEqual({ type: "PERCENT", value: 20 });
  });
});
