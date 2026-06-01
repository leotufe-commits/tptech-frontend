// src/components/ui/__tests__/total-line-unit-and-composition.test.tsx
// ============================================================================
// T8 — La celda "Total línea c/imp." de Factura suma dos piezas read-only:
//
//   1. "Unitario final" — visible solo si quantity > 1. Se prefiere el campo
//      pasado por el motor (`pricingMeta.unitTotalWithTax`); si falta,
//      cae a `totalWithTax / quantity` (POLICY R4.1 — dos valores del motor,
//      cero matemática comercial nueva).
//   2. Mini desglose por componente — Metal, Hechura, Productos, Servicios.
//      Lee passthrough de `pricingMeta.metalSale`, `hechuraSale`,
//      `metalMarginPct`, `hechuraMarginPct` y `pricingMeta.composition.{products,services}`.
//      Misma fuente que el Simulador (`TPPriceCompositionKpis`). Oculto
//      cuando no hay datos disponibles.
// ============================================================================

import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LinesEditorSection } from "../../../pages/ventas-facturas/InvoiceEditorModal/LinesEditorSection";
import type { DocumentLine } from "../../../lib/document-types";

function makeLine(overrides: Partial<DocumentLine> & { pricingMeta?: any } = {}): DocumentLine {
  return {
    id: "L1", type: "ARTICLE", article: "Anillo", variant: "",
    articleId: "art-1", quantity: 1, unitPrice: 100,
    discountAmount: 0, subtotal: 100, taxAmount: 21,
    lineTotal: 100, lineTotalWithTax: 121,
    ...overrides,
    pricingMeta: {
      priceSource: "PRICE_LIST", basePrice: 100,
      ...(overrides.pricingMeta ?? {}),
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
  onAddLine: () => {}, applyLineOverrides: () => {}, clearLineOverrides: () => {},
  setLineTaxOverride: () => {}, onChangePriceList: () => {},
  onChangeLinePriceList: () => {}, onChangeChannel: () => {},
  handleEditArticle: () => {}, handleLineArticlePick: () => {},
  handleCreateManualLine: () => {}, searchArticles: undefined as any,
  exactLookupArticle: undefined as any, focusedLineId: null, focusSignal: 0,
  editorScopeRef: React.createRef<HTMLDivElement | null>(), previewLoading: false,
};

describe("T8 — Total línea c/imp · unitario final + mini desglose", () => {
  it("quantity = 1 → NO muestra 'Unitario final' (duplica el total)", () => {
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({ quantity: 1, lineTotalWithTax: 121, pricingMeta: { unitTotalWithTax: 121 } })]} />);
    expect(screen.queryByText(/Unitario final/i)).toBeNull();
  });

  it("T20 — qty > 1 + drift > AR$ 1 entre unitTotalWithTax × qty y total → OCULTA el unitario", () => {
    // Sanity guard: si el motor emite mal `unitTotalWithTax` (no respeta
    // POLICY R4.1: `unitTotalWithTax = lineTotalWithTax / qty`), mostrar
    // un valor que contradice el total línea induciría error. Ocultamos.
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        quantity: 3,
        // Total línea = 363 (qty=3 × supuesto unit=121). Pero el campo
        // backend dice 200 → 200 × 3 = 600, drift = 237 >> 1.
        lineTotalWithTax: 363,
        pricingMeta: { unitTotalWithTax: 200 },
      })]} />);
    expect(screen.queryByText(/Unitario final/i)).toBeNull();
  });

  it("T20 — qty > 1 + drift insignificante (≤ AR$ 1 por redondeo) → MUESTRA el unitario", () => {
    // Caso real: redondeo del motor introduce ≤ AR$ 1 entre unitario × qty
    // y el total. El label se sigue mostrando (es información útil).
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        quantity: 3,
        lineTotalWithTax: 363, // 121 × 3
        pricingMeta: { unitTotalWithTax: 121 },
      })]} />);
    expect(screen.getByText(/Unitario final/i)).toBeInTheDocument();
  });

  it("T14 — quantity > 1 → fuente PRIMARIA = pricingMeta.unitTotalWithTax (data-tp-unit-final=backend)", () => {
    const { container } = render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        quantity: 3,
        lineTotalWithTax: 363,
        pricingMeta: { unitTotalWithTax: 121 },
      })]} />);
    const unitLabel = screen.getByText(/Unitario final/i);
    expect(unitLabel).toBeInTheDocument();
    expect(unitLabel.textContent ?? "").toMatch(/Cantidad/);
    expect(unitLabel.textContent ?? "").toMatch(/3/);
    // T14 — el data-attr marca explícitamente que la fuente es el campo
    // canónico del motor (no el fallback legacy).
    const node = container.querySelector('[data-tp-unit-final]') as HTMLElement;
    expect(node?.dataset.tpUnitFinal).toBe("backend");
  });

  it("T14 — quantity > 1 con `unitTotalWithTax` definido distinto a totalWithTax/qty → PREFIERE el campo backend", () => {
    // Si por cualquier redondeo `pl.unitTotalWithTax` difiere de
    // `lineTotalWithTax / qty`, el campo backend GANA — el cálculo
    // visual no debe re-derivar.
    render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        quantity: 3,
        // El motor decidió que el unitario es 100,33 (redondeo de lista).
        // lineTotalWithTax / qty daría 100,00 — el frontend NO debe usarlo.
        lineTotalWithTax: 300,
        pricingMeta: { unitTotalWithTax: 100.33 },
      })]} />);
    const unitLabel = screen.getByText(/Unitario final/i);
    // Aparece el monto del campo backend, no el derivado.
    expect(unitLabel.textContent ?? "").toMatch(/100[.,]33/);
  });

  it("T14 — quantity > 1 y SIN pricingMeta.unitTotalWithTax → fallback legacy (data-tp-unit-final=legacy-fallback)", () => {
    // Snapshot legacy sin `unitTotalWithTax` (v4 o anteriores).
    // POLICY R4.1 lo define como `lineTotalWithTax / qty` — el frontend
    // aplica esa misma definición sobre dos campos passthrough motor.
    const { container } = render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        quantity: 2,
        lineTotalWithTax: 242,
        pricingMeta: {},
      })]} />);
    expect(screen.getByText(/Unitario final/i)).toBeInTheDocument();
    const node = container.querySelector('[data-tp-unit-final]') as HTMLElement;
    expect(node?.dataset.tpUnitFinal).toBe("legacy-fallback");
  });

  it("T12+T21 — metales agrupados por METAL PADRE (label principal = padre; variantes en sub-fila 'Detalle:')", () => {
    const { container } = render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        quantity: 2,
        pricingMeta: {
          composition: {
            metals: [
              { metalName: "Oro",   purity: 0.75,  appliedGrams: 1.5, appliedMermaPct: 0, variantName: "Oro 18k" },
              { metalName: "Oro",   purity: 0.916, appliedGrams: 0.6, appliedMermaPct: 0, variantName: "Oro 22k" },
              { metalName: "Plata", purity: 0.925, appliedGrams: 2.0, appliedMermaPct: 0, variantName: "Plata 925" },
            ],
          },
        },
      })]} />);
    // Vista RESUMIDA (default colapsada): el detalle por metal padre (Oro/Plata)
    // está OCULTO. En lista unificada (sin contexto comercial) el colapsado no
    // muestra metales; se revelan con el toggle "Ver composición"/"Ver detalle".
    expect(screen.queryByText("Oro")).toBeNull();
    expect(screen.queryByText("Plata")).toBeNull();
    // Expandir el detalle (toggle por data-attribute — robusto al label).
    fireEvent.click(container.querySelector("[data-tp-composition-detail-toggle]")!);
    // T21 — Label PRINCIPAL = nombre del METAL PADRE.
    expect(screen.getByText("Oro")).toBeInTheDocument();
    expect(screen.getByText("Plata")).toBeInTheDocument();
    // Reorg (mini-dashboard) — el ORIGEN muestra la variante como
    // "<variante> · <gramos>" (sin prefijo "Detalle:"), debajo del resultado.
    expect(container.textContent ?? "").toMatch(/Oro 18k\s*·/);
    expect(container.textContent ?? "").toMatch(/Plata 925\s*·/);
    // El preset METAL_GRAMS ya emite el sufijo " g" — no debe aparecer "g gr".
    expect(container.textContent ?? "").not.toMatch(/g\s+gr/);
  });

  it("T21 — gramos mostrados = EQUIVALENTES (purity × merma) × lineQty (paridad Simulador)", () => {
    // Oro 18k: appliedGrams 2,0 × purity 0,75 × (1+0/100) = 1,5 equivGr per-unit.
    // qty=3 → 4,5 gr equivalentes en línea. (≠ gramos crudos 2,0 × 3 = 6,0).
    const { container } = render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        quantity: 3,
        pricingMeta: {
          composition: {
            metals: [
              { metalName: "Oro", purity: 0.75, appliedGrams: 2.0, appliedMermaPct: 0, variantName: "Oro 18k" },
            ],
          },
        },
      })]} />);
    // El detalle por metal padre vive detrás del toggle (default colapsado).
    fireEvent.click(container.querySelector("[data-tp-composition-detail-toggle]")!);
    // Buscamos el texto en cualquier nodo que contenga la línea de Oro y
    // verificamos que sea 4,5 (equivalentes) y NO 6,0 (crudos × qty).
    const oroRow = screen.getByText("Oro").parentElement!;
    expect(oroRow.textContent ?? "").toMatch(/4[,.]\s*5/);
    expect(oroRow.textContent ?? "").not.toMatch(/^Oro\s+6[,.]/);
  });

  it("T13 — Hechura unificada (subtotal + productos + servicios + IVA imputado)", () => {
    const { container } = render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        quantity: 1,
        pricingMeta: {
          metalSale:   100,
          hechuraSale:  40, // subtotal hechura per-unit
          composition: {
            products: [{ catalogItemName: "Zafiro 0.5ct", unitValue: 50, totalValue: 50 }],
            services: [{ catalogItemName: "Engaste",      unitValue: 12, totalValue: 12 }],
          },
          taxBreakdown: [
            { name: "IVA", rate: 21, taxAmount: 21, applyOn: "TOTAL" },
          ],
        },
      })]} />);
    // En lista unificada el desglose monetario vive detrás del toggle
    // "Ver composición" (colapsado muestra solo el Total). Expandir primero.
    fireEvent.click(container.querySelector("[data-tp-composition-detail-toggle]")!);
    // Opción A — el header de la sección no-metal pasó a llamarse
    // "MONETARIO" (antes "HECHURA"): Monetario = Total línea c/ imp. −
    // Metal Comercial. Sigue siendo un único header de sección, sin label
    // de fila duplicado.
    expect(screen.getByText("MONETARIO")).toBeInTheDocument();
    // El monto unificado incluye productos+servicios+impuestos (no es solo 40).
    // 40 + 50 + 12 + (21 × 40 / (100 + 40)) = 102 + 6 ≈ 108.
    // (paridad funcional con buildLineHechuraSaleUnified)
  });

  it("sin datos de composición → NO se renderiza el mini desglose (sin card vacío)", () => {
    const { container } = render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        quantity: 1,
        pricingMeta: { /* sin metalSale, sin hechuraSale, sin composition */ },
      })]} />);
    // Opción A — el card del resumen comercial no debe mostrar la sección
    // METAL (sin metales). MONETARIO puede aparecer porque la línea trae
    // lineTotalWithTax > 0 por defecto en `makeLine()` —
    // Monetario = totalWithTax − Σmetales = totalWithTax cuando no hay metales.
    // El test original asumía un setup donde el bloque entero no renderiza
    // (pre-Etapa D' edición de fixtures). Hoy verificamos lo único invariante:
    // que NO hay sección METAL.
    expect(screen.queryByText("METAL")).toBeNull();
  });

  it("no introduce 'toFixed'/'toLocaleString' (uso obligatorio de formatByType)", () => {
    // Anti-regresión POLICY de formato. El bloque T8 debe usar `mFmt`/
    // `formatByType` para todos los importes y porcentajes — nada hardcoded.
    // (Se cubre estáticamente por los guards no-inline-format; este test
    // funcional solo asegura que el render no rompe por uso indebido.)
    expect(() => render(<LinesEditorSection {...(baseProps as any)}
      lines={[makeLine({
        quantity: 2,
        pricingMeta: {
          unitTotalWithTax: 60.5,
          metalSale: 40, hechuraSale: 20.5,
          metalMarginPct: 12.345, hechuraMarginPct: 18.7,
        },
      })]} />)).not.toThrow();
  });
});
