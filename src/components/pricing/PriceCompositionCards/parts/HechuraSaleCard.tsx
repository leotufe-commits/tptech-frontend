// src/components/pricing/PriceCompositionCards/parts/HechuraSaleCard.tsx
// ============================================================================
// Card "Hechura" en venta (modo DESGLOSADO). Contenedor del componente
// hechura + ajustes del motor + impuestos + redondeo + cierre del producto
// (cupón / canal / pago / envío / total a cobrar).
//
// Origen: PricingSimulator.tsx:4813-5388.
//
// SSOT del header: `displaySaleTotal` se calcula como `totalWithTax − Σ(Metales)`
// — garantiza por construcción que `Σ Metales + Hechura = Total producto`.
// El desglose interno NO se recalcula desde sus partes.
//
// Read-only — toda la matemática es del motor; aquí solo se renderizan
// valores ya emitidos (lineSale, taxBreakdown, channelAmount, etc.).
// ============================================================================

import React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../../ui/tp";
import { formatMoneyDisplay, formatDecimal, formatDecimalUpTo } from "../../../../lib/pricing/format";
import { vt } from "../../../../lib/pricing/visualTokens";
import {
  buildFactorBreakdown,
  extractCostAdjustmentFromSteps,
} from "../../../../lib/pricing-factor-display";
import FactorBreakdownHint from "../../../ui/FactorBreakdownHint";
import { trackLegacyPricingPath } from "../../../../lib/pricing-legacy-telemetry";
import { ROUNDING_DIR_SYMBOLS } from "../../PricingStepsBreakdown/helpers";
import { PRICE_GENERIC_LABELS as PGENLABELS } from "../../PricingStepsBreakdown/helpers";
import type {
  HechuraAdjustment,
  SaleTaxLine,
  MetalSaleParent,
} from "../types";
import type { LineSaleByCostLineId } from "../../PricingStepsBreakdown/types";
import type {
  PricingStepsDisplay,
  PricingStepsChannelInfo,
  PricingStepsPaymentInfo,
} from "../../PricingStepsBreakdown/types";
import type { PricingStepResult, PricingPreviewResult } from "../../../../services/articles";

const STEP_TYPE_LABEL: Record<string, string> = {
  COST_LINES_HECHURA:   "Hechura",
  COST_LINES_PRODUCT:   "Producto",
  COST_LINES_SERVICE:   "Servicio",
  COST_LINES_MANUAL:    "Manual",
  COST_LINES_LOGISTICS: "Envío",
};

export type HechuraSaleCardProps = {
  /** Pasos de hechura/producto/servicio/manual. */
  pHechSteps:               PricingStepResult[];
  /** Total hechura venta (pre-ajustes). De `computeHechuraSaleTotal`. */
  hechuraSaleTotal:         number;
  /** Mapa de saleLine canónicos. */
  lineSaleByCostLineId:     LineSaleByCostLineId;
  /** Factor venta de hechura — fallback retrocompat. */
  hechuraSaleFactor:        number | null;
  /** Margen % hechura del motor — para FactorBreakdownHint. */
  hechuraMarginPct:         number;
  /** Cuando el motor opera en modo derivado (MARGIN_TOTAL / PROPORTIONAL_COST /
   *  SERVICE_AS_HECHURA / MANUAL_AS_HECHURA / COMBO_COMPONENTS), el
   *  `hechuraMarginPct` viene 0 a propósito y los `lineSale` por componente
   *  colapsan al `lineCost`. En ese caso reusamos el `unifiedFactor` del
   *  artículo (= basePrice/unitCost) para mostrar la misma fórmula visual
   *  `cost × factor = venta` que el modo desglosado. Default false →
   *  comportamiento idéntico al anterior. */
  isMarginUnattributable?:  boolean;
  /** Factor unificado del artículo (basePrice/unitCost). Solo se usa cuando
   *  `isMarginUnattributable` es true y la fila viene con `lineSale ≈
   *  lineCost`. Si es null o ≈ 1 no se reemplaza nada. */
  unifiedFactor?:           number | null;
  /** Steps completos — para extractCostAdjustmentFromSteps. */
  steps:                    PricingStepResult[];
  /** Ajustes que se imputan a hechura (qty/promo/entity rule). */
  adjustments:              HechuraAdjustment[];
  /** Total metal venta (suma de todos los padres). */
  metalSaleEntries:         MetalSaleParent[];
  /** Desglose de impuestos (metal + hechura). */
  saleTaxLines:             SaleTaxLine[];
  /** Step de redondeo — pre/post tax, lo decide el motor. */
  rndStep:                  PricingStepResult | undefined;
  /** baseStep para detectar combo. */
  baseStep:                 PricingStepResult | undefined;
  /** Resultado del motor (channel/coupon/checkout/shipping/totalWithTax). */
  result:                   Pick<PricingPreviewResult,
    | "channelResult" | "couponResult" | "checkoutResult"
    | "shippingResult" | "totalWithTax">
    | null;
  /** Modo what-if — oculta ajustes globales. */
  whatIfActive:             boolean;
  /** Cantidad para totales por unidad. */
  quantity:                 number;
  /** Display config. */
  display:                  PricingStepsDisplay;
  /** Info canal / pago. */
  channel:                  PricingStepsChannelInfo | null;
  payment:                  PricingStepsPaymentInfo | null;
  /** Estado de expansión del card. */
  expanded:                 boolean;
  onToggle:                 () => void;
};

