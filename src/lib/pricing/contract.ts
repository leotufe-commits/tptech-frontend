// src/lib/pricing/contract.ts
// ============================================================================
// Contrato común de PREVIEW comercial para Simulador, Factura y Comparador.
//
// Regla de oro del proyecto:
//   El backend (pricing-engine) es la única fuente de verdad para precios,
//   descuentos, impuestos, canal, cupón, pago, envío y redondeo.
//   El frontend solo arma payload, muestra respuesta y formatea.
//
// Este archivo NO reemplaza los tipos actuales (PricingPreviewResult del
// articles service ni SalePreviewInput/Result del sales service). Convive con
// ellos: define un payload y un resultado normalizados que las tres pantallas
// pueden compartir, y los normalizadores se encargan de adaptar cada respuesta
// concreta del backend al shape unificado.
//
// Fases:
//   Fase 1 (este archivo + helpers en buildPricingPreviewPayload.ts y
//   normalizePricingPreviewResult.ts): solo definiciones y utilidades.
//   No se cambia ningún consumidor. Sin riesgo runtime.
//
//   Fase 2: el Simulador y el Comparador empiezan a usar buildPayload + normalize.
//   Fase 3: la Factura adopta los mismos helpers para los previews por línea.
//   Fase 4: backend acepta el contrato unificado en ambos endpoints.
// ============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// Sub-tipos de payload
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Modo de envío que entiende el motor. Importante: el frontend NUNCA debe
 * enviar `shippingAmount` ya calculado — siempre `mode + value + weight` y
 * el backend resuelve el monto. Hoy `salesApi.preview` acepta solo
 * `shippingAmount`; el adapter en `buildPricingPreviewPayload` mantiene
 * compatibilidad calculando el monto provisorio para el endpoint legacy
 * (Fase 1) hasta que el backend acepte `shipping` (Fase 4).
 */
export type PricingShippingMode = "FIXED" | "BY_WEIGHT" | "FREE";

export type PricingShippingPayload = {
  mode:    PricingShippingMode;
  /** Monto fijo (FIXED) o precio por kg (BY_WEIGHT). */
  value?:  number | null;
  /** Peso en kg (BY_WEIGHT). */
  weight?: number | null;
};

/** Override puntual del precio neto unitario (sin impuestos). */
export type PricingManualPriceOverride = number;

/** Override puntual de la bonificación. */
export type PricingManualDiscountOverride = {
  mode:       "PERCENT" | "AMOUNT";
  value:      number;
  appliesTo?: "METAL" | "HECHURA" | "PRODUCT" | "SERVICE" | "TOTAL";
};

/** Override puntual del impuesto (item sintético). */
export type PricingManualTaxOverride = {
  mode:       "PERCENT" | "AMOUNT";
  value:      number;
  appliesTo?: "METAL" | "HECHURA" | "PRODUCT" | "SERVICE" | "TOTAL";
};

/** Overrides de COMPOSICIÓN DE COSTO a nivel línea (Fase 2 del backend). */
export type PricingCostOverridesPayload = {
  gramsOverride?:          number | null;
  mermaPercentOverride?:   number | null;
  metalVariantIdOverride?: string | null;
  hechuraOverrideAmount?:  number | null;
};

export type PricingOverridesPayload = {
  manualPriceOverride?:    PricingManualPriceOverride | null;
  manualDiscountOverride?: PricingManualDiscountOverride | null;
  manualTaxOverride?:      PricingManualTaxOverride | null;
  cost?:                   PricingCostOverridesPayload;
};

/**
 * Una línea de preview unificada. El Simulador y el Comparador trabajan con
 * exactamente UNA línea; la Factura puede tener N. Los overrides por línea
 * viven dentro de cada `PricingPreviewLinePayload`.
 */
export type PricingPreviewLinePayload = {
  articleId: string;
  variantId?: string | null;
  quantity:  number;

  /** Overrides puntuales aplicables a esta línea. */
  overrides?: PricingOverridesPayload;

  /** Fase 2A.7 — override de lista de precios por línea. Tiene precedencia
   *  sobre el `priceListId` doc-level del payload. Si ambos vienen vacíos,
   *  el motor resuelve por jerarquía cliente → categoría → favorita. */
  priceListIdOverride?: string | null;
};

