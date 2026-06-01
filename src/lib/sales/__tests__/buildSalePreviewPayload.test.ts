// src/lib/sales/__tests__/buildSalePreviewPayload.test.ts
// ============================================================================
// Tests del builder de payload extraído en FASE 5.
// ============================================================================

import { describe, it, expect } from "vitest";
import { buildSalePreviewPayload } from "../buildSalePreviewPayload";
import type { SalesInvoice } from "../types";
import type { DocumentLine } from "../../document-types";

function makeLine(o: Partial<DocumentLine> = {}): DocumentLine {
  return {
    id:           "l1",
    articleId:    "a1",
    article:      "ART-001",
    quantity:     1,
    unitPrice:    100,
    discountAmount: 0,
    taxAmount:    21,
    subtotal:     100,
    lineTotal:    121,
    ...o,
  } as DocumentLine;
}

function makeDraft(o: Partial<SalesInvoice> = {}): SalesInvoice {
  return {
    id:               "fv1",
    number:           "FV-0001",
    date:             new Date().toISOString(),
    dueDate:          new Date().toISOString(),
    client:           "Juan",
    salesOrderNumber: "",
    deliveryNumber:   "",
    currency:         "ARS",
    fxRate:           1,
    taxPercent:       21,
    seller:           "",
    warehouse:        "",
    paymentTerm:      "",
    referenceNumber:  "",
    notes:            "",
    terms:            "",
    subtotal:         0,
    discountAmount:   0,
    taxAmount:        0,
    total:            0,
    paidAmount:       0,
    lines:            [],
    status:           "DRAFT",
    ...o,
  } as SalesInvoice;
}

describe("buildSalePreviewPayload", () => {
  it("hasRealLines=false cuando no hay líneas previewables", () => {
    const { hasRealLines } = buildSalePreviewPayload(makeDraft());
    expect(hasRealLines).toBe(false);
  });

  it("hasRealLines=true con al menos una línea con articleId", () => {
    const { hasRealLines, payload } = buildSalePreviewPayload(
      makeDraft({ lines: [makeLine()] })
    );
    expect(hasRealLines).toBe(true);
    expect(payload.lines.length).toBe(1);
  });

  it("forward priceListId del draft al payload", () => {
    const { payload } = buildSalePreviewPayload(
      makeDraft({ priceListId: "pl-1", lines: [makeLine()] })
    );
    expect(payload.priceListId).toBe("pl-1");
  });

  it("forward channelId del draft al payload", () => {
    const { payload } = buildSalePreviewPayload(
      makeDraft({ channelId: "ch-1", lines: [makeLine()] })
    );
    expect(payload.channelId).toBe("ch-1");
  });

  it("forward couponCode si está presente", () => {
    const { payload } = buildSalePreviewPayload(
      makeDraft({ couponCode: "DESCUENTO10", lines: [makeLine()] })
    );
    expect(payload.couponCode).toBe("DESCUENTO10");
  });

  it("currencyRate=null cuando no hay currencyId resuelto", () => {
    const { payload } = buildSalePreviewPayload(
      makeDraft({ fxRate: 1500, lines: [makeLine()] }),
      null,
    );
    expect(payload.currencyRate).toBe(null);
  });

  it("currencyRate=fxRate cuando hay currencyId + fxRate > 0", () => {
    const { payload } = buildSalePreviewPayload(
      makeDraft({ fxRate: 1500, lines: [makeLine()] }),
      "curr-id",
    );
    expect(payload.currencyRate).toBe(1500);
  });

  it("globalDiscount=null cuando value <= 0", () => {
    const { payload } = buildSalePreviewPayload(
      makeDraft({ discountGlobal: { type: "PERCENT", value: 0 } as any, lines: [makeLine()] })
    );
    expect(payload.globalDiscount).toBe(null);
  });

  it("globalDiscount serializado cuando value > 0", () => {
    const { payload } = buildSalePreviewPayload(
      makeDraft({ discountGlobal: { type: "PERCENT", value: 10 } as any, lines: [makeLine()] })
    );
    expect(payload.globalDiscount).toEqual({ type: "PERCENT", value: 10 });
  });

  it("línea MANUAL serializa type=MANUAL con description", () => {
    const manualLine = {
      id: "lm",
      isManual: true,
      manualDescription: "Servicio extra",
      quantity: 1,
      unitPrice: 200,
    } as DocumentLine;
    const { payload } = buildSalePreviewPayload(
      makeDraft({ lines: [manualLine] })
    );
    expect((payload.lines[0] as any).type).toBe("MANUAL");
    expect((payload.lines[0] as any).description).toBe("Servicio extra");
  });
});

