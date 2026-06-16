// src/components/ui/__tests__/combo-detail-control.test.tsx
// ============================================================================
// COMBO — "Ver detalle" comercial consistente en saldo DESGLOSADO y UNIFICADO.
//
// El combo comercial es saldo monetario puro (sin metal a nivel de línea). El
// control "Ver detalle comercial" del Resumen Comercial del Artículo debe
// aparecer IGUAL en ambos modos de saldo, identificando al combo por su
// identidad CANÓNICA (`costMode === "COMBO" || priceSource === "COMBO_COMPONENTS"`).
// El banner extra "Composición del combo" fue ELIMINADO (unificación visual): el
// combo usa el mismo patrón de grupo que producto/servicio.
//
// Display-only: cero matemática, cero cambio en artículos tradicionales.
// ============================================================================

import React from "react";
import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { LinesEditorSection } from "../../../pages/ventas-facturas/InvoiceEditorModal/LinesEditorSection";
import type { DocumentLine } from "../../../lib/document-types";

function makeLine(pricingMeta: any, over: Partial<DocumentLine> = {}): DocumentLine {
  return {
    id: "L1", type: "ARTICLE", article: "Combo X", variant: "",
    articleId: "art-1", quantity: 1, unitPrice: 100,
    discountAmount: 0, subtotal: 100, taxAmount: 21,
    lineTotal: 100, lineTotalWithTax: 121,
    ...over,
    pricingMeta: { basePrice: 100, ...pricingMeta },
  } as unknown as DocumentLine;
}

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

const COMBO_COMPOSITION = {
  metals: [],
  hechuras: [],
  products: [{ name: "Comp A", lineCost: 100 }, { name: "Comp B", lineCost: 200 }],
  services: [],
};

function renderLine(extraMeta: any, advancedOpen = false) {
  return render(<LinesEditorSection {...(baseProps as any)}
    advancedOpenLineIds={advancedOpen ? new Set<string>(["L1"]) : new Set<string>()}
    lines={[makeLine({
      priceSource: "COMBO_COMPONENTS",
      composition: COMBO_COMPOSITION, metalSale: 333281.25,
      ...extraMeta,
    }, { lineTotalWithTax: 518800 })]} />);
}

const COMBO_UNIFICADO = {
  costMode: "COMBO", priceSource: "COMBO_COMPONENTS",
  appliedPriceListMode: "MARGIN_TOTAL", lineBalanceMode: "UNIFIED",
};
const COMBO_DESGLOSADO = {
  costMode: "COMBO", priceSource: "COMBO_COMPONENTS",
  appliedPriceListMode: "METAL_HECHURA", lineBalanceMode: "BREAKDOWN",
};

describe("COMBO — 'Ver detalle comercial' en ambos modos de saldo", () => {
  it("UNIFICADO: muestra el toggle 'Ver detalle comercial'", () => {
    const { container } = renderLine(COMBO_UNIFICADO);
    const toggle = container.querySelector("[data-tp-composition-detail-toggle]");
    expect(toggle).toBeTruthy();
    expect(toggle!.textContent ?? "").toMatch(/Ver detalle comercial/);
  });

  it("DESGLOSADO: muestra el MISMO toggle 'Ver detalle comercial'", () => {
    const { container } = renderLine(COMBO_DESGLOSADO);
    const toggle = container.querySelector("[data-tp-composition-detail-toggle]");
    expect(toggle).toBeTruthy();
    expect(toggle!.textContent ?? "").toMatch(/Ver detalle comercial/);
  });

  it("DESGLOSADO: el empty-state del combo (sin metal de línea) es visible — antes era código muerto", () => {
    const { container } = renderLine(COMBO_DESGLOSADO);
    expect(container.textContent ?? "").toMatch(/Este combo no posee metales a nivel de línea/);
  });

  it("UNIFICADO: el empty-state del combo también es visible (mismo comportamiento)", () => {
    const { container } = renderLine(COMBO_UNIFICADO);
    expect(container.textContent ?? "").toMatch(/Este combo no posee metales a nivel de línea/);
  });

  it("combo identificado SOLO por priceSource (sin costMode) también muestra el toggle", () => {
    const { container } = renderLine({
      priceSource: "COMBO_COMPONENTS",
      appliedPriceListMode: "METAL_HECHURA", lineBalanceMode: "BREAKDOWN",
    });
    const toggle = container.querySelector("[data-tp-composition-detail-toggle]");
    expect(toggle).toBeTruthy();
    expect(toggle!.textContent ?? "").toMatch(/Ver detalle comercial/);
  });
});

