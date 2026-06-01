// src/lib/pricing/display/__tests__/saleDiscountSourcesDisplay.test.ts
// ============================================================================
// Helper display-only `buildSaleDiscountGroups` — agrupa los ajustes del
// documento por ORIGEN COMERCIAL (Automáticos vs Manuales) y SIGNO
// (Bonificaciones vs Recargos).
//
// REGLAS QUE COMPROBAMOS (display, NO cálculo):
//   · El helper NUNCA expone un `percent` en el ítem. Cualquier % aparece
//     SOLO en la `subline` y SOLO cuando viene explícito del motor con
//     base inequívoca (cliente, cupón).
//   · Los `total` son Σ |amount_i| dentro de cada sub-grupo — no recálculo.
//   · El helper no inventa filas: solo aparece un ítem cuando el campo
//     correspondiente en `composition` es != null y supera el umbral
//     (EPSILON = 0,005).
//   · Snapshots legacy sin `customerDiscountPercent` ni `couponPercent`
//     siguen produciendo grupos válidos — solo el % desaparece.
// ============================================================================

import { describe, it, expect } from "vitest";

import {
  buildSaleDiscountGroups,
  isEmptyGroup,
  type DiscountSourceItem,
} from "../saleDiscountSourcesDisplay";
import type { PricingComposition } from "../../../pricing-display-helpers";

// ─── Fixture base — composition neutra ──────────────────────────────────────

function emptyComposition(): PricingComposition {
  return {
    subtotalGross:           1000,
    priceListName:           null,
    priceListNamesUnique:    [],
    customerDiscount:        null,
    customerDiscountApplyOn: null,
    customerDiscountPercent: null,
    channelAdjustment:       null,
    channelName:             null,
    quantityDiscount:        null,
    manualDiscount:          null,
    promotion:               null,
    promotionName:           null,
    coupon:                  null,
    couponName:              null,
    couponCode:              null,
    couponPercent:           null,
    globalDiscount:          null,
    subtotalNet:             1000,
    shipping:                null,
    paymentAdjustment:       null,
    taxes:                   [],
    taxTotal:                0,
    rounding:                0,
    roundingInfo:            null,
    total:                   1000,
    fromBackend:             true,
  };
}

const byKey = (items: DiscountSourceItem[], k: string) =>
  items.find((it) => it.key === k);

// ────────────────────────────────────────────────────────────────────────────

describe("buildSaleDiscountGroups — composition vacía", () => {
  it("ambos grupos quedan vacíos, totales en 0", () => {
    const g = buildSaleDiscountGroups(emptyComposition());
    expect(isEmptyGroup(g.automatic)).toBe(true);
    expect(isEmptyGroup(g.manual)).toBe(true);
    expect(g.automatic.bonificationTotal).toBe(0);
    expect(g.automatic.surchargeTotal).toBe(0);
    expect(g.manual.bonificationTotal).toBe(0);
    expect(g.manual.surchargeTotal).toBe(0);
  });
});

describe("buildSaleDiscountGroups — etiquetas SIN % en label primario", () => {
  it("ningún ítem incluye '%' en su label, incluso cuando el motor expone % en subline", () => {
    const c = emptyComposition();
    c.promotion        = 1200; c.promotionName = "Verano";
    c.quantityDiscount = 600;
    c.customerDiscount        = 360;
    c.customerDiscountPercent = 3;
    c.customerDiscountApplyOn = "METAL";
    c.coupon         = 100;
    c.couponName     = "BIENVENIDA";
    c.couponCode     = "WELCOME10";
    c.couponPercent  = 10;
    c.manualDiscount = 240;
    c.globalDiscount = 150;
    c.channelAdjustment = 50; c.channelName = "Mostrador";

    const g = buildSaleDiscountGroups(c);
    const allItems = [
      ...g.automatic.bonifications, ...g.automatic.surcharges,
      ...g.manual.bonifications,    ...g.manual.surcharges,
    ];

    for (const it of allItems) {
      // El label primario NO debe contener "%". Ese contrato es lo que
      // garantiza no inducir interpretaciones erróneas de % efectivo.
      expect(it.label).not.toMatch(/%/);
    }
  });
});

