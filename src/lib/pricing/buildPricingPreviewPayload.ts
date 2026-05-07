// src/lib/pricing/buildPricingPreviewPayload.ts
// ============================================================================
// buildPricingPreviewPayload — único punto donde se construye el request
// que las tres pantallas (Simulador, Factura, Comparador) envían al motor.
//
// Por ahora hay DOS endpoints en el backend con shapes distintos:
//   · GET  /api/articles/:id/pricing-preview   (query string, 1 línea)
//   · POST /api/sales/preview                  (JSON body, N líneas)
//
// Este helper acepta el `PricingPreviewPayload` unificado y lo adapta al
// shape concreto que cada endpoint espera HOY. Cuando el backend acepte el
// contrato unificado (Fase 4), los adapters se simplifican.
//
// IMPORTANTE — envío:
//   El payload unificado siempre transporta `shipping = { mode, value, weight }`.
//   El endpoint de articles ya acepta esto. El de sales todavía solo acepta
//   `shippingAmount`; el adapter calcula el monto provisorio LOCALMENTE como
//   compatibilidad temporal Fase 1. En Fase 4 el backend va a aceptar
//   `shipping` directamente y se elimina ese cálculo.
//   Marcado con `// TODO Fase 4` para detección.
// ============================================================================

import type {
  PricingPreviewPayload,
  PricingPreviewLinePayload,
  PricingShippingPayload,
} from "./contract";
import { isPricingStrictV1Enabled } from "../featureFlags";

// ─────────────────────────────────────────────────────────────────────────────
// Adapter para el endpoint del Simulador / Comparador (artículos)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shape que acepta hoy `articlesApi.getPricingPreview(articleId, opts)`.
 * Mantengo este tipo local (no importo de services/articles para evitar
 * acoplamiento bidireccional). El typecheck del frontend verifica el match
 * cuando el helper se aplica en el call-site.
 */
export type ArticlePricingPreviewArgs = {
  articleId: string;
  opts: {
    variantId?:        string | null;
    clientId?:         string | null;
    quantity?:         number;
    paymentMethodId?:  string | null;
    installmentsQty?:  number | null;
    priceListId?:      string | null;
    channelId?:        string | null;
    couponCode?:       string | null;
    quantityDiscountIds?: string[];
    shippingMode?:     "FIXED" | "BY_WEIGHT" | "FREE" | null;
    shippingValue?:    number | null;
    shippingWeight?:   number | null;
    taxOverride?: {
      mode:       "PERCENT" | "AMOUNT";
      value:      number;
      appliesTo?: "METAL" | "HECHURA" | "PRODUCT" | "SERVICE" | "TOTAL";
    } | null;
    manualPriceOverride?: number | null;
    manualDiscountOverride?: {
      mode:       "PERCENT" | "AMOUNT";
      value:      number;
      appliesTo?: "METAL" | "HECHURA" | "PRODUCT" | "SERVICE" | "TOTAL";
    } | null;
    gramsOverride?:          number | null;
    mermaPercentOverride?:   number | null;
    metalVariantIdOverride?: string | null;
    hechuraOverrideAmount?:  number | null;
    // Fase MM — currencyId pasa al endpoint para que devuelva los importes
    // convertidos a esa moneda. Si no se pasa, viene en moneda base.
    currencyId?:             string | null;
  };
};

/**
 * Adapta el payload unificado al shape del endpoint de artículos. Restringe a
 * UNA línea (es lo que el endpoint soporta). Si el payload trae 0 ó >1 líneas,
 * lanza error: el caller (Simulador o Comparador) garantiza 1.
 */
