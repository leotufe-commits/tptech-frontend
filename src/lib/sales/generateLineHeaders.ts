// src/lib/sales/generateLineHeaders.ts
// ============================================================================
// generateHeadersByCriterion — agrupa las líneas de un documento por un
// criterio (Metal / Marca / Categoría / Grupo / Tipo de artículo) e inserta
// cabeceras automáticas antes de cada grupo.
//
// Reglas:
//   1. Cabeceras existentes con `headerEditedByUser=true` se preservan
//      tal cual (el operador editó el título y NO debe pisarse).
//   2. Cabeceras generadas previamente sin editar se eliminan y se
//      regeneran con los valores nuevos del criterio.
//   3. Cabeceras 100% MANUALES (sin `headerGroupBy`) se preservan; el
//      operador las creó a propósito y deben respetarse.
//   4. Líneas sin valor para el criterio caen en un grupo "VARIOS".
//   5. Líneas vacías (placeholder al final) NO se mueven — quedan al final
//      del array en su orden original.
//   6. La función es pura: no muta `lines` ni los items dentro.
//
// HOY el único criterio con datos disponibles en `pricingMeta` es METAL
// (lee `pricingMeta.composition.metal.metalName`). Los demás criterios
// están preparados estructuralmente: el helper devuelve "VARIOS" para
// todas las líneas hasta que se conecte la fuente de datos
// (categoryName / brand / groupId / articleType desde el catálogo).
// ============================================================================

import type { DocumentLine } from "../document-types";

export type HeaderGroupBy =
  | "CATEGORY"
  | "BRAND"
  | "GROUP"
  | "METAL"
  | "ARTICLE_TYPE"
  | "MANUFACTURER";

export const HEADER_GROUP_BY_LABEL: Record<HeaderGroupBy, string> = {
  CATEGORY:     "Categoría",
  BRAND:        "Marca",
  GROUP:        "Grupo",
  METAL:        "Variante de metal",
  ARTICLE_TYPE: "Tipo de artículo",
  MANUFACTURER: "Fabricante",
};

/**
 * Fallback semántico por criterio: aparece cuando la línea no tiene dato
 * para ese criterio (vs. "VARIOS" antes, que confundía "sin dato" con
 * "criterio no implementado").
 */
const FALLBACK_BY_MODE: Record<HeaderGroupBy, string> = {
  CATEGORY:     "Sin categoría",
  BRAND:        "Sin marca",
  GROUP:        "Sin grupo",
  METAL:        "Sin metal",
  ARTICLE_TYPE: "Sin tipo",
  MANUFACTURER: "Sin fabricante",
};

/** Mapeo legible del itemKind para el criterio ARTICLE_TYPE. */
const ITEM_KIND_LABEL: Record<NonNullable<DocumentLine["itemKind"]>, string> = {
  ARTICLE_SIMPLE:  "Artículos",
  ARTICLE_VARIANT: "Artículos",
  SERVICE:         "Servicios",
  COMBO:           "Combos",
};

/** Helper genérico para crear el id de un header generado. Cada regeneración
 *  produce headers nuevos (con id nuevo) salvo que se preserve uno editado. */
function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `hdr-${Math.random().toString(36).slice(2, 11)}-${Date.now().toString(36)}`;
}

/** Builder de un nuevo header generado. */
function makeGeneratedHeader(
  groupBy: HeaderGroupBy,
  sourceValue: string,
): DocumentLine {
  return {
    id:                 uid(),
    type:               "HEADER",
    title:              sourceValue,
    headerGroupBy:      groupBy,
    headerSourceValue:  sourceValue,
    headerEditedByUser: false,
    article:            "",
    variant:            "",
    quantity:           0,
    unitPrice:          0,
    discountAmount:     0,
    subtotal:           0,
    lineTotal:          0,
  };
}

/** Devuelve el primer string no vacío después de trim, o undefined. */
function nonEmpty(...values: Array<string | null | undefined>): string | undefined {
  for (const v of values) {
    const t = (v ?? "").trim();
    if (t.length > 0) return t;
  }
  return undefined;
}

/**
 * Devuelve el label de cabecera para una línea según el criterio.
 *
 *   - Si la línea tiene el dato del criterio → lo devuelve tal cual.
 *   - Si no tiene dato → fallback semántico ("Sin categoría", "Sin marca",
 *     etc.). NUNCA "VARIOS".
 *
 * Datos leídos:
 *   · METAL        → `pricingMeta.composition.metal.metalName` (motor).
 *   · ARTICLE_TYPE → `itemKind` mapeado a "Artículos / Servicios / Combos".
 *   · CATEGORY / BRAND / GROUP / MANUFACTURER → `headerSnapshot` de la línea
 *     (cacheado al cargar el artículo desde el catálogo). Sin runtime fetch.
 */
