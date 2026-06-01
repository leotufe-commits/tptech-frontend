// src/components/sales/TotalDelComprobanteCard/__tests__/MonetarySummary.physical.test.tsx
// =============================================================================
// I2 — Tests del detalle PHYSICAL en MonetarySummary.
//
// Verifica dos paths visuales:
//   (a) Cuando hay component ROUNDING_MONETARY + metalDomain=PHYSICAL:
//       el detalle por metal padre aparece DENTRO del bloque RoundingRow.
//   (b) Cuando NO hay component ROUNDING_MONETARY pero SÍ hay metalPhysical
//       con delta≠0: el detalle aparece como sección dedicada al pie del
//       MonetarySummary (fallback path PHYSICAL puro).
//
// Cero matemática local. Datos vienen de
// documentRoundingSnapshot.breakdown.metalPhysical.
// =============================================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MonetarySummary, type DocumentRoundingAppliedSummary } from "../parts/MonetarySummary";
import type { GroupedComponents } from "../helpers";

function makePhysicalSnapshot(over: Partial<DocumentRoundingAppliedSummary["breakdown"]> = {}): DocumentRoundingAppliedSummary {
  return {
    scope: "BREAKDOWN",
    totalAdjustment: 47400,
    breakdown: {
      metal:   null,
      hechura: null,
      metalDomain: "PHYSICAL",
      metalPhysical: {
        metals: [{
          metalParentId:     "oro-fino",
          metalParentName:   "Oro Fino",
          preGrams:          1.526,
          postGrams:         2.0,
          deltaGrams:        0.474,
          metalPricePerGram: 100000,
          monetaryEquivalent: 47400,
          mode:              "INTEGER",
          direction:         "NEAREST",
          source:            "DOCUMENT_PHYSICAL_ROUNDING",
        }],
        metalMonetaryEquivalent: 47400,
        fallback: null,
      },
      ...over,
    },
  };
}

