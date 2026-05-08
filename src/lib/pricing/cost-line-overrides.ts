// src/lib/pricing/cost-line-overrides.ts
// =============================================================================
// FASE F1.4 G5 #11-D — helpers puros para reconstruir el array de
// costLineOverrides al editar una celda de la tabla ERP.
//
// Reglas:
//   · Indexación SIEMPRE por costLineId (NUNCA por índice visual).
//   · Reconstrucción funcional: el helper devuelve un array NUEVO con la
//     entry editada — el caller no muta nada.
//   · Cero matemática: solo merge estructural de campos.
//   · Defensivo con null/undefined (semántica F1.4):
//       - undefined en el patch → no toca el campo.
//       - null en adjustment* → limpia el ajuste.
//       - null en quantity/unitValue/merma → tratado como undefined (no toca).
// =============================================================================

import type { CostLineOverride } from "../../services/sales";

/**
 * Aplica un patch parcial a una entry indexada por costLineId.
 * Devuelve un array NUEVO (cero mutación).
 *
 * Si la entry no existe → la crea con el patch.
 * Si existe → mergea campos del patch sobre la entry existente.
 *
 * Si después del merge la entry queda "vacía" (sin ningún campo
 * efectivo distinto de undefined además de costLineId+type), la entry
 * queda en el array igual — el backend filtra entries no-aplicables
 * (validateCostLineOverride). El frontend no decide qué es "vacío".
 *
 * @param current — array actual de overrides (puede ser undefined / vacío).
 * @param costLineId — id de la cost line a editar.
 * @param type — tipo confirmatorio (METAL/HECHURA/PRODUCT/SERVICE).
 * @param patch — campos a actualizar. `undefined` = no toca, `null` con
 *   semántica especial en adjustment* (limpia ajuste).
 */
export function patchCostLineOverride(
  current:    ReadonlyArray<CostLineOverride> | undefined,
  costLineId: string,
  type:       CostLineOverride["type"],
  patch:      Partial<Omit<CostLineOverride, "costLineId" | "type">>,
): CostLineOverride[] {
  const arr = Array.isArray(current) ? [...current] : [];
  const idx = arr.findIndex(o => o?.costLineId === costLineId);
  const existing: CostLineOverride = idx >= 0
    ? arr[idx]
    : { costLineId, type };

  // Merge: undefined en patch → mantener existing (incluyendo `null` que
  // sigue siendo significativo en adjustment*).
  const merged: CostLineOverride = {
    costLineId,
    type,
    ...(existing.quantityOverride       !== undefined && { quantityOverride:       existing.quantityOverride }),
    ...(existing.unitValueOverride      !== undefined && { unitValueOverride:      existing.unitValueOverride }),
    ...(existing.mermaPercentOverride   !== undefined && { mermaPercentOverride:   existing.mermaPercentOverride }),
    ...(existing.adjustmentKind         !== undefined && { adjustmentKind:         existing.adjustmentKind }),
    ...(existing.adjustmentType         !== undefined && { adjustmentType:         existing.adjustmentType }),
    ...(existing.adjustmentValue        !== undefined && { adjustmentValue:        existing.adjustmentValue }),
  };
  // Aplicar patch — undefined NO sobreescribe, null SÍ (semántica explícita).
  if (Object.prototype.hasOwnProperty.call(patch, "quantityOverride"))     merged.quantityOverride     = patch.quantityOverride;
  if (Object.prototype.hasOwnProperty.call(patch, "unitValueOverride"))    merged.unitValueOverride    = patch.unitValueOverride;
  if (Object.prototype.hasOwnProperty.call(patch, "mermaPercentOverride")) merged.mermaPercentOverride = patch.mermaPercentOverride;
  if (Object.prototype.hasOwnProperty.call(patch, "adjustmentKind"))       merged.adjustmentKind       = patch.adjustmentKind;
  if (Object.prototype.hasOwnProperty.call(patch, "adjustmentType"))       merged.adjustmentType       = patch.adjustmentType;
  if (Object.prototype.hasOwnProperty.call(patch, "adjustmentValue"))      merged.adjustmentValue      = patch.adjustmentValue;

  if (idx >= 0) arr[idx] = merged;
  else          arr.push(merged);
  return arr;
}

/**
 * Lookup O(1) por costLineId. Devuelve undefined si no existe.
 * Útil para que la celda de la tabla muestre el valor del override
 * actual (si lo hay) o el original.
 */
export function findCostLineOverride(
  current:    ReadonlyArray<CostLineOverride> | undefined,
  costLineId: string,
): CostLineOverride | undefined {
  if (!Array.isArray(current)) return undefined;
  return current.find(o => o?.costLineId === costLineId);
}
