// src/components/sales/TotalDelComprobanteCard/__tests__/sumLineCommercialMetalRoundingImpact.test.ts
// ============================================================================
// Tests de los helpers PUROS del dominio METAL para el footer MIXED:
//   · sumLineCommercialMetalRoundingImpact  → Σ impacto $ redondeo metal
//   · groupLineCommercialMetalRoundingByParent → mapa metalParentName → Σ
// Fuente: `lineCommercialSummary.metals.byParent[].roundingImpact` (fallback
// `metals.roundingImpact`, fallback legacy `metalRoundingMonetaryImpact`).
// Passthrough (Σ) — cero matemática comercial.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  sumLineCommercialMetalRoundingImpact,
  groupLineCommercialMetalRoundingByParent,
} from "../helpers";

const lineByParent = (entries: Array<[string, number]>) => ({
  lineCommercialSummary: {
    metals: { byParent: entries.map(([metalParentName, roundingImpact]) => ({ metalParentName, roundingImpact })) },
  },
});

describe("sumLineCommercialMetalRoundingImpact — cadena canónica AUTÓNOMA", () => {
  it("primary: metals.roundingHelper (agregado autónomo) — Σ across líneas", () => {
    const r = sumLineCommercialMetalRoundingImpact([
      { lineCommercialSummary: { metals: { roundingImpact: 2650, byParent: [] } } },
      { lineCommercialSummary: { metals: { roundingImpact: 150, byParent: [] } } },
    ]);
    expect(r).toBe(2800);
  });

  it("PRIORIDAD #1: lineCommercialDisplaySummary (2650 autónomo) gana a lineCommercialSummary (675 contaminado)", () => {
    // Caso real MIXED: display preserva el valor de línea, summary se contamina.
    const r = sumLineCommercialMetalRoundingImpact([
      {
        lineCommercialDisplaySummary: { metals: { roundingImpact: 2650, byParent: [] } },
        lineCommercialSummary:        { metals: { roundingImpact: 675,  byParent: [] } },
      },
    ]);
    expect(r).toBe(2650);   // ← display (autónomo), NO summary (contaminado)
  });

  it("fallback 2: lineOwnMetalRoundingMonetaryImpact (autónomo) cuando no hay summary.metals", () => {
    const r = sumLineCommercialMetalRoundingImpact([{ lineOwnMetalRoundingMonetaryImpact: 2650 }]);
    expect(r).toBe(2650);
  });

  it("fallback 3: metalHechuraBreakdown.metalSaleRoundingDelta (PER_LINE motor)", () => {
    const r = sumLineCommercialMetalRoundingImpact([{ metalHechuraBreakdown: { metalSaleRoundingDelta: 12.5 } }]);
    expect(r).toBe(12.5);
  });

  it("❌ NUNCA usa metalRoundingMonetaryImpact (prorrateo documental) → null", () => {
    // El campo prohibido (+675 prorrateado) NO debe alimentar el footer.
    const r = sumLineCommercialMetalRoundingImpact([{ metalRoundingMonetaryImpact: 675 }]);
    expect(r).toBeNull();
  });

  it("caso real MIXED: card 2.650 (lineOwn) gana al prorrateo 675 (metalRoundingMonetaryImpact)", () => {
    const r = sumLineCommercialMetalRoundingImpact([
      { lineOwnMetalRoundingMonetaryImpact: 2650, metalRoundingMonetaryImpact: 675 },
    ]);
    expect(r).toBe(2650);   // ← autónomo, NO el prorrateo
  });

  it("preserva negativos (redondeo hacia abajo), sin clamp", () => {
    const r = sumLineCommercialMetalRoundingImpact([{ lineOwnMetalRoundingMonetaryImpact: -80.14 }]);
    expect(r).toBe(-80.14);
  });

  it("lee lineOwn desde pricingMeta (draft)", () => {
    const r = sumLineCommercialMetalRoundingImpact([
      { pricingMeta: { lineOwnMetalRoundingMonetaryImpact: 7.2 } },
    ]);
    expect(r).toBe(7.2);
  });

  it("null cuando ninguna línea aporta metal autónomo (back-compat)", () => {
    expect(sumLineCommercialMetalRoundingImpact([{ foo: 1 }, null, "x"])).toBeNull();
  });
});

describe("groupLineCommercialMetalRoundingByParent", () => {
  it("agrupa por metalParentName sumando across líneas", () => {
    const r = groupLineCommercialMetalRoundingByParent([
      lineByParent([["Oro", 5300], ["Plata", 50]]),
      lineByParent([["Oro", 200]]),
    ]);
    expect(r).toEqual({ Oro: 5500, Plata: 50 });
  });

  it("preserva negativos por padre", () => {
    const r = groupLineCommercialMetalRoundingByParent([lineByParent([["Oro", -19.86]])]);
    expect(r).toEqual({ Oro: -19.86 });
  });

  it("fallback a lineCommercialRoundingMetals[] (monetaryImpact) cuando no hay byParent", () => {
    const r = groupLineCommercialMetalRoundingByParent([
      { lineCommercialRoundingMetals: [{ metalParentName: "Oro", monetaryImpact: 2650 }] },
    ]);
    expect(r).toEqual({ Oro: 2650 });
  });

  it("lee lineCommercialRoundingMetals desde pricingMeta (draft)", () => {
    const r = groupLineCommercialMetalRoundingByParent([
      { pricingMeta: { lineCommercialRoundingMetals: [{ metalParentName: "Plata", monetaryImpact: 30 }] } },
    ]);
    expect(r).toEqual({ Plata: 30 });
  });

  it("undefined cuando ninguna línea aporta", () => {
    expect(groupLineCommercialMetalRoundingByParent([{ foo: 1 }])).toBeUndefined();
  });
});
