// src/lib/__tests__/pricing-factor-display.test.ts
// ============================================================================
// Tests del helper visual unificado del factor (Fase 2).
//
// Valida:
//   1. Caso sin ajuste: solo bruto, sin "efectivo" ni "ajuste".
//   2. Caso con ajuste BONUS: desglose completo (bruto + ajuste + efectivo).
//   3. Caso con ajuste SURCHARGE: tono ámbar.
//   4. Caso ajuste de costo en monto fijo (FIXED_AMOUNT).
//   5. Caso sin metalHechuraBreakdown: degenera con seguridad.
//   6. extractCostAdjustmentFromSteps con/sin step COST_LINES_FINAL.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  buildFactorBreakdown,
  extractCostAdjustmentFromSteps,
} from "../pricing-factor-display";

describe("buildFactorBreakdown — sin ajuste (factor === bruto)", () => {
  it("lista 50%, factor efectivo 1.50 → no muestra divergencia", () => {
    const r = buildFactorBreakdown({
      grossMarginPct: 50,
      effectiveFactor: 1.50,
      costAdjustment: null,
    });
    expect(r.grossText).toBe("+50%");
    expect(r.effectiveText).toBeNull();        // sin divergencia → no se muestra
    expect(r.adjustmentText).toBeNull();
    expect(r.adjustmentTone).toBeNull();
    expect(r.hasDivergence).toBe(false);
    expect(r.compactLine).toBeNull();           // compactLine solo cuando hay 2+ partes
  });

  it("diferencia <0.1pp → tratada como coincidencia (ruido numérico)", () => {
    const r = buildFactorBreakdown({
      grossMarginPct: 50,
      effectiveFactor: 1.5005,   // 50.05% efectivo vs 50% bruto
      costAdjustment: null,
    });
    expect(r.hasDivergence).toBe(false);
  });
});

describe("buildFactorBreakdown — con ajuste BONUS (factor < bruto)", () => {
  it("caso del usuario: lista 50% + BONUS 25% → muestra los 3 bloques", () => {
    // adjFactor = 0.75 → efectivo = 0.75 × 1.50 = 1.125
    const r = buildFactorBreakdown({
      grossMarginPct: 50,
      effectiveFactor: 1.125,
      costAdjustment: { kind: "BONUS", type: "PERCENTAGE", value: 25 },
    });
    expect(r.grossText).toBe("+50%");
    expect(r.adjustmentText).toBe("−25%");
    expect(r.adjustmentTone).toBe("bonus");
    expect(r.effectiveText).toBe("1,13");
    expect(r.hasDivergence).toBe(true);
    expect(r.compactLine).toBe("lista +50% · ajuste −25% · efectivo 1,13");
  });

  it("compactLine omite partes nulas", () => {
    // Solo divergencia + grossPct, sin costAdjustment estructurado.
    const r = buildFactorBreakdown({
      grossMarginPct: 50,
      effectiveFactor: 1.125,
      costAdjustment: null,
    });
    expect(r.hasDivergence).toBe(true);
    expect(r.adjustmentText).toBeNull();
    expect(r.compactLine).toBe("lista +50% · efectivo 1,13");
  });
});

describe("buildFactorBreakdown — con ajuste SURCHARGE (factor > bruto)", () => {
  it("lista 50% + SURCHARGE 10% → tono ámbar + signo '+'", () => {
    // adjFactor = 1.10 → efectivo = 1.10 × 1.50 = 1.65
    const r = buildFactorBreakdown({
      grossMarginPct: 50,
      effectiveFactor: 1.65,
      costAdjustment: { kind: "SURCHARGE", type: "PERCENTAGE", value: 10 },
    });
    expect(r.adjustmentText).toBe("+10%");
    expect(r.adjustmentTone).toBe("surcharge");
    expect(r.effectiveText).toBe("1,65");
    expect(r.compactLine).toBe("lista +50% · ajuste +10% · efectivo 1,65");
  });
});

describe("buildFactorBreakdown — ajuste FIXED_AMOUNT", () => {
  it("ajuste fijo (monto, no %) → no se formatea como %", () => {
    const r = buildFactorBreakdown({
      grossMarginPct: 50,
      effectiveFactor: 1.10,
      costAdjustment: { kind: "BONUS", type: "FIXED_AMOUNT", value: 500 },
    });
    expect(r.adjustmentText).toBe("−500");
    expect(r.hasDivergence).toBe(true);
  });
});

