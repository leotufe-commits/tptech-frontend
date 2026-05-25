// src/pages/ventas-facturas/InvoiceEditorModal/layout/v2/__tests__/layoutV2.test.ts
// ============================================================================
// Cobertura del contrato Layout V2:
//   · migrateV1ToV2 — agrega defaults extendidos (z, sticky, collapsed,
//     region, locked structural).
//   · reconcileLayoutV2 — preserva region, defaultea opcionales, descarta
//     ids desconocidos, anti-corrupción de structural-locked.
//   · reconcileLayoutAny — dispatcher por version: v1→migrate, v2→reconcile,
//     blob inválido→defaults.
//   · Idempotencia: reconcile(reconcile(x)) === reconcile(x).
// ============================================================================

import { describe, it, expect } from "vitest";
import { DEFAULT_LAYOUT } from "../../defaults";
import { migrateV1ToV2, v2WidthToV1Width } from "../migrateV1ToV2";
import { reconcileLayoutV2, reconcileLayoutAny, getCardsByRegion } from "../reconcileLayoutV2";
import { v2ToV1 } from "../v2ToV1";
import { DEFAULT_LAYOUT_V2 } from "../defaults";
import {
  LAYOUT_V2_CARD_DEFAULTS,
  LAYOUT_V2_GRID_DEFAULT,
  LAYOUT_V2_VERSION,
  type LayoutV2Config,
} from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// 1) migrateV1ToV2 — agrega defaults nuevos
// ─────────────────────────────────────────────────────────────────────────────

