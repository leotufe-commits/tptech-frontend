// src/components/ui/__tests__/g4-1-line-advanced-overrides-panel-product-service.test.tsx
// =============================================================================
// FASE F1.3 G4.1 #8b — render PRODUCT/SERVICE en LineAdvancedOverridesPanel.
//
// Cubre los problemas detectados en QA visual del usuario:
//   1. PRODUCT/SERVICE ahora SÍ aparecen visualmente en el panel.
//   2. Múltiples items del mismo tipo se renderean (no solo el primero).
//   3. Gramos en summary y en input usan 2 decimales (1.30 g, no 1.300 g).
//
// Reader-only — no se alteran totales ni se recalcula nada.
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LineAdvancedOverridesPanel } from "../LineAdvancedOverridesPanel";
import type { DocumentLine } from "../../../lib/document-types";

function makeLine(overrides: Partial<DocumentLine["pricingMeta"]> = {}): DocumentLine {
  return {
    id:               "line-1",
    type:             "ARTICLE",
    article:          "Anillo Test",
    variant:          "",
    articleId:        "art-1",
    quantity:         1,
    unitPrice:        900,
    discountAmount:   0,
    subtotal:         900,
    taxAmount:        0,
    lineTotal:        900,
    lineTotalWithTax: 900,
    pricingMeta: {
      basePrice: 1000,
      unitPrice: 900,
      composition: {
        metal: {
          appliedGrams: 1.30, purity: 0.75, metalName: "Oro 18k",
          gramsManual: false, mermaManual: false, variantManual: false,
          originalGrams: 1.30, originalMermaPct: 5,
        } as any,
        hechura: {
          appliedAmount: 200, manual: false, appliesTo: "TOTAL",
          originalAmount: 200,
        },
        taxes: [],
        ...overrides.composition,
      },
      ...overrides,
    },
  } as DocumentLine;
}

const baseProps = {
  currency: "ARS",
  onApply: vi.fn(),
  onClear: vi.fn(),
  view: "sale" as const,
};

// =============================================================================
// 1. PRODUCT / SERVICE — ahora aparecen
// =============================================================================

