// tptech-frontend/src/pages/ventas-facturas/InvoiceEditorModal/layout/__tests__/compactLayout.test.ts
import { describe, it, expect } from "vitest";
import { compactLayoutByVisibility, buildVisibleCardSet } from "../compactLayout";
import type { CardId, LayoutV2, LayoutV2Card } from "../types";

function card(id: CardId, x: number, y: number, w: number, h: number): LayoutV2Card {
  return { id, region: "aside", x, y, w, h, minW: 2, minH: 2 };
}

describe("compactLayoutByVisibility", () => {
  it("cierra huecos cuando una card es ocultada (columna unica)", () => {
    const layout: LayoutV2 = {
      version: 2,
      cards: [
        card("discount", 8, 0,  4, 5),
        card("shipping", 8, 5,  4, 5), // se oculta
        card("coupon",   8, 10, 4, 5),
        card("totals",   8, 15, 4, 8),
      ],
    };
    const visible = new Set<CardId>(["discount", "coupon", "totals"]);
    const result = compactLayoutByVisibility(layout, visible);

    const v = (id: CardId) => result.cards.find((c) => c.id === id)!;
    expect(v("discount").y).toBe(0);
    expect(v("coupon").y).toBe(5);   // antes era y=10, hueco cerrado
    expect(v("totals").y).toBe(10);  // antes era y=15
    // Hidden card preserva su geometria original.
    expect(v("shipping").y).toBe(5);
  });

  it("respeta columnas — cards en columnas distintas no se compactan entre si", () => {
    const layout: LayoutV2 = {
      version: 2,
      cards: [
        card("discount", 8,  0, 2, 5),
        card("shipping", 10, 0, 2, 5),
        card("coupon",   8,  5, 4, 5), // ocupa ambas columnas
      ],
    };
    const visible = new Set<CardId>(["discount", "shipping", "coupon"]);
    const result = compactLayoutByVisibility(layout, visible);
    const v = (id: CardId) => result.cards.find((c) => c.id === id)!;
    // discount + shipping mantienen y=0 (no overlap horizontal entre si).
    expect(v("discount").y).toBe(0);
    expect(v("shipping").y).toBe(0);
    // coupon entra DESPUES de los dos (overlap horizontal con ambos).
    expect(v("coupon").y).toBe(5);
  });

  it("una card recien mostrada se reubica al final del stack", () => {
    const layout: LayoutV2 = {
      version: 2,
      cards: [
        card("discount", 8, 0, 4, 5),
        card("coupon",   8, 8, 4, 5),   // estaba con un hueco previo
        card("shipping", 8, 2, 4, 5),   // newly shown, y=2 obsoleto
      ],
    };
    const visible = new Set<CardId>(["discount", "coupon", "shipping"]);
    const newlyShown = new Set<CardId>(["shipping"]);
    const result = compactLayoutByVisibility(layout, visible, newlyShown);
    const v = (id: CardId) => result.cards.find((c) => c.id === id)!;
    expect(v("discount").y).toBe(0);
    expect(v("coupon").y).toBe(5);
    // shipping al final, despues de discount(5)+coupon(5)=10.
    expect(v("shipping").y).toBe(10);
  });

  it("preserva cards de regiones distintas (header/lines) intactas", () => {
    const layout: LayoutV2 = {
      version: 2,
      cards: [
        { id: "header", region: "header", x: 0, y: 0, w: 12, h: 2 },
        card("discount", 8, 0, 4, 5),
        card("totals",   8, 5, 4, 8),
      ],
    };
    const visible = new Set<CardId>(["totals"]);
    const result = compactLayoutByVisibility(layout, visible);
    const header = result.cards.find((c) => c.id === "header")!;
    expect(header.region).toBe("header");
    expect(header.x).toBe(0);
    expect(header.y).toBe(0);
  });

  it("preserva manuallyResized y otros flags", () => {
    const layout: LayoutV2 = {
      version: 2,
      cards: [
        { ...card("discount", 8, 0, 4, 5), manuallyResized: true },
        card("totals", 8, 8, 4, 10),
      ],
    };
    const visible = new Set<CardId>(["discount", "totals"]);
    const result = compactLayoutByVisibility(layout, visible);
    const discount = result.cards.find((c) => c.id === "discount")!;
    expect(discount.manuallyResized).toBe(true);
  });
});

describe("buildVisibleCardSet", () => {
  it("traduce keys camelCase a CardId kebab-case", () => {
    const set = buildVisibleCardSet({
      discount: true,
      shipping: false,
      coupon: true,
      totals: true,
      payments: false,
      accountImpact: true,
      observations: true,
    });
    expect(set.has("discount")).toBe(true);
    expect(set.has("shipping")).toBe(false);
    expect(set.has("account-impact")).toBe(true);
    expect(set.has("payments")).toBe(false);
  });
});
