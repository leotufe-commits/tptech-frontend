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

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  LayoutDashboard,
  LayoutGrid,
  Download,
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
import { useConfirmDialog } from "../components/ui/TPConfirmDialog";
import { TPStatusBadge } from "../components/ui/TPStatusBadge";
import { TPDocumentLineAdvancedEditor } from "../components/ui/TPDocumentLineAdvancedEditor";
import ConfirmDeleteDialog from "../components/ui/ConfirmDeleteDialog";
import { TPTotalCell } from "../components/ui/TPTotalCell";
import { normalizeSalesPreview } from "../lib/pricing/normalizePricingPreviewResult";
import { logParity } from "../lib/pricing";
import { selectInvoiceLineView } from "../lib/sales/selectInvoiceLineView";
// Fase 4.5 — Enter = next field para uso intensivo ERP.
import { useEnterTabNavigation } from "../lib/sales/useEnterTabNavigation";
import { isPreviewableLine, matchPreviewLines } from "../lib/sales/matchPreviewLines";
import { sortLinesPreservingHeaders, articleSkuSortKey } from "../lib/sales/sortLines";
import type { SalesInvoice, SalesInvoiceStatus, ClientSnapshot } from "../lib/sales/types";
import { buildClientSnapshot } from "../lib/sales/buildClientSnapshot";
import { resolveClientInheritedDiscount } from "../lib/sales/resolveClientInheritedDiscount";
import { buildSalePreviewPayload } from "../lib/sales/buildSalePreviewPayload";
import { buildSaleCreatePayload } from "../lib/sales/buildSaleCreatePayload";
import { promoteManualAdjustmentChange } from "../lib/sales/promoteManualAdjustmentChange";
import { applyGlobalPriceListChange } from "../lib/sales/applyGlobalPriceListChange";
import { applySaleResponseToDraft } from "../lib/sales/applySaleResponseToDraft";
import {
  saleRowToSalesInvoice,
  saleDetailToSalesInvoice,
  extractApiErrorMessage,
} from "../lib/sales/saleMapping";
import { applySalePreviewToDraft } from "../lib/sales/applySalePreviewToDraft";
// Fase A — política comercial: helper de interpretación (puro, sin
// matemática) + modal de confirmación reforzada para líneas CRITICAL.
import {
  aggregateDocumentStatus,
  deriveCommercialLevel,
  deriveCommercialInfo,
  type CommercialInfo,
} from "../lib/sales/commercialPolicy";
import CommercialPolicyConfirmModal from "../components/sales/CommercialPolicyConfirmModal";
import { useCardCollapse } from "../lib/sales/useCardCollapse";
import {
  detectManualEdit,
  buildPatchedLine,
  computeManualTax as computeManualTaxLib,
  resetLineForClientChange,
  clearLineExemptionFlag,
} from "../lib/sales/patchLineHelpers";
import {
  normalizeEntityCurrency,
  resolveClientFxRate,
  computeDueDateFromTerm,
  buildClientPatches,
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
// `documentTemplatesApi` y types relacionados se importan más abajo (junto
// al fetcher de company para Imprimir).
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
  resolveDefaultId,
  resolveDefaultChannelId,
  resolveDefaultCurrencyCode,
  resolveDefaultGlobalDiscountType,
  resolveCurrencyRate,
  userPreferencesApi,
  type SalesUserPreference,
} from "../services/user-preferences";
import { listUnits, type Unit as UnitRow } from "../services/units";
import { couponsApi, type ValidateCouponResult } from "../services/coupons";
import { salesApi, type SaleDocumentTotals, type SalePreviewResult, type SalePreviewLine, type SaleDetail } from "../services/sales";
// C5-fix Opcion A — Cliente del endpoint render-only desde el draft.
// El backend renderea EXACTAMENTE los props que mandamos (mismos que
// pasa el `<SaleInvoicePrintable>` en window.print()) → paridad
// Imprimir ↔ Descargar ↔ Mail sin pasar por Sale persistido.
import { salesDraftPdfApi, type SaleDraftPdfRequest } from "../services/salesDraftPdf";
import { taxesApi, type TaxRow } from "../services/taxes";
import { CouponCard } from "./ventas-facturas/CouponCard";
import {
  DiscountCard, ShippingCard, LinesEditorSection,
  AddressPickerPopover, CurrencyFXModal, PaymentCard, InvoiceHeaderForm,
  ObservationsTermsAttachmentsCard,
} from "./ventas-facturas/InvoiceEditorModal";
// Fase 1 — layout personalizable (plumbing): el modal itera las cards del
// aside sobre `layout`. Fase 2 — DnD activable desde la toolbar del modal.
import { useInvoiceLayout } from "./ventas-facturas/InvoiceEditorModal/layout/useInvoiceLayout";
import { useInvoiceViewPreset } from "./ventas-facturas/InvoiceEditorModal/layout/useInvoiceViewPreset";
import { useInvoiceUiPreferences } from "./ventas-facturas/InvoiceEditorModal/layout/useInvoiceUiPreferences";
import { asideColumnGridStyle } from "../lib/sales/invoiceViewPresets";
import { InvoiceSettingsModal } from "./ventas-facturas/InvoiceEditorModal/InvoiceSettingsModal";
// SaleInvoicePrintable vive en `tptech-shared` desde C1 (paridad visual
// cross-app: el mismo componente lo consume el print del browser y el
// renderer server-side Puppeteer).
import SaleInvoicePrintable from "@tptech/shared/document-printables/SaleInvoicePrintable";
import {
  documentTemplatesApi,
  buildLocalDefaultConfig,
  type DocumentTemplateConfig,
} from "../services/document-templates";
import {
  fetchCompanyFullProfile,
  fetchPricingPolicyConfig,
  type CompanyFullProfile,
} from "../services/company";
// Layout V2 — `LayoutGridContext` es la SSOT del render del aside en AMBOS
// modos (edición = drag/resize XY; lectura = posicionamiento absoluto sin
// handles). Los helpers V1 (`getCardsByRegion`, `v2WidthToV1Width`,
// `DraggableCard`, `getCardsBySlot`, `LayoutDndContext`) ya NO se usan
// desde este archivo — quedan en /layout/ como back-compat para
// consumidores externos.
import { LayoutGridContext } from "./ventas-facturas/InvoiceEditorModal/layout/v2/LayoutGridContext";
import { compactVerticallyByRegion } from "./ventas-facturas/InvoiceEditorModal/layout/v2/reflowLayout";
// F2 — Layouts V2 por preset (COMPACT/CLASSIC/FOCUS) con identidad visual real.
import {
  getDefaultLayoutForPreset,
  MAIN_BELOW_LINES_BY_PRESET,
} from "./ventas-facturas/InvoiceEditorModal/layout/v2/presetLayouts";
import type { InvoiceViewPreset } from "../lib/sales/invoiceViewPresets";
// `DraggableCard` y `LayoutDndContext` (V1 sortable lineal) ya NO se usan
// desde VentasFacturas — el render del aside pasó por completo al
// `LayoutGridContext` V2. Los componentes quedan en /layout/ para
// fallback responsive futuro o consumidores externos.
import { LayoutEditModeToolbar } from "./ventas-facturas/InvoiceEditorModal/layout/LayoutEditModeToolbar";
import type { CardId } from "./ventas-facturas/InvoiceEditorModal/layout/types";
import { compactLayoutByVisibility } from "./ventas-facturas/InvoiceEditorModal/layout/compactLayout";
import LabelPrintModal, { type LabelItem } from "./article-detail/LabelPrintModal";
// 1.E parte 2 — Modal reutilizable para enviar la factura por mail.
import SendInvoiceEmailModal from "../components/sales/SendInvoiceEmailModal";
import type { WarehouseRow } from "./InventarioAlmacenes/types";
import { TPDocumentModalFooter } from "../components/ui/TPDocumentModalFooter";
import TPDocumentTotalsHero from "../components/ui/TPDocumentTotalsHero";
// Etapa B — Card maestro que fusiona Hero + selector de Balance Mode +
// summary (UNIFIED/BREAKDOWN). Reemplaza al render manual del case "totals".
import { TotalDelComprobanteCard } from "../components/sales/TotalDelComprobanteCard";
import {
  deriveDocumentMetalsFromLines,
  buildCommercialMetalValueByParent,
  buildMetalSaleByParent,
  buildMetalSalePreByParent,
  buildVisibleGramsByParent,
  sumLineCommercialMonetary,
  sumLineCommercialMonetaryRoundingImpact,
  sumLineCommercialMetalRoundingImpact,
  groupLineCommercialMetalRoundingByParent,
} from "../components/sales/TotalDelComprobanteCard/helpers";
import { buildComponentTraces } from "../components/sales/TotalDelComprobanteCard/traceability";
import { TPSaleAccountImpactCard } from "../components/sales/TPSaleAccountImpactCard";
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
    // Combo: config del ajuste del combo (display de la composición). No es cálculo.
    commercialMode:        row.commercialMode as TPArticleLite["commercialMode"],
    comboAdjustmentKind:   (row as any).comboAdjustmentKind ?? null,
    comboAdjustmentValue:  (row as any).comboAdjustmentValue != null ? parseFloat(String((row as any).comboAdjustmentValue)) : null,
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
  // Etapa 3 — id del Sale persistido en backend para el draft actualmente
  // abierto en el modal. `null` mientras el operador edita una factura
  // nueva sin guardar. Tras `salesApi.create()` o `getOne()` se setea al
  // id real. Sale del state al cerrar el modal.
  const [persistedSaleId, setPersistedSaleId] = useState<string | null>(null);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
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

  // ── Etapa 3 — Listado real desde salesApi.list() ────────────────────────
  // Reemplaza el estado in-memory previo. Carga al montar y tras cada
  // acción persistida (create/update/confirm/cancel) via `refreshInvoices`.
  const refreshInvoices = useCallback(async () => {
    setLoadingInvoices(true);
    try {
      const result = await salesApi.list({ take: 100 });
      setInvoices(result.data.map(saleRowToSalesInvoice));
    } catch (e) {
      toast.error(extractApiErrorMessage(e, "No se pudo cargar la lista de facturas."));
    } finally {
      setLoadingInvoices(false);
    }
  }, []);

  useEffect(() => {
    void refreshInvoices();
  }, [refreshInvoices]);

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
    setPersistedSaleId(null);
    initialDraftJsonRef.current = null;
    // Nota: el state `savedSaleId` (id del Sale persistido) sigue viviendo
    // dentro de `InvoiceEditorModal` para el flujo legacy de mail. Se borra
    // naturalmente cuando el modal se desmonta.
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

    // Almacén por defecto: preferencia PERSONAL (UserPreference) → favorito
    // GENERAL de la joyería (Warehouse.isFavorite) → primer almacén activo.
    // `resolveDefaultId` valida "activo" en cada nivel.
    const jewelryFavWh = parentWarehouses.find((w) => w.isFavorite)?.id;
    const favWh        = resolveDefaultId(pref?.defaultWarehouseId, jewelryFavWh, parentWarehouses);
    const sellerId     = resolveDefaultId(pref?.defaultSellerId, favSeller?.id, parentSellers);
    const listId       = resolveDefaultId(pref?.defaultPriceListId, favList?.id, parentPriceLists);
    // Canal de venta: NO cae a "primer activo" — un canal sin elección
    // explícita aplicaría recargos/descuentos no pedidos por el operador.
    // Jerarquía: preferencia del usuario → favorito de joyería → "" (Sin canal).
    // (El cliente, si tiene canal default, lo resuelve el flujo de cliente en
    //  otra capa; este helper solo cubre pasos 2-3 de la jerarquía.)
    const channelId    = resolveDefaultChannelId(pref?.defaultChannelId, favChannel?.id, parentSalesChannels);
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
      // Tipo predeterminado del descuento global: UserPreference del usuario
       // → fallback "PERCENT" (default histórico). El valor sigue arrancando
       // en 0 — solo precargamos la elección del combo Tipo.
       discountGlobal:   { type: resolveDefaultGlobalDiscountType(pref?.defaultGlobalDiscountType), value: 0, reason: "" },
    };

    setDraft(blank);
    setIsNew(true);
    setEditorOpen(true);
    // Nota: el state `savedSaleId` lo gestiona `InvoiceEditorModal`. Como
    // el modal se monta de cero (key cambia con cada draft.id distinto),
    // arranca con id null y crea el Sale on-demand en el primer click de
    // Descargar PDF / Enviar mail.
    // Snapshot inicial — luego se compara para saber si hay cambios.
    initialDraftJsonRef.current = JSON.stringify(blank);
  }

  // ── Etapa 3 — Guardar borrador (DRAFT) en backend real ──────────────────
  // Si el draft NO está persistido → `salesApi.create()`.
  // Si está persistido + DRAFT → `salesApi.update()`.
  // Tras éxito: hidrata el draft con el response (id real, snapshots,
  // ajustes de documento Etapa 1.1) y refresca el listado.
  // Devuelve el `SaleDetail` persistido o `null` si falló / validación rota.
  async function persistDraftAsBackendDraft(): Promise<SaleDetail | null> {
    if (!draft) return null;

    if (!draft.client.trim() && !draft.clientId) {
      toast.error("El cliente es obligatorio.");
      return null;
    }
    if (!draft.date) {
      toast.error("La fecha es obligatoria.");
      return null;
    }
    if (!draft.currency.trim()) {
      toast.error("La moneda es obligatoria.");
      return null;
    }

    const built = buildSaleCreatePayload(draft);
    if (!built.hasRealLines) {
      toast.error("Agregá al menos una línea para guardar el borrador.");
      return null;
    }

    try {
      const saved = persistedSaleId
        ? await salesApi.update(persistedSaleId, built.payload)
        : await salesApi.create(built.payload);
      setPersistedSaleId(saved.id);
      setDraft((prev) => (prev ? applySaleResponseToDraft(prev, saved) : prev));
      return saved;
    } catch (e) {
      toast.error(extractApiErrorMessage(e, "No se pudo guardar el borrador."));
      return null;
    }
  }

  // ── Etapa 3 — Acción del botón "Crear" del modal: guarda y confirma ─────
  // Si el draft no está persistido, primero `salesApi.create()` y luego
  // `salesApi.confirm()`. Si ya está persistido como DRAFT, hace update
  // para asegurar que cualquier edición pendiente entre y después confirma.
  // 422 con blockingAlerts → modal de riesgo (ya existente).
  async function saveDraft(): Promise<void> {
    if (!draft) return;

    const saved = await persistDraftAsBackendDraft();
    if (!saved) return;

    // saved es DRAFT por contrato. Si ya estaba CANCELLED el backend rechazaría
    // el update con 409 (Etapa 1.2). El happy path: pasar a CONFIRMED.
    try {
      const confirmed = await salesApi.confirm(saved.id);
      setDraft((prev) => (prev ? applySaleResponseToDraft(prev, confirmed) : prev));
      toast.success(
        `Factura ${confirmed.code} confirmada${
          confirmed.receipts?.[0]?.code ? ` — N° ${confirmed.receipts[0].code}` : ""
        }.`,
      );
      initialDraftJsonRef.current = null;
      setEditorOpen(false);
      setDraft(null);
      setPersistedSaleId(null);
      await refreshInvoices();
    } catch (e: unknown) {
      const err = e as { status?: number; data?: { blockingAlerts?: string[]; message?: string } };
      if (err?.status === 422 && Array.isArray(err.data?.blockingAlerts) && err.data!.blockingAlerts!.length > 0) {
        const codes = err.data!.blockingAlerts!.join(", ");
        toast.error(`No se puede confirmar: hay alertas críticas (${codes}). Revisá la composición comercial.`);
        // El draft quedó persistido como DRAFT; el operador puede corregir y
        // volver a presionar Crear. NO cerramos el modal.
        await refreshInvoices();
        return;
      }
      toast.error(extractApiErrorMessage(e, "No se pudo confirmar la factura."));
      // El save SÍ entró (DRAFT persistido). Refrescamos listado.
      await refreshInvoices();
    }
  }

  // ── Etapa 3 — Editar borrador: rehidrata el modal con datos reales ──────
  // Etapa 5 — También se usa para "Ver factura" en sales no-DRAFT. El modal
  // detecta el status y abre en modo read-only (prop `readOnly`).
  async function editInvoice(invoice: SalesInvoice) {
    try {
      const detail   = await salesApi.getOne(invoice.id);
      const hydrated = saleDetailToSalesInvoice(detail);
      setDraft(hydrated);
      setPersistedSaleId(detail.id);
      setIsNew(false);
      setEditorOpen(true);
      initialDraftJsonRef.current = JSON.stringify(hydrated);
    } catch (e) {
      toast.error(extractApiErrorMessage(e, "No se pudo cargar la factura."));
    }
  }

  // ── Etapa 3 — Anular factura: pide motivo y captura 409 ─────────────────
  async function cancelInvoice(invoice: SalesInvoice) {
    if (invoice.status === "CANCELLED") {
      toast.info("La factura ya está anulada.");
      return;
    }
    const note = window.prompt(
      `Motivo de la anulación de la factura ${invoice.number}:`,
      "",
    );
    if (note === null) return;  // operador canceló el prompt
    try {
      const cancelled = await salesApi.cancel(invoice.id, note);
      const ncReceipt = cancelled.receipts?.find((r) => r.type === "CREDIT_NOTE");
      toast.success(
        ncReceipt
          ? `Factura ${cancelled.code} anulada — NC emitida (${ncReceipt.code}).`
          : `Factura ${cancelled.code} anulada.`,
      );
      await refreshInvoices();
    } catch (e) {
      toast.error(extractApiErrorMessage(e, "No se pudo anular la factura."));
    }
  }

  // ── Etapa 3 — Imprimir / descargar PDF oficial ──────────────────────────
  async function printInvoice(invoice: SalesInvoice) {
    if (invoice.status === "DRAFT") {
      toast.info("El borrador todavía no tiene PDF oficial. Confirmá la factura primero.");
      return;
    }
    try {
      const { blob, filename } = await salesApi.downloadPdf(invoice.id);
      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(extractApiErrorMessage(e, "No se pudo descargar el PDF."));
    }
  }

  // ── Row actions ──────────────────────────────────────────────────────────
  function rowActions(i: SalesInvoice): TPActionsMenuItem[] {
    const isDraft     = i.status === "DRAFT";
    const isCancelled = i.status === "CANCELLED";
    const items: TPActionsMenuItem[] = [];

    if (isDraft) {
      items.push({
        label: "Editar",
        icon: <Pencil size={14} />,
        onClick: () => void editInvoice(i),
      });
    } else {
      // Etapa 5 — "Ver factura" abre el modal en read-only.
      items.push({
        label: "Ver factura",
        icon: <Eye size={14} />,
        onClick: () => void editInvoice(i),
      });
    }

    items.push({ type: "separator" });

    if (!isDraft && !isCancelled) {
      items.push({
        label: "Registrar cobro",
        icon: <Wallet size={14} />,
        onClick: () => toast.info("Cobro de cliente — próximamente"),
      });
    }

    if (!isCancelled) {
      items.push({
        label: "Anular",
        icon: <X size={14} />,
        onClick: () => void cancelInvoice(i),
      });
    }

    items.push({ type: "separator" });

    items.push({
      label: "Imprimir",
      icon: <Printer size={14} />,
      onClick: () => void printInvoice(i),
    });

    return items;
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
          // Etapa C16.4 — inyectamos la persistencia de `Sale` para que el
          // botón "Guardar borrador" la llame ANTES del Receipt placeholder.
          onPersistSale={persistDraftAsBackendDraft}
          onClose={requestCloseEditor}
          templateTerms={templateTerms}
          onTemplateTermsChange={setTemplateTerms}
          // Etapa 5 — read-only granular: factura emitida o anulada no
          // permite edición visual. El modal sigue abriéndose (operador
          // puede revisar, imprimir, enviar) pero todos los inputs/botones
          // de mutación quedan deshabilitados via <fieldset disabled>.
          readOnly={draft.status !== "DRAFT"}
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
  /** Etapa C16.4 — Persistencia REAL de la Sale en backend.
   *  El handler "Guardar borrador" del footer (`saveDraftToBackend`) llama
   *  PRIMERO esta función para persistir `Sale` + líneas con todos sus
   *  campos (priceListId, channelId, couponCode, paymentMethodId, manual
   *  overrides, etc.) ANTES de crear el Receipt placeholder.
   *  Devuelve `SaleDetail` en éxito o `null` si validación / red falló
   *  (en cuyo caso la función mostró su propio toast.error). */
  onPersistSale: () => Promise<SaleDetail | null>;
  onClose: () => void;
  /** footerTerms de la plantilla FACTURA (resuelto en la página). */
  templateTerms: string;
  /** Refresca el footerTerms cacheado tras "Guardar como predeterminado". */
  onTemplateTermsChange: (v: string) => void;
  /** Etapa 5 — modo solo-lectura. Activado cuando la factura ya fue emitida
   *  (CONFIRMED / PARTIAL / PAID) o anulada (CANCELLED). El modal sigue
   *  abriendo con todo el layout y la información visible, pero todos los
   *  inputs/botones de mutación quedan deshabilitados via `<fieldset
   *  disabled>`. Las acciones permitidas (Imprimir, Descargar PDF,
   *  Enviar mail, Etiquetas, Cerrar) viven fuera del fieldset y siguen
   *  activas. */
  readOnly?: boolean;
}) {
  const { open, draft, isNew, onChange, onSave, onPersistSale, onClose, templateTerms, onTemplateTermsChange } = props;
  // Etapa 5 — fuente única de verdad del modo read-only para el modal.
  // Default = derivar del status del draft (defensa por si el padre olvida
  // pasar la prop). El padre la pasa explícita y eso prevalece.
  const isReadOnly = props.readOnly ?? (draft.status !== "DRAFT");

  const { can } = usePermissions();

  // Layout personalizable del modal — Fase 1 (plumbing) + Fase 2 (DnD aside).
  // El hook hidrata desde UserPreference + persiste con debounce. El render
  // del aside itera sobre `layout.cards` (slot aside) y envuelve cada item
  // en `<DraggableCard>` cuando `editLayoutMode=true`.
  const invoiceLayout = useInvoiceLayout(props.open);
  // Modal de confirmacion reusable (reemplaza window.confirm para no
  // mostrar el feo prompt nativo "localhost dice..."). Se usa en los 4
  // gates destructivos: descartar cambios, cerrar con cambios, restaurar
  // diseno, aplicar plantilla. El JSX del dialog se monta al final del
  // arbol del componente.
  const confirmDialog = useConfirmDialog();
  // UX.15 — Plantillas de vista (Fase 1). El preset define el LAYOUT BASE
  // (ancho del aside, densidad, etc.); el layout draggable manual del
  // usuario tiene PRIORIDAD encima. Hidratado al abrir el modal igual
  // que `useInvoiceLayout`, persistido inmediatamente al cambiar.
  const invoiceViewPreset = useInvoiceViewPreset(props.open);
  // UX.20 — Configuraciones finas de UI (densidad, sticky actions, ...).
  // Ortogonal al preset: el user puede combinar "COMPACT" + density
  // "COMFORTABLE" + stickyActions false, por ejemplo.
  const invoiceUiPreferences = useInvoiceUiPreferences(props.open);

  // ── Template "FACTURA" + perfil de empresa para impresión ───────────────
  // Se carga al abrir el modal. Si el usuario edita la plantilla en
  // "Configuración del sistema → Documentos → Plantilla: Factura", al
  // reabrir Factura tomamos el último estado (no cacheamos cross-session).
  // El fallback es `buildLocalDefaultConfig("FACTURA")` para que Imprimir
  // funcione incluso si el endpoint no responde.
  const [printTemplate, setPrintTemplate] = useState<DocumentTemplateConfig>(
    () => buildLocalDefaultConfig("FACTURA"),
  );
  const [printCompany, setPrintCompany]   = useState<CompanyFullProfile>({
    name: "", legalName: "", logoUrl: "", cuit: "", ivaCondition: "",
    addressLine: "", phone: "", email: "", website: "",
  });
  // Umbral "Margen mínimo recomendado" del tenant — alimenta el chip
  // comercial de cada línea (deriveCommercialInfo). Es CONFIG del tenant,
  // no cálculo: el frontend solo lo pasa al helper para que el chip
  // pueda mostrar "Margen X% (recomendado Y%)" cuando corresponde.
  // null = no configurado → el helper no muestra el "recomendado".
  const [recommendedMarginPercent, setRecommendedMarginPercent] = useState<number | null>(null);

  // Contador que se incrementa cuando la política comercial del tenant
  // cambia (evento global emitido por la pantalla Configuración → Política
  // comercial). Se incluye en la firma del preview para forzar refetch al
  // backend — los toggles "Considerar crítico..." impactan el resultado
  // del motor pero NO forman parte del payload, así que sin este bump
  // la caché de usePreviewFlow servía datos stale después de cambiar la
  // política con el modal de Factura ya abierto.
  //
  // No invalidamos `previewReqIdRef` desde acá: usePreviewFlow lo bumpea
  // internamente cada vez que la firma cambia (ver hook, línea ~129).
  const [policyVersion, setPolicyVersion] = useState(0);
  useEffect(() => {
    function handlePolicyChange() {
      setPolicyVersion(v => v + 1);
    }
    window.addEventListener("tptech:pricing-policy-changed", handlePolicyChange);
    return () => window.removeEventListener("tptech:pricing-policy-changed", handlePolicyChange);
  }, []);

  useEffect(() => {
    if (!props.open) return;
    let cancelled = false;
    documentTemplatesApi.get("FACTURA", "A4")
      .then((tpl) => { if (!cancelled) setPrintTemplate(tpl); })
      .catch(() => { /* silencioso — queda el default local */ });
    fetchCompanyFullProfile()
      .then((c) => { if (!cancelled) setPrintCompany(c); })
      .catch(() => { /* silencioso — queda el default vacío */ });
    fetchPricingPolicyConfig()
      .then((p) => {
        if (cancelled) return;
        const v = p.pricingLowMarginWarningPercent;
        setRecommendedMarginPercent(typeof v === "number" && Number.isFinite(v) ? v : null);
      })
      .catch(() => { /* silencioso — queda en null y el chip no muestra "recomendado" */ });
    return () => { cancelled = true; };
    // `policyVersion` se incluye como dep para que, al recibir el evento
    // global de cambio de política, también refresquemos el umbral de
    // margen recomendado además de invalidar el preview cacheado.
  }, [props.open, policyVersion]);
  // Estado del modal de Configuración (engranaje en el toolbar).
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Modo edición del layout (Fase 2). Se activa desde la toolbar del modal.
  // En modo lectura (false) los cards se renderizan SIN wrapper de drag —
  // el modal se ve idéntico al pre-Fase 1. Al cerrar el modal se vuelve a
  // false (no persiste; es un estado de UI temporal).
  const [editLayoutMode, setEditLayoutMode] = useState<boolean>(false);
  useEffect(() => {
    // Resetear el modo edición cuando se cierra el modal — evita que abra
    // la próxima factura ya en modo edición sin que el operador lo pida.
    if (!props.open) setEditLayoutMode(false);
  }, [props.open]);

  // Etapa 3 — Snapshot pre-edición + "Cancelar cambios".
  // `enterEditLayoutMode` captura el layout actual ANTES de mutar, y
  // `cancelEditLayoutChanges` lo restaura (re-emite por setLayout → debounce
  // re-arma y persistencia escribe el snapshot). Ambos cierran o mantienen
  // el modo edición según corresponda. Centralizar acá garantiza que
  // todos los entry-points (modal de Configuración, toolbar del banner)
  // usen el mismo flujo.
  const enterEditLayoutMode = useCallback(() => {
    invoiceLayout.takeSnapshot();
    setEditLayoutMode(true);
  }, [invoiceLayout]);
  // Salir del modo edicion ("Listo"): aplicamos una compactacion vertical
  // suave del aside antes de salir, para que cualquier hueco voluntario
  // que el operador dejo durante el diseno libre quede prolijo en modo
  // lectura. Si el layout ya estaba sin huecos, el compact es idempotente
  // y no cambia nada visible.
  const exitEditLayoutMode = useCallback(() => {
    const compactedCards = compactVerticallyByRegion(
      invoiceLayout.layoutV2.cards,
      "aside",
    );
    invoiceLayout.setLayoutV2({ version: 2, cards: compactedCards });
    setEditLayoutMode(false);
  }, [invoiceLayout]);
  const cancelEditLayoutChanges = useCallback(async () => {
    // QW6 — Confirmación destructiva. Evita pérdida accidental de
    // cambios cuando el operador editó por varios minutos.
    const ok = await confirmDialog.confirm({
      title: "Descartar cambios",
      description: "¿Descartar los cambios realizados en esta sesión?",
      confirmLabel: "Descartar",
      cancelLabel: "Seguir editando",
      tone: "warning",
    });
    if (!ok) return;
    const restored = invoiceLayout.restoreSnapshot();
    setEditLayoutMode(false);
    void restored;
  }, [invoiceLayout, confirmDialog]);

  // Wrapper de `onClose` del modal — si el operador está en modo edición
  // del layout y/o hay un save pendiente (debounce todavía no disparó),
  // confirmamos antes de cerrar para evitar perder cambios visibles que
  // aún no llegaron al backend.
  const handleModalClose = useCallback(async () => {
    const inEdit = editLayoutMode;
    const savePending = invoiceLayout.persistenceStatus === "pending";
    if (inEdit || savePending) {
      const ok = await confirmDialog.confirm({
        title: "Cerrar con cambios",
        description:
          "Estás personalizando el layout y puede haber cambios sin "
          + "guardar. ¿Cerrar de todas formas?",
        confirmLabel: "Cerrar",
        cancelLabel: "Seguir editando",
        tone: "warning",
      });
      if (!ok) return;
    }
    onClose();
  }, [editLayoutMode, invoiceLayout.persistenceStatus, onClose, confirmDialog]);

  // Fase A — política comercial: el gate `handleConfirmedSave` y
  // `acceptCommercialRisk` se declaran MÁS ABAJO, después de definir
  // `documentCommercialStatus` y `commercialOverrideAccepted`. Acá no
  // los declaramos para evitar use-before-declaration.

  // Reset del layout — handler local que cierra el modo edición sólo si el
  // operador toca "Listo"; "Restaurar diseño" mantiene el modo abierto para
  // que el operador siga ajustando.
  // QW6 — confirmación destructiva: el reset es irreversible (el snapshot
  // pre-edit no se preserva tras el reset). Borrar el layout custom y
  // volver al default debería ser una acción consciente.
  // F2 — "Restaurar diseño" aplica el layout del PRESET ACTUAL (no el
  // genérico V2 default). Si el operador está en COMPACT, restaurar
  // vuelve a la geometría compact-densa, no a la compartida histórica.
  const handleResetLayout = useCallback(async () => {
    const ok = await confirmDialog.confirm({
      title: "Restaurar diseño",
      description:
        "¿Restaurar el diseño original? Se perderán los cambios "
        + "actuales del layout.",
      confirmLabel: "Restaurar",
      cancelLabel: "Cancelar",
      tone: "warning",
    });
    if (!ok) return;
    const currentPreset = invoiceViewPreset.preset ?? "COMPACT";
    const presetLayout = getDefaultLayoutForPreset(currentPreset);
    invoiceLayout.setLayoutV2(presetLayout);
  }, [invoiceLayout, invoiceViewPreset.preset, confirmDialog]);

  // F2 — Cambio de preset: el handler envuelve `invoiceViewPreset.setPreset`
  // para QUE ADEMÁS aplique el layout V2 correspondiente al nuevo preset.
  // Esto hace que la diferencia entre los presets sea visualmente
  // inmediata (no solo cambio de layoutMode CSS).
  //
  // Detección de customización: si el layout actual difiere del default
  // del preset actual (el operador hizo drag/resize), preguntamos antes
  // de pisar sus cambios. Si está alineado con el default → aplicamos
  // directo sin molestar.
  const handlePresetChange = useCallback((nextPreset: InvoiceViewPreset) => {
    // UX: click directo aplica la plantilla inmediatamente — sin modal
    // de confirmacion intermedio aunque el operador haya hecho
    // personalizaciones manuales. La detencion de customizaciones y el
    // confirm previo se removieron por feedback explicito de producto
    // (rompian el flujo y agregaban un paso innecesario).
    invoiceViewPreset.setPreset(nextPreset);
    invoiceLayout.setLayoutV2(getDefaultLayoutForPreset(nextPreset));
  }, [invoiceViewPreset, invoiceLayout]);

  // Wrapper de `invoiceUiPreferences.update` que, cuando el patch toca
  // `visibleCards`, ademas COMPACTA el layout V2 cerrando los huecos que
  // dejan las cards ocultadas. Las cards recien mostradas se reinsertan
  // al final del stack visible para que no choquen con la geometria
  // actual. Persiste el layout nuevo via `setLayoutV2` (que sigue el
  // mismo debounce de toda la persistencia de layout).
  const handleUiPatch = useCallback(
    (patch:
      | Partial<{ visibleCards: Partial<{
          accountImpact: boolean; discount: boolean; shipping: boolean;
          coupon: boolean; totals: boolean; payments: boolean; observations: boolean;
        }> }>
    ) => {
      const patchVc = patch.visibleCards;
      if (!patchVc) {
        invoiceUiPreferences.update(patch);
        return;
      }
      // Computar set ANTES y DESPUES.
      const prev = invoiceUiPreferences.resolved.visibleCards;
      const next = { ...prev, ...patchVc };
      invoiceUiPreferences.update(patch);

      // Detectar ids recien mostradas (false -> true).
      const newlyShown = new Set<CardId>();
      const VC_KEY_TO_ID: Record<string, CardId> = {
        discount: "discount", shipping: "shipping", coupon: "coupon",
        totals: "totals", payments: "payments", observations: "observations",
        accountImpact: "account-impact",
      };
      for (const [k, v] of Object.entries(patchVc)) {
        if (v === true && (prev as any)[k] === false) {
          const id = VC_KEY_TO_ID[k];
          if (id) newlyShown.add(id);
        }
      }

      // Construir set de visibles siguiente y compactar.
      const visibleSet = new Set<CardId>();
      for (const [k, v] of Object.entries(next)) {
        if (v && VC_KEY_TO_ID[k]) visibleSet.add(VC_KEY_TO_ID[k]);
      }
      const compacted = compactLayoutByVisibility(
        invoiceLayout.layoutV2,
        visibleSet,
        newlyShown,
      );
      invoiceLayout.setLayoutV2(compacted);
    },
    [invoiceUiPreferences, invoiceLayout],
  );

  // Container ref del aside — usada por `ResizeHandle` para medir
  // `clientWidth` y calcular la fracción de drag horizontal. Se asigna en
  // el JSX más abajo. En modo lectura el ref existe pero nadie lo consulta
  // (el handle solo se renderiza con `editLayoutMode=true`).
  const asideRef = useRef<HTMLElement | null>(null);

  // `handleCardResize` (V1 width-only) removido — Etapa 4 reemplazó el
  // resize discreto V1 por el resize XY 2D del `LayoutGridContext` V2,
  // que opera directamente sobre setLayoutV2 con x/y/w/h en columnas.

  // Id del Receipt persistido (borrador guardado en backend). Habilita
  // adjuntos. Se resetea cuando se abre un comprobante distinto.
  const [savedReceiptId, setSavedReceiptId] = useState<string | null>(null);

  // Tipo favorito del Descuento global (UserPreference). Se hidrata al
  // montar el modal (lectura fresca de `userPreferencesApi.get()`) y se
  // persiste cuando el operador toca la estrella en el combo Tipo del card.
  // Cero afectación a facturas existentes — solo precarga el default de
  // nuevas (`openNew()` ya aplica `resolveDefaultGlobalDiscountType`).
  const [favoriteDiscountType, setFavoriteDiscountType] = useState<"PERCENT" | "AMOUNT" | null>(null);
  // T15 — Cache vivo del UserPreference completo del usuario para que
  // `handleClientPick` pueda resolver la cadena de fallback (UserPref →
  // favorito → primera activa) cuando el cliente nuevo NO tiene priceListId.
  // Antes el frontend mantenía la lista del cliente anterior (bug) porque
  // `buildClientPatches` solo emitía priceListId si el cliente lo traía
  // explícitamente.
  const userPreferenceRef = useRef<SalesUserPreference | null>(null);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    userPreferencesApi.get()
      .then((pref) => {
        if (!cancelled) {
          setFavoriteDiscountType(pref?.defaultGlobalDiscountType ?? null);
          userPreferenceRef.current = pref;
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open]);
  async function handleSetFavoriteDiscountType(type: "PERCENT" | "AMOUNT") {
    // Optimismo de UI: setear local antes del round-trip → la estrella
    // cambia al instante. Si el update falla, no revertimos (el próximo
    // open reconciliaría con el servidor).
    setFavoriteDiscountType(type);
    try {
      await userPreferencesApi.update({ defaultGlobalDiscountType: type });
    } catch {
      // Silencioso — preferencia es UI-only, no bloquea el flujo.
    }
  }
  // Dedupe de guardado en vuelo: evita crear 2 borradores si el usuario
  // dispara guardado manual y auto-guardado por adjunto casi simultáneos.
  const ensureReceiptPromiseRef = useRef<Promise<string | null> | null>(null);
  useEffect(() => {
    setSavedReceiptId(null);
    ensureReceiptPromiseRef.current = null;
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
  // Etapa A.5 — card "Impacto en cuenta corriente" reintroducida con datos
  // reales del preview (sin balanceBefore mock). Reutiliza la lsKey histórica
  // para preservar la preferencia de expansión de usuarios existentes.
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

  // Cliente usado SOLO para cotizar/preview. Cuando el operador elige
  // "Mantener precios actuales", el documento adopta el cliente nuevo pero el
  // motor sigue cotizando con el cliente PREVIO (precios/impuestos/bonif.
  // congelados) hasta que se pida "Recalcular".
  //   · `undefined` → passthrough: cotizar con `draft.clientId` (normal).
  //   · `string`    → forzar ese clientId al cotizar (cliente previo).
  //   · `null`      → forzar SIN cliente (cuando no había cliente previo).
  const [previewClientId, setPreviewClientId] =
    useState<string | null | undefined>(undefined);

  // Draft que se usa SOLO para cotizar (signature + executePreview). Difiere
  // de `draft` únicamente en el `clientId` cuando el operador eligió
  // "Mantener precios actuales": el documento ya adoptó el cliente nuevo,
  // pero el motor sigue cotizando con el cliente previo (precios congelados).
  // El resto de inputs de pricing (lista/moneda/fx/descuento) no se aplican
  // en ese caso, así que `draft` ya los conserva. Persistencia y snapshot
  // usan `draft` (cliente real del documento), nunca este derivado.
  const pricingDraft = useMemo<SalesInvoice>(
    () =>
      previewClientId === undefined
        ? draft
        : { ...draft, clientId: previewClientId ?? undefined },
    [draft, previewClientId],
  );

  /** Firma reproducible de los inputs que afectan el cálculo. */
  const previewSignature = useMemo<string | null>(() => {
    const { hasRealLines, payload } = buildSalePreviewPayload(pricingDraft, documentCurrencyId);
    if (!hasRealLines) return null;
    // `draft.fxRate` se incluye en la firma (aunque el payload no lo lleve)
    // para que cambiar la cotización manual dispare un re-preview. El
    // backend hoy no procesa `fxRate` directamente — convierte usando la
    // cotización vigente del catálogo para `currencyId` —, pero igual es
    // útil porque mantiene la firma sincronizada con el estado visible y
    // deja la puerta abierta a Fase MM cuando el backend acepte `fxRate`.
    //
    // `_policyVersion` se incluye para que, cuando el operador cambie la
    // política comercial del tenant (toggles de "Considerar crítico..."),
    // la firma cambie y usePreviewFlow vuelva a llamar al backend. La
    // política NO se envía en el payload — el motor la lee de Jewelry
    // directamente — pero sin bumpear la firma la caché serviría datos
    // stale.
    return JSON.stringify({ ...payload, _fxRate: draft.fxRate, _policyVersion: policyVersion });
    // `pricingDraft` cambia de identidad ante cualquier cambio de `draft` o
    // de `previewClientId`, así que cubre lines/clientId/channel/coupon/
    // shipping/discountGlobal/priceListId. `documentCurrencyId` y `fxRate`
    // van aparte (no son campos directos del payload).
  }, [pricingDraft, documentCurrencyId, draft.fxRate, policyVersion]);

  // FASE 8.2.4b — hook reutilizable de preview flow.
  // Encapsula: debounce 200ms + anti-stale via `previewReqIdRef` (compartido
  // con handleClientPick / handleLineArticlePick) + status machine + cache.
  const { status: previewStatus, cached: backendPreview } =
    usePreviewFlow<SalePreviewResult>({
      signature: previewSignature,
      enabled:   open,
      requestIdRef: previewReqIdRef,
      executePreview: async () => {
        const { payload } = buildSalePreviewPayload(pricingDraft, documentCurrencyId);
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
      // Manual Adjustment Etapa 1 — `finalTotal` lo emite el service del
      // backend como engineTotal + ajuste manual. Si no hay ajuste,
      // finalTotal === dt.total → comportamiento idéntico al previo.
      // El hero del card SIEMPRE refleja "lo que cobra el cliente"
      // (POLICY §R-Rounding-7 invariante visual === backend).
      const finalTotal = (backendPreview.result as any).finalTotal;
      const totalToUse = typeof finalTotal === "number" && Number.isFinite(finalTotal)
        ? finalTotal
        : dt.total;
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
        total:          totalToUse,
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

  // ── Fase A — política comercial ──────────────────────────────────────
  // Derivamos el nivel por línea (OK/WARNING/RISK/CRITICAL) directamente
  // desde `matchedNormalized` (que ya trae `alerts[]` + `policy` del
  // motor). El array `commercialLevels` queda paralelo a `draft.lines`
  // para que la UI pueda pintar el borde lateral por fila.
  //
  // CERO matemática: solo lectura de los códigos que emitió el engine.
  // Si el preview todavía no está disponible (signature stale, error,
  // etc.), todos los niveles caen a "OK" y la UI no muestra nada.
  const commercialLevels = useMemo(() => {
    return matchedNormalized.map((line) => deriveCommercialLevel(line));
  }, [matchedNormalized]);

  // Mapa `lineId → nivel` para que el editor avanzado pinte el borde
  // lateral por fila. Solo agregamos niveles ≠ OK al mapa — las líneas
  // OK no necesitan entry (default = sin borde).
  const commercialLevelByLineId = useMemo(() => {
    const out: Record<string, "WARNING" | "RISK" | "CRITICAL"> = {};
    draft.lines.forEach((line, idx) => {
      const level = commercialLevels[idx];
      if (level && level !== "OK") {
        out[line.id] = level;
      }
    });
    return out;
  }, [draft.lines, commercialLevels]);

  // Refinamiento Fase A — mapa enriquecido `lineId → CommercialInfo`
  // (motivo, margen %, código primario). El chip al pie de cada fila lo
  // consume para mostrar texto comercial accionable. Solo entradas
  // ≠ OK; cero matemática (todo passthrough del preview backend).
  const commercialInfoByLineId = useMemo(() => {
    const out: Record<string, CommercialInfo> = {};
    draft.lines.forEach((line, idx) => {
      const info = deriveCommercialInfo(matchedNormalized[idx], {
        recommendedMarginPercent,
      });
      if (info.level !== "OK") {
        out[line.id] = info;
      }
    });
    return out;
  }, [draft.lines, matchedNormalized, recommendedMarginPercent]);

  // Resumen consolidado del comprobante. La UI lo usa para mostrar el
  // badge global en el header del modal y para decidir si el modal de
  // confirmación reforzada debe abrirse al hacer "Crear".
  const documentCommercialStatus = useMemo(() => {
    return aggregateDocumentStatus(matchedNormalized);
  }, [matchedNormalized]);

  // Modal de confirmación reforzada (se abre solo cuando hay líneas
  // CRITICAL y el operador toca "Crear"). Un override aceptado en esta
  // sesión deja al operador confirmar sin volver a preguntar mientras
  // el modal esté abierto — si edita y cambian las líneas, el flag se
  // resetea (ver dependency).
  const [commercialModalOpen, setCommercialModalOpen] = useState(false);
  const [commercialOverrideAccepted, setCommercialOverrideAccepted] = useState(false);
  useEffect(() => {
    // Si el set de líneas críticas cambia, invalidamos el override
    // previo — el operador debe re-confirmar el riesgo del nuevo estado.
    setCommercialOverrideAccepted(false);
  }, [documentCommercialStatus.critical]);

  // Gate sobre `onSave`: si hay críticas y no hay override aceptado,
  // abrimos el modal de confirmación reforzada en vez de delegar al
  // save real. NO bloquea — el operador puede confirmar igualmente.
  const handleConfirmedSave = useCallback(() => {
    const hasCritical = documentCommercialStatus.critical > 0;
    if (hasCritical && !commercialOverrideAccepted) {
      setCommercialModalOpen(true);
      return;
    }
    onSave();
  }, [documentCommercialStatus.critical, commercialOverrideAccepted, onSave]);

  // Confirmación del modal de riesgo: marca el override y dispara save.
  const acceptCommercialRisk = useCallback(() => {
    setCommercialOverrideAccepted(true);
    setCommercialModalOpen(false);
    onSave();
  }, [onSave]);

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

  /**
   * Trazabilidad de auditoría por componente del footer (Origen · Base ×
   * regla · Impacto). Passthrough puro del preview + draft — `buildComponentTraces`
   * solo PROYECTA datos ya emitidos por el backend a la estructura `ComponentTrace`
   * (las únicas operaciones son de display: ya hay precedente con el % efectivo
   * de IVA/descuento). Cuando un dato literal no existe todavía en backend, el
   * trace queda `PARTIAL` y declara el campo faltante. Solo se computa cuando la
   * firma del backend matchea el draft (sino los amounts no son confiables).
   */
  const componentTraces = useMemo(() => {
    if (!backendPreview || backendPreview.signature !== previewSignature) return undefined;
    const r  = backendPreview.result as any;
    const dt = r?.documentTotals;
    if (!dt) return undefined;
    return buildComponentTraces({
      couponResult:          r.couponResult ?? null,
      channelResult:         r.channelResult ?? null,
      taxAmount:             dt.taxAmount ?? null,
      taxableBase:           dt.taxableBase ?? null,
      subtotalCommercial:    dt.subtotalAfterLineDiscounts ?? null,
      lines:                 r.lines ?? [],
      shippingAmount:        dt.shippingAmount ?? null,
      shippingDraft: draft.shipping
        ? {
            mode:       (draft.shipping as any).mode ?? null,
            value:      (draft.shipping as any).value ?? (draft.shipping as any).cost ?? null,
            methodName: (draft.shipping as any).methodName ?? (draft.shipping as any).label ?? null,
          }
        : null,
      globalDiscountAmount:  dt.globalDiscountAmount ?? null,
      draftDiscountGlobal: draft.discountGlobal
        ? { type: draft.discountGlobal.type, value: draft.discountGlobal.value, reason: draft.discountGlobal.reason ?? null }
        : null,
      clientCommercialRules: r.clientCommercialRules ?? null,
      documentRounding:      r.documentRoundingSnapshot ?? dt.documentRoundingApplied ?? null,
      manualAdjustment:      r.manualAdjustmentSnapshot ?? r.manualAdjustment ?? null,
    });
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
   * No dispara efectos colaterales (stock, cuenta corriente). La lógica pura
   * (filtro de líneas + assembly del payload + snapshot) vive en
   * `src/lib/sales/buildReceiptDraftPayload.ts` con tests unitarios.
   *
   * Idempotente: garantiza un Receipt persistido y devuelve su id.
   *   · Si ya hay `savedReceiptId` → lo devuelve sin re-crear (no duplica).
   *   · Si hay un guardado en vuelo → reusa esa promesa (dedupe).
   *   · Si no → arma el payload con el flujo existente y crea el borrador.
   * Devuelve `null` (con toast) si no se pudo (sin líneas / error backend).
   * No recalcula nada: el payload sale de `buildReceiptDraftPayload`.
   */
  async function ensureSavedReceiptId(): Promise<string | null> {
    if (savedReceiptId) return savedReceiptId;
    if (ensureReceiptPromiseRef.current) return ensureReceiptPromiseRef.current;

    const built = buildReceiptDraftPayload({
      draft,
      currencies,
      predicates: { isEmptyLine, isHeaderLine },
    });
    if (!built.ok) {
      toast.error("Agregá al menos una línea para guardar el borrador.");
      return null;
    }

    const p = (async (): Promise<string | null> => {
      setDraftSaving(true);
      try {
        const saved = await receiptsApi.createDraft(built.payload);
        setSavedReceiptId(saved.id);
        toast.success(`Borrador guardado (id ${saved.id.slice(0, 8)}…).`);
        return saved.id;
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "No se pudo guardar el borrador.");
        return null;
      } finally {
        setDraftSaving(false);
        ensureReceiptPromiseRef.current = null;
      }
    })();
    ensureReceiptPromiseRef.current = p;
    return p;
  }

  /**
   * FASE 8.2.5c — Orchestrator de `saveDraftToBackend`.
   *
   * Cadena de persistencia del botón "Guardar borrador":
   *
   *   1. `persistDraftAsBackendDraft()` ⇒ `POST /api/sales` o `PUT /api/sales/:id`
   *      Persiste la `Sale` REAL con todas sus líneas, sus overrides comerciales,
   *      `priceListId` doc-level (C16), `channelId`, `couponCode`, `paymentMethodId`,
   *      `paymentInstallments`, `shippingAmount`, `globalDiscount*`,
   *      `balanceModeOverride`, `manualAdjustmentInput`. Actualiza
   *      `persistedSaleId` y rehidrata el draft con la respuesta vía
   *      `applySaleResponseToDraft`. Si falla, la propia función dispara el
   *      toast de error y devuelve `null` ⇒ abortamos antes del Receipt.
   *
   *   2. `ensureSavedReceiptId()` ⇒ `POST /api/receipts` (status=DRAFT).
   *      Crea el `Receipt` placeholder que la UI usa para adjuntar archivos
   *      (PDFs/notas) sin esperar al confirm. Es idempotente: si ya hay
   *      `savedReceiptId`, lo reusa. Dispara el toast de éxito visible al
   *      operador ("Borrador guardado").
   *
   * Razón del orden: si la `Sale` falla (precio/cliente/validación backend),
   * no tiene sentido crear el Receipt placeholder. Si la `Sale` tiene éxito
   * pero el Receipt falla, la `Sale` queda persistida y un segundo intento
   * de "Guardar borrador" reutiliza `persistedSaleId` para hacer `update`
   * (no duplica) y reintenta el Receipt.
   *
   * Audit C16.4 — Pre-fix: el botón saltaba directo al Receipt y la Sale
   * nunca se persistía, por eso al reabrir aparecía "Lista Unificada" y
   * los totales divergían del pre-save.
   */
  async function saveDraftToBackend() {
    if (draftSaving) return;
    setDraftSaving(true);
    try {
      // PRIMERA llamada: persistir la `Sale` real con el flujo `salesApi.create`
      // o `salesApi.update`. La función vive en el componente padre
      // (`VentasFacturas`) y se inyecta como prop `onPersistSale`. Si falla
      // (validación 400, red, etc.), la propia función dispara el toast.error
      // y devuelve `null`; abortamos antes de crear el Receipt para no dejar
      // un placeholder huérfano sin Sale subyacente.
      const saved = await onPersistSale();
      if (!saved) return;
      // SEGUNDA llamada: idempotente — crea el `Receipt` placeholder solo si
      // todavía no existe uno (`savedReceiptId` null). Mantiene los adjuntos
      // y PDFs funcionando sin cambios.
      await ensureSavedReceiptId();
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

  /** Parte 2.2 — Guarda subject/message del modal de envio como plantilla
   *  de email tenant-wide (DocumentTemplate.emailSubject/MessageTemplate).
   *  El operador puede escribir variables `{{cliente}}`, `{{numero}}`,
   *  `{{joyeria}}`, `{{estado}}`, `{{fecha}}` que se interpolan al abrir
   *  el modal en futuras facturas. */
  async function handleSaveEmailTemplateDefaults(payload: { subjectTemplate: string; messageTemplate: string }): Promise<void> {
    try {
      const updated = await documentTemplatesApi.save("FACTURA", {
        emailSubjectTemplate: payload.subjectTemplate,
        emailMessageTemplate: payload.messageTemplate,
      });
      // Refrescar el template en memoria para que el proximo "abrir mail"
      // ya use la version persistida sin hacer GET.
      setPrintTemplate(updated);
      toast.success("Plantilla de email guardada como predeterminada.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la plantilla.");
      throw e;   // re-throw para que el modal libere el loading del boton
    }
  }

  // ── Acciones del documento: imprimir / etiquetas / email ─────────────────
  const [labelsOpen, setLabelsOpen]   = useState(false);
  // 1.E parte 2 — Modal "Enviar por mail" (state + flag de envio en curso).
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailSending,   setEmailSending]   = useState(false);

  // ── Bug fix — id REAL del Sale persistido en backend ────────────────────
  // Diferenciamos `draft.id` (UUID local generado por `openNew`) del id
  // real que devuelve `salesApi.create()`. Sin esto, los endpoints
  // documentales (`/sales/:id/pdf`, `/sales/:id/send-email`) responden
  // 404 porque el UUID local no existe en backend.
  //
  // El state vive en este componente (no en el padre) porque (a) los
  // handlers que lo consumen estan aca, (b) al cerrar el modal el padre
  // hace `setDraft(null)` → el componente entero se desmonta → state se
  // borra automaticamente, sin reset explicito.
  //
  // Idempotencia: `ensureSalePromiseRef` dedupa creates concurrentes
  // (operador hace doble click rapido) → 1 sola creacion por factura.
  const [savedSaleId, setSavedSaleId]         = useState<string | null>(null);
  const [savingSaleDraft, setSavingSaleDraft] = useState(false);
  const ensureSalePromiseRef = useRef<Promise<string | null> | null>(null);

  /** Garantiza un Sale persistido en backend y devuelve su id.
   *   · Si ya hay `savedSaleId` → lo devuelve (no duplica).
   *   · Si hay un create en vuelo → reusa esa promesa (dedupe — evita
   *     que doble click cree 2 Sales).
   *   · Si no → arma el payload con `buildSaleCreatePayload` y crea el
   *     Sale en estado DRAFT via `salesApi.create()`.
   *  Devuelve `null` (con toast) si no se pudo (sin lineas / error backend).
   *  No recalcula nada — el payload sale del builder puro. */
  async function ensurePersistedSaleDraft(): Promise<string | null> {
    if (savedSaleId) return savedSaleId;
    if (ensureSalePromiseRef.current) return ensureSalePromiseRef.current;

    const built = buildSaleCreatePayload(draft);
    if (!built.hasRealLines) {
      toast.error("Agregá al menos una línea para guardar el borrador.");
      return null;
    }

    const p = (async (): Promise<string | null> => {
      setSavingSaleDraft(true);
      toast.info("Guardando borrador…");
      try {
        const saved = await salesApi.create(built.payload);
        setSavedSaleId(saved.id);
        return saved.id;
      } catch (e: unknown) {
        const err = e as { message?: string; data?: { message?: string } };
        toast.error(err?.data?.message || err?.message || "No se pudo guardar el borrador.");
        return null;
      } finally {
        setSavingSaleDraft(false);
        ensureSalePromiseRef.current = null;
      }
    })();
    ensureSalePromiseRef.current = p;
    return p;
  }
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

  /** Imprime el comprobante usando la PLANTILLA configurada en
   *  "Configuración del sistema → Documentos → Plantilla: Factura".
   *
   *  Flujo:
   *   1. Toma el `<SaleInvoicePrintable>` montado oculto en el modal — éste
   *      ya consume `printTemplate` + `printCompany` + datos REALES del
   *      draft (líneas, totales, cliente, moneda, observaciones, status).
   *   2. Copia el INNER HTML del printable a un popup independiente con
   *      `@page` setup desde el template (tamaño + márgenes) y dispara
   *      `window.print()` cuando todo (incluido el logo si existe) cargo.
   *
   *  Fix bug "popup vacio" — usamos `node.innerHTML` (NO `outerHTML`)
   *  porque el wrapper externo del printable tiene `position: fixed;
   *  left: -100000px; top: -100000px` (para esconderlo del viewport
   *  del modal). Si copiabamos el wrapper, esas inline styles viajaban
   *  al popup y dejaban el contenido posicionado fuera del area
   *  visible → about:blank visual + print dialog en pagina en blanco.
   *
   *  Si el popup queda bloqueado por el browser, fallback al
   *  `window.print()` del documento actual. */
  const printableRef = useRef<HTMLDivElement>(null);
  function handlePrintDocument() {
    if (typeof window === "undefined") return;
    const node = printableRef.current;
    if (!node || !node.innerHTML) {
      // Fallback al print del modal entero si no hubo render del printable.
      window.print();
      return;
    }
    const w = window.innerWidth >= 800 ? 800 : window.innerWidth;
    const h = window.innerHeight >= 600 ? 900 : window.innerHeight;
    const popup = window.open("", "tptech-invoice-print", `width=${w},height=${h}`);
    if (!popup) {
      // Popup bloqueado — fallback al print directo del modal.
      window.print();
      return;
    }
    const pageRule = `@page { size: ${printTemplate.pageWidthMm}mm ${printTemplate.pageHeightMm}mm; margin: 0; }`;
    // Title del popup state-aware (lo usa el browser al guardar como PDF).
    const docTitle = (draft.status === "DRAFT" ? "Borrador" : "Factura") + " " + (draft.number || "");
    popup.document.open();
    popup.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${docTitle}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { background: #fff; }
    ${pageRule}
    @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
<div style="width: ${printTemplate.pageWidthMm}mm; margin: 0 auto;">${node.innerHTML}</div>
<script>
(function() {
  function go() { try { window.focus(); window.print(); } catch (e) {} }
  function waitImages() {
    var imgs = document.images;
    if (!imgs || imgs.length === 0) { return Promise.resolve(); }
    var pending = [];
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (img.complete && img.naturalWidth > 0) continue;
      pending.push(new Promise(function (resolve) {
        img.addEventListener("load",  resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      }));
    }
    return Promise.all(pending);
  }
  function start() { waitImages().then(function() { setTimeout(go, 50); }); }
  // document.write puede ejecutar este script ANTES o DESPUES de que
  // window.onload haya disparado. Cubrimos ambos casos:
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
})();
</script>
</body>
</html>`);
    popup.document.close();
  }

  /** C5-fix Opcion A — Arma el request para el endpoint render-only.
   *  Reusa EXACTAMENTE las mismas props que se pasan al
   *  `<SaleInvoicePrintable>` en el render de impresion (linea 6399
   *  aprox). Si esto se desincroniza con aquello, Imprimir ≠
   *  Descargar/Mail → bug de paridad. */
  function buildDraftPdfRequest(): SaleDraftPdfRequest {
    const docKey = draft.number || "VTA";
    const filenameBase =
      draft.status === "DRAFT"       ? `Borrador-${docKey}.pdf`
      : draft.status === "CANCELLED" ? `Factura-ANULADA-${docKey}.pdf`
      : `Factura-${docKey}.pdf`;

    return {
      printable: {
        config:         printTemplate,
        company:        printCompany,
        documentNumber: draft.number || "",
        documentDate:   draft.date || "",
        clientName:     draft.clientSnapshot?.name || draft.client || "",
        clientTaxId:    draft.clientSnapshot?.documentNumber
          ? `${draft.clientSnapshot.documentType || "Doc"}: ${draft.clientSnapshot.documentNumber}`
          : undefined,
        clientAddress:  draft.clientSnapshot?.address,
        lines:          draft.lines as unknown as SaleDraftPdfRequest["printable"]["lines"],
        totals: {
          subtotal:       effectiveTotals.subtotal,
          discountAmount: effectiveTotals.discountAmount ?? 0,
          taxAmount:      effectiveTotals.taxAmount,
          total:          effectiveTotals.total,
        },
        currencyCode:    currencyDisplay,
        fxRate:          typeof draft.fxRate === "number" ? draft.fxRate : 1,
        notes:           draft.notes,
        terms:           draft.terms,
        sellerName:      undefined,
        warehouseName:   whLabel !== "Sin almacén" ? whLabel : undefined,
        paymentTermName: draft.paymentTerm || undefined,
        status:          draft.status,
      },
      page: {
        widthMm:     printTemplate.pageWidthMm,
        heightMm:    printTemplate.pageHeightMm,
        orientation: printTemplate.orientation === "landscape" ? "landscape" : "portrait",
      },
      filename: filenameBase,
    };
  }

  /** Descarga el PDF server-side. Disponible en cualquier estado tras el
   *  pivot funcional — el sello visual (BORRADOR/ANULADA) lo dibuja el
   *  componente `<SaleInvoicePrintable>` shared segun status.
   *
   *  C5-fix Opcion A — No requiere persistir el Sale. El backend
   *  renderea exactamente las props que mandamos (las mismas del
   *  print). Edits en el draft se ven inmediatamente. */
  async function handleDownloadOfficialPdf(): Promise<void> {
    try {
      const req = buildDraftPdfRequest();
      const { blob, filename } = await salesDraftPdfApi.downloadFromDraft(req);
      const { saveAs } = await import("file-saver");
      saveAs(blob, filename);
      toast.success("PDF descargado.");
    } catch (e: unknown) {
      const err = e as { message?: string; data?: { code?: string; message?: string } };
      const msg = err?.data?.message || err?.message || "Error al descargar el PDF.";
      toast.error(msg);
    }
  }

  /** Envia la factura por mail con el PDF adjunto.
   *
   *  C5-fix Opcion A — Mismo helper que el download: backend renderea
   *  el draft tal cual lo recibe y adjunta el mismo buffer. Garantiza
   *  que el adjunto == archivo descargado.
   *
   *  E2 — Antes de enviar, persistimos el draft via
   *  `ensurePersistedSaleDraft()` para obtener un `saleId` real. El
   *  backend ahora rechaza envíos sin `saleId` (emails huérfanos
   *  rompen el historial documental). Si el draft no se puede
   *  persistir (sin líneas, etc.), abortamos con el toast que ya
   *  emite el helper. */
  async function handleEmailSubmit(payload: { to: string; subject: string; message: string }): Promise<void> {
    setEmailSending(true);
    try {
      const saleId = await ensurePersistedSaleDraft();
      if (!saleId) return;   // ensurePersistedSaleDraft ya mostró el toast.
      const req = buildDraftPdfRequest();
      const out = await salesDraftPdfApi.sendDraftByEmail({ ...req, ...payload, saleId });
      toast.success(out?.message || "Factura enviada correctamente.");
      setEmailModalOpen(false);
    } catch (e: unknown) {
      const err = e as { message?: string; data?: { code?: string; message?: string } };
      const msg = err?.data?.message || err?.message || "Error al enviar la factura.";
      toast.error(msg);
      // No cerramos el modal — el operador puede corregir y reintentar.
    } finally {
      setEmailSending(false);
    }
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

  // Selector rápido de impuestos por línea (UX) — impuestos del tenant con tasa
  // porcentual, aplicables a venta y activos. Elegir uno autocompleta el
  // `taxOverride` (PERCENT) de la línea. No suma ni combina: un único override.
  const availableLineTaxes = useMemo(
    () =>
      salesTaxes
        .filter((t) => t.isActive && t.appliesOnSale && t.rate != null && Number(t.rate) > 0)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((t) => ({ id: t.id, name: t.name, rate: Number(t.rate) })),
    [salesTaxes],
  );

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
    // Caso ideal: hay un preview convertido por el backend en cache. Sus
    // amounts (y por ende el draft hidratado por `applySalePreviewToDraft`)
    // YA están en la moneda del documento. NO se exige que la firma coincida
    // con la actual: mientras el cache convertido siga vigente, los campos
    // monetarios del draft están en moneda del documento, así que `mFmt`
    // (÷ displayRate) NO debe re-dividir. Exigir `signature === previewSignature`
    // hacía que, durante el thrash de un cambio de cliente / preview en
    // vuelo, `displayRate` cayera al fxRate legacy y se dividiera DOS veces
    // (ej: bonificación fija 50,01 → 0,03). El backend es la única fuente:
    // si el próximo preview vuelve en base, `currencyConverted` será false y
    // recién ahí reescalamos. Cubre bonificación, impuestos y todo label
    // que pase por `mFmt` (auditoría de doble conversión).
    if (backendPreview && backendPreview.result.currencyConverted === true) {
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
  }, [backendPreview, currencies, draft.currency, draft.fxRate]);

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
    // `kind` opcional (default BONUS): "BONUS" resta, "SURCHARGE" suma.
    // El motor backend aplica; frontend no calcula.
    manualDiscount?:        { mode: "PERCENT" | "AMOUNT"; value: number; appliesTo?: AppliesToScope; kind?: "BONUS" | "SURCHARGE" } | null;
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
   *
   * IMPORTANTE: el `kind` (BONUS/SURCHARGE) cuenta como parte de la
   * identidad del override de descuento. Si el operador cambia solo el
   * tipo (Bonificación ⇄ Recargo) sin tocar value/mode/appliesTo, el
   * patch debe procesarse: el motor recalcula precio (suma vs resta) y
   * el `previewSignature` debe cambiar para disparar `salesApi.preview`.
   * Sin incluir `kind` aquí, el guard descartaba el patch como "igual" y
   * la UI se quedaba sin recalcular (label/optimistic cambiaban, pero el
   * unitPrice/total no).
   */
  function sameTypedOverride(
    a: { mode: "PERCENT" | "AMOUNT"; value: number; appliesTo?: AppliesToScope; kind?: "BONUS" | "SURCHARGE" } | null | undefined,
    b: { mode: "PERCENT" | "AMOUNT"; value: number; appliesTo?: AppliesToScope; kind?: "BONUS" | "SURCHARGE" } | null | undefined,
  ): boolean {
    if (a === b) return true;
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    return (
      a.mode === b.mode &&
      a.value === b.value &&
      (a.appliesTo ?? "TOTAL") === (b.appliesTo ?? "TOTAL") &&
      // `kind` solo aplica al descuento. En taxOverride el caller no lo
      // setea → ambos lados quedan undefined y la comparación pasa OK.
      ((a as any).kind ?? "BONUS") === ((b as any).kind ?? "BONUS")
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
    // Combo: propagamos la config del ajuste del combo al `pricingMeta` para que
    // la composición lo muestre. Display only — el preview backend (que spreadea
    // `...line.pricingMeta`) lo preserva; no afecta cálculo ni snapshot.
    if (item.commercialMode === "COMBO_COMMERCIAL") {
      (meta as any).comboAdjustmentKind  = item.comboAdjustmentKind  ?? null;
      (meta as any).comboAdjustmentValue = item.comboAdjustmentValue ?? null;
    }
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
   * Búsqueda server-side de clientes para el combo de cliente (Etapa 1 perf).
   * Reemplaza el filtrado en memoria sobre el bloque inicial: al tipear, pega
   * contra `commercialEntitiesApi.list` con `q` (debounce 200ms + anti-stale,
   * mismo patrón que `searchArticles`). Así los clientes fuera del primer
   * bloque también aparecen al buscar. NO toca pricing ni snapshots.
   */
  const clientSearchTimerRef = useRef<number | null>(null);
  const clientSearchReqIdRef = useRef(0);
  useEffect(
    () => () => {
      if (clientSearchTimerRef.current != null) {
        window.clearTimeout(clientSearchTimerRef.current);
      }
    },
    [],
  );
  const searchClients = useCallback((query: string) => {
    if (clientSearchTimerRef.current != null) {
      window.clearTimeout(clientSearchTimerRef.current);
    }
    const term = query.trim();
    clientSearchTimerRef.current = window.setTimeout(() => {
      const reqId = ++clientSearchReqIdRef.current;
      setClientsLoading(true);
      commercialEntitiesApi
        .list({ role: "client", q: term || undefined, take: 50, sortKey: "displayName", sortDir: "asc" })
        .then((resp) => {
          if (reqId !== clientSearchReqIdRef.current) return; // anti-stale
          setClientOptions(resp.rows.map(entityRowToLite));
        })
        .catch(() => {
          // Error puntual de búsqueda: conservamos las opciones previas.
        })
        .finally(() => {
          if (reqId !== clientSearchReqIdRef.current) return;
          setClientsLoading(false);
        });
    }, 200);
  }, []);

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
  // `clientDataPatch`  → identidad/snapshot/vendedor/término/vencimiento.
  //                       SIEMPRE se aplica (no afecta pricing).
  // `pricingPatch`     → lista, moneda, fx (lo que mueve el `previewSignature`).
  //                       Solo se aplica si el operador elige "Recalcular".
  const [recalcPrompt, setRecalcPrompt] = useState<{
    open: boolean;
    nextClient: TPEntityLite | null;
    clientDataPatch: Partial<SalesInvoice>;
    pricingPatch: Partial<SalesInvoice>;
    fxWarning: string | null;
  }>({
    open: false,
    nextClient: null,
    clientDataPatch: {},
    pricingPatch: {},
    fxWarning: null,
  });

  // Detalle del cliente nuevo resuelto async mientras el modal sigue abierto.
  // No se aplica al draft hasta que el operador decide (keep / recalc).
  const pendingClientDetailRef = useRef<{
    reqId: number;
    clientId: string;
    detail: EntityDetail;
    fullSnap: ClientSnapshot;
    inheritedDG: DocumentDiscountGlobal | null;
  } | null>(null);
  // Decisión del modal: null = aún sin decidir (modal abierto / sin líneas).
  const clientChoiceRef = useRef<"keep" | "recalc" | null>(null);

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
    // Toda edición desde la DiscountCard es acción del operador → el descuento
    // pasa a ser MANUAL del comprobante y, a partir de acá, SÍ se reenvía al
    // preview (deja de estar suprimido por origin CLIENT).
    const nextDiscount: DocumentDiscountGlobal = { ...current, ...p, origin: "MANUAL" };
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
      // ── Optimistic patch (Etapa A — auditoría VentasFacturas:4823) ─────
      // Al escanear el mismo artículo otra vez, incrementamos qty +1. El
      // backend va a recalcular descuentos por cantidad / promo / cliente
      // con la nueva qty; ese resultado llega ~100-500 ms más tarde via el
      // próximo `usePreviewFlow`.
      //
      // Mientras tanto, marcamos la línea con `pricingMeta.partial = true`
      // (CONTRATO con `selectInvoiceLineView` y el editor: las celdas con
      // partial=true muestran estado "actualizando…" y NO se usan como
      // fuente de verdad para totales). Para que el header de la fila
      // muestre algo coherente mientras viaja el preview, sustituimos
      // `subtotal` / `lineTotal` por una ESTIMACIÓN derivada de qty x precio
      // unitario actual menos descuento actual. NO es un cálculo de
      // pricing (no toca lista, promo, cliente, impuesto, redondeo,
      // composición) — solo escala los valores ya autorizados por el
      // backend por el delta de cantidad.
      //
      // POLICY §R-Rounding-9 / CLAUDE.md frontend: la regla "no recalcular
      // pricing en frontend" se respeta porque (1) el partial=true es la
      // señal explícita de que estos números son temporales, (2) el preview
      // siguiente los pisa byte-a-byte, y (3) NO se persisten — el draft
      // se guarda solo cuando el operador confirma o aprieta guardar, y en
      // ese punto el preview ya respondió.
      //
      // Si en el futuro este patrón causa drift visible (ej. en escaneo de
      // ráfaga), la solución correcta es bajar el debounce del preview, no
      // moverle estos cálculos al backend (sería una llamada extra por tecla).
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
  /**
   * Aplica el detalle async del cliente (snapshot completo + dirección +
   * bonificación heredada) SOBRE el draft más reciente (`draftRef`, no el
   * closure — evita stale state). La bonificación heredada SOLO se aplica
   * cuando la decisión fue "recalc"; en "keep" no se hereda nada nuevo (el
   * motor sigue cotizando con el cliente previo, así que la bonif. vigente
   * es la correcta).
   */
  function applyResolvedClientDetail(
    clientId: string,
    fullSnap: ClientSnapshot,
    inheritedDG: DocumentDiscountGlobal | null,
    choice: "keep" | "recalc",
  ) {
    if (lastPickedClientIdRef.current !== clientId) return;
    const cur = draftRef.current;
    // El documento ya debe ser este cliente (lo aplicó la decisión).
    if (cur.clientId !== clientId) return;
    const curDG = cur.discountGlobal;
    let nextDG: DocumentDiscountGlobal | undefined = curDG;
    if (choice === "recalc" && curDG?.origin !== "MANUAL") {
      if (inheritedDG) {
        nextDG = inheritedDG;
      } else if (curDG?.origin === "CLIENT") {
        nextDG = { type: "PERCENT", value: 0, reason: "", origin: "NONE" };
      }
    }
    onChange({
      ...cur,
      ...(nextDG !== curDG ? { discountGlobal: nextDG } : {}),
      clientSnapshot: { ...cur.clientSnapshot, ...fullSnap },
    });
  }

  function handleClientPick(entity: TPEntityLite | null) {
    if (!entity) {
      lastPickedClientIdRef.current = null;
      setSelectedClient(null);
      setClientDetail(null);
      // Reset del estado de cambio de cliente: sin override de pricing, sin
      // detalle pendiente, sin decisión.
      setPreviewClientId(undefined);
      pendingClientDetailRef.current = null;
      clientChoiceRef.current = null;
      // Si la bonificación vigente era heredada del cliente, al quitar el
      // cliente deja de tener sentido → se limpia. Si era MANUAL, se conserva.
      const dgCleared: Partial<SalesInvoice> =
        draft.discountGlobal?.origin === "CLIENT"
          ? { discountGlobal: { type: "PERCENT", value: 0, reason: "", origin: "NONE" } }
          : {};
      onChange({
        ...draft,
        client: "",
        clientId: undefined,
        clientSnapshot: undefined,
        ...dgCleared,
      });
      return;
    }

    const normalizedEntity = normalizeEntityCurrency(entity, currencies);
    const autoPatch = applyClientToDraft(draft, normalizedEntity);

    // Moneda TARGET del cliente nuevo: su moneda propia SI tiene, o la
    // moneda BASE del sistema si NO tiene. Esto hace que en "Recalcular" la
    // moneda sea autoritativa del cliente nuevo y NO quede pegada la del
    // cliente anterior (ej. USD → cliente sin moneda → debe volver a ARS).
    const baseCurrencyCode =
      currencies.find((c) => c.isBase)?.code ?? "ARS";
    const targetCurrency = autoPatch.currency || baseCurrencyCode;

    // Resolver cotización contra la moneda TARGET (base → fxRate 1). El
    // warning se EMITE recién al recalcular (en "Mantener" no aplica fx
    // nueva → no tiene sentido el aviso).
    const { fxRate: nextFxRate, warning: fxWarning } =
      resolveClientFxRate(targetCurrency, currencies);

    // Canonizar el paymentTerm contra el catálogo PAYMENT_TERM. Si el cliente
    // NO tiene paymentTerm configurado, limpiamos explícitamente el del draft
    // para que no quede el del cliente anterior. El combo cae a "— Sin definir —".
    const rawTerm = autoPatch.paymentTerm ?? normalizedEntity.paymentTerm ?? "";
    const canonicalTerm = canonicalizeTerm(rawTerm);

    const snapshot = buildClientSnapshot(normalizedEntity);
    if (canonicalTerm) snapshot.paymentTerm = canonicalTerm;

    const dueDate = computeDueDateFromTerm({
      canonicalTerm,
      draftDate: draft.date,
      getTermDays,
      addDaysISO,
    });

    // T15 — Resolver el priceListId con cadena de fallback completa cuando
    // el cliente nuevo NO trae uno explícito:
    //   1) `autoPatch.priceListId` (default comercial del cliente).
    //   2) `UserPreference.defaultPriceListId` (preferencia del usuario).
    //   3) Favorito de la joyería (`isFavorite`).
    //   4) Primer activo disponible.
    //
    // Antes (bug): si el paso 1 era null, `buildClientPatches` no emitía
    // `priceListId` en el `pricingPatch` y el merge `{...cur, ...pricingPatch}`
    // conservaba la lista del cliente ANTERIOR (`cur.priceListId`).
    // Ahora siempre emitimos un valor resuelto (o "" si no hay ninguna lista
    // válida en el catálogo). Cero recálculo de precios: solo selección de
    // qué priceListId mandar al motor en el próximo preview.
    const favList = priceLists.find((p) => p.isFavorite && p.isActive && !p.deletedAt);
    const resolvedPriceListId =
      autoPatch.priceListId ||
      resolveDefaultId(
        userPreferenceRef.current?.defaultPriceListId,
        favList?.id,
        priceLists,
      );

    // Split disjunto identidad vs. pricing — fuente única en
    // `buildClientPatches` (pura + testeada). `clientDataPatch` NUNCA mueve
    // el `previewSignature`; `pricingPatch` SOLO lista/moneda/fx.
    const { clientDataPatch, pricingPatch } = buildClientPatches({
      clientId:        entity.id,
      clientName:      entity.name,
      clientSnapshot:  snapshot,
      sellerId:        entity.sellerId ?? "",
      canonicalTerm,
      dueDate,
      // T15 — siempre pasamos el id RESUELTO (puede ser "" si el catálogo
      // no tiene ninguna lista activa). El helper lo emite tal cual en el
      // patch → el merge en "Recalcular" lo aplica sobre `cur.priceListId`,
      // pisando la lista del cliente anterior.
      autoPriceListId: resolvedPriceListId,
      // Target resuelto (propia del cliente o base) → autoritativo en
      // Recalcular; nunca queda la moneda del cliente anterior.
      currency:        targetCurrency,
      fxRate:          nextFxRate,
    });

    const hasRealLines = draft.lines.some(
      (l) => !isEmptyLine(l) && !isHeaderLine(l),
    );

    // Captura local del pick. NO usamos refs/estado compartidos hasta que el
    // operador decida en el modal → abrir o CANCELAR el modal no muta nada
    // visible. `reqId` monotónico invalida fetches superados (otro pick o
    // un aborto incrementan el ref).
    const pickedEntity = entity;
    const reqId = ++clientDetailRequestRef.current;
    pendingClientDetailRef.current = null;
    clientChoiceRef.current = null;

    function buildDetailResult(d: EntityDetail): {
      fullSnap: ClientSnapshot;
      inheritedDG: DocumentDiscountGlobal | null;
    } {
      const lite = entityRowToLite(d as unknown as EntityRow);
      const fullSnap = buildClientSnapshot(lite, d);
      // Preservamos seller del lite original (no viene en EntityDetail).
      fullSnap.seller = snapshot.seller;
      const addr = pickDefaultAddress(d);
      if (addr) {
        fullSnap.address   = composeAddressLine(addr);
        fullSnap.addressId = addr.id;
      }
      const inherited = resolveClientInheritedDiscount(d);
      return { fullSnap, inheritedDG: inherited ?? null };
    }

    if (!hasRealLines) {
      // Sin líneas reales: no hay precios que "mantener" → aplicamos TODO
      // directo (identidad + pricing). No hay modal.
      setSelectedClient(pickedEntity);
      lastPickedClientIdRef.current = pickedEntity.id;
      sellerExplicitlyClearedRef.current = false;
      setClientDetail(null);
      setPreviewClientId(undefined);
      if (fxWarning) toast.warning(fxWarning);
      const optimisticDraft: SalesInvoice = {
        ...draft,
        ...clientDataPatch,
        ...pricingPatch,
      };
      onChange(optimisticDraft);
      commercialEntitiesApi
        .getOne(pickedEntity.id)
        .then((d) => {
          if (clientDetailRequestRef.current !== reqId) return;
          setClientDetail(d);
          const { fullSnap, inheritedDG } = buildDetailResult(d);
          const curDG = optimisticDraft.discountGlobal;
          let nextDG: DocumentDiscountGlobal | undefined = curDG;
          if (curDG?.origin !== "MANUAL") {
            if (inheritedDG) {
              nextDG = inheritedDG;
            } else if (curDG?.origin === "CLIENT") {
              nextDG = { type: "PERCENT", value: 0, reason: "", origin: "NONE" };
            }
          }
          onChange({
            ...optimisticDraft,
            ...(nextDG !== curDG ? { discountGlobal: nextDG } : {}),
            clientSnapshot: { ...optimisticDraft.clientSnapshot, ...fullSnap },
          });
        })
        .catch((err) => {
          if (clientDetailRequestRef.current !== reqId) return;
          toast.error(
            "No se pudo cargar toda la información del cliente. " +
            "Verificá dirección y condición fiscal antes de confirmar.",
          );
          // eslint-disable-next-line no-console
          console.warn("[VentasFacturas] commercialEntitiesApi.getOne falló:", err);
        });
      return;
    }

    // CON líneas reales: NO tocamos NADA visible (ni draft, ni
    // selectedClient, ni clientDetail). El header sigue mostrando el cliente
    // anterior y NO se dispara `salesApi.preview` hasta que el operador
    // decida en el modal. Cancelar el modal = aborto real (cero mutación).
    commercialEntitiesApi
      .getOne(pickedEntity.id)
      .then((d) => {
        if (clientDetailRequestRef.current !== reqId) return;
        const { fullSnap, inheritedDG } = buildDetailResult(d);
        const choice = clientChoiceRef.current;
        if (choice === null) {
          // Modal aún abierto → guardamos TODO (incluye el detail crudo).
          // NO seteamos clientDetail acá: mutaría el panel de direcciones
          // con el modal abierto. Lo aplicará la decisión.
          pendingClientDetailRef.current = {
            reqId, clientId: pickedEntity.id, detail: d, fullSnap, inheritedDG,
          };
          return;
        }
        // El operador ya decidió antes de que volviera la red → aplicar ya.
        setClientDetail(d);
        applyResolvedClientDetail(pickedEntity.id, fullSnap, inheritedDG, choice);
      })
      .catch((err) => {
        if (clientDetailRequestRef.current !== reqId) return;
        toast.error(
          "No se pudo cargar toda la información del cliente. " +
          "Verificá dirección y condición fiscal antes de confirmar.",
        );
        // eslint-disable-next-line no-console
        console.warn("[VentasFacturas] commercialEntitiesApi.getOne falló:", err);
      });

    setRecalcPrompt({
      open: true,
      nextClient: pickedEntity,
      clientDataPatch,
      pricingPatch,
      fxWarning,
    });
  }

  /**
   * Aborto real del cambio de cliente (Cancelar / X / Esc / backdrop del
   * modal). NO muta NADA: ni draft, ni selectedClient, ni clientDetail, ni
   * previewClientId. El header sigue mostrando el cliente anterior. Solo
   * invalida el fetch de detalle en vuelo y descarta lo pendiente.
   */
  function abortClientChange() {
    ++clientDetailRequestRef.current; // invalida el `.then` deferido
    pendingClientDetailRef.current = null;
    clientChoiceRef.current = null;
    setRecalcPrompt({
      open: false, nextClient: null,
      clientDataPatch: {}, pricingPatch: {}, fxWarning: null,
    });
  }

  /**
   * "Recalcular precios" — rehidrata TODO desde el cliente nuevo:
   * lista / moneda / fx (pricingPatch) + identidad/term (clientDataPatch) +
   * bonificación heredada + exención (vía el preview del cliente nuevo, que
   * es autoritativo). `previewClientId = undefined` → el motor cotiza con el
   * cliente NUEVO → cambia la firma → se dispara `salesApi.preview`.
   */
  function confirmRecalcWithNewClient() {
    const { nextClient, clientDataPatch, pricingPatch, fxWarning } = recalcPrompt;
    setRecalcPrompt({
      open: false, nextClient: null,
      clientDataPatch: {}, pricingPatch: {}, fxWarning: null,
    });
    if (!nextClient) return;
    clientChoiceRef.current = "recalc";
    // Recién acá (decisión tomada) aplicamos el estado visible del cliente.
    setSelectedClient(nextClient);
    lastPickedClientIdRef.current = nextClient.id;
    sellerExplicitlyClearedRef.current = false;
    // Cotizar con el cliente NUEVO (sin override).
    setPreviewClientId(undefined);
    if (fxWarning) toast.warning(fxWarning);

    const cur = draftRef.current;
    const base: SalesInvoice = {
      ...cur,
      ...clientDataPatch,
      ...pricingPatch,
      // "Recalcular" = el cliente nuevo es AUTORITATIVO. Reseteamos:
      //   · estado de IMPUESTO y BONIFICACIÓN HEREDADA del cliente anterior
      //     (override/taxAmount/taxBreakdown/exención + inheritedDiscount/
      //     discountAmount).
      //   · `clearManualOverrides: true` → además limpia el override MANUAL
      //     del operador (`manualDiscount`, `manualPrice`, flags
      //     `manualOverrides.{discount,price,tax}`, `manualDiscountAppliesTo`,
      //     `manualTaxAppliesTo`). Esos overrides fueron decididos bajo la
      //     condición comercial del cliente VIEJO y no tienen sentido bajo
      //     el cliente nuevo — el operador eligió "Recalcular precios"
      //     justamente para dejar que el motor aplique las reglas del nuevo.
      // El preview del cliente nuevo se vuelve la única fuente: bonificación
      // heredada, recargo heredado, exención fiscal, lista propia, etc.
      lines: cur.lines.map((l) => resetLineForClientChange(l, { clearManualOverrides: true })),
    };
    const pend = pendingClientDetailRef.current;
    if (pend && pend.clientId === nextClient.id) {
      // El detalle ya volvió → aplicamos snapshot + bonif. heredada ahora.
      setClientDetail(pend.detail);
      const curDG = base.discountGlobal;
      let nextDG: DocumentDiscountGlobal | undefined = curDG;
      if (curDG?.origin !== "MANUAL") {
        if (pend.inheritedDG) {
          nextDG = pend.inheritedDG;
        } else if (curDG?.origin === "CLIENT") {
          nextDG = { type: "PERCENT", value: 0, reason: "", origin: "NONE" };
        }
      }
      onChange({
        ...base,
        ...(nextDG !== curDG ? { discountGlobal: nextDG } : {}),
        clientSnapshot: { ...base.clientSnapshot, ...pend.fullSnap },
      });
      pendingClientDetailRef.current = null;
    } else {
      // El detalle aún no volvió → aplicamos pricing+identidad; el `.then`
      // del fetch aplicará snapshot + bonif. heredada (choice = "recalc").
      onChange(base);
    }
  }

  /**
   * "Mantener precios actuales" — el documento adopta el cliente nuevo
   * (identidad / snapshot / dirección / vendedor / término / vencimiento)
   * pero el MOTOR sigue cotizando con el cliente PREVIO: precios, impuestos
   * (manuales y heredados), bonificaciones, exención y moneda/fx visual
   * quedan congelados. NO se aplica `pricingPatch`, NO se hereda nueva
   * bonificación/impuesto y NO se dispara `salesApi.preview` (la firma no
   * cambia porque `previewClientId` fija el cliente previo).
   */
  function keepCurrentPricesWithNewClient() {
    const { nextClient, clientDataPatch } = recalcPrompt;
    setRecalcPrompt({
      open: false, nextClient: null,
      clientDataPatch: {}, pricingPatch: {}, fxWarning: null,
    });
    if (!nextClient) return;
    clientChoiceRef.current = "keep";
    // Recién acá (decisión tomada) aplicamos el estado visible del cliente.
    setSelectedClient(nextClient);
    lastPickedClientIdRef.current = nextClient.id;
    sellerExplicitlyClearedRef.current = false;

    const cur = draftRef.current;
    // Cliente PREVIO = el que tenía el documento antes de este cambio. El
    // motor sigue cotizando con él (precios congelados). `null` fuerza
    // "sin cliente" cuando no había cliente previo.
    setPreviewClientId(cur.clientId ?? null);

    // P1 #3 — Etapa E2: limpieza quirúrgica del flag fiscal stale.
    // `taxExemptByEntity` es atributo del CLIENTE (no del precio). Si el
    // cliente cambió pero el preview se queda con el cliente previo (para
    // mantener precios), el flag heredado del cliente anterior queda
    // pegado. `clearLineExemptionFlag` solo borra ese flag, sin tocar
    // taxAmount/taxOverride/breakdown/precios (esos son los "precios" que
    // queremos mantener). Identidad estable: si la línea no tenía el
    // flag, devuelve la misma referencia.
    const baseLines = cur.lines.map(clearLineExemptionFlag);
    const base: SalesInvoice = { ...cur, lines: baseLines, ...clientDataPatch };
    const pend = pendingClientDetailRef.current;
    if (pend && pend.clientId === nextClient.id) {
      // Solo snapshot/dirección — NO bonif. heredada (no se hereda en keep).
      setClientDetail(pend.detail);
      onChange({
        ...base,
        clientSnapshot: { ...base.clientSnapshot, ...pend.fullSnap },
      });
      pendingClientDetailRef.current = null;
    } else {
      onChange(base);
    }
  }

  const balance = Math.max(0, effectiveTotals.total - draft.paidAmount);
  // Etapa A.3 — `balanceBefore=0` / `balanceAfter` eliminados junto al card
  // account-impact: el saldo real lo expondrá el backend en
  // `balanceBreakdown.monetaryBalance`. Mientras tanto, el saldo del cobro
  // se muestra en PaymentCard como `balance` (= total − paidAmount).

  return (
    <>
    <Modal
      open={open}
      onClose={handleModalClose}
      // 1.A — Titulo dinamico segun estado del comprobante.
      //   DRAFT             → "Borrador <Sale.code>" (numero interno del draft).
      //   Confirmado (no    → "Factura N° <Receipt.code>" si existe la
      //   DRAFT) + receipt:    numeracion oficial.
      //   Confirmado sin    → "Editar factura <Sale.code>" (fallback al
      //   officialNumber:      numero interno hasta que el receipt se
      //                        hidrate via getOne/confirm).
      // Nota: el frontend usa `SalesInvoicesStatus` con vocabulario
      // distinto al backend (DRAFT | PENDING | PARTIAL | PAID |
      // CANCELLED). Aca tratamos cualquier status distinto de DRAFT
      // como "comprobante ya confirmado al menos una vez".
      title={
        isNew
          ? "Nueva factura de venta"
          : draft.status !== "DRAFT" && draft.officialNumber
            ? `Factura N° ${draft.officialNumber}`
            : draft.status === "DRAFT"
              ? `Borrador ${draft.number}`
              : `Editar factura ${draft.number}`
      }
      subtitle={
        draft.status !== "DRAFT" && draft.officialNumber
          ? `Comprobante ${draft.officialNumber}`
          : `Número ${draft.number}`
      }
      maxWidth="7xl"
      // Ancho del modal: lectura usa el ancho calibrado (1760px / 98vw).
      // En modo edicion (drag/resize de cards) el operador necesita
      // mas canvas disponible para reordenar — pasamos a 99vw sin
      // tope maximo: el grid del aside puede usar toda la pantalla.
      className={cn(
        editLayoutMode
          ? "!max-w-none w-[99vw]"
          : "!max-w-[1760px] w-[98vw]",
      )}
      // Reduce el padding lateral del body en edit mode para ganar
      // unos 24px extra a cada lado del canvas del grid.
      bodyClassName={editLayoutMode ? "!px-3" : undefined}
      resizable
      maximizable
      maximizedMode="embedded"
      modalKey="ventas-facturas-editor"
      onEnter={isReadOnly ? undefined : handleConfirmedSave}
      headerRight={
        /* Indicador "Recalculando…" + botón "Personalizar layout" + botón
           "Configuración de vista". El loader es passive: solo aparece cuando
           `previewStatus === "loading"`. El botón "Personalizar layout" es el
           ATAJO DIRECTO al modo edición (drag/resize del aside) — antes vivía
           escondido dentro del modal de Configuración → Vista/Layout, lo que
           hacía que el operador no encontrara cómo personalizar. Cuando
           `editLayoutMode` ya está activo, el botón se oculta (la toolbar
           sticky del banner ya expone Listo/Restaurar/Cancelar). Orden
           visual: [↻] [▦ Personalizar] [⚙ config] [⛶] [✕]. */
        <>
          {/* Refinamiento Fase A — badge "Política comercial".
              Más prominente que el chip discreto original: prefijo
              "Política comercial:" + conteos legibles. Solo se muestra
              cuando hay al menos UNA línea evaluada y NO está todo en
              OK (cero ruido en facturas vacías o limpias).
              Color cambia según el peor caso (CRITICAL rojo / RISK
              naranja / WARNING amarillo). */}
          {documentCommercialStatus.evaluated > 0
            && documentCommercialStatus.worst !== "OK" && (() => {
            // Armar la frase: "1 crítica · 2 advertencias" según conteos.
            const parts: string[] = [];
            if (documentCommercialStatus.critical > 0) {
              parts.push(`${documentCommercialStatus.critical} crítica${documentCommercialStatus.critical === 1 ? "" : "s"}`);
            }
            if (documentCommercialStatus.risk > 0) {
              parts.push(`${documentCommercialStatus.risk} con riesgo`);
            }
            if (documentCommercialStatus.warning > 0) {
              parts.push(`${documentCommercialStatus.warning} advertencia${documentCommercialStatus.warning === 1 ? "" : "s"}`);
            }
            return (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold border shadow-sm",
                  documentCommercialStatus.critical > 0
                    ? "border-red-400/70 bg-red-50 text-red-700 dark:border-red-700/60 dark:bg-red-950/40 dark:text-red-300"
                    : documentCommercialStatus.risk > 0
                    ? "border-orange-400/70 bg-orange-50 text-orange-700 dark:border-orange-700/60 dark:bg-orange-950/40 dark:text-orange-300"
                    : "border-amber-400/70 bg-amber-50 text-amber-700 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-300",
                )}
                title={
                  `Estado comercial del comprobante — ${documentCommercialStatus.ok} OK`
                  + ` · ${documentCommercialStatus.warning} margen bajo`
                  + ` · ${documentCommercialStatus.risk} riesgo`
                  + ` · ${documentCommercialStatus.critical} crítico`
                }
                data-tp-invoice-commercial-status-badge={documentCommercialStatus.worst}
                aria-label="Estado comercial del comprobante"
              >
                <AlertTriangle size={12} aria-hidden />
                <span className="hidden sm:inline">Política comercial:</span>
                <span>{parts.join(" · ")}</span>
              </span>
            );
          })()}
          <TPTechPricingLoader
            active={previewStatus === "loading"}
            label="Recalculando…"
          />
          {/* "Personalizar layout" — shortcut REMOVIDO del header superior
              (ajuste UX). El acceso sigue disponible desde Configuración de
              vista (engranaje a la derecha). Se conserva intacta toda la
              maquinaria layout/v2: handlers, presets, dialogs, edit mode,
              persistencia. Solo cambia el punto de entrada visual. */}
          <TPIconButton
            onClick={() => setSettingsModalOpen(true)}
            title="Configuración de vista"
            aria-label="Configuración de vista"
            className="h-9 w-9"
            data-tp-invoice-settings-button
          >
            {/* CAMBIO 1 — icono de "Plantillas de pantalla / layout de cards"
                (LayoutDashboard) en vez del engranaje genérico (Settings), que
                se confundía con configuración general. Solo iconografía:
                handler / estado / tooltip / tamaño / posición sin cambios. */}
            <LayoutDashboard size={16} aria-hidden />
          </TPIconButton>
        </>
      }
      footerClassName="backdrop-blur-sm bg-card/85 !border-border/60 px-6 py-3"
      footer={
        <>
          {/* UX.20 — Modal de Configuración. Vive fuera del JSX del footer
              (es un overlay propio) pero su estado se toggle desde el botón
              ⚙ del header del Modal contenedor. Centraliza preset, cards
              visibles, sticky actions y acciones del comprobante
              (Imprimir / Etiquetas / Enviar). */}
          <InvoiceSettingsModal
            open={settingsModalOpen}
            onClose={() => setSettingsModalOpen(false)}
            preset={invoiceViewPreset.preset}
            onPresetChange={handlePresetChange}
            onResetLayout={handleResetLayout}
            onEnterEditMode={enterEditLayoutMode}
            uiPreferences={invoiceUiPreferences.resolved}
            onUiPatch={handleUiPatch}
            // Etapa 5 — "Mis vistas". El hook expone todo el CRUD; el
            // modal solo es el render. Aplicar un preset reemplaza el
            // layoutV2 actual y persiste con debounce.
            presets={invoiceLayout.presets}
            onSavePresetAs={invoiceLayout.savePresetAs}
            onApplyPreset={invoiceLayout.applyPreset}
            onRenamePreset={invoiceLayout.renamePreset}
            onDuplicatePreset={invoiceLayout.duplicatePreset}
            onDeletePreset={invoiceLayout.deletePreset}
            onSetDefaultPreset={invoiceLayout.setDefaultPresetId}
          />
          {/* Footer ejecutivo — herramientas frecuentes (Imprimir / Etiquetas /
              Enviar) en variante ghost a la izquierda, separadas por un
              divider vertical de las CTA del documento (Cancelar / Borrador /
              Crear). El modal de Configuración (⚙) queda solo para layout y
              comportamiento visual. */}
          <TPDocumentModalFooter
            isNew={isNew}
            onCancel={handleModalClose}
            onSave={handleConfirmedSave}
            cancelIcon={<X size={14} />}
            cancelLabel="Cerrar"
            onSaveDraft={saveDraftToBackend}
            draftSaving={draftSaving}
            hideDetailedTotals={true}
            readOnly={isReadOnly}
            extraActions={
              <>
                <TPButton
                  variant="ghost"
                  onClick={handlePrintDocument}
                  title={
                    draft.status === "DRAFT"
                      ? "Imprimir BORRADOR (vista operativa con sello)"
                      : draft.status === "CANCELLED"
                        ? "Imprimir comprobante ANULADO (vista operativa con sello)"
                        : "Imprimir documento (factura)"
                  }
                  iconLeft={<Printer size={14} />}
                  className="h-8 text-xs"
                >
                  Imprimir
                </TPButton>
                {/* Pivot funcional — disponible en cualquier estado. DRAFT y
                    CANCELLED descargan con watermark BORRADOR / ANULADA
                    renderado server-side por renderInvoicePdf. */}
                <TPButton
                  variant="ghost"
                  onClick={handleDownloadOfficialPdf}
                  title={
                    draft.status === "DRAFT"
                      ? "Descargar PDF (BORRADOR)"
                      : draft.status === "CANCELLED"
                        ? "Descargar PDF de la factura anulada."
                        : "Descargar PDF de la factura"
                  }
                  iconLeft={<Download size={14} />}
                  className="h-8 text-xs"
                >
                  Descargar PDF
                </TPButton>
                <TPButton
                  variant="ghost"
                  onClick={() => setLabelsOpen(true)}
                  disabled={labelItems.length === 0}
                  title={labelItems.length === 0 ? "Sin artículos para etiquetar" : "Imprimir etiquetas de los artículos"}
                  iconLeft={<Tag size={14} />}
                  className="h-8 text-xs"
                >
                  Etiquetas
                </TPButton>
                {/* Pivot funcional — disponible en cualquier estado. El
                    subject/body del modal son state-aware (BORRADOR /
                    ANULADA / final). El PDF adjunto lleva el watermark. */}
                <TPButton
                  variant="ghost"
                  onClick={() => setEmailModalOpen(true)}
                  title={
                    draft.status === "DRAFT"
                      ? "Enviar borrador por mail."
                      : draft.status === "CANCELLED"
                        ? "Enviar factura anulada."
                        : "Enviar factura por mail."
                  }
                  iconLeft={<Mail size={14} />}
                  className="h-8 text-xs"
                >
                  Enviar por mail
                </TPButton>
                {/* Divider vertical: separa herramientas frecuentes de las
                    CTA del documento. */}
                <span
                  aria-hidden
                  className="mx-1 h-5 w-px bg-border/60 shrink-0"
                />
              </>
            }
          />
        </>
      }
    >
      <div className="space-y-3">
        {/* Etapa 5 — Banner READ-ONLY: comprobante ya emitido o anulado.
            Visible solo cuando `isReadOnly` está activo. Muestra qué tipo
            de documento es (CONFIRMED vs CANCELLED), el número oficial
            (Receipt.code) y la fecha de confirmación/anulación. El banner
            NO bloquea acciones — coexiste con el footer (Imprimir /
            Descargar PDF / Enviar por mail / Cerrar siguen activos).
            Las CTAs de mutación quedan ocultas por `readOnly` del footer
            y los inputs internos por el `<fieldset disabled>` envolvente. */}
        {isReadOnly && (() => {
          const isCancelled = draft.status === "CANCELLED";
          const palette = isCancelled
            ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
            : "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
          return (
            <div
              className={cn(
                "flex items-start gap-3 rounded-md border px-3 py-2 text-[12px]",
                palette,
              )}
              role="status"
              data-tp-invoice-readonly-banner
            >
              <span aria-hidden className="mt-0.5 shrink-0">
                <Eye size={14} />
              </span>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="font-semibold uppercase tracking-wider text-[11px]">
                  {isCancelled
                    ? "Comprobante anulado — solo lectura"
                    : "Documento emitido — solo lectura"}
                </span>
                <span className="opacity-80">
                  {draft.officialNumber
                    ? `Factura N° ${draft.officialNumber}`
                    : `Borrador ${draft.number}`}
                  {draft.client && ` · ${draft.client}`}
                </span>
                <span className="opacity-70 text-[11px]">
                  {isCancelled
                    ? "La factura fue anulada. Podés imprimirla o enviarla pero no editarla."
                    : "La factura fue emitida. Podés imprimirla, enviarla por mail o anularla — la edición está bloqueada."}
                </span>
              </div>
            </div>
          );
        })()}
        {/* Etapa 5 — Bloqueo de edición a nivel HTML estándar. El fieldset
            con `disabled` propaga a TODOS los descendientes input/button/
            select/textarea sin necesidad de cambiar cada componente. La
            clase `contents` neutraliza el display block del fieldset para
            que el `space-y-3` del wrapper externo siga funcionando.
            Sub-componentes custom que renderean inputs nativos heredan
            disabled automáticamente; los pocos que no respetan disabled
            del ancestor pueden recibir la prop `readOnly` explícita en
            iteraciones futuras (no se descubrió ninguno aún en QA). */}
        <fieldset
          disabled={isReadOnly}
          className="contents"
          data-tp-invoice-readonly-fieldset={isReadOnly ? "true" : "false"}
        >
        {/* Banner contextual del MODO EDICIÓN del layout. Solo se renderiza
            mientras `editLayoutMode === true` — fuera de ese modo el footer
            queda 100% limpio (solo Cancelar/Borrador/Crear). El banner es
            sticky-top para que el operador siempre tenga acceso a
            [Restaurar diseño] y [Listo] mientras arrastra cards. */}
        {editLayoutMode && (
          <div
            className="sticky top-0 z-10 -mx-6 -mt-4 mb-1 flex items-center justify-between gap-3 border-b border-primary/40 bg-card/90 px-6 py-2.5 backdrop-blur-sm shadow-[0_2px_8px_-4px_rgba(0,0,0,0.12)]"
            data-tp-invoice-edit-layout-banner
          >
            <div className="flex items-center gap-3 min-w-0">
              {/* Chip identitario — comunica al operador que entró a una
                  zona donde el layout se puede arrastrar/redimensionar. */}
              <span
                className="inline-flex items-center gap-1.5 rounded-md border border-primary/50 bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary"
                aria-hidden
              >
                <LayoutGrid size={12} aria-hidden />
                Personalizar layout
              </span>
              <div className="hidden flex-col leading-tight sm:flex min-w-0">
                <span className="text-[13px] font-semibold text-text">
                  Personalizá tu vista
                </span>
                <span className="text-[11px] text-muted truncate">
                  Arrastrá los cards para ordenarlos. Usá las esquinas o
                  bordes para cambiar el tamaño. Los cambios se guardan
                  automáticamente.
                </span>
              </div>
            </div>
            <LayoutEditModeToolbar
              editing={true}
              onEnter={enterEditLayoutMode}
              onExit={exitEditLayoutMode}
              onReset={handleResetLayout}
              onCancelChanges={cancelEditLayoutChanges}
              persistenceStatus={invoiceLayout.persistenceStatus}
            />
          </div>
        )}
        {/* UX.17 — Render condicional al `layoutMode` resuelto del preset.
            Tres estructuras posibles (el aside dinámico y el resto del
            contenido NO cambia — solo se reorganiza el grid):
              · TWO_COLS_FROM_TOP (COMPACT / CUSTOM)  → Header + Líneas +
                Observaciones en col izq desde arriba; aside en col der
                desde la misma altura del Header.
              · STACKED_FULL_WIDTH (CLASSIC)          → Header + Líneas
                full-width arriba; debajo grid 2-cols con Observaciones
                (izq) + aside (der).
              · SINGLE_COLUMN (Una columna)           → todo apilado en una
                sola columna full-width; Observaciones queda al final.
            Implementación CSS Grid pura:
              - col-izq tiene `lg:col-span-2` cuando STACKED → ocupa toda
                la fila superior y empuja Observaciones+aside a la fila 2.
              - Observaciones se renderea en uno de 3 lugares (col izq,
                celda separada, o al final) según el modo. Para evitar
                duplicar el JSX usamos la variable `observationsJsx` abajo.
              - SINGLE_COLUMN setea `forceSingleColumn=true` → omitimos
                `lg:grid-cols-[...]` y el grid queda en `grid-cols-1`.
            Cero cambio en el contenido funcional — solo CSS de placement. */}
        {(() => {
          const layoutMode = invoiceViewPreset.resolved.layoutMode;
          // Observaciones a renderear — reutilizable en cualquier slot del
          // grid (el contenido y los handlers son idénticos en todos los
          // modos, solo cambia DÓNDE se posiciona).
          const observationsJsx = (
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
                onEnsureReceiptId={ensureSavedReceiptId}
              />
            </TPCollapse>
          );
          return (
        <div
          className={cn(
            // Gap uniforme 8 px (= CARD_GAP_Y_PX desde spacing.ts).
            // Sincronizar con la columna interna (`space-y-2` abajo) y
            // con el grid del aside (`GRID_MARGIN = [8, 8]`) para que
            // todos los gaps visuales sean identicos en las 3 plantillas.
            "grid grid-cols-1 gap-2 lg:items-start",
            !invoiceViewPreset.resolved.forceSingleColumn
              && "lg:grid-cols-[1fr_var(--invoice-aside-col)]",
          )}
          style={asideColumnGridStyle(invoiceViewPreset.resolved)}
        >
          {/* COLUMNA IZQUIERDA — Header + Líneas (+ Observaciones según modo).
              `min-w-0` evita que el grid interno de Líneas
              (`min-w-[1460px]` + overflow-x-auto) infle la columna y
              rompa la grid principal.
              `lg:col-span-2` cuando CLASSIC (STACKED_FULL_WIDTH) → la
              fila superior ocupa toda la grilla; Observations y aside
              caen a una segunda fila debajo. */}
          <div className={cn(
            // 8 px gap (alineado con CARD_GAP_Y_PX). Antes era 12.
            "space-y-2 min-w-0",
            layoutMode === "STACKED_FULL_WIDTH" && "lg:col-span-2",
          )}>
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
          onClientSearch={searchClients}

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
                (minmax 420px / 1.575fr) gracias al solver de grid.
                UX.11/12 — proporciones recalibradas en paralelo con
                `TPDocumentLineAdvancedEditor`. Líneas pasó de 8 a 7
                columnas (UX.12: acciones movidas DENTRO del bloque Total,
                ya no son columna separada). El quick-add ahora tiene
                6 columnas (sin drag de 14px y sin la columna fantasma
                "auto" del final). Última columna ampliada a 200px para
                matchear el Total ensanchado del editor. */}
            {showQuickSearch && (
              <div className={cn(
                "mb-3 grid grid-cols-1 items-end gap-x-2",
                "lg:grid-cols-[minmax(420px,1.575fr)_minmax(110px,0.45fr)_minmax(200px,0.85fr)_minmax(130px,0.5fr)_minmax(130px,0.5fr)_minmax(200px,auto)]",
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

                {/* Columnas restantes vacías — placeholder para el solver.
                    5 placeholders alinean las cols 2-6 (qty, prec, bonif,
                    iva, total) del editor de líneas. */}
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
                      // P0.1 (H1) — Unificado bajo `applyGlobalPriceListChange`.
                      // El helper limpia `priceListIdOverride` de TODAS las
                      // líneas (sin esto, las líneas con override quedaban
                      // ancladas a la lista vieja) y setea
                      // `priceListExplicitlyCleared = true` (sin esto, el
                      // useEffect de favoritos re-aplicaba la favorita).
                      onChange(applyGlobalPriceListChange(draft, null));
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
                        // P0.1 (H1) — Mismo helper canónico que el editor de
                        // líneas (VentasFacturas.tsx:6407-6409). Antes este
                        // path NO limpiaba `priceListIdOverride` y las líneas
                        // con override quedaban con precio sin actualizar.
                        onChange(applyGlobalPriceListChange(draft, p.id));
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

            {/* (Franja resumen comercial sobre la tabla eliminada — la
                 alerta por línea vive ahora INTEGRADA en el bloque
                 "Total línea c/imp." de cada fila, y el resumen del
                 documento se mantiene en el badge del header y en el
                 Total card del aside. Evitamos el "banner aparte" que
                 competía contra la lectura natural.) */}
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
              availableTaxes={availableLineTaxes}
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
              // BUG FIX — selector global de lista de precios.
              //
              // Antes: `onChange({ ...draft, priceListId: id ?? undefined })`
              // solo cambiaba la lista del documento; las líneas que tenían
              // `priceListIdOverride` quedaban ancladas a la lista vieja y
              // seguían mostrando el badge "Línea" + precio sin actualizar.
              //
              // Ahora delegamos al helper puro `applyGlobalPriceListChange`,
              // que cambia `draft.priceListId` y LIMPIA
              // `priceListIdOverride`/`priceListOverride` de TODAS las líneas.
              // El preview se dispara solo (usePreviewFlow observa `draft`),
              // y el motor recalcula precio + descuentos + impuestos +
              // redondeos + promociones contra la lista global nueva.
              // Si después el operador vuelve a cambiar una línea
              // puntualmente, el badge "Línea" reaparece solo en esa línea
              // (`onChangeLinePriceList` abajo sigue intacto).
              onChangePriceList={(id) =>
                onChange(applyGlobalPriceListChange(draft, id))
              }
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
              // Etapa E2 — FIX FX para sub-líneas equivalentes en facturas
              // no-base. `draft.fxRate` es siempre el rate "unidades base por
              // 1 unidad de la moneda del documento" (= 1 si la moneda es la
              // base del tenant). `displayRate` del memo no sirve acá porque
              // se trunca a 1 cuando `currencyConverted=true`, pero
              // `unitValueBase` del backend SIEMPRE viene en base.
              documentFxRate={draft.fxRate}
              // El modo de saldo del DOCUMENTO (misma fuente que el footer) hace
              // que la VISTA de cada línea siga al documento: footer/cliente/lista
              // mandan en sincronía. Solo presentación — los números no cambian.
              documentBalanceMode={backendPreview?.result?.balanceMode}
              // UX.19 — passthrough del énfasis del Total línea desde el
              // preset. CLASSIC tiene `EMPHASIZED` (líneas full-width →
              // aprovecha ancho extra). El resto: `STANDARD`.
              lineTotalEmphasis={invoiceViewPreset.resolved.lineTotalEmphasis}
              // Posicion de la mini-toolbar de acciones de linea
              // (expandir/restablecer/eliminar/menu). En CLASSIC va
              // INLINE al lado del label "Total linea c/ imp." (look
              // ERP tradicional). En COMPACT y ONE_LINE queda al pie
              // del bloque del total (comportamiento actual).
              inlineLineActions={invoiceViewPreset.resolved.preset === "CLASSIC"}
              // Sticky-actions: lo gobierna SOLO el preset ahora. El
              // toggle "Mantener acciones visibles" del modal de
              // Configuracion se elimino con el layout V2 (auto-grow
              // hace que las cards entren completas y el scroll
              // horizontal en la fila ya no es la pesadilla que era).
              stickyLineActions={invoiceViewPreset.resolved.stickyLineActions}
              // Fase A — política comercial: borde lateral por fila según
              // el nivel derivado de `policy.blockingAlerts` + `alerts[]`.
              commercialLevelByLineId={commercialLevelByLineId}
              // Refinamiento: chip al pie con motivo + margen % por fila.
              commercialInfoByLineId={commercialInfoByLineId}
            />
          </TPCard>

          {/* MAIN-BELOW-LINES (inline) — cards de la region
              "mainBelowLines" del layout V2 persistido. SSOT del default
              vive en `MAIN_BELOW_LINES_BY_PRESET`, pero el layout
              concreto (incluyendo vistas guardadas) puede override esa
              region por card. Aca leemos directamente del `layoutV2.cards`
              para que vistas personalizadas restauren la region exacta.
              En CLASSIC (STACKED_FULL_WIDTH), Observations NO va aca
              porque la col-izq es full width (col-span-2) y dejaria
              Observations arriba con el aside vacio al lado. CLASSIC
              renderea Observations como celda separada del grid mas
              abajo, para que quede en la fila 2 al lado del aside. */}
          {(() => {
            if (layoutMode === "STACKED_FULL_WIDTH") return null;
            const mainCards = invoiceLayout.layoutV2.cards
              .filter((c) => c.region === "mainBelowLines")
              .sort((a, b) => a.y - b.y);
            if (mainCards.length === 0) return null;
            const vc = invoiceUiPreferences.resolved.visibleCards;
            return (
              <>
                {mainCards.map((c) => {
                  if (c.id === "observations") {
                    if (vc.observations === false) return null;
                    return <React.Fragment key={c.id}>{observationsJsx}</React.Fragment>;
                  }
                  return null;
                })}
              </>
            );
          })()}
          </div>

          {/* MAIN-BELOW-LINES (celda separada en STACKED) — solo CLASSIC.
              Cuando la col-izq es col-span-2 (fila 1 full width con
              Datos+Lineas), este <div> cae como segundo hijo del grid
              en la fila 2 col 1, alineado verticalmente con el aside
              que va a fila 2 col 2. Resultado visual:
                Fila 1: [ Datos + Lineas             ]   ← col-izq full
                Fila 2: [ Observations | aside cards ]
              `min-w-0` evita que Observations infle la columna.
              Lee de `layoutV2.cards` con region="mainBelowLines" para
              que vistas guardadas restauren la region exacta. */}
          {(() => {
            if (layoutMode !== "STACKED_FULL_WIDTH") return null;
            const mainCards = invoiceLayout.layoutV2.cards
              .filter((c) => c.region === "mainBelowLines")
              .sort((a, b) => a.y - b.y);
            const hasObservations = mainCards.some((c) => c.id === "observations");
            if (!hasObservations) return null;
            const vc = invoiceUiPreferences.resolved.visibleCards;
            if (vc.observations === false) return null;
            return (
              <div className="min-w-0 space-y-2">
                {observationsJsx}
              </div>
            );
          })()}

          {/* Aside derecho: render dinámico — itera `layout.cards` del slot
              "aside" en el orden definido por el layout. El DEFAULT_LAYOUT
              replica el orden histórico. En modo edición (`editLayoutMode`),
              cada card se envuelve en `<DraggableCard>` y el bucket entero
              en `<LayoutDndContext>`. En modo lectura ambos wrappers se
              omiten → el modal se ve idéntico al pre-Fase 2.
              UX.9 — el <aside> ahora es la SEGUNDA columna de la grid
              global (alineada con el Header). Antes vivía en una grid
              interna que solo cubría la zona inferior. */}
          <aside
            ref={asideRef}
            // Container del aside — ÚNICO HIJO es `<LayoutGridContext>` que
            // posiciona las cards en absoluto sobre su propia grilla. NO
            // aplicamos flex / space-y / gap al `<aside>` porque solo hay
            // un hijo (el grid) y cualquier display alternativo crea ruido
            // visual o interfiere con el cálculo de `clientWidth` del
            // ResizeObserver del LayoutGridContext.
            //   · Lectura: container neutro — el grid V2 dibuja el layout.
            //   · Edición: agregamos un ring discreto + fondo dotted como
            //     "affordance" de superficie editable. La grilla guía
            //     desaparece al salir.
            // El operador percibe que el aside es una superficie viva sin
            // que el CSS pelee con el posicionamiento absoluto del grid.
            className={editLayoutMode
              ? "relative rounded-md p-2 ring-1 ring-dashed ring-primary/20 [background-image:radial-gradient(circle,_var(--tw-shadow-color)_1px,_transparent_1px)] [background-size:16px_16px] shadow-primary/20"
              : "relative"}
            data-tp-invoice-aside-edit-mode={editLayoutMode || undefined}
          >
            {/* FASE 8.2 — Cards extraídos a ./ventas-facturas/InvoiceEditorModal/.
                Sin lógica comercial: solo passthrough de value/onPatch.
                Fase 2 — render envuelto en DnD condicional al modo edición.
                Fase 3 — resize por card con widths discretos. */}
            {(() => {
              // Dispatcher por id → JSX exacto del card. Cero cambio comercial:
              // los props son los mismos que en el render hardcoded histórico.
              const renderAsideCard = (id: CardId): React.ReactNode => {
                // UX.21 — filtro `visibleCards`: si el usuario ocultó un
                // card desde Configuración, devolver null aquí lo elimina
                // del render dinámico SIN romper el layout (el flex/space-y
                // del aside maneja huecos automáticamente). El `getCardsBySlot`
                // sigue trayéndolos en su orden persistido — solo el
                // dispatcher decide no renderizarlos.
                const vc = invoiceUiPreferences.resolved.visibleCards;
                const togKey =
                  id === "account-impact" ? "accountImpact" :
                  id === "discount"     ? "discount"     :
                  id === "shipping"     ? "shipping"     :
                  id === "coupon"       ? "coupon"       :
                  id === "totals"       ? "totals"       :
                  id === "payments"     ? "payments"     :
                  id === "observations" ? "observations" :
                  null;
                if (togKey && vc[togKey] === false) return null;
                switch (id) {
                  case "discount":
                    return (
                      <DiscountCard
                        value={draft.discountGlobal}
                        onPatch={patchDiscountGlobal}
                        open={discountOpen}
                        onOpenChange={setDiscountOpen}
                        fmtCurrency={mFmt}
                        favoriteType={favoriteDiscountType}
                        onSetFavoriteType={handleSetFavoriteDiscountType}
                      />
                    );
                  case "shipping":
                    return (
                      <ShippingCard
                        value={draft.shipping}
                        onPatch={patchShipping}
                        open={shippingOpen}
                        onOpenChange={setShippingOpen}
                        fmtCurrency={mFmt}
                        // Conversion FX para que la tarifa del carrier
                        // (persistida en BASE) se hidrate en moneda DOC
                        // cuando el comprobante NO esta en base.
                        documentFxRate={
                          typeof draft.fxRate === "number" && draft.fxRate > 0
                            ? draft.fxRate
                            : 1
                        }
                        // Moneda DOC para formatear el cost del header
                        // SIN doble conversion. El cost del draft ya esta
                        // en moneda DOC; pasandole el code de DOC, el
                        // header lo muestra con el prefijo correcto.
                        documentCurrencyCode={currencyDisplay}
                        // Moneda BASE para el helper "Tarifa: ARS X"
                        // cuando el comprobante esta en otra moneda y
                        // el operador quiere ver la tarifa original del
                        // catalogo lado a lado con el valor convertido.
                        baseCurrencyCode={
                          currencies.find((c) => c.isBase)?.code
                        }
                      />
                    );
                  case "coupon":
                    // Cupón de venta — solo manda couponCode al backend.
                    return (
                      <CouponCard
                        draft={draft}
                        onChange={onChange}
                        clientId={selectedClient?.id}
                        onApplied={() => { /* draft.couponCode ya está en deps de previewSignature → recálculo automático */ }}
                      />
                    );
                  case "totals":
                    // Etapa B — Card maestro "Total del comprobante".
                    // Fusiona Hero + selector de Balance Mode + summary de
                    // balance (UNIFIED/BREAKDOWN) en una única pieza
                    // jerárquica. Cero matemática: passthrough del preview.
                    // El TPBalanceModeSelector queda integrado INLINE en el
                    // header del card (ya no flota suelto).
                    //
                    // UX.7 — `className="mt-2"` agrega ~8px adicionales sobre
                    // el `space-y-3` base del aside → SEPARACIÓN JERÁRQUICA
                    // entre los cards de configuración (Discount/Shipping/
                    // Coupon) y el Total. En modo edición el aside usa
                    // `flex-wrap gap-3` y el mt-2 queda absorbido por el
                    // gap del flex → cero impacto en el layout draggable.
                    return (
                      <TotalDelComprobanteCard
                        className="mt-2"
                        totalDocument={effectiveTotals.total}
                        currencyCode={
                          backendPreview?.result?.responseCurrencyCode
                            ?? backendPreview?.result?.balanceBreakdown?.monetaryBalance?.currencyCode
                            ?? currencyDisplay
                        }
                        balanceMode={backendPreview?.result?.balanceMode}
                        balanceModeSource={backendPreview?.result?.balanceModeSource}
                        balanceBreakdown={backendPreview?.result?.balanceBreakdown ?? null}
                        balanceModeOverride={draft.balanceModeOverride ?? null}
                        onBalanceModeOverrideChange={(next) => {
                          onChange({ ...draft, balanceModeOverride: next });
                        }}
                        overrideDisabled={draft.status !== "DRAFT"}
                        channelName={pricingDetail.channelName}
                        priceListName={backendPreview?.result?.appliedPriceListName ?? null}
                        // Aviso UI listas mixtas (2026-06-03) — passthrough puro
                        // del preview: "MIXED" ⇒ el backend entró en
                        // MIXED_LIST_FALLBACK (redondeo comercial PER_DOCUMENT
                        // desactivado). Cero cálculo; solo dispara el aviso.
                        priceListMixed={backendPreview?.result?.appliedPriceListId === "MIXED"}
                        // Etapa UX-Comercial (2026-05-30 — POLICY §R-Rounding-16) —
                        // Valor comercial agregado del metal del documento.
                        // Passthrough EXACTO de `documentTotals.metalCostSubtotal`
                        // que el motor emite (suma de `line.metalCost × qty`
                        // por línea METAL). Con este prop, el card cambia
                        // Patrimonio Metálico de valor físico (valuationMonetary)
                        // a valor comercial (metalCost) — Patrimonio + Saldo =
                        // Total sin METAL_MARGIN visible en el detalle.
                        commercialMetalValueSum={
                          (backendPreview?.result as any)?.documentTotals?.metalCostSubtotal ?? null
                        }
                        // Etapa UX.32 (2026-05-30) — desglose por metal padre
                        // del valor comercial (Σ lineCost × qty agregado por
                        // metalName). Agregación pura — sin recalcular nada
                        // del motor. Invariante: Σ valores === metalCostSubtotal
                        // (verificado E2E qty=1, 3, 7).
                        commercialMetalValueByParent={
                          buildCommercialMetalValueByParent(
                            (backendPreview?.result as any)?.lines ?? [],
                          )
                        }
                        // Fase 1 (2026-06) — VENTA del metal por padre (con
                        // margen), misma fuente canónica que `documentMetals`
                        // (`saleAmountLine`). El card lo prioriza sobre el COSTO
                        // para mostrar el valor comercial real. Passthrough puro.
                        metalSaleByParent={
                          buildMetalSaleByParent(backendPreview?.result?.lines ?? [])
                        }
                        // Fix listas mixtas — base PRE-redondeo (= "Valor comercial"
                        // del card). El footer consolida `final = base + redondeo`
                        // sin doble conteo (base ya NO es post-redondeo).
                        metalSalePreByParent={
                          buildMetalSalePreByParent(backendPreview?.result?.lines ?? [])
                        }
                        // SSOT card ↔ footer — gramo PRINCIPAL de METALES =
                        // el MISMO gramo visible que el card del artículo
                        // (Σ `visibleGrams` ?? `gramsEquivLine`). Evita que el
                        // footer reinterprete el patrimonio metálico (antes
                        // mostraba `saleEquivGr`, divergiendo del card cuando
                        // la lista aplica redondeo comercial PER_DOCUMENT).
                        metalVisibleGramsByParent={
                          buildVisibleGramsByParent(backendPreview?.result?.lines ?? [])
                        }
                        // FASE 1 — Footer "Monetario (saldo)": Σ del MONETARIO
                        // por línea (`lineCommercialSummary.monetary.amount`).
                        // Misma fuente que el Resumen Comercial de la línea →
                        // paridad línea↔footer. Passthrough puro (Σ).
                        commercialMonetarySaldoSum={
                          sumLineCommercialMonetary(backendPreview?.result?.lines ?? [])
                        }
                        // Redondeo comercial monetario — Σ del impacto por línea
                        // (`lineCommercialSummary.monetary.roundingImpact`). Mismo
                        // contrato/fuente que el saldo de arriba. Passthrough puro
                        // (Σ). El card muestra Valor comercial → Redondeo → Valor
                        // redondeado bajo "Monetario (saldo)" cuando es != 0. En
                        // listas Unificadas el contrato trae 0 ⇒ no se muestra.
                        commercialMonetaryRoundingImpactSum={
                          sumLineCommercialMonetaryRoundingImpact(backendPreview?.result?.lines ?? [])
                        }
                        // Footer MIXED "REDONDEOS COMERCIALES" (fila Metal) +
                        // Opción 1 de METALES. Σ del impacto $ del redondeo
                        // comercial del metal por línea
                        // (`lineCommercialSummary.metals.byParent[].roundingImpact`)
                        // y su mapa por padre. Solo se usan cuando NO hay
                        // snapshot document-level (lista mixta). Passthrough puro.
                        commercialMetalRoundingImpactSum={
                          sumLineCommercialMetalRoundingImpact(backendPreview?.result?.lines ?? [])
                        }
                        commercialRoundingByParentFromLines={
                          groupLineCommercialMetalRoundingByParent(backendPreview?.result?.lines ?? [])
                        }
                        // Etapa UX-Saldo — mapa lineId → nombre del artículo
                        // para resolver el "Origen" del Patrimonio Metálico.
                        // Passthrough puro desde el preview: cada línea aporta
                        // su `id` y su `articleName` (o description como
                        // fallback). Sin matemática, sin lookup adicional.
                        lineArticleNames={
                          ((backendPreview?.result as any)?.lines ?? []).reduce(
                            (acc: Record<string, string>, ln: any) => {
                              const id = typeof ln?.id === "string" ? ln.id : null;
                              if (!id) return acc;
                              const name = (typeof ln?.articleName === "string" && ln.articleName.trim())
                                || (typeof ln?.description === "string" && ln.description.trim())
                                || (typeof ln?.articleCode  === "string" && ln.articleCode.trim())
                                || null;
                              if (name) acc[id] = name;
                              return acc;
                            },
                            {} as Record<string, string>,
                          )
                        }
                        // METALES — consolidación por metal padre desde
                        // `composition.metals[]` + `metalHechuraBreakdown` de las
                        // líneas. Usa los MISMOS helpers que el mini desglose por
                        // línea (`buildMetalParentSaleLines` + `computeMetalSaleFactor`)
                        // → PARIDAD EXACTA línea ↔ documento (gramos LADO VENTA
                        // con `metalSaleFactor`, monto = Σ `lineSale` × qty).
                        // El card prefiere esta fuente derivada; el
                        // `balanceBreakdown.metals[]` del backend queda como
                        // fallback para snapshots sin `lines`.
                        documentMetals={deriveDocumentMetalsFromLines(
                          backendPreview?.result?.lines ?? [],
                        )}
                        // Bucket HECHURA puro — fallback cuando el backend no
                        // popula `monetaryBalance.components[]` con group=HECHURA.
                        // El helper deriva Σ `hechuraSale × quantity` desde las
                        // líneas (paridad línea↔documento). Passthrough puro
                        // del campo que el motor ya emitió per línea, igual
                        // patrón que `documentMetals`.
                        hechuraLines={backendPreview?.result?.lines ?? []}
                        // Etapa UX-Tax — filas síntesis del desglose
                        // monetario: passthrough EXACTO de `documentTotals`
                        // (cero recálculo). `subtotalCommercial` cierra la
                        // sección "Construcción comercial"; `taxableBase`
                        // queda destacada como la base sobre la que el
                        // motor calculó los impuestos (POLICY §Tax.1
                        // paso 11). Si el preview aún no respondió, los
                        // dos quedan undefined y el card omite las filas.
                        subtotalCommercial={backendPreview?.result?.documentTotals?.subtotalAfterLineDiscounts ?? null}
                        taxableBase={backendPreview?.result?.documentTotals?.taxableBase ?? null}
                        // "Valor bruto" del detalle financiero UNIFICADO —
                        // passthrough EXACTO de `documentTotals.subtotalBeforeDiscounts`
                        // (subtotal ANTES de descuentos). El card lo muestra al
                        // inicio del detalle (arriba de "Promociones y descuentos")
                        // SOLO en UNIFICADO, así el detalle queda auto-reconciliable:
                        // bruto − descuentos + IVA + redondeo financiero = total.
                        grossSubtotal={backendPreview?.result?.documentTotals?.subtotalBeforeDiscounts ?? null}
                        // POLICY §R-Rounding-3 — passthrough EXACTO del
                        // `documentRoundingApplied` que emite el motor en
                        // Etapa 1B. El card lo usa para distinguir
                        // "Redondeo del comprobante" (modifica el total)
                        // vs "Redondeo de lista" (ya absorbido en líneas).
                        // Cuando es `null` y aún así viene un component
                        // ROUNDING_MONETARY en el breakdown, el card lo
                        // marca como rounding de lista (informativo).
                        documentRoundingApplied={backendPreview?.result?.documentTotals?.documentRoundingApplied ?? null}
                        // Manual Adjustment Etapa A — passthrough EXACTO del
                        // engineTotal + snapshot del ajuste manual del preview.
                        // Hero usa `totalDocument` (`= finalTotal` cuando hay
                        // ajuste). El editor del card consume `manualAdjustmentDraft`
                        // (la intención del operador, persistida en el draft)
                        // y emite `onManualAdjustmentChange` que dispara un
                        // nuevo preview. POLICY §R-Rounding-9: cero matemática
                        // local — el monto del ajuste vive en `draft.manualAdjustment`,
                        // viaja en `buildSalePreviewPayload`, y vuelve como
                        // snapshot del backend para renderizar.
                        engineTotal={(backendPreview?.result as any)?.engineTotal ?? null}
                        manualAdjustment={(backendPreview?.result as any)?.manualAdjustment ?? null}
                        // Etapa 3A — campos canónicos top-level (backend Etapa 1+2).
                        // Reference aliasing: comparten objeto con los legacy. El card
                        // los prefiere; los legacy quedan como fallback. Cuando el frontend
                        // se migre completo, los legacy se eliminan.
                        manualAdjustmentSnapshot={(backendPreview?.result as any)?.manualAdjustmentSnapshot ?? null}
                        documentRoundingSnapshot={(backendPreview?.result as any)?.documentRoundingSnapshot ?? null}
                        // Etapa D' — Snapshot del redondeo COMERCIAL PER_DOCUMENT.
                        // Vive dentro de `documentTotals.commercialDocumentRoundingApplied`
                        // (mismo lugar que el SaleDocumentTotals devuelve). Cuando la
                        // lista opera en PER_LINE_LEGACY el campo es null/undefined →
                        // la sub-sección del diagnóstico muestra el placeholder legacy.
                        commercialDocumentRoundingSnapshot={
                          (backendPreview?.result as any)?.documentTotals?.commercialDocumentRoundingApplied ?? null
                        }
                        // F1 — Aplana por flatMap puro las entries del redondeo
                        // COMERCIAL PHYSICAL de todas las líneas del preview. Cada
                        // entry conserva preGrams/postGrams/deltaGrams/monetaryEquivalent
                        // del backend (cero matemática frontend — sólo concat).
                        // Cuando todas las líneas son MONETARY o no hay redondeo
                        // PHYSICAL activo, el array queda vacío y el bloque del card
                        // no se renderiza (degradación segura).
                        //
                        // El backend emite `postGrams` POR UNIDAD del metal padre.
                        // Inyectamos `quantity` desde la línea de origen para que el
                        // agregador del card (`aggregateCommercialPostGrams`) pueda
                        // escalar a gramos TOTALES del documento — paridad con el
                        // monto monetario del balance, que sí viene ya × cantidad.
                        commercialPhysicalRoundedMetals={
                          ((backendPreview?.result as any)?.lines ?? []).flatMap(
                            (ln: any) => {
                              const metals = ln?.appliedRounding?.physical?.metals ?? [];
                              const qty = ln?.quantity;
                              return metals.map((m: any) => ({ ...m, quantity: qty }));
                            },
                          )
                        }
                        // Trazabilidad de auditoría por componente: cada tooltip
                        // ⓘ del desglose reconstruye la cuenta completa
                        // (Origen · Base × regla · Impacto). Passthrough puro.
                        componentTraces={componentTraces}
                        manualAdjustmentDraft={draft.manualAdjustment ?? null}
                        onManualAdjustmentChange={(next) => {
                          // El card emite la INTENCIÓN del operador (UNIFIED
                          // o BREAKDOWN). El draft la persiste tal cual.
                          //
                          // Auto-promoción a BREAKDOWN: si el operador edita
                          // ajuste manual con scope="BREAKDOWN" y el draft NO
                          // tiene un `balanceModeOverride` explícito, lo
                          // promovemos automáticamente. Sin esto, el backend
                          // resuelve UNIFIED por jerarquía R11.4 y los guards
                          // de previewSale/confirmSale tiran 400 ("scope=
                          // BREAKDOWN no compatible con modo UNIFIED").
                          //
                          // Regla 100% reversible — el operador puede volver
                          // a UNIFIED clickeando el selector inline.
                          //
                          // Lógica encapsulada en helper PURO:
                          // `lib/sales/promoteManualAdjustmentChange.ts`.
                          onChange(promoteManualAdjustmentChange(draft, next as any));
                        }}
                        manualAdjustmentDisabled={draft.status !== "DRAFT"}
                        // Refinamiento Fase A — bloque de estado comercial
                        // al pie del card. Usa los conteos agregados por
                        // `aggregateDocumentStatus` (cero matemática nueva).
                        commercialStatus={documentCommercialStatus}
                      />
                    );
                  case "payments":
                    // FASE 8.2.3 — Cobro migrado a <PaymentCard>.
                    return (
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
                    );
                  case "account-impact":
                    // Etapa A.5 — Card "Impacto en cuenta corriente" limpio.
                    // Read-only, sin mock, sin matemática nueva: passthrough
                    // del `balanceMode`/`balanceBreakdown` del preview + draft
                    // local (`paidAmount`, `balance` ya calculado). Mientras
                    // el backend no exponga saldo previo real de CC, el card
                    // muestra una nota informativa explícita.
                    return (
                      <TPCard
                        title="Impacto en cuenta corriente"
                        bodyClassName="!p-3"
                        headerClassName="!py-2"
                        collapsible
                        open={impactOpen}
                        onOpenChange={setImpactOpen}
                      >
                        <TPSaleAccountImpactCard
                          totalDocument={effectiveTotals.total}
                          paidAmount={draft.paidAmount}
                          balancePending={balance}
                          currencyCode={
                            backendPreview?.result?.responseCurrencyCode
                              ?? backendPreview?.result?.balanceBreakdown?.monetaryBalance?.currencyCode
                          }
                          balanceMode={backendPreview?.result?.balanceMode}
                          balanceBreakdown={backendPreview?.result?.balanceBreakdown ?? null}
                        />
                      </TPCard>
                    );
                  case "observations":
                    // Observaciones / Términos / Adjuntos — integrada al
                    // aside como una card configurable más. JSX reutilizado
                    // de `observationsJsx` (mismo TPCollapse + mismos
                    // handlers; cero cambio de comportamiento ni de
                    // persistencia del comprobante).
                    return observationsJsx;
                  // Otras `CardId` (header/lines) NO viven en el slot
                  // "aside" — el filter por slot las descarta antes.
                  default:
                    return null;
                }
              };
              // Etapa 4 fix — `LayoutGridContext` es la SSOT del render
              // del aside en AMBOS modos:
              //   · readOnly={true}  (lectura) → posiciona las cards con
              //     x/y/w/h del V2 persistido, SIN handles ni DnD.
              //   · readOnly={false} (edición) → DnD XY libre + resize +
              //     previews + commit a `setLayoutV2`.
              //
              // Constraint & Balance fix — regionOriginX / regionColumns
              // se calculan DINÁMICAMENTE de las cards aside del layout
              // actual. Antes estaban hardcoded (8, 4), lo que rompía
              // CLASSIC (cards a x=7, w=5) y FOCUS (cards a x=9, w=3).
              // Ahora cada preset declara su propia anchura del aside
              // implicitamente en las posiciones de sus cards, y el
              // GridContext la respeta.
              const asideCards = invoiceLayout.layoutV2.cards
                .filter((c) => c.region === "aside");
              // Cuando el preset declara `forceSingleColumn` (CLASSIC,
              // ONE_LINE), el aside HTML se monta DEBAJO de Líneas con
              // ancho completo (asideColumnCss="1fr"). Para que las
              // cards posicionadas con coords absolutas del preset
              // (ej. CLASSIC en x=7, w=5) se vean a la derecha sobre
              // ese fondo full-width, el grid del aside tiene que ser
              // de 12 columnas también — si lo recortáramos al ancho
              // efectivo de las cards, todo se apretaría a la izquierda.
              // En TWO_COLS_FROM_TOP (COMPACT) mantenemos el cálculo
              // dinámico: el grid se ajusta al ancho del aside lateral.
              const isFullWidthAside = invoiceViewPreset.resolved.forceSingleColumn;
              const asideOriginX = isFullWidthAside
                ? 0
                : (asideCards.length > 0
                    ? Math.min(...asideCards.map((c) => c.x))
                    : 8);
              const asideMaxRight = asideCards.length > 0
                ? Math.max(...asideCards.map((c) => c.x + c.w))
                : 12;
              const asideColumns = isFullWidthAside
                ? 12
                : Math.max(1, asideMaxRight - asideOriginX);
              return (
                <LayoutGridContext
                  layout={invoiceLayout.layoutV2}
                  region="aside"
                  regionOriginX={asideOriginX}
                  regionColumns={asideColumns}
                  onLayoutChange={invoiceLayout.setLayoutV2}
                  renderCard={(id) => renderAsideCard(id)}
                  readOnly={!editLayoutMode}
                />
              );
            })()}

          </aside>

          {/* Observaciones ahora vive dentro del <aside> (último ítem por
              default) como una card más del layout configurable. El render
              hardcoded para SINGLE_COLUMN se eliminó. */}
        </div>
          );
        })()}

        {/* Panel "Validación pricing (motor)" removido de la UI de Factura
            de ventas (era un panel técnico de debug). El componente
            `SalePricingPanel`, sus tests, y los helpers asociados
            (`normalizeSalesPreview`, etc.) siguen vivos en el codebase para
            uso interno (logParity en background, debugging puntual, etc.). */}

        {/* Printable oculto — se monta para que `handlePrintDocument` pueda
            copiar su `outerHTML` a una ventana popup y disparar el print.
            Consume el template configurado en "Configuración del sistema →
            Documentos → Plantilla: Factura" + perfil real del tenant +
            datos del draft. Mantiene `aria-hidden` para no contaminar
            screen readers ni tab order; `position: fixed` fuera del viewport
            para que no afecte el layout del modal. */}
        <div
          ref={printableRef}
          aria-hidden="true"
          style={{
            position: "fixed",
            left: "-100000px",
            top:  "-100000px",
            width: `${printTemplate.pageWidthMm}mm`,
            pointerEvents: "none",
          }}
        >
          <SaleInvoicePrintable
            config={printTemplate}
            company={printCompany}
            documentNumber={draft.number || ""}
            documentDate={draft.date || ""}
            clientName={draft.clientSnapshot?.name || draft.client || ""}
            clientTaxId={
              draft.clientSnapshot?.documentNumber
                ? `${draft.clientSnapshot.documentType || "Doc"}: ${draft.clientSnapshot.documentNumber}`
                : undefined
            }
            clientAddress={draft.clientSnapshot?.address}
            lines={draft.lines}
            totals={{
              subtotal:       effectiveTotals.subtotal,
              discountAmount: effectiveTotals.discountAmount ?? 0,
              taxAmount:      effectiveTotals.taxAmount,
              total:          effectiveTotals.total,
            }}
            currencyCode={currencyDisplay}
            fxRate={typeof draft.fxRate === "number" ? draft.fxRate : 1}
            notes={draft.notes}
            terms={draft.terms}
            sellerName={undefined}
            warehouseName={whLabel !== "Sin almacén" ? whLabel : undefined}
            paymentTermName={draft.paymentTerm || undefined}
            // 1.E — Estado para decidir si renderear sello (BORRADOR / ANULADA).
            // Confirmados (PENDING/PARTIAL/PAID) imprimen limpios.
            status={draft.status}
          />
        </div>
        {/* Etapa 5 — cierre del fieldset disabled abierto justo después del
            banner READ-ONLY. */}
        </fieldset>
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

    {/* ── 1.E parte 2 + Parte 2.2 — Modal: Enviar factura por mail ──────── */}
    <SendInvoiceEmailModal
      open={emailModalOpen}
      loading={emailSending}
      // DRAFT usa Sale.code; confirmados usan Receipt.code. Paridad con
      // el filename del PDF y el watermark server-side.
      invoiceNumber={
        draft.status === "DRAFT"
          ? draft.number
          : (draft.officialNumber ?? draft.number)
      }
      status={draft.status}
      customerEmail={draft.clientSnapshot?.email ?? null}
      customerName={draft.clientSnapshot?.name ?? draft.client ?? null}
      jewelryName={printCompany.legalName || printCompany.name || null}
      invoiceDate={draft.date ?? null}
      // Parte 2.2 — plantillas tenant-wide persistidas en DocumentTemplate.
      // Si estan vacias el modal cae al default state-aware hardcoded.
      defaultSubjectTemplate={printTemplate.emailSubjectTemplate ?? null}
      defaultMessageTemplate={printTemplate.emailMessageTemplate ?? null}
      onClose={() => setEmailModalOpen(false)}
      onSubmit={handleEmailSubmit}
      onSaveAsTemplate={handleSaveEmailTemplateDefaults}
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

    {/* ── Modal: cambio de cliente con líneas cargadas ───────────────────── */}
    {/* 3 acciones. Cancelar / X / Esc / backdrop = aborto real (no muta
        nada; el header sigue mostrando el cliente anterior). */}
    {recalcPrompt.open && (
      <Modal
        open={recalcPrompt.open}
        onClose={abortClientChange}
        title="Cambiar cliente"
        maxWidth="md"
        footer={
          <div className="flex justify-end gap-2">
            <TPButton variant="ghost" onClick={abortClientChange}>
              Cancelar
            </TPButton>
            <TPButton variant="secondary" onClick={keepCurrentPricesWithNewClient}>
              Mantener precios actuales
            </TPButton>
            <TPButton variant="primary" onClick={confirmRecalcWithNewClient}>
              Recalcular precios
            </TPButton>
          </div>
        }
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <p className="text-sm text-text">
            {recalcPrompt.nextClient
              ? `Cambiaste el cliente a "${recalcPrompt.nextClient.name}". ¿Querés recalcular los precios de las líneas con la lista, condición fiscal y términos del nuevo cliente?`
              : "¿Recalcular precios con el nuevo cliente?"}
          </p>
        </div>
      </Modal>
    )}

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

    {/* Fase A — política comercial: modal de confirmación reforzada.
        Solo se abre cuando el operador toca "Crear" y el comprobante
        tiene líneas CRITICAL (margen bloqueante, precio cero, pérdida,
        etc.). NO bloquea: ofrece "Volver y revisar" o "Confirmar
        igualmente". Cero matemática — passthrough de `policy` y
        `alerts` del pricing-engine. */}
    <CommercialPolicyConfirmModal
      open={commercialModalOpen}
      onClose={() => setCommercialModalOpen(false)}
      onConfirm={acceptCommercialRisk}
      criticalLines={
        matchedNormalized.flatMap((line, idx) => {
          if (!line) return [];
          if (deriveCommercialLevel(line) !== "CRITICAL") return [];
          const draftLine = draft.lines[idx];
          // Label preferido: nombre del artículo del catálogo. Cae a
          // descripción manual y, por último, al número de línea.
          const label = draftLine?.article
            || draftLine?.manualDescription
            || draftLine?.title
            || `Línea ${idx + 1}`;
          return [{ label, line }];
        })
      }
    />

    {/* Modal de confirmacion reusable — reemplaza window.confirm para
        los 4 gates destructivos del editor (descartar cambios, cerrar
        con cambios pendientes, restaurar diseno, aplicar plantilla). */}
    {confirmDialog.dialog}
    </>
  );
}

