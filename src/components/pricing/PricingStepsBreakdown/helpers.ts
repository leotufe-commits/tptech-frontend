// src/components/pricing/PricingStepsBreakdown/helpers.ts
// ============================================================================
// Helpers internos del bloque "Flujo de construcción del precio".
//
// REGLA CRÍTICA (POLICY R6): estas funciones NO computan precios nuevos.
// Realizan filtros + agregaciones de display + lookups sobre datos que el
// motor ya emitió.
//
// Centraliza patrones que estaban inline en PricingSimulator.tsx, eliminando
// duplicaciones identificadas durante el mapeo (ej: `lineSaleByCostLineId`
// vivía en 2 lugares: precio base + composición del precio cards).
// ============================================================================

import type { PricingStepResult } from "../../../services/articles";
import type { NormalizedPricingLine } from "../../../lib/pricing/contract";
import type { LineSaleByCostLineId } from "./types";

// ─── Catálogos de display ──────────────────────────────────────────────────

/** Etiquetas cortas por modo de lista (display). */
export const PRICE_LIST_MODE_SHORT: Record<string, string> = {
  MARGIN_TOTAL:  "margen total",
  METAL_HECHURA: "metal+hechura",
  COST_PER_GRAM: "por gramo",
  FIXED:         "precio fijo",
};

/** Símbolos de dirección de redondeo. */
export const ROUNDING_DIR_SYMBOLS: Record<string, string> = {
  UP:      "↑",
  DOWN:    "↓",
  NEAREST: "≈",
};

/** Etiquetas legibles del modo de redondeo. */
export const ROUNDING_MODE_LABELS: Record<string, string> = {
  UNIT:           "unidad",
  TENS:           "decenas",
  HUNDREDS:       "centenas",
  THOUSANDS:      "miles",
  HALF_HUNDRED:   "medio centenar",
  CUSTOM:         "personalizado",
};

/** Etiquetas legibles para `appliesOn` de impuestos. */
export const TAX_APPLY_ON_LABELS: Record<string, string> = {
  TOTAL:   "total",
  METAL:   "metal",
  HECHURA: "hechura",
  PRODUCT: "producto",
  SERVICE: "servicio",
};

/** Etiquetas largas para el bloque informativo "Redondeo por artículo / lista". */
export const APPLIED_ROUNDING_APPLY_ON_LABEL: Record<string, string> = {
  PRICE: "Precio de lista",
  NET:   "Precio sin impuestos",
  TOTAL: "Total con impuestos",
};
export const APPLIED_ROUNDING_MODE_LABEL: Record<string, string> = {
  INTEGER:   "Entero",
  DECIMAL_1: "Décimo",
  DECIMAL_2: "Centavo",
  TEN:       "Decena",
  HUNDRED:   "Centena",
};
export const APPLIED_ROUNDING_DIRECTION_LABEL: Record<string, string> = {
  NEAREST: "Más cercano",
  UP:      "Hacia arriba",
  DOWN:    "Hacia abajo",
};

/** Conjunto de etiquetas genéricas — para detectar líneas sin nombre custom. */
export const PRICE_GENERIC_LABELS: ReadonlySet<string> = new Set([
  "Metal", "Hechura", "Producto", "Servicio", "Manual",
]);

/** Keys de COST_LINES_* que aportan al precio (excluye METAL puro y FINAL). */
export const PRICE_LINE_KEYS: ReadonlySet<string> = new Set([
  "COST_LINES_HECHURA",
  "COST_LINES_PRODUCT",
  "COST_LINES_SERVICE",
  "COST_LINES_MANUAL",
]);

// ─── Selectores de steps clave ─────────────────────────────────────────────

/** Step base del precio: lista, override de variante, override manual o fallback. */
export function selectBaseStep(steps: PricingStepResult[]): PricingStepResult | undefined {
  return steps.find((s: any) =>
    ["VARIANT_OVERRIDE", "PRICE_LIST", "MANUAL_OVERRIDE", "MANUAL_FALLBACK"].includes(s.key)
    && s.status === "ok"
  );
}

/** Step de descuento por cantidad. */
export function selectQuantityDiscountStep(steps: PricingStepResult[]): PricingStepResult | undefined {
  return steps.find((s: any) => s.key === "QUANTITY_DISCOUNT" && s.status === "ok");
}

/** Step de promoción. */
export function selectPromotionStep(steps: PricingStepResult[]): PricingStepResult | undefined {
  return steps.find((s: any) => s.key === "PROMOTION" && s.status === "ok");
}

/** Step de regla comercial de cliente (DISCOUNT/BONUS/SURCHARGE). */
export function selectEntityRuleStep(steps: PricingStepResult[]): PricingStepResult | undefined {
  return steps.find((s: any) => s.key === "ENTITY_COMMERCIAL_RULE" && s.status === "ok");
}

