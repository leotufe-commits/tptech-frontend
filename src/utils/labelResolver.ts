// src/utils/labelResolver.ts
// Motor de resolución de campos para el sistema de etiquetas TPTech.
//
// Soporta dos fuentes de datos:
//   • "article"  — artículo / variante (flujo actual)
//   • "saleLine" — línea de comprobante (órdenes de venta, facturas, etc.)
//
// Prioridad de resolución cuando sourceType = "saleLine":
//   nombre       → nameSnapshot      > variantName > name (artículo)
//   sku          → skuSnapshot        > variantSku  > sku (artículo)
//   barcode      → barcodeSnapshot    > barcode del artículo/variante
//   precio venta → lineUnitPrice      > salePrice (artículo)
//   peso total   → lineWeightOverride > weightSnapshot > weight (artículo/variante)
//   metales      → metalBreakdownSnapshot > metalWeights (artículo)

// ─── Tipo central de datos ────────────────────────────────────────────────────

export type LabelItemData = {
  id:             string;
  name?:          string;
  code?:          string;
  sku?:           string;
  /** SKU propio de la variante. resolvedSku lo prefiere sobre article.sku. */
  variantSku?:    string | null;
  barcode?:       string | null;
  barcodeType?:   string;
  salePrice?:     string | number | null;
  costPrice?:     string | number | null;
  brand?:         string | null;
  variantName?:   string | null;
  variantCode?:   string | null;
  size?:          string | null;
  /** Peso del artículo/variante como string numérico. */
  weight?:        string | null;
  /** Unidad del peso (g, kg, oz, …). */
  weightUnit?:    string | null;
  /**
   * Composición metálica multilinea pre-computada.
   * Ej: "Oro 18k: 3,25 g\nPlata 925: 1,10 g"
   */
  metalWeights?:  string | null;
  /** Atributos dinámicos: { "Color": "Rojo", "Talle": "M", "RFID": "E2003…" } */
  attrs?:         Record<string, string>;

  // ── Descriptivos ─────────────────────────────────────────────────────────────
  description?:        string | null;
  notes?:              string | null;
  /** "unidad", "par", "set", etc. */
  unitOfMeasure?:      string | null;
  /** Pre-formateado: "15×10×3 mm" */
  dimensions?:         string | null;

  // ── Clasificación ─────────────────────────────────────────────────────────────
  /** Nombre de la categoría del artículo. */
  categoryName?:       string | null;
  /** "PRODUCT" | "SERVICE" | "MATERIAL" */
  articleType?:        string | null;
  /** "DRAFT" | "ACTIVE" | "DISCONTINUED" | "ARCHIVED" */
  articleStatus?:      string | null;
  /** Nombre del grupo comercial. */
  groupName?:          string | null;

  // ── Comerciales adicionales ───────────────────────────────────────────────────
  /** Fabricante del artículo. */
  manufacturer?:       string | null;
  /** Nombre del proveedor predeterminado. */
  supplierName?:       string | null;
  /** Hechura del artículo/variante (ya resuelta con prioridad variante > artículo). */
  hechuraPrice?:       string | null;
  /** Porcentaje de merma como string numérico. */
  mermaPercent?:       string | null;

  // ── Metal principal ───────────────────────────────────────────────────────────
  /** Primer metal de la composición: "Oro 18k". */
  mainMetal?:          string | null;
  /** Ley del primer metal: "750" para 18k, "925" para plata. */
  purityOrLey?:        string | null;

  // ── Inventario / operación ────────────────────────────────────────────────────
  /** Stock total como string numérico. */
  stockTotal?:         string | null;
  /** Punto de reposición como string numérico. */
  reorderPoint?:       string | null;
  /** Cantidad predeterminada de venta. */
  defaultQuantity?:    string | null;

  // ── Atributos formateados ─────────────────────────────────────────────────────
  /**
   * Atributos en texto listo para imprimir.
   * Ej: "Talle: 15 · Color: Dorado"
   * Se construye desde attrs[] al generar el LabelItem si no se provee explícitamente.
   */
  attributesSummary?:  string | null;
  /**
   * Atributos resueltos (merge variante > artículo, sin duplicados).
   * Cuando está presente tiene prioridad sobre attributesSummary.
   */
  resolvedAttributesSummary?: string | null;

  // ── Merma por metal ───────────────────────────────────────────────────────────
  /**
   * Merma formateada por metal.
   * Ej: "Oro 18k: 5,00%\nPlata 925: 3,00%"
   */
  metalMermaSummary?:  string | null;

  // ── Contexto de fuente de datos ──────────────────────────────────────────────
  /**
   * Identifica el origen de los datos. Default implícito: "article".
   * No afecta la lógica del resolver directamente — los resolvers aplican
   * prioridad por null-coalescing sobre los campos snapshot.
   */
  sourceType?: "article" | "saleLine";

  // ── Snapshots de línea de comprobante ────────────────────────────────────────
  // Todos opcionales. Cuando presentes, tienen MAYOR prioridad que los campos
  // del artículo/variante. Permiten que el dato impreso refleje el comprobante,
  // no el master, aunque el artículo haya cambiado después.

  /** Nombre capturado al momento del comprobante. */
  nameSnapshot?:            string | null;
  /** SKU capturado al momento del comprobante. */
  skuSnapshot?:             string | null;
  /** Barcode capturado al momento del comprobante. */
  barcodeSnapshot?:         string | null;
  /** Precio unitario de la línea (sobreescribe salePrice para impresión). */
  lineUnitPrice?:           string | null;
  /** Cantidad de la línea (ej: "3"). */
  lineQuantity?:            string | null;
  /**
   * Peso ajustado manualmente en la línea del comprobante.
   * Mayor prioridad que weightSnapshot y weight.
   */
  lineWeightOverride?:      string | null;
  /** Peso del artículo capturado al momento del comprobante. */
  weightSnapshot?:          string | null;
  /** Composición metálica capturada al momento del comprobante. */
  metalBreakdownSnapshot?:  string | null;
};

