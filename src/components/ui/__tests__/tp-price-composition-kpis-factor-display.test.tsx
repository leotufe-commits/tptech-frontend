// src/components/ui/__tests__/tp-price-composition-kpis-factor-display.test.tsx
// ============================================================================
// Fase 3 — paridad visual entre simulador, comparador y factura.
//
// Verifica que `TPPriceCompositionKpis` (usado en factura, panel de venta,
// preview y comparador) muestra el mismo desglose `lista +X% · ajuste · efectivo`
// que el simulador cuando hay ajuste global de costo. Sin ajuste, mantiene el
// formato anterior (retrocompat).
//
// El helper `buildFactorBreakdown` (testeado en pricing-factor-display.test.ts)
// es la fuente de verdad del texto visual; este test confirma que el componente
// efectivamente lo usa y muestra `compactLine` cuando difieren.
// ============================================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TPPriceCompositionKpis from "../TPPriceCompositionKpis";

const mhbBase = {
  metalCost: 375,
  metalSale: 412.5,   // factor 1.10 (margen literal lista)
  metalMarginPct: 10,
  hechuraCost: 337.5,
  hechuraSale: 506.25, // factor 1.50 (margen literal lista)
  hechuraMarginPct: 50,
};

describe("TPPriceCompositionKpis — Fase 3 factor display", () => {
  it("sin costAdjustment → NO muestra desglose extendido (retrocompat)", () => {
    render(
      <TPPriceCompositionKpis
        metalHechuraBreakdown={mhbBase}
        marginPercent={50}
        view="sale"
        mode="invoice"
        currencySymbol="$"
      />
    );
    // Debe mostrar la fórmula con margen bruto.
    expect(screen.queryByText(/lista \+50,00%|lista \+50%/)).toBeTruthy();
    // Sin costAdjustment, no debe aparecer la línea "ajuste".
    expect(screen.queryByText(/ajuste/i)).toBeNull();
  });

  it("con costAdjustment BONUS 25% → muestra desglose lista · ajuste · efectivo", () => {
    // Caso del usuario: lista 50%, BONUS 25%, factor efectivo 1.13.
    // Para que difiera, simulamos hechuraSale POST-ajuste.
    const mhbWithAdj = {
      ...mhbBase,
      // Pretendemos que el motor ya aplicó BONUS 25% (factor 0.75 × 1.50 = 1.125):
      // hechuraCost=337.5 (post-ajuste), hechuraSale=506.25 (literal × 1.50)
      // → desde la perspectiva del usuario es coherente (factor 1.50 sobre cost post).
      // Pero si interpretamos hechuraCost como PRE-ajuste y hechuraSale como post,
      // el factor efectivo sería ~0.84... el caso real lo veremos con
      // hechuraCost preservando el pre-ajuste:
      hechuraCost: 450,         // pre-ajuste (Σ raw cost-lines no metal)
      hechuraSale: 506.25,      // post-ajuste × margen literal = 337.5 × 1.50
      hechuraMarginPct: 50,
    };
    render(
      <TPPriceCompositionKpis
        metalHechuraBreakdown={mhbWithAdj}
        marginPercent={50}
        view="sale"
        mode="invoice"
        currencySymbol="$"
        costAdjustment={{ kind: "BONUS", type: "PERCENTAGE", value: 25 }}
      />
    );
    // Debe aparecer el desglose unificado (mismo formato que el simulador).
    const compactRegex = /lista \+50% · ajuste −25% · efectivo/;
    expect(screen.queryByText(compactRegex)).toBeTruthy();
  });

  it("paridad visual con simulador: mismo helper, mismo texto", () => {
    // El componente usa `buildFactorBreakdown` (mismo helper que el simulador).
    // Por construcción, dada la misma entrada, ambos producen el mismo texto.
    // Este test es una "regression guard": si alguien introduce otro formatter,
    // se rompe.
    const mhb = {
      metalCost: 1000, metalSale: 1100, metalMarginPct: 10,
      hechuraCost: 1000, hechuraSale: 1125, hechuraMarginPct: 50,
    };
    render(
      <TPPriceCompositionKpis
        metalHechuraBreakdown={mhb}
        marginPercent={20}
        view="sale"
        mode="invoice"
        currencySymbol="$"
        costAdjustment={{ kind: "BONUS", type: "PERCENTAGE", value: 25 }}
      />
    );
    // El texto debe seguir el patrón exacto del helper: "lista +X% · ajuste −Y% · efectivo Z"
    // (mismo separador, mismo signo unicode, mismo formato).
    expect(screen.queryByText(/lista \+\d+% · ajuste [+−]\d+% · efectivo \d/)).toBeTruthy();
  });

  it("hechuraSale === hechuraCost (margen 0) → NO muestra desglose", () => {
    const mhbNoMargin = {
      metalCost: 100, metalSale: 100, metalMarginPct: 0,
      hechuraCost: 100, hechuraSale: 100, hechuraMarginPct: 0,
    };
    render(
      <TPPriceCompositionKpis
        metalHechuraBreakdown={mhbNoMargin}
        marginPercent={0}
        view="sale"
        mode="invoice"
        currencySymbol="$"
        costAdjustment={{ kind: "BONUS", type: "PERCENTAGE", value: 25 }}
      />
    );
    // Sin diferencia entre cost y sale, no se renderiza la fórmula del factor.
    expect(screen.queryByText(/ajuste/i)).toBeNull();
  });

  it("vista 'cost' (no sale) → NO renderiza fórmula del factor", () => {
    render(
      <TPPriceCompositionKpis
        metalHechuraBreakdown={mhbBase}
        marginPercent={50}
        view="cost"
        mode="invoice"
        currencySymbol="$"
        costAdjustment={{ kind: "BONUS", type: "PERCENTAGE", value: 25 }}
      />
    );
    // Vista costo no muestra factor.
    expect(screen.queryByText(/lista \+/)).toBeNull();
  });
});
