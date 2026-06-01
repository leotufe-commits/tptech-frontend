// src/components/pricing/PricingStepsBreakdown/__tests__/CommercialRoundingDocBlock.test.tsx
//
// Etapa D' (cierre conceptual) — Render del Redondeo Comercial PER_DOCUMENT
// dentro del card de artículo (`RoundingTaxSection`).
//
// REGLA DE ORO verificada aquí:
//   - El frontend NO recalcula gramos × precio (lee `monetaryEquivalent` del snapshot).
//   - El frontend NO cuenta líneas (lee `appliedToLineCount` del snapshot).
//   - El frontend NO infiere appliedAt (lo lee tal cual).

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoundingTaxSection } from "../parts/RoundingTaxSection";
import type { SalePreviewLine } from "../../../../services/sales";

type Ctx = NonNullable<SalePreviewLine["commercialRoundingContext"]>;

const DEFAULT_DISPLAY = { rate: 1, symbol: "$" };

function baseProps() {
  return {
    rndStep:    undefined,
    hasTaxesL:  false,
    result:     null,
    display:    DEFAULT_DISPLAY,
  } as const;
}

describe("RoundingTaxSection — bloque Redondeo Comercial PER_DOCUMENT", () => {
  it("sin commercialRoundingContext → NO renderiza el bloque PER_DOCUMENT", () => {
    render(<RoundingTaxSection {...baseProps()} />);
    expect(screen.queryByTestId("rts-commercial-doc-rounding")).toBeNull();
  });

  it("commercialRoundingContext null → NO renderiza el bloque", () => {
    render(<RoundingTaxSection {...baseProps()} commercialRoundingContext={null} />);
    expect(screen.queryByTestId("rts-commercial-doc-rounding")).toBeNull();
  });

  it("BREAKDOWN — caso real (saldo 182091.10 → 182100) renderiza passthrough", () => {
    const ctx: Ctx = {
      source:             "PRICE_LIST",
      scope:              "BREAKDOWN",
      appliedAt:          "DOCUMENT",
      appliedToLineCount: 1,
      totalAdjustment:    8.90,
      breakdown: {
        metals: [],
        metalMonetaryEquivalent: 0,
        hechura: {
          preRoundingSaldoMonetario:  182091.10,
          postRoundingSaldoMonetario: 182100,
          deltaSaldoMonetario:        8.90,
          mode:                       "HUNDRED",
          direction:                  "NEAREST",
          source:                     "PRICE_LIST_HECHURA",
        },
        combinedAdjustment: 8.90,
      },
    };
    render(<RoundingTaxSection {...baseProps()} commercialRoundingContext={ctx} />);
    expect(screen.getByTestId("rts-commercial-doc-rounding")).toBeInTheDocument();
    expect(screen.getByTestId("rts-commercial-hechura")).toBeInTheDocument();
    // El badge NO debe aparecer cuando hay solo 1 línea.
    expect(screen.queryByText(/Aplicado a nivel comprobante/i)).toBeNull();
  });

  it("BREAKDOWN con varias líneas → muestra badge 'Aplicado a nivel comprobante'", () => {
    const ctx: Ctx = {
      source:             "PRICE_LIST",
      scope:              "BREAKDOWN",
      appliedAt:          "DOCUMENT",
      appliedToLineCount: 3,        // ← viene del backend, NO de lines.length
      totalAdjustment:    8.90,
      breakdown: {
        metals: [],
        metalMonetaryEquivalent: 0,
        hechura: {
          preRoundingSaldoMonetario:  182091.10,
          postRoundingSaldoMonetario: 182100,
          deltaSaldoMonetario:        8.90,
          mode:                       "HUNDRED",
          direction:                  "NEAREST",
          source:                     "PRICE_LIST_HECHURA",
        },
        combinedAdjustment: 8.90,
      },
    };
    render(<RoundingTaxSection {...baseProps()} commercialRoundingContext={ctx} />);
    expect(screen.getByText(/Aplicado a nivel comprobante \(3 líneas\)/i)).toBeInTheDocument();
  });

  it("BREAKDOWN con metal físico — muestra gramos passthrough + monetaryEquivalent", () => {
    const ctx: Ctx = {
      source:             "PRICE_LIST",
      scope:              "BREAKDOWN",
      appliedAt:          "DOCUMENT",
      appliedToLineCount: 1,
      totalAdjustment:    -2991.10,
      breakdown: {
        metals: [{
          metalParentId:       "OroFino",
          metalParentName:     "Oro Fino",
          preGrams:            1.2375,
          postGrams:           1.2,
          deltaGrams:          -0.0375,
          metalPricePerGram:   80000,
          monetaryEquivalent:  -3000,
          mode:                "DECIMAL_1",
          direction:           "NEAREST",
        }],
        metalMonetaryEquivalent: -3000,
        hechura: {
          preRoundingSaldoMonetario:  182091.10,
          postRoundingSaldoMonetario: 182100,
          deltaSaldoMonetario:        8.90,
          mode:                       "HUNDRED",
          direction:                  "NEAREST",
          source:                     "PRICE_LIST_HECHURA",
        },
        combinedAdjustment: -2991.10,
      },
    };
    render(<RoundingTaxSection {...baseProps()} commercialRoundingContext={ctx} />);
    // El row del metal aparece (testid por metalParentId).
    expect(screen.getByTestId("rts-commercial-metal-OroFino")).toBeInTheDocument();
    expect(screen.getByText(/Oro Fino/)).toBeInTheDocument();
    expect(screen.getByText(/equivalente \$/i)).toBeInTheDocument();
  });

  it("UNIFIED — un solo row monetario", () => {
    const ctx: Ctx = {
      source:             "PRICE_LIST",
      scope:              "UNIFIED",
      appliedAt:          "DOCUMENT",
      appliedToLineCount: 1,
      totalAdjustment:    -8.90,
      unified: {
        pre:        200,
        post:       191.10,
        adjustment: -8.90,
        mode:       "HUNDRED",
        direction:  "DOWN",
      },
    };
    render(<RoundingTaxSection {...baseProps()} commercialRoundingContext={ctx} />);
    expect(screen.getByTestId("rts-commercial-doc-rounding")).toBeInTheDocument();
    // Para UNIFIED no se renderiza el row de hechura (eso es solo BREAKDOWN).
    expect(screen.queryByTestId("rts-commercial-hechura")).toBeNull();
  });

  it("fallback ALL_NONE → NO renderiza nada (capa activa sin movimiento)", () => {
    const ctx: Ctx = {
      source:             "PRICE_LIST",
      scope:              "BREAKDOWN",
      appliedAt:          "DOCUMENT",
      appliedToLineCount: 1,
      totalAdjustment:    0,
      fallback:           "ALL_NONE",
    };
    render(<RoundingTaxSection {...baseProps()} commercialRoundingContext={ctx} />);
    // Helper interno: si !hasMovement → return null.
    expect(screen.queryByTestId("rts-commercial-doc-rounding")).toBeNull();
  });
});
