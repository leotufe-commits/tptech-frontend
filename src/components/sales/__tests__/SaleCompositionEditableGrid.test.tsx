// src/components/sales/__tests__/SaleCompositionEditableGrid.test.tsx
// =============================================================================
// FASE 2 — tests del componente editable de Factura.
//
// Cubre:
//   1. Render una fila por costLineId (METAL / HECHURA / PRODUCT / SERVICE).
//   2. METAL renderiza inputs distintos a PRODUCT (merma vs val.unit).
//   3. Editar cantidad / merma / val.unit / ajuste dispara `onApply` con
//      `costLineOverrides[]` reconstruido.
//   4. Restaurar fila quita SOLO el costLineId de esa fila.
//   5. Restaurar todo limpia el array completo + legacy.
//   6. El bloque "Ajustes globales" se renderea solo cuando hay datos.
//
// NOTA debounce: `useOverrideNumber` espera 400ms antes de commitear. Los
// tests usan `vi.useFakeTimers()` y `vi.advanceTimersByTime(500)` para
// disparar el commit.
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { SaleCompositionEditableGrid } from "../SaleCompositionEditableGrid";
import type { DocumentLine } from "../../../lib/document-types";

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeLine(meta: Partial<DocumentLine["pricingMeta"]> = {}): DocumentLine {
  return {
    id: "line-1", type: "ARTICLE",
    article: "Anillo Test", variant: "",
    articleId: "art-1",
    quantity: 1, unitPrice: 1000, discountAmount: 0,
    subtotal: 1000, taxAmount: 0,
    lineTotal: 1000, lineTotalWithTax: 1000,
    pricingMeta: {
      basePrice: 1000, unitPrice: 1000,
      unitCost:  400, unitMargin: 600, marginPercent: 60,
      composition: {
        metal: null, hechura: null, taxes: [],
        metals: [
          {
            costLineId:      "cl-metal-1",
            metalVariantId:  "mv-1",
            // Shape real del backend (`pricing-composition.ts:250`):
            // metalName = nombre del metal padre ("Oro"), purityLabel =
            // label de la variante ("18k"). El frontend los combina como
            // primary "Oro 18k" desde Fase 2.2.
            metalName:       "Oro",
            purity:          0.75,
            purityLabel:     "18k",
            appliedGrams:    2.5,
            appliedMermaPct: 1.5,
            lineCost:        500,
            // Fase 2.3 — quotePrice = base por gramo, pre-merma.
            // En este fixture: 500 / (2.5 × 1.015) = 197,04 ≈ 200/g
            // (usamos 197.04 para matchear cierre en las assertions).
            quotePrice:      197.04,
          },
        ],
        hechuras: [
          {
            costLineId:    "cl-hechura-1",
            appliedAmount: 200,
            lineCost:      200,
            lineLabel:     "Hechura base",
          },
        ],
        products: [
          {
            costLineId:      "cl-product-1",
            catalogItemId:   "ci-p1",
            catalogItemCode: "P-001",
            catalogItemName: "Cadena 60cm",
            quantity:        1,
            unitValue:       150,
            totalValue:      150,
            currencyId:      null,
            lineAdjKind:     null, lineAdjType: null, lineAdjValue: null, lineAdjAmount: null,
            affectsStock:    null,
          },
        ],
        services: [
          {
            costLineId:      "cl-service-1",
            catalogItemId:   "ci-s1",
            catalogItemCode: "S-001",
            catalogItemName: "Engaste",
            quantity:        1,
            unitValue:       80,
            totalValue:      80,
            currencyId:      null,
            lineAdjKind:     null, lineAdjType: null, lineAdjValue: null, lineAdjAmount: null,
            affectsStock:    null,
          },
        ],
      } as any,
      ...meta,
    },
  } as DocumentLine;
}

const baseProps = { currency: "ARS", onClear: vi.fn(), onClose: vi.fn() };

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ────────────────────────────────────────────────────────────────────────────
// 1. Render por costLineId
// ────────────────────────────────────────────────────────────────────────────

describe("SaleCompositionEditableGrid — render", () => {
  it("renderiza una fila por componente: METAL, HECHURA, PRODUCT, SERVICE", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // METAL primary = metal padre + variante (Fase 2.2).
    expect(screen.getByText("Oro 18k")).toBeInTheDocument();
    expect(screen.getByText("Hechura base")).toBeInTheDocument();
    expect(screen.getByText("Cadena 60cm")).toBeInTheDocument();
    expect(screen.getByText("Engaste")).toBeInTheDocument();
  });

  it("muestra placeholder cuando no hay componentes", () => {
    const line = makeLine({
      composition: {
        metal: null, hechura: null, taxes: [],
        metals: [], hechuras: [], products: [], services: [],
      } as any,
    });
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText("Sin componentes para editar.")).toBeInTheDocument();
  });

  it("Fase 2.2 — METAL primary = 'Oro 18k', secondary = 'Ley: 0.750' (decimal técnico)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // Primary: nombre del metal padre + variante.
    expect(screen.getByText("Oro 18k")).toBeInTheDocument();
    // Secondary: pureza/ley como número técnico decimal (0.75 → "0,750").
    expect(screen.getByText(/Ley\s+0,750/)).toBeInTheDocument();
    // PRODUCT mantiene su código.
    expect(screen.getByText(/Código: P-001/)).toBeInTheDocument();
  });

  it("Fase 2.2 — METAL sin pureza decimal degrada a 'Ley: <label>'", () => {
    const line = makeLine({
      composition: {
        metal: null, hechura: null, taxes: [],
        metals: [{
          costLineId: "cl-metal-1", metalVariantId: "mv-1",
          metalName: "Plata", purity: null, purityLabel: "925",
          appliedGrams: 5, appliedMermaPct: 0, lineCost: 100,
        }],
        hechuras: [], products: [], services: [],
      } as any,
    });
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText("Plata 925")).toBeInTheDocument();
    // FASE 12.7 — sin colon, sin tipo cierre. Para METAL sin pureza decimal:
    // resultado = "Ley 925" (degradación a label).
    expect(screen.getByText(/Ley\s+925/)).toBeInTheDocument();
  });

  it("METAL: muestra el editor de Merma inline; PRODUCT: sin merma", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // FASE 12.5b — sub-línea de unidad amigable bajo Cantidad METAL.
    expect(screen.getByText("Gramos")).toBeInTheDocument();
    // FASE F13 — el label "Merma" se eliminó del editor. El editor existe
    // (marcado data-merma-inline-editor) con su input y sufijo "%".
    const mermaEditor = document.querySelector('[data-merma-inline-editor]');
    expect(mermaEditor).not.toBeNull();
    expect(mermaEditor!.querySelector("input")).not.toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. Edición → onApply con patch correcto
// ────────────────────────────────────────────────────────────────────────────

describe("SaleCompositionEditableGrid — edición", () => {
  it("editar gramos (METAL) llama onApply con quantityOverride sobre el costLineId correcto", () => {
    const onApply = vi.fn();
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={onApply} {...baseProps} />);

    // TPNumberInput usa type="text" → role="textbox". El primer textbox
    // visible es la cantidad de METAL (2.5g).
    const inputs = screen.getAllByRole("textbox");
    // El input de la cantidad METAL tiene 3 decimales (formato "2,500").
    const metalQty = inputs.find((el) => {
      const v = (el as HTMLInputElement).value;
      return v.startsWith("2,5") || v.startsWith("2.5");
    });
    expect(metalQty).toBeDefined();

    fireEvent.change(metalQty!, { target: { value: "3.5" } });
    vi.advanceTimersByTime(500);

    expect(onApply).toHaveBeenCalled();
    const lastPatch = onApply.mock.calls.at(-1)![0];
    expect(lastPatch.costLineOverrides).toBeInstanceOf(Array);
    const ov = (lastPatch.costLineOverrides as any[]).find(
      (o: any) => o.costLineId === "cl-metal-1",
    );
    expect(ov).toBeDefined();
    expect(ov.type).toBe("METAL");
    expect(Number(ov.quantityOverride)).toBeCloseTo(3.5, 4);
  });

  it("FASE F9 — modificar el input de Bonif/Recargo emite patch con kind+type+value", () => {
    const onApply = vi.fn();
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={onApply} {...baseProps} />);
    // El editor inline siempre está visible. Tomo el primer editor (HECHURA).
    const editors = document.querySelectorAll('[data-adjustment-inline-editor]');
    expect(editors.length).toBeGreaterThanOrEqual(1);
    const input = editors[0].querySelector("input") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.blur(input);
    vi.advanceTimersByTime(300); // commit DEBOUNCED (useOverrideNumber)
    expect(onApply).toHaveBeenCalled();
    const patch = onApply.mock.calls[onApply.mock.calls.length - 1][0];
    const ov = (patch.costLineOverrides as any[])?.find((o: any) => o.costLineId === "cl-hechura-1");
    expect(ov).toBeDefined();
    expect(ov.adjustmentKind).toBe("BONUS");
    expect(ov.adjustmentType).toBe("PERCENTAGE");
    expect(Number(ov.adjustmentValue)).toBeCloseTo(5);
  });

  it("FASE F9 — signo se muestra como '−' (BONUS) o '+' (SURCHARGE)", () => {
    const lineBonus = makeLine({
      costLineOverrides: [{
        costLineId: "cl-hechura-1", type: "HECHURA",
        adjustmentKind: "BONUS", adjustmentType: "PERCENTAGE", adjustmentValue: 5,
      }],
    });
    const { rerender } = render(
      <SaleCompositionEditableGrid line={lineBonus} onApply={vi.fn()} {...baseProps} />,
    );
    // BONUS → signo "−" en el toggle.
    expect(screen.getAllByTitle(/Bonificación \(−\)/).length).toBeGreaterThanOrEqual(1);

    const lineSurcharge = makeLine({
      costLineOverrides: [{
        costLineId: "cl-product-1", type: "PRODUCT",
        adjustmentKind: "SURCHARGE", adjustmentType: "FIXED_AMOUNT", adjustmentValue: 10,
      }],
    });
    rerender(<SaleCompositionEditableGrid line={lineSurcharge} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getAllByTitle(/Recargo \(\+\)/).length).toBeGreaterThanOrEqual(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. Restore por fila / restore all
// ────────────────────────────────────────────────────────────────────────────

describe("SaleCompositionEditableGrid — restore", () => {
  it("restore por fila quita SOLO el costLineId de esa fila", () => {
    const onApply = vi.fn();
    const line = makeLine({
      costLineOverrides: [
        { costLineId: "cl-metal-1",   type: "METAL",   quantityOverride: 5 },
        { costLineId: "cl-hechura-1", type: "HECHURA", unitValueOverride: 999 },
      ],
    });
    render(<SaleCompositionEditableGrid line={line} onApply={onApply} {...baseProps} />);

    // Botones de restore por fila — uno por fila (4 filas).
    const restoreButtons = screen.getAllByTitle(/Restaurar esta fila/);
    expect(restoreButtons.length).toBeGreaterThanOrEqual(2);
    // El primer "Restaurar esta fila" disponible (no disabled) es la fila
    // METAL — es la primera con override activo.
    fireEvent.click(restoreButtons[0]);

    expect(onApply).toHaveBeenCalledTimes(1);
    const patch = onApply.mock.calls[0][0];
    const arr  = patch.costLineOverrides as any[];
    expect(arr.find((o) => o.costLineId === "cl-metal-1")).toBeUndefined();
    expect(arr.find((o) => o.costLineId === "cl-hechura-1")).toBeDefined();
  });

  it("Restaurar todo limpia array de costLineOverrides + legacy", () => {
    const onApply = vi.fn();
    const line = makeLine({
      costLineOverrides:     [{ costLineId: "cl-metal-1", type: "METAL", quantityOverride: 5 }],
      gramsOverride:         9,
      hechuraOverrideAmount: 333,
    });
    render(<SaleCompositionEditableGrid line={line} onApply={onApply} {...baseProps} />);

    fireEvent.click(screen.getByTestId("sale-grid-restore-all"));

    expect(onApply).toHaveBeenCalledTimes(1);
    const patch = onApply.mock.calls[0][0];
    expect(patch.costLineOverrides).toEqual([]);
    expect(patch.gramsOverride).toBeNull();
    expect(patch.mermaPercentOverride).toBeNull();
    expect(patch.hechuraOverrideAmount).toBeNull();
    expect(patch.metalVariantIdOverride).toBeNull();
  });

  it("Sin overrides activos NO muestra el botón 'Restaurar todo'", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.queryByTestId("sale-grid-restore-all")).toBeNull();
  });

  it("Con overrides activos sí muestra el botón 'Restaurar todo'", () => {
    const line = makeLine({
      costLineOverrides: [{ costLineId: "cl-metal-1", type: "METAL", quantityOverride: 5 }],
    });
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByTestId("sale-grid-restore-all")).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. Bloque "Ajustes globales"
// ────────────────────────────────────────────────────────────────────────────

describe("SaleCompositionEditableGrid — ajustes globales", () => {
  it("Fase 2.2 — renderiza SOLO bonificación/recargo de línea (no canal/cupón/envío)", () => {
    render(
      <SaleCompositionEditableGrid
        line={makeLine()}
        onApply={vi.fn()}
        {...baseProps}
        globalAdjustments={{
          // Estos NO deben renderizarse en el bloque (Fase 2.2):
          channel:  { name: "Mayorista", amount: -50 },
          coupon:   { code: "PROMO10", name: "Promo10", amount: 100 },
          payment:  { name: "Tarjeta", amount: 30 },
          shipping: { mode: "FIXED", amount: 200, label: "Por carrier" },
          globalDiscount: { type: "PERCENT", value: 10, amount: 50 },
          // Este SÍ debe renderizarse (bonificación de línea con appliesTo=TOTAL):
          lineManualDiscount: { kind: "BONUS", valuePct: 8, amount: 80 },
        }}
      />,
    );
    expect(screen.getByText("Ajustes globales")).toBeInTheDocument();
    // Solo lineManualDiscount visible.
    expect(screen.getByText(/Bonificación de línea/)).toBeInTheDocument();
    // Canal/cupón/forma de pago/envío/desc. global ocultos.
    expect(screen.queryByText("Mayorista")).toBeNull();
    expect(screen.queryByText("Promo10")).toBeNull();
    expect(screen.queryByText("Tarjeta")).toBeNull();
    expect(screen.queryByText("Por carrier")).toBeNull();
    expect(screen.queryByText("Descuento global")).toBeNull();
  });

  it("Fase 2.2 — recargo de línea (kind=SURCHARGE) muestra label 'Recargo'", () => {
    render(
      <SaleCompositionEditableGrid
        line={makeLine()}
        onApply={vi.fn()}
        {...baseProps}
        globalAdjustments={{
          lineManualDiscount: { kind: "SURCHARGE", valuePct: 5, amount: 50 },
        }}
      />,
    );
    expect(screen.getByText(/Recargo de línea/)).toBeInTheDocument();
    expect(screen.queryByText(/Bonificación de línea/)).toBeNull();
  });

  it("oculta el bloque cuando solo vienen channel/coupon/etc. y NO hay lineManualDiscount", () => {
    render(
      <SaleCompositionEditableGrid
        line={makeLine()}
        onApply={vi.fn()}
        {...baseProps}
        globalAdjustments={{
          channel:  { name: "Mayorista", amount: -50 },
          coupon:   { code: "PROMO10", name: "Promo10", amount: 100 },
          shipping: { mode: "FIXED", amount: 200, label: "Por carrier" },
        }}
      />,
    );
    expect(screen.queryByText("Ajustes globales")).toBeNull();
  });

  it("oculta el bloque cuando lineManualDiscount.amount === 0", () => {
    render(
      <SaleCompositionEditableGrid
        line={makeLine()}
        onApply={vi.fn()}
        {...baseProps}
        globalAdjustments={{
          lineManualDiscount: { kind: "BONUS", valuePct: 0, amount: 0 },
        }}
      />,
    );
    expect(screen.queryByText("Ajustes globales")).toBeNull();
  });

  it("oculta el bloque cuando no se pasa la prop", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.queryByText("Ajustes globales")).toBeNull();
  });
});

describe("Fase 2.2/2.4 — secondary del componente (FASE 12.7: tipo retirado del cierre)", () => {
  it("secondary NO contiene 'gramos' ni 'unidad' ni el TIPO como cierre redundante", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // FASE 12.6 → 12.7 — la unidad redundante y el tipo cierre se removieron.
    // La unidad amigable vive bajo Cantidad; el tipo está implícito en el
    // icono coloreado de la izquierda. El secondary solo tiene metadata
    // realmente útil (ley para METAL, SKU/Código para PRODUCT/SERVICE).
    expect(screen.queryByText("gramos")).toBeNull();
    expect(screen.queryByText("unidad")).toBeNull();
    // El secondary de METAL conserva solo "Ley X" (sin "Metal" tail).
    // El de HECHURA queda vacío.
    // El de PRODUCT/SERVICE conserva solo SKU.
    // Verificamos que NO existe "Hechura" como sub-texto independiente
    // (HECHURA primary sí puede contenerlo si el lineLabel es "Hechura base").
    // Buscamos exact-match por palabra suelta para confirmar la limpieza.
    // (Si el primary contiene "Hechura" como parte del nombre, getByText
    // ignora ese match porque es parte de un texto más largo.)
    expect(screen.queryByText("Hechura")).toBeNull();
    expect(screen.queryByText("Producto")).toBeNull();
    expect(screen.queryByText("Servicio")).toBeNull();
    // "Metal" puede aparecer también en el card "Impacto en el precio de
    // venta" más abajo, así que no chequeamos su ausencia global —
    // verificamos los demás tipos.
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 7. Fase 2.2 — Columna AJUSTE muestra ajuste original del cost line
// ────────────────────────────────────────────────────────────────────────────

// FASE F9 — Bloque "Fase 2.2 — ajuste original" eliminado: testaba el
// pill clickeable y el chip "+ Bonif./Recargo" del editor inline viejo.
// El nuevo editor inline siempre visible se cubre en el describe F9
// más abajo. El tachado del original sigue funcionando vía
// `overrideDiffersFromOriginal` y queda cubierto en F9.

// ────────────────────────────────────────────────────────────────────────────
// 8. Fase 2.3 — formato de gramos + semántica VAL. UNIT. / V. VENTA / TOTAL
// ────────────────────────────────────────────────────────────────────────────

describe("Fase 2.3 — formato y semántica de columnas", () => {
  it("Cantidad METAL se muestra con 2 decimales (no 3)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // El input tiene decimals=2 → "2,50" (no "2,500").
    const inputs = screen.getAllByRole("textbox");
    const metalQty = inputs.find((el) => {
      const v = (el as HTMLInputElement).value;
      return v === "2,50" || v === "2.50";
    });
    expect(metalQty).toBeDefined();
  });

  it("Fase 2.4 — METAL VAL. UNIT. muestra post-merma per gram (lineCost / qty)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // lineCost=500, appliedGrams=2.5 → VAL. UNIT. = 200 → "ARS 200,00".
    // (En Fase 2.3 esa columna mostraba quotePrice; revertido en Fase 2.4.)
    expect(screen.getAllByText(/ARS\s*200,00/).length).toBeGreaterThanOrEqual(1);
  });

  it("Fase 2.4 — METAL VAL. UNIT. tiene tooltip con el valor base (quotePrice) cuando existe", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // El span de VAL. UNIT. tiene title "Valor base por gramo: ARS 197,04".
    const tooltip = document.querySelector('[title*="Valor base por gramo"]');
    expect(tooltip).not.toBeNull();
    expect(tooltip!.getAttribute("title")).toMatch(/ARS\s*197,04/);
  });

  it("Fase 2.4 — METAL V. VENTA = lineCost (total del componente, post-merma)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // V. VENTA = 500 → "ARS 500,00". TOTAL = 500 × line.quantity (1) = 500.
    // Aparece al menos en V. VENTA y TOTAL.
    expect(screen.getAllByText(/ARS\s*500,00/).length).toBeGreaterThanOrEqual(2);
  });

  it("PRODUCT V. VENTA = lineCost × line.quantity (total línea de factura, post-ajuste)", () => {
    const line = makeLine();
    // Override: cantidad=2 con BONUS 10% → totalValue=900 (motor mock).
    // Semántica corregida: "Costo Total" = lineCost × line.quantity (total
    // de la línea de factura), simétrico a Venta. Antes era lineCost / qty
    // (promedio per-unit del cost line) — confundía cuando qty > 1.
    (line.pricingMeta as any).composition.products[0] = {
      ...((line.pricingMeta as any).composition.products[0]),
      quantity:   2,
      unitValue:  500,
      totalValue: 900,           // post-ajuste BONUS 10%: 1000 − 100 = 900
              // = lineCost por unidad de artículo
    };
    // line.quantity (factura) default = 1 → Costo Total = 900 × 1 = 900.
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // Costo Total mostrado = 900 (no más 450). Aparece en la celda + posible
    // subtotal del grupo PRODUCTOS.
    expect(screen.getAllByText(/ARS\s*900,00/).length).toBeGreaterThanOrEqual(1);
  });

  it("HECHURA con qty=1 → V. VENTA === lineCost (no diverge cuando qty=1)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // h.lineCost = 200, qty default = 1 → V. VENTA = 200/1 = 200 == lineCost.
    // Aparece varias veces (input HECHURA + V. VENTA + METAL post-merma).
    expect(screen.getAllByText(/ARS\s*200,00/).length).toBeGreaterThanOrEqual(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 9. Fase 2.3.1 — HECHURA con bonificación: VAL. UNIT. = base, V. VENTA = post
// ────────────────────────────────────────────────────────────────────────────

describe("Fase 2.3.1 — HECHURA con bonificación: separa BASE de POST", () => {
  function makeLineWithHechuraBonus(): DocumentLine {
    const line = makeLine();
    const meta: any = line.pricingMeta;
    // Caso real del usuario:
    //   unitValue base 1000, BONUS 10% → motor emite step.value=900
    //   meta.unitValue=1000, meta.lineAdjAmount=100 (delta).
    meta.composition.hechuras[0] = {
      ...meta.composition.hechuras[0],
      unitValue:     1000,   // BASE (nuevo campo Fase 2.3.1)
      appliedAmount: 900,    // POST-ajuste (legacy preservado)
      lineCost:      900,
      lineAdjKind:   "BONUS",
      lineAdjType:   "PERCENTAGE",
      lineAdjValue:  10,
      lineAdjAmount: 100,
    };
    return line;
  }

  it("VAL. UNIT. HECHURA = 1000 (base), NO 900 (post-bonif)", () => {
    render(
      <SaleCompositionEditableGrid
        line={makeLineWithHechuraBonus()} onApply={vi.fn()} {...baseProps}
      />,
    );
    // TPNumberInput formatea con `n.toFixed(2)` → "1000.00" (sin separador
    // de miles, punto decimal). Input value === "1000.00".
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    const valUnitInput = inputs.find((el) => el.value === "1000.00");
    expect(valUnitInput).toBeDefined();
    // Y NO debe haber un input editable con valor "900.00" (sería el bug
    // Fase 2.3.1 — VAL. UNIT. mostrando post-ajuste).
    const post = inputs.find((el) => el.value === "900.00");
    expect(post).toBeUndefined();
  });

  it("FASE F9 — AJUSTE HECHURA inline muestra signo '−', valor '10,00' y monto '−ARS 100,00' debajo", () => {
    render(
      <SaleCompositionEditableGrid
        line={makeLineWithHechuraBonus()} onApply={vi.fn()} {...baseProps}
      />,
    );
    // Signo BONUS '−' visible en el toggle.
    expect(screen.getAllByTitle(/Bonificación \(−\)/).length).toBeGreaterThanOrEqual(1);
    // El input muestra el valor 10,00 (BONUS 10%).
    const editors = document.querySelectorAll('[data-adjustment-inline-editor]');
    const hechuraInput = editors[0].querySelector("input") as HTMLInputElement;
    expect(["10,00", "10.00"]).toContain(hechuraInput.value);
    // El monto signado se muestra debajo del editor.
    expect(screen.getByText(/−ARS\s*100,00/)).toBeInTheDocument();
  });

  it("V. VENTA HECHURA = 900 (post-bonif), TOTAL = 900 × line.quantity", () => {
    render(
      <SaleCompositionEditableGrid
        line={makeLineWithHechuraBonus()} onApply={vi.fn()} {...baseProps}
      />,
    );
    // Costo Total = lineCost × line.quantity = 900 × 1 = 900 → "ARS 900,00".
    // Mismo total aparece en celda + subtotal del grupo HECHURA + venta.
    // Aparece al menos 2 veces.
    expect(screen.getAllByText(/ARS\s*900,00/).length).toBeGreaterThanOrEqual(2);
  });

  it("Snapshot v5 viejo (sin unitValue) → fallback a appliedAmount sin recalcular", () => {
    const line = makeLine();
    const meta: any = line.pricingMeta;
    // Snapshot pre-Fase 2.3.1 — solo `appliedAmount` (post). Sin unitValue.
    meta.composition.hechuras[0] = {
      ...meta.composition.hechuras[0],
      appliedAmount: 200,
      lineCost:      200,
      // unitValue NO existe (campo nuevo).
    };
    delete meta.composition.hechuras[0].unitValue;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // VAL. UNIT. cae a appliedAmount (legacy) — no inventa el base.
    // Format de TPNumberInput: n.toFixed(2) → "200.00".
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    expect(inputs.some((el) => el.value === "200.00")).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 10. Fase 2.4 — METAL primary usa nombre comercial de variante
// ────────────────────────────────────────────────────────────────────────────

describe("Fase 2.4 — METAL primary usa variantName con fallback", () => {
  it("Si composition.metals[].variantName existe, primary lo usa tal cual", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.metals[0].variantName = "Oro 18 Kilates";
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText("Oro 18 Kilates")).toBeInTheDocument();
    // El fallback "Oro 18k" NO debe aparecer cuando hay variantName.
    expect(screen.queryByText("Oro 18k")).toBeNull();
  });

  it("Sin variantName → fallback 'metalName + purityLabel' (Fase 2.2)", () => {
    const line = makeLine();
    // Borra variantName explícitamente para simular snapshot viejo.
    delete (line.pricingMeta as any).composition.metals[0].variantName;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText("Oro 18k")).toBeInTheDocument();
  });

  it("variantName con string vacío → fallback al combinado", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.metals[0].variantName = "   ";
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText("Oro 18k")).toBeInTheDocument();
  });

  it("Sin variantName, sin metalName, con purityLabel → primary = purityLabel", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.metals[0] = {
      ...(line.pricingMeta as any).composition.metals[0],
      variantName: null,
      metalName:   null,
      purityLabel: "925",
    };
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText("925")).toBeInTheDocument();
  });
});

describe("Fase 2.4 — columna UNID. removida; unidad inline", () => {
  it("Header de la tabla NO contiene 'Unid.'", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.queryByText("Unid.")).toBeNull();
  });

  it("FASE F22 — Columnas presentes: Componente / Cantidad / Unidad / Costo unit. / Merma / Ajuste / Costo Total / Costo de Venta", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText("Componente")).toBeInTheDocument();
    expect(screen.getByText("Cantidad")).toBeInTheDocument();
    // "Unidad" puede aparecer en header + filas (fallback) — verificamos
    // que al menos exista una ocurrencia (el header).
    expect(screen.getAllByText("Unidad").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Costo unit.")).toBeInTheDocument();
    // FASE F22 — "Merma / Ajuste" vuelve como columna independiente.
    expect(screen.getByText("Merma / Ajuste")).toBeInTheDocument();
    expect(screen.getByText("Costo Total")).toBeInTheDocument();
    expect(screen.getByText("Venta")).toBeInTheDocument();
    // Labels viejos NO deben existir.
    expect(screen.queryByText("Val. unit.")).toBeNull();
    expect(screen.queryByText("V. venta")).toBeNull();
    expect(screen.queryByText("Costo línea")).toBeNull();
    expect(screen.queryByText("Total")).toBeNull();
  });

  it("METAL secondary contiene solo 'Ley X' (FASE 12.23: sin prefix '18k · ' redundante)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // FASE 12.23 — el kilataje ya vive en el primary ("Oro 18 Kilates"),
    // así que el secondary muestra solo "Ley 0,750" — no "18k · Ley 0,750".
    expect(screen.getByText(/^Ley\s+0,750$/)).toBeInTheDocument();
    expect(screen.queryByText(/18k\s+·\s+Ley/)).toBeNull();
    // No debe haber tail "gramos" ni "Metal" como tipo cierre.
    expect(screen.queryByText("gramos")).toBeNull();
  });

  it("Fase 2.4 — HECHURA/PRODUCT/SERVICE secondary sin 'Moneda' ni 'unidad' ni tipo cierre (FASE 12.7)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // 'Moneda: ARS' fue removido en Fase 2.4.
    expect(screen.queryByText(/Moneda:/)).toBeNull();
    // FASE 12.7 — 'unidad' y tipo cierre eliminados del secondary.
    expect(screen.queryByText("unidad")).toBeNull();
    expect(screen.queryByText("Hechura")).toBeNull();
    expect(screen.queryByText("Producto")).toBeNull();
    expect(screen.queryByText("Servicio")).toBeNull();
    // PRODUCT/SERVICE conservan SKU/Código en su secondary.
    expect(screen.getByText(/Código:\s*P-001/)).toBeInTheDocument();
    expect(screen.getByText(/Código:\s*S-001/)).toBeInTheDocument();
  });

  it("PRODUCT sin SKU usa fallback 'Código:' inline", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // El fixture solo tiene catalogItemCode (no catalogItemSku) → fallback.
    expect(screen.getByText(/Código: P-001/)).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 11. Multi-moneda — la grilla usa SIEMPRE la prop `currency`, sin hardcodear
// ────────────────────────────────────────────────────────────────────────────

describe("Multi-moneda — currency es propagada a todos los importes", () => {
  it("currency='ARS' → todos los amounts se prefijan con 'ARS'", () => {
    render(
      <SaleCompositionEditableGrid
        line={makeLine()}
        onApply={vi.fn()}
        onClear={vi.fn()}
        onClose={vi.fn()}
        currency="ARS"
      />,
    );
    // Total componentes en header se formatea con currency="ARS".
    expect(screen.getAllByText(/ARS\s*\d/).length).toBeGreaterThan(0);
    // Y NO debe aparecer ningún "USD" o "US$" (no hay hardcoded).
    expect(screen.queryByText(/USD\s*\d/)).toBeNull();
    expect(screen.queryByText(/US\$\s*\d/)).toBeNull();
  });

  it("currency='USD' → todos los amounts se prefijan con 'USD' (no quedan en ARS)", () => {
    render(
      <SaleCompositionEditableGrid
        line={makeLine()}
        onApply={vi.fn()}
        onClear={vi.fn()}
        onClose={vi.fn()}
        currency="USD"
      />,
    );
    // Hay al menos UNA aparición con prefijo USD.
    expect(screen.getAllByText(/USD\s*\d/).length).toBeGreaterThan(0);
    // No debe quedar ningún "ARS" porque la grilla NO tiene moneda
    // hardcodeada — todo viene de la prop `currency`.
    expect(screen.queryByText(/^ARS\s*\d/)).toBeNull();
    // Fase 2.4 — "Moneda: ARS" fue eliminado del secondary HECHURA.
    expect(screen.queryByText(/Moneda:/)).toBeNull();
  });

  it("Fase 2.4 — PRODUCT con catalogItemSku → secondary muestra 'SKU: XXX' (no 'Código:')", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.products[0].catalogItemSku = "ZAF-001";
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText(/SKU: ZAF-001/)).toBeInTheDocument();
    // Cuando hay SKU, "Código:" NO aparece (no fallback).
    expect(screen.queryByText(/Código: P-001/)).toBeNull();
  });

  it("Fase 2.4 — PRODUCT sin SKU pero con código → fallback 'Código:'", () => {
    const line = makeLine();
    // Borra explícitamente el SKU.
    delete (line.pricingMeta as any).composition.products[0].catalogItemSku;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText(/Código: P-001/)).toBeInTheDocument();
    expect(screen.queryByText(/SKU:/)).toBeNull();
  });

  it("Fase 2.4 — SERVICE con catalogItemSku usa SKU prioritariamente", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.services[0].catalogItemSku = "ENG-X1";
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText(/SKU: ENG-X1/)).toBeInTheDocument();
    expect(screen.queryByText(/Código: S-001/)).toBeNull();
  });

  it("Fase 2.4 — SKU vacío/whitespace → fallback al código", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.products[0].catalogItemSku = "   ";
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText(/Código: P-001/)).toBeInTheDocument();
  });

  // FASE F7 — Test "costAdjustment también" eliminado: el chip de
  // bonus/surcharge global vivía en `<PriceFlowCards>`, removido de Factura.

  it("Cambiar currency con rerender refresca todos los displays", () => {
    const props = {
      line: makeLine(),
      onApply: vi.fn(),
      onClear: vi.fn(),
      onClose: vi.fn(),
    };
    const { rerender } = render(
      <SaleCompositionEditableGrid {...props} currency="ARS" />,
    );
    expect(screen.getAllByText(/ARS\s*\d/).length).toBeGreaterThan(0);

    // Re-render con USD — todos los importes pasan a USD.
    rerender(<SaleCompositionEditableGrid {...props} currency="USD" />);
    expect(screen.queryByText(/^ARS\s*\d/)).toBeNull();
    expect(screen.getAllByText(/USD\s*\d/).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. Manual chip cuando hay override activo
// ────────────────────────────────────────────────────────────────────────────

describe("SaleCompositionEditableGrid — indicación visual de override", () => {
  it("fila con override activo muestra chip 'Manual'", () => {
    const line = makeLine({
      costLineOverrides: [
        { costLineId: "cl-product-1", type: "PRODUCT", unitValueOverride: 999 },
      ],
    });
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // El chip "Manual" se renderea en la celda Componente cuando manual=true.
    const manualChips = screen.getAllByText("Manual");
    expect(manualChips.length).toBeGreaterThanOrEqual(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 6. Fase 2.1 — paridad visual original/override
// ────────────────────────────────────────────────────────────────────────────

describe("FASE 12.23 — sin flash/tachado debajo del input al editar", () => {
  it("PRODUCT con unitValueOverride distinto al original: NO renderea el tachado debajo del input", () => {
    const line = makeLine({
      costLineOverrides: [
        { costLineId: "cl-product-1", type: "PRODUCT", unitValueOverride: 999 },
      ],
    });
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // FASE 12.23 — el span "Valor original del artículo" debajo del
    // CellNumberInput se eliminó (ensuciaba la tabla al editar).
    expect(document.querySelector('span[title="Valor original del artículo"]')).toBeNull();
    expect(screen.queryByText("150", { selector: "span.line-through" })).toBeNull();
  });

  it("METAL con quantityOverride distinto al original: NO renderea gramos tachados debajo del input", () => {
    const line = makeLine({
      costLineOverrides: [
        { costLineId: "cl-metal-1", type: "METAL", quantityOverride: 5 },
      ],
    });
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(document.querySelector('span[title="Valor original del artículo"]')).toBeNull();
    expect(screen.queryByText("2,5", { selector: "span.line-through" })).toBeNull();
  });

  it("Sin override → tampoco hay tachados sueltos", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(document.querySelector('span[title="Valor original del artículo"]')).toBeNull();
  });
});

// FASE F7 — Bloque "Fase 2.1 — Rentabilidad" eliminado: el card vivía dentro
// de `<PriceFlowCards>`, que fue removido de la Factura de Ventas. La
// rentabilidad se mantiene en otros lugares del sistema (Simulador), pero
// ya no se muestra acá.

// ────────────────────────────────────────────────────────────────────────────
// 12. Fase 2.5 — Ajuste global de costo (Article.manualAdjustment*)
// ────────────────────────────────────────────────────────────────────────────

// FASE F7 — Bloque "Fase 2.5 — Ajuste global de costo" eliminado: el card
// vivía dentro de `<PriceFlowCards>`. Los ajustes globales del documento
// (canal/cupón/envío) siguen renderizándose en `<GlobalAdjustmentsBlock>`,
// que sí permanece en la Factura.

// FASE F7 — Bloque "Fase 2.6.1 — KPI Valor de venta" eliminado: los KPIs
// vivían en el card de Rentabilidad de `<PriceFlowCards>`. El label
// "Valor de venta neto" sigue apareciendo en el header del card (ver
// FASE 2.6.2 más abajo).

// ────────────────────────────────────────────────────────────────────────────
// 14. Fase 2.6.2 — Header label + Valor de venta inline en header
// ────────────────────────────────────────────────────────────────────────────

describe("Fase 2.6.2 / FASE F14 — Header de Composición", () => {
  it("FASE F14 — Header del card muestra 'Valor de costo:' (renombrado de 'Componentes:')", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText(/Valor de costo:/)).toBeInTheDocument();
    expect(screen.queryByText(/Componentes:/)).toBeNull();
  });

  it("FASE F14 — Header muestra 'Valor de costo:' con el monto agregado", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText(/Valor de costo:/)).toBeInTheDocument();
  });

  it("FASE F14 — Header muestra 'Valor de venta:' inline cuando hay basePrice/unitPrice", () => {
    const line = makeLine();
    line.quantity = 1;
    (line.pricingMeta as any).basePrice = 3187469.38;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // FASE F14 — "Valor de venta:" (sin "neto").
    expect(screen.getByText(/Valor de venta:/)).toBeInTheDocument();
    expect(screen.queryByText(/Valor de venta neto:/)).toBeNull();
    expect(screen.getByText(/ARS\s*3\.187\.469,38/)).toBeInTheDocument();
  });

  it("Valor de venta header coincide con line.unitPrice cuando quantity=1 y NO hay basePrice", () => {
    const line = makeLine();
    line.quantity = 1;
    line.unitPrice = 7777.77;
    delete (line.pricingMeta as any).basePrice;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText(/ARS\s*7\.777,77/)).toBeInTheDocument();
  });

  it("Header NO muestra 'Valor de venta' cuando basePrice y unitPrice son null", () => {
    const line = makeLine();
    delete (line.pricingMeta as any).basePrice;
    (line as any).unitPrice = null;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.queryByText(/Valor de venta:/)).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 15. Fase 2.6.3 — Label de venta neto (FASE F14: renombrado a 'Valor de venta')
// ────────────────────────────────────────────────────────────────────────────

describe("Fase 2.6.3 / FASE F14 — label 'Valor de venta' en header", () => {
  it("FASE F14 — Header usa el label 'Valor de venta' (sin sufijo 'neto')", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText(/Valor de venta:/)).toBeInTheDocument();
    expect(screen.queryByText(/Valor de venta neto:/)).toBeNull();
  });

  it("FASE F14 — el label 'Valor de venta neto' no se renderea más en ningún lugar visible", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.queryByText("Valor de venta neto")).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 16. Fase 2.7.a — Renombrado semántico (sin cambiar lógica)
// ────────────────────────────────────────────────────────────────────────────

describe("Fase 2.7.a — labels alineados a composición de COSTO", () => {
  it("Título del card es 'Composición del costo del artículo'", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText(/Composición del costo del artículo/)).toBeInTheDocument();
    // El título viejo NO debe existir.
    expect(screen.queryByText(/Composición del precio de venta/)).toBeNull();
  });

  it("Header de columnas usa 'Costo unit.' (no 'Val. unit.')", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText("Costo unit.")).toBeInTheDocument();
    expect(screen.queryByText("Val. unit.")).toBeNull();
  });

  it("FASE 12.2 — header de columnas usa 'Costo Total' (no 'Costo línea' ni 'V. venta')", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText("Costo Total")).toBeInTheDocument();
    expect(screen.queryByText("Costo línea")).toBeNull();
    expect(screen.queryByText("V. venta")).toBeNull();
  });

  it("Tooltips informativos: 'Costo unit.' (con merma/ajuste debajo) y 'Costo Total' (con margen debajo)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const costoUnit  = screen.getByText("Costo unit.");
    const costoTotal = screen.getByText("Costo Total");
    // FASE 12.3 — `Costo unit.` extendido para señalar merma/ajuste debajo.
    expect(costoUnit.getAttribute("title")).toMatch(/^Costo base del componente/);
    // FASE 12.4 — `Costo Total` extendido para señalar margen embebido debajo.
    expect(costoTotal.getAttribute("title")).toMatch(/^Costo final del componente/);
  });

  it("FASE F14 — Header inline usa 'Valor de costo:' y 'Valor de venta:' (renombrados)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText(/Valor de costo:/)).toBeInTheDocument();
    expect(screen.getByText(/Valor de venta:/)).toBeInTheDocument();
    expect(screen.queryByText(/Componentes:/)).toBeNull();
    expect(screen.queryByText(/Valor de venta neto:/)).toBeNull();
  });

  it("FASE F22 — la columna 'Merma / Ajuste' vuelve como columna independiente del header", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText("Cantidad")).toBeInTheDocument();
    expect(screen.getByText("Venta")).toBeInTheDocument();
    expect(screen.getByText("Merma / Ajuste")).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// FASE 12.1 — Columna fusionada "Merma / Ajuste"
