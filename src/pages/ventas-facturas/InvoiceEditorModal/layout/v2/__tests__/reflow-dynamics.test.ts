// tptech-frontend/src/pages/ventas-facturas/InvoiceEditorModal/layout/v2/__tests__/reflow-dynamics.test.ts
// ============================================================================
// Tests dinámicos del reflow del layout V2 (Etapa 4 — cierre layout).
//
// Cubre escenarios reales que el operador percibe en la UI:
//   1. Card colapsado (TPCard.open=false) → slot achica a minH del SSOT
//      → cards inferiores suben.
//   2. Card expandido (open=true) → slot vuelve a su altura natural
//      → cards inferiores bajan.
//   3. Agregar forma de pago → card Cobro crece → cards inferiores bajan.
//   4. Eliminar forma de pago → card Cobro encoge → cards inferiores suben.
//   5. Layout legacy con minH alto (heredado de ROW=32) → reconcileLayout
//      re-clampa contra SSOT actual.
//   6. Spacing uniforme entre presets (ningun preset emite gaps "extras"
//      en cards colapsadas).
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  compactVerticallyByRegion,
  recalculateCardHeight,
  reflowLayoutAfterCardChange,
  decideStabilityCommit,
} from "../reflowLayout";
import { reconcileLayout } from "../../reconcileLayout";
import { CARD_CONSTRAINTS } from "../cardConstraints";
import { getDefaultLayoutForPreset } from "../presetLayouts";
import { GRID_ROW_HEIGHT_PX, CARD_GAP_Y_PX } from "../spacing";
import type { LayoutV2, LayoutV2Card } from "../../types";

// Parametros del grid actuales (SSOT) — se importan en lugar de hardcodear
// para que cualquier cambio futuro de ROW_HEIGHT/GAP no descalibre el test.
const ROW = GRID_ROW_HEIGHT_PX;
const GAP = CARD_GAP_Y_PX;
// Tolerancia chica para grow (1 row). El motor real usa GRID_MARGIN[1]=8.
const TOL = GAP;

/** Altura en px de un card de `h` filas (formula del grid). */
function pxForRows(h: number): number {
  return h * ROW + (h - 1) * GAP;
}

