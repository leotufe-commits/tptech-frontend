// src/components/pricing/PricingStepsBreakdown/parts/CommercialAdjustmentsSection.tsx
// ============================================================================
// Sección de ajustes comerciales: descuento por cantidad, promoción, regla de
// cliente, y subtotal ajustado.
//
// Origen: PricingSimulator.tsx:4840-4963.
//
// Jerarquía visual:
//   - Cada ajuste muestra label + porcentaje + monto a la derecha (rojo o
//     verde según signo) y fórmula "Base: $X × Y% = ±$Z" debajo.
//   - Al final, "Subtotal ajustado" (border-top) cuando hubo al menos un
//     ajuste — único punto de cierre antes de impuestos.
//
// Read-only — sin matemática comercial.
// ============================================================================

import React from "react";
import { cn } from "../../../ui/tp";
import { formatMoneyDisplay } from "../../../../lib/pricing/format";
import { vt } from "../../../../lib/pricing/visualTokens";
import type { PricingStepsDisplay } from "../types";
import type { PricingStepResult } from "../../../../services/articles";

// FASE 6 — token unificado. Antes inline `text-[10px] text-muted/70 font-mono`.
const FORMULA_CLS = cn(vt.text.formula, vt.colors.formula, "mt-0.5");

const QTY_SCOPE_LABELS: Record<string, string> = {
  CATEGORY: "cat.",
  BRAND:    "marca",
  GROUP:    "grupo",
  GENERAL:  "general",
};
const PROMO_SCOPE_LABELS: Record<string, string> = {
  CATEGORY: "categoría",
  BRAND:    "marca",
  GROUP:    "grupo",
};

export type CommercialAdjustmentsSectionProps = {
  basePriceVal: number | null;
  discStep:    PricingStepResult | undefined;
  promoStep:   PricingStepResult | undefined;
  ruleStep:    PricingStepResult | undefined;
  display:     PricingStepsDisplay;
};

