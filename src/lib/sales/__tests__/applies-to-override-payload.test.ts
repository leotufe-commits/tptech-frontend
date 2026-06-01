// src/lib/sales/__tests__/applies-to-override-payload.test.ts
// ============================================================================
// El override de SOLO la base ("Aplica a") viaja en el payload INDEPENDIENTE
// del valor: con `pricingMeta.manualTaxAppliesTo` / `manualDiscountAppliesTo`
// seteado y SIN override de %/monto, el payload manda
// `manualTaxAppliesToOverride` / `manualDiscountAppliesToOverride` por línea
// → `previewSignature` cambia → el preview recalcula al toque.
// ============================================================================

import { describe, it, expect } from "vitest";
import { buildSalePreviewPayload } from "../buildSalePreviewPayload";
import type { SalesInvoice } from "../types";
import type { DocumentLine } from "../../document-types";

function line(id: string, meta: any): DocumentLine {
  return {
    id, articleId: "ART-1", article: "Anillo", quantity: 1,
    unitPrice: 1000, discountAmount: 0, subtotal: 1000,
    taxAmount: 210, lineTotal: 1210, lineTotalWithTax: 1210,
    pricingMeta: { priceSource: "PRICE_LIST", basePrice: 1000, ...meta },
  } as unknown as DocumentLine;
}
function draft(lines: DocumentLine[]): SalesInvoice {
  return {
    id: "fv1", number: "FV", date: "", dueDate: "", client: "",
    salesOrderNumber: "", deliveryNumber: "", currency: "ARS", fxRate: 1,
    taxPercent: 21, seller: "", warehouse: "", paymentTerm: "",
    referenceNumber: "", notes: "", terms: "", subtotal: 0, discountAmount: 0,
    taxAmount: 0, total: 0, paidAmount: 0, lines, status: "DRAFT",
  } as SalesInvoice;
}

describe("payload — override de base 'Aplica a' (sin override de valor)", () => {
  it("manualTaxAppliesTo viaja como manualTaxAppliesToOverride; taxOverride sigue null", () => {
    const { payload } = buildSalePreviewPayload(
      draft([line("L1", { manualTaxAppliesTo: "HECHURA" })]),
    );
    const pl = payload.lines[0] as any;
    expect(pl.manualTaxAppliesToOverride).toBe("HECHURA");
    expect(pl.taxOverride).toBeNull(); // NO se inventó override de valor
  });

  it("manualDiscountAppliesTo viaja como manualDiscountAppliesToOverride", () => {
    const { payload } = buildSalePreviewPayload(
      draft([line("L1", { manualDiscountAppliesTo: "METAL" })]),
    );
    const pl = payload.lines[0] as any;
    expect(pl.manualDiscountAppliesToOverride).toBe("METAL");
    expect(pl.manualDiscountOverride).toBeNull();
  });

  it("sin override de base → no viaja (null)", () => {
    const { payload } = buildSalePreviewPayload(draft([line("L1", {})]));
    const pl = payload.lines[0] as any;
    expect(pl.manualTaxAppliesToOverride).toBeNull();
    expect(pl.manualDiscountAppliesToOverride).toBeNull();
  });

  it("dos líneas mismo artículo → override de base independiente por línea", () => {
    const { payload } = buildSalePreviewPayload(
      draft([
        line("A", { manualTaxAppliesTo: "HECHURA" }),
        line("B", {}),
      ]),
    );
    expect((payload.lines[0] as any).manualTaxAppliesToOverride).toBe("HECHURA");
    expect((payload.lines[1] as any).manualTaxAppliesToOverride).toBeNull();
  });
});

