// src/components/sales/__tests__/TPSaleBalanceSummary.integration.test.tsx
// =============================================================================
// T59 (Fase 4.1) — Tests de integración del bloque
//   <TotalsHeroSection> + <TPSaleBalanceSummary>
// como se monta en `VentasFacturas.tsx`, case "totals" del aside.
//
// El objetivo es reproducir la *vecindad* visual (Opción B de
// docs/balance-mode-ui-notes.md §2) sin tener que cargar la pantalla
// entera de Factura — que es enorme y tiene N dependencias de contexto.
//
// Cubrimos:
//   1. UNIFIED + Hero coexisten sin duplicar el TOTAL conceptualmente.
//   2. BREAKDOWN renderiza METALES + MONEDA debajo del Hero.
//   3. Sin balanceBreakdown → solo Hero, summary no rompe layout.
//   4. USD: el saldo monetario muestra la moneda del documento.
//   5. ARS: idem ARS.
//   6. responseCurrencyCode tiene prioridad cuando viene del backend.
//   7. Cambio dinámico UNIFIED → BREAKDOWN re-renderiza el bloque correcto.
// =============================================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TPSaleBalanceSummary } from "../TPSaleBalanceSummary";
import type { BalanceBreakdownDTO } from "../../../services/sales";

// Mini-stub del bloque que VentasFacturas monta en `case "totals"`:
//   <div className="space-y-2">
//     <TotalsHeroSection ... />
//     <TPSaleBalanceSummary ... />
//   </div>
// El Hero real tiene N props y depende de contextos; lo reemplazamos por
// un placeholder visual mínimo que rotula su rol — el test prueba la
// integración del SUMMARY, no el Hero (que ya tiene sus propios tests).
function HeroStub({ totalLabel }: { totalLabel: string }) {
  return (
    <div data-testid="hero-stub">
      <span>Total</span>
      <span data-testid="hero-total">{totalLabel}</span>
    </div>
  );
}

interface TotalsCaseProps {
  totalLabel:        string;
  balanceMode?:      "UNIFIED" | "BREAKDOWN";
  balanceBreakdown?: BalanceBreakdownDTO | null;
  currencyCode?:     string;
}

