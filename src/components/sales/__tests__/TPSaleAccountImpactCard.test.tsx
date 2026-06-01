// src/components/sales/__tests__/TPSaleAccountImpactCard.test.tsx
// =============================================================================
// Etapa A.5 — Tests del card limpio "Impacto en cuenta corriente".
//
// Reglas testeadas:
//   · Read-only: passthrough de props, sin matemática.
//   · NO usa balanceBefore mock.
//   · Muestra nota informativa transitoria.
//   · UNIFIED: total / cobrado / saldo pendiente.
//   · BREAKDOWN: bloque adicional con metales padre + saldo monetario.
//   · Origen estático "Factura de venta" override-able.
//   · Saldo pendiente cambia de color según signo.
//   · Sin metales en BREAKDOWN → mensaje "Sin metales en este comprobante".
// =============================================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TPSaleAccountImpactCard } from "../TPSaleAccountImpactCard";
import type { BalanceBreakdownDTO } from "../../../services/sales";

const breakdownUnified: BalanceBreakdownDTO = {
  metals: [],
  monetaryBalance: {
    amount: 1210,
    currencyCode: "ARS",
    currencyRate: 1,
    amountBase: 1210,
  },
};

const breakdownWithMetals: BalanceBreakdownDTO = {
  metals: [
    {
      metalParentId:    "oro-fino",
      metalParentName:  "Oro Fino",
      gramsOriginal:    4.20,
      purity:           0.66,
      gramsPure:        2.77,
      quotePriceSnapshot:    100,
      valuationMonetary:     277,
      valuationCurrencyCode: "ARS",
      sourceLineIds:    ["L-1"],
    },
    {
      metalParentId:    "plata-925",
      metalParentName:  "Plata",
      gramsOriginal:    2.64,
      purity:           0.925,
      gramsPure:        2.44,
      quotePriceSnapshot:    5,
      valuationMonetary:     12.2,
      valuationCurrencyCode: "ARS",
      sourceLineIds:    ["L-4"],
    },
  ],
  monetaryBalance: {
    amount: 25000,
    currencyCode: "ARS",
    currencyRate: 1,
    amountBase: 25000,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Render base
// ─────────────────────────────────────────────────────────────────────────────

describe("TPSaleAccountImpactCard — render base", () => {
  it("muestra Total / Cobrado / Saldo pendiente con valores passthrough", () => {
    render(
      <TPSaleAccountImpactCard
        totalDocument={1000}
        paidAmount={300}
        balancePending={700}
        currencyCode="ARS"
        balanceMode="UNIFIED"
        balanceBreakdown={breakdownUnified}
      />,
    );
    const total   = screen.getByTestId("account-impact-total");
    const paid    = screen.getByTestId("account-impact-paid");
    const pending = screen.getByTestId("account-impact-pending");
    expect(total.textContent).toMatch(/ARS.*1\.000|ARS.*1,000|ARS.*1000/);
    expect(paid.textContent).toMatch(/ARS/);
    expect(pending.textContent).toMatch(/ARS/);
  });

  it("Cobrado=0 → muestra guión en vez del 0,00", () => {
    render(
      <TPSaleAccountImpactCard
        totalDocument={1000}
        paidAmount={0}
        balancePending={1000}
        currencyCode="ARS"
      />,
    );
    expect(screen.getByTestId("account-impact-paid").textContent).toBe("—");
  });

  it("muestra la nota informativa transitoria sobre el impacto definitivo", () => {
    render(
      <TPSaleAccountImpactCard
        totalDocument={100}
        paidAmount={0}
        balancePending={100}
      />,
    );
    const note = screen.getByTestId("account-impact-note");
    expect(note.textContent).toMatch(/impacto definitivo se calculará al confirmar\/cobrar/i);
  });

  it("muestra modo + origen en el header", () => {
    render(
      <TPSaleAccountImpactCard
        totalDocument={100}
        paidAmount={0}
        balancePending={100}
        balanceMode="UNIFIED"
      />,
    );
    expect(screen.getByTestId("account-impact-mode").textContent).toBe("Unificado");
    expect(screen.getByTestId("account-impact-origin").textContent).toBe("Factura de venta");
  });

  it("origen override-able vía prop", () => {
    render(
      <TPSaleAccountImpactCard
        totalDocument={100}
        paidAmount={0}
        balancePending={100}
        originLabel="Presupuesto"
      />,
    );
    expect(screen.getByTestId("account-impact-origin").textContent).toBe("Presupuesto");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// NO mock: ausencia de "saldo antes" / "saldo después"
// ─────────────────────────────────────────────────────────────────────────────

describe("TPSaleAccountImpactCard — sin mock de saldo previo", () => {
  it("NO renderiza fila 'Saldo antes' ni 'Saldo después' (Etapa A.5: sin balanceBefore mock)", () => {
    render(
      <TPSaleAccountImpactCard
        totalDocument={1000}
        paidAmount={0}
        balancePending={1000}
        balanceMode="UNIFIED"
      />,
    );
    expect(screen.queryByText(/saldo antes/i)).toBeNull();
    expect(screen.queryByText(/saldo después/i)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Color del saldo pendiente
// ─────────────────────────────────────────────────────────────────────────────

describe("TPSaleAccountImpactCard — color del saldo pendiente", () => {
  it("balance > 0 → color ámbar (queda saldo por cobrar)", () => {
    render(
      <TPSaleAccountImpactCard
        totalDocument={1000}
        paidAmount={500}
        balancePending={500}
      />,
    );
    const pending = screen.getByTestId("account-impact-pending");
    expect(pending.className).toMatch(/text-amber/);
  });

  it("balance = 0 → color esmeralda (comprobante cubierto)", () => {
    render(
      <TPSaleAccountImpactCard
        totalDocument={1000}
        paidAmount={1000}
        balancePending={0}
      />,
    );
    const pending = screen.getByTestId("account-impact-pending");
    expect(pending.className).toMatch(/text-emerald/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BREAKDOWN — preparado para metales + resto monetario
// ─────────────────────────────────────────────────────────────────────────────

describe("TPSaleAccountImpactCard — modo BREAKDOWN", () => {
  it("BREAKDOWN con metales → muestra fila por metal padre + saldo monetario", () => {
    render(
      <TPSaleAccountImpactCard
        totalDocument={50000}
        paidAmount={0}
        balancePending={50000}
        balanceMode="BREAKDOWN"
        balanceBreakdown={breakdownWithMetals}
        currencyCode="ARS"
      />,
    );
    expect(screen.getByTestId("account-impact-breakdown")).toBeTruthy();
    expect(screen.getByTestId("account-impact-metal-oro-fino")).toBeTruthy();
    expect(screen.getByTestId("account-impact-metal-plata-925")).toBeTruthy();
    expect(screen.getByText("Oro Fino")).toBeTruthy();
    expect(screen.getByText("Plata")).toBeTruthy();
    expect(screen.getByTestId("account-impact-monetary")).toBeTruthy();
    expect(screen.getByText("Saldo monetario")).toBeTruthy();
  });

  it("BREAKDOWN sin metales → muestra mensaje 'Sin metales en este comprobante'", () => {
    render(
      <TPSaleAccountImpactCard
        totalDocument={100}
        paidAmount={0}
        balancePending={100}
        balanceMode="BREAKDOWN"
        balanceBreakdown={{
          metals: [],
          monetaryBalance: {
            amount: 100, currencyCode: "ARS", currencyRate: 1, amountBase: 100,
          },
        }}
      />,
    );
    expect(screen.getByTestId("account-impact-breakdown")).toBeTruthy();
    expect(screen.getByText(/sin metales en este comprobante/i)).toBeTruthy();
    expect(screen.getByTestId("account-impact-monetary")).toBeTruthy();
  });

  it("UNIFIED → NO renderiza el bloque desglose (regla obligatoria)", () => {
    render(
      <TPSaleAccountImpactCard
        totalDocument={1000}
        paidAmount={0}
        balancePending={1000}
        balanceMode="UNIFIED"
        balanceBreakdown={breakdownUnified}
      />,
    );
    expect(screen.queryByTestId("account-impact-breakdown")).toBeNull();
  });

  it("inferencia: sin balanceMode + metals=[] → UNIFIED (no muestra desglose)", () => {
    render(
      <TPSaleAccountImpactCard
        totalDocument={1000}
        paidAmount={0}
        balancePending={1000}
        balanceBreakdown={breakdownUnified}
      />,
    );
    expect(screen.getByTestId("account-impact-mode").textContent).toBe("Unificado");
    expect(screen.queryByTestId("account-impact-breakdown")).toBeNull();
  });

  it("inferencia: sin balanceMode + metals=[oro, plata] → BREAKDOWN (muestra desglose)", () => {
    render(
      <TPSaleAccountImpactCard
        totalDocument={50000}
        paidAmount={0}
        balancePending={50000}
        balanceBreakdown={breakdownWithMetals}
      />,
    );
    expect(screen.getByTestId("account-impact-mode").textContent).toBe("Desglosado");
    expect(screen.getByTestId("account-impact-breakdown")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Moneda
// ─────────────────────────────────────────────────────────────────────────────

describe("TPSaleAccountImpactCard — moneda", () => {
  it("usa currencyCode prop si está, sino cae al del breakdown", () => {
    const { unmount } = render(
      <TPSaleAccountImpactCard
        totalDocument={100}
        paidAmount={0}
        balancePending={100}
        currencyCode="USD"
        balanceBreakdown={breakdownUnified}
      />,
    );
    expect(screen.getByTestId("account-impact-total").textContent).toMatch(/USD/);
    unmount();
    render(
      <TPSaleAccountImpactCard
        totalDocument={100}
        paidAmount={0}
        balancePending={100}
        balanceBreakdown={breakdownUnified}
      />,
    );
    // Sin prop currencyCode → usa el del breakdown (ARS).
    expect(screen.getByTestId("account-impact-total").textContent).toMatch(/ARS/);
  });
});
