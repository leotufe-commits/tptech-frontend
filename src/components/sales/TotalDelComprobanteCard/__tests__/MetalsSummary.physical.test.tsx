// src/components/sales/TotalDelComprobanteCard/__tests__/MetalsSummary.physical.test.tsx
// =============================================================================
// I1 — Tests del detalle PHYSICAL en MetalsSummary.
//
// Verifica que cuando el redondeo financiero PHYSICAL actuó sobre un metal,
// el componente muestra la sub-fila canónica:
//   "Redondeo financiero · preGrams → postGrams · $/g    +equivalente"
//
// Cero matemática local. El detalle viene de
// documentRoundingSnapshot.breakdown.metalPhysical.metals[]
// (passthrough del backend).
// =============================================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetalsSummary, type MetalPhysicalRoundingDetail } from "../parts/MetalsSummary";
import type { DocumentMetalSummaryItem } from "../types";

function makeMetal(over: Partial<DocumentMetalSummaryItem> = {}): DocumentMetalSummaryItem {
  return {
    id:    over.id   ?? "oro-fino",
    name:  over.name ?? "Oro Fino",
    grams: over.grams ?? 1.0,
    monetaryAmount: over.monetaryAmount,
  };
}

describe("MetalsSummary — I1 detalle PHYSICAL", () => {
  it("SIN physicalRoundedMetals → no muestra sub-fila (comportamiento intacto)", () => {
    render(<MetalsSummary metals={[makeMetal({ grams: 1.526 })]} currencyCode="ARS" />);
    expect(screen.queryByTestId("total-card-metal-physical-row")).toBeNull();
  });

  it("physicalRoundedMetals con delta=0 → NO muestra sub-fila (no aporta info)", () => {
    const physical: MetalPhysicalRoundingDetail[] = [{
      metalParentId:     "oro-fino",
      metalParentName:   "Oro Fino",
      preGrams:          1.0,
      postGrams:         1.0,
      deltaGrams:        0,
      metalPricePerGram: 100000,
      monetaryEquivalent: 0,
    }];
    render(
      <MetalsSummary
        metals={[makeMetal({ grams: 1.0 })]}
        currencyCode="ARS"
        physicalRoundedMetals={physical}
      />,
    );
    expect(screen.queryByTestId("total-card-metal-physical-row")).toBeNull();
  });

  it("physicalRoundedMetals con delta≠0 → muestra sub-fila con preGrams → postGrams y equivalente", () => {
    const physical: MetalPhysicalRoundingDetail[] = [{
      metalParentId:     "oro-fino",
      metalParentName:   "Oro Fino",
      preGrams:          1.526,
      postGrams:         2.0,
      deltaGrams:        0.474,
      metalPricePerGram: 100000,
      monetaryEquivalent: 47400,
    }];
    render(
      <MetalsSummary
        metals={[makeMetal({ grams: 2.0 })]}
        currencyCode="ARS"
        physicalRoundedMetals={physical}
      />,
    );
    const row = screen.getByTestId("total-card-metal-physical-row");
    expect(row).toBeTruthy();
    // Pre → Post visibles
    expect(row.textContent).toMatch(/1[.,]?526.*→.*2[.,]?000/);
    // Equivalente monetario visible (passthrough)
    const equiv = screen.getByTestId("total-card-metal-physical-equiv");
    expect(equiv.textContent).toMatch(/47[.,]?400/);
    expect(equiv.textContent).toMatch(/ARS/);
  });

  it("equivalente negativo → fila con clase discount", () => {
    const physical: MetalPhysicalRoundingDetail[] = [{
      metalParentId:     "oro-fino",
      metalParentName:   "Oro Fino",
      preGrams:          1.526,
      postGrams:         1.0,
      deltaGrams:        -0.526,
      metalPricePerGram: 100000,
      monetaryEquivalent: -52600,
    }];
    render(
      <MetalsSummary
        metals={[makeMetal({ grams: 1.0 })]}
        currencyCode="ARS"
        physicalRoundedMetals={physical}
      />,
    );
    const equiv = screen.getByTestId("total-card-metal-physical-equiv");
    expect(equiv.textContent).toMatch(/-52[.,]?600|52[.,]?600/);
    // El color discount debe estar presente en alguna forma (vt.colors.discount)
    expect(equiv.className).toMatch(/discount|red/);
  });

  it("match por metalParentId tiene prioridad sobre nombre", () => {
    const physical: MetalPhysicalRoundingDetail[] = [{
      metalParentId:     "oro-fino",
      metalParentName:   "Oro 18K (nombre distinto)",
      preGrams:          1.0,
      postGrams:         2.0,
      deltaGrams:        1.0,
      metalPricePerGram: 100000,
      monetaryEquivalent: 100000,
    }];
    render(
      <MetalsSummary
        metals={[makeMetal({ id: "oro-fino", name: "Oro Fino" })]}
        currencyCode="ARS"
        physicalRoundedMetals={physical}
      />,
    );
    expect(screen.getByTestId("total-card-metal-physical-row")).toBeTruthy();
  });

  it("match por nombre cuando id no coincide pero nombres son iguales (case-insensitive)", () => {
    const physical: MetalPhysicalRoundingDetail[] = [{
      metalParentId:     null,
      metalParentName:   "oro fino",  // distinto casing
      preGrams:          1.526,
      postGrams:         2.0,
      deltaGrams:        0.474,
      metalPricePerGram: 100000,
      monetaryEquivalent: 47400,
    }];
    render(
      <MetalsSummary
        metals={[makeMetal({ id: "abc-distinto", name: "Oro Fino" })]}
        currencyCode="ARS"
        physicalRoundedMetals={physical}
      />,
    );
    expect(screen.getByTestId("total-card-metal-physical-row")).toBeTruthy();
  });

  it("data-tp-physical-rounded='true' cuando hay delta, 'false' cuando no", () => {
    const physical: MetalPhysicalRoundingDetail[] = [{
      metalParentId: "oro-fino",
      preGrams: 1.5, postGrams: 2.0, deltaGrams: 0.5,
      metalPricePerGram: 100000, monetaryEquivalent: 50000,
    }];
    render(
      <MetalsSummary
        metals={[
          makeMetal({ id: "oro-fino", name: "Oro Fino" }),
          makeMetal({ id: "plata", name: "Plata" }),
        ]}
        currencyCode="ARS"
        physicalRoundedMetals={physical}
      />,
    );
    expect(screen.getByTestId("total-card-metal-oro-fino").getAttribute("data-tp-physical-rounded")).toBe("true");
    expect(screen.getByTestId("total-card-metal-plata").getAttribute("data-tp-physical-rounded")).toBe("false");
  });
});
