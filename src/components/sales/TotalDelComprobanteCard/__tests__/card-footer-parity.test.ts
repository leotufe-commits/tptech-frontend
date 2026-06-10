// src/components/sales/TotalDelComprobanteCard/__tests__/card-footer-parity.test.ts
// =============================================================================
// RED DE PARIDAD CARD ↔ FOOTER — Trabajo #3 del Backlog de Evolución Controlada.
//
// QUÉ GARANTIZA (arnés de CONSISTENCIA entre superficies de display)
// ------------------------------------------------------------------
// Que lo que el Card muestra per-línea, AGREGADO, coincide con lo que el Footer
// muestra a nivel documento para las magnitudes comerciales compartidas:
//   1. Gramos por metal padre  : Footer = Σ (visibleGrams por línea).
//   2. Impacto metal $         : Footer = Σ (metals.roundingImpact por línea).
//   3. Impacto monetario $     : Footer = Σ (monetary.roundingImpact por línea).
//   4. Cierre per-línea        : metals.monetaryAmount + monetary.amount = totalLineAmount.
//   5. Fallback                : líneas sin C-FASE1 caen a B (lineOwn*) sin romper.
//
// QUÉ **NO** GARANTIZA (ver CONTRATO-FUNCIONAL-consumo.md + auditoría de alcance)
// ------------------------------------------------------------------------------
//   · NO compara contra `Sale.total` ni snapshots (capas documentales).
//   · NO valida el motor / pricing-engine.
//   · NO valida la corrección numérica de C-FASE1 vs autoridad en MIXED (gate #4).
//   · NO ejercita el componente Card (FIX MIXED / cadenas de prioridad) — eso lo
//     cubren los render tests existentes. La paridad es transitiva:
//       (render tests: Card == C-FASE1) ∧ (este test: Footer == Σ C-FASE1)
//       ⇒ Card == Footer.
//
// Las superficies leen las MISMAS familias del backend (passthrough), así que la
// paridad es un invariante ESTRUCTURAL, no números mágicos. Test PURO: solo
// helpers del Footer, sin render, sin runtime, sin tocar el núcleo.
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  buildVisibleGramsByParent,
  sumLineCommercialMetalRoundingImpact,
  sumLineCommercialMonetaryRoundingImpact,
} from "../helpers";

const round2 = (n: number): number => Math.round(n * 100) / 100;

const PARENT = "Oro Fino";

/** Shape del resumen comercial per-línea (C). */
function summaryBreakdown(opts: {
  grams: number;
  metalAmount: number;
  metalImpact: number;
  monetaryAmount: number;
  monetaryImpact: number;
}) {
  return {
    mode: "BREAKDOWN" as const,
    metals: {
      visibleGrams: opts.grams,
      monetaryAmount: opts.metalAmount,
      roundingImpact: opts.metalImpact,
      byParent: [
        {
          metalParentId: "oro",
          metalParentName: PARENT,
          visibleGrams: opts.grams,
          monetaryAmount: opts.metalAmount,
          roundingImpact: opts.metalImpact,
        },
      ],
    },
    monetary: { amount: opts.monetaryAmount, roundingImpact: opts.monetaryImpact },
    totalLineAmount: round2(opts.metalAmount + opts.monetaryAmount),
  };
}

/** Línea BREAKDOWN con C-FASE1 (display) y C-FASE0 (summary) iguales — el caso
 *  no-divergente normal. Incluye `composition.metals` para que el helper de
 *  gramos derive el padre `Oro Fino`. */
function breakdownLine(opts: {
  grams: number;
  metalAmount: number;
  metalImpact: number;
  monetaryAmount: number;
  monetaryImpact: number;
}) {
  const s = summaryBreakdown(opts);
  return {
    quantity: 1,
    composition: {
      metals: [
        { metalName: PARENT, purity: 0.75, appliedGrams: 10, appliedMermaPct: 0, lineSale: opts.metalAmount },
      ],
    },
    metalHechuraBreakdown: { metalCost: 400000, metalSale: 440000, metalSaleRoundingDelta: null },
    lineCommercialSummary: s,         // FASE 0 — fuente del helper de gramos
    lineCommercialDisplaySummary: s,  // FASE 1 — fuente de los helpers de impacto
  };
}

/** Línea UNIFICADA — sin desglose de metal; monetario = total; impactos 0. */
function unifiedLine(total: number) {
  const s = {
    mode: "UNIFIED" as const,
    metals: null,
    monetary: { amount: total, roundingImpact: 0 },
    totalLineAmount: total,
  };
  return {
    quantity: 1,
    composition: { metals: [] },
    lineCommercialSummary: s,
    lineCommercialDisplaySummary: s,
  };
}

/** Línea sin composición — sin metales ni summary de metal. */
function noCompositionLine(total: number) {
  const s = {
    mode: "UNIFIED" as const,
    metals: null,
    monetary: { amount: total, roundingImpact: 0 },
    totalLineAmount: total,
  };
  return { quantity: 1, lineCommercialDisplaySummary: s };
}

/** Línea HISTÓRICA — sin C-FASE1/FASE0; solo campos B (`lineOwn*`) + composición
 *  para el fallback de gramos (`gramsEquivLine`). */
function historicalLine(opts: { metalOwn: number; hechuraOwn: number }) {
  return {
    quantity: 1,
    composition: {
      metals: [
        { metalName: PARENT, purity: 0.75, appliedGrams: 8, appliedMermaPct: 0, lineSale: 500000 },
      ],
    },
    metalHechuraBreakdown: { metalCost: 400000, metalSale: 440000, metalSaleRoundingDelta: null },
    lineOwnMetalRoundingMonetaryImpact: opts.metalOwn,
    lineOwnHechuraRoundingMonetaryImpact: opts.hechuraOwn,
  };
}

