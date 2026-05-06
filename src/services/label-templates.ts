import { apiFetch } from "../lib/api";

export type LabelElementType = "TEXT" | "BARCODE" | "QR" | "IMAGE" | "LINE";

export type LabelElementRow = {
  id:         string;
  type:       LabelElementType;
  label:      string;
  fieldKey:   string;
  x:          string;
  y:          string;
  width:      string;
  height:     string;
  fontSize:   number;
  fontWeight: string;
  align:      string;
  visible:    boolean;
  sortOrder:  number;
  configJson: string;
};

export type LabelTemplateRow = {
  id:                      string;
  name:                    string;
  widthMm:                 string;
  heightMm:                string;
  dpi:                     number;
  orientation:             string;
  bgColor:                 string;
  isDefault:               boolean;
  isActive:                boolean;
  deletedAt:               string | null;
  createdAt:               string;
  defaultPrinterProfileId: string | null;
  defaultPrinterProfile:   { id: string; name: string; type: string } | null;
  elements:                LabelElementRow[];
};

export type LabelTemplatePayload = {
  name:                    string;
  widthMm:                 number;
  heightMm:                number;
  dpi?:                    number;
  orientation?:            string;
  bgColor?:                string;
  isDefault?:              boolean;
  isActive?:               boolean;
  defaultPrinterProfileId?: string | null;
};

export type LabelElementPayload = {
  type:        LabelElementType;
  label?:      string;
  fieldKey?:   string;
  x:           number;
  y:           number;
  width:       number;
  height:      number;
  fontSize?:   number;
  fontWeight?: string;
  align?:      string;
  visible?:    boolean;
  sortOrder?:  number;
  configJson?: Record<string, any>;
};

export const labelTemplatesApi = {
  list: () =>
    apiFetch<LabelTemplateRow[]>("/label-templates", { on401: "throw" }),

  get: (id: string) =>
    apiFetch<LabelTemplateRow>(`/label-templates/${id}`, { on401: "throw" }),

  create: (data: LabelTemplatePayload) =>
    apiFetch<LabelTemplateRow>("/label-templates", { method: "POST", body: data, on401: "throw" }),

  update: (id: string, data: Partial<LabelTemplatePayload>) =>
    apiFetch<LabelTemplateRow>(`/label-templates/${id}`, { method: "PUT", body: data, on401: "throw" }),

  remove: (id: string) =>
    apiFetch<{ ok: boolean }>(`/label-templates/${id}`, { method: "DELETE", on401: "throw" }),

  replaceElements: (id: string, elements: LabelElementPayload[]) =>
    apiFetch<LabelTemplateRow>(`/label-templates/${id}/elements`, {
      method: "PUT", body: { elements }, on401: "throw",
    }),
};

// ── Preset templates ─────────────────────────────────────────────────────────

export const PRESET_TEMPLATES: (Omit<LabelTemplatePayload, "name"> & { name: string; elements: Omit<LabelElementPayload, "configJson">[] })[] = [
  {
    name: "Plantilla A",
    widthMm: 58, heightMm: 40, dpi: 203,
    elements: [
      { type: "TEXT",    fieldKey: "article.name",      x: 2, y: 2,    width: 54, height: 7, fontSize: 8,  fontWeight: "bold",   align: "center" },
      { type: "TEXT",    fieldKey: "variant.name",       x: 2, y: 9,    width: 54, height: 5, fontSize: 6,  fontWeight: "normal", align: "center" },
      { type: "BARCODE", fieldKey: "article.barcode",    x: 3, y: 14,   width: 52, height: 14, fontSize: 6, fontWeight: "normal", align: "center" },
      { type: "TEXT",    fieldKey: "article.code",       x: 2, y: 28,   width: 28, height: 5, fontSize: 6,  fontWeight: "normal", align: "left" },
      { type: "TEXT",    fieldKey: "article.salePrice",  x: 30, y: 28,  width: 26, height: 5, fontSize: 8,  fontWeight: "bold",   align: "right" },
      { type: "LINE",    fieldKey: "",                   x: 2, y: 27,   width: 54, height: 0.5, fontSize: 6, fontWeight: "normal", align: "left" },
    ],
  },
  {
    name: "Plantilla B",
    widthMm: 40, heightMm: 25, dpi: 203,
    elements: [
      { type: "TEXT", fieldKey: "article.name",     x: 1, y: 1, width: 38, height: 5, fontSize: 7, fontWeight: "bold",   align: "center" },
      { type: "TEXT", fieldKey: "variant.name",      x: 1, y: 6, width: 20, height: 5, fontSize: 8, fontWeight: "bold",   align: "left", label: "T:" },
      { type: "TEXT", fieldKey: "article.salePrice", x: 21, y: 6, width: 18, height: 5, fontSize: 8, fontWeight: "bold",  align: "right" },
      { type: "BARCODE", fieldKey: "article.barcode", x: 2, y: 12, width: 36, height: 10, fontSize: 5, fontWeight: "normal", align: "center" },
    ],
  },
  {
    name: "Plantilla C",
    widthMm: 58, heightMm: 30, dpi: 203,
    elements: [
      { type: "TEXT", fieldKey: "article.name",      x: 2, y: 2, width: 54, height: 7,  fontSize: 8, fontWeight: "bold",   align: "center" },
      { type: "TEXT", fieldKey: "article.costPrice", x: 2, y: 9, width: 54, height: 7,  fontSize: 11, fontWeight: "bold", align: "center", label: "Costo: " },
      { type: "TEXT", fieldKey: "article.code",      x: 2, y: 22, width: 28, height: 5, fontSize: 6, fontWeight: "normal", align: "left" },
      { type: "TEXT", fieldKey: "article.salePrice", x: 30, y: 22, width: 26, height: 5, fontSize: 7, fontWeight: "bold",  align: "right" },
    ],
  },
];

