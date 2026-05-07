// src/components/ui/__tests__/baseline-totals-display-components.test.tsx
// =============================================================================
// FASE 1.0 — PR1 baseline. Cubre Priority 4 (TPDocumentTotalsCard +
// TPDocumentTotalsHero) y Priority 5 (TPPriceCompositionKpis).
//
// Estos componentes son passthrough puros del ViewModel. Los tests verifican
// que para un input dado el DOM muestra los valores esperados — sin recálculo.
//
// - TPDocumentTotalsCard: cobertura completa (props/modes/rounding).
// - TPDocumentTotalsHero: smoke test (render no tumba, total visible).
// - TPPriceCompositionKpis: smoke test (passthrough de campos clave).
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TPDocumentTotalsCard } from "../TPDocumentTotalsCard";
import { TPDocumentTotalsHero } from "../TPDocumentTotalsHero";
import TPPriceCompositionKpis from "../TPPriceCompositionKpis";

// =============================================================================
// 1. TPDocumentTotalsCard — cobertura completa (Priority 4)
// =============================================================================

describe("TPDocumentTotalsCard — mode='quote'", () => {
  it("baseline correct: muestra 4 celdas (Subtotal, Descuentos, Impuestos, Total)", () => {
    render(
      <TPDocumentTotalsCard
        subtotal={1000}
        discountAmount={100}
        taxAmount={189}
        total={1089}
        currency="ARS"
        mode="quote"
      />,
    );
    expect(screen.getByText("Subtotal")).toBeInTheDocument();
    expect(screen.getByText("Descuentos")).toBeInTheDocument();
    expect(screen.getByText("Impuestos")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
    // No celdas de invoice
    expect(screen.queryByText("Cobrado")).toBeNull();
    expect(screen.queryByText("Saldo")).toBeNull();
  });

  it("baseline correct: passthrough de los montos formateados es-AR", () => {
    render(
      <TPDocumentTotalsCard
        subtotal={1234.56}
        discountAmount={50}
        taxAmount={249.04}
        total={1433.6}
        currency="ARS"
        mode="quote"
      />,
    );
    // fmtMoney redondea a 2 decimales y aplica separador es-AR
    expect(screen.getByText(/ARS\s+1\.234,56/)).toBeInTheDocument();
    expect(screen.getByText(/ARS\s+1\.433,60/)).toBeInTheDocument();
  });

  it("baseline correct: totalLabel override muestra 'Total final' (Presupuestos)", () => {
    render(
      <TPDocumentTotalsCard
        subtotal={1000}
        discountAmount={0}
        taxAmount={210}
        total={1210}
        currency="ARS"
        mode="quote"
        totalLabel="Total final"
      />,
    );
    expect(screen.getByText("Total final")).toBeInTheDocument();
    expect(screen.queryByText("Total")).toBeNull();
  });

  it("baseline correct: discountLabel singular 'Descuento' (compras)", () => {
    render(
      <TPDocumentTotalsCard
        subtotal={1000}
        discountAmount={50}
        taxAmount={210}
        total={1160}
        currency="ARS"
        mode="quote"
        discountLabel="Descuento"
      />,
    );
    expect(screen.getByText("Descuento")).toBeInTheDocument();
    expect(screen.queryByText("Descuentos")).toBeNull();
  });
});

describe("TPDocumentTotalsCard — mode='invoice'", () => {
  it("baseline correct: muestra 6 celdas con Cobrado y Saldo", () => {
    render(
      <TPDocumentTotalsCard
        subtotal={1000}
        discountAmount={0}
        taxAmount={210}
        total={1210}
        paidAmount={500}
        balance={710}
        currency="ARS"
        mode="invoice"
      />,
    );
    expect(screen.getByText("Cobrado")).toBeInTheDocument();
    expect(screen.getByText("Saldo")).toBeInTheDocument();
    expect(screen.getByText(/ARS\s+500,00/)).toBeInTheDocument();
    expect(screen.getByText(/ARS\s+710,00/)).toBeInTheDocument();
  });

  it("baseline correct: paidAmount=0 muestra '—' en Cobrado", () => {
    const { container } = render(
      <TPDocumentTotalsCard
        subtotal={1000}
        discountAmount={0}
        taxAmount={210}
        total={1210}
        paidAmount={0}
        balance={1210}
        currency="ARS"
        mode="invoice"
      />,
    );
    // El "—" aparece en alguna celda del card (Cobrado en este caso)
    expect(container.textContent).toContain("—");
    expect(screen.getByText("Cobrado")).toBeInTheDocument();
  });

  it("baseline correct: balance=0 muestra '—' en celda Saldo", () => {
    const { container } = render(
      <TPDocumentTotalsCard
        subtotal={1000}
        discountAmount={0}
        taxAmount={210}
        total={1210}
        paidAmount={1210}
        balance={0}
        currency="ARS"
        mode="invoice"
      />,
    );
    expect(screen.getByText("Saldo")).toBeInTheDocument();
    expect(container.textContent).toContain("—");
  });

  it("baseline correct: paidLabel='Pagado' (compras)", () => {
    render(
      <TPDocumentTotalsCard
        subtotal={1000}
        discountAmount={0}
        taxAmount={210}
        total={1210}
        paidAmount={500}
        balance={710}
        currency="ARS"
        mode="invoice"
        paidLabel="Pagado"
      />,
    );
    expect(screen.getByText("Pagado")).toBeInTheDocument();
    expect(screen.queryByText("Cobrado")).toBeNull();
  });
});

describe("TPDocumentTotalsCard — taxPercent y rounding", () => {
  it("baseline correct: taxPercent>0 agrega '(X%)' al label de impuestos", () => {
    render(
      <TPDocumentTotalsCard
        subtotal={1000}
        discountAmount={0}
        taxAmount={210}
        total={1210}
        taxPercent={21}
        currency="ARS"
        mode="quote"
      />,
    );
    expect(screen.getByText("Impuestos (21%)")).toBeInTheDocument();
  });

  it("baseline correct: taxPercent=0 NO agrega el sufijo", () => {
    render(
      <TPDocumentTotalsCard
        subtotal={1000}
        discountAmount={0}
        taxAmount={0}
        total={1000}
        taxPercent={0}
        currency="ARS"
        mode="quote"
      />,
    );
    expect(screen.getByText("Impuestos")).toBeInTheDocument();
    expect(screen.queryByText("Impuestos (0%)")).toBeNull();
  });

  it("baseline correct: roundingAdjustment>=0.01 agrega celda 'Redondeo lista de precios'", () => {
    render(
      <TPDocumentTotalsCard
        subtotal={1000}
        discountAmount={0}
        taxAmount={210}
        total={1209.5}
        roundingAdjustment={-0.5}
        currency="ARS"
        mode="quote"
      />,
    );
    expect(screen.getByText("Redondeo lista de precios")).toBeInTheDocument();
    // Signo negativo
    expect(screen.getByText(/−ARS\s+0,50/)).toBeInTheDocument();
  });

  it("baseline correct: roundingSource='TENANT_POLICY' cambia el label a 'Redondeo comprobante'", () => {
    render(
      <TPDocumentTotalsCard
        subtotal={1000}
        discountAmount={0}
        taxAmount={210}
        total={1210.5}
        roundingAdjustment={0.5}
        roundingSource="TENANT_POLICY"
        currency="ARS"
        mode="quote"
      />,
    );
    expect(screen.getByText("Redondeo comprobante")).toBeInTheDocument();
    expect(screen.queryByText("Redondeo lista de precios")).toBeNull();
  });

  it("baseline correct: roundingAdjustment<0.01 NO renderiza la celda", () => {
    render(
      <TPDocumentTotalsCard
        subtotal={1000}
        discountAmount={0}
        taxAmount={210}
        total={1210}
        roundingAdjustment={0.005}
        currency="ARS"
        mode="quote"
      />,
    );
    expect(screen.queryByText("Redondeo lista de precios")).toBeNull();
    expect(screen.queryByText("Redondeo comprobante")).toBeNull();
  });
});

// =============================================================================
// 2. TPDocumentTotalsHero — smoke test (Priority 4)
// =============================================================================

function makeComposition(overrides: any = {}) {
  return {
    subtotalGross:    2000,
    priceListName:    "Lista A",
    priceListNamesUnique: ["Lista A"],
    customerDiscount: null,
    customerDiscountApplyOn: null,
    customerDiscountPercent: null,
    manualDiscount:    null,
    channelAdjustment: null,
    channelName:       null,
    quantityDiscount:  null,
    promotion:         null,
    promotionName:     null,
    coupon:            null,
    couponName:        null,
    couponCode:        null,
    globalDiscount:    null,
    subtotalNet:       1800,
    shipping:          null,
    paymentAdjustment: null,
    taxes:             [],
    taxTotal:          0,
    rounding:          0,
    roundingInfo:      null,
    total:             2178,
    fromBackend:       true,
    ...overrides,
  };
}

describe("TPDocumentTotalsHero — smoke", () => {
  it("baseline correct: render con composition mínima no tumba y muestra el total", () => {
    const onChange = vi.fn();
    const { container } = render(
      <TPDocumentTotalsHero
        composition={makeComposition() as any}
        currency="ARS"
        viewMode="unified"
        onViewModeChange={onChange}
      />,
    );
    // El total debe estar en el DOM
    expect(container.textContent).toMatch(/2\.178,00/);
  });

  it("baseline correct: totalLabel custom 'Total a pagar' aparece", () => {
    const onChange = vi.fn();
    render(
      <TPDocumentTotalsHero
        composition={makeComposition() as any}
        currency="ARS"
        viewMode="unified"
        onViewModeChange={onChange}
        totalLabel="Total a pagar"
      />,
    );
    expect(screen.getByText("Total a pagar")).toBeInTheDocument();
  });

  it("baseline correct: composition con fromBackend=false NO tumba el render", () => {
    const onChange = vi.fn();
    const composition = makeComposition({
      fromBackend:    false,
      subtotalGross:  null,
      subtotalNet:    null,
      total:          1500,
    });
    const { container } = render(
      <TPDocumentTotalsHero
        composition={composition as any}
        currency="ARS"
        viewMode="unified"
        onViewModeChange={onChange}
      />,
    );
    // Total fallback se muestra
    expect(container.textContent).toMatch(/1\.500,00/);
  });
});

// =============================================================================
// 3. TPPriceCompositionKpis — smoke + passthrough (Priority 5)
// =============================================================================

describe("TPPriceCompositionKpis — smoke", () => {
  it("baseline correct: sin datos muestra emptyText", () => {
    render(<TPPriceCompositionKpis emptyText="No hay datos" />);
    expect(screen.getByText("No hay datos")).toBeInTheDocument();
  });

  it("baseline correct: passthrough de subtotal / taxAmount / total", () => {
    const { container } = render(
      <TPPriceCompositionKpis
        subtotal={1000}
        taxAmount={210}
        total={1210}
        currencySymbol="ARS"
        view="sale"
      />,
    );
    expect(container.textContent).toMatch(/1\.000,00/);
    expect(container.textContent).toMatch(/210,00/);
    expect(container.textContent).toMatch(/1\.210,00/);
  });

  it("baseline correct: passthrough de costBase / costWithTax cuando view='cost'", () => {
    const { container } = render(
      <TPPriceCompositionKpis
        costBase={500}
        costTaxAmount={105}
        costWithTax={605}
        currencySymbol="ARS"
        view="cost"
      />,
    );
    expect(container.textContent).toMatch(/500,00/);
    expect(container.textContent).toMatch(/605,00/);
  });

  it("baseline correct: marginPercent passthrough sin recálculo", () => {
    const { container } = render(
      <TPPriceCompositionKpis
        subtotal={1000}
        taxAmount={0}
        total={1000}
        marginPercent={42.5}
        currencySymbol="ARS"
        view="sale"
      />,
    );
    expect(container.textContent).toMatch(/42,5/);
  });

  it("baseline correct: metalHechuraBreakdown passthrough — metalSale visible", () => {
    const { container } = render(
      <TPPriceCompositionKpis
        subtotal={1000}
        total={1210}
        taxAmount={210}
        metalHechuraBreakdown={{
          metalCost:        600,
          metalSale:        750,
          metalMarginPct:   25,
          hechuraCost:      200,
          hechuraSale:      250,
          hechuraMarginPct: 25,
        }}
        currencySymbol="ARS"
        view="sale"
        priceListMode="METAL_HECHURA"
      />,
    );
    expect(container.textContent).toMatch(/750,00/);
    expect(container.textContent).toMatch(/250,00/);
  });
});
