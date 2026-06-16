// src/components/ui/__tests__/monetary-only-line-detail.test.tsx
// ============================================================================
// LÍNEA MONETARIA PURA (sin metal físico real) — servicio, combo, producto sin
// metal: "Ver detalle comercial" despliega Valor comercial → Redondeo comercial
// → Valor redondeado, igual que el combo comercial desglosado/unificada.
// Los artículos CON metal real conservan su detalle de metal (sin regresión).
// Generaliza la condición `isComboLine` a `isMonetaryOnlyLine`
// (`metalParents.length === 0`). Solo display — cero cálculo.
// ============================================================================
import React from "react";
import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { LinesEditorSection } from "../../../pages/ventas-facturas/InvoiceEditorModal/LinesEditorSection";
import type { DocumentLine } from "../../../lib/document-types";

function makeLine(pricingMeta: any, over: Partial<DocumentLine> = {}): DocumentLine {
  return {
    id: "L1", type: "ARTICLE", article: "X", variant: "",
    articleId: "art-1", quantity: 1, unitPrice: 100,
    discountAmount: 0, subtotal: 100, taxAmount: 21, lineTotal: 100, lineTotalWithTax: 121,
    ...over,
    pricingMeta: { basePrice: 100, ...pricingMeta },
  } as unknown as DocumentLine;
}
const baseProps = {
  totalLinesInDraft: 1, currency: "$", displayRate: 1, viewMode: "detailed" as const, headerSubtotals: undefined,
  priceLists: [], channels: [], warehouses: [],
  expandedLineIds: new Set<string>(["L1"]), advancedOpenLineIds: new Set<string>(),
  onToggleExpand: () => {}, onToggleAdvancedOpen: () => {}, patchLine: () => {}, removeLine: () => {}, duplicateLine: () => {},
  reorderLines: () => {}, resetLine: () => {}, isReorderable: () => false, onAddLine: () => {},
  applyLineOverrides: () => {}, clearLineOverrides: () => {}, setLineTaxOverride: () => {}, onChangePriceList: () => {},
  onChangeLinePriceList: () => {}, onChangeChannel: () => {}, handleEditArticle: () => {}, handleLineArticlePick: () => {},
  handleCreateManualLine: () => {}, searchArticles: undefined as any, exactLookupArticle: undefined as any,
  focusedLineId: null, focusSignal: 0, editorScopeRef: React.createRef<HTMLDivElement | null>(), previewLoading: false,
};

const ROUND_SUMMARY = { mode: "BREAKDOWN", metals: null, monetary: { amount: 518800, roundingImpact: 0 }, totalLineAmount: 518800, source: {} };

function desgRoundedMeta(extra: any) {
  return {
    appliedPriceListMode: "METAL_HECHURA", lineBalanceMode: "BREAKDOWN",
    lineCommercialSummary: ROUND_SUMMARY,
    lineOwnHechuraRoundingMonetaryImpact: 18.75,
    lineOwnTotalWithTaxPostCommercialRounding: 518800,
    ...extra,
  };
}

function expectMonetaryDetail(container: HTMLElement) {
  const toggle = container.querySelector("[data-tp-composition-detail-toggle]")!;
  expect(toggle.textContent ?? "").toMatch(/Ver detalle comercial/);
  fireEvent.click(toggle);
  expect(container.querySelector("[data-tp-hechura-base]")).toBeTruthy();           // Valor comercial
  expect(container.querySelector("[data-tp-hechura-rounding-delta]")).toBeTruthy();  // Redondeo comercial
  expect(container.querySelector("[data-tp-hechura-rounded]")).toBeTruthy();         // Valor redondeado
  expect((container.querySelector("[data-tp-hechura-rounding-delta]")?.textContent ?? "")).toMatch(/18[,.]\s?75/);
  // Sin filas de metal en $0.
  expect(container.querySelector("[data-tp-metal-final]")).toBeNull();
}

