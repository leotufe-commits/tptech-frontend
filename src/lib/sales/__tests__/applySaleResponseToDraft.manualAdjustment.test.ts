// src/lib/sales/__tests__/applySaleResponseToDraft.manualAdjustment.test.ts
// =============================================================================
// Bug #2 — Rehidratación de Sale.manualAdjustmentInput al reabrir un borrador.
//
// Antes de este fix, abrir un borrador guardado con un ajuste manual perdía
// la intención del operador porque `applySaleResponseToDraft` no copiaba
// `sale.manualAdjustmentInput` al draft. Ahora el adapter projecta el campo
// preservando el shape (UNIFIED o BREAKDOWN).
// =============================================================================

import { describe, it, expect } from "vitest";
import { applySaleResponseToDraft } from "../applySaleResponseToDraft";
import type { SalesInvoice } from "../types";
import type { SaleDetail } from "../../../services/sales";

function makeDraft(o: Partial<SalesInvoice> = {}): SalesInvoice {
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
    ...o,
  } as SalesInvoice;
}

function makeSale(o: Partial<SaleDetail> = {}): SaleDetail {
  return {
    id: "sale-1",
    code: "FV-0001",
    status: "DRAFT",
    saleDate: "2026-05-28T00:00:00.000Z",
    subtotal: "0",
    discountAmount: "0",
    taxAmount: "0",
    total: "0",
    paidAmount: "0",
    notes: "",
    confirmedAt: null,
    cancelledAt: null,
    createdAt: "2026-05-28T00:00:00.000Z",
    client: null,
    seller: null,
    warehouse: null,
    createdBy: null,
    _count: { lines: 0 },
    clientSnapshot: null,
    sellerSnapshot: null,
    cancelNote: "",
    lines: [],
    payments: [],
    saleTotals: null,
    ...o,
  } as any as SaleDetail;
}

describe("applySaleResponseToDraft — rehidratación manualAdjustmentInput", () => {
  it("preserva draft.manualAdjustment cuando sale.manualAdjustmentInput es null", () => {
    const draft = makeDraft({
      manualAdjustment: { amount: -100, reason: "local" },
    });
    const sale = makeSale({ manualAdjustmentInput: null });
    const out = applySaleResponseToDraft(draft, sale);
    expect(out.manualAdjustment).toEqual({ amount: -100, reason: "local" });
  });

  it("rehidrata UNIFIED desde Sale.manualAdjustmentInput", () => {
    const draft = makeDraft({ manualAdjustment: undefined });
    const sale = makeSale({
      manualAdjustmentInput: {
        scope: "UNIFIED",
        amount: -250,
        reason: "cierre comercial",
      } as any,
    });
    const out = applySaleResponseToDraft(draft, sale);
    expect(out.manualAdjustment).toEqual({
      scope: "UNIFIED",
      amount: -250,
      reason: "cierre comercial",
    });
  });

  it("rehidrata BREAKDOWN desde Sale.manualAdjustmentInput", () => {
    const draft = makeDraft({ manualAdjustment: undefined });
    const sale = makeSale({
      manualAdjustmentInput: {
        scope: "BREAKDOWN",
        metals: [
          { metalParentId: "oro-fino", metalParentName: "Oro Fino", targetGrams: 1, reason: null },
          { metalParentId: "plata-925", deltaGrams: 0.06, reason: null },
        ],
        monetaryAmount: 45,
        reason: "cierre",
      } as any,
    });
    const out = applySaleResponseToDraft(draft, sale);
    expect((out.manualAdjustment as any).scope).toBe("BREAKDOWN");
    expect((out.manualAdjustment as any).metals).toHaveLength(2);
    expect((out.manualAdjustment as any).metals[0]).toEqual({
      metalParentId:   "oro-fino",
      metalParentName: "Oro Fino",
      targetGrams:     1,
      reason:          null,
    });
    expect((out.manualAdjustment as any).metals[1]).toEqual({
      metalParentId:   "plata-925",
      metalParentName: undefined,
      deltaGrams:      0.06,
      reason:          null,
    });
    expect((out.manualAdjustment as any).monetaryAmount).toBe(45);
    expect((out.manualAdjustment as any).reason).toBe("cierre");
  });

  it("BREAKDOWN sin metals[] (sólo monetaryAmount) → shape minimal", () => {
    const draft = makeDraft({ manualAdjustment: undefined });
    const sale = makeSale({
      manualAdjustmentInput: {
        scope: "BREAKDOWN",
        monetaryAmount: -100,
      } as any,
    });
    const out = applySaleResponseToDraft(draft, sale);
    expect(out.manualAdjustment).toEqual({
      scope: "BREAKDOWN",
      metals: [],
      monetaryAmount: -100,
      reason: null,
    });
  });
});
