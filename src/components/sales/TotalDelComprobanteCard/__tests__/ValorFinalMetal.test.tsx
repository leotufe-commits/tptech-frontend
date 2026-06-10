// src/components/sales/TotalDelComprobanteCard/__tests__/ValorFinalMetal.test.tsx
// =============================================================================
// Etapa 2C — Valor Final Metal real en el card (modo DESGLOSADO).
//
// Verifica que el bloque METALES rinde la composición de los 4 mecanismos y
// que el cierre `HeaderMetales + Monetario = TotalDocument` se mantiene.
// UNIFICADO (Etapa 1) debe quedar intacto.
// =============================================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TotalDelComprobanteCard } from "../TotalDelComprobanteCard";
import type { BalanceBreakdownDTO } from "../../../../services/sales";

const noop = () => undefined;

/** Balance con Oro Fino físico + un component HECHURA para que el bloque
 *  monetario se renderice. */
function balanceOroFino(gramsPure: number, valuation: number): BalanceBreakdownDTO {
  return {
    metals: [{
      metalParentId:         "oro-fino",
      metalParentName:       "Oro Fino",
      gramsOriginal:         gramsPure,
      purity:                1,
      gramsPure,
      quotePriceSnapshot:    100000,
      valuationMonetary:     valuation,
      valuationCurrencyCode: "ARS",
      sourceLineIds:         ["L-1"],
    }],
    monetaryBalance: {
      amount: 0, currencyCode: "ARS", currencyRate: 1, amountBase: 0,
      components: [{ type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 0 }],
    },
  };
}

/** Snapshot comercial PER_DOCUMENT con impacto $ por metal. */
const crSnap = {
  source: "PRICE_LIST" as const,
  scope: "BREAKDOWN" as const,
  totalAdjustment: 7656.25,
  breakdown: {
    metals: [{
      metalParentId: "oro-fino", metalParentName: "Oro Fino",
      preGrams: 8.918, postGrams: 9, deltaGrams: 0.082,
      metalPricePerGram: 100000, monetaryEquivalent: 7656.25,
      mode: "DECIMAL_1", direction: "NEAREST",
    }],
    metalMonetaryEquivalent: 7656.25,
    hechura: {
      preRoundingSaldoMonetario: 0, postRoundingSaldoMonetario: 0,
      deltaSaldoMonetario: 0, mode: "NONE", direction: "NEAREST",
      source: "PRICE_LIST_HECHURA" as const,
    },
    combinedAdjustment: 7656.25,
  },
};

/** Snapshot financiero PHYSICAL (capa 16) con impacto $ por metal. */
const docRoundingPhysical = {
  scope: "BREAKDOWN" as const,
  totalAdjustment: 4400,
  breakdown: {
    metal: null, hechura: null,
    metalDomain: "PHYSICAL" as const,
    metalPhysical: {
      metals: [{
        metalParentId: "oro-fino", metalParentName: "Oro Fino",
        preGrams: 9, postGrams: 9.044, deltaGrams: 0.044,
        metalPricePerGram: 100000, monetaryEquivalent: 4400,
        mode: "DECIMAL_2", direction: "NEAREST", source: "DOCUMENT_PHYSICAL_ROUNDING",
        fallback: null,
      }],
      metalMonetaryEquivalent: 4400, fallback: null,
    },
  },
  totals: { monetaryRoundingAdjustment: 0, metalMonetaryEquivalent: 4400, totalRoundingAdjustment: 4400 },
};

/** Snapshot ajuste manual BREAKDOWN con metal en gramos. */
const manualSnap = {
  scope: "BREAKDOWN" as const,
  breakdown: {
    metals: [{
      metalParentId: "oro-fino", metalParentName: "Oro Fino",
      preGrams: 9.044, postGrams: 10, deltaGrams: 0.956,
      metalPricePerGram: 100000, monetaryEquivalent: 95600,
    }],
    monetary: { preAmount: 0, amount: 0, postAmount: 0 },
  },
  totals: { monetaryAdjustment: 0, metalMonetaryEquivalent: 95600, totalMonetaryAdjustment: 95600 },
  audit: { appliedBy: null, appliedAt: "2026-06-08T00:00:00.000Z", reason: null },
};

