// src/lib/sales/sortLines.ts
// =============================================================================
// sortLinesPreservingHeaders — orden alfabético de líneas en el editor de
// Factura, con manejo correcto de cabeceras y placeholders.
//
// Reglas (alineadas con la UX que pidió el operador):
//
//   1. Comparador: localeCompare("es", { sensitivity: "base", numeric: true }).
//      → "Oro 9K" antes de "Oro 18K"  (numeric natural)
//      → "Acme" y "ácme" comparan iguales (insensible a mayúsculas/acentos)
//
//   2. HEADERs (`type === "HEADER"`) NO se mueven: sus posiciones quedan
//      fijas. El sort se aplica por SEGMENTO entre cabeceras consecutivas
//      (incluyendo el segmento "raíz" antes de la primera cabecera). Esto
//      evita que cabeceras se mezclen con artículos por nombre.
//
//   3. Placeholders (líneas sin `articleId` Y sin `manualDescription` con
//      texto) se mueven al FINAL del array, en su orden de inserción —
//      el operador los conserva como filas vacías editables al final.
//
//   4. Líneas con clave undefined o "" van al final de SU segmento (no del
//      array completo) para que conserven su grupo de cabecera.
//
//   5. Sort estable: la spec de ECMAScript exige `Array.prototype.sort`
//      estable desde ES2019. Líneas con la misma clave preservan su orden
//      de inserción dentro del segmento.
//
// El helper recibe `getKey` polimórfico — el caller decide qué campo usar
// (article, brand, category, etc.). Para "article" la convención del proyecto
// es: `line.article || line.manualDescription || ""`.
// =============================================================================

import type { DocumentLine } from "../document-types";

export type SortKeyFn = (line: DocumentLine) => string | undefined;

/** Detecta líneas "vacías" — placeholders sin artículo ni descripción manual. */
function isEmptyLine(l: DocumentLine): boolean {
  if (l.type === "HEADER") return false;
  if (l.articleId) return false;
  if (l.isManual === true && (l.manualDescription ?? "").trim().length > 0) return false;
  return true;
}

/** Comparador es-AR con orden numérico natural y sin diferenciar mayúsculas. */
function compareKeys(a: string | undefined, b: string | undefined): number {
  const ka = (a ?? "").trim();
  const kb = (b ?? "").trim();
  // Líneas sin clave al final de su segmento.
  if (!ka && !kb) return 0;
  if (!ka) return 1;
  if (!kb) return -1;
  return ka.localeCompare(kb, "es", { sensitivity: "base", numeric: true });
}

/**
 * Ordena las líneas del documento por la clave devuelta por `getKey`,
 * respetando cabeceras y manteniendo placeholders al final.
 *
 * Garantías:
 *   · Cabeceras (`type === "HEADER"`) conservan su posición relativa.
 *   · Las líneas SOLO se reordenan dentro del segmento delimitado por sus
 *     cabeceras adyacentes.
 *   · Devuelve un nuevo array; no muta `lines`.
 */
export function sortLinesPreservingHeaders(
  lines: ReadonlyArray<DocumentLine>,
  getKey: SortKeyFn,
): DocumentLine[] {
  // Particionamos el array en:
  //   · `trailingEmpties` — placeholders, van al final.
  //   · `body` — el resto, donde se aplican los segmentos por cabecera.
  const trailingEmpties: DocumentLine[] = [];
  const body: DocumentLine[] = [];
  for (const l of lines) {
    if (isEmptyLine(l)) trailingEmpties.push(l);
    else body.push(l);
  }

  // Recorremos `body` segmentando: cada HEADER inicia un nuevo segmento.
  // El segmento actual se va llenando con las líneas que vienen DESPUÉS
  // del último HEADER (o desde el inicio para el segmento "raíz").
  type Segment = { header: DocumentLine | null; items: DocumentLine[] };
  const segments: Segment[] = [{ header: null, items: [] }];
  for (const l of body) {
    if (l.type === "HEADER") {
      segments.push({ header: l, items: [] });
      continue;
    }
    segments[segments.length - 1].items.push(l);
  }

  // Ordenamos las items de cada segmento. El sort es estable, así que las
  // líneas con misma clave preservan orden de inserción.
  for (const seg of segments) {
    seg.items.sort((a, b) => compareKeys(getKey(a), getKey(b)));
  }

  // Re-ensamblamos: header (si tiene) + items ordenadas, en orden de segmentos.
  const out: DocumentLine[] = [];
  for (const seg of segments) {
    if (seg.header) out.push(seg.header);
    out.push(...seg.items);
  }
  // Placeholders al final, orden de inserción.
  out.push(...trailingEmpties);
  return out;
}

