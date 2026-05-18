// src/components/pricing/PriceCompositionCards/parts/MetalSaleCard.tsx
// ============================================================================
// Card de equivalencia por METAL PADRE en venta (modo DESGLOSADO).
//
// Origen: PricingSimulator.tsx:4684-4811 (renderizador del padre dentro del
// grid).
//
// Estructura:
//   - Cabecera clickeable: nombre padre · símbolo · gramos venta · chevron
//   - Resumen colapsado: N orígenes · primer SKU
//   - Origen (expandible): por variante con qty × factor = equivGr + cálculo monetario
//   - Subtotal: cuando hay >1 variante
//
// Read-only — usa datos de buildMetalSaleMap (helpers.ts).
// ============================================================================

import React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../../ui/tp";
import { formatGrams, formatMoneyDisplay, formatDecimal, formatDecimalUpTo } from "../../../../lib/pricing/format";
import { vt } from "../../../../lib/pricing/visualTokens";
import type { MetalSaleParent } from "../types";
import type { PricingStepsDisplay } from "../../PricingStepsBreakdown/types";

export type MetalSaleCardProps = {
  padre:           MetalSaleParent;
  /** Factor global metal — usado para `saleGramsTotal` y mostrar gramos de venta. */
  metalSaleFactor: number | null;
  /** Margen % metal del motor — para decidir mostrar "gramos venta" vs "equivGr". */
  marginPct:       number;
  expanded:        boolean;
  onToggle:        () => void;
  display:         PricingStepsDisplay;
};

