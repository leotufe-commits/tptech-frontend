// src/components/pricing/CostCompositionBlock/parts/CostLineOtherRow.tsx
// ============================================================================
// Fila de hechura / producto / servicio / manual — estructura UNIFICADA de
// 3 segmentos (idéntica a CostLineMetalRow y a SaleCompositionEditableGrid):
//
//   L1: descripción de la línea          ............  Costo total (motor)
//   ── Costo unit.   → SOLO base: valor unitario (+ conversión de moneda si
//                       aplica, PRE-ajuste). NO incluye el ajuste.
//   ── Merma/Ajuste  → nivel A: "Bonif. X,XX %" / "Recargo X,XX %" / fija
//                       nivel B: impacto monetario `lineAdjAmount` (motor)
//
// REGLA CRÍTICA (POLICY R4.5): read-only. El impacto monetario se LEE de
// `lineAdjAmount` (passthrough del motor, firmado). El frontend NO revierte
// ni recalcula el ajuste.
// ============================================================================

import React from "react";
import { cn } from "../../../ui/tp";
import { formatMoneyAmount as fmtMoney, formatMoneyDisplay, formatDecimalUpTo } from "../../../../lib/pricing/format";
import { vt } from "../../../../lib/pricing/visualTokens";
import { LINE_TYPE_NAMES, GENERIC_TYPE_LABELS } from "../helpers";
import { buildCostLineTriView } from "../../../../lib/pricing/display/saleCompositionDisplay";
import type { CostCompositionDisplay } from "../types";
import type { PricingStepResult } from "../../../../services/articles";

export type CostLineOtherRowProps = {
  step:    PricingStepResult;
  display: CostCompositionDisplay;
};

export function CostLineOtherRow(props: CostLineOtherRowProps): React.ReactElement {
  const { step, display } = props;
  const fm = (v: number) => formatMoneyDisplay(v, display.rate, display.symbol);

  const m       = ((step as { meta?: Record<string, unknown> | null }).meta ?? {}) as Record<string, unknown>;
  const postAdj = parseFloat(String(step.value));

  // Vista unificada — labels e impacto centralizados (passthrough motor).
  const num = (v: unknown): number | null =>
    v != null && Number.isFinite(parseFloat(String(v))) ? parseFloat(String(v)) : null;
  const tri = buildCostLineTriView({
    kind:      "OTHER",
    unitBase:  num(m.unitValue),
    qty:       num(m.qty),
    adjKind:   (m.lineAdjKind as "BONUS" | "SURCHARGE" | undefined) ?? null,
    adjType:   (m.lineAdjType as "PERCENTAGE" | "FIXED_AMOUNT" | undefined) ?? null,
    adjValue:  num(m.lineAdjValue),
    adjAmount: num(m.lineAdjAmount), // impacto firmado del motor
    total:     postAdj,
  });

  const rawLabel    = String(m.lineLabel ?? m.lineCode ?? "");
  const customLabel = rawLabel && !GENERIC_TYPE_LABELS.has(rawLabel) ? rawLabel : null;
  const headLabel   = customLabel ?? LINE_TYPE_NAMES[String(step.key)] ?? "Componente";

  // Base unit. — conversión de moneda PRE-ajuste (passthrough del motor).
  let baseText: string | null = null;
  if (m.originalAmount != null && m.rate != null && m.currencyCode) {
    const origAmt  = parseFloat(String(m.originalAmount));
    const convRate = parseFloat(String(m.rate));
    const code     = String(m.currencyCode);
    const rateStr  = formatDecimalUpTo(convRate, 2);
    baseText = `${code} ${fmtMoney(origAmt, "").trim()} × ${rateStr} = ${fm(origAmt * convRate)}`;
  } else if (tri.base.unit != null && tri.base.unit > 0.0001) {
    const qty = tri.base.qty;
    baseText = qty != null && qty > 0.0001
      ? `${formatDecimalUpTo(qty, 3)} × ${fm(tri.base.unit)}`
      : fm(tri.base.unit);
  }

  const isBonif   = tri.adjust?.kind === "BONUS";
  const adjTone   = isBonif ? vt.colors.bonus : vt.colors.surcharge;

  return (
    <div className="space-y-0.5">
      {/* L1 — descripción + Costo total (motor) */}
      <div className={vt.row.flexBetween}>
        <span className={cn(vt.text.label, "font-medium", vt.colors.label)}>{headLabel}</span>
        <span className={cn(vt.text.totalCard, vt.colors.subtotalStrong, "shrink-0")}>
          {fm(tri.total)}
        </span>
      </div>

      {/* Costo unit. — SOLO base (sin ajuste) */}
      {baseText && (
        <div className={cn(vt.row.flexBetween, vt.colors.formula)}>
          <span className={vt.text.label}>Costo unit.</span>
          <span className={cn(vt.text.formulaCompact, "tabular-nums text-right")}>{baseText}</span>
        </div>
      )}

      {/* Merma / Ajuste — nivel A (ingresado) + nivel B (impacto motor) */}
      {tri.adjust && (
        <div className={vt.row.flexBetween}>
          <span className={cn(vt.text.label, vt.colors.label)}>Merma / Ajuste</span>
          <span className="flex flex-col items-end leading-tight">
            <span className={cn(vt.text.adjInput, adjTone)}>{tri.adjust.inputLabel}</span>
            {tri.adjust.impact != null && (
              <span className={cn(vt.text.adjImpact, adjTone)}>
                {/* Signo por TIPO (BONIF reduce → −, RECARGO aumenta → +),
                    NO por el signo crudo del motor (convención interna:
                    positivo = reducción). Magnitud = |impacto| del motor.
                    Idéntico a AdjustmentLabelEditor de la grilla. */}
                {isBonif ? "−" : "+"}{fm(Math.abs(tri.adjust.impact))}
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
