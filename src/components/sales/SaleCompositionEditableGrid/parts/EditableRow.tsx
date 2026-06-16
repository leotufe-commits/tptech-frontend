// src/components/sales/SaleCompositionEditableGrid/parts/EditableRow.tsx
// =============================================================================
// Una fila de la grilla. Diseño data-driven — la lógica de qué celdas
// editan/no editan vive en el caller (composeRowProps).
//
// Extraído del monolito sin cambios. Contiene `RowImpl` (componente puro
// presentacional polimórfico por tipo de componente — METAL/HECHURA/PRODUCT/
// SERVICE) + el wrapper `Row = React.memo(RowImpl, comparator)`.
//
// Fase 4.4 — React.memo(Row) con comparator estable.
// Estrategia conservadora: comparamos los datos PRIMITIVOS que controlan
// el render (componentType, manual, canResetRow, saleValueValue,
// totalValue, saleValueText, totalText). Los ReactNode (cells/primary/
// secondary) son funciones puras de los primitivos que el caller deriva,
// por lo tanto si los primitivos no cambiaron el JSX renderizado es
// equivalente — saltar el render es seguro.
// =============================================================================

import React from "react";
import { RotateCcw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../../ui/tp";
import {
  COMPONENT_TYPE_BADGE,
  type ComponentTypeKey,
} from "../../../../lib/pricing/component-type-colors";
import {
  formatByType,
  formatMoneyDoc as fmtMoney,
} from "../../../../lib/pricing/format";
import { TABLE_COLS_CLS } from "../constants";
import { TableLayoutContext } from "../context";
import { useFlashOnChange } from "../hooks/useFlashOnChange";

function RowImpl({
  componentType, Icon, primary, secondary,
  quantityCell, unitValueCell, mermaOrAdjustmentCell,
  unitValueCurrencyOverride, unitValueSubLine,
  saleValueValue, saleValueText, totalValue, totalText, totalTooltip,
  marginSaleValueOverride,
  manual, onResetRow, canResetRow,
  commercialView,
  precioUnitVentaText, margenPctText, margenTone, margenTooltip,
  ventaLineaText, participacionText,
  quantityUnitLabel, currencyLabel,
  globalCost,
  formulaQuantity, formulaCostUnit, formulaSaleUnit,
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
  /** Venta a usar SOLO para el monto monetario del margen (utilidad), cuando
   *  difiere de `totalValue` (la columna Venta total). Caso combo de un
   *  componente: Venta total muestra `finalPrice`, pero el margen va contra la
   *  venta de composición/lista (margen comercial real). `null` ⇒ se usa
   *  `totalValue` (comportamiento normal de todas las demás filas). */
  marginSaleValueOverride?: number | null;
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
  /** Desglose visual del ajuste global del artículo sobre el COSTO de esta
   *  fila — DISPLAY de composición (NO motor). El principal de la celda Costo
   *  total (`saleValueText`) es el costo BASE; debajo se muestra
   *  "±pct% GLOBAL", "±$impact" y el costo FINAL. `pct` = % del ajuste;
   *  `impact`/`after` = base·% y base±impacto (del helper). `null` ⇒ la celda
   *  muestra solo el costo, sin desglose. */
  globalCost?: { pct: number; impact: number; after: number; kind: "BONUS" | "SURCHARGE" } | null;
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
  /**
   * Datos numéricos para mostrar la fórmula "qty × valor unitario" debajo
   * de los totales (Costo total / Venta total) cuando la cantidad de la
   * línea es > 1. Display-only — el `totalText` y `saleValueText` siguen
   * siendo los números autorizados por el motor; la fórmula es ayuda
   * secundaria para que el operador entienda de dónde sale el total.
   *
   *   · `formulaQuantity`: line.quantity (también soporta gramos en METAL).
   *   · `formulaCostUnit`: valor unitario de costo (lo que se multiplica
   *     para llegar al Costo total).
   *   · `formulaSaleUnit`: valor unitario de venta (lo que se multiplica
   *     para llegar a la Venta total).
   *
   * Cuando `formulaQuantity <= 1` (vista simple) o cualquiera de los
   * unitarios es `null`/`0`, la subline NO se renderea — la UI cae a
   * mostrar solo el total. */
  formulaQuantity?: number | null;
  formulaCostUnit?: number | null;
  formulaSaleUnit?: number | null;
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

  // Props que siguen llegando para no romper la API del Row ni los memos,
  // pero que ya no se renderean directamente (FASE 12.4 / FASE 12.2). El
  // comparator del memo abajo sí las consume vía `prev.X`/`next.X`. Mismo
  // patrón `void X` que usa el código original para silenciar TS6133.
  void commercialView;
  void precioUnitVentaText;
  void margenTone;
  void ventaLineaText;
  void participacionText;

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
      {/* FASE F23/F24 — Celda COSTO TOTAL. Principal = costo POST ajuste global
          del artículo (cuando existe `globalCost`); si no, el costo de
          composición de siempre (`saleValueText`). Debajo, el impacto global
          como subdetalle "±$ GLOBAL". Display de composición/costo (el costo ya
          viene del motor; acá solo se muestra el resultado del % aplicado). El
          bloque "AJUSTE GLOBAL" inferior sigue como resumen consolidado, y la
          columna Margen NO usa este valor (usa el costo base + venta de lista). */}
      <div className="text-center leading-tight">
        <div
          className={cn(
            // Total en font-bold para que tenga peso visual claro frente a
            // la fórmula auxiliar que va debajo (muted, más pequeña).
            "tabular-nums font-bold text-text rounded transition-colors duration-500 px-1",
            flashSale,
          )}
        >
          {globalCost
            ? fmtMoney(globalCost.after, currencyLabel)
            : (saleValueText ?? "—")}
        </div>
        {/* Fórmula auxiliar "qty × valor unitario" — solo cuando hay más de
            una unidad/gramo y el motor proveyó ambos números. Texto chico y
            muted, no compite visualmente con el total. POLICY R6 —
            display-only, NO recalcula el total (que ya viene de `saleValueText`
            del motor). */}
        {formulaQuantity != null && formulaQuantity > 1 &&
         formulaCostUnit != null && formulaCostUnit > 0 && (
          <div
            data-tp-cost-total-formula="true"
            className="text-[9px] tabular-nums leading-tight text-muted/65"
            title="Cantidad × valor unitario — fórmula informativa del Costo total"
          >
            {formatByType(formulaQuantity, "QUANTITY", { bare: true })}
            {quantityUnitLabel ? ` ${quantityUnitLabel}` : ""}
            <span className="mx-1 text-muted/45">×</span>
            <span>{fmtMoney(formulaCostUnit)}</span>
          </div>
        )}
        {/* Subdetalle del ajuste global del artículo sobre el costo (display de
            composición): "±$impacto GLOBAL". Verde (bonificación) / naranja
            (recargo). El principal de arriba ya es el costo POST. */}
        {globalCost && (
          <div
            data-tp-global-cost-impact="true"
            className={cn(
              "text-[9px] tabular-nums leading-tight font-medium",
              globalCost.kind === "SURCHARGE"
                ? "text-amber-600/85 dark:text-amber-400/85"
                : "text-emerald-600/80 dark:text-emerald-400/80",
            )}
            title="Ajuste global del artículo aplicado sobre el costo (display de composición; el principal ya es el costo POST)"
          >
            {globalCost.kind === "SURCHARGE" ? "+" : "−"}
            {fmtMoney(Math.abs(globalCost.impact), currencyLabel)}{" "}
            <span className="font-semibold tracking-wide text-muted/70">GLOBAL</span>
            {/* % del ajuste global entre paréntesis — unificado acá desde la
                columna "Merma / Ajuste" (UX 2026-06-13): una sola lectura
                "monto + origen + porcentaje". `pct` ya viene en el prop
                `globalCost` (passthrough); no se recalcula. Formato config-aware
                (PERCENT), mismo que usaba el badge removido. */}
            {globalCost.pct != null && Number.isFinite(globalCost.pct) && (
              <span className="text-muted/70">
                {" ("}{globalCost.kind === "SURCHARGE" ? "+" : "−"}
                {formatByType(Math.abs(globalCost.pct), "PERCENT", { bare: true })}{"%)"}
              </span>
            )}
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
          // UTILIDAD de línea = Venta de margen − Costo total de línea.
          // `saleValueValue` = costo total línea (BASE de composición).
          //
          // ⚠️ CONTRATO DE COLUMNAS INDEPENDIENTES (NO romper):
          // El margen se calcula SIEMPRE contra el costo BASE (`saleValueValue`),
          // NUNCA contra el costo POST-ajuste-global (`globalCost.after`) ni
          // contra el `finalPrice`. La tabla NO debe cerrar
          // `Costo total + Margen = Venta total`: cada columna comunica un
          // concepto distinto (costo post-global / margen de lista / venta final).
          // No "arreglar" esto restando el costo POST — rompería el margen real.
          // Guard: SaleCompositionEditableGrid.test.tsx → "Contrato de columnas
          // independientes". Detalle: README "Contrato de columnas independientes".
          //
          // La VENTA usada para el margen es normalmente `totalValue` (= Venta
          // total de la fila). EXCEPCIÓN: cuando el caller pasa
          // `marginSaleValueOverride` (combo de un componente), la columna Venta
          // total muestra el `finalPrice` del combo, pero el MARGEN va contra la
          // venta de COMPOSICIÓN/lista (margen comercial real) — ese override es
          // esa venta. Display puro: solo resta dos valores del motor.
          const marginSaleValue =
            marginSaleValueOverride != null && Number.isFinite(marginSaleValueOverride)
              ? Number(marginSaleValueOverride)
              : (totalValue != null && Number.isFinite(totalValue) ? Number(totalValue) : null);
          if (
            saleValueValue == null || marginSaleValue == null ||
            !Number.isFinite(saleValueValue)
          ) return null;
          const utilidad = marginSaleValue - Number(saleValueValue);
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
      <div className="text-center leading-tight">
        <div
          className={cn(
            // Total en font-bold para mantener jerarquía visual con la
            // fórmula auxiliar que va debajo. `text-center` se conserva
            // INLINE además del padre para que el contrato visual histórico
            // (tests legacy + scanners) siga sosteniéndose.
            "text-center tabular-nums font-bold text-emerald-600 dark:text-emerald-400 rounded transition-colors duration-500 px-1",
            flashTotal,
            totalTooltip && totalText != null && "cursor-help",
          )}
          title={totalTooltip ?? undefined}
          data-sale-source={totalTooltip ? "unified" : "line"}
        >
          {totalText ?? "—"}
        </div>
        {/* Fórmula auxiliar de la Venta total: "qty × valor unitario de venta". */}
        {formulaQuantity != null && formulaQuantity > 1 &&
         formulaSaleUnit != null && formulaSaleUnit > 0 && (
          <div
            data-tp-sale-total-formula="true"
            className="text-[9px] tabular-nums leading-tight text-muted/65"
            title="Cantidad × valor unitario — fórmula informativa de la Venta total"
          >
            {formatByType(formulaQuantity, "QUANTITY", { bare: true })}
            {quantityUnitLabel ? ` ${quantityUnitLabel}` : ""}
            <span className="mx-1 text-muted/45">×</span>
            <span>{fmtMoney(formulaSaleUnit)}</span>
          </div>
        )}
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

export const Row = React.memo(RowImpl, (prev, next) => {
  if (prev.componentType   !== next.componentType)   return false;
  if (prev.manual          !== next.manual)          return false;
  if (prev.canResetRow     !== next.canResetRow)     return false;
  if (prev.saleValueValue  !== next.saleValueValue)  return false;
  if (prev.totalValue      !== next.totalValue)      return false;
  if (prev.marginSaleValueOverride !== next.marginSaleValueOverride) return false;
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
  // Props de fórmula auxiliar — incluidas en el comparador para que el
  // recompute se dispare cuando cambian (qty editado, unitario actualizado).
  if (prev.formulaQuantity     !== next.formulaQuantity)     return false;
  if (prev.formulaCostUnit     !== next.formulaCostUnit)     return false;
  if (prev.formulaSaleUnit     !== next.formulaSaleUnit)     return false;
  // P1 #7 (Etapa E2) — primitivas de display que SÍ afectan el render
  // pero faltaban en el comparator. Sin estas comparaciones, cambios
  // en la moneda del documento (`currencyLabel`) o la unidad del catálogo
  // (`quantityUnitLabel`) no propagaban porque el resto de props eran
  // estables. Son strings cortas: la comparación referencial alcanza.
  if (prev.quantityUnitLabel    !== next.quantityUnitLabel)    return false;
  if (prev.currencyLabel        !== next.currencyLabel)        return false;
  // Desglose del ajuste global sobre el costo — objeto nuevo por render;
  // comparamos campos para no romper el memo ni perder updates.
  if ((prev.globalCost?.pct    ?? null) !== (next.globalCost?.pct    ?? null)) return false;
  if ((prev.globalCost?.impact ?? null) !== (next.globalCost?.impact ?? null)) return false;
  if ((prev.globalCost?.after  ?? null) !== (next.globalCost?.after  ?? null)) return false;
  if ((prev.globalCost?.kind   ?? null) !== (next.globalCost?.kind   ?? null)) return false;
  // primary / secondary / *Cell son JSX nodes derivados de los primitivos
  // del caller. Asumimos pure-derivation y skipeamos.
  return true;
});