describe("Línea monetaria pura — detalle del redondeo (servicio / producto sin metal)", () => {
  it("SERVICIO desglosado con redondeo → Valor comercial / Redondeo / Valor redondeado", () => {
    const { container } = render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine(desgRoundedMeta({
        priceSource: "SERVICE_AS_HECHURA",
        composition: { metals: [], products: [], services: [{ name: "S", lineCost: 400, lineSale: 500 }] },
      }), { itemKind: "SERVICE", lineTotalWithTax: 518800 } as any)]} />);
    expectMonetaryDetail(container);
  });

  it("PRODUCTO sin metal desglosado con redondeo → mismo detalle", () => {
    const { container } = render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine(desgRoundedMeta({
        priceSource: "PRICE_LIST",
        composition: { metals: [], products: [{ name: "P", lineCost: 400, lineSale: 500 }], services: [] },
      }), { itemKind: "ARTICLE_SIMPLE", lineTotalWithTax: 518800 } as any)]} />);
    expectMonetaryDetail(container);
  });

  it("SERVICIO desglosado con redondeo en appliedRounding (FINAL_PRICE) → muestra detalle", () => {
    const { container } = render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        priceSource: "SERVICE_AS_HECHURA", appliedPriceListMode: "METAL_HECHURA", lineBalanceMode: "BREAKDOWN",
        lineCommercialSummary: ROUND_SUMMARY,
        composition: { metals: [], products: [], services: [{ name: "S", lineCost: 400 }] },
        appliedRounding: { applyOn: "TOTAL", mode: "HUNDRED", direction: "NEAREST", preRounding: 518781.25, postRounding: 518800, unitAdjustment: 18.75 },
      }, { itemKind: "SERVICE", lineTotalWithTax: 518800 } as any)]} />);
    expectMonetaryDetail(container);
  });
});

describe("Artículo CON metal real — sin regresión (conserva detalle de metal)", () => {
  const METAL_SUMMARY = {
    mode: "BREAKDOWN",
    metals: { visibleGrams: 1.4, monetaryAmount: 349987.5, roundingImpact: 9675,
      byParent: [{ metalParentId: "oro", metalParentName: "Oro Fino", visibleGrams: 1.4, monetaryAmount: 350000, roundingImpact: 9675 }] },
    monetary: { amount: 185500, roundingImpact: 24.79 }, totalLineAmount: 535487.5, source: {},
  };
  function metalLine() {
    return makeLine({
      priceSource: "PRICE_LIST", appliedPriceListMode: "METAL_HECHURA", lineBalanceMode: "BREAKDOWN",
      lineCommercialSummary: METAL_SUMMARY,
      composition: { metals: [{ metalName: "Oro Fino", purity: 0.75, appliedGrams: 1.5, appliedMermaPct: 0, lineSale: 340312.5 }], products: [], services: [] },
      metalSale: 350000, hechuraSale: 185475.21, lineOwnMetalRoundingMonetaryImpact: 9675,
    }, { itemKind: "ARTICLE_SIMPLE", lineTotalWithTax: 535487.5 } as any);
  }

  it("metal desglosado → label 'Ver detalle' (NO 'Ver detalle comercial')", () => {
    const { container } = render(<LinesEditorSection {...(baseProps as any)} lines={[metalLine()]} />);
    const toggle = container.querySelector("[data-tp-composition-detail-toggle]")!;
    expect(toggle.textContent ?? "").toMatch(/Ver detalle/);
    expect(toggle.textContent ?? "").not.toMatch(/Ver detalle comercial/);
  });

  it("metal desglosado expandido → conserva 'Valor final metales' y 'Redondeo comercial metal'", () => {
    const { container } = render(<LinesEditorSection {...(baseProps as any)} lines={[metalLine()]} />);
    fireEvent.click(container.querySelector("[data-tp-composition-detail-toggle]")!);
    expect(container.querySelector("[data-tp-metal-final]")).toBeTruthy();
    expect(container.querySelector("[data-tp-metal-rounding-line]")).toBeTruthy();
    // Y NO agrega "Valor redondeado" (exclusiva de monetaria pura / unificada).
    expect(container.querySelector("[data-tp-hechura-rounded]")).toBeNull();
  });
});
