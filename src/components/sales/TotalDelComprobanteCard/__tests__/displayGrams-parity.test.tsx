// src/components/sales/TotalDelComprobanteCard/__tests__/displayGrams-parity.test.tsx
// =============================================================================
// Etapa 2D — separación displayGrams (lado venta) / physicalGrams (físico).
//
// Contrato:
//   · Footer METALES (fila principal) → displayGrams (lado venta = card).
//   · Ajuste manual / cuenta corriente / redondeo físico → physicalGrams.
//   · UNIFICADO → sin bloque METALES.
//
// Caso real auditado:
//   Card 2,29 g  /  Footer 2,29 g  /  Ajuste manual 1,13 g  (físico)
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TotalDelComprobanteCard } from "../TotalDelComprobanteCard";
import { resolveCardMetals } from "../helpers";
import type { BalanceBreakdownDTO } from "../../../../services/sales";
import type { DocumentMetalSummaryItem } from "../types";

const noop = () => undefined;

/** balanceBreakdown con gramsPure FÍSICO = 1,13. */
function balanceFisico(): BalanceBreakdownDTO {
  return {
    metals: [{
      metalParentId:         "oro-fino",
      metalParentName:       "Oro Fino",
      gramsOriginal:         1.13,
      purity:                1,
      gramsPure:             1.13,            // ← físico
      quotePriceSnapshot:    100000,
      valuationMonetary:     113000,
      valuationCurrencyCode: "ARS",
      sourceLineIds:         ["L-1"],
    }],
    monetaryBalance: {
      amount: 0, currencyCode: "ARS", currencyRate: 1, amountBase: 0,
      components: [{ type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 0 }],
    },
  };
}

/** documentMetals derivado por el caller — LADO VENTA = 2,29 (lo que ve el card). */
const docMetalsVenta: DocumentMetalSummaryItem[] = [
  { id: "oro-fino", name: "Oro Fino", grams: 2.29, monetaryAmount: 229000 },
];

describe("Etapa 2D — displayGrams (lado venta) vs physicalGrams (físico)", () => {
  it("resolveCardMetals: grams = físico (1,13), displayGrams = lado venta (2,29)", () => {
    const out = resolveCardMetals(balanceFisico(), docMetalsVenta, null);
    expect(out).toHaveLength(1);
    expect(out[0]?.grams).toBe(1.13);          // físico (manual / CC)
    expect(out[0]?.displayGrams).toBe(2.29);   // lado venta (display)
  });

  it("BREAKDOWN: footer (fila principal) muestra displayGrams (2,29) = card", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={500000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={balanceFisico()}
        documentMetals={docMetalsVenta}
        onBalanceModeOverrideChange={noop}
      />,
    );
    const mainRow = screen.getByTestId("total-card-metal-oro-fino");
    // Gramos formateados (METAL_GRAMS, 3 decimales): lado venta "2,290".
    expect(mainRow.textContent).toMatch(/2[.,]?290/);      // lado venta (displayGrams)
    expect(mainRow.textContent).not.toMatch(/1[.,]?130/);  // NO el físico (1,130) como gramo principal
  });

  it("Ajuste manual: el editor arranca con preGrams FÍSICO (1,13), no displayGrams", () => {
    const onChange = vi.fn();
    render(
      <TotalDelComprobanteCard
        totalDocument={500000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={balanceFisico()}
        documentMetals={docMetalsVenta}
        engineTotal={500000}
        onManualAdjustmentChange={onChange}
        onBalanceModeOverrideChange={noop}
      />,
    );
    const chip = screen.queryByTestId("total-card-manual-adjustment-open");
    if (chip) fireEvent.click(chip);
    const editor = screen.getByTestId("total-card-manual-adjustment-breakdown-editor");
    // "Actual: 1,13 gr" — físico (gramsPure), NO el lado venta 2,29.
    expect(editor.textContent).toMatch(/1[.,]?13/);
    expect(editor.textContent).not.toMatch(/2[.,]?29/);
  });

  it("UNIFICADO: sin bloque METALES (ni display ni físico)", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={500000}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={balanceFisico()}
        documentMetals={docMetalsVenta}
        onBalanceModeOverrideChange={noop}
      />,
    );
    expect(screen.queryByTestId("total-card-metals-section")).toBeNull();
  });

  it("redondeo físico activo: displayGrams SIGUE ganando como gramo principal (fix mixtas 2026-06)", () => {
    // Nuevo contrato (SSOT card↔footer): aun con redondeo financiero PHYSICAL,
    // el gramo PRINCIPAL = displayGrams (lado venta = card). El físico postGrams
    // queda en `grams` para cuenta corriente / sub-filas de redondeo, pero NO
    // reemplaza el gramo grande. Esto corrige el bug de listas mixtas donde el
    // footer caía a gramos físicos.
    const out = resolveCardMetals(
      balanceFisico(),
      docMetalsVenta,                 // lado venta 2,29 — AHORA se adjunta
      { breakdown: { metalDomain: "PHYSICAL" } },  // redondeo físico activo
    );
    expect(out[0]?.grams).toBe(1.13);          // físico intacto (CC / sub-filas)
    expect(out[0]?.displayGrams).toBe(2.29);   // lado venta GANA como principal
  });
});
