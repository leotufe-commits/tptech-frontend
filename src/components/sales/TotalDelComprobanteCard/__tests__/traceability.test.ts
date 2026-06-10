// src/components/sales/TotalDelComprobanteCard/__tests__/traceability.test.ts
// =============================================================================
// Tests del SSOT de trazabilidad `buildComponentTraces` + agregadores.
// Cubre los 8 conceptos + reconciliación de impuestos por unidad/línea +
// degradación PARTIAL con `missingField`.
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  buildComponentTraces,
  aggregateTaxItemsFromLines,
  aggregatePromotionsFromLines,
} from "../traceability";

describe("buildComponentTraces — CUPÓN", () => {
  it("cupón porcentual → COMPLETE con base, regla PERCENT e impacto negativo", () => {
    const t = buildComponentTraces({
      couponResult: {
        applied: true,
        couponCode: "CUPON",
        couponName: "Cupón 15%",
        discountType: "PERCENTAGE",
        discountValue: 15,
        baseAmount: 673289.41,
        discountAmount: 100993.41,
      },
    });
    expect(t.COUPON).toBeDefined();
    expect(t.COUPON.kind).toBe("COUPON");
    expect(t.COUPON.origin.sourceType).toBe("COUPON");
    expect(t.COUPON.origin.sourceName).toBe("CUPON");
    expect(t.COUPON.base).toBe(673289.41);
    expect(t.COUPON.rule).toEqual({ kind: "PERCENT", value: 15 });
    expect(t.COUPON.impact).toBe(-100993.41);
    expect(t.COUPON.completeness).toBe("COMPLETE");
  });

  it("cupón no aplicado → sin trace", () => {
    const t = buildComponentTraces({
      couponResult: { applied: false, discountAmount: 0 },
    });
    expect(t.COUPON).toBeUndefined();
  });
});

describe("buildComponentTraces — CANAL", () => {
  it("canal → PARTIAL con % efectivo derivado y missingField", () => {
    const t = buildComponentTraces({
      channelResult: { channelName: "Sitio", baseAmount: 626000, channelAmount: 12520 },
    });
    expect(t.CHANNEL).toBeDefined();
    expect(t.CHANNEL.origin.sourceName).toBe("Sitio");
    expect(t.CHANNEL.base).toBe(626000);
    expect(t.CHANNEL.rule?.kind).toBe("PERCENT");
    expect(t.CHANNEL.rule?.value).toBe(2); // 12520 / 626000 * 100
    expect(t.CHANNEL.impact).toBe(12520);
    expect(t.CHANNEL.completeness).toBe("PARTIAL");
    expect(t.CHANNEL.missingField).toMatch(/adjustmentType/);
  });
});

describe("buildComponentTraces — IMPUESTOS", () => {
  it("un solo impuesto → título con alícuota, base imponible, COMPLETE", () => {
    const t = buildComponentTraces({
      taxAmount: 112350,
      taxableBase: 535000,
      lines: [
        { quantity: 1, taxBreakdown: [{ taxId: "iva", name: "IVA", rate: 21, base: 535000, taxAmount: 112350 }] },
      ],
    });
    expect(t.TAX).toBeDefined();
    expect(t.TAX.title).toBe("IVA 21%");
    expect(t.TAX.base).toBe(535000);
    expect(t.TAX.rule).toEqual({ kind: "PERCENT", value: 21 });
    expect(t.TAX.impact).toBe(112350);
    expect(t.TAX.completeness).toBe("COMPLETE");
  });

  it("varios impuestos → items reconciliados COMPLETE", () => {
    const t = buildComponentTraces({
      taxAmount: 30,
      taxableBase: 100,
      lines: [
        {
          quantity: 1,
          taxBreakdown: [
            { taxId: "iva", name: "IVA", rate: 21, base: 100, taxAmount: 21 },
            { taxId: "iibb", name: "Ingresos Brutos", rate: 9, base: 100, taxAmount: 9 },
          ],
        },
      ],
    });
    expect(t.TAX.items).toHaveLength(2);
    expect(t.TAX.impact).toBe(30);
    expect(t.TAX.completeness).toBe("COMPLETE");
    expect(t.TAX.items!.map((i) => i.title)).toContain("IVA 21%");
  });

  it("sin breakdown → alícuota efectiva derivada (legacy), COMPLETE con taxableBase", () => {
    const t = buildComponentTraces({ taxAmount: 21, taxableBase: 100, lines: [] });
    expect(t.TAX.rule?.kind).toBe("PERCENT");
    expect(t.TAX.rule?.value).toBe(21);
    expect(t.TAX.completeness).toBe("COMPLETE");
  });
});

describe("aggregateTaxItemsFromLines — reconciliación por unidad/línea", () => {
  it("elige escala × cantidad cuando reconcilia con el total del documento", () => {
    const { items, reconciled } = aggregateTaxItemsFromLines(
      [{ quantity: 2, taxBreakdown: [{ taxId: "iva", name: "IVA", rate: 21, base: 100, taxAmount: 21 }] }],
      42,
    );
    expect(reconciled).toBe(true);
    expect(items).toHaveLength(1);
    expect(items[0].amount).toBe(42); // 21 × 2
    expect(items[0].base).toBe(200);
  });

  it("elige escala por unidad cuando el total ya viene agregado", () => {
    const { items, reconciled } = aggregateTaxItemsFromLines(
      [{ quantity: 2, taxBreakdown: [{ taxId: "iva", name: "IVA", rate: 21, base: 100, taxAmount: 21 }] }],
      21,
    );
    expect(reconciled).toBe(true);
    expect(items[0].amount).toBe(21);
  });
});

