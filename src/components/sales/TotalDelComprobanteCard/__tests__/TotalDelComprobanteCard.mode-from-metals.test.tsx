// src/components/sales/TotalDelComprobanteCard/__tests__/TotalDelComprobanteCard.mode-from-metals.test.tsx
// =============================================================================
// Bug Etapa C/D3 — desalineación del `mode` visual.
//
// Síntoma reportado:
//   · Card mostraba "Patrimonio metálico" con Oro Fino + Plata.
//   · `ManualAdjustmentSection` renderizaba editor UNIFIED (input único $).
//   · `BalanceModeInline` mostraba label "Unificado".
//
// Causa:
//   El cálculo de `mode` priorizaba el prop `balanceMode` del backend.
//   Cuando el tenant tenía `Sale.balanceMode="UNIFIED"` (default) pero la
//   factura tenía metales en líneas, el card mostraba metales pero los
//   sub-componentes operaban en UNIFIED.
//
// Fix:
//   `mode = hasMetals ? "BREAKDOWN" : (balanceMode ?? "UNIFIED")`.
//   La realidad visual manda. Si hay metales en pantalla → opera BREAKDOWN.
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TotalDelComprobanteCard } from "../TotalDelComprobanteCard";
import type { BalanceBreakdownDTO } from "../../../../services/sales";
import type { DocumentMetalSummaryItem } from "../types";

const noop = () => undefined;

/** El editor de ajuste manual arranca colapsado mostrando el chip
 *  "+ Agregar ajuste manual". El operador click para abrirlo — lo simulamos
 *  para inspeccionar el contenido del editor en los tests. */
function openManualAdjustmentEditor(): void {
  const chip = screen.queryByTestId("total-card-manual-adjustment-open");
  if (chip) fireEvent.click(chip);
}

function bdWithMetals(): BalanceBreakdownDTO {
  return {
    metals: [
      {
        metalParentId:   "oro-fino",
        metalParentName: "Oro Fino",
        gramsOriginal:   8.918,
        purity:          1,
        gramsPure:       8.918,
        quotePriceSnapshot:    100000,
        valuationMonetary:     891800,
        valuationCurrencyCode: "ARS",
        sourceLineIds:   ["L-1"],
      },
      {
        metalParentId:   "plata-925",
        metalParentName: "Plata",
        gramsOriginal:   3.108,
        purity:          0.925,
        gramsPure:       3.108,
        quotePriceSnapshot:    500,
        valuationMonetary:     1554,
        valuationCurrencyCode: "ARS",
        sourceLineIds:   ["L-2"],
      },
    ],
    monetaryBalance: {
      amount: 50000, currencyCode: "ARS", currencyRate: 1, amountBase: 50000,
      components: [
        { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 50000 },
      ],
    },
  };
}

function bdUnifiedNoMetals(): BalanceBreakdownDTO {
  return {
    metals: [],
    monetaryBalance: {
      amount: 1210, currencyCode: "ARS", currencyRate: 1, amountBase: 1210,
      components: [
        { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 1000 },
        { type: "TAX",     group: "TAX",     label: "IVA",     amount: 210 },
      ],
    },
  };
}

const docMetalsForLines: DocumentMetalSummaryItem[] = [
  { id: "oro-fino",  name: "Oro Fino", grams: 8.918, monetaryAmount: 891800 },
  { id: "plata-925", name: "Plata",    grams: 3.108, monetaryAmount: 1554 },
];

// ─────────────────────────────────────────────────────────────────────────
// Caso patológico — el bug reportado.
// ─────────────────────────────────────────────────────────────────────────