// ============================================================================
// Recalculo cuando solo cambia `kind` (Bonificación ⇄ Recargo).
//
// Causa raíz histórica: `sameTypedOverride` no comparaba `kind` → patches que
// solo cambiaban el tipo se descartaban como idempotentes y `previewSignature`
// no detectaba el cambio → motor no recalculaba. El payload SÍ propaga `kind`
// (este test fija ese contrato + verifica que la firma serializada cambia).
// ============================================================================
function lineWithDiscountOverride(id: string, kind: "BONUS" | "SURCHARGE"): DocumentLine {
  return {
    id, articleId: "ART-1", article: "Anillo", quantity: 1,
    unitPrice: 1000, discountAmount: 0, subtotal: 1000,
    taxAmount: 0, lineTotal: 1000, lineTotalWithTax: 1000,
    manualOverrides: { discount: true },
    pricingMeta: {
      priceSource: "MANUAL_OVERRIDE", basePrice: 1000,
      manualDiscount: { mode: "PERCENT", value: 10, appliesTo: "TOTAL", kind },
    },
  } as unknown as DocumentLine;
}

// ============================================================================
// Envío (`shipping`) — el payload manda `shippingAmount` plano (mismo
// contrato que consume `pricing-engine`/`salesApi.preview`). Cambiar el costo
// cambia la signature → el preview se vuelve a disparar. Sin cambios al
// motor: el carrier real solo afecta el monto DERIVADO en el frontend.
// ============================================================================
function draftWithShipping(cost: number, methodId?: string): SalesInvoice {
  return {
    id: "fv1", number: "FV", date: "", dueDate: "", client: "",
    salesOrderNumber: "", deliveryNumber: "", currency: "ARS", fxRate: 1,
    taxPercent: 21, seller: "", warehouse: "", paymentTerm: "",
    referenceNumber: "", notes: "", terms: "", subtotal: 0, discountAmount: 0,
    taxAmount: 0, total: 0, paidAmount: 0,
    lines: [{
      id: "L1", articleId: "ART-1", article: "Anillo", quantity: 1,
      unitPrice: 1000, discountAmount: 0, subtotal: 1000,
      taxAmount: 0, lineTotal: 1000, lineTotalWithTax: 1000,
      pricingMeta: { priceSource: "PRICE_LIST", basePrice: 1000 },
    } as any],
    shipping: { cost, methodId },
    status: "DRAFT",
  } as unknown as SalesInvoice;
}

describe("payload — shipping (envío)", () => {
  it("shipping.cost se manda como shippingAmount plano", () => {
    const { payload } = buildSalePreviewPayload(draftWithShipping(500));
    expect((payload as any).shippingAmount).toBe(500);
  });

  it("sin shipping → shippingAmount = 0", () => {
    const { payload } = buildSalePreviewPayload(draftWithShipping(0));
    expect((payload as any).shippingAmount).toBe(0);
  });

  it("cambiar el costo cambia la signature (dispara preview)", () => {
    const a = JSON.stringify(buildSalePreviewPayload(draftWithShipping(500)).payload);
    const b = JSON.stringify(buildSalePreviewPayload(draftWithShipping(700)).payload);
    expect(a).not.toEqual(b);
  });

  it("limpiar el envío (cost=0) cambia la signature respecto del envío activo", () => {
    const withShipping = JSON.stringify(buildSalePreviewPayload(draftWithShipping(500)).payload);
    const cleared      = JSON.stringify(buildSalePreviewPayload(draftWithShipping(0)).payload);
    expect(withShipping).not.toEqual(cleared);
  });
});

