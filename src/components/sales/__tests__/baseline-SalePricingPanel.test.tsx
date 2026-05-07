// src/components/sales/__tests__/baseline-SalePricingPanel.test.tsx
// =============================================================================
// FASE 1.0 — PR1 baseline. Congela el comportamiento de render del panel
// SalePricingPanel. Cubre Priority 3 (componente) y Priority 7
// (splitLineDiscounts — interno, se valida via DOM rendered).
//
// El panel es 100% lector del ViewModel `normalizeSalesPreview(result)`.
// Estos tests verifican que para un input dado, el DOM muestra exactamente
// los números esperados — congelando el comportamiento ANTES de la migración
// que reemplazará `splitLineDiscounts` por campos doc-level del backend.
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SalePricingPanel from "../SalePricingPanel";

// Helper para armar un SalePreviewResult mock minimal.
function makeResult(overrides: any = {}) {
  return {
    lines: [
      {
        articleId: "art-1",
        variantId: null,
        quantity:  2,
        basePrice: 1000,
        unitPrice: 900,
        unitTaxAmount:    189,
        unitTotalWithTax: 1089,
        quantityDiscountAmount:  50,    // per-unit
        promotionDiscountAmount: 0,
        lineTotal:        1800,
        lineTaxAmount:    378,
        lineTotalWithTax: 2178,
        lineDiscount:     200,
        priceSource:          "PRICE_LIST",
        appliedPriceListId:   "pl-1",
        appliedPriceListName: "Lista A",
        appliedPriceListMode: null,
        appliedPromotionId:   null,
        appliedPromotionName: null,
        appliedDiscountId:    null,
        unitCost:      500,
        unitMargin:    400,
        marginPercent: 44.44,
        costMode:      "COST_LINES",
        costPartial:   false,
        taxBreakdown:  [],
        appliedRounding: null,
        metalHechuraBreakdown: null,
      },
    ],
    documentTotals: {
      subtotalBeforeDiscounts:    2000,
      lineDiscountAmount:         200,
      subtotalAfterLineDiscounts: 1800,
      channelAdjustmentAmount:    0,
      couponDiscountAmount:       0,
      paymentAdjustmentAmount:    0,
      shippingAmount:             0,
      globalDiscountAmount:       0,
      taxableBase:                1800,
      taxAmount:                  378,
      roundingAdjustment:         0,
      totalBeforeTax:             1800,
      totalWithTax:               2178,
      total:                      2178,
    },
    channelResult:  null,
    couponResult:   null,
    checkoutResult: null,
    ...overrides,
  };
}

// Helper que busca una fila <Row label … value> por su label.
// Usa queryAllByText + filtro por estructura (parent con dos spans: label + value).
// Devuelve el value del PRIMER match — el panel tiene secciones que pueden
// repetir labels (ej. tax block), pero los Row de DocumentTotalsBlock vienen
// primero en el DOM.
function getRowValue(label: string): string | null {
  const matches = screen.queryAllByText(label);
  for (const labelEl of matches) {
    const parent = labelEl.parentElement;
    if (!parent) continue;
    const spans = parent.querySelectorAll("span");
    if (spans.length >= 2) {
      return spans[1].textContent;
    }
  }
  return null;
}

// =============================================================================
// 1. Sin result → empty state
// =============================================================================

describe("SalePricingPanel — sin result", () => {
  it("baseline correct: muestra el emptyText configurable", () => {
    render(<SalePricingPanel result={null} emptyText="Sin preview disponible" />);
    expect(screen.getByText("Sin preview disponible")).toBeInTheDocument();
  });

  it("baseline correct: muestra fallback genérico cuando emptyText no se pasa", () => {
    render(<SalePricingPanel result={null} />);
    // El fallback genérico está visible (cualquier texto en italic dentro del div)
    const empty = document.querySelector(".italic");
    expect(empty).toBeInTheDocument();
  });
});

// =============================================================================
// 2. Render básico — passthrough de documentTotals
// =============================================================================

describe("SalePricingPanel — passthrough de documentTotals", () => {
  it("baseline correct: muestra Total = dt.total", () => {
    render(
      <SalePricingPanel
        result={makeResult() as any}
        currencySymbol="ARS"
        hideComposition
      />,
    );
    expect(getRowValue("Total")).toMatch(/2\.178,00/);
  });

  it("baseline correct: muestra Subtotal (lista) = dt.subtotalBeforeDiscounts", () => {
    render(
      <SalePricingPanel
        result={makeResult() as any}
        currencySymbol="ARS"
        hideComposition
      />,
    );
    expect(getRowValue("Subtotal (lista)")).toMatch(/2\.000,00/);
  });

  it("baseline correct: muestra Base imponible = dt.taxableBase", () => {
    render(
      <SalePricingPanel
        result={makeResult() as any}
        currencySymbol="ARS"
        hideComposition
      />,
    );
    expect(getRowValue("Base imponible")).toMatch(/1\.800,00/);
  });

  it("baseline correct: muestra Impuestos = dt.taxAmount", () => {
    render(
      <SalePricingPanel
        result={makeResult() as any}
        currencySymbol="ARS"
        hideComposition
      />,
    );
    expect(getRowValue("Impuestos")).toMatch(/378,00/);
  });
});

// =============================================================================
// 3. splitLineDiscounts (legacy) — se observa via DOM
// =============================================================================

