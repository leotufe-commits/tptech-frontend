import { apiFetch } from "../lib/api";
import { saveAs } from "file-saver";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export type ArticleType          = "PRODUCT" | "SERVICE" | "MATERIAL";
export type ArticleStatus        = "DRAFT" | "ACTIVE" | "DISCONTINUED" | "ARCHIVED";
export type StockMode            = "NO_STOCK" | "BY_ARTICLE" | "BY_MATERIAL";
export type HechuraPriceMode     = "FIXED" | "PER_GRAM";
export type BarcodeType          = "CODE128" | "EAN13" | "QR";
export type BarcodeSource        = "CODE" | "SKU" | "CUSTOM";
export type CostCalculationMode  = "MANUAL" | "METAL_MERMA_HECHURA" | "MULTIPLIER";
export type MultiplierBase       = string;
export type CostLineType         = "METAL" | "HECHURA" | "PRODUCT" | "SERVICE" | "MANUAL";

// ---------------------------------------------------------------------------
// Pricing preview (motor de pasos)
// ---------------------------------------------------------------------------
export type PricingStepStatus = "ok" | "partial" | "missing" | "skipped";

export type PricingAlertLevel = "info" | "warning" | "error";

export type PricingAlert = {
  code:    string;
  level:   PricingAlertLevel;
  message: string;
};

export type PricingStepResult = {
  key:      string;
  label:    string;
  status:   PricingStepStatus;
  value:    string | null;
  message?: string;
  meta?:    Record<string, unknown>;
};

export type PricingPolicyResult = {
  canConfirm:     boolean;
  blockingAlerts: string[];
};

// ---------------------------------------------------------------------------
// Checkout (capa de pago sobre precio comercial)
// ---------------------------------------------------------------------------
export type CheckoutStep = {
  code:         string;
  label:        string;
  formula:      string;
  amount:       number;
  currencyCode: string;
};

export type CheckoutResult = {
  baseAmount:        number;
  paymentAdjustment: number;
  finalAmount:       number;
  installments?:     number;
  installmentAmount?: number;
  steps:             CheckoutStep[];
};

export type TaxBreakdownItem = {
  taxId:           string;
  name:            string;
  code:            string;
  taxType:         string;
  calculationType: string;
  applyOn:         string;
  /** true cuando la base fue sobreescrita por la configuración de la entidad */
  applyOnOverriddenByEntity?: boolean;
  /** Fuente del override: "INDIVIDUAL" (override puntual) o "GLOBAL" (override global de la entidad) */
  entityOverrideSource?: "INDIVIDUAL" | "GLOBAL";
  base:            number;
  baseEstimated:   boolean;
  rate:            number | null;
  fixedAmount:     number | null;
  taxAmount:       number;
};

export type PricingPreviewResult = {
  unitPrice:               string | null;
  basePrice:               string | null;
  quantityDiscountAmount:  string | null;
  promotionDiscountAmount: string | null;
  discountAmount:          string | null;
  priceSource:             string;
  baseSource:              string;
  appliedPriceListId:      string | null;
  appliedPriceListName:    string | null;
  appliedPromotionId:      string | null;
  appliedPromotionName:    string | null;
  appliedDiscountId:       string | null;
  marginPercent:           string | null;
  unitCost:                string | null;
  unitMargin:              string | null;
  costPartial:             boolean;
  costMode:                string;
  partial:                 boolean;
  stackingMode:            "CHAINED" | "BEST_OF_QD" | "BEST_OF_PROMO" | "NONE";
  steps:                   PricingStepResult[];
  alerts:                  PricingAlert[];
  policy:                  PricingPolicyResult;
  checkoutResult?:         CheckoutResult | null;
  metalHechuraBreakdown?:  {
    metalCost:        number;
    metalSale:        number;
    metalMarginPct:   number;
    hechuraCost:      number;
    hechuraSale:      number;
    hechuraMarginPct: number;
  } | null;
  /** Total de impuestos aplicados al precio unitario */
  taxAmount?:    string;
  /** Desglose por impuesto */
  taxBreakdown?: TaxBreakdownItem[];
  /** Precio unitario + impuestos */
  totalWithTax?: string | null;
  /** true cuando la entidad seleccionada tiene impuestos desactivados */
  taxExemptByEntity?: boolean;
  /** Costo base sin impuestos de compra (= unitCost, siempre presente cuando hay costo) */
  costBase?: string | null;
  /** Suma de impuestos de compra. null cuando no hay impuestos aplicados */
  costTaxAmount?: string | null;
  /** Costo total con impuestos de compra (costBase + costTaxAmount) */
  costWithTax?: string | null;
  /** Desglose por impuesto de compra */
  costTaxBreakdown?: PurchaseTaxBreakdownItem[];
};