// ─── Tipo descriptor de una línea de comprobante ─────────────────────────────

/**
 * Datos crudos de una línea de comprobante para construir un LabelItemData.
 * Usar con buildLabelItemFromSaleLine().
 *
 * Los campos *Snapshot son valores capturados en el momento de la venta
 * y NO cambian si el artículo maestro se modifica posteriormente.
 */
export type SaleLineLabelSource = {
  // Identificadores de la línea
  lineId:                  string;
  articleId:               string;
  variantId?:              string | null;
  quantity:                number | string;

  // Snapshots capturados al cerrar el comprobante
  nameSnapshot?:           string | null;
  skuSnapshot?:            string | null;
  barcodeSnapshot?:        string | null;
  /** Precio unitario de la línea (ya aplicados descuentos/impuestos). */
  unitPrice?:              string | null;
  /** Peso modificado manualmente en la línea (ej: joya pesada en el mostrador). */
  weightOverride?:         string | null;
  /** Peso del artículo/variante en el momento de la venta. */
  weightSnapshot?:         string | null;
  /** Composición metálica en el momento de la venta. */
  metalBreakdownSnapshot?: string | null;

  // Datos del artículo maestro (para fallback cuando el snapshot no existe)
  article?: {
    name:              string;
    code:              string;
    sku?:              string | null;
    barcode?:          string | null;
    barcodeType?:      string;
    brand?:            string | null;
    salePrice?:        string | null;
    costPrice?:        string | null;
    weight?:           string | null;
    weightUnit?:       string | null;
    metalWeights?:     string | null;
    attrs?:            Record<string, string>;
    // Campos adicionales
    description?:      string | null;
    notes?:            string | null;
    manufacturer?:     string | null;
    supplierName?:     string | null;
    categoryName?:     string | null;
    articleType?:      string | null;
    articleStatus?:    string | null;
    groupName?:        string | null;
    hechuraPrice?:     string | null;
    mermaPercent?:     string | null;
    unitOfMeasure?:    string | null;
    dimensions?:       string | null;
    mainMetal?:        string | null;
    purityOrLey?:      string | null;
    stockTotal?:       string | null;
    reorderPoint?:     string | null;
    defaultQuantity?:  string | null;
    attributesSummary?: string | null;
    resolvedAttributesSummary?: string | null;
    metalMermaSummary?: string | null;
  };

  // Datos de la variante (para fallback)
  variant?: {
    name:             string;
    code:             string;
    sku?:             string | null;
    barcode?:         string | null;
    barcodeType?:     string;
    weightOverride?:  string | null;
    // priceOverride eliminado: las variantes no tienen precio propio
  };
};