describe("buildSalePreviewPayload — origin de globalDiscount (anti doble aplicación)", () => {
  it("origin=CLIENT → NO envía globalDiscount (el motor lo aplica por clientId)", () => {
    const { payload } = buildSalePreviewPayload(
      makeDraft({
        discountGlobal: { type: "PERCENT", value: 10, origin: "CLIENT" },
        lines: [makeLine()],
      })
    );
    expect(payload.globalDiscount).toBeNull();
  });

  it("origin=MANUAL → SÍ envía globalDiscount", () => {
    const { payload } = buildSalePreviewPayload(
      makeDraft({
        discountGlobal: { type: "AMOUNT", value: 500, origin: "MANUAL" },
        lines: [makeLine()],
      })
    );
    expect(payload.globalDiscount).toEqual({ type: "AMOUNT", value: 500 });
  });

  it("origin=NONE → SÍ envía globalDiscount (legacy)", () => {
    const { payload } = buildSalePreviewPayload(
      makeDraft({
        discountGlobal: { type: "PERCENT", value: 7, origin: "NONE" },
        lines: [makeLine()],
      })
    );
    expect(payload.globalDiscount).toEqual({ type: "PERCENT", value: 7 });
  });

  it("sin origin (undefined) → SÍ envía globalDiscount (retrocompat)", () => {
    const { payload } = buildSalePreviewPayload(
      makeDraft({
        discountGlobal: { type: "PERCENT", value: 12 } as any,
        lines: [makeLine()],
      })
    );
    expect(payload.globalDiscount).toEqual({ type: "PERCENT", value: 12 });
  });

  it("origin=CLIENT con value=0 → null igual", () => {
    const { payload } = buildSalePreviewPayload(
      makeDraft({
        discountGlobal: { type: "PERCENT", value: 0, origin: "CLIENT" },
        lines: [makeLine()],
      })
    );
    expect(payload.globalDiscount).toBeNull();
  });

  // ─── T43.5 — Anti-regresión del loop infinito de redondeo ────────────────
  //
  // El payload del preview debe leer `pricingMeta.manualPrice` como fuente
  // ÚNICA del precio manual del operador — NO `l.unitPrice` directo.
  //
  // Motivo: `l.unitPrice` lo hidrata el preview anterior y puede tener
  // micro-redondeos del motor. Si el siguiente preview construye su
  // payload desde `l.unitPrice`, la diferencia de redondeo cambia la firma
  // del preview, dispara otro preview, y así sucesivamente → loop
  // infinito. El campo `meta.manualPrice` preserva el INTENTO exacto del
  // operador (sin redondeo motor), por eso es la fuente segura.
  describe("T43.5 — manualPriceOverride viene de meta.manualPrice, NO de l.unitPrice", () => {
    it("flag price=true + meta.manualPrice=500 + l.unitPrice=499.99 (drift motor) → payload usa 500", () => {
      // Caso real del loop: motor devolvió 499.99 (con drift de redondeo),
      // pero el operador puso 500. El payload debe respetar la intención.
      const { payload } = buildSalePreviewPayload(
        makeDraft({
          lines: [makeLine({
            unitPrice: 499.99,                          // hidratado post-preview
            manualOverrides: { price: true } as any,    // flag activo
            pricingMeta: { manualPrice: 500 } as any,   // intención del operador
          })],
        }),
      );
      expect((payload.lines[0] as any).manualPriceOverride).toBe(500);
    });

    it("flag price=true + meta.manualPrice null → fallback a l.unitPrice", () => {
      // Sin meta.manualPrice explícito (estado transitorio), pero con flag
      // activo: el payload usa l.unitPrice como fallback para no perder el
      // override.
      const { payload } = buildSalePreviewPayload(
        makeDraft({
          lines: [makeLine({
            unitPrice: 750,
            manualOverrides: { price: true } as any,
            pricingMeta: { manualPrice: null } as any,
          })],
        }),
      );
      expect((payload.lines[0] as any).manualPriceOverride).toBe(750);
    });

    it("SIN flag price (override no activo) → manualPriceOverride = null (precio de lista)", () => {
      const { payload } = buildSalePreviewPayload(
        makeDraft({
          lines: [makeLine({
            unitPrice: 100,
            // sin manualOverrides ni pricingMeta.
          })],
        }),
      );
      expect((payload.lines[0] as any).manualPriceOverride).toBeNull();
    });

    it("anti-loop: con drift en l.unitPrice, dos previews consecutivos mandan EXACTAMENTE el mismo override", () => {
      // Caso concreto del loop infinito: operador puso 500, motor devolvió
      // 499.9994. Si el payload usara l.unitPrice, en el siguiente ciclo
      // mandaría 499.9994 → motor devuelve 499.9988 → ... LOOP.
      // El payload debe seguir mandando 500 (= meta.manualPrice) → la firma
      // del preview es estable → no se dispara otro preview.
      const ov   = { price: true } as any;
      const meta = { manualPrice: 500 } as any;

      const { payload: p1 } = buildSalePreviewPayload(
        makeDraft({ lines: [makeLine({ unitPrice: 499.9994, manualOverrides: ov, pricingMeta: meta })] }),
      );
      const { payload: p2 } = buildSalePreviewPayload(
        makeDraft({ lines: [makeLine({ unitPrice: 500.0021, manualOverrides: ov, pricingMeta: meta })] }),
      );
      // Ambos payloads mandan 500 sin importar el drift de l.unitPrice.
      expect((p1.lines[0] as any).manualPriceOverride).toBe(500);
      expect((p2.lines[0] as any).manualPriceOverride).toBe(500);
      expect((p1.lines[0] as any).manualPriceOverride).toBe((p2.lines[0] as any).manualPriceOverride);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Fase 4.2 — balanceModeOverride viaja en el payload
  // ────────────────────────────────────────────────────────────────────────
  describe("balanceModeOverride", () => {
    it("sin override en draft → payload manda balanceModeOverride = null", () => {
      const { payload } = buildSalePreviewPayload(
        makeDraft({ lines: [makeLine()] }),
      );
      expect((payload as any).balanceModeOverride).toBeNull();
    });

    it("override UNIFIED → payload manda 'UNIFIED'", () => {
      const { payload } = buildSalePreviewPayload(
        makeDraft({ balanceModeOverride: "UNIFIED", lines: [makeLine()] }),
      );
      expect((payload as any).balanceModeOverride).toBe("UNIFIED");
    });

    it("override BREAKDOWN → payload manda 'BREAKDOWN'", () => {
      const { payload } = buildSalePreviewPayload(
        makeDraft({ balanceModeOverride: "BREAKDOWN", lines: [makeLine()] }),
      );
      expect((payload as any).balanceModeOverride).toBe("BREAKDOWN");
    });

    it("override = null en draft → payload manda null (Automático)", () => {
      const { payload } = buildSalePreviewPayload(
        makeDraft({ balanceModeOverride: null, lines: [makeLine()] }),
      );
      expect((payload as any).balanceModeOverride).toBeNull();
    });

    it("override con string ajeno al enum → sanitizado a null (defensive)", () => {
      const { payload } = buildSalePreviewPayload(
        makeDraft({ balanceModeOverride: "MIXED" as any, lines: [makeLine()] }),
      );
      expect((payload as any).balanceModeOverride).toBeNull();
    });

    it("cambiar override entre previews cambia la firma (re-dispara preview)", () => {
      const drafts = [
        makeDraft({ balanceModeOverride: null,        lines: [makeLine()] }),
        makeDraft({ balanceModeOverride: "UNIFIED",   lines: [makeLine()] }),
        makeDraft({ balanceModeOverride: "BREAKDOWN", lines: [makeLine()] }),
      ];
      const payloads = drafts.map((d) => buildSalePreviewPayload(d).payload);
      const sigs = payloads.map((p) => JSON.stringify(p));
      // Los 3 payloads son distintos → la signature cambia → previewSale corre.
      expect(new Set(sigs).size).toBe(3);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Etapa 3A-fix — Defensa scope/mode: si manualAdjustment.scope=BREAKDOWN,
  // el payload SIEMPRE fuerza balanceModeOverride=BREAKDOWN, sin importar
  // el estado del draft. Resuelve el race: el operador edita ajuste por
  // metal, pero el setState del balanceModeOverride todavía no se aplicó
  // (o el operador clickeó "Unificado" previamente). El motor rechaza con
  // 400 cualquier combinación incoherente; el frontend ahora la previene
  // estructuralmente.
  // ────────────────────────────────────────────────────────────────────────
  describe("Etapa 3A-fix — scope BREAKDOWN fuerza override BREAKDOWN", () => {
    it("scope BREAKDOWN + override=null → payload con override='BREAKDOWN' (auto-promovido)", () => {
      const { payload } = buildSalePreviewPayload(
        makeDraft({
          balanceModeOverride: null,
          lines: [makeLine()],
          manualAdjustment: {
            scope: "BREAKDOWN",
            metals: [],
            monetaryAmount: 50,
          } as any,
        }),
      );
      expect((payload as any).balanceModeOverride).toBe("BREAKDOWN");
      expect((payload as any).manualAdjustment?.scope).toBe("BREAKDOWN");
    });

    it("scope BREAKDOWN + override='UNIFIED' stale → payload con override='BREAKDOWN' (fuerza coherencia)", () => {
      // Caso reportado por el usuario: operador clickeó 'Unificado' previamente,
      // después editó ajuste por metal. Sin esta defensa, el motor tiraba 400.
      const { payload } = buildSalePreviewPayload(
        makeDraft({
          balanceModeOverride: "UNIFIED",
          lines: [makeLine()],
          manualAdjustment: {
            scope: "BREAKDOWN",
            metals: [{ metalParentId: "oro-fino", targetGrams: 1 }],
            monetaryAmount: 0,
          } as any,
        }),
      );
      expect((payload as any).balanceModeOverride).toBe("BREAKDOWN");
    });

    it("scope BREAKDOWN + override='BREAKDOWN' → payload con override='BREAKDOWN' (no-op coherente)", () => {
      const { payload } = buildSalePreviewPayload(
        makeDraft({
          balanceModeOverride: "BREAKDOWN",
          lines: [makeLine()],
          manualAdjustment: {
            scope: "BREAKDOWN",
            metals: [],
            monetaryAmount: 50,
          } as any,
        }),
      );
      expect((payload as any).balanceModeOverride).toBe("BREAKDOWN");
    });

    it("scope UNIFIED + override='BREAKDOWN' → preserva override (no fuerza UNIFIED)", () => {
      // El operador puede tener documento en BREAKDOWN con ajuste UNIFIED
      // simultáneo (caso edge pero válido — el motor lo acepta).
      const { payload } = buildSalePreviewPayload(
        makeDraft({
          balanceModeOverride: "BREAKDOWN",
          lines: [makeLine()],
          manualAdjustment: {
            scope: "UNIFIED",
            amount: -100,
          } as any,
        }),
      );
      expect((payload as any).balanceModeOverride).toBe("BREAKDOWN");
      expect((payload as any).manualAdjustment?.scope).toBe("UNIFIED");
    });

    it("sin ajuste manual + override='UNIFIED' → preserva override (la defensa NO se activa)", () => {
      const { payload } = buildSalePreviewPayload(
        makeDraft({
          balanceModeOverride: "UNIFIED",
          lines: [makeLine()],
          manualAdjustment: undefined,
        }),
      );
      expect((payload as any).balanceModeOverride).toBe("UNIFIED");
      expect((payload as any).manualAdjustment).toBeNull();
    });

    it("ajuste BREAKDOWN sanitizado a null (sin metales útiles ni monetario) → preserva override", () => {
      // Si el operador puso scope=BREAKDOWN pero sin movimientos, el builder
      // de manualAdjustment sanitiza a null. La defensa NO se activa porque
      // el payload ya no tiene scope=BREAKDOWN.
      const { payload } = buildSalePreviewPayload(
        makeDraft({
          balanceModeOverride: "UNIFIED",
          lines: [makeLine()],
          manualAdjustment: {
            scope: "BREAKDOWN",
            metals: [],
            // sin monetaryAmount significativo
          } as any,
        }),
      );
      expect((payload as any).manualAdjustment).toBeNull();
      expect((payload as any).balanceModeOverride).toBe("UNIFIED");
    });
  });
});
