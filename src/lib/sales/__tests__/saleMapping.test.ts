// src/lib/sales/__tests__/saleMapping.test.ts
// Etapa 3 — tests de los helpers de mapeo SaleRow / SaleDetail → SalesInvoice
// y del manejo de errores de la API (409 / 422).

import { describe, it, expect } from "vitest";
import {
  saleRowToSalesInvoice,
  saleDetailToSalesInvoice,
  mapBackendSaleStatus,
  extractApiErrorMessage,
  deriveDocumentPriceListIdFromLines,
} from "../saleMapping";
import type { SaleRow, SaleDetail } from "../../../services/sales";

function makeSaleRow(over: Partial<SaleRow> = {}): SaleRow {
  return {
    id:        "sale-1",
    code:      "VTA-0001",
    status:    "DRAFT",
    saleDate:  "2026-05-26",
    subtotal:  "1000",
    discountAmount: "0",
    taxAmount: "0",
    total:     "1000",
    paidAmount: "0",
    notes:     "",
    confirmedAt: null,
    cancelledAt: null,
    createdAt:   "2026-05-26",
    sellerCommissionTotal: null,
    client:    { id: "c1", displayName: "Cliente SA", code: "" },
    seller:    null,
    warehouse: null,
    createdBy: null,
    _count:    { lines: 0 },
    ...over,
  };
}

function makeSaleDetail(over: Partial<SaleDetail> = {}): SaleDetail {
  return {
    ...makeSaleRow(),
    clientSnapshot: null,
    sellerSnapshot: null,
    cancelNote:     "",
    lines:          [],
    payments:       [],
    saleTotals:     null,
    ...over,
  } as SaleDetail;
}

describe("mapBackendSaleStatus", () => {
  it("CONFIRMED del backend → PENDING del frontend", () => {
    expect(mapBackendSaleStatus("CONFIRMED")).toBe("PENDING");
  });
  it("PARTIALLY_PAID → PARTIAL", () => {
    expect(mapBackendSaleStatus("PARTIALLY_PAID")).toBe("PARTIAL");
  });
  it("DRAFT / PAID / CANCELLED se preservan", () => {
    expect(mapBackendSaleStatus("DRAFT")).toBe("DRAFT");
    expect(mapBackendSaleStatus("PAID")).toBe("PAID");
    expect(mapBackendSaleStatus("CANCELLED")).toBe("CANCELLED");
  });
});

describe("saleRowToSalesInvoice", () => {
  it("mapea campos básicos del listado", () => {
    const row = makeSaleRow({ code: "VTA-0042", total: "1500", status: "CONFIRMED" });
    const out = saleRowToSalesInvoice(row);
    expect(out.id).toBe("sale-1");
    expect(out.number).toBe("VTA-0042");
    expect(out.total).toBe(1500);
    expect(out.status).toBe("PENDING");  // CONFIRMED → PENDING
    expect(out.client).toBe("Cliente SA");
    expect(out.lines).toEqual([]);  // listado no trae líneas
  });

  it("sin cliente → 'Consumidor final'", () => {
    const out = saleRowToSalesInvoice(makeSaleRow({ client: null }));
    expect(out.client).toBe("Consumidor final");
    expect(out.clientId).toBeUndefined();
  });
});

