// src/components/pricing/CostCompositionBlock/helpers.ts
// ============================================================================
// Helpers internos del bloque de Composición del costo.
//
// REGLA CRÍTICA (POLICY R6): estas funciones NO computan valores económicos
// nuevos. Realizan AGREGACIONES y CLASIFICACIONES sobre datos que el motor
// ya emitió atomizados (steps[], metalHechuraBreakdown, costTaxBreakdown).
//
// Si alguna llega a recrear lógica del motor, es BUG arquitectónico — se
// reporta y se mueve al backend (POLICY).
//
// Centraliza agregaciones que estaban inline en PricingSimulator.tsx:
//   - metalPadreMap (4839-4896)
//   - adjFactorMetal + hechuraEquiv (4899-4923)
//   - hechuraTaxLines (5170-5179)
//
// Estas mismas agregaciones ahora pueden ser reusadas por los parts/
// sin recrearse (objetivo del usuario: "evitar recrear agregaciones").
// ============================================================================

import type { PricingStepResult } from "../../../services/articles";
import type { MetalPadreAccum, MetalVariantEquiv } from "./types";
import { metalEquivFactor } from "../../../lib/pricing/display/saleCompositionDisplay";

// ─── Catálogos de tipos ────────────────────────────────────────────────────

/**
 * Etiquetas display para los step keys de COST_LINES_*. Permite renderizar
 * "Metal" / "Hechura" / "Producto" / etc. sin hardcodear en cada componente.
 */
export const LINE_TYPE_NAMES: Record<string, string> = {
  COST_LINES_METAL:     "Metal",
  COST_LINES_HECHURA:   "Hechura",
  COST_LINES_PRODUCT:   "Producto",
  COST_LINES_SERVICE:   "Servicio",
  COST_LINES_MANUAL:    "Manual",
  COST_LINES_LOGISTICS: "Envío",
};

/** Set de etiquetas genéricas — usado para evitar mostrar "valores huérfanos"
 *  cuando el meta.lineLabel coincide con el nombre genérico del tipo. */
export const GENERIC_TYPE_LABELS: ReadonlySet<string> = new Set(Object.values(LINE_TYPE_NAMES));

/** Keys de COST_LINES_* — útil para filtrar steps. */
export const COST_LINE_KEYS: ReadonlySet<string> = new Set(Object.keys(LINE_TYPE_NAMES));

// ─── Helpers puros ─────────────────────────────────────────────────────────

/**
 * Revierte un ajuste applyAdjustment: dado el valor post-ajuste devuelve
 * el pre-ajuste. Pure function, sin side effects.
 *
 * Ejemplos:
 *   reverseLineAdj(90, "BONUS",   "PERCENTAGE", 10) === 100   // 90 = 100 × (1−0,1)
 *   reverseLineAdj(110, "SURCHARGE", "PERCENTAGE", 10) === 100  // 110 = 100 × (1+0,1)
 *   reverseLineAdj(95, "BONUS",   "FIXED_AMOUNT", 5) === 100   // 95 = 100 − 5
 */
export function reverseLineAdj(
  post: number,
  kind: string,
  type: string,
  val: number,
): number {
  if (type === "PERCENTAGE") {
    const f = kind === "BONUS" ? (1 - val / 100) : (1 + val / 100);
    return f !== 0 ? post / f : post;
  }
  if (type === "FIXED_AMOUNT") return kind === "BONUS" ? post + val : post - val;
  return post;
}

// ─── Filtros de steps ──────────────────────────────────────────────────────

/** Steps `COST_LINES_*` con status "ok" y value no nulo. */
export function selectAllLineSteps(steps: PricingStepResult[]): PricingStepResult[] {
  return steps.filter((s: any) =>
    COST_LINE_KEYS.has(s.key) && s.status === "ok" && s.value != null
  );
}

/** Steps `METAL_QUOTE` con status "ok" y value no nulo. Modo METAL_MERMA_HECHURA. */
export function selectMetalQuoteSteps(steps: PricingStepResult[]): PricingStepResult[] {
  return steps.filter((s: any) =>
    s.key === "METAL_QUOTE" && s.status === "ok" && s.value != null
  );
}

/** Step `HECHURA` con status "ok" y value no nulo (modo METAL_MERMA_HECHURA). */
export function selectHechuraMMHStep(steps: PricingStepResult[]): PricingStepResult | undefined {
  return steps.find((s: any) =>
    s.key === "HECHURA" && s.status === "ok" && s.value != null
  );
}

