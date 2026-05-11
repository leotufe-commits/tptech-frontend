// src/lib/sales/matchPreviewLines.ts
// =============================================================================
// matchPreviewLines — empareja cada línea del draft con su entrada del
// preview backend RESPETANDO EL ORDEN y el filtro previewable.
//
// El backend de `sales/preview` devuelve `lines[]` en el mismo orden en que
// el frontend las envió, sin tag de id por línea. Por eso el matcheo es
// posicional: avanzamos un índice solo cuando la línea entró al payload.
//
// Reglas:
//   1. El filtro previewable DEBE ser idéntico en payload-builder, en el
//      hidratador (`applySalePreviewToDraft`) y en el reader visual
//      (`linesForView`). Una sola fuente: este helper.
//   2. ARTICLE → tiene `articleId` y `quantity > 0`.
//   3. MANUAL  → tiene `isManual=true`, `manualDescription` no vacía y
//      `quantity > 0`. Manuales sin descripción NO se envían al backend.
//   4. Cualquier otra (placeholder, header, vacía) NO consume índice.
//
// Bug que cubre: cuando se intercala una línea manual entre artículos, si
// alguno de los tres filtros difiere del otro, los totales del backend se
// desplazan al consumidor: el "Total línea c/ imp." de un manual aparece
// pegado a la siguiente línea de artículo.
// =============================================================================

/** Forma mínima de una línea para el matcheo (subset de `DocumentLine`). */
export interface MatchableLine {
  articleId?:        string | null;
  isManual?:         boolean;
  manualDescription?: string | null;
  quantity?:         number;
}

/**
 * Predicado canónico de "esta línea entra al preview". Usar SIEMPRE este
 * helper en lugar de duplicar la condición. Si cambia, los tres consumidores
 * (`buildSalePreviewPayload`, `applySalePreviewToDraft`, `linesForView`) se
 * mueven en bloque.
 */
export function isPreviewableLine(line: MatchableLine): boolean {
  const hasArticle = !!line.articleId;
  const hasManual  = line.isManual === true && !!(line.manualDescription ?? "").trim();
  const hasQty     = (line.quantity ?? 0) > 0;
  return (hasArticle || hasManual) && hasQty;
}

/**
 * Empareja `draftLines[i]` con `previewLines[realIdx]`. Devuelve el mismo
 * largo que `draftLines`; cada slot trae el preview correspondiente o `null`
 * si la línea no era previewable (no se desplaza el índice del preview).
 *
 * Garantiza la invariante:
 *   matched[i] != null  ⟺  isPreviewableLine(draftLines[i])
 *
 * Uso típico:
 *   const matched = matchPreviewLines(draft.lines, preview.lines);
 *   draft.lines.map((l, i) => selectInvoiceLineView(l, matched[i], sigOk));
 */
export function matchPreviewLines<L extends MatchableLine, P>(
  draftLines: ReadonlyArray<L>,
  previewLines: ReadonlyArray<P> | null | undefined,
): Array<P | null> {
  const out: Array<P | null> = new Array(draftLines.length);
  let realIdx = 0;
  for (let i = 0; i < draftLines.length; i++) {
    if (!isPreviewableLine(draftLines[i])) {
      out[i] = null;
      continue;
    }
    out[i] = previewLines?.[realIdx] ?? null;
    realIdx++;
  }
  return out;
}
