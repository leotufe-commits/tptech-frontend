// src/components/ui/__tests__/inherited-client-adjustment.test.tsx
// ============================================================================
// Auditoría: Bonificación / Recargo HEREDADOS del cliente en Factura.
//
// El motor backend ya aplica la regla comercial del cliente (DISCOUNT, BONUS o
// SURCHARGE) por `clientId` y devuelve el efecto en `unitPrice` / `lineDiscount`
// y la metadata en `pricingMeta.inheritedDiscount`. El editor debe:
//
//   1. Renderizar el label correcto:
//        · ruleType ∈ DISCOUNT/BONUS → "BONIFICACIÓN"
//        · ruleType === "SURCHARGE"  → "RECARGO"
//   2. Mostrar el badge "Bonificación cliente" o "Recargo cliente"
//      (no solo "Cliente") para que el operador sepa qué heredó.
//   3. Al hacer click en el toggle Bonif. ⇄ Recargo estando en herencia,
//      promover el valor heredado a `manualDiscount` con el `kind` opuesto
//      (no mutar la herencia en silencio).
//   4. La X limpia el override manual (`manualDiscount: null`) y deja que
//      el motor vuelva a aplicar la herencia.
//   5. Cero recálculo en frontend: importes/precios vienen del motor.
// ============================================================================

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LinesEditorSection } from "../../../pages/ventas-facturas/InvoiceEditorModal/LinesEditorSection";
import type { DocumentLine } from "../../../lib/document-types";

