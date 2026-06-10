// src/components/ui/__tests__/lineCommercialSummary-render.test.tsx
// ============================================================================
// FASE 1 (2026-06-03) — El "Resumen Comercial del Artículo" de Factura lee
// EXCLUSIVAMENTE de `pricingMeta.lineCommercialSummary` cuando existe.
//
// Verifica que el MONETARIO, el modo y el total provienen del contrato único
// (no de las fuentes legacy), y que sin el contrato se conserva el fallback.
// ============================================================================

import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LinesEditorSection } from "../../../pages/ventas-facturas/InvoiceEditorModal/LinesEditorSection";
import type { DocumentLine } from "../../../lib/document-types";

function makeLine(pricingMeta: any, over: Partial<DocumentLine> = {}): DocumentLine {
  return {
    id: "L1", type: "ARTICLE", article: "Anillo", variant: "",
    articleId: "art-1", quantity: 1, unitPrice: 100,
    discountAmount: 0, subtotal: 100, taxAmount: 21,
    lineTotal: 100, lineTotalWithTax: 121,
    ...over,
    pricingMeta: { priceSource: "PRICE_LIST", basePrice: 100, ...pricingMeta },
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

const BREAKDOWN_SUMMARY = {
  mode: "BREAKDOWN" as const,
  metals: {
    visibleGrams: 1.4,
    monetaryAmount: 349987.5,
    roundingImpact: 9675,
    byParent: [
      { metalParentId: "oro", metalParentName: "Oro Fino", visibleGrams: 1.4, monetaryAmount: 350000, roundingImpact: 9675 },
    ],
  },
  monetary: { amount: 185500, roundingImpact: 24.79 },
  totalLineAmount: 535487.5,
  source: { strategy: "PER_LINE", appliedListMode: "METAL_HECHURA", appliedPriceListId: "pl-x", documentContext: "MIXED_LIST", generatedBy: "buildLineCommercialSummary@v1" },
};

// Composición mínima para que el bloque METALES tenga un padre.
// Fixture CONSISTENTE con BREAKDOWN_SUMMARY: metal 340.312,50 + redondeo 9.675
// (metals.roundingImpact) + monetario 185.500 = 535.487,50 (totalLineAmount).
// Necesario porque el MONETARIO del card ahora es el RESIDUAL
// `cardTotal − (metal + redondeo)` (METALES + MONETARIO = TOTAL LÍNEA), no el
// passthrough directo de `summary.monetary.amount`.
const COMPOSITION = {
  metals: [{ metalName: "Oro Fino", purity: 0.75, appliedGrams: 1.5, appliedMermaPct: 0, lineSale: 340312.5 }],
};

describe("FASE 1 — Resumen Comercial lee lineCommercialSummary", () => {
  it("BREAKDOWN: MONETARIO = summary.monetary.amount (185.500) visible colapsado (básico)", () => {
    // El resumen BÁSICO (METALES + MONETARIO) se ve sin expandir.
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        lineCommercialSummary: BREAKDOWN_SUMMARY,
        composition: COMPOSITION,
        metalSale: 350000, hechuraSale: 185475.21,
        // valores legacy DISTINTOS — NO deben usarse si el summary existe.
        lineMonetarySaldoPostCommercialRounding: 999999,
      }, { lineTotalWithTax: 535487.5 })]} />);
    const monetario = document.querySelector("[data-tp-hechura-display-total]");
    expect(monetario).toBeTruthy();
    // 185.500 (no 999.999 del legacy).
    expect(monetario!.textContent ?? "").toMatch(/185[.\s]?500/);
    expect(monetario!.textContent ?? "").not.toMatch(/999[.\s]?999/);
  });

  it("UNIFIED: mode unificado → MONETARIO = totalLineAmount, sin metales protagonistas", () => {
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        lineCommercialSummary: {
          mode: "UNIFIED", metals: null,
          monetary: { amount: 200000, roundingImpact: 0 },
          totalLineAmount: 200000,
          source: { strategy: "NONE", appliedListMode: "MARGIN_TOTAL", appliedPriceListId: "pl-u", documentContext: "SHARED_LIST", generatedBy: "buildLineCommercialSummary@v1" },
        },
        composition: COMPOSITION,
      }, { lineTotalWithTax: 200000 })]} />);
    // En UNIFIED el Total grande es protagonista; el bloque no rompe el render.
    expect(screen.getAllByText(/Anillo/).length).toBeGreaterThan(0);
  });

  it("UNIFIED: MONETARIO visible colapsado; 'Valor comercial' del metal solo al expandir", () => {
    // Escenario real del operador: Total 814.700, Metales 572.343,75 →
    // Monetario correcto = 242.356,25 (NO 814.700). BÁSICO colapsado = MONETARIO;
    // el "Valor comercial" del metal (572.343,75) aparece al desplegar.
    const { container } = render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        lineCommercialSummary: {
          mode: "UNIFIED", metals: null,
          monetary: { amount: 814700, roundingImpact: 0 },   // contrato = TOTAL
          totalLineAmount: 814700,
          source: { strategy: "NONE", appliedListMode: "MARGIN_TOTAL", appliedPriceListId: "pl-u", documentContext: "SHARED_LIST", generatedBy: "buildLineCommercialSummary@v1" },
        },
        composition: { metals: [{ metalName: "Oro Fino", purity: 0.75, appliedGrams: 1.5, appliedMermaPct: 0, lineSale: 572343.75 }] },
        metalSale: 572343.75,
        metalRoundingMonetaryImpact: 0,
      }, { lineTotalWithTax: 814700 })]} />);
    // Sin expandir: MONETARIO visible; "Valor comercial" del metal AUSENTE.
    const monetario = document.querySelector("[data-tp-hechura-display-total]");
    expect(monetario).toBeTruthy();
    expect(monetario!.textContent ?? "").toMatch(/242[.\s]?356/);
    expect(monetario!.textContent ?? "").not.toMatch(/814[.\s]?700/);
    expect(container.textContent ?? "").not.toMatch(/572[.\s]?343/);
    // Expandir → "Valor comercial" del metal (572.343,75) visible.
    fireEvent.click(container.querySelector("[data-tp-composition-detail-toggle]")!);
    expect(container.textContent ?? "").toMatch(/572[.\s]?343/);
  });

  it("BREAKDOWN: MONETARIO visible colapsado; 'Redondeo comercial' OCULTO en cerrado, VISIBLE al desplegar", () => {
    // El saldo monetario (185.500) se ve cerrado (básico); el detalle del
    // redondeo comercial (+24,79) SOLO aparece al expandir "Ver detalle".
    const { container } = render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        lineCommercialSummary: BREAKDOWN_SUMMARY,   // monetary.roundingImpact = 24.79
        composition: COMPOSITION,
        metalSale: 350000, hechuraSale: 185475.21,
      }, { lineTotalWithTax: 535487.5 })]} />);
    // CERRADO: MONETARIO visible, fila de redondeo comercial AUSENTE.
    expect(document.querySelector("[data-tp-hechura-display-total]")).toBeTruthy();
    expect(document.querySelector("[data-tp-hechura-rounding-delta]")).toBeNull();
    // DESPLEGADO: aparece "Redondeo comercial + 24,79".
    fireEvent.click(container.querySelector("[data-tp-composition-detail-toggle]")!);
    const rounding = document.querySelector("[data-tp-hechura-rounding-delta]");
    expect(rounding).toBeTruthy();
    expect(rounding!.textContent ?? "").toMatch(/Redondeo comercial/);
    expect(rounding!.textContent ?? "").toMatch(/24[,.]\s?79/);
  });

  it("UNIFICADA: oculta 'Valor final metales' y 'Redondeo comercial metal' (no son del pipeline MARGIN_TOTAL)", () => {
    // En MARGIN_TOTAL el metal NO tiene redondeo propio: su valor es una
    // distribución visual del precio único, y el redondeo del precio final se
    // ve en MONETARIO. Aunque el campo `metalRoundingMonetaryImpact` venga ≠ 0,
    // en UNIFICADA NO se muestran las filas metal-final / metal-rounding-line.
    const { container } = render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        lineCommercialSummary: {
          mode: "UNIFIED", metals: null,
          monetary: { amount: 814700, roundingImpact: 0 }, totalLineAmount: 814700,
          source: { strategy: "NONE", appliedListMode: "MARGIN_TOTAL", appliedPriceListId: "pl-u", documentContext: "SHARED_LIST", generatedBy: "buildLineCommercialSummary@v1" },
        },
        composition: { metals: [{ metalName: "Oro Fino", purity: 0.75, appliedGrams: 1.5, appliedMermaPct: 0, lineSale: 572343.75 }] },
        metalSale: 572343.75,
        metalRoundingMonetaryImpact: 1212.5,
      }, { lineTotalWithTax: 814700 })]} />);
    // OCULTOS en Unificada (aunque el campo venga ≠ 0), aun expandiendo:
    fireEvent.click(container.querySelector("[data-tp-composition-detail-toggle]")!);
    expect(document.querySelector("[data-tp-metal-final]")).toBeNull();
    expect(document.querySelector("[data-tp-metal-rounding-line]")).toBeNull();
    // VISIBLE: "Valor comercial" del metal (per padre) + MONETARIO.
    expect(container.textContent ?? "").toMatch(/572[.\s]?343/);
    // REGLA LISTA UNIFICADA: el único redondeo es el del TOTAL; el MONETARIO es
    // `totalWithTaxPost − Σ metalSale = 814.700 − 572.343,75 = 242.356,25`. NO se
    // resta `metalRoundingMonetaryImpact` (1.212,50) → NO debe dar 241.143,75
    // (ese era el valor contaminado del bug que este fix corrige).
    expect((document.querySelector("[data-tp-hechura-display-total]")?.textContent ?? "")).toMatch(/242[.\s]?356/);
  });

  it("CANÓNICO Desglosada: 3 líneas OCULTAS colapsado, VISIBLES al expandir; cierran contra el total", () => {
    // saleAmountLine 340.312,50 + redondeo 9.675 = 349.987,50 (final)
    // Monetario (contrato) = 185.500 → 349.987,50 + 185.500 = 535.487,50  ✓
    const FINAL = 349987.5, MONET = 185500, TOTAL = 535487.5;
    expect(FINAL + MONET).toBe(TOTAL);
    const { container } = render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        lineCommercialSummary: {
          mode: "BREAKDOWN",
          metals: { visibleGrams: 1.4, monetaryAmount: 349987.5, roundingImpact: 9675,
            byParent: [{ metalParentId: "oro", metalParentName: "Oro Fino", visibleGrams: 1.4, monetaryAmount: 350000, roundingImpact: 9675 }] },
          monetary: { amount: 185500, roundingImpact: 0 }, totalLineAmount: 535487.5,
          source: { strategy: "PER_LINE", appliedListMode: "METAL_HECHURA", appliedPriceListId: "pl-x", documentContext: "MIXED_LIST", generatedBy: "buildLineCommercialSummary@v1" },
        },
        composition: { metals: [{ metalName: "Oro Fino", purity: 0.75, appliedGrams: 1.5, appliedMermaPct: 0, lineSale: 340312.5 }] },
        metalSale: 340312.5,
        // MIXED autónomo: el backend puebla el campo DEDICADO (sales.service:6651+6691).
        // El card lo lee por ahí (fuente #1), NO por `metalRoundingMonetaryImpact`
        // (que en MIXED puede ser el prorrateo documental).
        lineOwnMetalRoundingMonetaryImpact: 9675,
        metalRoundingMonetaryImpact: 9675,
      }, { lineTotalWithTax: 535487.5 })]} />);
    // COLAPSADO — básico visible: METALES (gramos) + MONETARIO (185.500). El
    // "Valor comercial" del metal (340.312,50) y los redondeos NO se ven.
    expect(document.querySelector("[data-tp-metal-final]")).toBeNull();
    expect(document.querySelector("[data-tp-metal-rounding-line]")).toBeNull();
    expect((document.querySelector("[data-tp-hechura-display-total]")?.textContent ?? "")).toMatch(/185[.\s]?500/);
    expect(container.textContent ?? "").not.toMatch(/340[.\s]?312/);
    // EXPANDIR "Ver detalle" → Valor comercial del metal + las 3 líneas de detalle.
    fireEvent.click(container.querySelector("[data-tp-composition-detail-toggle]")!);
    expect(container.textContent ?? "").toMatch(/340[.\s]?312/);
    expect((document.querySelector("[data-tp-metal-rounding-line-impact]")?.textContent ?? "")).toMatch(/9[.\s]?675/);
    // Valor final metales = sumMetalSale (340.312,50) + redondeo (9.675) = 349.987,50
    expect((document.querySelector("[data-tp-metal-final]")?.textContent ?? "")).toMatch(/349[.\s]?987/);
    expect((document.querySelector("[data-tp-hechura-display-total]")?.textContent ?? "")).toMatch(/185[.\s]?500/);
  });

  it("MONETARIO pipeline Desglosada: Valor comercial 185.475,21 + Redondeo +24,79 (al expandir)", () => {
    // monetaryBase = monetary.amount (185.500) − roundingImpact (24,79) = 185.475,21
    const { container } = render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        lineCommercialSummary: BREAKDOWN_SUMMARY,   // monetary { amount: 185500, roundingImpact: 24.79 }
        composition: COMPOSITION,
        metalSale: 350000, hechuraSale: 185475.21,
      }, { lineTotalWithTax: 535487.5 })]} />);
    // Colapsado: "Valor comercial" monetario AUSENTE (solo el principal 185.500).
    expect(document.querySelector("[data-tp-hechura-base]")).toBeNull();
    // Expandir → pipeline visible.
    fireEvent.click(container.querySelector("[data-tp-composition-detail-toggle]")!);
    expect((document.querySelector("[data-tp-hechura-base]")?.textContent ?? "")).toMatch(/185[.\s]?475/);
    expect((document.querySelector("[data-tp-hechura-rounding-delta]")?.textContent ?? "")).toMatch(/24[,.]\s?79/);
    // Principal (final) intacto.
    expect((document.querySelector("[data-tp-hechura-display-total]")?.textContent ?? "")).toMatch(/185[.\s]?500/);
    // DESGLOSADA conserva su render: la fila "Valor redondeado" es SOLO de Unificada.
    expect(document.querySelector("[data-tp-hechura-rounded]")).toBeNull();
  });

  it("MONETARIO Unificada: redondeo = appliedRounding.unitAdjustment (19,86), NO metal/hechura", () => {
    // REGLA Lista Unificada (MARGIN_TOTAL, applyOn=TOTAL): "Redondeo comercial"
    // monetario = appliedRounding.unitAdjustment × qty (qty=1 acá). Datos REALES
    // del payload capturado: preRounding 814.680,1377 → postRounding 814.700 →
    // unitAdjustment 19,8623.
    //   metal = 572.343,75 ; totalPost = 814.700 → X (monetario) = 242.356,25
    //   Z = 19,86 → Y = 242.356,25 − 19,86 = 242.336,39
    // metal/hechura vienen con valores ENGAÑOSOS para probar que NO se usan.
    const { container } = render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        lineCommercialSummary: {
          mode: "UNIFIED", metals: null,
          monetary: { amount: 814700, roundingImpact: 0 }, totalLineAmount: 814700,
          source: { strategy: "NONE", appliedListMode: "MARGIN_TOTAL", appliedPriceListId: "pl-u", documentContext: "SHARED_LIST", generatedBy: "buildLineCommercialSummary@v1" },
        },
        composition: { metals: [{ metalName: "Oro Fino", purity: 0.75, appliedGrams: 1.5, appliedMermaPct: 0, lineSale: 572343.75 }] },
        metalSale: 572343.75,
        appliedRounding: { applyOn: "TOTAL", mode: "HUNDRED", direction: "NEAREST", preRounding: 814680.1377, postRounding: 814700, unitAdjustment: 19.8623 },
        metalRoundingMonetaryImpact: 1212.5,   // METAL — NO debe usarse
        hechuraRoundingMonetaryImpact: 999,     // SALDO — NO debe usarse
      }, { lineTotalWithTax: 814680.1377 })]} />);
    fireEvent.click(container.querySelector("[data-tp-composition-detail-toggle]")!);
    // Redondeo (Z) = +19,86 — NO 1.212,50 (metal) ni 999 (hechura)
    const delta = document.querySelector("[data-tp-hechura-rounding-delta]")?.textContent ?? "";
    expect(delta).toMatch(/19[,.]\s?86/);
    expect(delta).not.toMatch(/1[.\s]?212/);
    expect(delta).not.toMatch(/999/);
    // Valor comercial (Y) = 242.336,39
    expect((document.querySelector("[data-tp-hechura-base]")?.textContent ?? "")).toMatch(/242[.\s]?336[,.]39/);
    // Valor redondeado (X) = 242.356,25
    expect((document.querySelector("[data-tp-hechura-rounded]")?.textContent ?? "")).toMatch(/242[.\s]?356/);
    // Monetario final (principal) = 242.356,25
    expect((document.querySelector("[data-tp-hechura-display-total]")?.textContent ?? "")).toMatch(/242[.\s]?356/);
  });

  it("MONETARIO Unificada qty=2: redondeo = unitAdjustment × qty (delta de LÍNEA, no per-unit)", () => {
    // unitAdjustment = 7 (por unidad) · qty = 2 → redondeo de LÍNEA = 14 (NO 7).
    //   metal = 50 × 2 = 100 ; totalPost = 200 → X = 100 ; Z = 14 ; Y = 86.
    const { container } = render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        lineCommercialSummary: {
          mode: "UNIFIED", metals: null,
          monetary: { amount: 200, roundingImpact: 0 }, totalLineAmount: 200,
          source: { strategy: "NONE", appliedListMode: "MARGIN_TOTAL", appliedPriceListId: "pl-u", documentContext: "SHARED_LIST", generatedBy: "buildLineCommercialSummary@v1" },
        },
        composition: { metals: [{ metalName: "Oro Fino", purity: 0.75, appliedGrams: 1, appliedMermaPct: 0, lineSale: 50 }] },
        metalSale: 50,
        appliedRounding: { applyOn: "TOTAL", mode: "HUNDRED", direction: "NEAREST", preRounding: 93, postRounding: 100, unitAdjustment: 7 },
      }, { quantity: 2, lineTotalWithTax: 200 })]} />);
    fireEvent.click(container.querySelector("[data-tp-composition-detail-toggle]")!);
    // Redondeo de LÍNEA = 7 × 2 = 14 (NO 7 per-unit)
    const delta = document.querySelector("[data-tp-hechura-rounding-delta]")?.textContent ?? "";
    expect(delta).toMatch(/14/);
    expect(delta).not.toMatch(/\b7[,.]00\b/);
    // Valor comercial (Y) = 86 ; Valor redondeado (X) = 100
    expect((document.querySelector("[data-tp-hechura-base]")?.textContent ?? "")).toMatch(/86/);
    expect((document.querySelector("[data-tp-hechura-rounded]")?.textContent ?? "")).toMatch(/100/);
  });

  // ── Ver detalle / Ver menos — básico SIEMPRE visible; solo el detalle togglea ──
  it("Ver detalle / Ver menos: METALES+MONETARIO (básico) SIEMPRE visible; el detalle se oculta colapsado y aparece al expandir", () => {
    const { container } = render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        lineCommercialSummary: BREAKDOWN_SUMMARY,   // monetary.roundingImpact = 24.79
        composition: COMPOSITION,
        metalSale: 350000, hechuraSale: 185475.21,
      }, { lineTotalWithTax: 535487.5 })]} />);
    const toggle = () => container.querySelector("[data-tp-composition-detail-toggle]")!;
    const basicoVisible  = () =>
      /METALES/.test(container.textContent ?? "")
      && document.querySelector("[data-tp-hechura-display-total]") != null;
    // El detalle = redondeo comercial monetario (data-tp-hechura-rounding-delta).
    const detalleVisible = () => document.querySelector("[data-tp-hechura-rounding-delta]") != null;

    // 1) Colapsado (default): básico VISIBLE, detalle OCULTO.
    expect(basicoVisible()).toBe(true);
    expect(detalleVisible()).toBe(false);

    // 2) Expandido: básico sigue visible + detalle aparece.
    fireEvent.click(toggle());
    expect(basicoVisible()).toBe(true);
    expect(detalleVisible()).toBe(true);

    // 3) Re-colapsar: básico sigue, el detalle se oculta de nuevo.
    fireEvent.click(toggle());
    expect(basicoVisible()).toBe(true);
    expect(detalleVisible()).toBe(false);
  });

  it("FALLBACK: sin lineCommercialSummary → render legacy no rompe", () => {
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        composition: COMPOSITION,
        metalSale: 350000, hechuraSale: 185475.21,
        lineMonetarySaldoPostCommercialRounding: 185500,
      }, { lineTotalWithTax: 535487.5 })]} />);
    // Sin summary, sigue mostrando el artículo (camino legacy intacto).
    expect(screen.getAllByText(/Anillo/).length).toBeGreaterThan(0);
  });
});