export function getHeaderLabelForLine(
  line: DocumentLine,
  mode: HeaderGroupBy,
): string {
  const snap = line.headerSnapshot;
  switch (mode) {
    case "METAL": {
      // "Variante de metal" = combinación de nombre + pureza:
      //   metalName="Oro" + purityLabel="18K" → "Oro 18K"
      //   metalName="Plata" + purityLabel="925" → "Plata 925"
      //   metalName="Acero" sin pureza → "Acero"
      //   sin datos → "Sin metal"
      const metal = line.pricingMeta?.composition?.metal;
      const name   = (metal?.metalName   ?? "").trim();
      const purity = (metal?.purityLabel ?? "").trim();
      const combined = [name, purity].filter(Boolean).join(" ");
      return combined.length > 0 ? combined : FALLBACK_BY_MODE.METAL;
    }
    case "ARTICLE_TYPE": {
      const kind = line.itemKind;
      return kind ? (ITEM_KIND_LABEL[kind] ?? FALLBACK_BY_MODE.ARTICLE_TYPE)
                  : FALLBACK_BY_MODE.ARTICLE_TYPE;
    }
    case "CATEGORY":     return nonEmpty(snap?.categoryName) ?? FALLBACK_BY_MODE.CATEGORY;
    case "BRAND":        return nonEmpty(snap?.brand)        ?? FALLBACK_BY_MODE.BRAND;
    case "GROUP":        return nonEmpty(snap?.groupName)    ?? FALLBACK_BY_MODE.GROUP;
    case "MANUFACTURER": return nonEmpty(snap?.manufacturer) ?? FALLBACK_BY_MODE.MANUFACTURER;
    default:
      return FALLBACK_BY_MODE[mode];
  }
}

/** Determina si una cabecera fue generada automáticamente (vs. manual). */
function isGeneratedHeader(l: DocumentLine): boolean {
  return l.type === "HEADER" && !!l.headerGroupBy;
}

/** Determina si una línea es "vacía" (sin artículo, sin manual con texto). */
function isEmptyLineLike(l: DocumentLine): boolean {
  if (l.type === "HEADER") return false;
  if (l.articleId) return false;
  if (l.isManual === true && (l.manualDescription ?? "").trim().length > 0) return false;
  return true;
}

export type GenerateHeadersOptions = {
  /** Cuando `true`, regenera TODAS las cabeceras incluyendo las editadas.
   *  Default `false`: cabeceras con `headerEditedByUser=true` se preservan. */
  overwriteEdited?: boolean;
};

/**
 * Devuelve un nuevo array de líneas agrupado por el criterio.
 *
 * Estrategia:
 *   1. Separa headers manuales (los preserva tal cual al final, sin tocar).
 *      Excepción: si ya existe un header generado por el mismo criterio
 *      con `headerEditedByUser=true`, se preserva su título al regenerar
 *      el grupo correspondiente.
 *   2. Filtra líneas no-vacías y no-headers; las agrupa por
 *      `getGroupValue(line, criterion)` preservando orden de aparición.
 *   3. Para cada grupo, inserta header (preservando edited si existe) +
 *      las líneas del grupo en su orden original.
 *   4. Líneas vacías / headers manuales (sin `headerGroupBy`) van al
 *      final, en el orden original.
 */
export function generateHeadersByCriterion(
  lines: ReadonlyArray<DocumentLine>,
  criterion: HeaderGroupBy,
  opts: GenerateHeadersOptions = {},
): DocumentLine[] {
  const { overwriteEdited = false } = opts;

  // 1) Headers editados por el operador para este criterio — los indexamos
  //    por sourceValue para preservar su título al regenerar.
  const editedHeadersBySourceValue = new Map<string, DocumentLine>();
  if (!overwriteEdited) {
    for (const l of lines) {
      if (
        l.type === "HEADER" &&
        l.headerGroupBy === criterion &&
        l.headerEditedByUser === true &&
        l.headerSourceValue
      ) {
        editedHeadersBySourceValue.set(l.headerSourceValue, l);
      }
    }
  }

  // 2) Headers manuales (sin `headerGroupBy`) que el operador creó — al final.
  const manualHeaders: DocumentLine[] = [];
  for (const l of lines) {
    if (l.type === "HEADER" && !l.headerGroupBy) {
      manualHeaders.push(l);
    }
  }

  // 3) Filtrar líneas reales y agruparlas por sourceValue.
  const groups = new Map<string, DocumentLine[]>();
  const orderOfFirstAppearance: string[] = [];
  const trailingEmpty: DocumentLine[] = [];

  for (const l of lines) {
    if (l.type === "HEADER") continue; // headers se reconstruyen
    if (isEmptyLineLike(l)) {
      trailingEmpty.push(l);
      continue;
    }
    const value = getHeaderLabelForLine(l, criterion);
    if (!groups.has(value)) {
      groups.set(value, []);
      orderOfFirstAppearance.push(value);
    }
    groups.get(value)!.push(l);
  }

  // 4) Reconstrucción: por cada grupo, header (preservando edited) + líneas.
  const result: DocumentLine[] = [];
  for (const value of orderOfFirstAppearance) {
    const groupLines = groups.get(value)!;
    const editedHeader = editedHeadersBySourceValue.get(value);
    if (editedHeader) {
      // Preservar id, title editado, etc. — solo actualizamos el grupo
      // (que es el mismo, por construcción).
      result.push(editedHeader);
    } else {
      result.push(makeGeneratedHeader(criterion, value));
    }
    result.push(...groupLines);
  }

  // 5) Headers manuales (sin `headerGroupBy`) y líneas vacías al final.
  result.push(...manualHeaders);
  result.push(...trailingEmpty);

  return result;
}
