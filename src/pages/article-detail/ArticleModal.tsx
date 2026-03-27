// src/pages/article-detail/ArticleModal.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
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
  Percent,
  Plus,
  RefreshCw,
  Save,
  Sliders,
  Sparkles,
  Tag,
  Trash2,
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
import TPComboCreatableMulti from "../../components/ui/TPComboCreatableMulti";
import { cn } from "../../components/ui/tp";
import {
  listCatalog,
  createCatalogItem,
  type CatalogItem,
} from "../../services/catalogs";
import { toast } from "../../lib/toast";

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
  type CompositionPayload,
  type VariantAttributeValue,
  ARTICLE_TYPE_LABELS,
  ARTICLE_STATUS_LABELS,
  STOCK_MODE_LABELS,
  HECHURA_MODE_LABELS,
  COST_MODE_LABELS,
  BARCODE_SOURCE_LABELS,
  BARCODE_SOURCE_DESCRIPTIONS,
  fmtMoney,
} from "../../services/articles";
import { categoriesApi, type CategoryRow, type CategoryAttribute } from "../../services/categories";
import ConfirmDeleteDialog from "../../components/ui/ConfirmDeleteDialog";
import { TPRowActions }    from "../../components/ui/TPRowActions";
// price-lists no se usa en este modal (simulación movida al backend)
import { getMetals, getVariants, getCurrencies, type MetalVariantRow, type CurrencyRow } from "../../services/valuation";
import { taxesApi, type TaxRow } from "../../services/taxes";
import { type SalePriceResult } from "../../services/sales";
import { promotionsApi, type PromotionRow } from "../../services/promotions";
import { quantityDiscountsApi, type QuantityDiscountRow } from "../../services/quantity-discounts";
import CostCompositionTable, { type MetalVariantOption, type CurrencyOption, TYPE_OPTIONS, TYPE_CFG } from "../../components/ui/CostCompositionTable";
import type { CostLine, CostLineType } from "../../services/articles";
import {
  commercialEntitiesApi,
  type EntityRow,
  type EntityDetail as EntityDetailType,
} from "../../services/commercial-entities";
import EntityEditModal from "../configuracion-sistema/clientes/EntityEditModal";
import TPAvatarUploader from "../../components/ui/TPAvatarUploader";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
type Tab = "general" | "costos" | "variantes";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "general",   label: "General",   icon: <FileText size={13} /> },
  { key: "costos",    label: "Costos",    icon: <Calculator size={13} /> },
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
};

const EMPTY_DRAFT: Draft = {
  name: "",
  code: "",
  articleType: "PRODUCT",
  description: "",
  categoryId: "",
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
  costCalculationMode: "MANUAL",
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
};

function articleToDraft(a: ArticleDetail | ArticleRow): Draft {
  return {
    name:                 a.name,
    code:                 a.code ?? "",
    articleType:          a.articleType,
    description:          a.description ?? "",
    categoryId:           a.categoryId ?? "",
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
    costCalculationMode:  a.costCalculationMode ?? "MANUAL",
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
  };
}

/**
 * Normaliza líneas de costComposition venidas del backend:
 * - Prisma Decimal se serializa como string → convertir a number.
 * - HECHURA sin label → completar con texto por defecto.
 */
