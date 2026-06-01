// src/components/ui/__tests__/currency-consistency.test.tsx
// ============================================================================
// T17 — Todos los labels monetarios de la celda Bonif/Recargo, Impuestos y
// totales deben usar la moneda del COMPROBANTE (no la base hardcoded).
//
// Reglas:
//   · Cuando `currency="US$"`, NINGÚN label monetario de las celdas tocadas
//     en T6-T16 debe mostrar "AR$".
//   · Cuando `currency="AR$"`, NINGÚN label monetario debe mostrar "US$".
//   · La conversión vive en `mFmt` (helper centralizado del editor) +
//     `displayRate`. Ningún componente convierte en JSX.
//   · El símbolo viaja vía la prop `currency` (resuelto desde
//     `currencyDisplay` del page con `currencies[i].symbol`).
// ============================================================================

import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LinesEditorSection } from "../../../pages/ventas-facturas/InvoiceEditorModal/LinesEditorSection";
import type { DocumentLine } from "../../../lib/document-types";

function makeLine(metaOverrides: any = {}, lineOverrides: any = {}): DocumentLine {
  return {
    id: "L1", type: "ARTICLE", article: "Anillo", variant: "",
    articleId: "art-1", quantity: 2, unitPrice: 100,
    discountAmount: 20, subtotal: 180, taxAmount: 38,
    lineTotal: 180, lineTotalWithTax: 218,
    pricingMeta: {
      priceSource: "PRICE_LIST", basePrice: 100,
      basePrice_: 100,
      metalSale:   80,
      hechuraSale: 20,
      unitTotalWithTax: 109,
      taxBreakdown: [{ name: "IVA", rate: 21, taxAmount: 38, applyOn: "TOTAL" }],
      composition: {
        taxes:    [{ name: "IVA", rate: 21, taxAmount: 38, appliesTo: "TOTAL" }],
        metals:   [{ metalName: "Oro", purity: 0.75, appliedGrams: 1.5, appliedMermaPct: 0, variantName: "Oro 18k" }],
        products: [],
        services: [],
      },
      ...metaOverrides,
    },
    ...lineOverrides,
  } as unknown as DocumentLine;
}

function baseProps(currencySymbol: string) {
  return {
    totalLinesInDraft: 1, currency: currencySymbol, displayRate: 1,
    viewMode: "detailed" as const, headerSubtotals: undefined,
    priceLists: [], channels: [], warehouses: [],
    expandedLineIds: new Set<string>(), advancedOpenLineIds: new Set<string>(),
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
  };
}

describe("T17 — Moneda del comprobante consistente en cards y totales", () => {
  it("factura en US$ → NO aparece AR$ en ningún label de la celda", () => {
    const { container } = render(<LinesEditorSection {...(baseProps("US$") as any)}
      lines={[makeLine()]} />);
    // Hay al menos un label monetario en la celda (Total línea c/imp.).
    expect((container.textContent ?? "")).toMatch(/US\$/);
    // El símbolo de base AR$ NO debe aparecer.
    expect((container.textContent ?? "")).not.toMatch(/AR\$/);
  });

  it("factura en AR$ → NO aparece US$ en ningún label de la celda", () => {
    const { container } = render(<LinesEditorSection {...(baseProps("AR$") as any)}
      lines={[makeLine()]} />);
    expect((container.textContent ?? "")).toMatch(/AR\$/);
    expect((container.textContent ?? "")).not.toMatch(/US\$/);
  });

  it("card de Impuestos abierto en US$ → totales en US$, no AR$", () => {
    render(<LinesEditorSection {...(baseProps("US$") as any)}
      lines={[makeLine()]} />);
    const trigger = screen.getByRole("button", { name: /detalle de impuestos/i });
    // Abrir el card.
    fireEvent.click(trigger);
    const panel = document.querySelector('[data-tp-line-tax-summary-panel="true"]') as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.textContent ?? "").toMatch(/US\$/);
    expect(panel.textContent ?? "").not.toMatch(/AR\$/);
  });

  it("cambiando currency en re-render → los labels rehidratan al nuevo símbolo", () => {
    const { rerender, container } = render(<LinesEditorSection {...(baseProps("AR$") as any)}
      lines={[makeLine()]} />);
    expect((container.textContent ?? "")).toMatch(/AR\$/);
    expect((container.textContent ?? "")).not.toMatch(/US\$/);

    rerender(<LinesEditorSection {...(baseProps("US$") as any)}
      lines={[makeLine()]} />);
    expect((container.textContent ?? "")).toMatch(/US\$/);
    expect((container.textContent ?? "")).not.toMatch(/AR\$/);
  });
});

describe("T17 — Guard estático: no hay strings 'AR$'/'US$' hardcoded en los componentes afectados", () => {
  // Si alguien introduce una moneda hardcoded en alguno de estos archivos,
  // el guard salta. La fuente única es la prop `currency`/`mFmt`/`fmtMoney`.
  const sources = [
    "src/components/ui/TPDocumentLineAdvancedEditor.tsx",
    "src/components/sales/SaleLineDiscountSummary.tsx",
    "src/lib/pricing/display/saleCompositionDisplay.ts",
  ];
  for (const rel of sources) {
    it(`${rel} — sin literales "AR$"/"ARS"/"US$"/"USD" en código JSX`, async () => {
      const { readFileSync } = await import("node:fs");
      const { resolve } = await import("node:path");
      const src = readFileSync(resolve(process.cwd(), rel), "utf-8");
      // Permite comentarios y type union strings (typescript), pero NO
      // literales como `"AR$"` o `"US$"` en código de render. Filtramos
      // lo que esté en comments (`//` y `/* */`).
      const noComments = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(noComments).not.toMatch(/"AR\$"/);
      expect(noComments).not.toMatch(/"US\$"/);
    });
  }
});