// ─── Constructor desde línea de comprobante ───────────────────────────────────

/**
 * Construye un LabelItemData completo a partir de una línea de comprobante.
 *
 * Aplica la prioridad correcta en cada campo:
 *   nombre    → nameSnapshot   > variant.name  > article.name
 *   sku       → skuSnapshot    > variant.sku   > article.sku
 *   barcode   → barcodeSnapshot > variant.barcode > article.barcode
 *   precio    → unitPrice > article.salePrice (las variantes no tienen precio propio)
 *   peso      → weightOverride > weightSnapshot > variant.weightOverride > article.weight
 *   metales   → metalBreakdownSnapshot > article.metalWeights
 *
 * El resultado puede pasarse directamente al resolver de campos (resolveField)
 * o al LabelPrintModal como parte de un LabelItem[].
 */
export function buildLabelItemFromSaleLine(source: SaleLineLabelSource): LabelItemData {
  const { article: a, variant: v } = source;

  const resolvedBarcode = source.barcodeSnapshot ?? v?.barcode ?? a?.barcode ?? null;
  const resolvedBarcodeType = v?.barcodeType ?? a?.barcodeType ?? "CODE128";
  const resolvedWeight = source.weightOverride ?? source.weightSnapshot
    ?? v?.weightOverride ?? a?.weight ?? null;
  // El precio es siempre del artículo padre (las variantes no tienen precio propio)
  const resolvedSalePrice = source.unitPrice ?? a?.salePrice ?? null;
  const resolvedMetalWeights = source.metalBreakdownSnapshot ?? a?.metalWeights ?? null;

  return {
    id:           source.lineId,
    sourceType:   "saleLine",

    // Campos principales — ya con prioridad aplicada
    name:         source.nameSnapshot  || v?.name  || a?.name  || "",
    code:         a?.code  || "",
    sku:          a?.sku   || "",
    variantSku:   source.skuSnapshot  || v?.sku   || null,
    barcode:      resolvedBarcode,
    barcodeType:  resolvedBarcodeType,
    brand:        a?.brand ?? null,
    variantName:  v?.name  ?? null,
    variantCode:  v?.code  ?? null,
    salePrice:    resolvedSalePrice,
    costPrice:    a?.costPrice ?? null,
    weight:       resolvedWeight,
    weightUnit:   a?.weightUnit ?? null,
    metalWeights: resolvedMetalWeights,
    attrs:        a?.attrs,

    // Snapshots — campos crudos disponibles para resolvers explícitos y auditoría
    nameSnapshot:            source.nameSnapshot            ?? null,
    skuSnapshot:             source.skuSnapshot             ?? null,
    barcodeSnapshot:         source.barcodeSnapshot         ?? null,
    lineUnitPrice:           source.unitPrice               ?? null,
    lineQuantity:            String(source.quantity),
    lineWeightOverride:      source.weightOverride          ?? null,
    weightSnapshot:          source.weightSnapshot          ?? null,
    metalBreakdownSnapshot:  source.metalBreakdownSnapshot  ?? null,

    // Campos adicionales del artículo maestro
    description:        a?.description      ?? null,
    notes:              a?.notes            ?? null,
    unitOfMeasure:      a?.unitOfMeasure    ?? null,
    dimensions:         a?.dimensions       ?? null,
    categoryName:       a?.categoryName     ?? null,
    articleType:        a?.articleType      ?? null,
    articleStatus:      a?.articleStatus    ?? null,
    groupName:          a?.groupName        ?? null,
    manufacturer:       a?.manufacturer     ?? null,
    supplierName:       a?.supplierName     ?? null,
    hechuraPrice:       a?.hechuraPrice     ?? null,
    mermaPercent:       a?.mermaPercent     ?? null,
    mainMetal:          a?.mainMetal        ?? null,
    purityOrLey:        a?.purityOrLey      ?? null,
    stockTotal:         a?.stockTotal       ?? null,
    reorderPoint:       a?.reorderPoint     ?? null,
    defaultQuantity:    a?.defaultQuantity  ?? null,
    attributesSummary:          a?.attributesSummary         ?? null,
    resolvedAttributesSummary:  a?.resolvedAttributesSummary ?? null,
    metalMermaSummary:          a?.metalMermaSummary          ?? null,
  };
}

