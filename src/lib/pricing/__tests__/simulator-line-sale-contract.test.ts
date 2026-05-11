// src/lib/pricing/__tests__/simulator-line-sale-contract.test.ts
// =============================================================================
// F1.5 #A+/#A++ — contrato del PricingSimulator post POLICY R4.1.
//
// Este test verifica la INVARIANTE que el simulator debe respetar tras la
// migración: dado un response del backend con `composition.{type}[i].lineSale`
// poblado, el rendering por línea (HECHURA/PRODUCT/SERVICE y METAL) debe
// USAR ese valor canónico — NO recalcular `lineCost × factor` localmente.
//
// El test no renderiza el componente (es un monolito de 6900 líneas con
// muchas dependencias); en su lugar reproduce la fórmula de selección que
// el simulator aplica ahora:
//
//   const canonical = lineSaleByCostLineId.get(costLineId);
//   const lineSale  = canonical != null ? canonical : lineCost × factor;
//
// y valida:
//   1. Cuando `lineSale` viene del backend → se usa textualmente.
//   2. Cuando no viene → fallback al multiplicador legacy `lineCost × factor`.
//   3. La fórmula visible `lineCost × factor_visible = lineSale` cuadra con
//      ambos paths (canonical y fallback).
//   4. El map se construye correctamente desde los 4 buckets (metals,
//      hechuras, products, services) usando `costLineId` como key.
// =============================================================================

import { describe, it, expect } from "vitest";

/**
 * Reproduce el constructor del map del simulator. Es la única "lógica" del
 * simulator que el test valida — el resto es presentación.
 */
function buildLineSaleMap(composition: any): Map<string, number> {
  const map = new Map<string, number>();
  for (const arr of [
    composition?.metals, composition?.hechuras,
    composition?.products, composition?.services,
  ]) {
    if (!Array.isArray(arr)) continue;
    for (const it of arr) {
      if (it?.costLineId && it?.lineSale != null
          && Number.isFinite(Number(it.lineSale))) {
        map.set(String(it.costLineId), Number(it.lineSale));
      }
    }
  }
  return map;
}

/**
 * Reproduce la selección que hace el simulator para una fila individual.
 * Devuelve `{ lineSale, factor }` — mismos campos que el render lee.
 */
function resolveLineSaleForRow(args: {
  costLineId: string | null;
  lineCost: number;
  globalFactor: number;       // gSF / gHSF / gSaleFactor / gHechuraSaleFactor
  map: Map<string, number>;
}): { lineSale: number; factor: number; usedCanonical: boolean } {
  const { costLineId, lineCost, globalFactor, map } = args;
  const canonical = costLineId ? map.get(costLineId) : undefined;
  if (canonical != null) {
    const factor = lineCost > 0.0001 ? canonical / lineCost : globalFactor;
    return { lineSale: canonical, factor, usedCanonical: true };
  }
  return { lineSale: lineCost * globalFactor, factor: globalFactor, usedCanonical: false };
}

describe("Simulator — lineSale map builder (POLICY R4.1)", () => {
  it("toma lineSale de metals[] cuando está presente", () => {
    const composition = {
      metals: [
        { costLineId: "m1", lineCost: 300, lineSale: 450 },
        { costLineId: "m2", lineCost: 200, lineSale: 300 },
      ],
      hechuras: [], products: [], services: [],
    };
    const map = buildLineSaleMap(composition);
    expect(map.size).toBe(2);
    expect(map.get("m1")).toBe(450);
    expect(map.get("m2")).toBe(300);
  });

  it("toma lineSale de los 4 buckets simultáneamente", () => {
    const composition = {
      metals:   [{ costLineId: "m1", lineCost: 100, lineSale: 200 }],
      hechuras: [{ costLineId: "h1", lineCost: 50,  lineSale: 75  }],
      products: [{ costLineId: "p1", totalValue: 80,  lineSale: 120 }],
      services: [{ costLineId: "s1", totalValue: 40,  lineSale: 60  }],
    };
    const map = buildLineSaleMap(composition);
    expect(map.size).toBe(4);
    // .sort() default es string-sort; ordenamos numéricamente para comparar.
    expect([...map.values()].sort((a, b) => a - b)).toEqual([60, 75, 120, 200]);
  });

  it("omite entries sin costLineId o sin lineSale (legacy)", () => {
    const composition = {
      metals: [
        { costLineId: "m1", lineCost: 300, lineSale: 450 },  // ok
        { costLineId: null, lineCost: 200, lineSale: 300 }, // sin id → omit
        { costLineId: "m3", lineCost: 100 /* sin lineSale */ }, // omit
        { costLineId: "m4", lineCost: 50, lineSale: "NaN" }, // no finito → omit
      ],
      hechuras: [], products: [], services: [],
    };
    const map = buildLineSaleMap(composition);
    expect(map.size).toBe(1);
    expect(map.get("m1")).toBe(450);
  });

  it("composition null o sin arrays → map vacío", () => {
    expect(buildLineSaleMap(null).size).toBe(0);
    expect(buildLineSaleMap({}).size).toBe(0);
    expect(buildLineSaleMap({ metals: "no-array" }).size).toBe(0);
  });
});

