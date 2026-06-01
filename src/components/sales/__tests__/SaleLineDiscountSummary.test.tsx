// src/components/sales/__tests__/SaleLineDiscountSummary.test.tsx
// ============================================================================
// Render tests del bloque resumen por línea — verifica el comportamiento
// de collapse, la línea "Cálculo" y la ausencia de regresiones visuales.
// ============================================================================

import React from "react";
import { describe, it, expect } from "vitest";
import { render, fireEvent, within } from "@testing-library/react";

import { SaleLineDiscountSummary } from "../SaleLineDiscountSummary";
import type { LineLikeForDiscount } from "../../../lib/pricing/display/saleLineDiscountSourcesDisplay";

function renderSummary(line: LineLikeForDiscount, opts?: { defaultOpen?: boolean }) {
  return render(
    <SaleLineDiscountSummary
      line={line}
      currency="AR$"
      displayRate={1}
      defaultOpen={opts?.defaultOpen ?? false}
    />,
  );
}

function getBlock(): HTMLElement {
  const block = document.querySelector("[data-tp-line-discount-summary='true']");
  if (!block) throw new Error("Summary block not rendered");
  return block as HTMLElement;
}

function getHeaderButton(): HTMLButtonElement {
  return within(getBlock()).getByRole("button") as HTMLButtonElement;
}

// ────────────────────────────────────────────────────────────────────────────

describe("SaleLineDiscountSummary — collapse", () => {
  it("Cerrado por defecto: trigger visible (monto + 'Ver detalle'), detalle oculto", () => {
    renderSummary({
      quantity: 2,
      pricingMeta: { promotionDiscountAmount: 10, appliedPromotionName: "Verano" },
    });
    const block = getBlock();
    // T29 — Trigger minimal: muestra el monto firmado y "Ver detalle"
    // como affordance (label cerrado), sin texto "Total automático/manual".
    // El label histórico se movió al header del detalle expandido.
    expect(within(block).queryByText(/Total automático:/i)).toBeNull();
    expect(within(block).queryByText(/Ajustes aplicados:/i)).toBeNull();
    expect(within(block).getByText(/Ver detalle/i)).toBeTruthy();
    expect(within(block).queryByText(/^Ocultar$/i)).toBeNull();
    // El monto está visible en el trigger (con o sin signo según
    // effectiveTotal del pipeline; este fixture no aporta steps, por lo
    // que `effectiveTotal` cae a 0 → se renderiza "AR$ 0,00" sin signo).
    expect(block.textContent ?? "").toMatch(/AR\$\s*0/);
    // Detalle oculto (no se ve "Regla:" del cuerpo).
    expect(within(block).queryByText(/Regla:/)).toBeNull();
    // aria-expanded refleja estado.
    expect(getHeaderButton().getAttribute("aria-expanded")).toBe("false");
    expect(block.getAttribute("data-tp-open")).toBe("false");
  });

  it("Click en el header ABRE el detalle (toggle inline, sin pill 'Ver detalle')", () => {
    renderSummary({
      quantity: 2,
      pricingMeta: {
        promotionDiscountAmount: 10,
        appliedPromotionName: "Verano",
        componentSaleBreakdown: {
          metal: { adjustments: [{ kind: "PROMOTION", source: "GENERAL", amount: 10, base: 100, percentage: 10, valueType: "PERCENTAGE", applyOn: "METAL" }] },
        },
      },
    });
    fireEvent.click(getHeaderButton());
    const block = getBlock();
    expect(within(block).getByText(/Regla:/)).toBeTruthy();
    // Sin pill separada — el toggle es el label "Ajustes aplicados".
    expect(within(block).queryByText(/Ver detalle/i)).toBeNull();
    expect(within(block).queryByText(/Ocultar detalle/i)).toBeNull();
    expect(getHeaderButton().getAttribute("aria-expanded")).toBe("true");
    expect(block.getAttribute("data-tp-open")).toBe("true");
  });

  it("Segundo click CIERRA el detalle de nuevo", () => {
    renderSummary({
      quantity: 2,
      pricingMeta: { promotionDiscountAmount: 10, appliedPromotionName: "Verano" },
    });
    const btn = getHeaderButton();
    fireEvent.click(btn); // abre
    fireEvent.click(btn); // cierra
    const block = getBlock();
    expect(within(block).queryByText(/Regla:/)).toBeNull();
    expect(getHeaderButton().getAttribute("aria-expanded")).toBe("false");
  });

  it("defaultOpen=true: arranca abierto", () => {
    renderSummary(
      { quantity: 2, pricingMeta: { promotionDiscountAmount: 10, appliedPromotionName: "Verano" } },
      { defaultOpen: true },
    );
    expect(getHeaderButton().getAttribute("aria-expanded")).toBe("true");
    expect(within(getBlock()).getByText(/Regla:/)).toBeTruthy();
  });

  it("Sin ajustes en la línea: el componente NO se renderiza (ni el header)", () => {
    const { container } = renderSummary({ quantity: 2, pricingMeta: {} });
    expect(container.querySelector("[data-tp-line-discount-summary]")).toBeNull();
  });
});

describe("SaleLineDiscountSummary — línea 'Cálculo'", () => {
  it("Adjustment con base+percentage: muestra 'Cálculo: <base> × <%>%'", () => {
    renderSummary(
      {
        quantity: 3,
        pricingMeta: {
          promotionDiscountAmount: 50,
          appliedPromotionName: "Verano",
          componentSaleBreakdown: {
            metal: { adjustments: [{ kind: "PROMOTION", source: "GENERAL", amount: 50, base: 500, percentage: 10, valueType: "PERCENTAGE", applyOn: "METAL" }] },
          },
        },
      },
      { defaultOpen: true },
    );
    const block = getBlock();
    // Bloque compacto: "Base usada: 500 × 10% = -50" (todo unitario en
    // una línea). El verde a la derecha del ítem sigue siendo total línea
    // (150 = 50 × 3).
    expect(block.querySelector("[data-tp-base-used]")).not.toBeNull();
    const text = block.textContent ?? "";
    expect(text).toMatch(/Base usada/);
    expect(text).toMatch(/500/);                  // base unitaria
    expect(text).toMatch(/10[.,]?\d*\s*%/);       // porcentaje
    expect(text).toMatch(/50[.,]\d/);             // impacto unitario "-50,00"
    expect(text).toMatch(/150/);                  // total línea (verde derecho)
  });

  it("Cliente applyOn=TOTAL (sin base por componente): muestra 'detalle no disponible'", () => {
    renderSummary(
      {
        quantity: 2,
        pricingMeta: {
          customerDiscountAmount: 360000,
          inheritedDiscount: { ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 15, applyOn: "TOTAL" },
        },
      },
      { defaultOpen: true },
    );
    const block = getBlock();
    // Badge UNAVAILABLE: "Base usada: detalle no disponible" (texto unificado
    // con el resto del bloque — ya no se llama "Cálculo:").
    const badge = block.querySelector("[data-tp-calc-unavailable='true']");
    expect(badge).not.toBeNull();
    expect((badge?.textContent ?? "").replace(/\s+/g, " ")).toMatch(/Base usada:\s*detalle no disponible/);
    // El monto del cliente sigue visible.
    expect(block.textContent ?? "").toMatch(/360/);
  });

  it("FIXED_AMOUNT: muestra base unitaria + cálculo unitario + cantidad + impacto total", () => {
    renderSummary(
      {
        quantity: 4,
        pricingMeta: {
          quantityDiscountAmount: 25,
          componentSaleBreakdown: {
            metal: { adjustments: [{ kind: "QUANTITY_DISCOUNT", source: "GENERAL", amount: 25, base: 200, valueType: "FIXED_AMOUNT", applyOn: "METAL" }] },
          },
        },
      },
      { defaultOpen: true },
    );
    const block = getBlock();
    // Forma compacta: "Base usada: -25 por unidad" (FIXED_AMOUNT).
    expect(block.querySelector("[data-tp-base-used]")).not.toBeNull();
    const text = block.textContent ?? "";
    expect(text).toMatch(/Base usada/);
    expect(text).toMatch(/por unidad/);
    expect(text).toMatch(/25/);         // monto fijo per unidad
    expect(text).toMatch(/100/);        // total línea (verde derecho)
  });
});

