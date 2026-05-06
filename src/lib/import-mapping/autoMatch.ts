// src/lib/import-mapping/autoMatch.ts
// Auto-matching de columnas de archivo a definiciones de campos del sistema.

import type { FieldDef, ColumnMapping } from "./types";

/**
 * Normaliza una clave para comparación:
 * - Elimina tildes/diacríticos
 * - Convierte a minúsculas
 * - Quita asterisco final (etiquetas XLSX con *)
 * - Convierte guiones/underscores a espacios
 * - Colapsa espacios múltiples
 */
export function normalizeKey(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s*\*\s*$/, "")   // quita asterisco final (labels XLSX)
    .replace(/[_\-]+/g, " ")    // underscores/guiones a espacios
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Auto-matchea las columnas del archivo a las definiciones de campo del sistema.
 *
 * Orden de resolución:
 * 1. Match exacto con field.key (ej: "Nombre" → Nombre)
 * 2. Match exacto con field.label (case-insensitive, sin tildes)
 * 3. Match con algún alias (case-insensitive, sin tildes)
 *
 * Cada campo solo puede ser asignado una vez (gana el primero en orden de columnas).
 */
export function autoMatchColumns(
  fileHeaders: string[],
  fields: FieldDef[],
  examples: Record<string, string> = {},
): ColumnMapping[] {
  const usedFields = new Set<string>();

  return fileHeaders.map((header): ColumnMapping => {
    const norm = normalizeKey(header);

    // 1. Match exacto con key
    const byKey = fields.find(f => normalizeKey(f.key) === norm && !usedFields.has(f.key));
    if (byKey) {
      usedFields.add(byKey.key);
      return { fileHeader: header, mappedTo: byKey.key, example: examples[header] ?? "" };
    }

    // 2. Match exacto con label
    const byLabel = fields.find(f => normalizeKey(f.label) === norm && !usedFields.has(f.key));
    if (byLabel) {
      usedFields.add(byLabel.key);
      return { fileHeader: header, mappedTo: byLabel.key, example: examples[header] ?? "" };
    }

    // 3. Match con alias
    const byAlias = fields.find(f =>
      !usedFields.has(f.key) &&
      f.aliases.some(a => normalizeKey(a) === norm)
    );
    if (byAlias) {
      usedFields.add(byAlias.key);
      return { fileHeader: header, mappedTo: byAlias.key, example: examples[header] ?? "" };
    }

    return { fileHeader: header, mappedTo: null, example: examples[header] ?? "" };
  });
}