function TotalsCase(p: TotalsCaseProps) {
  // Réplica exacta del bloque insertado en VentasFacturas case "totals":
  return (
    <div className="space-y-2">
      <HeroStub totalLabel={p.totalLabel} />
      <TPSaleBalanceSummary
        balanceMode={p.balanceMode}
        balanceBreakdown={p.balanceBreakdown}
        currencyCode={p.currencyCode}
      />
    </div>
  );
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

function bdUnifiedUSD(): BalanceBreakdownDTO {
  return {
    metals: [],
    monetaryBalance: {
      amount: 1250, currencyCode: "USD", currencyRate: 1000, amountBase: 1250000,
    },
  };
}

function bdBreakdownUSD(): BalanceBreakdownDTO {
  return {
    metals: [
      {
        metalParentId: "oro-fino", metalParentName: "Oro Fino",
        gramsOriginal: 2, purity: 0.763, gramsPure: 1.526,
        quotePriceSnapshot: 100, valuationMonetary: 152.6,
        valuationCurrencyCode: "USD", sourceLineIds: ["L-1"],
      },
      {
        metalParentId: "plata-925", metalParentName: "Plata",
        gramsOriginal: 0.38, purity: 0.925, gramsPure: 0.350,
        quotePriceSnapshot: 1, valuationMonetary: 0.35,
        valuationCurrencyCode: "USD", sourceLineIds: ["L-2"],
      },
    ],
    monetaryBalance: {
      amount: 91.25, currencyCode: "USD", currencyRate: 1000, amountBase: 91250,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Factura case 'totals' — Hero + TPSaleBalanceSummary (Opción B)", () => {
  it("UNIFIED: Hero muestra el TOTAL a facturar; Summary lo refleja como SALDO ÚNICO compacto", () => {
    render(
      <TotalsCase
        totalLabel="USD 1.250,00"
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnifiedUSD()}
      />,
    );
    // Hero coexiste arriba.
    expect(screen.getByTestId("hero-stub")).toBeTruthy();
    expect(screen.getByText("Total")).toBeTruthy();
    // Summary UNIFIED debajo.
    expect(screen.getByTestId("balance-summary-unified")).toBeTruthy();
    // No se renderiza el bloque BREAKDOWN en UNIFIED.
    expect(screen.queryByTestId("balance-summary-breakdown")).toBeNull();
  });

  it("BREAKDOWN: METALES (Oro/Plata) + MONEDA visible debajo del Hero", () => {
    render(
      <TotalsCase
        totalLabel="USD 243,85"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdBreakdownUSD()}
      />,
    );
    expect(screen.getByTestId("hero-stub")).toBeTruthy();
    expect(screen.getByTestId("balance-summary-breakdown")).toBeTruthy();
    expect(screen.getByText("METALES")).toBeTruthy();
    expect(screen.getByTestId("metal-row-oro-fino")).toBeTruthy();
    expect(screen.getByTestId("metal-row-plata-925")).toBeTruthy();
    expect(screen.getByText("MONEDA")).toBeTruthy();
    // El bloque UNIFIED NO se renderiza cuando hay metales.
    expect(screen.queryByTestId("balance-summary-unified")).toBeNull();
  });

  it("sin balanceBreakdown (back-compat): solo Hero, summary no rompe layout", () => {
    const { container } = render(
      <TotalsCase totalLabel="ARS 1.000,00" balanceMode={undefined} balanceBreakdown={null} />,
    );
    // Hero presente, summary ausente — sin ruido visual.
    expect(screen.getByTestId("hero-stub")).toBeTruthy();
    expect(screen.queryByTestId("balance-summary-unified")).toBeNull();
    expect(screen.queryByTestId("balance-summary-breakdown")).toBeNull();
    // El contenedor wrapper queda intacto (space-y-2 sigue como container raíz).
    expect(container.firstChild).not.toBeNull();
  });

  it("USD: Summary muestra el saldo monetario en USD (no en BASE)", () => {
    render(
      <TotalsCase
        totalLabel="USD 91,25"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdBreakdownUSD()}
      />,
    );
    const monetary = screen.getByTestId("balance-summary-monetary");
    expect(monetary.textContent).toMatch(/USD/);
    expect(monetary.textContent).toMatch(/91/);
    // amountBase (91250) NO se muestra como el monto principal.
    expect(monetary.textContent).not.toMatch(/91[.,]250\b/);
  });

  it("ARS: Summary muestra el saldo monetario en ARS", () => {
    const bdArs: BalanceBreakdownDTO = {
      metals: [{
        metalParentId: "oro-fino", metalParentName: "Oro Fino",
        gramsOriginal: 1, purity: 0.75, gramsPure: 0.75,
        quotePriceSnapshot: 100000, valuationMonetary: 75000,
        valuationCurrencyCode: "ARS", sourceLineIds: ["L-1"],
      }],
      monetaryBalance: {
        amount: 25000, currencyCode: "ARS", currencyRate: 1, amountBase: 25000,
      },
    };
    render(
      <TotalsCase
        totalLabel="ARS 100.000,00"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdArs}
      />,
    );
    const monetary = screen.getByTestId("balance-summary-monetary");
    expect(monetary.textContent).toMatch(/ARS/);
  });

  it("responseCurrencyCode override del backend tiene prioridad sobre monetary.currencyCode", () => {
    // Caso: documento en moneda X pero el backend devuelve responseCurrencyCode
    // distinto (ej. lookup posterior). El componente respeta la decisión del backend.
    render(
      <TotalsCase
        totalLabel="EUR 100,00"
        balanceMode="UNIFIED"
        balanceBreakdown={{
          metals: [],
          monetaryBalance: { amount: 100, currencyCode: "USD", currencyRate: 1, amountBase: 100 },
        }}
        currencyCode="EUR"   // override prop (lo que VentasFacturas hace al pasar responseCurrencyCode)
      />,
    );
    const unified = screen.getByTestId("balance-summary-unified");
    expect(unified.textContent).toMatch(/EUR/);
  });

  it("cambio dinámico UNIFIED → BREAKDOWN re-renderiza correctamente", () => {
    const { rerender } = render(
      <TotalsCase
        totalLabel="USD 1.250,00"
        balanceMode="UNIFIED"
        balanceBreakdown={bdUnifiedUSD()}
      />,
    );
    expect(screen.getByTestId("balance-summary-unified")).toBeTruthy();
    rerender(
      <TotalsCase
        totalLabel="USD 243,85"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdBreakdownUSD()}
      />,
    );
    expect(screen.queryByTestId("balance-summary-unified")).toBeNull();
    expect(screen.getByTestId("balance-summary-breakdown")).toBeTruthy();
  });

  it("multi-metal en BREAKDOWN: cada padre renderiza su propia fila", () => {
    render(
      <TotalsCase
        totalLabel="USD 243,85"
        balanceMode="BREAKDOWN"
        balanceBreakdown={bdBreakdownUSD()}
      />,
    );
    expect(screen.getByText("Oro Fino")).toBeTruthy();
    expect(screen.getByText("Plata")).toBeTruthy();
  });

  it("línea solo hechura en BREAKDOWN: bloque METALES visible obligatorio (con mensaje vacío) + bloque MONEDA", () => {
    render(
      <TotalsCase
        totalLabel="USD 50,00"
        balanceMode="BREAKDOWN"
        balanceBreakdown={{
          metals: [],
          monetaryBalance: { amount: 50, currencyCode: "USD", currencyRate: 1, amountBase: 50 },
        }}
      />,
    );
    // En BREAKDOWN el bloque METALES siempre está visible — la regla la
    // decide el modo, no la presencia de items.
    expect(screen.getByTestId("balance-summary-breakdown")).toBeTruthy();
    expect(screen.getByTestId("balance-summary-metals")).toBeTruthy();
    expect(screen.getByTestId("balance-summary-metals-empty")).toBeTruthy();
    expect(screen.getByTestId("balance-summary-monetary")).toBeTruthy();
  });
});
