// src/components/pricing/PricingStepsBreakdown/parts/FinalAdjustmentsSection.tsx
// ============================================================================
// Sección final del flujo: total producto + cupón + canal + pago + envío +
// total a pagar.
//
// Origen: PricingSimulator.tsx:5118-5302.
//
// Orden de display:
//   1. Precio sin imp. (cuando hay impuestos; valor = line.unitPrice = PRECIO
//      neto, NO costo — el label histórico decía "Costo sin imp." y confundía)
//   2. Total producto / Sin impuestos
//   3. Cupón (descuento sobre el producto, antes de canal)
//   4. Canal de venta (recargo o descuento)
//   5. Precio ajustado (cuando hay canal/cupón sin pago)
//   6. Subtotal antes de pago (cuando hay canal/cupón + pago)
//   7. Forma de pago (recargo/descuento + cuotas opcional)
//   8. Total con pago
//   9. Envío
//  10. Total a pagar (jerarquía visual fuerte: bg-primary, font-extrabold)
//
// Read-only — montos vienen de result.couponResult, channelResult,
// checkoutResult, shippingResult.
// ============================================================================

import React from "react";
import { cn } from "../../../ui/tp";
import { formatMoneyDisplay, formatDecimal } from "../../../../lib/pricing/format";
import { vt } from "../../../../lib/pricing/visualTokens";
import type {
  PricingStepsDisplay,
  PricingStepsChannelInfo,
  PricingStepsPaymentInfo,
} from "../types";
import type { PricingPreviewResult } from "../../../../services/articles";

function SubLine({ children }: { children: React.ReactNode }) {
  return <p className={cn(vt.text.formula, vt.colors.formula, "mt-0.5")}>{children}</p>;
}

export type FinalAdjustmentsSectionProps = {
  basePriceVal:  number | null;
  netP:          number | null;
  finalP:        number | null;
  grandTotal:    number | null;
  appliedTaxes:  Array<{ amount: number }>;
  hasTaxesL:     boolean;
  whatIfActive:  boolean;
  quantity:      number;
  channel:       PricingStepsChannelInfo | null;
  payment:       PricingStepsPaymentInfo | null;
  result:        Pick<PricingPreviewResult,
    | "channelResult"
    | "couponResult"
    | "checkoutResult"
    | "shippingResult"
  > | null;
  display:       PricingStepsDisplay;
};

