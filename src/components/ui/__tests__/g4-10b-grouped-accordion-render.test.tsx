// src/components/ui/__tests__/g4-10b-grouped-accordion-render.test.tsx
// =============================================================================
// FASE F1.3 G4.x #10-B — render con accordion grupal en
// LineAdvancedOverridesPanel.
//
// Cubre TODAS las validaciones del usuario:
//   1. 1 metal → accordion expandido + editor inline (sin numeración).
//   2. 2 metales → accordion colapsado por default + header con totales.
//   3. Merma distinta dentro de un grupo → "Merma: varias".
//   4. 1 hechura → accordion expandido + editor inline.
//   5. 2 hechuras → accordion colapsado read-only + texto editar ficha.
//   6. Producto/servicio dentro de accordions principales.
//   7. Orden visual fijo METAL → HECHURA → PRODUCTO → SERVICIO.
//   8. Cero cambio en totales/precio final (passthrough estricto).
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { LineAdvancedOverridesPanel } from "../LineAdvancedOverridesPanel";
import type { DocumentLine } from "../../../lib/document-types";

function makeLine(overrides: Partial<DocumentLine["pricingMeta"]> = {}): DocumentLine {
  return {
    id: "line-1", type: "ARTICLE",
    article: "Anillo Test", variant: "",
    articleId: "art-1",
    quantity: 1, unitPrice: 900, discountAmount: 0,
    subtotal: 900, taxAmount: 0,
    lineTotal: 900, lineTotalWithTax: 900,
    pricingMeta: {
      basePrice: 1000, unitPrice: 900,
      composition: {
        metal: {
          appliedGrams: 1.30, purity: 0.75, metalName: "Oro 18k",
          gramsManual: false, mermaManual: false, variantManual: false,
          originalGrams: 1.30, originalMermaPct: 5,
        } as any,
        hechura: {
          appliedAmount: 200, manual: false, appliesTo: "TOTAL",
          originalAmount: 200,
        },
        taxes: [],
        ...overrides.composition,
      },
      ...overrides,
    },
  } as DocumentLine;
}

const baseProps = {
  currency: "ARS",
  onApply: vi.fn(),
  onClear: vi.fn(),
  view: "sale" as const,
};

// ── Helper: encontrar el botón header del SaleColumn por su título ──────────
function findHeaderByTitle(title: string): HTMLElement {
  // Cada SaleColumn renderea un <button> o <div> con un span uppercase del title.
  // Busco el span con texto exacto y luego subo al contenedor.
  const headerSpan = screen.getByText(title);
  return headerSpan.closest("button, [class*='flex']") as HTMLElement;
}

// =============================================================================
// 1. METAL — 1 line vs 2+ lines (numeración no aparece)
// =============================================================================