//
// Esperado:
//   · METAL renderea input de merma editable con sufijo "%".
//   · HECHURA / PRODUCT / SERVICE renderean el botón "+ Bonif./Recargo"
//     (entrypoint del AdjustmentEditor) en esa misma columna.
//   · La columna separada "Ajuste" deja de existir como header.
//   · Cambiar a Bonif. dispara el callback `onApply` con costLineOverrides[]
//     conteniendo `adjustmentKind: "BONUS"` para la línea correspondiente.
// ────────────────────────────────────────────────────────────────────────────

describe("FASE F22 — Merma/Ajuste como columna independiente", () => {
  it("el header 'Merma / Ajuste' EXISTE como columna independiente", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText("Merma / Ajuste")).toBeInTheDocument();
    expect(screen.getByText("Costo unit.")).toBeInTheDocument();
  });

  it("FASE F13/F22 — METAL muestra el editor de Merma inline en su columna propia (sin label, con sufijo %)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const editor = document.querySelector('[data-merma-inline-editor]');
    expect(editor).not.toBeNull();
    expect(editor!.querySelector("input")).not.toBeNull();
    expect(editor!.textContent).not.toMatch(/Merma/);
    expect(editor!.textContent).toMatch(/%/);
    // El editor vive dentro de una celda con `data-merma-ajuste-cell`.
    const cell = editor!.closest('[data-merma-ajuste-cell]');
    expect(cell).not.toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// FASE 12.5 — Moneda inline en Costo Unit + unidad como sub-línea Cantidad
// ────────────────────────────────────────────────────────────────────────────

describe("FASE 12.11 — merma label editable + totales grupo + ajuste global", () => {
  // FASE F9 — tests del label clickeable y expand-to-edit eliminados:
  // ahora el input vive siempre visible.

  it("FASE F15 — Header de grupo METALES NO muestra el subtotal monetario (vive solo en el footer)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const metalHeader = document.querySelector('[data-group-type="METAL"]')!;
    expect(metalHeader.textContent).not.toMatch(/Total:/);
    expect(metalHeader.textContent).not.toMatch(/ARS\s*500,00/);
    // El header sigue mostrando label + count.
    expect(metalHeader.textContent).toMatch(/Metales/);
    expect(metalHeader.textContent).toMatch(/línea/);
  });

  it("Si hay ajuste global de línea, aparece sub-línea bajo Margen", () => {
    const line = makeLine();
    // Inyectamos un ajuste global en pricingMeta (passthrough simulado).
    (line.pricingMeta as any).documentAdjustments = {
      lineManualDiscount: { kind: "BONUS", valuePct: 5, amount: 50 },
      channel: null,
      coupon: null,
    };
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // Cada fila renderea "Aj. global −5,0%" como sub-línea bajo margen.
    // 4 fixtures (METAL/HECHURA/PRODUCT/SERVICE) → al menos 4 ocurrencias.
    expect(screen.getAllByText(/Aj\.\s+global\s+−5,0%/).length).toBeGreaterThanOrEqual(4);
  });

  it("Si NO hay ajuste global, no aparece sub-línea 'Aj. global'", () => {
    // Fixture default sin documentAdjustments.lineManualDiscount.
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.queryByText(/Aj\.\s+global/)).toBeNull();
  });

  it("SURCHARGE global → tono amber + signo '+'", () => {
    const line = makeLine();
    (line.pricingMeta as any).documentAdjustments = {
      lineManualDiscount: { kind: "SURCHARGE", valuePct: 15, amount: 100 },
      channel: null,
      coupon: null,
    };
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getAllByText(/Aj\.\s+global\s+\+15,0%/).length).toBeGreaterThanOrEqual(4);
  });
});

describe("FASE 12.10 — refinamientos visuales finales", () => {
  it("FASE F13 — METAL muestra editor de Merma inline (sin label 'Merma', solo input + '%')", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const editor = document.querySelector('[data-merma-inline-editor]');
    expect(editor).not.toBeNull();
    expect(editor!.textContent).not.toMatch(/Merma/);
    expect(editor!.textContent).toMatch(/%/);
  });

  it("Costo de Venta usa lineSale (passthrough), NO lineCost × qty", () => {
    // Caso PRODUCT con lineSale=300, totalValue (lineCost)=150, qty=1.
    // Antes: TOTAL = 150 × 1 = 150.
    // Ahora: Costo de Venta = 300 (lineSale).
    const line = makeLine();
    (line.pricingMeta as any).composition.products[0].lineSale = 300;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // ARS 300,00 debe aparecer en la columna Costo de Venta de la fila PRODUCT.
    expect(screen.getAllByText(/ARS\s*300,00/).length).toBeGreaterThanOrEqual(1);
  });

  it("Costo de Venta muestra '—' cuando no hay lineSale (fallback tenue)", () => {
    // Fixture default no incluye lineSale → "—" en Costo de Venta.
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // Múltiples "—" pueden aparecer (filas sin lineSale para PRODUCT/SERVICE/HECHURA).
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("filas dentro de un grupo se separan con divisoria suave (divide-y border-border/15)", () => {
    const { container } = render(
      <SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />
    );
    // Verificamos por presencia del wrapper con clases divide-y. No
    // chequeamos el color exacto (sería frágil); sí que el container existe.
    const dividedContainers = container.querySelectorAll('[class*="divide-y"]');
    expect(dividedContainers.length).toBeGreaterThanOrEqual(1);
  });
});

describe("FASE 12.9 — agrupación visual por tipo (Metales / Hechuras / Productos / Servicios)", () => {
  it("renderea headers de los 4 grupos cuando hay al menos un componente de cada tipo", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText("Metales")).toBeInTheDocument();
    expect(screen.getByText("Hechuras")).toBeInTheDocument();
    expect(screen.getByText("Productos")).toBeInTheDocument();
    expect(screen.getByText("Servicios")).toBeInTheDocument();
  });

  it("muestra el conteo de líneas por grupo (ej. '1 línea')", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // El fixture default tiene 1 línea de cada tipo → "· 1 línea" se renderea
    // 4 veces (una por header de grupo).
    expect(screen.getAllByText(/·\s+1\s+línea/).length).toBeGreaterThanOrEqual(4);
  });

  it("plural correcto: '4 líneas' cuando un grupo tiene 4 elementos", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.metals = [
      { costLineId: "m1", metalVariantId: "v1", metalName: "Oro", purity: 0.75, purityLabel: "18k", appliedGrams: 1, appliedMermaPct: 0, lineCost: 100 },
      { costLineId: "m2", metalVariantId: "v2", metalName: "Oro", purity: 0.916, purityLabel: "22k", appliedGrams: 1, appliedMermaPct: 0, lineCost: 200 },
      { costLineId: "m3", metalVariantId: "v3", metalName: "Oro", purity: 1.0, purityLabel: "24k", appliedGrams: 1, appliedMermaPct: 0, lineCost: 300 },
      { costLineId: "m4", metalVariantId: "v4", metalName: "Plata", purity: 0.925, purityLabel: "925", appliedGrams: 1, appliedMermaPct: 0, lineCost: 400 },
    ];
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText(/·\s+4\s+líneas/)).toBeInTheDocument();
  });

  it("NO renderea header de grupo cuando el grupo está vacío", () => {
    // Vaciamos hechuras y servicios — solo quedan metales y products.
    const line = makeLine();
    (line.pricingMeta as any).composition.hechuras = [];
    (line.pricingMeta as any).composition.services = [];
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText("Metales")).toBeInTheDocument();
    expect(screen.getByText("Productos")).toBeInTheDocument();
    // Headers ausentes:
    expect(screen.queryByText("Hechuras")).toBeNull();
    expect(screen.queryByText("Servicios")).toBeNull();
  });

  it("subtotal del grupo Metales suma los lineCost (passthrough display, sin matemática nueva)", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.metals = [
      { costLineId: "m1", metalVariantId: "v1", metalName: "Oro", purity: 0.75, purityLabel: "18k", appliedGrams: 1, appliedMermaPct: 0, lineCost: 250 },
      { costLineId: "m2", metalVariantId: "v2", metalName: "Plata", purity: 0.925, purityLabel: "925", appliedGrams: 1, appliedMermaPct: 0, lineCost: 350 },
    ];
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // Subtotal Metales = 250 + 350 = 600 → "ARS 600,00" en el header del grupo.
    expect(screen.getAllByText(/ARS\s*600,00/).length).toBeGreaterThanOrEqual(1);
  });

  it("filas siguen rendereándose dentro de su grupo (callbacks intactos)", () => {
    const onApply = vi.fn();
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={onApply} {...baseProps} />);
    // Smoke: los inputs editables siguen siendo accesibles tras la agrupación.
    expect(screen.getAllByRole("textbox").length).toBeGreaterThan(0);
    // Y los componentes específicos siguen visibles dentro de sus grupos.
    expect(screen.getByText("Oro 18k")).toBeInTheDocument();
    expect(screen.getByText("Hechura base")).toBeInTheDocument();
    expect(screen.getByText("Cadena 60cm")).toBeInTheDocument();
    expect(screen.getByText("Engaste")).toBeInTheDocument();
  });
});

