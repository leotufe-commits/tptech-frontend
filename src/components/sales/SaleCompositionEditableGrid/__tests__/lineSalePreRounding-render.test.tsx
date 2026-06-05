// src/components/sales/SaleCompositionEditableGrid/__tests__/lineSalePreRounding-render.test.tsx
// ============================================================================
// F1.6 — La tabla "Composición del costo del artículo" muestra la RECETA BASE
// (PRE redondeo). La fila DETALLE del metal prioriza `lineSalePreRounding` y cae
// a `lineSale` (POST) cuando no existe. El footer ya usa el agregado PRE
// (metalSalePreRounding). Con una sola fila, fila y footer coinciden en la base.
//
// Caso real Desglosada:
//   metal lineSale (POST) = 574.331,25 ; lineSalePreRounding (PRE) = 572.343,75
// ============================================================================

import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SaleCompositionEditableGrid } from "../index";

const noop = () => undefined;

function makeLine(): any {
  return {
    id: "L1", type: "ARTICLE", article: "Anillo", variant: "",
    articleId: "art-1", quantity: 1, unitPrice: 100,
    discountAmount: 0, subtotal: 100, taxAmount: 21,
    lineTotal: 100, lineTotalWithTax: 121,
    pricingMeta: {
      metalSale: 574331.25,                 // agregado POST
      metalSalePreRounding: 572343.75,      // agregado PRE (footer)
      composition: {
        metals: [{
          costLineId: "cl-1", metalName: "Oro Fino", metalId: "oro",
          appliedGrams: 1.5, appliedMermaPct: 0, purity: 0.75,
          lineCost: 400000,
          lineSale: 574331.25,              // por cost-line POST (contaminado)
          lineSalePreRounding: 572343.75,   // por cost-line PRE (receta base)
          quotePrice: 100,
        }],
        hechuras: [], products: [], services: [],
      },
    },
  };
}

describe("SaleCompositionEditableGrid — fila/footer usan receta BASE (lineSalePreRounding)", () => {
  it("metal: lineSale POST 574.331,25 / lineSalePreRounding PRE 572.343,75 → muestra el PRE, NO el POST", () => {
    const { container } = render(
      <SaleCompositionEditableGrid line={makeLine()} currency="$" onApply={noop} />,
    );
    const text = container.textContent ?? "";
    expect(text).toMatch(/572[.\s]?343/);       // PRE visible (fila detalle + footer coinciden)
    expect(text).not.toMatch(/574[.\s]?331/);   // POST NO aparece en ningún lado de la tabla
  });

  it("fallback: sin lineSalePreRounding → la fila cae a lineSale (POST)", () => {
    const line = makeLine();
    delete line.pricingMeta.composition.metals[0].lineSalePreRounding;
    delete line.pricingMeta.metalSalePreRounding;
    const { container } = render(
      <SaleCompositionEditableGrid line={line} currency="$" onApply={noop} />,
    );
    expect(container.textContent ?? "").toMatch(/574[.\s]?331/);  // POST (fallback intacto)
  });
});
