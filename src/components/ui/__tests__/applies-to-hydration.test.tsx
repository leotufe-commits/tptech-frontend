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
  // El header de "Bonificación" ahora es un <button> dropdown; el <span> con
  // el texto matchea pero su parentElement directo es el <button>, no la
  // celda. Subimos hasta el primer ancestro que tenga el botón "Aplica a"
  // (común a celdas Bonificación e Impuestos). Para "Impuestos" sigue siendo
  // un <div> plano, así que el matched element ya es válido por sí mismo.
  // Para tolerar múltiples matches (el span "Bonificación" + opciones del
  // menú abierto en otros tests), usamos getAllByText y el primero.
  const matches = screen.getAllByText(label);
  for (const node of matches) {
    let el: HTMLElement | null = node;
    while (el) {
      if (el.querySelector('button[title="Cambiar a qué componente aplica"]')) {
        return el;
      }
      el = el.parentElement;
    }
  }
  // Fallback al comportamiento legacy si no se encontró.
  return matches[0].parentElement as HTMLElement;
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

  // Línea SIN composition (manual, o pre-preview): no podemos ofrecer
  // "Solo metal" / "Solo hechura" porque no sabemos qué hay debajo. La
  // única opción segura es Total — el combo puede o bien no renderizarse
  // (1 sola opción → estático), o bien renderizarse con solo TOTAL; en
  // ambos casos METAL/HECHURA NO deben aparecer ni en el texto del
  // trigger ni en el popover. Cubre "applyOn funciona sin cliente/sin
  // composition" del checklist de interacción.
  it("Bonificación: línea SIN composition → no ofrece 'Solo metal' / 'Solo hechura'", () => {
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[line("L1", { /* sin composition */ })]} />);
    const bonifCell = cell("Bonificación");
    const trigger = bonifCell.querySelector('button[title="Cambiar a qué componente aplica"]');
    // Si el combo se renderizó, abrimos y verificamos opciones; si no, OK.
    if (trigger) {
      fireEvent.click(trigger as HTMLButtonElement);
      const opts = popoverOptions();
      expect(opts.some((o) => /Solo metal|Solo hechura/.test(o))).toBe(false);
    }
    // En ningún caso el texto del trigger debe nombrar METAL/HECHURA.
    expect(bonifCell.textContent ?? "").not.toMatch(/Solo metal|Solo hechura/);
  });

  it("Impuestos: línea SIN composition → no ofrece 'Solo metal' / 'Solo hechura'", () => {
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[line("L1", { taxOverride: { mode: "PERCENT", value: 5, appliesTo: "TOTAL" } })]} />);
    const ivaCell = cell("Impuestos");
    const trigger = ivaCell.querySelector('button[title="Cambiar a qué componente aplica"]');
    if (trigger) {
      fireEvent.click(trigger as HTMLButtonElement);
      const opts = popoverOptions();
      expect(opts.some((o) => /Solo metal|Solo hechura/.test(o))).toBe(false);
    }
    expect(ivaCell.textContent ?? "").not.toMatch(/Solo metal|Solo hechura/);
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

  it("Bonificación → 'Solo metal' SIEMPRE crea manualDiscount (T3 — persistir como manual)", () => {
    // T3 — cambiar "Aplica en" es intención manual del operador. El patch
    // siempre arma `manualDiscount` con el efectivo visible + nueva base +
    // kind actual, para que `manualOverrides.discount` se prenda en
    // `applyLineOverrides` y la rehidratación NO pise la elección.
    const spy = vi.fn();
    render(<LinesEditorSection {...(baseProps as any)} applyLineOverrides={spy}
      lines={[line("L1", { inheritedDiscountAppliesTo: "HECHURA", composition: COMP })]} />);
    openCombo(cell("Bonificación"));
    fireEvent.click(Array.from(document.querySelectorAll("ul li button"))
      .find((b) => /Solo metal/.test(b.textContent ?? "")) as HTMLButtonElement);
    const last = spy.mock.calls[spy.mock.calls.length - 1];
    expect(last[1].manualDiscountAppliesTo).toBe("METAL");
    // Ahora SÍ viaja manualDiscount (con la base nueva y kind por default).
    expect(last[1].manualDiscount).toBeDefined();
    expect(last[1].manualDiscount.appliesTo).toBe("METAL");
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
    // Tomamos los buttons-trigger del dropdown ("Tipo de ajuste: Bonificación")
    // y para cada uno subimos al ancestro que contiene el botón "Aplica a".
    const triggers = screen.getAllByRole("button", { name: /tipo de ajuste:\s*bonificación/i });
    const texts = triggers.map((t) => {
      let el: HTMLElement | null = t;
      while (el && !el.querySelector('button[title="Cambiar a qué componente aplica"]')) {
        el = el.parentElement;
      }
      return appliesToText(el as HTMLElement);
    });
    expect(texts.some((t) => /Solo metal/.test(t ?? ""))).toBe(true);
    expect(texts.some((t) => /Solo hechura/.test(t ?? ""))).toBe(true);
  });
});
