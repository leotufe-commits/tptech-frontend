// src/lib/sales/__tests__/kind-toggle-marks-manual.test.ts
// ============================================================================
// T4 — Cambiar BONIFICACIÓN ↔ RECARGO en el selector del TPNumber debe:
//   1. Persistir como override MANUAL del operador (flag discount=true).
//   2. Conservar value / mode / appliesTo del estado previo.
//   3. Reflejar el nuevo kind en `manualDiscount.kind`.
//   4. Propagar el kind en el payload (manualDiscountOverride.kind).
//   5. Cambiar la firma del payload → dispara preview backend.
//   6. La rehidratación del preview NO debe pisar el override manual.
//
// El motor (backend) ya diferencia BONUS de SURCHARGE en
// `pricing-engine.sale.ts` (línea isSurcharge ? plus : minus); este archivo
// fija el contrato de la capa frontend (payload + rehidratación) — la
// interacción con el menú vive en `TPDocumentLineAdvancedEditor.selectKind`.
// ============================================================================

import { describe, it, expect } from "vitest";
import { buildSalePreviewPayload } from "../buildSalePreviewPayload";
import { applySalePreviewToDraft } from "../applySalePreviewToDraft";
import type { SalesInvoice } from "../types";
import type { DocumentLine } from "../../document-types";
import type { SalePreviewResult } from "../../../services/sales";

function lineWithKind(
  kind: "BONUS" | "SURCHARGE",
  args: { value?: number; appliesTo?: "TOTAL" | "METAL" | "HECHURA"; mode?: "PERCENT" | "AMOUNT" } = {},
): DocumentLine {
  const { value = 10, appliesTo = "TOTAL", mode = "PERCENT" } = args;
  return {
    id: "L1", articleId: "ART-1", article: "Anillo", quantity: 1,
    unitPrice: 1000, discountAmount: 0, subtotal: 1000,
    taxAmount: 0, lineTotal: 1000, lineTotalWithTax: 1000,
    manualOverrides: { discount: true }, // selectKind lo prende vía applyLineOverrides
    pricingMeta: {
      priceSource: "MANUAL_OVERRIDE", basePrice: 1000,
      manualDiscount: { mode, value, appliesTo, kind },
    } as any,
  } as unknown as DocumentLine;
}

function draftOf(l: DocumentLine, clientId: string | null = null): SalesInvoice {
  return {
    id: "fv1", number: "FV", date: "", dueDate: "", client: "",
    salesOrderNumber: "", deliveryNumber: "", currency: "ARS", fxRate: 1,
    taxPercent: 21, seller: "", warehouse: "", paymentTerm: "",
    referenceNumber: "", notes: "", terms: "", subtotal: 0, discountAmount: 0,
    taxAmount: 0, total: 0, paidAmount: 0, lines: [l], status: "DRAFT",
    clientId: clientId ?? undefined,
  } as SalesInvoice;
}