describe("Red de paridad Card ↔ Footer (#3) — Footer = Σ C-FASE1 por superficie", () => {
  // ── BREAKDOWN (lista compartida) ────────────────────────────────────────────
  describe("BREAKDOWN", () => {
    const l = breakdownLine({ grams: 2.3, metalAmount: 333281.25, metalImpact: 2650, monetaryAmount: 185500, monetaryImpact: 24.79 });

    it("1) gramos: Footer por padre = Σ visibleGrams", () => {
      expect(buildVisibleGramsByParent([l] as any)[PARENT]).toBeCloseTo(2.3, 6);
    });
    it("2) impacto metal: Footer = Σ metals.roundingImpact", () => {
      expect(sumLineCommercialMetalRoundingImpact([l])).toBe(2650);
    });
    it("3) impacto monetario: Footer = Σ monetary.roundingImpact", () => {
      expect(sumLineCommercialMonetaryRoundingImpact([l])).toBe(24.79);
    });
    it("4) cierre per-línea: metalAmount + monetaryAmount = totalLineAmount", () => {
      const s = l.lineCommercialDisplaySummary;
      expect(round2(s.metals!.monetaryAmount + s.monetary.amount)).toBe(s.totalLineAmount);
    });
  });

  // ── MIXED (≥2 líneas; la agregación es agnóstica al modo) ───────────────────
  describe("MIXED (multi-línea)", () => {
    const a = breakdownLine({ grams: 2.3, metalAmount: 333281.25, metalImpact: 2650, monetaryAmount: 185500, monetaryImpact: 24.79 });
    const b = breakdownLine({ grams: 1.2, metalAmount: 120000, metalImpact: 675, monetaryAmount: 90000, monetaryImpact: 10.5 });
    const lines = [a, b];

    it("1) gramos: Footer = Σ de ambas líneas", () => {
      expect(buildVisibleGramsByParent(lines as any)[PARENT]).toBeCloseTo(3.5, 6);
    });
    it("2) impacto metal: Footer = Σ (2650 + 675)", () => {
      expect(sumLineCommercialMetalRoundingImpact(lines)).toBe(round2(2650 + 675));
    });
    it("3) impacto monetario: Footer = Σ (24.79 + 10.5)", () => {
      expect(sumLineCommercialMonetaryRoundingImpact(lines)).toBe(round2(24.79 + 10.5));
    });
  });

  // ── UNIFIED ─────────────────────────────────────────────────────────────────
  describe("UNIFIED", () => {
    const l = unifiedLine(500000);
    it("metal: sin desglose → Footer no aporta impacto metal (null)", () => {
      expect(sumLineCommercialMetalRoundingImpact([l])).toBeNull();
    });
    it("monetario: roundingImpact = 0 → Footer = 0", () => {
      expect(sumLineCommercialMonetaryRoundingImpact([l])).toBe(0);
    });
    it("gramos: sin metales en composición → sin entrada", () => {
      expect(buildVisibleGramsByParent([l] as any)[PARENT]).toBeUndefined();
    });
  });

  // ── Sin composición ─────────────────────────────────────────────────────────
  describe("sin composición", () => {
    const l = noCompositionLine(120000);
    it("no rompe: impacto metal null, monetario 0, gramos vacío", () => {
      expect(sumLineCommercialMetalRoundingImpact([l])).toBeNull();
      expect(sumLineCommercialMonetaryRoundingImpact([l])).toBe(0);
      expect(buildVisibleGramsByParent([l] as any)[PARENT]).toBeUndefined();
    });
  });

  // ── Snapshot histórico (sin C-FASE1 → fallback B) ───────────────────────────
  describe("snapshot histórico (fallback B)", () => {
    const l = historicalLine({ metalOwn: 100, hechuraOwn: 50 });
    it("5a) impacto metal: cae a lineOwnMetalRoundingMonetaryImpact", () => {
      expect(sumLineCommercialMetalRoundingImpact([l])).toBe(100);
    });
    it("5b) impacto monetario: cae a lineOwnHechuraRoundingMonetaryImpact", () => {
      expect(sumLineCommercialMonetaryRoundingImpact([l])).toBe(50);
    });
    it("5c) gramos: cae a gramsEquivLine (entrada finita, sin romper)", () => {
      const g = buildVisibleGramsByParent([l] as any)[PARENT];
      expect(typeof g === "number" && Number.isFinite(g) && g > 0).toBe(true);
    });
  });

  // ── Paridad cruzada: histórico + fresco coexisten sin contaminarse ──────────
  describe("mixto histórico + C-FASE1", () => {
    const fresh = breakdownLine({ grams: 2.3, metalAmount: 333281.25, metalImpact: 2650, monetaryAmount: 185500, monetaryImpact: 24.79 });
    const hist  = historicalLine({ metalOwn: 100, hechuraOwn: 50 });
    it("Footer suma C-FASE1 (2650) + fallback B (100) = 2750", () => {
      expect(sumLineCommercialMetalRoundingImpact([fresh, hist])).toBe(round2(2650 + 100));
    });
    it("Footer suma monetario C-FASE1 (24.79) + fallback B (50) = 74.79", () => {
      expect(sumLineCommercialMonetaryRoundingImpact([fresh, hist])).toBe(round2(24.79 + 50));
    });
  });
});
