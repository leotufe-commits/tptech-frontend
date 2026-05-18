// src/components/pricing/PriceCompositionCards/helpers.ts
// ============================================================================
// Helpers internos del bloque "Cards de Composición del precio".
//
// REGLA CRÍTICA (POLICY R6): estas funciones NO calculan valores económicos.
// Realizan AGREGACIONES y MAPEOS sobre datos que el motor ya atomizó.
//
// Reutiliza:
//   - `buildLineSaleByCostLineIdMap` (PricingStepsBreakdown/helpers) —
//     mismo mapa canónico de costLineId → lineSale.
//
// Centraliza:
//   - `computeMetalSaleFactor` / `computeHechuraSaleFactor` — ratios del motor.
//   - `buildMetalSaleMap` — agregación por metal padre (paralelo de
//     `buildMetalPadreMap` del CostCompositionBlock, pero en sale-side).
//   - `computeHechuraSaleTotal` — total hechura side venta.
//   - `buildHechuraAdjustments` — combina componentSaleBreakdown.hechura.adjustments
//     con discStep/promoStep meta (con dedupe por kind).
//   - `buildSaleTaxLines` — distribución impuesto entre metal/hechura.
// ============================================================================

import { selectPriceHechuraSteps, selectMetalQuoteSteps } from "../PricingStepsBreakdown/helpers";
import type { LineSaleByCostLineId } from "../PricingStepsBreakdown/types";
import type {
  MetalSaleParent,
  MetalSaleVariant,
  HechuraAdjustment,
  SaleTaxLine,
} from "./types";
import type { PricingStepResult } from "../../../services/articles";

// Re-export del label resolver (vive en TPPriceCompositionKpis y lo usa el motor del card).
// Lo importamos lazy para no introducir un coupling fuerte; los consumidores
// del orchestrator pasan `adjustments` ya con `label` resuelto a través de
// este helper.
import { resolveAdjustmentLabel } from "../../ui/TPPriceCompositionKpis";

// ─── Re-exports de selectores ──────────────────────────────────────────────

export { selectPriceHechuraSteps, selectMetalQuoteSteps };

// ─── Cálculos de factores (ratios del motor) ───────────────────────────────
// FÓRMULA CANÓNICA ÚNICA: viven en `saleCompositionDisplay.ts` (módulo de
// display compartido) y se re-exportan acá para no romper callers ni duplicar.
// Misma definición que usa la Factura (header METALES) → paridad garantizada.
export {
  computeMetalSaleFactor,
  computeHechuraSaleFactor,
} from "../../../lib/pricing/display/saleCompositionDisplay";

// ─── Agregación: metal padres con variantes ────────────────────────────────

/**
 * Agrupa los pasos de metal por metal padre y arma cada variante con su
 * `saleLine` canónico (composition.metals[i].lineSale) o fallback
 * (qCost × gSF).
 *
 * Equivalente al `buildMetalPadreMap` del CostCompositionBlock pero en
 * sale-side. NO recalcula precios — usa los `lineSale` ya emitidos.
 */
