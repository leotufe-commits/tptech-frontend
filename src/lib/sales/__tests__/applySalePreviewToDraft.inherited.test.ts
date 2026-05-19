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
      ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 13, applyOn: "TOTAL",
      origin: "CLIENT", fixedAmountInBaseOnly: false,
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
      ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 13, applyOn: "TOTAL",
      origin: "CLIENT", fixedAmountInBaseOnly: false,
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
    expect(inh).toEqual({
      ruleType: "SURCHARGE", valueType: "PERCENTAGE", value: 5, applyOn: "METAL",
      origin: "CLIENT", fixedAmountInBaseOnly: false,
    });
  });

  it("FIXED_AMOUNT + documento CONVERTIDO → fixedAmountInBaseOnly=true (chip-only en editor)", () => {
    const res = applySalePreviewToDraft(
      draft(),
      preview({
        clientCommercialRules: { ruleType: "DISCOUNT", valueType: "FIXED_AMOUNT", value: 20, applyOn: "TOTAL" },
        currencyConverted: true,
      }),
    );
    expect(res.lines[0].pricingMeta!.inheritedDiscount).toMatchObject({
      valueType: "FIXED_AMOUNT", value: 20, fixedAmountInBaseOnly: true,
    });
  });

  it("FIXED_AMOUNT + documento EN BASE (sin conversión) → fixedAmountInBaseOnly=false (muestra monto)", () => {
    const res = applySalePreviewToDraft(
      draft(),
      preview({
        clientCommercialRules: { ruleType: "DISCOUNT", valueType: "FIXED_AMOUNT", value: 20, applyOn: "TOTAL" },
        currencyConverted: false,
        currencyRate: 1,
      }),
    );
    expect(res.lines[0].pricingMeta!.inheritedDiscount).toMatchObject({
      valueType: "FIXED_AMOUNT", value: 20, fixedAmountInBaseOnly: false,
    });
  });

  it("FIXED_AMOUNT + currencyRate != 1 (convertido sin flag explícito) → fixedAmountInBaseOnly=true", () => {
    const res = applySalePreviewToDraft(
      draft(),
      preview({
        clientCommercialRules: { ruleType: "DISCOUNT", valueType: "FIXED_AMOUNT", value: 20, applyOn: "TOTAL" },
        currencyRate: 0.00058,
      }),
    );
    expect(res.lines[0].pricingMeta!.inheritedDiscount).toMatchObject({
      fixedAmountInBaseOnly: true,
    });
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

  // Cambio cliente exento → NO exento: el preview del cliente nuevo es
  // AUTORITATIVO. Antes el OR `|| line.pricingMeta?.taxExemptByEntity`
  // dejaba la exención pegada y el impuesto bloqueado en 0.
  it("cliente exento → NO exento: NO arrastra la exención previa del draft", () => {
    const exemptLine = {
      ...line,
      pricingMeta: { taxExemptByEntity: true }, // estado del cliente ANTERIOR
    } as any;
    const res = applySalePreviewToDraft(
      draft({ lines: [exemptLine] }),
      preview({ clientTaxExempt: false }), // cliente NUEVO no exento
    );
    expect(res.lines[0].pricingMeta!.taxExemptByEntity).toBe(false);
  });

  it("cliente NO exento → exento: el preview nuevo activa la exención", () => {
    const res = applySalePreviewToDraft(
      draft(),
      preview({ clientTaxExempt: true }),
    );
    expect(res.lines[0].pricingMeta!.taxExemptByEntity).toBe(true);
  });

  it("flag PER-LÍNEA del motor manda aunque el doc-level diga false", () => {
    const res = applySalePreviewToDraft(
      draft(),
      preview({
        clientTaxExempt: false,
        lines: [{
          unitPrice: 100, lineDiscount: 0, lineTaxAmount: 0, lineSubtotal: 100,
          lineTotal: 100, lineTotalWithTax: 100, unitTotalWithTax: 100,
          priceSource: "PRICE_LIST", taxBreakdown: [], pricingSnapshot: {},
          taxExemptByEntity: true,
        } as any],
      }),
    );
    expect(res.lines[0].pricingMeta!.taxExemptByEntity).toBe(true);
  });
});