/** Step `COST_LINES_FINAL` (cierre con ajuste global, modo COST_LINES). */
export function selectCostLinesFinalStep(steps: PricingStepResult[]): PricingStepResult | undefined {
  return steps.find((s: any) =>
    s.key === "COST_LINES_FINAL" && s.status === "ok" && s.value != null
  );
}

// ─── Agregaciones ──────────────────────────────────────────────────────────

/**
 * Agrupa los pasos de metal por metal padre (Oro, Plata, etc.), calculando
 * para cada variante: factor (purity × (1+merma/100)), gramos equivalentes,
 * raw value.
 *
 * El motor ya emite cada paso atomizado (qty, purity, merma, quotePrice);
 * esta función SOLO los agrupa por metal padre y suma. Sin matemática
 * comercial — toda la matemática se hace sobre datos del response.
 */
export function buildMetalPadreMap(
  steps: PricingStepResult[],
): Map<string, MetalPadreAccum> {
  const all = selectAllLineSteps(steps);
  const sourceSteps = all.length > 0
    ? all.filter((s: any) => s.key === "COST_LINES_METAL")
    : selectMetalQuoteSteps(steps);

  const padreMap = new Map<string, MetalPadreAccum>();

  sourceSteps.forEach((step: any) => {
    const m     = step.meta ?? {};
    const isMMH = step.key !== "COST_LINES_METAL";
    const qty   = isMMH
      ? (m.grams != null ? parseFloat(String(m.grams)) : m.qty   != null ? parseFloat(String(m.qty))   : null)
      : (m.qty   != null ? parseFloat(String(m.qty))   : m.grams != null ? parseFloat(String(m.grams)) : null);
    if (qty == null || qty <= 0.0001) return;

    const purityVal     = m.purity     != null ? parseFloat(String(m.purity))     : null;
    const mermaVal      = m.merma      != null ? parseFloat(String(m.merma))      : null;
    const quotePriceVal = m.quotePrice != null ? parseFloat(String(m.quotePrice))
                       : m.price      != null ? parseFloat(String(m.price))       : null;

    // Fórmula canónica ÚNICA — compartida con la Factura
    // (saleCompositionDisplay.buildMetalParentTotals). NO inlinear acá:
    // garantiza paridad exacta Simulador ↔ Factura.
    const factor  = metalEquivFactor(purityVal, mermaVal);
    const equivGr = qty * factor;

    const rawVal = step.value != null ? parseFloat(String(step.value)) : 0;

    const groupKey: string = (m.metalId   as string | null | undefined)
                  ?? (m.metalName as string | null | undefined)
                  ?? (m.variantName as string | null | undefined)
                  ?? "Metal";
    const displayName: string = (m.metalName  as string | null | undefined)
                     ?? (m.variantName as string | null | undefined)
                     ?? "Metal";
    const metalSymbol: string | null = (m.metalSymbol as string | null | undefined) ?? null;

    const prev: MetalPadreAccum = padreMap.get(groupKey) ?? {
      parentId:       (m.metalId as string | null | undefined) ?? null,
      parentName:     displayName,
      variants:       [],
      totalCost:      0,
      totalGrams:     0,
      totalPureGrams: 0,
      totalEquivGr:   0,
    };

    const variant: MetalVariantEquiv = {
      variantId:    (m.variantId as string | null | undefined) ?? "",
      variantName:  (m.variantName as string | null | undefined) ?? displayName,
      variantSku:   (m.variantSku as string | null | undefined) ?? null,
      cost:         rawVal,
      grams:        qty,
      pureGrams:    purityVal != null ? qty * purityVal : null,
      pricePerGram: quotePriceVal,
      mermaPercent: mermaVal ?? 0,
    };
    prev.variants.push(variant);
    prev.totalCost      += rawVal;
    prev.totalGrams     += qty;
    prev.totalPureGrams += variant.pureGrams ?? 0;
    prev.totalEquivGr   += equivGr;
    padreMap.set(groupKey, prev);
    // ESLint: parentId no usado pero útil para selección downstream
    void prev.parentId; void metalSymbol;
  });

  return padreMap;
}

/**
 * Factor de ajuste global para metal — proporción entre lo que el motor
 * resolvió como `metalCost` (después de aplicar bonificación/recargo global
 * COST_LINES_FINAL) y la suma raw de los costos de metal.
 *
 * Si no hay ajuste, retorna 1. Sin matemática comercial — solo razón de
 * dos valores que el motor ya emitió.
 */
