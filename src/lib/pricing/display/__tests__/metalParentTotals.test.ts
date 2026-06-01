// src/lib/pricing/display/__tests__/metalParentTotals.test.ts
// ============================================================================
// Consolidado por metal padre (header grupo METALES en Factura) — DEBE
// coincidir EXACTAMENTE con el Simulador (cards "Oro (Au): 8,01 gr").
//
// Fórmula canónica única: metalEquivFactor. Paridad verificada contra
// buildMetalPadreMap (el agregado real que usa el Simulador).
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  metalEquivFactor,
  buildMetalParentTotals,
  buildMetalParentSaleTotals,
  buildMetalParentSaleLines,
  buildMetalParentLineWeights,
  computeMetalSaleFactor,
} from "../saleCompositionDisplay";
import { buildMetalPadreMap } from "../../../../components/pricing/CostCompositionBlock/helpers";
import type { PricingStepResult } from "../../../../services/articles";

describe("metalEquivFactor — fórmula canónica única", () => {
  it("con pureza y sin merma → factor = pureza", () => {
    expect(metalEquivFactor(0.75, 0)).toBeCloseTo(0.75, 9);
  });
  it("con pureza y merma → pureza × (1 + merma/100)", () => {
    expect(metalEquivFactor(0.75, 3)).toBeCloseTo(0.75 * 1.03, 9);
  });
  it("sin pureza → 1 + merma/100 (equiv = gramos brutos ajustados)", () => {
    expect(metalEquivFactor(null, 0)).toBe(1);
    expect(metalEquivFactor(null, 5)).toBeCloseTo(1.05, 9);
  });
});

