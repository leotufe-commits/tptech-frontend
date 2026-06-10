// src/components/ui/TPDocumentLineAdvancedEditor.helpers.ts
// ============================================================================
// Helpers puros del editor de líneas de documento.
//
// Por qué viven acá y no dentro de TPDocumentLineAdvancedEditor.tsx:
//   · El plugin `react-refresh/babel` (Fast Refresh de Vite) exige que un
//     módulo exporte ÚNICAMENTE componentes React. Mezclar el componente con
//     un helper puro (`isTaxClearedOverride`) invalidaba Fast Refresh en
//     cada save del archivo de ~5000 líneas → full reload → re-optimize
//     deps Vite → ventanas de `ECONNREFUSED` contra el backend → preview
//     stale → WARNING comercial intermitente.
//   · Co-locamos los helpers acá con el sufijo `.helpers.ts` para mantener
//     la cercanía conceptual con el componente sin romper Fast Refresh.
// ============================================================================

/**
 * Intención EXPLÍCITA de "sin impuesto": el operador borró el input o lo
 * puso en 0 (override manual con value 0). Cuando es true, el label de
 * impuestos NO debe revivir el IVA/monto anterior (ni desde
 * `composition.taxes` / `taxBreakdown` / cache de rate). Pura, sin estado.
 *
 * - `null`/`undefined` (sin override) → false (impuesto automático normal).
 * - `{ value: 0 }` (PERCENT o AMOUNT) → true (cleared).
 * - `{ value: 21 }` → false.
 * - value no finito → false (no se considera "cleared" explícito).
 */
export function isTaxClearedOverride(
  override: { value?: number | null } | null | undefined,
): boolean {
  if (override == null) return false;
  const v = Number(override.value);
  return Number.isFinite(v) && v === 0;
}

// ============================================================================
// Claridad de "lista aplicada por línea" (display-only, sin matemática)
//
// Una línea puede usar una lista de precios DISTINTA a la lista general del
// documento por dos motivos:
//   1. Override explícito de la línea (`priceListIdOverride` seteado).
//   2. El motor resolvió otra lista por jerarquía (cliente/categoría) o porque
//      el documento es de listas MIXTAS → `appliedPriceListId` ≠ lista del doc.
//
// El operador puede creer que la línea usa la lista del header cuando en
// realidad usa otra (caso auditado: el redondeo "raro" venía de una línea con
// lista Desglosada mientras el header mostraba la Unificada). Este helper PURO
// decide si mostrar un badge de advertencia y con qué texto. No calcula nada:
// solo compara identificadores ya resueltos por el backend.
// ============================================================================

export interface LineListBadgeInput {
  /** `pricingMeta.appliedPriceListId` — lista REALMENTE aplicada por el motor. */
  appliedPriceListId?: string | null;
  /** `pricingMeta.appliedPriceListName` — nombre de la lista aplicada. */
  appliedPriceListName?: string | null;
  /** `line.priceListIdOverride` — override explícito de la línea (si existe). */
  priceListIdOverride?: string | null;
  /** `priceListId` del documento (header). */
  documentPriceListId?: string | null;
  /** Nombre de la lista del documento (header). */
  documentPriceListName?: string | null;
}

export interface LineListBadgeResult {
  /** True si la línea usa una lista distinta a la del documento. */
  differs: boolean;
  /** Texto del badge a mostrar (`null` cuando no difiere). */
  label: string | null;
  /** Nombre a mostrar como "lista aplicada" de la línea (fallback al del doc). */
  appliedName: string | null;
  /** Nombre de la lista del documento (para el tooltip). */
  documentName: string | null;
}

const hasText = (v: string | null | undefined): v is string =>
  typeof v === "string" && v.length > 0;

/**
 * Decide el badge de "lista aplicada" de una línea. PURO — solo compara ids
 * resueltos por el backend; nunca toca importes ni redondeos.
 *
 * - Override explícito de línea → `label = "Override de línea"`.
 * - Lista aplicada ≠ lista del documento (sin override) → `label = "Lista distinta al documento"`.
 * - Misma lista (o sin datos para comparar) → `differs = false`, `label = null`.
 */
export function resolveLineListBadge(input: LineListBadgeInput): LineListBadgeResult {
  const appliedName = hasText(input.appliedPriceListName)
    ? input.appliedPriceListName
    : (hasText(input.documentPriceListName) ? input.documentPriceListName : null);
  const documentName = hasText(input.documentPriceListName) ? input.documentPriceListName : null;

  const hasOverride = hasText(input.priceListIdOverride);
  const appliedDiffersFromDoc =
    hasText(input.appliedPriceListId) &&
    hasText(input.documentPriceListId) &&
    input.appliedPriceListId !== input.documentPriceListId;

  if (hasOverride) {
    return { differs: true, label: "Override de línea", appliedName, documentName };
  }
  if (appliedDiffersFromDoc) {
    return { differs: true, label: "Lista distinta al documento", appliedName, documentName };
  }
  return { differs: false, label: null, appliedName, documentName };
}
