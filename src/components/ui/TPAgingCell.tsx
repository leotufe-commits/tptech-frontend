// src/components/ui/TPAgingCell.tsx
// ============================================================================
// TPAgingCell — días de atraso / estado de vencimiento.
//
// Átomo visual pensado para columnas "Aging" en tablas de facturas y notas
// de crédito vencidas. Muestra un texto breve con tone según el atraso:
//
//   · sin vencimiento            → "—"
//   · days <= 0  (al día o fut.) → "Al día"        (tone success)
//   · days 1-15                  → "X días"        (tone warning)
//   · days > 15                  → "X días"        (tone danger)
//
// Acepta dos formas de entrada, en orden de precedencia:
//
//   1. `days` — número precalculado (positivo = atrasado).
//   2. `dueDate` + opcionalmente `referenceDate` — computa la diferencia en
//      días entre ambas fechas ISO (`yyyy-mm-dd`). Si `referenceDate` se
//      omite se usa hoy.
//
// Si ninguna fuente es válida (null/empty/no-finite), renderiza "—".
// ============================================================================

import React from "react";

import { cn } from "./tp";
import { todayISO } from "../../lib/document-helpers";

export type TPAgingCellProps = {
  /** Fecha de vencimiento ISO (`yyyy-mm-dd`). Alternativa a `days`. */
  dueDate?: string | null;
  /** Fecha contra la que medir el atraso. Default: hoy (`todayISO()`). */
  referenceDate?: string;
  /** Número de días ya calculado (positivo = atrasado). Tiene precedencia sobre `dueDate`. */
  days?: number | null;
  /** Texto para el caso "al día". Default: "Al día". */
  onTimeLabel?: string;
  className?: string;
};

function parseISODate(iso: string): number | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

function computeDaysOverdue(dueIso: string, refIso: string): number | null {
  const due = parseISODate(dueIso);
  const ref = parseISODate(refIso);
  if (due === null || ref === null) return null;
  return Math.floor((ref - due) / (1000 * 60 * 60 * 24));
}

export function TPAgingCell({
  dueDate,
  referenceDate,
  days,
  onTimeLabel = "Al día",
  className,
}: TPAgingCellProps) {
  let resolved: number | null = null;

  if (typeof days === "number" && Number.isFinite(days)) {
    resolved = days;
  } else if (dueDate) {
    resolved = computeDaysOverdue(dueDate, referenceDate ?? todayISO());
  }

  if (resolved === null) {
    return (
      <span className={cn("tabular-nums text-muted", className)}>—</span>
    );
  }

  if (resolved <= 0) {
    return (
      <span className={cn("tabular-nums text-emerald-500 dark:text-emerald-400", className)}>
        {onTimeLabel}
      </span>
    );
  }

  const toneClass =
    resolved > 15
      ? "text-red-500 dark:text-red-400 font-semibold"
      : "text-amber-500 dark:text-amber-400 font-semibold";

  return (
    <span className={cn("tabular-nums", toneClass, className)}>
      {resolved} {resolved === 1 ? "día" : "días"}
    </span>
  );
}

export default TPAgingCell;
