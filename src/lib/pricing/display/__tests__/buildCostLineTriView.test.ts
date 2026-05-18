// src/lib/pricing/display/__tests__/buildCostLineTriView.test.ts
// ============================================================================
// Tests del helper unificado de la tabla "Composición del costo del artículo".
//
// Cubre las REGLAS FUNCIONALES DEFINITIVAS:
//   1. Costo unit. → SOLO base (sin merma/ajuste/impacto).
//   2. Merma/Ajuste → nivel A (ingresado) + nivel B (impacto del motor).
//   3. Costo total → passthrough del motor.
//   · No recálculo: el impacto se LEE de adjAmount; nunca se reconstruye.
//   · Paridad: el mismo input produce la misma vista (Simulador == Factura).
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  buildCostLineTriView,
  costLineTriFromStep,
} from "../saleCompositionDisplay";

describe("buildCostLineTriView", () => {
  it("METAL — Costo unit. es SOLO base (precio/gr pre-merma), merma como nivel A", () => {
    const tri = buildCostLineTriView({
      kind: "METAL", unitBase: 1500, qty: 2, mermaPct: 3, total: 9270,
    });
    expect(tri.base.unit).toBe(1500);   // base, NO incluye merma
    expect(tri.base.qty).toBe(2);
    expect(tri.adjust?.kind).toBe("MERMA");
    expect(tri.adjust?.inputLabel).toBe("Merma 3,00 %");
    expect(tri.adjust?.impact).toBeNull(); // motor no emitió impacto → null
    expect(tri.total).toBe(9270);          // total = passthrough motor
  });

  it("METAL — merma 0 no genera bloque de ajuste", () => {
    const tri = buildCostLineTriView({ kind: "METAL", unitBase: 1500, qty: 1, mermaPct: 0, total: 1500 });
    expect(tri.adjust).toBeNull();
  });

  it("OTHER — Bonif. %: impact = passthrough EXACTO del motor (positivo = reduce)", () => {
    // Convención del motor: BONIF emite POSITIVO. El helper NO cambia el
    // número (passthrough); el signo visual lo decide la presentación.
    const tri = buildCostLineTriView({
      kind: "OTHER", unitBase: 74.76, qty: 1,
      adjKind: "BONUS", adjType: "PERCENTAGE", adjValue: 10,
      adjAmount: 23923.2, total: 215308.8,
    });
    expect(tri.base.unit).toBe(74.76);
    expect(tri.adjust?.inputLabel).toBe("Bonif. 10,00 %");
    expect(tri.adjust?.kind).toBe("BONUS");
    expect(tri.adjust?.impact).toBe(23923.2); // passthrough exacto, sin tocar signo
    expect(tri.total).toBe(215308.8);
  });

  it("OTHER — Recargo fijo: label sin %", () => {
    const tri = buildCostLineTriView({
      kind: "OTHER", unitBase: 100, qty: 1,
      adjKind: "SURCHARGE", adjType: "FIXED_AMOUNT", adjValue: 50,
      adjAmount: 50, total: 150,
    });
    expect(tri.adjust?.inputLabel).toBe("Recargo fijo");
    expect(tri.adjust?.impact).toBe(50);
  });

  it("OTHER — legacy sin lineAdjAmount → impact null (UI muestra '—')", () => {
    const tri = buildCostLineTriView({
      kind: "OTHER", unitBase: 100, qty: 1,
      adjKind: "BONUS", adjType: "PERCENTAGE", adjValue: 10,
      adjAmount: null, total: 90,
    });
    expect(tri.adjust?.inputLabel).toBe("Bonif. 10,00 %");
    expect(tri.adjust?.impact).toBeNull(); // NO se reconstruye
  });

  it("NO recálculo — impact es exactamente adjAmount, aunque no cuadre con base", () => {
    // adjAmount intencionalmente NO derivable de unitBase/adjValue:
    // el helper debe respetarlo tal cual (passthrough), no "corregirlo".
    const tri = buildCostLineTriView({
      kind: "OTHER", unitBase: 100, qty: 1,
      adjKind: "BONUS", adjType: "PERCENTAGE", adjValue: 10,
      adjAmount: -7.77, total: 92.23,
    });
    expect(tri.adjust?.impact).toBe(-7.77);
  });
});

describe("costLineTriFromStep — adapter de shape (passthrough)", () => {
  it("COST_LINES_METAL → base = quotePrice, merma desde meta", () => {
    const tri = costLineTriFromStep(
      { key: "COST_LINES_METAL", value: 9270, meta: { quotePrice: 1500, qty: 2, merma: 3 } },
      "ARS",
    );
    expect(tri.kind).toBe("METAL");
    expect(tri.unitBase).toBe(1500);
    expect(tri.qty).toBe(2);
    expect(tri.mermaPct).toBe(3);
    expect(tri.total).toBe(9270);
  });

  it("COST_LINES_PRODUCT → lee lineAdjAmount del motor (firmado)", () => {
    const tri = costLineTriFromStep(
      {
        key: "COST_LINES_PRODUCT", value: 215308.8,
        meta: {
          unitValue: 74.76, qty: 1,
          lineAdjKind: "BONUS", lineAdjType: "PERCENTAGE", lineAdjValue: 10,
          lineAdjAmount: 23923.2,
        },
      },
      "ARS",
    );
    const view = buildCostLineTriView(tri);
    expect(view.adjust?.inputLabel).toBe("Bonif. 10,00 %");
    expect(view.adjust?.impact).toBe(23923.2);
    expect(view.total).toBe(215308.8);
  });

  it("paridad — el mismo step produce idéntica vista (Simulador == Factura)", () => {
    const step = {
      key: "COST_LINES_SERVICE", value: 31500,
      meta: {
        unitValue: 35000, qty: 1,
        lineAdjKind: "BONUS", lineAdjType: "PERCENTAGE", lineAdjValue: 10,
        lineAdjAmount: 3500, // motor: BONIF positivo (base × %)
      },
    };
    const a = buildCostLineTriView(costLineTriFromStep(step, "ARS"));
    const b = buildCostLineTriView(costLineTriFromStep(step, "ARS"));
    expect(a).toEqual(b);
    expect(a.adjust?.impact).toBe(3500);
  });
});
