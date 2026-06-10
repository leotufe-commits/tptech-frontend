// src/components/ui/__tests__/cardAutonomous-render.test.tsx
// ============================================================================
// OPCIÓN B — El "Resumen Comercial del Artículo" (DESGLOSADA) usa SIEMPRE el
// redondeo AUTÓNOMO de la línea (`lineOwn*`), NUNCA el prorrateo documental
// (`metalRoundingMonetaryImpact`).
//
// Contrato: mismo artículo + misma lista + misma cantidad + mismo metal =
// mismo Resumen Comercial, AUNQUE cambien otras líneas del documento.
// Variar el prorrateo (`metalRoundingMonetaryImpact`) simula "otras líneas
// cambiaron"; el card debe permanecer IDÉNTICO porque lee `lineOwn*`.
//
// Invariante interno del card (garantizado por backend):
//   (sumMetalSale + ownMetalImpact) + ownMonetario === ownTotal
//   (572.343,75 + 1.987,50) + 185.500 = 574.331,25 + 185.500 = 759.831,25
// ============================================================================

import React from "react";
import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { LinesEditorSection } from "../../../pages/ventas-facturas/InvoiceEditorModal/LinesEditorSection";
import type { DocumentLine } from "../../../lib/document-types";

const baseProps = {
  totalLinesInDraft: 1, currency: "$", displayRate: 1,
  viewMode: "detailed" as const, headerSubtotals: undefined,
  priceLists: [], channels: [], warehouses: [],
  expandedLineIds: new Set<string>(["L1"]), advancedOpenLineIds: new Set<string>(),
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

// Item 1 DESGLOSADA — `lineOwn*` FIJOS (autónomos); `prorrateo` VARÍA por escenario.
function item1(prorrateo: number): DocumentLine {
  return {
    id: "L1", type: "ARTICLE", article: "Anillo", variant: "",
    articleId: "art-1", quantity: 1, unitPrice: 100,
    discountAmount: 0, subtotal: 100, taxAmount: 21,
    lineTotal: 100, lineTotalWithTax: 759831.25,
    pricingMeta: {
      priceSource: "PRICE_LIST", basePrice: 100,
      lineCommercialSummary: {
        mode: "BREAKDOWN",
        metals: { visibleGrams: 1.4, monetaryAmount: 574331.25, roundingImpact: 1987.5,
          byParent: [{ metalParentId: "oro", metalParentName: "Oro Fino", visibleGrams: 1.4, monetaryAmount: 574331.25, roundingImpact: 1987.5 }] },
        monetary: { amount: 185500, roundingImpact: 24.79 },
        totalLineAmount: 759831.25,
        source: { strategy: "PER_DOCUMENT", appliedListMode: "METAL_HECHURA", appliedPriceListId: "pl-d", documentContext: "SHARED_LIST", generatedBy: "buildLineCommercialSummary@v1" },
      },
      // lineSale = POST (574.331,25, contaminado) ; lineSalePreRounding = PRE
      // (572.343,75, base = Composición). El card debe usar el PRE.
      composition: { metals: [{ metalName: "Oro Fino", purity: 0.75, appliedGrams: 1.5, appliedMermaPct: 0, lineSale: 574331.25, lineSalePreRounding: 572343.75 }] },
      metalSale: 574331.25,
      // Prorrateo documental (VARÍA — NO debe usarse en el card):
      metalRoundingMonetaryImpact: prorrateo,
      // Autónomos de línea (FIJOS — los que el card debe usar):
      lineOwnMetalRoundingMonetaryImpact:         1987.5,
      lineOwnHechuraRoundingMonetaryImpact:       24.79,
      lineOwnMonetarySaldoPostCommercialRounding: 185500,
      lineOwnTotalWithTaxPostCommercialRounding:  759831.25,
    },
  } as unknown as DocumentLine;
}

function readCard(container: HTMLElement) {
  fireEvent.click(container.querySelector("[data-tp-composition-detail-toggle]")!);
  return {
    metalRedondeo: document.querySelector("[data-tp-metal-rounding-line-impact]")?.textContent ?? "",
    metalFinal:    document.querySelector("[data-tp-metal-final]")?.textContent ?? "",
    monetario:     document.querySelector("[data-tp-hechura-display-total]")?.textContent ?? "",
    totalLinea:    document.querySelector("[data-tp-line-total-collapsed]")?.textContent ?? "",
  };
}

describe("Resumen Comercial AUTÓNOMO (Opción B) — Desglosada", () => {
  it("usa lineOwn* (1.987,50), NO el prorrateo metalRoundingMonetaryImpact (9.999)", () => {
    const { container } = render(<LinesEditorSection {...(baseProps as any)} lines={[item1(9999)]} />);
    const c = readCard(container);
    expect(c.metalRedondeo).toMatch(/1[.\s]?987/);       // autónomo
    expect(c.metalRedondeo).not.toMatch(/9[.\s]?999/);   // NO el prorrateo
    expect(c.metalFinal).toMatch(/574[.\s]?331/);        // 572.343,75 + 1.987,50
    expect(c.monetario).toMatch(/185[.\s]?500/);         // saldo autónomo
    expect(c.totalLinea).toMatch(/759[.\s]?831/);        // total autónomo
  });

  it("A/B/C/D — card del Item 1 IDÉNTICO aunque varíe el prorrateo (otras líneas)", () => {
    // A) Item 1 solo (prorrateo 0) · B) +Item2 misma lista (1.212,50) ·
    // C) +Item2 lista distinta (9.675) · D) documento mixto (5.555).
    const escenarios = [0, 1212.5, 9675, 5555];
    const cards = escenarios.map((p) => {
      const { container } = render(<LinesEditorSection {...(baseProps as any)} lines={[item1(p)]} />);
      return readCard(container);
    });
    cards.forEach((c) => {
      expect(c).toEqual(cards[0]);                       // todos idénticos al primero
      expect(c.metalRedondeo).toMatch(/1[.\s]?987/);     // siempre el autónomo
    });
  });

  it("Valor comercial = base PRE (572.343,75 = Composición); Valor final = PRE + redondeo (574.331,25); SIN doble conteo (≠576.318,75)", () => {
    const { container } = render(<LinesEditorSection {...(baseProps as any)} lines={[item1(9999)]} />);
    fireEvent.click(container.querySelector("[data-tp-composition-detail-toggle]")!);
    const text = container.textContent ?? "";
    expect(text).toMatch(/572[.\s]?343/);   // "Valor comercial" = base PRE (= Composición del costo)
    // "Valor final metales" = PRE + redondeo = 574.331,25 (NO el POST crudo ni el doble conteo)
    expect((document.querySelector("[data-tp-metal-final]")?.textContent ?? "")).toMatch(/574[.\s]?331/);
    expect(text).not.toMatch(/576[.\s]?318/); // doble conteo (sumMetalSale POST + impacto) — NO debe ocurrir
  });

  // Regla #6 — SIN `lineOwn*` ni `metalSaleRoundingDelta`: el card NO debe usar
  // el prorrateo documental (`metalRoundingMonetaryImpact`) como redondeo propio.
  function item1NoOwn(prorrateo: number): DocumentLine {
    return {
      id: "L1", type: "ARTICLE", article: "Anillo", variant: "",
      articleId: "art-1", quantity: 1, unitPrice: 100,
      discountAmount: 0, subtotal: 100, taxAmount: 21,
      lineTotal: 100, lineTotalWithTax: 759831.25,
      pricingMeta: {
        priceSource: "PRICE_LIST", basePrice: 100,
        lineCommercialSummary: {
          mode: "BREAKDOWN",
          metals: { visibleGrams: 1.4, monetaryAmount: 574331.25, roundingImpact: 0,
            byParent: [{ metalParentId: "oro", metalParentName: "Oro Fino", visibleGrams: 1.4, monetaryAmount: 574331.25, roundingImpact: 0 }] },
          monetary: { amount: 185500, roundingImpact: 0 },
          totalLineAmount: 759831.25,
          source: { strategy: "PER_DOCUMENT", appliedListMode: "METAL_HECHURA", appliedPriceListId: "pl-d", documentContext: "SHARED_LIST", generatedBy: "buildLineCommercialSummary@v1" },
        },
        composition: { metals: [{ metalName: "Oro Fino", purity: 0.75, appliedGrams: 1.5, appliedMermaPct: 0, lineSale: 574331.25, lineSalePreRounding: 572343.75 }] },
        metalSale: 574331.25,
        metalRoundingMonetaryImpact: prorrateo,   // prorrateo documental (VARÍA) — NO usar
        // SIN lineOwnMetalRoundingMonetaryImpact, SIN metalSaleRoundingDelta
      },
    } as unknown as DocumentLine;
  }

  it("regla #6 — sin autónomo: NO muestra el prorrateo (675/2.650) como redondeo propio; fila oculta + Valor final = PRE estable", () => {
    const renderCard = (p: number) => {
      const { container } = render(<LinesEditorSection {...(baseProps as any)} lines={[item1NoOwn(p)]} />);
      fireEvent.click(container.querySelector("[data-tp-composition-detail-toggle]")!);
      return {
        redondeoRow: document.querySelector("[data-tp-metal-rounding-line]"),
        metalFinal:  document.querySelector("[data-tp-metal-final]")?.textContent ?? "",
        text:        container.textContent ?? "",
      };
    };
    const a = renderCard(675);   // Captura A
    const b = renderCard(2650);  // Captura B
    // La fila "Redondeo comercial metal" se OCULTA (cardMetalImpact = 0).
    expect(a.redondeoRow).toBeNull();
    expect(b.redondeoRow).toBeNull();
    // "Valor final metales" = base PRE (572.343,75), ESTABLE en A y B (no 573.018 ni 574.993).
    expect(a.metalFinal).toMatch(/572[.\s]?343/);
    expect(b.metalFinal).toMatch(/572[.\s]?343/);
    expect(a.metalFinal).toBe(b.metalFinal);
    // El prorrateo (675 / 2.650) NO aparece.
    expect(a.text).not.toMatch(/\b675\b/);
    expect(b.text).not.toMatch(/2[.\s]?650/);
  });

  // Regla #6 (MIXED) — el backend etiqueta las líneas MIXED como strategy
  // "PER_LINE" (sales.service:6712-6713). El card NO debe dejar pasar
  // `metalRoundingMonetaryImpact` por eso: `documentContext === "MIXED_LIST"`
  // lo excluye. Sin campo autónomo dedicado → fila oculta (NO el prorrateo).
  function item1MixedNoOwn(prorrateo: number): DocumentLine {
    return {
      id: "L1", type: "ARTICLE", article: "Anillo", variant: "",
      articleId: "art-1", quantity: 1, unitPrice: 100,
      discountAmount: 0, subtotal: 100, taxAmount: 21,
      lineTotal: 100, lineTotalWithTax: 759831.25,
      pricingMeta: {
        priceSource: "PRICE_LIST", basePrice: 100,
        lineCommercialSummary: {
          mode: "BREAKDOWN",
          metals: { visibleGrams: 1.4, monetaryAmount: 574331.25, roundingImpact: 0,
            byParent: [{ metalParentId: "oro", metalParentName: "Oro Fino", visibleGrams: 1.4, monetaryAmount: 574331.25, roundingImpact: 0 }] },
          monetary: { amount: 185500, roundingImpact: 0 },
          totalLineAmount: 759831.25,
          // MIXED → el backend pone strategy "PER_LINE" + documentContext "MIXED_LIST".
          source: { strategy: "PER_LINE", appliedListMode: "METAL_HECHURA", appliedPriceListId: "pl-x", documentContext: "MIXED_LIST", generatedBy: "buildLineCommercialSummary@v1" },
        },
        composition: { metals: [{ metalName: "Oro Fino", purity: 0.75, appliedGrams: 1.5, appliedMermaPct: 0, lineSale: 574331.25, lineSalePreRounding: 572343.75 }] },
        metalSale: 574331.25,
        metalRoundingMonetaryImpact: prorrateo,   // MIXED etiquetado "PER_LINE" — NO usar
        // SIN lineOwnMetalRoundingMonetaryImpact, SIN metalSaleRoundingDelta
      },
    } as unknown as DocumentLine;
  }

  it("regla #6 (MIXED etiquetado PER_LINE) — documentContext MIXED_LIST excluye el prorrateo; fila oculta + Valor final = Valor comercial", () => {
    const renderCard = (p: number) => {
      const { container } = render(<LinesEditorSection {...(baseProps as any)} lines={[item1MixedNoOwn(p)]} />);
      fireEvent.click(container.querySelector("[data-tp-composition-detail-toggle]")!);
      return {
        redondeoRow: document.querySelector("[data-tp-metal-rounding-line]"),
        metalFinal:  document.querySelector("[data-tp-metal-final]")?.textContent ?? "",
        text:        container.textContent ?? "",
      };
    };
    const a = renderCard(675);   // Captura A (Item 2 lista A)
    const b = renderCard(2650);  // Captura B (Item 2 lista B)
    expect(a.redondeoRow).toBeNull();
    expect(b.redondeoRow).toBeNull();
    // Valor final metales = Valor comercial metal (572.343,75), estable en A y B.
    expect(a.metalFinal).toMatch(/572[.\s]?343/);
    expect(a.metalFinal).toBe(b.metalFinal);
    expect(a.text).not.toMatch(/\b675\b/);
    expect(b.text).not.toMatch(/2[.\s]?650/);
  });

  it("invariante: (metal final) + monetario = total línea (autónomo)", () => {
    expect(574331.25 + 185500).toBe(759831.25);
  });
});
