// src/components/ui/__tests__/bonif-net-mixed.test.tsx
// ============================================================================
// T16 — Cuando conviven PROMO/QTY/MIXED + recargo del cliente (signos
// opuestos), el TPNumber de Bonificación/Recargo debe reflejar el NETO
// acumulado del motor, no 0,00. El selector kind y el label dinámico se
// alinean al signo del NETO. Manual sigue ganando.
//
// Fórmula visual (passthrough estricto):
//   signedAdj = basePrice × qty − subtotal
//     > 0 → Bonificación (precio bajó respecto a la lista).
//     < 0 → Recargo (precio subió respecto a la lista).
//   magnitud = |signedAdj|; pctEff = magnitud / baseInitial × 100.
//   `basePrice` y `subtotal` son passthrough del motor.
// ============================================================================

import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LinesEditorSection } from "../../../pages/ventas-facturas/InvoiceEditorModal/LinesEditorSection";
import type { DocumentLine } from "../../../lib/document-types";

function makeLine(metaOverrides: any = {}, lineOverrides: any = {}): DocumentLine {
  return {
    id: "L1", type: "ARTICLE", article: "Anillo", variant: "",
    articleId: "art-1", quantity: 1, unitPrice: 1000,
    discountAmount: 0, subtotal: 1000, taxAmount: 0,
    lineTotal: 1000, lineTotalWithTax: 1000,
    pricingMeta: {
      priceSource: "PRICE_LIST", basePrice: 1000,
      quantityDiscountAmount: 0, promotionDiscountAmount: 0,
      ...metaOverrides,
    },
    ...lineOverrides,
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

function getBonifInput(): HTMLInputElement {
  // Idéntico patrón que `bonif-input-connected.test.tsx`: subir desde el
  // trigger del kind hasta el ancestro que contiene el primer <input>.
  const trigger = screen.getByRole("button", { name: /tipo de ajuste/i });
  let el: HTMLElement | null = trigger;
  while (el && !el.querySelector("input")) el = el.parentElement;
  if (!el) throw new Error("No se encontró la celda Bonificación");
  return el.querySelector("input") as HTMLInputElement;
}

describe("T16 — TPNumber refleja el NETO acumulado del motor (no 0,00)", () => {
  it("Promo > Recargo cliente → NETO BONIFICACIÓN; selector dice 'Bonificación'", () => {
    // base=1000, subtotal=900 → neto bonificación de 100 (10%).
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        basePrice: 1000,
        promotionDiscountAmount: 200, // promo per-unit
        customerDiscountAmount: -100, // cliente recargó 100 (signo motor)
      }, { subtotal: 900, lineTotal: 900, lineTotalWithTax: 900 })]} />);
    // El selector kind muestra "Bonificación".
    const trigger = screen.getByRole("button", { name: /tipo de ajuste:\s*bonificación/i });
    expect(trigger).toBeInTheDocument();
    // El input muestra el % efectivo neto, no 0.
    const input = getBonifInput();
    const v = parseFloat((input.value || "0").replace(/[^\d.,-]/g, "").replace(",", "."));
    expect(Math.abs(v - 10)).toBeLessThan(0.5); // ≈ 10%
  });

  it("Recargo cliente > Promo → NETO RECARGO; selector dice 'Recargo' y label 'Recargo acumulado'", () => {
    // base=1000, subtotal=1150 → neto recargo de 150 (15%).
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        basePrice: 1000,
        promotionDiscountAmount: 100, // promo per-unit reducía 100
        customerDiscountAmount: -250, // cliente recargó 250
      }, { subtotal: 1150, lineTotal: 1150, lineTotalWithTax: 1150 })]} />);
    // El selector kind muestra "Recargo".
    const trigger = screen.getByRole("button", { name: /tipo de ajuste:\s*recargo/i });
    expect(trigger).toBeInTheDocument();
    // El label dinámico "Recargo acumulado" aparece.
    expect((document.body.textContent ?? "")).toMatch(/Recargo acumulado/);
    // El input refleja el % efectivo neto (≈ 15%), no 0.
    const input = getBonifInput();
    const v = parseFloat((input.value || "0").replace(/[^\d.,-]/g, "").replace(",", "."));
    expect(Math.abs(v - 15)).toBeLessThan(0.5);
  });

  it("Promo y Recargo que se cancelan → TPNumber muestra 0,00 (sin ajuste neto)", () => {
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        basePrice: 1000,
        promotionDiscountAmount: 100,
        customerDiscountAmount: -100,
      }, { subtotal: 1000, lineTotal: 1000, lineTotalWithTax: 1000 })]} />);
    const input = getBonifInput();
    const v = parseFloat((input.value || "0").replace(/[^\d.,-]/g, "").replace(",", "."));
    expect(v).toBe(0);
  });

  it("Override manual GANA al neto efectivo (no se sobreescribe por signo)", () => {
    // Aunque el neto sea recargo, el manual MD={kind:BONUS, value:5}
    // debe imponer "Bonificación" como kind visible.
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[{
        ...makeLine({
          basePrice: 1000,
          manualDiscount: { mode: "PERCENT", value: 5, appliesTo: "TOTAL", kind: "BONUS" },
        }, { subtotal: 1100, lineTotal: 1100, lineTotalWithTax: 1100 }),
        manualOverrides: { discount: true },
      } as unknown as DocumentLine]} />);
    // El selector muestra "Bonificación" (manual gana).
    const trigger = screen.getByRole("button", { name: /tipo de ajuste:\s*bonificación/i });
    expect(trigger).toBeInTheDocument();
  });

  it("Sin promo/qty/cliente — neto cero → 0,00 (no se prende source falsamente)", () => {
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        basePrice: 1000,
      }, { subtotal: 1000, lineTotal: 1000, lineTotalWithTax: 1000 })]} />);
    const input = getBonifInput();
    const v = parseFloat((input.value || "0").replace(/[^\d.,-]/g, "").replace(",", "."));
    expect(v).toBe(0);
  });
});
