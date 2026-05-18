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
import { formatMoneyDoc as fmtMoney, formatDecimal, formatByType, formatGrams } from "../../lib/pricing/format";
import type { DocumentLine } from "../../lib/document-types";
import {
  patchCostLineOverride,
  findCostLineOverride,
} from "../../lib/pricing/cost-line-overrides";
import type { CostLineOverride } from "../../services/sales";
// Fase 6 — flujo visual de construcción del precio (4 cards). Reemplaza
// SaleImpactBlock + CostAdjustmentBlock + RentabilidadBlock con la misma data
// pero presentación rediseñada (azul/ámbar/verde/neutro).
import {
  COMPONENT_TYPE_BADGE,
  COMPONENT_TYPE_TEXT,
  type ComponentTypeKey,
} from "../../lib/pricing/component-type-colors";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────────

export type AppliesTo = "TOTAL" | "METAL" | "HECHURA" | "METAL_Y_HECHURA" | "SUBTOTAL_AFTER_DISCOUNT" | "SUBTOTAL_BEFORE_DISCOUNT" | "PRODUCT" | "SERVICE";

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
  /** Mapping `currencyId → { code, symbol }` del catálogo de monedas del
   *  tenant. Cuando un cost line tiene `currencyId` distinto al code del
   *  documento, la celda "Costo unit." muestra el code original sobre el
   *  número y agrega una sub-línea con el equivalente en moneda del
   *  comprobante (`totalValue / quantity`, derivación trivial sobre datos
   *  del motor). Si no se provee, el comportamiento es idéntico al anterior. */
  currencyById?: CurrencyByIdMap;
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

  // FIX — `lastSent` se inicializa al valor commiteado INICIAL (no a un
  // sentinel "INIT"). Así el commit de montaje es no-op (same) sin tragarse
  // la PRIMERA edición real del usuario: con el sentinel, si el usuario
  // tocaba la flecha antes del primer timer, ese primer cambio se perdía
  // (había que tocar dos veces). Con el valor inicial real, montar no
  // commitea pero el primer cambio sí.
  const commitRef = useRef<{ timer: number | null; lastSent: number | null }>({
    timer: null,
    lastSent: nearlyEqual(initialValue ?? originalValue, originalValue)
      ? null
      : (initialValue ?? originalValue),
  });
  useEffect(() => {
    const c = commitRef.current;
    if (c.timer) window.clearTimeout(c.timer);
    c.timer = window.setTimeout(() => {
      const next = nearlyEqual(value, originalValue) ? null : value;
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
// Helpers display-only para esta grilla (extraídos a `src/lib/pricing/display/`
// para reuso futuro desde Simulador / Comparador). Re-export local para que
// los tests existentes los importen vía este archivo (compat).
// ─────────────────────────────────────────────────────────────────────────────
import {
  resolveItemCurrencyDisplay,
  resolveSaleForRowDisplay,
  resolveMarginForRowDisplay,
  buildMetalParentSaleTotals,
  computeMetalSaleFactor,
  type CurrencyByIdMap,
} from "../../lib/pricing/display/saleCompositionDisplay";

export {
  resolveItemCurrencyDisplay,
  resolveSaleForRowDisplay,
  resolveMarginForRowDisplay,
};
export type { CurrencyByIdMap };

// ─────────────────────────────────────────────────────────────────────────────
// Layout — tabla compacta. Columnas: badge (24) · componente (1.6fr) ·
// cantidad (90) · unidad (60) · val.unit (95) · merma (75) · ajuste (130) ·
// val.venta (95) · total (105) · acciones (30).
// ─────────────────────────────────────────────────────────────────────────────

// FASE 12.4 — vista única (sin switch). Antes había dos layouts:
// `TABLE_COLS_CLS` (vista costo) y `TABLE_COLS_CLS_COMMERCIAL` (con Margen
// como columna extra). Ahora la tabla es UNA sola: Margen vive como
// sub-línea debajo de "Costo Total" en cada fila, y Merma/Ajuste vive como
// sub-línea debajo de "Costo unit." (FASE 12.3).
//
// Layout final: badge · componente · cantidad · costo unit (con
// merma/ajuste debajo) · costo total (con margen debajo) · costo de venta
// · acciones — 7 cells en total.
// FASE 12.11 — anchos rebalanceados:
//   · COMPONENTE: 1.6fr → 1.4fr (reducimos un poco; el secondary es corto).
//   · CANTIDAD:    0.7fr → 0.6fr (más compacta — input + sub-línea unidad).
//   · COSTO UNIT.: 1.1fr → 1.4fr (más espacio: contiene moneda + input +
//     merma/ajuste editor).
//   · COSTO TOTAL: 0.95fr → 1.05fr (margen + ajuste global pueden crecer).
//   · COSTO DE VENTA: sin cambios (0.85fr).
// FASE F23 — Columnas con anchos configurables + columna "Margen" nueva.
// FASE F24 — "Margen" se reubica ENTRE "Costo Total" y "Costo de Venta"
// (antes estaba entre Merma/Ajuste y Costo Total).
// Total de columnas: 10 (icon + 8 datos + acciones).
// Layout:
//   1 → icon          (24px, fijo, sin resize)
//   2 → Componente    (320 / min 220)
//   3 → Cantidad      (110 / min 90)
//   4 → Unidad        (120 / min 90)
//   5 → Costo unit.   (160 / min 130)
//   6 → Merma/Ajuste  (150 / min 130)
//   7 → Costo Total   (170 / min 140)
//   8 → Margen        (150 / min 120)
//   9 → Costo Venta   (170 / min 140)
//  10 → acciones      (28px, fijo, sin resize)
//
// La grilla ya no usa `grid-cols-[...]` Tailwind fijo. Cada fila consume el
// `gridTemplateColumns` calculado via Context (`TableLayoutContext`), que
// vive en `SaleCompositionEditableGrid` y se persiste en localStorage
// (key: `tptech.sales.costComposition.columnWidths.v1`).
const TABLE_COLS_CLS =
  "grid items-start gap-x-1.5";

/** Configuración de las columnas redimensionables (FASE F23).
 *  Cada entry describe una columna del medio (no icon ni acciones, que
 *  son fijos). El orden DEBE coincidir con el orden visual de la tabla. */
const RESIZABLE_COLS = [
  { key: "componente",  label: "Componente",     def: 320, min: 220 },
  { key: "cantidad",    label: "Cantidad",       def: 110, min:  90 },
  { key: "unidad",      label: "Unidad",         def: 120, min:  90 },
  { key: "costoUnit",   label: "Costo unit.",    def: 160, min: 130 },
  { key: "mermaAjuste", label: "Merma / Ajuste", def: 150, min: 130 },
  // FASE F24 — Costo Total antes que Margen, y Margen antes que Costo Venta.
  { key: "costoTotal",  label: "Costo Total",    def: 170, min: 140 },
  { key: "margen",      label: "Margen",         def: 150, min: 120 },
  { key: "costoVenta",  label: "Venta", def: 170, min: 140 },
] as const;

const COL_WIDTHS_DEFAULTS = RESIZABLE_COLS.map((c) => c.def);
const COL_WIDTHS_MINS     = RESIZABLE_COLS.map((c) => c.min);
// FASE F24 — bump a `v2` por reordenar columnas (Margen ↔ Costo Total).
// Persistencias `v1` quedan ignoradas → recae a defaults.
const COL_WIDTHS_STORAGE  = "tptech.sales.costComposition.columnWidths.v2";

/** Lee anchos persistidos en localStorage; cae a defaults si falta o está
 *  corrupto. Acepta sólo arrays de N números (mismo length que defaults). */
function loadPersistedColWidths(): number[] {
  if (typeof window === "undefined" || !window.localStorage) return [...COL_WIDTHS_DEFAULTS];
  try {
    const raw = window.localStorage.getItem(COL_WIDTHS_STORAGE);
    if (!raw) return [...COL_WIDTHS_DEFAULTS];
    const arr = JSON.parse(raw);
    if (
      Array.isArray(arr)
      && arr.length === COL_WIDTHS_DEFAULTS.length
      && arr.every((n) => typeof n === "number" && Number.isFinite(n) && n > 0)
    ) {
      // Clamp a min para evitar widths corruptos persistidos.
      return arr.map((n, i) => Math.max(n, COL_WIDTHS_MINS[i]));
    }
  } catch {
    // Ignored.
  }
  return [...COL_WIDTHS_DEFAULTS];
}

/** Compone el `grid-template-columns` para una fila. Mantiene los extremos
 *  fijos (24px icon + 28px acciones) y rellena el medio con los widths
 *  configurables, todos como `<N>px`. */
function buildGridTemplateColumns(widths: number[]): string {
  const middle = widths.map((w) => `${w}px`).join(" ");
  return `24px ${middle} 28px`;
}

/** Context con el `gridTemplateColumns` ya calculado para que header, filas
 *  y footers compartan el mismo layout sin que el caller tenga que pasar
 *  la prop a cada Row (rompería los memos). */
const TableLayoutContext = React.createContext<string>(
  buildGridTemplateColumns(COL_WIDTHS_DEFAULTS),
);

// FASE F2 — passthrough del backend para el origen de la merma:
// Manual / Cliente / Catálogo / —. Se mantiene el tipo en el contrato
// del MermaLabelEditor para no romper callers; el badge visual fue
// removido en FASE F10.
type MermaSource = "costLineOverride" | "entity" | "line" | "default" | null;

// FASE F9 — Merma como input siempre visible (sin pill, sin ✎, sin
// snapshot/cancel). Se renderea similar al campo de Cantidad: input
// compacto con sufijo "%" fijo a la derecha.
// FASE F10 — el origen entre paréntesis (Catálogo/Cliente/Manual/—) se
// eliminó del render. La prop `mermaSource` se mantiene en el contrato
// del componente para no romper callers, pero ya no se muestra.
function MermaLabelEditor({
  value, original, onChange, readOnly, mermaSource,
}: {
  value:    number | null;
  original: number | null;
  onChange: (v: number | null) => void;
  readOnly?: boolean;
  mermaSource?: MermaSource;
}) {
  // FASE F10 — mermaSource ya no se renderea; aceptado para compat de callers.
  void mermaSource;
  // FIX oscilación flechitas — commit DEBOUNCED vía `useOverrideNumber`
  // (igual que Cantidad/Costo unit.), en vez de llamar `onChange` síncrono
  // por cada tick de la flecha. El commit por tick re-renderizaba
  // `TPNumberInput` con el `value` prop aún viejo (parent async) y su
  // effect lo trataba como "cambio externo" revirtiendo el valor:
  // 10 → 10,5 → 10 → 10,5. Con el hook, el valor local es estable y se
  // commitea una sola vez al pausar. `originalValue=null` → siempre emite
  // el valor literal (misma semántica que el onChange directo; el grid
  // hace `v ?? 0`). El sync interno del hook re-hidrata si el parent
  // cambia el valor de verdad (preview/reset).
  const { value: mermaLocal, setValue: setMermaLocal } = useOverrideNumber(
    value, null, (v) => onChange(v),
  );
  // FASE F13 — el label "Merma" se elimina del editor; el sufijo "%" alcanza
  // como pista contextual. El número queda como protagonista visual. El
  // input se ensancha (w-[120px]) para que cabe "-100,00" con 2–3 decimales
  // sin truncado, considerando los ~36px que `pr-9` del compact reserva
  // para los arrows.
  return (
    <div
      data-merma-inline-editor
      className="inline-flex items-center"
    >
      <PrefixedField suffix="%" interactive={!readOnly}>
        <CellNumberInput
          value={mermaLocal}
          onChange={setMermaLocal}
          formatType="MERMA_PERCENT"
          decimals={2}
          // Step 1,00 (antes 0,5): saltos enteros estables, sin oscilar.
          step={1}
          widthClass="w-[176px] max-w-none"
          original={original}
          readOnly={readOnly}
          tooltip={readOnly ? READ_ONLY_TOOLTIP : undefined}
          noInputBg
        />
      </PrefixedField>
    </div>
  );
}

// FASE 12.9 — Header de grupo por tipo de componente. Pure display:
// muestra el nombre del grupo, conteo de líneas y subtotal (sum trivial
// de `lineCost` ya emitidos — NO matemática comercial nueva).
// FASE 12.11 — totales del grupo INLINE junto al nombre (no a la derecha).
// FASE F18 — removidas las líneas divisorias horizontales superiores.
// La separación entre grupos ahora descansa en spacing + background
// suave por tipo. Look moderno, sin ruido tipo "tabla vieja".
// FASE 12.13 — background muy suave por tipo (≈5% del color semántico) y
// label coloreado: refuerza la identificación visual del grupo sin saturar
// el contraste de las filas editables. Color tomado de la fuente única
// `COMPONENT_TYPE_TEXT` / `COMPONENT_TYPE_BADGE` (no se hardcodean tonos).
const GROUP_HEADER_BG: Record<ComponentTypeKey, string> = {
  METAL:   "bg-amber-500/[0.06]",
  HECHURA: "bg-blue-500/[0.06]",
  PRODUCT: "bg-violet-500/[0.06]",
  SERVICE: "bg-green-500/[0.06]",
};
// FASE F10 — el adjetivo "puro/pura" del header de METALES fue eliminado.
// El header ahora muestra solo el nombre del metal padre seguido de los
// gramos (ej. "Oro: 3,76 gr · Plata: 5,00 gr"). La agrupación por metal
// padre se mantiene tal cual (FASE F5).

function TypeGroupHeader({
  label, count, subtotal, currency, type, equivGramsByMetal,
}: {
  label:    string;
  count:    number;
  subtotal: number | null;
  currency: string;
  /** Tipo de componente — define el color semántico del label y del bg. */
  type:     ComponentTypeKey;
  /** Gramos equivalentes de VENTA por metal padre (costo equiv × factor de
   *  venta del motor), IDÉNTICO a las cards del Simulador "Composición del
   *  precio" (ORO (Au) 8,01 gr). Ej:
   *  `[{ name: "Oro", grams: 8.01 }, { name: "Plata", grams: 3.11 }]`.
   *  Solo se muestra en el grupo METAL. Vacío/undefined → no se renderea. */
  equivGramsByMetal?: Array<{ name: string; grams: number }>;
}) {
  // FASE F15 — subtotal y currency aceptados para compat de callers, pero
  // ya no se renderean en el header.
  void subtotal; void currency;
  return (
    <div
      data-group-type={type}
      className={cn(
        // FASE F18 — removido `border-t border-border/40` que dibujaba una
        // línea divisoria fuerte arriba de cada grupo. La separación visual
        // ahora descansa en `mt-3` (16px) + `GROUP_HEADER_BG` (tono suave
        // por tipo). Look más liviano, sin ruido tipo "tabla vieja".
        "mt-3 mb-1.5 flex items-baseline gap-2 rounded-t px-2 py-1.5 first:mt-0",
        GROUP_HEADER_BG[type],
      )}
    >
      <span className={cn("text-[11px] font-semibold uppercase tracking-wide", COMPONENT_TYPE_TEXT[type])}>
        {label}
      </span>
      <span className="text-[10px] text-muted/55">
        · {count} {count === 1 ? "línea" : "líneas"}
      </span>
      {/* FASE F15 — el importe monetario se removió del header de grupo.
          El total queda únicamente en la fila inferior `Total <grupo>`
          (TypeGroupFooter). El header conserva: nombre, count y, en
          METAL, los gramos agrupados por metal padre. Las props
          `subtotal` y `currency` siguen aceptándose en el contrato para
          no romper callers, pero ya no se renderean. */}
      {type === "METAL" && Array.isArray(equivGramsByMetal) && equivGramsByMetal.length > 0 && (
        <>
          {equivGramsByMetal.map((g, i) => (
            <span
              key={`${g.name}-${i}`}
              className="text-[11px] text-slate-500 dark:text-slate-400"
              title="Gramos equivalentes de VENTA por metal padre (costo equiv × factor de venta) — idéntico a las cards del Simulador (Composición del precio)"
            >
              · {g.name}:{" "}
              <span className="tabular-nums">
                {formatGrams(g.grams, 2)} gr
              </span>
            </span>
          ))}
        </>
      )}
    </div>
  );
}

// Subtotal de COSTO del grupo, expandido por `qtyLine` del documento para
// quedar en la misma escala que la columna "Costo Total" de cada fila
// detalle (`lineCost × line.quantity`). Sin `qtyLine` (default 1) mantiene
// el comportamiento legacy.
function sumGroupLineCost(items: any[], qtyLine: number = 1): number | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  const q = Number.isFinite(qtyLine) && qtyLine > 1 ? qtyLine : 1;
  let total = 0;
  let any = false;
  for (const it of items) {
    const raw = it?.lineCost ?? it?.totalValue ?? null;
    const v = raw != null ? Number(raw) : NaN;
    if (Number.isFinite(v)) {
      total += v * q;
      any = true;
    }
  }
  return any ? total : null;
}

/**
 * Suma de la columna "Cantidad" para la fila "Total <grupo>".
 *
 * Display only — NO afecta cálculos financieros (costo/venta/margen). Solo
 * suma las `quantities` de las líneas del grupo, usando el MISMO origen por
 * tipo que la celda Cantidad de cada fila (paridad visual con lo mostrado):
 *   · METAL  → `appliedGrams` (se omite si es null, igual que la fila)
 *   · HECHURA/PRODUCT/SERVICE → `quantity` (fallback por tipo, ver callers)
 *
 * Igual que `sumGroupLineCost`, NO aplica overrides (refleja la base del
 * snapshot). Devuelve `null` si ninguna línea aporta cantidad finita.
 */
function sumGroupQuantity(
  items: any[],
  qtyOf: (it: any) => number | null,
): number | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  let total = 0;
  let any = false;
  for (const it of items) {
    const v = qtyOf(it);
    if (v != null && Number.isFinite(v)) {
      total += v;
      any = true;
    }
  }
  return any ? total : null;
}

// Subtotal de VENTA del grupo, aplicando los mismos overrides que la columna
// "Venta" de cada fila detalle:
//   1. `resolveSaleForRowDisplay(lineCost, lineSale, unifiedFactor, marginUnattributable)`
//      → en MARGIN_TOTAL / modos derivados, reemplaza el `lineSale` colapsado
//      por `lineCost × unifiedFactor` (display unificado).
//   2. Multiplica por `qtyLine` del documento para alinear con `totalForRow`.
//
// Snapshots viejos sin `lineSale` ni breakdown caen al `canonical` (sale
// agregado del grupo emitido por el motor para metal/hechura).
// Cero matemática nueva — usa el mismo helper display que las filas detalle.
function sumGroupLineSaleDisplay(
  items: any[],
  ctx: {
    qtyLine:              number;
    marginUnattributable: boolean;
    unifiedFactor:        number | null;
    canonical?:           number | null;
  },
): number | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  const q = Number.isFinite(ctx.qtyLine) && ctx.qtyLine > 1 ? ctx.qtyLine : 1;
  let total = 0;
  let anySale = false;
  for (const it of items) {
    const lineCostRaw = it?.lineCost ?? it?.totalValue ?? null;
    const lineCost = lineCostRaw != null && Number.isFinite(Number(lineCostRaw))
      ? Number(lineCostRaw)
      : null;
    const lineSaleRaw = (it as any)?.lineSale ?? null;
    const canonicalSale = lineSaleRaw != null && Number.isFinite(Number(lineSaleRaw))
      ? Number(lineSaleRaw)
      : null;
    if (canonicalSale == null) continue;
    const { saleForRow } = resolveSaleForRowDisplay(
      lineCost,
      canonicalSale,
      ctx.unifiedFactor,
      ctx.marginUnattributable,
    );
    if (saleForRow != null && Number.isFinite(saleForRow)) {
      total += saleForRow * q;
      anySale = true;
    }
  }
  if (anySale) return total;
  // Fallback snapshot legacy: el motor emitió un sale agregado para el grupo.
  if (ctx.canonical != null && Number.isFinite(ctx.canonical)) {
    return ctx.canonical * q;
  }
  return null;
}

// FASE F7 — Fila de "Total <grupo>" al cierre de cada bloque visible.
// Display only — sin inputs ni iconos editables. Refleja sumas ya
// emitidas por el motor backend; cero matemática comercial nueva.
// Layout: usa TABLE_COLS_CLS para alinear con la grilla; las columnas
// "Costo Total" y "Costo de Venta" muestran los montos en tabular-nums.
function TypeGroupFooter({
  label, costTotal, saleTotal, currency, type, quantityTotal = null,
}: {
  label:     string;
  costTotal: number | null;
  saleTotal: number | null;
  currency:  string;
  type:      ComponentTypeKey;
  /** Suma de la columna "Cantidad" del grupo. Display only — NO altera
   *  ningún cálculo financiero. Se muestra SIEMPRE (incluso 1 línea). */
  quantityTotal?: number | null;
}) {
  const gridTpl = React.useContext(TableLayoutContext);
  const fmt = (v: number) => `${currency} ${formatDecimal(v, 2)}`;
  return (
    <div
      data-group-footer={type}
      className={cn(
        TABLE_COLS_CLS,
        // FASE F19 — sin border-top. F23 — grid layout viene del context.
        "mt-1 mb-2 rounded-b px-1.5 py-1",
        GROUP_HEADER_BG[type],
      )}
      style={{ gridTemplateColumns: gridTpl }}
    >
      {/* Col 1 — icono */}
      <span aria-hidden />
      {/* Col 2 — Componente */}
      <span className={cn("text-[11px] font-semibold", COMPONENT_TYPE_TEXT[type])}>
        Total {label}
      </span>
      {/* Col 3 — Cantidad: total del grupo (siempre, incluso 1 línea).
          Centrado para alinear con la celda Cantidad de cada fila. */}
      <span className="text-center text-[11px] tabular-nums font-semibold text-text/85">
        {quantityTotal != null && Number.isFinite(quantityTotal)
          ? formatByType(quantityTotal, "QUANTITY", { bare: true })
          : "—"}
      </span>
      {/* Col 4 — Unidad (FASE F21) */}
      <span aria-hidden />
      {/* Col 5 — Costo unit. */}
      <span aria-hidden />
      {/* Col 6 — Merma / Ajuste (FASE F22) */}
      <span aria-hidden />
      {/* Col 7 — Costo Total (FASE F24: vuelve antes de Margen) */}
      <span className="text-center text-[11px] tabular-nums font-semibold text-text/85">
        {costTotal != null && Number.isFinite(costTotal) ? fmt(costTotal) : "—"}
      </span>
      {/* Col 8 — Margen (FASE F24) — vacío en totales (sin margen agregado a nivel grupo) */}
      <span className="text-center text-[11px] tabular-nums text-muted/40">—</span>
      {/* Col 9 — Costo de Venta */}
      <span className="text-center text-[11px] tabular-nums font-semibold text-text/85">
        {saleTotal != null && Number.isFinite(saleTotal) ? fmt(saleTotal) : "—"}
      </span>
      {/* Col 10 — acciones */}
      <span aria-hidden />
    </div>
  );
}

/** F23 — Handle de resize entre columnas. mousedown registra listeners en
 *  window; mousemove actualiza el ancho (clamped a min); mouseup persiste
 *  en localStorage. Doble click resetea al default. Visible solo en hover
 *  del header para no saturar. */
function ColumnResizeHandle({
  index, widths, onChange,
}: {
  index: number;
  widths: number[];
  onChange: (next: number[]) => void;
}) {
  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = widths[index];
    const minW   = COL_WIDTHS_MINS[index];
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(minW, startW + (ev.clientX - startX));
      const arr  = widths.slice();
      arr[index] = Math.round(next);
      onChange(arr);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [index, widths, onChange]);

  const handleDoubleClick = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const arr = widths.slice();
    arr[index] = COL_WIDTHS_DEFAULTS[index];
    onChange(arr);
  }, [index, widths, onChange]);

  return (
    <span
      data-column-resize-handle={RESIZABLE_COLS[index].key}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      role="separator"
      aria-label={`Redimensionar columna ${RESIZABLE_COLS[index].label}`}
      title="Arrastrá para redimensionar · doble click para resetear"
      className={cn(
        // Hit area de 6px a la derecha del header (translado 50% del width).
        "absolute top-0 right-0 h-full w-1.5 cursor-col-resize",
        // Línea fina visible solo en hover/active (sutileza Linear/Excel).
        "after:absolute after:right-0 after:top-1 after:bottom-1 after:w-px",
        "after:bg-transparent hover:after:bg-primary/40 active:after:bg-primary/70",
        "after:transition-colors after:duration-150",
        "select-none",
      )}
    />
  );
}

