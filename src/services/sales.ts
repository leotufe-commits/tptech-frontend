import { apiFetch, API_URL, ApiError } from "../lib/api";

// ─── Enums ───────────────────────────────────────────────────────────────────
export type SaleStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "PAID"
  | "PARTIALLY_PAID"
  | "CANCELLED";

// ─── Sub-types ────────────────────────────────────────────────────────────────

/** Fuente del precio BASE (antes de descuentos). */
export type BasePriceSource =
  | "VARIANT_OVERRIDE"
  | "PRICE_LIST"
  | "MANUAL_OVERRIDE"
  | "MANUAL_FALLBACK"
  | "NONE";

/** Fuente efectiva final (última capa que modificó el precio). */
export type SalePriceSource =
  | "VARIANT_OVERRIDE"
  | "PRICE_LIST"
  | "MANUAL_OVERRIDE"
  | "MANUAL_FALLBACK"
  | "QUANTITY_DISCOUNT"
  | "PROMOTION"
  | "NONE";

export type SalePriceResult = {
  /** Precio final después de todos los descuentos. */
  unitPrice: string | null;
  /** Precio base antes de descuentos por cantidad y promoción. */
  basePrice: string | null;
  /** Descuento aplicado por cantidad (null si no aplica). */
  quantityDiscountAmount: string | null;
  /** Descuento aplicado por promoción (null si no aplica). */
  promotionDiscountAmount: string | null;
  /** Total descontado (qty + promo). */
  discountAmount: string | null;
  /** Fuente efectiva final (última capa que modificó el precio). */
  priceSource: SalePriceSource;
  /** Fuente del precio base (antes de descuentos). */
  baseSource: BasePriceSource;
  appliedPriceListId: string | null;
  appliedPriceListName: string | null;
  appliedPromotionId: string | null;
  appliedPromotionName: string | null;
  appliedDiscountId: string | null;
  /** true si el precio base es parcial (lista sin datos suficientes). */
  partial: boolean;
  /** Costo unitario real calculado con el motor oficial. Null si no disponible. */
  unitCost: string | null;
  /** Margen unitario = unitPrice − unitCost. Null si sin costo. */
  unitMargin: string | null;
  /** Margen % sobre precio de venta. Null si sin costo. */
  marginPercent: string | null;
  /** Markup % sobre costo. Provisto por el motor (POLICY R6). Null si sin costo. */
  markupPercent: string | null;
  /** true cuando el costo no pudo resolverse completamente. */
  costPartial: boolean;
  /** MANUAL | MULTIPLIER | METAL_MERMA_HECHURA | COST_LINES | NONE */
  costMode: string;
};

export type SaleLineRow = {
  id: string;
  articleId: string;
  variantId: string | null;
  articleName: string;
  variantName: string;
  sku: string;
  barcode: string;
  quantity: string;
  unitPrice: string;
  discountPct: string;
  lineTotal: string;
  priceSource: string;
  appliedPriceListId: string | null;
  appliedPromotionId: string | null;
  appliedDiscountId: string | null;
  unitCost: string | null;
  totalCost: string | null;
  unitMargin: string | null;
  totalMargin: string | null;
  marginPercent: string | null;
  sortOrder: number;
  article: { id: string; code: string; name: string; mainImageUrl: string } | null;
  variant: { id: string; code: string; name: string } | null;
  // ── Etapa 4 — overrides comerciales persistidos en SaleLine ──────────────
  manualPriceOverride?:             string | null;
  manualDiscountOverride?:          SaleLineManualDiscountOverride | null;
  taxOverride?:                     SaleLineTaxOverride            | null;
  manualDiscountAppliesToOverride?: SaleLineAppliesTo              | null;
  manualTaxAppliesToOverride?:      SaleLineAppliesTo              | null;
  priceListIdOverride?:             string | null;
};

export type SalePaymentRow = {
  id: string;
  paymentMethodId: string | null;
  paymentMethodName: string;
  amount: string;
  installments: number;
  reference: string;
  paidAt: string;
  createdAt: string;
  paymentMethod: { id: string; name: string; type: string } | null;
};

export type SaleRow = {
  id: string;
  code: string;
  status: SaleStatus;
  saleDate: string;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  total: string;
  paidAmount: string;
  notes: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  sellerCommissionTotal: string | null;
  client: { id: string; displayName: string; code: string } | null;
  seller: { id: string; firstName: string; lastName: string; displayName: string } | null;
  warehouse: { id: string; name: string; code: string } | null;
  createdBy: { id: string; name: string | null; firstName: string; lastName: string } | null;
  _count: { lines: number };
};

export type SaleTotals = {
  revenue: string;
  cost: string;
  margin: string;
  marginPercent: string;
  linesWithoutCost: number;
};

export type SellerSnapshot = {
  id: string;
  displayName: string;
  commissionType: string;
  commissionValue: number | null;
  commissionBase: string;
  commissionTotal: number | null;
};

/** 1.A — Receipt emitido por la venta al confirmarse. `code` es la
 *  numeracion oficial del comprobante (ej. "A-0001-00000001") y la usa
 *  el modal de Factura como "Factura N°" y el endpoint PDF como nombre
 *  del archivo. Una venta puede tener 0 receipts (DRAFT) o 1+ tras
 *  confirmar. */
export type SaleReceiptRow = {
  id:        string;
  code:      string;
  type:      string;     // "INVOICE" | "CREDIT_NOTE" | ...
  direction: string;     // "OUTBOUND" | "INBOUND"
  status:    string;     // "ISSUED" | "VOIDED" | ...
  issueDate: string;
  issuedAt:  string;
};

export type SaleDetail = SaleRow & {
  clientSnapshot: Record<string, unknown> | null;
  sellerSnapshot: SellerSnapshot | null;
  cancelNote: string;
  lines: SaleLineRow[];
  payments: SalePaymentRow[];
  saleTotals: SaleTotals | null;
  /** Comprobantes emitidos por la venta (vacio si esta en DRAFT). */
  receipts?: SaleReceiptRow[];
  // ── Etapa 1.1 — ajustes a nivel documento persistidos en el DRAFT ──────
  // Backend los persiste para garantizar paridad preview ↔ confirm. El
  // frontend los lee para rehidratar el modal al reabrir un borrador.
  shippingAmount?:      string | null;
  globalDiscountType?:  "PERCENT" | "AMOUNT" | null;
  globalDiscountValue?: string | null;
  paymentMethodId?:     string | null;
  paymentInstallments?: number | null;
  // ── Etapa C16.3 — campos requeridos para paridad de rehidratación ─────
  // El backend ya los persiste en `Sale.channelId` / `Sale.couponId`; el
  // detail los expone para que el frontend reconstruya el contexto del
  // preview al reabrir. Sin esto, el reabrir pierde canal/cupón y los
  // totales divergen del pre-save.
  channelId?: string | null;
  couponId?:  string | null;
  coupon?:    { id: string; code: string } | null;
  // ── Etapa 4.2 — Balance Mode persistido ───────────────────────────────
  balanceModeOverride?: "UNIFIED" | "BREAKDOWN" | null;
  balanceMode?:         "UNIFIED" | "BREAKDOWN" | null;
  balanceModeSource?:   string | null;
  // ── Manual Adjustment (Etapas A + C) ───────────────────────────────────
  // El backend persiste estos campos en `Sale` para que el frontend pueda
  // rehidratar el modal al reabrir un borrador (manualAdjustmentInput) o
  // mostrar el snapshot inmutable post-confirm (manualAdjustmentSnapshot).
  // `engineTotal` queda en `null` mientras la venta está en DRAFT.
  manualAdjustmentInput?:    ManualAdjustmentApiInput   | null;
  manualAdjustmentSnapshot?: ManualAdjustmentApiSnapshot | null;
  engineTotal?:              string | null;
};

// ─── Sale Preview ─────────────────────────────────────────────────────────────