describe("Simulator — resolveLineSaleForRow (per row)", () => {
  it("HECHURA con lineSale canónico → usa lineSale (NO multiplicador legacy)", () => {
    const map = new Map([["h1", 300]]);
    const r = resolveLineSaleForRow({
      costLineId: "h1", lineCost: 200, globalFactor: 1.5, map,
    });
    expect(r.usedCanonical).toBe(true);
    expect(r.lineSale).toBe(300);
    // El factor visible refleja el ratio exacto de la línea (no el global).
    expect(r.factor).toBeCloseTo(1.5, 6);
  });

  it("HECHURA sin lineSale → fallback al multiplicador legacy", () => {
    const map = new Map<string, number>();
    const r = resolveLineSaleForRow({
      costLineId: "h1", lineCost: 200, globalFactor: 1.5, map,
    });
    expect(r.usedCanonical).toBe(false);
    expect(r.lineSale).toBe(300); // 200 × 1.5
    expect(r.factor).toBe(1.5);
  });

  it("PRODUCT con lineSale canónico distinto al global → respeta el canónico", () => {
    // El motor podría aplicar márgenes diferentes por componente en el futuro.
    // Cuando lo haga, el factor canónico difiere del global y el simulador
    // debe respetarlo (no recalcular con el global).
    const map = new Map([["p1", 240]]); // ratio 1.6, distinto del global 1.5
    const r = resolveLineSaleForRow({
      costLineId: "p1", lineCost: 150, globalFactor: 1.5, map,
    });
    expect(r.usedCanonical).toBe(true);
    expect(r.lineSale).toBe(240);
    expect(r.factor).toBeCloseTo(1.6, 6);
  });

  it("METAL con costLineId presente en map → usa canónico", () => {
    const map = new Map([["m1", 750]]);
    const r = resolveLineSaleForRow({
      costLineId: "m1", lineCost: 500, globalFactor: 1.5, map,
    });
    expect(r.usedCanonical).toBe(true);
    expect(r.lineSale).toBe(750);
  });

  it("Fórmula visible: lineCost × factor === lineSale (siempre, ambos paths)", () => {
    // Path canónico
    const mapC = new Map([["x", 333]]);
    const a = resolveLineSaleForRow({ costLineId: "x", lineCost: 250, globalFactor: 1.5, map: mapC });
    expect(250 * a.factor).toBeCloseTo(a.lineSale, 6);

    // Path legacy
    const mapL = new Map<string, number>();
    const b = resolveLineSaleForRow({ costLineId: null, lineCost: 250, globalFactor: 1.5, map: mapL });
    expect(250 * b.factor).toBeCloseTo(b.lineSale, 6);
  });
});

