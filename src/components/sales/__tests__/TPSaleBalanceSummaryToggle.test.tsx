// src/components/sales/__tests__/TPSaleBalanceSummaryToggle.test.tsx
// =============================================================================
// Fase 4.3 — Tests del wrapper de visibilidad.
//
// Reglas testeadas:
//   · UNIFIED → card oculto por defecto; toggle muestra/oculta.
//   · UNIFIED + defaultShownInUnified=true → card visible al montar.
//   · BREAKDOWN → card SIEMPRE visible; NO se renderiza el toggle.
//   · Sin balanceBreakdown → no renderiza nada (back-compat).
//   · La preferencia es local del componente (no persiste fuera).
// =============================================================================

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TPSaleBalanceSummaryToggle } from "../TPSaleBalanceSummaryToggle";
import type { BalanceBreakdownDTO } from "../../../services/sales";

function unifiedBd(): BalanceBreakdownDTO {
  return {
    metals: [],
    monetaryBalance: {
      amount:       1210,
      currencyCode: "ARS",
      currencyRate: 1,
      amountBase:   1210,
      components: [
        { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 1000 },
        { type: "TAX",     group: "TAX",     label: "IVA",     amount: 210 },
      ],
    },
  };
}

function breakdownBd(): BalanceBreakdownDTO {
  return {
    metals: [
      {
        metalParentId:    "oro-fino",
        metalParentName:  "Oro Fino",
        gramsOriginal:    1,
        purity:           0.75,
        gramsPure:        0.75,
        quotePriceSnapshot:    100,
        valuationMonetary:     75,
        valuationCurrencyCode: "USD",
        sourceLineIds:    ["L-1"],
      },
    ],
    monetaryBalance: {
      amount: 25, currencyCode: "USD", currencyRate: 1, amountBase: 25,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED — oculto por defecto + toggle
// ─────────────────────────────────────────────────────────────────────────────

describe("TPSaleBalanceSummaryToggle — UNIFIED", () => {
  it("card oculto por defecto en UNIFIED, toggle visible", () => {
    render(
      <TPSaleBalanceSummaryToggle
        balanceMode="UNIFIED"
        balanceBreakdown={unifiedBd()}
      />,
    );
    // El botón toggle existe.
    expect(screen.getByTestId("balance-toggle-button")).toBeTruthy();
    expect(screen.getByText("Ver composición")).toBeTruthy();
    // El card NO está renderizado.
    expect(screen.queryByTestId("balance-summary-unified")).toBeNull();
  });

  it("click en el toggle MUESTRA el card, segundo click lo OCULTA", () => {
    render(
      <TPSaleBalanceSummaryToggle
        balanceMode="UNIFIED"
        balanceBreakdown={unifiedBd()}
      />,
    );
    const btn = screen.getByTestId("balance-toggle-button");

    // Click 1 → muestra.
    fireEvent.click(btn);
    expect(screen.getByTestId("balance-summary-unified")).toBeTruthy();
    expect(screen.getByText("Ocultar composición")).toBeTruthy();
    expect(btn.getAttribute("aria-expanded")).toBe("true");

    // Click 2 → vuelve a ocultar.
    fireEvent.click(btn);
    expect(screen.queryByTestId("balance-summary-unified")).toBeNull();
    expect(screen.getByText("Ver composición")).toBeTruthy();
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  it("respeta defaultShownInUnified=true (card visible al montar)", () => {
    render(
      <TPSaleBalanceSummaryToggle
        balanceMode="UNIFIED"
        balanceBreakdown={unifiedBd()}
        defaultShownInUnified={true}
      />,
    );
    expect(screen.getByTestId("balance-summary-unified")).toBeTruthy();
    expect(screen.getByText("Ocultar composición")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BREAKDOWN — siempre visible, sin toggle
// ─────────────────────────────────────────────────────────────────────────────

describe("TPSaleBalanceSummaryToggle — BREAKDOWN", () => {
  it("BREAKDOWN renderiza el card directo, SIN icon-toggle", () => {
    render(
      <TPSaleBalanceSummaryToggle
        balanceMode="BREAKDOWN"
        balanceBreakdown={breakdownBd()}
      />,
    );
    // Card visible.
    expect(screen.getByTestId("balance-summary-breakdown")).toBeTruthy();
    // El toggle NO se renderiza (regla obligatoria).
    expect(screen.queryByTestId("balance-toggle-button")).toBeNull();
    expect(screen.queryByTestId("balance-toggle-unified")).toBeNull();
  });

  it("BREAKDOWN ignora defaultShownInUnified (siempre visible)", () => {
    render(
      <TPSaleBalanceSummaryToggle
        balanceMode="BREAKDOWN"
        balanceBreakdown={breakdownBd()}
        defaultShownInUnified={false}
      />,
    );
    // Aunque defaultShownInUnified sea false, BREAKDOWN sigue visible.
    expect(screen.getByTestId("balance-summary-breakdown")).toBeTruthy();
  });

  it("BREAKDOWN inferido desde metals[]→ sin toggle", () => {
    render(
      <TPSaleBalanceSummaryToggle
        // sin balanceMode explícito
        balanceBreakdown={breakdownBd()}
      />,
    );
    expect(screen.getByTestId("balance-summary-breakdown")).toBeTruthy();
    expect(screen.queryByTestId("balance-toggle-button")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Back-compat
// ─────────────────────────────────────────────────────────────────────────────

describe("TPSaleBalanceSummaryToggle — back-compat", () => {
  it("sin balanceBreakdown → no renderiza nada", () => {
    const { container } = render(<TPSaleBalanceSummaryToggle />);
    expect(container.firstChild).toBeNull();
  });

  it("balanceBreakdown=null → no renderiza nada", () => {
    const { container } = render(
      <TPSaleBalanceSummaryToggle balanceBreakdown={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("preferencia visual NO afecta a otra instancia (estado local)", () => {
    // Dos toggles independientes — el estado de uno no toca al otro.
    const { container } = render(
      <div>
        <TPSaleBalanceSummaryToggle
          balanceMode="UNIFIED"
          balanceBreakdown={unifiedBd()}
        />
        <TPSaleBalanceSummaryToggle
          balanceMode="UNIFIED"
          balanceBreakdown={unifiedBd()}
        />
      </div>,
    );
    const btns = container.querySelectorAll(
      "[data-testid='balance-toggle-button']",
    );
    expect(btns).toHaveLength(2);
    fireEvent.click(btns[0]);
    // El primero abrió, el segundo permanece cerrado.
    const cards = container.querySelectorAll(
      "[data-testid='balance-summary-unified']",
    );
    expect(cards).toHaveLength(1);
  });
});