export type SalePreviewLineInput = {
  /** Tipo de línea. Default ARTICLE. MANUAL = texto libre sin pricing-engine. */
  type?: "ARTICLE" | "MANUAL";
  /** Descripción libre (obligatoria si `type === "MANUAL"`). */
  description?: string;
  /** Id del artículo del catálogo. Obligatorio para `type === "ARTICLE"`. */
  articleId?: string;
  variantId?: string | null;
  quantity:  number;
  /** Override manual del precio neto unitario (Fase 6.5). */
  manualPriceOverride?:    number | null;
  /** Override manual de la bonificación por línea. */
  manualDiscountOverride?: {
    mode:      "PERCENT" | "AMOUNT";
    value:     number;
    appliesTo?: "TOTAL" | "METAL" | "HECHURA" | "METAL_Y_HECHURA" | "SUBTOTAL_AFTER_DISCOUNT" | "SUBTOTAL_BEFORE_DISCOUNT" | "PRODUCT" | "SERVICE";
  } | null;
  /** Override manual del impuesto por línea. */
  taxOverride?: {
    mode:      "PERCENT" | "AMOUNT";
    value:     number;
    appliesTo?: "TOTAL" | "METAL" | "HECHURA" | "METAL_Y_HECHURA" | "SUBTOTAL_AFTER_DISCOUNT" | "SUBTOTAL_BEFORE_DISCOUNT" | "PRODUCT" | "SERVICE";
  } | null;
  /** Fase 2A.7 — override de lista de precios por línea. Tiene precedencia
   *  sobre el `priceListId` doc-level. */
  priceListIdOverride?: string | null;
  // Fase 3B — overrides de COMPOSICIÓN DE COSTO por línea. El motor ya los
  // respetaba; ahora viajan en `/sales/preview` para edición desde Factura.
  /** Pisa los gramos de la línea METAL del artículo. */
  gramsOverride?:          number | null;
  /** Pisa el % de merma aplicado sobre el metal. */
  mermaPercentOverride?:   number | null;
  /** Pisa el `metalVariantId` (cambia la cotización del metal usado). */
  metalVariantIdOverride?: string | null;
  /** Pisa el monto unitario de la línea HECHURA. */
  hechuraOverrideAmount?:  number | null;
  /**
   * F1.4 G5 #11-A — overrides per costLineId.
   *
   * Pisa los overrides legacy (gramsOverride / mermaPercentOverride /
   * hechuraOverrideAmount) cuando hay match por `costLineId`. Permite
   * editar quantity / unitValue / mermaPercent / adjustment de cost
   * lines individuales sin tocar la ficha del artículo.
   *
   * El backend valida y devuelve `costLineOverridesApplied` (sanitizados)
   * + `debugWarnings` por línea.
   */
  costLineOverrides?: CostLineOverride[];
};

export type SalePreviewInput = {
  lines:            SalePreviewLineInput[];
  clientId?:        string | null;
  paymentMethodId?: string | null;
  installmentsQty?: number;
  channelId?:       string | null;
  couponCode?:      string | null;
  /** Costo de envío del documento (Fase 4). Sigue siendo aceptado por
   *  el backend como fallback legacy. */
  shippingAmount?:       number | null;
  /** F1.2 paso 4 — input crudo del envío (mode/value/weight). El backend
   *  resuelve el monto via `resolveShippingAmount` (POLICY.md §5 capa 10).
   *  Si se manda este campo, prevalece sobre `shippingAmount`. */
  shipping?: {
    mode:    "FIXED" | "BY_WEIGHT" | "FREE";
    value?:  number | null;
    weight?: number | null;
  } | null;
  /** Descuento global del documento ya resuelto a monto (Fase 4). */
  globalDiscountAmount?: number | null;
  /** Descuento global sin resolver (Fase 5) — el backend computa el monto
   *  contra el subtotal post-descuentos de línea. Evita feedback loop. */
  globalDiscount?: { type: "PERCENT" | "AMOUNT"; value: number } | null;
  /** Fase 2A.7 — override de lista de precios a nivel documento. */
  priceListId?: string | null;
  /** Fase MM — moneda en la que se quiere ver el response del preview. */
  currencyId?: string | null;
  /** Fase MM ext — cotización manual del documento (`draft.fxRate`). Cuando
   *  viene válida, el backend la usa para convertir el response en lugar
   *  de la tasa vigente del catálogo. SOLO afecta el preview; el confirm
   *  persiste en moneda base con la tasa del momento. */
  currencyRate?: number | null;
  /** Fase 4.2 — Override manual del Balance Mode del documento
   *  (POLICY.md §11 R11.4). Si viene null/ausente, el backend resuelve
   *  por jerarquía. Si viene "UNIFIED"/"BREAKDOWN" → balanceModeSource
   *  = "DOCUMENT_OVERRIDE" en el response. */
  balanceModeOverride?: "UNIFIED" | "BREAKDOWN" | null;
  /** Ajuste manual del comprobante (POLICY §R-Rounding-1 capa 17).
   *  Etapa A: scope "UNIFIED" — un único monto humano.
   *  Etapa C: scope "BREAKDOWN" — ajuste por metal (gramos) + hechura. */
  manualAdjustment?: ManualAdjustmentApiInput | null;
};

export interface ManualAdjustmentApiInputUnified {
  scope:  "UNIFIED";
  amount: number;
  reason?: string | null;
}

export interface ManualAdjustmentApiInputBreakdownMetal {
  metalParentId:   string | null;
  metalParentName?: string;
  targetGrams?: number | null;
  deltaGrams?:  number | null;
  reason?:      string | null;
}

export interface ManualAdjustmentApiInputBreakdown {
  scope:  "BREAKDOWN";
  metals?:         ManualAdjustmentApiInputBreakdownMetal[];
  monetaryAmount?: number | null;
  reason?:         string | null;
}

export type ManualAdjustmentApiInput =
  | ManualAdjustmentApiInputUnified
  | ManualAdjustmentApiInputBreakdown;

/** Etapa C-comercial / C4-fix (POLICY §R-Rounding-14) — entry por metal padre
 *  del snapshot comercial PHYSICAL. Shape idéntico al del backend
 *  (`SalePreviewLineCommercialPhysicalEntry`). El frontend lo trata como
 *  passthrough — cero matemática. */
export type SalePreviewLineCommercialPhysicalEntry = {
  metalParentId:      string | null;
  metalParentName:    string;
  preGrams:           number;
  postGrams:          number;
  deltaGrams:         number;
  metalPricePerGram:  number;
  monetaryEquivalent: number;
  mode:               string;
  direction:          string;
  source:             "COMMERCIAL_PHYSICAL_ROUNDING";
  fallback:
    | null
    | "NO_METAL_PRICE"
    | "NO_CONFIG"
    | "INVALID_GRAMS";
};

export type SalePreviewLineCommercialPhysicalSnapshot = {
  metals:                  SalePreviewLineCommercialPhysicalEntry[];
  metalMonetaryEquivalent: number;
  fallback:
    | null
    | "NO_BREAKDOWN_DATA"
    | "NO_METALS_TO_ROUND";
};

export type SalePreviewLineMetalHechura = {
  metalCost:         number;
  metalSale:         number;
  metalMarginPct:    number;
  hechuraCost:       number;
  hechuraSale:       number;
  hechuraMarginPct:  number;
  metalGramsBase:    number | null;
  metalGramsSale:    number | null;
  metalPricePerGram: number | null;
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
  // ── Etapa C-comercial / C4-fix (POLICY §R-Rounding-14) ──────────────────
  // Auditoría del redondeo comercial. Quedan `null` cuando el redondeo no
  // actuó (passthrough). El frontend los renderea desde C6 — esta etapa
  // solo los transporta.
  metalSalePreRounding?:    number | null;
  hechuraSalePreRounding?:  number | null;
  metalSaleRoundingDelta?:  number | null;
  hechuraSaleRoundingDelta?:number | null;
  /** Snapshot completo del redondeo COMERCIAL PHYSICAL — paralelo al
   *  `documentRoundingApplied.breakdown.metalPhysical` del financiero.
   *  Solo presente cuando la lista operó en
   *  `commercialRoundingMetalDomain="PHYSICAL"` y había `metalsByParent`
   *  válidos. `null` en MONETARY (legacy). */
  physical?:                SalePreviewLineCommercialPhysicalSnapshot | null;
};

