// src/components/ui/__tests__/baseline-line-advanced-overrides-panel.test.tsx
// =============================================================================
// LineAdvancedOverridesPanel — tests del bloque "Composición del Precio de
// Venta" en sale view (Factura).
//
// Cubre:
//   · Layout PRECIO VENTA tipo fila inline (Bruto · Descuentos · Neto)
//   · Threshold hasDiscount > 0 (sin descuento → solo Neto)
//   · Tono emerald-500 en Descuentos
//   · Tooltip aclaratorio en label "Descuentos"
//   · Ganancia $ en Rentabilidad (positivo / negativo / null)
//   · Total metal × qty / Total hechura × qty solo cuando qty > 1
//   · Gramos formateados a 2 decimales en sale view summary
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LineAdvancedOverridesPanel } from "../LineAdvancedOverridesPanel";
import type { DocumentLine } from "../../../lib/document-types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeLine(overrides: Partial<DocumentLine> & {
  unitCost?: number;
  metalCost?: number;
  hechuraCost?: number;
  metalSale?: number;
  hechuraSale?: number;
} = {}): DocumentLine {
  const { unitCost, metalCost, hechuraCost, metalSale, hechuraSale, ...rest } = overrides;
  return {
    id:               "line-1",
    type:             "ARTICLE",
    article:          "Anillo Test",
    variant:          "",
    articleId:        "art-1",
    quantity:         2,
    unitPrice:        900,
    discountAmount:   0,
    subtotal:         1800,
    taxAmount:        378,
    lineTotal:        2178,
    lineTotalWithTax: 2178,
    pricingMeta: {
      basePrice:        1000,
      unitPrice:        900,
      composition: {
        metal: {
          appliedGrams:    1.30,
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
      unitCost,
      metalCost,
      hechuraCost,
      metalSale,
      hechuraSale,
    } as any,
    ...rest,
  } as DocumentLine;
}

const noopApply = vi.fn();

// =============================================================================
// 1. PRECIO VENTA — caso CON descuento (fila inline)
// =============================================================================

describe("LineAdvancedOverridesPanel — PRECIO VENTA con descuento", () => {
  it("baseline correct: muestra Bruto, Descuentos y Neto en fila inline", () => {
    render(
      <LineAdvancedOverridesPanel
        line={makeLine({ subtotal: 1800, discountAmount: 200, unitCost: 600 })}
        currency="ARS"
        onApply={noopApply}
        view="sale"
      />,
    );
    // InfoItem renderiza label con ":" — usar regex para ambos casos.
    expect(screen.getByText(/^Bruto:?$/)).toBeInTheDocument();
    expect(screen.getByText(/^Descuentos:?$/)).toBeInTheDocument();
    expect(screen.getByText(/^Neto:?$/)).toBeInTheDocument();
    // Valores
    expect(screen.getByText(/2\.000,00/)).toBeInTheDocument(); // bruto
    expect(screen.getByText(/−.*200,00/)).toBeInTheDocument(); // descuento
    expect(screen.getByText(/1\.800,00/)).toBeInTheDocument(); // neto
    // Subtítulo aclaratorio preservado
    expect(screen.getByText("Neto, sin impuestos")).toBeInTheDocument();
  });

  it("baseline correct: tooltip en wrapper de Descuentos (labelTitle)", () => {
    render(
      <LineAdvancedOverridesPanel
        line={makeLine({ subtotal: 1800, discountAmount: 200, unitCost: 600 })}
        currency="ARS"
        onApply={noopApply}
        view="sale"
      />,
    );
    const descuentosLabel = screen.getByText(/^Descuentos:?$/);
    // labelTitle se aplica al wrapper div del InfoItem.
    const wrapper = descuentosLabel.closest("div[title]");
    expect(wrapper).toBeTruthy();
    expect(wrapper?.getAttribute("title")).toMatch(
      /Total consolidado.*promociones.*bonificaciones.*descuentos/i,
    );
  });

  it("baseline correct: valor de Descuentos lleva tono emerald-500", () => {
    const { container } = render(
      <LineAdvancedOverridesPanel
        line={makeLine({ subtotal: 1800, discountAmount: 200, unitCost: 600 })}
        currency="ARS"
        onApply={noopApply}
        view="sale"
      />,
    );
    // El span del valor es el segundo span dentro del wrapper de Descuentos.
    const emeraldSpan = container.querySelector("span.text-emerald-500");
    expect(emeraldSpan).toBeTruthy();
    expect(emeraldSpan?.textContent).toMatch(/−.*200,00/);
  });

  it("baseline correct: Neto destacado con highlight (font-semibold text-text)", () => {
    render(
      <LineAdvancedOverridesPanel
        line={makeLine({ subtotal: 1800, discountAmount: 200, unitCost: 600 })}
        currency="ARS"
        onApply={noopApply}
        view="sale"
      />,
    );
    const netoLabel = screen.getByText(/^Neto:?$/);
    const valueSpan = netoLabel.nextElementSibling;
    // highlight=true aplica font-semibold + text-text al value span.
    expect(valueSpan?.className).toMatch(/font-semibold/);
    expect(valueSpan?.className).toMatch(/text-text\b/);
  });
});

// =============================================================================
// 2. PRECIO VENTA — caso SIN descuento (UI limpia, solo Neto)
// =============================================================================

describe("LineAdvancedOverridesPanel — PRECIO VENTA sin descuento", () => {
  it("baseline correct: solo Neto + subtítulo, sin Bruto ni Descuentos", () => {
    render(
      <LineAdvancedOverridesPanel
        line={makeLine({
          subtotal:       1000,
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
    // Neto presente
    expect(screen.getByText(/^Neto:?$/)).toBeInTheDocument();
    expect(screen.getByText(/1\.000,00/)).toBeInTheDocument();
    expect(screen.getByText("Neto, sin impuestos")).toBeInTheDocument();
    // Bruto y Descuentos ausentes
    expect(screen.queryByText(/^Bruto:?$/)).toBeNull();
    expect(screen.queryByText(/^Descuentos:?$/)).toBeNull();
  });
});

// =============================================================================
// 3. RENTABILIDAD — Ganancia $ (positivo / negativo / sin costo)
// =============================================================================

describe("LineAdvancedOverridesPanel — RENTABILIDAD ganancia", () => {
  it("baseline correct: ganancia < 0 se renderiza con text-red-500", () => {
    render(
      <LineAdvancedOverridesPanel
        line={makeLine({
          subtotal:       500,
          quantity:       1,
          unitPrice:      500,
          discountAmount: 0,
          unitCost:       800,    // pérdida
        })}
        currency="ARS"
        onApply={noopApply}
        view="sale"
      />,
    );
    const gananciaLabel = screen.getByText(/^Ganancia:?$/);
    const valueSpan = gananciaLabel.nextElementSibling;
    expect(valueSpan?.className).toMatch(/text-red-500/);
  });

  it("baseline correct: ganancia >= 0 NO usa text-red-500", () => {
    render(
      <LineAdvancedOverridesPanel
        line={makeLine({ subtotal: 1800, discountAmount: 0, unitCost: 600 })}
        currency="ARS"
        onApply={noopApply}
        view="sale"
      />,
    );
    const gananciaLabel = screen.getByText(/^Ganancia:?$/);
    const valueSpan = gananciaLabel.nextElementSibling;
    expect(valueSpan?.className).not.toMatch(/text-red-500/);
    expect(valueSpan?.className).toMatch(/text-text\b/);
  });

  it("baseline correct: sin unitCost ni costos parciales, no renderiza Ganancia", () => {
    render(
      <LineAdvancedOverridesPanel
        line={makeLine({ subtotal: 1800, discountAmount: 0 })}
        currency="ARS"
        onApply={noopApply}
        view="sale"
      />,
    );
    expect(screen.queryByText(/^Ganancia:?$/)).toBeNull();
  });
});

// =============================================================================
// 4. METAL — Gramos 2 decimales en sale view
// =============================================================================

describe("LineAdvancedOverridesPanel — METAL gramos formato", () => {
  it("baseline correct: Gramos se renderiza con 2 decimales (no 3) en sale view", () => {
    render(
      <LineAdvancedOverridesPanel
        line={makeLine({ unitCost: 600 })}
        currency="ARS"
        onApply={noopApply}
        view="sale"
      />,
    );
    // appliedGrams=1.30 → "1.30 g" (no "1.300 g")
    expect(screen.getByText("1.30 g")).toBeInTheDocument();
    // No debe aparecer "1.300 g"
    expect(screen.queryByText("1.300 g")).toBeNull();
  });
});

// =============================================================================
// 5. METAL / HECHURA — Total × qty solo cuando qty > 1
// =============================================================================

describe("LineAdvancedOverridesPanel — Total metal/hechura × qty", () => {
  it("baseline correct: Total metal aparece cuando qty > 1 y metalSale existe", () => {
    render(
      <LineAdvancedOverridesPanel
        line={makeLine({
          quantity:  3,
          metalSale: 100,           // per unit
          unitCost:  50,
        })}
        currency="ARS"
        onApply={noopApply}
        view="sale"
      />,
    );
    expect(screen.getByText(/^Total metal:?$/)).toBeInTheDocument();
    // 100 × 3 = 300
    expect(screen.getByText(/^ARS\s+300,00$/)).toBeInTheDocument();
  });

  it("baseline correct: Total hechura aparece cuando qty > 1 y hechuraSale existe", () => {
    render(
      <LineAdvancedOverridesPanel
        line={makeLine({
          quantity:    3,
          hechuraSale: 50,           // per unit
          unitCost:    30,
        })}
        currency="ARS"
        onApply={noopApply}
        view="sale"
      />,
    );
    expect(screen.getByText(/^Total hechura:?$/)).toBeInTheDocument();
    // 50 × 3 = 150
    expect(screen.getByText(/^ARS\s+150,00$/)).toBeInTheDocument();
  });

  it("baseline correct: NO muestra Total metal cuando qty = 1 (evita ruido)", () => {
    render(
      <LineAdvancedOverridesPanel
        line={makeLine({
          quantity:  1,
          unitPrice: 100,
          subtotal:  100,
          metalSale: 100,
          unitCost:  50,
        })}
        currency="ARS"
        onApply={noopApply}
        view="sale"
      />,
    );
    expect(screen.queryByText(/^Total metal:?$/)).toBeNull();
    expect(screen.queryByText(/^Total hechura:?$/)).toBeNull();
    // Pero "Valor venta" sí (no es redundante con qty=1).
    expect(screen.getAllByText(/^Valor venta:?$/).length).toBeGreaterThan(0);
  });

  it("baseline correct: NO muestra Total metal si metalSale es null (sin dato backend)", () => {
    render(
      <LineAdvancedOverridesPanel
        line={makeLine({
          quantity: 5,
          // sin metalSale ni hechuraSale
          unitCost: 50,
        })}
        currency="ARS"
        onApply={noopApply}
        view="sale"
      />,
    );
    expect(screen.queryByText(/^Total metal:?$/)).toBeNull();
    expect(screen.queryByText(/^Total hechura:?$/)).toBeNull();
  });
});

// =============================================================================
// 6. PRECIO VENTA — subtítulo bajo Neto value (flex-col items-end)
// =============================================================================

describe("LineAdvancedOverridesPanel — subtítulo Neto bajo el valor", () => {
  it("baseline correct: subtítulo 'Neto, sin impuestos' es sibling del Neto InfoItem (no del row)", () => {
    render(
      <LineAdvancedOverridesPanel
        line={makeLine({ subtotal: 1800, discountAmount: 200, unitCost: 600 })}
        currency="ARS"
        onApply={noopApply}
        view="sale"
      />,
    );
    const subtitle = screen.getByText("Neto, sin impuestos");
    // El subtítulo vive dentro de un wrapper flex-col que también contiene
    // el InfoItem "Neto" — NO es hermano directo del InfoLineRow.
    const wrapper = subtitle.closest(".flex.flex-col.items-end");
    expect(wrapper).toBeTruthy();
    // El wrapper también contiene el label "Neto:".
    const netoLabel = wrapper?.querySelector("span");
    expect(netoLabel?.textContent).toMatch(/^Neto:/);
  });
});

// =============================================================================
// 7. METAL — Gramos total × qty solo cuando qty > 1
// =============================================================================

describe("LineAdvancedOverridesPanel — Gramos total × qty", () => {
  it("baseline correct: muestra 'Gramos total: 2.60 g' cuando qty=2 y appliedGrams=1.30", () => {
    render(
      <LineAdvancedOverridesPanel
        line={makeLine({ quantity: 2, unitCost: 600 })}
        currency="ARS"
        onApply={noopApply}
        view="sale"
      />,
    );
    expect(screen.getByText(/^Gramos total:?$/)).toBeInTheDocument();
    // 1.30 × 2 = 2.60
    expect(screen.getByText("2.60 g")).toBeInTheDocument();
    // Gramos unitario sigue presente
    expect(screen.getByText("1.30 g")).toBeInTheDocument();
  });

  it("baseline correct: NO muestra 'Gramos total' cuando qty=1 (evita ruido)", () => {
    render(
      <LineAdvancedOverridesPanel
        line={makeLine({
          quantity:  1,
          unitPrice: 1000,
          subtotal:  1000,
          unitCost:  600,
        })}
        currency="ARS"
        onApply={noopApply}
        view="sale"
      />,
    );
    expect(screen.queryByText(/^Gramos total:?$/)).toBeNull();
    // Gramos unitario sigue
    expect(screen.getByText("1.30 g")).toBeInTheDocument();
  });
});

// =============================================================================
// 8. Smoke regresión — bloques existentes siguen renderizando
// =============================================================================

describe("LineAdvancedOverridesPanel — smoke regresión", () => {
  it("baseline correct: Metal, Hechura, Rentabilidad y Precio venta presentes", () => {
    render(
      <LineAdvancedOverridesPanel
        line={makeLine({ subtotal: 1800, discountAmount: 200, unitCost: 600 })}
        currency="ARS"
        onApply={noopApply}
        view="sale"
      />,
    );
    expect(screen.getByText("Composición del precio de venta")).toBeInTheDocument();
    expect(screen.getByText("Metal")).toBeInTheDocument();
    expect(screen.getByText("Hechura")).toBeInTheDocument();
    expect(screen.getByText("Rentabilidad")).toBeInTheDocument();
    expect(screen.getByText("Precio venta")).toBeInTheDocument();
  });
});
