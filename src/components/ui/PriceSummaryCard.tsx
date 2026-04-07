// src/components/ui/PriceSummaryCard.tsx
//
// Card KPI compacta de PRECIO DE VENTA.
// Valor principal: "Total final" cuando hay impuestos, "Precio" cuando no.
// Siempre usa valores calculados por el backend — nunca recalcula.
//
// Dónde usar: ArticleDetail KPI grid, cualquier pantalla que muestre precio de venta en card compacta.
// Reemplaza: el bloque {/* Precio de venta */}(() => {...})() en ArticleDetail.tsx.

import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./tp";
import { fmtMoney } from "../../services/articles";

export type PriceSummaryCardProps = {
  /** Precio sin impuestos de venta (pricingPreview.unitPrice parseado) */
  netAmount: number | null;
  /** Impuestos de venta totales = totalAmount - netAmount */
  taxAmount: number | null;
  /** Total con impuestos (pricingPreview.totalWithTax parseado) */
  totalAmount: number | null;
  /** Símbolo de moneda, ej. "AR$" */
  currencySymbol: string;
  /** true cuando el cliente/contexto es exento de impuestos */
  isTaxExempt?: boolean;
  /** true mientras se está cargando el precio */
  loading?: boolean;
  /** Fuente del precio (ej. "Lista de precios") — solo se muestra cuando no hay composición */
  priceSourceLabel?: string;
  /** Etiqueta de vacío. Default: "Sin precio" */
  emptyLabel?: string;
  className?: string;
};

export function PriceSummaryCard({
  netAmount,
  taxAmount,
  totalAmount,
  currencySymbol,
  isTaxExempt = false,
  loading = false,
  priceSourceLabel,
  emptyLabel = "Sin precio",
  className,
}: PriceSummaryCardProps) {
  const sym = currencySymbol;

  // Hay impuesto real si totalAmount supera a netAmount en más de 0.5 centavos
  const hasTax =
    !isTaxExempt &&
    !loading &&
    totalAmount != null &&
    netAmount != null &&
    totalAmount - netAmount > 0.005;

  const effectiveTax = hasTax && totalAmount != null && netAmount != null
    ? totalAmount - netAmount
    : (taxAmount ?? 0);

  // Valor prominente
  const heroValue = hasTax ? totalAmount : netAmount;
  const heroLabel = hasTax ? "Total final" : "Precio";

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
      {loading ? (
        <Loader2 size={16} className="animate-spin text-muted" />
      ) : heroValue != null ? (
        <div className="text-xl font-bold tabular-nums text-text">
          {fmtMoney(heroValue, sym)}
        </div>
      ) : (
        <div className="text-sm text-muted/50 italic">{emptyLabel}</div>
      )}

      {/* Composición: Neto + impuestos (cuando hay impuestos) */}
      {hasTax && netAmount != null && !loading && (
        <div className="text-[11px] text-muted tabular-nums">
          Neto: {fmtMoney(netAmount, sym)}
          {" · "}
          imp.: +{fmtMoney(effectiveTax, sym)}
        </div>
      )}

      {/* Fuente de precio (solo cuando no hay composición de impuestos) */}
      {!hasTax && !isTaxExempt && priceSourceLabel && !loading && (
        <div className="text-[11px] text-muted truncate">{priceSourceLabel}</div>
      )}

      {/* Nota de exención */}
      {isTaxExempt && netAmount != null && !loading && (
        <div className="text-[11px] text-muted italic">
          Cliente exento de impuestos
        </div>
      )}
    </div>
  );
}