export type SalePreviewPricingSnapshot = {
  unitPrice:            number | null;
  basePrice:            number | null;
  discountAmount:       number;
  taxAmount:            number;
  totalWithTax:         number | null;
  priceSource:          string;
  baseSource:           string;
  unitCost:             number | null;
  unitMargin:           number | null;
  marginPercent:        number | null;
  /** Markup % sobre costo. Provisto por el motor (POLICY R6). Null si sin costo. */
  markupPercent:        number | null;
  costPartial:          boolean;
  costMode:             string;
  partial:              boolean;
  appliedPriceListId:   string | null;
  appliedPriceListName: string | null;
  appliedPromotionId:   string | null;
  appliedPromotionName: string | null;
  appliedDiscountId:    string | null;
  resolvedAt:           string;
};

/** Subset serializable de `PricingStep` del motor. Paridad backend
 *  (`sales.service.ts > SalePreviewStep`). Permite renderizar el pipeline de
 *  cálculo por línea en el ORDEN REAL del motor (POLICY R4.5). */
export type SalePreviewStep = {
  key:     string;
  label:   string;
  status:  "ok" | "partial" | "missing" | "skipped";
  /** Valor resultante per-unidad post-step. */
  value:   number | null;
  message?: string;
  meta?: {
    discountBase?:           number | null;
    discountAmount?:         number | null;
    discountBaseEstimated?:  boolean;
    surchargeBase?:          number | null;
    surchargeAmount?:        number | null;
    surchargeBaseEstimated?: boolean;
    value?:     number | null;
    type?:      "PERCENTAGE" | "FIXED_AMOUNT" | null;
    valueType?: "PERCENTAGE" | "FIXED_AMOUNT" | null;
    applyOn?:   string | null;
    ruleType?:  "DISCOUNT" | "BONUS" | "SURCHARGE" | null;
    kind?:      "BONUS" | "SURCHARGE" | null;
    mode?:      "PERCENT" | "FIXED" | null;
    promoId?:    string | null;
    discountId?: string | null;
    promoName?:  string | null;
  };
};