describe("Etapa 4 — Reflow dinamico (colapsar / expandir / pagos)", () => {

  // ──────────────────────────────────────────────────────────────────────
  // 1. Colapso de un card → shrink al floor del SSOT.
  // ──────────────────────────────────────────────────────────────────────
  it("colapsar Bonificacion (open=false) → recalculateCardHeight devuelve floor del SSOT", () => {
    // Setup: discount con altura expandida h=7 (188px).
    const card: LayoutV2Card = {
      id: "discount",
      region: "aside",
      x: 8, y: 0, w: 4, h: 7,
      minW: CARD_CONSTRAINTS.discount.minW,
      minH: CARD_CONSTRAINTS.discount.minH,
    };
    // Contenido medido al colapsar: header only ~28px (TPCard cerrado).
    const measuredCollapsedPx = 28;

    const newH = recalculateCardHeight({
      card,
      measuredPx: measuredCollapsedPx,
      rowHeightPx: ROW,
      marginYPx: GAP,
      toleranceGrowPx: TOL,
    });

    expect(newH).not.toBeNull();
    // Debe achicarse al floor del SSOT (no se queda atascado en 7).
    expect(newH).toBe(CARD_CONSTRAINTS.discount.minH);
  });

  it("colapsar Cobro (payments) achica a 2 filas (~48px) — antes quedaba en 8 (~184px)", () => {
    const card: LayoutV2Card = {
      id: "payments",
      region: "aside",
      x: 8, y: 0, w: 4, h: 7,
      minW: CARD_CONSTRAINTS.payments.minW,
      minH: CARD_CONSTRAINTS.payments.minH,
    };
    const newH = recalculateCardHeight({
      card,
      measuredPx: 28,
      rowHeightPx: ROW,
      marginYPx: GAP,
      toleranceGrowPx: TOL,
    });
    expect(newH).toBe(2);
    expect(pxForRows(newH!)).toBeLessThanOrEqual(50);
  });

  // ──────────────────────────────────────────────────────────────────────
  // 2. Expansion de un card → grow.
  // ──────────────────────────────────────────────────────────────────────
  it("expandir un card colapsado (open=true) crece a la altura del contenido medido", () => {
    const card: LayoutV2Card = {
      id: "discount",
      region: "aside",
      x: 8, y: 0, w: 4, h: 2,
      minW: CARD_CONSTRAINTS.discount.minW,
      minH: CARD_CONSTRAINTS.discount.minH,
    };
    // Al expandir el contenido pasa a ocupar ~180px (header + combo + monto).
    const newH = recalculateCardHeight({
      card,
      measuredPx: 180,
      rowHeightPx: ROW,
      marginYPx: GAP,
      toleranceGrowPx: TOL,
    });
    expect(newH).not.toBeNull();
    expect(newH).toBeGreaterThan(2);
    // El grow trae el slot a una altura que cubre los 180px medidos.
    expect(pxForRows(newH!)).toBeGreaterThanOrEqual(180 - GAP);
  });

  // ──────────────────────────────────────────────────────────────────────
  // 3. Agregar pago → Cobro crece + cards inferiores se reubican.
  // ──────────────────────────────────────────────────────────────────────
  it("agregar pago: payments crece y account-impact se reubica debajo (compactacion)", () => {
    // Layout inicial: payments en y=14, account-impact en y=21 (justo debajo).
    const layout: LayoutV2 = {
      version: 2,
      cards: [
        { id: "payments",       region: "aside", x: 8, y: 14, w: 4, h: 7,
          minW: 3, minH: CARD_CONSTRAINTS.payments.minH },
        { id: "account-impact", region: "aside", x: 8, y: 21, w: 4, h: 7,
          minW: 3, minH: CARD_CONSTRAINTS["account-impact"].minH },
      ],
    };
    // Simulamos que se agrego un pago: el contenido de payments crece
    // ~28px (1 row + gap). measuredPx pasa de ~188 a ~216.
    const measuredPxAfterAdd = 220;

    const next = reflowLayoutAfterCardChange({
      layout,
      changedCardId: "payments",
      measuredPx: measuredPxAfterAdd,
      rowHeightPx: ROW,
      marginYPx: GAP,
      toleranceGrowPx: TOL,
    });
    expect(next).not.toBeNull();

    const payments       = next!.cards.find((c) => c.id === "payments")!;
    const accountImpact  = next!.cards.find((c) => c.id === "account-impact")!;

    // payments crecio (h >= 8 ahora).
    expect(payments.h).toBeGreaterThanOrEqual(8);
    // account-impact se reubico justo debajo (sin overlap, sin huecos).
    expect(accountImpact.y).toBe(payments.y + payments.h);
  });

  // ──────────────────────────────────────────────────────────────────────
  // 4. Eliminar pago → Cobro encoge + cards inferiores suben.
  // ──────────────────────────────────────────────────────────────────────
  it("eliminar pago: payments encoge y account-impact sube (compactacion sin huecos)", () => {
    // Layout: payments con h=10 (expandido con varios pagos),
    // account-impact en y=24 (justo debajo).
    const layout: LayoutV2 = {
      version: 2,
      cards: [
        { id: "payments",       region: "aside", x: 8, y: 14, w: 4, h: 10,
          minW: 3, minH: CARD_CONSTRAINTS.payments.minH },
        { id: "account-impact", region: "aside", x: 8, y: 24, w: 4, h: 7,
          minW: 3, minH: CARD_CONSTRAINTS["account-impact"].minH },
      ],
    };
    // Tras eliminar un pago, el contenido medido baja ~28px → 160px.
    const measuredPxAfterRemove = 160;
    const next = reflowLayoutAfterCardChange({
      layout,
      changedCardId: "payments",
      measuredPx: measuredPxAfterRemove,
      rowHeightPx: ROW,
      marginYPx: GAP,
      toleranceGrowPx: TOL,
    });
    expect(next).not.toBeNull();
    const payments      = next!.cards.find((c) => c.id === "payments")!;
    const accountImpact = next!.cards.find((c) => c.id === "account-impact")!;

    // payments achico (h < 10).
    expect(payments.h).toBeLessThan(10);
    // account-impact subio: y = payments.y + payments.h (sin hueco).
    expect(accountImpact.y).toBe(payments.y + payments.h);
  });

  // ──────────────────────────────────────────────────────────────────────
  // 5. Layout legacy con minH alto → reconcileLayout re-clampa al SSOT.
  // ──────────────────────────────────────────────────────────────────────
  it("layout persistido pre-ROW=20 con minH alto → reconcile re-clampa al SSOT actual", () => {
    // Simula un layout guardado antes del cambio ROW=32→20: el operador
    // tenia `payments.minH=8` (que era el floor en su epoca). Hoy el SSOT
    // dice `payments.minH=2`. Si el reconcile preservaba ese valor viejo
    // el motor de auto-shrink no podia achicar al colapsar.
    const legacy = {
      version: 2,
      cards: [
        { id: "payments",       region: "aside", x: 8, y: 0,  w: 4, h: 8, minW: 3, minH: 8 },
        { id: "account-impact", region: "aside", x: 8, y: 8,  w: 4, h: 6, minW: 3, minH: 6 },
        { id: "discount",       region: "aside", x: 8, y: 14, w: 4, h: 6, minW: 3, minH: 6 },
      ],
    };
    const result = reconcileLayout(legacy, "COMPACT");

    const payments = result.cards.find((c) => c.id === "payments");
    const accountImpact = result.cards.find((c) => c.id === "account-impact");
    const discount = result.cards.find((c) => c.id === "discount");

    // Cada minH se re-clampa al SSOT actual (no preserva el persistido).
    expect(payments?.minH).toBe(CARD_CONSTRAINTS.payments.minH);
    expect(accountImpact?.minH).toBe(CARD_CONSTRAINTS["account-impact"].minH);
    expect(discount?.minH).toBe(CARD_CONSTRAINTS.discount.minH);
  });

  // ──────────────────────────────────────────────────────────────────────
  // 6. Spacing uniforme entre presets — todos los cards colapsables comparten
  //    el mismo `minH` del SSOT en los 3 presets.
  // ──────────────────────────────────────────────────────────────────────
  const presets = ["CLASSIC", "COMPACT", "ONE_LINE"] as const;
  it.each(presets)("preset %s: todos los cards colapsables tienen minH == SSOT", (preset) => {
    const layout = getDefaultLayoutForPreset(preset);
    const collapsableIds = [
      "discount", "shipping", "coupon", "payments", "account-impact", "observations",
    ] as const;
    for (const id of collapsableIds) {
      const card = layout.cards.find((c) => c.id === id);
      expect(card, `${preset}: card ${id} no encontrado`).toBeDefined();
      expect(
        card!.minH,
        `${preset}: ${id}.minH (${card!.minH}) != SSOT (${CARD_CONSTRAINTS[id].minH})`,
      ).toBe(CARD_CONSTRAINTS[id].minH);
    }
  });

  it.each(presets)("preset %s: totals mantiene minH hero (=%i) — NO se colapsa", (preset) => {
    const layout = getDefaultLayoutForPreset(preset);
    const totals = layout.cards.find((c) => c.id === "totals");
    expect(totals).toBeDefined();
    expect(totals!.minH).toBe(CARD_CONSTRAINTS.totals.minH);
  });

  // ──────────────────────────────────────────────────────────────────────
  // 7. compactVerticallyByRegion — cards inferiores se reubican sin huecos.
  // ──────────────────────────────────────────────────────────────────────
  it("compactacion: cards inferiores suben hasta tocar la card de arriba (sin huecos)", () => {
    const cards: LayoutV2Card[] = [
      { id: "discount", region: "aside", x: 8, y: 0,  w: 4, h: 3 },
      { id: "shipping", region: "aside", x: 8, y: 20, w: 4, h: 4 }, // hueco grande
      { id: "coupon",   region: "aside", x: 8, y: 50, w: 4, h: 3 },
    ];
    const out = compactVerticallyByRegion(cards, "aside");
    const discount = out.find((c) => c.id === "discount")!;
    const shipping = out.find((c) => c.id === "shipping")!;
    const coupon   = out.find((c) => c.id === "coupon")!;
    expect(discount.y).toBe(0);
    expect(shipping.y).toBe(discount.y + discount.h);
    expect(coupon.y).toBe(shipping.y + shipping.h);
  });
});

