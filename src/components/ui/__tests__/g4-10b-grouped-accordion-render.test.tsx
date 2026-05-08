// src/components/ui/__tests__/g4-10b-grouped-accordion-render.test.tsx
// =============================================================================
// FASE F1.3 G4.x #10-F — render con TABLA ERP unificada en
// LineAdvancedOverridesPanel. Reemplaza los antiguos accordions (10-B/E)
// por una tabla con resumen-chips arriba + filas grupadas por tipo.
//
// Cubre todos los casos del usuario:
//   1. Solo metal (1 cost line) → tabla con 1 fila METAL + editor inline.
//   2. Solo hechura (1 cost line) → tabla con 1 fila HECHURA + editor inline.
//   3. Solo producto → tabla con 1 fila PRODUCT.
//   4. Solo servicio → tabla con 1 fila SERVICE.
//   5. Múltiples metales → 1 fila por sub-grupo (variante).
//   6. Mix completo → todas las filas presentes en orden fijo.
//   7. Snapshot legacy v4 → fallback al alias preserva render.
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
// 1. Resumen-chips superiores
// =============================================================================

describe("F1.3 #10-F — resumen chips arriba de la tabla", () => {
  it("baseline correct: 1 metal/1 hechura legacy → chips Metales/Hechuras visibles", () => {
    const line = makeLine();   // legacy alias: 1 metal + 1 hechura.
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    // Chips uppercase.
    expect(screen.getByText("Metales")).toBeInTheDocument();
    expect(screen.getByText("Hechuras")).toBeInTheDocument();
    expect(screen.getByText("Productos")).toBeInTheDocument();
    expect(screen.getByText("Servicios")).toBeInTheDocument();
    // Total componentes a la derecha.
    expect(screen.getByText("Total componentes:")).toBeInTheDocument();
  });

  it("baseline correct: chip METALES muestra total gramos (1.30 g del legacy)", () => {
    const line = makeLine();
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    // "1.30 g" aparece tanto en el chip como en la fila — al menos 1.
    expect(screen.getAllByText(/1\.30 g/).length).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// 2. Tabla principal — header de columnas
// =============================================================================

describe("F1.3 #10-F — header de columnas de la tabla", () => {
  it("baseline correct: render emite header con las 6 columnas financieras", () => {
    const line = makeLine();
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    // Headers uppercase de la tabla.
    expect(screen.getByText("Componente")).toBeInTheDocument();
    expect(screen.getByText("Cantidad")).toBeInTheDocument();
    expect(screen.getByText("Val. unit.")).toBeInTheDocument();
    expect(screen.getByText("Ajuste")).toBeInTheDocument();
    expect(screen.getByText("Val. venta")).toBeInTheDocument();
    expect(screen.getByText("Total c/imp.")).toBeInTheDocument();
  });
});

// =============================================================================
// 3. Filas por tipo — orden fijo METAL → HECHURA → PRODUCT → SERVICE
// =============================================================================

describe("F1.3 #10-F — filas por tipo en orden fijo", () => {
  it("baseline correct: legacy 1 metal/1 hechura → 1 fila Oro 18k + 1 fila Hechura", () => {
    const line = makeLine();
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    // Primary text de cada row.
    expect(screen.getByText("Oro 18k")).toBeInTheDocument();
    expect(screen.getByText("Hechura")).toBeInTheDocument();
  });

  it("baseline correct: 2 metales distintos → 2 filas separadas", () => {
    const line = makeLine({
      composition: {
        metal: {
          appliedGrams: 1.30, purity: 0.75, metalName: "Oro 18k",
          gramsManual: false, mermaManual: false, variantManual: false,
        } as any,
        metals: [
          { costLineId: "cl-m1", metalVariantId: "mv-1", metalName: "Oro 18k",
            purity: 0.75, purityLabel: "18k",
            appliedGrams: 1.30, appliedMermaPct: 5, lineCost: 600 },
          { costLineId: "cl-m2", metalVariantId: "mv-2", metalName: "Plata 925",
            purity: 0.925, purityLabel: "22k",
            appliedGrams: 0.50, appliedMermaPct: 0, lineCost: 100 },
        ],
        hechura: { appliedAmount: 100, manual: false, appliesTo: null, originalAmount: 100 },
        taxes: [],
      },
    });
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    expect(screen.getByText("Oro 18k")).toBeInTheDocument();
    expect(screen.getByText("Plata 925")).toBeInTheDocument();
  });

  it("baseline correct: solo PRODUCT → fila con nombre y código", () => {
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
    expect(screen.getByText("Zafiro 0.5ct")).toBeInTheDocument();
    // Código aparece en secondary.
    expect(screen.getByText(/ZAF-01/)).toBeInTheDocument();
  });

  it("baseline correct: solo SERVICE → fila con nombre", () => {
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
    expect(screen.getByText("Engaste profesional")).toBeInTheDocument();
  });

  it("baseline correct: orden visual METAL → HECHURA → PRODUCT → SERVICE", () => {
    const line = makeLine({
      composition: {
        metal: {
          appliedGrams: 1, purity: 0.75, metalName: "Oro",
          gramsManual: false, mermaManual: false, variantManual: false,
        } as any,
        hechura: { appliedAmount: 200, manual: false, appliesTo: null, originalAmount: 200 },
        products: [{
          costLineId: "cl-p", catalogItemId: "art-P",
          catalogItemCode: "X", catalogItemName: "Producto X",
          quantity: 1, unitValue: 50, totalValue: 50, currencyId: null,
          lineAdjKind: null, lineAdjType: null,
          lineAdjValue: null, lineAdjAmount: null, affectsStock: null,
        }],
        services: [{
          costLineId: "cl-s", catalogItemId: "art-S",
          catalogItemCode: "Y", catalogItemName: "Servicio Y",
          quantity: 1, unitValue: 30, totalValue: 30, currencyId: null,
          lineAdjKind: null, lineAdjType: null,
          lineAdjValue: null, lineAdjAmount: null, affectsStock: null,
        }],
        taxes: [],
      },
    });
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    // Verifica orden por posición de los elementos primary de cada fila.
    // (Usar `getByText` específico evita ambigüedad con chips/headers.)
    const oro      = screen.getByText("Oro");
    const productX = screen.getByText("Producto X");
    const servicio = screen.getByText("Servicio Y");
    // compareDocumentPosition: 4 = el segundo follow al primero.
    expect(oro.compareDocumentPosition(productX) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(productX.compareDocumentPosition(servicio) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// =============================================================================
// 4. Editor inline embebido en sub-row
// =============================================================================

describe("F1.3 #10-F — editor inline en sub-row de la tabla", () => {
  it("baseline correct: 1 metal legacy → input editable en celda Cantidad + Merma sub-row", () => {
    const line = makeLine();
    const { container } = render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    // Input numérico editable en la celda Cantidad (METAL count===1).
    const inputs = container.querySelectorAll('input[type="text"], input[inputmode="decimal"]');
    expect(inputs.length).toBeGreaterThanOrEqual(1);
    // Sub-row residual con label "Merma".
    expect(screen.getByText("Merma")).toBeInTheDocument();
    // El label "Gramos" del sub-row YA NO debe aparecer (movido a celda).
    expect(screen.queryByText("Gramos")).toBeNull();
  });

  it("baseline correct: 1 hechura legacy → input editable en celda Val.unit + BonifValue en Ajuste", () => {
    const line = makeLine();
    const { container } = render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    // Input editable de hechura — el sub-row ya no existe.
    const inputs = container.querySelectorAll('input[type="text"], input[inputmode="decimal"]');
    expect(inputs.length).toBeGreaterThanOrEqual(1);
    // Sub-row eliminado: labels "Valor" y "Bonificación" del sub-row ya no aparecen.
    expect(screen.queryByText("Valor")).toBeNull();
    expect(screen.queryByText("Bonificación")).toBeNull();
  });

  it("baseline correct: 2 metales (count > 1) → NO muestra inputs editables", () => {
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
            appliedGrams: 2, appliedMermaPct: 5, lineCost: 200 },
        ],
        hechura: null,
        taxes: [],
      },
    });
    const { container } = render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    // F1.3 #10-H — celdas se ven como inputs pero TODOS read-only (count=2).
    const inputs = container.querySelectorAll('input[type="text"], input[inputmode="decimal"]');
    for (const el of Array.from(inputs)) {
      const i = el as HTMLInputElement;
      expect(i.readOnly || i.disabled).toBe(true);
    }
    expect(screen.queryByText("Merma")).toBeNull();
  });
});

// =============================================================================
// 5. Ajustes (BONUS / SURCHARGE) en columna AJUSTE
// =============================================================================

describe("F1.3 #10-F — columna AJUSTE muestra Bonif./Recargo", () => {
  it("baseline correct: producto con BONUS PERCENTAGE → '+/−' con monto emerald", () => {
    const line = makeLine({
      composition: {
        metal: null, hechura: null,
        products: [{
          costLineId: "cl-p1", catalogItemId: "art-P",
          catalogItemCode: "X", catalogItemName: "Item",
          quantity: 1, unitValue: 100, totalValue: 95, currencyId: null,
          lineAdjKind: "BONUS", lineAdjType: "PERCENTAGE",
          lineAdjValue: 5, lineAdjAmount: 5, affectsStock: null,
        }],
        taxes: [],
      },
    });
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    // Texto de porcentaje (ej. "5%") + signo "−" emerald.
    expect(screen.getByText(/^5%$/)).toBeInTheDocument();
    const minus = screen.getByText(/^−/);
    expect(minus.closest("span")?.className).toMatch(/emerald/);
  });

  it("baseline correct: servicio con SURCHARGE → '+' amber", () => {
    const line = makeLine({
      composition: {
        metal: null, hechura: null,
        products: [],
        services: [{
          costLineId: "cl-s1", catalogItemId: "art-S",
          catalogItemCode: "X", catalogItemName: "Engaste",
          quantity: 1, unitValue: 80, totalValue: 100, currencyId: null,
          lineAdjKind: "SURCHARGE", lineAdjType: "PERCENTAGE",
          lineAdjValue: 25, lineAdjAmount: 20, affectsStock: null,
        }],
        taxes: [],
      },
    });
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    expect(screen.getByText(/^25%$/)).toBeInTheDocument();
    const plus = screen.getByText(/^\+/);
    expect(plus.closest("span")?.className).toMatch(/amber/);
  });
});

// =============================================================================
// 6. Stock visible en secondary del PRODUCT
// =============================================================================

describe("F1.3 #10-F — affectsStock visible en secondary", () => {
  it("baseline correct: affectsStock=true → texto 'Descuenta stock' en secondary", () => {
    const line = makeLine({
      composition: {
        metal: null, hechura: null,
        products: [{
          costLineId: "cl-p1", catalogItemId: "art-P",
          catalogItemCode: "X", catalogItemName: "Item",
          quantity: 1, unitValue: 100, totalValue: 100, currencyId: null,
          lineAdjKind: null, lineAdjType: null,
          lineAdjValue: null, lineAdjAmount: null,
          affectsStock: true,
        }],
        taxes: [],
      },
    });
    render(<LineAdvancedOverridesPanel line={line} {...baseProps} />);
    expect(screen.getByText(/Descuenta stock/i)).toBeInTheDocument();
  });
});
