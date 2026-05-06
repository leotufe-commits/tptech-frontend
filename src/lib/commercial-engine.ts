// src/lib/commercial-engine.ts
// ============================================================================
// Contexto comercial del comprobante (frontend) — capa fina que NO calcula
// precios, descuentos ni impuestos. La fuente única de verdad es el
// `pricing-engine` del backend (`getPricingPreview`).
//
// Este módulo SOLO:
//   · Define el tipo `CommercialContext` que se manda al backend.
//   · Arma ese contexto desde un draft + cliente (`buildCommercialContext`).
//   · Aplica defaults del cliente al draft cuando se selecciona uno
//     (`applyClientToDraft`) — lista, término de pago, moneda, vendedor.
//
// Históricamente acá vivía un motor mock (`resolveLinePricing`,
// `listMultiplierFor`, `taxPctFor`, `autoDiscountFor`) que el frontend usaba
// como fallback offline / cálculo optimista. Eso se eliminó porque generaba
// resultados distintos al backend (doble verdad). Hoy el cálculo optimista
// al pickear es: `unitPrice = item.price` (lista cruda), descuentos = 0,
// `partial: true`. El refetch async pisa con los valores reales.
// ============================================================================

import type { TPEntityLite } from "../components/ui/TPEntitySearchSelect";

/**
 * Contexto comercial del comprobante. La pantalla lo arma a partir del draft
 * + cliente seleccionado y se manda al backend en cada `getPricingPreview`.
 * Mismo set de campos que envía el Simulador → mismo resultado.
 */
export type CommercialContext = {
  // Cliente
  clientId?:        string;
  clientName?:      string;
  clientCategory?:  "mayorista" | "minorista";
  ivaCondition?:    string;

  // Documento
  currency:         string;
  fxRate:           number;
  priceListId?:     string;
  paymentTerm?:     string;
  sellerId?:        string;
  warehouseId?:     string;

  // Parámetros comerciales del documento que afectan el pricing del backend.
  // Se mantienen opcionales — si no existen en el draft, no se envían al
  // motor. Cuando la UI los exponga, simplemente se pueblan acá y llegan
  // automáticamente al backend.
  paymentMethodId?:     string;
  installmentsQty?:     number;
  channelId?:           string;
  couponCode?:          string;
  quantityDiscountIds?: string[];
};

/**
 * Arma un `CommercialContext` mínimo a partir de un draft (de SalesInvoice o
 * similar) y, opcionalmente, los datos completos del cliente. La pantalla
 * sigue siendo la dueña del draft — este helper solo concentra la traducción
 * a un shape uniforme para el motor del backend.
 */
export function buildCommercialContext(
  draft: {
    currency: string;
    fxRate?: number;
    priceListId?: string;
    paymentTerm?: string;
    seller?: string;
    warehouse?: string;
    paymentMethodId?:     string;
    installmentsQty?:     number;
    channelId?:           string;
    couponCode?:          string;
    quantityDiscountIds?: string[];
  },
  client?: TPEntityLite | null,
): CommercialContext {
  return {
    clientId:       client?.id,
    clientName:     client?.name,
    clientCategory: client?.category,
    ivaCondition:   client?.ivaCondition,
    currency:       draft.currency,
    fxRate:         draft.fxRate ?? 1,
    priceListId:    draft.priceListId,
    paymentTerm:    draft.paymentTerm,
    sellerId:       draft.seller,
    warehouseId:    draft.warehouse,
    paymentMethodId:     draft.paymentMethodId,
    installmentsQty:     draft.installmentsQty,
    channelId:           draft.channelId,
    couponCode:          draft.couponCode,
    quantityDiscountIds: draft.quantityDiscountIds,
  };
}

/**
 * Patch parcial del draft con los campos que un cliente puede autocompletar.
 * El llamador decide si pisa o no los valores actuales (típicamente se piden
 * confirmación si ya hay líneas cargadas).
 *
 * Solo devuelve campos no-vacíos del cliente; deja sin tocar los que no
 * vengan en el `TPEntityLite`.
 */
export function applyClientToDraft<
  D extends {
    priceListId?: string;
    paymentTerm?: string;
    currency?: string;
    seller?: string;
  },
>(draft: D, client: TPEntityLite): Partial<D> {
  const patch: Partial<D> = {};
  if (client.priceListId)  (patch as any).priceListId = client.priceListId;
  if (client.paymentTerm)  (patch as any).paymentTerm = client.paymentTerm;
  if (client.currency)     (patch as any).currency    = client.currency;
  if (client.sellerId)     (patch as any).seller      = client.sellerId;
  return patch;
}
