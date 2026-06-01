// src/components/ui/__tests__/tax-detail-collapsible.test.tsx
// ============================================================================
// T5 — El detalle de Impuestos en Factura de ventas vive en un card
// colapsable (paridad con el card de Bonificación/Recargo).
//
// Reglas que fija este archivo:
//   1. El card NO se renderiza si no hay detalle útil (sin tasa, sin override,
//      sin monto > 0). "Exento cliente" y "Sin impuesto" quedan como labels
//      inline (info breve, no necesitan card).
//   2. El card aparece colapsado por default (chevron abajo). El detalle no
//      se ve hasta hacer click.
//   3. Al abrir, muestra el breakdown multi-impuesto y/o el total "+$X".
//   4. El TPNumber, selector %/$ y "Aplica en" quedan SIEMPRE arriba del
//      card (controles primarios, paridad con Bonif).
//   5. No hay "AR$ 0,00" en el card (no se renderiza si no hay monto).
// ============================================================================

import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LinesEditorSection } from "../../../pages/ventas-facturas/InvoiceEditorModal/LinesEditorSection";
import type { DocumentLine } from "../../../lib/document-types";

function makeLine(metaOverrides: any = {}, manualOverrides?: any): DocumentLine {
  return {
    id: "L1", type: "ARTICLE", article: "Anillo", variant: "",
    articleId: "art-1", quantity: 1, unitPrice: 100,
    discountAmount: 0, subtotal: 100, taxAmount: 21,
    lineTotal: 100, lineTotalWithTax: 121,
    pricingMeta: {
      priceSource: "PRICE_LIST", basePrice: 100,
      quantityDiscountAmount: 0, promotionDiscountAmount: 0,
      ...metaOverrides,
    },
    ...(manualOverrides ? { manualOverrides } : {}),
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
  onAddLine: () => {}, applyLineOverrides: () => {}, clearLineOverrides: () => {},
  setLineTaxOverride: () => {}, onChangePriceList: () => {},
  onChangeLinePriceList: () => {}, onChangeChannel: () => {},
  handleEditArticle: () => {}, handleLineArticlePick: () => {},
  handleCreateManualLine: () => {}, searchArticles: undefined as any,
  exactLookupArticle: undefined as any, focusedLineId: null, focusSignal: 0,
  editorScopeRef: React.createRef<HTMLDivElement | null>(), previewLoading: false,
};

function taxCard(): HTMLElement | null {
  return document.querySelector('[data-tp-line-tax-summary="true"]') as HTMLElement | null;
}
function taxPanel(): HTMLElement | null {
  return document.querySelector('[data-tp-line-tax-summary-panel="true"]') as HTMLElement | null;
}

describe("T5 — Card desplegable de Impuestos en Factura de ventas", () => {
  it("línea con IVA 21% → card visible pero COLAPSADO por default (panel ausente)", () => {
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          composition: { taxes: [{ name: "IVA", rate: 21, taxAmount: 21, appliesTo: "TOTAL" }] },
        })]} />,
    );
    // El card existe (hay detalle: monto > 0).
    expect(taxCard()).not.toBeNull();
    // El panel interno NO se renderiza hasta abrir → detalle hidden por default.
    expect(taxPanel()).toBeNull();
  });

  it("click en el header del card → abre el panel con el detalle", () => {
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          composition: { taxes: [{ name: "IVA", rate: 21, taxAmount: 21, appliesTo: "TOTAL" }] },
        })]} />,
    );
    const trigger = screen.getByRole("button", { name: /detalle de impuestos/i });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(taxPanel()).not.toBeNull();
  });

  it("línea exenta sin override → NO se renderiza card (no hay detalle útil)", () => {
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          taxExemptByEntity: true,
          composition: { taxes: [] },
          taxBreakdown: [],
        })]} />,
    );
    // Solo el chip inline "Exento cliente"; sin card colapsible.
    expect(screen.getByText("Exento cliente")).toBeInTheDocument();
    expect(taxCard()).toBeNull();
  });

  it("override manual borrado (taxZeroed) → label 'Sin impuesto' inline, sin card", () => {
    // Línea con taxAmount=0 y taxOverride value=0 → "Sin impuesto" inline.
    const line = makeLine({
      taxOverride: { mode: "PERCENT", value: 0, appliesTo: "TOTAL" },
      composition: { taxes: [] },
      taxBreakdown: [],
    }, { tax: true });
    (line as any).taxAmount = 0;
    (line as any).lineTotalWithTax = 100;
    render(<LinesEditorSection {...(baseProps as any)} lines={[line]} />);
    expect(screen.getByText("Sin impuesto")).toBeInTheDocument();
    expect(taxCard()).toBeNull();
  });

  // P1 #5 (Etapa E2) — REPRODUCTOR DE LABEL FANTASMA MULTI-IMPUESTO
  //
  // Reproducción del bug:
  //   1. Cliente con múltiples impuestos (ej. IVA 21% + Imp. Provincial 3%).
  //   2. taxBreakdown del preview cacheado tiene los 2 items con sus rates.
  //   3. Operador limpia (X) el override → meta.taxOverride={value:0}.
  //   4. ANTES del fix: el card "Detalle" seguía visible porque
  //      `hasManyDisplay=true` (breakdown del preview anterior) → mostraba
  //      el desglose stale "IVA 21% + Imp. Provincial 3%" aunque el input
  //      y el inline "Sin impuesto" decían lo contrario.
  //   5. DESPUÉS del fix: `hasTaxCardDetail` ahora exige `!taxZeroed`,
  //      ocultando el card entero. Solo queda el inline "Sin impuesto".
  it("REPRO BUG P1 #5 — override borrado con multi-impuesto en breakdown → card NO se renderiza", () => {
    const line = makeLine({
      // Override manual zeroed (operador limpió la X).
      taxOverride: { mode: "PERCENT", value: 0, appliesTo: "TOTAL" },
      // Breakdown del preview anterior con DOS impuestos (composition vacía
      // para que el render use `items = taxBreakdown`).
      composition: { taxes: [] },
      taxBreakdown: [
        { taxId: "iva", taxName: "IVA",            rate: 21, taxAmount: 0 },
        { taxId: "imp", taxName: "Imp. Provincial", rate:  3, taxAmount: 0 },
      ],
    }, { tax: true });
    (line as any).taxAmount = 0;
    (line as any).lineTotalWithTax = 100;
    render(<LinesEditorSection {...(baseProps as any)} lines={[line]} />);
    // Inline "Sin impuesto" sí aparece (gate ya existente).
    expect(screen.getByText("Sin impuesto")).toBeInTheDocument();
    // Card "Detalle" NO debe aparecer (fix del bug).
    expect(taxCard()).toBeNull();
    // Tampoco el panel interno.
    expect(taxPanel()).toBeNull();
  });

  // Regresión: cliente exento con multi-impuesto en breakdown sigue mostrando
  // solo chip "Exento cliente" sin card (gate previo `!exempt`).
  it("Regresión — cliente exento con multi-impuesto en breakdown stale: chip 'Exento', sin card", () => {
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        taxExemptByEntity: true,
        composition: { taxes: [] },
        taxBreakdown: [
          { taxId: "iva", taxName: "IVA",            rate: 21, taxAmount: 0 },
          { taxId: "imp", taxName: "Imp. Provincial", rate:  3, taxAmount: 0 },
        ],
      })]} />);
    expect(screen.getByText("Exento cliente")).toBeInTheDocument();
    expect(taxCard()).toBeNull();
  });

  // Regresión: override manual con value > 0 sigue mostrando card (no afecta
  // el fix porque `taxZeroed=false` cuando value > 0).
  it("Regresión — override manual con value > 0 + multi-impuesto: card SIGUE visible", () => {
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        taxOverride: { mode: "PERCENT", value: 15, appliesTo: "TOTAL" },
        composition: { taxes: [] },
        taxBreakdown: [
          { taxId: "iva", taxName: "IVA",            rate: 21, taxAmount: 21 },
          { taxId: "imp", taxName: "Imp. Provincial", rate:  3, taxAmount:  3 },
        ],
      }, { tax: true })]} />);
    // El card sigue visible: el operador eligió un valor manual > 0 explícito.
    expect(taxCard()).not.toBeNull();
  });

  it("no muestra subtotal 'AR$ 0,00' fantasma cuando no hay detalle", () => {
    // Sin impuesto, sin override → el card no aparece y no debe haber
    // "AR$ 0,00" / "0,00" residual en la celda de Impuestos.
    const line = makeLine({
      composition: { taxes: [] },
      taxBreakdown: [],
    });
    (line as any).taxAmount = 0;
    (line as any).lineTotalWithTax = 100;
    const { container } = render(<LinesEditorSection {...(baseProps as any)} lines={[line]} />);
    expect(taxPanel()).toBeNull();
    // El TPNumber con valor 0 puede mostrar "0,00" (es el input, ese se
    // mantiene). Lo que NO debe estar es una línea de "Total" con AR$ 0,00.
    expect(container.textContent).not.toMatch(/Total:\s*\+/);
  });

  it("T11 — al abrir el card muestra Origen 'Automático' + 'Aplica en' + monto por impuesto", () => {
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        composition: { taxes: [
          { name: "IVA", rate: 21, taxAmount: 21, appliesTo: "TOTAL" },
        ] },
      })]} />);
    const trigger = screen.getByRole("button", { name: /detalle de impuestos/i });
    fireEvent.click(trigger);
    const panel = taxPanel()!;
    expect(panel).not.toBeNull();
    expect(panel.textContent ?? "").toMatch(/Origen/i);
    expect(panel.textContent ?? "").toMatch(/Automático/i);
    expect(panel.textContent ?? "").toMatch(/Aplica en/i);
    expect(panel.textContent ?? "").toMatch(/Total/i);
    // Nombre + tasa.
    expect(panel.textContent ?? "").toMatch(/IVA/);
    expect(panel.textContent ?? "").toMatch(/21/);
  });

  it("T11 — override manual: Origen 'Manual' visible al abrir el card", () => {
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        taxOverride: { mode: "PERCENT", value: 30, appliesTo: "TOTAL" },
        composition: { taxes: [] },
      }, { tax: true })]} />);
    const trigger = screen.getByRole("button", { name: /detalle de impuestos/i });
    fireEvent.click(trigger);
    const panel = taxPanel()!;
    expect(panel).not.toBeNull();
    // El badge "Manual" aparece dentro del card (origen Manual).
    expect(panel.textContent ?? "").toMatch(/Manual/i);
    expect(panel.textContent ?? "").not.toMatch(/Automático/i);
  });

  it("T11 — applyOn=METAL → muestra 'Aplica en: Solo metal'", () => {
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        composition: { taxes: [
          { name: "IVA", rate: 21, taxAmount: 21, appliesTo: "METAL" },
        ] },
      })]} />);
    const trigger = screen.getByRole("button", { name: /detalle de impuestos/i });
    fireEvent.click(trigger);
    const panel = taxPanel()!;
    expect(panel.textContent ?? "").toMatch(/Aplica en:?\s*Solo metal/i);
  });

  it("T11 — sin textos técnicos en el card (override/pipeline/motor/reemplaza)", () => {
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        composition: { taxes: [
          { name: "IVA", rate: 21, taxAmount: 21, appliesTo: "TOTAL" },
        ] },
      })]} />);
    fireEvent.click(screen.getByRole("button", { name: /detalle de impuestos/i }));
    const panel = taxPanel()!;
    expect(panel.textContent ?? "").not.toMatch(/override/i);
    expect(panel.textContent ?? "").not.toMatch(/pipeline/i);
    expect(panel.textContent ?? "").not.toMatch(/reemplaza/i);
  });

  it("abrir y cerrar el card es independiente entre líneas (estado per-line)", () => {
    render(
      <LinesEditorSection {...(baseProps as any)} totalLinesInDraft={2}
        lines={[
          makeLine({
            composition: { taxes: [{ name: "IVA", rate: 21, taxAmount: 21, appliesTo: "TOTAL" }] },
          }),
          { ...makeLine({
              composition: { taxes: [{ name: "IVA", rate: 21, taxAmount: 21, appliesTo: "TOTAL" }] },
            }), id: "L2" } as DocumentLine,
        ]} />,
    );
    const triggers = screen.getAllByRole("button", { name: /detalle de impuestos/i });
    expect(triggers.length).toBe(2);
    fireEvent.click(triggers[0]);
    expect(triggers[0].getAttribute("aria-expanded")).toBe("true");
    // El segundo card sigue cerrado — no es state global.
    expect(triggers[1].getAttribute("aria-expanded")).toBe("false");
  });
});
