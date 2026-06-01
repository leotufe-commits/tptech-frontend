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