export type SalePreviewLine = {
  articleId:            string;
  variantId:            string | null;
  quantity:             number;
  unitPrice:            number | null;
  /** Precio de lista pre-descuento (Fase 4). null si no se pudo resolver. */
  basePrice:            number | null;
  /** Alias de `lineTotal` — preservado por compatibilidad. */
  lineSubtotal:         number | null;
  /** Total de línea ya redondeado: qty × unitPrice (Fase 4). */
  lineTotal:            number | null;
  /** (basePrice − unitPrice) × qty (Fase 4). Total de descuento de línea. */
  lineDiscount:         number;
  /** Impuesto unitario (Fase 4). */
  unitTaxAmount:        number;
  /** Total unitario con impuestos: emitido por backend v3 (Sprint 4). */
  unitTotalWithTax:     number | null;
  /** Impuesto total de la línea: qty × unitTaxAmount (Fase 4). */
  lineTaxAmount:        number;
  /** lineTotal + lineTaxAmount (Fase 4). */
  lineTotalWithTax:     number | null;
  /** FASE 1.1 G7 — flags explícitos de overrides aplicados a la línea.
   *  Permite distinguir override de precio / descuento / impuesto sin
   *  inferir desde priceSource (POLICY.md §3 R3.4). */
  manualOverridesApplied?: {
    quantity: boolean;
    price:    boolean;
    discount: boolean;
    tax:      boolean;
  };
  /** Descuento por cantidad por unidad (Fase 5). */
  quantityDiscountAmount:  number | null;
  /** Descuento de promoción por unidad (Fase 5). */
  promotionDiscountAmount: number | null;
  /**
   * Descuento POR LÍNEA aplicado por la regla comercial del cliente (capa 5
   * del motor). El backend lo expone INDEPENDIENTEMENTE de `applyOn` — incluido
   * cuando la rule aplica sobre TOTAL y queda absorbida en `unitPrice` (en ese
   * caso `componentSaleBreakdown.adjustments[]` NO emite el adjustment).
   *
   * Es el único campo confiable para mostrar el impacto monetario del
   * descuento del cliente por línea sin derivar — paridad con
   * `SalePriceResult.customerDiscountAmount` del backend
   * (`pricing-engine.types.ts` línea 304 / `sales.service.ts` línea 3016).
   *
   * `null` cuando no hay rule activa o el motor no aplicó descuento de
   * cliente a esta línea. */
  customerDiscountAmount:  number | null;

  /**
   * Metadata explicativa per-origen para que la UI pueda mostrar
   * "Cálculo: base × valor" sin recalcular nada. Vienen del motor en
   * `steps[].meta.{discountBase, value, type}` y los serializa el mapper
   * de venta (`sales.service.ts`). Son **display-only** — no afectan el
   * resultado del motor. POLICY R4.5 / R6.
   */
  quantityDiscountBase:       number | null;
  quantityDiscountValue:      number | null;
  quantityDiscountValueType:  "PERCENTAGE" | "FIXED_AMOUNT" | null;
  promotionDiscountBase:      number | null;
  promotionDiscountValue:     number | null;
  promotionDiscountValueType: "PERCENTAGE" | "FIXED_AMOUNT" | null;
  customerDiscountBase:       number | null;

  /** Subset whitelist de `pricing.steps[]` que serializa el mapper. Permite
   *  renderizar el pipeline de cálculo en el orden REAL del motor (POLICY R4.5
   *  — passthrough estricto). Valores per-unidad; el frontend multiplica por
   *  qty para totales por línea. `undefined` cuando es un preview legacy. */
  pricingSteps?: SalePreviewStep[];

  priceSource:          string;
  appliedPriceListId:   string | null;
  appliedPriceListName: string | null;
  /** Modo de la lista aplicada (METAL_HECHURA / MARGIN_TOTAL / ...). */
  appliedPriceListMode?: string | null;
  appliedPromotionId:   string | null;
  appliedPromotionName: string | null;
  appliedDiscountId:    string | null;
  unitCost:             number | null;
  /** Margen unitario (Fase 5). */
  unitMargin:           number | null;
  /** Margen % sobre precio final (Fase 5). */
  marginPercent:        number | null;
  /** Markup % sobre costo. Provisto por el motor (POLICY R6). Null si sin costo. */
  markupPercent:        number | null;
  costPartial:          boolean;
  costMode:             string;
  policy: { canConfirm: boolean; blockingAlerts: string[] };
  /** Alertas comerciales emitidas por el motor para esta línea
   *  (LOW_MARGIN, LOSS_SALE, ZERO_OR_NEGATIVE_PRICE, COST_UNRESOLVED,
   *  PARTIAL_DATA). El backend siempre las emite; el frontend las
   *  consume vía `deriveCommercialLevel`/`deriveCommercialInfo`. Opcional
   *  porque snapshots viejos (< v6) pueden no traerlo. */
  alerts?: Array<{ code: string; level: "info" | "warning" | "error"; message: string }>;
  /** Desglose por impuesto individual aplicado a la línea. */
  taxBreakdown:         any[];
  /** Desglose Metal/Hechura cuando aplica (Fase 5). */
  metalHechuraBreakdown: SalePreviewLineMetalHechura | null;
  /** Snapshot completo equivalente al que persiste createSale (Fase 5). */
  pricingSnapshot:      SalePreviewPricingSnapshot;
  /** Redondeo aplicado por la lista de precios a esta línea. Null si no aplicó. */
  appliedRounding?: {
    source:        "PRICE_LIST";
    priceListId:   string | null;
    priceListName: string | null;
    applyOn:       "PRICE" | "NET" | "TOTAL";
    mode:          string;
    direction:     string;
    preRounding:   number;
    postRounding:  number;
    unitAdjustment: number;
  } | null;

  // ── Fase 2A.7 — paridad con articles/pricing-preview ─────────────────────
  /** Bloque metal/hechura/taxes — mismo shape que el endpoint del Simulador. */
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
      purity:            number | null;
      purityLabel:       string | null;
      metalName:         string | null;
    } | null;
    hechura: {
      originalAmount: number | null;
      appliedAmount:  number | null;
      manual:         boolean;
      appliesTo:      string | null;
    } | null;
    /** F1.3 G4.x #9-B — TODAS las cost lines de tipo METAL del artículo.
     *  Backend v5+ emite uno por step COST_LINES_METAL. Snapshots v4 sin
     *  este campo se normalizan a `[metal]` (legacy fallback) o `[]`. */
    metals?: Array<{
      costLineId:        string | null;
      metalVariantId:    string | null;
      metalName:         string | null;
      purity:            number | null;
      purityLabel:       string | null;
      appliedGrams:      number | null;
      appliedMermaPct:   number | null;
      lineCost:          number | null;
      // Fase 2.3 — precio por gramo BASE (pre-merma). Frontend lo usa
      // como columna "Val. unit." en METAL. lineCost === appliedGrams ×
      // quotePrice × (1 + appliedMermaPct/100).
      quotePrice?:       number | null;
      // Fase 2.4 — nombre comercial completo de la variante (= MetalVariant.name).
      // Frontend lo prefiere como primary del row METAL; fallback a
      // `metalName + purityLabel` cuando falta (snapshot viejo).
      variantName?:      string | null;
    }>;
    /** F1.3 G4.x #9-B — TODAS las cost lines de tipo HECHURA. Mismo patrón. */
    hechuras?: Array<{
      costLineId:        string | null;
      /** Valor unitario aplicado POST-ajuste (= step.value del motor).
       *  ⚠ NO usar como base — está adjusted. Para base usar `unitValue`. */
      appliedAmount:     number | null;
      lineCost:          number | null;
      lineLabel:         string | null;
      // Fase 2.2 — paridad con products/services. Cuando la HECHURA del
      // artículo trae `lineAdjKind` configurado, el motor lo aplica al
      // costo Y emite el monto absoluto en `lineAdjAmount`. Frontend lo
      // muestra como ajuste original en la columna AJUSTE.
      lineAdjKind?:      "BONUS" | "SURCHARGE" | null;
      lineAdjType?:      "PERCENTAGE" | "FIXED_AMOUNT" | null;
      lineAdjValue?:     number | null;
      lineAdjAmount?:    number | null;
      // Fase 2.3.1 — valor unitario BASE pre-ajuste (= meta.unitValue del
      // motor). Frontend lo usa como columna "Val. unit." en HECHURA — antes
      // la columna mostraba `appliedAmount` (post-ajuste) por falta de este
      // campo, así que con HECHURA con bonificación se veía el descuento ya
      // aplicado en VAL. UNIT.
      unitValue?:        number | null;
      /** `unitValue × rate` en moneda base, pre-ajuste. Display-only — usado
       *  por la sub-línea de equivalente para evitar percepción de doble
       *  descuento. */
      unitValueBase?:    number;
      /** Cantidad del cost line por unidad de artículo (= meta.qty del motor).
       *  Paridad con PRODUCT/SERVICE. Opcional para snapshots viejos: el
       *  frontend cae a `1` cuando este campo no está. */
      quantity?:         number;
      /** Unidad seleccionada por el operador en el modal del artículo
       *  (`u`, `g`, `hr`, etc.). Display-only. Cuando falta o es vacío, el
       *  frontend cae al fallback "Unidades". */
      quantityUnit?:     string;
      /** Moneda original del cost line — sólo se emite cuando el motor
       *  registró conversión efectiva (cost line en moneda != base). */
      currencyId?:       string | null;
      currencyCode?:     string | null;
      currencySymbol?:   string | null;
    }>;
    /** F1.3 G4.1 — items PRODUCT del costo (insumos / piedras / etc.).
     *  El backend (commit G4.1.3 / G4.1.4) los emite per línea desde steps
     *  COST_LINES_PRODUCT. Vacío en snapshots viejos (v3) o cuando el
     *  artículo no tiene PRODUCT lines. */
    products?: Array<{
      costLineId:       string | null;
      catalogItemId:    string | null;
      catalogItemCode:  string | null;
      // Fase 2.4 — SKU del Article catálogo (= Article.sku). Frontend lo
      // prefiere sobre catalogItemCode en el secondary del row.
      catalogItemSku?:  string | null;
      catalogItemName:  string | null;
      quantity:         number;
      /** Unidad seleccionada por el operador en el modal del artículo. */
      quantityUnit?:    string;
      unitValue:        number;
      /** `unitValue × rate` en moneda base, pre-ajuste. Display-only. */
      unitValueBase?:   number;
      totalValue:       number;
      currencyId:       string | null;
      /** Moneda original del cost line — sólo cuando hubo conversión efectiva. */
      currencyCode?:    string | null;
      currencySymbol?:  string | null;
      /** Unidad de medida del Article referenciado (`Article.unitOfMeasure`). */
      quantityUnitName?: string | null;
      lineAdjKind:      "BONUS" | "SURCHARGE" | null;
      lineAdjType:      "PERCENTAGE" | "FIXED_AMOUNT" | null;
      lineAdjValue:     number | null;
      lineAdjAmount:    number | null;
      affectsStock:     boolean | null;
    }>;
    /** F1.3 G4.1 — items SERVICE del costo (engaste, mano de obra externa,
     *  etc.). Mismo shape y reglas que `products`. */
    services?: Array<{
      costLineId:       string | null;
      catalogItemId:    string | null;
      catalogItemCode:  string | null;
      // Fase 2.4 — SKU (idem products).
      catalogItemSku?:  string | null;
      catalogItemName:  string | null;
      quantity:         number;
      /** Unidad seleccionada por el operador en el modal del artículo. */
      quantityUnit?:    string;
      unitValue:        number;
      /** `unitValue × rate` en moneda base, pre-ajuste. Display-only. */
      unitValueBase?:   number;
      totalValue:       number;
      currencyId:       string | null;
      /** Moneda original del cost line — sólo cuando hubo conversión efectiva. */
      currencyCode?:    string | null;
      currencySymbol?:  string | null;
      /** Unidad de medida del Article referenciado (`Article.unitOfMeasure`). */
      quantityUnitName?: string | null;
      lineAdjKind:      "BONUS" | "SURCHARGE" | null;
      lineAdjType:      "PERCENTAGE" | "FIXED_AMOUNT" | null;
      lineAdjValue:     number | null;
      lineAdjAmount:    number | null;
      affectsStock:     boolean | null;
    }>;
    taxes: Array<{
      id:        string;
      name:      string;
      code:      string;
      rate:      number | null;
      appliesTo: string;
      taxAmount: number;
      manual:    boolean;
    }>;
    // Fase 2.5 — ajuste global de costo del artículo (Bonif/Recargo del
    // modal de artículos). null/undefined cuando el artículo no tiene
    // `manualAdjustmentKind` configurado. El frontend lo muestra debajo
    // de la tabla en SaleCompositionEditableGrid.
    costAdjustment?: {
      kind:   "BONUS" | "SURCHARGE" | null;
      type:   "PERCENTAGE" | "FIXED_AMOUNT" | null;
      value:  number | null;
      amount: number | null;
    } | null;
  };
  /** F1.3 G4.3 — desglose por componente sale-side con `salePreManualDiscount`.
   *  El motor backend lo emite siempre que hay base por componente disponible.
   *  La UI consume `salePreManualDiscount` como threshold visual: si pre ===
   *  final no muestra fila "Pre-bonif." (POLICY R4.5, sin matemática FE). */
  componentSaleBreakdown?: {
    metal: {
      base:                  number;
      final:                 number;
      salePreManualDiscount: number | null;
      adjustments: Array<{
        kind:        string;
        label?:      string;
        amount:      number;
        applyOn:     string;
        base?:       number | null;
        percentage?: number | null;
        valueType?:  string | null;
        source?:     string | null;
      }>;
    };
    hechura: {
      base:                  number;
      final:                 number;
      salePreManualDiscount: number | null;
      adjustments: Array<{
        kind:        string;
        label?:      string;
        amount:      number;
        applyOn:     string;
        base?:       number | null;
        percentage?: number | null;
        valueType?:  string | null;
        source?:     string | null;
      }>;
    };
  } | null;
  /** Merma efectivamente aplicada por el motor. Atajo de
   *  `composition.metal.appliedMermaPct`. */
  appliedMermaPercent?: number | null;
  /** Costo de compra (sin/con/breakdown). */
  costBase?:         string | null;
  costTaxAmount?:    string | null;
  costWithTax?:      string | null;
  costTaxBreakdown?: Array<{
    taxId:           string;
    name:            string;
    calculationType: string;
    rate:            number | null;
    fixedAmount:     number | null;
    taxAmount:       number;
  }>;
  /** Eco del override de lista efectivamente aplicado a esta línea. */
  priceListIdOverride?: string | null;
  /**
   * F1.4 G5 #11-C — overrides per costLineId aplicados efectivamente al
   * preview (post-validación, post-merge legacy/explicit). Espejo de
   * `SalePriceResult.costLineOverridesApplied` del backend.
   *
   * Passthrough puro (POLICY R4.5): la UI lee y muestra; cero recálculo.
   * En 11-C es solo plumbing — la tabla editable (11-D) consumirá este
   * array para indexar inputs por `costLineId` (NO por row index).
   */
  costLineOverridesApplied?: CostLineOverride[];
  /**
   * F1.4 G5 #11-C — warnings internos del motor sobre overrides inválidos.
   * NO se mezclan con `policy.blockingAlerts` (negocio) ni `taxBreakdown`.
   * Diagnóstico interno — la UI normal los ignora; un debug panel
   * futuro podría mostrarlos.
   */
  debugWarnings?: DebugWarning[];

  // ── Etapa D' (cierre conceptual) — Redondeo Comercial por línea ─────────
  /** **Vista** del Redondeo Comercial del comprobante para visualización
   *  dentro del card del artículo.
   *
   *  IMPORTANTE — naturaleza del campo:
   *    · NO representa un redondeo propio de esta línea.
   *    · NO implica que el cálculo se haya ejecutado sobre esta línea.
   *    · Es una replicación visual: el snapshot del documento se copia
   *      a cada `lines[i]` para que el card de artículo
   *      (`PricingStepsBreakdown.RoundingTaxSection`) lo muestre como
   *      cierre de la cadena comercial. El cálculo siempre fue a nivel
   *      comprobante (por eso `appliedAt` SIEMPRE vale `"DOCUMENT"`).
   *
   *  Cuando es `null`, la lista del documento opera en PER_LINE_LEGACY o
   *  mixed-list — el card de artículo no muestra el bloque PER_DOCUMENT.
   *
   *  REGLA DE ORO PERMANENTE:
   *    Si un valor necesario no existe en este snapshot:
   *      · NO calcularlo en frontend.
   *      · NO inferirlo.
   *      · NO reconstruirlo.
   *    El fix correcto es agregarlo al snapshot backend.
   *
   *  - `appliedAt: "DOCUMENT"` viene del backend (no se infiere).
   *  - `appliedToLineCount: N` viene del backend (NUNCA `lines.length` en FE).
   *  - Valores monetarios y de gramos vienen del snapshot tal cual. */
  commercialRoundingContext?: {
    source: "PRICE_LIST";
    scope:  "UNIFIED" | "BREAKDOWN";
    appliedAt:          "DOCUMENT";
    appliedToLineCount: number;
    totalAdjustment:    number;
    unified?: {
      pre:        number;
      post:       number;
      adjustment: number;
      mode:       string;
      direction:  string;
    };
    breakdown?: {
      metals: ReadonlyArray<{
        metalParentId:      string;
        metalParentName:    string;
        preGrams:           number;
        postGrams:          number;
        deltaGrams:         number;
        metalPricePerGram:  number;
        monetaryEquivalent: number;
        mode:               string;
        direction:          string;
      }>;
      metalMonetaryEquivalent: number;
      hechura: {
        preRoundingSaldoMonetario:  number;
        postRoundingSaldoMonetario: number;
        deltaSaldoMonetario:        number;
        mode:                       string;
        direction:                  string;
        source:                     "PRICE_LIST_HECHURA";
      };
      combinedAdjustment: number;
    };
    fallback?: "ALL_NONE" | "NO_METALS_BREAKDOWN_DATA" | "NO_SHARED_LIST" | null;
  } | null;
};