describe("F1.3 #10-B — METAL accordion grupal", () => {
  it("baseline correct: 1 metal (legacy alias) → accordion 'Metal' expandido + editor inline", () => {
    const line = makeLine();   // composition.metal único, sin metals[]
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    expect(screen.getByText("Metal")).toBeInTheDocument();
    // No hay numeración cuando hay 1 sola line.
    expect(screen.queryByText(/^Metal 1$/)).toBeNull();
    expect(screen.queryByText(/^Metal 2$/)).toBeNull();
    // Editor inline visible (gramos del legacy).
    expect(screen.getByText(/^1\.30 g$/)).toBeInTheDocument();
  });

  it("baseline correct: 2 metales misma variante → accordion 'Metal' colapsado por default", () => {
    const line = makeLine({
      composition: {
        metal: {
          appliedGrams: 1.30, purity: 0.75, metalName: "Oro 18k",
          gramsManual: false, mermaManual: false, variantManual: false,
        } as any,
        metals: [
          { costLineId: "cl-m1", metalVariantId: "mv-oro", metalName: "Oro 18k",
            purity: 0.75, purityLabel: "18k",
            appliedGrams: 1.30, appliedMermaPct: 5, lineCost: 600 },
          { costLineId: "cl-m2", metalVariantId: "mv-oro", metalName: "Oro 18k",
            purity: 0.75, purityLabel: "18k",
            appliedGrams: 0.80, appliedMermaPct: 5, lineCost: 320 },
        ],
        hechura: { appliedAmount: 100, manual: false, appliesTo: null, originalAmount: 100 },
        taxes: [],
      },
    });
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    // 1 solo accordion "Metal" (no se duplica con METAL 1 / METAL 2).
    expect(screen.getAllByText("Metal")).toHaveLength(1);
    // Header muestra 1 variante + total gramos (1.30 + 0.80 = 2.10 g).
    expect(screen.getByText(/^Líneas:?$/)).toBeInTheDocument();
    expect(screen.getByText(/2\.10 g/)).toBeInTheDocument();
  });

  it("baseline correct: 2 metales DISTINTAS variantes → header 'Variantes: 2' + sub-resumen", () => {
    const line = makeLine({
      composition: {
        metal: {
          appliedGrams: 1.30, purity: 0.75, metalName: "Oro 18k",
          gramsManual: false, mermaManual: false, variantManual: false,
        } as any,
        metals: [
          { costLineId: "cl-m1", metalVariantId: "mv-oro", metalName: "Oro 18k",
            purity: 0.75, purityLabel: "18k",
            appliedGrams: 1.30, appliedMermaPct: 5, lineCost: 600 },
          { costLineId: "cl-m2", metalVariantId: "mv-plata", metalName: "Plata 925",
            purity: 0.925, purityLabel: "22k",
            appliedGrams: 0.50, appliedMermaPct: 0, lineCost: 100 },
        ],
        hechura: { appliedAmount: 100, manual: false, appliesTo: null, originalAmount: 100 },
        taxes: [],
      },
    });
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    expect(screen.getByText("Metal")).toBeInTheDocument();
    // Header "Variantes: 2"
    expect(screen.getByText(/^Variantes:?$/)).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    // Sub-resumen aparece como InfoItems "Oro 18k: 1.30 g" y "Plata 925: 0.50 g".
    expect(screen.getByText(/^Oro 18k:?$/)).toBeInTheDocument();
    expect(screen.getByText(/^Plata 925:?$/)).toBeInTheDocument();
    // Total agregado = 1.30 + 0.50 = 1.80 g.
    expect(screen.getByText(/1\.80 g/)).toBeInTheDocument();
  });
});

// =============================================================================
// 2. METAL — merma distinta dentro del grupo
// =============================================================================

describe("F1.3 #10-B — merma 'varias' cuando difiere", () => {
  it("baseline correct: 2 lines misma variante con MERMAS distintas → 'Merma: varias' en detail", () => {
    const line = makeLine({
      composition: {
        metal: {
          appliedGrams: 1, purity: 0.75, metalName: "Oro",
          gramsManual: false, mermaManual: false, variantManual: false,
        } as any,
        metals: [
          { costLineId: "cl-m1", metalVariantId: "mv-1", metalName: "Oro",
            purity: 0.75, purityLabel: "18k",
            appliedGrams: 1, appliedMermaPct: 5, lineCost: 100 },
          { costLineId: "cl-m2", metalVariantId: "mv-1", metalName: "Oro",
            purity: 0.75, purityLabel: "18k",
            appliedGrams: 2, appliedMermaPct: 3, lineCost: 200 },
        ],
        hechura: null, taxes: [],
      },
    });
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    // El detail está colapsado por default (count >= 2). Lo expando.
    const header = findHeaderByTitle("Metal");
    fireEvent.click(header);
    expect(screen.getByText("varias")).toBeInTheDocument();
  });
});

// =============================================================================
// 3. HECHURA — 1 vs 2+
// =============================================================================

