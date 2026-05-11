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
    expect(screen.getByText(/Ley: 0,750/)).toBeInTheDocument();
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
    expect(screen.getByText(/Ley: 925/)).toBeInTheDocument();
  });

  it("METAL: input de merma editable; PRODUCT: sin input de merma", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // El sufijo "g" está SOLO en la fila METAL (gramos). Lo usamos como
    // ancla para localizar la fila METAL.
    expect(screen.getAllByText("g").length).toBeGreaterThan(0);
    // Merma — el sufijo "%" aparece SOLO cuando hay un input de merma con
    // suffix '%' en la fila METAL.
    expect(screen.getAllByText("%").length).toBeGreaterThan(0);
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

  it("activar Ajuste en HECHURA emite patch con BONUS + PERCENTAGE + 0", () => {
    const onApply = vi.fn();
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={onApply} {...baseProps} />);

    // Fase 2.2 — botón inactivo ahora dice "+ Bonif./Recargo".
    // Hay uno por cada fila NO-METAL (HECHURA/PRODUCT/SERVICE).
    const ajusteButtons = screen.getAllByText("+ Bonif./Recargo");
    expect(ajusteButtons.length).toBeGreaterThanOrEqual(3);

    // Click en el primero (HECHURA).
    fireEvent.click(ajusteButtons[0]);

    expect(onApply).toHaveBeenCalledTimes(1);
    const patch = onApply.mock.calls[0][0];
    expect(patch.costLineOverrides).toBeInstanceOf(Array);
    const ov = (patch.costLineOverrides as any[]).find(
      (o: any) => o.costLineId === "cl-hechura-1",
    );
    expect(ov).toBeDefined();
    expect(ov.adjustmentKind).toBe("BONUS");
    expect(ov.adjustmentType).toBe("PERCENTAGE");
    expect(ov.adjustmentValue).toBe(0);
  });

  it("Fase 2.2 — ajuste activo muestra palabra 'Bonif' o 'Recargo' (no símbolo)", () => {
    const lineBonus = makeLine({
      costLineOverrides: [{
        costLineId: "cl-hechura-1", type: "HECHURA",
        adjustmentKind: "BONUS", adjustmentType: "PERCENTAGE", adjustmentValue: 5,
      }],
    });
    const { rerender } = render(
      <SaleCompositionEditableGrid line={lineBonus} onApply={vi.fn()} {...baseProps} />,
    );
    expect(screen.getByText("Bonif")).toBeInTheDocument();

    const lineSurcharge = makeLine({
      costLineOverrides: [{
        costLineId: "cl-product-1", type: "PRODUCT",
        adjustmentKind: "SURCHARGE", adjustmentType: "FIXED_AMOUNT", adjustmentValue: 10,
      }],
    });
    rerender(<SaleCompositionEditableGrid line={lineSurcharge} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText("Recargo")).toBeInTheDocument();
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

describe("Fase 2.2/2.4 — unidad legible inline en secondary", () => {
  it("METAL: 'gramos' en secondary; HECHURA/PRODUCT/SERVICE: 'unidad' en secondary", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // Fase 2.4 — la unidad ya NO está en columna separada UNID, sino
    // inline en el secondary del componente.
    expect(screen.getByText("gramos")).toBeInTheDocument();
    const unidades = screen.getAllByText("unidad");
    expect(unidades.length).toBe(3);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 7. Fase 2.2 — Columna AJUSTE muestra ajuste original del cost line
// ────────────────────────────────────────────────────────────────────────────

describe("Fase 2.2 — ajuste original del cost line en columna AJUSTE", () => {
  function makeLineWithAdjustments(): DocumentLine {
    const line = makeLine();
    const meta: any = line.pricingMeta;
    // PRODUCT con bonificación 14% → −ARS 17,27 (mock del motor).
    meta.composition.products[0] = {
      ...meta.composition.products[0],
      lineAdjKind:   "BONUS",
      lineAdjType:   "PERCENTAGE",
      lineAdjValue:  14,
      lineAdjAmount: 17.27,
    };
    // SERVICE con recargo $20 fijo.
    meta.composition.services[0] = {
      ...meta.composition.services[0],
      lineAdjKind:   "SURCHARGE",
      lineAdjType:   "FIXED_AMOUNT",
      lineAdjValue:  20,
      lineAdjAmount: 20,
    };
    // HECHURA con bonificación 10% (Fase 2.2 — antes el extractor descartaba
    // estos campos; ahora deben llegar y mostrarse).
    meta.composition.hechuras[0] = {
      ...meta.composition.hechuras[0],
      lineAdjKind:   "BONUS",
      lineAdjType:   "PERCENTAGE",
      lineAdjValue:  10,
      lineAdjAmount: 20,
    };
    return line;
  }

  it("PRODUCT con lineAdj* poblado muestra 'Bonif.' + valor + monto", () => {
    render(
      <SaleCompositionEditableGrid
        line={makeLineWithAdjustments()} onApply={vi.fn()} {...baseProps}
      />,
    );
    // El chip clickeable del original muestra "Bonif." y el porcentaje
    // (14%) y el monto firmado.
    expect(screen.getAllByText("Bonif.").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("14%")).toBeInTheDocument();
    // Monto absoluto formateado (es-AR usa coma decimal).
    expect(screen.getByText(/−ARS\s*17,27/)).toBeInTheDocument();
  });

  it("SERVICE con SURCHARGE + FIXED_AMOUNT muestra 'Recargo' + monto absoluto + signo +", () => {
    render(
      <SaleCompositionEditableGrid
        line={makeLineWithAdjustments()} onApply={vi.fn()} {...baseProps}
      />,
    );
    expect(screen.getByText("Recargo")).toBeInTheDocument();
    // Para FIXED_AMOUNT el "valuePart" es el monto formateado del valor
    // configurado; ARS 20,00.
    // El "amountPart" es +ARS 20,00 (impacto absoluto signed).
    expect(screen.getByText(/\+ARS\s*20,00/)).toBeInTheDocument();
  });

  it("HECHURA propaga lineAdj* desde backend (Fase 2.2 backend fix)", () => {
    render(
      <SaleCompositionEditableGrid
        line={makeLineWithAdjustments()} onApply={vi.fn()} {...baseProps}
      />,
    );
    // El monto firmado de HECHURA bonificación (−ARS 20,00) debe estar.
    // Hay otros "−ARS" potencialmente; usamos el contexto del valor 10%.
    expect(screen.getByText("10%")).toBeInTheDocument();
  });

  it("click en chip del ajuste original activa el editor con esos valores precargados", () => {
    const onApply = vi.fn();
    render(
      <SaleCompositionEditableGrid
        line={makeLineWithAdjustments()} onApply={onApply} {...baseProps}
      />,
    );
    // Hay 3 chips clickeables (HECHURA 10%, PRODUCT 14%, SERVICE recargo).
    // Buscamos el chip cuyo texto contiene "14%" (= PRODUCT).
    const chips = screen.getAllByTitle(/Click para editarlo/);
    const productChip = chips.find((c) => c.textContent?.includes("14%"));
    expect(productChip).toBeDefined();
    fireEvent.click(productChip!);

    expect(onApply).toHaveBeenCalledTimes(1);
    const patch = onApply.mock.calls[0][0];
    const ov = (patch.costLineOverrides as any[]).find(
      (o: any) => o.costLineId === "cl-product-1",
    );
    expect(ov).toBeDefined();
    // El override pre-carga los valores del original (Bonif 14%).
    expect(ov.adjustmentKind).toBe("BONUS");
    expect(ov.adjustmentType).toBe("PERCENTAGE");
    expect(ov.adjustmentValue).toBe(14);
  });

  it("override que difiere del original muestra el original tachado debajo", () => {
    const line = makeLineWithAdjustments();
    // Override en PRODUCT con valores DISTINTOS al original (BONUS 14%).
    (line.pricingMeta as any).costLineOverrides = [
      {
        costLineId: "cl-product-1", type: "PRODUCT",
        adjustmentKind: "SURCHARGE", adjustmentType: "PERCENTAGE", adjustmentValue: 5,
      },
    ];
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);

    // Editor activo muestra "Recargo" (el override).
    expect(screen.getAllByText("Recargo").length).toBeGreaterThanOrEqual(1);
    // Y debajo aparece el original tachado: "Bonif. 14% · −ARS 17,27".
    const tachado = screen.getByTitle("Ajuste original del artículo");
    expect(tachado).toBeInTheDocument();
    expect(tachado.className).toContain("line-through");
    expect(tachado.textContent).toMatch(/Bonif/);
    expect(tachado.textContent).toMatch(/14%/);
  });

  it("override que coincide con el original NO muestra tachado (no es un cambio real)", () => {
    const line = makeLineWithAdjustments();
    // Override IDÉNTICO al original.
    (line.pricingMeta as any).costLineOverrides = [
      {
        costLineId: "cl-product-1", type: "PRODUCT",
        adjustmentKind: "BONUS", adjustmentType: "PERCENTAGE", adjustmentValue: 14,
      },
    ];
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.queryByTitle("Ajuste original del artículo")).toBeNull();
  });

  it("PRODUCT sin lineAdj* y sin override → botón '+ Bonif./Recargo'", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // Hay 3 botones (HECHURA + PRODUCT + SERVICE), uno por fila no-METAL
    // sin original ni override.
    expect(screen.getAllByText("+ Bonif./Recargo").length).toBe(3);
  });
});

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

  it("PRODUCT V. VENTA = totalValue / quantity (per-unit post-ajuste)", () => {
    const line = makeLine();
    // Override: cantidad=2 con BONUS 10% → totalValue=900 (motor mock).
    // Verificamos que V. VENTA muestre 450 (per-unit) no 900 (total).
    (line.pricingMeta as any).composition.products[0] = {
      ...((line.pricingMeta as any).composition.products[0]),
      quantity:   2,
      unitValue:  500,
      totalValue: 900,           // post-ajuste BONUS 10%: 1000 − 100 = 900
    };
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // V. VENTA = 900 / 2 = 450
    expect(screen.getByText(/ARS\s*450,00/)).toBeInTheDocument();
    // TOTAL = 900 × line.quantity (1) = 900
    expect(screen.getByText(/ARS\s*900,00/)).toBeInTheDocument();
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

  it("AJUSTE HECHURA muestra 'Bonif.' + 10% + −ARS 100,00", () => {
    render(
      <SaleCompositionEditableGrid
        line={makeLineWithHechuraBonus()} onApply={vi.fn()} {...baseProps}
      />,
    );
    expect(screen.getAllByText("Bonif.").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("10%")).toBeInTheDocument();
    expect(screen.getByText(/−ARS\s*100,00/)).toBeInTheDocument();
  });

  it("V. VENTA HECHURA = 900 (post-bonif), TOTAL = 900 × line.quantity", () => {
    render(
      <SaleCompositionEditableGrid
        line={makeLineWithHechuraBonus()} onApply={vi.fn()} {...baseProps}
      />,
    );
    // V. VENTA = lineCost / qty = 900 / 1 = 900 → "ARS 900,00".
    // TOTAL = 900 × line.quantity (1) = 900 → mismo texto.
    // Aparece al menos en V. VENTA y TOTAL (2 ocurrencias mínimo).
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

  it("Columnas restantes presentes: Componente / Cantidad / Costo unit. / Merma / Ajuste / Costo línea / Total (Fase 2.7.a labels)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText("Componente")).toBeInTheDocument();
    expect(screen.getByText("Cantidad")).toBeInTheDocument();
    expect(screen.getByText("Costo unit.")).toBeInTheDocument();
    expect(screen.getByText("Merma")).toBeInTheDocument();
    expect(screen.getByText("Ajuste")).toBeInTheDocument();
    expect(screen.getByText("Costo línea")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
    // Labels viejos NO deben existir.
    expect(screen.queryByText("Val. unit.")).toBeNull();
    expect(screen.queryByText("V. venta")).toBeNull();
  });

  it("METAL secondary contiene 'Ley:' + 'gramos' inline", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText(/Ley: 0,750/)).toBeInTheDocument();
    expect(screen.getByText("gramos")).toBeInTheDocument();
  });

  it("Fase 2.4 — HECHURA secondary NO contiene 'Moneda' (eliminada)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // 'Moneda: ARS' fue removido en Fase 2.4 — la moneda ya se entiende
    // por los importes formateados.
    expect(screen.queryByText(/Moneda:/)).toBeNull();
    // 'unidad' sigue apareciendo 3 veces (HECHURA/PRODUCT/SERVICE).
    expect(screen.getAllByText("unidad").length).toBe(3);
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

  it("Cambiar currency con rerender refresca todos los displays — costAdjustment también", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.costAdjustment = {
      kind: "BONUS", type: "PERCENTAGE", value: 25, amount: 500,
    };
    const props = { line, onApply: vi.fn(), onClear: vi.fn(), onClose: vi.fn() };
    const { rerender } = render(<SaleCompositionEditableGrid {...props} currency="ARS" />);
    expect(screen.getByText(/−ARS\s*500,00/)).toBeInTheDocument();
    rerender(<SaleCompositionEditableGrid {...props} currency="USD" />);
    expect(screen.getByText(/−USD\s*500,00/)).toBeInTheDocument();
  });

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

describe("Fase 2.1 — original tachado vs override resaltado", () => {
  it("PRODUCT con unitValueOverride distinto al original muestra el original tachado", () => {
    const line = makeLine({
      costLineOverrides: [
        { costLineId: "cl-product-1", type: "PRODUCT", unitValueOverride: 999 },
      ],
    });
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // El original (150) se renderea con line-through cuando difiere del override (999).
    const orig = screen.getByText("150", { selector: "span.line-through" });
    expect(orig).toBeInTheDocument();
    expect(orig.title).toBe("Valor original del artículo");
  });

  it("METAL con quantityOverride distinto al original muestra los gramos originales tachados", () => {
    const line = makeLine({
      costLineOverrides: [
        { costLineId: "cl-metal-1", type: "METAL", quantityOverride: 5 },
      ],
    });
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // Original = 2.5 → formato es-AR con 3 decimales → "2,5".
    const orig = screen.getByText("2,5", { selector: "span.line-through" });
    expect(orig).toBeInTheDocument();
  });

  it("Sin override → no se muestra ningún 'original tachado'", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(document.querySelectorAll("span.line-through").length).toBe(0);
  });
});

describe("Fase 2.1 — bloque Rentabilidad (migrado a Fase 6 PriceFlowCards)", () => {
  it("muestra Costo total / Ganancia neta / Margen con los valores de pricingMeta", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // Fase 6 — labels del nuevo card "Resumen de rentabilidad".
    expect(screen.getAllByText(/Costo total/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Ganancia neta/i)).toBeInTheDocument();
    expect(screen.getByText(/Margen sobre venta/i)).toBeInTheDocument();
    // Margen 60% formateado.
    expect(screen.getByText(/60%/)).toBeInTheDocument();
  });

  it("muestra el label 'Margen sobre venta' aunque los valores sean null", () => {
    const line = makeLine({
      unitCost: null, unitMargin: null, marginPercent: null,
    } as any);
    line.subtotal = 0;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText(/Margen sobre venta/i)).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 12. Fase 2.5 — Ajuste global de costo (Article.manualAdjustment*)
// ────────────────────────────────────────────────────────────────────────────

describe("Fase 2.5 — Ajuste global de costo (migrado a Fase 6 PriceFlowCards)", () => {
  it("BONUS PERCENTAGE → 'Bonificación 25% · −ARS 773.732,36'", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.costAdjustment = {
      kind:   "BONUS",
      type:   "PERCENTAGE",
      value:  25,
      amount: 773732.36,
    };
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // Fase 6 — nuevo label del card.
    expect(screen.getByText(/Ajustes globales aplicados/i)).toBeInTheDocument();
    expect(screen.getByText(/Bonificación/)).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText(/−ARS\s*773\.732,36/)).toBeInTheDocument();
  });

  it("SURCHARGE PERCENTAGE → 'Recargo 15% · +ARS 120.000,00'", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.costAdjustment = {
      kind:   "SURCHARGE",
      type:   "PERCENTAGE",
      value:  15,
      amount: -120000,    // negativo → tono amber + signo +
    };
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // "Recargo" aparece en (1) los 3 botones "+ Bonif./Recargo" del editor
    // por fila, y (2) el chip del CostAdjustmentBlock. Verificamos presencia.
    expect(screen.getAllByText(/Recargo/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("15%")).toBeInTheDocument();
    expect(screen.getByText(/\+ARS\s*120\.000,00/)).toBeInTheDocument();
  });

  it("BONUS FIXED_AMOUNT → 'Bonificación ARS 5.000,00 · −ARS 5.000,00'", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.costAdjustment = {
      kind:   "BONUS",
      type:   "FIXED_AMOUNT",
      value:  5000,
      amount: 5000,
    };
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText(/Bonificación/)).toBeInTheDocument();
    // valuePart = formatted money
    const valueParts = screen.getAllByText(/ARS\s*5\.000,00/);
    expect(valueParts.length).toBeGreaterThanOrEqual(2);  // value + amount
  });

  it("Sin costAdjustment → estado vacío del card (no muestra bonif/recargo)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // Fase 6 — el card sigue presente pero con leyenda "Sin ajustes globales".
    expect(screen.getByText(/Sin ajustes globales configurados/i)).toBeInTheDocument();
  });

  it("costAdjustment con kind=null → estado vacío del card", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.costAdjustment = {
      kind: null, type: null, value: null, amount: null,
    };
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText(/Sin ajustes globales configurados/i)).toBeInTheDocument();
  });

  it("Snapshot viejo sin costAdjustment (undefined) → estado vacío del card", () => {
    const line = makeLine();
    delete (line.pricingMeta as any).composition.costAdjustment;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText(/Sin ajustes globales configurados/i)).toBeInTheDocument();
  });

  it("amount=0 → no se muestra como bonificación (estado vacío)", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.costAdjustment = {
      kind: "BONUS", type: "PERCENTAGE", value: 0, amount: 0,
    };
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // Fase 6 — amount=0 dispara la rama "Sin ajustes" (hasAdjustment requiere amount != 0).
    expect(screen.queryByText(/−ARS\s*0,00/)).toBeNull();
  });
});

