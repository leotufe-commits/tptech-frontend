// src/components/sales/TotalDelComprobanteCard/__tests__/aggregateMetalFinalByParent.test.ts
// =============================================================================
// Etapa 2C — Helper de agregación del Valor Final Metal (modo DESGLOSADO).
//
// finalMetalValue = baseCommercialValue + commercialRoundingImpact
//                 + financialRoundingImpact + manualAdjustmentImpact
//
// Agregación PURA: solo suma `monetaryEquivalent` ya emitidos por backend.
// Sin cálculo de negocio, sin clamp, negativos preservados. Join por
// metalParentId (canónico) con fallback por metalParentName.
// =============================================================================

import { describe, it, expect } from "vitest";
import { aggregateMetalFinalByParent } from "../helpers";
import type { DocumentMetalSummaryItem } from "../types";

const oro: DocumentMetalSummaryItem = {
  id: "oro-fino", name: "Oro Fino", grams: 1.0, monetaryAmount: 100000,
  sourceLineIds: ["L-1"],
};
const plata: DocumentMetalSummaryItem = {
  id: "plata", name: "Plata", grams: 2.0, monetaryAmount: 5000,
};

describe("aggregateMetalFinalByParent — Etapa 2C", () => {
  it("suma los 4 componentes (comercial + redondeo comercial + financiero + manual)", () => {
    const [row] = aggregateMetalFinalByParent({
      resolvedMetals: [oro],
      baseByParentName: { "Oro Fino": 891800 },
      commercialByParentName: { "Oro Fino": 7656.25 },
      financialMetals: [{
        metalParentId: "oro-fino", metalParentName: "Oro Fino",
        preGrams: 8.918, postGrams: 9, deltaGrams: 0.082,
        metalPricePerGram: 100000, monetaryEquivalent: 8200,
      }],
      manualMetals: [{
        metalParentId: "oro-fino", metalParentName: "Oro Fino",
        preGrams: 9, postGrams: 10, deltaGrams: 1,
        metalPricePerGram: 100000, monetaryEquivalent: 100000,
      }],
    });
    expect(row.baseCommercialValue).toBe(891800);
    expect(row.commercialRoundingImpact).toBe(7656.25);
    expect(row.financialRoundingImpact).toBe(8200);
    expect(row.manualAdjustmentImpact).toBe(100000);
    // 891800 + 7656.25 + 8200 + 100000 = 1.007.656,25
    expect(row.finalMetalValue).toBe(1007656.25);
  });

  it("componentes ausentes = 0 (solo base)", () => {
    const [row] = aggregateMetalFinalByParent({
      resolvedMetals: [oro],
      baseByParentName: { "Oro Fino": 500000 },
    });
    expect(row.commercialRoundingImpact).toBe(0);
    expect(row.financialRoundingImpact).toBe(0);
    expect(row.manualAdjustmentImpact).toBe(0);
    expect(row.finalMetalValue).toBe(500000);
    expect(row.financial).toBeUndefined();
    expect(row.manual).toBeUndefined();
  });

  it("base cae a m.monetaryAmount cuando no hay mapa explícito (fallback canónico)", () => {
    const [row] = aggregateMetalFinalByParent({
      resolvedMetals: [oro],          // monetaryAmount = 100000
      baseByParentName: {},           // sin valor explícito
    });
    expect(row.baseCommercialValue).toBe(100000);
    expect(row.finalMetalValue).toBe(100000);
  });

  it("multi-metal: cada padre suma sus propios componentes", () => {
    const rows = aggregateMetalFinalByParent({
      resolvedMetals: [oro, plata],
      baseByParentName: { "Oro Fino": 100000, "Plata": 5000 },
      commercialByParentName: { "Oro Fino": 100, "Plata": 50 },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].finalMetalValue).toBe(100100);
    expect(rows[1].finalMetalValue).toBe(5050);
  });

  it("join por metalParentId (nombre distinto en la entry → igual matchea)", () => {
    const [row] = aggregateMetalFinalByParent({
      resolvedMetals: [oro],
      baseByParentName: { "Oro Fino": 100000 },
      financialMetals: [{
        metalParentId: "oro-fino", metalParentName: "OTRO NOMBRE",
        preGrams: 1, postGrams: 1.1, deltaGrams: 0.1,
        metalPricePerGram: 1000, monetaryEquivalent: 100,
      }],
    });
    expect(row.financialRoundingImpact).toBe(100);
  });

  it("fallback por metalParentName cuando la entry no trae id", () => {
    const [row] = aggregateMetalFinalByParent({
      resolvedMetals: [oro],
      baseByParentName: { "Oro Fino": 100000 },
      manualMetals: [{
        metalParentId: null, metalParentName: "oro fino",  // case-insensitive
        preGrams: 1, postGrams: 0.5, deltaGrams: -0.5,
        metalPricePerGram: 1000, monetaryEquivalent: -500,
      }],
    });
    expect(row.manualAdjustmentImpact).toBe(-500);
  });

  it("preserva negativos (financiero/manual hacia abajo) sin clamp", () => {
    const [row] = aggregateMetalFinalByParent({
      resolvedMetals: [oro],
      baseByParentName: { "Oro Fino": 1000 },
      commercialByParentName: { "Oro Fino": -200 },
      financialMetals: [{
        metalParentId: "oro-fino", metalParentName: "Oro Fino",
        preGrams: 2, postGrams: 1, deltaGrams: -1,
        metalPricePerGram: 300, monetaryEquivalent: -300,
      }],
    });
    expect(row.commercialRoundingImpact).toBe(-200);
    expect(row.financialRoundingImpact).toBe(-300);
    // 1000 − 200 − 300 = 500
    expect(row.finalMetalValue).toBe(500);
  });

  it("passthrough EXACTO del detalle físico (pre/post/delta/ppg/equiv)", () => {
    const [row] = aggregateMetalFinalByParent({
      resolvedMetals: [oro],
      baseByParentName: { "Oro Fino": 100000 },
      financialMetals: [{
        metalParentId: "oro-fino", metalParentName: "Oro Fino",
        preGrams: 1.044, postGrams: 1.0, deltaGrams: -0.044,
        metalPricePerGram: 100000, monetaryEquivalent: -4400,
      }],
      manualMetals: [{
        metalParentId: "oro-fino", metalParentName: "Oro Fino",
        preGrams: 1.0, postGrams: 1.5, deltaGrams: 0.5,
        metalPricePerGram: 100000, monetaryEquivalent: 50000,
      }],
    });
    expect(row.financial).toEqual({
      preGrams: 1.044, postGrams: 1.0, deltaGrams: -0.044,
      metalPricePerGram: 100000, monetaryEquivalent: -4400,
    });
    expect(row.manual).toEqual({
      preGrams: 1.0, postGrams: 1.5, deltaGrams: 0.5,
      metalPricePerGram: 100000, monetaryEquivalent: 50000,
    });
  });

  it("conservación: Σ finalMetalValue = Σ base + Σ comercial + Σ financiero + Σ manual", () => {
    const rows = aggregateMetalFinalByParent({
      resolvedMetals: [oro, plata],
      baseByParentName: { "Oro Fino": 100000, "Plata": 5000 },
      commercialByParentName: { "Oro Fino": 100, "Plata": 50 },
      financialMetals: [{
        metalParentId: "oro-fino", metalParentName: "Oro Fino",
        preGrams: 1, postGrams: 1.1, deltaGrams: 0.1,
        metalPricePerGram: 1000, monetaryEquivalent: 100,
      }],
      manualMetals: [{
        metalParentId: "plata", metalParentName: "Plata",
        preGrams: 2, postGrams: 2.5, deltaGrams: 0.5,
        metalPricePerGram: 100, monetaryEquivalent: 50,
      }],
    });
    const sigmaFinal = rows.reduce((a, r) => a + r.finalMetalValue, 0);
    const sigmaParts = rows.reduce(
      (a, r) => a + r.baseCommercialValue + r.commercialRoundingImpact
        + r.financialRoundingImpact + r.manualAdjustmentImpact,
      0,
    );
    expect(Math.round(sigmaFinal * 100) / 100).toBe(Math.round(sigmaParts * 100) / 100);
    // 100000+100+100 + 5000+50+50 = 105300
    expect(sigmaFinal).toBe(105300);
  });
});