// =============================================================================
// CASCADE REFLOW — el cambio de altura de un card debe re-posicionar TODOS
// los cards de abajo en el MISMO reflow pass (sin esperar interaccion adicional).
// =============================================================================

describe("Etapa 4.1 — Cascade reflow real (sin estado stale)", () => {
  it("expandir Bonificacion → Envío + Cupón + Total + Cobro + Impacto CC + Observaciones bajan en UN solo reflow pass", () => {
    // Layout inicial: TODOS los cards colapsados a minH=2 (h=2 / 48 px).
    const layout: LayoutV2 = {
      version: 2,
      cards: [
        { id: "discount",       region: "aside", x: 8, y: 0,  w: 4, h: 2, minH: 2 },
        { id: "shipping",       region: "aside", x: 8, y: 2,  w: 4, h: 2, minH: 2 },
        { id: "coupon",         region: "aside", x: 8, y: 4,  w: 4, h: 2, minH: 2 },
        { id: "totals",         region: "aside", x: 8, y: 6,  w: 4, h: 13, minH: 13 },
        { id: "payments",       region: "aside", x: 8, y: 19, w: 4, h: 2, minH: 2 },
        { id: "account-impact", region: "aside", x: 8, y: 21, w: 4, h: 2, minH: 2 },
        { id: "observations",   region: "aside", x: 8, y: 23, w: 4, h: 2, minH: 2 },
      ],
    };
    // Bonificacion se expande: el contenido medido pasa de ~28 a ~180 px.
    const next = reflowLayoutAfterCardChange({
      layout,
      changedCardId: "discount",
      measuredPx: 180,
      rowHeightPx: ROW,
      marginYPx: GAP,
      toleranceGrowPx: TOL,
    });
    expect(next).not.toBeNull();

    // El cambio se aplico al card que crecio Y a todos los inferiores en UN
    // solo pass de compactacion vertical. Sin esperar a un segundo evento.
    const byId = new Map(next!.cards.map((c) => [c.id, c]));
    const discount       = byId.get("discount")!;
    const shipping       = byId.get("shipping")!;
    const coupon         = byId.get("coupon")!;
    const totals         = byId.get("totals")!;
    const payments       = byId.get("payments")!;
    const accountImpact  = byId.get("account-impact")!;
    const observations   = byId.get("observations")!;

    expect(discount.y).toBe(0);
    expect(discount.h).toBeGreaterThan(2);

    // Cada card siguiente arranca exactamente donde termina el anterior
    // (cascada limpia, sin gaps ni overlaps).
    expect(shipping.y).toBe(discount.y + discount.h);
    expect(coupon.y).toBe(shipping.y + shipping.h);
    expect(totals.y).toBe(coupon.y + coupon.h);
    expect(payments.y).toBe(totals.y + totals.h);
    expect(accountImpact.y).toBe(payments.y + payments.h);
    expect(observations.y).toBe(accountImpact.y + accountImpact.h);
  });

  it("colapsar Cobro tras tener 3 pagos → Impacto CC + Observaciones SUBEN en UN solo reflow pass", () => {
    // Layout con Cobro expandido (h=12) por 3 pagos cargados.
    const layout: LayoutV2 = {
      version: 2,
      cards: [
        { id: "payments",       region: "aside", x: 8, y: 14, w: 4, h: 12, minH: 2 },
        { id: "account-impact", region: "aside", x: 8, y: 26, w: 4, h: 7,  minH: 2 },
        { id: "observations",   region: "aside", x: 8, y: 33, w: 4, h: 9,  minH: 2 },
      ],
    };
    // Operador colapsa Cobro: medicion = 28 px (header only).
    const next = reflowLayoutAfterCardChange({
      layout,
      changedCardId: "payments",
      measuredPx: 28,
      rowHeightPx: ROW,
      marginYPx: GAP,
      toleranceGrowPx: TOL,
    });
    expect(next).not.toBeNull();

    const byId = new Map(next!.cards.map((c) => [c.id, c]));
    const payments       = byId.get("payments")!;
    const accountImpact  = byId.get("account-impact")!;
    const observations   = byId.get("observations")!;

    // Cobro achico al floor del SSOT (minH=2).
    expect(payments.h).toBe(2);
    // Impacto CC subio: y = 14 (donde estaba payments) + 2 (nuevo h).
    expect(accountImpact.y).toBe(payments.y + payments.h);
    // Observaciones subio: y = accountImpact.y + 7 (su h no cambio).
    expect(observations.y).toBe(accountImpact.y + accountImpact.h);
  });

  it("multiples cards cambian a la vez → compactacion produce un layout consistente", () => {
    // Escenario: cards con `y` desactualizados (consequencia de no haber
    // compactado en reflows previos). compactVerticallyByRegion los
    // re-posiciona en UN solo pass, sin estados intermedios visibles.
    const cards: LayoutV2Card[] = [
      { id: "discount",       region: "aside", x: 8, y: 0,  w: 4, h: 7 },  // expandido
      { id: "shipping",       region: "aside", x: 8, y: 2,  w: 4, h: 2 },  // y=2 stale (deberia ser 7)
      { id: "coupon",         region: "aside", x: 8, y: 4,  w: 4, h: 2 },  // y=4 stale
      { id: "totals",         region: "aside", x: 8, y: 6,  w: 4, h: 17 },
      { id: "payments",       region: "aside", x: 8, y: 23, w: 4, h: 8 },  // expandido
      { id: "account-impact", region: "aside", x: 8, y: 21, w: 4, h: 2 },  // y stale (deberia >= 31)
    ];
    const out = compactVerticallyByRegion(cards, "aside");
    // Tras un solo pass, todos los y son consistentes (cada uno = prev.y + prev.h).
    const sorted = out
      .filter((c) => c.region === "aside")
      .sort((a, b) => a.y - b.y);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      expect(curr.y).toBe(prev.y + prev.h);
    }
  });
});

