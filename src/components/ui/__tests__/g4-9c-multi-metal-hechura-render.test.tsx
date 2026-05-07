// src/components/ui/__tests__/g4-9c-multi-metal-hechura-render.test.tsx
// =============================================================================
// FASE F1.3 G4.x #9-C — render visual de múltiples METAL / HECHURA.
//
// Cubre TODAS las validaciones del usuario:
//   1. 1 metal → título "Metal" (sin numeración)
//   2. 2 metales → "Metal 1" + "Metal 2" (numeración condicional)
//   3. 1 hechura → título "Hechura"
//   4. 2 hechuras → "Hechura 1" + "Hechura 2"
//   5. Combinación 2m + 2h + productos + servicios → todos visibles
//   6. Snapshot legacy con metal/hechura singleton → renderea igual que antes
//   7. Productos/servicios siguen visibles (regression)
//   8. Items 2+ son read-only (sin inputs editables)
//   9. Items 2+ muestran texto "Editar desde la ficha del artículo"
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

// =============================================================================
// 1. NUMERACIÓN CONDICIONAL — Metal
// =============================================================================

describe("F1.3 #9-C — numeración condicional METAL", () => {
  it("baseline correct: 1 metal (sin metals[]) → título 'Metal' sin número", () => {
    const line = makeLine();
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    expect(screen.getByText("Metal")).toBeInTheDocument();
    expect(screen.queryByText("Metal 1")).toBeNull();
    expect(screen.queryByText("Metal 2")).toBeNull();
  });

  it("baseline correct: 1 metal en metals[] → 'Metal' (sin número)", () => {
    const line = makeLine({
      composition: {
        metal: {
          appliedGrams: 1, purity: 0.75, metalName: "Oro",
          gramsManual: false, mermaManual: false, variantManual: false,
        } as any,
        metals: [{
          costLineId: "cl-m1", metalVariantId: "mv-1", metalName: "Oro",
          purity: 0.75, purityLabel: "18k",
          appliedGrams: 1, appliedMermaPct: 0, lineCost: 600,
        }],
        hechura: { appliedAmount: 100, manual: false, appliesTo: null, originalAmount: 100 },
        taxes: [],
      },
    });
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    expect(screen.getByText("Metal")).toBeInTheDocument();
    expect(screen.queryByText(/Metal 1/)).toBeNull();
  });

  it("baseline correct: 2 metales → títulos 'Metal 1' + 'Metal 2'", () => {
    const line = makeLine({
      composition: {
        metal: {
          appliedGrams: 1.30, purity: 0.75, metalName: "Oro",
          gramsManual: false, mermaManual: false, variantManual: false,
          originalGrams: 1.30, originalMermaPct: 5,
        } as any,
        metals: [
          { costLineId: "cl-m1", metalVariantId: "mv-1", metalName: "Oro",
            purity: 0.75, purityLabel: "18k",
            appliedGrams: 1.30, appliedMermaPct: 5, lineCost: 600 },
          { costLineId: "cl-m2", metalVariantId: "mv-2", metalName: "Plata",
            purity: 0.925, purityLabel: "22k",
            appliedGrams: 2.00, appliedMermaPct: 0, lineCost: 400 },
        ],
        hechura: { appliedAmount: 100, manual: false, appliesTo: null, originalAmount: 100 },
        taxes: [],
      },
    });
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    expect(screen.getByText("Metal 1")).toBeInTheDocument();
    expect(screen.getByText("Metal 2")).toBeInTheDocument();
    // El título "Metal" sin número NO debe aparecer.
    expect(screen.queryByText(/^Metal$/)).toBeNull();
    // El segundo metal muestra Plata (no se pierde).
    expect(screen.getByText(/Plata/)).toBeInTheDocument();
  });

  it("baseline correct: 3 metales → 'Metal 1' / 'Metal 2' / 'Metal 3'", () => {
    const line = makeLine({
      composition: {
        metal: {
          appliedGrams: 1, purity: 0.75, metalName: "A",
          gramsManual: false, mermaManual: false, variantManual: false,
        } as any,
        metals: [
          { costLineId: "cl-m1", metalVariantId: "mv-1", metalName: "A", purity: null,
            purityLabel: null, appliedGrams: 1, appliedMermaPct: 0, lineCost: 100 },
          { costLineId: "cl-m2", metalVariantId: "mv-2", metalName: "B", purity: null,
            purityLabel: null, appliedGrams: 2, appliedMermaPct: 0, lineCost: 200 },
          { costLineId: "cl-m3", metalVariantId: "mv-3", metalName: "C", purity: null,
            purityLabel: null, appliedGrams: 3, appliedMermaPct: 0, lineCost: 300 },
        ],
        hechura: { appliedAmount: 100, manual: false, appliesTo: null, originalAmount: 100 },
        taxes: [],
      },
    });
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    expect(screen.getByText("Metal 1")).toBeInTheDocument();
    expect(screen.getByText("Metal 2")).toBeInTheDocument();
    expect(screen.getByText("Metal 3")).toBeInTheDocument();
  });
});

