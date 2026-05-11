// src/components/sales/SaleCompositionEditableGrid.tsx
// =============================================================================
// SaleCompositionEditableGrid — grilla editable de "Composición del precio
// de venta" exclusiva de FACTURA DE VENTAS (Fase 2 del refactor).
//
// Reemplaza a `LineAdvancedOverridesPanel` SOLO en `view="sale"`. El panel
// original sigue vivo para Compras / Presupuestos / Órdenes (`view="cost"`).
//
// Reglas no-negociables:
//   · CERO matemática comercial. Cada cambio dispara `pricing-engine` via
//     preview backend y la UI muestra la respuesta.
//   · Una fila por `costLineId` (NO por grupo) — `composition.metals[]`,
//     `hechuras[]`, `products[]`, `services[]` se iteran directo.
//   · Indexación por `costLineId` (NUNCA por índice visual). Si la línea
//     no tiene `costLineId` (snapshot legacy v4 sin id estable) → fila
//     read-only.
//
// Reusa helpers ya validados:
//   · `useOverrideNumber` (debounce 400ms) — desde este archivo.
//   · `patchCostLineOverride` / `findCostLineOverride` — desde lib/pricing/.
//
// NO toca:
//   · `TPPriceCompositionKpis` (read-only del Simulador/Comparador).
//   · `LineAdvancedOverridesPanel` (sigue cubriendo Compras/Presupuestos).
// =============================================================================

import React, { useEffect, useRef, useState } from "react";
import {
  RotateCcw, X as XIcon, ChevronDown,
  Gem, Hammer, Package, Wrench,
  // Fase 4.3 — mini-spinner "Recalculando…" en el header de la grilla.
  Loader2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import TPNumberInput from "../ui/TPNumberInput";
import { cn } from "../ui/tp";
import { fmtMoney } from "../../lib/document-helpers";
import type { DocumentLine } from "../../lib/document-types";
import {
  patchCostLineOverride,
  findCostLineOverride,
} from "../../lib/pricing/cost-line-overrides";
import type { CostLineOverride } from "../../services/sales";
// Fase 6 — flujo visual de construcción del precio (4 cards). Reemplaza
// SaleImpactBlock + CostAdjustmentBlock + RentabilidadBlock con la misma data
// pero presentación rediseñada (azul/ámbar/verde/neutro).
import PriceFlowCards from "./PriceFlowCards";
import {
  COMPONENT_TYPE_BADGE,
  type ComponentTypeKey,
} from "../../lib/pricing/component-type-colors";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────────

export type AppliesTo = "METAL" | "HECHURA" | "PRODUCT" | "SERVICE" | "TOTAL";

export type LineOverridePatch = {
  taxOverride?:           { mode: "PERCENT" | "AMOUNT"; value: number; appliesTo?: AppliesTo } | null;
  manualPrice?:           number | null;
  manualDiscount?:        { mode: "PERCENT" | "AMOUNT"; value: number; appliesTo?: AppliesTo } | null;
  gramsOverride?:         number | null;
  mermaPercentOverride?:  number | null;
  metalVariantIdOverride?: string | null;
  hechuraOverrideAmount?: number | null;
  costLineOverrides?:     CostLineOverride[];
};

/**
 * Ajustes globales del documento que el preview backend ya resolvió. La
 * grilla los muestra en un bloque debajo de la tabla, separados de los
 * ajustes per-cost-line. Cada campo es opcional — si todos son null/0 el
 * bloque no se renderea.
 */
export type SaleGlobalAdjustments = {
  channel?:        { name: string; amount: number } | null;
  coupon?:         { code: string; name?: string; amount: number } | null;
  payment?:        { name: string; amount: number; installments?: number | null } | null;
  shipping?:       { mode: "FIXED" | "BY_WEIGHT" | "FREE" | string; amount: number; label?: string } | null;
  globalDiscount?: { type: "PERCENT" | "AMOUNT" | string; value: number; amount: number } | null;
  /** Bonif/Recargo manual con appliesTo=TOTAL (per-línea). Mismo passthrough
   *  que el panel legacy hacía con `documentAdjustments.lineManualDiscount`. */
  lineManualDiscount?: { kind: "BONUS" | "SURCHARGE"; valuePct: number | null; amount: number } | null;
};

export type SaleCompositionEditableGridProps = {
  line:     DocumentLine;
  currency: string;
  onApply:  (patch: LineOverridePatch) => void;
  /** Reset completo: limpia legacy + costLineOverrides[]. */
  onClear?: () => void;
  /** Cierra el panel desde el header. */
  onClose?: () => void;
  /** Mapping `code → name` del catálogo de unidades del tenant. Solo display. */
  unitNameByCode?: Map<string, string>;
  /** Ajustes globales del documento (passthrough del preview backend). */
  globalAdjustments?: SaleGlobalAdjustments;
  /**
   * Fase 4.3 — true cuando hay un preview backend en vuelo. La grilla
   * muestra un mini-spinner inline al lado del título para que el operador
   * sepa que el sistema está recalculando antes de tomar la siguiente
   * decisión. Cero impacto en cálculo.
   */
  previewLoading?: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// useOverrideNumber — copia local del hook de LineAdvancedOverridesPanel.
// Se duplica intencionalmente para no acoplar este archivo al panel legacy.
// Debounce 400ms — un cambio rápido seguido de otro cancela el commit del
// primero (un solo preview backend por intent estable).
// ─────────────────────────────────────────────────────────────────────────────

const EPS = 1e-6;
function nearlyEqual(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) < EPS;
}

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
    initial: initialValue, original: originalValue,
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
    }, 250);   // Fase 4.3 — debounce 400→250ms (sensación de fluidez ERP).
    return () => { if (c.timer) window.clearTimeout(c.timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, originalValue]);

  const manual = value != null && originalValue != null && !nearlyEqual(value, originalValue);
  return { value, setValue, manual };
}

/**
 * Fase 2.1 — flash sutil cuando un valor numérico cambia.
 *
 * Devuelve una clase Tailwind con opacidad bg-emerald que se aplica durante
 * ~700ms tras una actualización del `value`. Cero animación pesada — solo
 * un `transition-colors` corto que ayuda al ojo a localizar el cambio
 * (total línea, margen, total componentes).
 *
 * Parámetro opcional `key`: si se pasa, el flash dispara cuando ese key
 * cambia (útil cuando el value es estable pero el contexto cambió, o para
 * forzar reset).
 */