function normalizeCostLines(lines: any[]): CostLine[] {
  return (lines ?? []).map(l => ({
    ...l,
    quantity:     l.quantity     != null ? parseFloat(String(l.quantity))     : 0,
    unitValue:    l.unitValue    != null ? parseFloat(String(l.unitValue))    : 0,
    mermaPercent: l.mermaPercent != null ? parseFloat(String(l.mermaPercent)) : null,
    label:        (l.label ?? "") !== "" ? (l.label ?? "") : (l.type === "HECHURA" ? "Hechura / Mano de Obra" : ""),
  }));
}

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
      {(() => {
        const displayImg = getVariantDisplayImage(variant, articleMainImageUrl);
        return (
          <div className="shrink-0 w-8 h-8 rounded overflow-hidden border border-border bg-surface2/40 flex items-center justify-center">
            {displayImg ? (
              <img src={displayImg} alt="" className="w-full h-full object-cover" />
            ) : (
              <Image size={14} className="text-muted/30" />
            )}
          </div>
        );
      })()}

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
        {variant.sku && (
          <p className="text-xs text-muted mt-0.5 font-mono">SKU: {variant.sku}</p>
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
  const [activeTab, setActiveTab] = useState<Tab>("general");

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

  /* ── pickers ─────────────────────────────────────────────────────────── */
  const [categories,   setCategories]   = useState<CategoryRow[]>([]);
  const [suppliers,    setSuppliers]    = useState<EntityRow[]>([]);
  const [metalVariants, setMetalVariants] = useState<MetalVariantRow[]>([]);
  const [productItems,  setProductItems]  = useState<{ id: string; name: string; costPrice: number | null }[]>([]);
  const [serviceItems,  setServiceItems]  = useState<{ id: string; name: string; costPrice: number | null }[]>([]);

  /* ── catálogos comerciales ────────────────────────────────────────────── */
  const [brandItems,           setBrandItems]           = useState<CatalogItem[]>([]);
  const [manufacturerItems,    setManufacturerItems]    = useState<CatalogItem[]>([]);
  const [unitItems,            setUnitItems]            = useState<CatalogItem[]>([]);
  const [multiplierBaseItems,  setMultiplierBaseItems]  = useState<CatalogItem[]>([]);

  /* ── modal nuevo proveedor (modal real del sistema) ──────────────────── */
  const [newSupplierModalOpen, setNewSupplierModalOpen] = useState(false);

  /* ── computed cost / sale price ─────────────────────────────────────── */
  const [computed,           setComputed]           = useState<ComputedCostPrice | null>(null);
  const [computedSale,       setComputedSale]        = useState<ComputedSalePrice | null>(null);
  const [effectiveSource,    setEffectiveSource]     = useState<EffectivePriceSource | null>(null);
  const [effectivePrice,     setEffectivePrice]      = useState<string | null>(null);
  const [loadingCost,        setLoadingCost]         = useState(false);

  /* ── cost composition (nueva arquitectura de líneas) ─────────────────── */
  const [costLines,    setCostLines]    = useState<CostLine[]>([]);
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
  const [busyVarImage,  setBusyVarImage]  = useState(false);
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
  /* variantes borradas en esta sesión: combo-key → variantId (para badge "Regenerable" y restauración) */
  const [deletedVariants, setDeletedVariants] = useState<Map<string, string>>(new Map());
  /* variantes soft-deleted cargadas del backend (para regeneración entre sesiones) */
  const [rawDeletedVariants, setRawDeletedVariants] = useState<ArticleVariant[]>([]);

  /* ── composiciones ───────────────────────────────────────────────────── */
  const [compositions, setCompositions] = useState<ArticleComposition[]>([]);

  /* ── imágenes ─────────────────────────────────────────────────────────── */
  const [images,            setImages]           = useState<ArticleImage[]>([]);
  const [busyImg,           setBusyImg]          = useState(false);
  const [busyAddImg,        setBusyAddImg]       = useState(false);
  const [removingImg,       setRemovingImg]      = useState<string | null>(null);
  const [pendingMainImage,    setPendingMainImage]    = useState<File | null>(null);
  const [pendingMainImageUrl, setPendingMainImageUrl] = useState<string | null>(null);
  const addImgInputRef = useRef<HTMLInputElement>(null);
  const skuInputRef    = useRef<HTMLInputElement>(null);

  /* ── carga de ejes de variante ────────────────────────────────────────── */
  const [variantAxesLoading, setVariantAxesLoading] = useState(false);

  /** Recuerda el último "Tipo de valor" elegido para restaurarlo al activar un nuevo ajuste */
  const lastAdjTypeRef = useRef<"PERCENTAGE" | "FIXED_AMOUNT">("PERCENTAGE");
  /** Flag: loadCatalogArticles ya completó en esta apertura (ref porque no necesita trigger) */
  const catalogLoadedRef = useRef(false);
  /** Hash de los ejes para los que ya corrió la preselección (evita repetir si no cambiaron los ejes) */
  const preselectedAxesHashRef = useRef<string>("");

  /**
   * Mirrors síncronos de los catálogos para uso dentro de fetchArticle,
   * evitando la race condition donde los catálogos cargan antes que el artículo
   * y el efecto de sincronización no puede re-ejecutarse.
   */
  const metalVariantsRef = useRef<MetalVariantRow[]>([]);
  const currenciesRef    = useRef<CurrencyRow[]>([]);
  const productItemsRef  = useRef<{ id: string; name: string; costPrice: number | null }[]>([]);
  const serviceItemsRef  = useRef<{ id: string; name: string; costPrice: number | null }[]>([]);

  // ── reset al abrir/cerrar ──────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      // Limpiar al cerrar (con delay para evitar flash)
      const t = setTimeout(() => {
        setActiveTab("general");
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
        setPendingMainImage(null);
        setVariantAxesLoading(false);
        setCompositions([]);
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
      void fetchArticle(articleId);
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
        const savedCostMode = localStorage.getItem("tptech_last_cost_mode") as CostCalculationMode | null;
        if (savedCostMode) base.costCalculationMode = savedCostMode;
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

  async function fetchArticle(id: string) {
    setLoading(true);
    try {
      const data = await articlesApi.getOne(id);
      setArticle(data);
      const d = articleToDraft(data);
      setDraft(d);
      setAdvancedModalOpen(d.barcodeSource !== "SKU");
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
      const parsedLines = normalizeCostLines(data.costComposition ?? []);
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
      toast.error(e?.message || "Error al cargar artículo.");
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
      console.debug("[TPTech] atributos efectivos recibidos:", all);
      // Filtrar atributos con definition faltante (relación rota en DB)
      const valid = (all ?? []).filter(a => {
        if (!a.definition) {
          console.warn("[TPTech] Atributo ignorado — definition null/undefined. assignmentId:", a.id, "| raw:", a);
          return false;
        }
        return true;
      });
      const axes = valid.filter(a => a.isVariantAxis);
      const attrs = valid.filter(a => !a.isVariantAxis);
      console.debug("[TPTech] variantAxes:", axes.map(a => a.definition.name));
      console.debug("[TPTech] artAttrs:", attrs.map(a => a.definition.name));
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

  // Si la categoría cambia y ya no tiene ejes, redirigir al tab General
  useEffect(() => {
    if (activeTab === "variantes" && !variantAxesLoading && variantAxes.length === 0) {
      setActiveTab("general");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantAxes.length, variantAxesLoading]);

  // En edición: pre-seleccionar en el configurador los valores de variantes ya existentes.
  // Hash combinado: IDs de ejes + conteo de attributeValues por variante.
  // Esto re-corre automáticamente cuando los datos de atributos se cargan,
  // sin depender de timing ni del orden de renderizado.
  useEffect(() => {
    if (!isEdit || variantAxes.length === 0 || variants.length === 0) return;
    const axesHash   = variantAxes.map(a => a.id).join("|");
    const attrsHash  = variants.map(v => v.attributeValues?.length ?? 0).join(",");
    const combinedHash = `${axesHash}::${attrsHash}`;
    if (preselectedAxesHashRef.current === combinedHash) return;
    const newSelected = buildSelectedFromVariants(variantAxes, variants);
    preselectedAxesHashRef.current = combinedHash;
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
        costCalculationMode: "MANUAL",
        isReturnable:        false,
        sellWithoutVariants: true,
      }));
      // Si estábamos en variantes, volver a general
      setActiveTab(prev => prev === "variantes" ? "general" : prev);
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
      const toLabel = (r: any) => r.sku ? `[${r.sku}] ${r.name}` : r.name;
      const mappedProds = prodRows.map((r: any) => ({ id: r.id, name: toLabel(r), costPrice: toPrice(r) }));
      const mappedSvcs  = svcRows.map((r: any)  => ({ id: r.id, name: toLabel(r), costPrice: toPrice(r) }));
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
      const [brands, manufacturers, units, multiplierBases] = await Promise.all([
        listCatalog("ARTICLE_BRAND").catch(() => [] as CatalogItem[]),
        listCatalog("ARTICLE_MANUFACTURER").catch(() => [] as CatalogItem[]),
        listCatalog("UNIT_OF_MEASURE").catch(() => [] as CatalogItem[]),
        listCatalog("MULTIPLIER_BASE").catch(() => [] as CatalogItem[]),
      ]);
      setBrandItems(brands);
      setManufacturerItems(manufacturers);
      setUnitItems(units);
      setMultiplierBaseItems(multiplierBases);

      const fBrand = brands.find((i) => i.isFavorite && i.isActive !== false)?.label ?? "";
      const fManuf = manufacturers.find((i) => i.isFavorite && i.isActive !== false)?.label ?? "";
      const fUnit  = units.find((i) => i.isFavorite && i.isActive !== false)?.label ?? "";

      if (fBrand || fManuf || fUnit) {
        setDraft((prev) => ({
          ...prev,
          brand:         prev.brand         || fBrand,
          manufacturer:  prev.manufacturer  || fManuf,
          unitOfMeasure: prev.unitOfMeasure || fUnit,
        }));
      }
    } catch {}
  }
  async function loadUnitItems() {
    try { setUnitItems(await listCatalog("UNIT_OF_MEASURE")); } catch {}
  }

  async function handleSupplierCreated(entity: EntityDetailType) {
    await loadSuppliers();
    set("preferredSupplierId", entity.id);
  }

  // ── helpers draft ──────────────────────────────────────────────────────
  function set<K extends keyof Draft>(k: K, val: Draft[K]) {
    if (k === "costCalculationMode") {
      try { localStorage.setItem("tptech_last_cost_mode", val as string); } catch {}
    }
    if (k === "stockMode" && !articleId) {
      try { localStorage.setItem("tptech_last_stock_mode", val as string); } catch {}
    }
    setDraft((prev) => ({ ...prev, [k]: val }));
    setDraftChanged(true);
  }

  // ── guardar ────────────────────────────────────────────────────────────
  async function handleSave() {
    setSubmitted(true);
    if (!draft.name.trim() || (!draft.sku.trim() && draft.barcodeSource === "SKU")) {
      setActiveTab("general");
      return;
    }
    // Validar atributos requeridos del artículo
    const missingArtAttr = artAttrs.find(a => a.isRequired && !(artAttrValues[a.id] ?? "").trim());
    if (missingArtAttr) {
      setActiveTab("general");
      return;
    }
    setBusySave(true);
    try {
      const payload = draftToPayload(draft);
      // Para modo MANUAL: guardar el costo final calculado (base + ajuste + impuestos)
      if (draft.costCalculationMode === "MANUAL") {
        payload.costPrice = computeManualFinalCost(draft, taxes);
      }
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
                persistedVariants.push({ ...created_v, attributeValues: savedAttrs });
              } else {
                persistedVariants.push(created_v);
              }
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
              `Artículo creado. ${varOk} variante${varOk !== 1 ? "s" : ""} creada${varOk !== 1 ? "s" : ""}, ${varFailed.length} fallaron: ${varFailed.join(", ")}.`
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

      // Subir imagen pendiente (create mode)
      if (!isEdit && pendingMainImage) {
        try {
          const img = await articlesApi.images.upload(saved.id, pendingMainImage, "", true);
          setImages([img]);
          setPendingMainImage(null);
        } catch {
          // best-effort: el artículo ya se creó, la imagen se puede subir después
        }
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
      onSaved?.(saved);
      if (!isEdit) {
        // En modo crear, pasar a edición del recién creado (mismo modal)
        onClose();
      }
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar.");
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
    if (updated > 0) toast.success(`${updated} línea(s) de metal actualizada(s) con cotización actual.`);
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
    setVarDraft({ code: "", name: "" });
    setVarAttrValues({});
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
      costPrice: v.costPrice != null ? parseFloat(v.costPrice) : null,
      reorderPoint: v.reorderPoint != null ? parseFloat(v.reorderPoint) : null,
      weightOverride: v.weightOverride != null ? parseFloat(v.weightOverride) : null,
      hechuraPriceOverride: v.hechuraPriceOverride != null ? parseFloat(v.hechuraPriceOverride) : null,
      priceOverride: v.priceOverride != null ? parseFloat(v.priceOverride) : null,
      sortOrder: v.sortOrder,
    });
    // Inicializar valores de atributos de variante desde los datos cargados
    const attrMap: Record<string, string> = {};
    (v.attributeValues ?? []).forEach((av: VariantAttributeValue) => {
      attrMap[av.assignmentId] = av.value;
    });
    setVarAttrValues(attrMap);
    setVarModal(true);
  }
  /** Sube una nueva imagen a la galería de la variante (primera → principal automáticamente). */
  async function handleVariantImageFile(file: File) {
    if (!varEditId || !articleId) return;
    setBusyVarImage(true);
    try {
      const currentVariant = variants.find(v => v.id === varEditId);
      const isFirst = !currentVariant?.images?.length && !currentVariant?.imageUrl;
      const newImg = await articlesApi.variants.images.upload(articleId, varEditId, file, isFirst || !currentVariant?.images?.length);
      setVariants(prev => prev.map(v => {
        if (v.id !== varEditId) return v;
        const updatedImages = [...(v.images ?? []).map(i => newImg.isMain ? { ...i, isMain: false } : i), newImg];
        return { ...v, images: updatedImages, imageUrl: newImg.isMain ? newImg.url : v.imageUrl };
      }));
    } catch (err: any) {
      toast.error(err?.message || "Error al subir imagen.");
      throw err; // re-throw so TPAvatarUploader can revert preview
    } finally {
      setBusyVarImage(false);
    }
  }

  /** Elimina una imagen de la galería. Si era principal, el backend promueve la siguiente. */
  async function handleVariantImageRemoveById(imageId: string) {
    if (!varEditId || !articleId) return;
    setBusyVarImage(true);
    try {
      await articlesApi.variants.images.remove(articleId, varEditId, imageId);
      setVariants(prev => prev.map(v => {
        if (v.id !== varEditId) return v;
        const remaining = (v.images ?? []).filter(i => i.id !== imageId);
        const newMain = remaining.find(i => i.isMain)?.url ?? remaining[0]?.url ?? "";
        return { ...v, images: remaining, imageUrl: newMain };
      }));
    } catch (err: any) {
      toast.error(err?.message || "Error al eliminar imagen.");
    } finally {
      setBusyVarImage(false);
    }
  }

  /** Cambia la imagen principal de la variante. */
  async function handleVariantSetMainImage(imageId: string) {
    if (!varEditId || !articleId) return;
    try {
      const updated = await articlesApi.variants.images.setMain(articleId, varEditId, imageId);
      setVariants(prev => prev.map(v => {
        if (v.id !== varEditId) return v;
        const updatedImages = (v.images ?? []).map(i => ({ ...i, isMain: i.id === imageId }));
        return { ...v, images: updatedImages, imageUrl: updated.url };
      }));
    } catch (err: any) {
      toast.error(err?.message || "Error al cambiar imagen principal.");
    }
  }

  /** Elimina la imagen principal actual (la primera imagen de la galería, si existe). */
  async function handleVariantImageRemove() {
    if (!varEditId || !articleId) return;
    const currentVariant = variants.find(v => v.id === varEditId);
    const mainImg = currentVariant?.images?.find(i => i.isMain) ?? currentVariant?.images?.[0];
    if (mainImg) {
      await handleVariantImageRemoveById(mainImg.id);
      return;
    }
    // fallback legacy: limpiar imageUrl si no hay galería
    setBusyVarImage(true);
    try {
      await articlesApi.variants.update(articleId, varEditId, { imageUrl: "" });
      setVariants(prev => prev.map(v => v.id === varEditId ? { ...v, imageUrl: "" } : v));
    } catch (err: any) {
      toast.error(err?.message || "Error al eliminar imagen.");
    } finally {
      setBusyVarImage(false);
    }
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
      // Edición rápida: SKU y Nombre son obligatorios
      if (!(varDraft.sku ?? "").trim()) {
        toast.error("El SKU es obligatorio.");
        setBusyVar(false);
        return;
      }
      if (!derivedName) {
        toast.error("El nombre es obligatorio.");
        setBusyVar(false);
        return;
      }
    } else {
      if (!derivedName || !varDraft.code?.trim()) {
        toast.error("Nombre y código son obligatorios.");
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
          ? { ...v, code: varDraft.code, name: derivedName, sku: varDraft.sku ?? "", attributeValues: attrValues }
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
          barcodeSource: "SKU",
          costPrice: null,
          reorderPoint: null,
          notes: "",
          priceOverride: null,
          weightOverride: null,
          hechuraPriceOverride: null,
          imageUrl: "",
          images: [],
          sortOrder: variants.length,
          isActive: true,
          createdAt: new Date().toISOString(),
          attributeValues: attrValues,
        };
        setVariants(prev => [...prev, newVar]);
      }
      setVarModal(false);
      setBusyVar(false);
      return;
    }

    // ── MODO EDIT: llamada a API ─────────────────────────────────────────
    try {
      let saved: ArticleVariant;
      const payload = { ...varDraft, name: derivedName };
      if (varEditId) {
        saved = await articlesApi.variants.update(articleId, varEditId, payload);
      } else {
        saved = await articlesApi.variants.create(articleId, payload);
      }

      // Guardar attributeValues si hay ejes configurados
      const attrPayload = variantAxes
        .filter(ax => (varAttrValues[ax.id] ?? "").trim() !== "")
        .map(ax => ({ assignmentId: ax.id, value: varAttrValues[ax.id].trim() }));
      if (attrPayload.length > 0) {
        const savedAttrs = await articlesApi.variantAttributes.set(articleId, saved.id, attrPayload);
        saved = { ...saved, attributeValues: savedAttrs };
      }

      setVariants((prev) =>
        varEditId ? prev.map((v) => v.id === varEditId ? saved : v) : [...prev, saved]
      );
      setVarModal(false);
      toast.success(varEditId ? "Variante actualizada." : "Variante creada.");
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar variante.");
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
      toast.error(e?.message || "Error al eliminar variante.");
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
      toast.error(e?.message || "Error al cambiar estado.");
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
      toast.error("Error al guardar el orden de variantes.");
    }
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
  }

  function removeGenTag(axisId: string, value: string) {
    setGenSelected(prev => ({
      ...prev,
      [axisId]: (prev[axisId] ?? []).filter(v => v !== value),
    }));
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
    const base = articleCode.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "ART";
    const parts = values.map((v, i) => {
      const ext = (extensions[i] ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (ext) return ext;
      return v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "X";
    });
    const allHaveExt = extensions.every(e => e.trim());
    return allHaveExt ? base + parts.join("") : [base, ...parts].join("-");
  }

  /** Valida los SKU de los combos: detecta duplicados en el lote y conflictos con variantes existentes */
  function validateGenSkus(combos: GenCombo[]): GenCombo[] {
    const existingSkus = new Set(variants.map(v => (v.sku ?? "").trim().toUpperCase()).filter(Boolean));
    const batchSkus = new Map<string, number>(); // sku -> cantidad en el lote
    for (const c of combos) {
      if (!c.isNew) continue;
      const key = c.sku.trim().toUpperCase();
      if (!key) continue;
      batchSkus.set(key, (batchSkus.get(key) ?? 0) + 1);
    }
    return combos.map(c => {
      if (!c.isNew) return c;
      const trimmed = c.sku.trim();
      const key = trimmed.toUpperCase();
      if (!key) return { ...c, skuError: undefined };
      if (existingSkus.has(key)) {
        return { ...c, skuError: "Este SKU ya existe en una variante del artículo." };
      }
      if ((batchSkus.get(key) ?? 0) > 1) {
        return { ...c, skuError: "SKU duplicado dentro de la generación." };
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

    const newCombos = genCombos.filter(c => c.isNew);

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

    if (created > 0) toast.success(`${created} variante${created !== 1 ? "s" : ""} creada${created !== 1 ? "s" : ""}.`);
    // Solo notificar errores reales del backend (apiSkipped), no las omisiones correctas (skipped)
    // porque el preview ya las mostraba como "Existe" antes de hacer click
    if (apiSkipped > 0) toast.error(`${apiSkipped} combinación${apiSkipped !== 1 ? "es" : ""} no pudieron crearse. Pueden ya existir activas o tener conflicto de código — revisá la lista.`);
    if (created === 0 && apiSkipped === 0) toast.info("No había combinaciones nuevas para crear.");
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
    // Create mode: guardar para subir después de crear el artículo
    if (!articleId) {
      if (pendingMainImageUrl) URL.revokeObjectURL(pendingMainImageUrl);
      setPendingMainImage(file);
      setPendingMainImageUrl(URL.createObjectURL(file));
      return;
    }
    setBusyImg(true);
    try {
      const img = await articlesApi.images.upload(articleId, file, "", true);
      setImages(prev => [...prev.map(i => ({ ...i, isMain: false })), img]);
    } catch (e: any) {
      toast.error(e?.message || "Error al subir imagen.");
    } finally { setBusyImg(false); }
  }

  /** Elimina la imagen principal actual (usada en tab General). */
  async function handleDeleteMainImage() {
    // Create mode: solo limpiar el pending
    if (!articleId) {
      setPendingMainImage(null);
      if (pendingMainImageUrl) URL.revokeObjectURL(pendingMainImageUrl);
      setPendingMainImageUrl(null);
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
      toast.error(e?.message || "Error al establecer imagen principal.");
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
      toast.error(e?.message || "Error al eliminar imagen.");
    } finally { setRemovingImg(null); }
  }

  async function handleAddImage(file: File) {
    if (!articleId) return;
    if (images.length >= 5) { toast.error("Máximo 5 imágenes por artículo."); return; }
    setBusyAddImg(true);
    try {
      const img = await articlesApi.images.upload(articleId, file, "", false);
      setImages(prev => [...prev, img]);
    } catch (e: any) {
      toast.error(e?.message || "Error al subir imagen.");
    } finally {
      setBusyAddImg(false);
    }
  }

  async function handleSetMainImage(imgId: string) {
    if (!articleId) return;
    try {
      await articlesApi.images.setMain(articleId, imgId);
      setImages(prev => prev.map(i => ({ ...i, isMain: i.id === imgId })));
    } catch (e: any) {
      toast.error(e?.message || "Error al cambiar imagen principal.");
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
    .map((k) => ({ value: k, label: ARTICLE_TYPE_LABELS[k] }));
  const statusOptions = (Object.keys(ARTICLE_STATUS_LABELS) as ArticleStatus[]).map((k) => ({
    value: k, label: ARTICLE_STATUS_LABELS[k],
  }));
  // Ocultar BY_MATERIAL salvo que el artículo ya lo tenga asignado (para no romper edición)
  const stockModeOptions = (Object.keys(STOCK_MODE_LABELS) as StockMode[])
    .filter((k) => k !== "BY_MATERIAL" || draft.stockMode === "BY_MATERIAL")
    .map((k) => ({ value: k, label: STOCK_MODE_LABELS[k] }));
  const barcodeTypeOptions = [
    { value: "CODE128", label: "CODE128" },
    { value: "EAN13",   label: "EAN-13" },
    { value: "QR",      label: "QR" },
  ];
  const hechuraModeOptions = (Object.keys(HECHURA_MODE_LABELS) as HechuraPriceMode[]).map((k) => ({
    value: k, label: HECHURA_MODE_LABELS[k],
  }));
  const costModeOptions: { value: CostCalculationMode; label: string }[] = [
    { value: "MANUAL",              label: COST_MODE_LABELS["MANUAL"] },
    { value: "MULTIPLIER",          label: COST_MODE_LABELS["MULTIPLIER"] },
    { value: "METAL_MERMA_HECHURA", label: COST_MODE_LABELS["METAL_MERMA_HECHURA"] },
  ];


  // ── título modal ───────────────────────────────────────────────────────
  const modalTitle = isEdit
    ? `Editar: ${article?.name ?? "…"}`
    : isClone
    ? "Clonar artículo"
    : "Nuevo artículo";

  // ── tab content ────────────────────────────────────────────────────────
  function renderTabGeneral() {
    const mainImageSrc = pendingMainImageUrl
      ?? images.find(i => i.isMain)?.url
      ?? images[0]?.url
      ?? article?.mainImageUrl
      ?? null;
    const mainImageId = images.find(i => i.isMain)?.id ?? images[0]?.id ?? null;
    const hasDeleteTarget = !!mainImageId || !!pendingMainImage;

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

              {/* ── Tira de miniaturas (solo edición) ── */}
              {isEdit && (
                <div className="flex flex-col gap-1">
                  <div className="flex gap-1 flex-wrap">
                    {/* Todas las imágenes — principal con ring persistente */}
                    {images.map(img => (
                      <div
                        key={img.id}
                        onClick={() => { if (!img.isMain) void handleSetMainImage(img.id); }}
                        className={cn(
                          "relative group w-11 h-11 rounded-lg overflow-hidden border-2 shrink-0 bg-surface2 transition-all",
                          img.isMain
                            ? "border-primary cursor-default"
                            : "border-border hover:border-primary/60 cursor-pointer"
                        )}
                      >
                        <img src={img.url} alt="" className="w-full h-full object-cover" />

                        {/* Badge "principal" persistente */}
                        {img.isMain && (
                          <div className="absolute top-0.5 left-0.5 bg-primary rounded-sm w-3.5 h-3.5 flex items-center justify-center">
                            <Check size={8} className="text-white" strokeWidth={3} />
                          </div>
                        )}

                        {/* Overlay hover */}
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
                    ))}

                    {/* Botón agregar (oculto cuando llega a máximo) */}
                    {images.length < 5 && (
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
                  <span className="text-[10px] text-muted">{images.length}/5 · PNG, JPG, WebP</span>
                </div>
              )}
            </div>

            {/* ── Columna derecha: SKU+Categoría / Nombre / Descripción / config ── */}
            <div className="flex-1 min-w-0 flex flex-col gap-3">

              {/* Fila 1: SKU + Categoría */}
              <div className="grid grid-cols-2 gap-2">
                <TPField
                  label="SKU"
                  required={draft.barcodeSource === "SKU"}
                  error={submitted && !draft.sku.trim() && draft.barcodeSource === "SKU" ? "Requerido" : undefined}
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
                  <TPField label="Categoría">
                    <TPComboFixed
                      value={draft.categoryId}
                      onChange={(v) => set("categoryId", v)}
                      options={categoryOptions}
                      searchable
                    />
                  </TPField>
                )}
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
              <div className="grid grid-cols-2 gap-2">
                <TPField label="Tipo">
                  <TPComboFixed
                    value={draft.articleType}
                    onChange={(v) => set("articleType", v as ArticleType)}
                    options={articleTypeOptions}
                  />
                </TPField>
                <TPField label="Estado">
                  <TPComboFixed
                    value={draft.status}
                    onChange={(v) => set("status", v as ArticleStatus)}
                    options={statusOptions}
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
                  />
                </TPField>
                {draft.articleType !== "SERVICE" && (
                  <TPField
                    label="Punto de reposición"
                    hint={variants.length > 0 ? "Se configura por variante" : undefined}
                  >
                    <TPNumberInput
                      value={draft.reorderPoint}
                      onChange={(v) => set("reorderPoint", v)}
                      placeholder="0" min={0}
                      disabled={variants.length > 0}
                    />
                  </TPField>
                )}
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

        {/* ── Datos comerciales ─────────────────────────────────────── */}
        <TPCard title="Datos comerciales">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Proveedor preferido — siempre primero y visible, incluso para servicios */}
            <TPField label="Proveedor preferido" className={draft.articleType === "SERVICE" ? "sm:col-span-2" : undefined}>
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
            {/* Campos que solo aplican a productos (no servicios) */}
            {draft.articleType !== "SERVICE" && (
              <>
                <TPField label="Código en proveedor">
                  <TPInput value={draft.supplierCode} onChange={(v) => set("supplierCode", v)} placeholder="Ref. proveedor" />
                </TPField>
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
                <TPField label="Unidad de medida">
                  <TPComboCreatable
                    type="UNIT_OF_MEASURE"
                    items={unitItems}
                    value={draft.unitOfMeasure}
                    onChange={(v) => set("unitOfMeasure", v)}
                    placeholder="UND, KG, MT…"
                    allowCreate
                    onCreate={async (label) => { await createCatalogItem("UNIT_OF_MEASURE", label); await loadUnitItems(); }}
                    onRefresh={loadUnitItems}
                    mode={isEdit ? "edit" : "create"}
                  />
                </TPField>
              </>
            )}
          </div>
        </TPCard>

        <EntityEditModal
          open={newSupplierModalOpen}
          mode="CREATE"
          isSupplierContext
          suppressNavigate
          onClose={() => setNewSupplierModalOpen(false)}
          onSaved={handleSupplierCreated}
        />

        {/* ── Opciones y notas ──────────────────────────────────────── */}
        <TPCard title="Opciones y notas">
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TPCheckbox checked={draft.showInStore} onChange={(v) => set("showInStore", v)} label="Mostrar en tienda" />
              {draft.articleType !== "SERVICE" && (
                <TPCheckbox checked={draft.isReturnable} onChange={(v) => set("isReturnable", v)} label="Acepta devoluciones" />
              )}
              {draft.articleType !== "SERVICE" && (
                <TPCheckbox checked={draft.sellWithoutVariants} onChange={(v) => set("sellWithoutVariants", v)} label="Vender sin variantes" />
              )}
            </div>
            <TPField label="Notas internas">
              <TPTextarea
                value={draft.notes}
                onChange={(v) => set("notes", v)}
                rows={2}
                placeholder="Notas internas (no visible al cliente)"
              />
            </TPField>
          </div>
        </TPCard>
      </div>
    );
  }

  function addCostLine(type: CostLineType) {
    const line: CostLine = {
      type,
      label:          type === "HECHURA" ? "Hechura / Mano de Obra" : "",
      quantity:       1,
      unitValue:      0,
      currencyId:     null,
      mermaPercent:   type === "METAL" ? (draft.mermaPercent ?? null) : null,
      metalVariantId: null,
      sortOrder:      costLines.length,
    };
    setCostLines(prev => [...prev, line]);
  }

  function renderTabCostos() {
    const isService = draft.articleType === "SERVICE";
    const mode = draft.costCalculationMode;

    // Armar opciones para CostCompositionTable
    const metalVariantOptions: MetalVariantOption[] = metalVariants.map((mv) => ({
      id:               mv.id,
      label:            `${(mv as any)._metalName ? `${(mv as any)._metalName} — ` : ""}${mv.name}`,
      latestQuotePrice: mv.finalSalePrice != null ? Number(mv.finalSalePrice) : null,
    }));
    const currencyOptions: CurrencyOption[] = currencies.map((c) => ({
      id:         c.id,
      code:       c.code,
      symbol:     c.symbol,
      isBase:     c.isBase,
      latestRate: c.latestRate ?? null,
    }));
    const baseCurrency = currencies.find(c => c.isBase);
    const baseCurrencyId     = baseCurrency?.id     ?? "";
    const baseCurrencySymbol = baseCurrency?.symbol ?? "$";

    return (
      <div className="space-y-4">

        {/* ══════════════════════════════════════════════════════════
            COMPOSICIÓN DE COSTO — se muestra siempre que haya líneas,
            independientemente del modo de cálculo seleccionado.
            En modo METAL_MERMA_HECHURA la tabla se muestra dentro del bloque
            de ese modo (con botones de agregar). Aquí la mostramos para los
            demás modos cuando el artículo ya tiene líneas guardadas.
        ══════════════════════════════════════════════════════════ */}
        {!isService && costLines.length > 0 && mode !== "METAL_MERMA_HECHURA" && (
          <TPCard
            title="Composición de costo"
            right={<span className="text-xs font-medium text-amber-400">Tiene prioridad sobre el modo de cálculo</span>}
          >
            <div className="space-y-3">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300 flex items-center gap-2">
                <Info size={12} className="shrink-0" />
                Este artículo tiene líneas de composición guardadas. El backend las usa para calcular el costo, sin importar el modo seleccionado. Para editar la composición, cambiá el modo a <strong className="font-semibold">Metal + Hechura</strong>.
              </div>
              <CostCompositionTable
                lines={costLines}
                onChange={setCostLines}
                metalVariants={metalVariantOptions}
                currencies={currencyOptions}
                baseCurrencyId={baseCurrencyId}
                baseCurrencySymbol={baseCurrencySymbol}
                defaultMermaPercent={draft.mermaPercent}
                productItems={productItems.map(p => ({ id: p.id, label: p.name, costPrice: p.costPrice, salePrice: null }))}
                serviceItems={serviceItems.map(s => ({ id: s.id, label: s.name, costPrice: s.costPrice, salePrice: null }))}
                hideAddButtons
              />
            </div>
          </TPCard>
        )}

        {/* ══════════════════════════════════════════════════════════
            BLOQUE 1 — COSTO DEL ARTÍCULO (solo modo MANUAL)
        ══════════════════════════════════════════════════════════ */}
        {mode === "MANUAL" && (() => {
          const selCurr  = currencies.find(c => c.id === draft.manualCurrencyId) ?? currencies.find(c => c.isBase);
          const selSym   = selCurr?.symbol ?? baseCurrencySymbol;
          const baseCurr = currencies.find(c => c.isBase);

          const taxOptions    = taxes.filter(t => t.calculationType === "PERCENTAGE" && t.rate != null);
          const selectedTaxes = taxOptions.filter(t => draft.manualTaxIds.includes(t.id));
          const totalTaxPct   = selectedTaxes.reduce((s, t) => s + parseFloat(t.rate!), 0);

          const rawBase      = draft.manualBaseCost ?? 0;
          const adjVal       = Math.abs(draft.manualAdjustmentValue ?? 0);
          const adjSign      = draft.manualAdjustmentKind === "" ? 0 : draft.manualAdjustmentKind === "SURCHARGE" ? 1 : -1;
          const adjAmount    = adjSign * (draft.manualAdjustmentType === "PERCENTAGE" ? rawBase * (adjVal / 100) : adjVal);
          const adjustedCost = rawBase + adjAmount;
          const taxAmount    = totalTaxPct > 0 ? adjustedCost * (totalTaxPct / 100) : 0;
          const finalCost    = adjustedCost + taxAmount;
          const rate          = selCurr && !selCurr.isBase ? (selCurr.latestRate ?? null) : null;
          const convertedCost = rate != null ? adjustedCost * rate : null;
          const hasFinalCost  = rawBase > 0;

          function fmtN(n: number) {
            return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          }

          return (
            <TPCard title="Costo del artículo" right={<span className="text-xs text-muted">Manual</span>}>
              <div className="space-y-5">

                {/* Selector de método */}
                {!isService && (
                  <TPField label="¿Cómo se calcula el costo?" hint="Podés cambiar a cálculo por metal o multiplicador si el artículo tiene composición de materiales.">
                    <TPComboFixed
                      value={mode}
                      onChange={(v) => set("costCalculationMode", v as CostCalculationMode)}
                      options={costModeOptions}
                    />
                  </TPField>
                )}

                {/* ── Ajuste e impuestos ───────────────── */}
                <div className="border-t border-border pt-4 space-y-5">
                  <div className="text-xs font-semibold text-muted uppercase tracking-wide">Ajuste e impuestos</div>

                  {/* 3 columnas: moneda | costo base | equivalente */}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-stretch">
                    <div className="rounded-xl border border-border bg-card p-3 flex flex-col gap-2">
                      <div className="text-xs font-semibold text-muted uppercase tracking-wide">Moneda</div>
                      <TPComboFixed
                        value={draft.manualCurrencyId || baseCurrencyId}
                        onChange={(v) => set("manualCurrencyId", v)}
                        options={currencies.map(c => ({
                          value: c.id,
                          label: `${c.code} — ${c.symbol}${c.isBase ? " (base)" : ""}`,
                        }))}
                      />
                      <div className="mt-auto text-[11px] text-muted">
                        {selCurr?.isBase ? "Moneda principal de tu negocio" : `Tipo de cambio: ${selCurr?.latestRate ?? "sin cotización"}`}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-3 flex flex-col gap-2">
                      <div className="text-xs font-semibold text-muted uppercase tracking-wide">Costo base</div>
                      <TPNumberInput
                        value={draft.manualBaseCost}
                        onChange={(v) => set("manualBaseCost", v)}
                        placeholder="0,00"
                        min={0}
                        decimals={2}
                        leftIcon={<span className="text-sm font-semibold">{selSym}</span>}
                        className="h-[48px]"
                        wrapClassName="space-y-0"
                      />
                      <div className="mt-auto text-[11px] text-muted">Lo que te cuesta comprar o fabricar este artículo (sin impuestos)</div>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-3 flex flex-col gap-2">
                      <div className="text-xs font-semibold text-muted uppercase tracking-wide">
                        Equivalente en moneda base
                      </div>
                      <TPNumberInput
                        value={convertedCost != null ? rawBase * rate! : rawBase > 0 ? rawBase : null}
                        onChange={() => {}}
                        readOnly
                        decimals={2}
                        showArrows={false}
                        leftIcon={<span className="text-sm font-semibold">{convertedCost != null ? (baseCurr?.symbol ?? "$") : selSym}</span>}
                        className="h-[48px]"
                        wrapClassName="space-y-0"
                      />
                      <div className="mt-auto text-[11px] text-muted">
                        {convertedCost != null ? "Convertido con cotización actual" : "No requiere conversión"}
                      </div>
                    </div>
                  </div>

                  {selCurr && !selCurr.isBase && selCurr.latestRate == null && (
                    <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                      <Info size={12} className="shrink-0" />
                      {selCurr.code} no tiene cotización cargada — no se puede convertir a {baseCurr?.code ?? "moneda base"}.
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <TPField label="Tipo de beneficio o recargo" hint="Beneficio (bonificación) o recargo sobre el costo.">
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
                          { value: "",          label: "— Sin especificar —" },
                          { value: "BONUS",     label: "Beneficio" },
                          { value: "SURCHARGE", label: "Recargo" },
                        ]}
                      />
                    </TPField>
                    <TPField label="Tipo de valor">
                      <TPComboFixed
                        value={draft.manualAdjustmentType || "PERCENTAGE"}
                        onChange={(v) => {
                          const t = v as "PERCENTAGE" | "FIXED_AMOUNT";
                          lastAdjTypeRef.current = t;
                          set("manualAdjustmentType", t);
                        }}
                        disabled={draft.manualAdjustmentKind === ""}
                        options={[
                          { value: "PERCENTAGE",   label: "Porcentaje (%)" },
                          { value: "FIXED_AMOUNT", label: `Monto fijo (${selSym})` },
                        ]}
                      />
                    </TPField>
                    <TPField
                      label="Valor"
                      hint={adjAmount !== 0 ? (adjAmount < 0 ? `Reduce el costo en ${selSym} ${fmtN(Math.abs(adjAmount))}` : `Suma ${selSym} ${fmtN(adjAmount)} al costo`) : undefined}
                    >
                      <TPNumberInput
                        value={draft.manualAdjustmentKind === "" ? 0 : draft.manualAdjustmentValue}
                        onChange={(v) => set("manualAdjustmentValue", v)}
                        placeholder="0.00"
                        decimals={2}
                        min={0}
                        disabled={draft.manualAdjustmentKind === ""}
                        suffix={(draft.manualAdjustmentType || "PERCENTAGE") === "PERCENTAGE" ? <Percent size={12} /> : undefined}
                        leftIcon={(draft.manualAdjustmentType || "PERCENTAGE") === "FIXED_AMOUNT" ? <span className="text-sm font-semibold">{selSym}</span> : undefined}
                      />
                    </TPField>
                  </div>

                  <TPField label="Impuestos aplicados" hint="Seleccioná los impuestos que afectan el costo de este artículo.">
                    <TPComboCreatableMulti
                      type="IVA_CONDITION"
                      items={taxOptions.map(t => ({
                        id:       t.id,
                        label:    t.name,
                        value:    t.id,
                        isActive: t.isActive,
                      }))}
                      values={draft.manualTaxIds}
                      onChange={(vals) => set("manualTaxIds", vals)}
                      mode={isEdit ? "edit" : "create"}
                      allowCreate={false}
                      placeholder="Seleccioná impuestos…"
                    />
                    {selectedTaxes.length > 0 && (
                      <p className="mt-1.5 text-xs font-medium text-text">
                        {selectedTaxes.map((t, i) => {
                          const pct = t.rate != null ? parseFloat(t.rate!) : 0;
                          const amt = adjustedCost * (pct / 100);
                          return (
                            <span key={t.id}>
                              {i > 0 && <span className="text-muted mx-1">+</span>}
                              {t.name}
                              <span className="text-muted font-normal ml-1">({selSym} {fmtN(amt)})</span>
                            </span>
                          );
                        })}
                        <span className="ml-2 text-muted font-normal">= {fmtN(totalTaxPct)}% total ({selSym} {fmtN(taxAmount)})</span>
                      </p>
                    )}
                  </TPField>

                  <div className="border-t border-border pt-5 space-y-2">
                    <div className={cn(
                      "rounded-2xl border-2 px-6 py-6 text-center transition",
                      hasFinalCost ? "border-primary/40 bg-primary/5" : "border-dashed border-border bg-surface2/20"
                    )}>
                      <div className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-1">
                        Costo ajustado del artículo
                      </div>
                      {hasFinalCost && (
                        <div className="text-[11px] text-muted flex items-center justify-center gap-1.5 mb-2">
                          <span>{selSym} {fmtN(rawBase)}</span>
                          {adjVal !== 0 && (
                            <span className={cn("font-medium", adjAmount < 0 ? "text-emerald-500" : "text-amber-500")}>
                              {adjAmount < 0 ? "−" : "+"} {fmtN(Math.abs(adjAmount))}
                            </span>
                          )}
                        </div>
                      )}
                      <div className={cn(
                        "tabular-nums font-semibold",
                        hasFinalCost ? "text-3xl text-text" : "text-base text-muted font-normal"
                      )}>
                        {hasFinalCost ? `${selSym} ${fmtN(adjustedCost)}` : "Ingresá el costo base"}
                      </div>
                      {convertedCost != null && baseCurr && (
                        <div className="mt-2 text-[11px] text-muted">
                          ≈ {baseCurr.symbol} {fmtN(convertedCost)} en {baseCurr.code}
                        </div>
                      )}
                      {hasFinalCost && (
                        <p className="mt-2 text-[11px] text-muted/70">Este valor se guarda como costo del artículo</p>
                      )}
                    </div>
                    {hasFinalCost && taxAmount > 0 && (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-amber-600 dark:text-amber-400">Impuestos referenciales ({fmtN(totalTaxPct)}%)</span>
                          <span className="tabular-nums font-medium text-amber-600 dark:text-amber-400">+ {selSym} {fmtN(taxAmount)}</span>
                        </div>
                        <div className="flex items-center justify-between border-t border-amber-500/20 pt-1.5">
                          <span className="font-semibold text-amber-600 dark:text-amber-400">Total con impuestos (referencial)</span>
                          <span className="tabular-nums font-bold text-amber-600 dark:text-amber-400">{selSym} {fmtN(finalCost)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </TPCard>
          );
        })()}

        {/* ── MODO METAL + MERMA + HECHURA → un solo card ─────────────── */}
        {!isService && mode === "METAL_MERMA_HECHURA" && (() => {
          const selSym        = baseCurrencySymbol;
          const taxOptions    = taxes.filter(t => t.calculationType === "PERCENTAGE" && t.rate != null);
          const selectedTaxes = taxOptions.filter(t => draft.manualTaxIds.includes(t.id));
          const totalTaxPct   = selectedTaxes.reduce((s, t) => s + parseFloat(t.rate!), 0);

          // Calcular suma en tiempo real desde las líneas de composición
          const rawBase = costLines.reduce((sum, line) => {
            if (!line.quantity || !line.unitValue) return sum;
            let raw: number;
            if (line.type === "METAL") {
              const mermaFactor = 1 + (line.mermaPercent ?? 0) / 100;
              raw = line.quantity * mermaFactor * line.unitValue;
            } else {
              raw = line.quantity * line.unitValue;
            }
            const currId = line.currencyId ?? baseCurrencyId;
            if (currId !== baseCurrencyId) {
              const curr = currencyOptions.find(c => c.id === currId);
              if (curr?.latestRate != null) raw = raw * curr.latestRate;
              else return sum;
            }
            return sum + raw;
          }, 0);

          const adjVal       = Math.abs(draft.manualAdjustmentValue ?? 0);
          const adjSign      = draft.manualAdjustmentKind === "" ? 0 : draft.manualAdjustmentKind === "SURCHARGE" ? 1 : -1;
          const adjAmount    = adjSign * (draft.manualAdjustmentType === "PERCENTAGE" ? rawBase * (adjVal / 100) : adjVal);
          const adjustedCost = rawBase + adjAmount;
          const taxAmount    = totalTaxPct > 0 ? adjustedCost * (totalTaxPct / 100) : 0;
          const finalCost    = adjustedCost + taxAmount;
          const hasFinalCost = rawBase > 0;

          function fmtN(n: number) {
            return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          }

          return (
            <TPCard title="Costo del artículo" right={<span className="text-xs text-muted">Metal y Hechura</span>}>
              <div className="space-y-5">

                {/* Selector de método */}
                <TPField label="¿Cómo se calcula el costo?" hint="Podés cambiar a cálculo manual o multiplicador.">
                  <TPComboFixed
                    value={mode}
                    onChange={(v) => set("costCalculationMode", v as CostCalculationMode)}
                    options={costModeOptions}
                  />
                </TPField>

                {/* ── Ajuste e impuestos ───────────────── */}
                <div className="border-t border-border pt-4 space-y-5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-xs font-semibold text-muted uppercase tracking-wide">Ajuste e impuestos</div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {costLines.some(l => l.type === "METAL" && l.metalVariantId) && (
                        <button
                          type="button"
                          onClick={updateMetalPrices}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-lg border transition shrink-0 bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                        >
                          <RefreshCw size={9} />
                          Actualizar precios
                        </button>
                      )}
                      {TYPE_OPTIONS.map(opt => {
                        const cfg = TYPE_CFG[opt.value];
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => addCostLine(opt.value)}
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-lg border transition shrink-0",
                              "bg-surface2/30 border-border text-muted hover:text-text",
                              cfg.rowBg, `hover:${cfg.rowBorder}`
                            )}
                          >
                            <Plus size={9} />
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                {/* Costo computado por el backend */}
                {isEdit && computed && (
                  <div className={cn(
                    "rounded-xl border p-3 flex items-start gap-3",
                    computed.partial ? "border-amber-500/30 bg-amber-500/10" : "border-emerald-500/30 bg-emerald-500/10"
                  )}>
                    <div className="shrink-0 mt-0.5">
                      {computed.partial ? <AlertCircle size={15} className="text-amber-400" /> : <Calculator size={15} className="text-emerald-400" />}
                    </div>
                    <div className="flex-1 min-w-0 text-sm">
                      <span className="font-medium text-text">Costo s/imp: </span>
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
                      {computed.mode === "COST_LINES" && <span className="ml-2 text-xs text-muted font-normal">(composición por líneas)</span>}
                      {computed.partial && <div className="text-xs text-amber-300/80 mt-0.5">Cálculo parcial — alguna línea no tiene cotización.</div>}
                    </div>
                    <button type="button" onClick={recomputeCost} disabled={loadingCost}
                      className="shrink-0 h-7 w-7 rounded-lg border border-border bg-surface2/40 grid place-items-center hover:bg-surface2 transition" title="Recalcular">
                      {loadingCost ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    </button>
                  </div>
                )}

                {/* Composición de costo */}
                <CostCompositionTable
                  lines={costLines}
                  onChange={setCostLines}
                  metalVariants={metalVariantOptions}
                  currencies={currencyOptions}
                  baseCurrencyId={baseCurrencyId}
                  baseCurrencySymbol={baseCurrencySymbol}
                  defaultMermaPercent={draft.mermaPercent}
                  productItems={productItems.map(p => ({ id: p.id, label: p.name, costPrice: p.costPrice, salePrice: null }))}
                  serviceItems={serviceItems.map(s => ({ id: s.id, label: s.name, costPrice: s.costPrice, salePrice: null }))}
                  hideAddButtons
                />

                {!isEdit && costLines.length === 0 && (
                  <div className="rounded-xl border border-border bg-surface2/30 p-3 text-xs text-muted flex items-center gap-2">
                    <Info size={12} />
                    Podés agregar líneas de costo ahora o después de guardar el artículo.
                  </div>
                )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <TPField label="Tipo de beneficio o recargo" hint="Beneficio (bonificación) o recargo sobre el costo.">
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
                          { value: "",          label: "— Sin especificar —" },
                          { value: "BONUS",     label: "Beneficio" },
                          { value: "SURCHARGE", label: "Recargo" },
                        ]}
                      />
                    </TPField>
                    <TPField label="Tipo de valor">
                      <TPComboFixed
                        value={draft.manualAdjustmentType || "PERCENTAGE"}
                        onChange={(v) => {
                          const t = v as "PERCENTAGE" | "FIXED_AMOUNT";
                          lastAdjTypeRef.current = t;
                          set("manualAdjustmentType", t);
                        }}
                        disabled={draft.manualAdjustmentKind === ""}
                        options={[
                          { value: "PERCENTAGE",   label: "Porcentaje (%)" },
                          { value: "FIXED_AMOUNT", label: `Monto fijo (${selSym})` },
                        ]}
                      />
                    </TPField>
                    <TPField
                      label="Valor"
                      hint={adjAmount !== 0 ? (adjAmount < 0 ? `Reduce el costo en ${selSym} ${fmtN(Math.abs(adjAmount))}` : `Suma ${selSym} ${fmtN(adjAmount)} al costo`) : undefined}
                    >
                      <TPNumberInput
                        value={draft.manualAdjustmentKind === "" ? 0 : draft.manualAdjustmentValue}
                        onChange={(v) => set("manualAdjustmentValue", v)}
                        placeholder="0.00"
                        decimals={2}
                        min={0}
                        disabled={draft.manualAdjustmentKind === ""}
                        suffix={(draft.manualAdjustmentType || "PERCENTAGE") === "PERCENTAGE" ? <Percent size={12} /> : undefined}
                        leftIcon={(draft.manualAdjustmentType || "PERCENTAGE") === "FIXED_AMOUNT" ? <span className="text-sm font-semibold">{selSym}</span> : undefined}
                      />
                    </TPField>
                  </div>

                  <TPField label="Impuestos aplicados" hint="Seleccioná los impuestos que afectan el costo de este artículo.">
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
                      <p className="mt-1.5 text-xs font-medium text-text">
                        {selectedTaxes.map((t, i) => {
                          const pct = t.rate != null ? parseFloat(t.rate!) : 0;
                          const amt = adjustedCost * (pct / 100);
                          return (
                            <span key={t.id}>
                              {i > 0 && <span className="text-muted mx-1">+</span>}
                              {t.name}<span className="text-muted font-normal ml-1">({selSym} {fmtN(amt)})</span>
                            </span>
                          );
                        })}
                        <span className="ml-2 text-muted font-normal">= {fmtN(totalTaxPct)}% total ({selSym} {fmtN(taxAmount)})</span>
                      </p>
                    )}
                  </TPField>

                  <div className="border-t border-border pt-5 space-y-2">
                    <div className={cn(
                      "rounded-2xl border-2 px-6 py-6 text-center transition",
                      hasFinalCost ? "border-primary/40 bg-primary/5" : "border-dashed border-border bg-surface2/20"
                    )}>
                      <div className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-1">Costo ajustado del artículo</div>
                      {hasFinalCost && (
                        <div className="text-[11px] text-muted flex items-center justify-center gap-1.5 mb-2">
                          <span>{selSym} {fmtN(rawBase)}</span>
                          {adjVal !== 0 && (
                            <span className={cn("font-medium", adjAmount < 0 ? "text-emerald-500" : "text-amber-500")}>
                              {adjAmount < 0 ? "−" : "+"} {fmtN(Math.abs(adjAmount))}
                            </span>
                          )}
                        </div>
                      )}
                      <div className={cn("tabular-nums font-semibold", hasFinalCost ? "text-3xl text-text" : "text-base text-muted font-normal")}>
                        {hasFinalCost ? `${selSym} ${fmtN(adjustedCost)}` : "Configurá la composición de costo"}
                      </div>
                      {hasFinalCost && (
                        <p className="mt-2 text-[11px] text-muted/70">Este valor se guarda como costo del artículo</p>
                      )}
                    </div>
                    {hasFinalCost && taxAmount > 0 && (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-amber-600 dark:text-amber-400">Impuestos referenciales ({fmtN(totalTaxPct)}%)</span>
                          <span className="tabular-nums font-medium text-amber-600 dark:text-amber-400">+ {selSym} {fmtN(taxAmount)}</span>
                        </div>
                        <div className="flex items-center justify-between border-t border-amber-500/20 pt-1.5">
                          <span className="font-semibold text-amber-600 dark:text-amber-400">Total con impuestos (referencial)</span>
                          <span className="tabular-nums font-bold text-amber-600 dark:text-amber-400">{selSym} {fmtN(finalCost)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </TPCard>
          );
        })()}

        {/* ── MODO MULTIPLIER — todo en un solo card ───────────────────── */}
        {!isService && mode === "MULTIPLIER" && (() => {
          const mulCurr   = currencies.find(c => c.id === draft.multiplierCurrencyId) ?? currencies.find(c => c.isBase);
          const selSym    = mulCurr?.symbol ?? baseCurrencySymbol;
          const baseCurr  = currencies.find(c => c.isBase);

          const taxOptions    = taxes.filter(t => t.calculationType === "PERCENTAGE" && t.rate != null);
          const selectedTaxes = taxOptions.filter(t => draft.manualTaxIds.includes(t.id));
          const totalTaxPct   = selectedTaxes.reduce((s, t) => s + parseFloat(t.rate!), 0);

          const rawBase      = (draft.multiplierQuantity ?? 0) * (draft.multiplierValue ?? 0);
          const adjVal       = Math.abs(draft.manualAdjustmentValue ?? 0);
          const adjSign      = draft.manualAdjustmentKind === "" ? 0 : draft.manualAdjustmentKind === "SURCHARGE" ? 1 : -1;
          const adjAmount    = adjSign * (draft.manualAdjustmentType === "PERCENTAGE" ? rawBase * (adjVal / 100) : adjVal);
          const adjustedCost = rawBase + adjAmount;
          const taxAmount    = totalTaxPct > 0 ? adjustedCost * (totalTaxPct / 100) : 0;
          const finalCost    = adjustedCost + taxAmount;
          const hasFinalCost = rawBase > 0;

          const rate          = mulCurr && !mulCurr.isBase ? (mulCurr.latestRate ?? null) : null;
          const convertedCost = rate != null ? adjustedCost * rate : null;

          function fmtN(n: number) {
            return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          }

          return (
            <TPCard title="Costo del artículo" right={<span className="text-xs text-muted">Multiplicador</span>}>
              <div className="space-y-5">

                {/* Selector de método */}
                <TPField label="¿Cómo se calcula el costo?" hint="Podés cambiar a cálculo manual o por composición metálica.">
                  <TPComboFixed
                    value={mode}
                    onChange={(v) => set("costCalculationMode", v as CostCalculationMode)}
                    options={costModeOptions}
                  />
                </TPField>

                {/* ── Ajuste e impuestos ───────────────── */}
                <div className="border-t border-border pt-4 space-y-5">
                  <div className="text-xs font-semibold text-muted uppercase tracking-wide">Ajuste e impuestos</div>

                {/* Costo computado por el backend */}
                {isEdit && computed && (
                  <div className={cn(
                    "rounded-xl border p-3 flex items-start gap-3",
                    computed.partial ? "border-amber-500/30 bg-amber-500/10" : "border-emerald-500/30 bg-emerald-500/10"
                  )}>
                    <div className="shrink-0 mt-0.5">
                      {computed.partial ? <AlertCircle size={15} className="text-amber-400" /> : <Calculator size={15} className="text-emerald-400" />}
                    </div>
                    <div className="flex-1 min-w-0 text-sm">
                      <span className="font-medium text-text">Costo s/imp: </span>
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
                      {computed.partial && <div className="text-xs text-amber-300/80 mt-0.5">Cálculo parcial — falta configuración.</div>}
                    </div>
                    <button type="button" onClick={recomputeCost} disabled={loadingCost}
                      className="shrink-0 h-7 w-7 rounded-lg border border-border bg-surface2/40 grid place-items-center hover:bg-surface2 transition" title="Recalcular">
                      {loadingCost ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    </button>
                  </div>
                )}

                {/* Fila 1 — Base del multiplicador (ancho completo) */}
                <TPField
                  label="Base del multiplicador"
                  hint="¿Sobre qué unidad se calcula el costo? Ej: Gramos, Kilates, Piezas."
                >
                  <TPComboCreatable
                    type="MULTIPLIER_BASE"
                    items={multiplierBaseItems}
                    value={draft.multiplierBase}
                    onChange={(v) => set("multiplierBase", v)}
                    placeholder="Ej: Gramos, Kilates, Piezas…"
                    mode={isEdit ? "edit" : "create"}
                  />
                </TPField>

                {/* Fila 2 — Moneda (1fr) | Valor por unidad (2fr) | Cantidad (1.5fr) */}
                <div className="grid grid-cols-1 gap-3 md:items-stretch" style={{ gridTemplateColumns: "1fr 2fr 1.5fr" }}>

                  {/* Moneda */}
                  <div className="rounded-xl border border-border bg-card p-3 flex flex-col gap-2">
                    <div className="text-xs font-semibold text-muted uppercase tracking-wide">Moneda</div>
                    <TPComboFixed
                      value={draft.multiplierCurrencyId || baseCurrencyId}
                      onChange={(v) => set("multiplierCurrencyId", v)}
                      options={currencies.map(c => ({
                        value: c.id,
                        label: `${c.code} — ${c.symbol}${c.isBase ? " (base)" : ""}`,
                      }))}
                    />
                    <div className="mt-auto text-[11px] text-muted">
                      {mulCurr?.isBase ? "Moneda del negocio" : `TC: ${mulCurr?.latestRate ?? "sin cot."}`}
                    </div>
                  </div>

                  {/* Valor por unidad */}
                  <div className="rounded-xl border border-border bg-card p-3 flex flex-col gap-2">
                    <div className="text-xs font-semibold text-muted uppercase tracking-wide">
                      Valor por {draft.multiplierBase?.trim() || "unidad"}
                    </div>
                    <TPNumberInput
                      value={draft.multiplierValue}
                      onChange={(v) => set("multiplierValue", v)}
                      placeholder="0,00"
                      min={0}
                      decimals={2}
                      leftIcon={<span className="text-sm font-semibold">{selSym}</span>}
                      className="h-[48px]"
                      wrapClassName="space-y-0"
                    />
                    <div className="mt-auto text-[11px] text-muted">
                      ¿Cuánto vale cada {draft.multiplierBase?.trim() || "unidad"}?
                    </div>
                  </div>

                  {/* Cantidad */}
                  <div className="rounded-xl border border-border bg-card p-3 flex flex-col gap-2">
                    <div className="text-xs font-semibold text-muted uppercase tracking-wide">
                      Cantidad{draft.multiplierBase?.trim() ? ` en ${draft.multiplierBase}` : ""}
                    </div>
                    <TPNumberInput
                      value={draft.multiplierQuantity}
                      onChange={(v) => set("multiplierQuantity", v)}
                      placeholder="0,00"
                      min={0}
                      decimals={2}
                      className="h-[48px]"
                      wrapClassName="space-y-0"
                    />
                    <div className="mt-auto text-[11px] text-muted">
                      ¿Cuántas {draft.multiplierBase?.trim() || "unidades"} tiene?
                    </div>
                  </div>
                </div>

                {/* Aviso de cotización faltante */}
                {mulCurr && !mulCurr.isBase && mulCurr.latestRate == null && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                    <Info size={12} className="shrink-0" />
                    {mulCurr.code} no tiene cotización — no se puede convertir a {baseCurr?.code ?? "moneda base"}.
                  </div>
                )}

                {/* Fórmula visual */}
                <div className={cn(
                  "rounded-xl border px-4 py-3 text-sm flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums",
                  rawBase > 0 ? "border-primary/30 bg-primary/5" : "border-dashed border-border bg-surface2/20"
                )}>
                  <Calculator size={13} className={rawBase > 0 ? "text-primary shrink-0" : "text-muted shrink-0"} />
                  <span className="font-medium text-text">{selSym} {fmtN(draft.multiplierValue ?? 0)}</span>
                  <span className="text-muted">×</span>
                  <span className="font-medium text-text">{fmtN(draft.multiplierQuantity ?? 0)}</span>
                  {draft.multiplierBase?.trim() && (
                    <span className="text-muted lowercase">{draft.multiplierBase}</span>
                  )}
                  <span className="text-muted">=</span>
                  <span className={cn("font-semibold", rawBase > 0 ? "text-text" : "text-muted")}>
                    {selSym} {fmtN(rawBase)}
                  </span>
                  {rate != null && rawBase > 0 && baseCurr && (
                    <span className="text-muted text-xs ml-auto">≈ {baseCurr.symbol} {fmtN(rawBase * rate)} en {baseCurr.code}</span>
                  )}
                </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <TPField label="Tipo de beneficio o recargo" hint="Beneficio (bonificación) o recargo sobre el costo.">
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
                          { value: "",          label: "— Sin especificar —" },
                          { value: "BONUS",     label: "Beneficio" },
                          { value: "SURCHARGE", label: "Recargo" },
                        ]}
                      />
                    </TPField>
                    <TPField label="Tipo de valor">
                      <TPComboFixed
                        value={draft.manualAdjustmentType || "PERCENTAGE"}
                        onChange={(v) => {
                          const t = v as "PERCENTAGE" | "FIXED_AMOUNT";
                          lastAdjTypeRef.current = t;
                          set("manualAdjustmentType", t);
                        }}
                        disabled={draft.manualAdjustmentKind === ""}
                        options={[
                          { value: "PERCENTAGE",   label: "Porcentaje (%)" },
                          { value: "FIXED_AMOUNT", label: `Monto fijo (${selSym})` },
                        ]}
                      />
                    </TPField>
                    <TPField
                      label="Valor"
                      hint={adjAmount !== 0 ? (adjAmount < 0 ? `Reduce el costo en ${selSym} ${fmtN(Math.abs(adjAmount))}` : `Suma ${selSym} ${fmtN(adjAmount)} al costo`) : undefined}
                    >
                      <TPNumberInput
                        value={draft.manualAdjustmentKind === "" ? 0 : draft.manualAdjustmentValue}
                        onChange={(v) => set("manualAdjustmentValue", v)}
                        placeholder="0.00"
                        decimals={2}
                        min={0}
                        disabled={draft.manualAdjustmentKind === ""}
                        suffix={(draft.manualAdjustmentType || "PERCENTAGE") === "PERCENTAGE" ? <Percent size={12} /> : undefined}
                        leftIcon={(draft.manualAdjustmentType || "PERCENTAGE") === "FIXED_AMOUNT" ? <span className="text-sm font-semibold">{selSym}</span> : undefined}
                      />
                    </TPField>
                  </div>

                  <TPField label="Impuestos aplicados" hint="Seleccioná los impuestos que afectan el costo de este artículo.">
                    <TPComboCreatableMulti
                      type="IVA_CONDITION"
                      items={taxOptions.map(t => ({
                        id:       t.id,
                        label:    t.name,
                        value:    t.id,
                        isActive: t.isActive,
                      }))}
                      values={draft.manualTaxIds}
                      onChange={(vals) => set("manualTaxIds", vals)}
                      mode={isEdit ? "edit" : "create"}
                      allowCreate={false}
                      placeholder="Seleccioná impuestos…"
                    />
                    {selectedTaxes.length > 0 && (
                      <p className="mt-1.5 text-xs font-medium text-text">
                        {selectedTaxes.map((t, i) => {
                          const pct = t.rate != null ? parseFloat(t.rate!) : 0;
                          const amt = adjustedCost * (pct / 100);
                          return (
                            <span key={t.id}>
                              {i > 0 && <span className="text-muted mx-1">+</span>}
                              {t.name}
                              <span className="text-muted font-normal ml-1">({selSym} {fmtN(amt)})</span>
                            </span>
                          );
                        })}
                        <span className="ml-2 text-muted font-normal">= {fmtN(totalTaxPct)}% total ({selSym} {fmtN(taxAmount)})</span>
                      </p>
                    )}
                  </TPField>

                  <div className="border-t border-border pt-5 space-y-2">
                    <div className={cn(
                      "rounded-2xl border-2 px-6 py-6 text-center transition",
                      hasFinalCost
                        ? "border-primary/40 bg-primary/5"
                        : "border-dashed border-border bg-surface2/20"
                    )}>
                      <div className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-1">
                        Costo ajustado del artículo
                      </div>
                      {hasFinalCost && (
                        <div className="text-[11px] text-muted flex items-center justify-center gap-1.5 mb-2">
                          <span>{selSym} {fmtN(rawBase)}</span>
                          {adjVal !== 0 && (
                            <span className={cn("font-medium", adjAmount < 0 ? "text-emerald-500" : "text-amber-500")}>
                              {adjAmount < 0 ? "−" : "+"} {fmtN(Math.abs(adjAmount))}
                            </span>
                          )}
                        </div>
                      )}
                      <div className={cn(
                        "tabular-nums font-semibold",
                        hasFinalCost ? "text-3xl text-text" : "text-base text-muted font-normal"
                      )}>
                        {hasFinalCost
                          ? `${selSym} ${fmtN(adjustedCost)}`
                          : "Configurá el multiplicador para calcular"
                        }
                      </div>
                      {convertedCost != null && baseCurr && (
                        <div className="mt-2 text-[11px] text-muted">
                          ≈ {baseCurr.symbol} {fmtN(convertedCost)} en {baseCurr.code}
                        </div>
                      )}
                      {hasFinalCost && (
                        <p className="mt-2 text-[11px] text-muted/70">Este valor se guarda como costo del artículo</p>
                      )}
                    </div>
                    {hasFinalCost && taxAmount > 0 && (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-amber-600 dark:text-amber-400">Impuestos referenciales ({fmtN(totalTaxPct)}%)</span>
                          <span className="tabular-nums font-medium text-amber-600 dark:text-amber-400">+ {selSym} {fmtN(taxAmount)}</span>
                        </div>
                        <div className="flex items-center justify-between border-t border-amber-500/20 pt-1.5">
                          <span className="font-semibold text-amber-600 dark:text-amber-400">Total con impuestos (referencial)</span>
                          <span className="tabular-nums font-bold text-amber-600 dark:text-amber-400">{selSym} {fmtN(finalCost)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </TPCard>
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
          <TPCard>
            <div className="space-y-5">
              <p className="text-xs text-muted">
                Seleccioná los valores para cada eje. El sistema generará todas las combinaciones posibles.
              </p>

              {/* Selector multiselect por eje */}
              {variantAxes.map((axis, axisIdx) => {
                const selected = genSelected[axis.id] ?? [];
                const hasOptions = axisHasOptions(axis);
                const isFirst = axisIdx === 0;
                const isLast  = axisIdx === variantAxes.length - 1;
                return (
                  <div key={axis.id} className="space-y-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Botones de orden — solo visibles cuando hay más de 1 eje */}
                      {variantAxes.length > 1 && (
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => moveAxisUp(axis.id)}
                            disabled={isFirst}
                            title="Mover este eje arriba"
                            className={cn(
                              "h-4 w-4 flex items-center justify-center rounded transition-colors",
                              isFirst
                                ? "text-muted/30 cursor-not-allowed"
                                : "text-muted hover:text-text hover:bg-surface2 cursor-pointer"
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
                              isLast
                                ? "text-muted/30 cursor-not-allowed"
                                : "text-muted hover:text-text hover:bg-surface2 cursor-pointer"
                            )}
                          >
                            <ArrowDown size={10} />
                          </button>
                        </div>
                      )}
                      <span className="text-sm font-medium">{axis.definition.name}</span>
                      {axis.isRequired && <span className="text-primary text-sm leading-none">*</span>}
                      {/* Indicador de posición */}
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
                      /* Chips clicables para SELECT / BOOLEAN / MULTISELECT */
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
                                {/* Badge "Creada" para valores ya existentes (checkeados) */}
                                {checked && isExisting && (
                                  <span className="rounded bg-emerald-500/20 px-1 leading-tight text-[10px] text-emerald-400">
                                    Creada
                                  </span>
                                )}
                                {/* Indicador sutil para valores existentes pero no seleccionados */}
                                {!checked && isExisting && (
                                  <span className="rounded bg-emerald-500/10 px-1 leading-tight text-[10px] text-emerald-600">
                                    En uso
                                  </span>
                                )}
                                {/* Extension de SKU solo para valores aún no creados */}
                                {!isExisting && showExt && opt.codeExtension ? (
                                  <span className="rounded bg-primary/20 px-1 leading-tight text-[10px] font-mono font-bold">
                                    {opt.codeExtension}
                                  </span>
                                ) : !isExisting && showExt && (
                                  <span className="rounded bg-amber-500/20 px-1 leading-tight text-[10px] font-mono text-amber-400" title="Sin código de extensión — usará el nombre como fallback">
                                    ?
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        {/* Orden de generación (solo si hay nuevos para crear) */}
                        {selected.filter(v => !isAxisValueExisting(axis.id, v)).length > 1 && (
                          <div className="space-y-1 pt-1">
                            <p className="text-[10px] text-muted uppercase tracking-wide font-semibold">Orden de generación (nuevas)</p>
                            <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={(e) => handleAxisOptionDragEnd(axis.id, e)}>
                              <SortableContext items={selected} strategy={horizontalListSortingStrategy}>
                                <div className="flex flex-wrap gap-1.5">
                                  {selected.map(val => {
                                    const opt = genOptionsForAxis(axis).find(o => o.value === val);
                                    return (
                                      <SortableChip
                                        key={val}
                                        id={val}
                                        label={opt?.label ?? val}
                                        existing={isAxisValueExisting(axis.id, val)}
                                      />
                                    );
                                  })}
                                </div>
                              </SortableContext>
                            </DndContext>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Input + tags arrastrables para TEXT / NUMBER / DATE / etc */
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
                                    <SortableChip
                                      key={val}
                                      id={val}
                                      label={val}
                                      existing={isExisting}
                                      onRemove={isExisting ? undefined : () => removeGenTag(axis.id, val)}
                                    />
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

              {/* ── Warning: opciones sin codeExtension cuando SKU automático ── */}
              {genSkuMode === "auto" && (() => {
                const anyMissing = variantAxes.some(ax =>
                  genOptionsForAxis(ax).some(o => !o.codeExtension)
                );
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

              {/* ── SKU mode toggle (siempre visible) ─────────────────────── */}
              <div className="flex items-center pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setGenSkuMode(m => m === "auto" ? "manual" : "auto")}
                  className="flex items-center gap-2 text-xs text-muted hover:text-text transition"
                >
                  <span
                    className={cn(
                      "relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition",
                      genSkuMode === "auto" ? "bg-primary" : "bg-border"
                    )}
                  >
                    <span className={cn(
                      "inline-block h-3 w-3 transform rounded-full bg-white shadow transition",
                      genSkuMode === "auto" ? "translate-x-3.5" : "translate-x-0.5"
                    )} />
                  </span>
                  SKU automático
                </button>
              </div>

              {/* ── Preview siempre derivado del estado ───────────────────── */}
              {genCombos.length === 0 ? (
                <div className="rounded-xl border border-border bg-surface2/30 p-4 text-center text-sm text-muted">
                  {variantAxes.some(ax => (genSelected[ax.id] ?? []).length > 0)
                    ? "Seleccioná valores en todos los ejes para ver las combinaciones."
                    : isEdit && variants.length > 0
                      ? "Las variantes existentes no tienen atributos guardados. Seleccioná los valores manualmente para ver combinaciones."
                      : "Seleccioná valores para generar variantes automáticamente."}
                </div>
              ) : (
                <div className="space-y-3 pt-3 border-t border-border">
                  {/* Resumen compacto */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-muted uppercase tracking-wide">Resumen:</span>
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
                        {genCombos.filter(c => !c.isNew).length} ya existen (se omitirán)
                      </span>
                    )}
                  </div>

                  {/* Sección: combinaciones ya existentes (colapsable visualmente) */}
                  {genCombos.filter(c => !c.isNew).length > 0 && (
                    <details className="group">
                      <summary className="cursor-pointer text-xs font-medium text-muted hover:text-text transition-colors list-none flex items-center gap-1">
                        <span className="group-open:hidden">▶</span>
                        <span className="hidden group-open:inline">▼</span>
                        Ver {genCombos.filter(c => !c.isNew).length} ya existente{genCombos.filter(c => !c.isNew).length !== 1 ? "s" : ""} (se omitirán)
                      </summary>
                      <div className="mt-2 space-y-1 max-h-32 overflow-y-auto pr-1">
                        {genCombos.filter(c => !c.isNew).map(combo => {
                          const existingVariant = variants.find(v => buildVariantComboKey(v) === combo.key);
                          return (
                            <div key={combo.key} className="rounded-lg border border-emerald-600/20 bg-emerald-500/5 px-3 py-1.5">
                              <div className="flex items-center gap-2 text-sm min-w-0">
                                <Check size={11} className="text-emerald-500 shrink-0" />
                                <span className="truncate flex-1 text-emerald-400 text-xs font-medium">
                                  {existingVariant?.name ?? combo.name}
                                </span>
                                <span className="font-mono text-[10px] text-muted shrink-0">
                                  {existingVariant?.code ?? combo.code}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}

                  {genCombos.filter(c => c.isNew).length === 0 ? (
                    <div className="rounded-xl border border-emerald-600/20 bg-emerald-500/5 p-4 text-center text-sm text-emerald-400">
                      Todas las combinaciones seleccionadas ya existen. No hay nada nuevo para crear.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      <p className="text-xs font-semibold text-muted uppercase tracking-wide">
                        A crear ({genCombos.filter(c => c.isNew).length})
                      </p>
                      {genCombos.filter(c => c.isNew).map(combo => (
                        <div
                          key={combo.key}
                          className={cn(
                            "rounded-lg border px-3 py-2 space-y-1.5",
                            combo.isRegeneratable
                              ? "border-amber-500/30 bg-amber-500/5"
                              : "border-primary/20 bg-primary/3"
                          )}
                        >
                          {/* Nombre + chips de atributos */}
                          <div className="flex items-center gap-2 text-sm min-w-0">
                            <span className={cn(
                              "shrink-0",
                              combo.isRegeneratable ? "text-amber-500" : "text-primary/70"
                            )}>
                              {combo.isRegeneratable ? <RefreshCw size={11} /> : <Plus size={11} />}
                            </span>
                            <span className="font-medium truncate flex-1 text-sm">{combo.name}</span>
                            <span className="font-mono text-[10px] text-muted shrink-0 bg-surface2 px-1.5 py-0.5 rounded">{combo.code}</span>
                            {combo.isRegeneratable && (
                              <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400 shrink-0">
                                Regenerable
                              </span>
                            )}
                          </div>
                          {/* Atributos de la combinación */}
                          {combo.attrs.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {combo.attrs.map(a => (
                                <span
                                  key={a.assignmentId}
                                  className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted"
                                >
                                  <span className="text-muted/60">{a.axisName}:</span> {a.value}
                                </span>
                              ))}
                            </div>
                          )}
                          {/* SKU breakdown (solo si modo auto y hay SKU) */}
                          {genSkuMode === "auto" && combo.sku && (
                            <div className="flex items-center gap-1 flex-wrap text-[11px]">
                              <span className="font-mono rounded bg-surface2 px-1.5 py-0.5 text-text font-semibold">
                                {(draft.sku || draft.code).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "ART"}
                              </span>
                              {combo.attrs.map(a => (
                                <React.Fragment key={a.assignmentId}>
                                  <span className="text-muted">+</span>
                                  <span
                                    className={cn(
                                      "font-mono rounded px-1.5 py-0.5 font-semibold",
                                      a.codeExtension
                                        ? "bg-primary/15 text-primary"
                                        : "bg-amber-500/15 text-amber-400"
                                    )}
                                    title={a.codeExtension
                                      ? `Código de extensión: ${a.codeExtension}`
                                      : `Sin código — fallback de "${a.value}"`}
                                  >
                                    {a.codeExtension || a.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "X"}
                                  </span>
                                </React.Fragment>
                              ))}
                              <span className="text-muted">=</span>
                              <span className="font-mono font-bold text-text">{combo.sku}</span>
                              {!combo.skuUsedExtensions && (
                                <span className="text-amber-400 text-[10px]">(fallback)</span>
                              )}
                            </div>
                          )}
                          {/* SKU editable */}
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-muted w-8 shrink-0">SKU</label>
                            <div className="flex-1">
                              <TPInput
                                value={combo.sku}
                                onChange={v => updateComboSku(combo.key, v)}
                                placeholder="SKU (opcional)"
                              />
                              {combo.skuError && (
                                <p className="text-xs text-red-500 mt-0.5">{combo.skuError}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Botón crear (solo cuando hay combinaciones nuevas) */}
                  {genCombos.filter(c => c.isNew).length > 0 && (() => {
                    const hasSkuErrors = genCombos.some(c => c.isNew && Boolean(c.skuError));
                    const missingAxes = variantAxes.filter(ax => (genSelected[ax.id] ?? []).length === 0);
                    const allRegenerable = genCombos.filter(c => c.isNew).every(c => c.isRegeneratable);
                    const newCount = genCombos.filter(c => c.isNew).length;
                    return (
                      <div className="flex flex-col gap-2 pt-1">
                        {missingAxes.length > 0 && (
                          <p className="text-xs text-amber-500 flex items-center gap-1">
                            <AlertCircle size={11} className="shrink-0" />
                            {`Falta seleccionar valores para: ${missingAxes.map(a => a.definition.name).join(", ")}`}
                          </p>
                        )}
                        <div className="flex items-center justify-end">
                          <TPButton
                            iconLeft={<Sparkles size={13} />}
                            loading={genBusy}
                            disabled={hasSkuErrors || genBusy || missingAxes.length > 0}
                            onClick={() => void runGenerate()}
                          >
                            {allRegenerable
                              ? `Regenerar ${newCount} variante${newCount !== 1 ? "s" : ""}`
                              : `Crear ${newCount} variante${newCount !== 1 ? "s" : ""}`
                            }
                          </TPButton>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </TPCard>
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
        busy={busySave}
        onEnter={activeTab !== "variantes" ? handleSave : undefined}
        footer={
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
            {activeTab === "general"   && renderTabGeneral()}
            {activeTab === "costos"    && renderTabCostos()}
            {activeTab === "variantes" && renderTabVariantes()}
          </>
        )}
      </Modal>

      {/* Mini-modal de variante */}
      <Modal
        open={varModal}
        title={varEditId ? "Editar identificación de variante" : "Nueva variante"}
        onClose={() => setVarModal(false)}
        maxWidth={varEditId ? "sm" : "md"}
        busy={busyVar}
        onEnter={saveVariant}
        footer={
          <>
            <TPButton variant="secondary" iconLeft={<X size={14} />} onClick={() => setVarModal(false)} disabled={busyVar}>Cancelar</TPButton>
            <TPButton onClick={saveVariant} loading={busyVar} iconLeft={varEditId ? <Save size={14} /> : <Plus size={14} />}>{varEditId ? "Guardar" : "Crear"}</TPButton>
          </>
        }
      >
        {varEditId ? (
          /* ── Edición rápida: imagen + SKU + Nombre */
          <div className="space-y-3">
            {/* Galería de imágenes de la variante */}
            {articleId && (() => {
              const editingVariant = variants.find(v => v.id === varEditId);
              const varImages = editingVariant?.images ?? [];
              const mainImg = varImages.find(i => i.isMain) ?? varImages[0] ?? null;
              const mainSrc = mainImg?.url || editingVariant?.imageUrl || null;
              return (
                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted">Imágenes de variante</span>
                  <div className="flex gap-3 items-start">

                    {/* ── Imagen principal compacta 80×80 ── */}
                    <div className="flex flex-col gap-1 shrink-0">
                      <div className="relative group w-20 h-20 rounded-xl overflow-hidden border border-border bg-surface2">
                        {mainSrc ? (
                          <>
                            <img src={mainSrc} alt="" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                              <label className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[10px] font-medium cursor-pointer transition-colors">
                                <Camera size={11} />Cambiar
                                <input type="file" accept="image/*" hidden
                                  onChange={(e) => { const f = e.target.files?.[0] ?? null; e.currentTarget.value = ""; if (f) void handleVariantImageFile(f); }}
                                />
                              </label>
                              <button type="button"
                                onClick={() => void handleVariantImageRemove()}
                                disabled={busyVarImage}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/15 hover:bg-red-500/60 text-white text-[10px] font-medium transition-colors"
                              >
                                {busyVarImage ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                                Quitar
                              </button>
                            </div>
                            {busyVarImage && (
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
                                <Loader2 size={18} className="animate-spin text-white" />
                              </div>
                            )}
                          </>
                        ) : (
                          <label className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted hover:text-primary cursor-pointer transition-colors">
                            {busyVarImage
                              ? <Loader2 size={18} className="animate-spin" />
                              : <><Package size={22} className="opacity-50" /><span className="text-[10px]">Sin imagen</span></>
                            }
                            <input type="file" accept="image/*" hidden
                              onChange={(e) => { const f = e.target.files?.[0] ?? null; e.currentTarget.value = ""; if (f) void handleVariantImageFile(f); }}
                            />
                          </label>
                        )}
                      </div>

                      {/* Indicador de origen cuando no hay galería propia */}
                      {varImages.length === 0 && !!mainSrc && (
                        <span className="text-[10px] text-muted/70 italic leading-tight">imagen heredada</span>
                      )}
                    </div>

                    {/* ── Tira de miniaturas 36×36 ── */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex gap-1 flex-wrap" style={{ maxWidth: 160 }}>

                        {/* Todas las imágenes — principal con ring persistente */}
                        {varImages.map(img => (
                          <div
                            key={img.id}
                            onClick={() => { if (!img.isMain) void handleVariantSetMainImage(img.id); }}
                            className={cn(
                              "relative group w-9 h-9 rounded-lg overflow-hidden border-2 shrink-0 bg-surface2 transition-all",
                              img.isMain
                                ? "border-primary cursor-default"
                                : "border-border hover:border-primary/60 cursor-pointer"
                            )}
                          >
                            <img src={img.url} alt="" className="w-full h-full object-cover" />

                            {/* Badge principal persistente */}
                            {img.isMain && (
                              <div className="absolute top-0.5 left-0.5 bg-primary rounded-sm w-3 h-3 flex items-center justify-center">
                                <Check size={7} className="text-white" strokeWidth={3} />
                              </div>
                            )}

                            {/* Overlay hover */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-0.5">
                              {!img.isMain && (
                                <button type="button" title="Hacer principal"
                                  onClick={(e) => { e.stopPropagation(); void handleVariantSetMainImage(img.id); }}
                                  className="p-0.5 rounded text-white hover:text-primary"
                                ><Check size={10} /></button>
                              )}
                              <button type="button" title="Eliminar"
                                onClick={(e) => { e.stopPropagation(); void handleVariantImageRemoveById(img.id); }}
                                className="p-0.5 rounded text-white hover:text-red-400"
                              ><X size={10} /></button>
                            </div>
                          </div>
                        ))}

                        {/* Botón agregar (oculto al máximo) */}
                        {varImages.length < 5 && (
                          <label className="w-9 h-9 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted hover:text-primary hover:border-primary transition-colors cursor-pointer shrink-0" title="Agregar imagen">
                            {busyVarImage ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                            <input type="file" accept="image/*" hidden onChange={(e) => {
                              const f = e.target.files?.[0] ?? null;
                              e.currentTarget.value = "";
                              if (f) void handleVariantImageFile(f);
                            }} />
                          </label>
                        )}
                      </div>

                      {/* Contador y formato */}
                      <span className="text-[10px] text-muted">{varImages.length}/5 · PNG, JPG, WebP</span>
                    </div>
                  </div>
                </div>
              );
            })()}
            <TPField label="SKU" required>
              <TPInput
                value={varDraft.sku ?? ""}
                onChange={(v) => setVarDraft((p) => ({ ...p, sku: v }))}
                placeholder="SKU de la variante"
                data-tp-autofocus="1"
              />
            </TPField>
            <TPField label="Nombre" required>
              <TPInput
                value={varDraft.name ?? ""}
                onChange={(v) => setVarDraft((p) => ({ ...p, name: v }))}
                placeholder="Nombre de la variante"
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
          </div>
        ) : (
          /* ── Creación completa ─────────────────────────────────────────── */
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <TPField label="Nombre" required hint="Dejá vacío para usar el nombre automático desde los atributos">
                <TPInput
                  value={varDraft.name ?? ""}
                  onChange={(v) => setVarDraft((p) => ({ ...p, name: v }))}
                  placeholder="Automático desde atributos"
                  data-tp-autofocus="1"
                />
              </TPField>
              <TPField label="Código" required>
                <TPInput
                  value={varDraft.code}
                  onChange={(v) => setVarDraft((p) => ({ ...p, code: v }))}
                  placeholder="Código"
                />
              </TPField>
              <TPField label="SKU">
                <TPInput
                  value={varDraft.sku ?? ""}
                  onChange={(v) => setVarDraft((p) => ({ ...p, sku: v }))}
                  placeholder="SKU"
                />
              </TPField>
              <TPField label="Costo">
                <TPNumberInput
                  value={(varDraft as any).costPrice ?? null}
                  onChange={(v) => setVarDraft((p) => ({ ...p, costPrice: v }))}
                  placeholder="0.00"
                  min={0}
                />
              </TPField>
              <TPField label="Precio override">
                <TPNumberInput
                  value={(varDraft as any).priceOverride ?? null}
                  onChange={(v) => setVarDraft((p) => ({ ...p, priceOverride: v }))}
                  placeholder="0.00"
                  min={0}
                />
              </TPField>
              <TPField label="Peso override (g)">
                <TPNumberInput
                  value={(varDraft as any).weightOverride ?? null}
                  onChange={(v) => setVarDraft((p) => ({ ...p, weightOverride: v }))}
                  placeholder="0.0000"
                  min={0}
                />
              </TPField>
              <TPField label="Hechura override">
                <TPNumberInput
                  value={(varDraft as any).hechuraPriceOverride ?? null}
                  onChange={(v) => setVarDraft((p) => ({ ...p, hechuraPriceOverride: v }))}
                  placeholder="0.00"
                  min={0}
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
            </div>

            {/* Atributos de variante (ejes configurados en la categoría) */}
            {variantAxes.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 pt-1">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-semibold text-muted uppercase tracking-wide">Atributos de variante</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {variantAxes.map(axis => (
                    <TPField
                      key={axis.id}
                      label={axis.definition.name}
                      required={axis.isRequired}
                    >
                      {renderVariantAttrInput(axis)}
                    </TPField>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
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