describe("T4 — Selector BONIFICACIÓN ↔ RECARGO marca override manual y propaga kind", () => {
  it("kind=BONUS viaja en el payload con value, mode y appliesTo preservados", () => {
    const l = lineWithKind("BONUS", { value: 15, mode: "PERCENT", appliesTo: "METAL" });
    const { payload } = buildSalePreviewPayload(draftOf(l));
    const pl = payload.lines[0] as any;
    expect(pl.manualDiscountOverride).toEqual({
      mode: "PERCENT", value: 15, appliesTo: "METAL", kind: "BONUS",
    });
  });

  it("kind=SURCHARGE viaja en el payload con value, mode y appliesTo preservados", () => {
    const l = lineWithKind("SURCHARGE", { value: 12, mode: "AMOUNT", appliesTo: "HECHURA" });
    const { payload } = buildSalePreviewPayload(draftOf(l));
    const pl = payload.lines[0] as any;
    expect(pl.manualDiscountOverride).toEqual({
      mode: "AMOUNT", value: 12, appliesTo: "HECHURA", kind: "SURCHARGE",
    });
  });

  it("cambio de kind SIN otros cambios → la firma del payload difiere → preview se dispara", () => {
    // Histórico: `sameTypedOverride` ignoraba kind y los patches de kind se
    // descartaban como idempotentes. Fija el contrato actual.
    const a = JSON.stringify(buildSalePreviewPayload(draftOf(lineWithKind("BONUS",     { value: 10 }))).payload);
    const b = JSON.stringify(buildSalePreviewPayload(draftOf(lineWithKind("SURCHARGE", { value: 10 }))).payload);
    expect(a).not.toEqual(b);
  });

  it("sin cliente seleccionado, kind=SURCHARGE también viaja (el manual no depende del cliente)", () => {
    const l = lineWithKind("SURCHARGE", { value: 7, mode: "PERCENT", appliesTo: "TOTAL" });
    const { payload } = buildSalePreviewPayload(draftOf(l, null));
    const pl = payload.lines[0] as any;
    expect(pl.manualDiscountOverride.kind).toBe("SURCHARGE");
    expect(payload.clientId).toBeNull();
  });

  it("con cliente seleccionado, el manual sigue ganando al automático heredado (kind respetado)", () => {
    const l = lineWithKind("SURCHARGE", { value: 5, mode: "PERCENT", appliesTo: "TOTAL" });
    const { payload } = buildSalePreviewPayload(draftOf(l, "client-X"));
    const pl = payload.lines[0] as any;
    expect(pl.manualDiscountOverride.kind).toBe("SURCHARGE");
    expect(payload.clientId).toBe("client-X");
  });

  it("rehidratación: applySalePreviewToDraft NO pisa el manualDiscount.kind del draft", () => {
    const l = lineWithKind("SURCHARGE", { value: 8, mode: "PERCENT", appliesTo: "METAL" });
    // El preview backend devuelve los importes resultantes (line discount,
    // unitPrice, etc.). El kind y la config manual viven en el draft y NO
    // deben sobrescribirse: el `applySalePreviewToDraft` solo escribe los
    // campos derivados.
    const preview: SalePreviewResult = {
      lines: [{
        articleId:               "ART-1",
        variantId:               null,
        quantity:                1,
        basePrice:               1000,
        unitPrice:               1080, // SURCHARGE → precio sube
        unitTaxAmount:           0,
        unitTotalWithTax:        1080,
        quantityDiscountAmount:  0,
        promotionDiscountAmount: 0,
        lineSubtotal:            1080,
        lineTotal:               1080,
        lineDiscount:            0,   // SURCHARGE no es descuento (motor limpia)
        lineTaxAmount:           0,
        lineTotalWithTax:        1080,
        priceSource:             "MANUAL_OVERRIDE",
        appliedPriceListId:      null,
        appliedPriceListName:    null,
        appliedPromotionId:      null,
        appliedPromotionName:    null,
        unitCost:                500,
        unitMargin:              580,
        marginPercent:           116,
        metalHechuraBreakdown:   null,
        taxBreakdown:            [],
      }] as any,
      documentTotals: {
        subtotalBeforeDiscounts:    1000,
        lineDiscountAmount:         0,
        subtotalAfterLineDiscounts: 1080,
        couponDiscountAmount:       0,
        globalDiscountAmount:       0,
        taxAmount:                  0,
        shippingAmount:             0,
        total:                      1080,
      } as any,
    } as SalePreviewResult;

    const out = applySalePreviewToDraft(draftOf(l), preview);
    const updated = out.lines[0];

    // Override manual intacto (kind, value, mode, appliesTo).
    expect((updated.pricingMeta as any)?.manualDiscount).toEqual({
      mode: "PERCENT", value: 8, appliesTo: "METAL", kind: "SURCHARGE",
    });
    // Flag tampoco se pierde — la rehidratación no resetea overrides.
    expect(updated.manualOverrides?.discount).toBe(true);
    // Importes vienen del motor.
    expect(updated.unitPrice).toBe(1080);
    expect(updated.lineTotalWithTax).toBe(1080);
  });

  it("kind con mode=AMOUNT también propaga al payload (no es solo PERCENT)", () => {
    const l = lineWithKind("SURCHARGE", { value: 50, mode: "AMOUNT", appliesTo: "TOTAL" });
    const { payload } = buildSalePreviewPayload(draftOf(l));
    const pl = payload.lines[0] as any;
    expect(pl.manualDiscountOverride.mode).toBe("AMOUNT");
    expect(pl.manualDiscountOverride.value).toBe(50);
    expect(pl.manualDiscountOverride.kind).toBe("SURCHARGE");
  });
});
