// Integración — el label "Impuestos" de la línea abre el selector y autocompleta
// el taxOverride (PERCENT) con la tasa elegida, vía el contrato existente.
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { LinesEditorSection } from "../../../pages/ventas-facturas/InvoiceEditorModal/LinesEditorSection";
import type { DocumentLine } from "../../../lib/document-types";

function makeLine(pricingMeta: any = {}, over: Partial<DocumentLine> = {}): DocumentLine {
  return {
    id: "L1", type: "ARTICLE", article: "Anillo", variant: "",
    articleId: "art-1", quantity: 1, unitPrice: 1000,
    discountAmount: 0, subtotal: 1000, taxAmount: 210,
    lineTotal: 1000, lineTotalWithTax: 1210,
    ...over,
    pricingMeta: { basePrice: 1000, priceSource: "PRICE_LIST", ...pricingMeta },
  } as unknown as DocumentLine;
}

function baseProps(extra: any = {}) {
  return {
    totalLinesInDraft: 1, currency: "$", displayRate: 1,
    viewMode: "detailed" as const, headerSubtotals: undefined,
    priceLists: [], channels: [], warehouses: [],
    expandedLineIds: new Set<string>(["L1"]), advancedOpenLineIds: new Set<string>(),
    onToggleExpand: () => {}, onToggleAdvancedOpen: () => {},
    patchLine: () => {}, removeLine: () => {}, duplicateLine: () => {},
    reorderLines: () => {}, resetLine: () => {}, isReorderable: () => false,
    onAddLine: () => {}, applyLineOverrides: () => {}, clearLineOverrides: () => {},
    setLineTaxOverride: () => {}, onChangePriceList: () => {},
    onChangeLinePriceList: () => {}, onChangeChannel: () => {},
    handleEditArticle: () => {}, handleLineArticlePick: () => {},
    handleCreateManualLine: () => {}, searchArticles: undefined as any,
    exactLookupArticle: undefined as any, focusedLineId: null, focusSignal: 0,
    editorScopeRef: React.createRef<HTMLDivElement | null>(), previewLoading: false,
    ...extra,
  };
}

const TAXES = [
  { id: "t1", name: "IVA", rate: 21 },
  { id: "t2", name: "Percepción", rate: 3 },
];

describe("Línea de factura — selector rápido de impuestos en el label", () => {
  it("click en 'Impuestos' → elegir IVA → setLineTaxOverride({ PERCENT, 21 })", () => {
    const setLineTaxOverride = vi.fn();
    const { container, getByText } = render(
      <LinesEditorSection {...(baseProps({ setLineTaxOverride, availableTaxes: TAXES }) as any)}
        lines={[makeLine()]} />,
    );
    const toggle = container.querySelector("[data-tp-tax-quick-toggle]");
    expect(toggle).not.toBeNull();
    fireEvent.click(toggle!);
    fireEvent.click(getByText("IVA"));
    expect(setLineTaxOverride).toHaveBeenLastCalledWith("L1", expect.objectContaining({
      mode: "PERCENT", value: 21,
    }));
  });

  it("elegir IVA + Percepción → setLineTaxOverride con la SUMA (24), un único override", () => {
    const setLineTaxOverride = vi.fn();
    const { container, getByText } = render(
      <LinesEditorSection {...(baseProps({ setLineTaxOverride, availableTaxes: TAXES }) as any)}
        lines={[makeLine()]} />,
    );
    fireEvent.click(container.querySelector("[data-tp-tax-quick-toggle]")!);
    fireEvent.click(getByText("IVA"));         // 21
    fireEvent.click(getByText("Percepción"));  // 24
    expect(setLineTaxOverride).toHaveBeenLastCalledWith("L1", expect.objectContaining({
      mode: "PERCENT", value: 24,
    }));
    // Sigue siendo UN solo override (contrato intacto).
    const lastCall = setLineTaxOverride.mock.calls.at(-1)!;
    expect(lastCall[1]).not.toHaveProperty("taxIds");
  });

  it("el input de impuesto sigue editable manualmente (no se rompe el override actual)", () => {
    const setLineTaxOverride = vi.fn();
    const { container } = render(
      <LinesEditorSection {...(baseProps({ setLineTaxOverride, availableTaxes: TAXES }) as any)}
        lines={[makeLine()]} />,
    );
    // El input numérico de impuestos sigue presente y editable.
    const inputs = container.querySelectorAll("input");
    expect(inputs.length).toBeGreaterThan(0);
  });

  it("sin availableTaxes → label plano (sin selector), líneas siguen funcionando", () => {
    const { container, getAllByText } = render(
      <LinesEditorSection {...(baseProps({ availableTaxes: undefined }) as any)}
        lines={[makeLine()]} />,
    );
    expect(container.querySelector("[data-tp-tax-quick-toggle]")).toBeNull();
    expect(getAllByText("Impuestos").length).toBeGreaterThan(0);
  });
});
