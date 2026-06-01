// src/components/sales/TotalDelComprobanteCard/__tests__/resolveCardMetals.commercialDoc.test.ts
//
// Etapa D' (cierre conceptual) — Tests de la prioridad #0 de `resolveCardMetals`:
// cuando existe `commercialDocumentRoundingSnapshot` (snapshot canónico del
// Redondeo Comercial PER_DOCUMENT), ES LA FUENTE ÚNICA DE VERDAD del gramos
// del Patrimonio Metálico.
//
// REGLA DE ORO verificada:
//   · El helper NO recalcula gramos.
//   · El helper NO mezcla pre/post según condicionales arbitrarias.
//   · El helper SOLO selecciona la fuente correcta y pasa los gramos tal cual.
//   · Cuando el snapshot existe, NO se lee de balanceBreakdown ni de
//     documentMetals (esos quedan subordinados).

import { describe, it, expect } from "vitest";
import { resolveCardMetals } from "../helpers";
import type { BalanceBreakdownDTO } from "../../../../services/sales";

function breakdownOneMetal(name: string, grams: number, valuation = 100000): BalanceBreakdownDTO {
  return {
    metals: [{
      metalParentId:         "metal-x",
      metalParentName:       name,
      gramsOriginal:         grams,
      purity:                1,
      gramsPure:             grams,
      quotePriceSnapshot:    valuation / Math.max(grams, 0.0001),
      valuationMonetary:     valuation,
      valuationCurrencyCode: "ARS",
      sourceLineIds:         ["L1"],
    }],
    monetaryBalance: {
      amount:        50000,
      currencyCode:  "ARS",
      currencyRate:  1,
      amountBase:    50000,
    },
  } as any;
}

describe("resolveCardMetals — prioridad #0 (snapshot D' como fuente única)", () => {
  it("snapshot BREAKDOWN con metals → override de grams por postGrams (NO usa balance gramsPure)", () => {
    const balance = breakdownOneMetal("Oro Fino", 1.2375);   // ← gramos PRE del balance
    const snapshot = {
      scope:    "BREAKDOWN" as const,
      breakdown: {
        metals: [{
          metalParentId:   "ignored",
          metalParentName: "Oro Fino",
          postGrams:       1.0,                                // ← gramos POST canónico
        }],
      },
    };
    const result = resolveCardMetals(balance, undefined, undefined, undefined, snapshot);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Oro Fino");
    expect(result[0].grams).toBe(1.0);   // ← POST del snapshot, NO 1.2375 del balance
  });

  it("snapshot BREAKDOWN sin balance breakdown → arma items desde el snapshot", () => {
    const snapshot = {
      scope:    "BREAKDOWN" as const,
      breakdown: {
        metals: [
          { metalParentName: "Oro Fino", postGrams: 1.0 },
          { metalParentName: "Plata",    postGrams: 100.0 },
        ],
      },
    };
    const result = resolveCardMetals(null, undefined, undefined, undefined, snapshot);
    expect(result).toHaveLength(2);
    expect(result.find((m) => m.name === "Oro Fino")?.grams).toBe(1.0);
    expect(result.find((m) => m.name === "Plata")?.grams).toBe(100.0);
  });

  it("snapshot BREAKDOWN con metal nuevo (no en balance) → lo agrega al output", () => {
    const balance = breakdownOneMetal("Oro Fino", 1.2375);
    const snapshot = {
      scope:    "BREAKDOWN" as const,
      breakdown: {
        metals: [
          { metalParentName: "Oro Fino", postGrams: 1.0 },
          { metalParentName: "Plata",    postGrams: 50.0 },  // ← no estaba en balance
        ],
      },
    };
    const result = resolveCardMetals(balance, undefined, undefined, undefined, snapshot);
    expect(result).toHaveLength(2);
    const oro = result.find((m) => m.name === "Oro Fino");
    const plata = result.find((m) => m.name === "Plata");
    expect(oro?.grams).toBe(1.0);
    expect(plata?.grams).toBe(50.0);
  });

  it("snapshot UNIFIED → NO aplica el override (la regla solo cubre BREAKDOWN)", () => {
    const balance = breakdownOneMetal("Oro Fino", 1.2375);
    const snapshot = {
      scope: "UNIFIED" as const,
      // En UNIFIED no hay `breakdown.metals[]`, el snapshot no es la
      // autoridad de gramos. Cae a la prioridad legacy (balance).
    };
    const result = resolveCardMetals(balance, undefined, undefined, undefined, snapshot);
    expect(result[0].grams).toBe(1.2375);   // ← prioridad legacy
  });

  it("snapshot null → comportamiento legacy intacto (prioridad 3: balance gramsPure)", () => {
    const balance = breakdownOneMetal("Oro Fino", 1.2375);
    const result = resolveCardMetals(balance, undefined, undefined, undefined, null);
    expect(result[0].grams).toBe(1.2375);
  });

  it("snapshot undefined → comportamiento legacy intacto", () => {
    const balance = breakdownOneMetal("Oro Fino", 1.2375);
    const result = resolveCardMetals(balance, undefined, undefined, undefined, undefined);
    expect(result[0].grams).toBe(1.2375);
  });

  it("snapshot BREAKDOWN con metals[]=[] (vacío) → fallback a legacy", () => {
    const balance = breakdownOneMetal("Oro Fino", 1.2375);
    const snapshot = {
      scope:     "BREAKDOWN" as const,
      breakdown: { metals: [] },
    };
    const result = resolveCardMetals(balance, undefined, undefined, undefined, snapshot);
    expect(result[0].grams).toBe(1.2375);
  });

  it("snapshot D' PRIMA sobre commercialPhysicalMetals (per-line legacy)", () => {
    const balance = breakdownOneMetal("Oro Fino", 1.2375);
    const perLineLegacy = [{
      metalParentId: "Oro Fino",   // match por id (legacy)
      metalParentName: "Oro Fino",
      postGrams: 1.5,              // ← legacy diría 1.5
      deltaGrams: -0.1,
      quantity: 1,
    }];
    const snapshotDPrime = {
      scope:     "BREAKDOWN" as const,
      breakdown: {
        metals: [{ metalParentName: "Oro Fino", postGrams: 1.0 }],   // ← snapshot D' dice 1.0
      },
    };
    const result = resolveCardMetals(
      balance,
      undefined,
      undefined,
      perLineLegacy,
      snapshotDPrime,
    );
    // Snapshot D' (prioridad 0) gana sobre commercialPhysicalMetals (prioridad 2).
    expect(result[0].grams).toBe(1.0);
  });

  it("varios items con mismo nombre en snapshot → Σ por nombre (key estable)", () => {
    const snapshot = {
      scope:    "BREAKDOWN" as const,
      breakdown: {
        metals: [
          { metalParentName: "Oro Fino", postGrams: 0.5 },
          { metalParentName: "Oro Fino", postGrams: 0.7 },   // ← mismo nombre, otro registro
        ],
      },
    };
    const result = resolveCardMetals(null, undefined, undefined, undefined, snapshot);
    expect(result).toHaveLength(1);
    expect(result[0].grams).toBe(1.2);   // Σ = 0.5 + 0.7
  });
});
