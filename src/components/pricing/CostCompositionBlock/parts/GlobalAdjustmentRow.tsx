// src/components/pricing/CostCompositionBlock/parts/GlobalAdjustmentRow.tsx
// ============================================================================
// Bloque "Bonif. global" / "Recargo global" del cuerpo de "Costo unitario"
// (modo COST_LINES con COST_LINES_FINAL aplicando ajuste sobre suma de líneas).
//
// Origen: PricingSimulator.tsx:4764-4798.
// ============================================================================

import React from "react";
import { cn } from "../../../ui/tp";
import { formatMoneyDisplay, formatDecimalUpTo } from "../../../../lib/pricing/format";
import { vt } from "../../../../lib/pricing/visualTokens";
import { LINE_TYPE_NAMES } from "../helpers";
import type { CostCompositionDisplay } from "../types";
import type { PricingStepResult } from "../../../../services/articles";

export type GlobalAdjustmentRowProps = {
  steps:   PricingStepResult[];
  display: CostCompositionDisplay;
};

export function GlobalAdjustmentRow(props: GlobalAdjustmentRowProps): React.ReactElement | null {
  const { steps, display } = props;
  const fm = (v: number) => formatMoneyDisplay(v, display.rate, display.symbol);

  const finalStep = steps.find((s: any) => s.key === "COST_LINES_FINAL" && s.status === "ok" && s.value != null);
  if (!finalStep) return null;

  const sumLines = steps
    .filter((s: any) => Object.keys(LINE_TYPE_NAMES).includes(s.key) && s.status === "ok" && s.value != null)
    .reduce((acc: number, s: any) => acc + parseFloat(s.value), 0);
  const finalVal  = parseFloat(String(finalStep.value));
  const globalAdj = finalVal - sumLines;
  if (Math.abs(globalAdj) < 0.01) return null;

  const isBonif  = globalAdj < 0;
  const gm       = ((finalStep as any).meta ?? {}) as any;
  const adjType  = String(gm.adjustmentType  ?? "");
  const adjValue = gm.adjustmentValue != null ? parseFloat(String(gm.adjustmentValue)) : null;
  const adjBase  = gm.sumLines != null ? parseFloat(String(gm.sumLines)) : sumLines;
  const suffix   = adjType === "PERCENTAGE" && adjValue != null
    ? ` ${formatDecimalUpTo(adjValue, 2)}%`
    : adjType === "FIXED_AMOUNT" && adjValue != null
      ? ` (fijo ${fm(adjValue)})` : "";
  const formula  = adjType === "PERCENTAGE" && adjValue != null && adjBase > 0
    ? `${fm(adjBase)} × ${adjValue}% = ${isBonif ? "−" : "+"}${fm(Math.abs(globalAdj))}`
    : `${fm(adjBase)} ${isBonif ? "−" : "+"} ${fm(Math.abs(globalAdj))} = ${fm(finalVal)}`;

  return (
    <div className={vt.row.separator}>
      <div className={cn(vt.row.flexBetween, vt.colors.label)}>
        <span>{isBonif ? "Bonif. global" : "Recargo global"}{suffix}</span>
        <span className={cn("tabular-nums", isBonif ? vt.colors.bonus : vt.colors.surcharge)}>
          {isBonif ? "−" : "+"}{fm(Math.abs(globalAdj))}
        </span>
      </div>
      <p className={cn(vt.text.formula, vt.colors.formula, "mt-0.5")}>{formula}</p>
    </div>
  );
}
