// src/components/ui/__tests__/bonif-input-connected.test.tsx
// ============================================================================
// Auditoría: el TPNumber de BONIFICACIÓN por línea (Factura) DEBE invocar
// `onApplyLineOverrides` con `{ manualDiscount }` (no quedar en estado
// visual). La X manda override explícito de bonificación 0 (no undefined).
// Análogo al test de Impuestos ya corregido.
// ============================================================================

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LinesEditorSection } from "../../../pages/ventas-facturas/InvoiceEditorModal/LinesEditorSection";
import type { DocumentLine } from "../../../lib/document-types";

function makeArticleLine(): DocumentLine {
  return {
    id: "line-1", type: "ARTICLE", article: "Anillo oro", variant: "",
    articleId: "art-1", quantity: 2, unitPrice: 100, discountAmount: 0,
    subtotal: 200, taxAmount: 0, lineTotal: 200, lineTotalWithTax: 200,
    pricingMeta: {
      priceSource: "PRICE_LIST", basePrice: 100,
      // sin promo / qty discount → input de Bonificación editable
      quantityDiscountAmount: 0, promotionDiscountAmount: 0,
    },
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
  onAddLine: () => {}, setLineTaxOverride: () => {}, clearLineOverrides: () => {},
  onChangePriceList: () => {}, onChangeLinePriceList: () => {}, onChangeChannel: () => {},
  handleEditArticle: () => {}, handleLineArticlePick: () => {},
  handleCreateManualLine: () => {}, searchArticles: undefined as any,
  exactLookupArticle: undefined as any, focusedLineId: null, focusSignal: 0,
  editorScopeRef: React.createRef<HTMLDivElement | null>(), previewLoading: false,
};

function getBonifCell(): HTMLElement {
  // El header de la celda es un <button> con aria-label "Tipo de ajuste:…".
  // Subimos al primer ancestro que contenga el <input> de la celda.
  const trigger = screen.getByRole("button", { name: /tipo de ajuste/i });
  let el: HTMLElement | null = trigger;
  while (el && !el.querySelector("input")) el = el.parentElement;
  if (!el) throw new Error("No se encontró la celda Bonificación");
  return el;
}

describe("TPNumber de Bonificación — conexión al flujo de override", () => {
  it("editar el valor invoca onApplyLineOverrides con { manualDiscount } (incluye kind=BONUS por default)", () => {
    const spy = vi.fn();
    render(
      <LinesEditorSection {...(baseProps as any)} lines={[makeArticleLine()]}
        applyLineOverrides={spy} />,
    );
    const input = getBonifCell().querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "15" } });

    expect(spy).toHaveBeenCalled();
    const [lineId, patch] = spy.mock.calls[spy.mock.calls.length - 1];
    expect(lineId).toBe("line-1");
    // El override siempre lleva `kind` (BONUS por default — recargo es opt-in
    // vía el toggle Bonificación↔Recargo). El backend lo usa para decidir si
    // resta o suma; ausente lo trata como BONUS (back-compat).
    expect(patch).toEqual({
      manualDiscount: { mode: "PERCENT", value: 15, appliesTo: "TOTAL", kind: "BONUS" },
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // CASO REAL del usuario — regresión del 29,80% vs 38,80%.
  //
  //   Precio unitario base:   ARS 400.062,50
  //   Cantidad:               6
  //   Base inicial bruta:     ARS 2.400.375,00
  //
  //   Pipeline del motor (en cascada, no suma de %):
  //     1. Desc. cantidad 20%  →  −ARS 480.075,00
  //     2. Promo 10%           →  −ARS 192.030,00
  //     3. Cliente 15%         →  −ARS 259.240,50
  //     ─────────────────────────────────────────
  //     Total descuento real:    ARS 931.345,50
  //     Subtotal neto final:     ARS 1.469.029,50
  //     % efectivo comercial:    38,80% (no es 10 + 20 + 15)
  //
  // El TPNumber del input representa el descuento EFECTIVO COMERCIAL TOTAL,
  // no la reconstrucción suma-de-pasos del pipeline (que puede subcontar el
  // cliente cuando el motor emite `ENTITY_COMMERCIAL_RULE` con shape
  // inconsistente — ver causa raíz en la auditoría).
  //
  // Para reproducir el bug original: poblamos `pricingSteps` con el cliente
  // que el motor emite mal (discountAmount unitario sub-dividido por qty).
  // Si el editor sumara steps `× qty`, el resultado sería 29,80%. La fórmula
  // robusta (passthrough: baseInitial − l.subtotal) da 38,80%.
  // ──────────────────────────────────────────────────────────────────────────
  it("CASO REAL: qty 20% + promo 10% + cliente 15% (qty=6) → 38,80% efectivo, NO 29,80%", () => {
    const realCaseLine: DocumentLine = {
      id: "line-1", type: "ARTICLE", article: "Anillo oro", variant: "",
      articleId: "art-1",
      quantity:        6,
      // unitPrice final = (basePrice × (1 - 20%) × (1 - 10%) × (1 - 15%))
      //                 = 400062.50 × 0.80 × 0.90 × 0.85 = 244838.25
      unitPrice:       244838.25,
      // Total descuento efectivo de la línea (pasa-thru del motor).
      discountAmount:  931345.50,
      // Subtotal neto = baseInitial − total descuento = 1.469.029,50.
      // Es el `pl.lineTotal` que `applySalePreviewToDraft` hidrata a
      // `l.subtotal` — la fórmula nueva lo usa como fuente de verdad
      // del efectivo total.
      subtotal:        1469029.50,
      taxAmount:       0,
      lineTotal:       1469029.50,
      lineTotalWithTax: 1469029.50,
      pricingMeta: {
        priceSource: "PRICE_LIST",
        basePrice:                400062.50,
        // Auto qty + promo presentes — entra a la rama `hasQty || hasPromo`,
        // que es donde aplica la fórmula nueva.
        quantityDiscountAmount:   80012.50,   // per-unit
        promotionDiscountAmount:  32005,      // per-unit
        // Cliente total por línea (passthrough del motor — `applyOn=TOTAL`
        // absorbido en unitPrice).
        customerDiscountAmount:   259240.50,
        // Reproducción del shape que motiva el bug: ENTITY_COMMERCIAL_RULE
        // con `discountAmount` sub-dividido por qty. Si el TPNumber usara
        // suma de pasos (`automaticTotal × qty`), daría 29,80%. La fórmula
        // robusta no depende de esto.
        pricingSteps: [
          { key: "PRICE_LIST", label: "Lista", status: "ok", value: 400062.50 },
          {
            key: "QUANTITY_DISCOUNT", label: "QD", status: "ok",
            value: 320050,
            meta: { discountBase: 400062.50, discountAmount: 80012.50, value: 20, type: "PERCENTAGE", applyOn: "TOTAL" },
          },
          {
            key: "PROMOTION", label: "Promo", status: "ok",
            value: 288045,
            meta: { discountBase: 320050, discountAmount: 32005, value: 10, type: "PERCENTAGE", applyOn: "TOTAL" },
          },
          {
            // Bug del motor reproducido: discountAmount = customerLineAmount / qty²
            // en lugar de / qty. El pipeline frontend al hacer `× qty` recupera
            // 43.206,75 en lugar de 259.240,50 → 29,80% en lugar de 38,80%.
            key: "ENTITY_COMMERCIAL_RULE", label: "Cliente", status: "ok",
            value: 244838.25,
            meta: {
              ruleType: "DISCOUNT", valueType: "PERCENTAGE",
              value: 15, applyOn: "TOTAL",
              discountBase: 288045,
              discountAmount: 7201.125, // ← per-unit MAL (real per-unit = 43206.75)
            },
          },
        ],
      },
    } as unknown as DocumentLine;

    render(
      <LinesEditorSection {...(baseProps as any)} lines={[realCaseLine]}
        applyLineOverrides={() => {}} />,
    );
    const input = getBonifCell().querySelector("input") as HTMLInputElement;

    // Extraer el número del input tolerando preset es-AR (coma) o en-US (punto).
    const raw = input.value.replace(/\./g, "").replace(",", ".");
    const num = Number(raw);

    expect(num).toBeCloseTo(38.80, 2);
    // Anti-regresión explícita del bug original.
    expect(num).not.toBeCloseTo(29.80, 1);
  });

  it("la X (clear) limpia el override completo (manualDiscount: null) — vuelve al valor heredado/automático", () => {
    const spy = vi.fn();
    // La X solo aparece si hay un valor visible > 0 → sembramos un override
    // manual 10% existente (lo que vería el operador antes de limpiar).
    const seeded = {
      ...makeArticleLine(),
      manualOverrides: { discount: true },
      pricingMeta: {
        priceSource: "PRICE_LIST", basePrice: 100,
        quantityDiscountAmount: 0, promotionDiscountAmount: 0,
        manualDiscount: { mode: "PERCENT", value: 10, appliesTo: "TOTAL", kind: "BONUS" },
      },
    } as unknown as DocumentLine;
    render(
      <LinesEditorSection {...(baseProps as any)} lines={[seeded]}
        applyLineOverrides={spy} />,
    );
    // La X de la celda Bonificación lleva aria-label semántico "Poner
    // bonificación en 0" — comunica QUÉ hace al tocar (setea override
    // manual con value=0; no restaura el automático). Otros usos del
    // TPNumberInput conservan "Limpiar valor" como default; la X de
    // Cantidad tiene semántica distinta (mín de venta).
    const clearBtn = getBonifCell().querySelector(
      'button[aria-label="Poner bonificación en 0"]',
    ) as HTMLButtonElement;
    expect(clearBtn).toBeTruthy();
    fireEvent.click(clearBtn);

    expect(spy).toHaveBeenCalled();
    const [lineId, patch] = spy.mock.calls[spy.mock.calls.length - 1];
    expect(lineId).toBe("line-1");
    // X = override manual { value: 0, ... } preservando mode/appliesTo/kind.
    // Mantiene hasManual=true → pills/card automáticos NO vuelven.
    expect(patch.manualDiscount).toEqual({
      mode: "PERCENT", value: 0, appliesTo: "TOTAL", kind: "BONUS",
    });
  });
});
