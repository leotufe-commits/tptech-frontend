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
  id:          string;
  name:        string;
  widthMm:     string;
  heightMm:    string;
  dpi:         number;
  orientation: string;
  bgColor:     string;
  isDefault:   boolean;
  isActive:    boolean;
  deletedAt:   string | null;
  createdAt:   string;
  elements:    LabelElementRow[];
};

export type LabelTemplatePayload = {
  name:        string;
  widthMm:     number;
  heightMm:    number;
  dpi?:        number;
  orientation?: string;
  bgColor?:    string;
  isDefault?:  boolean;
  isActive?:   boolean;
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
    name: "Joyería 58×40",
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
    name: "Anillos 40×25",
    widthMm: 40, heightMm: 25, dpi: 203,
    elements: [
      { type: "TEXT", fieldKey: "article.name",     x: 1, y: 1, width: 38, height: 5, fontSize: 7, fontWeight: "bold",   align: "center" },
      { type: "TEXT", fieldKey: "variant.name",      x: 1, y: 6, width: 20, height: 5, fontSize: 8, fontWeight: "bold",   align: "left", label: "T:" },
      { type: "TEXT", fieldKey: "article.salePrice", x: 21, y: 6, width: 18, height: 5, fontSize: 8, fontWeight: "bold",  align: "right" },
      { type: "BARCODE", fieldKey: "article.barcode", x: 2, y: 12, width: 36, height: 10, fontSize: 5, fontWeight: "normal", align: "center" },
    ],
  },
  {
    name: "Etiqueta interna 58×30",
    widthMm: 58, heightMm: 30, dpi: 203,
    elements: [
      { type: "TEXT", fieldKey: "article.name",      x: 2, y: 2, width: 54, height: 7,  fontSize: 8, fontWeight: "bold",   align: "center" },
      { type: "TEXT", fieldKey: "article.costPrice", x: 2, y: 9, width: 54, height: 7,  fontSize: 11, fontWeight: "bold", align: "center", label: "Costo: " },
      { type: "TEXT", fieldKey: "article.code",      x: 2, y: 22, width: 28, height: 5, fontSize: 6, fontWeight: "normal", align: "left" },
      { type: "TEXT", fieldKey: "article.salePrice", x: 30, y: 22, width: 26, height: 5, fontSize: 7, fontWeight: "bold",  align: "right" },
    ],
  },
  // ── Print 2 — Etiqueta técnica 100×20mm ──────────────────────────────────
  // Layout: | Lado operario (0-50mm) | Lado engranaje (50-77.5mm) | Avance (77.5-100mm) |
  {
    name: "Print 2",
    widthMm: 100, heightMm: 20, dpi: 203, orientation: "horizontal",
    elements: [
      // Borders
      { type: "LINE", fieldKey: "", label: "",               x: 0,    y: 0,    width: 100,  height: 0.3,  fontSize: 6, fontWeight: "normal", align: "left"   },
      { type: "LINE", fieldKey: "", label: "",               x: 0,    y: 19.7, width: 100,  height: 0.3,  fontSize: 6, fontWeight: "normal", align: "left"   },
      { type: "LINE", fieldKey: "", label: "",               x: 0,    y: 0,    width: 0.3,  height: 20,   fontSize: 6, fontWeight: "normal", align: "left"   },
      { type: "LINE", fieldKey: "", label: "",               x: 99.7, y: 0,    width: 0.3,  height: 20,   fontSize: 6, fontWeight: "normal", align: "left"   },
      // Section dividers
      { type: "LINE", fieldKey: "", label: "",               x: 50,   y: 0,    width: 0.3,  height: 20,   fontSize: 6, fontWeight: "normal", align: "left"   },
      { type: "LINE", fieldKey: "", label: "",               x: 77.5, y: 1.5,  width: 0.3,  height: 17,   fontSize: 6, fontWeight: "normal", align: "left"   },
      // Left — Lado operario
      { type: "TEXT", fieldKey: "static",       label: "Lado operario",  x: 1,    y: 1,   width: 47.5, height: 4,    fontSize: 6,  fontWeight: "bold",   align: "center" },
      { type: "TEXT", fieldKey: "article.name", label: "",               x: 1.5,  y: 6,   width: 46.5, height: 5.5,  fontSize: 8,  fontWeight: "bold",   align: "left"   },
      { type: "TEXT", fieldKey: "article.code", label: "",               x: 1.5,  y: 12,  width: 46.5, height: 4.5,  fontSize: 6,  fontWeight: "normal", align: "left"   },
      // Center-right — Lado engranaje
      { type: "TEXT", fieldKey: "static",       label: "Lado engranaje", x: 51,   y: 1,   width: 25.5, height: 4,    fontSize: 6,  fontWeight: "bold",   align: "center" },
      { type: "TEXT", fieldKey: "variant.name", label: "",               x: 51.5, y: 6,   width: 24.5, height: 5.5,  fontSize: 7,  fontWeight: "normal", align: "left"   },
      // Right — Avance
      { type: "TEXT", fieldKey: "static",       label: "Avance",         x: 78,   y: 1,   width: 21,   height: 4,    fontSize: 6,  fontWeight: "bold",   align: "center" },
      { type: "TEXT", fieldKey: "static",       label: "→→→",            x: 78,   y: 9,   width: 21,   height: 8,    fontSize: 11, fontWeight: "bold",   align: "center" },
    ],
  },
];

export const FIELD_KEY_OPTIONS = [
  { value: "article.name",      label: "Nombre del artículo" },
  { value: "article.code",      label: "Código" },
  { value: "article.sku",       label: "SKU" },
  { value: "article.barcode",   label: "Código de barras" },
  { value: "article.salePrice", label: "Precio de venta" },
  { value: "article.costPrice", label: "Precio de costo" },
  { value: "article.brand",     label: "Marca" },
  { value: "variant.name",      label: "Nombre de variante" },
  { value: "variant.code",      label: "Código de variante" },
  { value: "static",            label: "Texto estático" },
];