export type PurchaseTaxBreakdownItem = {
  taxId:           string;
  name:            string;
  calculationType: string;
  rate:            number | null;
  fixedAmount:     number | null;
  taxAmount:       number;
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type QuantityUnit = string;

export type CostLine = {
  id?: string;
  type: CostLineType;
  label: string;
  quantity: number;
  quantityUnit: QuantityUnit;
  unitValue: number;
  currencyId: string | null;
  mermaPercent: number | null;
  metalVariantId: string | null;
  catalogItemId?: string | null;
  sortOrder: number;
  lineAdjKind:  string;
  lineAdjType:  string;
  lineAdjValue: number | null;
  // Expandidos desde el backend
  currency?: { id: string; code: string; symbol: string } | null;
  metalVariant?: {
    id: string; name: string; sku: string; purity: string;
    metal: { id: string; name: string };
  } | null;
};

export type ArticleComposition = {
  id: string;
  variantId: string;
  grams: string;
  isBase: boolean;
  sortOrder: number;
  metalVariant: {
    id: string;
    name: string;
    sku: string;
    purity: string;
    metal: { id: string; name: string };
  };
};

export type VariantAttributeValue = {
  id: string;
  assignmentId: string;
  value: string;
  assignment: {
    id: string;
    isRequired: boolean;
    sortOrder: number;
    isVariantAxis: boolean;
    definition: {
      id: string;
      name: string;
      code: string;
      inputType: string;
      options: { id: string; label: string; value: string }[];
    };
  };
};

export type VariantImage = {
  id: string;
  url: string;
  label: string;
  isMain: boolean;
  sortOrder: number;
};

export type ArticleVariant = {
  id: string;
  code: string;
  name: string;
  sku: string;
  barcode: string | null;
  barcodeType: BarcodeType;
  barcodeSource: BarcodeSource;
  costPrice: string | null;
  reorderPoint: string | null;
  openingStock: string | null;
  notes: string;
  weightOverride: string | null;
  hechuraPriceOverride: string | null;
  priceOverride: string | null;
  priceOverrideWithTax?: string | null;
  costPriceWithTax?: string | null;
  /** URL denormalizada de la imagen principal (para acceso rápido) */
  imageUrl: string;
  /** Galería completa de imágenes (hasta 5) */
  images: VariantImage[];
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  attributeValues?: VariantAttributeValue[];
};

export type ArticleAttributeValue = {
  id: string;
  assignmentId: string;
  value: string;
  assignment: {
    id: string;
    isRequired: boolean;
    sortOrder: number;
    definition: {
      id: string;
      name: string;
      code: string;
      inputType: string;
      options: { id: string; label: string; value: string }[];
    };
  };
};

export type ArticleImage = {
  id: string;
  url: string;
  label: string;
  isMain: boolean;
  sortOrder: number;
};

export type ArticleStock = {
  id: string;
  variantId: string | null;
  warehouseId: string;
  quantity: string;
  updatedAt: string;
  variant: { id: string; code: string; name: string } | null;
  warehouse: { id: string; name: string; code: string };
};

export type ArticleRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  articleType: ArticleType;
  categoryId: string | null;
  groupId: string | null;
  groupOrder: number;
  group: { id: string; name: string; slug: string } | null;
  status: ArticleStatus;
  stockMode: StockMode;
  sku: string;
  barcode: string | null;
  barcodeType: BarcodeType;
  barcodeSource: BarcodeSource;
  brand: string;
  manufacturer: string;
  costPrice: string | null;
  salePrice: string | null;
  sellWithoutVariants: boolean;
  isReturnable: boolean;
  showInStore: boolean;
  unitOfMeasure: string;
  reorderPoint: string | null;
  dimensionLength: string | null;
  dimensionWidth: string | null;
  dimensionHeight: string | null;
  dimensionUnit: string;
  weight: string | null;
  weightUnit: string;
  minSaleQuantity: string | null;
  maxSaleQuantity: string | null;
  defaultQuantity: string | null;
  inventoryAccount: string;
  preferredSupplierId: string | null;
  preferredSupplier: { id: string; displayName: string } | null;
  hechuraPrice: string | null;
  hechuraPriceMode: HechuraPriceMode;
  mermaPercent: string | null;
  costCalculationMode: CostCalculationMode;
  multiplierBase: MultiplierBase | null;
  multiplierValue: string | null;
  multiplierQuantity: string | null;
  multiplierCurrencyId: string | null;
  manualBaseCost: string | null;
  manualCurrencyId: string | null;
  manualAdjustmentKind: string;
  manualAdjustmentType: string;
  manualAdjustmentValue: string | null;
  manualTaxIds: string[];
  mainImageUrl: string;
  isFavorite: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string } | null;
  variants?: ArticleVariant[];
  computedCostBase: string | null;
  computedCostWithTax: string | null;
  resolvedSalePrice: string | null;
  resolvedSalePriceWithTax: string | null;
  resolvedPriceSource: "PROMOTION" | "PRICE_LIST_CATEGORY" | "PRICE_LIST_GENERAL" | "MANUAL_OVERRIDE" | "MANUAL_FALLBACK" | "NONE";
  resolvedPriceName: string | null;
  stockData?: {
    total: number;
    byVariant: { [variantId: string]: number };
  } | null;
  hasActivePromotion?: boolean;
  hasQuantityDiscount?: boolean;
  promotionSummary?: string | null;
  quantityDiscountSummary?: string | null;
  costComposition?: Array<{
    type: CostLineType;
    label: string;
    quantity: string;
    unitValue: string;
    currencyId: string | null;
    mermaPercent: string | null;
    metalVariantId: string | null;
    sortOrder: number;
    currency?: { id: string; code: string; symbol: string } | null;
    metalVariant?: {
      id: string; name: string; sku: string; purity: string;
      metal: { id: string; name: string };
    } | null;
  }>;
};