function TableHeader({
  widths, onWidthsChange,
}: {
  widths: number[];
  onWidthsChange: (next: number[]) => void;
}) {
  const gridStyle = React.useMemo(
    () => ({ gridTemplateColumns: buildGridTemplateColumns(widths) }),
    [widths],
  );
  return (
    <div
      className={cn(
        TABLE_COLS_CLS,
        // Fase 2.1 — header más compacto (px-1.5 / py-0.5).
        // Fase 4.4 — sticky top para que el header se mantenga visible
        // durante scroll vertical en composiciones largas. `bg-card`
        // evita que las filas debajo se vean a través del header
        // semi-transparente. `z-10` lo mantiene sobre las filas pero por
        // debajo del modal.
        "sticky top-0 z-10 bg-card",
        "px-1.5 py-1 border-b border-slate-200/40 dark:border-slate-700/30 text-[10px] font-medium normal-case text-muted/60",
      )}
      style={gridStyle}
    >
      <span aria-hidden />
      {/* FASE F23 — todos los títulos centrados, incluyendo Componente.
          Cada header tiene un ColumnResizeHandle en el borde derecho. */}
      {RESIZABLE_COLS.map((col, i) => (
        <span
          key={col.key}
          data-column-header={col.key}
          className="relative text-center px-1"
          title={
            col.key === "costoUnit"   ? "Costo base del componente"
          : col.key === "mermaAjuste" ? "Merma (METAL) o Bonif./Recargo (HECHURA/PRODUCT/SERVICE) editable"
          : col.key === "margen"      ? "Margen efectivo por línea (Venta − Costo Total). En listas con valor unificado, el margen se aplica al total y no se distribuye por línea (se muestra «—»)."
          : col.key === "costoTotal"  ? "Costo final del componente"
          : undefined
          }
        >
          {col.label}
          <ColumnResizeHandle
            index={i}
            widths={widths}
            onChange={onWidthsChange}
          />
        </span>
      ))}
      {/* FASE 12.2 — "P. unit venta", "Venta línea" y "Particip." quedan
          ocultos visualmente. Los datos siguen computándose en el caller
          (precioUnitVentaText / ventaLineaText / participacionText) por si
          se reactivan más adelante. */}
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
  noInputBg = false, formatType,
}: {
  value:    number | null;
  onChange: (v: number | null) => void;
  decimals?: number;
  /** Tipo del motor central — el input respeta región/decimales del tenant. */
  formatType?: import("../../lib/number-format").NumberFormatType;
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
  /** FASE 12.20 — el input vive dentro de un `PrefixedField` que aplica
   *  hover/focus-within a TODO el campo compuesto. Para evitar
   *  double-feedback, este flag suprime las clases hover/focus del
   *  input interno (sólo se mantiene la transición y el tinte amber del
   *  manual override). */
  noInputBg?: boolean;
}) {
  const isInteractive = !readOnly && !disabled;
  const hasManualOverride =
    original != null && value != null && !nearlyEqual(original, value);
  // FASE 12.23 — el tachado del "valor original" debajo del input se
  // eliminó: aparecía como flash al editar y ensuciaba la tabla. El
  // manual override sigue marcándose con el `text-amber` del input
  // (`hasManualOverride`) y con el punto/etiqueta "Manual" en el primary
  // del componente. Las props `original` / `decimalsOriginal` /
  // `formatOriginal` se mantienen en el contrato del componente para no
  // romper callers, pero ya no se renderean.
  void original; void decimalsOriginal; void formatOriginal;
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
        formatType={formatType}
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
          // ── FASE 12.17 — texto editable + feedback con color del theme ──
          // Anulamos el `tp-input` global (rounded-xl + border + shadow) y
          // dejamos texto plano. Feedback visual SOLO en hover/focus,
          // usando el `primary` del theme (var --primary-rgb) en lugar de
          // un azul Google hardcoded. El `!` es necesario porque
          // `tp-input` tiene specificity propia desde index.css.
          "!bg-transparent !rounded-sm !shadow-none !border-0",
          isInteractive && !noInputBg && "hover:!bg-primary/[0.05] dark:hover:!bg-primary/[0.08]",
          isInteractive && !noInputBg && "focus:!bg-primary/[0.06] dark:focus:!bg-primary/[0.10]",
          // Línea inferior 1px en color del theme, dibujada vía inset-shadow
          // para no alterar la altura del input. Cuando el input está dentro
          // de un `PrefixedField`, el wrap externo aplica este feedback al
          // campo completo — el input no lo duplica.
          isInteractive && !noInputBg && "focus:!shadow-[inset_0_-1px_0_0_rgb(var(--primary-rgb)_/_0.7)]",
          "!transition-[background-color,box-shadow] !duration-150",
          // Manual override: texto un poco más bold + tinte amber, marca
          // sutil sin agregar caja ni outline.
          hasManualOverride && "!font-semibold !text-amber-700 dark:!text-amber-400",
        )}
        wrapClassName="!w-auto"
      />
    </div>
  );
}

