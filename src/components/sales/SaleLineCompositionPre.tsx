// src/components/sales/SaleLineCompositionPre.tsx
// ============================================================================
// SaleLineCompositionPre — wrapper "Composición del precio (PRE)" editable
// para una línea de Factura.
//
// Fase 3B: SOPORTA EDICIÓN INLINE de los overrides de composición que el
// motor del backend ya respeta:
//   · gramsOverride           (gramos del metal)
//   · mermaPercentOverride    (% de merma)
//   · hechuraOverrideAmount   (monto unitario de hechura)
//
// PUREZA queda READ-ONLY — el motor no expone `purityOverride` todavía.
//
// IMPORTANTE:
//   - La edición afecta SOLO esta línea de factura.
//   - NO modifica la ficha del artículo ni costos maestros.
//   - El frontend NO calcula nada: setea `pricingMeta.*Override` en la línea
//     vía `onApplyOverrides` y deja que `previewSignature` dispare el
//     refetch a `sales/preview`. El motor recalcula y devuelve montos.
//   - Usa el mismo patrón `useOverrideNumber` (debounce 400ms, manual flag)
//     que `LineAdvancedOverridesPanel` para que la UX sea consistente.
//
// Cuando `onApplyOverrides` no viene (consumidor read-only), los inputs se
// muestran disabled y el badge dice "Solo lectura".
// ============================================================================

import React, { useEffect, useRef, useState } from "react";

import type { NormalizedPricingLine } from "../../lib/pricing/contract";
import type { DocumentLine } from "../../lib/document-types";
import SaleLineCompositionDetail from "./SaleLineCompositionDetail";
import TPNumberInput from "../ui/TPNumberInput";
import { TPBadge } from "../ui/TPBadges";
import { formatGrams, formatDecimal } from "../../lib/pricing/format";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function nearlyEqual(a: number | null, b: number | null, eps = 0.0001): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) < eps;
}

/**
 * Hook de override numérico con debounce. Espejo del que vive en
 * `LineAdvancedOverridesPanel` — patrón consistente para inputs que
 * sincronizan con el backend.
 *
 * Flow:
 *   · `value` siempre tiene un valor (override si existe, sino original).
 *   · 400ms después del último cambio, llama `onCommit`.
 *   · Si el value vuelve a ser igual al original, manda `null` (limpia override).
 *   · No re-emite si el último valor enviado es igual al actual.
 */
