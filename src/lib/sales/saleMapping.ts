// src/lib/sales/saleMapping.ts
// =============================================================================
// Helpers para mapear entre el shape del backend (`SaleRow` / `SaleDetail`) y
// el shape del frontend (`SalesInvoice`).
//
// Etapa 3 — passthrough puro. No calcula nada. No invoca pricing-engine.
// Cuando el preview backend recalcula la sale tras un round-trip, las
// líneas se rehidratan vía `applySalePreviewToDraft`. Estos helpers solo
// arman el SalesInvoice "esqueleto" para popular el listado y para abrir
// un draft existente en el modal.
//
// Limitación conocida: el mapeo de líneas pierde overrides per-line de
// price/discount/tax que el operador haya tipeado en preview (no persisten
// en backend hoy). Los overrides de composición sí se preservan vía
// `pricingSnapshot` que el preview rehidrata.
// =============================================================================

import type {
  SaleRow,
  SaleDetail,
  SaleLineRow,
  SaleStatus,
} from "../../services/sales";
import type { SalesInvoice, SalesInvoiceStatus } from "./types";
import type { DocumentLine } from "../document-types";

/** Mapea el `SaleStatus` del backend al `SalesInvoiceStatus` del frontend. */
export function mapBackendSaleStatus(s: SaleStatus): SalesInvoiceStatus {
  switch (s) {
    case "DRAFT":          return "DRAFT";
    case "CONFIRMED":      return "PENDING";
    case "PARTIALLY_PAID": return "PARTIAL";
    case "PAID":           return "PAID";
    case "CANCELLED":      return "CANCELLED";
  }
}