function useFlashOnChange(value: number | null | undefined, key?: string): string {
  const [flash, setFlash] = useState(false);
  const prevRef = useRef<{ value: number | null | undefined; key: string | undefined }>({
    value, key,
  });
  useEffect(() => {
    const prev = prevRef.current;
    const valueChanged =
      typeof prev.value === "number" && typeof value === "number"
        ? !nearlyEqual(prev.value, value)
        : prev.value !== value;
    const keyChanged = prev.key !== key;
    if (valueChanged || keyChanged) {
      prevRef.current = { value, key };
      // El estado inicial no debería disparar flash — la primera vez que el
      // hook corre, prev.value === value (porque ref se inicializó con
      // value), así que valueChanged=false. El flash dispara solo en
      // re-renders donde value/key efectivamente cambian.
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), 700);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [value, key]);
  return flash ? "bg-emerald-500/10" : "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout — tabla compacta. Columnas: badge (24) · componente (1.6fr) ·
// cantidad (90) · unidad (60) · val.unit (95) · merma (75) · ajuste (130) ·
// val.venta (95) · total (105) · acciones (30).
// ─────────────────────────────────────────────────────────────────────────────

const TABLE_COLS_CLS =
  // Fase 2.4 — quitamos la columna UNID. (la unidad ahora va inline en
  // el secondary del COMPONENTE). Espacio liberado se reparte:
  //   · COMPONENTE pasa de 1.5fr a 1.8fr (más ancho, mejor legibilidad).
  //   · Las demás conservan su min/fr.
  // Layout: badge · componente · cantidad · val.unit · merma · ajuste ·
  //          v.venta · total · acciones.
  "grid grid-cols-[24px_minmax(0,1.8fr)_minmax(80px,0.7fr)_minmax(85px,0.75fr)_minmax(70px,0.65fr)_minmax(145px,1.2fr)_minmax(85px,0.75fr)_minmax(95px,0.85fr)_28px] " +
  "items-center gap-x-1.5";

// Fase MVP híbrido (Print 2) — layout extendido con 4 columnas comerciales
// adicionales a la derecha del costo: Precio Unit. Venta, Margen %, Venta
// Línea, Participación %. Solo aplica cuando `commercialView === true`.
const TABLE_COLS_CLS_COMMERCIAL =
  "grid grid-cols-[24px_minmax(0,1.5fr)_minmax(80px,0.7fr)_minmax(85px,0.75fr)_minmax(70px,0.65fr)_minmax(145px,1.2fr)_minmax(85px,0.75fr)_minmax(95px,0.85fr)_minmax(95px,0.85fr)_minmax(70px,0.6fr)_minmax(95px,0.85fr)_minmax(70px,0.55fr)_28px] " +
  "items-center gap-x-1.5";

function TableHeader({ commercialView }: { commercialView: boolean }) {
  return (
    <div
      className={cn(
        commercialView ? TABLE_COLS_CLS_COMMERCIAL : TABLE_COLS_CLS,
        // Fase 2.1 — header más compacto (px-1.5 / py-0.5) + tracking más apretado.
        // Fase 4.4 — sticky top para que el header se mantenga visible
        // durante scroll vertical en composiciones largas. `bg-card`
        // evita que las filas debajo se vean a través del header
        // semi-transparente. `z-10` lo mantiene sobre las filas pero por
        // debajo del modal.
        "sticky top-0 z-10 bg-card",
        "px-1.5 py-1 border-b border-border/30 text-[9px] font-semibold uppercase tracking-[0.04em] text-muted/65",
      )}
    >
      <span aria-hidden />
      <span>Componente</span>
      <span className="text-right">Cantidad</span>
      {/* Fase 2.7.a — labels alineados a la realidad funcional:
          la tabla muestra COMPOSICIÓN DE COSTO (no precio de venta).
          "Val. unit." → "Costo unit.";  "V. venta" → "Costo línea". */}
      <span className="text-right" title="Costo base del componente">Costo unit.</span>
      <span className="text-right">Merma</span>
      <span className="text-center">Ajuste</span>
      <span className="text-right" title="Costo final del componente">Costo línea</span>
      <span className="text-right">Total</span>
      {commercialView && (
        <>
          <span className="text-right text-emerald-700/80 dark:text-emerald-400/80" title="Precio unitario de venta (sale-side, solo cuando es canónico)">
            P. unit. venta
          </span>
          <span className="text-right">Margen</span>
          <span className="text-right text-emerald-700/80 dark:text-emerald-400/80">
            Venta línea
          </span>
          <span className="text-right" title="Participación del costo de este componente sobre el costo total">
            Particip.
          </span>
        </>
      )}
      <span aria-hidden />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CellNumberInput — input numérico compacto alineado a la derecha.
// ─────────────────────────────────────────────────────────────────────────────

function CellNumberInput({
  value, onChange, decimals = 2, step = 0.01, suffix,
  readOnly = false, disabled = false, tooltip, widthClass,
  original, decimalsOriginal, formatOriginal,
}: {
  value:    number | null;
  onChange: (v: number | null) => void;
  decimals?: number;
  step?:     number;
  suffix?:   React.ReactNode;
  readOnly?: boolean;
  disabled?: boolean;
  tooltip?:  string;
  widthClass?: string;
  /**
   * Fase 2.1 — valor original del backend (sin override). Cuando difiere de
   * `value`, se muestra debajo del input en gris/tachado para que el operador
   * vea claro qué viene del catálogo y qué editó.
   */
  original?: number | null;
  /** Decimales para el render del original (default = `decimals`). */
  decimalsOriginal?: number;
  /** Formato custom del original (default: toLocaleString es-AR). */
  formatOriginal?: (v: number) => string;
}) {
  const isInteractive = !readOnly && !disabled;
  const hasManualOverride =
    original != null && value != null && !nearlyEqual(original, value);
  const origDec = decimalsOriginal ?? decimals;
  const origText =
    hasManualOverride && original != null
      ? (formatOriginal
          ? formatOriginal(original)
          : original.toLocaleString("es-AR", {
              minimumFractionDigits: 0,
              maximumFractionDigits: origDec,
            }))
      : null;
  return (
    <div
      className={cn(
        "inline-flex flex-col items-end",
        // Manual: borde-resalte sutil + valor más bold via clase del input.
      )}
      title={!isInteractive ? tooltip : undefined}
    >
      <TPNumberInput
        value={value}
        onChange={onChange}
        decimals={decimals}
        step={step}
        suffix={suffix}
        showArrows={isInteractive}
        readOnly={readOnly}
        disabled={disabled}
        // Fase 2.1 fix layout — `compact` es OBLIGATORIO acá. El input está
        // forzado a `!h-6` (24px) y sin compact los arrows usan `h-5 w-8`
        // (20×32px) + `mt-0.5` → stack ~42px, sobresale ~9px arriba/abajo
        // del input. En compact los arrows son `h-3.5 w-5` (14×20) → stack
        // ~28px, encajan en 24px. Compact también ajusta padding-right
        // (3rem vs 4rem) para que el suffix no compita con los arrows.
        compact
        className={cn(
          "!h-6 !text-[11px] text-right tabular-nums",
          isInteractive ? (widthClass ?? "w-[88px]") : (widthClass ?? "w-[80px]"),
          !isInteractive && "cursor-help opacity-70",
          // Manual override: input ligeramente más fuerte para destacar
          // el valor "Manual" sin gritar.
          hasManualOverride && "!font-semibold ring-1 ring-amber-400/35",
        )}
        wrapClassName="!w-auto"
      />
      {origText != null && (
        <span
          className="mt-0.5 text-[9px] leading-none text-muted/65 tabular-nums line-through"
          title="Valor original del artículo"
        >
          {origText}
        </span>
      )}
    </div>
  );
}

const READ_ONLY_TOOLTIP = "Editar desde la ficha del artículo";

// ─────────────────────────────────────────────────────────────────────────────
// AdjustmentEditor — bonificación / recargo per cost line.
//
// 4 controles compactos:
//   · Kind:  toggle BONUS (−) / SURCHARGE (+)
//   · Value: número
//   · Type:  toggle PERCENTAGE (%) / FIXED_AMOUNT ($)
//   · Clear: × (vuelve a "sin ajuste")
//
// Sin ajuste activo → muestra solo un botón "Bonif/Recargo" que al click
// inicia el editor con BONUS + PERCENTAGE + 0. Cero matemática local —
// el patch dispara preview backend.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fase 2.2 — formato compacto del ajuste original/override.
 *   "Bonif. 14% · −ARS 17.269,56"
 *   "Recargo 15% · +ARS 148.275,00"
 *   "Bonif. ARS 5.000,00"
 *
 * Cuando `amount` no está disponible (snapshot viejo / motor no lo emitió),
 * se omite el sufijo monetario sin recalcular.
 */
function fmtAdjustmentText(
  kind:     "BONUS" | "SURCHARGE" | null,
  type:     "PERCENTAGE" | "FIXED_AMOUNT" | null,
  value:    number | null,
  amount:   number | null,
  currency: string,
): { kindWord: string; valuePart: string; amountPart: string | null } | null {
  if (!kind) return null;
  const kindWord = kind === "BONUS" ? "Bonif." : "Recargo";
  const valuePart = (() => {
    if (value == null || !Number.isFinite(value)) return "";
    if (type === "PERCENTAGE") return `${value}%`;
    if (type === "FIXED_AMOUNT") return fmtMoney(value, currency);
    return String(value);
  })();
  const amountPart = amount != null && Number.isFinite(amount) && Math.abs(amount) > 0
    ? `${kind === "BONUS" ? "−" : "+"}${fmtMoney(Math.abs(amount), currency)}`
    : null;
  return { kindWord, valuePart, amountPart };
}

function AdjustmentEditor({
  kind, type, value, onChange, currency, disabled,
  originalKind, originalType, originalValue, originalAmount,
}: {
  kind:     "BONUS" | "SURCHARGE" | null;
  type:     "PERCENTAGE" | "FIXED_AMOUNT" | null;
  value:    number | null;
  /** Cambio total — el caller decide si es patch o clear (kind=null). */
  onChange: (patch: {
    adjustmentKind?:  "BONUS" | "SURCHARGE" | null;
    adjustmentType?:  "PERCENTAGE" | "FIXED_AMOUNT" | null;
    adjustmentValue?: number | null;
  }) => void;
  currency: string;
  disabled?: boolean;
  /**
   * Fase 2.2 — ajuste ORIGINAL del cost line del artículo (`lineAdjKind/Type/
   * Value/Amount`). Cuando hay override, se muestra tachado debajo del editor.
   * Cuando NO hay override pero SÍ original, se muestra como chip clickeable
   * que al click activa el editor precargado con esos valores. Sin original
   * ni override → botón "+ Bonif./Recargo".
   */
  originalKind?:   "BONUS" | "SURCHARGE" | null;
  originalType?:   "PERCENTAGE" | "FIXED_AMOUNT" | null;
  originalValue?:  number | null;
  originalAmount?: number | null;
}) {
  const active = kind != null;
  const originalText = fmtAdjustmentText(
    originalKind ?? null,
    originalType ?? null,
    originalValue ?? null,
    originalAmount ?? null,
    currency,
  );

  // Estado A — sin override.
  if (!active) {
    // Sin original tampoco → botón "+ Bonif./Recargo".
    if (!originalText) {
      return (
        <button
          type="button"
          // Fase 4.2 — fuera del flujo TAB. El operador llega por click
          // intencional, no como paso de navegación entre inputs.
          tabIndex={-1}
          disabled={disabled}
          onClick={() => onChange({
            adjustmentKind:  "BONUS",
            adjustmentType:  "PERCENTAGE",
            adjustmentValue: 0,
          })}
          className={cn(
            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
            "text-muted/70 hover:bg-surface2 hover:text-text",
            disabled && "opacity-50 cursor-not-allowed",
          )}
          title={disabled ? READ_ONLY_TOOLTIP : "Agregar bonificación o recargo"}
        >
          + Bonif./Recargo
        </button>
      );
    }
    // Con original — chip clickeable que precarga el editor con esos valores
    // si el operador quiere modificarlo. Cero matemática local.
    const isBonus = originalKind === "BONUS";
    const cls = isBonus
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-amber-600 dark:text-amber-400";
    return (
      <button
        type="button"
        // Fase 4.2 — chip clickeable del original; entrada intencional por click.
        tabIndex={-1}
        disabled={disabled}
        onClick={() => onChange({
          adjustmentKind:  originalKind!,
          adjustmentType:  originalType ?? "PERCENTAGE",
          adjustmentValue: originalValue ?? 0,
        })}
        title={disabled
          ? READ_ONLY_TOOLTIP
          : "Ajuste de la ficha del artículo. Click para editarlo."}
        className={cn(
          "inline-flex flex-col items-end rounded px-1 py-0.5 text-[10px] hover:bg-surface2",
          disabled && "opacity-70 cursor-help",
        )}
      >
        <span className={cn("font-semibold tabular-nums", cls)}>
          {originalText.kindWord}
          {originalText.valuePart && (
            <span className="ml-1 font-normal">{originalText.valuePart}</span>
          )}
        </span>
        {originalText.amountPart && (
          <span className={cn("text-[9px] tabular-nums leading-none", cls, "opacity-90")}>
            {originalText.amountPart}
          </span>
        )}
      </button>
    );
  }

  const isBonus    = kind === "BONUS";
  const isPercent  = type === "PERCENTAGE";
  // Fase 2.2 — el kind ahora se representa con la palabra completa
  // ("Bonif" / "Recargo") en lugar del símbolo "−"/"+", para que el
  // operador entienda qué está aplicando sin tener que adivinar.
  const kindWord   = isBonus ? "Bonif" : "Recargo";
  const kindCls    = isBonus
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-amber-600 dark:text-amber-400";
  const typeLabel  = isPercent ? "%" : "$";

  // Fase 2.2 — cuando hay override Y existe original distinto, mostramos
  // el original tachado debajo del editor.
  const overrideDiffersFromOriginal = (() => {
    if (!originalText) return false;
    if (originalKind !== kind || originalType !== type) return true;
    if ((originalValue ?? null) !== (value ?? null)) return true;
    return false;
  })();

  return (
    <div className="inline-flex flex-col items-end gap-0.5">
      <div className="inline-flex items-center gap-0.5">
        {/* Kind toggle — Bonif/Recargo como palabra (Fase 2.2).
            Fase 4.2 — fuera del flujo TAB: el operador edita el valor con
            teclado y cambia kind/type por click si quiere otra cosa. */}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => onChange({ adjustmentKind: isBonus ? "SURCHARGE" : "BONUS" })}
          title={isBonus
            ? "Bonificación activa (reduce). Click para cambiar a recargo."
            : "Recargo activo (aumenta). Click para cambiar a bonificación."}
          className={cn(
            "h-5 rounded px-1 text-[9.5px] font-semibold uppercase tracking-tight tabular-nums hover:bg-surface2",
            kindCls,
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          {kindWord}
        </button>
        {/* Value */}
        <CellNumberInput
          value={value}
          onChange={(v) => onChange({ adjustmentValue: v ?? 0 })}
          decimals={2}
          step={isPercent ? 0.5 : 1}
          readOnly={disabled}
          widthClass="w-[60px]"
        />
        {/* Type toggle — Fase 4.2 fuera del flujo TAB. */}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => onChange({ adjustmentType: isPercent ? "FIXED_AMOUNT" : "PERCENTAGE" })}
          title={isPercent ? `Porcentaje (toggle a ${currency || "$"})` : `Monto fijo (toggle a %)`}
          className={cn(
            "h-5 w-5 rounded text-[10px] font-semibold text-muted/85 hover:bg-surface2 hover:text-text",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          {typeLabel}
        </button>
        {/* Clear — Fase 4.2 fuera del flujo TAB. */}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => onChange({
            adjustmentKind:  null,
            adjustmentType:  null,
            adjustmentValue: null,
          })}
          title="Quitar ajuste"
          className={cn(
            "h-5 w-5 rounded text-muted/60 hover:bg-surface2 hover:text-text",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          <XIcon size={11} className="mx-auto" />
        </button>
      </div>
      {/* Original tachado cuando override difiere (Fase 2.2). */}
      {overrideDiffersFromOriginal && originalText && (
        <span
          className="text-[9px] leading-none text-muted/65 tabular-nums line-through"
          title="Ajuste original del artículo"
        >
          {originalText.kindWord}
          {originalText.valuePart && <> {originalText.valuePart}</>}
          {originalText.amountPart && <> · {originalText.amountPart}</>}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Una fila de la grilla. Diseño data-driven — la lógica de qué celdas
// editan/no editan vive en el caller (composeRowProps).
// ─────────────────────────────────────────────────────────────────────────────

function RowImpl({
  componentType, Icon, primary, secondary,
  quantityCell, unitValueCell, mermaCell, adjustmentCell,
  saleValueValue, saleValueText, totalValue, totalText,
  manual, onResetRow, canResetRow,
  commercialView,
  precioUnitVentaText, margenPctText, margenTone,
  ventaLineaText, participacionText,
}: {
  componentType:   ComponentTypeKey;
  Icon:            LucideIcon;
  primary:         React.ReactNode;
  /** Fase 2.4 — secondary line ahora incluye la unidad (gramos / unidad)
   *  inline. La columna UNID. fue removida. */
  secondary?:      React.ReactNode;
  quantityCell:    React.ReactNode;
  unitValueCell:   React.ReactNode;
  mermaCell:       React.ReactNode;
  adjustmentCell:  React.ReactNode;
  /** Fase 2.1 — el valor numérico (no el texto) se pasa para detectar
   *  cambios y disparar el flash de highlight. */
  saleValueValue?: number | null;
  saleValueText?:  string | null;
  totalValue?:     number | null;
  totalText?:      string | null;
  manual:          boolean;
  onResetRow:      () => void;
  canResetRow:     boolean;
  // MVP híbrido — campos comerciales solo cuando `commercialView`. Todos
  // ya pre-formateados por el caller (passthrough; cero matemática nueva
  // en este componente).
  commercialView?: boolean;
  precioUnitVentaText?: string | null;
  margenPctText?:       string | null;
  margenTone?:          string;
  ventaLineaText?:      string | null;
  participacionText?:   string | null;
}) {
  const cls = COMPONENT_TYPE_BADGE[componentType];
  // Fase 2.1 — highlight sutil cuando los valores derivados (sale/total)
  // cambian post-preview backend. Cero animación pesada — solo un breve
  // bg-emerald que se desvanece (transition-colors).
  const flashSale  = useFlashOnChange(saleValueValue ?? null);
  const flashTotal = useFlashOnChange(totalValue ?? null);

  return (
    <div
      className={cn(
        commercialView ? TABLE_COLS_CLS_COMMERCIAL : TABLE_COLS_CLS,
        // Fase 2.1 — padding vertical reducido (py-1 vs py-1.5 anterior).
        "px-1.5 py-1 text-[11px]",
        // Indicador lateral muy sutil cuando la fila tiene override manual.
        manual && "bg-amber-500/[0.025]",
      )}
    >
      <span
        className={cn("inline-flex h-5 w-5 items-center justify-center rounded ring-1", cls.bg, cls.ring)}
        aria-hidden
      >
        <Icon size={11} className={cls.icon} />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          {/* Fase 2.1 — indicador "Manual" más sutil: punto ámbar en vez
              de chip con fondo. Mantiene la señal visual sin ruido. */}
          {manual && (
            <span
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/80"
              title="Esta fila tiene override manual"
              aria-label="manual"
            />
          )}
          <span className="font-medium text-text truncate">{primary}</span>
          {/* Etiqueta "Manual" textual MUY sutil — italic small, sin chip.
              Sigue siendo seleccionable por tests (`getByText("Manual")`). */}
          {manual && (
            <span className="text-[8.5px] uppercase tracking-wide text-amber-600/70 dark:text-amber-400/70">
              Manual
            </span>
          )}
        </div>
        {secondary && (
          <div className="text-[10px] text-muted/75 leading-tight truncate">{secondary}</div>
        )}
      </div>
      <div className="text-right tabular-nums text-text/90">{quantityCell}</div>
      <div className="text-right tabular-nums text-text/90">{unitValueCell}</div>
      <div className="text-right tabular-nums text-text/90">{mermaCell}</div>
      <div className="flex justify-center tabular-nums">{adjustmentCell}</div>
      <div
        className={cn(
          "text-right tabular-nums font-medium text-text rounded transition-colors duration-500 px-1",
          flashSale,
        )}
      >
        {saleValueText ?? "—"}
      </div>
      <div
        className={cn(
          "text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400 rounded transition-colors duration-500 px-1",
          flashTotal,
        )}
      >
        {totalText ?? "—"}
      </div>
      {commercialView && (
        <>
          {/* Precio unit. venta — solo cuando es canónico (count===1).
              "—" cuando el caller no pudo resolverlo sin matemática nueva. */}
          <div className="text-right tabular-nums font-medium text-emerald-700/90 dark:text-emerald-300/90">
            {precioUnitVentaText ?? "—"}
          </div>
          {/* Margen % — derivación trivial sobre cost+sale del motor. */}
          <div className={cn("text-right tabular-nums font-semibold", margenTone ?? "text-muted/60")}>
            {margenPctText ?? "—"}
          </div>
          {/* Venta línea — `precioUnitVenta × cantidad` (passthrough sale). */}
          <div className="text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-300">
            {ventaLineaText ?? "—"}
          </div>
          {/* Participación — display-only, lineCost / Σ lineCost × 100. */}
          <div className="text-right tabular-nums text-muted/85 text-[10px]">
            {participacionText ?? "—"}
          </div>
        </>
      )}
      <div className="flex justify-center">
        <button
          type="button"
          // Fase 4.2 — restore es acción de excepción, no debería interrumpir
          // el flujo TAB del operador entre celdas editables.
          tabIndex={-1}
          onClick={onResetRow}
          disabled={!canResetRow}
          title={canResetRow ? "Restaurar esta fila" : "Sin overrides en esta fila"}
          className={cn(
            "h-5 w-5 rounded text-muted/60 hover:bg-surface2 hover:text-text",
            !canResetRow && "opacity-30 cursor-not-allowed",
          )}
        >
          <RotateCcw size={11} className="mx-auto" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fase 4.4 — React.memo(Row) con comparator estable.
//
// Estrategia conservadora: comparamos los datos PRIMITIVOS que controlan
// el render (componentType, manual, canResetRow, saleValueValue,
// totalValue, saleValueText, totalText). Los ReactNode (cells/primary/
// secondary) son funciones puras de los primitivos que el caller deriva,
// por lo tanto si los primitivos no cambiaron el JSX renderizado es
// equivalente — saltar el render es seguro.
//
// Si un caller en el futuro pasa cells que dependan de un dato externo
// no listado acá, el memo podría quedar stale. Mitigar agregando ese
// dato a la lista de comparación.
//
// Importante: Icon y onResetRow no se comparan — los pasamos como
// closures pero al ser identidad referencial (recreated each render),
// causarían el rerender si los chequeáramos. Aceptamos que su cambio
// no fuerza rerender porque su salida visual depende solo de los
// primitivos de la fila.
// ─────────────────────────────────────────────────────────────────────────────

const Row = React.memo(RowImpl, (prev, next) => {
  if (prev.componentType   !== next.componentType)   return false;
  if (prev.manual          !== next.manual)          return false;
  if (prev.canResetRow     !== next.canResetRow)     return false;
  if (prev.saleValueValue  !== next.saleValueValue)  return false;
  if (prev.totalValue      !== next.totalValue)      return false;
  if (prev.saleValueText   !== next.saleValueText)   return false;
  if (prev.totalText       !== next.totalText)       return false;
  // MVP híbrido — props comerciales.
  if (prev.commercialView      !== next.commercialView)      return false;
  if (prev.precioUnitVentaText !== next.precioUnitVentaText) return false;
  if (prev.margenPctText       !== next.margenPctText)       return false;
  if (prev.margenTone          !== next.margenTone)          return false;
  if (prev.ventaLineaText      !== next.ventaLineaText)      return false;
  if (prev.participacionText   !== next.participacionText)   return false;
  // primary / secondary / *Cell son JSX nodes derivados de los primitivos
  // del caller. Asumimos pure-derivation y skipeamos.
  return true;
});

// ─────────────────────────────────────────────────────────────────────────────
// Bloque inferior — ajustes globales del documento.
// ─────────────────────────────────────────────────────────────────────────────

function fmtSignedAmount(amount: number, isReducing: boolean, currency: string) {
  const sign = isReducing ? "−" : "+";
  const cls  = isReducing
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-amber-600 dark:text-amber-400";
  return (
    <span className={cn("tabular-nums font-semibold", cls)}>
      {sign}{fmtMoney(Math.abs(amount), currency)}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fase 2.7.b — Bloque "Impacto en precio de venta".
//
// Resumen agregado POR TIPO (Metal / Hechura) del pasaje de costo a venta.
// Usa exclusivamente los 6 campos canónicos de `pricingMeta`:
//   metalCost, metalSale, metalMarginPct
//   hechuraCost, hechuraSale, hechuraMarginPct
//
// Reglas:
//   · Cero matemática derivada — todos los números vienen del motor.
//   · Granularidad: tipo agregado, NO per cost-line (eso es Fase 2.7.d).
//   · Si los 4 valores Cost/Sale son null/0, el bloque se oculta.
//   · Para PRODUCT/SERVICE no hay sale-side per-tipo; el motor los funde
//     en hechura/extra según la lista — quedan fuera de este bloque.
//
// Layout: 2 filas compactas (Metal / Hechura), tipografía 11px, alineadas
// a derecha los importes. Tono emerald sutil para sale-side, neutro para
// cost-side. Margen %: tono según valor (≥40 emerald, ≥15 text, >0 amber,
// ≤0 red), mismo criterio que el KPI Margen.
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Fase 6 — reemplazado por `<PriceFlowCards>`. Mantenido en el
 *  archivo por compatibilidad; ningún caller actual lo invoca. Candidato a
 *  eliminación tras 1-2 sprints de medición. */
function SaleImpactBlock({
  metalCost, metalSale, metalMarginPct,
  hechuraCost, hechuraSale, hechuraMarginPct,
  currency,
}: {
  metalCost:        number | null;
  metalSale:        number | null;
  metalMarginPct:   number | null;
  hechuraCost:      number | null;
  hechuraSale:      number | null;
  hechuraMarginPct: number | null;
  currency:         string;
}) {
  const hasMetal   = (metalCost   != null && metalCost   !== 0) || (metalSale   != null && metalSale   !== 0);
  const hasHechura = (hechuraCost != null && hechuraCost !== 0) || (hechuraSale != null && hechuraSale !== 0);
  if (!hasMetal && !hasHechura) return null;

  const fmt = (v: number | null) =>
    v != null && Number.isFinite(v) ? fmtMoney(v, currency) : "—";
  const marginToneClass = (pct: number | null | undefined): string =>
    pct == null
      ? "text-muted/60"
      : pct >= 40 ? "text-emerald-600 dark:text-emerald-400"
      : pct >= 15 ? "text-text"
      : pct >  0  ? "text-amber-600 dark:text-amber-400"
      :             "text-red-500";

  const Row = ({
    label, cost, sale, marginPct,
  }: {
    label:     string;
    cost:      number | null;
    sale:      number | null;
    marginPct: number | null;
  }) => (
    <div className="grid grid-cols-[80px_1fr_auto_1fr_auto_70px] items-baseline gap-x-2 text-[11px]">
      <span className="text-muted">{label}</span>
      <span className="text-right tabular-nums text-text/85">{fmt(cost)}</span>
      <span className="text-muted/50">→</span>
      <span className="text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-300">
        {fmt(sale)}
      </span>
      <span className="text-muted/50">·</span>
      <span className={cn("text-right tabular-nums font-semibold", marginToneClass(marginPct))}>
        {marginPct != null && Number.isFinite(marginPct) ? `${marginPct.toFixed(1)}%` : "—"}
      </span>
    </div>
  );

  return (
    <div className="space-y-0.5 border-t border-border/30 pt-2">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-muted/80">
        Impacto en precio de venta
      </div>
      {/* Header micro-columnas (alinea con las celdas de las filas). */}
      <div className="grid grid-cols-[80px_1fr_auto_1fr_auto_70px] gap-x-2 text-[8.5px] uppercase tracking-wide text-muted/55">
        <span aria-hidden />
        <span className="text-right">Costo</span>
        <span aria-hidden />
        <span className="text-right">Venta</span>
        <span aria-hidden />
        <span className="text-right">Margen</span>
      </div>
      {hasMetal && (
        <Row label="Metal" cost={metalCost} sale={metalSale} marginPct={metalMarginPct} />
      )}
      {hasHechura && (
        <Row label="Hechura" cost={hechuraCost} sale={hechuraSale} marginPct={hechuraMarginPct} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fase 2.5 — Bloque "Ajuste global de costo".
//
// Renderiza el ajuste configurado en el modal del artículo (Bonificación /
// Recargo del campo `Article.manualAdjustment*`). Se aplica sobre el total
// post-cost-lines y NO se confunde con:
//   · canal / cupón / forma de pago / envío / desc. global doc-level
//   · `lineAdj*` per cost line (PRODUCT/SERVICE/HECHURA Fase 2.2)
//   · `manualDiscount` con appliesTo=TOTAL per línea de venta
//
// Si `data` es null/undefined o `kind === null`, el bloque se oculta.
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Fase 6 — reemplazado por `<PriceFlowCards>` (card "Ajustes
 *  globales aplicados"). Mantenido por compatibilidad; ningún caller actual
 *  lo invoca. */
function CostAdjustmentBlock({
  data, currency,
}: {
  data: {
    kind:   "BONUS" | "SURCHARGE" | null;
    type:   "PERCENTAGE" | "FIXED_AMOUNT" | null;
    value:  number | null;
    amount: number | null;
  } | null | undefined;
  currency: string;
}) {
  if (!data || !data.kind) return null;

  const isBonus = data.kind === "BONUS";
  const labelKind = isBonus ? "Bonificación" : "Recargo";
  // valuePart: "25%" o monto fijo formateado.
  const valuePart = (() => {
    if (data.value == null || !Number.isFinite(data.value)) return null;
    if (data.type === "PERCENTAGE")  return `${data.value}%`;
    if (data.type === "FIXED_AMOUNT") return fmtMoney(data.value, currency);
    return String(data.value);
  })();

  return (
    <div className="space-y-0.5 text-[11px]">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-muted/80">
        Ajuste global de costo
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted">
          {labelKind}
          {valuePart && <span className="ml-1 text-text/90">{valuePart}</span>}
        </span>
        {data.amount != null && Number.isFinite(data.amount) && data.amount !== 0
          ? fmtSignedAmount(Math.abs(data.amount), isBonus, currency)
          : <span className="tabular-nums text-muted/60">—</span>}
      </div>
    </div>
  );
}

function GlobalAdjustmentsBlock({
  data, currency,
}: {
  data:     SaleGlobalAdjustments;
  currency: string;
}) {
  // Fase 2.2 — el bloque ahora SOLO muestra la bonificación / recargo
  // global de la línea (`lineManualDiscount` con appliesTo=TOTAL, viene
  // del modal/línea de artículos). Canal de venta / cupón / forma de
  // pago / envío y descuento global del documento se ocultan acá:
  // viven en el resumen del documento, no per-línea.
  //
  // Los campos `channel/coupon/payment/shipping/globalDiscount` siguen
  // existiendo en `SaleGlobalAdjustments` por retrocompat — quedan
  // ignorados en el render. Cualquier consumidor futuro puede volver a
  // mostrarlos sin cambiar el contrato.
  const lineMd = data.lineManualDiscount ?? null;
  if (!lineMd || lineMd.amount === 0) return null;

  const isBonus = lineMd.kind === "BONUS";
  const labelKind = isBonus ? "Bonificación" : "Recargo";

  return (
    <div className="space-y-0.5 text-[11px]">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-muted/80">
        Ajustes globales
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted">
          {labelKind} de línea
          {lineMd.valuePct != null && (
            <span className="ml-1 text-text/90">{lineMd.valuePct.toFixed(2)}%</span>
          )}
        </span>
        {fmtSignedAmount(lineMd.amount, isBonus, currency)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export function SaleCompositionEditableGrid({
  line, currency,
  onApply, onClear, onClose,
  unitNameByCode,
  globalAdjustments,
  previewLoading,
}: SaleCompositionEditableGridProps) {
  const meta        = line.pricingMeta ?? {};
  const composition = (meta.composition ?? null) as any;

  const metals    = (composition?.metals    ?? []) as any[];
  const hechuras  = (composition?.hechuras  ?? []) as any[];
  const products  = (composition?.products  ?? []) as any[];
  const services  = (composition?.services  ?? []) as any[];

  // MVP híbrido (Print 2) — toggle vista costo / vista comercial.
  // OFF por default: la grilla muestra solo composición de costo (Print 1).
  // ON: agrega 4 columnas comerciales con sale-side SOLO cuando es canónico
  // (count===1 para METAL/HECHURA). PRODUCT/SERVICE quedan en "—" porque
  // el motor no descompone su sale-side per-item. Cero matemática nueva.
  const [commercialView, setCommercialView] = useState(false);

  // Suma de costos para "Participación %". Display-only — derivación trivial
  // sobre datos del motor (lineCost/totalValue de cada cost-line).
  const totalCostForParticipation = (() => {
    let s = 0;
    for (const m of metals)   if (Number.isFinite(m?.lineCost))   s += Number(m.lineCost);
    for (const h of hechuras) if (Number.isFinite(h?.lineCost))   s += Number(h.lineCost);
    for (const p of products) if (Number.isFinite(p?.totalValue)) s += Number(p.totalValue);
    for (const sv of services) if (Number.isFinite(sv?.totalValue)) s += Number(sv.totalValue);
    return s;
  })();

  // ── Estado de overrides activos ──────────────────────────────────────────
  // Lee `pricingMeta.costLineOverrides` (intent del usuario) o, si no hay,
  // `costLineOverridesApplied` (eco del backend). Ningún cálculo local —
  // solo lookup/patch.
  const activeCostLineOverrides: CostLineOverride[] = (() => {
    const intent = (meta as any).costLineOverrides;
    if (Array.isArray(intent) && intent.length > 0) return intent as CostLineOverride[];
    const applied = (meta as any).costLineOverridesApplied;
    if (Array.isArray(applied)) return applied as CostLineOverride[];
    return [];
  })();

  function applyCostLinePatch(
    costLineId: string,
    type:       CostLineOverride["type"],
    patch:      Partial<Omit<CostLineOverride, "costLineId" | "type">>,
  ) {
    const next = patchCostLineOverride(activeCostLineOverrides, costLineId, type, patch);
    onApply({ costLineOverrides: next });
  }

  function resetCostLine(costLineId: string) {
    const next = activeCostLineOverrides.filter(o => o?.costLineId !== costLineId);
    onApply({ costLineOverrides: next });
  }

  function handleClearAll() {
    // Limpia explícitamente el array Y los legacy. El backend recalcula sin
    // overrides.
    onApply({
      costLineOverrides:      [],
      gramsOverride:          null,
      mermaPercentOverride:   null,
      hechuraOverrideAmount:  null,
      metalVariantIdOverride: null,
    });
    onClear?.();
  }

  // Detección global de overrides activos — controla visibilidad de
  // "Restaurar todo".
  const hasAnyOverride =
    activeCostLineOverrides.length > 0 ||
    meta.gramsOverride         != null ||
    meta.mermaPercentOverride  != null ||
    meta.hechuraOverrideAmount != null ||
    !!meta.metalVariantIdOverride;

  const totalRows = metals.length + hechuras.length + products.length + services.length;

  // ── Helpers visuales ────────────────────────────────────────────────────
  const fmt = (v: number | null | undefined) =>
    v != null && Number.isFinite(v) ? fmtMoney(v, currency) : null;

  const qtyLine = Number.isFinite(line.quantity) ? line.quantity : 0;
  const totalForRow = (saleVal: number | null) =>
    saleVal != null && qtyLine > 1 ? saleVal * qtyLine : saleVal;

  const resolveUnitName = (code: string | null | undefined, fallback: string): string => {
    if (!code) return fallback;
    const name = unitNameByCode?.get(code);
    return name ?? code;
  };

  // MVP híbrido — helper que arma las 4 cells comerciales de una fila.
  // Reglas:
  //   · `saleLineValue` viene del caller; si es null → toda la fila comercial
  //     queda en "—" (no se inventan números).
  //   · Margen %: derivación trivial sobre cost+sale del motor.
  //   · Venta línea: sale × quantity de la línea de venta (passthrough).
  //   · Participación: lineCost / Σ lineCost × 100 (display-only).
  function buildCommercialCells(
    lineCost:      number | null,
    saleLineValue: number | null,
    qtyComp:       number | null,
  ): {
    precioUnitVentaText: string | null;
    margenPctText:       string | null;
    margenTone:          string;
    ventaLineaText:      string | null;
    participacionText:   string | null;
  } {
    // Precio unit. venta = saleLineValue / qtyComp cuando ambos válidos.
    let precioUnitVentaText: string | null = null;
    if (saleLineValue != null && Number.isFinite(saleLineValue)
        && qtyComp != null && Number.isFinite(qtyComp) && qtyComp > 0) {
      precioUnitVentaText = fmt(saleLineValue / qtyComp);
    }
    // Margen % = (sale - cost) / cost × 100. Solo cuando ambos válidos.
    let margenPctText: string | null = null;
    let margenPct: number | null = null;
    if (lineCost != null && Number.isFinite(lineCost) && lineCost > 0
        && saleLineValue != null && Number.isFinite(saleLineValue)) {
      margenPct = ((saleLineValue - lineCost) / lineCost) * 100;
      // Formato es-AR: coma decimal para consistencia con `fmt()` del resto.
      margenPctText = `${margenPct.toFixed(1).replace(".", ",")}%`;
    }
    const margenTone = (() => {
      if (margenPct == null) return "text-muted/60";
      if (margenPct >= 40)   return "text-emerald-600 dark:text-emerald-400";
      if (margenPct >= 15)   return "text-text";
      if (margenPct >  0)    return "text-amber-600 dark:text-amber-400";
      return "text-red-500";
    })();
    // Venta línea = sale × line.quantity (mismo patrón que `totalForRow` de cost).
    let ventaLineaText: string | null = null;
    if (saleLineValue != null && Number.isFinite(saleLineValue)) {
      ventaLineaText = fmt(qtyLine > 1 ? saleLineValue * qtyLine : saleLineValue);
    }
    // Participación = lineCost / Σ lineCost × 100 (display-only).
    let participacionText: string | null = null;
    if (lineCost != null && Number.isFinite(lineCost)
        && totalCostForParticipation > 0) {
      const part = (lineCost / totalCostForParticipation) * 100;
      participacionText = `${part.toFixed(1).replace(".", ",")}%`;
    }
    return { precioUnitVentaText, margenPctText, margenTone, ventaLineaText, participacionText };
  }

  // Sale-side per-cost-line ÚNICAMENTE cuando es canónico:
  //   · METAL count===1   → metalSale agregado IS the per-item sale.
  //   · HECHURA count===1 → idem hechuraSale.
  //   · resto             → null (cells = "—") — NO inventamos prorrateo.
  const metalSaleCanonical: number | null =
    metals.length === 1 && (meta as any)?.metalSale != null && Number.isFinite((meta as any).metalSale)
      ? Number((meta as any).metalSale)
      : null;
  const hechuraSaleCanonical: number | null =
    hechuras.length === 1 && (meta as any)?.hechuraSale != null && Number.isFinite((meta as any).hechuraSale)
      ? Number((meta as any).hechuraSale)
      : null;

  // ── Total de componentes (header) ───────────────────────────────────────
  const sumSale = (xs: any[], key: string) =>
    xs.reduce<number | null>((acc, it) => {
      const v = it?.[key];
      if (v == null || !Number.isFinite(v)) return acc;
      return (acc ?? 0) + v;
    }, null);

  const totalComponents =
    (sumSale(metals,   "lineCost")   ?? 0) +
    (sumSale(hechuras, "lineCost")   ?? 0) +
    (sumSale(products, "totalValue") ?? 0) +
    (sumSale(services, "totalValue") ?? 0);
  const showTotalSum = metals.length + hechuras.length + products.length + services.length > 0;
  // Fase 2.1 — flash en "Total componentes" cuando el preview backend
  // devuelve un nuevo valor (post-edit). Mismo highlight sutil del margen.
  const flashTotal = useFlashOnChange(showTotalSum ? totalComponents : null);
  // Fase 2.6.2 — VALOR DE VENTA del header. Mismo campo que el KPI inferior
  // (basePrice × qty con fallback a unitPrice × qty). Ver Fase 2.6.1.
  const qtyForSale = Number.isFinite(line.quantity) ? line.quantity : 1;
  const headerSaleUnitPrice =
    Number.isFinite((meta as any)?.basePrice) ? (meta as any).basePrice
    : Number.isFinite(line.unitPrice)         ? line.unitPrice
    : null;
  const headerSaleTotal = headerSaleUnitPrice != null
    ? headerSaleUnitPrice * qtyForSale
    : null;
  const flashHeaderSale = useFlashOnChange(headerSaleTotal);

  return (
    <div className="space-y-2" data-testid="sale-composition-editable-grid">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.04em] text-muted/75">
          {/* Fase 2.7.a — el card muestra composición de COSTO; el
              "Valor de venta neto" vive en su sección destacada (inline
              + KPI inferior). Title alineado con la realidad funcional. */}
          Composición del costo del artículo
          {/* Fase 4.3 — mini-spinner inline cuando hay preview en vuelo.
              Se ubica al lado del título para que el operador vea el
              feedback sin mover los ojos del área que está editando. */}
          {previewLoading && (
            <span
              className="ml-2 inline-flex items-center gap-1 normal-case text-muted/60"
              role="status"
              aria-label="Recalculando"
              data-testid="sale-grid-loading"
            >
              <Loader2 size={10} className="animate-spin text-primary/70" />
              <span className="text-[9px]">Recalculando…</span>
            </span>
          )}
          {showTotalSum && (
            <span className="ml-2 normal-case text-muted/60">
              {/* Fase 2.6.2 — el label "Total:" era ambiguo (sugería que
                  coincidía con el precio del artículo). Ahora es
                  "Componentes:" — es la suma de cost lines. */}
              · Componentes:{" "}
              <span className={cn(
                "font-semibold text-text/90 tabular-nums rounded px-1 transition-colors duration-500",
                flashTotal,
              )}>
                {fmtMoney(totalComponents, currency)}
              </span>
            </span>
          )}
          {/* Fase 2.6.2 — Valor de venta neto inline en header. Mismo
              campo que el KPI Rentabilidad (basePrice × qty). Fase 2.6.3:
              label clarificado a "Valor de venta neto" para distinguir
              que NO incluye impuestos. */}
          {headerSaleTotal != null && (
            <span className="ml-2 normal-case text-muted/60">
              · Valor de venta neto:{" "}
              <span className={cn(
                "font-semibold tabular-nums rounded px-1 transition-colors duration-500",
                "text-emerald-700 dark:text-emerald-300",
                flashHeaderSale,
              )}>
                {fmtMoney(headerSaleTotal, currency)}
              </span>
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          {/* MVP híbrido — segmented control "Costo / Comercial".
              OFF default = "Costo". Cuando ON, la tabla agrega 4 columnas
              comerciales a la derecha (Precio Unit. Venta, Margen %, Venta
              Línea, Participación). Sale-side solo donde es canónico. */}
          <div
            role="tablist"
            aria-label="Vista de la composición"
            data-testid="sale-grid-view-segmented"
            className="inline-flex items-center rounded-md border border-border/40 bg-surface2/60 p-0.5 text-[10px] uppercase tracking-wide"
          >
            <button
              type="button"
              role="tab"
              tabIndex={-1}
              aria-selected={!commercialView}
              data-testid="sale-grid-view-cost"
              onClick={() => setCommercialView(false)}
              title="Vista de costo (compacta, 8 columnas)"
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 py-0.5 transition-colors",
                !commercialView
                  ? "bg-card text-text shadow-sm ring-1 ring-border/40"
                  : "text-muted hover:text-text",
              )}
            >
              Vista costo
            </button>
            <button
              type="button"
              role="tab"
              tabIndex={-1}
              aria-selected={commercialView}
              data-testid="sale-grid-commercial-toggle"
              aria-pressed={commercialView}
              onClick={() => setCommercialView(true)}
              title="Vista comercial (+ precio venta, margen, participación)"
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 py-0.5 transition-colors",
                commercialView
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/40 shadow-sm"
                  : "text-muted hover:text-text",
              )}
            >
              Vista comercial
            </button>
          </div>
          {hasAnyOverride && (
            <button
              type="button"
              // Fase 4.2 — acciones del header fuera del flujo TAB.
              tabIndex={-1}
              onClick={handleClearAll}
              title="Restaurar valores originales del artículo"
              data-testid="sale-grid-restore-all"
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted hover:bg-surface2 hover:text-text"
            >
              <RotateCcw size={10} />
              Restaurar todo
            </button>
          )}
          {onClose && (
            <button
              type="button"
              tabIndex={-1}
              onClick={onClose}
              title="Cerrar"
              className="inline-flex h-5 w-5 items-center justify-center rounded text-muted/70 hover:bg-surface2 hover:text-text"
            >
              <XIcon size={11} />
            </button>
          )}
        </div>
      </div>

      {/* ── Tabla ─────────────────────────────────────────────────────── */}
      {totalRows === 0 ? (
        <div className="rounded-md border border-dashed border-border/50 bg-card/40 px-3 py-6 text-center text-[11px] italic text-muted/70">
          Sin componentes para editar.
        </div>
      ) : (
        <div
          className={cn(
            "rounded-md border border-border/30 bg-card/30",
            // En vista comercial las 13 columnas requieren más espacio
            // — habilitamos scroll horizontal con un min-width interno.
            commercialView && "overflow-x-auto",
          )}
        >
          <div className={cn(commercialView && "min-w-[1180px]")}>
          <TableHeader commercialView={commercialView} />
          <div className="divide-y divide-border/25">
            {/* METAL — una fila por costLineId */}
            {metals.map((m: any, idx: number) => {
              const costLineId = m?.costLineId ?? null;
              const isEditable = costLineId != null;
              const ov = costLineId
                ? findCostLineOverride(activeCostLineOverrides, costLineId)
                : undefined;

              const qtyValue = ov?.quantityOverride != null
                ? Number(ov.quantityOverride)
                : (m?.appliedGrams ?? null);
              const mermaValue = ov?.mermaPercentOverride != null
                ? Number(ov.mermaPercentOverride)
                : (m?.appliedMermaPct ?? null);
              const lineCost = m?.lineCost ?? null;
              // Fase 2.4 — semántica revisada para METAL:
              //   · VAL. UNIT. = `lineCost / qty` (POST-merma por gramo).
              //     El usuario explicitó: "VAL. UNIT. debe mostrar valor
              //     unitario con merma aplicada".
              //   · V. VENTA   = `lineCost` (total del componente, post-
              //     merma). "valor de venta/componente resultante".
              //   · TOTAL      = `lineCost × line.quantity` (full impact).
              // El base `quotePrice` queda como dato secundario en el
              // tooltip del input (sin recálculo, passthrough).
              const postMermaPerGramText = lineCost != null && qtyValue && qtyValue > 0
                ? fmt(lineCost / Number(qtyValue))
                : null;
              const baseQuotePriceText = (m as any)?.quotePrice != null
                ? fmt(Number((m as any).quotePrice))
                : null;

              // Fase 2.4 — primary = nombre comercial de la variante
              // (`m.variantName`, ej. "Oro 18 Kilates"). Fallback Fase 2.2:
              // `metalName + purityLabel` ("Oro 18k") cuando el snapshot
              // viejo no trae variantName.
              const metalPrimary = (() => {
                const cmd     = (m as any)?.variantName ?? null;
                if (typeof cmd === "string" && cmd.trim().length > 0) return cmd;
                const name    = m?.metalName ?? null;
                const variant = m?.purityLabel ?? null;
                if (name && variant) return `${name} ${variant}`;
                return name ?? variant ?? "Metal";
              })();
              // Fase 2.4 — secondary = "Ley: 0,750 · gramos" (combina ley
              // técnica + unidad). Antes la unidad vivía en columna
              // separada UNID; ahora va inline para liberar espacio.
              const leyText = (() => {
                if (m?.purity != null && Number.isFinite(Number(m.purity))) {
                  return `Ley: ${Number(m.purity).toLocaleString("es-AR", {
                    minimumFractionDigits: 3,
                    maximumFractionDigits: 3,
                  })}`;
                }
                if (m?.purityLabel) {
                  return `Ley: ${m.purityLabel}`;
                }
                return null;
              })();
              const secondary = (
                <span>
                  {leyText && <>{leyText} · </>}
                  <span className="text-muted/60">gramos</span>
                </span>
              );

              const totalRow = totalForRow(lineCost);
              // F1.5 #A++ — `lineSale` per METAL ahora viene canónico del motor
              // (passthrough exacto: lineCost × metalSale/metalCost). Para
              // snapshots legacy sin este campo, fallback a `metalSaleCanonical`
              // (válido solo cuando count===1, sino "—").
              const metalLineSale = (m as any)?.lineSale;
              const saleForRow: number | null =
                metalLineSale != null && Number.isFinite(Number(metalLineSale))
                  ? Number(metalLineSale)
                  : metalSaleCanonical;
              const commercialCells = buildCommercialCells(
                lineCost,
                saleForRow,
                qtyValue ?? null,
              );
              return (
                <Row
                  key={`metal-${costLineId ?? idx}`}
                  componentType="METAL"
                  Icon={Gem}
                  primary={metalPrimary}
                  secondary={secondary}
                  commercialView={commercialView}
                  precioUnitVentaText={commercialCells.precioUnitVentaText}
                  margenPctText={commercialCells.margenPctText}
                  margenTone={commercialCells.margenTone}
                  ventaLineaText={commercialCells.ventaLineaText}
                  participacionText={commercialCells.participacionText}
                  quantityCell={
                    <CellNumberInput
                      value={qtyValue}
                      onChange={isEditable && costLineId
                        ? (v) => applyCostLinePatch(costLineId, "METAL", { quantityOverride: v ?? 0 })
                        : () => {}}
                      // Fase 2.3 — gramos con 2 decimales (era 3 → "1,000").
                      decimals={2}
                      step={0.05}
                      suffix={<span className="text-[10px] text-muted/60">g</span>}
                      readOnly={!isEditable}
                      tooltip={!isEditable ? READ_ONLY_TOOLTIP : undefined}
                      // Fase 2.1 — original = `appliedGrams` del backend.
                      // Cuando hay quantityOverride, mostramos el original
                      // tachado debajo del input. Fase 2.3 — 2 decimales.
                      original={m?.appliedGrams ?? null}
                      decimalsOriginal={2}
                    />
                  }
                  // Fase 2.4 — VAL. UNIT. = post-merma per gram (lineCost/qty).
                  // El base por gramo (`quotePrice`) queda como tooltip
                  // informativo, no como valor principal.
                  unitValueCell={
                    <span
                      className="text-text/90"
                      title={baseQuotePriceText ? `Valor base por gramo: ${baseQuotePriceText}` : undefined}
                    >
                      {postMermaPerGramText ?? "—"}
                    </span>
                  }
                  mermaCell={
                    <CellNumberInput
                      value={mermaValue}
                      onChange={isEditable && costLineId
                        ? (v) => applyCostLinePatch(costLineId, "METAL", { mermaPercentOverride: v ?? 0 })
                        : () => {}}
                      decimals={2}
                      step={0.5}
                      suffix={<span className="text-[10px] text-muted/60">%</span>}
                      readOnly={!isEditable}
                      tooltip={!isEditable ? READ_ONLY_TOOLTIP : undefined}
                      widthClass="w-[72px]"
                      original={m?.appliedMermaPct ?? null}
                    />
                  }
                  // METAL no soporta lineAdj cost-side (motor lo descarta).
                  adjustmentCell={<span className="text-muted/40">—</span>}
                  // Fase 2.4 — V. VENTA = `lineCost` (total del componente
                  // post-merma). TOTAL = lineCost × line.quantity.
                  saleValueValue={lineCost}
                  saleValueText={fmt(lineCost)}
                  totalValue={totalRow}
                  totalText={fmt(totalRow)}
                  manual={!!ov}
                  onResetRow={costLineId ? () => resetCostLine(costLineId) : () => {}}
                  canResetRow={!!ov}
                />
              );
            })}

            {/* HECHURA — una fila por costLineId */}
            {hechuras.map((h: any, idx: number) => {
              const costLineId = h?.costLineId ?? null;
              const isEditable = costLineId != null;
              const ov = costLineId
                ? findCostLineOverride(activeCostLineOverrides, costLineId)
                : undefined;

              const qtyValue = ov?.quantityOverride != null
                ? Number(ov.quantityOverride)
                : 1;
              // Fase 2.3.1 — VAL. UNIT. = `h.unitValue` (base pre-ajuste).
              // Antes usaba `h.appliedAmount` que es step.value (post-ajuste);
              // cuando la HECHURA tenía bonif/recargo configurado, VAL. UNIT.
              // mostraba el valor con el ajuste ya aplicado. Fallback a
              // `appliedAmount` para snapshots viejos sin `unitValue`.
              const baseUnitValue = (h as any)?.unitValue ?? h?.appliedAmount ?? 0;
              const unitValValue = ov?.unitValueOverride != null
                ? Number(ov.unitValueOverride)
                : Number(baseUnitValue);
              const lineCost = h?.lineCost ?? null;
              // F1.5 #A+ — `lineSale` viene del motor (passthrough). Cuando
              // el backend no lo emite (snapshots viejos / margen no derivable),
              // hacemos fallback al `hechuraSaleCanonical` (count===1) por
              // compatibilidad. Cuando ninguno aplica → "—".
              const lineSaleFromBackend = (h as any)?.lineSale;
              const saleForRow: number | null =
                lineSaleFromBackend != null && Number.isFinite(Number(lineSaleFromBackend))
                  ? Number(lineSaleFromBackend)
                  : hechuraSaleCanonical;
              const commercialCells = buildCommercialCells(
                lineCost,
                saleForRow,
                qtyValue ?? null,
              );

              return (
                <Row
                  key={`hechura-${costLineId ?? idx}`}
                  componentType="HECHURA"
                  Icon={Hammer}
                  primary={h?.lineLabel ?? "Hechura"}
                  // Fase 2.4 — la moneda ya se entiende por los importes;
                  // el secondary deja solo la unidad.
                  secondary={
                    <span className="text-muted/60">unidad</span>
                  }
                  commercialView={commercialView}
                  precioUnitVentaText={commercialCells.precioUnitVentaText}
                  margenPctText={commercialCells.margenPctText}
                  margenTone={commercialCells.margenTone}
                  ventaLineaText={commercialCells.ventaLineaText}
                  participacionText={commercialCells.participacionText}
                  quantityCell={
                    <CellNumberInput
                      value={qtyValue}
                      onChange={isEditable && costLineId
                        ? (v) => applyCostLinePatch(costLineId, "HECHURA", { quantityOverride: v ?? 0 })
                        : () => {}}
                      decimals={2}
                      step={1}
                      readOnly={!isEditable}
                      tooltip={!isEditable ? READ_ONLY_TOOLTIP : undefined}
                      // HECHURA legacy no tiene quantity en el backend
                      // (qty=1 implícito). El "original" es 1 — solo se
                      // muestra si el operador override-ó a otro valor.
                      original={1}
                    />
                  }
                  unitValueCell={
                    <CellNumberInput
                      value={unitValValue}
                      onChange={isEditable && costLineId
                        ? (v) => applyCostLinePatch(costLineId, "HECHURA", { unitValueOverride: v ?? 0 })
                        : () => {}}
                      decimals={2}
                      readOnly={!isEditable}
                      tooltip={!isEditable ? READ_ONLY_TOOLTIP : undefined}
                      // Fase 2.3.1 — original tachado = BASE pre-ajuste
                      // (h.unitValue), no h.appliedAmount (post-ajuste).
                      original={(h as any)?.unitValue ?? h?.appliedAmount ?? null}
                    />
                  }
                  mermaCell={<span className="text-muted/40">—</span>}
                  adjustmentCell={
                    <AdjustmentEditor
                      kind={ov?.adjustmentKind ?? null}
                      type={ov?.adjustmentType ?? null}
                      value={ov?.adjustmentValue ?? null}
                      currency={currency}
                      disabled={!isEditable}
                      onChange={(p) => costLineId && applyCostLinePatch(costLineId, "HECHURA", p)}
                      // Fase 2.2 — ajuste original del cost line del artículo
                      // (si la HECHURA en la ficha trae lineAdj configurado).
                      originalKind={(h as any)?.lineAdjKind   ?? null}
                      originalType={(h as any)?.lineAdjType   ?? null}
                      originalValue={(h as any)?.lineAdjValue ?? null}
                      originalAmount={(h as any)?.lineAdjAmount ?? null}
                    />
                  }
                  // Fase 2.3 — V. VENTA = per-unit post-ajuste (`lineCost / qty`).
                  // Para HECHURA típica (qty=1) es equivalente a lineCost; cuando
                  // qty > 1 (override), divide para mostrar valor por unidad.
                  saleValueValue={
                    lineCost != null && qtyValue && qtyValue > 0
                      ? lineCost / Number(qtyValue)
                      : lineCost
                  }
                  saleValueText={
                    lineCost != null && qtyValue && qtyValue > 0
                      ? fmt(lineCost / Number(qtyValue))
                      : fmt(lineCost)
                  }
                  totalValue={totalForRow(lineCost)}
                  totalText={fmt(totalForRow(lineCost))}
                  manual={!!ov}
                  onResetRow={costLineId ? () => resetCostLine(costLineId) : () => {}}
                  canResetRow={!!ov}
                />
              );
            })}

            {/* PRODUCT — una fila por costLineId */}
            {products.map((p: any, idx: number) => {
              const costLineId = p?.costLineId ?? null;
              const isEditable = costLineId != null;
              const ov = costLineId
                ? findCostLineOverride(activeCostLineOverrides, costLineId)
                : undefined;

              const qtyValue = ov?.quantityOverride != null
                ? Number(ov.quantityOverride)
                : (p?.quantity ?? 0);
              const unitValValue = ov?.unitValueOverride != null
                ? Number(ov.unitValueOverride)
                : (p?.unitValue ?? 0);
              const lineCost = p?.totalValue ?? null;

              // Fase 2.4 — secondary prefiere SKU sobre código:
              //   · Si hay `catalogItemSku` (nuevo Fase 2.4) → "SKU: XXX".
              //   · Sino, fallback a "Código: YYY" (legacy).
              //   · Si tampoco hay code, no se muestra nada de identificador.
              // Orden final: identificador · Descuenta stock · unidad.
              const skuOrCode = (() => {
                const sku = (p as any)?.catalogItemSku;
                if (typeof sku === "string" && sku.trim().length > 0) {
                  return { label: "SKU", value: sku };
                }
                const code = p?.catalogItemCode;
                if (typeof code === "string" && code.length > 0 && code !== p?.catalogItemName) {
                  return { label: "Código", value: code };
                }
                return null;
              })();
              const secondary = (
                <span>
                  {skuOrCode && <>{skuOrCode.label}: {skuOrCode.value} · </>}
                  {p?.affectsStock === true && <>Descuenta stock · </>}
                  <span className="text-muted/60">unidad</span>
                </span>
              );

              // F1.5 #A+ — PRODUCT ahora tiene `lineSale` canónico (passthrough
              // del motor). Sin él (snapshot legacy / margen no derivable) → "—".
              const productLineCost = (p as any)?.totalValue ?? (p as any)?.lineCost ?? null;
              const productLineSale = (p as any)?.lineSale;
              const productSaleForRow: number | null =
                productLineSale != null && Number.isFinite(Number(productLineSale))
                  ? Number(productLineSale)
                  : null;
              const commercialCells = buildCommercialCells(
                productLineCost != null && Number.isFinite(Number(productLineCost))
                  ? Number(productLineCost)
                  : null,
                productSaleForRow,
                qtyValue ?? null,
              );
              return (
                <Row
                  key={`product-${costLineId ?? idx}`}
                  componentType="PRODUCT"
                  Icon={Package}
                  primary={p?.catalogItemName ?? p?.catalogItemCode ?? "—"}
                  secondary={secondary}
                  commercialView={commercialView}
                  precioUnitVentaText={commercialCells.precioUnitVentaText}
                  margenPctText={commercialCells.margenPctText}
                  margenTone={commercialCells.margenTone}
                  ventaLineaText={commercialCells.ventaLineaText}
                  participacionText={commercialCells.participacionText}
                  quantityCell={
                    <CellNumberInput
                      value={qtyValue}
                      onChange={isEditable && costLineId
                        ? (v) => applyCostLinePatch(costLineId, "PRODUCT", { quantityOverride: v ?? 0 })
                        : () => {}}
                      decimals={2}
                      readOnly={!isEditable}
                      tooltip={!isEditable ? READ_ONLY_TOOLTIP : undefined}
                      original={p?.quantity ?? null}
                    />
                  }
                  unitValueCell={
                    <CellNumberInput
                      value={unitValValue}
                      onChange={isEditable && costLineId
                        ? (v) => applyCostLinePatch(costLineId, "PRODUCT", { unitValueOverride: v ?? 0 })
                        : () => {}}
                      decimals={2}
                      readOnly={!isEditable}
                      tooltip={!isEditable ? READ_ONLY_TOOLTIP : undefined}
                      original={p?.unitValue ?? null}
                    />
                  }
                  mermaCell={<span className="text-muted/40">—</span>}
                  adjustmentCell={
                    <AdjustmentEditor
                      kind={ov?.adjustmentKind ?? null}
                      type={ov?.adjustmentType ?? null}
                      value={ov?.adjustmentValue ?? null}
                      currency={currency}
                      disabled={!isEditable}
                      onChange={(patch) => costLineId && applyCostLinePatch(costLineId, "PRODUCT", patch)}
                      // Fase 2.2 — ajuste original (lineAdj* del ArticleCostLine).
                      originalKind={p?.lineAdjKind   ?? null}
                      originalType={p?.lineAdjType   ?? null}
                      originalValue={p?.lineAdjValue ?? null}
                      originalAmount={p?.lineAdjAmount ?? null}
                    />
                  }
                  // Fase 2.3 — V. VENTA = per-unit post-ajuste (totalValue/qty).
                  saleValueValue={
                    lineCost != null && qtyValue && qtyValue > 0
                      ? lineCost / Number(qtyValue)
                      : lineCost
                  }
                  saleValueText={
                    lineCost != null && qtyValue && qtyValue > 0
                      ? fmt(lineCost / Number(qtyValue))
                      : fmt(lineCost)
                  }
                  totalValue={totalForRow(lineCost)}
                  totalText={fmt(totalForRow(lineCost))}
                  manual={!!ov}
                  onResetRow={costLineId ? () => resetCostLine(costLineId) : () => {}}
                  canResetRow={!!ov}
                />
              );
            })}

            {/* SERVICE — una fila por costLineId */}
            {services.map((s: any, idx: number) => {
              const costLineId = s?.costLineId ?? null;
              const isEditable = costLineId != null;
              const ov = costLineId
                ? findCostLineOverride(activeCostLineOverrides, costLineId)
                : undefined;

              const qtyValue = ov?.quantityOverride != null
                ? Number(ov.quantityOverride)
                : (s?.quantity ?? 0);
              const unitValValue = ov?.unitValueOverride != null
                ? Number(ov.unitValueOverride)
                : (s?.unitValue ?? 0);
              const lineCost = s?.totalValue ?? null;

              // Fase 2.4 — SKU prioritario, código solo fallback.
              const skuOrCode = (() => {
                const sku = (s as any)?.catalogItemSku;
                if (typeof sku === "string" && sku.trim().length > 0) {
                  return { label: "SKU", value: sku };
                }
                const code = s?.catalogItemCode;
                if (typeof code === "string" && code.length > 0 && code !== s?.catalogItemName) {
                  return { label: "Código", value: code };
                }
                return null;
              })();
              const secondary = (
                <span>
                  {skuOrCode && <>{skuOrCode.label}: {skuOrCode.value} · </>}
                  <span className="text-muted/60">unidad</span>
                </span>
              );

              // F1.5 #A+ — SERVICE ahora tiene `lineSale` canónico (passthrough
              // del motor). Sin él → "—".
              const serviceLineCost = (s as any)?.totalValue ?? (s as any)?.lineCost ?? null;
              const serviceLineSale = (s as any)?.lineSale;
              const serviceSaleForRow: number | null =
                serviceLineSale != null && Number.isFinite(Number(serviceLineSale))
                  ? Number(serviceLineSale)
                  : null;
              const commercialCells = buildCommercialCells(
                serviceLineCost != null && Number.isFinite(Number(serviceLineCost))
                  ? Number(serviceLineCost)
                  : null,
                serviceSaleForRow,
                qtyValue ?? null,
              );
              return (
                <Row
                  key={`service-${costLineId ?? idx}`}
                  componentType="SERVICE"
                  Icon={Wrench}
                  primary={s?.catalogItemName ?? s?.catalogItemCode ?? "—"}
                  secondary={secondary}
                  commercialView={commercialView}
                  precioUnitVentaText={commercialCells.precioUnitVentaText}
                  margenPctText={commercialCells.margenPctText}
                  margenTone={commercialCells.margenTone}
                  ventaLineaText={commercialCells.ventaLineaText}
                  participacionText={commercialCells.participacionText}
                  quantityCell={
                    <CellNumberInput
                      value={qtyValue}
                      onChange={isEditable && costLineId
                        ? (v) => applyCostLinePatch(costLineId, "SERVICE", { quantityOverride: v ?? 0 })
                        : () => {}}
                      decimals={2}
                      readOnly={!isEditable}
                      tooltip={!isEditable ? READ_ONLY_TOOLTIP : undefined}
                      original={s?.quantity ?? null}
                    />
                  }
                  unitValueCell={
                    <CellNumberInput
                      value={unitValValue}
                      onChange={isEditable && costLineId
                        ? (v) => applyCostLinePatch(costLineId, "SERVICE", { unitValueOverride: v ?? 0 })
                        : () => {}}
                      decimals={2}
                      readOnly={!isEditable}
                      tooltip={!isEditable ? READ_ONLY_TOOLTIP : undefined}
                      original={s?.unitValue ?? null}
                    />
                  }
                  mermaCell={<span className="text-muted/40">—</span>}
                  adjustmentCell={
                    <AdjustmentEditor
                      kind={ov?.adjustmentKind ?? null}
                      type={ov?.adjustmentType ?? null}
                      value={ov?.adjustmentValue ?? null}
                      currency={currency}
                      disabled={!isEditable}
                      onChange={(patch) => costLineId && applyCostLinePatch(costLineId, "SERVICE", patch)}
                      // Fase 2.2 — ajuste original (lineAdj* del ArticleCostLine).
                      originalKind={s?.lineAdjKind   ?? null}
                      originalType={s?.lineAdjType   ?? null}
                      originalValue={s?.lineAdjValue ?? null}
                      originalAmount={s?.lineAdjAmount ?? null}
                    />
                  }
                  // Fase 2.3 — V. VENTA = per-unit post-ajuste (totalValue/qty).
                  saleValueValue={
                    lineCost != null && qtyValue && qtyValue > 0
                      ? lineCost / Number(qtyValue)
                      : lineCost
                  }
                  saleValueText={
                    lineCost != null && qtyValue && qtyValue > 0
                      ? fmt(lineCost / Number(qtyValue))
                      : fmt(lineCost)
                  }
                  totalValue={totalForRow(lineCost)}
                  totalText={fmt(totalForRow(lineCost))}
                  manual={!!ov}
                  onResetRow={costLineId ? () => resetCostLine(costLineId) : () => {}}
                  canResetRow={!!ov}
                />
              );
            })}
          </div>
          </div>
        </div>
      )}

      {/* ── Fase 6 — Flujo visual de construcción del precio (4 cards) ──
          Reemplaza SaleImpactBlock + CostAdjustmentBlock + RentabilidadBlock
          con un layout de cards horizontales (Costo base · Ajustes globales ·
          Impacto en venta · Rentabilidad). Cero matemática nueva — todos los
          números siguen viniendo del backend vía `pricingMeta`. */}
      <PriceFlowCards
        metalCost={meta.metalCost ?? null}
        metalSale={meta.metalSale ?? null}
        metalMarginPct={meta.metalMarginPct ?? null}
        hechuraCost={meta.hechuraCost ?? null}
        hechuraSale={meta.hechuraSale ?? null}
        hechuraMarginPct={meta.hechuraMarginPct ?? null}
        costAdjustment={(composition as any)?.costAdjustment ?? null}
        unitCost={meta.unitCost ?? null}
        unitMargin={meta.unitMargin ?? null}
        marginPercent={meta.marginPercent ?? null}
        saleUnitPrice={
          Number.isFinite((meta as any)?.basePrice) ? (meta as any).basePrice
          : Number.isFinite(line.unitPrice)         ? line.unitPrice
          : null
        }
        quantity={Number.isFinite(line.quantity) ? line.quantity : 1}
        currency={currency}
      />

      {/* ── Bloque de ajustes globales (canal/cupón/envío) — fuera del flujo
            principal porque son ajustes doc-level, no de costo del artículo ── */}
      {globalAdjustments && (
        <GlobalAdjustmentsBlock data={globalAdjustments} currency={currency} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RentabilidadBlock — costo / ganancia / margen con jerarquía visual.
//
// Fase 2.1 — extraído del cuerpo principal para:
//   · Aplicar `useFlashOnChange` al margen y la ganancia (highlight sutil
//     cuando el preview backend devuelve un nuevo valor).
//   · Tipografía más jerarquizada: label muy chico arriba, valor grande
//     debajo. Mantiene paddings TPTech.
//   · Tone semántico del margen: emerald (≥40) / text (≥15) / amber (>0) /
//     red (≤0). Mantiene la regla del panel legacy.
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Fase 6 — reemplazado por `<PriceFlowCards>` (card "Resumen de
 *  rentabilidad"). Mantenido por compatibilidad. */
function RentabilidadBlock({
  unitCost, unitMargin, marginPercent, saleUnitPrice, quantity, currency,
}: {
  unitCost:      number | null;
  unitMargin:    number | null;
  marginPercent: number | null;
  /**
   * Fase 2.6.1 — PRECIO UNITARIO DE LISTA pre-descuento (= `pricingMeta.basePrice`).
   * El bloque multiplica × quantity para totalizar (mismo patrón que
   * cost/gain). Cero recálculo nuevo. Cuando `basePrice` no está disponible,
   * el caller cae a `line.unitPrice` (post-descuento) como fallback —
   * ambos coinciden cuando no hay descuentos.
   */
  saleUnitPrice: number | null;
  quantity:      number;
  currency:      string;
}) {
  const totalSale = saleUnitPrice != null ? saleUnitPrice * quantity : null;
  if (unitCost == null && unitMargin == null && marginPercent == null && totalSale == null) {
    return null;
  }

  const totalCost   = unitCost   != null ? unitCost   * quantity : null;
  const totalMargin = unitMargin != null ? unitMargin * quantity : null;
  const flashMargin = useFlashOnChange(marginPercent ?? null);
  const flashGain   = useFlashOnChange(totalMargin   ?? null);
  const flashSale   = useFlashOnChange(totalSale     ?? null);

  const marginToneClass =
    marginPercent == null
      ? "text-muted/60"
      : marginPercent >= 40
        ? "text-emerald-600 dark:text-emerald-400"
        : marginPercent >= 15
          ? "text-text"
          : marginPercent > 0
            ? "text-amber-600 dark:text-amber-400"
            : "text-red-500";
  const gainToneClass =
    totalMargin == null
      ? "text-muted/60"
      : totalMargin < 0
        ? "text-red-500"
        : "text-text";

  return (
    <div className="grid grid-cols-4 gap-3 border-t border-border/30 pt-2">
      {/* Fase 2.6.3 — orden: COSTO · MARGEN · GANANCIA · VALOR DE VENTA NETO. */}
      <Stat
        label="Costo"
        value={totalCost != null ? fmtMoney(totalCost, currency) : "—"}
        valueClass="text-text/85"
      />
      <Stat
        label="Margen"
        value={marginPercent != null ? `${marginPercent.toFixed(1)}%` : "—"}
        valueClass={cn(marginToneClass, "font-semibold")}
        flashClass={flashMargin}
      />
      <Stat
        label="Ganancia"
        value={totalMargin != null ? fmtMoney(totalMargin, currency) : "—"}
        valueClass={gainToneClass}
        flashClass={flashGain}
      />
      {/* Fase 2.6.1 — KPI destacado, total = saleUnitPrice × quantity.
          Pre-descuentos (basePrice), pre-impuestos. Fase 2.6.3 — label
          clarificado a "Valor de venta neto" (NO incluye IVA). */}
      <Stat
        label="Valor de venta neto"
        value={totalSale != null ? fmtMoney(totalSale, currency) : "—"}
        valueClass={cn(
          "font-semibold !text-[14px]",
          totalSale == null
            ? "text-muted/60"
            : "text-emerald-700 dark:text-emerald-300",
        )}
        flashClass={flashSale}
      />
    </div>
  );
}

function Stat({
  label, value, valueClass, flashClass,
}: {
  label:       string;
  value:       string;
  valueClass?: string;
  flashClass?: string;
}) {
  return (
    <div className={cn(
      "flex flex-col rounded px-1 transition-colors duration-500",
      flashClass,
    )}>
      <span className="text-[9px] font-semibold uppercase tracking-[0.04em] text-muted/65">
        {label}
      </span>
      <span className={cn("text-[13px] tabular-nums leading-tight", valueClass)}>
        {value}
      </span>
    </div>
  );
}

export default SaleCompositionEditableGrid;