function useOverrideNumber(
  initialValue: number | null,
  originalValue: number | null,
  onCommit: (value: number | null) => void,
): {
  value:    number | null;
  setValue: (n: number | null) => void;
  manual:   boolean;
} {
  const [value, setValue] = useState<number | null>(
    initialValue != null ? initialValue : originalValue,
  );

  const lastSyncedRef = useRef<{ initial: number | null; original: number | null }>({
    initial:  initialValue,
    original: originalValue,
  });
  useEffect(() => {
    const last = lastSyncedRef.current;
    if (
      !nearlyEqual(last.initial, initialValue) ||
      !nearlyEqual(last.original, originalValue)
    ) {
      setValue(initialValue != null ? initialValue : originalValue);
      lastSyncedRef.current = { initial: initialValue, original: originalValue };
    }
  }, [initialValue, originalValue]);

  const commitRef = useRef<{ timer: number | null; lastSent: number | null | "INIT" }>({
    timer: null, lastSent: "INIT",
  });
  useEffect(() => {
    const c = commitRef.current;
    if (c.timer) window.clearTimeout(c.timer);
    c.timer = window.setTimeout(() => {
      const next = nearlyEqual(value, originalValue) ? null : value;
      if (c.lastSent === "INIT") { c.lastSent = next; return; }
      const same =
        (next == null && c.lastSent == null) ||
        (typeof next === "number" && typeof c.lastSent === "number" && nearlyEqual(next, c.lastSent));
      if (same) return;
      c.lastSent = next;
      onCommit(next);
    }, 400);
    return () => { if (c.timer) window.clearTimeout(c.timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, originalValue]);

  const manual = value != null && originalValue != null && !nearlyEqual(value, originalValue);
  return { value, setValue, manual };
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export type CompositionOverridePatch = {
  gramsOverride?:         number | null;
  mermaPercentOverride?:  number | null;
  hechuraOverrideAmount?: number | null;
};

export type SaleLineCompositionPreProps = {
  /** Línea actual del draft (con `pricingMeta` hidratado por el preview). */
  line: DocumentLine;
  /** Línea ya normalizada por `normalizeSalesPreview` para esta línea. */
  pricingLineView?: NormalizedPricingLine | null;
  /** Símbolo de moneda (ya convertida por backend). */
  currencySymbol?: string;
  /** Modo de la lista aplicada — propaga al detalle. */
  priceListMode?: string | null;
  /** Si la línea tiene `manualPriceOverride` activo, mostramos un aviso
   *  extra: el precio manual gana sobre la composición. */
  hasManualPrice?: boolean;
  /** Callback para aplicar un override de composición. Cuando se omite,
   *  los inputs se muestran disabled y el badge dice "Solo lectura". */
  onApplyOverrides?: (patch: CompositionOverridePatch) => void;
  /** Callback para limpiar TODOS los overrides de composición de la línea
   *  (no toca precio manual, bonificación manual, impuesto manual, lista
   *  por línea ni almacén por línea). */
  onResetComposition?: () => void;
  /** Texto cuando todavía no hay datos para esta línea. */
  emptyText?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────

export default function SaleLineCompositionPre(props: SaleLineCompositionPreProps) {
  const {
    line,
    pricingLineView,
    currencySymbol,
    priceListMode,
    hasManualPrice = false,
    onApplyOverrides,
    onResetComposition,
    emptyText = "Esperando preview del backend para esta línea…",
  } = props;

  const editable = !!onApplyOverrides;

  // ── Datos de la composición ────────────────────────────────────────────
  // `composition` viene del response del motor (`pricingMeta.composition`):
  //   · originalGrams / originalMermaPct / originalAmount → del artículo.
  //   · appliedGrams / appliedMermaPct / appliedAmount    → tras override.
  const composition = line.pricingMeta?.composition ?? null;
  const meta        = line.pricingMeta ?? {};
  const origGrams    = composition?.metal?.originalGrams    ?? null;
  const origMermaPct = composition?.metal?.originalMermaPct ?? null;
  const origHechura  = composition?.hechura?.originalAmount ?? null;
  const purityLabel  = composition?.metal?.purityLabel
    ?? (composition?.metal?.purity != null ? `${composition.metal.purity}` : null);
  const metalName    = composition?.metal?.metalName ?? null;

  // ── Hooks de overrides editables ───────────────────────────────────────
  // Solo emiten al backend cuando el caller proporciona `onApplyOverrides`.
  const apply = onApplyOverrides ?? (() => { /* no-op en modo read-only */ });
  const grams = useOverrideNumber(
    meta.gramsOverride ?? composition?.metal?.appliedGrams ?? null,
    origGrams,
    (next) => apply({ gramsOverride: next }),
  );
  const merma = useOverrideNumber(
    meta.mermaPercentOverride ?? composition?.metal?.appliedMermaPct ?? null,
    origMermaPct,
    (next) => apply({ mermaPercentOverride: next }),
  );
  const hechura = useOverrideNumber(
    meta.hechuraOverrideAmount ?? composition?.hechura?.appliedAmount ?? null,
    origHechura,
    (next) => apply({ hechuraOverrideAmount: next }),
  );

  // ── ¿Hay algún override de composición activo? ─────────────────────────
  const hasCompositionOverride =
    meta.gramsOverride != null ||
    meta.mermaPercentOverride != null ||
    meta.hechuraOverrideAmount != null ||
    meta.metalVariantIdOverride != null;

  return (
    <div className="rounded-md border border-primary/20 bg-primary/5 px-2 py-2">
      {/* Header — badge cambia entre "PRE editable" y "Solo lectura" según
          el caller proporcione handlers. */}
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-primary/80">
          Composición del precio (PRE)
        </div>
        <div className="flex items-center gap-1.5">
          {editable && hasCompositionOverride && onResetComposition && (
            <button
              type="button"
              data-tp-enter="ignore"
              onClick={onResetComposition}
              className="text-[10px] italic text-primary/80 hover:text-primary hover:underline"
              title="Limpia todos los overrides de composición de esta línea (no afecta precio/bonif./impuesto/lista/almacén)."
            >
              Restablecer composición
            </button>
          )}
          <div
            className={
              editable
                ? "shrink-0 rounded border border-primary/30 bg-primary/10 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-primary/80"
                : "shrink-0 rounded border border-border bg-card px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-muted/70"
            }
          >
            {editable ? "PRE editable" : "Solo lectura"}
          </div>
        </div>
      </div>

      {/* Disclaimer fijo. */}
      <div className="mb-1.5 text-[10px] italic leading-tight text-muted/80">
        {editable
          ? "Estos cambios afectan solo esta línea. No modifican el artículo ni los costos maestros."
          : "Los valores de esta composición son una previsualización de la línea. No modifican la ficha del artículo."}
      </div>

      {/* Aviso adicional cuando hay precio manual: el manual gana. */}
      {hasManualPrice && (
        <div className="mb-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] leading-tight text-amber-600 dark:text-amber-400">
          El precio manual tiene prioridad sobre la composición. Los cambios
          que hagas acá pueden afectar costos y margen, pero no el precio
          final mientras el precio manual esté activo.
        </div>
      )}

      {/* Inputs editables — solo cuando el caller los habilita y la línea
          tiene composición disponible (artículo del catálogo, no manual). */}
      {editable && composition && (
        <div className="mb-2 space-y-2">
          {/* METAL — gramos + merma + pureza (read-only) */}
          <div className="rounded border border-border/60 bg-surface/40 px-2 py-1.5">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted/80">
                Metal
              </div>
              {metalName && (
                <div className="text-[10px] italic text-muted/60 truncate">
                  {metalName}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-muted">
                  <span>Gramos</span>
                  {grams.manual && <TPBadge tone="warning" size="sm">Manual</TPBadge>}
                </div>
                <TPNumberInput
                  value={grams.value}
                  onChange={(v) => grams.setValue(v)}
                  formatType="METAL_GRAMS"
                  decimals={3}
                  min={0}
                  compact
                />
                {origGrams != null && (
                  <div className="mt-0.5 text-[9px] italic text-muted/60">
                    Original: {formatGrams(origGrams, 3)} gr
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-muted">
                  <span>Merma %</span>
                  {merma.manual && <TPBadge tone="warning" size="sm">Manual</TPBadge>}
                </div>
                <TPNumberInput
                  value={merma.value}
                  onChange={(v) => merma.setValue(v)}
                  formatType="MERMA_PERCENT"
                  decimals={2}
                  min={0}
                  compact
                />
                {origMermaPct != null && (
                  <div className="mt-0.5 text-[9px] italic text-muted/60">
                    Original: {formatDecimal(origMermaPct, 2)}%
                  </div>
                )}
              </div>
            </div>
            {/* Pureza / ley — read-only por ahora. El motor no expone
                `purityOverride` todavía. */}
            {purityLabel && (
              <div className="mt-1 flex items-center gap-1 text-[9px] text-muted/70">
                <span className="font-semibold uppercase tracking-wide">Pureza/Ley:</span>
                <span className="font-mono tabular-nums">{purityLabel}</span>
                <span className="italic text-muted/50">— solo lectura (no editable por línea)</span>
              </div>
            )}
          </div>

          {/* HECHURA — valor unitario */}
          {(origHechura != null || meta.hechuraOverrideAmount != null) && (
            <div className="rounded border border-border/60 bg-surface/40 px-2 py-1.5">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted/80">
                Hechura
              </div>
              <div>
                <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-muted">
                  <span>Valor</span>
                  {hechura.manual && <TPBadge tone="warning" size="sm">Manual</TPBadge>}
                </div>
                <TPNumberInput
                  value={hechura.value}
                  onChange={(v) => hechura.setValue(v)}
                  formatType="MONEY"
                  decimals={2}
                  min={0}
                  compact
                />
                {origHechura != null && (
                  <div className="mt-0.5 text-[9px] italic text-muted/60">
                    Original: {currencySymbol} {formatDecimal(origHechura, 2)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detalle del backend (read-only): metal/hechura/productos/servicios/
          resumen. Pasa por `SaleLineCompositionDetail` que reusa
          `TPPriceCompositionKpis`. Cuando los inputs de arriba cambian, el
          preview se redispara y este detalle se actualiza con los nuevos
          montos. */}
      <SaleLineCompositionDetail
        pricingLineView={pricingLineView}
        currencySymbol={currencySymbol}
        priceListMode={priceListMode}
        emptyText={emptyText}
      />
    </div>
  );
}