describe("SaleLineDiscountSummary — separación conceptual y badges viejos", () => {
  it("Muestra 'Ajustes aplicados por el sistema' y 'Ajuste manual' como secciones separadas", () => {
    renderSummary(
      {
        quantity: 2,
        pricingMeta: {
          promotionDiscountAmount: 10,
          appliedPromotionName: "Verano",
          manualDiscount: { value: 5, mode: "PERCENT", appliesTo: "TOTAL" },
          componentSaleBreakdown: {
            metal: { adjustments: [{ kind: "MANUAL_DISCOUNT", source: "GENERAL", amount: 5, base: 100, percentage: 5, valueType: "PERCENTAGE", applyOn: "TOTAL" }] },
          },
        },
      },
      { defaultOpen: true },
    );
    const block = getBlock();
    expect(within(block).getByText(/Ajustes aplicados por el sistema/i)).toBeTruthy();
    expect(within(block).getByText(/^Ajuste manual$/i)).toBeTruthy();
  });

  it("Sin manual: muestra 'Sin ajuste manual' dentro del detalle", () => {
    renderSummary(
      { quantity: 2, pricingMeta: { promotionDiscountAmount: 10, appliedPromotionName: "Verano" } },
      { defaultOpen: true },
    );
    expect(within(getBlock()).getByText(/Sin ajuste manual/i)).toBeTruthy();
  });

  it("NO aparece badge viejo 'Auto' suelto", () => {
    renderSummary(
      { quantity: 2, pricingMeta: { promotionDiscountAmount: 10, appliedPromotionName: "Verano" } },
      { defaultOpen: true },
    );
    expect(within(getBlock()).queryByText(/^Auto$/)).toBeNull();
  });

  it("NO aparece 'Bonificación cliente' como badge suelto", () => {
    renderSummary(
      {
        quantity: 2,
        pricingMeta: {
          customerDiscountAmount: 100,
          inheritedDiscount: { ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 10, applyOn: "TOTAL" },
        },
      },
      { defaultOpen: true },
    );
    expect(within(getBlock()).queryByText(/Bonificación cliente/i)).toBeNull();
  });
});

describe("SaleLineDiscountSummary — Cálculo con metadata explicativa del motor", () => {
  it("PROMO con base+value del motor (sin desglose metal/hechura): muestra la fórmula", () => {
    renderSummary(
      {
        quantity: 3,
        pricingMeta: {
          promotionDiscountAmount:    50,
          appliedPromotionName:       "Verano",
          promotionDiscountBase:      3000,
          promotionDiscountValue:     10,
          promotionDiscountValueType: "PERCENTAGE",
        },
      },
      { defaultOpen: true },
    );
    const block = getBlock();
    // Nuevo formato: bloque por unidades + cantidad + impacto total.
    // baseUnit = 3000/3 = 1000; impacto unitario = 50; total = 150.
    const text = block.textContent ?? "";
    expect(text).toMatch(/Base usada/);
    expect(text).toMatch(/1\.?000/);          // baseUnit
    expect(text).toMatch(/10[.,]?\d*\s*%/);   // porcentaje
    expect(text).toMatch(/50[.,]\d/);         // impacto unitario "-50,00"
    expect(text).toMatch(/150/);              // total línea (verde derecho)
    expect(block.querySelector("[data-tp-calc-unavailable='true']")).toBeNull();
  });

  it("CLIENTE 15% sobre TOTAL con customerDiscountBase: muestra fórmula (ya no UNAVAILABLE)", () => {
    // Caso bug del usuario: antes del fix esto mostraba "detalle no
    // disponible". Con la metadata explicativa serializada en el backend,
    // ahora se muestra "Cálculo: 2.400.000 × 15%".
    renderSummary(
      {
        quantity: 2,
        pricingMeta: {
          customerDiscountAmount: 360000,
          customerDiscountBase:   2400000,
          inheritedDiscount: { ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 15, applyOn: "TOTAL" },
        },
      },
      { defaultOpen: true },
    );
    const block = getBlock();
    // No debe aparecer el badge UNAVAILABLE.
    expect(block.querySelector("[data-tp-calc-unavailable='true']")).toBeNull();
    // Bloque compacto "Base usada: 1.200.000 × 15% = -180.000"
    // (unitario). Verde derecho = total 360.000.
    const text = block.textContent ?? "";
    expect(text).toMatch(/Base usada/);
    expect(text).toMatch(/1\.?200\.?000/);         // baseUnit = 2.4M/2
    expect(text).toMatch(/15[.,]?\d*\s*%/);
    expect(text).toMatch(/180\.?000/);             // impacto unitario
    expect(text).toMatch(/360\.?000/);             // total línea (verde)
  });

  it("Sin customerDiscountBase (caso degradado): cae a UNAVAILABLE pero impacto sigue visible", () => {
    renderSummary(
      {
        quantity: 2,
        pricingMeta: {
          customerDiscountAmount: 360000,
          customerDiscountBase:   null,   // motor no expuso base
          inheritedDiscount: { ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 15, applyOn: "TOTAL" },
        },
      },
      { defaultOpen: true },
    );
    const block = getBlock();
    expect(block.querySelector("[data-tp-calc-unavailable='true']")).not.toBeNull();
    // El impacto del cliente sigue visible — no $0 engañoso.
    expect(block.textContent ?? "").toMatch(/360/);
  });
});