export type ComputedCostPrice = {
  value: string | null;
  mode: string;
  partial: boolean;
  // Desglose para simulación client-side de listas METAL_HECHURA / COST_PER_GRAM
  metalCost?: string | null;
  hechuraCost?: string | null;
  totalGrams?: string | null;
};

export type ComputedSalePrice = {
  value: string | null;
  mode: "PRICE_LIST" | "MANUAL" | "NONE";
  partial: boolean;
  priceListId: string | null;
  priceListName: string | null;
  priceSource: "CLIENT" | "CATEGORY" | "GENERAL" | "MANUAL";
};

export type EffectivePriceSource = "MANUAL_OVERRIDE" | "PRICE_LIST" | "MANUAL_FALLBACK";

// ---------------------------------------------------------------------------
// Import types
// ---------------------------------------------------------------------------
export type ImportPreviewRow = {
  index: number;
  isVariant: boolean;
  parentCode: string;
  displayName: string;
  status: "valid" | "existing" | "error" | "warning";
  errors: string[];
  warnings: string[];
  existingId?: string;
  /** Atributos de variante detectados en columnas Atrib_* (solo para variantes) */
  attributes?: Record<string, string>;
};

export type ImportPreviewResult = {
  total: number;
  articles: number;
  variants: number;
  valid: number;
  errors: number;
  existing: number;
  warnings: number;
  rows: ImportPreviewRow[];
};

