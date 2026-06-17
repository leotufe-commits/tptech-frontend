// src/components/sales/SaleCompositionEditableGrid/index.tsx
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
// Etapa C — orquestador delgado tras la partición del monolito original
// (3.588 líneas). Tipos / constantes / helpers / hooks / sub-componentes
// viven en módulos hermanos. Cero cambios de comportamiento ni de props
// públicas. Tests importan desde este barrel (compat).
// =============================================================================

import React, { useEffect, useRef } from "react";
import {
  RotateCcw, X as XIcon,
  Gem, Hammer, Package, Wrench,
} from "lucide-react";

import { cn } from "../../ui/tp";
import {
  formatMoneyDoc as fmtMoney,
  formatGrams,
} from "../../../lib/pricing/format";
import {
  patchCostLineOverride,
  findCostLineOverride,
} from "../../../lib/pricing/cost-line-overrides";
import type { CostLineOverride } from "../../../services/sales";
import {
  resolveItemCurrencyDisplay,
  resolveSaleForRowDisplay,
  resolveMarginForRowDisplay,
  buildMetalParentSaleTotals,
  resolveCommercialPostGrams,
  pickLineCommercialRoundingMetals,
  computeMetalSaleFactor,
  type CurrencyByIdMap,
} from "../../../lib/pricing/display/saleCompositionDisplay";

import type {
  SaleCompositionEditableGridProps,
} from "./types";
import { COL_WIDTHS_STORAGE, READ_ONLY_TOOLTIP } from "./constants";
import {
  loadPersistedColWidths,
  buildGridTemplateColumns,
  sumGroupLineCost,
  sumGroupQuantity,
  sumGroupLineSaleDisplay,
  comboAdjustmentToCostAdjustmentData,
  extractComboPriceMeta,
  computeGlobalCostImpact,
} from "./helpers";
import { TableLayoutContext } from "./context";
import { useFlashOnChange } from "./hooks/useFlashOnChange";
import { CellNumberInput } from "./parts/CellNumberInput";
import { MermaLabelEditor } from "./parts/MermaLabelEditor";
import { AdjustmentLabelEditor } from "./parts/AdjustmentLabelEditor";
import { MetalGlobalAdjustmentBadge } from "./parts/MetalGlobalAdjustmentBadge";
import { TableHeader } from "./parts/TableHeader";
import { TypeGroupHeader } from "./parts/TypeGroupHeader";
import { TypeGroupFooter } from "./parts/TypeGroupFooter";
import { Row } from "./parts/EditableRow";
import { EmptyState } from "./parts/EmptyState";
import { GlobalAdjustmentsBlock } from "./parts/GlobalAdjustmentsBlock";

// Importar la versión "bare" del % para el sub-line "Aj. global" — se mantiene
// adentro del componente principal (cero matemática nueva).
import { formatByType } from "../../../lib/pricing/format";

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports de compatibilidad
//
// Tests existentes y `TPDocumentLineAdvancedEditor` siguen importando estos
// símbolos vía `from "../sales/SaleCompositionEditableGrid"`. Mantenemos la
// firma pública estable.
// ─────────────────────────────────────────────────────────────────────────────

