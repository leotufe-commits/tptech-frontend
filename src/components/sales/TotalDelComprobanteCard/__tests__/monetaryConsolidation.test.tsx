// src/components/sales/TotalDelComprobanteCard/__tests__/monetaryConsolidation.test.tsx
// =============================================================================
// MONETARIO desglosado (2026-06) — contrato corregido:
//
//   Valor final monetario = RESIDUAL `total − Σ valor final metal`
//                           (SIEMPRE el saldo; cierra METALES + MONETARIO = TOTAL).
//   Redondeo comercial    = redondeo AUTÓNOMO por línea
//                           (lineOwnHechuraRoundingMonetaryImpact ?? monetary.roundingImpact),
//                           mostrado como IMPACTO dentro del monetario.
//   Valor comercial       = final − redondeo.
//
// ⚠️ NO se usa `lineOwnMonetarySaldoPostCommercialRounding` / Σ monetary.amount
// como FINAL: en listas DESGLOSADAS SIN redondeo trae el TOTAL DE LÍNEA (ej.
// 814.680,14), no el saldo → inflaría el monetario. (Regresión corregida.)
// =============================================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TotalDelComprobanteCard } from "../TotalDelComprobanteCard";
import { sumLineCommercialMonetary, sumLineCommercialMonetaryRoundingImpact } from "../helpers";
import type { BalanceBreakdownDTO } from "../../../../services/sales";

const noop = () => undefined;

function balanceOro(valuation: number): BalanceBreakdownDTO {
  return {
    metals: [{
      metalParentId: "oro", metalParentName: "Oro",
      gramsOriginal: 1.5, purity: 1, gramsPure: 1.5,
      quotePriceSnapshot: 1, valuationMonetary: valuation,
      valuationCurrencyCode: "ARS", sourceLineIds: ["L1"],
    }],
    monetaryBalance: {
      amount: 0, currencyCode: "ARS", currencyRate: 1, amountBase: 0,
      components: [{ type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 0 }],
    },
  };
}

describe("helpers monetarios", () => {
  it("sumLineCommercialMonetary suma monetary.amount (contrato), NO lineOwn (= total de línea)", () => {
    const out = sumLineCommercialMonetary([
      // lineOwn trae el TOTAL de línea (814.680,14) — NO debe usarse como saldo.
      { lineOwnMonetarySaldoPostCommercialRounding: 814680.14, lineCommercialSummary: { monetary: { amount: 242336.39 } } },
    ]);
    // Usa monetary.amount (242.336,39), ignora lineOwn.
    expect(out).toBeCloseTo(242336.39, 2);
  });

  it("sumLineCommercialMonetaryRoundingImpact usa lineOwn autónomo (= redondeo del card)", () => {
    const out = sumLineCommercialMonetaryRoundingImpact([
      { lineOwnHechuraRoundingMonetaryImpact: -36.39, lineCommercialSummary: { monetary: { amount: 242300, roundingImpact: -24.6 } } },
      { lineOwnHechuraRoundingMonetaryImpact: -36.39, lineCommercialSummary: { monetary: { amount: 242300, roundingImpact: -24.6 } } },
    ]);
    expect(out).toBeCloseTo(-72.78, 2);
  });
});

