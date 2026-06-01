// src/lib/pricing/display/__tests__/saleLineDiscountSourcesDisplay.test.ts
// ============================================================================
// Helper `buildLineDiscountSources` — agrupa los ajustes por línea por
// origen, expone `customerDiscountAmount` y un `calc` (passthrough de
// base + percentage + valueType del motor) para mostrar "Base × % =
// Impacto" sin recalcular.
// ============================================================================

import { describe, it, expect } from "vitest";

import {
  buildLineDiscountSources,
  buildLineDiscountPipeline,
  isEmptyLineGroup,
  type LineLikeForDiscount,
  type LineDiscountSourceItem,
} from "../saleLineDiscountSourcesDisplay";

function lineWith(
  meta: NonNullable<LineLikeForDiscount["pricingMeta"]>,
  quantity = 2,
): LineLikeForDiscount {
  return { quantity, pricingMeta: meta };
}

const byKey = (items: LineDiscountSourceItem[], k: string) =>
  items.find((it) => it.key === k);

// ────────────────────────────────────────────────────────────────────────────

describe("buildLineDiscountSources — línea sin ajustes", () => {
  it("línea vacía → ambos grupos vacíos", () => {
    const g = buildLineDiscountSources(lineWith({}));
    expect(isEmptyLineGroup(g.automatic)).toBe(true);
    expect(isEmptyLineGroup(g.manual)).toBe(true);
  });

  it("qty ≤ 0 → ambos grupos vacíos", () => {
    const g = buildLineDiscountSources(lineWith({ quantityDiscountAmount: 10 }, 0));
    expect(isEmptyLineGroup(g.automatic)).toBe(true);
  });
});

describe("buildLineDiscountSources — automáticos: promo y qty", () => {
  it("PROMO con base+percentage en adjustments: calc PERCENT con baseLine = base × qty", () => {
    const g = buildLineDiscountSources(
      lineWith({
        promotionDiscountAmount: 50,
        appliedPromotionName:    "Verano",
        componentSaleBreakdown: {
          metal: {
            adjustments: [
              { kind: "PROMOTION", source: "GENERAL", amount: 50, base: 500, percentage: 10, valueType: "PERCENTAGE", applyOn: "METAL" },
            ],
          },
        },
      }, 3),
    );
    const promo = byKey(g.automatic.bonifications, "PROMOTION")!;
    expect(promo.amount).toBe(150);
    expect(promo.calc).toEqual({ kind: "PERCENT", baseUnit: 500, qty: 3, percent: 10 });
  });

  it("PROMO sin adjustments (legacy): calc UNAVAILABLE — no inventamos base", () => {
    const g = buildLineDiscountSources(
      lineWith({
        promotionDiscountAmount: 50,
        appliedPromotionName:    "Verano",
      }, 3),
    );
    const promo = byKey(g.automatic.bonifications, "PROMOTION")!;
    expect(promo.amount).toBe(150);
    expect(promo.calc).toEqual({ kind: "UNAVAILABLE" });
  });

  it("QTY DISCOUNT con valueType=FIXED_AMOUNT: calc FIXED (perUnit × qty)", () => {
    const g = buildLineDiscountSources(
      lineWith({
        quantityDiscountAmount: 25,
        componentSaleBreakdown: {
          metal: {
            adjustments: [
              { kind: "QUANTITY_DISCOUNT", source: "GENERAL", amount: 25, base: 200, valueType: "FIXED_AMOUNT", applyOn: "METAL" },
            ],
          },
        },
      }, 4),
    );
    const qty = byKey(g.automatic.bonifications, "QUANTITY_DISCOUNT")!;
    expect(qty.amount).toBe(100);
    expect(qty.calc).toEqual({ kind: "FIXED", perUnit: 25, qty: 4 });
  });
});

