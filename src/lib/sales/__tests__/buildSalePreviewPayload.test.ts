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
