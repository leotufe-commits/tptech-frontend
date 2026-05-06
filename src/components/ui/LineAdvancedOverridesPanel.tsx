// src/components/ui/LineAdvancedOverridesPanel.tsx
// ============================================================================
// LineAdvancedOverridesPanel — composición del precio por BLOQUES verticales
// orientados al negocio de joyería:
//
//   METAL      → Variante · Pureza · Gramos · Merma
//   HECHURA    → Moneda · Valor · Bonificación
//   PRODUCTOS  → Descripción · Moneda · Valor · Bonificación   (cuando aplica)
//   SERVICIOS  → Descripción · Moneda · Valor · Bonificación   (cuando aplica)
//
// REGLA OBLIGATORIA: el frontend NO calcula precios. Cada cambio dispara
// `pricing-preview` con el override correspondiente; el motor recalcula y
// la UI muestra la respuesta.
//
// Notas de diseño:
//   · Cada bloque es vertical, label a la izquierda, valor/input a la derecha.
//   · NO se muestran campos que no aplican (pureza/merma en hechura, etc.).
//   · Metal NO tiene bonificación (la bonificación de metal vive en la celda
//     "Bonificación" de la línea con appliesTo="METAL").
//   · Pureza es read-only (viene de la variante; no se edita acá).
// ============================================================================

import React, { useState, useEffect, useRef } from "react";
import { RotateCcw, X as XIcon } from "lucide-react";

import TPNumberInput from "./TPNumberInput";
import { fmtMoney } from "../../lib/document-helpers";
import type { DocumentLine } from "../../lib/document-types";

export type AppliesTo = "METAL" | "HECHURA" | "PRODUCT" | "SERVICE" | "TOTAL";

export type LineOverridePatch = {
  taxOverride?:           { mode: "PERCENT" | "AMOUNT"; value: number; appliesTo?: AppliesTo } | null;
  manualPrice?:           number | null;
  manualDiscount?:        { mode: "PERCENT" | "AMOUNT"; value: number; appliesTo?: AppliesTo } | null;
  gramsOverride?:         number | null;
  mermaPercentOverride?:  number | null;
  metalVariantIdOverride?: string | null;
  hechuraOverrideAmount?: number | null;
};

export type LineAdvancedOverridesPanelProps = {
  line:     DocumentLine;
  currency: string;
  onApply:  (patch: LineOverridePatch) => void;
  onClear?: () => void;
  onClose?: () => void;
};

const EPS = 1e-6;
function nearlyEqual(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) < EPS;
}