/**
 * F1.4 G5 #11-C — espejo frontend del CostLineOverride backend.
 * Misma estructura — tipos discriminados explícitos para que el TS
 * compiler garantice el shape del payload que va al backend.
 */
export type CostLineOverride = {
  costLineId:        string;
  type:              "METAL" | "HECHURA" | "PRODUCT" | "SERVICE";
  quantityOverride?:    number | null;
  unitValueOverride?:   number | null;
  mermaPercentOverride?: number | null;
  adjustmentKind?:   "BONUS" | "SURCHARGE" | null;
  adjustmentType?:   "PERCENTAGE" | "FIXED_AMOUNT" | null;
  adjustmentValue?:  number | null;
};

/** F1.4 G5 #11-C — espejo frontend de DebugWarning backend. */
export type DebugWarning = {
  code:        "COST_LINE_OVERRIDE_NOT_FOUND"
             | "COST_LINE_OVERRIDE_TYPE_MISMATCH"
             | "COST_LINE_OVERRIDE_INVALID_FIELD";
  message:     string;
  costLineId?: string | null;
  context?:    Record<string, unknown>;
};

/** Totales del documento — fuente única de verdad calculada por
 *  `computeSaleDocumentTotals` en el backend (Fase 3 + 4). */
export type SaleDocumentTotals = {
  subtotalBeforeDiscounts:   number;
  lineDiscountAmount:        number;
  subtotalAfterLineDiscounts: number;
  channelAdjustmentAmount:   number;
  couponDiscountAmount:      number;
  paymentAdjustmentAmount:   number;
  shippingAmount:            number;
  globalDiscountAmount:      number;
  taxableBase:               number;
  taxAmount:                 number;
  /** Suma agregada del `unitAdjustment × qty` reportado por las líneas con
   *  redondeo aplicado por la lista de precios. Display delta — el motor ya
   *  absorbió este monto en lineTotal/lineTotalWithTax, así que `total` no
   *  vuelve a sumarlo. */
  roundingAdjustment:        number;
  totalBeforeTax:            number;
  totalWithTax:              number;
  total:                     number;
  legacyCouponOnlyDiscount:  number;
  sourceTrace:               Array<{ step: string; amount: number; note?: string }>;
  // FASE 2 — Agregados Metal/Hechura a nivel documento (informativos).
  metalCostSubtotal?:    number;
  hechuraCostSubtotal?:  number;
  metalSaleSubtotal?:    number;
  hechuraSaleSubtotal?:  number;
  /** true si al menos una línea reporta `*Estimated=true`. */
  breakdownEstimated?:   boolean;
  /** Metadata del redondeo cuando alguna línea lo aplicó o la política doc
   *  del tenant lo aplicó. Null en caso contrario. La UI usa esto para
   *  mostrar "Redondeo por lista: …", "Redondeo comprobante" o "Sin
   *  redondeo". */
  roundingInfo?: {
    source:        "PRICE_LIST" | "TENANT_POLICY";
    priceListId:   string | null;
    priceListName: string | null;
    applyOn:       string;
    mode:          string;
    direction:     string;
  } | null;
  /** Detalle del redondeo a nivel comprobante (Etapa 1B — shape discriminado
   *  por scope: UNIFIED / BREAKDOWN / BOTH). `null` si la política está
   *  apagada o todas las capas dieron delta 0. */
  documentRoundingApplied?: {
    source?:  string;
    scope?:   "UNIFIED" | "BREAKDOWN" | "BOTH" | string;
    applyOn?: string;
    totalAdjustment?: number;
    unified?: {
      applyOn?:      string;
      mode?:         string;
      direction?:    string;
      preRounding?:  number;
      postRounding?: number;
      adjustment?:   number;
    };
    breakdown?: {
      metal?: {
        applyOn?:      string;
        mode?:         string;
        direction?:    string;
        preRounding?:  number;
        postRounding?: number;
        adjustment?:   number;
      };
      hechura?: {
        applyOn?:      string;
        mode?:         string;
        direction?:    string;
        preRounding?:  number;
        postRounding?: number;
        adjustment?:   number;
      };
      combinedAdjustment?: number;
    };
    fallback?: "NO_BREAKDOWN_DATA" | null;
  } | null;
};