describe("buildSaleDiscountGroups — % SOLO en subline, con contexto inequívoco", () => {
  it("CUSTOMER_RULE: % de la rule + 'sobre <componente>' en subline", () => {
    const c = emptyComposition();
    c.customerDiscount        = 360;
    c.customerDiscountPercent = 3;
    c.customerDiscountApplyOn = "METAL";

    const g = buildSaleDiscountGroups(c);
    const client = byKey(g.automatic.bonifications, "CUSTOMER_RULE")!;
    expect(client.label).toBe("Cliente");
    expect(client.subline).toBe("rule del cliente: 3% sobre Metal");
  });

  it("CUSTOMER_RULE sin %: subline solo describe 'aplica sobre'", () => {
    const c = emptyComposition();
    c.customerDiscount        = 360;
    c.customerDiscountPercent = null;       // motor no expone % (rule por monto)
    c.customerDiscountApplyOn = "TOTAL";

    const g = buildSaleDiscountGroups(c);
    const client = byKey(g.automatic.bonifications, "CUSTOMER_RULE")!;
    expect(client.subline).toBe(
      "rule del cliente — aplica sobre: Precio ajustado (lista + canal + promociones)",
    );
  });

  it("COUPON porcentual: subline incluye 'rule del cupón: N% del subtotal'", () => {
    const c = emptyComposition();
    c.coupon        = 100;
    c.couponName    = "BIENVENIDA";
    c.couponCode    = "WELCOME10";
    c.couponPercent = 10;

    const g = buildSaleDiscountGroups(c);
    const coupon = byKey(g.automatic.bonifications, "COUPON")!;
    expect(coupon.label).toBe("Cupón de venta");
    expect(coupon.subline).toBe("BIENVENIDA · WELCOME10 — rule del cupón: 10% del subtotal");
  });

  it("COUPON con monto fijo: subline NO incluye %", () => {
    const c = emptyComposition();
    c.coupon       = 500;
    c.couponName   = "FIJO50";
    c.couponPercent = null;                   // motor lo configuró como monto fijo

    const g = buildSaleDiscountGroups(c);
    const coupon = byKey(g.automatic.bonifications, "COUPON")!;
    expect(coupon.subline).toBe("FIJO50");
    expect(coupon.subline).not.toMatch(/%/);
  });

  it("PROMOTION / QUANTITY_DISCOUNT / MANUAL / GLOBAL / CHANNEL: subline NUNCA contiene '%'", () => {
    const c = emptyComposition();
    c.promotion        = 100; c.promotionName = "Verano";
    c.quantityDiscount = 50;
    c.manualDiscount   = 25;
    c.globalDiscount   = 10;
    c.channelAdjustment = 8; c.channelName = "Mostrador";

    const g = buildSaleDiscountGroups(c);
    const items = [
      byKey(g.automatic.bonifications, "PROMOTION"),
      byKey(g.automatic.bonifications, "QUANTITY_DISCOUNT"),
      byKey(g.automatic.surcharges,    "CHANNEL"),
      byKey(g.manual.bonifications,    "MANUAL"),
      byKey(g.manual.bonifications,    "GLOBAL_DISCOUNT"),
    ].filter((x): x is DiscountSourceItem => x != null);

    for (const it of items) {
      if (it.subline != null) expect(it.subline).not.toMatch(/%/);
    }
  });
});