describe("buildLineDiscountSources — cliente", () => {
  it("Cliente 15% sobre TOTAL: customerDiscountAmount lleva el monto, calc UNAVAILABLE", () => {
    // applyOn=TOTAL → motor NO emite adjustments por componente. El cálculo
    // queda UNAVAILABLE (no inventamos base). El monto sigue visible.
    const g = buildLineDiscountSources(
      lineWith({
        customerDiscountAmount: 360000,
        inheritedDiscount: {
          ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 15, applyOn: "TOTAL",
        },
        componentSaleBreakdown: { metal: { adjustments: [] }, hechura: { adjustments: [] } },
      }, 2),
    );
    const client = byKey(g.automatic.bonifications, "CUSTOMER_RULE")!;
    expect(client.amount).toBe(360000);
    expect(client.status).toBe("OK");
    expect(client.calc).toEqual({ kind: "UNAVAILABLE" });
  });

  it("Cliente sobre METAL con adjustment poblado: calc PERCENT con base × qty", () => {
    const g = buildLineDiscountSources(
      lineWith({
        customerDiscountAmount: null,
        componentSaleBreakdown: {
          metal: {
            adjustments: [
              { kind: "ENTITY_RULE", source: "CLIENT", amount: 30, base: 300, percentage: 10, valueType: "PERCENTAGE", applyOn: "METAL" },
            ],
          },
        },
        inheritedDiscount: { ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 10, applyOn: "METAL" },
      }, 2),
    );
    const client = byKey(g.automatic.bonifications, "CUSTOMER_RULE")!;
    expect(client.amount).toBe(60);
    expect(client.calc).toEqual({ kind: "PERCENT", baseUnit: 300, qty: 2, percent: 10 });
  });

  it("Cliente rule activa SIN customerDiscountAmount NI adjustments: UNDETAILED y calc null", () => {
    const g = buildLineDiscountSources(
      lineWith({
        customerDiscountAmount: null,
        inheritedDiscount: { ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 15, applyOn: "TOTAL" },
      }, 2),
    );
    const client = byKey(g.automatic.bonifications, "CUSTOMER_RULE")!;
    expect(client.status).toBe("UNDETAILED");
    expect(client.amount).toBeNull();
    expect(client.calc).toBeNull();
  });
});

