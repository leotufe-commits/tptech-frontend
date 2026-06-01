// src/components/sales/TotalDelComprobanteCard/__tests__/TotalDelComprobanteCard.physical-rounding.test.tsx
// =============================================================================
// Fix UI — Etapa D, capa 16 (POLICY §R-Rounding-13).
//
// Auditoría previa: el backend ejecuta correctamente la capa 16
// (`applyDocumentPhysicalRounding`) y deja en `balanceBreakdown.metals[].
// gramsPure` el postGrams redondeado (ej. Oro Fino 1.044 → 1.000 con
// INTEGER/NEAREST). El bug era exclusivamente de render: el card prefería
// `documentMetals` (derivado de `lines[*].composition.metals[]`) que mantenía
// los gramos CRUDOS por línea — la capa 16 no toca esas líneas porque actúa
// solo a nivel documento.
//
// Fix: `resolveCardMetals(breakdown, documentMetals, documentRoundingApplied)`
// detecta redondeo físico activo y, en ese caso, prefiere
// `balanceBreakdown.metals[]` SIEMPRE — aunque `documentMetals` esté
// presente. Esto cierra:
//   · Bug 1 — "Patrimonio metálico" mostraba 1,044 g (crudo).
//   · Bug 2 — Editor de ajuste manual BREAKDOWN arrancaba con preGrams=1,044.
//
// Tests cubren los 4 escenarios pedidos en el brief:
//   (1) Sin redondeo físico → comportamiento actual intacto.
//   (2) Con redondeo físico → Patrimonio metálico muestra gramsPure del balance.
//   (3) Ajuste manual también arranca desde gramsPure (mismo resolvedMetals).
//   (4) No se renderizan gramos crudos cuando existe postGrams.
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TotalDelComprobanteCard } from "../TotalDelComprobanteCard";
import { resolveCardMetals, hasPhysicalRoundingActive } from "../helpers";
import type { BalanceBreakdownDTO } from "../../../../services/sales";
import type { DocumentMetalSummaryItem } from "../types";

const noop = () => undefined;

function openManualAdjustmentEditor(): void {
  const chip = screen.queryByTestId("total-card-manual-adjustment-open");
  if (chip) fireEvent.click(chip);
}

// ──────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────

/** Caso real del brief: Oro Fino — el backend ya escribió postGrams en
 *  `gramsPure` (1.000) tras correr la capa 16. */
function balanceWithRoundedGold(): BalanceBreakdownDTO {
  return {
    metals: [
      {
        metalParentId:         "oro-fino",
        metalParentName:       "Oro Fino",
        gramsOriginal:         1.000,    // mutado por capa 16 desde 1.044
        purity:                1,
        gramsPure:             1.000,    // ← postGrams. Era 1.044 pre-capa 16.
        quotePriceSnapshot:    100000,
        valuationMonetary:     100000,   // recomputado por capa 16
        valuationCurrencyCode: "ARS",
        sourceLineIds:         ["L-1"],
      },
    ],
    monetaryBalance: {
      amount: 0, currencyCode: "ARS", currencyRate: 1, amountBase: 0,
      components: [],
    },
  };
}

/** Misma figura SIN redondeo físico — sale 1.044 derivado de líneas. */
function balanceRawGold(): BalanceBreakdownDTO {
  return {
    metals: [
      {
        metalParentId:         "oro-fino",
        metalParentName:       "Oro Fino",
        gramsOriginal:         1.044,
        purity:                1,
        gramsPure:             1.044,
        quotePriceSnapshot:    100000,
        valuationMonetary:     104400,
        valuationCurrencyCode: "ARS",
        sourceLineIds:         ["L-1"],
      },
    ],
    monetaryBalance: {
      amount: 0, currencyCode: "ARS", currencyRate: 1, amountBase: 0,
      components: [],
    },
  };
}

/** `documentMetals` derivado del frontend a partir de líneas — siempre los
 *  gramos CRUDOS (la capa 16 no los toca). En el caso del brief: 1.044. */
const docMetalsRawGold: DocumentMetalSummaryItem[] = [
  { id: "oro-fino", name: "Oro Fino", grams: 1.044, monetaryAmount: 104400 },
];