describe("buildMetalParentTotals", () => {
  it("suma varias variantes del MISMO metal padre bajo un label", () => {
    const r = buildMetalParentTotals([
      { metalName: "Oro", purity: 0.75,  appliedGrams: 1.2, appliedMermaPct: 0 },
      { metalName: "Oro", purity: 0.916, appliedGrams: 2.0, appliedMermaPct: 0 },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe("Oro");
    expect(r[0].totalEquivGr).toBeCloseTo(1.2 * 0.75 + 2.0 * 0.916, 6);
    expect(r[0].totalPureGrams).toBeCloseTo(1.2 * 0.75 + 2.0 * 0.916, 6);
  });

  it("múltiples metales padre → una entrada por padre, ordenadas por nombre", () => {
    const r = buildMetalParentTotals([
      { metalName: "Plata", purity: 0.925, appliedGrams: 10, appliedMermaPct: 0 },
      { metalName: "Oro",   purity: 0.75,  appliedGrams: 2,  appliedMermaPct: 0 },
    ]);
    expect(r.map((x) => x.name)).toEqual(["Oro", "Plata"]);
    expect(r[0].totalEquivGr).toBeCloseTo(1.5, 6);   // 2 × 0,75
    expect(r[1].totalEquivGr).toBeCloseTo(9.25, 6);  // 10 × 0,925
  });

  it("aplica MERMA al equivalente (pureza × merma); pureGrams NO incluye merma", () => {
    const r = buildMetalParentTotals([
      { metalName: "Oro", purity: 0.75, appliedGrams: 1.2, appliedMermaPct: 3 },
    ]);
    expect(r[0].totalEquivGr).toBeCloseTo(1.2 * 0.75 * 1.03, 6); // ≈ 0,927
    expect(r[0].totalPureGrams).toBeCloseTo(1.2 * 0.75, 6);      // 0,90 (sin merma)
  });

  it("sin pureza → equiv = gramos × (1 + merma/100); pure = 0", () => {
    const r = buildMetalParentTotals([
      { metalName: "Oro", purity: null, appliedGrams: 4, appliedMermaPct: 5 },
    ]);
    expect(r[0].totalEquivGr).toBeCloseTo(4 * 1.05, 6);
    expect(r[0].totalPureGrams).toBe(0);
  });

  it("ignora items sin nombre o sin gramos (no rompe)", () => {
    const r = buildMetalParentTotals([
      { metalName: "", purity: 0.75, appliedGrams: 1, appliedMermaPct: 0 },
      { metalName: "Oro", purity: 0.75, appliedGrams: null, appliedMermaPct: 0 },
      null,
    ]);
    expect(r).toHaveLength(0);
  });
});

// ── PARIDAD Simulador ↔ Factura ────────────────────────────────────────────
function metalStep(meta: Record<string, unknown>): PricingStepResult {
  return { key: "COST_LINES_METAL", label: "Metal", status: "ok", value: "1", meta } as unknown as PricingStepResult;
}

describe("PARIDAD — buildMetalParentTotals (Factura) === buildMetalPadreMap (Simulador)", () => {
  it("mismo totalEquivGr por metal padre, con pureza + merma + multi-variante", () => {
    // Mismo dato expresado en los 2 shapes del sistema:
    //   · steps[] (Simulador) → buildMetalPadreMap
    //   · composition.metals[] (Factura) → buildMetalParentTotals
    const cases = [
      { metalName: "Oro",   variantName: "Oro 18k",       purity: 0.75,  grams: 1.2, merma: 3 },
      { metalName: "Oro",   variantName: "Chafalonia 18k", purity: 0.70, grams: 1.1, merma: 0 },
      { metalName: "Oro",   variantName: "Oro 24k",       purity: 1.0,   grams: 0.5, merma: 2 },
      { metalName: "Plata", variantName: "Plata 925",      purity: 0.925, grams: 3.0, merma: 1 },
    ];

    const steps = cases.map((c, i) =>
      metalStep({
        metalId: c.metalName, metalName: c.metalName, variantName: c.variantName,
        qty: c.grams, purity: c.purity, merma: c.merma, quotePrice: 100,
      }),
    );
    const sim = buildMetalPadreMap(steps); // Map<groupKey, MetalPadreAccum>
    const simByName = new Map<string, number>();
    for (const acc of sim.values()) {
      simByName.set(acc.parentName, (simByName.get(acc.parentName) ?? 0) + acc.totalEquivGr);
    }

    const fac = buildMetalParentTotals(
      cases.map((c) => ({
        metalName: c.metalName, purity: c.purity,
        appliedGrams: c.grams, appliedMermaPct: c.merma,
      })),
    );

    expect(fac.map((f) => f.name).sort()).toEqual(["Oro", "Plata"]);
    for (const f of fac) {
      expect(f.totalEquivGr).toBeCloseTo(simByName.get(f.name)!, 9);
    }
  });
});

describe("buildMetalParentLineWeights — pesos por línea (gr c/u · gr total · puro)", () => {
  const ORO = { metalName: "Oro", purity: 0.75, appliedGrams: 0.91, appliedMermaPct: 0 };

  it("cantidad = 1: gr c/u == gr total, puro = grams × purity", () => {
    const r = buildMetalParentLineWeights([ORO], 1);
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe("Oro");
    expect(r[0].gramsPerUnit).toBeCloseTo(0.91, 6);
    expect(r[0].gramsTotal).toBeCloseTo(0.91, 6);
    expect(r[0].pureGramsTotal).toBeCloseTo(0.6825, 6); // 0,91 × 0,75
    expect(r[0].hasPure).toBe(true);
  });

  it("cantidad = 3: gr c/u 0,91 · gr total 2,73 · puro 2,0475", () => {
    const r = buildMetalParentLineWeights([ORO], 3);
    expect(r[0].gramsPerUnit).toBeCloseTo(0.91, 6);
    expect(r[0].gramsTotal).toBeCloseTo(2.73, 6);       // 0,91 × 3
    expect(r[0].pureGramsTotal).toBeCloseTo(2.0475, 6); // 0,91 × 0,75 × 3
  });

  it("múltiples variantes del mismo padre suman; escala por cantidad", () => {
    const r = buildMetalParentLineWeights(
      [
        { metalName: "Oro", purity: 0.75,  appliedGrams: 1.2, appliedMermaPct: 0 },
        { metalName: "Oro", purity: 0.916, appliedGrams: 2.0, appliedMermaPct: 0 },
      ],
      2,
    );
    expect(r).toHaveLength(1);
    expect(r[0].gramsPerUnit).toBeCloseTo(3.2, 6);            // 1,2 + 2,0
    expect(r[0].gramsTotal).toBeCloseTo(6.4, 6);              // ×2
    expect(r[0].pureGramsTotal).toBeCloseTo((1.2 * 0.75 + 2.0 * 0.916) * 2, 6);
  });

  it("múltiples metales padre → una entrada por padre", () => {
    const r = buildMetalParentLineWeights(
      [
        { metalName: "Plata", purity: 0.925, appliedGrams: 10, appliedMermaPct: 0 },
        { metalName: "Oro",   purity: 0.75,  appliedGrams: 2,  appliedMermaPct: 0 },
      ],
      1,
    );
    expect(r.map((x) => x.name)).toEqual(["Oro", "Plata"]);
  });

  it("sin pureza → hasPure=false y pureGramsTotal=0 (no inventa)", () => {
    const r = buildMetalParentLineWeights(
      [{ metalName: "Oro", purity: null, appliedGrams: 4, appliedMermaPct: 0 }],
      3,
    );
    expect(r[0].gramsTotal).toBeCloseTo(12, 6);
    expect(r[0].pureGramsTotal).toBe(0);
    expect(r[0].hasPure).toBe(false);
  });

  it("sin gramos → el item se ignora (no rompe)", () => {
    const r = buildMetalParentLineWeights(
      [{ metalName: "Oro", purity: 0.75, appliedGrams: null, appliedMermaPct: 0 }],
      3,
    );
    expect(r).toHaveLength(0);
  });

  it("cantidad null/0/inválida → se trata como 1", () => {
    expect(buildMetalParentLineWeights([ORO], null)[0].gramsTotal).toBeCloseTo(0.91, 6);
    expect(buildMetalParentLineWeights([ORO], 0)[0].gramsTotal).toBeCloseTo(0.91, 6);
    expect(buildMetalParentLineWeights([ORO], -2 as any)[0].gramsTotal).toBeCloseTo(0.91, 6);
  });

  it("label = variantName (segmento 1); name = metal padre (segmento 2)", () => {
    const r = buildMetalParentLineWeights(
      [{ metalName: "Oro 999.99", purity: 0.907142, appliedGrams: 1.0,
         appliedMermaPct: 0, variantName: "Oro 18k", purityLabel: "18k" }],
      1,
    );
    expect(r[0].label).toBe("Oro 18k");        // variante (NO "Oro 999.99 18k")
    expect(r[0].name).toBe("Oro 999.99");      // metal padre → "<padre>: puro"
    expect(r[0].gramsTotal).toBeCloseTo(1.0, 6);
    expect(r[0].pureGramsTotal).toBeCloseTo(0.907142, 6);
  });

  it("label: NUNCA mezcla metal padre + ley (no 'Oro 999.99 18k')", () => {
    const r = buildMetalParentLineWeights(
      [{ metalName: "Oro 999.99", purity: 0.75, appliedGrams: 2,
         appliedMermaPct: 0, variantName: "Oro 18k", purityLabel: "18k" }],
      7,
    );
    expect(r[0].label).toBe("Oro 18k");
    expect(r[0].label).not.toMatch(/999\.99/);
    expect(r[0].gramsTotal).toBeCloseTo(14, 6);        // 2 × 7
    expect(r[0].pureGramsTotal).toBeCloseTo(10.5, 6);  // 14 × 0,75
  });

  it("acepta el alias metalVariantName", () => {
    const r = buildMetalParentLineWeights(
      [{ metalName: "Oro", purity: 0.75, appliedGrams: 1, appliedMermaPct: 0,
         metalVariantName: "Oro 24k" }],
      1,
    );
    expect(r[0].label).toBe("Oro 24k");
  });

  it("varias variantes distintas del mismo padre → cae al nombre del padre", () => {
    const r = buildMetalParentLineWeights(
      [
        { metalName: "Oro", purity: 0.75,  appliedGrams: 1, appliedMermaPct: 0, variantName: "Oro 18k" },
        { metalName: "Oro", purity: 0.916, appliedGrams: 1, appliedMermaPct: 0, variantName: "Oro 22k" },
      ],
      2,
    );
    expect(r[0].label).toBe("Oro");
  });

  it("sin variantName → label === nombre del padre (no usa purityLabel)", () => {
    const r = buildMetalParentLineWeights(
      [{ metalName: "Oro", purity: 0.75, appliedGrams: 1, appliedMermaPct: 0, purityLabel: "18k" }],
      1,
    );
    expect(r[0].label).toBe("Oro");
  });

  it("la merma NO afecta el peso comercial ni el puro (puro = grams × purity)", () => {
    const r = buildMetalParentLineWeights(
      [{ metalName: "Oro", purity: 0.75, appliedGrams: 1, appliedMermaPct: 5 }],
      2,
    );
    expect(r[0].gramsTotal).toBeCloseTo(2, 6);            // sin merma
    expect(r[0].pureGramsTotal).toBeCloseTo(1.5, 6);      // 1 × 0,75 × 2 (sin merma)
  });
});

describe("computeMetalSaleFactor", () => {
  it("ratio metalSale/metalCost", () => {
    expect(computeMetalSaleFactor({ metalCost: 100, metalSale: 185 })).toBeCloseTo(1.85, 9);
  });
  it("null cuando metalCost ≤ 0 o falta metalSale", () => {
    expect(computeMetalSaleFactor({ metalCost: 0, metalSale: 100 })).toBeNull();
    expect(computeMetalSaleFactor({ metalCost: 100, metalSale: null })).toBeNull();
    expect(computeMetalSaleFactor(null)).toBeNull();
  });
});

describe("buildMetalParentSaleTotals — equivalente de VENTA (= cards Simulador)", () => {
  // Fixture del caso real: Oro costo-equiv 4,33 / Plata 1,68 ; factor 1,85
  // → Simulador muestra Oro 8,01 / Plata 3,11.
  const items = [
    { metalName: "Oro",   purity: 1, appliedGrams: 4.33, appliedMermaPct: 0 },
    { metalName: "Plata", purity: 1, appliedGrams: 1.68, appliedMermaPct: 0 },
  ];

  it("aplica metalSaleFactor al costo-equiv (Oro 4,33→8,01 ; Plata 1,68→3,11)", () => {
    const factor = computeMetalSaleFactor({ metalCost: 100, metalSale: 185 }); // 1,85
    const r = buildMetalParentSaleTotals(items, factor);
    const oro   = r.find((x) => x.name === "Oro")!;
    const plata = r.find((x) => x.name === "Plata")!;
    expect(oro.costEquivGr).toBeCloseTo(4.33, 6);
    expect(plata.costEquivGr).toBeCloseTo(1.68, 6);
    // Formateado a 2 decimales (como el header/grid y la card del Simulador).
    expect(oro.saleEquivGr.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })).toBe("8,01");
    expect(plata.saleEquivGr.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })).toBe("3,11");
  });

  it("sin factor (null) → cae a costEquivGr (NO usa pure/equiv de costo como venta inventada)", () => {
    const r = buildMetalParentSaleTotals(items, null);
    expect(r.find((x) => x.name === "Oro")!.saleEquivGr).toBeCloseTo(4.33, 6);
    expect(r.find((x) => x.name === "Plata")!.saleEquivGr).toBeCloseTo(1.68, 6);
  });

  it("PARIDAD con MetalSaleCard: saleEquivGr === padre.totalEquivGr × metalSaleFactor", () => {
    // Replica EXACTA de la fórmula de MetalSaleCard.tsx:
    //   saleGramsTotal = padre.totalEquivGr * metalSaleFactor
    const mhb = { metalCost: 100, metalSale: 185 };
    const factor = computeMetalSaleFactor(mhb)!;
    const cost = buildMetalParentTotals(items);
    const sale = buildMetalParentSaleTotals(items, factor);
    for (const c of cost) {
      const s = sale.find((x) => x.name === c.name)!;
      expect(s.saleEquivGr).toBeCloseTo(c.totalEquivGr * factor, 9);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildMetalParentSaleLines — desglose por padre con gramos eq. VENTA + monto
// venta (mini "Composición del precio" dentro de "Total línea c/ imp." en
// Factura). Garantía de paridad EXACTA con MetalSaleCard del Simulador:
//
//   · gramsEquivLine === costEquivGr × metalSaleFactor × qty
//     (= "saleGramsTotal" que muestra la cabecera del card del Simulador)
//   · Σ metals[i].lineSale === metalHechuraBreakdown.metalSale
//     → × qty reproduce el subtotal de venta del metal por padre.
// ─────────────────────────────────────────────────────────────────────────────
describe("buildMetalParentSaleLines — mini desglose de Factura (paridad Simulador)", () => {
  // Caso real reportado por el usuario:
  //   appliedGrams=1,10 · purity=0,75 · merma=0 · metalSaleFactor=1,85
  //   costEquivGr  = 1,10 × 0,75 = 0,825  (lado COSTO — lo que el Simulador
  //                                        muestra en MetalEquivCard)
  //   saleEquivGr  = 0,825 × 1,85 = 1,52625  (lado VENTA — lo que muestra
  //                                           MetalSaleCard en la cabecera)
  // El mini desglose de Factura debe mostrar el VALOR DE VENTA (1,53), no el
  // valor de costo (0,825).
  it("caso usuario: appliedGrams 1,1 · purity 0,75 · factor 1,85 → 1,53 gr (lado VENTA, no 0,825)", () => {
    const factor = 1.85; // ratio metalSale/metalCost del motor
    const r = buildMetalParentSaleLines(
      [{ metalName: "Oro Fino SIII", purity: 0.75, appliedGrams: 1.1, appliedMermaPct: 0, lineSale: 381562.5 }],
      1,
      factor,
    );
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe("Oro Fino SIII");
    // saleEquivGr × qty = (1,1 × 0,75 × 1,85) × 1 ≈ 1,52625
    expect(r[0].gramsEquivLine).toBeCloseTo(1.1 * 0.75 * 1.85, 6); // 1,52625
    // valor VENTA = lineSale (per-unit) × qty
    expect(r[0].saleAmountLine).toBeCloseTo(381562.5, 6);
  });

  it("un padre con lineSale → saleAmountLine = Σ lineSale × qty (valor de VENTA con margen)", () => {
    const r = buildMetalParentSaleLines(
      [{ metalName: "Oro Fino", purity: 0.75, appliedGrams: 1.1, appliedMermaPct: 0, lineSale: 50000 }],
      3,
      null, // sin factor → fallback a costEquivGr (sin margen)
    );
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe("Oro Fino");
    // sin factor: gramos LADO COSTO × qty (fallback)
    expect(r[0].gramsEquivLine).toBeCloseTo(1.1 * 0.75 * 3, 6);   // 2,475
    // valor VENTA = lineSale (per-unit) × qty
    expect(r[0].saleAmountLine).toBeCloseTo(50000 * 3, 6);        // 150 000
  });

  it("varias variantes del mismo padre → suma lineSale por padre antes de escalar por qty", () => {
    const r = buildMetalParentSaleLines(
      [
        { metalName: "Oro", purity: 0.75,  appliedGrams: 1.2, appliedMermaPct: 0, lineSale: 30000 },
        { metalName: "Oro", purity: 0.916, appliedGrams: 2.0, appliedMermaPct: 0, lineSale: 70000 },
      ],
      2,
      null,
    );
    expect(r).toHaveLength(1);
    expect(r[0].saleAmountLine).toBeCloseTo((30000 + 70000) * 2, 6); // 200 000
  });

  it("múltiples padres con factor → cada padre con su saleEquivGr × qty", () => {
    const factor = 2.0; // metalSale/metalCost
    const r = buildMetalParentSaleLines(
      [
        { metalName: "Plata", purity: 0.925, appliedGrams: 5, appliedMermaPct: 0, lineSale: 1500 },
        { metalName: "Oro",   purity: 0.75,  appliedGrams: 1, appliedMermaPct: 0, lineSale: 40000 },
      ],
      1,
      factor,
    );
    expect(r.map((x) => x.name)).toEqual(["Oro", "Plata"]);
    // gramos LADO VENTA = costEquiv × factor
    expect(r.find((x) => x.name === "Oro")!.gramsEquivLine).toBeCloseTo(1 * 0.75 * factor, 6);     // 1,5
    expect(r.find((x) => x.name === "Plata")!.gramsEquivLine).toBeCloseTo(5 * 0.925 * factor, 6);  // 9,25
    expect(r.find((x) => x.name === "Oro")!.saleAmountLine).toBeCloseTo(40000, 6);
    expect(r.find((x) => x.name === "Plata")!.saleAmountLine).toBeCloseTo(1500, 6);
  });

  it("snapshot legacy SIN lineSale → saleAmountLine = null (NO inventa monto)", () => {
    const r = buildMetalParentSaleLines(
      [{ metalName: "Oro", purity: 0.75, appliedGrams: 1, appliedMermaPct: 0 }],
      1,
      null,
    );
    expect(r).toHaveLength(1);
    expect(r[0].gramsEquivLine).toBeCloseTo(0.75, 6);
    expect(r[0].saleAmountLine).toBeNull();
  });

  it("lineSale = 0 declarado por el motor → saleAmountLine = 0 (NO null)", () => {
    // Distingue "snapshot legacy" (null) de "motor declara venta 0".
    const r = buildMetalParentSaleLines(
      [{ metalName: "Oro", purity: 0.75, appliedGrams: 1, appliedMermaPct: 0, lineSale: 0 }],
      4,
      null,
    );
    expect(r[0].saleAmountLine).toBe(0);
  });

  it("padre mixto (un item con lineSale, otro sin) → suma sólo los presentes y devuelve monto (no null)", () => {
    const r = buildMetalParentSaleLines(
      [
        { metalName: "Oro", purity: 0.75,  appliedGrams: 1.0, appliedMermaPct: 0, lineSale: 25000 },
        { metalName: "Oro", purity: 0.916, appliedGrams: 0.5, appliedMermaPct: 0 }, // sin lineSale
      ],
      1,
      null,
    );
    expect(r[0].saleAmountLine).toBeCloseTo(25000, 6);
  });

  it("qty null/0/negativa → se trata como 1 (mismo criterio que el resto de helpers)", () => {
    const args = [{ metalName: "Oro", purity: 0.75, appliedGrams: 1, appliedMermaPct: 0, lineSale: 1000 }];
    expect(buildMetalParentSaleLines(args, null,  null)[0].saleAmountLine).toBeCloseTo(1000, 6);
    expect(buildMetalParentSaleLines(args, 0,     null)[0].saleAmountLine).toBeCloseTo(1000, 6);
    expect(buildMetalParentSaleLines(args, -3 as any, null)[0].saleAmountLine).toBeCloseTo(1000, 6);
  });

  it("metalSaleFactor inválido (null / NaN / ≤0) → fallback a costEquivGr (sin margen)", () => {
    const items = [{ metalName: "Oro", purity: 0.75, appliedGrams: 1, appliedMermaPct: 0, lineSale: 1000 }];
    // cada uno debe caer a costEquivGr = 0,75
    expect(buildMetalParentSaleLines(items, 1, null)[0].gramsEquivLine).toBeCloseTo(0.75, 6);
    expect(buildMetalParentSaleLines(items, 1, undefined)[0].gramsEquivLine).toBeCloseTo(0.75, 6);
    expect(buildMetalParentSaleLines(items, 1, 0)[0].gramsEquivLine).toBeCloseTo(0.75, 6);
    expect(buildMetalParentSaleLines(items, 1, -1)[0].gramsEquivLine).toBeCloseTo(0.75, 6);
    expect(buildMetalParentSaleLines(items, 1, Number.NaN)[0].gramsEquivLine).toBeCloseTo(0.75, 6);
  });

  it("ignora items sin nombre o sin gramos (no rompe ni inventa padres fantasma)", () => {
    const r = buildMetalParentSaleLines(
      [
        { metalName: "",    purity: 0.75, appliedGrams: 1,    appliedMermaPct: 0, lineSale: 1 },
        { metalName: "Oro", purity: 0.75, appliedGrams: null, appliedMermaPct: 0, lineSale: 1 },
        null,
      ],
      2,
      null,
    );
    expect(r).toHaveLength(0);
  });

  // PARIDAD numérica con el contrato del motor: ya que
  // `Σ metals[i].lineSale === metalHechuraBreakdown.metalSale`, agrupar por
  // padre y escalar por qty equivale al "subtotal de venta del metal" que
  // muestra `MetalSaleCard.padre.totalCost` del Simulador.
  it("PARIDAD con MetalSaleCard (monto): Σ saleAmountLine === metalSale_unit × qty", () => {
    // Caso real: 2 metales padre, sale individuales conocidos.
    const items = [
      { metalName: "Oro",   purity: 1,     appliedGrams: 4.33, appliedMermaPct: 0, lineSale: 800 },
      { metalName: "Plata", purity: 0.925, appliedGrams: 1.68, appliedMermaPct: 0, lineSale: 120 },
    ];
    const metalSaleUnit = items.reduce((s, it) => s + (it.lineSale ?? 0), 0); // 920
    const qty = 5;
    const r = buildMetalParentSaleLines(items, qty, 1.85);
    const sumLine = r.reduce((s, p) => s + (p.saleAmountLine ?? 0), 0);
    expect(sumLine).toBeCloseTo(metalSaleUnit * qty, 6);  // 4 600
  });

  // PARIDAD numérica con la cabecera de MetalSaleCard:
  //   saleGramsTotal = padre.totalEquivGr × metalSaleFactor
  // → multiplicado por qty es exactamente `gramsEquivLine`.
  it("PARIDAD con MetalSaleCard (gramos): gramsEquivLine === MetalSaleCard.saleGramsTotal × qty", () => {
    const factor = 1.85;
    const items = [
      { metalName: "Oro", purity: 0.75, appliedGrams: 1.1, appliedMermaPct: 0, lineSale: 50000 },
    ];
    const r = buildMetalParentSaleLines(items, 2, factor);
    // MetalSaleCard hace: saleGramsTotal = totalEquivGr × factor = (1,1 × 0,75) × 1,85 = 1,52625
    // × qty (2) = 3,0525
    expect(r[0].gramsEquivLine).toBeCloseTo(1.1 * 0.75 * factor * 2, 6);
  });

  // ─── T26 — sub-línea de variantes (nombre + gramos originales × qty) ───
  describe("variants: sub-línea de variante (nombre + gramos originales × qty)", () => {
    it("padre con UNA variante → 1 entrada, gramos originales × qty", () => {
      const r = buildMetalParentSaleLines(
        [{
          metalName: "Oro Fino SIII", variantName: "Oro 18 Kilates",
          purity: 0.75, appliedGrams: 1.0, appliedMermaPct: 0, lineSale: 1000,
        }],
        3,
        1.85,
      );
      expect(r[0].variants).toHaveLength(1);
      expect(r[0].variants[0].label).toBe("Oro 18 Kilates");
      // gramos ORIGINALES × qty (sin pureza, sin merma, sin saleFactor)
      expect(r[0].variants[0].gramsLine).toBeCloseTo(1.0 * 3, 6);
    });

    it("padre con VARIAS variantes distintas → una entrada por variante, ordenadas por nombre", () => {
      const r = buildMetalParentSaleLines(
        [
          { metalName: "Oro Fino SIII", variantName: "Oro 18 Kilates", purity: 0.75,  appliedGrams: 1.2, appliedMermaPct: 0, lineSale: 30000 },
          { metalName: "Oro Fino SIII", variantName: "Oro 22 Kilates", purity: 0.916, appliedGrams: 0.5, appliedMermaPct: 0, lineSale: 20000 },
        ],
        2,
        1.85,
      );
      expect(r[0].variants.map((v) => v.label)).toEqual(["Oro 18 Kilates", "Oro 22 Kilates"]);
      expect(r[0].variants[0].gramsLine).toBeCloseTo(1.2 * 2, 6); // 2,4
      expect(r[0].variants[1].gramsLine).toBeCloseTo(0.5 * 2, 6); // 1,0
    });

    it("misma variante en VARIAS cost lines → SUMA los gramos antes de escalar por qty", () => {
      const r = buildMetalParentSaleLines(
        [
          { metalName: "Oro", variantName: "Oro 18k", purity: 0.75, appliedGrams: 1.0, appliedMermaPct: 0, lineSale: 1000 },
          { metalName: "Oro", variantName: "Oro 18k", purity: 0.75, appliedGrams: 0.5, appliedMermaPct: 0, lineSale: 500 },
        ],
        2,
        null,
      );
      expect(r[0].variants).toHaveLength(1);
      expect(r[0].variants[0].label).toBe("Oro 18k");
      // (1,0 + 0,5) × 2 = 3,0 — suma antes de escalar.
      expect(r[0].variants[0].gramsLine).toBeCloseTo(3.0, 6);
    });

    it("sin variantName pero CON purityLabel → label cae a purityLabel", () => {
      const r = buildMetalParentSaleLines(
        [{
          metalName: "Oro", purity: 0.75, appliedGrams: 1.1, appliedMermaPct: 0,
          lineSale: 1000, purityLabel: "18k",
        }],
        1,
        null,
      );
      expect(r[0].variants[0].label).toBe("18k");
      expect(r[0].variants[0].gramsLine).toBeCloseTo(1.1, 6);
    });

    it("snapshot legacy SIN variantName ni purityLabel → label cae al nombre del padre", () => {
      const r = buildMetalParentSaleLines(
        [{ metalName: "Oro", purity: 0.75, appliedGrams: 2, appliedMermaPct: 0 }],
        1,
        null,
      );
      expect(r[0].variants[0].label).toBe("Oro");
      expect(r[0].variants[0].gramsLine).toBeCloseTo(2, 6);
    });

    it("acepta alias `metalVariantName`", () => {
      const r = buildMetalParentSaleLines(
        [{
          metalName: "Oro", metalVariantName: "Oro 24k",
          purity: 1, appliedGrams: 1, appliedMermaPct: 0, lineSale: 100,
        }],
        1,
        null,
      );
      expect(r[0].variants[0].label).toBe("Oro 24k");
    });

    it("la sub-línea NO se altera por metalSaleFactor (gramos ORIGINALES, no de venta)", () => {
      // El monto `saleAmountLine` cambia con lineSale, pero los gramos
      // originales de la variante son passthrough — el motor no los modifica.
      const items = [
        { metalName: "Oro", variantName: "Oro 18k", purity: 0.75, appliedGrams: 1.1, appliedMermaPct: 0, lineSale: 50000 },
      ];
      const withFactor    = buildMetalParentSaleLines(items, 1, 1.85);
      const withoutFactor = buildMetalParentSaleLines(items, 1, null);
      expect(withFactor[0].variants[0].gramsLine).toBeCloseTo(1.1, 6);
      expect(withoutFactor[0].variants[0].gramsLine).toBeCloseTo(1.1, 6);
      // gramsEquivLine (lado venta) sí debe diferir
      expect(withFactor[0].gramsEquivLine).not.toBeCloseTo(withoutFactor[0].gramsEquivLine, 4);
    });

    it("ignora items inválidos al armar variantes (sin nombre / sin gramos)", () => {
      const r = buildMetalParentSaleLines(
        [
          { metalName: "Oro", variantName: "Oro 18k", purity: 0.75, appliedGrams: 1, appliedMermaPct: 0, lineSale: 100 },
          { metalName: "Oro", variantName: "Oro 22k", purity: 0.916, appliedGrams: null, appliedMermaPct: 0, lineSale: 50 },
          { metalName: "",    variantName: "x", purity: 0.75, appliedGrams: 5, appliedMermaPct: 0, lineSale: 999 },
        ],
        1,
        null,
      );
      expect(r[0].variants).toHaveLength(1);
      expect(r[0].variants[0].label).toBe("Oro 18k");
    });
  });
});
