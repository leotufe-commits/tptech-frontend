// ============================================================================
// El MODO DEL DOCUMENTO manda en la VISTA de cada línea (solo Factura).
//
// `documentBalanceMode` (= `balanceMode` resuelto por el backend desde
// footer/cliente/lista) hace que cada card de artículo siga el modo del
// documento, con dos salvaguardas:
//   (1) una línea con LISTA PROPIA por línea conserva su modo;
//   (2) una línea SIN datos de metal nunca se fuerza a desglosada.
// SOLO presentación — los datos/cálculos no se tocan.
//
// Señales testeables del layout (TPDocumentLineAdvancedEditor):
//   · `[data-tp-commercial-total]`     → presente SOLO en vista UNIFICADA (`!isLineDesglosada`).
//   · `[data-tp-line-total-collapsed]` → presente SOLO en vista DESGLOSADA (`isLineDesglosada`).
// ============================================================================
import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { LinesEditorSection } from "../../../pages/ventas-facturas/InvoiceEditorModal/LinesEditorSection";

/** Línea CON datos de metal (desglosable). `ownMode` = modo de su propia lista. */
function makeMetalLine(opts: { ownMode?: "METAL_HECHURA" | "MARGIN_TOTAL"; override?: boolean } = {}): any {
  const ownMode = opts.ownMode ?? "METAL_HECHURA";
  const isBreak = ownMode === "METAL_HECHURA";
  return {
    id: "L1", type: "ARTICLE", articleId: "art-1", article: "Anillo", variant: "",
    quantity: 1, unitPrice: 500, lineTotal: 500, lineTotalWithTax: 500,
    discountAmount: 0, subtotal: 500, taxAmount: 0,
    priceListOverride: opts.override ?? false,
    priceListIdOverride: opts.override ? "pl-own" : null,
    pricingMeta: {
      priceSource: "PRICE_LIST", basePrice: 500,
      appliedPriceListMode: ownMode,
      lineCommercialSummary: {
        mode: isBreak ? "BREAKDOWN" : "UNIFIED",
        metals: {
          visibleGrams: 2.3, monetaryAmount: 350, roundingImpact: 0,
          byParent: [{ metalParentId: "oro", metalParentName: "Oro", visibleGrams: 2.3, monetaryAmount: 350, roundingImpact: 0 }],
        },
        monetary: { amount: 150, roundingImpact: 0 },
        totalLineAmount: 500,
        source: { strategy: "PER_LINE", generatedBy: "buildLineCommercialSummary@v1" },
      },
      composition: { metals: [{ metalName: "Oro", purity: 0.75, appliedGrams: 2.3, appliedMermaPct: 0, lineSale: 350, lineSalePreRounding: 350 }] },
      metalSale: 350,
      lineTotalWithTaxPostCommercialRounding: 500,
    },
  };
}

/** Línea SIN datos de metal (servicio / saldo monetario puro), lista unificada. */
function makeServiceLine(): any {
  return {
    id: "L1", type: "ARTICLE", articleId: "svc-1", article: "Servicio", variant: "",
    quantity: 1, unitPrice: 500, lineTotal: 500, lineTotalWithTax: 500,
    discountAmount: 0, subtotal: 500, taxAmount: 0,
    priceListOverride: false, priceListIdOverride: null,
    pricingMeta: {
      priceSource: "PRICE_LIST", basePrice: 500,
      appliedPriceListMode: "MARGIN_TOTAL",
      lineCommercialSummary: {
        mode: "UNIFIED", metals: null,
        monetary: { amount: 500, roundingImpact: 0 },
        totalLineAmount: 500,
        source: { strategy: "NONE", generatedBy: "buildLineCommercialSummary@v1" },
      },
      composition: { metals: [] },
      lineTotalWithTaxPostCommercialRounding: 500,
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

function renderLine(line: any, documentBalanceMode: "UNIFIED" | "BREAKDOWN" | null) {
  const { container } = render(
    <LinesEditorSection {...baseProps} lines={[line]} documentBalanceMode={documentBalanceMode} />,
  );
  return container;
}
// `data-tp-line-total-collapsed` aparece SOLO en vista DESGLOSADA. El card del
// Resumen (`data-tp-line-saldo-desglosado`) se renderiza en ambos modos cuando
// hay metal/hechura — sirve para confirmar que la línea sí renderizó.
const cardRendered     = (c: HTMLElement) => c.querySelector("[data-tp-line-saldo-desglosado]") != null;
const isDesglosadaView = (c: HTMLElement) => c.querySelector("[data-tp-line-total-collapsed]") != null;

describe("El modo del documento manda en la vista de la línea", () => {
  it("doc=UNIFICADO + línea con metal → COLAPSA a vista unificada", () => {
    const c = renderLine(makeMetalLine({ ownMode: "METAL_HECHURA" }), "UNIFIED");
    expect(cardRendered(c)).toBe(true);
    expect(isDesglosadaView(c)).toBe(false);
  });

  it("doc=DESGLOSADO + línea con metal → vista desglosada", () => {
    const c = renderLine(makeMetalLine({ ownMode: "METAL_HECHURA" }), "BREAKDOWN");
    expect(isDesglosadaView(c)).toBe(true);
  });

  it("doc=DESGLOSADO + línea SIN metal → NO inventa metal (queda unificada)", () => {
    const c = renderLine(makeServiceLine(), "BREAKDOWN");
    expect(cardRendered(c)).toBe(true);
    expect(isDesglosadaView(c)).toBe(false);
  });

  it("doc=DESGLOSADO + línea con LISTA PROPIA → IGUAL sigue al documento (override es de precio, no de vista)", () => {
    // El override de lista por línea NO conserva la vista: la vista de toda
    // línea sigue el modo del documento (así re-sincroniza al cambiar global/
    // cliente/footer). Con metal y doc desglosado → desglosada.
    const c = renderLine(makeMetalLine({ ownMode: "MARGIN_TOTAL", override: true }), "BREAKDOWN");
    expect(isDesglosadaView(c)).toBe(true);
  });

  it("doc=UNIFICADO + línea con LISTA PROPIA desglosada → IGUAL colapsa (sigue al documento)", () => {
    const c = renderLine(makeMetalLine({ ownMode: "METAL_HECHURA", override: true }), "UNIFIED");
    expect(cardRendered(c)).toBe(true);
    expect(isDesglosadaView(c)).toBe(false);
  });

  it("back-compat: SIN documentBalanceMode, la línea con metal sigue su propia lista (desglosada)", () => {
    const c = renderLine(makeMetalLine({ ownMode: "METAL_HECHURA" }), null);
    expect(isDesglosadaView(c)).toBe(true);
  });
});