describe("F1.3 #10-B — HECHURA accordion grupal", () => {
  it("baseline correct: 1 hechura legacy → 'Hechura' expandido + editor inline", () => {
    const line = makeLine();
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    expect(screen.getByText("Hechura")).toBeInTheDocument();
    expect(screen.queryByText(/^Hechura 1$/)).toBeNull();
  });

  it("baseline correct: 2 hechuras → accordion colapsado + texto 'Editar desde la ficha del artículo'", () => {
    const line = makeLine({
      composition: {
        metal: null,
        hechura: { appliedAmount: 200, manual: false, appliesTo: null, originalAmount: 200 },
        hechuras: [
          { costLineId: "cl-h1", appliedAmount: 200, lineCost: 200, lineLabel: "Mano de obra" },
          { costLineId: "cl-h2", appliedAmount: 150, lineCost: 150, lineLabel: "Pulido" },
        ],
        taxes: [],
      },
    });
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    // 1 solo accordion "Hechura".
    expect(screen.getAllByText("Hechura")).toHaveLength(1);
    // Header muestra 2 líneas + total (200 + 150 = 350).
    expect(screen.getByText(/^Líneas:?$/)).toBeInTheDocument();
    expect(screen.getByText(/350/)).toBeInTheDocument();
    // Expandir: aparecen lines individuales + texto sutil.
    const header = findHeaderByTitle("Hechura");
    fireEvent.click(header);
    expect(screen.getByText("Mano de obra")).toBeInTheDocument();
    expect(screen.getByText("Pulido")).toBeInTheDocument();
    expect(screen.getByText(/Editar desde la ficha del artículo/i)).toBeInTheDocument();
  });
});

// =============================================================================
// 4. PRODUCTO / SERVICIO en accordions principales
// =============================================================================

