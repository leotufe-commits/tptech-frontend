// src/lib/sales/__tests__/applySaleResponseToDraft.test.ts
// Etapa 3 — tests del helper que hidrata el draft con la respuesta de
// create / update / confirm / cancel del backend.

import { describe, it, expect } from "vitest";
import { applySaleResponseToDraft } from "../applySaleResponseToDraft";
import type { SalesInvoice } from "../types";
import type { SaleDetail } from "../../../services/sales";

function makeDraft(over: Partial<SalesInvoice> = {}): SalesInvoice {
  return {
    id:               "local-uuid-1",
    number:           "FV-0001",
    date:             "2026-05-26",
    dueDate:          "",
    clientId:         "client-1",
    client:           "Cliente SA",
    salesOrderNumber: "",
    deliveryNumber:   "",
    currency:         "ARS",
    fxRate:           1,
    taxPercent:       0,
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
    ...over,
  } as SalesInvoice;
}

function makeSaleDetail(over: Partial<SaleDetail> = {}): SaleDetail {
  return {
    id:               "sale-real-1",
    code:             "VTA-0001",
    status:           "DRAFT",
    saleDate:         "2026-05-26",
    subtotal:         "1000",
    discountAmount:   "0",
    taxAmount:        "0",
    total:            "1000",
    paidAmount:       "0",
    notes:            "",
    confirmedAt:      null,
    cancelledAt:      null,
    createdAt:        "2026-05-26",
    sellerCommissionTotal: null,
    client:           null,
    seller:           null,
    warehouse:        null,
    createdBy:        null,
    _count:           { lines: 1 },
    clientSnapshot:   null,
    sellerSnapshot:   null,
    cancelNote:       "",
    lines:            [],
    payments:         [],
    saleTotals:       null,
    ...over,
  } as SaleDetail;
}

describe("applySaleResponseToDraft", () => {
  it("hidrata id, number, status del backend al draft", () => {
    const draft = makeDraft({ id: "local-uuid-1" });
    const sale  = makeSaleDetail({ id: "sale-real-1", code: "VTA-0001", status: "DRAFT" });
    const out   = applySaleResponseToDraft(draft, sale);
    expect(out.id).toBe("sale-real-1");
    expect(out.number).toBe("VTA-0001");
    expect(out.status).toBe("DRAFT");
  });

  it("CONFIRMED del backend → PENDING del frontend", () => {
    const out = applySaleResponseToDraft(
      makeDraft(),
      makeSaleDetail({ status: "CONFIRMED" }),
    );
    expect(out.status).toBe("PENDING");
  });

  it("extrae officialNumber del primer INVOICE OUTBOUND ISSUED", () => {
    const sale = makeSaleDetail({
      status: "CONFIRMED",
      receipts: [
        { id: "r1", code: "A-0001-00000007", type: "INVOICE", direction: "OUTBOUND", status: "ISSUED", issueDate: "", issuedAt: "" },
        { id: "r2", code: "NC-0001-00000001", type: "CREDIT_NOTE", direction: "OUTBOUND", status: "ISSUED", issueDate: "", issuedAt: "" },
      ],
    });
    const out = applySaleResponseToDraft(makeDraft(), sale);
    expect(out.officialNumber).toBe("A-0001-00000007");
  });

  it("sin receipts (DRAFT) → officialNumber undefined", () => {
    const out = applySaleResponseToDraft(makeDraft(), makeSaleDetail());
    expect(out.officialNumber).toBeUndefined();
  });

  it("hidrata totales del backend en el draft", () => {
    const out = applySaleResponseToDraft(
      makeDraft({ total: 999 }),
      makeSaleDetail({ subtotal: "500", discountAmount: "50", taxAmount: "100", total: "550" }),
    );
    expect(out.subtotal).toBe(500);
    expect(out.discountAmount).toBe(50);
    expect(out.taxAmount).toBe(100);
    expect(out.total).toBe(550);
  });

  it("shippingAmount persistido → mergeado en draft.shipping.cost", () => {
    const draft = makeDraft({
      shipping: { methodId: "carrier-1", cost: 100, address: "Av. Siempre Viva", carrier: "OCA" },
    });
    const sale = makeSaleDetail({ shippingAmount: "250" });
    const out  = applySaleResponseToDraft(draft, sale);
    expect(out.shipping?.cost).toBe(250);
    // El resto del shipping del draft (methodId, address, carrier) se preserva.
    expect(out.shipping?.methodId).toBe("carrier-1");
    expect(out.shipping?.address).toBe("Av. Siempre Viva");
  });

  it("globalDiscount persistido → mergeado en draft.discountGlobal", () => {
    const draft = makeDraft({
      discountGlobal: { type: "PERCENT", value: 0, reason: "VIP", origin: "MANUAL" },
    });
    const sale = makeSaleDetail({
      globalDiscountType:  "AMOUNT",
      globalDiscountValue: "75",
    });
    const out = applySaleResponseToDraft(draft, sale);
    expect(out.discountGlobal?.type).toBe("AMOUNT");
    expect(out.discountGlobal?.value).toBe(75);
    expect(out.discountGlobal?.reason).toBe("VIP");
    expect(out.discountGlobal?.origin).toBe("MANUAL");
  });

  it("DRAFT sin shipping/globalDiscount persistido → preserva draft tal cual", () => {
    const draft = makeDraft({
      shipping:       { methodId: "pickup", cost: 0, address: "", carrier: "" },
      discountGlobal: { type: "PERCENT", value: 0, reason: "" },
    });
    const out = applySaleResponseToDraft(draft, makeSaleDetail());
    expect(out.shipping).toEqual(draft.shipping);
    expect(out.discountGlobal).toEqual(draft.discountGlobal);
  });

  it("preserva lines del draft (no las pisa con [])", () => {
    const draft = makeDraft({
      lines: [{ id: "L1", type: "ARTICLE", articleId: "a1", article: "Anillo", variant: "", quantity: 1, unitPrice: 100, discountAmount: 0, subtotal: 100 } as any],
    });
    const out = applySaleResponseToDraft(draft, makeSaleDetail({ lines: [] }));
    expect(out.lines).toHaveLength(1);
    expect(out.lines[0]!.id).toBe("L1");
  });
});