describe("F1.3 #8b — PRODUCT / SERVICE render en LineAdvancedOverridesPanel", () => {
  it("baseline correct: 0 productos / servicios → no renderea bloques extra", () => {
    render(<LineAdvancedOverridesPanel line={makeLine()} {...baseProps} />);
    expect(screen.queryByText("Producto")).toBeNull();
    expect(screen.queryByText("Servicio")).toBeNull();
  });

  it("baseline correct: 1 producto → renderea 1 bloque PRODUCTO", () => {
    const line = makeLine({
      composition: {
        metal: {
          appliedGrams: 1.30, purity: 0.75, metalName: "Oro 18k",
          gramsManual: false, mermaManual: false, variantManual: false,
          originalGrams: 1.30, originalMermaPct: 5,
        } as any,
        hechura: {
          appliedAmount: 200, manual: false, appliesTo: "TOTAL",
          originalAmount: 200,
        },
        products: [{
          costLineId: "cl-p1", catalogItemId: "art-P",
          catalogItemCode: "ZAF-01", catalogItemName: "Zafiro 0.5ct",
          quantity: 2, unitValue: 50, totalValue: 100,
          currencyId: null,
          lineAdjKind: null, lineAdjType: null,
          lineAdjValue: null, lineAdjAmount: null, affectsStock: null,
        }],
        services: [],
        taxes: [],
      },
    });
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    // Header del SaleColumn = "Producto"
    expect(screen.getByText("Producto")).toBeInTheDocument();
    expect(screen.getByText("Zafiro 0.5ct")).toBeInTheDocument();
    // catalog code aparece en su InfoItem
    expect(screen.getByText("ZAF-01")).toBeInTheDocument();
  });

  it("baseline correct: 2 productos → renderea 2 bloques PRODUCTO", () => {
    const line = makeLine({
      composition: {
        metal: null,
        hechura: {
          appliedAmount: 200, manual: false, appliesTo: "TOTAL",
          originalAmount: 200,
        },
        products: [
          {
            costLineId: "cl-p1", catalogItemId: "art-P1",
            catalogItemCode: "ZAF-01", catalogItemName: "Zafiro 0.5ct",
            quantity: 2, unitValue: 50, totalValue: 100,
            currencyId: null,
            lineAdjKind: null, lineAdjType: null,
            lineAdjValue: null, lineAdjAmount: null, affectsStock: null,
          },
          {
            costLineId: "cl-p2", catalogItemId: "art-P2",
            catalogItemCode: "RUB-02", catalogItemName: "Rubí 0.3ct",
            quantity: 1, unitValue: 80, totalValue: 80,
            currencyId: null,
            lineAdjKind: null, lineAdjType: null,
            lineAdjValue: null, lineAdjAmount: null, affectsStock: null,
          },
        ],
        services: [],
        taxes: [],
      },
    });
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    // 2 headers Producto.
    expect(screen.getAllByText("Producto").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Zafiro 0.5ct")).toBeInTheDocument();
    expect(screen.getByText("Rubí 0.3ct")).toBeInTheDocument();
  });

  it("baseline correct: 1 servicio → renderea 1 bloque SERVICIO", () => {
    const line = makeLine({
      composition: {
        metal: null,
        hechura: {
          appliedAmount: 200, manual: false, appliesTo: "TOTAL",
          originalAmount: 200,
        },
        products: [],
        services: [{
          costLineId: "cl-s1", catalogItemId: "art-S",
          catalogItemCode: "ENG-01", catalogItemName: "Engaste profesional",
          quantity: 1, unitValue: 80, totalValue: 80,
          currencyId: null,
          lineAdjKind: null, lineAdjType: null,
          lineAdjValue: null, lineAdjAmount: null, affectsStock: null,
        }],
        taxes: [],
      },
    });
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    expect(screen.getByText("Servicio")).toBeInTheDocument();
    expect(screen.getByText("Engaste profesional")).toBeInTheDocument();
    expect(screen.queryByText("Producto")).toBeNull();
  });

  it("baseline correct: 2 servicios → renderea 2 bloques SERVICIO", () => {
    const line = makeLine({
      composition: {
        metal: null,
        hechura: {
          appliedAmount: 200, manual: false, appliesTo: "TOTAL",
          originalAmount: 200,
        },
        products: [],
        services: [
          {
            costLineId: "cl-s1", catalogItemId: "art-S1",
            catalogItemCode: "ENG-01", catalogItemName: "Engaste",
            quantity: 1, unitValue: 80, totalValue: 80,
            currencyId: null,
            lineAdjKind: null, lineAdjType: null,
            lineAdjValue: null, lineAdjAmount: null, affectsStock: null,
          },
          {
            costLineId: "cl-s2", catalogItemId: "art-S2",
            catalogItemCode: "PUL-02", catalogItemName: "Pulido",
            quantity: 1, unitValue: 50, totalValue: 50,
            currencyId: null,
            lineAdjKind: null, lineAdjType: null,
            lineAdjValue: null, lineAdjAmount: null, affectsStock: null,
          },
        ],
        taxes: [],
      },
    });
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    expect(screen.getAllByText("Servicio").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Engaste")).toBeInTheDocument();
    expect(screen.getByText("Pulido")).toBeInTheDocument();
  });

  it("baseline correct: 1 producto + 1 servicio → ambos visibles", () => {
    const line = makeLine({
      composition: {
        metal: null,
        hechura: {
          appliedAmount: 200, manual: false, appliesTo: "TOTAL",
          originalAmount: 200,
        },
        products: [{
          costLineId: "cl-p", catalogItemId: "art-P",
          catalogItemCode: "P-1", catalogItemName: "Producto X",
          quantity: 1, unitValue: 50, totalValue: 50,
          currencyId: null,
          lineAdjKind: null, lineAdjType: null,
          lineAdjValue: null, lineAdjAmount: null, affectsStock: null,
        }],
        services: [{
          costLineId: "cl-s", catalogItemId: "art-S",
          catalogItemCode: "S-1", catalogItemName: "Servicio Y",
          quantity: 1, unitValue: 30, totalValue: 30,
          currencyId: null,
          lineAdjKind: null, lineAdjType: null,
          lineAdjValue: null, lineAdjAmount: null, affectsStock: null,
        }],
        taxes: [],
      },
    });
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    expect(screen.getByText("Producto X")).toBeInTheDocument();
    expect(screen.getByText("Servicio Y")).toBeInTheDocument();
  });
});

// =============================================================================
// 2. AJUSTES + STOCK
// =============================================================================

describe("F1.3 #8b — ajustes y stock en items", () => {
  it("baseline correct: BONUS PERCENTAGE → 'Bonif. X%' con monto emerald y signo −", () => {
    const line = makeLine({
      composition: {
        metal: null,
        hechura: { appliedAmount: 200, manual: false, appliesTo: null, originalAmount: 200 },
        products: [{
          costLineId: "cl-p1", catalogItemId: "art-P",
          catalogItemCode: "X", catalogItemName: "Item",
          quantity: 1, unitValue: 100, totalValue: 95,
          currencyId: null,
          lineAdjKind: "BONUS", lineAdjType: "PERCENTAGE",
          lineAdjValue: 5, lineAdjAmount: 5, affectsStock: null,
        }],
        services: [],
        taxes: [],
      },
    });
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    // InfoItem renderea `${label}:` — match con regex.
    expect(screen.getByText(/^Bonif\. 5%:?$/)).toBeInTheDocument();
    const monto = screen.getByText(/^−/);
    expect(monto.className).toMatch(/emerald/);
  });

  it("baseline correct: SURCHARGE PERCENTAGE → 'Recargo X%' con monto amber y signo +", () => {
    const line = makeLine({
      composition: {
        metal: null,
        hechura: { appliedAmount: 200, manual: false, appliesTo: null, originalAmount: 200 },
        products: [],
        services: [{
          costLineId: "cl-s1", catalogItemId: "art-S",
          catalogItemCode: "Y", catalogItemName: "Engaste",
          quantity: 1, unitValue: 80, totalValue: 100,
          currencyId: null,
          lineAdjKind: "SURCHARGE", lineAdjType: "PERCENTAGE",
          lineAdjValue: 25, lineAdjAmount: 20, affectsStock: null,
        }],
        taxes: [],
      },
    });
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    expect(screen.getByText(/^Recargo 25%:?$/)).toBeInTheDocument();
    const monto = screen.getByText(/^\+/);
    expect(monto.className).toMatch(/amber/);
  });

  it("baseline correct: lineAdjAmount=null → no muestra fila bonif. (passthrough estricto)", () => {
    const line = makeLine({
      composition: {
        metal: null,
        hechura: { appliedAmount: 200, manual: false, appliesTo: null, originalAmount: 200 },
        products: [{
          costLineId: "cl-p1", catalogItemId: "art-P",
          catalogItemCode: "X", catalogItemName: "Item",
          quantity: 1, unitValue: 100, totalValue: 100,
          currencyId: null,
          lineAdjKind: "BONUS", lineAdjType: "PERCENTAGE",
          lineAdjValue: 5,
          lineAdjAmount: null,    // backend no lo emitió
          affectsStock: null,
        }],
        services: [],
        taxes: [],
      },
    });
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    // Hechura tiene su propia fila Bonif. inline siempre — buscamos
    // específicamente "Bonif. 5%" del card PRODUCTO (que NO debe existir).
    expect(screen.queryByText(/^Bonif\. 5%:?$/)).toBeNull();
  });

  it("baseline correct: affectsStock=true → 'Stock: Descuenta'", () => {
    const line = makeLine({
      composition: {
        metal: null,
        hechura: { appliedAmount: 200, manual: false, appliesTo: null, originalAmount: 200 },
        products: [{
          costLineId: "cl-p1", catalogItemId: "art-P",
          catalogItemCode: "X", catalogItemName: "Item",
          quantity: 1, unitValue: 100, totalValue: 100,
          currencyId: null,
          lineAdjKind: null, lineAdjType: null,
          lineAdjValue: null, lineAdjAmount: null,
          affectsStock: true,
        }],
        services: [],
        taxes: [],
      },
    });
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    expect(screen.getByText(/^Stock:?$/)).toBeInTheDocument();
    expect(screen.getByText("Descuenta")).toBeInTheDocument();
  });

  it("baseline correct: affectsStock=false NO muestra Stock", () => {
    const line = makeLine({
      composition: {
        metal: null,
        hechura: { appliedAmount: 200, manual: false, appliesTo: null, originalAmount: 200 },
        products: [],
        services: [{
          costLineId: "cl-s1", catalogItemId: "art-S",
          catalogItemCode: "X", catalogItemName: "Servicio",
          quantity: 1, unitValue: 100, totalValue: 100,
          currencyId: null,
          lineAdjKind: null, lineAdjType: null,
          lineAdjValue: null, lineAdjAmount: null,
          affectsStock: false,
        }],
        taxes: [],
      },
    });
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    expect(screen.queryByText(/^Stock:?$/)).toBeNull();
  });
});

// =============================================================================
// 3. GRAMOS — 2 decimales en summary read-only
// =============================================================================

describe("F1.3 #8b — gramos visuales a 2 decimales", () => {
  it("baseline correct: gramos 1.30 → muestra '1.30 g' (no '1.300 g')", () => {
    const line = makeLine();   // appliedGrams: 1.30
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    // El summary read-only formatea con toFixed(2).
    expect(screen.getByText("1.30 g")).toBeInTheDocument();
    expect(screen.queryByText("1.300 g")).toBeNull();
  });

  it("baseline correct: gramos 1.00 → muestra '1.00 g'", () => {
    const line = makeLine({
      composition: {
        metal: {
          appliedGrams: 1.00, purity: 0.75, metalName: "Oro",
          gramsManual: false, mermaManual: false, variantManual: false,
          originalGrams: 1.00, originalMermaPct: 0,
        } as any,
        hechura: { appliedAmount: 100, manual: false, appliesTo: null, originalAmount: 100 },
        taxes: [],
      },
    });
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    expect(screen.getByText("1.00 g")).toBeInTheDocument();
    expect(screen.queryByText("1.000 g")).toBeNull();
  });
});

// =============================================================================
// 4. RETROCOMPAT
// =============================================================================

describe("F1.3 #8b — retrocompat snapshots viejos", () => {
  it("baseline correct: composition sin products/services → no crashea", () => {
    const line = makeLine();    // sin products/services
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    expect(screen.queryByText("Producto")).toBeNull();
    expect(screen.queryByText("Servicio")).toBeNull();
    // Resto del panel sigue rendereando.
    expect(screen.getByText("Hechura")).toBeInTheDocument();
  });
});