/**
 * Payload unificado de preview comercial. Las tres pantallas deben construir
 * exactamente esta estructura — el adapter del helper se encarga de mapearla
 * al endpoint correcto (artículos vs ventas).
 */
export type PricingPreviewPayload = {
  /** 1..N líneas. Simulador/Comparador siempre 1. Factura N. */
  lines: PricingPreviewLinePayload[];

  // ── Contexto comercial del documento ──────────────────────────────────────
  clientId?:          string | null;
  /** Lista de precios elegida explícitamente. Si no se envía, el backend
   *  resuelve por jerarquía (cliente → categoría → favorita). La respuesta
   *  siempre devuelve `appliedPriceListId` y `appliedPriceListName`. */
  priceListId?:       string | null;
  channelId?:         string | null;

  // ── Cupón ─────────────────────────────────────────────────────────────────
  couponCode?:        string | null;
  /** Algunos endpoints aceptan id; el backend prioriza `couponId` cuando ambos
   *  llegan. Mantener consistencia con la pantalla. */
  couponId?:          string | null;

  // ── Forma de pago ─────────────────────────────────────────────────────────
  paymentMethodId?:   string | null;
  installmentsQty?:   number | null;

  // ── Envío (siempre normalizado mode+value+weight) ─────────────────────────
  shipping?:          PricingShippingPayload | null;

  // ── Moneda (cuando se soporte multi-moneda) ───────────────────────────────
  currencyId?:        string | null;
  currencyRate?:      number | null;

  // ── Documento ─────────────────────────────────────────────────────────────
  /** Solo aplica a documentos (Factura). null para Simulador/Comparador. */
  globalDiscount?:    { type: "PERCENT" | "AMOUNT"; value: number } | null;
  /** Depósito desde el que se descontaría stock. No afecta precio pero algunas
   *  reglas comerciales (canal, lista) pueden depender de él en el futuro. */
  warehouseId?:       string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-tipos de respuesta
// ─────────────────────────────────────────────────────────────────────────────

export type NormalizedTaxBreakdownItem = {
  taxId:            string;
  name:             string;
  code?:            string;
  rate:             number | null;
  fixedAmount?:     number | null;
  /** Base imponible que el motor usó para esta línea/impuesto. */
  baseAmount:       number;
  /** Monto resuelto por el motor para esta línea/impuesto. */
  taxAmount:        number;
  /** "PRICE" | "NET" | "TOTAL" | "METAL" | "HECHURA" | etc. */
  applyOn?:         string;
  /** true cuando este impuesto fue forzado por un override manual o por la
   *  configuración de la entidad. La UI lo muestra con badge "Override". */
  overridden?:      boolean;
};

export type NormalizedAppliedRounding = {
  source:        "PRICE_LIST";
  priceListId:   string | null;
  priceListName: string | null;
  applyOn:       "PRICE" | "NET" | "TOTAL";
  mode:          string;
  direction:     string;
  /** Delta unitario aplicado por el redondeo (signed). */
  unitAdjustment: number;
};

export type NormalizedChannelInfo = {
  channelId:        string | null;
  channelName:      string | null;
  /** "PERCENT" | "AMOUNT" según configuración del canal. */
  adjustmentType?:  string;
  adjustmentValue?: number;
  /** Monto aplicado por el canal A NIVEL DOCUMENTO (qty-aware).
   *  Signo positivo = recargo; negativo = descuento. */
  amount:           number;
};

export type NormalizedCouponInfo = {
  couponId?:        string | null;
  couponCode:       string | null;
  couponName:       string | null;
  /** Monto descontado por el cupón A NIVEL DOCUMENTO. */
  amount:           number;
  applied:          boolean;
  /** Razón cuando `applied=false` (ej. caducado, no llega al mínimo, etc.). */
  rejectedReason?:  string;
};

export type NormalizedShippingInfo = {
  mode:   PricingShippingMode | null;
  amount: number;
  label?: string;
};

export type NormalizedPaymentInfo = {
  paymentMethodId:    string | null;
  paymentMethodName?: string | null;
  installments?:      number;
  installmentAmount?: number;
  /** Importe sobre el que se aplica el ajuste de pago (subtotal post canal/cupón). */
  baseAmount:         number;
  /** Recargo (>0) o descuento (<0) por la forma de pago. */
  paymentAdjustment:  number;
  /** Monto final después del ajuste de pago, ANTES de impuestos y envío. */
  finalAmountAfterPayment: number;
  /** Fase 2.1.b — pasos del cálculo del checkout (fórmula del recargo). */
  steps?: NormalizedCheckoutStep[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Composición y costo de compra (Fase 2.1)
// ─────────────────────────────────────────────────────────────────────────────

/** Bloque metal del breakdown — mismo shape en articles y sales preview. */
export type NormalizedCompositionMetal = {
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
  /** Label legible (ej. "18k"). */
  purityLabel:       string | null;
  /** Nombre del metal padre (ej. "Oro"). */
  metalName:         string | null;
  /** Gramos puros base = appliedGrams × purity × (1 + appliedMermaPct/100).
   *  Centralizado acá: los componentes UI deben leerlo, no recalcularlo. */
  pureGramsBase:     number | null;
  /** Gramos puros venta = pureGramsBase × (1 + metalMarginPct/100). Solo
   *  cuando hay margen por componente (METAL_HECHURA). null en MARGIN_TOTAL. */
  pureGramsSale:     number | null;
};

export type NormalizedCompositionHechura = {
  originalAmount: number | null;
  appliedAmount:  number | null;
  manual:         boolean;
  appliesTo:      string | null;
};

export type NormalizedCompositionTaxItem = {
  id:        string;
  name:      string;
  code:      string;
  rate:      number | null;
  appliesTo: string;
  taxAmount: number;
  manual:    boolean;
};

/**
 * F1.3 G4.1 — bloque per-item para PRODUCT y SERVICE en `composition`.
 * Espejo de `CompositionItemBlock` del backend (`pricing-composition.ts`).
 *
 * El frontend hace passthrough puro (POLICY R4.5):
 *  - cero matemática derivada,
 *  - cero heurística sobre `lineAdjAmount` (si el backend no lo emite, queda
 *    null; la UI lo muestra como "—").
 *
 * Retrocompat snapshots viejos:
 *  - Snapshots v3 (sin composition.products/services) se normalizan a `[]`.
 *  - Si un campo opcional viene `undefined` en el raw, queda `null`.
 */
export type NormalizedCompositionItemBlock = {
  costLineId:       string | null;
  catalogItemId:    string | null;
  catalogItemCode:  string | null;
  catalogItemName:  string | null;
  quantity:         number;
  unitValue:        number;
  totalValue:       number;
  currencyId:       string | null;
  lineAdjKind:      "BONUS" | "SURCHARGE" | null;
  lineAdjType:      "PERCENTAGE" | "FIXED_AMOUNT" | null;
  lineAdjValue:     number | null;
  lineAdjAmount:    number | null;
  affectsStock:     boolean | null;
};

/**
 * F1.3 G4.x #9-B — item de `composition.metals[]`. Espejo del backend
 * `CompositionMetalItem` (pricing-composition.ts).
 *
 * Reader-only (POLICY R4.5): cero matemática derivada. Snapshots viejos
 * (v4 o anteriores) sin `metals` array se normalizan a `[normalize(metal)]`
 * cuando el alias legacy existe, o `[]` cuando no.
 */
export type NormalizedCompositionMetalItem = {
  costLineId:        string | null;
  metalVariantId:    string | null;
  metalName:         string | null;
  purity:            number | null;
  purityLabel:       string | null;
  appliedGrams:      number | null;
  appliedMermaPct:   number | null;
  /** Costo individual de la cost line en moneda BASE/display. La suma de
   *  `lineCost` de todos los items === metalCost agregado del motor. */
  lineCost:          number | null;
};

/**
 * F1.3 G4.x #9-B — item de `composition.hechuras[]`. Espejo del backend
 * `CompositionHechuraItem`. Mismo tratamiento de retrocompat que metals[].
 */
export type NormalizedCompositionHechuraItem = {
  costLineId:        string | null;
  appliedAmount:     number | null;
  lineCost:          number | null;
  lineLabel:         string | null;
};

export type NormalizedComposition = {
  /**
   * F1.3 G4.x #9-B — alias LEGACY = `metals[0] ?? null` (invariante
   * estructural mantenido por el normalizer y por buildComposition backend).
   * Consumers viejos (LineAdvancedOverridesPanel pre-9-C, etc.) que solo
   * leen `metal` siguen funcionando sin cambios. Para soportar múltiples
   * METAL leer `metals[]`.
   */
  metal:   NormalizedCompositionMetal   | null;
  /** F1.3 G4.x #9-B — alias LEGACY = `hechuras[0] ?? null`. Mismo contrato. */
  hechura: NormalizedCompositionHechura | null;
  /** F1.3 G4.x #9-B — TODAS las cost lines de tipo METAL del artículo.
   *  SIEMPRE array (nunca undefined). Snapshots v4 sin este campo se
   *  normalizan a `[metal]` (legacy fallback) o `[]` si no hay metal. */
  metals:   NormalizedCompositionMetalItem[];
  /** F1.3 G4.x #9-B — TODAS las cost lines de tipo HECHURA. Mismo contrato. */
  hechuras: NormalizedCompositionHechuraItem[];
  /** F1.3 G4.1 — items PRODUCT del costo (insumos / piedras / etc.). Vacío
   *  cuando el artículo no tiene PRODUCT lines o el snapshot es v3 (legado). */
  products: NormalizedCompositionItemBlock[];
  /** F1.3 G4.1 — items SERVICE del costo (engaste, mano de obra externa). */
  services: NormalizedCompositionItemBlock[];
  taxes:   NormalizedCompositionTaxItem[];
};

/** Item del breakdown de impuestos de COMPRA (no venta). Distinto a
 *  `NormalizedTaxBreakdownItem` (que es de venta). */
export type NormalizedPurchaseTaxItem = {
  taxId:           string;
  name:            string;
  calculationType: string;
  rate:            number | null;
  fixedAmount:     number | null;
  taxAmount:       number;
};

/** Reglas comerciales del cliente expuestas en el preview (Fase 2A.7). */
export type NormalizedClientCommercialRules = {
  ruleType:  string | null;
  valueType: string | null;
  value:     number | null;
  applyOn:   string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Steps + breakdowns adicionales (Fase 2.1.b)
// ─────────────────────────────────────────────────────────────────────────────

/** Paso del cálculo del motor — usado por la UI para mostrar la trazabilidad
 *  capa por capa (PRICE_LIST, METAL_MERMA_HECHURA_TOTAL, COST_LINES_*,
 *  MANUAL_BASE_COST, MANUAL_CURRENCY, etc.). */
export type NormalizedPricingStep = {
  /** Identificador estable del paso (ej. "PRICE_LIST"). */
  key:      string;
  /** Label legible. */
  label:    string;
  /** "ok" | "partial" | "missing" | "skipped". */
  status:   "ok" | "partial" | "missing" | "skipped";
  /** Valor del paso, formateado por el motor (string). null cuando no aplica. */
  value:    string | null;
  /** Mensaje opcional (warning, explicación). */
  message?: string;
  /** Metadata estructurada del paso (varía por key). */
  meta?:    Record<string, unknown>;
};

/** Paso del cálculo del CHECKOUT (recargo de pago / cuotas). */
export type NormalizedCheckoutStep = {
  /** Código estable (ej. "PAYMENT_ADJUSTMENT"). */
  code:         string;
  /** Label legible. */
  label:        string;
  /** Fórmula explicativa (ej. "12 cuotas × 8.5%"). */
  formula:      string;
  /** Monto del paso. */
  amount:       number;
  /** Código de la moneda en la que se expresa `amount`. */
  currencyCode: string;
};

/** Origen del breakdown Metal/Hechura. Permite distinguir cuándo los
 *  componentes son exactos vs derivados por el motor backend. */
export type NormalizedMetalHechuraBreakdownSource =
  | "METAL_HECHURA"
  | "PROPORTIONAL_COST"
  | "MANUAL_AS_HECHURA"
  | "SERVICE_AS_HECHURA"
  | "COMBO_COMPONENTS"
  | "NONE";

/** Desglose Metal/Hechura — desde FASE 1 del refactor BREAKDOWN, el backend
 *  lo popula universalmente (no solo en lista MH). El frontend hace
 *  passthrough puro: cero matemática comercial.
 *
 *  - `source`: cómo llegó el motor al breakdown (exacto / derivado / etc.).
 *  - `metalSaleEstimated` / `hechuraSaleEstimated`: true cuando el motor lo
 *    derivó por proporción de costo. La UI muestra badge "Estimado". */
export type NormalizedMetalHechuraBreakdown = {
  metalCost:         number;
  metalSale:         number;
  metalMarginPct:    number;
  hechuraCost:       number;
  hechuraSale:       number;
  hechuraMarginPct:  number;
  /** Gramos con merma usados en el costo (base real antes del margen). */
  metalGramsBase?:    number | null;
  /** Gramos de venta = metalGramsBase × (1 + metalMarginPct/100). */
  metalGramsSale?:    number | null;
  /** Precio por gramo base = metalCost / metalGramsBase. */
  metalPricePerGram?: number | null;
  /** FASE 1 — true cuando metalSale fue derivado por proporción de costo. */
  metalSaleEstimated?:   boolean;
  /** FASE 1 — análogo para hechura. */
  hechuraSaleEstimated?: boolean;
  /** FASE 1 — trazabilidad del origen del breakdown. */
  source?: NormalizedMetalHechuraBreakdownSource;
};

/** Tipo de capa que generó un ajuste sobre un componente. */
export type NormalizedComponentAdjustmentKind =
  | "QUANTITY_DISCOUNT"
  | "PROMOTION"
  | "ENTITY_RULE"
  | "MANUAL_DISCOUNT";

/** Un ajuste imputado a un componente (Metal o Hechura). `amount` es positivo
 *  cuando reduce el precio (descuento) y negativo cuando lo aumenta (recargo).
 *  Los opcionales (`base`, `percentage`, ...) los popula el motor cuando tiene
 *  la metadata; permiten mostrar la fórmula sin recalcular en el frontend. */
export type NormalizedComponentSaleAdjustment = {
  kind:        NormalizedComponentAdjustmentKind;
  label:       string;
  amount:      number;
  applyOn:     "METAL" | "HECHURA";
  base?:       number | null;
  percentage?: number | null;
  valueType?:  "PERCENTAGE" | "FIXED_AMOUNT" | string | null;
  source?:     "CLIENT" | "GENERAL" | string | null;
};

export type NormalizedComponentSaleBreakdown = {
  base:        number;
  adjustments: NormalizedComponentSaleAdjustment[];
  final:       number;
  /**
   * F1.3 G4.3 — valor del componente ANTES del ajuste manual del operador.
   *
   * Tooltip recomendado: "Valor antes del ajuste manual del operador.".
   *
   * Threshold visual (regla de la UI, no del backend):
   *   - Si `salePreManualDiscount === final` ⇒ NO mostrar fila "Pre-bonif."
   *     (cero ruido visual, cero duplicación).
   *   - Si `salePreManualDiscount === null` ⇒ snapshot v3 / sin breakdown
   *     manual → tampoco se muestra.
   *
   * Passthrough puro: el frontend nunca calcula este campo. Si el backend no
   * lo emite (snapshot viejo), queda `null` y la UI degrada a sin fila.
   */
  salePreManualDiscount: number | null;
};

/** Desglose Metal/Hechura post-descuentos por componente. Mismo origen que
 *  NormalizedMetalHechuraBreakdown pero con base + adjustments + final por
 *  componente. Solo descuentos `applyOn = METAL | HECHURA` se imputan acá;
 *  los descuentos a nivel TOTAL se muestran fuera del desglose. */
export type NormalizedComponentSaleDetail = {
  metal:   NormalizedComponentSaleBreakdown;
  hechura: NormalizedComponentSaleBreakdown;
};

/** Contexto de overrides de composición de costo aplicados al preview.
 *  Sirve para mostrar "Original X / Usado Y" sin re-fetch del artículo. */
export type NormalizedCostOverrideContext = {
  grams?:        { original: number | null; applied: number | null; manual: boolean };
  mermaPercent?: { original: number | null; applied: number | null; manual: boolean };
  metalVariant?: { originalId: string | null; appliedId: string | null; manual: boolean };
  hechura?:      { original: number | null; applied: number | null; manual: boolean };
};

/** Modo de stacking cuando coexisten descuento por cantidad y promoción. */
export type NormalizedStackingMode = "CHAINED" | "BEST_OF_QD" | "BEST_OF_PROMO" | "NONE";

/**
 * Una línea normalizada — una entrada por cada `lines[i]` del payload.
 * Los importes están en escala UNITARIA (monto por unidad) salvo `lineTotal*`
 * que ya están multiplicados × qty.
 */
export type NormalizedPricingLine = {
  articleId:        string;
  variantId:        string | null;
  quantity:         number;

  // Precios (unitarios)
  basePrice:        number | null;
  unitPrice:        number | null;
  unitTaxAmount:    number;
  unitTotalWithTax: number | null;

  // Descuentos (unitarios)
  quantityDiscountAmount:  number;
  promotionDiscountAmount: number;

  // Totales de línea (× qty, ya redondeados por el motor)
  lineTotal:        number | null;
  lineTaxAmount:    number;
  lineTotalWithTax: number | null;
  lineDiscount:     number;

  // Fuentes y metadatos
  priceSource:          string;
  appliedPriceListId:   string | null;
  appliedPriceListName: string | null;
  /** Modo de la lista aplicada (METAL_HECHURA, MARGIN_TOTAL, etc.). Permite
   *  a la UI elegir el render correcto sin leer steps[].meta.mode. */
  appliedPriceListMode?: string | null;
  appliedPromotionId:   string | null;
  appliedPromotionName: string | null;
  appliedDiscountId:    string | null;

  // Costo y margen
  unitCost:      number | null;
  unitMargin:    number | null;
  marginPercent: number | null;
  costMode:      string;
  costPartial:   boolean;

  // Impuestos y redondeo
  taxBreakdown:    NormalizedTaxBreakdownItem[];
  appliedRounding: NormalizedAppliedRounding | null;

  // Estado
  partial: boolean;
  /** true cuando la entidad seleccionada tiene impuestos desactivados. */
  taxExemptByEntity?: boolean;

  // ── Fase 2.1 — paridad de info por línea ────────────────────────────────
  /** Bloque metal/hechura/taxes — armado por el helper compartido del
   *  backend (`pricing-composition.ts`). En articles SIEMPRE viene; en sales
   *  viene desde Fase 2A.7. */
  composition?: NormalizedComposition | null;
  /** Atajo de `composition.metal.appliedMermaPct`. */
  appliedMermaPercent?: number | null;
  /** Costo de compra (purchase taxes) — articles desde siempre, sales desde
   *  Fase 2A.7. */
  costBase?:         number | null;
  costTaxAmount?:    number | null;
  costWithTax?:      number | null;
  costTaxBreakdown?: NormalizedPurchaseTaxItem[];

  // ── Fase 2.1.b ──────────────────────────────────────────────────────────
  /** Desglose Metal/Hechura completo — articles result-level → línea[0],
   *  sales lines[i] desde Fase 2A.7. */
  metalHechuraBreakdown?: NormalizedMetalHechuraBreakdown | null;
  /** Desglose Metal/Hechura post-descuentos por componente. Permite mostrar
   *  el card "Hechura" con base + ajustes + final sin recalcular en frontend.
   *  Null cuando el motor no resuelve desglose por componente (lista en
   *  modo MARGIN_TOTAL, precio manual, etc.). */
  componentSaleBreakdown?: NormalizedComponentSaleDetail | null;
  /** Contexto de overrides de costo aplicados (grams/merma/metal/hechura).
   *  Articles lo expone, sales todavía no. */
  costOverrideContext?: NormalizedCostOverrideContext | null;

  // ── Componentes de costo PRODUCT/SERVICE (paso 6) ───────────────────────
  // Derivados de `steps[]` con key `COST_LINES_PRODUCT` y `COST_LINES_SERVICE`.
  // Cada elemento es una línea de la composición de costo del artículo. Los
  // componentes UI (Simulador, Comparador, Factura) deben leer de acá en
  // lugar de filtrar `steps[]` raw.
  //
  // Hoy solo articles/pricing-preview expone `steps[]` por línea — sales/preview
  // todavía no, así que en el flujo SALES_PREVIEW estos arrays vienen vacíos.
  /** Líneas de costo tipo PRODUCT (artículos referenciados como insumo). */
  products: NormalizedCostComponent[];
  /** Líneas de costo tipo SERVICE (servicios referenciados como insumo). */
  services: NormalizedCostComponent[];
};

/** Línea individual de la composición de costo (PRODUCT o SERVICE). */
export type NormalizedCostComponent = {
  /** Total de la línea = qty × unitValue (post-ajuste por línea). En moneda
   *  base del tenant. Coincide con `step.value`. */
  value:    number;
  /** Cantidad de la línea. null si el step no la expone. */
  quantity: number | null;
  /** Valor unitario (en la moneda en que se cargó la línea — puede no ser la
   *  base si hubo conversión). null si el step no la expone. */
  unitValue: number | null;
  /** Etiqueta legible — `meta.lineLabel` o el `label` del step como fallback. */
  label:    string | null;
  /** Código (sku) del artículo referenciado, cuando la línea apunta al catálogo. */
  code:     string | null;
  /** Ajuste por línea (bonificación / recargo) si aplica. */
  adjustment: {
    kind:  string;     // "BONUS" | "SURCHARGE"
    type:  string;     // "PERCENTAGE" | "FIXED_AMOUNT"
    value: number;
  } | null;
};

/**
 * Resultado normalizado del preview. Mismo shape sirve para una línea
 * (Simulador) o un documento (Factura). Para 1 línea, `lines[0]` es la línea
 * y `documentTotals` es la suma trivial.
 */
export type NormalizedPricingResult = {
  /** Endpoint efectivamente consultado, para trazabilidad. */
  source: "ARTICLE_PRICING_PREVIEW" | "SALES_PREVIEW";

  lines: NormalizedPricingLine[];

  // ── Capas de documento ────────────────────────────────────────────────────
  channel:  NormalizedChannelInfo  | null;
  coupon:   NormalizedCouponInfo   | null;
  payment:  NormalizedPaymentInfo  | null;
  shipping: NormalizedShippingInfo | null;

  // ── Totales del documento (per-doc, qty-aware) ────────────────────────────
  documentTotals: {
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
    /**
     * Ajuste de redondeo agregado a nivel documento.
     *
     * Dos fuentes posibles según `roundingInfo.source`:
     *   - `PRICE_LIST`: suma de redondeos de las líneas (display delta, el
     *     motor ya lo absorbió en `lineTotal`/`lineTotalWithTax`). El `total`
     *     no cambia por este valor.
     *   - `TENANT_POLICY`: delta real del redondeo a nivel comprobante
     *     (modo UNIFIED). El `total` SÍ refleja este delta.
     */
    roundingAdjustment:         number;
    totalBeforeTax:             number;
    totalWithTax:               number;
    /** Total final que la UI debe mostrar como "Total documento". */
    total:                      number;

    // FASE 2 — Agregados Metal/Hechura a nivel documento (informativos).
    // Suman los `metalCost / hechuraCost / metalSale / hechuraSale` de cada
    // línea. Si ninguna línea trae breakdown → todos en 0 y
    // `breakdownEstimated = false`.
    metalCostSubtotal?:    number;
    hechuraCostSubtotal?:  number;
    metalSaleSubtotal?:    number;
    hechuraSaleSubtotal?:  number;
    /** true si al menos una línea reporta `*Estimated=true`. */
    breakdownEstimated?:   boolean;
  };

  /**
   * Metadata global del redondeo aplicado al documento. `null` cuando no hubo
   * redondeo. Soporta dos fuentes:
   *   - `PRICE_LIST`: alguna línea tuvo redondeo de lista activo.
   *   - `TENANT_POLICY`: política UNIFIED del tenant (`Jewelry.documentRoundingEnabled`)
   *     redondeó el total del comprobante.
   */
  roundingInfo: {
    source:        "PRICE_LIST" | "TENANT_POLICY";
    priceListId:   string | null;
    priceListName: string | null;
    applyOn:       string;
    mode:          string;
    direction:     string;
  } | null;

  /**
   * Detalle del redondeo a nivel comprobante (modo UNIFIED). `null` si la
   * política está apagada o el delta fue 0. Útil para mostrar en debug/dev
   * el preRounding ↔ postRounding sin recalcular.
   */
  documentRoundingApplied?: {
    source?:       string;     // "TENANT_POLICY"
    applyOn?:      string;     // "DOC_TOTAL"
    mode?:         string;
    direction?:    string;
    preRounding?:  number;
    postRounding?: number;
    adjustment?:   number;
  } | null;

  /** Política de la venta + alertas. */
  policy: { canConfirm: boolean; blockingAlerts: string[] };
  alerts: Array<{ code: string; level: "info" | "warning" | "error"; message: string }>;

  // ── Fase 2.1.b — pasos y modo de stacking (articles los expone) ─────────
  /** Pasos del cálculo del motor — para mostrar trazabilidad en UI. */
  steps?: NormalizedPricingStep[];
  /** Modo de resolución cuando coexisten descuento por cantidad y promoción. */
  stackingMode?: NormalizedStackingMode;

  // ── Fase 2.1 — info doc-level del cliente y de la lista resuelta ────────
  /** balanceType del cliente (UNIFIED/BREAKDOWN). null si no hay cliente o
   *  el endpoint no lo expuso (articles aún no — Fase 2A.8). */
  clientBalanceType?:    string | null;
  /** Reglas comerciales del cliente — null si no hay cliente o no expuesto. */
  clientCommercialRules?: NormalizedClientCommercialRules | null;
  /** Eco del `priceListId` doc-level que el operador eligió (si lo pasó). */
  requestedPriceListId?:  string | null;
  /** Lista efectivamente aplicada consolidada (línea o doc):
   *   - articles: el id de la línea (1 sola).
   *   - sales:    "MIXED" si las líneas usaron distintas, sino el id común. */
  appliedPriceListId?:    string | null;
  /** Nombre legible. "Múltiples" cuando es "MIXED". */
  appliedPriceListName?:  string | null;
  /** true si se pidió override (doc o por línea), independientemente de si
   *  el motor lo respetó. */
  priceListWasOverridden?: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de tipo público
// ─────────────────────────────────────────────────────────────────────────────

/** Identificador del endpoint que se va a consultar. */
export type PricingPreviewEndpoint = "ARTICLE_PRICING_PREVIEW" | "SALES_PREVIEW";

/** Usado por el helper de build para decidir el adapter. */
export type PricingPreviewMode = {
  /**
   * "ARTICLE" → un solo ítem (Simulador, Comparador del lado simulador).
   *   Restringe `lines.length` a 1 y permite los overrides de costo del
   *   Simulador (gramsOverride, etc.).
   *
   * "SALES"   → documento con N líneas (Factura, Comparador del lado factura).
   */
  endpoint: PricingPreviewEndpoint;
};
