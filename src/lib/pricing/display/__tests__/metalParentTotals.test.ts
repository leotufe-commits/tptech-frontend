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
  resolveCommercialPostGrams,
  pickLineCommercialRoundingMetals,
  resolveCommercialMonetaryImpact,
  resolveCommercialHechuraImpact,
  resolveLineBalanceMode,
  isLineDesglosadaView,
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

  it("propaga metalParentId al output (identidad para match por ID en el card)", () => {
    const r = buildMetalParentSaleLines(
      [{ metalName: "Oro Fino", metalParentId: "metal-oro-fino", purity: 0.75, appliedGrams: 1.1, appliedMermaPct: 0, lineSale: 50000 }],
      1,
      1.85,
    );
    expect(r).toHaveLength(1);
    expect(r[0].metalParentId).toBe("metal-oro-fino");
  });

  it("metalParentId null cuando el item no lo trae (snapshot legacy → fallback por nombre)", () => {
    const r = buildMetalParentSaleLines(
      [{ metalName: "Oro Fino", purity: 0.75, appliedGrams: 1.1, appliedMermaPct: 0, lineSale: 50000 }],
      1,
      1.85,
    );
    expect(r[0].metalParentId).toBeNull();
  });

  it("varias variantes del mismo padre comparten metalParentId (primer id no-nulo)", () => {
    const r = buildMetalParentSaleLines(
      [
        { metalName: "Oro Fino", metalParentId: "metal-oro", purity: 0.75,  appliedGrams: 1.0, appliedMermaPct: 0, lineSale: 10000 },
        { metalName: "Oro Fino", metalParentId: "metal-oro", purity: 0.585, appliedGrams: 0.5, appliedMermaPct: 0, lineSale: 5000 },
      ],
      1,
      null,
    );
    expect(r).toHaveLength(1);
    expect(r[0].metalParentId).toBe("metal-oro");
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

// ─────────────────────────────────────────────────────────────────────────────
// buildMetalParentSaleTotals — propaga metalParentId (chip "Metales" del grid)
// ─────────────────────────────────────────────────────────────────────────────
describe("buildMetalParentSaleTotals — propaga metalParentId", () => {
  it("propaga metalParentId al output", () => {
    const r = buildMetalParentSaleTotals(
      [{ metalName: "Oro Fino", metalParentId: "metal-oro-fino", purity: 0.75, appliedGrams: 1.1, appliedMermaPct: 0 }],
      1.85,
    );
    expect(r).toHaveLength(1);
    expect(r[0].metalParentId).toBe("metal-oro-fino");
  });

  it("metalParentId null cuando el item no lo trae (snapshot legacy)", () => {
    const r = buildMetalParentSaleTotals(
      [{ metalName: "Oro Fino", purity: 0.75, appliedGrams: 1.1, appliedMermaPct: 0 }],
      1.85,
    );
    expect(r[0].metalParentId).toBeNull();
  });

  it("varias variantes del mismo padre comparten metalParentId (primer id no-nulo)", () => {
    const r = buildMetalParentSaleTotals(
      [
        { metalName: "Oro Fino", metalParentId: "metal-oro", purity: 0.75,  appliedGrams: 1.0, appliedMermaPct: 0 },
        { metalName: "Oro Fino", metalParentId: "metal-oro", purity: 0.585, appliedGrams: 0.5, appliedMermaPct: 0 },
      ],
      null,
    );
    expect(r).toHaveLength(1);
    expect(r[0].metalParentId).toBe("metal-oro");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveCommercialPostGrams — match por ID (canónico) + fallback por nombre
// ─────────────────────────────────────────────────────────────────────────────
describe("resolveCommercialPostGrams — match por ID con fallback legacy por nombre", () => {
  const snap = [
    { metalParentId: "metal-oro",   metalParentName: "Oro Fino", postGrams: 1.40 },
    { metalParentId: "metal-plata", metalParentName: "Plata",    postGrams: 5.00 },
  ];

  it("match por ID aunque el nombre visible sea DISTINTO → postGrams del snapshot (1,40)", () => {
    const g = resolveCommercialPostGrams({ metalParentId: "metal-oro", name: "ORO (AU)" }, snap);
    expect(g).toBe(1.40);
  });

  it("fallback legacy por nombre cuando el target NO tiene metalParentId", () => {
    const g = resolveCommercialPostGrams({ metalParentId: null, name: "Plata" }, snap);
    expect(g).toBe(5.00);
  });

  it("prioriza ID sobre nombre (ignora el fallback si el id matchea)", () => {
    const snap2 = [{ metalParentId: "metal-oro", metalParentName: "OTRO NOMBRE", postGrams: 1.40 }];
    const g = resolveCommercialPostGrams({ metalParentId: "metal-oro", name: "no-matchea-nombre" }, snap2);
    expect(g).toBe(1.40);
  });

  it("sin match (ni id ni nombre) → null (el caller usa el crudo)", () => {
    const g = resolveCommercialPostGrams({ metalParentId: "metal-platino", name: "Platino" }, snap);
    expect(g).toBeNull();
  });

  it("snapshot vacío → null", () => {
    expect(resolveCommercialPostGrams({ metalParentId: "x", name: "y" }, [])).toBeNull();
  });

  it("postGrams inválido (no número) → null", () => {
    const g = resolveCommercialPostGrams(
      { metalParentId: "metal-oro", name: "Oro Fino" },
      [{ metalParentId: "metal-oro", metalParentName: "Oro Fino", postGrams: null }],
    );
    expect(g).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// pickLineCommercialRoundingMetals — fuente por prioridad (PER_DOC → PHYSICAL
// per-línea → doc-level legacy)
// ─────────────────────────────────────────────────────────────────────────────
describe("pickLineCommercialRoundingMetals — selección de fuente por línea", () => {
  it("lineCommercialRoundingMetals null PERO appliedRounding.physical.metals presente → usa physical", () => {
    const meta = {
      lineCommercialRoundingMetals: null,
      commercialRoundingContext:    null,
      appliedRounding: {
        physical: { metals: [{ metalParentId: "metal-oro", metalParentName: "Oro Fino", postGrams: 1.4 }] },
      },
    };
    const src = pickLineCommercialRoundingMetals(meta);
    expect(src).toHaveLength(1);
    expect(src[0].metalParentId).toBe("metal-oro");
    expect(src[0].postGrams).toBe(1.4);
  });

  it("commercialPhysical.metals como alias cuando appliedRounding ausente", () => {
    const meta = {
      lineCommercialRoundingMetals: null,
      commercialPhysical: { metals: [{ metalParentId: "metal-oro", metalParentName: "Oro Fino", postGrams: 1.4 }] },
    };
    const src = pickLineCommercialRoundingMetals(meta);
    expect(src[0].postGrams).toBe(1.4);
  });

  it("prioridad: lineCommercialRoundingMetals gana sobre physical", () => {
    const meta = {
      lineCommercialRoundingMetals: [{ metalParentId: "metal-oro", postGrams: 1.5 }],
      appliedRounding: { physical: { metals: [{ metalParentId: "metal-oro", postGrams: 1.4 }] } },
    };
    const src = pickLineCommercialRoundingMetals(meta);
    expect(src[0].postGrams).toBe(1.5);  // PER_DOCUMENT per-línea
  });

  it("doc-level legacy: commercialRoundingContext.breakdown.metalsPostGrams cuando no hay per-línea", () => {
    const meta = {
      commercialRoundingContext: {
        breakdown: { metalsPostGrams: [{ metalParentId: "metal-oro", postGrams: 1.4 }] },
      },
    };
    const src = pickLineCommercialRoundingMetals(meta);
    expect(src[0].postGrams).toBe(1.4);
  });

  it("ninguna fuente → [] (el caller usa el crudo)", () => {
    expect(pickLineCommercialRoundingMetals({})).toEqual([]);
    expect(pickLineCommercialRoundingMetals(null)).toEqual([]);
  });

  // ── Listas mixtas (2026-06-03) — GRAMOS SIEMPRE; impacto $ legacy bloqueado ─
  it("listas mixtas (priceListMixed=true) + physical → SIGUE alimentando los gramos (1,40)", () => {
    // El metal comercial visible NO se suprime: en MIXED_LIST_FALLBACK los
    // gramos siguen viniendo de `appliedRounding.physical`. La supresión de la
    // capa MONETARIA legacy se hace en los resolvers de impacto, no acá.
    const meta = {
      priceListMixed: true,
      lineCommercialRoundingMetals: null,
      commercialRoundingContext: null,
      appliedRounding: {
        physical: { metals: [{ metalParentId: "metal-oro", metalParentName: "Oro Fino", postGrams: 1.4 }] },
      },
    };
    const src = pickLineCommercialRoundingMetals(meta);
    expect(src).toHaveLength(1);
    expect(src[0].postGrams).toBe(1.4);  // gramos conservados
  });

  it("single (priceListMixed=false) + physical → gramos (1,40) — back-compat", () => {
    const meta = {
      priceListMixed: false,
      lineCommercialRoundingMetals: null,
      appliedRounding: { physical: { metals: [{ metalParentId: "metal-oro", postGrams: 1.4 }] } },
    };
    expect(pickLineCommercialRoundingMetals(meta)[0].postGrams).toBe(1.4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Listas mixtas (2026-06-03) — bloqueo de la CAPA MONETARIA legacy
// (`allowPerLineLegacy: false`). Los gramos NO se ven afectados.
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// lineBalanceMode — modo DESGLOSADA/UNIFICADA como propiedad EXPLÍCITA de línea
// (2026-06-03). NO debe inferirse del estado documental (commercialRoundingContext).
// ─────────────────────────────────────────────────────────────────────────────
describe("resolveLineBalanceMode / isLineDesglosadaView — propiedad de línea", () => {
  it("lineBalanceMode explícito BREAKDOWN → desglosada (aunque commercialRoundingContext sea null)", () => {
    // Caso MIXED_LIST_FALLBACK: el doc no emite commercialRoundingContext, pero
    // la línea trae su lineBalanceMode explícito → conserva layout desglosado.
    const meta = { lineBalanceMode: "BREAKDOWN", commercialRoundingContext: null, lineMonetarySaldoPostCommercialRounding: null };
    expect(resolveLineBalanceMode(meta)).toBe("BREAKDOWN");
    expect(isLineDesglosadaView(meta)).toBe(true);
  });

  it("lineBalanceMode explícito UNIFIED → unificada (gana sobre cualquier contexto doc)", () => {
    const meta = { lineBalanceMode: "UNIFIED", commercialRoundingContext: { scope: "BREAKDOWN" } };
    expect(resolveLineBalanceMode(meta)).toBe("UNIFIED");
    expect(isLineDesglosadaView(meta)).toBe(false);
  });

  it("deriva de appliedPriceListMode: METAL_HECHURA → BREAKDOWN", () => {
    const meta = { appliedPriceListMode: "METAL_HECHURA" };
    expect(resolveLineBalanceMode(meta)).toBe("BREAKDOWN");
    expect(isLineDesglosadaView(meta)).toBe(true);
  });

  it("deriva de appliedPriceListMode: MARGIN_TOTAL → UNIFIED", () => {
    const meta = { appliedPriceListMode: "MARGIN_TOTAL" };
    expect(resolveLineBalanceMode(meta)).toBe("UNIFIED");
    expect(isLineDesglosadaView(meta)).toBe(false);
  });

  it("sin señal de línea → fallback legacy (commercialRoundingContext.scope)", () => {
    expect(isLineDesglosadaView({ commercialRoundingContext: { scope: "BREAKDOWN" } })).toBe(true);
    expect(isLineDesglosadaView({ lineMonetarySaldoPostCommercialRounding: 185500 })).toBe(true);
    expect(isLineDesglosadaView({})).toBe(false);
    expect(isLineDesglosadaView(null)).toBe(false);
  });

  // Escenarios A–D — el modo es per-línea, independiente del estado documental.
  it("A) Desglosada + Desglosada → ambas desglosadas", () => {
    const l1 = { lineBalanceMode: "BREAKDOWN" };
    const l2 = { lineBalanceMode: "BREAKDOWN" };
    expect(isLineDesglosadaView(l1)).toBe(true);
    expect(isLineDesglosadaView(l2)).toBe(true);
  });

  it("B) Unificada + Unificada → ambas unificadas", () => {
    const l1 = { lineBalanceMode: "UNIFIED" };
    const l2 = { lineBalanceMode: "UNIFIED" };
    expect(isLineDesglosadaView(l1)).toBe(false);
    expect(isLineDesglosadaView(l2)).toBe(false);
  });

  it("C) Desglosada + Unificada (mixto) → cada línea su layout, con commercialRoundingContext null en ambas", () => {
    // Documento en MIXED_LIST_FALLBACK: commercialRoundingContext null en las dos
    // líneas. Aun así, cada una conserva su modo por su propiedad explícita.
    const desglosada = { lineBalanceMode: "BREAKDOWN", commercialRoundingContext: null };
    const unificada  = { lineBalanceMode: "UNIFIED",   commercialRoundingContext: null };
    expect(isLineDesglosadaView(desglosada)).toBe(true);
    expect(isLineDesglosadaView(unificada)).toBe(false);
  });

  it("D) Unificada + Desglosada (mixto, invertido) → cada línea su layout", () => {
    const unificada  = { lineBalanceMode: "UNIFIED",   commercialRoundingContext: null };
    const desglosada = { lineBalanceMode: "BREAKDOWN", commercialRoundingContext: null };
    expect(isLineDesglosadaView(unificada)).toBe(false);
    expect(isLineDesglosadaView(desglosada)).toBe(true);
  });
});

describe("resolveCommercialMonetaryImpact / resolveCommercialHechuraImpact — bloqueo legacy en mixto", () => {
  it("metal: monetaryEquivalent (PER_LINE) se BLOQUEA con allowPerLineLegacy=false", () => {
    expect(resolveCommercialMonetaryImpact({ monetaryEquivalent: 9675 }, { allowPerLineLegacy: false })).toBeNull();
  });

  it("metal: monetaryEquivalent se MUESTRA por default (single-list / back-compat)", () => {
    expect(resolveCommercialMonetaryImpact({ monetaryEquivalent: 9675 })).toBe(9675);
  });

  it("metal: monetaryImpact (PER_DOCUMENT) se MUESTRA aunque allowPerLineLegacy=false", () => {
    expect(resolveCommercialMonetaryImpact({ monetaryImpact: 100 }, { allowPerLineLegacy: false })).toBe(100);
  });

  it("hechura: hechuraSaleRoundingDelta (PER_LINE) se BLOQUEA con allowPerLineLegacy=false", () => {
    expect(resolveCommercialHechuraImpact({ hechuraSaleRoundingDelta: 24.79 }, { allowPerLineLegacy: false })).toBeNull();
  });

  it("hechura: hechuraSaleRoundingDelta se MUESTRA por default (back-compat)", () => {
    expect(resolveCommercialHechuraImpact({ hechuraSaleRoundingDelta: 24.79 })).toBe(24.79);
  });

  it("hechura: hechuraRoundingMonetaryImpact (PER_DOCUMENT) se MUESTRA aunque allowPerLineLegacy=false", () => {
    expect(resolveCommercialHechuraImpact({ hechuraRoundingMonetaryImpact: 50 }, { allowPerLineLegacy: false })).toBe(50);
  });

  it("integración: physical + resolveCommercialPostGrams por ID (nombre distinto) → 1,40", () => {
    const meta = {
      appliedRounding: {
        physical: { metals: [{ metalParentId: "metal-oro", metalParentName: "Oro Fino", postGrams: 1.4 }] },
      },
    };
    const src = pickLineCommercialRoundingMetals(meta);
    // El card muestra "ORO (AU)" pero matchea por id → 1,40.
    const g = resolveCommercialPostGrams({ metalParentId: "metal-oro", name: "ORO (AU)" }, src);
    expect(g).toBe(1.4);
  });

  it("fallback legacy: sin metalParentId en target, match por nombre contra physical", () => {
    const meta = {
      appliedRounding: {
        physical: { metals: [{ metalParentId: "metal-oro", metalParentName: "Oro Fino", postGrams: 1.4 }] },
      },
    };
    const src = pickLineCommercialRoundingMetals(meta);
    const g = resolveCommercialPostGrams({ metalParentId: null, name: "Oro Fino" }, src);
    expect(g).toBe(1.4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveCommercialMonetaryImpact — impacto $ del Redondeo Comercial
// (monetaryImpact ?? monetaryEquivalent)
// ─────────────────────────────────────────────────────────────────────────────
describe("resolveCommercialMonetaryImpact — monetaryImpact ?? monetaryEquivalent", () => {
  it("PER_LINE PHYSICAL: lee monetaryEquivalent (+7.256,25)", () => {
    const r = resolveCommercialMonetaryImpact({ monetaryEquivalent: 7256.25 });
    expect(r).toBe(7256.25);
  });

  it("PER_DOCUMENT: sigue leyendo monetaryImpact", () => {
    const r = resolveCommercialMonetaryImpact({ monetaryImpact: 24.79 });
    expect(r).toBe(24.79);
  });

  it("prioridad: monetaryImpact gana sobre monetaryEquivalent (compat PER_DOCUMENT)", () => {
    const r = resolveCommercialMonetaryImpact({ monetaryImpact: 24.79, monetaryEquivalent: 999 });
    expect(r).toBe(24.79);
  });

  it("sin impacto (ninguno finito) → null (el card oculta la fila)", () => {
    expect(resolveCommercialMonetaryImpact({})).toBeNull();
    expect(resolveCommercialMonetaryImpact(null)).toBeNull();
    expect(resolveCommercialMonetaryImpact({ monetaryImpact: null, monetaryEquivalent: null })).toBeNull();
    expect(resolveCommercialMonetaryImpact({ monetaryEquivalent: NaN })).toBeNull();
  });

  it("integración PER_LINE PHYSICAL: picker + impacto monetario por ID → 7.256,25 (con deltaGrams)", () => {
    const meta = {
      appliedRounding: {
        physical: {
          metals: [{
            metalParentId:   "metal-oro",
            metalParentName: "Oro Fino",
            preGrams:        1.3613,
            postGrams:       1.4,
            deltaGrams:      0.0387,
            monetaryEquivalent: 7256.25,
          }],
        },
      },
    };
    const src = pickLineCommercialRoundingMetals(meta);
    const crMetal = src.find((x) => x.metalParentId === "metal-oro");
    // Gramos finales (1,40) y delta (+0,0387 ≈ +0,04 g en desglosado).
    expect(crMetal?.postGrams).toBe(1.4);
    expect(crMetal?.deltaGrams).toBeCloseTo(0.0387, 4);
    // Impacto monetario (UNIFICADO muestra solo esto; DESGLOSADO grams + esto).
    expect(resolveCommercialMonetaryImpact(crMetal)).toBe(7256.25);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveCommercialHechuraImpact — redondeo MONETARIO comercial del bucket
// hechura/saldo (hechuraRoundingMonetaryImpact ?? hechuraSaleRoundingDelta)
// ─────────────────────────────────────────────────────────────────────────────
describe("resolveCommercialHechuraImpact — hechuraRoundingMonetaryImpact ?? hechuraSaleRoundingDelta", () => {
  it("PER_LINE: lee hechuraSaleRoundingDelta (+24,79)", () => {
    const r = resolveCommercialHechuraImpact({ hechuraSaleRoundingDelta: 24.79 });
    expect(r).toBe(24.79);
  });

  it("PER_LINE: delta negativo (-16,12)", () => {
    const r = resolveCommercialHechuraImpact({ hechuraSaleRoundingDelta: -16.12 });
    expect(r).toBe(-16.12);
  });

  it("PER_DOCUMENT: sigue leyendo hechuraRoundingMonetaryImpact", () => {
    const r = resolveCommercialHechuraImpact({ hechuraRoundingMonetaryImpact: 24.79 });
    expect(r).toBe(24.79);
  });

  it("prioridad: hechuraRoundingMonetaryImpact gana sobre hechuraSaleRoundingDelta", () => {
    const r = resolveCommercialHechuraImpact({ hechuraRoundingMonetaryImpact: 24.79, hechuraSaleRoundingDelta: 999 });
    expect(r).toBe(24.79);
  });

  it("sin impacto → null (la fila no se renderiza)", () => {
    expect(resolveCommercialHechuraImpact({})).toBeNull();
    expect(resolveCommercialHechuraImpact(null)).toBeNull();
    expect(resolveCommercialHechuraImpact({ hechuraRoundingMonetaryImpact: null, hechuraSaleRoundingDelta: null })).toBeNull();
    expect(resolveCommercialHechuraImpact({ hechuraSaleRoundingDelta: NaN })).toBeNull();
  });

  it("es independiente del impacto del METAL (no altera el físico)", () => {
    // El helper de hechura lee SOLO campos de hechura; el de metal SOLO los de metal.
    const meta = { hechuraSaleRoundingDelta: 24.79, monetaryEquivalent: 7256.25 };
    expect(resolveCommercialHechuraImpact(meta)).toBe(24.79);
    expect(resolveCommercialMonetaryImpact(meta)).toBe(7256.25);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// CONTRATO INMUTABLE — REDONDEO COMERCIAL (guard de regresión)
//
// Blinda las 4 reglas que NO se negocian (ver CLAUDE.md raíz §"REDONDEO
// COMERCIAL — REGLAS INMUTABLES"). Si alguna pantalla vuelve a leer campos
// crudos o invierte la prioridad, estos asserts fallan.
//   1. PER_DOCUMENT prioritizado sobre PER_LINE (legacy fallback).
//   2. PER_LINE solo como fallback cuando el canónico no vino.
//   3. Match por metalParentId ANTES que por nombre.
//   4. Passthrough puro — el frontend NO recalcula (devuelve el valor backend tal cual).
// ═════════════════════════════════════════════════════════════════════════════
describe("CONTRATO INMUTABLE — redondeo comercial (guard)", () => {
  describe("1. PER_DOCUMENT prioritizado sobre PER_LINE", () => {
    it("hechura/saldo: hechuraRoundingMonetaryImpact gana sobre hechuraSaleRoundingDelta", () => {
      expect(resolveCommercialHechuraImpact({
        hechuraRoundingMonetaryImpact: 24.79,   // PER_DOCUMENT (canónico)
        hechuraSaleRoundingDelta:      -4.5,     // PER_LINE (legacy)
      })).toBe(24.79);
    });
    it("metal: monetaryImpact (PER_DOCUMENT) gana sobre monetaryEquivalent (PER_LINE)", () => {
      expect(resolveCommercialMonetaryImpact({
        monetaryImpact:     9675,     // PER_DOCUMENT
        monetaryEquivalent: 7256.25,  // PER_LINE PHYSICAL
      })).toBe(9675);
    });
    it("gramos: lineCommercialRoundingMetals (PER_DOCUMENT) gana sobre appliedRounding.physical (PER_LINE)", () => {
      const picked = pickLineCommercialRoundingMetals({
        lineCommercialRoundingMetals: [{ metalParentId: "au", postGrams: 1.4 }],
        appliedRounding: { physical: { metals: [{ metalParentId: "au", postGrams: 1.2 }] } },
      });
      expect(picked).toHaveLength(1);
      expect(picked[0].postGrams).toBe(1.4); // el PER_DOCUMENT, no el 1.2 PER_LINE
    });
  });

  describe("2. PER_LINE solo como fallback (cuando el canónico no vino)", () => {
    it("hechura: cae a hechuraSaleRoundingDelta si no hay impacto PER_DOCUMENT", () => {
      expect(resolveCommercialHechuraImpact({ hechuraSaleRoundingDelta: -4.5 })).toBe(-4.5);
    });
    it("metal: cae a monetaryEquivalent si no hay monetaryImpact", () => {
      expect(resolveCommercialMonetaryImpact({ monetaryEquivalent: 7256.25 })).toBe(7256.25);
    });
    it("gramos: cae a appliedRounding.physical.metals si no hay lineCommercialRoundingMetals", () => {
      const picked = pickLineCommercialRoundingMetals({
        appliedRounding: { physical: { metals: [{ metalParentId: "au", postGrams: 1.4 }] } },
      });
      expect(picked).toHaveLength(1);
      expect(picked[0].postGrams).toBe(1.4);
    });
  });

  describe("3. Match por metalParentId ANTES que por nombre", () => {
    it("matchea por id aunque el nombre difiera (id es la identidad canónica)", () => {
      const g = resolveCommercialPostGrams(
        { metalParentId: "au", name: "NOMBRE_DISTINTO" },
        [{ metalParentId: "au", metalParentName: "Oro", postGrams: 1.4 }],
      );
      expect(g).toBe(1.4);
    });
    it("usa el nombre SOLO como fallback legacy cuando no hay id en el target", () => {
      const g = resolveCommercialPostGrams(
        { metalParentId: null, name: "Oro" },
        [{ metalParentName: "Oro", postGrams: 1.4 }],
      );
      expect(g).toBe(1.4);
    });
    it("no cruza metales: id que no matchea → null (el caller usa su valor crudo)", () => {
      const g = resolveCommercialPostGrams(
        { metalParentId: "ag", name: "Plata" },
        [{ metalParentId: "au", metalParentName: "Oro", postGrams: 1.4 }],
      );
      expect(g).toBeNull();
    });
  });

  describe("4. Passthrough puro — el frontend NO recalcula", () => {
    it("hechura: devuelve el número backend EXACTO (sin redondear ni transformar)", () => {
      expect(resolveCommercialHechuraImpact({ hechuraRoundingMonetaryImpact: 24.793117 })).toBe(24.793117);
    });
    it("gramos: devuelve postGrams del snapshot EXACTO", () => {
      expect(resolveCommercialPostGrams(
        { metalParentId: "au", name: "Oro" },
        [{ metalParentId: "au", postGrams: 1.3961 }],
      )).toBe(1.3961);
    });
    it("sin dato → null/[] (no inventa un valor)", () => {
      expect(resolveCommercialHechuraImpact({})).toBeNull();
      expect(resolveCommercialMonetaryImpact({})).toBeNull();
      expect(pickLineCommercialRoundingMetals({})).toEqual([]);
      expect(resolveCommercialPostGrams({ metalParentId: "au", name: "Oro" }, [])).toBeNull();
    });
  });
});
