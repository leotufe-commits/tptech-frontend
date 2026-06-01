// src/components/pricing/CommercialPhysicalRoundingBlock/CommercialPhysicalRoundingBlock.test.tsx
// =============================================================================
// Etapa C-comercial / C6 (POLICY §R-Rounding-14) — Tests del bloque visual
// "Redondeo comercial del metal".
//
// Cubre los tests obligatorios del brief:
//   1. Con `commercialPhysical` no-nulo → muestra bloque.
//   2. Sin `commercialPhysical` ni deltas → NO muestra bloque.
//   3. Muestra 0,908 → 1,000 g.
//   4. Muestra equivalente monetario.
//   5. Muestra delta de hechura.
//   6. NO calcula valores localmente — los lee del backend (cubierto al
//      pasar `metalSalePost ≠ pre + delta` y verificar que renderiza el
//      `post` recibido — sin re-derivar).
//   7. Mismo render en Simulador y Factura (variants `full`/`compact`).
//
// El componente es READ-ONLY. Cero matemática nueva — passthrough estricto.
// =============================================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommercialPhysicalRoundingBlock } from "./CommercialPhysicalRoundingBlock";
import type { CommercialPhysicalSnapshot } from "./types";

const ORO_PRICE = 100000;

function buildSnapshot(): CommercialPhysicalSnapshot {
  return {
    metals: [{
      metalParentId:      "oro-fino",
      metalParentName:    "Oro Fino",
      preGrams:           0.908,
      postGrams:          1.000,
      deltaGrams:         0.092,
      metalPricePerGram:  ORO_PRICE,
      monetaryEquivalent: 9200,
      mode:               "INTEGER",
      direction:          "NEAREST",
      source:             "COMMERCIAL_PHYSICAL_ROUNDING",
      fallback:           null,
    }],
    metalMonetaryEquivalent: 9200,
    fallback:                null,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// (1) (3) (4) Con snapshot — muestra todo
// ──────────────────────────────────────────────────────────────────────────

describe("CommercialPhysicalRoundingBlock — snapshot canónico", () => {
  it("(1) muestra el bloque con header 'Redondeo comercial'", () => {
    render(
      <CommercialPhysicalRoundingBlock
        commercialPhysical={buildSnapshot()}
        metalSalePreRounding={90800}
        metalSalePostRounding={100000}
        metalSaleRoundingDelta={9200}
        currencyCode="ARS"
      />,
    );
    expect(screen.getByTestId("commercial-physical-rounding-block")).toBeTruthy();
    expect(screen.getByText(/^Redondeo comercial$/i)).toBeTruthy();
  });

  it("(3) muestra '0,908 g → 1,000 g' para Oro Fino", () => {
    render(
      <CommercialPhysicalRoundingBlock
        commercialPhysical={buildSnapshot()}
        currencyCode="ARS"
      />,
    );
    expect(screen.getByText(/Oro Fino/i)).toBeTruthy();
    const pre  = screen.getByTestId("cprb-pregrams");
    const post = screen.getByTestId("cprb-postgrams");
    expect(pre.textContent).toMatch(/0,?908/);
    expect(post.textContent).toMatch(/1,?000/);
  });

  it("(3b) muestra Δ +0,092 g", () => {
    render(<CommercialPhysicalRoundingBlock commercialPhysical={buildSnapshot()} />);
    const delta = screen.getByTestId("cprb-deltagrams");
    expect(delta.textContent).toContain("+");
    expect(delta.textContent).toMatch(/0,?092/);
  });

  it("(4) muestra equivalente monetario ARS 9.200", () => {
    render(
      <CommercialPhysicalRoundingBlock
        commercialPhysical={buildSnapshot()}
        currencyCode="ARS"
      />,
    );
    const eq = screen.getByTestId("cprb-equivalent");
    expect(eq.textContent).toContain("ARS");
    expect(eq.textContent).toMatch(/9\.?200/);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// (2) Sin snapshot ni deltas — NO renderiza
// ──────────────────────────────────────────────────────────────────────────

describe("CommercialPhysicalRoundingBlock — sin datos", () => {
  it("(2) sin commercialPhysical y sin deltas → no renderiza nada", () => {
    const { container } = render(<CommercialPhysicalRoundingBlock />);
    expect(container.firstChild).toBeNull();
  });

  it("(2b) commercialPhysical=null + deltas=null → no renderiza", () => {
    const { container } = render(
      <CommercialPhysicalRoundingBlock
        commercialPhysical={null}
        metalSalePreRounding={null}
        metalSaleRoundingDelta={null}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("(2c) commercialPhysical con metals=[] y sin deltas → no renderiza", () => {
    const { container } = render(
      <CommercialPhysicalRoundingBlock
        commercialPhysical={{ metals: [], metalMonetaryEquivalent: 0, fallback: "NO_METALS_TO_ROUND" }}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// (5) Hechura con delta monetario
// ──────────────────────────────────────────────────────────────────────────

describe("CommercialPhysicalRoundingBlock — fila Hechura", () => {
  it("(5) muestra fila 'Hechura: ARS 14.987,50 → ARS 15.000  (+ARS 12,50)'", () => {
    render(
      <CommercialPhysicalRoundingBlock
        commercialPhysical={buildSnapshot()}
        metalSalePreRounding={90800}
        metalSalePostRounding={100000}
        metalSaleRoundingDelta={9200}
        hechuraSalePreRounding={14987.5}
        hechuraSalePostRounding={15000}
        hechuraSaleRoundingDelta={12.5}
        currencyCode="ARS"
      />,
    );
    const row = screen.getByTestId("cprb-hechura-subtotal");
    expect(row.textContent).toContain("Hechura");
    expect(row.textContent).toMatch(/14\.?987/);
    expect(row.textContent).toMatch(/15\.?000/);
    expect(row.textContent).toMatch(/\+/);
    expect(row.textContent).toMatch(/12,?50/);
  });

  it("(5b) hechura con delta = 0 → no muestra fila", () => {
    render(
      <CommercialPhysicalRoundingBlock
        commercialPhysical={buildSnapshot()}
        hechuraSalePreRounding={15000}
        hechuraSalePostRounding={15000}
        hechuraSaleRoundingDelta={0}
        currencyCode="ARS"
      />,
    );
    expect(screen.queryByTestId("cprb-hechura-subtotal")).toBeNull();
  });

  it("(5c) hechura delta != 0 pero falta pre o post → no muestra fila", () => {
    render(
      <CommercialPhysicalRoundingBlock
        commercialPhysical={buildSnapshot()}
        hechuraSalePreRounding={null}
        hechuraSalePostRounding={15000}
        hechuraSaleRoundingDelta={12.5}
      />,
    );
    expect(screen.queryByTestId("cprb-hechura-subtotal")).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// (6) No calcula localmente — usa el `post` recibido del backend
// ──────────────────────────────────────────────────────────────────────────

describe("CommercialPhysicalRoundingBlock — no calcula local", () => {
  it("(6) si pre=90.000, delta=+9.200 y post recibido=100.000 (≠ pre+delta), renderiza 100.000 — confirma uso de `post` recibido", () => {
    // Caso patológico: si el frontend sumara `pre + delta` mostraría 99.200.
    // El test confirma que renderiza el `post` recibido (100.000) — sin
    // matemática local.
    render(
      <CommercialPhysicalRoundingBlock
        commercialPhysical={buildSnapshot()}
        metalSalePreRounding={90000}
        metalSalePostRounding={100000}
        metalSaleRoundingDelta={9200}
        currencyCode="ARS"
      />,
    );
    const row = screen.getByTestId("cprb-metal-subtotal");
    // Renderea el `post` que recibió (100.000), no `pre + delta` (99.200).
    expect(row.textContent).toMatch(/100\.?000/);
    expect(row.textContent).not.toMatch(/99\.?200/);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// (7) Variants full / compact — mismo contenido visible
// ──────────────────────────────────────────────────────────────────────────

describe("CommercialPhysicalRoundingBlock — paridad Simulador (full) ↔ Factura (compact)", () => {
  it("(7) full y compact renderizan los mismos testids/contenido relevante", () => {
    const propsBase = {
      commercialPhysical: buildSnapshot(),
      metalSalePreRounding: 90800,
      metalSalePostRounding: 100000,
      metalSaleRoundingDelta: 9200,
      currencyCode: "ARS",
    };
    const { container: fullC, unmount: unmF } = render(
      <CommercialPhysicalRoundingBlock {...propsBase} variant="full" />,
    );
    const fullText = (fullC.firstChild as HTMLElement).textContent ?? "";
    unmF();
    const { container: compactC } = render(
      <CommercialPhysicalRoundingBlock {...propsBase} variant="compact" />,
    );
    const compactText = (compactC.firstChild as HTMLElement).textContent ?? "";
    // Contenido semántico idéntico (pre, post, delta, equivalente, header).
    for (const fragment of ["Redondeo comercial", "Oro Fino", "0,908", "1,000", "9.200", "ARS"]) {
      expect(fullText).toContain(fragment);
      expect(compactText).toContain(fragment);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Edge case — múltiples metales padre
// ──────────────────────────────────────────────────────────────────────────

describe("CommercialPhysicalRoundingBlock — múltiples padres", () => {
  it("renderiza Oro Fino + Plata con sus deltas independientes", () => {
    const snap: CommercialPhysicalSnapshot = {
      metals: [
        {
          metalParentId: "oro-fino", metalParentName: "Oro Fino",
          preGrams: 0.908, postGrams: 1.000, deltaGrams: 0.092,
          metalPricePerGram: 100000, monetaryEquivalent: 9200,
          mode: "INTEGER", direction: "NEAREST",
          source: "COMMERCIAL_PHYSICAL_ROUNDING", fallback: null,
        },
        {
          metalParentId: "plata", metalParentName: "Plata",
          preGrams: 5.250, postGrams: 5.000, deltaGrams: -0.250,
          metalPricePerGram: 500, monetaryEquivalent: -125,
          mode: "HALF", direction: "DOWN",
          source: "COMMERCIAL_PHYSICAL_ROUNDING", fallback: null,
        },
      ],
      metalMonetaryEquivalent: 9075,
      fallback: null,
    };
    render(<CommercialPhysicalRoundingBlock commercialPhysical={snap} currencyCode="ARS" />);
    expect(screen.getByTestId("cprb-metal-row-oro-fino")).toBeTruthy();
    expect(screen.getByTestId("cprb-metal-row-plata")).toBeTruthy();
    expect(screen.getByText(/Oro Fino/i)).toBeTruthy();
    expect(screen.getByText(/Plata/i)).toBeTruthy();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Edge case — fallback per-entry
// ──────────────────────────────────────────────────────────────────────────

describe("CommercialPhysicalRoundingBlock — fallback per entry", () => {
  it("metal sin redondeo (NO_CONFIG) muestra mensaje informativo", () => {
    const snap: CommercialPhysicalSnapshot = {
      metals: [{
        metalParentId: "oro-fino", metalParentName: "Oro Fino",
        preGrams: 0.908, postGrams: 0.908, deltaGrams: 0,
        metalPricePerGram: 100000, monetaryEquivalent: 0,
        mode: "NONE", direction: "NEAREST",
        source: "COMMERCIAL_PHYSICAL_ROUNDING", fallback: "NO_CONFIG",
      }],
      metalMonetaryEquivalent: 0,
      fallback: null,
    };
    render(<CommercialPhysicalRoundingBlock commercialPhysical={snap} />);
    expect(screen.getByTestId("cprb-metal-fallback").textContent).toContain("no config");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// MONETARY legacy — sin snapshot PHYSICAL pero con deltas monetarios.
// Cubre el caso donde la lista de precios opera con redondeo MONETARY
// (default histórico): el motor emite metalSale*Rounding* / hechuraSale*Rounding*
// pero physical == null. La sección "Redondeo comercial" debe renderizarse igual.
// ──────────────────────────────────────────────────────────────────────────

describe("CommercialPhysicalRoundingBlock — MONETARY (physical == null)", () => {
  it("renderiza fila Metal cuando hay metalSaleRoundingDelta y physical == null", () => {
    render(
      <CommercialPhysicalRoundingBlock
        commercialPhysical={null}
        metalSalePreRounding={90755.5}
        metalSalePostRounding={90755}
        metalSaleRoundingDelta={-0.5}
        currencyCode="ARS"
      />,
    );
    expect(screen.getByTestId("commercial-physical-rounding-block")).toBeTruthy();
    expect(screen.getByText(/^Redondeo comercial$/i)).toBeTruthy();
    const row = screen.getByTestId("cprb-metal-subtotal");
    expect(row.textContent).toContain("Metal");
    expect(row.textContent).toMatch(/90\.?755/);
    expect(row.textContent).toMatch(/−/); // signo menos tipográfico para delta negativo
    // No debe haber lista de metales físicos.
    expect(screen.queryByTestId("cprb-metals-list")).toBeNull();
    // No debe haber fila de hechura.
    expect(screen.queryByTestId("cprb-hechura-subtotal")).toBeNull();
  });

  it("renderiza fila Hechura cuando hay hechuraSaleRoundingDelta y physical == null", () => {
    render(
      <CommercialPhysicalRoundingBlock
        commercialPhysical={null}
        hechuraSalePreRounding={855047.25}
        hechuraSalePostRounding={855000}
        hechuraSaleRoundingDelta={-47.25}
        currencyCode="ARS"
      />,
    );
    expect(screen.getByTestId("commercial-physical-rounding-block")).toBeTruthy();
    expect(screen.getByText(/^Redondeo comercial$/i)).toBeTruthy();
    const row = screen.getByTestId("cprb-hechura-subtotal");
    expect(row.textContent).toContain("Hechura");
    expect(row.textContent).toMatch(/855\.?047/);
    expect(row.textContent).toMatch(/855\.?000/);
    expect(row.textContent).toMatch(/47,?25/);
    // No debe haber fila de metal.
    expect(screen.queryByTestId("cprb-metal-subtotal")).toBeNull();
  });

  it("renderiza ambas filas (Metal + Hechura) cuando ambos deltas existen y physical == null", () => {
    render(
      <CommercialPhysicalRoundingBlock
        commercialPhysical={null}
        metalSalePreRounding={90755.5}
        metalSalePostRounding={90755}
        metalSaleRoundingDelta={-0.5}
        hechuraSalePreRounding={855047.25}
        hechuraSalePostRounding={855000}
        hechuraSaleRoundingDelta={-47.25}
        currencyCode="ARS"
      />,
    );
    expect(screen.getByTestId("cprb-metal-subtotal")).toBeTruthy();
    expect(screen.getByTestId("cprb-hechura-subtotal")).toBeTruthy();
    expect(screen.getByText(/^Redondeo comercial$/i)).toBeTruthy();
  });

  it("oculta el bloque cuando ambos deltas son 0/null y physical == null", () => {
    const { container, rerender } = render(
      <CommercialPhysicalRoundingBlock
        commercialPhysical={null}
        metalSaleRoundingDelta={0}
        hechuraSaleRoundingDelta={0}
      />,
    );
    expect(container.firstChild).toBeNull();

    rerender(
      <CommercialPhysicalRoundingBlock
        commercialPhysical={null}
        metalSaleRoundingDelta={null}
        hechuraSaleRoundingDelta={null}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("no rompe el render PHYSICAL existente cuando además hay deltas monetarios", () => {
    // Caso mixto: lista PHYSICAL canónica + también emite los deltas monetarios.
    // Debe seguir mostrando la lista de metales padre Y las filas pre/post.
    render(
      <CommercialPhysicalRoundingBlock
        commercialPhysical={buildSnapshot()}
        metalSalePreRounding={90800}
        metalSalePostRounding={100000}
        metalSaleRoundingDelta={9200}
        hechuraSalePreRounding={14987.5}
        hechuraSalePostRounding={15000}
        hechuraSaleRoundingDelta={12.5}
        currencyCode="ARS"
      />,
    );
    // PHYSICAL: lista de metales padre con gramos.
    expect(screen.getByTestId("cprb-metals-list")).toBeTruthy();
    expect(screen.getByTestId("cprb-metal-row-oro-fino")).toBeTruthy();
    // MONETARY: subtotales pre/post de metal y hechura.
    expect(screen.getByTestId("cprb-metal-subtotal")).toBeTruthy();
    expect(screen.getByTestId("cprb-hechura-subtotal")).toBeTruthy();
  });
});
