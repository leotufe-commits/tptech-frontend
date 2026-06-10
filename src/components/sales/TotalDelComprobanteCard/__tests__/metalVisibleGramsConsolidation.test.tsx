// src/components/sales/TotalDelComprobanteCard/__tests__/metalVisibleGramsConsolidation.test.tsx
// =============================================================================
// SSOT card ↔ footer (2026-06) — el GRAMO PRINCIPAL del footer consolida el
// MISMO gramo visible que el card del artículo, NO `saleEquivGr`/`displayGrams`.
//
// Contrato:
//   gramo footer (por padre) = Σ_líneas( visibleGrams ?? gramsEquivLine )
//   = el MISMO gramo que `TPDocumentLineAdvancedEditor` muestra por línea.
//
// Antes: footer = `displayGrams` (= saleEquivGr) → divergía del card (2,29 vs
// 2,30) cuando la lista aplica redondeo comercial PER_DOCUMENT.
// Ahora: footer = `metalVisibleGramsByParent` (visibleGrams del card).
// =============================================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TotalDelComprobanteCard } from "../TotalDelComprobanteCard";
import { buildVisibleGramsByParent } from "../helpers";
import type { BalanceBreakdownDTO } from "../../../../services/sales";

const noop = () => undefined;

function bdOro(gramsPure: number): BalanceBreakdownDTO {
  return {
    metals: [
      {
        metalParentId: "oro",
        metalParentName: "Oro",
        gramsOriginal: gramsPure,
        purity: 1,
        gramsPure,
        quotePriceSnapshot: 80000,
        valuationMonetary: gramsPure * 80000,
        valuationCurrencyCode: "ARS",
        sourceLineIds: ["L-1"],
      } as any,
    ],
    monetaryBalance: { amount: 0, currencyCode: "ARS", currencyRate: 1, amountBase: 0, components: [] },
  };
}

describe("buildVisibleGramsByParent — consolida el gramo visible del card", () => {
  it("usa visibleGrams del summary (no gramsEquivLine) y suma por padre", () => {
    const lines = [
      {
        quantity: 1,
        composition: { metals: [{ metalName: "Oro", purity: 1, appliedGrams: 2.29, appliedMermaPct: 0, lineSale: 100000 }] },
        metalHechuraBreakdown: { metalCost: 100000, metalSale: 100000 }, // factor 1 → gramsEquivLine 2.29
        // El card muestra visibleGrams (2.30), NO gramsEquivLine (2.29).
        lineCommercialSummary: { metals: { byParent: [{ metalParentName: "Oro", visibleGrams: 2.3 }] } },
      },
      {
        quantity: 1,
        composition: { metals: [{ metalName: "Oro", purity: 1, appliedGrams: 2.29, appliedMermaPct: 0, lineSale: 100000 }] },
        metalHechuraBreakdown: { metalCost: 100000, metalSale: 100000 },
        lineCommercialSummary: { metals: { byParent: [{ metalParentName: "Oro", visibleGrams: 2.29 }] } },
      },
    ];
    const g = buildVisibleGramsByParent(lines as any);
    // Σ visibleGrams = 2.30 + 2.29 = 4.59 (NO 2.29 + 2.29 = 4.58 que sería gramsEquivLine).
    expect(g.Oro).toBeCloseTo(4.59, 3);
  });

  it("cae a gramsEquivLine cuando la línea no trae lineCommercialSummary", () => {
    const lines = [
      {
        quantity: 1,
        composition: { metals: [{ metalName: "Oro", purity: 1, appliedGrams: 1.5, appliedMermaPct: 0, lineSale: 100000 }] },
        metalHechuraBreakdown: { metalCost: 100000, metalSale: 100000 }, // factor 1 → gramsEquivLine 1.5
      },
    ];
    const g = buildVisibleGramsByParent(lines as any);
    expect(g.Oro).toBeCloseTo(1.5, 3);
  });
});

describe("Footer METALES — gramo principal = visibleGrams del card", () => {
  it("renderiza el gramo visible (2,30), no el saleEquivGr (2,29)", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={300000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceModeSource="PRICELIST_DEFAULT"
        balanceBreakdown={bdOro(1.5) /* físico: NO debe verse como gramo principal */}
        commercialDocumentRoundingSnapshot={null}
        // documentMetals derivaría displayGrams = saleEquivGr (2,29) — el prop
        // nuevo lo overridea con el gramo visible del card (2,30).
        documentMetals={[{ id: "oro", name: "Oro", grams: 2.29, monetaryAmount: 180000 }] as any}
        metalVisibleGramsByParent={{ Oro: 2.3 }}
        onBalanceModeOverrideChange={noop}
        engineTotal={300000}
      />,
    );
    const row = screen.getByTestId("total-card-metal-oro");
    // El gramo principal del footer = 2,30 (visible del card), NUNCA 2,29.
    expect(row.textContent).toMatch(/2[.,]30/);
  });
});
