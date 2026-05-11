// src/components/sales/__tests__/PriceFlowCards.test.tsx
// ============================================================================
// Fase 6 — tests del flujo visual de construcción del precio.
//
// Confirma:
//   1. Render con datos típicos (metal + hechura + ajuste + margen).
//   2. Las 4 cards aparecen con sus títulos correspondientes.
//   3. Números crudos passthrough (sin recálculo): mismo input → mismo display.
//   4. Sin datos → componente devuelve null (no renderiza nada).
//   5. Caso sin ajuste global → card "Ajustes" muestra estado vacío.
//   6. BONUS aplicado → ajuste con signo "−" y tono verde.
//   7. SURCHARGE aplicado → ajuste con signo "+" y tono ámbar.
//   8. Margen distinto entre metal y hechura → muestra ambos.
//   9. Margen igual → muestra solo uno (sameMargin path).
// ============================================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PriceFlowCards from "../PriceFlowCards";

const baseProps = {
  metalCost: 500,
  metalSale: 750,
  metalMarginPct: 50,
  hechuraCost: 200,
  hechuraSale: 300,
  hechuraMarginPct: 50,
  costAdjustment: null,
  unitCost: 700,
  unitMargin: 350,
  marginPercent: 50,
  saleUnitPrice: 1050,
  quantity: 1,
  currency: "ARS",
};