describe("buildSaleDiscountGroups — agrupación automático vs manual", () => {
  it("PROMOTION / QUANTITY_DISCOUNT / CUSTOMER_RULE / COUPON / CHANNEL → bloque AUTOMÁTICO", () => {
    const c = emptyComposition();
    c.promotion        = 100; c.promotionName = "Verano";
    c.quantityDiscount = 50;
    c.customerDiscount = 30; c.customerDiscountApplyOn = "TOTAL";
    c.coupon            = 10;
    c.channelAdjustment = 5; c.channelName = "Mostrador";

    const g = buildSaleDiscountGroups(c);
    const autoKeys = [
      ...g.automatic.bonifications.map((it) => it.key),
      ...g.automatic.surcharges.map((it) => it.key),
    ].sort();
    expect(autoKeys).toEqual(["CHANNEL", "COUPON", "CUSTOMER_RULE", "PROMOTION", "QUANTITY_DISCOUNT"]);
    expect(isEmptyGroup(g.manual)).toBe(true);
  });

  it("MANUAL + GLOBAL_DISCOUNT → bloque MANUAL", () => {
    const c = emptyComposition();
    c.manualDiscount  = 240;
    c.globalDiscount  = 150;

    const g = buildSaleDiscountGroups(c);
    const manualKeys = g.manual.bonifications.map((it) => it.key).sort();
    expect(manualKeys).toEqual(["GLOBAL_DISCOUNT", "MANUAL"]);
    expect(isEmptyGroup(g.automatic)).toBe(true);
  });

  it("CHANNEL positivo va a surcharges, negativo a bonifications — siempre dentro de AUTOMÁTICO", () => {
    const c1 = emptyComposition();
    c1.channelAdjustment = 600; c1.channelName = "Mostrador";
    const g1 = buildSaleDiscountGroups(c1);
    expect(g1.automatic.bonifications).toHaveLength(0);
    expect(g1.automatic.surcharges).toHaveLength(1);
    expect(g1.automatic.surchargeTotal).toBe(600);

    const c2 = emptyComposition();
    c2.channelAdjustment = -200; c2.channelName = "E-commerce";
    const g2 = buildSaleDiscountGroups(c2);
    expect(g2.automatic.bonifications).toHaveLength(1);
    expect(g2.automatic.surcharges).toHaveLength(0);
    expect(g2.automatic.bonificationTotal).toBe(200);
  });
});

describe("buildSaleDiscountGroups — totales = Σ amounts (agregación, no recálculo)", () => {
  it("AUTOMÁTICO: Σ amounts coincide con bonificationTotal/surchargeTotal", () => {
    const c = emptyComposition();
    c.promotion        = 1200;
    c.quantityDiscount = 600;
    c.customerDiscount = 360; c.customerDiscountApplyOn = "TOTAL";
    c.channelAdjustment = 300; c.channelName = "Mostrador";

    const g = buildSaleDiscountGroups(c);
    const sumB = g.automatic.bonifications.reduce((s, it) => s + it.amount, 0);
    const sumS = g.automatic.surcharges.reduce((s, it) => s + it.amount, 0);
    expect(g.automatic.bonificationTotal).toBeCloseTo(sumB, 9);
    expect(g.automatic.surchargeTotal)   .toBeCloseTo(sumS, 9);
    expect(g.automatic.bonificationTotal).toBeCloseTo(1200 + 600 + 360, 9);
    expect(g.automatic.surchargeTotal)   .toBeCloseTo(300, 9);
  });

  it("MANUAL: bonificación manual + descuento global suman correctamente", () => {
    const c = emptyComposition();
    c.manualDiscount = 240;
    c.globalDiscount = 150;

    const g = buildSaleDiscountGroups(c);
    expect(g.manual.bonificationTotal).toBeCloseTo(240 + 150, 9);
  });
});

describe("buildSaleDiscountGroups — robustez y rehidratación", () => {
  it("Montos sub-epsilon (< 0,005) no crean ítem", () => {
    const c = emptyComposition();
    c.promotion        = 0.004;
    c.quantityDiscount = 0.002;
    c.customerDiscount = 0.001;

    const g = buildSaleDiscountGroups(c);
    expect(isEmptyGroup(g.automatic)).toBe(true);
  });

  it("Rehidratación de snapshot legacy: sin customerDiscountPercent ni couponPercent, los ítems aparecen sin % en subline", () => {
    const c = emptyComposition();
    c.customerDiscount        = 50;
    c.customerDiscountPercent = null;
    c.customerDiscountApplyOn = null;          // legacy v1 sin metadata
    c.coupon         = 25;
    c.couponName     = "LEGACY";
    c.couponPercent  = null;

    const g = buildSaleDiscountGroups(c);
    const client = byKey(g.automatic.bonifications, "CUSTOMER_RULE")!;
    const coupon = byKey(g.automatic.bonifications, "COUPON")!;
    expect(client.subline).toBeNull();         // sin % ni applyOn → null limpio
    expect(coupon.subline).toBe("LEGACY");     // solo el nombre, sin %
    // Amounts siguen siendo los del motor — la rehidratación no afecta totales.
    expect(g.automatic.bonificationTotal).toBeCloseTo(75, 9);
  });
});