/**
 * Hook fino para manejar un campo numérico que se compara contra el "original"
 * del backend. Cuando el usuario edita y el valor difiere → override; si
 * vuelve al original → null (limpia). Debounce 400ms al backend.
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

// ── Componente principal ───────────────────────────────────────────────────

export function LineAdvancedOverridesPanel({
  line,
  currency,
  onApply,
  onClear,
  onClose,
}: LineAdvancedOverridesPanelProps) {
  const meta = line.pricingMeta ?? {};
  const composition = meta.composition ?? null;

  // Originales del artículo.
  const origGrams    = composition?.metal?.originalGrams    ?? null;
  const origMermaPct = composition?.metal?.originalMermaPct ?? null;
  const origHechura  = composition?.hechura?.originalAmount ?? null;

  // Hooks de overrides numéricos (gramos / merma / hechura).
  const grams = useOverrideNumber(
    meta.gramsOverride ?? composition?.metal?.appliedGrams ?? null,
    origGrams,
    (next) => onApply({ gramsOverride: next }),
  );
  const merma = useOverrideNumber(
    meta.mermaPercentOverride ?? composition?.metal?.appliedMermaPct ?? null,
    origMermaPct,
    (next) => onApply({ mermaPercentOverride: next }),
  );
  const hechura = useOverrideNumber(
    meta.hechuraOverrideAmount ?? composition?.hechura?.appliedAmount ?? null,
    origHechura,
    (next) => onApply({ hechuraOverrideAmount: next }),
  );

  // ── Detección de overrides activos (chip / botón Restaurar) ──────────────
  const hasOverrides = !!(
    grams.manual ||
    merma.manual ||
    hechura.manual ||
    meta.metalVariantIdOverride
  );

  function handleClearAll() {
    grams.setValue(origGrams);
    merma.setValue(origMermaPct);
    hechura.setValue(origHechura);
    onClear?.();
  }

  // ── Datos derivados para Metal ───────────────────────────────────────────
  const metalVariantLabel =
    composition?.metal?.metalName ||
    composition?.metal?.purityLabel ||
    null;
  const purityValue = composition?.metal?.purity ?? null;

  const showAny = !!(composition?.metal || composition?.hechura);

  // ── Resumen Costo / Venta / Margen ───────────────────────────────────────
  // Datos ya calculados por el motor o presentes en la línea: NO recalculamos
  // precios complejos. Solo derivamos:
  //   · Costo total = preferimos `unitCost` (engine) × qty; si no, sumamos
  //     metalCost + hechuraCost × qty como fallback.
  //   · Precio de venta = `line.subtotal` (qty × unitPrice − descuento), que
  //     es el neto sin impuestos.
  //   · Margen %       = ((venta − costo) / venta) × 100   (frontend simple).
  const qtyLine        = Number.isFinite(line.quantity) ? line.quantity : 0;
  const metalCostUnit  = meta.metalCost   ?? null;
  const hechuraCostUnit = meta.hechuraCost ?? null;
  const unitCostEngine = meta.unitCost    ?? null;
  const costTotal: number | null =
    unitCostEngine != null
      ? unitCostEngine * qtyLine
      : (metalCostUnit != null || hechuraCostUnit != null)
        ? ((metalCostUnit ?? 0) + (hechuraCostUnit ?? 0)) * qtyLine
        : null;
  const salePrice: number | null =
    Number.isFinite(line.subtotal) ? line.subtotal : null;
  const margin: number | null =
    costTotal != null && salePrice != null && salePrice > 0
      ? ((salePrice - costTotal) / salePrice) * 100
      : null;
  // Tono del margen — solo visual, no afecta cálculos.
  const marginToneClass =
    margin == null
      ? "text-muted/60"
      : margin >= 40
        ? "text-emerald-500"
        : margin >= 15
          ? "text-text"
          : margin > 0
            ? "text-amber-500"
            : "text-red-500";
  const showSummary = salePrice != null;
  // Margen oculto si precio = 0 (o sin precio).
  const showMargin = salePrice != null && salePrice > 0;

  return (
    <div className="space-y-2">
      {/* ── Header secundario, sin protagonismo. ─────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted/80">
          Composición del precio
          <span className="ml-1 normal-case text-muted/60">— costos del artículo</span>
        </span>
        <div className="flex items-center gap-1">
          {hasOverrides && (
            <button
              type="button"
              onClick={handleClearAll}
              title="Restaurar valores originales del artículo"
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted hover:bg-surface2 hover:text-text"
            >
              <RotateCcw size={10} />
              Restaurar
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Cerrar"
              className="inline-flex h-5 w-5 items-center justify-center rounded text-muted/70 hover:bg-surface2 hover:text-text"
            >
              <XIcon size={11} />
            </button>
          )}
        </div>
      </div>

      {/* ── Bloques verticales por componente ──────────────────────────────
          Orden visual fijo (regla del proyecto, alineado al Simulador):
            1. Metal  →  2. Hechura  →  3. Productos  →  4. Servicios  →  5. Impuestos.
          Cada bloque solo se renderiza si el backend lo expone en
          `pricingMeta.composition`. NO se hacen cálculos en frontend. */}
      {showAny ? (
        <div className="flex flex-col gap-2">
          {/* 1. METAL */}
          {composition?.metal && (
            <Block
              title="Metal"
              manual={grams.manual || merma.manual || composition.metal.variantManual}
            >
              {metalVariantLabel && (
                <FieldRow label="Variante">
                  <ReadOnlyValue>{metalVariantLabel}</ReadOnlyValue>
                </FieldRow>
              )}
              {purityValue != null && (
                <FieldRow label="Pureza">
                  <ReadOnlyValue>{purityValue.toFixed(3)}</ReadOnlyValue>
                </FieldRow>
              )}
              <FieldRow label="Gramos">
                <NumberValue
                  value={grams.value ?? 0}
                  onChange={(v) => grams.setValue(v ?? 0)}
                  decimals={3}
                  suffix="g"
                />
              </FieldRow>
              <FieldRow label="Merma">
                <NumberValue
                  value={merma.value ?? 0}
                  onChange={(v) => merma.setValue(v ?? 0)}
                  decimals={2}
                  suffix="%"
                />
              </FieldRow>
            </Block>
          )}

          {/* 2. HECHURA */}
          {composition?.hechura && (
            <Block title="Hechura" manual={hechura.manual}>
              <FieldRow label="Moneda">
                <ReadOnlyValue>{currency || "—"}</ReadOnlyValue>
              </FieldRow>
              <FieldRow label="Valor">
                <NumberValue
                  value={hechura.value ?? 0}
                  onChange={(v) => hechura.setValue(v ?? 0)}
                  decimals={2}
                />
              </FieldRow>
              <FieldRow label="Bonificación">
                <BonifValue line={line} appliesTo="HECHURA" onApply={onApply} />
              </FieldRow>
            </Block>
          )}

          {/* 3. PRODUCTOS — placeholder hasta que el motor exponga
              `composition.product`. */}
          {/* 4. SERVICIOS — idem `composition.service`. */}

          {/* 5. IMPUESTOS — lectura directa de composition.taxes con
              applyOn por línea. Read-only (la edición sigue en la celda
              "Impuestos" de la fila principal). */}
          {composition?.taxes && composition.taxes.length > 0 && (
            <Block title="Impuestos" manual={composition.taxes.some((t) => t.manual)}>
              {composition.taxes.map((t) => {
                const scopeLabel =
                  t.appliesTo === "METAL"   ? " (sobre metal)"
                  : t.appliesTo === "HECHURA" ? " (sobre hechura)"
                  : "";
                const ratePart =
                  typeof t.rate === "number" ? ` ${t.rate}%` : "";
                return (
                  <FieldRow key={t.id} label={`${t.name}${ratePart}${scopeLabel}`}>
                    <ReadOnlyValue>{fmtMoney(t.taxAmount, currency)}</ReadOnlyValue>
                  </FieldRow>
                );
              })}
            </Block>
          )}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border/60 px-3 py-2 text-[11px] italic text-muted">
          Sin desglose de composición disponible.
        </div>
      )}

      {/* ── Resumen Costo · Venta · Margen ────────────────────────────────
          Bloque informativo al final de la composición. Muestra valores
          ya calculados por el motor (NO recalcula precios ni impuestos).
          El margen es una división simple entre venta y costo, hecha en
          frontend solo para presentación. */}
      {showSummary && (
        <div className="mt-2 border-t border-border/50 pt-2">
          <div className="grid grid-cols-3 gap-2">
            <SummaryStat label="Costo total">
              {costTotal != null
                ? <span className="font-semibold tabular-nums text-text">{fmtMoney(costTotal, currency)}</span>
                : <span className="text-muted/50">—</span>}
            </SummaryStat>
            <SummaryStat label="Precio de venta" hint="Neto, sin impuestos">
              <span className="font-semibold tabular-nums text-text">
                {fmtMoney(salePrice ?? 0, currency)}
              </span>
            </SummaryStat>
            {showMargin && (
              <SummaryStat label="Margen">
                <span className={`font-semibold tabular-nums text-[11px] ${marginToneClass}`}>
                  {margin != null ? `${margin.toFixed(1)}%` : "—"}
                </span>
              </SummaryStat>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-componentes de bloques verticales ─────────────────────────────────

/** Bloque vertical: header + body con espaciado uniforme entre filas. */
function Block({
  title,
  manual,
  children,
}: {
  title:    string;
  manual?:  boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-border/50 bg-surface2/30 px-2.5 py-2">
      <header className="mb-1.5 flex items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-text/85">
          {title}
        </span>
        {manual && (
          <span className="rounded bg-surface2 px-1 py-0 text-[9px] uppercase tracking-wide text-muted/80">
            Manual
          </span>
        )}
      </header>
      <div className="space-y-1">
        {children}
      </div>
    </section>
  );
}

/** Fila label-izquierda · valor-derecha dentro de un Block. */
function FieldRow({
  label,
  children,
}: {
  label:    string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-2">
      <span className="text-[11px] text-muted">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Valor read-only con estilo discreto (sin caja). */
function ReadOnlyValue({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[12px] font-medium text-text/90">{children}</span>
  );
}

/** Valor numérico editable con sufijo opcional (g / %). */
function NumberValue({
  value,
  onChange,
  decimals,
  suffix,
  readOnly,
}: {
  value:     number;
  onChange:  (v: number | null) => void;
  decimals?: number;
  suffix?:   string;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <div className="w-[140px] shrink-0">
        <TPNumberInput
          value={value}
          onChange={onChange}
          decimals={decimals}
          min={0}
          compact
          readOnly={readOnly}
        />
      </div>
      {suffix && (
        <span className="shrink-0 text-[10px] text-muted/70">{suffix}</span>
      )}
    </div>
  );
}

/** Stat del resumen — label arriba, contenido abajo, hint opcional. */
function SummaryStat({
  label,
  hint,
  children,
}: {
  label:    string;
  hint?:    string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[9px] font-semibold uppercase tracking-wide text-muted/70">
        {label}
      </div>
      <div className="mt-0.5 text-[12px]">{children}</div>
      {hint && <div className="text-[9px] text-muted/60">{hint}</div>}
    </div>
  );
}

/**
 * Bonificación/recargo por componente para el bloque (Hechura / Producto /
 * Servicio). Lee `manualDiscount` con `appliesTo` igual al componente y al
 * editar manda el override con el `appliesTo` correspondiente. El frontend
 * NO calcula precios; solo expone overrides al motor.
 */
function BonifValue({
  line,
  appliesTo,
  onApply,
}: {
  line:      DocumentLine;
  appliesTo: AppliesTo;
  onApply:   (patch: LineOverridePatch) => void;
}) {
  const md = line.pricingMeta?.manualDiscount ?? null;
  const matches = md && (md.appliesTo ?? "TOTAL") === appliesTo;
  const current =
    matches && md
      ? (md.mode === "PERCENT" ? md.value : 0)
      : 0;

  const [local, setLocal] = useState<number>(current);
  useEffect(() => { setLocal(current); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [current, line.id]);

  const debouncedRef = useRef<number | null>(null);
  function commit(next: number) {
    setLocal(next);
    if (debouncedRef.current) window.clearTimeout(debouncedRef.current);
    debouncedRef.current = window.setTimeout(() => {
      onApply({
        manualDiscount: next > 0
          ? { mode: "PERCENT", value: next, appliesTo }
          : (matches ? null : (md ?? null)),
      });
    }, 400);
  }

  return (
    <div className="flex items-center gap-1">
      <div className="w-[140px] shrink-0">
        <TPNumberInput
          value={local}
          onChange={(v) => commit(Math.max(0, v ?? 0))}
          decimals={2}
          min={0}
          compact
        />
      </div>
      <span className="shrink-0 text-[10px] text-muted/70">%</span>
    </div>
  );
}

export default LineAdvancedOverridesPanel;