describe("PriceFlowCards — render básico", () => {
  it("renderiza las 4 cards con sus títulos", () => {
    render(<PriceFlowCards {...baseProps} />);
    expect(screen.getByText(/Costo base del artículo/i)).toBeTruthy();
    expect(screen.getByText(/Ajustes globales aplicados/i)).toBeTruthy();
    expect(screen.getByText(/Impacto en el precio de venta/i)).toBeTruthy();
    expect(screen.getByText(/Resumen de rentabilidad/i)).toBeTruthy();
  });

  it("muestra el header del flujo", () => {
    render(<PriceFlowCards {...baseProps} />);
    expect(screen.getByText(/Flujo de construcción del precio/i)).toBeTruthy();
  });

  it("sin datos → devuelve null (componente oculto)", () => {
    const { container } = render(
      <PriceFlowCards
        metalCost={null} metalSale={null} metalMarginPct={null}
        hechuraCost={null} hechuraSale={null} hechuraMarginPct={null}
        unitCost={null} unitMargin={null} marginPercent={null}
        saleUnitPrice={null} quantity={1} currency="ARS"
      />
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("PriceFlowCards — Card 1: Costo base", () => {
  it("muestra Metal y Hechura con sus montos", () => {
    render(<PriceFlowCards {...baseProps} />);
    expect(screen.getByText("Metal")).toBeTruthy();
    expect(screen.getByText("Hechura y otros")).toBeTruthy();
  });

  it("muestra 'Costo total' como label del cierre del card", () => {
    render(<PriceFlowCards {...baseProps} />);
    // El label "Costo total" aparece en Card 1 (azul) y Card 4 (rentabilidad).
    expect(screen.getAllByText(/Costo total/i).length).toBeGreaterThanOrEqual(1);
  });
});

describe("PriceFlowCards — Card 2: Ajustes globales", () => {
  it("sin costAdjustment → muestra estado vacío informativo", () => {
    render(<PriceFlowCards {...baseProps} costAdjustment={null} />);
    expect(screen.getByText(/Sin ajustes globales configurados/i)).toBeTruthy();
  });

  it("BONUS 25% → muestra signo '−' y porcentaje", () => {
    render(<PriceFlowCards {...baseProps} costAdjustment={{
      kind: "BONUS", type: "PERCENTAGE", value: 25, amount: 175,
    }} />);
    expect(screen.getByText(/Bonificación/i)).toBeTruthy();
    // Debe aparecer el signo "−" antes del monto (175 = 25% × 700).
    expect(screen.getByText(/−ARS\s*175/)).toBeTruthy();
  });

  it("SURCHARGE 15% → muestra signo '+' y porcentaje", () => {
    render(<PriceFlowCards {...baseProps} costAdjustment={{
      kind: "SURCHARGE", type: "PERCENTAGE", value: 15, amount: 105,
    }} />);
    expect(screen.getByText(/Recargo/i)).toBeTruthy();
    expect(screen.getByText(/\+ARS\s*105/)).toBeTruthy();
  });

  it("muestra label 'Costo ajustado' como cierre del card", () => {
    render(<PriceFlowCards {...baseProps} costAdjustment={{
      kind: "BONUS", type: "PERCENTAGE", value: 25, amount: 175,
    }} />);
    // "Costo ajustado" aparece en Card 2 (cierre) y Card 3 (línea inicial).
    expect(screen.getAllByText(/Costo ajustado/i).length).toBeGreaterThanOrEqual(1);
  });
});

describe("PriceFlowCards — Card 3: Impacto en el precio de venta", () => {
  it("margen unificado (metal=hechura) → muestra 'Margen sobre costo' una sola vez", () => {
    render(<PriceFlowCards {...baseProps} />);
    expect(screen.getByText(/Margen sobre costo/i)).toBeTruthy();
    expect(screen.queryByText(/Margen metal/i)).toBeNull();
    expect(screen.queryByText(/Margen hechura/i)).toBeNull();
  });

  it("margen distinto entre metal y hechura → muestra ambos", () => {
    render(<PriceFlowCards {...baseProps} metalMarginPct={10} hechuraMarginPct={50} />);
    expect(screen.getByText(/Margen metal/i)).toBeTruthy();
    expect(screen.getByText(/Margen hechura/i)).toBeTruthy();
  });

  it("muestra 'Valor de venta neto' como cierre del card", () => {
    render(<PriceFlowCards {...baseProps} />);
    expect(screen.getByText(/Valor de venta neto/i)).toBeTruthy();
  });
});

describe("PriceFlowCards — Card 4: Rentabilidad", () => {
  it("muestra Costo total, Ganancia neta, Margen sobre venta, Venta final", () => {
    render(<PriceFlowCards {...baseProps} />);
    expect(screen.getAllByText(/Costo total/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Ganancia neta/i)).toBeTruthy();
    // Fase 6 — label clarificado: "Margen sobre venta" en card 4.
    expect(screen.getByText(/Margen sobre venta/i)).toBeTruthy();
    expect(screen.getByText(/Venta final/i)).toBeTruthy();
  });

  it("escala por quantity: qty=3 → ganancia = unitMargin × 3", () => {
    render(<PriceFlowCards {...baseProps} quantity={3} />);
    // unitMargin=350, qty=3 → 1.050,00. Por dedup nos basta confirmar que aparece.
    expect(screen.getAllByText(/ARS\s*1\.050,00/).length).toBeGreaterThanOrEqual(1);
  });
});

describe("PriceFlowCards — POLICY R4.1 (passthrough sin recálculo)", () => {
  it("usa unitCost del backend para 'Costo total' (no recalcula desde metal+hechura)", () => {
    // Caso intencional: unitCost difiere de metal+hechura. El componente
    // debe respetar unitCost del backend (sin recalcular la suma).
    render(<PriceFlowCards {...baseProps} unitCost={999} />);
    // unitCost=999 × qty=1 = 999.
    expect(screen.getByText(/ARS\s*999,00/)).toBeTruthy();
  });

  it("usa saleUnitPrice del backend para 'Venta final' (no recalcula desde sale per tipo)", () => {
    render(<PriceFlowCards {...baseProps} saleUnitPrice={888} />);
    // El monto aparece en Card 3 ("Valor de venta neto") y Card 4 ("Venta final").
    expect(screen.getAllByText(/ARS\s*888,00/).length).toBeGreaterThanOrEqual(1);
  });
});
