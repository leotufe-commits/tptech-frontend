// src/lib/sales/__tests__/applyGlobalPriceListChange.test.ts
// ============================================================================
// BUG FIX — selector global de lista de precios en Factura de Ventas.
//
// Antes (`VentasFacturas.tsx:6338`):
//   onChangePriceList={(id) => onChange({ ...draft, priceListId: id ?? undefined })}
//
// Solo cambiaba la lista del documento; las líneas con
// `priceListIdOverride` quedaban ancladas a la lista vieja. El badge "Línea"
// (`TPDocumentLineAdvancedEditor.tsx:2401-2402`) seguía visible y el precio
// no se actualizaba.
//
// Fix (este helper): `applyGlobalPriceListChange(draft, nextId)` cambia
// `priceListId` global y limpia `priceListIdOverride` + `priceListOverride`
// de TODAS las líneas. Cero matemática (delega al motor backend vía el
// próximo preview).
//
// Tests cubren los 6 escenarios del brief:
//   1. Cambiar lista global limpia priceListIdOverride en todas las líneas.
//   2. Cambiar lista global cambia draft → dispara preview (se verifica con
//      identidad del objeto + payload).
//   3. El payload del próximo preview envía `priceListId` global y líneas
//      con `priceListIdOverride: null`.
//   4. El chip "Línea" desaparece (verificación a nivel shape: ya no hay
//      `priceListIdOverride: string` en ninguna línea).
//   5. El selector por línea sigue funcionando como override puntual
//      (helper de override no fue tocado).
//   6. Si después el operador cambia solo una línea, el badge vuelve
//      a aparecer en esa línea.
// ============================================================================

import { describe, it, expect } from "vitest";
import { applyGlobalPriceListChange } from "../applyGlobalPriceListChange";
import { buildSalePreviewPayload } from "../buildSalePreviewPayload";
import type { SalesInvoice } from "../types";
import type { DocumentLine } from "../../document-types";

// ──────────────────────────────────────────────────────────────────────────
// Factory mínima de drafts y líneas
// ──────────────────────────────────────────────────────────────────────────

function makeLine(over: Partial<DocumentLine> = {}): DocumentLine {
  return {
    id:          over.id ?? "L1",
    type:        "ARTICLE",
    description: "ANILLO SOLITARIO",
    quantity:    1,
    unitPrice:   100000,
    subtotal:    100000,
    total:       100000,
    ...over,
  } as DocumentLine;
}

function makeDraft(over: Partial<SalesInvoice> = {}): SalesInvoice {
  return {
    id: "fv1",
    number: "FV-0001",
    date: new Date().toISOString(),
    dueDate: new Date().toISOString(),
    client: "Juan",
    salesOrderNumber: "",
    deliveryNumber: "",
    currency: "ARS",
    fxRate: 1,
    taxPercent: 21,
    seller: "",
    warehouse: "",
    paymentTerm: "",
    referenceNumber: "",
    notes: "",
    terms: "",
    subtotal: 0,
    discountAmount: 0,
    taxAmount: 0,
    total: 0,
    paidAmount: 0,
    lines: [],
    status: "DRAFT",
    balanceModeOverride: null,
    priceListId: "lista-global-unificada",
    ...over,
  } as SalesInvoice;
}

const LISTA_DESGLOSADA = "lista-desglosada-id";
const LISTA_UNIFICADA  = "lista-unificada-id";

// ──────────────────────────────────────────────────────────────────────────
// Escenario 1 — Cambiar lista global limpia priceListIdOverride en TODAS las líneas
// ──────────────────────────────────────────────────────────────────────────

