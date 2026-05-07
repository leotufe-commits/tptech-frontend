// src/components/ui/__tests__/baseline-line-advanced-overrides-panel.test.tsx
// =============================================================================
// FASE 1.2 paso adicional — Mejora de claridad visual de "Composición del
// Precio de Venta" en LineAdvancedOverridesPanel.
//
// Cubre los 3 escenarios visuales solicitados por el usuario:
//   · Con descuento → breakdown Bruto + Descuentos visible
//   · Sin descuento → solo hero (sin ruido visual)
//   · Ganancia negativa → tono red-500
//
// Reglas verificadas:
//   · Bruto = line.subtotal + line.discountAmount  (suma de 2 backend fields)
//   · Descuentos = line.discountAmount             (passthrough G3.1)
//   · Ganancia = salePrice − costTotal             (derivación trivial, mismo
//                                                   nivel que margin %)
//   · Tooltip "Total consolidado de promociones, bonificaciones..." presente
//     en la fila Descuentos (anti-confusión: no es solo promo).
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LineAdvancedOverridesPanel } from "../LineAdvancedOverridesPanel";
import type { DocumentLine } from "../../../lib/document-types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Construye un DocumentLine mínimo con composition (necesaria para que el
 *  panel renderice — `showAny = !!(composition?.metal || composition?.hechura)`). */
function makeLine(overrides: Partial<DocumentLine> & {
  unitCost?: number;
  metalCost?: number;
  hechuraCost?: number;
} = {}): DocumentLine {
  const { unitCost, metalCost, hechuraCost, ...rest } = overrides;
  return {
    id:               "line-1",
    type:             "ARTICLE",
    article:          "Anillo Test",
    variant:          "",
    articleId:        "art-1",
    quantity:         2,
    unitPrice:        900,
    discountAmount:   0,
    subtotal:         1800,         // qty × unitPrice
    taxAmount:        378,
    lineTotal:        2178,
    lineTotalWithTax: 2178,
    pricingMeta: {
      basePrice:        1000,
      unitPrice:        900,
      composition: {
        metal: {
          appliedGrams:    5,
          purity:          0.75,
          metalName:       "Oro 18k",
          variantId:       "mv-1",
          gramsManual:     false,
          mermaManual:     false,
          variantManual:   false,
        },
        hechura: {
          originalAmount: 200,
          appliedAmount:  200,
          manual:         false,
          appliesTo:      "UNIT",
        },
      },
      unitCost:    unitCost,
      metalCost:   metalCost,
      hechuraCost: hechuraCost,
    } as any,
    ...rest,
  } as DocumentLine;
}

const noopApply = vi.fn();

// =============================================================================
// 1. Caso CON descuento — breakdown visible
// =============================================================================

describe("LineAdvancedOverridesPanel — caso CON descuento", () => {
  it("baseline correct: muestra hero NETO + breakdown Bruto/Descuentos", () => {
    // qty=2, basePrice=$1000, unitPrice=$900 → bruto=$2000, neto=$1800, disc=$200
    render(
      <LineAdvancedOverridesPanel
        line={makeLine({
          subtotal:       1800,
          discountAmount: 200,
          unitCost:       600,
        })}
        currency="ARS"
        onApply={noopApply}
        view="sale"
      />,
    );

    // Hero: NETO destacado.
    expect(screen.getByText(/1\.800,00/)).toBeInTheDocument();
    expect(screen.getByText("Neto, sin impuestos")).toBeInTheDocument();

    // Breakdown filas
    expect(screen.getByText("Bruto")).toBeInTheDocument();
    expect(screen.getByText(/2\.000,00/)).toBeInTheDocument();   // bruto
    expect(screen.getByText("Descuentos")).toBeInTheDocument();
    expect(screen.getByText(/−.*200,00/)).toBeInTheDocument();   // -200,00
  });

  it("baseline correct: tooltip aclaratorio en la fila Descuentos", () => {
    render(
      <LineAdvancedOverridesPanel
        line={makeLine({
          subtotal:       1800,
          discountAmount: 200,
          unitCost:       600,
        })}
        currency="ARS"
        onApply={noopApply}
        view="sale"
      />,
    );
    const descuentosLabel = screen.getByText("Descuentos");
    // El title vive en el contenedor padre del label.
    const row = descuentosLabel.closest("div[title]");
    expect(row).toBeTruthy();
    expect(row?.getAttribute("title")).toMatch(
      /Total consolidado.*promociones.*bonificaciones.*descuentos/i,
    );
  });

  it("baseline correct: descuento se renderiza con tono emerald-500 (positivo, beneficio)", () => {
    const { container } = render(
      <LineAdvancedOverridesPanel
        line={makeLine({
          subtotal:       1800,
          discountAmount: 200,
          unitCost:       600,
        })}
        currency="ARS"
        onApply={noopApply}
        view="sale"
      />,
    );
    // El span con el monto del descuento usa text-emerald-500
    const emeraldSpan = container.querySelector("span.text-emerald-500");
    expect(emeraldSpan).toBeTruthy();
    expect(emeraldSpan?.textContent).toMatch(/−.*200,00/);
  });
});

// =============================================================================
// 2. Caso SIN descuento — UI limpia, sin breakdown
// =============================================================================