// ============================================================================
// FIX UI (2026-06) — el LAYOUT del Resumen Comercial depende del TIPO DE LISTA
// (`appliedPriceListMode`/`lineBalanceMode`), NO de si la lista tuvo redondeo.
// `data-tp-line-total-collapsed` se renderiza SOLO en layout DESGLOSADO.
// ============================================================================
describe("FIX UI — layout depende del TIPO DE LISTA, no del redondeo", () => {
  it("DESGLOSADA sin redondeo (lineSummary.mode UNIFIED pero lista METAL_HECHURA) → UI desglosada", () => {
    // Caso del bug: el backend emite lineCommercialSummary.mode = UNIFIED para una
    // lista desglosada SIN redondeo. Antes el card caía en UI unificada. Con el
    // fix, el tipo de lista (appliedPriceListMode METAL_HECHURA → BREAKDOWN) gana.
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        appliedPriceListMode: "METAL_HECHURA",   // ← tipo de lista DESGLOSADA (line-local)
        lineBalanceMode: "BREAKDOWN",
        lineCommercialSummary: {
          mode: "UNIFIED", metals: null,          // summary dice UNIFIED (sin redondeo)
          monetary: { amount: 185500, roundingImpact: 0 }, totalLineAmount: 535487.5,
          source: { strategy: "NONE", appliedListMode: "METAL_HECHURA", appliedPriceListId: "pl-x", documentContext: "SHARED_LIST", generatedBy: "buildLineCommercialSummary@v1" },
        },
        composition: COMPOSITION,
        metalSale: 350000, hechuraSale: 185500,
      }, { lineTotalWithTax: 535487.5 })]} />);
    // Layout DESGLOSADO presente (marcador exclusivo de desglosado).
    expect(document.querySelector("[data-tp-line-total-collapsed]")).toBeTruthy();
    // METALES protagonista.
    expect(screen.getAllByText(/METALES/).length).toBeGreaterThan(0);
  });

  it("DESGLOSADA sin summary (solo appliedPriceListMode METAL_HECHURA) → UI desglosada", () => {
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        appliedPriceListMode: "METAL_HECHURA",
        lineBalanceMode: "BREAKDOWN",
        composition: COMPOSITION,
        metalSale: 350000, hechuraSale: 185500,
        lineMonetarySaldoPostCommercialRounding: 185500,
      }, { lineTotalWithTax: 535487.5 })]} />);
    expect(document.querySelector("[data-tp-line-total-collapsed]")).toBeTruthy();
  });

  it("UNIFICADA (appliedPriceListMode MARGIN_TOTAL) → UI unificada (sin marcador desglosado)", () => {
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        appliedPriceListMode: "MARGIN_TOTAL",
        lineBalanceMode: "UNIFIED",
        lineCommercialSummary: {
          mode: "UNIFIED", metals: null,
          monetary: { amount: 200000, roundingImpact: 0 }, totalLineAmount: 200000,
          source: { strategy: "NONE", appliedListMode: "MARGIN_TOTAL", appliedPriceListId: "pl-u", documentContext: "SHARED_LIST", generatedBy: "buildLineCommercialSummary@v1" },
        },
        composition: COMPOSITION,
      }, { lineTotalWithTax: 200000 })]} />);
    // UNIFICADA NO muestra el marcador de desglosado.
    expect(document.querySelector("[data-tp-line-total-collapsed]")).toBeNull();
  });

  it("DESGLOSADA con redondeo (lineSummary.mode BREAKDOWN) → UI desglosada (sin regresión)", () => {
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        appliedPriceListMode: "METAL_HECHURA",
        lineBalanceMode: "BREAKDOWN",
        lineCommercialSummary: BREAKDOWN_SUMMARY,
        composition: COMPOSITION,
        metalSale: 350000, hechuraSale: 185475.21,
      }, { lineTotalWithTax: 535487.5 })]} />);
    expect(document.querySelector("[data-tp-line-total-collapsed]")).toBeTruthy();
  });
});

