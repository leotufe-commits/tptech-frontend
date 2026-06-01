// src/pages/ventas-facturas/InvoiceEditorModal/layout/v2/__tests__/presetLayouts.test.ts
// ============================================================================
// Tests de los 4 layouts V2 por preset — identidad visual real.
//
// Verifica que cada preset tenga CARÁCTER distintivo verificable:
//   · BALANCED — recomendado/default: aside w=5, Total prominente (h>=10),
//                Cobro generoso (h>=7), Observaciones discreta (h<=4).
//   · COMPACT  — densidad alta: aside angosto w=4, todas las cards en su
//                floor mínimo, Observaciones colapsada.
//   · CLASSIC  — ERP tradicional: aside w=5, Total dominante (h>=12),
//                Cobro y Observaciones generosos.
//   · FOCUS    — vista financiera: bloque financiero ARRIBA (totals/
//                payments/account-impact primeros), Total enorme (h>=14)
//                y sticky, secundarios (discount/shipping/coupon) al final.
//
// Y que las diferencias sean visualmente perceptibles entre presets.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  LAYOUT_V2_BALANCED,
  LAYOUT_V2_COMPACT,
  LAYOUT_V2_CLASSIC,
  LAYOUT_V2_FOCUS,
  getDefaultLayoutForPreset,
} from "../presetLayouts";
import { reconcileLayoutV2 } from "../reconcileLayoutV2";
import { LAYOUT_V2_VERSION } from "../types";

const ALL_CARD_IDS = [
  "header", "lines",
  "discount", "shipping", "coupon",
  "totals", "payments", "account-impact", "observations",
] as const;

const ALL_PRESETS = [
  ["BALANCED", LAYOUT_V2_BALANCED],
  ["COMPACT",  LAYOUT_V2_COMPACT],
  ["CLASSIC",  LAYOUT_V2_CLASSIC],
  ["FOCUS",    LAYOUT_V2_FOCUS],
] as const;

describe("LAYOUT_V2_BALANCED — recomendado para uso diario", () => {
  it("contiene las 9 cards canónicas", () => {
    const ids = LAYOUT_V2_BALANCED.cards.map((c) => c.id).sort();
    expect(ids).toEqual([...ALL_CARD_IDS].sort());
  });

  it("aside w=5 (equilibrio entre artículos y panel)", () => {
    const aside = LAYOUT_V2_BALANCED.cards.filter((c) => c.region === "aside");
    expect(aside.every((c) => c.w === 5)).toBe(true);
    const lines = LAYOUT_V2_BALANCED.cards.find((c) => c.id === "lines")!;
    expect(lines.w).toBe(7);
  });

  it("Total prominente (h>=10) y sticky", () => {
    const totals = LAYOUT_V2_BALANCED.cards.find((c) => c.id === "totals")!;
    expect(totals.h).toBeGreaterThanOrEqual(10);
    expect(totals.sticky).toBe(true);
  });

  it("Cobro generoso (h>=7) — cerca del Total", () => {
    const payments = LAYOUT_V2_BALANCED.cards.find((c) => c.id === "payments")!;
    expect(payments.h).toBeGreaterThanOrEqual(7);
  });

  it("Observaciones discreta (h<=4) — al fondo, sin protagonismo", () => {
    const obs = LAYOUT_V2_BALANCED.cards.find((c) => c.id === "observations")!;
    expect(obs.h).toBeLessThanOrEqual(4);
  });
});

describe("LAYOUT_V2_COMPACT — densidad alta para notebooks", () => {
  it("contiene las 9 cards canónicas", () => {
    const ids = LAYOUT_V2_COMPACT.cards.map((c) => c.id).sort();
    expect(ids).toEqual([...ALL_CARD_IDS].sort());
  });

  it("aside w=4 — angosto, líneas dominan (w=8)", () => {
    const aside = LAYOUT_V2_COMPACT.cards.filter((c) => c.region === "aside");
    expect(aside.every((c) => c.w === 4)).toBe(true);
    const lines = LAYOUT_V2_COMPACT.cards.find((c) => c.id === "lines")!;
    expect(lines.w).toBe(8);
  });

  it("cards comerciales en su floor mínimo (h <= 4)", () => {
    const commercialIds = ["discount", "shipping", "coupon", "account-impact"];
    for (const id of commercialIds) {
      const c = LAYOUT_V2_COMPACT.cards.find((x) => x.id === id)!;
      expect(c.h).toBeLessThanOrEqual(4);
    }
  });

  it("Total más pequeño que en otros presets (h<=7)", () => {
    const totals = LAYOUT_V2_COMPACT.cards.find((c) => c.id === "totals")!;
    expect(totals.h).toBeLessThanOrEqual(7);
  });

  it("observations colapsada por default", () => {
    const obs = LAYOUT_V2_COMPACT.cards.find((c) => c.id === "observations")!;
    expect(obs.collapsed).toBe(true);
  });
});

