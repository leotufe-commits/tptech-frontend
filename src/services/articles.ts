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
export type CostLineType         = "METAL" | "HECHURA" | "PRODUCT" | "SERVICE" | "MANUAL" | "LOGISTICS";
/** Modo comercial del artículo PRODUCT.
 *  NORMAL           = artículo regular (stock propio, precio normal).
 *  COMBO_COMMERCIAL = combo cuyo precio se calcula desde sus componentes y
 *                     cuyo stock se descuenta solo de los componentes al vender. */
export type ArticleCommercialMode = "NORMAL" | "COMBO_COMMERCIAL";
/** Ajuste aplicado al precio resultante de la suma de componentes de un combo. */
export type ComboAdjustmentKind   = "NONE" | "DISCOUNT_PERCENT" | "DISCOUNT_FIXED" | "SURCHARGE_PERCENT";

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

/** Tipo de capa que generó un ajuste sobre un componente (Metal/Hechura). */
export type ComponentAdjustmentKind =
  | "QUANTITY_DISCOUNT"
  | "PROMOTION"
  | "ENTITY_RULE"
  | "MANUAL_DISCOUNT";

/** Un ajuste imputado a un componente. `amount` es positivo cuando reduce el
 *  precio (descuento/bonificación) y negativo cuando lo aumenta (recargo).
 *
 *  Los campos opcionales (`base`, `percentage`, `valueType`, `source`) los
 *  agrega el motor cuando tiene la información (típicamente para descuentos
 *  PERCENTAGE). Permiten al frontend mostrar la fórmula "Base × % = monto"
 *  sin reconstruirla. Si no vienen, mostrar solo `label` + `amount`. */
export type ComponentSaleAdjustment = {
  kind:        ComponentAdjustmentKind;
  label:       string;
  amount:      number;
  applyOn:     "METAL" | "HECHURA";
  base?:       number | null;
  percentage?: number | null;
  valueType?:  "PERCENTAGE" | "FIXED_AMOUNT" | string | null;
  source?:     "CLIENT" | "GENERAL" | string | null;
};

/** Desglose de un componente: precio base (post-lista, pre-descuento), lista
 *  de ajustes que lo afectan y precio final (post-descuentos). */
