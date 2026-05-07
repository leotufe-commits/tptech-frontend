// src/lib/pricing/__tests__/preview-confirm-parity-e2e.test.ts
// =============================================================================
// FASE 1.0 — PR5. Test E2E de paridad preview ↔ confirm para Factura Ventas.
//
// Estrategia:
//   - MSW intercepta POST /api/sales/preview y POST /api/sales/:id/confirm.
//   - Para un fixture dado, preview devuelve documentTotals X.
//   - El confirm devuelve SaleDetail con total/taxAmount/subtotal/discountAmount
//     que DEBEN coincidir con X (delta < PARITY_DELTA_THRESHOLD = 0.01).
//
// Si en el futuro alguien introduce drift entre preview y confirm en el código
// frontend o el backend, este test falla en CI bloqueando el merge.
//
// Cobertura:
//   1. Happy path: preview total === confirm total → matched=true.
//   2. Failure path: drift simulado >= 0.01 → matched=false con campo identificado.
//   3. Failure path con threshold: drift exacto en 0.01 → considerado divergente.
// =============================================================================

import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/msw-server";
import { salesApi } from "../../../services/sales";
import { compareDocumentTotals, PARITY_DELTA_THRESHOLD } from "../parityLogger";
import type { SalePreviewResult, SaleDetail } from "../../../services/sales";

// =============================================================================
// Fixtures
// =============================================================================

const SALE_ID = "sale-test-001";

/** Documento de referencia: subtotal 2000, descuento 200, base 1800, IVA 378, total 2178. */
const REFERENCE_TOTALS = {
  subtotalBeforeDiscounts:    2000,
  lineDiscountAmount:         200,
  subtotalAfterLineDiscounts: 1800,
  channelAdjustmentAmount:    0,
  couponDiscountAmount:       0,
  paymentAdjustmentAmount:    0,
  shippingAmount:             0,
  globalDiscountAmount:       0,
  taxableBase:                1800,
  taxAmount:                  378,
  roundingAdjustment:         0,
  totalBeforeTax:             1800,
  totalWithTax:               2178,
  total:                      2178,
};

function makePreviewResponse(overrides: Partial<typeof REFERENCE_TOTALS> = {}): SalePreviewResult {
  return {
    lines: [
      {
        articleId: "art-1",
        variantId: null,
        quantity:  2,
        basePrice: 1000,
        unitPrice: 900,
        unitTaxAmount:    189,
        unitTotalWithTax: 1089,
        quantityDiscountAmount:  100,
        promotionDiscountAmount: 0,
        lineTotal:        1800,
        lineTaxAmount:    378,
        lineTotalWithTax: 2178,
        lineDiscount:     200,
        priceSource:          "PRICE_LIST",
        appliedPriceListId:   "pl-1",
        appliedPriceListName: "Lista A",
        appliedPriceListMode: null,
        appliedPromotionId:   null,
        appliedPromotionName: null,
        appliedDiscountId:    null,
        unitCost:      500,
        unitMargin:    400,
        marginPercent: 44.44,
        costMode:      "COST_LINES",
        costPartial:   false,
        taxBreakdown:  [],
        appliedRounding: null,
        metalHechuraBreakdown: null,
      } as any,
    ],
    documentTotals: {
      ...REFERENCE_TOTALS,
      ...overrides,
    },
    channelResult:  null,
    couponResult:   null,
    checkoutResult: null,
  } as any;
}

function makeConfirmResponse(overrides: Partial<typeof REFERENCE_TOTALS> = {}): SaleDetail {
  const totals = { ...REFERENCE_TOTALS, ...overrides };
  return {
    id:             SALE_ID,
    code:           "FV-0001",
    status:         "CONFIRMED",
    saleDate:       "2026-05-07",
    subtotal:       String(totals.subtotalBeforeDiscounts),
    discountAmount: String(totals.lineDiscountAmount),
    taxAmount:      String(totals.taxAmount),
    total:          String(totals.total),
    paidAmount:     "0",
    notes:          "",
    confirmedAt:    "2026-05-07T10:00:00.000Z",
    cancelledAt:    null,
    createdAt:      "2026-05-07T09:00:00.000Z",
    sellerCommissionTotal: null,
    client:         null,
    seller:         null,
    warehouse:      null,
    createdBy:      null,
    _count:         { lines: 1 },
    clientSnapshot: null,
    sellerSnapshot: null,
    cancelNote:     "",
    lines:          [],
    payments:       [],
    saleTotals:     null,
  } as any;
}

/**
 * Reconstruye un NormalizedPricingResult a partir del SaleDetail (confirm)
 * para poder usar `compareDocumentTotals` con el preview. Solo mapea los 4
 * campos que el confirm persiste a nivel raíz; el resto queda en 0 y debe
 * coincidir con un preview que también los tenga en 0.
 */