describe("LAYOUT_V2_CLASSIC — ERP tradicional", () => {
  it("contiene las 9 cards canónicas", () => {
    const ids = LAYOUT_V2_CLASSIC.cards.map((c) => c.id).sort();
    expect(ids).toEqual([...ALL_CARD_IDS].sort());
  });

  it("aside w=5 — ancho generoso, lines w=7", () => {
    const aside = LAYOUT_V2_CLASSIC.cards.filter((c) => c.region === "aside");
    expect(aside.every((c) => c.w === 5)).toBe(true);
    const lines = LAYOUT_V2_CLASSIC.cards.find((c) => c.id === "lines")!;
    expect(lines.w).toBe(7);
  });

  it("Total DOMINANTE (h>=12) — claramente mayor a las comerciales", () => {
    const totals = LAYOUT_V2_CLASSIC.cards.find((c) => c.id === "totals")!;
    expect(totals.h).toBeGreaterThanOrEqual(12);
    const commercialIds = ["discount", "shipping", "coupon"];
    for (const id of commercialIds) {
      const c = LAYOUT_V2_CLASSIC.cards.find((x) => x.id === id)!;
      expect(totals.h).toBeGreaterThan(c.h);
    }
  });

  it("cards comerciales con respiración (h >= 5)", () => {
    const commercialIds = ["discount", "shipping", "coupon"];
    for (const id of commercialIds) {
      const c = LAYOUT_V2_CLASSIC.cards.find((x) => x.id === id)!;
      expect(c.h).toBeGreaterThanOrEqual(5);
    }
  });

  it("observations visible y expandida (h >= 6)", () => {
    const obs = LAYOUT_V2_CLASSIC.cards.find((c) => c.id === "observations")!;
    expect(obs.collapsed).toBe(false);
    expect(obs.h).toBeGreaterThanOrEqual(6);
  });
});

describe("LAYOUT_V2_FOCUS — vista financiera (Financiera UI)", () => {
  it("contiene las 9 cards canónicas", () => {
    const ids = LAYOUT_V2_FOCUS.cards.map((c) => c.id).sort();
    expect(ids).toEqual([...ALL_CARD_IDS].sort());
  });

  it("aside w=5 y líneas w=7 — el centro de gravedad se desplaza al aside", () => {
    const aside = LAYOUT_V2_FOCUS.cards.filter((c) => c.region === "aside");
    expect(aside.every((c) => c.w === 5)).toBe(true);
    const lines = LAYOUT_V2_FOCUS.cards.find((c) => c.id === "lines")!;
    expect(lines.w).toBe(7);
  });

  it("Total GIGANTE (h>=14) y sticky — primer foco visual", () => {
    const totals = LAYOUT_V2_FOCUS.cards.find((c) => c.id === "totals")!;
    expect(totals.h).toBeGreaterThanOrEqual(14);
    expect(totals.sticky).toBe(true);
  });

  it("bloque financiero ARRIBA: totals → payments → account-impact (orden por y)", () => {
    const totals   = LAYOUT_V2_FOCUS.cards.find((c) => c.id === "totals")!;
    const payments = LAYOUT_V2_FOCUS.cards.find((c) => c.id === "payments")!;
    const cc       = LAYOUT_V2_FOCUS.cards.find((c) => c.id === "account-impact")!;
    expect(totals.y).toBeLessThan(payments.y);
    expect(payments.y).toBeLessThan(cc.y);
  });

  it("secundarios (discount/shipping/coupon) DESPLAZADOS al final (y > totals.y)", () => {
    const totals = LAYOUT_V2_FOCUS.cards.find((c) => c.id === "totals")!;
    const secondaryIds = ["discount", "shipping", "coupon"];
    for (const id of secondaryIds) {
      const c = LAYOUT_V2_FOCUS.cards.find((x) => x.id === id)!;
      expect(c.y).toBeGreaterThan(totals.y);
    }
  });

  it("Observaciones colapsada al fondo", () => {
    const obs = LAYOUT_V2_FOCUS.cards.find((c) => c.id === "observations")!;
    expect(obs.collapsed).toBe(true);
  });
});