import type { CheckoutResult } from "./articles";

export type ChannelAdjResult = {
  baseAmount:    number;
  channelAmount: number;
  finalAmount:   number;
  channelName:   string;
  channelId:     string;
};

export type CouponAdjResult = {
  baseAmount:     number;
  discountAmount: number;
  finalAmount:    number;
  couponId:       string;
  couponCode:     string;
  couponName:     string;
  discountType:   string;
  discountValue:  number;
  applied:        boolean;
  reason?:        string;
};

/** Fase 2A.7 — reglas comerciales del cliente expuestas en el preview. */
export type SalePreviewClientCommercialRules = {
  ruleType:  string | null;
  valueType: string | null;
  value:     number | null;
  applyOn:   string | null;
};

export type SalePreviewResult = {
  lines:          SalePreviewLine[];
  /** Σ lineTotal — alias de `documentTotals.subtotalAfterLineDiscounts`. */
  subtotal:       number;
  channelResult:  ChannelAdjResult | null;
  couponResult:   CouponAdjResult | null;
  checkoutResult: CheckoutResult | null;
  /** Total final con impuestos (Fase 4 — antes era post-pago SIN impuestos). */
  total:          number;
  /** Totales del documento. Misma fuente que `confirmSale` en el backend. */
  documentTotals: SaleDocumentTotals;

  // ── Fase 2A.7 — info doc-level ────────────────────────────────────────
  /** balanceType del cliente (UNIFIED / BREAKDOWN). null si no hay cliente. */
  clientBalanceType?:    string | null;
  /** Reglas comerciales del cliente (descuentos/recargos automáticos). */
  clientCommercialRules?: SalePreviewClientCommercialRules | null;
  /** true si el cliente es exento de impuestos. Metadata read-only: permite
   *  distinguir "sin impuesto" de "exento por cliente". El motor ya aplicó la
   *  exención por clientId; el frontend NO recalcula. */
  clientTaxExempt?: boolean;
  /** Eco de `input.priceListId` — lo que el operador eligió a nivel doc. */
  requestedPriceListId?: string | null;
  /** Lista efectivamente aplicada consolidada. Si todas las líneas usaron la
   *  misma → ese id. Si difieren → "MIXED". null si no hubo lista. */
  appliedPriceListId?:   string | null;
  /** Nombre consolidado. "Múltiples" cuando es "MIXED". */
  appliedPriceListName?: string | null;
  /** true si el operador pidió override (doc o línea), independientemente de
   *  si el motor pudo respetarlo. */
  priceListWasOverridden?: boolean;

  // ── Fase MM — metadata de moneda del response ────────────────────────────
  /** Moneda en la que vienen los importes del response (si != base, hubo
   *  conversión). Ausente cuando el endpoint no devolvió la metadata
   *  (compatibilidad hacia atrás). */
  responseCurrencyId?:     string;
  responseCurrencyCode?:   string;
  responseCurrencySymbol?: string;
  baseCurrencyId?:         string;
  baseCurrencyCode?:       string;
  baseCurrencySymbol?:     string;
  /** Tasa "1 unidad responseCurrency = `currencyRate` unidades base". */
  currencyRate?:           number;
  /** true si hubo conversión real (responseCurrency != base). */
  currencyConverted?:      boolean;

  // ── Fase 3B.7 — Balance Mode (POLICY.md §11) ──────────────────────────
  /** Modo de balance resuelto en este preview (UNIFIED / BREAKDOWN).
   *  El backend resuelve la prioridad (documento → cliente → lista →
   *  tenant → fallback). El frontend solo lee y muestra. */
  balanceMode?:        "UNIFIED" | "BREAKDOWN";
  /** De dónde salió el modo. Auditoría / "Ver origen". */
  balanceModeSource?:  string;
  /** Breakdown canónico del documento. En UNIFIED, `metals=[]`. En
   *  BREAKDOWN, una entrada por metal padre + saldo monetario. Los
   *  campos monetarios ya vienen convertidos a la moneda de display
   *  (igual contrato que `total`/`subtotal`). Los gramos NO se convierten. */
  balanceBreakdown?:   BalanceBreakdownDTO;

  // ── Etapa A — Manual Adjustment (POLICY §R-Rounding-1 capa 17) ────────
  /** Total emitido por el motor antes del ajuste manual. Auditoría +
   *  bloque "TPTech calculó" del card. Convertido a moneda display si
   *  hubo conversión. */
  engineTotal?:        number | null;
  /** Total final post-ajuste manual (= `engineTotal + ajuste`). Si no
   *  hubo ajuste, `finalTotal === total === engineTotal`. */
  finalTotal?:         number | null;
  /** Snapshot del ajuste manual. `null` si el operador no tipeó ajuste.
   *  Etapa A: `scope: "UNIFIED"`. Etapa C: `scope: "BREAKDOWN"`.
   *  @deprecated Etapa 1+2 backend: usar `manualAdjustmentSnapshot` (paridad de
   *  naming con `Sale.manualAdjustmentSnapshot` en DB). Alias mantenido durante
   *  la migración del frontend — es la MISMA referencia que `manualAdjustmentSnapshot`. */
  manualAdjustment?: ManualAdjustmentApiSnapshot | null;

  // ── Etapa 1.1 backend — campos canónicos top-level ────────────────────
  // El backend ahora expone los snapshots con el mismo nombre con que se
  // persisten en `Sale`. Reference aliasing: `manualAdjustmentSnapshot` y
  // `manualAdjustment` apuntan al MISMO objeto; `documentRoundingSnapshot`
  // y `documentTotals.documentRoundingApplied` también. El converter de
  // moneda muta in-place una sola vez por path conocido.

  /** Snapshot canónico del ajuste manual (mismo shape que
   *  `Sale.manualAdjustmentSnapshot`). Es la MISMA referencia que el alias
   *  deprecated `manualAdjustment`. */
  manualAdjustmentSnapshot?: ManualAdjustmentApiSnapshot | null;

  /** Snapshot canónico del redondeo automático del documento. Mismo shape que
   *  `Sale.documentRoundingSnapshot` que `confirmSale` persiste. Es la MISMA
   *  referencia que `documentTotals.documentRoundingApplied` enriquecida con
   *  `suppressedListDeferredRounding`. */
  documentRoundingSnapshot?: SalePreviewResult["documentTotals"]["documentRoundingApplied"];
};