export {
  resolveItemCurrencyDisplay,
  resolveSaleForRowDisplay,
  resolveMarginForRowDisplay,
};
export type { CurrencyByIdMap };
export type {
  AppliesTo,
  LineOverridePatch,
  SaleGlobalAdjustments,
  SaleCompositionEditableGridProps,
  MermaSource,
} from "./types";

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
  documentFxRate = 1,
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

  // UX combo (display-only): el combo comercial muestra sus COMPONENTES como
  // capa de auditoría. Identidad CANÓNICA del combo (backend SSOT + editor de
  // línea): `costMode === "COMBO" || priceSource === "COMBO_COMPONENTS"`. Antes
  // este guard usaba SOLO `costMode === "COMBO"`, más débil que el resto del
  // sistema: cuando el combo llegaba identificado por `priceSource` pero sin
  // `costMode` "COMBO" (p. ej. en saldo DESGLOSADO / snapshots), el encabezado
  // "Composición del combo" desaparecía aunque en UNIFICADO sí aparecía. Alinear
  // a la identidad canónica lo vuelve consistente entre ambos modos de saldo.
  const isComboLine =
    (meta as any)?.costMode === "COMBO" ||
    (meta as any)?.priceSource === "COMBO_COMPONENTS";
  // ── COMBO_PRICE (Modelo A) — trazabilidad del precio del combo ────────────
  // Passthrough del step que el motor ya calcula (`pricingMeta.pricingSteps`).
  // Alimenta el bloque AJUSTE GLOBAL (antes → ajuste → final) y la "Venta total"
  // del grupo de componentes con el precio comercial real del combo. Si el step
  // no llegó (combo sin ajuste resuelto / preview legacy) → null → fallback.
  const comboPriceMeta = isComboLine
    ? extractComboPriceMeta((meta as any)?.pricingSteps)
    : null;

  // ── Ajuste global del ARTÍCULO (bonif/recargo) — fuente ÚNICA ──────────────
  // El mismo dato que alimenta el bloque inferior "AJUSTE GLOBAL": combo →
  // `comboAdjustment*` (vía COMBO_PRICE); normal → `composition.costAdjustment`.
  // Se extrae acá una sola vez para (a) el bloque inferior y (b) el desglose
  // visual por componente en la columna Costo total. `{kind, type, value, amount}`.
  const globalCostAdjData = isComboLine
    ? comboAdjustmentToCostAdjustmentData(
        comboPriceMeta?.adjustmentKind  ?? (meta as any)?.comboAdjustmentKind,
        comboPriceMeta?.adjustmentValue ?? (meta as any)?.comboAdjustmentValue,
        comboPriceMeta?.adjustmentAmount ?? null,
      )
    : ((meta as any)?.composition?.costAdjustment ?? null);
  // % del ajuste global (solo modo PORCENTAJE) + kind, para el desglose por
  // componente. En modo monto fijo no hay % que reaplicar → null.
  const globalCostPct =
    globalCostAdjData != null
    && globalCostAdjData.type === "PERCENTAGE"
    && globalCostAdjData.value != null
    && Number.isFinite(Number(globalCostAdjData.value))
      ? Number(globalCostAdjData.value)
      : null;
  const globalCostKind: "BONUS" | "SURCHARGE" =
    globalCostAdjData?.kind === "SURCHARGE" ? "SURCHARGE" : "BONUS";

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

  // NOTA: el "Aj. global −X%" por fila (FASE 12.11) fue ELIMINADO del grid de
  // costo (contrato visual: la columna Costo total muestra SOLO costo). El
  // impacto del ajuste global se visualiza únicamente en el bloque inferior
  // "AJUSTE GLOBAL". El dato sigue en `pricingMeta.documentAdjustments` para
  // otros consumidores; acá ya no se renderiza.

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

  // ── Desglose visual del ajuste global por componente (columna Costo total) ─
  // Reaplica el % del ajuste global del artículo (`globalCostPct`/`globalCostKind`)
  // sobre el costo base de la fila → { base, pct, impact, after }. Display puro
  // (helpers `computeGlobalCostImpact`): el costo ya viene del motor, acá solo se
  // descompone el porcentaje para mostrar base → ±% GLOBAL → ±$ → costo final.
  // `null` cuando no hay ajuste global porcentual (entonces la celda muestra
  // solo el costo, como siempre).
  const buildGlobalCost = (costBase: number | null) => {
    const r = computeGlobalCostImpact(costBase, globalCostPct, globalCostKind);
    if (r == null || globalCostPct == null) return null;
    return { pct: globalCostPct, impact: r.impact, after: r.after, kind: globalCostKind };
  };

  // ── Footer "Total <grupo>": costo POST ajuste global (paridad con las filas) ─
  // El footer debe mostrar el MISMO estado económico que la columna "Costo
  // Total" de cada fila — que ya usa `buildGlobalCost(...).after`. Reutiliza ese
  // helper sobre el subtotal del grupo: como el % del ajuste global es uniforme,
  // aplicarlo al Σ del grupo es idéntico a Σ de los `after` por fila (sin
  // matemática nueva; mismo `computeGlobalCostImpact` que las filas). Sin ajuste
  // global → `buildGlobalCost` devuelve null y queda el costo base (comportamiento
  // previo). Cierra la divergencia fila/header (POST) vs footer (PRE).
  const groupCostPost = (items: any[]): number | null => {
    const base = sumGroupLineCost(items, qtyLine);
    const adjusted = buildGlobalCost(base);
    return adjusted != null ? adjusted.after : base;
  };

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
    // ARTÍCULO NORMAL: el margen de lista se mide contra el COSTO AJUSTADO (post
    // ajuste global), porque el motor construye `saleLineValue` sobre el costo
    // ajustado → `(sale − costoAjustado)/costoAjustado` = margen de la lista (85%).
    //
    // COMBO: la venta de cada componente viene de la LISTA, anclada al costo de
    // LISTA (pre ajuste global), no al costo post-global. El "Ajuste Global"
    // (−10%) baja el costo pero NO la venta del componente, así que medir contra
    // el costo post-global INFLA el margen (ej. 105,56% en vez del 85% de la
    // lista). Por eso el combo mide contra `lineCost` (costo de lista, pre-global)
    // → muestra el margen real de la lista. El artículo normal queda igual.
    const adjForMargin = buildGlobalCost(lineCost);
    const costForMargin = isComboLine
      ? lineCost
      : (adjForMargin != null ? adjForMargin.after : lineCost);
    const margin = resolveMarginForRowDisplay(
      costForMargin,
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

  // Σ de los `lineCost` (metal/hechura) y `totalValue` (producto/servicio)
  // del motor — TODOS son montos POR UNIDAD DE ARTÍCULO. Para mostrar el
  // total de la línea factura se multiplica por `line.quantity` (agregación
  // trivial, no recálculo comercial; mismo patrón que `headerSaleTotal`).
  const totalComponentsUnit =
    (sumSale(metals,   "lineCost")   ?? 0) +
    (sumSale(hechuras, "lineCost")   ?? 0) +
    (sumSale(products, "totalValue") ?? 0) +
    (sumSale(services, "totalValue") ?? 0);
  const qtyForLine = Number.isFinite(line.quantity) ? line.quantity : 1;
  // ── Costo TOTAL de línea (no unitario) ───────────────────────────────────
  // Antes el header mostraba `totalComponentsUnit` y la "Venta" ya estaba
  // multiplicada por qty → mezcla unitario vs total. Ahora ambos son TOTALES
  // línea, coherentes con el rol del header como "resultado final" — el
  // desglose unitario (× qty = total) vive en la tabla de abajo.
  const totalComponents = totalComponentsUnit * qtyForLine;
  const showTotalSum = metals.length + hechuras.length + products.length + services.length > 0;
  // ── Costo POST-ajuste global (Costo Ajustado) — el que sostiene la Venta ──
  // El motor ya lo emite como `meta.unitCost` (= `adjusted` del step
  // COST_LINES_FINAL, post bonif/recargo global). `totalComponents` es la SUMA
  // PRE-ajuste de los componentes (Costo Base); NO es el costo final cuando hay
  // ajuste global. Header "Costo total línea" y el resumen "Costo total" deben
  // mostrar el POST. Escalado × qty (agregación trivial, mismo patrón que
  // `totalComponents` / `headerSaleTotal`). Fallback a `totalComponents` cuando
  // `unitCost` no es finito (costo parcial) o no hay ajuste (POST === PRE).
  const unitCostPost = Number((meta as any)?.unitCost);
  const costTotalPost =
    showTotalSum
      ? (Number.isFinite(unitCostPost) ? unitCostPost * qtyForLine : totalComponents)
      : null;
  // Fase 2.1 — flash en "Total componentes" cuando el preview backend
  // devuelve un nuevo valor (post-edit). Mismo highlight sutil del margen.
  // Sigue al valor mostrado (POST-ajuste).
  const flashTotal = useFlashOnChange(costTotalPost);
  // Fase 2.6.2 — VALOR DE VENTA del header. Mismo campo que el KPI inferior
  // (basePrice × qty con fallback a unitPrice × qty). Ver Fase 2.6.1.
  const headerSaleUnitPrice =
    Number.isFinite((meta as any)?.basePrice) ? (meta as any).basePrice
    : Number.isFinite(line.unitPrice)         ? line.unitPrice
    : null;
  const headerSaleTotal = headerSaleUnitPrice != null
    ? headerSaleUnitPrice * qtyForLine
    : null;
  const flashHeaderSale = useFlashOnChange(headerSaleTotal);
  // ── COMBO de un solo componente — "Venta total" de la fila = finalPrice ───
  // Cuando el combo tiene UN solo componente, esa fila representa al combo
  // entero. Su celda "Venta total" debe mostrar el precio comercial del combo
  // POST-ajuste (`COMBO_PRICE.meta.finalPrice` × qty) — el MISMO valor que el
  // input, "Venta total línea" y el footer — NO el sale del componente (que es
  // el subtotal PRE-ajuste). Passthrough puro del motor, cero matemática. Para
  // combos multi-componente las filas siguen siendo auditoría (cada una su sale)
  // y el finalPrice vive en el footer "Total productos".
  const comboSingleRowFinalSale =
    comboPriceMeta != null && products.length === 1 && services.length === 0
      ? comboPriceMeta.finalPrice * qtyForLine
      : null;

  return (
    <TableLayoutContext.Provider value={gridTpl}>
    <div className="space-y-2" data-testid="sale-composition-editable-grid">
      {/* Banner exclusivo de COMBO eliminado — rompía el patrón visual: en
          productos/servicios no hay caja previa equivalente. El combo ahora
          usa el mismo patrón de grupo (PRODUCTOS · N líneas → filas → Total
          productos) que el resto. La identidad de combo sigue viva en la
          lógica (`isComboLine`) para Venta total / Margen / AJUSTE GLOBAL. */}
      {/* Combos — nota de edición parcial. Cantidad y Merma/Ajuste de cada
          componente son editables; el Valor unitario queda fijo (sale de la
          lista del combo). Al editar, el override viaja al backend y el motor
          recalcula Costo total / Margen / precio — el frontend NO calcula. */}
      {isComboLine && (
        <div
          className="rounded-md border border-border/30 bg-surface2/30 px-2.5 py-1.5 text-[10px] leading-snug text-muted/85"
          data-testid="combo-composition-note"
        >
          <span className="font-semibold text-text/90">Composición del combo.</span>{" "}
          Podés editar <span className="text-text/90">Cantidad</span> y{" "}
          <span className="text-text/90">Merma / Ajuste</span> de cada componente;
          el precio y el costo los recalcula el sistema. El{" "}
          <span className="text-text/90">Valor unitario</span> queda fijo (sale de
          la lista del combo).
        </div>
      )}
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.04em] text-muted/75">
          {/* Fase 2.7.a — el card muestra composición de COSTO; el
              "Valor de venta neto" vive en su sección destacada (inline
              + KPI inferior). Title alineado con la realidad funcional. */}
          {isComboLine ? "Composición del combo" : "Composición del costo del artículo"}
          {/* T6 — label visual "Recalculando…" removido del header del card.
              Era tan fugaz (200-500ms del debounce + RTT del preview) que
              visualmente parecía un parpadeo. La grilla mantiene el último
              valor válido del preview hasta que llega el siguiente —
              `previewLoading` se sigue recibiendo por la prop por compat
              (otros consumidores pueden usarlo) pero NO se renderiza acá. */}
          {void previewLoading}
          {showTotalSum && (
            <span className="ml-2 normal-case text-muted/60">
              {/* UX: el header funciona como "resumen final de la línea".
                  Renombrado a "Costo total línea" para que conceptualmente
                  matchee con "Venta total línea" — ambos son totales línea,
                  no unitarios. El desglose unitario × cantidad vive en la
                  tabla de abajo. */}
              · Costo total línea:{" "}
              <span className={cn(
                "font-semibold text-text/90 tabular-nums rounded px-1 transition-colors duration-500",
                flashTotal,
              )}>
                {fmtMoney(costTotalPost ?? totalComponents, currency)}
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
          {/* UX: "Venta total línea" — par conceptual con "Costo total línea".
              Ambos son totales línea (basePrice × line.quantity), sin
              impuestos. Refuerza el rol del header como resumen final. */}
          {headerSaleTotal != null && (
            <span className="ml-2 normal-case text-muted/60">
              · Venta total línea:{" "}
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
        <EmptyState />
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
              // Segmento 2 del header — gramos FINALES del metal padre (con
              // merma + margen) escalados a la línea. Origen único:
              // `buildMetalParentSaleTotals` = costEquivGr × metalSaleFactor
              // (= `padre.totalEquivGr * metalSaleFactor` de MetalSaleCard,
              // donde costEquivGr ya incluye pureza × (1+merma/100)). El
              // factor sale del MISMO helper que usa el Simulador
              // (`computeMetalSaleFactor`). Cero recálculo / cero fórmula
              // paralela. Se multiplica por la cantidad de la línea para
              // mostrar el TOTAL (paridad: per-unit × qtyLine).
              const qSafe =
                Number.isFinite(qtyLine) && (qtyLine as number) > 0 ? (qtyLine as number) : 1;
              const metalSaleFactor = computeMetalSaleFactor({
                metalCost: (meta as any)?.metalCost != null && Number.isFinite(Number((meta as any).metalCost))
                  ? Number((meta as any).metalCost) : null,
                metalSale: (meta as any)?.metalSale != null && Number.isFinite(Number((meta as any).metalSale))
                  ? Number((meta as any).metalSale) : null,
              });
              // Único chip de METAL en el header: metal PADRE consolidado
              // ("Padre: N gr"), gramos finales (pureza × merma × margen) ×
              // cantidad de la línea. Las variantes con "=" se eliminaron.
              const equivGramsByMetalPre = buildMetalParentSaleTotals(metals as any[], metalSaleFactor)
                .map((m) => ({ name: m.name, metalParentId: m.metalParentId, grams: m.saleEquivGr * qSafe }));
              // Etapa D' (cierre conceptual) — swap pre → POST-redondeo
              // comercial cuando exista `commercialRoundingContext` BREAKDOWN
              // con metal físico.
              //
              // R-COMMERCIAL-ROUNDING-VISIBILITY: cuando el snapshot del
              // Redondeo Comercial existe, el header debe mostrar el
              // RESULTADO COMERCIAL FINAL del documento (los `postGrams`
              // agregados por metal padre). La visualización NO depende de
              // `appliedToLineCount`. El conteo es metadata informativa
              // (badge "Aplicado a nivel comprobante") y nunca se usa para
              // ocultar, suprimir o degradar valores comerciales.
              //
              // El flag visual `· red. comercial` (`commercialRoundingActive`)
              // ancla el sentido del valor: el operador sabe que está viendo
              // el resultado del redondeo comercial del comprobante.
              //
              // REGLA DE ORO: backend calcula `postGrams`. Frontend solo lee
              // y reemplaza el valor `grams` del chip por el del snapshot
              // — cero recálculo, cero matemática.
              // Fuente del Redondeo Comercial POR LÍNEA (prioridad: PER_DOCUMENT
              // per-línea → PHYSICAL per-línea `appliedRounding.physical.metals`
              // → doc-level legacy). MISMA fuente que el footer.
              //
              // NOTA (2026-06-05): este chip del header del grid mantiene a
              // propósito el fallback documental (R-COMMERCIAL-ROUNDING-VISIBILITY:
              // en PER_DOCUMENT homogéneo muestra el `postGrams` agregado + flag
              // "red. comercial"). En MIXTO el backend emite
              // `commercialRoundingContext = null`, por lo que acá igual cae a la
              // fuente per-línea (`lineCommercialRoundingMetals`). El card per-línea
              // del artículo (`TPDocumentLineAdvancedEditor`) SÍ bloquea el
              // documental (`allowDocLevelFallback: false`) — esa es la superficie
              // que exige independencia estricta entre líneas.
              const crMetalsSource = pickLineCommercialRoundingMetals(meta);
              const equivGramsByMetal = crMetalsSource.length > 0
                  ? equivGramsByMetalPre.map((entry) => {
                      // Match por `metalParentId` (canónico); fallback por
                      // nombre solo para snapshots legacy. Passthrough: el FE
                      // solo reemplaza `grams` por el `postGrams` del snapshot.
                      const post = resolveCommercialPostGrams(
                        { metalParentId: entry.metalParentId, name: entry.name },
                        crMetalsSource,
                      );
                      return post != null ? { ...entry, grams: post } : entry;
                    })
                  : equivGramsByMetalPre;
              // Si al menos un metal del chip fue reemplazado por su postGrams
              // del snapshot, marcamos el flag visual "red. comercial".
              const commercialRoundingActive =
                crMetalsSource.length > 0
                && equivGramsByMetal.some((after, i) => after.grams !== equivGramsByMetalPre[i]?.grams);
              return (
                <TypeGroupHeader
                  label="Metales"
                  count={metals.length}
                  subtotal={sumGroupLineCost(metals, qtyLine)}
                  currency={currency}
                  type="METAL"
                  equivGramsByMetal={equivGramsByMetal}
                  commercialRoundingActive={commercialRoundingActive}
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
              void postMermaPerGramText;
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
              void totalRow;
              // F1.5 #A++ — `lineSale` per METAL ahora viene canónico del motor
              // (passthrough exacto: lineCost × metalSale/metalCost). Para
              // snapshots legacy sin este campo, fallback a `metalSaleCanonical`
              // (válido solo cuando count===1, sino "—").
              // F1.6 — la fila DETALLE de Composición muestra la receta BASE:
              // prioriza `lineSalePreRounding` (venta del cost-line PRE redondeo
              // físico/comercial del metal) y cae a `lineSale` (POST) cuando no
              // existe — así la fila coincide con el footer (que ya usa el agregado
              // PRE). El redondeo vive en el Resumen Comercial / card, no acá.
              const metalLineSalePre = (m as any)?.lineSalePreRounding;
              const metalLineSale =
                metalLineSalePre != null && Number.isFinite(Number(metalLineSalePre))
                  ? metalLineSalePre
                  : (m as any)?.lineSale;
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
                  participacionText={commercialCells.participacionText}
                  // FASE 12.5 — etiquetas para sub-línea Cantidad y prefijo
                  // moneda en Costo unit. (rendering al nivel de RowImpl).
                  // FASE 12.5b — nombre amigable completo: METAL siempre en
                  // gramos; usamos `resolveUnitName` para tomarlo del catálogo
                  // (`unitNameByCode`) si existe, con fallback "Gramos".
                  quantityUnitLabel={resolveUnitName("g", "Gramos")}
                  currencyLabel={currency}
                  quantityCell={
                    <div className="flex flex-col gap-0.5">
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
                      {/* Sub-label "Total" — SOLO METAL y SOLO cuando la
                          cantidad de la línea > 1. Display puro: gramos
                          unitarios × cantidad de la línea = gramos totales.
                          `formatGrams` config-aware; el input sigue siendo el
                          gramo unitario editable (no se toca).
                          Estilo unificado con los labels de fórmula auxiliar
                          de Costo total / Venta total (`text-[9px]
                          text-muted/65 leading-tight`) — todas las
                          explicaciones secundarias de la tabla comparten
                          ahora el mismo lenguaje visual. */}
                      {qtyLine > 1 && qtyValue != null && Number.isFinite(Number(qtyValue)) && (
                        <span
                          data-testid="metal-qty-total"
                          className="block w-full text-right text-[9px] tabular-nums leading-tight text-muted/65"
                          title="Gramos totales de la línea (gramos unitarios × cantidad)"
                        >
                          {`Total: ${formatGrams(Number(qtyValue) * qtyLine, 2)} gr`}
                        </span>
                      )}
                    </div>
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
                  // Debajo, indicador READ-ONLY del Ajuste Global del artículo
                  // (consistencia visual con HECHURA/PRODUCT/SERVICE, que muestran
                  // su ajuste en esta columna). Passthrough de
                  // `composition.costAdjustment` — el mismo dato del resumen
                  // inferior; cero matemática. Combos → costAdjustment null → no
                  // renderea (no mezcla con comboAdjustment).
                  mermaOrAdjustmentCell={
                    <div className="flex flex-col items-center gap-0.5">
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
                      {/* UX 2026-06-13 — el % del ajuste global se unificó en el
                          label de "Costo total" ("GLOBAL (−10%)"), así que el
                          badge de % en "Merma / Ajuste" se oculta para evitar la
                          doble lectura. Se MANTIENE solo para ajustes
                          FIXED_AMOUNT (`globalCostPct == null`): ahí "Costo total"
                          no emite subdetalle de %, así que el badge es el único
                          indicador del ajuste en la fila. */}
                      {globalCostPct == null && (
                        <MetalGlobalAdjustmentBadge
                          data={(meta as any)?.composition?.costAdjustment ?? null}
                          currency={currency}
                        />
                      )}
                    </div>
                  }
                  // Costo Total del componente para la línea de factura completa
                  // (= `lineCost × line.quantity`). Display puro — `lineCost`
                  // viene post-conv post-adj por unidad de artículo desde el
                  // motor; multiplicar por la qty del documento NO recalcula
                  // precios, sólo expande el subtotal a la escala "línea
                  // factura", simétrico a la columna Venta.
                  saleValueValue={totalForRow(lineCost)}
                  saleValueText={fmt(totalForRow(lineCost))}
                  globalCost={buildGlobalCost(totalForRow(lineCost))}
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
                  // Fórmula auxiliar "qty × unitario" debajo de los totales.
                  // `formulaQuantity` es la cantidad EFECTIVA de la fila de
                  // composición escalada a la línea de factura
                  // (gramos × line.quantity para METAL). Cuando el operador
                  // edita la cantidad/gramos en esta fila, `qtyValue` cambia
                  // y la fórmula se refresca automáticamente — el bug
                  // anterior era pasar `qtyLine` (line.quantity solamente),
                  // que no reflejaba el override de la fila.
                  //
                  // `formulaCostUnit` / `formulaSaleUnit` son los unitarios
                  // POR GRAMO post-merma, derivados como `total / qtyValue`
                  // (división trivial de agregación, no recálculo comercial:
                  // mismo patrón que `postMermaPerGramText` arriba).
                  formulaQuantity={qtyValue != null && Number.isFinite(qtyValue) && Number(qtyValue) > 0
                    ? Number(qtyValue) * qtyLine
                    : null}
                  formulaCostUnit={lineCost != null && qtyValue && Number(qtyValue) > 0
                    ? lineCost / Number(qtyValue)
                    : null}
                  formulaSaleUnit={saleForRow != null && qtyValue && Number(qtyValue) > 0
                    ? saleForRow / Number(qtyValue)
                    : null}
                />
              );
            })}

            </div>
            {/* FASE F7 — Total del grupo METALES. Display only. */}
            {metals.length > 0 && (
              <TypeGroupFooter
                label="metales"
                costTotal={groupCostPost(metals)}
                saleTotal={sumGroupLineSaleDisplay(metals, {
                  qtyLine,
                  marginUnattributable: isMetalMarginUnattributable,
                  unifiedFactor,
                  canonical: metalSaleCanonical,
                })}
                currency={currency}
                // Total METALES = Σ(appliedGrams) × qtyLine (el ×qtyLine lo
                // aplica `sumGroupQuantity`, fuente única — misma escala que
                // `sumGroupLineCost`). Display-only: no recalcula costos.
                quantityTotal={sumGroupQuantity(metals, (it) =>
                  it?.appliedGrams != null && Number.isFinite(Number(it.appliedGrams))
                    ? Number(it.appliedGrams)
                    : null,
                  qtyLine,
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
                documentFxRate,
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
                  globalCost={buildGlobalCost(totalForRow(lineCost))}
                  // FASE 12.10 — Costo de Venta = lineSale (passthrough),
                  // no `lineCost × qty`. Si no hay venta → "—".
                  totalValue={saleForRow != null && qtyValue ? totalForRow(saleForRow) : null}
                  totalText={commercialCells.ventaLineaText}
                  totalTooltip={isUnifiedSaleRow ? "Valor unificado del artículo" : null}
                  manual={!!ov}
                  onResetRow={costLineId ? () => resetCostLine(costLineId) : () => {}}
                  canResetRow={!!ov}
                  formulaQuantity={qtyValue != null && Number.isFinite(qtyValue) && Number(qtyValue) > 0
                    ? Number(qtyValue) * qtyLine
                    : null}
                  formulaCostUnit={lineCost != null && qtyValue && Number(qtyValue) > 0
                    ? lineCost / Number(qtyValue)
                    : null}
                  formulaSaleUnit={saleForRow != null && qtyValue && Number(qtyValue) > 0
                    ? saleForRow / Number(qtyValue)
                    : null}
                />
              );
            })}

            </div>
            {/* FASE F7 — Total del grupo HECHURAS. Display only. */}
            {hechuras.length > 0 && (
              <TypeGroupFooter
                label="hechuras"
                costTotal={groupCostPost(hechuras)}
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
                }, qtyLine)}
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
                documentFxRate,
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
              // Margen del COMBO = margen REAL de lista/composición (NO contra el
              // finalPrice ni contra el costo post-global). Usa `commercialCells`
              // (= `resolveMarginForRowDisplay(costo, productSaleForRow)`), igual
              // que cualquier fila normal. El monto monetario del margen también
              // debe ir contra la VENTA de composición (no contra `comboSingleRow
              // FinalSale`, que sí manda en la columna Venta total): por eso se
              // pasa `marginSaleValueOverride` = venta de composición de la fila.
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
                  marginSaleValueOverride={comboSingleRowFinalSale != null
                    && productSaleForRow != null && qtyValue
                    ? totalForRow(productSaleForRow)
                    : null}
                  ventaLineaText={commercialCells.ventaLineaText}
                  participacionText={commercialCells.participacionText}
                  quantityUnitLabel={(() => {
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
                      step={1}
                      readOnly={!isEditable}
                      tooltip={!isEditable ? READ_ONLY_TOOLTIP : undefined}
                      original={p?.quantity ?? null}
                    />
                  }
                  unitValueCell={
                    <CellNumberInput
                      value={unitValValue}
                      // Combos: el VALOR UNITARIO queda bloqueado (sale de la
                      // lista del combo). Cantidad y Merma/Ajuste sí son editables.
                      onChange={isEditable && !isComboLine && costLineId
                        ? (v) => applyCostLinePatch(costLineId, "PRODUCT", { unitValueOverride: v ?? 0 })
                        : () => {}}
                      formatType="MONEY"
                      decimals={2}
                      step={1}
                      readOnly={!isEditable || isComboLine}
                      tooltip={(!isEditable || isComboLine) ? READ_ONLY_TOOLTIP : undefined}
                      original={p?.unitValue ?? null}
                    />
                  }
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
                  saleValueValue={totalForRow(lineCost)}
                  saleValueText={fmt(totalForRow(lineCost))}
                  globalCost={buildGlobalCost(totalForRow(lineCost))}
                  // COMBO de un solo componente → "Venta total" = finalPrice del
                  // combo (post-ajuste). Multi-componente / normales: sale de la
                  // fila (passthrough del motor, sin cambios).
                  totalValue={comboSingleRowFinalSale != null
                    ? comboSingleRowFinalSale
                    : (productSaleForRow != null && qtyValue ? totalForRow(productSaleForRow) : null)}
                  totalText={comboSingleRowFinalSale != null
                    ? fmt(comboSingleRowFinalSale)
                    : commercialCells.ventaLineaText}
                  totalTooltip={isUnifiedSaleRow ? "Valor unificado del artículo" : null}
                  manual={!!ov}
                  onResetRow={costLineId ? () => resetCostLine(costLineId) : () => {}}
                  canResetRow={!!ov}
                  formulaQuantity={qtyValue != null && Number.isFinite(qtyValue) && Number(qtyValue) > 0
                    ? Number(qtyValue) * qtyLine
                    : null}
                  formulaCostUnit={lineCost != null && qtyValue && Number(qtyValue) > 0
                    ? lineCost / Number(qtyValue)
                    : null}
                  formulaSaleUnit={productSaleForRow != null && qtyValue && Number(qtyValue) > 0
                    ? productSaleForRow / Number(qtyValue)
                    : null}
                />
              );
            })}

            </div>
            {products.length > 0 && (
              <TypeGroupFooter
                label="productos"
                costTotal={groupCostPost(products)}
                // Venta total: para COMBO, el precio comercial real del combo
                // (`COMBO_PRICE.meta.finalPrice` × qty) — el mismo valor que el
                // input y el header, NO la suma legacy de la composición (Modelo
                // B). Passthrough del motor. Para normales / combos sin step,
                // se conserva la suma por composición de siempre.
                saleTotal={comboPriceMeta != null
                  ? comboPriceMeta.finalPrice * qtyForLine
                  : sumGroupLineSaleDisplay(products, {
                      qtyLine,
                      marginUnattributable: isHechuraMarginUnattributable,
                      unifiedFactor,
                    })}
                currency={currency}
                quantityTotal={sumGroupQuantity(products, (it) =>
                  it?.quantity != null && Number.isFinite(Number(it.quantity))
                    ? Number(it.quantity)
                    : 0,
                  qtyLine,
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
              const secondary = skuOrCode ? (
                <span>{skuOrCode.label}: {skuOrCode.value}</span>
              ) : null;

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
                documentFxRate,
              );
              const { saleForRow: serviceSaleForRow, isUnified: isUnifiedSaleRow } =
                resolveSaleForRowDisplay(
                  serviceLineCostNum,
                  serviceCanonicalSale,
                  unifiedFactor,
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
                  participacionText={commercialCells.participacionText}
                  quantityUnitLabel={(() => {
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
                  saleValueValue={totalForRow(lineCost)}
                  saleValueText={fmt(totalForRow(lineCost))}
                  globalCost={buildGlobalCost(totalForRow(lineCost))}
                  totalValue={serviceSaleForRow != null && qtyValue ? totalForRow(serviceSaleForRow) : null}
                  totalText={commercialCells.ventaLineaText}
                  totalTooltip={isUnifiedSaleRow ? "Valor unificado del artículo" : null}
                  manual={!!ov}
                  onResetRow={costLineId ? () => resetCostLine(costLineId) : () => {}}
                  canResetRow={!!ov}
                  formulaQuantity={qtyValue != null && Number.isFinite(qtyValue) && Number(qtyValue) > 0
                    ? Number(qtyValue) * qtyLine
                    : null}
                  formulaCostUnit={lineCost != null && qtyValue && Number(qtyValue) > 0
                    ? lineCost / Number(qtyValue)
                    : null}
                  formulaSaleUnit={serviceSaleForRow != null && qtyValue && Number(qtyValue) > 0
                    ? serviceSaleForRow / Number(qtyValue)
                    : null}
                />
              );
            })}
            </div>
            {services.length > 0 && (
              <TypeGroupFooter
                label="servicios"
                costTotal={groupCostPost(services)}
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
                  qtyLine,
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

      {/* FASE F20 → REMOVIDO (solo render) 2026-06-13. El recuadro "Ajuste
          global" (`CostAdjustmentDetailSection`) quedó REDUNDANTE: tras unificar
          el costo POST ajuste, la composición ya muestra los valores ajustados
          en TODAS sus superficies — costo por fila (`globalCost.after` + sub-
          línea "±$ GLOBAL"), footers de grupo (`groupCostPost`), header "Costo
          total línea" (POST) y los márgenes contra costo ajustado. El bloque
          solo duplicaba datos ya visibles, así que se deja de renderizar.
          NADA de lógica/datos se eliminó: `globalCostAdjData` / `globalCostPct`
          siguen alimentando `buildGlobalCost` / `groupCostPost`, y el componente
          `CostAdjustmentDetailSection` permanece en el repo por si otra pantalla
          lo necesita — acá simplemente no se renderea. Sin impacto en
          backend / preview / confirm / cálculos. */}

      {/* ── Bloque de ajustes globales (canal/cupón/envío) — fuera del flujo
            principal porque son ajustes doc-level, no de costo del artículo ── */}
      {globalAdjustments && (
        <GlobalAdjustmentsBlock data={globalAdjustments} currency={currency} />
      )}

      {/* ── Card "REDONDEO COMERCIAL" debajo de la composición — ELIMINADO
            (solo render). La info del redondeo comercial vive ahora ÚNICAMENTE
            en el Resumen Comercial del Artículo + el Total del comprobante.
            El snapshot `commercialRoundingContext` sigue intacto en el draft;
            solo se quitó este render duplicado. */}
    </div>
    </TableLayoutContext.Provider>
  );
}

export default SaleCompositionEditableGrid;