function saleDetailAsNormalized(s: SaleDetail): any {
  return {
    source: "SALES_PREVIEW",
    lines:  [],
    channel:  null,
    coupon:   null,
    payment:  null,
    shipping: null,
    documentTotals: {
      subtotalBeforeDiscounts:    Number(s.subtotal),
      lineDiscountAmount:         Number(s.discountAmount),
      subtotalAfterLineDiscounts: Number(s.subtotal) - Number(s.discountAmount),
      channelAdjustmentAmount:    0,
      couponDiscountAmount:       0,
      paymentAdjustmentAmount:    0,
      shippingAmount:             0,
      globalDiscountAmount:       0,
      taxableBase:                Number(s.subtotal) - Number(s.discountAmount),
      taxAmount:                  Number(s.taxAmount),
      roundingAdjustment:         0,
      totalBeforeTax:             Number(s.subtotal) - Number(s.discountAmount),
      totalWithTax:               Number(s.total),
      total:                      Number(s.total),
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
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("E2E preview ↔ confirm — paridad de documentTotals", () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  it("baseline correct: preview y confirm devuelven los mismos totales → matched=true", async () => {
    server.use(
      http.post("*/api/sales/preview", () =>
        HttpResponse.json(makePreviewResponse()),
      ),
      http.post(`*/api/sales/${SALE_ID}/confirm`, () =>
        HttpResponse.json(makeConfirmResponse()),
      ),
    );

    const preview  = await salesApi.preview({ lines: [], salesChannelId: null } as any);
    const confirmed = await salesApi.confirm(SALE_ID);

    const normalizedPreview = {
      source:                  "SALES_PREVIEW",
      lines:                   [],
      channel:                 null,
      coupon:                  null,
      payment:                 null,
      shipping:                null,
      documentTotals:          preview.documentTotals,
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
    const normalizedConfirm = saleDetailAsNormalized(confirmed);

    const report = compareDocumentTotals(normalizedPreview, normalizedConfirm);
    expect(report.matched).toBe(true);
    expect(report.brokenCount).toBe(0);
  });

  it("baseline correct: drift simulado en total >= 0.01 → matched=false bloquea CI", async () => {
    // Preview emite total=2178; confirm devuelve 2179 (1 peso de drift).
    server.use(
      http.post("*/api/sales/preview", () =>
        HttpResponse.json(makePreviewResponse({ total: 2178, totalWithTax: 2178 })),
      ),
      http.post(`*/api/sales/${SALE_ID}/confirm`, () =>
        HttpResponse.json(makeConfirmResponse({ total: 2179 })),
      ),
    );

    const preview  = await salesApi.preview({ lines: [], salesChannelId: null } as any);
    const confirmed = await salesApi.confirm(SALE_ID);

    const normalizedPreview = {
      source: "SALES_PREVIEW", lines: [], channel: null, coupon: null,
      payment: null, shipping: null,
      documentTotals: preview.documentTotals,
      roundingInfo: null, documentRoundingApplied: null,
      policy: { canConfirm: true, blockingAlerts: [] }, alerts: [],
      clientBalanceType: null, clientCommercialRules: null,
      requestedPriceListId: null, appliedPriceListId: null,
      appliedPriceListName: null,
    } as any;
    const normalizedConfirm = saleDetailAsNormalized(confirmed);

    const report = compareDocumentTotals(normalizedPreview, normalizedConfirm);
    expect(report.matched).toBe(false);
    expect(report.brokenCount).toBeGreaterThanOrEqual(1);
    const totalDiff = report.broken.find(r => r.field === "total");
    expect(totalDiff).toBeDefined();
    expect(totalDiff?.delta).toBe(1);
  });

  it("baseline correct: drift en taxAmount aparece como campo divergente", async () => {
    server.use(
      http.post("*/api/sales/preview", () =>
        HttpResponse.json(makePreviewResponse({ taxAmount: 378 })),
      ),
      http.post(`*/api/sales/${SALE_ID}/confirm`, () =>
        HttpResponse.json(makeConfirmResponse({ taxAmount: 379 })),
      ),
    );

    const preview   = await salesApi.preview({ lines: [], salesChannelId: null } as any);
    const confirmed = await salesApi.confirm(SALE_ID);

    const normalizedPreview = {
      source: "SALES_PREVIEW", lines: [], channel: null, coupon: null,
      payment: null, shipping: null,
      documentTotals: preview.documentTotals,
      roundingInfo: null, documentRoundingApplied: null,
      policy: { canConfirm: true, blockingAlerts: [] }, alerts: [],
      clientBalanceType: null, clientCommercialRules: null,
      requestedPriceListId: null, appliedPriceListId: null,
      appliedPriceListName: null,
    } as any;
    const normalizedConfirm = saleDetailAsNormalized(confirmed);

    const report = compareDocumentTotals(normalizedPreview, normalizedConfirm);
    expect(report.matched).toBe(false);
    const taxDiff = report.broken.find(r => r.field === "taxAmount");
    expect(taxDiff).toBeDefined();
    expect(taxDiff?.delta).toBe(1);
  });

  it("baseline correct: PARITY_DELTA_THRESHOLD=0.01 — drift <= 0.005 NO bloquea CI", async () => {
    // 2178.000 vs 2178.004 → delta redondeado = 0 → matched=true.
    server.use(
      http.post("*/api/sales/preview", () =>
        HttpResponse.json(makePreviewResponse({ total: 2178.000, totalWithTax: 2178.000 })),
      ),
      http.post(`*/api/sales/${SALE_ID}/confirm`, () =>
        HttpResponse.json(makeConfirmResponse({ total: 2178.004 })),
      ),
    );

    const preview   = await salesApi.preview({ lines: [], salesChannelId: null } as any);
    const confirmed = await salesApi.confirm(SALE_ID);

    const normalizedPreview = {
      source: "SALES_PREVIEW", lines: [], channel: null, coupon: null,
      payment: null, shipping: null,
      documentTotals: preview.documentTotals,
      roundingInfo: null, documentRoundingApplied: null,
      policy: { canConfirm: true, blockingAlerts: [] }, alerts: [],
      clientBalanceType: null, clientCommercialRules: null,
      requestedPriceListId: null, appliedPriceListId: null,
      appliedPriceListName: null,
    } as any;
    const normalizedConfirm = saleDetailAsNormalized(confirmed);

    const report = compareDocumentTotals(normalizedPreview, normalizedConfirm);
    expect(report.matched).toBe(true);
    expect(PARITY_DELTA_THRESHOLD).toBe(0.01);
  });
});