export function buildMetalSaleMap(args: {
  steps:                 PricingStepResult[];
  lineSaleByCostLineId:  LineSaleByCostLineId;
  saleEntityMermaMap:    Map<string, number>;
  metalSaleFactor:       number | null;
}): Map<string, MetalSaleParent> {
  const { steps, lineSaleByCostLineId, saleEntityMermaMap, metalSaleFactor } = args;
  const pMetalSteps = selectMetalQuoteSteps(steps);
  const ppMap = new Map<string, MetalSaleParent>();

  for (const step of pMetalSteps) {
    const m: any  = (step as any).meta ?? {};
    const qCost   = (step as any).value != null ? parseFloat(String((step as any).value)) : 0;
    const isMMHP  = (step as any).key !== "COST_LINES_METAL";
    const qty     = isMMHP
      ? (m.grams != null ? parseFloat(String(m.grams)) : m.qty != null ? parseFloat(String(m.qty)) : 0)
      : (m.qty   != null ? parseFloat(String(m.qty))   : m.grams != null ? parseFloat(String(m.grams)) : 0);
    const pur     = m.purity != null ? parseFloat(String(m.purity)) : null;
    // En el bloque de PRECIO: usar merma de entidad si hay override
    const vidP    = String(m.variantId ?? "");
    const entMerP = saleEntityMermaMap.get(vidP);
    const mer     = entMerP != null ? entMerP : (m.merma != null ? parseFloat(String(m.merma)) : 0);
    const mermaMulP = mer !== 0 ? (1 + mer / 100) : 1;
    // Para METAL_QUOTE (METAL_MERMA_HECHURA): saleFactor incluido en venta.
    // Para COST_LINES_METAL: saleFactor excluido del costo.
    const sfValP  = isMMHP && m.saleFactor != null ? parseFloat(String(m.saleFactor)) : 1;
    const equivGr = pur != null ? qty * pur * sfValP * mermaMulP : qty * sfValP * mermaMulP;
    const factor  = qty > 0.0001 ? equivGr / qty : (pur != null ? pur * sfValP * mermaMulP : sfValP * mermaMulP);

    const cliId = m.costLineId != null ? String(m.costLineId) : null;
    const canonicalSale = cliId ? lineSaleByCostLineId.get(cliId) : undefined;
    const saleLine = canonicalSale != null
      ? canonicalSale
      : qCost * (metalSaleFactor ?? 1);

    const gKey = (m.metalId as string | null) ?? (m.metalName as string | null) ?? "Metal";
    const prev: MetalSaleParent = ppMap.get(gKey) ?? {
      displayName: String(m.metalName ?? "Metal"),
      symbol:      (m.metalSymbol ?? null) as string | null,
      totalCost:   0,
      totalEquivGr: 0,
      variants:    [],
    };
    prev.totalCost    += saleLine;
    prev.totalEquivGr += equivGr;
    const quotePr = m.quotePrice != null ? parseFloat(String(m.quotePrice))
                  : m.price      != null ? parseFloat(String(m.price))
                  : null;
    const variant: MetalSaleVariant = {
      qty,
      factor,
      equivGr,
      purity:      pur,
      merma:       mer > 0 ? mer : null,
      saleFactor:  sfValP !== 1 ? sfValP : null,
      sku:         (m.variantSku as string | null | undefined) ?? null,
      variantName: (m.variantName as string | null | undefined) ?? null,
      quotePrice:  quotePr,
      saleLine,
    };
    prev.variants.push(variant);
    ppMap.set(gKey, prev);
  }

  return ppMap;
}

// ─── Total de hechura side venta ───────────────────────────────────────────

/**
 * Suma de hechSale por línea: preferimos `lineSale` canónico (motor) sobre
 * `step.value × gHSF` (fallback legacy).
 *
 * Retorna null cuando no hay hechura para calcular.
 */
export function computeHechuraSaleTotal(args: {
  steps:                PricingStepResult[];
  lineSaleByCostLineId: LineSaleByCostLineId;
  hechuraSaleFactor:    number | null;
  hechuraCostRaw:       number | null;
}): number | null {
  const { steps, lineSaleByCostLineId, hechuraSaleFactor, hechuraCostRaw } = args;
  const pHechSteps = selectPriceHechuraSteps(steps);

  if (pHechSteps.length > 0) {
    return pHechSteps.reduce((s: number, step: any) => {
      const cli = step?.meta?.costLineId != null ? String(step.meta.costLineId) : null;
      const ls  = cli ? lineSaleByCostLineId.get(cli) : undefined;
      const stepVal = parseFloat(String(step.value));
      return s + (ls != null ? ls : stepVal * (hechuraSaleFactor ?? 1));
    }, 0);
  }
  if ((hechuraCostRaw ?? 0) > 0.001) {
    return (hechuraCostRaw ?? 0) * (hechuraSaleFactor ?? 1);
  }
  return null;
}

// ─── Ajustes que se imputan a hechura ──────────────────────────────────────

/**
 * Combina los ajustes que el motor IMPUTÓ a hechura
 * (`componentSaleBreakdown.hechura.adjustments`) con los descuentos
 * top-level (`quantityDiscountAmount`, `promotionDiscountAmount`) que el
 * motor reportó a nivel TOTAL.
 *
 * Dedupe por `kind`: si el mismo kind ya viene en csb, no se duplica
 * desde meta. Passthrough puro (cero matemática).
 */
