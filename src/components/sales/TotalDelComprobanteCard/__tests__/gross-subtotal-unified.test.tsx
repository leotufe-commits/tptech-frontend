// src/components/sales/TotalDelComprobanteCard/__tests__/gross-subtotal-unified.test.tsx
// =============================================================================
// "Valor bruto" en el detalle financiero UNIFICADO.
//
// Objetivo: en el footer de Factura ("Ver detalle financiero"), modo UNIFICADO,
// se agrega UNA fila "Valor bruto" ARRIBA de "Promociones y descuentos"
// (componente DISCOUNT_QTY), con el valor `documentTotals.subtotalBeforeDiscounts`
// (passthrough → prop `grossSubtotal`). Así el detalle queda auto-reconciliable:
//   bruto − descuentos + IVA + redondeo financiero = total.
//
// Guard exacto (en MonetarySummary):
//   · SOLO modo UNIFICADO (`!isBreakdown`) — NO `compact` (que también es true
//     en BREAKDOWN con `flatDetail`).
//   · `grossSubtotal` finito y > 0.
//
// Casos: UNIFICADO + grossSubtotal > 0 → muestra (antes de DISCOUNT_QTY);
//        DESGLOSADO → NO muestra; null/0 → NO muestra.
// =============================================================================

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TotalDelComprobanteCard } from "../TotalDelComprobanteCard";
import type { BalanceBreakdownDTO } from "../../../../services/sales";

const noop = () => undefined;

/** Breakdown con un descuento de línea (DISCOUNT_QTY) + IVA. */
function bdWithComponents(metals: BalanceBreakdownDTO["metals"] = []): BalanceBreakdownDTO {
  return {
    metals,
    monetaryBalance: {
      amount: 1210, currencyCode: "ARS", currencyRate: 1, amountBase: 1210,
      components: [
        { type: "HECHURA",      group: "HECHURA",  label: "Hechura",            amount: 1000 },
        { type: "DISCOUNT_QTY", group: "DISCOUNT", label: "Descuentos de línea", amount: -100 },
        { type: "TAX",          group: "TAX",      label: "IVA",                amount: 210 },
      ],
    },
  };
}

const metalForBreakdown: BalanceBreakdownDTO["metals"] = [{
  metalParentId: "oro-fino", metalParentName: "Oro Fino",
  gramsOriginal: 1, purity: 1, gramsPure: 1,
  quotePriceSnapshot: 100, valuationMonetary: 100,
  valuationCurrencyCode: "ARS", sourceLineIds: ["L-1"],
}];

function openDetail() {
  fireEvent.click(screen.getByTestId("total-card-composicion-toggle"));
}

describe('"Valor bruto" — detalle financiero UNIFICADO', () => {
  it("UNIFICADO + grossSubtotal=657471.37 → renderiza 'Valor bruto' ANTES de DISCOUNT_QTY", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdWithComponents()}
        grossSubtotal={657471.37}
        onBalanceModeOverrideChange={noop}
      />,
    );
    openDetail();

    const gross = screen.getByTestId("total-card-gross-subtotal");
    expect(gross).toBeTruthy();
    // Monto formateado con el preset del tenant (default es-AR → 657.471,37).
    expect(gross.textContent).toContain("657.471,37");
    expect(gross.textContent).toContain("Precio");

    // Orden DOM: "Valor bruto" debe estar ANTES del componente DISCOUNT_QTY
    // ("Promociones y descuentos").
    const discount = screen.getByTestId("total-card-component-DISCOUNT_QTY");
    const pos = gross.compareDocumentPosition(discount);
    // DOCUMENT_POSITION_FOLLOWING (4) ⇒ `discount` viene DESPUÉS de `gross`.
    expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("DESGLOSADO (isBreakdown=true) → NO muestra 'Valor bruto' aunque se provea", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdWithComponents(metalForBreakdown)}
        grossSubtotal={657471.37}
        onBalanceModeOverrideChange={noop}
      />,
    );
    openDetail();
    expect(screen.queryByTestId("total-card-gross-subtotal")).toBeNull();
  });

  it("UNIFICADO + grossSubtotal=null → NO muestra la fila", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdWithComponents()}
        grossSubtotal={null}
        onBalanceModeOverrideChange={noop}
      />,
    );
    openDetail();
    expect(screen.queryByTestId("total-card-gross-subtotal")).toBeNull();
  });

  it("UNIFICADO + grossSubtotal=0 → NO muestra la fila (guard > 0)", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdWithComponents()}
        grossSubtotal={0}
        onBalanceModeOverrideChange={noop}
      />,
    );
    openDetail();
    expect(screen.queryByTestId("total-card-gross-subtotal")).toBeNull();
  });
});