describe("Fase 2.6.1 — KPI Valor de venta = basePrice × qty (pre-descuentos)", () => {
  it("Renderiza el label 'Valor de venta neto' en el bloque Rentabilidad", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // Fase 2.6.3 — label cambió a "Valor de venta neto".
    expect(screen.getByText("Valor de venta neto")).toBeInTheDocument();
  });

  it("Con promo activa: ignora subtotal post-descuento y usa basePrice × qty", () => {
    // Caso real del usuario: basePrice 3.187.469,38 / unitPrice (post-promo)
    // con descuentos, subtotal post-descuento ~2.549.975,50.
    // Valor de venta DEBE mostrar el basePrice × qty.
    const line = makeLine();
    line.quantity = 1;
    line.unitPrice = 2549975.50;          // post-promo
    line.subtotal  = 2549975.50;          // post-descuento (no se debe usar)
    (line.pricingMeta as any).basePrice = 3187469.38; // pre-descuento (este sí)
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // Aparece el basePrice formateado como Valor de venta. Fase 2.6.2 lo
    // muestra TANTO en el header como en el KPI inferior → 2+ ocurrencias.
    expect(screen.getAllByText(/ARS\s*3\.187\.469,38/).length).toBeGreaterThanOrEqual(2);
    // NO aparece el subtotal post-descuento como Valor de venta.
    expect(screen.queryByText(/ARS\s*2\.549\.975,50/)).toBeNull();
  });

  it("Coincide con line.unitPrice cuando quantity=1 y NO hay basePrice", () => {
    const line = makeLine();
    line.quantity = 1;
    line.unitPrice = 1234.56;
    delete (line.pricingMeta as any).basePrice;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // Sin basePrice, fallback a unitPrice × qty (header + KPI).
    expect(screen.getAllByText(/ARS\s*1\.234,56/).length).toBeGreaterThanOrEqual(2);
  });

  it("Coincide con basePrice × quantity cuando quantity > 1 (total venta)", () => {
    const line = makeLine();
    line.quantity = 3;
    (line.pricingMeta as any).basePrice = 500;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // 500 × 3 = 1500 → "ARS 1.500,00" (header + KPI = 2+).
    expect(screen.getAllByText(/ARS\s*1\.500,00/).length).toBeGreaterThanOrEqual(2);
  });

  it("NO usa line.subtotal: subtotal alterado no afecta Valor de venta", () => {
    const line = makeLine();
    line.quantity = 1;
    line.subtotal = 999999;               // valor ruido
    line.unitPrice = 100;
    (line.pricingMeta as any).basePrice = 250;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // Valor de venta debe ser basePrice (250), NO subtotal (999999).
    expect(screen.getAllByText(/ARS\s*250,00/).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/ARS\s*999\.999,00/)).toBeNull();
  });

  it("Cambia con currency: ARS → USD", () => {
    const line = makeLine();
    line.quantity = 1;
    (line.pricingMeta as any).basePrice = 1000;
    const props = { line, onApply: vi.fn(), onClear: vi.fn(), onClose: vi.fn() };
    const { rerender } = render(<SaleCompositionEditableGrid {...props} currency="ARS" />);
    expect(screen.getAllByText(/ARS\s*1\.000,00/).length).toBeGreaterThanOrEqual(2);
    rerender(<SaleCompositionEditableGrid {...props} currency="USD" />);
    expect(screen.getAllByText(/USD\s*1\.000,00/).length).toBeGreaterThanOrEqual(2);
  });

  it("Cambia cuando basePrice cambia (override recalcula)", () => {
    const lineA = makeLine();
    lineA.quantity = 1;
    (lineA.pricingMeta as any).basePrice = 1500;
    const props = { line: lineA, onApply: vi.fn(), onClear: vi.fn(), onClose: vi.fn() };
    const { rerender } = render(<SaleCompositionEditableGrid {...props} currency="ARS" />);
    expect(screen.getAllByText(/ARS\s*1\.500,00/).length).toBeGreaterThanOrEqual(2);

    const lineB = makeLine();
    lineB.quantity = 1;
    (lineB.pricingMeta as any).basePrice = 850;
    rerender(<SaleCompositionEditableGrid {...{ ...props, line: lineB }} currency="ARS" />);
    expect(screen.getAllByText(/ARS\s*850,00/).length).toBeGreaterThanOrEqual(2);
  });

  it("Sin basePrice ni unitPrice → muestra '—' sin romper", () => {
    const line = makeLine();
    (line as any).unitPrice = null;
    delete (line.pricingMeta as any).basePrice;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // Fase 2.6.3 — label "Valor de venta neto".
    expect(screen.getByText("Valor de venta neto")).toBeInTheDocument();
  });

  it("NO incluye impuestos: lineTotalWithTax con tax NO afecta el KPI", () => {
    const line = makeLine();
    line.quantity = 1;
    line.unitPrice = 100;
    line.lineTotalWithTax = 121;          // con IVA 21%
    (line.pricingMeta as any).basePrice = 100;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // Valor de venta = 100 (sin IVA), aparece en header + KPI.
    expect(screen.getAllByText(/ARS\s*100,00/).length).toBeGreaterThanOrEqual(2);
    // NO aparece "ARS 121,00" como Valor de venta.
    expect(screen.queryByText(/ARS\s*121,00/)).toBeNull();
  });

  it("Layout: el bloque tiene 4 KPIs en grid-cols-4", () => {
    render(
      <SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />,
    );
    // Fase 6 — labels migrados a los 4 cards del flujo visual.
    expect(screen.getAllByText(/Costo total/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Ganancia neta/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Valor de venta neto/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Margen sobre venta/i)).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 14. Fase 2.6.2 — Header label + Valor de venta inline en header
// ────────────────────────────────────────────────────────────────────────────

describe("Fase 2.6.2 — Header de Composición", () => {
  it("Header NO muestra 'Total:' genérico (era ambiguo)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // El label "· Total:" original fue reemplazado.
    expect(screen.queryByText(/^· Total:/)).toBeNull();
    // No queda ningún span con texto "Total:" (que no sea "Total línea" del header de tabla).
    expect(screen.queryByText(/^Total:$/)).toBeNull();
  });

  it("Header muestra 'Componentes:' con el monto agregado", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // "· Componentes:" + monto formateado.
    expect(screen.getByText(/Componentes:/)).toBeInTheDocument();
  });

  it("Header muestra 'Valor de venta:' inline cuando hay basePrice/unitPrice", () => {
    const line = makeLine();
    line.quantity = 1;
    (line.pricingMeta as any).basePrice = 3187469.38;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // "Valor de venta:" aparece como label en header (separado del KPI inferior).
    // El label "Valor de venta" total cuenta 2 ocurrencias (header + KPI).
    const labels = screen.getAllByText(/Valor de venta/);
    expect(labels.length).toBeGreaterThanOrEqual(2);
    // El monto "ARS 3.187.469,38" aparece en ambos sitios.
    expect(screen.getAllByText(/ARS\s*3\.187\.469,38/).length).toBeGreaterThanOrEqual(2);
  });

  it("Valor de venta header coincide con line.unitPrice cuando quantity=1 y NO hay basePrice", () => {
    const line = makeLine();
    line.quantity = 1;
    line.unitPrice = 7777.77;
    delete (line.pricingMeta as any).basePrice;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // Fallback a unitPrice — header + KPI muestran 7.777,77.
    expect(screen.getAllByText(/ARS\s*7\.777,77/).length).toBeGreaterThanOrEqual(2);
  });

  it("Header NO muestra 'Valor de venta' cuando basePrice y unitPrice son null", () => {
    const line = makeLine();
    delete (line.pricingMeta as any).basePrice;
    (line as any).unitPrice = null;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // El header solo muestra "Componentes:" (no "Valor de venta:").
    // El KPI inferior siempre se renderiza con label, pero header se condicional.
    // Verificamos que el label en header esté ausente: hay 1 ocurrencia
    // (la del KPI), no 2.
    const labels = screen.queryAllByText(/Valor de venta/);
    expect(labels.length).toBeLessThanOrEqual(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 15. Fase 2.6.3 — Label "Valor de venta neto" + reorden de KPIs
// ────────────────────────────────────────────────────────────────────────────

describe("Fase 2.6.3 — label 'Valor de venta neto' + orden KPIs", () => {
  it("Header usa el label 'Valor de venta neto' (no 'Valor de venta' suelto)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // Header tiene "· Valor de venta neto:".
    expect(screen.getByText(/Valor de venta neto:/)).toBeInTheDocument();
  });

  it("KPI inferior usa el label 'Valor de venta neto'", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText("Valor de venta neto")).toBeInTheDocument();
  });

  it("No queda ningún 'Valor de venta' suelto sin sufijo 'neto'", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    // Buscamos texto exacto "Valor de venta" (sin sufijo). No debe existir.
    const exactSinNeto = screen.queryByText("Valor de venta");
    expect(exactSinNeto).toBeNull();
    // Y el header tampoco usa "Valor de venta:" sin "neto".
    const exactConDosPuntos = screen.queryByText(/Valor de venta:/);
    expect(exactConDosPuntos).toBeNull();
  });

  it("Fase 6 — el flujo presenta los 4 cards en orden: Costo · Ajustes · Impacto · Rentabilidad", () => {
    render(
      <SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />,
    );
    // Los 4 títulos del flujo deben aparecer.
    expect(screen.getByText(/Costo base del artículo/i)).toBeInTheDocument();
    expect(screen.getByText(/Ajustes globales aplicados/i)).toBeInTheDocument();
    expect(screen.getByText(/Impacto en el precio de venta/i)).toBeInTheDocument();
    expect(screen.getByText(/Resumen de rentabilidad/i)).toBeInTheDocument();
  });

  it("Valor numérico no cambia: sigue siendo basePrice × qty (pre-IVA)", () => {
    const line = makeLine();
    line.quantity = 1;
    (line.pricingMeta as any).basePrice = 1234.56;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // basePrice × 1 → "ARS 1.234,56" en header y en KPI = 2 ocurrencias.
    expect(screen.getAllByText(/ARS\s*1\.234,56/).length).toBeGreaterThanOrEqual(2);
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

  it("Header de columnas usa 'Costo línea' (no 'V. venta')", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText("Costo línea")).toBeInTheDocument();
    expect(screen.queryByText("V. venta")).toBeNull();
  });

  it("Tooltips informativos: 'Costo base del componente' / 'Costo final del componente'", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const costoUnit  = screen.getByText("Costo unit.");
    const costoLinea = screen.getByText("Costo línea");
    expect(costoUnit.getAttribute("title")).toBe("Costo base del componente");
    expect(costoLinea.getAttribute("title")).toBe("Costo final del componente");
  });

  it("Header inline conserva 'Componentes:' y 'Valor de venta neto:' sin cambios", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText(/Componentes:/)).toBeInTheDocument();
    expect(screen.getByText(/Valor de venta neto:/)).toBeInTheDocument();
  });

  it("Cantidad / Merma / Ajuste / Total se mantienen sin cambios", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText("Cantidad")).toBeInTheDocument();
    expect(screen.getByText("Merma")).toBeInTheDocument();
    expect(screen.getByText("Ajuste")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 17. Fase 2.7.b — Bloque "Impacto en precio de venta"
// ────────────────────────────────────────────────────────────────────────────

describe("Fase 2.7.b — Impacto en precio de venta (agregado por tipo)", () => {
  function setMetalAndHechura(line: DocumentLine) {
    const meta: any = line.pricingMeta;
    meta.metalCost        = 500;
    meta.metalSale        = 1500;
    meta.metalMarginPct   = 200;
    meta.hechuraCost      = 200;
    meta.hechuraSale      = 1387;
    meta.hechuraMarginPct = 593;
  }

  it("Renderiza el card 'Impacto en el precio de venta' cuando hay datos", () => {
    const line = makeLine();
    setMetalAndHechura(line);
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // Fase 6 — el nuevo card del flujo.
    expect(screen.getByText(/Impacto en el precio de venta/i)).toBeInTheDocument();
    // El card 1 (Costo base) muestra Metal y Hechura.
    expect(screen.getByText(/^Metal$/i)).toBeInTheDocument();
    expect(screen.getByText(/Hechura y otros/i)).toBeInTheDocument();
  });

  it("Muestra Costo base / Sale neto con los valores correctos", () => {
    const line = makeLine();
    setMetalAndHechura(line);
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // Costo metal=500, hechura=200 → totalCost=700.
    expect(screen.getAllByText(/ARS\s*500,00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/ARS\s*200,00/).length).toBeGreaterThanOrEqual(1);
  });

  it("Muestra el margen aplicado cuando difiere entre metal y hechura", () => {
    const line = makeLine();
    setMetalAndHechura(line);
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // Metal 200% y hechura 593% → distintos → muestra ambos labels.
    expect(screen.getByText(/Margen metal/i)).toBeInTheDocument();
    expect(screen.getByText(/Margen hechura/i)).toBeInTheDocument();
  });

  it("Oculta el flujo completo cuando todos los amounts son null/0", () => {
    const line = makeLine();
    delete (line.pricingMeta as any).metalCost;
    delete (line.pricingMeta as any).metalSale;
    delete (line.pricingMeta as any).hechuraCost;
    delete (line.pricingMeta as any).hechuraSale;
    delete (line.pricingMeta as any).unitCost;
    delete (line.pricingMeta as any).unitMargin;
    delete (line.pricingMeta as any).basePrice;
    line.unitPrice = 0;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // El componente entero devuelve null si no hay datos.
    expect(screen.queryByText(/Flujo de construcción del precio/i)).toBeNull();
  });

  it("Renderiza el card 1 con solo Metal cuando no hay datos de Hechura", () => {
    const line = makeLine();
    const meta: any = line.pricingMeta;
    meta.metalCost = 500;
    meta.metalSale = 1500;
    meta.metalMarginPct = 200;
    meta.hechuraCost = 0;
    meta.hechuraSale = 0;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText(/^Metal$/i)).toBeInTheDocument();
    expect(screen.queryByText(/Hechura y otros/i)).toBeNull();
  });

  it("Tono semántico del margen: 200% emerald, 10% amber", () => {
    const line = makeLine();
    const meta: any = line.pricingMeta;
    meta.metalCost = 100;
    meta.metalSale = 110;
    meta.metalMarginPct = 10;
    meta.hechuraCost = 100;
    meta.hechuraSale = 600;
    meta.hechuraMarginPct = 500;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // Card 3 muestra "Margen metal" con tono amber y "Margen hechura" con emerald.
    const m10 = screen.getByText("+10%");
    const m500 = screen.getByText("+500%");
    expect(m10.className).toMatch(/amber/);
    expect(m500.className).toMatch(/emerald/);
  });

  it("Cambia con currency: ARS → USD", () => {
    const line = makeLine();
    setMetalAndHechura(line);
    const props = { line, onApply: vi.fn(), onClear: vi.fn(), onClose: vi.fn() };
    const { rerender } = render(<SaleCompositionEditableGrid {...props} currency="ARS" />);
    expect(screen.getAllByText(/ARS\s*500,00/).length).toBeGreaterThanOrEqual(1);
    rerender(<SaleCompositionEditableGrid {...props} currency="USD" />);
    expect(screen.getAllByText(/USD\s*500,00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/ARS\s*500,00/)).toBeNull();
  });

  it("El flujo respeta el orden DOM: Costo base → Ajustes → Impacto → Rentabilidad", () => {
    const line = makeLine();
    setMetalAndHechura(line);
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    const c1 = screen.getByText(/Costo base del artículo/i);
    const c2 = screen.getByText(/Ajustes globales aplicados/i);
    const c3 = screen.getByText(/Impacto en el precio de venta/i);
    const c4 = screen.getByText(/Resumen de rentabilidad/i);
    expect(c1.compareDocumentPosition(c2) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(c2.compareDocumentPosition(c3) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(c3.compareDocumentPosition(c4) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 18. Fase 4.2 — TAB navigation: botones no-input fuera del flujo
// ────────────────────────────────────────────────────────────────────────────

describe("Fase 4.2 — TAB navigation", () => {
  it("Botón '+ Bonif./Recargo' tiene tabIndex=-1", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const buttons = screen.getAllByText("+ Bonif./Recargo");
    buttons.forEach((b) => {
      expect(b.getAttribute("tabIndex") || b.getAttribute("tabindex")).toBe("-1");
    });
  });

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

  it("Toggles del AdjustmentEditor activo (kind/type/clear) tienen tabIndex=-1", () => {
    const line = makeLine();
    (line.pricingMeta as any).costLineOverrides = [{
      costLineId: "cl-hechura-1", type: "HECHURA",
      adjustmentKind: "BONUS", adjustmentType: "PERCENTAGE", adjustmentValue: 10,
    }];
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    // Kind toggle (Bonif/Recargo) — único `<button>` con ese texto.
    const kindBtn = screen.getByText("Bonif");
    expect(kindBtn.tagName).toBe("BUTTON");
    expect(kindBtn.getAttribute("tabIndex") || kindBtn.getAttribute("tabindex")).toBe("-1");
    // Type toggle (%/$) — buscar por title (más específico que texto).
    const typeBtn = screen.getByTitle(/Porcentaje \(toggle/);
    expect(typeBtn.getAttribute("tabIndex") || typeBtn.getAttribute("tabindex")).toBe("-1");
    // Clear (×).
    const clearBtn = screen.getByTitle("Quitar ajuste");
    expect(clearBtn.getAttribute("tabIndex") || clearBtn.getAttribute("tabindex")).toBe("-1");
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

describe("Fase 2.5 — Backend extractor extractCompositionCostAdjustment (paridad)", () => {
  // Test del shape: el bloque que llega del backend coincide con lo que
  // el frontend espera.
  it("Tono visual: BONUS → emerald (−), SURCHARGE → amber (+)", () => {
    const lineBonus = makeLine();
    (lineBonus.pricingMeta as any).composition.costAdjustment = {
      kind: "BONUS", type: "PERCENTAGE", value: 10, amount: 100,
    };
    const { rerender } = render(
      <SaleCompositionEditableGrid line={lineBonus} onApply={vi.fn()} {...baseProps} />,
    );
    let signed = screen.getByText(/−ARS\s*100,00/);
    expect(signed.className).toMatch(/emerald/);

    const lineSurcharge = makeLine();
    (lineSurcharge.pricingMeta as any).composition.costAdjustment = {
      kind: "SURCHARGE", type: "PERCENTAGE", value: 10, amount: -100,
    };
    rerender(<SaleCompositionEditableGrid line={lineSurcharge} onApply={vi.fn()} {...baseProps} />);
    signed = screen.getByText(/\+ARS\s*100,00/);
    expect(signed.className).toMatch(/amber/);
  });
});

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

describe("MVP híbrido — Vista costo / Vista comercial", () => {
  it("segmented control visible con default OFF (Costo seleccionado)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const segmented = screen.getByTestId("sale-grid-view-segmented");
    expect(segmented).toBeTruthy();
    const cost = screen.getByTestId("sale-grid-view-cost");
    const commercial = screen.getByTestId("sale-grid-commercial-toggle");
    expect(cost.getAttribute("aria-selected")).toBe("true");
    expect(commercial.getAttribute("aria-selected")).toBe("false");
    expect(commercial.getAttribute("aria-pressed")).toBe("false");
    // Columnas extra NO presentes en estado OFF.
    expect(screen.queryByText(/P\. unit\. venta/)).toBeNull();
    expect(screen.queryByText(/Venta línea/)).toBeNull();
    expect(screen.queryByText(/Particip\./)).toBeNull();
  });

  it("click en pill 'Comercial' revela las 4 columnas extra y marca aria-selected", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    const commercial = screen.getByTestId("sale-grid-commercial-toggle");
    fireEvent.click(commercial);
    expect(commercial.getAttribute("aria-selected")).toBe("true");
    expect(commercial.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("sale-grid-view-cost").getAttribute("aria-selected")).toBe("false");
    expect(screen.getByText(/P\. unit\. venta/)).toBeTruthy();
    // "Margen" aparece también en el bloque Rentabilidad (KPI) — basta con
    // que exista al menos uno en el header de la tabla.
    expect(screen.getAllByText(/^Margen$/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/^Venta línea$/)).toBeTruthy();
    expect(screen.getByText(/Particip\./)).toBeTruthy();
  });

  it("METAL canónico (count===1): muestra precio unit. venta + margen + venta línea (no '—')", () => {
    // metalSale = 1500, lineCost = 500, qty = 2.5 → unit venta = 600
    // margen = (1500-500)/500 = 200%
    const line = makeLine({ metalSale: 1500 } as any);
    line.quantity = 1;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    fireEvent.click(screen.getByTestId("sale-grid-commercial-toggle"));

    // Precio unit. venta METAL = 1500 / 2.5 = 600,00. Puede aparecer también
    // en otro lado (ganancia=600 en pricingMeta) — getAllByText tolera.
    expect(screen.getAllByText(/^ARS\s*600,00$/).length).toBeGreaterThanOrEqual(1);
    // Margen 200,0% — único, y NO está en el bloque Rentabilidad de este fixture.
    expect(screen.getByText(/^200,0%$/)).toBeTruthy();
  });

  it("METAL no canónico (count>1): TODAS las filas METAL muestran '—' en sale-side", () => {
    const line = makeLine({ metalSale: 1500 } as any);
    // Forzamos count=2
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
    fireEvent.click(screen.getByTestId("sale-grid-commercial-toggle"));

    // Cuando count>1, NO debe aparecer un valor con tono "venta" derivado.
    // Verificamos ausencia de un margen porcentual (200%) — al ser count>1
    // ambas filas METAL deben renderizar "—".
    expect(screen.queryByText(/^200,0%$/)).toBeNull();
  });

  it("HECHURA canónica (count===1): muestra sale-side", () => {
    // hechuraSale=400, lineCost=200, qty=1 → unit venta=400, margen=100%
    const line = makeLine({ hechuraSale: 400 } as any);
    line.quantity = 1;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    fireEvent.click(screen.getByTestId("sale-grid-commercial-toggle"));

    // 400 puede aparecer en venta línea + p.unit.venta (qty=1 → coinciden).
    expect(screen.getAllByText(/^ARS\s*400,00$/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/^100,0%$/)).toBeTruthy();
  });

  it("HECHURA no canónica (count>1): muestra '—' en sale-side", () => {
    const line = makeLine({ hechuraSale: 400 } as any);
    (line.pricingMeta as any).composition.hechuras = [
      { ...(line.pricingMeta as any).composition.hechuras[0] },
      { costLineId: "cl-hechura-2", appliedAmount: 50, lineCost: 50, lineLabel: "Hechura B" },
    ];
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    fireEvent.click(screen.getByTestId("sale-grid-commercial-toggle"));

    // Sin margen 100% calculable per-fila.
    expect(screen.queryByText(/^100,0%$/)).toBeNull();
  });

  it("PRODUCT y SERVICE siempre '—' en sale-side (no canónico jamás)", () => {
    // Damos metalSale + hechuraSale para que SOLO PRODUCT/SERVICE queden vacíos.
    const line = makeLine({ metalSale: 1500, hechuraSale: 400 } as any);
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    fireEvent.click(screen.getByTestId("sale-grid-commercial-toggle"));

    // PRODUCT lineCost no existe (totalValue=150). Para que el test sea
    // robusto, validamos que NO aparece un margen del PRODUCT específico:
    // si hubiera prorrateo PRODUCT mostraría algún %, pero no debe.
    // Estrategia: cuento "—" en columnas comerciales — al menos 2 filas
    // (PRODUCT + SERVICE) deben tener celdas con "—".
    const dashCells = screen.getAllByText("—");
    // Como mínimo: 2 filas × 3 sale-cells (P. unit, Margen, Venta línea) = 6 dashes
    // PRODUCT/SERVICE. Tolerante: ≥ 6.
    expect(dashCells.length).toBeGreaterThanOrEqual(6);
  });

  it("Participación se muestra en TODAS las filas (display-only) cuando hay costo", () => {
    const line = makeLine({ metalSale: 1500, hechuraSale: 400 } as any);
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    fireEvent.click(screen.getByTestId("sale-grid-commercial-toggle"));

    // Σ lineCost = 500 (metal) + 200 (hechura) + 150 (product totalValue
    // como lineCost) + 80 (service totalValue) = 930
    // METAL participación = 500/930 ≈ 53,8%
    // HECHURA = 200/930 ≈ 21,5%
    // PRODUCT = 150/930 ≈ 16,1%
    // SERVICE = 80/930 ≈ 8,6%
    expect(screen.getAllByText(/\d+,\d%/).length).toBeGreaterThanOrEqual(2);
  });

  it("click en 'Costo' después de 'Comercial' oculta las columnas extra", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    fireEvent.click(screen.getByTestId("sale-grid-commercial-toggle")); // ON
    expect(screen.queryByText(/P\. unit\. venta/)).toBeTruthy();
    fireEvent.click(screen.getByTestId("sale-grid-view-cost")); // OFF
    expect(screen.queryByText(/P\. unit\. venta/)).toBeNull();
  });

  it("ambos pills del segmented están fuera del flujo TAB (tabIndex=-1)", () => {
    render(<SaleCompositionEditableGrid line={makeLine()} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByTestId("sale-grid-commercial-toggle").getAttribute("tabIndex")).toBe("-1");
    expect(screen.getByTestId("sale-grid-view-cost").getAttribute("tabIndex")).toBe("-1");
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
  it("PRODUCT con lineSale=300 → P. unit. venta=300, Margen=100%, Venta línea=300", () => {
    // lineCost=150 (totalValue), lineSale=300, qty=1 → 300/1=300, (300-150)/150=100%
    const line = makeLine();
    (line.pricingMeta as any).composition.products[0].lineSale = 300;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    fireEvent.click(screen.getByTestId("sale-grid-commercial-toggle"));

    // P. unit. venta del PRODUCT (300 / 1 = 300).
    expect(screen.getAllByText(/^ARS\s*300,00$/).length).toBeGreaterThanOrEqual(1);
    // Margen 100%.
    expect(screen.getByText(/^100,0%$/)).toBeTruthy();
  });

  it("SERVICE con lineSale=200 → margen=150% (cost=80)", () => {
    // lineCost=80, lineSale=200 → margen=(200-80)/80=150%
    const line = makeLine();
    (line.pricingMeta as any).composition.services[0].lineSale = 200;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    fireEvent.click(screen.getByTestId("sale-grid-commercial-toggle"));

    expect(screen.getByText(/^150,0%$/)).toBeTruthy();
  });

  it("HECHURA con lineSale en TODAS las filas (count>1) → todas muestran sale-side", () => {
    // Antes del MVP A+, count>1 → "—". Ahora con lineSale per fila, ambas filas muestran datos.
    const line = makeLine();
    (line.pricingMeta as any).composition.hechuras = [
      { costLineId: "cl-h1", appliedAmount: 200, lineCost: 200, lineSale: 400, lineLabel: "Mano de obra" },
      { costLineId: "cl-h2", appliedAmount: 100, lineCost: 100, lineSale: 200, lineLabel: "Pulido" },
    ];
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    fireEvent.click(screen.getByTestId("sale-grid-commercial-toggle"));

    // Ambas filas tienen margen 100% (cost×2). El '100,0%' debe aparecer al menos 2 veces.
    expect(screen.getAllByText(/^100,0%$/).length).toBeGreaterThanOrEqual(2);
  });

  it("Snapshot legacy: PRODUCT sin lineSale (undefined) → '—' en sale-side", () => {
    // El fixture default NO incluye lineSale en products[0] — simula snapshot v6.
    const line = makeLine();
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    fireEvent.click(screen.getByTestId("sale-grid-commercial-toggle"));

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
    fireEvent.click(screen.getByTestId("sale-grid-commercial-toggle"));

    // Margen 50% común a las 3 filas → debe aparecer al menos 3 veces.
    expect(screen.getAllByText(/^50,0%$/).length).toBeGreaterThanOrEqual(3);
  });

  it("PRODUCT con lineSale null explícito → '—' (no usa fallback inventado)", () => {
    const line = makeLine();
    (line.pricingMeta as any).composition.products[0].lineSale = null;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    fireEvent.click(screen.getByTestId("sale-grid-commercial-toggle"));

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
  it("METAL único con lineSale=1500 → P. unit. venta=600 (1500/2.5g), margen=200%", () => {
    // lineCost=500, lineSale=1500, qty=2.5g → P.unit = 600, margen = (1500-500)/500 = 200%
    const line = makeLine();
    (line.pricingMeta as any).composition.metals[0].lineSale = 1500;
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    fireEvent.click(screen.getByTestId("sale-grid-commercial-toggle"));

    expect(screen.getAllByText(/^ARS\s*600,00$/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/^200,0%$/)).toBeTruthy();
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
    fireEvent.click(screen.getByTestId("sale-grid-commercial-toggle"));

    // Margen uniforme 50% → debe aparecer ≥ 4 veces (1 por fila METAL).
    expect(screen.getAllByText(/^50,0%$/).length).toBeGreaterThanOrEqual(4);
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
    fireEvent.click(screen.getByTestId("sale-grid-commercial-toggle"));

    // Ambos METAL deben tener margen 50% (450/300 = 750/500 = 1.5).
    expect(screen.getAllByText(/^50,0%$/).length).toBeGreaterThanOrEqual(2);
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
    fireEvent.click(screen.getByTestId("sale-grid-commercial-toggle"));

    // Sin lineSale en metales y count>1, las filas METAL muestran "—".
    expect(screen.queryByText(/^50,0%$/)).toBeNull();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(6);
  });

  it("Snapshot legacy: METAL count===1 sin lineSale → fallback a metalSaleCanonical funciona", () => {
    // Compatibilidad: snapshots viejos con count===1 siguen mostrando sale-side
    // via `metalSaleCanonical` (campo agregado del pricingMeta).
    const line = makeLine({ metalSale: 1500 } as any);
    // No seteamos lineSale en el metal[0].
    render(<SaleCompositionEditableGrid line={line} onApply={vi.fn()} {...baseProps} />);
    fireEvent.click(screen.getByTestId("sale-grid-commercial-toggle"));

    // 1500/2.5g = 600. Y margen = (1500-500)/500 = 200%.
    expect(screen.getAllByText(/^ARS\s*600,00$/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/^200,0%$/)).toBeTruthy();
  });
});