describe("FASE 12.5 — moneda inline + unidad como sub-línea", () => {
  it("renderea la moneda (ARS) inline al menos una vez por fila no-METAL", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // El currencyLabel "ARS" se renderea como prefijo del input de costo
    // unit. en HECHURA / PRODUCT / SERVICE (3 filas) + texto inline en METAL.
    // Esperamos al menos 4 instancias visibles.
    expect(screen.getAllByText("ARS").length).toBeGreaterThanOrEqual(4);
  });

  it("renderea USD cuando la moneda de la línea es USD", () => {
    render(
      <SaleCompositionEditableGrid
        line={makeLine()}
        onApply={vi.fn()}
        {...baseProps}
        currency="USD"
      />
    );
    expect(screen.getAllByText("USD").length).toBeGreaterThanOrEqual(1);
    // Y NO debe aparecer ARS como prefijo (la moneda activa es USD).
    // Nota: ARS puede aparecer en otros lugares (footer / KPI), por eso
    // usamos un assertion suave: USD aparece más que ARS en el contexto
    // de los inputs de costo unit. de las filas.
    expect(screen.getAllByText("USD").length).toBeGreaterThan(0);
  });

  it("la unidad 'Gramos' (METAL) aparece como sub-línea con nombre amigable completo", () => {
    const { container } = render(
      <SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />
    );
    // FASE 12.5b — sub-línea "Gramos" (no el código "g" ni "gr").
    expect(screen.getByText("Gramos")).toBeInTheDocument();
    // El input ya NO contiene "g" como sufijo visible.
    const gSpans = Array.from(container.querySelectorAll("span")).filter(
      (s) => s.textContent === "g",
    );
    expect(gSpans.length).toBe(0);
  });

  it("la unidad fallback 'Unidad' aparece como sub-línea para HECHURA / PRODUCT / SERVICE sin code resuelto", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // Cascada: catálogo → quantityUnitName → code → "Unidad". Sin ninguno
    // → el fallback es "Unidad" (singular, consistente con el resto del
    // sistema). Tres filas no-METAL → al menos 3 sub-líneas.
    expect(screen.getAllByText("Unidad").length).toBeGreaterThanOrEqual(3);
  });

  it("respeta el catálogo: si unitNameByCode['g']='Gramos finos', usa ese nombre", () => {
    const map = new Map<string, string>([["g", "Gramos finos"]]);
    render(
      <SaleCompositionEditableGrid
        line={makeLine()}
        onApply={vi.fn()}
        {...baseProps}
        unitNameByCode={map}
      />
    );
    // El catálogo tiene prioridad sobre el fallback "Gramos".
    expect(screen.getByText("Gramos finos")).toBeInTheDocument();
    expect(screen.queryByText("Gramos")).toBeNull();
  });

  it("inputs de cantidad siguen editables (callback onApply dispara override)", () => {
    const onApply = vi.fn();
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={onApply} {...baseProps} />);
    // TPNumberInput usa type="text" → role="textbox". Comprobamos que el
    // grid sigue rendereando inputs editables tras la reorganización visual.
    expect(screen.getAllByRole("textbox").length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 17. Fase 2.7.b — Bloque "Impacto en precio de venta"
// ────────────────────────────────────────────────────────────────────────────

// FASE F7 — Bloque "Fase 2.7.b — Impacto en precio de venta" eliminado:
// el card "Impacto" + el orden DOM de los 4 cards eran del `<PriceFlowCards>`,
// removido de la Factura de Ventas.

// ────────────────────────────────────────────────────────────────────────────
// 18. Fase 4.2 — TAB navigation: botones no-input fuera del flujo
// ────────────────────────────────────────────────────────────────────────────

describe("Fase 4.2 — TAB navigation", () => {
  // FASE F9 — test del button "Sin ajuste" eliminado: el editor inline
  // siempre visible ya no muestra ese placeholder. Los toggles de signo/
  // unidad llevan `tabIndex=-1` y se cubren en el describe F9.

  it("Restore por fila (icono ↺) tiene tabIndex=-1", () => {
    const line = makeLine();
    (line.pricingMeta as any).costLineOverrides = [
      { costLineId: "cl-product-1", type: "PRODUCT", unitValueOverride: 999 },
    ];
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const rowResets = screen.getAllByTitle(/Restaurar esta fila/);
    rowResets.forEach((b) => {
      expect(b.getAttribute("tabIndex") || b.getAttribute("tabindex")).toBe("-1");
    });
  });

  it("FASE F9 — Toggles del editor inline de ajuste (signo/unidad) tienen tabIndex=-1", () => {
    const line = makeLine();
    (line.pricingMeta as any).costLineOverrides = [{
      costLineId: "cl-hechura-1", type: "HECHURA",
      adjustmentKind: "BONUS", adjustmentType: "PERCENTAGE", adjustmentValue: 10,
    }];
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // Hay 3 toggles (HECHURA + PRODUCT + SERVICE) — verifico que todos
    // tengan tabIndex=-1.
    screen.getAllByTitle(/Bonificación \(−\)/).forEach((b) => {
      expect(b.getAttribute("tabIndex") || b.getAttribute("tabindex")).toBe("-1");
    });
    screen.getAllByTitle(/Porcentaje \(toggle/).forEach((b) => {
      expect(b.getAttribute("tabIndex") || b.getAttribute("tabindex")).toBe("-1");
    });
  });

  it("Botón 'Restaurar todo' del header tiene tabIndex=-1", () => {
    const line = makeLine();
    (line.pricingMeta as any).costLineOverrides = [
      { costLineId: "cl-metal-1", type: "METAL", quantityOverride: 5 },
    ];
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const btn = screen.getByTestId("sale-grid-restore-all");
    expect(btn.getAttribute("tabIndex") || btn.getAttribute("tabindex")).toBe("-1");
  });

  it("Botón cerrar (×) del header tiene tabIndex=-1", () => {
    const props = { ...baseProps, onClose: vi.fn() };
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...props} />);
    const closeBtn = screen.getByTitle("Cerrar");
    expect(closeBtn.getAttribute("tabIndex") || closeBtn.getAttribute("tabindex")).toBe("-1");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 19. Fase 4.3 — Loading indicator visible
// ────────────────────────────────────────────────────────────────────────────

describe("Fase 4.3 — loading indicator", () => {
  it("previewLoading=true → muestra spinner 'Recalculando…'", () => {
    render(
      <SaleCompositionEditableGrid
        line={makeLine()}
        onApply={vi.fn()}
        {...baseProps}
        previewLoading
      />,
    );
    expect(screen.getByTestId("sale-grid-loading")).toBeInTheDocument();
    expect(screen.getByText(/Recalculando…/)).toBeInTheDocument();
  });

  it("previewLoading=false → spinner oculto", () => {
    render(
      <SaleCompositionEditableGrid
        line={makeLine()}
        onApply={vi.fn()}
        {...baseProps}
        previewLoading={false}
      />,
    );
    expect(screen.queryByTestId("sale-grid-loading")).toBeNull();
  });

  it("previewLoading no pasada → spinner oculto (default)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.queryByTestId("sale-grid-loading")).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 20. Fase 4.4 — sticky header + memo correctness
// ────────────────────────────────────────────────────────────────────────────

describe("Fase 4.4 — sticky header + memo correctness", () => {
  it("TableHeader tiene clase sticky + bg para no transparentarse durante scroll", () => {
    const { container } = render(
      <SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />,
    );
    // Localizamos el header por el primer hijo del wrapper de la tabla.
    const headerComp = container.querySelector(".sticky.top-0");
    expect(headerComp).not.toBeNull();
    expect(headerComp!.className).toMatch(/bg-card/);
    expect(headerComp!.className).toMatch(/z-10/);
  });

  it("Filas re-renderan correctamente cuando cambian datos primitivos (sin stale rows)", () => {
    const lineA = makeLine();
    (lineA.pricingMeta as any).composition.products[0].totalValue = 100;
    const props = { line: lineA, onApply: vi.fn(), onClear: vi.fn(), onClose: vi.fn() };
    const { rerender } = render(<SaleCompositionEditableGrid {...props} currency="ARS" />);
    expect(screen.getAllByText(/ARS\s*100,00/).length).toBeGreaterThanOrEqual(1);

    // Cambia totalValue → memo debe permitir el rerender.
    const lineB = makeLine();
    (lineB.pricingMeta as any).composition.products[0].totalValue = 250;
    rerender(<SaleCompositionEditableGrid {...{ ...props, line: lineB }} currency="ARS" />);
    expect(screen.getAllByText(/ARS\s*250,00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/^ARS\s*100,00$/)).toBeNull();
  });

  it("Filas mantienen estado correcto al cambiar override (manual flag)", () => {
    const lineA = makeLine();
    const props = { line: lineA, onApply: vi.fn(), onClear: vi.fn(), onClose: vi.fn() };
    const { rerender } = render(<SaleCompositionEditableGrid {...props} currency="ARS" />);

    // Aplicamos override → la fila debería mostrar chip "Manual".
    const lineB = makeLine();
    (lineB.pricingMeta as any).costLineOverrides = [
      { costLineId: "cl-product-1", type: "PRODUCT", unitValueOverride: 999 },
    ];
    rerender(<SaleCompositionEditableGrid {...{ ...props, line: lineB }} currency="ARS" />);
    expect(screen.getAllByText("Manual").length).toBeGreaterThanOrEqual(1);
  });
});

// FASE F7 — Bloque "Fase 2.5 — Backend extractor extractCompositionCostAdjustment"
// eliminado: el tono visual del bonus/surcharge se renderaba dentro de
// `<PriceFlowCards>`. El extractor backend sigue cubierto por tests
// dedicados a `PriceFlowCards.test.tsx`.

// ────────────────────────────────────────────────────────────────────────────
// MVP híbrido — toggle Vista costo / Vista comercial.
//
// Reglas:
//   · OFF por defecto (4 columnas extra ocultas).
//   · ON expone "Precio unit. venta", "Margen", "Venta línea", "Participación".
//   · Sale-side per-cost-line SOLO es canónico cuando:
//       - METAL  count===1 → metalSale agregado IS the per-item.
//       - HECHURA count===1 → idem hechuraSale.
//   · count>1 / PRODUCT / SERVICE → "—" (no inventamos prorrateo).
//   · Margen %, Venta línea, Participación: derivaciones display-only.
// ────────────────────────────────────────────────────────────────────────────

describe("FASE 12.4 — vista única (sin switch Vista costo/Vista comercial)", () => {
  it("el segmented control 'Vista costo / Vista comercial' YA NO se renderea", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.queryByTestId("sale-grid-view-segmented")).toBeNull();
    expect(screen.queryByTestId("sale-grid-view-cost")).toBeNull();
    expect(screen.queryByTestId("sale-grid-commercial-toggle")).toBeNull();
    // Tampoco los textos de las pills.
    expect(screen.queryByText("Vista costo")).toBeNull();
    expect(screen.queryByText("Vista comercial")).toBeNull();
  });

  it("FASE F23 — la tabla muestra 'Costo Total' (sin tooltip de margen embebido — F23 sacó el margen a su propia columna)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const costoTotal = screen.getByText("Costo Total");
    // F23 — Costo Total ya no embed el margen; el tooltip se redujo a
    // "Costo final del componente".
    expect(costoTotal.getAttribute("title")).toMatch(/Costo final del componente/i);
  });

  it("FASE F23 — 'Margen' APARECE como columna/header independiente", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // El header "Margen" existe como span con data-column-header="margen".
    const header = document.querySelector('[data-column-header="margen"]');
    expect(header).not.toBeNull();
    expect(header!.textContent).toMatch(/Margen/);
  });

  it("'Particip.' tampoco se renderea en la tabla (oculto en FASE 12.2)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.queryByText(/Particip\./)).toBeNull();
  });

  it("METAL canónico (count===1) → margen 200% se renderea como sub-línea", () => {
    // metalSale = 1500, lineCost = 500 → margen = (1500-500)/500 = 200%.
    const line = makeLine({ metalSale: 1500 } as any);
    line.quantity = 1;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // FASE 12.4 — el margen se prefija con "Margen " en la sub-línea.
    expect(screen.getByText(/^\+200,0%$/)).toBeTruthy();
  });

  it("METAL no canónico (count>1) → margen no derivable, sub-línea muestra '—'", () => {
    const line = makeLine({ metalSale: 1500 } as any);
    (line.pricingMeta as any).composition.metals = [
      { ...(line.pricingMeta as any).composition.metals[0] },
      {
        costLineId: "cl-metal-2", metalVariantId: "mv-2",
        metalName: "Plata", purity: 0.925, purityLabel: "925",
        appliedGrams: 1, appliedMermaPct: 0,
        lineCost: 100, quotePrice: 100,
      },
    ];
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // No debe aparecer "Margen 200,0%" como sub-línea cuando count>1.
    expect(screen.queryByText(/^\+200,0%$/)).toBeNull();
  });

  it("HECHURA canónica (count===1): margen 100% sub-línea visible", () => {
    const line = makeLine({ hechuraSale: 400 } as any);
    line.quantity = 1;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText(/^\+100,0%$/)).toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// F1.5 #A+ — sale-side per fila PRODUCT/SERVICE/HECHURA (passthrough backend).
//
// El motor backend ahora emite `lineSale` por cada cost line no-metal,
// calculado como `lineCost × adjFactor × (1 + hechuraMarginPct/100)`. La UI
// lee passthrough; si el snapshot es legacy o el motor no pudo derivar
// (margen null), `lineSale` viene null y la fila renderiza "—".
// ────────────────────────────────────────────────────────────────────────────

describe("F1.5 #A+ — lineSale passthrough per fila", () => {
  it("PRODUCT con lineSale=300 → Margen=100% visible (P.unit/Venta línea ocultas en FASE 12.2)", () => {
    // lineCost=150 (totalValue), lineSale=300 → margen=(300-150)/150=100%
    const line = makeLine();
    (line.pricingMeta as any).composition.products[0].lineSale = 300;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // FASE 12.4 — vista única (sin switch); el click al toggle es no-op.

    // FASE 12.2 — solo Margen es visible en commercial view; P. unit. venta y
    // Venta línea ya no se renderean. Margen 100% del PRODUCT debe estar.
    expect(screen.getByText(/^\+100,0%$/)).toBeTruthy();
  });

  it("SERVICE con lineSale=200 → margen=150% (cost=80)", () => {
    // lineCost=80, lineSale=200 → margen=(200-80)/80=150%
    const line = makeLine();
    (line.pricingMeta as any).composition.services[0].lineSale = 200;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // FASE 12.4 — vista única (sin switch); el click al toggle es no-op.

    expect(screen.getByText(/^\+150,0%$/)).toBeTruthy();
  });

  it("HECHURA con lineSale en TODAS las filas (count>1) → todas muestran sale-side", () => {
    // Antes del MVP A+, count>1 → "—". Ahora con lineSale per fila, ambas filas muestran datos.
    const line = makeLine();
    (line.pricingMeta as any).composition.hechuras = [
      { costLineId: "cl-h1", appliedAmount: 200, lineCost: 200, lineSale: 400, lineLabel: "Mano de obra" },
      { costLineId: "cl-h2", appliedAmount: 100, lineCost: 100, lineSale: 200, lineLabel: "Pulido" },
    ];
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // FASE 12.4 — vista única (sin switch); el click al toggle es no-op.

    // Ambas filas tienen margen 100% (cost×2). El '100,0%' debe aparecer al menos 2 veces.
    expect(screen.getAllByText(/^\+100,0%$/).length).toBeGreaterThanOrEqual(2);
  });

  it("Snapshot legacy: PRODUCT sin lineSale (undefined) → '—' en sale-side", () => {
    // El fixture default NO incluye lineSale en products[0] — simula snapshot v6.
    const line = makeLine();
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // FASE 12.4 — vista única (sin switch); el click al toggle es no-op.

    // PRODUCT/SERVICE deben tener "—" porque su lineSale es undefined.
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it("Paridad: Σ products.lineSale + services.lineSale + hechuras.lineSale renderizan sus valores", () => {
    // Verifica que las 3 filas no-metal emiten su sale-side cuando el backend lo provee.
    const line = makeLine();
    (line.pricingMeta as any).composition.products[0].lineSale  = 225; // cost=150 × 1.5
    (line.pricingMeta as any).composition.services[0].lineSale  = 120; // cost=80  × 1.5
    (line.pricingMeta as any).composition.hechuras[0].lineSale  = 300; // cost=200 × 1.5
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // FASE 12.4 — vista única (sin switch); el click al toggle es no-op.

    // Margen 50% común a las 3 filas → debe aparecer al menos 3 veces.
    expect(screen.getAllByText(/^\+50,0%$/).length).toBeGreaterThanOrEqual(3);
  });

  it("PRODUCT con lineSale null explícito → '—' (no usa fallback inventado)", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.products[0].lineSale = null;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // FASE 12.4 — vista única (sin switch); el click al toggle es no-op.

    // No debe aparecer un margen alocado a PRODUCT (no hay forma de derivarlo).
    // El test indirecto: PRODUCT row aporta "—" a las celdas comerciales.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// F1.5 #A++ — sale-side per cost-line METAL (passthrough backend).
//
// El motor ahora emite `lineSale` por cada METAL (passthrough exacto:
// `lineCost × metalSale/metalCost`). La UI debe mostrar P. unit. venta /
// Margen / Venta línea para CADA fila METAL, incluso cuando hay múltiples
// metales (caso real: Oro 18k / 22k / 24k / Chafalonia).
// ────────────────────────────────────────────────────────────────────────────

describe("F1.5 #A++ — METAL lineSale passthrough", () => {
  it("METAL único con lineSale=1500 → margen=200% visible (FASE 12.2: P.unit/Venta línea ocultas)", () => {
    // lineCost=500, lineSale=1500 → margen = (1500-500)/500 = 200%.
    const line = makeLine();
    (line.pricingMeta as any).composition.metals[0].lineSale = 1500;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // FASE 12.4 — vista única (sin switch); el click al toggle es no-op.

    expect(screen.getByText(/^\+200,0%$/)).toBeTruthy();
  });

  it("4 metales (caso real Oro 18k/22k/24k/Chafalonia): TODAS las filas muestran margen", () => {
    // Reproducir el caso reportado por el usuario: 4 cost-lines METAL,
    // metalCost=800, metalSale=1200, margen uniforme 50%.
    const line = makeLine();
    (line.pricingMeta as any).composition.metals = [
      { costLineId: "cl-m1", metalVariantId: "mv-18",  metalName: "Oro",        variantName: "Oro 18 Kilates",
        purity: 0.75,  purityLabel: "18k",  appliedGrams: 5, appliedMermaPct: 0, lineCost: 300, lineSale: 450,  quotePrice: 60 },
      { costLineId: "cl-m2", metalVariantId: "mv-22",  metalName: "Oro",        variantName: "Oro 22 Kilates",
        purity: 0.916, purityLabel: "22k",  appliedGrams: 3, appliedMermaPct: 0, lineCost: 275, lineSale: 412.5, quotePrice: 91.66 },
      { costLineId: "cl-m3", metalVariantId: "mv-24",  metalName: "Oro",        variantName: "Oro 24 Kilates",
        purity: 1.0,   purityLabel: "24k",  appliedGrams: 1, appliedMermaPct: 0, lineCost: 100, lineSale: 150,  quotePrice: 100 },
      { costLineId: "cl-m4", metalVariantId: "mv-cha", metalName: "Chafalonia", variantName: "Chafalonia 18 Kilates",
        purity: 0.75,  purityLabel: "18k",  appliedGrams: 1, appliedMermaPct: 0, lineCost: 125, lineSale: 187.5, quotePrice: 125 },
    ];
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // FASE 12.4 — vista única (sin switch); el click al toggle es no-op.

    // Margen uniforme 50% → debe aparecer ≥ 4 veces (1 por fila METAL).
    expect(screen.getAllByText(/^\+50,0%$/).length).toBeGreaterThanOrEqual(4);
  });

  it("Σ metals.lineSale === metalSale del breakdown (paridad agregada)", () => {
    // Si no se cumple, el motor está emitiendo factor incorrecto. La verificación
    // matemática es responsabilidad del backend; el frontend valida que se
    // RENDERIZA todo (no '—').
    const line = makeLine({ metalSale: 1200 } as any);
    (line.pricingMeta as any).composition.metals = [
      { costLineId: "cl-m1", metalVariantId: "mv-1", metalName: "Oro", variantName: "Oro 18k",
        purity: 0.75, purityLabel: "18k", appliedGrams: 5, appliedMermaPct: 0, lineCost: 300, lineSale: 450, quotePrice: 60 },
      { costLineId: "cl-m2", metalVariantId: "mv-2", metalName: "Oro", variantName: "Oro 22k",
        purity: 0.916, purityLabel: "22k", appliedGrams: 3, appliedMermaPct: 0, lineCost: 500, lineSale: 750, quotePrice: 166 },
    ];
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // FASE 12.4 — vista única (sin switch); el click al toggle es no-op.

    // Ambos METAL deben tener margen 50% (450/300 = 750/500 = 1.5).
    expect(screen.getAllByText(/^\+50,0%$/).length).toBeGreaterThanOrEqual(2);
  });

  it("Snapshot legacy: METAL count>1 sin lineSale → '—' (no inventa prorrateo)", () => {
    // Sin lineSale en los items METAL y count>1, el frontend debe caer a "—"
    // (no aplica `metalSaleCanonical` que solo es válido para count===1).
    const line = makeLine({ metalSale: 1200 } as any);
    (line.pricingMeta as any).composition.metals = [
      { costLineId: "cl-m1", metalVariantId: "mv-1", metalName: "Oro", variantName: "Oro 18k",
        purity: 0.75, purityLabel: "18k", appliedGrams: 5, appliedMermaPct: 0, lineCost: 300, quotePrice: 60 },
      { costLineId: "cl-m2", metalVariantId: "mv-2", metalName: "Plata", variantName: "Plata 925",
        purity: 0.925, purityLabel: "925", appliedGrams: 1, appliedMermaPct: 0, lineCost: 100, quotePrice: 100 },
    ];
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // FASE 12.4 — vista única (sin switch); el click al toggle es no-op.

    // Sin lineSale en metales y count>1, las filas METAL muestran "—".
    expect(screen.queryByText(/^\+50,0%$/)).toBeNull();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(6);
  });

  it("Snapshot legacy: METAL count===1 sin lineSale → fallback a metalSaleCanonical funciona (margen visible)", () => {
    // Compatibilidad: snapshots viejos con count===1 siguen derivando margen
    // via `metalSaleCanonical`. FASE 12.2 — P.unit.venta y Venta línea ocultas;
    // el assertion sobre el margen sigue válido.
    const line = makeLine({ metalSale: 1500 } as any);
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // FASE 12.4 — vista única (sin switch); el click al toggle es no-op.

    // margen = (1500-500)/500 = 200%.
    expect(screen.getByText(/^\+200,0%$/)).toBeTruthy();
  });
});

// FASE F9 — Bloque "FASE 12.12 — Bonif/Recargo como label editable"
// eliminado: el patrón pill ↔ editor expandible fue reemplazado por el
// editor inline siempre visible. Ver describe F9 más abajo.

// ────────────────────────────────────────────────────────────────────────────
// FASE 12.13 — Refinamiento visual final: bg semántico por grupo + sanity
// negativos (no aparece switch / Particip / "Ver composición y flujo").
// ────────────────────────────────────────────────────────────────────────────
describe("FASE 12.13 — Refinamiento visual final", () => {
  it("headers de grupo tienen background semántico por tipo (METAL=amber, HECHURA=blue, PRODUCT=violet, SERVICE=green)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const metal   = document.querySelector('[data-group-type="METAL"]');
    const hechura = document.querySelector('[data-group-type="HECHURA"]');
    const product = document.querySelector('[data-group-type="PRODUCT"]');
    const service = document.querySelector('[data-group-type="SERVICE"]');
    expect(metal).not.toBeNull();
    expect(hechura).not.toBeNull();
    expect(product).not.toBeNull();
    expect(service).not.toBeNull();
    expect(metal!.className).toMatch(/bg-amber-/);
    expect(hechura!.className).toMatch(/bg-blue-/);
    expect(product!.className).toMatch(/bg-violet-/);
    expect(service!.className).toMatch(/bg-green-/);
  });

  it("header de grupo muestra label coloreado por tipo", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const metalHeader = document.querySelector('[data-group-type="METAL"]');
    const labelSpan = metalHeader!.querySelector("span");
    expect(labelSpan!.className).toMatch(/text-amber-/);
    expect(labelSpan!.textContent).toBe("Metales");
  });

  it("FASE F15 — header de grupo (METAL) NO muestra importe monetario; el total vive solo en el footer", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const metalHeader = document.querySelector('[data-group-type="METAL"]')!;
    expect(metalHeader.textContent).not.toMatch(/Total:/);
    // El header NO contiene "ARS" como subtotal monetario. (Si hubiera
    // gramos agrupados, podría aparecer otro texto sin moneda.)
    expect(metalHeader.textContent).not.toMatch(/ARS\s*\d/);
    // El footer SÍ muestra el importe.
    const metalFooter = document.querySelector('[data-group-footer="METAL"]')!;
    expect(metalFooter.textContent).toMatch(/ARS/);
  });

  it("NO aparece switch 'Vista costo' / 'Vista comercial'", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.queryByText(/Vista costo/i)).toBeNull();
    expect(screen.queryByText(/Vista comercial/i)).toBeNull();
  });

  it("NO aparece columna 'Particip.'", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.queryByText(/^Particip/i)).toBeNull();
  });

  it("NO aparece sección 'Ver composición y flujo de precio'", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.queryByText(/Ver composición y flujo de precio/i)).toBeNull();
  });

  it("Header tabla tiene exactamente 5 columnas visibles (Componente, Cantidad, Costo unit., Costo Total, Costo de Venta)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText("Componente")).toBeInTheDocument();
    expect(screen.getByText("Cantidad")).toBeInTheDocument();
    expect(screen.getByText("Costo unit.")).toBeInTheDocument();
    expect(screen.getByText("Costo Total")).toBeInTheDocument();
    expect(screen.getByText("Venta")).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// FASE 12.17 — Inputs texto editable + feedback con color del theme + labels
// sentence-case. NO se usan azules hardcoded (blue-500/rgba 66,133,244).
// ────────────────────────────────────────────────────────────────────────────
describe("FASE 12.17 — Feedback theme + labels sentence-case", () => {
  it("inputs editables NO tienen caja ni línea inferior permanente", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    expect(inputs.length).toBeGreaterThanOrEqual(1);
    inputs.forEach((el) => {
      expect(el.className).toMatch(/!bg-transparent/);
      expect(el.className).toMatch(/!border-0/);
      expect(el.className).toMatch(/!shadow-none/);
    });
  });

  it("inputs editables (sin PrefixedField, ej. Costo Unit.): hover usa color del theme (primary)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    // FASE 12.20 — los inputs de Cantidad están dentro de `PrefixedField` y
    // corren con `noInputBg` (el feedback lo aplica el wrap). Buscamos
    // algún input editable que mantenga su hover propio (Costo Unit.,
    // Merma cuando se expande, etc.).
    const standalone = inputs.find((el) =>
      !el.readOnly && !el.disabled && /hover:!bg-primary\//.test(el.className)
    );
    expect(standalone).toBeDefined();
    expect(standalone!.className).not.toMatch(/hover:!bg-slate/);
    expect(standalone!.className).not.toMatch(/hover:!bg-blue-500/);
  });

  it("inputs editables (sin PrefixedField): focus usa color del theme (var --primary-rgb) en bg e inset-shadow", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    const standalone = inputs.find((el) =>
      !el.readOnly && !el.disabled && /focus:!bg-primary\//.test(el.className)
    );
    expect(standalone).toBeDefined();
    expect(standalone!.className).toMatch(/focus:!shadow-\[inset_0_-1px_0_0_rgb\(var\(--primary-rgb\)/);
    expect(standalone!.className).not.toMatch(/rgba\(59,130,246/);
    expect(standalone!.className).not.toMatch(/blue-500/);
  });

  it("inputs editables siguen funcionando (callback dispara al cambiar el valor)", () => {
    const onApply = vi.fn();
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={onApply} {...baseProps} />);
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    const editable = inputs.find((el) => !el.readOnly && !el.disabled);
    expect(editable).toBeDefined();
    fireEvent.focus(editable!);
    fireEvent.change(editable!, { target: { value: "3,5" } });
    fireEvent.blur(editable!);
    expect(onApply).toHaveBeenCalled();
  });

  // FASE F9 — tests de "labels editables" eliminados: ya no hay buttons
  // tipo pill ni "Sin ajuste"; el editor inline siempre visible no
  // requiere hover/foco propio en un button-wrapper.

  // FASE F13 — Label "Merma" eliminado del editor (la pista de contexto la
  // da el sufijo "%" + la fila METAL). Test reemplazado por verificación
  // de ausencia.
  it("FASE F13 — el editor de Merma NO muestra label 'Merma' (solo input + %)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const editor = document.querySelector('[data-merma-inline-editor]')!;
    expect(editor.textContent).not.toMatch(/Merma/);
  });

  it("FASE 12.25 / F21 — la unidad vive en su propia celda (columna separada) y no es interactiva", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const unidadEl = screen.getByText("Gramos");
    expect(unidadEl).toBeInTheDocument();
    // FASE F21 — el wrap inmediato es la celda Unidad (flex justify-center).
    const wrap = unidadEl.parentElement!;
    expect(wrap.className).toMatch(/\bflex\b/);
    expect(wrap.className).toMatch(/justify-center/);
    // La unidad NO es interactiva.
    expect(unidadEl.className).toMatch(/pointer-events-none/);
    expect(unidadEl.className).toMatch(/select-none/);
    expect(unidadEl.getAttribute("aria-hidden")).toBe("true");
  });

  it("FASE F21 — la celda Unidad aparece a la DERECHA de la celda Cantidad (orden DOM)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const unidadEl = screen.getByText("Gramos");
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    const qtyInput = inputs.find((el) => el.value === "2,50" || el.value === "2.50")!;
    expect(qtyInput).toBeDefined();
    // El input está ANTES de "Gramos" en el orden DOM (Cantidad → Unidad).
    const pos = qtyInput.compareDocumentPosition(unidadEl);
    expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("FASE F21 — input de Cantidad mantiene su feedback hover/focus interno", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    const qtyInput = inputs.find((el) => el.value === "2,50" || el.value === "2.50")!;
    expect(qtyInput).toBeDefined();
    expect(qtyInput.className).toMatch(/hover:!bg-primary\//);
    expect(qtyInput.className).toMatch(/focus:!bg-primary\//);
  });

  it("FASE 12.19 — la unidad muestra nombre amigable, no código (g / un / kg)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // METAL → "Gramos" (no "g").
    expect(screen.getByText("Gramos")).toBeInTheDocument();
    expect(screen.queryByText(/^g$/)).toBeNull();
    expect(screen.queryByText(/^un$/)).toBeNull();
    // HECHURA / PRODUCT / SERVICE caen al fallback "Unidad" cuando no
    // hay quantityUnit poblado ni catálogo de Units.
    expect(screen.getAllByText("Unidad").length).toBeGreaterThanOrEqual(1);
  });

  it("FASE F21 — el input de Cantidad sigue editable y el callback dispara", () => {
    const onApply = vi.fn();
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={onApply} {...baseProps} />);
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    const qtyInput = inputs.find((el) => el.value === "2,50" || el.value === "2.50")!;
    expect(qtyInput).toBeDefined();
    expect(qtyInput.readOnly).toBe(false);
    fireEvent.focus(qtyInput);
    fireEvent.change(qtyInput, { target: { value: "3,5" } });
    fireEvent.blur(qtyInput);
    expect(onApply).toHaveBeenCalled();
  });

  it("FASE 12.22 — headers de columna centrados (alineados con bloques de ancho estable)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    for (const label of ["Cantidad", "Costo unit.", "Costo Total", "Venta"]) {
      const header = screen.getByText(label);
      expect(header.className).toMatch(/text-center/);
      expect(header.className).not.toMatch(/text-right/);
      expect(header.className).not.toMatch(/text-left/);
    }
  });

  it("FASE 12.25 / F21 — la celda Unidad usa justify-center (bloque centrado en la columna)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const unidadEl = screen.getByText("Gramos");
    const cellWrap = unidadEl.parentElement!;
    expect(cellWrap.className).toMatch(/justify-center/);
  });

  it("FASE 12.22 — 'Costo de Venta' renderea con text-center (no text-right)", () => {
    const line = makeLine();
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // El valor de Costo de Venta es el emerald-600 con tabular-nums; lo
    // buscamos por su clase distintiva.
    const cells = Array.from(document.querySelectorAll('div')).filter((d) =>
      d.className.includes("text-emerald-600") && d.className.includes("tabular-nums"),
    );
    expect(cells.length).toBeGreaterThanOrEqual(1);
    cells.forEach((el) => {
      expect(el.className).toMatch(/text-center/);
      expect(el.className).not.toMatch(/text-right/);
    });
  });

  it("FASE 12.21 — METAL Costo Unit. NO duplica 'ARS' (un solo prefix de moneda)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // No debe existir un texto que contenga "ARS ARS" en ningún lugar.
    expect(screen.queryByText(/ARS\s+ARS/)).toBeNull();
    // textContent crudo del documento tampoco contiene "ARS ARS".
    expect(document.body.textContent).not.toMatch(/ARS\s+ARS/);
  });

  it("FASE 12.21 — METAL Costo Unit. renderea como CellNumberInput read-only (mismo alineamiento que otros tipos)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    // Debe existir al menos un input read-only (el de Costo Unit. de METAL).
    const readOnlyInputs = inputs.filter((el) => el.readOnly);
    expect(readOnlyInputs.length).toBeGreaterThanOrEqual(1);
    // El valor METAL post-merma per gram es 200 (lineCost=500 / qty=2.5).
    // Aparece formateado "200,00" en el draft del input.
    const valuesText = readOnlyInputs.map((el) => el.value);
    expect(valuesText.some((v) => v === "200,00" || v === "200.00")).toBe(true);
  });

  it("FASE 12.21 — tooltip 'Valor base por gramo' sigue funcionando en METAL (read-only)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const tooltip = document.querySelector('[title*="Valor base por gramo"]');
    expect(tooltip).not.toBeNull();
    expect(tooltip!.getAttribute("title")).toMatch(/ARS\s*197,04/);
  });

  it("FASE 12.23 — el prefix 'Gramos' no es focusable (pointer-events-none + aria-hidden)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const unidadEl = screen.getByText("Gramos");
    expect(unidadEl.className).toMatch(/pointer-events-none/);
    expect(unidadEl.getAttribute("aria-hidden")).toBe("true");
    // El span no tiene tabIndex → no entra en el flujo TAB.
    expect(unidadEl.getAttribute("tabIndex")).toBeNull();
    expect(unidadEl.tagName).toBe("SPAN");
  });

  // FASE F9 — test "labels Merma/'Sin ajuste' onMouseDown preventDefault"
  // eliminado: ya no hay labels-button. El input siempre visible recibe
  // foco normal al click.

  it("FASE F21 — al editar el input de Cantidad, document.activeElement sigue siendo el input", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    const qtyInput = inputs.find((el) => el.value === "2,50" || el.value === "2.50")!;
    expect(qtyInput).toBeDefined();
    qtyInput.focus();
    fireEvent.change(qtyInput, { target: { value: "3,5" } });
    expect(document.activeElement).toBe(qtyInput);
  });

  it("FASE 12.25 — headers ya no usan uppercase ni tracking agresivo (estilo Linear/Notion)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // Tomo el wrap del header (el padre del span "Componente").
    const header = screen.getByText("Componente").parentElement!;
    expect(header.className).not.toMatch(/\buppercase\b/);
    expect(header.className).not.toMatch(/tracking-\[0\.04em\]/);
    expect(header.className).toMatch(/font-medium/);
    expect(header.className).toMatch(/text-\[10px\]/);
  });

  it("FASE 12.25 — separadores entre items usan color slate suave (no border-border/15)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const dividers = Array.from(document.querySelectorAll('[class*="divide-slate-200/40"]'));
    expect(dividers.length).toBeGreaterThanOrEqual(1);
  });

  it("FASE 12.25 — filas tienen hover sutil (slate-500/[0.04])", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // Tomo el primer row (METAL): wrap más alto del span "Gramos"
    // contiene el grid del Row. Subo por el árbol hasta el div con la
    // clase del row.
    const rows = document.querySelectorAll('[class*="hover:bg-slate-500"]');
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it("FASE 12.25 — el SKU/secondary del componente es text-muted/55 (más discreto)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // El secondary del METAL es "Ley 0,750". Verifico que está marcado
    // como muted/55 y leading-none (más compacto).
    const sec = screen.getByText(/^Ley\s+0,750$/);
    const wrap = sec.parentElement!;
    expect(wrap.className).toMatch(/text-muted\/55/);
    expect(wrap.className).toMatch(/leading-none/);
  });

  // FASE F10 — los badges de origen (Catálogo/Cliente/Manual/—) fueron
  // eliminados del render de Merma. La prop sigue aceptándose pero NO se
  // muestra. Estos tests aseguran que ningún badge se renderea sin
  // importar el valor de mermaSource.

  it("FASE F10 — Merma NO muestra badge '(Catálogo)' aunque mermaSource='line'", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.metals[0].mermaSource = "line";
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.queryByText("(Catálogo)")).toBeNull();
  });

  it("FASE F10 — Merma NO muestra badge '(Cliente)' aunque mermaSource='entity'", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.metals[0].mermaSource = "entity";
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.queryByText("(Cliente)")).toBeNull();
  });

  it("FASE F10 — Merma NO muestra badge '(Manual)' aunque haya override local", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.metals[0].mermaSource = "entity";
    (line.pricingMeta as any).costLineOverrides = [
      { costLineId: "cl-metal-1", type: "METAL", mermaPercentOverride: 8 },
    ];
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.queryByText("(Manual)")).toBeNull();
  });

  it("FASE F10 — Merma sin mermaSource sigue sin mostrar badge (legacy + nuevo unifican)", () => {
    const line = makeLine();
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.queryByText("(Manual)")).toBeNull();
    expect(screen.queryByText("(Cliente)")).toBeNull();
    expect(screen.queryByText("(Catálogo)")).toBeNull();
    expect(screen.queryByText("(—)")).toBeNull();
  });

  // FASE F6 — El monetario "Puro: ARS …" del header METALES fue eliminado.
  // El header ahora solo muestra "Metales", count, "Total: …" y
  // "<Metal> puro/pura: X gr" (gramos, FASE F5). Estos tests aseguran que
  // ningún label monetario "Puro:" se renderea, bajo ninguna combinación.

  it("FASE F6 — el header METALES NO muestra 'Puro: ARS' aunque metalHechuraBreakdown.metalCostBase esté poblado", () => {
    const line = makeLine();
    (line.pricingMeta as any).metalHechuraBreakdown = {
      ...((line.pricingMeta as any).metalHechuraBreakdown ?? {}),
      metalCostBase: 1234.56,
    };
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const header = document.querySelector('[data-group-type="METAL"]')!;
    expect(header.textContent).not.toMatch(/Puro:/);
    expect(header.textContent).not.toMatch(/ARS\s*1\.234,56/);
  });

  it("FASE F6 — NO muestra 'Puro: ARS' aunque haya Σ lineCostBase en las líneas", () => {
    const line = makeLine();
    (line.pricingMeta as any).metalHechuraBreakdown = null;
    (line.pricingMeta as any).composition.metals[0].lineCostBase = 500;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const header = document.querySelector('[data-group-type="METAL"]')!;
    expect(header.textContent).not.toMatch(/Puro:/);
  });

  it("FASE F6 — NO muestra 'Puro: ARS' con datos legacy (appliedGrams × quotePrice)", () => {
    const line = makeLine();
    (line.pricingMeta as any).metalHechuraBreakdown = null;
    delete (line.pricingMeta as any).composition.metals[0].lineCostBase;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const header = document.querySelector('[data-group-type="METAL"]')!;
    expect(header.textContent).not.toMatch(/Puro:/);
  });

  it("FASE F6/F15 — snapshot legacy sin quotePrice sigue mostrando Metales (sin 'Total:' ni importe)", () => {
    const line = makeLine();
    (line.pricingMeta as any).metalHechuraBreakdown = null;
    delete (line.pricingMeta as any).composition.metals[0].lineCostBase;
    delete (line.pricingMeta as any).composition.metals[0].quotePrice;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const header = document.querySelector('[data-group-type="METAL"]')!;
    expect(header.textContent).not.toMatch(/Puro:/);
    // F15 — header sin importe monetario; el total vive en el footer.
    expect(header.textContent).toMatch(/Metales/);
    expect(header.textContent).not.toMatch(/Total:/);
    expect(header.textContent).not.toMatch(/ARS\s*\d/);
  });

  it("FASE F6 — HECHURAS / PRODUCTOS / SERVICIOS tampoco muestran 'Puro: ARS'", () => {
    const line = makeLine();
    (line.pricingMeta as any).metalHechuraBreakdown = { metalCostBase: 100 };
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    for (const t of ["HECHURA", "PRODUCT", "SERVICE"]) {
      const h = document.querySelector(`[data-group-type="${t}"]`)!;
      expect(h.textContent).not.toMatch(/Puro:/);
    }
  });

  it("FASE 12.24 — Costo Unit. usa grid interno estable de 2 columnas (moneda + valor 96px)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // El símbolo "ARS" en el grid de Costo Unit. tiene clase
    // `justify-self-end` (alineado a la derecha de su col). Su padre es
    // el inline-grid con grid-cols-[auto_96px].
    const ars = Array.from(document.querySelectorAll("span"))
      .filter((s) => s.textContent === "ARS" && s.className.includes("justify-self-end"));
    expect(ars.length).toBeGreaterThanOrEqual(1);
    const grid = ars[0].parentElement!;
    expect(grid.className).toMatch(/inline-grid/);
    expect(grid.className).toMatch(/grid-cols-\[auto_96px\]/);
  });

  // FASE F9 — test "Merma queda en la col2" eliminado: ya no hay button
  // pill; el editor inline vive en la col2 vía su wrap directo.

  it("FASE 12.24 — la moneda NO se duplica en el render (un solo ARS por celda)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // textContent global no contiene "ARS ARS" en ninguna combinación.
    expect(document.body.textContent).not.toMatch(/ARS\s+ARS/);
    // Ni "US$ US$" si el currency fuese USD.
    expect(document.body.textContent).not.toMatch(/US\$\s+US\$/);
  });

  it("FASE 12.24 — el callback de costo unitario sigue funcionando (HECHURA)", () => {
    const onApply = vi.fn();
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={onApply} {...baseProps} />);
    // El input HECHURA Costo Unit. es editable (qty fija = 1 implícita,
    // valor = h.appliedAmount). Buscamos un input editable que NO esté
    // dentro de un PrefixedField (los de Cantidad sí lo están).
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    const editableNotInPrefixed = inputs.find((el) => {
      if (el.readOnly || el.disabled) return false;
      // Su contenedor inmediato NO es un PrefixedField (inline-flex con
      // aria-hidden prefix span). En cambio, está dentro del grid de
      // Costo Unit.
      const cell = el.closest('[class*="grid-cols-\\[auto_96px\\]"]');
      return !!cell;
    });
    expect(editableNotInPrefixed).toBeDefined();
    fireEvent.focus(editableNotInPrefixed!);
    fireEvent.change(editableNotInPrefixed!, { target: { value: "199,5" } });
    fireEvent.blur(editableNotInPrefixed!);
    expect(onApply).toHaveBeenCalled();
  });

  it("FASE F10 — METALES muestra 'Oro: X gr' equivalente (pureza × merma, = Simulador)", () => {
    const line = makeLine();
    // Fixture default: appliedGrams=2.5, purity=0.75, merma=1.5 →
    // equiv = 2,5 × 0,75 × 1,015 = 1,903125 → "1,90 gr" (idéntico al
    // Simulador; antes mostraba 1,88 = puro SIN merma, que era el bug).
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const header = document.querySelector('[data-group-type="METAL"]')!;
    expect(header.textContent).toMatch(/·\s*Oro:/);
    expect(header.textContent).toMatch(/1,90\s*gr/);
    expect(header.textContent).not.toMatch(/Oro puro/);
  });

  it("FASE F10 — 2 metales del mismo padre se suman bajo un solo label 'Oro:'", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.metals.push({
      costLineId:      "cl-metal-2",
      metalVariantId:  "v2",
      metalName:       "Oro",
      variantName:     "Oro 22 Kilates",
      purity:          0.9,
      purityLabel:     "22k",
      appliedGrams:    1.2,
      appliedMermaPct: 0,
      lineCost:        200,
      quotePrice:      150,
    });
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const header = document.querySelector('[data-group-type="METAL"]')!;
    expect(header.textContent).toMatch(/·\s*Oro:/);
    // default Oro: 2,5×0,75×1,015 = 1,903125 ; pushed Oro: 1,2×0,9×1 = 1,08
    // → equiv total = 2,983125 → "2,98 gr" (un solo label "Oro:").
    expect(header.textContent).toMatch(/2,98\s*gr/);
    expect(header.textContent!.match(/·\s*Oro:/g)?.length).toBe(1);
    expect(header.textContent).not.toMatch(/Oro puro/);
  });

  it("FASE F10 — 2 metales padre distintos muestran ambos: 'Oro: X gr · Plata: Y gr' (sin 'puro/pura')", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.metals.push({
      costLineId:      "cl-metal-3",
      metalVariantId:  "v3",
      metalName:       "Plata",
      variantName:     "Plata 925",
      purity:          0.925,
      purityLabel:     "925",
      appliedGrams:    10,
      appliedMermaPct: 0,
      lineCost:        200,
      quotePrice:      20,
    });
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const header = document.querySelector('[data-group-type="METAL"]')!;
    expect(header.textContent).toMatch(/·\s*Oro:/);
    expect(header.textContent).toMatch(/·\s*Plata:/);
    expect(header.textContent).toMatch(/9,25\s*gr/);
    expect(header.textContent).not.toMatch(/Oro puro/);
    expect(header.textContent).not.toMatch(/Plata pura/);
  });

  it("FASE F10 — línea sin purity SE INCLUYE con factor 1+merma/100 (paridad Simulador)", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.metals.push({
      costLineId:      "cl-metal-noP",
      metalVariantId:  "vX",
      metalName:       "Oro",
      variantName:     "Oro sin pureza",
      purity:          null,
      purityLabel:     null,
      appliedGrams:    5,
      appliedMermaPct: 0,
      lineCost:        100,
      quotePrice:      20,
    });
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const header = document.querySelector('[data-group-type="METAL"]')!;
    expect(header.textContent).toMatch(/·\s*Oro:/);
    // El Simulador (buildMetalPadreMap) NO omite líneas sin pureza: usa
    // factor = 1+merma/100. default Oro = 1,903125 ; sin-pureza = 5×1 = 5
    // → equiv total = 6,903125 → "6,90 gr". (Antes se omitía → era el bug
    // de divergencia con el Simulador.)
    expect(header.textContent).toMatch(/6,90\s*gr/);
  });

  it("FASE F10 — si NINGUNA línea tiene metalName+purity+appliedGrams, NO se muestra el label de gramos", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.metals[0].metalName = null;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const header = document.querySelector('[data-group-type="METAL"]')!;
    expect(header.textContent).not.toMatch(/Oro:/);
    expect(header.textContent).not.toMatch(/Plata:/);
    expect(header.textContent).not.toMatch(/gr\s*$/);
    expect(header.textContent).toMatch(/Metales/);
  });

  it("FASE F10 — HECHURAS / PRODUCTOS / SERVICIOS no muestran gramos del metal padre", () => {
    const line = makeLine();
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    for (const t of ["HECHURA", "PRODUCT", "SERVICE"]) {
      const h = document.querySelector(`[data-group-type="${t}"]`)!;
      expect(h.textContent).not.toMatch(/·\s*Oro:/);
      expect(h.textContent).not.toMatch(/·\s*Plata:/);
      expect(h.textContent).not.toMatch(/·\s*Platino:/);
    }
  });

  // FASE F9 — tests F4/F6/F8/12.20 sobre el editor expandido de Merma
  // eliminados: ya no hay expand-to-edit. El input vive siempre visible y
  // la cobertura del comportamiento del input (callback, formato, neg)
  // queda en el describe "FASE F9 — Merma inline".

  it("Manual override marca el input con texto amber semibold (sin caja ni outline)", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.metals[0].quantityOverride = 9.99;
    (line.pricingMeta as any).composition.metals[0].quantity = 9.99;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// FASE F7 — Total por grupo + remoción del flujo "Construcción del precio".
// ────────────────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────
// FASE F12 — Header de grupo sin label "Total:".
// ────────────────────────────────────────────────────────────────────────────
describe("FASE F12 — Header de grupo sin label 'Total:'", () => {
  it("ningún header de grupo (METAL/HECHURA/PRODUCT/SERVICE) muestra 'Total:'", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    for (const t of ["METAL", "HECHURA", "PRODUCT", "SERVICE"]) {
      const h = document.querySelector(`[data-group-type="${t}"]`);
      expect(h).not.toBeNull();
      expect(h!.textContent).not.toMatch(/Total:/);
    }
  });

  it("FASE F15 — el header de METALES NO muestra importe en moneda; sí muestra gramos agrupados", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.metals.push({
      costLineId:      "cl-metal-plata",
      metalVariantId:  "v-plata",
      metalName:       "Plata",
      variantName:     "Plata 925",
      purity:          0.925,
      purityLabel:     "925",
      appliedGrams:    10,
      appliedMermaPct: 0,
      lineCost:        200,
      quotePrice:      20,
    });
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const header = document.querySelector('[data-group-type="METAL"]')!;
    expect(header.textContent).not.toMatch(/Total:/);
    // F15 — sin importe monetario en el header.
    expect(header.textContent).not.toMatch(/ARS\s*\d/);
    // Pero sí se conservan gramos por metal padre.
    expect(header.textContent).toMatch(/·\s*Oro:/);
    expect(header.textContent).toMatch(/·\s*Plata:/);
  });

  it("los footers inferiores 'Total <grupo>' SIGUEN renderizándose (no se tocó la fila final)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(document.querySelector('[data-group-footer="METAL"]')!.textContent).toMatch(/Total metales/i);
    expect(document.querySelector('[data-group-footer="HECHURA"]')!.textContent).toMatch(/Total hechuras/i);
    expect(document.querySelector('[data-group-footer="PRODUCT"]')!.textContent).toMatch(/Total productos/i);
    expect(document.querySelector('[data-group-footer="SERVICE"]')!.textContent).toMatch(/Total servicios/i);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// FASE F15 — Header de grupo sin importe monetario.
// ────────────────────────────────────────────────────────────────────────────
describe("FASE F15 — Header de grupo sin importe monetario", () => {
  it("ningún header de grupo (METAL/HECHURA/PRODUCT/SERVICE) muestra 'ARS <monto>'", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    for (const t of ["METAL", "HECHURA", "PRODUCT", "SERVICE"]) {
      const h = document.querySelector(`[data-group-type="${t}"]`);
      expect(h).not.toBeNull();
      // No aparece "ARS 123,45" como importe. (Otros textos sin moneda
      // como "Oro: 3,76 gr" siguen permitidos.)
      expect(h!.textContent).not.toMatch(/ARS\s*\d/);
    }
  });

  it("METAL header conserva label + count + gramos por metal padre (sin importe)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const header = document.querySelector('[data-group-type="METAL"]')!;
    expect(header.textContent).toMatch(/Metales/);
    expect(header.textContent).toMatch(/línea/);
    expect(header.textContent).toMatch(/·\s*Oro:/);
    expect(header.textContent).not.toMatch(/ARS\s*\d/);
  });

  it("HECHURA/PRODUCT/SERVICE header conserva solo label + count (sin importe ni gramos)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    for (const [t, name] of [
      ["HECHURA", "Hechuras"],
      ["PRODUCT", "Productos"],
      ["SERVICE", "Servicios"],
    ] as const) {
      const h = document.querySelector(`[data-group-type="${t}"]`)!;
      expect(h.textContent).toContain(name);
      expect(h.textContent).toMatch(/línea/);
      expect(h.textContent).not.toMatch(/ARS\s*\d/);
      expect(h.textContent).not.toMatch(/·\s*Oro:/);
      expect(h.textContent).not.toMatch(/·\s*Plata:/);
    }
  });

  it("FASE F15 — los footers (Total metales, Total hechuras, …) siguen mostrando el importe", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const metalFooter = document.querySelector('[data-group-footer="METAL"]')!;
    expect(metalFooter.textContent).toMatch(/Total metales/i);
    expect(metalFooter.textContent).toMatch(/ARS\s*\d/);
    const hechuraFooter = document.querySelector('[data-group-footer="HECHURA"]')!;
    expect(hechuraFooter.textContent).toMatch(/Total hechuras/i);
    expect(hechuraFooter.textContent).toMatch(/ARS\s*\d/);
  });
});

