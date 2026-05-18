// src/components/pricing/CostCompositionBlock/parts/HechuraEquivCard.tsx
// ============================================================================
// Card "Hechura" del grid de "Composición del costo" (modo DESGLOSADO).
//
// Contiene: cabecera + resumen colapsado + Origen (líneas hechura) +
// Bonif/Recargo global proporcional + Desglose de impuestos (metal + hechura).
//
// Origen: PricingSimulator.tsx:5137-5318.
// Read-only — usa datos del response y agregaciones puras de helpers.ts.
// ============================================================================

import React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../../ui/tp";
import { formatMoneyDisplay } from "../../../../lib/pricing/format";
import { vt } from "../../../../lib/pricing/visualTokens";
import type { CostCompositionDisplay } from "../types";
import type { HechuraTaxLine } from "../helpers";
import type { PricingStepResult } from "../../../../services/articles";
import { CostLineOtherRow } from "./CostLineOtherRow";

export type HechuraEquivCardProps = {
  hechuraEquiv:         number;
  hechuraLineSteps:     PricingStepResult[];
  hechuraTaxLines:      HechuraTaxLine[];
  totalMetalCostForTax: number;
  hasMetalCost:         boolean;
  hechuraGlobalAdj:     number;
  adjSuffix:            string;
  expanded:             boolean;
  onToggle:             () => void;
  display:              CostCompositionDisplay;
};

export function HechuraEquivCard(props: HechuraEquivCardProps): React.ReactElement {
  const {
    hechuraEquiv, hechuraLineSteps, hechuraTaxLines,
    totalMetalCostForTax, hasMetalCost,
    hechuraGlobalAdj, adjSuffix,
    expanded, onToggle, display,
  } = props;
  const fm = (v: number) => formatMoneyDisplay(v, display.rate, display.symbol);

  const allTaxTotal  = hechuraTaxLines.reduce((a, t) => a + t.totalTax, 0);
  const displayTotal = hechuraTaxLines.length > 0 ? hechuraEquiv + allTaxTotal : hechuraEquiv;

  const hasGlobalAdj = Math.abs(hechuraGlobalAdj) > 0.005;
  const isHechuraBonif = hechuraGlobalAdj < 0;
  const hSumBruto = hechuraEquiv - hechuraGlobalAdj;

  const summaryParts: string[] = [];
  if (hechuraLineSteps.length > 0) summaryParts.push(`${hechuraLineSteps.length} línea${hechuraLineSteps.length === 1 ? "" : "s"}`);
  if (hechuraTaxLines.length > 0) summaryParts.push("impuestos");
  const collapsedSummary = summaryParts.length > 0
    ? `Incluye ${summaryParts.join(" · ")}`
    : null;

  return (
    <div className={vt.card.inner}>
      {/* ── Cabecera ── */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-2 cursor-pointer"
      >
        <p className={cn(vt.text.cardName, vt.colors.cardName, "mt-0.5 shrink-0")}>
          Hechura
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <p className="text-base tabular-nums font-bold text-foreground/90 leading-none text-right">
            {fm(displayTotal)}
          </p>
          <ChevronDown size={14} className={cn(vt.colors.formula, "transition-transform mt-0.5", expanded && "rotate-180")} />
        </div>
      </button>
      {!expanded && collapsedSummary && (
        <p className={cn(vt.text.subLabel, vt.colors.labelSoft, "italic leading-none pt-0.5")}>{collapsedSummary}</p>
      )}

      {expanded && (
        <>
          {/* ── Origen ── */}
          {hechuraLineSteps.length > 0 && (
            <div className="border-t border-border/20 pt-1.5 space-y-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted/60 mb-1">Origen</p>
              <div className="space-y-1 text-xs">
                {hechuraLineSteps.map((step, i) => (
                  <CostLineOtherRow key={`heq-${i}`} step={step} display={display} />
                ))}
              </div>
            </div>
          )}

          {/* ── Bonif/Recargo global proporcional ── */}
          {hasGlobalAdj && (
            <div className="space-y-0.5 border-t border-border/20 pt-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-muted/70">Subtotal hechura</span>
                <span className="text-xs tabular-nums text-foreground/70">{fm(hSumBruto)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-muted/70">
                  {isHechuraBonif ? "Bonif. global" : "Recargo global"}{adjSuffix}
                </span>
                <span className={cn("text-xs tabular-nums",
                  isHechuraBonif ? "text-emerald-600 dark:text-emerald-400"
                                 : "text-amber-600 dark:text-amber-400"
                )}>
                  {isHechuraBonif ? "−" : "+"}{fm(Math.abs(hechuraGlobalAdj))}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2 bg-muted/20 px-2 py-1 rounded mt-1">
                <span className="text-xs font-bold text-muted/70">Subtotal hechura ajustado</span>
                <span className="text-xs tabular-nums font-bold text-foreground/70">{fm(hechuraEquiv)}</span>
              </div>
            </div>
          )}

          {/* ── Desglose de impuestos ── */}
          {hechuraTaxLines.length > 0 && (
            <div className="space-y-1">
              {hechuraLineSteps.length > 1 && !hasGlobalAdj && (
                <div className="flex items-baseline justify-between gap-2 bg-muted/20 px-2 py-1 rounded">
                  <span className="text-xs font-bold text-muted/70">Subtotal</span>
                  <span className="text-xs tabular-nums font-bold text-foreground/70">{fm(hechuraEquiv)}</span>
                </div>
              )}
              {hechuraTaxLines.map((t, ti) => (
                <div key={`htax-sum-${ti}`} className="space-y-0.5 mt-1 pt-1 border-t border-border/30">
                  {hasMetalCost && (
                    <div className="space-y-px">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-medium text-muted">{t.name} {t.rate}% (Compra · metal)</span>
                        <span className="text-xs tabular-nums text-muted shrink-0">+{fm(t.metalPart)}</span>
                      </div>
                      <p className="text-[11px] text-muted tabular-nums font-mono leading-tight mt-0.5">
                        Base: {fm(totalMetalCostForTax)} × {t.rate}% = +{fm(t.metalPart)}
                      </p>
                    </div>
                  )}
                  <div className="space-y-px">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-medium text-muted">{t.name} {t.rate}% (Compra · hechura)</span>
                      <span className="text-xs tabular-nums text-muted shrink-0">+{fm(t.hechuraPart)}</span>
                    </div>
                    <p className="text-[11px] text-muted tabular-nums font-mono leading-tight mt-0.5">
                      Base: {fm(hechuraEquiv)} × {t.rate}% = +{fm(t.hechuraPart)}
                    </p>
                  </div>
                  {hasMetalCost && (
                    <div className="flex items-baseline justify-between gap-2 border-t border-border/30 pt-0.5">
                      <span className="text-xs text-muted font-medium">Total {t.name} {t.rate}%</span>
                      <span className="text-xs tabular-nums text-foreground/70 font-bold shrink-0">+{fm(t.totalTax)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