// ============================================================================
// Manual + cambio de qty — el payload debe enviar la nueva qty Y preservar
// el override manual. Esto garantiza que el motor backend reciba ambos y
// recalcule el total con la nueva qty aplicando el manual (sin reactivar
// promo/qty/cliente). Anti-regresión del flujo "manual siempre manda aunque
// qty cambie".
// ============================================================================
describe("payload — manualDiscountOverride + nueva quantity (manual + qty)", () => {
  function lineWithManualAndQty(qty: number): DocumentLine {
    return {
      id: "L1", articleId: "ART-1", article: "Anillo", quantity: qty,
      unitPrice: 1000, discountAmount: 150,
      subtotal: 1000 * qty - 150 * qty, taxAmount: 0,
      lineTotal: 1000 * qty - 150 * qty,
      lineTotalWithTax: 1000 * qty - 150 * qty,
      // Manual override del operador (15% sobre el precio).
      manualOverrides: { discount: true },
      pricingMeta: {
        priceSource: "PRICE_LIST", basePrice: 1000,
        // Backend reporta qty discount activo (el motor lo expone como
        // metadata teórica aunque el manual lo reemplace).
        quantityDiscountAmount: 50,
        manualDiscount: { mode: "PERCENT", value: 15, appliesTo: "TOTAL", kind: "BONUS" },
      },
    } as unknown as DocumentLine;
  }

  it("qty=2 + manual → payload envía quantity:2 + manualDiscountOverride preservado", () => {
    const { payload } = buildSalePreviewPayload(draft([lineWithManualAndQty(2)]));
    const pl = payload.lines[0] as any;
    expect(pl.quantity).toBe(2);
    expect(pl.manualDiscountOverride).toEqual({
      mode: "PERCENT", value: 15, appliesTo: "TOTAL", kind: "BONUS",
    });
  });

  it("qty=10 (entra en tramo de desc. cantidad) + manual → mismo override, nueva qty", () => {
    // Anti-regresión: aunque la nueva qty califique para un descuento por
    // cantidad mayor, el frontend manda el override manual intacto. El
    // motor backend respetará el override y NO reactivará qty discount.
    const { payload } = buildSalePreviewPayload(draft([lineWithManualAndQty(10)]));
    const pl = payload.lines[0] as any;
    expect(pl.quantity).toBe(10);
    // El override es EL MISMO objeto que con qty=2 — no se pierde ni se
    // modifica por el cambio de qty.
    expect(pl.manualDiscountOverride).toEqual({
      mode: "PERCENT", value: 15, appliesTo: "TOTAL", kind: "BONUS",
    });
  });

  it("manual 0 + cambio de qty → override { value: 0 } sigue presente con nueva qty", () => {
    // Con la semántica global X=manual 0, el operador puede tener
    // manualDiscount={value:0}. Cambiar qty NO debe perderlo.
    const line: DocumentLine = {
      id: "L1", articleId: "ART-1", article: "Anillo", quantity: 7,
      unitPrice: 1000, discountAmount: 0, subtotal: 7000,
      taxAmount: 0, lineTotal: 7000, lineTotalWithTax: 7000,
      manualOverrides: { discount: true },
      pricingMeta: {
        priceSource: "PRICE_LIST", basePrice: 1000,
        quantityDiscountAmount: 50, // motor lo expone (teórico)
        manualDiscount: { mode: "PERCENT", value: 0, appliesTo: "TOTAL", kind: "BONUS" },
      },
    } as unknown as DocumentLine;
    const { payload } = buildSalePreviewPayload(draft([line]));
    const pl = payload.lines[0] as any;
    expect(pl.quantity).toBe(7);
    expect(pl.manualDiscountOverride).toEqual({
      mode: "PERCENT", value: 0, appliesTo: "TOTAL", kind: "BONUS",
    });
  });

  it("SIN manual + qty → payload NO manda manualDiscountOverride (qty discount lo aplica el motor)", () => {
    // Anti-regresión del contrato: sin manualOverrides.discount, el
    // payload no inventa un override. El motor backend aplica qty
    // discount automático.
    const line: DocumentLine = {
      id: "L1", articleId: "ART-1", article: "Anillo", quantity: 10,
      unitPrice: 1000, discountAmount: 500, subtotal: 9500,
      taxAmount: 0, lineTotal: 9500, lineTotalWithTax: 9500,
      // SIN manualOverrides.discount.
      pricingMeta: {
        priceSource: "PRICE_LIST", basePrice: 1000,
        quantityDiscountAmount: 50,
      },
    } as unknown as DocumentLine;
    const { payload } = buildSalePreviewPayload(draft([line]));
    const pl = payload.lines[0] as any;
    expect(pl.quantity).toBe(10);
    expect(pl.manualDiscountOverride).toBeNull();
  });
});