export function buildHechuraAdjustments(args: {
  result: {
    componentSaleBreakdown?: { hechura?: { adjustments?: unknown[] | null } | null } | null;
    quantityDiscountAmount?: number | string | null;
    promotionDiscountAmount?: number | string | null;
    appliedPromotionName?:    string | null;
  } | null;
  discStep:  PricingStepResult | undefined;
  promoStep: PricingStepResult | undefined;
}): HechuraAdjustment[] {
  const { result, discStep, promoStep } = args;
  const csbHechura: any = (result as any)?.componentSaleBreakdown?.hechura ?? null;

  const csbAdjustments: HechuraAdjustment[] = Array.isArray(csbHechura?.adjustments)
    ? csbHechura.adjustments.map((a: any): HechuraAdjustment => ({
        ...a,
        label:  resolveAdjustmentLabel(a),
        amount: Number(a.amount ?? 0),
      }))
    : [];
  const csbKinds = new Set(csbAdjustments.map(a => a.kind));
  const metaAdjustments: HechuraAdjustment[] = [];

  const qtyDiscAmt = (result as any)?.quantityDiscountAmount != null
    ? parseFloat(String((result as any).quantityDiscountAmount)) : 0;
  if (Number.isFinite(qtyDiscAmt) && qtyDiscAmt > 0 && !csbKinds.has("QUANTITY_DISCOUNT")) {
    const dm: any = (discStep as any)?.meta ?? {};
    const dBase = dm.discountBase != null ? parseFloat(String(dm.discountBase)) : null;
    const dPct  = dm.type === "PERCENTAGE" && dm.value != null
      ? parseFloat(String(dm.value)) : null;
    metaAdjustments.push({
      kind:       "QUANTITY_DISCOUNT",
      label:      resolveAdjustmentLabel({ kind: "QUANTITY_DISCOUNT" } as any),
      amount:     qtyDiscAmt,
      base:       Number.isFinite(dBase as number) ? dBase : null,
      percentage: Number.isFinite(dPct  as number) ? dPct  : null,
      valueType:  typeof dm.type === "string" ? dm.type : null,
    });
  }

  const promoAmt = (result as any)?.promotionDiscountAmount != null
    ? parseFloat(String((result as any).promotionDiscountAmount)) : 0;
  if (Number.isFinite(promoAmt) && promoAmt > 0 && !csbKinds.has("PROMOTION")) {
    const pm: any = (promoStep as any)?.meta ?? {};
    const promoName = (result as any)?.appliedPromotionName;
    const pBase = pm.discountBase != null ? parseFloat(String(pm.discountBase)) : null;
    const pPct  = pm.type === "PERCENTAGE" && pm.value != null
      ? parseFloat(String(pm.value)) : null;
    metaAdjustments.push({
      kind:       "PROMOTION",
      label:      promoName ? `Promoción: ${promoName}` : resolveAdjustmentLabel({ kind: "PROMOTION" } as any),
      amount:     promoAmt,
      base:       Number.isFinite(pBase as number) ? pBase : null,
      percentage: Number.isFinite(pPct  as number) ? pPct  : null,
      valueType:  typeof pm.type === "string" ? pm.type : null,
    });
  }

  // Orden final: meta primero (qty + promo), luego csb (entity rule, etc.).
  return [...metaAdjustments, ...csbAdjustments]
    .filter(a => Math.abs(a.amount) > 0.005);
}

// ─── Distribución de impuestos entre metal/hechura ─────────────────────────

/**
 * Distribuye cada impuesto de venta entre metal y hechura proporcionalmente
 * a sus bases.
 *
 * IMPORTANTE: el TOTAL del impuesto lo emite el motor en `taxBreakdown[].taxAmount`.
 * Acá lo splitteamos visualmente para mostrar "X sobre metal + Y sobre hechura".
 *
 * Análogo a `buildHechuraTaxLines` del CostCompositionBlock pero en sale-side.
 */
export function buildSaleTaxLines(args: {
  taxBreakdown:           Array<{ name?: string; rate?: number | string | null; taxAmount?: number | string | null }>;
  totalMetalSaleForTax:   number;
  hechuraSaleAdjusted:    number;
}): SaleTaxLine[] {
  const { taxBreakdown, totalMetalSaleForTax, hechuraSaleAdjusted } = args;
  const hasMetalSale = totalMetalSaleForTax > 0.001;
  return (taxBreakdown ?? [])
    .filter((t: any) => t.rate != null && parseFloat(String(t.rate)) > 0)
    .map((t: any): SaleTaxLine => {
      const rate        = parseFloat(String(t.rate));
      const metalPart   = hasMetalSale ? totalMetalSaleForTax * rate / 100 : 0;
      const hechuraPart = hechuraSaleAdjusted * rate / 100;
      const totalTax    = metalPart + hechuraPart;
      return { name: String(t.name ?? ""), rate, metalPart, hechuraPart, totalTax };
    })
    .filter(t => t.totalTax > 0.001);
}