describe("migrateV1ToV2 — defaults extendidos", () => {
  it("aplica defaults z=0 / sticky=false / collapsed=false / visible=true a cada card", () => {
    const v2 = migrateV1ToV2(DEFAULT_LAYOUT);
    for (const c of v2.cards) {
      expect(c.z).toBe(LAYOUT_V2_CARD_DEFAULTS.z);
      expect(c.sticky).toBe(LAYOUT_V2_CARD_DEFAULTS.sticky);
      expect(c.collapsed).toBe(LAYOUT_V2_CARD_DEFAULTS.collapsed);
      expect(c.visible).toBe(LAYOUT_V2_CARD_DEFAULTS.visible);
    }
  });

  it("mapea slot → region: top→header · main→main · aside→aside · bottom→footer", () => {
    const v1 = {
      version: 1,
      cards: [
        { id: "header",       slot: "top",    order: 0, width: "full" },
        { id: "lines",        slot: "main",   order: 0, width: "full" },
        { id: "discount",     slot: "aside",  order: 0, width: "full" },
        { id: "observations", slot: "bottom", order: 0, width: "full" },
      ],
    } as const;
    const v2 = migrateV1ToV2(v1);
    const byId = new Map(v2.cards.map((c) => [c.id, c]));
    expect(byId.get("header")?.region).toBe("header");
    expect(byId.get("lines")?.region).toBe("main");
    expect(byId.get("discount")?.region).toBe("aside");
    expect(byId.get("observations")?.region).toBe("footer");
  });

  it("cards estructurales (header/lines) reciben locked=true SIEMPRE", () => {
    const v2 = migrateV1ToV2(DEFAULT_LAYOUT);
    const header = v2.cards.find((c) => c.id === "header");
    const lines  = v2.cards.find((c) => c.id === "lines");
    expect(header?.locked).toBe(true);
    expect(lines?.locked).toBe(true);
  });

  it("cards no-estructurales (discount/totals/observations) NO se lockean", () => {
    const v2 = migrateV1ToV2(DEFAULT_LAYOUT);
    expect(v2.cards.find((c) => c.id === "discount")?.locked).toBe(false);
    expect(v2.cards.find((c) => c.id === "totals")?.locked).toBe(false);
    expect(v2.cards.find((c) => c.id === "observations")?.locked).toBe(false);
  });

  it("mapea width → w: aside usa bloque de 4 columnas, otras regions usan 12", () => {
    const v1 = {
      version: 1,
      cards: [
        { id: "header",       slot: "top",    order: 0, width: "full" },        // 12
        { id: "lines",        slot: "main",   order: 0, width: "half" },        // 6
        { id: "discount",     slot: "aside",  order: 0, width: "full" },        // 4
        { id: "totals",       slot: "aside",  order: 1, width: "half" },        // 2
        { id: "coupon",       slot: "aside",  order: 2, width: "third" },       // 1
        { id: "shipping",     slot: "aside",  order: 3, width: "two-thirds" },  // 3
      ],
    } as const;
    const v2 = migrateV1ToV2(v1);
    const byId = new Map(v2.cards.map((c) => [c.id, c]));
    expect(byId.get("header")?.w).toBe(12);
    expect(byId.get("lines")?.w).toBe(6);
    expect(byId.get("discount")?.w).toBe(4);
    expect(byId.get("totals")?.w).toBe(2);
    expect(byId.get("coupon")?.w).toBe(1);
    expect(byId.get("shipping")?.w).toBe(3);
  });

  it("preserva el orden del slot al asignar Y en cascada", () => {
    const v1 = {
      version: 1,
      cards: [
        { id: "discount", slot: "aside", order: 0, width: "full" },
        { id: "shipping", slot: "aside", order: 1, width: "full" },
        { id: "coupon",   slot: "aside", order: 2, width: "full" },
      ],
    } as const;
    const v2 = migrateV1ToV2(v1);
    const asideOrdered = v2.cards
      .filter((c) => c.region === "aside")
      .sort((a, b) => a.y - b.y);
    expect(asideOrdered.map((c) => c.id)).toEqual(["discount", "shipping", "coupon"]);
    // Cada card arranca donde termina la anterior (cursorY acumulativo).
    for (let i = 1; i < asideOrdered.length; i++) {
      const prev = asideOrdered[i - 1];
      expect(asideOrdered[i].y).toBe(prev.y + prev.h);
    }
  });

  it("X base por región: aside arranca en col 8; resto en col 0", () => {
    const v2 = migrateV1ToV2(DEFAULT_LAYOUT);
    const xByRegion = v2.cards.map((c) => ({
      id:           c.id,
      region:       c.region,
      expectedX:    c.region === "aside" ? 8 : 0,
      x:            c.x,
    }));
    // Comparamos la pareja (expectedX, x) en lugar de un if-expect dentro
    // del loop (ESLint vitest/no-conditional-expect).
    expect(xByRegion.map((r) => r.x)).toEqual(xByRegion.map((r) => r.expectedX));
  });

  it("emite version=2 y presetBase/grid del DEFAULT_LAYOUT_V2", () => {
    const v2 = migrateV1ToV2(DEFAULT_LAYOUT);
    expect(v2.version).toBe(LAYOUT_V2_VERSION);
    expect(v2.presetBase).toBe(DEFAULT_LAYOUT_V2.presetBase);
    expect(v2.grid).toEqual(DEFAULT_LAYOUT_V2.grid);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2-6) reconcileLayoutV2 — defaults para campos undefined
// ─────────────────────────────────────────────────────────────────────────────

describe("reconcileLayoutV2 — defaults para campos opcionales undefined", () => {
  it("cards sin region reciben 'main'", () => {
    const saved = {
      version: 2,
      presetBase: "COMPACT",
      grid: LAYOUT_V2_GRID_DEFAULT,
      cards: [
        { id: "discount", x: 0, y: 0, w: 4, h: 4 /* sin region */ },
      ],
    };
    const out = reconcileLayoutV2(saved);
    const card = out.cards.find((c) => c.id === "discount");
    expect(card?.region).toBe("main");
  });

  it("sticky undefined → fallback al default del id (discount default = false)", () => {
    // Usamos `discount` porque en el DEFAULT_LAYOUT_V2 (BALANCED) tiene
    // sticky=false. `totals` no sirve para este test porque BALANCED lo
    // marca como sticky:true → fallback hereda true (comportamiento OK).
    const saved = {
      version: 2,
      cards: [{ id: "discount", region: "aside", x: 8, y: 0, w: 4, h: 4 }],
    };
    const out = reconcileLayoutV2(saved);
    expect(out.cards.find((c) => c.id === "discount")?.sticky).toBe(false);
  });

  it("collapsed undefined → false", () => {
    const saved = {
      version: 2,
      cards: [{ id: "observations", region: "aside", x: 8, y: 0, w: 4, h: 6 }],
    };
    const out = reconcileLayoutV2(saved);
    expect(out.cards.find((c) => c.id === "observations")?.collapsed).toBe(false);
  });

  it("z undefined → 0", () => {
    const saved = {
      version: 2,
      cards: [{ id: "coupon", region: "aside", x: 8, y: 0, w: 4, h: 4 }],
    };
    const out = reconcileLayoutV2(saved);
    expect(out.cards.find((c) => c.id === "coupon")?.z).toBe(0);
  });

  it("visible undefined → true (no oculta cards por accidente)", () => {
    const saved = {
      version: 2,
      cards: [{ id: "shipping", region: "aside", x: 8, y: 0, w: 4, h: 4 }],
    };
    const out = reconcileLayoutV2(saved);
    expect(out.cards.find((c) => c.id === "shipping")?.visible).toBe(true);
  });

  it("region inválida cae a default 'main'", () => {
    const saved = {
      version: 2,
      cards: [
        { id: "discount", region: "FAKE_REGION", x: 0, y: 0, w: 4, h: 4 },
      ],
    };
    const out = reconcileLayoutV2(saved);
    expect(out.cards.find((c) => c.id === "discount")?.region).toBe("main");
  });

  it("preserva region cuando es válida (no la fuerza al default)", () => {
    const saved = {
      version: 2,
      cards: [
        { id: "totals", region: "footer", x: 0, y: 0, w: 12, h: 8 },
      ],
    };
    const out = reconcileLayoutV2(saved);
    expect(out.cards.find((c) => c.id === "totals")?.region).toBe("footer");
  });

  it("respeta valores explícitos sticky=true / collapsed=true / z=5 / visible=false", () => {
    const saved = {
      version: 2,
      cards: [
        {
          id: "totals", region: "aside", x: 8, y: 0, w: 4, h: 8,
          sticky: true, collapsed: true, z: 5, visible: false,
        },
      ],
    };
    const out = reconcileLayoutV2(saved);
    const card = out.cards.find((c) => c.id === "totals");
    expect(card?.sticky).toBe(true);
    expect(card?.collapsed).toBe(true);
    expect(card?.z).toBe(5);
    expect(card?.visible).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7) Layouts viejos no rompen (back-compat dispatcher)
// ─────────────────────────────────────────────────────────────────────────────

describe("reconcileLayoutAny — dispatcher por version (back-compat layouts viejos)", () => {
  it("layout V1 persistido se migra a V2 sin romper (resultado válido)", () => {
    const v1Saved = {
      version: 1,
      cards: [
        { id: "header",       slot: "top",    order: 0, width: "full" },
        { id: "lines",        slot: "main",   order: 0, width: "full" },
        { id: "discount",     slot: "aside",  order: 0, width: "full" },
        { id: "observations", slot: "bottom", order: 0, width: "full" },
      ],
    };
    const out = reconcileLayoutAny(v1Saved);
    expect(out.version).toBe(LAYOUT_V2_VERSION);
    // Cards V1 migradas + cards default V2 que faltaban (totals, shipping,
    // coupon, payments, account-impact) se agregan al final de su region.
    const ids = out.cards.map((c) => c.id).sort();
    expect(ids).toContain("header");
    expect(ids).toContain("lines");
    expect(ids).toContain("discount");
    expect(ids).toContain("observations");
    expect(ids).toContain("totals");
    expect(ids).toContain("payments");
    expect(ids).toContain("account-impact");
    // Regions estructurales correctamente mapeadas.
    expect(out.cards.find((c) => c.id === "header")?.region).toBe("header");
    expect(out.cards.find((c) => c.id === "lines")?.region).toBe("main");
    expect(out.cards.find((c) => c.id === "discount")?.region).toBe("aside");
    // `observations` puede aterrizar en "aside" o "footer" según cómo el
    // reconcile V1 trate el slot "bottom" (la pre-migración interna del
    // V1 mueve observations a aside; un blob V1 antiguo SIN esa
    // pre-migración aplicada mantendría bottom→footer). Lo único que
    // garantizamos: termina en una region válida y locked=false.
    const observations = out.cards.find((c) => c.id === "observations")!;
    expect(["aside", "footer"]).toContain(observations.region);
    expect(observations.locked).toBe(false);
  });

  it("layout V2 persistido pasa directo por reconcileLayoutV2", () => {
    const v2Saved = {
      version: 2,
      presetBase: "CLASSIC",
      grid: LAYOUT_V2_GRID_DEFAULT,
      cards: [
        { id: "totals", region: "aside", x: 8, y: 0, w: 4, h: 8, sticky: true },
      ],
    };
    const out = reconcileLayoutAny(v2Saved);
    expect(out.version).toBe(LAYOUT_V2_VERSION);
    expect(out.presetBase).toBe("CLASSIC");
    expect(out.cards.find((c) => c.id === "totals")?.sticky).toBe(true);
  });

  it("saved=null → defaults V2 sin tirar", () => {
    expect(reconcileLayoutAny(null)).toEqual(DEFAULT_LAYOUT_V2);
  });

  it("saved con version desconocida (futura) → defaults V2", () => {
    const out = reconcileLayoutAny({ version: 99, cards: [] });
    expect(out).toEqual(DEFAULT_LAYOUT_V2);
  });

  it("saved totalmente corrupto → defaults V2", () => {
    expect(reconcileLayoutAny("garbage")).toEqual(DEFAULT_LAYOUT_V2);
    expect(reconcileLayoutAny(123)).toEqual(DEFAULT_LAYOUT_V2);
    expect(reconcileLayoutAny([])).toEqual(DEFAULT_LAYOUT_V2);
  });

  it("ids desconocidos persistidos se descartan silenciosamente", () => {
    const saved = {
      version: 2,
      cards: [
        { id: "discount", region: "aside", x: 8, y: 0, w: 4, h: 4 },
        { id: "FAKE_CARD", region: "main", x: 0, y: 0, w: 4, h: 4 },
      ],
    };
    const out = reconcileLayoutAny(saved);
    expect(out.cards.find((c) => c.id === "discount")).toBeDefined();
    expect(out.cards.find((c) => (c.id as string) === "FAKE_CARD")).toBeUndefined();
  });

  it("structural locked anti-corrupción: header/lines se relockean aunque saved diga locked=false", () => {
    const saved = {
      version: 2,
      cards: [
        { id: "header", region: "header", x: 0, y: 0, w: 12, h: 4, locked: false },
        { id: "lines",  region: "main",   x: 0, y: 4, w: 8,  h: 20, locked: false },
      ],
    };
    const out = reconcileLayoutAny(saved);
    expect(out.cards.find((c) => c.id === "header")?.locked).toBe(true);
    expect(out.cards.find((c) => c.id === "lines")?.locked).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8) Idempotencia
// ─────────────────────────────────────────────────────────────────────────────

describe("reconcileLayoutV2 — idempotencia", () => {
  it("reconcile(reconcile(x)) === reconcile(x) — fixture V2 completo", () => {
    const x = reconcileLayoutV2({
      version: 2,
      presetBase: "COMPACT",
      grid: LAYOUT_V2_GRID_DEFAULT,
      cards: [
        { id: "totals", region: "aside", x: 8, y: 0, w: 4, h: 8, sticky: true, z: 2 },
      ],
    });
    const y = reconcileLayoutV2(x);
    expect(y).toEqual(x);
  });

  it("reconcileAny(reconcileAny(v1_blob)) === reconcileAny(v1_blob) — migra y luego idempotente", () => {
    const v1Saved = {
      version: 1,
      cards: [
        { id: "header",       slot: "top",    order: 0, width: "full" },
        { id: "lines",        slot: "main",   order: 0, width: "full" },
        { id: "discount",     slot: "aside",  order: 0, width: "full" },
      ],
    };
    const x = reconcileLayoutAny(v1Saved);
    const y = reconcileLayoutAny(x);
    expect(y).toEqual(x);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9) Pase 2 — cards faltantes se agregan al final de su region sin overlap
// ─────────────────────────────────────────────────────────────────────────────

describe("reconcileLayoutV2 — cards faltantes se appendean por region", () => {
  it("saved con SOLO 'totals' → reconcile agrega las demás del default V2", () => {
    const saved = {
      version: 2,
      cards: [{ id: "totals", region: "aside", x: 8, y: 0, w: 4, h: 8 }],
    };
    const out = reconcileLayoutV2(saved);
    expect(out.cards.length).toBeGreaterThanOrEqual(DEFAULT_LAYOUT_V2.cards.length);
    // 'totals' conserva su entrada de saved (sin reescribir Y).
    expect(out.cards.find((c) => c.id === "totals")?.y).toBe(0);
    // 'discount' aparece (no estaba en saved), con y >= 8 (después de totals
    // en la region aside, donde max(y+h)=0+8=8).
    const discount = out.cards.find((c) => c.id === "discount");
    expect(discount).toBeDefined();
    expect(discount!.y).toBeGreaterThanOrEqual(8);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10) Grid defaults defensivos
// ─────────────────────────────────────────────────────────────────────────────

describe("reconcileLayoutV2 — grid", () => {
  it("grid inválido cae al default (12/16/12)", () => {
    const out = reconcileLayoutV2({ version: 2, cards: [], grid: "garbage" });
    expect(out.grid).toEqual(LAYOUT_V2_GRID_DEFAULT);
  });

  it("columns inválido (=0) cae al default 12", () => {
    const out = reconcileLayoutV2({
      version: 2, cards: [],
      grid: { columns: 0, rowHeight: 16, gap: 12 },
    });
    expect(out.grid.columns).toBe(LAYOUT_V2_GRID_DEFAULT.columns);
  });

  it("preserva grid custom válido", () => {
    const out = reconcileLayoutV2({
      version: 2, cards: [],
      grid: { columns: 24, rowHeight: 10, gap: 8 },
    });
    expect(out.grid).toEqual({ columns: 24, rowHeight: 10, gap: 8 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11) presetBase defensivo
// ─────────────────────────────────────────────────────────────────────────────

describe("reconcileLayoutV2 — presetBase", () => {
  it("presetBase inválido cae al default", () => {
    const out = reconcileLayoutV2({
      version: 2, cards: [], presetBase: "TOTALLY_FAKE",
    });
    expect(out.presetBase).toBe(DEFAULT_LAYOUT_V2.presetBase);
  });

  it("preserva presetBase válido", () => {
    const out = reconcileLayoutV2({
      version: 2, cards: [], presetBase: "CLASSIC",
    });
    expect(out.presetBase).toBe("CLASSIC");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12) getCardsByRegion — iteración por region (helper para render Etapa 2)
// ─────────────────────────────────────────────────────────────────────────────

describe("getCardsByRegion", () => {
  it("filtra cards por region y las ordena por y", () => {
    const out = getCardsByRegion(DEFAULT_LAYOUT_V2, "aside");
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((c) => c.region === "aside")).toBe(true);
    for (let i = 1; i < out.length; i++) {
      expect(out[i].y).toBeGreaterThanOrEqual(out[i - 1].y);
    }
  });

  it("respeta el orden visual del DEFAULT_LAYOUT_V2 (aside completo)", () => {
    const ids = getCardsByRegion(DEFAULT_LAYOUT_V2, "aside").map((c) => c.id);
    expect(ids).toEqual([
      "discount", "shipping", "coupon", "totals",
      "payments", "account-impact", "observations",
    ]);
  });

  it("region sin cards → []", () => {
    expect(getCardsByRegion(DEFAULT_LAYOUT_V2, "footer")).toEqual([]);
  });

  it("region 'header' → solo el header", () => {
    const out = getCardsByRegion(DEFAULT_LAYOUT_V2, "header");
    expect(out.map((c) => c.id)).toEqual(["header"]);
  });

  it("region 'main' → solo lines", () => {
    const out = getCardsByRegion(DEFAULT_LAYOUT_V2, "main");
    expect(out.map((c) => c.id)).toEqual(["lines"]);
  });

  it("tiebreaker estable (mismo y) → ordena por x luego por id", () => {
    const layout = {
      ...DEFAULT_LAYOUT_V2,
      cards: [
        { ...DEFAULT_LAYOUT_V2.cards[0], id: "discount", region: "aside" as const, x: 8, y: 0, w: 4, h: 4 },
        { ...DEFAULT_LAYOUT_V2.cards[0], id: "shipping", region: "aside" as const, x: 0, y: 0, w: 4, h: 4 },
      ],
    };
    const ids = getCardsByRegion(layout, "aside").map((c) => c.id);
    expect(ids).toEqual(["shipping", "discount"]); // x menor primero
  });

  it("NO muta el layout de entrada", () => {
    const before = JSON.parse(JSON.stringify(DEFAULT_LAYOUT_V2));
    getCardsByRegion(DEFAULT_LAYOUT_V2, "aside");
    expect(DEFAULT_LAYOUT_V2).toEqual(before);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13) v2WidthToV1Width — inverso para componentes V1 (Etapa 2)
// ─────────────────────────────────────────────────────────────────────────────

describe("v2WidthToV1Width", () => {
  it("aside: 4=full, 3=two-thirds, 2=half, 1=third (mapeo canónico)", () => {
    expect(v2WidthToV1Width(4, "aside")).toBe("full");
    expect(v2WidthToV1Width(3, "aside")).toBe("two-thirds");
    expect(v2WidthToV1Width(2, "aside")).toBe("half");
    expect(v2WidthToV1Width(1, "aside")).toBe("third");
  });

  it("non-aside: 12=full, 8=two-thirds, 6=half, 4=third", () => {
    expect(v2WidthToV1Width(12, "main")).toBe("full");
    expect(v2WidthToV1Width(8,  "main")).toBe("two-thirds");
    expect(v2WidthToV1Width(6,  "main")).toBe("half");
    expect(v2WidthToV1Width(4,  "main")).toBe("third");
    expect(v2WidthToV1Width(12, "header")).toBe("full");
    expect(v2WidthToV1Width(12, "footer")).toBe("full");
  });

  it("valores intermedios snapean al bucket más cercano por debajo", () => {
    // aside: 4=full upper bound; valores entre buckets caen al inmediato inferior.
    expect(v2WidthToV1Width(5, "aside")).toBe("full");         // ≥4
    expect(v2WidthToV1Width(2.5, "aside")).toBe("half");       // ≥2
    expect(v2WidthToV1Width(0,   "aside")).toBe("third");      // fallback
    // main: 7 cae a half (≥6); 5 cae a third (<6).
    expect(v2WidthToV1Width(7, "main")).toBe("half");
    expect(v2WidthToV1Width(5, "main")).toBe("third");
  });

  // Tests del round-trip completo se agregan al bloque de `v2ToV1` abajo.

  it("round-trip canónico: V1 → migrateV1ToV2 → v2WidthToV1Width === V1 original", () => {
    // Para cada (width, slot) canónico de V1, la migración y la inversa
    // deben coincidir bit a bit.
    const v1 = {
      version: 1,
      cards: [
        { id: "header",       slot: "top",   order: 0, width: "full" as const },
        { id: "lines",        slot: "main",  order: 0, width: "half" as const },
        { id: "discount",     slot: "aside", order: 0, width: "full" as const },
        { id: "shipping",     slot: "aside", order: 1, width: "two-thirds" as const },
        { id: "coupon",       slot: "aside", order: 2, width: "half" as const },
        { id: "totals",       slot: "aside", order: 3, width: "third" as const },
      ],
    };
    const v2 = migrateV1ToV2(v1);
    for (const v2card of v2.cards) {
      const originalV1Card = v1.cards.find((c) => c.id === v2card.id)!;
      expect(v2WidthToV1Width(v2card.w, v2card.region)).toBe(originalV1Card.width);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 14) v2ToV1 — proyección inversa (back-compat con consumidores V1)
// ─────────────────────────────────────────────────────────────────────────────

describe("v2ToV1", () => {
  it("DEFAULT_LAYOUT_V2 → V1 con todas las cards del default", () => {
    const v1 = v2ToV1(DEFAULT_LAYOUT_V2);
    expect(v1.version).toBe(1);
    expect(v1.cards.length).toBe(DEFAULT_LAYOUT_V2.cards.length);
    // Header y lines presentes.
    expect(v1.cards.find((c) => c.id === "header")?.slot).toBe("top");
    expect(v1.cards.find((c) => c.id === "lines")?.slot).toBe("main");
  });

  it("mapea region → slot: header→top · main→main · aside→aside · footer→bottom", () => {
    const v2: LayoutV2Config = {
      ...DEFAULT_LAYOUT_V2,
      cards: [
        { ...DEFAULT_LAYOUT_V2.cards[0], id: "header",       region: "header", x: 0, y: 0, w: 12, h: 4, locked: true },
        { ...DEFAULT_LAYOUT_V2.cards[0], id: "lines",        region: "main",   x: 0, y: 4, w: 12, h: 20, locked: true },
        { ...DEFAULT_LAYOUT_V2.cards[0], id: "discount",     region: "aside",  x: 8, y: 0, w: 4,  h: 4 },
        { ...DEFAULT_LAYOUT_V2.cards[0], id: "observations", region: "footer", x: 0, y: 0, w: 12, h: 6 },
      ],
    };
    const v1 = v2ToV1(v2);
    const bySlot = new Map(v1.cards.map((c) => [c.id, c.slot]));
    expect(bySlot.get("header")).toBe("top");
    expect(bySlot.get("lines")).toBe("main");
    expect(bySlot.get("discount")).toBe("aside");
    expect(bySlot.get("observations")).toBe("bottom");
  });

  it("asigna order por orden visual (sort por y) dentro de cada region", () => {
    // Cards con `y` desordenado a propósito.
    const v2: LayoutV2Config = {
      ...DEFAULT_LAYOUT_V2,
      cards: [
        { ...DEFAULT_LAYOUT_V2.cards[0], id: "shipping", region: "aside", x: 8, y: 20, w: 4, h: 4 },
        { ...DEFAULT_LAYOUT_V2.cards[0], id: "discount", region: "aside", x: 8, y: 0,  w: 4, h: 4 },
        { ...DEFAULT_LAYOUT_V2.cards[0], id: "coupon",   region: "aside", x: 8, y: 10, w: 4, h: 4 },
      ],
    };
    const v1 = v2ToV1(v2);
    const aside = v1.cards
      .filter((c) => c.slot === "aside")
      .sort((a, b) => a.order - b.order);
    expect(aside.map((c) => c.id)).toEqual(["discount", "coupon", "shipping"]);
    // Orders consecutivos 0..N.
    expect(aside.map((c) => c.order)).toEqual([0, 1, 2]);
  });

  it("round-trip V1 → migrateV1ToV2 → v2ToV1 preserva ids/orden/slots/widths canónicos", () => {
    const v1 = {
      version: 1 as const,
      cards: [
        { id: "header" as const,   slot: "top" as const,   order: 0, width: "full" as const },
        { id: "lines" as const,    slot: "main" as const,  order: 0, width: "full" as const },
        { id: "discount" as const, slot: "aside" as const, order: 0, width: "full" as const },
        { id: "shipping" as const, slot: "aside" as const, order: 1, width: "half" as const },
        { id: "totals" as const,   slot: "aside" as const, order: 2, width: "two-thirds" as const },
      ],
    };
    const back = v2ToV1(migrateV1ToV2(v1));
    // IDs/slots y orden por slot preservados.
    for (const orig of v1.cards) {
      const recovered = back.cards.find((c) => c.id === orig.id);
      expect(recovered).toBeDefined();
      expect(recovered!.slot).toBe(orig.slot);
      expect(recovered!.width).toBe(orig.width);
    }
    // Orden estable: same lista en mismo orden.
    expect(back.cards.map((c) => c.id)).toEqual(v1.cards.map((c) => c.id));
  });

  it("NO muta el input V2", () => {
    const before = JSON.parse(JSON.stringify(DEFAULT_LAYOUT_V2));
    v2ToV1(DEFAULT_LAYOUT_V2);
    expect(DEFAULT_LAYOUT_V2).toEqual(before);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 15) Jerarquía visual canónica del aside (post-reorden comercial)
//
// El orden del aside refleja el flujo de pensamiento del operador:
//   1-3: ajustes comerciales (Bonificación · Envío · Cupón)
//   4:   resultado económico ← `totals` es el card PRINCIPAL (más alto)
//   5:   ejecución del cobro
//   6:   impacto financiero (cuenta corriente)
//   7:   observaciones (al final, contenido contextual)
//
// Estos tests fijan la jerarquía contra regresiones accidentales del default.
// ─────────────────────────────────────────────────────────────────────────────

describe("DEFAULT_LAYOUT_V2 — jerarquía visual canónica del aside", () => {
  it("orden del aside: Bonificación → Envío → Cupón → Total → Cobro → Impacto CC → Observaciones", () => {
    const aside = getCardsByRegion(DEFAULT_LAYOUT_V2, "aside");
    expect(aside.map((c) => c.id)).toEqual([
      "discount",        // 1. Bonificación
      "shipping",        // 2. Envío
      "coupon",          // 3. Cupón
      "totals",          // 4. ★ Total del comprobante (card principal)
      "payments",        // 5. Cobro
      "account-impact",  // 6. Impacto en cuenta corriente
      "observations",    // 7. (al final)
    ]);
  });

  it("totals es el card MÁS ALTO del aside (protagonista visual)", () => {
    const aside = getCardsByRegion(DEFAULT_LAYOUT_V2, "aside");
    const totals = aside.find((c) => c.id === "totals")!;
    for (const card of aside) {
      if (card.id === "totals") continue;
      expect(totals.h).toBeGreaterThanOrEqual(card.h);
    }
    // h específico esperado del default (BALANCED) — invariante explícita.
    expect(totals.h).toBe(11);
  });

  it("totals tiene minH=8 (BALANCED eleva el floor para no achicarse demasiado)", () => {
    const totals = DEFAULT_LAYOUT_V2.cards.find((c) => c.id === "totals")!;
    expect(totals.minH).toBe(8);
  });

  it("cards del aside están packeadas sin gaps (cada y_n = y_{n-1} + h_{n-1})", () => {
    const aside = getCardsByRegion(DEFAULT_LAYOUT_V2, "aside");
    for (let i = 1; i < aside.length; i++) {
      const prev = aside[i - 1];
      expect(aside[i].y).toBe(prev.y + prev.h);
    }
  });
});
