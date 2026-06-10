// RUNTIME PROBE (temporal) — reproduce los DOS escenarios del usuario y lee el DOM.
// Caso A (MIXED): Item2 Unificada → metalRoundingMonetaryImpact = PRORRATEO (675).
// Caso B (PER_DOC): Item2 Desglosada misma lista → el backend SOBREESCRIBE ese
//   campo con el autónomo (6627) → metalRoundingMonetaryImpact = 2650 = lineOwn.
// lineOwn (autónomo de Item1) es 2650 en AMBOS (no depende del Item2).
// Objetivo: ver qué número pone el card vigente en el DOM en cada caso.
import React from "react";
import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { LinesEditorSection } from "../../../pages/ventas-facturas/InvoiceEditorModal/LinesEditorSection";

const LINE_OWN = 2650;   // lineOwnMetalRoundingMonetaryImpact (autónomo Item1) — IGUAL en A y B
const PRORR_A  = 675;    // metalRoundingMonetaryImpact en MIXED (prorrateo)
const PRORR_B  = 2650;   // metalRoundingMonetaryImpact en PER_DOC (overwrite = autónomo)

function makeLine(opts: { prorrateo: number; documentContext: string; strategy: string }): any {
  return {
    id: "L1", type: "ARTICLE", articleId: "art-1", article: "Anillo", variant: "",
    quantity: 1, unitPrice: 100, lineTotal: 100, lineTotalWithTax: 759831.25,
    discountAmount: 0, subtotal: 100, taxAmount: 21,
    pricingMeta: {
      priceSource: "PRICE_LIST", basePrice: 100,
      lineCommercialSummary: {
        mode: "BREAKDOWN",
        metals: { visibleGrams: 2.3, monetaryAmount: 574331.25, roundingImpact: LINE_OWN,
          byParent: [{ metalParentId: "oro", metalParentName: "Oro Fino", visibleGrams: 2.3, monetaryAmount: 574331.25, roundingImpact: LINE_OWN }] },
        monetary: { amount: 185500, roundingImpact: 0 },
        totalLineAmount: 759831.25,
        source: { strategy: opts.strategy, appliedListMode: "METAL_HECHURA", appliedPriceListId: "pl-x", documentContext: opts.documentContext, generatedBy: "buildLineCommercialSummary@v1" },
      },
      composition: { metals: [{ metalName: "Oro Fino", purity: 0.75, appliedGrams: 2.3, appliedMermaPct: 0, lineSale: 574331.25, lineSalePreRounding: 572343.75 }] },
      metalSale: 574331.25,
      metalRoundingMonetaryImpact: opts.prorrateo,          // ← lo que cambia entre A y B
      lineOwnMetalRoundingMonetaryImpact: LINE_OWN,         // ← autónomo, IGUAL en A y B
      lineOwnHechuraRoundingMonetaryImpact: 0,
      lineOwnMonetarySaldoPostCommercialRounding: 185500,
      lineOwnTotalWithTaxPostCommercialRounding: 759831.25,
    },
  };
}

const baseProps: any = {
  totalLinesInDraft: 1, currency: "$", displayRate: 1, viewMode: "detailed",
  headerSubtotals: undefined, priceLists: [], channels: [], warehouses: [],
  expandedLineIds: new Set<string>(["L1"]), advancedOpenLineIds: new Set<string>(),
  onToggleExpand: () => {}, onToggleAdvancedOpen: () => {}, patchLine: () => {},
  removeLine: () => {}, duplicateLine: () => {}, reorderLines: () => {}, resetLine: () => {},
  isReorderable: () => false, onAddLine: () => {}, applyLineOverrides: () => {},
  clearLineOverrides: () => {}, setLineTaxOverride: () => {}, onChangePriceList: () => {},
  onChangeLinePriceList: () => {}, onChangeChannel: () => {}, handleEditArticle: () => {},
  handleLineArticlePick: () => {}, handleCreateManualLine: () => {}, searchArticles: undefined,
  exactLookupArticle: undefined, focusedLineId: null, focusSignal: 0,
  editorScopeRef: React.createRef(), previewLoading: false,
};

function renderDom(line: any): string {
  const { container } = render(<LinesEditorSection {...baseProps} lines={[line]} />);
  fireEvent.click(container.querySelector("[data-tp-composition-detail-toggle]")!);
  return document.querySelector("[data-tp-metal-rounding-line-impact]")?.textContent ?? "(fila ausente)";
}

describe("RUNTIME PROBE — Caso A (MIXED) vs Caso B (PER_DOC), card VIGENTE", () => {
  it("imprime el DOM real de ambos casos", () => {
    const domA = renderDom(makeLine({ prorrateo: PRORR_A, documentContext: "MIXED_LIST", strategy: "PER_LINE" }));
    const domB = renderDom(makeLine({ prorrateo: PRORR_B, documentContext: "SHARED_LIST", strategy: "PER_DOCUMENT" }));
    console.log("\n===== CARD VIGENTE (lee lineOwn) =====");
    console.log("Caso A (MIXED  · prorrateo=675,  lineOwn=2650) → DOM =", JSON.stringify(domA));
    console.log("Caso B (PER_DOC· prorrateo=2650, lineOwn=2650) → DOM =", JSON.stringify(domB));
    console.log("\n===== SIMULACIÓN card VIEJO (leería metalRoundingMonetaryImpact) =====");
    console.log("Caso A → mostraría", PRORR_A, "| Caso B → mostraría", PRORR_B, "  (= tu evidencia +675 / +2650)");
    console.log("======================================\n");
    // El card vigente debe mostrar 2650 (lineOwn) en AMBOS — estable.
    expect(domA).toMatch(/2[.\s]?650/);
    expect(domB).toMatch(/2[.\s]?650/);
    expect(domA).not.toMatch(/675/);
  });
});
