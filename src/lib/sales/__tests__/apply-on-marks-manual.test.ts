// src/lib/sales/__tests__/apply-on-marks-manual.test.ts
// ============================================================================
// T3 — Cambiar "Aplica en" en Bonificación/Recargo debe persistir SIEMPRE
// como override MANUAL del operador, aunque el valor previo del descuento
// fuese 0 o viniera de un automático/heredado.
//
// Antes de este fix, el editor solo mandaba `manualDiscountAppliesTo` en
// el patch cuando no había `manualDiscount` previo o su value era 0. El
// flag `manualOverrides.discount` no se prendía → la rehidratación del
// próximo preview podía revivir el descuento automático del motor
// (promo/cantidad/cliente) y pisaba la elección del operador.
//
// El editor ahora siempre arma un `manualDiscount` con el valor efectivo
// VISIBLE en el TPNumber (passthrough del motor, sin matemática nueva), y
// `applyLineOverrides` prende `manualOverrides.discount=true`. El payload
// resultante propaga el override al motor y la rehidratación lo respeta.
//
// Este archivo fija el contrato de payload + rehidratación; la interacción
// UI vive en el editor y los tests de integración del editor cubren el
// disparo del patch.
// ============================================================================

import { describe, it, expect } from "vitest";
import { buildSalePreviewPayload } from "../buildSalePreviewPayload";
import { applySalePreviewToDraft } from "../applySalePreviewToDraft";
import type { SalesInvoice } from "../types";
import type { DocumentLine } from "../../document-types";
import type { SalePreviewResult } from "../../../services/sales";

function line(args: {
  appliesTo: "TOTAL" | "METAL" | "HECHURA";
  value:     number;
  kind:      "BONUS" | "SURCHARGE";
  /** Si false, simula el caso PRE-FIX (sin manualDiscount, solo base). */
  withManualDiscount?: boolean;
}): DocumentLine {
  const md = args.withManualDiscount !== false
    ? { mode: "PERCENT" as const, value: args.value, appliesTo: args.appliesTo, kind: args.kind }
    : null;
  return {
    id: "L1", articleId: "ART-1", article: "Anillo", quantity: 1,
    unitPrice: 1000, discountAmount: 0, subtotal: 1000,
    taxAmount: 0, lineTotal: 1000, lineTotalWithTax: 1000,
    // El flag SOLO está prendido cuando hay manualDiscount (post-fix).
    manualOverrides: md != null ? { discount: true } : {},
    pricingMeta: {
      priceSource: "PRICE_LIST", basePrice: 1000,
      manualDiscount: md,
      manualDiscountAppliesTo: args.appliesTo,
    } as any,
  } as unknown as DocumentLine;
}

function draftOf(l: DocumentLine): SalesInvoice {
  return {
    id: "fv1", number: "FV", date: "", dueDate: "", client: "",
    salesOrderNumber: "", deliveryNumber: "", currency: "ARS", fxRate: 1,
    taxPercent: 21, seller: "", warehouse: "", paymentTerm: "",
    referenceNumber: "", notes: "", terms: "", subtotal: 0, discountAmount: 0,
    taxAmount: 0, total: 0, paidAmount: 0, lines: [l], status: "DRAFT",
  } as SalesInvoice;
}