const READ_ONLY_TOOLTIP = "Editar desde la ficha del artículo";

// ─────────────────────────────────────────────────────────────────────────────
// FASE 12.20 — PrefixedField: wrap inline-flex que se ve como un solo campo
// compuesto. El prefix queda dentro del rectángulo visual del input (a la
// izquierda del valor). Hover y focus pintan el campo COMPLETO con el
// color del theme — el input interno corre con `noInputBg` para no
// duplicar el feedback.
// FASE F11 — extendido con `suffix` opcional (signo "%" / "$" / etc.
// integrado a la derecha del valor) y posibilidad de prefix/suffix
// interactivos (no aria-hidden) para los toggles de signo del editor
// de Bonificación/Recargo. Cuando `prefix` o `suffix` son ReactNode
// interactivos, el caller los pasa como tal y el wrap NO los marca como
// pointer-events-none.
// ─────────────────────────────────────────────────────────────────────────────
function PrefixedField({
  prefix, suffix, children, interactive = true, className,
  prefixStatic = true, suffixStatic = true,
}: {
  prefix?:      React.ReactNode;
  suffix?:      React.ReactNode;
  children:     React.ReactNode;
  /** False → no aplica hover/focus visual (modo read-only). */
  interactive?: boolean;
  className?:   string;
  /** Default true: el prefix es decorativo (`%`, `Gramos`). False = button. */
  prefixStatic?: boolean;
  /** Default true: el suffix es decorativo. False = button. */
  suffixStatic?: boolean;
}) {
  return (
    <div
      className={cn(
        // FASE F13 — padding y gap apretados para dar más espacio al input
        // (el número es la pieza protagonista). Antes: gap-1, pl-1.5, pr-1.5.
        "inline-flex items-center gap-0.5 rounded-sm",
        prefix != null ? "pl-1" : "pl-0.5",
        suffix != null ? "pr-1" : "pr-0",
        "transition-[background-color,box-shadow] duration-150",
        interactive && "hover:bg-primary/[0.05] dark:hover:bg-primary/[0.08]",
        interactive && "focus-within:bg-primary/[0.06] dark:focus-within:bg-primary/[0.10]",
        interactive && "focus-within:shadow-[inset_0_-1px_0_0_rgb(var(--primary-rgb)_/_0.7)]",
        className,
      )}
    >
      {prefix != null && (
        prefixStatic ? (
          <span
            aria-hidden="true"
            className="shrink-0 select-none pointer-events-none text-[10px] leading-none text-muted/55 tabular-nums"
          >
            {prefix}
          </span>
        ) : (
          <span className="shrink-0 leading-none">{prefix}</span>
        )
      )}
      {children}
      {suffix != null && (
        suffixStatic ? (
          <span
            aria-hidden="true"
            className="shrink-0 select-none pointer-events-none text-[10px] leading-none text-muted/55 tabular-nums"
          >
            {suffix}
          </span>
        ) : (
          <span className="shrink-0 leading-none">{suffix}</span>
        )
      )}
    </div>
  );
}