export function toArticlePricingPreviewArgs(
  payload: PricingPreviewPayload,
): ArticlePricingPreviewArgs {
  if (!payload.lines || payload.lines.length !== 1) {
    throw new Error(
      `[buildPricingPreviewPayload] El endpoint de artículos requiere exactamente 1 línea (recibí ${payload.lines?.length ?? 0}).`,
    );
  }
  const line = payload.lines[0];
  const ov   = line.overrides ?? {};
  const cost = ov.cost ?? {};

  return {
    articleId: line.articleId,
    opts: {
      variantId:           line.variantId ?? null,
      clientId:            payload.clientId ?? null,
      quantity:            line.quantity,
      paymentMethodId:     payload.paymentMethodId ?? null,
      installmentsQty:     payload.installmentsQty ?? null,
      priceListId:         payload.priceListId ?? null,
      channelId:           payload.channelId ?? null,
      couponCode:          payload.couponCode ?? null,
      shippingMode:        payload.shipping?.mode  ?? null,
      shippingValue:       payload.shipping?.value ?? null,
      shippingWeight:      payload.shipping?.weight ?? null,

      // Overrides puntuales — sólo se mandan si están definidos.
      ...(ov.manualPriceOverride != null && Number.isFinite(ov.manualPriceOverride)
        ? { manualPriceOverride: ov.manualPriceOverride }
        : {}),
      ...(ov.manualDiscountOverride
        ? { manualDiscountOverride: ov.manualDiscountOverride }
        : {}),
      ...(ov.manualTaxOverride
        ? { taxOverride: ov.manualTaxOverride }
        : {}),

      // Overrides de costo (Fase 2 backend).
      ...(cost.gramsOverride          != null ? { gramsOverride:          cost.gramsOverride }          : {}),
      ...(cost.mermaPercentOverride   != null ? { mermaPercentOverride:   cost.mermaPercentOverride }   : {}),
      ...(cost.metalVariantIdOverride        ? { metalVariantIdOverride: cost.metalVariantIdOverride } : {}),
      ...(cost.hechuraOverrideAmount  != null ? { hechuraOverrideAmount:  cost.hechuraOverrideAmount }  : {}),
      // Fase MM — viaja la moneda del response.
      ...(payload.currencyId           ? { currencyId: payload.currencyId } : {}),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter para el endpoint de Factura (sales preview)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shape que acepta hoy `salesApi.preview(input)`. Mantenido local por la
 * misma razón que arriba.
 */
export type SalesPreviewArgs = {
  lines: Array<{
    articleId:               string;
    variantId?:              string | null;
    quantity:                number;
    manualPriceOverride?:    number | null;
    manualDiscountOverride?: {
      mode:       "PERCENT" | "AMOUNT";
      value:      number;
      appliesTo?: "METAL" | "HECHURA" | "PRODUCT" | "SERVICE" | "TOTAL";
    } | null;
    taxOverride?: {
      mode:       "PERCENT" | "AMOUNT";
      value:      number;
      appliesTo?: "METAL" | "HECHURA" | "PRODUCT" | "SERVICE" | "TOTAL";
    } | null;
    /** Fase 2A.7 — override de lista por línea. Tiene precedencia sobre
     *  `priceListId` doc-level. */
    priceListIdOverride?: string | null;
  }>;
  clientId?:             string | null;
  paymentMethodId?:      string | null;
  installmentsQty?:      number;
  channelId?:            string | null;
  couponCode?:           string | null;
  /** Legacy fallback. F1.2 paso 4: bajo flag ON, se manda `shipping` crudo
   *  en lugar de este campo (backend lo resuelve con resolveShippingAmount). */
  shippingAmount?:       number | null;
  /** F1.2 paso 4 — input crudo del envío bajo flag tptech_pricing_strict_v1.
   *  Cuando se manda, el backend lo resuelve y prevalece sobre shippingAmount. */
  shipping?: {
    mode:    "FIXED" | "BY_WEIGHT" | "FREE";
    value?:  number | null;
    weight?: number | null;
  } | null;
  globalDiscountAmount?: number | null;
  globalDiscount?:       { type: "PERCENT" | "AMOUNT"; value: number } | null;
  /** Fase 2A.7 — override de lista a nivel documento. */
  priceListId?:          string | null;
  /** Fase MM — moneda del response. */
  currencyId?:           string | null;
};

/**
 * @deprecated Sprint 2 / POLICY.md §4 R4.3 — el frontend NO debe calcular
 * envío. Esta función se mantiene SOLO como fallback durante la migración:
 * cuando el backend acepte el objeto `shipping: { mode, value, weight }`
 * directamente en `sales/preview`, eliminarla y pasar el objeto crudo.
 *
 * El cálculo `precio/kg × kg` que vive acá es la última pieza de
 * aritmética comercial en el frontend. Sprint 3 cierra esto. Cada
 * invocación emite `console.warn` para hacer visible la deuda.
 */
// TODO Sprint 3: eliminar — el backend acepta `shipping` directo.
export function resolveLegacyShippingAmount(
  shipping: PricingShippingPayload | null | undefined,
): number | null {
  if (!shipping || !shipping.mode) return null;
  if (shipping.mode === "FREE")     return 0;
  if (typeof console !== "undefined") {
    // eslint-disable-next-line no-console
    console.warn(
      "[pricing] resolveLegacyShippingAmount: cálculo de envío en frontend " +
      "(deprecado, POLICY.md §4 R4.3). Pendiente: backend resuelve " +
      "shippingAmount desde { mode, value, weight }.",
    );
  }
  if (shipping.mode === "FIXED") {
    const v = Number(shipping.value);
    return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  }
  if (shipping.mode === "BY_WEIGHT") {
    const ppk = Number(shipping.value);
    const kg  = Number(shipping.weight);
    if (!Number.isFinite(ppk) || !Number.isFinite(kg)) return null;
    return Math.round(ppk * kg * 100) / 100;
  }
  return null;
}

/**
 * Adapta el payload unificado al shape del endpoint de ventas. Soporta N
 * líneas (a diferencia del de artículos).
 *
 * ===========================================================================
 * F1.2 paso 4 — shipping bajo flag tptech_pricing_strict_v1.
 *
 * Política:
 *   · Flag OFF (default): legacy idéntico — el frontend resuelve el monto
 *     con resolveLegacyShippingAmount (precio/kg × kg) y lo manda como
 *     `shippingAmount`. El backend lo absorbe tal cual.
 *   · Flag ON: pasa `shipping: { mode, value, weight }` crudo al backend
 *     (sin shippingAmount). El backend resuelve via resolveShippingAmount
 *     (POLICY.md §5 capa 10) y descarta cálculo local.
 *
 * Justificación POLICY:
 *   · POLICY.md §1 R1.4 / §4 R4.3 — frontend NO calcula shipping.
 *   · POLICY.md §5 (capa 10) — el motor del backend tiene la única
 *     implementación válida de resolveShippingAmount.
 *   · POLICY R12 — frontend NO convierte moneda (no aplica acá; shipping
 *     viaja en su moneda y backend lo procesa con la rate del documento).
 *
 * NO se hace bajo flag ON:
 *   · NO recalcular shipping en frontend.
 *   · NO transformar BY_WEIGHT → flat (el backend interpreta el mode).
 *   · NO inferir montos.
 *   · NO redondear (cero `r2()` aplicado).
 *   · NO convertir moneda.
 *
 * Pantalla desbloqueada:
 *   · Factura Ventas — el panel de envío manda inputs (mode/value/weight)
 *     directos al backend bajo ON. resolveLegacyShippingAmount queda como
 *     dead-code una vez que todas las pantallas migren.
 *   · Simulador — ya manda shipping crudo (no pasa por toSalesPreviewArgs).
 *
 * Fallback automático:
 *   · Si el backend está desplegado en versión pre-shipping-input, el
 *     campo se ignora y el cálculo legacy preserva funcionalidad bajo OFF.
 * ===========================================================================
 */
export function toSalesPreviewArgs(
  payload: PricingPreviewPayload,
): SalesPreviewArgs {
  const useStrict = isPricingStrictV1Enabled();
  return {
    lines: (payload.lines ?? []).map((l) => toSalesPreviewLine(l)),
    clientId:        payload.clientId ?? null,
    paymentMethodId: payload.paymentMethodId ?? null,
    installmentsQty: payload.installmentsQty ?? 0,
    channelId:       payload.channelId ?? null,
    couponCode:      payload.couponCode ?? null,
    // F1.2 paso 4 — bajo ON manda input crudo (sin shippingAmount); bajo OFF
    // resuelve localmente (legacy preservado).
    ...(useStrict
      ? { shipping: payload.shipping ?? null }
      : { shippingAmount: resolveLegacyShippingAmount(payload.shipping) }),
    globalDiscount:  payload.globalDiscount ?? null,
    // Fase 2A.7 — override de lista doc-level. Backend lo acepta desde la
    // misma fase. Sin esto, sales/preview ignoraba el override y volvía a la
    // jerarquía cliente → categoría → favorita, divergiendo de articles.
    priceListId:     payload.priceListId ?? null,
    // Fase MM — viaja la moneda del response.
    currencyId:      payload.currencyId ?? null,
  };
}

function toSalesPreviewLine(line: PricingPreviewLinePayload): SalesPreviewArgs["lines"][number] {
  const ov = line.overrides ?? {};
  return {
    articleId: line.articleId,
    variantId: line.variantId ?? null,
    quantity:  line.quantity,
    ...(ov.manualPriceOverride != null && Number.isFinite(ov.manualPriceOverride)
      ? { manualPriceOverride: ov.manualPriceOverride }
      : {}),
    ...(ov.manualDiscountOverride
      ? { manualDiscountOverride: ov.manualDiscountOverride }
      : {}),
    ...(ov.manualTaxOverride
      ? { taxOverride: ov.manualTaxOverride }
      : {}),
    // Fase 2A.7 — override de lista por línea (toma precedencia sobre
    // `priceListId` doc-level cuando ambos vienen).
    ...(line.priceListIdOverride
      ? { priceListIdOverride: line.priceListIdOverride }
      : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Validaciones
// ─────────────────────────────────────────────────────────────────────────────

/** Devuelve la primera razón por la que el payload no es válido, o null. */
export function validatePricingPreviewPayload(
  payload: PricingPreviewPayload,
): string | null {
  if (!payload.lines || payload.lines.length === 0) {
    return "El payload debe tener al menos una línea.";
  }
  for (let i = 0; i < payload.lines.length; i++) {
    const l = payload.lines[i];
    if (!l.articleId) return `Línea ${i + 1}: falta articleId.`;
    if (!Number.isFinite(l.quantity) || l.quantity <= 0) {
      return `Línea ${i + 1}: cantidad inválida.`;
    }
  }
  if (payload.shipping && payload.shipping.mode === "BY_WEIGHT") {
    const ppk = Number(payload.shipping.value);
    const kg  = Number(payload.shipping.weight);
    if (!Number.isFinite(ppk) || !Number.isFinite(kg)) {
      return "Envío BY_WEIGHT requiere value (precio/kg) y weight (kg).";
    }
  }
  return null;
}
