// src/components/sales/SaleCompositionEditableGrid/__tests__/combo-readonly.test.tsx
// ============================================================================
// Opción A (combos) — la composición de un COMBO es INFORMATIVA (solo lectura).
//
// El precio del combo sale de su lista; editar los componentes acá no lo cambia
// (y generaba inconsistencias). Por eso, cuando la línea es un combo
// (`costMode === "COMBO"` o `priceSource === "COMBO_COMPONENTS"`):
//   · se muestra una nota informativa (`combo-composition-readonly-note`),
//   · el header dice "Composición del combo",
//   · todos los inputs de la composición quedan en SOLO LECTURA.
//
// Un artículo normal mantiene la composición editable (sin nota).
// ============================================================================

import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SaleCompositionEditableGrid } from "../index";

const noop = () => undefined;

function makeComboLine(): any {
  return {
    id: "L1", type: "ARTICLE", article: "Combo", variant: "",
    articleId: "combo-1", quantity: 1, unitPrice: 591724.23,
    discountAmount: 0, subtotal: 591724.23, taxAmount: 124262.09,
    lineTotal: 591724.23, lineTotalWithTax: 715986.32,
    pricingMeta: {
      costMode: "COMBO",
      priceSource: "PROMOTION",
      metalSale: 515109.375,
      composition: {
        metals: [], hechuras: [],
        products: [{
          costLineId: "cl-prod-1",
          catalogItemName: "ANILLOS SOLITARIO BRILLANTE",
          quantity: 1, quantityUnit: "u",
          unitValue: 355389.93, unitValueBase: 355389.93,
          totalValue: 355389.93, lineSale: 657471.37,
        }],
        services: [],
      },
    },
  };
}

function makeNormalLine(): any {
  return {
    id: "L2", type: "ARTICLE", article: "Anillo", variant: "",
    articleId: "art-1", quantity: 1, unitPrice: 100,
    discountAmount: 0, subtotal: 100, taxAmount: 21,
    lineTotal: 100, lineTotalWithTax: 121,
    pricingMeta: {
      composition: {
        metals: [{
          costLineId: "cl-1", metalName: "Oro Fino", metalId: "oro",
          appliedGrams: 1.5, appliedMermaPct: 0, purity: 0.75,
          lineCost: 400000, lineSale: 574331.25, quotePrice: 100,
        }],
        hechuras: [], products: [], services: [],
      },
    },
  };
}

describe("Opción A — composición del combo de solo lectura", () => {
  it("combo: muestra la nota informativa + header 'Composición del combo'", () => {
    const { getByTestId, container } = render(
      <SaleCompositionEditableGrid line={makeComboLine()} currency="$" onApply={noop} />,
    );
    expect(getByTestId("combo-composition-readonly-note")).toBeTruthy();
    expect(container.textContent ?? "").toMatch(/Composición del combo/);
  });

  it("combo: TODOS los inputs de la composición quedan en solo lectura", () => {
    const { container } = render(
      <SaleCompositionEditableGrid line={makeComboLine()} currency="$" onApply={noop} />,
    );
    const inputs = Array.from(container.querySelectorAll("input"));
    expect(inputs.length).toBeGreaterThan(0);
    expect(inputs.every((i) => (i as HTMLInputElement).readOnly)).toBe(true);
  });

  it("artículo normal: NO muestra la nota y mantiene inputs editables", () => {
    const { queryByTestId, container } = render(
      <SaleCompositionEditableGrid line={makeNormalLine()} currency="$" onApply={noop} />,
    );
    expect(queryByTestId("combo-composition-readonly-note")).toBeNull();
    expect(container.textContent ?? "").toMatch(/Composición del costo del artículo/);
    const inputs = Array.from(container.querySelectorAll("input"));
    expect(inputs.some((i) => !(i as HTMLInputElement).readOnly)).toBe(true);
  });
});