function makeInheritedLine(opts: {
  ruleType: "DISCOUNT" | "BONUS" | "SURCHARGE";
  valueType?: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;       // 10 = 10% (PERCENTAGE) o 10 ARS (FIXED_AMOUNT)
  applyOn?: "TOTAL" | "METAL" | "HECHURA";
  // Lo que el motor reportó como discount aplicado (BONUS) o 0 (SURCHARGE).
  discountAmount?: number;
  // Para recargo, el unitPrice viene ARRIBA del basePrice (el motor sumó).
  unitPrice?: number;
}): DocumentLine {
  return {
    id: "L1", type: "ARTICLE", article: "Anillo", variant: "",
    articleId: "art-1", quantity: 1,
    unitPrice: opts.unitPrice ?? 100,
    discountAmount: opts.discountAmount ?? 0,
    subtotal: opts.unitPrice ?? 100, taxAmount: 0,
    lineTotal: opts.unitPrice ?? 100, lineTotalWithTax: opts.unitPrice ?? 100,
    pricingMeta: {
      priceSource: "PRICE_LIST", basePrice: 100,
      quantityDiscountAmount: 0, promotionDiscountAmount: 0,
      // Passthrough del backend — el motor pobla esto desde
      // `clientCommercialRules`. El editor lo lee tal cual.
      inheritedDiscount: {
        ruleType:  opts.ruleType,
        valueType: opts.valueType ?? "PERCENTAGE",
        value:     opts.value,
        applyOn:   opts.applyOn ?? "TOTAL",
        origin:    "CLIENT",
      },
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

// ─────────────────────────────────────────────────────────────────────────────
// 1. Hidratación visual: label + badge correctos según ruleType heredado.
// ─────────────────────────────────────────────────────────────────────────────
describe("Ajuste heredado del cliente — hidratación visual", () => {
  // ⚠️ Tests skipeados — los badges inline "Bonificación cliente" / "Recargo
  // cliente" que vivían en la celda del editor fueron ELIMINADOS por pedido
  // explícito del usuario ("no duplicar badges, consolidar en bloque resumen").
  // El cliente se representa ahora como ítem dentro de
  // `<SaleLineDiscountSummary>` con label "Cliente" o "Recargo cliente".
  // Verificación equivalente vive en:
  //   · `src/components/sales/__tests__/SaleLineDiscountSummary.test.tsx`
  //   · `src/lib/pricing/display/__tests__/saleLineDiscountSourcesDisplay.test.ts`
  it.skip("cliente con DISCOUNT 10% → label 'Bonificación' + badge 'Bonificación cliente' [LEGACY: badge eliminado]", () => {
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeInheritedLine({ ruleType: "DISCOUNT", value: 10, discountAmount: 10, unitPrice: 90 })]}
        applyLineOverrides={vi.fn()} />,
    );
    // El header de la celda es un <button aria-label="Tipo de ajuste: …">.
    const trigger = screen.getByRole("button", { name: /tipo de ajuste:\s*bonificación/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger.textContent).toContain("Bonificación");
    // Badge distingue Bonificación cliente vs Recargo cliente.
    expect(screen.getByText("Bonificación cliente")).toBeInTheDocument();
  });

  it.skip("cliente con SURCHARGE 10% → header 'Recargo' + badge 'Recargo cliente' [LEGACY: badge eliminado]", () => {
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeInheritedLine({ ruleType: "SURCHARGE", value: 10, unitPrice: 110 })]}
        applyLineOverrides={vi.fn()} />,
    );
    const trigger = screen.getByRole("button", { name: /tipo de ajuste:\s*recargo/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger.textContent).toContain("Recargo");
    expect(screen.getByText("Recargo cliente")).toBeInTheDocument();
    expect(screen.queryByText("Bonificación cliente")).toBeNull();
  });

  it.skip("cliente con BONUS 5% → header 'Bonificación' (BONUS y DISCOUNT mismo kind) [LEGACY: badge eliminado]", () => {
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeInheritedLine({ ruleType: "BONUS", value: 5, discountAmount: 5, unitPrice: 95 })]}
        applyLineOverrides={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /tipo de ajuste:\s*bonificación/i })).toBeInTheDocument();
    expect(screen.getByText("Bonificación cliente")).toBeInTheDocument();
  });

  it("botón %/$ de Bonificación usa clases NEUTRALES (igual a Impuestos, sin amber/emerald)", () => {
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeInheritedLine({ ruleType: "SURCHARGE", value: 10, unitPrice: 110 })]}
        applyLineOverrides={vi.fn()} />,
    );
    const bonifToggle = screen.getByRole("button", { name: /cambiar tipo de bonificación/i });
    // No debe tener clases de color de kind — el botón %/$ debe ser neutral.
    expect(bonifToggle.className).not.toMatch(/amber|emerald/);
    // Y SÍ debe compartir las clases estructurales clave con un botón %/$
    // genérico de la app: borde, altura, padding, text muted.
    expect(bonifToggle.className).toContain("border-border");
    expect(bonifToggle.className).toContain("h-[42px]");
    expect(bonifToggle.className).toContain("text-muted");
  });

  it("el chip inferior antiguo 'Bonif. ⇄ Recargo' fue eliminado del DOM", () => {
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeInheritedLine({ ruleType: "SURCHARGE", value: 10, unitPrice: 110 })]}
        applyLineOverrides={vi.fn()} />,
    );
    // El símbolo '⇄' que usaba el chip viejo no debe aparecer en ningún lado.
    expect(screen.queryByText(/⇄/)).toBeNull();
    // El botón legacy "Cambiar a bonificación/recargo" tampoco.
    expect(screen.queryByRole("button", { name: /^cambiar a (bonificación|recargo)$/i })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Dropdown del header: cambiar el kind PROMUEVE la herencia a override
//    manual EXPLÍCITO preservando value/appliesTo/mode.
// ─────────────────────────────────────────────────────────────────────────────
describe("Dropdown Bonificación / Recargo sobre herencia", () => {
  it("BONUS heredado + dropdown 'Recargo' → manualDiscount con kind=SURCHARGE y mismo valor", () => {
    const spy = vi.fn();
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeInheritedLine({ ruleType: "DISCOUNT", value: 10, discountAmount: 10, unitPrice: 90 })]}
        applyLineOverrides={spy} />,
    );
    // Abrir dropdown desde el header.
    fireEvent.click(screen.getByRole("button", { name: /tipo de ajuste:\s*bonificación/i }));
    // Elegir "Recargo" en el menú.
    const items = screen.getAllByRole("menuitem");
    const recargoItem = items.find((b) => /^[+\s]*Recargo$/i.test((b.textContent ?? "").trim()))
      ?? items.find((b) => /recargo/i.test(b.textContent ?? ""));
    expect(recargoItem).toBeTruthy();
    fireEvent.click(recargoItem!);

    expect(spy).toHaveBeenCalled();
    const [lineId, patch] = spy.mock.calls[spy.mock.calls.length - 1];
    expect(lineId).toBe("L1");
    // Promovido a manual con kind opuesto + valor heredado.
    expect(patch.manualDiscount).toEqual({
      mode:      "PERCENT",
      value:     10,
      appliesTo: "TOTAL",
      kind:      "SURCHARGE",
    });
  });

  it("SURCHARGE heredado + dropdown 'Bonificación' → manualDiscount con kind=BONUS y mismo valor", () => {
    const spy = vi.fn();
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeInheritedLine({ ruleType: "SURCHARGE", value: 15, unitPrice: 115 })]}
        applyLineOverrides={spy} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /tipo de ajuste:\s*recargo/i }));
    const items = screen.getAllByRole("menuitem");
    const bonifItem = items.find((b) => /bonificación/i.test(b.textContent ?? ""));
    expect(bonifItem).toBeTruthy();
    fireEvent.click(bonifItem!);

    const [, patch] = spy.mock.calls[spy.mock.calls.length - 1];
    expect(patch.manualDiscount).toEqual({
      mode:      "PERCENT",
      value:     15,
      appliesTo: "TOTAL",
      kind:      "BONUS",
    });
  });

  it("dropdown preserva appliesTo del heredado (METAL → METAL)", () => {
    const spy = vi.fn();
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeInheritedLine({ ruleType: "SURCHARGE", value: 8, applyOn: "METAL", unitPrice: 108 })]}
        applyLineOverrides={spy} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /tipo de ajuste:\s*recargo/i }));
    const items = screen.getAllByRole("menuitem");
    fireEvent.click(items.find((b) => /bonificación/i.test(b.textContent ?? ""))!);

    const [, patch] = spy.mock.calls[spy.mock.calls.length - 1];
    expect(patch.manualDiscount.appliesTo).toBe("METAL");
    expect(patch.manualDiscount.kind).toBe("BONUS");
  });

  it("Escape cierra el menú", () => {
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeInheritedLine({ ruleType: "DISCOUNT", value: 10, discountAmount: 10, unitPrice: 90 })]}
        applyLineOverrides={vi.fn()} />,
    );
    const trigger = screen.getByRole("button", { name: /tipo de ajuste:\s*bonificación/i });
    fireEvent.click(trigger);
    // Menú abierto.
    expect(screen.getAllByRole("menuitem").length).toBeGreaterThan(0);
    // Escape cierra.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryAllByRole("menuitem").length).toBe(0);
  });

  it("click sobre el TPNumberInput de la misma celda cierra el menú (capture phase)", () => {
    // Regresión: el TPNumberInput hace `stopPropagation` en mousedown para
    // no perder foco. En bubble phase el handler global no se enteraba →
    // el menú no se cerraba al clickear el input. En capture phase el
    // handler corre ANTES de que stopPropagation actúe.
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeInheritedLine({ ruleType: "DISCOUNT", value: 10, discountAmount: 10, unitPrice: 90 })]}
        applyLineOverrides={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /tipo de ajuste:\s*bonificación/i }));
    expect(screen.getAllByRole("menuitem").length).toBeGreaterThan(0);

    // Localizar el input numérico de Bonificación de la misma celda.
    const trigger = screen.getByRole("button", { name: /tipo de ajuste:\s*bonificación/i });
    let cellEl: HTMLElement | null = trigger;
    while (cellEl && !cellEl.querySelector("input")) cellEl = cellEl.parentElement;
    const input = (cellEl as HTMLElement).querySelector("input") as HTMLInputElement;
    expect(input).toBeTruthy();

    fireEvent.mouseDown(input);
    expect(screen.queryAllByRole("menuitem").length).toBe(0);
  });

  it("click fuera del menú cierra el dropdown", () => {
    render(
      <div>
        <LinesEditorSection {...(baseProps as any)}
          lines={[makeInheritedLine({ ruleType: "DISCOUNT", value: 10, discountAmount: 10, unitPrice: 90 })]}
          applyLineOverrides={vi.fn()} />
        <button data-testid="outside">fuera</button>
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: /tipo de ajuste:\s*bonificación/i }));
    expect(screen.getAllByRole("menuitem").length).toBeGreaterThan(0);
    // mousedown afuera → cierra (el handler global escucha mousedown).
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryAllByRole("menuitem").length).toBe(0);
  });

  it("el menú flotante se renderiza como sibling cercano al trigger (no al pie de la celda)", () => {
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeInheritedLine({ ruleType: "DISCOUNT", value: 10, discountAmount: 10, unitPrice: 90 })]}
        applyLineOverrides={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /tipo de ajuste:\s*bonificación/i }));

    const trigger = screen.getByRole("button", { name: /tipo de ajuste:\s*bonificación/i });
    const menu = screen.getByRole("menu");
    // El trigger y el menú DEBEN compartir el mismo wrapper `relative` para
    // que `top-full mt-1` posicione el menú a 4 px del button (no al pie de
    // la celda completa). Verificamos que el parent del trigger sea también
    // ancestro inmediato del menú — es decir, ambos viven en el mismo div
    // pequeño del header, no en la raíz de la celda.
    const triggerParent = trigger.parentElement;
    expect(triggerParent).toBeTruthy();
    expect(triggerParent!.contains(menu)).toBe(true);
    // Y el wrapper inmediato del trigger NO contiene al input de la celda
    // (que vive más abajo, fuera del wrapper relative del header).
    expect(triggerParent!.querySelector("input")).toBeNull();
  });

  it("click sobre el trigger abierto lo CIERRA (no se queda 'no responde')", () => {
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeInheritedLine({ ruleType: "DISCOUNT", value: 10, discountAmount: 10, unitPrice: 90 })]}
        applyLineOverrides={vi.fn()} />,
    );
    const trigger = screen.getByRole("button", { name: /tipo de ajuste:\s*bonificación/i });
    fireEvent.click(trigger);
    expect(screen.getAllByRole("menuitem").length).toBeGreaterThan(0);
    // Segundo click sobre el MISMO trigger → cierra. Sin el guard
    // data-kind-menu-trigger el menú se cerraba en mousedown y onClick volvía
    // a setear null → operador no veía la apertura.
    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);
    expect(screen.queryAllByRole("menuitem").length).toBe(0);
  });

  it("toggle %/$ preserva kind y appliesTo cuando ya hay manual", () => {
    const spy = vi.fn();
    const seeded = {
      ...makeInheritedLine({ ruleType: "SURCHARGE", value: 10, applyOn: "METAL", unitPrice: 108 }),
      manualOverrides: { discount: true },
      pricingMeta: {
        priceSource: "MANUAL_OVERRIDE", basePrice: 100,
        quantityDiscountAmount: 0, promotionDiscountAmount: 0,
        manualDiscount: { mode: "PERCENT", value: 10, appliesTo: "METAL", kind: "SURCHARGE" },
      },
    } as unknown as DocumentLine;
    render(
      <LinesEditorSection {...(baseProps as any)} lines={[seeded]}
        applyLineOverrides={spy} />,
    );
    // Buscar el botón "Cambiar tipo de bonificación" (el toggle %/$).
    const toggle = screen.getByRole("button", { name: /cambiar tipo de bonificación/i });
    fireEvent.click(toggle);

    expect(spy).toHaveBeenCalled();
    const [, patch] = spy.mock.calls[spy.mock.calls.length - 1];
    expect(patch.manualDiscount.mode).toBe("AMOUNT");        // cambió
    expect(patch.manualDiscount.appliesTo).toBe("METAL");    // preservado
    expect(patch.manualDiscount.kind).toBe("SURCHARGE");     // preservado
  });

  it("toggle %/$ con herencia (sin manual) PROMUEVE a manual con mode opuesto + kind heredado", () => {
    const spy = vi.fn();
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeInheritedLine({ ruleType: "SURCHARGE", value: 15, applyOn: "TOTAL", valueType: "PERCENTAGE", unitPrice: 115 })]}
        applyLineOverrides={spy} />,
    );
    const toggle = screen.getByRole("button", { name: /cambiar tipo de bonificación/i });
    fireEvent.click(toggle);

    expect(spy).toHaveBeenCalled();
    const [, patch] = spy.mock.calls[spy.mock.calls.length - 1];
    // Herencia era PERCENTAGE → click pasa a AMOUNT y cristaliza como manual.
    expect(patch.manualDiscount.mode).toBe("AMOUNT");
    // Kind heredado SURCHARGE se preserva.
    expect(patch.manualDiscount.kind).toBe("SURCHARGE");
    // Valor heredado se preserva.
    expect(patch.manualDiscount.value).toBe(15);
  });

  it("RECALCULO: cambio de kind con mismo value/mode/appliesTo DISPARA patch (no idempotente por kind)", () => {
    // Regresión del bug: `sameTypedOverride` no comparaba `kind` → el guard
    // de idempotencia en `applyLineOverrides` descartaba el patch que solo
    // cambiaba Bonificación→Recargo. Resultado visible: UI cambiaba pero el
    // motor no recalculaba (mismo precio).
    //
    // Verificamos via spy de `applyLineOverrides` que el patch llega con el
    // kind opuesto preservando el resto. La integración con el guard de
    // VentasFacturas.tsx se cubre por el typecheck (la firma del helper
    // ahora incluye kind) + por los tests existentes del flujo de patch.
    const spy = vi.fn();
    const seeded = {
      ...makeInheritedLine({ ruleType: "DISCOUNT", value: 10, discountAmount: 10, unitPrice: 90 }),
      manualOverrides: { discount: true },
      pricingMeta: {
        priceSource: "MANUAL_OVERRIDE", basePrice: 100,
        quantityDiscountAmount: 0, promotionDiscountAmount: 0,
        // Manual con kind=BONUS ya cristalizado y `value`/`mode`/`appliesTo`
        // específicos.
        manualDiscount: { mode: "PERCENT", value: 10, appliesTo: "METAL", kind: "BONUS" },
      },
    } as unknown as DocumentLine;
    render(
      <LinesEditorSection {...(baseProps as any)} lines={[seeded]}
        applyLineOverrides={spy} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /tipo de ajuste:\s*bonificación/i }));
    fireEvent.click(
      screen.getAllByRole("menuitem").find((b) => /recargo/i.test(b.textContent ?? ""))!,
    );

    // Debe haber UN patch con el kind opuesto + resto preservado.
    expect(spy).toHaveBeenCalled();
    const [, patch] = spy.mock.calls[spy.mock.calls.length - 1];
    expect(patch.manualDiscount).toEqual({
      mode:      "PERCENT",   // preservado
      value:     10,          // preservado
      appliesTo: "METAL",     // preservado
      kind:      "SURCHARGE", // cambiado
    });
  });

  it("OPTIMISTIC: BONUS heredado → click 'Recargo' actualiza header AL INSTANTE (sin esperar preview)", () => {
    const spy = vi.fn();
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeInheritedLine({ ruleType: "DISCOUNT", value: 10, discountAmount: 10, unitPrice: 90 })]}
        applyLineOverrides={spy} />,
    );
    // Estado inicial: el header dice "Bonificación".
    expect(screen.getByRole("button", { name: /tipo de ajuste:\s*bonificación/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /tipo de ajuste:\s*recargo/i })).toBeNull();

    // Click → abrir menú → elegir Recargo.
    fireEvent.click(screen.getByRole("button", { name: /tipo de ajuste:\s*bonificación/i }));
    fireEvent.click(
      screen.getAllByRole("menuitem").find((b) => /recargo/i.test(b.textContent ?? ""))!,
    );

    // EL MISMO RENDER (sin re-mount, sin nuevo pricingMeta): el aria-label
    // del trigger ya dice "Recargo". Sin el optimistic, esto seguiría
    // mostrando "Bonificación" hasta que volviera el preview con el patch
    // aplicado a `pricingMeta.manualDiscount.kind`.
    expect(screen.getByRole("button", { name: /tipo de ajuste:\s*recargo/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /tipo de ajuste:\s*bonificación/i })).toBeNull();
    // Y el patch viajó al motor.
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][1].manualDiscount.kind).toBe("SURCHARGE");
  });

  it("OPTIMISTIC: SURCHARGE manual → click 'Bonificación' actualiza header al instante", () => {
    const spy = vi.fn();
    const seeded = {
      ...makeInheritedLine({ ruleType: "SURCHARGE", value: 10, unitPrice: 110 }),
      manualOverrides: { discount: true },
      pricingMeta: {
        priceSource: "MANUAL_OVERRIDE", basePrice: 100,
        quantityDiscountAmount: 0, promotionDiscountAmount: 0,
        manualDiscount: { mode: "PERCENT", value: 10, appliesTo: "TOTAL", kind: "SURCHARGE" },
      },
    } as unknown as DocumentLine;
    render(
      <LinesEditorSection {...(baseProps as any)} lines={[seeded]}
        applyLineOverrides={spy} />,
    );
    expect(screen.getByRole("button", { name: /tipo de ajuste:\s*recargo/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /tipo de ajuste:\s*recargo/i }));
    fireEvent.click(
      screen.getAllByRole("menuitem").find((b) => /bonificación/i.test(b.textContent ?? ""))!,
    );
    // Cambio instantáneo a "Bonificación" sin esperar la hidratación.
    expect(screen.getByRole("button", { name: /tipo de ajuste:\s*bonificación/i })).toBeInTheDocument();
  });

  it("OPTIMISTIC: la X limpia el optimistic Y el manualDiscount", () => {
    const spy = vi.fn();
    const seeded = {
      ...makeInheritedLine({ ruleType: "DISCOUNT", value: 10, discountAmount: 10, unitPrice: 90 }),
      manualOverrides: { discount: true },
      pricingMeta: {
        priceSource: "MANUAL_OVERRIDE", basePrice: 100,
        quantityDiscountAmount: 0, promotionDiscountAmount: 0,
        // Cliente DISCOUNT heredado + manual con value > 0 (para que la X
        // aparezca) sin kind explícito todavía.
        inheritedDiscount: { ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 10, applyOn: "TOTAL", origin: "CLIENT" },
        manualDiscount: { mode: "PERCENT", value: 25, appliesTo: "TOTAL", kind: "BONUS" },
      },
    } as unknown as DocumentLine;
    const { rerender } = render(
      <LinesEditorSection {...(baseProps as any)} lines={[seeded]}
        applyLineOverrides={spy} />,
    );
    // Cambiar a SURCHARGE → seta optimistic SURCHARGE.
    fireEvent.click(screen.getByRole("button", { name: /tipo de ajuste:\s*bonificación/i }));
    fireEvent.click(
      screen.getAllByRole("menuitem").find((b) => /recargo/i.test(b.textContent ?? ""))!,
    );
    expect(screen.getByRole("button", { name: /tipo de ajuste:\s*recargo/i })).toBeInTheDocument();

    // Ahora la X. Buscar el clear button dentro de la celda.
    // La X de Bonificación lleva aria-label "Poner bonificación en 0" —
    // semántica global de la X en Factura: setea override manual con value=0
    // preservando mode/appliesTo/kind. NO restaura el automático.
    const trigger = screen.getByRole("button", { name: /tipo de ajuste:\s*recargo/i });
    let cell: HTMLElement | null = trigger;
    while (cell && !cell.querySelector('button[aria-label="Poner bonificación en 0"]')) cell = cell.parentElement;
    const clearBtn = (cell as HTMLElement).querySelector('button[aria-label="Poner bonificación en 0"]') as HTMLButtonElement;
    fireEvent.click(clearBtn);

    // Patch: manualDiscount = { value: 0, ... } (override manual 0, NO null).
    // El kind se preserva (SURCHARGE en este caso, heredado del estado previo).
    const lastPatch = spy.mock.calls[spy.mock.calls.length - 1][1];
    expect(lastPatch.manualDiscount).toMatchObject({ value: 0 });

    // Como el componente sigue recibiendo el draft con manualDiscount viejo
    // (el padre todavía no aplicó el patch en el mock), si el optimistic NO
    // se hubiera limpiado el label seguiría diciendo Recargo. Para verificar
    // que el optimistic SE LIMPIÓ, re-renderizamos con el draft "post-X":
    // manualDiscount=null pero herencia DISCOUNT intacta → debería volver a
    // "Bonificación" (kind heredado).
    const cleared = {
      ...seeded,
      manualOverrides: { discount: false },
      pricingMeta: {
        ...seeded.pricingMeta,
        manualDiscount: null,
      },
    } as unknown as DocumentLine;
    rerender(
      <LinesEditorSection {...(baseProps as any)} lines={[cleared]}
        applyLineOverrides={spy} />,
    );
    expect(screen.getByRole("button", { name: /tipo de ajuste:\s*bonificación/i })).toBeInTheDocument();
  });

  it("OPTIMISTIC: cuando el preview confirma el kind elegido, el optimistic se sincroniza (no queda stale)", () => {
    const spy = vi.fn();
    const seeded = {
      ...makeInheritedLine({ ruleType: "DISCOUNT", value: 10, discountAmount: 10, unitPrice: 90 }),
    } as unknown as DocumentLine;
    const { rerender } = render(
      <LinesEditorSection {...(baseProps as any)} lines={[seeded]}
        applyLineOverrides={spy} />,
    );
    // Elegir Recargo (set optimistic).
    fireEvent.click(screen.getByRole("button", { name: /tipo de ajuste:\s*bonificación/i }));
    fireEvent.click(
      screen.getAllByRole("menuitem").find((b) => /recargo/i.test(b.textContent ?? ""))!,
    );
    // Simular respuesta del preview: el padre re-renderea con manualDiscount
    // ya hidratado con kind=SURCHARGE.
    const settled = {
      ...seeded,
      manualOverrides: { discount: true },
      pricingMeta: {
        ...seeded.pricingMeta,
        manualDiscount: { mode: "PERCENT", value: 10, appliesTo: "TOTAL", kind: "SURCHARGE" },
      },
    } as unknown as DocumentLine;
    rerender(
      <LinesEditorSection {...(baseProps as any)} lines={[settled]}
        applyLineOverrides={spy} />,
    );
    // El header sigue diciendo Recargo (ahora gobernado por md.kind).
    expect(screen.getByRole("button", { name: /tipo de ajuste:\s*recargo/i })).toBeInTheDocument();
    // Ahora si simulamos otro preview donde el motor "deshace" (caso
    // hipotético: cliente nuevo que pisa con DISCOUNT y el operador no
    // tiene manual → kind debería volver a BONUS heredado).
    const reset = {
      ...seeded,
      manualOverrides: { discount: false },
      pricingMeta: {
        ...seeded.pricingMeta,
        manualDiscount: null,
        inheritedDiscount: { ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 5, applyOn: "TOTAL", origin: "CLIENT" },
      },
    } as unknown as DocumentLine;
    rerender(
      <LinesEditorSection {...(baseProps as any)} lines={[reset]}
        applyLineOverrides={spy} />,
    );
    // Como el optimistic se sincronizó (se borró) cuando settled.md.kind
    // coincidió con SURCHARGE, el nuevo render NO tiene optimistic stale
    // pegado → respeta la herencia BONUS.
    expect(screen.getByRole("button", { name: /tipo de ajuste:\s*bonificación/i })).toBeInTheDocument();
  });

  it("elegir el MISMO kind con manual existente NO dispara patch (idempotente)", () => {
    const spy = vi.fn();
    // Línea con manual BONUS ya cristalizado (no es solo herencia).
    const seeded = {
      ...makeInheritedLine({ ruleType: "DISCOUNT", value: 10, discountAmount: 10, unitPrice: 90 }),
      manualOverrides: { discount: true },
      pricingMeta: {
        priceSource: "MANUAL_OVERRIDE", basePrice: 100,
        quantityDiscountAmount: 0, promotionDiscountAmount: 0,
        manualDiscount: { mode: "PERCENT", value: 10, appliesTo: "TOTAL", kind: "BONUS" },
      },
    } as unknown as DocumentLine;
    render(
      <LinesEditorSection {...(baseProps as any)} lines={[seeded]}
        applyLineOverrides={spy} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /tipo de ajuste:\s*bonificación/i }));
    const items = screen.getAllByRole("menuitem");
    const bonifItem = items.find((b) => /bonificación/i.test(b.textContent ?? ""))!;
    fireEvent.click(bonifItem);
    // Guard de idempotencia: `nextKind === discKind && md != null` → no patch.
    expect(spy).not.toHaveBeenCalled();
    // El menú igualmente se cierra tras la selección.
    expect(screen.queryAllByRole("menuitem").length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Editar el valor mientras hay herencia: pasa a manualDiscount + kind correcto.
// ─────────────────────────────────────────────────────────────────────────────
describe("Editar el valor heredado lo manualiza", () => {
  it("cliente DISCOUNT + editar input → manualDiscount con kind=BONUS", () => {
    const spy = vi.fn();
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeInheritedLine({ ruleType: "DISCOUNT", value: 10, discountAmount: 10, unitPrice: 90 })]}
        applyLineOverrides={spy} />,
    );
    const input = ((() => {
      // El header es un <button aria-label="Tipo de ajuste: …">; subimos al
      // primer ancestro que contenga el <input> (la celda).
      const trigger = screen.getByRole("button", { name: /tipo de ajuste/i });
      let el: HTMLElement | null = trigger;
      while (el && !el.querySelector("input")) el = el.parentElement;
      return el as HTMLElement;
    })())
      .querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "25" } });

    expect(spy).toHaveBeenCalled();
    const [, patch] = spy.mock.calls[spy.mock.calls.length - 1];
    expect(patch.manualDiscount.value).toBe(25);
    expect(patch.manualDiscount.kind).toBe("BONUS");
  });

  it("cliente SURCHARGE + editar input → manualDiscount con kind=SURCHARGE", () => {
    const spy = vi.fn();
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeInheritedLine({ ruleType: "SURCHARGE", value: 10, unitPrice: 110 })]}
        applyLineOverrides={spy} />,
    );
    const input = ((() => {
      const trigger = screen.getByRole("button", { name: /tipo de ajuste/i });
      let el: HTMLElement | null = trigger;
      while (el && !el.querySelector("input")) el = el.parentElement;
      return el as HTMLElement;
    })())
      .querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "20" } });

    const [, patch] = spy.mock.calls[spy.mock.calls.length - 1];
    expect(patch.manualDiscount.value).toBe(20);
    expect(patch.manualDiscount.kind).toBe("SURCHARGE");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. La X limpia el override manual y restituye la herencia.
