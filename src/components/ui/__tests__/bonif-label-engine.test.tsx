// src/components/ui/__tests__/bonif-label-engine.test.tsx
// ============================================================================
// El monto verde "−$" de Bonificación lee SIEMPRE `l.discountAmount` del
// motor (hidratado de `pl.lineDiscount`), NUNCA un recálculo local. Así:
//   · refleja la base "Aplica a" (Total/Metal/Hechura) — el motor ya la
//     aplicó al resolver el unitPrice → lineDiscount distinto por base;
//   · funciona con o SIN cliente (no depende de clientCommercialRules);
//   · dos líneas iguales con bases distintas muestran importes distintos.
// (El backend que produce esos discountAmount distintos sin cliente está
//  cubierto por g4-3-sale-pre-manual-discount: llamadas SIN clientId.)
// ============================================================================

import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LinesEditorSection } from "../../../pages/ventas-facturas/InvoiceEditorModal/LinesEditorSection";
import type { DocumentLine } from "../../../lib/document-types";

function line(id: string, discountAmount: number, appliesTo: string): DocumentLine {
  return {
    id, type: "ARTICLE", article: "Anillo", variant: "",
    articleId: "art-1", quantity: 1, unitPrice: 100,
    // discountAmount = lo que devolvió el motor para ESA base.
    discountAmount, subtotal: 100, taxAmount: 0,
    lineTotal: 100, lineTotalWithTax: 100,
    manualOverrides: { discount: true },
    pricingMeta: {
      priceSource: "MANUAL_OVERRIDE", basePrice: 100,
      composition: { metal: {}, hechura: {}, taxes: [] },
      manualDiscount: { mode: "PERCENT", value: 10, appliesTo },
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
  onAddLine: () => {}, setLineTaxOverride: () => {}, applyLineOverrides: () => {},
  clearLineOverrides: () => {}, onChangePriceList: () => {},
  onChangeLinePriceList: () => {}, onChangeChannel: () => {},
  handleEditArticle: () => {}, handleLineArticlePick: () => {},
  handleCreateManualLine: () => {}, searchArticles: undefined as any,
  exactLookupArticle: undefined as any, focusedLineId: null, focusSignal: 0,
  editorScopeRef: React.createRef<HTMLDivElement | null>(), previewLoading: false,
};

describe("Label de Bonificación = monto del motor (sin cliente)", () => {
  it("muestra el discountAmount del motor (TOTAL → −$100)", () => {
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[line("L1", 100, "TOTAL")]} />);
    expect(screen.getByText(/−\$\s*100/)).toBeInTheDocument();
  });

  it("misma línea con base METAL (motor devolvió 60) → −$60, NO −$100", () => {
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[line("L1", 60, "METAL")]} />);
    expect(screen.getByText(/−\$\s*60/)).toBeInTheDocument();
    expect(screen.queryByText(/−\$\s*100/)).toBeNull();
  });

  it("base HECHURA (motor devolvió 40) → −$40", () => {
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[line("L1", 40, "HECHURA")]} />);
    expect(screen.getByText(/−\$\s*40/)).toBeInTheDocument();
  });

  it("dos líneas iguales, bases distintas → importes distintos por línea", () => {
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[line("A", 100, "TOTAL"), line("B", 60, "METAL")]} />);
    expect(screen.getByText(/−\$\s*100/)).toBeInTheDocument();
    expect(screen.getByText(/−\$\s*60/)).toBeInTheDocument();
  });

  it("discountAmount 0 → no se muestra el label (no recálculo local fantasma)", () => {
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[line("L1", 0, "TOTAL")]} />);
    expect(screen.queryByText(/−\$/)).toBeNull();
  });
});