describe("buildComponentTraces — ENVÍO", () => {
  it("sin modo en draft → PARTIAL con missingField", () => {
    const t = buildComponentTraces({ shippingAmount: 12000 });
    expect(t.SHIPPING).toBeDefined();
    expect(t.SHIPPING.impact).toBe(12000);
    expect(t.SHIPPING.completeness).toBe("PARTIAL");
    expect(t.SHIPPING.missingField).toMatch(/shippingResult/);
  });

  it("con modo y valor en draft → COMPLETE con regla", () => {
    const t = buildComponentTraces({
      shippingAmount: 12000,
      shippingDraft: { mode: "FIXED", value: 12000, methodName: "Motomensajería" },
    });
    expect(t.SHIPPING.completeness).toBe("COMPLETE");
    expect(t.SHIPPING.title).toBe("Motomensajería");
    expect(t.SHIPPING.rule?.kind).toBe("FIXED");
  });
});

describe("buildComponentTraces — DESCUENTO/BONIFICACIÓN GLOBAL", () => {
  it("desde draft (manual) → origin MANUAL, base subtotal, COMPLETE", () => {
    const t = buildComponentTraces({
      globalDiscountAmount: 100000,
      subtotalCommercial: 1000000,
      draftDiscountGlobal: { type: "PERCENT", value: 10 },
    });
    expect(t.DISCOUNT_MANUAL).toBeDefined();
    expect(t.DISCOUNT_MANUAL.origin.sourceType).toBe("MANUAL");
    expect(t.DISCOUNT_MANUAL.base).toBe(1000000);
    expect(t.DISCOUNT_MANUAL.rule).toEqual({ kind: "PERCENT", value: 10 });
    expect(t.DISCOUNT_MANUAL.impact).toBe(-100000);
    expect(t.DISCOUNT_MANUAL.completeness).toBe("COMPLETE");
  });

  it("desde regla del cliente → origin CLIENT", () => {
    const t = buildComponentTraces({
      globalDiscountAmount: 50000,
      subtotalCommercial: 500000,
      clientCommercialRules: { ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 10, applyOn: "TOTAL" },
    });
    expect(t.DISCOUNT_MANUAL.origin.sourceType).toBe("CLIENT");
    expect(t.DISCOUNT_MANUAL.rule?.value).toBe(10);
  });
});

describe("buildComponentTraces — PROMOCIONES", () => {
  it("lista cada promoción nombrada con su impacto", () => {
    const t = buildComponentTraces({
      lines: [
        { quantity: 1, appliedPromotionName: "Black Friday", promotionDiscountAmount: 5000 },
        { quantity: 2, appliedPromotionName: "Referido", promotionDiscountAmount: 1000 },
      ],
    });
    expect(t.DISCOUNT_QTY).toBeDefined();
    expect(t.DISCOUNT_QTY.kind).toBe("PROMOTIONS");
    expect(t.DISCOUNT_QTY.items).toHaveLength(2);
    expect(t.DISCOUNT_QTY.impact).toBe(-7000); // 5000 + 1000×2
    expect(t.DISCOUNT_QTY.completeness).toBe("COMPLETE");
  });
});

describe("aggregatePromotionsFromLines", () => {
  it("agrupa por nombre y consolida descuentos por cantidad", () => {
    const items = aggregatePromotionsFromLines([
      { quantity: 1, appliedPromotionName: "Promo A", promotionDiscountAmount: 100 },
      { quantity: 1, appliedPromotionName: "Promo A", promotionDiscountAmount: 50 },
      { quantity: 2, quantityDiscountAmount: 10 },
    ]);
    const byName = Object.fromEntries(items.map((i) => [i.name, i.amount]));
    expect(byName["Promo A"]).toBe(150);
    expect(byName["Descuento por cantidad"]).toBe(20);
  });
});

describe("buildComponentTraces — REDONDEO FINANCIERO", () => {
  it("UNIFIED → pre/post + impacto, COMPLETE", () => {
    const t = buildComponentTraces({
      documentRounding: {
        scope: "UNIFIED",
        totalAdjustment: 32.11,
        unified: { mode: "HUNDRED", direction: "NEAREST", preRounding: 1234567.89, postRounding: 1234600 },
      },
    });
    expect(t.ROUNDING_MONETARY).toBeDefined();
    expect(t.ROUNDING_MONETARY.preValue).toBe(1234567.89);
    expect(t.ROUNDING_MONETARY.postValue).toBe(1234600);
    expect(t.ROUNDING_MONETARY.impact).toBe(32.11);
    expect(t.ROUNDING_MONETARY.rule?.label).toMatch(/HUNDRED/);
    expect(t.ROUNDING_MONETARY.completeness).toBe("COMPLETE");
  });
});

describe("buildComponentTraces — AJUSTE MANUAL", () => {
  it("UNIFIED → pre/post + impacto, origin MANUAL, COMPLETE", () => {
    const t = buildComponentTraces({
      manualAdjustment: {
        scope: "UNIFIED",
        unified: { preAmount: 1234600, postAmount: 1235000, amount: 400 },
        totals: { totalMonetaryAdjustment: 400 },
        audit: { reason: "Ajuste de cierre" },
      },
    });
    expect(t.MANUAL_ADJUSTMENT).toBeDefined();
    expect(t.MANUAL_ADJUSTMENT.preValue).toBe(1234600);
    expect(t.MANUAL_ADJUSTMENT.postValue).toBe(1235000);
    expect(t.MANUAL_ADJUSTMENT.impact).toBe(400);
    expect(t.MANUAL_ADJUSTMENT.origin.sourceName).toBe("Ajuste de cierre");
    expect(t.MANUAL_ADJUSTMENT.completeness).toBe("COMPLETE");
  });
});

describe("buildComponentTraces — vacío", () => {
  it("sin datos → mapa vacío", () => {
    expect(buildComponentTraces({})).toEqual({});
  });
});