export function FinalAdjustmentsSection(props: FinalAdjustmentsSectionProps): React.ReactElement | null {
  const {
    basePriceVal, netP, finalP, grandTotal, appliedTaxes, hasTaxesL,
    whatIfActive, quantity, channel, payment, result, display,
  } = props;
  const fm = (v: number) => formatMoneyDisplay(v, display.rate, display.symbol);

  if (finalP == null) return null;

  const taxTotal = appliedTaxes.reduce((s, t) => s + t.amount, 0);
  const cr: any = result?.checkoutResult ?? null;
  const hasAdj = cr != null && cr.paymentAdjustment !== 0;
  const hasCommercialAdj = !whatIfActive && (
    (result?.channelResult != null && (result.channelResult as any).channelAmount !== 0) ||
    ((result?.couponResult as any)?.applied === true && ((result?.couponResult as any)?.discountAmount ?? 0) > 0)
  );
  const finalLabel = hasTaxesL ? "Total producto" : "Sin impuestos";
  const showFinalRow = hasTaxesL || hasAdj || hasCommercialAdj
    || basePriceVal == null || Math.abs(finalP - basePriceVal) > 0.005;
  void taxTotal; // disponible para tooltip futuro; no usado en render actual

  // FASE 6 — Mostrar SIEMPRE "Precio sin imp." cuando hay impuestos (incluso
  // si coincide con finalP). Eliminamos el umbral que generaba filas que
  // aparecen y desaparecen sin explicación visual.
  // OJO: este valor es `netP = line.unitPrice` — es el PRECIO neto de venta,
  // NO el costo del artículo. El label histórico "Costo sin imp." era engañoso.
  const showPrecioSinImp = hasTaxesL && netP != null;

  return (
    <>
      {/* ── 1. Precio sin imp. (siempre que haya impuestos) ────────────────── */}
      {showPrecioSinImp && (
        <div className={cn(vt.row.flexBetween, vt.colors.label)}>
          <span>Precio sin imp.</span>
          <span className="tabular-nums">{fm(netP!)}</span>
        </div>
      )}

      {/* ── 2. Total producto / Sin impuestos ──────────────────────────────── */}
      {showFinalRow && (
        <div className={cn(
          vt.row.flexCenter, vt.text.totalCard,
          showPrecioSinImp && vt.row.separatorCierre,
        )}>
          <span>{finalLabel}</span>
          <span>{fm(finalP)}</span>
        </div>
      )}

      {/* ── 3. Cupón (antes de canal) ──────────────────────────────────────── */}
      {!whatIfActive && (result?.couponResult as any) != null
        && (result?.couponResult as any).applied
        && (result?.couponResult as any).discountAmount > 0 && (() => {
        const cp: any = result!.couponResult;
        const pctLabel = cp.discountType === "PERCENTAGE" ? ` (${cp.discountValue}%)` : "";
        return (
          <div className={vt.row.separator}>
            <div className={vt.row.flexBetween}>
              <span className={vt.colors.discount}>Cupón {cp.couponCode}{pctLabel}</span>
              <span className={cn(vt.text.subtotalRow, vt.colors.discount)}>−{fm(cp.discountAmount)}</span>
            </div>
          </div>
        );
      })()}

      {/* ── 4. Canal de venta ──────────────────────────────────────────────── */}
      {!whatIfActive && (result?.channelResult as any) != null
        && (result?.channelResult as any).channelAmount !== 0 && (() => {
        const ch: any = result!.channelResult;
        const adjUnit  = ch.channelAmount;
        const isRecarg = adjUnit > 0;
        const chName = channel?.channelName ?? ch.channelName ?? "Canal";
        const pct = ch.baseAmount > 0 ? ch.channelAmount / ch.baseAmount * 100 : 0;
        return (
          <div className={vt.row.separator}>
            <div className={vt.row.flexBetween}>
              <span className={isRecarg ? "" : vt.colors.discount}>
                {chName}{isRecarg ? " (recargo)" : " (descuento)"}
                {Math.abs(pct) >= 0.01 && (
                  <span className="opacity-60 ml-1 font-mono text-[10px]">
                    ({formatDecimal(pct, 1)}%)
                  </span>
                )}
              </span>
              <span className={cn(vt.text.subtotalRow, isRecarg ? "" : vt.colors.discount)}>
                {fm(adjUnit)}
              </span>
            </div>
          </div>
        );
      })()}

      {/* ── 5. Precio ajustado (canal/cupón SIN pago) ──────────────────────── */}
      {!whatIfActive && !hasAdj && hasCommercialAdj && grandTotal != null && (
        <div className={vt.row.separator}>
          <div className={cn(vt.row.flexCenter, vt.text.total)}>
            <span>Precio ajustado</span>
            <span>{fm(grandTotal)}</span>
          </div>
        </div>
      )}

      {/* ── 6. Subtotal antes de pago (canal/cupón + pago) ─────────────────── */}
      {!whatIfActive && hasAdj && cr != null && grandTotal != null
        && (((result?.channelResult as any)?.channelAmount !== 0) || (result?.couponResult as any)?.applied) && (
        <div className={vt.row.separator}>
          <div className={cn(vt.row.flexCenter, vt.text.subtotalRow)}>
            <span className={vt.colors.label}>Subtotal antes de pago</span>
            <span>{fm(grandTotal)}</span>
          </div>
        </div>
      )}

      {/* ── 7+8. Forma de pago + Total con pago + cuotas ───────────────────── */}
      {hasAdj && cr != null && (() => {
        const qty         = Math.max(quantity ?? 1, 1);
        const adjUnit     = cr.paymentAdjustment / qty;
        const finalUnit   = cr.finalAmount / qty;
        const installUnit = cr.installmentAmount != null ? cr.installmentAmount / qty : null;
        const isRecarg    = adjUnit > 0;
        const pmStep: any = cr.steps.find((s: any) => s.code === "PAYMENT_ADJUSTMENT");
        const baseUnit = cr.baseAmount / qty;
        let unitFormula: string | null = null;
        if (pmStep) {
          const rateMatch = String(pmStep.formula).match(/×\s*([\d.,]+)%/);
          if (rateMatch) {
            unitFormula = `${fm(baseUnit)} × ${rateMatch[1]}% = ${fm(adjUnit)}`;
          } else {
            unitFormula = `${fm(Math.abs(adjUnit))} (fijo)`;
          }
        }
        return (
          <>
            <div className={vt.row.separator}>
              <div className={vt.row.flexBetween}>
                <span className={isRecarg ? "" : vt.colors.discount}>
                  {payment?.paymentMethodName ?? "Forma de pago"}{isRecarg ? " (recargo)" : " (descuento)"}
                </span>
                <span className={cn(vt.text.subtotalRow, isRecarg ? "" : vt.colors.discount)}>
                  {fm(adjUnit)}
                </span>
              </div>
              {unitFormula && <SubLine>{unitFormula}</SubLine>}
            </div>
            <div>
              <div className={cn(vt.row.flexCenter, vt.text.total)}>
                <span>Total con pago</span>
                <span>{fm(finalUnit)}</span>
              </div>
            </div>
            {cr.installments != null && installUnit != null && (
              <div className="pt-1 border-t border-border/20">
                <div className={cn(vt.row.flexBetween, vt.colors.label)}>
                  <span>{cr.installments} {cr.installments === 1 ? "cuota" : "cuotas"}</span>
                  <span className={cn(vt.text.subtotalRow, vt.colors.primary)}>{fm(installUnit)} c/u</span>
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* ── 9+10. Envío + Total a pagar ────────────────────────────────────── */}
      {result?.shippingResult && (() => {
        const ship: any = result.shippingResult;
        const productWithAdj = grandTotal != null ? grandTotal : finalP;
        const totalAPagar = (productWithAdj ?? 0) + (ship?.amount ?? 0);
        return (
          <>
            <div className={cn(vt.row.flexCenter, "text-sm", vt.colors.label, vt.row.separatorCierre, "mt-1")}>
              <span>{ship.label}</span>
              <span className="tabular-nums">+{fm(ship.amount)}</span>
            </div>
            <div className={cn(vt.row.flexCenter, vt.card.totalAccent)}>
              <span className={cn(vt.text.totalGrand, vt.colors.text)}>Total a pagar</span>
              <span className={cn(vt.text.totalGrand, vt.colors.primary)}>{fm(totalAPagar)}</span>
            </div>
          </>
        );
      })()}
    </>
  );
}
