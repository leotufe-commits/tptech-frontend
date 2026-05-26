// src/lib/sales/__tests__/buildSaleCreatePayload.test.ts
// =============================================================================
// Tests del builder de payload para `salesApi.create()`. Funcion PURA — los
// tests cubren shape, filtros (placeholders/headers/manuales sin articulo)
// y normalizacion de strings vacios a null para FKs opcionales.
// =============================================================================

import { describe, it, expect } from "vitest";
import { buildSaleCreatePayload } from "../buildSaleCreatePayload";
import type { SalesInvoice } from "../types";
import type { DocumentLine } from "../../document-types";

function makeLine(over: Partial<DocumentLine> = {}): DocumentLine {
  return {
    id:           "line-1",
    type:         "ARTICLE",
    articleId:    "art-1",
    variantId:    null,
    article:      "Anillo Oro",
    variant:      "",
    sku:          "AN-001",
    unitOfMeasure: undefined,
    quantity:        2,
    unitPrice:       100,
    discountAmount:  0,
    lineTotal:       200,
    ...over,
  } as DocumentLine;
}

function makeDraft(over: Partial<SalesInvoice> = {}): SalesInvoice {
  return {
    id:               "local-uuid-1",
    number:           "FV-0001",
    date:             "2026-05-26",
    dueDate:          "",
    clientId:         "client-cuid",
    client:           "Cliente SA",
    salesOrderNumber: "",
    deliveryNumber:   "",
    currency:         "ARS",
    fxRate:           1,
    taxPercent:       0,
    seller:           "seller-cuid",
    warehouse:        "wh-cuid",
    paymentTerm:      "",
    referenceNumber:  "",
    notes:            "Entrega martes",
    terms:            "",
    subtotal:         200,
    discountAmount:   0,
    taxAmount:        42,
    total:            242,
    paidAmount:       0,
    lines:            [makeLine()],
    status:           "DRAFT",
    priceListId:      "pl-1",
    channelId:        "ch-1",
    couponCode:       undefined,
    ...over,
  } as SalesInvoice;
}

describe("buildSaleCreatePayload", () => {
  it("mapea draft completo → CreateSalePayload con shape esperado", () => {
    const out = buildSaleCreatePayload(makeDraft());
    expect(out.hasRealLines).toBe(true);
    expect(out.payload).toMatchObject({
      clientId:    "client-cuid",
      sellerId:    "seller-cuid",
      warehouseId: "wh-cuid",
      channelId:   "ch-1",
      couponCode:  null,
      notes:       "Entrega martes",
      lines: [
        { articleId: "art-1", variantId: null, quantity: 2, unitPrice: 100 },
      ],
    });
  });

  it("seller/warehouse vacios → null (no string vacio)", () => {
    const out = buildSaleCreatePayload(makeDraft({ seller: "", warehouse: "   " }));
    expect(out.payload.sellerId).toBeNull();
    expect(out.payload.warehouseId).toBeNull();
  });

  it("filtra placeholders (sin articleId)", () => {
    const draft = makeDraft({
      lines: [
        makeLine({ id: "l1", articleId: "art-1" }),
        makeLine({ id: "l2", articleId: undefined, article: "" }),    // placeholder vacio
        makeLine({ id: "l3", articleId: "art-3" }),
      ],
    });
    const out = buildSaleCreatePayload(draft);
    expect(out.payload.lines).toHaveLength(2);
    expect(out.payload.lines.map((l) => l.articleId)).toEqual(["art-1", "art-3"]);
  });

  it("filtra HEADER lines (no van al backend)", () => {
    const draft = makeDraft({
      lines: [
        { ...makeLine({ id: "l1" }) },
        { id: "h1", type: "HEADER", title: "Productos", articleId: undefined } as unknown as DocumentLine,
        { ...makeLine({ id: "l2", articleId: "art-2" }) },
      ],
    });
    const out = buildSaleCreatePayload(draft);
    expect(out.payload.lines).toHaveLength(2);
    expect(out.payload.lines.every((l) => l.articleId !== undefined && l.articleId !== "")).toBe(true);
  });

  it("filtra MANUAL lines sin articleId (limitacion v1 de salesApi.create)", () => {
    const draft = makeDraft({
      lines: [
        makeLine({ id: "l1" }),
        { id: "m1", type: "MANUAL", isManual: true, manualDescription: "Servicio extra", articleId: undefined, quantity: 1, unitPrice: 500, lineTotal: 500 } as unknown as DocumentLine,
      ],
    });
    const out = buildSaleCreatePayload(draft);
    // Solo la linea con articleId pasa.
    expect(out.payload.lines).toHaveLength(1);
    expect(out.payload.lines[0]!.articleId).toBe("art-1");
  });

  it("draft sin lineas reales → hasRealLines: false", () => {
    const out = buildSaleCreatePayload(makeDraft({ lines: [] }));
    expect(out.hasRealLines).toBe(false);
    expect(out.payload.lines).toHaveLength(0);
  });

  it("clientId undefined → null en payload", () => {
    const draft = makeDraft();
    delete (draft as { clientId?: string }).clientId;
    const out = buildSaleCreatePayload(draft);
    expect(out.payload.clientId).toBeNull();
  });

  it("balanceModeOverride: pasa el valor del draft o null", () => {
    expect(buildSaleCreatePayload(makeDraft({ balanceModeOverride: "BREAKDOWN" })).payload.balanceModeOverride).toBe("BREAKDOWN");
    expect(buildSaleCreatePayload(makeDraft({ balanceModeOverride: null })).payload.balanceModeOverride).toBeNull();
    const draft = makeDraft();
    delete (draft as { balanceModeOverride?: "UNIFIED" | "BREAKDOWN" | null }).balanceModeOverride;
    expect(buildSaleCreatePayload(draft).payload.balanceModeOverride).toBeNull();
  });

  it("variantId presente → se pasa tal cual", () => {
    const out = buildSaleCreatePayload(makeDraft({
      lines: [makeLine({ variantId: "var-1" })],
    }));
    expect(out.payload.lines[0]!.variantId).toBe("var-1");
  });

  it("no emite discountPct (campo no presente en DocumentLine v1)", () => {
    const out = buildSaleCreatePayload(makeDraft());
    expect(out.payload.lines[0]!.discountPct).toBeUndefined();
  });
});