export type ComponentSaleBreakdown = {
  base:        number;
  adjustments: ComponentSaleAdjustment[];
  final:       number;
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
  /** Modo de la lista aplicada — METAL_HECHURA / MARGIN_TOTAL / etc. */
  appliedPriceListMode?:   string | null;
  appliedPromotionId:      string | null;
  appliedPromotionName:    string | null;
  appliedDiscountId:       string | null;
  marginPercent:           string | null;
  /** Markup % sobre costo. Provisto por el motor (POLICY R6). Null si sin costo. */
  markupPercent:           string | null;
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
  channelResult?: {
    baseAmount:    number;
    channelAmount: number;
    finalAmount:   number;
    channelName:   string;
    channelId:     string;
  } | null;
  couponResult?: {
    baseAmount:     number;
    discountAmount: number;
    finalAmount:    number;
    couponCode:     string;
    couponName:     string;
    discountType:   string;
    discountValue:  number;
    applied:        boolean;
  } | null;
  /** Envío — step final independiente, no entra al cálculo del producto. */
  shippingResult?: {
    mode:   "FIXED" | "BY_WEIGHT" | "FREE";
    amount: number;
    label:  string;
  } | null;
  metalHechuraBreakdown?:  {
    metalCost:         number;
    metalSale:         number;
    metalMarginPct:    number;
    hechuraCost:       number;
    hechuraSale:       number;
    hechuraMarginPct:  number;
    metalGramsBase?:    number | null;
    metalGramsSale?:    number | null;
    metalPricePerGram?: number | null;
    // FASE 1 — el motor lo popula universalmente con flag estimated y source.
    metalSaleEstimated?:   boolean;
    hechuraSaleEstimated?: boolean;
    source?:
      | "METAL_HECHURA"
      | "PROPORTIONAL_COST"
      | "MANUAL_AS_HECHURA"
      | "SERVICE_AS_HECHURA"
      | "COMBO_COMPONENTS"
      | "NONE";
  } | null;
  /**
   * Desglose Metal/Hechura post-descuentos por componente.
   *
   * Mismo origen que `metalHechuraBreakdown` pero rola los descuentos
   * con `applyOn = METAL | HECHURA` sobre el componente correspondiente.
   * Permite mostrar el card "Hechura" con base + lista de ajustes +
   * subtotal final, sin recalcular en frontend.
   *
   * Importante: descuentos `applyOn = TOTAL | PRODUCT | SERVICE | METAL_Y_HECHURA`
   * NO entran en este desglose (son a nivel total, se muestran fuera).
   *
   * `null` cuando no hay desglose Metal/Hechura disponible (lista en modo
   * MARGIN_TOTAL, precio manual, fallback, etc.).
   */
  componentSaleBreakdown?: {
    metal:   ComponentSaleBreakdown;
    hechura: ComponentSaleBreakdown;
  } | null;
  /** Total de impuestos aplicados al precio unitario */
  taxAmount?:    string;
  /** Desglose por impuesto */
  taxBreakdown?: TaxBreakdownItem[];
  /** Precio unitario + impuestos */
  totalWithTax?: string | null;
  /** true cuando la entidad seleccionada tiene impuestos desactivados */
  taxExemptByEntity?: boolean;
  /**
   * Redondeo aplicado por la lista de precios. `null` si la lista no tiene
   * redondeo activo o si no movió el valor. El motor expone preRounding y
   * postRounding en strings (per unit); `unitAdjustment` ya es un number.
   */
  appliedRounding?: {
    source:        "PRICE_LIST";
    priceListId:   string | null;
    priceListName: string | null;
    applyOn:       "PRICE" | "NET" | "TOTAL";
    mode:          string;
    direction:     string;
    preRounding:   string;
    postRounding:  string;
    unitAdjustment: number;
  } | null;
  /** Costo base sin impuestos de compra (= unitCost, siempre presente cuando hay costo) */
  costBase?: string | null;
  /** Suma de impuestos de compra. null cuando no hay impuestos aplicados */
  costTaxAmount?: string | null;
  /** Costo total con impuestos de compra (costBase + costTaxAmount) */
  costWithTax?: string | null;
  /** Desglose por impuesto de compra */
  costTaxBreakdown?: PurchaseTaxBreakdownItem[];
  /**
   * Contexto de overrides de composición de costo (Fase 2). Para cada
   * campo: valor original del artículo + valor aplicado en este preview +
   * flag manual (si fue editado por el operador). Permite mostrar
   * "Original X / Usado Y" sin re-fetch del artículo.
   */
  costOverrideContext?: {
    grams?:        { original: number | null; applied: number | null; manual: boolean };
    mermaPercent?: { original: number | null; applied: number | null; manual: boolean };
    metalVariant?: { originalId: string | null; appliedId: string | null; manual: boolean };
    hechura?:      { original: number | null; applied: number | null; manual: boolean };
  } | null;
  /**
   * Estructura clara de composición de la línea — bloques METAL / HECHURA
   * / IMPUESTOS listos para renderear. La UI consume este shape directo,
   * no recombina otros campos.
   */
  composition?: {
    metal: {
      originalGrams:     number | null;
      appliedGrams:      number | null;
      gramsManual:       boolean;
      originalMermaPct:  number | null;
      appliedMermaPct:   number | null;
      mermaManual:       boolean;
      originalVariantId: string | null;
      appliedVariantId:  string | null;
      variantManual:     boolean;
      /** Pureza decimal (ej. 0.75 para 18k). null si no hay variante. */
      purity:            number | null;
      /** Label legible (ej. "18k"). null si no hay variante. */
      purityLabel:       string | null;
      /** Nombre del metal padre (ej. "Oro"). null si no hay variante. */
      metalName:         string | null;
    } | null;
    hechura: {
      originalAmount: number | null;
      appliedAmount:  number | null;
      manual:         boolean;
      appliesTo:      string | null;
    } | null;
    taxes: Array<{
      id:        string;
      name:      string;
      code:      string;
      rate:      number | null;
      appliesTo: string;
      taxAmount: number;
      manual:    boolean;
    }>;
  };

  /**
   * Metadata del redondeo configurado en la lista de precios aplicada.
   * `null` si la lista no tiene redondeo activo (target=NONE o mode=NONE).
   * Independiente de si el motor lo aplicó o no — sirve para que la UI
   * muestre el bloque "Redondeo por artículo / lista" incluso cuando
   * `appliedRounding` es null por supresión doc.
   */
  listRoundingMeta?: {
    target:    string;     // "FINAL_PRICE" cuando hay redondeo activo
    mode:      string;     // INTEGER | DECIMAL_1 | DECIMAL_2 | TEN | HUNDRED
    direction: string;     // NEAREST | UP | DOWN
    applyOn:   string;     // PRICE | NET | TOTAL
  } | null;

  /**
   * `true` cuando la lista tiene redondeo NET/TOTAL configurado pero la
   * política `Jewelry.documentRoundingEnabled` está activa y el motor lo
   * suprimió (anti doble redondeo). El simulador en ese caso debe mostrar
   * "Redondeo por lista omitido por redondeo de comprobante activo."
   */
  appliedRoundingSuppressedByDocPolicy?: boolean;

  /**
   * Totales del documento sintético (1 línea, qty-aware) calculados por el
   * mismo motor que `salesApi.preview`: `computeSaleDocumentTotals`. El
   * frontend debe consumirlo directo y NO recalcular.
   *
   * El simulador NO aplica redondeo a nivel comprobante (es per-artículo).
   * `roundingAdjustment` cuando aparece refleja el redondeo de lista (display
   * delta — ya absorbido en `lineTotal` por el motor).
   */
  documentTotals?: {
    subtotalBeforeDiscounts:    number;
    lineDiscountAmount:         number;
    subtotalAfterLineDiscounts: number;
    channelAdjustmentAmount:    number;
    couponDiscountAmount:       number;
    paymentAdjustmentAmount:    number;
    shippingAmount:             number;
    globalDiscountAmount:       number;
    taxableBase:                number;
    taxAmount:                  number;
    roundingAdjustment:         number;
    totalBeforeTax:             number;
    totalWithTax:               number;
    total:                      number;
    roundingInfo?: {
      source:        "PRICE_LIST" | "TENANT_POLICY";
      priceListId:   string | null;
      priceListName: string | null;
      applyOn:       string;
      mode:          string;
      direction:     string;
    } | null;
    // FASE 2 — Agregados Metal/Hechura a nivel documento
    metalCostSubtotal?:    number;
    hechuraCostSubtotal?:  number;
    metalSaleSubtotal?:    number;
    hechuraSaleSubtotal?:  number;
    breakdownEstimated?:   boolean;
  };

  // ── FASE 1.1 G3 — totales per-line top-level (qty-aware, en moneda response).
  /** Total neto (sin impuestos) de la línea = unitPrice × qty con redondeo. */
  lineTotal?:        number;
  /** Impuesto de la línea = unitTaxAmount × qty con redondeo. */
  lineTaxAmount?:    number;
  /** Total con impuestos de la línea = unitTotalWithTax × qty con redondeo. */
  lineTotalWithTax?: number;
  /** FASE 1.2 G3.1 — descuento per-line top-level (mismo patrón que G3).
   *  = (basePrice − unitPrice) × qty con redondeo. Sin clamp — puede ser
   *  negativo cuando hay override manual que sube el precio. */
  lineDiscount?:     number;

  // ── Fase MM — metadata de moneda del response ──────────────────────────
  /** Moneda en la que vienen los importes (si != base, hubo conversión). */
  responseCurrencyId?:     string;
  responseCurrencyCode?:   string;
  responseCurrencySymbol?: string;
  baseCurrencyId?:         string;
  baseCurrencyCode?:       string;
  baseCurrencySymbol?:     string;
  currencyRate?:           number;
  currencyConverted?:      boolean;
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
  /**
   * Variante específica del componente (FASE 2). Persistida en
   * `ArticleCostLine.catalogVariantId`. Cuando el artículo referenciado por
   * `catalogItemId` tiene variantes, este campo es obligatorio (validado en
   * frontend antes de guardar). Si la línea apunta a un artículo simple,
   * queda en null y el flujo descuenta stock del padre como antes.
   */
  catalogVariantId?: string | null;
  affectsStock?: boolean;
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
  openingStock?: string | null;
  minSaleQuantity: string | null;
  maxSaleQuantity: string | null;
  defaultQuantity: string | null;
  notes: string;
  weightOverride: string | null;
  hechuraPriceOverride: string | null;
  // priceOverride eliminado: las variantes no tienen precio propio.
  // El precio es siempre del artículo padre (REGLA de herencia).
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
  commercialMode?: ArticleCommercialMode;
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
  notes?: string;
  hasActivePromotion?: boolean;
  hasQuantityDiscount?: boolean;
  promotionSummary?: string | null;
  quantityDiscountSummary?: string | null;
  quantityDiscountTiers?: Array<{ minQty: string; type: string; value: string }> | null;
  taxDetails?: Array<{ id: string; name: string; rate: string | null }> | null;
  costComposition?: Array<{
    type: CostLineType;
    label: string;
    quantity: string;
    unitValue: string;
    currencyId: string | null;
    mermaPercent: string | null;
    metalVariantId: string | null;
    catalogItemId?: string | null;
    sortOrder: number;
    currency?: { id: string; code: string; symbol: string } | null;
    metalVariant?: {
      id: string; name: string; sku: string; purity: string;
      metal: { id: string; name: string };
    } | null;
    /** Producto/Servicio referenciado (solo para type=PRODUCT/SERVICE).
     *  Es una relación al modelo Article — usar `code`, `sku` o `name` como identificador visible. */
    catalogItem?: { id: string; code: string; name: string; sku: string } | null;
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
  status: "valid" | "overwrite" | "warning" | "implicit_parent" | "error";
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
  /** Filas que actualizarán registros existentes (serán sobreescritos). */
  overwrite: number;
  warnings: number;
  /** Artículos padres reconstruidos automáticamente a partir de sus variantes. */
  implicitParents: number;
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
  hasMovements?: boolean;
  stockData?: unknown;
  computedCostPrice?: ComputedCostPrice;
  computedSalePrice?: ComputedSalePrice;
  effectiveSalePrice?: string | null;
  effectivePriceSource?: EffectivePriceSource;
  costComposition?: CostLine[];
  // Combo comercial
  commercialMode?: ArticleCommercialMode;
  comboAdjustmentKind?: ComboAdjustmentKind;
  comboAdjustmentValue?: string | null;
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
  ids?: string[];
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
  metalId?: string;
  metalVariantId?: string;
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
  // Combo comercial — el backend valida y fuerza flags si commercialMode=COMBO_COMMERCIAL
  commercialMode?: ArticleCommercialMode;
  comboAdjustmentKind?: ComboAdjustmentKind;
  comboAdjustmentValue?: number | null;
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
  minSaleQuantity?: number | null;
  maxSaleQuantity?: number | null;
  defaultQuantity?: number | null;
  notes?: string;
  weightOverride?: number | null;
  hechuraPriceOverride?: number | null;
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

export const ARTICLE_STATUS_COLORS: Record<ArticleStatus, string> = {
  DRAFT:        "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  ACTIVE:       "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  DISCONTINUED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  ARCHIVED:     "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300",
};

// ---------------------------------------------------------------------------
// TPArticleScopeSelect types
// ---------------------------------------------------------------------------
export type ArticleScopeTreeVariant = {
  variantId: string;
  name:      string;
  code:      string;
  sku:       string;
  imageUrl:  string | null;
  isActive:  boolean;
};

export type ArticleScopeTreeNode = {
  articleId:    string;
  name:         string;
  code:         string;
  mainImageUrl: string | null;
  isActive:     boolean;
  articleType:  ArticleType;
  hasVariants:  boolean;
  variants:     ArticleScopeTreeVariant[];
};

export type ScopeItem = {
  kind:         "ARTICLE" | "VARIANT";
  id:           string;          // articleId or variantId
  name:         string;
  code:         string;
  imageUrl:     string | null;
  articleId:    string;
  articleName:  string;
  /** Tipo del artículo del catálogo (PRODUCT / SERVICE / MATERIAL). */
  articleType?: ArticleType;
  /** True si el artículo padre es un combo comercial. */
  isCombo?:     boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export { fmtMoney } from "../lib/format";

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

  listSkus: () =>
    apiFetch<{ skus: string[] }>("/articles/skus", { on401: "throw" }),

  tree: (params: { q?: string; articleTypes?: string[]; includeVariants?: boolean }) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.articleTypes?.length) qs.set("articleTypes", params.articleTypes.join(","));
    if (params.includeVariants === false) qs.set("includeVariants", "false");
    return apiFetch<ArticleScopeTreeNode[]>(`/articles/tree?${qs.toString()}`, { method: "GET", on401: "throw" });
  },

  list: (params?: ArticleListParams) => {
    const qs = new URLSearchParams();
    if (params?.q)                qs.set("q",                  params.q);
    if (params?.categoryId)       qs.set("categoryId",          params.categoryId);
    if (params?.articleType)      qs.set("articleType",         params.articleType);
    if (params?.status)           qs.set("status",              params.status);
    if (params?.stockMode)        qs.set("stockMode",           params.stockMode);
    if (params?.barcode)          qs.set("barcode",             params.barcode);
    if (params?.sku)              qs.set("sku",                 params.sku);
    if (params?.ids?.length)      qs.set("ids",                 params.ids.join(","));
    if (params?.showInStore != null) qs.set("showInStore",         String(params.showInStore));
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
    if (params?.hasVariants != null) qs.set("hasVariants",      String(params.hasVariants));
    if (params?.metalId)          qs.set("metalId",             params.metalId);
    if (params?.metalVariantId)   qs.set("metalVariantId",      params.metalVariantId);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<ArticleListResponse>(`/articles${query}`, { method: "GET", on401: "throw" });
  },

  getOne: (id: string) =>
    apiFetch<ArticleDetail>(`/articles/${id}`, { method: "GET", on401: "throw" }),

  create: (data: ArticlePayload) =>
    apiFetch<ArticleDetail>("/articles", { method: "POST", body: data, on401: "throw" }),

  update: (id: string, data: ArticlePayload) =>
    apiFetch<ArticleDetail>(`/articles/${id}`, { method: "PUT", body: data, on401: "throw" }),

  clone: (id: string) =>
    apiFetch<ArticleDetail>(`/articles/${id}/clone`, { method: "POST", on401: "throw" }),

  toggle: (id: string) =>
    apiFetch<ArticleRow>(`/articles/${id}/toggle`, { method: "PATCH", on401: "throw" }),

  favorite: (id: string) =>
    apiFetch<{ id: string; isFavorite: boolean }>(`/articles/${id}/favorite`, { method: "PATCH", on401: "throw" }),

  remove: (id: string) =>
    apiFetch<{ id: string }>(`/articles/${id}`, { method: "DELETE", on401: "throw" }),

  bulkRemove: (ids: string[]) =>
    apiFetch<{ deleted: number; variantsDeleted: number }>("/articles/bulk", { method: "DELETE", body: { ids }, on401: "throw" }),

  bulk: (ids: string[], data: { isActive?: boolean; isFavorite?: boolean; categoryId?: string; groupId?: string; showInStore?: boolean; isReturnable?: boolean; sellWithoutVariants?: boolean }) =>
    apiFetch<{ updated: number }>("/articles/bulk", { method: "PATCH", body: { ids, ...data }, on401: "throw" }),

  bulkHechura: (params: {
    adjustType: "PERCENTAGE" | "FIXED";
    direction: "ADD" | "SUBTRACT";
    value: number;
    scope: "ARTICLE" | "VARIANTS" | "BOTH";
    preview?: boolean;
    currencyId?: string;
    ids?: string[];
    categoryId?: string;
    brand?: string;
    manufacturer?: string;
    groupId?: string;
    metalIds?: string[];
    metalVariantIds?: string[];
    preferredSupplierId?: string;
    onlyActive?: boolean;
    onlyFavorite?: boolean;
    excludedArticleIds?: string[];
    excludedVariantIds?: string[];
    excludedCostLineIds?: string[];
  }) =>
    apiFetch<{
      preview: boolean;
      articlesUpdated: number;
      variantsUpdated: number;
      items?: Array<{
        articleId: string;
        articleName: string;
        articleSku?: string;
        kind: "article" | "cost_line" | "variant";
        variantId?: string;
        variantName?: string;
        variantSku?: string;
        costLineId?: string;
        costLineLabel?: string;
        costLineCurrencyCode?: string;
        oldValue: number | null;
        newValue: number | null;
        currencyMismatch?: boolean;
      }>;
    }>("/articles/bulk-hechura", { method: "POST", body: params, on401: "throw" }),

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

  /** Disponibilidad calculada de un combo según stock de sus componentes.
   *  Si el artículo no es combo (commercialMode != COMBO_COMMERCIAL), devuelve isCombo=false.
   *  Si se pasa warehouseId, calcula solo en ese almacén; sin almacén suma todos. */
  comboAvailability: (articleId: string, warehouseId?: string) => {
    const q = warehouseId ? `?warehouseId=${warehouseId}` : "";
    return apiFetch<{
      available: number;
      isCombo: boolean;
      bottleneckArticleId: string | null;
      components: Array<{
        articleId: string;
        code: string;
        name: string;
        qtyPerCombo: number;
        stock: number;
        canMake: number;
      }>;
    }>(`/articles/${articleId}/combo-availability${q}`, { method: "GET", on401: "throw" });
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
      channelId?: string | null;
      couponCode?: string | null;
      quantityDiscountIds?: string[];
      // Override de envío/logística (solo simulación)
      shippingMode?: "FIXED" | "BY_WEIGHT" | "FREE" | null;
      shippingValue?: number | null;
      shippingWeight?: number | null;
      // Override manual del impuesto a nivel línea (edición controlada).
      // El backend reemplaza el cálculo de impuestos por un único item
      // sintético. Si no se envía, se usan los impuestos configurados.
      // appliesTo opcional: METAL/HECHURA/PRODUCT/SERVICE/TOTAL.
      taxOverride?: {
        mode: "PERCENT" | "AMOUNT";
        value: number;
        appliesTo?: "TOTAL" | "METAL" | "HECHURA" | "METAL_Y_HECHURA" | "SUBTOTAL_AFTER_DISCOUNT" | "SUBTOTAL_BEFORE_DISCOUNT" | "PRODUCT" | "SERVICE";
      } | null;
      // Override manual del precio neto unitario (sin impuestos). Pisa
      // PRICE_LIST y salteamos qty discount + promotion.
      manualPriceOverride?: number | null;
      // Override manual del descuento (% o $) sobre el precio de lista.
      // Reemplaza qty discount + promotion. Ignorado si manualPriceOverride
      // también se envía. appliesTo opcional para acotar a un componente.
      manualDiscountOverride?: {
        mode: "PERCENT" | "AMOUNT";
        value: number;
        appliesTo?: "TOTAL" | "METAL" | "HECHURA" | "METAL_Y_HECHURA" | "SUBTOTAL_AFTER_DISCOUNT" | "SUBTOTAL_BEFORE_DISCOUNT" | "PRODUCT" | "SERVICE";
      } | null;
      // Overrides de COMPOSICIÓN DE COSTO a nivel línea (Fase 2).
      // NO modifican el artículo en DB — el motor opera sobre una copia.
      gramsOverride?:          number | null;
      mermaPercentOverride?:   number | null;
      metalVariantIdOverride?: string | null;
      hechuraOverrideAmount?:  number | null;
      // Fase MM — moneda en la que se quiere ver el response.
      currencyId?:             string | null;
    }
  ) => {
    const qs = new URLSearchParams();
    if (opts?.clientId)        qs.set("clientId",        opts.clientId);
    if (opts?.variantId)       qs.set("variantId",       opts.variantId);
    if (opts?.quantity != null) qs.set("quantity",        String(opts.quantity));
    if (opts?.paymentMethodId) qs.set("paymentMethodId", opts.paymentMethodId);
    if (opts?.installmentsQty) qs.set("installmentsQty", String(opts.installmentsQty));
    if (opts?.priceListId)     qs.set("priceListId",     opts.priceListId);
    if (opts?.channelId)       qs.set("channelId",       opts.channelId);
    if (opts?.couponCode)      qs.set("couponCode",      opts.couponCode);
    if (opts?.quantityDiscountIds?.length) qs.set("quantityDiscountIds", opts.quantityDiscountIds.join(","));
    if (opts?.shippingMode)    qs.set("shippingMode",    opts.shippingMode);
    if (opts?.shippingValue  != null) qs.set("shippingValue",  String(opts.shippingValue));
    if (opts?.shippingWeight != null) qs.set("shippingWeight", String(opts.shippingWeight));
    if (opts?.taxOverride && Number.isFinite(opts.taxOverride.value)) {
      qs.set("taxOverrideMode",  opts.taxOverride.mode);
      qs.set("taxOverrideValue", String(opts.taxOverride.value));
      if (opts.taxOverride.appliesTo) qs.set("taxOverrideAppliesTo", opts.taxOverride.appliesTo);
    }
    if (opts?.manualPriceOverride != null && Number.isFinite(opts.manualPriceOverride)) {
      qs.set("manualPriceOverride", String(opts.manualPriceOverride));
    }
    if (opts?.manualDiscountOverride && Number.isFinite(opts.manualDiscountOverride.value)) {
      qs.set("manualDiscountMode",  opts.manualDiscountOverride.mode);
      qs.set("manualDiscountValue", String(opts.manualDiscountOverride.value));
      if (opts.manualDiscountOverride.appliesTo) qs.set("manualDiscountAppliesTo", opts.manualDiscountOverride.appliesTo);
    }
    if (opts?.gramsOverride != null && Number.isFinite(opts.gramsOverride)) {
      qs.set("gramsOverride", String(opts.gramsOverride));
    }
    if (opts?.mermaPercentOverride != null && Number.isFinite(opts.mermaPercentOverride)) {
      qs.set("mermaPercentOverride", String(opts.mermaPercentOverride));
    }
    if (opts?.metalVariantIdOverride) {
      qs.set("metalVariantIdOverride", opts.metalVariantIdOverride);
    }
    if (opts?.hechuraOverrideAmount != null && Number.isFinite(opts.hechuraOverrideAmount)) {
      qs.set("hechuraOverrideAmount", String(opts.hechuraOverrideAmount));
    }
    // Fase MM — currencyId opcional. El backend convierte el response si != base.
    if (opts?.currencyId) qs.set("currencyId", opts.currencyId);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<PricingPreviewResult>(
      `/articles/${articleId}/pricing-preview${query}`,
      { method: "GET", on401: "throw" }
    );
  },

  /**
   * Preview de costo + impuestos de compra para un set de líneas (sin persistir).
   * Delega en el pricing-engine del backend. Usar cuando el frontend necesita
   * recalcular composiciones de costo en edición: NO calcular local.
   */
  previewCostLines: (
    articleId: string,
    body: {
      lines: Array<{
        id?: string;
        type: string;
        label?: string;
        quantity: number;
        unitValue: number;
        currencyId?: string | null;
        mermaPercent?: number | null;
        metalVariantId?: string | null;
        catalogItemId?: string | null;
        affectsStock?: boolean;
        sortOrder?: number;
        lineAdjKind?: string | null;
        lineAdjType?: string | null;
        lineAdjValue?: number | null;
      }>;
      manualAdjustment?: {
        kind?: string | null;
        type?: string | null;
        value?: number | null;
      };
    },
  ) =>
    apiFetch<{
      cost: {
        value: string | null;
        metalCost: string | null;
        hechuraCost: string | null;
        totalGrams: string | null;
        partial: boolean;
        mode: string;
      };
      purchaseTaxes: {
        costBase: string | null;
        costTaxAmount: string | null;
        costWithTax: string | null;
        costTaxBreakdown: PurchaseTaxBreakdownItem[];
      };
    }>(`/articles/${articleId}/cost-lines/preview`, {
      method: "POST",
      body,
      on401: "throw",
    }),

  import: {
    downloadTemplate: async () => {
      const base = import.meta.env.VITE_API_URL ?? "/api";
      const res = await fetch(`${base}/articles/import/template`, { credentials: "include" });
      if (!res.ok) throw new Error("Error al descargar la plantilla.");
      const blob = await res.blob();
      saveAs(blob, "tptech_articulos_template.xlsx");
    },
    downloadGuidedTemplate: async () => {
      const base = import.meta.env.VITE_API_URL ?? "/api";
      const res = await fetch(`${base}/articles/import/template/guided`, { credentials: "include" });
      if (!res.ok) throw new Error("Error al descargar la plantilla guiada.");
      const blob = await res.blob();
      saveAs(blob, "tptech_articulos_plantilla_guiada.xlsx");
    },
    downloadGuidedExport: async () => {
      const base = import.meta.env.VITE_API_URL ?? "/api";
      const res = await fetch(`${base}/articles/export/guided`, { credentials: "include" });
      if (!res.ok) throw new Error("Error al exportar los artículos.");
      const blob = await res.blob();
      const date = new Date().toISOString().slice(0, 10);
      saveAs(blob, `tptech_articulos_${date}.xlsx`);
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
    /** Previsualiza importación enviando filas JSON ya mapeadas (para el flujo con mapeo de columnas) */
    previewJson: (rows: Record<string, string>[]) =>
      apiFetch<ImportPreviewResult>("/articles/import/preview-json", {
        method: "POST",
        body: { rows },
        on401: "throw",
      }),
    /** Ejecuta importación enviando filas JSON ya mapeadas (para el flujo con mapeo de columnas) */
    executeJson: (
      rows: Record<string, string>[],
      onConflict: "skip" | "update",
      fileName?: string,
    ) =>
      apiFetch<ImportCommitResult>("/articles/import/execute-json", {
        method: "POST",
        body: { rows, onConflict, fileName },
        on401: "throw",
      }),
  },

  exportXlsx: async () => {
    const base = import.meta.env.VITE_API_URL ?? "/api";
    const res = await fetch(`${base}/articles/export`, { credentials: "include" });
    if (!res.ok) throw new Error("Error al exportar artículos.");
    const blob = await res.blob();
    const date = new Date().toISOString().slice(0, 10);
    saveAs(blob, `tptech_articulos_export_${date}.xlsx`);
  },

  exportXlsxV2: async () => {
    const base = import.meta.env.VITE_API_URL ?? "/api";
    const res = await fetch(`${base}/articles/export/v2`, { credentials: "include" });
    if (!res.ok) throw new Error("Error al exportar artículos (v2).");
    const blob = await res.blob();
    const date = new Date().toISOString().slice(0, 10);
    saveAs(blob, `tptech_articulos_export_v2_${date}.xlsx`);
  },

  downloadTemplateV2: async () => {
    const base = import.meta.env.VITE_API_URL ?? "/api";
    const res = await fetch(`${base}/articles/import/template/v2`, { credentials: "include" });
    if (!res.ok) throw new Error("Error al descargar la plantilla v2.");
    const blob = await res.blob();
    saveAs(blob, "tptech_articulos_template_v2.xlsx");
  },
};
