// src/pages/ventas-facturas/InvoiceEditorModal/layout/v2/__tests__/cardConstraints.test.ts
// ============================================================================
// Tests del SSOT de constraints (Constraint & Balance).
//
// Verifica:
//   · `CARD_CONSTRAINTS` contiene una entrada por cada CardId.
//   · Los 3 presets respetan el floor — ninguna card tiene h < minH ni
//     w < minW del SSOT (sumando overrides admitidos como h=3 colapsado).
//   · `getCardConstraints` devuelve la entrada esperada.
// ============================================================================

import { describe, it, expect } from "vitest";
import { CARD_CONSTRAINTS, getCardConstraints } from "../cardConstraints";
import {
  LAYOUT_V2_COMPACT,
  LAYOUT_V2_CLASSIC,
  LAYOUT_V2_FOCUS,
} from "../presetLayouts";
import { VALID_CARD_IDS } from "../../types";

describe("CARD_CONSTRAINTS — completitud + helper", () => {
  it("contiene una entrada para cada CardId válido", () => {
    for (const id of VALID_CARD_IDS) {
      expect(CARD_CONSTRAINTS[id]).toBeDefined();
      expect(CARD_CONSTRAINTS[id].minW).toBeGreaterThan(0);
      expect(CARD_CONSTRAINTS[id].minH).toBeGreaterThan(0);
    }
  });

  it("getCardConstraints devuelve la entrada exacta", () => {
    expect(getCardConstraints("totals")).toEqual(CARD_CONSTRAINTS.totals);
    expect(getCardConstraints("discount")).toEqual(CARD_CONSTRAINTS.discount);
  });

  it("totals tiene el minH más alto del aside (es el card principal)", () => {
    const asideIds = ["discount", "shipping", "coupon", "totals", "payments", "account-impact", "observations"] as const;
    const totalsMinH = CARD_CONSTRAINTS.totals.minH;
    for (const id of asideIds) {
      if (id === "totals") continue;
      expect(totalsMinH).toBeGreaterThanOrEqual(CARD_CONSTRAINTS[id].minH);
    }
  });
});

describe("Presets respetan el floor de CARD_CONSTRAINTS", () => {
  // El único override aceptado es `observations` collapsed con h=3 en
  // COMPACT y FOCUS (cardConstraints define observations.minH=3 → exacto).
  // Todas las demás cards: h >= minH del SSOT.

  it.each([
    ["COMPACT", LAYOUT_V2_COMPACT],
    ["CLASSIC", LAYOUT_V2_CLASSIC],
    ["FOCUS",   LAYOUT_V2_FOCUS],
  ] as const)("%s: ninguna card tiene h MENOR al floor del SSOT", (_name, layout) => {
    for (const card of layout.cards) {
      const c = getCardConstraints(card.id);
      expect(card.h, `${card.id}.h (${card.h}) < floor minH (${c.minH})`).toBeGreaterThanOrEqual(c.minH);
    }
  });

  it.each([
    ["COMPACT", LAYOUT_V2_COMPACT],
    ["CLASSIC", LAYOUT_V2_CLASSIC],
    ["FOCUS",   LAYOUT_V2_FOCUS],
  ] as const)("%s: ninguna card tiene w MENOR al floor del SSOT", (_name, layout) => {
    for (const card of layout.cards) {
      const c = getCardConstraints(card.id);
      expect(card.w, `${card.id}.w (${card.w}) < floor minW (${c.minW})`).toBeGreaterThanOrEqual(c.minW);
    }
  });

  it.each([
    ["COMPACT", LAYOUT_V2_COMPACT],
    ["CLASSIC", LAYOUT_V2_CLASSIC],
    ["FOCUS",   LAYOUT_V2_FOCUS],
  ] as const)("%s: el minH declarado del card es >= floor del SSOT (anti-corrupción)", (_name, layout) => {
    for (const card of layout.cards) {
      if (card.minH == null) continue;
      const c = getCardConstraints(card.id);
      expect(card.minH, `${card.id}.minH (${card.minH}) < floor SSOT (${c.minH})`).toBeGreaterThanOrEqual(c.minH);
    }
  });
});

describe("Layouts default — invariantes geométricos", () => {
  it.each([
    ["COMPACT", LAYOUT_V2_COMPACT],
    ["CLASSIC", LAYOUT_V2_CLASSIC],
    ["FOCUS",   LAYOUT_V2_FOCUS],
  ] as const)("%s: cards del aside no se solapan entre sí (orden vertical limpio)", (_name, layout) => {
    const aside = layout.cards
      .filter((c) => c.region === "aside")
      .sort((a, b) => a.y - b.y);
    // Pairs con overlap horizontal — calculados sin if/expect (ESLint
    // vitest/no-conditional-expect).
    const overlapPairs = aside.slice(1).map((curr, idx) => {
      const prev = aside[idx];
      const overlapX = curr.x < prev.x + prev.w && curr.x + curr.w > prev.x;
      return { prev, curr, overlapX, minValidY: prev.y + prev.h };
    });
    const conflictingPairs = overlapPairs.filter((p) => p.overlapX && p.curr.y < p.minValidY);
    expect(conflictingPairs, `cards solapadas: ${conflictingPairs.map((p) => `${p.curr.id}↔${p.prev.id}`).join(", ")}`).toEqual([]);
  });

  it.each([
    ["COMPACT", LAYOUT_V2_COMPACT],
    ["CLASSIC", LAYOUT_V2_CLASSIC],
    ["FOCUS",   LAYOUT_V2_FOCUS],
  ] as const)("%s: ninguna card excede las 12 columnas del grid", (_name, layout) => {
    for (const card of layout.cards) {
      expect(card.x + card.w).toBeLessThanOrEqual(layout.grid.columns);
    }
  });
});