export interface ManualAdjustmentApiSnapshotTotals {
  monetaryAdjustment:      number;
  metalMonetaryEquivalent: number;
  totalMonetaryAdjustment: number;
}

export interface ManualAdjustmentApiSnapshotAudit {
  appliedBy: { userId: string; userName: string } | null;
  appliedAt: string;
  reason?:   string | null;
}

export interface ManualAdjustmentApiSnapshotUnified {
  scope:  "UNIFIED";
  unified: { preAmount: number; postAmount: number; amount: number };
  breakdown?: undefined;
  totals: ManualAdjustmentApiSnapshotTotals;
  audit:  ManualAdjustmentApiSnapshotAudit;
}

export interface ManualAdjustmentApiSnapshotBreakdownMetal {
  metalParentId:      string | null;
  metalParentName:    string;
  preGrams:           number;
  postGrams:          number;
  deltaGrams:         number;
  metalPricePerGram:  number;
  monetaryEquivalent: number;
}

export interface ManualAdjustmentApiSnapshotBreakdown {
  scope:  "BREAKDOWN";
  unified?: undefined;
  breakdown: {
    metals:   ManualAdjustmentApiSnapshotBreakdownMetal[];
    monetary: { preAmount: number; amount: number; postAmount: number };
  };
  totals: ManualAdjustmentApiSnapshotTotals;
  audit:  ManualAdjustmentApiSnapshotAudit;
}

export type ManualAdjustmentApiSnapshot =
  | ManualAdjustmentApiSnapshotUnified
  | ManualAdjustmentApiSnapshotBreakdown;

// ─────────────────────────────────────────────────────────────────────────
// Fase 3B.7 — DTO de Balance Breakdown (POLICY.md §11). Se acopla al shape
// que el backend emite en `DocumentBalanceBreakdown`. Read-only para el
// frontend: no se construye nunca acá, sólo se lee.
// ─────────────────────────────────────────────────────────────────────────
export interface BalanceBreakdownMetalVariantDTO {
  variantId:     string;
  variantName:   string;
  gramsOriginal: number;
  purity:        number;
  gramsPure:     number;
  sourceLineId:  string;
}

export interface BalanceBreakdownMetalDTO {
  metalParentId:         string;
  metalParentName:       string;
  gramsOriginal:         number;
  /** Pureza ponderada. null cuando Σg=0 (caso edge). */
  purity:                number | null;
  gramsPure:             number;
  /** Cotización referencial. SE CONVIERTE a moneda doc. */
  quotePriceSnapshot:    number | null;
  /** Valuación referencial = gramsPure × quotePrice. SE CONVIERTE. */
  valuationMonetary:     number | null;
  valuationCurrencyCode: string;
  variants?:             BalanceBreakdownMetalVariantDTO[];
  sourceLineIds:         string[];
}

/** Grupo visual del componente. El frontend agrupa por ESTE campo (no por
 *  `type`). Los snapshots históricos pueden no traerlo — en ese caso el
 *  frontend cae a un mapeo legacy `type → group`. */
export type BalanceMonetaryComponentGroupDTO =
  | "HECHURA"
  | "PRODUCT"
  | "TAX"
  | "DISCOUNT"
  | "BONUS"
  | "SURCHARGE"
  | "ADJUSTMENT"
  | "ROUNDING"
  | "SHIPPING"
  | "COUPON"
  | "CHANNEL"
  | "PAYMENT"
  /** Etapa UX-Auditable (2026-05-29) — diferencia entre la valuación del
   *  metal del cost-line y el valor físico puro del balance. Cierra la
   *  ecuación Σ components == saldo monetario canónico. */
  | "MARGIN";

export interface BalanceBreakdownMonetaryComponentDTO {
  /** Kind canónico (granularidad fina — auditoría / drill-down). */
  type:    string;
  /** Grupo visual. Opcional para back-compat con snapshots viejos. */
  group?:  BalanceMonetaryComponentGroupDTO;
  label:   string;
  /** Signed: + suma a saldo, − resta. */
  amount:  number;
  sourceLineId?: string;
  source?: string;
  /** Solo para `type="ROUNDING_MONETARY"`. Origen REAL del redondeo monetario:
   *  `"LIST"` → Redondeo comercial (lista); `"DOCUMENT"` → Redondeo financiero
   *  (comprobante). Cuando falta, el render cae al heurístico legacy
   *  (`documentRoundingApplied != null`). POLICY §R-Rounding-3. */
  roundingSource?: "LIST" | "DOCUMENT";
}

export interface BalanceBreakdownMonetaryDTO {
  /** Saldo monetario EN MONEDA DEL DOCUMENTO (ya convertido). */
  amount:        number;
  currencyCode:  string;
  /** Tasa snapshot BASE↔doc al confirmar (histórico, no se convierte). */
  currencyRate:  number;
  /** Saldo monetario EN MONEDA BASE (no se convierte; definición = BASE). */
  amountBase:    number;
  components?:   BalanceBreakdownMonetaryComponentDTO[];
}

export interface BalanceBreakdownDTO {
  /** En UNIFIED: []. En BREAKDOWN: una entrada por metal padre. */
  metals:           BalanceBreakdownMetalDTO[];
  monetaryBalance:  BalanceBreakdownMonetaryDTO;
}

// ─── Payloads ─────────────────────────────────────────────────────────────────
/** Override de aplicación ("appliesTo") para descuentos/impuestos de línea.
 *  Espejo de `SaleLineAppliesTo` del backend. */
export type SaleLineAppliesTo =
  | "TOTAL" | "METAL" | "HECHURA" | "METAL_Y_HECHURA"
  | "SUBTOTAL_AFTER_DISCOUNT" | "SUBTOTAL_BEFORE_DISCOUNT"
  | "PRODUCT" | "SERVICE";

export type SaleLineManualDiscountOverride = {
  mode:      "PERCENT" | "AMOUNT";
  value:     number;
  appliesTo?: SaleLineAppliesTo;
  kind?:     "BONUS" | "SURCHARGE";
};

export type SaleLineTaxOverride = {
  mode:      "PERCENT" | "AMOUNT";
  value:     number;
  appliesTo?: SaleLineAppliesTo;
};

export type SaleLineInput = {
  articleId: string;
  variantId?: string | null;
  quantity: number;
  unitPrice: number;
  discountPct?: number;
  priceSource?: string;
  appliedPriceListId?: string | null;
  appliedPromotionId?: string | null;
  appliedDiscountId?: string | null;

  // ── Fase 1.5 — overrides de composición persistibles en DRAFT ────────────
  gramsOverride?:          number | null;
  mermaPercentOverride?:   number | null;
  metalVariantIdOverride?: string | null;
  hechuraOverrideAmount?:  number | null;
  costLineOverrides?:      CostLineOverride[];

  // ── Etapa 4 — overrides comerciales del operador, persistibles en DRAFT ──
  // El backend los persiste en SaleLine; al reabrir la sale via getOne, el
  // mapper del frontend los rehidrata en `pricingMeta` + `manualOverrides`.
  manualPriceOverride?:             number | null;
  manualDiscountOverride?:          SaleLineManualDiscountOverride | null;
  taxOverride?:                     SaleLineTaxOverride            | null;
  manualDiscountAppliesToOverride?: SaleLineAppliesTo              | null;
  manualTaxAppliesToOverride?:      SaleLineAppliesTo              | null;
  priceListIdOverride?:             string | null;
};

