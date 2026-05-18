// src/components/ui/__tests__/bonif-input-connected.test.tsx
// ============================================================================
// Auditoría: el TPNumber de BONIFICACIÓN por línea (Factura) DEBE invocar
// `onApplyLineOverrides` con `{ manualDiscount }` (no quedar en estado
// visual). La X manda override explícito de bonificación 0 (no undefined).
// Análogo al test de Impuestos ya corregido.
// ============================================================================

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LinesEditorSection } from "../../../pages/ventas-facturas/InvoiceEditorModal/LinesEditorSection";
import type { DocumentLine } from "../../../lib/document-types";

function makeArticleLine(): DocumentLine {
  return {
    id: "line-1", type: "ARTICLE", article: "Anillo oro", variant: "",
    articleId: "art-1", quantity: 2, unitPrice: 100, discountAmount: 0,
    subtotal: 200, taxAmount: 0, lineTotal: 200, lineTotalWithTax: 200,
    pricingMeta: {
      priceSource: "PRICE_LIST", basePrice: 100,
      // sin promo / qty discount → input de Bonificación editable
      quantityDiscountAmount: 0, promotionDiscountAmount: 0,
    },
  } as unknown as DocumentLine;
}

const baseProps = {
  totalLinesInDraft: 1, currency: "$", displayRate: 1,
  viewMode: "detailed" as const, headerSubtotals: undefined,
  priceLists: [], channels: [], warehouses: [],
  expandedLineIds: new Set<string>(), advancedOpenLineIds: new Set<string>(),
  onToggleExpand: () => {}, onToggleAdvancedOpen: () => {},
  patchLine: () => {}, removeLine: () => {}, duplicateLine: () => {},
  reorderLines: () => {}, resetLine: () => {}, isReorderable: () => false,
  onAddLine: () => {}, setLineTaxOverride: () => {}, clearLineOverrides: () => {},
  onChangePriceList: () => {}, onChangeLinePriceList: () => {}, onChangeChannel: () => {},
  handleEditArticle: () => {}, handleLineArticlePick: () => {},
  handleCreateManualLine: () => {}, searchArticles: undefined as any,
  exactLookupArticle: undefined as any, focusedLineId: null, focusSignal: 0,
  editorScopeRef: React.createRef<HTMLDivElement | null>(), previewLoading: false,
};

function getBonifCell(): HTMLElement {
  return screen.getByText("Bonificación").parentElement as HTMLElement;
}

describe("TPNumber de Bonificación — conexión al flujo de override", () => {
  it("editar el valor invoca onApplyLineOverrides con { manualDiscount }", () => {
    const spy = vi.fn();
    render(
      <LinesEditorSection {...(baseProps as any)} lines={[makeArticleLine()]}
        applyLineOverrides={spy} />,
    );
    const input = getBonifCell().querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "15" } });

    expect(spy).toHaveBeenCalled();
    const [lineId, patch] = spy.mock.calls[spy.mock.calls.length - 1];
    expect(lineId).toBe("line-1");
    expect(patch).toEqual({
      manualDiscount: { mode: "PERCENT", value: 15, appliesTo: "TOTAL" },
    });
  });

  it("la X (clear) manda manualDiscount con value 0 explícito (no undefined)", () => {
    const spy = vi.fn();
    // La X solo aparece si hay un valor visible > 0 → sembramos un override
    // manual 10% existente (lo que vería el operador antes de limpiar).
    const seeded = {
      ...makeArticleLine(),
      manualOverrides: { discount: true },
      pricingMeta: {
        priceSource: "PRICE_LIST", basePrice: 100,
        quantityDiscountAmount: 0, promotionDiscountAmount: 0,
        manualDiscount: { mode: "PERCENT", value: 10, appliesTo: "TOTAL" },
      },
    } as unknown as DocumentLine;
    render(
      <LinesEditorSection {...(baseProps as any)} lines={[seeded]}
        applyLineOverrides={spy} />,
    );
    const clearBtn = getBonifCell().querySelector(
      'button[aria-label="Limpiar valor"]',
    ) as HTMLButtonElement;
    expect(clearBtn).toBeTruthy();
    fireEvent.click(clearBtn);

    expect(spy).toHaveBeenCalled();
    const [lineId, patch] = spy.mock.calls[spy.mock.calls.length - 1];
    expect(lineId).toBe("line-1");
    expect(patch.manualDiscount.value).toBe(0);
    expect(patch.manualDiscount.mode).toBe("PERCENT");
  });
});
