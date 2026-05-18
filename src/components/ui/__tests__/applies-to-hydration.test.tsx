// src/components/ui/__tests__/applies-to-hydration.test.tsx
// ============================================================================
// "Aplica a" en Factura — DECISIÓN FUNCIONAL (temporal): solo 3 opciones
// simples seleccionables en TODOS los combos (Impuestos y Bonificación):
//   · Total · Solo metal · Solo hechura
// Las bases avanzadas (Metal+Hechura, Subtotal antes/después, Product/
// Service) NO se ofrecen. Si el valor heredado/persistido es avanzado →
// fallback seguro a "Total". El backend las sigue soportando (datos viejos)
// pero la UI no las deja elegir. Cambiar una de las 3 viaja como override.
// ============================================================================

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LinesEditorSection } from "../../../pages/ventas-facturas/InvoiceEditorModal/LinesEditorSection";
import type { DocumentLine } from "../../../lib/document-types";

function line(id: string, meta: any, extra: Partial<DocumentLine> = {}): DocumentLine {
  return {
    id, type: "ARTICLE", article: "Anillo", variant: "",
    articleId: "art-1", quantity: 1, unitPrice: 100, discountAmount: 0,
    subtotal: 100, taxAmount: 21, lineTotal: 121, lineTotalWithTax: 121,
    pricingMeta: { priceSource: "PRICE_LIST", basePrice: 100, ...meta },
    ...extra,
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

const COMP = { metal: {}, hechura: {}, taxes: [] };

function cell(label: string): HTMLElement {
  return screen.getByText(label).parentElement as HTMLElement;
}
function appliesToText(c: HTMLElement): string | null {
  return c.querySelector('button[title="Cambiar a qué componente aplica"]')?.textContent ?? null;
}
function openCombo(c: HTMLElement) {
  fireEvent.click(c.querySelector('button[title="Cambiar a qué componente aplica"]') as HTMLButtonElement);
}
function popoverOptions(): string[] {
  return Array.from(document.querySelectorAll("ul li button"))
    .map((b) => (b.textContent ?? "").trim()).filter(Boolean);
}

describe("Combos limitados a 3 opciones simples", () => {
  it("Impuestos: solo Total / Solo metal / Solo hechura (sin avanzadas)", () => {
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[line("L1", { composition: COMP, taxOverride: { mode: "PERCENT", value: 5, appliesTo: "TOTAL" } })]} />);
    openCombo(cell("Impuestos"));
    const opts = popoverOptions();
    expect(opts.sort()).toEqual(["Solo hechura", "Solo metal", "Total"]);
    expect(opts.some((o) => /Metal \+ Hechura|Subtotal|Producto|Servicio/.test(o))).toBe(false);
  });

  it("Bonificación: solo Total / Solo metal / Solo hechura", () => {
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[line("L1", { inheritedDiscountAppliesTo: "METAL", composition: COMP })]} />);
    openCombo(cell("Bonificación"));
    const opts = popoverOptions();
    expect(opts.sort()).toEqual(["Solo hechura", "Solo metal", "Total"]);
  });
});

describe("Hidratación con fallback seguro", () => {
  it("Impuestos: base avanzada heredada (SUBTOTAL_AFTER_DISCOUNT) → cae a 'Total'", () => {
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[line("L1", { composition: { metal: {}, hechura: {}, taxes: [
        { id: "t1", name: "IVA", code: "IVA", rate: 21, appliesTo: "SUBTOTAL_AFTER_DISCOUNT", taxAmount: 21, manual: false },
      ] } })]} />);
    const txt = appliesToText(cell("Impuestos"));
    expect(txt == null || /Total/.test(txt)).toBe(true);
    expect(txt == null || !/Subtotal/.test(txt)).toBe(true);
  });

  it("Bonificación: heredado avanzado (METAL_Y_HECHURA) → cae a 'Total'", () => {
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[line("L1", { inheritedDiscountAppliesTo: "METAL_Y_HECHURA", composition: COMP })]} />);
    expect(appliesToText(cell("Bonificación"))).toMatch(/Total/);
  });

  it("Bonificación: heredado simple (METAL) → 'Solo metal'", () => {
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[line("L1", { inheritedDiscountAppliesTo: "METAL", composition: COMP })]} />);
    expect(appliesToText(cell("Bonificación"))).toMatch(/Solo metal/);
  });

  it("override manual simple gana sobre el heredado", () => {
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[line("L1", {
        inheritedDiscountAppliesTo: "METAL",
        manualDiscount: { mode: "PERCENT", value: 10, appliesTo: "HECHURA" },
        composition: COMP,
      }, { manualOverrides: { discount: true } })]} />);
    expect(appliesToText(cell("Bonificación"))).toMatch(/Solo hechura/);
  });
});

describe("Cambiar el combo viaja como override (sin valor) y recalcula", () => {
  it("Impuestos → 'Solo hechura' viaja manualTaxAppliesTo", () => {
    const spy = vi.fn();
    render(<LinesEditorSection {...(baseProps as any)} applyLineOverrides={spy}
      lines={[line("L1", { composition: COMP, taxOverride: { mode: "PERCENT", value: 5, appliesTo: "TOTAL" } })]} />);
    openCombo(cell("Impuestos"));
    fireEvent.click(Array.from(document.querySelectorAll("ul li button"))
      .find((b) => /Solo hechura/.test(b.textContent ?? "")) as HTMLButtonElement);
    const last = spy.mock.calls[spy.mock.calls.length - 1];
    expect(last[0]).toBe("L1");
    expect(last[1].manualTaxAppliesTo).toBe("HECHURA");
  });

  it("Bonificación → 'Solo metal' viaja manualDiscountAppliesTo (sin override de valor)", () => {
    const spy = vi.fn();
    render(<LinesEditorSection {...(baseProps as any)} applyLineOverrides={spy}
      lines={[line("L1", { inheritedDiscountAppliesTo: "HECHURA", composition: COMP })]} />);
    openCombo(cell("Bonificación"));
    fireEvent.click(Array.from(document.querySelectorAll("ul li button"))
      .find((b) => /Solo metal/.test(b.textContent ?? "")) as HTMLButtonElement);
    const last = spy.mock.calls[spy.mock.calls.length - 1];
    expect(last[1].manualDiscountAppliesTo).toBe("METAL");
    expect(last[1].manualDiscount).toBeUndefined();
  });
});

describe("Independiente por línea (mismo artículo)", () => {
  it("línea A heredada METAL, línea B override HECHURA → distintas", () => {
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[
        line("A", { inheritedDiscountAppliesTo: "METAL", composition: COMP }),
        line("B", {
          inheritedDiscountAppliesTo: "METAL",
          manualDiscount: { mode: "PERCENT", value: 5, appliesTo: "HECHURA" },
          composition: COMP,
        }, { manualOverrides: { discount: true } }),
      ]} />);
    const texts = screen.getAllByText("Bonificación")
      .map((el) => appliesToText(el.parentElement as HTMLElement));
    expect(texts.some((t) => /Solo metal/.test(t ?? ""))).toBe(true);
    expect(texts.some((t) => /Solo hechura/.test(t ?? ""))).toBe(true);
  });
});
