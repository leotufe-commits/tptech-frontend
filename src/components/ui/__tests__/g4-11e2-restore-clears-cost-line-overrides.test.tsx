// src/components/ui/__tests__/g4-11e2-restore-clears-cost-line-overrides.test.tsx
// =============================================================================
// FASE F1.4 #11-E.2 — botón "Restaurar" + detección unificada de overrides.
//
// Cierra el riesgo residual #5 documentado en 11-D:
//   · `hasOverrides` ahora incluye `costLineOverrides.length > 0`.
//   · `handleClearAll` limpia tanto legacy (gramsOverride/etc.) como
//     `costLineOverrides[]` en una sola operación.
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
      },
      ...overrides,
    },
  } as DocumentLine;
}

const baseProps = {
  currency: "ARS",
  onClear: vi.fn(),
  view: "sale" as const,
};

// =============================================================================
// 1. hasOverrides incluye costLineOverrides
// =============================================================================

describe("F1.4 #11-E.2 — hasOverrides detecta costLineOverrides", () => {
  it("baseline correct: solo costLineOverrides activos → botón Restaurar visible", () => {
    const line = makeLine({
      costLineOverrides: [
        { costLineId: "cl-m1", type: "METAL", quantityOverride: 2.5 },
      ],
    });
    render(<LineAdvancedOverridesPanel line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText("Restaurar")).toBeInTheDocument();
  });

  it("baseline correct: sin overrides → botón Restaurar oculto", () => {
    const line = makeLine();
    render(<LineAdvancedOverridesPanel line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.queryByText("Restaurar")).toBeNull();
  });

  it("baseline correct: costLineOverrides vacío → botón Restaurar oculto", () => {
    const line = makeLine({
      costLineOverrides: [],
    });
    render(<LineAdvancedOverridesPanel line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.queryByText("Restaurar")).toBeNull();
  });

  it("baseline correct: legacy gramsOverride + sin costLineOverrides → botón visible", () => {
    const line = makeLine({
      gramsOverride: 5,
    });
    render(<LineAdvancedOverridesPanel line={line} onApply={vi.fn()} {...baseProps} />);
    expect(screen.getByText("Restaurar")).toBeInTheDocument();
  });
});

// =============================================================================
// 2. handleClearAll limpia ambos
// =============================================================================

describe("F1.4 #11-E.2 — handleClearAll limpia legacy + costLineOverrides", () => {
  it("baseline correct: click Restaurar → onApply recibe costLineOverrides=[]", () => {
    const onApply = vi.fn();
    const line = makeLine({
      costLineOverrides: [
        { costLineId: "cl-m1", type: "METAL", quantityOverride: 2.5 },
        { costLineId: "cl-h1", type: "HECHURA", unitValueOverride: 250 },
      ],
    });
    render(<LineAdvancedOverridesPanel line={line} onApply={onApply} {...baseProps} />);
    fireEvent.click(screen.getByText("Restaurar"));
    // Verifica que al menos una llamada incluya costLineOverrides=[].
    const calls = onApply.mock.calls.map(c => c[0]);
    const hasEmpty = calls.some(c =>
      c && Array.isArray(c.costLineOverrides) && c.costLineOverrides.length === 0,
    );
    expect(hasEmpty).toBe(true);
  });

  it("baseline correct: click Restaurar también dispara onClear callback (legacy)", () => {
    const onApply = vi.fn();
    const onClear = vi.fn();
    const line = makeLine({
      costLineOverrides: [{ costLineId: "cl-m1", type: "METAL", quantityOverride: 5 }],
    });
    render(
      <LineAdvancedOverridesPanel
        line={line}
        onApply={onApply}
        onClear={onClear}
        currency="ARS"
        view="sale"
      />,
    );
    fireEvent.click(screen.getByText("Restaurar"));
    expect(onClear).toHaveBeenCalled();
  });
});
