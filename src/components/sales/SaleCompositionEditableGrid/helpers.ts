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