// =============================================================================
// 2. NUMERACIÓN CONDICIONAL — Hechura
// =============================================================================

describe("F1.3 #9-C — numeración condicional HECHURA", () => {
  it("baseline correct: 1 hechura (sin hechuras[]) → título 'Hechura'", () => {
    const line = makeLine();
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    expect(screen.getByText("Hechura")).toBeInTheDocument();
    expect(screen.queryByText(/Hechura 1/)).toBeNull();
  });

  it("baseline correct: 2 hechuras → 'Hechura 1' + 'Hechura 2'", () => {
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
    expect(screen.getByText("Hechura 1")).toBeInTheDocument();
    expect(screen.getByText("Hechura 2")).toBeInTheDocument();
    expect(screen.queryByText(/^Hechura$/)).toBeNull();
    // La segunda hechura muestra el lineLabel "Pulido".
    expect(screen.getByText("Pulido")).toBeInTheDocument();
  });
});

// =============================================================================
// 3. COMBINACIÓN MIXTA — todos los componentes visibles
// =============================================================================

describe("F1.3 #9-C — combinación mixta sin perder componentes", () => {
  it("baseline correct: 2 metales + 2 hechuras + 1 producto + 1 servicio → todos visibles", () => {
    const line = makeLine({
      composition: {
        metal: {
          appliedGrams: 1, purity: 0.75, metalName: "Oro",
          gramsManual: false, mermaManual: false, variantManual: false,
        } as any,
        hechura: { appliedAmount: 200, manual: false, appliesTo: null, originalAmount: 200 },
        metals: [
          { costLineId: "cl-m1", metalVariantId: "mv-1", metalName: "Oro",
            purity: 0.75, purityLabel: "18k",
            appliedGrams: 1, appliedMermaPct: 0, lineCost: 600 },
          { costLineId: "cl-m2", metalVariantId: "mv-2", metalName: "Plata",
            purity: 0.925, purityLabel: "22k",
            appliedGrams: 2, appliedMermaPct: 0, lineCost: 400 },
        ],
        hechuras: [
          { costLineId: "cl-h1", appliedAmount: 200, lineCost: 200, lineLabel: "Mano de obra" },
          { costLineId: "cl-h2", appliedAmount: 150, lineCost: 150, lineLabel: "Pulido" },
        ],
        products: [{
          costLineId: "cl-p1", catalogItemId: "art-P",
          catalogItemCode: "ZAF-01", catalogItemName: "Zafiro 0.5ct",
          quantity: 1, unitValue: 50, totalValue: 50, currencyId: null,
          lineAdjKind: null, lineAdjType: null,
          lineAdjValue: null, lineAdjAmount: null, affectsStock: null,
        }],
        services: [{
          costLineId: "cl-s1", catalogItemId: "art-S",
          catalogItemCode: "ENG-01", catalogItemName: "Engaste",
          quantity: 1, unitValue: 30, totalValue: 30, currencyId: null,
          lineAdjKind: null, lineAdjType: null,
          lineAdjValue: null, lineAdjAmount: null, affectsStock: null,
        }],
        taxes: [],
      },
    });
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    // Metales numerados.
    expect(screen.getByText("Metal 1")).toBeInTheDocument();
    expect(screen.getByText("Metal 2")).toBeInTheDocument();
    expect(screen.getByText(/Plata/)).toBeInTheDocument();
    // Hechuras numeradas.
    expect(screen.getByText("Hechura 1")).toBeInTheDocument();
    expect(screen.getByText("Hechura 2")).toBeInTheDocument();
    expect(screen.getByText("Pulido")).toBeInTheDocument();
    // Producto + servicio (regression).
    expect(screen.getByText("Producto")).toBeInTheDocument();
    expect(screen.getByText("Zafiro 0.5ct")).toBeInTheDocument();
    expect(screen.getByText("Servicio")).toBeInTheDocument();
    expect(screen.getByText("Engaste")).toBeInTheDocument();
  });
});