// =============================================================================
// STABILITY GATE — fix del bug "necesita doble interaccion para reflowear"
// =============================================================================

describe("Etapa 4.1 — decideStabilityCommit (anti-stale)", () => {
  it("STABILITY_REQUIRED=1 → la PRIMERA observacion commitea (fix del bug)", () => {
    // Caso real: TPCard expand termina su animacion, ResizeObserver
    // dispara UNA vez post-animacion. Con el bug viejo, el gate creaba
    // tracker y devolvia c sin commit → reflow colgado hasta proxima
    // interaccion. Ahora con STABILITY_REQUIRED=1 commitea inmediato.
    const decision = decideStabilityCommit({
      newH: 7,
      tracker: undefined,
      stabilityRequired: 1,
    });
    expect(decision.commit).toBe(true);
  });

  it("STABILITY_REQUIRED=2 → la primera obs NO commitea, devuelve tracker para esperar", () => {
    const decision = decideStabilityCommit({
      newH: 7,
      tracker: undefined,
      stabilityRequired: 2,
    });
    expect(decision.commit).toBe(false);
    if (!decision.commit) {
      expect(decision.nextTracker).toEqual({ h: 7, count: 1 });
    }
  });

  it("STABILITY_REQUIRED=2 → la segunda obs del mismo h SI commitea", () => {
    const decision = decideStabilityCommit({
      newH: 7,
      tracker: { h: 7, count: 1 }, // primera ya observada
      stabilityRequired: 2,
    });
    expect(decision.commit).toBe(true);
  });

  it("nueva h distinta del tracker → resetea contador a 1 (no acumula)", () => {
    const decision = decideStabilityCommit({
      newH: 9,
      tracker: { h: 7, count: 5 }, // tracker de OTRA h
      stabilityRequired: 2,
    });
    expect(decision.commit).toBe(false);
    if (!decision.commit) {
      // count se reinicia a 1, no a 6 (no se confunden mediciones).
      expect(decision.nextTracker).toEqual({ h: 9, count: 1 });
    }
  });

  it("STABILITY_REQUIRED=3 → necesita 3 observaciones consecutivas del mismo h", () => {
    // 1ra obs: no commit
    const d1 = decideStabilityCommit({ newH: 7, tracker: undefined, stabilityRequired: 3 });
    expect(d1.commit).toBe(false);
    if (d1.commit) return;
    expect(d1.nextTracker.count).toBe(1);

    // 2da obs (mismo h): aun no
    const d2 = decideStabilityCommit({ newH: 7, tracker: d1.nextTracker, stabilityRequired: 3 });
    expect(d2.commit).toBe(false);
    if (d2.commit) return;
    expect(d2.nextTracker.count).toBe(2);

    // 3ra obs (mismo h): commitea
    const d3 = decideStabilityCommit({ newH: 7, tracker: d2.nextTracker, stabilityRequired: 3 });
    expect(d3.commit).toBe(true);
  });
});