export function MetalSaleCard(props: MetalSaleCardProps): React.ReactElement {
  const { padre, metalSaleFactor, marginPct, expanded, onToggle, display } = props;
  const fm  = (v: number) => formatMoneyDisplay(v, display.rate, display.symbol);
  const fmM3 = (n: number) => formatGrams(n, 3);

  // saleGramsTotal = gramos base × factor de margen (el margen se ve como gramos extras).
  const saleGramsTotal = metalSaleFactor != null && padre.totalEquivGr > 0.0001
    ? padre.totalEquivGr * metalSaleFactor : null;
  const basePricePerGr = saleGramsTotal != null && saleGramsTotal > 0.0001
    ? padre.totalCost / saleGramsTotal : null;
  const saleGrStr = saleGramsTotal != null ? formatGrams(saleGramsTotal) : null;
  const totalGrStr = formatGrams(padre.totalEquivGr);
  const spg = padre.totalEquivGr > 0.0001 ? padre.totalCost / padre.totalEquivGr : null;
  const displayGrStr = saleGrStr ?? totalGrStr;

  const firstSku = padre.variants[0]?.sku ?? null;
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
            {padre.displayName}
            {padre.symbol && (
              <span className="text-[10px] font-normal text-foreground/35 ml-1">({padre.symbol})</span>
            )}
          </p>
          {!expanded && collapsedSummary && (
            <p className={cn(vt.text.subLabel, vt.colors.labelSoft, "italic leading-none pt-1 truncate")}>
              {collapsedSummary}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <p className="text-base tabular-nums font-bold text-foreground/90 leading-tight text-right">
            {padre.symbol && (
              <span className={cn(vt.text.subLabel, "font-semibold mr-1", vt.colors.labelSoft)}>{padre.symbol}</span>
            )}
            {displayGrStr} gr
          </p>
          <ChevronDown size={14} className={cn(vt.colors.formula, "transition-transform mt-0.5", expanded && "rotate-180")} />
        </div>
      </button>

      {/* ── Origen (expandible) ── */}
      {expanded && padre.variants.length > 0 && (
        <div className="border-t border-border/20 pt-1.5">
          <p className={cn(vt.text.label, "font-semibold uppercase tracking-widest mb-1", vt.colors.formula)}>Origen</p>
          <div className="space-y-1.5">
            {padre.variants.map((v, vi) => {
              // PASO 1 — equivalente de COSTO (gramos × ley [× merma]).
              // `v.equivGr` ya lo emite buildMetalSaleMap: NO se recalcula.
              const qStr  = formatGrams(v.qty);
              const gStr  = formatGrams(v.equivGr);
              const originLabel = v.variantName ?? padre.displayName;

              // PASO 2 — factor de venta/margen aplicado (mismo dato que
              // genera el total de la card: Σ v.equivGr × metalSaleFactor).
              const hasFactor = metalSaleFactor != null
                && Math.abs(metalSaleFactor - 1) > 0.0005;
              const vSaleGr   = hasFactor ? v.equivGr * (metalSaleFactor as number) : v.equivGr;
              const finalStr  = formatGrams(vSaleGr);
              const factorStr = metalSaleFactor != null
                ? formatDecimal(metalSaleFactor, 2)
                : null;

              // Línea A explícita: "1,10 gr × ley 0,700 [× merma 10%] [× merma venta X%] = 0,77 gr".
              const factorBits: string[] = [];
              if (v.purity != null) factorBits.push(`ley ${fmM3(v.purity)}`);
              if (v.merma != null && v.merma > 0)
                factorBits.push(`merma ${formatDecimalUpTo(v.merma, 3)}%`);
              if (v.saleFactor != null && Math.abs(v.saleFactor - 1) > 0.0001)
                factorBits.push(`merma venta ${formatDecimalUpTo((v.saleFactor - 1) * 100, 2)}%`);
              const lineA = `${qStr} gr${factorBits.length ? ` × ${factorBits.join(" × ")}` : ""} = ${gStr} gr`;

              return (
                <div key={vi} className="cursor-default leading-snug space-y-px">
                  <div className={cn(vt.row.flexBetween, vt.text.subLabel, "tabular-nums")}>
                    <span className={cn("min-w-0 truncate", vt.colors.label)}>
                      <span className="font-medium">{originLabel}</span>
                      {v.sku && <span className={cn("ml-1 font-mono", vt.colors.labelSoft)}>· {v.sku}</span>}
                    </span>
                    <span className={cn("shrink-0 font-semibold", vt.colors.labelSoft)}>{finalStr} gr</span>
                  </div>
                  {v.qty > 0.0001 && (
                    <p className={cn(vt.text.formulaCompact, vt.colors.label, "mt-0.5")}>{lineA}</p>
                  )}
                  {hasFactor && factorStr && (
                    <p className={cn(vt.text.formulaCompact, vt.colors.label)}>
                      {gStr} gr × factor {factorStr} = {finalStr} gr
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          {/* Total auditable: Σ de los gramos finales por variante. */}
          <div className={cn(vt.row.flexBetween, vt.text.subLabel, "tabular-nums border-t border-border/20 pt-1.5 mt-1.5")}>
            <span className={cn("min-w-0 truncate", vt.colors.label)}>
              Total{padre.variants.length > 1 ? (
                <span className={cn("ml-1 font-mono text-[10px]", vt.colors.labelSoft)}>
                  {padre.variants
                    .map((v) => formatGrams(
                      metalSaleFactor != null && Math.abs(metalSaleFactor - 1) > 0.0005
                        ? v.equivGr * (metalSaleFactor as number)
                        : v.equivGr,
                    ))
                    .join(" + ")}
                </span>
              ) : null}
            </span>
            <span className={cn("shrink-0 font-bold", vt.colors.subtotal)}>{displayGrStr} gr</span>
          </div>
        </div>
      )}

      {/* ── Subtotal — solo cuando aporta info (>1 variante) ── */}
      {padre.variants.length > 1 && (
        <div className="border-t border-border/20 pt-1.5">
          <div
            className={cn(vt.row.flexBetween, vt.card.pill)}
            title={
              saleGrStr != null && basePricePerGr != null
                ? `${saleGrStr} gr${marginPct > 0.01 ? ` (incl. +${formatDecimal(marginPct, 1)}%)` : ""} × ${fm(basePricePerGr)}/gr = ${fm(padre.totalCost)}`
                : spg != null
                  ? `${totalGrStr} gr × ${fm(spg)}/gr = ${fm(padre.totalCost)}`
                  : undefined
            }
          >
            <span className={cn(vt.text.subtotalRow, vt.colors.labelSoft)}>Subtotal</span>
            <span className={cn(vt.text.subtotalRow, vt.colors.subtotal)}>{fm(padre.totalCost)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
