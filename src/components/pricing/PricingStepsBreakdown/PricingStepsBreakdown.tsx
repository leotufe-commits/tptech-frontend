// src/components/pricing/PricingStepsBreakdown/PricingStepsBreakdown.tsx
// ============================================================================
// PricingStepsBreakdown — Flujo de construcción del precio.
//
// Compartido entre Simulador, Factura y Comparador. Read-only (POLICY R6).
//
// Decomposición (parts/):
//   - PriceBaseSection            — precio base + desglose metal/hechura
//   - CommercialAdjustmentsSection — qty + promo + cliente + subtotal ajustado
//   - RoundingTaxSection          — redondeo pre-tax + impuestos + redondeo post-tax
//   - FinalAdjustmentsSection     — total producto + cupón + canal + pago + envío + total a pagar
//
// Origen: PricingSimulator.tsx, IIFE en líneas 4495-5303 (FASE 2.2).
// ============================================================================

import React, { useState, useCallback, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../ui/tp";
import { formatMoneyDisplay } from "../../../lib/pricing/format";
import { vt } from "../../../lib/pricing/visualTokens";
import {
  selectBaseStep,
  selectQuantityDiscountStep,
  selectPromotionStep,
  selectEntityRuleStep,
  selectRoundingStep,
  buildLineSaleByCostLineIdMap,
  buildSaleEntityMermaMap,
} from "./helpers";
import type { PricingStepsBreakdownProps } from "./types";
import { PriceBaseSection }            from "./parts/PriceBaseSection";
import { CommercialAdjustmentsSection } from "./parts/CommercialAdjustmentsSection";
import { RoundingTaxSection }           from "./parts/RoundingTaxSection";
import { FinalAdjustmentsSection }      from "./parts/FinalAdjustmentsSection";

const DEFAULT_DISPLAY = { rate: 1, symbol: "$" } as const;

export function PricingStepsBreakdown(props: PricingStepsBreakdownProps): React.ReactElement | null {
  const {
    steps,
    line,
    result,
    quantity = 1,
    channel = null,
    payment = null,
    whatIfActive = false,
    display = DEFAULT_DISPLAY,
    variant = "full",
    detailMode = "DESGLOSADO",
    showListRoundingCard = true,
    expanded: expandedProp,
    onToggle,
  } = props;
  const fm = (v: number) => formatMoneyDisplay(v, display.rate, display.symbol);

  // ── Selectores de steps clave (memoizados, una sola vez) ─────────────────
  const baseStep  = useMemo(() => selectBaseStep(steps),               [steps]);
  const discStep  = useMemo(() => selectQuantityDiscountStep(steps),   [steps]);
  const promoStep = useMemo(() => selectPromotionStep(steps),          [steps]);
  const ruleStep  = useMemo(() => selectEntityRuleStep(steps),         [steps]);
  const rndStep   = useMemo(() => selectRoundingStep(steps),           [steps]);

  // ── Mapas / agregaciones puras ───────────────────────────────────────────
  const lineSaleByCostLineId = useMemo(() => buildLineSaleByCostLineIdMap(line), [line]);
  const saleEntityMermaMap   = useMemo(() => buildSaleEntityMermaMap(steps),     [steps]);

  // ── Derivaciones de la línea ─────────────────────────────────────────────
  const basePriceVal = baseStep?.value != null ? parseFloat(String(baseStep.value)) : null;
  const unitCostVal  = line?.unitCost ?? null;
  const mhb          = line?.metalHechuraBreakdown ?? null;
  const metalCostRaw   = mhb?.metalCost   ?? null;
  const hechuraCostRaw = mhb?.hechuraCost ?? null;
  const netP   = line?.unitPrice ?? null;
  // `finalP` = totalWithTax cuando hay impuestos (incluye redondeo TOTAL),
  // sino netP. Coincide con la lógica original del Simulador.
  const taxesAddValueL = (line?.unitTaxAmount ?? 0) > 0.005;
  const hasTaxesL = (line?.taxBreakdown?.length ?? 0) > 0
    && !((result as any)?.taxExemptByEntity);
  const totalFinalLine = (line as any)?.unitTotalWithTax ?? null;
  const finalP = totalFinalLine != null ? totalFinalLine : netP;
  // `productTotalL` = lo que muestra el header (Total producto si hay impuestos
  // efectivos, sino netP).
  const productTotalL = (hasTaxesL && taxesAddValueL && totalFinalLine != null)
    ? totalFinalLine : netP;
  // `grandTotal` = total tras canal + cupón + pago. Lo provee el motor en
  // checkoutResult.finalAmount (per qty) o cae a finalP.
  const cr: any = (result as any)?.checkoutResult ?? null;
  const grandTotal = cr?.finalAmount != null
    ? cr.finalAmount / Math.max(quantity ?? 1, 1)
    : finalP;
  // appliedTaxes — leído del taxBreakdown del response.
  const appliedTaxes = useMemo(
    () => ((result as any)?.taxBreakdown ?? []).map((t: any) => ({ amount: parseFloat(String(t.taxAmount ?? 0)) })),
    [result],
  );
  const hasDiscPromo = discStep?.value != null || promoStep?.value != null;

  // ── Estado de expansión ─────────────────────────────────────────────────
  const [localExpanded, setLocalExpanded] = useState<Record<string, boolean>>({
    priceCalc: variant === "compact",
  });
  const expanded = expandedProp ?? localExpanded;
  const isExpanded = useCallback((key: string) => Boolean(expanded[key]), [expanded]);
  const toggleSection = useCallback((key: string) => {
    if (onToggle) { onToggle(key); return; }
    setLocalExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  }, [onToggle]);

  void detailMode; // reservado para cards de composición del precio (futuro)

  // ── Guardia: sin precio base, no renderizar ──────────────────────────────
  if (basePriceVal == null) return null;

  const pcOpen = isExpanded("priceCalc");
  const headerTotal = productTotalL ?? basePriceVal;

  // ── Body content: composición de las 4 secciones ─────────────────────────
  // FASE 10.1 — QW4: en variant="compact" (Factura) bajamos space-y-2.5 →
  // space-y-2 entre las 4 sub-secciones (PriceBase / CommercialAdjustments /
  // RoundingTax / FinalAdjustments). Ahorra ~6px por gap × 3 gaps = ~18px
  // verticales. Simulador (variant="full") conserva el spacing original.
  const body = (
    <div
      className={cn(variant === "compact" ? "space-y-2" : "space-y-2.5", "text-xs")}
      data-testid="pricing-steps-body"
    >
      <PriceBaseSection
        baseStep={baseStep}
        basePriceVal={basePriceVal}
        steps={steps}
        line={line}
        metalCostRaw={metalCostRaw}
        hechuraCostRaw={hechuraCostRaw}
        unitCostVal={unitCostVal}
        metalHechuraBreakdown={mhb as any}
        saleEntityMermaMap={saleEntityMermaMap}
        lineSaleByCostLineId={lineSaleByCostLineId}
        hasDiscPromo={hasDiscPromo}
        display={display}
      />
      <CommercialAdjustmentsSection
        basePriceVal={basePriceVal}
        discStep={discStep}
        promoStep={promoStep}
        ruleStep={ruleStep}
        display={display}
      />
      <RoundingTaxSection
        rndStep={rndStep}
        hasTaxesL={hasTaxesL}
        result={result}
        display={display}
        showListRoundingCard={showListRoundingCard}
      />
      <FinalAdjustmentsSection
        basePriceVal={basePriceVal}
        netP={netP}
        finalP={finalP}
        grandTotal={grandTotal}
        appliedTaxes={appliedTaxes}
        hasTaxesL={hasTaxesL}
        whatIfActive={whatIfActive}
        quantity={Math.max(quantity ?? 1, 1)}
        channel={channel}
        payment={payment}
        result={result}
        display={display}
      />
    </div>
  );

  // ── compact: solo el body, sin wrapper ni header ─────────────────────────
  if (variant === "compact") return body;

  // ── full: card wrapper + header colapsable + body ────────────────────────
  return (
    <div className={vt.card.outer} data-testid="pricing-steps-block">
      <button
        type="button"
        onClick={() => toggleSection("priceCalc")}
        className="w-full flex items-center justify-between gap-2 mb-2.5 cursor-pointer"
      >
        <p className={vt.text.cardTitle}>
          Cálculo del precio
        </p>
        <div className="flex items-center gap-1.5">
          <span className={cn(vt.text.totalCard, vt.colors.text)}>{fm(headerTotal)}</span>
          <ChevronDown size={14} className={cn(vt.colors.formula, "transition-transform", pcOpen && "rotate-180")} />
        </div>
      </button>
      {pcOpen && body}
    </div>
  );
}

export default PricingStepsBreakdown;