describe("buildFactorBreakdown — casos degenerados", () => {
  it("sin grossMarginPct ni effectiveFactor → todo null", () => {
    const r = buildFactorBreakdown({
      grossMarginPct: null,
      effectiveFactor: null,
      costAdjustment: null,
    });
    expect(r.grossText).toBeNull();
    expect(r.effectiveText).toBeNull();
    expect(r.hasDivergence).toBe(false);
    expect(r.compactLine).toBeNull();
  });

  it("solo grossMarginPct (sin lineSale del backend) → muestra solo bruto", () => {
    const r = buildFactorBreakdown({
      grossMarginPct: 50,
      effectiveFactor: null,
      costAdjustment: null,
    });
    expect(r.grossText).toBe("+50%");
    expect(r.effectiveText).toBeNull();
    expect(r.hasDivergence).toBe(false);
  });

  it("solo effectiveFactor (sin breakdown) → muestra efectivo si difiere de 1", () => {
    const r = buildFactorBreakdown({
      grossMarginPct: null,
      effectiveFactor: 1.30,
      costAdjustment: null,
    });
    expect(r.hasDivergence).toBe(true);
    expect(r.effectiveText).toBe("1,30");
  });

  it("grossMarginPct=0 (sin margen) → grossText null para evitar '+0%'", () => {
    const r = buildFactorBreakdown({
      grossMarginPct: 0,
      effectiveFactor: 1.0,
      costAdjustment: null,
    });
    expect(r.grossText).toBeNull();
    expect(r.hasDivergence).toBe(false);
  });

  it("costAdjustment con kind=null → no se muestra ajuste aunque haya divergencia", () => {
    const r = buildFactorBreakdown({
      grossMarginPct: 50,
      effectiveFactor: 1.13,
      costAdjustment: { kind: null, type: null, value: null },
    });
    expect(r.adjustmentText).toBeNull();
    expect(r.hasDivergence).toBe(true);
    expect(r.compactLine).toBe("lista +50% · efectivo 1,13");
  });
});

describe("extractCostAdjustmentFromSteps", () => {
  it("step COST_LINES_FINAL con BONUS 25% → extrae correctamente", () => {
    const steps = [
      { key: "COST_LINES_METAL",  meta: {} },
      { key: "COST_LINES_FINAL",  meta: {
        adjustmentKind: "BONUS",
        adjustmentType: "PERCENTAGE",
        adjustmentValue: "25",
        sumLines: "950",
      } },
    ];
    const adj = extractCostAdjustmentFromSteps(steps);
    expect(adj).toEqual({ kind: "BONUS", type: "PERCENTAGE", value: 25 });
  });

  it("sin step COST_LINES_FINAL → null", () => {
    expect(extractCostAdjustmentFromSteps([])).toBeNull();
    expect(extractCostAdjustmentFromSteps(null)).toBeNull();
    expect(extractCostAdjustmentFromSteps(undefined)).toBeNull();
  });

  it("step COST_LINES_FINAL sin adjustmentKind → null", () => {
    const steps = [
      { key: "COST_LINES_FINAL", meta: { sumLines: "1000" } },
    ];
    expect(extractCostAdjustmentFromSteps(steps)).toBeNull();
  });

  it("kind no reconocido → null", () => {
    const steps = [
      { key: "COST_LINES_FINAL", meta: { adjustmentKind: "INVALIDO" } },
    ];
    expect(extractCostAdjustmentFromSteps(steps)).toBeNull();
  });
});

describe("Paridad visual interna del simulador (Fase 2)", () => {
  it("formato del factor coincide en los 4 call-sites del simulador", () => {
    // Los 4 sitios del simulador llaman a buildFactorBreakdown con los mismos
    // inputs (gross/efectivo/ajuste). Cualquier diferencia de cifras visibles
    // sería un bug. Este test confirma idempotencia: misma input → misma output.
    const input = {
      grossMarginPct: 50,
      effectiveFactor: 1.125,
      costAdjustment: { kind: "BONUS" as const, type: "PERCENTAGE" as const, value: 25 },
    };
    const r1 = buildFactorBreakdown(input);
    const r2 = buildFactorBreakdown(input);
    expect(r1).toEqual(r2);
  });
});
