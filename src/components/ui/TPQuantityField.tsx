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
import { fmtQty } from "../../lib/document-helpers";
import type { NumberFormatType } from "../../lib/number-format";

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

  /** Limpiar/restablecer — habilita la "X" interna del TPNumberInput, MISMO
   *  patrón/visual que Bonificación e Impuestos (es el mismo componente).
   *  El caller decide qué hace (típico Cantidad: volver al default/min).
   *  Si es `undefined` la "X" no se muestra. */
  onClear?: () => void;

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

  /**
   * Opt-in: tipo del motor central de formato para el input interno (ej.
   * "QUANTITY" en Factura → respeta región/decimales del tenant). Sin esto,
   * el comportamiento histórico (0/2 decimales según `step`). Scoped: solo
   * lo pasa quien lo necesita; otras pantallas quedan intactas.
   */
  formatType?: NumberFormatType;

  /**
   * Opt-in: clase CSS extra que se aplica al `<input>` nativo del
   * TPNumberInput interno. Pensado para activar variantes visuales
   * (ej. `tp-input-dense` en líneas operativas de Factura). Sin esto,
   * comportamiento histórico — el input usa el styling estándar.
   */
  inputClassName?: string;

  /**
   * Opt-in: ocultar las flechas spinner del TPNumberInput interno.
   * Pensado para líneas operativas alto-volumen (Factura) donde el
   * operador trabaja por teclado y las flechitas solo añaden ruido
   * visual. Default `true` — se preservan en otras pantallas.
   * ArrowUp/ArrowDown del teclado siguen funcionando.
   */
  showArrows?: boolean;
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
  onClear,
  size = "md",
  className,
  compactInline = false,
  formatType,
  inputClassName,
  showArrows = true,
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

  // T45.2 — Removido el `rangeTitle` (tooltip "Cantidad permitida: mín X").
  // El sistema acepta decimales (0,01 / 0,50) y el hint persistente
  // "Mínimo 1 u." era engañoso. El feedback de error sigue funcionando
  // vía `errorText` cuando el valor es 0, negativo o fuera del rango
  // efectivo del artículo. Sin hint informativo persistente.

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
      // Con formatType, los decimales los gobierna el preset (no pisamos con
      // el cálculo legacy). Sin formatType, comportamiento histórico.
      decimals={formatType ? undefined : (step < 1 ? 2 : 0)}
      formatType={formatType}
      step={step}
      // OJO: NO le pasamos `min` al TPNumberInput interno para que el
      // usuario pueda escribir 0 / valores debajo del mínimo y verlo
      // como ERROR en lugar de un clamp silencioso.
      max={maxRaw}
      compact={size === "sm"}
      disabled={disabled}
      error={errorText ?? undefined}
      // Misma "X" interna que Bonificación/Impuestos (mismo TPNumberInput).
      // Solo se renderiza cuando el caller pasa `onClear`.
      onClear={onClear}
      wrapClassName={compactInline ? "flex-1 min-w-0" : undefined}
      className={inputClassName}
      showArrows={showArrows}
    />
  );

  return (
    <div
      className={cn("min-w-0", className)}
    >
      {/* Cantidad = TPNumber con su "X" interna (onClear), MISMO patrón que
          Bonificación e Impuestos. Sin sidecar externo: el campo Precio
          queda pegado a Cantidad, sin caja intermedia que parezca "borrar". */}
      {numberInput}

      {compactInline ? (
        /* ── Layout compacto inline (Factura) ─────────────────────────────
           Jerarquía visual:
             1. Label "CANTIDAD · UND" (vive en el caller, no acá).
             2. Input numérico (arriba).
             3. Pills: Stock · Promo activa · Desc. x cantidad — UNA fila
                de TPBadges (única línea de metadata). El rango Mín/Máx
                vive en el `title` del campo (hover); en error se ve via
                `errorText` del input.
           Cuando NO hay nada que mostrar, no se renderiza ningún wrapper. */
        <>
          {/* T29 — Labels compactos unificados (antes TPBadge tone success/
              danger). Mismo lenguaje visual que "Bonificación acumulada" /
              "Promo Verano" / "Manual": text-[10px] + color semántico:
                · Stock > 0 → muted (info neutra)
                · Stock 0   → rojo (alerta real)
                · Promo / Desc. cantidad → verde (descuento favorable) */}
          {((typeof totalStock === "number" && Number.isFinite(totalStock)) ||
            showPromoChip ||
            showQtyDiscChip) && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {typeof totalStock === "number" && Number.isFinite(totalStock) && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[10px] leading-tight",
                    totalStock > 0 ? "text-muted" : "font-semibold text-red-500",
                  )}
                  title="Stock total disponible"
                >
                  <Package size={10} className="opacity-70" />
                  <span className="tabular-nums">
                    Stock {fmtQty(totalStock)}{unit ? ` ${unit}` : ""}
                  </span>
                </span>
              )}
              {showPromoChip && (
                <span
                  className="text-[10px] not-italic text-emerald-600 dark:text-emerald-400 leading-tight"
                  title="Hay una promoción activa para esta cantidad"
                >
                  Promo activa
                </span>
              )}
              {showQtyDiscChip && (
                <span
                  className="text-[10px] not-italic text-emerald-600 dark:text-emerald-400 leading-tight"
                  title="Aplica descuento por cantidad"
                >
                  Desc. x cantidad
                </span>
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

          {/* T45.2 — Hint persistente de rango Mín./Máx. eliminado.
              El sistema acepta decimales (0,01 / 0,50) y mostrar
              "Mín. 1 u." era engañoso. El errorText del TPNumberInput
              sigue alertando cuando el valor es 0/negativo. */}

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

          {/* T29 — Labels compactos unificados (mismo estilo que el modo
              compactInline de Factura). */}
          {(showPromoChip || showQtyDiscChip) && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {showPromoChip && (
                <span
                  className="text-[10px] not-italic text-emerald-600 dark:text-emerald-400 leading-tight"
                  title="Hay una promoción activa para esta cantidad"
                >
                  Promo activa
                </span>
              )}
              {showQtyDiscChip && (
                <span
                  className="text-[10px] not-italic text-emerald-600 dark:text-emerald-400 leading-tight"
                  title="Aplica descuento por cantidad"
                >
                  Desc. cantidad
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default TPQuantityField;
