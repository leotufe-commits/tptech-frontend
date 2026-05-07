// src/lib/document-types.ts
// ============================================================================
// Tipos unificados para documentos comerciales del sistema TPTech.
//
// Este archivo consolida las familias de tipos que hoy están duplicadas en
// las pantallas de Ventas/Compras/Finanzas. Las pantallas existentes todavía
// usan sus tipos locales — Fase B migrará cada una a estos unificados.
//
// El objetivo es que Ventas y Compras compartan los mismos tipos:
//   · cambia el rol de la contraparte (CLIENT / SUPPLIER)
//   · cambia la dirección del documento (OUTBOUND / INBOUND)
//   · el shape de líneas, medios y aplicaciones es idéntico
// ============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// 0. Tone visual compartido
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vocabulario de tones usado a lo largo del sistema (TPBadge, TPKpiBar,
 * TPStatusPill). Se declara acá para que `DOCUMENT_STATUS_TONE` no tenga que
 * importar desde un componente visual específico.
 */
export type DocumentTone =
  | "neutral"
  | "primary"
  | "info"
  | "success"
  | "warning"
  | "danger";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Estados canónicos de documentos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estados canónicos. Consolidan los 9 enums locales que hoy existen en las
 * pantallas de Ventas y Compras. Cada pantalla usa un subconjunto:
 *
 *   · Órdenes (compra/venta):          DRAFT · SENT · CONFIRMED · PARTIAL · DELIVERED · CLOSED · CANCELLED
 *   · Presupuestos:                     DRAFT · SENT · APPROVED · REJECTED
 *   · Recepciones / Entregas:           DRAFT · CONFIRMED · PARTIAL · CANCELLED
 *   · Facturas (cliente / proveedor):   DRAFT · PENDING · PARTIAL · PAID · CANCELLED
 *   · Pagos / Cobros:                   DRAFT · UNAPPLIED · PARTIAL · APPLIED · CANCELLED
 *
 * Se incluye `PARTIALLY_PAID` como alias legacy de `PARTIAL` para que la
 * migración de ComprasFacturasProveedor (que usa ese valor) sea transparente.
 */
export type DocumentStatus =
  | "DRAFT"
  | "SENT"
  | "CONFIRMED"
  | "PARTIAL"
  | "PARTIALLY_PAID"   // alias legacy — equivalente a PARTIAL
  | "APPROVED"
  | "REJECTED"
  | "PENDING"
  | "PAID"
  | "APPLIED"
  | "UNAPPLIED"
  | "DELIVERED"
  | "CLOSED"
  | "CANCELLED";

/**
 * Mapa canónico de tone por estado. Alinea visualmente las 10 pantallas
 * ignorando diferencias menores que existen hoy.
 *
 * Notas de consolidación:
 *   · CONFIRMED queda como `info` (pantallas actuales varían — algunas usan
 *     success). La convención canónica: "confirmado" ≠ "éxito final"; éxito
 *     final es DELIVERED/CLOSED/PAID/APPLIED.
 *   · PARTIAL queda como `warning` (algo pendiente). Algunas pantallas usan
 *     `info` — Fase B decidirá si se actualizan al canónico o mantienen local.
 *   · PARTIALLY_PAID se mapea igual que PARTIAL.
 */
export const DOCUMENT_STATUS_TONE: Record<DocumentStatus, DocumentTone> = {
  DRAFT:          "neutral",
  SENT:           "info",
  CONFIRMED:      "info",
  PARTIAL:        "warning",
  PARTIALLY_PAID: "warning",
  APPROVED:       "success",
  REJECTED:       "danger",
  PENDING:        "warning",
  PAID:           "success",
  APPLIED:        "success",
  UNAPPLIED:      "warning",
  DELIVERED:      "success",
  CLOSED:         "success",
  CANCELLED:      "danger",
};

/**
 * Labels en español de cada estado. Fase B los usa por default en el
 * componente `TPStatusBadge`, pero cada pantalla puede pasar un `label`
 * explícito si quiere decir "Enviada" en vez de "Enviado", etc.
 */