describe("buildLineDiscountSources — manual", () => {
  it("Manual con MANUAL_DISCOUNT adjustment poblado: calc PERCENT", () => {
    const g = buildLineDiscountSources(
      lineWith({
        manualDiscount: { value: 10, mode: "PERCENT", appliesTo: "TOTAL" },
        componentSaleBreakdown: {
          metal: {
            adjustments: [
              { kind: "MANUAL_DISCOUNT", source: "GENERAL", amount: 50, base: 500, percentage: 10, valueType: "PERCENTAGE", applyOn: "TOTAL" },
            ],
          },
        },
      }, 2),
    );
    const manual = byKey(g.manual.bonifications, "MANUAL")!;
    expect(manual.amount).toBe(100);
    expect(manual.calc).toEqual({ kind: "PERCENT", baseUnit: 500, qty: 2, percent: 10 });
  });

  it("Manual sin adjustments (fallback a quantityDiscountAmount): calc UNAVAILABLE", () => {
    const g = buildLineDiscountSources(
      lineWith({
        priceSource: "MANUAL_OVERRIDE",
        quantityDiscountAmount: 12,
      }, 5),
    );
    const manual = byKey(g.manual.bonifications, "MANUAL")!;
    expect(manual.amount).toBe(60);
    expect(manual.calc).toEqual({ kind: "UNAVAILABLE" });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Semántica unificada "manual reemplaza automático" (Bonificación):
  // cuando hay override manual, el motor sustituye TODOS los descuentos
  // automáticos por el override del operador. Promo y qty-discount ya
  // estaban filtrados (`if (!hasManual)`); el CLIENTE debe seguir la
  // MISMA semántica → no debe aparecer en `automatic.bonifications`.
  // ──────────────────────────────────────────────────────────────────────
  it("Manual ACTIVO + cliente con customerDiscountAmount: CLIENTE NO aparece en automatic (reemplazado por manual)", () => {
    const g = buildLineDiscountSources(
      lineWith({
        // Manual override del operador. `lineHasManualDiscount` devuelve
        // true cuando `manualDiscount != null` → activa el guard B3 que
        // excluye al cliente del bloque automatic.
        manualDiscount: { value: 10, mode: "PERCENT", appliesTo: "TOTAL" },
        // Cliente CONFIGURADO con regla 15% que el motor seguiría exponiendo
        // como `customerDiscountAmount` (caso real: el motor reemplaza
        // automáticos pero deja el campo legacy poblado por compatibilidad).
        customerDiscountAmount: 75,
        inheritedDiscount: {
          ruleType: "DISCOUNT", valueType: "PERCENTAGE",
          value: 15, applyOn: "TOTAL",
        },
      }, 2),
    );
    // Cliente NO debe aparecer en automatic — el manual lo reemplazó.
    // (El render del bloque manual depende de adjustments concretos en
    // componentSaleBreakdown / priceSource MANUAL_OVERRIDE; lo que probamos
    // acá es la semántica del guard, no el render del manual en sí.)
    expect(byKey(g.automatic.bonifications, "CUSTOMER_RULE")).toBeUndefined();
    // Tampoco como surcharge.
    expect(byKey(g.automatic.surcharges, "CUSTOMER_RULE")).toBeUndefined();
  });

  it("Manual ACTIVO + cliente con ENTITY_RULE adjustments: CLIENTE NO aparece en automatic", () => {
    const g = buildLineDiscountSources(
      lineWith({
        manualDiscount: { value: 10, mode: "PERCENT", appliesTo: "TOTAL" },
        componentSaleBreakdown: {
          metal: {
            adjustments: [
              { kind: "ENTITY_RULE", source: "CLIENT", amount: 50, base: 500, percentage: 10, valueType: "PERCENTAGE", applyOn: "METAL" },
            ],
          },
        },
      }, 2),
    );
    // El manual sigue presente; el cliente con adjustments NO debe colarse
    // en automatic.
    expect(byKey(g.automatic.bonifications, "CUSTOMER_RULE")).toBeUndefined();
  });

  it("Manual ACTIVO + cliente como recargo (SURCHARGE) tampoco aparece en automatic", () => {
    const g = buildLineDiscountSources(
      lineWith({
        manualDiscount: { value: 10, mode: "PERCENT", appliesTo: "TOTAL" },
        customerDiscountAmount: 75,
        inheritedDiscount: {
          ruleType: "SURCHARGE", valueType: "PERCENTAGE",
          value: 5, applyOn: "TOTAL",
        },
      }, 2),
    );
    // Ni en bonifications ni en surcharges automáticos.
    expect(byKey(g.automatic.bonifications, "CUSTOMER_RULE")).toBeUndefined();
    expect(byKey(g.automatic.surcharges, "CUSTOMER_RULE")).toBeUndefined();
  });

  it("SIN manual: cliente sí aparece (control — confirma que el guard solo aplica con manual)", () => {
    const g = buildLineDiscountSources(
      lineWith({
        // NO hay manualDiscount.
        customerDiscountAmount: 75,
        inheritedDiscount: {
          ruleType: "DISCOUNT", valueType: "PERCENTAGE",
          value: 15, applyOn: "TOTAL",
        },
      }, 2),
    );
    // Sin manual: el cliente sí debe aparecer en automatic.
    expect(byKey(g.automatic.bonifications, "CUSTOMER_RULE")).toBeDefined();
  });
});

describe("buildLineDiscountSources — fuente PRIMARIA: metadata explicativa del mapper", () => {
  it("PROMO con base+value+valueType del motor (sin desglose metal/hechura): calc PERCENT", () => {
    // Caso real: artículo SIN componentSaleBreakdown. Antes esto daba
    // UNAVAILABLE; ahora con la metadata explicativa, el helper construye
    // el cálculo desde los nuevos campos.
    const g = buildLineDiscountSources(
      lineWith({
        promotionDiscountAmount:    50,
        appliedPromotionName:       "Verano",
        promotionDiscountBase:      3000,
        promotionDiscountValue:     10,
        promotionDiscountValueType: "PERCENTAGE",
        componentSaleBreakdown: null, // sin adjustments
      }, 3),
    );
    const promo = byKey(g.automatic.bonifications, "PROMOTION")!;
    expect(promo.amount).toBe(150);
    // baseLine = 3000 (viene per-línea, NO se multiplica por qty),
    // percent = 10 — exactamente como lo dio el motor.
    // baseUnit = 3000 / qty(3) = 1000, qty = 3. baseFromEngine = 3000 (motor).
    expect(promo.calc).toEqual({
      kind: "PERCENT", baseUnit: 1000, qty: 3, percent: 10, baseFromEngine: 3000,
    });
  });

  it("QTY con base+value FIXED_AMOUNT del motor: calc FIXED", () => {
    const g = buildLineDiscountSources(
      lineWith({
        quantityDiscountAmount:    25,
        quantityDiscountBase:      200,
        quantityDiscountValue:     25,
        quantityDiscountValueType: "FIXED_AMOUNT",
      }, 4),
    );
    const qty = byKey(g.automatic.bonifications, "QUANTITY_DISCOUNT")!;
    expect(qty.amount).toBe(100);
    expect(qty.calc).toEqual({ kind: "FIXED", perUnit: 25, qty: 4 });
  });

  it("CLIENTE applyOn=TOTAL con customerDiscountBase + inheritedDiscount: calc PERCENT", () => {
    // Caso real del bug del usuario: cliente 15% sobre TOTAL. Antes el
    // helper devolvía UNAVAILABLE; ahora muestra el cálculo completo.
    const g = buildLineDiscountSources(
      lineWith({
        customerDiscountAmount: 360000,
        customerDiscountBase:   2400000,
        inheritedDiscount: {
          ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 15, applyOn: "TOTAL",
        },
        componentSaleBreakdown: { metal: { adjustments: [] }, hechura: { adjustments: [] } },
      }, 2),
    );
    const client = byKey(g.automatic.bonifications, "CUSTOMER_RULE")!;
    expect(client.amount).toBe(360000);
    // baseUnit = 2.400.000 / qty(2) = 1.200.000; baseFromEngine = 2.400.000.
    expect(client.calc).toEqual({
      kind: "PERCENT", baseUnit: 1200000, qty: 2, percent: 15, baseFromEngine: 2400000,
    });
  });

  it("PROMO con valueType pero SIN base (caso degradado): calc UNAVAILABLE", () => {
    // No inventamos base. Si el motor solo da el % pero no la base, la UI
    // declara "detalle no disponible" — el monto real sigue visible.
    const g = buildLineDiscountSources(
      lineWith({
        promotionDiscountAmount:    50,
        promotionDiscountValue:     10,
        promotionDiscountValueType: "PERCENTAGE",
        promotionDiscountBase:      null, // <-- falta
      }, 3),
    );
    const promo = byKey(g.automatic.bonifications, "PROMOTION")!;
    expect(promo.calc).toEqual({ kind: "UNAVAILABLE" });
  });

  it("Fuente primaria tiene prioridad sobre adjustments (sin pisar números del motor)", () => {
    // Si ambos están presentes, el helper toma el calc explícito del mapper.
    // Esto garantiza una única fuente lógica de la fórmula y evita
    // inconsistencias entre rutas.
    const g = buildLineDiscountSources(
      lineWith({
        promotionDiscountAmount:    50,
        promotionDiscountBase:      999,   // valor preferido
        promotionDiscountValue:     20,
        promotionDiscountValueType: "PERCENTAGE",
        componentSaleBreakdown: {
          metal: { adjustments: [{ kind: "PROMOTION", source: "GENERAL", amount: 50, base: 100, percentage: 10, valueType: "PERCENTAGE", applyOn: "METAL" }] },
        },
      }, 3),
    );
    const promo = byKey(g.automatic.bonifications, "PROMOTION")!;
    // baseLine viene de la metadata explicativa (999) y NO del adjustment (300).
    // baseUnit = 999 / qty(3) = 333; baseFromEngine = 999 (metadata explícita).
    expect(promo.calc).toEqual({
      kind: "PERCENT", baseUnit: 333, qty: 3, percent: 20, baseFromEngine: 999,
    });
  });
});

describe("buildLineDiscountPipeline — % efectivo total (caso del usuario)", () => {
  it("base × qty 2.254.687,50 + auto agregado 874.818,75 → 38,80% efectivo (caso reportado)", () => {
    // Reproduce el caso del usuario: TOTAL automático 874.818,75 sobre
    // base inicial 2.254.687,50 → % efectivo = 38,80%.
    // Los amounts per-unidad están elegidos para que × qty=5 sumen exacto:
    //   (35.069,75 + 65.000 + 74.894) × 5 = 874_818,75
    const line: LineLikeForDiscount = {
      quantity: 5,
      pricingMeta: {
        pricingSteps: [
          {
            key: "PRICE_LIST", label: "Lista", status: "ok" as const,
            value: 450937.50,   // baseInitial = 450.937,50 × 5 = 2.254.687,50
          },
          {
            key: "QUANTITY_DISCOUNT", label: "QD", status: "ok" as const,
            value: 415867.75,
            meta: {
              discountBase: 450937.50, discountAmount: 35069.75,
              value: 7.78, type: "PERCENTAGE" as const, applyOn: "TOTAL",
            },
          },
          {
            key: "PROMOTION", label: "Promo", status: "ok" as const,
            value: 350867.75,
            meta: {
              discountBase: 415867.75, discountAmount: 65000,
              value: 15.63, type: "PERCENTAGE" as const, applyOn: "TOTAL",
            },
          },
          {
            key: "ENTITY_COMMERCIAL_RULE", label: "Cliente", status: "ok" as const,
            value: 275973.75,
            meta: {
              ruleType: "DISCOUNT" as const, valueType: "PERCENTAGE" as const,
              value: 21.34, applyOn: "TOTAL",
              discountBase: 350867.75, discountAmount: 74894,
            },
          },
        ],
      },
    };
    const p = buildLineDiscountPipeline(line)!;
    expect(p).not.toBeNull();
    expect(p.baseInitial).toBeCloseTo(2254687.50, 2);
    // automaticTotal = (35.069,75 + 65.000 + 74.894) × 5 = 874.818,75 (exacto).
    expect(p.automaticTotal).toBeCloseTo(874818.75, 2);
    // El % efectivo que la UI debe mostrar:
    const effectivePct = (p.automaticTotal / p.baseInitial!) * 100;
    expect(effectivePct).toBeCloseTo(38.80, 1);
    // Garantía: NO es la suma manual de % (10 + 15 + 15 = 40).
    expect(effectivePct).not.toBeCloseTo(40, 1);
    // Tampoco el parcial "29,80%" del bug original.
    expect(effectivePct).not.toBeCloseTo(29.80, 1);
  });

  it("QA del usuario: Promo 10% + Cliente 15% + Cantidad 20% → 38,80% efectivo (NO suma de %)", () => {
    // Caso exacto del usuario:
    //   1 - (0.90 × 0.85 × 0.80) = 1 - 0.612 = 0.388 = 38,80%
    // Reglas que participan: Promo 10%, Cantidad 20%, Cliente 15%.
    // El motor las aplica en cascada (NO suma de %). El % efectivo
    // que la UI debe mostrar en el TPNumber es 38,80% (resultado del
    // pipeline), NO 45% (suma manual 10+15+20).
    const baseUnit = 100;            // simplificado para verificar la matemática
    const qty = 1;
    // Cascada del motor (modeleo de los amounts que vienen en steps):
    const afterQty       = baseUnit * 0.80;             // 80
    const qtyImpact      = baseUnit - afterQty;         // 20
    const afterPromo     = afterQty * 0.90;             // 72
    const promoImpact    = afterQty - afterPromo;       // 8
    const afterClient    = afterPromo * 0.85;           // 61.20
    const clientImpact   = afterPromo - afterClient;    // 10.80
    const line: LineLikeForDiscount = {
      quantity: qty,
      pricingMeta: {
        pricingSteps: [
          { key: "PRICE_LIST", label: "Lista", status: "ok" as const, value: baseUnit },
          {
            key: "QUANTITY_DISCOUNT", label: "QD", status: "ok" as const, value: afterQty,
            meta: { discountBase: baseUnit, discountAmount: qtyImpact, value: 20, type: "PERCENTAGE" as const, applyOn: "TOTAL" },
          },
          {
            key: "PROMOTION", label: "Promo", status: "ok" as const, value: afterPromo,
            meta: { discountBase: afterQty, discountAmount: promoImpact, value: 10, type: "PERCENTAGE" as const, applyOn: "TOTAL" },
          },
          {
            key: "ENTITY_COMMERCIAL_RULE", label: "Cliente", status: "ok" as const, value: afterClient,
            meta: {
              ruleType: "DISCOUNT" as const, valueType: "PERCENTAGE" as const,
              value: 15, applyOn: "TOTAL",
              discountBase: afterPromo, discountAmount: clientImpact,
            },
          },
        ],
      },
    };
    const p = buildLineDiscountPipeline(line)!;
    expect(p.baseInitial).toBe(baseUnit);
    // Total acumulado del pipeline = qtyImpact + promoImpact + clientImpact
    //                              = 20 + 8 + 10.80 = 38.80
    expect(p.automaticTotal).toBeCloseTo(38.80, 2);
    // % efectivo = 38.80 / 100 × 100 = 38.80%
    const effectivePct = (p.automaticTotal / p.baseInitial!) * 100;
    expect(effectivePct).toBeCloseTo(38.80, 2);
    // Anti-regresión: NO es 45 (suma manual 10+15+20).
    expect(effectivePct).not.toBeCloseTo(45, 1);
  });

  it("`baseInitial` × `quantity` siempre representa el total bruto sobre el cual aplicar el % efectivo", () => {
    const line: LineLikeForDiscount = {
      quantity: 3,
      pricingMeta: {
        pricingSteps: [
          { key: "PRICE_LIST", label: "Lista", status: "ok" as const, value: 100 },
          {
            key: "QUANTITY_DISCOUNT", label: "QD", status: "ok" as const, value: 90,
            meta: { discountBase: 100, discountAmount: 10, value: 10, type: "PERCENTAGE" as const, applyOn: "TOTAL" },
          },
        ],
      },
    };
    const p = buildLineDiscountPipeline(line)!;
    // baseInitial × qty: 100 × 3 = 300. automaticTotal: 10 × 3 = 30.
    // pct = 30 / 300 × 100 = 10%.
    expect(p.baseInitial).toBe(300);
    expect(p.automaticTotal).toBe(30);
    expect((p.automaticTotal / p.baseInitial!) * 100).toBeCloseTo(10, 6);
  });
});

describe("buildLineDiscountPipeline — pipeline en orden REAL del motor", () => {
  // Helper para construir steps en el orden exacto que el motor los emite.
  function makeSteps(): NonNullable<LineLikeForDiscount["pricingMeta"]>["pricingSteps"] {
    return [
      {
        key: "PRICE_LIST", label: "Lista de precios: A", status: "ok",
        value: 1500000,  // basePrice per unidad
      },
      {
        key: "QUANTITY_DISCOUNT", label: "Descuento por cantidad", status: "ok",
        value: 1200000,  // precio post-step per unidad
        meta: {
          discountBase: 1500000, discountAmount: 300000,
          value: 20, type: "PERCENTAGE", applyOn: "TOTAL",
        },
      },
      {
        key: "PROMOTION", label: "Promoción: Verano", status: "ok",
        value: 1080000,
        meta: {
          discountBase: 1200000, discountAmount: 120000,
          value: 10, type: "PERCENTAGE", applyOn: "TOTAL",
          promoName: "Verano",
        },
      },
      {
        key: "ENTITY_COMMERCIAL_RULE", label: "Condición comercial", status: "ok",
        value: 162000,
        meta: {
          ruleType: "DISCOUNT", valueType: "PERCENTAGE",
          value: 15, applyOn: "TOTAL",
          discountBase: 1080000, discountAmount: 162000,
        },
      },
    ];
  }

  it("respeta el orden del motor (QTY → PROMO → CLIENTE) — no se ordena por monto", () => {
    const line: LineLikeForDiscount = {
      quantity: 2,
      pricingMeta: {
        inheritedDiscount: { ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 15, applyOn: "TOTAL" },
        pricingSteps: makeSteps(),
      },
    };
    const p = buildLineDiscountPipeline(line)!;
    expect(p).not.toBeNull();
    // El orden debe seguir el array del motor — NO el monto.
    const orderedKeys = p.steps.map((s) => s.key);
    expect(orderedKeys).toEqual([
      "QUANTITY_DISCOUNT",  // 600.000 (mayor)
      "PROMOTION",          // 240.000
      "ENTITY_COMMERCIAL_RULE", // 324.000 (entre los dos anteriores)
    ]);
    // Si ordenara por monto descendente sería QTY → CLIENTE → PROMO; debe ser
    // QTY → PROMO → CLIENTE. Este test FALLA si alguien meté un sort().
  });

  it("Base inicial = PRICE_LIST.value × qty", () => {
    const line: LineLikeForDiscount = {
      quantity: 2,
      pricingMeta: { pricingSteps: makeSteps() },
    };
    const p = buildLineDiscountPipeline(line)!;
    expect(p.baseInitial).toBe(3000000);  // 1.500.000 × 2
    expect(p.quantity).toBe(2);
  });

  it("Subtotal resultante de cada paso = step.value × qty (passthrough del motor)", () => {
    const line: LineLikeForDiscount = {
      quantity: 2,
      pricingMeta: { pricingSteps: makeSteps() },
    };
    const p = buildLineDiscountPipeline(line)!;
    // Paso 1: subtotalAfter = 1.200.000 × 2 = 2.400.000
    expect(p.steps[0].subtotalAfter).toBe(2400000);
    // Paso 2: 1.080.000 × 2 = 2.160.000
    expect(p.steps[1].subtotalAfter).toBe(2160000);
    // Paso 3: el step.value del cliente es el DESCUENTO per-unidad (no el
    // subtotal). Lo que importa es que el helper NO inventa otro subtotal
    // — usa lo que el motor declaró.
    expect(p.steps[2].subtotalAfter).toBe(324000);
  });

  it("baseUsed e impact son passthrough × qty del motor (no recalculados)", () => {
    const line: LineLikeForDiscount = {
      quantity: 2,
      pricingMeta: { pricingSteps: makeSteps() },
    };
    const p = buildLineDiscountPipeline(line)!;
    const qty  = p.steps[0];
    const promo = p.steps[1];
    const client = p.steps[2];
    // QTY
    expect(qty.baseUsed).toBe(3000000);    // 1.500.000 × 2
    expect(qty.impact).toBe(600000);       // 300.000 × 2
    // PROMO (base usada = subtotal del paso anterior)
    expect(promo.baseUsed).toBe(2400000);  // 1.200.000 × 2 = subtotalAfter de QTY
    expect(promo.impact).toBe(240000);     // 120.000 × 2
    // CLIENTE (aplicado sobre subtotal post-promo)
    expect(client.baseUsed).toBe(2160000); // 1.080.000 × 2 = subtotalAfter de PROMO
    expect(client.impact).toBe(324000);    // 162.000 × 2
  });

  it("Cliente aparece DESPUÉS de Promo cuando el motor lo emite así", () => {
    const line: LineLikeForDiscount = {
      quantity: 1,
      pricingMeta: { pricingSteps: makeSteps() },
    };
    const p = buildLineDiscountPipeline(line)!;
    const idxPromo  = p.steps.findIndex((s) => s.key === "PROMOTION");
    const idxClient = p.steps.findIndex((s) => s.key === "ENTITY_COMMERCIAL_RULE");
    expect(idxPromo).toBeGreaterThanOrEqual(0);
    expect(idxClient).toBeGreaterThan(idxPromo);
  });

  it("totales agregados respetan group (automatic vs manual)", () => {
    const line: LineLikeForDiscount = {
      quantity: 2,
      pricingMeta: { pricingSteps: makeSteps() },
    };
    const p = buildLineDiscountPipeline(line)!;
    expect(p.automaticTotal).toBe(600000 + 240000 + 324000);
    expect(p.manualTotal).toBe(0);
  });

  it("Manual override emite step MANUAL_DISCOUNT_OVERRIDE en el group MANUAL", () => {
    const line: LineLikeForDiscount = {
      quantity: 2,
      pricingMeta: {
        pricingSteps: [
          { key: "PRICE_LIST", label: "Lista", status: "ok", value: 1000 },
          {
            key: "MANUAL_DISCOUNT_OVERRIDE", label: "Bonificación manual", status: "ok",
            value: 900,
            meta: {
              kind: "BONUS", mode: "PERCENT", appliesTo: "TOTAL",
              discountBase: 1000, discountAmount: 100, value: 10,
            },
          },
        ],
      },
    };
    const p = buildLineDiscountPipeline(line)!;
    expect(p.steps).toHaveLength(1);
    expect(p.steps[0].group).toBe("MANUAL");
    expect(p.manualTotal).toBe(200);  // 100 × 2
    expect(p.automaticTotal).toBe(0);
  });

  it("Sin pricingSteps (preview legacy): devuelve null — fallback al modo agrupado", () => {
    const line: LineLikeForDiscount = {
      quantity: 2,
      pricingMeta: {
        promotionDiscountAmount: 50,
        appliedPromotionName: "Verano",
        // pricingSteps NO está
      },
    };
    expect(buildLineDiscountPipeline(line)).toBeNull();
  });

  it("Steps skipped o sin meta suficiente: se filtran (no aparecen en el pipeline)", () => {
    const line: LineLikeForDiscount = {
      quantity: 1,
      pricingMeta: {
        pricingSteps: [
          { key: "PRICE_LIST", label: "Lista", status: "ok", value: 1000 },
          // Skipped: promo descartada
          { key: "PROMOTION", label: "Promo", status: "skipped", value: null },
          // OK pero sin discountBase ni discountAmount → no se renderiza
          { key: "QUANTITY_DISCOUNT", label: "QD", status: "ok", value: 900, meta: {} },
        ],
      },
    };
    const p = buildLineDiscountPipeline(line)!;
    expect(p.steps).toHaveLength(0);
    expect(p.baseInitial).toBe(1000);
  });

  it("Recargo del cliente (ruleType=SURCHARGE) aparece con signed='positive'", () => {
    const line: LineLikeForDiscount = {
      quantity: 1,
      pricingMeta: {
        pricingSteps: [
          { key: "PRICE_LIST", label: "Lista", status: "ok", value: 1000 },
          {
            key: "ENTITY_COMMERCIAL_RULE", label: "Condición comercial", status: "ok",
            value: 50,
            meta: {
              ruleType: "SURCHARGE", valueType: "PERCENTAGE",
              value: 5, applyOn: "TOTAL",
              surchargeBase: 1000, surchargeAmount: 50,
            },
          },
        ],
      },
    };
    const p = buildLineDiscountPipeline(line)!;
    expect(p.steps[0].signed).toBe("positive");
    expect(p.steps[0].label).toBe("Recargo cliente");
    expect(p.steps[0].baseUsed).toBe(1000);
    expect(p.steps[0].impact).toBe(50);
  });
});

describe("buildLineDiscountSources — invariantes", () => {
  it("NINGÚN ítem incluye '%' en label primario, incluso con calc PERCENT poblado", () => {
    const g = buildLineDiscountSources(
      lineWith({
        promotionDiscountAmount: 10,
        appliedPromotionName: "Verano",
        componentSaleBreakdown: {
          metal: { adjustments: [{ kind: "PROMOTION", source: "GENERAL", amount: 10, base: 100, percentage: 10, valueType: "PERCENTAGE", applyOn: "METAL" }] },
        },
      }, 2),
    );
    for (const it of g.automatic.bonifications) {
      expect(it.label).not.toMatch(/%/);
    }
  });

  it("Total automático = Σ amounts (sin recálculo)", () => {
    const g = buildLineDiscountSources(
      lineWith({
        promotionDiscountAmount: 10,
        quantityDiscountAmount: 5,
        customerDiscountAmount: 8,
        inheritedDiscount: { ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 4, applyOn: "TOTAL" },
      }, 2),
    );
    expect(g.automatic.bonificationTotal).toBeCloseTo(20 + 10 + 8, 9);
  });
});