describe("COMBO — banner 'Composición del combo' ELIMINADO (unificación visual)", () => {
  // El banner exclusivo del combo se removió: rompía el patrón visual (en
  // producto/servicio no hay caja previa equivalente). El combo ahora usa el
  // mismo patrón de grupo. La detección de combo sigue cubierta por los tests
  // del toggle 'Ver detalle comercial' (arriba) y por los de Venta total /
  // AJUSTE GLOBAL. Estos tests blindan que el banner NO reaparezca.
  it("DESGLOSADO con costMode COMBO: NO renderea el banner extra", () => {
    const { container } = renderLine(COMBO_DESGLOSADO, true);
    expect(container.querySelector("[data-testid='combo-composition-header']")).toBeNull();
  });

  it("DESGLOSADO identificado SOLO por priceSource (sin costMode): tampoco renderea el banner", () => {
    const { container } = renderLine({
      priceSource: "COMBO_COMPONENTS",
      appliedPriceListMode: "METAL_HECHURA", lineBalanceMode: "BREAKDOWN",
    }, true);
    expect(container.querySelector("[data-testid='combo-composition-header']")).toBeNull();
  });

  it("UNIFICADO: tampoco renderea el banner", () => {
    const { container } = renderLine(COMBO_UNIFICADO, true);
    expect(container.querySelector("[data-testid='combo-composition-header']")).toBeNull();
  });
});

describe("Artículo tradicional — sin cambios (no es combo)", () => {
  it("artículo normal NO muestra empty-state de combo ni encabezado de combo", () => {
    const { container } = render(<LinesEditorSection {...(baseProps as any)}
      advancedOpenLineIds={new Set<string>(["L1"])}
      lines={[makeLine({
        priceSource: "PRICE_LIST",
        appliedPriceListMode: "METAL_HECHURA", lineBalanceMode: "BREAKDOWN",
        composition: { metals: [{ metalName: "Oro Fino", purity: 0.75, appliedGrams: 1.5, appliedMermaPct: 0, lineSale: 340312.5 }], hechuras: [], products: [], services: [] },
        metalSale: 340312.5, hechuraSale: 185500,
        lineMonetarySaldoPostCommercialRounding: 185500,
      }, { lineTotalWithTax: 535487.5 })]} />);
    expect(container.textContent ?? "").not.toMatch(/Este combo no posee metales/);
    expect(container.querySelector("[data-testid='combo-composition-header']")).toBeNull();
  });
});