describe("TotalDelComprobanteCard — mode visual derivado de metales (bug fix)", () => {
  it("balanceMode=UNIFIED del backend + balanceBreakdown.metals con datos → mode efectivo BREAKDOWN", () => {
    const onChange = vi.fn();
    render(
      <TotalDelComprobanteCard
        totalDocument={943000}
        currencyCode="ARS"
        balanceMode="UNIFIED"          // ← backend dice UNIFIED
        balanceBreakdown={bdWithMetals()} // ← pero hay metales visibles
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noop}
        engineTotal={943000}
        manualAdjustment={null}
        manualAdjustmentDraft={null}
        onManualAdjustmentChange={onChange}
      />,
    );

    // Patrimonio metálico se renderiza.
    expect(screen.getByTestId("total-card-metals-section")).toBeTruthy();

    // Abrir el editor del ajuste manual (chip por defecto).
    openManualAdjustmentEditor();

    // ManualAdjustmentSection en BREAKDOWN: una fila por metal + fila hechura.
    const metalRows = screen.getAllByTestId("total-card-manual-adjustment-metal-row");
    expect(metalRows).toHaveLength(2);
    expect(screen.getByTestId("total-card-manual-adjustment-hechura-row")).toBeTruthy();

    // El editor BREAKDOWN reemplaza al editor UNIFIED:
    // el wrapper específico de la rama UNIFIED del input no se renderiza
    // (queda como descendiente solo del BreakdownEditor).
    expect(screen.getByTestId("total-card-manual-adjustment-breakdown-editor")).toBeTruthy();

    // Header del card refleja modo BREAKDOWN (data-mode en la sección).
    const metalsSection = screen.getByTestId("total-card-metals-section");
    expect(metalsSection.getAttribute("data-mode")).toBe("BREAKDOWN");
  });

  it("balanceMode=UNIFIED + documentMetals (sin balanceBreakdown.metals) → mode BREAKDOWN", () => {
    // Caso clásico cuando el backend devuelve UNIFIED y `balanceBreakdown.metals=[]`,
    // pero el caller derivó metales desde `lines[*].composition.metals[]`.
    const onChange = vi.fn();
    render(
      <TotalDelComprobanteCard
        totalDocument={943000}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnifiedNoMetals()} // metals=[]
        documentMetals={docMetalsForLines}     // derivados de líneas
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noop}
        engineTotal={943000}
        manualAdjustment={null}
        manualAdjustmentDraft={null}
        onManualAdjustmentChange={onChange}
      />,
    );
    openManualAdjustmentEditor();
    expect(screen.getAllByTestId("total-card-manual-adjustment-metal-row")).toHaveLength(2);
  });

  it("balanceMode=UNIFIED SIN metales → mode UNIFIED, editor único, sin filas de metal", () => {
    const onChange = vi.fn();
    render(
      <TotalDelComprobanteCard
        totalDocument={1210}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnifiedNoMetals()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noop}
        engineTotal={1210}
        manualAdjustment={null}
        manualAdjustmentDraft={null}
        onManualAdjustmentChange={onChange}
      />,
    );
    expect(screen.queryByTestId("total-card-manual-adjustment-metal-row")).toBeNull();
    expect(screen.queryByTestId("total-card-manual-adjustment-hechura-row")).toBeNull();
    // El editor UNIFIED queda colapsado por default (chip "+ Agregar ajuste manual"),
    // confirmando que NO se rompió el caso sin metales.
    expect(screen.getByTestId("total-card-manual-adjustment-toggle")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Coherencia: ManualAdjustmentSection ve los MISMOS metales que Patrimonio metálico.
// ─────────────────────────────────────────────────────────────────────────

describe("TotalDelComprobanteCard — coherencia metales (Patrimonio ↔ Ajuste manual)", () => {
  it("breakdownMetals del ajuste manual = metals visibles del Patrimonio metálico", () => {
    const onChange = vi.fn();
    render(
      <TotalDelComprobanteCard
        totalDocument={943000}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={bdWithMetals()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noop}
        engineTotal={943000}
        manualAdjustment={null}
        manualAdjustmentDraft={null}
        onManualAdjustmentChange={onChange}
      />,
    );
    openManualAdjustmentEditor();

    // Recolectamos los metalParentId que aparecen en los rows del editor BREAKDOWN.
    const ids = screen
      .getAllByTestId("total-card-manual-adjustment-metal-row")
      .map((el) => el.getAttribute("data-tp-metal-id") ?? "");

    expect(new Set(ids)).toEqual(new Set(["oro-fino", "plata-925"]));
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Back-compat: el caso explícito BREAKDOWN del backend sigue funcionando.
// ─────────────────────────────────────────────────────────────────────────

describe("TotalDelComprobanteCard — back-compat BREAKDOWN del backend", () => {
  it("balanceMode=BREAKDOWN del backend con metals visibles → mode BREAKDOWN (idempotente)", () => {
    const onChange = vi.fn();
    render(
      <TotalDelComprobanteCard
        totalDocument={943000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdWithMetals()}
        balanceModeOverride={null}
        onBalanceModeOverrideChange={noop}
        engineTotal={943000}
        manualAdjustment={null}
        manualAdjustmentDraft={null}
        onManualAdjustmentChange={onChange}
      />,
    );
    openManualAdjustmentEditor();
    expect(screen.getAllByTestId("total-card-manual-adjustment-metal-row")).toHaveLength(2);
  });
});
