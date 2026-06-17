// src/components/sales/SaleCompositionEditableGrid/__tests__/combo-readonly.test.tsx
// ============================================================================
// Combos — edición PARCIAL de la composición.
//
// En un COMBO comercial, la composición permite editar Cantidad y Merma/Ajuste
// de cada componente; el Valor unitario queda BLOQUEADO (sale de la lista del
// combo). Al editar, el override viaja al backend y el motor recalcula
// Costo total / Margen / precio — el frontend NO calcula.
//
//   · combo  → nota informativa + header "Composición del combo";
//              hay inputs editables (Cantidad) Y al menos uno bloqueado (Valor).
//   · normal → sin nota; composición totalmente editable.
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

describe("Combos — edición parcial de la composición", () => {
  it("combo: muestra la nota + header 'Composición del combo'", () => {
    const { getByTestId, container } = render(
      <SaleCompositionEditableGrid line={makeComboLine()} currency="$" onApply={noop} />,
    );
    expect(getByTestId("combo-composition-note")).toBeTruthy();
    expect(container.textContent ?? "").toMatch(/Composición del combo/);
  });

  it("combo: edición PARCIAL — hay inputs editables (Cantidad) y al menos uno bloqueado (Valor unitario)", () => {
    const { container } = render(
      <SaleCompositionEditableGrid line={makeComboLine()} currency="$" onApply={noop} />,
    );
    const inputs = Array.from(container.querySelectorAll("input")) as HTMLInputElement[];
    expect(inputs.length).toBeGreaterThan(0);
    // Cantidad / Merma-Ajuste editables → algún input NO es read-only.
    expect(inputs.some((i) => !i.readOnly)).toBe(true);
    // Valor unitario bloqueado → al menos un input read-only.
    expect(inputs.some((i) => i.readOnly)).toBe(true);
  });

  it("artículo normal: NO muestra la nota y mantiene la composición editable", () => {
    const { queryByTestId, container } = render(
      <SaleCompositionEditableGrid line={makeNormalLine()} currency="$" onApply={noop} />,
    );
    expect(queryByTestId("combo-composition-note")).toBeNull();
    expect(container.textContent ?? "").toMatch(/Composición del costo del artículo/);
    const inputs = Array.from(container.querySelectorAll("input")) as HTMLInputElement[];
    expect(inputs.some((i) => !i.readOnly)).toBe(true);
  });
});