describe("applyGlobalPriceListChange — escenario 1 (limpia overrides)", () => {
  it("(1a) draft con 3 líneas (2 con override) → todas quedan sin override", () => {
    const draft = makeDraft({
      priceListId: LISTA_UNIFICADA,
      lines: [
        makeLine({ id: "L1", priceListIdOverride: LISTA_UNIFICADA, priceListOverride: true }),
        makeLine({ id: "L2" }), // sin override (queda intocada — preserva identidad)
        makeLine({ id: "L3", priceListIdOverride: "alguna-otra", priceListOverride: true }),
      ],
    });
    const out = applyGlobalPriceListChange(draft, LISTA_DESGLOSADA);

    expect(out.priceListId).toBe(LISTA_DESGLOSADA);
    // Líneas L1 y L3 tenían override → se limpian con null + false.
    expect(out.lines[0]?.priceListIdOverride).toBeNull();
    expect(out.lines[0]?.priceListOverride).toBe(false);
    expect(out.lines[2]?.priceListIdOverride).toBeNull();
    expect(out.lines[2]?.priceListOverride).toBe(false);
    // L2 no tenía override → queda como estaba (sin esos campos).
    // Lo importante: el contrato del editor (hasOverride) es false en TODAS.
    for (const l of out.lines) {
      const hasOverride =
        typeof l.priceListIdOverride === "string" && (l.priceListIdOverride as string).length > 0;
      expect(hasOverride).toBe(false);
      expect(l.priceListOverride === true).toBe(false);
    }
  });

  it("(1b) draft sin overrides previos → cambia la global y todas siguen sin override", () => {
    const draft = makeDraft({
      priceListId: LISTA_UNIFICADA,
      lines: [makeLine({ id: "L1" }), makeLine({ id: "L2" })],
    });
    const out = applyGlobalPriceListChange(draft, LISTA_DESGLOSADA);
    expect(out.priceListId).toBe(LISTA_DESGLOSADA);
    // hasOverride === false en todas (independientemente de si el valor
    // es undefined o null — el editor solo chequea `typeof === "string"`).
    for (const l of out.lines) {
      const hasOverride =
        typeof l.priceListIdOverride === "string" && (l.priceListIdOverride as string).length > 0;
      expect(hasOverride).toBe(false);
    }
  });

  it("(1c) draft con 0 líneas → no rompe; priceListId cambia", () => {
    const draft = makeDraft({ priceListId: LISTA_UNIFICADA, lines: [] });
    const out = applyGlobalPriceListChange(draft, LISTA_DESGLOSADA);
    expect(out.priceListId).toBe(LISTA_DESGLOSADA);
    expect(out.lines).toEqual([]);
  });

  it("(1d) null / undefined / '' → priceListId pasa a undefined (Sin lista) y overrides se limpian", () => {
    const draft = makeDraft({
      priceListId: LISTA_UNIFICADA,
      lines: [
        makeLine({ id: "L1", priceListIdOverride: "x", priceListOverride: true }),
      ],
    });
    for (const next of [null, undefined, ""] as Array<string | null | undefined>) {
      const out = applyGlobalPriceListChange(draft, next);
      expect(out.priceListId).toBeUndefined();
      expect(out.lines[0]?.priceListIdOverride).toBeNull();
      expect(out.lines[0]?.priceListOverride).toBe(false);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Escenario 2 — Cambiar lista global dispara preview
// ──────────────────────────────────────────────────────────────────────────

describe("applyGlobalPriceListChange — escenario 2 (cambio observable)", () => {
  it("(2a) devuelve un objeto NUEVO (referencia ≠) → usePreviewFlow lo nota y dispara", () => {
    const draft = makeDraft({ priceListId: LISTA_UNIFICADA, lines: [makeLine()] });
    const out = applyGlobalPriceListChange(draft, LISTA_DESGLOSADA);
    expect(out).not.toBe(draft);
    expect(out.lines).not.toBe(draft.lines);
  });

  it("(2b) NO muta el draft de entrada (helper puro)", () => {
    const draft = makeDraft({
      priceListId: LISTA_UNIFICADA,
      lines: [
        makeLine({ id: "L1", priceListIdOverride: LISTA_UNIFICADA, priceListOverride: true }),
      ],
    });
    const snapshot = JSON.parse(JSON.stringify(draft));
    applyGlobalPriceListChange(draft, LISTA_DESGLOSADA);
    expect(draft).toEqual(snapshot);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Escenario 3 — Payload del próximo preview
// ──────────────────────────────────────────────────────────────────────────

describe("applyGlobalPriceListChange — escenario 3 (payload integrado)", () => {
  it("buildSalePreviewPayload sobre el draft post-fix envía priceListId global y todas las líneas con priceListIdOverride: null", () => {
    const draft = makeDraft({
      priceListId: LISTA_UNIFICADA,
      lines: [
        makeLine({ id: "L1", articleId: "art1", priceListIdOverride: LISTA_UNIFICADA, priceListOverride: true } as any),
        makeLine({ id: "L2", articleId: "art2" } as any),
      ],
    });
    const updated = applyGlobalPriceListChange(draft, LISTA_DESGLOSADA);
    // buildSalePreviewPayload(draft, currencyId?) → { hasRealLines, payload }
    const { payload } = buildSalePreviewPayload(updated) as any;

    expect(payload.priceListId).toBe(LISTA_DESGLOSADA);
    expect(payload.lines).toHaveLength(2);
    for (const ln of payload.lines) {
      expect(ln.priceListIdOverride).toBeNull();
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Escenario 4 — Chip "Línea" desaparece
// ──────────────────────────────────────────────────────────────────────────

describe("applyGlobalPriceListChange — escenario 4 (chip Línea)", () => {
  it("post-fix ninguna línea tiene `priceListIdOverride: string` → hasOverride=false en el editor", () => {
    // El editor `TPDocumentLineAdvancedEditor.tsx:2401-2402` calcula:
    //   const hasLineListOverride =
    //     typeof l.priceListIdOverride === "string" && l.priceListIdOverride.length > 0;
    // y el badge "Línea" solo se renderiza si hasOverride === true.
    const draft = makeDraft({
      priceListId: LISTA_UNIFICADA,
      lines: [
        makeLine({ id: "L1", priceListIdOverride: LISTA_UNIFICADA, priceListOverride: true }),
        makeLine({ id: "L2", priceListIdOverride: "otra", priceListOverride: true }),
      ],
    });
    const out = applyGlobalPriceListChange(draft, LISTA_DESGLOSADA);
    for (const l of out.lines) {
      const hasOverride =
        typeof l.priceListIdOverride === "string" && (l.priceListIdOverride as string).length > 0;
      expect(hasOverride).toBe(false);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Escenario 5 — El selector por línea sigue funcionando
// ──────────────────────────────────────────────────────────────────────────

describe("applyGlobalPriceListChange — escenario 5 (override per-línea intacto)", () => {
  it("luego del cambio global, setear override en una línea funciona y solo afecta a esa línea", () => {
    const draft = makeDraft({
      priceListId: LISTA_UNIFICADA,
      lines: [makeLine({ id: "L1" }), makeLine({ id: "L2" })],
    });
    const afterGlobal = applyGlobalPriceListChange(draft, LISTA_DESGLOSADA);

    // Simulamos `onChangeLinePriceList(L1, LISTA_UNIFICADA)` — código real
    // de VentasFacturas.tsx:6339-6350 (no usa el helper porque es el camino
    // distinto: override por línea).
    const afterLineOverride: SalesInvoice = {
      ...afterGlobal,
      lines: afterGlobal.lines.map((l) =>
        l.id === "L1"
          ? { ...l, priceListIdOverride: LISTA_UNIFICADA, priceListOverride: true }
          : l,
      ),
    };

    expect(afterLineOverride.priceListId).toBe(LISTA_DESGLOSADA);
    expect(afterLineOverride.lines[0]?.priceListIdOverride).toBe(LISTA_UNIFICADA);
    expect(afterLineOverride.lines[0]?.priceListOverride).toBe(true);
    // L2 no tenía override antes ni se le tocó → hasOverride debe ser false.
    const l1 = afterLineOverride.lines[1]!;
    const l1HasOverride =
      typeof l1.priceListIdOverride === "string" && (l1.priceListIdOverride as string).length > 0;
    expect(l1HasOverride).toBe(false);
    expect(l1.priceListOverride === true).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Escenario 6 — Badge reaparece sólo en la línea editada
// ──────────────────────────────────────────────────────────────────────────

describe("applyGlobalPriceListChange — escenario 6 (badge reaparece localmente)", () => {
  it("tras un override puntual posterior, hasOverride=true SOLO en esa línea", () => {
    const draft = makeDraft({
      priceListId: LISTA_UNIFICADA,
      lines: [makeLine({ id: "L1" }), makeLine({ id: "L2" }), makeLine({ id: "L3" })],
    });
    const afterGlobal = applyGlobalPriceListChange(draft, LISTA_DESGLOSADA);

    // Override puntual en L2.
    const next: SalesInvoice = {
      ...afterGlobal,
      lines: afterGlobal.lines.map((l) =>
        l.id === "L2"
          ? { ...l, priceListIdOverride: "lista-temp", priceListOverride: true }
          : l,
      ),
    };

    const overrideMap = next.lines.map((l) => ({
      id: l.id,
      has:
        typeof l.priceListIdOverride === "string" &&
        (l.priceListIdOverride as string).length > 0,
    }));

    expect(overrideMap).toEqual([
      { id: "L1", has: false },
      { id: "L2", has: true },
      { id: "L3", has: false },
    ]);
  });

  it("(6b) cambiar la global OTRA VEZ después del override puntual lo vuelve a limpiar", () => {
    const draft = makeDraft({
      priceListId: LISTA_UNIFICADA,
      lines: [
        makeLine({ id: "L1" }),
        makeLine({ id: "L2", priceListIdOverride: "lista-temp", priceListOverride: true }),
      ],
    });
    const out = applyGlobalPriceListChange(draft, LISTA_DESGLOSADA);
    expect(out.priceListId).toBe(LISTA_DESGLOSADA);
    expect(out.lines[1]?.priceListIdOverride).toBeNull();
    expect(out.lines[1]?.priceListOverride).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// P0.1 — Escenario 7 — Coordinación con useEffect de favoritos
// ──────────────────────────────────────────────────────────────────────────
// Sin estos tests, unificar el popover del header bajo este helper rompe
// la promesa "Sin lista" (la favorita re-aparece sola por el useEffect en
// VentasFacturas.tsx:3271-3320). El helper ahora setea
// `priceListExplicitlyCleared` para coordinar.
// ──────────────────────────────────────────────────────────────────────────

describe("applyGlobalPriceListChange — escenario 7 (priceListExplicitlyCleared)", () => {
  it("(7a) nextPriceListId=null → flag=true (operador eligió 'Sin lista')", () => {
    const draft = makeDraft({ priceListId: LISTA_UNIFICADA });
    const out = applyGlobalPriceListChange(draft, null);
    expect(out.priceListId).toBeUndefined();
    expect(out.priceListExplicitlyCleared).toBe(true);
  });

  it("(7b) nextPriceListId=undefined → flag=true", () => {
    const draft = makeDraft({ priceListId: LISTA_UNIFICADA });
    const out = applyGlobalPriceListChange(draft, undefined);
    expect(out.priceListExplicitlyCleared).toBe(true);
  });

  it("(7c) nextPriceListId='' (string vacío) → normalizado a 'Sin lista', flag=true", () => {
    const draft = makeDraft({ priceListId: LISTA_UNIFICADA });
    const out = applyGlobalPriceListChange(draft, "");
    expect(out.priceListId).toBeUndefined();
    expect(out.priceListExplicitlyCleared).toBe(true);
  });

  it("(7d) nextPriceListId=id real → flag=false (decisión nueva pisa flag previo)", () => {
    const draft = makeDraft({
      priceListId: undefined,
      priceListExplicitlyCleared: true,  // venía de un "Sin lista" previo
    });
    const out = applyGlobalPriceListChange(draft, LISTA_DESGLOSADA);
    expect(out.priceListId).toBe(LISTA_DESGLOSADA);
    expect(out.priceListExplicitlyCleared).toBe(false);
  });

  it("(7e) flag=true bloquea la favorita: simular el useEffect del modal", () => {
    // El useEffect (VentasFacturas.tsx:3283) chequea:
    //   if (!draft.priceListId && draft.priceListExplicitlyCleared !== true)
    // Si el guard se cumple, aplica la favorita. Verificamos que post-helper
    // ese guard NO se cumple (flag explícito en true).
    const draft = makeDraft({ priceListId: LISTA_UNIFICADA });
    const out = applyGlobalPriceListChange(draft, null);
    const wouldApplyFavorite =
      !out.priceListId && out.priceListExplicitlyCleared !== true;
    expect(wouldApplyFavorite).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Escenario 7 — Cambiar lista global RESETEA el modo de saldo a AUTOMÁTICO
// (descarta el override manual del footer) para que el modo de la nueva lista
// (o del cliente, mayor prioridad) resuelva y el footer + líneas se sincronicen.
// ──────────────────────────────────────────────────────────────────────────

describe("applyGlobalPriceListChange — escenario 7 (reset del modo de saldo)", () => {
  it("(7a) override manual 'UNIFIED' → se descarta (null) al cambiar la lista", () => {
    const draft = makeDraft({ balanceModeOverride: "UNIFIED", priceListId: LISTA_UNIFICADA });
    const out = applyGlobalPriceListChange(draft, LISTA_DESGLOSADA);
    expect(out.balanceModeOverride).toBeNull();
  });

  it("(7b) override manual 'BREAKDOWN' → también se descarta (null)", () => {
    const draft = makeDraft({ balanceModeOverride: "BREAKDOWN", priceListId: LISTA_DESGLOSADA });
    const out = applyGlobalPriceListChange(draft, LISTA_UNIFICADA);
    expect(out.balanceModeOverride).toBeNull();
  });

  it("(7c) 'Sin lista' también resetea el override", () => {
    const draft = makeDraft({ balanceModeOverride: "UNIFIED", priceListId: LISTA_UNIFICADA });
    const out = applyGlobalPriceListChange(draft, null);
    expect(out.balanceModeOverride).toBeNull();
  });
});