describe("applySalePreviewToDraft — bonificación fija: monto del motor sin recálculo", () => {
  // Bug del print: bonif. fija AMOUNT 50,01 mostraba "-US$ 0.03". El draft
  // hidratado debe llevar EXACTAMENTE `pl.lineDiscount` (lo aplicado por el
  // motor), sin dividir por displayRate/fxRate/cantidad. La división visual
  // (doble conversión) era el bug — acá fijamos la fuente de verdad.
  it("discountAmount === pl.lineDiscount EXACTO (AMOUNT fijo, sin dividir)", () => {
    const res = applySalePreviewToDraft(
      draft(),
      preview({
        lines: [{
          unitPrice: 250.04, lineDiscount: 50.01, lineTaxAmount: 0,
          lineSubtotal: 250.04, lineTotal: 200.03, lineTotalWithTax: 200.03,
          unitTotalWithTax: 200.03, priceSource: "PRICE_LIST",
          taxBreakdown: [], pricingSnapshot: {},
        } as any],
        clientCommercialRules: {
          ruleType: "DISCOUNT", valueType: "FIXED_AMOUNT", value: 50.01, applyOn: "TOTAL",
        },
        documentTotals: {
          subtotalAfterLineDiscounts: 200.03, lineDiscountAmount: 50.01,
          couponDiscountAmount: 0, globalDiscountAmount: 0, taxAmount: 0, total: 200.03,
        },
      }),
    );
    // El label verde lee `l.discountAmount`: debe ser 50.01, NO 0.03.
    expect(res.lines[0].discountAmount).toBe(50.01);
    expect(res.lines[0].discountAmount).not.toBeCloseTo(0.03, 2);
  });
});

describe("applySalePreviewToDraft — 'Aplica a' (appliesTo) METAL/HECHURA", () => {
  // El combo "Aplica a" de Impuestos rehidrata desde
  // `pricingMeta.taxBreakdown[].applyOn`. Antes se descartaba al mapear →
  // caía a "Total" aunque el motor aplicó METAL/HECHURA ("IVA 21% sobre
  // hechura" en el print). Acá fijamos el passthrough.
  function previewWithTax(applyOn: string) {
    return preview({
      lines: [{
        unitPrice: 100, lineDiscount: 0, lineTaxAmount: 21,
        lineSubtotal: 100, lineTotal: 100, lineTotalWithTax: 121,
        unitTotalWithTax: 121, priceSource: "PRICE_LIST",
        taxBreakdown: [{ name: "IVA", rate: 21, taxAmount: 21, applyOn }],
        pricingSnapshot: {},
      } as any],
    });
  }

  it("taxBreakdown[].applyOn = HECHURA → passthrough (no se descarta)", () => {
    const res = applySalePreviewToDraft(draft(), previewWithTax("HECHURA"));
    expect((res.lines[0].pricingMeta!.taxBreakdown as any)?.[0]?.applyOn).toBe("HECHURA");
  });

  it("taxBreakdown[].applyOn = METAL → passthrough", () => {
    const res = applySalePreviewToDraft(draft(), previewWithTax("METAL"));
    expect((res.lines[0].pricingMeta!.taxBreakdown as any)?.[0]?.applyOn).toBe("METAL");
  });

  it("taxBreakdown sin applyOn → null (no rompe; combo cae a Total)", () => {
    const res = applySalePreviewToDraft(
      draft(),
      preview({
        lines: [{
          unitPrice: 100, lineDiscount: 0, lineTaxAmount: 21,
          lineSubtotal: 100, lineTotal: 100, lineTotalWithTax: 121,
          unitTotalWithTax: 121, priceSource: "PRICE_LIST",
          taxBreakdown: [{ name: "IVA", rate: 21, taxAmount: 21 }],
          pricingSnapshot: {},
        } as any],
      }),
    );
    expect((res.lines[0].pricingMeta!.taxBreakdown as any)?.[0]?.applyOn ?? null).toBeNull();
  });

  it("bonificación heredada METAL → inheritedDiscountAppliesTo = METAL", () => {
    const res = applySalePreviewToDraft(
      draft(),
      preview({
        clientCommercialRules: {
          ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 13, applyOn: "METAL",
        },
      }),
    );
    expect((res.lines[0].pricingMeta as any)?.inheritedDiscountAppliesTo).toBe("METAL");
  });

  it("bonificación heredada HECHURA → inheritedDiscountAppliesTo = HECHURA", () => {
    const res = applySalePreviewToDraft(
      draft(),
      preview({
        clientCommercialRules: {
          ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 13, applyOn: "HECHURA",
        },
      }),
    );
    expect((res.lines[0].pricingMeta as any)?.inheritedDiscountAppliesTo).toBe("HECHURA");
  });
});
