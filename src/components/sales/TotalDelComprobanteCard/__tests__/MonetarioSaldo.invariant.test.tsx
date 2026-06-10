// src/components/sales/TotalDelComprobanteCard/__tests__/MonetarioSaldo.invariant.test.tsx
// ============================================================================
// Bug del panel derecho — "Monetario (saldo)" no debe contar el metal dos veces
// en documentos mixtos. Regla de negocio: METALES + MONETARIO = TOTAL.
//
// Causa: una línea UNIFIED aporta a `lineCommercialSummary.monetary.amount` su
// TOTAL COMPLETO (metal + monetario). `commercialMonetarySaldoSum` (Σ) queda
// inflado. El panel ahora aplica un guard anti doble-conteo: si
// `metal + Σmonetary > total`, cierra el invariante con `total − metal`.
// ============================================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TotalDelComprobanteCard } from "../TotalDelComprobanteCard";
import type { BalanceBreakdownDTO } from "../../../../services/sales";

const noop = () => undefined;

function balanceOro(valuation = 0): BalanceBreakdownDTO {
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

const amount = () => screen.getByTestId("total-card-monetary-header-amount").textContent ?? "";
// Etapa 2F-C — en UNIFICADO el header de saldo se oculta; el total vive en el hero.
const hero = () => screen.getByTestId("total-card-amount").textContent ?? "";

describe("Monetario (saldo) — invariante METALES + MONETARIO = TOTAL", () => {
  it("Caso 3 — balanceMode UNIFIED (Etapa 2D): SIN bloque METALES, saldo = total completo", () => {
    // Contrato Etapa 2D — en UNIFICADO NO se renderiza ningún bloque METALES
    // (revierte el "metal informativo" de Etapa 1). El saldo monetario es el
    // TOTAL completo del documento.
    render(
      <TotalDelComprobanteCard
        totalDocument={814700}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={balanceOro()}
        commercialMetalValueSum={572343.75}
        metalSaleByParent={{ Oro: 572343.75 }}
        onBalanceModeOverrideChange={noop}
      />,
    );
    // Etapa 2F-C — total en el hero (sin header de saldo en UNIFICADO).
    expect(hero()).toMatch(/814[.,]?700/);
    expect(hero()).not.toMatch(/242[.,]?356/);
    expect(screen.queryByTestId("total-card-monetary-header-amount")).toBeNull();
    // NO hay bloque METALES en UNIFICADO.
    expect(screen.queryByTestId("total-card-metals-section")).toBeNull();
  });

  it("Caso 4 — BREAKDOWN con línea UNIFIED: NO duplica metal (guard anti doble-conteo)", () => {
    // commercialMonetarySaldoSum viene INFLADO (incluye el total completo de la
    // línea unificada). metal (919.912,50) + sum (1.000.200) = 1.920.112,50 >
    // total (1.342.937,50) → guard → total − metal = 423.025.
    render(
      <TotalDelComprobanteCard
        totalDocument={1342937.5}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={balanceOro()}
        metalSaleByParent={{ Oro: 919912.5 }}
        commercialMonetarySaldoSum={1000200}   // ← inflado por la línea UNIFIED
        onBalanceModeOverrideChange={noop}
      />,
    );
    expect(amount()).toMatch(/423[.,]?025/);
    expect(amount()).not.toMatch(/1[.,]?000[.,]?200/);
  });

  it("Caso 4b — invariante cierra: METALES + MONETARIO = TOTAL", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1342937.5}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={balanceOro()}
        metalSaleByParent={{ Oro: 919912.5 }}
        commercialMonetarySaldoSum={1000200}
        onBalanceModeOverrideChange={noop}
      />,
    );
    const metales = screen.getByTestId("total-card-metals-header-total").textContent ?? "";
    expect(metales).toMatch(/919[.,]?912[.,]50/);
    // 919.912,50 + 423.025,00 = 1.342.937,50 ✓
    expect(amount()).toMatch(/423[.,]?025/);
  });

  it("DESGLOSADO: saldo = residual total − Σ valor final metal (commercialMonetarySaldoSum NO redefine el final)", () => {
    // SSOT del saldo desglosado: el "Valor final monetario" es el RESIDUAL
    // `total − Σ valor final metal` = 1.037.562,50 − 210.937,50 = 826.625,00.
    // `commercialMonetarySaldoSum` (371.000) NO se usa como final: en desglosada
    // sin redondeo trae el total de línea, no el saldo. El residual cierra el
    // invariante METALES + MONETARIO = TOTAL (guard anti doble-conteo intrínseco).
    render(
      <TotalDelComprobanteCard
        totalDocument={1037562.5}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={balanceOro(210937.5)}
        commercialMonetarySaldoSum={371000}   // NO redefine el final
        onBalanceModeOverrideChange={noop}
      />,
    );
    expect(amount()).toMatch(/826[.,]?625/);
    expect(amount()).not.toMatch(/371[.,]?000/);
  });

  it("Redondeo comercial monetario: 'Valor redondeado' coincide con el header", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1342937.5}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={balanceOro()}
        metalSaleByParent={{ Oro: 919912.5 }}
        commercialMonetarySaldoSum={1000200}        // inflado
        commercialMonetaryRoundingImpactSum={24.79} // hay impacto → se muestra el desglose
        onBalanceModeOverrideChange={noop}
      />,
    );
    // El "Valor redondeado" del desglose usa el saldo corregido (423.025), NO 1.000.200.
    const post = screen.getByTestId("total-card-monetary-commercial-post").textContent ?? "";
    expect(post).toMatch(/423[.,]?025/);
    expect(post).not.toMatch(/1[.,]?000[.,]?200/);
    // y coincide con el header.
    expect(amount()).toMatch(/423[.,]?025/);
  });
});