/**
 * Catálogo de campos imprimibles para el editor de etiquetas.
 * Las entradas con isHeader: true son separadores visuales (no seleccionables).
 * Usar con <TPComboFixed searchable> para búsqueda rápida.
 */
export const FIELD_KEY_OPTIONS = [
  // ── Identificación ───────────────────────────────────────────────────────────
  { value: "__h_ident",              label: "Identificación",       isHeader: true },
  { value: "article.name",          label: "Nombre del artículo" },
  { value: "variant.name",          label: "Nombre de variante" },
  { value: "article.code",          label: "Código" },
  { value: "resolvedSku",           label: "SKU" },
  { value: "article.barcode",       label: "Código de barras" },
  { value: "qrCode",                label: "Código QR" },
  { value: "rfidCode",              label: "Código RFID" },
  { value: "article.brand",         label: "Marca" },
  { value: "manufacturer",          label: "Fabricante" },
  { value: "supplierName",          label: "Proveedor" },

  // ── Precio y costos ───────────────────────────────────────────────────────────
  { value: "__h_price",              label: "Precio",               isHeader: true },
  { value: "article.salePrice",     label: "Precio de venta" },
  { value: "article.costPrice",     label: "Costo" },
  { value: "hechura",               label: "Hechura" },

  // ── Metales y peso ────────────────────────────────────────────────────────────
  { value: "__h_metals",             label: "Metales y peso",       isHeader: true },
  { value: "totalWeight",           label: "Grs totales" },
  { value: "metalVariantWeights",   label: "Grs por metal" },
  { value: "mainMetal",             label: "Metal principal" },
  { value: "purityOrLey",           label: "Ley / pureza" },
  { value: "resolvedMerma",         label: "Merma" },
  { value: "metalMermaSummary",     label: "Merma por metal" },

  // ── Clasificación ─────────────────────────────────────────────────────────────
  { value: "__h_class",              label: "Clasificación",        isHeader: true },
  { value: "categoryName",          label: "Categoría" },
  { value: "groupName",             label: "Grupo comercial" },
  { value: "articleType",           label: "Tipo de artículo" },
  { value: "articleStatus",         label: "Estado" },

  // ── Atributos ────────────────────────────────────────────────────────────────
  { value: "__h_attrs",              label: "Atributos",            isHeader: true },
  { value: "resolvedAttributesSummary", label: "Atributos resueltos" },
  { value: "attributesSummary",     label: "Atributos de variante" },

  // ── Inventario ───────────────────────────────────────────────────────────────
  { value: "__h_inv",                label: "Inventario",           isHeader: true },
  { value: "stockTotal",            label: "Stock actual" },
  { value: "reorderPoint",          label: "Punto de reposición" },
  { value: "defaultQuantity",       label: "Cantidad predeterminada" },

  // ── Descriptivos ─────────────────────────────────────────────────────────────
  { value: "__h_desc",               label: "Descriptivos",         isHeader: true },
  { value: "description",           label: "Descripción" },
  { value: "notes",                 label: "Notas" },
  { value: "unitOfMeasure",         label: "Unidad de medida" },
  { value: "dimensions",            label: "Dimensiones" },

  // ── Texto libre ──────────────────────────────────────────────────────────────
  { value: "__h_static",             label: "Texto libre",          isHeader: true },
  { value: "static",                label: "Texto estático" },

  // ── Avanzados ────────────────────────────────────────────────────────────────
  { value: "__h_adv",                label: "Avanzados",            isHeader: true },
  { value: "mermaPercent",          label: "Merma % (raw)" },
  { value: "variant.code",          label: "Código de variante" },
  { value: "variant.sku",           label: "SKU de variante" },
  { value: "attr.Talle",            label: "Atributo: Talle" },
  { value: "attr.Color",            label: "Atributo: Color" },
  { value: "attr.Piedra",           label: "Atributo: Piedra" },
];
