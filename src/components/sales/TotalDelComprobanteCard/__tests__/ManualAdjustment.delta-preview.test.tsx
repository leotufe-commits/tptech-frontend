// src/components/sales/TotalDelComprobanteCard/__tests__/ManualAdjustment.delta-preview.test.tsx
// =============================================================================
// Etapa 2E — UX segura del editor de Ajuste Manual de Metales.
//
//   · "Ajuste resultante" (Δ) en vivo = targetGrams − preGrams (display puro).
//   · Warning no bloqueante ante ajuste inusualmente grande.
//   · El input SIGUE siendo targetGrams (gramos finales) — payload intacto.
//   · El display del snapshot pone el delta como protagonista (Final secundario).
//
// NO toca backend, snapshot, payload ni cálculo.
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ManualAdjustmentSection } from "../parts/ManualAdjustmentSection";
import type { ManualAdjustmentApiSnapshot } from "../../../../services/sales";

const ORO = { metalParentId: "oro", metalParentName: "Oro", preGrams: 1.10 };

/** Render del editor con un draft que ya trae `targetGrams` (simula el valor
 *  ingresado por el operador) → el Δ en vivo se deriva de ese valor. */
function renderEditor(preGrams: number, targetGrams: number) {
  return render(
    <ManualAdjustmentSection
      mode="BREAKDOWN"
      breakdownMetals={[{ metalParentId: "oro", metalParentName: "Oro", preGrams }]}
      draft={{ scope: "BREAKDOWN", metals: [{ metalParentId: "oro", metalParentName: "Oro", targetGrams }] }}
      engineTotal={1000}
      displayCurrency="ARS"
      onChange={vi.fn()}
    />,
  );
}

describe("Etapa 2E — Ajuste resultante (Δ) en vivo", () => {
  it("Caso 1: 1,10 → 1,30 → Δ +0,20 g, SIN warning", () => {
    renderEditor(1.10, 1.30);
    const delta = screen.getByTestId("total-card-manual-adjustment-delta-preview");
    expect(delta.textContent).toMatch(/\+.*0[.,]?20/);
    expect(screen.queryByTestId("total-card-manual-adjustment-warning")).toBeNull();
  });

  it("Caso 2: 1,10 → 13,50 → Δ +12,40 g, CON warning", () => {
    renderEditor(1.10, 13.50);
    const delta = screen.getByTestId("total-card-manual-adjustment-delta-preview");
    expect(delta.textContent).toMatch(/\+.*12[.,]?40/);
    expect(screen.getByTestId("total-card-manual-adjustment-warning")).toBeTruthy();
    expect(screen.getByTestId("total-card-manual-adjustment-warning").textContent)
      .toMatch(/inusualmente grande/i);
  });

  it("Caso 3: 13,50 → 1,35 → Δ −12,15 g, CON warning", () => {
    renderEditor(13.50, 1.35);
    const delta = screen.getByTestId("total-card-manual-adjustment-delta-preview");
    expect(delta.textContent).toMatch(/[−-].*12[.,]?15/);
    expect(screen.getByTestId("total-card-manual-adjustment-warning")).toBeTruthy();
  });

  it("delta negativo SIN warning (variación moderada): 2,00 → 1,80", () => {
    renderEditor(2.00, 1.80);
    const delta = screen.getByTestId("total-card-manual-adjustment-delta-preview");
    expect(delta.textContent).toMatch(/[−-].*0[.,]?20/);
    expect(screen.queryByTestId("total-card-manual-adjustment-warning")).toBeNull();
  });

  it("sin movimiento (target == pre) → no muestra Δ ni warning", () => {
    // Igual a preGrams → no hay ajuste; el draft no tendría entry, pero forzamos
    // el caso de igualdad para confirmar que el Δ no aparece.
    render(
      <ManualAdjustmentSection
        mode="BREAKDOWN"
        breakdownMetals={[ORO]}
        draft={{ scope: "BREAKDOWN", metals: [{ metalParentId: "oro", metalParentName: "Oro", targetGrams: 1.10 }] }}
        engineTotal={1000}
        displayCurrency="ARS"
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("total-card-manual-adjustment-delta-preview")).toBeNull();
    expect(screen.queryByTestId("total-card-manual-adjustment-warning")).toBeNull();
  });
});

describe("Etapa 2E — el input sigue emitiendo targetGrams (payload intacto)", () => {
  it("editar el input emite { targetGrams }, NO { deltaGrams }", () => {
    const onChange = vi.fn();
    render(
      <ManualAdjustmentSection
        mode="BREAKDOWN"
        breakdownMetals={[ORO]}
        engineTotal={1000}
        displayCurrency="ARS"
        onChange={onChange}
      />,
    );
    // Abrir el editor (chip).
    const chip = screen.queryByTestId("total-card-manual-adjustment-open");
    if (chip) fireEvent.click(chip);
    const row = screen.getByTestId("total-card-manual-adjustment-metal-row");
    const input = row.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1,30" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls.at(-1)![0];
    expect(last.scope).toBe("BREAKDOWN");
    expect(last.metals[0].targetGrams).toBeCloseTo(1.30, 2);
    // NO se emite deltaGrams desde el editor (lo deriva el backend).
    expect(last.metals[0].deltaGrams).toBeUndefined();
  });
});

describe("Etapa 2E — snapshot reordenado (Δ protagonista, snapshot intacto)", () => {
  const snapshot: ManualAdjustmentApiSnapshot = {
    scope: "BREAKDOWN",
    breakdown: {
      metals: [{
        metalParentId: "oro", metalParentName: "Oro",
        preGrams: 1.10, postGrams: 1.30, deltaGrams: 0.20,
        metalPricePerGram: 260000, monetaryEquivalent: 52000,
      }],
      monetary: { preAmount: 0, amount: 0, postAmount: 0 },
    },
    totals: { monetaryAdjustment: 0, metalMonetaryEquivalent: 52000, totalMonetaryAdjustment: 52000 },
    audit: { appliedBy: null, appliedAt: "2026-06-08T00:00:00.000Z", reason: null },
  } as ManualAdjustmentApiSnapshot;

  it("muestra Δ +0,20 g como protagonista + impacto + Final 1,30 g", () => {
    render(
      <ManualAdjustmentSection
        mode="BREAKDOWN"
        breakdownMetals={[ORO]}
        snapshot={snapshot}
        engineTotal={1000}
        displayCurrency="ARS"
        onChange={vi.fn()}
      />,
    );
    // Δ protagonista.
    const delta = screen.getByTestId("total-card-manual-metal-delta");
    expect(delta.textContent).toMatch(/\+.*0[.,]?20/);
    // Impacto monetario (del snapshot backend, NO calculado en FE).
    const equiv = screen.getByTestId("total-card-manual-metal-equiv");
    expect(equiv.textContent).toMatch(/52[.,]?000/);
    // Final (postGrams) presente como secundario.
    const row = screen.getByTestId("total-card-manual-metal-row");
    expect(row.textContent).toMatch(/Final:.*1[.,]?30/);
  });
});