export const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, string> = {
  DRAFT:          "Borrador",
  SENT:           "Enviado",
  CONFIRMED:      "Confirmada",
  PARTIAL:        "Parcial",
  PARTIALLY_PAID: "Parcial",
  APPROVED:       "Aprobado",
  REJECTED:       "Rechazado",
  PENDING:        "Pendiente",
  PAID:           "Pagada",
  APPLIED:        "Aplicado",
  UNAPPLIED:      "Sin aplicar",
  DELIVERED:      "Entregada",
  CLOSED:         "Cerrada",
  CANCELLED:      "Anulada",
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Línea comercial (Presupuestos, Órdenes, Facturas)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Línea comercial base. Reemplaza:
 *   · POLine (ComprasOrdenes)
 *   · QuoteLine (VentasPresupuestos)
 *   · SalesOrderLine (VentasOrdenes)
 *   · SupplierInvoiceLine (ComprasFacturasProveedor)
 *   · SalesInvoiceLine (VentasFacturas)
 *
 * Los campos `taxAmount` y `lineTotal` son opcionales para que:
 *   · Órdenes/Presupuestos puedan omitirlos (si la card de totales hace el
 *     cálculo global del IVA).
 *   · Facturas los usen cuando el IVA se imputa a nivel línea.
 *
 * Convención de nombres:
 *   · `article` / `variant` → texto libre de identidad (reemplazable por
 *     selectores reales en Fase C).
 *   · `subtotal` = qty × unitPrice − discountAmount (antes de impuestos).
 *   · `lineTotal` = subtotal + taxAmount (cuando el IVA va por línea).
 */
export type DocumentLineType = "ARTICLE" | "HEADER";

export interface DocumentLine {
  id: string;
  /**
   * Tipo de línea. Default: "ARTICLE" (línea comercial). "HEADER" agrupa
   * visualmente las líneas siguientes hasta la próxima cabecera; no participa
   * en cálculos.
   */
  type?: DocumentLineType;
  /** Sólo para `type === "HEADER"`: título visible de la sección. */
  title?: string;
  /** Sólo para `type === "HEADER"` generado automáticamente: criterio que
   *  produjo esta cabecera. Sin este flag, la cabecera es 100% manual. */
  headerGroupBy?: "CATEGORY" | "BRAND" | "GROUP" | "METAL" | "ARTICLE_TYPE" | "MANUFACTURER";
  /** Sólo para HEADER generado: valor que originó la cabecera (ej. "Oro 18k"
   *  cuando `headerGroupBy === "METAL"`). El `title` arranca igual a este
   *  valor pero el operador puede editarlo. */
  headerSourceValue?: string;
  /** Sólo para HEADER: `true` cuando el operador editó el `title`
   *  manualmente. Al regenerar cabeceras por criterio, las que tienen
   *  este flag NO se sobreescriben. */
  headerEditedByUser?: boolean;
  /**
   * Línea manual: texto libre sin artículo del catálogo. No pasa por el
   * pricing-engine — el precio es siempre override manual del usuario. */
  isManual?: boolean;
  /** Texto que el usuario escribió como descripción de la línea manual. */
  manualDescription?: string;
  /**
   * Solo para líneas manuales — porcentaje de impuesto aplicado por defecto
   * al crearla (favorito del tenant para venta). Se preserva para que al
   * editar `quantity`, `unitPrice` o `discountAmount` se pueda recalcular
   * `taxAmount` consistentemente sin volver a consultar el catálogo de taxes. */
  manualTaxRate?: number;
  /**
   * Opcional — id del artículo del catálogo. Permite dedupe seguro al escanear
   * (vs. matchear sólo por nombre de artículo). Fase 7 lo poblará desde el
   * pricing-engine; hoy lo usan los flujos de escaneo.
   */
  articleId?: string;
  /** Id de la variante del catálogo (si el artículo tiene variantes). */
  variantId?: string;
  /** SKU del artículo o de la variante seleccionada. */
  sku?: string;
  /** Tipo semántico del ítem en la línea (mapping al backend Receipt). */
  itemKind?: "ARTICLE_SIMPLE" | "ARTICLE_VARIANT" | "SERVICE" | "COMBO";
  article: string;
  variant: string;
  /** URL de thumbnail del artículo. Visual; placeholder si vacío. */
  imageUrl?: string;
  /** Galería completa de imágenes para el lightbox. Si vacía, se usa imageUrl. */
  images?: string[];
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  /** Calculado: qty × unitPrice − discountAmount, clamped a 0. */
  subtotal: number;
  /** Opcional — solo usado cuando el IVA se imputa por línea. */
  taxAmount?: number;
  /** Opcional — solo usado cuando el IVA se imputa por línea: subtotal + taxAmount. */
  lineTotal?: number;
  /**
   * Opcional — total de la línea CON impuestos (qty × unitTotalWithTax).
   * Lo provee el backend (`SalePreviewLine.lineTotalWithTax`); el frontend lo
   * propaga vía `selectInvoiceLineView`. Permite que el editor muestre el
   * total con impuestos como valor principal sin recomputar `lineTotal +
   * taxAmount` (que perdería el redondeo del motor en algunos casos). */
  lineTotalWithTax?: number;
  /** Texto libre opcional (descripción/comentario que el usuario agrega a la línea). */
  description?: string;
  /**
   * Snapshot liviano de metadatos del artículo poblado al CARGAR la línea
   * (vía `addLineFromArticle` desde el catálogo). Se usa exclusivamente
   * para generar cabeceras automáticas (`getHeaderLabelForLine`) sin
   * runtime fetch. NO se envía al pricing-engine ni afecta cálculos.
   */
  headerSnapshot?: {
    categoryName?: string;
    groupName?:    string;
    brand?:        string;
    manufacturer?: string;
  };
  /** Opcional — almacén desde el que se descuenta el stock para esta línea. */
  warehouseId?: string;
  /**
   * Override de almacén por línea. `true` significa que el operador eligió
   * un almacén distinto al global del documento — al cambiar el global, esta
   * línea NO se reescribe. Sin este flag, la línea sigue el almacén del
   * documento (cascada). El reset lo borra. */
  warehouseOverride?: boolean;
  /**
   * Override de lista de precios por línea. `null`/`undefined` significa
   * "usar la lista global del documento" (fallback al cliente / favorita
   * del tenant cuando tampoco hay lista de documento).
   *
   * Precedencia (resuelta por el backend):
   *   line.priceListIdOverride > document.priceListId > client.priceListId
   *   > category default > GENERAL favorita.
   *
   * Cambiar la lista global del documento NO debe pisar este campo: las
   * líneas con override conservan su lista hasta que el operador
   * explícitamente la limpie ("Usar lista global"). */
  priceListIdOverride?: string | null;
  /**
   * Flag explícito de override de lista. Es redundante con
   * `priceListIdOverride != null` (donde la presencia del valor implica
   * override), pero lo expone aparte para alinear el modelo con
   * `warehouseOverride` y futuros overrides de contexto, y para que el
   * editor pueda distinguir "el operador deshizo el override pero la
   * línea quedó con un id residual" si se diera. El reset lo limpia. */
  priceListOverride?: boolean;
  /**
   * Metadatos de la última resolución de precio. Llenado por el motor real
   * (`articlesApi.getPricingPreview`) — sirve para mostrar origen ("Lista
   * Mayorista", "Promo Black Friday", "Manual"), partial flag, costo y
   * composición sin volver a pegar al backend.
   */
  pricingMeta?: {
    priceSource?:           string;   // PRICE_LIST | PROMOTION | MANUAL_OVERRIDE | etc.
    baseSource?:            string;
    appliedPriceListId?:    string | null;
    appliedPriceListName?:  string | null;
    appliedPromotionId?:    string | null;
    appliedPromotionName?:  string | null;
    /** Precio base antes de descuentos (lista). */
    basePrice?:             number | null;
    /** Descuento por cantidad (separado del global). */
    quantityDiscountAmount?: number | null;
    /** Descuento por promoción (separado del global). */
    promotionDiscountAmount?: number | null;
    /** Costo unitario y margen (si el backend lo resolvió). */
    unitCost?:              number | null;
    unitMargin?:            number | null;
    marginPercent?:         number | null;
    /** Composición metal / hechura (si el artículo la tiene). */
    metalCost?:             number | null;
    metalSale?:             number | null;
    hechuraCost?:           number | null;
    hechuraSale?:           number | null;
    /**
     * Desglose post-descuentos por componente (sale-side). El motor expone
     * `base + adjustments[] + final` por cada componente (metal / hechura).
     * `adjustments[]` lista cada ajuste aplicado con su monto absoluto:
     * MANUAL_DISCOUNT (bonificación del operador), ENTITY_RULE (descuento
     * de cliente), QUANTITY_DISCOUNT, PROMOTION, etc.
     *
     * El frontend SOLO lee — no recalcula. POLICY.md §4 R4.5.
     *
     * GAP G3.5 (no abierto todavía) — el backend debería exponer también
     * un "valor venta antes de bonificación" per-componente para que la UI
     * pueda mostrar la cadena cost → margin → pre-bonif → bonif → sale
     * sin riesgo de mezcla cost/sale-side.
     */
    componentSaleBreakdown?: {
      metal?:   {
        base?: number;
        final?: number;
        /** F1.3 G4.3 — valor pre-bonif. del componente (sale-side). null si
         *  el snapshot es viejo (v3) o si el motor no lo pudo derivar. La UI
         *  solo lo muestra cuando `salePreManualDiscount != null && !== final`
         *  (threshold visual — POLICY R4.5, sin matemática frontend). */
        salePreManualDiscount?: number | null;
        adjustments?: Array<{
          kind:    string;
          label?:  string;
          amount:  number;
          applyOn: string;
          base?:        number | null;
          percentage?:  number | null;
          valueType?:   string | null;
          source?:      string | null;
        }>;
      };
      hechura?: {
        base?: number;
        final?: number;
        salePreManualDiscount?: number | null;
        adjustments?: Array<{
          kind:    string;
          label?:  string;
          amount:  number;
          applyOn: string;
          base?:        number | null;
          percentage?:  number | null;
          valueType?:   string | null;
          source?:      string | null;
        }>;
      };
    } | null;
    /** El motor no pudo resolver completamente (faltan inputs). */
    partial?:               boolean;
    /** Cliente exento de IVA → impuestos no aplicados. */
    taxExemptByEntity?:     boolean;
    /**
     * Desglose de impuestos resuelto por el backend. Para que la UI muestre la
     * tasa REAL (ej. IVA 21%) en vez de inferir un porcentaje sobre la base.
     * Si hay un solo ítem → usar su `rate` directo; si hay varios → mostrar
     * label "Varios" y sumar montos.
     */
    taxBreakdown?:          Array<{ name: string; rate: number | null; taxAmount: number }>;
    /**
     * Total UNITARIO con impuestos resuelto por el backend
     * (`preview.totalWithTax`). Incluye el redondeo del motor (ej. 101.000 en
     * lugar de 101.026,48). El frontend lo usa para calcular `line.lineTotal`
     * = qty × unitTotalWithTax sin reconstruirlo desde subtotal+taxAmount,
     * preservando así el redondeo final del pricing-engine.
     */
    unitTotalWithTax?:      number | null;
    /**
     * Override manual del impuesto a nivel línea (edición controlada). Cuando
     * está seteado, el siguiente refetch contra el backend lo manda como
     * parámetro y el motor reemplaza el cálculo. Mientras el toggle "Editar
     * impuestos" esté ON, el override persiste; al apagarlo se borra y el
     * motor vuelve a usar los impuestos configurados.
     */
    taxOverride?: {
      mode:      "PERCENT" | "AMOUNT";
      value:     number;
      appliesTo?: "METAL" | "HECHURA" | "PRODUCT" | "SERVICE" | "TOTAL";
    } | null;
    /**
     * Override manual del precio neto unitario. Pisa el resultado de la
     * lista y deshabilita qty discount + promotion. El refetch al backend
     * manda este valor como `manualPriceOverride` query param.
     */
    manualPrice?: number | null;
    /**
     * Override manual del descuento sobre el precio de lista. Reemplaza qty
     * discount + promotion. Ignorado si también hay `manualPrice`.
     */
    manualDiscount?: {
      mode:      "PERCENT" | "AMOUNT";
      value:     number;
      appliesTo?: "METAL" | "HECHURA" | "PRODUCT" | "SERVICE" | "TOTAL";
    } | null;

    /**
     * Overrides de COMPOSICIÓN DE COSTO a nivel línea (Fase 2). NO modifican
     * el artículo en DB — el motor opera sobre una copia. Cada uno es
     * opcional. `null` significa "no override, usar el del artículo".
     */
    gramsOverride?:          number | null;
    mermaPercentOverride?:   number | null;
    metalVariantIdOverride?: string | null;
    hechuraOverrideAmount?:  number | null;

    /**
     * Contexto de comparación: valores ORIGINALES del artículo + APLICADOS
     * en el preview. Lo devuelve el backend (`costOverrideContext`) para
     * que la UI muestre "Original X / Usado en factura Y" sin re-fetch.
     */
    costOverrideContext?: {
      grams?:        { original: number | null; applied: number | null; manual: boolean };
      mermaPercent?: { original: number | null; applied: number | null; manual: boolean };
      metalVariant?: { originalId: string | null; appliedId: string | null; manual: boolean };
      hechura?:      { original: number | null; applied: number | null; manual: boolean };
    } | null;
    /**
     * Estructura plana de composición (METAL / HECHURA / IMPUESTOS). Lo
     * arma el backend en `composition`. La UI lo consume directo para los
     * 3 bloques del panel, sin recombinar.
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
       *  Backend v5+ emite arrays. Snapshots v4 sin este campo se
       *  normalizan a `[metal]` (legacy) o `[]`. */
      metals?: Array<{
        costLineId:        string | null;
        metalVariantId:    string | null;
        metalName:         string | null;
        purity:            number | null;
        purityLabel:       string | null;
        appliedGrams:      number | null;
        appliedMermaPct:   number | null;
        lineCost:          number | null;
      }>;
      /** F1.3 G4.x #9-B — TODAS las cost lines de tipo HECHURA. Mismo patrón. */
      hechuras?: Array<{
        costLineId:        string | null;
        appliedAmount:     number | null;
        lineCost:          number | null;
        lineLabel:         string | null;
      }>;
      /** F1.3 G4.1 — items de cost lines de tipo PRODUCT (insumos / piedras
       *  / etc.). El backend emite uno por cost line. Vacío en snapshots
       *  viejos (v3) o cuando el artículo no tiene PRODUCT lines. La UI hace
       *  passthrough puro: cero matemática derivada (POLICY R4.5). */
      products?: Array<{
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
      }>;
      /** F1.3 G4.1 — items de cost lines de tipo SERVICE (engaste, mano
       *  de obra externa, etc.). Mismo shape y reglas que `products`. */
      services?: Array<{
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
    } | null;
    /** Última vez que se calculó (timestamp). Para debounce / staleness. */
    resolvedAt?:            number;
    /**
     * Override manual: el usuario fijó el unitPrice (vía edición directa o
     * "Aplicar simulador a la línea"). Mientras esté `true`, los flujos de
     * refetch automático (cambio de cantidad / lista / moneda / cliente)
     * NO pisan el precio. Para recalcular, hay que limpiarlo explícitamente
     * (reset línea, reset documento o aceptar el prompt de "líneas manuales").
     */
    manualOverride?:        boolean;
  };
  /**
   * Flags por campo: marca QUE COLUMNA editó el usuario manualmente. Mientras
   * el flag esté en `true`, ese campo viaja al backend como override
   * (manualPriceOverride / manualDiscountOverride / taxOverride) y la
   * respuesta del preview NO lo pisa al rehidratar.
   *
   * Se limpian SOLO cuando:
   *   · el usuario cambia `articleId` / `variantId` de la línea, o
   *   · el usuario invoca la acción "Restablecer línea".
   */
  manualOverrides?: {
    /** El usuario fijó la cantidad manualmente. */
    quantity?: boolean;
    /** El usuario fijó el precio neto unitario. */
    price?:    boolean;
    /** El usuario fijó la bonificación. */
    discount?: boolean;
    /** El usuario fijó el impuesto. */
    tax?:      boolean;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Línea de movimiento (Recepciones, Entregas)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Línea de movimiento. Reemplaza:
 *   · ReceiptLine (ComprasRecepciones): alreadyReceivedQty / receivingQty
 *   · DeliveryLine (VentasEntregas):     alreadyDeliveredQty / deliveringQty
 *
 * Se unifica con nombres genéricos:
 *   · `alreadyMovedQty` → cantidad ya movida en documentos anteriores.
 *   · `movingQty`       → cantidad a mover en este documento.
 *
 * El componente editor (Fase B: `TPMovementLinesEditor`) tomará `direction`
 * (IN/OUT) para renderizar los labels correctos ("Recibido" vs "Entregado").
 */
export interface MovementLine {
  id: string;
  article: string;
  variant: string;
  /** Cantidad pedida en la orden origen (OC para IN, OV para OUT). */
  orderedQty: number;
  /** Cantidad ya movida en recepciones/entregas previas. */
  alreadyMovedQty: number;
  /** Cantidad a mover en este documento. */
  movingQty: number;
}

/** Dirección del movimiento — usada por el editor unificado de líneas. */
export type MovementDirection = "IN" | "OUT";

// ─────────────────────────────────────────────────────────────────────────────
// 4. Medios de pago / cobro (Pagos proveedor, Cobros cliente)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tipos de medio de pago/cobro. Enum estricto que reemplaza los enums
 * duplicados de ComprasPagosProveedor (PaymentComponentType) y VentasCobros
 * (ReceiptComponentType).
 */
export type PaymentComponentType =
  | "CASH"       // efectivo
  | "TRANSFER"   // transferencia (CBU, alias, PIX, SWIFT, QR interop.)
  | "CARD"       // tarjeta débito/crédito
  | "USD"        // dólares
  | "ARS"        // pesos argentinos
  | "METAL"      // oro, plata u otro metal
  | "OTHER";     // otro / ajuste

/** Labels en español de cada tipo de medio. */
export const PAYMENT_COMPONENT_LABEL: Record<PaymentComponentType, string> = {
  CASH:     "Efectivo",
  TRANSFER: "Transferencia",
  CARD:     "Tarjeta",
  USD:      "USD",
  ARS:      "ARS",
  METAL:    "Metal (oro/plata)",
  OTHER:    "Otro",
};

/**
 * Componente de pago/cobro.
 *
 * Unifica `PaymentComponent` (ComprasPagosProveedor) y `ReceiptComponent`
 * (VentasCobros) — ambos tipos son literalmente idénticos hoy.
 *
 * El campo `amount` se interpreta según el tipo:
 *   · CASH/TRANSFER/CARD/USD/ARS/OTHER → monto en la moneda del componente.
 *   · METAL → gramos (la moneda se suele poner "g" para trazabilidad).
 *
 * Campos opcionales reservados para Fase 6:
 *   · `metalVariantId` + `gramsPure` para componentes METAL.
 *   · `installments` + `surchargeAmount` para CARD.
 *   · `checkBank` + `checkDueDate` para CHECK (si se agrega el tipo).
 */
export interface PaymentComponent {
  id: string;
  type: PaymentComponentType;
  amount: number;
  currency: string;
  reference: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Aplicación a facturas (Pagos proveedor, Cobros cliente)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aplicación de un pago/cobro a una factura específica.
 *
 * Unifica `PaymentAllocation` (ComprasPagosProveedor) y `ReceiptAllocation`
 * (VentasCobros) — ambos tipos son idénticos hoy.
 *
 * Reglas (validadas en las pantallas al guardar):
 *   · `amountApplied ≥ 0`
 *   · `amountApplied ≤ invoicePending`
 *   · `Σ amountApplied ≤ total del documento padre`
 */
export interface PaymentAllocation {
  id: string;
  invoiceNumber: string;
  invoiceTotal: number;
  invoicePending: number;
  amountApplied: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Rol de contraparte
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rol de la contraparte en un documento.
 * Las pantallas de Ventas usan CLIENT; las de Compras usan SUPPLIER.
 * Los componentes unificados de Fase B lo usan para renderizar el label
 * correcto ("Cliente" vs "Proveedor") y para decidir el signo del movimiento
 * de cuenta corriente cuando se conecte al backend.
 */
export type CounterpartyRole = "CLIENT" | "SUPPLIER";

// ─────────────────────────────────────────────────────────────────────────────
// 7. Envíos, descuento global y lista de precios (doc-level)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Datos de envío asociados al documento (factura, remito, presupuesto).
 * Se modela a nivel documento y NO como una línea más, para evitar mezclar
 * artículos vendibles con servicios logísticos.
 *
 *   · `methodId`  — id del método configurado (retiro, estándar, exprés, etc.)
 *   · `cost`      — costo del envío en la moneda del documento
 *   · `address`   — dirección de destino (texto libre hasta que haya catálogo)
 *   · `carrier`   — transporte/responsable (texto libre)
 */
export interface DocumentShipping {
  methodId?: string;
  cost?: number;
  address?: string;
  carrier?: string;
}

/**
 * Descuento global aplicado al documento completo, independiente de los
 * descuentos por línea.
 *
 *   · `type = "PERCENT"` → `value` es un porcentaje sobre el subtotal (0–100)
 *   · `type = "AMOUNT"`  → `value` es un monto absoluto en la moneda del doc
 *   · `reason` es opcional para dejar trazabilidad del motivo
 */
export interface DocumentDiscountGlobal {
  type: "PERCENT" | "AMOUNT";
  value: number;
  reason?: string;
}

/**
 * Mock de listas de precios — Fase 7 las trae del backend. La clave `id` es
 * estable (la usaremos cuando exista la tabla real) y el `label` es lo que
 * mostramos en UI.
 */
export const PRICE_LIST_MOCK_OPTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "retail",    label: "Minorista" },
  { id: "wholesale", label: "Mayorista" },
  { id: "promo",     label: "Promo" },
];

/**
 * Mock de métodos de envío — Fase 7 los trae de `ConfiguracionSistemaEnvios`.
 */
export const SHIPPING_METHOD_MOCK_OPTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "pickup",   label: "Retiro en local" },
  { id: "standard", label: "Envío estándar" },
  { id: "express",  label: "Envío exprés" },
];

// ─────────────────────────────────────────────────────────────────────────────
// 8. Monedas + cotización
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Código ISO de la moneda base del tenant. Fase 7 lo traerá de la config
 * del tenant; hoy es un mock fijo (peso argentino).
 */
export const BASE_CURRENCY_ID = "ARS";

/**
 * Mock de monedas disponibles. Cada entrada expone `id` (código ISO) y
 * `label` legible. Fase 7 reemplaza con el catálogo real de `Currency`.
 */
export const CURRENCY_MOCK_OPTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "ARS", label: "ARS · Peso argentino" },
  { id: "USD", label: "USD · Dólar estadounidense" },
  { id: "EUR", label: "EUR · Euro" },
  { id: "BRL", label: "BRL · Real brasileño" },
  { id: "UYU", label: "UYU · Peso uruguayo" },
];

