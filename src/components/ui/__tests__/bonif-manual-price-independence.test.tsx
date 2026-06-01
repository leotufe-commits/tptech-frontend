// src/components/ui/__tests__/bonif-manual-price-independence.test.tsx
// ============================================================================
// REGRESIÓN — Precio manual y bonificación/recargo son DOS overrides
// INDEPENDIENTES (ver CLAUDE.md raíz, sección pricing-engine).
//
// Bug original: cuando el operador ingresaba un precio manual en una línea de
// Factura, el TPNumber de Bonificación/Recargo se llenaba solo con un % igual
// a (basePrice − manualPrice) / basePrice × 100, porque el backend emite
// `qtyDiscountAmount = basePrice − manualPrice` como DELTA INFORMATIVO
// (pricing-engine.sale.ts:1775) y el frontend lo interpretaba como descuento
// efectivo en la rama PROMO/QTY de la cascada.
//
// El motor SALTA qty + promo + customer + manualDiscount cuando hay
// manualPrice (priceSource=MANUAL_OVERRIDE) → el frontend NO debe reconstruir
// una bonificación visual desde el delta. El TPNumber permanece en su valor
// real (0 si no hay override; el manualDiscount si lo hay).
// ============================================================================

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LinesEditorSection } from "../../../pages/ventas-facturas/InvoiceEditorModal/LinesEditorSection";
import type { DocumentLine } from "../../../lib/document-types";

const baseProps = {
  totalLinesInDraft: 1, currency: "$", displayRate: 1,
  viewMode: "detailed" as const, headerSubtotals: undefined,
  priceLists: [], channels: [], warehouses: [],
  expandedLineIds: new Set<string>(), advancedOpenLineIds: new Set<string>(),
  onToggleExpand: () => {}, onToggleAdvancedOpen: () => {},
  patchLine: () => {}, removeLine: () => {}, duplicateLine: () => {},
  reorderLines: () => {}, resetLine: () => {}, isReorderable: () => false,
  onAddLine: () => {}, setLineTaxOverride: () => {}, clearLineOverrides: () => {},
  onChangePriceList: () => {}, onChangeLinePriceList: () => {}, onChangeChannel: () => {},
  handleEditArticle: () => {}, handleLineArticlePick: () => {},
  handleCreateManualLine: () => {}, searchArticles: undefined as any,
  exactLookupArticle: undefined as any, focusedLineId: null, focusSignal: 0,
  editorScopeRef: React.createRef<HTMLDivElement | null>(), previewLoading: false,
};

function getBonifCell(): HTMLElement {
  const trigger = screen.getByRole("button", { name: /tipo de ajuste/i });
  let el: HTMLElement | null = trigger;
  while (el && !el.querySelector("input")) el = el.parentElement;
  if (!el) throw new Error("No se encontró la celda Bonificación");
  return el;
}

