// src/components/ui/__tests__/bonif-manual-hides-auto-pills.test.tsx
// ============================================================================
// Semántica unificada "manual reemplaza automático" — pills visuales.
//
// Cuando hay `meta.manualDiscount` activo, el motor sustituye promo / desc.
// por cantidad / cliente por el override del operador. Los pills visuales
// que afirman "auto activo" deben desaparecer aunque los campos legacy del
// meta (appliedPromotionId, quantityDiscountAmount, customerDiscountAmount,
// priceSource="PROMOTION") sigan poblados (compatibilidad backend).
//
// No se borra info del backend — solo se deja de mostrarla como ACTIVA.
// Restaurar con X (manualDiscount: null) → pills vuelven en el siguiente
// render.
//
// Cubre los 5 casos del checklist:
//   1. Promo activa + manualDiscount → no se renderiza pill "Promo activa".
//   2. Desc. x cantidad + manualDiscount → no se renderiza pill "Desc. x cantidad".
//   3. Cliente + manualDiscount → no se renderiza item Cliente en el card
//      (cubierto por B3 en saleLineDiscountSourcesDisplay.test.ts; aquí
//      verificamos el comportamiento desde el render del editor).
//   4. Manual 0 (md.value=0 explícito) también oculta pills automáticos.
//   5. Al restaurar (manualDiscount=null) los pills vuelven.
// ============================================================================

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LinesEditorSection } from "../../../pages/ventas-facturas/InvoiceEditorModal/LinesEditorSection";
import type { DocumentLine } from "../../../lib/document-types";

