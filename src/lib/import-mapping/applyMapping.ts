// src/lib/import-mapping/applyMapping.ts
// Aplica el mapeo de columnas para transformar filas del archivo a campos internos.

import type { ColumnMapping, FieldDef } from "./types";

/**
 * Aplica el mapeo de columnas para transformar filas crudas del archivo
 * a filas con las claves internas del sistema.
 * Las columnas con mappedTo=null son ignoradas (no se incluyen en la salida).
 */
export function applyMapping(
  rows: Record<string, string>[],
  mappings: ColumnMapping[],
): Record<string, string>[] {
  // Construir mapa fileHeader → internalKey (solo columnas mapeadas)
  const fieldMap = new Map<string, string>();
  for (const m of mappings) {
    if (m.mappedTo) fieldMap.set(m.fileHeader, m.mappedTo);
  }

  return rows.map(row => {
    const out: Record<string, string> = {};
    for (const [col, val] of Object.entries(row)) {
      const mapped = fieldMap.get(col);
      if (mapped !== undefined) out[mapped] = val;
    }
    return out;
  });
}

/**
 * Valida que todos los campos requeridos están mapeados.
 * Retorna la lista de etiquetas de campos requeridos faltantes.
 */
export function getMissingRequired(
  mappings: ColumnMapping[],
  requiredKeys: string[],
  allFields: FieldDef[],
): string[] {
  const mapped = new Set(mappings.filter(m => m.mappedTo).map(m => m.mappedTo!));
  return requiredKeys
    .filter(k => !mapped.has(k))
    .map(k => allFields.find(f => f.key === k)?.label ?? k);
}

/**
 * Valida que no haya campos duplicados (el mismo campo mapeado dos veces).
 * Retorna la lista de claves de campo duplicados.
 */
export function getDuplicateMappings(mappings: ColumnMapping[]): string[] {
  const counts = new Map<string, number>();
  for (const m of mappings) {
    if (m.mappedTo) counts.set(m.mappedTo, (counts.get(m.mappedTo) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
}
