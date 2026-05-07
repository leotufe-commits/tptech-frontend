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
  /**
   * Layout compacto inline: cuando `true`, los hints (unit, min/max,
   * stock) y los chips backend (Promo / Desc. cantidad) se renderizan
   * COMO TPBadges en una sola fila `flex flex-wrap items-center gap-1.5`,
   * con baseline consistente. Default `false` → comportamiento legacy:
   * cada hint en su propio `<div>` apilado verticalmente, chips en una
   * fila aparte.
   *
   * Pensado para Factura, donde el editor renderiza muchos chips por
   * línea y la inconsistencia entre texto plano (UND, Min) y TPBadge
   * (Promo) genera ruido visual. Otras pantallas (Presupuestos /
   * Órdenes / Compras) mantienen el layout original sin tocar nada.
   */
  compactInline?: boolean;
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
  compactInline = false,
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

  // Sidecar "×" — solo visible bajo `compactInline=true` (sale view en
  // Factura). Replica idéntico el sidecar %/$ de Bonificación / Impuestos
  // para uniformidad visual entre TPNumber financieros.
  // NO clickeable (es indicador semántico de multiplicador, no toggle).
  // Pantallas legacy (Compras/Presupuestos/Órdenes) NO lo muestran —
  // preservan layout original. */
  const numberInput = (
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
      wrapClassName={compactInline ? "flex-1 min-w-0" : undefined}
    />
  );

  return (
    <div className={cn("min-w-0", className)}>
      {compactInline ? (
        <div className="flex items-stretch gap-1">
          {numberInput}
          <span
            // text-muted/50 (un nivel más sutil que Bonif/Impuestos /60)
            // porque "×" es indicador semántico, no acción principal.
            className="inline-flex h-[42px] shrink-0 items-center justify-center rounded-md border border-border bg-card px-1.5 text-[11px] font-semibold text-muted/50"
            title="Multiplica por unitario"
            aria-hidden="true"
          >
            ×
          </span>
        </div>
      ) : (
        numberInput
      )}

      {compactInline ? (
        /* ── Layout compacto inline (Factura) ─────────────────────────────
           Jerarquía visual:
             1. Label "CANTIDAD · UND" (vive en el caller, no acá).
             2. Input numérico (arriba).
             3. Mín. venta / Máx. venta — dos líneas de texto compacto
                (no badges, son meta-info del rango permitido).
             4. Pills: Stock · Promo activa · Desc. x cantidad — fila
                de TPBadges con baseline consistente.
           Cuando NO hay nada que mostrar, no se renderiza ningún wrapper. */
        <>
          {!hasError && (minRaw != null || maxRaw != null) && (
            <div className="mt-1 space-y-0.5 text-[10px] leading-tight text-muted tabular-nums">
              {minRaw != null && (
                <div>Mín. venta: <span className="font-medium text-text/80">{fmtQty(minRaw)}{unit ? ` ${unit}` : ""}</span></div>
              )}
              {maxRaw != null && (
                <div>Máx. venta: <span className="font-medium text-text/80">{fmtQty(maxRaw)}{unit ? ` ${unit}` : ""}</span></div>
              )}
            </div>
          )}
          {((typeof totalStock === "number" && Number.isFinite(totalStock)) ||
            showPromoChip ||
            showQtyDiscChip) && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {typeof totalStock === "number" && Number.isFinite(totalStock) && (
                <TPBadge
                  tone={totalStock > 0 ? "success" : "danger"}
                  size="sm"
                  title="Stock total disponible"
                >
                  <Package size={10} className="mr-1 opacity-70" />
                  <span className="tabular-nums">
                    Stock {fmtQty(totalStock)}{unit ? ` ${unit}` : ""}
                  </span>
                </TPBadge>
              )}
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
                  Desc. x cantidad
                </TPBadge>
              )}
            </div>
          )}
        </>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}

export default TPQuantityField;