describe("SalePricingPanel — splitLineDiscounts (legacy)", () => {
  it("baseline legacy: descuento por cantidad = round2(Σ qty × qtyDiscUnit)", () => {
    // Línea: qty=2, qtyDiscUnit=50 → 100. Promo=0.
    const result = makeResult();
    render(
      <SalePricingPanel
        result={result as any}
        currencySymbol="ARS"
        hideComposition
      />,
    );
    // El split se muestra cuando qty+promo+customer > 0 OR total === 0.
    // Acá qty=100 > 0, entonces vemos las 3 filas separadas.
    expect(getRowValue("Descuento por cantidad")).toMatch(/-100,00/);
    expect(getRowValue("Promoción")).toMatch(/-0,00|0,00/);
    expect(getRowValue("Descuento de cliente")).toBe("—");
  });

  it("baseline legacy: split incluye promotion cuando promoDiscUnit > 0", () => {
    const result = makeResult({
      lines: [
        {
          ...makeResult().lines[0],
          quantityDiscountAmount:  0,
          promotionDiscountAmount: 30,
        },
      ],
    });
    render(
      <SalePricingPanel
        result={result as any}
        currencySymbol="ARS"
        hideComposition
      />,
    );
    // qty=2, promo=30 → 60
    expect(getRowValue("Promoción")).toMatch(/-60,00/);
  });

  it("baseline correct: cuando split da 0 y total > 0, muestra solo 'Descuentos de línea'", () => {
    // Caso defensivo: lineDiscountAmount > 0 pero el motor no envió per-unit
    // por línea (datos legacy).
    const result = makeResult({
      lines: [
        {
          ...makeResult().lines[0],
          quantityDiscountAmount:  0,
          promotionDiscountAmount: 0,
        },
      ],
      documentTotals: {
        ...makeResult().documentTotals,
        lineDiscountAmount: 200, // existe pero no se puede splitear
      },
    });
    render(
      <SalePricingPanel
        result={result as any}
        currencySymbol="ARS"
        hideComposition
      />,
    );
    // Cuando qty=0 && promo=0 && customer=null && total > 0 → fallback
    expect(getRowValue("Descuentos de línea")).toMatch(/-200,00/);
    // No debería aparecer la fila splittadas
    expect(screen.queryByText("Descuento por cantidad")).toBeNull();
  });

  it("baseline correct: customer siempre '—' (POLICY R4.4 — no derivar)", () => {
    const result = makeResult({
      // Setup que dispara split (qty>0)
      lines: [
        {
          ...makeResult().lines[0],
          quantityDiscountAmount: 50,
        },
      ],
    });
    render(
      <SalePricingPanel
        result={result as any}
        currencySymbol="ARS"
        hideComposition
      />,
    );
    expect(getRowValue("Descuento de cliente")).toBe("—");
  });
});

// =============================================================================
// 4. Channel / coupon / payment / shipping passthrough
// =============================================================================

describe("SalePricingPanel — adjustments passthrough", () => {
  it("baseline correct: muestra Ajuste por canal = dt.channelAdjustmentAmount", () => {
    const result = makeResult({
      channelResult: { channelId: "ch-1", channelName: "Web", channelAmount: 50 },
      documentTotals: {
        ...makeResult().documentTotals,
        channelAdjustmentAmount: 50,
      },
    });
    render(
      <SalePricingPanel result={result as any} currencySymbol="ARS" hideComposition />,
    );
    expect(getRowValue("Ajuste por canal")).toMatch(/50,00/);
  });

  it("baseline correct: muestra Descuento por cupón con signo negativo", () => {
    const result = makeResult({
      couponResult: { couponCode: "DESC10", applied: true, discountAmount: 100 },
      documentTotals: {
        ...makeResult().documentTotals,
        couponDiscountAmount: 100,
      },
    });
    render(
      <SalePricingPanel result={result as any} currencySymbol="ARS" hideComposition />,
    );
    expect(getRowValue("Descuento por cupón")).toMatch(/-100,00/);
  });

  it("baseline correct: muestra Envío cuando shippingAmount > 0", () => {
    const result = makeResult({
      documentTotals: {
        ...makeResult().documentTotals,
        shippingAmount: 500,
      },
    });
    render(
      <SalePricingPanel result={result as any} currencySymbol="ARS" hideComposition />,
    );
    expect(getRowValue("Envío")).toMatch(/500,00/);
  });

  it("baseline correct: muestra Recargo / descuento de pago", () => {
    const result = makeResult({
      documentTotals: {
        ...makeResult().documentTotals,
        paymentAdjustmentAmount: -25,
      },
    });
    render(
      <SalePricingPanel result={result as any} currencySymbol="ARS" hideComposition />,
    );
    expect(getRowValue("Recargo / descuento de pago")).toMatch(/-25,00/);
  });
});

// =============================================================================
// 5. Resilencia — normalizer fallido
// =============================================================================

describe("SalePricingPanel — resilencia", () => {
  it("baseline correct: shape inválido NO tumba la pantalla, muestra warning amber", () => {
    // Forzar fallo del normalizer pasando lines como string (.map no existe).
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const broken = { lines: "not-an-array", documentTotals: {} };
    const { container } = render(
      <SalePricingPanel result={broken as any} hideComposition />,
    );
    // El panel cayó al render del warning amber.
    expect(container.querySelector(".text-amber-600, .text-amber-400")).not.toBeNull();
    consoleWarnSpy.mockRestore();
  });
});