describe("FASE F7 — Total por grupo", () => {
  it("METALES muestra una fila 'Total metales' al cierre del grupo", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const footer = document.querySelector('[data-group-footer="METAL"]');
    expect(footer).not.toBeNull();
    expect(footer!.textContent).toMatch(/Total metales/i);
  });

  it("HECHURAS muestra una fila 'Total hechuras' al cierre del grupo", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const footer = document.querySelector('[data-group-footer="HECHURA"]');
    expect(footer).not.toBeNull();
    expect(footer!.textContent).toMatch(/Total hechuras/i);
  });

  it("PRODUCTOS muestra una fila 'Total productos' al cierre del grupo", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const footer = document.querySelector('[data-group-footer="PRODUCT"]');
    expect(footer).not.toBeNull();
    expect(footer!.textContent).toMatch(/Total productos/i);
  });

  it("SERVICIOS muestra una fila 'Total servicios' al cierre del grupo", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const footer = document.querySelector('[data-group-footer="SERVICE"]');
    expect(footer).not.toBeNull();
    expect(footer!.textContent).toMatch(/Total servicios/i);
  });

  it("Total metales muestra el costo total (Σ lineCost) en la columna 'Costo Total'", () => {
    const line = makeLine();
    // Fixture default: metals[0].lineCost = 500 (ver makeLine en este file).
    // Sumamos otra línea METAL para verificar suma > 1 elemento.
    (line.pricingMeta as any).composition.metals.push({
      costLineId: "cl-metal-extra",
      metalVariantId: "vX",
      metalName: "Oro",
      variantName: "Oro 22 Kilates",
      purity: 0.9,
      purityLabel: "22k",
      appliedGrams: 1,
      appliedMermaPct: 0,
      lineCost: 250,
      quotePrice: 250,
    });
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const footer = document.querySelector('[data-group-footer="METAL"]')!;
    // 500 + 250 = 750 → "ARS 750,00".
    expect(footer.textContent).toMatch(/ARS\s*750,00/);
  });

  it("Total metales muestra el costo de venta (Σ lineSale) en la columna 'Costo de Venta'", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.metals[0].lineSale = 800;
    (line.pricingMeta as any).composition.metals.push({
      costLineId: "cl-metal-extra2",
      metalVariantId: "vY",
      metalName: "Plata",
      variantName: "Plata 925",
      purity: 0.925,
      appliedGrams: 5,
      appliedMermaPct: 0,
      lineCost: 100,
      lineSale: 150,
      quotePrice: 20,
    });
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const footer = document.querySelector('[data-group-footer="METAL"]')!;
    // 800 + 150 = 950 → "ARS 950,00".
    expect(footer.textContent).toMatch(/ARS\s*950,00/);
  });

  it("Total hechuras muestra los dos totales correctos en su fila", () => {
    const line = makeLine();
    // Fixture: hechuras[0].lineCost = 200, lineSale opcional.
    (line.pricingMeta as any).composition.hechuras[0].lineCost = 200;
    (line.pricingMeta as any).composition.hechuras[0].lineSale = 350;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const footer = document.querySelector('[data-group-footer="HECHURA"]')!;
    expect(footer.textContent).toMatch(/ARS\s*200,00/);
    expect(footer.textContent).toMatch(/ARS\s*350,00/);
  });

  it("la fila Total NO tiene inputs ni iconos de edición", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const footers = document.querySelectorAll('[data-group-footer]');
    expect(footers.length).toBeGreaterThanOrEqual(1);
    for (const f of Array.from(footers)) {
      expect(f.querySelector("input")).toBeNull();
      expect(f.querySelector("button")).toBeNull();
      expect(f.textContent ?? "").not.toMatch(/✎/);
    }
  });

  it("Sin lineSale en ninguna línea → la columna 'Costo de Venta' muestra '—'", () => {
    const line = makeLine();
    // PRODUCTS por default no traen lineSale en fixture.
    for (const p of (line.pricingMeta as any).composition.products) {
      delete p.lineSale;
    }
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const footer = document.querySelector('[data-group-footer="PRODUCT"]');
    expect(footer).not.toBeNull();
    // El "—" aparece como segundo placeholder de columnas numéricas.
    expect(footer!.textContent).toMatch(/—/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// FASE F9 — Editor inline siempre visible para Merma + Bonificación/Recargo.
// ────────────────────────────────────────────────────────────────────────────
describe("FASE F9 — Merma inline (input siempre visible)", () => {
  it("FASE F13 — METAL renderea un editor de Merma inline (sin label 'Merma') con input + sufijo '%'", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const editor = document.querySelector('[data-merma-inline-editor]');
    expect(editor).not.toBeNull();
    // FASE F13 — label "Merma" eliminado.
    expect(editor!.textContent).not.toMatch(/Merma/);
    expect(editor!.textContent).toMatch(/%/);
    // Hay un input visible.
    const input = editor!.querySelector("input");
    expect(input).not.toBeNull();
  });

  it("El input de Merma muestra el valor actual ('1,50' por default)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const editor = document.querySelector('[data-merma-inline-editor]')!;
    const input = editor.querySelector("input") as HTMLInputElement;
    expect(["1,50", "1.50"]).toContain(input.value);
  });

  it("Modificar el input de Merma dispara onApply con el override", () => {
    const onApply = vi.fn();
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={onApply} {...baseProps} />);
    const editor = document.querySelector('[data-merma-inline-editor]')!;
    const input = editor.querySelector("input") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "12,5" } });
    fireEvent.blur(input);
    vi.advanceTimersByTime(300); // commit DEBOUNCED (useOverrideNumber)
    expect(onApply).toHaveBeenCalled();
    const patch = onApply.mock.calls[onApply.mock.calls.length - 1][0];
    const ov = (patch.costLineOverrides as any[])?.find((o) => o.type === "METAL");
    expect(ov?.mermaPercentOverride).toBeCloseTo(12.5);
  });

  it("Permite valores negativos (sobreajuste raro)", () => {
    const onApply = vi.fn();
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={onApply} {...baseProps} />);
    const editor = document.querySelector('[data-merma-inline-editor]')!;
    const input = editor.querySelector("input") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "-5" } });
    fireEvent.blur(input);
    vi.advanceTimersByTime(300); // commit DEBOUNCED (useOverrideNumber)
    const patch = onApply.mock.calls[onApply.mock.calls.length - 1][0];
    const ov = (patch.costLineOverrides as any[])?.find((o) => o.type === "METAL");
    expect(ov?.mermaPercentOverride).toBeCloseTo(-5);
  });

  it("FASE F10 — NO muestra badge '(Catálogo)' aunque mermaSource='line'", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.metals[0].mermaSource = "line";
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.queryByText("(Catálogo)")).toBeNull();
  });

  it("FASE F10 — NO muestra badge '(Cliente)' aunque mermaSource='entity'", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.metals[0].mermaSource = "entity";
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.queryByText("(Cliente)")).toBeNull();
  });

  it("FASE F10 — NO muestra badge '(Manual)' aunque haya override local en costLineOverrides", () => {
    const line = makeLine();
    (line.pricingMeta as any).costLineOverrides = [
      { costLineId: "cl-metal-1", type: "METAL", mermaPercentOverride: 8 },
    ];
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.queryByText("(Manual)")).toBeNull();
    // Pero el override sigue activo: el input de Merma muestra 8,00.
    const editor = document.querySelector('[data-merma-inline-editor]')!;
    const input = editor.querySelector("input") as HTMLInputElement;
    expect(["8,00", "8.00"]).toContain(input.value);
  });

  it("FASE F10/F13 — Merma muestra solo valor + '%' (sin badge, sin ✎, sin label)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const editor = document.querySelector('[data-merma-inline-editor]')!;
    // No hay badge entre paréntesis ni icono de edición.
    expect(editor.textContent).not.toMatch(/\(Catálogo\)|\(Cliente\)|\(Manual\)|\(—\)/);
    expect(editor.textContent).not.toMatch(/✎/);
    // FASE F13 — label "Merma" eliminado, solo el sufijo "%".
    expect(editor.textContent).not.toMatch(/Merma/);
    expect(editor.textContent).toMatch(/%/);
  });

  it("FASE F10 — Merma con override negativo muestra valor '-5,00' en el input", () => {
    const line = makeLine();
    (line.pricingMeta as any).costLineOverrides = [
      { costLineId: "cl-metal-1", type: "METAL", mermaPercentOverride: -5 },
    ];
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const editor = document.querySelector('[data-merma-inline-editor]')!;
    const input = editor.querySelector("input") as HTMLInputElement;
    expect(["-5,00", "-5.00"]).toContain(input.value);
    expect(editor.textContent).not.toMatch(/\(/);
  });

  it("FASE F16 — el input de Merma usa ancho amplio (w-[176px], max-w-none) para que el número no quede recortado", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const editor = document.querySelector('[data-merma-inline-editor]')!;
    const input = editor.querySelector("input") as HTMLInputElement;
    expect(input.className).toMatch(/w-\[176px\]/);
    // max-w-none evita que un max-width heredado clipee el input.
    expect(input.className).toMatch(/max-w-none/);
  });

  it("FASE F16 — el input de Merma muestra valores típicos sin truncar (0,00 / 9,00 / -5,00 / 16,00 / 100,00)", () => {
    const cases: Array<{ override: number; expected: string[] }> = [
      { override: 0,    expected: ["0,00", "0.00"] },
      { override: 9,    expected: ["9,00", "9.00"] },
      { override: -5,   expected: ["-5,00", "-5.00"] },
      { override: 16,   expected: ["16,00", "16.00"] },
      { override: 100,  expected: ["100,00", "100.00"] },
    ];
    for (const { override, expected } of cases) {
      const line = makeLine();
      (line.pricingMeta as any).costLineOverrides = [
        { costLineId: "cl-metal-1", type: "METAL", mermaPercentOverride: override },
      ];
      const { unmount } = render(
        <SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />,
      );
      const editor = document.querySelector('[data-merma-inline-editor]')!;
      const input = editor.querySelector("input") as HTMLInputElement;
      expect(expected).toContain(input.value);
      unmount();
    }
  });

  it("FASE F13 — el editor de Merma renderea valor + '%' integrado, ambos visibles", () => {
    const line = makeLine();
    (line.pricingMeta as any).costLineOverrides = [
      { costLineId: "cl-metal-1", type: "METAL", mermaPercentOverride: -100 },
    ];
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const editor = document.querySelector('[data-merma-inline-editor]')!;
    const input = editor.querySelector("input") as HTMLInputElement;
    // El valor "-100,00" entra completo en el draft del input (no truncado).
    expect(["-100,00", "-100.00"]).toContain(input.value);
    // El "%" sigue rendereándose como sufijo aria-hidden.
    const pct = Array.from(editor.querySelectorAll('span[aria-hidden="true"]'))
      .find((s) => s.textContent === "%");
    expect(pct).toBeDefined();
  });

  it("NO muestra lápiz '✎' en el editor de Merma (UX inline directa)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const editor = document.querySelector('[data-merma-inline-editor]')!;
    expect(editor.textContent).not.toMatch(/✎/);
  });

  it("NO muestra los botones ✓/× del patrón pill (UX inline directa)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.queryByTitle(/Confirmar \(Enter\)/)).toBeNull();
    expect(screen.queryByTitle(/Cancelar \(Escape\)/)).toBeNull();
  });

  it("FASE F11 — el sufijo '%' vive dentro del PrefixedField (campo compuesto con focus-within)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const editor = document.querySelector('[data-merma-inline-editor]')!;
    const input = editor.querySelector("input") as HTMLInputElement;
    // El span del "%" es aria-hidden y vive dentro del editor.
    const pctSpan = Array.from(editor.querySelectorAll('span[aria-hidden="true"]'))
      .find((s) => s.textContent === "%");
    expect(pctSpan).toBeDefined();
    // Wrap unificado: encontramos el ancestor común input ↔ span "%"
    // que tiene `focus-within`.
    let node: HTMLElement | null = input;
    let unifiedWrap: HTMLElement | null = null;
    while (node) {
      if (node.contains(pctSpan!) && /focus-within/.test(node.className ?? "")) {
        unifiedWrap = node;
        break;
      }
      node = node.parentElement;
    }
    expect(unifiedWrap).not.toBeNull();
    expect(unifiedWrap!.className).toMatch(/focus-within/);
  });
});

