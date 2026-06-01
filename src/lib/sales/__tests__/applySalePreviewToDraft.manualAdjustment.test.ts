// src/lib/sales/__tests__/applySalePreviewToDraft.manualAdjustment.test.ts
// =============================================================================
// Etapa A — Asegura que el draft escriba `draft.total = finalTotal` cuando el
// backend devolvió ajuste manual. Sin ajuste, `finalTotal === documentTotals.total`
// y el comportamiento es idéntico al previo.
//
// POLICY §R-Rounding-9: passthrough estricto, cero matemática local.
// =============================================================================

import { describe, it, expect } from "vitest";
import { applySalePreviewToDraft } from "../applySalePreviewToDraft";
import type { SalesInvoice } from "../types";
import type { SalePreviewResult } from "../../../services/sales";

function makeDraft(): SalesInvoice {
  return { lines: [] } as any as SalesInvoice;
}

function makePreviewBase(): SalePreviewResult {
  return {
    lines: [],
    documentTotals: {
      subtotalBeforeDiscounts:    1000,
      lineDiscountAmount:         0,
      subtotalAfterLineDiscounts: 1000,
      couponDiscountAmount:       0,
      globalDiscountAmount:       0,
      taxAmount:                  210,
      shippingAmount:             0,
      total:                      1210, // engineTotal
    },
  } as any;
}

describe("applySalePreviewToDraft — Etapa A (finalTotal vs engineTotal)", () => {
  it("sin manualAdjustment → draft.total === documentTotals.total", () => {
    const draft = makeDraft();
    const preview = makePreviewBase();
    const out = applySalePreviewToDraft(draft, preview);
    expect(out.total).toBe(1210);
  });

  it("con manualAdjustment (=-210) → draft.total === finalTotal (1000), NO engineTotal (1210)", () => {
    const draft = makeDraft();
    const preview: any = {
      ...makePreviewBase(),
      engineTotal: 1210,
      finalTotal:  1000,
      manualAdjustment: {
        scope:   "UNIFIED",
        unified: { preAmount: 1210, postAmount: 1000, amount: -210 },
        totals:  { monetaryAdjustment: -210 },
        audit:   { appliedBy: null, appliedAt: "x", reason: null },
      },
    };
    const out = applySalePreviewToDraft(draft, preview);
    expect(out.total).toBe(1000);
  });

  it("con manualAdjustment clampeado a 0 (engineTotal=100, amount=-200) → finalTotal=0", () => {
    const draft = makeDraft();
    const preview: any = {
      lines: [],
      documentTotals: {
        subtotalBeforeDiscounts:    100,
        lineDiscountAmount:         0,
        subtotalAfterLineDiscounts: 100,
        couponDiscountAmount:       0,
        globalDiscountAmount:       0,
        taxAmount:                  0,
        shippingAmount:             0,
        total:                      100,
      },
      engineTotal: 100,
      finalTotal:  0,
      manualAdjustment: {
        scope:   "UNIFIED",
        unified: { preAmount: 100, postAmount: 0, amount: -100 },
        totals:  { monetaryAdjustment: -100 },
        audit:   { appliedBy: null, appliedAt: "x", reason: null },
      },
    };
    const out = applySalePreviewToDraft(draft, preview);
    expect(out.total).toBe(0);
  });

  it("preview legacy SIN finalTotal → fallback a documentTotals.total (back-compat)", () => {
    const draft = makeDraft();
    // Preview "viejo" sin engineTotal/finalTotal (compat con clientes pre-Etapa A).
    const preview: any = makePreviewBase();
    delete (preview as any).finalTotal;
    delete (preview as any).engineTotal;
    delete (preview as any).manualAdjustment;
    const out = applySalePreviewToDraft(draft, preview);
    expect(out.total).toBe(1210);
  });

  it("CERO matemática local: finalTotal del backend se copia byte a byte", () => {
    // Si el backend devuelve un finalTotal "raro" (ej. ajuste decimal), el
    // draft lo respeta sin redondeos propios.
    const draft = makeDraft();
    const preview: any = {
      ...makePreviewBase(),
      engineTotal: 1210,
      finalTotal:  1207.37, // ajuste -2.63
      manualAdjustment: {
        scope:   "UNIFIED",
        unified: { preAmount: 1210, postAmount: 1207.37, amount: -2.63 },
        totals:  { monetaryAdjustment: -2.63 },
        audit:   { appliedBy: null, appliedAt: "x", reason: null },
      },
    };
    const out = applySalePreviewToDraft(draft, preview);
    expect(out.total).toBe(1207.37);
  });
});
