// src/components/sales/TotalDelComprobanteCard/__tests__/mixedListConsolidation.test.tsx
// =============================================================================
// Fix listas mixtas (2026-06) — el footer CONSOLIDA los finales del card, no
// los recompone con doble conteo.
//
// Contrato:
//   Valor de venta metal = Σ saleAmountLinePre   (PRE, = "Valor comercial" card)
//   Redondeo comercial   = Σ (saleAmountLine − saleAmountLinePre)
//   Valor final metal    = base(PRE) + redondeo = Σ saleAmountLine  (POST)
//
// Antes: base = saleAmountLine (POST) + redondeo → POST + delta (DOBLE) en MIXED.
// Ahora: base = saleAmountLinePre (PRE) + redondeo → POST (correcto).
// =============================================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TotalDelComprobanteCard } from "../TotalDelComprobanteCard";
import { buildMetalSalePreByParent } from "../helpers";
import type { BalanceBreakdownDTO } from "../../../../services/sales";

const noop = () => undefined;

function bdOro(): BalanceBreakdownDTO {
  return {
    metals: [
      { metalParentId: "oro", metalParentName: "Oro", gramsOriginal: 2.3, purity: 1, gramsPure: 2.3, quotePriceSnapshot: 80000, valuationMonetary: 184000, valuationCurrencyCode: "ARS", sourceLineIds: ["L-1"] } as any,
    ],
    monetaryBalance: { amount: 0, currencyCode: "ARS", currencyRate: 1, amountBase: 0, components: [] },
  };
}

describe("MIXED — footer consolida finales del card sin doble conteo", () => {
  it("Valor final metal = PRE + redondeo (= POST), NO POST + redondeo", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={300000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceModeSource="PRICELIST_DEFAULT"
        balanceBreakdown={bdOro()}
        // MIXED → sin snapshot PER_DOCUMENT.
        commercialDocumentRoundingSnapshot={null}
        // POST (= saleAmountLine) — ya NO se usa como base.
        metalSaleByParent={{ Oro: 186100 }}
        // PRE (= saleAmountLinePre = "Valor comercial" del card) — NUEVA base.
        metalSalePreByParent={{ Oro: 180000 }}
        // Redondeo por línea (= post − pre = 6.100).
        commercialRoundingByParentFromLines={{ Oro: 6100 }}
        onBalanceModeOverrideChange={noop}
        engineTotal={300000}
      />,
    );
    // Valor de venta metal = PRE (180.000), NO POST (186.100).
    const venta = screen.getByTestId("total-card-metal-oro-commercial-value");
    expect(venta.textContent).toMatch(/180[.,]?000/);
    // Redondeo comercial = 6.100.
    const red = screen.getByTestId("total-card-metal-oro-commercial-rounding");
    expect(red.textContent).toMatch(/6[.,]?100/);
    // Valor final metal = 186.100 (PRE + redondeo), NUNCA 192.200 (doble conteo).
    const final = screen.getByTestId("total-card-metal-oro-final");
    expect(final.textContent).toMatch(/186[.,]?100/);
    expect(final.textContent).not.toMatch(/192[.,]?200/);
  });

  it("buildMetalSalePreByParent suma saleAmountLinePre por padre (PRE), no lineSale (POST)", () => {
    const lines = [
      {
        quantity: 1,
        composition: { metals: [{ metalName: "Oro", purity: 1, appliedGrams: 2.3, appliedMermaPct: 0, lineSale: 100000, lineSalePreRounding: 96000 }] },
        metalHechuraBreakdown: { metalCost: 50000, metalSale: 100000 },
      },
      {
        quantity: 1,
        composition: { metals: [{ metalName: "Oro", purity: 1, appliedGrams: 2.29, appliedMermaPct: 0, lineSale: 90000, lineSalePreRounding: 86100 }] },
        metalHechuraBreakdown: { metalCost: 45000, metalSale: 90000 },
      },
    ];
    const pre = buildMetalSalePreByParent(lines as any);
    // PRE = 96000 + 86100 = 182.100 (NO 190.000 que sería el POST).
    expect(pre.Oro).toBeCloseTo(182100, 2);
  });
});
