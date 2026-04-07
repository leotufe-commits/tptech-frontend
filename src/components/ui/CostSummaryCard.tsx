// src/components/ui/CostSummaryCard.tsx
//
// Card KPI compacta de COSTO.
// Valor principal: "Total costo" cuando hay impuestos de compra, "Costo" cuando no.
// Usa valores directos del backend (computedCostWithTax, computedCostPrice).
//
// Dónde usar: ArticleDetail KPI grid, CostosTab header, cualquier resumen de costo.
// Reemplaza: el bloque {/* Costo */}(() => {...})() en ArticleDetail.tsx.

import React from "react";
import { cn } from "./tp";
import { fmtMoney } from "../../services/articles";

export type CostSummaryCardProps = {
  /** Costo sin impuestos de compra (computedCostPrice.value) */
  baseAmount: number | null;
  /** Impuestos de compra = totalAmount - baseAmount (se deriva si no se pasa) */
  taxAmount?: number | null;
  /** Total con impuestos de compra (computedCostWithTax) */
  totalAmount: number | null;
  /** Símbolo de moneda, ej. "AR$" */
  currencySymbol: string;
  /** Etiqueta de vacío. Default: "Sin calcular" */
  emptyLabel?: string;
  className?: string;
};

export function CostSummaryCard({
  baseAmount,
  taxAmount,
  totalAmount,
  currencySymbol,
  emptyLabel = "Sin calcular",
  className,
}: CostSummaryCardProps) {
  const sym = currencySymbol;

  // Hay impuesto real si totalAmount supera a baseAmount en más de 0.5 centavos
  const hasTax =
    totalAmount != null &&
    baseAmount != null &&
    totalAmount - baseAmount > 0.005;

  const effectiveTax = hasTax && totalAmount != null && baseAmount != null
    ? totalAmount - baseAmount
    : (taxAmount ?? 0);

  // Valor prominente
  const heroValue = hasTax ? totalAmount : baseAmount;
  const heroLabel = hasTax ? "Total costo" : "Costo";

  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-card px-4 py-3 space-y-1",
        className
      )}
    >
      {/* Título */}
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
        {heroLabel}
      </div>

      {/* Valor principal */}
      {heroValue != null ? (
        <div className="text-xl font-bold tabular-nums text-text">
          {fmtMoney(heroValue, sym)}
        </div>
      ) : (
        <div className="text-sm text-muted/50 italic">{emptyLabel}</div>
      )}

      {/* Composición: Base + impuestos */}
      {hasTax && baseAmount != null && (
        <div className="text-[11px] text-muted tabular-nums">
          Base: {fmtMoney(baseAmount, sym)}
          {" · "}
          imp.: +{fmtMoney(effectiveTax, sym)}
        </div>
      )}
    </div>
  );
}