export function computeAdjFactorMetal(args: {
  metalHechuraBreakdown: { metalCost: number; hechuraCost: number } | null;
  metalPadreMap: Map<string, MetalPadreAccum>;
  allLineSteps: PricingStepResult[];
  unitCost: number | null;
}): number {
  const { metalHechuraBreakdown, metalPadreMap, allLineSteps, unitCost } = args;

  if (metalHechuraBreakdown && unitCost != null) {
    const totalRaw = Array.from(metalPadreMap.values())
      .reduce((a, v) => a + v.totalCost, 0);
    if (totalRaw > 0.001 && metalHechuraBreakdown.metalCost > 0.001) {
      return metalHechuraBreakdown.metalCost / totalRaw;
    }
    return 1;
  }
  if (allLineSteps.length > 0 && unitCost != null) {
    const mSum = allLineSteps
      .filter((s: any) => s.key === "COST_LINES_METAL")
      .reduce((a: number, s: any) => a + parseFloat(s.value), 0);
    const hSum = allLineSteps
      .filter((s: any) => s.key !== "COST_LINES_METAL")
      .reduce((a: number, s: any) => a + parseFloat(s.value), 0);
    const linesTotal = mSum + hSum;
    return linesTotal > 0.001 ? unitCost / linesTotal : 1;
  }
  return 1;
}

/**
 * Costo total de hechura derivado del breakdown del motor o de la suma de
 * líneas (modo COST_LINES) o del step HECHURA (modo METAL_MERMA_HECHURA).
 *
 * El backend YA computó el valor; esta función solo lo extrae del lugar
 * correcto según el modo activo.
 */
export function computeHechuraEquiv(args: {
  metalHechuraBreakdown: { metalCost: number; hechuraCost: number } | null;
  allLineSteps: PricingStepResult[];
  hechuraMMHStep: PricingStepResult | undefined;
  adjFactorMetal: number;
  unitCost: number | null;
}): number | null {
  const { metalHechuraBreakdown, allLineSteps, hechuraMMHStep, adjFactorMetal, unitCost } = args;

  if (metalHechuraBreakdown && unitCost != null) {
    return metalHechuraBreakdown.hechuraCost > 0.001 ? metalHechuraBreakdown.hechuraCost : null;
  }
  if (allLineSteps.length > 0 && unitCost != null) {
    const hSum = allLineSteps
      .filter((s: any) => s.key !== "COST_LINES_METAL")
      .reduce((a: number, s: any) => a + parseFloat(s.value), 0);
    return hSum > 0.001 ? hSum * adjFactorMetal : null;
  }
  if (hechuraMMHStep && unitCost != null) {
    const hSum = parseFloat(String(hechuraMMHStep.value));
    return hSum > 0.001 ? hSum : null;
  }
  return null;
}

// ─── Desglose de impuestos por componente ──────────────────────────────────

export type HechuraTaxLine = {
  name:        string;
  rate:        number;
  metalPart:   number;
  hechuraPart: number;
  totalTax:    number;
};

/**
 * Distribuye cada impuesto de costo entre METAL y HECHURA proporcionalmente
 * a sus bases.
 *
 * IMPORTANTE: este es un DESGLOSE VISUAL. El TOTAL del impuesto lo emite el
 * motor en `costTaxBreakdown[].taxAmount`. Acá solo lo splitteamos para
 * mostrar "X sobre metal + Y sobre hechura = Total".
 *
 * Si el motor en algún momento emite el split per-componente, esta función
 * deja de ser necesaria y se reemplaza por lectura directa.
 */
export function buildHechuraTaxLines(args: {
  taxItems:             Array<{ name?: string; rate?: number | string | null; taxAmount?: number | string | null }>;
  totalMetalCostForTax: number;
  hechuraEquiv:         number;
}): HechuraTaxLine[] {
  const { taxItems, totalMetalCostForTax, hechuraEquiv } = args;
  const hasMetalCost = totalMetalCostForTax > 0.001;
  return taxItems
    .filter((t) => t.rate != null && parseFloat(String(t.rate)) > 0)
    .map((t) => {
      const rate        = parseFloat(String(t.rate));
      const metalPart   = hasMetalCost ? totalMetalCostForTax * rate / 100 : 0;
      const hechuraPart = hechuraEquiv * rate / 100;
      const totalTax    = metalPart + hechuraPart;
      return { name: String(t.name ?? ""), rate, metalPart, hechuraPart, totalTax };
    })
    .filter((t) => t.totalTax > 0.001);
}
