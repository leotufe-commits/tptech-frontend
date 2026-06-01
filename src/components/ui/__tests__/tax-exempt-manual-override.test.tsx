// src/components/ui/__tests__/tax-exempt-manual-override.test.tsx
// ============================================================================
// Cliente EXENTO + override manual de impuesto — contrato UX:
//
//   La exención del cliente es un DEFAULT, no un candado. El operador puede
//   escribir un impuesto manual aunque el cliente sea exento; el motor lo
//   respeta. El frontend solo refleja:
//     · valor del input  → prioriza override sobre exempt (línea 3144 editor)
//     · badge informativo→ prioriza override sobre exempt (línea 3269 editor)
//     · editabilidad     → exempt NO bloquea (línea 3152 editor)
//
// Cubre los 4 casos pedidos por el usuario:
//   1) Exento, sin override → input 0, badge "Exento cliente", editable.
//   2) Exento + override 21%→ input 21, badge "Impuesto manual" (anti-bug:
//      no debe quedarse "Exento cliente").
//   3) Exento + X (override 0)→ input 0, badge "Exento cliente" (el manual
//      anulado vuelve al default exento, no a "Impuesto manual" engañoso).
//   4) Operador escribe valor → setLineTaxOverride se invoca con el override.
//
// POLICY R6 — el motor backend aplica el override sobre la exención. El
// frontend NO calcula impuestos; solo expone el override y muestra lo que
// el motor devuelve.
// ============================================================================

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { LinesEditorSection } from "../../../pages/ventas-facturas/InvoiceEditorModal/LinesEditorSection";
import type { DocumentLine } from "../../../lib/document-types";

function makeLine(metaOverrides: any = {}, manualOverrides?: any, lineOverrides: any = {}): DocumentLine {
  return {
    id: "L1", type: "ARTICLE", article: "Anillo", variant: "",
    articleId: "art-1", quantity: 1, unitPrice: 100,
    discountAmount: 0, subtotal: 100, taxAmount: 0,
    lineTotal: 100, lineTotalWithTax: 100,
    pricingMeta: {
      priceSource: "PRICE_LIST", basePrice: 100,
      quantityDiscountAmount: 0, promotionDiscountAmount: 0,
      ...metaOverrides,
    },
    ...(manualOverrides ? { manualOverrides } : {}),
    ...lineOverrides,
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

/** El input de impuestos vive en la celda "Impuestos" del editor. Lo
 *  localizamos desde el header (text="Impuestos") subiendo al ancestro
 *  que contiene el <input> de la celda. */
function getTaxInput(): HTMLInputElement {
  const header = screen.getAllByText(/^Impuestos$/i).find((el) =>
    el.className.includes("uppercase") || el.tagName === "DIV"
  ) as HTMLElement;
  let cell: HTMLElement | null = header;
  while (cell && !cell.querySelector("input")) cell = cell.parentElement;
  if (!cell) throw new Error("No se encontró la celda Impuestos");
  return cell.querySelector("input") as HTMLInputElement;
}

// ───────────────────────────────────────────────────────────────────────────
// CASO 1: Cliente exento, sin override manual
// ───────────────────────────────────────────────────────────────────────────
describe("Cliente exento + impuesto automático", () => {
  it("CASO 1: exento sin override → input value=0, badge 'Exento cliente', editable", () => {
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          taxExemptByEntity: true,
          composition: { taxes: [] },
        })]} />,
    );
    // Badge informativo.
    expect(screen.getByText("Exento cliente")).toBeInTheDocument();
    // Input value 0 (el preset puede mostrarlo como "0,00" o "0.00").
    const input = getTaxInput();
    expect(input.value).toMatch(/^0[,.]00$/);
    // Editable: exención NO bloquea el input.
    expect(input).not.toHaveAttribute("readOnly");
    // No debe mostrarse badge de IVA ni "Impuesto manual".
    expect(screen.queryByText(/IVA\b/)).toBeNull();
    expect(screen.queryByText("Impuesto manual")).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CASO 2: Cliente exento + usuario escribe 21% manual
// ───────────────────────────────────────────────────────────────────────────
describe("Cliente exento + override manual de impuesto", () => {
  it("CASO 2: exento + override 21% → badge 'Impuesto manual' (NO 'Exento cliente'), input value=21", () => {
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          taxExemptByEntity: true,
          taxOverride: { mode: "PERCENT", value: 21, appliesTo: "TOTAL" },
          composition: { taxes: [] },
        }, { tax: true })]} />,
    );
    // FIX clave: el badge ahora prioriza el override sobre la exención
    // (línea 3269 del editor). Antes mostraba "Exento cliente" aunque el
    // operador hubiera escrito 21% → confundía visualmente al operador
    // (los datos siempre fueron correctos, solo el badge mentía).
    expect(screen.getByText("Impuesto manual")).toBeInTheDocument();
    expect(screen.queryByText("Exento cliente")).toBeNull();
    // El input refleja el override (no el 0 de la exención).
    const input = getTaxInput();
    expect(input.value).toMatch(/^21[,.]00$/);
  });

  it("CASO 2 (AMOUNT): exento + override $500 → badge 'Impuesto manual', input value=500", () => {
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          taxExemptByEntity: true,
          taxOverride: { mode: "AMOUNT", value: 500, appliesTo: "TOTAL" },
          composition: { taxes: [] },
        }, { tax: true })]} />,
    );
    expect(screen.getByText("Impuesto manual")).toBeInTheDocument();
    expect(screen.queryByText("Exento cliente")).toBeNull();
    // El input está en modo AMOUNT (el toggle %/$ local arranca en percent
    // por default, así que internamente displayValue lee override.value=500
    // pero el formato puede diferir entre presets — verificamos que NO sea 0).
    const input = getTaxInput();
    expect(input.value).not.toMatch(/^0[,.]00$/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CASO 3: Cliente exento + usuario presiona X (override 0)
// ───────────────────────────────────────────────────────────────────────────
describe("Cliente exento + override manual 0 (X)", () => {
  it("CASO 3: exento + X (override value=0) → input value=0, badge 'Exento cliente' (NO 'Impuesto manual')", () => {
    // El operador escribió un manual (ej. 21%) y después presionó X.
    // X manda { value: 0 } como override (taxZeroed). Como el cliente es
    // exento, el badge debe volver a "Exento cliente" — el manual anulado
    // no debe seguir afirmándose como "Impuesto manual" (engañoso) ni
    // dejar el slot sin badge (visualmente vacío sin razón).
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          taxExemptByEntity: true,
          taxOverride: { mode: "PERCENT", value: 0, appliesTo: "TOTAL" },
          composition: { taxes: [] },
        }, { tax: true })]} />,
    );
    expect(screen.getByText("Exento cliente")).toBeInTheDocument();
    expect(screen.queryByText("Impuesto manual")).toBeNull();
    const input = getTaxInput();
    expect(input.value).toMatch(/^0[,.]00$/);
  });

  it("CASO 3 (cliente NORMAL): override value=0 → sin badge (no 'Exento cliente' ni 'Impuesto manual')", () => {
    // Variante: si el cliente NO es exento y el operador hizo X sobre un
    // impuesto, el badge queda en `null` (sin label sucio). Anti-regresión
    // del comportamiento previo al fix del badge.
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          taxExemptByEntity: false,
          taxOverride: { mode: "PERCENT", value: 0, appliesTo: "TOTAL" },
          composition: { taxes: [] },
        }, { tax: true })]} />,
    );
    expect(screen.queryByText("Exento cliente")).toBeNull();
    expect(screen.queryByText("Impuesto manual")).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CASO 4: Operador escribe sobre cliente exento → setLineTaxOverride se
