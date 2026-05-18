// src/components/sales/SaleLinePricingPanel.test.tsx
// ============================================================================
// Tests del panel de Factura. Cubren:
//   - degradación cuando no hay pricingMeta
//   - lazy: el panel colapsado NO renderiza los hijos
//   - render con expanded=true
//   - estado local cuando expanded no es controlado
// ============================================================================

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SaleLinePricingPanel } from "./SaleLinePricingPanel";
import type { SalePreviewLine } from "../../services/sales";

function makeLine(o: Partial<SalePreviewLine> = {}): SalePreviewLine {
  return {
    articleId:        "a1",
    variantId:        null,
    quantity:         1,
    unitPrice:        1000,
    basePrice:        1000,
    lineSubtotal:     1000,
    lineTotal:        1000,
    lineDiscount:     0,
    unitTaxAmount:    0,
    unitTotalWithTax: 1000,
    lineTaxAmount:    0,
    lineTotalWithTax: 1000,
    quantityDiscountAmount:  null,
    promotionDiscountAmount: null,
    priceSource:          "PRICE_LIST",
    appliedPriceListId:   "pl1",
    appliedPriceListName: "General",
    appliedPromotionId:   null,
    appliedPromotionName: null,
    appliedDiscountId:    null,
    unitCost:             600,
    unitMargin:           400,
    marginPercent:        40,
    markupPercent:        66.67,
    costPartial:          false,
    costMode:             "MANUAL",
    policy:               { canConfirm: true, blockingAlerts: [] },
    taxBreakdown:         [],
    metalHechuraBreakdown: null,
    pricingSnapshot:      {
      unitPrice: 1000, basePrice: 1000, discountAmount: 0, taxAmount: 0,
      totalWithTax: 1000, priceSource: "PRICE_LIST", baseSource: "PRICE_LIST",
      unitCost: 600, unitMargin: 400, marginPercent: 40, markupPercent: 66.67,
      costPartial: false, costMode: "MANUAL", partial: false,
      appliedPriceListId: "pl1", appliedPriceListName: "General",
      appliedPromotionId: null, appliedPromotionName: null,
      appliedDiscountId: null, resolvedAt: new Date().toISOString(),
    },
    ...o,
  } as SalePreviewLine;
}

describe("<SaleLinePricingPanel />", () => {
  it("renderiza null si no hay pricingMeta", () => {
    const { container } = render(<SaleLinePricingPanel pricingMeta={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renderiza el header colapsable cuando hay pricingMeta", () => {
    render(<SaleLinePricingPanel pricingMeta={makeLine()} />);
    expect(screen.getByText("Ver composición y flujo de precio")).toBeTruthy();
  });

  it("LAZY: con expanded=false no renderiza hijos pesados", () => {
    render(<SaleLinePricingPanel pricingMeta={makeLine()} expanded={false} />);
    // No se renderiza el header "Costo unitario" de CostCompositionBlock
    expect(screen.queryByText("Costo unitario")).toBeNull();
  });

  it("con expanded=true renderiza CostCompositionBlock + PricingStepsBreakdown", () => {
    render(<SaleLinePricingPanel pricingMeta={makeLine()} expanded={true} />);
    // Header del CostCompositionBlock en variant=compact NO existe (sin wrapper)
    // pero el body sí: testid pricing-steps-body
    expect(screen.getByTestId("pricing-steps-body")).toBeTruthy();
  });

  it("con expanded controlado, dispara onToggle al click en header", () => {
    let toggled = 0;
    render(
      <SaleLinePricingPanel pricingMeta={makeLine()} expanded={false} onToggle={() => { toggled++; }} />
    );
    fireEvent.click(screen.getByText("Ver composición y flujo de precio"));
    expect(toggled).toBe(1);
  });

  it("estado local: arranca colapsado y se expande al click", () => {
    render(<SaleLinePricingPanel pricingMeta={makeLine()} />);
    expect(screen.queryByTestId("pricing-steps-body")).toBeNull();
    fireEvent.click(screen.getByText("Ver composición y flujo de precio"));
    expect(screen.getByTestId("pricing-steps-body")).toBeTruthy();
  });

  it("hideHeader=true oculta el toggle propio", () => {
    render(<SaleLinePricingPanel pricingMeta={makeLine()} expanded={true} hideHeader={true} />);
    expect(screen.queryByText("Ver composición y flujo de precio")).toBeNull();
    expect(screen.getByTestId("pricing-steps-body")).toBeTruthy();
  });
});