/** true cuando la moneda recibida coincide con la base del tenant. */
export function isBaseCurrency(id: string | undefined | null): boolean {
  return (id ?? "").trim().toUpperCase() === BASE_CURRENCY_ID;
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Almacenes (mock)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mock de almacenes disponibles. Fase 7 reemplaza con la lista real desde
 * `InventarioAlmacenes`. Cada entrada expone `id` y `label`.
 */
export const WAREHOUSE_MOCK_OPTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "main",     label: "Depósito principal" },
  { id: "local",    label: "Local de venta" },
  { id: "showroom", label: "Showroom" },
  { id: "transit",  label: "En tránsito" },
];

// ─────────────────────────────────────────────────────────────────────────────
// 10. Vendedores (mock)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mock de vendedores. Fase 7 reemplaza con catálogo real desde
 * `ConfiguracionSistemaVendedores`.
 */
export const SELLER_MOCK_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "v1", label: "Carolina Pérez" },
  { value: "v2", label: "Martín Gómez" },
  { value: "v3", label: "Lucía Sosa" },
  { value: "v4", label: "Federico Díaz" },
];

// ─────────────────────────────────────────────────────────────────────────────
// 11. Términos de pago (mock)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mock de términos / condiciones de pago. Fase 7 conectará con la condición
 * comercial del cliente / proveedor.
 */