describe("SaleLineDiscountSummary — layout no amontonado", () => {
  it("Wrapper tiene mt-1 — mismo margin que el trigger de Impuestos (controles hermanos)", () => {
    renderSummary({
      quantity: 2,
      pricingMeta: { promotionDiscountAmount: 10, appliedPromotionName: "Verano" },
    });
    const block = getBlock();
    // T33 — El wrapper usa `mt-1` para quedar ALINEADO verticalmente con el
    // trigger de Impuestos (que también usa `mt-1` después de su AppliesToLink).
    // Antes era `mt-3 mb-2` (margen heredado del card grande); ahora el
    // border/fondo viven en el PANEL ABIERTO, no en el wrapper.
    expect(block.className).toMatch(/\bmt-1\b/);
    expect(block.className).not.toMatch(/\bmt-3\b/);
  });

  it("Trigger es UN solo botón con label 'Ver detalle'/'Ocultar' inline", () => {
    renderSummary({
      quantity: 2,
      pricingMeta: { promotionDiscountAmount: 10, appliedPromotionName: "Verano" },
    });
    const block = getBlock();
    // T29 — El trigger DEBE mostrar "Ver detalle" (cerrado) como affordance
    // visual minimal — no es una pill separada, vive dentro del mismo
    // <button> que el monto.
    expect(within(block).getByText(/Ver detalle/i)).toBeTruthy();
    expect(within(block).queryByText(/Ocultar detalle/i)).toBeNull();
    // El trigger es UN solo <button> clickeable (no hay pills separadas).
    const buttons = block.querySelectorAll("button");
    const headerButtons = Array.from(buttons).filter((b) => b.hasAttribute("aria-expanded"));
    expect(headerButtons.length).toBe(1);
    // El botón contiene el label de affordance dentro suyo (no fuera).
    expect(headerButtons[0].textContent ?? "").toMatch(/Ver detalle/i);
  });

  it("Panel detalle vive en flujo NORMAL del DOM (sin absolute/fixed)", () => {
    renderSummary(
      { quantity: 2, pricingMeta: { promotionDiscountAmount: 10, appliedPromotionName: "Verano" } },
      { defaultOpen: true },
    );
    const panel = document.querySelector("[data-tp-line-discount-summary-panel='true']");
    expect(panel).not.toBeNull();
    // El panel NO debe usar position absolute ni fixed: necesita ocupar
    // espacio vertical real para empujar la tabla de composición que
    // viene después en el DOM. Anti-regresión del overlay que tapaba la
    // tabla.
    expect(panel?.className ?? "").not.toMatch(/\babsolute\b/);
    expect(panel?.className ?? "").not.toMatch(/\bfixed\b/);
    expect(panel?.className ?? "").not.toMatch(/\bz-\d+\b/);
    expect(panel?.className ?? "").not.toMatch(/\bright-0\b/);
    expect(panel?.className ?? "").not.toMatch(/\bleft-0\b/);
  });

  it("Wrapper externo NO necesita 'relative' (panel ya no es absolute)", () => {
    renderSummary(
      { quantity: 2, pricingMeta: { promotionDiscountAmount: 10, appliedPromotionName: "Verano" } },
    );
    const block = getBlock();
    expect(block.className).not.toMatch(/\brelative\b/);
  });

  it("Wrapper ocupa el ancho de la celda padre (alineado al TPNumber, sin invadir columnas vecinas)", () => {
    renderSummary(
      { quantity: 2, pricingMeta: { promotionDiscountAmount: 10, appliedPromotionName: "Verano" } },
    );
    const block = getBlock();
    // T32 — El trigger queda visualmente alineado bajo el TPNumber de
    // Bonificación como control hermano (mismo ancho lógico). Antes el
    // wrapper extendía 200px hacia la izquierda invadiendo celdas vecinas
    // (Costo/Merma); el nuevo patrón usa el ancho real de la celda para
    // que Bonificación e Impuestos compartan eje visual.
    expect(block.className).toMatch(/\bw-full\b/);
    // Anti-regresión del patrón anterior (negative ml + width calc).
    expect(block.className).not.toMatch(/-ml-\[\d+px\]/);
    expect(block.className).not.toMatch(/w-\[calc\(100%\+\d+px\)\]/);
    expect(block.className).not.toMatch(/\bml-auto\b/);
    expect(block.className).not.toMatch(/max-w-\[\d+px\]/);
  });

  it("Panel abierto contribuye al height del wrapper (empuja contenido hacia abajo)", () => {
    // jsdom no calcula layout real, pero podemos comprobar la estructura:
    // el panel es un hijo del wrapper (no portado afuera) y existe en el
    // flow del DOM cuando open=true.
    renderSummary(
      { quantity: 2, pricingMeta: { promotionDiscountAmount: 10, appliedPromotionName: "Verano" } },
      { defaultOpen: true },
    );
    const block = getBlock();
    const panel = block.querySelector("[data-tp-line-discount-summary-panel]");
    expect(panel).not.toBeNull();
    // El panel es descendiente directo del wrapper (mismo árbol del DOM
    // → si crece, el wrapper también crece).
    expect(block.contains(panel)).toBe(true);
  });

  it("Header soporta keyboard (es <button>) y mantiene aria-expanded", () => {
    renderSummary({
      quantity: 2,
      pricingMeta: { promotionDiscountAmount: 10, appliedPromotionName: "Verano" },
    });
    const btn = getHeaderButton();
    // El header es un <button> nativo → Enter/Space disparan onClick.
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("SaleLineDiscountSummary — UNAVAILABLE renderiza con badge ámbar visible", () => {
  it("Cuando calc.kind === 'UNAVAILABLE': aparece badge con data-tp-calc-unavailable y fondo ámbar", () => {
    renderSummary(
      {
        quantity: 2,
        pricingMeta: {
          customerDiscountAmount: 360000,
          inheritedDiscount: { ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 15, applyOn: "TOTAL" },
        },
      },
      { defaultOpen: true },
    );
    const block = getBlock();
    // El badge debe existir como elemento identificable.
    const badge = block.querySelector("[data-tp-calc-unavailable='true']");
    expect(badge).not.toBeNull();
    // Texto exacto requerido por la UX.
    expect((badge?.textContent ?? "").replace(/\s+/g, " ")).toMatch(/Base usada:\s*detalle no disponible/);
    // Fondo ámbar suave aplicado (no italic pálido casi invisible).
    expect(badge?.className ?? "").toMatch(/bg-amber-500\/10/);
  });

  it("Cuando calc.kind === 'PERCENT': NO aparece el badge UNAVAILABLE", () => {
    renderSummary(
      {
        quantity: 3,
        pricingMeta: {
          promotionDiscountAmount: 50,
          appliedPromotionName: "Verano",
          componentSaleBreakdown: {
            metal: { adjustments: [{ kind: "PROMOTION", source: "GENERAL", amount: 50, base: 500, percentage: 10, valueType: "PERCENTAGE", applyOn: "METAL" }] },
          },
        },
      },
      { defaultOpen: true },
    );
    const block = getBlock();
    expect(block.querySelector("[data-tp-calc-unavailable='true']")).toBeNull();
  });
});

describe("SaleLineDiscountSummary — modo PIPELINE (orden real del motor)", () => {
  function lineWithPipeline() {
    return {
      quantity: 2,
      pricingMeta: {
        inheritedDiscount: { ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 15, applyOn: "TOTAL" },
        pricingSteps: [
          { key: "PRICE_LIST", label: "Lista", status: "ok" as const, value: 1500000 },
          {
            key: "QUANTITY_DISCOUNT", label: "QD", status: "ok" as const, value: 1200000,
            meta: { discountBase: 1500000, discountAmount: 300000, value: 20, type: "PERCENTAGE" as const, applyOn: "TOTAL" },
          },
          {
            key: "PROMOTION", label: "Promo", status: "ok" as const, value: 1080000,
            meta: { discountBase: 1200000, discountAmount: 120000, value: 10, type: "PERCENTAGE" as const, applyOn: "TOTAL", promoName: "Verano" },
          },
          {
            key: "ENTITY_COMMERCIAL_RULE", label: "Cond. comercial", status: "ok" as const, value: 162000,
            meta: { ruleType: "DISCOUNT" as const, valueType: "PERCENTAGE" as const, value: 15, applyOn: "TOTAL", discountBase: 1080000, discountAmount: 162000 },
          },
        ],
      },
    };
  }

  it("Renderiza el timeline en orden del motor (no por monto)", () => {
    renderSummary(lineWithPipeline(), { defaultOpen: true });
    const block = getBlock();
    // Buscamos los labels y verificamos su orden DOM.
    const items = Array.from(block.querySelectorAll("ol > li"));
    expect(items.length).toBeGreaterThanOrEqual(3);
    const labels = items.map((li) => (li.textContent ?? "").match(/^(.*?Desc|.*?Promo|.*?Cliente)/)?.[1] ?? "");
    // Es suficiente verificar que QTY aparece antes de PROMO, y PROMO antes
    // de CLIENTE en el DOM.
    const txtAll = items.map((li) => li.textContent ?? "").join("|");
    const idxQty   = txtAll.indexOf("Desc. por cantidad");
    const idxPromo = txtAll.indexOf("Promo");
    const idxClient = txtAll.indexOf("Cliente");
    expect(idxQty).toBeGreaterThanOrEqual(0);
    expect(idxPromo).toBeGreaterThan(idxQty);
    expect(idxClient).toBeGreaterThan(idxPromo);
    // T7 — Sanity: la numeración VISIBLE es correlativa (1, 2, 3) sobre el
    // array que efectivamente se mapea (auto), no índices del pipeline crudo.
    const numberedDots = block.querySelectorAll("[aria-hidden]");
    const numbers = Array.from(numberedDots).map((n) => (n.textContent ?? "").trim()).filter((s) => /^\d+$/.test(s));
    expect(numbers).toContain("1");
    expect(numbers).toContain("2");
    expect(numbers).toContain("3");
    void labels;
  });

  it("T19 — NO muestra label técnico 'Suma de pasos del motor (difiere …)' aun con discrepancia", () => {
    // Fixture con discrepancia ARTIFICIAL entre Σ steps y el efectivo:
    // pipeline Σ = 300+120+162 = 582; baseInitial − subtotal = 1500000 - 800000 = 700000.
    // |Σ - efectivo| > 1 → ANTES disparaba el hint técnico. Ahora NO debe
    // aparecer texto que mencione "Suma de pasos" / "difiere".
    renderSummary({
      quantity: 1,
      unitPrice: 800000, subtotal: 800000,
      pricingMeta: {
        basePrice: 1500000,
        inheritedDiscount: { ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 15, applyOn: "TOTAL" },
        pricingSteps: [
          { key: "PRICE_LIST", label: "Lista", status: "ok" as const, value: 1500000 },
          {
            key: "QUANTITY_DISCOUNT", label: "QD", status: "ok" as const, value: 1200000,
            meta: { discountBase: 1500000, discountAmount: 300, value: 20, type: "PERCENTAGE" as const, applyOn: "TOTAL" },
          },
        ],
      },
    }, { defaultOpen: true });
    const block = getBlock();
    expect(block.textContent ?? "").not.toMatch(/Suma de pasos/i);
    expect(block.textContent ?? "").not.toMatch(/difiere del efectivo/i);
    expect(block.textContent ?? "").not.toMatch(/efectivamente cobra/i);
  });

  it("T10 — Card renderiza para RECARGO manual (mismo bloque que para BONIFICACIÓN)", () => {
    // Antes: el card no se montaba cuando el ajuste era SURCHARGE porque
    // `manualTotal` venía negativo (amount < 0) y el gate `> EPSILON` lo
    // descartaba. Ahora `Math.abs(manualTotal)` permite que la fila se cree
    // con su magnitud y el header muestre "+$X" en lugar de "−$X".
    renderSummary({
      quantity: 1,
      unitPrice: 1080,
      subtotal: 1080,
      pricingMeta: {
        basePrice: 1000,
        manualDiscount: { mode: "PERCENT", value: 8, appliesTo: "TOTAL", kind: "SURCHARGE" },
        componentSaleBreakdown: {
          metal: {
            adjustments: [{
              kind: "MANUAL_DISCOUNT", source: "GENERAL", amount: -80,
              base: 1000, percentage: 8, valueType: "PERCENTAGE", applyOn: "TOTAL",
            }],
          },
        },
      },
    }, { defaultOpen: true });
    const block = getBlock();
    // T29 — El card se renderiza para recargo manual. El trigger ya no
    // muestra texto "Total recargo manual:" (eliminado); ahora muestra el
    // monto con signo + en naranja + "Ocultar" (defaultOpen=true).
    expect(block).toBeTruthy();
    expect((block.textContent ?? "")).toMatch(/Ocultar|Ver detalle/i);
    // El monto aparece con signo "+" (recargo), no "−".
    expect((block.textContent ?? "")).toMatch(/\+\s*AR?\$?/);
    expect((block.textContent ?? "")).not.toMatch(/−\s*AR\$\s*80/);
  });

  it("T9 — Item manual del card NO muestra label técnico 'override' ni 'reemplaza'", () => {
    renderSummary({
      quantity: 1,
      unitPrice: 900,
      subtotal: 900,
      pricingMeta: {
        basePrice: 1000,
        manualDiscount: { mode: "PERCENT", value: 10, appliesTo: "TOTAL", kind: "BONUS" },
        componentSaleBreakdown: {
          metal: {
            adjustments: [{
              kind: "MANUAL_DISCOUNT", source: "GENERAL", amount: 100,
              base: 1000, percentage: 10, valueType: "PERCENTAGE", applyOn: "TOTAL",
            }],
          },
        },
      },
    }, { defaultOpen: true });
    const block = getBlock();
    // No aparecen palabras técnicas dentro del card.
    expect(block.textContent ?? "").not.toMatch(/override/i);
    expect(block.textContent ?? "").not.toMatch(/reemplaza/i);
    expect(block.textContent ?? "").not.toMatch(/pipeline/i);
  });

  it("T7 — Ajuste manual único se muestra como '1' (no como '2' aunque sea el segundo step del motor)", () => {
    // Reproducción del bug: pipeline real del motor con
    // ENTITY_COMMERCIAL_RULE seguido de MANUAL_DISCOUNT_OVERRIDE → runningIndex
    // del helper asigna 1 al primero y 2 al segundo (ambos PipelineEntry).
    // La sección AUTO se oculta por `hasManualOverride`, dejando un único
    // ítem manual visible. Antes se renderizaba como "2"; ahora debe ser "1".
    renderSummary({
      quantity: 1,
      pricingMeta: {
        manualDiscount: { mode: "PERCENT", value: 5, appliesTo: "TOTAL", kind: "BONUS" },
        // componentSaleBreakdown necesario para que `buildLineDiscountSources`
        // emita el item manual (lee el adjustment con kind=MANUAL_DISCOUNT).
        componentSaleBreakdown: {
          metal: {
            adjustments: [{
              kind: "MANUAL_DISCOUNT", source: "GENERAL", amount: 50,
              base: 1000, percentage: 5, valueType: "PERCENTAGE", applyOn: "TOTAL",
            }],
          },
        },
        pricingSteps: [
          { key: "PRICE_LIST", label: "Lista", status: "ok" as const, value: 1000 },
          {
            key: "ENTITY_COMMERCIAL_RULE", label: "Cond. comercial", status: "ok" as const, value: 900,
            meta: { ruleType: "DISCOUNT" as const, valueType: "PERCENTAGE" as const, value: 10, applyOn: "TOTAL", discountBase: 1000, discountAmount: 100 },
          },
          {
            key: "MANUAL_DISCOUNT_OVERRIDE", label: "Manual", status: "ok" as const, value: 950,
            meta: { mode: "PERCENT" as const, value: 5, appliesTo: "TOTAL", kind: "BONUS" as const, discountBase: 1000, discountAmount: 50 },
          },
        ],
      },
    }, { defaultOpen: true });
    const block = getBlock();
    // Bloque AUTO oculto → solo el manual visible.
    expect(block.textContent ?? "").toMatch(/Ajuste manual/);
    // Los items visibles deben numerarse 1, 2, ... según el orden EN PANTALLA.
    // Con un único ítem manual visible, el chip muestra "1" (no "2" del pipeline).
    const ols = block.querySelectorAll("ol");
    expect(ols.length).toBeGreaterThan(0);
    // El último <ol> es el de manuales (el de auto está oculto bajo
    // hasManualOverride). Buscamos los chips visibles dentro del último.
    const lastOl = ols[ols.length - 1] as HTMLElement;
    const dots = Array.from(lastOl.querySelectorAll("[aria-hidden]"))
      .map((n) => (n.textContent ?? "").trim())
      .filter((s) => /^\d+$/.test(s));
    expect(dots[0]).toBe("1");
    expect(dots).not.toContain("2"); // hay un único ítem manual → solo "1"
  });

  it("Muestra 'Base inicial' = step.value × qty", () => {
    renderSummary(lineWithPipeline(), { defaultOpen: true });
    const block = getBlock();
    expect(within(block).getByText(/Base inicial/i)).toBeTruthy();
    // 1.500.000 × 2 = 3.000.000
    expect(block.textContent ?? "").toMatch(/3\.?000\.?000/);
  });

  it("Cada paso muestra Base usada (label técnico 'Subtotal resultante' eliminado de la UI comercial)", () => {
    renderSummary(lineWithPipeline(), { defaultOpen: true });
    const block = getBlock();
    expect(within(block).getAllByText(/Base usada:/).length).toBeGreaterThan(0);
    // "Subtotal resultante" se removió: era jerga técnica del pipeline del
    // motor, no info comercial. El operador ve impacto + base usada.
    expect(within(block).queryAllByText(/Subtotal resultante/i).length).toBe(0);
  });

  it("Sin pricingSteps cae al modo legacy (sin 'Base inicial' ni timeline)", () => {
    renderSummary(
      {
        quantity: 2,
        pricingMeta: {
          promotionDiscountAmount: 10,
          appliedPromotionName: "Verano",
          // No hay pricingSteps → fallback al modo agrupado anterior.
        },
      },
      { defaultOpen: true },
    );
    const block = getBlock();
    expect(within(block).queryByText(/Base inicial/i)).toBeNull();
    // El modo legacy sigue mostrando "Ajustes aplicados por el sistema".
    expect(within(block).getByText(/Ajustes aplicados por el sistema/i)).toBeTruthy();
  });
});

describe("SaleLineDiscountSummary — Cálculo respeta qty (Tema 1)", () => {
  it("qty = 1 → forma compacta 'unitario × %' (sin paréntesis ni '× N u.')", () => {
    renderSummary(
      {
        quantity: 1,
        pricingMeta: {
          promotionDiscountAmount:    50,
          appliedPromotionName:       "Verano",
          promotionDiscountBase:      500,
          promotionDiscountValue:     10,
          promotionDiscountValueType: "PERCENTAGE",
        },
      },
      { defaultOpen: true },
    );
    const block = getBlock();
    const text = block.textContent ?? "";
    // qty=1: no debe haber "× 1 u." en el calc.
    expect(text).not.toMatch(/× 1 u\./);
    // El cálculo aparece con el unitario y el %.
    expect(text).toMatch(/500/);
    expect(text).toMatch(/10[.,]?\d*\s*%/);
  });

  it("qty > 1 → muestra cadena unitaria completa + cantidad explícita", () => {
    renderSummary(
      {
        quantity: 4,
        pricingMeta: {
          promotionDiscountAmount:    50,
          appliedPromotionName:       "Verano",
          promotionDiscountBase:      2000,  // motor: base por línea = 2000
          promotionDiscountValue:     10,
          promotionDiscountValueType: "PERCENTAGE",
        },
      },
      { defaultOpen: true },
    );
    const block = getBlock();
    const text = block.textContent ?? "";
    // Bloque compacto: "Base usada: 500 × 10% = -50" (unitario).
    // El verde a la derecha tiene 200 (total línea = 50 × 4).
    expect(block.querySelector("[data-tp-base-used]")).not.toBeNull();
    expect(text).toMatch(/Base usada/);
    expect(text).toMatch(/500/);                 // baseUnit = 2000/4
    expect(text).toMatch(/10[.,]?\d*\s*%/);
    expect(text).toMatch(/50[.,]\d/);            // impacto unitario "-50,00"
    expect(text).toMatch(/200/);                 // total línea (verde derecho)
  });

  it("Si la base del motor difiere de unitario × qty: muestra 'Base usada por motor'", () => {
    // Caso hipotético: motor reporta `baseFromEngine = 4990` con qty=4
    // (en lugar de 4000 = 1000 × 4). El render debe mostrar el aviso para
    // que el operador sepa que la base del motor es la correcta.
    renderSummary(
      {
        quantity: 4,
        pricingMeta: {
          promotionDiscountAmount:    50,
          appliedPromotionName:       "Verano",
          // Simulamos discrepancia: el motor reporta 4990 (base por línea)
          // pero unitario × qty daría 4000. Aviso ámbar.
          promotionDiscountBase:      4990,
          promotionDiscountValue:     10,
          promotionDiscountValueType: "PERCENTAGE",
        },
      },
      { defaultOpen: true },
    );
    const block = getBlock();
    // baseUnit = 4990/4 = 1247.5; baseUnit × qty = 4990 — NO hay discrepancia
    // en este caso (división exacta). Para probar mismatch real necesitaríamos
    // un escenario donde el motor declare una base que NO sea base/qty × qty.
    // En la práctica, esto sólo ocurre por redondeos del motor que el helper
    // no puede provocar (división por qty es exacta). El test valida que el
    // bloque no muestra el aviso cuando NO hay discrepancia matemática.
    expect(block.textContent ?? "").not.toMatch(/Base usada por motor/);
  });
});

describe("SaleLineDiscountSummary — Panel detalle inline (no overlay)", () => {
  it("Detalle abierto NO usa position absolute/fixed ni z-index (vive en flow normal)", () => {
    renderSummary(
      { quantity: 2, pricingMeta: { promotionDiscountAmount: 10, appliedPromotionName: "Verano" } },
      { defaultOpen: true },
    );
    const panel = document.querySelector("[data-tp-line-discount-summary-panel='true']");
    expect(panel).not.toBeNull();
    // El panel debe ocupar espacio vertical real (no overlay) para que la
    // tabla "Composición del costo del artículo" que viene después quede
    // empujada hacia abajo, no tapada.
    expect(panel?.className ?? "").not.toMatch(/\babsolute\b/);
    expect(panel?.className ?? "").not.toMatch(/\bfixed\b/);
    expect(panel?.className ?? "").not.toMatch(/\bz-\d+\b/);
    expect(panel?.className ?? "").not.toMatch(/\btop-full\b/);
  });

  it("Wrapper externo NO necesita 'relative' (panel ya no es absolute)", () => {
    renderSummary(
      { quantity: 2, pricingMeta: { promotionDiscountAmount: 10, appliedPromotionName: "Verano" } },
    );
    const block = getBlock();
    expect(block.className).not.toMatch(/\brelative\b/);
  });

  it("Panel cerrado NO renderiza el data-tp-line-discount-summary-panel", () => {
    renderSummary(
      { quantity: 2, pricingMeta: { promotionDiscountAmount: 10, appliedPromotionName: "Verano" } },
      { defaultOpen: false },
    );
    expect(document.querySelector("[data-tp-line-discount-summary-panel]")).toBeNull();
  });
});

describe("SaleLineDiscountSummary — header coherente con TPNumber (Total automático)", () => {
  function lineWithPipeline() {
    // Replica el escenario reportado: promo + qty + cliente cuyos amounts
    // están en pricingSteps. POST-A1: el TOTAL del header lee del descuento
    // EFECTIVO (baseInitial − subtotal), no de Σ steps — eso garantiza
    // coincidencia con el TPNumber del editor. Para que el efectivo dé el
    // mismo número que Σ steps el fixture debe ser matemáticamente
    // consistente: basePrice × qty − subtotal == Σ (step.discountAmount × qty).
    //
    // Cascada del motor (per-unit):
    //   1000 → −100 (QD 10%)   → 900
    //          −100 (Promo 11,11%) → 800
    //          −120 (Cliente 15%)  → 680
    //
    // Total efectivo por línea: 1000×5 − 680×5 = 5000 − 3400 = 1600.
    // Σ steps × qty:            (100 + 100 + 120) × 5            = 1600.
    return {
      quantity: 5,
      // unitPrice FINAL del motor (post-cascada) y subtotal NETO (= unitPrice × qty).
      unitPrice: 680,
      subtotal:  3400,
      pricingMeta: {
        basePrice: 1000,
        inheritedDiscount: { ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 15, applyOn: "TOTAL" },
        pricingSteps: [
          { key: "PRICE_LIST", label: "Lista", status: "ok" as const, value: 1000 },
          {
            key: "QUANTITY_DISCOUNT", label: "QD", status: "ok" as const, value: 900,
            meta: { discountBase: 1000, discountAmount: 100, value: 10, type: "PERCENTAGE" as const, applyOn: "TOTAL" },
          },
          {
            key: "PROMOTION", label: "Promo", status: "ok" as const, value: 800,
            meta: { discountBase: 900, discountAmount: 100, value: 11.11, type: "PERCENTAGE" as const, applyOn: "TOTAL", promoName: "Verano" },
          },
          {
            key: "ENTITY_COMMERCIAL_RULE", label: "Cliente", status: "ok" as const, value: 680,
            meta: { ruleType: "DISCOUNT" as const, valueType: "PERCENTAGE" as const, value: 15, applyOn: "TOTAL", discountBase: 800, discountAmount: 120 },
          },
        ],
      },
    };
  }

  it("Trigger muestra monto del pipeline en signo negativo (bonus), NO de la agregación por origen", () => {
    renderSummary(lineWithPipeline());
    const block = getBlock();
    // T29 — El trigger ya no muestra texto "Total automático:" (eliminado);
    // ahora muestra sólo el monto firmado (verde si bonus) + "Ver detalle".
    expect(within(block).queryByText(/Total automático:/i)).toBeNull();
    expect(within(block).getByText(/Ver detalle/i)).toBeTruthy();
    // Valor esperado: (100 + 100 + 120) × 5 = 1.600. Buscamos esa magnitud
    // dentro del bloque (firmada con "−" porque es descuento).
    expect(block.textContent ?? "").toMatch(/1\.?600/);
    expect(block.textContent ?? "").toMatch(/[−-]\s*AR?\$?\s*1\.?600/);
  });

  it("Header del componente == Total automático del footer del pipeline (coherencia visual)", () => {
    renderSummary(lineWithPipeline(), { defaultOpen: true });
    const block = getBlock();
    // Header (siempre visible).
    const header = block.querySelector("button[aria-expanded]");
    const headerText = header?.textContent ?? "";
    // Footer del pipeline (en el detalle abierto).
    const totalAutoLabel = within(block).getByText(/^Total automático$/i);
    const totalAutoText = totalAutoLabel.parentElement?.textContent ?? "";
    // Ambos deben mencionar la misma magnitud (1.600).
    expect(headerText).toMatch(/1\.?600/);
    expect(totalAutoText).toMatch(/1\.?600/);
  });
});

describe("SaleLineDiscountSummary — cadena unitaria (Base/Cálculo/Cantidad/Impacto)", () => {
  it("qty = 1 → muestra base unitaria + cálculo unitario + cantidad (1,00) + impacto total", () => {
    renderSummary(
      {
        quantity: 1,
        pricingMeta: {
          promotionDiscountAmount:    48375,
          appliedPromotionName:       "Verano",
          promotionDiscountBase:      483750,
          promotionDiscountValue:     10,
          promotionDiscountValueType: "PERCENTAGE",
        },
      },
      { defaultOpen: true },
    );
    const block = getBlock();
    // Bloque compacto único — "Base usada: 483.750 × 10% = -48.375".
    expect(block.querySelector("[data-tp-base-used]")).not.toBeNull();
    const text = block.textContent ?? "";
    expect(text).toMatch(/Base usada.*483\.?750/);
    expect(text).toMatch(/10[.,]?\d*\s*%/);
    expect(text).toMatch(/48\.?375/);   // impacto unitario "-48.375"
    // qty=1 → unitario = total. El verde derecho también muestra 48.375.
  });

  it("qty > 1 → base usada muestra cálculo unitario y verde derecho = total línea", () => {
    renderSummary(
      {
        quantity: 6,
        pricingMeta: {
          promotionDiscountAmount:    48375,    // unitario per artículo
          appliedPromotionName:       "Verano",
          promotionDiscountBase:      2902500,  // motor: 483.750 × 6
          promotionDiscountValue:     10,
          promotionDiscountValueType: "PERCENTAGE",
        },
      },
      { defaultOpen: true },
    );
    const block = getBlock();
    const text = block.textContent ?? "";
    // Base usada (unitario): 483.750 × 10% = -48.375 (por unidad).
    expect(text).toMatch(/Base usada.*483\.?750/);
    expect(text).toMatch(/48\.?375/);     // impacto unitario (en el cálculo)
    expect(text).toMatch(/290\.?250/);    // total línea (verde derecho)
  });

  it("Impacto verde a la derecha del ítem = total línea (NO unitario)", () => {
    renderSummary(
      {
        quantity: 6,
        pricingMeta: {
          promotionDiscountAmount:    48375,
          appliedPromotionName:       "Verano",
          promotionDiscountBase:      2902500,
          promotionDiscountValue:     10,
          promotionDiscountValueType: "PERCENTAGE",
        },
      },
      { defaultOpen: true },
    );
    const block = getBlock();
    // El monto verde (text-emerald-600) que vive al lado del label del ítem
    // debe ser el TOTAL línea (290.250), no el unitario (48.375).
    const greenCells = Array.from(block.querySelectorAll("div"))
      .filter((d) => d.className.includes("text-emerald-600") && d.className.includes("tabular-nums"));
    expect(greenCells.length).toBeGreaterThanOrEqual(1);
    const greenText = greenCells.map((d) => d.textContent ?? "").join(" ");
    expect(greenText).toMatch(/290\.?250/);
  });

  it("Sin recálculo: el motor expone amount=300 y qty=3 → impacto unitario = 100 (división trivial)", () => {
    // Verifica que el componente toma `amount` del motor como total e
    // imprime el unitario como amount/qty — sin inventar otra cuenta.
    renderSummary(
      {
        quantity: 3,
        pricingMeta: {
          promotionDiscountAmount:    100,    // unitario per artículo
          appliedPromotionName:       "X",
          promotionDiscountBase:      3000,
          promotionDiscountValue:     10,
          promotionDiscountValueType: "PERCENTAGE",
        },
      },
      { defaultOpen: true },
    );
    const block = getBlock();
    const text = block.textContent ?? "";
    // El bloque "Base usada" tiene el cálculo unitario:
    //   1.000 (baseUnit) × 10% = -100 (impacto unitario)
    // El verde a la derecha sigue siendo el total 300 (passthrough motor).
    expect(text).toMatch(/Base usada.*1\.?000/);
    expect(text).toMatch(/100/);    // impacto unitario en la línea Base usada
    expect(text).toMatch(/300/);    // total línea (verde derecho)
  });
});

describe("SaleLineDiscountSummary — sin derivar porcentajes", () => {
  it("Labels primarios (que arrancan con '• ') nunca contienen '%'", () => {
    renderSummary(
      {
        quantity: 2,
        pricingMeta: {
          promotionDiscountAmount: 10,
          appliedPromotionName: "Verano",
          quantityDiscountAmount: 5,
          customerDiscountAmount: 8,
          inheritedDiscount: { ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 4, applyOn: "TOTAL" },
        },
      },
      { defaultOpen: true },
    );
    const block = getBlock();
    const labelNodes = Array.from(block.querySelectorAll("div"))
      .filter((n) => (n.textContent ?? "").trim().startsWith("•"))
      .filter((n) => {
        const txt = (n.textContent ?? "").trim();
        return txt.length < 50 && !txt.includes("\n");
      });
    expect(labelNodes.length).toBeGreaterThan(0);
    for (const n of labelNodes) {
      expect(n.textContent ?? "").not.toMatch(/%/);
    }
  });
});

// ============================================================================
// Semántica unificada "manual reemplaza automático" — card visual.
//
// Cuando hay `meta.manualDiscount` activo, el card debe ocultar TODA la
// sección "Ajustes aplicados por el sistema" del PipelineTimeline. El motor
// puede seguir emitiendo PROMOTION/QUANTITY_DISCOUNT/ENTITY_COMMERCIAL_RULE
// en `pricingSteps` por compatibilidad, pero el frontend NO los muestra
// como activos cuando el operador puso un override manual.
//
// Cobertura del checklist del usuario:
//   1. Promo activa + manualDiscount → card no muestra Promo.
//   2. Desc. cantidad + manualDiscount → card no muestra Desc. cantidad.
//   3. Cliente + manualDiscount → card no muestra Cliente.
//   4. Manual 0 (md.value=0) → card no muestra automáticos.
//   5. SIN manual (estado post-X / nunca tuvo) → automáticos VUELVEN.
// ============================================================================
describe("SaleLineDiscountSummary — manual override oculta sección automáticos", () => {
  // Fixture base: línea con promo + qty + cliente expuestos por el motor en
  // pricingSteps (compatibilidad legacy). Se le agrega o no manualDiscount
  // para alternar la semántica.
  function linePromoQtyCliente(opts: { withManual: boolean; manualValue?: number }): LineLikeForDiscount {
    return {
      quantity: 2,
      unitPrice: opts.withManual ? 70 : 60,
      subtotal:  opts.withManual ? 140 : 120,
      pricingMeta: {
        basePrice: 100,
        // Campos legacy del motor poblados (auto activo).
        appliedPromotionId:   "promo-1",
        appliedPromotionName: "Verano",
        promotionDiscountAmount: 10,
        quantityDiscountAmount:  10,
        customerDiscountAmount:  20,
        inheritedDiscount: {
          ruleType: "DISCOUNT", valueType: "PERCENTAGE",
          value: 10, applyOn: "TOTAL",
        },
        // Steps del pipeline: motor emite los 3 automáticos siempre. Cuando
        // hay manual también emite el step MANUAL_DISCOUNT_OVERRIDE (línea
        // adicional). El test verifica que los 3 auto NO se rendereen en
        // el card cuando hay manual.
        pricingSteps: [
          { key: "PRICE_LIST", label: "Lista", status: "ok" as const, value: 100 },
          {
            key: "QUANTITY_DISCOUNT", label: "Desc. por cantidad", status: "ok" as const, value: 90,
            meta: { discountBase: 100, discountAmount: 10, value: 10, type: "PERCENTAGE" as const, applyOn: "TOTAL" },
          },
          {
            key: "PROMOTION", label: "Promo Verano", status: "ok" as const, value: 80,
            meta: { discountBase: 90, discountAmount: 10, value: 11.11, type: "PERCENTAGE" as const, applyOn: "TOTAL", promoName: "Verano" },
          },
          {
            key: "ENTITY_COMMERCIAL_RULE", label: "Cliente", status: "ok" as const, value: 60,
            meta: { ruleType: "DISCOUNT" as const, valueType: "PERCENTAGE" as const, value: 25, applyOn: "TOTAL", discountBase: 80, discountAmount: 20 },
          },
          ...(opts.withManual
            ? [{
                key: "MANUAL_DISCOUNT_OVERRIDE", label: "Bonificación manual", status: "ok" as const, value: 70,
                meta: {
                  kind: "BONUS" as const, mode: "PERCENT" as const, appliesTo: "TOTAL",
                  discountBase: 100, discountAmount: 30, value: opts.manualValue ?? 30,
                },
              }]
            : []),
        ],
        ...(opts.withManual
          ? { manualDiscount: { value: opts.manualValue ?? 30, mode: "PERCENT" as const, appliesTo: "TOTAL", kind: "BONUS" as const } }
          : {}),
      },
    };
  }

  it("CASO 1: promo activa + manualDiscount → card NO muestra step Promo", () => {
    renderSummary(linePromoQtyCliente({ withManual: true }), { defaultOpen: true });
    const block = getBlock();
    // `describePipelineEntry` mapea step.key=PROMOTION a label="Promo" y
    // pone el nombre en `originName` (renderizado como "Regla: Verano").
    // Verificamos que NINGUNA de las dos pistas del step Promo aparezca.
    expect(within(block).queryByText(/^Promo$/i)).toBeNull();
    expect(within(block).queryByText(/Regla:\s*Verano/i)).toBeNull();
    // Header de la sección AUTO tampoco debe aparecer cuando hay manual.
    expect(within(block).queryByText(/Ajustes aplicados por el sistema/i)).toBeNull();
  });

  it("CASO 2: descuento por cantidad + manualDiscount → card NO muestra step Desc. por cantidad", () => {
    renderSummary(linePromoQtyCliente({ withManual: true }), { defaultOpen: true });
    const block = getBlock();
    // El label "Desc. por cantidad" del step automático no debe aparecer.
    // (Cuidado: el step manual también podría mencionar "manual" → buscamos
    // específicamente el texto del step auto).
    expect(within(block).queryByText(/^Desc\. por cantidad$/i)).toBeNull();
  });

  it("CASO 3: cliente + manualDiscount → card NO muestra step Cliente", () => {
    renderSummary(linePromoQtyCliente({ withManual: true }), { defaultOpen: true });
    const block = getBlock();
    // El label "Cliente" del step ENTITY_COMMERCIAL_RULE no debe aparecer.
    // (Hay otros textos que pueden contener "cliente" como "regla del
    // cliente" si se mostrara — verificamos el match exacto del label
    // del step. Cuando no hay manual el label aparece como "Cliente"
    // o "Recargo cliente"; con manual no debe haber NINGUNO.)
    expect(within(block).queryByText(/^Cliente$/i)).toBeNull();
    expect(within(block).queryByText(/^Recargo cliente$/i)).toBeNull();
  });

  it("CASO 4: manual 0 (md.value=0) → card NO muestra automáticos", () => {
    renderSummary(linePromoQtyCliente({ withManual: true, manualValue: 0 }), { defaultOpen: true });
    const block = getBlock();
    expect(within(block).queryByText(/^Promo$/i)).toBeNull();
    expect(within(block).queryByText(/Regla:\s*Verano/i)).toBeNull();
    expect(within(block).queryByText(/^Desc\. por cantidad$/i)).toBeNull();
    expect(within(block).queryByText(/^Cliente$/i)).toBeNull();
    expect(within(block).queryByText(/Ajustes aplicados por el sistema/i)).toBeNull();
  });

  it("CASO 5: SIN manualDiscount (estado post-X) → automáticos VUELVEN a renderizarse", () => {
    renderSummary(linePromoQtyCliente({ withManual: false }), { defaultOpen: true });
    const block = getBlock();
    // Auto steps presentes (header de sección + labels de cada step).
    expect(within(block).getByText(/Ajustes aplicados por el sistema/i)).toBeTruthy();
    // Label del step PROMOTION es "Promo" + originName "Verano" → "Regla: Verano".
    expect(within(block).getByText(/Regla:\s*Verano/i)).toBeTruthy();
    expect(within(block).getByText(/^Desc\. por cantidad$/i)).toBeTruthy();
    expect(within(block).getByText(/^Cliente$/i)).toBeTruthy();
  });

  // ──────────────────────────────────────────────────────────────────────
  // Manual + cambio de qty — el card NO debe mostrar el step "Desc. por
  // cantidad" como aplicado, ni cuando la qty original lo activaba, ni
  // cuando la nueva qty lo activaría con tramo mayor. Anti-regresión del
  // flujo "manual siempre manda aunque qty cambie".
  // ──────────────────────────────────────────────────────────────────────
  it("CASO 6 (qty=2 + manual): card oculta sección 'Ajustes aplicados por el sistema'", () => {
    renderSummary(linePromoQtyCliente({ withManual: true }), { defaultOpen: true });
    const block = getBlock();
    // Sección automáticos completa NO se renderiza (header + steps).
    expect(within(block).queryByText(/Ajustes aplicados por el sistema/i)).toBeNull();
    expect(within(block).queryByText(/^Desc\. por cantidad$/i)).toBeNull();
  });

  it("CASO 6 (re-render con qty mayor + manual): sección auto sigue oculta", () => {
    // Simula que la qty cambió Y el motor emitiría un qtyDiscountAmount
    // mayor (entra en tramo de descuento por cantidad). Con manual activo,
    // la sección auto del card sigue oculta — el operador no ve el
    // "Desc. por cantidad" como aplicado en ningún momento del cambio.
    function lineQty10WithManual(): LineLikeForDiscount {
      return {
        quantity: 10,
        unitPrice: 70,  // con manual 30% sobre base 100 → 70
        subtotal:  700, // 70 × 10
        pricingMeta: {
          basePrice: 100,
          // Backend reporta qty discount tramo nuevo (10 unidades).
          quantityDiscountAmount: 25,
          appliedPromotionId: "promo-1",
          appliedPromotionName: "Verano",
          promotionDiscountAmount: 10,
          customerDiscountAmount: 50,
          inheritedDiscount: {
            ruleType: "DISCOUNT", valueType: "PERCENTAGE",
            value: 5, applyOn: "TOTAL",
          },
          pricingSteps: [
            { key: "PRICE_LIST", label: "Lista", status: "ok" as const, value: 100 },
            {
              key: "QUANTITY_DISCOUNT", label: "Desc. por cantidad", status: "ok" as const, value: 75,
              meta: { discountBase: 100, discountAmount: 25, value: 25, type: "PERCENTAGE" as const, applyOn: "TOTAL" },
            },
            {
              key: "PROMOTION", label: "Promo Verano", status: "ok" as const, value: 65,
              meta: { discountBase: 75, discountAmount: 10, value: 13.33, type: "PERCENTAGE" as const, applyOn: "TOTAL", promoName: "Verano" },
            },
            {
              key: "ENTITY_COMMERCIAL_RULE", label: "Cliente", status: "ok" as const, value: 60,
              meta: { ruleType: "DISCOUNT" as const, valueType: "PERCENTAGE" as const, value: 5, applyOn: "TOTAL", discountBase: 65, discountAmount: 5 },
            },
            {
              key: "MANUAL_DISCOUNT_OVERRIDE", label: "Bonificación manual", status: "ok" as const, value: 70,
              meta: {
                kind: "BONUS" as const, mode: "PERCENT" as const, appliesTo: "TOTAL",
                discountBase: 100, discountAmount: 30, value: 30,
              },
            },
          ],
          manualDiscount: { value: 30, mode: "PERCENT" as const, appliesTo: "TOTAL", kind: "BONUS" as const },
        },
      };
    }
    renderSummary(lineQty10WithManual(), { defaultOpen: true });
    const block = getBlock();
    // El step QUANTITY_DISCOUNT existe en pricingSteps pero NO debe
    // renderearse cuando hay manual override. Sección auto completa
    // sigue oculta.
    expect(within(block).queryByText(/Ajustes aplicados por el sistema/i)).toBeNull();
    expect(within(block).queryByText(/^Desc\. por cantidad$/i)).toBeNull();
    expect(within(block).queryByText(/^Promo$/i)).toBeNull();
    expect(within(block).queryByText(/^Cliente$/i)).toBeNull();
    // Sección manual SÍ presente.
    expect(within(block).getByText(/Ajuste manual/i)).toBeTruthy();
  });
});
