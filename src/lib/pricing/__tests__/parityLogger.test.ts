// src/lib/pricing/__tests__/parityLogger.test.ts
// =============================================================================
// FASE 1.0 — PR2. Tests de:
//   · compareDocumentTotals (función pura)
//   · logParity con auto-warning cuando diff >= 0.01
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { compareDocumentTotals, logParity, PARITY_DELTA_THRESHOLD } from "../parityLogger";
import type { NormalizedPricingResult } from "../contract";

function makeNorm(overrides: Partial<NormalizedPricingResult["documentTotals"]> = {}): NormalizedPricingResult {
  return {
    source: "ARTICLE_PRICING_PREVIEW",
    lines:  [],
    channel: null,
    coupon:  null,
    payment: null,
    shipping:null,
    documentTotals: {
      subtotalBeforeDiscounts:    1000,
      lineDiscountAmount:         0,
      subtotalAfterLineDiscounts: 1000,
      channelAdjustmentAmount:    0,
      couponDiscountAmount:       0,
      paymentAdjustmentAmount:    0,
      shippingAmount:             0,
      globalDiscountAmount:       0,
      taxableBase:                1000,
      taxAmount:                  210,
      roundingAdjustment:         0,
      totalBeforeTax:             1000,
      totalWithTax:               1210,
      total:                      1210,
      ...overrides,
    },
    roundingInfo:            null,
    documentRoundingApplied: null,
    policy:                  { canConfirm: true, blockingAlerts: [] },
    alerts:                  [],
    clientBalanceType:       null,
    clientCommercialRules:   null,
    requestedPriceListId:    null,
    appliedPriceListId:      null,
    appliedPriceListName:    null,
  } as any;
}

// =============================================================================
// 1. compareDocumentTotals — función pura
// =============================================================================

describe("compareDocumentTotals — función pura", () => {
  it("baseline correct: snapshots idénticos → matched=true, brokenCount=0", () => {
    const a = makeNorm();
    const b = makeNorm();
    const r = compareDocumentTotals(a, b);
    expect(r.matched).toBe(true);
    expect(r.brokenCount).toBe(0);
    expect(r.broken).toEqual([]);
  });

  it("baseline correct: detecta delta en total como divergencia", () => {
    const a = makeNorm({ total: 1210 });
    const b = makeNorm({ total: 1211 });
    const r = compareDocumentTotals(a, b);
    expect(r.matched).toBe(false);
    expect(r.brokenCount).toBe(1);
    expect(r.broken[0].field).toBe("total");
    expect(r.broken[0].delta).toBe(1);
  });

  it("baseline correct: delta < 0.01 NO se considera divergencia", () => {
    const a = makeNorm({ total: 1210.005 });
    const b = makeNorm({ total: 1210.009 });
    // 1210.009 - 1210.005 = 0.004 → redondeado a 0 → matches
    const r = compareDocumentTotals(a, b);
    expect(r.matched).toBe(true);
  });

  it("baseline correct: delta exactamente 0.01 SÍ se considera divergencia", () => {
    const a = makeNorm({ total: 1210.00 });
    const b = makeNorm({ total: 1210.01 });
    const r = compareDocumentTotals(a, b);
    expect(r.matched).toBe(false);
    expect(r.broken[0].delta).toBe(0.01);
  });

  it("baseline correct: detecta múltiples campos divergentes", () => {
    const a = makeNorm({ total: 1210, taxAmount: 210, channelAdjustmentAmount: 0 });
    const b = makeNorm({ total: 1300, taxAmount: 250, channelAdjustmentAmount: 50 });
    const r = compareDocumentTotals(a, b);
    expect(r.brokenCount).toBe(3);
    expect(r.broken.map(x => x.field).sort()).toEqual([
      "channelAdjustmentAmount", "taxAmount", "total",
    ]);
  });

  it("baseline correct: snapshots null/undefined se tratan como 0 en cada campo", () => {
    const r = compareDocumentTotals(null, null);
    expect(r.matched).toBe(true);
  });

  it("baseline correct: rows incluye los 14 campos de documentTotals", () => {
    const r = compareDocumentTotals(makeNorm(), makeNorm());
    expect(r.rows).toHaveLength(14);
    const fields = r.rows.map(x => x.field);
    expect(fields).toContain("total");
    expect(fields).toContain("taxAmount");
    expect(fields).toContain("subtotalBeforeDiscounts");
  });

  it("baseline correct: PARITY_DELTA_THRESHOLD constant exportada = 0.01", () => {
    expect(PARITY_DELTA_THRESHOLD).toBe(0.01);
  });
});