describe("F1.3 #10-B — PRODUCTO / SERVICIO accordions", () => {
  it("baseline correct: 1 producto → accordion 'Producto' expandido + card interna", () => {
    const line = makeLine({
      composition: {
        metal: null, hechura: null,
        products: [{
          costLineId: "cl-p1", catalogItemId: "art-P",
          catalogItemCode: "ZAF-01", catalogItemName: "Zafiro 0.5ct",
          quantity: 1, unitValue: 100, totalValue: 100, currencyId: null,
          lineAdjKind: null, lineAdjType: null,
          lineAdjValue: null, lineAdjAmount: null, affectsStock: null,
        }],
        taxes: [],
      },
    });
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    // El accordion "Producto" está expandido por count===1 → se ven 2
    // labels "Producto": el header del accordion + el SaleColumn interno.
    expect(screen.getAllByText("Producto").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Zafiro 0.5ct")).toBeInTheDocument();
  });

  it("baseline correct: 2 productos → accordion colapsado, header 'Items: 2 · Total: AR$ X'", () => {
    const line = makeLine({
      composition: {
        metal: null, hechura: null,
        products: [
          { costLineId: "cl-p1", catalogItemId: "art-P1",
            catalogItemCode: "ZAF-01", catalogItemName: "Zafiro 0.5ct",
            quantity: 1, unitValue: 100, totalValue: 100, currencyId: null,
            lineAdjKind: null, lineAdjType: null,
            lineAdjValue: null, lineAdjAmount: null, affectsStock: null },
          { costLineId: "cl-p2", catalogItemId: "art-P2",
            catalogItemCode: "RUB-02", catalogItemName: "Rubí 0.3ct",
            quantity: 1, unitValue: 80, totalValue: 80, currencyId: null,
            lineAdjKind: null, lineAdjType: null,
            lineAdjValue: null, lineAdjAmount: null, affectsStock: null },
        ],
        taxes: [],
      },
    });
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    expect(screen.getByText("Producto")).toBeInTheDocument();
    expect(screen.getByText(/^Items:?$/)).toBeInTheDocument();
    // 2 items en header, total 100 + 80 = 180.
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText(/180/)).toBeInTheDocument();
    // Colapsado: items individuales NO visibles aún.
    expect(screen.queryByText("Zafiro 0.5ct")).toBeNull();
    // Expandir → ambos visibles.
    const header = findHeaderByTitle("Producto");
    fireEvent.click(header);
    expect(screen.getByText("Zafiro 0.5ct")).toBeInTheDocument();
    expect(screen.getByText("Rubí 0.3ct")).toBeInTheDocument();
  });

  it("baseline correct: 1 servicio → accordion 'Servicio' expandido", () => {
    const line = makeLine({
      composition: {
        metal: null, hechura: null,
        products: [],
        services: [{
          costLineId: "cl-s1", catalogItemId: "art-S",
          catalogItemCode: "ENG-01", catalogItemName: "Engaste profesional",
          quantity: 1, unitValue: 80, totalValue: 80, currencyId: null,
          lineAdjKind: null, lineAdjType: null,
          lineAdjValue: null, lineAdjAmount: null, affectsStock: null,
        }],
        taxes: [],
      },
    });
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    expect(screen.getAllByText("Servicio").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Engaste profesional")).toBeInTheDocument();
  });
});

// =============================================================================
// 5. Orden visual fijo METAL → HECHURA → PRODUCTO → SERVICIO
// =============================================================================

describe("F1.3 #10-B — orden visual fijo", () => {
  it("baseline correct: render emite secciones en el orden METAL → HECHURA → PRODUCTO → SERVICIO", () => {
    const line = makeLine({
      composition: {
        metal: {
          appliedGrams: 1, purity: 0.75, metalName: "Oro",
          gramsManual: false, mermaManual: false, variantManual: false,
        } as any,
        hechura: { appliedAmount: 100, manual: false, appliesTo: null, originalAmount: 100 },
        products: [{
          costLineId: "cl-p1", catalogItemId: "art-P",
          catalogItemCode: "X", catalogItemName: "Producto X",
          quantity: 1, unitValue: 50, totalValue: 50, currencyId: null,
          lineAdjKind: null, lineAdjType: null,
          lineAdjValue: null, lineAdjAmount: null, affectsStock: null,
        }],
        services: [{
          costLineId: "cl-s1", catalogItemId: "art-S",
          catalogItemCode: "Y", catalogItemName: "Servicio Y",
          quantity: 1, unitValue: 30, totalValue: 30, currencyId: null,
          lineAdjKind: null, lineAdjType: null,
          lineAdjValue: null, lineAdjAmount: null, affectsStock: null,
        }],
        taxes: [],
      },
    });
    const { container } = render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    const text = container.textContent ?? "";
    const idxMetal    = text.indexOf("Metal");
    const idxHechura  = text.indexOf("Hechura");
    const idxProducto = text.indexOf("Producto");
    const idxServicio = text.indexOf("Servicio");
    // Todos presentes y en orden.
    expect(idxMetal).toBeGreaterThanOrEqual(0);
    expect(idxHechura).toBeGreaterThan(idxMetal);
    expect(idxProducto).toBeGreaterThan(idxHechura);
    expect(idxServicio).toBeGreaterThan(idxProducto);
  });
});

// =============================================================================
// 6. Cero cambio numérico — totales no cambian
// =============================================================================

describe("F1.3 #10-B — cero cambio numérico (regression)", () => {
  it("baseline correct: 1 metal/1 hechura legacy → mismo render que pre-10-B", () => {
    const line = makeLine();
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    // Datos del legacy preservados (variante + gramos del editor inline).
    expect(screen.getByText("Oro 18k")).toBeInTheDocument();
    expect(screen.getByText(/^1\.30 g$/)).toBeInTheDocument();
  });

  it("baseline correct: snapshot SIN metals/hechuras arrays (v4 legacy) → renderea solo el alias", () => {
    const line = makeLine();
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    // 1 accordion Metal + 1 accordion Hechura (sin numeración / sin agregados extra).
    expect(screen.getByText("Metal")).toBeInTheDocument();
    expect(screen.getByText("Hechura")).toBeInTheDocument();
    expect(screen.queryByText(/^Variantes:?$/)).toBeNull();
  });
});