function parseDecimal(v: string | null | undefined, fallback = 0): number {
  if (v == null) return fallback;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Extrae el número oficial de la factura (Receipt INVOICE OUTBOUND ISSUED).
 *  Una sale CONFIRMED debería tener exactamente uno; las NC suman a
 *  `receipts` pero NO son la factura oficial. */
function extractOfficialNumber(
  receipts: SaleDetail["receipts"] | undefined,
): string | undefined {
  if (!receipts || receipts.length === 0) return undefined;
  return receipts.find(
    (r) => r.type === "INVOICE" && r.direction === "OUTBOUND" && r.status === "ISSUED",
  )?.code;
}

/** Mapea una fila del listado (sin líneas) a `SalesInvoice` mínimo.
 *  El listado NO trae líneas; al hacer "Editar" se llama `getOne` para
 *  rehidratar el detalle completo. */
export function saleRowToSalesInvoice(row: SaleRow): SalesInvoice {
  return {
    id:               row.id,
    number:           row.code,
    date:             row.saleDate,
    dueDate:          "",
    clientId:         row.client?.id,
    client:           row.client?.displayName ?? "Consumidor final",
    salesOrderNumber: "",
    deliveryNumber:   "",
    currency:         "ARS",
    fxRate:           1,
    taxPercent:       0,
    seller:           row.seller?.id ?? "",
    warehouse:        row.warehouse?.id ?? "",
    paymentTerm:      "",
    referenceNumber:  "",
    notes:            row.notes,
    terms:            "",
    subtotal:         parseDecimal(row.subtotal),
    discountAmount:   parseDecimal(row.discountAmount),
    taxAmount:        parseDecimal(row.taxAmount),
    total:            parseDecimal(row.total),
    paidAmount:       parseDecimal(row.paidAmount),
    lines:            [],
    status:           mapBackendSaleStatus(row.status),
  };
}

/** Mapea una línea persistida (SaleLineRow) a una DocumentLine del frontend.
 *
 *  Etapa 4 — rehidrata los overrides comerciales del operador en
 *  `pricingMeta` + `manualOverrides`. Los flags booleanos
 *  (`manualOverrides.{price/discount/tax}`) se DEDUCEN de la presencia del
 *  override correspondiente: si el backend persistió `manualPriceOverride`,
 *  entonces el toggle "Editar precio" estaba ON cuando se guardó, así que
 *  al reabrir lo reactivamos. Mismo criterio para discount y tax.
 *
 *  Los demás campos de `pricingMeta` (basePrice, unitMargin, marginPercent,
 *  composition, etc.) los rehidrata el preview tras el primer round-trip. */
function saleLineToDocumentLine(line: SaleLineRow): DocumentLine {
  const qty       = parseDecimal(line.quantity, 0);
  const unitPrice = parseDecimal(line.unitPrice, 0);
  const lineTotal = parseDecimal(line.lineTotal, qty * unitPrice);
  // discountAmount = qty × unitPrice − lineTotal (cuando hay descuento absorbido
  // en el pricing-engine, sale como diferencia). Clamp ≥ 0.
  const grossSubtotal  = qty * unitPrice;
  const discountAmount = Math.max(0, grossSubtotal - lineTotal);

  // ── Etapa 4 — rehidratar overrides persistidos ────────────────────────
  const manualPriceVal =
    line.manualPriceOverride != null ? parseDecimal(line.manualPriceOverride) : null;
  const manualDiscountObj = line.manualDiscountOverride ?? null;
  const taxOverrideObj    = line.taxOverride ?? null;
  const manualDiscountAppliesTo = line.manualDiscountAppliesToOverride ?? null;
  const manualTaxAppliesTo      = line.manualTaxAppliesToOverride      ?? null;

  // Flags `manualOverrides` deducidos de la presencia de cada override.
  const hasPriceOverride    = manualPriceVal != null;
  const hasDiscountOverride = manualDiscountObj != null;
  const hasTaxOverride      = taxOverrideObj != null;

  // pricingMeta solo se construye si hay algo que poblar (evita objeto vacío).
  const pricingMeta = (
    hasPriceOverride || hasDiscountOverride || hasTaxOverride
    || manualDiscountAppliesTo != null || manualTaxAppliesTo != null
  )
    ? {
        manualPrice:                hasPriceOverride    ? manualPriceVal    : null,
        manualDiscount:             hasDiscountOverride ? manualDiscountObj : null,
        taxOverride:                hasTaxOverride      ? taxOverrideObj    : null,
        manualDiscountAppliesTo,
        manualTaxAppliesTo,
      }
    : undefined;

  const manualOverrides = (hasPriceOverride || hasDiscountOverride || hasTaxOverride)
    ? {
        price:    hasPriceOverride,
        discount: hasDiscountOverride,
        tax:      hasTaxOverride,
      }
    : undefined;

  return {
    id:         line.id,
    type:       "ARTICLE",
    articleId:  line.articleId,
    variantId:  line.variantId ?? undefined,
    sku:        line.sku || undefined,
    article:    line.articleName || "",
    variant:    line.variantName || "",
    quantity:   qty,
    unitPrice,
    discountAmount,
    subtotal:   lineTotal,
    lineTotal,
    imageUrl:   line.article?.mainImageUrl || undefined,
    priceListIdOverride: line.priceListIdOverride ?? undefined,
    pricingMeta,
    manualOverrides,
  };
}

/** Etapa C16.2 — Deriva la lista de precios DEL DOCUMENTO a partir del
 *  detalle de líneas, para reconstruir `draft.priceListId` al reabrir una
 *  factura existente. Pure function — sin red, sin React.
 *
 *  Regla canónica:
 *    · Tomar SOLO líneas reales que NO tienen `priceListIdOverride`
 *      (las que dependen de la lista global del documento).
 *    · Si todas esas líneas comparten el mismo `appliedPriceListId`, ése
 *      es el doc-level. Cualquier otro caso (sin líneas, listas
 *      heterogéneas, todas con override puntual) → `null` y el editor
 *      respeta la decisión per-línea sin inventar lista global.
 *
 *  Por qué hace falta: el modelo Prisma `Sale` no tiene columna
 *  `priceListId` doc-level; la lista solo se persiste en
 *  `SaleLine.appliedPriceListId`. Sin esta derivación, `draft.priceListId`
 *  quedaba `undefined` al reabrir y el effect de favorita en VentasFacturas
 *  sobrescribía la lista del documento con la favorita del catálogo.
 *  Audit C16.1 documentó la cadena exacta del bug. */
export function deriveDocumentPriceListIdFromLines(
  lines: ReadonlyArray<{
    appliedPriceListId?:   string | null;
    priceListIdOverride?:  string | null;
  } | null | undefined>,
): string | null {
  if (!Array.isArray(lines) || lines.length === 0) return null;
  const candidates: string[] = [];
  for (const l of lines) {
    if (!l) continue;
    // Líneas con override puntual reflejan una decisión per-línea, no la
    // global del documento — las excluimos del derivado.
    const hasOverride =
      typeof l.priceListIdOverride === "string" &&
      (l.priceListIdOverride as string).length > 0;
    if (hasOverride) continue;
    const id = l.appliedPriceListId;
    if (typeof id === "string" && id.length > 0) candidates.push(id);
  }
  if (candidates.length === 0) return null;
  const first = candidates[0]!;
  for (const id of candidates) {
    if (id !== first) return null;          // listas heterogéneas
  }
  return first;
}

/** Mapea el detalle completo (con líneas) a `SalesInvoice`. Usado por
 *  el flujo "Editar factura" tras `salesApi.getOne(id)`. */
export function saleDetailToSalesInvoice(sale: SaleDetail): SalesInvoice {
  const officialNumber = extractOfficialNumber(sale.receipts);
  // C16.2 — Reconstrucción de la lista global del documento desde las líneas.
  // Necesario porque `Sale` no tiene columna `priceListId` doc-level; sin
  // esto, el editor cae a la favorita al reabrir. La derivación es pura.
  const derivedPriceListId =
    deriveDocumentPriceListIdFromLines(sale.lines as any) ?? undefined;
  return {
    id:               sale.id,
    number:           sale.code,
    officialNumber,
    date:             sale.saleDate,
    dueDate:          "",
    clientId:         sale.client?.id,
    client:           sale.client?.displayName ?? "Consumidor final",
    salesOrderNumber: "",
    deliveryNumber:   "",
    currency:         "ARS",
    fxRate:           1,
    taxPercent:       0,
    seller:           sale.seller?.id ?? "",
    warehouse:        sale.warehouse?.id ?? "",
    paymentTerm:      "",
    referenceNumber:  "",
    notes:            sale.notes,
    terms:            "",
    subtotal:         parseDecimal(sale.subtotal),
    discountAmount:   parseDecimal(sale.discountAmount),
    taxAmount:        parseDecimal(sale.taxAmount),
    total:            parseDecimal(sale.total),
    paidAmount:       parseDecimal(sale.paidAmount),
    lines:            sale.lines.map(saleLineToDocumentLine),
    status:           mapBackendSaleStatus(sale.status),
    // Ajustes a nivel documento (Etapa 1.1)
    shipping:         sale.shippingAmount != null
      ? { cost: parseDecimal(sale.shippingAmount), methodId: "manual" }
      : { methodId: "pickup", cost: 0, address: "", carrier: "" },
    discountGlobal:   sale.globalDiscountType && sale.globalDiscountValue != null
      ? { type: sale.globalDiscountType, value: parseDecimal(sale.globalDiscountValue), origin: "MANUAL" }
      : { type: "PERCENT", value: 0, reason: "" },
    balanceModeOverride: sale.balanceModeOverride ?? null,
    // C16.2 — Lista global del documento derivada de las líneas. El effect
    // de favorita en `VentasFacturas.tsx:3271-3320` solo aplica favorita cuando
    // `draft.priceListId` está vacío, así que con este passthrough las
    // facturas reabiertas conservan su lista original (ej. "prueba2").
    priceListId: derivedPriceListId,
    // P0.2 (H4) — Preservar intención "Sin lista" tras reabrir un DRAFT.
    //   Caso reportado: operador crea factura, elige "Sin lista" en el popover,
    //   guarda borrador. Al reabrir, `derivedPriceListId` viene `undefined`
    //   (las líneas no tienen `appliedPriceListId` consistente) y el useEffect
    //   de favoritos re-aplica la favorita automáticamente → la decisión del
    //   operador se pierde.
    //
    //   Como `Sale` no persiste un campo "intención del operador" (la lista
    //   se deriva por línea, no doc-level), heurística: si el draft persistido
    //   no resuelve a una lista global Y tiene líneas (el operador alcanzó a
    //   editar algo), asumimos que la ausencia es intencional. Para drafts
    //   vacíos no marcamos el flag — la favorita sigue apareciendo al cargar
    //   el primer artículo, como antes.
    //
    //   Sale.status !== "DRAFT" (CONFIRMED / CANCELLED) no se ve afectado
    //   porque el editor no permite editar lista en esos estados — el flag
    //   sería irrelevante.
    priceListExplicitlyCleared:
      sale.status === "DRAFT"
        && derivedPriceListId == null
        && Array.isArray(sale.lines)
        && sale.lines.length > 0
        ? true
        : undefined,
    // ── Etapa C16.3 — paridad rehidratación DRAFT (audit C13/C16.2-post) ─
    // Sin estos campos el preview reabierto pierde canal/cupón/forma de
    // pago y los totales divergen del pre-save (síntoma reportado: total
    // y hechura cambian al reabrir el borrador). Cada uno se rehidrata
    // desde el campo correspondiente del SaleDetail; null/undefined →
    // mismo default que un draft nuevo (sin override).
    channelId:           sale.channelId ?? undefined,
    couponCode:          sale.coupon?.code ?? undefined,
    paymentMethodId:     sale.paymentMethodId ?? undefined,
    paymentInstallments: sale.paymentInstallments ?? undefined,
  };
}

/** Extrae un mensaje amigable de un error de la API. Mapea códigos
 *  conocidos a frases en español; cae al mensaje del backend o a un
 *  default genérico. */
export interface ApiErrorLike {
  message?: string;
  status?:  number;
  data?: {
    message?:        string;
    code?:           string;
    blockingAlerts?: string[];
  };
}

export function extractApiErrorMessage(
  err: unknown,
  fallback = "Ocurrió un error al comunicarse con el servidor.",
): string {
  const e = err as ApiErrorLike;
  if (e?.status === 409 && e.data?.code === "SALE_CANCEL_BLOCKED_BY_PAYMENTS") {
    return "No se puede anular una factura con cobros aplicados. Primero revertí o desvinculá los cobros.";
  }
  if (e?.status === 409 && e.data?.message) {
    return e.data.message;
  }
  return e?.data?.message || e?.message || fallback;
}
