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
import {
  RotateCcw, X as XIcon, ChevronDown, ChevronRight,
  // F1.3 G4.x #10-C — iconos por grupo (mockup ERP financiero).
  Gem, Hammer, Package, Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import TPNumberInput from "./TPNumberInput";
import { cn } from "./tp";
import { fmtMoney } from "../../lib/document-helpers";
import type { DocumentLine } from "../../lib/document-types";
import {
  groupCompositionItems,
  safeSumNumbers,
  VARIES,
} from "../../lib/pricing/grouping";
// F1.4 G5 #11-D — helper puro para reconstruir el array de overrides
// al editar una celda. Indexación por costLineId, cero mutación.
import {
  patchCostLineOverride,
  findCostLineOverride,
} from "../../lib/pricing/cost-line-overrides";
import type { CostLineOverride } from "../../services/sales";
// F1.3 G4.x #10-D — colores semánticos importados de fuente única
// (consistencia visual cross-TPTech, mismo mapping que CostRow del Simulador).
import {
  COMPONENT_TYPE_BADGE,
  type ComponentTypeKey,
} from "../../lib/pricing/component-type-colors";

export type AppliesTo = "TOTAL" | "METAL" | "HECHURA" | "METAL_Y_HECHURA" | "SUBTOTAL_AFTER_DISCOUNT" | "SUBTOTAL_BEFORE_DISCOUNT" | "PRODUCT" | "SERVICE";

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
  /**
   * Orientación del panel:
   *   · "cost" (default): foco en costos del artículo (Compras, vista
   *     legacy de documentos). El resumen muestra Costo total como
   *     valor principal junto a Precio de venta y Margen.
   *   · "sale": foco en composición del precio de venta (Factura). Cada
   *     bloque (Metal / Hechura) agrega la fila "Valor venta" leída de
   *     `pricingMeta.metalSale` / `pricingMeta.hechuraSale` (passthrough
   *     del motor — el frontend NO calcula). El resumen reorganiza:
   *     "Precio de venta" como principal, "Costo interno" y "Margen"
   *     como rentabilidad secundaria.
   * Default `cost` preserva el comportamiento de Presupuestos / Órdenes
   * / Compras que comparten este editor.
   */
  view?: "sale" | "cost";
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
  view = "cost",
}: LineAdvancedOverridesPanelProps) {
  const isSaleView = view === "sale";
  const meta = line.pricingMeta ?? {};
  const composition = meta.composition ?? null;

  // F1.3 G4.1 #8b — products[] / services[] son arrays. Reader-only
  // (POLICY R4.5): el panel los lee y muestra; cero recálculo. Defaults
  // seguros para snapshots viejos (v3) que no traen el campo.
  const products = composition?.products ?? [];
  const services = composition?.services ?? [];

  // F1.3 G4.x #10-B — agrupación visual via helper puro (lib/pricing/grouping).
  // Cero matemática derivada en el componente (POLICY R4.5):
  //   · METAL agrupado por metalVariantId (con merma "varies" si difiere).
  //   · HECHURA / PRODUCT / SERVICE quedan en lista plana + agregado.
  // Header de cada grupo muestra count + total agregado (Decimal-safe).
  // Default expandido cuando count cost-lines === 1; colapsado si 2+.
  //
  // F1.3 G4.x #10-E — fallback legacy: si el snapshot es v4 (sin
  // metals[]/hechuras[]) pero tiene los alias `metal`/`hechura`,
  // sintetizamos un item virtual desde el alias para que el accordion
  // muestre count: 1 (no count: 0). Cero matemática nueva — solo mapeo
  // estructural del alias al shape del item.
  const rawMetals   = composition?.metals   ?? [];
  const rawHechuras = composition?.hechuras ?? [];
  const metalItems = rawMetals.length > 0
    ? rawMetals
    : (composition?.metal ? [{
        costLineId:      null,
        metalVariantId:  composition.metal.appliedVariantId ?? composition.metal.originalVariantId ?? null,
        metalName:       composition.metal.metalName  ?? null,
        purity:          composition.metal.purity     ?? null,
        purityLabel:     composition.metal.purityLabel ?? null,
        appliedGrams:    composition.metal.appliedGrams    ?? null,
        appliedMermaPct: composition.metal.appliedMermaPct ?? null,
        lineCost:        null,   // legacy alias no expone lineCost
      }] : []);
  const hechuraItems = rawHechuras.length > 0
    ? rawHechuras
    : (composition?.hechura ? [{
        costLineId:    null,
        appliedAmount: composition.hechura.appliedAmount ?? null,
        lineCost:      null,
        lineLabel:     null,
      }] : []);
  const productItems = composition?.products ?? [];
  const serviceItems = composition?.services ?? [];
  const grouped = groupCompositionItems({
    metals:   metalItems,
    hechuras: hechuraItems,
    products: productItems,
    services: serviceItems,
  });
  // Cantidad TOTAL de cost lines de metal (suma de count de todos los grupos).
  // Con el fallback legacy de `metalItems`, este conteo ya incluye al item
  // virtual sintetizado del alias.
  const metalLineCount   = grouped.metals.reduce((acc, g) => acc + g.count, 0);
  const hechuraLineCount = hechuraItems.length;
  // Total de gramos físicos (Σ totalAppliedGrams de todos los grupos).
  const metalTotalGrams = safeSumNumbers(grouped.metals.map(g => g.totalAppliedGrams));
  // Total de costo monetario por sumatoria.
  const metalTotalLineCost = safeSumNumbers(grouped.metals.map(g => g.totalLineCost));
  // Editor inline de gramos/merma sigue siendo SOLO cuando hay 1 line en
  // total (D1 confirmado). El editor mapea al primer cost line via
  // costOverrideContext del backend; con múltiples lines la edición grupal
  // requiere group overrides (Fase B futura, NO en MVP).
  const metalEditableInline   = metalLineCount   === 1 && !!composition?.metal;
  const hechuraEditableInline = hechuraLineCount === 1 && !!composition?.hechura;

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

  // ── F1.4 G5 #11-D — patch helper indexado por costLineId ─────────────────
  // Reconstruye el array completo de costLineOverrides aplicando un patch
  // sobre la entry correspondiente al costLineId. Cero mutación, cero
  // matemática. Dispara onApply con el array nuevo — el caller (parent)
  // pone el array en pricingMeta y el preview backend recalcula.
  //
  // El array activo se lee desde pricingMeta.costLineOverrides (intent
  // del usuario, mutable) o, si está vacío, costLineOverridesApplied
  // (eco del backend). Esto evita stale state: cualquier preview
  // backend devuelve costLineOverridesApplied que el frontend usa como
  // estado inicial hasta que el usuario edite y emita un nuevo array.
  const activeCostLineOverrides: CostLineOverride[] = (() => {
    const intent = (meta as any).costLineOverrides;
    if (Array.isArray(intent) && intent.length > 0) return intent as CostLineOverride[];
    const applied = (meta as any).costLineOverridesApplied;
    if (Array.isArray(applied)) return applied as CostLineOverride[];
    return [];
  })();
  function applyCostLinePatch(
    costLineId: string,
    type: CostLineOverride["type"],
    patch: Partial<Omit<CostLineOverride, "costLineId" | "type">>,
  ) {
    const next = patchCostLineOverride(activeCostLineOverrides, costLineId, type, patch);
    // onApply acepta `costLineOverrides` (extendido en pricingMeta).
    onApply({ costLineOverrides: next } as any);
  }

  // ── Detección de overrides activos (chip / botón Restaurar) ──────────────
  // F1.4 #11-E.2 — incluye costLineOverrides en la detección. Si hay
  // ediciones per costLineId activas, el botón Restaurar aparece
  // y `handleClearAll` los limpia junto con los legacy.
  const hasOverrides = !!(
    grams.manual ||
    merma.manual ||
    hechura.manual ||
    meta.metalVariantIdOverride ||
    activeCostLineOverrides.length > 0
  );

  function handleClearAll() {
    grams.setValue(origGrams);
    merma.setValue(origMermaPct);
    hechura.setValue(origHechura);
    // F1.4 #11-E.2 — limpiar también el array de costLineOverrides.
    // Pasamos array vacío explícito (cuando es undefined no triggea
    // refetch). El backend recalculará sin overrides per costLineId.
    onApply({ costLineOverrides: [] } as any);
    onClear?.();
  }

  // ── Datos derivados para Metal ───────────────────────────────────────────
  const metalVariantLabel =
    composition?.metal?.metalName ||
    composition?.metal?.purityLabel ||
    null;
  const purityValue = composition?.metal?.purity ?? null;

  // F1.3 G4.x #10-B — además de metal/hechura legacy, considerar products/
  // services para decidir si mostrar la sección. Antes el panel se ocultaba
  // si el artículo solo tenía PRODUCT/SERVICE sin metal ni hechura.
  const showAny = !!(
    composition?.metal ||
    composition?.hechura ||
    (composition?.products?.length ?? 0) > 0 ||
    (composition?.services?.length ?? 0) > 0 ||
    (composition?.metals?.length   ?? 0) > 0 ||
    (composition?.hechuras?.length ?? 0) > 0
  );

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
  // ── Ganancia $ (mismo nivel de derivación que margin %) ──────────────────
  // = salePrice (neto sin impuestos) − costTotal. Resta de 2 campos ya en
  // scope. Si costo o precio faltan → null. Si negativa → tono rojo.
  // POLICY: misma justificación que margin% (línea 197 — "frontend simple").
  const gananciaTotal: number | null =
    costTotal != null && salePrice != null
      ? salePrice - costTotal
      : null;
  const gananciaToneClass =
    gananciaTotal == null
      ? "text-muted/60"
      : gananciaTotal < 0
        ? "text-red-500"
        : "text-text";
  const showSummary = salePrice != null;
  // Margen oculto si precio = 0 (o sin precio).
  const showMargin = salePrice != null && salePrice > 0;

  // ── Bonificación de Hechura para el summary colapsado ────────────────────
  // El componente `BonifValue` mantiene su valor en state local (con debounce
  // al backend), pero el header del accordion necesita el valor actual
  // persistido en `pricingMeta.manualDiscount`. Replicamos exactamente la
  // misma lectura que hace `BonifValue` (line.pricingMeta.manualDiscount con
  // mode=PERCENT y appliesTo=HECHURA) para que el resumen muestre el % real
  // entre debounces. NO duplica lógica de cálculo — solo lee el override
  // ya resuelto por el motor. */
  const hechuraBonifMd  = meta.manualDiscount ?? null;
  const hechuraBonifPct = (
    hechuraBonifMd &&
    (hechuraBonifMd.appliesTo ?? "TOTAL") === "HECHURA" &&
    hechuraBonifMd.mode === "PERCENT"
  )
    ? hechuraBonifMd.value
    : 0;

  return (
    <div className="space-y-2">
      {/* ── Header secundario, sin protagonismo. ─────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted/80">
          {isSaleView ? "Composición del precio de venta" : "Composición del precio"}
          {!isSaleView && (
            <span className="ml-1 normal-case text-muted/60">— costos del artículo</span>
          )}
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

      {/* ── Cuerpo de la composición ─────────────────────────────────────
          Dos vistas separadas:
            · isSaleView (Factura): stack vertical Metal → Hechura →
              Rentabilidad → Precio venta. Cada sección tiene una fila
              horizontal compacta con varios "label: value" (`InfoLineRow`)
              y, cuando aplica, una sub-grilla de inputs de 2 columnas.
              Densidad alta, sin grids anchos con espacio vacío.
            · cost (Presupuestos/Órdenes/Compras): bloques verticales
              tradicionales + summary de 3 cols. Sin cambios. */}
      {showAny ? (
        isSaleView ? (
          /* Separador entre secciones (Metal · Hechura · Rentabilidad ·
             Precio venta): cada hijo no-primero recibe `mt-2 pt-2 border-t`
             via selector de hermanos (`[&>*+*]:`). El divisor queda
             centrado entre las secciones con espacio simétrico arriba y
             abajo, sin afectar al primer hijo ni al último. */
          <div className="flex flex-col [&>*+*]:mt-2 [&>*+*]:border-t [&>*+*]:border-border/30 [&>*+*]:pt-2">
            {/* F1.3 G4.x #10-F — TABLA ERP UNIFICADA.
                Reemplaza los 4 accordions independientes por:
                  · Resumen-chips arriba con totales por tipo + total global.
                  · Tabla con columnas alineadas:
                    COMPONENTE / DETALLE / CANT. / VAL.UNIT / AJUSTE /
                    VAL.VENTA / TOTAL c/IMP.
                  · Filas agrupadas por tipo (METALES / HECHURAS / PRODUCTOS
                    / SERVICIOS) con badge color en la primera columna.
                  · Editor inline (Gramos/Merma · Valor/Bonif) embebido en
                    sub-row debajo del row correspondiente cuando count===1.
                Reader-only (POLICY R4.5) — cero matemática, helpers
                Decimal-safe. */}
            <CompositionTable
              grouped={grouped}
              qtyLine={qtyLine}
              currency={currency}
              metalTotalGrams={metalTotalGrams}
              metaMetalSale={meta.metalSale ?? null}
              metaHechuraSale={meta.hechuraSale ?? null}
              metalEditableInline={metalEditableInline}
              hechuraEditableInline={hechuraEditableInline}
              gramsHook={grams}
              mermaHook={merma}
              hechuraHook={hechura}
              metalManual={grams.manual || merma.manual || !!composition?.metal?.variantManual}
              hechuraManual={hechura.manual}
              line={line}
              onApply={onApply}
              activeCostLineOverrides={activeCostLineOverrides}
              applyCostLinePatch={applyCostLinePatch}
            />

            {/* 4.b AJUSTES GLOBALES — F1.4 #11-E.1.
                Bloque debajo de la tabla y arriba de RENTABILIDAD.
                Muestra impacto global REAL: bonificación/recargo de
                línea (TOTAL appliesTo), canal del documento, cupón.
                Cero matemática frontend — passthrough de
                pricingMeta.documentAdjustments (que VentasFacturas
                arma desde el preview response). NO se distribuye por
                fila. NO se renderea si todos los campos están null. */}
            {meta.documentAdjustments && (
              <DocumentAdjustmentsBlock
                adjustments={meta.documentAdjustments}
                currency={currency}
              />
            )}

            {/* 5. RENTABILIDAD — costo, ganancia y margen en una sola fila.
                Ganancia $ agregada como derivación trivial (misma justificación
                que margin %, ya aceptada en línea 197). Tono rojo si negativa. */}
            {showSummary && (costTotal != null || showMargin) && (
              <SaleColumn
                title="Rentabilidad"
                summary={
                  <InfoLineRow>
                    {costTotal != null && (
                      <InfoItem label="Costo" value={fmtMoney(costTotal, currency)} />
                    )}
                    {gananciaTotal != null && (
                      <InfoItem
                        label="Ganancia"
                        value={fmtMoney(gananciaTotal, currency)}
                        className={gananciaToneClass}
                      />
                    )}
                    {showMargin && (
                      <InfoItem
                        label="Margen"
                        value={margin != null ? `${margin.toFixed(1)}%` : "—"}
                        className={marginToneClass}
                      />
                    )}
                  </InfoLineRow>
                }
              />
            )}

            {/* 4. PRECIO VENTA — hero de la línea, neto sin impuestos.
                Sin detail editable: el precio sale del motor.

                Mini breakdown agregado (cuando hay descuento):
                  · Bruto      = line.subtotal + line.discountAmount
                                 (suma de 2 campos backend, cero multiplicación
                                 local; equivalente algebraico a qty × basePrice)
                  · Descuentos = line.discountAmount (= backend lineDiscount,
                                 G3.1 — agregado consolidado del motor)
                Solo se renderiza si lineDiscount > 0 — sin descuento el bloque
                queda limpio (decisión usuario punto 5).

                Anti double-count: solo mostramos el agregado, NO componentes
                per-tipo. El motor consolida promo/qty/customer/manual en
                lineDiscount; mostrar tipo individual requeriría G8 doc-level
                (decisión γ futura, fuera de scope hoy). */}
            {showSummary && (() => {
              const lineDisc = Number.isFinite(line.discountAmount)
                ? line.discountAmount
                : 0;
              const bruto = (salePrice ?? 0) + lineDisc;
              const hasDiscount = lineDisc > 0;
              return (
                <SaleColumn
                  title="Precio venta"
                  summary={
                    <>
                      {/* Fila inline mismo patrón que RENTABILIDAD — densidad
                          financiera, no hero visual.
                          · Bruto y Descuentos solo si hasDiscount > 0 (sin
                            ruido cuando no hay descuento).
                          · Neto siempre — `highlight=true` lo hace font-semibold
                            text-text dentro del mismo text-[11px] heredado de
                            InfoLineRow (destacado por peso/color, NO por tamaño).
                          · Tooltip aclaratorio en label "Descuentos" vía
                            `labelTitle` para mantener trazabilidad consolidada. */}
                      <InfoLineRow>
                        {hasDiscount && (
                          <InfoItem
                            label="Bruto"
                            value={fmtMoney(bruto, currency)}
                          />
                        )}
                        {hasDiscount && (
                          <InfoItem
                            label="Descuentos"
                            value={`−${fmtMoney(lineDisc, currency)}`}
                            className="text-emerald-500"
                            labelTitle="Total consolidado de promociones, bonificaciones y descuentos aplicados por el motor."
                          />
                        )}
                        {/* Neto + subtítulo agrupados verticalmente para que
                            "Neto, sin impuestos" se alinee bajo el VALOR
                            Neto (no bajo el primer label de la fila).
                            `items-end` empuja al cross-axis end del flex-col
                            (= right edge), dejando el subtítulo debajo del
                            valor monetario y no del label.
                            `w-fit` evita que el wrapper se expanda más allá
                            del ancho natural de su contenido — mantiene el
                            bloque compacto en qty=1 sin descuentos (cuando
                            el wrapper es el único item de la row). El
                            subtítulo wrappea naturalmente en viewport
                            angosto sin whitespace-nowrap. */}
                        <div className="flex w-fit flex-col items-end">
                          <InfoItem
                            label="Neto"
                            value={fmtMoney(salePrice ?? 0, currency)}
                            highlight
                          />
                          <div className="text-[9px] italic text-muted/70">
                            Neto, sin impuestos
                          </div>
                        </div>
                      </InfoLineRow>
                    </>
                  }
                />
              );
            })()}
          </div>
        ) : (
          // ── Vista cost (legado): bloques verticales tradicionales ─────
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

            {/* 5. IMPUESTOS — solo en cost view (Presupuestos/Órdenes/Compras
                lo necesitan como única vista del IVA per-línea). En sale
                view se omite porque ya está el desglose compacto debajo de
                "TOTAL LÍNEA C/ IMP.". */}
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
        )
      ) : (
        <div className="rounded-md border border-dashed border-border/60 px-3 py-2 text-[11px] italic text-muted">
          Sin desglose de composición disponible.
        </div>
      )}

      {/* ── Resumen Costo · Venta · Margen — solo en vista cost (legado).
          En sale view, "Precio venta" y "Rentabilidad" ya viven como
          columnas del grid de arriba; no hace falta repetirlas abajo. */}
      {showSummary && !isSaleView && (
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

// ─── Sub-componentes COMPACTOS para vista de venta (Factura) ───────────────
//
// La vista de venta apila secciones verticalmente (Metal → Hechura →
// Rentabilidad → Precio venta). Cada sección usa una fila horizontal
// compacta con varios `label: value` (`InfoLineRow` + `InfoItem`) y, cuando
// aplica, una sub-grilla 2 cols con la pareja de inputs (`InlineNumberField`).
// Sin cajas anidadas; solo header chico con divisor sutil entre secciones.
//
// Estos helpers se mantienen separados de `Block`/`FieldRow`/`NumberValue`
// para no degradar las pantallas legacy (Presupuestos/Órdenes/Compras) que
// siguen usando los originales.

/** Sección del stack vertical de "Composición del precio de venta".
 *
 *  Estructura:
 *    · header con título + chevron (cuando hay `detail`) + badge "Manual"
 *    · `summary` — siempre visible (ej. info-row con datos read-only).
 *    · `detail` — opcional, oculto por default; click en header lo abre.
 *
 *  Cuando NO hay `detail` (ej. Rentabilidad y Precio venta, que solo
 *  muestran info), no se renderiza chevron y la sección queda como un
 *  bloque simple sin accordion.
 *
 *  Por qué default colapsado: el operador ve el resumen completo de
 *  todas las secciones de un vistazo y solo expande Metal o Hechura
 *  cuando necesita editar gramos/merma/valor/bonificación. Reduce
 *  altura inicial del panel. */
function SaleColumn({
  title,
  manual,
  summary,
  detail,
  defaultExpanded = false,
}: {
  title:    string;
  manual?:  boolean;
  summary:  React.ReactNode;
  detail?:  React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isCollapsible = !!detail;

  // Header inline: chevron (si colapsable) + título + badge "Manual" +
  // resumen — TODO en la misma fila con `flex-wrap` para que en pantallas
  // angostas el resumen baje de manera elegante. Click en cualquier
  // parte del header toggles el accordion (cuando es colapsable).
  const headerContent = (
    <>
      {isCollapsible && (
        expanded
          ? <ChevronDown size={10} className="shrink-0 text-muted/60" />
          : <ChevronRight size={10} className="shrink-0 text-muted/60" />
      )}
      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-muted/80">
        {title}
      </span>
      {manual && (
        <span className="shrink-0 rounded bg-surface2 px-1 text-[8px] uppercase tracking-wide text-muted/80">
          Manual
        </span>
      )}
      <div className="min-w-0 flex-1">
        {summary}
      </div>
    </>
  );

  return (
    <div className="min-w-0">
      {isCollapsible ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? `Colapsar ${title}` : `Expandir ${title}`}
          className="flex w-full flex-wrap items-baseline gap-x-2 gap-y-1 rounded text-left hover:bg-surface2/30"
        >
          {headerContent}
        </button>
      ) : (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {headerContent}
        </div>
      )}
      {isCollapsible && expanded && (
        <div className="mt-1 pl-3.5">
          {detail}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// F1.3 G4.x #10-F — CompositionTable: tabla ERP unificada.
//
// Reemplaza el stack de 4 accordions independientes (10-B/C/D/E) por una
// experiencia de TABLA con:
//   1. Resumen-chips arriba — totales por tipo + total global.
//   2. Header de columnas con typography uppercase compacta.
//   3. Filas grupadas por tipo (METAL/HECHURA/PRODUCT/SERVICE), separadas
//      por divisores sutiles.
//   4. Editor inline embebido como sub-row debajo del row correspondiente
//      cuando count cost-lines === 1 (D1).
//
// Cero matemática derivada (POLICY R4.5). Helpers existentes:
//   · `groupCompositionItems` — agrupación.
//   · `safeSumNumbers` — Decimal-safe sums.
//   · `COMPONENT_TYPE_BADGE` — paleta semántica unificada.
// =============================================================================

const TABLE_COLS_CLS = "grid grid-cols-[24px_minmax(0,1.6fr)_minmax(70px,0.7fr)_minmax(90px,0.8fr)_minmax(80px,0.7fr)_minmax(95px,0.85fr)_minmax(105px,0.9fr)] items-baseline gap-x-2";

function TableHeader() {
  return (
    <div className={cn(TABLE_COLS_CLS, "px-1 pb-1 border-b border-border/40 text-[9px] font-semibold uppercase tracking-wide text-muted/70")}>
      <span aria-hidden />
      <span>Componente</span>
      <span className="text-right">Cantidad</span>
      <span className="text-right">Val. unit.</span>
      <span className="text-right">Ajuste</span>
      <span className="text-right">Val. venta</span>
      <span className="text-right">Total c/imp.</span>
    </div>
  );
}

/**
 * F1.3 G4.x #10-G — input numérico compacto para celdas de la tabla ERP.
 * Estilo "naked" sin label (la columna ya es el label), alineado a la
 * derecha, mismo TPNumberInput que usa el resto del sistema.
 *
 * Reader-only respecto al pricing-engine: cero recálculo local. Al
 * cambiar el valor llama el callback que dispara el override
 * existente (gramsOverride / hechuraOverrideAmount / etc.) — el
 * resultado autoritativo viene del preview backend.
 */
function CellNumberInput({
  value, onChange, decimals = 2, step = 0.01, suffix,
  readOnly = false, disabled = false, tooltip,
}: {
  value:    number | null;
  onChange: (v: number | null) => void;
  decimals?: number;
  step?:     number;
  suffix?:   React.ReactNode;
  readOnly?: boolean;
  disabled?: boolean;
  tooltip?:  string;
}) {
  // F1.4 #11-E.1 — arrows visibles en inputs editables (estándar TPTech).
  // Read-only: arrows ocultas + opacity-70 + cursor-help + tooltip.
  const isInteractive = !readOnly && !disabled;
  return (
    <div
      className="inline-flex items-center justify-end"
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
        className={cn(
          "!h-6 !text-[11px] text-right tabular-nums",
          isInteractive ? "w-[100px]" : "w-[92px]",
          !isInteractive && "cursor-help opacity-70",
        )}
        wrapClassName="!w-auto"
      />
    </div>
  );
}

/** Texto con tooltip "Editar desde la ficha del artículo" para celdas
 *  read-only por GAP de override (PRODUCT/SERVICE always; METAL/HECHURA
 *  cuando count >= 2). NO se aplica a Val. venta / Total c/imp. (esos
 *  son resultados del pricing-engine, no GAPs). */
const READ_ONLY_TOOLTIP = "Editar desde la ficha del artículo";

function ReadOnlyCell({ children }: { children: React.ReactNode }) {
  return (
    <span title={READ_ONLY_TOOLTIP} className="cursor-help">
      {children ?? "—"}
    </span>
  );
}

function TableRow({
  componentType,
  Icon,
  primary,
  secondary,
  quantity,
  unitValue,
  adjustment,
  saleValue,
  totalWithTax,
  manual,
}: {
  componentType: ComponentTypeKey;
  Icon:          LucideIcon;
  primary:       React.ReactNode;
  secondary?:    React.ReactNode;
  quantity?:     React.ReactNode;
  unitValue?:    React.ReactNode;
  adjustment?:   React.ReactNode;
  saleValue?:    React.ReactNode;
  totalWithTax?: React.ReactNode;
  manual?:       boolean;
}) {
  const cls = COMPONENT_TYPE_BADGE[componentType];
  return (
    <div className={cn(TABLE_COLS_CLS, "px-1 py-1.5 text-[11px]")}>
      {/* Col 1 — badge cuadrado con ícono coloreado por tipo. */}
      <span
        className={cn(
          "inline-flex h-5 w-5 items-center justify-center rounded ring-1",
          cls.bg, cls.ring,
        )}
        aria-hidden
      >
        <Icon size={11} className={cls.icon} />
      </span>
      {/* Col 2 — primary (nombre/variante) + secondary (código/merma/etc). */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-text truncate">{primary}</span>
          {manual && (
            <span className="rounded bg-surface2 px-1 text-[8px] uppercase tracking-wide text-muted/80">
              Manual
            </span>
          )}
        </div>
        {secondary && (
          <div className="text-[10px] text-muted/75 leading-tight truncate">{secondary}</div>
        )}
      </div>
      {/* Cols 3-7 — alineadas a la derecha (números). */}
      <div className="text-right tabular-nums text-text/90">{quantity ?? "—"}</div>
      <div className="text-right tabular-nums text-text/90">{unitValue ?? "—"}</div>
      <div className="text-right tabular-nums">{adjustment ?? <span className="text-muted/40">—</span>}</div>
      <div className="text-right tabular-nums font-medium text-text">{saleValue ?? "—"}</div>
      <div className="text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
        {totalWithTax ?? "—"}
      </div>
    </div>
  );
}

function CompositionTable({
  grouped, qtyLine, currency,
  metalTotalGrams, metaMetalSale, metaHechuraSale,
  metalEditableInline, hechuraEditableInline,
  gramsHook, mermaHook, hechuraHook,
  metalManual, hechuraManual,
  line, onApply,
  activeCostLineOverrides,
  applyCostLinePatch,
}: {
  grouped:               ReturnType<typeof groupCompositionItems>;
  qtyLine:               number;
  currency:              string;
  metalTotalGrams:       number | null;
  metaMetalSale:         number | null;
  metaHechuraSale:       number | null;
  metalEditableInline:   boolean;
  hechuraEditableInline: boolean;
  gramsHook:             { value: number | null; setValue: (v: number | null) => void };
  mermaHook:             { value: number | null; setValue: (v: number | null) => void };
  hechuraHook:           { value: number | null; setValue: (v: number | null) => void };
  metalManual:           boolean;
  hechuraManual:         boolean;
  line:                  DocumentLine;
  onApply:               LineAdvancedOverridesPanelProps["onApply"];
  /** F1.4 G5 #11-D — overrides activos indexados por costLineId. */
  activeCostLineOverrides: CostLineOverride[];
  /** F1.4 G5 #11-D — patch helper que reconstruye el array y dispara
   *  onApply({ costLineOverrides: ... }). Cero recálculo local. */
  applyCostLinePatch:     (
    costLineId: string,
    type:       CostLineOverride["type"],
    patch:      Partial<Omit<CostLineOverride, "costLineId" | "type">>,
  ) => void;
}) {
  const fmt = (v: number | null | undefined) =>
    v != null && Number.isFinite(v) ? fmtMoney(v, currency) : null;

  // ── Resumen chips superiores. Cada chip = tipo con count + agregado. ─────
  const totalComponents =
    grouped.metals.reduce((acc, g) => acc + g.count, 0) +
    grouped.hechurasAggregate.count +
    grouped.productsAggregate.count +
    grouped.servicesAggregate.count;

  const ChipResumen = ({
    type, label, value,
  }: {
    type: ComponentTypeKey;
    label: string;
    value: React.ReactNode;
  }) => {
    const cls = COMPONENT_TYPE_BADGE[type];
    return (
      <span className={cn("inline-flex items-baseline gap-1 rounded px-1.5 py-0.5 ring-1", cls.bg, cls.ring)}>
        <span className={cn("text-[9px] font-semibold uppercase tracking-wide", cls.icon)}>{label}</span>
        <span className="text-[10px] tabular-nums text-text/90">{value}</span>
      </span>
    );
  };

  return (
    <div className="space-y-1.5">
      {/* ── Resumen chips arriba ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-baseline gap-1.5">
        <ChipResumen
          type="METAL"
          label="Metales"
          value={metalTotalGrams != null
            ? `${metalTotalGrams.toFixed(2)} g`
            : "—"}
        />
        <ChipResumen
          type="HECHURA"
          label="Hechuras"
          value={String(grouped.hechurasAggregate.count)}
        />
        <ChipResumen
          type="PRODUCT"
          label="Productos"
          value={String(grouped.productsAggregate.count)}
        />
        <ChipResumen
          type="SERVICE"
          label="Servicios"
          value={String(grouped.servicesAggregate.count)}
        />
        <span className="ml-auto text-[10px] text-muted/75">
          Total componentes:{" "}
          <span className="font-semibold text-text/90 tabular-nums">{totalComponents}</span>
        </span>
      </div>

      {/* ── Tabla principal ──────────────────────────────────────────── */}
      <div className="rounded-md border border-border/30 bg-card/30">
        <TableHeader />
        <div className="divide-y divide-border/25">
          {/* ── METALES — una fila por sub-grupo (variante). ──────────────
              F1.3 #10-G — edición inline:
              · count===1 → CANTIDAD editable (gramsOverride). VAL.UNIT
                y AJUSTE read-only (METAL no soporta lineAdj cost-side).
              · count>1 → todas las celdas read-only con tooltip.
              · Sub-row residual: solo Merma input cuando count===1. */}
          {grouped.metals.map((g) => {
            // F1.4 #11-D — edición indexada por costLineId. Solo editable
            // cuando el sub-grupo tiene exactamente 1 cost line (count===1)
            // — count>1 representa múltiples lines de la misma variante,
            // que no se pueden editar agrupadamente sin distribución
            // (decisión: tabla read-only en ese caso, mensaje "Editar
            // desde la ficha del artículo").
            const item = g.items[0];
            const costLineId   = item?.costLineId ?? null;
            const isEditable   = g.count === 1 && costLineId != null;
            const ov           = costLineId
              ? findCostLineOverride(activeCostLineOverrides, costLineId)
              : undefined;
            const mermaText = g.appliedMermaPct === VARIES
              ? "Merma: varias"
              : g.appliedMermaPct != null
                ? `Merma: ${(g.appliedMermaPct as number).toFixed(2)}%`
                : null;
            const secondary = (
              <span>
                {g.purityLabel && <>Pureza: {g.purityLabel}{mermaText && " · "}</>}
                {mermaText}
                {g.count > 1 && <span className="ml-1 text-muted/55">· {g.count} líneas</span>}
              </span>
            );
            const saleVal = g.totalLineCost;
            const unitValueText = fmt(
              g.totalLineCost != null && g.totalAppliedGrams && g.totalAppliedGrams > 0
                ? g.totalLineCost / g.totalAppliedGrams
                : null,
            );
            // CANTIDAD: editable si isEditable. Valor mostrado prefiere el
            // override (intent del usuario) sobre el original.
            const qtyValue = ov?.quantityOverride != null
              ? Number(ov.quantityOverride)
              : (g.totalAppliedGrams ?? 0);
            const quantityCell = (
              <CellNumberInput
                value={qtyValue}
                onChange={isEditable && costLineId
                  ? (v) => applyCostLinePatch(costLineId, "METAL", { quantityOverride: v ?? 0 })
                  : () => {}}
                decimals={2}
                step={0.05}
                suffix={<span className="text-[10px] text-muted/60">g</span>}
                readOnly={!isEditable}
                tooltip={!isEditable ? READ_ONLY_TOOLTIP : undefined}
              />
            );
            // AJUSTE = MERMA (decisión usuario: METAL no soporta lineAdj).
            const mermaValue = ov?.mermaPercentOverride != null
              ? Number(ov.mermaPercentOverride)
              : (g.appliedMermaPct === VARIES ? 0 : (g.appliedMermaPct ?? 0));
            const adjustmentCell = g.appliedMermaPct === VARIES ? (
              <ReadOnlyCell><span className="text-muted/60">varias</span></ReadOnlyCell>
            ) : (
              <CellNumberInput
                value={typeof mermaValue === "number" ? mermaValue : 0}
                onChange={isEditable && costLineId
                  ? (v) => applyCostLinePatch(costLineId, "METAL", { mermaPercentOverride: v ?? 0 })
                  : () => {}}
                decimals={2}
                step={0.5}
                suffix={<span className="text-[10px] text-muted/60">%</span>}
                readOnly={!isEditable}
                tooltip={!isEditable ? READ_ONLY_TOOLTIP : undefined}
              />
            );
            return (
              <TableRow
                key={`row-metal-${g.groupKey}`}
                componentType="METAL"
                Icon={Gem}
                primary={g.metalName ?? "—"}
                secondary={secondary}
                quantity={quantityCell}
                unitValue={<ReadOnlyCell>{unitValueText}</ReadOnlyCell>}
                adjustment={adjustmentCell}
                saleValue={fmt(saleVal)}
                totalWithTax={fmt(saleVal != null && qtyLine > 1 ? saleVal * qtyLine : saleVal)}
                manual={!!ov}
              />
            );
          })}

          {/* ── HECHURAS — una fila por cost line. ──────────────────────
              F1.3 #10-G — edición inline:
              · count===1 → VAL.UNIT (hechuraOverrideAmount) y AJUSTE
                (BonifValue · manualDiscount appliesTo=HECHURA) editables.
                CANTIDAD read-only (hechuraOverrideAmount fuerza qty=1).
              · count>1 → todas las celdas read-only con tooltip. */}
          {grouped.hechuras.map((h, idx) => {
            // F1.4 #11-D — edición indexada por costLineId. Cada `h` es
            // 1 cost line individual (HECHURA no se agrupa). Editable
            // siempre que tenga costLineId estable.
            const costLineId = h.costLineId ?? null;
            const isEditable = costLineId != null;
            const ov = costLineId
              ? findCostLineOverride(activeCostLineOverrides, costLineId)
              : undefined;
            const saleVal = h.lineCost;
            // CANTIDAD: editable via quantityOverride. Default = 1
            // (HECHURA típica trae qty=1).
            const qtyValue = ov?.quantityOverride != null
              ? Number(ov.quantityOverride)
              : 1;
            const quantityCell = (
              <CellNumberInput
                value={qtyValue}
                onChange={isEditable && costLineId
                  ? (v) => applyCostLinePatch(costLineId, "HECHURA", { quantityOverride: v ?? 0 })
                  : () => {}}
                decimals={2}
                step={1}
                suffix={<span className="text-[10px] text-muted/60">un</span>}
                readOnly={!isEditable}
                tooltip={!isEditable ? READ_ONLY_TOOLTIP : undefined}
              />
            );
            // VAL. UNIT: editable via unitValueOverride.
            const unitValValue = ov?.unitValueOverride != null
              ? Number(ov.unitValueOverride)
              : (h.appliedAmount ?? 0);
            const unitValueCell = (
              <CellNumberInput
                value={unitValValue}
                onChange={isEditable && costLineId
                  ? (v) => applyCostLinePatch(costLineId, "HECHURA", { unitValueOverride: v ?? 0 })
                  : () => {}}
                decimals={2}
                readOnly={!isEditable}
                tooltip={!isEditable ? READ_ONLY_TOOLTIP : undefined}
              />
            );
            // AJUSTE: BonifValue (legacy `manualDiscount.appliesTo=HECHURA`)
            // se mantiene para no romper UX existente. Migración del
            // ajuste a costLineOverrides.adjustment* queda para fase
            // posterior cuando el backend exponga lineAdj per item de
            // HECHURA en composition (separado del `manualDiscount`
            // global del componente). Solo el primer item usa el editor
            // legacy; los demás muestran read-only.
            const adjustmentCell = idx === 0 && hechuraEditableInline ? (
              <div className="flex items-center justify-end">
                <BonifValue line={line} appliesTo="HECHURA" onApply={onApply} compact />
              </div>
            ) : (
              <ReadOnlyCell><span className="text-muted/40">—</span></ReadOnlyCell>
            );
            return (
              <TableRow
                key={`row-hechura-${costLineId ?? idx}`}
                componentType="HECHURA"
                Icon={Hammer}
                primary={h.lineLabel ?? "Hechura"}
                secondary={`Moneda: ${currency || "—"}`}
                quantity={quantityCell}
                unitValue={unitValueCell}
                adjustment={adjustmentCell}
                saleValue={fmt(saleVal)}
                totalWithTax={fmt(saleVal != null && qtyLine > 1 ? saleVal * qtyLine : saleVal)}
                manual={!!ov || (idx === 0 && hechuraManual)}
              />
            );
          })}

          {/* ── PRODUCTOS — F1.4 #11-D edición indexada por costLineId. */}
          {grouped.products.map((p, idx) => {
            const costLineId = p.costLineId ?? null;
            const isEditable = costLineId != null;
            const ov = costLineId
              ? findCostLineOverride(activeCostLineOverrides, costLineId)
              : undefined;
            // CANTIDAD editable.
            const qtyValue = ov?.quantityOverride != null
              ? Number(ov.quantityOverride)
              : (p.quantity ?? 0);
            const quantityCell = (
              <CellNumberInput
                value={qtyValue}
                onChange={isEditable && costLineId
                  ? (v) => applyCostLinePatch(costLineId, "PRODUCT", { quantityOverride: v ?? 0 })
                  : () => {}}
                decimals={2}
                suffix={<span className="text-[10px] text-muted/60">un</span>}
                readOnly={!isEditable}
                tooltip={!isEditable ? READ_ONLY_TOOLTIP : undefined}
              />
            );
            // VAL.UNIT editable.
            const unitValValue = ov?.unitValueOverride != null
              ? Number(ov.unitValueOverride)
              : (p.unitValue ?? 0);
            const unitValueCell = (
              <CellNumberInput
                value={unitValValue}
                onChange={isEditable && costLineId
                  ? (v) => applyCostLinePatch(costLineId, "PRODUCT", { unitValueOverride: v ?? 0 })
                  : () => {}}
                decimals={2}
                readOnly={!isEditable}
                tooltip={!isEditable ? READ_ONLY_TOOLTIP : undefined}
              />
            );
            // AJUSTE: chip read-only del ajuste de la cost line (de la
            // ficha del artículo). Edición de adjustment* per costLine
            // queda para fase posterior.
            const adj = p.lineAdjAmount != null && p.lineAdjKind != null
              ? <AdjustmentChip kind={p.lineAdjKind} type={p.lineAdjType ?? null} value={p.lineAdjValue ?? null} amount={p.lineAdjAmount} currency={currency} />
              : <ReadOnlyCell><span className="text-muted/40">—</span></ReadOnlyCell>;
            return (
              <TableRow
                key={`row-product-${costLineId ?? idx}`}
                componentType="PRODUCT"
                Icon={Package}
                primary={p.catalogItemName ?? p.catalogItemCode ?? "—"}
                secondary={p.catalogItemCode && p.catalogItemCode !== p.catalogItemName
                  ? `Código: ${p.catalogItemCode}${p.affectsStock === true ? " · Descuenta stock" : ""}`
                  : (p.affectsStock === true ? "Descuenta stock" : null)}
                quantity={quantityCell}
                unitValue={unitValueCell}
                adjustment={adj}
                saleValue={fmt(p.totalValue)}
                totalWithTax={fmt(p.totalValue != null && qtyLine > 1 ? p.totalValue * qtyLine : p.totalValue)}
                manual={!!ov}
              />
            );
          })}

          {/* ── SERVICIOS — F1.4 #11-D edición indexada por costLineId. */}
          {grouped.services.map((s, idx) => {
            const costLineId = s.costLineId ?? null;
            const isEditable = costLineId != null;
            const ov = costLineId
              ? findCostLineOverride(activeCostLineOverrides, costLineId)
              : undefined;
            const qtyValue = ov?.quantityOverride != null
              ? Number(ov.quantityOverride)
              : (s.quantity ?? 0);
            const quantityCell = (
              <CellNumberInput
                value={qtyValue}
                onChange={isEditable && costLineId
                  ? (v) => applyCostLinePatch(costLineId, "SERVICE", { quantityOverride: v ?? 0 })
                  : () => {}}
                decimals={2}
                suffix={<span className="text-[10px] text-muted/60">un</span>}
                readOnly={!isEditable}
                tooltip={!isEditable ? READ_ONLY_TOOLTIP : undefined}
              />
            );
            const unitValValue = ov?.unitValueOverride != null
              ? Number(ov.unitValueOverride)
              : (s.unitValue ?? 0);
            const unitValueCell = (
              <CellNumberInput
                value={unitValValue}
                onChange={isEditable && costLineId
                  ? (v) => applyCostLinePatch(costLineId, "SERVICE", { unitValueOverride: v ?? 0 })
                  : () => {}}
                decimals={2}
                readOnly={!isEditable}
                tooltip={!isEditable ? READ_ONLY_TOOLTIP : undefined}
              />
            );
            const adj = s.lineAdjAmount != null && s.lineAdjKind != null
              ? <AdjustmentChip kind={s.lineAdjKind} type={s.lineAdjType ?? null} value={s.lineAdjValue ?? null} amount={s.lineAdjAmount} currency={currency} />
              : <ReadOnlyCell><span className="text-muted/40">—</span></ReadOnlyCell>;
            return (
              <TableRow
                key={`row-service-${costLineId ?? idx}`}
                componentType="SERVICE"
                Icon={Wrench}
                primary={s.catalogItemName ?? s.catalogItemCode ?? "—"}
                secondary={s.catalogItemCode && s.catalogItemCode !== s.catalogItemName
                  ? `Código: ${s.catalogItemCode}`
                  : null}
                quantity={quantityCell}
                unitValue={unitValueCell}
                adjustment={adj}
                saleValue={fmt(s.totalValue)}
                totalWithTax={fmt(s.totalValue != null && qtyLine > 1 ? s.totalValue * qtyLine : s.totalValue)}
                manual={!!ov}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * F1.4 #11-E.1 — bloque "AJUSTES GLOBALES" debajo de la tabla ERP.
 *
 * Reglas:
 *   · Cero matemática frontend — solo passthrough de los amounts del
 *     preview backend (`documentAdjustments`).
 *   · NEGATIVOS (bonif/cupón) → emerald + prefijo "−".
 *   · POSITIVOS (recargo de canal) → amber + prefijo "+".
 *   · Si no hay ningún campo con valor, el bloque NO se renderea
 *     (regla del usuario — sin ruido visual).
 *   · Compacto: typography 11px, sin cards pesadas, sin backgrounds.
 */
function DocumentAdjustmentsBlock({
  adjustments, currency,
}: {
  adjustments: NonNullable<NonNullable<DocumentLine["pricingMeta"]>["documentAdjustments"]>;
  currency:    string;
}) {
  const lineMd = adjustments.lineManualDiscount ?? null;
  const ch     = adjustments.channel ?? null;
  const cp     = adjustments.coupon  ?? null;
  // Si NO hay nada con valor, ocultar el bloque entero.
  const hasAny = (lineMd && lineMd.amount !== 0) || (ch && ch.amount !== 0) || (cp && cp.amount !== 0);
  if (!hasAny) return null;

  // Helpers visuales — convención: BONUS/cupón reducen → emerald, signo "−".
  // Recargo de canal aumenta → amber, signo "+".
  const fmtAmount = (amount: number, isReducing: boolean) => {
    const sign = isReducing ? "−" : "+";
    const cls  = isReducing
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-amber-600 dark:text-amber-400";
    return (
      <span className={cn("tabular-nums font-semibold", cls)}>
        {sign}{fmtMoney(Math.abs(amount), currency)}
      </span>
    );
  };

  return (
    <div className="space-y-0.5 text-[11px]">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-muted/80">
        Ajustes globales
      </div>
      {lineMd && lineMd.amount !== 0 && (
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-muted">
            Bonificación global{lineMd.valuePct != null && (
              <span className="ml-1 text-text/90">{lineMd.valuePct.toFixed(2)}%</span>
            )}
          </span>
          {fmtAmount(lineMd.amount, lineMd.kind === "BONUS")}
        </div>
      )}
      {ch && ch.amount !== 0 && (
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-muted">
            Canal <span className="text-text/90">{ch.name}</span>
          </span>
          {fmtAmount(ch.amount, ch.amount < 0)}
        </div>
      )}
      {cp && cp.amount !== 0 && (
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-muted">
            Cupón <span className="text-text/90">{cp.name ?? cp.code}</span>
          </span>
          {fmtAmount(cp.amount, true)}
        </div>
      )}
    </div>
  );
}

/** Chip compacto para ajustes BONUS/SURCHARGE en la columna AJUSTE. */
function AdjustmentChip({
  kind, type, value, amount, currency,
}: {
  kind:     "BONUS" | "SURCHARGE";
  type:     "PERCENTAGE" | "FIXED_AMOUNT" | null;
  value:    number | null;
  amount:   number;
  currency: string;
}) {
  const sign = kind === "BONUS" ? "−" : "+";
  const cls  = kind === "BONUS"
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-amber-600 dark:text-amber-400";
  return (
    <span className={cls}>
      {type === "PERCENTAGE" && value != null && (
        <span className="text-muted/70 mr-0.5">{value}%</span>
      )}
      {sign}{fmtMoney(Math.abs(amount), currency)}
    </span>
  );
}

/**
 * F1.3 G4.x #10-C — header de grupo estilo ERP financiero.
 *
 * Render compacto: ícono coloreado + título + sub-resumen + total venta a
 * la derecha + chevron. Animación suave en expand/collapse via
 * `grid-template-rows` (sin layout jumps).
 *
 * Reader-only: cero matemática derivada. Todos los valores agregados son
 * passthrough del helper `groupCompositionItems` (Decimal-safe).
 */
function GroupAccordion({
  Icon, componentType, title, manual,
  summary, rightValue, rightSub,
  children, defaultExpanded = false,
}: {
  Icon:            LucideIcon;
  /** Tipo de componente — define el set de colores semánticos (F1.3 #10-D).
   *  Misma paleta que la Composición de costo del artículo en el Simulador
   *  (CostRow). Garantiza consistencia visual cross-TPTech. */
  componentType:   ComponentTypeKey;
  title:           string;
  manual?:         boolean;
  /** Sub-resumen agregado: "Variantes: 4 · Líneas: 4 · Total gramos: 4.50 g" */
  summary:         React.ReactNode;
  /** Valor monetario destacado a la derecha (ej. "Valor venta: AR$ X"). */
  rightValue?:     React.ReactNode;
  /** Sub-info debajo del rightValue (opcional). */
  rightSub?:       React.ReactNode;
  children?:       React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const cls = COMPONENT_TYPE_BADGE[componentType];
  const isCollapsible = !!children;
  return (
    <div className="min-w-0">
      <button
        type="button"
        disabled={!isCollapsible}
        onClick={() => isCollapsible && setExpanded(v => !v)}
        aria-expanded={expanded}
        aria-label={expanded ? `Colapsar ${title}` : `Expandir ${title}`}
        className={cn(
          "group flex w-full items-center gap-2 rounded text-left",
          "py-1 pr-1 pl-0.5",
          isCollapsible && "hover:bg-surface2/40",
        )}
      >
        {/* Chevron — afuera del badge para que el badge se vea limpio. */}
        {isCollapsible ? (
          expanded
            ? <ChevronDown size={11} className="shrink-0 text-muted/60" />
            : <ChevronRight size={11} className="shrink-0 text-muted/60" />
        ) : (
          <span className="w-[11px] shrink-0" aria-hidden />
        )}
        {/* Badge del ícono (color por grupo). */}
        <span
          className={cn(
            "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded ring-1",
            cls.bg, cls.ring,
          )}
          aria-hidden
        >
          <Icon size={13} className={cls.icon} />
        </span>
        {/* Título + manual badge + sub-resumen. */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted/80">
              {title}
            </span>
            {manual && (
              <span className="rounded bg-surface2 px-1 text-[8px] uppercase tracking-wide text-muted/80">
                Manual
              </span>
            )}
          </div>
          {summary && (
            <div className="mt-0.5 text-[10.5px] text-muted/85 leading-tight">
              {summary}
            </div>
          )}
        </div>
        {/* Valor monetario a la derecha. */}
        {rightValue != null && (
          <div className="text-right shrink-0 pl-2">
            <div className="text-[11px] font-semibold tabular-nums text-text">
              {rightValue}
            </div>
            {rightSub && (
              <div className="text-[9px] text-muted/65 tabular-nums">{rightSub}</div>
            )}
          </div>
        )}
      </button>
      {/* Detail expandible — conditional render para que el detail no
          aparezca en DOM cuando el accordion está colapsado (mejor para
          accesibilidad + tests). Sin animación de altura para evitar
          layout jumps en panels densos.  */}
      {isCollapsible && expanded && (
        <div className="pl-9 pr-1 pt-1 pb-1">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * F1.3 G4.x #10-B — accordion grupal de METAL.
 *
 * Header (siempre visible):
 *   "Metal · N líneas · X.XX g total · AR$ Y total"
 *   Si hay >1 variante: "Metal · N variantes · X.XX g total"
 *   Si merma difiere: "Merma: varias"
 *
 * Detail (expandible, default colapsado cuando count >= 2):
 *   Lista de SUB-GRUPOS por metalVariantId. Cada sub-grupo muestra
 *   su variante + total g del sub-grupo + count + lines individuales.
 *
 * Reader-only (POLICY R4.5):
 *   · totales agregados vienen del helper Decimal-safe.
 *   · "Editar desde la ficha del artículo" SOLO si grupo tiene >1 line
 *     (regla del usuario — no mostrar ruido innecesario).
 */
function GroupedMetalAccordion({
  groups, totalLineCount, totalGrams, totalLineCost: _totalLineCost,
  qtyLine, currency, metaMetalSale, manual, editorInline,
}: {
  groups:         ReturnType<typeof groupCompositionItems>["metals"];
  totalLineCount: number;
  totalGrams:     number | null;
  totalLineCost:  number | null;
  qtyLine:        number;
  currency:       string;
  metaMetalSale:  number | null;
  /** Badge "Manual" en el header cuando hay overrides activos en el [0]. */
  manual?:        boolean;
  /** F1.3 #10-E — editor inline (inputs Gramos/Merma) inyectado por el
   *  caller cuando count cost-lines === 1. Cuando es null, el detail es
   *  read-only (count >= 2 o sin items). */
  editorInline?:  React.ReactNode;
}) {
  const variantCount = groups.length;
  const isMultiVariant = variantCount >= 2;
  const defaultExpanded = totalLineCount === 1;
  // Sub-resumen del header (string compacto financiero).
  const summaryText = (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span>
        {isMultiVariant
          ? `Variantes: ${variantCount}`
          : `Líneas: ${totalLineCount}`}
      </span>
      {totalGrams != null && (
        <>
          <span className="text-muted/40">·</span>
          <span>Total gramos: <span className="font-medium text-text/90 tabular-nums">{totalGrams.toFixed(2)} g</span></span>
        </>
      )}
      {/* Chips de subgrupos cuando hay múltiples variantes. */}
      {isMultiVariant && groups.map(g => (
        <span key={`m-chip-${g.groupKey}`} className="text-muted/85">
          <span className="text-muted/40 mr-2">·</span>
          {g.metalName ?? g.purityLabel ?? "—"}:{" "}
          <span className="tabular-nums text-text/90">
            {g.totalAppliedGrams != null ? `${g.totalAppliedGrams.toFixed(2)} g` : "—"}
          </span>
        </span>
      ))}
    </div>
  );
  const rightValue = metaMetalSale != null
    ? <>Valor venta: <span className="text-text">{fmtMoney(metaMetalSale, currency)}</span></>
    : null;
  const rightSub = metaMetalSale != null && qtyLine > 1
    ? <>Total: {fmtMoney(metaMetalSale * qtyLine, currency)}</>
    : null;

  return (
    <GroupAccordion
      Icon={Gem}
      componentType="METAL"
      title="Metal"
      manual={manual}
      summary={summaryText}
      rightValue={rightValue}
      rightSub={rightSub}
      defaultExpanded={defaultExpanded}
    >
      {/* Tabla compacta de sub-grupos. */}
      <div className="space-y-1.5 text-[11px]">
        {groups.map(g => (
          <div key={`m-detail-${g.groupKey}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="font-semibold text-text">
              {g.metalName ?? "—"}
              {g.purityLabel && <span className="ml-1 font-normal text-muted">{g.purityLabel}</span>}
            </span>
            <span className="text-muted">Líneas: <span className="tabular-nums text-text/90">{g.count}</span></span>
            {g.totalAppliedGrams != null && (
              <span className="text-muted">Gramos: <span className="tabular-nums text-text/90">{g.totalAppliedGrams.toFixed(2)} g</span></span>
            )}
            {g.appliedMermaPct === VARIES ? (
              <span className="text-muted">Merma: <span className="text-text/90">varias</span></span>
            ) : g.appliedMermaPct != null ? (
              <span className="text-muted">Merma: <span className="tabular-nums text-text/90">{(g.appliedMermaPct as number).toFixed(2)}%</span></span>
            ) : null}
            {g.totalLineCost != null && (
              <span className="text-muted">Costo: <span className="tabular-nums font-medium text-text">{fmtMoney(g.totalLineCost, currency)}</span></span>
            )}
          </div>
        ))}
        {totalLineCount > 1 && (
          <div className="pt-0.5 text-[10px] italic text-muted/60">
            Editar desde la ficha del artículo
          </div>
        )}
        {/* F1.3 #10-E — editor inline (Gramos / Merma) cuando hay 1 line. */}
        {editorInline}
      </div>
    </GroupAccordion>
  );
}

/**
 * F1.3 G4.x #10-B — accordion grupal de HECHURA.
 *
 * NO se agrupa por lineLabel (auditoría: heurístico inseguro). Lista
 * plana de items + agregado simple en header.
 */
function GroupedHechuraAccordion({
  items, aggregate, qtyLine, currency, metaHechuraSale, manual, editorInline,
}: {
  items:           ReturnType<typeof groupCompositionItems>["hechuras"];
  aggregate:       ReturnType<typeof groupCompositionItems>["hechurasAggregate"];
  qtyLine:         number;
  currency:        string;
  metaHechuraSale: number | null;
  manual?:         boolean;
  editorInline?:   React.ReactNode;
}) {
  const defaultExpanded = aggregate.count === 1;
  const summaryText = (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span>Conceptos: <span className="font-medium text-text/90 tabular-nums">{aggregate.count}</span></span>
      <span className="text-muted/40">·</span>
      <span>Líneas: <span className="font-medium text-text/90 tabular-nums">{aggregate.count}</span></span>
    </div>
  );
  const rightValue = metaHechuraSale != null
    ? <>Valor venta: <span className="text-text">{fmtMoney(metaHechuraSale, currency)}</span></>
    : (aggregate.totalLineCost != null
        ? <>Costo: <span className="text-text">{fmtMoney(aggregate.totalLineCost, currency)}</span></>
        : null);
  const rightSub = metaHechuraSale != null && qtyLine > 1
    ? <>Total: {fmtMoney(metaHechuraSale * qtyLine, currency)}</>
    : null;

  return (
    <GroupAccordion
      Icon={Hammer}
      componentType="HECHURA"
      title="Hechura"
      manual={manual}
      summary={summaryText}
      rightValue={rightValue}
      rightSub={rightSub}
      defaultExpanded={defaultExpanded}
    >
      <div className="space-y-1 text-[11px]">
        {items.map((h, i) => (
          <div
            key={`h-line-${h.costLineId ?? i}`}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5"
          >
            {h.lineLabel && (
              <span className="font-medium text-text">{h.lineLabel}</span>
            )}
            <span className="text-muted">Moneda: <span className="text-text/90">{currency || "—"}</span></span>
            {h.appliedAmount != null && (
              <span className="text-muted">Valor: <span className="tabular-nums text-text/90">{fmtMoney(h.appliedAmount, currency)}</span></span>
            )}
            {h.lineCost != null && (
              <span className="text-muted">Costo: <span className="tabular-nums font-medium text-text">{fmtMoney(h.lineCost, currency)}</span></span>
            )}
          </div>
        ))}
        {aggregate.count > 1 && (
          <div className="pt-0.5 text-[10px] italic text-muted/60">
            Editar desde la ficha del artículo
          </div>
        )}
        {/* F1.3 #10-E — editor inline (Valor / Bonificación) cuando hay 1 line. */}
        {editorInline}
      </div>
    </GroupAccordion>
  );
}

/**
 * F1.3 G4.x #10-B — accordion grupal de PRODUCTO o SERVICIO.
 *
 * NO se agrupa internamente (decisión usuario MVP). Cada item se
 * muestra como CompositionItemSaleColumn dentro del detail.
 */
function GroupedProductServiceAccordion({
  kind, items, aggregate, qtyLine, currency,
}: {
  kind:      "PRODUCT" | "SERVICE";
  items:     Array<NonNullable<NonNullable<DocumentLine["pricingMeta"]>["composition"]>["products"] extends (infer T)[] | undefined ? T : never>;
  aggregate: ReturnType<typeof groupCompositionItems>["productsAggregate"];
  qtyLine:   number;
  currency:  string;
}) {
  const title = kind === "PRODUCT" ? "Producto" : "Servicio";
  const Icon  = kind === "PRODUCT" ? Package : Wrench;
  // F1.3 G4.x #10-D — alineado al mapping del Simulador:
  // PRODUCT=violet, SERVICE=green. Antes estaba invertido en este panel.
  const componentType: ComponentTypeKey = kind === "PRODUCT" ? "PRODUCT" : "SERVICE";
  const defaultExpanded = aggregate.count === 1;
  const summaryText = (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span>Items: <span className="font-medium text-text/90 tabular-nums">{aggregate.count}</span></span>
    </div>
  );
  const rightValue = aggregate.totalValue != null
    ? <>Total: <span className="text-text">{fmtMoney(aggregate.totalValue, currency)}</span></>
    : null;
  const rightSub = aggregate.totalValue != null && qtyLine > 1
    ? <>Doc.: {fmtMoney(aggregate.totalValue * qtyLine, currency)}</>
    : null;

  return (
    <GroupAccordion
      Icon={Icon}
      componentType={componentType}
      title={title}
      summary={summaryText}
      rightValue={rightValue}
      rightSub={rightSub}
      defaultExpanded={defaultExpanded}
    >
      {/* Tabla compacta — un row por item con campos del mockup. */}
      <div className="space-y-1 text-[11px]">
        {items.map((it, i) => {
          const name = it.catalogItemName ?? it.catalogItemCode ?? "—";
          const code = it.catalogItemCode && it.catalogItemCode !== name
            ? it.catalogItemCode : null;
          // Bonif/Recargo display (passthrough de lineAdjAmount).
          const adjKind   = it.lineAdjKind   ?? null;
          const adjType   = it.lineAdjType   ?? null;
          const adjValue  = it.lineAdjValue  ?? null;
          const adjAmount = it.lineAdjAmount ?? null;
          const showAdj   = adjKind != null && adjAmount != null;
          const adjWord   = adjKind === "BONUS" ? "Bonif." : "Recargo";
          const adjPct    = adjType === "PERCENTAGE" && adjValue != null
            ? ` ${adjValue}%` : "";
          const adjSign   = adjKind === "BONUS" ? "−" : "+";
          const adjCls    = adjKind === "BONUS" ? "text-emerald-500" : "text-amber-500";
          return (
            <div
              key={it.costLineId ?? `${kind.toLowerCase()}-${i}`}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5"
            >
              <span className="font-medium text-text">{name}</span>
              {code && (
                <span className="text-muted">Código: <span className="text-text/90">{code}</span></span>
              )}
              {it.quantity != null && (
                <span className="text-muted">Cantidad: <span className="tabular-nums text-text/90">{it.quantity.toLocaleString("es-AR", { maximumFractionDigits: 4 })}</span></span>
              )}
              {it.unitValue != null && (
                <span className="text-muted">Unitario: <span className="tabular-nums text-text/90">{fmtMoney(it.unitValue, currency)}</span></span>
              )}
              {it.totalValue != null && (
                <span className="text-muted">Total: <span className="tabular-nums font-medium text-text">{fmtMoney(it.totalValue, currency)}</span></span>
              )}
              {showAdj && (
                <span className="text-muted">
                  {adjWord}{adjPct}:{" "}
                  <span className={cn("tabular-nums", adjCls)}>
                    {adjSign}{fmtMoney(Math.abs(adjAmount as number), currency)}
                  </span>
                </span>
              )}
              {it.affectsStock === true && (
                <span className="text-muted">Stock: <span className="text-text/90">Descuenta</span></span>
              )}
            </div>
          );
        })}
      </div>
    </GroupAccordion>
  );
}

// CompositionItemSaleColumn fue eliminado en F1.3 G4.x #10-C: el render
// agrupado de PRODUCTO/SERVICIO consume directamente los items dentro de
// GroupedProductServiceAccordion como filas inline compactas (formato
// ERP financiero). El componente individual ya no se usaba.

/** Fila horizontal de "label: value" inline. Usada dentro de `SaleColumn`
 *  para mostrar 2-3 datos read-only en una sola línea, separados por gap.
 *  Hace `flex-wrap` en mobile cuando no entran. */
function InfoLineRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[11px]">
      {children}
    </div>
  );
}

/** Item de `InfoLineRow`: `label: value` en línea. Si `highlight`, el value
 *  se renderiza en font-semibold (para destacar "Valor venta"). El parámetro
 *  `className` permite tonalidad (ej. tonalidad del margen en Rentabilidad).
 *  `labelTitle` (opcional) agrega un tooltip al wrapper — útil para
 *  conceptos consolidados que necesitan aclaración (ej. "Descuentos"). */
function InfoItem({
  label,
  value,
  highlight,
  className,
  labelTitle,
}: {
  label:      string;
  value:      React.ReactNode;
  highlight?: boolean;
  className?: string;
  labelTitle?: string;
}) {
  return (
    <div className="flex items-baseline gap-1" title={labelTitle}>
      <span className="text-muted">{label}:</span>
      <span
        className={cn(
          "tabular-nums",
          highlight ? "font-semibold text-text" : "text-text/90",
          className,
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** Campo numérico stacked: label ARRIBA (text-[9px] uppercase), input
 *  compacto debajo, sufijo opcional a la derecha del input. Pensado
 *  para alinear varios inputs uno al lado del otro con poco gap dentro
 *  de cada `SaleColumn` (ej. Gramos · Merma, Valor · Bonificación).
 *
 *  Estructura:
 *    LABEL
 *    [ input ] suf
 *
 *  El input tiene un ancho fijo (`w-[126px]`) — coincide con el de
 *  `BonifValue compact` para que los 4 inputs del panel se vean del
 *  mismo tamaño. El componente entero es `inline-block` / `shrink-0`
 *  para que el contenedor padre pueda usar `flex gap-3` y los acerque
 *  sin separarlos con `justify-between`. */
function InlineNumberField({
  label,
  value,
  onChange,
  decimals,
  suffix,
  readOnly,
  step,
}: {
  label:     string;
  value:     number;
  onChange:  (v: number | null) => void;
  decimals?: number;
  suffix?:   string;
  readOnly?: boolean;
  /** Incremento que aplica al usar ↑/↓ o el spinner del input.
   *  Default `undefined` → TPNumberInput usa el step por default (típicamente 1).
   *  Pasar valores fraccionales (ej. 0.05) para granularidad fina. */
  step?:     number;
}) {
  return (
    <div className="shrink-0">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-muted/70">
        {label}
      </div>
      <div className="mt-0.5 flex items-center gap-1">
        <div className="w-[126px] shrink-0">
          <TPNumberInput
            value={value}
            onChange={onChange}
            decimals={decimals}
            min={0}
            compact
            readOnly={readOnly}
            {...(step != null ? { step } : {})}
          />
        </div>
        {suffix && (
          <span className="w-3 shrink-0 text-[9px] text-muted/70">{suffix}</span>
        )}
      </div>
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
  compact,
}: {
  line:      DocumentLine;
  appliesTo: AppliesTo;
  onApply:   (patch: LineOverridePatch) => void;
  /** Si true, el TPNumberInput usa el ancho compacto (`w-[126px]`)
   *  para igualarse a los otros inputs del panel sale view (Gramos /
   *  Merma / Valor en `InlineNumberField`). Default false → mantiene
   *  el ancho original de 140px que usan las pantallas legacy. */
  compact?: boolean;
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
      <div className={cn("shrink-0", compact ? "w-[126px]" : "w-[140px]")}>
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
