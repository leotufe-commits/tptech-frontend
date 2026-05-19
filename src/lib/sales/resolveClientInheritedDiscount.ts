// src/lib/sales/resolveClientInheritedDiscount.ts
// ============================================================================
// Helper PURO: traduce la bonificación comercial del cliente a un
// `DocumentDiscountGlobal` con `origin: "CLIENT"` — SOLO cuando es
// representable en el control actual de "Descuento global".
//
// Fase A (parcial): únicamente `commercialRuleType === "DISCOUNT"` con
// `commercialApplyOn === "TOTAL"`. METAL / HECHURA / BONUS / SURCHARGE quedan
// fuera (no representables en el control %/$ sobre subtotal) → devuelve null
// y el `pricing-engine` los sigue aplicando por `clientId` sin reflejo en UI.
//
// NO calcula precios: solo mapea forma. El motor backend es la fuente de
// verdad; este valor con `origin:"CLIENT"` NO se reenvía al preview.
// ============================================================================

import type { DocumentDiscountGlobal } from "../document-types";

/** Shape mínimo del detalle de cliente que necesita el helper. */
export type ClientCommercialFields = {
  commercialRuleType?:  string | null;
  commercialValueType?: string | null;
  commercialValue?:     string | number | null;
  commercialApplyOn?:   string | null;
};

/** Texto de trazabilidad que marca el descuento como heredado del cliente. */
export const CLIENT_INHERITED_DISCOUNT_REASON = "Bonificación heredada del cliente";

/**
 * Devuelve el `DocumentDiscountGlobal` heredado (origin CLIENT) o `null` si
 * el cliente no tiene bonificación o no es representable en Fase A.
 */
export function resolveClientInheritedDiscount(
  client: ClientCommercialFields | null | undefined,
): DocumentDiscountGlobal | null {
  if (!client) return null;
  if (client.commercialRuleType !== "DISCOUNT") return null;
  if (client.commercialApplyOn !== "TOTAL") return null;

  const raw = client.commercialValue;
  const value = typeof raw === "number" ? raw : Number(raw ?? NaN);
  if (!Number.isFinite(value) || value <= 0) return null;

  const type: DocumentDiscountGlobal["type"] =
    client.commercialValueType === "PERCENTAGE" ? "PERCENT" : "AMOUNT";

  return {
    type,
    value,
    reason: CLIENT_INHERITED_DISCOUNT_REASON,
    origin: "CLIENT",
  };
}