export type CreateSalePayload = {
  clientId?:   string | null;
  sellerId?:   string | null;
  warehouseId?: string | null;
  notes?:      string;
  channelId?:  string | null;
  couponCode?: string | null;
  /** Etapa C16 — paridad preview ↔ persist (fix drift C15).
   *  Lista de precios DEL DOCUMENTO. El backend la usa como fallback para
   *  cada línea que no tenga su propio `priceListIdOverride`. Mismo contrato
   *  que `previewSale` (`PreviewSaleInput.priceListId`). Sin esto, el
   *  backend cae a la jerarquía cliente → favorita y se pierde la lista
   *  que el operador eligió en el combo global. */
  priceListId?: string | null;
  lines:       SaleLineInput[];
  /** Fase 4.2 — Override manual del Balance Mode del documento
   *  (POLICY.md §11 R11.4). Persiste en `Sale.balanceModeOverride`. */
  balanceModeOverride?: "UNIFIED" | "BREAKDOWN" | null;
  // ── Etapa 1.1 — ajustes a nivel documento (paridad preview ↔ confirm) ──
  // El backend los persiste en `Sale` para que `confirmSale` reaplique
  // los mismos montos que `previewSale`. Aceptamos shape rico (`shipping`,
  // `globalDiscount` objeto) o monto plano por compatibilidad con preview.
  /** Costo de envío del documento — monto ya resuelto. Se ignora si
   *  `shipping` viene con un valor válido. */
  shippingAmount?: number | null;
  /** Envío crudo. El backend lo resuelve a monto vía `resolveShippingAmount`. */
  shipping?: {
    mode:    "FIXED" | "BY_WEIGHT" | "FREE";
    value?:  number | null;
    weight?: number | null;
  } | null;
  /** Descuento global del documento — shape rico. */
  globalDiscount?: { type: "PERCENT" | "AMOUNT"; value: number } | null;
  /** Descuento global como monto plano. Se mapea a `{ type: "AMOUNT", value }`. */
  globalDiscountAmount?: number | null;
  /** Forma de pago seleccionada en el DRAFT — afecta paymentAdjustmentAmount. */
  paymentMethodId?: string | null;
  /** Cantidad de cuotas (≥ 1). Requiere `paymentMethodId`. */
  paymentInstallments?: number | null;
  /** Ajuste manual del comprobante (POLICY §R-Rounding-1 capa 17).
   *  Etapa A: scope "UNIFIED". Etapa C: scope "BREAKDOWN" — solo cuando
   *  el documento operará en modo BREAKDOWN. */
  manualAdjustment?: ManualAdjustmentApiInput | null;
};

export type AddPaymentPayload = {
  paymentMethodId?: string | null;
  amount: number;
  installments?: number;
  reference?: string;
};

// ─── List response ────────────────────────────────────────────────────────────
export type SaleListResult = {
  data: SaleRow[];
  total: number;
  skip: number;
  take: number;
};

// ─── Labels ───────────────────────────────────────────────────────────────────
export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  DRAFT: "Borrador",
  CONFIRMED: "Confirmada",
  PAID: "Pagada",
  PARTIALLY_PAID: "Pago parcial",
  CANCELLED: "Anulada",
};

export const SALE_STATUS_COLORS: Record<SaleStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  CONFIRMED: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
  PARTIALLY_PAID: "bg-yellow-100 text-yellow-700",
  CANCELLED: "bg-red-100 text-red-600",
};

// ─── Caja ─────────────────────────────────────────────────────────────────────
export type CajaPaymentRow = {
  id: string;
  saleId: string;
  saleCode: string;
  saleStatus: string;
  paymentMethodId: string | null;
  paymentMethodName: string;
  amount: string;
  installments: number;
  reference: string;
  paidAt: string;
};

export type CajaMethodSummary = {
  paymentMethodId: string | null;
  paymentMethodName: string;
  amount: number;
  count: number;
};

export type CajaDaySummary = {
  date: string;
  salesCount: number;
  totalSalesAmount: number;
  totalPaid: number;
  totalPending: number;
  paymentsByMethod: CajaMethodSummary[];
  payments: CajaPaymentRow[];
};

// ─── API ──────────────────────────────────────────────────────────────────────
export const salesApi = {
  list: (params?: {
    skip?: number;
    take?: number;
    status?: string;
    clientId?: string;
    q?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.skip !== undefined) qs.set("skip", String(params.skip));
    if (params?.take !== undefined) qs.set("take", String(params.take));
    if (params?.status) qs.set("status", params.status);
    if (params?.clientId) qs.set("clientId", params.clientId);
    if (params?.q) qs.set("q", params.q);
    if (params?.dateFrom) qs.set("dateFrom", params.dateFrom);
    if (params?.dateTo) qs.set("dateTo", params.dateTo);
    return apiFetch<SaleListResult>(`/sales?${qs}`, { on401: "throw" });
  },

  getOne: (id: string) =>
    apiFetch<SaleDetail>(`/sales/${id}`, { on401: "throw" }),

  create: (data: CreateSalePayload) =>
    apiFetch<SaleDetail>("/sales", { method: "POST", body: data, on401: "throw" }),

  update: (id: string, data: Partial<CreateSalePayload>) =>
    apiFetch<SaleDetail>(`/sales/${id}`, { method: "PUT", body: data, on401: "throw" }),

  confirm: (id: string) =>
    apiFetch<SaleDetail>(`/sales/${id}/confirm`, { method: "POST", on401: "throw" }),

  addPayment: (id: string, data: AddPaymentPayload) =>
    apiFetch<SaleDetail>(`/sales/${id}/payments`, { method: "POST", body: data, on401: "throw" }),

  cancel: (id: string, note?: string) =>
    apiFetch<SaleDetail>(`/sales/${id}/cancel`, {
      method: "PATCH",
      body: { note: note ?? "" },
      on401: "throw",
    }),

  caja: (date?: string) => {
    const qs = date ? `?date=${encodeURIComponent(date)}` : "";
    return apiFetch<CajaDaySummary>(`/sales/caja${qs}`, { on401: "throw" });
  },

  /** Resuelve precios y checkout para el carrito sin crear la venta. */
  preview: (data: SalePreviewInput) =>
    apiFetch<SalePreviewResult>("/sales/preview", {
      method: "POST",
      body: data,
      on401: "throw",
    }),

  /** 1.E — Descarga el PDF oficial de la factura. El backend valida que
   *  el comprobante este confirmado (no DRAFT, no CANCELLED) y devuelve
   *  `application/pdf`. Usamos `fetch` directo porque `apiFetch` parsea
   *  el body como JSON.
   *
   *  Errores del servidor:
   *    · 409 { code: "SALE_NOT_CONFIRMED" | "SALE_CANCELLED", message } →
   *      lanzamos `ApiError` con el mensaje del backend para que el caller
   *      pueda mostrarlo en un toast.
   *    · 401 / 403 / 404 → ApiError con status correspondiente. */
  downloadPdf: async (id: string): Promise<{ blob: Blob; filename: string }> => {
    const url = `${API_URL}/sales/${id}/pdf`;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({} as { message?: string; code?: string }));
      throw new ApiError(
        (data as { message?: string }).message || `Error al generar el PDF (${res.status})`,
        { status: res.status, data, url, method: "GET" },
      );
    }
    const blob = await res.blob();
    const cd   = res.headers.get("Content-Disposition") || "";
    const m    = /filename="?([^";]+)"?/.exec(cd);
    const filename = m?.[1] ?? `Factura-${id}.pdf`;
    return { blob, filename };
  },

  /** 1.E parte 2 — Envia la factura por mail con el PDF oficial adjunto.
   *  Backend valida estado (DRAFT/CANCELLED → 409) y Receipt.code presente
   *  (sin recibo → 409 SALE_WITHOUT_RECEIPT_NUMBER). El caller debe
   *  manejar errores con `ApiError.data.message` (mensaje localizado del
   *  backend listo para toast). */
  sendEmail: (id: string, payload: { to: string; subject: string; message: string }) =>
    apiFetch<{ ok: boolean; message: string }>(`/sales/${id}/send-email`, {
      method: "POST",
      body:   payload,
      on401:  "throw",
    }),
};