describe("saleDetailToSalesInvoice", () => {
  it("rehidrata líneas como DocumentLine[]", () => {
    const detail = makeSaleDetail({
      lines: [{
        id:          "L1",
        articleId:   "art-1",
        variantId:   "var-1",
        articleName: "Anillo Oro",
        variantName: "18k",
        sku:         "AN-001",
        barcode:     "",
        quantity:    "2",
        unitPrice:   "500",
        discountPct: "0",
        lineTotal:   "1000",
        priceSource: "PRICE_LIST",
        appliedPriceListId: "pl-1",
        appliedPromotionId: null,
        appliedDiscountId:  null,
        unitCost:    "200",
        totalCost:   "400",
        unitMargin:  "300",
        totalMargin: "600",
        marginPercent: "60",
        sortOrder:   0,
        article:     { id: "art-1", code: "AN-001", name: "Anillo Oro", mainImageUrl: "" },
        variant:     { id: "var-1", code: "V18", name: "18k" },
      }],
    });
    const out = saleDetailToSalesInvoice(detail);
    expect(out.lines).toHaveLength(1);
    const line = out.lines[0]!;
    expect(line.id).toBe("L1");
    expect(line.articleId).toBe("art-1");
    expect(line.variantId).toBe("var-1");
    expect(line.quantity).toBe(2);
    expect(line.unitPrice).toBe(500);
    expect(line.lineTotal).toBe(1000);
    expect(line.article).toBe("Anillo Oro");
  });

  it("extrae officialNumber del Receipt INVOICE", () => {
    const detail = makeSaleDetail({
      status: "CONFIRMED",
      receipts: [
        { id: "r1", code: "A-0001-00000007", type: "INVOICE", direction: "OUTBOUND", status: "ISSUED", issueDate: "", issuedAt: "" },
      ],
    });
    const out = saleDetailToSalesInvoice(detail);
    expect(out.officialNumber).toBe("A-0001-00000007");
  });

  it("rehidrata shippingAmount → shipping.cost", () => {
    const detail = makeSaleDetail({ shippingAmount: "350" });
    const out = saleDetailToSalesInvoice(detail);
    expect(out.shipping?.cost).toBe(350);
  });

  it("rehidrata globalDiscountType + globalDiscountValue → discountGlobal", () => {
    const detail = makeSaleDetail({
      globalDiscountType:  "PERCENT",
      globalDiscountValue: "12.5",
    });
    const out = saleDetailToSalesInvoice(detail);
    expect(out.discountGlobal?.type).toBe("PERCENT");
    expect(out.discountGlobal?.value).toBe(12.5);
    expect(out.discountGlobal?.origin).toBe("MANUAL");
  });

  it("sin shipping/globalDiscount persistido → defaults vacíos", () => {
    const out = saleDetailToSalesInvoice(makeSaleDetail());
    expect(out.shipping?.cost).toBe(0);
    expect(out.discountGlobal?.value).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// P0.2 (H4) — Rehidratación de la intención "Sin lista" tras reabrir DRAFT.
// Sin estos tests, el bug del usuario reaparece silenciosamente: crear
// factura → elegir "Sin lista" → guardar borrador → reabrir → la favorita
// se aplica automáticamente y la decisión del operador se pierde.
// ──────────────────────────────────────────────────────────────────────────

describe("saleDetailToSalesInvoice — P0.2 (H4) preserva intención 'Sin lista'", () => {
  function makeLineWithoutPriceList(id = "L1") {
    return {
      id, articleId: "art-1", variantId: null,
      articleName: "X", variantName: "", sku: "", barcode: "",
      quantity: "1", unitPrice: "100", discountPct: "0", lineTotal: "100",
      priceSource: "MANUAL",
      appliedPriceListId: null,        // ← sin lista
      appliedPromotionId: null,
      appliedDiscountId:  null,
      unitCost: "0", totalCost: "0",
      unitMargin: "100", totalMargin: "100", marginPercent: "100",
      sortOrder: 0,
      article: { id: "art-1", code: "", name: "X", mainImageUrl: "" },
      variant: null,
    };
  }

  it("DRAFT con líneas pero sin lista derivable → priceListExplicitlyCleared=true (evita re-aplicar favorita)", () => {
    const detail = makeSaleDetail({
      status: "DRAFT",
      lines: [makeLineWithoutPriceList("L1")] as any,
    });
    const out = saleDetailToSalesInvoice(detail);
    expect(out.priceListId).toBeUndefined();
    expect(out.priceListExplicitlyCleared).toBe(true);
  });

  it("DRAFT con lista derivada → priceListExplicitlyCleared queda undefined (no se necesita el flag)", () => {
    const detail = makeSaleDetail({
      status: "DRAFT",
      lines: [{ ...makeLineWithoutPriceList("L1"), appliedPriceListId: "pl-1" }] as any,
    });
    const out = saleDetailToSalesInvoice(detail);
    expect(out.priceListId).toBe("pl-1");
    expect(out.priceListExplicitlyCleared).toBeUndefined();
  });

  it("DRAFT sin líneas → flag undefined (no marcamos; la favorita SÍ debe poder aparecer al agregar la primera línea)", () => {
    const detail = makeSaleDetail({ status: "DRAFT", lines: [] });
    const out = saleDetailToSalesInvoice(detail);
    expect(out.priceListId).toBeUndefined();
    expect(out.priceListExplicitlyCleared).toBeUndefined();
  });

  it("CONFIRMED sin lista derivable → flag undefined (estado inmutable, irrelevante)", () => {
    const detail = makeSaleDetail({
      status: "CONFIRMED",
      lines: [makeLineWithoutPriceList("L1")] as any,
    });
    const out = saleDetailToSalesInvoice(detail);
    expect(out.priceListExplicitlyCleared).toBeUndefined();
  });

  it("DRAFT con líneas heterogéneas (sin lista global) → flag=true (operador eligió Sin lista, líneas con override puntual)", () => {
    // deriveDocumentPriceListIdFromLines devuelve null cuando hay
    // overrides puntuales: el operador eligió "Sin lista" global pero
    // alguna línea tiene su propia lista. Sin el flag, la favorita se
    // aplicaría globalmente al reabrir.
    const detail = makeSaleDetail({
      status: "DRAFT",
      lines: [
        { ...makeLineWithoutPriceList("L1"), priceListIdOverride: "pl-x" },
      ] as any,
    });
    const out = saleDetailToSalesInvoice(detail);
    expect(out.priceListId).toBeUndefined();
    expect(out.priceListExplicitlyCleared).toBe(true);
  });
});

// Etapa 4 (cierre limitación Etapa 3) — overrides comerciales rehidratados
describe("saleDetailToSalesInvoice — rehidratación de overrides per-line", () => {
  function detailWithOverrides(lineOver: Record<string, any>): SaleDetail {
    return makeSaleDetail({
      lines: [{
        id:                 "L1",
        articleId:          "art-1",
        variantId:          null,
        articleName:        "Anillo",
        variantName:        "",
        sku:                "",
        barcode:            "",
        quantity:           "1",
        unitPrice:          "1000",
        discountPct:        "0",
        lineTotal:          "1000",
        priceSource:        "PRICE_LIST",
        appliedPriceListId: null,
        appliedPromotionId: null,
        appliedDiscountId:  null,
        unitCost:           null,
        totalCost:          null,
        unitMargin:         null,
        totalMargin:        null,
        marginPercent:      null,
        sortOrder:          0,
        article:            null,
        variant:            null,
        ...lineOver,
      } as any],
    });
  }

  it("manualPriceOverride persistido → pricingMeta.manualPrice + manualOverrides.price=true", () => {
    const detail = detailWithOverrides({ manualPriceOverride: "1500" });
    const out = saleDetailToSalesInvoice(detail);
    expect(out.lines[0]!.pricingMeta?.manualPrice).toBe(1500);
    expect(out.lines[0]!.manualOverrides?.price).toBe(true);
  });

  it("manualDiscountOverride persistido → pricingMeta.manualDiscount + manualOverrides.discount=true", () => {
    const detail = detailWithOverrides({
      manualDiscountOverride: { mode: "PERCENT", value: 10, appliesTo: "TOTAL", kind: "BONUS" },
    });
    const out = saleDetailToSalesInvoice(detail);
    expect(out.lines[0]!.pricingMeta?.manualDiscount).toEqual({
      mode: "PERCENT", value: 10, appliesTo: "TOTAL", kind: "BONUS",
    });
    expect(out.lines[0]!.manualOverrides?.discount).toBe(true);
  });

  it("taxOverride persistido → pricingMeta.taxOverride + manualOverrides.tax=true", () => {
    const detail = detailWithOverrides({
      taxOverride: { mode: "AMOUNT", value: 50, appliesTo: "METAL" },
    });
    const out = saleDetailToSalesInvoice(detail);
    expect(out.lines[0]!.pricingMeta?.taxOverride).toEqual({
      mode: "AMOUNT", value: 50, appliesTo: "METAL",
    });
    expect(out.lines[0]!.manualOverrides?.tax).toBe(true);
  });

  it("appliesTo overrides persisten en pricingMeta sin activar flags", () => {
    const detail = detailWithOverrides({
      manualDiscountAppliesToOverride: "HECHURA",
      manualTaxAppliesToOverride:      "METAL",
    });
    const out = saleDetailToSalesInvoice(detail);
    expect(out.lines[0]!.pricingMeta?.manualDiscountAppliesTo).toBe("HECHURA");
    expect(out.lines[0]!.pricingMeta?.manualTaxAppliesTo).toBe("METAL");
    // Sin override de valor → manualOverrides queda undefined (no flags).
    expect(out.lines[0]!.manualOverrides).toBeUndefined();
  });

  it("priceListIdOverride persistido → DocumentLine.priceListIdOverride", () => {
    const detail = detailWithOverrides({ priceListIdOverride: "pl-vip" });
    const out = saleDetailToSalesInvoice(detail);
    expect(out.lines[0]!.priceListIdOverride).toBe("pl-vip");
  });

  it("línea sin overrides → pricingMeta y manualOverrides undefined", () => {
    const detail = detailWithOverrides({});
    const out = saleDetailToSalesInvoice(detail);
    expect(out.lines[0]!.pricingMeta).toBeUndefined();
    expect(out.lines[0]!.manualOverrides).toBeUndefined();
    expect(out.lines[0]!.priceListIdOverride).toBeUndefined();
  });

  it("línea con TODOS los overrides → roundtrip completo (price + discount + tax + appliesTo + list)", () => {
    const detail = detailWithOverrides({
      manualPriceOverride:    "2500",
      manualDiscountOverride: { mode: "PERCENT", value: 10, appliesTo: "TOTAL", kind: "BONUS" },
      taxOverride:            { mode: "PERCENT", value: 21 },
      manualDiscountAppliesToOverride: "HECHURA",
      manualTaxAppliesToOverride:      "METAL",
      priceListIdOverride:    "pl-special",
    });
    const out = saleDetailToSalesInvoice(detail);
    const line = out.lines[0]!;
    expect(line.pricingMeta?.manualPrice).toBe(2500);
    expect(line.pricingMeta?.manualDiscount).toEqual({ mode: "PERCENT", value: 10, appliesTo: "TOTAL", kind: "BONUS" });
    expect(line.pricingMeta?.taxOverride).toEqual({ mode: "PERCENT", value: 21 });
    expect(line.pricingMeta?.manualDiscountAppliesTo).toBe("HECHURA");
    expect(line.pricingMeta?.manualTaxAppliesTo).toBe("METAL");
    expect(line.priceListIdOverride).toBe("pl-special");
    expect(line.manualOverrides?.price).toBe(true);
    expect(line.manualOverrides?.discount).toBe(true);
    expect(line.manualOverrides?.tax).toBe(true);
  });
});

describe("extractApiErrorMessage", () => {
  it("409 con code SALE_CANCEL_BLOCKED_BY_PAYMENTS → mensaje específico", () => {
    const msg = extractApiErrorMessage({
      status: 409,
      data: { code: "SALE_CANCEL_BLOCKED_BY_PAYMENTS", message: "blocked" },
    });
    expect(msg).toContain("cobros aplicados");
  });

  it("409 genérico → usa data.message", () => {
    const msg = extractApiErrorMessage({
      status: 409,
      data: { message: "La factura emitida no puede editarse." },
    });
    expect(msg).toBe("La factura emitida no puede editarse.");
  });

  it("error genérico sin data → usa message o fallback", () => {
    expect(extractApiErrorMessage({ message: "Network failed" })).toBe("Network failed");
    expect(extractApiErrorMessage({})).toContain("error");
    expect(extractApiErrorMessage(null, "Custom fallback")).toBe("Custom fallback");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Etapa C16.2 — Derivación + rehidratación de `priceListId` doc-level.
// Bug previo (audit C16.1): el mapper no setea `draft.priceListId`, y el
// effect de favorita en VentasFacturas sobrescribe la lista del documento
// con la favorita del tenant al reabrir cualquier factura.
// ──────────────────────────────────────────────────────────────────────────

function makeLineRow(over: Record<string, any>): any {
  return {
    id:                 over.id ?? "L1",
    articleId:          over.articleId ?? "art-1",
    variantId:          over.variantId ?? null,
    articleName:        over.articleName ?? "Anillo",
    variantName:        over.variantName ?? "",
    sku:                over.sku ?? "SKU",
    barcode:            "",
    quantity:           over.quantity ?? "1",
    unitPrice:          over.unitPrice ?? "100",
    discountPct:        "0",
    lineTotal:          over.lineTotal ?? "100",
    priceSource:        "PRICE_LIST",
    appliedPriceListId: over.appliedPriceListId ?? null,
    appliedPromotionId: null,
    appliedDiscountId:  null,
    unitCost:           null,
    totalCost:          null,
    unitMargin:         null,
    totalMargin:        null,
    marginPercent:      null,
    sortOrder:          0,
    article:            { id: "art-1", code: "", name: "Anillo", mainImageUrl: "" },
    variant:            null,
    priceListIdOverride: over.priceListIdOverride ?? null,
    ...over,
  };
}

describe("deriveDocumentPriceListIdFromLines — helper puro", () => {
  it("[] vacío → null", () => {
    expect(deriveDocumentPriceListIdFromLines([])).toBeNull();
  });

  it("null/undefined → null", () => {
    expect(deriveDocumentPriceListIdFromLines(null as any)).toBeNull();
    expect(deriveDocumentPriceListIdFromLines(undefined as any)).toBeNull();
  });

  it("1 línea sin override + appliedPriceListId='prueba2' → 'prueba2'", () => {
    expect(deriveDocumentPriceListIdFromLines([
      { appliedPriceListId: "prueba2", priceListIdOverride: null },
    ])).toBe("prueba2");
  });

  it("2 líneas sin override, mismo appliedPriceListId → ese id", () => {
    expect(deriveDocumentPriceListIdFromLines([
      { appliedPriceListId: "prueba2", priceListIdOverride: null },
      { appliedPriceListId: "prueba2", priceListIdOverride: null },
    ])).toBe("prueba2");
  });

  it("2 líneas sin override con listas distintas → null (no inventar global)", () => {
    expect(deriveDocumentPriceListIdFromLines([
      { appliedPriceListId: "prueba2",        priceListIdOverride: null },
      { appliedPriceListId: "Lista Unificada", priceListIdOverride: null },
    ])).toBeNull();
  });

  it("línea con priceListIdOverride se EXCLUYE del derivado", () => {
    // Esta línea tiene override puntual — su appliedPriceListId refleja
    // ESE override, no la lista global. La excluimos del cálculo.
    expect(deriveDocumentPriceListIdFromLines([
      { appliedPriceListId: "puntual",  priceListIdOverride: "puntual" },   // ignorada
      { appliedPriceListId: "prueba2",  priceListIdOverride: null },        // cuenta
    ])).toBe("prueba2");
  });

  it("todas las líneas con override puntual → null (no hay global rastreable)", () => {
    expect(deriveDocumentPriceListIdFromLines([
      { appliedPriceListId: "pl-a", priceListIdOverride: "pl-a" },
      { appliedPriceListId: "pl-b", priceListIdOverride: "pl-b" },
    ])).toBeNull();
  });

  it("appliedPriceListId vacío string o null → ignorado", () => {
    expect(deriveDocumentPriceListIdFromLines([
      { appliedPriceListId: "",      priceListIdOverride: null },
      { appliedPriceListId: null,    priceListIdOverride: null },
      { appliedPriceListId: "prueba2", priceListIdOverride: null },
    ])).toBe("prueba2");
  });
});

describe("saleDetailToSalesInvoice — C16.2: rehidrata draft.priceListId desde líneas", () => {
  it("Caso 1: 1 línea con appliedPriceListId='prueba2-id' → draft.priceListId='prueba2-id'", () => {
    const detail = makeSaleDetail({
      lines: [
        makeLineRow({ appliedPriceListId: "cmpq9grtf0001q4caehpgfv1v" }),
      ],
    });
    const out = saleDetailToSalesInvoice(detail);
    expect(out.priceListId).toBe("cmpq9grtf0001q4caehpgfv1v");
  });

  it("Caso 2: 2 líneas con misma lista 'prueba2' → draft.priceListId='prueba2'", () => {
    const detail = makeSaleDetail({
      lines: [
        makeLineRow({ id: "L1", appliedPriceListId: "prueba2" }),
        makeLineRow({ id: "L2", appliedPriceListId: "prueba2" }),
      ],
    });
    const out = saleDetailToSalesInvoice(detail);
    expect(out.priceListId).toBe("prueba2");
  });

  it("Caso 3: líneas con listas distintas → draft.priceListId=undefined (no inventar)", () => {
    const detail = makeSaleDetail({
      lines: [
        makeLineRow({ id: "L1", appliedPriceListId: "prueba2" }),
        makeLineRow({ id: "L2", appliedPriceListId: "Lista Desglosada" }),
      ],
    });
    const out = saleDetailToSalesInvoice(detail);
    expect(out.priceListId).toBeUndefined();
  });

  it("Caso 4: sin líneas → draft.priceListId=undefined", () => {
    const detail = makeSaleDetail({ lines: [] });
    const out = saleDetailToSalesInvoice(detail);
    expect(out.priceListId).toBeUndefined();
  });

  it("Caso 5 (anti-favorita): la presencia de draft.priceListId apaga el effect de favorita", () => {
    // El effect en VentasFacturas.tsx:3231 dice:
    //   if (!draft.priceListId && draft.priceListExplicitlyCleared !== true) {
    //     patch.priceListId = favorite.id;
    //   }
    // Con draft.priceListId='prueba2', la condición `!draft.priceListId` es
    // FALSE → no se aplica favorita. Acá fijamos la INVARIANTE del mapper:
    // si la factura trae una lista derivada de líneas, esa lista se
    // preserva en `draft.priceListId` para apagar el effect.
    const detail = makeSaleDetail({
      lines: [makeLineRow({ appliedPriceListId: "prueba2" })],
    });
    const out = saleDetailToSalesInvoice(detail);
    expect(out.priceListId).toBe("prueba2");
    // Simulación del guard del effect:
    const favoritaPiseEsto = !out.priceListId;   // false
    expect(favoritaPiseEsto).toBe(false);
  });

  it("Caso real VTA-0019: 1 línea con appliedPriceListId=prueba2 sin override → mantiene prueba2", () => {
    const detail = makeSaleDetail({
      id:   "cmpqbc31l000ga8ca1rkeyrpu",
      code: "VTA-0019",
      lines: [makeLineRow({
        id:                  "line-vta-0019",
        appliedPriceListId:  "cmpq9grtf0001q4caehpgfv1v",   // id real de prueba2
        priceListIdOverride: null,                          // sin override
      })],
    });
    const out = saleDetailToSalesInvoice(detail);
    expect(out.priceListId).toBe("cmpq9grtf0001q4caehpgfv1v");
  });

  it("Caso mixto: 1 línea override + 1 línea global → toma SOLO la global", () => {
    const detail = makeSaleDetail({
      lines: [
        makeLineRow({ id: "L1", appliedPriceListId: "puntual",  priceListIdOverride: "puntual" }),
        makeLineRow({ id: "L2", appliedPriceListId: "prueba2",  priceListIdOverride: null }),
      ],
    });
    const out = saleDetailToSalesInvoice(detail);
    expect(out.priceListId).toBe("prueba2");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Etapa C16.3 — Rehidratación de canal, cupón y forma de pago al reabrir
// un DRAFT. Sin estos, el preview re-disparado pierde contexto y los
// totales cambian respecto al pre-save.
// ──────────────────────────────────────────────────────────────────────────

describe("saleDetailToSalesInvoice — C16.3: rehidrata channel/coupon/payment", () => {
  it("rehidrata channelId persistido en Sale.channelId", () => {
    const detail = makeSaleDetail({ channelId: "ch-mostrador" } as any);
    const out = saleDetailToSalesInvoice(detail);
    expect(out.channelId).toBe("ch-mostrador");
  });

  it("channelId ausente/null → draft.channelId undefined (sin canal)", () => {
    const out1 = saleDetailToSalesInvoice(makeSaleDetail({ channelId: null } as any));
    const out2 = saleDetailToSalesInvoice(makeSaleDetail({} as any));
    expect(out1.channelId).toBeUndefined();
    expect(out2.channelId).toBeUndefined();
  });

  it("rehidrata couponCode desde coupon.code (no desde couponId raw)", () => {
    // El backend devuelve `coupon: { id, code }` para que el frontend pueda
    // reconstruir el `couponCode` que el operador escribió.
    const detail = makeSaleDetail({
      couponId: "cpn-id-1",
      coupon:   { id: "cpn-id-1", code: "BLACKFRIDAY" },
    } as any);
    const out = saleDetailToSalesInvoice(detail);
    expect(out.couponCode).toBe("BLACKFRIDAY");
  });

  it("couponCode ausente → draft.couponCode undefined", () => {
    const out = saleDetailToSalesInvoice(makeSaleDetail({} as any));
    expect(out.couponCode).toBeUndefined();
  });

  it("coupon objeto null pero couponId presente → couponCode undefined (degradación segura)", () => {
    const detail = makeSaleDetail({ couponId: "cpn-id-1", coupon: null } as any);
    const out = saleDetailToSalesInvoice(detail);
    expect(out.couponCode).toBeUndefined();
  });

  it("rehidrata paymentMethodId + paymentInstallments persistidos", () => {
    const detail = makeSaleDetail({
      paymentMethodId:     "pm-credit",
      paymentInstallments: 6,
    } as any);
    const out = saleDetailToSalesInvoice(detail);
    expect(out.paymentMethodId).toBe("pm-credit");
    expect(out.paymentInstallments).toBe(6);
  });

  it("payment fields null/ausente → undefined (consistente con channelId/couponCode)", () => {
    const out1 = saleDetailToSalesInvoice(makeSaleDetail({
      paymentMethodId:     null,
      paymentInstallments: null,
    } as any));
    const out2 = saleDetailToSalesInvoice(makeSaleDetail({} as any));
    expect(out1.paymentMethodId).toBeUndefined();
    expect(out1.paymentInstallments).toBeUndefined();
    expect(out2.paymentMethodId).toBeUndefined();
    expect(out2.paymentInstallments).toBeUndefined();
  });

  it("caso real del bug (audit C13/C14): canal + cupón + payment + lista juntos", () => {
    // El operador creó una FV con:
    //   canal = "mostrador", cupón = "BLACKFRIDAY", payment = "credit-6cuotas",
    //   lista = "prueba2" (PHYSICAL).
    // Al cerrar y reabrir, los 4 campos deben aparecer rehidratados.
    const detail = makeSaleDetail({
      channelId:           "ch-mostrador",
      couponId:            "cpn-1",
      coupon:              { id: "cpn-1", code: "BLACKFRIDAY" },
      paymentMethodId:     "pm-credit",
      paymentInstallments: 6,
      lines: [makeLineRow({
        appliedPriceListId:  "cmpq9grtf0001q4caehpgfv1v",   // prueba2
        priceListIdOverride: null,
      })],
    } as any);
    const out = saleDetailToSalesInvoice(detail);
    expect(out.channelId).toBe("ch-mostrador");
    expect(out.couponCode).toBe("BLACKFRIDAY");
    expect(out.paymentMethodId).toBe("pm-credit");
    expect(out.paymentInstallments).toBe(6);
    expect(out.priceListId).toBe("cmpq9grtf0001q4caehpgfv1v");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// C16.3 — Paridad: el draft rehidratado, pasado por `buildSalePreviewPayload`,
// produce el MISMO payload que tenía pre-save para los campos relevantes.
// ──────────────────────────────────────────────────────────────────────────

describe("saleDetailToSalesInvoice — C16.3: paridad payload pre-save ↔ post-reopen", () => {
  it("payload del preview reabierto incluye channelId, couponCode y priceListId del SaleDetail", async () => {
    const { buildSalePreviewPayload } = await import("../buildSalePreviewPayload");
    const detail = makeSaleDetail({
      channelId: "ch-mostrador",
      couponId:  "cpn-1",
      coupon:    { id: "cpn-1", code: "BLACKFRIDAY" },
      lines: [makeLineRow({
        appliedPriceListId:  "prueba2-id",
        priceListIdOverride: null,
      })],
    } as any);
    const draft = saleDetailToSalesInvoice(detail);
    const out = buildSalePreviewPayload(draft) as any;
    expect(out.payload.channelId).toBe("ch-mostrador");
    expect(out.payload.couponCode).toBe("BLACKFRIDAY");
    expect(out.payload.priceListId).toBe("prueba2-id");
  });
});
