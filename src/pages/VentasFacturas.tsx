// src/pages/VentasFacturas.tsx
// ============================================================================
// Facturas de venta — comprobantes económicos a clientes.
//
// Espejo conceptual de ComprasFacturasProveedor pero en sentido VENTA:
//   · en lugar de "proveedor" → cliente
//   · en lugar de "pago a proveedor" → cobro
//   · en lugar de deuda con el proveedor → deuda del cliente con la joyería
//
// Estado 100% local (useState). Sin backend, sin impacto en stock, sin cobros
// reales registrados. Listo para enchufar con pricing-engine y cuenta corriente
// en Fase 6 (ver TODOs en saveDraft y en las row actions).
//
// Flujo conceptual:
//   Presupuesto → Orden de venta → Entrega → Factura → Cobro
// ============================================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useBlocker } from "react-router-dom";
import {
  Receipt,
  FileText,
  Clock,
  CreditCard,
  CheckCircle2,
  Plus,
  Eye,
  Pencil,
  Wallet,
  X,
  Printer,
  Coins,
  ChevronDown,
  Link2,
  ScanLine,
  ArrowDownAZ,
  Check,
  ChevronsUpDown,
  ChevronsDownUp,
  RotateCcw,
  AlertTriangle,
  Heading2,
  Trash2,
  MapPin,
  Tag,
  Mail,
} from "lucide-react";

import { TPSectionShell } from "../components/ui/TPSectionShell";
import { TPTechPricingLoader } from "../components/ui/TPTechPricingLoader";
import { TPCheckbox } from "../components/ui/TPCheckbox";
import { TPKpiBar, type TPKpiItem } from "../components/ui/TPKpiBar";
import { TPTableKit, type TPColDef } from "../components/ui/TPTableKit";
import { TPTr, TPTd } from "../components/ui/TPTable";
import { TPButton } from "../components/ui/TPButton";
import { TPIconButton } from "../components/ui/TPIconButton";
import { TPActionsMenu, type TPActionsMenuItem } from "../components/ui/TPActionsMenu";
import { TPCard } from "../components/ui/TPCard";
import { TPField } from "../components/ui/TPField";
import TPInput from "../components/ui/TPInput";
import TPNumberInput from "../components/ui/TPNumberInput";
import TPSelect from "../components/ui/TPSelect";
import { Modal } from "../components/ui/Modal";
import { TPStatusBadge } from "../components/ui/TPStatusBadge";
import { TPDocumentLineAdvancedEditor } from "../components/ui/TPDocumentLineAdvancedEditor";
import ConfirmDeleteDialog from "../components/ui/ConfirmDeleteDialog";
import { TPTotalCell } from "../components/ui/TPTotalCell";
import SalePricingPanel from "../components/sales/SalePricingPanel";
import { normalizeSalesPreview } from "../lib/pricing/normalizePricingPreviewResult";
import { logParity } from "../lib/pricing";
import { selectInvoiceLineView } from "../lib/sales/selectInvoiceLineView";
// Fase 4.5 — Enter = next field para uso intensivo ERP.
import { useEnterTabNavigation } from "../lib/sales/useEnterTabNavigation";
import { isPreviewableLine, matchPreviewLines } from "../lib/sales/matchPreviewLines";
import { sortLinesPreservingHeaders, articleSkuSortKey } from "../lib/sales/sortLines";
import type { SalesInvoice, SalesInvoiceStatus, ClientSnapshot } from "../lib/sales/types";
import { buildClientSnapshot } from "../lib/sales/buildClientSnapshot";
import { buildSalePreviewPayload } from "../lib/sales/buildSalePreviewPayload";
import { applySalePreviewToDraft } from "../lib/sales/applySalePreviewToDraft";
import { useCardCollapse } from "../lib/sales/useCardCollapse";
import {
  detectManualEdit,
  buildPatchedLine,
  computeManualTax as computeManualTaxLib,
} from "../lib/sales/patchLineHelpers";
import {
  normalizeEntityCurrency,
  resolveClientFxRate,
  computeDueDateFromTerm,
} from "../lib/sales/clientPickHelpers";
import { buildReceiptDraftPayload } from "../lib/sales/buildReceiptDraftPayload";
import { usePreviewFlow } from "../lib/sales/usePreviewFlow";
import {
  TPArticleVariantSearchSelect,
  type TPArticleLite,
} from "../components/ui/TPArticleVariantSearchSelect";
import { TPEntitySearchSelect, type TPEntityLite } from "../components/ui/TPEntitySearchSelect";
import {
  buildCommercialContext,
  applyClientToDraft,
  type CommercialContext,
} from "../lib/commercial-engine";
import {
  normalizeLineFromItem,
  resolveQuantityConstraints,
  applyQuantityChange,
  type QuantityConstraints,
} from "../lib/commercial-line-engine";
import {
  commercialEntitiesApi,
  type EntityRow,
  type EntityDetail,
} from "../services/commercial-entities";
import EntityEditModal from "./configuracion-sistema/clientes/EntityEditModal";
import AddressEditModal from "../components/ui/AddressEditModal";
import { ADDRESS_TYPE_LABELS } from "../services/commercial-entities";
import { sellersApi, type SellerRow } from "../services/sellers";
import { listCurrencies, addCurrencyRate, type CurrencyRow } from "../services/valuation";
import { useCatalog } from "../hooks/useCatalog";
import { usePermissions } from "../hooks/usePermissions";
import { receiptsApi, type CreateReceiptDraftPayload } from "../services/receipts";
import { documentTemplatesApi } from "../services/document-templates";
import {
  articlesApi,
  type ArticleRow,
  type ArticleVariant,
} from "../services/articles";
import { warehousesApi } from "./InventarioAlmacenes/warehouses.api";
import { useInventory } from "../context/InventoryContext";
import {
  generateHeadersByCriterion,
  HEADER_GROUP_BY_LABEL,
  type HeaderGroupBy,
} from "../lib/sales/generateLineHeaders";
import { priceListsApi, type PriceListRow } from "../services/price-lists";
import { salesChannelsApi, type SalesChannelRow } from "../services/sales-channels";
import {
  resolveDefaultWarehouseId,
  resolveDefaultId,
  resolveDefaultCurrencyCode,
  resolveCurrencyRate,
  userPreferencesApi,
} from "../services/user-preferences";
import { listUnits, type Unit as UnitRow } from "../services/units";
import { couponsApi, type ValidateCouponResult } from "../services/coupons";
import { salesApi, type SaleDocumentTotals, type SalePreviewResult, type SalePreviewLine } from "../services/sales";
import { taxesApi, type TaxRow } from "../services/taxes";
import { CouponCard } from "./ventas-facturas/CouponCard";
import {
  DiscountCard, ShippingCard, TotalsHeroSection, LinesEditorSection,
  AddressPickerPopover, CurrencyFXModal, PaymentCard, InvoiceHeaderForm,
  ObservationsTermsAttachmentsCard,
} from "./ventas-facturas/InvoiceEditorModal";
import LabelPrintModal, { type LabelItem } from "./article-detail/LabelPrintModal";
import type { WarehouseRow } from "./InventarioAlmacenes/types";
import { TPDocumentModalFooter } from "../components/ui/TPDocumentModalFooter";
import TPDocumentTotalsHero from "../components/ui/TPDocumentTotalsHero";
import { composeDocumentPricingDetail } from "../lib/pricing-display-helpers";
import { TPCollapse } from "../components/ui/TPCollapse";
import { TPPopover } from "../components/ui/TPPopover";
import { cn } from "../components/ui/tp";
import { TPProgressCell } from "../components/ui/TPProgressCell";
import { TPBalanceCell } from "../components/ui/TPBalanceCell";
import { TPAgingCell } from "../components/ui/TPAgingCell";
import {
  TPRowExpanded,
  TPRowExpandToggle,
} from "../components/ui/TPRowExpanded";
import {
  TPDocumentTimeline,
  type TPDocumentTimelineItem,
} from "../components/ui/TPDocumentTimeline";

import { toast } from "../lib/toast";
import {
  uid,
  todayISO,
  round2,
  fmtDate,
  nextDocNumber,
  calcLineTotalsFromSnapshot,
} from "../lib/document-helpers";
// Dinero config-aware (región/decimales del tenant), misma semántica que el
// fmtMoney de document-helpers. Esto hace que mFmt → DiscountCard /
// ShippingCard / PaymentCard / totales respeten Configuración → Formato.
import { formatMoneyDoc as fmtMoney } from "../lib/pricing/format";
import {
  type DocumentLine,
  type DocumentShipping,
  type DocumentDiscountGlobal,
  SHIPPING_METHOD_MOCK_OPTIONS,
  CURRENCY_MOCK_OPTIONS,
  SELLER_MOCK_OPTIONS,
  PAYMENT_TERM_MOCK_OPTIONS,
  LS_KEYS,
  lsKey,
  isBaseCurrency,
} from "../lib/document-types";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos del dominio — extraídos a `src/lib/sales/types.ts` durante FASE 5.
// Re-import al inicio del archivo. Mantener acá solo los tipos LOCALES a la
// página (si los hubiese).
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Una línea es "vacía" cuando todavía no se le asignó un artículo. Sirve
 * como placeholder al final de la lista para seguir cargando rápido (modo
 * escaneo / búsqueda). No se persiste al guardar y no afecta totales.
 */
function isEmptyLine(l: DocumentLine): boolean {
  // Las cabeceras nunca son "vacías" — tienen contenido organizativo, aunque
  // el título esté en blanco. Eso evita que addLineFromArticle las reemplace
  // o que la validación las descarte.
  if (l.type === "HEADER") return false;
  // Línea manual: vacía si no tiene descripción.
  if (l.isManual) return !(l.manualDescription ?? "").trim();
  return !l.articleId && !(l.article ?? "").trim();
}

function isHeaderLine(l: DocumentLine): boolean {
  return l.type === "HEADER";
}

function makeEmptyLine(): DocumentLine {
  return {
    id:             uid(),
    article:        "",
    variant:        "",
    quantity:       1,
    unitPrice:      0,
    discountAmount: 0,
    subtotal:       0,
    lineTotal:      0,
  };
}

/**
 * Identidad comercial de una línea para fines de dedupe (modo escáner /
 * quick-add). Cada variante es un ítem independiente — NO se suma con el
 * artículo padre ni con sus hermanas.
 *
 *   ARTICLE_VARIANT  → `VARIANT:<variantId>`
 *   ARTICLE_SIMPLE   → `ARTICLE:<articleId>`
 *   SERVICE          → `SERVICE:<articleId>`
 *   COMBO            → `COMBO:<articleId>`
 *   sin id (legacy)  → `NAME:<lower(article)>::<lower(variant)>`
 */
function getLineIdentityKey(l: DocumentLine): string {
  if (l.itemKind === "ARTICLE_VARIANT" && l.variantId) {
    return `VARIANT:${l.variantId}`;
  }
  if (l.itemKind === "SERVICE" && l.articleId) {
    return `SERVICE:${l.articleId}`;
  }
  if (l.itemKind === "COMBO" && l.articleId) {
    return `COMBO:${l.articleId}`;
  }
  if (l.articleId) {
    return `ARTICLE:${l.articleId}`;
  }
  return `NAME:${(l.article ?? "").toLowerCase()}::${(l.variant ?? "").toLowerCase()}`;
}

/** Identidad comercial de un item del buscador, usando las mismas reglas
 *  que `getLineIdentityKey` para que el dedupe funcione consistentemente. */
function getSearchItemIdentityKey(item: import("../components/ui/TPArticleVariantSearchSelect").TPArticleLite): string {
  if (item.itemKind === "ARTICLE_VARIANT" && item.variantId) {
    return `VARIANT:${item.variantId}`;
  }
  if (item.itemKind === "SERVICE" && item.id) {
    return `SERVICE:${item.id}`;
  }
  if (item.itemKind === "COMBO" && item.id) {
    return `COMBO:${item.id}`;
  }
  if (item.id) {
    return `ARTICLE:${item.id}`;
  }
  return `NAME:${(item.code ?? item.article ?? "").toLowerCase()}::${(item.variant ?? "").toLowerCase()}`;
}

function makeHeaderLine(): DocumentLine {
  return {
    id:             uid(),
    type:           "HEADER",
    title:          "",
    article:        "",
    variant:        "",
    quantity:       0,
    unitPrice:      0,
    discountAmount: 0,
    subtotal:       0,
    lineTotal:      0,
  };
}

/**
 * Garantiza que haya como máximo UNA línea vacía al final del arreglo.
 * Si la lista no está vacía y la última línea tiene artículo, agrega una
 * placeholder vacía. Si la última ya es vacía, no hace nada (idempotente).
 */
function ensureTrailingEmpty(lines: DocumentLine[]): DocumentLine[] {
  if (lines.length === 0) return lines;
  const last = lines[lines.length - 1];
  if (isEmptyLine(last)) return lines;
  return [...lines, makeEmptyLine()];
}

// ─────────────────────────────────────────────────────────────────────────────
// Cobros (mock — solo frontend)
// ─────────────────────────────────────────────────────────────────────────────

/** Una entrada de cobro asociada a la factura. Local al editor (no persiste). */
type PaymentEntry = {
  id:        string;
  methodId:  string;
  amount:    number;
  currency:  string;
  /** Depósito / caja destino (id mock). Obligatorio. */
  depositId: string;
};

const PAYMENT_METHOD_MOCK_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "cash",        label: "Efectivo" },
  { value: "card_debit",  label: "Tarjeta de débito" },
  { value: "card_credit", label: "Tarjeta de crédito" },
  { value: "transfer",    label: "Transferencia" },
  { value: "check",       label: "Cheque" },
  { value: "mp",          label: "Mercado Pago" },
  { value: "other",       label: "Otro" },
];

