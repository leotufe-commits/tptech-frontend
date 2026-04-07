// src/components/ui/CostBreakdown.tsx
//
// Panel expandido de COMPOSICIÓN DE COSTO.
// Muestra en orden: Metal → Merma → Hechura → Otros → Costo base → Imp. compra → Total costo.
// Omite filas vacías y adapta el layout según el modo de cálculo del artículo.
//
// Dónde usar:
//   - ArticleDetail → panel expandido de costo
//   - CostosTab → desglose completo
//   - PricingSimulator → sección de costo en breakdown
// Reemplaza: el bloque de composición de costo en PricingBreakdown (PricingSimulator.tsx) y CostosTab.tsx.

import React from "react";
import { cn } from "./tp";
import { fmtMoney } from "../../services/articles";

// ── Tipos ──────────────────────────────────────────────────────────────────────

export type CostBreakdownRowKind =
  | "metal"    // Metal (variante × gramos)
  | "merma"    // Pérdida por fundición
  | "hechura"  // Mano de obra
  | "other"    // Otros costos (servicios, insumos, etc.)
  | "tax";     // Impuesto de compra (IVA, percepción, etc.)

export type CostBreakdownRow = {
  kind: CostBreakdownRowKind;
  /** Nombre del item, ej. "Oro 18k", "Hechura", "IVA compra" */
  label: string;
  /** Detalle adicional, ej. "10 g × AR$5.000/g", "5%", "21%" */
  detail?: string;
  /** Monto del item (siempre positivo) */
  amount: number;
};

export type CostBreakdownProps = {
  /** Filas de composición (metal, merma, hechura, otros, impuestos) */
  rows: CostBreakdownRow[];
  /** Costo base = suma de metal + merma + hechura + otros, sin impuestos */
  baseAmount: number | null;
  /** Total costo = costo base + impuestos de compra */
  totalAmount: number | null;
  /** Símbolo de moneda, ej. "AR$" */
  currencySymbol: string;
  /**
   * Modo de cálculo del artículo:
   * - METAL_MERMA_HECHURA: desglose estándar
   * - COST_LINES: líneas de costo genéricas
   * - MULTIPLIER: fórmula de multiplicador
   * - MANUAL: solo muestra el costo base ingresado manualmente
   */
  mode?: "MANUAL" | "MULTIPLIER" | "METAL_MERMA_HECHURA" | "COST_LINES";
  /** Datos extra para el modo MULTIPLIER */
  multiplier?: {
    quantity: number;
    valuePerUnit: number;
    unitLabel?: string; // ej. "g", "u.", "kg"
  };
  /** Oculta el header "Composición de costo" — útil cuando se embebe dentro de otro panel */
  hideHeader?: boolean;
  className?: string;
};

// ── Helpers internos ───────────────────────────────────────────────────────────

const KIND_SIGN: Record<CostBreakdownRowKind, "+" | ""> = {
  metal:   "",
  merma:   "+",
  hechura: "",
  other:   "",
  tax:     "+",
};

function BreakdownRow({
  label,
  detail,
  value,
  isTax = false,
}: {
  label: string;
  detail?: string;
  value: string;
  isTax?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 px-3 py-1.5">
      <div className="min-w-0">
        <span className={cn("text-xs", isTax ? "text-muted" : "text-text/80")}>
          {label}
        </span>
        {detail && (
          <span className="ml-1.5 text-[10px] text-muted/70 font-mono">{detail}</span>
        )}
      </div>
      <span className={cn(
        "tabular-nums text-right text-xs font-semibold",
        isTax ? "text-amber-600 dark:text-amber-400" : "text-text/80"
      )}>
        {isTax ? `+${value}` : value}
      </span>
    </div>
  );
}

function SectionDivider() {
  return <div className="border-t border-border/40 mx-3 my-0.5" />;
}

function SubtotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 px-3 py-2">
      <span className="text-xs font-bold text-text">{label}</span>
      <span className="tabular-nums text-right text-sm font-bold text-text">{value}</span>
    </div>
  );
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

export function CostBreakdown({
  rows,
  baseAmount,
  totalAmount,
  currencySymbol: sym,
  mode = "METAL_MERMA_HECHURA",
  multiplier,
  hideHeader = false,
  className,
}: CostBreakdownProps) {
  // Separar filas de costo de filas de impuesto
  const costRows = rows.filter(r => r.kind !== "tax");
  const taxRows  = rows.filter(r => r.kind === "tax");

  const hasTaxRows  = taxRows.length > 0;
  const hasCostRows = costRows.length > 0;

  // Hay impuesto real si totalAmount > baseAmount
  const hasTax =
    hasTaxRows ||
    (totalAmount != null && baseAmount != null && totalAmount - baseAmount > 0.005);

  const heroValue = hasTax ? totalAmount : baseAmount;
  const heroLabel = hasTax ? "Total costo" : "Costo base";

  return (
    <div className={cn("rounded-xl border border-border overflow-hidden", className)}>

      {/* ── Encabezado ─────────────────────────────────────────────── */}
      {!hideHeader && (
        <div className="px-3 py-2 bg-surface2/50 border-b border-border/40">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
            Composición de costo
          </span>
        </div>
      )}

      {/* ── Modo MANUAL (legacy → hechura fija) ──────────────────── */}
      {mode === "MANUAL" && (
        <>
          {baseAmount != null && (
            <BreakdownRow
              label="Hechura (costo fijo)"
              value={fmtMoney(baseAmount, sym)}
            />
          )}
        </>
      )}

      {/* ── Modo MULTIPLIER (legacy → hechura por unidad) ─────────── */}
      {mode === "MULTIPLIER" && multiplier != null && (
        <>
          <BreakdownRow
            label="Hechura"
            detail={`${multiplier.quantity} ${multiplier.unitLabel ?? "u."} × ${fmtMoney(multiplier.valuePerUnit, sym)}`}
            value={fmtMoney(multiplier.quantity * multiplier.valuePerUnit, sym)}
          />
        </>
      )}

      {/* ── Modos METAL_MERMA_HECHURA y COST_LINES ───────────────── */}
      {(mode === "METAL_MERMA_HECHURA" || mode === "COST_LINES") && hasCostRows && (
        <>
          {costRows.map((row, i) => (
            <BreakdownRow
              key={i}
              label={row.label}
              detail={row.detail}
              value={`${KIND_SIGN[row.kind]}${fmtMoney(row.amount, sym)}`}
            />
          ))}
        </>
      )}

      {/* ── Costo base (subtotal de producción) ──────────────────── */}
      {baseAmount != null && (hasCostRows || mode === "MULTIPLIER") && (
        <>
          <SectionDivider />
          {hasTax ? (
            <SubtotalRow label="Costo base" value={fmtMoney(baseAmount, sym)} />
          ) : (
            <TotalRow label="Costo base" value={fmtMoney(baseAmount, sym)} />
          )}
        </>
      )}

      {/* ── Impuestos de compra ───────────────────────────────────── */}
      {hasTaxRows && (
        <>
          {taxRows.map((row, i) => (
            <BreakdownRow
              key={i}
              label={row.label}
              detail={row.detail}
              value={fmtMoney(row.amount, sym)}
              isTax
            />
          ))}
        </>
      )}

      {/* ── Total costo ───────────────────────────────────────────── */}
      {hasTax && heroValue != null && (
        <TotalRow label={heroLabel} value={fmtMoney(heroValue, sym)} />
      )}
    </div>
  );
}