/**
 * Devuelve la clave de orden por defecto para el modo "Ordenar A-Z".
 *
 * Cascada robusta — devuelve el primer campo con texto en este orden:
 *   1. `line.article`           → nombre del catálogo (vía `addLineFromArticle`).
 *   2. `line.variant`           → sub-nombre / variante (cuando varias
 *                                  líneas comparten `article` igual y solo
 *                                  difieren en variante; sin esto queda
 *                                  sort no-determinista entre ellas).
 *   3. `line.description`       → texto libre que algunos flujos legacy
 *                                  usan en lugar de `article`.
 *   4. `line.manualDescription` → texto libre de líneas manuales.
 *   5. `line.sku`               → fallback final cuando nada del nombre
 *                                  visible quedó populado pero sí hay un
 *                                  identificador del catálogo.
 *
 * Si NINGUNO tiene texto, devuelve `undefined` → la línea queda al final
 * de su segmento, esperando que el operador la complete.
 *
 * Razones del fix (vs. la versión anterior que solo leía `article` /
 * `manualDescription`): líneas legacy persistidas en localStorage o
 * importadas con shape antiguo pueden llegar con `article` vacío. Antes,
 * todas devolvían `undefined` → todas iguales en el sort → ningún
 * reordenamiento visible. La cascada cubre esos edge cases sin afectar
 * el caso típico de líneas pickeadas del catálogo.
 */
export function articleNameSortKey(l: DocumentLine): string | undefined {
  const candidates: Array<string | null | undefined> = [
    l.article,
    l.variant,
    l.description,
    l.manualDescription,
    l.sku,
  ];
  for (const c of candidates) {
    const t = (c ?? "").trim();
    if (t) return t;
  }
  return undefined;
}

/**
 * Clave de orden para el modo "Ordenar por SKU" — orientado a operación
 * real de joyería, donde el operador busca por código de artículo más
 * que por nombre comercial.
 *
 * Cascada — devuelve el primer campo con texto en este orden:
 *   1. `line.sku`                → SKU del catálogo. `addLineFromArticle`
 *                                  ya hidrata este campo con `item.sku ||
 *                                  item.code` (ver `normalizeLineFromItem`),
 *                                  así que cubre tanto el SKU específico
 *                                  de la variante como el código del
 *                                  artículo padre.
 *   2. `line.article`            → nombre del catálogo (cuando el SKU no
 *                                  está populado, ej. línea legacy).
 *   3. `line.variant`            → sub-nombre / variante.
 *   4. `line.description`        → texto libre (legacy).
 *   5. `line.manualDescription`  → texto libre de líneas manuales (sin
 *                                  SKU del catálogo por construcción).
 *
 * Combinado con `numeric:true` del comparador, garantiza el orden natural
 * que pide el negocio: "ANI-002" antes que "ANI-010", "CAD-001" después
 * de toda la familia "ANI-".
 *
 * Si nada tiene texto, devuelve `undefined` → la línea queda al final
 * de su segmento.
 */
export function articleSkuSortKey(l: DocumentLine): string | undefined {
  const candidates: Array<string | null | undefined> = [
    l.sku,
    l.article,
    l.variant,
    l.description,
    l.manualDescription,
  ];
  for (const c of candidates) {
    const t = (c ?? "").trim();
    if (t) return t;
  }
  return undefined;
}
