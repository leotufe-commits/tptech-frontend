// src/lib/sales/__tests__/applySalePreviewToDraft.inherited.test.ts
// Fase: bonificación/exención heredadas del cliente — mapeo passthrough
// (display-only, origin=CLIENT) y anti doble aplicación.
import { describe, it, expect } from "vitest";
import { applySalePreviewToDraft } from "../applySalePreviewToDraft";
import { buildSalePreviewPayload } from "../buildSalePreviewPayload";
import type { SalesInvoice } from "../types";
import type { SalePreviewResult } from "../../../services/sales";

const line = {
  id: "l1", articleId: "a1", article: "ART", quantity: 1, unitPrice: 100,
  discountAmount: 0, taxAmount: 0, subtotal: 100, lineTotal: 100,
} as any;

function draft(o: Partial<SalesInvoice> = {}): SalesInvoice {
  return {
    id: "f", number: "FV-1", date: "2026-05-19", dueDate: "", client: "",
    salesOrderNumber: "", deliveryNumber: "", currency: "ARS", fxRate: 1,
    taxPercent: 0, seller: "", warehouse: "", paymentTerm: "", referenceNumber: "",
    notes: "", terms: "", subtotal: 0, discountAmount: 0, taxAmount: 0, total: 0,
    paidAmount: 0, lines: [line], status: "DRAFT", clientId: "c1", ...o,
  } as SalesInvoice;
}

function preview(extra: Record<string, unknown>): SalePreviewResult {
  return {
    lines: [{
      unitPrice: 100, lineDiscount: 13, lineTaxAmount: 0, lineSubtotal: 100,
      lineTotal: 87, lineTotalWithTax: 87, unitTotalWithTax: 87, priceSource: "PRICE_LIST",
      taxBreakdown: [], pricingSnapshot: {},
    } as any],
    subtotal: 87,
    channelResult: null,
    couponResult: null,
    checkoutResult: null as any,
    total: 87,
    documentTotals: {
      subtotalAfterLineDiscounts: 87, lineDiscountAmount: 13,
      couponDiscountAmount: 0, globalDiscountAmount: 0, taxAmount: 0, total: 87,
    } as any,
    ...extra,
  } as SalePreviewResult;
}

describe("applySalePreviewToDraft — bonificación heredada (origin CLIENT)", () => {
  it("mapea clientCommercialRules → pricingMeta.inheritedDiscount (passthrough) sin tocar manualDiscount/manualOverrides", () => {
    const res = applySalePreviewToDraft(
      draft(),
      preview({
        clientCommercialRules: { ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 13, applyOn: "TOTAL" },
      }),
    );
    const m = res.lines[0].pricingMeta!;
    expect(m.inheritedDiscount).toEqual({
      ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 13, applyOn: "TOTAL", origin: "CLIENT",
    });
    expect(m.inheritedDiscountAppliesTo).toBe("TOTAL");
    // Anti doble aplicación: NO se materializa como override manual.
    expect(m.manualDiscount ?? null).toBeNull();
    expect(res.lines[0].manualOverrides).toBeUndefined();
  });

  it("el descuento heredado NO se reenvía en buildSalePreviewPayload (no hay manualOverrides.discount)", () => {
    const res = applySalePreviewToDraft(
      draft(),
      preview({
        clientCommercialRules: { ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 13, applyOn: "TOTAL" },
      }),
    );
    const { payload } = buildSalePreviewPayload(res);
    expect((payload.lines[0] as any).manualDiscountOverride).toBeNull();
    expect((payload.lines[0] as any).manualDiscountAppliesToOverride ?? null).toBeNull();
    expect(payload.globalDiscount).toBeNull();
  });

  it("applyOn ausente (null) se normaliza a TOTAL (igual que el motor)", () => {
    const res = applySalePreviewToDraft(
      draft(),
      preview({
        clientCommercialRules: { ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 13, applyOn: null },
      }),
    );
    expect(res.lines[0].pricingMeta!.inheritedDiscount).toEqual({
      ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 13, applyOn: "TOTAL", origin: "CLIENT",
    });
  });

  it("sin clientCommercialRules → inheritedDiscount null", () => {
    const res = applySalePreviewToDraft(draft(), preview({}));
    expect(res.lines[0].pricingMeta!.inheritedDiscount ?? null).toBeNull();
  });

  it("SURCHARGE/METAL → se mapea el passthrough pero NO es representable (el editor decide chip-only)", () => {
    const res = applySalePreviewToDraft(
      draft(),
      preview({
        clientCommercialRules: { ruleType: "SURCHARGE", valueType: "PERCENTAGE", value: 5, applyOn: "METAL" },
      }),
    );
    const inh = res.lines[0].pricingMeta!.inheritedDiscount!;
    expect(inh).toEqual({ ruleType: "SURCHARGE", valueType: "PERCENTAGE", value: 5, applyOn: "METAL", origin: "CLIENT" });
  });
});

describe("applySalePreviewToDraft — exención fiscal del cliente", () => {
  it("clientTaxExempt=true → pricingMeta.taxExemptByEntity=true", () => {
    const res = applySalePreviewToDraft(draft(), preview({ clientTaxExempt: true }));
    expect(res.lines[0].pricingMeta!.taxExemptByEntity).toBe(true);
  });

  it("clientTaxExempt ausente/false → taxExemptByEntity falsy", () => {
    const res = applySalePreviewToDraft(draft(), preview({}));
    expect(res.lines[0].pricingMeta!.taxExemptByEntity === true).toBe(false);
  });
});
