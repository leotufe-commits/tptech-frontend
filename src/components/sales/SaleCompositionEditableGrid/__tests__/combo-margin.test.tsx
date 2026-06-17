// src/components/sales/SaleCompositionEditableGrid/__tests__/combo-margin.test.tsx
// ============================================================================
// Combos — Venta total por componente = su parte del PRECIO del combo
// (post-ajuste), y Margen = margen de la LISTA.
//
// La venta de cada componente se reparte desde el precio del combo
// (`comboPriceMeta.finalPrice / subtotal`), de modo que:
//   · Σ "Venta total" de las filas = precio del combo (footer), y
//   · Margen = (ventaPost − costoPost)/costoPost = margen de lista (NO inflado
//     por el ajuste del combo).
//
// Es un reparto de DISPLAY del precio que ya calculó el motor — el total NO
// cambia, el frontend no inventa números.
// ============================================================================

import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SaleCompositionEditableGrid } from "../index";

const noop = () => undefined;

// Combo de 2 componentes con margen de lista 85% y ajuste del combo −10%.
//   subtotal (Σ ventas de lista) = 185.000 + 370.000 = 555.000
//   finalPrice (precio combo)    = 555.000 × 0,9       = 499.500
//   venta post por fila          = 166.500 + 333.000   = 499.500 (= footer)
//   margen                       = (166.500 − 90.000)/90.000 = 85%
function makeCombo2Components(): any {
  return {
    id: "L1", type: "ARTICLE", article: "Combo", variant: "",
    articleId: "combo-1", quantity: 1, unitPrice: 499500,
    discountAmount: 0, subtotal: 499500, taxAmount: 0,
    lineTotal: 499500, lineTotalWithTax: 499500,
    pricingMeta: {
      costMode: "COMBO",
      priceSource: "PROMOTION",
      pricingSteps: [{
        key: "COMBO_PRICE",
        meta: {
          subtotal: 555000,
          finalPrice: 499500,
          adjustmentKind: "DISCOUNT_PERCENT",
          adjustmentValue: 10,
          adjustmentAmount: 55500,
        },
      }],
      composition: {
        metals: [], hechuras: [],
        products: [
          {
            costLineId: "cl-1", catalogItemName: "COMP 1",
            quantity: 1, quantityUnit: "u",
            unitValue: 100000, unitValueBase: 100000,
            totalValue: 100000, lineSale: 185000,    // 85% lista
          },
          {
            costLineId: "cl-2", catalogItemName: "COMP 2",
            quantity: 1, quantityUnit: "u",
            unitValue: 200000, unitValueBase: 200000,
            totalValue: 200000, lineSale: 370000,    // 85% lista
          },
        ],
        services: [],
      },
    },
  };
}

// Combo con lista UNIFICADA (MARGIN_TOTAL): el motor emite `hechuraMarginPct=0`
// (marginUnattributable) PERO ahora también emite la venta real por componente
// (`composition.products[].lineSale = costo × 1.85`, vía `comboComponentSale`).
// Antes del fix, la unificada colapsaba el lineSale a costo y la columna Margen
// mostraba el markup del combo (≈66,5%) en vez del 85% de lista. Con la venta
// real presente, el margen vuelve a 85% igual que la desglosada.
function makeUnifiedCombo2Components(): any {
  return {
    id: "L1", type: "ARTICLE", article: "Combo", variant: "",
    articleId: "combo-1", quantity: 1, unitPrice: 499500,
    discountAmount: 0, subtotal: 499500, taxAmount: 0,
    lineTotal: 499500, lineTotalWithTax: 499500,
    pricingMeta: {
      costMode: "COMBO",
      priceSource: "COMBO_COMPONENTS",
      // Modo derivado MARGIN_TOTAL → sin margen por componente + factor unificado.
      hechuraMarginPct: 0, hechuraCost: 300000, hechuraSale: 499500,
      unitCost: 300000, basePrice: 499500,   // unifiedFactor = 1,665 (66,5%)
      pricingSteps: [{
        key: "COMBO_PRICE",
        meta: {
          subtotal: 555000,
          finalPrice: 499500,
          adjustmentKind: "DISCOUNT_PERCENT",
          adjustmentValue: 10,
          adjustmentAmount: 55500,
        },
      }],
      composition: {
        metals: [], hechuras: [],
        products: [
          {
            costLineId: "cl-1", catalogItemName: "COMP 1",
            quantity: 1, quantityUnit: "u",
            unitValue: 100000, unitValueBase: 100000,
            totalValue: 100000, lineSale: 185000,    // venta real 85% (backend)
          },
          {
            costLineId: "cl-2", catalogItemName: "COMP 2",
            quantity: 1, quantityUnit: "u",
            unitValue: 200000, unitValueBase: 200000,
            totalValue: 200000, lineSale: 370000,    // venta real 85% (backend)
          },
        ],
        services: [],
      },
    },
  };
}

describe("Combo UNIFICADA — venta real por componente ⇒ margen 85% (paridad con desglosada)", () => {
  it("muestra 85% (no el markup del combo 66,5%) y la venta post-ajuste por fila", () => {
    const { container } = render(
      <SaleCompositionEditableGrid line={makeUnifiedCombo2Components()} currency="$" onApply={noop} />,
    );
    const text = container.textContent ?? "";
    // Margen de lista, igual que la desglosada.
    expect(text).toMatch(/85[.,]?0?0?\s*%/);
    // El markup del combo (basePrice/unitCost = 66,5%) NO debe aparecer como
    // PORCENTAJE de margen (el monto "$ 66.500,00" sí es legítimo).
    expect(text).not.toMatch(/66[.,]5\d?\s*%/);
    // Ventas post-ajuste por fila (166.500 / 333.000) que suman el footer.
    expect(text).toMatch(/166[.,]?500/);
    expect(text).toMatch(/333[.,]?000/);
    expect(text).toMatch(/499[.,]?500/);
  });
});

describe("Combo — venta por fila post-ajuste + margen de lista", () => {
  it("la Venta total por fila es post-ajuste (166.500 / 333.000) y suma el footer (499.500)", () => {
    const { container } = render(
      <SaleCompositionEditableGrid line={makeCombo2Components()} currency="$" onApply={noop} />,
    );
    const text = container.textContent ?? "";
    // Ventas post-ajuste por fila.
    expect(text).toMatch(/166[.,]?500/);
    expect(text).toMatch(/333[.,]?000/);
    // Footer = precio del combo (Σ filas).
    expect(text).toMatch(/499[.,]?500/);
    // NO aparece la venta de lista PRE-ajuste como total de fila (185.000 / 370.000).
    expect(text).not.toMatch(/185[.,]?000/);
    expect(text).not.toMatch(/370[.,]?000/);
  });

  it("el Margen muestra el de la LISTA (85%), no el inflado por el ajuste del combo", () => {
    const { container } = render(
      <SaleCompositionEditableGrid line={makeCombo2Components()} currency="$" onApply={noop} />,
    );
    const text = container.textContent ?? "";
    expect(text).toMatch(/85[.,]?0?0?\s*%/);
    // El inflado (venta pre / costo post = 105,56%) NO aparece.
    expect(text).not.toMatch(/105[.,]?5/);
  });
});
