// src/components/ui/__tests__/tax-input-connected.test.tsx
// ============================================================================
// PRUEBA DE CONEXIÓN: el TPNumber de la columna IMPUESTOS (por unidad) de la
// Factura DEBE invocar `onSetLineTaxOverride` (mismo flujo que Bonificación),
// y la X debe mandar un override explícito de impuesto 0 (cleared), nunca
// quedarse como estado visual aislado.
//
// Cubre el bug: "el TPNumber de impuestos cambia visualmente pero no patchea
// la línea / no dispara preview".
// ============================================================================

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LinesEditorSection } from "../../../pages/ventas-facturas/InvoiceEditorModal/LinesEditorSection";
import type { DocumentLine } from "../../../lib/document-types";

function makeArticleLine(): DocumentLine {
  return {
    id: "line-1",
    type: "ARTICLE",
    article: "Anillo oro",
    variant: "",
    articleId: "art-1",
    quantity: 2,
    unitPrice: 100,
    discountAmount: 0,
    subtotal: 200,
    taxAmount: 42,
    lineTotal: 242,
    lineTotalWithTax: 242,
    pricingMeta: {
      priceSource: "PRICE_LIST",
      basePrice: 100,
      taxBreakdown: [{ name: "IVA", rate: 21, taxAmount: 21 }],
    },
  } as unknown as DocumentLine;
}

const baseProps = {
  totalLinesInDraft: 1,
  currency: "$",
  displayRate: 1,
  viewMode: "detailed" as const,
  headerSubtotals: undefined,
  priceLists: [],
  channels: [],
  warehouses: [],
  expandedLineIds: new Set<string>(),
  advancedOpenLineIds: new Set<string>(),
  onToggleExpand: () => {},
  onToggleAdvancedOpen: () => {},
  patchLine: () => {},
  removeLine: () => {},
  duplicateLine: () => {},
  reorderLines: () => {},
  resetLine: () => {},
  isReorderable: () => false,
  onAddLine: () => {},
  applyLineOverrides: () => {},
  clearLineOverrides: () => {},
  onChangePriceList: () => {},
  onChangeLinePriceList: () => {},
  onChangeChannel: () => {},
  handleEditArticle: () => {},
  handleLineArticlePick: () => {},
  handleCreateManualLine: () => {},
  searchArticles: undefined as any,
  exactLookupArticle: undefined as any,
  focusedLineId: null,
  focusSignal: 0,
  editorScopeRef: React.createRef<HTMLDivElement | null>(),
  previewLoading: false,
};

/** Localiza la celda IMPUESTOS (el contenedor que tiene el label
 *  "Impuestos"). El label vive en un <div>; la celda es su padre. */
function getTaxCell(): HTMLElement {
  const label = screen.getByText("Impuestos");
  return label.parentElement as HTMLElement;
}
function getTaxInput(): HTMLInputElement {
  const input = getTaxCell().querySelector("input");
  if (!input) throw new Error("No se encontró el input de Impuestos");
  return input as HTMLInputElement;
}

describe("TPNumber de Impuestos — conexión al flujo de override", () => {
  it("editar el valor invoca onSetLineTaxOverride con el override correcto", () => {
    const spy = vi.fn();
    render(
      <LinesEditorSection
        {...(baseProps as any)}
        lines={[makeArticleLine()]}
        setLineTaxOverride={spy}
      />,
    );

    const input = getTaxInput();
    fireEvent.change(input, { target: { value: "30" } });

    expect(spy).toHaveBeenCalled();
    const [lineId, override] = spy.mock.calls[spy.mock.calls.length - 1];
    expect(lineId).toBe("line-1");
    expect(override).toEqual({ mode: "PERCENT", value: 30, appliesTo: "TOTAL" });
  });

  it("la X (clear) PONE EL IMPUESTO EN 0 como override manual explícito", () => {
    const spy = vi.fn();
    render(
      <LinesEditorSection
        {...(baseProps as any)}
        lines={[makeArticleLine()]}
        setLineTaxOverride={spy}
      />,
    );

    // Semántica global de la X en Factura de ventas: PONER EL VALOR EN 0
    // como override manual explícito (NO restaurar el automático). El motor
    // recibe { mode, value: 0, appliesTo } y aplica 0 reemplazando IVA
    // configurado / exención del cliente. Los automáticos solo vuelven con
    // "Restablecer línea" o reingreso del artículo. Coherente con la X de
    // Bonificación (que también pone en 0).
    //
    // aria-label: "Poner impuesto en 0" (semántico). Otros inputs (Precio)
    // mantienen "Limpiar valor" como default — la X de Cantidad tiene
    // semántica distinta (resetea al mín de venta).
    const clearBtn = getTaxCell().querySelector(
      'button[aria-label="Poner impuesto en 0"]',
    ) as HTMLButtonElement;
    expect(clearBtn).toBeTruthy();
    fireEvent.click(clearBtn);

    expect(spy).toHaveBeenCalled();
    const [lineId, override] = spy.mock.calls[spy.mock.calls.length - 1];
    expect(lineId).toBe("line-1");
    // X = override manual con value=0 (NO null que era la semántica
    // anterior "restaurar"). Preserva mode y appliesTo actuales.
    expect(override).toEqual({ mode: "PERCENT", value: 0, appliesTo: "TOTAL" });
  });
});
