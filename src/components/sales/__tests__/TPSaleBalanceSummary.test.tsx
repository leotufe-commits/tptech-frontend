// src/components/sales/__tests__/TPSaleBalanceSummary.test.tsx
// =============================================================================
// T57 (Fase 3B.7) — Tests del componente de resumen visual de Balance Mode.
//
// Reglas testeadas:
//   · UNIFIED muestra TOTAL + monto en moneda doc.
//   · BREAKDOWN muestra METALES (gramos) + MONEDA.
//   · Gramos NUNCA se convierten con moneda (independencia física).
//   · USD/EUR/ARS: el code de la moneda viene del breakdown.
//   · Sin breakdown → componente no renderiza (back-compat).
//   · Snapshot legacy v2 (UNIFIED implícito) → muestra UNIFIED.
//   · components[] se renderiza agrupado por `group`, en orden de aparición.
//   · Texto de impacto en cuenta corriente según modo.
//   · Components sin `group` → fallback `typeToGroup`.
// =============================================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TPSaleBalanceSummary } from "../TPSaleBalanceSummary";
import type { BalanceBreakdownDTO } from "../../../services/sales";

function makeUnifiedBreakdown(over: Partial<BalanceBreakdownDTO> = {}): BalanceBreakdownDTO {
  return {
    metals: [],
    monetaryBalance: {
      amount:       1250,
      currencyCode: "USD",
      currencyRate: 1000,
      amountBase:   1250000,
    },
    ...over,
  };
}

