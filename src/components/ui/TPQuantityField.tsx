// src/components/ui/TPQuantityField.tsx
// ============================================================================
// TPQuantityField — input de cantidad reutilizable para líneas de documento.
//
// Wrapper sobre TPNumberInput con:
//   · Fallback al `default` (o 1) cuando el usuario blurea con vacío / inválido.
//     NUNCA cae al "valor anterior" — siempre produce un estado válido.
//   · Mensaje de error visible (no bloqueante) si la cantidad está fuera de
//     rango o es 0. NO oculta la línea — el padre decide.
//   · Chips contextuales debajo: unidad, stock total, "Promo activa",
//     "Desc. cantidad". Suprimidos cuando `partial=true` para evitar señales
//     optimistas mientras el backend está calculando.
//   · Hint compacto con min/max cuando las constraints lo definen.
//
// El componente NO calcula nada — solo refleja `value` / `constraints` y
// reporta cambios vía `onChange`. El padre decide qué hacer (típico: enviar
// al backend como override y recibir el preview).
// ============================================================================

import React from "react";
import { Package } from "lucide-react";

import { cn } from "./tp";
import TPNumberInput from "./TPNumberInput";
import { TPBadge } from "./TPBadges";
import { fmtQty } from "../../lib/document-helpers";

export type TPQuantityFieldProps = {
  value: number | null;
  onChange: (next: number | null) => void;

  /** Restricciones derivadas de `resolveQuantityConstraints(item, ctx)`. */
  constraints: { min?: number; max?: number; step?: number; default?: number };

  /** Unidad de medida del ítem ("u", "g", "ml", etc.). */
  unit?: string | null;
  /** Stock total sumado entre almacenes. Solo informativo. */
  totalStock?: number | null;

  /** Backend reportó promoción aplicada en la línea. */
  hasPromotion?: boolean;
  /** Backend reportó descuento por cantidad aplicado. */
  hasQuantityDiscount?: boolean;
  /** El motor está en modo `partial` — suprimir chips optimistas. */
  partial?: boolean;

  disabled?: boolean;

  /** Tamaño visual. Default "md". */
  size?: "sm" | "md";
  className?: string;
};

export function TPQuantityField({
  value,
  onChange,
  constraints,
  unit,
  totalStock,
  hasPromotion,
  hasQuantityDiscount,
  partial,
  disabled,
  size = "md",
  className,
}: TPQuantityFieldProps) {
  const fallback =
    typeof constraints.default === "number" && constraints.default > 0
      ? constraints.default
      : 1;
  const step = constraints.step ?? 1;
  const minRaw = constraints.min;
  const maxRaw = constraints.max;

  const v = typeof value === "number" && Number.isFinite(value) ? value : null;

  // Validaciones (no bloqueantes — solo visuales).
  const isZero   = v === 0;
  const belowMin = v != null && minRaw != null && v < minRaw && v !== 0;
  const aboveMax = v != null && maxRaw != null && v > maxRaw;
  const hasError = isZero || belowMin || aboveMax;

  const errorText: string | null =
    isZero    ? "La cantidad no puede ser 0."
    : belowMin ? `Mínimo ${fmtQty(minRaw!)}${unit ? ` ${unit}` : ""}.`
    : aboveMax ? `Máximo ${fmtQty(maxRaw!)}${unit ? ` ${unit}` : ""}.`
    : null;

  // Chips backend-driven — sólo si NO partial.
  const showPromoChip   = !partial && !!hasPromotion;
  const showQtyDiscChip = !partial && !!hasQuantityDiscount;

  return (
    <div className={cn("min-w-0", className)}>
      <TPNumberInput
        value={v}
        onChange={(next) => {
          // Blur con vacío / NaN / no-finite → fallback al default (o 1).
          // NUNCA recuperamos el valor anterior — siempre dejamos un estado válido.
          if (next == null || !Number.isFinite(next)) {
            onChange(fallback);
            return;
          }
          onChange(next);
        }}
        decimals={step < 1 ? 2 : 0}
        step={step}
        // OJO: NO le pasamos `min` al TPNumberInput interno para que el
        // usuario pueda escribir 0 / valores debajo del mínimo y verlo
        // como ERROR en lugar de un clamp silencioso.
        max={maxRaw}
        compact={size === "sm"}
        disabled={disabled}
        error={errorText ?? undefined}
      />

      {/* Unidad — debajo del input como label discreta. La unidad NO viaja
          dentro del input para que el campo numérico quede limpio (solo el
          valor) y la unidad sea explícita visualmente. */}
      {unit && (
        <div className="mt-0.5 text-[11px] leading-tight text-muted/70 tabular-nums">
          {unit}
        </div>
      )}

      {/* Hint línea 1: rango compacto si hay min/max y NO hay error. */}
      {!hasError && (minRaw != null || maxRaw != null) && (
        <div className="mt-0.5 text-[10px] leading-tight text-muted">
          {minRaw != null && maxRaw != null
            ? `${fmtQty(minRaw)}–${fmtQty(maxRaw)}${unit ? ` ${unit}` : ""}`
            : minRaw != null
              ? `Mín. ${fmtQty(minRaw)}${unit ? ` ${unit}` : ""}`
              : `Máx. ${fmtQty(maxRaw!)}${unit ? ` ${unit}` : ""}`}
        </div>
      )}

      {/* Hint línea 2: stock total (informativo). */}
      {typeof totalStock === "number" && Number.isFinite(totalStock) && (
        <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] leading-tight text-muted">
          <Package size={10} className="text-muted/70" />
          <span>Stock:</span>
          <span
            className={cn(
              "tabular-nums font-semibold",
              totalStock > 0 ? "text-emerald-500" : "text-red-500",
            )}
          >
            {fmtQty(totalStock)}{unit ? ` ${unit}` : ""}
          </span>
        </div>
      )}

      {/* Chips backend-driven. */}
      {(showPromoChip || showQtyDiscChip) && (
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          {showPromoChip && (
            <TPBadge
              tone="success"
              size="sm"
              title="Hay una promoción activa para esta cantidad"
            >
              Promo activa
            </TPBadge>
          )}
          {showQtyDiscChip && (
            <TPBadge tone="success" size="sm" title="Aplica descuento por cantidad">
              Desc. cantidad
            </TPBadge>
          )}
        </div>
      )}
    </div>
  );
}

export default TPQuantityField;