describe("Etapa 2C — Valor Final Metal (card, DESGLOSADO)", () => {
  it("HeaderMetales y Valor final metal incluyen los 4 componentes", () => {
    // base 891800 + comercial 7656.25 + financiero 4400 + manual 95600 = 999.456,25
    const total = 1_200_000;
    render(
      <TotalDelComprobanteCard
        totalDocument={total}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={balanceOroFino(8.918, 891800)}
        metalSaleByParent={{ "Oro Fino": 891800 }}
        commercialMetalValueByParent={{ "Oro Fino": 891800 }}
        commercialDocumentRoundingSnapshot={crSnap}
        documentRoundingSnapshot={docRoundingPhysical}
        manualAdjustmentSnapshot={manualSnap}
        engineTotal={total}
        onBalanceModeOverrideChange={noop}
      />,
    );
    // Valor final metal por padre = 999.456,25.
    const finalRow = screen.getByTestId("total-card-metal-oro-fino-final");
    expect(finalRow.textContent).toMatch(/999[.,]?456[.,]25/);
    // Header del bloque = Σ valor final metal = 999.456,25.
    const header = screen.getByTestId("total-card-metals-header-total");
    expect(header.textContent).toMatch(/999[.,]?456[.,]25/);
    // Sub-filas presentes: comercial, redondeo comercial, financiero, manual.
    expect(screen.getByTestId("total-card-metal-oro-fino-commercial-value")).toBeTruthy();
    expect(screen.getByTestId("total-card-metal-oro-fino-commercial-rounding")).toBeTruthy();
    expect(screen.getByTestId("total-card-metal-oro-fino-financial")).toBeTruthy();
    expect(screen.getByTestId("total-card-metal-oro-fino-manual")).toBeTruthy();
  });

  it("Ajuste manual muestra Δ deltaGrams explícito en la fila del metal", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1_000_000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={balanceOroFino(9.044, 904400)}
        metalSaleByParent={{ "Oro Fino": 904400 }}
        manualAdjustmentSnapshot={manualSnap}
        engineTotal={1_000_000}
        onBalanceModeOverrideChange={noop}
      />,
    );
    const manualRow = screen.getByTestId("total-card-metal-oro-fino-manual");
    // pre→post + Δ deltaGrams (0,956).
    expect(manualRow.textContent).toMatch(/9[.,]?044.*→.*10/);
    expect(manualRow.textContent).toMatch(/Δ\s*0[.,]?956/);
  });

  it("cierre: HeaderMetales + Monetario = TotalDocument (PER_DOCUMENT con los 4)", () => {
    const total = 1_200_000;
    render(
      <TotalDelComprobanteCard
        totalDocument={total}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={balanceOroFino(8.918, 891800)}
        metalSaleByParent={{ "Oro Fino": 891800 }}
        commercialMetalValueByParent={{ "Oro Fino": 891800 }}
        commercialDocumentRoundingSnapshot={crSnap}
        documentRoundingSnapshot={docRoundingPhysical}
        manualAdjustmentSnapshot={manualSnap}
        engineTotal={total}
        onBalanceModeOverrideChange={noop}
      />,
    );
    // Metal final = 999.456,25 → Monetario = 1.200.000 − 999.456,25 = 200.543,75.
    const saldo = screen.getByTestId("total-card-monetary-header-amount");
    expect(saldo.textContent).toMatch(/200[.,]?543[.,]75/);
  });

  it("cierre PER_LINE (snapshot null, byParent): Header + Monetario = Total", () => {
    const total = 1_000_000;
    render(
      <TotalDelComprobanteCard
        totalDocument={total}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={balanceOroFino(8.918, 891800)}
        metalSaleByParent={{ "Oro Fino": 891800 }}
        commercialRoundingByParentFromLines={{ "Oro Fino": 5000 }}
        engineTotal={total}
        onBalanceModeOverrideChange={noop}
      />,
    );
    // final = 891800 + 5000 = 896.800 → saldo = 1.000.000 − 896.800 = 103.200.
    const header = screen.getByTestId("total-card-metals-header-total");
    expect(header.textContent).toMatch(/896[.,]?800/);
    const saldo = screen.getByTestId("total-card-monetary-header-amount");
    expect(saldo.textContent).toMatch(/103[.,]?200/);
  });

  it("UNIFICADO (Etapa 1) intacto: sin composición de metal, saldo = total", () => {
    const total = 1_000_000;
    render(
      <TotalDelComprobanteCard
        totalDocument={total}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={balanceOroFino(8.918, 891800)}
        metalSaleByParent={{ "Oro Fino": 891800 }}
        commercialDocumentRoundingSnapshot={crSnap}
        documentRoundingSnapshot={docRoundingPhysical}
        engineTotal={total}
        onBalanceModeOverrideChange={noop}
      />,
    );
    // Metal informativo: sin total monetario, sin "Valor final metal".
    expect(screen.queryByTestId("total-card-metals-header-total")).toBeNull();
    expect(screen.queryByTestId("total-card-metal-oro-fino-final")).toBeNull();
    // Etapa 2F-C — sin header de saldo duplicado; total en el hero = COMPLETO.
    expect(screen.queryByTestId("total-card-monetary-header-amount")).toBeNull();
    const saldo = screen.getByTestId("total-card-amount");
    expect(saldo.textContent).toMatch(/1[.,]?000[.,]?000/);
  });
});
