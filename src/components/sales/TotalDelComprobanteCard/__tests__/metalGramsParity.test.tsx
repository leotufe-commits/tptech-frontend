// src/components/sales/TotalDelComprobanteCard/__tests__/metalGramsParity.test.tsx
// =============================================================================
// SSOT del gramo de METALES — paridad CARD ↔ FOOTER.
//
// El footer METALES debe mostrar el MISMO gramo equivalente comercial que el
// card del artículo: `displayGrams` (= `gramsEquivLine` / `saleEquivGr`, metal
// padre equivalente con pureza + merma + margen). NO debe usar una segunda
// fórmula (el removido `finalSaleGrams = saleValue/cotización`), que daba un
// valor monetario en gramos spot divergente.
//
// Regla: el gramo principal = `displayGrams ?? grams` (fallback físico). El
// frontend NO recalcula ni multiplica gramos × cotización.
// =============================================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TotalDelComprobanteCard } from "../TotalDelComprobanteCard";
import type { BalanceBreakdownDTO } from "../../../../services/sales";

const noop = () => undefined;

function bd(): BalanceBreakdownDTO {
  return {
    metals: [
      {
        metalParentId: "oro",
        metalParentName: "Oro",
        gramsOriginal: 1.5,
        purity: 1,
        gramsPure: 1.5, // físico (cuenta corriente)
        quotePriceSnapshot: 187653.69,
        valuationMonetary: 281480.5,
        valuationCurrencyCode: "ARS",
        sourceLineIds: ["L-1"],
      } as any,
    ],
    monetaryBalance: {
      amount: 0, currencyCode: "ARS", currencyRate: 1, amountBase: 0,
      components: [],
    },
  };
}

// documentMetals = el dato que el caller deriva de las líneas (mismo helper que
// el card): displayGrams = saleEquivGr = 2,29 g (metal padre equiv comercial).
const documentMetals = [
  { id: "oro", name: "Oro", grams: 2.29, displayGrams: 2.29, monetaryAmount: 572343.75, sourceLineIds: ["L-1"] },
];

describe("METALES — paridad card ↔ footer (displayGrams canónico)", () => {
  it("muestra displayGrams (2,29 g, equivalente del card), NO un valor monetario en gramos", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={572343.75}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceModeSource="PRICELIST_DEFAULT"
        balanceBreakdown={bd()}
        documentMetals={documentMetals as any}
        metalSaleByParent={{ Oro: 572343.75 }}
        onBalanceModeOverrideChange={noop}
        engineTotal={572343.75}
      />,
    );
    const row = screen.getByTestId("total-card-metal-oro");
    // Gramo comercial del card.
    expect(row.textContent).toMatch(/2[.,]29/);
    // NO el valor monetario en gramos spot (saleValue/cotización = 3,05).
    expect(row.textContent).not.toMatch(/3[.,]05/);
  });

  it("fallback: sin displayGrams cae al físico `grams`", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={281480.5}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceModeSource="PRICELIST_DEFAULT"
        balanceBreakdown={bd()}
        onBalanceModeOverrideChange={noop}
        engineTotal={281480.5}
      />,
    );
    const row = screen.getByTestId("total-card-metal-oro");
    // Sin documentMetals → sin displayGrams → físico gramsPure (1,50).
    expect(row.textContent).toMatch(/1[.,]50/);
  });
});
