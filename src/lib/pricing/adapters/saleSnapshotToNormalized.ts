// src/lib/pricing/adapters/saleSnapshotToNormalized.ts
// ============================================================================
// Adapter PURO: snapshot v6 (SalePreviewLine + pricingSnapshot) → shape que
// consumen <CostCompositionBlock> y <PricingStepsBreakdown>.
//
// REGLA DE ORO (POLICY R6): este archivo NO calcula valores económicos
// nuevos. Solo mapea CAMPOS del response del motor al shape interno de los
// componentes de pricing.
//
// El endpoint /sales/preview NO expone `steps[]` (a diferencia de
// /articles/pricing-preview). Para que los componentes funcionen igual en
// Factura, reconstruimos un array `steps[]` SINTÉTICO desde:
//   - composition.metals[]   → COST_LINES_METAL steps
//   - composition.hechuras[] → COST_LINES_HECHURA steps
//   - composition.products[] → COST_LINES_PRODUCT steps
//   - composition.services[] → COST_LINES_SERVICE steps
//   - pricingSnapshot.appliedPriceListId → PRICE_LIST step
//   - pricingSnapshot.appliedDiscountId → QUANTITY_DISCOUNT step
//   - pricingSnapshot.appliedPromotionId → PROMOTION step
//
// Esto es PURO REMAPEO: cada step lleva exactamente los valores que el motor
// ya emitió en otro shape. Sin matemática nueva.
//
// Cuando el backend exponga `steps[]` real en /sales/preview (deuda
// pendiente), este adapter pasa a ser passthrough trivial.
// ============================================================================

import type {
  NormalizedPricingLine,
} from "../contract";
import type { PricingStepResult } from "../../../services/articles";
import type { SalePreviewLine } from "../../../services/sales";
import { normalizeSalesLine } from "../normalizePricingPreviewResult";

export type SaleSnapshotAdapterResult = {
  /** Línea normalizada — drop-in para `<CostCompositionBlock line={...}>` y
   *  `<PricingStepsBreakdown line={...}>`. */
  line: NormalizedPricingLine;
  /** Steps sintéticos reconstruidos desde composition + snapshot. Drop-in
   *  para `<CostCompositionBlock steps={...}>` y `<PricingStepsBreakdown
   *  steps={...}>`. Cada step tiene `meta` con los campos que los
   *  componentes esperan (qty, grams, purity, merma, quotePrice, etc.). */
  steps: PricingStepResult[];
};

// ─── Constructores de steps sintéticos ─────────────────────────────────────

function makeStep(
  key: string,
  value: number | null,
  meta: Record<string, unknown> = {},
  status: "ok" | "skipped" | "missing" | "partial" = "ok",
): PricingStepResult {
  return {
    key,
    label: key,
    status,
    value: value != null ? String(value) : null,
    meta,
  } as unknown as PricingStepResult;
}

function buildMetalSteps(line: SalePreviewLine): PricingStepResult[] {
  const metals: any[] = (line.composition as any)?.metals ?? [];
  if (!Array.isArray(metals) || metals.length === 0) return [];
  return metals.map((m): PricingStepResult => makeStep("COST_LINES_METAL", m.lineCost, {
    qty:         m.appliedGrams,
    grams:       m.appliedGrams,
    quotePrice:  m.quotePrice,
    price:       m.quotePrice,
    purity:      m.purity,
    merma:       m.appliedMermaPct,
    metalId:     m.metalVariantId,
    metalName:   m.metalName,
    variantId:   m.metalVariantId,
    variantName: m.variantName ?? m.metalName,
    variantSku:  m.purityLabel ?? null,
    metalSymbol: null,
    costLineId:  m.costLineId,
  }));
}

function buildHechuraSteps(line: SalePreviewLine): PricingStepResult[] {
  const hechuras: any[] = (line.composition as any)?.hechuras ?? [];
  if (!Array.isArray(hechuras) || hechuras.length === 0) return [];
  return hechuras.map((h): PricingStepResult => makeStep("COST_LINES_HECHURA", h.lineCost, {
    lineLabel:     h.lineLabel,
    lineCode:      h.lineLabel,
    qty:           1,
    unitValue:     h.appliedAmount ?? h.lineCost,
    lineAdjKind:   h.lineAdjKind ?? null,
    lineAdjType:   h.lineAdjType ?? null,
    lineAdjValue:  h.lineAdjValue ?? null,
    costLineId:    h.costLineId,
  }));
}

function buildProductSteps(line: SalePreviewLine): PricingStepResult[] {
  const products: any[] = (line.composition as any)?.products ?? [];
  if (!Array.isArray(products) || products.length === 0) return [];
  return products.map((p): PricingStepResult => makeStep("COST_LINES_PRODUCT", p.lineCost ?? p.value ?? null, {
    lineLabel:     p.lineLabel ?? p.label,
    lineCode:      p.lineCode ?? p.lineLabel,
    qty:           p.quantity ?? p.qty,
    unitValue:     p.unitValue ?? p.appliedAmount,
    costLineId:    p.costLineId,
  }));
}

