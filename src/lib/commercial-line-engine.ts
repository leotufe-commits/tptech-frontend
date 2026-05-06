// src/lib/commercial-line-engine.ts
// ============================================================================
// Motor de LÍNEA comercial — capa puramente lógica (sin React) que centraliza
// las decisiones que comparten Factura de Venta y Simulador de Precios:
//
//   · Constraints de cantidad (min / max / step / default).
//   · Cantidad inicial al pickear un ítem.
//   · Normalización de cantidad al modificarla (clamp + cuantización a step).
//   · Mapeo Article → Línea (itemKind, ids, sku, descripción, manageStock).
//   · Ensamble de los args que necesita `articlesApi.getPricingPreview`.
//
// La idea es que NINGUNA pantalla decida estas reglas por su cuenta — todas
// las pantallas comerciales pasan por estas funciones. El cálculo de precios
// real (impuestos, listas, descuentos por cantidad) sigue viviendo en
// `articlesApi.getPricingPreview` (backend) — esto es solo la capa de
// orquestación de línea.
// ============================================================================

import type { TPArticleLite } from "../components/ui/TPArticleVariantSearchSelect";
import type { CommercialContext } from "./commercial-engine";
import type { DocumentLine } from "./document-types";

// ── Constraints de cantidad ─────────────────────────────────────────────────

export type QuantityConstraints = {
  /** Mínima cantidad vendible (>0). undefined si no aplica. */
  min?: number;
  /** Máxima cantidad vendible (>0). undefined si no aplica. */
  max?: number;
  /** Paso de cuantización. Default 1 (unidades enteras). */
  step: number;
  /** Cantidad inicial al pickear el ítem. Default 1. */
  default: number;
};

/**
 * Devuelve las restricciones de cantidad para un ítem. La pantalla puede
 * pasar las desde el item ya expandido (TPArticleLite) o por separado.
 *
 * Reglas:
 *   - step: el del ítem o 1.
 *   - default: el del ítem; si no, max(min, 1) cuantizado al step.
 *   - min/max: pasan tal cual.
 */
export function resolveQuantityConstraints(
  item: TPArticleLite | null | undefined,
  _ctx?: CommercialContext,
): QuantityConstraints {
  const step = numericOr(item?.quantityStep, 1);
  const min  = numericOr(item?.minQty, undefined);
  const max  = numericOr(item?.maxQty, undefined);

  // default: explícito del ítem; si no, el mínimo (o 1) cuantizado al step.
  const explicitDefault = numericOr(item?.defaultQty, undefined);
  const fallbackDefault = Math.max(min ?? 0, 1);
  const dflt = quantize(explicitDefault ?? fallbackDefault, step);

  return { min, max, step, default: dflt };
}

/**
 * Cantidad inicial a usar cuando se pickea el ítem por primera vez. Ignora
 * el max (si min > max no es trabajo del editor decidir, lo señala la
 * validación visual).
 */
export function resolveDefaultQuantity(
  item: TPArticleLite | null | undefined,
  ctx?: CommercialContext,
): number {
  const c = resolveQuantityConstraints(item, ctx);
  return c.default;
}

/**
 * Normaliza una cantidad nueva: la cuantiza al step y la limita al rango
 * [min, max]. Devuelve la cantidad final + flags de qué pasó.
 *
 * Reglas:
 *   - Si qty es NaN o no finito → fallback al default.
 *   - Cuantiza al step (redondeo al múltiplo más cercano).
 *   - Si quedó < min → clamp a min.
 *   - Si quedó > max → clamp a max.
 *   - Devuelve `clampedLow / clampedHigh / quantized` para que la UI muestre
 *     un aviso si fue necesario.
 */
export function applyQuantityChange(
  qtyRaw: number,
  constraints: QuantityConstraints,
): { quantity: number; clampedLow: boolean; clampedHigh: boolean; quantized: boolean } {
  if (!Number.isFinite(qtyRaw)) {
    return { quantity: constraints.default, clampedLow: false, clampedHigh: false, quantized: false };
  }

  const stepped = quantize(qtyRaw, constraints.step);
  const quantized = stepped !== qtyRaw;

  let q = stepped;
  let clampedLow = false;
  let clampedHigh = false;
  if (constraints.min != null && q < constraints.min) { q = constraints.min; clampedLow = true; }
  if (constraints.max != null && q > constraints.max) { q = constraints.max; clampedHigh = true; }

  return { quantity: q, clampedLow, clampedHigh, quantized };
}

/**
 * Verifica si una cantidad cumple las constraints sin modificarla.
 * Pensado para mostrar un aviso visual sin auto-corregir.
 */