// ============================================================================
// COMBO con REDONDEO COMERCIAL — "Ver detalle" despliega el detalle comercial
// MONETARIO completo (Valor comercial → Redondeo comercial → Valor redondeado),
// SIN filas de metal en $0 (el combo es saldo monetario puro). Igual en
// DESGLOSADO y UNIFICADO. El artículo tradicional conserva su detalle de metal.
// ============================================================================
const COMBO_ROUNDED_DESG = {
  costMode: "COMBO", priceSource: "COMBO_COMPONENTS",
  appliedPriceListMode: "METAL_HECHURA", lineBalanceMode: "BREAKDOWN",
  lineCommercialSummary: { mode: "BREAKDOWN", metals: null, monetary: { amount: 518800, roundingImpact: 18.75 }, totalLineAmount: 518800, source: {} },
  composition: { metals: [], products: [{ name: "A" }], services: [] },
  lineMonetarySaldoPostCommercialRounding: 518800,
  lineOwnTotalWithTaxPostCommercialRounding: 518800,
  lineOwnHechuraRoundingMonetaryImpact: 18.75,
};
const COMBO_ROUNDED_UNIF = {
  costMode: "COMBO", priceSource: "COMBO_COMPONENTS",
  appliedPriceListMode: "MARGIN_TOTAL", lineBalanceMode: "UNIFIED",
  lineCommercialSummary: { mode: "UNIFIED", metals: null, monetary: { amount: 518800, roundingImpact: 0 }, totalLineAmount: 518800, source: {} },
  composition: { metals: [], products: [{ name: "A" }], services: [] },
  appliedRounding: { applyOn: "TOTAL", mode: "HUNDRED", direction: "NEAREST", preRounding: 518781.25, postRounding: 518800, unitAdjustment: 18.75 },
};

describe("COMBO con redondeo comercial — detalle comercial monetario al desplegar", () => {
  function expandFirst(container: HTMLElement) {
    fireEvent.click(container.querySelector("[data-tp-composition-detail-toggle]")!);
  }

  it("DESGLOSADO: 'Ver detalle' despliega Valor comercial + Redondeo comercial + Valor redondeado", () => {
    const { container } = render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine(COMBO_ROUNDED_DESG, { lineTotalWithTax: 518800 })]} />);
    // Colapsado: las sub-filas del detalle aún no aparecen.
    expect(container.querySelector("[data-tp-hechura-base]")).toBeNull();
    expandFirst(container);
    // Detalle comercial monetario COMPLETO.
    expect(container.querySelector("[data-tp-hechura-base]")).toBeTruthy();          // Valor comercial (Y)
    expect(container.querySelector("[data-tp-hechura-rounding-delta]")).toBeTruthy(); // Redondeo comercial (Z)
    expect(container.querySelector("[data-tp-hechura-rounded]")).toBeTruthy();        // Valor redondeado (X)
    expect((container.querySelector("[data-tp-hechura-rounding-delta]")?.textContent ?? "")).toMatch(/18[,.]\s?75/);
  });

  it("DESGLOSADO: NO muestra filas de metal en $0 (combo = saldo monetario puro)", () => {
    const { container } = render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine(COMBO_ROUNDED_DESG, { lineTotalWithTax: 518800 })]} />);
    expandFirst(container);
    expect(container.querySelector("[data-tp-metal-final]")).toBeNull();
    expect(container.querySelector("[data-tp-metal-rounding-line]")).toBeNull();
  });

  it("UNIFICADO: mismo detalle comercial monetario completo (consistencia)", () => {
    const { container } = render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine(COMBO_ROUNDED_UNIF, { lineTotalWithTax: 518781.25 })]} />);
    expandFirst(container);
    expect(container.querySelector("[data-tp-hechura-base]")).toBeTruthy();
    expect(container.querySelector("[data-tp-hechura-rounding-delta]")).toBeTruthy();
    expect(container.querySelector("[data-tp-hechura-rounded]")).toBeTruthy();
  });

  it("TRADICIONAL DESGLOSADO con redondeo: conserva su detalle de metal (sin regresión)", () => {
    const { container } = render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        priceSource: "PRICE_LIST",
        appliedPriceListMode: "METAL_HECHURA", lineBalanceMode: "BREAKDOWN",
        lineCommercialSummary: { mode: "BREAKDOWN", metals: { visibleGrams: 1.4, monetaryAmount: 349987.5, roundingImpact: 9675, byParent: [{ metalParentId: "oro", metalParentName: "Oro Fino", visibleGrams: 1.4, monetaryAmount: 350000, roundingImpact: 9675 }] }, monetary: { amount: 185500, roundingImpact: 24.79 }, totalLineAmount: 535487.5, source: {} },
        composition: { metals: [{ metalName: "Oro Fino", purity: 0.75, appliedGrams: 1.5, appliedMermaPct: 0, lineSale: 340312.5 }], products: [], services: [] },
        metalSale: 350000, hechuraSale: 185475.21,
        lineOwnMetalRoundingMonetaryImpact: 9675,
      }, { lineTotalWithTax: 535487.5 })]} />);
    fireEvent.click(container.querySelector("[data-tp-composition-detail-toggle]")!);
    // El tradicional desglosado SIGUE mostrando el detalle de metal.
    expect(container.querySelector("[data-tp-metal-final]")).toBeTruthy();
    expect(container.querySelector("[data-tp-metal-rounding-line]")).toBeTruthy();
    // Y NO incorpora la fila "Valor redondeado" (sigue siendo exclusiva de UNIFICADA/combo).
    expect(container.querySelector("[data-tp-hechura-rounded]")).toBeNull();
  });
});