// =============================================================================
// SPACING — el GAP compactado se respeta en el calculo de pixeles
// =============================================================================

describe("Etapa 4.1 — GAP compactado 8→6 px", () => {
  it("CARD_GAP_Y_PX es 6 (post-compactacion 2026-05-26)", () => {
    expect(CARD_GAP_Y_PX).toBe(6);
  });

  it("card colapsado (h=2) renderea como ~46 px (era 48 con GAP=8)", () => {
    // 2 filas * 20 px + 1 gap * 6 px = 46 px.
    expect(pxForRows(2)).toBe(46);
  });

  it("totals (h=17 hero) renderea como ~436 px (era 460 con GAP=8)", () => {
    // 17 * 20 + 16 * 6 = 340 + 96 = 436.
    expect(pxForRows(17)).toBe(436);
  });

  it("6 cards colapsados (h=2 cada uno) + 5 gaps interiores ahorran 10 px vs GAP=8", () => {
    // Sin gaps externos del container — solo el ahorro intracard.
    const totalGapsCompact = 5 * 6;  // 30 px
    const totalGapsOld     = 5 * 8;  // 40 px
    expect(totalGapsOld - totalGapsCompact).toBe(10);
  });
});

// =============================================================================
// COHESION VISUAL — fix del hueco Total/Cobro y cards vacios.
// =============================================================================

