// src/components/ui/TPBalanceCell.tsx
// ============================================================================
// TPBalanceCell — celda de saldo para tablas de comprobantes.
//
// Átomo visual que formatea un monto aplicando tone según el signo, pensado
// para columnas "Saldo", "Pendiente", "A cobrar", "A pagar" donde el valor
// comunica una obligación pendiente.
//
// Convención de signos (configurable):
//   · value > 0  → `positiveTone` (default: "danger", leído como "debemos algo")
//   · value < 0  → `negativeTone` (default: "success", leído como "está a favor")
//   · value = 0  → muestra `zeroDisplay` (default: "—") en tone neutral
//
// La convención por default asume que el saldo representa algo **pendiente de
// cobrar o pagar**. Pantallas que lean el signo al revés (ej. saldo a favor
// del cliente) pueden intercambiar los tones pasando las props.
// ============================================================================

import React from "react";
import { cn } from "./tp";
import { fmtMoney } from "../../lib/document-helpers";

export type TPBalanceTone = "neutral" | "primary" | "success" | "warning" | "danger" | "muted";

export type TPBalanceCellProps = {
  /** Saldo a mostrar. Se formatea con `fmtMoney`. */
  value: number;
  /** Moneda opcional — se pasa a `fmtMoney`. */
  currency?: string;
  /** Tone aplicado cuando `value > 0`. Default: "danger". */
  positiveTone?: TPBalanceTone;
  /** Tone aplicado cuando `value < 0`. Default: "success". */
  negativeTone?: TPBalanceTone;
  /** Texto para `value === 0` o no-finito. Default: "—". */
  zeroDisplay?: string;
  /** Usa el monto en absoluto (oculta el signo). Default: true. */
  useAbsolute?: boolean;
  /** Negrita. Default: true (es saldo, típicamente destacado). */
  bold?: boolean;
  className?: string;
};

function toneClass(tone: TPBalanceTone): string {
  switch (tone) {
    case "primary": return "text-primary";
    case "success": return "text-emerald-500 dark:text-emerald-400";
    case "warning": return "text-amber-500 dark:text-amber-400";
    case "danger":  return "text-red-500 dark:text-red-400";
    case "muted":   return "text-muted";
    case "neutral":
    default:        return "text-text";
  }
}

export function TPBalanceCell({
  value,
  currency,
  positiveTone = "danger",
  negativeTone = "success",
  zeroDisplay = "—",
  useAbsolute = true,
  bold = true,
  className,
}: TPBalanceCellProps) {
  const isZero = !Number.isFinite(value) || value === 0;

  if (isZero) {
    return (
      <span className={cn("tabular-nums text-muted", className)}>
        {zeroDisplay}
      </span>
    );
  }

  const tone = value > 0 ? positiveTone : negativeTone;
  const amount = useAbsolute ? Math.abs(value) : value;

  return (
    <span
      className={cn(
        "tabular-nums",
        bold ? "font-bold" : "font-semibold",
        toneClass(tone),
        className,
      )}
    >
      {fmtMoney(amount, currency)}
    </span>
  );
}

export default TPBalanceCell;