// ============================================================================
// BUG REAL — combo comercial con lista DESGLOSADA no mostraba el detalle del
// redondeo. El redondeo del combo (saldo monetario puro) llega en campos
// distintos según la lista; en DESGLOSADA el camino `desglosadoImpact` quedaba
// en 0 (lo sombreaba `summary.monetary.roundingImpact = 0` y no leía
// `appliedRounding`). El combo se trata como pieza monetaria unificada → muestra
// el detalle IGUAL que en lista UNIFICADA, sea cual sea la fuente del redondeo.
// ============================================================================
describe("COMBO DESGLOSADO — detalle del redondeo visible cualquiera sea la fuente", () => {
  function comboDesg(extraMeta: any) {
    return render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        costMode: "COMBO", priceSource: "COMBO_COMPONENTS",
        appliedPriceListMode: "METAL_HECHURA", lineBalanceMode: "BREAKDOWN",
        composition: { metals: [], products: [{ name: "A" }], services: [] },
        ...extraMeta,
      }, { lineTotalWithTax: 518800 })]} />);
  }
  function assertDetalle(container: HTMLElement) {
    fireEvent.click(container.querySelector("[data-tp-composition-detail-toggle]")!);
    expect(container.querySelector("[data-tp-hechura-base]")).toBeTruthy();           // Valor comercial
    expect(container.querySelector("[data-tp-hechura-rounding-delta]")).toBeTruthy();  // Redondeo comercial
    expect(container.querySelector("[data-tp-hechura-rounded]")).toBeTruthy();         // Valor redondeado
    expect((container.querySelector("[data-tp-hechura-rounding-delta]")?.textContent ?? "")).toMatch(/18[,.]\s?75/);
    // NO filas de metal en $0.
    expect(container.querySelector("[data-tp-metal-final]")).toBeNull();
  }

  it("redondeo en appliedRounding (FINAL_PRICE) + summary.roundingImpact=0", () => {
    assertDetalle(comboDesg({
      lineCommercialSummary: { mode: "BREAKDOWN", metals: null, monetary: { amount: 518800, roundingImpact: 0 }, totalLineAmount: 518800, source: {} },
      appliedRounding: { applyOn: "TOTAL", mode: "HUNDRED", direction: "NEAREST", preRounding: 518781.25, postRounding: 518800, unitAdjustment: 18.75 },
    }).container);
  });

  it("redondeo en lineOwnHechuraRoundingMonetaryImpact + summary.roundingImpact=0", () => {
    assertDetalle(comboDesg({
      lineCommercialSummary: { mode: "BREAKDOWN", metals: null, monetary: { amount: 518800, roundingImpact: 0 }, totalLineAmount: 518800, source: {} },
      lineOwnHechuraRoundingMonetaryImpact: 18.75,
    }).container);
  });

  it("redondeo solo en hechuraRoundingMonetaryImpact (doc), sin summary", () => {
    assertDetalle(comboDesg({
      hechuraRoundingMonetaryImpact: 18.75,
      lineMonetarySaldoPostCommercialRounding: 518800,
    }).container);
  });
});