// FASE F9 — AdjustmentLabelEditor: editor inline siempre visible.
// Sin pill, sin ✎, sin ✓/×, sin popover. Tres controles compactos en línea:
//   [signo +/−] [valor numérico] [unidad %/$]
//   −  = BONUS    (descuento)
//   +  = SURCHARGE (recargo)
//   %  = PERCENTAGE
//   $  = FIXED_AMOUNT
// Cada cambio crea/actualiza el override completo (kind+type+value) para
// que el motor backend reciba el patch consistente, incluso cuando se
// arranca desde "sin ajuste" o desde un original del catálogo. Cero
// matemática nueva — el monto/impacto sigue viniendo del preview.
function AdjustmentLabelEditor({
  kind, type, value, currency, disabled, onChange,
  originalKind, originalType, originalValue, originalAmount,
  currentAmount,
}: {
  kind:     "BONUS" | "SURCHARGE" | null;
  type:     "PERCENTAGE" | "FIXED_AMOUNT" | null;
  value:    number | null;
  currency: string;
  disabled?: boolean;
  onChange: (patch: {
    adjustmentKind?:  "BONUS" | "SURCHARGE" | null;
    adjustmentType?:  "PERCENTAGE" | "FIXED_AMOUNT" | null;
    adjustmentValue?: number | null;
  }) => void;
  originalKind?:   "BONUS" | "SURCHARGE" | null;
  originalType?:   "PERCENTAGE" | "FIXED_AMOUNT" | null;
  originalValue?:  number | null;
  originalAmount?: number | null;
  /** @deprecated Recálculo local (`lineCost − unitVal·qty`) — currency-unsafe
   *  en líneas NO base (mezcla moneda base con original). Ya NO se usa para
   *  el label de impacto: la fuente es `originalAmount` (= `lineAdjAmount`
   *  del motor, moneda base). Se mantiene en el contrato para no romper
   *  callers; eliminar cuando se limpien los sitios de invocación. */
  currentAmount?:  number | null;
}) {
  // Valores efectivos para el render: override → original → defaults.
  const hasOverride = kind != null;
  const effKind:  "BONUS" | "SURCHARGE"            = (kind  ?? originalKind  ?? "BONUS");
  const effType:  "PERCENTAGE" | "FIXED_AMOUNT"    = (type  ?? originalType  ?? "PERCENTAGE");
  const effValue: number | null                     = hasOverride ? value : (originalValue ?? null);

  const isBonus   = effKind === "BONUS";
  const isPercent = effType === "PERCENTAGE";
  const signCls   = isBonus
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-amber-600 dark:text-amber-400";

  // Cualquier change envía el trío completo para que el override quede
  // consistente aún si arrancaba en null.
  const apply = (patch: Partial<{
    adjustmentKind:  "BONUS" | "SURCHARGE";
    adjustmentType:  "PERCENTAGE" | "FIXED_AMOUNT";
    adjustmentValue: number | null;
  }>) => {
    onChange({
      adjustmentKind:  patch.adjustmentKind  ?? effKind,
      adjustmentType:  patch.adjustmentType  ?? effType,
      adjustmentValue: patch.adjustmentValue ?? effValue ?? 0,
    });
  };

  const flipSign = () => apply({ adjustmentKind: isBonus ? "SURCHARGE" : "BONUS" });
  const flipUnit = () => apply({ adjustmentType: isPercent ? "FIXED_AMOUNT" : "PERCENTAGE" });
  const setValue = (v: number | null) => apply({ adjustmentValue: v ?? 0 });

  // FIX oscilación flechitas — mismo patrón que MermaLabelEditor/Cantidad:
  // commit DEBOUNCED vía `useOverrideNumber` en lugar de `setValue` síncrono
  // por cada tick. El commit por tick re-renderizaba `TPNumberInput` con el
  // `value` prop aún viejo (parent async) → su effect lo revertía y el valor
  // oscilaba (10 → 10,5 → 10 → 10,5). `originalValue=null` → emite siempre el
  // valor literal (misma semántica que el `setValue` directo). El sync del
  // hook re-hidrata cuando cambia `effValue` real (toggle %/$, signo,
  // preview/reset).
  const { value: adjLocal, setValue: setAdjLocal } = useOverrideNumber(
    effValue, null, (v) => setValue(v),
  );

  // FASE F25 — eliminado el render del "ajuste original tachado" debajo
  // del editor. Aparecía por un segundo al editar mientras viajaba el
  // preview y daba sensación de flash/glitch. La info del original sigue
  // disponible via props para futuros consumidores; solo se removió el
  // render visual.

  // FIX — el impacto del ajuste es SIEMPRE el `lineAdjAmount` que emite el
  // motor (`originalAmount`): passthrough en moneda BASE, ya = baseConvertida
  // × %, correcto aún con conversión de moneda y tras edición inline (el
  // preview se refetchea con el override aplicado y el motor reemite el
  // dato). El path anterior usaba `currentAmount` (= lineCost − unitVal·qty)
  // cuando había override: en líneas NO base eso MEZCLA monedas (lineCost en
  // base vs unitVal en USD) y mostraba ~el total de la línea en lugar del
  // impacto del 10%. Usar siempre el backend da paridad con el bloque
  // read-only (Simulador == Factura). `currentAmount` queda deprecado.
  void currentAmount;
  const showAmount = originalAmount != null ? originalAmount : null;
  const amountText = showAmount != null && Math.abs(Number(showAmount)) > 0
    ? `${isBonus ? "−" : "+"}${currency} ${fmtMoney(Math.abs(Number(showAmount)))}`
    : null;

  // FASE F11 — signo y unidad como prefix/suffix INTERACTIVOS del wrap.
  // El wrap se ve como UN solo control compacto: `[− 11,00 %]` / `[+ 5,00 $]`.
  // Los botones siguen siendo buttons (no decorativos): tabIndex=-1 los
  // mantiene fuera del flujo TAB, pero responden a click.
  // FASE F13 — buttons compactados a w-3.5 y el input ensanchado a w-[96px]
  // para dar prioridad visual al número. Antes: w-4 + w-[60px], el "+/−" y
  // "%/$" robaban espacio y el número quedaba truncado.
  const signButton = (
    <button
      type="button"
      tabIndex={-1}
      disabled={disabled}
      onClick={flipSign}
      title={isBonus
        ? "Bonificación (−). Click para cambiar a recargo (+)."
        : "Recargo (+). Click para cambiar a bonificación (−)."}
      aria-label={isBonus ? "Signo: bonificación" : "Signo: recargo"}
      className={cn(
        "h-5 w-3.5 rounded text-[12px] font-bold leading-none tabular-nums hover:bg-surface2",
        signCls,
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      {isBonus ? "−" : "+"}
    </button>
  );
  const unitButton = (
    <button
      type="button"
      tabIndex={-1}
      disabled={disabled}
      onClick={flipUnit}
      title={isPercent ? `Porcentaje (toggle a ${currency || "$"})` : `Monto fijo (toggle a %)`}
      aria-label={isPercent ? "Unidad: porcentaje" : "Unidad: monto fijo"}
      className={cn(
        "h-5 w-3.5 rounded text-[10px] font-semibold text-muted/85 hover:bg-surface2 hover:text-text",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      {isPercent ? "%" : "$"}
    </button>
  );

  return (
    <div
      data-adjustment-inline-editor
      className="inline-flex flex-col items-end gap-0"
    >
      <PrefixedField
        prefix={signButton}
        suffix={unitButton}
        prefixStatic={false}
        suffixStatic={false}
        interactive={!disabled}
      >
        <CellNumberInput
          value={adjLocal}
          onChange={setAdjLocal}
          formatType="PERCENT"
          decimals={2}
          // Step 1,00 para % y $ (antes 0,5 en %): saltos enteros estables.
          step={1}
          readOnly={disabled}
          widthClass="w-[128px]"
          noInputBg
        />
      </PrefixedField>
      {/* Monto signado debajo (display only) cuando el backend lo emite. */}
      {amountText && (
        <span className={cn("text-[10px] tabular-nums leading-tight px-0.5", signCls, "opacity-90")}>
          {amountText}
        </span>
      )}
      {/* FASE F25 — render del "Ajuste original del artículo" tachado
          eliminado. Causaba flash visual al editar (parpadeaba mientras
          viajaba el preview). El input mantiene el valor editado limpio
          sin overlay legacy. */}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Una fila de la grilla. Diseño data-driven — la lógica de qué celdas
// editan/no editan vive en el caller (composeRowProps).
// ─────────────────────────────────────────────────────────────────────────────

function RowImpl({
  componentType, Icon, primary, secondary,
  quantityCell, unitValueCell, mermaOrAdjustmentCell,
  unitValueCurrencyOverride, unitValueSubLine,
  saleValueValue, saleValueText, totalValue, totalText, totalTooltip,
  manual, onResetRow, canResetRow,
  commercialView,
  precioUnitVentaText, margenPctText, margenTone, margenTooltip,
  ventaLineaText, participacionText,
  quantityUnitLabel, currencyLabel,
  globalAdjustmentText, globalAdjustmentKind,
}: {
  componentType:   ComponentTypeKey;
  Icon:            LucideIcon;
  primary:         React.ReactNode;
  /** Fase 2.4 — secondary line ahora incluye la unidad (gramos / unidad)
   *  inline. La columna UNID. fue removida. */
  secondary?:      React.ReactNode;
  quantityCell:    React.ReactNode;
  unitValueCell:   React.ReactNode;
  /** FASE 12.1 — celda fusionada Merma + Ajuste. El caller decide qué
   *  inyectar según el tipo: METAL → `<CellNumberInput>` para merma %;
   *  HECHURA/PRODUCT/SERVICE → `<AdjustmentEditor>` para bonif/recargo. */
  mermaOrAdjustmentCell: React.ReactNode;
  /** Fase 2.1 — el valor numérico (no el texto) se pasa para detectar
   *  cambios y disparar el flash de highlight. */
  saleValueValue?: number | null;
  saleValueText?:  string | null;
  totalValue?:     number | null;
  totalText?:      string | null;
  /** Tooltip opcional sobre la celda "Costo de Venta". Se usa cuando el monto
   *  mostrado es derivado del `unifiedFactor` del artículo (modo derivado
   *  MARGIN_TOTAL / PROPORTIONAL_COST), para diferenciarlo del lineSale
   *  atribuido por línea por el backend. */
  totalTooltip?:   string | null;
  manual:          boolean;
  onResetRow:      () => void;
  canResetRow:     boolean;
  /** FASE 12.5 — etiqueta de unidad mostrada como SUB-LÍNEA tenue debajo
   *  del input de Cantidad (antes vivía como sufijo dentro del input).
   *  Ejemplos: "gr" (METAL), "un" (resto). */
  quantityUnitLabel?: string;
  /** FASE 12.5 — etiqueta de moneda mostrada INLINE antes del valor en
   *  Costo unit. Ejemplos: "ARS", "USD". */
  currencyLabel?: string;
  /** Override de la etiqueta de moneda PARA la celda Costo unit. Se usa
   *  cuando el cost line está en moneda distinta a la del comprobante: la
   *  celda muestra el code original (USD) sobre el número original, en lugar
   *  del code del documento. Sólo afecta esa celda — el resto sigue usando
   *  `currencyLabel`. */
  unitValueCurrencyOverride?: string | null;
  /** Sub-línea informativa debajo del Costo unit. — equivalente unitario
   *  en moneda del comprobante. Solo se renderea cuando aplica conversión
   *  (cost line en moneda distinta). */
  unitValueSubLine?: React.ReactNode | null;
  /** FASE 12.11 — texto pre-formateado del ajuste global del documento
   *  aplicado a esta línea (ej. "Aj. global −5%"). Se renderea como sub-
   *  línea bajo "Margen" en la celda Costo Total. Si null/undefined, no
   *  se renderea nada extra. El caller deriva esto desde
   *  `meta.documentAdjustments.lineManualDiscount` (passthrough) — cero
   *  matemática nueva. */
  globalAdjustmentText?: string | null;
  /** Tono ("BONUS"=verde, "SURCHARGE"=amber) para colorear el texto. */
  globalAdjustmentKind?: "BONUS" | "SURCHARGE" | null;
  // FASE 12.4 — `commercialView` deprecated (vista única). Los siguientes
  // campos siguen llegando como props para no romper la API del Row ni
  // los memos; cualquier prop nuevo se evalúa en otra parte. `margenPctText`
  // ahora se renderea SIEMPRE como sub-línea debajo de "Costo Total".
  commercialView?: boolean;
  precioUnitVentaText?: string | null;
  margenPctText?:       string | null;
  margenTone?:          string;
  /** Tooltip opcional sobre la celda Margen. Se usa cuando el % mostrado es
   *  derivado del `unifiedFactor` del artículo (modo derivado MARGIN_TOTAL /
   *  PROPORTIONAL_COST), para diferenciarlo del margen real por línea. */
  margenTooltip?:       string | null;
  ventaLineaText?:      string | null;
  participacionText?:   string | null;
}) {
  const cls = COMPONENT_TYPE_BADGE[componentType];
  // Fase 2.1 — highlight sutil cuando los valores derivados (sale/total)
  // cambian post-preview backend. Cero animación pesada — solo un breve
  // bg-emerald que se desvanece (transition-colors).
  const flashSale  = useFlashOnChange(saleValueValue ?? null);
  const flashTotal = useFlashOnChange(totalValue ?? null);
  // FASE F23 — el `gridTemplateColumns` se inyecta vía context para que
  // header + filas + footers compartan widths configurables sin tener
  // que pasar la prop por cada layer (rompería los memos).
  const gridTpl = React.useContext(TableLayoutContext);

  return (
    <div
      className={cn(
        TABLE_COLS_CLS,
        // Fase 2.1 — padding vertical reducido (py-1 vs py-1.5 anterior).
        // FASE 12.7 — `group` habilita hover-coordinado entre celdas.
        "group px-1.5 py-1 text-[11px] rounded-md transition-colors duration-150",
        "hover:bg-slate-500/[0.04] dark:hover:bg-slate-200/[0.04]",
        // Indicador lateral muy sutil cuando la fila tiene override manual.
        manual && "bg-amber-500/[0.025]",
      )}
      style={{ gridTemplateColumns: gridTpl }}
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
          <div className="text-[10px] text-muted/55 leading-none truncate -mt-px">{secondary}</div>
        )}
      </div>
      {/* FASE 12.25 — Cantidad: valor + unidad INLINE a la derecha.
          FASE F21 — refactor: Cantidad y Unidad pasan a columnas separadas.
          La celda Cantidad ahora contiene SOLO el input (sin texto de
          unidad al lado). */}
      <div className="flex items-baseline justify-center tabular-nums text-text/90">
        {quantityCell}
      </div>
      {/* FASE F21 — celda Unidad independiente. Texto compacto, gris medio,
          aria-hidden + pointer-events-none (no focusable, no clickeable). */}
      <div className="flex items-baseline justify-center">
        {quantityUnitLabel && (
          <span
            aria-hidden="true"
            className="select-none pointer-events-none text-[10px] leading-none text-muted/55"
          >
            {quantityUnitLabel}
          </span>
        )}
      </div>
      {/* FASE 12.24 — Costo unit. con grid interno estable de 2 columnas:
          col1 = moneda (auto, justify-end), col2 = valor (96px fijo, ancho
          del CellNumberInput + margen para arrows).
          FASE F22 — la sub-línea Merma/Ajuste fue sacada de esta celda y
          pasa a vivir en su propia columna (`mermaOrAdjustmentCell` a la
          derecha). Costo unit. ahora muestra SOLO el valor unitario. */}
      <div className="flex flex-col items-center tabular-nums text-text/90 leading-tight">
        <div className="inline-grid grid-cols-[auto_96px] items-center gap-x-0.5">
          <span
            aria-hidden={!(unitValueCurrencyOverride ?? currencyLabel) || undefined}
            className="justify-self-end text-[10px] font-semibold text-muted/70 tabular-nums select-none"
          >
            {unitValueCurrencyOverride ?? currencyLabel ?? ""}
          </span>
          <div className="min-w-0 flex justify-end">{unitValueCell}</div>
        </div>
        {unitValueSubLine && (
          <div className="text-[9px] italic text-muted/60 leading-tight mt-0.5 tabular-nums">
            {unitValueSubLine}
          </div>
        )}
      </div>
      {/* FASE F22 — celda Merma/Ajuste independiente. Para METAL renderea
          el MermaLabelEditor (input siempre visible con sufijo %); para
          HECHURA/PRODUCT/SERVICE renderea el AdjustmentLabelEditor (signo +
          valor + unidad %/$ en un único control compacto). El caller
          inyecta el ReactNode correspondiente vía `mermaOrAdjustmentCell`. */}
      <div data-merma-ajuste-cell className="flex justify-center tabular-nums leading-tight">
        {mermaOrAdjustmentCell}
      </div>
      {/* FASE F23/F24 — Celda COSTO TOTAL queda con SOLO el importe principal.
          El % y el delta del margen se movieron a la columna Margen (a la
          DERECHA de Costo Total, antes de Costo de Venta). El
          `globalAdjustmentText` (ajuste global del documento, no del
          artículo) se mantiene acá como sub-línea opcional. */}
      <div className="text-center leading-tight">
        <div
          className={cn(
            "tabular-nums font-medium text-text rounded transition-colors duration-500 px-1",
            flashSale,
          )}
        >
          {saleValueText ?? "—"}
        </div>
        {/* FASE 12.11 — sub-línea opcional del ajuste global de la línea. */}
        {globalAdjustmentText && (
          <div
            className={cn(
              "text-[9px] tabular-nums leading-tight",
              globalAdjustmentKind === "SURCHARGE"
                ? "text-amber-600/80 dark:text-amber-400/80"
                : "text-emerald-600/75 dark:text-emerald-400/75",
            )}
            title="Ajuste global aplicado a la línea del documento"
          >
            {globalAdjustmentText}
          </div>
        )}
      </div>
      {/* FASE F23/F24 — Celda MARGEN entre Costo Total y Costo de Venta.
          Contiene el porcentaje del margen y el importe del impacto
          monetario (delta entre Costo de Venta y Costo Total).
          Reglas:
            · Porcentaje arriba (`+10,0%` / `-5,0%`).
            · Importe abajo (`+ARS X` / `-ARS X`).
            · Verde si positivo, rose si negativo, "—" si no hay datos.
          Display only — no recalcula comercialmente. */}
      <div data-margin-cell className="text-center leading-tight">
        {margenPctText != null ? (
          <div
            className={cn(
              "text-[11px] font-semibold tabular-nums",
              margenPctText.startsWith("-")
                ? "text-rose-500/80 dark:text-rose-400/80"
                : "text-emerald-600/85 dark:text-emerald-400/85",
              // Pista visual via cursor en hover cuando hay tooltip — sin
              // subrayado para mantener la celda limpia.
              margenTooltip && "cursor-help",
            )}
            title={margenTooltip ?? undefined}
            data-margin-source={margenTooltip ? "unified" : "line"}
          >
            {margenPctText.startsWith("-") ? "" : "+"}{margenPctText}
          </div>
        ) : (
          <div className="text-[10px] text-muted/40">—</div>
        )}
        {(() => {
          // UTILIDAD de línea = Venta de línea − Costo total de línea.
          // Ambos operandos vienen YA en base "total de línea" (escalados ×
          // cantidad): `totalValue` = venta línea, `saleValueValue` = costo
          // total línea. Antes `totalValue` llegaba sin escalar (venta
          // unitaria) y el importe se volvía rojo/negativo al subir la
          // cantidad pese a margen positivo. Display puro: no recalcula
          // precios, solo resta dos valores ya provistos por el motor.
          // El signo/color es ahora coherente con el % de margen.
          if (
            saleValueValue == null || totalValue == null ||
            !Number.isFinite(saleValueValue) || !Number.isFinite(totalValue)
          ) return null;
          const utilidad = Number(totalValue) - Number(saleValueValue);
          if (!Number.isFinite(utilidad) || Math.abs(utilidad) < 0.005) return null;
          const isNeg = utilidad < 0;
          const sign  = isNeg ? "−" : "+";
          const text  = `${sign}${currencyLabel ?? ""} ${fmtMoney(Math.abs(utilidad))}`.trim();
          return (
            <div
              data-margin-amount-impact
              className={cn(
                "text-[10px] tabular-nums leading-tight",
                isNeg
                  ? "text-rose-500/80 dark:text-rose-400/80"
                  : "text-emerald-600/85 dark:text-emerald-400/85",
              )}
              title="Utilidad de la línea (Venta de línea − Costo total de línea)"
            >
              {text}
            </div>
          );
        })()}
      </div>
      {/* FASE 12.2 — "Costo de Venta" (antes "Total"). Mismo dato (totalText). */}
      {/* FASE 12.22 — centrado para coincidir con el header centrado. */}
      <div
        className={cn(
          "text-center tabular-nums font-semibold text-emerald-600 dark:text-emerald-400 rounded transition-colors duration-500 px-1",
          flashTotal,
          // Pista via cursor en hover cuando hay tooltip — sin subrayado
          // para mantener la celda limpia.
          totalTooltip && totalText != null && "cursor-help",
        )}
        title={totalTooltip ?? undefined}
        data-sale-source={totalTooltip ? "unified" : "line"}
      >
        {totalText ?? "—"}
      </div>
      {/* FASE 12.2 — "P. unit venta", "Venta línea" y "Particip." quedan
          ocultos visualmente. Los textos (precioUnitVentaText / ventaLineaText
          / participacionText) siguen llegando como props para no romper la
          API del Row ni los memos; simplemente no se rendean. */}
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
            // FASE 12.7 — acciones laterales solo en hover/focus de la fila.
            // Limpia visualmente la tabla: las filas sin manipulación reciente
            // no muestran iconos compitiendo con los datos.
            "opacity-0 transition-opacity",
            "group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100",
            !canResetRow && "cursor-not-allowed group-hover:opacity-40",
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
  if (prev.totalTooltip    !== next.totalTooltip)    return false;
  if (prev.unitValueCurrencyOverride !== next.unitValueCurrencyOverride) return false;
  if (prev.unitValueSubLine          !== next.unitValueSubLine)          return false;
  // MVP híbrido — props comerciales.
  if (prev.commercialView      !== next.commercialView)      return false;
  if (prev.precioUnitVentaText !== next.precioUnitVentaText) return false;
  if (prev.margenPctText       !== next.margenPctText)       return false;
  if (prev.margenTone          !== next.margenTone)          return false;
  if (prev.margenTooltip       !== next.margenTooltip)       return false;
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
        {marginPct != null && Number.isFinite(marginPct) ? `${formatByType(marginPct, "MARGIN_PERCENT", { bare: true })}%` : "—"}
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

// ─────────────────────────────────────────────────────────────────────────────
// CostAdjustmentDetailSection — F20
// Sección compacta al final del card con el detalle del ajuste global:
//
//   AJUSTE GLOBAL
//   Costo antes del ajuste: AR$ X
//   Bonificación 5%: −AR$ Y     (verde)
//   Costo total: AR$ Z          (= Valor de costo del header)
//
// Display only. Pasa por:
//   · `data` = `composition.costAdjustment` (kind/type/value/amount).
//   · `costTotalFinal` = `totalComponents` (suma post-ajuste = Valor de costo).
// "Costo antes del ajuste" se deriva visualmente cuando el motor no emite el
// dato explícito:
//   · BONUS:     antes = total + amount  (la bonif redujo, antes era mayor)
//   · SURCHARGE: antes = total − amount  (el recargo sumó, antes era menor)
// Cero matemática comercial — solo formato.
// Si `data?.kind == null` → no renderea (silencio).
// ─────────────────────────────────────────────────────────────────────────────
function CostAdjustmentDetailSection({
  data, costTotalFinal, currency,
}: {
  data: {
    kind:   "BONUS" | "SURCHARGE" | null;
    type:   "PERCENTAGE" | "FIXED_AMOUNT" | null;
    value:  number | null;
    amount: number | null;
  } | null | undefined;
  /** Costo final post-ajuste (mismo valor que el header "Valor de costo"). */
  costTotalFinal: number | null;
  currency: string;
}) {
  if (!data || data.kind == null) return null;
  const isBonus   = data.kind === "BONUS";
  const isPercent = data.type === "PERCENTAGE";
  const sign      = isBonus ? "−" : "+";
  const cls       = isBonus
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-amber-600 dark:text-amber-400";
  const kindWord  = isBonus ? "Bonificación" : "Recargo";

  // Monto del ajuste (motor) y costo antes del ajuste (derivación visual).
  const amount = data.amount != null && Number.isFinite(data.amount)
    ? Math.abs(Number(data.amount))
    : null;
  const costoAntes = (() => {
    if (costTotalFinal == null || !Number.isFinite(costTotalFinal)) return null;
    if (amount == null) return null;
    return isBonus ? costTotalFinal + amount : costTotalFinal - amount;
  })();

  // Texto del label del ajuste: "Bonificación 5%" / "Recargo $1.000".
  const adjLabel = (() => {
    if (isPercent && data.value != null && Number.isFinite(data.value)) {
      const pct = formatByType(Number(data.value), "PERCENT", { bare: true });
      return `${kindWord} ${pct}%`;
    }
    if (data.value != null && Number.isFinite(data.value)) {
      return `${kindWord} ${currency} ${fmtMoney(Math.abs(Number(data.value)))}`;
    }
    return kindWord;
  })();

  const amountText = amount != null
    ? `${sign}${currency} ${fmtMoney(amount)}`
    : null;

  const fmt = (v: number) => `${currency} ${formatDecimal(v, 2)}`;

  return (
    <div
      data-cost-adjustment-detail
      className="mt-2 flex flex-col gap-0.5 px-2 py-1.5 text-[11px] rounded-sm bg-slate-500/[0.04] dark:bg-slate-500/[0.06]"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted/70">
        Ajuste global
      </span>
      {costoAntes != null && (
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-muted/70">Costo antes del ajuste:</span>
          <span className="tabular-nums text-text/85">{fmt(costoAntes)}</span>
        </div>
      )}
      {amountText && (
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn("font-medium", cls)}>{adjLabel}:</span>
          <span className={cn("tabular-nums font-semibold", cls)}>{amountText}</span>
        </div>
      )}
      {costTotalFinal != null && Number.isFinite(costTotalFinal) && (
        <div className="flex items-baseline justify-between gap-2 border-t border-border/20 pt-0.5">
          <span className="font-semibold text-text/85">Costo total:</span>
          <span className="tabular-nums font-semibold text-text/90">{fmt(costTotalFinal)}</span>
        </div>
      )}
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
            <span className="ml-1 text-text/90">{formatByType(lineMd.valuePct, "PERCENT", { bare: true })}%</span>
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
  currencyById,
  globalAdjustments,
  previewLoading,
}: SaleCompositionEditableGridProps) {
  // FASE F23 — state de widths configurables (persistido en localStorage).
  // Lazy init para que solo se lea el storage en mount; cambios en
  // `widths` se persisten en un useEffect.
  const [colWidths, setColWidths] = React.useState<number[]>(() => loadPersistedColWidths());
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      window.localStorage.setItem(COL_WIDTHS_STORAGE, JSON.stringify(colWidths));
    } catch {
      // Ignored (e.g. storage quota / SSR).
    }
  }, [colWidths]);
  const gridTpl = React.useMemo(
    () => buildGridTemplateColumns(colWidths),
    [colWidths],
  );

  const meta        = line.pricingMeta ?? {};
  const composition = (meta.composition ?? null) as any;

  const metals    = (composition?.metals    ?? []) as any[];
  const hechuras  = (composition?.hechuras  ?? []) as any[];
  const products  = (composition?.products  ?? []) as any[];
  const services  = (composition?.services  ?? []) as any[];

  // ── Margen "no atribuible por línea" — detector display-only ─────────────
  // El motor backend emite `hechuraMarginPct = 0` (y `metalMarginPct = 0`) de
  // forma explícita en los modos derivados de breakdown — PROPORTIONAL_COST,
  // SERVICE_AS_HECHURA, MANUAL_AS_HECHURA, COMBO_COMPONENTS — porque en esos
  // modos no existe un margen explícito por componente: el margen real es
  // unificado a nivel total/artículo. Ver `pricing-engine.sale.ts:2770-2773`
  // y `pricing-composition.ts:936-956`.
  //
  // En ese caso, `composition.hechuras[i].lineSale` colapsa a `lineCost`
  // (porque `hechuraSaleFactor = 1 + 0/100 = 1`) y el cálculo display
  // `(lineSale − lineCost)/lineCost × 100` daría 0,0% engañoso. Detectamos
  // el caso comparando `metal/hechuraSale` agregado contra `metal/hechuraCost`:
  // si difieren con `pct === 0`, sabemos que hay margen real pero el motor
  // NO lo distribuye por línea. La grilla mostrará "—" en lugar de "+0,0%".
  //
  // Caso edge respetado: lista METAL_HECHURA con margen 0% declarado a
  // propósito → `sale === cost` → este detector da false → seguimos
  // mostrando "0,0%" (que en ese contexto sí es la verdad).
  //
  // NO recalcula precios — sólo decide si mostrar el % o "—". POLICY R4.5.
  const isHechuraMarginUnattributable = (() => {
    const mpct  = Number((meta as any).hechuraMarginPct);
    const hcost = Number((meta as any).hechuraCost);
    const hsale = Number((meta as any).hechuraSale);
    return Number.isFinite(mpct) && Math.abs(mpct) < 0.001
        && Number.isFinite(hcost) && hcost > 0.001
        && Number.isFinite(hsale) && Math.abs(hsale - hcost) > 0.005;
  })();
  const isMetalMarginUnattributable = (() => {
    const mpct  = Number((meta as any).metalMarginPct);
    const mcost = Number((meta as any).metalCost);
    const msale = Number((meta as any).metalSale);
    return Number.isFinite(mpct) && Math.abs(mpct) < 0.001
        && Number.isFinite(mcost) && mcost > 0.001
        && Number.isFinite(msale) && Math.abs(msale - mcost) > 0.005;
  })();

  // ── Factor unificado del artículo (display-only) ────────────────────────
  // Cuando el motor opera en modo derivado (MARGIN_TOTAL / PROPORTIONAL_COST /
  // etc.) emite `metalMarginPct = hechuraMarginPct = 0` a propósito y los
  // `lineSale` por componente colapsan al `lineCost`. La columna "Margen"
  // quedaba en "—" para cada fila aunque el artículo SÍ tiene margen real
  // (basePrice ≠ unitCost). Mismo criterio que el Simulador
  // (`PriceBaseSection` / `PriceCompositionCards`): reusamos el ratio
  // `basePrice / unitCost` que ya emite el motor como passthrough y lo
  // mostramos como margen visual unificado en filas colapsadas.
  // Σ(lineCost × unifiedFactor) === basePrice por construcción del motor en
  // los modos derivados (paridad agregada).
  // Es display puro — no recalcula precios ni reemplaza `lineSale` real.
  const unifiedFactor: number | null = (() => {
    const uc = Number((meta as any).unitCost ?? 0);
    const bp = Number((meta as any).basePrice ?? 0);
    if (!Number.isFinite(uc) || uc <= 0.001) return null;
    if (!Number.isFinite(bp) || bp <= 0.001) return null;
    return bp / uc;
  })();

  // MVP híbrido (Print 2) — toggle vista costo / vista comercial.
  // OFF por default: la grilla muestra solo composición de costo (Print 1).
  // ON: agrega 4 columnas comerciales con sale-side SOLO cuando es canónico
  // (count===1 para METAL/HECHURA). PRODUCT/SERVICE quedan en "—" porque
  // el motor no descompone su sale-side per-item. Cero matemática nueva.
  // FASE 12.4 — vista única (sin switch). Antes había useState(false) y una
  // pill que alternaba entre "Vista costo" y "Vista comercial". Ahora la
  // tabla siempre renderea el modo "comercial" (con margen embebido en
  // Costo Total). Mantenemos el binding por compatibilidad con los renderers
  // que aún pasan `commercialView={commercialView}` al Row — el prop ya no
  // afecta el JSX (RowImpl lo ignora), pero evitamos tener que tocar las
  // 4 firmas de renderers internos.
  const commercialView = true;

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

  // BUGFIX (unidades mezcladas) — `applyCostLinePatch` se invoca también
  // desde el commit con debounce de `useOverrideNumber`, cuyo `useEffect`
  // tiene `onCommit` FUERA de deps (eslint-disable). Ese closure es STALE:
  // captura el `activeCostLineOverrides` de un render viejo. Al editar una
  // línea con unidad distinta se dispara un preview que recomputa la
  // composición del grupo → cambia `initialValue` de las otras filas → el
  // sync effect re-dispara sus commits con el `onCommit` viejo, que
  // mergearía sobre un array de overrides DESACTUALIZADO y borraría las
  // cantidades ya editadas de las otras líneas.
  //
  // Solución: el merge SIEMPRE se hace contra el array MÁS RECIENTE (ref),
  // nunca contra el snapshot del render. Así cada patch preserva todos los
  // overrides previos y solo toca el costLineId editado. Indexación por
  // costLineId se mantiene en `patchCostLineOverride` (sin cambios).
  const activeOverridesRef = useRef<CostLineOverride[]>(activeCostLineOverrides);
  // Mantener el ref con el array MÁS RECIENTE. Se actualiza en effect (no en
  // render — regla react-hooks). Seguro: el commit de `useOverrideNumber`
  // está debounced (250ms) y los effects corren mucho antes, así que el ref
  // ya está fresco cuando un commit (incluso con closure stale) lo lee.
  useEffect(() => {
    activeOverridesRef.current = activeCostLineOverrides;
  }, [activeCostLineOverrides]);

  function applyCostLinePatch(
    costLineId: string,
    type:       CostLineOverride["type"],
    patch:      Partial<Omit<CostLineOverride, "costLineId" | "type">>,
  ) {
    const next = patchCostLineOverride(activeOverridesRef.current, costLineId, type, patch);
    onApply({ costLineOverrides: next });
  }

  function resetCostLine(costLineId: string) {
    const next = activeOverridesRef.current.filter(o => o?.costLineId !== costLineId);
    onApply({ costLineOverrides: next });
  }

  // FASE 12.11 — derivación display-only del ajuste global de la línea del
  // documento (`pricingMeta.documentAdjustments.lineManualDiscount`). Es la
  // ÚNICA pieza de "ajuste global" que el motor backend emite a nivel de
  // línea de Factura hoy; el resto (canal, cupón, payment, shipping,
  // globalDiscount del documento) son agregados puros sin breakdown
  // per-componente. Este texto se muestra como sub-línea bajo "Margen" en
  // CADA fila del grid (todas comparten el mismo ajuste de línea).
  //
  // GAP DE BACKEND: para mostrar UN ajuste global *prorrateado por componente*
  // se necesitaría que el motor emita `componentAdjustmentBreakdown[]` con
  // su porción por costLineId. Hoy no existe — F1.5 deuda.
  const lineGlobalAdj = (() => {
    const md: any = (meta as any).documentAdjustments?.lineManualDiscount;
    if (!md || md.amount == null || md.amount === 0) return null;
    const sign = md.kind === "SURCHARGE" ? "+" : "−";
    if (md.valuePct != null && Number.isFinite(Number(md.valuePct))) {
      const pct = formatByType(Number(md.valuePct), "PERCENT", { bare: true });
      return { text: `Aj. global ${sign}${pct}%`, kind: md.kind as "BONUS" | "SURCHARGE" };
    }
    // Sin pct (modo AMOUNT) → mostrar solo signo + monto bruto del ajuste.
    const amt = fmtMoney(Math.abs(Number(md.amount)));
    return { text: `Aj. global ${sign}${currency} ${amt}`, kind: md.kind as "BONUS" | "SURCHARGE" };
  })();

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

  // FASE 12.5b — `fallback` se usa también cuando el código existe pero el
  // catálogo no lo mapea (antes devolvía el código crudo, ej. "g"). Esto
  // permite que la sub-línea de Cantidad muestre siempre un nombre amigable
  // ("Gramos", "Unidades") aunque el tenant no haya populado `unitNameByCode`.
  const resolveUnitName = (code: string | null | undefined, fallback: string): string => {
    if (!code) return fallback;
    const name = unitNameByCode?.get(code);
    return name ?? fallback;
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
    // Cuando true, indica que el motor backend NO atribuye margen a esta
    // línea (modo derivado: MARGIN_TOTAL / PROPORTIONAL_COST / etc.) — el
    // `lineSale` viene colapsado al `lineCost`. Si tenemos un factor unificado
    // global (`unifiedFactorForRow != null`), lo usamos para mostrar el margen
    // visual del artículo en lugar de "—". Si no hay factor unificado, caemos
    // a "—" para evitar mostrar "+0,0%" engañoso.
    marginUnattributable: boolean = false,
    // Factor unificado del artículo (basePrice/unitCost). Solo se usa como
    // fallback display cuando `marginUnattributable` es true y el % calculado
    // da ≈ 0 (lineSale colapsado). Display puro — no reemplaza `lineSale` real.
    unifiedFactorForRow: number | null = null,
  ): {
    precioUnitVentaText: string | null;
    margenPctText:       string | null;
    margenTone:          string;
    margenTooltip:       string | null;
    ventaLineaText:      string | null;
    participacionText:   string | null;
  } {
    // Precio unit. venta = saleLineValue / qtyComp cuando ambos válidos.
    let precioUnitVentaText: string | null = null;
    if (saleLineValue != null && Number.isFinite(saleLineValue)
        && qtyComp != null && Number.isFinite(qtyComp) && qtyComp > 0) {
      precioUnitVentaText = fmt(saleLineValue / qtyComp);
    }
    // Margen — helper compartido (también usado por el Simulador a futuro).
    const margin = resolveMarginForRowDisplay(
      lineCost,
      saleLineValue,
      marginUnattributable,
      unifiedFactorForRow,
    );
    const { margenPctText, margenTone, margenTooltip } = margin;
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
      participacionText = `${formatByType(part, "PERCENT", { bare: true })}%`;
    }
    return { precioUnitVentaText, margenPctText, margenTone, margenTooltip, ventaLineaText, participacionText };
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
    <TableLayoutContext.Provider value={gridTpl}>
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
              {/* FASE F14 — "Componentes:" renombrado a "Valor de costo:"
                  para hablar el mismo lenguaje que el resto del flujo
                  comercial. La suma sigue siendo la misma (cost lines).
                  FASE F20 — el ajuste global del artículo dejó de mostrarse
                  inline en el header. Su detalle (antes / bonif|recargo /
                  total) vive ahora en la sección compacta al final del
                  card (`<CostAdjustmentDetailSection>`). El header solo
                  muestra el costo final ya ajustado. */}
              · Valor de costo:{" "}
              <span className={cn(
                "font-semibold text-text/90 tabular-nums rounded px-1 transition-colors duration-500",
                flashTotal,
              )}>
                {fmtMoney(totalComponents, currency)}
              </span>
            </span>
          )}
          {/* FASE F17 — "Costo con impuestos" entre "Valor de costo" y
              "Valor de venta". Solo se muestra si el backend emitió
              `costTaxAmount > 0` (passthrough; cero matemática FE). */}
          {(() => {
            const taxAmt = (meta as any)?.costTaxAmount;
            const withTax = (meta as any)?.costWithTax;
            const parsed = taxAmt != null ? parseFloat(String(taxAmt)) : 0;
            if (!Number.isFinite(parsed) || parsed <= 0) return null;
            const withTaxNum = withTax != null ? parseFloat(String(withTax)) : null;
            if (withTaxNum == null || !Number.isFinite(withTaxNum)) return null;
            return (
              <span className="ml-2 normal-case text-muted/60">
                · Costo con impuestos:{" "}
                <span className="font-semibold text-text/90 tabular-nums rounded px-1">
                  {fmtMoney(withTaxNum, currency)}
                </span>
              </span>
            );
          })()}
          {/* FASE F14 — "Valor de venta neto:" renombrado a "Valor de venta:"
              (más corto, igualmente claro). Sigue siendo basePrice × qty,
              sin impuestos. */}
          {headerSaleTotal != null && (
            <span className="ml-2 normal-case text-muted/60">
              · Valor de venta:{" "}
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
          {/* FASE 12.4 — switch "Vista costo / Vista comercial" eliminado.
              La tabla siempre se muestra en modo comercial: Margen embebido
              debajo de Costo Total, Costo unit. con Merma/Ajuste debajo. */}
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
            // FIX responsive — las columnas son REDIMENSIBLES y su ancho
            // mínimo total (~1100px) supera el card en pantallas chicas /
            // zoom alto. Sin un contenedor de scroll, las filas (grid con
            // px fijos) se desbordaban FUERA del card (botones, columna
            // Venta, inputs). `overflow-x-auto` + `max-w-full` mantienen
            // la tabla SIEMPRE dentro del card y, si no entra, el scroll
            // es interno (no del body). `box-border` + `min-w-0` evitan
            // que el borde empuje el card. No se achican inputs ni
            // columnas: el grid conserva sus px y se desplaza.
            //
            // Nota: al crear scroll-x, CSS computa overflow-y→auto; como el
            // wrapper NO tiene altura fija, NO aparece scroll vertical
            // interno (crece con el contenido). El header sigue `sticky`
            // dentro de este wrapper (visible y con resize funcional).
            "overflow-x-auto max-w-full min-w-0 box-border",
          )}
        >
          {/* `min-w-max` → el contenido se dimensiona al ancho real de las
              filas (header + rows + footers comparten el mismo
              gridTemplateColumns en px), así el scroll aparece en el
              wrapper de arriba en vez de desbordar el card. */}
          <div className="min-w-max">
          <TableHeader widths={colWidths} onWidthsChange={setColWidths} />
          {/* FASE 12.7 — quitamos `divide-y` para reducir sensación de
              tabla rígida. La separación entre filas viene del padding
              vertical de cada Row + del hover suave (rounded).
              FASE 12.9 — agrupamos visualmente por tipo. Cada grupo
              no-vacío tiene su header (nombre · conteo · subtotal) y un
              divider tenue. Cero cambios en lógica/orden — el orden por
              tipo ya estaba implícito en el render. */}
          <div className="px-1 py-1">
            {/* ─── METALES ─────────────────────────────────── */}
            {metals.length > 0 && (() => {
              // Consolidado por metal padre del LADO VENTA, IDÉNTICO a las
              // cards del Simulador ("Composición del precio" → ORO (Au)
              // 8,01 gr). Origen único: `buildMetalParentSaleTotals` =
              // costEquivGr × metalSaleFactor, exactamente `padre.totalEquivGr
              // * metalSaleFactor` de MetalSaleCard. El factor sale del MISMO
              // helper que usa el Simulador (`computeMetalSaleFactor`) sobre
              // el agregado metalCost/metalSale del motor. Cero recálculo /
              // cero fórmula paralela.
              const metalSaleFactor = computeMetalSaleFactor({
                metalCost: (meta as any)?.metalCost != null && Number.isFinite(Number((meta as any).metalCost))
                  ? Number((meta as any).metalCost) : null,
                metalSale: (meta as any)?.metalSale != null && Number.isFinite(Number((meta as any).metalSale))
                  ? Number((meta as any).metalSale) : null,
              });
              const equivGramsByMetal = buildMetalParentSaleTotals(metals as any[], metalSaleFactor)
                .map((m) => ({ name: m.name, grams: m.saleEquivGr }));
              return (
                <TypeGroupHeader
                  label="Metales"
                  count={metals.length}
                  subtotal={sumGroupLineCost(metals, qtyLine)}
                  currency={currency}
                  type="METAL"
                  equivGramsByMetal={equivGramsByMetal}
                />
              );
            })()}
            <div className="divide-y divide-slate-200/40 dark:divide-slate-700/25">
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
              // Fase 2.4 — secondary = "Ley 0,750".
              // FASE 12.23 — eliminado el prefix "18k · " redundante: el
              // kilataje ya vive en el primary del metal ("Oro 18 Kilates"),
              // duplicarlo en el secondary era ruido visual.
              const leyText = (() => {
                const value = m?.purity != null && Number.isFinite(Number(m.purity))
                  ? formatByType(Number(m.purity), "PURITY", { bare: true })
                  : null;
                if (value) return `Ley ${value}`;
                const label = m?.purityLabel ?? null;
                if (label) return `Ley ${label}`;
                return null;
              })();
              // FASE 12.7 — secondary solo muestra leyText (sin tipo cierre).
              // El tipo "Metal" ya está implícito en el icono coloreado de
              // la izquierda — repetirlo era ruido visual redundante.
              const secondary = leyText ? <span>{leyText}</span> : null;

              const totalRow = totalForRow(lineCost);
              // F1.5 #A++ — `lineSale` per METAL ahora viene canónico del motor
              // (passthrough exacto: lineCost × metalSale/metalCost). Para
              // snapshots legacy sin este campo, fallback a `metalSaleCanonical`
              // (válido solo cuando count===1, sino "—").
              const metalLineSale = (m as any)?.lineSale;
              const canonicalSale: number | null =
                metalLineSale != null && Number.isFinite(Number(metalLineSale))
                  ? Number(metalLineSale)
                  : metalSaleCanonical;
              const { saleForRow, isUnified: isUnifiedSaleRow } =
                resolveSaleForRowDisplay(
                  lineCost,
                  canonicalSale,
                  unifiedFactor,
                  isMetalMarginUnattributable,
                );
              const commercialCells = buildCommercialCells(
                lineCost,
                saleForRow,
                qtyValue ?? null,
                isMetalMarginUnattributable,
                unifiedFactor,
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
                  margenTooltip={isUnifiedSaleRow
                    ? "Margen unificado aplicado al total del artículo"
                    : commercialCells.margenTooltip}
                  ventaLineaText={commercialCells.ventaLineaText}
                  globalAdjustmentText={lineGlobalAdj?.text ?? null}
                  globalAdjustmentKind={lineGlobalAdj?.kind ?? null}
                  participacionText={commercialCells.participacionText}
                  // FASE 12.5 — etiquetas para sub-línea Cantidad y prefijo
                  // moneda en Costo unit. (rendering al nivel de RowImpl).
                  // FASE 12.5b — nombre amigable completo: METAL siempre en
                  // gramos; usamos `resolveUnitName` para tomarlo del catálogo
                  // (`unitNameByCode`) si existe, con fallback "Gramos".
                  quantityUnitLabel={resolveUnitName("g", "Gramos")}
                  currencyLabel={currency}
                  quantityCell={
                    <CellNumberInput
                      value={qtyValue}
                      onChange={isEditable && costLineId
                        ? (v) => applyCostLinePatch(costLineId, "METAL", { quantityOverride: v ?? 0 })
                        : () => {}}
                      formatType="METAL_GRAMS"
                      // Fase 2.3 — gramos con 2 decimales (era 3 → "1,000").
                      decimals={2}
                      step={0.05}
                      // FASE 12.5 — sufijo "g" REMOVIDO del input (la unidad
                      // ahora vive como prefix interno del PrefixedField
                      // vía `quantityUnitLabel`).
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
                    // FASE 12.21 — antes era un `<span>{fmt(...)}` que
                    // incluía la moneda en el texto ("ARS 206.250,00"), y
                    // como el wrap externo de la celda Costo Unit. también
                    // muestra `currencyLabel`, se renderizaba "ARS ARS …".
                    // Reemplazado por CellNumberInput read-only: muestra
                    // SOLO el número, alineado igual que los inputs
                    // editables de HECHURA/PRODUCT/SERVICE — la moneda
                    // vive una sola vez en el prefix del wrap externo.
                    <CellNumberInput
                      value={lineCost != null && qtyValue && qtyValue > 0
                        ? lineCost / Number(qtyValue)
                        : null}
                      onChange={() => {}}
                      formatType="MONEY"
                      decimals={2}
                      readOnly
                      tooltip={baseQuotePriceText
                        ? `Valor base por gramo: ${baseQuotePriceText}`
                        : undefined}
                    />
                  }
                  // FASE 12.11 — Merma como label editable (chip-style).
                  // Click expande el input; ✓ vuelve al label. Mismo callback.
                  mermaOrAdjustmentCell={
                    <MermaLabelEditor
                      value={mermaValue}
                      original={m?.appliedMermaPct ?? null}
                      onChange={isEditable && costLineId
                        ? (v) => applyCostLinePatch(costLineId, "METAL", { mermaPercentOverride: v ?? 0 })
                        : () => {}}
                      readOnly={!isEditable}
                      // FASE F2 — badge "Manual" si el operador editó local
                      // (override aún no propagado al preview); si no, usar
                      // el `mermaSource` que vino del backend.
                      mermaSource={
                        ov?.mermaPercentOverride != null
                          ? "costLineOverride"
                          : ((m as any)?.mermaSource ?? null)
                      }
                    />
                  }
                  // Costo Total del componente para la línea de factura completa
                  // (= `lineCost × line.quantity`). Display puro — `lineCost`
                  // viene post-conv post-adj por unidad de artículo desde el
                  // motor; multiplicar por la qty del documento NO recalcula
                  // precios, sólo expande el subtotal a la escala "línea
                  // factura", simétrico a la columna Venta.
                  saleValueValue={totalForRow(lineCost)}
                  saleValueText={fmt(totalForRow(lineCost))}
                  // FASE 12.10 — última columna ("Costo de Venta") debe
                  // mostrar el dato comercial, no el costo. Usamos
                  // `commercialCells.ventaLineaText` (passthrough de lineSale
                  // del motor); si no existe → "—". Antes mostraba
                  // `lineCost × line.quantity`, que es costo, no venta.
                  // Utilidad coherente: venta de LÍNEA (× cantidad), misma
                  // base que `saleValueValue` (costo total × cantidad). Antes
                  // se pasaba `saleForRow` SIN escalar → mezclaba venta
                  // unitaria con costo total y el importe bajo el % se volvía
                  // rojo/negativo al subir la cantidad pese a margen positivo.
                  totalValue={saleForRow != null && qtyValue ? totalForRow(saleForRow) : null}
                  totalText={commercialCells.ventaLineaText}
                  totalTooltip={isUnifiedSaleRow ? "Valor unificado del artículo" : null}
                  manual={!!ov}
                  onResetRow={costLineId ? () => resetCostLine(costLineId) : () => {}}
                  canResetRow={!!ov}
                />
              );
            })}

            </div>
            {/* FASE F7 — Total del grupo METALES. Display only. */}
            {metals.length > 0 && (
              <TypeGroupFooter
                label="metales"
                costTotal={sumGroupLineCost(metals, qtyLine)}
                saleTotal={sumGroupLineSaleDisplay(metals, {
                  qtyLine,
                  marginUnattributable: isMetalMarginUnattributable,
                  unifiedFactor,
                  canonical: metalSaleCanonical,
                })}
                currency={currency}
                quantityTotal={sumGroupQuantity(metals, (it) =>
                  it?.appliedGrams != null && Number.isFinite(Number(it.appliedGrams))
                    ? Number(it.appliedGrams)
                    : null,
                )}
                type="METAL"
              />
            )}
            {/* ─── HECHURAS ────────────────────────────────── */}
            {hechuras.length > 0 && (
              <TypeGroupHeader
                label="Hechuras"
                count={hechuras.length}
                subtotal={sumGroupLineCost(hechuras, qtyLine)}
                currency={currency}
                type="HECHURA"
              />
            )}
            <div className="divide-y divide-slate-200/40 dark:divide-slate-700/25">
            {hechuras.map((h: any, idx: number) => {
              const costLineId = h?.costLineId ?? null;
              const isEditable = costLineId != null;
              const ov = costLineId
                ? findCostLineOverride(activeCostLineOverrides, costLineId)
                : undefined;

              // Cantidad del cost line por unidad de artículo. Backend emite
              // `h.quantity` (= step.meta.qty, paridad con PRODUCT/SERVICE).
              // Snapshots viejos sin el campo → fallback a 1 (HECHURA típica).
              const hQuantityRaw = (h as any)?.quantity;
              const hQuantityNum = hQuantityRaw != null && Number.isFinite(Number(hQuantityRaw))
                ? Number(hQuantityRaw)
                : 1;
              const qtyValue = ov?.quantityOverride != null
                ? Number(ov.quantityOverride)
                : hQuantityNum;
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
              const canonicalSale: number | null =
                lineSaleFromBackend != null && Number.isFinite(Number(lineSaleFromBackend))
                  ? Number(lineSaleFromBackend)
                  : hechuraSaleCanonical;
              const hechuraCurrencyInfo = resolveItemCurrencyDisplay(
                {
                  currencyId:    (h as any)?.currencyId    ?? null,
                  currencyCode:  (h as any)?.currencyCode  ?? null,
                  unitValue:     unitValValue,
                  unitValueBase: (h as any)?.unitValueBase ?? null,
                  totalValue:    lineCost,
                  quantity:      qtyValue,
                },
                currency,
                currencyById,
              );
              const { saleForRow, isUnified: isUnifiedSaleRow } =
                resolveSaleForRowDisplay(
                  lineCost,
                  canonicalSale,
                  unifiedFactor,
                  isHechuraMarginUnattributable,
                );
              const commercialCells = buildCommercialCells(
                lineCost,
                saleForRow,
                qtyValue ?? null,
                isHechuraMarginUnattributable,
                unifiedFactor,
              );

              return (
                <Row
                  key={`hechura-${costLineId ?? idx}`}
                  componentType="HECHURA"
                  Icon={Hammer}
                  primary={h?.lineLabel ?? "Hechura"}
                  // FASE 12.7 — sin secondary cierre: el tipo ya está
                  // implícito en el icono. HECHURA típica no tiene metadata
                  // útil adicional. (Si en el futuro hace falta mostrar
                  // categoría / referencia, va acá.)
                  secondary={undefined}
                  commercialView={commercialView}
                  precioUnitVentaText={commercialCells.precioUnitVentaText}
                  margenPctText={commercialCells.margenPctText}
                  margenTone={commercialCells.margenTone}
                  margenTooltip={isUnifiedSaleRow
                    ? "Margen unificado aplicado al total del artículo"
                    : commercialCells.margenTooltip}
                  ventaLineaText={commercialCells.ventaLineaText}
                  globalAdjustmentText={lineGlobalAdj?.text ?? null}
                  globalAdjustmentKind={lineGlobalAdj?.kind ?? null}
                  participacionText={commercialCells.participacionText}
                  // FASE 12.5 — etiquetas para sub-línea Cantidad + prefijo moneda.
                  // FASE 12.5b — preferimos `h.quantityUnit` del snapshot si
                  // existe (HECHURA puede ir en kg, hr, etc.); fallback "Unidades".
                  quantityUnitLabel={(() => {
                    // Display COMERCIAL — preferimos el NOMBRE legible del
                    // catálogo de Units del tenant (ej. "Hora", "Gramo")
                    // sobre el code técnico ("hr", "g"). Cascada:
                    //   1. `unitNameByCode[code]` (catálogo del tenant)
                    //   2. code crudo (legacy/catálogo incompleto)
                    //   3. fallback "Unidad"
                    const code = (h as any)?.quantityUnit;
                    if (code) {
                      const mapped = unitNameByCode?.get(code);
                      if (mapped) return mapped;
                      return code;
                    }
                    return "Unidad";
                  })()}
                  currencyLabel={currency}
                  unitValueCurrencyOverride={hechuraCurrencyInfo?.originalCurrencyLabel ?? null}
                  unitValueSubLine={hechuraCurrencyInfo?.equivalentUnitValue != null
                    ? <>≈ {fmtMoney(hechuraCurrencyInfo.equivalentUnitValue, currency)} / unidad</>
                    : null}
                  quantityCell={
                    <CellNumberInput
                      value={qtyValue}
                      onChange={isEditable && costLineId
                        ? (v) => applyCostLinePatch(costLineId, "HECHURA", { quantityOverride: v ?? 0 })
                        : () => {}}
                      formatType="QUANTITY"
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
                      formatType="MONEY"
                      decimals={2}
                      step={1}
                      readOnly={!isEditable}
                      tooltip={!isEditable ? READ_ONLY_TOOLTIP : undefined}
                      // Fase 2.3.1 — original tachado = BASE pre-ajuste
                      // (h.unitValue), no h.appliedAmount (post-ajuste).
                      original={(h as any)?.unitValue ?? h?.appliedAmount ?? null}
                    />
                  }
                  // FASE 12.12 — HECHURA: AdjustmentLabelEditor (label →
                  // editor en click). currentAmount = lineCost − raw (display).
                  mermaOrAdjustmentCell={
                    <AdjustmentLabelEditor
                      kind={ov?.adjustmentKind ?? null}
                      type={ov?.adjustmentType ?? null}
                      value={ov?.adjustmentValue ?? null}
                      currency={currency}
                      disabled={!isEditable}
                      onChange={(p) => costLineId && applyCostLinePatch(costLineId, "HECHURA", p)}
                      originalKind={(h as any)?.lineAdjKind   ?? null}
                      originalType={(h as any)?.lineAdjType   ?? null}
                      originalValue={(h as any)?.lineAdjValue ?? null}
                      originalAmount={(h as any)?.lineAdjAmount ?? null}
                      currentAmount={
                        lineCost != null && unitValValue != null && qtyValue
                          ? Number(lineCost) - Number(unitValValue) * Number(qtyValue)
                          : null
                      }
                    />
                  }
                  // Costo Total del componente para la línea de factura completa
                  // (= `lineCost × line.quantity`). Display puro — simétrico a
                  // Venta. Antes esta celda dividía `lineCost / qtyValue` para
                  // mostrar "per-unit post-ajuste"; era invisible cuando
                  // HECHURA típica tenía qty=1, pero rompía al rehidratar
                  // cost lines con qty real > 1 (mostraba costo unitario en
                  // lugar de total). El total real es passthrough del motor
                  // multiplicado por la cantidad del documento.
                  saleValueValue={totalForRow(lineCost)}
                  saleValueText={fmt(totalForRow(lineCost))}
                  // FASE 12.10 — Costo de Venta = lineSale (passthrough),
                  // no `lineCost × qty`. Si no hay venta → "—".
                  // Utilidad coherente: venta de LÍNEA (× cantidad), misma
                  // base que `saleValueValue` (costo total × cantidad). Antes
                  // se pasaba `saleForRow` SIN escalar → mezclaba venta
                  // unitaria con costo total y el importe bajo el % se volvía
                  // rojo/negativo al subir la cantidad pese a margen positivo.
                  totalValue={saleForRow != null && qtyValue ? totalForRow(saleForRow) : null}
                  totalText={commercialCells.ventaLineaText}
                  totalTooltip={isUnifiedSaleRow ? "Valor unificado del artículo" : null}
                  manual={!!ov}
                  onResetRow={costLineId ? () => resetCostLine(costLineId) : () => {}}
                  canResetRow={!!ov}
                />
              );
            })}

            </div>
            {/* FASE F7 — Total del grupo HECHURAS. Display only. */}
            {hechuras.length > 0 && (
              <TypeGroupFooter
                label="hechuras"
                costTotal={sumGroupLineCost(hechuras, qtyLine)}
                saleTotal={sumGroupLineSaleDisplay(hechuras, {
                  qtyLine,
                  marginUnattributable: isHechuraMarginUnattributable,
                  unifiedFactor,
                  canonical: hechuraSaleCanonical,
                })}
                currency={currency}
                quantityTotal={sumGroupQuantity(hechuras, (it) => {
                  const r = (it as any)?.quantity;
                  return r != null && Number.isFinite(Number(r)) ? Number(r) : 1;
                })}
                type="HECHURA"
              />
            )}
            {/* ─── PRODUCTOS ───────────────────────────────── */}
            {products.length > 0 && (
              <TypeGroupHeader
                label="Productos"
                count={products.length}
                subtotal={sumGroupLineCost(products, qtyLine)}
                currency={currency}
                type="PRODUCT"
              />
            )}
            <div className="divide-y divide-slate-200/40 dark:divide-slate-700/25">
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
              // FASE 12.7 — secondary sin tipo cierre. SKU/Código + flag
              // "Descuenta stock" si aplica. Tipo "Producto" ya implícito
              // en el icono coloreado.
              const secondary = (skuOrCode || p?.affectsStock === true) ? (
                <span>
                  {skuOrCode && <>{skuOrCode.label}: {skuOrCode.value}</>}
                  {skuOrCode && p?.affectsStock === true && <> · </>}
                  {p?.affectsStock === true && <>Descuenta stock</>}
                </span>
              ) : null;

              // F1.5 #A+ — PRODUCT ahora tiene `lineSale` canónico (passthrough
              // del motor). Sin él (snapshot legacy / margen no derivable) → "—".
              const productLineCost = (p as any)?.totalValue ?? (p as any)?.lineCost ?? null;
              const productLineCostNum: number | null =
                productLineCost != null && Number.isFinite(Number(productLineCost))
                  ? Number(productLineCost)
                  : null;
              const productLineSale = (p as any)?.lineSale;
              const productCanonicalSale: number | null =
                productLineSale != null && Number.isFinite(Number(productLineSale))
                  ? Number(productLineSale)
                  : null;
              const productCurrencyInfo = resolveItemCurrencyDisplay(
                {
                  currencyId:    (p as any)?.currencyId    ?? null,
                  currencyCode:  (p as any)?.currencyCode  ?? null,
                  unitValue:     unitValValue,
                  unitValueBase: (p as any)?.unitValueBase ?? null,
                  totalValue:    productLineCostNum,
                  quantity:      qtyValue,
                },
                currency,
                currencyById,
              );
              const { saleForRow: productSaleForRow, isUnified: isUnifiedSaleRow } =
                resolveSaleForRowDisplay(
                  productLineCostNum,
                  productCanonicalSale,
                  unifiedFactor,
                  // PRODUCT/SERVICE viven en el bucket "hechura" del motor (sus
                  // lineSale derivan de `hechuraSaleFactor`). Mismo flag.
                  isHechuraMarginUnattributable,
                );
              const commercialCells = buildCommercialCells(
                productLineCostNum,
                productSaleForRow,
                qtyValue ?? null,
                isHechuraMarginUnattributable,
                unifiedFactor,
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
                  margenTooltip={isUnifiedSaleRow
                    ? "Margen unificado aplicado al total del artículo"
                    : commercialCells.margenTooltip}
                  ventaLineaText={commercialCells.ventaLineaText}
                  globalAdjustmentText={lineGlobalAdj?.text ?? null}
                  globalAdjustmentKind={lineGlobalAdj?.kind ?? null}
                  participacionText={commercialCells.participacionText}
                  // FASE 12.5 — etiquetas para sub-línea Cantidad + prefijo moneda.
                  // FASE 12.5b — nombre amigable: PRODUCT en unidades por
                  // default (`p.quantityUnit` si el snapshot lo trae).
                  quantityUnitLabel={(() => {
                    // Display COMERCIAL — siempre NOMBRE legible. Cascada:
                    //   1. `unitNameByCode[code]` (nombre del catálogo del tenant)
                    //   2. `quantityUnitName` (Article maestro referenciado)
                    //   3. code crudo (legacy/catálogo incompleto)
                    //   4. fallback "Unidad"
                    const code = (p as any)?.quantityUnit;
                    if (code) {
                      const mapped = unitNameByCode?.get(code);
                      if (mapped) return mapped;
                    }
                    const masterName = (p as any)?.quantityUnitName;
                    if (masterName) return masterName;
                    if (code) return code;
                    return "Unidad";
                  })()}
                  currencyLabel={currency}
                  unitValueCurrencyOverride={productCurrencyInfo?.originalCurrencyLabel ?? null}
                  unitValueSubLine={productCurrencyInfo?.equivalentUnitValue != null
                    ? <>≈ {fmtMoney(productCurrencyInfo.equivalentUnitValue, currency)} / unidad</>
                    : null}
                  quantityCell={
                    <CellNumberInput
                      value={qtyValue}
                      onChange={isEditable && costLineId
                        ? (v) => applyCostLinePatch(costLineId, "PRODUCT", { quantityOverride: v ?? 0 })
                        : () => {}}
                      formatType="QUANTITY"
                      decimals={2}
                      // Cantidad PRODUCT: step entero (1,00) — paridad con
                      // HECHURA. METAL conserva su step (gramos).
                      step={1}
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
                      formatType="MONEY"
                      decimals={2}
                      step={1}
                      readOnly={!isEditable}
                      tooltip={!isEditable ? READ_ONLY_TOOLTIP : undefined}
                      original={p?.unitValue ?? null}
                    />
                  }
                  // FASE 12.12 — PRODUCT: AdjustmentLabelEditor (label-style).
                  mermaOrAdjustmentCell={
                    <AdjustmentLabelEditor
                      kind={ov?.adjustmentKind ?? null}
                      type={ov?.adjustmentType ?? null}
                      value={ov?.adjustmentValue ?? null}
                      currency={currency}
                      disabled={!isEditable}
                      onChange={(patch) => costLineId && applyCostLinePatch(costLineId, "PRODUCT", patch)}
                      originalKind={p?.lineAdjKind   ?? null}
                      originalType={p?.lineAdjType   ?? null}
                      originalValue={p?.lineAdjValue ?? null}
                      originalAmount={p?.lineAdjAmount ?? null}
                      currentAmount={
                        lineCost != null && unitValValue != null && qtyValue
                          ? Number(lineCost) - Number(unitValValue) * Number(qtyValue)
                          : null
                      }
                    />
                  }
                  // Costo Total = `lineCost × line.quantity` (display).
                  // Mismo criterio que HECHURA — ver comentario allí.
                  saleValueValue={totalForRow(lineCost)}
                  saleValueText={fmt(totalForRow(lineCost))}
                  // FASE 12.10 — PRODUCT: Costo de Venta = productSaleForRow.
                  // Ver nota en METAL/HECHURA: venta de línea escalada × qty.
                  totalValue={productSaleForRow != null && qtyValue ? totalForRow(productSaleForRow) : null}
                  totalText={commercialCells.ventaLineaText}
                  totalTooltip={isUnifiedSaleRow ? "Valor unificado del artículo" : null}
                  manual={!!ov}
                  onResetRow={costLineId ? () => resetCostLine(costLineId) : () => {}}
                  canResetRow={!!ov}
                />
              );
            })}

            </div>
            {/* FASE F7 — Total del grupo PRODUCTOS. Display only. */}
            {products.length > 0 && (
              <TypeGroupFooter
                label="productos"
                costTotal={sumGroupLineCost(products, qtyLine)}
                saleTotal={sumGroupLineSaleDisplay(products, {
                  qtyLine,
                  marginUnattributable: isHechuraMarginUnattributable,
                  unifiedFactor,
                })}
                currency={currency}
                quantityTotal={sumGroupQuantity(products, (it) =>
                  it?.quantity != null && Number.isFinite(Number(it.quantity))
                    ? Number(it.quantity)
                    : 0,
                )}
                type="PRODUCT"
              />
            )}
            {/* ─── SERVICIOS ───────────────────────────────── */}
            {services.length > 0 && (
              <TypeGroupHeader
                label="Servicios"
                count={services.length}
                subtotal={sumGroupLineCost(services, qtyLine)}
                currency={currency}
                type="SERVICE"
              />
            )}
            <div className="divide-y divide-slate-200/40 dark:divide-slate-700/25">
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
              // FASE 12.7 — secondary sin tipo cierre. Solo SKU/Código.
              const secondary = skuOrCode ? (
                <span>{skuOrCode.label}: {skuOrCode.value}</span>
              ) : null;

              // F1.5 #A+ — SERVICE ahora tiene `lineSale` canónico (passthrough
              // del motor). Sin él → "—".
              const serviceLineCost = (s as any)?.totalValue ?? (s as any)?.lineCost ?? null;
              const serviceLineCostNum: number | null =
                serviceLineCost != null && Number.isFinite(Number(serviceLineCost))
                  ? Number(serviceLineCost)
                  : null;
              const serviceLineSale = (s as any)?.lineSale;
              const serviceCanonicalSale: number | null =
                serviceLineSale != null && Number.isFinite(Number(serviceLineSale))
                  ? Number(serviceLineSale)
                  : null;
              const serviceCurrencyInfo = resolveItemCurrencyDisplay(
                {
                  currencyId:    (s as any)?.currencyId    ?? null,
                  currencyCode:  (s as any)?.currencyCode  ?? null,
                  unitValue:     unitValValue,
                  unitValueBase: (s as any)?.unitValueBase ?? null,
                  totalValue:    serviceLineCostNum,
                  quantity:      qtyValue,
                },
                currency,
                currencyById,
              );
              const { saleForRow: serviceSaleForRow, isUnified: isUnifiedSaleRow } =
                resolveSaleForRowDisplay(
                  serviceLineCostNum,
                  serviceCanonicalSale,
                  unifiedFactor,
                  // PRODUCT/SERVICE viven en el bucket "hechura" del motor (sus
                  // lineSale derivan de `hechuraSaleFactor`). Mismo flag.
                  isHechuraMarginUnattributable,
                );
              const commercialCells = buildCommercialCells(
                serviceLineCostNum,
                serviceSaleForRow,
                qtyValue ?? null,
                isHechuraMarginUnattributable,
                unifiedFactor,
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
                  margenTooltip={isUnifiedSaleRow
                    ? "Margen unificado aplicado al total del artículo"
                    : commercialCells.margenTooltip}
                  ventaLineaText={commercialCells.ventaLineaText}
                  globalAdjustmentText={lineGlobalAdj?.text ?? null}
                  globalAdjustmentKind={lineGlobalAdj?.kind ?? null}
                  participacionText={commercialCells.participacionText}
                  // FASE 12.5 — etiquetas para sub-línea Cantidad + prefijo moneda.
                  // FASE 12.5b — SERVICE: igual que PRODUCT.
                  quantityUnitLabel={(() => {
                    // Mismo criterio que PRODUCT — display COMERCIAL, NOMBRE
                    // legible siempre primero. Cascada:
                    //   1. `unitNameByCode[code]` (catálogo del tenant)
                    //   2. `quantityUnitName` (Article maestro)
                    //   3. code crudo (fallback legacy)
                    //   4. "Unidad"
                    const code = (s as any)?.quantityUnit;
                    if (code) {
                      const mapped = unitNameByCode?.get(code);
                      if (mapped) return mapped;
                    }
                    const masterName = (s as any)?.quantityUnitName;
                    if (masterName) return masterName;
                    if (code) return code;
                    return "Unidad";
                  })()}
                  currencyLabel={currency}
                  unitValueCurrencyOverride={serviceCurrencyInfo?.originalCurrencyLabel ?? null}
                  unitValueSubLine={serviceCurrencyInfo?.equivalentUnitValue != null
                    ? <>≈ {fmtMoney(serviceCurrencyInfo.equivalentUnitValue, currency)} / unidad</>
                    : null}
                  quantityCell={
                    <CellNumberInput
                      value={qtyValue}
                      onChange={isEditable && costLineId
                        ? (v) => applyCostLinePatch(costLineId, "SERVICE", { quantityOverride: v ?? 0 })
                        : () => {}}
                      formatType="QUANTITY"
                      decimals={2}
                      // Cantidad SERVICE: step entero (1,00) — paridad con
                      // HECHURA. METAL conserva su step (gramos).
                      step={1}
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
                      formatType="MONEY"
                      decimals={2}
                      step={1}
                      readOnly={!isEditable}
                      tooltip={!isEditable ? READ_ONLY_TOOLTIP : undefined}
                      original={s?.unitValue ?? null}
                    />
                  }
                  // FASE 12.12 — SERVICE: AdjustmentLabelEditor (label-style).
                  mermaOrAdjustmentCell={
                    <AdjustmentLabelEditor
                      kind={ov?.adjustmentKind ?? null}
                      type={ov?.adjustmentType ?? null}
                      value={ov?.adjustmentValue ?? null}
                      currency={currency}
                      disabled={!isEditable}
                      onChange={(patch) => costLineId && applyCostLinePatch(costLineId, "SERVICE", patch)}
                      originalKind={s?.lineAdjKind   ?? null}
                      originalType={s?.lineAdjType   ?? null}
                      originalValue={s?.lineAdjValue ?? null}
                      originalAmount={s?.lineAdjAmount ?? null}
                      currentAmount={
                        lineCost != null && unitValValue != null && qtyValue
                          ? Number(lineCost) - Number(unitValValue) * Number(qtyValue)
                          : null
                      }
                    />
                  }
                  // Costo Total = `lineCost × line.quantity` (display).
                  // Mismo criterio que HECHURA — ver comentario allí.
                  saleValueValue={totalForRow(lineCost)}
                  saleValueText={fmt(totalForRow(lineCost))}
                  // FASE 12.10 — SERVICE: Costo de Venta = serviceSaleForRow.
                  // Ver nota en METAL/HECHURA: venta de línea escalada × qty.
                  totalValue={serviceSaleForRow != null && qtyValue ? totalForRow(serviceSaleForRow) : null}
                  totalText={commercialCells.ventaLineaText}
                  totalTooltip={isUnifiedSaleRow ? "Valor unificado del artículo" : null}
                  manual={!!ov}
                  onResetRow={costLineId ? () => resetCostLine(costLineId) : () => {}}
                  canResetRow={!!ov}
                />
              );
            })}
            </div>
            {/* FASE F7 — Total del grupo SERVICIOS. Display only. */}
            {services.length > 0 && (
              <TypeGroupFooter
                label="servicios"
                costTotal={sumGroupLineCost(services, qtyLine)}
                saleTotal={sumGroupLineSaleDisplay(services, {
                  qtyLine,
                  marginUnattributable: isHechuraMarginUnattributable,
                  unifiedFactor,
                })}
                currency={currency}
                quantityTotal={sumGroupQuantity(services, (it) =>
                  it?.quantity != null && Number.isFinite(Number(it.quantity))
                    ? Number(it.quantity)
                    : 0,
                )}
                type="SERVICE"
              />
            )}
          </div>
          </div>
        </div>
      )}

      {/* FASE F7 — Removido el bloque "Flujo de construcción del precio"
          (`<PriceFlowCards>`) de la Factura de Ventas: la composición de
          costo ya muestra el desglose por grupo con totales (FASE F7) y
          los cards de Rentabilidad / Impacto / Costo base eran
          duplicación visual + ruido para el operador. El componente
          `PriceFlowCards` se mantiene en el árbol del repo por si otra
          pantalla lo necesita; acá no se renderea. */}

      {/* FASE F20 — Sección compacta de detalle del Ajuste Global, debajo
          de todos los grupos (METALES / HECHURAS / PRODUCTOS / SERVICIOS).
          Display only — pasa por `composition.costAdjustment` + el
          `totalComponents` calculado arriba (mismo monto que "Valor de
          costo" del header). Si no hay ajuste, no renderea. */}
      <CostAdjustmentDetailSection
        data={(meta as any)?.composition?.costAdjustment ?? null}
        costTotalFinal={showTotalSum ? totalComponents : null}
        currency={currency}
      />

      {/* ── Bloque de ajustes globales (canal/cupón/envío) — fuera del flujo
            principal porque son ajustes doc-level, no de costo del artículo ── */}
      {globalAdjustments && (
        <GlobalAdjustmentsBlock data={globalAdjustments} currency={currency} />
      )}
    </div>
    </TableLayoutContext.Provider>
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
        value={marginPercent != null ? `${formatByType(marginPercent, "MARGIN_PERCENT", { bare: true })}%` : "—"}
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