function makeLine(
  metaOverrides: any = {},
  manualOverrides?: any,
  lineOverrides: any = {},
): DocumentLine {
  return {
    id: "L1", type: "ARTICLE", article: "Anillo", variant: "",
    articleId: "art-1", quantity: 2, unitPrice: 100,
    discountAmount: 0, subtotal: 200, taxAmount: 0,
    lineTotal: 200, lineTotalWithTax: 200,
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

// ───────────────────────────────────────────────────────────────────────────
// CASO 1: Promo activa + manualDiscount → pill "Promo activa" oculta
// ───────────────────────────────────────────────────────────────────────────
describe('Pills automáticos ocultos cuando hay manualDiscount', () => {
  it('CASO 1: promo activa + manualDiscount → "Promo activa" NO se renderiza', () => {
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          // Backend reporta promo aplicada (legacy fields siguen poblados).
          appliedPromotionId: "promo-1",
          appliedPromotionName: "Verano",
          promotionDiscountAmount: 20,
          // Manual override del operador → reemplaza promo.
          manualDiscount: { mode: "PERCENT", value: 15, appliesTo: "TOTAL", kind: "BONUS" },
        }, { discount: true })]} />,
    );
    // Pill TPQuantityField "Promo activa" debe estar oculto.
    expect(screen.queryByText("Promo activa")).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CASO 2: Desc. x cantidad + manualDiscount → pill oculto
  // ─────────────────────────────────────────────────────────────────────────
  it('CASO 2: desc. x cantidad + manualDiscount → "Desc. x cantidad" NO se renderiza', () => {
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          quantityDiscountAmount: 10,
          manualDiscount: { mode: "PERCENT", value: 15, appliesTo: "TOTAL", kind: "BONUS" },
        }, { discount: true })]} />,
    );
    // En el layout compactInline el pill se llama "Desc. x cantidad".
    expect(screen.queryByText(/Desc\. x cantidad/i)).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CASO 3: Cliente + manualDiscount → cliente NO aparece como activo
  // ─────────────────────────────────────────────────────────────────────────
  it('CASO 3: cliente + manualDiscount → card no muestra item "Cliente" en automatic', () => {
    // Este caso ya está cubierto a nivel del helper en
    // saleLineDiscountSourcesDisplay.test.ts (guard B3). Aquí confirmamos
    // que el render del editor tampoco muestra el item Cliente cuando hay
    // manual. El card está colapsado por default; basta verificar que el
    // texto "Cliente" no aparece en el header ni en ningún pill superior.
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          customerDiscountAmount: 50,
          inheritedDiscount: {
            ruleType: "DISCOUNT", valueType: "PERCENTAGE",
            value: 15, applyOn: "TOTAL",
          },
          manualDiscount: { mode: "PERCENT", value: 15, appliesTo: "TOTAL", kind: "BONUS" },
        }, { discount: true })]} />,
    );
    // El sublabel "Efectivo cliente" sale cuando source==="CLIENT". Con
    // manual activo el source es "MANUAL" → no debe aparecer.
    expect(screen.queryByText(/Efectivo cliente/i)).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CASO 4: Manual 0 (md.value=0 explícito) también oculta pills
  // ─────────────────────────────────────────────────────────────────────────
  it('CASO 4: manual 0 (md.value=0) también oculta pills automáticos', () => {
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          appliedPromotionId: "promo-1",
          appliedPromotionName: "Verano",
          promotionDiscountAmount: 20,
          quantityDiscountAmount: 10,
          // Manual 0 explícito: el operador escribió 0 y blur → md.value=0.
          // Sigue siendo override manual (manualDiscount != null), por lo
          // tanto el motor NO aplica promo/qty. Los pills deben ocultarse.
          manualDiscount: { mode: "PERCENT", value: 0, appliesTo: "TOTAL", kind: "BONUS" },
        }, { discount: true })]} />,
    );
    expect(screen.queryByText("Promo activa")).toBeNull();
    expect(screen.queryByText(/Desc\. x cantidad/i)).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CASO 5: Al restaurar (manualDiscount=null) los pills vuelven
  // ─────────────────────────────────────────────────────────────────────────
  it('CASO 5: SIN manualDiscount (estado post-X) → pills automáticos VUELVEN a renderizarse', () => {
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          appliedPromotionId: "promo-1",
          appliedPromotionName: "Verano",
          promotionDiscountAmount: 20,
          quantityDiscountAmount: 10,
          // SIN manualDiscount: estado equivalente al post-X (restaurar
          // automático) o nunca habiendo tenido override. El motor aplica
          // promo+qty y los pills deben mostrarse.
        })]} />,
    );
    // Confirmamos que los pills VUELVEN cuando manualDiscount es ausente.
    expect(screen.getByText("Promo activa")).toBeInTheDocument();
    expect(screen.getByText(/Desc\. x cantidad/i)).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // BONUS: chip "Promo" del PRECIO también se oculta cuando hay manualDiscount
  // (priceSource = PROMOTION → derivePriceChip devuelve label "Promo").
  // ─────────────────────────────────────────────────────────────────────────
  it('BONUS: chip "Promo" del precio se oculta cuando hay manualDiscount (priceSource=PROMOTION)', () => {
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          priceSource: "PROMOTION",
          appliedPromotionId: "promo-1",
          appliedPromotionName: "Verano",
          manualDiscount: { mode: "PERCENT", value: 15, appliesTo: "TOTAL", kind: "BONUS" },
        }, { discount: true })]} />,
    );
    // El chip de precio "Promo" no debe estar visible como activo.
    // Buscamos por texto exacto del TPBadge.
    expect(screen.queryByText(/^Promo$/)).toBeNull();
  });

  it('BONUS: chip "Cantidad" del precio se oculta cuando hay manualDiscount (priceSource=QUANTITY_DISCOUNT)', () => {
    const { container } = render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          priceSource: "QUANTITY_DISCOUNT",
          quantityDiscountAmount: 10,
          manualDiscount: { mode: "PERCENT", value: 15, appliesTo: "TOTAL", kind: "BONUS" },
        }, { discount: true })]} />,
    );
    // "Cantidad" aparece como header de la celda Cantidad (un <div> con
    // CSS `uppercase` y `text-muted`) — ese debe seguir. El chip del
    // precio es un TPBadge (rounded pill con clases distintas). Solo
    // contamos pills/badges; el header NO los matchea.
    // El selector busca elementos con texto exacto "Cantidad" que sean
    // TPBadge (data-tone o role específicos). Como TPBadge no tiene un
    // selector único garantizado, contamos ocurrencias del texto y
    // verificamos que sea solo 1 (el header), no 2 (header + chip).
    const matches = screen.queryAllByText(/^Cantidad$/);
    expect(matches).toHaveLength(1);
    // El único match debe ser el header (clase uppercase), no el chip.
    expect(matches[0].className).toMatch(/uppercase/);
    void container;
  });

  it('BONUS: chip "Lista" del precio SÍ se mantiene con manualDiscount (no sugiere auto reemplazable)', () => {
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          priceSource: "PRICE_LIST",
          appliedPriceListName: "Lista General",
          manualDiscount: { mode: "PERCENT", value: 15, appliesTo: "TOTAL", kind: "BONUS" },
        }, { discount: true })]} />,
    );
    // "Lista" sigue siendo info útil (origen del precio inicial) y NO sugiere
    // promo/cantidad activa → se mantiene aunque haya manual override.
    expect(screen.getByText(/^Lista$/)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Trazador del flujo X — semántica global "X = manual 0"
//
// La X de Bonificación PONE EL VALOR EN 0 como override manual explícito
// (NO restaura el automático). El motor recibe manualDiscount={value:0} y
// aplica 0 reemplazando promo/qty/cliente. Los automáticos solo vuelven
// con "Restablecer línea" o reingreso del artículo.
//
// Consecuencia: tras la X, `meta.manualDiscount = { value: 0, ... }` y
// `manualOverrides.discount` sigue true → pills/card automáticos NO
// reaparecen (hasManual sigue siendo true).
// ═══════════════════════════════════════════════════════════════════════════
describe("Trazador X de Bonificación — semántica X = manual 0", () => {
  it("Línea con promo + manualDiscount → click X → manualDiscount = { value: 0 } (manual 0 explícito)", () => {
    const spy = vi.fn();
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          // Promo aplicada en paralelo al manual (escenario reportado:
          // operador puso override sobre artículo con promo activa).
          appliedPromotionId:   "promo-1",
          appliedPromotionName: "Verano",
          promotionDiscountAmount: 20,
          manualDiscount: { mode: "PERCENT", value: 15, appliesTo: "TOTAL", kind: "BONUS" },
        }, { discount: true })]}
        applyLineOverrides={spy} />,
    );
    // La X solo aparece cuando displayValue > 0 — el TPNumber ya muestra
    // el value del manual (15) → la X está visible.
    const clearBtn = document.querySelector(
      'button[aria-label="Poner bonificación en 0"]',
    ) as HTMLButtonElement;
    expect(clearBtn).toBeTruthy();
    fireEvent.click(clearBtn);

    // El spy debe haber recibido un override manual con value=0 (NO null).
    // Eso mantiene hasManual=true → promo/qty/cliente NO se reactivan.
    expect(spy).toHaveBeenCalled();
    const [lineId, patch] = spy.mock.calls[spy.mock.calls.length - 1];
    expect(lineId).toBe("L1");
    expect(patch.manualDiscount).toMatchObject({ value: 0, mode: "PERCENT" });
    // Confirmación explícita: NO es null (que sería "restaurar automático",
    // semántica anterior). Es manual 0 explícito.
    expect(patch.manualDiscount).not.toBeNull();
  });

  it("Estado equivalente post-X (manualDiscount={value:0}) → pills automáticos NO reaparecen", () => {
    // Este test verifica el ESTADO RESULTANTE de la X aplicada por el
    // padre. Con `manualDiscount.value=0`, `hasManual` sigue siendo true
    // (porque `manualDiscount !== null`). Los pills automáticos deben
    // PERMANECER ocultos. Es el contrato semántico clave: X reemplaza el
    // automático con 0, no lo restaura.
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({
          appliedPromotionId:   "promo-1",
          appliedPromotionName: "Verano",
          promotionDiscountAmount: 20,
          // Estado post-X: manualDiscount con value=0 (override manual 0).
          manualDiscount: { mode: "PERCENT", value: 0, appliesTo: "TOTAL", kind: "BONUS" },
        }, { discount: true })]} />,
    );
    // Pills automáticos siguen ocultos (manual sigue activo aunque value=0).
    expect(screen.queryByText("Promo activa")).toBeNull();
    expect(screen.queryByText(/Desc\. x cantidad/i)).toBeNull();
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Sublabel manual con value=0 — el texto cambia a "Sin bonificación" /
  // "Sin recargo" en lugar de "Override manual · reemplaza −$X" para que
  // el operador NO sienta que hay un descuento oculto aplicándose.
  //
  // Cascada UX del sublabel cuando source === "MANUAL":
  //   · md.value === 0 → "Sin bonificación" (o "Sin recargo" si SURCHARGE).
  //   · md.value > 0 + auto teórico > 0 → "Override manual · reemplaza −$X".
  //   · md.value > 0 + sin auto teórico → "Override manual".
  // ═════════════════════════════════════════════════════════════════════════
  describe("Sublabel Bonificación manual cuando value=0", () => {
    it("md.value=0 (manual 0 explícito) + automáticos presentes → sublabel dice 'Sin bonificación' (NO 'reemplaza')", () => {
      // Caso reportado: TPNumber=0,00 y el sublabel decía
      // "Override manual · reemplaza −AR$ X" — confundía. El operador eligió
      // 0 (vía X o escribiendo 0), no hay nada que "reemplazar" como info
      // accionable.
      const { container } = render(
        <LinesEditorSection {...(baseProps as any)}
          lines={[makeLine({
            // Backend reporta automáticos activos (legacy meta).
            appliedPromotionId:   "promo-1",
            appliedPromotionName: "Verano",
            promotionDiscountAmount: 20,
            quantityDiscountAmount:  10,
            // Manual 0 explícito (estado post-X o tras escribir 0).
            manualDiscount: { mode: "PERCENT", value: 0, appliesTo: "TOTAL", kind: "BONUS" },
          }, { discount: true })]} />,
      );
      const subLabel = container.querySelector(
        '[data-tp-bonif-effective-label="true"]',
      );
      expect(subLabel).toBeTruthy();
      expect(subLabel?.textContent ?? "").toMatch(/Sin bonificación/i);
      // NO debe decir "reemplaza" ni mostrar el monto automático teórico.
      expect(subLabel?.textContent ?? "").not.toMatch(/reemplaza/i);
      expect(subLabel?.textContent ?? "").not.toMatch(/Override manual/i);
    });

    it("md.value=0 + kind=SURCHARGE → sublabel dice 'Sin recargo'", () => {
      const { container } = render(
        <LinesEditorSection {...(baseProps as any)}
          lines={[makeLine({
            quantityDiscountAmount: 15,
            manualDiscount: { mode: "PERCENT", value: 0, appliesTo: "TOTAL", kind: "SURCHARGE" },
          }, { discount: true })]} />,
      );
      const subLabel = container.querySelector(
        '[data-tp-bonif-effective-label="true"]',
      );
      expect(subLabel?.textContent ?? "").toMatch(/Sin recargo/i);
      expect(subLabel?.textContent ?? "").not.toMatch(/reemplaza/i);
    });

    it("md.value=0 en modo AMOUNT también muestra 'Sin bonificación'", () => {
      // No es solo un caso del modo %: también en modo monto fijo, value=0
      // significa "sin bonificación".
      const { container } = render(
        <LinesEditorSection {...(baseProps as any)}
          lines={[makeLine({
            quantityDiscountAmount: 5,
            manualDiscount: { mode: "AMOUNT", value: 0, appliesTo: "TOTAL", kind: "BONUS" },
          }, { discount: true })]} />,
      );
      const subLabel = container.querySelector(
        '[data-tp-bonif-effective-label="true"]',
      );
      expect(subLabel?.textContent ?? "").toMatch(/Sin bonificación/i);
    });

    it("T9 — md.value > 0 + auto teórico → muestra pill 'Manual' (sin 'Override' ni 'reemplaza')", () => {
      // T9 — los textos técnicos "Override manual · reemplaza −$X" fueron
      // reemplazados por un chip TPBadge "Manual" sutil. El monto reemplazado
      // ya no se duplica en el sublabel (vive en el card colapsable).
      const { container } = render(
        <LinesEditorSection {...(baseProps as any)}
          lines={[makeLine({
            quantityDiscountAmount: 10,
            promotionDiscountAmount: 5,
            manualDiscount: { mode: "PERCENT", value: 15, appliesTo: "TOTAL", kind: "BONUS" },
          }, { discount: true })]} />,
      );
      const subLabel = container.querySelector(
        '[data-tp-bonif-effective-label="true"]',
      );
      expect(subLabel?.textContent ?? "").toMatch(/Manual/);
      expect(subLabel?.textContent ?? "").not.toMatch(/Override/i);
      expect(subLabel?.textContent ?? "").not.toMatch(/reemplaza/i);
      expect(subLabel?.textContent ?? "").not.toMatch(/Sin bonificación/i);
    });

    it("T9 — md.value > 0 + sin auto teórico → pill 'Manual' (sin texto técnico)", () => {
      const { container } = render(
        <LinesEditorSection {...(baseProps as any)}
          lines={[makeLine({
            // SIN qty/promo/cliente activos.
            manualDiscount: { mode: "PERCENT", value: 15, appliesTo: "TOTAL", kind: "BONUS" },
          }, { discount: true })]} />,
      );
      const subLabel = container.querySelector(
        '[data-tp-bonif-effective-label="true"]',
      );
      expect(subLabel?.textContent ?? "").toMatch(/Manual/);
      expect(subLabel?.textContent ?? "").not.toMatch(/Override/i);
      expect(subLabel?.textContent ?? "").not.toMatch(/reemplaza/i);
      expect(subLabel?.textContent ?? "").not.toMatch(/Sin bonificación/i);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Manual + cambio de qty — "manual siempre manda aunque qty cambie"
  //
  // Cuando manualDiscount está activo y la cantidad cambia (incluido el caso
  // donde la nueva qty entra/sale de un tramo de descuento por cantidad),
  // el sistema NO debe reactivar automáticos:
  //   · pills "Promo activa" / "Desc. x cantidad" siguen ocultos.
  //   · card sección "Ajustes aplicados por el sistema" sigue oculta.
  //   · TPNumber sigue mostrando md.value.
  //
  // PERO el sub-label "Override manual · reemplaza −$X" SÍ se actualiza con
  // la nueva qty: refleja el monto AUTOMÁTICO TEÓRICO que el motor expone
  // como metadata (qtyDiscountAmount/promoDiscountAmount son per-unit en el
  // meta, multiplicados × qty en el sublabel; customerDiscountAmount viene
  // por línea entera). Eso es passthrough del motor, no recálculo.
  // ═════════════════════════════════════════════════════════════════════════
  describe("Manual + cambio de qty — pills/card automáticos NO reaparecen", () => {
    it("manualDiscount + qty entra en tramo descuento → pills siguen ocultos (qty=2)", () => {
      render(
        <LinesEditorSection {...(baseProps as any)}
          lines={[makeLine({
            // Backend reporta qty discount activo (legacy meta) → en
            // automático sin manual, pill "Desc. x cantidad" aparecería.
            quantityDiscountAmount: 10,
            // Manual override del operador → pills DEBEN ocultarse.
            manualDiscount: { mode: "PERCENT", value: 15, appliesTo: "TOTAL", kind: "BONUS" },
          }, { discount: true }, { quantity: 2 })]} />,
      );
      expect(screen.queryByText(/Desc\. x cantidad/i)).toBeNull();
      expect(screen.queryByText("Promo activa")).toBeNull();
    });

    it("misma línea con qty=10 (re-render simulando preview con tramo distinto) → pills siguen ocultos", () => {
      // Re-render con qty mayor: el motor expone qtyDiscountAmount distinto
      // (lo que correspondería al tramo de 10 unidades) pero el manual
      // sigue activo. Pills NO reaparecen.
      render(
        <LinesEditorSection {...(baseProps as any)}
          lines={[makeLine({
            // En tramo distinto el motor podría exponer un descuento mayor.
            quantityDiscountAmount: 25,
            manualDiscount: { mode: "PERCENT", value: 15, appliesTo: "TOTAL", kind: "BONUS" },
          }, { discount: true }, { quantity: 10 })]} />,
      );
      expect(screen.queryByText(/Desc\. x cantidad/i)).toBeNull();
      expect(screen.queryByText("Promo activa")).toBeNull();
    });

    it("manual 0 (md.value=0) + qty cambia → automáticos siguen ocultos", () => {
      // Con la semántica global X=manual 0, escribir 0 (o tocar X) deja
      // manualDiscount={value:0}. El operador puede cambiar qty muchas
      // veces y los automáticos NO reaparecen (manualDiscount !== null
      // → hasManual=true → pills ocultos).
      render(
        <LinesEditorSection {...(baseProps as any)}
          lines={[makeLine({
            quantityDiscountAmount: 15,
            appliedPromotionId:     "promo-1",
            appliedPromotionName:   "Verano",
            promotionDiscountAmount: 5,
            manualDiscount: { mode: "PERCENT", value: 0, appliesTo: "TOTAL", kind: "BONUS" },
          }, { discount: true }, { quantity: 7 })]} />,
      );
      expect(screen.queryByText(/Desc\. x cantidad/i)).toBeNull();
      expect(screen.queryByText("Promo activa")).toBeNull();
    });

    it("SIN manual + qty con descuento por cantidad → pill 'Desc. x cantidad' SÍ aparece (control)", () => {
      // Sin manual override, en automático puro, el pill "Desc. x cantidad"
      // debe mostrarse cuando quantityDiscountAmount > 0. Confirma que el
      // guard de los pills es justo `&& !manualDiscount`, no algo más
      // amplio que los ocultara siempre.
      render(
        <LinesEditorSection {...(baseProps as any)}
          lines={[makeLine({
            quantityDiscountAmount: 10,
            // NO hay manualDiscount.
          })]} />,
      );
      expect(screen.getByText(/Desc\. x cantidad/i)).toBeInTheDocument();
    });

    it("T9 — sub-label muestra pill 'Manual' al cambiar qty (sin texto 'reemplaza −$X')", () => {
      // T9 — eliminamos el monto "reemplaza −$X" del sublabel. El pill
      // "Manual" se renderiza estable mientras el manual está activo,
      // sin importar la qty. El monto reemplazado vive en el card
      // colapsable de detalle.
      const { rerender, container } = render(
        <LinesEditorSection {...(baseProps as any)}
          lines={[makeLine({
            quantityDiscountAmount: 10,
            manualDiscount: { mode: "PERCENT", value: 15, appliesTo: "TOTAL", kind: "BONUS" },
          }, { discount: true }, { quantity: 2 })]} />,
      );
      const findSubLabel = () => Array.from(
        container.querySelectorAll('[data-tp-bonif-effective-label="true"]'),
      )[0];
      const qty2Text = findSubLabel()?.textContent ?? "";
      expect(qty2Text).toMatch(/Manual/);
      expect(qty2Text).not.toMatch(/Override/i);
      expect(qty2Text).not.toMatch(/reemplaza/i);
      // Re-render con qty=8: el pill sigue siendo "Manual" (estable).
      rerender(
        <LinesEditorSection {...(baseProps as any)}
          lines={[makeLine({
            quantityDiscountAmount: 10,
            manualDiscount: { mode: "PERCENT", value: 15, appliesTo: "TOTAL", kind: "BONUS" },
          }, { discount: true }, { quantity: 8 })]} />,
      );
      const qty8Text = findSubLabel()?.textContent ?? "";
      expect(qty8Text).toMatch(/Manual/);
      expect(qty8Text).not.toMatch(/reemplaza/i);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // X de Cantidad — semántica DISTINTA: NO va a 0, sino al mín de venta.
  //
  // El usuario excluyó explícitamente la cantidad de la regla global
  // "X = poner 0". La X de TPQuantityField restablece la cantidad al
  // `enforcedMin` (default/min de venta), no a 0 (que sería inválido).
  // ─────────────────────────────────────────────────────────────────────────
  it("X de Cantidad NO pone 0: restablece al mín de venta del artículo", () => {
    // Construimos línea con cantidad > 1 para que la X de Cantidad sea
    // visible (solo aparece si quantity !== enforcedMin). El handler del
    // editor llama `updateLine(id, { quantity: enforcedMin })` — sin un
    // mock de updateLine no podemos espiar; verificamos comportamiento
    // estructural: la X de Cantidad NO usa aria-label "Poner ... en 0".
    // T16 — Fixture coherente: con quantity=5 y unitPrice=basePrice=100,
    // el subtotal del motor sería 500 (no hay descuento). Si dejamos el
    // 200 hardcoded el nuevo branch "neto efectivo" lo interpretaría como
    // bonificación implícita y mostraría la X de Bonificación.
    render(
      <LinesEditorSection {...(baseProps as any)}
        lines={[makeLine({}, undefined, { quantity: 5, subtotal: 500, lineTotal: 500, lineTotalWithTax: 500 })]} />,
    );
    // La X de la celda Cantidad usa aria-label "Limpiar valor" (default
    // del TPNumberInput; el TPQuantityField no pasa clearAriaLabel
    // semántico). NUNCA debe llevar el label de las X de Bonif/Impuestos.
    const cantidadXNuevoLabel = document.querySelector('button[aria-label="Poner bonificación en 0"]');
    // No hay X de Bonificación en esta línea (sin override) → debe ser null.
    expect(cantidadXNuevoLabel).toBeNull();
    // Pero SÍ hay una X de Cantidad genérica con "Limpiar valor" (label
    // default del TPNumberInput cuando no se pasa clearAriaLabel custom).
    const cantidadXDefault = document.querySelector('button[aria-label="Limpiar valor"]');
    expect(cantidadXDefault).toBeTruthy();
  });
});
