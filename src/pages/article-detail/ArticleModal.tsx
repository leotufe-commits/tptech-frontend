// src/pages/article-detail/ArticleModal.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ChevronDown,
  ArrowUp,
  Calculator,
  Camera,
  Check,
  DollarSign,
  ExternalLink,
  FileText,
  Gem,
  GripVertical,
  Image,
  Info,
  Layers,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Ruler,
  Save,
  Scale,
  Sliders,
  Sparkles,
  Star,
  Tag,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Modal } from "../../components/ui/Modal";
import { TPCard }       from "../../components/ui/TPCard";
import { TPField }      from "../../components/ui/TPField";
import TPInput          from "../../components/ui/TPInput";
import TPTextarea       from "../../components/ui/TPTextarea";
import TPNumberInput    from "../../components/ui/TPNumberInput";
import { TPButton }     from "../../components/ui/TPButton";
import { TPCheckbox }   from "../../components/ui/TPCheckbox";
import TPComboFixed     from "../../components/ui/TPComboFixed";
import TPComboCreatable from "../../components/ui/TPComboCreatable";
import { TPDimensionsGuide } from "../../components/ui/TPDimensionsGuide";
import TPComboCreatableMulti from "../../components/ui/TPComboCreatableMulti";
import TPNumberSelect       from "../../components/ui/TPNumberSelect";
import TPAdjTypeButton     from "../../components/ui/TPAdjTypeButton";
import TPIconButton        from "../../components/ui/TPIconButton";
import { cn } from "../../components/ui/tp";
import {
  listCatalog,
  createCatalogItem,
  setCatalogItemFavorite,
  type CatalogItem,
} from "../../services/catalogs";
import { toast } from "../../lib/toast";
import EditVariantModal from "./EditVariantModal.js";

import {
  articlesApi,
  variantLabel,
  type ArticleDetail,
  type ArticleRow,
  type ArticlePayload,
  type ArticleVariant,
  type ArticleImage,
  type ArticleComposition,
  type ArticleType,
  type ArticleStatus,
  type StockMode,
  type HechuraPriceMode,
  type BarcodeType,
  type BarcodeSource,
  type CostCalculationMode,
  type ComputedCostPrice,
  type ComputedSalePrice,
  type EffectivePriceSource,
  type VariantPayload,
  type VariantImage,
  type CompositionPayload,
  type VariantAttributeValue,
  type CostLine,
  type CostLineType,
  type QuantityUnit,
  ARTICLE_TYPE_LABELS,
  ARTICLE_STATUS_LABELS,
  STOCK_MODE_LABELS,
  HECHURA_MODE_LABELS,
  BARCODE_SOURCE_LABELS,
  BARCODE_SOURCE_DESCRIPTIONS,
  fmtMoney,
} from "../../services/articles";
import { categoriesApi, type CategoryRow, type CategoryAttribute } from "../../services/categories";
import ConfirmDeleteDialog from "../../components/ui/ConfirmDeleteDialog";
import { TPRowActions }    from "../../components/ui/TPRowActions";
// price-lists no se usa en este modal (simulación movida al backend)
import { getMetals, getVariants, getCurrencies, setFavoriteVariant, clearFavoriteVariant, type MetalVariantRow, type CurrencyRow } from "../../services/valuation";
import { taxesApi, type TaxRow } from "../../services/taxes";
import { type SalePriceResult } from "../../services/sales";
import { promotionsApi, type PromotionRow } from "../../services/promotions";
import { quantityDiscountsApi, type QuantityDiscountRow } from "../../services/quantity-discounts";
import CostCompositionTable, { type MetalVariantOption, type CurrencyOption, TYPE_OPTIONS, TYPE_CFG, applyLineAdj } from "../../components/ui/CostCompositionTable";
import {
  commercialEntitiesApi,
  type EntityRow,
  type EntityDetail as EntityDetailType,
} from "../../services/commercial-entities";
import EntityEditModal from "../configuracion-sistema/clientes/EntityEditModal";
import TPAvatarUploader from "../../components/ui/TPAvatarUploader";
import { CreateCategoryModal } from "../../components/categories/CreateCategoryModal";
import { TPAlert } from "../../components/ui/TPAlert";
import { articleMovementsApi } from "../../services/article-movements";
import { articleGroupsApi, type ArticleGroupRow } from "../../services/article-groups";
import GroupPickerField from "./GroupPickerField";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
type Tab = "principal" | "variantes";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "principal", label: "Artículo",  icon: <FileText size={13} /> },
  { key: "variantes", label: "Variantes", icon: <Layers size={13} /> },
];

// ---------------------------------------------------------------------------
// Draft
// ---------------------------------------------------------------------------
type Draft = {
  // General
  name: string;
  code: string;
  articleType: ArticleType;
  description: string;
  categoryId: string;
  groupId: string;
  brand: string;
  manufacturer: string;
  supplierCode: string;
  preferredSupplierId: string;
  unitOfMeasure: string;
  notes: string;
  status: ArticleStatus;
  stockMode: StockMode;
  // Toggles
  isFavorite: boolean;
  showInStore: boolean;
  isReturnable: boolean;
  sellWithoutVariants: boolean;
  // Barcode
  sku: string;
  barcode: string;
  barcodeType: BarcodeType;
  barcodeSource: BarcodeSource;
  autoBarcode: boolean;
  // Costos
  costCalculationMode: CostCalculationMode;
  costPrice: number | null;
  salePrice: number | null;
  useManualSalePrice: boolean;
  hechuraPrice: number | null;
  hechuraPriceMode: HechuraPriceMode;
  mermaPercent: number | null;
  multiplierBase: string;
  multiplierCurrencyId: string;
  multiplierValue: number | null;
  multiplierQuantity: number | null;
  // Costo manual — campos de desglose (persistidos en backend)
  manualBaseCost: number | null;       // costo base antes del ajuste (campo de entrada)
  manualCurrencyId: string;
  manualAdjustmentKind: "" | "BONUS" | "SURCHARGE";
  manualAdjustmentType: "" | "PERCENTAGE" | "FIXED_AMOUNT";
  manualAdjustmentValue: number | null;
  manualTaxIds: string[];
  // Avanzado
  reorderPoint: number | null;
  openingStock: number | null;
  // Dimensiones físicas
  dimensionLength: number | null;
  dimensionWidth: number | null;
  dimensionHeight: number | null;
  dimensionUnit: string;
  weight: number | null;
  weightUnit: string;
  // Cantidades de venta
  minSaleQuantity: number | null;
  maxSaleQuantity: number | null;
  defaultQuantity: number | null;
  // Contabilidad
  inventoryAccount: string;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  code: "",
  articleType: "PRODUCT",
  description: "",
  categoryId: "",
  groupId: "",
  brand: "",
  manufacturer: "",
  supplierCode: "",
  preferredSupplierId: "",
  unitOfMeasure: "",
  notes: "",
  status: "ACTIVE",
  stockMode: "NO_STOCK",
  isFavorite: false,
  showInStore: false,
  isReturnable: true,
  sellWithoutVariants: true,
  sku: "",
  barcode: "",
  barcodeType: "CODE128",
  barcodeSource: "SKU",
  autoBarcode: false,
  costCalculationMode: "METAL_MERMA_HECHURA",
  costPrice: null,
  salePrice: null,
  useManualSalePrice: false,
  hechuraPrice: null,
  hechuraPriceMode: "FIXED",
  mermaPercent: null,
  multiplierBase: "",
  multiplierCurrencyId: "",
  multiplierValue: null,
  multiplierQuantity: null,
  manualBaseCost: null,
  manualCurrencyId: "",
  manualAdjustmentKind: "",
  manualAdjustmentType: "",
  manualAdjustmentValue: null,
  manualTaxIds: [],
  reorderPoint: null,
  openingStock: null,
  dimensionLength: null,
  dimensionWidth: null,
  dimensionHeight: null,
  dimensionUnit: "cm",
  weight: null,
  weightUnit: "",
  minSaleQuantity: null,
  maxSaleQuantity: null,
  defaultQuantity: null,
  inventoryAccount: "Activo de inventario",
};

function articleToDraft(a: ArticleDetail | ArticleRow): Draft {
  return {
    name:                 a.name,
    code:                 a.code ?? "",
    articleType:          a.articleType,
    description:          a.description ?? "",
    categoryId:           a.categoryId ?? "",
    groupId:              ("groupId" in a ? (a as any).groupId : "") ?? "",
    brand:                a.brand ?? "",
    manufacturer:         a.manufacturer ?? "",
    supplierCode:         ("supplierCode" in a ? a.supplierCode : "") ?? "",
    preferredSupplierId:  a.preferredSupplierId ?? "",
    unitOfMeasure:        a.unitOfMeasure ?? "",
    notes:                ("notes" in a ? a.notes : "") ?? "",
    status:               a.status,
    stockMode:            a.stockMode,
    isFavorite:           a.isFavorite,
    showInStore:          a.showInStore,
    isReturnable:         a.isReturnable,
    sellWithoutVariants:  a.sellWithoutVariants,
    sku:                  a.sku ?? "",
    barcode:              a.barcode ?? "",
    barcodeType:          a.barcodeType,
    barcodeSource:        (a as ArticleDetail).barcodeSource ?? "SKU",
    autoBarcode:          false,
    costCalculationMode:  "METAL_MERMA_HECHURA",
    costPrice:            a.costPrice != null ? parseFloat(a.costPrice) : null,
    salePrice:            a.salePrice != null ? parseFloat(a.salePrice) : null,
    useManualSalePrice:   (a as any).useManualSalePrice ?? false,
    hechuraPrice:         a.hechuraPrice != null ? parseFloat(a.hechuraPrice) : null,
    hechuraPriceMode:     a.hechuraPriceMode,
    mermaPercent:         a.mermaPercent != null ? parseFloat(a.mermaPercent) : null,
    multiplierBase:       a.multiplierBase ?? "",
    multiplierCurrencyId: a.multiplierCurrencyId ?? "",
    multiplierValue:      a.multiplierValue != null ? parseFloat(a.multiplierValue) : null,
    multiplierQuantity:   a.multiplierQuantity != null ? parseFloat(a.multiplierQuantity) : null,
    // Campos de costo manual — reconstruidos desde backend
    manualBaseCost:         a.manualBaseCost != null ? parseFloat(a.manualBaseCost) : null,
    manualCurrencyId:       a.manualCurrencyId ?? "",
    manualAdjustmentKind:   (a.manualAdjustmentKind as "" | "BONUS" | "SURCHARGE") ?? "",
    manualAdjustmentType:   (a.manualAdjustmentType as "" | "PERCENTAGE" | "FIXED_AMOUNT") ?? "",
    manualAdjustmentValue:  a.manualAdjustmentValue != null ? parseFloat(a.manualAdjustmentValue) : null,
    manualTaxIds:           a.manualTaxIds ?? [],
    reorderPoint:         a.reorderPoint != null ? parseFloat(a.reorderPoint) : null,
    openingStock:         null, // no se edita en modo edit (bloqueado si hay movimientos)
    dimensionLength:      (a as any).dimensionLength != null ? parseFloat((a as any).dimensionLength) : null,
    dimensionWidth:       (a as any).dimensionWidth  != null ? parseFloat((a as any).dimensionWidth)  : null,
    dimensionHeight:      (a as any).dimensionHeight != null ? parseFloat((a as any).dimensionHeight) : null,
    dimensionUnit:        (a as any).dimensionUnit ?? "cm",
    weight:               (a as any).weight     != null ? parseFloat((a as any).weight)     : null,
    weightUnit:           (a as any).weightUnit ?? "",
    minSaleQuantity:      (a as any).minSaleQuantity  != null ? parseFloat((a as any).minSaleQuantity)  : null,
    maxSaleQuantity:      (a as any).maxSaleQuantity  != null ? parseFloat((a as any).maxSaleQuantity)  : null,
    defaultQuantity:      (a as any).defaultQuantity  != null ? parseFloat((a as any).defaultQuantity)  : null,
    inventoryAccount:     (a as any).inventoryAccount ?? "",
  };
}

/**
 * Normaliza líneas de costComposition venidas del backend:
 * - Prisma Decimal se serializa como string → convertir a number.
 * - HECHURA sin label → completar con texto por defecto.
 */
function defaultQuantityUnit(type: string): QuantityUnit {
  return type === "METAL" ? "g" : "u";
}

function normalizeCostLines(lines: any[]): CostLine[] {
  return (lines ?? []).map(l => ({
    ...l,
    id:           l.id ?? crypto.randomUUID(),
    quantity:     l.quantity     != null ? parseFloat(String(l.quantity))     : 0,
    quantityUnit: (l.quantityUnit ?? defaultQuantityUnit(l.type)) as QuantityUnit,
    unitValue:    l.unitValue    != null ? parseFloat(String(l.unitValue))    : 0,
    mermaPercent: l.mermaPercent != null ? parseFloat(String(l.mermaPercent)) : null,
    label:        (l.label ?? "") !== "" ? (l.label ?? "") : (l.type === "HECHURA" ? "Hechura / Mano de Obra" : ""),
    lineAdjKind:  l.lineAdjKind  ?? "",
    lineAdjType:  l.lineAdjType  ?? "",
    lineAdjValue: l.lineAdjValue != null ? parseFloat(String(l.lineAdjValue)) : null,
  }));
}

// AdjTypeButton ahora vive en src/components/ui/TPAdjTypeButton.tsx

/**
 * Calcula el costo neto (base + ajuste) para guardar en costPrice.
 * Los impuestos son puramente referenciales y NO se suman al costo guardado.
 * El campo de entrada es `manualBaseCost` (antes del ajuste).
 */
function computeManualFinalCost(d: Draft, _taxes: TaxRow[]): number | null {
  const base = d.manualBaseCost;
  if (base == null) return null;

  let adjusted = base;
  if (d.manualAdjustmentKind !== "" && d.manualAdjustmentValue != null && d.manualAdjustmentValue !== 0) {
    const absVal = Math.abs(d.manualAdjustmentValue);
    const adj = d.manualAdjustmentType === "PERCENTAGE" ? base * (absVal / 100) : absVal;
    const sign = d.manualAdjustmentKind === "SURCHARGE" ? 1 : -1;
    adjusted = base + sign * adj;
  }

  return Math.round(adjusted * 10000) / 10000;
}

function draftToPayload(d: Draft): ArticlePayload {
  return {
    name:                 d.name.trim(),
    code:                 d.code.trim() || undefined,
    articleType:          d.articleType,
    description:          d.description.trim() || undefined,
    categoryId:           d.categoryId || null,
    groupId:              d.groupId || null,
    brand:                d.brand.trim() || undefined,
    manufacturer:         d.manufacturer.trim() || undefined,
    supplierCode:         d.supplierCode.trim() || undefined,
    preferredSupplierId:  d.preferredSupplierId || null,
    unitOfMeasure:        d.unitOfMeasure.trim() || undefined,
    notes:                d.notes.trim() || undefined,
    status:               d.status,
    stockMode:            d.stockMode,
    isFavorite:           d.isFavorite,
    showInStore:          d.showInStore,
    isReturnable:         d.isReturnable,
    sellWithoutVariants:  d.sellWithoutVariants,
    sku:                  d.sku.trim() || undefined,
    barcodeSource:        d.barcodeSource,
    barcode:              d.barcodeSource === "CUSTOM" ? (d.barcode.trim() || null) : undefined,
    barcodeType:          d.barcodeType,
    autoBarcode:          d.barcodeSource === "CUSTOM" ? d.autoBarcode : undefined,
    costCalculationMode:    d.costCalculationMode,
    // En modo MANUAL, costPrice = resultado de la fórmula (base + ajuste, sin impuestos).
    // En otros modos, costPrice es el valor directo ingresado (puede ser null).
    costPrice:              d.costCalculationMode === "MANUAL"
      ? computeManualFinalCost(d, [])
      : d.costPrice,
    salePrice:              d.salePrice,
    useManualSalePrice:     d.useManualSalePrice,
    hechuraPrice:           d.hechuraPrice,
    hechuraPriceMode:       d.hechuraPriceMode,
    mermaPercent:           d.mermaPercent,
    multiplierBase:         d.multiplierBase.trim() || null,
    multiplierValue:        d.multiplierValue,
    multiplierQuantity:     d.multiplierQuantity,
    multiplierCurrencyId:   d.costCalculationMode === "MULTIPLIER" ? (d.multiplierCurrencyId || null) : null,
    // manualBaseCost solo aplica en modo MANUAL (en otros modos la base la calcula el backend).
    manualBaseCost:         d.costCalculationMode === "MANUAL" ? d.manualBaseCost : null,
    manualCurrencyId:       d.costCalculationMode === "MANUAL" ? (d.manualCurrencyId || null) : null,
    // Ajuste e impuestos: se persisten en TODOS los modos, el backend los aplica
    // sobre cualquier base calculada (COST_LINES, MULTIPLIER, METAL_MERMA_HECHURA).
    manualAdjustmentKind:   d.manualAdjustmentKind,
    manualAdjustmentType:   d.manualAdjustmentType,
    manualAdjustmentValue:  d.manualAdjustmentValue,
    manualTaxIds:           d.manualTaxIds,
    reorderPoint:           d.reorderPoint,
    openingStock:           d.openingStock,
    dimensionLength:        d.dimensionLength,
    dimensionWidth:         d.dimensionWidth,
    dimensionHeight:        d.dimensionHeight,
    dimensionUnit:          d.dimensionUnit || "cm",
    weight:                 d.weight,
    weightUnit:             d.weightUnit,
    minSaleQuantity:        d.minSaleQuantity,
    maxSaleQuantity:        d.maxSaleQuantity,
    defaultQuantity:        d.defaultQuantity,
    inventoryAccount:       d.inventoryAccount,
  };
}

// ---------------------------------------------------------------------------
// Tipos internos de generación de variantes
// ---------------------------------------------------------------------------
type GenCombo = {
  key: string;
  attrs: { assignmentId: string; axisName: string; value: string; codeExtension: string }[];
  name: string;
  code: string;
  sku: string;
  skuError?: string;
  isNew: boolean;
  isRegeneratable: boolean; // true = era existente, fue borrada en esta sesión, se puede recrear
  skuUsedExtensions: boolean; // true = todos los ejes tenían codeExtension → SKU compacto
};

// ---------------------------------------------------------------------------
// Props del modal
// ---------------------------------------------------------------------------
export type ArticleModalMode = "create" | "edit" | "clone";

export type ArticleModalProps = {
  open: boolean;
  onClose: () => void;
  /** Si viene con articleId, es modo edición */
  articleId?: string | null;
  /** Datos de clonar (pre-rellena el draft) */
  cloneData?: Partial<Draft>;
  /** Líneas de composición de costo a pre-cargar en modo clon */
  cloneCostLines?: CostLine[];
  /** Composiciones metálicas (METAL_MERMA_HECHURA) a pre-cargar en modo clon */
  cloneCompositions?: ArticleComposition[];
  /** Tipo predeterminado al crear */
  defaultType?: ArticleType;
  /** Callback tras guardar */
  onSaved?: (article: ArticleDetail) => void;
};

// ---------------------------------------------------------------------------
// Helpers para variantes
// ---------------------------------------------------------------------------

/**
 * Construye la preselección de ejes a partir de las variantes existentes.
 * Enfoque centrado en opciones: para cada opción del eje verifica si alguna
 * variante la usa. Usa exactamente la misma lógica de matching que
 * isAxisValueExisting, garantizando consistencia con los badges "En uso".
 */
function buildSelectedFromVariants(
  axes: CategoryAttribute[],
  variants: ArticleVariant[],
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const axis of axes) {
    const usedOpts: string[] = [];
    const hasPredefOptions =
      axis.definition.inputType === "BOOLEAN" || axis.definition.options.length > 0;

    if (hasPredefOptions) {
      // Para SELECT / BOOLEAN / MULTISELECT / COLOR: iterar opciones predefinidas
      const opts: { value: string }[] = axis.definition.inputType === "BOOLEAN"
        ? [{ value: "true" }, { value: "false" }]
        : axis.definition.options;
      for (const opt of opts) {
        const norm = opt.value.trim().toLowerCase();
        if (!norm) continue;
        const isUsed = variants.some(v =>
          (v.attributeValues ?? []).some(av => {
            if (av.value.trim().toLowerCase() !== norm) return false;
            return av.assignmentId === axis.id
              || av.assignment?.definition?.id === axis.definition.id;
          })
        );
        if (isUsed) usedOpts.push(opt.value);
      }
    } else {
      // Para TEXT / NUMBER / DATE / etc. sin opciones fijas: recolectar valores únicos
      // usados por las variantes existentes (preservando el case original).
      const seen = new Set<string>();
      for (const v of variants) {
        for (const av of v.attributeValues ?? []) {
          const matchesAxis =
            av.assignmentId === axis.id ||
            av.assignment?.definition?.id === axis.definition.id;
          if (!matchesAxis) continue;
          const val = av.value.trim();
          if (val && !seen.has(val.toLowerCase())) {
            seen.add(val.toLowerCase());
            usedOpts.push(val);
          }
        }
      }
    }

    // Fallback: si no se encontraron valores via attributeValues, inferir desde el nombre de la variante
    if (usedOpts.length === 0 && axis.definition.options.length > 0) {
      const axisIndex = axes.indexOf(axis);
      const seen = new Set<string>();
      for (const v of variants) {
        const parts = (v.name ?? "").split(" · ");
        const part = parts[axisIndex]?.trim();
        if (!part) continue;
        const matchedOpt = axis.definition.options.find(
          o => o.value.trim().toLowerCase() === part.toLowerCase()
            || o.label.trim().toLowerCase() === part.toLowerCase()
        );
        if (matchedOpt && !seen.has(matchedOpt.value)) {
          seen.add(matchedOpt.value);
          usedOpts.push(matchedOpt.value);
        }
      }
    }

    if (usedOpts.length > 0) result[axis.id] = usedOpts;
  }
  return result;
}

/** Devuelve la URL de imagen a mostrar para una variante (con fallback al artículo padre) */
/** Devuelve la URL de imagen a mostrar para una variante.
 *  Prioridad: galería principal → imageUrl legacy → imagen del artículo padre. */
function getVariantDisplayImage(
  variant: { imageUrl?: string; images?: { url: string; isMain: boolean }[] },
  articleMainImageUrl?: string | null,
): string | null {
  const mainFromGallery = variant.images?.find(i => i.isMain)?.url ?? variant.images?.[0]?.url;
  if (mainFromGallery) return mainFromGallery;
  if (variant.imageUrl) return variant.imageUrl;
  if (articleMainImageUrl) return articleMainImageUrl;
  return null;
}

// ---------------------------------------------------------------------------
// SortableVariantRow — fila arrastrable de la lista de variantes
// ---------------------------------------------------------------------------
interface SortableVariantRowProps {
  variant: ArticleVariant;
  axisCols: CategoryAttribute[];
  stockMode: string;
  variantStock: Record<string, number>;
  removingVar: string | null;
  articleName: string;
  articleMainImageUrl?: string;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}
