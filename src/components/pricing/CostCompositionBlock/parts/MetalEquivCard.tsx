// src/components/pricing/CostCompositionBlock/parts/MetalEquivCard.tsx
// ============================================================================
// Card de equivalencia por METAL PADRE (Oro / Plata / etc.) en el grid de
// "Composición del costo" (modo DESGLOSADO).
//
// Estructura:
//   - Cabecera clickeable: nombre padre · símbolo · gramos totales · chevron
//   - Resumen colapsado: "N orígenes · primer SKU"
//   - Origen (expandible): por variante, qty × factor = equivGr + cálculo monetario
//   - Subtotal: Base · Ajuste % · Subtotal (cuando hay ajuste o >1 variante)
//
// Origen: PricingSimulator.tsx:4979-5135.
// Read-only — usa datos de buildMetalPadreMap (helpers.ts).
// ============================================================================

import React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../../ui/tp";
import { formatGrams, formatMoneyDisplay, formatDecimal, formatDecimalUpTo } from "../../../../lib/pricing/format";
import { vt } from "../../../../lib/pricing/visualTokens";
import type { CostCompositionDisplay } from "../types";
import type { MetalPadreAccum } from "../types";

export type MetalEquivCardProps = {
  padre:           MetalPadreAccum;
  /** Símbolo del metal padre (ej: "Au", "Ag"). Opcional — viene de meta.metalSymbol. */
  metalSymbol?:    string | null;
  /** Cotización compartida del padre (quotePrice). Para mostrar en Subtotal con ajuste. */
  quotePrice?:     number | null;
  adjFactor:       number;
  expanded:        boolean;
  onToggle:        () => void;
  display:         CostCompositionDisplay;
};

