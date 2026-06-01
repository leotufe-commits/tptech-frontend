// src/components/ui/__tests__/tax-label-info.test.tsx
// ============================================================================
// Label informativo de la celda IMPUESTOS en Factura de ventas.
//
// Cubre los cuatro escenarios del passthrough del motor (cero recálculo):
//   1) Impuesto heredado: "IVA 21%" (o "IVA 10.5%", etc.) leído de
//      `pricingMeta.composition.taxes` o `pricingMeta.taxBreakdown`.
//   2) Cliente exento: badge "Exento cliente".
//   3) Sin impuesto (override manual borrado / value 0): "Sin impuesto".
//   4) Impuesto manual: badge "Impuesto manual" + sub-label con la tasa
//      aplicada (IVA 21% o 21% según fallback).
// ============================================================================

import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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

// ─────────────────────────────────────────────────────────────────────────────
// 1. Heredado: "IVA 21%" / "IVA 10.5%" del motor.
// ─────────────────────────────────────────────────────────────────────────────
describe("Label de Impuestos — heredado del backend", () => {
  it("composition.taxes con name=IVA + rate=21 → badge contiene IVA y 21", () => {
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          composition: { taxes: [{ name: "IVA", rate: 21, taxAmount: 21, appliesTo: "TOTAL" }] },
        })]} />,
    );
    // Buscamos el badge que contiene AMBOS "IVA" y "21" en su texto.
    // El span del badge es único en el DOM para este escenario.
    const ivaBadge = screen.getAllByText(/IVA/).find((el) => /21/.test(el.textContent ?? ""));
    expect(ivaBadge).toBeTruthy();
  });

  it("rate=10.5 → badge contiene IVA y 10.5 (formateo según preset)", () => {
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          composition: { taxes: [{ name: "IVA", rate: 10.5, taxAmount: 10.5, appliesTo: "TOTAL" }] },
        })]} />,
    );
    const ivaBadge = screen.getAllByText(/IVA/).find((el) => /10[,.]5/.test(el.textContent ?? ""));
    expect(ivaBadge).toBeTruthy();
  });

  it("taxBreakdown sin composition: badge con name", () => {
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          taxBreakdown: [{ name: "IVA", rate: 21, taxAmount: 21, applyOn: null }],
        })]} />,
    );
    expect(screen.getByText(/IVA/)).toBeInTheDocument();
  });

  it("applyOn=METAL → badge agrega '(sobre metal)'", () => {
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          composition: { taxes: [{ name: "IVA", rate: 21, taxAmount: 21, appliesTo: "METAL" }] },
        })]} />,
    );
    expect(screen.getByText(/sobre metal/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Cliente exento.
// ─────────────────────────────────────────────────────────────────────────────
describe("Label de Impuestos — cliente exento", () => {
  it("taxExemptByEntity=true → badge 'Exento cliente'", () => {
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          taxExemptByEntity: true,
          composition: { taxes: [] },
        })]} />,
    );
    expect(screen.getByText("Exento cliente")).toBeInTheDocument();
    // No debe colar el badge de IVA cuando está exento.
    expect(screen.queryByText(/IVA \d/)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Sin impuesto (override manual borrado / value 0).
// ─────────────────────────────────────────────────────────────────────────────
describe("Label de Impuestos — sin impuesto (taxZeroed)", () => {
  it("override manual con value=0 → label 'Sin impuesto'", () => {
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          taxOverride: { mode: "PERCENT", value: 0, appliesTo: "TOTAL" },
          composition: { taxes: [] },
        }, { tax: true })]} />,
    );
    expect(screen.getByText("Sin impuesto")).toBeInTheDocument();
    // No debe mostrar "Impuesto manual" ni el IVA heredado anterior.
    expect(screen.queryByText("Impuesto manual")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Impuesto manual: badge + sub-label con tasa.
// ─────────────────────────────────────────────────────────────────────────────
describe("Label de Impuestos — manual con tasa visible", () => {
  it("T9/T11 — override manual PERCENT 21 → pill 'Manual' + tasa visible (badge 'Impuesto manual' preservado)", () => {
    const { container } = render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          taxOverride: { mode: "PERCENT", value: 21, appliesTo: "TOTAL" },
          composition: { taxes: [{ name: "Impuesto manual", rate: 21, taxAmount: 21, appliesTo: "TOTAL" }] },
          taxBreakdown: [{ name: "Impuesto manual", rate: 21, taxAmount: 21, applyOn: "TOTAL" }],
        }, { tax: true })]} />,
    );
    // El chip resumen "Impuesto manual" (top) sigue visible siempre.
    expect(screen.getByText("Impuesto manual")).toBeInTheDocument();
    // T9 — además aparece un pill "Manual" pequeño al lado del label de tasa.
    // (Texto literal "Manual" — el TPBadge renderiza el children).
    expect((container.textContent ?? "")).toMatch(/Manual/);
    // T11 — la tasa configurada sigue visible inline al lado del pill.
    expect((container.textContent ?? "")).toMatch(/21/);
    // Sin texto técnico residual.
    expect((container.textContent ?? "")).not.toMatch(/reemplaza/i);
  });

  it("T9 — override manual sin name en breakdown → pill 'Manual' + override.value visible", () => {
    const { container } = render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          taxOverride: { mode: "PERCENT", value: 27, appliesTo: "TOTAL" },
          composition: { taxes: [] },
          taxBreakdown: [],
        }, { tax: true })]} />,
    );
    expect(screen.getByText("Impuesto manual")).toBeInTheDocument();
    expect((container.textContent ?? "")).toMatch(/Manual/);
    // Cae al fallback override.value cuando el breakdown viene vacío.
    expect((container.textContent ?? "")).toMatch(/27/);
  });

  it("T9 — override manual AMOUNT → pill 'Manual' + monto del override visible", () => {
    const { container } = render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          taxOverride: { mode: "AMOUNT", value: 500, appliesTo: "TOTAL" },
          composition: { taxes: [] },
          taxBreakdown: [],
        }, { tax: true })]} />,
    );
    expect(screen.getByText("Impuesto manual")).toBeInTheDocument();
    expect((container.textContent ?? "")).toMatch(/Manual/);
    expect((container.textContent ?? "")).toMatch(/500/);
  });

  it("no rompe input ni botón %/$ — siguen renderizándose", () => {
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          taxOverride: { mode: "PERCENT", value: 21, appliesTo: "TOTAL" },
          composition: { taxes: [{ name: "Impuesto manual", rate: 21, taxAmount: 21, appliesTo: "TOTAL" }] },
        }, { tax: true })]} />,
    );
    // Input de impuestos sigue presente.
    expect(screen.getByRole("button", { name: /cambiar tipo de impuesto/i })).toBeInTheDocument();
  });
});