function buildServiceSteps(line: SalePreviewLine): PricingStepResult[] {
  const services: any[] = (line.composition as any)?.services ?? [];
  if (!Array.isArray(services) || services.length === 0) return [];
  return services.map((s): PricingStepResult => makeStep("COST_LINES_SERVICE", s.lineCost ?? s.value ?? null, {
    lineLabel:     s.lineLabel ?? s.label,
    lineCode:      s.lineCode ?? s.lineLabel,
    qty:           s.quantity ?? s.qty,
    unitValue:     s.unitValue ?? s.appliedAmount,
    costLineId:    s.costLineId,
  }));
}

function buildBaseStep(line: SalePreviewLine): PricingStepResult | null {
  if (line.basePrice == null) return null;
  // Resolver origen del precio base desde priceSource para el componente
  // PriceBaseSection (selector selectBaseStep busca por key).
  const ps = String(line.priceSource ?? "");
  let key: string = "PRICE_LIST";
  if (ps === "MANUAL_OVERRIDE" || ps === "MANUAL_LINE") key = "MANUAL_OVERRIDE";
  else if (ps === "MANUAL_FALLBACK") key = "MANUAL_FALLBACK";
  else if (ps === "VARIANT_OVERRIDE") key = "VARIANT_OVERRIDE";
  else if (ps === "PRICE_LIST") key = "PRICE_LIST";
  return makeStep(key, line.basePrice, {
    priceListName: line.appliedPriceListName,
    priceListId:   line.appliedPriceListId,
    mode:          line.appliedPriceListMode ?? null,
  });
}

function buildDiscountStep(line: SalePreviewLine): PricingStepResult | null {
  if (line.quantityDiscountAmount == null || line.quantityDiscountAmount <= 0) return null;
  if (line.appliedDiscountId == null) return null;
  // El "value" del step QUANTITY_DISCOUNT es el precio POST-descuento por unidad.
  const priceAfter = (line.basePrice ?? 0) - line.quantityDiscountAmount;
  return makeStep("QUANTITY_DISCOUNT", priceAfter, {
    discountAmount: line.quantityDiscountAmount,
    discountBase:   line.basePrice,
    // No tenemos type/value/scopeType desde el snapshot — se omiten meta
    // detalles. El componente degrada (no muestra "Base × % = ...").
  });
}

function buildPromotionStep(line: SalePreviewLine): PricingStepResult | null {
  if (line.promotionDiscountAmount == null || line.promotionDiscountAmount <= 0) return null;
  if (line.appliedPromotionId == null) return null;
  const qdAfter = line.quantityDiscountAmount != null && line.quantityDiscountAmount > 0
    ? (line.basePrice ?? 0) - line.quantityDiscountAmount
    : line.basePrice;
  const priceAfter = (qdAfter ?? 0) - line.promotionDiscountAmount;
  return makeStep("PROMOTION", priceAfter, {
    discountAmount: line.promotionDiscountAmount,
    discountBase:   qdAfter,
    // scope/type/value no disponibles desde el snapshot — se omiten.
  });
}

// ─── Entry point ───────────────────────────────────────────────────────────

/**
 * Mapea una `SalePreviewLine` (con `pricingSnapshot` embebido y `composition`
 * opcional) al shape consumido por los componentes de `src/components/pricing/`.
 *
 * Cuando la línea proviene de:
 *   - DRAFT (POST /sales/preview): `line.composition` viene completa (v6+).
 *   - CONFIRMED (read-only desde DB): si el snapshot es v6+, la composition
 *     también viene; pre-v6, los arrays vienen vacíos y los componentes
 *     degradan a fallback simple (sin desglose).
 *
 * No realiza matemática: cada step sintético lleva exactamente los valores
 * que el motor ya resolvió y empaquetó en `composition.*[]`.
 */
export function saleSnapshotToNormalized(line: SalePreviewLine): SaleSnapshotAdapterResult {
  const normalized = normalizeSalesLine(line);

  const baseStep      = buildBaseStep(line);
  const metalSteps    = buildMetalSteps(line);
  const hechuraSteps  = buildHechuraSteps(line);
  const productSteps  = buildProductSteps(line);
  const serviceSteps  = buildServiceSteps(line);
  const discStep      = buildDiscountStep(line);
  const promoStep     = buildPromotionStep(line);

  const steps: PricingStepResult[] = [
    ...(baseStep ? [baseStep] : []),
    ...metalSteps,
    ...hechuraSteps,
    ...productSteps,
    ...serviceSteps,
    ...(discStep  ? [discStep]  : []),
    ...(promoStep ? [promoStep] : []),
  ];

  return { line: normalized, steps };
}