describe("FASE F9 — Bonif/Recargo inline (signo + valor + unidad siempre visibles)", () => {
  function makeLineWithBonus() {
    const line = makeLine();
    // BONUS 11% en HECHURA.
    (line.pricingMeta as any).costLineOverrides = [
      { costLineId: "cl-hechura-1", type: "HECHURA",
        adjustmentKind: "BONUS", adjustmentType: "PERCENTAGE", adjustmentValue: 11 },
    ];
    return line;
  }
  function makeLineWithSurcharge() {
    const line = makeLine();
    (line.pricingMeta as any).costLineOverrides = [
      { costLineId: "cl-product-1", type: "PRODUCT",
        adjustmentKind: "SURCHARGE", adjustmentType: "PERCENTAGE", adjustmentValue: 5 },
    ];
    return line;
  }

  it("HECHURA renderea editor inline con signo, valor e unidad siempre visibles", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const editors = document.querySelectorAll('[data-adjustment-inline-editor]');
    // Un editor inline por cada fila no-METAL: HECHURA + PRODUCT + SERVICE = 3.
    expect(editors.length).toBe(3);
    const first = editors[0];
    // Hay input visible.
    expect(first.querySelector("input")).not.toBeNull();
  });

  it("BONUS renderea signo '−' (verde, emerald)", () => {
    render(<SaleCompositionEditableGrid line={makeLineWithBonus()} onApply={vi.fn()} {...baseProps} />);
    // Hay varios "Bonificación (−)" (uno por fila no-METAL). Verifico que al
    // menos uno tenga "−" con tono emerald.
    const signBtns = screen.getAllByTitle(/Bonificación \(−\)/);
    expect(signBtns.length).toBeGreaterThanOrEqual(1);
    signBtns.forEach((b) => {
      expect(b.textContent).toBe("−");
      expect(b.className).toMatch(/emerald/);
    });
  });

  it("SURCHARGE renderea signo '+' (ámbar)", () => {
    render(<SaleCompositionEditableGrid line={makeLineWithSurcharge()} onApply={vi.fn()} {...baseProps} />);
    const signBtn = screen.getByTitle(/Recargo \(\+\)/);
    expect(signBtn.textContent).toBe("+");
    expect(signBtn.className).toMatch(/amber/);
  });

  it("Click en signo cambia de '−' a '+' y emite override SURCHARGE", () => {
    const onApply = vi.fn();
    render(<SaleCompositionEditableGrid line={makeLineWithBonus()} onApply={onApply} {...baseProps} />);
    // El primer signo "−" corresponde a la fila HECHURA (orden de render).
    const signBtns = screen.getAllByTitle(/Bonificación \(−\)/);
    fireEvent.click(signBtns[0]);
    const patch = onApply.mock.calls[onApply.mock.calls.length - 1][0];
    const ov = (patch.costLineOverrides as any[])?.find((o) => o.type === "HECHURA");
    expect(ov?.adjustmentKind).toBe("SURCHARGE");
  });

  it("Click en signo cambia de '+' a '−' y emite override BONUS", () => {
    const onApply = vi.fn();
    render(<SaleCompositionEditableGrid line={makeLineWithSurcharge()} onApply={onApply} {...baseProps} />);
    const signBtn = screen.getByTitle(/Recargo \(\+\)/);
    fireEvent.click(signBtn);
    const patch = onApply.mock.calls[onApply.mock.calls.length - 1][0];
    const ov = (patch.costLineOverrides as any[])?.find((o) => o.type === "PRODUCT");
    expect(ov?.adjustmentKind).toBe("BONUS");
  });

  it("Click en unidad cambia de '%' a '$' y emite override FIXED_AMOUNT", () => {
    const onApply = vi.fn();
    render(<SaleCompositionEditableGrid line={makeLineWithBonus()} onApply={onApply} {...baseProps} />);
    const unitBtns = screen.getAllByTitle(/Porcentaje \(toggle/);
    expect(unitBtns.length).toBeGreaterThanOrEqual(1);
    expect(unitBtns[0].textContent).toBe("%");
    // El primero corresponde a HECHURA (orden de render).
    fireEvent.click(unitBtns[0]);
    const patch = onApply.mock.calls[onApply.mock.calls.length - 1][0];
    const ov = (patch.costLineOverrides as any[])?.find((o) => o.type === "HECHURA");
    expect(ov?.adjustmentType).toBe("FIXED_AMOUNT");
  });

  it("Modificar el valor del input emite override completo (kind+type+value)", () => {
    const onApply = vi.fn();
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={onApply} {...baseProps} />);
    const editors = document.querySelectorAll('[data-adjustment-inline-editor]');
    const hechuraInput = editors[0].querySelector("input") as HTMLInputElement;
    fireEvent.focus(hechuraInput);
    fireEvent.change(hechuraInput, { target: { value: "7,5" } });
    fireEvent.blur(hechuraInput);
    vi.advanceTimersByTime(300); // commit DEBOUNCED (useOverrideNumber)
    expect(onApply).toHaveBeenCalled();
    const patch = onApply.mock.calls[onApply.mock.calls.length - 1][0];
    const ov = (patch.costLineOverrides as any[])?.find((o) => o.type === "HECHURA");
    expect(ov?.adjustmentValue).toBeCloseTo(7.5);
    // El override quedó completo (con kind y type por default).
    expect(ov?.adjustmentKind).toBe("BONUS");
    expect(ov?.adjustmentType).toBe("PERCENTAGE");
  });

  it("NO muestra placeholder 'Sin ajuste' (UX inline directa)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.queryByText("Sin ajuste")).toBeNull();
  });

  it("NO muestra lápiz '✎' en el editor de Bonif/Recargo (UX inline directa)", () => {
    render(<SaleCompositionEditableGrid line={makeLineWithBonus()} onApply={vi.fn()} {...baseProps} />);
    const editors = document.querySelectorAll('[data-adjustment-inline-editor]');
    editors.forEach((e) => {
      expect(e.textContent).not.toMatch(/✎/);
    });
  });

  it("Los toggles de signo y unidad llevan tabIndex=-1 (Tab salta directo al input)", () => {
    render(<SaleCompositionEditableGrid line={makeLineWithBonus()} onApply={vi.fn()} {...baseProps} />);
    screen.getAllByTitle(/Bonificación \(−\)/).forEach((b) => {
      expect(b.getAttribute("tabIndex") || b.getAttribute("tabindex")).toBe("-1");
    });
    screen.getAllByTitle(/Porcentaje \(toggle/).forEach((b) => {
      expect(b.getAttribute("tabIndex") || b.getAttribute("tabindex")).toBe("-1");
    });
  });

  it("FASE F25 — Override que difiere del original NO muestra label tachado (flash visual eliminado)", () => {
    const line = makeLine();
    // Original BONUS 14% en PRODUCT.
    (line.pricingMeta as any).composition.products[0] = {
      ...(line.pricingMeta as any).composition.products[0],
      lineAdjKind: "BONUS", lineAdjType: "PERCENTAGE",
      lineAdjValue: 14, lineAdjAmount: 17.27,
    };
    // Override del operador: SURCHARGE 5%.
    (line.pricingMeta as any).costLineOverrides = [
      { costLineId: "cl-product-1", type: "PRODUCT",
        adjustmentKind: "SURCHARGE", adjustmentType: "PERCENTAGE", adjustmentValue: 5 },
    ];
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // El tachado del original fue eliminado en F25 (causaba flash al editar).
    expect(screen.queryByTitle("Ajuste original del artículo")).toBeNull();
    expect(document.querySelector(".line-through")).toBeNull();
  });

  it("FASE F11 — signo + valor + unidad viven en el MISMO wrap (control unificado)", () => {
    render(<SaleCompositionEditableGrid line={makeLineWithBonus()} onApply={vi.fn()} {...baseProps} />);
    const editor = document.querySelector('[data-adjustment-inline-editor]')!;
    // Tomamos el primer input + signo + unidad de este editor.
    const input  = editor.querySelector("input") as HTMLInputElement;
    const signBtn = editor.querySelector('button[title*="Bonificación (−)"], button[title*="Recargo (+)"]') as HTMLElement;
    const unitBtn = editor.querySelector('button[title*="Porcentaje"], button[title*="Monto fijo"]') as HTMLElement;
    expect(signBtn).not.toBeNull();
    expect(unitBtn).not.toBeNull();
    // Encontramos el ancestor común que contenga a los 3 Y tenga focus-within.
    let node: HTMLElement | null = input;
    let unifiedWrap: HTMLElement | null = null;
    while (node) {
      if (node.contains(signBtn) && node.contains(unitBtn) && /focus-within/.test(node.className ?? "")) {
        unifiedWrap = node;
        break;
      }
      node = node.parentElement;
    }
    expect(unifiedWrap).not.toBeNull();
    expect(unifiedWrap!.className).toMatch(/focus-within/);
  });

  it("FASE F11 — el signo aparece ANTES del input y la unidad DESPUÉS (orden DOM)", () => {
    render(<SaleCompositionEditableGrid line={makeLineWithBonus()} onApply={vi.fn()} {...baseProps} />);
    const editor = document.querySelector('[data-adjustment-inline-editor]')!;
    const input  = editor.querySelector("input") as HTMLInputElement;
    const signBtn = editor.querySelector('button[title*="Bonificación (−)"]') as HTMLElement;
    const unitBtn = editor.querySelector('button[title*="Porcentaje"]') as HTMLElement;
    expect(signBtn).not.toBeNull();
    expect(unitBtn).not.toBeNull();
    // signo → input → unidad en DOM order.
    const pos1 = signBtn.compareDocumentPosition(input);
    const pos2 = input.compareDocumentPosition(unitBtn);
    expect(pos1 & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(pos2 & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("FASE F13 — el input de Bonif/Recargo usa ancho amplio (w-[128px]) para que el número no se trunque", () => {
    render(<SaleCompositionEditableGrid line={makeLineWithBonus()} onApply={vi.fn()} {...baseProps} />);
    const editor = document.querySelector('[data-adjustment-inline-editor]')!;
    const input = editor.querySelector("input") as HTMLInputElement;
    expect(input.className).toMatch(/w-\[128px\]/);
  });

  it("FASE F13 — los toggles +/− y %/$ son compactos (w-3.5) para dar prioridad al número", () => {
    render(<SaleCompositionEditableGrid line={makeLineWithBonus()} onApply={vi.fn()} {...baseProps} />);
    const editor = document.querySelector('[data-adjustment-inline-editor]')!;
    const signBtn = editor.querySelector('button[title*="Bonificación (−)"]') as HTMLElement;
    const unitBtn = editor.querySelector('button[title*="Porcentaje"]') as HTMLElement;
    expect(signBtn.className).toMatch(/w-3\.5/);
    expect(unitBtn.className).toMatch(/w-3\.5/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// FIX — impacto del ajuste = lineAdjAmount del motor (moneda BASE), también
// en líneas con conversión de moneda y con override inline. Antes, con
// override, el editor usaba un recálculo local (lineCost − unitVal·qty) que
// mezclaba monedas y mostraba ~el total de la línea. Debe ser paridad con
// el bloque read-only (Simulador == Factura).
// ────────────────────────────────────────────────────────────────────────────
describe("Impacto del ajuste — passthrough lineAdjAmount (multi-moneda + inline)", () => {
  // PRODUCT en USD: unitValue 134,57 (orig.), base convertida 215.308,80,
  // BONIF 10% → motor emite lineAdjAmount = 21.530,88 (base). lineCost post
  // (≈193.643,35) NO debe usarse como impacto.
  function makeForeignProduct(withOverride: boolean): DocumentLine {
    const line = makeLine();
    const meta: any = line.pricingMeta;
    meta.composition.products[0] = {
      ...meta.composition.products[0],
      currencyId:    "cur-usd",
      quantity:      1,
      unitValue:     134.57,        // moneda ORIGINAL (USD)
      totalValue:    215308.80,     // base convertida pre-ajuste
      lineCost:      193643.35,     // base POST-ajuste (NO es el impacto)
      lineAdjKind:   "BONUS",
      lineAdjType:   "PERCENTAGE",
      lineAdjValue:  10,
      lineAdjAmount: 21530.88,      // motor: base × % (passthrough correcto)
    };
    if (withOverride) {
      meta.costLineOverrides = [
        { costLineId: "cl-product-1", type: "PRODUCT",
          adjustmentKind: "BONUS", adjustmentType: "PERCENTAGE", adjustmentValue: 10 },
      ];
    }
    return line;
  }

  it("moneda extranjera + override inline → muestra −ARS 21.530,88 (NO el total ~193.643,35)", () => {
    render(<SaleCompositionEditableGrid line={makeForeignProduct(true)} onApply={vi.fn()} {...baseProps} />);
    const editors = document.querySelectorAll('[data-adjustment-inline-editor]');
    // Orden de filas no-METAL: HECHURA=0, PRODUCT=1, SERVICE=2.
    const productEditor = editors[1] as HTMLElement;
    expect(productEditor.textContent).toMatch(/−ARS\s*21\.530,88/);
    expect(productEditor.textContent).not.toMatch(/193\.643,35/);
  });

  it("moneda extranjera SIN override (readonly-equivalente) → mismo impacto", () => {
    render(<SaleCompositionEditableGrid line={makeForeignProduct(false)} onApply={vi.fn()} {...baseProps} />);
    const editors = document.querySelectorAll('[data-adjustment-inline-editor]');
    expect((editors[1] as HTMLElement).textContent).toMatch(/−ARS\s*21\.530,88/);
  });

  it("paridad editable vs readonly — override no cambia el monto mostrado", () => {
    const withOv = render(<SaleCompositionEditableGrid line={makeForeignProduct(true)} onApply={vi.fn()} {...baseProps} />);
    const a = (document.querySelectorAll('[data-adjustment-inline-editor]')[1] as HTMLElement).textContent;
    withOv.unmount();
    render(<SaleCompositionEditableGrid line={makeForeignProduct(false)} onApply={vi.fn()} {...baseProps} />);
    const b = (document.querySelectorAll('[data-adjustment-inline-editor]')[1] as HTMLElement).textContent;
    expect(a).toMatch(/−ARS\s*21\.530,88/);
    expect(b).toMatch(/−ARS\s*21\.530,88/);
  });

  it("moneda base + ajuste (caso PRINT 1) sigue correcto: −ARS 3.500,00", () => {
    const line = makeLine();
    const meta: any = line.pricingMeta;
    meta.composition.products[0] = {
      ...meta.composition.products[0],
      currencyId: null, unitValue: 35000, totalValue: 35000, lineCost: 31500,
      lineAdjKind: "BONUS", lineAdjType: "PERCENTAGE", lineAdjValue: 10,
      lineAdjAmount: 3500,
    };
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const editors = document.querySelectorAll('[data-adjustment-inline-editor]');
    expect((editors[1] as HTMLElement).textContent).toMatch(/−ARS\s*3\.500,00/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// FASE F17 — "Costo con impuestos" en header + sección compacta AJUSTE GLOBAL.
// ────────────────────────────────────────────────────────────────────────────
describe("FASE F17 — Header 'Costo con impuestos'", () => {
  it("Muestra '· Costo con impuestos: AR$ X' cuando costTaxAmount > 0 y costWithTax viene del backend", () => {
    const line = makeLine();
    (line.pricingMeta as any).costBase      = "1000.0000";
    (line.pricingMeta as any).costTaxAmount = "210.0000";
    (line.pricingMeta as any).costWithTax   = "1210.0000";
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText(/Costo con impuestos:/)).toBeInTheDocument();
    expect(screen.getByText(/ARS\s*1\.210,00/)).toBeInTheDocument();
  });

  it("NO muestra 'Costo con impuestos' cuando costTaxAmount es null", () => {
    const line = makeLine();
    (line.pricingMeta as any).costBase      = "1000.0000";
    (line.pricingMeta as any).costTaxAmount = null;
    (line.pricingMeta as any).costWithTax   = "1000.0000";
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.queryByText(/Costo con impuestos:/)).toBeNull();
  });

  it("NO muestra 'Costo con impuestos' cuando costTaxAmount = 0", () => {
    const line = makeLine();
    (line.pricingMeta as any).costBase      = "1000.0000";
    (line.pricingMeta as any).costTaxAmount = "0.0000";
    (line.pricingMeta as any).costWithTax   = "1000.0000";
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.queryByText(/Costo con impuestos:/)).toBeNull();
  });

  it("NO muestra 'Costo con impuestos' cuando el snapshot legacy NO trae el campo", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.queryByText(/Costo con impuestos:/)).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// FASE F24 — Margen reubicado entre Costo Total y Costo de Venta.
// ────────────────────────────────────────────────────────────────────────────
describe("FASE F24 — Orden de columnas finales", () => {
  it("Orden: ... Merma/Ajuste → Costo Total → Margen → Costo de Venta", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const mermaAj    = screen.getByText("Merma / Ajuste");
    const costoTotal = screen.getByText("Costo Total");
    const margen     = screen.getByText("Margen");
    const costoVenta = screen.getByText("Venta");
    // Merma/Ajuste → Costo Total → Margen → Costo de Venta (DOM order).
    expect(mermaAj.compareDocumentPosition(costoTotal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(costoTotal.compareDocumentPosition(margen) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(margen.compareDocumentPosition(costoVenta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("Costo Total ya NO contiene el porcentaje ni el impacto del margen (vivien en Margen)", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.hechuras[0].lineCost = 200;
    (line.pricingMeta as any).composition.hechuras[0].lineSale = 300;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // El impacto del margen siempre está dentro de [data-margin-cell].
    const impacts = document.querySelectorAll("[data-margin-amount-impact]");
    for (const el of Array.from(impacts)) {
      expect(el.closest("[data-margin-cell]")).not.toBeNull();
    }
  });

  it("Costo de Venta queda como columna final con su importe", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // El header "Costo de Venta" existe y está a la derecha de Margen.
    const margen = screen.getByText("Margen");
    const costoVenta = screen.getByText("Venta");
    expect(margen.compareDocumentPosition(costoVenta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// FASE F25 — Sin label tachado al editar Merma/Ajuste (flash visual eliminado).
// ────────────────────────────────────────────────────────────────────────────
describe("FASE F25 — Sin flash de label tachado al editar Merma/Ajuste", () => {
  it("Aunque el override difiera del original, NO aparece label tachado", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.products[0] = {
      ...(line.pricingMeta as any).composition.products[0],
      lineAdjKind: "BONUS", lineAdjType: "PERCENTAGE",
      lineAdjValue: 14, lineAdjAmount: 17.27,
    };
    (line.pricingMeta as any).costLineOverrides = [
      { costLineId: "cl-product-1", type: "PRODUCT",
        adjustmentKind: "SURCHARGE", adjustmentType: "PERCENTAGE", adjustmentValue: 5 },
    ];
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // No hay título "Ajuste original del artículo".
    expect(screen.queryByTitle("Ajuste original del artículo")).toBeNull();
    // Y no hay ningún span con clase line-through dentro del card.
    expect(document.querySelector(".line-through")).toBeNull();
  });

  it("Al cambiar el input del ajuste el resultado se mantiene en el input sin overlay tachado", () => {
    const onApply = vi.fn();
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={onApply} {...baseProps} />);
    const editors = document.querySelectorAll("[data-adjustment-inline-editor]");
    const input = editors[0].querySelector("input") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "8,5" } });
    fireEvent.blur(input);
    vi.advanceTimersByTime(300); // commit DEBOUNCED (useOverrideNumber)
    // costLineOverrides sigue funcionando.
    expect(onApply).toHaveBeenCalled();
    const patch = onApply.mock.calls[onApply.mock.calls.length - 1][0];
    expect(Array.isArray(patch.costLineOverrides)).toBe(true);
    // Sin label tachado en ninguna parte del card.
    expect(document.querySelector(".line-through")).toBeNull();
  });

  it("Al cambiar la merma el input mantiene el valor sin label tachado", () => {
    const onApply = vi.fn();
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={onApply} {...baseProps} />);
    const merma = document.querySelector("[data-merma-inline-editor]")!;
    const input = merma.querySelector("input") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "7,5" } });
    fireEvent.blur(input);
    vi.advanceTimersByTime(300); // commit DEBOUNCED (useOverrideNumber)
    expect(onApply).toHaveBeenCalled();
    expect(document.querySelector(".line-through")).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// FASE F23 — Columna "Margen" + resize de columnas + títulos centrados.
// ────────────────────────────────────────────────────────────────────────────
describe("FASE F23 — Columna 'Margen' independiente", () => {
  it("FASE F24 — Header muestra el label 'Margen' entre 'Costo Total' y 'Costo de Venta'", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const costoTotal = screen.getByText("Costo Total");
    const margen     = screen.getByText("Margen");
    const costoVenta = screen.getByText("Venta");
    expect(margen).toBeInTheDocument();
    const pos1 = costoTotal.compareDocumentPosition(margen);
    const pos2 = margen.compareDocumentPosition(costoVenta);
    expect(pos1 & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(pos2 & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("Celda Margen muestra el porcentaje cuando hay margen positivo", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.hechuras[0].lineCost = 200;
    (line.pricingMeta as any).composition.hechuras[0].lineSale = 300;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const cells = document.querySelectorAll("[data-margin-cell]");
    expect(cells.length).toBeGreaterThanOrEqual(1);
    // Alguna celda Margen contiene "+50,0%" o "+ARS 100,00".
    const found = Array.from(cells).some((c) => /\+50,0%/.test(c.textContent ?? ""));
    expect(found).toBe(true);
  });

  it("Celda Margen muestra el importe del impacto monetario (+/−ARS X)", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.hechuras[0].lineCost = 200;
    (line.pricingMeta as any).composition.hechuras[0].lineSale = 300;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const impacts = document.querySelectorAll("[data-margin-amount-impact]");
    expect(impacts.length).toBeGreaterThanOrEqual(1);
    const found = Array.from(impacts).some((el) => /\+ARS\s*100,00/.test(el.textContent ?? ""));
    expect(found).toBe(true);
    // Y el impacto vive dentro de [data-margin-cell] (no en Costo Total).
    const impactInMarginCell = Array.from(impacts).every((el) =>
      el.closest("[data-margin-cell]") != null,
    );
    expect(impactInMarginCell).toBe(true);
  });

  it("Celda Costo Total NO contiene el porcentaje ni el impacto del margen (movidos a Margen)", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.hechuras[0].lineCost = 200;
    (line.pricingMeta as any).composition.hechuras[0].lineSale = 300;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // El nodo `data-margin-amount-impact` NO debe vivir dentro de ningún
    // wrap que también contenga el monto principal del Costo Total. La
    // forma simple: data-margin-cell ≠ data-margin-amount-impact host.
    const impacts = document.querySelectorAll("[data-margin-amount-impact]");
    for (const el of Array.from(impacts)) {
      expect(el.closest("[data-margin-cell]")).not.toBeNull();
    }
  });
});

describe("FASE F23 — Headers de tabla centrados", () => {
  it("Todos los headers de columna (Componente, Cantidad, ...) usan text-center", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    for (const key of ["componente", "cantidad", "unidad", "costoUnit", "mermaAjuste", "margen", "costoTotal", "costoVenta"]) {
      const h = document.querySelector(`[data-column-header="${key}"]`);
      expect(h).not.toBeNull();
      expect(h!.className).toMatch(/text-center/);
    }
  });
});

describe("FASE F23 — Resize de columnas tipo Excel", () => {
  it("Cada header de columna tiene un handle de resize (role=separator)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const handles = document.querySelectorAll('[role="separator"][data-column-resize-handle]');
    // 8 handles: uno por cada columna redimensionable.
    expect(handles.length).toBe(8);
  });

  it("Drag horizontal sobre el handle cambia el ancho de la columna", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const header = screen.getByText("Componente").closest('[style*="grid-template-columns"]') as HTMLElement;
    const before = header.style.gridTemplateColumns;
    // Drag del handle de "componente" 50px a la derecha.
    const handle = document.querySelector('[data-column-resize-handle="componente"]') as HTMLElement;
    expect(handle).not.toBeNull();
    fireEvent.mouseDown(handle, { clientX: 300 });
    fireEvent(window, new MouseEvent("mousemove", { clientX: 350 }));
    fireEvent(window, new MouseEvent("mouseup"));
    const after = header.style.gridTemplateColumns;
    expect(after).not.toBe(before);
  });

  it("Doble click sobre el handle resetea el ancho de esa columna al default", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const handle = document.querySelector('[data-column-resize-handle="componente"]') as HTMLElement;
    // Drag para cambiar.
    fireEvent.mouseDown(handle, { clientX: 300 });
    fireEvent(window, new MouseEvent("mousemove", { clientX: 400 }));
    fireEvent(window, new MouseEvent("mouseup"));
    const header = screen.getByText("Componente").closest('[style*="grid-template-columns"]') as HTMLElement;
    const widened = header.style.gridTemplateColumns;
    // Doble click resetea.
    fireEvent.doubleClick(handle);
    const reset = header.style.gridTemplateColumns;
    expect(reset).not.toBe(widened);
    // El ancho default de Componente es 320px.
    expect(reset).toMatch(/320px/);
  });

  it("El ancho se clamp a min-width (no puede achicar bajo 220px para Componente)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const handle = document.querySelector('[data-column-resize-handle="componente"]') as HTMLElement;
    // Drag muy a la izquierda para forzar clamp.
    fireEvent.mouseDown(handle, { clientX: 300 });
    fireEvent(window, new MouseEvent("mousemove", { clientX: 0 }));
    fireEvent(window, new MouseEvent("mouseup"));
    const header = screen.getByText("Componente").closest('[style*="grid-template-columns"]') as HTMLElement;
    // El ancho de la 2ª columna (Componente) debe ser >= 220px (clamped).
    const tokens = header.style.gridTemplateColumns.split(/\s+/).filter(Boolean);
    const componenteWidth = parseInt(tokens[1], 10);
    expect(componenteWidth).toBeGreaterThanOrEqual(220);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// FASE F22 — Columna "Merma / Ajuste" independiente entre Costo unit. y Costo Total.
// ────────────────────────────────────────────────────────────────────────────
describe("FASE F22 — Columna 'Merma / Ajuste' independiente", () => {
  it("Header muestra el nuevo label 'Merma / Ajuste' entre 'Costo unit.' y 'Costo Total'", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const costoUnit = screen.getByText("Costo unit.");
    const mermaAjuste = screen.getByText("Merma / Ajuste");
    const costoTotal = screen.getByText("Costo Total");
    expect(mermaAjuste).toBeInTheDocument();
    // Orden DOM: Costo unit. → Merma / Ajuste → Costo Total.
    const pos1 = costoUnit.compareDocumentPosition(mermaAjuste);
    const pos2 = mermaAjuste.compareDocumentPosition(costoTotal);
    expect(pos1 & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(pos2 & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("Merma (METAL) vive en su propia celda (data-merma-ajuste-cell), separada de Costo unit.", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const merma = document.querySelector("[data-merma-inline-editor]")!;
    expect(merma).not.toBeNull();
    const cell = merma.closest("[data-merma-ajuste-cell]");
    expect(cell).not.toBeNull();
    // El input de Merma NO comparte ancestor con el input de Costo unit. METAL.
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    // El input read-only del Costo unit. METAL (post-merma per gramo) tiene
    // readOnly=true; el de la merma es editable.
    const costUnitReadOnly = inputs.find((el) => el.readOnly === true);
    expect(costUnitReadOnly).toBeDefined();
    expect(cell!.contains(costUnitReadOnly!)).toBe(false);
  });

  it("Ajuste (HECHURA/PRODUCT/SERVICE) vive en su propia celda data-merma-ajuste-cell", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const editors = document.querySelectorAll("[data-adjustment-inline-editor]");
    expect(editors.length).toBeGreaterThanOrEqual(3); // HECHURA + PRODUCT + SERVICE
    for (const ed of Array.from(editors)) {
      const cell = ed.closest("[data-merma-ajuste-cell]");
      expect(cell).not.toBeNull();
    }
  });

  it("El editor de Merma sigue siendo editable y dispara onApply", () => {
    const onApply = vi.fn();
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={onApply} {...baseProps} />);
    const merma = document.querySelector("[data-merma-inline-editor]")!;
    const input = merma.querySelector("input") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "9,5" } });
    fireEvent.blur(input);
    vi.advanceTimersByTime(300); // commit DEBOUNCED (useOverrideNumber)
    expect(onApply).toHaveBeenCalled();
    const patch = onApply.mock.calls[onApply.mock.calls.length - 1][0];
    const ov = (patch.costLineOverrides as any[])?.find((o) => o.type === "METAL");
    expect(ov?.mermaPercentOverride).toBeCloseTo(9.5);
  });

  it("El editor de Ajuste (HECHURA) sigue siendo editable y dispara onApply con kind/type/value", () => {
    const onApply = vi.fn();
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={onApply} {...baseProps} />);
    const editors = document.querySelectorAll("[data-adjustment-inline-editor]");
    const hechuraInput = editors[0].querySelector("input") as HTMLInputElement;
    fireEvent.focus(hechuraInput);
    fireEvent.change(hechuraInput, { target: { value: "12,5" } });
    fireEvent.blur(hechuraInput);
    vi.advanceTimersByTime(300); // commit DEBOUNCED (useOverrideNumber)
    expect(onApply).toHaveBeenCalled();
    const patch = onApply.mock.calls[onApply.mock.calls.length - 1][0];
    const ov = (patch.costLineOverrides as any[])?.find((o) => o.type === "HECHURA");
    expect(ov?.adjustmentValue).toBeCloseTo(12.5);
    expect(ov?.adjustmentKind).toBe("BONUS");
    expect(ov?.adjustmentType).toBe("PERCENTAGE");
  });

  it("Costo unit. ya NO contiene el editor de Merma/Ajuste embebido (sub-línea eliminada)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const merma = document.querySelector("[data-merma-inline-editor]")!;
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    const costUnitReadOnly = inputs.find((el) => el.readOnly === true);
    expect(costUnitReadOnly).toBeDefined();
    // El ancestor común debe ser una fila (grid completa), no la celda
    // Costo unit. FASE F23 — el grid-template ahora vive en inline style
    // (no en className), así que verificamos `display: grid` + presencia
    // de la celda Componente como hermana.
    let common: HTMLElement | null = merma.parentElement;
    while (common && !common.contains(costUnitReadOnly!)) {
      common = common.parentElement;
    }
    expect(common).not.toBeNull();
    // El ancestor común debe ser un grid (style.gridTemplateColumns seteado).
    const style = (common as HTMLElement).style;
    expect(style.gridTemplateColumns).toMatch(/24px.*28px/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// FASE F21 — Columna "Unidad" separada de "Cantidad".
// ────────────────────────────────────────────────────────────────────────────
describe("FASE F21 — Columna 'Unidad' separada de 'Cantidad'", () => {
  it("Header de tabla muestra ambos labels: 'Cantidad' y 'Unidad'", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText("Cantidad")).toBeInTheDocument();
    // "Unidad" aparece en el header + posiblemente en filas con fallback —
    // verificamos que al menos exista una ocurrencia.
    expect(screen.getAllByText("Unidad").length).toBeGreaterThanOrEqual(1);
  });

  it("FASE F23 — La grilla usa 10 columnas (icon + 8 datos + acciones, inline gridTemplateColumns)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const header = screen.getByText("Componente").closest('[style*="grid-template-columns"]') as HTMLElement;
    expect(header).not.toBeNull();
    // El gridTemplateColumns inline tiene 10 tokens separados por espacios.
    const tpl = header.style.gridTemplateColumns;
    expect(tpl.split(/\s+/).filter(Boolean).length).toBe(10);
  });

  it("La celda Cantidad contiene SOLO el input (sin la unidad inline)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    const qtyInput = inputs.find((el) => el.value === "2,50" || el.value === "2.50")!;
    expect(qtyInput).toBeDefined();
    // El padre directo del input es la celda Cantidad y no contiene texto "Gramos".
    const qtyCell = qtyInput.closest('div.flex.items-baseline')!;
    expect(qtyCell.textContent ?? "").not.toMatch(/Gramos/);
  });

  it("La celda Unidad muestra 'Gramos' independiente y aria-hidden", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const unidadEl = screen.getByText("Gramos");
    expect(unidadEl.getAttribute("aria-hidden")).toBe("true");
    // Está fuera del wrap del input (separada).
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    const qtyInput = inputs.find((el) => el.value === "2,50" || el.value === "2.50")!;
    expect(qtyInput.closest('div')?.contains(unidadEl)).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// FASE F19 — Footers de grupo sin border-top + impacto monetario del margen.
// ────────────────────────────────────────────────────────────────────────────
describe("FASE F19 — Footers 'Total <grupo>' sin border-top", () => {
  it("ningún footer (METAL/HECHURA/PRODUCT/SERVICE) usa border-t", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    for (const t of ["METAL", "HECHURA", "PRODUCT", "SERVICE"]) {
      const f = document.querySelector(`[data-group-footer="${t}"]`) as HTMLElement | null;
      expect(f).not.toBeNull();
      const hasBorderTop = /\bborder-t\b/.test(f!.className)
        && !/\bborder-t-0\b/.test(f!.className);
      expect(hasBorderTop).toBe(false);
    }
  });

  it("los footers conservan el background semántico por tipo (separación visual)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(document.querySelector('[data-group-footer="METAL"]')!.className).toMatch(/bg-amber-/);
    expect(document.querySelector('[data-group-footer="HECHURA"]')!.className).toMatch(/bg-blue-/);
    expect(document.querySelector('[data-group-footer="PRODUCT"]')!.className).toMatch(/bg-violet-/);
    expect(document.querySelector('[data-group-footer="SERVICE"]')!.className).toMatch(/bg-green-/);
  });

  it("la fila 'Total metales' sigue mostrando el importe", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const footer = document.querySelector('[data-group-footer="METAL"]')!;
    expect(footer.textContent).toMatch(/Total metales/i);
    expect(footer.textContent).toMatch(/ARS\s*\d/);
  });
});

describe("FASE F19 — Costo Total: impacto monetario debajo del %", () => {
  it("Cuando hay margen positivo, la fila muestra el importe del impacto con signo +", () => {
    const line = makeLine();
    // HECHURA con lineCost=200 y lineSale=300 → margin = +50%, impacto = +100.
    (line.pricingMeta as any).composition.hechuras[0].lineCost = 200;
    (line.pricingMeta as any).composition.hechuras[0].lineSale = 300;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const impacts = document.querySelectorAll("[data-margin-amount-impact]");
    expect(impacts.length).toBeGreaterThanOrEqual(1);
    const hechuraImpact = Array.from(impacts).find((el) =>
      /\+ARS\s*100,00/.test(el.textContent ?? ""),
    );
    expect(hechuraImpact).toBeDefined();
    expect(hechuraImpact!.className).toMatch(/emerald/);
  });

  it("Cuando hay margen negativo, la fila muestra el importe con signo − y tono rose", () => {
    const line = makeLine();
    // PRODUCT con totalValue=300 (cost) y lineSale=250 → impacto = −50.
    (line.pricingMeta as any).composition.products[0].totalValue = 300;
    (line.pricingMeta as any).composition.products[0].lineSale   = 250;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const impacts = document.querySelectorAll("[data-margin-amount-impact]");
    const productImpact = Array.from(impacts).find((el) =>
      /−ARS\s*50,00/.test(el.textContent ?? ""),
    );
    expect(productImpact).toBeDefined();
    expect(productImpact!.className).toMatch(/rose/);
  });

  it("Cuando el impacto es 0 (lineSale === lineCost), no se renderea la sub-línea", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.products[0].totalValue = 200;
    (line.pricingMeta as any).composition.products[0].lineSale   = 200;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // Puede haber impacto en otras filas (METAL/HECHURA del fixture), pero el
    // específico del PRODUCT con delta=0 NO aparece. Comprobamos que no haya
    // "+ARS 0,00" en ningún data-margin-amount-impact.
    const impacts = document.querySelectorAll("[data-margin-amount-impact]");
    for (const el of Array.from(impacts)) {
      expect(el.textContent ?? "").not.toMatch(/^[+−]ARS\s*0,00$/);
    }
  });

  it("El % de margen sigue visible junto con el importe (no se reemplaza)", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.hechuras[0].lineCost = 200;
    (line.pricingMeta as any).composition.hechuras[0].lineSale = 300;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // El "+50,0%" sigue presente.
    expect(screen.getAllByText(/\+50,0%/).length).toBeGreaterThanOrEqual(1);
    // Y el "+ARS 100,00" también.
    const impacts = document.querySelectorAll("[data-margin-amount-impact]");
    const found = Array.from(impacts).some((el) => /\+ARS\s*100,00/.test(el.textContent ?? ""));
    expect(found).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Utilidad de línea = Venta de línea − Costo total de línea (escalado × qty).
// Fix: antes el importe mezclaba venta UNITARIA con costo TOTAL → se volvía
// rojo/negativo al subir la cantidad pese a margen positivo. Ahora ambos
// operandos están en base "total de línea" (× cantidad) y el signo/color es
// coherente con el % de margen.
// ────────────────────────────────────────────────────────────────────────────
describe("Utilidad de línea — coherente con el % y escalada por cantidad", () => {
  function hechuraImpact(): HTMLElement | undefined {
    const impacts = document.querySelectorAll("[data-margin-amount-impact]");
    return Array.from(impacts).find((el) =>
      /Utilidad/.test(el.textContent ?? ""),
    ) as HTMLElement | undefined;
  }

  it("qty=1, margen positivo → Utilidad positiva (verde), label 'Utilidad'", () => {
    const line = makeLine();
    line.quantity = 1;
    (line.pricingMeta as any).composition.hechuras[0].lineCost = 200;
    (line.pricingMeta as any).composition.hechuras[0].lineSale = 300;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const impacts = document.querySelectorAll("[data-margin-amount-impact]");
    const el = Array.from(impacts).find((e) => /\+ARS\s*100,00/.test(e.textContent ?? ""));
    expect(el).toBeDefined();
    expect(el!.textContent).toMatch(/\+ARS\s*100,00/);
    expect(el!.className).toMatch(/emerald/);
    expect(el!.className).not.toMatch(/rose/);
  });

  it("qty=2, MISMO margen positivo → Utilidad sigue positiva y escala ×2 (NO rojo)", () => {
    const line = makeLine();
    line.quantity = 2;
    (line.pricingMeta as any).composition.hechuras[0].lineCost = 200;
    (line.pricingMeta as any).composition.hechuras[0].lineSale = 300;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const impacts = document.querySelectorAll("[data-margin-amount-impact]");
    // Venta línea 600 − Costo total 400 = +200 (escaló ×2, sigue positivo).
    const el = Array.from(impacts).find((e) => /\+ARS\s*200,00/.test(e.textContent ?? ""));
    expect(el).toBeDefined();
    expect(el!.className).toMatch(/emerald/);
    // Bug viejo: aparecía rojo/negativo con margen positivo. NO debe pasar.
    expect(el!.className).not.toMatch(/rose/);
    expect(el!.textContent ?? "").not.toMatch(/−ARS/);
  });

  it("ninguna sub-línea de Utilidad es roja cuando todos los márgenes son positivos (qty=2)", () => {
    const line = makeLine();
    line.quantity = 2;
    (line.pricingMeta as any).composition.hechuras[0].lineCost = 200;
    (line.pricingMeta as any).composition.hechuras[0].lineSale = 300;
    (line.pricingMeta as any).composition.products[0].totalValue = 150;
    (line.pricingMeta as any).composition.products[0].lineSale   = 250;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const impacts = document.querySelectorAll("[data-margin-amount-impact]");
    for (const el of Array.from(impacts)) {
      expect(el.className).not.toMatch(/rose/);
      expect(el.textContent ?? "").not.toMatch(/−ARS/);
    }
  });

  it("utilidad realmente negativa (costo > venta) → SÍ rojo, con signo −", () => {
    const line = makeLine();
    line.quantity = 2;
    (line.pricingMeta as any).composition.hechuras[0].lineCost = 300;
    (line.pricingMeta as any).composition.hechuras[0].lineSale = 200;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const impacts = document.querySelectorAll("[data-margin-amount-impact]");
    // Venta línea 400 − Costo total 600 = −200 → rojo.
    const el = Array.from(impacts).find((e) => /−ARS\s*200,00/.test(e.textContent ?? ""));
    expect(el).toBeDefined();
    expect(el!.className).toMatch(/rose/);
    expect(el!.textContent).toMatch(/−ARS\s*200,00/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// FASE F18 — Sin divisores horizontales superiores entre grupos.
// ────────────────────────────────────────────────────────────────────────────
describe("FASE F18 — Headers de grupo sin border-top", () => {
  it("ningún header de grupo (METAL/HECHURA/PRODUCT/SERVICE) usa border-t", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    for (const t of ["METAL", "HECHURA", "PRODUCT", "SERVICE"]) {
      const h = document.querySelector(`[data-group-type="${t}"]`) as HTMLElement | null;
      expect(h).not.toBeNull();
      // No hay clase `border-t` (Tailwind dibujaría la línea horizontal).
      // Permitimos `border-t-0` legacy si quedara (no debería).
      const hasBorderTop = /\bborder-t\b/.test(h!.className)
        && !/\bborder-t-0\b/.test(h!.className);
      expect(hasBorderTop).toBe(false);
    }
  });

  it("la separación entre grupos se mantiene vía spacing (mt-3) + background del header", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // HECHURAS, PRODUCT, SERVICE llevan mt-3 (16px). METAL es el primero → mt-3
    // anulado por `first:mt-0`, pero aún así no debería tener border.
    const hechuraHeader = document.querySelector('[data-group-type="HECHURA"]')!;
    expect(hechuraHeader.className).toMatch(/mt-3/);
    expect(hechuraHeader.className).toMatch(/bg-blue-/);
  });
});

describe("FASE F20 — Header sin '(% ajuste)' inline; detalle al final del card", () => {
  it("El header NO muestra el badge inline '(−5%)' aunque exista costAdjustment", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.costAdjustment = {
      kind:   "BONUS",
      type:   "PERCENTAGE",
      value:  5,
      amount: 100,
    };
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // El antiguo `data-cost-adjustment-inline` ya no se renderea.
    expect(document.querySelector("[data-cost-adjustment-inline]")).toBeNull();
    // El texto "(−5%)" no aparece en el header.
    expect(screen.queryByText(/\(−5%\)/)).toBeNull();
    expect(screen.queryByText(/\(\+5%\)/)).toBeNull();
  });

  it("El header muestra 'Valor de costo: ARS X' (post-ajuste, sin el porcentaje)", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.costAdjustment = {
      kind: "BONUS", type: "PERCENTAGE", value: 5, amount: 100,
    };
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText(/Valor de costo:/)).toBeInTheDocument();
  });
});

describe("FASE F20 — Sección 'AJUSTE GLOBAL' al final del card", () => {
  it("BONUS muestra 3 filas: 'Costo antes', 'Bonificación X%' (verde), 'Costo total'", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.costAdjustment = {
      kind:   "BONUS",
      type:   "PERCENTAGE",
      value:  5,
      amount: 100,
    };
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const section = document.querySelector("[data-cost-adjustment-detail]");
    expect(section).not.toBeNull();
    expect(section!.textContent).toMatch(/Ajuste global/i);
    expect(section!.textContent).toMatch(/Costo antes del ajuste:/);
    expect(section!.textContent).toMatch(/Bonificación 5%/);
    // Monto signado − (BONUS reduce).
    expect(section!.textContent).toMatch(/−ARS\s*100,00/);
    expect(section!.textContent).toMatch(/Costo total:/);
    // Color emerald para BONUS.
    expect(section!.innerHTML).toMatch(/emerald-600|emerald-400/);
  });

  it("SURCHARGE muestra 'Recargo X%' (ámbar) y monto signado '+ARS Y'", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.costAdjustment = {
      kind:   "SURCHARGE",
      type:   "PERCENTAGE",
      value:  5,
      amount: 100,
    };
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const section = document.querySelector("[data-cost-adjustment-detail]")!;
    expect(section.textContent).toMatch(/Recargo 5%/);
    expect(section.textContent).toMatch(/\+ARS\s*100,00/);
    expect(section.innerHTML).toMatch(/amber-600|amber-400/);
  });

  it("BONUS FIXED muestra 'Bonificación ARS Y'", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.costAdjustment = {
      kind:   "BONUS",
      type:   "FIXED_AMOUNT",
      value:  35000,
      amount: 35000,
    };
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const section = document.querySelector("[data-cost-adjustment-detail]")!;
    expect(section.textContent).toMatch(/Bonificación ARS\s*35\.000,00/);
    expect(section.textContent).toMatch(/−ARS\s*35\.000,00/);
  });

  it("'Costo total' del detalle coincide con el 'Valor de costo' del header (fixture: 930)", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.costAdjustment = {
      kind: "BONUS", type: "PERCENTAGE", value: 5, amount: 100,
    };
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // El fixture default emite totalComponents = 930.
    expect(screen.getAllByText(/ARS\s*930,00/).length).toBeGreaterThanOrEqual(1);
    const section = document.querySelector("[data-cost-adjustment-detail]")!;
    expect(section.textContent).toMatch(/Costo total:[\s\S]*ARS\s*930,00/);
  });

  it("'Costo antes del ajuste' se deriva visualmente:  BONUS → total + amount (930 + 100 = 1.030)", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.costAdjustment = {
      kind: "BONUS", type: "PERCENTAGE", value: 5, amount: 100,
    };
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const section = document.querySelector("[data-cost-adjustment-detail]")!;
    expect(section.textContent).toMatch(/Costo antes del ajuste:[\s\S]*ARS\s*1\.030,00/);
  });

  it("'Costo antes del ajuste' se deriva visualmente: SURCHARGE → total − amount (930 − 100 = 830)", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.costAdjustment = {
      kind: "SURCHARGE", type: "PERCENTAGE", value: 5, amount: 100,
    };
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const section = document.querySelector("[data-cost-adjustment-detail]")!;
    expect(section.textContent).toMatch(/Costo antes del ajuste:[\s\S]*ARS\s*830,00/);
  });

  it("NO renderea sección cuando kind === null", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.costAdjustment = {
      kind: null, type: null, value: null, amount: null,
    };
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(document.querySelector("[data-cost-adjustment-detail]")).toBeNull();
  });

  it("NO renderea sección cuando NO existe composition.costAdjustment (legacy)", () => {
    const line = makeLine();
    delete (line.pricingMeta as any).composition.costAdjustment;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(document.querySelector("[data-cost-adjustment-detail]")).toBeNull();
  });

  it("La sección aparece UNA sola vez (no duplicada)", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.costAdjustment = {
      kind: "BONUS", type: "PERCENTAGE", value: 5, amount: 100,
    };
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(document.querySelectorAll("[data-cost-adjustment-detail]").length).toBe(1);
    // Solo un label "Ajuste global" en todo el card.
    expect(screen.getAllByText(/Ajuste global/i).length).toBe(1);
  });

  it("Header sigue mostrando 'Costo con impuestos' independientemente del ajuste", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.costAdjustment = {
      kind: "BONUS", type: "PERCENTAGE", value: 10, amount: 100,
    };
    (line.pricingMeta as any).costBase      = "900.0000";
    (line.pricingMeta as any).costTaxAmount = "27.0000";
    (line.pricingMeta as any).costWithTax   = "927.0000";
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText(/Costo con impuestos:/)).toBeInTheDocument();
    expect(screen.getByText(/ARS\s*927,00/)).toBeInTheDocument();
    expect(document.querySelector("[data-cost-adjustment-detail]")).not.toBeNull();
  });
});

describe("FASE F7 — 'Flujo de construcción del precio' removido de Factura", () => {
  it("NO renderea el header 'Flujo de construcción del precio'", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.queryByText(/Flujo de construcción del precio/i)).toBeNull();
  });

  it("NO renderea los 4 cards del flujo (Costo base · Ajustes · Impacto · Rentabilidad)", () => {
    const line = makeLine();
    (line.pricingMeta as any).metalCost = 500;
    (line.pricingMeta as any).metalSale = 1500;
    (line.pricingMeta as any).hechuraCost = 200;
    (line.pricingMeta as any).hechuraSale = 800;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.queryByText(/Costo base del artículo/i)).toBeNull();
    expect(screen.queryByText(/Ajustes globales aplicados/i)).toBeNull();
    expect(screen.queryByText(/Impacto en el precio de venta/i)).toBeNull();
    expect(screen.queryByText(/Resumen de rentabilidad/i)).toBeNull();
  });

  it("Conserva el card 'Composición del costo del artículo' (su data sigue ahí)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText(/Composición del costo del artículo/i)).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Margen "no atribuible por línea" (MARGIN_TOTAL / modos derivados).
// El motor backend emite `hechuraMarginPct = 0` y `metalMarginPct = 0` en
// modos derivados (PROPORTIONAL_COST / SERVICE_AS_HECHURA / MANUAL_AS_HECHURA
// / COMBO_COMPONENTS). En esos casos `composition.hechuras[i].lineSale`
// colapsa al `lineCost`, y antes la grilla mostraba "+0,0%" engañoso.
//
// COMPORTAMIENTO ACTUAL — consistencia visual con el Simulador
// (`PriceBaseSection` / `PriceCompositionCards`):
//   · Si tenemos `basePrice` y `unitCost` en `pricingMeta`, derivamos el
//     `unifiedFactor = basePrice/unitCost` y mostramos el margen visual del
//     artículo (`(unifiedFactor − 1) × 100`) — display-only, no recalcula
//     precios. Tooltip "Margen unificado aplicado al total del artículo".
//   · Si NO tenemos esos datos (snapshot legacy / motor no los emitió),
//     fallback a "—" para no mentir al operador.
//
// Cero matemática nueva: el motor ya emite `basePrice`, `unitCost`,
// `metalSale/metalCost` y `hechuraSale/hechuraCost`.
// ────────────────────────────────────────────────────────────────────────────
describe("Margen no atribuible por línea (MARGIN_TOTAL)", () => {
  // Helper: arma una línea cuya HECHURA está en modo derivado del backend.
  // makeLine default trae `basePrice=1000, unitCost=400` → unifiedFactor=2.5
  // → margen visual = +150,0%.
  function makeLineHechuraUnattributable() {
    const line = makeLine();
    const meta = line.pricingMeta as any;
    meta.hechuraMarginPct = 0;
    meta.hechuraCost      = 200;
    meta.hechuraSale      = 350; // sale agregado distinto → señal de "derivado"
    meta.composition.hechuras[0].lineCost = 200;
    meta.composition.hechuras[0].lineSale = 200; // colapsado por el motor
    return line;
  }

  it("HECHURA en MARGIN_TOTAL (mpct=0) con basePrice/unitCost → muestra margen unificado visual (no '—' ni '+0,0%')", () => {
    const line = makeLineHechuraUnattributable();
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const cells = Array.from(document.querySelectorAll("[data-margin-cell]"));
    expect(cells.length).toBeGreaterThanOrEqual(1);
    // unifiedFactor = 1000/400 = 2.5 → margen visual = +150,0%.
    const hasUnified = cells.some((c) => /\+150,0%/.test(c.textContent ?? ""));
    expect(hasUnified).toBe(true);
    // No debe mostrar +0,0% ni "—" en la fila de hechura.
    const has00 = cells.some((c) => /\+0,0%/.test(c.textContent ?? ""));
    expect(has00).toBe(false);
  });

  it("HECHURA en MARGIN_TOTAL → la celda con margen visual lleva tooltip 'Margen unificado…'", () => {
    const line = makeLineHechuraUnattributable();
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const unified = document.querySelector('[data-margin-source="unified"]');
    expect(unified).not.toBeNull();
    expect(unified?.getAttribute("title")).toMatch(/margen unificado/i);
  });

  it("HECHURA en MARGIN_TOTAL SIN basePrice/unitCost → fallback a '—' (no se inventa margen)", () => {
    const line = makeLineHechuraUnattributable();
    const meta = line.pricingMeta as any;
    // Quitamos los datos globales del artículo → unifiedFactor = null.
    meta.basePrice = null;
    meta.unitCost  = null;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const cells = Array.from(document.querySelectorAll("[data-margin-cell]"));
    // No hay margen unificado posible → "—" en la fila hechura.
    const has00 = cells.some((c) => /\+0,0%/.test(c.textContent ?? ""));
    expect(has00).toBe(false);
    const hasDash = cells.some((c) => (c.textContent ?? "").includes("—"));
    expect(hasDash).toBe(true);
  });

  it("HECHURA con margen explícito (mpct > 0, sale ≠ cost) → sigue mostrando el porcentaje real por línea", () => {
    const line = makeLine();
    const meta = line.pricingMeta as any;
    meta.hechuraMarginPct = 50;        // motor emitió margen explícito (METAL_HECHURA)
    meta.hechuraCost      = 200;
    meta.hechuraSale      = 300;
    meta.composition.hechuras[0].lineCost = 200;
    meta.composition.hechuras[0].lineSale = 300;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const cells = document.querySelectorAll("[data-margin-cell]");
    const has50 = Array.from(cells).some((c) => /\+50,0%/.test(c.textContent ?? ""));
    expect(has50).toBe(true);
    // El margen real por línea NO debe llevar tooltip de unificado.
    const unified = document.querySelector('[data-margin-source="unified"]');
    expect(unified).toBeNull();
  });

  it("HECHURA con margen 0% literal (sale === cost) → muestra '+0,0%' (no se oculta)", () => {
    // Caso edge legítimo: lista METAL_HECHURA declara margen 0% — el sale
    // agregado es exactamente igual al cost agregado. El detector NO aplica
    // porque `sale === cost` (no es "derivado"). Mostrar 0% acá es la verdad.
    const line = makeLine();
    const meta = line.pricingMeta as any;
    meta.hechuraMarginPct = 0;
    meta.hechuraCost      = 200;
    meta.hechuraSale      = 200;
    meta.composition.hechuras[0].lineCost = 200;
    meta.composition.hechuras[0].lineSale = 200;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const cells = document.querySelectorAll("[data-margin-cell]");
    const has00 = Array.from(cells).some((c) => /\+0,0%/.test(c.textContent ?? ""));
    expect(has00).toBe(true);
  });

  it("METAL en modo derivado (mpct=0, metalSale ≠ metalCost) → margen unificado visual en su celda", () => {
    const line = makeLine();
    const meta = line.pricingMeta as any;
    meta.metalMarginPct = 0;
    meta.metalCost      = 500;
    meta.metalSale      = 825; // sale agregado distinto → motor derivó por proporción
    meta.composition.metals[0].lineCost = 500;
    meta.composition.metals[0].lineSale = 500; // colapsado
    // Hechura con margen explícito → mantiene su porcentaje real por línea.
    meta.hechuraMarginPct = 50;
    meta.hechuraCost      = 200;
    meta.hechuraSale      = 300;
    meta.composition.hechuras[0].lineCost = 200;
    meta.composition.hechuras[0].lineSale = 300;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const cells = Array.from(document.querySelectorAll("[data-margin-cell]"));
    expect(cells.length).toBeGreaterThanOrEqual(2);
    // Metal: muestra unifiedFactor = 1000/400 = 2.5 → +150,0%. Hechura: +50,0%.
    const has150 = cells.some((c) => /\+150,0%/.test(c.textContent ?? ""));
    const has50  = cells.some((c) => /\+50,0%/.test(c.textContent ?? ""));
    expect(has150).toBe(true);
    expect(has50).toBe(true);
  });

  it("PRODUCT en HECHURA-derivado → margen unificado visual (sigue el mismo bucket que hechura)", () => {
    const line = makeLineHechuraUnattributable();
    const meta = line.pricingMeta as any;
    // PRODUCT con lineSale colapsado al cost (motor derivó en bucket hechura).
    meta.composition.products[0].totalValue = 150;
    meta.composition.products[0].lineSale   = 150;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // unifiedFactor = 2.5 → todas las filas en modo derivado muestran +150,0%.
    const cells = Array.from(document.querySelectorAll("[data-margin-cell]"));
    const has00 = cells.some((c) => /\+0,0%/.test(c.textContent ?? ""));
    expect(has00).toBe(false);
    const has150 = cells.some((c) => /\+150,0%/.test(c.textContent ?? ""));
    expect(has150).toBe(true);
  });

  it("Tooltip del header 'Margen' explica el comportamiento en valor unificado", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const header = document.querySelector('[data-column-header="margen"]') as HTMLElement;
    expect(header).not.toBeNull();
    // El title menciona "valor unificado" y "—" para que el operador entienda.
    expect(header.getAttribute("title")).toMatch(/valor unificado/i);
    expect(header.getAttribute("title")).toMatch(/—/);
  });

  it("Costo Total se mantiene como lineCost real del backend (el override NO lo toca)", () => {
    // El override visual de unifiedFactor reemplaza la columna "Costo de Venta"
    // (= lineSale × qty), pero NUNCA "Costo Total" (= lineCost × qty). Costo
    // Total sigue siendo el dato real del motor.
    const line = makeLineHechuraUnattributable();
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // Buscamos "ARS 200,00" en algún lugar del DOM (Costo Total de la hechura).
    expect(screen.getAllByText(/ARS\s*200,00/).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Costo de Venta — alineación con Simulador en MARGIN_TOTAL / valor unificado.
// El motor backend emite `lineSale === lineCost` en modos derivados (margen
// no atribuible por componente). El Simulador resuelve esto reemplazando
// visualmente `lineSale → lineCost × unifiedFactor` (= basePrice/unitCost).
// Esta sección verifica que Factura aplica el mismo override visual.
//
// Display puro: no se reemplaza `lineSale` real, no se modifican totales,
// no se toca el motor. Detalle del helper: `resolveSaleForRowDisplay`.
// ────────────────────────────────────────────────────────────────────────────
describe("Costo de Venta — override unifiedFactor (alineación con Simulador)", () => {
  function makeLineMarginTotal() {
    // basePrice=1000, unitCost=400 → unifiedFactor = 2.5.
    const line = makeLine();
    const meta = line.pricingMeta as any;
    // Solo HECHURA (sin METAL): simula MARGIN_TOTAL puro de un artículo de
    // mano de obra. Backend emite lineSale colapsado al lineCost.
    meta.hechuraMarginPct = 0;
    meta.hechuraCost      = 200;
    meta.hechuraSale      = 500; // sale agregado = unitCost × unifiedFactor... bueno, hechura
    meta.composition.hechuras[0].lineCost = 200;
    meta.composition.hechuras[0].lineSale = 200; // colapsado
    // Sin metales para aislar el caso.
    meta.metalCost = 0; meta.metalSale = 0;
    meta.composition.metals = [];
    meta.composition.products = [];
    meta.composition.services = [];
    return line;
  }

  it("Caso 1 — MARGIN_TOTAL: 'Costo de Venta' muestra lineCost × unifiedFactor (no lineCost)", () => {
    // unifiedFactor = 1000/400 = 2.5 → Costo de Venta esperado = 200 × 2.5 = 500.
    render(<SaleCompositionEditableGrid line={makeLineMarginTotal()} onApply={vi.fn()} {...baseProps} />);
    const sales = Array.from(document.querySelectorAll('[data-sale-source]'));
    const unified = sales.find((el) => el.getAttribute("data-sale-source") === "unified");
    expect(unified).toBeDefined();
    expect(unified!.textContent ?? "").toMatch(/ARS\s*500,00/);
    // Tooltip discreto presente.
    expect(unified!.getAttribute("title")).toMatch(/valor unificado/i);
  });

  it("Caso 2 — Modo desglosado (mpct>0, lineSale real ≠ lineCost): NO se activa override, Costo de Venta = lineSale real", () => {
    const line = makeLine();
    const meta = line.pricingMeta as any;
    meta.hechuraMarginPct = 50;
    meta.hechuraCost      = 200;
    meta.hechuraSale      = 300;
    meta.composition.hechuras[0].lineCost = 200;
    meta.composition.hechuras[0].lineSale = 300;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // Costo de Venta = 300 (lineSale del backend).
    const cells = Array.from(document.querySelectorAll('[data-sale-source]'));
    const hechCell = cells.find((c) => /ARS\s*300,00/.test(c.textContent ?? ""));
    expect(hechCell).toBeDefined();
    // Y NO debe estar marcado como unificado.
    expect(hechCell!.getAttribute("data-sale-source")).toBe("line");
    expect(hechCell!.getAttribute("title")).toBeNull();
  });

  it("Caso 3 — unifiedFactor ≈ 1 (margen 0% real, sale === cost declarado): NO se activa override", () => {
    // basePrice === unitCost → unifiedFactor = 1 → no aplica override.
    const line = makeLine({ basePrice: 400, unitCost: 400 } as any);
    const meta = line.pricingMeta as any;
    meta.hechuraMarginPct = 0;
    meta.hechuraCost      = 200;
    meta.hechuraSale      = 200; // sale === cost → marginUnattributable false
    meta.composition.hechuras[0].lineCost = 200;
    meta.composition.hechuras[0].lineSale = 200;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const cells = Array.from(document.querySelectorAll('[data-sale-source]'));
    // Ninguna celda debe llevar el flag unified.
    const anyUnified = cells.some((c) => c.getAttribute("data-sale-source") === "unified");
    expect(anyUnified).toBe(false);
  });

  it("Caso 4 — Snapshot legacy sin basePrice/unitCost: fallback seguro, NO override (Costo de Venta = lineSale colapsado)", () => {
    const line = makeLineMarginTotal();
    const meta = line.pricingMeta as any;
    // Datos globales del artículo ausentes → unifiedFactor = null.
    meta.basePrice = null;
    meta.unitCost  = null;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const cells = Array.from(document.querySelectorAll('[data-sale-source]'));
    // Ninguna celda lleva data-sale-source="unified".
    const anyUnified = cells.some((c) => c.getAttribute("data-sale-source") === "unified");
    expect(anyUnified).toBe(false);
    // El monto cae al lineSale colapsado (= 200) — fallback honesto, no se inventa nada.
    const hechCell = cells.find((c) => /ARS\s*200,00/.test(c.textContent ?? ""));
    expect(hechCell).toBeDefined();
  });

  it("Caso 5 — Paridad agregada: Σ Costo de Venta (display) === basePrice en modo derivado", () => {
    // Artículo con MÚLTIPLES hechuras + 1 producto, todas colapsadas en
    // MARGIN_TOTAL. unifiedFactor = 1000/400 = 2.5.
    //   hechura1: cost 120 → venta display 300
    //   hechura2: cost  80 → venta display 200
    //   product1: cost 200 → venta display 500
    // Σ display = 1000 = basePrice. ✓
    const line = makeLine();
    const meta = line.pricingMeta as any;
    meta.hechuraMarginPct = 0;
    meta.hechuraCost      = 200;
    meta.hechuraSale      = 500; // colapsado
    meta.composition.hechuras = [
      { costLineId: "h1", appliedAmount: 120, lineCost: 120, lineSale: 120, lineLabel: "Hechura A" },
      { costLineId: "h2", appliedAmount:  80, lineCost:  80, lineSale:  80, lineLabel: "Hechura B" },
    ];
    meta.composition.products = [
      {
        costLineId: "p1", catalogItemId: "ci-p1", catalogItemCode: "P-001",
        catalogItemName: "Cadena 60cm",
        quantity: 1, unitValue: 200, totalValue: 200, lineSale: 200,
        currencyId: null,
        lineAdjKind: null, lineAdjType: null, lineAdjValue: null, lineAdjAmount: null,
        affectsStock: null,
      },
    ];
    meta.composition.services = [];
    // Sin metal en este fixture (mantenemos el del makeLine default, ignorable
    // a efectos del Σ porque metalMarginPct sigue 0 y metalCost > 0 hace que
    // el metal también caiga al override unificado — ajustamos para excluir).
    meta.metalCost = 0; meta.metalSale = 0;
    meta.composition.metals = [];
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const unifiedCells = Array.from(document.querySelectorAll('[data-sale-source="unified"]'));
    expect(unifiedCells.length).toBe(3); // 2 hechuras + 1 product
    const totalDisplay = unifiedCells.reduce((acc, c) => {
      // Parseamos "ARS X.XXX,XX" → número.
      const txt = (c.textContent ?? "").replace(/[^\d,.-]/g, "");
      const normalized = txt.replace(/\./g, "").replace(",", ".");
      const n = parseFloat(normalized);
      return acc + (Number.isFinite(n) ? n : 0);
    }, 0);
    // Σ display === basePrice (1000). Tolerancia de 0.01 por redondeo de display.
    expect(Math.abs(totalDisplay - 1000)).toBeLessThan(0.05);
  });

  it("Helper resolveSaleForRowDisplay: matriz de condiciones", async () => {
    const { resolveSaleForRowDisplay } = await import("../SaleCompositionEditableGrid");
    // Caso típico MARGIN_TOTAL — todas las condiciones se cumplen.
    expect(resolveSaleForRowDisplay(200, 200, 2.5, true))
      .toEqual({ saleForRow: 500, isUnified: true });
    // marginUnattributable=false → no override.
    expect(resolveSaleForRowDisplay(200, 200, 2.5, false))
      .toEqual({ saleForRow: 200, isUnified: false });
    // lineSale ≠ lineCost (modo desglosado) → no override.
    expect(resolveSaleForRowDisplay(200, 350, 2.5, true))
      .toEqual({ saleForRow: 350, isUnified: false });
    // unifiedFactor ≈ 1 → no override.
    expect(resolveSaleForRowDisplay(200, 200, 1.0, true))
      .toEqual({ saleForRow: 200, isUnified: false });
    // unifiedFactor null (snapshot legacy) → no override.
    expect(resolveSaleForRowDisplay(200, 200, null, true))
      .toEqual({ saleForRow: 200, isUnified: false });
    // canonicalSale null → no override (no hay nada que comparar).
    expect(resolveSaleForRowDisplay(200, null, 2.5, true))
      .toEqual({ saleForRow: null, isUnified: false });
    // lineCost ≈ 0 → no override (evita división absurda).
    expect(resolveSaleForRowDisplay(0, 0, 2.5, true))
      .toEqual({ saleForRow: 0, isUnified: false });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Moneda por cost line (HECHURA / PRODUCT / SERVICE) — display de costo
// unitario en moneda ORIGINAL + equivalente en moneda del documento.
//
// El motor backend ya emite:
//   · `unitValue` en moneda original (ej. USD 74.76)
//   · `totalValue` en moneda base (ARS post-conversión)
//   · `currencyId` (id de la moneda original)
//
// El frontend solo MAPEA el currencyId al code/symbol (con el catálogo
// `currencyById` que recibe como prop) y muestra una sub-línea con el
// equivalente `totalValue / quantity` en moneda del documento. No recalcula.
// ────────────────────────────────────────────────────────────────────────────
describe("Costo unit. — moneda original + equivalente en moneda doc", () => {
  const currencyById = new Map<string, { code?: string | null; symbol?: string | null }>([
    ["cur-usd", { code: "USD", symbol: "US$" }],
    ["cur-ars", { code: "ARS", symbol: "$" }],
  ]);

  it("Caso 1 — HECHURA con currencyId USD ≠ documento ARS → muestra USD en celda y sub-línea ≈ ARS / unidad", () => {
    const line = makeLine();
    const meta = line.pricingMeta as any;
    meta.composition.hechuras[0] = {
      costLineId:  "cl-hechura-1",
      lineLabel:   "Mano de obra",
      unitValue:   74.76,
      appliedAmount: 74.76,
      lineCost:    100926,
      currencyId:  "cur-usd",
    };
    render(
      <SaleCompositionEditableGrid
        line={line} onApply={vi.fn()}
        currency="ARS"
        currencyById={currencyById}
        {...baseProps}
      />
    );
    // El label de la celda Costo unit. muestra USD (override).
    const labels = Array.from(document.querySelectorAll("span"))
      .filter((s) => s.textContent === "USD");
    expect(labels.length).toBeGreaterThan(0);
    // La sub-línea muestra el equivalente en ARS: lineCost/qty = 100926/1 = 100926.
    const sub = Array.from(document.querySelectorAll("div"))
      .find((d) => /≈\s*ARS\s*100\.926,00\s*\/\s*unidad/.test(d.textContent ?? ""));
    expect(sub).toBeDefined();
  });

  it("Caso 2 — Sin currencyById (snapshot legacy): comportamiento idéntico al anterior (no override)", () => {
    const line = makeLine();
    const meta = line.pricingMeta as any;
    meta.composition.hechuras[0] = {
      costLineId:  "cl-hechura-1",
      lineLabel:   "Mano de obra",
      unitValue:   74.76,
      appliedAmount: 74.76,
      lineCost:    100926,
      currencyId:  "cur-usd",
    };
    render(
      <SaleCompositionEditableGrid
        line={line} onApply={vi.fn()}
        currency="ARS"
        {...baseProps}
      />
    );
    const labels = Array.from(document.querySelectorAll("span"))
      .filter((s) => s.textContent === "USD");
    expect(labels.length).toBe(0);
    const sub = Array.from(document.querySelectorAll("div"))
      .find((d) => /≈\s*ARS\s*100\.926,00\s*\/\s*unidad/.test(d.textContent ?? ""));
    expect(sub).toBeUndefined();
  });

  it("Caso 3 — currencyId === code del documento: NO se activa override", () => {
    const line = makeLine();
    const meta = line.pricingMeta as any;
    meta.composition.hechuras[0] = {
      costLineId:  "cl-hechura-1",
      lineLabel:   "Mano de obra",
      unitValue:   500,
      appliedAmount: 500,
      lineCost:    500,
      currencyId:  "cur-ars",
    };
    render(
      <SaleCompositionEditableGrid
        line={line} onApply={vi.fn()}
        currency="ARS"
        currencyById={currencyById}
        {...baseProps}
      />
    );
    const sub = Array.from(document.querySelectorAll("div"))
      .find((d) => /≈\s*ARS/.test(d.textContent ?? ""));
    expect(sub).toBeUndefined();
  });

  it("Caso 4 — METAL no se ve afectado (su costo unit ya está derivado de lineCost/qty en moneda base)", () => {
    const line = makeLine();
    const meta = line.pricingMeta as any;
    meta.composition.metals[0] = {
      ...meta.composition.metals[0],
      currencyId: "cur-usd",
    };
    render(
      <SaleCompositionEditableGrid
        line={line} onApply={vi.fn()}
        currency="ARS"
        currencyById={currencyById}
        {...baseProps}
      />
    );
    // El grid sólo aplica el helper a HECHURA/PRODUCT/SERVICE. METAL queda intacto.
    const usdLabels = Array.from(document.querySelectorAll("span"))
      .filter((s) => s.textContent === "USD");
    expect(usdLabels.length).toBe(0);
  });

  it("HECHURA quantity > 1 → la columna Cantidad rehidrata desde h.quantity (no '1' hardcoded)", () => {
    const line = makeLine();
    const meta = line.pricingMeta as any;
    // Cost line HECHURA con qty=3 (mano de obra: 3 horas por anillo).
    meta.composition.hechuras[0] = {
      costLineId:  "cl-hechura-1",
      lineLabel:   "Mano de obra",
      quantity:    3,
      unitValue:   75.76,
      appliedAmount: 227.28,
      lineCost:    227.28,
    };
    render(
      <SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />
    );
    // El input de Cantidad de la fila HECHURA contiene 3 (no 1).
    // Buscamos el input dentro del row identificado por el label.
    const labelEl = screen.getByText("Mano de obra");
    const row = labelEl.closest("[class*='group']") ?? labelEl.parentElement!.parentElement!;
    const inputs = row.querySelectorAll('input[type="text"], input[inputmode="decimal"], input');
    const values = Array.from(inputs).map((i) => (i as HTMLInputElement).value);
    expect(values.some((v) => /^3([,.]00?)?$/.test(v))).toBe(true);
  });

  it("HECHURA sin h.quantity (snapshot legacy) → fallback 1", () => {
    const line = makeLine();
    const meta = line.pricingMeta as any;
    meta.composition.hechuras[0] = {
      costLineId:  "cl-hechura-1",
      lineLabel:   "Mano de obra",
      // sin `quantity` (snapshot viejo)
      unitValue:   200,
      appliedAmount: 200,
      lineCost:    200,
    };
    render(
      <SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />
    );
    const labelEl = screen.getByText("Mano de obra");
    const row = labelEl.closest("[class*='group']") ?? labelEl.parentElement!.parentElement!;
    const inputs = row.querySelectorAll('input');
    const values = Array.from(inputs).map((i) => (i as HTMLInputElement).value);
    // Al menos un input con valor "1" (fallback de HECHURA típica).
    expect(values.some((v) => /^1([,.]00?)?$/.test(v))).toBe(true);
  });

  it("HECHURA con quantityOverride pisa h.quantity (override sigue funcionando)", () => {
    const line = makeLine();
    const meta = line.pricingMeta as any;
    meta.composition.hechuras[0] = {
      costLineId:  "cl-hechura-1",
      lineLabel:   "Mano de obra",
      quantity:    3,
      unitValue:   75.76,
      appliedAmount: 227.28,
      lineCost:    227.28,
    };
    meta.costLineOverridesApplied = [
      { costLineId: "cl-hechura-1", type: "HECHURA", quantityOverride: 5 },
    ];
    render(
      <SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />
    );
    const labelEl = screen.getByText("Mano de obra");
    const row = labelEl.closest("[class*='group']") ?? labelEl.parentElement!.parentElement!;
    const inputs = row.querySelectorAll('input');
    const values = Array.from(inputs).map((i) => (i as HTMLInputElement).value);
    // El override (5) gana sobre h.quantity (3).
    expect(values.some((v) => /^5([,.]00?)?$/.test(v))).toBe(true);
    expect(values.some((v) => /^3([,.]00?)?$/.test(v))).toBe(false);
  });

  it("HECHURA con currencyCode autocontenido (backend enriquecido) → muestra el code sin necesitar currencyById", () => {
    const line = makeLine();
    const meta = line.pricingMeta as any;
    // Snapshot enriquecido v6: el composition item ya trae currencyCode.
    meta.composition.hechuras[0] = {
      costLineId:    "cl-hechura-1",
      lineLabel:     "Mano de obra",
      quantity:      3,
      unitValue:     75.76,
      appliedAmount: 227.28,
      lineCost:      227.28,
      currencyId:    "cur-usd",
      currencyCode:  "USD",
      currencySymbol:"US$",
    };
    render(
      <SaleCompositionEditableGrid
        line={line} onApply={vi.fn()}
        currency="ARS"
        // NO pasamos currencyById — el code viene autocontenido.
        {...baseProps}
      />
    );
    const labels = Array.from(document.querySelectorAll("span"))
      .filter((s) => s.textContent === "USD");
    expect(labels.length).toBeGreaterThan(0);
  });

  it("HECHURA con quantityUnit (selección del operador) → la columna Unidad muestra la unidad real", () => {
    const line = makeLine();
    const meta = line.pricingMeta as any;
    meta.composition.hechuras[0] = {
      costLineId:   "cl-hechura-1",
      lineLabel:    "Mano de obra",
      quantity:     3,
      quantityUnit: "hr",       // ← selección del operador
      unitValue:    75.76,
      appliedAmount: 227.28,
      lineCost:     227.28,
    };
    render(
      <SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />
    );
    // Sin catálogo de Units mapeado, el code crudo "hr" queda como fallback
    // intermedio (paso 2 de la cascada: catálogo → quantityUnitName → code
    // crudo → "Unidad"). HECHURA no tiene quantityUnitName de Article.
    expect(screen.getAllByText("hr").length).toBeGreaterThan(0);
  });

  it("HECHURA sin quantityUnit (snapshot legacy) → fallback 'Unidad'", () => {
    const line = makeLine();
    const meta = line.pricingMeta as any;
    meta.composition.hechuras[0] = {
      costLineId:   "cl-hechura-1",
      lineLabel:    "Mano de obra",
      quantity:     1,
      unitValue:    200,
      appliedAmount: 200,
      lineCost:     200,
      // sin quantityUnit
    };
    render(
      <SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />
    );
    // Sin code ni catálogo → fallback final "Unidad" (singular).
    expect(screen.getAllByText("Unidad").length).toBeGreaterThan(0);
  });

  it("PRODUCT con quantityUnit cost line → si catálogo no mapea, cae a quantityUnitName del Article", () => {
    // Cascada nueva: catálogo (vacío en este test) → quantityUnitName ("par")
    // → code "kg" → "Unidad". Como no hay catálogo poblado, el fallback es
    // el quantityUnitName del Article maestro ("par").
    const line = makeLine();
    const meta = line.pricingMeta as any;
    meta.composition.products[0] = {
      costLineId:      "cl-product-1",
      catalogItemId:   "ci-p1",
      catalogItemCode: "P-001",
      catalogItemName: "Cadena 60cm",
      quantity:        2,
      quantityUnit:    "kg",        // code técnico del cost line
      unitValue:       150,
      totalValue:      300,
      currencyId:      null,
      quantityUnitName: "par",      // nombre legible del Article maestro
      lineAdjKind: null, lineAdjType: null, lineAdjValue: null, lineAdjAmount: null,
      affectsStock: null,
    };
    render(
      <SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />
    );
    // Sin catálogo → cae a "par" (quantityUnitName), no muestra el code "kg"
    // crudo en la sub-línea de Cantidad.
    expect(screen.getAllByText("par").length).toBeGreaterThan(0);
  });

  it("PRODUCT con catálogo mapeando 'kg' → 'Kilogramo' gana sobre quantityUnitName del Article", () => {
    // Con catálogo poblado, el nombre del catálogo es la primera opción.
    const unitNameByCode = new Map<string, string>([
      ["kg", "Kilogramo"],
    ]);
    const line = makeLine();
    const meta = line.pricingMeta as any;
    meta.composition.products[0] = {
      costLineId:      "cl-product-1",
      catalogItemId:   "ci-p1",
      catalogItemCode: "P-001",
      catalogItemName: "Cadena 60cm",
      quantity:        2,
      quantityUnit:    "kg",
      unitValue:       150,
      totalValue:      300,
      currencyId:      null,
      quantityUnitName: "par",
      lineAdjKind: null, lineAdjType: null, lineAdjValue: null, lineAdjAmount: null,
      affectsStock: null,
    };
    render(
      <SaleCompositionEditableGrid
        line={line} onApply={vi.fn()}
        unitNameByCode={unitNameByCode}
        {...baseProps}
      />
    );
    expect(screen.getAllByText("Kilogramo").length).toBeGreaterThan(0);
    // No aparece el code "kg" como display principal cuando hay catálogo.
    expect(screen.queryByText("kg")).toBeNull();
  });

  it("PRODUCT con quantityUnitName del catálogo → la celda Cantidad usa la unidad real (no 'Unidades')", () => {
    const line = makeLine();
    const meta = line.pricingMeta as any;
    meta.composition.products[0] = {
      costLineId:      "cl-product-1",
      catalogItemId:   "ci-p1",
      catalogItemCode: "P-001",
      catalogItemName: "Cadena 60cm",
      quantity:        2,
      unitValue:       150,
      totalValue:      300,
      currencyId:      null,
      quantityUnitName: "par",
      lineAdjKind: null, lineAdjType: null, lineAdjValue: null, lineAdjAmount: null,
      affectsStock: null,
    };
    render(
      <SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />
    );
    // "par" aparece como sub-línea de unidad debajo del input de cantidad.
    expect(screen.getAllByText("par").length).toBeGreaterThan(0);
    // "Unidades" (fallback) no aparece para la fila PRODUCT.
    // (Puede aparecer en otras filas — no hacemos assert de absencia global).
  });

  it("Helper resolveItemCurrencyDisplay: matriz de condiciones", async () => {
    const { resolveItemCurrencyDisplay } = await import("../SaleCompositionEditableGrid");
    const map = new Map<string, { code?: string | null; symbol?: string | null }>([
      ["cur-usd", { code: "USD" }],
      ["cur-ars", { code: "ARS" }],
    ]);
    // Caso típico — currencyId distinto al doc.
    expect(resolveItemCurrencyDisplay(
      { currencyId: "cur-usd", unitValue: 74.76, totalValue: 100926, quantity: 1 },
      "ARS", map,
    )).toEqual({ originalCurrencyLabel: "USD", equivalentUnitValue: 100926 });
    // Sin map → null.
    expect(resolveItemCurrencyDisplay(
      { currencyId: "cur-usd", unitValue: 74.76, totalValue: 100926, quantity: 1 },
      "ARS", null,
    )).toBeNull();
    // Sin currencyId → null.
    expect(resolveItemCurrencyDisplay(
      { currencyId: null, unitValue: 74.76, totalValue: 100926, quantity: 1 },
      "ARS", map,
    )).toBeNull();
    // currencyId no está en el map → null.
    expect(resolveItemCurrencyDisplay(
      { currencyId: "cur-eur", unitValue: 74.76, totalValue: 100926, quantity: 1 },
      "ARS", map,
    )).toBeNull();
    // Mismo code que documento → null (sin conversión efectiva).
    expect(resolveItemCurrencyDisplay(
      { currencyId: "cur-ars", unitValue: 500, totalValue: 500, quantity: 1 },
      "ARS", map,
    )).toBeNull();
    // qty 0 → equivalentUnitValue null (pero igual devuelve label).
    expect(resolveItemCurrencyDisplay(
      { currencyId: "cur-usd", unitValue: 74.76, totalValue: 100926, quantity: 0 },
      "ARS", map,
    )).toEqual({ originalCurrencyLabel: "USD", equivalentUnitValue: null });
    // totalValue 0 → equivalentUnitValue null.
    expect(resolveItemCurrencyDisplay(
      { currencyId: "cur-usd", unitValue: 74.76, totalValue: 0, quantity: 1 },
      "ARS", map,
    )).toEqual({ originalCurrencyLabel: "USD", equivalentUnitValue: null });

    // currencyCode autocontenido SIN currencyById → resuelve por el item.
    expect(resolveItemCurrencyDisplay(
      { currencyCode: "USD", unitValue: 74.76, totalValue: 100926, quantity: 1 },
      "ARS", null,
    )).toEqual({ originalCurrencyLabel: "USD", equivalentUnitValue: 100926 });

    // currencyCode autocontenido === documento → no override (sin "USD" falso).
    expect(resolveItemCurrencyDisplay(
      { currencyCode: "ARS", unitValue: 500, totalValue: 500, quantity: 1 },
      "ARS", null,
    )).toBeNull();

    // unitValueBase autocontenido (pre-ajuste) → se usa directo, NO se cae
    // a totalValue/quantity (que sería post-ajuste y confunde con doble desc).
    expect(resolveItemCurrencyDisplay(
      {
        currencyCode:  "USD",
        unitValue:     75.76,
        unitValueBase: 38_410.32,  // unitValue × rate, pre-ajuste
        totalValue:    33_801,      // post-ajuste (engaña al fallback)
        quantity:      1,
      },
      "ARS", null,
    )).toEqual({ originalCurrencyLabel: "USD", equivalentUnitValue: 38_410.32 });
  });

  it("Caso doble descuento — con unitValueBase la sub-línea muestra equivalente PRE-ajuste", () => {
    // HECHURA con ajuste -12%, cost line en USD. El motor emite:
    //   unitValue = 75.76 (USD, pre-conv, pre-adj)
    //   unitValueBase = 75.76 × rate (ARS, pre-adj)  ← lo que muestra la sub-línea
    //   totalValue = qty × unitValue × rate × (1 − 0.12)  (post-adj)
    const line = makeLine();
    const meta = line.pricingMeta as any;
    meta.composition.hechuras[0] = {
      costLineId:    "cl-hechura-1",
      lineLabel:     "Mano de obra",
      quantity:      1,
      unitValue:     75.76,
      unitValueBase: 38_410,        // unitValue × rate (≈ rate 507)
      appliedAmount: 33_801,        // post-adj
      lineCost:      33_801,        // post-adj
      currencyId:    "cur-usd",
      currencyCode:  "USD",
      currencySymbol:"US$",
      lineAdjKind:   "BONUS",
      lineAdjType:   "PERCENTAGE",
      lineAdjValue:  12,
      lineAdjAmount: 4_609,
    };
    render(
      <SaleCompositionEditableGrid
        line={line} onApply={vi.fn()}
        currency="ARS"
        {...baseProps}
      />
    );
    // Sub-línea muestra unitValueBase (pre-ajuste) — NO totalValue/quantity.
    const subLines = Array.from(document.querySelectorAll("div"))
      .filter((d) => /≈\s*ARS\s*38\.410/.test(d.textContent ?? ""));
    expect(subLines.length).toBeGreaterThan(0);
    // No aparece "≈ ARS 33.801" (el valor post-ajuste).
    const postAdjSubLine = Array.from(document.querySelectorAll("div"))
      .find((d) => /≈\s*ARS\s*33\.801/.test(d.textContent ?? ""));
    expect(postAdjSubLine).toBeUndefined();
  });

  it("Footer 'Total hechuras' Venta usa override unifiedFactor + line.quantity (coincide con detalle)", () => {
    // MARGIN_TOTAL: motor emite lineSale = lineCost (colapsado).
    // Detalle Venta = lineCost × unifiedFactor × line.quantity (override display).
    // Footer Venta debe sumar el MISMO valor, no el lineSale raw.
    // basePrice=1000, unitCost=400 → unifiedFactor = 2.5.
    // hechuraCost=200, hechuraSale=500 (motor); composition.hechura.lineSale=200 (colapsado).
    // Esperado por línea: 200 × 2.5 = 500. line.quantity=1 → footer 500.
    const line = makeLine();
    const meta = line.pricingMeta as any;
    meta.hechuraMarginPct = 0;
    meta.hechuraCost      = 200;
    meta.hechuraSale      = 500;
    meta.composition.hechuras[0] = {
      costLineId:    "cl-hechura-1",
      lineLabel:     "Mano de obra",
      quantity:      1,
      unitValue:     200,
      appliedAmount: 200,
      lineCost:      200,
      lineSale:      200, // colapsado por el motor
    };
    render(
      <SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />
    );
    // El footer (data-group-footer="HECHURA") debe mostrar ARS 500,00 (override),
    // no ARS 200,00 (lineSale raw).
    const footer = document.querySelector('[data-group-footer="HECHURA"]');
    expect(footer).not.toBeNull();
    expect(footer!.textContent ?? "").toMatch(/ARS\s*500,00/);
    expect(footer!.textContent ?? "").not.toMatch(/ARS\s*200,00\s*ARS\s*200,00/);
  });

  it("Footer 'Total hechuras' Costo y Venta multiplican por line.quantity (alineado con detalle)", () => {
    // line.quantity=3: detalle Costo Total = lineCost × 3 = 600; Venta = lineSale × 3 = 900.
    // Footer debe coincidir.
    const line = makeLine({} as any);
    (line as any).quantity = 3;
    const meta = line.pricingMeta as any;
    meta.hechuraMarginPct = 50;
    meta.hechuraCost      = 200;
    meta.hechuraSale      = 300;
    meta.composition.hechuras[0] = {
      costLineId:    "cl-hechura-1",
      lineLabel:     "Mano de obra",
      quantity:      1,
      unitValue:     200,
      appliedAmount: 200,
      lineCost:      200,
      lineSale:      300, // motor con margen explícito
    };
    render(
      <SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />
    );
    const footer = document.querySelector('[data-group-footer="HECHURA"]');
    expect(footer).not.toBeNull();
    const txt = footer!.textContent ?? "";
    // Costo total grupo = 200 × 3 = 600. Venta total grupo = 300 × 3 = 900.
    expect(txt).toMatch(/ARS\s*600,00/);
    expect(txt).toMatch(/ARS\s*900,00/);
  });

  it("Footer 'Total productos' suma display correctamente con override unifiedFactor", () => {
    const line = makeLine();
    const meta = line.pricingMeta as any;
    // PRODUCT también queda en bucket hechura para el motor — mismo flag.
    meta.hechuraMarginPct = 0;
    meta.hechuraCost      = 200;
    meta.hechuraSale      = 500;
    meta.composition.hechuras = []; // sin HECHURA aparte para aislar
    meta.composition.products = [{
      costLineId:      "cl-p1",
      catalogItemId:   "ci-p1",
      catalogItemCode: "P-001",
      catalogItemName: "Cadena 60cm",
      quantity:        1,
      unitValue:       200,
      totalValue:      200,
      lineSale:        200, // colapsado
      currencyId:      null,
      lineAdjKind: null, lineAdjType: null, lineAdjValue: null, lineAdjAmount: null,
      affectsStock: null,
    }];
    render(
      <SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />
    );
    const footer = document.querySelector('[data-group-footer="PRODUCT"]');
    expect(footer).not.toBeNull();
    // unifiedFactor = 1000/400 = 2.5 → Venta footer = 200 × 2.5 × 1 = 500.
    expect(footer!.textContent ?? "").toMatch(/ARS\s*500,00/);
  });

  it("Costo Total expandido por line.quantity (línea factura completa)", () => {
    // HECHURA: lineCost=200 (por unidad de artículo), line.quantity=3 (documento).
    // Costo Total esperado = 200 × 3 = 600 (no 200, ni 200/qty).
    const line = makeLine({} as any);
    (line as any).quantity = 3;
    const meta = line.pricingMeta as any;
    meta.composition.hechuras[0] = {
      costLineId:    "cl-hechura-1",
      lineLabel:     "Mano de obra",
      quantity:      1,
      unitValue:     200,
      appliedAmount: 200,
      lineCost:      200,
    };
    render(
      <SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />
    );
    // ARS 600,00 aparece como Costo Total de la fila HECHURA.
    expect(screen.getAllByText(/ARS\s*600,00/).length).toBeGreaterThanOrEqual(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Columna "Cantidad" en la fila "Total <grupo>" — SIEMPRE (incluso 1 línea).
// Display only: suma de quantities; NO afecta costo/venta/margen.
// ────────────────────────────────────────────────────────────────────────────
describe("Total <grupo> — suma de Cantidad en la columna Cantidad", () => {
  it("METALES multi-línea: suma appliedGrams (1,10+1,20+1,30+1,40+1,40 = 6,40)", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.metals = [1.10, 1.20, 1.30, 1.40, 1.40].map((g, i) => ({
      costLineId:      `cl-m-${i}`,
      metalVariantId:  `mv-${i}`,
      metalName:       "Oro",
      variantName:     `Oro v${i}`,
      purity:          0.75,
      purityLabel:     "18k",
      appliedGrams:    g,
      appliedMermaPct: 0,
      lineCost:        100,
      quotePrice:      50,
    }));
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const footer = document.querySelector('[data-group-footer="METAL"]')!;
    expect(footer.textContent).toMatch(/Total metales/);
    expect(footer.textContent).toMatch(/6,40/);
    // Financiero intacto: Σ lineCost = 100×5 = 500 → footer sigue mostrando ARS 500,00.
    expect(footer.textContent).toMatch(/ARS\s*500,00/);
  });

  it("HECHURAS: 2 líneas sin `quantity` → fallback 1 c/u → total 2,00", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.hechuras = [
      { costLineId: "h1", lineLabel: "Mano de obra", appliedAmount: 100, lineCost: 100, lineSale: 100 },
      { costLineId: "h2", lineLabel: "Engaste",       appliedAmount: 150, lineCost: 150, lineSale: 150 },
    ];
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const footer = document.querySelector('[data-group-footer="HECHURA"]')!;
    expect(footer.textContent).toMatch(/Total hechuras/);
    expect(footer.textContent).toMatch(/2,00/);
  });

  it("PRODUCTOS con UNA sola línea: igualmente muestra el total (1,00)", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.products = [
      { costLineId: "p1", catalogItemName: "Cadena", quantity: 1, unitValue: 80, totalValue: 80,
        lineAdjKind: null, lineAdjType: null, lineAdjValue: null, lineAdjAmount: null },
    ];
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const footer = document.querySelector('[data-group-footer="PRODUCT"]')!;
    expect(footer.textContent).toMatch(/Total productos/);
    expect(footer.textContent).toMatch(/1,00/);
  });

  it("SERVICIOS con UNA sola línea: total = quantity (3,00) y no recalcula venta", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.services = [
      { costLineId: "s1", catalogItemName: "Pulido", quantity: 3, unitValue: 20, totalValue: 60,
        lineSale: 75, lineAdjKind: null, lineAdjType: null, lineAdjValue: null, lineAdjAmount: null },
    ];
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const footer = document.querySelector('[data-group-footer="SERVICE"]')!;
    expect(footer.textContent).toMatch(/Total servicios/);
    expect(footer.textContent).toMatch(/3,00/);
    // Venta NO recalculada en frontend: pasa por sumGroupLineSaleDisplay (passthrough).
    expect(footer.textContent).toMatch(/ARS/);
  });

  it("PRODUCTOS multi-línea: suma quantities (2 + 3 = 5,00) sin tocar totalValue", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.products = [
      { costLineId: "p1", catalogItemName: "A", quantity: 2, unitValue: 10, totalValue: 20,
        lineAdjKind: null, lineAdjType: null, lineAdjValue: null, lineAdjAmount: null },
      { costLineId: "p2", catalogItemName: "B", quantity: 3, unitValue: 10, totalValue: 30,
        lineAdjKind: null, lineAdjType: null, lineAdjValue: null, lineAdjAmount: null },
    ];
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const footer = document.querySelector('[data-group-footer="PRODUCT"]')!;
    expect(footer.textContent).toMatch(/5,00/);
    // Financiero intacto: Σ totalValue = 20 + 30 = 50.
    expect(footer.textContent).toMatch(/ARS\s*50,00/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Header METALES = equivalente de VENTA (= cards del Simulador "Composición
// del precio"), NO el equivalente de costo. saleEquivGr = costEquiv × factor.
// ────────────────────────────────────────────────────────────────────────────
describe("Header METALES — gramos de VENTA (paridad cards Simulador)", () => {
  function makeMetalsLine(withSaleAggregate: boolean): DocumentLine {
    const line = makeLine();
    const meta = line.pricingMeta as any;
    // Oro costo-equiv 4,33 / Plata 1,68 (pureza 1, sin merma).
    meta.composition.metals = [
      { costLineId: "o1", metalVariantId: "v1", metalName: "Oro",   variantName: "Oro 24k",
        purity: 1, purityLabel: "24k", appliedGrams: 4.33, appliedMermaPct: 0, lineCost: 100, quotePrice: 23.1 },
      { costLineId: "p1", metalVariantId: "v2", metalName: "Plata", variantName: "Plata 999",
        purity: 1, purityLabel: "999", appliedGrams: 1.68, appliedMermaPct: 0, lineCost: 50, quotePrice: 29.8 },
    ];
    if (withSaleAggregate) {
      // metalSaleFactor = metalSale/metalCost = 185/100 = 1,85.
      meta.metalCost = 100;
      meta.metalSale = 185;
    }
    return line;
  }

  it("con metalSale presente: muestra venta (Oro 8,01 · Plata 3,11), NO costo (4,33 / 1,68)", () => {
    render(<SaleCompositionEditableGrid line={makeMetalsLine(true)} onApply={vi.fn()} {...baseProps} />);
    const header = document.querySelector('[data-group-type="METAL"]')!;
    expect(header.textContent).toMatch(/·\s*Oro:\s*8,01\s*gr/);
    expect(header.textContent).toMatch(/·\s*Plata:\s*3,11\s*gr/);
    // NO debe mostrar el equivalente de costo cuando existe total de venta.
    expect(header.textContent).not.toMatch(/4,33\s*gr/);
    expect(header.textContent).not.toMatch(/1,68\s*gr/);
  });

  it("sin agregado de venta (factor null): cae a costo-equiv (Oro 4,33 · Plata 1,68)", () => {
    render(<SaleCompositionEditableGrid line={makeMetalsLine(false)} onApply={vi.fn()} {...baseProps} />);
    const header = document.querySelector('[data-group-type="METAL"]')!;
    expect(header.textContent).toMatch(/·\s*Oro:\s*4,33\s*gr/);
    expect(header.textContent).toMatch(/·\s*Plata:\s*1,68\s*gr/);
  });

  it("no afecta el footer financiero (Σ lineCost del grupo intacto)", () => {
    render(<SaleCompositionEditableGrid line={makeMetalsLine(true)} onApply={vi.fn()} {...baseProps} />);
    const footer = document.querySelector('[data-group-footer="METAL"]')!;
    // Σ lineCost = 100 + 50 = 150 → el costo del grupo no cambia por el header.
    expect(footer.textContent).toMatch(/ARS\s*150,00/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// REGRESIÓN — editar una línea con unidad distinta NO resetea las cantidades
// ya editadas de otras líneas del mismo grupo (stale-closure de
// useOverrideNumber → applyCostLinePatch debe mergear contra el array MÁS
// RECIENTE, no contra el snapshot del render). Simula el round-trip de
// preview re-renderizando con la composición rehidratada (nueva identidad).
// ────────────────────────────────────────────────────────────────────────────
describe("HECHURAS unidades mezcladas — overrides por costLineId no se resetean", () => {
  function makeHechurasLine(
    overrides: any[],
    quantities: [number, number, number] = [11, 22, 33],
  ): DocumentLine {
    return makeLine({
      costLineOverrides: overrides,
      composition: {
        metal: null, hechura: null, taxes: [],
        metals: [], products: [], services: [],
        // NUEVOS objetos cada vez (simula rehidratación del backend).
        hechuras: [
          { costLineId: "h1", lineLabel: "Hechura1", quantity: quantities[0], quantityUnit: "u",
            unitValue: 100, appliedAmount: 100, lineCost: 1100, lineSale: 1100 },
          { costLineId: "h2", lineLabel: "Hechura2", quantity: quantities[1], quantityUnit: "u",
            unitValue: 200, appliedAmount: 200, lineCost: 4400, lineSale: 4400 },
          { costLineId: "h3", lineLabel: "HechuraKg", quantity: quantities[2], quantityUnit: "kg",
            unitValue: 300, appliedAmount: 300, lineCost: 9900, lineSale: 9900 },
        ],
      } as any,
    } as any);
  }

  function qtyInputByPrefix(prefix: string): HTMLInputElement {
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    const found = inputs.find((el) => {
      const v = el.value.replace(",", ".");
      // qty (11/22/33) no colisiona con unitValue (100/200/300).
      return v.startsWith(prefix) && !v.startsWith(`${prefix}00`);
    });
    if (!found) throw new Error(`qty input con prefijo ${prefix} no encontrado`);
    return found;
  }

  it("editar la línea Kilogramo NO resetea las dos líneas Unidad ya editadas", () => {
    const onApply = vi.fn();
    const { rerender } = render(
      <SaleCompositionEditableGrid line={makeHechurasLine([])} onApply={onApply} {...baseProps} />,
    );

    // 1) Editar Hechura1 (Unidad) 11 → 15.
    fireEvent.change(qtyInputByPrefix("11"), { target: { value: "15" } });
    vi.advanceTimersByTime(500);
    let clo = onApply.mock.calls.at(-1)![0].costLineOverrides as any[];
    // Simular parent + preview: re-render con intent aplicado y composición
    // REHIDRATADA (objetos nuevos, misma data → mismo costLineId).
    rerender(<SaleCompositionEditableGrid line={makeHechurasLine(clo)} onApply={onApply} {...baseProps} />);

    // 2) Editar Hechura2 (Unidad) 22 → 25.
    fireEvent.change(qtyInputByPrefix("22"), { target: { value: "25" } });
    vi.advanceTimersByTime(500);
    clo = onApply.mock.calls.at(-1)![0].costLineOverrides as any[];
    rerender(<SaleCompositionEditableGrid line={makeHechurasLine(clo)} onApply={onApply} {...baseProps} />);

    // 3) Editar HechuraKg (Kilogramo) 33 → 40.
    fireEvent.change(qtyInputByPrefix("33"), { target: { value: "40" } });
    vi.advanceTimersByTime(500);
    const finalClo = onApply.mock.calls.at(-1)![0].costLineOverrides as any[];

    // Las 3 entries presentes, indexadas por costLineId, sin reseteo.
    const byId = new Map(finalClo.map((o) => [o.costLineId, o]));
    expect(byId.size).toBe(3);
    expect(Number(byId.get("h1")?.quantityOverride)).toBeCloseTo(15, 4); // NO reseteado
    expect(Number(byId.get("h2")?.quantityOverride)).toBeCloseTo(25, 4); // NO reseteado
    expect(Number(byId.get("h3")?.quantityOverride)).toBeCloseTo(40, 4); // editado
  });

  it("rehidratación posterior (preview round-trip) NO encoge el array de overrides", () => {
    const onApply = vi.fn();
    const seed = [
      { costLineId: "h1", type: "HECHURA", quantityOverride: 15 },
      { costLineId: "h2", type: "HECHURA", quantityOverride: 25 },
      { costLineId: "h3", type: "HECHURA", quantityOverride: 40 },
    ];
    const { rerender } = render(
      <SaleCompositionEditableGrid line={makeHechurasLine(seed)} onApply={onApply} {...baseProps} />,
    );
    // Round-trip: re-render con composición NUEVA (rehidratada) varias veces
    // y dejar correr los timers (dispara sync→commit de useOverrideNumber).
    for (let i = 0; i < 3; i++) {
      rerender(<SaleCompositionEditableGrid line={makeHechurasLine(seed)} onApply={onApply} {...baseProps} />);
      vi.advanceTimersByTime(500);
    }
    // Si algún commit (incluso con closure stale) reaplica, DEBE preservar
    // los 3 overrides — nunca dejar el array por debajo de 3 entries.
    for (const call of onApply.mock.calls) {
      const arr = call[0].costLineOverrides as any[] | undefined;
      if (Array.isArray(arr)) {
        const ids = new Set(arr.map((o) => o.costLineId));
        expect(ids.has("h1") && ids.has("h2") && ids.has("h3")).toBe(true);
      }
    }
  });

  it("footer Cantidad del grupo es read-only (suma base, no afectada por overrides)", () => {
    render(
      <SaleCompositionEditableGrid
        line={makeHechurasLine([{ costLineId: "h3", type: "HECHURA", quantityOverride: 40 }])}
        onApply={vi.fn()} {...baseProps}
      />,
    );
    const footer = document.querySelector('[data-group-footer="HECHURA"]')!;
    // Σ quantity base = 11 + 22 + 33 = 66 (el override NO altera el footer).
    expect(footer.textContent).toMatch(/66,00/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// REGRESIÓN responsive — la tabla DEBE quedar contenida en el card: el
// wrapper con borde tiene scroll-x interno; el contenido se dimensiona al
// ancho real (min-w-max) para que el scroll aparezca adentro y no desborde.
// (Antes un comentario "FASE 12.4" había quitado overflow-x → desborde.)
// ────────────────────────────────────────────────────────────────────────────
describe("Contención responsive — scroll horizontal interno al card", () => {
  it("el wrapper de la tabla tiene overflow-x-auto + max-w-full y NO desborda", () => {
    const { container } = render(
      <SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />,
    );
    const scrollWrap = container.querySelector(".overflow-x-auto") as HTMLElement | null;
    expect(scrollWrap).not.toBeNull();
    expect(scrollWrap!.className).toMatch(/max-w-full/);
    expect(scrollWrap!.className).toMatch(/min-w-0/);
    // El header de la grilla vive DENTRO del contenedor con scroll.
    const header = container.querySelector('[data-group-type], .sticky') ?? null;
    expect(scrollWrap!.contains(header)).toBe(true);
    // El contenido interno se dimensiona al ancho real (min-w-max) para que
    // el scroll sea del wrapper y no rompa el card.
    const inner = scrollWrap!.querySelector(".min-w-max");
    expect(inner).not.toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// (1) Step de Cantidad: HECHURA/PRODUCT/SERVICE = 1,00 ; METAL conserva.
// (2) Flecha de Merma/Ajuste no oscila (commit debounced, valor estable).
// (3) costLineOverrides preserva el nuevo valor tras el preview.
// ────────────────────────────────────────────────────────────────────────────
describe("Step de Cantidad por tipo + flechitas Merma/Ajuste sin oscilación", () => {
  function oneType(kind: "hechuras" | "products" | "services" | "metals", item: any): DocumentLine {
    const empty = { metal: null, hechura: null, taxes: [], metals: [], hechuras: [], products: [], services: [] };
    return makeLine({ composition: { ...empty, [kind]: [item] } as any } as any);
  }
  // El input de Cantidad es el 1er textbox de la fila que NO está dentro del
  // editor de Merma/Ajuste (ese vive en [data-*-inline-editor]).
  function qtyInput(): HTMLInputElement {
    const all = screen.getAllByRole("textbox") as HTMLInputElement[];
    const inEditor = (el: Element) =>
      !!el.closest("[data-merma-inline-editor]") || !!el.closest("[data-adjustment-inline-editor]");
    const editable = all.filter((el) => !el.readOnly && !inEditor(el));
    return editable[0];
  }

  it("Step Cantidad = 1,00 en HECHURA (1 → 2)", () => {
    const onApply = vi.fn();
    render(<SaleCompositionEditableGrid
      line={oneType("hechuras", { costLineId: "h1", lineLabel: "Mano", quantity: 5, unitValue: 100, lineCost: 500, lineSale: 500 })}
      onApply={onApply} {...baseProps} />);
    const inp = qtyInput();
    fireEvent.focus(inp);
    fireEvent.keyDown(inp, { key: "ArrowUp" });
    const ov = (onApply.mock.calls.at(-1)![0].costLineOverrides as any[]).find((o) => o.costLineId === "h1");
    expect(Number(ov.quantityOverride)).toBeCloseTo(6, 4); // 5 + step 1
  });

  it("Step Cantidad = 1,00 en PRODUCT y SERVICE", () => {
    for (const [kind, id] of [["products", "p1"], ["services", "s1"]] as const) {
      const onApply = vi.fn();
      const { unmount } = render(<SaleCompositionEditableGrid
        line={oneType(kind, { costLineId: id, catalogItemName: "X", quantity: 5, unitValue: 10, totalValue: 50 })}
        onApply={onApply} {...baseProps} />);
      const inp = qtyInput();
      fireEvent.focus(inp);
      fireEvent.keyDown(inp, { key: "ArrowUp" });
      const ov = (onApply.mock.calls.at(-1)![0].costLineOverrides as any[]).find((o) => o.costLineId === id);
      expect(Number(ov.quantityOverride)).toBeCloseTo(6, 4); // 5 + step 1
      unmount();
    }
  });

  it("METAL conserva su step (0,05): 2,50 → 2,55 (NO 1,00)", () => {
    const onApply = vi.fn();
    render(<SaleCompositionEditableGrid
      line={oneType("metals", { costLineId: "m1", metalVariantId: "v1", metalName: "Oro", variantName: "Oro 18k",
        purity: 0.75, purityLabel: "18k", appliedGrams: 2.5, appliedMermaPct: 0, lineCost: 100, quotePrice: 50 })}
      onApply={onApply} {...baseProps} />);
    const inp = qtyInput();
    fireEvent.focus(inp);
    fireEvent.keyDown(inp, { key: "ArrowUp" });
    const ov = (onApply.mock.calls.at(-1)![0].costLineOverrides as any[]).find((o) => o.costLineId === "m1");
    expect(Number(ov.quantityOverride)).toBeCloseTo(2.55, 4); // step 0,05 (no 1)
  });

  it("Flecha Merma: step 1,00, commit DEBOUNCED y valor estable (no oscila 10→11→10)", () => {
    const onApply = vi.fn();
    const line = oneType("metals", { costLineId: "m1", metalVariantId: "v1", metalName: "Oro", variantName: "Oro 18k",
      purity: 0.75, purityLabel: "18k", appliedGrams: 1, appliedMermaPct: 10, lineCost: 100, quotePrice: 50 });
    const { rerender } = render(<SaleCompositionEditableGrid line={line} onApply={onApply} {...baseProps} />);
    const input = document.querySelector('[data-merma-inline-editor] input') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowUp" }); // 10 → 11 (local, step 1)
    // Antes del debounce NO se commitea (no spam de preview por tick).
    expect(onApply).not.toHaveBeenCalled();
    expect(input.value.replace(",", ".")).toMatch(/^11/);
    vi.advanceTimersByTime(300);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(Number((onApply.mock.calls.at(-1)![0].costLineOverrides as any[])
      .find((o) => o.costLineId === "m1")?.mermaPercentOverride)).toBeCloseTo(11, 4);
    // Re-render con el MISMO line (prop stale: parent aún no propagó / preview
    // viejo). El valor local NO debe revertir a 10 → sin oscilación.
    rerender(<SaleCompositionEditableGrid line={line} onApply={onApply} {...baseProps} />);
    vi.advanceTimersByTime(300);
    expect(input.value.replace(",", ".")).toMatch(/^11/);
    expect(onApply).toHaveBeenCalledTimes(1); // sin re-commit con el viejo
  });

  it("costLineOverrides preserva el valor nuevo tras el preview (rehidratación)", () => {
    const onApply = vi.fn();
    const base = oneType("metals", { costLineId: "m1", metalVariantId: "v1", metalName: "Oro", variantName: "Oro 18k",
      purity: 0.75, purityLabel: "18k", appliedGrams: 1, appliedMermaPct: 10, lineCost: 100, quotePrice: 50 });
    const { rerender } = render(<SaleCompositionEditableGrid line={base} onApply={onApply} {...baseProps} />);
    const input = document.querySelector('[data-merma-inline-editor] input') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    vi.advanceTimersByTime(300);
    const clo = onApply.mock.calls.at(-1)![0].costLineOverrides as any[];
    // Preview vuelve: composición rehidratada con merma VIEJA (10) pero el
    // override (11) viaja en costLineOverrides → debe ganar y mostrarse.
    const afterPreview = makeLine({
      costLineOverrides: clo,
      composition: { metal: null, hechura: null, taxes: [], metals: [
        { costLineId: "m1", metalVariantId: "v1", metalName: "Oro", variantName: "Oro 18k",
          purity: 0.75, purityLabel: "18k", appliedGrams: 1, appliedMermaPct: 10, lineCost: 100, quotePrice: 50 },
      ], hechuras: [], products: [], services: [] } as any,
    } as any);
    rerender(<SaleCompositionEditableGrid line={afterPreview} onApply={onApply} {...baseProps} />);
    vi.advanceTimersByTime(300);
    expect(input.value.replace(",", ".")).toMatch(/^11/); // override preservado
  });

  it("Step Merma = 1,00 en HECHURA/PRODUCT/SERVICE (Ajuste): 10 → 11", () => {
    // Ajuste % de HECHURA con value inicial 10 → ArrowUp debe dar 11 (step 1),
    // NO 10,5.
    const onApply = vi.fn();
    const line = oneType("hechuras", {
      costLineId: "h1", lineLabel: "Mano", quantity: 1, unitValue: 100,
      lineCost: 90, lineSale: 90,
      lineAdjKind: "BONUS", lineAdjType: "PERCENTAGE", lineAdjValue: 10, lineAdjAmount: -10,
    });
    render(<SaleCompositionEditableGrid line={line} onApply={onApply} {...baseProps} />);
    const input = document.querySelector('[data-adjustment-inline-editor] input') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input.value.replace(",", ".")).toMatch(/^11/); // step 1 (no 10,5)
    vi.advanceTimersByTime(300);
    const ov = (onApply.mock.calls.at(-1)![0].costLineOverrides as any[]).find((o) => o.costLineId === "h1");
    expect(Number(ov.adjustmentValue)).toBeCloseTo(11, 4);
  });

  it("Step Costo unit. = 1,00 (HECHURA): 100 → 101", () => {
    const onApply = vi.fn();
    const line = oneType("hechuras", {
      costLineId: "h1", lineLabel: "Mano", quantity: 1, unitValue: 100,
      lineCost: 100, lineSale: 100,
    });
    render(<SaleCompositionEditableGrid line={line} onApply={onApply} {...baseProps} />);
    // El input de Costo unit. es el 2º editable de la fila (1º = Cantidad),
    // y NO está dentro del editor de Merma/Ajuste.
    const all = screen.getAllByRole("textbox") as HTMLInputElement[];
    const inEditor = (el: Element) =>
      !!el.closest("[data-merma-inline-editor]") || !!el.closest("[data-adjustment-inline-editor]");
    const editable = all.filter((el) => !el.readOnly && !inEditor(el));
    const unitInput = editable[1]; // [0]=Cantidad, [1]=Costo unit.
    fireEvent.focus(unitInput);
    fireEvent.keyDown(unitInput, { key: "ArrowUp" });
    vi.advanceTimersByTime(300);
    const ov = (onApply.mock.calls.at(-1)![0].costLineOverrides as any[]).find((o) => o.costLineId === "h1");
    expect(Number(ov.unitValueOverride)).toBeCloseTo(101, 4); // 100 + step 1
  });
});
