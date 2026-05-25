// src/pages/ventas-facturas/InvoiceEditorModal/layout/v2/__tests__/compaction.test.ts
// ============================================================================
// Cobertura del helper de compaction básica (Etapa 4 — resize Pro).
//
// Verifica:
//   · Cards con gap arriba suben hasta tocar la card de arriba (o el techo).
//   · Locked cards NO se mueven.
//   · Cards de OTRAS regions pasan sin tocar (passthrough).
//   · Tiebreaker estable (x, id) para Y iguales.
//   · Idempotencia: compact(compact(x)) === compact(x).
//   · No mutación del input.
// ============================================================================

import { describe, it, expect } from "vitest";
import { compactCardsInRegion } from "../compaction";
import { LAYOUT_V2_CARD_DEFAULTS, type LayoutCardV2 } from "../types";

const base: Omit<LayoutCardV2, "id" | "y"> = {
  region: "aside",
  x: 8, w: 4, h: 4,
  z:         LAYOUT_V2_CARD_DEFAULTS.z,
  sticky:    LAYOUT_V2_CARD_DEFAULTS.sticky,
  collapsed: LAYOUT_V2_CARD_DEFAULTS.collapsed,
  locked:    LAYOUT_V2_CARD_DEFAULTS.locked,
  visible:   LAYOUT_V2_CARD_DEFAULTS.visible,
};

const card = (id: string, y: number, extra: Partial<LayoutCardV2> = {}): LayoutCardV2 => ({
  ...base, id: id as LayoutCardV2["id"], y, ...extra,
});

describe("compactCardsInRegion — comportamiento básico", () => {
  it("una sola card con gap arriba sube al techo (y=0)", () => {
    const out = compactCardsInRegion([card("discount", 20)], "aside");
    expect(out.find((c) => c.id === "discount")?.y).toBe(0);
  });

  it("dos cards consecutivas con gap entre ellas: la segunda sube hasta tocar la primera", () => {
    const out = compactCardsInRegion([
      card("discount", 0, { h: 4 }),
      card("shipping", 20, { h: 4 }), // gap de 16 filas
    ], "aside");
    const shipping = out.find((c) => c.id === "shipping")!;
    expect(shipping.y).toBe(4); // justo debajo de discount (y=0, h=4)
  });

  it("ya compactado: no hace cambios (idempotente)", () => {
    const before: LayoutCardV2[] = [
      card("discount", 0, { h: 4 }),
      card("shipping", 4, { h: 4 }),
      card("coupon",   8, { h: 4 }),
    ];
    const out = compactCardsInRegion(before, "aside");
    expect(out.map((c) => ({ id: c.id, y: c.y })))
      .toEqual(before.map((c) => ({ id: c.id, y: c.y })));
  });

  it("compact(compact(x)) === compact(x)", () => {
    const input: LayoutCardV2[] = [
      card("discount", 10, { h: 4 }),
      card("shipping", 50, { h: 4 }),
      card("coupon",   80, { h: 4 }),
    ];
    const once = compactCardsInRegion(input, "aside");
    const twice = compactCardsInRegion(once, "aside");
    expect(twice).toEqual(once);
  });
});

describe("compactCardsInRegion — locked cards no se mueven", () => {
  it("una card locked en y=10 fija el techo para las que están debajo", () => {
    const out = compactCardsInRegion([
      card("header",   10, { h: 4, locked: true }),
      card("discount", 50, { h: 4 }),
    ], "aside");
    const header = out.find((c) => c.id === "header");
    const discount = out.find((c) => c.id === "discount");
    expect(header?.y).toBe(10); // locked NO se movió
    expect(discount?.y).toBe(14); // subió hasta tocar header (10+4=14)
  });

  it("locked card en y=0 deja a las de abajo subir hasta tocarla", () => {
    const out = compactCardsInRegion([
      card("header",   0, { h: 4, locked: true }),
      card("discount", 30, { h: 4 }),
    ], "aside");
    expect(out.find((c) => c.id === "discount")?.y).toBe(4);
  });
});

describe("compactCardsInRegion — passthrough de otras regions", () => {
  it("cards de region distinta NO se tocan", () => {
    const out = compactCardsInRegion([
      card("discount", 20, { region: "aside" }),
      card("lines",    50, { region: "main", x: 0, w: 8 }),
    ], "aside");
    const lines = out.find((c) => c.id === "lines")!;
    expect(lines.y).toBe(50); // intacta
    expect(lines.region).toBe("main");
    const discount = out.find((c) => c.id === "discount")!;
    expect(discount.y).toBe(0); // compactada
  });
});

describe("compactCardsInRegion — overlap horizontal", () => {
  it("dos cards en columnas distintas (sin overlap X) suben independientemente", () => {
    // Las cards de un aside de 4 cols pueden tener una en x=8,w=2 y otra en
    // x=10,w=2 → no se solapan en X, ambas suben a y=0.
    const out = compactCardsInRegion([
      card("discount", 20, { x: 8,  w: 2 }),
      card("shipping", 30, { x: 10, w: 2 }),
    ], "aside");
    expect(out.find((c) => c.id === "discount")?.y).toBe(0);
    expect(out.find((c) => c.id === "shipping")?.y).toBe(0);
  });

  it("dos cards con overlap X parcial respetan el bottom de la primera", () => {
    const out = compactCardsInRegion([
      card("discount", 0,  { x: 8, w: 3, h: 5 }), // ocupa cols 8..10
      card("shipping", 30, { x: 9, w: 3, h: 4 }), // ocupa cols 9..11 (overlap en 9,10)
    ], "aside");
    expect(out.find((c) => c.id === "discount")?.y).toBe(0);
    // Shipping debe quedar después de discount (y=5).
    expect(out.find((c) => c.id === "shipping")?.y).toBe(5);
  });
});

describe("compactCardsInRegion — invariantes", () => {
  it("NO muta el input", () => {
    const input: LayoutCardV2[] = [card("discount", 30)];
    const before = JSON.parse(JSON.stringify(input));
    compactCardsInRegion(input, "aside");
    expect(input).toEqual(before);
  });

  it("preserva cantidad y ids de cards", () => {
    const input: LayoutCardV2[] = [
      card("discount", 20),
      card("shipping", 40),
      card("coupon",   60),
      card("lines",    0, { region: "main", x: 0, w: 8 }),
    ];
    const out = compactCardsInRegion(input, "aside");
    expect(out.length).toBe(input.length);
    expect(out.map((c) => c.id).sort()).toEqual(input.map((c) => c.id).sort());
  });
});
