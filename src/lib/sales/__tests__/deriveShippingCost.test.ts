// tptech-frontend/src/lib/sales/__tests__/deriveShippingCost.test.ts
// =============================================================================
// Tests del helper SSOT `deriveShippingCostInDocumentCurrency` y de la
// defensa en profundidad contra el bug "21.582.733" reportado el 2026-05-29.
//
// El helper es PURO — solo recibe primitivos y retorna un número. Cubrimos:
//   1. Caso happy path: ARS doc + ARS catálogo → 12000.
//   2. Caso conversión: USD doc + ARS catálogo + rate 1800 → 6.67.
//   3. Defensa #1: si baseCurrencyCode === documentCurrencyCode, IGNORAR
//      fxRate aunque esté corrupto (rate inverso, rate negativo, NaN).
//   4. Defensa #2: fxRate inválido → no convertir.
//   5. Edge cases: baseCost negativo, 0, infinito.
//   6. Bug reproducción: replica exacta del flujo que producía 21.582.733
//      y verifica que ahora retorna 12000.
// =============================================================================

import { describe, it, expect } from "vitest";
import { deriveShippingCostInDocumentCurrency } from "../deriveShippingCost";

describe("deriveShippingCostInDocumentCurrency — happy paths", () => {
  it("ARS doc + ARS catálogo (BASE=DOC=ARS) → cost = baseCost", () => {
    expect(
      deriveShippingCostInDocumentCurrency({
        baseCost:             12000,
        documentFxRate:       1,
        baseCurrencyCode:     "ARS",
        documentCurrencyCode: "ARS",
      }),
    ).toBe(12000);
  });

  it("USD doc + ARS catálogo (BASE=ARS, DOC=USD, rate 1800) → 6.67", () => {
    expect(
      deriveShippingCostInDocumentCurrency({
        baseCost:             12000,
        documentFxRate:       1800,
        baseCurrencyCode:     "ARS",
        documentCurrencyCode: "USD",
      }),
    ).toBeCloseTo(6.666666, 4);
  });

  it("EUR doc + ARS catálogo (BASE=ARS, DOC=EUR, rate 2000) → 6", () => {
    expect(
      deriveShippingCostInDocumentCurrency({
        baseCost:             12000,
        documentFxRate:       2000,
        baseCurrencyCode:     "ARS",
        documentCurrencyCode: "EUR",
      }),
    ).toBe(6);
  });

  it("USD doc + ARS catálogo (rate=1800) — varios baseCost", () => {
    const cases = [
      { base: 12000, expected: 6.666666 },
      { base: 18000, expected: 10 },
      { base: 5500,  expected: 3.055555 },
      { base: 1,     expected: 0.000555 },
    ];
    for (const { base, expected } of cases) {
      const actual = deriveShippingCostInDocumentCurrency({
        baseCost:             base,
        documentFxRate:       1800,
        baseCurrencyCode:     "ARS",
        documentCurrencyCode: "USD",
      });
      expect(actual).toBeCloseTo(expected, 4);
    }
  });
});

describe("deriveShippingCostInDocumentCurrency — defensa #1 (misma moneda)", () => {
  it("BASE=DOC=ARS con fxRate=0.000556 (CORRUPTO inverso) → ignora rate, retorna baseCost", () => {
    // ⚠️ Esto es el caso EXACTO del bug "21.582.733":
    // si NO tuviéramos la defensa, sería 12000/0.000556 = 21.582.733.
    expect(
      deriveShippingCostInDocumentCurrency({
        baseCost:             12000,
        documentFxRate:       0.000556, // CORRUPTO
        baseCurrencyCode:     "ARS",
        documentCurrencyCode: "ARS",
      }),
    ).toBe(12000);
  });

  it("BASE=DOC=ARS con fxRate=1798 (rate de OTRA moneda mal asignado) → ignora rate", () => {
    expect(
      deriveShippingCostInDocumentCurrency({
        baseCost:             12000,
        documentFxRate:       1798.561,
        baseCurrencyCode:     "ARS",
        documentCurrencyCode: "ARS",
      }),
    ).toBe(12000);
  });

  it("BASE=DOC=ARS con fxRate=NaN → ignora rate, retorna baseCost", () => {
    expect(
      deriveShippingCostInDocumentCurrency({
        baseCost:             12000,
        documentFxRate:       NaN,
        baseCurrencyCode:     "ARS",
        documentCurrencyCode: "ARS",
      }),
    ).toBe(12000);
  });

  it("BASE=DOC=ARS con fxRate=negativo → ignora rate, retorna baseCost", () => {
    expect(
      deriveShippingCostInDocumentCurrency({
        baseCost:             12000,
        documentFxRate:       -1798,
        baseCurrencyCode:     "ARS",
        documentCurrencyCode: "ARS",
      }),
    ).toBe(12000);
  });

  it("BASE=DOC=USD con fxRate corrupto → ignora rate (defensa funciona para cualquier moneda)", () => {
    expect(
      deriveShippingCostInDocumentCurrency({
        baseCost:             7.50,
        documentFxRate:       0.000556,
        baseCurrencyCode:     "USD",
        documentCurrencyCode: "USD",
      }),
    ).toBe(7.50);
  });
});

