// tptech-frontend/src/pages/ventas-facturas/InvoiceEditorModal/layout/__tests__/reconcileLayout.test.ts
import { describe, it, expect } from "vitest";
import { reconcileLayout } from "../reconcileLayout";
import {
  ASIDE_CARD_IDS,
  GRID_COLS,
  MAIN_BELOW_LINES_BY_PRESET,
  getAsideCardIdsForPreset,
  getDefaultLayoutForPreset,
} from "../v2/presetLayouts";

describe("reconcileLayout", () => {
  it("devuelve el default del preset cuando raw es null", () => {
    const result = reconcileLayout(null, "COMPACT");
    const expected = getDefaultLayoutForPreset("COMPACT");
    expect(result.version).toBe(2);
    expect(result.cards.length).toBe(expected.cards.length);
    expect(result.cards.map((c) => c.id).sort()).toEqual(
      expected.cards.map((c) => c.id).sort(),
    );
  });

  it("devuelve el default cuando raw no tiene version 2", () => {
    const result = reconcileLayout({ version: 1, cards: [] }, "COMPACT");
    const expected = getDefaultLayoutForPreset("COMPACT");
    expect(result.cards.length).toBe(expected.cards.length);
  });

  it("mantiene cards validas del usuario sin pisarlas", () => {
    const userLayout = {
      version: 2,
      cards: [
        { id: "discount", region: "aside", x: 0, y: 0, w: 4, h: 3, minW: 2, minH: 2 },
        { id: "totals",   region: "aside", x: 4, y: 0, w: 8, h: 5, minW: 3, minH: 4 },
      ],
    };
    const result = reconcileLayout(userLayout, "COMPACT");
    const discount = result.cards.find((c) => c.id === "discount");
    const totals = result.cards.find((c) => c.id === "totals");
    expect(discount).toBeDefined();
    expect(discount?.x).toBe(0);
    expect(discount?.w).toBe(4);
    expect(totals?.x).toBe(4);
    expect(totals?.w).toBe(8);
  });

  it("agrega cards faltantes en posicion segura sin pisar las existentes", () => {
    const partialLayout = {
      version: 2,
      cards: [
        { id: "discount", region: "aside", x: 8, y: 0, w: 4, h: 3, minW: 2, minH: 2 },
      ],
    };
    const result = reconcileLayout(partialLayout, "COMPACT");

    // Debe tener TODAS las cards aside DE ESTE PRESET.
    const asideForPreset = getAsideCardIdsForPreset("COMPACT");
    for (const id of asideForPreset) {
      const card = result.cards.find((c) => c.id === id);
      expect(card).toBeDefined();
      expect(card?.region).toBe("aside");
    }
    // Las cards de main-below-lines del preset tambien deben estar
    // (se agregan automaticamente en region="mainBelowLines").
    const mainBelowLines = MAIN_BELOW_LINES_BY_PRESET["COMPACT"] ?? [];
    for (const id of mainBelowLines) {
      const card = result.cards.find((c) => c.id === id);
      expect(card).toBeDefined();
      expect(card?.region).toBe("mainBelowLines");
    }

    // La card que el usuario tenia (aside) se mantiene en su posicion.
    const discount = result.cards.find((c) => c.id === "discount")!;
    expect(discount.x).toBe(8);
    expect(discount.y).toBe(0);

    // Las cards "nuevas" del aside se agregan al final (y >= 3).
    const newAsideCards = result.cards.filter(
      (c) => c.id !== "discount" && c.region === "aside",
    );
    for (const c of newAsideCards) {
      expect(c.y).toBeGreaterThanOrEqual(3);
    }
  });

  it("respeta region persistida (vistas guardadas restauran region exacta)", () => {
    // Caso: una vista guardada tiene observations en mainBelowLines.
    // Aunque el preset por default tambien la pondria ahi, lo
    // importante es que reconcile RESPETE la region persistida.
    const userLayout = {
      version: 2,
      cards: [
        { id: "totals",       region: "aside",          x: 8, y: 0, w: 4, h: 10 },
        { id: "observations", region: "mainBelowLines", x: 0, y: 0, w: 12, h: 9 },
      ],
    };
    const result = reconcileLayout(userLayout, "COMPACT");
    const observations = result.cards.find((c) => c.id === "observations");
    expect(observations?.region).toBe("mainBelowLines");
    const totals = result.cards.find((c) => c.id === "totals");
    expect(totals?.region).toBe("aside");
  });

  it("migra cards legacy sin region usando el default del preset", () => {
    // Layout legacy: cards sin `region` (formato viejo). Reconcile
    // debe inferir region del default del preset activo.
    const legacyLayout = {
      version: 2,
      cards: [
        { id: "discount", x: 8, y: 0, w: 4, h: 5 },  // sin region
        { id: "observations", x: 8, y: 30, w: 4, h: 7 },  // sin region
      ],
    };
    const result = reconcileLayout(legacyLayout, "COMPACT");
    // discount va a "aside" (default COMPACT lo tiene en aside).
    expect(result.cards.find((c) => c.id === "discount")?.region).toBe("aside");
    // observations va a "mainBelowLines" (default COMPACT lo asigna ahi).
    expect(result.cards.find((c) => c.id === "observations")?.region).toBe("mainBelowLines");
  });

  it("descarta cards con ids desconocidos (deprecated)", () => {
    const layoutWithGhost = {
      version: 2,
      cards: [
        { id: "discount", region: "aside", x: 8, y: 0, w: 4, h: 3 },
        { id: "ghost",    region: "aside", x: 0, y: 0, w: 4, h: 3 },
      ],
    };
    const result = reconcileLayout(layoutWithGhost, "COMPACT");
    expect(result.cards.find((c) => (c as any).id === "ghost")).toBeUndefined();
  });

  it("acota x/w/h dentro de la grilla", () => {
    const layoutOOB = {
      version: 2,
      cards: [
        { id: "totals", region: "aside", x: 20, y: 0, w: 99, h: 99 },
      ],
    };
    const result = reconcileLayout(layoutOOB, "COMPACT");
    const totals = result.cards.find((c) => c.id === "totals")!;
    expect(totals.x).toBeGreaterThanOrEqual(0);
    expect(totals.x + totals.w).toBeLessThanOrEqual(GRID_COLS);
    expect(totals.w).toBeGreaterThanOrEqual(1);
    expect(totals.w).toBeLessThanOrEqual(GRID_COLS);
  });

  it("respeta minW/minH al achicar", () => {
    const layoutTooSmall = {
      version: 2,
      cards: [
        { id: "totals", region: "aside", x: 8, y: 0, w: 1, h: 1, minW: 3, minH: 4 },
      ],
    };
    const result = reconcileLayout(layoutTooSmall, "COMPACT");
    const totals = result.cards.find((c) => c.id === "totals")!;
    expect(totals.w).toBeGreaterThanOrEqual(3);
    expect(totals.h).toBeGreaterThanOrEqual(4);
  });

  it("rechaza cards con coords no numericas", () => {
    const badLayout = {
      version: 2,
      cards: [
        { id: "discount", region: "aside", x: "a", y: 0, w: 4, h: 3 },
        { id: "totals",   region: "aside", x: 8, y: 0, w: 4, h: 5 },
      ],
    };
    const result = reconcileLayout(badLayout, "COMPACT");
    // discount fue invalido -> se reagrega via "missing" en posicion segura.
    const discount = result.cards.find((c) => c.id === "discount");
    expect(discount).toBeDefined();
    expect(typeof discount?.x).toBe("number");
  });
});
