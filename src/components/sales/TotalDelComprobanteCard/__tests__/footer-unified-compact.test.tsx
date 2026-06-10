// src/components/sales/TotalDelComprobanteCard/__tests__/footer-unified-compact.test.tsx
// =============================================================================
// Etapa 2F-B — Footer UNIFICADO compacto.
//
//   · Sin headers de sección (AJUSTES / IMPUESTOS / ADICIONALES).
//   · Sin sub-headers de grupo (Descuentos / Bonificaciones / …).
//   · Sin "Base imponible".
//   · Solo filas relevantes (Promociones, IVA, Redondeo financiero, …).
//
// BREAKDOWN conserva el desglose estructurado (contraprueba).
// =============================================================================

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TotalDelComprobanteCard } from "../TotalDelComprobanteCard";
import type { BalanceBreakdownDTO } from "../../../../services/sales";

const noop = () => undefined;

/** Breakdown con componentes monetarios típicos (descuento + IVA + redondeo). */
function bdWithComponents(metals: BalanceBreakdownDTO["metals"] = []): BalanceBreakdownDTO {
  return {
    metals,
    monetaryBalance: {
      amount: 1210, currencyCode: "ARS", currencyRate: 1, amountBase: 1210,
      components: [
        { type: "HECHURA",           group: "HECHURA",  label: "Hechura",            amount: 1000 },
        { type: "DISCOUNT_QTY",      group: "DISCOUNT", label: "Descuentos de línea", amount: -100 },
        { type: "TAX",               group: "TAX",      label: "IVA",                amount: 210 },
        { type: "ROUNDING_MONETARY", group: "ROUNDING", label: "Redondeo",           amount: -0.05 },
      ],
    },
  };
}

function openDetail() {
  fireEvent.click(screen.getByTestId("total-card-composicion-toggle"));
}

describe("Etapa 2F-B — Footer UNIFICADO compacto", () => {
  it("UNIFICADO: sin headers de sección", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdWithComponents()}
        taxableBase={1000}
        documentRoundingApplied={{ scope: "UNIFIED", totalAdjustment: -0.05 }}
        onBalanceModeOverrideChange={noop}
      />,
    );
    openDetail();
    expect(screen.queryByTestId("total-card-section-header-BASE_ADJUSTMENTS")).toBeNull();
    expect(screen.queryByTestId("total-card-section-header-TAXES")).toBeNull();
    expect(screen.queryByTestId("total-card-section-header-POST_TAX")).toBeNull();
  });

  it("UNIFICADO: sin 'Base imponible' aunque se provea taxableBase", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdWithComponents()}
        taxableBase={1000}
        onBalanceModeOverrideChange={noop}
      />,
    );
    openDetail();
    expect(screen.queryByTestId("total-card-taxable-base")).toBeNull();
  });

  it("UNIFICADO: muestra las filas relevantes (Promociones, IVA, Redondeo)", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdWithComponents()}
        documentRoundingApplied={{ scope: "UNIFIED", totalAdjustment: -0.05 }}
        onBalanceModeOverrideChange={noop}
      />,
    );
    openDetail();
    expect(screen.getByTestId("total-card-component-DISCOUNT_QTY")).toBeTruthy();
    expect(screen.getByTestId("total-card-component-TAX")).toBeTruthy();
    expect(screen.getByTestId("total-card-component-ROUNDING_MONETARY")).toBeTruthy();
    // HECHURA (COMPOSICIÓN) oculto en UNIFICADO (Etapa 2F).
    expect(screen.queryByTestId("total-card-component-HECHURA")).toBeNull();
  });
});

describe("Etapa 2F-B — BREAKDOWN conserva el desglose estructurado", () => {
  it("BREAKDOWN: SÍ muestra headers de sección + Base imponible", () => {
    const metals: BalanceBreakdownDTO["metals"] = [{
      metalParentId: "oro-fino", metalParentName: "Oro Fino",
      gramsOriginal: 1, purity: 1, gramsPure: 1,
      quotePriceSnapshot: 100, valuationMonetary: 100,
      valuationCurrencyCode: "ARS", sourceLineIds: ["L-1"],
    }];
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdWithComponents(metals)}
        taxableBase={1000}
        onBalanceModeOverrideChange={noop}
      />,
    );
    openDetail();
    // En BREAKDOWN los headers de sección y la base imponible se conservan.
    expect(screen.getByTestId("total-card-section-header-TAXES")).toBeTruthy();
    expect(screen.getByTestId("total-card-taxable-base")).toBeTruthy();
  });
});