// =============================================================================
// 2. logParity — auto-warning con console.error
// =============================================================================

describe("logParity — auto-warning", () => {
  let errorSpy:        ReturnType<typeof vi.spyOn>;
  let groupSpy:        ReturnType<typeof vi.spyOn>;
  let groupEndSpy:     ReturnType<typeof vi.spyOn>;
  let groupCollapseSpy: ReturnType<typeof vi.spyOn>;
  let logSpy:          ReturnType<typeof vi.spyOn>;
  let warnSpy:         ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Limpiar registry global entre tests para no contaminar.
    if (typeof window !== "undefined") {
      (window as any).__tptechParity = undefined;
    }
    errorSpy        = vi.spyOn(console, "error").mockImplementation(() => {});
    groupSpy        = vi.spyOn(console, "group").mockImplementation(() => {});
    groupEndSpy     = vi.spyOn(console, "groupEnd").mockImplementation(() => {});
    groupCollapseSpy = vi.spyOn(console, "groupCollapsed").mockImplementation(() => {});
    logSpy          = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy         = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    errorSpy.mockRestore();
    groupSpy.mockRestore();
    groupEndSpy.mockRestore();
    groupCollapseSpy.mockRestore();
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("baseline correct: con un solo snapshot NO dispara auto-warning", () => {
    logParity("simulator", { payload: {}, normalized: makeNorm() });
    // No invoice todavía → no comparación
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("baseline correct: ambos snapshots idénticos NO dispara auto-warning (silencio en éxito)", () => {
    const norm = makeNorm({ total: 1210 });
    logParity("simulator", { payload: {}, normalized: norm });
    logParity("invoice",   { payload: {}, normalized: norm });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("baseline correct: divergencia >= 0.01 emite console.error con [PARITY:auto]", () => {
    logParity("simulator", { payload: {}, normalized: makeNorm({ total: 1210 }) });
    logParity("invoice",   { payload: {}, normalized: makeNorm({ total: 1211 }) });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const msg = errorSpy.mock.calls[0]?.[0] as string;
    expect(msg).toContain("[PARITY:auto]");
    expect(msg).toContain("DIVERGENCIA DETECTADA");
    expect(msg).toContain("total");
    expect(msg).toContain("delta=1");
  });

  it("baseline correct: divergencia < 0.01 NO emite warning", () => {
    logParity("simulator", { payload: {}, normalized: makeNorm({ total: 1210.005 }) });
    logParity("invoice",   { payload: {}, normalized: makeNorm({ total: 1210.008 }) });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("baseline correct: el orden simulator→invoice o invoice→simulator no afecta la detección", () => {
    logParity("invoice",   { payload: {}, normalized: makeNorm({ total: 1300 }) });
    logParity("simulator", { payload: {}, normalized: makeNorm({ total: 1210 }) });
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("baseline correct: incluye todos los campos divergentes en el mensaje", () => {
    logParity("simulator", { payload: {}, normalized: makeNorm({ total: 1210, taxAmount: 210 }) });
    logParity("invoice",   { payload: {}, normalized: makeNorm({ total: 1300, taxAmount: 280 }) });
    const msg = errorSpy.mock.calls[0]?.[0] as string;
    expect(msg).toContain("total");
    expect(msg).toContain("taxAmount");
    // brokenCount = 2
    expect(msg).toMatch(/2 campo\(s\)/);
  });
});
