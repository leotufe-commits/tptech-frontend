// src/components/sales/TotalDelComprobanteCard/__tests__/desglosado-autocontenido.test.tsx
// =============================================================================
// Etapa UX — SALDO DESGLOSADO AUTOCONTENIDO (2026-06).
//
// Verifica que:
//   1. El modo DESGLOSADO NO renderiza el bloque standalone "Redondeos
//      comerciales" (Opción B — la info vive dentro de cada patrimonio).
//   2. METALES muestra Valor comercial / Redondeo comercial / Valor final metal.
//   3. MONETARIO muestra Valor comercial / Redondeo comercial / Valor final
//      monetario (cuenta autocontenida).
//   4. Los tooltips ⓘ usan trazabilidad (TraceTooltipBody) cuando hay datos.
//   5. El modo UNIFICADO no se altera (sin patrimonio metálico ni cuenta de
//      metal por línea).
// =============================================================================

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TotalDelComprobanteCard } from "../TotalDelComprobanteCard";
import type { BalanceBreakdownDTO } from "../../../../services/sales";

const noop = () => undefined;

function bdOro(): BalanceBreakdownDTO {
  return {
    metals: [
      {
        metalParentId: "oro",
        metalParentName: "Oro",
        gramsPure: 6.9,
        valuationMonetary: 1717031.25,
      } as any,
    ],
    monetaryBalance: {
      amount: -52296.25,
      currencyCode: "ARS",
      currencyRate: 1,
      amountBase: -52296.25,
      components: [
        { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: -52296.25 },
      ],
    },
  };
}

// Snapshot comercial PER_DOCUMENT (Etapa D') con redondeo en metal + hechura.
const crSnap = {
  source: "PRICE_LIST" as const,
  scope:  "BREAKDOWN" as const,
  totalAdjustment: 8069.15,
  breakdown: {
    metals: [
      {
        metalParentId: "oro",
        metalParentName: "Oro",
        preGrams: 6.8,
        postGrams: 6.9,
        deltaGrams: 0.1,
        metalPricePerGram: 79750,
        monetaryEquivalent: 7975,
        mode: "DECIMAL_1",
        direction: "NEAREST",
      },
    ],
    metalMonetaryEquivalent: 7975,
    hechura: {
      preRoundingSaldoMonetario: -52391.11,
      postRoundingSaldoMonetario: -52296.25,
      deltaSaldoMonetario: 94.15,
      mode: "HUNDRED",
      direction: "NEAREST",
      source: "PRICE_LIST_HECHURA" as const,
    },
    combinedAdjustment: 8069.15,
  },
};

function renderBreakdown() {
  render(
    <TotalDelComprobanteCard
      totalDocument={1672710}
      currencyCode="ARS"
      balanceMode="BREAKDOWN"
      balanceModeSource="PRICELIST_DEFAULT"
      balanceBreakdown={bdOro()}
      metalSaleByParent={{ Oro: 1717031.25 }}
      commercialMetalValueByParent={{ Oro: 1717031.25 }}
      commercialMonetaryRoundingImpactSum={94.15}
      commercialDocumentRoundingSnapshot={crSnap as any}
      onBalanceModeOverrideChange={noop}
      engineTotal={1672710}
    />,
  );
}

describe("DESGLOSADO autocontenido — bloque standalone eliminado", () => {
  it("1) NO renderiza la sección standalone 'Redondeos comerciales'", () => {
    renderBreakdown();
    expect(screen.queryByTestId("total-card-commercial-rounding-section")).toBeNull();
  });
});

describe("DESGLOSADO autocontenido — METALES", () => {
  it("2) muestra Valor comercial / Redondeo comercial / Valor final metal", () => {
    renderBreakdown();
    expect(screen.getByTestId("total-card-metal-oro-commercial-value")).toBeTruthy();
    expect(screen.getByTestId("total-card-metal-oro-commercial-rounding")).toBeTruthy();
    expect(screen.getByTestId("total-card-metal-oro-final")).toBeTruthy();
    // Valor final metal = base 1.717.031,25 + redondeo 7.975 = 1.725.006,25.
    expect(screen.getByTestId("total-card-metal-oro-final").textContent).toMatch(/1[.,]?725[.,]?006/);
  });
});

describe("DESGLOSADO autocontenido — MONETARIO", () => {
  it("3) muestra Valor comercial / Redondeo comercial / Valor final monetario", () => {
    renderBreakdown();
    const block = screen.getByTestId("total-card-monetary-commercial-rounding");
    expect(block).toBeTruthy();
    expect(screen.getByTestId("total-card-monetary-commercial-pre")).toBeTruthy();
    expect(screen.getByTestId("total-card-monetary-commercial-impact")).toBeTruthy();
    expect(screen.getByTestId("total-card-monetary-commercial-post")).toBeTruthy();
    // Label nuevo autocontenido.
    expect(block.textContent).toContain("Valor final monetario");
  });
});

describe("DESGLOSADO autocontenido — tooltips de trazabilidad", () => {
  it("4a) el tooltip del metal muestra la CUENTA (gramos × precio/g = valor), sin Antes/Después/Impacto", () => {
    renderBreakdown();
    const trigger = screen.getByTestId("origin-tooltip-trigger-oro");
    fireEvent.click(trigger);
    const txt = screen.getByTestId("origin-tooltip-content-oro").textContent ?? "";
    // La cuenta es la protagonista.
    expect(txt).toMatch(/×/);
    expect(txt).toMatch(/\/g/);
    expect(txt).toMatch(/=/);
    // Ya NO se usa TraceTooltipBody para el metal → sin Antes/Después/Impacto.
    expect(screen.queryByTestId("trace-body-metal")).toBeNull();
    expect(txt).not.toMatch(/Antes/i);
    expect(txt).not.toMatch(/Después/i);
    expect(txt).not.toMatch(/Impacto/i);
  });

  it("4b) el tooltip del monetario usa TraceTooltipBody (trace-body-monetary)", () => {
    renderBreakdown();
    const trigger = screen.getByTestId("origin-tooltip-trigger-monetario-(saldo)");
    fireEvent.click(trigger);
    expect(screen.getByTestId("trace-body-monetary")).toBeTruthy();
  });
});

describe("UNIFICADO no se altera", () => {
  it("5) UNIFICADO sin patrimonio metálico ni cuenta de metal por línea", () => {
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
        onBalanceModeOverrideChange={noop}
        engineTotal={943000}
      />,
    );
    expect(screen.queryByTestId("total-card-metals-section")).toBeNull();
    expect(screen.queryByTestId("total-card-monetary-commercial-rounding")).toBeNull();
    expect(screen.queryByTestId("total-card-commercial-rounding-section")).toBeNull();
  });
});