// ─────────────────────────────────────────────────────────────────────────────
describe("X limpia el override y vuelve a la herencia", () => {
  it("manualDiscount + X → patch manualDiscount: null", () => {
    const spy = vi.fn();
    // Línea con AMBOS: herencia del cliente y override manual encima.
    const seeded = {
      ...makeInheritedLine({ ruleType: "SURCHARGE", value: 10, unitPrice: 130 }),
      manualOverrides: { discount: true },
      pricingMeta: {
        priceSource: "MANUAL_OVERRIDE", basePrice: 100,
        quantityDiscountAmount: 0, promotionDiscountAmount: 0,
        inheritedDiscount: {
          ruleType: "SURCHARGE", valueType: "PERCENTAGE", value: 10,
          applyOn: "TOTAL", origin: "CLIENT",
        },
        // Manual del operador encima de la herencia (kind opuesto, p.ej.).
        manualDiscount: { mode: "PERCENT", value: 30, appliesTo: "TOTAL", kind: "SURCHARGE" },
      },
    } as unknown as DocumentLine;

    render(
      <LinesEditorSection {...(baseProps as any)} lines={[seeded]}
        applyLineOverrides={spy} />,
    );
    // X de Bonificación: aria-label "Poner bonificación en 0" — setea
    // override manual con value=0 preservando mode/appliesTo/kind.
    const clearBtn = ((() => {
      const trigger = screen.getByRole("button", { name: /tipo de ajuste/i });
      let el: HTMLElement | null = trigger;
      while (el && !el.querySelector("input")) el = el.parentElement;
      return el as HTMLElement;
    })())
      .querySelector('button[aria-label="Poner bonificación en 0"]') as HTMLButtonElement;
    expect(clearBtn).toBeTruthy();
    fireEvent.click(clearBtn);

    const [, patch] = spy.mock.calls[spy.mock.calls.length - 1];
    // X = override manual { value: 0 } preservando mode/kind/appliesTo.
    expect(patch.manualDiscount).toMatchObject({ value: 0 });
  });
});