function bonifInputValue(): number {
  const input = getBonifCell().querySelector("input") as HTMLInputElement;
  // El input puede formatear (ej. "0,00"); parseamos a número.
  const raw = String(input.value ?? "").replace(",", ".").replace(/[^0-9.\-]/g, "");
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

describe("Bonif/Recargo — independencia con precio manual", () => {
  // ── Caso 2 del user: precio manual + bonif vacía → TPNumber sigue en 0 ──
  it("manualPrice activo + sin manualDiscount → TPNumber Bonif = 0 (NO el delta fantasma)", () => {
    // Reproduce el bug original: el motor emite qtyDiscountAmount como
    // delta informativo (basePrice − manualPrice). Sin la guarda, la
    // rama PROMO/QTY lo interpretaba como bonificación.
    //   basePrice = 100, manualPrice = 50, qty = 1
    //   qtyDiscountAmount = 50 (delta informativo del motor, NO descuento real)
    //   subtotal = 50 (= manualPrice × qty)
    //   bonif fantasma esperada por bug: 50% → debe ser 0
    const line: DocumentLine = {
      id: "line-1", type: "ARTICLE", article: "Anillo oro", variant: "",
      articleId: "art-1", quantity: 1,
      unitPrice: 50,         // = manualPrice aplicado
      discountAmount: 0,
      subtotal: 50, taxAmount: 0,
      lineTotal: 50, lineTotalWithTax: 50,
      manualOverrides: { price: true },
      pricingMeta: {
        priceSource: "MANUAL_OVERRIDE",
        basePrice: 100,             // lista original
        manualPrice: 50,             // override del operador
        quantityDiscountAmount: 50,  // DELTA INFORMATIVO del motor
        promotionDiscountAmount: 0,
        previewQuantity: 1,
        manualDiscount: null,
      } as any,
    } as unknown as DocumentLine;
    render(
      <LinesEditorSection {...(baseProps as any)} lines={[line]}
        applyLineOverrides={vi.fn()} />,
    );
    expect(bonifInputValue()).toBe(0);
  });

  // ── Caso 3 del user: precio manual + manualDiscount existente preservado ──
  it("manualPrice activo + manualDiscount preexistente → TPNumber conserva el value del manualDiscount", () => {
    const line: DocumentLine = {
      id: "line-1", type: "ARTICLE", article: "Anillo oro", variant: "",
      articleId: "art-1", quantity: 1,
      unitPrice: 50, discountAmount: 0,
      subtotal: 50, taxAmount: 0,
      lineTotal: 50, lineTotalWithTax: 50,
      manualOverrides: { price: true, discount: true },
      pricingMeta: {
        priceSource: "MANUAL_OVERRIDE",
        basePrice: 100,
        manualPrice: 50,
        quantityDiscountAmount: 50,  // delta info — debe ignorarse
        promotionDiscountAmount: 0,
        previewQuantity: 1,
        // Bonif manual del operador: 15% — el motor la SALTA porque hay
        // manualPrice, pero el TPNumber conserva el valor (es lo que el
        // operador eligió; cambiarlo requiere edición explícita).
        manualDiscount: { mode: "PERCENT", value: 15, appliesTo: "TOTAL", kind: "BONUS" },
      } as any,
    } as unknown as DocumentLine;
    render(
      <LinesEditorSection {...(baseProps as any)} lines={[line]}
        applyLineOverrides={vi.fn()} />,
    );
    expect(bonifInputValue()).toBe(15);
  });

  // ── Caso 4 del user: precio manual NO se transforma en descuento visual ──
  it("manualPrice + cliente heredado con bonif → TPNumber Bonif = 0 (cliente NO se aplica con manualPrice)", () => {
    // El motor saltea la regla del cliente cuando hay manualPrice.
    // Mostrar el % heredado en el TPNumber sería engañoso → debe quedar 0.
    const line: DocumentLine = {
      id: "line-1", type: "ARTICLE", article: "Anillo oro", variant: "",
      articleId: "art-1", quantity: 1,
      unitPrice: 50, discountAmount: 0,
      subtotal: 50, taxAmount: 0,
      lineTotal: 50, lineTotalWithTax: 50,
      manualOverrides: { price: true },
      pricingMeta: {
        priceSource: "MANUAL_OVERRIDE",
        basePrice: 100,
        manualPrice: 50,
        quantityDiscountAmount: 50,  // delta info
        promotionDiscountAmount: 0,
        previewQuantity: 1,
        manualDiscount: null,
        // Cliente con regla DISCOUNT 10% sobre TOTAL — heredada, NO aplicada
        // por el motor en este preview (manualPrice la saltea).
        inheritedDiscount: {
          ruleType: "DISCOUNT", valueType: "PERCENTAGE",
          applyOn: "TOTAL", value: 10,
        },
      } as any,
    } as unknown as DocumentLine;
    render(
      <LinesEditorSection {...(baseProps as any)} lines={[line]}
        applyLineOverrides={vi.fn()} />,
    );
    expect(bonifInputValue()).toBe(0);
  });

  // ── Caso 5: preview respeta manualPrice — no rehidrata bonif inventada ──
  it("manualPrice + qtyDiscount Y promoDiscount delta-informativos → TPNumber Bonif = 0", () => {
    // Salvaguarda extra: aunque el motor reportara también promotionDiscountAmount > 0
    // (no debería con manualPrice, pero defensivo), el frontend NO debe usarlo
    // como bonif visual.
    const line: DocumentLine = {
      id: "line-1", type: "ARTICLE", article: "Anillo oro", variant: "",
      articleId: "art-1", quantity: 1,
      unitPrice: 50, discountAmount: 0,
      subtotal: 50, taxAmount: 0,
      lineTotal: 50, lineTotalWithTax: 50,
      manualOverrides: { price: true },
      pricingMeta: {
        priceSource: "MANUAL_OVERRIDE",
        basePrice: 100,
        manualPrice: 50,
        quantityDiscountAmount: 30,
        promotionDiscountAmount: 20,
        previewQuantity: 1,
        manualDiscount: null,
      } as any,
    } as unknown as DocumentLine;
    render(
      <LinesEditorSection {...(baseProps as any)} lines={[line]}
        applyLineOverrides={vi.fn()} />,
    );
    expect(bonifInputValue()).toBe(0);
  });

  // ── Caso 7 del user: cambiar cantidad NO pisa la bonif manual existente ──
  it("manualPrice + qty=2 + manualDiscount preexistente → TPNumber conserva manualDiscount", () => {
    // Mismo manualDiscount=15% pero con qty=2. El delta es mayor pero el
    // TPNumber muestra 15 (el value real del override del operador).
    const line: DocumentLine = {
      id: "line-1", type: "ARTICLE", article: "Anillo oro", variant: "",
      articleId: "art-1", quantity: 2,
      unitPrice: 50, discountAmount: 0,
      subtotal: 100, taxAmount: 0,
      lineTotal: 100, lineTotalWithTax: 100,
      manualOverrides: { price: true, discount: true },
      pricingMeta: {
        priceSource: "MANUAL_OVERRIDE",
        basePrice: 100,
        manualPrice: 50,
        quantityDiscountAmount: 50,  // delta info × qty implícito en motor
        promotionDiscountAmount: 0,
        previewQuantity: 2,
        manualDiscount: { mode: "PERCENT", value: 15, appliesTo: "TOTAL", kind: "BONUS" },
      } as any,
    } as unknown as DocumentLine;
    render(
      <LinesEditorSection {...(baseProps as any)} lines={[line]}
        applyLineOverrides={vi.fn()} />,
    );
    expect(bonifInputValue()).toBe(15);
  });
});