export const PAYMENT_TERM_MOCK_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "cash",    label: "Contado" },
  { value: "7d",      label: "7 días" },
  { value: "15d",     label: "15 días" },
  { value: "30d",     label: "30 días" },
  { value: "current", label: "Cuenta corriente" },
];

// ─────────────────────────────────────────────────────────────────────────────
// 12. Metadatos de artículos (mock — para sort por marca/grupo/categoría/metal)
// ─────────────────────────────────────────────────────────────────────────────

export type ArticleMeta = {
  brand?:    string;
  group?:    string;
  category?: string;
  metal?:    string;
};

/**
 * Mock de metadatos por `articleId`. Permite ordenar líneas de comprobantes
 * por dimensiones que no viven en el `DocumentLine` directo. Fase 7 reemplaza
 * con lookup contra el catálogo real.
 */
export const ARTICLE_META_MOCK: Record<string, ArticleMeta> = {
  a1: { brand: "Joyas TP",       group: "Anillos",  category: "Compromiso", metal: "Oro 18k" },
  a2: { brand: "Joyas TP",       group: "Anillos",  category: "Compromiso", metal: "Oro 18k" },
  a3: { brand: "Plata Premium",  group: "Collares", category: "Casual",     metal: "Plata 925" },
  a4: { brand: "Plata Premium",  group: "Collares", category: "Casual",     metal: "Plata 925" },
  a5: { brand: "Joyas TP",       group: "Pulseras", category: "Especial",   metal: "Plata 925" },
  a6: { brand: "Aro Style",      group: "Aros",     category: "Casual",     metal: "Oro 14k" },
};