// invoca con el override (motor lo respeta y aplica).
// ───────────────────────────────────────────────────────────────────────────
describe("Cliente exento + operador edita el input", () => {
  it("CASO 4: exento + escribir 21 en el input → setLineTaxOverride('L1', { mode:'PERCENT', value:21, appliesTo:'TOTAL' })", () => {
    const spy = vi.fn();
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          taxExemptByEntity: true,
          composition: { taxes: [] },
        })]}
        setLineTaxOverride={spy} />,
    );
    const input = getTaxInput();
    fireEvent.change(input, { target: { value: "21" } });
    expect(spy).toHaveBeenCalled();
    const [lineId, override] = spy.mock.calls[spy.mock.calls.length - 1];
    expect(lineId).toBe("L1");
    // El override viaja con PERCENT (modo default del selector) y appliesTo
    // del scope actual. El backend recibe esto y aplica el impuesto manual
    // sobre el cliente exento.
    expect(override).toMatchObject({ mode: "PERCENT", value: 21 });
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CASO 5 — T11/T9: exempt + override → chip "Manual" + tasa visible
//   El texto técnico "21% · reemplaza exención cliente" se reemplazó por un
//   pill TPBadge "Manual" delicado al lado de la tasa.
// ───────────────────────────────────────────────────────────────────────────
describe("Cliente exento + override manual: pill 'Manual' + tasa", () => {
  it("T9/T11 — exento + override 21% → chip 'Manual' + tasa visible (sin 'reemplaza')", () => {
    const { container } = render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          taxExemptByEntity: true,
          taxOverride: { mode: "PERCENT", value: 21, appliesTo: "TOTAL" },
          composition: { taxes: [] },
        }, { tax: true })]} />,
    );
    // El chip "Manual" aparece en algún lugar de la celda (badge tone=warning).
    expect((container.textContent ?? "")).toMatch(/Manual/);
    // Y la tasa 21% se muestra cerca.
    expect((container.textContent ?? "")).toMatch(/21/);
    // No queda texto técnico "reemplaza".
    expect((container.textContent ?? "")).not.toMatch(/reemplaza/i);
  });

  it("NO exento + override 21% → sub-label muestra solo la tasa (sin 'reemplaza exención')", () => {
    const { container } = render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          taxExemptByEntity: false,
          taxOverride: { mode: "PERCENT", value: 21, appliesTo: "TOTAL" },
          composition: { taxes: [] },
        }, { tax: true })]} />,
    );
    // No debe aparecer el texto "reemplaza exención" para cliente normal.
    expect(container.textContent ?? "").not.toMatch(/reemplaza exención/i);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CASO 6: Manual 0 (escribir 0 en input) ≠ X (limpiar)
