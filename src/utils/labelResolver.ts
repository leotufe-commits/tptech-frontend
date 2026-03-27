// src/utils/labelResolver.ts
// Resuelve el valor de un fieldKey a partir de los datos de un artículo.
// Compatible con LabelItem de LabelPrintModal y potencialmente con otros contextos.

export type LabelItemData = {
  id:           string;
  name?:        string;
  code?:        string;
  sku?:         string;
  barcode?:     string | null;
  barcodeType?: string;
  salePrice?:   string | number | null;
  costPrice?:   string | number | null;
  brand?:       string | null;
  variantName?: string | null;
  variantCode?: string | null;
  size?:        string | null;
  /** Atributos dinámicos: { "Color": "Rojo", "Talle": "M", ... } */
  attrs?:       Record<string, string>;
};

// ─── Formateador de precios ───────────────────────────────────────────────────

function formatPrice(v: string | number | null | undefined): string {
  if (v == null || v === "") return "";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!isFinite(n)) return "";
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

// ─── Mapa de resolvers por fieldKey ──────────────────────────────────────────

type Resolver = (item: LabelItemData) => string;

const FIELD_RESOLVERS: Record<string, Resolver> = {
  // Nombre del artículo
  "name":              (i) => i.name        || "",
  "article.name":      (i) => i.name        || "",
  // Código
  "code":              (i) => i.code        || "",
  "article.code":      (i) => i.code        || "",
  // SKU
  "sku":               (i) => i.sku         || "",
  "article.sku":       (i) => i.sku         || "",
  // Marca
  "brand":             (i) => i.brand       || "",
  "article.brand":     (i) => i.brand       || "",
  // Código de barras
  "barcode":           (i) => i.barcode     || "",
  "barcode.value":     (i) => i.barcode     || "",
  "article.barcode":   (i) => i.barcode     || "",
  // Precios
  "salePrice":         (i) => formatPrice(i.salePrice),
  "article.salePrice": (i) => formatPrice(i.salePrice),
  "costPrice":         (i) => formatPrice(i.costPrice),
  "article.costPrice": (i) => formatPrice(i.costPrice),
  // Variante
  "variantName":       (i) => i.variantName || "",
  "variant.name":      (i) => i.variantName || "",
  "variantCode":       (i) => i.variantCode || "",
  "variant.code":      (i) => i.variantCode || "",
  // Talle/tamaño: campo directo o atributo dinámico
  "size":              (i) => i.size || i.attrs?.["Talle"] || "",
  // Texto estático: el valor se toma del campo `label` del elemento, no de aquí
  "static":            ()  => "",
};

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Resuelve el valor a mostrar para un fieldKey dado los datos del artículo.
 * Soporta:
 *  - campos directos: "name", "article.name", "barcode", etc.
 *  - atributos dinámicos: "attr.Color", "attr.Talle", "attr.Piedra"
 *  - texto estático: devuelve "" (el label del elemento es el texto)
 *
 * Nunca lanza excepción; devuelve "" ante cualquier valor faltante.
 */
export function resolveField(item: LabelItemData, fieldKey: string): string {
  if (!fieldKey) return "";

  const key = fieldKey.trim();

  // Resolver del mapa
  const resolver = FIELD_RESOLVERS[key];
  if (resolver) return resolver(item);

  // Atributos dinámicos: attr.Color, attr.Talle, attr.Piedra ...
  if (key.startsWith("attr.")) {
    const attrName = key.slice(5);
    return item.attrs?.[attrName] ?? "";
  }

  return "";
}