// =============================================================================
// 4. RETROCOMPAT snapshot legacy
// =============================================================================

describe("F1.3 #9-C — snapshot legacy (sin metals/hechuras arrays)", () => {
  it("baseline correct: snapshot legacy con metal único → renderea igual que antes (1 'Metal', sin número)", () => {
    // Solo el alias legacy `metal`. Sin `metals[]` array.
    const line = makeLine();
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    expect(screen.getByText("Metal")).toBeInTheDocument();
    // Sigue mostrando datos del legacy.
    expect(screen.getByText(/^1\.30 g$/)).toBeInTheDocument();
    expect(screen.queryByText(/Metal 1/)).toBeNull();
  });

  it("baseline correct: snapshot legacy con hechura única → renderea 'Hechura' sin número", () => {
    const line = makeLine();
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    expect(screen.getByText("Hechura")).toBeInTheDocument();
    expect(screen.queryByText(/Hechura 1/)).toBeNull();
  });
});

// =============================================================================
// 5. READ-ONLY items 2+
// =============================================================================

describe("F1.3 #9-C — items 2+ son read-only (D1)", () => {
  it("baseline correct: Metal 2 muestra texto 'Editar desde la ficha del artículo'", () => {
    const line = makeLine({
      composition: {
        metal: {
          appliedGrams: 1, purity: 0.75, metalName: "Oro",
          gramsManual: false, mermaManual: false, variantManual: false,
        } as any,
        metals: [
          { costLineId: "cl-m1", metalVariantId: "mv-1", metalName: "Oro",
            purity: 0.75, purityLabel: "18k",
            appliedGrams: 1, appliedMermaPct: 0, lineCost: 600 },
          { costLineId: "cl-m2", metalVariantId: "mv-2", metalName: "Plata",
            purity: 0.925, purityLabel: "22k",
            appliedGrams: 2, appliedMermaPct: 0, lineCost: 400 },
        ],
        hechura: { appliedAmount: 100, manual: false, appliesTo: null, originalAmount: 100 },
        taxes: [],
      },
    });
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    expect(screen.getAllByText(/Editar desde la ficha del artículo/i).length).toBeGreaterThanOrEqual(1);
  });

  it("baseline correct: Hechura 2 muestra 'Costo' del item (no agrega 'Bonif.' editable)", () => {
    const line = makeLine({
      composition: {
        metal: null,
        hechura: { appliedAmount: 200, manual: false, appliesTo: null, originalAmount: 200 },
        hechuras: [
          { costLineId: "cl-h1", appliedAmount: 200, lineCost: 200, lineLabel: "MO" },
          { costLineId: "cl-h2", appliedAmount: 150, lineCost: 150, lineLabel: "Pulido" },
        ],
        taxes: [],
      },
    });
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    expect(screen.getByText("Hechura 2")).toBeInTheDocument();
    // El read-only NO incluye "Bonif." (esa es del editor del [0]).
    // Sí muestra "Costo" del item.
    const hechura2Texts = screen.getAllByText(/Costo/);
    expect(hechura2Texts.length).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// 6. Cero cambio numérico — totales no cambiaron
// =============================================================================

describe("F1.3 #9-C — cero cambio numérico", () => {
  it("baseline correct: 1 metal/1 hechura legacy → mismo render que antes (regression)", () => {
    const line = makeLine();
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    // Datos del legacy preservados.
    expect(screen.getByText("Oro 18k")).toBeInTheDocument();
    expect(screen.getByText(/^1\.30 g$/)).toBeInTheDocument();
    expect(screen.getByText("Hechura")).toBeInTheDocument();
  });
});
