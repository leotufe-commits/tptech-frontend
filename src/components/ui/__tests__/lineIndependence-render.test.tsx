// src/components/ui/__tests__/lineIndependence-render.test.tsx
// ============================================================================
// INDEPENDENCIA ENTRE LÍNEAS — el "Redondeo comercial metal" del card de una
// línea NO puede cambiar al modificar OTRA línea (lista, cantidad, datos).
//
// Caso real auditado (2026-06-05): dos ítems del MISMO artículo.
//   · Línea 1 qty 1 → lineOwnMetalRoundingMonetaryImpact = 2.650
//   · Línea 2 qty 2 → lineOwnMetalRoundingMonetaryImpact = 5.300
//   · Documento     → metalMonetaryEquivalent = 7.950 (= 2.650 + 5.300)
//
// El backend calcula bien el redondeo metal AUTÓNOMO por línea. El bug vivía
// en el render: el card per-línea caía a valores DOCUMENTALES/prorrateados
// (`metalRoundingMonetaryImpact` y `commercialRoundingContext.breakdown.*`),
// que son Σ de TODAS las líneas replicada por línea → cambiaban con la línea 2.
//
// CONTRATO: el card usa SIEMPRE, cuando existe,
//   1) lineCommercialSummary.metals.roundingImpact, o
//   2) lineOwnMetalRoundingMonetaryImpact
// y NUNCA `metalRoundingMonetaryImpact` ni `commercialRoundingContext.breakdown.*`.
//
// El test simula "la línea 2 cambió" variando los campos DOCUMENTALES que el
// backend replica en CADA línea (incl. la 1): si el card los ignorara mal, el
// render de la línea 1 cambiaría. Debe quedar IDÉNTICO.
// ============================================================================

import React from "react";
import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { LinesEditorSection } from "../../../pages/ventas-facturas/InvoiceEditorModal/LinesEditorSection";
import type { DocumentLine } from "../../../lib/document-types";