/** `documentRoundingApplied` cuando la capa 16 actuó (PHYSICAL, INTEGER,
 *  NEAREST sobre Oro Fino). Shape paralelo a lo que persiste
 *  `applyDocumentPhysicalRounding` en el backend. */
const draPhysicalGoldRounded = {
  scope:           "BREAKDOWN" as const,
  totalAdjustment: -4400,        // monetaryEquivalent del delta físico
  breakdown: {
    metal:        null,            // capa 15.metal silenciada en PHYSICAL
    hechura:      null,
    metalDomain:  "PHYSICAL" as const,
    metalPhysical: {
      metals: [
        {
          metalParentId:      "oro-fino",
          metalParentName:    "Oro Fino",
          preGrams:           1.044,
          postGrams:          1.000,
          deltaGrams:         -0.044,
          metalPricePerGram:  100000,
          monetaryEquivalent: -4400,
          mode:               "INTEGER",
          direction:          "NEAREST",
          source:             "DOCUMENT_PHYSICAL_ROUNDING",
          fallback:           null,
        },
      ],
      metalMonetaryEquivalent: -4400,
      fallback:                null,
    },
  },
  totals: {
    monetaryRoundingAdjustment: 0,
    metalMonetaryEquivalent:    -4400,
    totalRoundingAdjustment:    -4400,
  },
};

// ──────────────────────────────────────────────────────────────────────────
// hasPhysicalRoundingActive — guard puro
// ──────────────────────────────────────────────────────────────────────────

