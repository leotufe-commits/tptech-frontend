// src/components/sales/SaleCompositionEditableGrid/__tests__/combo-margin.test.tsx
// ============================================================================
// Combos — la columna Margen muestra el margen de la LISTA (no el inflado por
// el ajuste global).
//
// En un combo, la venta de cada componente viene de la lista, anclada al costo
// de LISTA (pre ajuste global). El "Ajuste Global" (−10%) baja el costo pero NO
// la venta, así que medir el margen contra el costo POST-global lo infla
// (105,56% en vez del 85% de la lista). El combo debe medir contra el costo de
// lista (pre-global) → muestra 85%. El artículo normal NO cambia.
//
// Fixture: componente con costo de lista 319.850,937 y venta 591.724,23345
// (= costo × 1,85 → margen lista 85%). Ajuste global −10% (COMBO_PRICE meta
// DISCOUNT_PERCENT 10) → costo post-global 287.865,84. Sin el fix daría
// 591.724 / 287.865 = 105,56%.
// ============================================================================

import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SaleCompositionEditableGrid } from "../index";

const noop = () => undefined;

function makeComboWithGlobalAdj(): any {
  return {
    id: "L1", type: "ARTICLE", article: "Combo", variant: "",
    articleId: "combo-1", quantity: 1, unitPrice: 591724.23,
    discountAmount: 0, subtotal: 591724.23, taxAmount: 0,
    lineTotal: 591724.23, lineTotalWithTax: 591724.23,
    pricingMeta: {
      costMode: "COMBO",
      priceSource: "PROMOTION",
      // Ajuste global del combo (−10%) — alimenta `buildGlobalCost`.
      pricingSteps: [{
        key: "COMBO_PRICE",
        meta: {
          subtotal: 657471.37,
          finalPrice: 591724.23,
          adjustmentKind: "DISCOUNT_PERCENT",
          adjustmentValue: 10,
          adjustmentAmount: 65747.14,
        },
      }],
      composition: {
        metals: [], hechuras: [],
        products: [{
          costLineId: "cl-prod-1",
          catalogItemName: "ANILLOS SOLITARIO BRILLANTE",
          quantity: 1, quantityUnit: "u",
          unitValue: 355389.93, unitValueBase: 355389.93,
          totalValue: 319850.937,        // costo de LISTA (pre ajuste global)
          lineSale: 591724.23345,        // = 319850.937 × 1,85 → margen lista 85%
        }],
        services: [],
      },
    },
  };
}

describe("Combo — Margen = margen de la lista (no inflado por el ajuste global)", () => {
  it("muestra ~85% (lista) y NO ~105,56% (inflado por el −10% global)", () => {
    const { container } = render(
      <SaleCompositionEditableGrid line={makeComboWithGlobalAdj()} currency="$" onApply={noop} />,
    );
    const text = container.textContent ?? "";
    // Margen de la lista (85%) presente.
    expect(text).toMatch(/85[.,]?0?0?\s*%/);
    // El margen inflado (105,56% — contra el costo post-global) NO aparece.
    expect(text).not.toMatch(/105[.,]?5/);
  });
});