describe("payload — `kind` viaja como parte del manualDiscountOverride", () => {
  it("kind=BONUS se incluye en el payload", () => {
    const { payload } = buildSalePreviewPayload(draft([lineWithDiscountOverride("L1", "BONUS")]));
    const pl = payload.lines[0] as any;
    expect(pl.manualDiscountOverride).toEqual({
      mode: "PERCENT", value: 10, appliesTo: "TOTAL", kind: "BONUS",
    });
  });

  it("kind=SURCHARGE se incluye en el payload", () => {
    const { payload } = buildSalePreviewPayload(draft([lineWithDiscountOverride("L1", "SURCHARGE")]));
    const pl = payload.lines[0] as any;
    expect(pl.manualDiscountOverride).toEqual({
      mode: "PERCENT", value: 10, appliesTo: "TOTAL", kind: "SURCHARGE",
    });
  });

  it("misma config con kind distinto → payload distinto → signature distinta", () => {
    const bonusPayload     = buildSalePreviewPayload(draft([lineWithDiscountOverride("L1", "BONUS")])).payload;
    const surchargePayload = buildSalePreviewPayload(draft([lineWithDiscountOverride("L1", "SURCHARGE")])).payload;
    // `previewSignature` se construye como `JSON.stringify(payload)`; si las
    // firmas coinciden el preview no se dispara → este es exactamente el
    // bug que estábamos cazando. Las firmas DEBEN diferir.
    expect(JSON.stringify(bonusPayload)).not.toEqual(JSON.stringify(surchargePayload));
  });
});

// ============================================================================
// Defensa en profundidad: estado inconsistente del flag manual.
//
// `applyLineOverrides` SIEMPRE sincroniza `manualOverrides.discount` con
// `meta.manualDiscount` (`patch.manualDiscount !== undefined → flag = value
// != null`). Pero si por cualquier path histórico el flag queda "pegado" en
// `true` sin valor en `meta`, el fallback anterior derivaba un override
// desde `l.discountAmount` — y ese campo puede contener un descuento
// HEREDADO del cliente. Promoverlo a override manual reenviaría al motor un
// descuento que ya está aplicando por `clientId` → doble aplicación
// ("override fantasma"). El payload debe ignorar el flag inconsistente.
// ============================================================================
function lineWithStuckFlagAndInheritedAmount(id: string): DocumentLine {
  return {
    id, articleId: "ART-1", article: "Anillo", quantity: 1,
    unitPrice: 1000,
    // discountAmount > 0 viene del motor (heredado del cliente);
    // NO debe promoverse a manual.
    discountAmount: 100,
    subtotal: 900, taxAmount: 0, lineTotal: 900, lineTotalWithTax: 900,
    manualOverrides: { discount: true },
    pricingMeta: {
      priceSource: "PRICE_LIST", basePrice: 1000,
      manualDiscount: null, // ← inconsistente con el flag
      inheritedDiscount: {
        ruleType: "DISCOUNT", valueType: "PERCENTAGE",
        value: 10, applyOn: "TOTAL", origin: "CLIENT",
      },
    },
  } as unknown as DocumentLine;
}

describe("payload — defensa en profundidad: flag manual sin meta no inventa override fantasma", () => {
  it("ov.discount=true + meta.manualDiscount=null + heredado en discountAmount → manualDiscountOverride=null", () => {
    const { payload } = buildSalePreviewPayload(
      draft([lineWithStuckFlagAndInheritedAmount("L1")]),
    );
    const pl = payload.lines[0] as any;
    // El bug que evitamos: no convertir el descuento heredado del cliente
    // ($100 sobre $1000 = 10%) en un override manual fantasma que se
    // reenvíe al motor. El payload debe NO traer manualDiscountOverride.
    expect(pl.manualDiscountOverride).toBeNull();
  });
});