describe("MonetarySummary — I2 detalle PHYSICAL", () => {
  it("(a) con ROUNDING_MONETARY component + PHYSICAL → detalle DENTRO del RoundingRow", () => {
    // El grupo POST_TAX es el que el motor usa cuando hay rounding del comprobante.
    // El componente ROUNDING_MONETARY debe pasar el filtro de ceros (amount != 0).
    const groups: GroupedComponents[] = [{
      group: "ROUNDING" as any,
      components: [{
        type: "ROUNDING_MONETARY" as any,
        label: "Redondeo",
        amount: 47400,
      } as any],
    }];
    render(
      <MonetarySummary
        groups={groups}
        displayCurrency="ARS"
        documentRoundingApplied={makePhysicalSnapshot()}
        // Necesita totalDocument para que MonetarySummary renderice algo
        // (sino cae a "Sin desglose disponible todavía").
        totalDocument={200000}
      />,
    );
    // La fila principal del rounding (label "Redondeo financiero")
    expect(screen.getByTestId("total-card-component-ROUNDING_MONETARY")).toBeTruthy();
    // El detalle PHYSICAL adentro
    const detail = screen.getByTestId("total-card-rounding-physical-detail");
    expect(detail).toBeTruthy();
    const row = screen.getByTestId("total-card-rounding-physical-metal-row");
    expect(row.textContent).toMatch(/Oro Fino/);
    expect(row.textContent).toMatch(/1[.,]?526.*→.*2[.,]?000/);
    // La sección dedicada NO debe aparecer (evita duplicar)
    expect(screen.queryByTestId("total-card-rounding-physical-section")).toBeNull();
  });

  it("(b) sin ROUNDING_MONETARY pero CON PHYSICAL → sección dedicada al pie (fallback)", () => {
    const groups: GroupedComponents[] = []; // motor no emitió ROUNDING_MONETARY
    render(
      <MonetarySummary
        groups={groups}
        displayCurrency="ARS"
        documentRoundingApplied={makePhysicalSnapshot()}
        // Necesita al menos algo para no caer al "Sin desglose"
        totalDocument={200000}
      />,
    );
    // La sección dedicada debe aparecer
    const section = screen.getByTestId("total-card-rounding-physical-section");
    expect(section).toBeTruthy();
    expect(section.textContent).toMatch(/Redondeo financiero/);
    // La sub-fila con preGrams → postGrams
    const row = screen.getByTestId("total-card-rounding-physical-metal-row");
    expect(row.textContent).toMatch(/Oro Fino/);
    expect(row.textContent).toMatch(/1[.,]?526.*→.*2[.,]?000/);
    // El equivalente monetario
    const equiv = screen.getByTestId("total-card-rounding-physical-metal-equiv");
    expect(equiv.textContent).toMatch(/47[.,]?400/);
  });

  it("metalDomain='MONETARY' → no aparece el detalle PHYSICAL aunque haya metalPhysical en el snapshot", () => {
    const groups: GroupedComponents[] = [];
    const snapshot = makePhysicalSnapshot({ metalDomain: "MONETARY" });
    render(
      <MonetarySummary
        groups={groups}
        displayCurrency="ARS"
        documentRoundingApplied={snapshot}
        totalDocument={200000}
      />,
    );
    expect(screen.queryByTestId("total-card-rounding-physical-section")).toBeNull();
    expect(screen.queryByTestId("total-card-rounding-physical-detail")).toBeNull();
  });

  it("PHYSICAL con todos los deltas=0 → no aparece el detalle (no aporta info)", () => {
    const groups: GroupedComponents[] = [];
    const snapshot: DocumentRoundingAppliedSummary = {
      scope: "BREAKDOWN",
      breakdown: {
        metal: null, hechura: null,
        metalDomain: "PHYSICAL",
        metalPhysical: {
          metals: [{
            metalParentId: "oro-fino",
            preGrams: 1.0, postGrams: 1.0, deltaGrams: 0,
            metalPricePerGram: 100000, monetaryEquivalent: 0,
          }],
          metalMonetaryEquivalent: 0,
        },
      },
    };
    render(
      <MonetarySummary
        groups={groups}
        displayCurrency="ARS"
        documentRoundingApplied={snapshot}
        totalDocument={200000}
      />,
    );
    expect(screen.queryByTestId("total-card-rounding-physical-section")).toBeNull();
  });

  it("sin documentRoundingApplied → no aparece el detalle PHYSICAL", () => {
    const groups: GroupedComponents[] = [];
    render(
      <MonetarySummary
        groups={groups}
        displayCurrency="ARS"
        totalDocument={200000}
      />,
    );
    expect(screen.queryByTestId("total-card-rounding-physical-section")).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// F1 — Tests del bloque REDONDEO COMERCIAL PHYSICAL (por línea)
// ──────────────────────────────────────────────────────────────────────────
// Verifican que MonetarySummary renderiza el bloque "Redondeo comercial"
// cuando recibe `commercialPhysicalMetals` con entries de delta != 0,
// y que NO interfiere con el bloque financiero (pueden coexistir).
// ──────────────────────────────────────────────────────────────────────────

describe("MonetarySummary — F1 bloque REDONDEO COMERCIAL (por línea)", () => {
  it("(F1-a) con commercialPhysicalMetals + delta != 0 → renderiza sección 'Redondeo comercial'", () => {
    render(
      <MonetarySummary
        groups={[]}
        displayCurrency="ARS"
        totalDocument={200000}
        commercialPhysicalMetals={[{
          metalParentId:     "oro-fino",
          metalParentName:   "Oro Fino",
          preGrams:          0.825,
          postGrams:         1.000,
          deltaGrams:        0.175,
          metalPricePerGram: 187500,
          monetaryEquivalent: 32812.5,
          mode:              "INTEGER",
          direction:         "NEAREST",
          source:            "COMMERCIAL_PHYSICAL_ROUNDING",
        }]}
      />,
    );
    const section = screen.getByTestId("total-card-rounding-commercial-physical-section");
    expect(section).toBeTruthy();
    expect(section.textContent).toMatch(/Redondeo comercial/);
    // El componente reutiliza RoundingPhysicalBreakdownRows → el testid de fila
    // es el mismo que usa el bloque financiero.
    const row = section.querySelector('[data-testid="total-card-rounding-physical-metal-row"]');
    expect(row).toBeTruthy();
    expect(row!.textContent).toMatch(/Oro Fino/);
    expect(row!.textContent).toMatch(/0[.,]?825.*→.*1[.,]?000/);
    expect(row!.textContent).toMatch(/32[.,]?812/);
  });

  it("(F1-b) sin commercialPhysicalMetals → bloque NO se renderiza", () => {
    render(
      <MonetarySummary
        groups={[]}
        displayCurrency="ARS"
        totalDocument={200000}
      />,
    );
    expect(screen.queryByTestId("total-card-rounding-commercial-physical-section")).toBeNull();
  });

  it("(F1-c) commercialPhysicalMetals con delta=0 → bloque NO se renderiza (filtra no-info)", () => {
    render(
      <MonetarySummary
        groups={[]}
        displayCurrency="ARS"
        totalDocument={200000}
        commercialPhysicalMetals={[{
          metalParentId: "oro-fino",
          preGrams: 1.0, postGrams: 1.0, deltaGrams: 0,
          metalPricePerGram: 100000, monetaryEquivalent: 0,
        }]}
      />,
    );
    expect(screen.queryByTestId("total-card-rounding-commercial-physical-section")).toBeNull();
  });

  it("(F1-d) commercialPhysicalMetals con MÚLTIPLES líneas (mismo metal padre) → muestra todas las entries", () => {
    // Tres líneas con redondeo del mismo metal padre — cada una se muestra
    // como entry separada (sin agregación frontend).
    render(
      <MonetarySummary
        groups={[]}
        displayCurrency="ARS"
        totalDocument={500000}
        commercialPhysicalMetals={[
          {
            metalParentId: "oro-fino", metalParentName: "Oro Fino",
            preGrams: 0.825, postGrams: 1.0, deltaGrams: 0.175,
            metalPricePerGram: 187500, monetaryEquivalent: 32812.5,
          },
          {
            metalParentId: "oro-fino", metalParentName: "Oro Fino",
            preGrams: 1.526, postGrams: 2.0, deltaGrams: 0.474,
            metalPricePerGram: 100000, monetaryEquivalent: 47400,
          },
          {
            metalParentId: "plata", metalParentName: "Plata",
            preGrams: 5.2, postGrams: 5.0, deltaGrams: -0.2,
            metalPricePerGram: 1500, monetaryEquivalent: -300,
          },
        ]}
      />,
    );
    const section = screen.getByTestId("total-card-rounding-commercial-physical-section");
    const rows = section.querySelectorAll('[data-testid="total-card-rounding-physical-metal-row"]');
    expect(rows.length).toBe(3);
    expect(rows[0]!.textContent).toMatch(/Oro Fino.*0[.,]?825.*→.*1[.,]?000/);
    expect(rows[1]!.textContent).toMatch(/Oro Fino.*1[.,]?526.*→.*2[.,]?000/);
    expect(rows[2]!.textContent).toMatch(/Plata.*5[.,]?200.*→.*5[.,]?000/);
  });

  it("(F1-e) COMERCIAL + FINANCIERO simultáneos → AMBOS bloques se renderizan (no se pisan)", () => {
    render(
      <MonetarySummary
        groups={[]}
        displayCurrency="ARS"
        totalDocument={400000}
        documentRoundingApplied={makePhysicalSnapshot()}     // financiero
        commercialPhysicalMetals={[{                         // comercial
          metalParentId: "plata", metalParentName: "Plata",
          preGrams: 5.2, postGrams: 5.0, deltaGrams: -0.2,
          metalPricePerGram: 1500, monetaryEquivalent: -300,
        }]}
      />,
    );
    // Bloque financiero (de I2)
    expect(screen.getByTestId("total-card-rounding-physical-section")).toBeTruthy();
    // Bloque comercial (de F1)
    expect(screen.getByTestId("total-card-rounding-commercial-physical-section")).toBeTruthy();
    // Verificar contenido distintivo de cada uno
    const finBlock = screen.getByTestId("total-card-rounding-physical-section");
    expect(finBlock.textContent).toMatch(/Redondeo financiero/);
    expect(finBlock.textContent).toMatch(/Oro Fino/);
    const comBlock = screen.getByTestId("total-card-rounding-commercial-physical-section");
    expect(comBlock.textContent).toMatch(/Redondeo comercial/);
    expect(comBlock.textContent).toMatch(/Plata/);
  });

  it("(F1-f) commercialPhysicalMetals con entries null/undefined → filtra y no rompe", () => {
    render(
      <MonetarySummary
        groups={[]}
        displayCurrency="ARS"
        totalDocument={200000}
        commercialPhysicalMetals={[
          null,
          undefined,
          {
            metalParentId: "oro-fino", metalParentName: "Oro Fino",
            preGrams: 0.825, postGrams: 1.0, deltaGrams: 0.175,
            metalPricePerGram: 187500, monetaryEquivalent: 32812.5,
          },
        ]}
      />,
    );
    const rows = screen.getAllByTestId("total-card-rounding-physical-metal-row");
    expect(rows.length).toBe(1);
    expect(rows[0]!.textContent).toMatch(/Oro Fino/);
  });
});
