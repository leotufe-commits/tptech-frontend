// src/components/sales/TotalDelComprobanteCard/__tests__/MonetarySummary.unified-rounding.test.tsx
// =============================================================================
// I2-UNIFIED — Tests del fallback "Redondeo financiero" UNIFICADO.
//
// En la capa 16, cuando el redondeo financiero del tenant opera en modo
// UNIFICADO, el delta NO se emite como component `ROUNDING_MONETARY` — queda
// solo en `documentRoundingApplied.unified.adjustment`. Sin un fallback, el
// footer mostraba el total ya redondeado sin renglón que lo explique.
//
// Este fallback renderiza un renglón "Redondeo financiero" con el delta
// unificado (passthrough puro). Guard: |adjustment| > 0.005, sin component
// ROUNDING_MONETARY, y NO BREAKDOWN.
//
// Cero matemática local — el adjustment viene del backend.
// =============================================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MonetarySummary, type DocumentRoundingAppliedSummary } from "../parts/MonetarySummary";
import type { GroupedComponents } from "../helpers";

// IMPORTANTE — shape REAL de la capa 16 en UNIFICADO: `breakdown` NO es `null`,
// es un objeto VACÍO (`metal:null`, `hechura:null`, `metalPhysical.metals:[]`).
// Por eso el guard NO puede usar `breakdown != null` para distinguir UNIFIED de
// BREAKDOWN — debe mirar `scope`. (El bug original: `breakdown != null` daba true
// y el fallback no se renderizaba.)
function makeUnifiedSnapshot(adjustment: number): DocumentRoundingAppliedSummary {
  return {
    scope: "UNIFIED",
    totalAdjustment: adjustment,
    unified: { mode: "HUNDRED", direction: "NEAREST", adjustment },
    breakdown: {
      metal: null,
      hechura: null,
      metalDomain: "PHYSICAL",
      metalPhysical: { metals: [], metalMonetaryEquivalent: 0 },
    },
  };
}

describe("MonetarySummary — I2-UNIFIED fallback redondeo financiero unificado", () => {
  it("UNIFIED con adjustment significativo + saldo unificado → renderiza renglón 'Redondeo financiero'", () => {
    const groups: GroupedComponents[] = []; // motor NO emitió ROUNDING_MONETARY en unificado
    render(
      <MonetarySummary
        groups={groups}
        displayCurrency="ARS"
        documentRoundingApplied={makeUnifiedSnapshot(13.68)}
        isBreakdown={false}
        totalDocument={200013.68}
      />,
    );
    const section = screen.getByTestId("total-card-rounding-unified-section");
    expect(section).toBeTruthy();
    expect(section.getAttribute("data-tp-rounding-source")).toBe("DOCUMENT");
    expect(section.textContent).toMatch(/Redondeo financiero/);
    // Caption derivado de buildComprobanteCaption ("Total HUNDRED")
    expect(section.textContent).toMatch(/Total HUNDRED/);
    const amount = screen.getByTestId("total-card-rounding-unified-amount");
    expect(amount.textContent).toMatch(/13[.,]?68/);
  });

  it("BREAKDOWN → NO muestra el fallback unificado (metal/saldo ya se muestran)", () => {
    const groups: GroupedComponents[] = [];
    const breakdownSnapshot: DocumentRoundingAppliedSummary = {
      scope: "BREAKDOWN",
      totalAdjustment: 47400,
      breakdown: {
        metal: null,
        hechura: null,
        metalDomain: "PHYSICAL",
        metalPhysical: {
          metals: [{
            metalParentId: "oro-fino",
            metalParentName: "Oro Fino",
            preGrams: 1.526,
            postGrams: 2.0,
            deltaGrams: 0.474,
            metalPricePerGram: 100000,
            monetaryEquivalent: 47400,
          }],
          metalMonetaryEquivalent: 47400,
        },
      },
    };
    render(
      <MonetarySummary
        groups={groups}
        displayCurrency="ARS"
        documentRoundingApplied={breakdownSnapshot}
        totalDocument={200000}
      />,
    );
    // El fallback unificado NO aparece
    expect(screen.queryByTestId("total-card-rounding-unified-section")).toBeNull();
    // Pero el metal físico (I2 PHYSICAL) SÍ
    expect(screen.getByTestId("total-card-rounding-physical-section")).toBeTruthy();
  });

  it("con component ROUNDING_MONETARY → NO duplica (RoundingRow ya lo muestra)", () => {
    const groups: GroupedComponents[] = [{
      group: "ROUNDING" as any,
      components: [{
        type: "ROUNDING_MONETARY" as any,
        label: "Redondeo",
        amount: 13.68,
      } as any],
    }];
    render(
      <MonetarySummary
        groups={groups}
        displayCurrency="ARS"
        documentRoundingApplied={makeUnifiedSnapshot(13.68)}
        isBreakdown={false}
        totalDocument={200013.68}
      />,
    );
    // El fallback NO debe aparecer (ya hay RoundingRow)
    expect(screen.queryByTestId("total-card-rounding-unified-section")).toBeNull();
    // El RoundingRow SÍ
    expect(screen.getByTestId("total-card-component-ROUNDING_MONETARY")).toBeTruthy();
  });

  it("unified.adjustment ~0 → NO muestra el fallback (degradación segura)", () => {
    const groups: GroupedComponents[] = [];
    render(
      <MonetarySummary
        groups={groups}
        displayCurrency="ARS"
        documentRoundingApplied={makeUnifiedSnapshot(0)}
        isBreakdown={false}
        totalDocument={200000}
      />,
    );
    expect(screen.queryByTestId("total-card-rounding-unified-section")).toBeNull();
  });

  it("sin documentRoundingApplied → NO muestra el fallback", () => {
    const groups: GroupedComponents[] = [];
    render(
      <MonetarySummary
        groups={groups}
        displayCurrency="ARS"
        isBreakdown={false}
        totalDocument={200000}
      />,
    );
    expect(screen.queryByTestId("total-card-rounding-unified-section")).toBeNull();
  });

  it("adjustment negativo → renderiza con signo (sin clamp)", () => {
    const groups: GroupedComponents[] = [];
    render(
      <MonetarySummary
        groups={groups}
        displayCurrency="ARS"
        documentRoundingApplied={makeUnifiedSnapshot(-86.32)}
        isBreakdown={false}
        totalDocument={199913.68}
      />,
    );
    const amount = screen.getByTestId("total-card-rounding-unified-amount");
    expect(amount.textContent).toMatch(/86[.,]?32/);
    // signo menos tipográfico
    expect(amount.textContent).toMatch(/−/);
  });
});
