// src/components/ui/TPProgressCell.tsx
// ============================================================================
// TPProgressCell — celda de progreso para tablas (X / Y + barra + %).
//
// Átomo visual pensado para tablas de comprobantes (Órdenes de venta/compra,
// facturas con cobro parcial, etc.). Muestra el avance entre `value` y
// `total` con:
//   · ratio textual "3 / 5"
//   · barra horizontal (3 px) con color según progreso
//   · porcentaje opcional a la derecha
//
// Tone automático según porcentaje:
//   · total ≤ 0        → neutral ("—")
//   · 0 %              → neutral (gris)
//   · 1–99 %           → warning (ámbar)
//   · 100 %            → success (esmeralda)
//   · > 100 % (excede) → danger (rojo)
//
// El cálculo se limita a [0, 100] en la visualización de la barra; el tone
// usa el valor real para detectar overshoot. El % mostrado también se capa
// a 100 salvo que `showOvershoot` sea true.
// ============================================================================

import React from "react";
import { cn } from "./tp";

export type TPProgressCellTone = "neutral" | "warning" | "success" | "danger";

export type TPProgressCellProps = {
  /** Valor actual (ej. entregado). */
  value: number;
  /** Valor máximo (ej. pedido). Si es ≤ 0 muestra "—". */
  total: number;
  /** Muestra el ratio textual "X / Y". Default: true. */
  showRatio?: boolean;
  /** Muestra el porcentaje a la derecha. Default: true. */
  showPercent?: boolean;
  /** Si true, muestra porcentajes > 100 tal cual (ej. "120%"). Default: false. */
  showOvershoot?: boolean;
  /** Override manual del tone (si se omite se deriva del porcentaje). */
  tone?: TPProgressCellTone;
  /** Formateador opcional del ratio. Default: `${value} / ${total}`. */
  formatRatio?: (value: number, total: number) => string;
  className?: string;
};

function toneColors(tone: TPProgressCellTone) {
  switch (tone) {
    case "success": return { text: "text-emerald-500 dark:text-emerald-400", bar: "bg-emerald-500" };
    case "warning": return { text: "text-amber-500 dark:text-amber-400",     bar: "bg-amber-500" };
    case "danger":  return { text: "text-red-500 dark:text-red-400",         bar: "bg-red-500" };
    case "neutral":
    default:        return { text: "text-muted",                             bar: "bg-border" };
  }
}

export function TPProgressCell({
  value,
  total,
  showRatio = true,
  showPercent = true,
  showOvershoot = false,
  tone,
  formatRatio,
  className,
}: TPProgressCellProps) {
  const validTotal = Number.isFinite(total) && total > 0;
  const safeValue  = Number.isFinite(value) && value > 0 ? value : 0;

  const rawPct = validTotal ? (safeValue / total) * 100 : 0;
  const displayPct = showOvershoot ? rawPct : Math.min(100, rawPct);
  const barPct = Math.min(100, Math.max(0, rawPct));

  const autoTone: TPProgressCellTone =
    !validTotal     ? "neutral"
    : rawPct <= 0    ? "neutral"
    : rawPct > 100   ? "danger"
    : rawPct >= 100  ? "success"
    :                  "warning";
  const resolvedTone = tone ?? autoTone;
  const colors = toneColors(resolvedTone);

  if (!validTotal) {
    return (
      <div className={cn("flex items-center justify-end text-sm text-muted tabular-nums", className)}>
        —
      </div>
    );
  }

  const ratioText = formatRatio
    ? formatRatio(safeValue, total)
    : `${safeValue} / ${total}`;

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
        {showRatio ? (
          <span className={cn("font-medium", colors.text)}>{ratioText}</span>
        ) : <span />}
        {showPercent && (
          <span className={cn("font-semibold", colors.text)}>
            {Math.round(displayPct)}%
          </span>
        )}
      </div>
      <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-border/40">
        <div
          className={cn("h-full rounded-full transition-all", colors.bar)}
          style={{ width: `${barPct}%` }}
        />
      </div>
    </div>
  );
}

export default TPProgressCell;