describe("deriveShippingCostInDocumentCurrency — defensa #2 (fxRate inválido)", () => {
  it("monedas diferentes + fxRate=0 → fallback a baseCost (no divide por 0)", () => {
    expect(
      deriveShippingCostInDocumentCurrency({
        baseCost:             12000,
        documentFxRate:       0,
        baseCurrencyCode:     "ARS",
        documentCurrencyCode: "USD",
      }),
    ).toBe(12000);
  });

  it("monedas diferentes + fxRate=NaN → fallback a baseCost", () => {
    expect(
      deriveShippingCostInDocumentCurrency({
        baseCost:             12000,
        documentFxRate:       NaN,
        baseCurrencyCode:     "ARS",
        documentCurrencyCode: "USD",
      }),
    ).toBe(12000);
  });

  it("monedas diferentes + fxRate=negativo → fallback a baseCost", () => {
    expect(
      deriveShippingCostInDocumentCurrency({
        baseCost:             12000,
        documentFxRate:       -1800,
        baseCurrencyCode:     "ARS",
        documentCurrencyCode: "USD",
      }),
    ).toBe(12000);
  });

  it("monedas diferentes + fxRate=1 → fallback a baseCost (sin conversión efectiva)", () => {
    expect(
      deriveShippingCostInDocumentCurrency({
        baseCost:             12000,
        documentFxRate:       1,
        baseCurrencyCode:     "ARS",
        documentCurrencyCode: "USD",
      }),
    ).toBe(12000);
  });
});

describe("deriveShippingCostInDocumentCurrency — edge cases baseCost", () => {
  it("baseCost=0 → retorna 0 (sin importar rate)", () => {
    expect(
      deriveShippingCostInDocumentCurrency({
        baseCost: 0, documentFxRate: 1800,
        baseCurrencyCode: "ARS", documentCurrencyCode: "USD",
      }),
    ).toBe(0);
  });

  it("baseCost=NaN → retorna 0", () => {
    expect(
      deriveShippingCostInDocumentCurrency({
        baseCost: NaN, documentFxRate: 1,
        baseCurrencyCode: "ARS", documentCurrencyCode: "ARS",
      }),
    ).toBe(0);
  });

  it("baseCost=negativo → retorna 0 (no se aceptan tarifas negativas)", () => {
    expect(
      deriveShippingCostInDocumentCurrency({
        baseCost: -100, documentFxRate: 1,
        baseCurrencyCode: "ARS", documentCurrencyCode: "ARS",
      }),
    ).toBe(0);
  });

  it("baseCost=Infinity → retorna 0 (defensivo)", () => {
    expect(
      deriveShippingCostInDocumentCurrency({
        baseCost: Infinity, documentFxRate: 1,
        baseCurrencyCode: "ARS", documentCurrencyCode: "ARS",
      }),
    ).toBe(0);
  });
});

describe("deriveShippingCostInDocumentCurrency — back-compat sin códigos", () => {
  it("sin baseCurrencyCode + sin documentCurrencyCode → cae a conversión por fxRate", () => {
    // Comportamiento legacy: si no tenemos códigos para comparar, hacemos
    // la conversión clásica BASE/fxRate. Es menos seguro (no detecta el
    // bug del rate corrupto) pero preserva back-compat con callers viejos.
    expect(
      deriveShippingCostInDocumentCurrency({
        baseCost: 12000, documentFxRate: 1800,
      }),
    ).toBeCloseTo(6.666666, 4);
  });

  it("solo baseCurrencyCode (sin documentCurrencyCode) → cae a conversión por fxRate", () => {
    expect(
      deriveShippingCostInDocumentCurrency({
        baseCost: 12000, documentFxRate: 1800,
        baseCurrencyCode: "ARS",
      }),
    ).toBeCloseTo(6.666666, 4);
  });
});

// =============================================================================
// REGRESIÓN DEL BUG "21.582.733" — primer ingreso del envío
// =============================================================================

describe("REGRESIÓN — primer ingreso Envío con ARS doc + ARS catálogo (bug 21.582.733)", () => {
  it("Reproducción exacta: baseCost=12000, fxRate corrupto invertido (0.000556) → 12000 (NO 21.582.733)", () => {
    // Si en la DB del tenant la moneda BASE (ARS) tiene `latestRate=0.000556`
    // (= 1/1798.561) por error, sin defensa el cálculo sería:
    //   12000 / 0.000556 = 21.582.733  ❌ BUG OBSERVADO
    //
    // Con defensa: como baseCurrencyCode === documentCurrencyCode === "ARS",
    // ignoramos fxRate y retornamos baseCost.
    const result = deriveShippingCostInDocumentCurrency({
      baseCost:             12000,
      documentFxRate:       0.000556,  // corrupto, debería ser 1
      baseCurrencyCode:     "ARS",
      documentCurrencyCode: "ARS",
    });
    expect(result).toBe(12000);
    expect(result).not.toBeCloseTo(21_582_733, -3);
  });

  it("Reproducción exacta: baseCost=12000, fxRate=1798.561 (rate USD mal asignado a ARS) → 12000", () => {
    const result = deriveShippingCostInDocumentCurrency({
      baseCost:             12000,
      documentFxRate:       1798.561,  // rate de OTRA moneda
      baseCurrencyCode:     "ARS",
      documentCurrencyCode: "ARS",
    });
    expect(result).toBe(12000);
  });

  it("Si la defensa fallara (hipotético sin códigos), el helper devolvería el valor corrupto — verificamos que SÍ pasa los códigos", () => {
    // Este test es el "control": confirma que SIN los códigos, el helper
    // legacy produciría el valor malo. Es la justificación de que el
    // fix correcto es pasar SIEMPRE los códigos desde el ShippingCard.
    const sinCodes = deriveShippingCostInDocumentCurrency({
      baseCost: 12000, documentFxRate: 0.000556,
      // codes intencionalmente omitidos
    });
    // Sin códigos, no hay defensa → conversión clásica produce el bug.
    expect(sinCodes).toBeCloseTo(21_582_733, -3);
    // Por eso el ShippingCard SIEMPRE debe pasar baseCurrencyCode +
    // documentCurrencyCode al invocar el helper.
  });
});
