// src/components/sales/TotalDelComprobanteCard/__tests__/MonetaryCommercialRounding.render.test.tsx
// ============================================================================
// Render del desglose "Valor comercial → Redondeo comercial → Valor redondeado"
// bajo el header "Monetario (saldo)" del card del comprobante.
//
// Fuente: `commercialMonetaryRoundingImpactSum` (Σ de
// lineCommercialSummary.monetary.roundingImpact) + `commercialMonetarySaldoSum`
// (Σ del MONETARIO por línea = valor redondeado). Passthrough puro — el card
// solo resta `pre = post − impacto` para mostrar el valor comercial.
//
// Casos pedidos:
//   1. impacto +0,70 → 3 filas, redondeo en VERDE.
//   2. impacto −1,20 → redondeo en ROJO.
//   3. impacto 0 / null → NO se muestra el desglose.
// ============================================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TotalDelComprobanteCard } from "../TotalDelComprobanteCard";
import type { BalanceBreakdownDTO } from "../../../../services/sales";

const noop = () => undefined;

function balance(): BalanceBreakdownDTO {
  return {
    metals: [],
    monetaryBalance: {
      amount: 242357, currencyCode: "ARS", currencyRate: 1, amountBase: 242357,
      components: [{ type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 242357 }],
    },
  };
}

function renderCard(impact: number | null | undefined, post = 242357) {
  render(
    <TotalDelComprobanteCard
      totalDocument={post}
      currencyCode="ARS"
      balanceMode="BREAKDOWN"
      balanceBreakdown={balance()}
      commercialMonetarySaldoSum={post}
      commercialMonetaryRoundingImpactSum={impact}
      onBalanceModeOverrideChange={noop}
    />,
  );
}

describe("Monetario (saldo) — desglose del redondeo comercial monetario", () => {
  it("Caso 1: impacto +0,70 → muestra Valor comercial / Redondeo / Valor redondeado", () => {
    renderCard(0.7, 242357);
    const block = screen.getByTestId("total-card-monetary-commercial-rounding");
    expect(block).toBeTruthy();
    // Valor comercial (pre) = 242357 − 0,70 = 242356,30
    expect(screen.getByTestId("total-card-monetary-commercial-pre").textContent).toMatch(/242[.,]?356[.,]30/);
    // Redondeo comercial (impacto) con signo +
    const impact = screen.getByTestId("total-card-monetary-commercial-impact");
    expect(impact.textContent).toMatch(/\+/);
    expect(impact.textContent).toMatch(/0[.,]70/);
    // Verde (emerald) para impacto > 0
    expect(impact.className).toMatch(/emerald/);
    // Valor redondeado (post)
    expect(screen.getByTestId("total-card-monetary-commercial-post").textContent).toMatch(/242[.,]?357/);
  });

  it("Caso 2: impacto −1,20 → redondeo en rojo con signo −", () => {
    renderCard(-1.2, 242357);
    const impact = screen.getByTestId("total-card-monetary-commercial-impact");
    expect(impact.textContent).toMatch(/−/);          // signo menos tipográfico
    expect(impact.textContent).toMatch(/1[.,]20/);
    expect(impact.className).toMatch(/red/);           // rojo para impacto < 0
    // pre = 242357 − (−1,20) = 242358,20
    expect(screen.getByTestId("total-card-monetary-commercial-pre").textContent).toMatch(/242[.,]?358[.,]20/);
  });

  // Etapa UX (autocontenido, 2026-06) — el patrimonio MONETARIO muestra SIEMPRE
  // su cuenta (Valor comercial + Valor final monetario). El "Redondeo comercial"
  // es la ÚNICA fila condicional: solo aparece cuando el impacto es ≠ 0.
  it("Caso 3a: impacto 0 → bloque presente sin fila de redondeo (pre == post)", () => {
    renderCard(0, 242357);
    expect(screen.getByTestId("total-card-monetary-commercial-rounding")).toBeTruthy();
    expect(screen.queryByTestId("total-card-monetary-commercial-impact")).toBeNull();
    // Valor comercial == Valor final monetario (sin redondeo).
    expect(screen.getByTestId("total-card-monetary-commercial-pre").textContent).toMatch(/242[.,]?357/);
    expect(screen.getByTestId("total-card-monetary-commercial-post").textContent).toMatch(/242[.,]?357/);
  });

  it("Caso 3b: impacto null → bloque presente sin fila de redondeo", () => {
    renderCard(null, 242357);
    expect(screen.getByTestId("total-card-monetary-commercial-rounding")).toBeTruthy();
    expect(screen.queryByTestId("total-card-monetary-commercial-impact")).toBeNull();
  });

  it("no rompe el header existente 'Monetario (saldo)'", () => {
    renderCard(0.7, 242357);
    expect(screen.getByTestId("total-card-hechura-row").textContent).toContain("Monetario (saldo)");
    // El header sigue mostrando el saldo (= valor redondeado).
    expect(screen.getByTestId("total-card-monetary-header-amount").textContent).toMatch(/242[.,]?357/);
  });
});