const baseProps = {
  totalLinesInDraft: 2, currency: "$", displayRate: 1,
  viewMode: "detailed" as const, headerSubtotals: undefined,
  priceLists: [], channels: [], warehouses: [],
  // Solo la línea 1 expandida → su composición es la única que renderiza card.
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

// ── Línea 1 (DESGLOSADA, qty 1) ──────────────────────────────────────────────
// FIJOS (autónomos): redondeo metal propio = 2.650.
// VARIABLES (documentales replicados por backend en cada línea — el card NO los
// puede usar): `docMetalPostGrams`, `docMetalMonetaryEq`, `prorrateo`.
function line1(docs: {
  docMetalPostGrams: number;
  docMetalMonetaryEq: number;
  prorrateo: number;
}): DocumentLine {
  return {
    id: "L1", type: "ARTICLE", article: "Anillo", variant: "",
    articleId: "art-1", quantity: 1, unitPrice: 100,
    discountAmount: 0, subtotal: 100, taxAmount: 21,
    lineTotal: 100, lineTotalWithTax: 759831.25,
    pricingMeta: {
      priceSource: "PRICE_LIST", basePrice: 100,
      appliedPriceListMode: "METAL_HECHURA",
      lineBalanceMode: "BREAKDOWN",
      // ── Contrato único per-línea (FIJO) — la fuente canónica del card. ──
      lineCommercialSummary: {
        mode: "BREAKDOWN",
        metals: {
          visibleGrams: 1.4, monetaryAmount: 574993.75, roundingImpact: 2650,
          byParent: [{ metalParentId: "oro", metalParentName: "Oro Fino", visibleGrams: 1.4, monetaryAmount: 574993.75, roundingImpact: 2650 }],
        },
        monetary: { amount: 185500, roundingImpact: 24.79 },
        totalLineAmount: 759831.25,
        source: { strategy: "PER_DOCUMENT", appliedListMode: "METAL_HECHURA", appliedPriceListId: "pl-d", documentContext: "SHARED_LIST", generatedBy: "buildLineCommercialSummary@v1" },
      },
      composition: { metals: [{ metalName: "Oro Fino", purity: 0.75, appliedGrams: 1.5, appliedMermaPct: 0, lineSale: 574993.75, lineSalePreRounding: 572343.75 }] },
      metalSale: 574993.75,
      // ── Autónomos de línea (FIJOS) — backend correcto. ──
      lineOwnMetalRoundingMonetaryImpact:         2650,
      lineOwnHechuraRoundingMonetaryImpact:       24.79,
      lineOwnMonetarySaldoPostCommercialRounding: 185500,
      lineOwnTotalWithTaxPostCommercialRounding:  759831.25,
      // ── DOCUMENTALES (VARIABLES — replicados por línea, el card NO los usa). ──
      metalRoundingMonetaryImpact: docs.prorrateo,
      commercialRoundingContext: {
        scope: "BREAKDOWN", appliedAt: "DOCUMENT", appliedToLineCount: 2,
        totalAdjustment: docs.docMetalMonetaryEq,
        breakdown: {
          metalMonetaryEquivalent: docs.docMetalMonetaryEq,
          metals: [{ metalParentId: "oro", metalParentName: "Oro Fino", preGrams: 4.45, postGrams: docs.docMetalPostGrams, deltaGrams: docs.docMetalPostGrams - 4.45, metalPricePerGram: 1, monetaryEquivalent: docs.docMetalMonetaryEq }],
          metalsPostGrams: [{ metalParentId: "oro", metalParentName: "Oro Fino", preGrams: 4.45, postGrams: docs.docMetalPostGrams }],
          hechura: { preRoundingSaldoMonetario: 0, postRoundingSaldoMonetario: 0, deltaSaldoMonetario: 0 },
        },
      },
    },
  } as unknown as DocumentLine;
}

// ── Línea 2 (qty 2) — solo existe en el draft; su lista/datos cambian entre
// escenarios. Está COLAPSADA (no renderiza card), pero su presencia + el cambio
// de los documentales replicados en la línea 1 es lo que dispararía el bug. ──
function line2(priceListId: string): DocumentLine {
  return {
    id: "L2", type: "ARTICLE", article: "Anillo", variant: "",
    articleId: "art-1", quantity: 2, unitPrice: 100,
    discountAmount: 0, subtotal: 200, taxAmount: 42,
    lineTotal: 200, lineTotalWithTax: 1519662.5,
    pricingMeta: {
      priceSource: "PRICE_LIST", basePrice: 100,
      appliedPriceListMode: "METAL_HECHURA", lineBalanceMode: "BREAKDOWN",
      appliedPriceListId: priceListId,
      lineOwnMetalRoundingMonetaryImpact: 5300,
      metalSale: 1149987.5,
      composition: { metals: [{ metalName: "Oro Fino", purity: 0.75, appliedGrams: 1.5, appliedMermaPct: 0, lineSale: 1149987.5, lineSalePreRounding: 1144687.5 }] },
    },
  } as unknown as DocumentLine;
}

/** Abre el detalle de la composición de la línea 1 y devuelve el card + impacto. */
function readLine1Card(container: HTMLElement) {
  fireEvent.click(container.querySelector("[data-tp-composition-detail-toggle]")!);
  return {
    card:   container.querySelector("[data-tp-line-saldo-desglosado]")?.textContent ?? "",
    impact: container.querySelector("[data-tp-metal-rounding-line-impact]")?.textContent ?? "",
    final:  container.querySelector("[data-tp-metal-final]")?.textContent ?? "",
  };
}

describe("Independencia entre líneas — Redondeo comercial metal (card per-línea)", () => {
  // Escenario A: línea 2 lista "pl-A" → documento agrega postGrams 4.2 / eq 7.950 / prorrateo 2.650.
  // Escenario B: línea 2 cambia a lista "pl-B" → documento agrega postGrams 3.0 / eq 3.975 / prorrateo 1.325.
  // Los AUTÓNOMOS de la línea 1 (2.650) NO cambian.
  const scenA = {
    lines: [line1({ docMetalPostGrams: 4.2, docMetalMonetaryEq: 7950, prorrateo: 2650 }), line2("pl-A")],
  };
  const scenB = {
    lines: [line1({ docMetalPostGrams: 3.0, docMetalMonetaryEq: 3975, prorrateo: 1325 }), line2("pl-B")],
  };

  it("el card de la línea 1 es IDÉNTICO aunque cambie la lista/datos de la línea 2", () => {
    const a = render(<LinesEditorSection {...(baseProps as any)} lines={scenA.lines} />);
    const cardA = readLine1Card(a.container);
    const b = render(<LinesEditorSection {...(baseProps as any)} lines={scenB.lines} />);
    const cardB = readLine1Card(b.container);

    expect(cardB.card).toBe(cardA.card);
    expect(cardB.impact).toBe(cardA.impact);
    expect(cardB.final).toBe(cardA.final);
  });

  it("usa el redondeo AUTÓNOMO (2.650), NO el prorrateo documental ni el agregado", () => {
    const { container } = render(<LinesEditorSection {...(baseProps as any)} lines={scenB.lines} />);
    const c = readLine1Card(container);
    // Redondeo comercial metal = 2.650 (autónomo de la línea 1).
    expect(c.impact).toMatch(/2[.\s]?650/);
    // NO el prorrateo documental del escenario B (1.325).
    expect(c.impact).not.toMatch(/1[.\s]?325/);
    // Gramos del metal = los de la línea 1 (1,40), NO el agregado documental (3,00 / 4,20).
    expect(c.card).toMatch(/1[.,]4/);
    expect(c.card).not.toMatch(/[34][.,][02]0(?!\d)/);
  });

  // ── GUARD del FALLBACK (sin contrato único): aun sin `lineCommercialSummary`
  // ni `lineCommercialRoundingMetals`, los gramos del metal del card NO pueden
  // caer al agregado documental (`commercialRoundingContext.breakdown.*`). Antes
  // del fix, `pickLineCommercialRoundingMetals(meta)` devolvía ese Σ → los gramos
  // de la línea 1 cambiaban al variar la línea 2. Ahora pasa
  // `allowDocLevelFallback: false` → cae a los gramos equivalentes per-línea. ──
  function line1NoSummary(docMetalPostGrams: number, prorrateo: number): DocumentLine {
    return {
      id: "L1", type: "ARTICLE", article: "Anillo", variant: "",
      articleId: "art-1", quantity: 1, unitPrice: 100,
      discountAmount: 0, subtotal: 100, taxAmount: 21,
      lineTotal: 100, lineTotalWithTax: 759831.25,
      pricingMeta: {
        priceSource: "PRICE_LIST", basePrice: 100,
        appliedPriceListMode: "METAL_HECHURA", lineBalanceMode: "BREAKDOWN",
        composition: { metals: [{ metalName: "Oro Fino", purity: 0.75, appliedGrams: 1.5, appliedMermaPct: 0, lineSale: 574993.75, lineSalePreRounding: 572343.75 }] },
        metalSale: 574993.75,
        lineOwnMetalRoundingMonetaryImpact: 2650,
        lineOwnMonetarySaldoPostCommercialRounding: 185500,
        lineOwnTotalWithTaxPostCommercialRounding: 759831.25,
        // SIN lineCommercialSummary, SIN lineCommercialRoundingMetals →
        // sin el fix, el card caería al agregado documental de abajo.
        metalRoundingMonetaryImpact: prorrateo,
        commercialRoundingContext: {
          scope: "BREAKDOWN", appliedAt: "DOCUMENT", appliedToLineCount: 2,
          totalAdjustment: 7950,
          breakdown: {
            metalMonetaryEquivalent: 7950,
            metals: [{ metalParentId: "oro", metalParentName: "Oro Fino", preGrams: 4.45, postGrams: docMetalPostGrams, deltaGrams: 0, metalPricePerGram: 1, monetaryEquivalent: 7950 }],
            metalsPostGrams: [{ metalParentId: "oro", metalParentName: "Oro Fino", preGrams: 4.45, postGrams: docMetalPostGrams }],
            hechura: { preRoundingSaldoMonetario: 0, postRoundingSaldoMonetario: 0, deltaSaldoMonetario: 0 },
          },
        },
      },
    } as unknown as DocumentLine;
  }

  it("sin contrato único: el card NO usa el agregado documental para los gramos (estable A/B)", () => {
    const a = render(<LinesEditorSection {...(baseProps as any)} lines={[line1NoSummary(4.2, 2650), line2("pl-A")]} />);
    const ca = readLine1Card(a.container);
    const b = render(<LinesEditorSection {...(baseProps as any)} lines={[line1NoSummary(3.0, 1325), line2("pl-B")]} />);
    const cb = readLine1Card(b.container);
    // Card de la línea 1 idéntico: ni los gramos documentales (4,20 / 3,00) ni el
    // prorrateo (2.650 / 1.325) deben filtrarse a una superficie per-línea.
    expect(cb.card).toBe(ca.card);
    // El agregado documental NO aparece como gramos del metal.
    expect(ca.card).not.toMatch(/4[.,]20/);
    expect(cb.card).not.toMatch(/3[.,]00/);
  });
});
