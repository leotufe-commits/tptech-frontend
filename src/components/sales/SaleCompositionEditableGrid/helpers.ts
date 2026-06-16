// src/components/sales/SaleCompositionEditableGrid/helpers.ts
// =============================================================================
// Helpers PUROS extraídos del monolito original. Cero React, cero JSX, cero
// matemática comercial nueva — agregaciones / persistencia de layout. Idénticos
// al código original; las firmas y semánticas se conservan al pie de la letra.
// =============================================================================

import { resolveSaleForRowDisplay } from "../../../lib/pricing/display/saleCompositionDisplay";
import {
  EPS,
  COL_WIDTHS_DEFAULTS,
  COL_WIDTHS_MINS,
  COL_WIDTHS_STORAGE,
} from "./constants";

export function nearlyEqual(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) < EPS;
}

/** Lee anchos persistidos en localStorage; cae a defaults si falta o está
 *  corrupto. Acepta sólo arrays de N números (mismo length que defaults). */
export function loadPersistedColWidths(): number[] {
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
export function buildGridTemplateColumns(widths: number[]): string {
  const middle = widths.map((w) => `${w}px`).join(" ");
  return `24px ${middle} 28px`;
}

// Subtotal de COSTO del grupo, expandido por `qtyLine` del documento para
// quedar en la misma escala que la columna "Costo Total" de cada fila
// detalle (`lineCost × line.quantity`). Sin `qtyLine` (default 1) mantiene
// el comportamiento legacy.
export function sumGroupLineCost(items: any[], qtyLine: number = 1): number | null {
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
 * snapshot) y se EXPANDE por `qtyLine` del documento para quedar en la misma
 * escala que la fila "Costo Total" (`× line.quantity`). Regla unificada para
 * TODOS los grupos (METAL/HECHURA/PRODUCT/SERVICE):
 *   totalGrupoVisual = Σ(componente.cantidad) × cantidadLíneaDocumento
 * `qtyOf` devuelve la cantidad POR UNIDAD; el `× qtyLine` se aplica acá (una
 * sola fuente), nunca en el caller. Sin `qtyLine` (default 1) = legacy.
 * Devuelve `null` si ninguna línea aporta cantidad finita.
 */
export function sumGroupQuantity(
  items: any[],
  qtyOf: (it: any) => number | null,
  qtyLine: number = 1,
): number | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  // Mismo guard que `sumGroupLineCost` → costo y cantidad del "Total <grupo>"
  // quedan SIEMPRE en la misma escala (paridad visual).
  const q = Number.isFinite(qtyLine) && qtyLine > 1 ? qtyLine : 1;
  let total = 0;
  let any = false;
  for (const it of items) {
    const v = qtyOf(it);
    if (v != null && Number.isFinite(v)) {
      total += v * q;
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
export function sumGroupLineSaleDisplay(
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
    // RECETA BASE — la composición usa por fila el MISMO valor que muestra el
    // detalle: `lineSalePreRounding` (PRE redondeo físico/comercial del metal) y
    // cae a `lineSale` cuando no existe (hechura/productos/servicios = margen, ya
    // PRE; o metal sin redondeo). Así el footer = Σ filas detalle POR
    // CONSTRUCCIÓN — mismo origen, cero diferencia. El redondeo vive en el
    // Resumen Comercial, nunca acá.
    const lineSalePre = (it as any)?.lineSalePreRounding;
    const lineSaleRaw =
      lineSalePre != null && Number.isFinite(Number(lineSalePre))
        ? lineSalePre
        : ((it as any)?.lineSale ?? null);
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

// ── Ajuste global del ARTÍCULO sobre el COSTO — DISPLAY de composición ───────
// Para explicar visualmente el ajuste global (bonif/recargo del artículo) en la
// columna Costo total, se reaplica su PORCENTAJE sobre el costo de cada
// componente: base → ±%·base → costo final. Como el % es uniforme, aplicarlo a
// cada costo de fila es aritméticamente consistente (Σ filas = costoLínea × %),
// sin prorrateo. NATURALEZA: display de composición/costo, NO motor (el cálculo
// del costo ajustado ya existe; esto solo descompone el porcentaje para mostrar
// la cadena). `null` cuando no hay ajuste porcentual.
export function computeGlobalCostImpact(
  costTotal: number | null | undefined,
  pct: number | null | undefined,
  kind: "BONUS" | "SURCHARGE",
): { after: number; impact: number } | null {
  if (costTotal == null || !Number.isFinite(Number(costTotal))) return null;
  if (pct == null || !Number.isFinite(Number(pct)) || Number(pct) === 0) return null;
  const c = Number(costTotal);
  const impact = (c * Number(pct)) / 100;
  const after = kind === "SURCHARGE" ? c + impact : c - impact;
  return { after, impact };
}

// ── Mapeo `comboAdjustment*` → shape del bloque "AJUSTE GLOBAL" ──────────────
// El combo guarda su ajuste comercial en `comboAdjustmentKind/Value` (config del
// artículo, propagada al `pricingMeta`). Esta función lo traduce al MISMO shape
// que consume el bloque existente "AJUSTE GLOBAL" (`CostAdjustmentDetailSection`:
// `{kind, type, value, amount}`), para REUSAR ese bloque — sin tarjeta nueva.
// Fuente única: combos → este mapeo; normales → `composition.costAdjustment`.
// NO calcula montos: `amount` queda `null` (el monto en pesos del ajuste del
// combo no está disponible en el frontend; sí se ve la bonif/recargo). El precio
// del input ya viene post-ajuste del motor. `null` ⇒ no hay ajuste que mostrar.
export function comboAdjustmentToCostAdjustmentData(
  kind: string | null | undefined,
  value: number | null | undefined,
  // Monto del ajuste (motor, `COMBO_PRICE.meta.adjustmentAmount`). Cuando llega,
  // el bloque muestra "Bonificación 10%: −$Y". Cuando no (preview legacy sin el
  // step), queda `null` y solo se ve la etiqueta. NUNCA se calcula en el FE.
  amount: number | null = null,
): {
  kind:   "BONUS" | "SURCHARGE" | null;
  type:   "PERCENTAGE" | "FIXED_AMOUNT" | null;
  value:  number | null;
  amount: number | null;
} | null {
  if (!kind || kind === "NONE") return null;
  if (value == null || !Number.isFinite(value)) return null;
  const amt = amount != null && Number.isFinite(amount) ? amount : null;
  switch (kind) {
    case "DISCOUNT_PERCENT":  return { kind: "BONUS",     type: "PERCENTAGE",   value, amount: amt };
    case "DISCOUNT_FIXED":    return { kind: "BONUS",     type: "FIXED_AMOUNT", value, amount: amt };
    case "SURCHARGE_PERCENT": return { kind: "SURCHARGE", type: "PERCENTAGE",   value, amount: amt };
    default: return null;
  }
}

// ── Lectura del step COMBO_PRICE (Modelo A) — passthrough puro ───────────────
// El motor emite `pricing.steps[COMBO_PRICE].meta` con la trazabilidad completa
// del precio del combo. El mapper backend (`sales.service.ts`, whitelist) ya lo
// serializa dentro de `pricingMeta.pricingSteps`. Esta función SOLO lo localiza
// y normaliza a número — cero matemática comercial: no divide %, no deriva, no
// reconstruye. Devuelve `null` si el step no llegó (combo sin ajuste resuelto o
// preview legacy) → el frontend cae al comportamiento anterior.
export type ComboPriceMeta = {
  subtotal:         number;   // precio PRE-ajuste (Σ componentes), POR UNIDAD
  adjustmentKind:   string;   // NONE | DISCOUNT_PERCENT | DISCOUNT_FIXED | SURCHARGE_PERCENT
  adjustmentValue:  number | null;
  adjustmentAmount: number;   // monto del ajuste (magnitud), POR UNIDAD
  finalPrice:       number;   // precio POST-ajuste (= comboDerivedPrice), POR UNIDAD
};

export function extractComboPriceMeta(pricingSteps: unknown): ComboPriceMeta | null {
  if (!Array.isArray(pricingSteps)) return null;
  const step = pricingSteps.find((s: any) => s?.key === "COMBO_PRICE");
  const m = (step as any)?.meta;
  if (!m) return null;
  const subtotal   = Number(m.subtotal);
  const finalPrice = Number(m.finalPrice);
  if (!Number.isFinite(subtotal) || !Number.isFinite(finalPrice)) return null;
  const adjustmentAmount = Number(m.adjustmentAmount);
  const adjustmentValue  = m.adjustmentValue != null && Number.isFinite(Number(m.adjustmentValue))
    ? Number(m.adjustmentValue)
    : null;
  return {
    subtotal,
    adjustmentKind:   typeof m.adjustmentKind === "string" ? m.adjustmentKind : "NONE",
    adjustmentValue,
    adjustmentAmount: Number.isFinite(adjustmentAmount) ? adjustmentAmount : 0,
    finalPrice,
  };
}