describe("Diferenciación entre presets — identidad visual perceptible", () => {
  it("COMPACT tiene aside MÁS ANGOSTO que BALANCED/CLASSIC/FOCUS", () => {
    const compactAsideW  = LAYOUT_V2_COMPACT.cards.find((c) => c.region === "aside")!.w;
    const balancedAsideW = LAYOUT_V2_BALANCED.cards.find((c) => c.region === "aside")!.w;
    const classicAsideW  = LAYOUT_V2_CLASSIC.cards.find((c) => c.region === "aside")!.w;
    const focusAsideW    = LAYOUT_V2_FOCUS.cards.find((c) => c.region === "aside")!.w;
    expect(compactAsideW).toBeLessThan(balancedAsideW);
    expect(compactAsideW).toBeLessThan(classicAsideW);
    expect(compactAsideW).toBeLessThan(focusAsideW);
  });

  it("FOCUS tiene el Total MÁS ALTO de los 4 presets", () => {
    const heights = {
      balanced: LAYOUT_V2_BALANCED.cards.find((c) => c.id === "totals")!.h,
      compact:  LAYOUT_V2_COMPACT.cards.find((c) => c.id === "totals")!.h,
      classic:  LAYOUT_V2_CLASSIC.cards.find((c) => c.id === "totals")!.h,
      focus:    LAYOUT_V2_FOCUS.cards.find((c) => c.id === "totals")!.h,
    };
    expect(heights.focus).toBeGreaterThan(heights.balanced);
    expect(heights.focus).toBeGreaterThan(heights.compact);
    expect(heights.focus).toBeGreaterThanOrEqual(heights.classic);
  });

  it("Solo FOCUS pone el Total ARRIBA del aside (y mínimo)", () => {
    // En BALANCED/COMPACT/CLASSIC el totals está DESPUÉS de los ajustes;
    // en FOCUS está PRIMERO. Validamos comparando totals.y vs discount.y.
    const cmp = (cfg: typeof LAYOUT_V2_BALANCED) => {
      const totals   = cfg.cards.find((c) => c.id === "totals")!;
      const discount = cfg.cards.find((c) => c.id === "discount")!;
      return totals.y < discount.y;
    };
    expect(cmp(LAYOUT_V2_BALANCED)).toBe(false);
    expect(cmp(LAYOUT_V2_COMPACT)).toBe(false);
    expect(cmp(LAYOUT_V2_CLASSIC)).toBe(false);
    expect(cmp(LAYOUT_V2_FOCUS)).toBe(true);
  });
});

describe("getDefaultLayoutForPreset — mapeo completo (5 presets)", () => {
  it("BALANCED → LAYOUT_V2_BALANCED", () => {
    expect(getDefaultLayoutForPreset("BALANCED")).toBe(LAYOUT_V2_BALANCED);
  });
  it("COMPACT → LAYOUT_V2_COMPACT", () => {
    expect(getDefaultLayoutForPreset("COMPACT")).toBe(LAYOUT_V2_COMPACT);
  });
  it("CLASSIC → LAYOUT_V2_CLASSIC", () => {
    expect(getDefaultLayoutForPreset("CLASSIC")).toBe(LAYOUT_V2_CLASSIC);
  });
  it("SINGLE_COLUMN (Financiera) → LAYOUT_V2_FOCUS", () => {
    expect(getDefaultLayoutForPreset("SINGLE_COLUMN")).toBe(LAYOUT_V2_FOCUS);
  });
  it("CUSTOM → BALANCED como base", () => {
    expect(getDefaultLayoutForPreset("CUSTOM")).toBe(LAYOUT_V2_BALANCED);
  });
});

describe("Validez estructural — los 4 layouts pasan reconcileLayoutV2 sin cambios", () => {
  it.each(ALL_PRESETS)("%s: reconcile no agrega/descarta cards", (_name, layout) => {
    const reconciled = reconcileLayoutV2(layout);
    expect(reconciled.version).toBe(LAYOUT_V2_VERSION);
    expect(reconciled.cards.length).toBe(layout.cards.length);
    expect(reconciled.cards.map((c) => c.id).sort())
      .toEqual(layout.cards.map((c) => c.id).sort());
  });

  it.each(ALL_PRESETS)("%s: header y lines son locked", (_name, layout) => {
    expect(layout.cards.find((c) => c.id === "header")!.locked).toBe(true);
    expect(layout.cards.find((c) => c.id === "lines")!.locked).toBe(true);
  });
});