describe("LineAdvancedOverridesPanel — caso SIN descuento", () => {
  it("baseline correct: solo hero, sin filas Bruto/Descuentos", () => {
    render(
      <LineAdvancedOverridesPanel
        line={makeLine({
          subtotal:       1000,    // qty=1, unitPrice=1000, sin descuento
          quantity:       1,
          unitPrice:      1000,
          discountAmount: 0,
          unitCost:       600,
        })}
        currency="ARS"
        onApply={noopApply}
        view="sale"
      />,
    );

    // Hero presente
    expect(screen.getByText(/1\.000,00/)).toBeInTheDocument();
    expect(screen.getByText("Neto, sin impuestos")).toBeInTheDocument();

    // Breakdown ausente
    expect(screen.queryByText("Bruto")).toBeNull();
    expect(screen.queryByText("Descuentos")).toBeNull();
  });

  it("baseline correct: discountAmount=0 NO dispara breakdown (threshold > 0)", () => {
    render(
      <LineAdvancedOverridesPanel
        line={makeLine({ discountAmount: 0, unitCost: 600 })}
        currency="ARS"
        onApply={noopApply}
        view="sale"
      />,
    );
    expect(screen.queryByText("Bruto")).toBeNull();
  });
});

// =============================================================================
// 3. Caso GANANCIA NEGATIVA — tono red-500
// =============================================================================

describe("LineAdvancedOverridesPanel — caso GANANCIA NEGATIVA", () => {
  it("baseline correct: ganancia < 0 se renderiza con text-red-500", () => {
    // qty=1, subtotal=$500 (operador hizo descuento manual extremo),
    // costTotal = 800 → ganancia = -300
    const { container } = render(
      <LineAdvancedOverridesPanel
        line={makeLine({
          subtotal:       500,
          discountAmount: 0,
          quantity:       1,
          unitPrice:      500,
          unitCost:       800,   // costo > venta = oferta a pérdida
        })}
        currency="ARS"
        onApply={noopApply}
        view="sale"
      />,
    );

    // InfoItem label se renderiza como "Ganancia:" con colon — usar regex.
    expect(screen.getByText(/^Ganancia:?$/)).toBeInTheDocument();
    // El monto negativo aparece (fmtMoney muestra valores negativos con "-").
    expect(screen.getByText(/-.*300,00|−.*300,00/)).toBeInTheDocument();
    // Tono rojo aplicado en el span del valor de Ganancia.
    const labelEl = screen.getByText(/^Ganancia:?$/);
    const valueSpan = labelEl.nextElementSibling;
    expect(valueSpan?.className).toMatch(/text-red-500/);
  });

  it("baseline correct: ganancia >= 0 NO usa text-red-500 (usa text-text)", () => {
    render(
      <LineAdvancedOverridesPanel
        line={makeLine({
          subtotal:       1800,
          discountAmount: 0,
          unitCost:       600,
        })}
        currency="ARS"
        onApply={noopApply}
        view="sale"
      />,
    );
    // InfoItem renderiza label con ":" — usar regex.
    const labelEl = screen.getByText(/^Ganancia:?$/);
    expect(labelEl).toBeInTheDocument();
    const valueSpan = labelEl.nextElementSibling;
    // El span del valor debe usar text-text (no text-red-500).
    expect(valueSpan?.className).not.toMatch(/text-red-500/);
    expect(valueSpan?.className).toMatch(/text-text/);
  });
});

// =============================================================================
// 4. Caso sin costo — Ganancia no se renderiza
// =============================================================================

describe("LineAdvancedOverridesPanel — caso SIN costo (Ganancia null)", () => {
  it("baseline correct: sin unitCost ni metalCost/hechuraCost, no renderiza Ganancia", () => {
    render(
      <LineAdvancedOverridesPanel
        line={makeLine({
          subtotal:       1800,
          discountAmount: 0,
          // Sin unitCost ni metalCost ni hechuraCost
        })}
        currency="ARS"
        onApply={noopApply}
        view="sale"
      />,
    );
    expect(screen.queryByText("Ganancia")).toBeNull();
    expect(screen.queryByText("Costo")).toBeNull();
    // Margen tampoco — pero el hero "Precio venta" sí
    expect(screen.getByText(/1\.800,00/)).toBeInTheDocument();
  });
});

// =============================================================================
// 5. Smoke — no rompe el render existente (Metal/Hechura siguen visibles)
// =============================================================================

describe("LineAdvancedOverridesPanel — smoke regresión", () => {
  it("baseline correct: sigue mostrando bloques Metal y Hechura existentes", () => {
    render(
      <LineAdvancedOverridesPanel
        line={makeLine({
          subtotal:       1800,
          discountAmount: 200,
          unitCost:       600,
        })}
        currency="ARS"
        onApply={noopApply}
        view="sale"
      />,
    );
    // Encabezado del panel
    expect(screen.getByText("Composición del precio de venta")).toBeInTheDocument();
    // Bloques previos siguen ahí
    expect(screen.getByText("Metal")).toBeInTheDocument();
    expect(screen.getByText("Hechura")).toBeInTheDocument();
    // Bloques nuevos también
    expect(screen.getByText("Rentabilidad")).toBeInTheDocument();
    expect(screen.getByText("Precio venta")).toBeInTheDocument();
  });
});