export type ImportCommitRow = {
  index: number;
  displayName: string;
  status: "created" | "updated" | "skipped" | "error";
  errors?: string[];
  id?: string;
};

export type ImportCommitResult = {
  results: ImportCommitRow[];
  summary: { created: number; updated: number; skipped: number; errors: number };
};

export type ArticleDetail = Omit<ArticleRow, "costComposition"> & {
  jewelryId: string;
  notes: string;
  supplierCode: string;
  barcodeSource: BarcodeSource;
  compositions: ArticleComposition[];
  variants: ArticleVariant[];
  attributeValues: ArticleAttributeValue[];
  images: ArticleImage[];
  useManualSalePrice: boolean;
  stockData?: unknown;
  computedCostPrice?: ComputedCostPrice;
  computedSalePrice?: ComputedSalePrice;
  effectiveSalePrice?: string | null;
  effectivePriceSource?: EffectivePriceSource;
  costComposition?: CostLine[];
};

export type ArticleListResponse = {
  rows: ArticleRow[];
  total: number;
  skip: number;
  take: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ArticleListParams = {
  q?: string;
  categoryId?: string;
  articleType?: string;
  status?: string;
  stockMode?: string;
  barcode?: string;
  sku?: string;
  showInStore?: boolean;
  preferredSupplierId?: string;
  isFavorite?: boolean;
  showInActive?: boolean;
  skip?: number;
  take?: number;
  page?: number;
  pageSize?: number;
  sortKey?: string;
  sortDir?: "asc" | "desc";
  groupId?: string;
  brand?: string;
  hasVariants?: boolean;
};

export type ArticlePayload = {
  name: string;
  code?: string;
  articleType?: ArticleType;
  description?: string;
  categoryId?: string | null;
  groupId?: string | null;
  status?: ArticleStatus;
  stockMode?: StockMode;
  sku?: string;
  barcode?: string | null;
  barcodeType?: BarcodeType;
  barcodeSource?: BarcodeSource;
  autoBarcode?: boolean;
  brand?: string;
  manufacturer?: string;
  supplierCode?: string;
  preferredSupplierId?: string | null;
  costPrice?: number | null;
  salePrice?: number | null;
  useManualSalePrice?: boolean;
  sellWithoutVariants?: boolean;
  isReturnable?: boolean;
  showInStore?: boolean;
  unitOfMeasure?: string;
  reorderPoint?: number | null;
  openingStock?: number | null;
  dimensionLength?: number | null;
  dimensionWidth?: number | null;
  dimensionHeight?: number | null;
  dimensionUnit?: string;
  weight?: number | null;
  weightUnit?: string;
  minSaleQuantity?: number | null;
  maxSaleQuantity?: number | null;
  defaultQuantity?: number | null;
  inventoryAccount?: string;
  hechuraPrice?: number | null;
  hechuraPriceMode?: HechuraPriceMode;
  mermaPercent?: number | null;
  costCalculationMode?: CostCalculationMode;
  multiplierBase?: MultiplierBase | null;
  multiplierValue?: number | null;
  multiplierQuantity?: number | null;
  multiplierCurrencyId?: string | null;
  manualBaseCost?: number | null;
  manualCurrencyId?: string | null;
  manualAdjustmentKind?: string;
  manualAdjustmentType?: string;
  manualAdjustmentValue?: number | null;
  manualTaxIds?: string[];
  isFavorite?: boolean;
  notes?: string;
  costComposition?: CostLine[];
};

export type CompositionPayload = {
  variantId: string;
  grams: number;
  isBase?: boolean;
  sortOrder?: number;
};

export type VariantPayload = {
  code: string;
  name: string;
  sku?: string;
  barcode?: string | null;
  barcodeType?: BarcodeType;
  barcodeSource?: BarcodeSource;
  autoBarcode?: boolean;
  costPrice?: number | null;
  reorderPoint?: number | null;
  openingStock?: number | null;
  notes?: string;
  weightOverride?: number | null;
  hechuraPriceOverride?: number | null;
  priceOverride?: number | null;
  sortOrder?: number;
  imageUrl?: string;
};

export type BarcodeLookupResult = {
  found: true;
  type: "article" | "variant";
  articleId: string;
  variantId: string | null;
  article: { id: string; code: string; name: string; mainImageUrl: string };
  variant: { id: string; code: string; name: string } | null;
} | { found: false };

// ---------------------------------------------------------------------------
// Variant label helper — shared across all pages
// Returns the readable label for a variant based on its axis attribute values.
// Format: "Oro Amarillo · Rubí · N°16"
// Falls back to "SKU — name" or just "name" when no axis values are present.
// ---------------------------------------------------------------------------
export function variantLabel(v: {
  name: string;
  sku?: string;
  code?: string;
  attributeValues?: Array<{
    value: string;
    assignmentId: string;
    assignment?: { isVariantAxis?: boolean; sortOrder?: number } | null;
  }>;
}): string {
  const axisAttrs = (v.attributeValues ?? [])
    .filter(av => av.assignment?.isVariantAxis)
    .sort((a, b) => (a.assignment?.sortOrder ?? 0) - (b.assignment?.sortOrder ?? 0));
  const attrStr = axisAttrs.map(av => av.value).filter(Boolean).join(" · ");
  if (attrStr) return attrStr;
  return v.name;
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------
export const ARTICLE_TYPE_LABELS: Record<ArticleType, string> = {
  PRODUCT:  "Producto",
  SERVICE:  "Servicio",
  MATERIAL: "Material",
};

export const ARTICLE_TYPE_TONES: Record<ArticleType, "primary" | "success" | "warning"> = {
  PRODUCT:  "primary",
  SERVICE:  "success",
  MATERIAL: "warning",
};

export const ARTICLE_STATUS_LABELS: Record<ArticleStatus, string> = {
  DRAFT:        "Borrador",
  ACTIVE:       "Activo",
  DISCONTINUED: "Discontinuado",
  ARCHIVED:     "Archivado",
};

export const STOCK_MODE_LABELS: Record<StockMode, string> = {
  NO_STOCK:    "Sin stock",
  BY_ARTICLE:  "Por artículo",
  BY_MATERIAL: "Por material",
};

export const STOCK_MODE_SHORT: Record<StockMode, string> = {
  NO_STOCK:    "—",
  BY_ARTICLE:  "Art.",
  BY_MATERIAL: "Mat.",
};

export const HECHURA_MODE_LABELS: Record<HechuraPriceMode, string> = {
  FIXED:    "Monto fijo",
  PER_GRAM: "Por gramo",
};

export const BARCODE_SOURCE_LABELS: Record<BarcodeSource, string> = {
  CODE:   "Código de artículo",
  SKU:    "SKU",
  CUSTOM: "Código de barras personalizado",
};

export const BARCODE_SOURCE_DESCRIPTIONS: Record<BarcodeSource, string> = {
  CODE:   "El escáner encontrará este artículo por su código interno (ej: ART-0001)",
  SKU:    "El escáner encontrará este artículo por su SKU",
  CUSTOM: "Ingresá o escaneá el código de barras del producto físico",
};

/** @deprecated MANUAL y MULTIPLIER son modos heredados — nuevos artículos usan METAL_MERMA_HECHURA */
export const COST_MODE_LABELS: Record<CostCalculationMode, string> = {
  MANUAL:              "Composición del costo",  // legacy: hechura fija
  MULTIPLIER:          "Composición del costo",  // legacy: hechura por unidad
  METAL_MERMA_HECHURA: "Composición del costo",
};

/** @deprecated — las bases ahora son strings libres cargados del catálogo MULTIPLIER_BASE */
export const MULTIPLIER_BASE_LABELS: Record<string, string> = {
  GRAMS:   "Gramos",
  KILATES: "Kilates",
  UNITS:   "Unidades",
};

export const ARTICLE_STATUS_COLORS: Record<ArticleStatus, string> = {
  DRAFT:        "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  ACTIVE:       "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  DISCONTINUED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  ARCHIVED:     "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function fmtMoney(v: string | number | null | undefined, sym = "$"): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!isFinite(n)) return "—";
  return sym + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtQty(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!isFinite(n)) return "—";
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
export const articlesApi = {
  listBrands: () =>
    apiFetch<{ brands: string[] }>("/articles/brands", { on401: "throw" }),

  list: (params?: ArticleListParams) => {
    const qs = new URLSearchParams();
    if (params?.q)                qs.set("q",                  params.q);
    if (params?.categoryId)       qs.set("categoryId",          params.categoryId);
    if (params?.articleType)      qs.set("articleType",         params.articleType);
    if (params?.status)           qs.set("status",              params.status);
    if (params?.stockMode)        qs.set("stockMode",           params.stockMode);
    if (params?.barcode)          qs.set("barcode",             params.barcode);
    if (params?.sku)              qs.set("sku",                 params.sku);
    if (params?.showInStore)      qs.set("showInStore",         "true");
    if (params?.preferredSupplierId) qs.set("preferredSupplierId", params.preferredSupplierId);
    if (params?.isFavorite)       qs.set("isFavorite",          "true");
    if (params?.showInActive)     qs.set("showInActive",        "true");
    if (params?.page != null)     qs.set("page",                String(params.page));
    if (params?.pageSize != null) qs.set("pageSize",            String(params.pageSize));
    if (params?.skip != null)     qs.set("skip",                String(params.skip));
    if (params?.take != null)     qs.set("take",                String(params.take));
    if (params?.sortKey)          qs.set("sortKey",             params.sortKey);
    if (params?.sortDir)          qs.set("sortDir",             params.sortDir);
    if (params?.groupId)          qs.set("groupId",             params.groupId);
    if (params?.brand)            qs.set("brand",               params.brand);
    if (params?.hasVariants)      qs.set("hasVariants",         "true");
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<ArticleListResponse>(`/articles${query}`, { method: "GET", on401: "throw" });
  },

  getOne: (id: string) =>
    apiFetch<ArticleDetail>(`/articles/${id}`, { method: "GET", on401: "throw" }),

  create: (data: ArticlePayload) =>
    apiFetch<ArticleDetail>("/articles", { method: "POST", body: data, on401: "throw" }),

  update: (id: string, data: ArticlePayload) =>
    apiFetch<ArticleDetail>(`/articles/${id}`, { method: "PUT", body: data, on401: "throw" }),

  toggle: (id: string) =>
    apiFetch<ArticleRow>(`/articles/${id}/toggle`, { method: "PATCH", on401: "throw" }),

  favorite: (id: string) =>
    apiFetch<{ id: string; isFavorite: boolean }>(`/articles/${id}/favorite`, { method: "PATCH", on401: "throw" }),

  remove: (id: string) =>
    apiFetch<{ id: string }>(`/articles/${id}`, { method: "DELETE", on401: "throw" }),

  lookupByBarcode: (barcode: string) =>
    apiFetch<BarcodeLookupResult>(`/articles/lookup?barcode=${encodeURIComponent(barcode)}`, { method: "GET", on401: "throw" }),

  costLines: {
    set: (articleId: string, lines: CostLine[]) =>
      apiFetch<ArticleDetail>(`/articles/${articleId}/cost-lines`, {
        method: "PUT",
        body: { lines },
        on401: "throw",
      }),
  },

  compositions: {
    list: (articleId: string) =>
      apiFetch<ArticleComposition[]>(`/articles/${articleId}/compositions`, { method: "GET", on401: "throw" }),
    upsert: (articleId: string, data: CompositionPayload) =>
      apiFetch<ArticleComposition>(`/articles/${articleId}/compositions`, { method: "PUT", body: data, on401: "throw" }),
    remove: (articleId: string, compositionId: string) =>
      apiFetch<{ id: string }>(`/articles/${articleId}/compositions/${compositionId}`, { method: "DELETE", on401: "throw" }),
  },

  variants: {
    list: (articleId: string) =>
      apiFetch<ArticleVariant[]>(`/articles/${articleId}/variants`, { method: "GET", on401: "throw" }),
    listDeleted: (articleId: string) =>
      apiFetch<ArticleVariant[]>(`/articles/${articleId}/variants/deleted`, { method: "GET", on401: "throw" }),
    create: (articleId: string, data: VariantPayload) =>
      apiFetch<ArticleVariant>(`/articles/${articleId}/variants`, { method: "POST", body: data, on401: "throw" }),
    update: (articleId: string, variantId: string, data: Partial<VariantPayload>) =>
      apiFetch<ArticleVariant>(`/articles/${articleId}/variants/${variantId}`, { method: "PUT", body: data, on401: "throw" }),
    toggle: (articleId: string, variantId: string) =>
      apiFetch<ArticleVariant>(`/articles/${articleId}/variants/${variantId}/toggle`, { method: "PATCH", on401: "throw" }),
    remove: (articleId: string, variantId: string) =>
      apiFetch<{ id: string }>(`/articles/${articleId}/variants/${variantId}`, { method: "DELETE", on401: "throw" }),
    restore: (articleId: string, variantId: string) =>
      apiFetch<ArticleVariant>(`/articles/${articleId}/variants/${variantId}/restore`, { method: "POST", on401: "throw" }),
    reorder: (articleId: string, ids: string[]) =>
      apiFetch<{ ok: boolean }>(`/articles/${articleId}/variants/reorder`, { method: "PATCH", body: { ids }, on401: "throw" }),
    uploadImage: (articleId: string, variantId: string, file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return apiFetch<ArticleVariant>(`/articles/${articleId}/variants/${variantId}/image`, { method: "POST", body: fd, on401: "throw" });
    },
    images: {
      upload: (articleId: string, variantId: string, file: File, isMain = false) => {
        const fd = new FormData();
        fd.append("file", file);
        if (isMain) fd.append("isMain", "true");
        return apiFetch<VariantImage>(`/articles/${articleId}/variants/${variantId}/images`, { method: "POST", body: fd, on401: "throw" });
      },
      setMain: (articleId: string, variantId: string, imageId: string) =>
        apiFetch<VariantImage>(`/articles/${articleId}/variants/${variantId}/images/${imageId}/set-main`, { method: "PATCH", on401: "throw" }),
      remove: (articleId: string, variantId: string, imageId: string) =>
        apiFetch<{ id: string }>(`/articles/${articleId}/variants/${variantId}/images/${imageId}`, { method: "DELETE", on401: "throw" }),
    },
  },

  attributes: {
    set: (articleId: string, values: { assignmentId: string; value: string }[]) =>
      apiFetch<ArticleAttributeValue[]>(`/articles/${articleId}/attributes`, { method: "PUT", body: { values }, on401: "throw" }),
  },

  variantAttributes: {
    get: (articleId: string, variantId: string) =>
      apiFetch<VariantAttributeValue[]>(`/articles/${articleId}/variants/${variantId}/attribute-values`, { method: "GET", on401: "throw" }),
    set: (articleId: string, variantId: string, values: { assignmentId: string; value: string }[]) =>
      apiFetch<VariantAttributeValue[]>(`/articles/${articleId}/variants/${variantId}/attribute-values`, { method: "PUT", body: values, on401: "throw" }),
  },

  images: {
    upload: (articleId: string, file: File, label?: string, isMain?: boolean) => {
      const fd = new FormData();
      fd.append("file", file);
      if (label)  fd.append("label",  label);
      if (isMain) fd.append("isMain", "true");
      return apiFetch<ArticleImage>(`/articles/${articleId}/images`, { method: "POST", body: fd, on401: "throw" });
    },
    setMain: (articleId: string, imageId: string) =>
      apiFetch<ArticleImage>(`/articles/${articleId}/images/${imageId}/set-main`, { method: "PATCH", on401: "throw" }),
    updateLabel: (articleId: string, imageId: string, label: string) =>
      apiFetch<ArticleImage>(`/articles/${articleId}/images/${imageId}`, { method: "PATCH", body: { label }, on401: "throw" }),
    remove: (articleId: string, imageId: string) =>
      apiFetch<{ id: string }>(`/articles/${articleId}/images/${imageId}`, { method: "DELETE", on401: "throw" }),
  },

  stock: {
    get: (articleId: string) =>
      apiFetch<ArticleStock[]>(`/articles/${articleId}/stock`, { method: "GET", on401: "throw" }),
    adjust: (articleId: string, data: { warehouseId: string; variantId?: string | null; quantity: number }) =>
      apiFetch<ArticleStock>(`/articles/${articleId}/stock`, { method: "PUT", body: data, on401: "throw" }),
    materialAvailability: (articleId: string, warehouseId?: string) => {
      const q = warehouseId ? `?warehouseId=${warehouseId}` : "";
      return apiFetch<unknown>(`/articles/${articleId}/stock/material-availability${q}`, { method: "GET", on401: "throw" });
    },
  },

  getSalePrice: (
    articleId: string,
    opts: { clientId?: string | null; variantId?: string | null; quantity?: number }
  ) => {
    const qs = new URLSearchParams();
    if (opts.clientId)  qs.set("clientId",  opts.clientId);
    if (opts.variantId) qs.set("variantId", opts.variantId);
    if (opts.quantity != null) qs.set("quantity", String(opts.quantity));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<import("./sales").SalePriceResult>(
      `/articles/${articleId}/sale-price${query}`,
      { method: "GET", on401: "throw" }
    );
  },

  getPricingPreview: (
    articleId: string,
    opts?: {
      variantId?: string | null;
      clientId?: string | null;
      quantity?: number;
      paymentMethodId?: string | null;
      installmentsQty?: number | null;
      priceListId?: string | null;
      quantityDiscountIds?: string[];
    }
  ) => {
    const qs = new URLSearchParams();
    if (opts?.clientId)        qs.set("clientId",        opts.clientId);
    if (opts?.variantId)       qs.set("variantId",       opts.variantId);
    if (opts?.quantity != null) qs.set("quantity",        String(opts.quantity));
    if (opts?.paymentMethodId) qs.set("paymentMethodId", opts.paymentMethodId);
    if (opts?.installmentsQty) qs.set("installmentsQty", String(opts.installmentsQty));
    if (opts?.priceListId)     qs.set("priceListId",     opts.priceListId);
    if (opts?.quantityDiscountIds?.length) qs.set("quantityDiscountIds", opts.quantityDiscountIds.join(","));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<PricingPreviewResult>(
      `/articles/${articleId}/pricing-preview${query}`,
      { method: "GET", on401: "throw" }
    );
  },

  import: {
    downloadTemplate: async () => {
      const base = import.meta.env.VITE_API_URL ?? "/api";
      const res = await fetch(`${base}/articles/import/template`, { credentials: "include" });
      if (!res.ok) throw new Error("Error al descargar la plantilla.");
      const blob = await res.blob();
      saveAs(blob, "tptech_articulos_template.xlsx");
    },
    preview: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return apiFetch<ImportPreviewResult>("/articles/import/preview", { method: "POST", body: fd, on401: "throw" });
    },
    execute: (file: File, onConflict: "skip" | "update") => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("onConflict", onConflict);
      return apiFetch<ImportCommitResult>("/articles/import/execute", { method: "POST", body: fd, on401: "throw" });
    },
  },
};