// ============================================================================
// S4.2 (Hito S4) — FIX MIXED RETIRADO. Tras S4.1a+b el backend entrega el
// target α limpio TAMBIÉN en MIXED (`Sale.total` ya consolida el limpio;
// preview===confirm validado), así que el Card usa el contrato normal C-FASE1
// (`ownTotal` clean) POR IGUAL en MIXED y homogéneo — sin parche:
//   cardTotal     = ownTotal (clean, consistente con el Sale.total corregido)
//   cardMonetario = cardTotal − metalFinalCard
// ============================================================================
describe("Card usa ownTotal clean (FIX MIXED retirado — S4.2)", () => {
  it("MIXED: MONETARIO = ownTotal clean − metalFinal (240.325), NO el contaminado (242.300)", () => {
    const { container } = render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        appliedPriceListMode: "METAL_HECHURA",
        lineBalanceMode: "BREAKDOWN",
        priceListMixed: true,                                  // ← documento MIXED
        // ownTotal CLEAN (display-only, 1.975 menos) — NO debe usarse en MIXED.
        lineOwnTotalWithTaxPostCommercialRounding: 812668.75,
        lineOwnHechuraRoundingMonetaryImpact: -36.39,          // redondeo monetario
        composition: { metals: [{ metalName: "Oro Fino", purity: 0.75, appliedGrams: 1.5, appliedMermaPct: 0, lineSale: 572343.75 }] },
        metalSale: 572343.75,
      }, { lineTotalWithTax: 814643.75 })]} />);   // ← total REAL de la línea
    const monet = document.querySelector("[data-tp-hechura-display-total]");
    // cardMonetario = ownTotal 812.668,75 − 572.343,75 = 240.325 (clean), NO el contaminado 242.300.
    expect(monet?.textContent ?? "").toMatch(/240[.\s]?325/);
    expect(monet?.textContent ?? "").not.toMatch(/242[.\s]?300/);
    // Expandir → valor comercial + redondeo cierran: 240.361,39 + (−36,39) = 240.325.
    fireEvent.click(container.querySelector("[data-tp-composition-detail-toggle]")!);
    expect((document.querySelector("[data-tp-hechura-base]")?.textContent ?? "")).toMatch(/240[.\s]?361[,.]39/);
    expect((document.querySelector("[data-tp-hechura-rounding-delta]")?.textContent ?? "")).toMatch(/36[,.]39/);
  });

  it("NO-MIXED: conserva ownTotal (real-based) — sin regresión", () => {
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        appliedPriceListMode: "METAL_HECHURA",
        lineBalanceMode: "BREAKDOWN",
        // priceListMixed ausente → NO-MIXED: usa ownTotal, NO l.lineTotalWithTax.
        lineOwnTotalWithTaxPostCommercialRounding: 814643.75,
        lineOwnHechuraRoundingMonetaryImpact: -36.39,
        composition: { metals: [{ metalName: "Oro Fino", purity: 0.75, appliedGrams: 1.5, appliedMermaPct: 0, lineSale: 572343.75 }] },
        metalSale: 572343.75,
      }, { lineTotalWithTax: 999999 })]} />);   // distinto → prueba que NO-MIXED usa ownTotal
    const monet = document.querySelector("[data-tp-hechura-display-total]");
    // cardMonetario = ownTotal (814.643,75) − 572.343,75 = 242.300; ignora lineTotalWithTax 999.999.
    expect(monet?.textContent ?? "").toMatch(/242[.\s]?300/);
    expect(monet?.textContent ?? "").not.toMatch(/427[.\s]?655/);  // 999999 − 572343.75
  });
});
