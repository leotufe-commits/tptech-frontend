// src/components/ui/TPKpiBar.tsx
// ============================================================================
// TPKpiBar — barra estándar de KPIs para pantallas TPTech (Almacenes,
// Stock por depósito, Ventas, Compras, Caja, Informes, etc.).
//
// Reglas:
//   · Estilo alineado con TPCard (rounded-2xl · border-border · bg-card).
//   · Tones compatibles con TPBadge / TPStatusPill.
//   · Grid responsive. Si no se pasa `columns`, el layout se ajusta solo.
//   · Skeleton opt-in por ítem cuando `loading=true`.
//   · Cards clickeables con cursor + hover + foco accesible cuando tienen onClick.
//
// Convención: este componente sólo renderiza. La data la arma el caller.
// ============================================================================

import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "./tp";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────────

export type TPKpiTone =
  | "neutral"
  | "primary"
  | "info"
  | "success"
  | "warning"
  | "danger";

export type TPKpiDelta = {
  value: string;
  direction: "up" | "down" | "flat";
};

export type TPKpiItem = {
  id: string;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: TPKpiTone;
  loading?: boolean;
  onClick?: () => void;
  delta?: TPKpiDelta;
};

export type TPKpiBarProps = {
  items: TPKpiItem[];
  /** Cantidad fija de columnas. Si se omite, el grid se adapta automáticamente. */
  columns?: 2 | 3 | 4 | 5 | 6;
  /** Padding reducido y tamaños de fuente más chicos. Default: false. */
  compact?: boolean;
  className?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de estilo por tone
// ─────────────────────────────────────────────────────────────────────────────

type ToneClasses = {
  /** Color del número principal (valor). */
  valueText: string;
  /** Color del ícono + del borde lateral acento. */
  accent: string;
  /** Borde lateral izquierdo que da la "pista" de tono. */
  accentBorder: string;
};

function toneClasses(tone: TPKpiTone): ToneClasses {
  switch (tone) {
    case "primary":
      return {
        valueText: "text-primary",
        accent: "text-primary",
        accentBorder: "border-l-primary/60",
      };
    case "info":
      return {
        valueText: "text-primary",
        accent: "text-primary",
        accentBorder: "border-l-primary/60",
      };
    case "success":
      return {
        valueText: "text-emerald-500 dark:text-emerald-400",
        accent: "text-emerald-500 dark:text-emerald-400",
        accentBorder: "border-l-emerald-500/60",
      };
    case "warning":
      return {
        valueText: "text-amber-500 dark:text-amber-400",
        accent: "text-amber-500 dark:text-amber-400",
        accentBorder: "border-l-amber-500/60",
      };
    case "danger":
      return {
        valueText: "text-red-500 dark:text-red-400",
        accent: "text-red-500 dark:text-red-400",
        accentBorder: "border-l-red-500/60",
      };
    case "neutral":
    default:
      return {
        valueText: "text-text",
        accent: "text-muted",
        accentBorder: "border-l-border",
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de layout
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mapa explícito de clases de grid: Tailwind JIT no evalúa interpolaciones
 * dinámicas tipo `grid-cols-${n}`, por eso las variantes están escritas.
 */
const COLS_MAP: Record<2 | 3 | 4 | 5 | 6, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
  5: "grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
  6: "grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
};

const AUTO_COLS = "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componente Card
// ─────────────────────────────────────────────────────────────────────────────

type CardProps = {
  item: TPKpiItem;
  compact: boolean;
};

function KpiCard({ item, compact }: CardProps) {
  const { valueText, accent, accentBorder } = toneClasses(item.tone ?? "neutral");
  const clickable = typeof item.onClick === "function";
  const padX = compact ? "px-3" : "px-4";
  const padY = compact ? "py-2.5" : "py-3";

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (item.loading) {
    return (
      <div
        aria-busy
        aria-live="polite"
        className={cn(
          "rounded-2xl border border-border bg-card border-l-2 border-l-border",
          padX, padY,
          "min-w-0",
        )}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <div className="h-3 w-3 rounded bg-surface2/70 animate-pulse" />
          <div className="h-3 w-24 rounded bg-surface2/70 animate-pulse" />
        </div>
        <div className={cn("rounded bg-surface2/70 animate-pulse mb-1.5", compact ? "h-5 w-16" : "h-6 w-20")} />
        <div className="h-3 w-32 rounded bg-surface2/50 animate-pulse" />
      </div>
    );
  }

  // ── Contenido real ───────────────────────────────────────────────────────
  const content = (
    <>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted uppercase tracking-wide min-w-0">
          {item.icon ? <span className={cn("shrink-0", accent)}>{item.icon}</span> : null}
          <span className="truncate">{item.label}</span>
        </div>
        {item.delta ? <Delta delta={item.delta} /> : null}
      </div>

      <div
        className={cn(
          "font-bold tabular-nums truncate",
          compact ? "text-base" : "text-lg",
          valueText,
        )}
      >
        {item.value}
      </div>

      {item.hint ? (
        <div className="text-[11px] text-muted mt-0.5 truncate">{item.hint}</div>
      ) : null}
    </>
  );

  const baseCardClass = cn(
    "rounded-2xl border border-border bg-card",
    "border-l-2",
    accentBorder,
    padX, padY,
    "min-w-0 text-left",
  );

  if (clickable) {
    return (
      <button
        type="button"
        onClick={item.onClick}
        className={cn(
          baseCardClass,
          "transition-colors cursor-pointer",
          "hover:border-primary/40 hover:border-l-primary/70",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          "w-full",
        )}
      >
        {content}
      </button>
    );
  }

  return <div className={baseCardClass}>{content}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Delta
// ─────────────────────────────────────────────────────────────────────────────

function Delta({ delta }: { delta: TPKpiDelta }) {
  const up = delta.direction === "up";
  const down = delta.direction === "down";
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  const color = up
    ? "text-emerald-500 dark:text-emerald-400"
    : down
    ? "text-red-500 dark:text-red-400"
    : "text-muted";

  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums shrink-0", color)}>
      <Icon size={11} />
      {delta.value}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export function TPKpiBar({ items, columns, compact = false, className }: TPKpiBarProps) {
  if (!items || items.length === 0) return null;

  const colsClass = columns ? COLS_MAP[columns] : AUTO_COLS;

  return (
    <div className={cn("grid gap-3", colsClass, className)}>
      {items.map((item) => (
        <KpiCard key={item.id} item={item} compact={compact} />
      ))}
    </div>
  );
}

export default TPKpiBar;