/** Step de redondeo (con preRounding en meta). */
export function selectRoundingStep(steps: PricingStepResult[]): PricingStepResult | undefined {
  return steps.find((s: any) => s.key === "ROUNDING" && s.status === "ok" && s.meta?.preRounding != null);
}

/** Step COMBO_COST (informativo, presente cuando el artículo es combo). */
export function selectComboCostStep(steps: PricingStepResult[]): PricingStepResult | undefined {
  return steps.find((s: any) => s.key === "COMBO_COST" && s.status !== "skipped");
}

/** Steps METAL_QUOTE filtrados (modo METAL_MERMA_HECHURA en venta). */
export function selectMetalQuoteSteps(steps: PricingStepResult[]): PricingStepResult[] {
  return steps.filter((s: any) =>
    (s.key === "METAL_QUOTE" || s.key === "COST_LINES_METAL")
    && s.status === "ok" && s.value != null
  );
}

/** Steps de hechura/producto/servicio/manual (modo COST_LINES). */
export function selectPriceHechuraSteps(steps: PricingStepResult[]): PricingStepResult[] {
  return steps.filter((s: any) =>
    PRICE_LINE_KEYS.has(s.key) && s.status === "ok" && s.value != null
  );
}

/** Step ENTITY_MERMA_SALE_ADJ — overrides de merma del cliente. */
export function selectEntityMermaSaleStep(steps: PricingStepResult[]): PricingStepResult | undefined {
  return steps.find((s: any) => s.key === "ENTITY_MERMA_SALE_ADJ" && s.status === "ok");
}

// ─── Constructores de mapas ────────────────────────────────────────────────

/**
 * Mapa canónico `costLineId → lineSale` desde `composition.*[]`.
 *
 * IMPORTANTE: el motor emite `lineSale` por línea atomizado en el snapshot v7+.
 * Este helper SOLO LO LEE — no recalcula. Si el snapshot es pre-v7 y no tiene
 * `lineSale`, el mapa queda vacío y el componente cae a fallback legacy
 * (factor global × cost) que vive en el sub-componente correspondiente.
 *
 * Resuelve la duplicación detectada durante el mapeo: vivía inline en 2
 * lugares de PricingSimulator (precio base + cards de composición).
 */
export function buildLineSaleByCostLineIdMap(
  line: NormalizedPricingLine | null,
): LineSaleByCostLineId {
  const map: LineSaleByCostLineId = new Map();
  const composition: any = line?.composition ?? null;
  if (!composition) return map;
  for (const arr of [composition.metals, composition.hechuras, composition.products, composition.services]) {
    if (!Array.isArray(arr)) continue;
    for (const it of arr) {
      if (it?.costLineId && it?.lineSale != null && Number.isFinite(Number(it.lineSale))) {
        map.set(String(it.costLineId), Number(it.lineSale));
      }
    }
  }
  return map;
}

/**
 * Mapa `variantId → mermaPercent` extraído del step ENTITY_MERMA_SALE_ADJ.
 * Cuando una entidad tiene merma override, el motor lo emite acá.
 */
export function buildSaleEntityMermaMap(
  steps: PricingStepResult[],
): Map<string, number> {
  const map = new Map<string, number>();
  const step = selectEntityMermaSaleStep(steps);
  const variants = (step as any)?.meta?.variants as Array<{ variantId: string; mermaPercent: number }> | undefined;
  if (Array.isArray(variants)) {
    for (const v of variants) {
      map.set(v.variantId, v.mermaPercent);
    }
  }
  return map;
}

// ─── Etiquetas de display ──────────────────────────────────────────────────

/** Devuelve la etiqueta del precio base según el origen del baseStep. */
export function getPriceBaseLabel(baseStep: PricingStepResult | undefined): string {
  if (!baseStep) return "Precio";
  const meta: any = (baseStep as any).meta ?? {};
  switch (baseStep.key) {
    case "VARIANT_OVERRIDE":  return "Precio de variante";
    case "MANUAL_OVERRIDE":
    case "MANUAL_FALLBACK":   return "Precio fijo manual";
    case "PRICE_LIST": {
      const name = meta.priceListName ? ` · ${String(meta.priceListName)}` : "";
      return `Precio de lista${name}`;
    }
    default:                  return "Precio";
  }
}

/** Devuelve la etiqueta del modo de la lista de precios aplicada. */
export function getPriceListModeShortLabel(mode: string | null | undefined): string {
  if (!mode) return "";
  return PRICE_LIST_MODE_SHORT[mode] ?? mode.toLowerCase();
}