describe("Etapa 4.2 — Cohesion vertical (hueco Total/Cobro)", () => {
  it("totals.minH es 6 (~132 px) — balance final 2026-05-28", () => {
    // Historial:
    //   · minH=13 (pre-2026-05-26) → hueco gigante entre Total y Cobro
    //   · minH=6  (2026-05-26)      → balance OK, marcado como comprimido
    //   · minH=8  (2026-05-27)      → genero "aire muerto" en empty state
    //   · minH=6  (2026-05-28)      → balance final, padding interno del
    //                                  TotalDelComprobanteCard (space-y-3
    //                                  p-2.5) provee el respiro estetico.
    expect(CARD_CONSTRAINTS.totals.minH).toBe(6);
  });

  it("totals con contenido chico (180 px, factura vacia) achica a su floor", () => {
    // Antes: minH=13 (332 px) forzaba 332 px aunque el contenido midiera
    // 180 px → ~150 px de aire vacio interno al card. Ahora con minH=6
    // el slot achica a la altura natural del contenido.
    const card: LayoutV2Card = {
      id: "totals",
      region: "aside",
      x: 8, y: 0, w: 4, h: 17,
      minW: 3, minH: CARD_CONSTRAINTS.totals.minH,
    };
    const newH = recalculateCardHeight({
      card,
      measuredPx: 180,
      rowHeightPx: ROW,
      marginYPx: GAP,
      toleranceGrowPx: TOL,
    });
    expect(newH).not.toBeNull();
    // neededH = ceil((180+6)/26) = 8 rows → 176 px slot.
    expect(newH).toBeLessThan(17);
    // No achica debajo del floor del SSOT.
    expect(newH).toBeGreaterThanOrEqual(CARD_CONSTRAINTS.totals.minH);
  });

  it("totals con factura vacia (~120 px) achica hasta el floor SSOT", () => {
    // Factura vacia: solo total $0 + selector + status pill = ~120 px.
    // neededH = ceil((120+6)/26) = 5, pero minH=6 → floor 6.
    const card: LayoutV2Card = {
      id: "totals",
      region: "aside",
      x: 8, y: 0, w: 4, h: 13,
      minW: 3, minH: CARD_CONSTRAINTS.totals.minH,
    };
    const newH = recalculateCardHeight({
      card,
      measuredPx: 120,
      rowHeightPx: ROW,
      marginYPx: GAP,
      toleranceGrowPx: TOL,
    });
    expect(newH).toBe(CARD_CONSTRAINTS.totals.minH);
  });

  it("Cobro sube hacia Total cuando Total esta con contenido chico", () => {
    // Setup: Total esta expandido por bug viejo (h=13) pero su contenido
    // es chico. Cobro esta justo debajo. Al re-medirse Total, achica
    // y Cobro sube.
    const layout: LayoutV2 = {
      version: 2,
      cards: [
        { id: "totals",   region: "aside", x: 8, y: 0,  w: 4, h: 13,
          minH: CARD_CONSTRAINTS.totals.minH },
        { id: "payments", region: "aside", x: 8, y: 13, w: 4, h: 2,
          minH: CARD_CONSTRAINTS.payments.minH },
      ],
    };
    const next = reflowLayoutAfterCardChange({
      layout,
      changedCardId: "totals",
      measuredPx: 130, // factura vacia
      rowHeightPx: ROW,
      marginYPx: GAP,
      toleranceGrowPx: TOL,
    });
    expect(next).not.toBeNull();
    const totals   = next!.cards.find((c) => c.id === "totals")!;
    const payments = next!.cards.find((c) => c.id === "payments")!;
    // Total achico al floor.
    expect(totals.h).toBe(CARD_CONSTRAINTS.totals.minH);
    // Cobro arranca EXACTAMENTE donde Total termina (sin hueco).
    expect(payments.y).toBe(totals.y + totals.h);
    // Cobro subio significativamente.
    expect(payments.y).toBeLessThan(13);
  });

  it("totals con factura real (breakdown completo, 400 px) crece via auto-grow", () => {
    // Cuando hay contenido real el motor crece automaticamente — minH bajo
    // NO compromete la jerarquia hero cuando hace falta.
    const card: LayoutV2Card = {
      id: "totals",
      region: "aside",
      x: 8, y: 0, w: 4, h: 6,
      minW: 3, minH: CARD_CONSTRAINTS.totals.minH,
    };
    const newH = recalculateCardHeight({
      card,
      measuredPx: 400,
      rowHeightPx: ROW,
      marginYPx: GAP,
      toleranceGrowPx: TOL,
    });
    expect(newH).not.toBeNull();
    // Crece a la altura natural del contenido. 400 px ~ 16 rows.
    expect(newH).toBeGreaterThanOrEqual(15);
  });
});

