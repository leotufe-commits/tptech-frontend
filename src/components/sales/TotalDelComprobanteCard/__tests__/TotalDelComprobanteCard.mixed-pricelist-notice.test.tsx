// src/components/sales/TotalDelComprobanteCard/__tests__/TotalDelComprobanteCard.mixed-pricelist-notice.test.tsx
// =============================================================================
// Aviso LISTAS MIXTAS (2026-06-03) — UI informativa pura.
//
// Cuando el comprobante usa múltiples listas de precios (preview
// `appliedPriceListId === "MIXED"` → prop `priceListMixed`), el backend entra
// en MIXED_LIST_FALLBACK y el redondeo comercial PER_DOCUMENT se desactiva. El
// card muestra un aviso explicando el cambio visual. NO altera totales.
//
// Contrato:
//   · Una sola lista (priceListMixed falsy) → NO se muestra el aviso.
//   · Listas mixtas (priceListMixed=true)   → se muestra el aviso + mensaje.
//   · El Total del comprobante NO cambia por la presencia del aviso.
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TotalDelComprobanteCard } from "../TotalDelComprobanteCard";

const noop = () => undefined;

function renderCard(priceListMixed: boolean | undefined) {
  return render(
    <TotalDelComprobanteCard
      totalDocument={943000}
      currencyCode="ARS"
      balanceMode="UNIFIED"
      balanceModeSource="TENANT_DEFAULT"
      balanceBreakdown={null}
      priceListMixed={priceListMixed}
      balanceModeOverride={null}
      onBalanceModeOverrideChange={noop}
      engineTotal={943000}
      manualAdjustment={null}
      manualAdjustmentDraft={null}
      onManualAdjustmentChange={vi.fn()}
    />,
  );
}

describe("TotalDelComprobanteCard — aviso listas mixtas", () => {
  it("una sola lista (priceListMixed=false) → NO muestra el aviso", () => {
    renderCard(false);
    expect(screen.queryByTestId("total-card-mixed-pricelist-notice")).toBeNull();
  });

  it("priceListMixed ausente (undefined) → NO muestra el aviso", () => {
    renderCard(undefined);
    expect(screen.queryByTestId("total-card-mixed-pricelist-notice")).toBeNull();
  });

  it("listas mixtas (priceListMixed=true) → muestra el aviso con el mensaje", () => {
    renderCard(true);
    const notice = screen.getByTestId("total-card-mixed-pricelist-notice");
    expect(notice).toBeTruthy();
    expect(notice.textContent).toContain("múltiples listas de precios");
    expect(notice.textContent).toContain("se desactiva");
  });

  it("el aviso NO cambia el Total del comprobante", () => {
    const { rerender } = renderCard(false);
    const totalSin = screen.getByTestId("total-card-amount").textContent;

    rerender(
      <TotalDelComprobanteCard
        totalDocument={943000}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceModeSource="TENANT_DEFAULT"
        balanceBreakdown={null}
        priceListMixed={true}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noop}
        engineTotal={943000}
        manualAdjustment={null}
        manualAdjustmentDraft={null}
        onManualAdjustmentChange={vi.fn()}
      />,
    );
    const totalCon = screen.getByTestId("total-card-amount").textContent;
    // El aviso aparece…
    expect(screen.getByTestId("total-card-mixed-pricelist-notice")).toBeTruthy();
    // …pero el Total renderizado es idéntico (cero impacto en cálculo).
    expect(totalCon).toBe(totalSin);
  });
});
