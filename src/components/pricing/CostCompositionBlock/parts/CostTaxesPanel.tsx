// src/components/pricing/CostCompositionBlock/parts/CostTaxesPanel.tsx
// ============================================================================
// Lista de impuestos de compra agregados (cuerpo de "Costo unitario").
// Cada item muestra: nombre · base × rate% / +monto.
//
// Origen: PricingSimulator.tsx:4800-4815 (taxEls).
// Read-only — los montos vienen de result.costTaxBreakdown del motor.
// ============================================================================

import React from "react";
import { cn } from "../../../ui/tp";
import { formatMoneyDisplay } from "../../../../lib/pricing/format";
import { vt } from "../../../../lib/pricing/visualTokens";
import type { CostCompositionDisplay } from "../types";

export type CostTaxesPanelProps = {
  taxItems: Array<{ name?: string; rate?: number | string | null; taxAmount?: number | string | null }>;
  unitCost: number | null;
  display:  CostCompositionDisplay;
};

export function CostTaxesPanel(props: CostTaxesPanelProps): React.ReactElement | null {
  const { taxItems, unitCost, display } = props;
  const fm = (v: number) => formatMoneyDisplay(v, display.rate, display.symbol);

  if (!taxItems || taxItems.length === 0) return null;

  return (
    <div className="border-t border-border/30 pt-2 mt-1 space-y-1.5">
      {taxItems.map((t, i) => {
        const taxAmt = parseFloat(String(t.taxAmount ?? 0));
        const leftLabel = t.rate != null
          ? <>
              <span className={vt.colors.labelSoft}>{t.name}</span>
              <span className={cn("ml-1 text-[9px] font-mono", vt.colors.formulaFaint)}>
                {unitCost != null ? `${fm(unitCost)} × ${t.rate}%` : `${t.rate}%`}
              </span>
            </>
          : <span className={vt.colors.labelSoft}>{t.name}</span>;
        return (
          <div key={`ctax-${i}`} className={vt.row.flexBetween}>
            <span className={vt.text.subLabel}>{leftLabel}</span>
            <span className={cn("tabular-nums shrink-0", vt.text.subLabel, vt.colors.label)}>+{fm(taxAmt)}</span>
          </div>
        );
      })}
    </div>
  );
}