describe("hasPhysicalRoundingActive — detector puro", () => {
  it("null / undefined → false", () => {
    expect(hasPhysicalRoundingActive(null)).toBe(false);
    expect(hasPhysicalRoundingActive(undefined)).toBe(false);
  });

  it("metalDomain='PHYSICAL' → true (regla 1)", () => {
    expect(
      hasPhysicalRoundingActive({ breakdown: { metalDomain: "PHYSICAL" } }),
    ).toBe(true);
  });

  it("metalDomain='MONETARY' sin deltas → false (back-compat)", () => {
    expect(
      hasPhysicalRoundingActive({ breakdown: { metalDomain: "MONETARY" } }),
    ).toBe(false);
  });

  it("metalPhysical.metals[].deltaGrams != 0 → true (regla 2)", () => {
    expect(
      hasPhysicalRoundingActive({
        breakdown: {
          metalPhysical: { metals: [{ deltaGrams: -0.044 }] },
        },
      }),
    ).toBe(true);
  });

  it("metalPhysical.metalMonetaryEquivalent != 0 → true (regla 3)", () => {
    expect(
      hasPhysicalRoundingActive({
        breakdown: { metalPhysical: { metalMonetaryEquivalent: -4400 } },
      }),
    ).toBe(true);
  });

  it("totals.metalMonetaryEquivalent != 0 → true (regla 3 backup)", () => {
    expect(
      hasPhysicalRoundingActive({ totals: { metalMonetaryEquivalent: -4400 } }),
    ).toBe(true);
  });

  it("noise (deltaGrams=0, metalMonetaryEquivalent=0) → false", () => {
    expect(
      hasPhysicalRoundingActive({
        breakdown: {
          metalPhysical: {
            metals: [{ deltaGrams: 0 }],
            metalMonetaryEquivalent: 0,
          },
        },
        totals: { metalMonetaryEquivalent: 0 },
      }),
    ).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// resolveCardMetals — prioridad por redondeo físico
// ──────────────────────────────────────────────────────────────────────────

describe("resolveCardMetals — prioridad por redondeo físico activo", () => {
  it("(1) SIN redondeo físico + documentMetals presente → usa documentMetals (comportamiento intacto)", () => {
    const out = resolveCardMetals(balanceRawGold(), docMetalsRawGold, null);
    expect(out).toHaveLength(1);
    expect(out[0]?.grams).toBe(1.044);
  });

  it("(2) CON redondeo físico + documentMetals presente → ignora documentMetals y usa balance.gramsPure", () => {
    const out = resolveCardMetals(
      balanceWithRoundedGold(),
      docMetalsRawGold,             // crudos: 1.044
      draPhysicalGoldRounded,       // capa 16 activa
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.name).toBe("Oro Fino");
    expect(out[0]?.grams).toBe(1.000); // ← postGrams del balance, NO 1.044
  });

  it("(3) sin documentMetals + sin redondeo físico → fallback a balance.metals (snapshot legacy)", () => {
    const out = resolveCardMetals(balanceRawGold(), undefined, null);
    expect(out).toHaveLength(1);
    expect(out[0]?.grams).toBe(1.044);
  });

  it("(4) sin documentMetals + redondeo físico activo → balance.metals con gramsPure redondeado", () => {
    const out = resolveCardMetals(
      balanceWithRoundedGold(),
      undefined,
      draPhysicalGoldRounded,
    );
    expect(out[0]?.grams).toBe(1.000);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Render UI — Bug 1: Patrimonio metálico
// ──────────────────────────────────────────────────────────────────────────

describe("TotalDelComprobanteCard — Bug 1: Patrimonio metálico", () => {
  it("(1-render) SIN redondeo físico → muestra los gramos crudos (1,044 g)", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={104400}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={balanceRawGold()}
        onBalanceModeOverrideChange={noop}
        documentMetals={docMetalsRawGold}          // crudo
        documentRoundingApplied={null}             // sin físico
      />,
    );
    const section = screen.getByTestId("total-card-metals-section");
    expect(section.textContent).toContain("Oro Fino");
    expect(section.textContent).toContain("1,044");
    expect(section.textContent).not.toContain("1,000");
  });

  it("(2-render) CON redondeo físico → fila principal muestra postGrams (1,000 g); sub-fila I1 muestra pre→post (1,044 → 1,000)", () => {
    // I1 (Etapa visual nueva): la sub-fila de redondeo físico AHORA es
    // intencional — muestra "1,044 → 1,000" para que el operador entienda
    // qué pasó. La fila principal (patrimonio metálico) sigue mostrando
    // SOLO postGrams (1,000) para evitar confundir el valor "actual".
    render(
      <TotalDelComprobanteCard
        totalDocument={100000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={balanceWithRoundedGold()}
        onBalanceModeOverrideChange={noop}
        documentMetals={docMetalsRawGold}          // crudo (lo que mandaría VentasFacturas)
        documentRoundingApplied={draPhysicalGoldRounded}
      />,
    );
    const section = screen.getByTestId("total-card-metals-section");
    expect(section.textContent).toContain("Oro Fino");
    expect(section.textContent).toContain("1,000");

    // I1 — La sub-fila del redondeo físico DEBE aparecer cuando hay capa 16 activa.
    const physicalRow = screen.queryByTestId("total-card-metal-physical-row");
    expect(physicalRow).toBeTruthy();
    // Y debe mostrar la transformación canónica preGrams → postGrams.
    expect(physicalRow!.textContent).toMatch(/1[.,]?044.*→.*1[.,]?000/);

    // El bloque entero debe contener TANTO 1,000 (fila principal) COMO
    // 1,044 (sub-fila de redondeo) — son ambas valores legítimos del nuevo
    // contrato visual.
    expect(section.textContent).toContain("1,044");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Render UI — Bug 2: Ajuste manual BREAKDOWN
// ──────────────────────────────────────────────────────────────────────────

describe("TotalDelComprobanteCard — Bug 2: Ajuste manual BREAKDOWN usa postGrams", () => {
  it("(3-render) editor abierto con redondeo físico → preGrams arranca en 1,000 (no 1,044)", () => {
    const onChange = vi.fn();
    render(
      <TotalDelComprobanteCard
        totalDocument={100000}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={balanceWithRoundedGold()}
        onBalanceModeOverrideChange={noop}
        documentMetals={docMetalsRawGold}
        documentRoundingApplied={draPhysicalGoldRounded}
        engineTotal={100000}
        onManualAdjustmentChange={onChange}
      />,
    );
    openManualAdjustmentEditor();
    // El editor BREAKDOWN del Oro Fino muestra el preGrams "Actual" en la
    // fila del metal. Verificamos que el contenido del editor refleja 1,000
    // (postGrams del backend), nunca 1,044.
    const adj = screen.getByTestId("total-card-manual-adjustment-breakdown-editor");
    expect(adj.textContent).toContain("Oro Fino");
    expect(adj.textContent).toContain("1,000");
    expect(adj.textContent).not.toContain("1,044");
  });

  it("(3b) editor abierto SIN redondeo físico → preGrams arranca en los gramos crudos (intacto)", () => {
    const onChange = vi.fn();
    render(
      <TotalDelComprobanteCard
        totalDocument={104400}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={balanceRawGold()}
        onBalanceModeOverrideChange={noop}
        documentMetals={docMetalsRawGold}
        documentRoundingApplied={null}
        engineTotal={104400}
        onManualAdjustmentChange={onChange}
      />,
    );
    openManualAdjustmentEditor();
    const adj = screen.getByTestId("total-card-manual-adjustment-breakdown-editor");
    expect(adj.textContent).toContain("Oro Fino");
    expect(adj.textContent).toContain("1,044");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// OPCIÓN C — Patrimonio Metálico SIEMPRE muestra gramos FÍSICOS
// ──────────────────────────────────────────────────────────────────────────
// Caso real reportado:
//   appliedRounding.physical.metals[0]: preGrams=0.9075, postGrams=1.000
//   metalHechuraBreakdown.metalGramsSale = 1.067625
//   UI mostraba 1,068 (lado venta con margen) → debería mostrar 1,000 (físico).
//
// Estos 3 casos cubren los requirements del usuario:
//   A) Sin redondeo físico → gramos físicos del balance, NO metalGramsSale.
//   B) Con redondeo comercial PHYSICAL → postGrams.
//   C) metalGramsSale NUNCA aparece en Patrimonio Metálico.
// ──────────────────────────────────────────────────────────────────────────

describe("Opción C — Patrimonio Metálico físico (no metalGramsSale)", () => {
  /** Fixture con MISMATCH explícito entre balance.gramsPure (físico) y
   *  documentMetals.grams (lado venta). Antes de Opción C, el helper
   *  caía a documentMetals → render = 1.068. Ahora prefiere balance →
   *  render = 0.9075. */
  function balancePhysicalGold(): BalanceBreakdownDTO {
    return {
      metals: [{
        metalParentId:         "oro-fino",
        metalParentName:       "Oro Fino",
        gramsOriginal:         0.9075,
        purity:                1,
        gramsPure:             0.9075,            // ← físico real
        quotePriceSnapshot:    187500,
        valuationMonetary:     170156.25,
        valuationCurrencyCode: "ARS",
        sourceLineIds:         ["L-1"],
      }],
      monetaryBalance: {
        amount: 0, currencyCode: "ARS", currencyRate: 1, amountBase: 0,
        components: [],
      },
    };
  }
  const docMetalsSaleSide: DocumentMetalSummaryItem[] = [
    // Lado VENTA con margen — lo que ANTES se renderizaba en el patrimonio.
    { id: "oro-fino", name: "Oro Fino", grams: 1.068, monetaryAmount: 200000 },
  ];

  /** Snapshot del redondeo COMERCIAL PHYSICAL (por línea, NO capa 16). */
  const commercialPhysicalSnapshot = [{
    metalParentId:     "oro-fino",
    metalParentName:   "Oro Fino",
    preGrams:          0.9075,
    postGrams:         1.000,
    deltaGrams:        0.0925,
    metalPricePerGram: 187500,
    monetaryEquivalent: 17343.75,
  }];

  // ── CASO A ───────────────────────────────────────────────────────────────
  it("(A) SIN redondeo físico → resolveCardMetals usa balance.gramsPure (0.9075), NO documentMetals (1.068)", () => {
    const out = resolveCardMetals(
      balancePhysicalGold(),
      docMetalsSaleSide,    // 1.068 — lado venta, debe ser IGNORADO
      null,                 // sin redondeo financiero
      undefined,            // sin redondeo comercial
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.grams).toBe(0.9075);
    // Confirmación negativa: NO eligió documentMetals.
    expect(out[0]?.grams).not.toBe(1.068);
  });

  // ── CASO B ───────────────────────────────────────────────────────────────
  it("(B) CON redondeo COMERCIAL PHYSICAL → resolveCardMetals override gramos con postGrams (1.000)", () => {
    const out = resolveCardMetals(
      balancePhysicalGold(),
      docMetalsSaleSide,            // 1.068 — debe ser IGNORADO
      null,                         // sin redondeo financiero
      commercialPhysicalSnapshot,   // ← comercial activo, postGrams=1.000
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.grams).toBe(1.000);
    expect(out[0]?.grams).not.toBe(0.9075);   // tampoco el base (pre-redondeo)
    expect(out[0]?.grams).not.toBe(1.068);    // ni el lado venta
  });

  // ── CASO C ───────────────────────────────────────────────────────────────
  it("(C) metalGramsSale (1.068) NUNCA aparece en el render del Patrimonio Metálico", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={170156}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={balancePhysicalGold()}
        onBalanceModeOverrideChange={noop}
        documentMetals={docMetalsSaleSide}       // 1.068 — Opción C lo debe ignorar
        // No redondeo financiero, no comercial → caso A puro
      />,
    );
    const section = screen.getByTestId("total-card-metals-section");
    expect(section.textContent).toContain("Oro Fino");
    // El format del tenant muestra 3 decimales: 0.9075 → "0,908" (HALF UP).
    // Lo importante es que NO aparezca el valor lado venta (1,068).
    expect(section.textContent).toContain("0,908");    // físico redondeado a display
    expect(section.textContent).not.toContain("1,068"); // ← lado venta NUNCA
    expect(section.textContent).not.toContain("1,067"); // ni alguna variante
  });

  it("(C-bis) con comercial PHYSICAL activo → render muestra postGrams (1,000), nunca 1,068 ni 0,907", () => {
    render(
      <TotalDelComprobanteCard
        totalDocument={187500}
        currencyCode="ARS"
        balanceMode="BREAKDOWN"
        balanceBreakdown={balancePhysicalGold()}
        onBalanceModeOverrideChange={noop}
        documentMetals={docMetalsSaleSide}
        commercialPhysicalRoundedMetals={commercialPhysicalSnapshot}
      />,
    );
    const section = screen.getByTestId("total-card-metals-section");
    expect(section.textContent).toContain("1,000");
    expect(section.textContent).not.toContain("1,068");
    // 0,907 puede aparecer en la sub-fila del redondeo comercial (F1) que
    // muestra "0,9075 → 1,000". Eso es OK — la sub-fila es informativa.
    // Lo que NUNCA debe pasar es que el monto principal del patrimonio sea 0,907.
    // Verificamos con la fila principal específica:
    const mainRow = screen.getByTestId("total-card-metal-oro-fino");
    // La fila principal contiene el valor primario (1,000) — la sub-fila I1
    // del redondeo financiero NO se renderiza acá porque el redondeo es comercial.
    expect(mainRow.textContent).toContain("1,000");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// BUG FIX — Patrimonio Metálico × quantity (Comercial PHYSICAL activo)
// ──────────────────────────────────────────────────────────────────────────
// Caso reportado en auditoría forense:
//   1 línea, qty=1, appliedRounding.physical.metals[0].postGrams=1.000
//     → patrimonio = 1,000 g  ✅ (resultado actual, correcto)
//   1 línea, qty=3, appliedRounding.physical.metals[0].postGrams=1.000
//     → patrimonio = 3,000 g  ✅ (resultado esperado)
//   Antes del fix → patrimonio = 1,000 g  ❌ (no escalaba por cantidad)
//
// `postGrams` se emite POR UNIDAD del metal padre. El caller propaga
// `quantity` desde la línea de origen y el agregador escala antes de
// agrupar por `metalParentId`. Paridad con `monetaryAmount` (que ya viene
// × qty desde `balanceBreakdown`).
// ──────────────────────────────────────────────────────────────────────────

describe("resolveCardMetals — comercial PHYSICAL escala postGrams × quantity de la línea", () => {
  function balanceOroFino(gramsPure: number, valuation: number): BalanceBreakdownDTO {
    return {
      metals: [{
        metalParentId:         "oro-fino",
        metalParentName:       "Oro Fino",
        gramsOriginal:         gramsPure,
        purity:                1,
        gramsPure,
        quotePriceSnapshot:    100000,
        valuationMonetary:     valuation,
        valuationCurrencyCode: "ARS",
        sourceLineIds:         ["L-1"],
      }],
      monetaryBalance: {
        amount: 0, currencyCode: "ARS", currencyRate: 1, amountBase: 0,
        components: [],
      },
    };
  }

  it("(qty=1) una línea con qty=1, postGrams=1.000 → patrimonio = 1,000 g", () => {
    const out = resolveCardMetals(
      balanceOroFino(0.908, 90800),
      undefined,
      null,
      [{
        metalParentId:    "oro-fino",
        metalParentName:  "Oro Fino",
        preGrams:         0.908,
        postGrams:        1.000,
        deltaGrams:       0.092,
        metalPricePerGram: 100000,
        monetaryEquivalent: 9200,
        quantity:         1,
      }],
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.grams).toBe(1.000);
  });

  it("(qty=3) una línea con qty=3, postGrams=1.000 → patrimonio = 3,000 g (FIX)", () => {
    const out = resolveCardMetals(
      balanceOroFino(2.724, 272400),  // 0.908 × 3 (físico crudo del balance)
      undefined,
      null,
      [{
        metalParentId:    "oro-fino",
        metalParentName:  "Oro Fino",
        preGrams:         0.908,
        postGrams:        1.000,
        deltaGrams:       0.092,
        metalPricePerGram: 100000,
        monetaryEquivalent: 9200,
        quantity:         3,
      }],
    );
    expect(out).toHaveLength(1);
    // 1.000 g/unidad × 3 unidades = 3,000 g totales del documento.
    expect(out[0]?.grams).toBe(3.000);
  });

  it("(qty=N + dos líneas) Σ postGrams × qty por metalParentId", () => {
    const out = resolveCardMetals(
      balanceOroFino(5.0, 500000),
      undefined,
      null,
      [
        // Línea A — qty=2, postGrams=1.000 → aporta 2.000
        {
          metalParentId:    "oro-fino",
          metalParentName:  "Oro Fino",
          preGrams:         0.908,
          postGrams:        1.000,
          deltaGrams:       0.092,
          metalPricePerGram: 100000,
          monetaryEquivalent: 9200,
          quantity:         2,
        },
        // Línea B — qty=3, postGrams=2.000 → aporta 6.000
        {
          metalParentId:    "oro-fino",
          metalParentName:  "Oro Fino",
          preGrams:         1.500,
          postGrams:        2.000,
          deltaGrams:       0.500,
          metalPricePerGram: 100000,
          monetaryEquivalent: 50000,
          quantity:         3,
        },
      ],
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.grams).toBe(8.000);
  });

  it("(back-compat) entry sin quantity asume 1 — fixtures previos siguen pasando", () => {
    const out = resolveCardMetals(
      balanceOroFino(0.908, 90800),
      undefined,
      null,
      [{
        metalParentId:    "oro-fino",
        metalParentName:  "Oro Fino",
        preGrams:         0.908,
        postGrams:        1.000,
        deltaGrams:       0.092,
        metalPricePerGram: 100000,
        monetaryEquivalent: 9200,
        // quantity ausente → default 1
      }],
    );
    expect(out[0]?.grams).toBe(1.000);
  });

  it("(qty=0 / inválido) qty no-positiva o no-finita cae a 1", () => {
    const out = resolveCardMetals(
      balanceOroFino(0.908, 90800),
      undefined,
      null,
      [{
        metalParentId:    "oro-fino",
        metalParentName:  "Oro Fino",
        preGrams:         0.908,
        postGrams:        1.000,
        deltaGrams:       0.092,
        metalPricePerGram: 100000,
        monetaryEquivalent: 9200,
        quantity:         0,        // inválido — debe caer a 1
      }],
    );
    expect(out[0]?.grams).toBe(1.000);
  });
});
