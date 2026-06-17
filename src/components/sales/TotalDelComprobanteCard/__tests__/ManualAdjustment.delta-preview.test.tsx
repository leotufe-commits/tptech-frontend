// src/components/sales/TotalDelComprobanteCard/__tests__/ManualAdjustment.delta-preview.test.tsx
// =============================================================================
// UX del editor de Ajuste Manual de Metales (BREAKDOWN).
//
//   · El input ES un DELTA en gramos: arranca en 0 y lo que se tipea se
//     SUMA / RESTA a los gramos actuales del metal. Emite `deltaGrams`.
//   · "Resultado" en vivo = gramos actuales + delta (display puro). El backend
//     recalcula y clampa (postGrams = max(0, pre + delta)).
//   · Warning no bloqueante ante ajuste inusualmente grande.
//   · Back-compat: un draft viejo con `targetGrams` se muestra como su delta
//     equivalente (target − pre).
//   · El display del snapshot pone el delta como protagonista (Final secundario).
//
// NO toca backend, snapshot ni cálculo — el payload ahora lleva `deltaGrams`
// (soportado de punta a punta por sanitize.ts + buildSnapshot.ts).
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ManualAdjustmentSection } from "../parts/ManualAdjustmentSection";
import type { ManualAdjustmentApiSnapshot } from "../../../../services/sales";

const ORO = { metalParentId: "oro", metalParentName: "Oro", preGrams: 1.10 };

/** Render del editor con un draft que ya trae `deltaGrams` (simula el valor
 *  ingresado por el operador) → el "Resultado" en vivo se deriva como pre+delta. */
function renderEditor(preGrams: number, deltaGrams: number) {
  return render(
    <ManualAdjustmentSection
      mode="BREAKDOWN"
      breakdownMetals={[{ metalParentId: "oro", metalParentName: "Oro", preGrams }]}
      draft={{ scope: "BREAKDOWN", metals: [{ metalParentId: "oro", metalParentName: "Oro", deltaGrams }] }}
      engineTotal={1000}
      displayCurrency="ARS"
      onChange={vi.fn()}
    />,
  );
}

describe("Editor de metal — Resultado en vivo (pre + delta)", () => {
  it("Caso 1: actual 1,10 + delta +0,20 → Resultado 1,30 g, SIN warning", () => {
    renderEditor(1.10, 0.20);
    const preview = screen.getByTestId("total-card-manual-adjustment-delta-preview");
    expect(preview.textContent).toMatch(/1[.,]?30/);   // Resultado (final)
    expect(preview.textContent).toMatch(/\+.*0[.,]?20/); // delta con signo
    expect(screen.queryByTestId("total-card-manual-adjustment-warning")).toBeNull();
  });

  it("Caso 2: actual 1,10 + delta +12,40 → Resultado 13,50 g, CON warning", () => {
    renderEditor(1.10, 12.40);
    const preview = screen.getByTestId("total-card-manual-adjustment-delta-preview");
    expect(preview.textContent).toMatch(/13[.,]?50/);
    expect(screen.getByTestId("total-card-manual-adjustment-warning")).toBeTruthy();
    expect(screen.getByTestId("total-card-manual-adjustment-warning").textContent)
      .toMatch(/inusualmente grande/i);
  });

  it("Caso 3: actual 13,50 + delta −12,15 → Resultado 1,35 g, CON warning", () => {
    renderEditor(13.50, -12.15);
    const preview = screen.getByTestId("total-card-manual-adjustment-delta-preview");
    expect(preview.textContent).toMatch(/1[.,]?35/);
    expect(preview.textContent).toMatch(/[−-].*12[.,]?15/);
    expect(screen.getByTestId("total-card-manual-adjustment-warning")).toBeTruthy();
  });

  it("delta negativo SIN warning (variación moderada): actual 2,00 + delta −0,20", () => {
    renderEditor(2.00, -0.20);
    const preview = screen.getByTestId("total-card-manual-adjustment-delta-preview");
    expect(preview.textContent).toMatch(/1[.,]?80/);     // Resultado
    expect(preview.textContent).toMatch(/[−-].*0[.,]?20/); // delta
    expect(screen.queryByTestId("total-card-manual-adjustment-warning")).toBeNull();
  });

  it("sin movimiento (delta 0) → no muestra Resultado ni warning", () => {
    render(
      <ManualAdjustmentSection
        mode="BREAKDOWN"
        breakdownMetals={[ORO]}
        draft={{ scope: "BREAKDOWN", metals: [{ metalParentId: "oro", metalParentName: "Oro", deltaGrams: 0 }] }}
        engineTotal={1000}
        displayCurrency="ARS"
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("total-card-manual-adjustment-delta-preview")).toBeNull();
    expect(screen.queryByTestId("total-card-manual-adjustment-warning")).toBeNull();
  });

  it("back-compat: un draft con targetGrams se muestra como su delta (target − pre)", () => {
    render(
      <ManualAdjustmentSection
        mode="BREAKDOWN"
        breakdownMetals={[ORO]}
        draft={{ scope: "BREAKDOWN", metals: [{ metalParentId: "oro", metalParentName: "Oro", targetGrams: 1.30 }] }}
        engineTotal={1000}
        displayCurrency="ARS"
        onChange={vi.fn()}
      />,
    );
    // El input muestra el delta equivalente (+0,20) y el Resultado el final (1,30).
    const preview = screen.getByTestId("total-card-manual-adjustment-delta-preview");
    expect(preview.textContent).toMatch(/1[.,]?30/);
    expect(preview.textContent).toMatch(/\+.*0[.,]?20/);
  });
});

describe("Editor de metal — el input emite deltaGrams (no targetGrams)", () => {
  it("editar el input emite { deltaGrams }, NO { targetGrams }", () => {
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
    fireEvent.change(input, { target: { value: "0,30" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls.at(-1)![0];
    expect(last.scope).toBe("BREAKDOWN");
    expect(last.metals[0].deltaGrams).toBeCloseTo(0.30, 2);
    // El editor ya NO emite targetGrams (el backend deriva postGrams = pre + delta).
    expect(last.metals[0].targetGrams).toBeUndefined();
  });
});

describe("Snapshot reordenado (Δ protagonista, snapshot intacto)", () => {
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