export function HechuraSaleCard(props: HechuraSaleCardProps): React.ReactElement {
  const {
    pHechSteps, hechuraSaleTotal, lineSaleByCostLineId, hechuraSaleFactor,
    hechuraMarginPct, isMarginUnattributable = false, unifiedFactor = null,
    steps, adjustments, metalSaleEntries, saleTaxLines,
    rndStep, baseStep, result, whatIfActive, quantity, display,
    channel, payment, expanded, onToggle,
  } = props;
  const fm = (v: number) => formatMoneyDisplay(v, display.rate, display.symbol);

  const totalMetalSaleForTax = metalSaleEntries.reduce((acc, p) => acc + p.totalCost, 0);
  const hasMetalSale = totalMetalSaleForTax > 0.001;
  const totalAdjustments = adjustments.reduce((s, a) => s + a.amount, 0);
  const hasAdjustments = adjustments.length > 0;
  const hechSaleAdjusted = hechuraSaleTotal - totalAdjustments;
  const allSaleTaxTotal = saleTaxLines.reduce((a, t) => a + t.totalTax, 0);
  const rndDiff = rndStep?.value != null && (rndStep as any).meta?.preRounding != null
    ? parseFloat(String(rndStep.value)) - parseFloat(String((rndStep as any).meta.preRounding))
    : 0;
  const hasRounding = Math.abs(rndDiff) > 0.001;

  // SSOT: header del card = Total producto − Σ(Metales).
  const productTotalRawAll = result?.totalWithTax != null
    ? parseFloat(String(result.totalWithTax))
    : null;
  const displaySaleTotal = productTotalRawAll != null
    ? productTotalRawAll - totalMetalSaleForTax
    : hechSaleAdjusted + allSaleTaxTotal + rndDiff;

  // Cierre del producto — ajustes post-product (cupón, canal, pago, envío).
  const couponDiscRaw = !whatIfActive && (result?.couponResult as any)?.applied
    ? ((result?.couponResult as any)?.discountAmount ?? 0)
    : 0;
  const channelRaw    = !whatIfActive ? ((result?.channelResult as any)?.channelAmount ?? 0) : 0;
  const qtyHC         = Math.max(quantity ?? 1, 1);
  const crHC: any     = result?.checkoutResult ?? null;
  const hasPayHC      = !whatIfActive && crHC != null && crHC.paymentAdjustment != null && crHC.paymentAdjustment !== 0;
  const paymentRaw    = hasPayHC ? crHC!.paymentAdjustment / qtyHC : 0;
  const shippingRaw   = (result?.shippingResult as any)?.amount ?? 0;
  const hasAnyFinalAdj = couponDiscRaw > 0.005
    || Math.abs(channelRaw) > 0.005
    || Math.abs(paymentRaw) > 0.005
    || result?.shippingResult != null;
  const finalCardTotal = displaySaleTotal + channelRaw - couponDiscRaw + paymentRaw + shippingRaw;

  // Resumen colapsado para la cabecera
  const summaryParts: string[] = [];
  if (pHechSteps.length > 0)    summaryParts.push(`${pHechSteps.length} línea${pHechSteps.length === 1 ? "" : "s"}`);
  if (hasAdjustments)           summaryParts.push("ajustes");
  if (saleTaxLines.length > 0)  summaryParts.push("impuestos");
  if (hasRounding)              summaryParts.push("redondeo");
  const collapsedSummary = summaryParts.length > 0
    ? `Incluye ${summaryParts.join(" · ")}`
    : null;

  return (
    <div className={vt.card.inner}>
      {/* ── Cabecera ── */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-2 group cursor-pointer"
      >
        <p className={cn(vt.text.cardName, vt.colors.cardName, "mt-0.5 shrink-0")}>
          Hechura
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <p className="text-base tabular-nums font-bold text-foreground/90 leading-none text-right">
            {fm(finalCardTotal)}
          </p>
          <ChevronDown size={14} className={cn(vt.colors.formula, "transition-transform mt-0.5", expanded && "rotate-180")} />
        </div>
      </button>
      {!expanded && collapsedSummary && (
        <p className={cn(vt.text.subLabel, vt.colors.labelSoft, "italic leading-none pt-0.5")}>
          {collapsedSummary}
        </p>
      )}

      {/* ── DETALLE TÉCNICO — colapsable ── */}
      {expanded && (
        <>
          {/* ── Origen — combo vs líneas COST_LINES ── */}
          {(baseStep?.key === "COMBO_BASE" && Array.isArray((baseStep as any)?.meta?.components) && ((baseStep as any).meta.components as any[]).length > 0) ? (
            <div className="border-t border-border/20 pt-1.5 space-y-0">
              <p className={cn(vt.text.label, "font-semibold uppercase tracking-widest mb-1", vt.colors.formula)}>
                Componentes del combo
              </p>
              <div className={cn("space-y-1", vt.text.label)}>
                {((baseStep as any).meta.components as any[]).map((c: any, ci: number) => {
                  const hasDiscount = c.unitPriceGross != null && c.discountAmount > 0;
                  return (
                    <div key={`combo-card-c-${ci}`} className="leading-snug">
                      <div className={vt.row.flexBetween}>
                        <span className={cn(vt.text.label, "font-medium min-w-0 truncate", vt.colors.label)}>
                          {c.name ?? "Componente"}
                          {c.code && <span className={cn("ml-1 text-[10px] font-mono", vt.colors.formulaFaint)}>· {c.code}</span>}
                        </span>
                        <span className={cn(vt.text.rowAmount, vt.colors.subtotalStrong, "shrink-0")}>
                          {fm(Number(c.lineTotal ?? 0))}
                        </span>
                      </div>
                      {hasDiscount ? (
                        <p className={cn(vt.text.formulaCompact, vt.colors.label, "mt-0.5")}>
                          {formatDecimalUpTo(Number(c.quantity), 4)} ×{" "}
                          <span className="line-through text-muted/50">{fm(Number(c.unitPriceGross))}</span>{" "}
                          →{" "}
                          <span className={vt.colors.bonus}>
                            −{c.discountPercent != null ? `${formatDecimal(Number(c.discountPercent), c.discountPercent % 1 === 0 ? 0 : 2)}%` : fm(Number(c.discountAmount))}
                          </span>{" "}
                          = {fm(Number(c.unitPrice))}
                        </p>
                      ) : c.unitPrice != null && (
                        <p className={cn(vt.text.formulaCompact, vt.colors.label, "mt-0.5")}>
                          {formatDecimalUpTo(Number(c.quantity), 4)} × {fm(Number(c.unitPrice))} = {fm(Number(c.lineTotal ?? 0))}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : pHechSteps.length > 0 && (
            <div className="border-t border-border/20 pt-1.5 space-y-0">
              <p className={cn(vt.text.label, "font-semibold uppercase tracking-widest mb-1", vt.colors.formula)}>Origen</p>
              <div className={cn("space-y-1", vt.text.label)}>
                {pHechSteps.map((step: any, hi: number) => {
                  const m: any = step.meta ?? {};
                  const lineCost = parseFloat(String(step.value));
                  const cli = m.costLineId != null ? String(m.costLineId) : null;
                  const canonicalSale = cli ? lineSaleByCostLineId.get(cli) : undefined;
                  if (canonicalSale == null) {
                    trackLegacyPricingPath("PRE_V7_LINE_SALE_FALLBACK_HECHURA", {
                      context: "PriceCompositionCards: HechuraSaleCard → Origen",
                    });
                  }
                  // En modos derivados (MARGIN_TOTAL / PROPORTIONAL_COST /
                  // SERVICE_AS_HECHURA / MANUAL_AS_HECHURA / COMBO_COMPONENTS)
                  // el motor colapsa `lineSale === lineCost` (hechuraMarginPct
                  // = 0). Reusamos el `unifiedFactor` del artículo SOLO para
                  // display, para mostrar la misma fórmula `cost × factor =
                  // venta` que el modo desglosado. Σ(lineCost × unifiedFactor)
                  // === basePrice por construcción del motor en esos modos.
                  // Mismo criterio que `PriceBaseSection`.
                  const useUnifiedFactor =
                    isMarginUnattributable
                    && canonicalSale != null
                    && lineCost > 0.0001
                    && Math.abs(canonicalSale - lineCost) < 0.005
                    && unifiedFactor != null
                    && Math.abs(unifiedFactor - 1) > 0.005;
                  const lineSale = useUnifiedFactor
                    ? lineCost * (unifiedFactor as number)
                    : (canonicalSale != null ? canonicalSale : lineCost * (hechuraSaleFactor ?? 1));
                  const factor = useUnifiedFactor
                    ? (unifiedFactor as number)
                    : (canonicalSale != null && lineCost > 0.0001
                        ? canonicalSale / lineCost
                        : (hechuraSaleFactor ?? 1));
                  const rawLabel = String(m.lineLabel ?? m.lineCode ?? "");
                  const customLabel = rawLabel && !PGENLABELS.has(rawLabel) ? rawLabel : null;
                  const originLabel = customLabel ?? STEP_TYPE_LABEL[String(step.key)] ?? "Componente";
                  const showFactorCalc = Math.abs(factor - 1) > 0.005 && lineCost > 0.0001;
                  const fbH2 = buildFactorBreakdown({
                    grossMarginPct: hechuraMarginPct,
                    effectiveFactor: factor,
                    costAdjustment: extractCostAdjustmentFromSteps(steps),
                  });
                  return (
                    <div key={`hcard-d-${hi}`} className="leading-snug">
                      <div className={vt.row.flexBetween}>
                        <span className={cn(vt.text.label, "font-medium min-w-0 truncate", vt.colors.label)}>{originLabel}</span>
                        <span className={cn(vt.text.rowAmount, vt.colors.subtotalStrong, "shrink-0")}>{fm(lineSale)}</span>
                      </div>
                      {showFactorCalc && (
                        <p className={cn(vt.text.formulaCompact, vt.colors.label, "mt-0.5")}
                          title={fbH2.hasDivergence && fbH2.compactLine ? `Factor efectivo: ${fbH2.compactLine}` : undefined}>
                          {fm(lineCost)} × {fbH2.hasDivergence ? "factor efectivo " : ""}{formatDecimal(factor, 2)} = {fm(lineSale)}
                        </p>
                      )}
                      <FactorBreakdownHint
                        hasDivergence={fbH2.hasDivergence}
                        compactLine={fbH2.compactLine}
                        className="leading-tight mt-0.5"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Ajustes del motor (qty/promo/entity rule imputados a hechura) ── */}
          {hasAdjustments && (
            <div className="space-y-1">
              <div className={cn(vt.row.flexBetween, vt.card.pill)}>
                <span className={cn(vt.text.subtotalRow, vt.colors.labelSoft)}>Subtotal hechura</span>
                <span className={cn(vt.text.subtotalRow, vt.colors.subtotal)}>{fm(hechuraSaleTotal)}</span>
              </div>
              {adjustments.map((adj, ai) => {
                const reduces = adj.amount > 0;
                const sign     = reduces ? "−" : "+";
                const colorCls = reduces ? vt.colors.discount : vt.colors.surcharge;
                const showFormula = adj.base != null && adj.percentage != null && adj.base > 0;
                const showPctTag  = !showFormula && adj.percentage != null;
                return (
                  <div key={`hadj-${ai}-${adj.kind}`} className="space-y-px">
                    <div className={vt.row.flexBetween}>
                      <span className={cn(vt.text.label, "font-medium", colorCls)}>
                        {adj.label}
                        {showPctTag && (
                          <span className={cn("ml-1 text-[10px] font-mono", vt.colors.labelSoft)}>
                            ({sign}{adj.percentage}%)
                          </span>
                        )}
                      </span>
                      <span className={cn(vt.text.subtotalRow, "shrink-0", colorCls)}>
                        {sign}{fm(Math.abs(adj.amount))}
                      </span>
                    </div>
                    {showFormula && (
                      <p className={cn(vt.text.formulaCompact, vt.colors.label, "mt-0.5")}>
                        Base: {fm(adj.base!)} × {adj.percentage}% = {sign}{fm(Math.abs(adj.amount))}
                      </p>
                    )}
                  </div>
                );
              })}
              <div className={cn(vt.row.flexBetween, vt.row.separatorCierre)}>
                <span className={cn(vt.text.subtotalRow, vt.colors.text)}>Subtotal ajustado</span>
                <span className={cn(vt.text.subtotalRow, vt.colors.text)}>{fm(hechSaleAdjusted)}</span>
              </div>
            </div>
          )}

          {/* ── Desglose de impuestos ── */}
          {saleTaxLines.length > 0 && (
            <div className="space-y-1">
              {pHechSteps.length > 1 && !hasAdjustments && (
                <div className={cn(vt.row.flexBetween, vt.card.pill)}>
                  <span className={cn(vt.text.subtotalRow, vt.colors.labelSoft)}>Subtotal</span>
                  <span className={cn(vt.text.subtotalRow, vt.colors.subtotal)}>{fm(hechuraSaleTotal)}</span>
                </div>
              )}
              {saleTaxLines.map((t, ti) => (
                <div key={`stax-${ti}`} className="space-y-0.5 mt-1 pt-1 border-t border-border/30">
                  {hasMetalSale && (
                    <div className="space-y-px">
                      <div className={vt.row.flexBetween}>
                        <span className={cn(vt.text.label, "font-medium", vt.colors.label)}>{t.name} {t.rate}% (Venta · metal)</span>
                        <span className={cn(vt.text.rowAmountFine, vt.colors.label, "shrink-0")}>+{fm(t.metalPart)}</span>
                      </div>
                      <p className={cn(vt.text.formulaCompact, vt.colors.label, "mt-0.5")}>
                        Base: {fm(totalMetalSaleForTax)} × {t.rate}% = +{fm(t.metalPart)}
                      </p>
                    </div>
                  )}
                  <div className="space-y-px">
                    <div className={vt.row.flexBetween}>
                      <span className={cn(vt.text.label, "font-medium", vt.colors.label)}>{t.name} {t.rate}% (Venta · hechura)</span>
                      <span className={cn(vt.text.rowAmountFine, vt.colors.label, "shrink-0")}>+{fm(t.hechuraPart)}</span>
                    </div>
                    <p className={cn(vt.text.formulaCompact, vt.colors.label, "mt-0.5")}>
                      Base: {fm(hechSaleAdjusted)} × {t.rate}% = +{fm(t.hechuraPart)}
                    </p>
                  </div>
                  {hasMetalSale && (
                    <div className={cn(vt.row.flexBetween, "border-t border-border/30 pt-0.5")}>
                      <span className={cn(vt.text.label, vt.colors.label, "font-medium")}>Total {t.name} {t.rate}%</span>
                      <span className={cn(vt.text.subtotalRow, vt.colors.subtotal, "shrink-0")}>+{fm(t.totalTax)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Redondeo (no metálico) ── */}
          {hasRounding && (
            <div className={vt.row.flexBetween}>
              <span className={cn(vt.text.label, vt.colors.labelSoft)}>
                Redondeo
                {(rndStep as any)?.meta?.direction
                  ? ` ${ROUNDING_DIR_SYMBOLS[String((rndStep as any).meta.direction)] ?? ""}`.trimEnd()
                  : ""}
              </span>
              <span className={cn(vt.text.rowAmountFine, vt.colors.subtotal, "shrink-0")}>
                {rndDiff > 0 ? "+" : ""}{fm(rndDiff)}
              </span>
            </div>
          )}

          {/* ── Total componente — línea INFORMATIVA ── */}
          {(saleTaxLines.length > 0 || hasRounding || hasAdjustments) && (
            <div className={cn(vt.row.flexBetween, "border-t border-border/20 pt-1")}>
              <span className={cn(vt.text.label, vt.colors.labelSoft)}>Total componente</span>
              <span className={cn(vt.text.rowAmountFine, vt.colors.labelSoft, "shrink-0")}>{fm(displaySaleTotal)}</span>
            </div>
          )}
        </>
      )}

      {/* ── Cierre del producto — cupón/canal/pago/envío/total a cobrar ── */}
      {hasAnyFinalAdj && (() => {
        const channelName = (result?.channelResult as any)?.channelName
          ? (channel?.channelName ?? (result?.channelResult as any).channelName)
          : "Canal";
        const payLabel  = payment?.paymentMethodName ?? "Pago";
        const shipLabel = (result?.shippingResult as any)?.label ?? "Envío";

        // Trazabilidad: base + % derivados de los amounts del backend.
        const cR: any = result?.couponResult ?? null;
        const couponBase  = cR?.baseAmount ?? null;
        const couponPct   = cR?.discountType === "PERCENTAGE" && cR?.discountValue != null
          ? cR.discountValue
          : (cR && couponBase != null && couponBase > 0.005 ? (cR.discountAmount / couponBase) * 100 : null);
        const couponIsFixed = cR?.discountType === "FIXED";

        const chR: any = result?.channelResult ?? null;
        const channelBase = chR?.baseAmount ?? null;
        const channelPct  = chR && channelBase != null && channelBase > 0.005
          ? (chR.channelAmount / channelBase) * 100
          : null;

        const ckR: any = result?.checkoutResult ?? null;
        const paymentBaseUnit = ckR?.baseAmount != null ? ckR.baseAmount / qtyHC : null;
        const paymentPct = ckR && ckR.baseAmount > 0.005
          ? (ckR.paymentAdjustment / ckR.baseAmount) * 100
          : null;

        const shipModeDesc = (result?.shippingResult as any)?.mode === "FIXED"     ? "Tarifa fija configurada"
                            : (result?.shippingResult as any)?.mode === "BY_WEIGHT" ? "Calculado por peso"
                            : (result?.shippingResult as any)?.mode === "FREE"      ? "Sin cargo"
                            : null;

        const pctStr = (p: number) => `${p > 0 ? "+" : ""}${formatDecimal(p, p % 1 === 0 ? 0 : 2)}%`;

        return (
          <div className="pt-1.5 mt-0.5 border-t border-border/30 space-y-1">
            <p className={cn("text-[8px] font-semibold uppercase tracking-widest mb-0.5", vt.colors.formulaFaint)}>
              Cierre del producto
            </p>

            <div className={vt.row.flexBetween}>
              <span className={cn(vt.text.subLabel, vt.colors.label)}>Total producto</span>
              <span className={cn(vt.text.subLabel, "tabular-nums font-semibold", vt.colors.text)}>{fm(displaySaleTotal)}</span>
            </div>

            {/* Cupón */}
            {couponDiscRaw > 0.005 && cR && (
              <div className="space-y-px">
                <div className={vt.row.flexBetween}>
                  <span className={cn(vt.text.subLabel, vt.colors.discount)}>
                    Cupón {cR.couponCode}
                    {couponPct != null && !couponIsFixed && (
                      <span className={cn("ml-1 text-[10px] font-mono", vt.colors.labelSoft)}>(−{formatDecimal(couponPct, couponPct % 1 === 0 ? 0 : 2)}%)</span>
                    )}
                    {couponIsFixed && cR.discountValue != null && (
                      <span className={cn("ml-1 text-[10px] font-mono", vt.colors.labelSoft)}>(monto fijo)</span>
                    )}
                  </span>
                  <span className={cn(vt.text.subLabel, "tabular-nums font-semibold", vt.colors.discount)}>−{fm(couponDiscRaw)}</span>
                </div>
                {couponBase != null && couponBase > 0.005 && (
                  <p className={cn("text-[10px] tabular-nums font-mono leading-tight ml-2", vt.colors.formula)}>
                    Base: {fm(couponBase)}
                    {couponPct != null && !couponIsFixed
                      ? ` × ${formatDecimal(couponPct, couponPct % 1 === 0 ? 0 : 2)}% = −${fm(couponDiscRaw)}`
                      : ` − ${fm(couponDiscRaw)} (fijo)`}
                  </p>
                )}
              </div>
            )}

            {/* Canal */}
            {Math.abs(channelRaw) > 0.005 && (
              <div className="space-y-px">
                <div className={vt.row.flexBetween}>
                  <span className={cn(vt.text.subLabel, channelRaw > 0 ? vt.colors.bonus : vt.colors.discount)}>
                    {channelName}
                    {channelPct != null && Math.abs(channelPct) > 0.01 && (
                      <span className={cn("ml-1 text-[10px] font-mono", vt.colors.labelSoft)}>({pctStr(channelPct)})</span>
                    )}
                  </span>
                  <span className={cn(vt.text.subLabel, "tabular-nums font-semibold", channelRaw > 0 ? vt.colors.bonus : vt.colors.discount)}>
                    {channelRaw > 0 ? "+" : "−"}{fm(Math.abs(channelRaw))}
                  </span>
                </div>
                {channelBase != null && channelBase > 0.005 && channelPct != null && (
                  <p className={cn("text-[10px] tabular-nums font-mono leading-tight ml-2", vt.colors.formula)}>
                    Base: {fm(channelBase)} × {pctStr(channelPct)} = {channelRaw > 0 ? "+" : "−"}{fm(Math.abs(channelRaw))}
                  </p>
                )}
              </div>
            )}

            {/* Forma de pago */}
            {Math.abs(paymentRaw) > 0.005 && (
              <div className="space-y-px">
                <div className={vt.row.flexBetween}>
                  <span className={cn(vt.text.subLabel, paymentRaw > 0 ? vt.colors.bonus : vt.colors.discount)}>
                    {payLabel}
                    {paymentPct != null && Math.abs(paymentPct) > 0.01 && (
                      <span className={cn("ml-1 text-[10px] font-mono", vt.colors.labelSoft)}>({pctStr(paymentPct)})</span>
                    )}
                  </span>
                  <span className={cn(vt.text.subLabel, "tabular-nums font-semibold", paymentRaw > 0 ? vt.colors.bonus : vt.colors.discount)}>
                    {paymentRaw > 0 ? "+" : "−"}{fm(Math.abs(paymentRaw))}
                  </span>
                </div>
                {paymentBaseUnit != null && paymentBaseUnit > 0.005 && paymentPct != null && (
                  <p className={cn("text-[10px] tabular-nums font-mono leading-tight ml-2", vt.colors.formula)}>
                    Base: {fm(paymentBaseUnit)} × {pctStr(paymentPct)} = {paymentRaw > 0 ? "+" : "−"}{fm(Math.abs(paymentRaw))}
                  </p>
                )}
              </div>
            )}

            {/* Envío */}
            {result?.shippingResult != null && (
              <div className="space-y-px">
                <div className={vt.row.flexBetween}>
                  <span className={cn(vt.text.subLabel, vt.colors.label)}>{shipLabel}</span>
                  <span className={cn(vt.text.subLabel, "tabular-nums font-semibold", vt.colors.text)}>+{fm(shippingRaw)}</span>
                </div>
                {shipModeDesc && (
                  <p className={cn("text-[10px] italic leading-tight ml-2", vt.colors.formula)}>{shipModeDesc}</p>
                )}
              </div>
            )}

            {/* Total a cobrar (informativo) */}
            <div className={cn(vt.row.flexBetween, vt.row.separatorCierre)}>
              <span className={cn(vt.text.subLabel, vt.colors.labelSoft)}>Total a cobrar</span>
              <span className={cn(vt.text.subLabel, "tabular-nums shrink-0", vt.colors.labelSoft)}>{fm(finalCardTotal)}</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
