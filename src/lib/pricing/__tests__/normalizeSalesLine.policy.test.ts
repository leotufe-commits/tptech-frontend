// src/lib/pricing/__tests__/normalizeSalesLine.policy.test.ts
// ============================================================================
// Test de regresión — `normalizeSalesLine` debe preservar `policy` y
// `alerts` POR LÍNEA del preview de ventas.
//
// HISTORIA DEL BUG:
//   El motor (`pricing-engine.sale.ts` → `finalize()`) calculaba alerts
//   y policy.blockingAlerts correctamente con la config del tenant
//   (`pricingLowMarginBlockPercent`, `pricingBlockLossSale`, etc.). El
//   backend los emitía en cada `SalePreviewLine.policy` y `.alerts`.
//
//   Pero `normalizeSalesLine` no los mapeaba al output `NormalizedPricingLine`.
//   Resultado: en Factura, `deriveCommercialLevel(line)` recibía
//   `policy = undefined` y `alerts = undefined`, caía siempre a "OK".
//   Una línea con margen -82% jamás escalaba a CRITICAL.
//
//   Fix: agregar `policy: normalizePolicy(l.policy)` y
//   `alerts: normalizeAlerts(l.alerts)` al return de `normalizeSalesLine`.
//
// Este test asegura que NO se vuelva a perder ese mapeo. Es el equivalente
// del que ya existe implícitamente para `normalizeArticlePricingPreview`
// (Simulador) que sí los mapeaba desde siempre.
// ============================================================================

import { describe, it, expect } from "vitest";
import { normalizeSalesLine } from "../normalizePricingPreviewResult";
import type { SalePreviewLine } from "../../../services/sales";

function makeSalesLine(overrides: Partial<SalePreviewLine> = {}): SalePreviewLine {
  // Shape mínimo viable de `SalePreviewLine` — solo lo que necesita el
  // normalizer para no caerse. Los `as any` evitan tener que importar
  // todos los sub-tipos (taxBreakdown, metalHechuraBreakdown, snapshot).
  return {
    articleId: "ART-1",
    variantId: null,
    quantity:  1,

    basePrice:        100,
    unitPrice:        100,
    unitTaxAmount:    21,
    unitTotalWithTax: 121,

    quantityDiscountAmount:  0,
    promotionDiscountAmount: 0,

    lineTotal:        100,
    lineTaxAmount:    21,
    lineTotalWithTax: 121,
    lineDiscount:     0,

    priceSource:          "LIST",
    appliedPriceListId:   null,
    appliedPriceListName: null,
    appliedPromotionId:   null,
    appliedPromotionName: null,
    appliedDiscountId:    null,

    unitCost:      50,
    unitMargin:    50,
    marginPercent: 50,
    markupPercent: 100,
    costPartial:   false,
    costMode:      "RESOLVED",

    policy: { canConfirm: true, blockingAlerts: [] },
    taxBreakdown:         [],
    metalHechuraBreakdown: null,
    pricingSnapshot:      {} as any,

    ...overrides,
  } as unknown as SalePreviewLine;
}

describe("normalizeSalesLine — preservación de policy/alerts (regresión)", () => {
  it("línea OK → policy preservada, alerts vacíos", () => {
    const out = normalizeSalesLine(makeSalesLine());
    expect(out.policy).toEqual({ canConfirm: true, blockingAlerts: [] });
    expect(out.alerts).toEqual([]);
  });

  it("línea con LOW_MARGIN bloqueante → blockingAlerts preservados", () => {
    // Caso real del bug: margen -82%, config con
    // pricingLowMarginBlockPercent=15 → el backend agrega "LOW_MARGIN"
    // a blockingAlerts. El normalizer DEBE preservarlo para que
    // deriveCommercialLevel detecte CRITICAL.
    const out = normalizeSalesLine(makeSalesLine({
      marginPercent: -82,
      policy: { canConfirm: false, blockingAlerts: ["LOW_MARGIN"] },
      alerts: [
        { code: "LOW_MARGIN", level: "error", message: "Margen -82% < bloqueo 15%" },
      ],
    }));
    expect(out.policy?.canConfirm).toBe(false);
    expect(out.policy?.blockingAlerts).toEqual(["LOW_MARGIN"]);
    expect(out.alerts).toHaveLength(1);
    expect(out.alerts?.[0].code).toBe("LOW_MARGIN");
  });

  it("línea con LOSS_SALE no bloqueante → alerts preservados, blockingAlerts vacío", () => {
    const out = normalizeSalesLine(makeSalesLine({
      unitPrice: 50,
      unitCost:  100,
      marginPercent: -50,
      policy: { canConfirm: true, blockingAlerts: [] },
      alerts: [
        { code: "LOSS_SALE",  level: "warning", message: "Precio menor al costo" },
        { code: "LOW_MARGIN", level: "warning", message: "Margen muy bajo" },
      ],
    }));
    expect(out.policy?.blockingAlerts).toEqual([]);
    expect(out.alerts).toHaveLength(2);
    expect(out.alerts?.map((a) => a.code)).toEqual(["LOSS_SALE", "LOW_MARGIN"]);
  });

  it("línea sin alerts en payload → alerts queda en array vacío (no undefined)", () => {
    const out = normalizeSalesLine(makeSalesLine({ alerts: undefined }));
    expect(out.alerts).toEqual([]);
  });
});