// ─── Traducciones de enums ────────────────────────────────────────────────────

const ARTICLE_TYPE_LABELS: Record<string, string> = {
  PRODUCT:  "Producto",
  SERVICE:  "Servicio",
  MATERIAL: "Material",
};

const ARTICLE_STATUS_LABELS: Record<string, string> = {
  DRAFT:        "Borrador",
  ACTIVE:       "Activo",
  DISCONTINUED: "Descontinuado",
  ARCHIVED:     "Archivado",
};

// ─── Formateadores internos ───────────────────────────────────────────────────

function formatPrice(v: string | number | null | undefined): string {
  if (v == null || v === "") return "";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!isFinite(n)) return "";
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatWeight(weight: string | null | undefined, unit: string | null | undefined): string {
  if (!weight) return "";
  const n = parseFloat(weight);
  if (!isFinite(n) || n <= 0) return "";
  const formatted = n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const unitStr = unit?.trim();
  return unitStr ? `${formatted} ${unitStr}` : formatted;
}

// ─── Mapa de resolvers por fieldKey ──────────────────────────────────────────

type Resolver = (item: LabelItemData) => string;

const FIELD_RESOLVERS: Record<string, Resolver> = {
  // ── Nombre ──────────────────────────────────────────────────────────────────
  // Prioridad saleLine: nameSnapshot > name
  "name":              (i) => i.nameSnapshot || i.name        || "",
  "article.name":      (i) => i.nameSnapshot || i.name        || "",
  /** Snapshot crudo del nombre en el comprobante (sin fallback). */
  "nameSnapshot":      (i) => i.nameSnapshot || "",

  // ── Código ──────────────────────────────────────────────────────────────────
  "code":              (i) => i.code || "",
  "article.code":      (i) => i.code || "",

  // ── SKU ─────────────────────────────────────────────────────────────────────
  // Prioridad saleLine: skuSnapshot > variantSku > sku
  "sku":               (i) => i.sku        || "",
  "article.sku":       (i) => i.sku        || "",
  "variant.sku":       (i) => i.variantSku || "",
  /**
   * SKU resuelto con prioridad máxima:
   *   1. skuSnapshot (comprobante)
   *   2. variantSku  (variante)
   *   3. sku         (artículo)
   */
  "article.resolvedSku": (i) => i.skuSnapshot || i.variantSku || i.sku || "",
  "resolvedSku":         (i) => i.skuSnapshot || i.variantSku || i.sku || "",
  /** Snapshot crudo del SKU en el comprobante. */
  "skuSnapshot":         (i) => i.skuSnapshot || "",

  // ── Marca ───────────────────────────────────────────────────────────────────
  "brand":             (i) => i.brand || "",
  "article.brand":     (i) => i.brand || "",

  // ── Código de barras ────────────────────────────────────────────────────────
  // Prioridad saleLine: barcodeSnapshot > barcode
  "barcode":           (i) => i.barcodeSnapshot || i.barcode || "",
  "barcode.value":     (i) => i.barcodeSnapshot || i.barcode || "",
  "article.barcode":   (i) => i.barcodeSnapshot || i.barcode || "",
  /**
   * Contenido para QR: barcodeSnapshot > barcode > code
   */
  "article.qrCode":    (i) => i.barcodeSnapshot || i.barcode || i.code || "",
  "qrCode":            (i) => i.barcodeSnapshot || i.barcode || i.code || "",
  /** Snapshot crudo del barcode en el comprobante. */
  "barcodeSnapshot":   (i) => i.barcodeSnapshot || "",

  // ── Precios ─────────────────────────────────────────────────────────────────
  // Prioridad saleLine: lineUnitPrice > salePrice
  "salePrice":         (i) => formatPrice(i.lineUnitPrice ?? i.salePrice),
  "article.salePrice": (i) => formatPrice(i.lineUnitPrice ?? i.salePrice),
  "costPrice":         (i) => formatPrice(i.costPrice),
  "article.costPrice": (i) => formatPrice(i.costPrice),
  /** Precio unitario crudo de la línea del comprobante. */
  "line.unitPrice":    (i) => formatPrice(i.lineUnitPrice),
  /** Cantidad de la línea del comprobante (ej: "3"). */
  "line.quantity":     (i) => i.lineQuantity || "",

  // ── Variante ─────────────────────────────────────────────────────────────────
  "variantName":       (i) => i.variantName || "",
  "variant.name":      (i) => i.variantName || "",
  "variantCode":       (i) => i.variantCode || "",
  "variant.code":      (i) => i.variantCode || "",

  // ── Talle/tamaño ─────────────────────────────────────────────────────────────
  "size":              (i) => i.size || i.attrs?.["Talle"] || "",

  // ── Peso / composición ───────────────────────────────────────────────────────
  /**
   * Peso total con prioridad:
   *   1. lineWeightOverride (ajuste manual en el comprobante)
   *   2. weightSnapshot     (peso capturado al momento del comprobante)
   *   3. weight             (peso del artículo/variante del master)
   */
  "article.totalWeight": (i) => formatWeight(i.lineWeightOverride ?? i.weightSnapshot ?? i.weight, i.weightUnit),
  "totalWeight":         (i) => formatWeight(i.lineWeightOverride ?? i.weightSnapshot ?? i.weight, i.weightUnit),
  /** Peso crudo del override de línea (sin fallback). */
  "line.weight":         (i) => formatWeight(i.lineWeightOverride, i.weightUnit),
  /**
   * Composición metálica con prioridad:
   *   1. metalBreakdownSnapshot (snapshot del comprobante)
   *   2. metalWeights           (composición del master)
   */
  "article.metalWeights":    (i) => i.metalBreakdownSnapshot || i.metalWeights || "",
  "metalVariantWeights":     (i) => i.metalBreakdownSnapshot || i.metalWeights || "",

  // ── RFID ─────────────────────────────────────────────────────────────────────
  "article.rfid": (i) => i.attrs?.["RFID"] || i.attrs?.["rfid"] || "",
  "rfidCode":     (i) => i.attrs?.["RFID"] || i.attrs?.["rfid"] || "",

  // ── Hechura ──────────────────────────────────────────────────────────────────
  /**
   * Hechura formateada.
   * Prioridad: hechuraPrice ya viene pre-resuelta (variante > artículo).
   */
  "hechura":           (i) => formatPrice(i.hechuraPrice),
  "article.hechura":   (i) => formatPrice(i.hechuraPrice),

  // ── Merma ────────────────────────────────────────────────────────────────────
  "mermaPercent": (i) => {
    if (!i.mermaPercent) return "";
    const n = parseFloat(i.mermaPercent);
    if (!isFinite(n) || n <= 0) return "";
    return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
  },

  // ── Metal principal ───────────────────────────────────────────────────────────
  "mainMetal":      (i) => i.mainMetal   || "",
  "purityOrLey":    (i) => i.purityOrLey || "",

  // ── Clasificación ─────────────────────────────────────────────────────────────
  "categoryName":   (i) => i.categoryName || "",
  "articleType":    (i) => ARTICLE_TYPE_LABELS[i.articleType  ?? ""] ?? i.articleType  ?? "",
  "articleStatus":  (i) => ARTICLE_STATUS_LABELS[i.articleStatus ?? ""] ?? i.articleStatus ?? "",
  "groupName":      (i) => i.groupName || "",

  // ── Comerciales adicionales ───────────────────────────────────────────────────
  "manufacturer":   (i) => i.manufacturer  || "",
  "supplierName":   (i) => i.supplierName  || "",

  // ── Inventario / operación ────────────────────────────────────────────────────
  "stockTotal": (i) => {
    if (i.stockTotal == null || i.stockTotal === "") return "";
    const n = parseFloat(i.stockTotal);
    return isFinite(n) ? n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 4 }) : "";
  },
  "reorderPoint": (i) => {
    if (!i.reorderPoint) return "";
    const n = parseFloat(i.reorderPoint);
    return isFinite(n) ? n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : "";
  },
  "defaultQuantity": (i) => {
    if (!i.defaultQuantity) return "";
    const n = parseFloat(i.defaultQuantity);
    return isFinite(n) ? n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : "";
  },

  // ── Descriptivos ─────────────────────────────────────────────────────────────
  "description":    (i) => i.description   || "",
  "notes":          (i) => i.notes         || "",
  "unitOfMeasure":  (i) => i.unitOfMeasure || "",
  "dimensions":     (i) => i.dimensions    || "",

  // ── Atributos formateados ─────────────────────────────────────────────────────
  /**
   * Resumen de atributos de variante.
   * Si attributesSummary está disponible, lo usa directamente.
   * Si no, lo construye desde attrs (excluye RFID para no repetirlo).
   */
  "attributesSummary": (i) => {
    if (i.attributesSummary) return i.attributesSummary;
    const entries = Object.entries(i.attrs ?? {}).filter(([k]) => k !== "RFID" && k !== "rfid");
    return entries.map(([k, v]) => `${k}: ${v}`).join(" · ");
  },
  /**
   * Atributos resueltos: merge variante > artículo, sin duplicados.
   * Prioridad: resolvedAttributesSummary > attributesSummary > attrs[]
   */
  "resolvedAttributesSummary": (i) => {
    if (i.resolvedAttributesSummary) return i.resolvedAttributesSummary;
    if (i.attributesSummary) return i.attributesSummary;
    const entries = Object.entries(i.attrs ?? {}).filter(([k]) => k !== "RFID" && k !== "rfid");
    return entries.map(([k, v]) => `${k}: ${v}`).join(" · ");
  },

  // ── Merma por metal ───────────────────────────────────────────────────────────
  "metalMermaSummary": (i) => i.metalMermaSummary || "",

  // ── Merma resuelta (alias amigable de mermaPercent) ──────────────────────────
  "resolvedMerma": (i) => {
    if (!i.mermaPercent) return "";
    const n = parseFloat(i.mermaPercent);
    if (!isFinite(n) || n <= 0) return "";
    return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
  },

  // ── Texto estático ───────────────────────────────────────────────────────────
  "static": () => "",
};

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Resuelve el valor a mostrar para un fieldKey dado los datos del artículo/línea.
 *
 * Cuando los datos provienen de una línea de comprobante (sourceType = "saleLine"),
 * los campos snapshot tienen mayor prioridad que los campos del artículo maestro.
 *
 * Nunca lanza excepción — devuelve "" ante cualquier valor faltante.
 */
export function resolveField(item: LabelItemData, fieldKey: string): string {
  if (!fieldKey) return "";

  const key = fieldKey.trim();

  const resolver = FIELD_RESOLVERS[key];
  if (resolver) return resolver(item);

  // Atributos dinámicos: attr.Color, attr.Talle, attr.RFID …
  if (key.startsWith("attr.")) {
    return item.attrs?.[key.slice(5)] ?? "";
  }

  // Alias semántico para atributos de variante (mismo mapa que attr.*)
  // Ejemplo: variantAttribute.Talle → item.attrs["Talle"]
  if (key.startsWith("variantAttribute.")) {
    return item.attrs?.[key.slice("variantAttribute.".length)] ?? "";
  }

  return "";
}
