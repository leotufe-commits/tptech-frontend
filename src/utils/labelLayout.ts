// src/utils/labelLayout.ts
// Motor de distribución de etiquetas en grillas / páginas.

import type { LabelItemData } from "./labelResolver";

export type CopiesMap = Record<string, number>;

/**
 * Expande una lista de items según el mapa de copias.
 * Si un id no está en el mapa, usa defaultCopies (por defecto 1).
 */
export function expandItemsByCopies<T extends { id: string }>(
  items:         T[],
  copiesMap:     CopiesMap,
  defaultCopies  = 1,
): T[] {
  const result: T[] = [];
  for (const item of items) {
    const n = Math.max(1, copiesMap[item.id] ?? defaultCopies);
    for (let i = 0; i < n; i++) result.push(item);
  }
  return result;
}

/**
 * Una página es un array de filas; cada fila es un array de items.
 * Ejemplo con 3 cols, 2 rows: [ [a, b, c], [d, e, f] ]
 */
export type LabelPage<T = LabelItemData> = T[][];

/**
 * Divide una lista plana de items en páginas de `columns × rows`.
 * La última página puede quedar incompleta.
 */
export function paginateLabels<T>(
  items:   T[],
  columns: number,
  rows:    number,
): LabelPage<T>[] {
  const cols    = Math.max(1, columns);
  const rowsNum = Math.max(1, rows);
  const perPage = cols * rowsNum;
  const pages: LabelPage<T>[] = [];

  for (let p = 0; p < items.length; p += perPage) {
    const pageItems = items.slice(p, p + perPage);
    const page: LabelPage<T> = [];
    for (let r = 0; r < rowsNum; r++) {
      const row = pageItems.slice(r * cols, (r + 1) * cols);
      if (row.length > 0) page.push(row);
    }
    pages.push(page);
  }

  return pages;
}

/**
 * Función principal: expande por copias y pagina en una sola llamada.
 */
export function buildPrintPages<T extends { id: string }>(opts: {
  items:          T[];
  copiesMap:      CopiesMap;
  defaultCopies?: number;
  columns:        number;
  rows:           number;
}): LabelPage<T>[] {
  const expanded = expandItemsByCopies(opts.items, opts.copiesMap, opts.defaultCopies ?? 1);
  return paginateLabels(expanded, opts.columns, opts.rows);
}

/**
 * Calcula la cantidad de filas que entran en una página dadas las medidas.
 * Para impresoras térmicas (continuas), devuelve `Infinity`.
 */
export function calcRowsPerPage(opts: {
  printerType:   "THERMAL" | "ZEBRA" | "A4" | "INKJET";
  pageHeightMm:  number;
  marginTopMm:   number;
  marginBottomMm:number;
  gapVMm:        number;
  labelHeightMm: number;
}): number {
  if (opts.printerType === "THERMAL" || opts.printerType === "ZEBRA") {
    return Infinity; // rollo continuo
  }
  const usable = opts.pageHeightMm - opts.marginTopMm - opts.marginBottomMm;
  const rows   = Math.floor((usable + opts.gapVMm) / (opts.labelHeightMm + opts.gapVMm));
  return Math.max(1, rows);
}
