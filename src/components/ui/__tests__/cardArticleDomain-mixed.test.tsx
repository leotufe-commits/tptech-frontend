// ============================================================================
// DOMINIO ARTÍCULO — el card "Resumen comercial del artículo" NUNCA muestra
// valores del dominio DOCUMENTO/prorrateo.
//
// Regla funcional (CLAUDE.md + POLICY §R-Rounding-14/15): el card pertenece al
// dominio ARTÍCULO y debe usar SIEMPRE el redondeo AUTÓNOMO por línea, igual en
// documento con misma lista que en MIXED. PROHIBIDO leer
// `metalRoundingMonetaryImpact` (prorrateo PER_DOCUMENT, depende de Σ gramos del
// comprobante) para el card del artículo.
//
// Caso auditado (MIXED, línea Desglosada):
//   · metalRoundingMonetaryImpact (prorrateo documental) = 675
//   · lineCommercialSummary.metals.roundingImpact (autónomo) = 2650
//   · lineOwnMetalRoundingMonetaryImpact (autónomo) = 2650
// El card DEBE renderizar 2650 y NUNCA 675.
// ============================================================================
import React from "react";
import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { LinesEditorSection } from "../../../pages/ventas-facturas/InvoiceEditorModal/LinesEditorSection";

const PRORRATEO_DOC = 675;   // metalRoundingMonetaryImpact (dominio DOCUMENTO) — PROHIBIDO en el card
const AUTONOMO_LINE = 2650;  // lineCommercialSummary.metals.roundingImpact / lineOwn — el correcto

function makeMixedDesglosadaLine(): any {
  return {
    id: "L1", type: "ARTICLE", articleId: "art-1", article: "Anillo", variant: "",
    quantity: 1, unitPrice: 100, lineTotal: 100, lineTotalWithTax: 759831.25,
    discountAmount: 0, subtotal: 100, taxAmount: 21,
    pricingMeta: {
      priceSource: "PRICE_LIST", basePrice: 100,
      lineCommercialSummary: {
        mode: "BREAKDOWN",
        metals: {
          visibleGrams: 2.3, monetaryAmount: 574331.25, roundingImpact: AUTONOMO_LINE,
          byParent: [{
            metalParentId: "oro", metalParentName: "Oro Fino",
            visibleGrams: 2.3, monetaryAmount: 574331.25, roundingImpact: AUTONOMO_LINE,
          }],
        },
        monetary: { amount: 185500, roundingImpact: 0 },
        totalLineAmount: 759831.25,
        source: {
          strategy: "PER_LINE", appliedListMode: "METAL_HECHURA",
          appliedPriceListId: "pl-desglosada", documentContext: "MIXED_LIST",
          generatedBy: "buildLineCommercialSummary@v1",
        },
      },
      composition: { metals: [{
        metalName: "Oro Fino", purity: 0.75, appliedGrams: 2.3, appliedMermaPct: 0,
        lineSale: 574331.25, lineSalePreRounding: 572343.75,
      }] },
      metalSale: 574331.25,
      // Documento con listas mixtas (dispara el aviso de origen en el card).
      priceListMixed: true,
      // Campo del dominio DOCUMENTO — presente en el payload, pero el card NO debe leerlo.
      metalRoundingMonetaryImpact: PRORRATEO_DOC,
      // Campos del dominio ARTÍCULO (autónomos) — los que el card SÍ usa.
      lineOwnMetalRoundingMonetaryImpact: AUTONOMO_LINE,
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

function renderCard(line: any) {
  const { container } = render(<LinesEditorSection {...baseProps} lines={[line]} />);
  // Expandir el detalle de composición para revelar la fila de redondeo.
  fireEvent.click(container.querySelector("[data-tp-composition-detail-toggle]")!);
  return container;
}

describe("Card Resumen comercial del artículo — dominio ARTÍCULO en MIXED", () => {
  it("la fila 'Redondeo comercial metal' muestra el AUTÓNOMO (2.650), nunca el prorrateo (675)", () => {
    const container = renderCard(makeMixedDesglosadaLine());
    const impact = container.querySelector("[data-tp-metal-rounding-line-impact]");
    expect(impact).not.toBeNull();
    const txt = impact!.textContent ?? "";
    expect(txt).toMatch(/2[.\s]?650/);
    expect(txt).not.toMatch(/675/);
  });

  it("el prorrateo documental (675) NO aparece en NINGUNA parte del card del artículo", () => {
    const container = renderCard(makeMixedDesglosadaLine());
    // Card completo del artículo (METAL + MONETARIO + redondeos + Valor final).
    const card = container.querySelector("[data-tp-line-saldo-desglosado]");
    expect(card).not.toBeNull();
    // El número del dominio DOCUMENTO (675) está prohibido en todo el card.
    expect(card!.textContent ?? "").not.toMatch(/675/);
  });

  it("INDEPENDENCIA: variar metalRoundingMonetaryImpact (prorrateo) NO cambia el card", () => {
    // Mismo artículo, mismo autónomo (2.650). Solo cambia el PRORRATEO documental
    // (campo dominio DOCUMENTO). El card NO debe inmutarse: sigue mostrando 2.650.
    const a = makeMixedDesglosadaLine();
    a.pricingMeta.metalRoundingMonetaryImpact = 675;
    const b = makeMixedDesglosadaLine();
    b.pricingMeta.metalRoundingMonetaryImpact = 1234; // otro prorrateo arbitrario

    const txtA = renderCard(a).querySelector("[data-tp-metal-rounding-line-impact]")!.textContent ?? "";
    const txtB = renderCard(b).querySelector("[data-tp-metal-rounding-line-impact]")!.textContent ?? "";

    expect(txtA).toMatch(/2[.\s]?650/);
    expect(txtB).toMatch(/2[.\s]?650/);
    expect(txtA).not.toMatch(/675/);
    expect(txtB).not.toMatch(/1[.\s]?234/);
  });
});

describe("Card — trazabilidad visual del origen del redondeo (UI)", () => {
  it("muestra el chip de ORIGEN 'línea' junto al redondeo comercial metal", () => {
    const container = renderCard(makeMixedDesglosadaLine());
    const chip = container.querySelector("[data-tp-metal-rounding-origin]");
    expect(chip).not.toBeNull();
    expect((chip!.textContent ?? "").toLowerCase()).toContain("línea");
  });

  it("en MIXED muestra el aviso 'no documental'", () => {
    const container = renderCard(makeMixedDesglosadaLine());
    const note = container.querySelector("[data-tp-metal-rounding-mixed-note]");
    expect(note).not.toBeNull();
    expect((note!.textContent ?? "").toLowerCase()).toContain("no documental");
  });
});