function SortableVariantRow({
  variant, axisCols, stockMode, variantStock, removingVar,
  articleName, articleMainImageUrl, onEdit, onToggle, onDelete,
}: SortableVariantRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: variant.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  // Valores de ejes (lo que distingue a esta variante, e.g. "Oro Amarillo · L")
  const axisLabel = variantLabel(variant);
  // Título completo: "Nombre artículo — Oro Amarillo · L"
  const fullLabel = articleName ? `${articleName} — ${axisLabel}` : axisLabel;
  // Detección de imagen heredada del artículo padre
  const hasOwnImg = !!(variant.images?.find(i => i.isMain)?.url ?? variant.images?.[0]?.url ?? variant.imageUrl);
  const displayImg = getVariantDisplayImage(variant, articleMainImageUrl);
  const isInherited = !hasOwnImg && !!displayImg;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 transition",
        isDragging && "opacity-50 ring-1 ring-primary/50 z-50",
        !variant.isActive && "opacity-50",
      )}
    >
      {/* Drag handle */}
      <button type="button" {...attributes} {...listeners}
        className="shrink-0 cursor-grab active:cursor-grabbing text-muted/30 hover:text-muted/70 transition p-0.5 touch-none"
        title="Arrastrar para reordenar"
      >
        <GripVertical size={14} />
      </button>

      {/* Imagen de variante (thumbnail con fallback al artículo padre) */}
      <div
        className={cn(
          "shrink-0 w-8 h-8 rounded overflow-hidden bg-surface2/40 flex items-center justify-center",
          isInherited ? "border border-dashed border-border/60" : "border border-border",
        )}
        title={isInherited ? "Imagen heredada del artículo" : undefined}
      >
        {displayImg ? (
          <img src={displayImg} alt="" className={cn("w-full h-full object-cover", isInherited && "opacity-60")} />
        ) : (
          <Image size={14} className="text-muted/30" />
        )}
      </div>

      {/* Contenido principal */}
      <div className="flex-1 min-w-0">
        {/* Línea 1: Nombre completo + código + badge inactiva */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-sm text-text truncate">{fullLabel}</span>
          {variant.code && (
            <span className="font-mono text-[10px] bg-surface2 text-muted px-1.5 py-0.5 rounded shrink-0">{variant.code}</span>
          )}
          {!variant.isActive && (
            <span className="text-[10px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded shrink-0">Inactiva</span>
          )}
        </div>
        {/* Línea 2: SKU (sublínea clara debajo del nombre) */}
        {variant.sku ? (
          <p className="text-xs text-muted mt-0.5 font-mono">SKU: {variant.sku}</p>
        ) : (
          <p className="text-xs text-amber-500/80 mt-0.5 italic">Sin SKU</p>
        )}
        {/* Imagen heredada */}
        {isInherited && (
          <p className="text-[10px] text-muted/50 italic mt-0.5">Imagen del artículo</p>
        )}
        {/* Chips de ejes (refuerzo visual de los valores) */}
        {axisCols.length > 0 && (
          <div className="flex gap-1 mt-0.5 flex-wrap">
            {axisCols.map(ax => {
              const av = (variant.attributeValues ?? []).find((a: VariantAttributeValue) => a.assignmentId === ax.id);
              return av?.value ? (
                <span key={ax.id} className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">
                  {ax.definition.name}: {av.value}
                </span>
              ) : null;
            })}
          </div>
        )}
      </div>

      {/* Precio / Stock / Reposición (solo desktop) */}
      {(variant.priceOverride || (stockMode === "BY_ARTICLE" && variantStock[variant.id] != null) || (variant.reorderPoint && Number(variant.reorderPoint) > 0)) && (
        <div className="hidden sm:flex flex-col items-end text-xs text-muted shrink-0 gap-0.5">
          {variant.priceOverride && (
            <span className="tabular-nums font-medium text-text">{fmtMoney(variant.priceOverride)}</span>
          )}
          {stockMode === "BY_ARTICLE" && variantStock[variant.id] != null && (
            <span className="tabular-nums text-[10px]">
              Stock: {Number(variantStock[variant.id]).toLocaleString("es-AR")}
            </span>
          )}
          {variant.reorderPoint && Number(variant.reorderPoint) > 0 && (
            <span className="tabular-nums text-[10px] text-amber-500/80" title="Punto de reposición">
              Repos.: {Number(variant.reorderPoint).toLocaleString("es-AR")}
            </span>
          )}
        </div>
      )}

      {/* Acciones — patrón estándar TPRowActions */}
      <TPRowActions
        onEdit={onEdit}
        onToggle={onToggle}
        isActive={variant.isActive}
        busyDelete={removingVar === variant.id}
        onDelete={onDelete}
        deleteTitle="Eliminar variante"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortableChip — chip arrastrable para ordenar opciones seleccionadas por eje
// ---------------------------------------------------------------------------
function SortableChip({
  id, label, onRemove, existing,
}: {
  id: string;
  label: string;
  onRemove?: () => void;
  /** true → el valor ya tiene variante creada; aplica estilo verde */
  existing?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium select-none",
        existing
          ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-400"
          : "border-primary/40 bg-primary/10 text-primary",
        isDragging && "opacity-50 ring-1 ring-primary",
      )}
    >
      <button type="button" {...attributes} {...listeners}
        className={cn(
          "cursor-grab active:cursor-grabbing transition touch-none p-0",
          existing ? "text-emerald-400/40 hover:text-emerald-400/80" : "text-primary/40 hover:text-primary/80"
        )}
        title="Arrastrar para reordenar"
      >
        <GripVertical size={11} />
      </button>
      {label}
      {existing && (
        <span className="rounded bg-emerald-500/20 px-1 leading-tight text-[10px]">Creada</span>
      )}
      {onRemove && (
        <button type="button" onClick={onRemove}
          className="ml-0.5 text-primary/50 hover:text-red-400 transition p-0"
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Constantes de estilos de líneas de costo (módulo-level para reutilización)
// ---------------------------------------------------------------------------
const COST_ROW_BG: Record<string, string> = {
  METAL:   "bg-amber-500/5  hover:bg-amber-500/10",
  HECHURA: "bg-blue-500/5   hover:bg-blue-500/10",
  PRODUCT: "bg-violet-500/5 hover:bg-violet-500/10",
  SERVICE: "bg-green-500/5  hover:bg-green-500/10",
};

// ---------------------------------------------------------------------------
// Fila sortable de línea de costo (necesita useSortable → componente separado)
// ---------------------------------------------------------------------------
function SortableCostLineRow({
  id, type, children,
}: {
  id: string;
  type: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        "transition-colors group",
        COST_ROW_BG[type] ?? "hover:bg-surface2/30",
        isDragging && "opacity-40 shadow-lg z-10",
      )}
    >
      {/* Handle */}
      <td className="px-2 py-1.5 align-middle w-6">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted/25 hover:text-muted/60 transition touch-none"
          title="Arrastrar para reordenar"
        >
          <GripVertical size={13} />
        </button>
      </td>
      {children}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function ArticleModal({
  open,
  onClose,
  articleId,
  cloneData,
  cloneCostLines,
  cloneCompositions,
  defaultType,
  onSaved,
}: ArticleModalProps) {
  const navigate  = useNavigate();
  const isEdit    = Boolean(articleId);
  const isClone   = Boolean(cloneData && !articleId);

  /* ── DnD sensors (variants + axis chips) ─────────────────────────────── */
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  /* ── tab ─────────────────────────────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState<Tab>("principal");

  /* ── article cargado ─────────────────────────────────────────────────── */
  const [article,   setArticle]   = useState<ArticleDetail | null>(null);
  const [loading,   setLoading]   = useState(false);

  /* ── draft ───────────────────────────────────────────────────────────── */
  const [draft, setDraft]         = useState<Draft>({ ...EMPTY_DRAFT });
  const [submitted, setSubmitted] = useState(false);
  const [busySave,  setBusySave]  = useState(false);
  const [draftChanged,  setDraftChanged]  = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  /* ── modal avanzado de identificación ───────────────────────────────── */
  const [advancedModalOpen, setAdvancedModalOpen] = useState(false);
  const [showNoPriceWarning, setShowNoPriceWarning] = useState(false);

  /* ── secciones colapsables — acordeón: solo una abierta a la vez ──────── */
  type AccordionSection = "stock" | "comercial" | "medidas" | "notas" | null;
  const [openSection, setOpenSection] = useState<AccordionSection>(null);
  const toggleSection = (s: Exclude<AccordionSection, null>) =>
    setOpenSection(prev => (prev === s ? null : s));
  const stockOpen     = openSection === "stock";
  const comercialOpen = openSection === "comercial";
  const medidasOpen   = openSection === "medidas";
  const notasOpen     = openSection === "notas";
  const [unitPickerOpen, setUnitPickerOpen] = useState<string | null>(null);
  const [unitPickerPos, setUnitPickerPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 120 });

  /* ── pickers ─────────────────────────────────────────────────────────── */
  const [categories,   setCategories]   = useState<CategoryRow[]>([]);
  const [groups,       setGroups]       = useState<ArticleGroupRow[]>([]);
  const [createCatOpen, setCreateCatOpen] = useState(false);
  const [suppliers,    setSuppliers]    = useState<EntityRow[]>([]);
  const [metalVariants, setMetalVariants] = useState<MetalVariantRow[]>([]);
  const [productItems,  setProductItems]  = useState<{ id: string; name: string; sku: string; stock: number | null; costPrice: number | null; costPriceNative: number | null; manualCurrencyId: string | null }[]>([]);
  const [serviceItems,  setServiceItems]  = useState<{ id: string; name: string; sku: string; stock: number | null; costPrice: number | null; costPriceNative: number | null; manualCurrencyId: string | null }[]>([]);

  /* ── catálogos comerciales ────────────────────────────────────────────── */
  const [brandItems,           setBrandItems]           = useState<CatalogItem[]>([]);
  const [manufacturerItems,    setManufacturerItems]    = useState<CatalogItem[]>([]);
  const [unitItems,            setUnitItems]            = useState<CatalogItem[]>([]);
  const [multiplierBaseItems,  setMultiplierBaseItems]  = useState<CatalogItem[]>([]);
  const [weightUnitItems,      setWeightUnitItems]      = useState<CatalogItem[]>([]);

  /* ── Valores predeterminados para nuevos artículos (estrellita) ─────── */
  const [defaultArticleType, setDefaultArticleType] = useState<ArticleType | null>(
    () => (localStorage.getItem("tptech_default_article_type") as ArticleType | null)
  );
  const [defaultStockMode,  setDefaultStockMode]  = useState<StockMode | null>(
    () => (localStorage.getItem("tptech_default_stock_mode") as StockMode | null)
  );
  const [defaultStatus,     setDefaultStatus]     = useState<ArticleStatus | null>(
    () => (localStorage.getItem("tptech_default_status") as ArticleStatus | null)
  );
  const [defaultInventory,  setDefaultInventory]  = useState<string | null>(
    () => localStorage.getItem("tptech_default_inventory_account")
  );
  const [defaultAdjType, setDefaultAdjType] = useState<string | null>(
    () => localStorage.getItem("tptech_default_adj_type")
  );
  function handleSetDefaultAdjType(val: string) {
    if (defaultAdjType === val) { localStorage.removeItem("tptech_default_adj_type"); setDefaultAdjType(null); }
    else { localStorage.setItem("tptech_default_adj_type", val); setDefaultAdjType(val); }
  }
  function handleSetDefaultArticleType(val: string) {
    if (defaultArticleType === val) { localStorage.removeItem("tptech_default_article_type"); setDefaultArticleType(null); }
    else { localStorage.setItem("tptech_default_article_type", val); setDefaultArticleType(val as ArticleType); }
  }
  function handleSetDefaultStockMode(val: string) {
    if (defaultStockMode === val) { localStorage.removeItem("tptech_default_stock_mode"); setDefaultStockMode(null); }
    else { localStorage.setItem("tptech_default_stock_mode", val); setDefaultStockMode(val as StockMode); }
  }
  function handleSetDefaultStatus(val: string) {
    if (defaultStatus === val) { localStorage.removeItem("tptech_default_status"); setDefaultStatus(null); }
    else { localStorage.setItem("tptech_default_status", val); setDefaultStatus(val as ArticleStatus); }
  }
  function handleSetDefaultInventory(val: string) {
    if (defaultInventory === val) { localStorage.removeItem("tptech_default_inventory_account"); setDefaultInventory(null); }
    else { localStorage.setItem("tptech_default_inventory_account", val); setDefaultInventory(val); }
  }
  const [defaultShowInStore, setDefaultShowInStore] = useState<boolean | null>(
    () => { const v = localStorage.getItem("tptech.articleDefaults.showInStore"); return v === null ? null : v === "true"; }
  );
  const [defaultIsReturnable, setDefaultIsReturnable] = useState<boolean | null>(
    () => { const v = localStorage.getItem("tptech.articleDefaults.isReturnable"); return v === null ? null : v === "true"; }
  );
  function handleSetDefaultShowInStore(val: boolean) {
    if (defaultShowInStore === val) { localStorage.removeItem("tptech.articleDefaults.showInStore"); setDefaultShowInStore(null); }
    else { localStorage.setItem("tptech.articleDefaults.showInStore", String(val)); setDefaultShowInStore(val); }
  }
  function handleSetDefaultIsReturnable(val: boolean) {
    if (defaultIsReturnable === val) { localStorage.removeItem("tptech.articleDefaults.isReturnable"); setDefaultIsReturnable(null); }
    else { localStorage.setItem("tptech.articleDefaults.isReturnable", String(val)); setDefaultIsReturnable(val); }
  }
  /* ── modal nuevo proveedor (modal real del sistema) ──────────────────── */
  const [newSupplierModalOpen, setNewSupplierModalOpen] = useState(false);

  /* ── computed cost / sale price ─────────────────────────────────────── */
  const [computed,           setComputed]           = useState<ComputedCostPrice | null>(null);
  const [computedSale,       setComputedSale]        = useState<ComputedSalePrice | null>(null);
  const [effectiveSource,    setEffectiveSource]     = useState<EffectivePriceSource | null>(null);
  const [effectivePrice,     setEffectivePrice]      = useState<string | null>(null);
  const [loadingCost,        setLoadingCost]         = useState(false);

  /* ── cost composition (nueva arquitectura de líneas) ─────────────────── */
  const [costLines,      setCostLines]      = useState<CostLine[]>([]);
  const [confirmDropIdx, setConfirmDropIdx] = useState<number | null>(null);
  const [currencies,   setCurrencies]   = useState<CurrencyRow[]>([]);
  const [taxes,        setTaxes]        = useState<TaxRow[]>([]);

  /* ── variantes ───────────────────────────────────────────────────────── */
  const [variants,      setVariants]      = useState<ArticleVariant[]>([]);
  /* stock por variantId: { variantId → totalQuantity } — se carga en modo edición */
  const [variantStock,  setVariantStock]  = useState<Record<string, number>>({});
  const [varModal,      setVarModal]      = useState(false);
  const [varEditId,     setVarEditId]     = useState<string | null>(null);
  const [varDraft,      setVarDraft]      = useState<VariantPayload>({ code: "", name: "" });
  const [busyVar,       setBusyVar]       = useState(false);
  const [removingVar,   setRemovingVar]   = useState<string | null>(null);
  /* ejes de variante: atributos con isVariantAxis=true de la categoría */
  const [variantAxes,     setVariantAxes]     = useState<CategoryAttribute[]>([]);
  /* atributos normales del artículo: isVariantAxis=false */
  const [artAttrs,        setArtAttrs]        = useState<CategoryAttribute[]>([]);
  /* valores de atributos del artículo (indexados por assignmentId) */
  const [artAttrValues,   setArtAttrValues]   = useState<Record<string, string>>({});
  /* valores de atributos en el mini-modal de variante */
  const [varAttrValues,   setVarAttrValues]   = useState<Record<string, string>>({});
  /* id de variante pendiente de eliminar (confirmar) */
  const [deleteVariantId, setDeleteVariantId] = useState<string | null>(null);
  /* ── generación automática de variantes (inline en tab Variantes) ──────── */
  /* modo SKU: manual (el usuario lo escribe) o auto (se genera desde article.sku o code) */
  const [genSkuMode,  setGenSkuMode]  = useState<"manual" | "auto">("auto");
  /* valores seleccionados por eje: { axisId: ["val1","val2",...] } */
  const [genSelected, setGenSelected] = useState<Record<string, string[]>>({});
  /* input libre actual por eje (para ejes TEXT/NUMBER) */
  const [genTagInput, setGenTagInput] = useState<Record<string, string>>({});
  /* combinaciones calculadas para el preview */
  const [genCombos,   setGenCombos]   = useState<GenCombo[]>([]);
  const [genBusy,     setGenBusy]     = useState(false);
  const [removeComboAlert, setRemoveComboAlert] = useState<string | null>(null);
  /* variantes borradas en esta sesión: combo-key → variantId (para badge "Regenerable" y restauración) */
  const [deletedVariants, setDeletedVariants] = useState<Map<string, string>>(new Map());
  /* variantes soft-deleted cargadas del backend (para regeneración entre sesiones) */
  const [rawDeletedVariants, setRawDeletedVariants] = useState<ArticleVariant[]>([]);

  /* ── composiciones ───────────────────────────────────────────────────── */
  const [compositions, setCompositions] = useState<ArticleComposition[]>([]);

  /* ── existencia de apertura ───────────────────────────────────────────── */
  const [hasMovements, setHasMovements] = useState(false);

  /* ── imágenes ─────────────────────────────────────────────────────────── */
  const [images,            setImages]           = useState<ArticleImage[]>([]);
  const [busyImg,           setBusyImg]          = useState(false);
  const [busyAddImg,        setBusyAddImg]       = useState(false);
  const [removingImg,       setRemovingImg]      = useState<string | null>(null);
  /** Imágenes pendientes en modo create (aún sin articleId). El índice 0 es la principal. */
  const [pendingImages, setPendingImages] = useState<{ file: File; url: string }[]>([]);
  const addImgInputRef = useRef<HTMLInputElement>(null);
  const skuInputRef    = useRef<HTMLInputElement>(null);
  /** Imágenes pendientes en el mini-modal de variante (modo CREATE, hasta 5, se suben al guardar). */
  const [pendingVarImages,        setPendingVarImages]        = useState<File[]>([]);
  const [pendingVarImagePreviews, setPendingVarImagePreviews] = useState<string[]>([]);
  /** Map draftId → File para imágenes pendientes de variantes en modo create-article. */
  const pendingVariantImagesRef = useRef<Map<string, File>>(new Map());

  /* ── carga de ejes de variante ────────────────────────────────────────── */
  const [variantAxesLoading, setVariantAxesLoading] = useState(false);

  /** Recuerda el último "Tipo de valor" elegido para restaurarlo al activar un nuevo ajuste */
  const lastAdjTypeRef = useRef<"PERCENTAGE" | "FIXED_AMOUNT">("PERCENTAGE");
  /** Flag: loadCatalogArticles ya completó en esta apertura (ref porque no necesita trigger) */
  const catalogLoadedRef = useRef(false);
  /** Hash de los ejes para los que ya corrió la preselección (evita repetir si no cambiaron los ejes) */
  const preselectedAxesHashRef = useRef<string>("");
  const handleSaveInFlightRef  = useRef(false); // evita doble-submit por doble-click

  /**
   * Mirrors síncronos de los catálogos para uso dentro de fetchArticle,
   * evitando la race condition donde los catálogos cargan antes que el artículo
   * y el efecto de sincronización no puede re-ejecutarse.
   */
  const metalVariantsRef = useRef<MetalVariantRow[]>([]);
  const currenciesRef    = useRef<CurrencyRow[]>([]);
  const productItemsRef  = useRef<{ id: string; name: string; sku: string; stock: number | null; costPrice: number | null; costPriceNative: number | null; manualCurrencyId: string | null }[]>([]);
  const serviceItemsRef  = useRef<{ id: string; name: string; sku: string; stock: number | null; costPrice: number | null; costPriceNative: number | null; manualCurrencyId: string | null }[]>([]);

  // ── reset al abrir/cerrar ──────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      // Limpiar al cerrar (con delay para evitar flash)
      const t = setTimeout(() => {
        setActiveTab("principal");
        setArticle(null);
        const lastMode = (() => {
          try { return localStorage.getItem("tptech_last_cost_mode") as CostCalculationMode | null; } catch { return null; }
        })();
        const lastStockMode = (() => {
          try { return localStorage.getItem("tptech_last_stock_mode") as StockMode | null; } catch { return null; }
        })();
        setDraft({
          ...EMPTY_DRAFT,
          ...(lastMode ? { costCalculationMode: lastMode } : {}),
          ...(lastStockMode ? { stockMode: lastStockMode } : {}),
        });
        setSubmitted(false);
        setShowNoPriceWarning(false);
        setAdvancedModalOpen(false);
        setVariants([]);
        setVariantStock({});
        setVariantAxes([]);
        setArtAttrs([]);
        setArtAttrValues({});
        setVarAttrValues({});
        setDeleteVariantId(null);
        preselectedAxesHashRef.current = "";
        setGenSelected({});
        setGenTagInput({});
        setGenCombos([]);
        setDeletedVariants(new Map());
        setRawDeletedVariants([]);
        setDraftChanged(false);
        setShowUnsavedDialog(false);
        setImages([]);
        setBusyAddImg(false);
        setPendingImages(prev => { prev.forEach(p => URL.revokeObjectURL(p.url)); return []; });
        setVariantAxesLoading(false);
        setCompositions([]);
        setHasMovements(false);
        setPendingVarImages([]);
        setPendingVarImagePreviews(prev => { prev.forEach(URL.revokeObjectURL); return []; });
        pendingVariantImagesRef.current.clear();
        setComputed(null);
        setComputedSale(null);
        setEffectiveSource(null);
        setEffectivePrice(null);
        setCostLines([]);
      }, 300);
      return () => clearTimeout(t);
    }

    // Cargar pickers comunes
    void loadCategories();
    void loadGroups();
    void loadSuppliers();
    void loadMetalVariants();
    void loadCatalogArticles();
    void loadCurrencies();
    void loadTaxes();

    if (articleId) {
      // Modo edición: solo necesitamos los items para el dropdown
      // Resetear preselección al abrir nueva sesión (por si el timer de cierre no corrió aún)
      preselectedAxesHashRef.current = "";
      setDeletedVariants(new Map());
      void loadBrandItems();
      void loadManufacturerItems();
      void loadUnitItems();
      void loadMultiplierBaseItems();
      void fetchArticle(articleId);
      // Verificar si el artículo ya tiene movimientos (para bloquear apertura)
      articleMovementsApi.list({ articleId, pageSize: 1 })
        .then(r => setHasMovements(r.total > 0))
        .catch(() => setHasMovements(false));
    } else {
      // Modo crear / clonar
      const base: Draft = { ...EMPTY_DRAFT };
      if (defaultType) base.articleType = defaultType;
      if (cloneData) {
        Object.assign(base, cloneData);
      } else {
        const savedBarcode = localStorage.getItem("tptech.article.barcodeSource.last");
        if (savedBarcode === "SKU" || savedBarcode === "CODE" || savedBarcode === "CUSTOM") {
          base.barcodeSource = savedBarcode as BarcodeSource;
        }
        const savedStockMode = localStorage.getItem("tptech_last_stock_mode") as StockMode | null;
        if (savedStockMode) base.stockMode = savedStockMode;
        // Predeterminados con estrellita — tienen prioridad sobre "último usado"
        const defStockMode = localStorage.getItem("tptech_default_stock_mode") as StockMode | null;
        if (defStockMode) base.stockMode = defStockMode;
        const defStatus = localStorage.getItem("tptech_default_status") as ArticleStatus | null;
        if (defStatus) base.status = defStatus;
        const defInventory = localStorage.getItem("tptech_default_inventory_account");
        if (defInventory !== null) base.inventoryAccount = defInventory;
        // Modo de costo siempre METAL_MERMA_HECHURA (modelo unificado)
        const defAdjType = localStorage.getItem("tptech_default_adj_type");
        if (defAdjType) base.manualAdjustmentType = defAdjType as "PERCENTAGE" | "FIXED_AMOUNT";
        const defShowInStore = localStorage.getItem("tptech.articleDefaults.showInStore");
        if (defShowInStore !== null) base.showInStore = defShowInStore === "true";
        const defIsReturnable = localStorage.getItem("tptech.articleDefaults.isReturnable");
        if (defIsReturnable !== null) base.isReturnable = defIsReturnable === "true";
      }
      setDraft(base);
      // En modo clon: pre-cargar líneas de costo y composiciones metálicas
      if (cloneData) {
        setCostLines(cloneCostLines ?? []);
        setCompositions(cloneCompositions ?? []);
      }
      // Cargar catálogos y pre-seleccionar favoritos en el draft
      void loadCatalogItemsWithDefaults();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, articleId]);

  /* ── Sincronización de precios METAL con la cotización vigente ───────────
     Corre cada vez que metalVariants o currencies cambian (incluyendo recargas
     por tptech:valuation-changed). Usa setter funcional para leer costLines sin
     necesidad de agregarlo a las deps. Idempotente: si el valor no cambió
     más de 0.005, retorna la misma referencia de línea. */
  useEffect(() => {
    if (!open) {
      catalogLoadedRef.current = false;
      return;
    }
    if (!articleId) return; // solo en modo edición
    if (metalVariants.length === 0 || currencies.length === 0) return;
    setCostLines(prev => {
      if (!prev.some(l => l.type === "METAL" && l.metalVariantId)) return prev;
      const baseCurr   = currencies.find(c => c.isBase);
      const baseCurrId = baseCurr?.id ?? "";
      return prev.map(line => {
        if (line.type !== "METAL" || !line.metalVariantId) return line;
        const mv = metalVariants.find(m => m.id === line.metalVariantId);
        if (mv?.finalSalePrice == null) return line;
        let newVal = Number(mv.finalSalePrice);
        if (line.currencyId && line.currencyId !== baseCurrId) {
          const curr = currencies.find(c => c.id === line.currencyId);
          if (curr?.latestRate) newVal = Math.round((newVal / curr.latestRate) * 10000) / 10000;
        }
        if (Math.abs(newVal - (line.unitValue ?? 0)) < 0.005) return line;
        return { ...line, unitValue: newVal };
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, articleId, metalVariants, currencies]);

  /* ── Sincronización de precios PRODUCTO/SERVICIO con el catálogo vigente ──
     Corre cada vez que productItems, serviceItems o currencies cambian.
     Espera a que loadCatalogArticles haya completado (catalogLoadedRef).
     Idempotente: si el precio no cambió más de 0.005, retorna la misma línea. */
  useEffect(() => {
    if (!open || !articleId) return;
    if (currencies.length === 0) return;
    if (!catalogLoadedRef.current) return; // catálogo aún no terminó de cargar

    setCostLines(prev => {
      if (!prev.some(l => (l.type === "PRODUCT" || l.type === "SERVICE") && l.catalogItemId)) return prev;
      const baseCurr   = currencies.find(c => c.isBase);
      const baseCurrId = baseCurr?.id ?? "";
      return prev.map(line => {
        if (line.type !== "PRODUCT" && line.type !== "SERVICE") return line;
        if (!line.catalogItemId) return line;
        const pool = line.type === "PRODUCT" ? productItems : serviceItems;
        const ref  = pool.find(i => i.id === line.catalogItemId);
        if (ref?.costPrice == null) return line;
        let newVal = Number(ref.costPrice);
        if (line.currencyId && line.currencyId !== baseCurrId) {
          const curr = currencies.find(c => c.id === line.currencyId);
          if (curr?.latestRate) newVal = Math.round((newVal / curr.latestRate) * 10000) / 10000;
        }
        if (Math.abs(newVal - (line.unitValue ?? 0)) < 0.005) return line;
        return { ...line, unitValue: newVal };
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, articleId, productItems, serviceItems, currencies]);

  /* ── Sincronización en vivo al cambiar valuación ──────────────────────────
     Al recibir tptech:valuation-changed se recargan metalVariants y currencies.
     Como los efectos de sincronización ya no tienen guard de "una vez", el cambio
     en esas variables dispara automáticamente la actualización de costLines. */
  useEffect(() => {
    if (!open) return;
    function onValuationChanged() {
      // Recargar metales y divisas (cambian directamente con la valuación).
      void loadMetalVariants();
      void loadCurrencies();
      // Recargar catálogo: los PRODUCT/SERVICE con composición de metal tienen
      // computedCostBase que depende de las cotizaciones → deben recalcularse.
      void loadCatalogArticles();
    }
    window.addEventListener("tptech:valuation-changed", onValuationChanged);
    return () => window.removeEventListener("tptech:valuation-changed", onValuationChanged);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* ── Sincronización en vivo al guardar un artículo referenciado ────────────
     Al recibir tptech:article-cost-changed se recarga el catálogo de productos
     y servicios. El useEffect de sincronización de PRODUCT/SERVICE reacciona
     automáticamente al cambio en productItems/serviceItems. */
  useEffect(() => {
    if (!open) return;
    function onArticleCostChanged() {
      void loadCatalogArticles();
    }
    window.addEventListener("tptech:article-cost-changed", onArticleCostChanged);
    return () => window.removeEventListener("tptech:article-cost-changed", onArticleCostChanged);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function fetchArticle(id: string) {
    setLoading(true);
    try {
      const data = await articlesApi.getOne(id);
      setArticle(data);
      const d = articleToDraft(data);
      setDraft(d);
      setVariants(data.variants ?? []);
      setImages(data.images ?? []);
      setCompositions(data.compositions ?? []);
      // Inicializar valores de atributos del artículo
      const avMap: Record<string, string> = {};
      (data.attributeValues ?? []).forEach(av => { avMap[av.assignmentId] = av.value; });
      setArtAttrValues(avMap);
      if (data.computedCostPrice) setComputed(data.computedCostPrice);
      if (data.computedSalePrice) setComputedSale(data.computedSalePrice);
      if (data.effectiveSalePrice !== undefined) setEffectivePrice(data.effectiveSalePrice ?? null);
      if (data.effectivePriceSource) setEffectiveSource(data.effectivePriceSource);
      // Aplicar precios vivos inmediatamente si los catálogos ya cargaron.
      // Resuelve la race condition: los loaders (metals, catalog, currencies)
      // corren en paralelo con fetchArticle. Si terminan antes, el efecto de
      // sincronización se ejecuta con costLines=[] y no puede hacer nada.
      // Cuando fetchArticle termina, sus deps no cambiaron → efecto no re-corre.
      // Con los refs siempre actualizados, aplicamos el precio vigente ahora.
      let parsedLines = normalizeCostLines(data.costComposition ?? []);
      // Auto-migrar artículos con modos MANUAL o MULTIPLIER al modelo unificado.
      // Si el artículo no tiene líneas de composición, generar una línea HECHURA sintética.
      if (parsedLines.length === 0 && data.costCalculationMode !== "METAL_MERMA_HECHURA") {
        if (data.costCalculationMode === "MANUAL" && data.manualBaseCost != null) {
          const base = parseFloat(String(data.manualBaseCost));
          if (base > 0) {
            parsedLines = [{ type: "HECHURA" as const, label: "Hechura / Mano de Obra", quantity: 1, quantityUnit: "u" as const, unitValue: base, currencyId: (data as any).manualCurrencyId || null, mermaPercent: null, metalVariantId: null, sortOrder: 0, lineAdjKind: "", lineAdjType: "", lineAdjValue: null }];
          }
        } else if (data.costCalculationMode === "MULTIPLIER" && data.multiplierQuantity != null && data.multiplierValue != null) {
          const qty = parseFloat(String(data.multiplierQuantity));
          const val = parseFloat(String(data.multiplierValue));
          if (qty > 0 && val > 0) {
            parsedLines = [{ type: "HECHURA" as const, label: "Hechura / Mano de Obra", quantity: qty, quantityUnit: "u" as const, unitValue: val, currencyId: (data as any).multiplierCurrencyId || null, mermaPercent: null, metalVariantId: null, sortOrder: 0, lineAdjKind: "", lineAdjType: "", lineAdjValue: null }];
          }
        }
      }
      const variants   = metalVariantsRef.current;
      const currList   = currenciesRef.current;
      const hasMeta    = variants.length > 0 && currList.length > 0;
      const hasCatalog = productItemsRef.current.length > 0 || serviceItemsRef.current.length > 0;

      const syncedLines = (hasMeta || hasCatalog)
        ? (() => {
            const baseCurr   = currList.find(c => c.isBase);
            const baseCurrId = baseCurr?.id ?? "";
            return parsedLines.map(line => {
              // ── METAL ──────────────────────────────────────────────────────
              if (line.type === "METAL" && line.metalVariantId && hasMeta) {
                const mv = variants.find(m => m.id === line.metalVariantId);
                if (mv?.finalSalePrice == null) return line;
                let newVal = Number(mv.finalSalePrice);
                if (line.currencyId && line.currencyId !== baseCurrId) {
                  const curr = currList.find(c => c.id === line.currencyId);
                  if (curr?.latestRate) newVal = Math.round((newVal / curr.latestRate) * 10000) / 10000;
                }
                return { ...line, unitValue: newVal };
              }
              // ── PRODUCT / SERVICE ──────────────────────────────────────────
              // Fuente: computedCostBase del artículo referenciado (sin impuestos,
              // en moneda base). Evita doble carga de impuestos en composiciones.
              if ((line.type === "PRODUCT" || line.type === "SERVICE") && line.catalogItemId && hasCatalog) {
                const pool = line.type === "PRODUCT" ? productItemsRef.current : serviceItemsRef.current;
                const ref  = pool.find(i => i.id === line.catalogItemId);
                if (ref?.costPrice == null) return line;
                let newVal = Number(ref.costPrice);
                if (line.currencyId && line.currencyId !== baseCurrId && currList.length > 0) {
                  const curr = currList.find(c => c.id === line.currencyId);
                  if (curr?.latestRate) newVal = Math.round((newVal / curr.latestRate) * 10000) / 10000;
                }
                return { ...line, unitValue: newVal };
              }
              return line;
            });
          })()
        : parsedLines;
      setCostLines(syncedLines);

      // Cargar variantes soft-deleted para badge "Regenerable" entre sesiones
      articlesApi.variants.listDeleted(id)
        .then(deleted => setRawDeletedVariants(deleted))
        .catch(() => {});

      // Cargar stock por variante (artículos BY_ARTICLE con variantes)
      if (data.stockMode === "BY_ARTICLE") {
        articlesApi.stock.get(id)
          .then((stockRows) => {
            const map: Record<string, number> = {};
            for (const row of stockRows) {
              if (row.variantId) {
                map[row.variantId] = (map[row.variantId] ?? 0) + Number(row.quantity ?? 0);
              }
            }
            setVariantStock(map);
          })
          .catch(() => {});
      }
    } catch (e: any) {
      toast.error(e?.message || "No se pudo cargar el artículo. Intentá cerrar y volver a abrir.");
      onClose();
    } finally {
      setLoading(false);
    }
  }

  // Cargar ejes de variante (isVariantAxis=true) cada vez que cambia la categoría
  useEffect(() => {
    if (!draft.categoryId) { setVariantAxes([]); return; }
    void loadVariantAxes(draft.categoryId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.categoryId]);

  async function loadVariantAxes(categoryId: string) {
    setVariantAxesLoading(true);
    try {
      const all = await categoriesApi.attributes.getEffective(categoryId);
      // Filtrar atributos con definition faltante (relación rota en DB)
      const valid = (all ?? []).filter(a => {
        if (!a.definition) {
          console.warn("[TPTech] Atributo ignorado — definition null/undefined. assignmentId:", a.id);
          return false;
        }
        return true;
      });
      const axes = valid.filter(a => a.isVariantAxis);
      const attrs = valid.filter(a => !a.isVariantAxis);
      // Resetear la preselección para que re-corra con los ejes frescos
      preselectedAxesHashRef.current = "";
      setVariantAxes(axes);
      setArtAttrs(attrs);
    } catch (e) {
      console.error("[TPTech] Error al cargar atributos de categoría:", e);
      setVariantAxes([]);
      setArtAttrs([]);
    } finally {
      setVariantAxesLoading(false);
    }
  }

  // Si la categoría cambia y ya no tiene ejes, redirigir al tab principal
  useEffect(() => {
    if (activeTab === "variantes" && !variantAxesLoading && variantAxes.length === 0 && variants.length === 0) {
      setActiveTab("principal");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantAxes.length, variantAxesLoading]);

  // En edición: pre-seleccionar en el configurador los valores de variantes ya existentes.
  // Hash basado solo en IDs de ejes: corre una vez por configuración de ejes, independiente
  // de si attributeValues está vacío (evita que el hash quede "bloqueado" con datos parciales).
  useEffect(() => {
    if (!isEdit || variantAxes.length === 0 || variants.length === 0) return;
    const axesHash = variantAxes.map(a => a.id).join("|");
    if (preselectedAxesHashRef.current === axesHash) return;
    const newSelected = buildSelectedFromVariants(variantAxes, variants);
    preselectedAxesHashRef.current = axesHash;
    if (Object.keys(newSelected).length > 0) {
      setGenSelected(newSelected);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantAxes, variants]);

  // Poblar deletedVariants desde el backend (cross-session regeneration).
  // Solo corre cuando los ejes están listos + hay variantes borradas del servidor.
  // Merge: las borradas en esta sesión tienen prioridad (ya están en el map).
  useEffect(() => {
    if (!isEdit || variantAxes.length === 0 || rawDeletedVariants.length === 0) return;
    const serverMap = new Map<string, string>();
    for (const v of rawDeletedVariants) {
      const key = buildVariantComboKey(v);
      if (key) serverMap.set(key, v.id);
    }
    setDeletedVariants(prev => {
      // Variantes borradas en esta sesión tienen prioridad
      const merged = new Map([...serverMap, ...prev]);
      return merged;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantAxes, rawDeletedVariants]);

  // Focus en SKU al abrir el modal (con delay para dejar que el DOM se monte)
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => { skuInputRef.current?.focus(); }, 200);
    return () => clearTimeout(t);
  }, [open]);

  // Cuando el tipo cambia a SERVICE: forzar valores incompatibles y limpiar.
  // Cuando cambia a PRODUCT/MATERIAL: solo desbloqueamos (no restablecemos stockMode).
  useEffect(() => {
    if (draft.articleType === "SERVICE") {
      setDraft(prev => ({
        ...prev,
        stockMode:           "NO_STOCK",
        reorderPoint:        null,
        costCalculationMode: "METAL_MERMA_HECHURA",
        isReturnable:        false,
        sellWithoutVariants: true,
      }));
      // Si estábamos en variantes, volver al tab principal
      setActiveTab(prev => prev === "variantes" ? "principal" : prev);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.articleType]);

  // Recalcular combinaciones automáticamente ante cualquier cambio de selección,
  // modo SKU, ejes de variante o variantes existentes. El preview es siempre derivado.
  useEffect(() => {
    setGenCombos(computeGenCombos());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genSelected, genSkuMode, variantAxes, variants, deletedVariants]);

  async function loadCategories() {
    try { setCategories(await categoriesApi.list()); } catch {}
  }
  async function loadGroups() {
    try { setGroups(await articleGroupsApi.list()); } catch {}
  }
  async function loadSuppliers() {
    try {
      const res = await commercialEntitiesApi.list({ role: "supplier", take: 200 });
      setSuppliers(res.rows);
    } catch {}
  }
  async function loadMetalVariants() {
    try {
      const metalsResp = await getMetals();
      const metals: { id: string; name: string }[] =
        (metalsResp as any)?.rows ?? (metalsResp as any)?.data?.rows ?? (metalsResp as any)?.data ?? metalsResp ?? [];
      const all: MetalVariantRow[] = [];
      await Promise.all(metals.map(async (m) => {
        try {
          const vrsResp = await getVariants(m.id);
          const vrs: MetalVariantRow[] =
            (vrsResp as any)?.rows ?? (vrsResp as any)?.data?.rows ?? (vrsResp as any)?.data ?? vrsResp ?? [];
          vrs.forEach((v) => all.push({ ...v, _metalName: m.name } as any));
        } catch {}
      }));
      metalVariantsRef.current = all; // mirror síncrono para fetchArticle
      setMetalVariants(all);
    } catch {}
  }
  async function loadCatalogArticles() {
    try {
      const [prodResp, svcResp] = await Promise.all([
        articlesApi.list({ articleType: "PRODUCT", status: "ACTIVE" }),
        articlesApi.list({ articleType: "SERVICE", status: "ACTIVE" }),
      ]);
      const prodRows = (prodResp as any)?.rows ?? [];
      const svcRows  = (svcResp  as any)?.rows ?? [];
      function toPrice(r: any): number | null {
        // Preferir computedCostBase: ya está en moneda base y cubre modos COST_LINES, MANUAL en divisa, etc.
        // Fallback a costPrice para artículos sin costo calculado aún.
        const base = r.computedCostBase != null && r.computedCostBase !== "" ? Number(r.computedCostBase) : null;
        if (base != null && Number.isFinite(base) && base > 0) return base;
        const cp = r.costPrice != null && r.costPrice !== "" ? Number(r.costPrice) : null;
        return cp != null && Number.isFinite(cp) && cp > 0 ? cp : null;
      }
      const toStock = (r: any) =>
        r.stockMode === "BY_ARTICLE" && r.stockData != null ? (r.stockData.total ?? null) : null;
      // costPrice → siempre en moneda BASE (para que el sync effect funcione bien).
      //   Viene de computedCostBase; null si no hay tasa cargada.
      // costPriceNative → en moneda ORIGINAL del artículo (solo MANUAL).
      //   Se usa en onSelect para carga inicial sin necesitar conversión.
      const toCostBase = (r: any): number | null => {
        const base = r.computedCostBase != null && r.computedCostBase !== "" ? Number(r.computedCostBase) : null;
        return base != null && Number.isFinite(base) && base > 0 ? base : null;
      };
      const toCostNative = (r: any): number | null => {
        if (r.costCalculationMode !== "MANUAL") return null;
        const cp = r.costPrice != null && r.costPrice !== "" ? Number(r.costPrice) : null;
        return cp != null && Number.isFinite(cp) && cp > 0 ? cp : null;
      };
      const mappedProds = prodRows.map((r: any) => ({
        id: r.id, name: r.name, sku: r.sku || "", stock: toStock(r),
        costPrice: toCostBase(r),
        costPriceNative: toCostNative(r),
        manualCurrencyId: r.manualCurrencyId ?? null,
      }));
      const mappedSvcs  = svcRows.map((r: any) => ({
        id: r.id, name: r.name, sku: r.sku || "", stock: toStock(r),
        costPrice: toCostBase(r),
        costPriceNative: toCostNative(r),
        manualCurrencyId: r.manualCurrencyId ?? null,
      }));
      productItemsRef.current  = mappedProds; // mirror síncrono para fetchArticle
      serviceItemsRef.current  = mappedSvcs;
      setProductItems(mappedProds);
      setServiceItems(mappedSvcs);
      catalogLoadedRef.current = true;
    } catch {}
  }
  async function loadCurrencies() {
    try {
      const resp = await getCurrencies();
      const list: CurrencyRow[] = (resp as any)?.rows ?? (resp as any)?.data?.rows ?? (resp as any)?.data ?? resp ?? [];
      const active = list.filter(c => c.isActive !== false);
      currenciesRef.current = active; // mirror síncrono para fetchArticle
      setCurrencies(active);
    } catch {}
  }
  async function loadTaxes() {
    try {
      const list = await taxesApi.list();
      const active = list.filter(t => t.isActive && !t.deletedAt);
      setTaxes(active);
      // Pre-seleccionar impuestos marcados como favoritos en modo crear
      if (!isEdit) {
        const favIds = active
          .filter(t => t.isFavorite && t.calculationType === "PERCENTAGE" && t.rate != null)
          .map(t => t.id);
        if (favIds.length > 0) {
          setDraft(prev => ({
            ...prev,
            manualTaxIds: prev.manualTaxIds.length === 0 ? favIds : prev.manualTaxIds,
          }));
        }
      }
    } catch {}
  }
  async function loadBrandItems() {
    try { setBrandItems(await listCatalog("ARTICLE_BRAND")); } catch {}
  }
  async function loadManufacturerItems() {
    try { setManufacturerItems(await listCatalog("ARTICLE_MANUFACTURER")); } catch {}
  }
  /** Carga los 3 catálogos y aplica los favoritos al draft (solo en create mode) */
  async function loadCatalogItemsWithDefaults() {
    try {
      const [brands, manufacturers, units, multiplierBases, weightUnits] = await Promise.all([
        listCatalog("ARTICLE_BRAND").catch(() => [] as CatalogItem[]),
        listCatalog("ARTICLE_MANUFACTURER").catch(() => [] as CatalogItem[]),
        listCatalog("UNIT_OF_MEASURE").catch(() => [] as CatalogItem[]),
        listCatalog("MULTIPLIER_BASE").catch(() => [] as CatalogItem[]),
        listCatalog("WEIGHT_UNIT").catch(() => [] as CatalogItem[]),
      ]);
      setBrandItems(brands);
      setManufacturerItems(manufacturers);
      setUnitItems(units);
      setMultiplierBaseItems(multiplierBases);
      setWeightUnitItems(weightUnits);

      const fBrand         = brands.find((i) => i.isFavorite && i.isActive !== false)?.label ?? "";
      const fManuf         = manufacturers.find((i) => i.isFavorite && i.isActive !== false)?.label ?? "";
      const fUnit          = units.find((i) => i.isFavorite && i.isActive !== false)?.label ?? "";
      const fMultiplierBase = multiplierBases.find((i) => i.isFavorite && i.isActive !== false)?.label ?? "";

      if (fBrand || fManuf || fUnit || fMultiplierBase) {
        setDraft((prev) => ({
          ...prev,
          brand:          prev.brand          || fBrand,
          manufacturer:   prev.manufacturer   || fManuf,
          unitOfMeasure:  prev.unitOfMeasure  || fUnit,
          weightUnit:     prev.weightUnit     || fMultiplierBase,
          multiplierBase: prev.multiplierBase || fMultiplierBase,
        }));
      }
    } catch {}
  }
  async function loadUnitItems() {
    try { setUnitItems(await listCatalog("UNIT_OF_MEASURE")); } catch {}
  }
  async function loadMultiplierBaseItems() {
    try { setMultiplierBaseItems(await listCatalog("MULTIPLIER_BASE")); } catch {}
  }
  async function loadWeightUnitItems() {
    try { setWeightUnitItems(await listCatalog("WEIGHT_UNIT")); } catch {}
  }

  async function toggleCatalogFavorite(
    itemId: string,
    currentlyFavorite: boolean,
    setItems: React.Dispatch<React.SetStateAction<CatalogItem[]>>,
  ) {
    const next = !currentlyFavorite;
    // Snapshot para revertir si falla
    let prevItems: CatalogItem[] = [];
    setItems(prev => {
      prevItems = prev;
      return prev.map(i => ({
        ...i,
        // Solo uno puede ser favorito: si next=true, quitar a todos los demás
        isFavorite: i.id === itemId ? next : (next ? false : i.isFavorite),
      }));
    });
    try {
      // Si había otro favorito antes, quitárselo primero
      const prevFav = prevItems.find(i => i.isFavorite && i.id !== itemId);
      if (next && prevFav) {
        await setCatalogItemFavorite(prevFav.id, false);
      }
      await setCatalogItemFavorite(itemId, next);
    } catch {
      setItems(prevItems);
      toast.error("No se pudo actualizar el favorito");
    }
  }

  async function handleSupplierCreated(entity: EntityDetailType) {
    await loadSuppliers();
    set("preferredSupplierId", entity.id);
  }

  // ── helpers draft ──────────────────────────────────────────────────────
  function set<K extends keyof Draft>(k: K, val: Draft[K]) {
    if (k === "costCalculationMode") {
      try { localStorage.setItem("tptech_last_cost_mode", val as string); } catch {}
      // Al cambiar a MULTIPLIER: si multiplierBase está vacío, aplicar favorita del catálogo
      if (val === "MULTIPLIER") {
        const favBase = multiplierBaseItems.find(i => i.isFavorite && i.isActive !== false)?.label ?? "";
        setDraft((prev) => ({
          ...prev,
          costCalculationMode: val as CostCalculationMode,
          multiplierBase: prev.multiplierBase || favBase,
        }));
        setDraftChanged(true);
        return;
      }
    }
    if (k === "stockMode" && !articleId) {
      try { localStorage.setItem("tptech_last_stock_mode", val as string); } catch {}
    }
    setDraft((prev) => ({ ...prev, [k]: val }));
    setDraftChanged(true);
  }

  // ── guardar ────────────────────────────────────────────────────────────
  async function handleSave() {
    if (handleSaveInFlightRef.current) return;
    handleSaveInFlightRef.current = true;
    try {
      setSubmitted(true);
      const hasVariants = variants.length > 0 || variantAxes.length > 0;
      if (!draft.name.trim() || (!draft.sku.trim() && draft.barcodeSource === "SKU" && !hasVariants)) {
        setActiveTab("principal");
        return;
      }
      // Advertir si alguna variante no tiene SKU (no bloquea el guardado)
      if (hasVariants && variants.some(v => !v.sku?.trim())) {
        toast.warning("Algunas variantes no tienen SKU. Podés asignarles uno más adelante.");
      }
      // Validar atributos requeridos del artículo
      const missingArtAttr = artAttrs.find(a => a.isRequired && !(artAttrValues[a.id] ?? "").trim());
      if (missingArtAttr) {
        setActiveTab("principal");
        return;
      }
      // Bloquear guardado si MANUAL con moneda no-base sin cotización
      if (draft.costCalculationMode === "MANUAL" && draft.manualCurrencyId) {
        const selCurr = currencies.find(c => c.id === draft.manualCurrencyId);
        const isBase = selCurr?.isBase ?? false;
        if (!isBase && !selCurr?.latestRate) {
          toast.error(`${selCurr?.code ?? "La moneda seleccionada"} no tiene cotización vigente. Sin ella el costo no puede convertirse a la moneda base para el cálculo de precios.`);
          setActiveTab("principal");
          return;
        }
      }
      // Bloquear guardado si METAL_MERMA_HECHURA con líneas en moneda no-base sin cotización
      if (draft.costCalculationMode === "METAL_MERMA_HECHURA" && costLines.length > 0) {
        const baseCurrId = currencies.find(c => c.isBase)?.id;
        const linesWithIssue = costLines.filter(l =>
          l.currencyId && l.currencyId !== baseCurrId &&
          !currencies.find(c => c.id === l.currencyId)?.latestRate
        );
        if (linesWithIssue.length > 0) {
          const uniqueCodes = [...new Set(
            linesWithIssue.map(l => currencies.find(c => c.id === l.currencyId)?.code ?? "?")
          )];
          const codes = uniqueCodes.length > 3
            ? `${uniqueCodes.slice(0, 3).join(", ")} y ${uniqueCodes.length - 3} más`
            : uniqueCodes.join(", ");
          toast.error(`${codes} no tiene cotización vigente. Sin ella el costo de composición no puede calcularse correctamente. Actualizá la cotización o cambiá la moneda de esas líneas.`);
          setActiveTab("principal");
          return;
        }
      }
      // Advertir si el costo efectivo es 0 o nulo.
      // Cada modo tiene su propia fuente de costo real:
      // - MANUAL:              calculable en cliente (base + ajuste)
      // - MULTIPLIER:          calculable en cliente (cantidad × valor)
      // - METAL_MERMA_HECHURA: requiere cotizaciones → usar `computed` del backend
      // - COST_LINES:          requiere cotizaciones → usar `computed` del backend
      let effectiveCost: number | null = null;
      if (draft.costCalculationMode === "MANUAL") {
        effectiveCost = computeManualFinalCost(draft, taxes);
        // Fallback: artículos con costPrice directo (antes de manualBaseCost), compatibilidad
        if (effectiveCost == null && draft.costPrice != null && draft.costPrice > 0) {
          effectiveCost = draft.costPrice;
        }
      } else if (draft.costCalculationMode === "MULTIPLIER") {
        const q = draft.multiplierQuantity;
        const v = draft.multiplierValue;
        effectiveCost = (q != null && v != null) ? q * v : null;
      } else {
        const cv = computed?.value;
        if (cv != null) {
          effectiveCost = parseFloat(cv);
        } else if (costLines.length > 0) {
          // computed no está disponible (artículo nuevo o líneas editadas sin guardar):
          // calcular desde las líneas en memoria, igual que "Total estimado"
          const baseCurrencyId = currencies.find(c => c.isBase)?.id ?? "";
          const linesTotal = costLines.reduce((sum, line) => {
            if (!line.quantity || !line.unitValue) return sum;
            let raw = line.type === "METAL"
              ? line.quantity * (1 + (line.mermaPercent ?? 0) / 100) * line.unitValue
              : line.quantity * line.unitValue;
            if (line.type !== "METAL") raw = applyLineAdj(raw, line.lineAdjKind ?? "", line.lineAdjType ?? "", line.lineAdjValue ?? null);
            const currId = line.currencyId ?? baseCurrencyId;
            if (currId !== baseCurrencyId) {
              const curr = currencies.find(c => c.id === currId);
              if (curr?.latestRate != null) raw = raw * curr.latestRate;
              else return sum;
            }
            return sum + raw;
          }, 0);
          effectiveCost = linesTotal > 0 ? linesTotal : null;
        }
      }
      if ((effectiveCost == null || effectiveCost === 0) && variants.length === 0) {
        setShowNoPriceWarning(true);
        return;
      }
      await executeSave();
    } finally {
      handleSaveInFlightRef.current = false;
    }
  }

  async function executeSave() {
    setShowNoPriceWarning(false);
    setBusySave(true);
    try {
      const payload = draftToPayload(draft);
      // Si el artículo tiene variantes, ciertos campos del padre no aplican
      const hasVariantsForSave = variantAxes.length > 0 || variants.length > 0;
      if (hasVariantsForSave) {
        payload.openingStock  = null;
        payload.reorderPoint  = null;
        // El padre con variantes NO debe heredar el SKU base como barcode:
        // cada variante tiene su propio barcode. Solo conservar si el usuario
        // cargó un barcode CUSTOM explícito (barcode !== null).
        if (payload.barcodeSource === "SKU" || payload.barcodeSource === "CODE") {
          payload.barcodeSource = "CUSTOM";
          payload.barcode       = null;
          payload.autoBarcode   = false;
        }
      }
      // costPrice ya viene asignado en draftToPayload(): base + ajuste, SIN impuestos.
      // Los impuestos se persisten solo como manualTaxIds (referencias) y se aplican
      // dinámicamente en lectura. Nunca se suman al costPrice guardado.
      // Incluir líneas de composición de costo en el payload (guardado atómico)
      payload.costComposition = costLines;

      let saved: ArticleDetail;
      if (isEdit && articleId) {
        saved = await articlesApi.update(articleId, payload);
      } else {
        saved = await articlesApi.create(payload);
        // En modo clon: persistir composiciones metálicas (METAL_MERMA_HECHURA)
        // que no se incluyen en el payload principal sino via su propia API.
        if (compositions.length > 0) {
          for (const comp of compositions) {
            try {
              await articlesApi.compositions.upsert(saved.id, {
                variantId: comp.variantId,
                grams:     parseFloat(comp.grams),
                isBase:    comp.isBase,
                sortOrder: comp.sortOrder,
              });
            } catch {
              // Best-effort: no bloqueamos la creación si falla una composición
            }
          }
        }
        // Persistir variantes draft (creadas en el create modal antes de guardar)
        if (variants.length > 0) {
          const persistedVariants: ArticleVariant[] = [];
          let varOk = 0;
          const varFailed: string[] = [];

          for (const dv of variants) {
            try {
              let created_v = await articlesApi.variants.create(saved.id, {
                code: dv.code,
                name: dv.name,
                sku: dv.sku || undefined,
                barcode: dv.barcode ?? undefined,
                barcodeType: dv.barcodeType,
                barcodeSource: dv.barcodeSource,
                reorderPoint: dv.reorderPoint != null ? parseFloat(dv.reorderPoint as any) : undefined,
                openingStock: (dv as any).openingStock != null ? parseFloat((dv as any).openingStock) : undefined,
                costPrice: dv.costPrice != null ? parseFloat(dv.costPrice as any) : undefined,
                priceOverride: dv.priceOverride != null ? parseFloat(dv.priceOverride as any) : undefined,
                sortOrder: dv.sortOrder,
              });

              // Si la variante draft estaba inactiva, togglear inmediatamente
              if (dv.isActive === false) {
                try {
                  created_v = await articlesApi.variants.toggle(saved.id, created_v.id);
                } catch {
                  // No crítico: la variante quedó activa, loguear y continuar
                  console.warn(`[TPTech] No se pudo desactivar variante "${dv.name}" (${dv.code})`);
                }
              }

              // Guardar attributeValues si la variante draft los tenía
              const attrPayload = (dv.attributeValues ?? []).map(av => ({
                assignmentId: av.assignmentId,
                value: av.value,
              }));
              if (attrPayload.length > 0) {
                const savedAttrs = await articlesApi.variantAttributes.set(saved.id, created_v.id, attrPayload);
                created_v = { ...created_v, attributeValues: savedAttrs };
              }
              // Subir imagen pendiente de la variante draft si existe
              const pendingImg = pendingVariantImagesRef.current.get(dv.id);
              if (pendingImg) {
                try {
                  const newImg = await articlesApi.variants.images.upload(saved.id, created_v.id, pendingImg, true);
                  created_v = { ...created_v, images: [newImg], imageUrl: newImg.url };
                } catch {
                  // Best-effort: no bloquear si falla la imagen
                }
                pendingVariantImagesRef.current.delete(dv.id);
              }
              persistedVariants.push(created_v);
              varOk++;
            } catch (err: any) {
              varFailed.push(`${dv.name} (${dv.code})`);
              console.warn(`[TPTech] Variante fallida al crear artículo:`, dv.name, dv.code, err?.message ?? err);
            }
          }

          setVariants(persistedVariants);

          // Construir mensaje de resultado de variantes
          const total = variants.length;
          if (varFailed.length === 0) {
            toast.success(`Artículo creado con ${total} variante${total !== 1 ? "s" : ""}.`);
          } else {
            toast.warning(
              `Artículo creado. ${varOk} variante${varOk !== 1 ? "s" : ""} creada${varOk !== 1 ? "s" : ""}. ${varFailed.length} no pud${varFailed.length !== 1 ? "ieron" : "o"} crearse: ${varFailed.join(", ")}. Podés agregarlas desde la pestaña Variantes.`
            );
          }
        }
      }

      // Persistir atributos del artículo (si la categoría tiene atributos normales)
      if (artAttrs.length > 0) {
        const artAttrPayload = artAttrs
          .filter(a => (artAttrValues[a.id] ?? "").trim() !== "")
          .map(a => ({ assignmentId: a.id, value: artAttrValues[a.id].trim() }));
        try {
          await articlesApi.attributes.set(saved.id, artAttrPayload);
        } catch {
          // best-effort: no bloquea el guardado principal
        }
      }

      // Subir imágenes pendientes en orden (create mode). La primera es la principal.
      if (!isEdit && pendingImages.length > 0) {
        const uploaded: ArticleImage[] = [];
        for (let i = 0; i < pendingImages.length; i++) {
          try {
            const img = await articlesApi.images.upload(saved.id, pendingImages[i].file, "", i === 0);
            uploaded.push(img);
          } catch { /* best-effort: el artículo ya se creó */ }
        }
        setImages(uploaded);
        setPendingImages(prev => { prev.forEach(p => URL.revokeObjectURL(p.url)); return []; });
      }

      // Sincronizar estado con la respuesta final
      setArticle(saved);
      setDraft(articleToDraft(saved));
      setCostLines(normalizeCostLines(saved.costComposition ?? []));
      if (saved.computedCostPrice) setComputed(saved.computedCostPrice);
      if (saved.computedSalePrice) setComputedSale(saved.computedSalePrice);
      if (saved.effectiveSalePrice !== undefined) setEffectivePrice(saved.effectiveSalePrice ?? null);
      if (saved.effectivePriceSource) setEffectiveSource(saved.effectivePriceSource);
      // El toast de create con variantes se emite dentro del bloque de persistencia
      if (isEdit || variants.length === 0) {
        toast.success(isEdit ? "Cambios guardados." : "Artículo creado.");
      }
      setDraftChanged(false); // reset dirty state después de guardar exitosamente
      // Notificar a otros modales abiertos que referencian este artículo como producto/servicio
      window.dispatchEvent(new CustomEvent("tptech:article-cost-changed", { detail: { articleId: saved.id } }));
      onSaved?.(saved);
      if (!isEdit) {
        // En modo crear, pasar a edición del recién creado (mismo modal)
        onClose();
      }
    } catch (e: any) {
      toast.error(e?.message || "No se pudieron guardar los cambios. Revisá los campos obligatorios y volvé a intentar.");
    } finally {
      setBusySave(false);
    }
  }

  // ── recomputar costo ───────────────────────────────────────────────────
  async function recomputeCost() {
    if (!articleId || !article) return;
    setLoadingCost(true);
    try {
      const refreshed = await articlesApi.getOne(articleId);
      if (refreshed.computedCostPrice) setComputed(refreshed.computedCostPrice);
      if (refreshed.computedSalePrice) setComputedSale(refreshed.computedSalePrice);
      if (refreshed.effectiveSalePrice !== undefined) setEffectivePrice(refreshed.effectiveSalePrice ?? null);
      if (refreshed.effectivePriceSource) setEffectiveSource(refreshed.effectivePriceSource);
    } catch {}
    finally { setLoadingCost(false); }
  }

  function updateMetalPrices() {
    const baseCurr   = currencies.find(c => c.isBase);
    const baseCurrId = baseCurr?.id ?? "";
    let updated = 0;
    setCostLines(prev => prev.map(line => {
      if (line.type !== "METAL" || !line.metalVariantId) return line;
      const mv = metalVariants.find(m => m.id === line.metalVariantId);
      if (mv?.finalSalePrice == null) return line;
      let newUnitValue = Number(mv.finalSalePrice);
      if (line.currencyId && line.currencyId !== baseCurrId) {
        const curr = currencies.find(c => c.id === line.currencyId);
        if (curr?.latestRate) newUnitValue = Math.round((newUnitValue / curr.latestRate) * 10000) / 10000;
      }
      if (Math.abs(newUnitValue - (line.unitValue ?? 0)) < 0.005) return line;
      updated++;
      return { ...line, unitValue: newUnitValue };
    }));
    if (updated > 0) toast.success(`${updated} línea${updated !== 1 ? "s" : ""} de metal actualizada${updated !== 1 ? "s" : ""} con la cotización actual.`);
    else toast.info("Todos los precios ya están al día.");
  }

  // ── reorder axes ────────────────────────────────────────────────────────
  function moveAxisUp(axisId: string) {
    setVariantAxes(prev => {
      const idx = prev.findIndex(a => a.id === axisId);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }
  function moveAxisDown(axisId: string) {
    setVariantAxes(prev => {
      const idx = prev.findIndex(a => a.id === axisId);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }

  // ── variantes ──────────────────────────────────────────────────────────
  function openNewVariant() {
    setVarEditId(null);
    setVarDraft({ code: "", name: "", barcodeSource: "SKU" });
    setVarAttrValues({});
    setPendingVarImages([]);
    setPendingVarImagePreviews(prev => { prev.forEach(URL.revokeObjectURL); return []; });
    setVarModal(true);
  }
  function openEditVariant(v: ArticleVariant) {
    setVarEditId(v.id);
    setVarDraft({
      code: v.code,
      name: variantLabel(v),
      sku: v.sku ?? "",
      barcode: v.barcode ?? "",
      barcodeType: v.barcodeType,
      barcodeSource: v.barcodeSource ?? "SKU",
      costPrice: v.costPrice != null ? parseFloat(v.costPrice) : null,
      reorderPoint: v.reorderPoint != null ? parseFloat(v.reorderPoint) : null,
      openingStock: v.openingStock != null ? parseFloat(v.openingStock) : null,
      weightOverride: v.weightOverride != null ? parseFloat(v.weightOverride) : null,
      hechuraPriceOverride: v.hechuraPriceOverride != null ? parseFloat(v.hechuraPriceOverride) : null,
      priceOverride: v.priceOverride != null ? parseFloat(v.priceOverride) : null,
      sortOrder: v.sortOrder,
      notes: v.notes ?? "",
    });
    setPendingVarImages([]);
    setPendingVarImagePreviews(prev => { prev.forEach(URL.revokeObjectURL); return []; });
    // Inicializar valores de atributos de variante desde los datos cargados
    const attrMap: Record<string, string> = {};
    (v.attributeValues ?? []).forEach((av: VariantAttributeValue) => {
      attrMap[av.assignmentId] = av.value;
    });
    setVarAttrValues(attrMap);
    setVarModal(true);
  }
  async function saveVariant() {
    setBusyVar(true);

    // Auto-derivar nombre desde los valores de eje cuando estén disponibles
    const axisValues = variantAxes
      .filter(ax => (varAttrValues[ax.id] ?? "").trim())
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(ax => varAttrValues[ax.id].trim());
    const autoDerived = axisValues.length > 0 ? axisValues.join(" · ") : "";
    const derivedName = (varDraft.name ?? "").trim() || autoDerived;

    // Validar campos base
    if (varEditId) {
      // Edición rápida: Nombre es obligatorio; SKU es recomendado (advierte pero no bloquea)
      if (!(varDraft.sku ?? "").trim()) {
        toast.warning("Esta variante no tiene SKU. Podés asignarle uno más adelante.");
      }
      if (!derivedName) {
        toast.error("El nombre de la variante es obligatorio para guardar.");
        setBusyVar(false);
        return;
      }
    } else {
      if (!derivedName || !varDraft.code?.trim()) {
        toast.error("El nombre y el código de la variante son obligatorios.");
        setBusyVar(false);
        return;
      }
      // Validar atributos requeridos (solo en creación — edición no muestra atributos)
      for (const axis of variantAxes) {
        if (axis.isRequired && !(varAttrValues[axis.id] ?? "").trim()) {
          toast.error(`El atributo "${axis.definition.name}" es obligatorio.`);
          setBusyVar(false);
          return;
        }
      }
    }

    // Detectar duplicado de combinación de ejes
    if (variantAxes.length > 0) {
      const axisIds = variantAxes.map(a => a.id);
      const newKey  = axisIds.map(id => (varAttrValues[id] ?? "").trim()).join("|");
      const emptyKey = axisIds.map(() => "").join("|");
      if (newKey !== emptyKey) {
        const hasDup = variants.some(v => {
          if (varEditId && v.id === varEditId) return false;
          const vKey = axisIds.map(id =>
            (v.attributeValues ?? []).find((av: VariantAttributeValue) => av.assignmentId === id)?.value ?? ""
          ).join("|");
          return vKey === newKey;
        });
        if (hasDup) {
          toast.error("Esta combinación ya existe activa. Podés editarla desde la lista de variantes.");
          setBusyVar(false);
          return;
        }
      }
    }

    // ── MODO CREATE: guardar solo en estado local ────────────────────────
    if (!articleId) {
      const attrValues: VariantAttributeValue[] = variantAxes
        .filter(ax => (varAttrValues[ax.id] ?? "").trim() !== "")
        .map(ax => ({
          id: `draft-av-${ax.id}`,
          assignmentId: ax.id,
          value: varAttrValues[ax.id].trim(),
          assignment: {
            id: ax.id,
            isRequired: ax.isRequired,
            sortOrder: ax.sortOrder,
            isVariantAxis: ax.isVariantAxis,
            definition: ax.definition,
          },
        }));

      if (varEditId) {
        setVariants(prev => prev.map(v => v.id === varEditId
          ? { ...v, code: varDraft.code, name: derivedName, sku: varDraft.sku ?? "", reorderPoint: (varDraft as any).reorderPoint ?? null, attributeValues: attrValues }
          : v
        ));
      } else {
        const draftId = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const newVar: ArticleVariant = {
          id: draftId,
          code: varDraft.code,
          name: derivedName,
          sku: varDraft.sku ?? "",
          barcode: varDraft.barcode ?? null,
          barcodeType: varDraft.barcodeType ?? "CODE128",
          barcodeSource: varDraft.barcodeSource ?? "SKU",
          costPrice: null,
          reorderPoint: (varDraft as any).reorderPoint ?? null,
          openingStock: (varDraft as any).openingStock ?? null,
          notes: "",
          priceOverride: null,
          weightOverride: null,
          hechuraPriceOverride: null,
          imageUrl: pendingVarImagePreviews[0] ?? "",
          images: [],
          sortOrder: variants.length,
          isActive: true,
          createdAt: new Date().toISOString(),
          attributeValues: attrValues,
        };
        if (pendingVarImages.length > 0) {
          pendingVariantImagesRef.current.set(draftId, pendingVarImages[0]);
        }
        setVariants(prev => [...prev, newVar]);
      }
      setVarModal(false);
      setBusyVar(false);
      setPendingVarImages([]);
      setPendingVarImagePreviews(prev => { prev.forEach(URL.revokeObjectURL); return []; });
      return;
    }

    // ── MODO EDIT API: actualizar variante existente ────────────────────────
    if (varEditId) {
      try {
        const payload = { ...varDraft, name: derivedName };
        let saved: ArticleVariant = await articlesApi.variants.update(articleId, varEditId, payload);

        // Guardar attributeValues si hay ejes configurados
        const attrPayload = variantAxes
          .filter(ax => (varAttrValues[ax.id] ?? "").trim() !== "")
          .map(ax => ({ assignmentId: ax.id, value: varAttrValues[ax.id].trim() }));
        if (attrPayload.length > 0) {
          try {
            const savedAttrs = await articlesApi.variantAttributes.set(articleId, saved.id, attrPayload);
            saved = { ...saved, attributeValues: savedAttrs };
          } catch (attrErr) {
            throw attrErr;
          }
        }

        // Subir imágenes pendientes
        if (pendingVarImages.length > 0) {
          const uploadedImages: VariantImage[] = [];
          for (let i = 0; i < pendingVarImages.length; i++) {
            try {
              const newImg = await articlesApi.variants.images.upload(articleId, saved.id, pendingVarImages[i], i === 0);
              uploadedImages.push(newImg);
            } catch {
              // No bloquear el guardado si falla alguna imagen
            }
          }
          if (uploadedImages.length > 0) {
            saved = { ...saved, images: uploadedImages, imageUrl: uploadedImages[0].url };
          }
        }
        setVariants(prev => prev.map(v => v.id === varEditId ? { ...v, ...saved } : v));
        setVarModal(false);
        setPendingVarImages([]);
        setPendingVarImagePreviews(prev => { prev.forEach(URL.revokeObjectURL); return []; });
        toast.success("Variante actualizada.");
      } catch (e: any) {
        toast.error(e?.message || "No se pudo actualizar la variante.");
      } finally { setBusyVar(false); }
      return;
    }

    // ── MODO EDIT API: crear variante nueva ─────────────────────────────────

    // Validar ejes requeridos antes de enviar al backend.
    if (variantAxes.length > 0) {
      const missingAxes = variantAxes.filter(ax => !(varAttrValues[ax.id] ?? "").trim());
      if (missingAxes.length > 0) {
        const names = missingAxes.map(ax => ax.definition.name).join(", ");
        toast.error(`Completá los ejes de variante obligatorios: ${names}`);
        setBusyVar(false);
        return;
      }
    }

    try {
      const payload = { ...varDraft, name: derivedName };
      let saved: ArticleVariant = await articlesApi.variants.create(articleId, payload);

      // Si el backend restauró internamente una variante soft-deleted, ya tiene atributos previos.
      // En ese caso no compensamos borrándola si falla el guardado de ejes (igual que en generación).
      const wasBackendRestored = (saved.attributeValues?.length ?? 0) > 0;

      // Guardar attributeValues si hay ejes configurados
      const attrPayload = variantAxes
        .filter(ax => (varAttrValues[ax.id] ?? "").trim() !== "")
        .map(ax => ({ assignmentId: ax.id, value: varAttrValues[ax.id].trim() }));
      if (attrPayload.length > 0) {
        try {
          const savedAttrs = await articlesApi.variantAttributes.set(articleId, saved.id, attrPayload);
          saved = { ...saved, attributeValues: savedAttrs };
        } catch (attrErr) {
          // Compensación: si la variante era nueva (no restaurada), borrarla para evitar que
          // quede incompleta en la base de datos. Mismo criterio que la generación automática.
          if (!wasBackendRestored) {
            try { await articlesApi.variants.remove(articleId, saved.id); } catch {}
          }
          throw attrErr; // re-throw: el catch externo muestra el error al usuario
        }
      }

      // Subir imágenes pendientes
      if (pendingVarImages.length > 0) {
        const uploadedImages: VariantImage[] = [];
        for (let i = 0; i < pendingVarImages.length; i++) {
          try {
            const newImg = await articlesApi.variants.images.upload(articleId, saved.id, pendingVarImages[i], i === 0);
            uploadedImages.push(newImg);
          } catch {
            // No bloquear el guardado si falla alguna imagen
          }
        }
        if (uploadedImages.length > 0) {
          saved = { ...saved, images: uploadedImages, imageUrl: uploadedImages[0].url };
        }
      }
      setVariants(prev => [...prev, saved]);
      setVarModal(false);
      setPendingVarImages([]);
      setPendingVarImagePreviews(prev => { prev.forEach(URL.revokeObjectURL); return []; });
      toast.success("Variante creada.");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar la variante. Verificá que el código no esté duplicado.");
    } finally { setBusyVar(false); }
  }
  async function doRemoveVariant(variantId: string) {
    // Calcular la clave canónica antes de borrar (para el badge "Regenerable")
    // Usa buildVariantComboKey para garantizar consistencia con computeGenCombos.
    const varToDelete = variants.find(v => v.id === variantId);
    const deletedKey = varToDelete && variantAxes.length > 0
      ? buildVariantComboKey(varToDelete)
      : null;

    // Modo create: eliminar solo en estado local
    if (!articleId) {
      setVariants(prev => prev.filter(v => v.id !== variantId));
      if (deletedKey) setDeletedVariants(prev => new Map([...prev, [deletedKey, variantId]]));
      setDeleteVariantId(null);
      return;
    }
    setRemovingVar(variantId);
    try {
      await articlesApi.variants.remove(articleId, variantId);
      setVariants((prev) => prev.filter((v) => v.id !== variantId));
      if (deletedKey) setDeletedVariants(prev => new Map([...prev, [deletedKey, variantId]]));
      setDeleteVariantId(null);
      toast.success("Variante eliminada.");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo eliminar la variante. Puede estar siendo referenciada en ventas o movimientos.");
    } finally { setRemovingVar(null); }
  }
  async function toggleVariant(v: ArticleVariant) {
    // Modo create: toggle solo en estado local
    if (!articleId) {
      setVariants(prev => prev.map(vv => vv.id === v.id ? { ...vv, isActive: !vv.isActive } : vv));
      return;
    }
    try {
      const updated = await articlesApi.variants.toggle(articleId, v.id);
      setVariants((prev) => prev.map((vv) => vv.id === v.id ? updated : vv));
    } catch (e: any) {
      toast.error(e?.message || "No se pudo cambiar el estado de la variante. Intentá de nuevo.");
    }
  }

  // ── reordenar variantes con drag & drop ────────────────────────────────
  async function handleVariantDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = variants.findIndex(v => v.id === active.id);
    const newIdx = variants.findIndex(v => v.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(variants, oldIdx, newIdx);
    setVariants(reordered);
    if (!articleId) return; // create mode: solo local
    try {
      await articlesApi.variants.reorder(articleId, reordered.map(v => v.id));
    } catch {
      toast.error("No se pudo guardar el nuevo orden. El cambio puede no haberse aplicado — recargá para ver el estado actual.");
    }
  }

  // ── reordenar líneas de costo por drag
  function handleCostLineDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = costLines.findIndex(l => l.id === active.id);
    const newIdx = costLines.findIndex(l => l.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    setCostLines(arrayMove(costLines, oldIdx, newIdx).map((l, i) => ({ ...l, sortOrder: i })));
  }

  // ── reordenar opciones seleccionadas por eje (controla orden de generación)
  function handleAxisOptionDragEnd(axisId: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setGenSelected(prev => {
      const cur = prev[axisId] ?? [];
      const oldIdx = cur.indexOf(String(active.id));
      const newIdx = cur.indexOf(String(over.id));
      if (oldIdx === -1 || newIdx === -1) return prev;
      return { ...prev, [axisId]: arrayMove(cur, oldIdx, newIdx) };
    });
  }

  // ── generación automática de variantes ─────────────────────────────────

  /** Opciones disponibles para un eje en el selector de generación */
  /** Devuelve true si el valor dado ya está presente en al menos una variante creada del artículo */
  function isAxisValueExisting(axisId: string, value: string): boolean {
    const norm = value.trim().toLowerCase();
    const axis = variantAxes.find(ax => ax.id === axisId);
    return variants.some(v =>
      (v.attributeValues ?? []).some(av => {
        if (av.value.trim().toLowerCase() !== norm) return false;
        if (av.assignmentId === axisId) return true;
        // Fallback: mismo definition
        return axis != null && av.assignment?.definition?.id === axis.definition.id;
      })
    );
  }


  function genOptionsForAxis(axis: CategoryAttribute): { value: string; label: string; codeExtension: string }[] {
    if (axis.definition.inputType === "BOOLEAN") {
      return [{ value: "true", label: "Sí", codeExtension: "" }, { value: "false", label: "No", codeExtension: "" }];
    }
    return axis.definition.options.map(o => ({ value: o.value, label: o.label, codeExtension: o.codeExtension ?? "" }));
  }

  /** ¿El eje usa opciones predefinidas (checkboxes)? */
  function axisHasOptions(axis: CategoryAttribute): boolean {
    return axis.definition.inputType === "BOOLEAN" || axis.definition.options.length > 0;
  }

  function toggleGenValue(axisId: string, value: string, checked: boolean) {
    setGenSelected(prev => {
      const cur = prev[axisId] ?? [];
      return {
        ...prev,
        [axisId]: checked ? [...cur, value] : cur.filter(v => v !== value),
      };
    });
    setRemoveComboAlert(null);
  }

  function addGenTag(axisId: string) {
    const val = (genTagInput[axisId] ?? "").trim();
    if (!val) return;
    setGenSelected(prev => {
      const cur = prev[axisId] ?? [];
      if (cur.includes(val)) return prev;
      return { ...prev, [axisId]: [...cur, val] };
    });
    setGenTagInput(prev => ({ ...prev, [axisId]: "" }));
    setRemoveComboAlert(null);
  }

  function removeGenTag(axisId: string, value: string) {
    setGenSelected(prev => ({
      ...prev,
      [axisId]: (prev[axisId] ?? []).filter(v => v !== value),
    }));
    setRemoveComboAlert(null);
  }

  /** Producto cartesiano de arrays */
  function cartesian<T>(arrays: T[][]): T[][] {
    if (arrays.length === 0) return [];
    if (arrays.some(a => a.length === 0)) return [];
    return arrays.reduce<T[][]>(
      (acc, arr) => acc.flatMap(combo => arr.map(v => [...combo, v])),
      [[]]
    );
  }

  /** Clave normalizada para detectar duplicados.
   *  axisIds: IDs de los ejes (ArticleCategoryAttribute.id) en cualquier orden (se ordenan internamente).
   *  valueMap: { [axisId]: value } — se usan solo las claves que están en axisIds. */
  function makeVariantKey(axisIds: string[], valueMap: Record<string, string>): string {
    return axisIds
      .slice()
      .sort()
      .map(id => `${id}:${(valueMap[id] ?? "").trim().toLowerCase()}`)
      .join("|");
  }

  /**
   * FUNCIÓN CANÓNICA — usar en TODOS los puntos del flujo de variantes:
   *   doRemoveVariant, computeGenCombos existingKeys, preview matching.
   *
   * Extrae la combo-key de una variante normalizada al set de ejes actual.
   * Soporta el caso donde av.assignmentId difiere de axis.id (assignment recreado):
   *   → primero coincidencia exacta por assignmentId
   *   → fallback por definition.id (misma definición, assignment recreado)
   */
  function buildVariantComboKey(
    variant: Pick<ArticleVariant, "attributeValues">,
  ): string {
    const axisIds = variantAxes.map(a => a.id);
    const vm: Record<string, string> = {};
    (variant.attributeValues ?? []).forEach(av => {
      if (axisIds.includes(av.assignmentId)) {
        vm[av.assignmentId] = av.value;
      } else {
        // Fallback: mismo definition.id aunque cambiara el assignment
        const matchAxis = variantAxes.find(
          ax => ax.definition.id === av.assignment?.definition?.id,
        );
        if (matchAxis) vm[matchAxis.id] = av.value;
      }
    });
    return makeVariantKey(axisIds, vm);
  }

  /** Genera nombre a partir de los valores de la combinación (formato consistente con variantLabel) */
  function makeVarName(values: string[]): string {
    return values.join(" · ");
  }
  function makeVarCode(values: string[], usedCodes: Set<string>): string {
    const base = values
      .map(v => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5) || "X")
      .join("-");
    if (!usedCodes.has(base)) { usedCodes.add(base); return base; }
    let i = 2;
    while (usedCodes.has(`${base}-${i}`)) i++;
    const result = `${base}-${i}`;
    usedCodes.add(result);
    return result;
  }

  /** Genera un SKU automático usando codeExtension de las opciones cuando está disponible.
   *  - Si todas las extensiones están presentes: BASE + concat (sin separador) → A000AB
   *  - Si alguna extensión falta: BASE-PART1-PART2 con separador */
  function makeVarSku(articleCode: string, values: string[], extensions: string[]): string {
    const cleaned = articleCode.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    const base = cleaned.replace(/-+$/, "").slice(0, 10) || "ART";
    const parts = values.map((v, i) => {
      const ext = (extensions[i] ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (ext) return ext;
      return v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "X";
    });
    const allHaveExt = extensions.every(e => e.trim());
    // Siempre insertar guion entre base y extensiones (sea que el padre terminara en "-" o no)
    return allHaveExt
      ? base + "-" + parts.join("")
      : [base, ...parts].join("-");
  }

  /** Valida los SKU de los combos: detecta duplicados en el lote y conflictos con variantes existentes */
  function validateGenSkus(combos: GenCombo[]): GenCombo[] {
    // Map SKU_UPPER → nombre de la variante existente (para mostrar en el error)
    const existingSkuMap = new Map<string, string>();
    for (const v of variants) {
      const key = (v.sku ?? "").trim().toUpperCase();
      if (key) existingSkuMap.set(key, v.name || v.code);
    }

    // Map SKU_UPPER → lista de combos nuevos con ese SKU (para detectar duplicados internos)
    const batchSkuMap = new Map<string, GenCombo[]>();
    for (const c of combos) {
      if (!c.isNew || !c.sku.trim()) continue;
      const key = c.sku.trim().toUpperCase();
      const list = batchSkuMap.get(key) ?? [];
      list.push(c);
      batchSkuMap.set(key, list);
    }

    return combos.map(c => {
      if (!c.isNew) return c;
      const trimmed = c.sku.trim();
      const key = trimmed.toUpperCase();
      if (!key) return { ...c, skuError: undefined };

      if (existingSkuMap.has(key)) {
        const conflictName = existingSkuMap.get(key)!;
        return { ...c, skuError: `SKU "${trimmed}" ya está usado por la variante "${conflictName}"` };
      }

      const batchList = batchSkuMap.get(key) ?? [];
      if (batchList.length > 1) {
        // Buscar el otro combo del lote con el mismo SKU (distinto key de combinación)
        const other = batchList.find(b => b.key !== c.key);
        const otherName = other?.name ?? "otra combinación";
        return { ...c, skuError: `SKU duplicado en las combinaciones nuevas (también usado por "${otherName}")` };
      }

      return { ...c, skuError: undefined };
    });
  }

  function updateComboSku(key: string, sku: string) {
    setGenCombos(prev => {
      const updated = prev.map(c => c.key === key ? { ...c, sku } : c);
      return validateGenSkus(updated);
    });
  }

  function removeCombo(comboKey: string) {
    const combo = genCombos.find(c => c.key === comboKey && c.isNew);
    if (!combo) {
      setRemoveComboAlert("No se encontró la combinación a eliminar.");
      return;
    }

    const remaining = genCombos.filter(c => c.isNew && c.key !== comboKey);

    // Detectar si hay al menos un valor que puede desseleccionarse (huérfano)
    const hasOrphanAttr = combo.attrs.some(attr =>
      !remaining.some(c =>
        c.attrs.some(a => a.assignmentId === attr.assignmentId && a.value === attr.value)
      )
    );

    if (!hasOrphanAttr) {
      setRemoveComboAlert(
        "Esta combinación no puede eliminarse porque sus valores son compartidos con otras combinaciones. Para quitarla, deseleccioná las opciones correspondientes en el generador."
      );
      return;
    }

    // Éxito: limpiar alert y aplicar cambio
    setRemoveComboAlert(null);
    setGenSelected(prev => {
      const next = { ...prev };
      for (const attr of combo.attrs) {
        const { assignmentId, value } = attr;
        // Solo desseleccionar si ningún otro combo nuevo usa este (eje, valor)
        const usedByOther = remaining.some(c =>
          c.attrs.some(a => a.assignmentId === assignmentId && a.value === value)
        );
        if (!usedByOther) {
          next[assignmentId] = (next[assignmentId] ?? []).filter(v => v !== value);
        }
      }
      return next;
    });
    // El useEffect que observa genSelected recomputará genCombos automáticamente
  }

  /** Computa el producto cartesiano de los valores seleccionados y determina
   *  cuáles combinaciones son nuevas (isNew) vs ya existentes. Función pura:
   *  no modifica estado, solo retorna los GenCombo calculados. */
  function computeGenCombos(): GenCombo[] {
    // Claves de variantes existentes — usa la función canónica buildVariantComboKey.
    const axisIds = variantAxes.map(a => a.id);
    const existingKeys = new Set(variants.map(v => buildVariantComboKey(v)));

    // Producto cartesiano de los valores seleccionados
    const valArrays = variantAxes.map(ax => genSelected[ax.id] ?? []);
    const combinations = cartesian(valArrays);

    const usedCodes = new Set(variants.map(v => v.code));
    const rawCombos: GenCombo[] = combinations.map(combo => {
      const valueMap: Record<string, string> = {};
      variantAxes.forEach((ax, i) => { valueMap[ax.id] = combo[i]; });

      // Buscar codeExtension por cada eje/valor para SKU automático
      const extensions = variantAxes.map((ax, i) => {
        const val = combo[i];
        const opt = (ax.definition.options ?? []).find(o => o.value === val || o.label === val);
        return opt?.codeExtension ?? "";
      });

      const key = makeVariantKey(axisIds, valueMap);
      const attrs = variantAxes.map((ax, i) => ({
        assignmentId: ax.id,
        axisName: ax.definition.name,
        value: combo[i],
        codeExtension: extensions[i] ?? "",
      }));
      const skuUsedExtensions = extensions.every(e => e.trim() !== "");
      const sku = genSkuMode === "auto" ? makeVarSku(draft.sku || draft.code, combo, extensions) : "";
      const isNew = !existingKeys.has(key);
      return {
        key,
        attrs,
        name: makeVarName(combo),
        code: makeVarCode(combo, usedCodes),
        sku,
        isNew,
        isRegeneratable: isNew && deletedVariants.has(key),
        skuUsedExtensions,
      };
    });

    return validateGenSkus(rawCombos);
  }

  async function runGenerate() {
    setGenBusy(true);
    let created = 0;
    const skipped = genCombos.filter(c => !c.isNew).length;

    // Separar: válidos (sin error) vs con error de validación frontal (ej. SKU duplicado).
    // Los inválidos no se envían a la API: ya sabemos que fallarán y tienen su propio mensaje en pantalla.
    const skuErrorCombos = genCombos.filter(c => c.isNew && Boolean(c.skuError));
    const newCombos      = genCombos.filter(c => c.isNew && !c.skuError);

    // ── MODO CREATE: agregar al estado local ─────────────────────────────
    if (!articleId) {
      const newVariants: ArticleVariant[] = newCombos.map((combo, idx) => {
        const draftId = `draft-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`;
        const attrValues: VariantAttributeValue[] = combo.attrs.map(a => {
          const axis = variantAxes.find(ax => ax.id === a.assignmentId);
          return {
            id: `draft-av-${a.assignmentId}-${draftId}`,
            assignmentId: a.assignmentId,
            value: a.value,
            assignment: axis ? {
              id: axis.id,
              isRequired: axis.isRequired,
              sortOrder: axis.sortOrder,
              isVariantAxis: axis.isVariantAxis,
              definition: axis.definition,
            } : undefined as any,
          };
        });
        return {
          id: draftId,
          code: combo.code,
          name: combo.name,
          sku: combo.sku.trim() || "",
          barcode: null,
          barcodeType: "CODE128" as const,
          barcodeSource: "SKU" as const,
          costPrice: null,
          reorderPoint: null,
          openingStock: null,
          notes: "",
          priceOverride: null,
          weightOverride: null,
          hechuraPriceOverride: null,
          imageUrl: "",
          images: [],
          sortOrder: variants.length + idx,
          isActive: true,
          createdAt: new Date().toISOString(),
          attributeValues: attrValues,
        };
      });
      setVariants(prev => [...prev, ...newVariants]);
      created = newVariants.length;
      if (created > 0) toast.success(`${created} variante${created !== 1 ? "s" : ""} agregada${created !== 1 ? "s" : ""}.`);
      if (created === 0) toast.info("No había combinaciones nuevas para agregar.");
      setGenBusy(false);
      return;
    }

    // ── MODO EDIT: llamada a API por cada combo ──────────────────────────
    // Estrategia de restore/create:
    //   1. Si el combo es conocido como "regenerable" (estaba en deletedVariants de esta sesión)
    //      → llamamos restore() explícito y luego refrescamos attributeValues vía setVariantAttributeValues.
    //   2. Si no es conocido como regenerable pero el backend detecta internamente un soft-deleted con
    //      el mismo código, lo restaura silenciosamente dentro de create() y devuelve la variante con
    //      sus viejos attributeValues (saved_v.attributeValues.length > 0).
    //      En ese caso NO compensamos borrando si set attrs falla, porque la variante ya existía.
    //   3. Si create() devuelve una variante genuinamente nueva (attributeValues vacíos) y set attrs
    //      falla → compensamos borrando la variante huérfana.
    let apiSkipped = 0;
    for (const combo of newCombos) {
      try {
        let saved_v: Awaited<ReturnType<typeof articlesApi.variants.create>>;

        if (combo.isRegeneratable) {
          // Restauración explícita de variante conocida como soft-deleted en esta sesión
          const existingId = deletedVariants.get(combo.key)!;
          saved_v = await articlesApi.variants.restore(articleId, existingId);
          // Siempre refrescar attributeValues con los valores del combo actual
          if (combo.attrs.length > 0) {
            try {
              const attrPayload = combo.attrs.map(a => ({ assignmentId: a.assignmentId, value: a.value }));
              const savedAttrs = await articlesApi.variantAttributes.set(articleId, saved_v.id, attrPayload);
              saved_v = { ...saved_v, attributeValues: savedAttrs };
            } catch {
              // Si falla el refresh de attrs, mantener la variante restaurada con sus attrs viejos.
              // Es mejor tener attrs potencialmente desactualizados que perder la variante restaurada.
            }
          }
          setVariants(prev => [...prev, saved_v]);
        } else {
          saved_v = await articlesApi.variants.create(articleId, {
            code: combo.code,
            name: combo.name,
            ...(combo.sku.trim() ? { sku: combo.sku.trim() } : {}),
          });
          // Si el backend restauró internamente una variante soft-deleted (safety net),
          // la respuesta incluye los attributeValues viejos (> 0). En ese caso NO compensamos.
          const wasBackendRestored = (saved_v.attributeValues?.length ?? 0) > 0;

          if (combo.attrs.length > 0) {
            try {
              const attrPayload = combo.attrs.map(a => ({ assignmentId: a.assignmentId, value: a.value }));
              const savedAttrs = await articlesApi.variantAttributes.set(articleId, saved_v.id, attrPayload);
              setVariants(prev => [...prev, { ...saved_v, attributeValues: savedAttrs }]);
            } catch {
              if (wasBackendRestored) {
                // Variante restaurada por backend: mantenerla aunque el refresh de attrs falle.
                setVariants(prev => [...prev, saved_v]);
              } else {
                // Variante nueva huérfana (sin attrs): compensar borrándola para evitar estado inconsistente.
                try { await articlesApi.variants.remove(articleId, saved_v.id); } catch {}
                apiSkipped++;
                continue;
              }
            }
          } else {
            setVariants(prev => [...prev, saved_v]);
          }
        }
        created++;
      } catch {
        apiSkipped++;
      }
    }

    // Total de combinaciones que no pudieron procesarse (error de API + errores de SKU frontal)
    const totalFailed = apiSkipped + skuErrorCombos.length;

    if (created > 0 && totalFailed > 0) {
      // Resultado mixto: algunas OK, algunas fallidas
      toast.success(`${created} variante${created !== 1 ? "s" : ""} creada${created !== 1 ? "s" : ""}.`);
      const failReason = skuErrorCombos.length > 0 ? " (SKU duplicado u otro conflicto)" : " (conflicto de código)";
      toast.error(
        `${totalFailed} combinación${totalFailed !== 1 ? "es" : ""} no pudo${totalFailed !== 1 ? "eron" : ""} crearse${failReason}. Podés corregirlas y crearlas individualmente.`,
        { durationMs: 6000 }
      );
    } else if (created > 0) {
      toast.success(`${created} variante${created !== 1 ? "s" : ""} creada${created !== 1 ? "s" : ""}.`);
    } else if (totalFailed > 0) {
      // Todas fallaron
      toast.error(`Ninguna combinación pudo crearse. Revisá los SKU o códigos y volvé a intentar.`);
    } else {
      toast.info("No había combinaciones nuevas para crear.");
    }
    setGenBusy(false);
  }

  // ── helper: input según inputType del eje de variante ──────────────────
  function renderVariantAttrInput(axis: CategoryAttribute) {
    const val = varAttrValues[axis.id] ?? "";
    const def = axis.definition;
    const setVal = (v: string) => setVarAttrValues(prev => ({ ...prev, [axis.id]: v }));

    if (def.inputType === "NUMBER" || def.inputType === "DECIMAL") {
      return (
        <TPNumberInput
          value={val !== "" ? parseFloat(val) : null}
          onChange={(n) => setVal(n != null ? String(n) : "")}
          placeholder="0"
          min={0}
          decimals={def.inputType === "DECIMAL" ? 4 : 0}
        />
      );
    }
    if (def.inputType === "BOOLEAN") {
      return (
        <TPComboFixed
          value={val}
          onChange={setVal}
          options={[
            { value: "", label: "— seleccionar —" },
            { value: "true", label: "Sí" },
            { value: "false", label: "No" },
          ]}
        />
      );
    }
    if (def.inputType === "SELECT" || def.inputType === "MULTISELECT") {
      return (
        <TPComboFixed
          value={val}
          onChange={setVal}
          searchable={def.options.length > 6}
          options={[
            { value: "", label: "— seleccionar —" },
            ...def.options.map(o => ({ value: o.value, label: o.label })),
          ]}
        />
      );
    }
    // TEXT, TEXTAREA, COLOR, DATE, default
    return (
      <TPInput
        value={val}
        onChange={setVal}
        placeholder={`Valor de ${def.name}`}
        type={def.inputType === "DATE" ? "date" : "text"}
      />
    );
  }

  // ── atributos del artículo ─────────────────────────────────────────────
  function renderArtAttrInput(attr: CategoryAttribute) {
    const val = artAttrValues[attr.id] ?? "";
    const def = attr.definition;
    const setVal = (v: string) => setArtAttrValues(prev => ({ ...prev, [attr.id]: v }));
    // Guard defensivo: si definition es null/undefined (dato incompleto del backend)
    if (!def) return <TPInput value={val} onChange={setVal} placeholder="—" />;

    if (def.inputType === "NUMBER" || def.inputType === "DECIMAL") {
      return (
        <TPNumberInput
          value={val !== "" ? parseFloat(val) : null}
          onChange={(n) => setVal(n != null ? String(n) : "")}
          placeholder="0"
          min={0}
          decimals={def.inputType === "DECIMAL" ? 4 : 0}
        />
      );
    }
    if (def.inputType === "BOOLEAN") {
      return (
        <TPComboFixed
          value={val}
          onChange={setVal}
          options={[
            { value: "", label: "— seleccionar —" },
            { value: "true", label: "Sí" },
            { value: "false", label: "No" },
          ]}
        />
      );
    }
    if (def.inputType === "SELECT" || def.inputType === "MULTISELECT") {
      return (
        <TPComboFixed
          value={val}
          onChange={setVal}
          searchable={def.options.length > 6}
          options={[
            { value: "", label: "— seleccionar —" },
            ...def.options.map(o => ({ value: o.value, label: o.label })),
          ]}
        />
      );
    }
    if (def.inputType === "TEXTAREA") {
      return (
        <TPTextarea
          value={val}
          onChange={setVal}
          placeholder={`Valor de ${def.name}`}
          rows={2}
        />
      );
    }
    // TEXT, COLOR, DATE, default
    return (
      <TPInput
        value={val}
        onChange={setVal}
        placeholder={`Valor de ${def.name}`}
        type={def.inputType === "DATE" ? "date" : def.inputType === "COLOR" ? "color" : "text"}
      />
    );
  }

  /** Sube o reemplaza la imagen principal del artículo (usada en tab General). */
  async function handleUploadMainImage(file: File) {
    // Create mode: reemplazar la imagen principal local (posición 0)
    if (!articleId) {
      const url = URL.createObjectURL(file);
      setPendingImages(prev => {
        if (prev[0]) URL.revokeObjectURL(prev[0].url);
        return [{ file, url }, ...prev.slice(1)];
      });
      return;
    }
    setBusyImg(true);
    try {
      const img = await articlesApi.images.upload(articleId, file, "", true);
      setImages(prev => [...prev.map(i => ({ ...i, isMain: false })), img]);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo subir la imagen principal. Verificá el formato (JPG, PNG, WebP) y el tamaño del archivo.");
    } finally { setBusyImg(false); }
  }

  /** Elimina la imagen principal actual (usada en tab General). */
  async function handleDeleteMainImage() {
    // Create mode: quitar la imagen principal local (posición 0)
    if (!articleId) {
      setPendingImages(prev => {
        if (prev[0]) URL.revokeObjectURL(prev[0].url);
        return prev.slice(1);
      });
      return;
    }
    const mainImg = images.find(i => i.isMain) ?? images[0] ?? null;
    if (!mainImg) return;
    await handleRemoveImage(mainImg.id);
  }
  async function handleSetMain(imgId: string) {
    if (!articleId) return;
    try {
      await articlesApi.images.setMain(articleId, imgId);
      setImages((prev) => prev.map((img) => ({ ...img, isMain: img.id === imgId })));
    } catch (e: any) {
      toast.error(e?.message || "No se pudo establecer la imagen principal. Intentá de nuevo.");
    }
  }
  async function handleRemoveImage(imgId: string) {
    if (!articleId) return;
    setRemovingImg(imgId);
    try {
      await articlesApi.images.remove(articleId, imgId);
      setImages((prev) => prev.filter((img) => img.id !== imgId));
      toast.success("Imagen eliminada.");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo eliminar la imagen. Intentá de nuevo.");
    } finally { setRemovingImg(null); }
  }

  async function handleAddImage(file: File) {
    // Create mode: agregar imagen pendiente local
    if (!articleId) {
      if (pendingImages.length >= 5) { toast.error("Límite de imágenes alcanzado (máximo 5). Eliminá una imagen para poder agregar otra."); return; }
      const url = URL.createObjectURL(file);
      setPendingImages(prev => [...prev, { file, url }]);
      return;
    }
    if (images.length >= 5) { toast.error("Límite de imágenes alcanzado (máximo 5). Eliminá una imagen para poder agregar otra."); return; }
    setBusyAddImg(true);
    try {
      const img = await articlesApi.images.upload(articleId, file, "", false);
      setImages(prev => [...prev, img]);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo subir la imagen. Verificá el formato (JPG, PNG, WebP) y el tamaño del archivo.");
    } finally {
      setBusyAddImg(false);
    }
  }

  /** Mueve una imagen pendiente (create mode) a la posición 0 (principal). */
  function handleSetPendingMain(idx: number) {
    setPendingImages(prev => {
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      return [item, ...next];
    });
  }

  /** Elimina una imagen pendiente (create mode) por índice. */
  function handleRemovePendingImage(idx: number) {
    setPendingImages(prev => {
      const next = [...prev];
      URL.revokeObjectURL(next[idx].url);
      next.splice(idx, 1);
      return next;
    });
  }

  async function handleSetMainImage(imgId: string) {
    if (!articleId) return;
    try {
      await articlesApi.images.setMain(articleId, imgId);
      setImages(prev => prev.map(i => ({ ...i, isMain: i.id === imgId })));
    } catch (e: any) {
      toast.error(e?.message || "No se pudo establecer la imagen principal. Intentá de nuevo.");
    }
  }

  // ── options ────────────────────────────────────────────────────────────
  // Categorías como árbol con indentación (igual que el selector de categoría padre)
  const categoryOptions = useMemo(() => {
    const byParent = new Map<string | null, CategoryRow[]>();
    for (const c of categories) {
      if (!c.isActive || c.deletedAt) continue;
      const key = c.parentId ?? null;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(c);
    }
    const result: { value: string; label: string }[] = [{ value: "", label: "Sin categoría" }];
    function traverse(parentId: string | null, level: number) {
      const children = byParent.get(parentId) ?? [];
      for (const c of children) {
        result.push({ value: c.id, label: "— ".repeat(level) + c.name });
        traverse(c.id, level + 1);
      }
    }
    traverse(null, 0);
    return result;
  }, [categories]);
  const articleTypeOptions = (Object.keys(ARTICLE_TYPE_LABELS) as ArticleType[])
    .filter((k) => k !== "MATERIAL") // MATERIAL no se ofrece como opción nueva
    .map((k) => ({ value: k, label: ARTICLE_TYPE_LABELS[k], isFavorite: defaultArticleType === k }));
  const statusOptions = (Object.keys(ARTICLE_STATUS_LABELS) as ArticleStatus[]).map((k) => ({
    value: k, label: ARTICLE_STATUS_LABELS[k], isFavorite: defaultStatus === k,
  }));
  // Ocultar BY_MATERIAL salvo que el artículo ya lo tenga asignado (para no romper edición)
  const stockModeOptions = (Object.keys(STOCK_MODE_LABELS) as StockMode[])
    .filter((k) => k !== "BY_MATERIAL" || draft.stockMode === "BY_MATERIAL")
    .map((k) => ({ value: k, label: STOCK_MODE_LABELS[k], isFavorite: defaultStockMode === k }));
  const barcodeTypeOptions = [
    { value: "CODE128", label: "CODE128" },
    { value: "EAN13",   label: "EAN-13" },
    { value: "QR",      label: "QR" },
  ];
  const hechuraModeOptions = (Object.keys(HECHURA_MODE_LABELS) as HechuraPriceMode[]).map((k) => ({
    value: k, label: HECHURA_MODE_LABELS[k],
  }));
  const inventoryAccountOptions = [
    { value: "",                     label: "— Sin especificar —",  isFavorite: defaultInventory === "" },
    { value: "Activo de inventario", label: "Activo de inventario", isFavorite: defaultInventory === "Activo de inventario" },
    { value: "_h_avanzado",          label: "Producción avanzada",  isHeader: true },
    { value: "Bienes finalizados",   label: "Bienes finalizados",   isFavorite: defaultInventory === "Bienes finalizados" },
    { value: "Trabajo en curso",     label: "Trabajo en curso",     isFavorite: defaultInventory === "Trabajo en curso" },
  ];


  // ── título modal ───────────────────────────────────────────────────────
  const modalTitle = isEdit
    ? `Editar: ${article?.name ?? "…"}`
    : isClone
    ? "Clonar artículo"
    : "Nuevo artículo";

  // ── tab content ────────────────────────────────────────────────────────

  /** Tab único: identidad → costo → stock → colapsables */
  function renderTabPrincipal() {
    const identityContent = renderTabGeneral();
    const costContent     = renderTabCostos();

    function CollapseHeader({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
      return (
        <button
          type="button"
          onClick={onToggle}
          className="w-full flex items-center justify-between px-4 py-3 bg-surface2/40 hover:bg-surface2/70 transition-colors"
        >
          <span className="text-[11px] font-semibold text-muted/70 uppercase tracking-wider">{label}</span>
          <ChevronDown size={14} className={cn("text-muted transition-transform duration-200", open && "rotate-180")} />
        </button>
      );
    }

    return (
      <div className="space-y-3">

        {/* ① IDENTIDAD */}
        {identityContent}

        {/* ② COSTO — card contenedor */}
        {draft.articleType !== "SERVICE" && (
          <div className="rounded-xl bg-surface2/40 border border-border/50 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted select-none">Costo</span>
            </div>
            <div className="p-3">
              {costContent}
            </div>
          </div>
        )}

        {/* ③ STOCK — colapsable */}
        {draft.articleType !== "SERVICE" && draft.stockMode !== "NO_STOCK" && (
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <CollapseHeader label="Stock" open={stockOpen} onToggle={() => toggleSection("stock")} />
            {stockOpen && (
              <div className="p-4 space-y-3 border-t border-border/30">

                {/* Fila 1: Punto de reposición + Cant. predeterminada */}
                {variants.length === 0 && variantAxes.length === 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    <TPField label="Punto de reposición" hint="Stock mínimo para alerta">
                      <TPNumberInput
                        value={draft.reorderPoint}
                        onChange={(v) => set("reorderPoint", v)}
                        decimals={2} min={0} placeholder="0,00"
                      />
                    </TPField>
                    <TPField label="Cant. predeterminada">
                      <TPNumberInput
                        value={draft.defaultQuantity}
                        onChange={(v) => set("defaultQuantity", v)}
                        decimals={2} min={0} placeholder="0,00"
                      />
                    </TPField>
                  </div>
                )}

                {/* Fila 2: Cant. mínima + Cant. máxima */}
                <div className="grid grid-cols-2 gap-3">
                  <TPField label="Cant. mínima de venta">
                    <TPNumberInput
                      value={draft.minSaleQuantity}
                      onChange={(v) => set("minSaleQuantity", v)}
                      decimals={2} min={0} placeholder="0,00"
                    />
                  </TPField>
                  <TPField label="Cant. máxima de venta">
                    <TPNumberInput
                      value={draft.maxSaleQuantity}
                      onChange={(v) => set("maxSaleQuantity", v)}
                      decimals={2} min={0} placeholder="0,00"
                    />
                  </TPField>
                </div>

                {/* Fila 3: Existencia de apertura (ancho completo) */}
                {variants.length === 0 && variantAxes.length === 0 && !hasMovements && (
                  <TPField
                    label="Existencia de apertura"
                    hint={isEdit
                      ? "Cantidad inicial antes del primer movimiento de inventario."
                      : "Cantidad inicial con la que ingresa este artículo al sistema."}
                  >
                    <TPNumberInput
                      value={draft.openingStock}
                      onChange={(v) => set("openingStock", v)}
                      decimals={4} min={0} placeholder="0"
                    />
                  </TPField>
                )}
              </div>
            )}
          </div>
        )}

        {/* ④ CONFIGURACIÓN COMERCIAL — colapsable */}
        <div className="rounded-xl border border-border/50 overflow-hidden">
          <CollapseHeader label="Configuración comercial" open={comercialOpen} onToggle={() => toggleSection("comercial")} />
          {comercialOpen && (
            <div className="p-4 space-y-3 border-t border-border/30">
              <div className="grid grid-cols-2 gap-3">
                <TPField label="Proveedor preferido">
                  <TPComboFixed
                    value={draft.preferredSupplierId}
                    onChange={(v) => {
                      if (v === "__new__") { setNewSupplierModalOpen(true); }
                      else { set("preferredSupplierId", v); }
                    }}
                    options={[
                      { value: "", label: "Sin proveedor preferido" },
                      ...suppliers.map((s) => ({ value: s.id, label: s.displayName })),
                      { value: "__new__", label: "+ Nuevo proveedor…" },
                    ]}
                    searchable
                  />
                </TPField>
                {draft.articleType !== "SERVICE" ? (
                  <TPField label="Código en proveedor">
                    <TPInput value={draft.supplierCode} onChange={(v) => set("supplierCode", v)} placeholder="Ref. proveedor" />
                  </TPField>
                ) : <div />}
              </div>
              {draft.articleType !== "SERVICE" && (
                <div className="grid grid-cols-2 gap-3">
                  <TPField label="Marca">
                    <TPComboCreatable
                      type="ARTICLE_BRAND"
                      items={brandItems}
                      value={draft.brand}
                      onChange={(v) => set("brand", v)}
                      placeholder="Seleccionar o crear marca…"
                      allowCreate
                      onCreate={async (label) => { await createCatalogItem("ARTICLE_BRAND", label); await loadBrandItems(); }}
                      onRefresh={loadBrandItems}
                      mode={isEdit ? "edit" : "create"}
                    />
                  </TPField>
                  <TPField label="Fabricante">
                    <TPComboCreatable
                      type="ARTICLE_MANUFACTURER"
                      items={manufacturerItems}
                      value={draft.manufacturer}
                      onChange={(v) => set("manufacturer", v)}
                      placeholder="Seleccionar o crear fabricante…"
                      allowCreate
                      onCreate={async (label) => { await createCatalogItem("ARTICLE_MANUFACTURER", label); await loadManufacturerItems(); }}
                      onRefresh={loadManufacturerItems}
                      mode={isEdit ? "edit" : "create"}
                    />
                  </TPField>
                </div>
              )}
              {draft.articleType !== "SERVICE" && (
                <TPField label="Cuenta de inventario" hint="Usá Activo de inventario para la mayoría de los artículos.">
                  <TPComboFixed
                    value={draft.inventoryAccount}
                    onChange={(v) => set("inventoryAccount", v)}
                    options={inventoryAccountOptions}
                    onSetFavorite={handleSetDefaultInventory}
                  />
                </TPField>
              )}
            </div>
          )}
        </div>

        {/* ⑤ MEDIDAS — colapsable */}
        <div className="rounded-xl border border-border/50">
          <CollapseHeader label="Medidas" open={medidasOpen} onToggle={() => toggleSection("medidas")} />
          {medidasOpen && (
            <div className="p-3 border-t border-border/30">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">

              {/* Card: Dimensiones */}
              <div className="rounded-lg border border-border/40">
                <div className="px-3 py-1.5 bg-surface2/30 border-b border-border/30">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted/70">Dimensiones</span>
                </div>
                <div className="p-3 flex flex-col sm:flex-row gap-3 items-start">
                  {/* Inputs */}
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                  <TPField label="Frente">
                    <TPNumberInput value={draft.dimensionLength} onChange={(v) => set("dimensionLength", v)} decimals={2} min={0} placeholder="—" />
                  </TPField>
                  <TPField label="Profundo">
                    <TPNumberInput value={draft.dimensionWidth} onChange={(v) => set("dimensionWidth", v)} decimals={2} min={0} placeholder="—" />
                  </TPField>
                  <TPField label="Alto">
                    <TPNumberInput value={draft.dimensionHeight} onChange={(v) => set("dimensionHeight", v)} decimals={2} min={0} placeholder="—" />
                  </TPField>
                  <TPField label="Unidad">
                    <div
                      className="relative"
                      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setUnitPickerOpen(null); }}
                    >
                      <button
                        type="button"
                        onClick={() => setUnitPickerOpen(v => v === "dimension" ? null : "dimension")}
                        className="h-8 w-full flex items-center gap-1.5 px-2 rounded border border-border bg-surface2/40 hover:border-primary/50 transition text-left"
                      >
                        <Ruler size={11} className="text-muted shrink-0" />
                        <span className="text-xs font-semibold truncate">{draft.unitOfMeasure || "—"}</span>
                      </button>
                      {unitPickerOpen === "dimension" && (
                        <div className="absolute top-full left-0 mt-1 z-50 min-w-[120px] rounded-lg border border-border bg-surface shadow-lg py-1 max-h-48 overflow-y-auto">
                          {unitItems.filter(u => u.isActive !== false).map(u => (
                            <div key={u.id} className="flex items-center gap-1 px-2 hover:bg-surface2 transition">
                              <button
                                type="button"
                                onMouseDown={() => { set("unitOfMeasure", u.label); setUnitPickerOpen(null); }}
                                className={cn("flex-1 text-left py-1.5 text-xs", draft.unitOfMeasure === u.label && "text-primary font-semibold")}
                              >
                                {u.label}
                              </button>
                              <button
                                type="button"
                                title={u.isFavorite ? "Quitar de favoritos" : "Marcar como favorito"}
                                onMouseDown={(e) => { e.preventDefault(); if (!u.isFavorite) set("unitOfMeasure", u.label); void toggleCatalogFavorite(u.id, !!u.isFavorite, setUnitItems); }}
                                className={cn("shrink-0 transition-colors", u.isFavorite ? "text-yellow-400" : "text-muted/20 hover:text-yellow-400")}
                              >
                                <Star size={11} className={u.isFavorite ? "fill-yellow-400" : ""} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </TPField>
                  </div>{/* fin grid inputs */}

                  {/* Guide — siempre a la izquierda */}
                  <div className="w-auto shrink-0 flex items-center justify-center order-first">
                    <TPDimensionsGuide
                      className="w-32 h-24 text-muted/50"
                    />
                  </div>
                </div>{/* fin flex row */}
              </div>

              {/* Card: Peso */}
              <div className="rounded-lg border border-border/40">
                <div className="px-3 py-1.5 bg-surface2/30 border-b border-border/30">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted/70">Peso</span>
                </div>
                <div className="p-3 grid grid-cols-[1fr_auto] gap-2 items-end">
                  <TPField label="Peso">
                    <TPNumberInput value={draft.weight} onChange={(v) => set("weight", v)} decimals={2} min={0} placeholder="0,00" />
                  </TPField>
                  <TPField label="Unidad">
                    <div
                      className="relative"
                      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setUnitPickerOpen(null); }}
                    >
                      <button
                        type="button"
                        onClick={() => setUnitPickerOpen(v => v === "weight" ? null : "weight")}
                        className="h-8 w-full flex items-center gap-1.5 px-2 rounded border border-border bg-surface2/40 hover:border-primary/50 transition text-left"
                      >
                        <Scale size={11} className="text-muted shrink-0" />
                        <span className="text-xs font-semibold truncate">{draft.weightUnit || "—"}</span>
                      </button>
                      {unitPickerOpen === "weight" && (
                        <div className="absolute top-full left-0 mt-1 z-50 min-w-[120px] rounded-lg border border-border bg-surface shadow-lg py-1 max-h-48 overflow-y-auto">
                          {multiplierBaseItems.filter(u => u.isActive !== false).map(u => (
                            <div key={u.id} className="flex items-center gap-1 px-2 hover:bg-surface2 transition">
                              <button
                                type="button"
                                onMouseDown={() => { set("weightUnit", u.label); setUnitPickerOpen(null); }}
                                className={cn("flex-1 text-left py-1.5 text-xs", draft.weightUnit === u.label && "text-primary font-semibold")}
                              >
                                {u.label}
                              </button>
                              <button
                                type="button"
                                title={u.isFavorite ? "Quitar de favoritos" : "Marcar como favorito"}
                                onMouseDown={(e) => { e.preventDefault(); if (!u.isFavorite) set("weightUnit", u.label); void toggleCatalogFavorite(u.id, !!u.isFavorite, setMultiplierBaseItems); }}
                                className={cn("shrink-0 transition-colors", u.isFavorite ? "text-yellow-400" : "text-muted/20 hover:text-yellow-400")}
                              >
                                <Star size={11} className={u.isFavorite ? "fill-yellow-400" : ""} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </TPField>
                </div>
              </div>

              </div>{/* fin grid 2 columnas */}
            </div>
          )}
        </div>

        {/* ⑥ NOTAS Y OPCIONES — colapsable */}
        <div className="rounded-xl border border-border/50 overflow-hidden">
          <CollapseHeader label="Notas y opciones" open={notasOpen} onToggle={() => toggleSection("notas")} />
          {notasOpen && (
            <div className="p-4 border-t border-border/30">
              <TPField label="Notas internas">
                <TPTextarea
                  value={draft.notes}
                  onChange={(v) => set("notes", v)}
                  rows={2}
                  placeholder="Notas internas (no visible al cliente)"
                />
              </TPField>
            </div>
          )}
        </div>

        {/* Comportamiento comercial */}
        {(() => {
          const siNoOptions = [
            { value: "true",  label: "Sí" },
            { value: "false", label: "No" },
          ];
          return (
            <div className="flex flex-col gap-2 pl-1">
              <div className="flex items-center">
                <span className="text-xs text-text/80 w-52 shrink-0">Mostrar en tienda</span>
                <div className="w-24 shrink-0">
                  <TPComboFixed
                    value={String(draft.showInStore)}
                    onChange={(v) => set("showInStore", v === "true")}
                    options={siNoOptions}
                    onSetFavorite={(v) => handleSetDefaultShowInStore(v === "true")}
                    favoriteValue={defaultShowInStore === null ? undefined : String(defaultShowInStore)}
                  />
                </div>
              </div>
              {draft.articleType !== "SERVICE" && (
                <div className="flex items-center">
                  <span className="text-xs text-text/80 w-52 shrink-0">Acepta devoluciones</span>
                  <div className="w-24 shrink-0">
                    <TPComboFixed
                      value={String(draft.isReturnable)}
                      onChange={(v) => set("isReturnable", v === "true")}
                      options={siNoOptions}
                      onSetFavorite={(v) => handleSetDefaultIsReturnable(v === "true")}
                      favoriteValue={defaultIsReturnable === null ? undefined : String(defaultIsReturnable)}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })()}

      </div>
    );
  }

  function renderTabGeneral() {
    const mainImageSrc = !isEdit
      ? (pendingImages[0]?.url ?? null)
      : (images.find(i => i.isMain)?.url ?? images[0]?.url ?? article?.mainImageUrl ?? null);
    const mainImageId = images.find(i => i.isMain)?.id ?? images[0]?.id ?? null;
    const hasDeleteTarget = !isEdit ? pendingImages.length > 0 : !!mainImageId;
    const galleryCount = isEdit ? images.length : pendingImages.length;

    return (
      <div className="space-y-3">

        {/* ══════════════════════════════════════════════════════════
            FICHA DE PRODUCTO — imagen + identidad + config en una sola caja
        ══════════════════════════════════════════════════════════ */}
        <div className="rounded-xl bg-surface2/40 border border-border/50 p-4">
          <div className="flex gap-4 min-w-0">

            {/* ── Columna izquierda: galería de imágenes ─────── */}
            <div className="flex flex-col gap-2 shrink-0" style={{ width: 144 }}>

              {/* ── Imagen principal 144×144 ── */}
              <div className="relative group w-36 h-36 rounded-xl overflow-hidden border border-border bg-surface2 shrink-0">
                {mainImageSrc ? (
                  <>
                    <img src={mainImageSrc} alt="" className="w-full h-full object-cover" />

                    {/* Overlay hover: Cambiar / Eliminar */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                      <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-medium cursor-pointer transition-colors">
                        <Camera size={13} />Cambiar
                        <input type="file" accept="image/*" hidden
                          onChange={(e) => { const f = e.target.files?.[0] ?? null; e.currentTarget.value = ""; if (f) void handleUploadMainImage(f); }}
                        />
                      </label>
                      {hasDeleteTarget && (
                        <button type="button"
                          onClick={() => void handleDeleteMainImage()}
                          disabled={busyImg}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-red-500/60 text-white text-xs font-medium transition-colors"
                        >
                          {busyImg ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          Eliminar
                        </button>
                      )}
                    </div>

                    {/* Spinner de carga superpuesto */}
                    {busyImg && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
                        <Loader2 size={24} className="animate-spin text-white" />
                      </div>
                    )}
                  </>
                ) : (
                  /* Placeholder clickeable para subir la primera imagen */
                  <label className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted hover:text-primary cursor-pointer transition-colors">
                    {busyImg
                      ? <Loader2 size={24} className="animate-spin" />
                      : <><Package size={28} className="opacity-50" /><span className="text-xs">Subir imagen</span></>
                    }
                    <input type="file" accept="image/*" hidden
                      onChange={(e) => { const f = e.target.files?.[0] ?? null; e.currentTarget.value = ""; if (f) void handleUploadMainImage(f); }}
                    />
                  </label>
                )}
              </div>

              {/* ── Tira de miniaturas (create y edit) ── */}
              <div className="flex flex-col gap-1">
                <div className="flex gap-1 flex-wrap">
                  {isEdit ? (
                    /* Edit mode: imágenes ya guardadas */
                    images.map(img => (
                      <div
                        key={img.id}
                        onClick={() => { if (!img.isMain) void handleSetMainImage(img.id); }}
                        className={cn(
                          "relative group w-11 h-11 rounded-lg overflow-hidden border-2 shrink-0 bg-surface2 transition-all",
                          img.isMain ? "border-primary cursor-default" : "border-border hover:border-primary/60 cursor-pointer"
                        )}
                      >
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                        {img.isMain && (
                          <div className="absolute top-0.5 left-0.5 bg-primary rounded-sm w-3.5 h-3.5 flex items-center justify-center">
                            <Check size={8} className="text-white" strokeWidth={3} />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-0.5">
                          {!img.isMain && (
                            <button type="button" title="Hacer principal"
                              onClick={(e) => { e.stopPropagation(); void handleSetMainImage(img.id); }}
                              className="p-1 rounded text-white hover:text-primary transition-colors"
                            ><Check size={12} /></button>
                          )}
                          <button type="button" title="Eliminar"
                            onClick={(e) => { e.stopPropagation(); void handleRemoveImage(img.id); }}
                            disabled={removingImg === img.id}
                            className="p-1 rounded text-white hover:text-red-400 transition-colors"
                          >{removingImg === img.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}</button>
                        </div>
                      </div>
                    ))
                  ) : (
                    /* Create mode: imágenes pendientes locales */
                    pendingImages.map((p, idx) => (
                      <div
                        key={idx}
                        onClick={() => { if (idx !== 0) handleSetPendingMain(idx); }}
                        className={cn(
                          "relative group w-11 h-11 rounded-lg overflow-hidden border-2 shrink-0 bg-surface2 transition-all",
                          idx === 0 ? "border-primary cursor-default" : "border-border hover:border-primary/60 cursor-pointer"
                        )}
                      >
                        <img src={p.url} alt="" className="w-full h-full object-cover" />
                        {idx === 0 && (
                          <div className="absolute top-0.5 left-0.5 bg-primary rounded-sm w-3.5 h-3.5 flex items-center justify-center">
                            <Check size={8} className="text-white" strokeWidth={3} />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-0.5">
                          {idx !== 0 && (
                            <button type="button" title="Hacer principal"
                              onClick={(e) => { e.stopPropagation(); handleSetPendingMain(idx); }}
                              className="p-1 rounded text-white hover:text-primary transition-colors"
                            ><Check size={12} /></button>
                          )}
                          <button type="button" title="Eliminar"
                            onClick={(e) => { e.stopPropagation(); handleRemovePendingImage(idx); }}
                            className="p-1 rounded text-white hover:text-red-400 transition-colors"
                          ><X size={12} /></button>
                        </div>
                      </div>
                    ))
                  )}

                  {/* Botón agregar (oculto al llegar al máximo) */}
                  {galleryCount < 5 && (
                    <button type="button" title="Agregar imagen"
                      onClick={() => addImgInputRef.current?.click()}
                      disabled={busyAddImg}
                      className="w-11 h-11 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted hover:text-primary hover:border-primary transition-colors shrink-0"
                    >
                      {busyAddImg ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    </button>
                  )}
                  <input ref={addImgInputRef} type="file" accept="image/*" hidden
                    onChange={(e) => { const f = e.target.files?.[0] ?? null; e.currentTarget.value = ""; if (f) void handleAddImage(f); }}
                  />
                </div>

                {/* Contador y formato */}
                <span className="text-[10px] text-muted">{galleryCount}/5 · PNG, JPG, WebP</span>
              </div>
            </div>

            {/* ── Columna derecha: SKU+Categoría / Nombre / Descripción / config ── */}
            <div className="flex-1 min-w-0 flex flex-col gap-3">

              {/* Fila 1: SKU | Categoría | Grupo */}
              <div className={cn("grid gap-2", draft.articleType === "SERVICE" ? "grid-cols-2" : "grid-cols-3")}>
                <TPField
                  label="SKU"
                  required={draft.barcodeSource === "SKU"}
                  error={submitted && !draft.sku.trim() && draft.barcodeSource === "SKU" ? "Requerido" : undefined}
                  hint={(variants.length > 0 || variantAxes.length > 0) ? "Base para SKU de variantes" : undefined}
                  labelRight={
                    <button type="button" onClick={() => setAdvancedModalOpen(true)}
                      className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
                    >
                      <Sliders size={11} /><span>Avanzado</span>
                    </button>
                  }
                >
                  <TPInput
                    value={draft.sku}
                    onChange={(v) => set("sku", v)}
                    disabled={draft.barcodeSource === "CODE"}
                    inputRef={skuInputRef}
                    placeholder={
                      draft.barcodeSource === "SKU"   ? "Ej: AR-0001" :
                      draft.barcodeSource === "CODE"  ? "(automático)" :
                                                        "Opcional"
                    }
                  />
                </TPField>
                {draft.articleType !== "SERVICE" && (
                  <TPField
                    label="Categoría"
                    labelRight={
                      <button
                        type="button"
                        onClick={() => setCreateCatOpen(true)}
                        className="flex items-center gap-0.5 text-primary hover:underline leading-none"
                      >
                        <Plus size={11} />
                        Nueva
                      </button>
                    }
                  >
                    <TPComboFixed
                      value={draft.categoryId}
                      onChange={(v) => set("categoryId", v)}
                      options={categoryOptions}
                      searchable
                    />
                  </TPField>
                )}
                <GroupPickerField
                  value={draft.groupId}
                  onChange={(v) => set("groupId", v)}
                  groups={groups}
                  onGroupCreated={(g) => setGroups(prev => [...prev, g])}
                />
              </div>

              {/* Fila 2: Nombre */}
              <TPField label="Nombre" required
                error={submitted && !draft.name.trim() ? "Requerido" : undefined}
              >
                <TPInput
                  value={draft.name}
                  onChange={(v) => set("name", v)}
                  placeholder="Ej: Anillo de oro"
                />
              </TPField>

              {/* Fila 3: Descripción */}
              <TPField label="Descripción">
                <TPInput
                  value={draft.description}
                  onChange={(v) => set("description", v)}
                  placeholder="Descripción visible en tienda (opcional)"
                />
              </TPField>

              {/* Banner informativo para Servicios */}
              {draft.articleType === "SERVICE" && (
                <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/8 px-3 py-2 text-xs text-blue-300">
                  <Info size={12} className="shrink-0 mt-0.5" />
                  <span>Los servicios no manejan stock ni punto de reposición. El costo se calcula siempre de forma manual.</span>
                </div>
              )}

              {/* Separador visual */}
              <div className="border-t border-border/40" />

              {/* Config 2×2: Tipo / Estado / StockMode / ReorderPoint */}
              <div className="grid grid-cols-3 gap-2">
                <TPField label="Tipo">
                  <TPComboFixed
                    value={draft.articleType}
                    onChange={(v) => set("articleType", v as ArticleType)}
                    options={articleTypeOptions}
                    onSetFavorite={handleSetDefaultArticleType}
                  />
                </TPField>
                <TPField
                  label="Modo de stock"
                  hint={draft.articleType === "SERVICE" ? "Los servicios no manejan stock" : undefined}
                >
                  <TPComboFixed
                    value={draft.stockMode}
                    onChange={(v) => set("stockMode", v as StockMode)}
                    options={stockModeOptions}
                    disabled={draft.articleType === "SERVICE"}
                    onSetFavorite={handleSetDefaultStockMode}
                    favoriteValue={defaultStockMode}
                  />
                </TPField>
                <TPField label="Estado">
                  <TPComboFixed
                    value={draft.status}
                    onChange={(v) => set("status", v as ArticleStatus)}
                    options={statusOptions}
                    onSetFavorite={handleSetDefaultStatus}
                    favoriteValue={defaultStatus}
                  />
                </TPField>
              </div>

            </div>
          </div>
        </div>

        {/* ── Código de barras CUSTOM (condicional) ─────────────────── */}
        {draft.barcodeSource === "CUSTOM" && (
          <div className="rounded-lg border border-border bg-surface2 p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">Código que se imprimirá y escaneará</p>
              <p className="text-xs text-muted mt-0.5">Independiente del SKU. Usalo si trabajás con el código del proveedor o uno propio.</p>
            </div>
            <TPField label="Código de barras">
              <div className="flex flex-col gap-2">
                <TPInput
                  value={draft.barcode}
                  onChange={(v) => set("barcode", v)}
                  placeholder="Escaneá o escribí el código"
                  disabled={draft.autoBarcode}
                />
                <TPComboFixed
                  value={draft.barcodeType}
                  onChange={(v) => set("barcodeType", v as BarcodeType)}
                  options={barcodeTypeOptions}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted">
                {draft.barcodeType === "CODE128" && "Permite letras y números. Recomendado para uso interno."}
                {draft.barcodeType === "EAN13"   && "Usa 13 números. Recomendado si el producto ya tiene un código comercial del proveedor."}
                {draft.barcodeType === "QR"      && "Permite almacenar más información. Útil para usos especiales o integración externa."}
              </p>
              <div className="mt-2">
                <TPCheckbox
                  checked={draft.autoBarcode}
                  onChange={(v) => { set("autoBarcode", v); if (v) set("barcode", ""); }}
                  label="Generar código automáticamente al guardar"
                />
              </div>
            </TPField>
          </div>
        )}

        {/* ── Atributos de categoría (condicional) ──────────────────── */}
        {draft.categoryId && artAttrs.length > 0 && (
          <TPCard title="Atributos de categoría" bodyClassName="pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {artAttrs.map(attr => (
                <TPField
                  key={attr.id}
                  label={attr.definition.name}
                  required={attr.isRequired}
                  error={
                    submitted && attr.isRequired && !(artAttrValues[attr.id] ?? "").trim()
                      ? "Requerido"
                      : undefined
                  }
                >
                  {renderArtAttrInput(attr)}
                </TPField>
              ))}
            </div>
          </TPCard>
        )}

        {/* ── Hint: sin variantes / CTA variantes ───────────────────── */}
        {draft.categoryId && !variantAxesLoading && variantAxes.length === 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface2/40 px-3 py-2">
            <Layers size={12} className="shrink-0 text-muted/60" />
            <p className="text-xs text-muted">Esta categoría no tiene variantes configuradas.</p>
          </div>
        )}
        {draft.categoryId && variantAxes.length > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <Layers size={12} className="shrink-0 text-primary" />
              <p className="text-xs text-muted truncate">
                <span className="font-medium text-text">
                  {variantAxes.length} eje{variantAxes.length !== 1 ? "s" : ""}:
                </span>
                {" "}{variantAxes.map(a => a.definition.name).join(" · ")}
              </p>
            </div>
            <button type="button" onClick={() => setActiveTab("variantes")}
              className="flex items-center gap-1 shrink-0 text-xs font-medium text-primary hover:underline"
            >
              Configurar <ArrowRight size={10} />
            </button>
          </div>
        )}

        {/* ── Modal: Opciones avanzadas de código de barras ─────────── */}
        <Modal
          open={advancedModalOpen}
          title="Opciones avanzadas de identificación"
          onClose={() => setAdvancedModalOpen(false)}
          maxWidth="sm"
          footer={
            <div className="flex justify-end">
              <TPButton iconLeft={<Check size={14} />} onClick={() => setAdvancedModalOpen(false)}>Listo</TPButton>
            </div>
          }
        >
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
                ¿Qué querés usar como código de barras?
              </p>
              <div className="space-y-2">
                {([
                  { src: "SKU"    as BarcodeSource, title: "SKU",                  desc: "Usa el SKU como valor para imprimir y escanear." },
                  { src: "CODE"   as BarcodeSource, title: "Código del artículo",  desc: "Usa el código interno del sistema como valor para imprimir y escanear." },
                  { src: "CUSTOM" as BarcodeSource, title: "Código personalizado", desc: "Permite ingresar un código manual, por ejemplo el del proveedor o uno propio." },
                ]).map(({ src, title, desc }) => (
                  <button key={src} type="button"
                    onClick={() => {
                      set("barcodeSource", src);
                      localStorage.setItem("tptech.article.barcodeSource.last", src);
                    }}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-lg border transition-colors",
                      draft.barcodeSource === src
                        ? "border-primary bg-primary/5"
                        : "border-border bg-surface hover:bg-surface2"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={cn(
                        "mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex-shrink-0",
                        draft.barcodeSource === src ? "border-primary bg-primary" : "border-muted"
                      )} />
                      <div>
                        <div className="text-sm font-medium text-foreground">{title}</div>
                        <div className="text-xs text-muted mt-0.5">{desc}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
                Vista previa del código a escanear
              </p>
              {draft.barcodeSource === "SKU" && (
                <div className="px-3 py-2.5 bg-muted/20 rounded-lg border border-border font-mono text-sm">
                  {draft.sku.trim() ? draft.sku.trim() : <span className="text-amber-500 text-xs">⚠ Completá el campo SKU</span>}
                </div>
              )}
              {draft.barcodeSource === "CODE" && (
                <div className="px-3 py-2.5 bg-muted/20 rounded-lg border border-border font-mono text-sm">
                  {draft.code.trim() ? draft.code.trim() : <span className="text-muted italic text-xs">Se generará cuando guardes</span>}
                </div>
              )}
              {draft.barcodeSource === "CUSTOM" && (
                <div className="px-3 py-2.5 bg-muted/20 rounded-lg border border-border text-xs text-muted italic">
                  {draft.barcode.trim()
                    ? <span className="font-mono not-italic text-sm text-foreground">{draft.barcode.trim()}</span>
                    : draft.autoBarcode ? "Se generará automáticamente al guardar"
                    : "Configurá el código en la sección principal del artículo"}
                </div>
              )}
            </div>
          </div>
        </Modal>

        <EntityEditModal
          open={newSupplierModalOpen}
          mode="CREATE"
          isSupplierContext
          suppressNavigate
          onClose={() => setNewSupplierModalOpen(false)}
          onSaved={handleSupplierCreated}
        />

        <CreateCategoryModal
          open={createCatOpen}
          onClose={() => setCreateCatOpen(false)}
          categories={categories}
          initialParentId={draft.categoryId || undefined}
          onCreated={async (id) => {
            await loadCategories();
            set("categoryId", id);
          }}
        />
      </div>
    );
  }

  function addCostLine(type: CostLineType) {
    const line: CostLine = {
      id:             crypto.randomUUID(),
      type,
      label:          type === "HECHURA" ? "Precio / Hechura" : "",
      quantity:       1,
      quantityUnit:   type === "HECHURA"
        ? (multiplierBaseItems.find(w => w.isFavorite && w.isActive !== false)?.label ?? defaultQuantityUnit(type))
        : defaultQuantityUnit(type),
      unitValue:      type === "METAL" ? (metalVariants.find(m => m.isFavorite)?.finalSalePrice != null ? Number(metalVariants.find(m => m.isFavorite)!.finalSalePrice) : 0) : 0,
      currencyId:     null,
      mermaPercent:   type === "METAL" ? (draft.mermaPercent ?? null) : null,
      metalVariantId: type === "METAL" ? (metalVariants.find(m => m.isFavorite)?.id ?? null) : null,
      sortOrder:      costLines.length,
      lineAdjKind:    "",
      lineAdjType:    "",
      lineAdjValue:   null,
    };
    setCostLines(prev => [...prev, line]);
  }

  function renderTabCostos() {
    const isService = draft.articleType === "SERVICE";

    const metalVariantOptions: MetalVariantOption[] = metalVariants.map((mv) => ({
      id:               mv.id,
      label:            `${(mv as any)._metalName ? `${(mv as any)._metalName} — ` : ""}${mv.name}`,
      latestQuotePrice: mv.finalSalePrice != null ? Number(mv.finalSalePrice) : null,
      isFavorite:       mv.isFavorite,
      metalId:          mv.metalId,
    }));
    const currencyOptions: CurrencyOption[] = currencies.map((c) => ({
      id:         c.id,
      code:       c.code,
      symbol:     c.symbol,
      isBase:     c.isBase,
      latestRate: c.latestRate ?? null,
    }));
    const baseCurrency       = currencies.find(c => c.isBase);
    const baseCurrencyId     = baseCurrency?.id     ?? "";
    const baseCurrencySymbol = baseCurrency?.symbol ?? "$";

    return (
      <div className="space-y-3">

        {(() => {
          function fmtN(n: number) {
            return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          }
          const patchLine = (i: number, patch: Partial<CostLine>) => {
            setCostLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
          };
          const dropLine = (i: number) => {
            setConfirmDropIdx(i);
          };
          const calcLine = (line: CostLine): number => {
            if (!line.quantity || !line.unitValue) return 0;
            let raw = line.type === "METAL"
              ? line.quantity * (1 + (line.mermaPercent ?? 0) / 100) * line.unitValue
              : line.quantity * line.unitValue;
            if (line.type !== "METAL") raw = applyLineAdj(raw, line.lineAdjKind ?? "", line.lineAdjType ?? "", line.lineAdjValue ?? null);
            const currId = line.currencyId ?? baseCurrencyId;
            if (currId !== baseCurrencyId) {
              const curr = currencyOptions.find(c => c.id === currId);
              if (curr?.latestRate != null) raw = raw * curr.latestRate;
              else return 0;
            }
            return raw;
          };

          const metalLinesIdx   = costLines.map((l, i) => ({ line: l, i })).filter(({ line }) => line.type === "METAL");
          const hechuraLinesIdx = costLines.map((l, i) => ({ line: l, i })).filter(({ line }) => line.type === "HECHURA");
          const otherLinesIdx   = costLines.map((l, i) => ({ line: l, i })).filter(({ line }) => line.type !== "METAL" && line.type !== "HECHURA");

          const productLinesIdx = costLines.map((l, i) => ({ line: l, i })).filter(({ line }) => line.type === "PRODUCT");
          const serviceLinesIdx = costLines.map((l, i) => ({ line: l, i })).filter(({ line }) => line.type === "SERVICE");

          const metalTotal   = metalLinesIdx.reduce((s, { line }) => s + calcLine(line), 0);
          const hechuraTotal = hechuraLinesIdx.reduce((s, { line }) => s + calcLine(line), 0);
          const productTotal = productLinesIdx.reduce((s, { line }) => s + calcLine(line), 0);
          const serviceTotal = serviceLinesIdx.reduce((s, { line }) => s + calcLine(line), 0);
          const otherTotal   = productTotal + serviceTotal;
          const rawBase      = metalTotal + hechuraTotal + otherTotal;

          // Flags para indicar visualmente si alguna línea del grupo tiene ajuste propio
          const lineAdjActive = (l: CostLine) => l.lineAdjKind && l.lineAdjKind !== "" && (l.lineAdjValue ?? 0) > 0;
          const metalHasLineAdj   = metalLinesIdx.some(({ line }) => lineAdjActive(line));
          const hechuraHasLineAdj = hechuraLinesIdx.some(({ line }) => lineAdjActive(line));
          const productHasLineAdj = productLinesIdx.some(({ line }) => lineAdjActive(line));
          const serviceHasLineAdj = serviceLinesIdx.some(({ line }) => lineAdjActive(line));

          const taxOptions    = taxes.filter(t => t.calculationType === "PERCENTAGE" && t.rate != null);
          const selectedTaxes = taxOptions.filter(t => draft.manualTaxIds.includes(t.id));
          const totalTaxPct   = selectedTaxes.reduce((s, t) => s + parseFloat(t.rate!), 0);

          const adjVal       = Math.abs(draft.manualAdjustmentValue ?? 0);
          const adjSign      = draft.manualAdjustmentKind === "" ? 0 : draft.manualAdjustmentKind === "SURCHARGE" ? 1 : -1;
          const adjAmount    = adjSign * (draft.manualAdjustmentType === "PERCENTAGE" ? rawBase * (adjVal / 100) : adjVal);
          const adjustedCost = rawBase + adjAmount;
          const taxAmount    = totalTaxPct > 0 ? adjustedCost * (totalTaxPct / 100) : 0;
          const finalCost    = adjustedCost + taxAmount;
          const selSym       = baseCurrencySymbol;

          // Chip de tipo de línea
          const TYPE_CHIP: Record<string, { label: string; cls: string }> = {
            METAL:   { label: "Metal",    cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
            HECHURA: { label: "Hechura",  cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400"   },
            PRODUCT: { label: "Producto", cls: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
            SERVICE: { label: "Servicio", cls: "bg-green-500/15 text-green-600 dark:text-green-400" },
          };
          const SUBTOTAL_COLOR: Record<string, string> = {
            METAL:   "text-amber-600 dark:text-amber-400",
            HECHURA: "text-blue-600 dark:text-blue-400",
            PRODUCT: "text-violet-600 dark:text-violet-400",
            SERVICE: "text-green-600 dark:text-green-400",
          };
          // ROW_BG se usa en SortableCostLineRow (módulo level: COST_ROW_BG)

          return (
            <div className="space-y-2">

              {/* ── Costo guardado por el backend ─────────────────── */}
              {isEdit && computed && (
                <div className={cn(
                  "rounded-xl border p-3 flex items-start gap-3",
                  computed.partial ? "border-amber-500/30 bg-amber-500/10" : "border-emerald-500/30 bg-emerald-500/10"
                )}>
                  <div className="shrink-0 mt-0.5">
                    {computed.partial ? <AlertCircle size={15} className="text-amber-400" /> : <Calculator size={15} className="text-emerald-400" />}
                  </div>
                  <div className="flex-1 min-w-0 text-sm">
                    <span className="font-medium text-text">Costo guardado: </span>
                    <span className={computed.partial ? "text-amber-300" : "text-emerald-300"}>
                      {computed.value != null ? fmtMoney(computed.value) : "—"}
                    </span>
                    {article?.computedCostWithTax != null && article.computedCostWithTax !== article.computedCostBase && (
                      <span className="ml-3 text-sm">
                        <span className="font-medium text-text">c/imp: </span>
                        <span className={computed.partial ? "text-amber-300" : "text-emerald-300"}>
                          {fmtMoney(article.computedCostWithTax)}
                        </span>
                      </span>
                    )}
                    {computed.partial && <div className="text-xs text-amber-300/80 mt-0.5">Cálculo parcial — alguna línea no tiene cotización.</div>}
                  </div>
                  <button type="button" onClick={recomputeCost} disabled={loadingCost}
                    className="shrink-0 h-7 w-7 rounded-lg border border-border bg-surface2/40 grid place-items-center hover:bg-surface2 transition" title="Recalcular">
                    {loadingCost ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  </button>
                </div>
              )}

              {/* ── TABLA DE LÍNEAS ───────────────────────────────── */}
              <div className="rounded-xl border border-border overflow-hidden">

                {/* Header con botones de agregar */}
                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-surface2/40 border-b border-border/60">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-text">Composición de costo</span>
                    {costLines.length > 0 && (
                      <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                        {costLines.length}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    {metalLinesIdx.some(({ line }) => line.metalVariantId) && (
                      <button type="button" onClick={updateMetalPrices}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-md border transition bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20">
                        <RefreshCw size={9} />
                        Actualizar
                      </button>
                    )}
                    {(["METAL","HECHURA","PRODUCT","SERVICE"] as CostLineType[]).map((type) => {
                      const cfg = TYPE_CHIP[type];
                      return (
                        <button key={type} type="button" onClick={() => addCostLine(type)}
                          className={cn(
                            "inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] rounded-md border transition",
                            cfg.cls, "border-current/30 bg-current/5 hover:bg-current/15"
                          )}>
                          <Plus size={9} />
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tabla de líneas */}
                {costLines.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-muted">Sin líneas de costo. Usá los botones de arriba para agregar metal, hechura u otros costos.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs min-w-[600px]">
                      <thead>
                        <tr className="border-b border-border/50 bg-surface2/20">
                          <th className="w-6"></th>
                          <th className="pl-[18px] pr-[9px] py-1.5 text-left text-[10px] font-semibold text-muted/70 uppercase tracking-wider whitespace-nowrap w-[70px]">Tipo</th>
                          <th className="pl-[9px] pr-[18px] py-1.5 text-left text-[10px] font-semibold text-muted/70 uppercase tracking-wider whitespace-nowrap w-[44px]">Mon.</th>
                          <th className="px-[18px] py-1.5 text-left text-[10px] font-semibold text-muted/70 uppercase tracking-wider w-[160px]">Descripción / Variante</th>
                          <th className="px-[18px] py-1.5 text-left text-[10px] font-semibold text-muted/70 uppercase tracking-wider whitespace-nowrap w-[80px]">Cant.</th>
                          <th className="px-[18px] py-1.5 text-left text-[10px] font-semibold text-muted/70 uppercase tracking-wider whitespace-nowrap w-[110px]">Precio unit.</th>
                          <th className="px-[18px] py-1.5 text-left text-[10px] font-semibold text-muted/70 uppercase tracking-wider whitespace-nowrap w-[130px]">Bonif. / Recargo</th>
                          <th className="px-[18px] py-1.5 text-right text-[10px] font-semibold text-muted/70 uppercase tracking-wider whitespace-nowrap w-[110px]">Subtotal</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleCostLineDragEnd}>
                        <SortableContext items={costLines.map(l => l.id!)} strategy={verticalListSortingStrategy}>
                      <tbody className="divide-y divide-border/30">
                        {costLines.map((line, i) => {
                          const isMetal    = line.type === "METAL";
                          const lineTotal  = calcLine(line);
                          const currForLine = currencyOptions.find(c => c.id === (line.currencyId ?? baseCurrencyId)) ?? currencyOptions.find(c => c.isBase);
                          const chip = TYPE_CHIP[line.type] ?? { label: line.type, cls: "bg-surface2 text-muted" };
                          return (
                            <SortableCostLineRow key={line.id ?? i} id={line.id!} type={line.type}>

                              {/* Tipo */}
                              <td className="pl-[18px] pr-[9px] py-1.5 align-middle">
                                <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold leading-none", chip.cls)}>
                                  {chip.label}
                                </span>
                              </td>

                              {/* Moneda */}
                              <td className="pl-[9px] pr-[18px] py-1.5 align-middle">
                                <TPComboFixed
                                  value={line.currencyId ?? baseCurrencyId}
                                  onChange={(v) => {
                                    const newCurrId  = v || null;
                                    const oldRate    = currencyOptions.find(c => c.id === (line.currencyId ?? baseCurrencyId))?.latestRate ?? 1;
                                    const newRate    = currencyOptions.find(c => c.id === (newCurrId    ?? baseCurrencyId))?.latestRate ?? 1;
                                    const inBase     = line.unitValue * oldRate;
                                    const converted  = newRate ? Math.round((inBase / newRate) * 10000) / 10000 : line.unitValue;
                                    patchLine(i, { currencyId: newCurrId, unitValue: converted });
                                  }}
                                  options={currencyOptions.map(c => ({ value: c.id, label: c.code }))}
                                />
                              </td>

                              {/* Descripción / Variante */}
                              <td className="px-[18px] py-1.5 align-middle">
                                {isMetal ? (
                                  <TPComboFixed
                                    value={line.metalVariantId ?? ""}
                                    onChange={(v) => {
                                      const mv = metalVariantOptions.find(m => m.id === v);
                                      // latestQuotePrice está en moneda base; si la línea ya tiene otra moneda, convertir
                                      let unitValue = mv?.latestQuotePrice ?? line.unitValue;
                                      if (mv?.latestQuotePrice != null && line.currencyId && line.currencyId !== baseCurrencyId) {
                                        const lineRate = currencyOptions.find(c => c.id === line.currencyId)?.latestRate ?? 1;
                                        if (lineRate) unitValue = Math.round((mv.latestQuotePrice / lineRate) * 10000) / 10000;
                                      }
                                      patchLine(i, { metalVariantId: v || null, unitValue });
                                    }}
                                    options={[
                                      { value: "", label: "Seleccionar variante…" },
                                      ...metalVariantOptions.map(mv => ({ value: mv.id, label: mv.label, isFavorite: mv.isFavorite })),
                                    ]}
                                    searchable
                                    favoriteValue={metalVariants.find(m => m.isFavorite)?.id}
                                    onSetFavorite={async (variantId) => {
                                      const mv = metalVariants.find(m => m.id === variantId);
                                      if (!mv) return;
                                      const wasFav = mv.isFavorite;
                                      const prevVariants = metalVariants;
                                      setMetalVariants(prev => prev.map(m => ({
                                        ...m,
                                        isFavorite: m.metalId === mv.metalId
                                          ? m.id === variantId && !wasFav
                                          : m.isFavorite,
                                      })));
                                      try {
                                        if (!wasFav) {
                                          await setFavoriteVariant(variantId, mv.metalId);
                                        } else {
                                          await clearFavoriteVariant(mv.metalId);
                                        }
                                      } catch {
                                        setMetalVariants(prevVariants);
                                        toast.error("No se pudo actualizar el favorito");
                                      }
                                    }}
                                  />
                                ) : line.type === "PRODUCT" ? (
                                  <TPComboFixed
                                    value={line.catalogItemId ?? ""}
                                    onChange={(v) => {
                                      const item = productItems.find(p => p.id === v);
                                      if (!item) { patchLine(i, { label: v, catalogItemId: null }); return; }
                                      let unitValue  = item.costPrice ?? line.unitValue;
                                      let currencyId = item.manualCurrencyId ?? line.currencyId;
                                      // Si el usuario ya eligió moneda, convertir precio del artículo a esa moneda
                                      if (line.currencyId && item.costPrice != null) {
                                        const itemRate = currencyOptions.find(c => c.id === (item.manualCurrencyId ?? baseCurrencyId))?.latestRate ?? 1;
                                        const lineRate = currencyOptions.find(c => c.id === line.currencyId)?.latestRate ?? 1;
                                        const inBase   = item.costPrice * itemRate;
                                        unitValue  = lineRate ? Math.round((inBase / lineRate) * 10000) / 10000 : inBase;
                                        currencyId = line.currencyId;
                                      }
                                      patchLine(i, { label: item.name ?? v, catalogItemId: item.id, unitValue, currencyId });
                                    }}
                                    options={[
                                      { value: "", label: "Seleccionar producto…" },
                                      ...productItems.map(p => ({ value: p.id, label: p.name })),
                                    ]}
                                    searchable
                                  />
                                ) : line.type === "SERVICE" ? (
                                  <TPComboFixed
                                    value={line.catalogItemId ?? ""}
                                    onChange={(v) => {
                                      const item = serviceItems.find(s => s.id === v);
                                      if (!item) { patchLine(i, { label: v, catalogItemId: null }); return; }
                                      let unitValue  = item.costPrice ?? line.unitValue;
                                      let currencyId = item.manualCurrencyId ?? line.currencyId;
                                      // Si el usuario ya eligió moneda, convertir precio del artículo a esa moneda
                                      if (line.currencyId && item.costPrice != null) {
                                        const itemRate = currencyOptions.find(c => c.id === (item.manualCurrencyId ?? baseCurrencyId))?.latestRate ?? 1;
                                        const lineRate = currencyOptions.find(c => c.id === line.currencyId)?.latestRate ?? 1;
                                        const inBase   = item.costPrice * itemRate;
                                        unitValue  = lineRate ? Math.round((inBase / lineRate) * 10000) / 10000 : inBase;
                                        currencyId = line.currencyId;
                                      }
                                      patchLine(i, { label: item.name ?? v, catalogItemId: item.id, unitValue, currencyId });
                                    }}
                                    options={[
                                      { value: "", label: "Seleccionar servicio…" },
                                      ...serviceItems.map(s => ({ value: s.id, label: s.name })),
                                    ]}
                                    searchable
                                  />
                                ) : (
                                  <TPInput
                                    value={line.label}
                                    onChange={(v) => patchLine(i, { label: v })}
                                    placeholder="Precio / Hechura…"
                                  />
                                )}
                              </td>

                              {/* Cantidad */}
                              <td className="px-[18px] py-1.5 align-middle">
                                <div className="flex items-center gap-1">
                                  <div className="flex-1 min-w-0">
                                    <TPNumberInput
                                      value={line.quantity}
                                      onChange={(v) => patchLine(i, { quantity: v ?? 0 })}
                                      decimals={2}
                                      step={isMetal ? 0.1 : undefined}
                                      min={0}
                                    />
                                  </div>
                                  {line.type === "HECHURA" && (() => {
                                    const pickerId = `qty-${line.id}`;
                                    return (
                                      <div
                                        className="relative shrink-0"
                                        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setUnitPickerOpen(null); }}
                                      >
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                            setUnitPickerPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 120) });
                                            setUnitPickerOpen(v => v === pickerId ? null : pickerId);
                                          }}
                                          className="h-7 px-1.5 flex items-center rounded border border-border bg-transparent text-[10px] font-bold text-muted hover:text-text hover:border-primary/50 transition"
                                          title="Unidad de cantidad"
                                        >
                                          {line.quantityUnit || "u"}
                                        </button>
                                        {unitPickerOpen === pickerId && ReactDOM.createPortal(
                                          <div
                                            style={{ position: "fixed", top: unitPickerPos.top, left: unitPickerPos.left, minWidth: unitPickerPos.width, zIndex: 9999 }}
                                            className="rounded-lg border border-border bg-surface shadow-lg py-1 max-h-48 overflow-y-auto"
                                          >
                                            {multiplierBaseItems.filter(w => w.isActive !== false).map(w => (
                                              <div key={w.id} className="flex items-center gap-1 px-2 hover:bg-surface2 transition">
                                                <button
                                                  type="button"
                                                  onMouseDown={() => { patchLine(i, { quantityUnit: w.label as QuantityUnit }); setUnitPickerOpen(null); }}
                                                  className={cn("flex-1 text-left py-1.5 text-xs", line.quantityUnit === w.label && "text-primary font-semibold")}
                                                >
                                                  {w.label}
                                                </button>
                                                <button
                                                  type="button"
                                                  title={w.isFavorite ? "Quitar de favoritos" : "Marcar como favorito"}
                                                  onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    if (!w.isFavorite) patchLine(i, { quantityUnit: w.label as QuantityUnit });
                                                    void toggleCatalogFavorite(w.id, !!w.isFavorite, setMultiplierBaseItems);
                                                  }}
                                                  className={cn("shrink-0 transition-colors", w.isFavorite ? "text-yellow-400" : "text-muted/20 hover:text-yellow-400")}
                                                >
                                                  <Star size={11} className={w.isFavorite ? "fill-yellow-400" : ""} />
                                                </button>
                                              </div>
                                            ))}
                                          </div>,
                                          document.body
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </td>


                              {/* Precio unitario */}
                              <td className="px-[18px] py-1.5 align-middle">
                                <TPNumberInput
                                  value={line.unitValue}
                                  onChange={(v) => patchLine(i, { unitValue: v ?? 0 })}
                                  decimals={2}
                                  min={0}
                                  leftIcon={<span className="text-[10px] font-semibold text-muted">{currForLine?.symbol ?? selSym}</span>}
                                />
                              </td>

                              {/* Bonif. / Recargo — oculto para METAL */}
                              <td className="px-[18px] py-1.5 align-middle">
                                {line.type !== "METAL" ? (
                                  <div className="flex items-center gap-1">
                                    {/* ± toggle: "" → BONUS → SURCHARGE → "" */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (line.lineAdjKind === "")          patchLine(i, { lineAdjKind: "BONUS",     lineAdjType: line.lineAdjType || "PERCENTAGE" });
                                        else if (line.lineAdjKind === "BONUS")     patchLine(i, { lineAdjKind: "SURCHARGE" });
                                        else                                        patchLine(i, { lineAdjKind: "",         lineAdjType: "", lineAdjValue: null });
                                      }}
                                      className={cn(
                                        "shrink-0 h-7 w-7 rounded border text-[11px] font-bold transition grid place-items-center",
                                        line.lineAdjKind === "BONUS"     && "border-emerald-500/50 text-emerald-500 bg-emerald-500/5",
                                        line.lineAdjKind === "SURCHARGE" && "border-amber-500/50 text-amber-500 bg-amber-500/5",
                                        line.lineAdjKind === ""          && "border-border/50 text-muted/35",
                                      )}
                                      title="Bonificación (−) / Recargo (+)"
                                    >
                                      {line.lineAdjKind === "SURCHARGE" ? "+" : line.lineAdjKind === "BONUS" ? "−" : "±"}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                      <TPNumberInput
                                        value={line.lineAdjValue}
                                        onChange={(v) => patchLine(i, { lineAdjValue: v ?? null })}
                                        decimals={2}
                                        min={0}
                                        disabled={line.lineAdjKind === ""}
                                      />
                                    </div>
                                    {/* %/$ toggle */}
                                    <button
                                      type="button"
                                      onClick={() => patchLine(i, {
                                        lineAdjType: (line.lineAdjType || "PERCENTAGE") === "PERCENTAGE" ? "FIXED_AMOUNT" : "PERCENTAGE",
                                      })}
                                      disabled={line.lineAdjKind === ""}
                                      className={cn(
                                        "shrink-0 h-7 w-7 rounded border text-[10px] font-bold transition grid place-items-center",
                                        line.lineAdjKind !== ""
                                          ? "border-border text-muted hover:text-text hover:border-primary/50"
                                          : "border-border/30 text-muted/25 cursor-default",
                                      )}
                                      title="Cambiar entre % y monto fijo"
                                    >
                                      {(line.lineAdjType || "PERCENTAGE") === "PERCENTAGE" ? "%" : "$"}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-muted/30">—</span>
                                )}
                              </td>

                              {/* Subtotal */}
                              <td className="px-[18px] py-1.5 text-right align-middle">
                                {lineTotal > 0 ? (
                                  <div>
                                    <span className={cn("tabular-nums font-bold text-sm", SUBTOTAL_COLOR[line.type] ?? "text-text")}>
                                      {selSym} {fmtN(lineTotal)}
                                    </span>
                                    <div className="text-[10px] text-muted/50 tabular-nums">
                                      {fmtN(line.quantity)} {line.quantityUnit} × {currForLine?.symbol ?? selSym} {fmtN(line.unitValue)}
                                    </div>
                                    {line.currencyId && line.currencyId !== baseCurrencyId && currForLine?.latestRate != null && (
                                      <div className="text-[10px] text-muted/40 tabular-nums">
                                        Resultado: {currForLine.symbol} {fmtN(lineTotal / currForLine.latestRate)}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted/30">—</span>
                                )}
                              </td>

                              {/* Eliminar */}
                              <td className="px-[18px] py-1.5 align-middle text-right">
                                <TPIconButton
                                  onClick={() => dropLine(i)}
                                  className="opacity-0 group-hover:opacity-100 h-7 w-7 hover:text-red-400 hover:border-red-400/40 transition-all ml-auto"
                                  title="Eliminar fila"
                                >
                                  <X size={13} />
                                </TPIconButton>
                              </td>
                            </SortableCostLineRow>
                          );
                        })}
                      </tbody>
                        </SortableContext>
                      </DndContext>
                    </table>
                  </div>
                )}

                {/* Advertencia: variante sin cotización */}
                {metalLinesIdx.some(({ line }) => !line.unitValue && line.metalVariantId) && (
                  <div className="flex items-center gap-1.5 px-3 py-2 border-t border-border/40 text-[11px] text-amber-500/80">
                    <AlertCircle size={11} className="shrink-0" />
                    Alguna variante de metal no tiene cotización. Ingresá el valor por gramo manualmente.
                  </div>
                )}

                {/* Footer: resumen por tipo */}
                {rawBase > 0 && (
                  <div className="border-t border-border/60 bg-surface2/30 px-4 py-2.5">
                    <div className="flex items-center justify-end gap-5 flex-wrap text-xs">
                      {metalTotal > 0 && (
                        <span className="text-muted">
                          Metal: <span className="font-bold tabular-nums text-amber-600 dark:text-amber-400">{selSym} {fmtN(metalTotal)}</span>
                        </span>
                      )}
                      {hechuraTotal > 0 && (
                        <span className="text-muted">
                          Hechura: <span className="font-bold tabular-nums text-blue-600 dark:text-blue-400">{selSym} {fmtN(hechuraTotal)}</span>
                        </span>
                      )}
                      {productTotal > 0 && (
                        <span className="text-muted">
                          Productos: <span className="font-bold tabular-nums text-violet-600 dark:text-violet-400">{selSym} {fmtN(productTotal)}</span>
                        </span>
                      )}
                      {serviceTotal > 0 && (
                        <span className="text-muted">
                          Servicios: <span className="font-bold tabular-nums text-green-600 dark:text-green-400">{selSym} {fmtN(serviceTotal)}</span>
                        </span>
                      )}
                      <span className="text-muted border-l border-border/60 pl-5">
                        Base: <span className="font-bold tabular-nums text-text">{selSym} {fmtN(rawBase)}</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── AJUSTE + IMPUESTOS (lado a lado) ─────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                {/* Ajuste de costo */}
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="px-3 py-2 bg-surface2/40 border-b border-border/60">
                    <span className="text-xs font-semibold text-text">Ajuste de costo</span>
                  </div>
                  <div className="px-3 py-2 space-y-2">
                    <TPComboFixed
                      value={draft.manualAdjustmentKind}
                      onChange={(v) => {
                        const kind = v as "" | "BONUS" | "SURCHARGE";
                        set("manualAdjustmentKind", kind);
                        if (kind === "") {
                          set("manualAdjustmentType", "");
                          set("manualAdjustmentValue", null);
                        } else if (draft.manualAdjustmentKind === "") {
                          set("manualAdjustmentType", lastAdjTypeRef.current);
                        }
                      }}
                      options={[
                        { value: "",          label: "Sin ajuste" },
                        { value: "BONUS",     label: "Bonificación" },
                        { value: "SURCHARGE", label: "Recargo" },
                      ]}
                    />
                    {draft.manualAdjustmentKind !== "" && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            {(draft.manualAdjustmentType || "PERCENTAGE") === "PERCENTAGE"
                              ? <TPNumberInput
                                  value={draft.manualAdjustmentValue}
                                  onChange={(v) => set("manualAdjustmentValue", v ?? null)}
                                  decimals={2} min={0}
                                  suffix={<span className="text-[11px] font-bold">%</span>}
                                />
                              : <TPNumberInput
                                  value={draft.manualAdjustmentValue}
                                  onChange={(v) => set("manualAdjustmentValue", v ?? null)}
                                  decimals={2} min={0}
                                  leftIcon={<span className="text-[11px] font-semibold text-muted">{selSym}</span>}
                                />
                            }
                          </div>
                          <TPAdjTypeButton
                            value={(draft.manualAdjustmentType || "PERCENTAGE") as "PERCENTAGE" | "FIXED_AMOUNT"}
                            onChange={(t) => { lastAdjTypeRef.current = t; set("manualAdjustmentType", t); }}
                            favoriteValue={defaultAdjType}
                            onSetFavorite={handleSetDefaultAdjType}
                          />
                        </div>
                        {adjAmount !== 0 && rawBase > 0 && (
                          <div className={cn(
                            "text-[10px] tabular-nums text-right",
                            adjAmount < 0 ? "text-emerald-600/80 dark:text-emerald-400/80" : "text-amber-600/80 dark:text-amber-400/80"
                          )}>
                            {draft.manualAdjustmentType === "PERCENTAGE"
                              ? `${selSym} ${fmtN(rawBase)} × ${adjVal}% = ${adjAmount < 0 ? "−" : "+"}${selSym} ${fmtN(Math.abs(adjAmount))}`
                              : `${adjAmount < 0 ? "−" : "+"}${selSym} ${fmtN(Math.abs(adjAmount))} s/ ${selSym} ${fmtN(rawBase)}`
                            }
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Impuestos de compra */}
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="px-3 py-2 bg-surface2/40 border-b border-border/60">
                    <span className="text-xs font-semibold text-text">Impuestos de compra</span>
                  </div>
                  <div className="px-3 py-2 space-y-2">
                    <TPComboCreatableMulti
                      type="IVA_CONDITION"
                      items={taxOptions.map(t => ({ id: t.id, label: t.name, value: t.id, isActive: t.isActive }))}
                      values={draft.manualTaxIds}
                      onChange={(vals) => set("manualTaxIds", vals)}
                      mode={isEdit ? "edit" : "create"}
                      allowCreate={false}
                      placeholder="Seleccioná impuestos…"
                    />
                    {selectedTaxes.length > 0 && (
                      <div className="rounded-lg border border-border/60 bg-surface2/20 overflow-hidden">
                        {selectedTaxes.map((t, idx) => {
                          const pct = t.rate != null ? parseFloat(t.rate!) : 0;
                          const amt = adjustedCost * (pct / 100);
                          return (
                            <div key={t.id} className={cn("flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs", idx > 0 && "border-t border-border/40")}>
                              <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                                <span className="font-medium text-text truncate">{t.name}</span>
                                <span className="text-muted/70">{fmtN(pct)}%</span>
                                {t.includedInPrice
                                  ? <span className="text-[10px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">incl.</span>
                                  : <span className="text-[10px] px-1 py-0.5 rounded bg-surface2 text-muted font-medium border border-border/40">se suma</span>
                                }
                              </div>
                              <span className="tabular-nums font-semibold text-text shrink-0">+ {selSym} {fmtN(amt)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── TOTAL FINAL ───────────────────────────────────── */}
              {rawBase > 0 ? (
                <div className="rounded-xl border border-primary/30 bg-primary/5 overflow-hidden">
                  <div className="px-3 py-2 space-y-1.5">
                    {metalTotal > 0 && (
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span className="flex items-center gap-1.5">
                          Metal
                          {metalHasLineAdj && <span className="text-[10px] italic opacity-55">(incl. ajuste de línea)</span>}
                        </span>
                        <span className="tabular-nums font-medium text-text">{selSym} {fmtN(metalTotal)}</span>
                      </div>
                    )}
                    {hechuraTotal > 0 && (
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span className="flex items-center gap-1.5">
                          Hechura
                          {hechuraHasLineAdj && <span className="text-[10px] italic opacity-55">(incl. ajuste de línea)</span>}
                        </span>
                        <span className="tabular-nums font-medium text-text">{selSym} {fmtN(hechuraTotal)}</span>
                      </div>
                    )}
                    {productTotal > 0 && (
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span className="flex items-center gap-1.5">
                          Productos
                          {productHasLineAdj && <span className="text-[10px] italic opacity-55">(incl. ajuste de línea)</span>}
                        </span>
                        <span className="tabular-nums font-medium text-text">{selSym} {fmtN(productTotal)}</span>
                      </div>
                    )}
                    {serviceTotal > 0 && (
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span className="flex items-center gap-1.5">
                          Servicios
                          {serviceHasLineAdj && <span className="text-[10px] italic opacity-55">(incl. ajuste de línea)</span>}
                        </span>
                        <span className="tabular-nums font-medium text-text">{selSym} {fmtN(serviceTotal)}</span>
                      </div>
                    )}
                    {adjVal !== 0 && (
                      <div className={cn("flex items-center justify-between text-xs", adjAmount < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                        <span>
                          {adjAmount < 0 ? "Bonificación" : "Recargo"} global
                          {draft.manualAdjustmentType === "PERCENTAGE" && ` ${adjVal}%`}
                        </span>
                        <span className="tabular-nums font-medium">
                          {adjAmount < 0 ? "−" : "+"} {selSym} {fmtN(Math.abs(adjAmount))}
                        </span>
                      </div>
                    )}
                    {taxAmount > 0 && (
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span>Impuestos ({fmtN(totalTaxPct)}%)</span>
                        <span className="tabular-nums font-medium text-text">+ {selSym} {fmtN(taxAmount)}</span>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-primary/20 px-3 py-2 flex items-center justify-between gap-4">
                    <span className="text-sm font-semibold text-text">
                      {taxAmount > 0 ? "Costo con impuestos" : "Costo base"}
                    </span>
                    <span className="text-xl font-extrabold tabular-nums text-primary shrink-0">
                      {selSym} {fmtN(finalCost)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-surface2/20 px-5 py-5 text-center">
                  <p className="text-sm text-muted">Usá los botones de arriba para agregar líneas de costo</p>
                </div>
              )}

            </div>
          );
        })()}

      </div>
    );
  }

  function renderTabVariantes() {
    // Sin categoría: mostrar aviso
    if (!draft.categoryId) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <Layers size={40} className="text-muted opacity-40" />
          <p className="text-sm font-medium text-text">Las variantes requieren una categoría</p>
          <p className="text-xs text-muted max-w-xs">
            Seleccioná una categoría en la pestaña <span className="font-medium text-text">General</span> para habilitar la gestión de variantes.
          </p>
        </div>
      );
    }

    // Columnas de ejes en tabla (máx 2 para mobile)
    const axisCols = variantAxes.slice(0, 2);

    return (
      <div className="space-y-4">

        {/* ── Aviso cuando la categoría no tiene ejes de variante ────────── */}
        {variantAxes.length === 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
            <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-text">Esta categoría no tiene ejes de variante</p>
              <p className="text-xs text-muted mt-1">
                Para habilitar el generador automático, marcá al menos un atributo como{" "}
                <span className="font-medium text-text">"Eje de variante"</span> en{" "}
                <span className="font-medium text-text">Configuración → Categorías → Atributos</span>.
              </p>
            </div>
          </div>
        )}

        {/* ── Generador de variantes (solo si hay ejes configurados) ────── */}
        {variantAxes.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-4 items-start">

            {/* ── Columna izquierda: Configuración ─────────────────────── */}
            <TPCard>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-text mb-0.5">Generador de variantes</p>
                  <p className="text-xs text-muted">Seleccioná los valores para cada eje. El sistema generará todas las combinaciones posibles.</p>
                </div>

                {/* Selector multiselect por eje */}
                {variantAxes.map((axis, axisIdx) => {
                  const selected = genSelected[axis.id] ?? [];
                  const hasOptions = axisHasOptions(axis);
                  const isFirst = axisIdx === 0;
                  const isLast  = axisIdx === variantAxes.length - 1;
                  return (
                    <div key={axis.id} className="space-y-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {variantAxes.length > 1 && (
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => moveAxisUp(axis.id)}
                              disabled={isFirst}
                              title="Mover este eje arriba"
                              className={cn(
                                "h-4 w-4 flex items-center justify-center rounded transition-colors",
                                isFirst ? "text-muted/30 cursor-not-allowed" : "text-muted hover:text-text hover:bg-surface2 cursor-pointer"
                              )}
                            >
                              <ArrowUp size={10} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveAxisDown(axis.id)}
                              disabled={isLast}
                              title="Mover este eje abajo"
                              className={cn(
                                "h-4 w-4 flex items-center justify-center rounded transition-colors",
                                isLast ? "text-muted/30 cursor-not-allowed" : "text-muted hover:text-text hover:bg-surface2 cursor-pointer"
                              )}
                            >
                              <ArrowDown size={10} />
                            </button>
                          </div>
                        )}
                        <span className="text-sm font-medium">{axis.definition.name}</span>
                        {axis.isRequired && <span className="text-primary text-sm leading-none">*</span>}
                        {variantAxes.length > 1 && (
                          <span className="text-[10px] text-muted/50 font-mono">#{axisIdx + 1}</span>
                        )}
                        {selected.length > 0 && (() => {
                          const existingCount = selected.filter(v => isAxisValueExisting(axis.id, v)).length;
                          const newCount = selected.length - existingCount;
                          if (existingCount > 0 && newCount > 0) {
                            return (
                              <span className="text-xs text-muted">
                                · <span className="text-emerald-400">{existingCount} creada{existingCount !== 1 ? "s" : ""}</span>
                                {", "}
                                {newCount} nueva{newCount !== 1 ? "s" : ""}
                              </span>
                            );
                          }
                          if (existingCount > 0) {
                            return <span className="text-xs text-emerald-400">· {existingCount} creada{existingCount !== 1 ? "s" : ""}</span>;
                          }
                          return <span className="text-xs text-muted">· {selected.length} seleccionado{selected.length !== 1 ? "s" : ""}</span>;
                        })()}
                      </div>

                      {hasOptions ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            {genOptionsForAxis(axis).map(opt => {
                              const checked = selected.includes(opt.value);
                              const isExisting = isAxisValueExisting(axis.id, opt.value);
                              const showExt = genSkuMode === "auto";
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => toggleGenValue(axis.id, opt.value, !checked)}
                                  title={isExisting && !checked ? "Este valor ya está en una variante creada" : undefined}
                                  className={cn(
                                    "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition",
                                    checked && isExisting
                                      ? "border-emerald-600/40 bg-emerald-500/10 text-emerald-400 font-medium"
                                      : checked
                                      ? "border-primary bg-primary/10 text-primary font-medium"
                                      : isExisting
                                      ? "border-emerald-600/30 bg-surface2/30 text-muted hover:border-emerald-500/50"
                                      : "border-border bg-surface2/30 text-text hover:border-primary/50"
                                  )}
                                >
                                  {checked && <Check size={12} />}
                                  {opt.label}
                                  {checked && isExisting && (
                                    <span className="rounded bg-emerald-500/20 px-1 leading-tight text-[10px] text-emerald-400">Creada</span>
                                  )}
                                  {!checked && isExisting && (
                                    <span className="rounded bg-emerald-500/10 px-1 leading-tight text-[10px] text-emerald-600">En uso</span>
                                  )}
                                  {!isExisting && showExt && opt.codeExtension ? (
                                    <span className="rounded bg-primary/20 px-1 leading-tight text-[10px] font-mono font-bold">{opt.codeExtension}</span>
                                  ) : !isExisting && showExt && (
                                    <span className="rounded bg-amber-500/20 px-1 leading-tight text-[10px] font-mono text-amber-400" title="Sin código de extensión — usará el nombre como fallback">?</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                          {selected.filter(v => !isAxisValueExisting(axis.id, v)).length > 1 && (
                            <div className="space-y-1 pt-1">
                              <p className="text-[10px] text-muted uppercase tracking-wide font-semibold">Orden de generación (nuevas)</p>
                              <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={(e) => handleAxisOptionDragEnd(axis.id, e)}>
                                <SortableContext items={selected} strategy={horizontalListSortingStrategy}>
                                  <div className="flex flex-wrap gap-1.5">
                                    {selected.map(val => {
                                      const opt = genOptionsForAxis(axis).find(o => o.value === val);
                                      return (
                                        <SortableChip key={val} id={val} label={opt?.label ?? val} existing={isAxisValueExisting(axis.id, val)} />
                                      );
                                    })}
                                  </div>
                                </SortableContext>
                              </DndContext>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <TPInput
                              value={genTagInput[axis.id] ?? ""}
                              onChange={v => setGenTagInput(prev => ({ ...prev, [axis.id]: v }))}
                              placeholder={`Valor de ${axis.definition.name}…`}
                              onKeyDown={(e: React.KeyboardEvent) => {
                                if (e.key === "Enter") { e.preventDefault(); addGenTag(axis.id); }
                              }}
                            />
                            <TPButton
                              variant="secondary"
                              iconLeft={<Plus size={13} />}
                              onClick={() => addGenTag(axis.id)}
                              disabled={!(genTagInput[axis.id] ?? "").trim()}
                            >
                              Agregar
                            </TPButton>
                          </div>
                          {selected.length > 0 && (
                            <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={(e) => handleAxisOptionDragEnd(axis.id, e)}>
                              <SortableContext items={selected} strategy={horizontalListSortingStrategy}>
                                <div className="flex flex-wrap gap-1.5">
                                  {selected.map(val => {
                                    const isExisting = isAxisValueExisting(axis.id, val);
                                    return (
                                      <SortableChip key={val} id={val} label={val} existing={isExisting} onRemove={isExisting ? undefined : () => removeGenTag(axis.id, val)} />
                                    );
                                  })}
                                </div>
                              </SortableContext>
                            </DndContext>
                          )}
                        </div>
                      )}

                      {selected.length === 0 && (
                        <p className="text-xs text-amber-500 opacity-80">Seleccioná al menos un valor para este eje.</p>
                      )}
                    </div>
                  );
                })}

                {/* Warning: opciones sin codeExtension */}
                {genSkuMode === "auto" && (() => {
                  const anyMissing = variantAxes.some(ax => genOptionsForAxis(ax).some(o => !o.codeExtension));
                  if (!anyMissing) return null;
                  return (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2 text-xs text-amber-300">
                      <AlertCircle size={12} className="shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium">Algunas opciones no tienen código de extensión (marcadas con <span className="font-mono bg-amber-500/20 px-1 rounded">?</span>).</span>{" "}
                        Se usará el nombre con guiones: <span className="font-mono bg-surface2 px-1 rounded text-text">A000-AMARILLO-L</span>.
                        Para SKUs compactos como <span className="font-mono bg-surface2 px-1 rounded text-text">A000AL</span>, configurá el código en la Biblioteca de atributos.
                      </div>
                    </div>
                  );
                })()}

                {/* SKU mode toggle + botón crear */}
                <div className="flex flex-col gap-3 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setGenSkuMode(m => m === "auto" ? "manual" : "auto")}
                    className="flex items-center gap-2 text-xs text-text transition"
                  >
                    <span className={cn(
                      "relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border transition",
                      genSkuMode === "auto"
                        ? "bg-primary border-primary"
                        : "bg-surface2 border-border"
                    )}>
                      <span className={cn(
                        "inline-block h-3 w-3 transform rounded-full shadow transition",
                        genSkuMode === "auto"
                          ? "translate-x-3.5 bg-white"
                          : "translate-x-0.5 bg-muted"
                      )} />
                    </span>
                    SKU automático
                  </button>

                  {/* Botón crear variantes */}
                  {(() => {
                    const missingAxes    = variantAxes.filter(ax => (genSelected[ax.id] ?? []).length === 0);
                    const validNewCombos = genCombos.filter(c => c.isNew && !c.skuError);
                    const errorNewCombos = genCombos.filter(c => c.isNew && Boolean(c.skuError));
                    const allRegenerable = validNewCombos.every(c => c.isRegeneratable);
                    const validCount     = validNewCombos.length;
                    if (genCombos.filter(c => c.isNew).length === 0) return null;
                    return (
                      <div className="flex flex-col gap-2">
                        {missingAxes.length > 0 && (
                          <p className="text-xs text-amber-500 flex items-center gap-1">
                            <AlertCircle size={11} className="shrink-0" />
                            {`Falta seleccionar valores para: ${missingAxes.map(a => a.definition.name).join(", ")}`}
                          </p>
                        )}
                        {errorNewCombos.length > 0 && (
                          <p className="text-xs text-amber-500 flex items-center gap-1">
                            <AlertCircle size={11} className="shrink-0" />
                            {validCount > 0
                              ? `${errorNewCombos.length} combinación${errorNewCombos.length !== 1 ? "es tienen" : " tiene"} SKU duplicado. Podés crear las ${validCount} restantes.`
                              : `${errorNewCombos.length} combinación${errorNewCombos.length !== 1 ? "es tienen" : " tiene"} SKU duplicado. Corregí los errores para poder crearlas.`
                            }
                          </p>
                        )}
                        <TPButton
                          iconLeft={<Sparkles size={13} />}
                          loading={genBusy}
                          disabled={validCount === 0 || genBusy || missingAxes.length > 0}
                          onClick={() => void runGenerate()}
                        >
                          {allRegenerable
                            ? `Regenerar ${validCount} variante${validCount !== 1 ? "s" : ""}`
                            : `Crear ${validCount} variante${validCount !== 1 ? "s" : ""}`
                          }
                        </TPButton>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </TPCard>

            {/* ── Columna derecha: Vista previa PRO ────────────────────── */}
            <TPCard className="flex flex-col min-h-0">
              {/* Header fijo */}
              <div className="flex items-center justify-between mb-3 shrink-0">
                <p className="text-xs font-semibold text-text">Vista previa</p>
                {genCombos.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {genCombos.filter(c => c.isNew && !c.isRegeneratable).length > 0 && (
                      <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-bold text-primary">
                        {genCombos.filter(c => c.isNew && !c.isRegeneratable).length} nuevas
                      </span>
                    )}
                    {genCombos.filter(c => c.isRegeneratable).length > 0 && (
                      <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-400">
                        {genCombos.filter(c => c.isRegeneratable).length} regenerables
                      </span>
                    )}
                    {genCombos.filter(c => !c.isNew).length > 0 && (
                      <span className="rounded-full bg-emerald-500/10 border border-emerald-600/20 px-2 py-0.5 text-xs text-emerald-500">
                        {genCombos.filter(c => !c.isNew).length} ya existen
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Cuerpo con scroll */}
              {genCombos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                  <div className="w-12 h-12 rounded-full bg-surface2 flex items-center justify-center">
                    <Layers size={22} className="text-muted/40" />
                  </div>
                  <p className="text-sm text-muted max-w-[200px]">
                    {variantAxes.some(ax => (genSelected[ax.id] ?? []).length > 0)
                      ? "Seleccioná valores en todos los ejes."
                      : "Seleccioná valores para ver las variantes."}
                  </p>
                </div>
              ) : (
                <div className="overflow-y-auto max-h-[420px] pr-1 space-y-2">

                  {/* Variantes YA EXISTENTES colapsable */}
                  {genCombos.filter(c => !c.isNew).length > 0 && (
                    <details className="group">
                      <summary className="cursor-pointer text-xs font-medium text-muted hover:text-text transition-colors list-none flex items-center gap-1 mb-1">
                        <span className="group-open:hidden">▶</span>
                        <span className="hidden group-open:inline">▼</span>
                        {genCombos.filter(c => !c.isNew).length} ya existente{genCombos.filter(c => !c.isNew).length !== 1 ? "s" : ""} (se omitirán)
                      </summary>
                      <div className="space-y-1.5">
                        {genCombos.filter(c => !c.isNew).map(combo => {
                          const existingVariant = variants.find(v => buildVariantComboKey(v) === combo.key);
                          return (
                            <div key={combo.key} className="flex items-center gap-2 rounded-lg border border-emerald-600/20 bg-emerald-500/5 px-3 py-2">
                              <Check size={11} className="text-emerald-500 shrink-0" />
                              <span className="truncate flex-1 text-emerald-400 text-xs font-medium">{existingVariant?.name ?? combo.name}</span>
                              <span className="font-mono text-[10px] text-muted/60 shrink-0">{existingVariant?.code ?? combo.code}</span>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}

                  {/* Alert de error al quitar combinación */}
                  {removeComboAlert && (
                    <TPAlert tone="warning">
                      {removeComboAlert}
                    </TPAlert>
                  )}

                  {/* Variantes A CREAR — grid de cards */}
                  {genCombos.filter(c => c.isNew).length === 0 ? (
                    <div className="rounded-xl border border-emerald-600/20 bg-emerald-500/5 p-4 text-center text-sm text-emerald-400">
                      Todas las combinaciones ya existen. No hay nada nuevo para crear.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {genCombos.filter(c => c.isNew).map((combo, idx) => {
                        /* Color de acento para el placeholder visual */
                        const accentColors = [
                          "bg-violet-500/20 text-violet-400",
                          "bg-sky-500/20 text-sky-400",
                          "bg-rose-500/20 text-rose-400",
                          "bg-amber-500/20 text-amber-400",
                          "bg-emerald-500/20 text-emerald-400",
                          "bg-pink-500/20 text-pink-400",
                        ];
                        const accent = accentColors[idx % accentColors.length];
                        return (
                          <div
                            key={combo.key}
                            className={cn(
                              "group rounded-xl border p-3 space-y-2 transition hover:shadow-md",
                              combo.isRegeneratable
                                ? "border-amber-500/30 bg-amber-500/5"
                                : "border-border bg-surface2/30 hover:border-primary/30"
                            )}
                          >
                            {/* Encabezado: icono placeholder + nombre + X */}
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={cn("w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold", accent)}>
                                {combo.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold truncate text-text leading-tight">{combo.name}</p>
                                {combo.isRegeneratable && (
                                  <span className="text-[10px] font-medium text-amber-400 flex items-center gap-0.5">
                                    <RefreshCw size={9} /> Regenerable
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                title="Quitar esta combinación"
                                onClick={() => removeCombo(combo.key)}
                                className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-muted/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              >
                                <X size={12} />
                              </button>
                            </div>

                            {/* Chips de atributos */}
                            {combo.attrs.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {combo.attrs.map(a => (
                                  <span
                                    key={a.assignmentId}
                                    className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] text-text/70 font-medium"
                                  >
                                    {a.value}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Código + SKU */}
                            <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                              <span className="text-[10px] text-muted/60 shrink-0">Cód.</span>
                              <span className="font-mono text-[11px] text-text/80 font-semibold">{combo.code}</span>
                              {combo.sku && (
                                <>
                                  <span className="text-muted/40">·</span>
                                  <span className="text-[10px] text-muted/60 shrink-0">SKU</span>
                                  <span
                                    className="font-mono text-[11px] text-primary font-semibold truncate"
                                    title={combo.sku}
                                  >
                                    {combo.sku}
                                  </span>
                                  {combo.skuError && (
                                    <span className="text-red-400 text-[10px] shrink-0" title={combo.skuError}>⚠</span>
                                  )}
                                </>
                              )}
                            </div>

                            {/* SKU editable (inline, compacto) */}
                            <div className="flex items-center gap-1.5">
                              <label className="text-[10px] text-muted shrink-0">SKU</label>
                              <TPInput
                                value={combo.sku}
                                onChange={v => updateComboSku(combo.key, v)}
                                placeholder="Editar SKU…"
                                className="!h-6 !text-xs !py-0 !px-2"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </TPCard>

          </div>
        )}

        {/* ── Variantes creadas ──────────────────────────────────────────── */}
        {variants.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-text">
                Variantes creadas
                <span className="ml-1.5 text-xs text-muted font-normal">({variants.length})</span>
              </p>
              <p className="text-xs text-muted/60 hidden sm:block">Arrastrá ⠿ para reordenar</p>
            </div>
            <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleVariantDragEnd}>
              <SortableContext items={variants.map(v => v.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {variants.map(v => (
                    <SortableVariantRow
                      key={v.id}
                      variant={v}
                      axisCols={axisCols}
                      stockMode={draft.stockMode}
                      variantStock={variantStock}
                      removingVar={removingVar}
                      articleName={draft.name}
                      articleMainImageUrl={article?.mainImageUrl ?? ""}
                      onEdit={() => openEditVariant(v)}
                      onToggle={() => void toggleVariant(v)}
                      onDelete={() => setDeleteVariantId(v.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}

        {variants.length === 0 && (
          <div className="rounded-xl border border-border bg-surface2/30 p-6 text-center text-sm text-muted">
            {variantAxes.length > 0
              ? "Seleccioná valores en el configurador de arriba para generar las variantes automáticamente."
              : "Sin variantes. Configurá ejes de variante en la categoría para usar el generador."
            }
          </div>
        )}
      </div>
    );
  }

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <>
      <Modal
        open={open}
        title={modalTitle}
        onClose={() => {
          if (draftChanged && !busySave) { setShowUnsavedDialog(true); return; }
          onClose();
        }}
        maxWidth="7xl"
        className="!max-w-[104rem]"
        busy={busySave}
        onEnter={activeTab !== "variantes" ? handleSave : undefined}
        footer={
          showNoPriceWarning ? (
            <div className="flex flex-col gap-3 w-full">
              <TPAlert tone="warning" title="Artículo sin costo">
                Este artículo tiene costo 0. Podés guardarlo igual, pero revisá su costo porque puede afectar cálculos, márgenes y precios derivados.
              </TPAlert>
              <div className="flex justify-end gap-2">
                <TPButton
                  variant="secondary"
                  iconLeft={<X size={14} />}
                  onClick={() => setShowNoPriceWarning(false)}
                  disabled={busySave}
                >
                  Cancelar
                </TPButton>
                <TPButton
                  onClick={executeSave}
                  loading={busySave}
                  iconLeft={<Save size={14} />}
                >
                  {isEdit ? "Guardar igual" : "Crear igual"}
                </TPButton>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full">
              {isEdit && articleId && (
                <button
                  type="button"
                  onClick={() => { onClose(); navigate(`/articulos/${articleId}`); }}
                  className="flex items-center gap-1.5 text-xs text-muted hover:text-primary transition-colors"
                >
                  <ExternalLink size={12} />
                  Página completa
                </button>
              )}
              <div className="flex-1" />
              <TPButton variant="secondary" iconLeft={<X size={14} />}
                onClick={() => {
                  if (draftChanged && !busySave) { setShowUnsavedDialog(true); return; }
                  onClose();
                }}
                disabled={busySave}
              >
                Cancelar
              </TPButton>
              <TPButton onClick={handleSave} loading={busySave} iconLeft={<Save size={14} />}>
                {isEdit ? "Guardar cambios" : "Crear artículo"}
              </TPButton>
            </div>
          )
        }
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-muted" />
          </div>
        ) : (
          <>
            {/* ── Product header ─────────────────────────────────────────── */}
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border/50">
              {/* Thumbnail vivo */}
              <div className="shrink-0 w-9 h-9 rounded-lg overflow-hidden border border-border/60 bg-surface2 flex items-center justify-center">
                {(() => {
                  const src = images.find(i => i.isMain)?.url ?? images[0]?.url ?? article?.mainImageUrl ?? null;
                  return src
                    ? <img src={src} alt="" className="w-full h-full object-cover" />
                    : <Package size={16} className="text-muted/40" />;
                })()}
              </div>
              {/* Info viva */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-text truncate">
                    {draft.name.trim() || (isEdit ? (article?.name ?? "…") : "Nuevo artículo")}
                  </span>
                  <span className={cn(
                    "shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded",
                    draft.status === "ACTIVE"
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-amber-500/15 text-amber-500"
                  )}>
                    {ARTICLE_STATUS_LABELS[draft.status]}
                  </span>
                  <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface2 text-muted">
                    {ARTICLE_TYPE_LABELS[draft.articleType]}
                  </span>
                </div>
                {(draft.code.trim() || draft.sku.trim()) && (
                  <p className="text-xs text-muted/70 font-mono mt-0.5 truncate">
                    {[
                      draft.code.trim() && draft.code.trim(),
                      draft.sku.trim()  && `SKU: ${draft.sku.trim()}`,
                    ].filter(Boolean).join("  ·  ")}
                  </p>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
              {TABS.filter(t => {
                if (t.key !== "variantes") return true;
                if (draft.articleType === "SERVICE") return false;
                return variantAxes.length > 0;
              }).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  data-tp-enter="ignore"
                  onClick={() => setActiveTab(t.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 h-8 rounded-lg text-sm font-medium transition shrink-0",
                    activeTab === t.key
                      ? "bg-primary text-white"
                      : "text-muted hover:text-text hover:bg-surface2"
                  )}
                >
                  {t.icon}
                  {t.label}
                  {/* Badge de variantes — tamaño fijo para no desplazar el tab */}
                  {t.key === "variantes" && (
                    <span className="ml-0.5 w-5 flex items-center justify-center">
                      {variants.length > 0 ? (
                        <span className={cn(
                          "rounded-full px-1 text-[10px] font-bold leading-tight tabular-nums",
                          activeTab === "variantes"
                            ? "bg-white/30 text-white"
                            : "bg-primary/20 text-primary"
                        )}>
                          {variants.length}
                        </span>
                      ) : variantAxes.length > 0 ? (
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full inline-block",
                          activeTab === "variantes" ? "bg-white/60" : "bg-primary/50"
                        )} />
                      ) : null}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Contenido del tab activo */}
            {activeTab === "principal" && renderTabPrincipal()}
            {activeTab === "variantes" && renderTabVariantes()}
          </>
        )}
      </Modal>

      {/* Mini-modal de variante */}
      <Modal
        open={varModal}
        title={varEditId ? "Editar identificación de variante" : "Nueva variante"}
        onClose={() => setVarModal(false)}
        maxWidth="sm"
        busy={busyVar}
        onEnter={saveVariant}
        footer={
          <>
            <TPButton variant="secondary" iconLeft={<X size={14} />} onClick={() => setVarModal(false)} disabled={busyVar}>Cancelar</TPButton>
            <TPButton onClick={saveVariant} loading={busyVar} iconLeft={varEditId ? <Save size={14} /> : <Plus size={14} />}>{varEditId ? "Guardar cambios" : "Crear"}</TPButton>
          </>
        }
      >
        <div className="space-y-3">
            {/* Galería de imágenes pendientes (modo CREATE, hasta 5, se suben al guardar) */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted">Imágenes de variante</span>
              <div className="flex gap-3 items-start">
                {/* Imagen principal — TPAvatarUploader (local, se sube al guardar) */}
                <div className="flex flex-col gap-1 shrink-0">
                  <TPAvatarUploader
                    src={pendingVarImagePreviews[0] ?? ""}
                    size={80}
                    rounded="xl"
                    fallbackIcon={<Package size={22} className="opacity-50" />}
                    onUpload={(f) => {
                      const url = URL.createObjectURL(f);
                      if (pendingVarImages.length === 0) {
                        setPendingVarImages([f]);
                        setPendingVarImagePreviews([url]);
                      } else {
                        URL.revokeObjectURL(pendingVarImagePreviews[0] ?? "");
                        setPendingVarImages(prev => [f, ...prev.slice(1)]);
                        setPendingVarImagePreviews(prev => [url, ...prev.slice(1)]);
                      }
                    }}
                    onDelete={pendingVarImages.length > 0 ? () => {
                      setPendingVarImages(prev => prev.filter((_, i) => i !== 0));
                      setPendingVarImagePreviews(prev => { URL.revokeObjectURL(prev[0] ?? ""); return prev.filter((_, i) => i !== 0); });
                    } : undefined}
                    addLabel="Cargar"
                    editLabel="Cambiar"
                    deleteLabel="Quitar"
                  />
                </div>
                {/* Tira de miniaturas */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex gap-1 flex-wrap" style={{ maxWidth: 160 }}>
                    {pendingVarImagePreviews.map((preview, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "relative group w-9 h-9 rounded-lg overflow-hidden border-2 shrink-0 bg-surface2",
                          idx === 0 ? "border-primary cursor-default" : "border-border"
                        )}
                      >
                        <img src={preview} alt="" className="w-full h-full object-cover" />
                        {idx === 0 && (
                          <div className="absolute top-0.5 left-0.5 bg-primary rounded-sm w-3 h-3 flex items-center justify-center">
                            <Check size={7} className="text-white" strokeWidth={3} />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button type="button" title="Eliminar"
                            onClick={() => {
                              setPendingVarImages(prev => prev.filter((_, i) => i !== idx));
                              setPendingVarImagePreviews(prev => { URL.revokeObjectURL(prev[idx] ?? ""); return prev.filter((_, i) => i !== idx); });
                            }}
                            className="p-0.5 rounded text-white hover:text-red-400"
                          ><X size={10} /></button>
                        </div>
                      </div>
                    ))}
                    {pendingVarImagePreviews.length < 5 && (
                      <label className="w-9 h-9 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted hover:text-primary hover:border-primary transition-colors cursor-pointer shrink-0" title="Agregar imagen">
                        <Plus size={13} />
                        <input type="file" accept="image/*" hidden
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            e.currentTarget.value = "";
                            if (!f) return;
                            setPendingVarImages(prev => [...prev, f]);
                            setPendingVarImagePreviews(prev => [...prev, URL.createObjectURL(f)]);
                          }}
                        />
                      </label>
                    )}
                  </div>
                  <span className="text-[10px] text-muted">{pendingVarImagePreviews.length}/5 · Se suben al guardar</span>
                </div>
              </div>
            </div>
            <TPField label="SKU" required hint="Cada variante debe tener un SKU único">
              <TPInput
                value={varDraft.sku ?? ""}
                onChange={(v) => setVarDraft((p) => ({ ...p, sku: v }))}
                placeholder="SKU de la variante"
                data-tp-autofocus="1"
              />
            </TPField>
            <TPField label="Nombre" required hint="Dejá vacío para usar el nombre automático desde los atributos">
              <TPInput
                value={varDraft.name ?? ""}
                onChange={(v) => setVarDraft((p) => ({ ...p, name: v }))}
                placeholder="Automático desde atributos"
              />
            </TPField>
            <TPField label="Notas" hint="Descripción o notas internas de la variante (opcional)">
              <TPTextarea
                value={(varDraft as any).notes ?? ""}
                onChange={(v) => setVarDraft((p) => ({ ...p, notes: v }))}
                placeholder="Notas sobre esta variante…"
                rows={2}
              />
            </TPField>
            <TPField label="Código" required>
              <TPInput
                value={varDraft.code}
                onChange={(v) => setVarDraft((p) => ({ ...p, code: v }))}
                placeholder="Código de la variante"
              />
            </TPField>
            <TPField label="Punto de reposición" hint="Stock mínimo para alerta">
              <TPNumberInput
                value={(varDraft as any).reorderPoint ?? null}
                onChange={(v) => setVarDraft((p) => ({ ...p, reorderPoint: v }))}
                placeholder="0"
                min={0}
              />
            </TPField>
            <TPField label="Existencia de apertura" hint="Stock inicial de esta variante">
              <TPNumberInput
                value={(varDraft as any).openingStock ?? null}
                onChange={(v) => setVarDraft((p) => ({ ...p, openingStock: v }))}
                placeholder="0"
                min={0}
                decimals={4}
              />
            </TPField>

            {/* Atributos de variante (ejes configurados en la categoría) */}
            {variantAxes.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 pt-1">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-semibold text-muted uppercase tracking-wide">Atributos de variante</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="space-y-3">
                  {variantAxes.map(axis => (
                    <TPField key={axis.id} label={axis.definition.name} required={axis.isRequired}>
                      {renderVariantAttrInput(axis)}
                    </TPField>
                  ))}
                </div>
              </div>
            )}
          </div>
      </Modal>

      {/* Confirmación de cambios sin guardar */}
      <ConfirmDeleteDialog
        open={showUnsavedDialog}
        title="Cambios sin guardar"
        description="Tenés cambios sin guardar. ¿Querés descartarlos?"
        confirmText="Descartar cambios"
        cancelText="Seguir editando"
        busy={false}
        onClose={() => setShowUnsavedDialog(false)}
        onConfirm={() => { setShowUnsavedDialog(false); onClose(); }}
      />

      {/* Confirmación de eliminar línea de costo */}
      <ConfirmDeleteDialog
        open={confirmDropIdx !== null}
        title="Eliminar componente de costo"
        description={(() => {
          const line = confirmDropIdx !== null ? costLines[confirmDropIdx] : null;
          if (!line) return "¿Querés eliminar este componente de la composición del costo?";
          const cfg = TYPE_CFG[line.type];
          const desc = line.label ? ` — ${line.label}` : "";
          return `¿Querés eliminar "${cfg.label}${desc}" de la composición del costo? Esto impactará en el total estimado.`;
        })()}
        confirmText="Eliminar"
        onClose={() => setConfirmDropIdx(null)}
        onConfirm={() => {
          if (confirmDropIdx !== null) {
            setCostLines(prev => prev.filter((_, idx) => idx !== confirmDropIdx));
          }
          setConfirmDropIdx(null);
        }}
      />

      {/* Confirmación de eliminar variante */}
      <ConfirmDeleteDialog
        open={deleteVariantId !== null}
        title="Eliminar variante"
        description={(() => {
          const v = variants.find(vv => vv.id === deleteVariantId);
          const lbl = v ? variantLabel(v) : "";
          return `Se eliminará únicamente la variante "${lbl}" de este artículo. El artículo y las demás variantes no se verán afectados.`;
        })()}
        busy={removingVar !== null}
        onClose={() => setDeleteVariantId(null)}
        onConfirm={() => { if (deleteVariantId) void doRemoveVariant(deleteVariantId); }}
      />
    </>
  );
}
