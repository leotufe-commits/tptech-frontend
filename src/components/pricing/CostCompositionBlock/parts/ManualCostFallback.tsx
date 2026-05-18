// src/components/pricing/CostCompositionBlock/parts/ManualCostFallback.tsx
// ============================================================================
// Caso MANUAL / MULTIPLIER del cuerpo de "Costo unitario": fila única
// "Costo base" con sub-texto descriptivo y, opcionalmente, "Bonificación"
// o "Recargo" si el motor aplicó ajuste sobre el costo manual.
//
// Origen: PricingSimulator.tsx:4694-4762.
// Read-only — reutiliza datos del response del motor.
// ============================================================================

import React from "react";
import { cn } from "../../../ui/tp";
import { formatMoneyAmount as fmtMoney, formatMoneyDisplay, formatDecimal, formatDecimalUpTo } from "../../../../lib/pricing/format";
import { vt } from "../../../../lib/pricing/visualTokens";
import type { CostCompositionDisplay } from "../types";
import type { PricingStepResult, PricingPreviewResult } from "../../../../services/articles";

// stepFormula vive en PricingSimulator local; replicamos solo lo necesario
function stepFormula(step: PricingStepResult): string | null {
  const meta = (step as any).meta ?? {};
  if (meta.qty != null && meta.unitValue != null) {
    const qty = parseFloat(String(meta.qty));
    const unit = parseFloat(String(meta.unitValue));
    if (qty > 0 && unit > 0) {
      return `${formatDecimalUpTo(qty, 4)} × ${formatDecimal(unit, 2)}`;
    }
  }
  return null;
}

export type ManualCostFallbackProps = {
  steps:    PricingStepResult[];
  unitCost: number;
  result:   Pick<PricingPreviewResult, "costMode"> | null;
  display:  CostCompositionDisplay;
};

export function ManualCostFallback(props: ManualCostFallbackProps): React.ReactElement {
  const { steps, unitCost, result, display } = props;
  const fm = (v: number) => formatMoneyDisplay(v, display.rate, display.symbol);

  const multStep   = steps.find((s: any) => s.key === "MULTIPLIER"       && s.status === "ok");
  const manualStep = steps.find((s: any) => s.key === "MANUAL_BASE_COST" && s.status === "ok");
  const currStep   = steps.find((s: any) =>
    (s.key === "MULTIPLIER_CURRENCY" || s.key === "MANUAL_CURRENCY") && s.status === "ok"
  );

  let preAdjBase: number | null = null;
  let adjustKind: string | null = null;
  let adjustAmt:  number | null = null;
  if (manualStep) {
    const mm = ((manualStep as any).meta ?? {}) as any;
    if (mm.adjustmentKind && mm.adjustmentKind !== "") {
      adjustKind = mm.adjustmentKind;
      const cm = currStep ? ((currStep as any).meta ?? {}) as any : null;
      preAdjBase = cm?.convertedAmount != null ? parseFloat(String(cm.convertedAmount))
        : mm.manualBaseCost != null ? parseFloat(String(mm.manualBaseCost)) : null;
      if (preAdjBase != null) adjustAmt = unitCost - preAdjBase;
    }
  }

  let costSub: string | null = null;
  if (currStep) {
    const cm = ((currStep as any).meta ?? {}) as any;
    const origAmt  = cm.originalAmount  != null ? parseFloat(String(cm.originalAmount))  : null;
    const convRate = cm.rate             != null ? parseFloat(String(cm.rate))             : null;
    const convAmt  = cm.convertedAmount  != null ? parseFloat(String(cm.convertedAmount))  : null;
    const code     = String(cm.currencyCode ?? cm.fromCurrencyId ?? "");
    if (origAmt != null && convRate != null && code) {
      const rateStr  = formatDecimalUpTo(convRate, 2);
      const baseDisp = preAdjBase ?? convAmt ?? unitCost;
      costSub = `${code} ${fmtMoney(origAmt, "").trim()} × ${rateStr} = ${fm(baseDisp)}`;
    }
  } else if (multStep) {
    const partial = stepFormula(multStep);
    costSub = partial ? `${partial} = ${fm(unitCost)}` : `Cantidad × valor unitario = ${fm(unitCost)}`;
  } else if (!manualStep) {
    const mode = String(result?.costMode ?? "");
    costSub = mode === "MULTIPLIER" ? `Cantidad × valor unitario = ${fm(unitCost)}`
      : mode === "METAL_MERMA_HECHURA" ? "Metal + merma + hechura"
      : mode === "MANUAL" ? "Costo manual del artículo"
      : "Costo del artículo";
  }
  const displayBase = preAdjBase ?? unitCost;

  return (
    <React.Fragment>
      <div>
        <div className={vt.row.flexBetween}>
          <span className={vt.colors.label}>Costo base</span>
          <span className="tabular-nums">{fm(displayBase)}</span>
        </div>
        {costSub && (
          <p className={cn(vt.text.formula, vt.colors.formula, "mt-0.5")}>{costSub}</p>
        )}
      </div>
      {adjustKind != null && adjustAmt != null && (
        <div>
          <div className={cn(vt.row.flexBetween, vt.colors.label)}>
            <span>{adjustKind === "BONUS" ? "Bonificación" : "Recargo"}</span>
            <span className="tabular-nums">
              {adjustKind === "BONUS" ? "−" : "+"}{fm(Math.abs(adjustAmt))}
            </span>
          </div>
          {preAdjBase != null && Math.abs(preAdjBase) > 0.001 && (() => {
            const pct = Math.abs(adjustAmt! / preAdjBase!) * 100;
            return (
              <p className={cn(vt.text.formula, vt.colors.formula, "mt-0.5")}>
                {fm(preAdjBase)} × {formatDecimalUpTo(pct, 2)}% = {fm(Math.abs(adjustAmt!))}
              </p>
            );
          })()}
        </div>
      )}
    </React.Fragment>
  );
}
