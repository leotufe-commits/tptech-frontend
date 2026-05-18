// src/components/pricing/CostCompositionBlock/parts/CostClosingRow.tsx
// ============================================================================
// Cierre del costo: "Costo sin imp" + "Total costo" (cuando hay impuestos)
// o solo "Costo total" (cuando no). Va dentro del body colapsable de
// "Costo unitario", junto a las líneas, ajuste y impuestos.
//
// Origen: PricingSimulator.tsx:4934-4961 (costClosingEl).
// Read-only — totalCost lo emite el motor (line.costWithTax / unitCost).
// ============================================================================

import React from "react";
import { cn } from "../../../ui/tp";
import { formatMoneyDisplay } from "../../../../lib/pricing/format";
import { vt } from "../../../../lib/pricing/visualTokens";
import type { CostCompositionDisplay } from "../types";

export type CostClosingRowProps = {
  unitCost:           number;
  totalCostWithTax:   number;
  hasCostTax:         boolean;
  hasMultipleSources: boolean;
  display:            CostCompositionDisplay;
};

export function CostClosingRow(props: CostClosingRowProps): React.ReactElement | null {
  const { unitCost, totalCostWithTax, hasCostTax, hasMultipleSources, display } = props;
  const fm = (v: number) => formatMoneyDisplay(v, display.rate, display.symbol);

  if (hasCostTax) {
    // FASE 6 — Mostrar SIEMPRE "Costo sin imp." cuando hay impuestos (incluso
    // sin múltiples sources). Elimina filas que aparecen/desaparecen sin
    // explicación visual.
    return (
      <div className={cn(vt.row.separatorStrong, "space-y-1")}>
        <div className={cn(vt.row.flexBetween, vt.colors.label)}>
          <span>Costo sin imp.</span>
          <span className="tabular-nums">{fm(unitCost)}</span>
        </div>
        <div className={cn(vt.row.flexCenter, vt.text.totalCard, vt.row.separatorCierre)}>
          <span>Total costo</span>
          <span>{fm(totalCostWithTax)}</span>
        </div>
      </div>
    );
  }
  if (hasMultipleSources) {
    return (
      <div className={cn(vt.row.separatorStrong, "space-y-1")}>
        <div className={cn(vt.row.flexCenter, vt.text.totalCard)}>
          <span>Costo total</span>
          <span>{fm(totalCostWithTax)}</span>
        </div>
      </div>
    );
  }
  return null;
}
