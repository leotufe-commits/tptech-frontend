// src/lib/pricing/display/__tests__/resolveLineMonetaryDisplay.test.ts
// =============================================================================
// DECISIÓN COMERCIAL (2026-06-04) — MONETARIO Unificada en documento mixto.
//
// Regla comercial registrada (no es solo un fix técnico):
//   · Una pieza con Lista Unificada (MARGIN_TOTAL) PUEDE conservar datos
//     internos de metal/hechura en el payload (gramos, metalRoundingMonetary
//     Impact, …). NO se bloquean — pueden servir a futuro para pagos, saldos o
//     cuenta corriente con metal. El dato sigue llegando al draft.
//   · Pero su MONETARIO visible es el valor PROPIO de la pieza: NO se recalcula
//     ni se reduce por el redondeo metálico DOCUMENTAL. El redondeo metálico
//     pertenece a la lectura DESGLOSADA, no al precio visible de una Unificada.
//   · Por eso una pieza Unificada NO cambia su MONETARIO porque agregué otra
//     pieza con Lista Desglosada al mismo comprobante.
//
// Modelo numérico del caso real auditado:
//   totalWithTaxPost = 814.700 ; sumMetalSale = 572.343,75
//   → residuo no-metal = 242.356,25
//   metalRoundingImpact mixto = 1.212,50 (prorrateado de la línea Desglosada).
//   El impacto SÍ está presente en el input (no se bloquea) pero NO reduce el
//   MONETARIO visible de la Unificada (test 3).
// =============================================================================

import { describe, it, expect } from "vitest";
import { resolveLineMonetaryDisplay } from "../saleCompositionDisplay";

const TOTAL_POST     = 814_700;
const SUM_METAL_SALE = 572_343.75;
const MONETARIO_OK   = 242_356.25;     // 814.700 − 572.343,75
const METAL_IMPACT   = 1_212.5;        // prorrateo documental (otra línea)

const baseUnif = {
  isLineDesglosada:          false,
  hasLineSummary:            true,
  lineSummaryMonetaryAmount: TOTAL_POST,   // en UNIFICADA el contrato trae el TOTAL
  totalWithTaxPost:          TOTAL_POST,
  sumMetalSale:              SUM_METAL_SALE,
  allMetalsHaveSale:         true,
  hechFallbackTotal:         null,
  hasCommercialSaldo:        false,
  monetarySaldoPostField:    null,
};

describe("resolveLineMonetaryDisplay — invariancia de la pieza Unificada", () => {
  it("1) UNIFICADA sola (sin impacto de metal) → MONETARIO 242.356,25", () => {
    const v = resolveLineMonetaryDisplay({ ...baseUnif, metalRoundingImpact: 0 });
    expect(v).toBe(MONETARIO_OK);
  });

  it("2) UNIFICADA acompañada por Desglosada (impacto prorrateado) → MISMO 242.356,25", () => {
    const v = resolveLineMonetaryDisplay({ ...baseUnif, metalRoundingImpact: METAL_IMPACT });
    expect(v).toBe(MONETARIO_OK);
  });

  it("3) el metalRoundingImpact EXISTE en el payload pero NO reduce el MONETARIO Unificado", () => {
    const sola      = resolveLineMonetaryDisplay({ ...baseUnif, metalRoundingImpact: 0 });
    const acompanada = resolveLineMonetaryDisplay({ ...baseUnif, metalRoundingImpact: METAL_IMPACT });
    expect(acompanada).toBe(sola);
    // Guard del bug exacto: NO debe dar 241.143,75.
    expect(acompanada).not.toBe(MONETARIO_OK - METAL_IMPACT);
    expect(acompanada).not.toBe(241_143.75);
  });

  it("4a) DESGLOSADA con lineSummary → conserva su comportamiento (lee monetary.amount)", () => {
    const v = resolveLineMonetaryDisplay({
      ...baseUnif,
      isLineDesglosada:          true,
      lineSummaryMonetaryAmount: 185_500,    // saldo comercial post de la pieza
      metalRoundingImpact:       METAL_IMPACT,
    });
    expect(v).toBe(185_500);                  // passthrough — impacto NO altera este valor
  });

  it("4b) DESGLOSADA legacy (sin lineSummary, sin saldo) → SÍ descuenta su metalRoundingImpact", () => {
    const v = resolveLineMonetaryDisplay({
      ...baseUnif,
      isLineDesglosada:   true,
      hasLineSummary:     false,
      hasCommercialSaldo: false,
      metalRoundingImpact: METAL_IMPACT,
    });
    // Comportamiento legacy DESGLOSADA: residuo CON impacto descontado.
    expect(v).toBe(TOTAL_POST - SUM_METAL_SALE - METAL_IMPACT); // 241.143,75
  });

  it("4c) UNIFICADA legacy (sin lineSummary) tampoco descuenta el impacto", () => {
    const v = resolveLineMonetaryDisplay({
      ...baseUnif,
      hasLineSummary:      false,
      hasCommercialSaldo:  false,
      metalRoundingImpact: METAL_IMPACT,
    });
    expect(v).toBe(MONETARIO_OK);
  });

  it("DESGLOSADA legacy con saldo comercial (lineMonetarySaldoPostCommercialRounding) → passthrough", () => {
    const v = resolveLineMonetaryDisplay({
      ...baseUnif,
      isLineDesglosada:       true,
      hasLineSummary:         false,
      hasCommercialSaldo:     true,
      monetarySaldoPostField: 185_500,
      metalRoundingImpact:    METAL_IMPACT,
    });
    expect(v).toBe(185_500);
  });
});

