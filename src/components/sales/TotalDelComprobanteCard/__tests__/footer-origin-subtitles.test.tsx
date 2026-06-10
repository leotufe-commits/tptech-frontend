// src/components/sales/TotalDelComprobanteCard/__tests__/footer-origin-subtitles.test.tsx
// =============================================================================
// Origen VISIBLE en pantalla por fila de impacto (no solo tooltip).
// Cada fila que modifica el total muestra: label principal + origen secundario.
// =============================================================================

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TotalDelComprobanteCard } from "../TotalDelComprobanteCard";
import type { BalanceBreakdownDTO } from "../../../../services/sales";

const noop = () => undefined;

function bdConImpactos(): BalanceBreakdownDTO {
  return {
    metals: [],
    monetaryBalance: {
      amount: 100000, currencyCode: "ARS", currencyRate: 1, amountBase: 100000,
      components: [
        { type: "CHANNEL",         group: "CHANNEL",  label: "Sitio",            amount: 33664.47 },
        { type: "DISCOUNT_QTY",    group: "DISCOUNT", label: "Descuentos línea", amount: -74809.93 },
        { type: "DISCOUNT_MANUAL", group: "DISCOUNT", label: "Descuento global", amount: -67328.94 },
        { type: "COUPON",          group: "COUPON",   label: "CUPON",            amount: -106043.08 },
        { type: "TAX",             group: "TAX",      label: "IVA",              amount: 112052.18 },
        { type: "SHIPPING",        group: "SHIPPING", label: "Envío",            amount: 15000.50 },
      ],
    },
  };
}

function render_() {
  render(
    <TotalDelComprobanteCard
      totalDocument={100000}
      currencyCode="ARS"
      balanceMode="UNIFIED"
      balanceBreakdown={bdConImpactos()}
      taxableBase={533000}
      onBalanceModeOverrideChange={noop}
    />,
  );
  fireEvent.click(screen.getByTestId("total-card-composicion-toggle"));
}

describe("Footer — origen visible por fila de impacto", () => {
  it("CHANNEL: label 'Sitio' + origen 'Canal de venta'", () => {
    render_();
    const o = screen.getByTestId("total-card-component-CHANNEL-origin");
    expect(o.textContent).toBe("Canal de venta");
  });

  it("COUPON: label 'CUPON' + origen 'Cupón aplicado manualmente'", () => {
    render_();
    expect(screen.getByTestId("total-card-component-COUPON-origin").textContent)
      .toBe("Cupón aplicado manualmente");
  });

  it("DISCOUNT_QTY: 'Promociones y descuentos' + origen 'Promoción automática / por línea'", () => {
    render_();
    const row = screen.getByTestId("total-card-component-DISCOUNT_QTY");
    expect(row.textContent).toContain("Promociones y descuentos");
    expect(screen.getByTestId("total-card-component-DISCOUNT_QTY-origin").textContent)
      .toBe("Promoción automática / por línea");
  });

  it("DISCOUNT_MANUAL: 'Descuento global' + origen 'Manual del comprobante'", () => {
    render_();
    expect(screen.getByTestId("total-card-component-DISCOUNT_MANUAL-origin").textContent)
      .toBe("Manual del comprobante");
  });

  it("TAX: 'IVA' + origen 'Impuesto sobre base imponible'", () => {
    render_();
    expect(screen.getByTestId("total-card-component-TAX-origin").textContent)
      .toBe("Impuesto sobre base imponible");
  });

  it("SHIPPING: 'Envío' + origen 'Envío del comprobante'", () => {
    render_();
    expect(screen.getByTestId("total-card-component-SHIPPING-origin").textContent)
      .toBe("Envío del comprobante");
  });
});
