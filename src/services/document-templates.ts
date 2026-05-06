// src/services/document-templates.ts
import { apiFetch } from "../lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type DocumentKind =
  | "PRESUPUESTO"
  | "FACTURA"
  | "REMITO"
  | "ORDEN_COMPRA"
  | "MOVIMIENTO_STOCK";

export type ColumnConfig = {
  key:       string;
  label:     string;
  visible:   boolean;
  width:     number;
  align:     "left" | "center" | "right";
  sortOrder: number;
};

export type SectionsConfig = Record<string, boolean>;

export type LayoutType = "A4" | "TICKET" | "COMPACT";

export type DocumentTemplateConfig = {
  id:         string;
  kind:       DocumentKind;
  layoutType: LayoutType;
  name:       string;
  isDefault:  boolean;
  isActive:   boolean;

  // Encabezado
  headerLogoEnabled:      boolean;
  headerLogoSize:           string;   // mm como string: "10"–"50"
  headerLogoPosition:       string;   // "left" | "center" | "right"
  headerLogoBorderRadius:   number;   // 0–100: 0=cuadrado, 100=circular
  headerShowProductImage:   boolean;
  headerShowName:         boolean;
  headerShowLegalName:    boolean;
  headerShowCuit:      boolean;
  headerShowAddress:   boolean;
  headerShowPhone:     boolean;
  headerShowEmail:     boolean;
  headerShowWebsite:   boolean;
  headerCustomText:    string;

  // Página
  pageSizePreset: string;
  isCustomSize:   boolean;
  pageWidthMm:    number;
  pageHeightMm:   number;
  orientation:    string;
  marginTop:      number;
  marginRight:  number;
  marginBottom: number;
  marginLeft:   number;

  // Estilo
  fontFamily:   string;
  fontSizeBase: number;
  accentColor:  string;
  tableStyle:   string;

  // Moneda
  currencyShowSymbol: boolean;
  currencyShowRate:   boolean;
  currencyDecimals:   number;
  pricesIncludeTax:   boolean;

  // Pie
  footerText:            string;
  footerLegalText:       string;
  footerBankData:        string;
  footerTerms:           string;
  footerShowPageNumbers: boolean;
  footerPageFormat:      string;
  footerPagePosition:    string;

  // Dinámico
  sections:       SectionsConfig;
  columns:        ColumnConfig[];
  columnsVersion: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Constantes del frontend (espejo de las del backend)
// ─────────────────────────────────────────────────────────────────────────────

export const DOC_KIND_LABELS: Record<DocumentKind, string> = {
  PRESUPUESTO:      "Presupuesto",
  FACTURA:          "Factura",
  REMITO:           "Remito",
  ORDEN_COMPRA:     "Orden de compra",
  MOVIMIENTO_STOCK: "Movimiento de stock",
};

export const DOC_KIND_DESCRIPTIONS: Record<DocumentKind, string> = {
  PRESUPUESTO:      "Oferta comercial con precios y condiciones de pago.",
  FACTURA:          "Comprobante fiscal de ventas confirmadas.",
  REMITO:           "Documento de entrega y recepción de mercadería.",
  ORDEN_COMPRA:     "Solicitud formal de compra a proveedores.",
  MOVIMIENTO_STOCK: "Registro de entradas, salidas y transferencias de stock.",
};

export const ALL_KINDS: DocumentKind[] = [
  "PRESUPUESTO",
  "FACTURA",
  "REMITO",
  "ORDEN_COMPRA",
  "MOVIMIENTO_STOCK",
];

export type SectionMeta = { label: string; description: string };

export const SECTIONS_META: Record<string, SectionMeta> = {
  seller:             { label: "Vendedor",             description: "Nombre del vendedor asignado al documento." },
  warehouse:          { label: "Almacén",              description: "Almacén de origen o destino." },
  paymentTerms:       { label: "Condición de pago",    description: "Forma de pago pactada." },
  currency:           { label: "Moneda",               description: "Moneda utilizada." },
  exchangeRate:       { label: "Cotización",           description: "Tipo de cambio vigente." },
  discount:           { label: "Descuentos",           description: "Descuento global aplicado." },
  taxes:              { label: "Impuestos",            description: "IVA u otros impuestos." },
  subtotal:           { label: "Subtotal",             description: "Subtotal antes de impuestos." },
  total:              { label: "Total",                description: "Monto total del documento." },
  observations:       { label: "Observaciones",        description: "Notas adicionales." },
  signature:          { label: "Firma",                description: "Espacio para firma." },
  qrCode:             { label: "Código QR",            description: "QR con datos del documento." },
  termsAndConditions: { label: "Términos y cond.",     description: "Condiciones generales." },
  validityDate:       { label: "Válido hasta",         description: "Vencimiento del presupuesto." },
  fiscalData:         { label: "Datos fiscales",       description: "CAE, punto de venta, número." },
  deliveryAddress:    { label: "Dirección de entrega", description: "Dirección de envío." },
};

export const SECTIONS_DEFAULTS: Record<DocumentKind, Record<string, boolean>> = {
  PRESUPUESTO: {
    seller: true,  warehouse: false, paymentTerms: true,
    currency: true,  exchangeRate: false,
    discount: true,  taxes: true,  subtotal: true, total: true,
    observations: true,  signature: false, termsAndConditions: false, validityDate: true,
  },
  FACTURA: {
    seller: true,  warehouse: false, paymentTerms: true,
    currency: true,  exchangeRate: false,
    discount: true,  taxes: true,  subtotal: true, total: true,
    observations: true,  signature: false, qrCode: false, termsAndConditions: false, fiscalData: true,
  },
  REMITO: {
    seller: true,  warehouse: true, currency: false,
    subtotal: false, total: false,
    observations: true,  signature: true, deliveryAddress: false,
  },
  ORDEN_COMPRA: {
    seller: true,  warehouse: true, paymentTerms: true,
    currency: true,  exchangeRate: false,
    discount: false, taxes: true,  subtotal: true, total: true,
    observations: true,  termsAndConditions: false,
  },
  MOVIMIENTO_STOCK: {
    warehouse: true,  observations: true, signature: false,
  },
};

export const SECTIONS_AVAILABLE: Record<DocumentKind, string[]> = {
  PRESUPUESTO: [
    "seller", "warehouse", "paymentTerms", "currency", "exchangeRate",
    "discount", "taxes", "subtotal", "total",
    "observations", "signature", "termsAndConditions", "validityDate",
  ],
  FACTURA: [
    "seller", "warehouse", "paymentTerms", "currency", "exchangeRate",
    "discount", "taxes", "subtotal", "total",
    "observations", "signature", "qrCode", "termsAndConditions", "fiscalData",
  ],
  REMITO: [
    "seller", "warehouse", "currency",
    "subtotal", "total",
    "observations", "signature", "deliveryAddress",
  ],
  ORDEN_COMPRA: [
    "seller", "warehouse", "paymentTerms", "currency", "exchangeRate",
    "discount", "taxes", "subtotal", "total",
    "observations", "termsAndConditions",
  ],
  MOVIMIENTO_STOCK: [
    "warehouse", "observations", "signature",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Tamaño y posición del logo
// ─────────────────────────────────────────────────────────────────────────────

/** Convierte el valor de headerLogoSize (mm como string, o legacy "sm/md/lg") a px para el preview. */
export function getLogoPx(size: string): { w: number; h: number } {
  const PX_PER_MM = 380 / 210; // ≈ 1.81 px/mm (escala A4 → 380px)
  const legacy: Record<string, number> = { sm: 12, md: 18, lg: 25 };
  const mm = legacy[size] != null ? legacy[size] : (parseInt(size, 10) || 18);
  const h = Math.round(mm * PX_PER_MM);
  const w = Math.round(h * 1.36); // aspect ratio promedio de logo apaisado
  return { w, h };
}

/** Rango del slider de tamaño (en mm) */
export const LOGO_SIZE_MIN_MM = 10;
export const LOGO_SIZE_MAX_MM = 50;
export const LOGO_SIZE_DEFAULT_MM = 18;

export const LOGO_POSITION_OPTIONS = [
  { value: "left",   label: "Izquierda" },
  { value: "center", label: "Centro"    },
  { value: "right",  label: "Derecha"   },
];

/** Rango del slider de redondeo (0 = cuadrado, 100 = circular) */
export const LOGO_BORDER_RADIUS_MIN     = 0;
export const LOGO_BORDER_RADIUS_MAX     = 100;
export const LOGO_BORDER_RADIUS_DEFAULT = 20;

/**
 * Convierte el valor del slider (0-100) a px de border-radius para el preview.
 * 0 → 0px · 100 → heightPx/2 (totalmente circular)
 */
export function getLogoBorderRadiusPx(radiusPercent: number, heightPx: number): number {
  return Math.round((Math.max(0, Math.min(100, radiusPercent)) / 100) * (heightPx / 2));
}

// ─────────────────────────────────────────────────────────────────────────────
// Tamaños de hoja
// ─────────────────────────────────────────────────────────────────────────────

export type PageSizePreset =
  | "A4" | "A5" | "Letter" | "Legal"
  | "ticket58" | "ticket80"
  | "compact" | "custom";

export type PageSizeInfo = {
  label:    string;
  widthMm:  number;
  heightMm: number;
  isTicket: boolean;
  note?:    string;
};

/** Dimensiones canónicas en portrait (sin orientación aplicada) */
export const PAGE_SIZE_PRESETS: Record<PageSizePreset, PageSizeInfo> = {
  A4:       { label: "A4",              widthMm: 210, heightMm: 297, isTicket: false },
  A5:       { label: "A5",              widthMm: 148, heightMm: 210, isTicket: false },
  Letter:   { label: "Letter / Carta",  widthMm: 216, heightMm: 279, isTicket: false },
  Legal:    { label: "Legal / Oficio",  widthMm: 216, heightMm: 356, isTicket: false },
  ticket58: { label: "Ticket 58 mm",   widthMm:  58, heightMm: 200, isTicket: true,
              note: "Papel térmico continuo — alto es referencia para la vista previa" },
  ticket80: { label: "Ticket 80 mm",   widthMm:  80, heightMm: 200, isTicket: true,
              note: "Papel térmico continuo — alto es referencia para la vista previa" },
  compact:  { label: "Compacto / A6",  widthMm: 105, heightMm: 148, isTicket: false },
  custom:   { label: "Personalizado",  widthMm: 210, heightMm: 297, isTicket: false },
};

export const PAGE_SIZE_OPTIONS = [
  { value: "A4",       label: "A4 (210 × 297 mm)" },
  { value: "A5",       label: "A5 (148 × 210 mm)" },
  { value: "Letter",   label: "Letter / Carta (216 × 279 mm)" },
  { value: "Legal",    label: "Legal / Oficio (216 × 356 mm)" },
  { value: "ticket58", label: "Ticket 58 mm (térmico)" },
  { value: "ticket80", label: "Ticket 80 mm (térmico)" },
  { value: "compact",  label: "Compacto / A6 (105 × 148 mm)" },
  { value: "custom",   label: "Personalizado" },
];

export const PAGE_UNIT_OPTIONS = [
  { value: "mm", label: "mm" },
  { value: "cm", label: "cm" },
  { value: "in", label: "pulgadas (in)" },
];

/** Convierte un valor desde la unidad dada a milímetros */
export function toMm(value: number, unit: string): number {
  if (unit === "cm") return +(value * 10).toFixed(2);
  if (unit === "in") return +(value * 25.4).toFixed(2);
  return +value.toFixed(2);
}

/** Convierte un valor desde milímetros a la unidad dada */
export function fromMm(valueMm: number, unit: string): number {
  if (unit === "cm") return +(valueMm / 10).toFixed(2);
  if (unit === "in") return +(valueMm / 25.4).toFixed(3);
  return +valueMm.toFixed(1);
}

export const ORIENTATION_OPTIONS = [
  { value: "portrait",  label: "Vertical (Portrait)" },
  { value: "landscape", label: "Horizontal (Landscape)" },
];

export const FONT_FAMILY_OPTIONS = [
  { value: "inter",  label: "Sans-serif (Inter)" },
  { value: "serif",  label: "Serif (Times)" },
  { value: "mono",   label: "Monoespaciado" },
];

export const TABLE_STYLE_OPTIONS = [
  { value: "bordered", label: "Con bordes" },
  { value: "minimal",  label: "Mínimo (solo líneas)" },
  { value: "striped",  label: "Rayado alternado" },
];

export const PAGE_FORMAT_OPTIONS = [
  { value: "page_of_total", label: "Página 1 de 3" },
  { value: "simple",        label: "1 / 3" },
  { value: "minimal",       label: "Solo número (1)" },
];

export const PAGE_POSITION_OPTIONS = [
  { value: "bottom_right",  label: "Abajo a la derecha" },
  { value: "bottom_center", label: "Abajo al centro" },
  { value: "bottom_left",   label: "Abajo a la izquierda" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Defaults locales (fallback cuando la API no está disponible)
// ─────────────────────────────────────────────────────────────────────────────

const SALE_COLUMNS_DEFAULT: ColumnConfig[] = [
  { key: "position",    label: "#",            visible: false, width: 28,  align: "center", sortOrder: 0  },
  { key: "code",        label: "Código",        visible: false, width: 60,  align: "left",   sortOrder: 1  },
  { key: "sku",         label: "SKU",           visible: false, width: 60,  align: "left",   sortOrder: 2  },
  { key: "description", label: "Descripción",   visible: true,  width: 180, align: "left",   sortOrder: 3  },
  { key: "variant",     label: "Variante",      visible: true,  width: 80,  align: "left",   sortOrder: 4  },
  { key: "quantity",    label: "Cant.",         visible: true,  width: 46,  align: "right",  sortOrder: 5  },
  { key: "unit",        label: "Unidad",        visible: false, width: 48,  align: "center", sortOrder: 6  },
  { key: "weight",      label: "Gramos",        visible: false, width: 56,  align: "right",  sortOrder: 7  },
  { key: "unitPrice",   label: "Precio unit.",  visible: true,  width: 80,  align: "right",  sortOrder: 8  },
  { key: "discount",    label: "Desc.",         visible: false, width: 54,  align: "right",  sortOrder: 9  },
  { key: "tax",         label: "IVA",           visible: false, width: 54,  align: "right",  sortOrder: 10 },
  { key: "subtotal",    label: "Subtotal",      visible: true,  width: 80,  align: "right",  sortOrder: 11 },
];

const MOVEMENT_COLUMNS_DEFAULT: ColumnConfig[] = [
  { key: "position",    label: "#",            visible: false, width: 28,  align: "center", sortOrder: 0 },
  { key: "code",        label: "Código",        visible: false, width: 60,  align: "left",   sortOrder: 1 },
  { key: "sku",         label: "SKU",           visible: true,  width: 60,  align: "left",   sortOrder: 2 },
  { key: "description", label: "Descripción",   visible: true,  width: 200, align: "left",   sortOrder: 3 },
  { key: "variant",     label: "Variante",      visible: true,  width: 80,  align: "left",   sortOrder: 4 },
  { key: "quantity",    label: "Cant.",         visible: true,  width: 46,  align: "right",  sortOrder: 5 },
  { key: "unit",        label: "Unidad",        visible: false, width: 48,  align: "center", sortOrder: 6 },
  { key: "weight",      label: "Gramos",        visible: true,  width: 56,  align: "right",  sortOrder: 7 },
];

const DEFAULT_COLUMNS: Record<DocumentKind, ColumnConfig[]> = {
  PRESUPUESTO:      SALE_COLUMNS_DEFAULT,
  FACTURA:          SALE_COLUMNS_DEFAULT,
  REMITO:           SALE_COLUMNS_DEFAULT,
  ORDEN_COMPRA:     SALE_COLUMNS_DEFAULT,
  MOVIMIENTO_STOCK: MOVEMENT_COLUMNS_DEFAULT,
};

export function buildLocalDefaultConfig(kind: DocumentKind, layoutType: LayoutType = "A4"): DocumentTemplateConfig {
  return {
    id:         `local-default-${kind}-${layoutType}`,
    kind,
    layoutType,
    name:       "",
    isDefault:  true,
    isActive:   true,

    headerLogoEnabled:        true,
    headerLogoSize:           "18",
    headerLogoPosition:       "left",
    headerLogoBorderRadius:   LOGO_BORDER_RADIUS_DEFAULT,
    headerShowProductImage:   false,
    headerShowName:         true,
    headerShowLegalName:    false,
    headerShowCuit:      true,
    headerShowAddress:   true,
    headerShowPhone:     true,
    headerShowEmail:     false,
    headerShowWebsite:   false,
    headerCustomText:    "",

    pageSizePreset: "A4",
    isCustomSize:   false,
    pageWidthMm:    210,
    pageHeightMm:   297,
    orientation:    "portrait",
    marginTop:      15,
    marginRight:    15,
    marginBottom:   20,
    marginLeft:     15,

    fontFamily:   "inter",
    fontSizeBase: 10,
    accentColor:  "#1a1a1a",
    tableStyle:   "bordered",

    currencyShowSymbol: true,
    currencyShowRate:   false,
    currencyDecimals:   2,
    pricesIncludeTax:   false,

    footerText:            "",
    footerLegalText:       "",
    footerBankData:        "",
    footerTerms:           "",
    footerShowPageNumbers: true,
    footerPageFormat:      "page_of_total",
    footerPagePosition:    "bottom_right",

    sections:       SECTIONS_DEFAULTS[kind] ?? {},
    columns:        DEFAULT_COLUMNS[kind]   ?? [],
    columnsVersion: 1,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

export const documentTemplatesApi = {
  get(kind: DocumentKind, layout: LayoutType = "A4"): Promise<DocumentTemplateConfig> {
    return apiFetch<{ template: DocumentTemplateConfig }>(
      `/document-templates/${kind}?layout=${layout}`,
      { method: "GET" }
    ).then((r) => r.template);
  },

  save(kind: DocumentKind, data: Partial<DocumentTemplateConfig>, layout: LayoutType = "A4"): Promise<DocumentTemplateConfig> {
    return apiFetch<{ template: DocumentTemplateConfig }>(
      `/document-templates/${kind}?layout=${layout}`,
      { method: "PATCH", body: data }
    ).then((r) => r.template);
  },

  reset(kind: DocumentKind, layout: LayoutType = "A4"): Promise<DocumentTemplateConfig> {
    return apiFetch<{ template: DocumentTemplateConfig }>(
      `/document-templates/${kind}/reset?layout=${layout}`,
      { method: "POST" }
    ).then((r) => r.template);
  },
};