// ============================================================================
// Opción 1 (2026-06) — REDISTRIBUCIÓN VISUAL del redondeo COMERCIAL del metal.
// El delta del redondeo comercial del metal deja de absorberse en MONETARIO y
// pasa a vivir en METALES. Header METALES = metal_post; MONETARIO = total −
// metal_post. Invariante: METALES(post) + MONETARIO = TOTAL.
// ============================================================================

/** Snapshot mínimo del redondeo comercial PER_DOCUMENT BREAKDOWN con un único
 *  metal padre "Oro". Sin `hechura.postRoundingSaldoMonetario` → el saldo del
 *  card cae al camino `total − metal_post` (el que esta suite valida). */
const crSnapOro = (metalEq: number): any => ({
  source: "PRICE_LIST",
  scope: "BREAKDOWN",
  totalAdjustment: metalEq,
  breakdown: {
    metals: [{
      metalParentId: "oro", metalParentName: "Oro",
      preGrams: 1.5, postGrams: 1.5, deltaGrams: 0,
      metalPricePerGram: 1, monetaryEquivalent: metalEq,
      mode: "NONE", direction: "NEAREST",
    }],
    metalMonetaryEquivalent: metalEq,
  },
});

const metalsHeader = () =>
  screen.getByTestId("total-card-metals-header-total").textContent ?? "";

describe("Opción 1 — METALES POST redondeo comercial · METALES(post) + MONETARIO = TOTAL", () => {
  it("delta POSITIVO: header = metal_post, MONETARIO = total − metal_post, cierra con TOTAL", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1300000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={balanceOro()}
        metalSaleByParent={{ Oro: 1144687.5 }}      // pre
        commercialDocumentRoundingSnapshot={crSnapOro(5300)}
        onBalanceModeOverrideChange={noop}
      />,
    );
    // METALES header = 1.144.687,50 + 5.300 = 1.149.987,50 (POST).
    expect(metalsHeader()).toMatch(/1[.,]?149[.,]?987[.,]50/);
    // MONETARIO = 1.300.000 − 1.149.987,50 = 150.012,50.
    expect(amount()).toMatch(/150[.,]?012[.,]50/);
    // 1.149.987,50 + 150.012,50 = 1.300.000 ✓.
    // Sub-filas dentro del metal: comercial → redondeo → final (Etapa 2C).
    expect(screen.getByText("Redondeo comercial")).toBeTruthy();
    expect(screen.getByText("Valor final metal")).toBeTruthy();
  });

  it("delta NEGATIVO: header baja, MONETARIO sube, sigue cerrando (sin clamp)", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1300000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={balanceOro()}
        metalSaleByParent={{ Oro: 1144687.5 }}
        commercialDocumentRoundingSnapshot={crSnapOro(-5300)}
        onBalanceModeOverrideChange={noop}
      />,
    );
    // METALES header = 1.144.687,50 − 5.300 = 1.139.387,50.
    expect(metalsHeader()).toMatch(/1[.,]?139[.,]?387[.,]50/);
    // MONETARIO = 1.300.000 − 1.139.387,50 = 160.612,50.
    expect(amount()).toMatch(/160[.,]?612[.,]50/);
    expect(screen.getByText("Redondeo comercial")).toBeTruthy();
  });

  it("SIN snapshot (delta 0): Valor final metal = metal_pre; sin fila de Redondeo comercial", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1300000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={balanceOro()}
        metalSaleByParent={{ Oro: 1144687.5 }}
        onBalanceModeOverrideChange={noop}
      />,
    );
    // Header = Valor final metal = metal_pre = 1.144.687,50 (sin redondeos/ajustes).
    expect(metalsHeader()).toMatch(/1[.,]?144[.,]?687[.,]50/);
    // MONETARIO = 1.300.000 − 1.144.687,50 = 155.312,50.
    expect(amount()).toMatch(/155[.,]?312[.,]50/);
    // Etapa 2C — el "Valor final metal" SIEMPRE se muestra en BREAKDOWN…
    expect(screen.getByText("Valor final metal")).toBeTruthy();
    // …pero la fila "Redondeo comercial" se omite cuando el delta es 0.
    expect(screen.queryByText("Redondeo comercial")).toBeNull();
  });

  it("balanceMode UNIFIED con snapshot comercial BREAKDOWN (Etapa 1): NO separa metal, saldo = total", () => {
    // Etapa 1 — INVERSIÓN del comportamiento previo: el gate del display ahora
    // es el `balanceMode` del DOCUMENTO, NO el scope del snapshot comercial.
    // En UNIFICADO no se muestra separación metálica ni redondeo comercial por
    // metal, y el saldo monetario es el total completo.
    render(
      <TotalDelComprobanteCard
        totalDocument={1300000}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={balanceOro()}
        metalSaleByParent={{ Oro: 1144687.5 }}
        commercialDocumentRoundingSnapshot={crSnapOro(5300)}
        onBalanceModeOverrideChange={noop}
      />,
    );
    // Sin total monetario del metal, sin "Valor final metales".
    expect(screen.queryByTestId("total-card-metals-header-total")).toBeNull();
    expect(screen.queryByText("Valor final metales")).toBeNull();
    // Etapa 2F-C — total en el hero (sin header de saldo en UNIFICADO).
    expect(hero()).toMatch(/1[.,]?300[.,]?000/);
    expect(hero()).not.toMatch(/150[.,]?012/);
  });
});