describe("Footer MONETARIO desglosado — final = residual (total − metales)", () => {
  it("Desglosada SIN redondeo: monetario = total − metales, NO el total de línea (lineOwn)", () => {
    // Regresión corregida: con metal=572.343,75 y total=814.680,14, el saldo
    // monetario = 242.336,39 (residual). El campo lineOwn (814.680,14 = total de
    // línea) NO debe usarse.
    render(
      <TotalDelComprobanteCard
        totalDocument={814680.14}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={balanceOro(0)}
        metalSaleByParent={{ Oro: 572343.75 }}
        commercialMonetarySaldoSum={814680.14}   // total de línea (NO debe usarse)
        onBalanceModeOverrideChange={noop}
        engineTotal={814680.14}
      />,
    );
    const header = screen.getByTestId("total-card-monetary-header-amount");
    expect(header.textContent ?? "").toMatch(/242[.\s]?336[,.]39/);   // residual
    expect(header.textContent ?? "").not.toMatch(/814[.\s]?680/);     // NO total de línea
    // METALES + MONETARIO = TOTAL: 572.343,75 + 242.336,39 = 814.680,14.
    expect((screen.getByTestId("total-card-metals-header-total").textContent ?? "")).toMatch(/572[.\s]?343/);
  });

  it("Desglosada CON redondeo monetario: muestra redondeo (lineOwn) y cierra (comercial = final − redondeo)", () => {
    // total=814.680,14, metal=572.343,75 → final monetario = 242.336,39 (residual).
    // redondeo autónomo = −72,78 → comercial = 242.336,39 − (−72,78) = 242.409,17.
    render(
      <TotalDelComprobanteCard
        totalDocument={814680.14}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={balanceOro(0)}
        metalSaleByParent={{ Oro: 572343.75 }}
        commercialMonetaryRoundingImpactSum={-72.78}
        onBalanceModeOverrideChange={noop}
        engineTotal={814680.14}
      />,
    );
    expect((screen.getByTestId("total-card-monetary-commercial-post").textContent ?? "")).toMatch(/242[.\s]?336[,.]39/);
    expect((screen.getByTestId("total-card-monetary-commercial-impact").textContent ?? "")).toMatch(/72[,.]78/);
    expect((screen.getByTestId("total-card-monetary-commercial-pre").textContent ?? "")).toMatch(/242[.\s]?409[,.]17/);
  });

  it("MIXED: redondeo comercial monetario = snapshot documental (NO Σ lineOwn display-only)", () => {
    // Opción B — el snapshot documental (`commercialDocumentRoundingApplied`,
    // = lo que alimentó Sale.total) trae deltaSaldoMonetario −72,78. La Σ lineOwn
    // (display-only) viene divergente (−49,19) y NO debe usarse. El footer debe
    // mostrar −72,78 y reconciliar: pre (484.672,78) + redondeo (−72,78) = final
    // (484.600).
    render(
      <TotalDelComprobanteCard
        totalDocument={484600}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={{ metals: [], monetaryBalance: { amount: 484600, currencyCode: "ARS", currencyRate: 1, amountBase: 484600, components: [{ type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 484600 }] } } as any}
        commercialDocumentRoundingSnapshot={{
          scope: "BREAKDOWN",
          totalAdjustment: -72.78,
          breakdown: {
            metals: [],
            metalMonetaryEquivalent: 0,
            hechura: { preRoundingSaldoMonetario: 484672.78, postRoundingSaldoMonetario: 484600, deltaSaldoMonetario: -72.78, mode: "HUNDRED", direction: "NEAREST", source: "PRICE_LIST_HECHURA" },
            combinedAdjustment: -72.78,
          },
        } as any}
        // Σ lineOwn DIVERGENTE — NO debe usarse cuando hay snapshot documental.
        commercialMonetaryRoundingImpactSum={-49.19}
        onBalanceModeOverrideChange={noop}
        engineTotal={484600}
      />,
    );
    const impact = screen.getByTestId("total-card-monetary-commercial-impact").textContent ?? "";
    expect(impact).toMatch(/72[,.]78/);       // snapshot documental
    expect(impact).not.toMatch(/49[,.]19/);   // NO Σ lineOwn
    expect((screen.getByTestId("total-card-monetary-commercial-pre").textContent ?? "")).toMatch(/484[.\s]?672[,.]78/);
    expect((screen.getByTestId("total-card-monetary-commercial-post").textContent ?? "")).toMatch(/484[.\s]?600/);
  });

  it("sin snapshot documental: redondeo cae a Σ lineOwn (back-compat)", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={484600}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={{ metals: [], monetaryBalance: { amount: 484600, currencyCode: "ARS", currencyRate: 1, amountBase: 484600, components: [{ type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 484600 }] } } as any}
        commercialMonetaryRoundingImpactSum={-72.78}
        onBalanceModeOverrideChange={noop}
        engineTotal={484600}
      />,
    );
    expect((screen.getByTestId("total-card-monetary-commercial-impact").textContent ?? "")).toMatch(/72[,.]78/);
  });

  it("MIXED con línea UNIFICADA: no duplica metal (residual cierra el invariante)", () => {
    // metal=919.912,50; total=1.342.937,50 → monetario = 423.025 (residual).
    // Aunque commercialMonetarySaldoSum venga inflado (1.000.200), NO se usa.
    render(
      <TotalDelComprobanteCard
        totalDocument={1342937.5}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={balanceOro(0)}
        metalSaleByParent={{ Oro: 919912.5 }}
        commercialMonetarySaldoSum={1000200}   // inflado por línea UNIFICADA
        onBalanceModeOverrideChange={noop}
      />,
    );
    const header = screen.getByTestId("total-card-monetary-header-amount");
    expect(header.textContent ?? "").toMatch(/423[.\s]?025/);
    expect(header.textContent ?? "").not.toMatch(/1[.\s]?000[.\s]?200/);
  });
});
