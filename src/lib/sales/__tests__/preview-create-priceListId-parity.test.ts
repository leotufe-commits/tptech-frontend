// src/lib/sales/__tests__/preview-create-priceListId-parity.test.ts
// =============================================================================
// Etapa C16 — Test de regresión del fix del drift detectado en C15:
//
//   Pre-C16: buildSalePreviewPayload SÍ enviaba `priceListId` del documento;
//            buildSaleCreatePayload  NO lo enviaba.
//   Resultado: preview calculaba con la lista nueva, save persistía con la
//              cadena fallback (cliente → favorita) y aparecía drift entre lo
//              que el operador veía en pantalla y lo que quedaba en DB.
//
// Esta suite verifica la PARIDAD del campo `priceListId` entre los dos
// payloads — para el mismo draft, los dos builders deben emitir el mismo
// valor. Cualquier regresión que vuelva a omitir el campo en `create` rompe
// esta suite.
// =============================================================================

import { describe, it, expect } from "vitest";
import { buildSalePreviewPayload } from "../buildSalePreviewPayload";
import { buildSaleCreatePayload } from "../buildSaleCreatePayload";
import type { SalesInvoice } from "../types";
import type { DocumentLine } from "../../document-types";

function makeLine(over: Partial<DocumentLine> = {}): DocumentLine {
  return {
    id:        "line-1",
    type:      "ARTICLE",
    articleId: "art-1",
    variantId: null,
    article:   "Anillo",
    variant:   "",
    quantity:  1,
    unitPrice: 1000,
    discountAmount: 0,
    lineTotal: 1000,
    ...over,
  } as DocumentLine;
}

function makeDraft(priceListId: string | undefined): SalesInvoice {
  return {
    id:               "draft-1",
    number:           "FV-0001",
    date:             "2026-05-28",
    dueDate:          "",
    clientId:         "client-1",
    client:           "Cliente Test",
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
    subtotal:         1000,
    discountAmount:   0,
    taxAmount:        0,
    total:            1000,
    paidAmount:       0,
    lines:            [makeLine()],
    status:           "DRAFT",
    priceListId,
  } as SalesInvoice;
}

describe("preview ↔ create paridad de priceListId (C16)", () => {
  it("draft.priceListId='prueba2' → ambos payloads envían 'prueba2'", () => {
    const draft   = makeDraft("prueba2");
    const preview = buildSalePreviewPayload(draft) as any;
    const create  = buildSaleCreatePayload(draft) as any;
    expect(preview.payload.priceListId).toBe("prueba2");
    expect(create.payload.priceListId).toBe("prueba2");
    expect(preview.payload.priceListId).toBe(create.payload.priceListId);
  });

  it("draft.priceListId='Lista Unificada-id' → ambos payloads coinciden", () => {
    const draft   = makeDraft("cmp4tnnmn004omwcagcmys2tr");  // id real de Lista Unificada
    const preview = buildSalePreviewPayload(draft) as any;
    const create  = buildSaleCreatePayload(draft) as any;
    expect(preview.payload.priceListId).toBe(create.payload.priceListId);
    expect(preview.payload.priceListId).toBe("cmp4tnnmn004omwcagcmys2tr");
  });

  it("draft.priceListId=undefined → ambos payloads envían null (no se omite)", () => {
    const draft   = makeDraft(undefined);
    const preview = buildSalePreviewPayload(draft) as any;
    const create  = buildSaleCreatePayload(draft) as any;
    expect(preview.payload.priceListId).toBeNull();
    expect(create.payload.priceListId).toBeNull();
  });

  it("regresión C15: el create NO debe omitir el campo aunque el draft lo tenga", () => {
    // Si alguien revierte el fix borrando la línea del builder, la propiedad
    // queda `undefined`. Verificamos que esté DECLARADA (no `undefined`).
    const draft  = makeDraft("prueba2");
    const create = buildSaleCreatePayload(draft) as any;
    expect("priceListId" in create.payload).toBe(true);
    expect(create.payload.priceListId).not.toBeUndefined();
  });
});