function makeBreakdownBd(over: Partial<BalanceBreakdownDTO> = {}): BalanceBreakdownDTO {
  return {
    metals: [
      {
        metalParentId:    "oro-fino",
        metalParentName:  "Oro Fino",
        gramsOriginal:    2,
        purity:           0.75,
        gramsPure:        1.526,
        quotePriceSnapshot:    100,
        valuationMonetary:     152.6,
        valuationCurrencyCode: "USD",
        sourceLineIds:    ["L-1"],
      },
      {
        metalParentId:    "plata-925",
        metalParentName:  "Plata",
        gramsOriginal:    0.38,
        purity:           0.925,
        gramsPure:        0.350,
        quotePriceSnapshot:    1,
        valuationMonetary:     0.35,
        valuationCurrencyCode: "USD",
        sourceLineIds:    ["L-2"],
      },
    ],
    monetaryBalance: {
      amount:       91.25,
      currencyCode: "USD",
      currencyRate: 1000,
      amountBase:   91250,
    },
    ...over,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED
// ─────────────────────────────────────────────────────────────────────────────

describe("TPSaleBalanceSummary — UNIFIED", () => {
  it("renderiza bloque UNIFIED con TOTAL + moneda doc", () => {
    render(
      <TPSaleBalanceSummary
        balanceMode="UNIFIED"
        balanceBreakdown={makeUnifiedBreakdown()}
      />,
    );
    expect(screen.getByTestId("balance-summary-unified")).toBeTruthy();
    expect(screen.getByText("TOTAL")).toBeTruthy();
    // El code de moneda viene del breakdown (USD) — no se hardcodea.
    const total = screen.getByText(/USD/);
    expect(total.textContent).toMatch(/USD/);
  });

  it("infiere mode=UNIFIED cuando no se pasa explícitamente y metals=[]", () => {
    render(
      <TPSaleBalanceSummary
        balanceBreakdown={makeUnifiedBreakdown()}
      />,
    );
    expect(screen.getByTestId("balance-summary-unified")).toBeTruthy();
  });

  it("respeta currencyCode override del prop", () => {
    render(
      <TPSaleBalanceSummary
        balanceMode="UNIFIED"
        balanceBreakdown={makeUnifiedBreakdown({
          monetaryBalance: {
            amount: 100, currencyCode: "ARS", currencyRate: 1, amountBase: 100,
          },
        })}
        currencyCode="EUR"
      />,
    );
    expect(screen.getByText(/EUR/)).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BREAKDOWN
// ─────────────────────────────────────────────────────────────────────────────

describe("TPSaleBalanceSummary — BREAKDOWN", () => {
  it("renderiza METALES con una fila por padre", () => {
    render(
      <TPSaleBalanceSummary
        balanceMode="BREAKDOWN"
        balanceBreakdown={makeBreakdownBd()}
      />,
    );
    expect(screen.getByTestId("balance-summary-breakdown")).toBeTruthy();
    expect(screen.getByText("METALES")).toBeTruthy();
    expect(screen.getByTestId("metal-row-oro-fino")).toBeTruthy();
    expect(screen.getByTestId("metal-row-plata-925")).toBeTruthy();
    expect(screen.getByText("Oro Fino")).toBeTruthy();
    expect(screen.getByText("Plata")).toBeTruthy();
  });

  it("renderiza bloque MONEDA con monto en moneda doc", () => {
    render(
      <TPSaleBalanceSummary
        balanceMode="BREAKDOWN"
        balanceBreakdown={makeBreakdownBd()}
      />,
    );
    expect(screen.getByTestId("balance-summary-monetary")).toBeTruthy();
    expect(screen.getByText("MONEDA")).toBeTruthy();
    // El amount 91.25 USD viaja convertido por el backend.
    const monetary = screen.getByTestId("balance-summary-monetary");
    expect(monetary.textContent).toMatch(/USD/);
    expect(monetary.textContent).toMatch(/91/);
  });

  it("los gramos viajan tal cual del backend (no se convierten)", () => {
    // Probamos con BREAKDOWN en USD vs ARS: los gramos deben ser idénticos
    // — la moneda solo afecta SALDO MONETARIO.
    const bdUsd = makeBreakdownBd();
    const bdArs = makeBreakdownBd({
      monetaryBalance: {
        amount: 91250, currencyCode: "ARS", currencyRate: 1, amountBase: 91250,
      },
    });
    const { unmount } = render(
      <TPSaleBalanceSummary balanceMode="BREAKDOWN" balanceBreakdown={bdUsd} />,
    );
    const usdMetalRow = screen.getByTestId("metal-row-oro-fino");
    const usdGramsText = usdMetalRow.textContent;
    unmount();
    render(
      <TPSaleBalanceSummary balanceMode="BREAKDOWN" balanceBreakdown={bdArs} />,
    );
    const arsMetalRow = screen.getByTestId("metal-row-oro-fino");
    expect(arsMetalRow.textContent).toBe(usdGramsText);
  });

  it("infiere mode=BREAKDOWN cuando hay metales sin pasar el prop", () => {
    render(
      <TPSaleBalanceSummary
        balanceBreakdown={makeBreakdownBd()}
      />,
    );
    expect(screen.getByTestId("balance-summary-breakdown")).toBeTruthy();
  });

  it("BREAKDOWN sin metales (edge) → bloque METALES VISIBLE con mensaje vacío + bloque MONEDA", () => {
    render(
      <TPSaleBalanceSummary
        balanceMode="BREAKDOWN"
        balanceBreakdown={{
          metals: [],
          monetaryBalance: {
            amount: 100, currencyCode: "USD", currencyRate: 1, amountBase: 100,
          },
        }}
      />,
    );
    // El bloque METALES sigue visible (regla: BREAKDOWN obliga el bloque).
    expect(screen.getByTestId("balance-summary-metals")).toBeTruthy();
    expect(screen.getByTestId("balance-summary-metals-empty")).toBeTruthy();
    expect(screen.getByTestId("balance-summary-monetary")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases & back-compat
// ─────────────────────────────────────────────────────────────────────────────

describe("TPSaleBalanceSummary — back-compat / edge cases", () => {
  it("sin balanceBreakdown → no renderiza nada (back-compat pre-3B.5)", () => {
    const { container } = render(<TPSaleBalanceSummary />);
    expect(container.firstChild).toBeNull();
  });

  it("balanceBreakdown=null → no renderiza nada", () => {
    const { container } = render(<TPSaleBalanceSummary balanceBreakdown={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("legacy v2 implícito (UNIFIED implícito desde readBalanceBreakdown) → renderiza UNIFIED", () => {
    render(
      <TPSaleBalanceSummary
        balanceBreakdown={{
          metals: [],
          monetaryBalance: {
            amount: 500, currencyCode: "ARS", currencyRate: 1, amountBase: 500,
          },
        }}
      />,
    );
    // Sin mode explícito + metals vacío → UNIFIED inferido.
    expect(screen.getByTestId("balance-summary-unified")).toBeTruthy();
  });

  it("multi-moneda: el code viaja sin transformación", () => {
    for (const code of ["USD", "EUR", "ARS", "BRL"]) {
      const { unmount } = render(
        <TPSaleBalanceSummary
          balanceMode="UNIFIED"
          balanceBreakdown={{
            metals: [],
            monetaryBalance: {
              amount: 1, currencyCode: code, currencyRate: 1, amountBase: 1,
            },
          }}
        />,
      );
      expect(screen.getByText(new RegExp(code))).toBeTruthy();
      unmount();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Components[] — agrupación por `group`, orden estable, signos visuales
// ─────────────────────────────────────────────────────────────────────────────

function makeBdWithComponents(): BalanceBreakdownDTO {
  return {
    metals: [],
    monetaryBalance: {
      amount: 1210,
      currencyCode: "ARS",
      currencyRate: 1,
      amountBase: 1210,
      components: [
        { type: "HECHURA",           group: "HECHURA",  label: "Hechura",            amount: 1000 },
        { type: "DISCOUNT_QTY",      group: "DISCOUNT", label: "Descuentos de línea", amount: -100 },
        { type: "CHANNEL",           group: "CHANNEL",  label: "Tienda Online",      amount: -50 },
        { type: "TAX",               group: "TAX",      label: "IVA",                amount: 210 },
        { type: "ROUNDING_MONETARY", group: "ROUNDING", label: "Redondeo",           amount: -0.10 },
      ],
    },
  };
}

describe("TPSaleBalanceSummary — components[]", () => {
  it("renderiza components agrupados por `group` (UNIFIED)", () => {
    render(
      <TPSaleBalanceSummary
        balanceMode="UNIFIED"
        balanceBreakdown={makeBdWithComponents()}
      />,
    );
    expect(screen.getByTestId("balance-summary-components")).toBeTruthy();
    expect(screen.getByTestId("balance-group-HECHURA")).toBeTruthy();
    expect(screen.getByTestId("balance-group-DISCOUNT")).toBeTruthy();
    expect(screen.getByTestId("balance-group-CHANNEL")).toBeTruthy();
    expect(screen.getByTestId("balance-group-TAX")).toBeTruthy();
    expect(screen.getByTestId("balance-group-ROUNDING")).toBeTruthy();
  });

  it("preserva el orden estable de aparición de los grupos", () => {
    const { container } = render(
      <TPSaleBalanceSummary
        balanceMode="UNIFIED"
        balanceBreakdown={makeBdWithComponents()}
      />,
    );
    const groups = container.querySelectorAll("[data-testid^='balance-group-']");
    const order  = Array.from(groups).map((g) => g.getAttribute("data-testid"));
    expect(order).toEqual([
      "balance-group-HECHURA",
      "balance-group-DISCOUNT",
      "balance-group-CHANNEL",
      "balance-group-TAX",
      "balance-group-ROUNDING",
    ]);
  });

  it("agrupa múltiples components del mismo group manteniendo orden interno", () => {
    render(
      <TPSaleBalanceSummary
        balanceMode="UNIFIED"
        balanceBreakdown={{
          metals: [],
          monetaryBalance: {
            amount: 100, currencyCode: "ARS", currencyRate: 1, amountBase: 100,
            components: [
              { type: "TAX",          group: "TAX",      label: "IVA 21%",       amount: 21 },
              { type: "HECHURA",      group: "HECHURA",  label: "Hechura",       amount: 100 },
              { type: "TAX",          group: "TAX",      label: "Percepción 3%", amount: 3 },
            ],
          },
        }}
      />,
    );
    const taxGroup = screen.getByTestId("balance-group-TAX");
    const items    = taxGroup.querySelectorAll("li");
    // Ambos TAX caen en el mismo grupo, en orden de aparición.
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toMatch(/IVA 21%/);
    expect(items[1].textContent).toMatch(/Percepción 3%/);
  });

  it("aplica color de descuento (rojo) a amounts negativos", () => {
    render(
      <TPSaleBalanceSummary
        balanceMode="UNIFIED"
        balanceBreakdown={{
          metals: [],
          monetaryBalance: {
            amount: 100, currencyCode: "ARS", currencyRate: 1, amountBase: 100,
            components: [
              { type: "DISCOUNT_QTY", group: "DISCOUNT", label: "Descuentos", amount: -50 },
              { type: "HECHURA",      group: "HECHURA",  label: "Hechura",    amount: 150 },
            ],
          },
        }}
      />,
    );
    const negative = screen.getByTestId("balance-component-DISCOUNT_QTY");
    const positive = screen.getByTestId("balance-component-HECHURA");
    // El amount negativo lleva la clase visual de descuento (text-red-…).
    expect(negative.querySelector("span:last-child")?.className).toMatch(/text-red/);
    expect(positive.querySelector("span:last-child")?.className).not.toMatch(/text-red/);
  });

  it("fallback: si no hay components[] muestra solo el total (sin bloque composición)", () => {
    render(
      <TPSaleBalanceSummary
        balanceMode="UNIFIED"
        balanceBreakdown={makeUnifiedBreakdown()}
      />,
    );
    expect(screen.queryByTestId("balance-summary-components")).toBeNull();
    expect(screen.getByTestId("balance-summary-unified")).toBeTruthy();
  });

  it("fallback: components[] vacío también muestra solo el total", () => {
    render(
      <TPSaleBalanceSummary
        balanceMode="UNIFIED"
        balanceBreakdown={{
          metals: [],
          monetaryBalance: {
            amount: 100, currencyCode: "ARS", currencyRate: 1, amountBase: 100,
            components: [],
          },
        }}
      />,
    );
    expect(screen.queryByTestId("balance-summary-components")).toBeNull();
  });

  it("component sin `group` → infiere por `type` (fallback legacy)", () => {
    render(
      <TPSaleBalanceSummary
        balanceMode="UNIFIED"
        balanceBreakdown={{
          metals: [],
          monetaryBalance: {
            amount: 100, currencyCode: "ARS", currencyRate: 1, amountBase: 100,
            components: [
              // Sin `group` — el componente debe derivar DISCOUNT_QTY → DISCOUNT.
              { type: "DISCOUNT_QTY", label: "Descuentos legacy", amount: -10 },
            ],
          },
        }}
      />,
    );
    expect(screen.getByTestId("balance-group-DISCOUNT")).toBeTruthy();
  });

  it("renderiza components también en BREAKDOWN dentro del bloque MONEDA", () => {
    render(
      <TPSaleBalanceSummary
        balanceMode="BREAKDOWN"
        balanceBreakdown={{
          ...makeBreakdownBd(),
          monetaryBalance: {
            ...makeBreakdownBd().monetaryBalance,
            components: [
              { type: "HECHURA", group: "HECHURA", label: "Hechura", amount: 91.25 },
            ],
          },
        }}
      />,
    );
    const monetary = screen.getByTestId("balance-summary-monetary");
    expect(monetary.querySelector("[data-testid='balance-group-HECHURA']")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Impacto en cuenta corriente
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// BREAKDOWN — bloque METALES obligatorio + render multi-padre consolidado
// ─────────────────────────────────────────────────────────────────────────────

describe("TPSaleBalanceSummary — bloque METALES siempre visible en BREAKDOWN", () => {
  it("BREAKDOWN con metals=[] → bloque METALES VISIBLE con mensaje vacío", () => {
    render(
      <TPSaleBalanceSummary
        balanceMode="BREAKDOWN"
        balanceBreakdown={{
          metals: [],
          monetaryBalance: {
            amount: 100, currencyCode: "ARS", currencyRate: 1, amountBase: 100,
          },
        }}
      />,
    );
    // El bloque METALES está visible — no se oculta aunque metals=[].
    expect(screen.getByTestId("balance-summary-metals")).toBeTruthy();
    expect(screen.getByText("METALES")).toBeTruthy();
    // Y muestra mensaje informativo en lugar de quedar vacío.
    expect(screen.getByTestId("balance-summary-metals-empty")).toBeTruthy();
    expect(screen.getByText(/sin metales en este documento/i)).toBeTruthy();
  });

  it("BREAKDOWN con varias líneas y un padre repetido en variantes distintas → UNA SOLA fila por padre", () => {
    // El backend YA consolida — el frontend solo renderiza el array `metals[]`.
    // El test verifica que cada `metalParentId` se pinta una sola vez aunque
    // haya múltiples variantes contribuyendo (a través del campo `variants[]`).
    render(
      <TPSaleBalanceSummary
        balanceMode="BREAKDOWN"
        balanceBreakdown={{
          metals: [
            {
              metalParentId:   "oro-fino",
              metalParentName: "Oro Fino",
              // Σ de varias líneas: 1g (anillo 18K) + 2g (anillo 14K) + 1.2g (collar 18K)
              gramsOriginal:   4.20,
              purity:          0.66,
              gramsPure:       2.77,
              quotePriceSnapshot:    100,
              valuationMonetary:     277,
              valuationCurrencyCode: "ARS",
              variants: [
                { variantId: "oro-18k", variantName: "Oro 18K", gramsOriginal: 1.00, purity: 0.75,  gramsPure: 0.75,  sourceLineId: "L-1" },
                { variantId: "oro-14k", variantName: "Oro 14K", gramsOriginal: 2.00, purity: 0.583, gramsPure: 1.166, sourceLineId: "L-2" },
                { variantId: "oro-18k", variantName: "Oro 18K", gramsOriginal: 1.20, purity: 0.75,  gramsPure: 0.90,  sourceLineId: "L-3" },
              ],
              sourceLineIds: ["L-1", "L-2", "L-3"],
            },
            {
              metalParentId:   "plata-925",
              metalParentName: "Plata",
              gramsOriginal:   2.64,
              purity:          0.925,
              gramsPure:       2.44,
              quotePriceSnapshot:    5,
              valuationMonetary:     12.20,
              valuationCurrencyCode: "ARS",
              sourceLineIds: ["L-4"],
            },
          ],
          monetaryBalance: {
            amount: 50000, currencyCode: "ARS", currencyRate: 1, amountBase: 50000,
          },
        }}
      />,
    );
    // Una sola fila por metal padre.
    expect(screen.getAllByTestId(/^metal-row-/)).toHaveLength(2);
    expect(screen.getByTestId("metal-row-oro-fino")).toBeTruthy();
    expect(screen.getByTestId("metal-row-plata-925")).toBeTruthy();
    // Los nombres de los padres aparecen UNA VEZ cada uno.
    expect(screen.getAllByText("Oro Fino")).toHaveLength(1);
    expect(screen.getAllByText("Plata")).toHaveLength(1);
  });

  it("renderiza los gramos consolidados (NO los originales por variante)", () => {
    render(
      <TPSaleBalanceSummary
        balanceMode="BREAKDOWN"
        balanceBreakdown={{
          metals: [{
            metalParentId:   "oro-fino",
            metalParentName: "Oro Fino",
            gramsOriginal:   4.20,
            purity:          0.66,
            gramsPure:       2.77, // ← este es el número que debe verse
            quotePriceSnapshot:    null,
            valuationMonetary:     null,
            valuationCurrencyCode: "ARS",
            sourceLineIds: ["L-1", "L-2"],
          }],
          monetaryBalance: {
            amount: 100, currencyCode: "ARS", currencyRate: 1, amountBase: 100,
          },
        }}
      />,
    );
    const row = screen.getByTestId("metal-row-oro-fino");
    // El número renderizado es gramsPure (2.77), no gramsOriginal (4.20).
    expect(row.textContent).toMatch(/2[,.]77/);
    expect(row.textContent).not.toMatch(/4[,.]20/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUNDING_MONETARY visible dentro del bloque MONEDA en BREAKDOWN
// ─────────────────────────────────────────────────────────────────────────────

describe("TPSaleBalanceSummary — redondeo en bloque MONEDA", () => {
  it("BREAKDOWN: ROUNDING_MONETARY aparece dentro del bloque MONEDA", () => {
    render(
      <TPSaleBalanceSummary
        balanceMode="BREAKDOWN"
        balanceBreakdown={{
          metals: [{
            metalParentId:   "oro-fino",
            metalParentName: "Oro Fino",
            gramsOriginal:   1,
            purity:          0.75,
            gramsPure:       0.75,
            quotePriceSnapshot:    100,
            valuationMonetary:     75,
            valuationCurrencyCode: "ARS",
            sourceLineIds:   ["L-1"],
          }],
          monetaryBalance: {
            amount: 24.90, currencyCode: "ARS", currencyRate: 1, amountBase: 24.90,
            components: [
              { type: "HECHURA",           group: "HECHURA",  label: "Hechura",  amount: 25.00 },
              { type: "ROUNDING_MONETARY", group: "ROUNDING", label: "Redondeo", amount: -0.10 },
            ],
          },
        }}
      />,
    );
    const monetary = screen.getByTestId("balance-summary-monetary");
    // El ROUNDING está dentro del bloque MONEDA (no en METALES).
    expect(monetary.querySelector("[data-testid='balance-component-ROUNDING_MONETARY']")).toBeTruthy();
    expect(monetary.textContent).toMatch(/Redondeo/i);
    // El bloque METALES NO contiene el component de redondeo.
    const metals = screen.getByTestId("balance-summary-metals");
    expect(metals.querySelector("[data-testid='balance-component-ROUNDING_MONETARY']")).toBeNull();
  });
});

describe("TPSaleBalanceSummary — texto de impacto CC", () => {
  it("UNIFIED → muestra texto de impacto unificado", () => {
    render(
      <TPSaleBalanceSummary
        balanceMode="UNIFIED"
        balanceBreakdown={makeUnifiedBreakdown()}
      />,
    );
    const note = screen.getByTestId("balance-impact-unified");
    expect(note.textContent).toMatch(/saldo unificado/i);
  });

  it("BREAKDOWN → muestra texto de impacto desglosado", () => {
    render(
      <TPSaleBalanceSummary
        balanceMode="BREAKDOWN"
        balanceBreakdown={makeBreakdownBd()}
      />,
    );
    const note = screen.getByTestId("balance-impact-breakdown");
    expect(note.textContent).toMatch(/desglosado/i);
    expect(note.textContent).toMatch(/metales/i);
    expect(note.textContent).toMatch(/moneda/i);
  });
});
