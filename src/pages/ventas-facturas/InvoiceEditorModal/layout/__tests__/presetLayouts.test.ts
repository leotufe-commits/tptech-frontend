// tptech-frontend/src/pages/ventas-facturas/InvoiceEditorModal/layout/__tests__/presetLayouts.test.ts
import { describe, it, expect } from "vitest";
import {
  ASIDE_CARD_IDS,
  GRID_COLS,
  MAIN_BELOW_LINES_BY_PRESET,
  cloneLayout,
  getAsideCardIdsForPreset,
  getDefaultLayoutForPreset,
} from "../v2/presetLayouts";
import { ALL_PRESETS } from "../../../../../lib/sales/invoiceViewPresets";

describe("preset layouts V2", () => {
  for (const preset of ALL_PRESETS) {
    it(`${preset}: tiene todas las cards (aside + mainBelowLines) y posiciones validas`, () => {
      const layout = getDefaultLayoutForPreset(preset);
      expect(layout.version).toBe(2);
      // El layout incluye TODAS las cards del preset, tanto las del
      // aside (en grid) como las de mainBelowLines (sin grid, render
      // directo). Cada card carga su region persistida.
      const expectedAll = [
        ...getAsideCardIdsForPreset(preset),
        ...(MAIN_BELOW_LINES_BY_PRESET[preset] ?? []),
      ].sort();
      const ids = layout.cards.map((c) => c.id).sort();
      expect(ids).toEqual(expectedAll);

      // Posiciones validas: dentro de la grilla 12-col, w >= 1, h >= 1.
      for (const c of layout.cards) {
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.y).toBeGreaterThanOrEqual(0);
        expect(c.w).toBeGreaterThanOrEqual(1);
        expect(c.h).toBeGreaterThanOrEqual(1);
        expect(c.x + c.w).toBeLessThanOrEqual(GRID_COLS);
      }

      // Region declarada y valida.
      for (const c of layout.cards) {
        expect(["aside", "mainBelowLines"]).toContain(c.region);
      }
    });

    it(`${preset}: sin overlap entre cards de la misma region`, () => {
      const layout = getDefaultLayoutForPreset(preset);
      // Overlap check solo dentro del mismo grid (region "aside").
      // mainBelowLines no participa del grid — coords nominales.
      const asideCards = layout.cards.filter((c) => c.region === "aside");
      for (let i = 0; i < asideCards.length; i++) {
        for (let j = i + 1; j < asideCards.length; j++) {
          const a = asideCards[i];
          const b = asideCards[j];
          const overlapX = a.x < b.x + b.w && b.x < a.x + a.w;
          const overlapY = a.y < b.y + b.h && b.y < a.y + a.h;
          if (overlapX && overlapY) {
            throw new Error(`Overlap entre ${a.id} y ${b.id} en preset ${preset}`);
          }
        }
      }
    });
  }

  it("los presets producen layouts visualmente distintos entre si", () => {
    const classic  = getDefaultLayoutForPreset("CLASSIC");
    const compact  = getDefaultLayoutForPreset("COMPACT");
    const oneLine  = getDefaultLayoutForPreset("ONE_LINE");

    // CLASSIC vs COMPACT vs ONE_LINE: el ancho del Totals difiere por
    // diseno (5 cols aside vs 4 cols aside vs 12 cols full-width abajo).
    const wClassic  = classic .cards.find((c) => c.id === "totals")!.w;
    const wCompact  = compact .cards.find((c) => c.id === "totals")!.w;
    const wOneLine  = oneLine .cards.find((c) => c.id === "totals")!.w;
    expect(wClassic).toBe(5);
    expect(wCompact).toBe(4);
    expect(wOneLine).toBe(12); // full-width stacked below lines

    // COMPACT: stack vertical limpio. Aside angosto (x=8, w=4) con
    // todas las cards full-width del aside. (Las de mainBelowLines van
    // en x=0, w=12 nominalmente — filtramos solo region="aside".)
    for (const card of compact.cards.filter((c) => c.region === "aside")) {
      expect(card.x).toBe(8);
      expect(card.w).toBe(4);
    }

    // CLASSIC: aside ancho (x=7, w=5) con todas las cards full-width
    // del aside.
    for (const card of classic.cards.filter((c) => c.region === "aside")) {
      expect(card.x).toBe(7);
      expect(card.w).toBe(5);
    }

    // ONE_LINE: todas las cards apiladas verticalmente en x=0 con
    // ancho completo de la grilla 12-col.
    for (const card of oneLine.cards.filter((c) => c.region === "aside")) {
      expect(card.x).toBe(0);
      expect(card.w).toBe(12);
    }
  });

  it("ASIDE_CARD_IDS define el orden canonico y los presets lo respetan en el aside", () => {
    // Las cards del ASIDE siguen el orden de ASIDE_CARD_IDS menos las
    // que el preset mueve a mainBelowLines. Las de mainBelowLines van
    // como cards adicionales en el layout (region="mainBelowLines").
    const expectedOrder: ReadonlyArray<string> = [
      "discount",
      "shipping",
      "coupon",
      "totals",
      "payments",
      "account-impact",
      "observations",
    ];
    expect([...ASIDE_CARD_IDS]).toEqual(expectedOrder);

    for (const preset of ALL_PRESETS) {
      const moved = new Set<string>(MAIN_BELOW_LINES_BY_PRESET[preset] ?? []);
      const expectedAside = expectedOrder.filter((id) => !moved.has(id));
      const layout = getDefaultLayoutForPreset(preset);
      const asideIds = layout.cards
        .filter((c) => c.region === "aside")
        .sort((a, b) => a.y - b.y)
        .map((c) => c.id);
      expect(asideIds, `preset ${preset}`).toEqual(expectedAside);
    }
  });

  it("cloneLayout devuelve copia independiente", () => {
    const original = getDefaultLayoutForPreset("COMPACT");
    const cloned = cloneLayout(original);
    cloned.cards[0].x = 999;
    expect(original.cards[0].x).not.toBe(999);
  });
});