export function MetalEquivCard(props: MetalEquivCardProps): React.ReactElement {
  const { padre, metalSymbol, adjFactor, expanded, onToggle, display } = props;
  const fm  = (v: number) => formatMoneyDisplay(v, display.rate, display.symbol);
  const fmM3 = (n: number) => formatGrams(n, 3);

  const totalValue = padre.totalCost * adjFactor;
  const totalGrStr = formatGrams(padre.totalEquivGr);
  const sampleV    = padre.variants.find(v => v.pricePerGram != null && (v.pureGrams ?? 0) > 0.0001 && v.grams != null && v.grams > 0.0001);
  // Precio "puro" del padre: para mostrar en subtotal con ajuste — quotePrice / purity
  const purePrice  = sampleV != null && sampleV.pricePerGram != null && sampleV.pureGrams != null && sampleV.grams != null && sampleV.grams > 0.0001
    ? sampleV.pricePerGram / (sampleV.pureGrams / sampleV.grams)
    : null;

  const hasAdj      = Math.abs(adjFactor - 1) > 0.001;
  const adjAmt      = totalValue - padre.totalCost;
  const adjPct      = (adjFactor - 1) * 100;
  const isAdjBonif  = adjFactor < 1;

  const firstSku = padre.variants[0]?.variantSku ?? null;
  const collapsedSummary = padre.variants.length > 0
    ? `${padre.variants.length} ${padre.variants.length === 1 ? "origen" : "orígenes"}${firstSku ? ` · ${firstSku}` : ""}`
    : null;

  return (
    <div className={vt.card.inner}>
      {/* ── Cabecera ── */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-2 cursor-pointer"
      >
        <div className="min-w-0 text-left">
          <p className={cn(vt.text.cardName, vt.colors.cardName, "mt-0.5 truncate")}>
            {padre.parentName}
            {metalSymbol && (
              <span className="text-[10px] font-normal text-foreground/35 ml-1">({metalSymbol})</span>
            )}
          </p>
          {!expanded && collapsedSummary && (
            <p className={cn(vt.text.subLabel, vt.colors.labelSoft, "italic leading-none pt-1 truncate")}>{collapsedSummary}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <p className="text-base tabular-nums font-bold text-foreground/90 leading-tight text-right">
            {metalSymbol && <span className={cn(vt.text.subLabel, "font-semibold mr-1", vt.colors.labelSoft)}>{metalSymbol}</span>}
            {totalGrStr} gr
          </p>
          <ChevronDown size={14} className={cn(vt.colors.formula, "transition-transform mt-0.5", expanded && "rotate-180")} />
        </div>
      </button>

      {/* ── Origen (expandible) ── */}
      {expanded && (
        <div className="border-t border-border/20 pt-1.5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted/60 mb-1">Origen</p>
          <div className="space-y-1">
            {padre.variants.map((v, vi) => {
              const qStr  = v.grams    != null ? formatGrams(v.grams) : null;
              const purity = v.pureGrams != null && v.grams != null && v.grams > 0.0001 ? v.pureGrams / v.grams : null;
              const factor = purity != null
                ? purity * (v.mermaPercent !== 0 ? (1 + v.mermaPercent / 100) : 1)
                : (1 + v.mermaPercent / 100);
              const equivGr = v.grams != null ? v.grams * factor : 0;
              const fStr   = fmM3(factor);
              const gStr   = formatGrams(equivGr);
              const originLabel = v.variantName;

              let factorDesc = "";
              if (purity != null && v.mermaPercent !== 0) {
                const pPct = formatDecimalUpTo(purity * 100, 2);
                factorDesc = `pureza ${pPct}% × merma ${fmM3(v.mermaPercent)}%`;
              } else if (purity != null) {
                const pPct = formatDecimalUpTo(purity * 100, 2);
                factorDesc = `pureza ${pPct}%`;
              } else if (v.mermaPercent !== 0) {
                factorDesc = `merma ${fmM3(v.mermaPercent)}%`;
              }

              const purePricePerGr = v.pricePerGram != null
                ? (purity != null && purity > 0.0001 ? v.pricePerGram / purity : v.pricePerGram)
                : null;
              const showGramsCalc = Math.abs(factor - 1) > 0.001 && (v.grams ?? 0) > 0.0001;
              const showMoneyCalc = purePricePerGr != null && equivGr > 0.0001;

              return (
                <div key={vi} className="cursor-default leading-snug space-y-px">
                  <div className="flex items-baseline justify-between gap-2 text-[11px] tabular-nums">
                    <span className="min-w-0 truncate text-muted">
                      <span className="font-medium">{originLabel}</span>
                      {v.variantSku && <span className="ml-1 font-mono text-muted/70">· {v.variantSku}</span>}
                    </span>
                    <span className="shrink-0 text-muted/70">{gStr} gr</span>
                  </div>
                  {showGramsCalc && qStr && (
                    <p className="text-[11px] text-muted tabular-nums font-mono leading-tight mt-0.5">
                      {qStr} gr × {fStr} = {gStr} gr
                      {factorDesc && <span className="ml-1 text-muted/35">({factorDesc})</span>}
                    </p>
                  )}
                  {showMoneyCalc && (
                    <p className="text-[11px] text-muted tabular-nums font-mono leading-tight mt-0.5">
                      {gStr} gr × {fm(purePricePerGr!)}/gr = {fm(v.cost)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Subtotal — cuando aporta info nueva ── */}
      {(hasAdj || padre.variants.length > 1) && (
        <div className="border-t border-border/20 pt-1.5 space-y-0.5">
          {hasAdj ? (
            <>
              {purePrice != null && (
                <div
                  className="flex items-baseline justify-between gap-2"
                  title={`${totalGrStr} gr × ${fm(purePrice)}/gr = ${fm(padre.totalCost)}`}
                >
                  <span className="text-xs text-muted/70">Base</span>
                  <span className="text-xs tabular-nums text-foreground/70">{fm(padre.totalCost)}</span>
                </div>
              )}
              <div
                className="flex items-baseline justify-between gap-2"
                title={`${isAdjBonif ? "−" : "+"}${formatDecimal(Math.abs(adjPct), 2)}%`}
              >
                <span className="text-xs text-muted/70">
                  Ajuste ({isAdjBonif ? "−" : "+"}{formatDecimal(Math.abs(adjPct), 1)}%)
                </span>
                <span className={cn(
                  "text-xs tabular-nums shrink-0",
                  isAdjBonif ? "text-emerald-600/80 dark:text-emerald-400/80"
                             : "text-amber-600/80 dark:text-amber-400/80"
                )}>
                  {isAdjBonif ? "−" : "+"}{fm(Math.abs(adjAmt))}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2 bg-muted/20 px-2 py-1 rounded mt-1">
                <span className="text-xs font-bold text-muted/70">Subtotal</span>
                <span className="text-xs tabular-nums font-bold text-foreground/70">{fm(totalValue)}</span>
              </div>
            </>
          ) : (
            <div
              className="flex items-baseline justify-between gap-2 bg-muted/20 px-2 py-1 rounded"
              title={purePrice != null ? `${totalGrStr} gr × ${fm(purePrice)}/gr = ${fm(totalValue)}` : undefined}
            >
              <span className="text-xs font-bold text-muted/70">Subtotal</span>
              <span className="text-xs tabular-nums font-bold text-foreground/70">{fm(totalValue)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