export function checkQuantityViolations(
  qty: number,
  constraints: QuantityConstraints,
): { belowMin: boolean; aboveMax: boolean; offStep: boolean } {
  if (!Number.isFinite(qty)) {
    return { belowMin: false, aboveMax: false, offStep: false };
  }
  const stepped = quantize(qty, constraints.step);
  return {
    belowMin: constraints.min != null && qty < constraints.min,
    aboveMax: constraints.max != null && qty > constraints.max,
    offStep:  Math.abs(stepped - qty) > 1e-9,
  };
}

// ── Normalización de línea desde un ítem ────────────────────────────────────

export type LinePatchFromItem = Pick<
  DocumentLine,
  | "articleId" | "variantId" | "sku" | "itemKind"
  | "article" | "variant" | "description" | "imageUrl" | "images"
> & {
  /** ¿La línea administra stock? Para ocultar selector almacén en servicios. */
  manageStock: boolean;
  /** Constraints de cantidad — para que el editor sepa min/max/step. */
  quantityConstraints: QuantityConstraints;
  /** Cantidad inicial sugerida (= constraints.default). */
  initialQuantity: number;
};

/**
 * Construye el patch para "rellenar" una línea con los datos de un ítem
 * recién pickeado. NO calcula precio acá — eso queda para el llamador, que
 * después invoca al pricing-preview real.
 */
export function normalizeLineFromItem(
  item: TPArticleLite,
  ctx?: CommercialContext,
): LinePatchFromItem {
  const constraints = resolveQuantityConstraints(item, ctx);
  const itemKind: NonNullable<DocumentLine["itemKind"]> =
    item.itemKind ?? (item.variantId ? "ARTICLE_VARIANT" : "ARTICLE_SIMPLE");
  // manageStock: si el ítem lo declaró → ese; sino lo derivamos del kind.
  const manageStock =
    typeof item.manageStock === "boolean"
      ? item.manageStock
      : itemKind !== "SERVICE";

  return {
    articleId:    item.id,
    variantId:    item.variantId,
    sku:          item.sku || item.code,
    itemKind,
    article:      item.article,
    variant:      item.variant ?? "",
    description:  item.description,
    imageUrl:     item.imageUrl,
    images:       item.images,
    manageStock,
    quantityConstraints: constraints,
    initialQuantity:     constraints.default,
  };
}

// ── Args para pricing preview ───────────────────────────────────────────────

/** Forma de los args que `articlesApi.getPricingPreview` acepta. */
export type PricingPreviewArgs = {
  variantId?: string;
  clientId?:  string;
  quantity:   number;
  priceListId?: string;
};

/**
 * Arma los args para el endpoint de pricing-preview a partir de la línea + ctx.
 * Filtra `priceListId` si no parece un id real (ej. "retail" mock).
 */
export function buildPricingPreviewArgs(
  line: Pick<DocumentLine, "variantId" | "quantity">,
  ctx: CommercialContext,
): PricingPreviewArgs {
  const out: PricingPreviewArgs = {
    quantity: Math.max(0, Number(line.quantity) || 0),
  };
  if (line.variantId)  out.variantId  = line.variantId;
  if (ctx.clientId)    out.clientId   = ctx.clientId;
  if (looksLikeId(ctx.priceListId)) out.priceListId = ctx.priceListId;
  return out;
}

// ── Helpers privados ────────────────────────────────────────────────────────

function numericOr<T extends number | undefined>(v: number | undefined, fallback: T): T extends number ? number : number | undefined {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v as any;
  return fallback as any;
}

/**
 * Cuantiza al múltiplo más cercano de step. Tolera errores de punto flotante
 * redondeando a 6 decimales (suficiente para gramos/centímetros).
 */
function quantize(n: number, step: number): number {
  if (!Number.isFinite(n) || step <= 0) return n;
  const k = Math.round(n / step);
  const out = k * step;
  // Normalizar epsilons (ej. 0.1 + 0.2 = 0.30000000000000004).
  return Math.round(out * 1e6) / 1e6;
}

/** Heurística: ¿la cadena parece un id real (CUID/UUID) y no un mock label? */
function looksLikeId(s?: string): s is string {
  if (!s) return false;
  if (s.length < 12) return false;
  // CUID empieza con 'c' + alfanumérico; UUID tiene dashes. Filtramos labels
  // como "retail" / "mayorista" que son < 12 chars o todo letras.
  return /[a-z0-9]/i.test(s) && /[0-9-]/.test(s);
}