// ─────────────────────────────────────────────────────────────────────────────
// 13. Convenciones de localStorage para módulos de comprobantes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convención canónica de claves de localStorage del sistema:
 *
 *     tp:<scope>:<screen>:<feature>
 *
 * - `scope`  agrupa por dominio:
 *     · `document-lines`  → preferencias compartidas entre TODOS los
 *                            comprobantes con líneas (escaneo, sort, etc.)
 *     · `modal`           → estado por modal (tamaño, posición, maximizado).
 *                            La sub-clave es el `modalKey` del componente.
 *     · `sales`           → preferencias específicas de pantallas de Ventas.
 *     · `purchases`       → preferencias específicas de pantallas de Compras.
 *     · `inventory`       → preferencias específicas de pantallas de Inventario.
 *
 * - `screen` (cuando aplica): `invoices`, `quotes`, `orders`, `receipts`,
 *   `deliveries`, `payments`, `credit-notes`, `returns`, etc.
 *
 * - `feature` describe la preferencia puntual (ej. `discount-card-expanded`).
 *
 * Llaves SHARED (a usar igual en todos los comprobantes):
 *   - `tp:document-lines:quick-search-visible`  → buscador rápido visible/oculto
 *   - `tp:document-lines:sort-mode`             → ordenamiento de líneas
 *
 * Llaves POR PANTALLA (renombrar `screen` al replicar):
 *   - `tp:sales:invoices:discount-card-expanded`
 *   - `tp:sales:invoices:shipping-card-expanded`
 *   - `tp:sales:invoices:view-card-expanded`
 *   - `tp:sales:invoices:payment-card-expanded`
 *   - `tp:sales:invoices:account-impact-card-expanded`
 *
 * Llave de modal:
 *   - `tp:modal:<modalKey>` (ver Modal.tsx — `modalKey` define el sufijo).
 *     Ej: `tp:modal:ventas-facturas-editor`.
 *
 * Cuando se replique a una hermana (ej. `VentasPresupuestos`), reemplazar
 * `invoices` por `quotes` y `ventas-facturas-editor` por `ventas-presupuestos-editor`.
 */
export const LS_KEYS = {
  /** SHARED — visibilidad del quick-search en cualquier comprobante con líneas. */
  QUICK_SEARCH_VISIBLE: "tp:document-lines:quick-search-visible",
  /** SHARED — modo de orden de líneas (manual / artículo / marca / etc.). */
  SORT_MODE:            "tp:document-lines:sort-mode",
  /** Prefijo para estado del modal — el sufijo es el `modalKey` del componente. */
  MODAL_PREFIX:         "tp:modal:",
} as const;

/** Helper para componer claves por pantalla:
 *  `lsKey("sales", "invoices", "discount-card-expanded")`
 *  → `"tp:sales:invoices:discount-card-expanded"`
 */
export function lsKey(scope: string, screen: string, feature: string): string {
  return `tp:${scope}:${screen}:${feature}`;
}