// =============================================================================
// REGLA LISTA UNIFICADA — el redondeo es SOLO del TOTAL de la pieza.
//
//   monetarioVisible = totalWithTaxPost − Σ metalSale
//
//   · SIN restar metalRoundingMonetaryImpact / hechuraRoundingMonetaryImpact.
//   · SIN leer lineMonetarySaldoPostCommercialRounding (dominio DESGLOSADO; en
//     comprobantes MIXTOS llega prorrateado por OTRA línea → contaminaría la
//     pieza). La diferencia del redondeo del TOTAL se absorbe en el MONETARIO.
//   · DESGLOSADA conserva su lógica actual.
// =============================================================================
describe("resolveLineMonetaryDisplay — Lista Unificada redondea SOLO el total", () => {
  it("1) modelo chico: metal 9,50 · total pre 14,75 → total post 15,00 ⇒ monetario 5,50", () => {
    const v = resolveLineMonetaryDisplay({
      isLineDesglosada:          false,
      hasLineSummary:            true,
      lineSummaryMonetaryAmount: 15,    // UNIFICADA: el contrato trae el TOTAL
      totalWithTaxPost:          15,    // 14,75 redondeado a 15,00
      sumMetalSale:              9.5,
      metalRoundingImpact:       0,
      allMetalsHaveSale:         true,
      hechFallbackTotal:         null,
      hasCommercialSaldo:        false,
      monetarySaldoPostField:    null,
    });
    expect(v).toBe(5.5);               // 15,00 − 9,50 ; el +0,25 del total se absorbe acá
  });

  it("2) caso real del print: total post 814.700 − metal 572.343,75 ⇒ monetario 242.356,25", () => {
    const v = resolveLineMonetaryDisplay({ ...baseUnif, metalRoundingImpact: METAL_IMPACT });
    expect(v).toBe(MONETARIO_OK);
  });

  it("3) FIX: Unificada SIN lineSummary pero CON saldo post contaminado → lo IGNORA", () => {
    // Ruta exacta de la fuga: una Unificada en comprobante MIXTO puede recibir
    // `lineMonetarySaldoPostCommercialRounding` ya prorrateado (= residuo −
    // impacto = 241.143,75). El gate ANTERIOR devolvía ese campo; ahora resuelve
    // el residuo limpio porque UNIFICADA corta antes de la rama hasCommercialSaldo.
    const v = resolveLineMonetaryDisplay({
      ...baseUnif,
      hasLineSummary:         false,
      hasCommercialSaldo:     true,
      monetarySaldoPostField: 241_143.75,   // contaminado
      metalRoundingImpact:    METAL_IMPACT,
    });
    expect(v).toBe(MONETARIO_OK);           // 242.356,25, NO el campo contaminado
    expect(v).not.toBe(241_143.75);
  });

  it("4) DESGLOSADA con saldo post NO cambia: sigue leyendo lineMonetarySaldoPostCommercialRounding", () => {
    const v = resolveLineMonetaryDisplay({
      ...baseUnif,
      isLineDesglosada:       true,
      hasLineSummary:         false,
      hasCommercialSaldo:     true,
      monetarySaldoPostField: 185_500,
      metalRoundingImpact:    METAL_IMPACT,
    });
    expect(v).toBe(185_500);                // passthrough DESGLOSADO intacto
  });
});