/** Mock de depósitos / cajas destino — Fase 7 vendrá del backend. */
const DEPOSIT_MOCK_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "caja_principal",   label: "Caja principal" },
  { value: "caja_mostrador",   label: "Caja mostrador" },
  { value: "banco_galicia",    label: "Banco Galicia" },
  { value: "mercado_pago",     label: "Mercado Pago" },
  { value: "cuenta_corriente", label: "Cuenta corriente" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Adaptadores backend → tipos de UI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mapea una entidad real (`EntityRow`) al shape liviano que consume el combo
 * de cliente (`TPEntityLite`). Se usa al hidratar el dropdown.
 */
function entityRowToLite(row: EntityRow): TPEntityLite {
  // Nombre legible: displayName si vino, si no companyName/tradeName, si no
  // firstName + lastName.
  const displayName = (row.displayName ?? "").trim();
  const composed = row.entityType === "COMPANY"
    ? (row.tradeName || row.companyName || "").trim()
    : `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim();
  const name = displayName || composed || "(sin nombre)";

  return {
    id:   row.id,
    name,
    type: "client",
    email: row.email || undefined,
    phone: row.phone || undefined,
    currency: row.currencyId || undefined,
    priceListId: row.priceListId || undefined,
    paymentTerm: row.paymentTerm || undefined,
    ivaCondition: row.ivaCondition || undefined,
    // Datos identitarios (display)
    entityType:     row.entityType,
    firstName:      row.firstName || undefined,
    lastName:       row.lastName || undefined,
    companyName:    row.companyName || undefined,
    tradeName:      row.tradeName || undefined,
    documentType:   row.documentType || undefined,
    documentNumber: row.documentNumber || undefined,
    // category (mayorista/minorista) sigue sin venir; sellerId sí (FASE seller).
    sellerId:       row.sellerId || undefined,
  };
}

// (Removido en FASE 5 — extraído a src/lib/sales/. Ver imports al inicio.)

/**
 * Compone una línea legible de dirección a partir de los campos discretos.
 */
function composeAddressLine(addr: { street?: string; streetNumber?: string; city?: string; province?: string; country?: string; postalCode?: string }): string {
  const street = [addr.street, addr.streetNumber].filter(Boolean).join(" ").trim();
  const locality = [addr.postalCode, addr.city, addr.province].filter(Boolean).join(" ").trim();
  return [street, locality].filter(Boolean).join(", ").trim();
}

/**
 * Encuentra la dirección "principal" de un detail: primero la `isDefault`,
 * caso contrario la primera de la lista.
 */
function pickDefaultAddress(detail: EntityDetail): EntityDetail["addresses"][number] | null {
  if (!detail.addresses?.length) return null;
  return detail.addresses.find((a) => a.isDefault) ?? detail.addresses[0];
}

/**
 * Expande un `ArticleRow` del backend en uno o varios `TPArticleLite` para
 * el combo del editor de líneas:
 *   · Si el artículo tiene variantes activas, emite un item por variante.
 *   · Si no, emite un único item a nivel artículo.
 * Stock total proviene de `stockData.byVariant` (por variante) o
 * `stockData.total` (artículo sin variantes).
 *
 * Si se pasa `q` y matchea EXACTO con el sku/code/barcode de alguna variante,
 * sólo se emite esa variante (búsqueda dirigida por SKU). Si q matchea con
 * el artículo padre o es búsqueda parcial, se devuelven todas las variantes
 * activas como antes.
 */
/**
 * Convierte string|null|undefined a number. Devuelve undefined si no se puede
 * parsear o si el valor es <= 0 (un mínimo/máximo de 0 no es informativo).
 */
function numOrUndefined(s: string | null | undefined): number | undefined {
  if (s == null) return undefined;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

/**
 * Step de cantidad según unidad de medida. Unidades enteras → 1; unidades
 * fraccionables (peso/longitud/volumen) → 0.01. Fallback: 1.
 */
function deriveQuantityStep(unitOfMeasure?: string): number {
  const u = (unitOfMeasure ?? "").trim().toLowerCase();
  if (!u || u === "u" || u === "un" || u === "uni" || u === "unidad" || u === "unidades") return 1;
  // Pesos / longitudes / volúmenes / metros cuadrados → admiten decimales.
  if (["g", "kg", "mg", "tn", "m", "cm", "mm", "km", "l", "ml", "m2", "m3", "cm2", "cm3"].includes(u)) {
    return 0.01;
  }
  return 1;
}

function expandArticleToLite(
  row: ArticleRow,
  q?: string,
): import("../components/ui/TPArticleVariantSearchSelect").TPArticleLite[] {
  const baseImage = row.mainImageUrl || "";
  const baseDescription = row.description || "";
  const basePrice = row.salePrice != null ? Number(row.salePrice) : undefined;
  // Constraints del artículo padre — sirven como fallback si la variante no
  // los redefine.
  const articleMin     = numOrUndefined(row.minSaleQuantity);
  const articleMax     = numOrUndefined(row.maxSaleQuantity);
  const articleDefault = numOrUndefined(row.defaultQuantity);
  const articleStep    = deriveQuantityStep(row.unitOfMeasure);
  // manageStock: PRODUCT/MATERIAL administran stock, SERVICE no. COMBO usa
  // el flag del padre (commercialMode COMBO_COMMERCIAL no implica stock
  // por sí solo — se respeta el articleType base).
  const manageStock = row.articleType !== "SERVICE";

  let activeVariants = (row.variants ?? []).filter((v: ArticleVariant) => v.isActive);

  // Si la query coincide EXACTO con sku / code / barcode de una o más
  // variantes, restringimos el set a esas. Así cuando el usuario tipea el
  // SKU específico de una variante, no le aparecen sus hermanas del mismo
  // artículo padre.
  const normalizedQ = (q ?? "").trim().toLowerCase();
  if (normalizedQ && activeVariants.length > 0) {
    const exact = activeVariants.filter((v) =>
      [v.sku, v.code, v.barcode]
        .filter((x): x is string => !!x)
        .some((x) => x.toLowerCase() === normalizedQ)
    );
    if (exact.length > 0) activeVariants = exact;
  }

  if (activeVariants.length > 0) {
    // [DEBUG TEMP] Diagnóstico Bug 1 — quitar una vez resuelto.
    if (q) {
      // eslint-disable-next-line no-console
      console.debug("[expand-variants]", {
        q,
        normalizedQ,
        rowId: row.id,
        rowCode: row.code,
        rowSku: row.sku,
        variantsRaw: (row.variants ?? []).map((v) => ({
          id: v.id, code: v.code, sku: v.sku, barcode: v.barcode, isActive: v.isActive,
        })),
        activeVariantsAfterFilter: activeVariants.map((v) => ({
          id: v.id, code: v.code, sku: v.sku, barcode: v.barcode,
        })),
      });
    }
    return activeVariants.map((v) => {
      const variantStock = row.stockData?.byVariant?.[v.id];
      return {
        id:        row.id,
        variantId: v.id,
        // Fix Bug 1 — el código debe representar al ítem más específico:
        // si la variante tiene `code` propio, gana sobre el del padre. Esto
        // alinea la semántica con `sku` (que ya prioriza la variante) y
        // permite que el matching exacto del combo (`isExact` por code/sku/
        // barcode) detecte códigos de variante como "A000-00A".
        code:      v.code || row.code,
        sku:       v.sku || row.sku,
        barcode:   v.barcode ?? undefined,
        itemKind:  "ARTICLE_VARIANT" as const,
        articleType:    row.articleType,
        manageStock,
        unitOfMeasure:  row.unitOfMeasure || undefined,
        minQty:         numOrUndefined(v.minSaleQuantity)  ?? articleMin,
        maxQty:         numOrUndefined(v.maxSaleQuantity)  ?? articleMax,
        defaultQty:     numOrUndefined(v.defaultQuantity)  ?? articleDefault,
        quantityStep:   articleStep,
        article:   row.name,
        variant:   v.name,
        description: baseDescription,
        price:     basePrice,
        stock:     typeof variantStock === "number" ? variantStock : undefined,
        imageUrl:  v.imageUrl || baseImage || undefined,
        images:    [v.imageUrl, baseImage].filter(Boolean) as string[],
        // Metadata para cabeceras automáticas — snapshot liviano del catálogo.
        categoryName: row.category?.name || undefined,
        groupName:    row.group?.name    || undefined,
        brand:        row.brand          || undefined,
        manufacturer: row.manufacturer   || undefined,
      };
    });
  }

  // Sin variantes — el itemKind depende del articleType + commercialMode:
  //   COMBO_COMMERCIAL → COMBO
  //   articleType SERVICE → SERVICE
  //   resto (PRODUCT, MATERIAL) → ARTICLE_SIMPLE
  const itemKind: "ARTICLE_SIMPLE" | "SERVICE" | "COMBO" =
    row.commercialMode === "COMBO_COMMERCIAL"
      ? "COMBO"
      : row.articleType === "SERVICE"
        ? "SERVICE"
        : "ARTICLE_SIMPLE";

  return [{
    id:        row.id,
    code:      row.code,
    sku:       row.sku,
    barcode:   row.barcode ?? undefined,
    itemKind,
    articleType:    row.articleType,
    // Combos comerciales: si el commercialMode es COMBO_COMMERCIAL pero el
    // articleType base es SERVICE, mantener manageStock=false.
    manageStock:    itemKind === "SERVICE" ? false : manageStock,
    unitOfMeasure:  row.unitOfMeasure || undefined,
    minQty:         articleMin,
    maxQty:         articleMax,
    defaultQty:     articleDefault,
    quantityStep:   articleStep,
    article:   row.name,
    description: baseDescription,
    price:     basePrice,
    stock:     row.stockData?.total ?? undefined,
    imageUrl:  baseImage || undefined,
    images:    baseImage ? [baseImage] : undefined,
    categoryName: row.category?.name || undefined,
    groupName:    row.group?.name    || undefined,
    brand:        row.brand          || undefined,
    manufacturer: row.manufacturer   || undefined,
  }];
}

function makeEmptyPayment(currency: string): PaymentEntry {
  return {
    id:        uid(),
    methodId:  "cash",
    amount:    0,
    currency,
    depositId: "",
  };
}

// Fase 6: `computeGlobalDiscount` y `legacyFallbackRecomputeTotals` fueron
// borrados. La fuente única de verdad para todos los importes del documento
// es el backend vía `salesApi.preview` → `applySalePreviewToDraft`. El
// descuento global ahora se manda al backend como `{ type, value }` y
// el motor lo resuelve contra el subtotal post-descuentos de línea.

// ─── Fase 5 — Payload e hidratación desde el backend ────────────────────────

// (Removido en FASE 5 — extraído a src/lib/sales/. Ver imports al inicio.)

// (Removido en FASE 5 — extraído a src/lib/sales/. Ver imports al inicio.)

function derivePaymentStatus(total: number, paid: number): SalesInvoiceStatus {
  if (total <= 0) return "DRAFT";
  if (paid <= 0) return "PENDING";
  if (paid < total) return "PARTIAL";
  return "PAID";
}

// ── Mock de documentos relacionados ────────────────────────────────────────
//
// Genera una mini-timeline a partir de los campos actuales de la factura:
//   · OV origen (`salesOrderNumber`)
//   · REM origen (`deliveryNumber`)
//   · COB derivado si hay paidAmount > 0 (1 cobro mock que representa la
//     suma cobrada; Fase 7 expondrá el set real de receipts aplicados)
//
// La aplicación de notas de crédito queda pendiente: el modelo actual de
// SalesInvoice no trackea NC aplicadas — Fase 7 agregará ese link.

function mockDerivedDocuments(r: SalesInvoice): TPDocumentTimelineItem[] {
  const items: TPDocumentTimelineItem[] = [];

  if (r.salesOrderNumber) {
    items.push({
      id:          `${r.id}-ov-origin`,
      type:        "OV",
      number:      r.salesOrderNumber,
      date:        r.date,
      status:      "CONFIRMED",
      statusLabel: "Origen",
      statusTone:  "neutral",
    });
  }

  if (r.deliveryNumber) {
    items.push({
      id:          `${r.id}-rem-origin`,
      type:        "REM",
      number:      r.deliveryNumber,
      date:        r.date,
      status:      "CONFIRMED",
      statusLabel: "Origen",
      statusTone:  "neutral",
    });
  }

  if (r.paidAmount > 0) {
    const isComplete = r.paidAmount >= r.total && r.total > 0;
    items.push({
      id:          `${r.id}-cb-1`,
      type:        "CB",
      number:      "CB-0001",
      date:        r.date,
      amount:      r.paidAmount,
      currency:    r.currency,
      status:      isComplete ? "APPLIED" : "PARTIAL",
      statusLabel: isComplete ? "Aplicado" : "Parcial",
      statusTone:  isComplete ? "success" : "warning",
    });
  }

  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mocks compartidos: SELLER / PAYMENT_TERM / ARTICLE_META importados de
// `document-types.ts` para evitar duplicación con pantallas hermanas.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Columnas
// ─────────────────────────────────────────────────────────────────────────────

const COLS: TPColDef[] = [
  { key: "expander",  label: "",            width: "32px",  canHide: false },
  { key: "number",    label: "Número",      width: "110px", sortKey: "number" },
  { key: "date",      label: "Fecha",       width: "110px", sortKey: "date" },
  { key: "client",    label: "Cliente",                     sortKey: "client" },
  { key: "reference", label: "Doc. origen", width: "150px" },
  { key: "payment",   label: "Cobro",       width: "150px" },
  { key: "total",     label: "Total",       width: "130px", align: "right", sortKey: "total" },
  { key: "balance",   label: "Saldo",       width: "130px", align: "right", sortKey: "balance" },
  { key: "aging",     label: "Aging",       width: "100px", align: "right" },
  { key: "status",    label: "Estado",      width: "120px" },
  { key: "actions",   label: "",            width: "48px",  canHide: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// Pantalla
// ─────────────────────────────────────────────────────────────────────────────

type StatusFilter = "ALL" | SalesInvoiceStatus;

export default function VentasFacturas() {
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [q, setQ]               = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [clientFilter, setClientFilter] = useState<string>("ALL");

  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft]           = useState<SalesInvoice | null>(null);
  // footerTerms de la plantilla FACTURA — fuente de verdad de la precarga de
  // Términos. Se resuelve en `openNew()` (junto al resto de defaults) y se
  // refresca si el usuario "Guarda como predeterminado". NO afecta cálculos.
  const [templateTerms, setTemplateTerms] = useState<string>("");

  // Fix Bug 2a — Catálogos comerciales cargados al MONTAR la página (no al
  // abrir el modal). Esto permite que `openNew()` resuelva favoritos antes
  // de construir el draft inicial. El modal sigue manteniendo sus propios
  // catálogos (no se eliminan); estos del padre son específicos para el
  // arranque del draft.
  const [parentPriceLists,    setParentPriceLists]    = useState<PriceListRow[]>([]);
  const [parentWarehouses,    setParentWarehouses]    = useState<WarehouseRow[]>([]);
  const [parentSalesChannels, setParentSalesChannels] = useState<SalesChannelRow[]>([]);
  const [parentSellers,       setParentSellers]       = useState<SellerRow[]>([]);
  const [parentCurrencies,    setParentCurrencies]    = useState<CurrencyRow[]>([]);
  const { favoriteWarehouseId: parentFavoriteWarehouseId } = useInventory();

  useEffect(() => {
    let cancelled = false;
    warehousesApi.list()
      .then((rows) => {
        if (cancelled) return;
        setParentWarehouses((rows as WarehouseRow[]).filter((w) => w.isActive));
      })
      .catch(() => { if (!cancelled) setParentWarehouses([]); });

    priceListsApi.list()
      .then((rows) => {
        if (cancelled) return;
        setParentPriceLists((rows ?? []).filter((p) => p.isActive && !p.deletedAt));
      })
      .catch(() => { if (!cancelled) setParentPriceLists([]); });

    salesChannelsApi.list()
      .then((rows) => {
        if (cancelled) return;
        setParentSalesChannels((rows ?? []).filter((c) => c.isActive && !c.deletedAt));
      })
      .catch(() => { if (!cancelled) setParentSalesChannels([]); });

    sellersApi.list()
      .then((rows) => {
        if (cancelled) return;
        setParentSellers((rows ?? []).filter((s) => s.isActive && !s.deletedAt));
      })
      .catch(() => { if (!cancelled) setParentSellers([]); });

    listCurrencies()
      .then((resp: any) => {
        if (cancelled) return;
        const list: CurrencyRow[] = resp?.rows ?? resp ?? [];
        setParentCurrencies(list.filter((c) => c.isActive));
      })
      .catch(() => { if (!cancelled) setParentCurrencies([]); });

    return () => { cancelled = true; };
  }, []);

  // Snapshot del draft al abrir la modal — se compara contra el draft actual
  // para detectar cambios sin guardar (dirty state). Se setea en `openNew`
  // (y eventualmente al editar) y se limpia al cerrar/guardar.
  const initialDraftJsonRef = useRef<string | null>(null);
  // Modal de confirmación "tenés cambios sin guardar".
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  const isDirty = useMemo(() => {
    if (!editorOpen || !draft || !initialDraftJsonRef.current) return false;
    return JSON.stringify(draft) !== initialDraftJsonRef.current;
  }, [draft, editorOpen]);

  // Bloqueo de navegación interna (sidebar / link) mientras hay cambios sin
  // guardar. `useBlocker` requiere data router — ya lo provee createBrowserRouter.
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    editorOpen && isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  // Cuando react-router bloquea una navegación, abrimos el confirm dialog.
  useEffect(() => {
    if (blocker.state === "blocked") {
      setConfirmDiscardOpen(true);
    }
  }, [blocker.state]);

  // Bloqueo nativo al recargar / cerrar tab mientras hay cambios sin guardar.
  // El navegador muestra un diálogo propio (texto fijo); lo único que podemos
  // hacer es activar / desactivar el prompt.
  useEffect(() => {
    if (!editorOpen || !isDirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      // Chrome/Edge requieren returnValue; el string no se muestra.
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [editorOpen, isDirty]);

  function closeEditor() {
    setEditorOpen(false);
    setDraft(null);
    initialDraftJsonRef.current = null;
  }

  function requestCloseEditor() {
    if (isDirty) {
      setConfirmDiscardOpen(true);
      return;
    }
    closeEditor();
  }

  // Ids de filas expandidas (detalle con documentos relacionados).
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  const [isNew, setIsNew]           = useState(true);

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const kpis: TPKpiItem[] = useMemo(() => {
    const total     = invoices.length;
    const pending   = invoices.filter((i) => i.status === "PENDING").length;
    const partial   = invoices.filter((i) => i.status === "PARTIAL").length;
    const paid      = invoices.filter((i) => i.status === "PAID").length;
    const cancelled = invoices.filter((i) => i.status === "CANCELLED").length;

    return [
      { id: "total",     label: "Total facturas", value: total,     hint: "Todas las facturas",    tone: total > 0 ? "primary" : "neutral",        icon: <Receipt size={12} /> },
      { id: "pending",   label: "Pendientes",     value: pending,   hint: "Sin cobros",            tone: pending > 0 ? "warning" : "neutral",      icon: <Clock size={12} /> },
      { id: "partial",   label: "Parciales",      value: partial,   hint: "Cobro incompleto",      tone: partial > 0 ? "info" : "neutral",         icon: <CreditCard size={12} /> },
      { id: "paid",      label: "Pagadas",        value: paid,      hint: "Canceladas al 100%",    tone: paid > 0 ? "success" : "neutral",         icon: <CheckCircle2 size={12} /> },
      { id: "cancelled", label: "Anuladas",       value: cancelled, hint: "No afectan saldo",      tone: cancelled > 0 ? "danger" : "neutral",     icon: <FileText size={12} /> },
    ];
  }, [invoices]);

  // ── Filtrado ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return invoices.filter((i) => {
      if (statusFilter !== "ALL" && i.status !== statusFilter) return false;
      if (clientFilter !== "ALL" && i.client !== clientFilter) return false;
      if (!term) return true;
      return `${i.number} ${i.client} ${i.salesOrderNumber} ${i.deliveryNumber}`
        .toLowerCase()
        .includes(term);
    });
  }, [invoices, q, statusFilter, clientFilter]);

  // ── Opciones ─────────────────────────────────────────────────────────────
  const clientOptions = useMemo(() => {
    const uniq = Array.from(new Set(invoices.map((i) => i.client).filter(Boolean))).sort();
    return [
      { value: "ALL", label: "Todos los clientes" },
      ...uniq.map((c) => ({ value: c, label: c })),
    ];
  }, [invoices]);

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "ALL",       label: "Todos los estados" },
    { value: "DRAFT",     label: "Borrador" },
    { value: "PENDING",   label: "Pendiente" },
    { value: "PARTIAL",   label: "Parcial" },
    { value: "PAID",      label: "Pagada" },
    { value: "CANCELLED", label: "Anulada" },
  ];

  // ── Acciones globales ────────────────────────────────────────────────────
  async function openNew() {
    // Fix Bug 2b — Resolver defaults contra los catálogos del padre (que se
    // cargan al montar la página). Si los catálogos aún no llegaron, los
    // campos quedan vacíos y el useEffect coordinado del modal los aplica
    // cuando el catálogo correspondiente llegue. Red de seguridad doble.
    //
    // Cadena de prioridad (en creación el cliente aún no está elegido, así
    // que el paso "default comercial del cliente" no aplica todavía):
    //   UserPreference → favorito de la joyería → primer activo.
    //
    // ⚠️ La preferencia se trae FRESCA acá (una sola fuente, sin cache de
    // montaje): refleja lo recién guardado en "Mis preferencias" y al usuario
    // actual tras un quick-switch. `userPreferencesApi.get()` nunca tira
    // (devuelve preferencia vacía si falla).
    const pref = await userPreferencesApi.get();

    // Precarga de Términos desde la plantilla FACTURA (DocumentTemplate.
    // footerTerms = fuente de verdad). Nunca pisa lo que el usuario escriba:
    // como en creación `terms` arranca vacío, se aplica el footerTerms tal
    // cual. Si la llamada falla, seguimos con términos vacíos (no bloquea).
    let tplTerms = "";
    try {
      const tpl = await documentTemplatesApi.get("FACTURA");
      tplTerms = (tpl?.footerTerms ?? "").trim();
    } catch {
      tplTerms = "";
    }
    setTemplateTerms(tplTerms);

    const favList    = parentPriceLists.find((p) => p.isFavorite && p.isActive && !p.deletedAt);
    const favChannel = parentSalesChannels.find((c) => c.isFavorite && c.isActive && !c.deletedAt);
    const favSeller  = parentSellers.find((sx) => sx.isFavorite && sx.isActive && !sx.deletedAt);

    const favWh        = resolveDefaultWarehouseId(parentFavoriteWarehouseId, parentWarehouses);
    const sellerId     = resolveDefaultId(pref?.defaultSellerId, favSeller?.id, parentSellers);
    const listId       = resolveDefaultId(pref?.defaultPriceListId, favList?.id, parentPriceLists);
    const channelId    = resolveDefaultId(pref?.defaultChannelId, favChannel?.id, parentSalesChannels);
    // Moneda como CÓDIGO (no id): UserPreference → moneda base → "ARS".
    const currencyCode = resolveDefaultCurrencyCode(pref?.defaultCurrencyId, parentCurrencies, "ARS");
    // Cotización vigente para esa moneda (mismo flujo que el cambio manual
    // en el modal de FX): base → 1; no base → latestRate del catálogo.
    const currencyRate = resolveCurrencyRate(currencyCode, parentCurrencies);

    const blank: SalesInvoice = {
      id:               uid(),
      number:           nextDocNumber("FV", invoices),
      date:             todayISO(),
      dueDate:          "",
      client:           "",
      salesOrderNumber: "",
      deliveryNumber:   "",
      currency:         currencyCode,
      fxRate:           currencyRate,
      taxPercent:       0,
      seller:           sellerId,
      warehouse:        favWh,
      paymentTerm:      "",
      referenceNumber:  "",
      notes:            "",
      terms:            tplTerms,
      subtotal:         0,
      discountAmount:   0,
      taxAmount:        0,
      total:            0,
      paidAmount:       0,
      lines:            [],
      status:           "DRAFT",
      priceListId:      listId || undefined,
      channelId:        channelId || undefined,
      couponCode:       undefined,
      shipping:         { methodId: "pickup", cost: 0, address: "", carrier: "" },
      discountGlobal:   { type: "PERCENT", value: 0, reason: "" },
    };

    setDraft(blank);
    setIsNew(true);
    setEditorOpen(true);
    // Snapshot inicial — luego se compara para saber si hay cambios.
    initialDraftJsonRef.current = JSON.stringify(blank);
  }

  function saveDraft() {
    if (!draft) return;

    if (!draft.client.trim())     { toast.error("El cliente es obligatorio.");    return; }
    if (!draft.date)              { toast.error("La fecha es obligatoria.");      return; }
    if (!draft.currency.trim())   { toast.error("La moneda es obligatoria.");     return; }

    // Filtrar líneas vacías (placeholders): no se persisten ni validan.
    // Las cabeceras (HEADER) NO cuentan como artículo para "al menos una
    // línea" — sí se persisten para preservar el agrupamiento visual.
    const realLines     = draft.lines.filter((l) => !isEmptyLine(l));
    const realArticles  = realLines.filter((l) => l.type !== "HEADER");
    if (realArticles.length === 0) { toast.error("Agregá al menos una línea.");      return; }

    for (const l of realArticles) {
      if (l.quantity <= 0)      { toast.error(`La cantidad debe ser mayor a 0 (${l.article || "línea"}).`); return; }
      if (l.unitPrice < 0)      { toast.error(`El precio no puede ser negativo (${l.article || "línea"}).`); return; }
      if ((l.lineTotal ?? 0) < 0) { toast.error(`El total de línea no puede ser negativo (${l.article || "línea"}).`); return; }
    }

    // Fase 6: los totales ya viven en `draft.*` hidratados por salesApi.preview
    // vía applySalePreviewToDraft. No recalculamos localmente al guardar.
    if (draft.total < 0) {
      toast.error("El total no puede ser negativo.");
      return;
    }

    const nextStatus: SalesInvoiceStatus =
      draft.status === "CANCELLED"
        ? "CANCELLED"
        : draft.total <= 0
        ? "DRAFT"
        : derivePaymentStatus(draft.total, draft.paidAmount);

    const saved: SalesInvoice = { ...draft, lines: realLines, status: nextStatus };

    setInvoices((prev) => {
      const exists = prev.some((i) => i.id === saved.id);
      return exists ? prev.map((i) => (i.id === saved.id ? saved : i)) : [...prev, saved];
    });

    // TODO (Fase 6): al confirmar factura (status ≠ DRAFT/CANCELLED) →
    //   · emitir Receipt tipo INVOICE, direction=OUTBOUND via onSaleConfirmed hook
    //   · crear EntityBalanceEntry({
    //       entityId: clientId, role: "CLIENT", entryType: "SALE_INVOICE",
    //       amount: totals.total, currency, documentRef: saved.number,
    //       breakdownSnapshot: { lines, taxes, deliveryNumber, salesOrderNumber }
    //     })
    //   · cargar deuda en la cuenta corriente del cliente
    //   · respetar moneda + fxRate (cuando se agregue) para conversión a base
    toast.success(
      isNew
        ? `Factura ${saved.number} creada — cuenta corriente próximamente`
        : `Factura ${saved.number} actualizada`,
    );

    // Guardado exitoso → limpiamos el snapshot para que no se dispare la
    // confirmación de salida.
    initialDraftJsonRef.current = null;
    setEditorOpen(false);
    setDraft(null);
  }

  // ── Row actions ──────────────────────────────────────────────────────────
  function rowActions(i: SalesInvoice): TPActionsMenuItem[] {
    return [
      {
        label: "Ver factura",
        icon: <Eye size={14} />,
        onClick: () => toast.info(`Ver factura ${i.number} — próximamente`),
      },
      {
        label: "Editar",
        icon: <Pencil size={14} />,
        onClick: () => toast.info(`Editar factura ${i.number} — próximamente`),
      },
      { type: "separator" },
      {
        label: "Registrar cobro",
        icon: <Wallet size={14} />,
        // TODO (Fase 6): abrir modal de cobro → crear EntityBalanceEntry de cobro +
        // actualizar paidAmount + recalcular status via derivePaymentStatus.
        onClick: () => toast.info("Cobro de cliente — próximamente"),
      },
      {
        label: "Anular",
        icon: <X size={14} />,
        onClick: () => toast.info(`Anular factura ${i.number} — próximamente`),
      },
      { type: "separator" },
      {
        label: "Imprimir",
        icon: <Printer size={14} />,
        onClick: () => toast.info("Impresión — próximamente"),
      },
    ];
  }

  // ── Render row ───────────────────────────────────────────────────────────
  function renderRow(
    r: SalesInvoice,
    vis: Record<string, boolean>,
    _sel?: unknown,
    orderedKeys?: string[],
  ) {
    const balance = Math.max(0, r.total - r.paidAmount);
    const reference =
      r.deliveryNumber || r.salesOrderNumber
        ? [r.deliveryNumber, r.salesOrderNumber].filter(Boolean).join(" · ")
        : "—";
    const isExpanded = expandedIds.has(r.id);
    const showAging  = r.status !== "PAID" && r.status !== "CANCELLED" && balance > 0;

    const cells: Record<string, React.ReactNode> = {
      expander: (
        <TPTd className="px-1">
          <TPRowExpandToggle
            isExpanded={isExpanded}
            onToggle={() => toggleExpanded(r.id)}
            title={isExpanded ? "Ocultar detalle" : "Ver detalle"}
          />
        </TPTd>
      ),
      number:    <TPTd className="font-mono text-xs font-semibold text-text">{r.number}</TPTd>,
      date:      <TPTd className="text-sm text-text/80">{fmtDate(r.date)}</TPTd>,
      client:    <TPTd className="text-sm text-text truncate">{r.client || <span className="text-muted">Sin cliente</span>}</TPTd>,
      reference: <TPTd className="font-mono text-[11px] text-muted">{reference}</TPTd>,
      payment: (
        <TPTd>
          <TPProgressCell value={r.paidAmount} total={r.total} />
        </TPTd>
      ),
      total:     <TPTd className="text-right tabular-nums font-semibold">{fmtMoney(r.total, r.currency)}</TPTd>,
      balance: (
        <TPTd className="text-right">
          <TPBalanceCell value={balance} currency={r.currency} />
        </TPTd>
      ),
      aging: (
        <TPTd className="text-right text-xs">
          {showAging
            ? <TPAgingCell dueDate={r.dueDate || undefined} />
            : <span className="text-muted">—</span>}
        </TPTd>
      ),
      status: (
        <TPTd>
          <TPStatusBadge
            status={r.status}
            tone={r.status === "PARTIAL" ? "info" : undefined}
          />
        </TPTd>
      ),
      actions: (
        <TPTd className="text-right px-2" data-tp-actions>
          <TPActionsMenu items={rowActions(r)} title="Acciones" />
        </TPTd>
      ),
    };

    const keys = orderedKeys && orderedKeys.length > 0
      ? orderedKeys
      : COLS.filter((c) => vis[c.key] !== false).map((c) => c.key);

    return (
      <React.Fragment key={r.id}>
        <TPTr>
          {keys.map((k) => (
            <React.Fragment key={k}>{cells[k]}</React.Fragment>
          ))}
        </TPTr>
        <TPRowExpanded isExpanded={isExpanded} colSpan={keys.length}>
          <TPDocumentTimeline
            title="Documentos relacionados"
            items={mockDerivedDocuments(r)}
            emptyText="Todavía no hay cobros aplicados ni documento origen vinculado."
          />
        </TPRowExpanded>
      </React.Fragment>
    );
  }

  // ── Filtros ──────────────────────────────────────────────────────────────
  const filters = (
    <div className="flex items-center gap-2">
      <div className="w-44">
        <TPSelect
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
          options={statusOptions}
        />
      </div>
      <div className="w-48">
        <TPSelect
          value={clientFilter}
          onChange={setClientFilter}
          options={clientOptions}
        />
      </div>
    </div>
  );

  return (
    <TPSectionShell
      title="Facturas"
      subtitle="Comprobantes de venta"
      right={
        <TPButton variant="primary" onClick={openNew} iconLeft={<Plus size={14} />}>
          Nueva factura
        </TPButton>
      }
    >
      <div className="space-y-4">
        <TPKpiBar items={kpis} columns={5} />

        <TPTableKit<SalesInvoice>
          rows={filtered}
          columns={COLS}
          storageKey="tp_sales_invoices_cols"
          search={{
            value: q,
            onChange: setQ,
            placeholder: "Buscar por número, cliente, orden o entrega…",
            debounceMs: 150,
          }}
          sortPersistKey="tp_sales_invoices"
          columnPicker
          headerLeft={filters}
          countLabel={(n) => `${n} ${n === 1 ? "factura" : "facturas"}`}
          emptyText={
            q || statusFilter !== "ALL" || clientFilter !== "ALL"
              ? "Sin resultados con los filtros aplicados."
              : "Todavía no hay facturas. Creá la primera desde «Nueva factura»."
          }
          renderRow={renderRow}
        />
      </div>

      {draft && (
        <InvoiceEditorModal
          open={editorOpen}
          draft={draft}
          isNew={isNew}
          onChange={setDraft}
          onSave={saveDraft}
          onClose={requestCloseEditor}
          templateTerms={templateTerms}
          onTemplateTermsChange={setTemplateTerms}
        />
      )}

      <ConfirmDeleteDialog
        open={confirmDiscardOpen}
        title="Cambios sin guardar"
        description="Tenés cambios sin guardar. ¿Querés salir igualmente?"
        confirmText="Salir sin guardar"
        cancelText="Seguir editando"
        icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
        onClose={() => {
          setConfirmDiscardOpen(false);
          // Si la navegación interna había sido bloqueada, la reseteamos para
          // que el usuario se quede donde está.
          if (blocker.state === "blocked") blocker.reset();
        }}
        onConfirm={() => {
          setConfirmDiscardOpen(false);
          closeEditor();
          // Si veníamos de un intento de navegación interna, la dejamos seguir.
          if (blocker.state === "blocked") blocker.proceed();
        }}
      />
    </TPSectionShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal editor
// ─────────────────────────────────────────────────────────────────────────────

function InvoiceEditorModal(props: {
  open: boolean;
  draft: SalesInvoice;
  isNew: boolean;
  onChange: (next: SalesInvoice) => void;
  onSave: () => void;
  onClose: () => void;
  /** footerTerms de la plantilla FACTURA (resuelto en la página). */
  templateTerms: string;
  /** Refresca el footerTerms cacheado tras "Guardar como predeterminado". */
  onTemplateTermsChange: (v: string) => void;
}) {
  const { open, draft, isNew, onChange, onSave, onClose, templateTerms, onTemplateTermsChange } = props;

  const { can } = usePermissions();

  // Id del Receipt persistido (borrador guardado en backend). Habilita
  // adjuntos. Se resetea cuando se abre un comprobante distinto.
  const [savedReceiptId, setSavedReceiptId] = useState<string | null>(null);
  useEffect(() => {
    setSavedReceiptId(null);
  }, [draft.id]);

  // Almacén favorito del usuario (con fallback al favorito del tenant si el
  // backend lo agregara más adelante). Lo usamos para inicializar
  // automáticamente `draft.warehouse` y `defaultLineWarehouseId` cuando el
  // operador no eligió uno explícitamente. Convención del proyecto.
  const { favoriteWarehouseId } = useInventory();

  // ── Estado visual local (no persiste, no afecta cálculos) ────────────────
  const [viewMode, setViewMode]     = useState<"unified" | "detailed">("detailed");
  const [extrasOpen, setExtrasOpen] = useState(false);

  // ── Cards colapsables con persistencia ──────────────────────────────────
  // Claves PER-SCREEN (`tp:sales:invoices:...`) — al replicar a hermanas,
  // cambiar el segundo segmento (`invoices` → `quotes`/`orders`/etc.).
  // Ver convención completa en `document-types.ts` → `LS_KEYS`.
  const DISCOUNT_CARD_KEY = lsKey("sales", "invoices", "discount-card-expanded");
  const SHIPPING_CARD_KEY = lsKey("sales", "invoices", "shipping-card-expanded");
  const PAYMENT_CARD_KEY  = lsKey("sales", "invoices", "payment-card-expanded");
  const IMPACT_CARD_KEY   = lsKey("sales", "invoices", "account-impact-card-expanded");

  // FASE 8.2.4 — el helper local `readBoolPref` y los 4 pares useState+useEffect
  // se consolidaron en `useCardCollapse` (src/lib/sales/useCardCollapse.ts).
  // Mismas claves → preferencias persistidas se preservan sin migración.
  const [discountOpen, setDiscountOpen] = useCardCollapse(DISCOUNT_CARD_KEY, true);
  const [shippingOpen, setShippingOpen] = useCardCollapse(SHIPPING_CARD_KEY, true);
  const [paymentOpen,  setPaymentOpen]  = useCardCollapse(PAYMENT_CARD_KEY,  true);
  const [impactOpen,   setImpactOpen]   = useCardCollapse(IMPACT_CARD_KEY,   true);

  // ── Fase 5 — Único camino: salesApi.preview ─────────────────────────────
  //
  // Cuando cambia cualquier input comercial (artículos, cantidades, cliente,
  // canal, cupón, envío, descuento global), llamamos a `salesApi.preview`
  // con debounce. La respuesta hidrata `draft.lines` y los totales del
  // documento vía `applySalePreviewToDraft`. El frontend NO calcula precios
  // — solo arma inputs y muestra resultado.
  //
  // Si el preview falla (`previewStatus === "error"`) caemos al fallback
  // `legacyFallbackRecomputeTotals` para no mostrar ceros, y el header
  // muestra los últimos valores válidos del backend si los teníamos.

  // FASE 8.2.4b — state machine del preview encapsulada en `usePreviewFlow`.
  // Conservamos el ref `previewReqIdRef` acá porque otros consumidores lo
  // mutan para invalidar fetches en vuelo (handleClientPick, handleLineArticlePick).
  const previewReqIdRef = useRef(0);

  // Monedas reales (GET /valuation/currencies). Necesarias para mostrar code +
  // symbol + cotización (latestRate) en el badge superior, y para resolver el
  // `currencyId` (UUID) que viaja al backend en `sales/preview` (Fase MM).
  // El state se declara acá (antes de `previewSignature`) porque ambos
  // dependen de él; el effect de fetch sigue donde estaba.
  const [currencies, setCurrencies] = useState<CurrencyRow[]>([]);

  // Almacenes reales (GET /warehouses) — para el picker de almacén por línea
  // y para el selector global. Se declara acá (antes de `whLabel` y del
  // popover global) porque ambos dependen del catálogo. El effect de fetch
  // sigue donde estaba.
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);

  /**
   * Resuelve el id (UUID) de la moneda del documento contra el catálogo.
   * `draft.currency` puede venir como code (ARS) o como id, según el origen
   * (cliente cargado, default del tenant, etc). El backend solo acepta id.
   */
  const documentCurrencyId = useMemo<string | null>(() => {
    const cur = currencies.find(
      (c) => c.code === draft.currency || c.id === draft.currency,
    );
    return cur?.id ?? null;
  }, [currencies, draft.currency]);

  /** Firma reproducible de los inputs que afectan el cálculo. */
  const previewSignature = useMemo<string | null>(() => {
    const { hasRealLines, payload } = buildSalePreviewPayload(draft, documentCurrencyId);
    if (!hasRealLines) return null;
    // `draft.fxRate` se incluye en la firma (aunque el payload no lo lleve)
    // para que cambiar la cotización manual dispare un re-preview. El
    // backend hoy no procesa `fxRate` directamente — convierte usando la
    // cotización vigente del catálogo para `currencyId` —, pero igual es
    // útil porque mantiene la firma sincronizada con el estado visible y
    // deja la puerta abierta a Fase MM cuando el backend acepte `fxRate`.
    return JSON.stringify({ ...payload, _fxRate: draft.fxRate });
  }, [
    draft.lines,
    draft.clientId,
    draft.channelId,
    draft.couponCode,
    draft.shipping,
    draft.discountGlobal,
    // Lista global del documento — sin esto cambiar la lista en el header
    // no dispara el preview (las líneas siguen mostrando el precio viejo).
    draft.priceListId,
    // Moneda del documento (resuelto a id) y cotización activa.
    documentCurrencyId,
    draft.fxRate,
  ]);

  // FASE 8.2.4b — hook reutilizable de preview flow.
  // Encapsula: debounce 200ms + anti-stale via `previewReqIdRef` (compartido
  // con handleClientPick / handleLineArticlePick) + status machine + cache.
  const { status: previewStatus, cached: backendPreview } =
    usePreviewFlow<SalePreviewResult>({
      signature: previewSignature,
      enabled:   open,
      requestIdRef: previewReqIdRef,
      executePreview: async () => {
        const { payload } = buildSalePreviewPayload(draft, documentCurrencyId);
        const res = await salesApi.preview(payload);
        // FASE 1 — paridad Simulador ↔ Factura. Logea el snapshot normalizado
        // para que `__tptechParity.diff()` lo compare contra el del Simulador.
        try {
          logParity("invoice", { payload, normalized: normalizeSalesPreview(res) });
        } catch {
          // No bloquear la factura por un error del logger dev-only.
        }
        return res;
      },
      onApplyPreview: (res) => {
        // Fase 5 — hidratamos el draft con los datos del backend.
        onChange(applySalePreviewToDraft(draft, res));
      },
      onPreviewError: (e) => {
        // FASE 9 — I1: no podemos quedarnos en silencio. Si el motor falla
        // (500, timeout, cliente desactivado), el footer deja de spinnear y
        // los totales quedan congelados en el último resultado válido — el
        // operador no se entera. Ahora avisamos con toast + chip "Totales
        // sin actualizar" en <TotalsHeroSection> mientras `previewStatus`
        // sea "error" y exista una respuesta cacheada.
        toast.error(
          "No se pudieron actualizar los totales. Los valores mostrados " +
          "pueden estar desactualizados — repetí la acción para reintentar.",
        );
        // eslint-disable-next-line no-console
        console.warn("[VentasFacturas] salesApi.preview falló:", e);
      },
    });

  /**
   * Totales que la UI muestra. Tras Fase 5 el draft YA está hidratado por
   * el backend (vía `applySalePreviewToDraft`), así que `draft.*` ES la
   * fuente de verdad. Si todavía no llegó el preview o falló, mantenemos
   * el último valor válido del backend si existe; si no, mostramos lo que
   * haya en `draft.*` (puede venir del fallback local). NUNCA mostramos
   * ceros mientras carga si ya teníamos datos buenos.
   */
  const effectiveTotals = useMemo(() => {
    // Sin líneas reales (todas vacías o el operador eliminó todo) los
    // totales tienen que ser 0. NO caer al `draft.*` porque ese mantiene
    // los importes del último preview con líneas → "fantasma" que confunde
    // al operador. `previewSignature === null` es la señal canónica de
    // "no hay nada que cobrar" (ver `buildSalePreviewPayload.hasRealLines`).
    if (previewSignature === null) {
      return {
        subtotal:       0,
        discountAmount: 0,
        taxAmount:      0,
        roundingAdjustment: 0,
        total:          0,
        fromBackend:    false,
      };
    }
    if (
      backendPreview &&
      backendPreview.signature === previewSignature &&
      backendPreview.result.documentTotals
    ) {
      const dt = backendPreview.result.documentTotals;
      return {
        subtotal:       dt.subtotalAfterLineDiscounts,
        discountAmount: round2(
          dt.lineDiscountAmount +
          dt.couponDiscountAmount +
          dt.globalDiscountAmount,
        ),
        taxAmount:      dt.taxAmount,
        // Ajuste de redondeo de la lista de precios (positivo o negativo).
        // Lo expone el motor en `documentTotals.roundingAdjustment`.
        roundingAdjustment: dt.roundingAdjustment ?? 0,
        total:          dt.total,
        fromBackend:    true,
      };
    }
    return {
      subtotal:       draft.subtotal,
      discountAmount: draft.discountAmount,
      taxAmount:      draft.taxAmount,
      roundingAdjustment: 0,
      total:          draft.total,
      fromBackend:    false,
    };
  }, [draft, backendPreview, previewSignature]);

  /**
   * Composición visual del total — alimenta el Hero "Total a facturar".
   *
   * Toma el resultado del backend cuando coincide con la firma actual; si no,
   * pasa `preview = null` y el helper devuelve un detail con todos los
   * conceptos en `null` (la UI los pinta como "No aplicado"). Las líneas del
   * draft ya están hidratadas con `pricingMeta`, por eso se pueden usar como
   * fuente para agregar tax breakdown y descuentos por línea.
   */
  const pricingDetail = useMemo(() => {
    const matched =
      backendPreview &&
      backendPreview.signature === previewSignature
        ? backendPreview.result
        : null;
    return composeDocumentPricingDetail({
      preview:          matched,
      lines:            draft.lines,
      fallbackTotal:    effectiveTotals.total,
      fallbackShipping: draft.shipping?.cost ?? 0,
    });
  }, [backendPreview, previewSignature, draft.lines, draft.shipping, effectiveTotals.total]);

  /**
   * ViewModel normalizado del preview — mismo shape que consume el
   * Simulador y el Comparador. Solo se computa cuando la firma del backend
   * coincide con la del draft actual; si no, queda en `null` y el detalle
   * por línea muestra placeholder. CERO matemática comercial — passthrough
   * puro vía `normalizeSalesPreview`.
   */
  const normalizedPreview = useMemo(() => {
    if (!backendPreview || backendPreview.signature !== previewSignature) return null;
    try {
      return normalizeSalesPreview(backendPreview.result);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[VentasFacturas] normalizeSalesPreview falló:", e);
      return null;
    }
  }, [backendPreview, previewSignature]);

  /**
   * Mapeo posicional draft ↔ normalizedPreview, por slot de draft.
   *
   * Fuente única para cualquier consumidor visual que lea el normalizado
   * por línea (`linesForView`, `renderLineExtras`, etc.). `matchPreviewLines`
   * aplica el predicado canónico `isPreviewableLine` y devuelve un array del
   * mismo largo que `draft.lines`, con `null` en los slots no previewables.
   *
   * Cualquier `normalizedPreview.lines[idx]` directo fuera de este memo es
   * un bug — debe leerse desde acá.
   *
   * Bug histórico cubierto (regresión del 990): el reader visual saltaba las
   * líneas manuales sin avanzar el índice del preview, así que el artículo
   * siguiente leía el preview de la manual y mostraba su `lineTotalWithTax`
   * (ej. 990) pegado al total. La invariante a mantener es que los tres
   * consumidores (`buildSalePreviewPayload`, `applySalePreviewToDraft`,
   * y este memo) usen el MISMO predicado.
   */
  const matchedNormalized = useMemo(() => {
    return matchPreviewLines(draft.lines, normalizedPreview?.lines ?? null);
  }, [draft.lines, normalizedPreview]);

  const linesForView = useMemo(() => {
    const signatureMatches =
      !!backendPreview && backendPreview.signature === previewSignature;
    return draft.lines.map((l, i) =>
      selectInvoiceLineView(l, matchedNormalized[i], signatureMatches),
    );
  }, [draft.lines, matchedNormalized, backendPreview, previewSignature]);

  /**
   * Fase 2 — ajustes globales del documento que la grilla editable
   * (`SaleCompositionEditableGrid`) muestra debajo de la tabla de
   * componentes. Passthrough puro del preview backend + estado del draft.
   * Cero matemática frontend.
   *
   * Solo se computa cuando la firma del backend matchea la del draft actual
   * (sino los amounts no son confiables). En ese caso devuelve `undefined`
   * y el bloque queda oculto.
   */
  const saleGlobalAdjustments = useMemo(() => {
    if (!backendPreview || backendPreview.signature !== previewSignature) return undefined;
    const r  = backendPreview.result;
    const dt = r?.documentTotals;
    if (!dt) return undefined;

    const channel = r.channelResult && Number.isFinite(r.channelResult.channelAmount) && r.channelResult.channelAmount !== 0
      ? { name: r.channelResult.channelName, amount: r.channelResult.channelAmount }
      : null;
    const coupon = r.couponResult && r.couponResult.applied
      && Number.isFinite(r.couponResult.discountAmount) && r.couponResult.discountAmount > 0
      ? { code: r.couponResult.couponCode, name: r.couponResult.couponName, amount: r.couponResult.discountAmount }
      : null;
    // Forma de pago: VentasFacturas todavía no manda `paymentMethodId` al
    // preview (Fase 7 lo conectará). Mientras tanto, queda en null.
    const payment = null;
    // Envío: usamos el monto resuelto por el backend (`dt.shippingAmount`)
    // y el modo del draft como label.
    // `DocumentShipping` (legacy local) no expone `mode`; el modo solo
    // existe en el payload backend (`shipping.mode`). Mientras esa info no
    // se rehidrate al draft, mostramos un label neutro "Envío".
    const shipping = Number.isFinite(dt.shippingAmount) && dt.shippingAmount !== 0
      ? { mode: "FIXED", amount: dt.shippingAmount, label: "Envío" }
      : null;
    const globalDiscount = Number.isFinite(dt.globalDiscountAmount) && dt.globalDiscountAmount > 0 && draft.discountGlobal
      ? {
          type:   draft.discountGlobal.type,
          value:  draft.discountGlobal.value,
          amount: dt.globalDiscountAmount,
        }
      : null;

    return { channel, coupon, payment, shipping, globalDiscount };
  }, [backendPreview, previewSignature, draft.shipping, draft.discountGlobal]);

  // FASE 8.2.4 — los 4 useEffect que persistían discountOpen/shippingOpen/
  // paymentOpen/impactOpen a localStorage se eliminaron al adoptar
  // `useCardCollapse`. El hook hace write-through automático.

  // ── Visibilidad del buscador rápido / escaneo (persiste por usuario) ─────
  // Clave SHARED entre todos los comprobantes con líneas — ver LS_KEYS en
  // `document-types.ts`. Si el usuario alterna en una pantalla, queda igual
  // en las hermanas.
  const QUICK_SEARCH_KEY = LS_KEYS.QUICK_SEARCH_VISIBLE;
  const [showQuickSearch, setShowQuickSearch] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const v = window.localStorage.getItem(QUICK_SEARCH_KEY);
      if (v === "false") return false;
    } catch {}
    return true;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(QUICK_SEARCH_KEY, String(showQuickSearch)); } catch {}
  }, [showQuickSearch]);

  // Cada toggle a "visible" incrementa el signal para enfocar el input
  // (sin robar foco inicial al cliente cuando el modal abre).
  const [scanFocusSignal, setScanFocusSignal] = useState(0);
  function toggleQuickSearch() {
    setShowQuickSearch((prev) => {
      const next = !prev;
      if (next) setScanFocusSignal((n) => n + 1);
      return next;
    });
  }

  // ── Carga rápida de líneas: foco automático en el combo de la próxima
  //     línea vacía tras seleccionar un artículo en cualquier línea ────────
  // `focusLineId` apunta a la línea que debe enfocarse; `focusLineBump` se
  // incrementa para forzar el efecto de foco aunque el id no cambie.
  const [focusLineId,   setFocusLineId]   = useState<string | null>(null);
  const [focusLineBump, setFocusLineBump] = useState(0);

  // ── Cobros (mock local — no persisten en la factura) ────────────────────
  // Cada entrada se inicializa con la moneda de la factura. El `paidAmount`
  // del draft se sincroniza vía useEffect para que el saldo / status del resto
  // de la pantalla siga funcionando sin tocar la lógica existente.
  const [payments, setPayments] = useState<PaymentEntry[]>([]);

  const totalCobrado = useMemo(
    () => payments.reduce((s, p) => s + (Number.isFinite(p.amount) ? p.amount : 0), 0),
    [payments],
  );

  useEffect(() => {
    if (Math.abs((draft.paidAmount ?? 0) - totalCobrado) < 0.001) return;
    onChange({ ...draft, paidAmount: totalCobrado });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalCobrado]);

  function addPayment() {
    const remaining = Math.max(0, effectiveTotals.total - totalCobrado);
    setPayments((prev) => {
      const next = makeEmptyPayment(draft.currency);
      // Pre-llenar con el saldo restante para acelerar el caso típico.
      next.amount = round2(remaining);
      return [...prev, next];
    });
  }

  function updatePayment(id: string, patch: Partial<PaymentEntry>) {
    setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function removePayment(id: string) {
    setPayments((prev) => prev.filter((p) => p.id !== id));
  }

  // No auto-añadir placeholder cuando lines=0. El usuario debe poder dejar
  // el listado vacío y usar los botones del header ("+ Línea vacía" /
  // "+ Escanear artículo") cuando quiera empezar a cargar.

  // ── Expand/collapse de cada línea (lifteado del editor avanzado) ────────
  // Vivir acá permite que el botón global "Expandir/Colapsar todo" del
  // header del card de Líneas sincronice DOS estados:
  //   1. `expandedLineIds`     — fila principal de la línea expandida
  //   2. `advancedOpenLineIds` — panel avanzado interno
  //                              (`LineAdvancedOverridesPanel` =
  //                               "Composición del precio de venta")
  // Antes el segundo state vivía dentro del editor sin acceso del padre,
  // así que "Expandir todo" abría la fila pero no el bloque interno.
  const [expandedLineIds, setExpandedLineIds]         = useState<Set<string>>(() => new Set());
  const [advancedOpenLineIds, setAdvancedOpenLineIds] = useState<Set<string>>(() => new Set());
  // Intención global del operador: cuando presiona "Expandir todo" queremos
  // que las líneas NUEVAS que agregue después también nazcan expandidas
  // (sticky). Cualquier toggle individual sale del modo sticky para no
  // pisar la decisión del usuario sobre líneas específicas.
  const stickyAllExpandedRef = useRef(false);

  // Fase 4.5 — Enter = next field. El hook se aplica al wrapper del
  // editor de líneas (`editorScopeRef`) para acotar el comportamiento
  // a la zona editable de la factura. Feature flag local: si emerge
  // alguna interacción rota, podemos desactivarlo de inmediato sin
  // remover código.
  const editorScopeRef = useRef<HTMLDivElement | null>(null);
  const enableEnterNavigation = true;
  useEnterTabNavigation(editorScopeRef, enableEnterNavigation);

  function toggleLineExpand(lineId: string) {
    // Toggle individual → salimos del modo sticky.
    stickyAllExpandedRef.current = false;
    setExpandedLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId); else next.add(lineId);
      return next;
    });
  }

  function toggleLineAdvancedOpen(lineId: string) {
    // Toggle individual del panel avanzado → también sale del modo sticky
    // global, para que la próxima línea nueva no se auto-expanda si el
    // operador empezó a tomar decisiones por línea.
    stickyAllExpandedRef.current = false;
    setAdvancedOpenLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId); else next.add(lineId);
      return next;
    });
  }

  // Solo líneas con artículo cuentan para "Expandir todo" (el placeholder
  // vacío y las cabeceras no tienen simulador / detalle que mostrar).
  const realLineIds = useMemo(
    () =>
      draft.lines
        .filter((l) => !isEmptyLine(l) && !isHeaderLine(l))
        .map((l) => l.id),
    [draft.lines],
  );

  // Subtotales por cabecera: sumar los `lineTotal` de las líneas que vienen
  // después de cada HEADER hasta la próxima HEADER. Las líneas previas a la
  // primera cabecera no se asocian a ningún grupo.
  const headerSubtotals = useMemo(() => {
    const map = new Map<string, number>();
    let currentHeaderId: string | null = null;
    let currentSum = 0;
    for (const l of draft.lines) {
      if (l.type === "HEADER") {
        if (currentHeaderId !== null) map.set(currentHeaderId, currentSum);
        currentHeaderId = l.id;
        currentSum = 0;
      } else if (currentHeaderId !== null) {
        currentSum += (l.lineTotal ?? 0);
      }
    }
    if (currentHeaderId !== null) map.set(currentHeaderId, currentSum);
    return map;
  }, [draft.lines]);
  // "Expandir todo" se considera activo cuando AMBOS sets cubren todas las
  // líneas reales. Sin la condición sobre `advancedOpenLineIds`, el botón
  // mostraba "Colapsar todo" cuando solo las filas estaban abiertas pero
  // los paneles internos no — operador veía un toggle en estado mixto.
  const allExpanded = useMemo(
    () =>
      realLineIds.length > 0 &&
      realLineIds.every((id) => expandedLineIds.has(id)) &&
      realLineIds.every((id) => advancedOpenLineIds.has(id)),
    [realLineIds, expandedLineIds, advancedOpenLineIds],
  );
  function toggleAllLinesExpand() {
    if (allExpanded) {
      stickyAllExpandedRef.current = false;
      setExpandedLineIds(new Set());
      setAdvancedOpenLineIds(new Set());
    } else {
      stickyAllExpandedRef.current = true;
      const all = new Set(realLineIds);
      setExpandedLineIds(all);
      setAdvancedOpenLineIds(new Set(all));
    }
  }

  // Sincronizar AMBOS sets con el conjunto vigente de líneas reales:
  //   1. Drop de IDs huérfanos (líneas eliminadas / vaciadas / convertidas
  //      a cabecera) — sin esto los Sets crecen indefinidamente y conservan
  //      decisiones de líneas que ya no existen.
  //   2. Si el operador estaba en modo "Expandir todo" sticky, agregar las
  //      líneas nuevas a AMBOS sets para que respeten el estado global
  //      (fila principal + panel avanzado interno). Sin esto, duplicar /
  //      agregar una línea con "Expandir todo" activo la dejaba a medio
  //      expandir.
  // El effect corre solo cuando cambia el conjunto de IDs (no en cada
  // hidratación de preview, porque `realLineIds` está memoizado por
  // `draft.lines` y los IDs son estables). NO modifica los Sets si no
  // hay cambios.
  useEffect(() => {
    const valid = new Set(realLineIds);
    const sticky = stickyAllExpandedRef.current;
    const reconcile = (prev: Set<string>): Set<string> => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (valid.has(id)) next.add(id);
        else changed = true;
      }
      if (sticky) {
        for (const id of realLineIds) {
          if (!next.has(id)) {
            next.add(id);
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    };
    setExpandedLineIds(reconcile);
    setAdvancedOpenLineIds(reconcile);
  }, [realLineIds]);

  // ── Modal de FX (moneda + cotización) ────────────────────────────────────
  const [fxOpen, setFxOpen] = useState(false);
  const [fxDraft, setFxDraft] = useState<{ currency: string; fxRate: number }>({
    currency: draft.currency,
    fxRate:   draft.fxRate,
  });
  // Flag para impactar también el catálogo de monedas (POST /currencies/:id/rates).
  // Default false: la cotización del modal solo afecta este documento.
  const [fxUpdateSystem, setFxUpdateSystem] = useState(false);

  /** Busca una moneda por code (ARS) o id (uuid). */
  function findCurrency(idOrCode?: string): CurrencyRow | undefined {
    if (!idOrCode) return undefined;
    return currencies.find((c) => c.code === idOrCode || c.id === idOrCode);
  }

  /** True si la moneda recibida es la moneda base del tenant. */
  function isBaseCurrencyReal(idOrCode?: string): boolean {
    const cur = findCurrency(idOrCode);
    if (cur) return cur.isBase;
    // Fallback: si todavía no se cargaron las monedas, usar el helper del mock.
    return isBaseCurrency(idOrCode);
  }

  function openFx() {
    setFxDraft({ currency: draft.currency, fxRate: draft.fxRate });
    setFxUpdateSystem(false);
    setFxOpen(true);
  }

  /** Cambia la moneda del modal — autorrellena la cotización con la última
   *  vigente del catálogo (si existe). Si es base, fija 1. */
  function handleFxCurrencyChange(code: string) {
    const cur = findCurrency(code);
    if (cur?.isBase) {
      setFxDraft({ currency: code, fxRate: 1 });
      return;
    }
    const next = cur?.latestRate ?? fxDraft.fxRate;
    setFxDraft({ currency: code, fxRate: next ?? 1 });
  }

  async function applyFx() {
    const isBase = isBaseCurrencyReal(fxDraft.currency);
    const baseCur = currencies.find((c) => c.isBase);
    const prevCurrency = draft.currency;
    const nextCurrency = fxDraft.currency || baseCur?.code || "ARS";
    const prevFxRate   = draft.fxRate;
    // FASE 9 — C1: validamos que la cotización sea estrictamente positiva.
    // Antes admitíamos `0` o negativo (TPNumberInput.min=0 deja pasar el
    // literal cero). El downstream lo persistía en el receipt como
    // `currencyRate=0` y `totalBase=0` aunque `draft.total > 0` — data
    // corruption. Bloqueamos con toast y no aplicamos.
    const fxOk = Number.isFinite(fxDraft.fxRate) && fxDraft.fxRate > 0;
    if (!isBase && !fxOk) {
      toast.error("La cotización debe ser un número mayor a cero.");
      return;
    }
    const nextFxRate = isBase ? 1 : fxDraft.fxRate;

    // Side-effect opcional: actualizar la cotización oficial en el catálogo
    // de monedas (crea fila en `CurrencyRate` con `effectiveAt=now`). Solo
    // afecta futuros documentos. Los comprobantes ya confirmados no se
    // tocan: usan la `currencyRate` persistida en su snapshot (POLICY §9).
    if (fxUpdateSystem && !isBase) {
      const cur = findCurrency(nextCurrency);
      if (cur?.id) {
        try {
          await addCurrencyRate(cur.id, {
            rate: nextFxRate,
            effectiveAt: new Date().toISOString(),
          });
          toast.success("Cotización actualizada en el catálogo de monedas.");
        } catch (err: any) {
          // No bloqueamos: la cotización del documento se aplica igual.
          toast.error(
            `No se pudo actualizar la cotización oficial: ${err?.message ?? "error"}. ` +
            "El cambio se aplicó solo a este documento.",
          );
        }
      }
    }

    onChange({
      ...draft,
      currency: nextCurrency,
      fxRate:   nextFxRate,
    });
    setFxOpen(false);
    setFxUpdateSystem(false);
    // Conversión visual (igual que `PricingSimulator`): los amounts del
    // backend permanecen en moneda base, y `displayRate` los multiplica al
    // formatearlos. Si en el futuro el backend acepta `currency`/`fxRate`
    // en `/sales/preview`, agregar ambos a las deps de `previewSignature`
    // para que también se dispare un recálculo real contra el motor.
    void prevCurrency; void prevFxRate;
  }

  /**
   * Persiste el draft contra el backend (`POST /receipts`) en estado DRAFT.
   * No dispara efectos colaterales (stock, cuenta corriente). El frontend
   * mantiene su estado local — el backend devuelve el receipt con su id y
   * code (placeholder DRAFT-...).
   */
  /**
   * FASE 8.2.5c — Orchestrator DELGADO de `saveDraftToBackend`.
   *
   * Toda la lógica pura (filtro de líneas reales + assembly del payload +
   * line transformation + snapshot versionado) vive en
   * `src/lib/sales/buildReceiptDraftPayload.ts` con tests unitarios.
   *
   * Acá queda lo NO-puro: guard `draftSaving`, toasts, setState, async POST.
   */
  async function saveDraftToBackend() {
    if (draftSaving) return;

    const built = buildReceiptDraftPayload({
      draft,
      currencies,
      predicates: { isEmptyLine, isHeaderLine },
    });
    if (!built.ok) {
      toast.error("Agregá al menos una línea para guardar el borrador.");
      return;
    }

    setDraftSaving(true);
    try {
      const saved = await receiptsApi.createDraft(built.payload);
      setSavedReceiptId(saved.id);
      toast.success(`Borrador guardado (id ${saved.id.slice(0, 8)}…).`);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar el borrador.");
    } finally {
      setDraftSaving(false);
    }
  }

  /**
   * "Guardar como predeterminado": persiste los Términos actuales como
   * `footerTerms` de la plantilla FACTURA (tenant-wide). El backend exige
   * sesión; el botón ya está gateado por permiso COMPANY_SETTINGS:EDIT en
   * el card. No recalcula nada — sólo guarda texto. Errores → toast (no
   * relanza; el diálogo de confirmación cierra igual).
   */
  async function handleSaveTermsAsDefault() {
    try {
      await documentTemplatesApi.save("FACTURA", { footerTerms: draft.terms ?? "" });
      onTemplateTermsChange((draft.terms ?? "").trim());
      toast.success("Términos guardados como predeterminados de la plantilla.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la plantilla.");
    }
  }

  // ── Acciones del documento: imprimir / etiquetas / email ─────────────────
  const [labelsOpen, setLabelsOpen] = useState(false);
  /**
   * Construye los `LabelItem[]` para el modal de etiquetas a partir de las
   * líneas reales de la factura. Filtra placeholders y headers; respeta la
   * cantidad multiplicando entradas. NO recalcula precios — usa los valores
   * que el motor ya devolvió en cada línea.
   */
  const labelItems = useMemo<LabelItem[]>(() => {
    const out: LabelItem[] = [];
    for (const l of draft.lines) {
      if (isEmptyLine(l) || isHeaderLine(l)) continue;
      const qty = Math.max(1, Math.floor(l.quantity || 1));
      // Una entrada por unidad — el modal ya tiene su propio "n copias",
      // pero acá generamos el set base (id único por instancia).
      for (let i = 0; i < qty; i++) {
        out.push({
          id:           `${l.id}::${i}`,
          code:         l.sku || "",
          name:         l.article || "",
          barcode:      null,
          barcodeType:  "CODE128",
          costPrice:    null,
          salePrice:    l.unitPrice != null ? String(l.unitPrice) : null,
          variantName:  l.variant || undefined,
          variantCode:  undefined,
          sku:          l.sku || undefined,
        });
      }
    }
    return out;
  }, [draft.lines]);

  /** Imprime el modal actual usando window.print(). El navegador genera el PDF. */
  function handlePrintDocument() {
    if (typeof window !== "undefined") window.print();
  }

  // ── Popovers de Lista / Almacén / Canal (contexto sobre el card de Líneas) ─
  const [listPopOpen, setListPopOpen] = useState(false);
  const listBtnRef = useRef<HTMLButtonElement>(null);
  const [whPopOpen, setWhPopOpen] = useState(false);
  const whBtnRef = useRef<HTMLButtonElement>(null);
  const [chPopOpen, setChPopOpen] = useState(false);
  const chBtnRef = useRef<HTMLButtonElement>(null);

  // Listas de precios reales (GET /price-lists) — IDs CUID que el backend
  // resuelve. Reemplaza a los mocks ("retail"/"wholesale") que devolvían
  // "cálculo parcial" porque no existen en DB.
  const [priceLists, setPriceLists] = useState<PriceListRow[]>([]);

  // Canales de venta reales (GET /sales-channels). El backend aplica el
  // ajuste del canal en pricing-preview vía `channelId`.
  const [salesChannels, setSalesChannels] = useState<SalesChannelRow[]>([]);

  // Catálogo de unidades de medida (GET /company/units). Lo usamos solo
  // para resolver el `code` que viaja en `picked.unitOfMeasure` al
  // `name` legible (ej. UND → "Unidad", G → "Gramos") en el label de
  // Cantidad. NO se envía al motor; es solo display.
  const [unitsCatalog, setUnitsCatalog] = useState<UnitRow[]>([]);
  const unitNameByCode = useMemo<Map<string, string>>(() => {
    const m = new Map<string, string>();
    for (const u of unitsCatalog) {
      if (u.code && u.name) m.set(u.code, u.name);
    }
    return m;
  }, [unitsCatalog]);

  // Mapa `currencyId → { code, symbol }` para que el editor avanzado pueda
  // etiquetar cost lines en moneda distinta a la del comprobante (display
  // de "Costo unit." en USD con equivalente en ARS). Passthrough puro del
  // catálogo del tenant — no se calcula nada nuevo.
  const currencyById = useMemo<Map<string, { code?: string | null; symbol?: string | null }>>(() => {
    const m = new Map<string, { code?: string | null; symbol?: string | null }>();
    for (const c of currencies) {
      if (c.id) m.set(c.id, { code: c.code ?? null, symbol: c.symbol ?? null });
    }
    return m;
  }, [currencies]);

  // Impuestos del tenant (GET /taxes) — solo se usa para asignar el
  // impuesto por defecto a líneas MANUALES (las de catálogo viajan con
  // su `taxAmount` calculado por el backend).
  const [salesTaxes, setSalesTaxes] = useState<TaxRow[]>([]);

  const listLabel = priceLists.find((p) => p.id === draft.priceListId)?.name ?? "Sin lista";
  // Resolución del label del almacén global desde el catálogo real (state
  // `warehouses`, ya filtrado por `isActive`). Reemplaza el lookup contra
  // `WAREHOUSE_MOCK_OPTIONS` que mostraba opciones hardcodeadas.
  const whLabel   = warehouses.find((w) => w.id === draft.warehouse)?.name ?? (draft.warehouse || "Sin almacén");
  const chLabel   = salesChannels.find((c) => c.id === draft.channelId)?.name ?? "Sin canal";

  // ── Ordenar líneas alfabéticamente (acción directa) ─────────────────────
  // Decisión UX: el botón de la toolbar ya no abre un menú con criterios —
  // ahora ejecuta directamente "Ordenar A-Z" por nombre visible. La
  // agrupación por categoría/marca/metal/etc. vive en "Generar cabeceras"
  // (otro botón), evitando la redundancia que había antes con dos menús
  // que ofrecían los mismos criterios.
// ── Generar cabeceras semi-automáticas ──────────────────────────────────
  const [headersPopOpen, setHeadersPopOpen] = useState(false);
  const headersBtnRef = useRef<HTMLButtonElement>(null);
  function handleGenerateHeadersBy(criterion: HeaderGroupBy) {
    // Rehidratar `headerSnapshot` desde el cache `pickedItemsByLineId` para
    // líneas que se cargaron antes de tener cableado el snapshot. Sin esto,
    // las líneas existentes caen al fallback "Sin <criterio>" y todas se
    // agrupan juntas. El cache vive mientras el modal está abierto, así
    // que es la fuente más fresca disponible sin runtime fetch al backend.
    const hydrated: DocumentLine[] = draft.lines.map((l) => {
      if (l.type === "HEADER") return l;
      if (l.headerSnapshot) return l;
      const picked = pickedItemsByLineId.get(l.id);
      if (!picked) return l;
      const snap = {
        categoryName: picked.categoryName,
        groupName:    picked.groupName,
        brand:        picked.brand,
        manufacturer: picked.manufacturer,
      };
      // Si todos vacíos, no agregamos snapshot (sigue cayendo al fallback).
      if (!snap.categoryName && !snap.groupName && !snap.brand && !snap.manufacturer) {
        return l;
      }
      return { ...l, headerSnapshot: snap };
    });
    const next = generateHeadersByCriterion(hydrated, criterion);
    onChange({ ...draft, lines: next });
    setHeadersPopOpen(false);
  }

  /** Ordena `draft.lines` por SKU/código del artículo.
   *  Decisión UX: el orden por SKU es lo que el operador de joyería usa
   *  todos los días (familias de productos comparten prefijo ANI-, CAD-,
   *  PEN-, etc.). El nombre comercial queda como fallback en la cascada
   *  de `articleSkuSortKey` cuando el SKU no está populado.
   *  Reglas (delegadas a `sortLinesPreservingHeaders`):
   *   · Comparador es-AR con `sensitivity:"base"` y `numeric:true`
   *     ("ANI-002" antes que "ANI-010"; insensible a mayúsculas/acentos).
   *   · Las cabeceras (`type === "HEADER"`) NO se mueven; el sort se
   *     aplica por SEGMENTO entre cabeceras consecutivas.
   *   · Líneas manuales sin SKU se ordenan por `manualDescription`; las
   *     manuales vacías y los placeholders quedan al final.
   *  Como cambia el orden de `draft.lines`, `previewSignature` cambia y
   *  el efecto de preview re-fetcha; los totales no cambian (motor
   *  idempotente). */
  function sortLinesBySku() {
    const next = sortLinesPreservingHeaders(draft.lines, articleSkuSortKey);
    onChange({ ...draft, lines: next });
  }

  // ── Modales de Vincular OV / Remito ──────────────────────────────────────
  const [linkOvOpen, setLinkOvOpen]     = useState(false);
  const [linkRemOpen, setLinkRemOpen]   = useState(false);
  const [linkOvDraft, setLinkOvDraft]   = useState("");
  const [linkRemDraft, setLinkRemDraft] = useState("");

  // ── Address picker ──────────────────────────────────────────────────────
  // FASE 8.2.2b — `addressBtnRef` y el state `addressPopOpen` migraron a
  // <InvoiceHeaderForm> (UI puramente local). Acá queda solo el modal
  // "Agregar / Editar dirección" que SÍ es de scope del padre (modal flotante
  // con su propio ciclo de vida + refetch del clientDetail).
  const [addressEditOpen, setAddressEditOpen] = useState(false);

  function openAddressEdit() {
    setAddressEditOpen(true);
  }

  /**
   * Callback de AddressEditModal.onSaved: refetcheamos el detail del
   * cliente para que la nueva dirección entre a la lista, y la
   * seleccionamos automáticamente en el documento.
   */
  async function handleAddressSaved(saved: { id: string; street?: string; streetNumber?: string; city?: string; province?: string; country?: string; postalCode?: string }) {
    setAddressEditOpen(false);
    if (!draft.clientId) return;
    try {
      const detail = await commercialEntitiesApi.getOne(draft.clientId);
      if (lastPickedClientIdRef.current !== draft.clientId) return;
      setClientDetail(detail);
      const addr = detail.addresses.find((a) => a.id === saved.id) ?? saved as any;
      if (addr) {
        const line = composeAddressLine(addr);
        const prevSnap = draft.clientSnapshot ?? { name: draft.client };
        onChange({
          ...draft,
          clientSnapshot: { ...prevSnap, address: line, addressId: addr.id },
        });
      }
    } catch (e: any) {
      toast.error("No se pudo refrescar las direcciones del cliente.");
    }
  }

  function selectClientAddress(addrId: string) {
    // El popover ya se cerró desde InvoiceHeaderForm; acá solo aplicamos la
    // dirección elegida al snapshot del cliente del documento.
    if (!clientDetail || !draft.clientSnapshot) return;
    const addr = clientDetail.addresses.find((a) => a.id === addrId);
    if (!addr) return;
    onChange({
      ...draft,
      clientSnapshot: {
        ...draft.clientSnapshot,
        address:   composeAddressLine(addr),
        addressId: addr.id,
      },
    });
  }

  // ── Ver / Editar cliente ────────────────────────────────────────────────
  // "Ver cliente" abre la ficha real (`/clientes/:id`) en una nueva pestaña
  // para no perder el draft de factura. "Editar cliente" abre el modal real
  // (`EntityEditModal`) anidado dentro del editor de factura.
  const [clientEditOpen,   setClientEditOpen]   = useState(false);
  const [clientCreateOpen, setClientCreateOpen] = useState(false);

  function handleViewClient() {
    if (!draft.clientId) return;
    if (typeof window !== "undefined") {
      window.open(`/clientes/${draft.clientId}`, "_blank", "noopener,noreferrer");
    }
  }

  function handleOpenEditClient() {
    if (!draft.clientId) return;
    setClientEditOpen(true);
  }

  /**
   * Callback de `EntityEditModal.onSaved`: refetch del detail, actualiza el
   * snapshot, recalcula vencimiento si cambió el término. NO toca las líneas.
   */
  function handleClientEdited(saved: EntityDetail) {
    if (!draft.clientId) return;
    if (saved.id !== draft.clientId) return;
    setClientDetail(saved);
    // Reconstruimos el TPEntityLite desde el row actualizado.
    const lite = entityRowToLite(saved as unknown as EntityRow);
    // Resolver currencyId → code (mismo guard que handleClientPick).
    if (lite.currency) {
      const known = currencies.some((c) => c.code === lite.currency);
      if (!known) {
        const matchById = currencies.find((c) => c.id === lite.currency);
        lite.currency = matchById ? matchById.code : undefined;
      }
    }
    // Mantener `selectedClient` actualizado para futuras decisiones (motor).
    setSelectedClient(lite);
    const newSnap = buildClientSnapshot(lite, saved);
    // Canonizar el término contra el catálogo PAYMENT_TERM (matching
    // case-insensitive) para que el combo lo refleje sin "(no listado)".
    if (newSnap.paymentTerm) {
      newSnap.paymentTerm = canonicalizeTerm(newSnap.paymentTerm);
    }
    const addr = pickDefaultAddress(saved);
    if (addr) {
      newSnap.address   = composeAddressLine(addr);
      newSnap.addressId = addr.id;
    }
    // Si el término cambió, recalculamos el vencimiento. Si tras editar el
    // cliente quedó sin término, limpiamos el vencimiento — no debe sobrevivir
    // del estado anterior.
    const dueDatePatch: Partial<SalesInvoice> = { dueDate: "" };
    if (newSnap.paymentTerm && draft.date) {
      const days = getTermDays(newSnap.paymentTerm);
      if (days !== null) {
        dueDatePatch.dueDate = addDaysISO(draft.date, days);
      }
    }
    onChange({
      ...draft,
      ...dueDatePatch,
      client:         lite.name,
      clientSnapshot: newSnap,
      // Si vinieron lista/moneda nuevas, las propagamos al draft.
      priceListId: newSnap.priceList ?? draft.priceListId,
      currency:    newSnap.currency  ?? draft.currency,
      // Si el cliente quedó sin término tras editar, limpiamos el del draft.
      paymentTerm: newSnap.paymentTerm ?? "",
    });
    setClientEditOpen(false);
  }

  // ── Cliente comercial seleccionado (objeto completo) ─────────────────────
  // Se usa para armar el `CommercialContext` y autocompletar lista, moneda,
  // término de pago, vendedor y dirección al elegirlo. `draft.client` sigue
  // guardando solo el nombre por compatibilidad con el shape actual.
  const [selectedClient, setSelectedClient] = useState<TPEntityLite | null>(null);

  // Catálogo real de clientes (GET /commercial-entities?role=client).
  // Hidrata el combo del documento. Mock-fallback se elimina: si la API falla,
  // mostramos un error y el combo queda vacío.
  const [clientOptions, setClientOptions]   = useState<TPEntityLite[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);

  // Detail del cliente cuando ya se eligió (para mostrar dirección, etc.).
  const [clientDetail, setClientDetail] = useState<EntityDetail | null>(null);
  const clientDetailRequestRef = useRef<number>(0);

  // Vendedores reales (GET /sellers).
  const [sellers, setSellers] = useState<SellerRow[]>([]);


  /**
   * Almacén por defecto a aplicar a líneas nuevas.
   *
   * Fix sincronización: SIEMPRE leer `draft.warehouse` y NADA MÁS. Antes
   * caía a `favoriteWarehouseId` directo si el global estaba vacío, lo que
   * generaba el bug "header dice Sin almacén pero la línea ya muestra
   * Sucursal" — las líneas se inicializaban con el favorito antes de que
   * el `useEffect` de inicialización propagara el favorito al
   * `draft.warehouse` global.
   *
   * Ahora la única fuente de verdad para "qué almacén toma una línea
   * nueva" es el global del documento. El `useEffect` de favoritos se
   * encarga de cascadear a las líneas cuando el catálogo y el favorito
   * estén disponibles, y mientras tanto las líneas quedan sin almacén
   * (consistente con el header).
   *
   * IMPORTANTE — esto define el almacén INICIAL de la línea, no marca
   * `warehouseOverride`. Solo cuando el operador cambia manualmente el
   * almacén de UNA línea desde su picker se setea el flag de override.
   */
  const defaultLineWarehouseId = useMemo<string | undefined>(() => {
    return draft.warehouse || undefined;
  }, [draft.warehouse]);

  /**
   * Resolución coordinada de defaults para los tres campos de contexto del
   * documento: lista de precios, almacén y canal de venta.
   *
   * Antes había tres `useEffect` independientes (uno por campo) que disparaban
   * de forma desacoplada según qué catálogo terminaba de cargar primero. Eso
   * causaba estados visibles inconsistentes: a veces aparecía lista y canal
   * pero faltaba almacén, o viceversa. Ahora un único efecto coordina los
   * tres campos en un solo `onChange`, manteniendo todos los guards previos.
   *
   * Prioridad por campo:
   *   1. Selección actual del usuario → no se pisa.
   *   2. Flag `*ExplicitlyCleared=true` ("Sin X") → no se pisa.
   *   3. Default del cliente → solo `priceListId`. `TPEntityLite` no expone
   *      warehouseId/channelId; ese caso requiere sprint backend separado.
   *      `handleClientPick` ya aplica `client.priceListId` cuando existe, y
   *      al haber valor en `draft.priceListId` esta resolución no la pisa.
   *   4. Favorito (warehouse: del usuario; lista/canal: del catálogo) si está
   *      activo y existe en el catálogo.
   *   5. Sin asignar.
   *
   * El parche se aplica en un solo `onChange` para que las tres llegadas al
   * state sean coherentes. La cascada del almacén a líneas sin
   * `warehouseOverride=true` se preserva.
   */
  useEffect(() => {
    if (!open) return;

    const patch: {
      priceListId?: string;
      warehouse?:   string;
      channelId?:   string;
    } = {};

    // Lista de precios: favorita del catálogo. Si el cliente tenía lista,
    // `handleClientPick` ya la dejó en `draft.priceListId` y el guard de
    // valor presente bloquea esta rama.
    if (!draft.priceListId && draft.priceListExplicitlyCleared !== true) {
      const fav = priceLists.find((p) => p.isFavorite && p.isActive && !p.deletedAt);
      if (fav) patch.priceListId = fav.id;
    }

    // Almacén: favorito del usuario, si está en el catálogo activo.
    if (!draft.warehouse && draft.warehouseExplicitlyCleared !== true && favoriteWarehouseId) {
      const inCatalog = warehouses.some((w) => w.id === favoriteWarehouseId);
      if (inCatalog) patch.warehouse = favoriteWarehouseId;
    }

    // Canal de venta: favorito del catálogo (no hay override por línea).
    if (!draft.channelId && draft.channelExplicitlyCleared !== true) {
      const fav = salesChannels.find((c) => c.isFavorite && c.isActive);
      if (fav) patch.channelId = fav.id;
    }

    if (patch.priceListId === undefined && patch.warehouse === undefined && patch.channelId === undefined) {
      return;
    }

    // Cascada warehouse → líneas sin override (preserva comportamiento previo).
    const lines = patch.warehouse
      ? draft.lines.map((l) =>
          l.warehouseOverride === true ? l : { ...l, warehouseId: patch.warehouse },
        )
      : draft.lines;

    onChange({ ...draft, ...patch, lines });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    draft.priceListId, draft.priceListExplicitlyCleared,
    draft.warehouse,   draft.warehouseExplicitlyCleared,
    draft.channelId,   draft.channelExplicitlyCleared,
    favoriteWarehouseId,
    priceLists.length, warehouses.length, salesChannels.length,
  ]);

  /**
   * Símbolo de la moneda actual ("$", "US$"…) resuelto contra el catálogo.
   * Se usa como prefijo en `fmtMoney` para no mostrar el code (ARS / USD)
   * en la UI del modal — solo el símbolo.
   */
  const currencyDisplay = useMemo(() => {
    const cur = currencies.find(
      (c) => c.code === draft.currency || c.id === draft.currency,
    );
    const sym = (cur?.symbol ?? "").trim();
    return sym || cur?.code || draft.currency || "";
  }, [currencies, draft.currency]);

  /**
   * Factor de conversión visual para mostrar montos en la moneda del documento.
   *
   * Fase MM ext — fuente única de verdad:
   *   · Si el preview actual tiene `currencyConverted=true`, los amounts
   *     YA vienen del backend convertidos con la cotización aplicada
   *     (manual o catálogo) → no reescalamos: `displayRate = 1`.
   *   · Si no hay preview o el backend no convirtió (moneda base, fallback,
   *     error), aplicamos el escalado legacy: `draft.fxRate` o
   *     `cur.latestRate`. Garantiza que mientras carga / falla preview,
   *     los importes locales del draft no se vean en moneda base "cruda".
   *
   * Nunca hacemos doble conversión: el backend convierte O el frontend,
   * nunca los dos.
   */
  const displayRate = useMemo(() => {
    // Caso ideal: preview actual con conversión aplicada por el backend.
    // Los `documentTotals` y `lines.*` ya están en la moneda del documento.
    if (
      backendPreview &&
      backendPreview.signature === previewSignature &&
      backendPreview.result.currencyConverted === true
    ) {
      return 1;
    }
    // Fallback legacy: backend devolvió en base (sin conversión) o todavía
    // no respondió. Reescalamos en frontend.
    const cur = currencies.find(
      (c) => c.code === draft.currency || c.id === draft.currency,
    );
    if (!cur || cur.isBase) return 1;
    const r = Number(draft.fxRate);
    if (Number.isFinite(r) && r > 0) return r;
    return cur.latestRate ?? 1;
  }, [backendPreview, previewSignature, currencies, draft.currency, draft.fxRate]);

  /** fmtMoney con conversión visual aplicada.
   *  `displayRate` representa "unidades de moneda base por 1 unidad de la
   *  moneda elegida" (p.ej. ARS por USD), por lo tanto se DIVIDE para
   *  expresar el amount (en base) en la moneda del documento. */
  function mFmt(amount: number): string {
    return fmtMoney((amount ?? 0) / displayRate, currencyDisplay);
  }

  /**
   * Ref con el último draft. Sincronizado vía useEffect para que los
   * callbacks async (refetch de pricing) puedan leer el draft actualizado
   * sin sufrir el closure stale.
   */
  const draftRef = useRef(draft);
  useEffect(() => { draftRef.current = draft; }, [draft]);

  /**
   * Mapa lineId → TPArticleLite con los ítems que el padre agrega a las
   * líneas (típicamente vía quick-add / escáner, donde la línea entra al
   * editor con `articleId` ya seteado pero sin pasar por el TPCombo
   * interno del editor). El editor lo usa para popular su `pickedById`
   * y renderizar Stock / Almacén / Canal igual que cuando el ítem se
   * elige desde el combo de la línea.
   *
   * Lo mantenemos como state (no ref) porque cambios deben gatillar
   * re-render del editor; pero usamos updates inmutables para evitar
   * referencias compartidas con consumidores.
   */
  const [pickedItemsByLineId, setPickedItemsByLineId] = useState<Map<string, import("../components/ui/TPArticleVariantSearchSelect").TPArticleLite>>(
    () => new Map(),
  );
  function setPickedItemForLine(
    lineId: string,
    item: import("../components/ui/TPArticleVariantSearchSelect").TPArticleLite | null,
  ) {
    setPickedItemsByLineId((prev) => {
      if (!item) {
        if (!prev.has(lineId)) return prev;
        const next = new Map(prev);
        next.delete(lineId);
        return next;
      }
      const cur = prev.get(lineId);
      if (cur && cur.id === item.id && cur.variantId === item.variantId) return prev;
      const next = new Map(prev);
      next.set(lineId, item);
      return next;
    });
  }

  /** Loading del botón "Guardar borrador" (POST /receipts). */
  const [draftSaving, setDraftSaving] = useState(false);

  /**
   * Tipo unificado de overrides aplicables a una línea. Cada uno es opcional
   * y `null` significa "limpiar este override". El backend recalcula y
   * devuelve la respuesta canónica — frontend NO calcula precios.
   */
  type AppliesToScope = "TOTAL" | "METAL" | "HECHURA" | "METAL_Y_HECHURA" | "SUBTOTAL_AFTER_DISCOUNT" | "SUBTOTAL_BEFORE_DISCOUNT" | "PRODUCT" | "SERVICE";
  type LineOverridePatch = {
    taxOverride?:           { mode: "PERCENT" | "AMOUNT"; value: number; appliesTo?: AppliesToScope } | null;
    manualPrice?:           number | null;
    manualDiscount?:        { mode: "PERCENT" | "AMOUNT"; value: number; appliesTo?: AppliesToScope } | null;
    gramsOverride?:         number | null;
    mermaPercentOverride?:  number | null;
    metalVariantIdOverride?: string | null;
    hechuraOverrideAmount?: number | null;
    /** Override de SOLO la base ("Aplica a"), independiente del valor.
     *  Viaja al backend aunque NO haya override de %/monto: permite que el
     *  operador reescale el descuento/impuesto HEREDADO. `null` lo limpia. */
    manualDiscountAppliesTo?: AppliesToScope | null;
    manualTaxAppliesTo?:      AppliesToScope | null;
    /** F1.4 G5 #11-D — array completo de overrides per costLineId.
     *  Cuando viene en el patch, REEMPLAZA el array actual del meta
     *  (no merge — el caller es responsable de reconstruir el array
     *  manteniendo entries previas + la edición nueva). */
    costLineOverrides?: NonNullable<DocumentLine["pricingMeta"]>["costLineOverrides"];
  };

  /**
   * Aplica un patch de overrides a una línea: persiste en pricingMeta y
   * dispara refetch al backend con todos los overrides activos. Función
   * unificada para el panel "Ajustes avanzados" y para las celdas de
   * Bonificación / Impuestos.
   *
   * Reglas:
   *   · Idempotente: si el merge final es exactamente igual al estado
   *     actual, no se actualiza state ni se hace refetch. Esto evita el
   *     "doble recálculo" cuando typing + blur emiten el mismo valor.
   *   · Refetch debounced (350ms): muchas llamadas seguidas (typing
   *     rápido) consolidan en una sola request al motor.
   *
   * Para limpiar un override puntual, pasar la key con `null`. Para
   * limpiar TODOS, usar `clearLineOverrides`.
   */
  function applyLineOverrides(lineId: string, patch: LineOverridePatch) {
    const cur = draftRef.current;
    const l = cur.lines.find((x) => x.id === lineId);
    // Aceptar líneas con artículo (catálogo) o manuales (texto libre).
    // El motor del backend tiene una rama dedicada para `type: "MANUAL"`
    // que aplica `manualPrice/manualDiscount/taxOverride` sin pasar por
    // `resolveFinalSalePrice`.
    if (!l || (!l.articleId && l.isManual !== true)) return;
    // Merge: overrides actuales + patch. Si patch.X === null lo limpia.
    const prevMeta = l.pricingMeta ?? {};
    const merged: LineOverridePatch = {
      taxOverride:           patch.taxOverride           !== undefined ? patch.taxOverride           : (prevMeta.taxOverride           ?? null),
      manualPrice:           patch.manualPrice           !== undefined ? patch.manualPrice           : (prevMeta.manualPrice           ?? null),
      manualDiscount:        patch.manualDiscount        !== undefined ? patch.manualDiscount        : (prevMeta.manualDiscount        ?? null),
      gramsOverride:         patch.gramsOverride         !== undefined ? patch.gramsOverride         : (prevMeta.gramsOverride         ?? null),
      mermaPercentOverride:  patch.mermaPercentOverride  !== undefined ? patch.mermaPercentOverride  : (prevMeta.mermaPercentOverride  ?? null),
      metalVariantIdOverride: patch.metalVariantIdOverride !== undefined ? patch.metalVariantIdOverride : (prevMeta.metalVariantIdOverride ?? null),
      hechuraOverrideAmount: patch.hechuraOverrideAmount !== undefined ? patch.hechuraOverrideAmount : (prevMeta.hechuraOverrideAmount ?? null),
      manualDiscountAppliesTo: patch.manualDiscountAppliesTo !== undefined ? patch.manualDiscountAppliesTo : ((prevMeta as any).manualDiscountAppliesTo ?? null),
      manualTaxAppliesTo:      patch.manualTaxAppliesTo      !== undefined ? patch.manualTaxAppliesTo      : ((prevMeta as any).manualTaxAppliesTo      ?? null),
      // F1.4 #11-D — array completo. El caller reconstruye el array (con
      // todas las entries previas) e incluye la edición nueva. Acá solo
      // pisamos.
      costLineOverrides:     patch.costLineOverrides     !== undefined ? patch.costLineOverrides     : prevMeta.costLineOverrides,
    };
    // ── Idempotency: si el override final es igual al actual, no hacer nada.
    if (
      sameTypedOverride(merged.taxOverride,    prevMeta.taxOverride    ?? null) &&
      sameTypedOverride(merged.manualDiscount, prevMeta.manualDiscount ?? null) &&
      (merged.manualPrice           ?? null) === (prevMeta.manualPrice           ?? null) &&
      (merged.gramsOverride         ?? null) === (prevMeta.gramsOverride         ?? null) &&
      (merged.mermaPercentOverride  ?? null) === (prevMeta.mermaPercentOverride  ?? null) &&
      (merged.metalVariantIdOverride ?? null) === (prevMeta.metalVariantIdOverride ?? null) &&
      (merged.hechuraOverrideAmount ?? null) === (prevMeta.hechuraOverrideAmount ?? null) &&
      (merged.manualDiscountAppliesTo ?? null) === ((prevMeta as any).manualDiscountAppliesTo ?? null) &&
      (merged.manualTaxAppliesTo      ?? null) === ((prevMeta as any).manualTaxAppliesTo      ?? null) &&
      // Fase 2 fix — sin esta comparación, los edits de la nueva grilla
      // (que solo modifican `costLineOverrides[]` y dejan los 7 legacy
      // iguales) caían en este return temprano y el state nunca se
      // actualizaba: la UI parecía "no editable" en runtime.
      JSON.stringify(merged.costLineOverrides ?? null) ===
        JSON.stringify(prevMeta.costLineOverrides ?? null)
    ) {
      return;
    }

    const nextLines = cur.lines.map((x) => {
      if (x.id !== lineId) return x;
      const meta: NonNullable<DocumentLine["pricingMeta"]> = {
        ...prevMeta,
        taxOverride:            merged.taxOverride,
        manualPrice:            merged.manualPrice,
        manualDiscount:         merged.manualDiscount,
        gramsOverride:          merged.gramsOverride,
        mermaPercentOverride:   merged.mermaPercentOverride,
        metalVariantIdOverride: merged.metalVariantIdOverride,
        hechuraOverrideAmount:  merged.hechuraOverrideAmount,
        // Override de SOLO la base ("Aplica a"), independiente del valor.
        manualDiscountAppliesTo: merged.manualDiscountAppliesTo,
        manualTaxAppliesTo:      merged.manualTaxAppliesTo,
        // F1.4 #11-D — array completo per costLineId.
        costLineOverrides:      merged.costLineOverrides,
        partial:                true,
        resolvedAt:             Date.now(),
      };
      // Bug fix: sincronizar SOLO el flag del override que viene en el
      // patch. NO tocar los flags de los otros overrides — sino, editar
      // bonificación reseteaba el flag de precio (porque
      // `merged.manualPrice` podía ser null incluso con flag `price=true`
      // setado por patchLine, ya que patchLine setea el flag pero no
      // guarda el valor en `pricingMeta.manualPrice`).
      const nextOverrides: NonNullable<DocumentLine["manualOverrides"]> = {
        ...(x.manualOverrides ?? {}),
      };
      if (patch.manualDiscount !== undefined) nextOverrides.discount = patch.manualDiscount != null;
      if (patch.manualPrice    !== undefined) nextOverrides.price    = patch.manualPrice    != null;
      if (patch.taxOverride    !== undefined) nextOverrides.tax      = patch.taxOverride    != null;
      // Sincronizar `unitPrice` con el override en la MISMA mutación.
      // Antes el caller hacía esto en una llamada separada (`updateLine({
      // unitPrice })`) que partía de `draftRef.current` aún no actualizado
      // → si entre medio había habido un patch de bonificación o impuesto,
      // ese segundo `onChange` partía de un draft viejo y pisaba el manual
      // de discount/tax. Resultado: el orden de carga de overrides
      // afectaba el cálculo. Hacerlo atómicamente acá garantiza que los
      // overrides son conmutativos respecto al orden de entrada.
      const next: DocumentLine = { ...x, pricingMeta: meta, manualOverrides: nextOverrides };
      if (patch.manualPrice !== undefined) {
        next.unitPrice = patch.manualPrice ?? prevMeta.basePrice ?? x.unitPrice;
      }
      return next;
    });
    onChange({ ...cur, lines: nextLines });
    // El cambio en `draft.lines` dispara `previewSignature` → `salesApi.preview`
    // hidrata la línea con el resultado del motor (con los overrides incluidos
    // vía `manualOverrides` flags + valores de la línea). NO refetch per-line.
  }

  /**
   * Setea (o limpia) el override manual de impuestos. Wrapper sobre
   * `applyLineOverrides` para mantener back-compat con la UI de la celda
   * Impuestos.
   */
  function setLineTaxOverride(
    lineId: string,
    override: { mode: "PERCENT" | "AMOUNT"; value: number } | null,
  ) {
    applyLineOverrides(lineId, { taxOverride: override });
  }

  /**
   * Limpia TODOS los overrides manuales de una línea (precio, descuento,
   * impuesto). El backend vuelve a aplicar lista + reglas configuradas.
   */
  function clearLineOverrides(lineId: string) {
    applyLineOverrides(lineId, {
      taxOverride:            null,
      manualPrice:            null,
      manualDiscount:         null,
      gramsOverride:          null,
      mermaPercentOverride:   null,
      metalVariantIdOverride: null,
      hechuraOverrideAmount:  null,
      // Restaurar también limpia el override de SOLO la base ("Aplica a")
      // → el combo re-hidrata del heredado (cliente / config impuesto).
      manualDiscountAppliesTo: null,
      manualTaxAppliesTo:      null,
    });
  }

  /**
   * Coerciona a number con fallback. Cualquier valor no numérico finito
   * (string raro, null, undefined, NaN) cae al fallback. Crítico para
   * blindar la respuesta del backend antes de pisar la línea.
   */
  function safeNumber(value: unknown, fallback = 0): number {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
    return fallback;
  }

  /**
   * Compara dos overrides estructurados (taxOverride / manualDiscount).
   * Devuelve true si son equivalentes — usado para hacer idempotente al
   * `applyLineOverrides` cuando el blur emite el mismo valor que ya está
   * persistido.
   */
  function sameTypedOverride(
    a: { mode: "PERCENT" | "AMOUNT"; value: number; appliesTo?: AppliesToScope } | null | undefined,
    b: { mode: "PERCENT" | "AMOUNT"; value: number; appliesTo?: AppliesToScope } | null | undefined,
  ): boolean {
    if (a === b) return true;
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    return (
      a.mode === b.mode &&
      a.value === b.value &&
      (a.appliesTo ?? "TOTAL") === (b.appliesTo ?? "TOTAL")
    );
  }

  /**
   * Patch OPTIMISTA — usado al pickear un artículo (antes de que llegue la
   * respuesta del backend) y como fallback si la red falla. NO calcula
   * precios reales: usa el `price` de catálogo como unitPrice y deja
   * descuentos / impuestos en cero. Marca `partial:true`.
   *
   * @deprecated Fase 6 — `salesApi.preview` (doc-level) ya hidrata las
   * líneas via `applySalePreviewToDraft`. Este helper persiste solo como
   * placeholder visual durante el debounce de 350 ms. Borrar en Fase 7
   * cuando se elimine el flujo per-line.
   */
  function buildOptimisticLinePatch(item: TPArticleLite, qty: number) {
    const unitPrice = Number.isFinite(item.price) ? (item.price as number) : 0;
    const meta: NonNullable<DocumentLine["pricingMeta"]> = {
      priceSource: "PRICE_LIST",
      basePrice:   unitPrice,
      partial:     true, // motor real aún no respondió
      resolvedAt:  Date.now(),
    };
    const { subtotal, lineTotal } = calcLineTotalsFromSnapshot({
      quantity:       qty,
      unitPrice,
      discountAmount: 0,
      taxAmount:      0,
      pricingMeta:    meta,
    });
    return {
      unitPrice,
      discountAmount: 0,
      taxAmount:      0,
      subtotal,
      lineTotal,
      meta,
    };
  }

  /**
   * Trae el stock por almacén para un artículo (filtrado por variante si
   * corresponde). Pega contra `articlesApi.stock.get(articleId)` y mapea
   * a `{ warehouse: name, qty }` para el editor de líneas.
   */
  const articleStockBreakdown = React.useCallback(
    async (articleId: string, variantId?: string) => {
      try {
        const stocks = await articlesApi.stock.get(articleId);
        const filtered = variantId
          ? stocks.filter((s) => s.variantId === variantId)
          : stocks.filter((s) => s.variantId == null);
        return filtered.map((s) => ({
          warehouse: s.warehouse?.name ?? "—",
          qty:       Number(s.quantity) || 0,
        }));
      } catch {
        return [];
      }
    },
    [],
  );

  /**
   * Búsqueda remota de artículos para el combo. Se debouncea dentro del combo
   * (200ms). Pega contra `articlesApi.list` con `q`, expande variantes y
   * devuelve `TPArticleLite[]`.
   */
  const searchArticles = React.useCallback(
    async (query: string): Promise<import("../components/ui/TPArticleVariantSearchSelect").TPArticleLite[]> => {
      try {
        const resp = await articlesApi.list({
          q: query || undefined,
          status: "ACTIVE",
          take: 30,
          sortKey: "name",
          sortDir: "asc",
        });
        const out: import("../components/ui/TPArticleVariantSearchSelect").TPArticleLite[] = [];
        for (const row of resp.rows) {
          for (const lite of expandArticleToLite(row, query)) out.push(lite);
        }
        return out;
      } catch {
        return [];
      }
    },
    [],
  );

  /**
   * Lookup exacto por código escaneado. Se invoca desde el combo cuando
   * los resultados parciales NO contienen un match exacto. Pega contra
   * `articlesApi.list` con filtros `barcode` y `sku` (que el backend
   * trata como match exacto), y como último recurso busca por `q` y
   * filtra exactos en la respuesta. Devuelve TPArticleLite[] que el
   * combo se encarga de filtrar a los matches exactos.
   */
  const exactLookupArticle = React.useCallback(
    async (query: string): Promise<import("../components/ui/TPArticleVariantSearchSelect").TPArticleLite[]> => {
      const q = (query ?? "").trim();
      if (!q) return [];
      // eslint-disable-next-line no-console
      console.debug("[exact-lookup:start]", { query, q });
      const out: import("../components/ui/TPArticleVariantSearchSelect").TPArticleLite[] = [];
      try {
        // 1) Intento por barcode exacto (el endpoint trata `barcode` como exact match).
        const byBarcode = await articlesApi.list({
          barcode: q, status: "ACTIVE", take: 5, sortKey: "name", sortDir: "asc",
        });
        // eslint-disable-next-line no-console
        console.debug("[exact-lookup:1-barcode]", {
          rowsN: byBarcode.rows?.length ?? 0,
          rowsSummary: (byBarcode.rows ?? []).map((r) => ({ id: r.id, code: r.code, sku: r.sku, name: r.name })),
        });
        for (const row of byBarcode.rows) {
          for (const lite of expandArticleToLite(row, q)) out.push(lite);
        }
        if (out.length > 0) {
          // eslint-disable-next-line no-console
          console.debug("[exact-lookup:1-barcode-hit]", { outN: out.length });
          return out;
        }
      } catch (err) { /* fallback a sku */ console.debug("[exact-lookup:1-barcode-error]", err); }
      try {
        // 2) Intento por sku exacto.
        const bySku = await articlesApi.list({
          sku: q, status: "ACTIVE", take: 5, sortKey: "name", sortDir: "asc",
        });
        // eslint-disable-next-line no-console
        console.debug("[exact-lookup:2-sku]", {
          rowsN: bySku.rows?.length ?? 0,
          rowsSummary: (bySku.rows ?? []).map((r) => ({
            id: r.id, code: r.code, sku: r.sku, name: r.name,
            variantsN: r.variants?.length ?? 0,
            variants: (r.variants ?? []).map((v) => ({ id: v.id, code: v.code, sku: v.sku, barcode: v.barcode, isActive: v.isActive })),
          })),
        });
        for (const row of bySku.rows) {
          for (const lite of expandArticleToLite(row, q)) out.push(lite);
        }
        if (out.length > 0) {
          // eslint-disable-next-line no-console
          console.debug("[exact-lookup:2-sku-hit]", { outN: out.length, outSummary: out.map((it) => ({ id: it.id, code: it.code, sku: it.sku, barcode: it.barcode })) });
          return out;
        }
      } catch (err) { /* fallback a q */ console.debug("[exact-lookup:2-sku-error]", err); }
      try {
        // 3) Último recurso: search por q amplio (take grande) — el combo
        //    filtra exactos por sku/code/barcode en el resultado.
        const byQ = await articlesApi.list({
          q, status: "ACTIVE", take: 50, sortKey: "name", sortDir: "asc",
        });
        // eslint-disable-next-line no-console
        console.debug("[exact-lookup:3-q]", {
          rowsN: byQ.rows?.length ?? 0,
          rowsSummary: (byQ.rows ?? []).slice(0, 5).map((r) => ({
            id: r.id, code: r.code, sku: r.sku, name: r.name,
            variantsN: r.variants?.length ?? 0,
            variants: (r.variants ?? []).map((v) => ({ id: v.id, code: v.code, sku: v.sku, barcode: v.barcode, isActive: v.isActive })),
          })),
        });
        for (const row of byQ.rows) {
          for (const lite of expandArticleToLite(row, q)) out.push(lite);
        }
      } catch (err) { /* nada que hacer */ console.debug("[exact-lookup:3-q-error]", err); }
      // eslint-disable-next-line no-console
      console.debug("[exact-lookup:final]", {
        outN: out.length,
        outSummary: out.slice(0, 5).map((it) => ({ id: it.id, code: it.code, sku: it.sku, barcode: it.barcode, article: it.article, variant: it.variant })),
      });
      return out;
    },
    [],
  );

  // Catálogo PAYMENT_TERM — fuente real de las opciones del combo "Término de
  // pago". Reemplaza el array hardcodeado.
  const paymentTermCat = useCatalog("PAYMENT_TERM");

  /** Items activos del catálogo, ordenados por sortOrder. */
  const paymentTermItems = useMemo(
    () => (paymentTermCat.items || [])
      .filter((it) => it.isActive)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [paymentTermCat.items],
  );

  /** Item "Personalizada" del catálogo si existe (matching tolerante). */
  const customTermItem = useMemo(
    () => paymentTermItems.find((it) => it.label.trim().toLowerCase().startsWith("personalizad")),
    [paymentTermItems],
  );
  /** Label canónico para "Personalizada" (catálogo o literal). */
  const customTermLabel = customTermItem?.label ?? "Personalizada";

  /**
   * Devuelve el label canónico del catálogo que coincide con `term` (match
   * case-insensitive + trim). Si no hay match, devuelve el `term` tal cual.
   * Sirve para canonizar el `paymentTerm` que viene del cliente y evitar
   * que el combo lo trate como "no listado" por diferencias de mayúsculas.
   */
  function canonicalizeTerm(term: string): string {
    const t = (term ?? "").trim();
    if (!t) return "";
    const norm = t.toLowerCase();
    const match = paymentTermItems.find((it) => it.label.trim().toLowerCase() === norm);
    return match ? match.label : t;
  }

  const paymentTermOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [
      { value: "", label: "— Sin definir —" },
      ...paymentTermItems.map((it) => ({ value: it.label, label: it.label })),
    ];
    // Si "Personalizada" no está en el catálogo, la agregamos como opción
    // UI especial para que el cambio manual de vencimiento tenga destino.
    if (!customTermItem) {
      opts.push({ value: customTermLabel, label: customTermLabel });
    }
    // Si el draft trae un término que NO existe en el catálogo (cliente
    // legacy / item desactivado), lo mostramos como opción "fantasma" para
    // no perder el dato.
    const current = (draft.paymentTerm ?? "").trim();
    if (current && !opts.some((o) => o.value.toLowerCase() === current.toLowerCase())) {
      opts.push({ value: current, label: `${current} (no listado)` });
    }
    return opts;
  }, [paymentTermItems, customTermItem, customTermLabel, draft.paymentTerm]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setClientsLoading(true);
    commercialEntitiesApi
      .list({ role: "client", take: 200, sortKey: "displayName", sortDir: "asc" })
      .then((resp) => {
        if (cancelled) return;
        const mapped: TPEntityLite[] = resp.rows.map(entityRowToLite);
        setClientOptions(mapped);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("No se pudieron cargar los clientes.");
        setClientOptions([]);
      })
      .finally(() => { if (!cancelled) setClientsLoading(false); });

    // Vendedores activos.
    sellersApi
      .list()
      .then((rows) => {
        if (cancelled) return;
        const active = rows.filter((s) => s.isActive && !s.deletedAt);
        setSellers(active);
      })
      .catch(() => { if (!cancelled) setSellers([]); });

    // Vendedor favorito → default cuando no hay seleccionado todavía.
    // El cliente con sellerId tiene prioridad: si más adelante el usuario
    // pickea un cliente con vendedor asignado, applyClientToDraft lo pisa.
    // (También evita pisar overrides explícitos del usuario.)
    // Lo aplicamos en un effect aparte para que dependa de la lista cargada.

    // Monedas + cotización vigente.
    listCurrencies()
      .then((resp: any) => {
        if (cancelled) return;
        const list: CurrencyRow[] = resp?.rows ?? resp ?? [];
        setCurrencies(list.filter((c: CurrencyRow) => c.isActive));
      })
      .catch(() => { if (!cancelled) setCurrencies([]); });

    // Almacenes activos.
    warehousesApi.list()
      .then((rows) => {
        if (cancelled) return;
        setWarehouses((rows as WarehouseRow[]).filter((w) => w.isActive));
      })
      .catch(() => { if (!cancelled) setWarehouses([]); });

    // Listas de precios activas. Sin filtro de scope — el TPSelect solo
    // muestra las que `isActive=true`. El backend resuelve por CUID; si
    // se pasa un id que no existe (ej. mocks "retail"), cae al fallback.
    priceListsApi.list()
      .then((rows) => {
        if (cancelled) return;
        setPriceLists((rows ?? []).filter((p) => p.isActive && !p.deletedAt));
      })
      .catch(() => { if (!cancelled) setPriceLists([]); });

    // Canales de venta activos.
    salesChannelsApi.list()
      .then((rows) => {
        if (cancelled) return;
        setSalesChannels((rows ?? []).filter((c) => c.isActive && !c.deletedAt));
      })
      .catch(() => { if (!cancelled) setSalesChannels([]); });

    // Catálogo de unidades — para mapear el `code` (UND/KG/etc.) al
    // `name` legible ("Unidad" / "Kilogramos" / etc.) en el label de
    // Cantidad. Si falla, el editor cae al code (comportamiento legacy).
    listUnits({ isActive: true })
      .then((rows) => {
        if (cancelled) return;
        setUnitsCatalog(rows ?? []);
      })
      .catch(() => { if (!cancelled) setUnitsCatalog([]); });

    // Impuestos del tenant — para defaults de líneas manuales.
    taxesApi.list()
      .then((rows) => {
        if (cancelled) return;
        setSalesTaxes((rows ?? []).filter((t) => t.isActive && !t.deletedAt));
      })
      .catch(() => { if (!cancelled) setSalesTaxes([]); });

    return () => { cancelled = true; };
  }, [open]);

  /**
   * Sanitiza `draft.priceListId`: cuando se cargan las listas reales,
   * verifica que el id actual exista. Si es un mock viejo ("retail",
   * "wholesale") o un CUID que ya no está, lo limpia. Sin pisar el draft
   * con un default automático — el backend ya tiene fallback (cliente,
   * categoría, lista favorita) cuando el override no resuelve.
   */
  useEffect(() => {
    if (!open) return;
    if (priceLists.length === 0) return;
    const id = draft.priceListId;
    if (!id) return;
    const exists = priceLists.some((p) => p.id === id);
    if (!exists) {
      onChange({ ...draft, priceListId: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceLists, open]);

  /** Sanitiza `draft.channelId`: si no existe en `salesChannels` lo limpia. */
  useEffect(() => {
    if (!open) return;
    if (salesChannels.length === 0) return;
    const id = draft.channelId;
    if (!id) return;
    const exists = salesChannels.some((c) => c.id === id);
    if (!exists) {
      onChange({ ...draft, channelId: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesChannels, open]);

  // Jerarquía del vendedor:
  //   1) cliente.sellerId (si el cliente tiene vendedor asignado por defecto)
  //   2) vendedor favorito del sistema
  //   3) "Sin asignar"
  //
  // Solo se aplica cuando NO hay vendedor ya elegido en el draft. El usuario
  // puede pisar la sugerencia eligiendo "— Sin asignar —" o cualquier otro:
  // en ese caso `sellerExplicitlyClearedRef` evita que vuelva a aplicarse.
  // Al cambiar de cliente, el ref se resetea (en la handler del cliente).
  const sellerExplicitlyClearedRef = useRef(false);
  useEffect(() => {
    if (!sellers.length) return;
    if (draft.seller) return;
    if (sellerExplicitlyClearedRef.current) return;
    // 1) Vendedor del cliente: solo aplicamos si efectivamente existe en la
    //    lista activa (puede ser de otro tenant o estar inactivo si los
    //    datos quedaron stale).
    const clientSellerId = selectedClient?.sellerId;
    if (clientSellerId && sellers.some((s) => s.id === clientSellerId)) {
      onChange({ ...draft, seller: clientSellerId });
      return;
    }
    // 2) Favorito del sistema.
    const fav = sellers.find((s) => s.isFavorite);
    if (fav) onChange({ ...draft, seller: fav.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellers, draft.seller, selectedClient?.sellerId]);

  // Diálogo "¿Recalcular precios de las líneas con el nuevo cliente?".
  // Se dispara cuando el usuario cambia el cliente y ya hay líneas con artículo.
  const [recalcPrompt, setRecalcPrompt] = useState<{
    open: boolean;
    nextClient: TPEntityLite | null;
    nextDraftPatch: Partial<SalesInvoice>;
  }>({ open: false, nextClient: null, nextDraftPatch: {} });

  // ── Editar artículo base (advertencia + acción placeholder) ──────────────
  const [editArticleId, setEditArticleId] = useState<string | null>(null);
  function handleEditArticle(articleId: string) {
    setEditArticleId(articleId);
  }
  function confirmEditArticle() {
    if (!editArticleId) return;
    // Abrir el detalle del artículo padre en una pestaña nueva para no
    // perder el draft de factura. `editArticleId` siempre apunta al
    // artículo padre (variantId queda en otro campo del TPArticleLite).
    if (typeof window !== "undefined") {
      window.open(`/articulos/${editArticleId}`, "_blank", "noopener,noreferrer");
    }
    setEditArticleId(null);
  }

  // ── Snapshots para "Restablecer" ─────────────────────────────────────────
  // Por línea: guardamos los valores originales (unitPrice / descuento /
  // impuesto) al momento de cargar la línea desde un artículo. El botón
  // "Restablecer línea" del editor de líneas vuelve a esos valores
  // preservando artículo + cantidad.
  type LineSnapshot = Pick<DocumentLine, "unitPrice" | "discountAmount" | "taxAmount">;
  const initialLineSnapshots = useRef<Map<string, LineSnapshot>>(new Map());

  // Global: snapshot del draft completo al abrir el modal — usado por
  // "Restablecer comprobante" para volver a los valores originales preservando
  // las líneas (artículos + cantidades).
  const initialDraftRef = useRef<SalesInvoice | null>(null);
  useEffect(() => {
    if (!open) {
      initialDraftRef.current = null;
      initialLineSnapshots.current.clear();
      return;
    }
    // Guardamos un snapshot profundo cuando el modal abre.
    if (initialDraftRef.current === null) {
      initialDraftRef.current = JSON.parse(JSON.stringify(draft)) as SalesInvoice;
      // Sembrar snapshot por línea para las que ya existen.
      for (const l of draft.lines) {
        if (!isEmptyLine(l) && !initialLineSnapshots.current.has(l.id)) {
          initialLineSnapshots.current.set(l.id, {
            unitPrice: l.unitPrice,
            discountAmount: l.discountAmount || 0,
            taxAmount: l.taxAmount,
          });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /**
   * Restablece una línea a su snapshot inicial (preserva artículo + cantidad).
   * Si la línea tenía override manual, se LIMPIA y se vuelve a pedir el
   * precio al backend para que se sincronice con el contexto vigente.
   */
  function resetLine(lineId: string) {
    const snap = initialLineSnapshots.current.get(lineId);
    if (!snap) {
      toast.info("Esta línea no tiene valores originales para restablecer.");
      return;
    }
    const idx = draft.lines.findIndex((l) => l.id === lineId);
    if (idx < 0) return;
    const cur = draft.lines[idx];
    const wasManual = !!cur.pricingMeta?.manualOverride;
    const restored: DocumentLine = {
      ...cur,
      unitPrice:      snap.unitPrice,
      discountAmount: snap.discountAmount,
      taxAmount:      snap.taxAmount,
      // Override de lista por línea: también se LIMPIA en reset. Sin esto,
      // la línea volvía a sus valores "originales" pero seguía atada a la
      // lista que el operador eligió individualmente — estado inconsistente.
      // Limpiarlo hace que vuelva a usar la lista global del documento.
      priceListIdOverride: null,
      // Flags de override de contexto: el reset deshace TODOS los overrides
      // de contexto que el operador haya aplicado (almacén / lista). La
      // línea queda atada al global del documento; un cambio de header la
      // afectará desde ahora. NOTA: warehouseId se preserva (el operador
      // mantuvo el almacén que tenía); solo se baja el flag, así el próximo
      // cambio de almacén global pisa el campo.
      warehouseOverride: false,
      priceListOverride: false,
      // Limpiar TODOS los overrides en `pricingMeta` (no solo manualOverride).
      // Restablecer línea = volver al cálculo automático del backend.
      pricingMeta:    cur.pricingMeta
        ? {
            ...cur.pricingMeta,
            manualOverride:        false,
            manualPrice:           null,
            manualDiscount:        null,
            taxOverride:           null,
            gramsOverride:         null,
            mermaPercentOverride:  null,
            metalVariantIdOverride: null,
            hechuraOverrideAmount: null,
            // Override de SOLO la base ("Aplica a") también se limpia →
            // el combo re-hidrata del heredado (cliente / config impuesto).
            manualDiscountAppliesTo: null,
            manualTaxAppliesTo:      null,
          }
        : undefined,
      // Fase 6.5 — Restablecer línea limpia TODOS los flags manuales
      // (precio / bonificación / impuesto / cantidad). El siguiente
      // doc preview re-hidrata la línea con valores automáticos.
      manualOverrides: undefined,
    };
    const { subtotal, lineTotal } = calcLineTotalsFromSnapshot(restored);
    const finalLine: DocumentLine = { ...restored, subtotal, lineTotal };
    const nextLines = draft.lines.map((l, i) => (i === idx ? finalLine : l));
    // Fase 6: totales hidratados por salesApi.preview vía applySalePreviewToDraft.
    // El cambio en draft.lines dispara previewSignature → re-pricing automático.
    onChange({ ...draft, lines: nextLines });
    toast.success(wasManual ? "Línea restablecida (precio manual eliminado)." : "Línea restablecida.");
  }

  // ── Restablecer comprobante (global) ─────────────────────────────────────
  const [resetAllConfirmOpen, setResetAllConfirmOpen] = useState(false);

  /** Restaura el draft al snapshot inicial preservando artículo + cantidad de
   *  cada línea (lo que el usuario ya cargó). El resto vuelve a los valores
   *  originales. */
  function performResetAll() {
    const snap = initialDraftRef.current;
    if (!snap) {
      setResetAllConfirmOpen(false);
      return;
    }
    // Mapa de líneas originales por id.
    const origLineById = new Map<string, DocumentLine>();
    for (const l of snap.lines) origLineById.set(l.id, l);

    // Reconstruir cada línea actual: si tenía snapshot inicial, usarlo (preservando
    // artículo + cantidad ACTUAL). Si es línea nueva (no había en el snapshot),
    // resetear sólo unitPrice / descuento / impuesto a los valores que tenía al
    // agregarse (lineSnapshots).
    const restoredLines: DocumentLine[] = draft.lines.map((cur) => {
      if (isEmptyLine(cur)) return cur;
      const orig = origLineById.get(cur.id);
      const lineSnap = initialLineSnapshots.current.get(cur.id);
      if (orig) {
        // Línea pre-existente: volver a sus valores originales pero conservar
        // la cantidad ACTUAL del usuario.
        const merged: DocumentLine = {
          ...orig,
          quantity: cur.quantity,
        };
        const { subtotal, lineTotal } = calcLineTotalsFromSnapshot(merged);
        return { ...merged, subtotal, lineTotal };
      }
      if (lineSnap) {
        const merged: DocumentLine = {
          ...cur,
          unitPrice: lineSnap.unitPrice,
          discountAmount: lineSnap.discountAmount,
          taxAmount: lineSnap.taxAmount,
        };
        const { subtotal, lineTotal } = calcLineTotalsFromSnapshot(merged);
        return { ...merged, subtotal, lineTotal };
      }
      return cur;
    });

    // Limpiar TODOS los overrides de TODAS las líneas — Reset Todo restaura
    // el estado fresco y vuelve a depender del motor real. Cubre overrides
    // comerciales (precio / bonificación / impuesto) y de contexto
    // (warehouseOverride / priceListOverride / priceListIdOverride). Después
    // del reset, las líneas heredan los valores globales del documento.
    const cleanLines = restoredLines.map((l) => ({
      ...l,
      manualOverrides:     undefined,
      priceListIdOverride: null,
      priceListOverride:   false,
      warehouseOverride:   false,
      pricingMeta: l.pricingMeta
        ? {
            ...l.pricingMeta,
            manualOverride:        false,
            manualPrice:           null,
            manualDiscount:        null,
            taxOverride:           null,
            gramsOverride:         null,
            mermaPercentOverride:  null,
            metalVariantIdOverride: null,
            hechuraOverrideAmount: null,
            // Override de SOLO la base ("Aplica a") también se limpia →
            // el combo re-hidrata del heredado (cliente / config impuesto).
            manualDiscountAppliesTo: null,
            manualTaxAppliesTo:      null,
          }
        : l.pricingMeta,
    }));

    // Resolver favoritos vigentes para completar valores vacíos del snap.
    // El snapshot inicial pudo capturarse ANTES de que los catálogos
    // cargaran los favoritos (race entre `useEffect` de open y los fetch
    // asíncronos). Sin este fallback, "Restablecer" devolvería al estado
    // vacío inicial en lugar de los favoritos vigentes.
    const favList    = priceLists.find((p) => p.isFavorite && p.isActive && !p.deletedAt);
    const favChannel = salesChannels.find((c) => c.isFavorite && c.isActive);
    const favWh =
      favoriteWarehouseId && warehouses.some((w) => w.id === favoriteWarehouseId)
        ? favoriteWarehouseId
        : undefined;

    // Restaurar campos a nivel documento (preservando lines reconstruidas).
    // Limpieza de flags "explicitly cleared": el reset global vuelve a los
    // favoritos, así que cualquier "Sin canal / Sin lista / Sin almacén"
    // que el operador haya marcado se anula y el useEffect re-aplicará
    // los favoritos vigentes.
    const restored: SalesInvoice = {
      ...snap,
      lines:        cleanLines,
      priceListId:  snap.priceListId ?? favList?.id ?? undefined,
      channelId:    snap.channelId   ?? favChannel?.id ?? undefined,
      warehouse:    snap.warehouse   || favWh || "",
      channelExplicitlyCleared:   false,
      priceListExplicitlyCleared: false,
      warehouseExplicitlyCleared: false,
    };
    // Fase 6: totales hidratados por salesApi.preview vía applySalePreviewToDraft.
    // El cambio en draft.lines dispara previewSignature → re-pricing automático.
    onChange({ ...restored });
    // Limpiar entradas obsoletas del cache de items pickeados:
    // tras el reset, las líneas que NO tienen articleId no deben mostrar
    // metadata stale (Stock / Almacén / Canal) heredada del último item
    // que se había seleccionado en esa fila. Conservamos solo las
    // entradas de líneas que siguen teniendo artículo asignado.
    setPickedItemsByLineId((prev) => {
      const validIds = new Set(
        cleanLines
          .filter((l) => !!l.articleId)
          .map((l) => l.id),
      );
      let changed = false;
      const next = new Map(prev);
      for (const id of next.keys()) {
        if (!validIds.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setResetAllConfirmOpen(false);
    toast.success("Comprobante restablecido.");
  }

  function patch<K extends keyof SalesInvoice>(key: K, value: SalesInvoice[K]) {
    // Fase 6: cualquier cambio en discountGlobal/shipping/taxPercent
    // dispara nuevo signature → salesApi.preview hidrata totales reales.
    onChange({ ...draft, [key]: value });
  }

  // ── Sincronización Fecha / Vencimiento / Término de pago ────────────────
  // Mapping: término → días a sumar a la fecha de factura. Si devuelve null,
  // el término no dispara cálculo automático (Sin definir / Cuenta corriente
  // / Personalizada).
  /**
   * Parsea el término de pago (label libre del catálogo o legacy code) y
   * devuelve los días asociados. Casos:
   *   · "Contado", "Cash", "Inmediato"           → 0
   *   · "7 días", "30 días", "7d", "30 dias"     → 7 / 30
   *   · "Personalizada", "custom", "—", "Sin…"   → null  (no calcular vto)
   *   · cualquier otro                           → null
   */
  function getTermDays(term: string): number | null {
    const t = (term ?? "").trim().toLowerCase();
    if (!t) return null;
    if (t === "—" || t === "custom" || t.includes("personalizad") || t.includes("sin definir") || t.includes("cuenta corriente") || t === "current") return null;
    if (t === "cash" || t === "contado" || t === "inmediato" || t.startsWith("contado")) return 0;
    const m = t.match(/(\d+)\s*(d(?:í|i)?as?|d)?\b/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n >= 0) return n;
    }
    return null;
  }

  function addDaysISO(isoDate: string, days: number): string {
    if (!isoDate) return "";
    const d = new Date(isoDate + "T00:00:00");
    if (isNaN(d.getTime())) return "";
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, "0");
    const dd   = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function handleDateChange(newDate: string) {
    const days = getTermDays(draft.paymentTerm);
    if (days !== null && newDate) {
      onChange({ ...draft, date: newDate, dueDate: addDaysISO(newDate, days) });
    } else {
      onChange({ ...draft, date: newDate });
    }
  }

  function handlePaymentTermChange(term: string) {
    const days = getTermDays(term);
    if (days !== null && draft.date) {
      onChange({ ...draft, paymentTerm: term, dueDate: addDaysISO(draft.date, days) });
    } else {
      onChange({ ...draft, paymentTerm: term });
    }
  }

  function handleDueDateChange(newDueDate: string) {
    // Si el usuario edita manualmente y el nuevo valor no coincide con lo que
    // el término actual calcularía, pasamos a "Personalizada" (label canónico
    // del catálogo si existe, o literal como fallback).
    const days = getTermDays(draft.paymentTerm);
    if (days !== null && draft.date) {
      const computed = addDaysISO(draft.date, days);
      if (newDueDate !== computed) {
        onChange({ ...draft, dueDate: newDueDate, paymentTerm: customTermLabel });
        return;
      }
    }
    onChange({ ...draft, dueDate: newDueDate });
  }

  function patchShipping(p: Partial<DocumentShipping>) {
    const nextShipping: DocumentShipping = { ...(draft.shipping ?? {}), ...p };
    patch("shipping", nextShipping);
  }

  function patchDiscountGlobal(p: Partial<DocumentDiscountGlobal>) {
    const current = draft.discountGlobal ?? { type: "PERCENT" as const, value: 0 };
    const nextDiscount: DocumentDiscountGlobal = { ...current, ...p };
    patch("discountGlobal", nextDiscount);
  }

  /**
   * FASE 8.2.5a — Orchestrator DELGADO de `patchLine`.
   *
   * Toda la lógica pura (detección de flags manuales + recálculo transitorio
   * cuando hay manualPriceEdit + recompute de manualTaxRate para líneas
   * MANUAL + merge de flags) vive en `src/lib/sales/patchLineHelpers.ts`
   * y tiene tests unitarios.
   *
   * Lo que queda acá es lo NO-puro: side-effect sobre `initialLineSnapshots`
   * (ref de React) + `onChange(...)` que dispara el preview.
   */
  function patchLine(lineId: string, p: Partial<DocumentLine>) {
    const before = draft.lines.find((l) => l.id === lineId);
    const { isManualPriceEdit, flagDeltas } = detectManualEdit(before, p);

    const patched = draft.lines.map((l) => {
      if (l.id !== lineId) return l;
      return buildPatchedLine({ line: l, patch: p, isManualPriceEdit, flagDeltas });
    });

    // Side effect: snapshot inicial al primer asignamiento de articleId
    // (quick-pick dentro del editor avanzado). Mutación de ref — NO entra
    // en el orchestrator puro.
    if (p.articleId && !initialLineSnapshots.current.has(lineId)) {
      const justSet = patched.find((l) => l.id === lineId);
      if (justSet) {
        initialLineSnapshots.current.set(lineId, {
          unitPrice:      justSet.unitPrice,
          discountAmount: justSet.discountAmount || 0,
          taxAmount:      justSet.taxAmount,
        });
      }
    }

    onChange({ ...draft, lines: patched });
    // El cambio en draft.lines dispara previewSignature → salesApi.preview
    // hidrata la línea (con su debounce de 350 ms). NO refetch per-line.
  }

  /**
   * Selección/limpieza de artículo desde el combo de una línea.
   * - Si limpia: igual a `patchLine` con campos del artículo en blanco.
   * - Si elige un artículo ya presente en otra línea: suma cantidad ahí y
   *   deja la línea actual como estaba (típicamente vacía).
   * - Si no es duplicado: completa la línea con los datos del artículo.
   * Tras esto, asegura que haya UNA línea vacía al final y mueve el foco
   * a su combo (sin abrir el dropdown).
   */
  function handleLineArticlePick(lineId: string, item: TPArticleLite | null) {
    if (!item) {
      // Bug fix: borrar el artículo del combo debe DEJAR LA LÍNEA COMO
      // VACÍA — sin precio, bonificación, impuesto, snapshot ni meta del
      // artículo previo. Bypassamos `patchLine` (que setea flags manuales
      // según las diferencias) y reseteamos a un shape limpio.
      const nextLines = draft.lines.map((l): DocumentLine => {
        if (l.id !== lineId) return l;
        return {
          id:             l.id,
          // Conservamos el `type` (HEADER/ARTICLE) — borrar artículo no
          // cambia la naturaleza de la fila.
          type:           l.type,
          // Defaults de línea vacía:
          quantity:       1,
          unitPrice:      0,
          discountAmount: 0,
          subtotal:       0,
          taxAmount:      0,
          lineTotal:      0,
          article:        "",
          variant:        "",
          // Limpieza explícita de TODO lo que dependía del artículo:
          articleId:       undefined,
          variantId:       undefined,
          sku:             undefined,
          itemKind:        undefined,
          imageUrl:        undefined,
          images:          undefined,
          description:     undefined,
          warehouseId:     undefined,
          pricingMeta:     undefined,
          manualOverrides: undefined,
          isManual:        false,
          manualDescription: undefined,
        };
      });
      // Limpiamos el snapshot inicial — la próxima vez que el usuario
      // pickee un artículo en esta misma línea se va a tomar uno nuevo.
      initialLineSnapshots.current.delete(lineId);
      // Limpiar también el ítem cacheado para que el editor borre su
      // `pickedById` y la fila Stock/Almacén/Canal desaparezca.
      setPickedItemForLine(lineId, null);
      // Cancelamos cualquier preview stale que pueda volver con datos
      // del artículo anterior (incrementar reqId invalida la respuesta).
      previewReqIdRef.current += 1;
      onChange({ ...draft, lines: nextLines });
      return;
    }

    // Bug 3 (regla deseada): el combo de artículo SIEMPRE rellena la línea
    // actual (lineId), incluso si el artículo ya existe en otra línea. La
    // dedupe (sumar cantidad en la línea existente) corresponde al flujo
    // del scanner — ver `addLineFromArticle` que se invoca desde el
    // quick-add bar. Acá NUNCA dedupe.
    const ctx = buildCommercialContext(draft, selectedClient);

    // Completar la línea actual con el artículo. Patch optimista (sin
    // cálculos) + el doc preview (salesApi.preview) hidrata los valores
    // reales en el siguiente debounce.
    const norm = normalizeLineFromItem(item, ctx);
    const initialQty = norm.initialQuantity;
    const opt = buildOptimisticLinePatch(item, initialQty);
    // Servicios no administran almacén — no setear warehouseId.
    const warehouseIdNew = norm.manageStock
      ? (defaultLineWarehouseId)
      : undefined;
    let nextLines: DocumentLine[] = draft.lines.map((l) => {
      if (l.id !== lineId) return l;
      return {
        ...l,
        articleId:      norm.articleId,
        variantId:      norm.variantId,
        sku:            norm.sku,
        itemKind:       norm.itemKind,
        article:        norm.article,
        variant:        norm.variant ?? "",
        description:    norm.description ?? l.description,
        imageUrl:       norm.imageUrl,
        images:         norm.images,
        warehouseId:    norm.manageStock ? (l.warehouseId ?? warehouseIdNew) : undefined,
        quantity:       initialQty,
        unitPrice:      opt.unitPrice,
        discountAmount: opt.discountAmount,
        taxAmount:      opt.taxAmount,
        subtotal:       opt.subtotal,
        lineTotal:      opt.lineTotal,
        pricingMeta:    opt.meta,
        // Cambio de artículo → se limpian todos los overrides manuales
        // de la línea (regla del refactor: artículo nuevo, todo arranca
        // del backend).
        manualOverrides: undefined,
        // Si la línea era manual, al elegir un artículo dejamos de serlo.
        isManual: false,
        manualDescription: undefined,
      };
    });
    // Snapshot inicial para "Restablecer línea".
    const justSet = nextLines.find((l) => l.id === lineId);
    if (justSet && !initialLineSnapshots.current.has(lineId)) {
      initialLineSnapshots.current.set(lineId, {
        unitPrice:      justSet.unitPrice,
        discountAmount: justSet.discountAmount || 0,
        taxAmount:      justSet.taxAmount,
      });
    }
    // Cachear el ítem por lineId — el editor lo lee para mostrar Stock /
    // Almacén / Canal sin esperar que el usuario re-elija desde su combo.
    setPickedItemForLine(lineId, item);
    // Refetch real: el cambio en draft.lines dispara previewSignature →
    // salesApi.preview hidrata la nueva línea con valores del motor.

    // Garantizar UNA línea vacía al final para seguir cargando.
    let trailingId: string;
    const last = nextLines[nextLines.length - 1];
    if (last && isEmptyLine(last)) {
      trailingId = last.id;
    } else {
      const empty = makeEmptyLine();
      nextLines = [...nextLines, empty];
      trailingId = empty.id;
    }

    // Fase 6: totales hidratados por salesApi.preview vía applySalePreviewToDraft.
    onChange({ ...draft, lines: nextLines });

    // Mover foco al combo de la línea vacía nueva (sin abrir dropdown).
    setFocusLineId(trailingId);
    setFocusLineBump((b) => b + 1);
  }

  /** Calcula `taxAmount` (clamped a 0) aplicando `rate%` sobre `subtotal`.
   *  Usado por `patchLine` para recomputar el impuesto de líneas manuales
   *  cuando el operador edita precio/cantidad y la línea tiene
   *  `manualTaxRate > 0`. Líneas manuales nuevas nacen con `rate=0` →
   *  el bloque de recálculo se saltea (early-return) y el total queda
   *  exactamente en `subtotal` (WYSIWYG). */
  // FASE 8.2.5a — `computeManualTax` se movió a `src/lib/sales/patchLineHelpers.ts`.
  // Alias local conservado para los otros consumidores dentro del componente
  // (e.g., setLineTaxOverride, applyLineOverrides). Mismo contrato byte-a-byte.
  const computeManualTax = computeManualTaxLib;

  function addLine() {
    // Si ya hay placeholder vacío al final, no duplicar — enfocar esa
    // línea existente para que el operador siga cargando ahí.
    const last = draft.lines[draft.lines.length - 1];
    if (draft.lines.length > 0 && last && isEmptyLine(last)) {
      setFocusLineId(last.id);
      setFocusLineBump((b) => b + 1);
      return;
    }
    // Si no hay líneas, ensureTrailingEmpty no agrega — manejar a mano.
    let trailingId: string;
    let nextLines: DocumentLine[];
    if (draft.lines.length === 0) {
      const empty = makeEmptyLine();
      nextLines = [empty];
      trailingId = empty.id;
    } else {
      nextLines = ensureTrailingEmpty([...draft.lines]);
      trailingId = nextLines[nextLines.length - 1].id;
    }
    // Fase 6: totales hidratados por salesApi.preview vía applySalePreviewToDraft.
    onChange({ ...draft, lines: nextLines });

    // Foco automático en el combo de artículo de la nueva línea. El combo
    // de cada línea respeta `focusSignal` solo cuando `focusedLineId === l.id`.
    setFocusLineId(trailingId);
    setFocusLineBump((b) => b + 1);
  }

  /**
   * Convierte la línea `lineId` en una línea MANUAL (texto libre, sin
   * pricing-engine) con la descripción dada. Limpia cualquier dato del
   * artículo previo. Garantiza una línea vacía trailing para seguir
   * cargando.
   */
  function handleCreateManualLine(lineId: string, text: string) {
    const txt = text.trim();
    if (!txt) return;

    // WYSIWYG en pricing: la línea manual nace SIN impuesto aplicado. El
    // motor backend no calcula tax para líneas sin `articleId`; el frontend
    // tampoco aplica un impuesto "automático" por default. Si el operador
    // quiere cargar IVA u otro impuesto, debe ajustarlo manualmente. Antes
    // se tomaba `getDefaultManualTaxRate()` (favorito del tenant) y eso
    // generaba discordancia: la cell mostraba 0% mientras el total incluía
    // 21% del IVA. Ahora 0 = 0.
    const taxRate = 0;

    let nextLines: DocumentLine[] = draft.lines.map((l): DocumentLine => {
      if (l.id !== lineId) return l;
      return {
        id:               l.id,
        type:             l.type,
        isManual:         true,
        manualDescription: txt,
        manualTaxRate:    taxRate,
        article:          "",
        variant:          "",
        quantity:         1,
        unitPrice:        0,
        discountAmount:   0,
        subtotal:         0,
        taxAmount:        0,
        lineTotal:        0,
        // Limpieza de cualquier resto del artículo previo:
        articleId:        undefined,
        variantId:        undefined,
        sku:              undefined,
        itemKind:         undefined,
        imageUrl:         undefined,
        images:           undefined,
        description:      undefined,
        warehouseId:      undefined,
        pricingMeta:      undefined,
        manualOverrides:  undefined,
      };
    });

    // Limpiar caches del item picked y snapshot inicial (la línea ya no es de catálogo).
    setPickedItemForLine(lineId, null);
    initialLineSnapshots.current.delete(lineId);

    // Garantizar UNA línea vacía al final para seguir cargando.
    let trailingId: string;
    const last = nextLines[nextLines.length - 1];
    if (last && isEmptyLine(last)) {
      trailingId = last.id;
    } else {
      const empty = makeEmptyLine();
      nextLines = [...nextLines, empty];
      trailingId = empty.id;
    }

    onChange({ ...draft, lines: nextLines });
    setFocusLineId(trailingId);
    setFocusLineBump((b) => b + 1);
  }

  /** Agrega una cabecera al final del listado de líneas. La cabecera agrupa
   *  las líneas siguientes hasta la próxima cabecera (sólo visualmente — no
   *  afecta totales). */
  function addHeader() {
    const nextLines = [...draft.lines, makeHeaderLine()];
    // Fase 6: totales hidratados por salesApi.preview vía applySalePreviewToDraft.
    onChange({ ...draft, lines: nextLines });
  }

  /** Elimina TODAS las líneas de tipo HEADER conservando intactos artículos,
   *  líneas manuales, sus ids y su orden actual. No dispara recálculo del
   *  pricing: las cabeceras no entran al payload de `sales/preview`
   *  (`isPreviewableLine` las descarta), así que la firma del preview NO
   *  cambia y los totales se mantienen idénticos.
   *  Si no hay cabeceras, no hace nada (no muta `draft`). */
  function removeAllHeaders() {
    const nextLines = draft.lines.filter((l) => !isHeaderLine(l));
    if (nextLines.length === draft.lines.length) return;
    onChange({ ...draft, lines: nextLines });
  }

  function removeLine(lineId: string) {
    // 0a) Capturar el nombre del artículo ANTES de eliminar — para el
    //     toast informativo. Usamos `article` como nombre primario; si
    //     está vacío caemos a "Línea eliminada" (caso headers / placeholder).
    const removedLine = draft.lines.find((l) => l.id === lineId);
    const articleName = (removedLine?.article ?? "").trim();

    // 0b) Limpieza pre-mutación: blur del foco activo + invalidación de
    //     cualquier preview en vuelo que pudiera reinyectar la línea.
    if (typeof document !== "undefined") {
      const active = document.activeElement;
      if (active && active instanceof HTMLElement) active.blur();
    }
    // Cancelamos cualquier respuesta de salesApi.preview que esté volando
    // con la línea incluida — al volver, la firma no coincidirá con el
    // draft (la línea ya no estará) y `applySalePreviewToDraft` la
    // ignorará por reqId. Esto previene que un preview stale "reviva"
    // la línea recién eliminada.
    previewReqIdRef.current += 1;

    // 1) Localizar el contenedor scrolleable real para preservar scroll.
    //    La página vive dentro de `<Modal>` que rendea `.tp-scroll` con
    //    `overflow-y-auto` — `window.scrollY` no aplica.
    let scrollEl: HTMLElement | null = null;
    let savedScroll = 0;
    if (typeof document !== "undefined") {
      const tpScroll = document.querySelector<HTMLElement>(".tp-scroll");
      if (tpScroll) scrollEl = tpScroll;
      savedScroll = scrollEl?.scrollTop ?? window.scrollY ?? 0;
    }

    // 2) Filtrar la línea por id estable. Si quedaron 0 líneas, agregamos
    //    una vacía para que el editor no muestre el empty-state agresivo
    //    y para que el usuario pueda seguir cargando.
    let nextLines = draft.lines.filter((l) => l.id !== lineId);
    if (nextLines.length === 0) {
      nextLines = [makeEmptyLine()];
    }
    // Limpiar el ítem cacheado para que el editor borre su `pickedById`
    // de esta línea — evita que un re-render tardío (preview en vuelo)
    // rehidrate UI con datos del artículo eliminado.
    setPickedItemForLine(lineId, null);
    onChange({ ...draft, lines: nextLines });

    // 3) Toast informativo (autodismiss 3200 ms — `toast.info` default).
    //    No bloquea UI, no mueve scroll, no cambia foco. Se dispara DESPUÉS
    //    del onChange para que aparezca cuando la línea ya desapareció
    //    visualmente.
    if (articleName) {
      toast.info(`El artículo "${articleName}" ha sido eliminado`);
    } else {
      toast.info("Línea eliminada");
    }

    // 4) Doble RAF — esperar al re-render + paint. Si algo movió el
    //    scroll por el unmount (focus reset / layout), volvemos al valor
    //    previo. Solo escribimos si difiere para no disparar listeners.
    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (scrollEl) {
            if (scrollEl.scrollTop !== savedScroll) scrollEl.scrollTop = savedScroll;
          } else if (window.scrollY !== savedScroll) {
            window.scrollTo({ top: savedScroll, left: 0, behavior: "auto" });
          }
        });
      });
    }
  }

  function duplicateLine(lineId: string) {
    const idx = draft.lines.findIndex((l) => l.id === lineId);
    if (idx < 0) return;
    const original = draft.lines[idx];
    if (isEmptyLine(original)) return; // no duplicar placeholders
    // Deep-clone defensivo: sin esto, `pricingMeta` (con sub-objetos
    // `composition`, `taxBreakdown`, `metalHechuraBreakdown`, `taxOverride`,
    // `manualDiscount`, etc.) y `manualOverrides` quedan COMPARTIDOS por
    // referencia entre la línea original y la duplicada. Aunque hoy todos
    // los handlers usan spread inmutable, una mutación accidental futura
    // (o un sub-componente que muta in-place) afectaría a las dos líneas.
    // `structuredClone` cubre todos los campos visuales / snapshots / steps.
    const clone: DocumentLine = {
      ...original,
      id: uid(),
      ...(original.pricingMeta
        ? { pricingMeta: structuredClone(original.pricingMeta) }
        : {}),
      ...(original.manualOverrides
        ? { manualOverrides: { ...original.manualOverrides } }
        : {}),
    };
    const nextLines = [
      ...draft.lines.slice(0, idx + 1),
      clone,
      ...draft.lines.slice(idx + 1),
    ];
    // Heredar el ítem cacheado del original al clon — así la línea
    // duplicada renderiza Stock / Almacén / Canal igual que el original
    // sin esperar al preview.
    const originalPicked = pickedItemsByLineId.get(lineId);
    if (originalPicked) setPickedItemForLine(clone.id, originalPicked);
    // Fase 6: totales hidratados por salesApi.preview vía applySalePreviewToDraft.
    onChange({ ...draft, lines: nextLines });
  }

  /** Reordena dos líneas reales por id (drag & drop). El placeholder vacío
   *  queda fijo al final por la partición que hace el editor (isReorderable),
   *  pero igualmente blindamos acá excluyendo cualquier intento sobre vacías. */
  function reorderLines(fromId: string, toId: string) {
    const fromIdx = draft.lines.findIndex((l) => l.id === fromId);
    const toIdx   = draft.lines.findIndex((l) => l.id === toId);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
    if (isEmptyLine(draft.lines[fromIdx]) || isEmptyLine(draft.lines[toIdx])) return;

    const next = [...draft.lines];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    // Reorden no afecta cálculos.
    // Fase 6: totales hidratados por salesApi.preview vía applySalePreviewToDraft.
    onChange({ ...draft, lines: next });
  }

  /** Agrega una línea pre-cargada con los datos del artículo seleccionado
   *  desde el quick-add. Si el ÍTEM EXACTO ya está en líneas, incrementa
   *  la cantidad (modo escaneo) en vez de duplicar la fila.
   *
   *  Identidad para dedupe (importante para variantes):
   *    · ARTICLE_VARIANT → key = `VARIANT:<variantId>`  (cada variante es ítem propio)
   *    · ARTICLE_SIMPLE  → key = `ARTICLE:<articleId>`
   *    · SERVICE         → key = `SERVICE:<articleId>`
   *    · COMBO           → key = `COMBO:<articleId>`
   *    · sin id (legacy) → fallback name+variant
   *
   *  Esto asegura que dos variantes del mismo artículo padre se traten
   *  como ítems INDEPENDIENTES y NO se sumen entre sí ni con el padre.
   *
   *  Tras agregar, garantiza una línea vacía al final para seguir cargando.
   */
  function addLineFromArticle(item: TPArticleLite) {
    const itemKey = getSearchItemIdentityKey(item);

    // Match contra líneas REALES (excluye placeholders vacíos y headers).
    const existingIdx = draft.lines.findIndex((l) => {
      if (isEmptyLine(l)) return false;
      if (isHeaderLine(l)) return false;
      return getLineIdentityKey(l) === itemKey;
    });

    let nextLines: DocumentLine[];
    const ctx = buildCommercialContext(draft, selectedClient);

    let touchedLineId: string | null = null;
    let touchedQty = 1;
    if (existingIdx >= 0) {
      // Refrescar el ítem cacheado en la línea existente (el TPArticleLite
      // del último escaneo puede traer datos más recientes que el
      // anterior). Idempotente si es el mismo ítem.
      setPickedItemForLine(draft.lines[existingIdx].id, item);
      // Incrementar cantidad. Solo ajustamos qty + recomputamos
      // subtotal/lineTotal local con los unitarios actuales para reflejo
      // visual; el refetch async pisa con los valores reales del backend
      // (que reaplica desc por cantidad / promo con la nueva qty).
      nextLines = draft.lines.map((l, i) => {
        if (i !== existingIdx) return l;
        const newQty = (l.quantity || 0) + 1;
        touchedLineId = l.id;
        touchedQty = newQty;
        const partialMeta: NonNullable<DocumentLine["pricingMeta"]> = {
          ...(l.pricingMeta ?? {}),
          partial:    true,
          resolvedAt: Date.now(),
        };
        const subtotal  = round2(Math.max(0, newQty * (l.unitPrice ?? 0) - (l.discountAmount ?? 0)));
        const lineTotal = round2(subtotal + (l.taxAmount ?? 0));
        return {
          ...l,
          quantity:    newQty,
          subtotal,
          lineTotal,
          pricingMeta: partialMeta,
        };
      });
    } else {
      // Línea nueva. Patch optimista (sin cálculos) + refetch async.
      const norm = normalizeLineFromItem(item, ctx);
      const initialQty = norm.initialQuantity;
      const opt = buildOptimisticLinePatch(item, initialQty);
      const newLine: DocumentLine = {
        id:             uid(),
        articleId:      norm.articleId,
        variantId:      norm.variantId,
        sku:            norm.sku,
        itemKind:       norm.itemKind,
        article:        norm.article,
        variant:        norm.variant ?? "",
        description:    norm.description,
        imageUrl:       norm.imageUrl,
        images:         norm.images,
        warehouseId:    norm.manageStock ? defaultLineWarehouseId : undefined,
        quantity:       initialQty,
        unitPrice:      opt.unitPrice,
        discountAmount: opt.discountAmount,
        taxAmount:      opt.taxAmount,
        subtotal:       opt.subtotal,
        lineTotal:      opt.lineTotal,
        pricingMeta:    opt.meta,
        // Snapshot liviano para cabeceras automáticas. No viaja al motor.
        headerSnapshot: (item.categoryName || item.groupName || item.brand || item.manufacturer)
          ? {
              categoryName: item.categoryName,
              groupName:    item.groupName,
              brand:        item.brand,
              manufacturer: item.manufacturer,
            }
          : undefined,
      };
      touchedLineId = newLine.id;
      touchedQty = initialQty;
      // Snapshot inicial para el botón "Restablecer línea".
      initialLineSnapshots.current.set(newLine.id, {
        unitPrice:      newLine.unitPrice,
        discountAmount: newLine.discountAmount || 0,
        taxAmount:      newLine.taxAmount,
      });
      // Cachear el ítem por lineId para que el editor lo lea desde
      // `pickedItemsByLineId` y popule su `pickedById` interno —
      // sin esto, la fila Stock / Almacén / Canal no se renderiza
      // (era la inconsistencia visible con el flujo del TPCombo).
      setPickedItemForLine(newLine.id, item);
      if (draft.lines.length > 0 && isEmptyLine(draft.lines[draft.lines.length - 1])) {
        // Si el usuario dejó una línea vacía al final (creada con "+ Línea
        // vacía" o el dotted area), la reemplazamos por la nueva.
        nextLines = [...draft.lines.slice(0, -1), newLine];
      } else {
        nextLines = [...draft.lines, newLine];
      }
    }

    // Garantizar siempre UNA línea vacía al final para seguir cargando rápido.
    nextLines = ensureTrailingEmpty(nextLines);

    // Fase 6: totales hidratados por salesApi.preview vía applySalePreviewToDraft.
    // El cambio en draft.lines dispara previewSignature → re-pricing automático.
    onChange({ ...draft, lines: nextLines });
    void touchedLineId; void touchedQty;
  }

  /**
   * Ref con el clientId actualmente "pickeado". Se actualiza
   * SINCRÓNICAMENTE en `handleClientPick` para que el callback async del
   * `getOne` pueda decidir si su respuesta sigue siendo relevante sin
   * depender del closure (que captura el `draft` viejo).
   */
  const lastPickedClientIdRef = useRef<string | null>(null);

  /**
   * Selección/limpieza de cliente desde el combo. Guarda el objeto completo,
   * autocompleta campos del documento (lista, término, moneda, vendedor),
   * persiste clientId + clientSnapshot **inmediatamente**, dispara fetch
   * async del detalle (para enriquecer con dirección/contacto) y, si ya hay
   * líneas con artículo, abre prompt para recalcular precios.
   *
   * Importante: la dirección se aplica en cuanto vuelve `getOne`, sin
   * depender del `draft` capturado en closure (era el bug que obligaba a
   * seleccionar dos veces el mismo cliente).
   */
  /**
   * FASE 8.2.5b — Orchestrator DELGADO de `handleClientPick`.
   *
   * Helpers puros extraídos a `src/lib/sales/clientPickHelpers.ts`:
   *   - `normalizeEntityCurrency` — resuelve id/code/undefined.
   *   - `resolveClientFxRate`     — devuelve fxRate + warning opcional.
   *   - `computeDueDateFromTerm`  — calcula vencimiento o "".
   *
   * Acá queda lo NO-puro: refs, setState, onChange, async fetch, recalc prompt.
   */
  function handleClientPick(entity: TPEntityLite | null) {
    if (!entity) {
      lastPickedClientIdRef.current = null;
      setSelectedClient(null);
      setClientDetail(null);
      onChange({
        ...draft,
        client: "",
        clientId: undefined,
        clientSnapshot: undefined,
      });
      return;
    }

    const normalizedEntity = normalizeEntityCurrency(entity, currencies);
    const autoPatch = applyClientToDraft(draft, normalizedEntity);

    // Resolver cotización del cliente (puro). El warning lo emite el orchestrator.
    const { fxRate: nextFxRate, warning: fxWarning } =
      resolveClientFxRate(autoPatch.currency, currencies);
    if (fxWarning) toast.warning(fxWarning);

    // Canonizar el paymentTerm contra el catálogo PAYMENT_TERM. Si el cliente
    // NO tiene paymentTerm configurado, limpiamos explícitamente el del draft
    // para que no quede el del cliente anterior. El combo cae a "— Sin definir —".
    const rawTerm = autoPatch.paymentTerm ?? normalizedEntity.paymentTerm ?? "";
    const canonicalTerm = canonicalizeTerm(rawTerm);
    (autoPatch as any).paymentTerm = canonicalTerm;

    const snapshot = buildClientSnapshot(normalizedEntity);
    if (canonicalTerm) snapshot.paymentTerm = canonicalTerm;

    // Vencimiento (puro). Limpieza explícita cuando no hay término o no se
    // puede calcular — evita leak entre clientes.
    const dueDatePatch: Partial<SalesInvoice> = {
      dueDate: computeDueDateFromTerm({
        canonicalTerm,
        draftDate: draft.date,
        getTermDays,
        addDaysISO,
      }),
    };

    // Vendedor: al cambiar de cliente, vaciamos el `seller` actual para que
    // el effect re-aplique la jerarquía (cliente.sellerId → favorito → sin
    // asignar). El ref de "explicit clear" también se resetea más abajo.
    const sellerPatch: Partial<SalesInvoice> = { seller: entity.sellerId ?? "" };

    const nextDraftPatch: Partial<SalesInvoice> = {
      ...autoPatch,
      ...(nextFxRate !== undefined ? { fxRate: nextFxRate } : {}),
      ...dueDatePatch,
      ...sellerPatch,
      client:         entity.name,
      clientId:       entity.id,
      clientSnapshot: snapshot,
    };

    // 1) Aplicamos el cambio de cliente OPTIMISTAMENTE (sin esperar a la
    //    red). Cliente, lista, moneda, término y vencimiento quedan vivos
    //    al instante. La dirección llega después con `getOne`.
    setSelectedClient(entity);
    lastPickedClientIdRef.current = entity.id;
    // Cambiar de cliente reabre el flujo de "vendedor por defecto":
    // si el cliente tiene sellerId, eso pisa; si no, queda libre para que
    // entre el favorito.
    sellerExplicitlyClearedRef.current = false;
    const optimisticDraft: SalesInvoice = { ...draft, ...nextDraftPatch };
    onChange(optimisticDraft);

    // 2) Detail fetch (para dirección + datos completos). Usamos refs para
    //    descartar respuestas obsoletas si el usuario eligió otro cliente
    //    antes de que volviera la red.
    const reqId = ++clientDetailRequestRef.current;
    setClientDetail(null);
    commercialEntitiesApi
      .getOne(entity.id)
      .then((d) => {
        if (clientDetailRequestRef.current !== reqId) return;
        if (lastPickedClientIdRef.current !== entity.id) return;
        setClientDetail(d);
        // Reconstruimos el snapshot completo con los datos del detail.
        const lite = entityRowToLite(d as unknown as EntityRow);
        const fullSnap = buildClientSnapshot(lite, d);
        // Preservamos seller del lite original (no viene en EntityDetail).
        fullSnap.seller = snapshot.seller;
        const addr = pickDefaultAddress(d);
        if (addr) {
          fullSnap.address   = composeAddressLine(addr);
          fullSnap.addressId = addr.id;
        }
        // Mergeamos sobre `optimisticDraft` (capturado en closure) — incluye
        // los campos que ya seteamos en el paso 1, sin riesgo de stale state.
        onChange({
          ...optimisticDraft,
          clientSnapshot: { ...optimisticDraft.clientSnapshot, ...fullSnap },
        });
      })
      .catch((err) => {
        // FASE 9 — I2: hasta ahora este catch era silencioso. Si el fetch del
        // detail completo del cliente falla (timeout, 5xx, 404), el snapshot
        // queda con lo optimista del paso 1 — sin dirección por defecto, sin
        // condición fiscal extendida — y el operador no se entera. Avisamos
        // con toast.
        if (clientDetailRequestRef.current !== reqId) return;
        if (lastPickedClientIdRef.current !== entity.id) return;
        toast.error(
          "No se pudo cargar toda la información del cliente. " +
          "Verificá dirección y condición fiscal antes de confirmar.",
        );
        // eslint-disable-next-line no-console
        console.warn("[VentasFacturas] commercialEntitiesApi.getOne falló:", err);
      });

    // 3) Si hay líneas reales, preguntamos por el recálculo (no afecta la
    //    selección — el cliente ya quedó aplicado en el paso 1).
    const hasRealLines = draft.lines.some(
      (l) => !isEmptyLine(l) && !isHeaderLine(l),
    );
    if (hasRealLines) {
      setRecalcPrompt({
        open: true,
        nextClient: entity,
        nextDraftPatch,
      });
    }
  }

  /**
   * Confirma recálculo de líneas con el nuevo cliente. El cliente ya se
   * aplicó optimistamente en `handleClientPick`; acá refetch contra el
   * motor del backend para CADA línea con articleId.
   *
   * Las líneas con `manualOverride` se preservan y, si hay alguna, se
   * abre el prompt secundario para que el usuario decida si también
   * quiere recalcularlas.
   */
  function confirmRecalcWithNewClient() {
    const { nextClient } = recalcPrompt;
    setRecalcPrompt({ open: false, nextClient: null, nextDraftPatch: {} });
    if (!nextClient) return;
    // El cliente ya fue aplicado optimistamente vía applyClientToDraft →
    // draft.clientId cambió → previewSignature ya está re-evaluándose.
    // Confirmar = no-op (el preview ya está en vuelo).
  }

  /**
   * Cancela recálculo. El cliente ya quedó aplicado optimistamente —
   * mantenemos los precios actuales y solo cerramos el prompt.
   */
  function skipRecalcWithNewClient() {
    setRecalcPrompt({ open: false, nextClient: null, nextDraftPatch: {} });
  }

  const balance = Math.max(0, effectiveTotals.total - draft.paidAmount);
  // Mock de saldo previo del cliente — Fase 7 traerá el saldo real de la
  // cuenta corriente. Hoy arrancamos en 0 para que el bloque "Impacto" sea
  // visible y consistente.
  const balanceBefore = 0;
  const balanceAfter  = balanceBefore + (effectiveTotals.total - draft.paidAmount);

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? "Nueva factura de venta" : `Editar factura ${draft.number}`}
      subtitle={`Número ${draft.number}`}
      maxWidth="7xl"
      className="!max-w-[1500px] w-[96vw]"
      resizable
      maximizable
      maximizedMode="embedded"
      modalKey="ventas-facturas-editor"
      onEnter={onSave}
      footer={
        <TPDocumentModalFooter
          isNew={isNew}
          onCancel={onClose}
          onSave={onSave}
          cancelIcon={<X size={14} />}
          onSaveDraft={saveDraftToBackend}
          draftSaving={draftSaving}
          extraActions={
            <>
              <TPButton
                variant="ghost"
                onClick={handlePrintDocument}
                title="Imprimir documento (factura)"
                iconLeft={<Printer size={14} />}
              >
                Imprimir
              </TPButton>
              <TPButton
                variant="ghost"
                onClick={() => setLabelsOpen(true)}
                disabled={labelItems.length === 0}
                title={labelItems.length === 0 ? "Sin artículos para etiquetar" : "Imprimir etiquetas de los artículos"}
                iconLeft={<Tag size={14} />}
              >
                Etiquetas
              </TPButton>
              <TPButton
                variant="ghost"
                onClick={() => toast.info("Próximamente: envío por email del documento.")}
                disabled
                title="Próximamente — requiere endpoint backend POST /sales/:id/send-email"
                iconLeft={<Mail size={14} />}
              >
                Enviar
              </TPButton>
            </>
          }
          summary={
            <div className="flex items-center gap-2 text-xs text-muted">
              <span>
                Subtotal: <span className="font-semibold text-text">{mFmt(effectiveTotals.subtotal)}</span>
                <span className="mx-2 text-border">·</span>
                Impuestos: <span className="font-semibold text-text">{mFmt(effectiveTotals.taxAmount)}</span>
                <span className="mx-2 text-border">·</span>
                Total: <span className="font-bold text-primary">{mFmt(effectiveTotals.total)}</span>
              </span>
              <TPTechPricingLoader
                active={previewStatus === "loading"}
                label="Recalculando…"
              />
            </div>
          }
        />
      }
    >
      <div className="space-y-3">
        {/* FASE 8.2.2b — Cabecera migrada a <InvoiceHeaderForm>.
            Cero lógica comercial: callbacks semánticos cerrados sobre los
            handlers del padre (handleClientPick, handlePaymentTermChange,
            handleSellerChange, etc.). */}
        <InvoiceHeaderForm
          clientId={draft.clientId}
          clientName={draft.client}
          clientSnapshot={draft.clientSnapshot}
          clientOptions={clientOptions}
          clientsLoading={clientsLoading}
          clientAddresses={(clientDetail?.addresses ?? []) as any}
          composeAddressLine={composeAddressLine}

          date={draft.date}
          dueDate={draft.dueDate}
          paymentTerm={draft.paymentTerm}
          paymentTermOptions={paymentTermOptions}

          currency={draft.currency}
          fxRate={draft.fxRate}
          currencies={currencies}
          isBaseCurrencyResolver={isBaseCurrency}

          seller={draft.seller}
          sellers={sellers}
          referenceNumber={draft.referenceNumber}

          salesOrderNumber={draft.salesOrderNumber}
          deliveryNumber={draft.deliveryNumber}

          onPickClient={handleClientPick}
          onCreateNewClient={() => setClientCreateOpen(true)}
          onOpenEditClient={handleOpenEditClient}

          onDateChange={handleDateChange}
          onDueDateChange={handleDueDateChange}
          onPaymentTermChange={handlePaymentTermChange}

          onOpenFx={openFx}

          onSellerChange={(v) => {
            // Recordamos si el usuario eligió explícitamente "Sin asignar"
            // para que el effect del favorito no vuelva a setearlo encima.
            sellerExplicitlyClearedRef.current = v === "";
            patch("seller", v);
          }}
          onReferenceChange={(v) => patch("referenceNumber", v)}

          onOpenAddressEdit={openAddressEdit}
          onSelectAddress={selectClientAddress}

          onLinkSalesOrderOpen={() => { setLinkOvDraft(""); setLinkOvOpen(true); }}
          onLinkDeliveryOpen={() => { setLinkRemDraft(""); setLinkRemOpen(true); }}
          onClearOriginDocs={() =>
            onChange({ ...draft, salesOrderNumber: "", deliveryNumber: "" })
          }
          onViewSalesOrder={() =>
            toast.info(`Ver ${draft.salesOrderNumber} — próximamente`)
          }
          onViewDelivery={() =>
            toast.info(`Ver ${draft.deliveryNumber} — próximamente`)
          }
        />

        {/* ── Líneas — ancho completo del modal para aprovechar el espacio
            horizontal disponible (combo de artículo, composición, etc.). */}
        <TPCard
            title="Líneas"
            bodyClassName="!p-3"
            headerClassName="!py-2"
            right={
              <div className="flex items-center gap-2">
                {realLineIds.length > 0 && (
                  <TPButton
                    variant="secondary"
                    onClick={() => setResetAllConfirmOpen(true)}
                    iconLeft={<RotateCcw size={14} />}
                    className="h-7 text-xs"
                    title="Restablecer valores editados del comprobante (preserva artículos y cantidades)"
                  >
                    Restablecer
                  </TPButton>
                )}
                <TPButton
                  variant={showQuickSearch ? "primary" : "secondary"}
                  onClick={toggleQuickSearch}
                  iconLeft={<ScanLine size={14} />}
                  className="h-7 text-xs"
                  title={showQuickSearch ? "Ocultar escaneo" : "Mostrar escaneo"}
                >
                  {showQuickSearch ? "Escaneo activo" : "+ Escanear artículo"}
                </TPButton>
                <TPButton
                  variant="secondary"
                  onClick={addLine}
                  iconLeft={<Plus size={14} />}
                  className="h-7 text-xs"
                >
                  Línea vacía
                </TPButton>
              </div>
            }
          >
            {/* Quick-add — alineado al borde IZQUIERDO del card. Misma
                grid de columnas que las líneas pero SIN la columna drag
                (14px) inicial — así el combo arranca en X=0 del card.
                Mantiene el ancho equivalente al combo de Artículo
                (minmax 420px / 1.575fr) gracias al solver de grid. */}
            {showQuickSearch && (
              <div className={cn(
                "mb-3 grid grid-cols-1 items-end gap-x-2",
                "lg:grid-cols-[minmax(420px,1.575fr)_minmax(110px,0.45fr)_minmax(220px,0.85fr)_minmax(130px,0.5fr)_minmax(130px,0.5fr)_minmax(180px,auto)_auto]",
              )}>
                {/* Combo ARTÍCULO — empieza en el borde izquierdo del card.
                    `scanMode` enforce-a match EXACTO al presionar Enter:
                    si el código escaneado no calza con sku/code/barcode
                    de algún resultado, NO selecciona un parcial. Esto evita
                    que escanear "A000-00A" elija "A005-00A" porque era
                    el primer match parcial. */}
                <div>
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                    <ScanLine size={11} />
                    Agregar rápido / escanear código
                  </div>
                  <TPArticleVariantSearchSelect
                    value={null}
                    onChange={(item) => { if (item) addLineFromArticle(item); }}
                    placeholder="Escaneá un código o buscá por SKU / nombre…"
                    autoFocusOnSelect
                    focusSignal={scanFocusSignal}
                    remoteSearch={searchArticles}
                    scanMode
                    exactLookup={exactLookupArticle}
                    onNoExactMatch={(q) => {
                      toast.warning(`No se encontró código exacto: "${q}". Buscá manualmente y elegí de la lista.`);
                    }}
                    onMultipleExactMatches={(q, matches) => {
                      toast.warning(
                        `Se encontraron ${matches.length} ítems con el código "${q}". Elegí uno desde la lista.`,
                      );
                    }}
                  />
                </div>

                {/* Columnas restantes vacías — placeholder para el solver. */}
                <div className="hidden lg:block" />
                <div className="hidden lg:block" />
                <div className="hidden lg:block" />
                <div className="hidden lg:block" />
                <div className="hidden lg:block" />
                <div className="hidden lg:block" />
              </div>
            )}

            {/* Barra contextual de carga: Lista + Almacén con popovers */}
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-border bg-surface/40 px-3 py-1.5 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold uppercase tracking-wide text-[10px] text-muted">Lista:</span>
                <button
                  ref={listBtnRef}
                  type="button"
                  data-tp-enter="ignore"
                  onClick={() => setListPopOpen((o) => !o)}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold text-text hover:bg-surface2/60"
                >
                  {listLabel}
                  <ChevronDown size={11} className="text-muted" />
                </button>
              </div>
              <span className="text-border">·</span>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold uppercase tracking-wide text-[10px] text-muted">Almacén:</span>
                <button
                  ref={whBtnRef}
                  type="button"
                  data-tp-enter="ignore"
                  onClick={() => setWhPopOpen((o) => !o)}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold text-text hover:bg-surface2/60"
                >
                  {whLabel}
                  <ChevronDown size={11} className="text-muted" />
                </button>
              </div>
              <span className="text-border">·</span>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold uppercase tracking-wide text-[10px] text-muted">Canal:</span>
                <button
                  ref={chBtnRef}
                  type="button"
                  data-tp-enter="ignore"
                  onClick={() => setChPopOpen((o) => !o)}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold text-text hover:bg-surface2/60"
                >
                  {chLabel}
                  <ChevronDown size={11} className="text-muted" />
                </button>
              </div>
              {/* Acciones estructurales a la derecha: Ordenar · Cabeceras · Expandir/Colapsar
                  El menú "Cabeceras" unifica las dos acciones que antes vivían
                  en botones separados ("Agregar cabecera" + "Generar cabeceras").
                  La separación generaba ruido visual sin razón funcional —
                  ambas son la misma intención: estructurar el listado de líneas. */}
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  data-tp-enter="ignore"
                  onClick={sortLinesBySku}
                  title="Ordenar por SKU"
                  aria-label="Ordenar por SKU"
                  className="inline-flex h-6 w-6 items-center justify-center rounded border border-border bg-card text-muted transition hover:bg-surface2/60 hover:text-text"
                >
                  <ArrowDownAZ size={12} />
                </button>
                {/* Menú único "Cabeceras": agregar manual + generar
                    automáticas por criterio. El header (Categoría / Marca /
                    Grupo / Metal / Tipo / Fabricante) preserva las cabeceras
                    editadas por el operador en cada regeneración. */}
                <button
                  ref={headersBtnRef}
                  type="button"
                  data-tp-enter="ignore"
                  onClick={() => setHeadersPopOpen((o) => !o)}
                  title="Cabeceras"
                  aria-label="Cabeceras"
                  className="inline-flex h-6 w-6 items-center justify-center rounded border border-border bg-card text-muted transition hover:bg-surface2/60 hover:text-text"
                >
                  <Heading2 size={12} />
                </button>
                {realLineIds.length > 0 && (
                  <button
                    type="button"
                    data-tp-enter="ignore"
                    onClick={toggleAllLinesExpand}
                    title={allExpanded ? "Colapsar todo" : "Expandir todo"}
                    aria-label={allExpanded ? "Colapsar todo" : "Expandir todo"}
                    className="inline-flex h-6 w-6 items-center justify-center rounded border border-border bg-card text-muted transition hover:bg-surface2/60 hover:text-text"
                  >
                    {allExpanded ? <ChevronsDownUp size={12} /> : <ChevronsUpDown size={12} />}
                  </button>
                )}
              </div>
            </div>

            <TPPopover open={listPopOpen} onClose={() => setListPopOpen(false)} anchorRef={listBtnRef} width={220}>
              <ul className="py-1">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      // Marcar "Sin lista" como decisión EXPLÍCITA del
                      // operador para que el useEffect de favoritos no
                      // re-aplique la lista favorita. Reset global lo limpia.
                      onChange({
                        ...draft,
                        priceListId: undefined,
                        priceListExplicitlyCleared: true,
                      });
                      setListPopOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center px-3 py-1.5 text-left text-xs hover:bg-surface2/60",
                      !draft.priceListId && "bg-primary/10 text-primary font-semibold"
                    )}
                  >
                    — Sin lista —
                  </button>
                </li>
                {priceLists.length === 0 && (
                  <li className="px-3 py-2 text-[11px] italic text-muted">
                    Sin listas de precios configuradas.
                  </li>
                )}
                {priceLists.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        // Decisión nueva sobreescribe el flag de "Sin lista".
                        onChange({
                          ...draft,
                          priceListId: p.id,
                          priceListExplicitlyCleared: false,
                        });
                        setListPopOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-surface2/60",
                        draft.priceListId === p.id && "bg-primary/10 text-primary font-semibold"
                      )}
                      title={p.code}
                    >
                      <span className="truncate">{p.name}</span>
                      {p.isFavorite && (
                        <span className="ml-2 shrink-0 text-[9px] uppercase tracking-wide text-amber-500">
                          Favorita
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </TPPopover>

            <TPPopover open={whPopOpen} onClose={() => setWhPopOpen(false)} anchorRef={whBtnRef} width={220}>
              <ul className="py-1">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      // Cascada del global → líneas sin override. Las líneas
                      // con `warehouseOverride=true` mantienen su almacén
                      // (no se pisan); las demás siguen al global. Marcamos
                      // "Sin almacén" como explícito para que el useEffect
                      // de favoritos no lo re-aplique.
                      onChange({
                        ...draft,
                        warehouse: "",
                        warehouseExplicitlyCleared: true,
                        lines: draft.lines.map((l) =>
                          l.warehouseOverride === true
                            ? l
                            : { ...l, warehouseId: undefined },
                        ),
                      });
                      setWhPopOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center px-3 py-1.5 text-left text-xs hover:bg-surface2/60",
                      !draft.warehouse && "bg-primary/10 text-primary font-semibold"
                    )}
                  >
                    — Sin almacén —
                  </button>
                </li>
                {warehouses.length === 0 && (
                  <li className="px-3 py-2 text-[11px] italic text-muted">
                    Sin almacenes activos.
                  </li>
                )}
                {warehouses.map((w) => {
                  const isFav = favoriteWarehouseId === w.id;
                  return (
                    <li key={w.id}>
                      <button
                        type="button"
                        onClick={() => {
                          // Cascada del global → líneas sin override (idem
                          // botón "Sin almacén"). Pricing NO se recalcula:
                          // warehouseId no afecta el preview, solo el confirm.
                          // La elección sobreescribe el flag de "Sin almacén".
                          onChange({
                            ...draft,
                            warehouse: w.id,
                            warehouseExplicitlyCleared: false,
                            lines: draft.lines.map((l) =>
                              l.warehouseOverride === true
                                ? l
                                : { ...l, warehouseId: w.id },
                            ),
                          });
                          setWhPopOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-surface2/60",
                          draft.warehouse === w.id && "bg-primary/10 text-primary font-semibold",
                        )}
                        title={w.code ? `Código: ${w.code}` : undefined}
                      >
                        <span className="truncate">{w.name}</span>
                        {isFav && (
                          <span className="shrink-0 text-[10px] text-amber-500" title="Almacén favorito">
                            ⭐
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </TPPopover>

            <TPPopover open={chPopOpen} onClose={() => setChPopOpen(false)} anchorRef={chBtnRef} width={240}>
              <ul className="py-1">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      // Marcar "Sin canal" como decisión EXPLÍCITA del
                      // operador. Sin el flag, el useEffect de favoritos
                      // re-aplicaba el canal favorito al detectar
                      // `channelId` vacío. El reset global limpia el flag.
                      onChange({
                        ...draft,
                        channelId: undefined,
                        channelExplicitlyCleared: true,
                      });
                      setChPopOpen(false);
                      // draft.channelId ya está en deps de previewSignature →
                      // el preview se re-dispara automáticamente.
                    }}
                    className={cn(
                      "flex w-full items-center px-3 py-1.5 text-left text-xs hover:bg-surface2/60",
                      !draft.channelId && "bg-primary/10 text-primary font-semibold",
                    )}
                  >
                    — Sin canal —
                  </button>
                </li>
                {salesChannels.length === 0 && (
                  <li className="px-3 py-2 text-[11px] italic text-muted">
                    Sin canales configurados.
                  </li>
                )}
                {salesChannels.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        // Al elegir un canal explícito, limpiamos el flag
                        // de "Sin canal explícito" — la decisión nueva
                        // sobreescribe la anterior.
                        onChange({
                          ...draft,
                          channelId: c.id,
                          channelExplicitlyCleared: false,
                        });
                        setChPopOpen(false);
                        // draft.channelId ya está en deps de previewSignature →
                        // el preview se re-dispara automáticamente.
                      }}
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-surface2/60",
                        draft.channelId === c.id && "bg-primary/10 text-primary font-semibold",
                      )}
                      title={c.code}
                    >
                      <span className="truncate">{c.name}</span>
                      {c.isFavorite && (
                        <span className="ml-2 shrink-0 text-[9px] uppercase tracking-wide text-amber-500">
                          Favorito
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </TPPopover>

{/* Popover unificado "Cabeceras":
                  · sección 1 — agregar una cabecera MANUAL editable al final
                    del listado (reemplaza el viejo botón independiente).
                  · sección 2 — generar cabeceras AUTOMÁTICAS agrupando por
                    criterio. El orden entre grupos se aplica alfabético en
                    `generateHeadersByCriterion` (ver el helper).
                Las cabeceras editadas por el operador se preservan en
                regeneraciones siguientes. Click fuera / Escape cierran el
                popover (`TPPopover` ya implementa ambos). */}
            <TPPopover open={headersPopOpen} onClose={() => setHeadersPopOpen(false)} anchorRef={headersBtnRef} width={240}>
              <div className="border-b border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                Cabeceras
              </div>
              {(() => {
                const hasHeaders = draft.lines.some(isHeaderLine);
                return (
                  <ul className="py-1">
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          addHeader();
                          setHeadersPopOpen(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-surface2/60"
                      >
                        <Plus size={12} className="shrink-0 text-muted" />
                        <span>Agregar cabecera manual</span>
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        disabled={!hasHeaders}
                        onClick={() => {
                          removeAllHeaders();
                          setHeadersPopOpen(false);
                        }}
                        title={hasHeaders ? "Eliminar todas las cabeceras existentes" : "No hay cabeceras para eliminar"}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs",
                          hasHeaders
                            ? "hover:bg-surface2/60"
                            : "cursor-not-allowed opacity-50",
                        )}
                      >
                        <Trash2 size={12} className="shrink-0 text-muted" />
                        <span>Eliminar cabeceras</span>
                      </button>
                    </li>
                  </ul>
                );
              })()}
              <div className="border-t border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                Generar automáticamente por…
              </div>
              <ul className="py-1">
                {(["CATEGORY", "BRAND", "GROUP", "MANUFACTURER", "METAL", "ARTICLE_TYPE"] as HeaderGroupBy[]).map((c) => (
                  <li key={c}>
                    <button
                      type="button"
                      onClick={() => handleGenerateHeadersBy(c)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-surface2/60"
                    >
                      <span>{HEADER_GROUP_BY_LABEL[c]}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="border-t border-border px-3 py-1.5 text-[10px] italic text-muted/70">
                Las cabeceras editadas se preservan al regenerar.
              </div>
            </TPPopover>

            {/* FASE 8.2.2 — Editor de líneas extraído a <LinesEditorSection>.
                Wrapper presentacional: passthrough de callbacks + empty state.
                Sin lógica comercial. */}
            <LinesEditorSection
              lines={linesForView}
              totalLinesInDraft={draft.lines.length}
              currency={currencyDisplay}
              displayRate={displayRate}
              viewMode={viewMode}
              headerSubtotals={headerSubtotals}
              priceLists={priceLists.map((p) => ({ id: p.id, name: p.name }))}
              channels={salesChannels.map((c) => ({ id: c.id, name: c.name }))}
              warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))}
              unitNameByCode={unitNameByCode}
              currencyById={currencyById}
              saleGlobalAdjustments={saleGlobalAdjustments}
              articleStockBreakdown={articleStockBreakdown}
              pickedItemsByLineId={pickedItemsByLineId}
              currentPriceListId={draft.priceListId}
              currentPriceListLabel={listLabel}
              currentChannelId={draft.channelId}
              currentChannelLabel={chLabel}
              currentWarehouseId={draft.warehouse}
              expandedLineIds={expandedLineIds}
              advancedOpenLineIds={advancedOpenLineIds}
              onToggleExpand={toggleLineExpand}
              onToggleAdvancedOpen={toggleLineAdvancedOpen}
              patchLine={patchLine}
              removeLine={removeLine}
              duplicateLine={duplicateLine}
              reorderLines={reorderLines}
              resetLine={resetLine}
              isReorderable={(l) => !isEmptyLine(l)}
              onAddLine={addLine}
              setLineTaxOverride={setLineTaxOverride}
              applyLineOverrides={applyLineOverrides}
              clearLineOverrides={clearLineOverrides}
              onChangePriceList={(id) => onChange({ ...draft, priceListId: id ?? undefined })}
              onChangeLinePriceList={(lineId, priceListId) => {
                // Override de lista por línea: persiste en
                // `line.priceListIdOverride` + `line.priceListOverride=true`.
                onChange({
                  ...draft,
                  lines: draft.lines.map((l) =>
                    l.id === lineId
                      ? { ...l, priceListIdOverride: priceListId, priceListOverride: priceListId != null }
                      : l,
                  ),
                });
              }}
              onChangeChannel={(id) => onChange({ ...draft, channelId: id || undefined })}
              handleEditArticle={handleEditArticle}
              handleLineArticlePick={handleLineArticlePick}
              handleCreateManualLine={handleCreateManualLine}
              searchArticles={searchArticles}
              exactLookupArticle={exactLookupArticle}
              focusedLineId={focusLineId}
              focusSignal={focusLineBump}
              editorScopeRef={editorScopeRef}
              previewLoading={previewStatus === "loading"}
            />
          </TPCard>

        {/* ── Zona inferior — grid 2 columnas:
            izquierda  : Observaciones, términos y adjuntos
            derecha    : Descuento global · Envío · Cupón · Totales (Hero)

            El cupón se ubica arriba del Hero Total; ambos comparten la
            columna derecha con Descuento global y Envío. La columna
            derecha se ensanchó (~25%) a 420–540px para que Descuento
            global y los cards inferiores no queden angostos respecto a
            Observaciones. Todos los cards del aside heredan ese ancho
            (mismo `space-y-3`). */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_minmax(420px,540px)] lg:items-start">
          {/* Observaciones, términos y adjuntos — columna izquierda */}
          <TPCollapse
            open={extrasOpen}
            onToggle={() => setExtrasOpen((v) => !v)}
            iconLeft={<FileText size={14} />}
            title="Observaciones, términos y adjuntos"
            description="Contenido extendido del comprobante — opcional"
          >
            <ObservationsTermsAttachmentsCard
              notes={draft.notes}
              onNotesChange={(v) => patch("notes", v)}
              terms={draft.terms}
              onTermsChange={(v) => patch("terms", v)}
              templateTerms={templateTerms}
              canSaveAsDefault={can("COMPANY_SETTINGS:EDIT")}
              onSaveAsDefault={handleSaveTermsAsDefault}
              receiptId={savedReceiptId}
            />
          </TPCollapse>

          {/* Aside derecho: Descuento global → Envío → Cupón → Totales */}
          <aside className="space-y-3">
            {/* FASE 8.2 — Cards extraídos a ./ventas-facturas/InvoiceEditorModal/.
                Sin lógica comercial: solo passthrough de value/onPatch. */}
            <DiscountCard
              value={draft.discountGlobal}
              onPatch={patchDiscountGlobal}
              open={discountOpen}
              onOpenChange={setDiscountOpen}
              fmtCurrency={mFmt}
            />
            <ShippingCard
              value={draft.shipping}
              onPatch={patchShipping}
              open={shippingOpen}
              onOpenChange={setShippingOpen}
              fmtCurrency={mFmt}
            />

            {/* Cupón de venta — justo arriba del Hero Total. Solo manda
                couponCode al backend; el motor aplica el descuento si el
                cupón es válido. Frontend NO calcula nada. */}
            <CouponCard
              draft={draft}
              onChange={onChange}
              clientId={selectedClient?.id}
              onApplied={() => { /* draft.couponCode ya está en deps de previewSignature → recálculo automático */ }}
            />

            {/* FASE 8.2.2 — Hero migrado a <TotalsHeroSection>.
                Sin lógica: passthrough de pricingDetail (computado en este
                componente) + indicador discreto durante el PRIMER fetch. */}
            <TotalsHeroSection
              composition={pricingDetail}
              currency={currencyDisplay}
              displayRate={displayRate}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              previewStatus={previewStatus}
              hasResponse={backendPreview != null}
              previewStale={previewStatus === "error" && backendPreview != null}
            />

            {/* FASE 8.2.3 — Cobro migrado a <PaymentCard>.
                Sin lógica: state `payments[]` + sync a `draft.paidAmount`
                permanecen en este componente. La card es presentacional. */}
            <PaymentCard
              payments={payments}
              effectiveTotal={effectiveTotals.total}
              totalCobrado={totalCobrado}
              balance={balance}
              open={paymentOpen}
              onOpenChange={setPaymentOpen}
              onAddPayment={addPayment}
              onUpdatePayment={updatePayment}
              onRemovePayment={removePayment}
              paymentMethodOptions={PAYMENT_METHOD_MOCK_OPTIONS}
              depositOptions={DEPOSIT_MOCK_OPTIONS}
              currencyOptions={CURRENCY_MOCK_OPTIONS.map(c => ({ value: c.id, label: c.label }))}
              fmtCurrency={mFmt}
            />

            {/* Impacto en cuenta corriente (colapsable) */}
            <TPCard
              title="Impacto cta. cte."
              bodyClassName="!p-3"
              headerClassName="!py-2"
              collapsible
              open={impactOpen}
              onOpenChange={setImpactOpen}
              right={
                <span className="text-[11px]">
                  <span className="text-muted">Saldo después </span>
                  <span className={cn(
                    "font-semibold tabular-nums",
                    balanceAfter > 0 ? "text-red-500" : balanceAfter < 0 ? "text-emerald-500" : "text-text"
                  )}>
                    {mFmt(balanceAfter)}
                  </span>
                </span>
              }
            >
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted">Saldo antes</span>
                  <span className="tabular-nums font-semibold text-text">{mFmt(balanceBefore)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Impacto</span>
                  <span className="tabular-nums font-semibold text-amber-500">{mFmt(effectiveTotals.total - draft.paidAmount)}</span>
                </div>
                <div className="flex justify-between border-t border-border/60 pt-1.5">
                  <span className="font-semibold text-text">Saldo después</span>
                  <span className={cn(
                    "tabular-nums font-bold",
                    balanceAfter > 0 ? "text-red-500" : balanceAfter < 0 ? "text-emerald-500" : "text-text"
                  )}>
                    {mFmt(balanceAfter)}
                  </span>
                </div>
              </div>
            </TPCard>
          </aside>
        </div>

        {/* ── Panel de validación pricing (paso 7 — Factura V1) ────────────
            Colapsable, no intrusivo. Lee `backendPreview.result` y lo pasa
            por `normalizeSalesPreview` para mostrar documentTotals,
            metalHechuraBreakdown y taxBreakdown alineados con el Simulador.
            El render principal de la factura (aside con totales) sigue
            intacto — este panel es solo capa de validación. */}
        <details className="rounded-md border border-border/60 bg-surface/30 px-3 py-2">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-muted hover:text-text">
            Validación pricing (motor)
            <TPTechPricingLoader
              active={previewStatus === "loading"}
              label="Recalculando…"
              className="ml-2"
            />
            {previewStatus === "error" && <span className="ml-2 font-normal text-red-500">error</span>}
          </summary>
          <div className="mt-2">
            <SalePricingPanel
              result={
                backendPreview && backendPreview.signature === previewSignature
                  ? backendPreview.result
                  : null
              }
              emptyText={
                previewStatus === "loading"
                  ? "Esperando respuesta del backend…"
                  : previewStatus === "error"
                    ? "El último preview falló. Editá una línea para reintentar."
                    : "Sin datos del backend todavía."
              }
            />
          </div>
        </details>
      </div>
    </Modal>

    {/* ── Modal: Editar cliente (modal real anidado) ─────────────────────── */}
    {clientEditOpen && draft.clientId && (
      <EntityEditModal
        open={clientEditOpen}
        mode="EDIT"
        entityId={draft.clientId}
        isClientContext
        suppressNavigate
        onClose={() => setClientEditOpen(false)}
        onSaved={handleClientEdited}
      />
    )}

    {/* ── Modal: Crear cliente desde el combo de Factura ─────────────────── */}
    {clientCreateOpen && (
      <EntityEditModal
        open={clientCreateOpen}
        mode="CREATE"
        isClientContext
        suppressNavigate
        onClose={() => setClientCreateOpen(false)}
        onSaved={(saved) => {
          // Auto-seleccionar el cliente recién creado en la factura.
          // Reutilizamos el mismo path que el pick desde el combo
          // (`handleClientPick`) para aplicar lista/término/seller del cliente.
          const lite = entityRowToLite(saved as unknown as EntityRow);
          if (lite.currency) {
            const known = currencies.some((c) => c.code === lite.currency);
            if (!known) {
              const matchById = currencies.find((c) => c.id === lite.currency);
              lite.currency = matchById ? matchById.code : undefined;
            }
          }
          handleClientPick(lite);
          setClientCreateOpen(false);
        }}
      />
    )}

    {/* ── Modal: Agregar dirección al cliente seleccionado ───────────────── */}
    {addressEditOpen && draft.clientId && (
      <AddressEditModal
        open={addressEditOpen}
        mode="create"
        entityId={draft.clientId}
        entityName={draft.clientSnapshot?.name ?? draft.client}
        onClose={() => setAddressEditOpen(false)}
        onSaved={handleAddressSaved}
      />
    )}

    {/* ── Modal: Imprimir etiquetas de los artículos del comprobante ────── */}
    <LabelPrintModal
      open={labelsOpen}
      onClose={() => setLabelsOpen(false)}
      items={labelItems}
    />

    {/* ── Modal: Restablecer comprobante (confirmación) ──────────────────── */}
    <Modal
      open={resetAllConfirmOpen}
      onClose={() => setResetAllConfirmOpen(false)}
      title="Restablecer comprobante"
      maxWidth="sm"
      onEnter={performResetAll}
      footer={
        <div className="flex justify-end gap-2">
          <TPButton variant="secondary" onClick={() => setResetAllConfirmOpen(false)} iconLeft={<X size={14} />}>
            Cancelar
          </TPButton>
          <TPButton variant="primary" onClick={performResetAll} iconLeft={<RotateCcw size={14} />}>
            Restablecer
          </TPButton>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] text-amber-200 flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <div>
            <strong className="block text-amber-100">Se restablecerán los valores editados del comprobante.</strong>
            <span>Los artículos y cantidades se conservarán.</span>
          </div>
        </div>
        <div className="text-[11px] text-muted">
          Se restauran: precios unitarios, descuentos por línea, impuestos, descuento global,
          envío y otros campos al estado original al abrir el comprobante.
        </div>
      </div>
    </Modal>

    {/* ── Diálogo: cambio de cliente con líneas cargadas ─────────────────── */}
    <ConfirmDeleteDialog
      open={recalcPrompt.open}
      title="Cambiar cliente"
      description={
        recalcPrompt.nextClient
          ? `Cambiaste el cliente a "${recalcPrompt.nextClient.name}". ¿Querés recalcular los precios de las líneas con la lista, condición fiscal y términos del nuevo cliente?`
          : "¿Recalcular precios con el nuevo cliente?"
      }
      confirmText="Recalcular precios"
      cancelText="Mantener precios actuales"
      icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
      onClose={skipRecalcWithNewClient}
      onConfirm={confirmRecalcWithNewClient}
    />

    {/* ── Modal: Editar artículo base (advertencia) ──────────────────────── */}
    <Modal
      open={editArticleId !== null}
      onClose={() => setEditArticleId(null)}
      title="Editar artículo base"
      maxWidth="sm"
      onEnter={confirmEditArticle}
      footer={
        <div className="flex justify-end gap-2">
          <TPButton variant="secondary" onClick={() => setEditArticleId(null)} iconLeft={<X size={14} />}>
            Cancelar
          </TPButton>
          <TPButton variant="primary" onClick={confirmEditArticle} iconLeft={<Pencil size={14} />}>
            Editar artículo
          </TPButton>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] text-amber-200">
          <strong className="block text-amber-100">Vas a editar el artículo base.</strong>
          <span>Los cambios impactarán en todo el sistema (otros documentos, listas de precios, stock).</span>
        </div>
        <div className="text-[11px] text-muted">
          Esta factura conserva su <strong>snapshot actual</strong> (precio, descripción y demás datos
          de la línea). Los cambios al artículo base no modifican esta línea automáticamente.
        </div>
      </div>
    </Modal>

    {/* ── Modal: Vincular OV origen ────────────────────────────────────── */}
    <Modal
      open={linkOvOpen}
      onClose={() => setLinkOvOpen(false)}
      title="Vincular OV origen"
      maxWidth="sm"
      onEnter={() => {
        onChange({ ...draft, salesOrderNumber: linkOvDraft.toUpperCase() });
        setLinkOvOpen(false);
      }}
      footer={
        <div className="flex justify-end gap-2">
          <TPButton variant="secondary" onClick={() => setLinkOvOpen(false)} iconLeft={<X size={14} />}>
            Cancelar
          </TPButton>
          <TPButton
            variant="primary"
            iconLeft={<Link2 size={14} />}
            onClick={() => {
              onChange({ ...draft, salesOrderNumber: linkOvDraft.toUpperCase() });
              setLinkOvOpen(false);
            }}
          >
            Vincular
          </TPButton>
        </div>
      }
    >
      <TPField label="Número de OV">
        <TPInput
          value={linkOvDraft}
          onChange={(v: string) => setLinkOvDraft(v)}
          placeholder="OV-0001"
        />
      </TPField>
    </Modal>

    {/* ── Modal: Vincular Remito origen ────────────────────────────────── */}
    <Modal
      open={linkRemOpen}
      onClose={() => setLinkRemOpen(false)}
      title="Vincular Remito origen"
      maxWidth="sm"
      onEnter={() => {
        onChange({ ...draft, deliveryNumber: linkRemDraft.toUpperCase() });
        setLinkRemOpen(false);
      }}
      footer={
        <div className="flex justify-end gap-2">
          <TPButton variant="secondary" onClick={() => setLinkRemOpen(false)} iconLeft={<X size={14} />}>
            Cancelar
          </TPButton>
          <TPButton
            variant="primary"
            iconLeft={<Link2 size={14} />}
            onClick={() => {
              onChange({ ...draft, deliveryNumber: linkRemDraft.toUpperCase() });
              setLinkRemOpen(false);
            }}
          >
            Vincular
          </TPButton>
        </div>
      }
    >
      <TPField label="Número de Remito">
        <TPInput
          value={linkRemDraft}
          onChange={(v: string) => setLinkRemDraft(v)}
          placeholder="REM-0001"
        />
      </TPField>
    </Modal>

    {/* FASE 8.2.3 — Modal FX migrado a <CurrencyFXModal>.
        Sin lógica: state + side-effects (applyFx) viven en el padre. */}
    <CurrencyFXModal
      open={fxOpen}
      onClose={() => setFxOpen(false)}
      currencies={currencies}
      value={fxDraft}
      onValueChange={setFxDraft}
      updateSystem={fxUpdateSystem}
      onUpdateSystemChange={setFxUpdateSystem}
      onApply={applyFx}
    />
    </>
  );
}

