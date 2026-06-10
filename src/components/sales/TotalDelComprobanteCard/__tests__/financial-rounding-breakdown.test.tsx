// src/components/sales/TotalDelComprobanteCard/__tests__/financial-rounding-breakdown.test.tsx
// =============================================================================
// Etapa UX — REDONDEO FINANCIERO en SALDO DESGLOSADO (2026-06).
//
// Regla funcional: en DESGLOSADO, si existe redondeo financiero, AMBOS
// patrimonios deben reflejar su impacto:
//   · METALES   → sub-fila "Redondeo financiero" (gramos físicos · equivalente).
//   · MONETARIO → fila "Redondeo financiero" (parte no-metal del saldo).
// El impacto ya está absorbido en el total/saldo por el backend (capa 16); el
// frontend SOLO lo expone (passthrough — sin recalcular).
//
// Validaciones:
//   1. CON redondeo financiero → metales y monetario muestran su línea.
//   2. SIN redondeo financiero → ninguna línea financiera (comportamiento
//      previo intacto).
//   3. UNIFICADO → sin patrimonios desglosados (sin regresión).
// =============================================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TotalDelComprobanteCard } from "../TotalDelComprobanteCard";
import type { BalanceBreakdownDTO } from "../../../../services/sales";

const noop = () => undefined;

function bdOro(): BalanceBreakdownDTO {
  return {
    metals: [
      { metalParentId: "oro", metalParentName: "Oro", gramsPure: 6.9, valuationMonetary: 1717031.25 } as any,
    ],
    monetaryBalance: {
      amount: -52296.25,
      currencyCode: "ARS",
      currencyRate: 1,
      amountBase: -52296.25,
      components: [{ type: "HECHURA", group: "HECHURA", label: "Hechura", amount: -52296.25 }],
    },
  };
}

// Snapshot del REDONDEO FINANCIERO (tenant) en BREAKDOWN PHYSICAL: parte metal
// (gramos físicos) + parte hechura/monetaria.
const finSnap = {
  scope: "BREAKDOWN" as const,
  totalAdjustment: 4012.29,
  breakdown: {
    metalDomain: "PHYSICAL" as const,
    hechura: { mode: "HUNDRED", direction: "NEAREST", adjustment: 24.79 },
    metalPhysical: {
      metals: [
        {
          metalParentId: "oro",
          metalParentName: "Oro",
          preGrams: 6.85,
          postGrams: 6.9,
          deltaGrams: 0.05,
          metalPricePerGram: 79750,
          monetaryEquivalent: 3987.5,
        },
      ],
      metalMonetaryEquivalent: 3987.5,
    },
  },
};

function renderBreakdown(withFinancial: boolean) {
  render(
    <TotalDelComprobanteCard
      totalDocument={1668722.5}
      currencyCode="ARS"
      balanceMode="BREAKDOWN"
      balanceModeSource="PRICELIST_DEFAULT"
      balanceBreakdown={bdOro()}
      metalSaleByParent={{ Oro: 1717031.25 }}
      commercialMetalValueByParent={{ Oro: 1717031.25 }}
      documentRoundingSnapshot={withFinancial ? (finSnap as any) : null}
      onBalanceModeOverrideChange={noop}
      engineTotal={1668722.5}
    />,
  );
}

describe("Redondeo financiero — DESGLOSADO con impacto en ambos patrimonios", () => {
  it("1) METALES muestra la sub-fila de redondeo financiero (gramos físicos)", () => {
    renderBreakdown(true);
    expect(screen.getByTestId("total-card-metal-oro-financial")).toBeTruthy();
  });

  it("1) MONETARIO muestra la fila de redondeo financiero con su impacto", () => {
    renderBreakdown(true);
    const fin = screen.getByTestId("total-card-monetary-financial-impact");
    expect(fin).toBeTruthy();
    expect(fin.textContent).toMatch(/24[.,]79/);
  });
});

describe("Redondeo financiero — DESGLOSADO sin redondeo (comportamiento intacto)", () => {
  it("2) NO renderiza líneas de redondeo financiero", () => {
    renderBreakdown(false);
    expect(screen.queryByTestId("total-card-metal-oro-financial")).toBeNull();
    expect(screen.queryByTestId("total-card-monetary-financial-impact")).toBeNull();
  });
});

describe("Redondeo financiero — UNIFICADO sin regresión", () => {
  it("3) UNIFICADO no muestra patrimonios desglosados ni línea financiera monetaria", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={943000}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceModeSource="TENANT_DEFAULT"
        balanceBreakdown={{
          metals: [],
          monetaryBalance: { amount: 943000, currencyCode: "ARS", currencyRate: 1, amountBase: 943000, components: [{ type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 943000 }] },
        }}
        documentRoundingSnapshot={finSnap as any}
        onBalanceModeOverrideChange={noop}
        engineTotal={943000}
      />,
    );
    expect(screen.queryByTestId("total-card-metals-section")).toBeNull();
    expect(screen.queryByTestId("total-card-monetary-financial-impact")).toBeNull();
  });
});