describe("Simulator — paridad agregada (Σ lineSale === total del bucket)", () => {
  it("Σ lineSale de hechuras + products + services === hechuraSale del breakdown", () => {
    // Caso del usuario: factura y simulador muestran números coincidentes
    // cuando el motor emite lineSale per fila.
    const composition = {
      metals: [],
      hechuras: [
        { costLineId: "h1", lineCost: 200, lineSale: 300 },
        { costLineId: "h2", lineCost: 100, lineSale: 150 },
      ],
      products: [
        { costLineId: "p1", totalValue: 150, lineSale: 225 },
      ],
      services: [
        { costLineId: "s1", totalValue: 80,  lineSale: 120 },
      ],
    };
    const map = buildLineSaleMap(composition);

    // Sumando vía resolveLineSaleForRow (mismo path que el render).
    const steps = [
      { key: "COST_LINES_HECHURA", costLineId: "h1", lineCost: 200 },
      { key: "COST_LINES_HECHURA", costLineId: "h2", lineCost: 100 },
      { key: "COST_LINES_PRODUCT", costLineId: "p1", lineCost: 150 },
      { key: "COST_LINES_SERVICE", costLineId: "s1", lineCost: 80  },
    ];
    const sum = steps.reduce((acc, s) => acc + resolveLineSaleForRow({
      costLineId: s.costLineId, lineCost: s.lineCost, globalFactor: 1.5, map,
    }).lineSale, 0);
    // hechuraSale esperado del breakdown = 300 + 150 + 225 + 120 = 795
    expect(Math.abs(sum - 795)).toBeLessThan(0.001);
  });

  it("Σ lineSale de metals === metalSale del breakdown (4 metales)", () => {
    // Caso real Oro 18k/22k/24k/Chafalonia
    const composition = {
      metals: [
        { costLineId: "m1", lineCost: 300, lineSale: 450 },
        { costLineId: "m2", lineCost: 275, lineSale: 412.5 },
        { costLineId: "m3", lineCost: 100, lineSale: 150 },
        { costLineId: "m4", lineCost: 125, lineSale: 187.5 },
      ],
      hechuras: [], products: [], services: [],
    };
    const map = buildLineSaleMap(composition);
    const steps = composition.metals.map(m => ({ costLineId: m.costLineId, lineCost: m.lineCost }));
    const sum = steps.reduce((a, s) => a + resolveLineSaleForRow({
      costLineId: s.costLineId, lineCost: s.lineCost, globalFactor: 1.5, map,
    }).lineSale, 0);
    expect(Math.abs(sum - 1200)).toBeLessThan(0.001);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Factor efectivo vs margen bruto — display de explicación
//
// Reproduce la decisión visual del Simulador:
//   showGrossHint = showTransform && |grossPct - effectivePct| > 0.1 && grossPct > 0.01
// donde:
//   effectivePct = (factor - 1) × 100
//   grossPct     = hechuraMarginPct (lista)
// ─────────────────────────────────────────────────────────────────────────────

function resolveFactorDisplay(args: {
  lineCost: number;
  lineSale: number;
  grossPct: number;       // hechuraMarginPct del breakdown (margen bruto lista)
}): {
  factor: number;
  effectivePct: number;
  showFactorCalc: boolean;
  showGrossHint: boolean;
} {
  const factor = args.lineCost > 0.0001 ? args.lineSale / args.lineCost : 1;
  const effectivePct = (factor - 1) * 100;
  const showFactorCalc = Math.abs(factor - 1) > 0.005 && args.lineCost > 0.0001;
  const showGrossHint = showFactorCalc
                     && Math.abs(args.grossPct - effectivePct) > 0.1
                     && args.grossPct > 0.01;
  return { factor, effectivePct, showFactorCalc, showGrossHint };
}

describe("Simulator — factor efectivo vs margen bruto", () => {
  it("factor coincide con margen bruto → NO muestra hint (caso normal)", () => {
    // Lista hechura 50%, sin ajustes → effectivePct = 50%, grossPct = 50%.
    const r = resolveFactorDisplay({ lineCost: 200, lineSale: 300, grossPct: 50 });
    expect(r.factor).toBeCloseTo(1.5, 6);
    expect(r.effectivePct).toBeCloseTo(50, 6);
    expect(r.showFactorCalc).toBe(true);
    expect(r.showGrossHint).toBe(false);  // sin hint
  });

  it("ajuste de costo BONUS reduce el efectivo → muestra hint", () => {
    // Lista +50%, pero motor aplicó ajuste global BONUS sobre el costo
    // → effectivePct (en el lineSale propagado) ≠ 50%.
    // Caso del usuario: $316.840 → $356.445 = factor 1.125, lista marcaba +50%.
    const r = resolveFactorDisplay({ lineCost: 316840, lineSale: 356445, grossPct: 50 });
    expect(r.factor).toBeCloseTo(1.125, 3);
    expect(r.effectivePct).toBeCloseTo(12.5, 1);
    expect(r.showFactorCalc).toBe(true);
    expect(r.showGrossHint).toBe(true);   // efectivo ≠ bruto → SÍ hint
  });

  it("factor exactamente 1 (sin margen) → no muestra calc ni hint", () => {
    const r = resolveFactorDisplay({ lineCost: 200, lineSale: 200, grossPct: 0 });
    expect(r.factor).toBe(1);
    expect(r.showFactorCalc).toBe(false);
    expect(r.showGrossHint).toBe(false);
  });

  it("diferencia minúscula (<0.1pp) entre efectivo y bruto → no muestra hint", () => {
    // 200 × 1.5001 = 300.02 → effectivePct = 50.01%. Diferencia 0.01pp < 0.1pp.
    const r = resolveFactorDisplay({ lineCost: 200, lineSale: 300.02, grossPct: 50 });
    expect(r.showGrossHint).toBe(false);
  });

  it("lista sin margen (gross=0) pero factor distinto de 1 → no muestra hint", () => {
    // Lista MARGIN_TOTAL u otro modo sin desglose: grossPct podría llegar 0
    // por falta de info, pero el factor efectivo viene del breakdown.
    // No mostramos hint para evitar leyenda confusa "lista +0%".
    const r = resolveFactorDisplay({ lineCost: 200, lineSale: 300, grossPct: 0 });
    expect(r.showGrossHint).toBe(false);
  });
});

describe("Simulator — el factor visible es siempre lineSale/lineCost (efectivo)", () => {
  it("nunca se muestra el margen bruto como factor multiplicativo", () => {
    // Lista 50%, pero motor emite lineSale=356445 sobre lineCost=316840.
    // El simulador DEBE mostrar 1.13 (efectivo), no 1.50 (bruto).
    const r = resolveFactorDisplay({ lineCost: 316840, lineSale: 356445, grossPct: 50 });
    // Verifica que el factor mostrado es el efectivo, no el bruto.
    expect(r.factor).not.toBeCloseTo(1.5, 1);
    expect(r.factor).toBeCloseTo(1.125, 2);
  });

  it("paridad: lineCost × factor === lineSale (display siempre consistente)", () => {
    const r = resolveFactorDisplay({ lineCost: 316840, lineSale: 356445, grossPct: 50 });
    expect(316840 * r.factor).toBeCloseTo(356445, 0);
  });
});

describe("Simulator — retrocompat snapshots legacy", () => {
  it("snapshot pre v7 (sin composition / sin lineSale) → fallback funciona", () => {
    // Simula un response viejo del backend donde composition existe pero sin lineSale.
    const composition = {
      metals: [{ costLineId: "m1", lineCost: 300 }],
      hechuras: [{ costLineId: "h1", lineCost: 200 }],
      products: [], services: [],
    };
    const map = buildLineSaleMap(composition);
    expect(map.size).toBe(0);  // nada cargado

    // Simulador cae al multiplicador legacy
    const r = resolveLineSaleForRow({ costLineId: "h1", lineCost: 200, globalFactor: 1.5, map });
    expect(r.usedCanonical).toBe(false);
    expect(r.lineSale).toBe(300);
  });

  it("snapshot v3 (sin composition entera) → map vacío, todo fallback", () => {
    const map = buildLineSaleMap(null);
    const r = resolveLineSaleForRow({ costLineId: null, lineCost: 100, globalFactor: 1.5, map });
    expect(r.lineSale).toBe(150);
    expect(r.usedCanonical).toBe(false);
  });
});
