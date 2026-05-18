// src/components/pricing/CostCompositionBlock/parts/CostLineMetalRow.tsx
// ============================================================================
// Fila de metal en el cuerpo de "Costo unitario" — estructura UNIFICADA de
// 3 segmentos (idéntica a CostLineOtherRow y a SaleCompositionEditableGrid):
//
//   L1: nombre del metal padre            ............  Costo total (motor)
//   L2: código · nombre variante
//   ── Costo unit.   → SOLO base: gr × precio/gr BASE (sin merma)
//   ── Merma/Ajuste  → nivel A: "Merma X,XX %"  (valor ingresado)
//                       nivel B: impacto monetario (solo si el motor lo emite)
//
// REGLA CRÍTICA (POLICY R4.5): read-only. El precio/gr mostrado es el BASE
// (pre-merma) que emite el motor (`quotePrice`); la merma NO se funde en él.
// El total y el impacto vienen del motor — el frontend NO recalcula.
// ============================================================================

import React from "react";
import { cn } from "../../../ui/tp";
import { formatGrams, formatMoneyDisplay } from "../../../../lib/pricing/format";
import { vt } from "../../../../lib/pricing/visualTokens";
import { buildCostLineTriView } from "../../../../lib/pricing/display/saleCompositionDisplay";
import type { CostCompositionDisplay } from "../types";

export type CostLineMetalRowProps = {
  variantName:     string;
  cost:            number;
  grams:           number | null;
  pricePerGram:    number | null;
  mermaPercent:    number;
  variantSku?:     string | null;
  metalParentName?: string | null;
  /** Impacto monetario de la merma emitido por el motor (passthrough). null
   *  cuando el motor no lo emite → no se muestra nivel B. */
  mermaAmount?:    number | null;
  display:         CostCompositionDisplay;
};

export function CostLineMetalRow(props: CostLineMetalRowProps): React.ReactElement {
  const { variantName, cost, grams, pricePerGram, mermaPercent, variantSku, metalParentName, mermaAmount, display } = props;
  const fm = (v: number) => formatMoneyDisplay(v, display.rate, display.symbol);

  // Vista unificada — labels centralizados (mismo texto en Simulador/Factura).
  const tri = buildCostLineTriView({
    kind:      "METAL",
    unitBase:  pricePerGram,
    qty:       grams,
    mermaPct:  mermaPercent,
    adjAmount: mermaAmount ?? null,
    total:     cost,
  });

  const grStr   = grams != null ? formatGrams(grams) : null;
  const headLabel = metalParentName ?? variantName;
  const variantDesc = metalParentName
    ? (variantSku && variantName ? `${variantSku} · ${variantName}` : variantSku ?? (variantName !== headLabel ? variantName : null))
    : variantSku ?? null;

  return (
    <div className="space-y-0.5 pb-0.5">
      {/* L1 — nombre + Costo total (motor) */}
      <div className={vt.row.flexBetween}>
        <span className="font-medium text-text/80 leading-snug">{headLabel}</span>
        <span className={cn(vt.text.totalCard, vt.colors.text, "shrink-0")}>{fm(tri.total)}</span>
      </div>
      {variantDesc && (
        <p className={cn(vt.text.hint, "font-semibold", vt.colors.labelSoft)}>{variantDesc}</p>
      )}

      {/* Costo unit. — SOLO base (precio/gr PRE-merma) */}
      {tri.base.unit != null && grStr != null && (
        <div className={cn(vt.row.flexBetween, vt.colors.formula)}>
          <span className={vt.text.label}>Costo unit.</span>
          <span className={cn(vt.text.formulaCompact, "tabular-nums")}>
            {grStr} gr × {fm(tri.base.unit)}/gr
          </span>
        </div>
      )}

      {/* Merma / Ajuste — nivel A (ingresado) + nivel B (impacto motor) */}
      {tri.adjust && (
        <div className={cn(vt.row.flexBetween)}>
          <span className={cn(vt.text.label, vt.colors.label)}>Merma / Ajuste</span>
          <span className="flex flex-col items-end leading-tight">
            <span className={cn(vt.text.adjInput, vt.colors.surcharge)}>
              {tri.adjust.inputLabel}
            </span>
            {tri.adjust.impact != null && (
              <span className={cn(vt.text.adjImpact, vt.colors.surcharge)}>
                {/* La merma SIEMPRE aumenta el costo → signo "+".
                    Magnitud = |impacto| emitido por el motor (no se recalcula). */}
                +{fm(Math.abs(tri.adjust.impact))}
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