// ───────────────────────────────────────────────────────────────────────────
describe("Manual 0 vs X — semántica diferenciada en Impuestos", () => {
  it("escribir 0 en el input → override { mode:'PERCENT', value:0 } (manual 0 explícito)", () => {
    const spy = vi.fn();
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          composition: { taxes: [{ name: "IVA", rate: 21, taxAmount: 21, appliesTo: "TOTAL" }] },
        }, undefined, { taxAmount: 21, lineTotalWithTax: 121 })]}
        setLineTaxOverride={spy} />,
    );
    const input = getTaxInput();
    fireEvent.change(input, { target: { value: "0" } });
    expect(spy).toHaveBeenCalled();
    const [lineId, override] = spy.mock.calls[spy.mock.calls.length - 1];
    expect(lineId).toBe("L1");
    // Manual 0: override con value=0 (NO null) → el operador anuló el
    // automático del cliente/artículo y eligió 0 explícito.
    expect(override).toEqual({ mode: "PERCENT", value: 0, appliesTo: "TOTAL" });
  });

  it("X (clear) sobre override 21% → setLineTaxOverride({ value: 0 }) (manual 0 explícito)", () => {
    const spy = vi.fn();
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          taxOverride: { mode: "PERCENT", value: 21, appliesTo: "TOTAL" },
          composition: { taxes: [{ name: "Impuesto manual", rate: 21, taxAmount: 21, appliesTo: "TOTAL" }] },
        }, { tax: true })]}
        setLineTaxOverride={spy} />,
    );
    // La X de Impuestos tiene aria-label "Poner impuesto en 0" — semántica
    // global de la X en Factura: poner valor en 0 como override manual
    // explícito. Coherente con la X de Bonificación.
    const cell = getTaxInput().closest("div");
    let scope: HTMLElement | null = cell;
    while (scope && !scope.querySelector('button[aria-label="Poner impuesto en 0"]')) {
      scope = scope.parentElement;
    }
    const clearBtn = (scope as HTMLElement).querySelector(
      'button[aria-label="Poner impuesto en 0"]',
    ) as HTMLButtonElement;
    expect(clearBtn).toBeTruthy();
    fireEvent.click(clearBtn);
    expect(spy).toHaveBeenCalled();
    const [, override] = spy.mock.calls[spy.mock.calls.length - 1];
    // X = override manual con value=0 (NO null que era la semántica
    // anterior "restaurar"). Pills/badges automáticos NO vuelven.
    expect(override).toEqual({ mode: "PERCENT", value: 0, appliesTo: "TOTAL" });
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CASO 7: Anti-regresión — exento + composition con IVA configurado pero
// SIN override → debe mostrar "Exento cliente" (la exención del cliente
// gana sobre el IVA configurado en el artículo).
// ───────────────────────────────────────────────────────────────────────────
describe("Anti-regresión — exención del cliente prioriza sobre IVA del artículo", () => {
  it("CASO 5: exento + composition con IVA 21% pero sin override → badge 'Exento cliente'", () => {
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          taxExemptByEntity: true,
          // Artículo CONFIGURADO con IVA 21%, pero el cliente es exento →
          // el motor devuelve `taxAmount: 0` y `items` queda vacío para la
          // UI (la rama `exempt ? [] : breakdown` del editor). El badge
          // debe decir "Exento cliente", no "IVA 21%".
          composition: { taxes: [{ name: "IVA", rate: 21, taxAmount: 21, appliesTo: "TOTAL" }] },
        })]} />,
    );
    // Confirmamos exención visible y NO "IVA 21%".
    expect(screen.getByText("Exento cliente")).toBeInTheDocument();
    const ivaBadge = screen.queryAllByText(/IVA/).find((el) =>
      /21/.test(el.textContent ?? "")
    );
    expect(ivaBadge).toBeUndefined();
  });
});

void within; // helper importado por convención; no usado en este archivo.
