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
