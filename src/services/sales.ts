import { apiFetch } from "../lib/api";

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

export type SaleDetail = SaleRow & {
  clientSnapshot: Record<string, unknown> | null;
  sellerSnapshot: SellerSnapshot | null;
  cancelNote: string;
  lines: SaleLineRow[];
  payments: SalePaymentRow[];
  saleTotals: SaleTotals | null;
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
  /** Detalle del redondeo a nivel comprobante (modo UNIFIED), cuando la
   *  política `Jewelry.documentRoundingEnabled` está activa y el delta es
   *  != 0. Null en caso contrario. */
  documentRoundingApplied?: {
    source?:       string;
    applyOn?:      string;
    mode?:         string;
    direction?:    string;
    preRounding?:  number;
    postRounding?: number;
    adjustment?:   number;
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
};

// ─── Payloads ─────────────────────────────────────────────────────────────────
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
  // Mismas reglas y semántica que `SalePreviewLineInput`. Cuando viajan en
  // `salesApi.create()` o `salesApi.update()`, el backend los aplica al
  // resolver el snapshot y los guarda en `pricingSnapshot.costLineOverridesApplied`.
  // Hoy no hay caller que los envíe (VentasFacturas usa preview-only); el
  // tipo está disponible para cuando se conecte la grilla editable.
  gramsOverride?:          number | null;
  mermaPercentOverride?:   number | null;
  metalVariantIdOverride?: string | null;
  hechuraOverrideAmount?:  number | null;
  costLineOverrides?:      CostLineOverride[];
};

export type CreateSalePayload = {
  clientId?:   string | null;
  sellerId?:   string | null;
  warehouseId?: string | null;
  notes?:      string;
  channelId?:  string | null;
  couponCode?: string | null;
  lines:       SaleLineInput[];
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
};