// =============================================================================
// REFLOW SINCRONIZADO — no overlap visual durante la animacion.
// =============================================================================

describe("Etapa 4.2 — Reflow atomico (no montaje visual)", () => {
  it("commit unico produce layout consistente sin estados intermedios", () => {
    // Cuando un card cambia altura, el resultado de reflowLayoutAfterCardChange
    // ya trae a TODOS los cards de la region en su Y final — el consumer
    // (LayoutGridContext) hace UN SOLO setState con ese layout. No hay
    // varios setState intermedios; React no rendea estados parciales.
    const layout: LayoutV2 = {
      version: 2,
      cards: [
        { id: "discount",       region: "aside", x: 8, y: 0,  w: 4, h: 2, minH: 2 },
        { id: "shipping",       region: "aside", x: 8, y: 2,  w: 4, h: 2, minH: 2 },
        { id: "coupon",         region: "aside", x: 8, y: 4,  w: 4, h: 2, minH: 2 },
        { id: "totals",         region: "aside", x: 8, y: 6,  w: 4, h: 6, minH: 6 },
        { id: "payments",       region: "aside", x: 8, y: 12, w: 4, h: 2, minH: 2 },
        { id: "account-impact", region: "aside", x: 8, y: 14, w: 4, h: 2, minH: 2 },
        { id: "observations",   region: "aside", x: 8, y: 16, w: 4, h: 2, minH: 2 },
      ],
    };
    const next = reflowLayoutAfterCardChange({
      layout,
      changedCardId: "discount",
      measuredPx: 180, // expand a 180 px
      rowHeightPx: ROW,
      marginYPx: GAP,
      toleranceGrowPx: TOL,
    });
    expect(next).not.toBeNull();
    // Verificamos la cascada: cada card arranca exactamente donde el
    // anterior termina. No hay slots "viejos" arrastrados.
    const sorted = next!.cards
      .filter((c) => c.region === "aside")
      .sort((a, b) => a.y - b.y);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      expect(
        curr.y,
        `${curr.id}.y (${curr.y}) deberia ser ${prev.y + prev.h} (${prev.id}.y + ${prev.id}.h)`,
      ).toBe(prev.y + prev.h);
    }
  });

  it("reflow no muta el layout input — devuelve nuevo objeto inmutable", () => {
    const layout: LayoutV2 = {
      version: 2,
      cards: [
        { id: "discount", region: "aside", x: 8, y: 0, w: 4, h: 2, minH: 2 },
        { id: "shipping", region: "aside", x: 8, y: 2, w: 4, h: 2, minH: 2 },
      ],
    };
    const before = JSON.parse(JSON.stringify(layout));
    reflowLayoutAfterCardChange({
      layout,
      changedCardId: "discount",
      measuredPx: 180,
      rowHeightPx: ROW,
      marginYPx: GAP,
      toleranceGrowPx: TOL,
    });
    // El input layout sigue exactamente igual — no hubo mutacion.
    expect(layout).toEqual(before);
  });

  it("decideStabilityCommit con REQUIRED=1 commitea en 1ra obs aun bajo RAF throttle", () => {
    // Garantia para el RAF throttle: cada frame mide y commitea sin
    // necesidad de observaciones repetidas. Si el comportamiento
    // cambiara aqui, el reflow continuo durante animaciones se romperia.
    const decision = decideStabilityCommit({
      newH: 7,
      tracker: undefined,
      stabilityRequired: 1,
    });
    expect(decision.commit).toBe(true);
  });
});
