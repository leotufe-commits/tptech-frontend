// src/components/ui/PriceBreakdown.tsx
//
// Panel expandido de FORMACIÓN DEL PRECIO.
// Muestra en orden: Costo base → Margen → Precio base → Descuento → Precio neto → Impuestos → Total final.
// Omite automáticamente los bloques que no aplican (sin descuento, sin impuestos, exento, precio manual).
//
// Dónde usar:
//   - ArticleDetail → panel expandido de precio
//   - PricingSimulator → breakdown paso a paso
//   - CostosTab → sección "Precio de venta estimado"
// Reemplaza: el bloque "FORMACIÓN DEL PRECIO" dentro de PricingBreakdown en PricingSimulator.tsx.

import React from "react";
import { cn } from "./tp";
import { fmtMoney } from "../../services/articles";

// ── Tipos ──────────────────────────────────────────────────────────────────────

export type PriceBreakdownTax = {
  label: string;   // ej. "IVA", "Percepción IIBB"
  rate?: number;   // ej. 21 (se muestra como "21%")
  amount: number;
};

export type PriceBreakdownProps = {
  /** Costo base sin impuestos (metal + hechura + otros) */
  costBase?: number | null;
  /** Etiqueta del margen, ej. "Lista Minorista 80%" */
  marginLabel?: string;
  /** Monto que agrega el margen (precioBase - costoBase) */
  marginAmount?: number | null;
  /** Precio base = costo × margen, sin descuentos ni impuestos */
  priceBase: number | null;
  /** Origen del precio, ej. "Lista de precios", "Promoción" */
  priceSourceLabel?: string;
  /** Etiqueta del descuento, ej. "Promoción Verano" o "Desc. ×3 u." */
  discountLabel?: string | null;
  /** Monto de descuento (positivo) */
  discountAmount?: number | null;
  /** Precio neto = precio base − descuento */
  netAmount: number | null;
  /** Impuestos de venta aplicados */
  taxes?: PriceBreakdownTax[];
  /** Total final = precio neto + impuestos */
  totalAmount: number | null;
  /** Símbolo de moneda, ej. "AR$" */
  currencySymbol: string;
  /** true cuando el cliente es exento — omite bloque impuestos y muestra nota */
  isTaxExempt?: boolean;
  /** true cuando el precio es manual — omite costo base y margen */
  isManualPrice?: boolean;
  className?: string;
};

// ── Helpers internos ───────────────────────────────────────────────────────────

function BreakdownRow({
  label,
  detail,
  value,
  tone = "neutral",
  size = "normal",
}: {
  label: string;
  detail?: string;
  value: string;
  tone?: "neutral" | "positive" | "negative" | "primary";
  size?: "normal" | "total";
}) {
  const valueClass = cn(
    "tabular-nums text-right font-semibold",
    size === "total" ? "text-sm font-extrabold text-text" : "text-xs",
    tone === "positive"  && "text-emerald-600 dark:text-emerald-400",
    tone === "negative"  && "text-rose-600 dark:text-rose-400",
    tone === "primary"   && "text-primary font-extrabold",
    tone === "neutral"   && size !== "total" && "text-text/80"
  );

  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 px-3 py-1.5">
      <div className="min-w-0">
        <span className={cn("text-xs", size === "total" ? "font-bold text-text" : "text-text/80")}>
          {label}
        </span>
        {detail && (
          <span className="ml-1.5 text-[10px] text-muted/70 font-mono">{detail}</span>
        )}
      </div>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

function SectionDivider() {
  return <div className="border-t border-border/40 mx-3 my-0.5" />;
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 px-3 py-2.5 bg-primary/5 border-t-2 border-primary/20 rounded-b-xl">
      <span className="text-sm font-bold text-text">{label}</span>
      <span className="tabular-nums text-right text-base font-extrabold text-primary">{value}</span>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export function PriceBreakdown({
  costBase,
  marginLabel,
  marginAmount,
  priceBase,
  priceSourceLabel,
  discountLabel,
  discountAmount,
  netAmount,
  taxes,
  totalAmount,
  currencySymbol: sym,
  isTaxExempt = false,
  isManualPrice = false,
  className,
}: PriceBreakdownProps) {
  const hasMargin     = !isManualPrice && costBase != null && marginAmount != null && marginAmount > 0.005;
  const hasDiscount   = discountAmount != null && discountAmount > 0.005;
  const hasTaxes      = !isTaxExempt && taxes != null && taxes.length > 0;
  // Precio neto === precio base cuando no hay descuento (no mostrar fila duplicada)
  const showNetRow    = hasDiscount ||
    (netAmount != null && priceBase != null && Math.abs(netAmount - priceBase) > 0.005);

  const finalValue    = hasTaxes ? totalAmount : netAmount;

  return (
    <div className={cn("rounded-xl border border-border overflow-hidden", className)}>

      {/* ── Encabezado ─────────────────────────────────────────────── */}
      <div className="px-3 py-2 bg-surface2/50 border-b border-border/40">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
          Formación del precio
        </span>
      </div>

      {/* ── Costo base + Margen ───────────────────────────────────── */}
      {!isManualPrice && costBase != null && (
        <>
          <BreakdownRow label="Costo base" value={fmtMoney(costBase, sym)} />
          {hasMargin && (
            <BreakdownRow
              label={marginLabel ?? "Margen"}
              value={`+${fmtMoney(marginAmount!, sym)}`}
              tone="positive"
            />
          )}
          <SectionDivider />
        </>
      )}

      {/* ── Precio base ──────────────────────────────────────────── */}
      {priceBase != null && (
        <BreakdownRow
          label={isManualPrice ? "Precio fijo manual" : "Precio base"}
          detail={!isManualPrice && priceSourceLabel ? priceSourceLabel : undefined}
          value={fmtMoney(priceBase, sym)}
          size={!hasDiscount && !hasTaxes && !showNetRow ? "total" : "normal"}
        />
      )}

      {/* ── Descuento ─────────────────────────────────────────────── */}
      {hasDiscount && (
        <>
          <BreakdownRow
            label={discountLabel ?? "Descuento"}
            value={`−${fmtMoney(discountAmount!, sym)}`}
            tone="negative"
          />
          <SectionDivider />
        </>
      )}

      {/* ── Precio neto ───────────────────────────────────────────── */}
      {showNetRow && netAmount != null && (
        <BreakdownRow
          label="Precio neto"
          value={fmtMoney(netAmount, sym)}
          size={!hasTaxes && !isTaxExempt ? "total" : "normal"}
        />
      )}

      {/* ── Impuestos de venta ────────────────────────────────────── */}
      {hasTaxes && taxes!.map((t, i) => (
        <BreakdownRow
          key={i}
          label={t.label}
          detail={t.rate != null ? `${t.rate}%` : undefined}
          value={`+${fmtMoney(t.amount, sym)}`}
          tone="neutral"
        />
      ))}

      {/* ── Nota de exención ──────────────────────────────────────── */}
      {isTaxExempt && (
        <div className="px-3 py-2 text-[11px] text-muted italic border-t border-border/30">
          Cliente exento de impuestos
        </div>
      )}

      {/* ── Total final ───────────────────────────────────────────── */}
      {finalValue != null && (hasTaxes || isTaxExempt || showNetRow || (priceBase != null && hasDiscount)) && (
        <TotalRow
          label={hasTaxes ? "Total final" : "Precio neto"}
          value={fmtMoney(finalValue, sym)}
        />
      )}
    </div>
  );
}