describe("T3 — Cambiar 'Aplica en' siempre persiste como override MANUAL", () => {
  it("post-fix: línea con manualDiscount + flag discount=true → payload manda override y appliesTo", () => {
    const l = line({ appliesTo: "METAL", value: 0, kind: "BONUS" });
    const { payload } = buildSalePreviewPayload(draftOf(l));
    const pl = payload.lines[0] as any;

    // El payload propaga el override completo — el motor recibe la
    // intención manual y NO reactiva promo/cantidad/cliente.
    expect(pl.manualDiscountOverride).toEqual({
      mode: "PERCENT", value: 0, appliesTo: "METAL", kind: "BONUS",
    });
    expect(pl.manualDiscountAppliesToOverride).toBe("METAL");
  });

  it("post-fix con value=0 (operador eligió 'sin bonificación' con base METAL) → override viaja", () => {
    // Caso T3-específico: el operador cambió 'Aplica en' sin tener un %
    // explícito. El editor cristaliza la intención como manual {value:0}.
    // Esto MARCA la línea como manual y bloquea el automático.
    const l = line({ appliesTo: "METAL", value: 0, kind: "BONUS" });
    const { payload } = buildSalePreviewPayload(draftOf(l));
    const pl = payload.lines[0] as any;

    expect(pl.manualDiscountOverride).not.toBeNull();
    expect(pl.manualDiscountOverride.value).toBe(0);
    expect(pl.manualDiscountOverride.appliesTo).toBe("METAL");
  });

  it("pre-fix (solo base, sin manualDiscount, flag=false) → el motor recibía solo la base", () => {
    // Documenta el comportamiento previo para anti-regresión: si por algún
    // path el flag no se prendiera, el override SE PIERDE (el motor
    // reactiva automáticos). El fix vive en el editor: siempre arma el
    // `manualDiscount`. Este test fija que `buildSalePreviewPayload`
    // necesita el flag — no inventa overrides "fantasma".
    const l = line({
      appliesTo: "METAL",
      value: 0,
      kind: "BONUS",
      withManualDiscount: false,
    });
    const { payload } = buildSalePreviewPayload(draftOf(l));
    const pl = payload.lines[0] as any;

    expect(pl.manualDiscountOverride).toBeNull();
    // La base sí viaja (override de base es independiente del valor),
    // pero sin el manualDiscount el motor reaplica los automáticos sobre
    // esa base.
    expect(pl.manualDiscountAppliesToOverride).toBe("METAL");
  });

  it("rehidratación: la respuesta del motor NO pisa el manualDiscount del draft", () => {
    // Anti-regresión: el motor puede devolver `customerDiscountAmount` o
    // `quantityDiscountAmount` informativos. `applySalePreviewToDraft` NO
    // debe sobrescribir el `manualDiscount` ni el `manualDiscountAppliesTo`
    // del draft (sólo escribe los campos derivados del preview).
    const l = line({ appliesTo: "METAL", value: 7, kind: "BONUS" });
    const preview: SalePreviewResult = {
      lines: [{
        articleId:               "ART-1",
        variantId:               null,
        quantity:                1,
        basePrice:               1000,
        unitPrice:               930,
        unitTaxAmount:           0,
        unitTotalWithTax:        930,
        quantityDiscountAmount:  0,
        promotionDiscountAmount: 0,
        lineSubtotal:            930,
        lineTotal:               930,
        lineDiscount:            70,
        lineTaxAmount:           0,
        lineTotalWithTax:        930,
        priceSource:             "PRICE_LIST",
        appliedPriceListId:      null,
        appliedPriceListName:    null,
        appliedPromotionId:      null,
        appliedPromotionName:    null,
        unitCost:                500,
        unitMargin:              430,
        marginPercent:           86,
        metalHechuraBreakdown:   null,
        taxBreakdown:            [],
      }] as any,
      documentTotals: {
        subtotalBeforeDiscounts:    1000,
        lineDiscountAmount:         70,
        subtotalAfterLineDiscounts: 930,
        couponDiscountAmount:       0,
        globalDiscountAmount:       0,
        taxAmount:                  0,
        shippingAmount:             0,
        total:                      930,
      } as any,
    } as SalesInvoice extends never ? never : SalePreviewResult;

    const out = applySalePreviewToDraft(draftOf(l), preview);
    const updated = out.lines[0];

    // El override manual se mantiene (mismo objeto que el draft).
    expect((updated.pricingMeta as any)?.manualDiscount).toEqual({
      mode: "PERCENT", value: 7, appliesTo: "METAL", kind: "BONUS",
    });
    // El flag tampoco se pierde (no se toca en applySalePreviewToDraft).
    expect(updated.manualOverrides?.discount).toBe(true);
    // El monto del descuento sí viene del motor (passthrough).
    expect(updated.discountAmount).toBe(70);
  });
});