export function CommercialAdjustmentsSection(props: CommercialAdjustmentsSectionProps): React.ReactElement | null {
  const { basePriceVal, discStep, promoStep, ruleStep, display } = props;
  const fm = (v: number) => formatMoneyDisplay(v, display.rate, display.symbol);

  const hasAnyAdj = discStep?.value != null || promoStep?.value != null || ruleStep?.value != null;
  if (!hasAnyAdj) return null;

  return (
    <>
      {/* ── Descuento por cantidad ─────────────────────────────────────────── */}
      {discStep?.value != null && (() => {
        const m: any = (discStep as any).meta ?? {};
        const priceAfter = parseFloat(String(discStep.value));
        const discAmt = m.discountAmount != null
          ? parseFloat(String(m.discountAmount))
          : (basePriceVal != null ? basePriceVal - priceAfter : 0);
        const base = m.discountBase != null ? parseFloat(String(m.discountBase)) : basePriceVal;
        const scopeSuffix = (() => {
          if (!m.scopeType || m.scopeType === "ARTICLE" || m.scopeType === "VARIANT") return "";
          const prefix = QTY_SCOPE_LABELS[String(m.scopeType)] ?? String(m.scopeType).toLowerCase();
          return m.scopeLabel ? ` · ${prefix}: ${m.scopeLabel}` : ` · ${prefix}`;
        })();
        const pctLabel = m.type === "PERCENTAGE" && m.value != null ? ` (−${m.value}%)` : "";
        const formula  = m.type === "PERCENTAGE" && m.value != null && base != null
          ? `Base: ${fm(base)} × ${m.value}% = −${fm(discAmt)}`
          : `−${fm(discAmt)}`;
        return (
          <div>
            <div className={vt.row.flexBetween}>
              <span className={vt.colors.discount}>Desc. por cantidad{scopeSuffix}{pctLabel}</span>
              <span className={cn(vt.text.subtotalRow, "shrink-0 ml-2", vt.colors.discount)}>−{fm(discAmt)}</span>
            </div>
            <p className={FORMULA_CLS}>{formula}</p>
          </div>
        );
      })()}

      {/* ── Promoción ──────────────────────────────────────────────────────── */}
      {promoStep?.value != null && (() => {
        const m: any = (promoStep as any).meta ?? {};
        const priceAfter = parseFloat(String(promoStep.value));
        const discAmt = m.discountAmount != null ? parseFloat(String(m.discountAmount)) : null;
        const qdPrice = discStep?.value != null ? parseFloat(String(discStep.value)) : null;
        const priceBefore = qdPrice ?? basePriceVal;
        const amtOff = discAmt ?? (priceBefore != null ? priceBefore - priceAfter : 0);
        const base   = m.discountBase != null ? parseFloat(String(m.discountBase)) : priceBefore;
        const scopeSuffix = (() => {
          if (!m.scope || m.scope === "ALL" || m.scope === "ARTICLE" || m.scope === "VARIANT") return "";
          return ` · ${PROMO_SCOPE_LABELS[String(m.scope)] ?? String(m.scope).toLowerCase()}`;
        })();
        const pctLabel = m.type === "PERCENTAGE" && m.value != null ? ` (−${m.value}%)` : "";
        const formula  = m.type === "PERCENTAGE" && m.value != null && base != null
          ? `Base: ${fm(base)} × ${m.value}% = −${fm(amtOff)}`
          : `−${fm(amtOff)}`;
        return (
          <div>
            <div className={vt.row.flexBetween}>
              <span className={vt.colors.discount}>Promoción{scopeSuffix}{pctLabel}</span>
              <span className={cn(vt.text.subtotalRow, "shrink-0 ml-2", vt.colors.discount)}>−{fm(amtOff)}</span>
            </div>
            <p className={FORMULA_CLS}>{formula}</p>
          </div>
        );
      })()}

      {/* ── Ajuste comercial del cliente (DISCOUNT/BONUS/SURCHARGE) ────────── */}
      {ruleStep?.value != null && (() => {
        const m: any = (ruleStep as any).meta ?? {};
        const ruleType   = String(m.ruleType ?? "");
        const isDiscount = ruleType === "DISCOUNT" || ruleType === "BONUS";
        const amt        = parseFloat(String(ruleStep.value));
        const vtype      = String(m.valueType ?? "");
        const ruleLabel  = isDiscount ? "Descuento cliente" : "Recargo cliente";
        const priceBeforeRule = promoStep?.value != null ? parseFloat(String(promoStep.value))
          : discStep?.value != null ? parseFloat(String(discStep.value))
          : basePriceVal;
        const base = m.discountBase != null ? parseFloat(String(m.discountBase))
                   : m.surchargeBase != null ? parseFloat(String(m.surchargeBase))
                   : priceBeforeRule;
        const sign = isDiscount ? "−" : "+";
        const colorCls = isDiscount ? vt.colors.discount : vt.colors.bonus;
        const pctLabel = vtype === "PERCENTAGE" && m.value != null ? ` (${sign}${m.value}%)` : "";
        const formula  = vtype === "PERCENTAGE" && m.value != null && base != null
          ? `Base: ${fm(base)} × ${m.value}% = ${sign}${fm(amt)}`
          : `${sign}${fm(amt)}`;
        return (
          <div>
            <div className={vt.row.flexBetween}>
              <span className={colorCls}>{ruleLabel}{pctLabel}</span>
              <span className={cn(vt.text.subtotalRow, "shrink-0 ml-2", colorCls)}>{sign}{fm(amt)}</span>
            </div>
            <p className={FORMULA_CLS}>{formula}</p>
          </div>
        );
      })()}

      {/* ── Subtotal ajustado (cierre único de la sección) ─────────────────── */}
      {(() => {
        const lastVal = ruleStep?.value != null ? (() => {
          const m: any = (ruleStep as any).meta ?? {};
          const isDisc = String(m.ruleType ?? "") === "DISCOUNT" || String(m.ruleType ?? "") === "BONUS";
          const amt = parseFloat(String(ruleStep.value));
          const before = promoStep?.value != null ? parseFloat(String(promoStep.value))
                       : discStep?.value != null ? parseFloat(String(discStep.value))
                       : basePriceVal ?? 0;
          return isDisc ? before - amt : before + amt;
        })()
          : promoStep?.value != null ? parseFloat(String(promoStep.value))
          : discStep?.value != null ? parseFloat(String(discStep.value))
          : basePriceVal;
        if (lastVal == null) return null;
        return (
          <div className={cn(vt.row.flexBetween, vt.row.separatorCierre)}>
            <span className={cn(vt.text.subtotalRow, vt.colors.text)}>Subtotal ajustado</span>
            <span className={cn(vt.text.subtotalRow, vt.colors.text)}>{fm(lastVal)}</span>
          </div>
        );
      })()}
    </>
  );
}
