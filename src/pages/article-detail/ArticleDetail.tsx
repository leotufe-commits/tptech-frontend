// src/pages/article-detail/ArticleDetail.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Barcode,
  Calculator,
  DollarSign,
  Eye,
  Gem,
  Hash,
  Info,
  Layers,
  GripVertical,
  Loader2,
  MoreVertical,
  Pencil,
  Package,
  RefreshCw,
  ShieldBan,
  ShieldCheck,
  ScanBarcode,
  Settings2,
  ShoppingCart,
  Star,
  Store,
  Tag,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";

import { TPCard } from "../../components/ui/TPCard";
import { TPField } from "../../components/ui/TPField";
import TPInput from "../../components/ui/TPInput";
import TPTextarea from "../../components/ui/TPTextarea";
import TPComboFixed from "../../components/ui/TPComboFixed";
import TPNumberInput from "../../components/ui/TPNumberInput";
import { TPButton } from "../../components/ui/TPButton";
import { TPCheckbox } from "../../components/ui/TPCheckbox";
import { TPStatusPill } from "../../components/ui/TPStatusPill";
import { TPActiveBadge, TPBadge } from "../../components/ui/TPBadges";
import { TPActionsMenu } from "../../components/ui/TPActionsMenu";
import TPIconButton from "../../components/ui/TPIconButton";
import { TPInfoCard } from "../../components/ui/TPInfoCard";
import ConfirmDeleteDialog from "../../components/ui/ConfirmDeleteDialog";
import { cn } from "../../components/ui/tp";
import { toast } from "../../lib/toast";
import ArticleModal from "./ArticleModal";
import ArticleSearchSelect from "../../components/ui/ArticleSearchSelect";
import type { ArticleRow } from "../../services/articles";
import EditVariantModal from "./EditVariantModal";
import ViewVariantModal from "./ViewVariantModal";
import CostosTab from "./CostosTab";
import {
  articlesApi,
  type ArticleDetail as ArticleDetailType,
  type ArticleVariant,
  type ArticleAttributeValue,
  type ArticleImage,
  type ArticleStock,
  type ArticleStatus,
  type StockMode,
  type HechuraPriceMode,
  type ArticlePayload,
  type ArticleCommercialMode,
  type ComboAdjustmentKind,
  type PricingPreviewResult,
  ARTICLE_TYPE_LABELS,
  ARTICLE_TYPE_TONES,
  ARTICLE_STATUS_LABELS,
  ARTICLE_STATUS_COLORS,
  STOCK_MODE_LABELS,
  HECHURA_MODE_LABELS,
} from "../../services/articles";
import { categoriesApi, type CategoryRow } from "../../services/categories";
import { taxesApi, type TaxRow } from "../../services/taxes";
import { type SalePriceResult } from "../../services/sales";
import { promotionsApi, type PromotionRow } from "../../services/promotions";
import { quantityDiscountsApi, type QuantityDiscountRow } from "../../services/quantity-discounts";
import { priceListsApi, type PriceListRow } from "../../services/price-lists";
import { commercialEntitiesApi, type EntityRow } from "../../services/commercial-entities";
import { formatMoneyAmount as fmtMoney, formatDecimal } from "../../lib/pricing/format";

// ---------------------------------------------------------------------------
// Visual helpers
// ---------------------------------------------------------------------------

/** Par etiqueta/valor para secciones de detalle en TPCard */
function FactPair({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium text-muted uppercase tracking-wide leading-none mb-0.5">{label}</div>
      <div className={cn("text-sm text-text leading-snug", mono && "font-mono text-xs")}>
        {value ? value : <span className="text-muted/40 italic text-xs">—</span>}
      </div>
    </div>
  );
}

/** Separador de dropdown */
function DdSep() {
  return <div className="my-1 border-t border-border/60" />;
}

/** Item de dropdown de acciones */
function DdItem({
  icon, label, sublabel, onClick, danger, disabled,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors",
        disabled
          ? "opacity-40 cursor-default"
          : danger
          ? "text-red-600 hover:bg-red-50"
          : "text-text hover:bg-surface2 cursor-pointer",
      )}
    >
      <span className={cn("shrink-0", danger ? "text-red-500" : "text-muted")}>{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm leading-snug">{label}</span>
        {sublabel && <span className="block text-[11px] text-muted leading-tight">{sublabel}</span>}
      </span>
    </button>
  );
}

/** Menú de acciones del artículo (⋮) */
function ArticleActionsMenu({
  article,
  onEdit,
  onToggle,
  onDelete,
  onPrintLabels,
}: {
  article: ArticleDetailType;
  onEdit:        () => void;
  onToggle:      () => void;
  onDelete:      () => void;
  onPrintLabels: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onOut(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, [open]);

  function run(fn: () => void) { setOpen(false); fn(); }

  const isActive = article.status === "ACTIVE";

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center h-10 w-10 rounded-lg border border-border bg-card text-muted hover:bg-surface2 hover:text-text transition-colors"
        title="Más acciones"
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-60 rounded-xl border border-border bg-card shadow-lg z-50 py-1.5 overflow-hidden">
          <DdItem icon={<Tag       size={14} />} label="Imprimir etiquetas"   onClick={() => run(onPrintLabels)} />
          <DdSep />
          <DdItem icon={<Pencil   size={14} />} label="Editar artículo"      onClick={() => run(onEdit)} />
          <DdItem
            icon={isActive ? <ShieldBan size={14} /> : <ShieldCheck size={14} />}
            label={isActive ? "Desactivar artículo" : "Activar artículo"}
            onClick={() => run(onToggle)}
          />
          <DdItem icon={<Trash2   size={14} />} label="Eliminar artículo"    danger onClick={() => run(onDelete)} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Price source labels (mini card)
// ---------------------------------------------------------------------------
const PRICE_SOURCE_LABELS_MINI: Record<string, string> = {
  PROMOTION:         "Promoción activa",
  MANUAL_OVERRIDE:   "Precio fijo manual",
  QUANTITY_DISCOUNT: "Desc. por cantidad",
  PRICE_LIST:        "Lista de precios",
  MANUAL_FALLBACK:   "Precio de referencia",
  NONE:              "Sin precio definido",
};

// ---------------------------------------------------------------------------
// Draft
// ---------------------------------------------------------------------------
type ComboComponentDraft = {
  /** ID del artículo componente (debe ser articleType=PRODUCT activo). */
  articleId: string;
  /** Snapshot de presentación — solo para mostrar en UI sin re-fetchear. */
  code: string;
  name: string;
  /** Cantidad por unidad de combo. Debe ser > 0. */
  quantity: number;
  /** Snapshot de precio unitario del componente al momento de agregarlo.
   *  Usado SOLO para preview en vivo en el editor; el cálculo real lo hace el motor en backend. */
  unitPrice: number | null;
  /** Snapshot de stock total del componente al agregarlo (UI hint). */
  stock: number | null;
};

type Draft = {
  name: string;
  code: string;
  description: string;
  categoryId: string | null;
  status: ArticleStatus;
  stockMode: StockMode;
  hechuraPriceMode: HechuraPriceMode;
  hechuraPrice: number | null;
  mermaPercent: number | null;
  notes: string;
  salePrice: number | null;
  useManualSalePrice: boolean;
  // ── Combo comercial ─────────────────────────────────────────────────────
  commercialMode: ArticleCommercialMode;
  comboAdjustmentKind: ComboAdjustmentKind;
  comboAdjustmentValue: number | null;
  comboComponents: ComboComponentDraft[];
};

function articleToDraft(a: ArticleDetailType): Draft {
  // Reconstruir componentes combo desde costComposition (líneas tipo PRODUCT con catalogItemId).
  // Solo aplica cuando el artículo es combo; en NORMAL queda como [].
  const comboComponents: ComboComponentDraft[] =
    (a.commercialMode === "COMBO_COMMERCIAL" && Array.isArray(a.costComposition))
      ? a.costComposition
          .filter((l: any) => (l.type === "PRODUCT" || l.type === "SERVICE") && l.catalogItemId)
          .map((l: any) => ({
            articleId: l.catalogItemId,
            code: l.catalogItem?.code ?? "",
            name: l.catalogItem?.name ?? l.label ?? "",
            quantity: parseFloat(String(l.quantity ?? 1)) || 1,
            // Cuando se carga un combo existente, no tenemos snapshot de precio/stock del componente.
            // El preview en vivo solo aplica para componentes recién agregados en esta sesión.
            unitPrice: null,
            stock: null,
          }))
      : [];

  return {
    name: a.name,
    code: a.code,
    description: a.description ?? "",
    categoryId: a.categoryId,
    status: a.status,
    stockMode: a.stockMode,
    hechuraPriceMode: a.hechuraPriceMode,
    hechuraPrice: a.hechuraPrice != null ? parseFloat(a.hechuraPrice) : null,
    mermaPercent: a.mermaPercent != null ? parseFloat(a.mermaPercent) : null,
    notes: (a as any).notes ?? "",
    salePrice: a.salePrice != null ? parseFloat(a.salePrice) : null,
    useManualSalePrice: (a as any).useManualSalePrice ?? false,
    commercialMode:       a.commercialMode ?? "NORMAL",
    comboAdjustmentKind:  a.comboAdjustmentKind ?? "NONE",
    comboAdjustmentValue: a.comboAdjustmentValue != null ? parseFloat(String(a.comboAdjustmentValue)) : null,
    comboComponents,
  };
}

const EMPTY_DRAFT: Draft = {
  name: "",
  code: "",
  description: "",
  categoryId: null,
  status: "DRAFT",
  stockMode: "NO_STOCK",
  hechuraPriceMode: "FIXED",
  hechuraPrice: null,
  mermaPercent: null,
  notes: "",
  salePrice: null,
  useManualSalePrice: false,
  commercialMode:       "NORMAL",
  comboAdjustmentKind:  "NONE",
  comboAdjustmentValue: null,
  comboComponents:      [],
};

function draftToPayload(d: Draft): ArticlePayload {
  const isCombo = d.commercialMode === "COMBO_COMMERCIAL";

  // En combo: el backend fuerza stockMode=NO_STOCK, sellWithoutVariants=true,
  // useManualSalePrice=false. Acá enviamos lo coherente para evitar 400.
  // Componentes combo se mapean a costComposition con type=PRODUCT y affectsStock=true
  // (el backend igual lo fuerza, pero lo enviamos consistente).
  const costComposition = isCombo
    ? d.comboComponents
        .filter(c => c.articleId && c.quantity > 0)
        .map((c, idx) => ({
          type: "PRODUCT" as const,
          label: c.name || c.code || "",
          quantity: c.quantity,
          quantityUnit: "unidad",
          unitValue: 0,                  // el costo del componente lo resuelve el motor
          currencyId: null,
          mermaPercent: null,
          metalVariantId: null,
          catalogItemId: c.articleId,
          affectsStock: true,
          sortOrder: idx,
          lineAdjKind: "",
          lineAdjType: "",
          lineAdjValue: null,
        }))
    : undefined;

  return {
    name: d.name.trim(),
    code: d.code.trim() || undefined,
    description: d.description.trim() || undefined,
    categoryId: d.categoryId || null,
    status: d.status,
    stockMode: isCombo ? "NO_STOCK" : d.stockMode,
    hechuraPriceMode: d.hechuraPriceMode,
    hechuraPrice: d.hechuraPrice,
    mermaPercent: d.mermaPercent,
    notes: d.notes.trim() || undefined,
    salePrice: isCombo ? null : d.salePrice,
    useManualSalePrice: isCombo ? false : d.useManualSalePrice,
    sellWithoutVariants: isCombo ? true : undefined,
    commercialMode:       d.commercialMode,
    comboAdjustmentKind:  d.comboAdjustmentKind,
    comboAdjustmentValue: isCombo && d.comboAdjustmentKind !== "NONE" ? d.comboAdjustmentValue : null,
    ...(costComposition !== undefined ? { costComposition } as any : {}),
  };
}

// ---------------------------------------------------------------------------
// ComboInfoBlock — sección de detalle (modo lectura) para combos.
// Muestra: aviso de stock dependiente, lista de componentes con stock individual,
// disponibilidad calculada del combo y la regla de precio aplicada.
// Carga la disponibilidad desde el backend (endpoint /combo-availability).
// ---------------------------------------------------------------------------
function ComboInfoBlock({ article }: { article: ArticleDetailType }) {
  const [data, setData] = useState<{
    available: number;
    isCombo: boolean;
    bottleneckArticleId: string | null;
    components: Array<{
      articleId: string; code: string; name: string;
      qtyPerCombo: number; stock: number; canMake: number;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    articlesApi.comboAvailability(article.id)
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setData(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [article.id]);

  const adjLabel: Record<string, string> = {
    NONE: "Suma directa (sin ajuste)",
    DISCOUNT_PERCENT: "Descuento %",
    DISCOUNT_FIXED: "Descuento fijo",
    SURCHARGE_PERCENT: "Recargo %",
  };
  const adjKind = article.comboAdjustmentKind ?? "NONE";
  const adjVal  = article.comboAdjustmentValue;
  const adjText = adjKind === "NONE"
    ? adjLabel.NONE
    : `${adjLabel[adjKind]}: ${adjVal ?? "—"}${adjKind.includes("PERCENT") ? "%" : ""}`;

  return (
    <div className="rounded-xl bg-surface2/40 border border-border/40 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package size={13} className="text-muted shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Combo comercial</span>
        </div>
        {!loading && data?.isCombo && (
          <TPBadge tone={data.available > 0 ? "success" : "danger"} size="sm">
            {data.available} disponible{data.available === 1 ? "" : "s"}
          </TPBadge>
        )}
      </div>

      {/* Aviso de stock dependiente — mismo wording que el editor */}
      <div className="rounded-md border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300">
        <strong>Sin stock propio.</strong> La disponibilidad sale del stock de los componentes.
      </div>

      {/* Componentes con stock */}
      <div className="border-t border-border/30 pt-3">
        <div className="text-[10px] font-medium text-muted uppercase tracking-wide mb-2">
          Componentes
        </div>
        {loading && (
          <div className="text-xs text-muted/60 italic">Cargando disponibilidad…</div>
        )}
        {!loading && data && data.components.length > 0 && (
          <div className="space-y-1.5">
            {data.components.map((c) => {
              const isBottleneck = c.articleId === data.bottleneckArticleId;
              return (
                <div
                  key={c.articleId}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md border px-2 py-1.5",
                    isBottleneck
                      ? "border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/10"
                      : "border-border/40 bg-card",
                  )}
                  title={isBottleneck ? "Este componente limita la disponibilidad del combo" : undefined}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-text truncate">{c.name}</div>
                    <div className="text-[10px] text-muted/70 font-mono tabular-nums">
                      {c.code} · {c.qtyPerCombo} por combo
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs tabular-nums font-semibold text-text">{c.stock} en stock</div>
                    <div className="text-[10px] text-muted/70 tabular-nums">
                      alcanza para {c.canMake}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!loading && (!data || data.components.length === 0) && (
          <div className="text-xs text-muted/60 italic">Sin componentes con stock que descuente.</div>
        )}
      </div>

      {/* Regla de precio aplicada */}
      <div className="border-t border-border/30 pt-3">
        <div className="text-[10px] font-medium text-muted uppercase tracking-wide mb-1">
          Regla de precio
        </div>
        <div className="text-xs text-text">{adjText}</div>
        <div className="text-[10px] text-muted/70 mt-0.5">
          El precio se calcula sumando los componentes y aplicando este ajuste.
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export default function ArticleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  /** variantId pasado por query param desde la tabla de artículos (Ver variante). */
  const focusVariantId = searchParams.get("variantId");
  const createMode = id === "nuevo";

  // ---- Article state ----
  const [article, setArticle] = useState<ArticleDetailType | null>(null);
  const [loading, setLoading]   = useState(!createMode);
  const [notFound, setNotFound] = useState(false);

  // ---- Panel expandido (solo uno a la vez) ----
  type ExpandedPanel = "variants" | "costos" | "ventas" | null;
  const [expandedPanel, setExpandedPanel] = useState<ExpandedPanel>(null);
  function togglePanel(p: ExpandedPanel) {
    setExpandedPanel(prev => prev === p ? null : p);
  }
  const variantsExpanded  = expandedPanel === "variants";
  const costDetailOpen    = expandedPanel === "costos";
  const ventasDetailOpen  = expandedPanel === "ventas";

  // ---- Edit modal ----
  const [editModalOpen, setEditModalOpen] = useState(false);

  // ---- Article-level actions ----
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [busyDeleteArt,     setBusyDeleteArt]     = useState(false);
  const [busyToggleArt,     setBusyToggleArt]     = useState(false);
  const [labelPrintOpen,    setLabelPrintOpen]    = useState(false);

  // ---- Visibilidad pestaña Variantes ----
  // null = cargando (tab visible por defecto), false = sin ejes, true = tiene ejes
  const [categoryHasVariantAxes, setCategoryHasVariantAxes] = useState<boolean | null>(null);

  // ---- Lazy tab data ----
  const [variants, setVariants]               = useState<ArticleVariant[]>([]);
  const [variantsLoaded, setVariantsLoaded]   = useState(false);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [dragIdx, setDragIdx]                 = useState<number | null>(null);
  const [overIdx, setOverIdx]                 = useState<number | null>(null);

  const [attributes, setAttributes]               = useState<ArticleAttributeValue[]>([]);
  const [attributesLoaded, setAttributesLoaded]   = useState(false);
  const [attributesLoading, setAttributesLoading] = useState(false);

  const [images, setImages]               = useState<ArticleImage[]>([]);
  const [lightboxIdx, setLightboxIdx]     = useState<number | null>(null);
  const [imagesLoaded, setImagesLoaded]   = useState(false);
  const [imagesLoading, setImagesLoading] = useState(false);

  const [stock, setStock]               = useState<ArticleStock[]>([]);
  const [stockLoaded, setStockLoaded]   = useState(false);
  const [stockLoading, setStockLoading] = useState(false);

  // ---- Ventas / Precio de venta ----
  const [salePriceResolution, setSalePriceResolution] = useState<SalePriceResult | null>(null);
  const [pricingPreview,      setPricingPreview]      = useState<PricingPreviewResult | null>(null);
  const [loadingSalePrice,    setLoadingSalePrice]    = useState(false);
  const [simQty,            setSimQty]           = useState<number>(1);
  const [simClientId,       setSimClientId]      = useState<string>("");
  const [simClients,        setSimClients]       = useState<EntityRow[]>([]);
  const [loadingSimClients, setLoadingSimClients] = useState(false);
  const [articlePromos,    setArticlePromos]    = useState<PromotionRow[]>([]);
  const [articleDiscounts, setArticleDiscounts] = useState<QuantityDiscountRow[]>([]);
  const [priceLists,       setPriceLists]       = useState<PriceListRow[]>([]);
  const [simPriceListId,   setSimPriceListId]   = useState<string>("");
  const [ventasLoaded,     setVentasLoaded]     = useState(false);
  const [taxesLoaded,      setTaxesLoaded]      = useState(false);
  const [taxes,            setTaxes]            = useState<TaxRow[]>([]);

  // ---- Pickers ----
  const [categories, setCategories] = useState<CategoryRow[]>([]);

  // ---- Edit form ----
  const [editing, setEditing] = useState(createMode);
  const [draft, setDraft]     = useState<Draft | null>(createMode ? { ...EMPTY_DRAFT } : null);
  const [submitted, setSubmitted] = useState(false);
  const [busySave, setBusySave]   = useState(false);

  // ---- Variant modal ----
  const [varModal, setVarModal]     = useState(false);
  const [varEditId, setVarEditId]   = useState<string | null>(null);
  const [viewVarId, setViewVarId]   = useState<string | null>(null);
  const [removingVar, setRemovingVar] = useState<string | null>(null);
  const [confirmDeleteVarId, setConfirmDeleteVarId] = useState<string | null>(null);

  // ---- Debounce para simulación de precio ----
  const simQtyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Refresh silencioso de costos ----
  const [refreshingCostos, setRefreshingCostos] = useState(false);

  // ---- Image upload ----
  const imgInputRef = useRef<HTMLInputElement>(null);
  const [busyImg, setBusyImg]           = useState(false);
  const [removingImg, setRemovingImg]   = useState<string | null>(null);

  // ---- Stock adjust modal ----
  const [stockModal, setStockModal]       = useState(false);
  const [stockWarehouseId, setStockWarehouseId] = useState("");
  const [stockVariantId, setStockVariantId]     = useState<string | null>(null);
  const [stockQty, setStockQty]               = useState<number | null>(null);
  const [busyStock, setBusyStock]             = useState(false);

  /* ==============================================================
     LOAD
  ============================================================== */
  useEffect(() => {
    void loadCategories();
    if (createMode) return;
    if (!id) { setNotFound(true); setLoading(false); return; }
    void fetchArticle();
  }, [id]);

  // Recargar cuando el costo de ESTE artículo cambia (guardado desde ArticleModal)
  useEffect(() => {
    if (!id || createMode) return;
    function onArticleCostChanged(e: Event) {
      const detail = (e as CustomEvent<{ articleId: string }>).detail;
      if (detail?.articleId && detail.articleId !== id) return;
      void fetchArticle();
    }
    window.addEventListener("tptech:article-cost-changed", onArticleCostChanged);
    return () => window.removeEventListener("tptech:article-cost-changed", onArticleCostChanged);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, createMode]);

  // Scroll + highlight de variante cuando se llega desde "Ver variante" en la tabla
  useEffect(() => {
    if (!focusVariantId || !variantsLoaded) return;
    // Pequeño delay para que el DOM se renderice con el panel expandido
    const t = setTimeout(() => {
      const el = document.getElementById(`variant-${focusVariantId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => clearTimeout(t);
  }, [focusVariantId, variantsLoaded]);

  async function fetchArticle() {
    setLoading(true);
    try {
      const data = await articlesApi.getOne(id!);
      setArticle(data);
      setDraft(articleToDraft(data));
      // pre-populate tab data from detail
      setVariants((() => {
        if (!id) return data.variants;
        try {
          const saved = localStorage.getItem(`tptech_variant_order_${id}`);
          if (!saved) return data.variants;
          const order: string[] = JSON.parse(saved);
          const im = new Map(order.map((x, i) => [x, i] as [string, number]));
          return [...data.variants].sort((a, b) => (im.get(a.id) ?? 999) - (im.get(b.id) ?? 999));
        } catch { return data.variants; }
      })());
      setVariantsLoaded(true);
      if (data.variants.length > 0) setExpandedPanel("variants");
      setAttributes(data.attributeValues);
      setAttributesLoaded(true);
      setImages(data.images);
      setImagesLoaded(true);
      // Determinar si la categoría tiene ejes de variante
      setCategoryHasVariantAxes(null);
      if (data.categoryId) {
        void loadCategoryAxes(data.categoryId);
      } else {
        setCategoryHasVariantAxes(false);
      }
      // Auto-cargar datos adicionales sin esperar
      void loadVentasData();
      if (data.stockMode === "BY_ARTICLE") {
        setStockLoading(true);
        articlesApi.stock.get(id!)
          .then(s => { setStock(s); setStockLoaded(true); })
          .catch(() => {})
          .finally(() => setStockLoading(false));
      }
    } catch (e: any) {
      if (e?.status === 404) setNotFound(true);
      else toast.error(e?.message || "Error al cargar artículo.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try { setCategories(await categoriesApi.list()); } catch {}
  }

  async function loadCategoryAxes(categoryId: string) {
    try {
      const attrs = await categoriesApi.attributes.getEffective(categoryId);
      setCategoryHasVariantAxes(attrs.some(a => a.isVariantAxis));
    } catch {
      setCategoryHasVariantAxes(false);
    }
  }

  /* (tab change eliminado — datos se cargan automáticamente en fetchArticle) */

  async function loadVentasData() {
    if (!id) return;
    setVentasLoaded(true);
    await Promise.all([
      loadSalePrice(id),
      loadArticleRules(id),
      loadTaxes(),
      priceListsApi.list().then(list => setPriceLists(list.filter(l => !l.deletedAt))).catch(() => {}),
    ]);
  }

  async function loadSalePrice(articleId: string, qty = 1, clientId?: string) {
    setLoadingSalePrice(true);
    try {
      const res = await articlesApi.getPricingPreview(articleId, { quantity: qty, clientId: clientId || null });
      setPricingPreview(res);
    } catch {}
    finally { setLoadingSalePrice(false); }
  }

  async function loadSimClients() {
    if (loadingSimClients) return;
    setLoadingSimClients(true);
    try {
      const res = await commercialEntitiesApi.list({ role: "client", take: 300 });
      setSimClients(res.rows);
    } catch {}
    finally { setLoadingSimClients(false); }
  }

  async function loadArticleRules(articleId: string) {
    try {
      const [promos, discounts] = await Promise.all([
        promotionsApi.list({ active: true, take: 50 }).catch(() => ({ data: [] as PromotionRow[] })),
        quantityDiscountsApi.list({ articleId }).catch(() => ({ data: [] as QuantityDiscountRow[] })),
      ]);
      setArticlePromos(promos.data.filter(p => p.scope === "ALL" || p.articles.some(a => a.articleId === articleId)));
      setArticleDiscounts(discounts.data);
    } catch {}
  }

  async function loadTaxes() {
    try {
      const list = await taxesApi.list();
      setTaxes(list.filter(t => t.isActive && !t.deletedAt));
      setTaxesLoaded(true);
    } catch {}
  }

  /** Re-fetch del artículo sin mostrar el spinner global — usado en Costos y tras saves. */
  async function refreshCostData() {
    if (!id) return;
    setRefreshingCostos(true);
    try {
      const data = await articlesApi.getOne(id);
      setArticle(data);
      setDraft(articleToDraft(data));
      setVariants((() => {
        if (!id) return data.variants;
        try {
          const saved = localStorage.getItem(`tptech_variant_order_${id}`);
          if (!saved) return data.variants;
          const order: string[] = JSON.parse(saved);
          const im = new Map(order.map((x, i) => [x, i] as [string, number]));
          return [...data.variants].sort((a, b) => (im.get(a.id) ?? 999) - (im.get(b.id) ?? 999));
        } catch { return data.variants; }
      })());
      setImages(data.images);
    } catch {}
    finally { setRefreshingCostos(false); }
  }

  /* ==============================================================
     SAVE GENERAL
  ============================================================== */
  async function handleSave() {
    if (!draft) return;
    setSubmitted(true);
    if (!draft.name.trim()) return;

    // Validación local de combo: requiere al menos un componente.
    // Mejora UX: catchea el error antes de pegarle al backend.
    if (draft.commercialMode === "COMBO_COMMERCIAL" && draft.comboComponents.length === 0) {
      toast.error("Un combo comercial debe tener al menos un componente.");
      return;
    }
    if (
      draft.commercialMode === "COMBO_COMMERCIAL" &&
      draft.comboAdjustmentKind !== "NONE" &&
      (draft.comboAdjustmentValue == null || draft.comboAdjustmentValue < 0)
    ) {
      toast.error("Indicá un valor válido para el ajuste del combo.");
      return;
    }

    setBusySave(true);
    try {
      const payload = draftToPayload(draft);
      if (createMode) {
        const created = await articlesApi.create(payload);
        toast.success("Artículo creado.");
        navigate(`/articulos/${created.id}`, { replace: true });
      } else {
        const updated = await articlesApi.update(id!, payload);
        setArticle(updated);
        setDraft(articleToDraft(updated));
        setEditing(false);
        toast.success("Cambios guardados.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar.");
    } finally {
      setBusySave(false);
    }
  }

  /* ==============================================================
     VARIANTS
  ============================================================== */
  const variantStockMap = useMemo(() =>
    stock.reduce((acc, s) => {
      if (s.variantId) acc[s.variantId] = (acc[s.variantId] ?? 0) + Number(s.quantity);
      return acc;
    }, {} as Record<string, number>),
    [stock]
  );

  function openEditVariant(v: ArticleVariant) {
    setVarEditId(v.id);
    setVarModal(true);
  }

  async function toggleVariant(v: ArticleVariant) {
    if (!id) return;
    try {
      const updated = await articlesApi.variants.toggle(id, v.id);
      setVariants((prev) => prev.map((x) => (x.id === v.id ? updated : x)));
    } catch (e: any) {
      toast.error(e?.message || "Error.");
    }
  }

  async function removeVariant(variantId: string) {
    if (!id) return;
    setRemovingVar(variantId);
    try {
      await articlesApi.variants.remove(id, variantId);
      setVariants((prev) => prev.filter((v) => v.id !== variantId));
      toast.success("Variante eliminada.");
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar variante.");
    } finally {
      setRemovingVar(null);
    }
  }

  /* ==============================================================
     IMAGES
  ============================================================== */
  async function handleImageUpload(file: File) {
    if (!id) return;
    setBusyImg(true);
    try {
      const img = await articlesApi.images.upload(id, file, undefined, images.length === 0);
      setImages((prev) => [...prev, img]);
      toast.success("Imagen subida.");
    } catch (e: any) {
      toast.error(e?.message || "Error al subir imagen.");
    } finally {
      setBusyImg(false);
    }
  }

  async function setMainImage(imageId: string) {
    if (!id) return;
    try {
      await articlesApi.images.setMain(id, imageId);
      setImages((prev) => prev.map((img) => ({ ...img, isMain: img.id === imageId })));
    } catch (e: any) {
      toast.error(e?.message || "Error.");
    }
  }

  async function removeImage(imageId: string) {
    if (!id) return;
    setRemovingImg(imageId);
    try {
      await articlesApi.images.remove(id, imageId);
      setImages((prev) => prev.filter((img) => img.id !== imageId));
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar imagen.");
    } finally {
      setRemovingImg(null);
    }
  }

  /* ==============================================================
     STOCK ADJUST
  ============================================================== */
  async function handleStockAdjust() {
    if (!id || !stockWarehouseId || stockQty == null) return;
    setBusyStock(true);
    try {
      await articlesApi.stock.adjust(id, {
        warehouseId: stockWarehouseId,
        variantId: stockVariantId || null,
        quantity: stockQty,
      });
      setStock(await articlesApi.stock.get(id));
      setStockModal(false);
      toast.success("Stock ajustado.");
    } catch (e: any) {
      toast.error(e?.message || "Error al ajustar stock.");
    } finally {
      setBusyStock(false);
    }
  }

  /* ==============================================================
     ARTICLE-LEVEL ACTIONS
  ============================================================== */
  async function handleArticleToggle() {
    if (!id || !article) return;
    setBusyToggleArt(true);
    try {
      await articlesApi.toggle(id);
      const updated = await articlesApi.getOne(id);
      setArticle(updated);
      setDraft(articleToDraft(updated));
      toast.success(updated.status === "ACTIVE" ? "Artículo activado." : "Artículo desactivado.");
    } catch (e: any) {
      toast.error(e?.message || "Error.");
    } finally {
      setBusyToggleArt(false);
    }
  }

  async function handleArticleDelete() {
    if (!id) return;
    setBusyDeleteArt(true);
    try {
      await articlesApi.remove(id);
      toast.success("Artículo eliminado.");
      navigate(-1);
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar.");
    } finally {
      setBusyDeleteArt(false);
    }
  }

  /* ==============================================================
     RENDER HELPERS
  ============================================================== */
  if (loading) {
    return (
      <div className="p-8 text-sm text-muted">Cargando artículo…</div>
    );
  }

  if (notFound) {
    return (
      <div className="p-8 text-sm text-muted">Artículo no encontrado.</div>
    );
  }

  const categoryOptions = categories
    .filter((c) => c.isActive)
    .map((c) => ({ label: c.name, value: c.id }));

  const statusOptions = (Object.keys(ARTICLE_STATUS_LABELS) as ArticleStatus[]).map((k) => ({
    label: ARTICLE_STATUS_LABELS[k],
    value: k,
  }));

  const stockModeOptions = (Object.keys(STOCK_MODE_LABELS) as StockMode[]).map((k) => ({
    label: STOCK_MODE_LABELS[k],
    value: k,
  }));

  const hechuraModeOptions = (Object.keys(HECHURA_MODE_LABELS) as HechuraPriceMode[]).map((k) => ({
    label: HECHURA_MODE_LABELS[k],
    value: k,
  }));

  return (
    <div className="w-full">

      {/* ══════════════════════════════════════════════════════════
          HEADER — estilo EntityDetail
      ══════════════════════════════════════════════════════════ */}
      <div className="border-b border-border bg-card pt-4 pb-0">
        <div className="w-full">

          {/* Fila principal: [imagen + identidad] | [acciones] */}
          <div className="flex items-start justify-between gap-4">

            {/* ── Izquierda: imagen + datos ── */}
            <div className="flex items-start gap-4 min-w-0">

              {/* Imagen principal */}
              {!createMode && (
                <div className="shrink-0 mt-0.5">
                  {(() => {
                    const mainImg = images.find((i) => i.isMain) ?? images[0];
                    const mainIdx = mainImg ? images.indexOf(mainImg) : -1;
                    return (
                      <div
                        className={cn("h-20 w-20 rounded-xl overflow-hidden border border-border bg-surface2 flex items-center justify-center", mainImg && "cursor-zoom-in hover:opacity-90 transition-opacity")}
                        onClick={() => mainImg && setLightboxIdx(mainIdx)}
                      >
                        {mainImg
                          ? <img src={mainImg.url} alt={article?.name} className="w-full h-full object-cover" />
                          : <Package size={24} className="text-muted/30" />}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Datos de identidad */}
              <div className="min-w-0 space-y-1.5 pt-0.5">
                {createMode ? (
                  <h1 className="text-2xl font-bold text-text leading-tight">Nuevo artículo</h1>
                ) : article ? (
                  <>
                    {/* Nombre + activo/inactivo */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h1 className="text-2xl font-bold text-text leading-tight">{article.name}</h1>
                      <TPStatusPill active={article.status === "ACTIVE"} />
                      {article.isFavorite && <Star size={14} className="fill-yellow-400 text-yellow-400 shrink-0" />}
                    </div>

                    {/* Badges: tipo + combo (si aplica) + variantes + categoría */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <TPBadge tone={ARTICLE_TYPE_TONES[article.articleType]}>
                        {ARTICLE_TYPE_LABELS[article.articleType]}
                      </TPBadge>
                      {article.commercialMode === "COMBO_COMMERCIAL" && (
                        <TPBadge tone="info" className="gap-1" title="Combo comercial: precio y stock dependen de los componentes">
                          <Package size={11} />
                          COMBO
                        </TPBadge>
                      )}
                      {variants.length > 0 && (
                        <span className="inline-flex items-center rounded-md border border-purple-400/30 bg-purple-500/10 px-2 py-0.5 text-[11px] font-semibold text-purple-600">
                          Con variantes
                        </span>
                      )}
                      {article.category && (
                        <span className="inline-flex items-center rounded-md border border-border/60 bg-surface2 px-2 py-0.5 text-[11px] font-medium text-muted">
                          {article.category.name}
                        </span>
                      )}
                      {article.group && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          <Layers size={10} />
                          {article.group.name}
                        </span>
                      )}
                      {article.brand && (
                        <span className="inline-flex items-center rounded-md border border-border/60 bg-surface2 px-2 py-0.5 text-[11px] font-medium text-muted">
                          {article.brand}
                        </span>
                      )}
                    </div>

                    {/* Metadata rápida: código · SKU · precio */}
                    <div className="flex items-center gap-3.5 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-muted font-mono">
                        <Hash size={11} className="shrink-0 text-muted/60" />{article.code}
                      </span>
                      {article.sku && (
                        <span className="flex items-center gap-1 text-xs text-muted">
                          <Tag size={11} className="shrink-0 text-muted/60" />SKU: {article.sku}
                        </span>
                      )}
                      {article.salePrice && (
                        <span className="flex items-center gap-1 text-sm font-semibold text-text">
                          <DollarSign size={13} className="shrink-0 text-primary" />{fmtMoney(article.salePrice)}
                        </span>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            {/* ── Derecha: acciones ── */}
            <div className="flex items-center gap-2 shrink-0 pt-0.5">
              {!createMode && article ? (
                <>
                  <TPButton variant="secondary" onClick={() => navigate(`/herramientas/simulador-precios?articleId=${id}`)} iconLeft={<Calculator size={14} />}>
                    Simulador
                  </TPButton>
                  <TPButton variant="secondary" onClick={() => navigate(-1)} iconLeft={<ArrowLeft size={14} />}>
                    Volver
                  </TPButton>
                  <TPButton variant="primary" onClick={() => setEditModalOpen(true)} iconLeft={<Pencil size={14} />}>
                    Editar
                  </TPButton>
                  <ArticleActionsMenu
                    article={article}
                    onEdit={() => setEditModalOpen(true)}
                    onToggle={handleArticleToggle}
                    onDelete={() => setConfirmDeleteOpen(true)}
                    onPrintLabels={() => setLabelPrintOpen(true)}
                  />
                </>
              ) : (
                <TPButton variant="secondary" onClick={() => navigate(-1)} iconLeft={<ArrowLeft size={14} />}>
                  Volver
                </TPButton>
              )}
            </div>
          </div>


        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          CONTENIDO DE TABS
      ══════════════════════════════════════════════════════════ */}
      <div className="space-y-4 py-4">

      {/* ============================
          TAB: GENERAL
      ============================ */}
      {(!createMode || createMode) && (
        <div className="space-y-4">

          {/* ── Vista modo existente ── */}
          {!createMode && article && (() => {
            const baseSym     = (article as any).baseCurrency?.symbol ?? "$";
            const costReg     = article.costPrice != null ? parseFloat(String(article.costPrice)) : null;
            const costActual  = (article as any).computedCostPrice?.value != null ? parseFloat(String((article as any).computedCostPrice.value)) : null;
            const costDiff    = costReg != null && costActual != null ? costActual - costReg : null;
            const costVarPct  = costDiff != null && costReg != null && costReg !== 0 ? (costDiff / costReg * 100) : null;
            const stockTotal  = stock.reduce((acc, r) => acc + parseFloat(r.quantity ?? "0"), 0);
            const spPrice     = pricingPreview?.unitPrice != null ? parseFloat(pricingPreview.unitPrice) : null;
            const MAX_IMAGES  = 5;
            const costWithTax = (article as any).computedCostWithTax != null ? parseFloat(String((article as any).computedCostWithTax)) : null;
            const taxDetails  = ((article as any).taxDetails ?? []) as Array<{ id: string; name: string; rate: string | null; fixedAmount: string | null; calculationType: string }>;
            const metalCost   = (article as any).computedCostPrice?.metalCost   != null ? parseFloat(String((article as any).computedCostPrice.metalCost))   : null;
            const hechuraCost = (article as any).computedCostPrice?.hechuraCost != null ? parseFloat(String((article as any).computedCostPrice.hechuraCost)) : null;
            const costMode    = (article as any).costCalculationMode as string | undefined;
            const margin      = spPrice != null && costActual != null && spPrice > 0
              ? ((spPrice - costActual) / spPrice * 100)
              : null;
            function fmtN(n: number) {
              return formatDecimal(n, 2);
            }

            return (
              <>

                {/* ── KPI comercial ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 border-b border-border pb-4">

                  {/* Stock */}
                  <div className="rounded-xl border border-border/50 bg-card px-4 py-3 space-y-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Stock</div>
                    {article.stockMode !== "BY_ARTICLE"
                      ? <div className="text-sm text-muted">{STOCK_MODE_LABELS[article.stockMode]}</div>
                      : stockLoading
                        ? <Loader2 size={16} className="animate-spin text-muted" />
                        : <>
                            <div className={cn("text-xl font-bold tabular-nums", stockTotal > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500")}>
                              {stockTotal} u.
                            </div>
                            <div className={cn("text-[11px]", stockTotal > 0 ? "text-emerald-600/70" : "text-red-500/70")}>
                              {stockTotal > 0 ? "En stock" : "Sin stock"}
                            </div>
                          </>}
                  </div>

                  {/* ── Card COSTO ── */}
                  {(() => {
                    // Usa directamente los valores del backend — sin recálculo manual
                    const hasCostTax = costWithTax != null && costActual != null && costWithTax - costActual > 0.005;
                    const heroValue  = hasCostTax ? costWithTax : costActual;
                    const heroLabel  = hasCostTax ? "Total costo" : "Costo";
                    const taxAmt     = hasCostTax && costWithTax != null && costActual != null
                      ? costWithTax - costActual : 0;
                    return (
                      <div className="rounded-xl border border-border/50 bg-card px-4 py-3 space-y-1">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{heroLabel}</div>
                        {heroValue != null
                          ? <div className="text-xl font-bold tabular-nums text-text">{baseSym} {fmtN(heroValue)}</div>
                          : <div className="text-sm text-muted/50 italic">Sin calcular</div>}
                        {hasCostTax && costActual != null && (
                          <div className="text-[11px] text-muted tabular-nums">
                            Base: {baseSym} {fmtN(costActual)}{" · "}imp.: +{baseSym} {fmtN(taxAmt)}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Margen */}
                  <div className="rounded-xl border border-border/50 bg-card px-4 py-3 space-y-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Margen</div>
                    {margin != null
                      ? <>
                          <div className={cn("text-xl font-bold tabular-nums", margin >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500")}>
                            {margin >= 0 ? "+" : ""}{fmtN(margin)}%
                          </div>
                          <div className="text-[11px] text-muted">sobre precio sin impuestos</div>
                        </>
                      : <div className="text-sm text-muted/50 italic">Sin datos</div>}
                  </div>

                  {/* ── Card PRECIO / TOTAL FINAL ── */}
                  {(() => {
                    const taxExempt    = pricingPreview?.taxExemptByEntity === true;
                    const totalWithTax = pricingPreview?.totalWithTax != null
                      ? parseFloat(pricingPreview.totalWithTax) : null;
                    // Hay impuesto si totalWithTax supera a unitPrice en más de medio centavo
                    const hasSaleTax   = !taxExempt
                      && totalWithTax != null
                      && spPrice != null
                      && totalWithTax - spPrice > 0.005
                      && !loadingSalePrice;
                    const taxAmt       = hasSaleTax && totalWithTax != null && spPrice != null
                      ? totalWithTax - spPrice : 0;
                    const heroValue    = hasSaleTax ? totalWithTax : spPrice;
                    const heroLabel    = hasSaleTax ? "Total final" : "Precio";
                    return (
                      <div className="rounded-xl border border-border/50 bg-card px-4 py-3 space-y-1">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{heroLabel}</div>
                        {loadingSalePrice
                          ? <Loader2 size={16} className="animate-spin text-muted" />
                          : heroValue != null
                            ? <div className="text-xl font-bold tabular-nums text-text">{baseSym} {fmtN(heroValue)}</div>
                            : <div className="text-sm text-muted/50 italic">Sin precio</div>}
                        {/* Composición neto + impuestos (reemplaza la línea de fuente cuando hay impuestos) */}
                        {hasSaleTax && spPrice != null && !loadingSalePrice && (
                          <div className="text-[11px] text-muted tabular-nums">
                            Sin imp.: {baseSym} {fmtN(spPrice)}{" · "}imp.: +{baseSym} {fmtN(taxAmt)}
                          </div>
                        )}
                        {/* Fuente de precio (solo cuando no hay línea de composición) */}
                        {!hasSaleTax && !taxExempt && pricingPreview?.priceSource && !loadingSalePrice && (
                          <div className="text-[11px] text-muted truncate">
                            {PRICE_SOURCE_LABELS_MINI[pricingPreview.priceSource] ?? pricingPreview.priceSource}
                          </div>
                        )}
                        {/* Nota de exención */}
                        {taxExempt && spPrice != null && !loadingSalePrice && (
                          <div className="text-[11px] text-muted italic">Cliente exento de impuestos</div>
                        )}
                      </div>
                    );
                  })()}

                </div>

                {/* ── Galería de imágenes ── */}
                <div className="flex items-center gap-2">
                  <input ref={imgInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImageUpload(f); e.target.value = ""; }} />
                  {images.length > 0 && (
                    <div className="flex gap-1.5">
                      {images.slice(0, 6).map((img, idx) => (
                        <button
                          key={img.id}
                          type="button"
                          title="Ver imagen"
                          onClick={() => setLightboxIdx(idx)}
                          className="cursor-zoom-in"
                        >
                          <img src={img.url} className={cn("h-10 w-10 rounded-lg object-cover border-2 transition hover:opacity-90", img.isMain ? "border-primary ring-1 ring-primary/40" : "border-border opacity-60 hover:opacity-100")} />
                        </button>
                      ))}
                    </div>
                  )}
                  {images.length < MAX_IMAGES && (
                    <TPButton variant="secondary" onClick={() => imgInputRef.current?.click()} disabled={busyImg} className="text-xs h-8">
                      {busyImg ? <Loader2 size={12} className="animate-spin" /> : "+"}
                    </TPButton>
                  )}
                </div>

                {/* ══ Grid 2 columnas: Izquierda | Derecha ══ */}
                <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5 items-start">

                  {/* ─ Columna izquierda ─ */}
                  <div className="space-y-5">

                    {/* Identificación + Configuración */}
                    <div className="rounded-xl border border-border/50 bg-card p-4 flex flex-col gap-4">

                      {/* ── Comercial ── */}
                      {(article.category || article.group || article.brand || article.manufacturer || article.preferredSupplier || article.unitOfMeasure) && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Tag size={13} className="text-muted shrink-0" />
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Comercial</span>
                          </div>
                          <div className="grid grid-cols-2 gap-y-2.5 gap-x-6">
                            {article.category      && <FactPair label="Categoría"        value={article.category.name} />}
                            {article.group         && <FactPair label="Grupo"            value={article.group.name} />}
                            {article.brand         && <FactPair label="Marca"            value={article.brand} />}
                            {article.manufacturer  && <FactPair label="Fabricante"       value={article.manufacturer} />}
                            {article.preferredSupplier && <FactPair label="Proveedor pref." value={article.preferredSupplier.displayName} />}
                            {article.unitOfMeasure && <FactPair label="Unidad de medida" value={article.unitOfMeasure} />}
                          </div>
                        </div>
                      )}

                      {/* ── Identificadores ── */}
                      <div className={cn("space-y-3", (article.category || article.group || article.brand || article.manufacturer || article.preferredSupplier || article.unitOfMeasure) && "border-t border-border/30 pt-3")}>
                        <div className="flex items-center gap-2">
                          <Hash size={13} className="text-muted shrink-0" />
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Identificadores</span>
                        </div>
                        <div className="grid grid-cols-2 gap-y-2.5 gap-x-6">
                          <FactPair label="Código interno"    value={article.code} mono />
                          {article.sku           && <FactPair label="SKU"              value={article.sku} mono />}
                          {article.barcode       && <FactPair label="Código de barras" value={article.barcode} mono />}
                          {(article as any).barcodeType && <FactPair label="Tipo de código"  value={(article as any).barcodeType} />}
                          {(article as any).supplierCode && <FactPair label="Cód. proveedor" value={(article as any).supplierCode} mono />}
                        </div>
                      </div>

                      {/* ── Configuración ── */}
                      <div className="border-t border-border/30 pt-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <Settings2 size={13} className="text-muted shrink-0" />
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Configuración</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <TPBadge tone={article.showInStore  ? "success" : "neutral"} size="sm">
                            <Store size={10} className="mr-1 inline" />
                            En tienda: {article.showInStore ? "Sí" : "No"}
                          </TPBadge>
                          <TPBadge tone={article.isReturnable ? "success" : "neutral"} size="sm">
                            Retornable: {article.isReturnable ? "Sí" : "No"}
                          </TPBadge>
                        </div>
                        <div className="grid grid-cols-2 gap-y-2.5 gap-x-6">
                          <FactPair label="Modo hechura"   value={HECHURA_MODE_LABELS[article.hechuraPriceMode]} />
                          {article.hechuraPrice != null && <FactPair label="Hechura"        value={fmtMoney(article.hechuraPrice, baseSym)} />}
                          {article.mermaPercent != null && <FactPair label="Merma"          value={`${article.mermaPercent}%`} />}
                          {article.reorderPoint != null && <FactPair label="Reposición"     value={`${article.reorderPoint} u.`} />}
                          {article.minSaleQuantity != null && <FactPair label="Cant. mínima"  value={`${article.minSaleQuantity} u.`} />}
                          {article.maxSaleQuantity != null && <FactPair label="Cant. máxima"  value={`${article.maxSaleQuantity} u.`} />}
                          {article.defaultQuantity != null && <FactPair label="Cant. default" value={`${article.defaultQuantity} u.`} />}
                        </div>
                        {article.description && (
                          <p className="text-xs text-muted leading-relaxed border-t border-border/30 pt-3">{article.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Variantes */}
                    <div className="rounded-xl bg-surface2/40 border border-border/40 p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Layers size={13} className="text-muted shrink-0" />
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Variantes</span>
                          {variants.length > 0 && (
                            <span className="inline-flex items-center rounded-full bg-purple-500/10 border border-purple-400/30 px-1.5 py-0.5 text-[10px] font-semibold text-purple-600">
                              {variants.length}
                            </span>
                          )}
                        </div>
                        {variants.length > 0 && (
                          <button type="button" onClick={() => togglePanel("variants")} className="text-xs text-primary hover:underline">
                            {variantsExpanded ? "Ocultar" : "Ver variantes"}
                          </button>
                        )}
                      </div>

                      {/* Chips resumen — siempre visibles */}
                      <div className="flex flex-wrap gap-1.5 content-start">
                        {variants.length === 0
                          ? <span className="text-xs text-muted italic">Sin variantes configuradas</span>
                          : variants.slice(0, 8).map(v => (
                              <span key={v.id} className={cn(
                                "inline-flex items-center rounded-md border px-2 py-0.5 text-xs",
                                v.isActive ? "border-border bg-card text-text" : "border-border/40 bg-surface2/20 text-muted/60"
                              )}>
                                {v.name}
                              </span>
                            ))}
                        {variants.length > 8 && (
                          <span className="text-xs text-muted self-center">+{variants.length - 8} más</span>
                        )}
                      </div>

                      {categoryHasVariantAxes === false && variants.length === 0 && (
                        <div className="flex items-center gap-2 text-xs text-muted border border-border rounded-lg px-3 py-2 bg-surface2/40">
                          <Info size={12} className="shrink-0" />
                          Esta categoría no tiene variantes configuradas.
                        </div>
                      )}

                      {/* ── Dropdown: lista completa de variantes ── */}
                      {variantsExpanded && (
                        <div className="border-t border-border/40 pt-3 space-y-2">
                          {variantsLoading && <div className="text-xs text-muted">Cargando…</div>}
                          {!variantsLoading && variants.length === 0 && (
                            <div className="rounded-xl border border-border border-dashed bg-card p-6 text-center text-sm text-muted">
                              Para agregar variantes, usá el botón <strong>Editar</strong> del artículo.
                            </div>
                          )}
                          {variants.map((v, idx) => {
                            const ownImg = v.images?.find((i) => i.isMain)?.url ?? v.images?.[0]?.url ?? (v.imageUrl || null);
                            const articleImg = images.find((i) => i.isMain)?.url ?? images[0]?.url ?? null;
                            const imgSrc = ownImg ?? articleImg;
                            const isFallback = !ownImg && !!imgSrc;
                            const isDragging = dragIdx === idx;
                            const isOver = overIdx === idx && dragIdx !== null && dragIdx !== idx;
                            // ── KPI de variante ──────────────────────────────
                            const stockQty      = variantStockMap[v.id] ?? 0;
                            const vCostNet      = v.costPrice != null ? parseFloat(v.costPrice) : null;
                            const vCostTotal    = v.costPriceWithTax != null ? parseFloat(v.costPriceWithTax) : vCostNet;
                            const vEffCost      = vCostTotal ?? costWithTax ?? costActual;
                            // El precio es siempre del artículo padre (las variantes no tienen precio propio)
                            const vEffPrice     = spPrice;
                            const vNetCost      = vCostNet ?? costActual;
                            const vNetPrice     = spPrice;
                            const vMargin       = vNetPrice != null && vNetCost != null && vNetPrice > 0
                              ? ((vNetPrice - vNetCost) / vNetPrice * 100) : null;
                            const isFocused = focusVariantId === v.id;
                            return (
                              <div
                                key={v.id}
                                id={`variant-${v.id}`}
                                draggable
                                onDragStart={() => setDragIdx(idx)}
                                onDragOver={(e) => { e.preventDefault(); setOverIdx(idx); }}
                                onDragEnd={() => {
                                  if (dragIdx !== null && overIdx !== null && dragIdx !== overIdx) {
                                    setVariants((prev) => {
                                      const next = [...prev];
                                      const [moved] = next.splice(dragIdx, 1);
                                      next.splice(overIdx, 0, moved);
                                      if (id) {
                                        try { localStorage.setItem(`tptech_variant_order_${id}`, JSON.stringify(next.map((vv) => vv.id))); } catch {}
                                      }
                                      return next;
                                    });
                                  }
                                  setDragIdx(null);
                                  setOverIdx(null);
                                }}
                                onDragLeave={() => setOverIdx(null)}
                                className={cn(
                                  "flex items-start gap-3 rounded-xl border bg-card px-4 py-3 transition-all duration-150",
                                  v.isActive ? "border-border" : "border-border opacity-60",
                                  isDragging && "opacity-40 scale-[0.98]",
                                  isOver && "border-primary ring-1 ring-primary/30",
                                  isFocused && "ring-2 ring-primary/50 border-primary/40 bg-primary/5"
                                )}
                              >
                                <div className="shrink-0 mt-2 cursor-grab active:cursor-grabbing text-muted/40 hover:text-muted">
                                  <GripVertical size={14} />
                                </div>
                                <div className="shrink-0 mt-0.5 flex flex-col items-center gap-0.5">
                                  {imgSrc ? (
                                    <img src={imgSrc} alt={v.name} title={isFallback ? "Imagen del artículo padre" : undefined}
                                      className={cn("w-12 h-12 rounded-lg object-cover border border-border", isFallback && "opacity-40")} />
                                  ) : (
                                    <div className="w-12 h-12 rounded-lg bg-surface2 border border-border flex items-center justify-center">
                                      <Layers size={18} className="text-muted/30" />
                                    </div>
                                  )}
                                  {isFallback && (
                                    <span className="text-[9px] text-muted/60 italic leading-none">Heredada</span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-semibold text-text">{v.name}</span>
                                    <TPActiveBadge active={v.isActive} size="sm" />
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted">
                                    {v.sku
                                      ? <span>SKU: <span className="font-mono text-text/70">{v.sku}</span></span>
                                      : <span className="text-amber-500/80 italic">Sin SKU</span>
                                    }
                                    {v.barcode && (
                                      <span className="flex items-center gap-1">
                                        <ScanBarcode size={10} />
                                        <span className="font-mono text-text/70">{v.barcode}</span>
                                      </span>
                                    )}
                                    {v.weightOverride != null && <span>Peso: <span className="text-text/70">{v.weightOverride}g</span></span>}
                                  </div>
                                  {(v.reorderPoint != null && Number(v.reorderPoint) > 0 || (Array.isArray(v.attributeValues) && v.attributeValues.length > 0)) && (
                                    <div className="flex flex-wrap items-center gap-x-3 mt-1 text-xs text-muted">
                                      {v.reorderPoint != null && Number(v.reorderPoint) > 0 && (
                                        <span>Repos.: <span className="text-text/70 tabular-nums">{v.reorderPoint}</span></span>
                                      )}
                                      {Array.isArray(v.attributeValues) && v.attributeValues.length > 0 && (
                                        <span className="text-muted/60 truncate max-w-xs">
                                          {(v.attributeValues as any[])
                                            .filter((av) => av.value)
                                            .map((av) => av.assignment?.definition?.name ? `${av.assignment.definition.name}: ${av.value}` : av.value)
                                            .join(" · ")}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {(v.minSaleQuantity != null || v.maxSaleQuantity != null || v.defaultQuantity != null) && (
                                    <div className="flex flex-wrap items-center gap-x-3 mt-0.5 text-xs text-muted">
                                      {v.minSaleQuantity != null && <span>Mín: <span className="text-text/70 tabular-nums">{v.minSaleQuantity}</span></span>}
                                      {v.maxSaleQuantity != null && <span>Máx: <span className="text-text/70 tabular-nums">{v.maxSaleQuantity}</span></span>}
                                      {v.defaultQuantity != null && <span>Default: <span className="text-text/70 tabular-nums">{v.defaultQuantity}</span></span>}
                                    </div>
                                  )}
                                  {v.notes && (
                                    <p className="mt-1 text-xs text-muted/70 italic leading-snug">{v.notes}</p>
                                  )}
                                  {/* ── KPI strip: Stock | Costo | Margen | Precio ── */}
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    {/* Stock — solo cuando BY_ARTICLE */}
                                    {article.stockMode === "BY_ARTICLE" && (() => {
                                      const rpNum = v.reorderPoint != null && Number(v.reorderPoint) > 0
                                        ? Number(v.reorderPoint)
                                        : article.reorderPoint != null && Number(article.reorderPoint) > 0
                                          ? Number(article.reorderPoint) : null;
                                      const isLow      = stockQty > 0 && rpNum != null && stockQty <= rpNum;
                                      const stockColor = stockQty === 0 ? "text-red-500" : isLow ? "text-amber-500 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400";
                                      const stockLabel = stockQty === 0 ? "Sin stock" : isLow ? "Stock bajo" : "Disponible";
                                      return (
                                        <div className="rounded-lg border border-border/50 bg-surface2/60 px-2.5 py-1.5 text-center flex flex-col items-center gap-0.5 min-w-[4rem]">
                                          <div className="text-[9px] font-semibold uppercase tracking-wide text-muted leading-none">Stock</div>
                                          <div className={cn("text-sm font-bold tabular-nums leading-none", stockColor)}>
                                            {stockQty > 0 ? `${stockQty} u.` : "0"}
                                          </div>
                                          <div className={cn("text-[9px] leading-none", stockColor)}>{stockLabel}</div>
                                        </div>
                                      );
                                    })()}
                                    {/* Costo — siempre visible, "—" si no hay dato */}
                                    <div className="rounded-lg border border-border/50 bg-surface2/60 px-2.5 py-1.5 text-center flex flex-col items-center gap-0.5 min-w-[4rem]">
                                      <div className="text-[9px] font-semibold uppercase tracking-wide text-muted leading-none">Costo</div>
                                      {vEffCost != null
                                        ? <div className="text-sm font-bold tabular-nums text-text leading-none">{baseSym} {fmtN(vEffCost)}</div>
                                        : <div className="text-sm font-bold text-muted leading-none">—</div>}
                                      <div className="text-[9px] text-muted leading-none">
                                        {vEffCost != null ? (v.costPrice != null ? "propio" : "art.") : ""}
                                      </div>
                                    </div>
                                    {/* Margen — siempre visible, "—" si no hay dato */}
                                    <div className="rounded-lg border border-border/50 bg-surface2/60 px-2.5 py-1.5 text-center flex flex-col items-center gap-0.5 min-w-[4rem]">
                                      <div className="text-[9px] font-semibold uppercase tracking-wide text-muted leading-none">Margen</div>
                                      {vMargin != null
                                        ? <div className={cn("text-sm font-bold tabular-nums leading-none", vMargin >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500")}>
                                            {vMargin >= 0 ? "+" : ""}{fmtN(vMargin)}%
                                          </div>
                                        : <div className="text-sm font-bold text-muted leading-none">—</div>}
                                      <div className="text-[9px] text-muted leading-none">sin imp.</div>
                                    </div>
                                    {/* Precio — siempre visible, "—" si no hay dato */}
                                    <div className="rounded-lg border border-border/50 bg-surface2/60 px-2.5 py-1.5 text-center flex flex-col items-center gap-0.5 min-w-[4rem]">
                                      <div className="text-[9px] font-semibold uppercase tracking-wide text-muted leading-none">Precio</div>
                                      {vEffPrice != null
                                        ? <div className="text-sm font-bold tabular-nums text-text leading-none">{baseSym} {fmtN(vEffPrice)}</div>
                                        : <div className="text-sm font-bold text-muted leading-none">—</div>}
                                      <div className="text-[9px] text-muted leading-none">
                                        {vEffPrice != null ? "art." : ""}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="shrink-0 flex items-center gap-1">
                                  <TPIconButton title="Ver variante" onClick={() => setViewVarId(v.id)} className="h-8 w-8">
                                    <Eye size={14} />
                                  </TPIconButton>
                                  <TPIconButton title="Editar variante" onClick={() => openEditVariant(v)} className="h-8 w-8">
                                    <Pencil size={14} />
                                  </TPIconButton>
                                  <TPIconButton title={v.isActive ? "Desactivar" : "Activar"} onClick={() => void toggleVariant(v)} active={!v.isActive} className="h-8 w-8">
                                    {v.isActive ? <ShieldBan size={14} /> : <ShieldCheck size={14} />}
                                  </TPIconButton>
                                  <TPIconButton title="Eliminar variante" onClick={() => setConfirmDeleteVarId(v.id)} disabled={removingVar === v.id} className="h-8 w-8 hover:bg-red-50 hover:text-red-500 hover:border-red-200">
                                    {removingVar === v.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                  </TPIconButton>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                  </div>

                  {/* ─ Columna derecha ─ */}
                  <div className="space-y-4">

                    {/* ── Combo comercial — solo cuando aplica ──
                        Sección visible en modo lectura: muestra componentes del combo
                        con su stock actual + disponibilidad calculada del combo + regla de precio.
                        Reutiliza endpoint /articles/:id/combo-availability del backend. */}
                    {article.commercialMode === "COMBO_COMMERCIAL" && (
                      <ComboInfoBlock article={article} />
                    )}

                    {/* ── Desglose de costo ── */}
                    <div className="rounded-xl border border-border/50 bg-card p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calculator size={13} className="text-muted shrink-0" />
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Costo</span>
                        </div>
                        {refreshingCostos && <Loader2 size={12} className="animate-spin text-muted" />}
                      </div>


                      {/* Componentes Metal / Hechura */}
                      {(metalCost != null || hechuraCost != null) && (
                        <div className="space-y-1 border-t border-border/30 pt-2">
                          {metalCost != null && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted">Metal</span>
                              <span className="tabular-nums font-medium text-text">{baseSym} {fmtN(metalCost)}</span>
                            </div>
                          )}
                          {hechuraCost != null && hechuraCost > 0 && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted">Hechura</span>
                              <span className="tabular-nums font-medium text-text">{baseSym} {fmtN(hechuraCost)}</span>
                            </div>
                          )}
                          {costActual != null && metalCost != null && (
                            (() => {
                              const otrosCost = costActual - (metalCost ?? 0) - (hechuraCost ?? 0);
                              return otrosCost > 0.001 ? (
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted">Otros</span>
                                  <span className="tabular-nums font-medium text-text">{baseSym} {fmtN(otrosCost)}</span>
                                </div>
                              ) : null;
                            })()
                          )}
                        </div>
                      )}

                      {/* Costo base */}
                      <div className="border-t border-border/30 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted">Costo base</span>
                          {costActual != null
                            ? <span className="text-sm tabular-nums font-semibold text-text">{baseSym} {fmtN(costActual)}</span>
                            : <span className="text-xs text-muted/50 italic">Sin calcular</span>}
                        </div>
                      </div>

                      {/* Impuestos */}
                      {taxDetails.length > 0 && costActual != null && (
                        <div className="space-y-1 border-t border-border/30 pt-2">
                          {taxDetails.map(t => {
                            const pct = t.rate != null ? parseFloat(t.rate) : 0;
                            const amt = pct > 0 ? costActual * (pct / 100) : 0;
                            return (
                              <div key={t.id} className="flex items-center justify-between text-sm">
                                <span className="text-muted">{t.name} <span className="text-muted/60 text-xs">({fmtN(pct)}%)</span></span>
                                <span className="tabular-nums text-muted">+ {baseSym} {fmtN(amt)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Total con impuestos */}
                      {costWithTax != null && (
                        <div className={cn("border-t pt-2", taxDetails.length > 0 ? "border-border/30" : "border-transparent")}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-text">
                              {taxDetails.length > 0 ? "Total con impuestos" : "Costo calculado"}
                            </span>
                            <span className="text-base tabular-nums font-bold text-text">{baseSym} {fmtN(costWithTax)}</span>
                          </div>
                        </div>
                      )}

                      {/* Sin datos */}
                      {costActual == null && (
                        <div className="flex items-center gap-2 text-xs text-muted rounded-lg border border-border/40 bg-surface2/40 px-3 py-2">
                          <Info size={12} className="shrink-0" />
                          Costo no calculado aún.
                        </div>
                      )}
                    </div>

                    {/* ── Stock por depósito (solo BY_ARTICLE) ── */}
                    {article.stockMode === "BY_ARTICLE" && (
                      <div className="rounded-xl border border-border/50 bg-card p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Warehouse size={13} className="text-muted shrink-0" />
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Stock por depósito</span>
                          </div>
                          <button type="button"
                            onClick={() => { setStockWarehouseId(""); setStockVariantId(null); setStockQty(null); setStockModal(true); }}
                            className="text-xs text-primary hover:underline">
                            Ajustar
                          </button>
                        </div>
                        {stockLoading
                          ? <div className="text-xs text-muted">Cargando…</div>
                          : stock.length > 0
                            ? <div className="space-y-1.5">
                                {stock.map(s => (
                                  <div key={s.id} className="flex items-center justify-between text-sm">
                                    <span className="text-muted">
                                      {s.warehouse.name}
                                      {s.variant && <span className="text-xs"> · {s.variant.name}</span>}
                                    </span>
                                    <span className="font-mono font-medium tabular-nums text-text">{s.quantity}</span>
                                  </div>
                                ))}
                                {article.reorderPoint != null && (
                                  <div className="text-xs text-muted border-t border-border/40 pt-2">
                                    Punto de reposición: <span className="text-text font-medium">{article.reorderPoint} u.</span>
                                  </div>
                                )}
                              </div>
                            : <div className="text-xs text-muted/50 italic">Sin movimientos registrados.</div>}
                      </div>
                    )}

                  </div>

                </div>

                {/* ══ Precio de venta: detalles — eliminado de view, usar Simulador ══ */}
                {false && (() => {
                  function fmtN(n: number) {
                    return formatDecimal(n, 2);
                  }
                  const spr     = salePriceResolution!;
                  const src     = spr?.priceSource;
                  const spPriceV = spr?.unitPrice     != null ? parseFloat(spr!.unitPrice!)     : null;
                  const basePrc  = spr?.basePrice     != null ? parseFloat(spr!.basePrice!)     : null;
                  const discAmt  = spr?.discountAmount != null ? parseFloat(spr!.discountAmount!) : 0;

                  const allTiers = articleDiscounts.flatMap((d) =>
                    (d.tiers ?? []).map((t) => ({ ...t, ruleId: d.id, isActive: d.isActive }))
                  );
                  const minDiscount = allTiers.length > 0
                    ? allTiers.reduce((min, t) => parseFloat(t.minQty) < parseFloat(min.minQty) ? t : min, allTiers[0])
                    : null;

                  type RuleStatus = "aplica" | "no-aplica" | "disponible" | "descartada";
                  const STATUS_CFG: Record<RuleStatus, { label: string }> = {
                    "aplica":     { label: "✓ Aplica"     },
                    "disponible": { label: "◎ Disponible" },
                    "descartada": { label: "↷ Descartada" },
                    "no-aplica":  { label: "— No aplica"  },
                  };
                  const listStatus: RuleStatus =
                    spr?.appliedPriceListId ? "aplica"
                    : src === "MANUAL_OVERRIDE" ? "descartada"
                    : src != null && src !== "NONE" && src !== "MANUAL_FALLBACK" ? "disponible"
                    : "no-aplica";
                  const promoStatus: RuleStatus =
                    spr?.appliedPromotionId    ? "aplica"
                    : articlePromos.length > 0 ? "disponible"
                    : "no-aplica";
                  const discountStatus: RuleStatus =
                    spr?.appliedDiscountId                               ? "aplica"
                    : src === "PROMOTION" && articleDiscounts.length > 0 ? "descartada"
                    : articleDiscounts.length > 0                        ? "disponible"
                    : "no-aplica";

                  const PRICE_SOURCE_LABELS: Record<string, string> = {
                    PROMOTION: "Promoción activa", MANUAL_OVERRIDE: "Precio fijo manual",
                    QUANTITY_DISCOUNT: "Descuento por cantidad", PRICE_LIST: "Lista de precios",
                    MANUAL_FALLBACK: "Precio de referencia", NONE: "Sin precio definido",
                  };
                  const SCOPE_LABELS: Record<string, string> = {
                    GENERAL: "General", CATEGORY: "Por categoría", CHANNEL: "Por canal", CLIENT: "Por cliente",
                  };

                  type StepType = "base" | "discount" | "promotion" | "final";
                  type TraceStep = { label: string; sublabel?: string; value: string; type: StepType };
                  const steps: TraceStep[] = [];
                  if (src === "MANUAL_OVERRIDE") {
                    if (spPriceV != null) steps.push({ label: "Precio manual", value: baseSym + fmtN(spPriceV!), type: "base" });
                  } else {
                    if (basePrc != null) {
                      steps.push({
                        label: spr?.appliedPriceListName ? `Lista: ${spr.appliedPriceListName}` : "Precio base",
                        sublabel: spr?.appliedPriceListId ? "Lista de precios" : undefined,
                        value: baseSym + fmtN(basePrc!), type: "base",
                      });
                    }
                    if (discAmt > 0 && spr?.appliedPromotionId) {
                      steps.push({ label: spr!.appliedPromotionName ?? "Promoción", sublabel: "Descuento especial", value: `−${baseSym}${fmtN(discAmt)}`, type: "promotion" });
                    } else if (discAmt > 0) {
                      steps.push({ label: `Desc. ×${simQty} u.`, sublabel: "Desc. por cantidad", value: `−${baseSym}${fmtN(discAmt)}`, type: "discount" });
                    }
                    if (spPriceV != null && steps.length > 0) {
                      steps.push({ label: "Precio final", value: baseSym + fmtN(spPriceV!), type: "final" });
                    }
                  }

                  const allActiveLists = priceLists.filter(l => l.isActive);
                  const simList = simPriceListId ? allActiveLists.find(l => l.id === simPriceListId) : null;
                  const computedForSim = (article as any).computedCostPrice as { value: string | null; metalCost?: string | null; hechuraCost?: string | null } | undefined;
                  const costPriceForSim = computedForSim?.value != null ? parseFloat(computedForSim!.value!) : null;
                  function calcListPrice(pl: PriceListRow): number | null {
                    if (costPriceForSim == null) return null;
                    if (pl.mode === "MARGIN_TOTAL") {
                      const m = (pl as any).marginTotal != null ? parseFloat((pl as any).marginTotal) : 0;
                      return costPriceForSim * (1 + m / 100);
                    }
                    if (pl.mode === "METAL_HECHURA") {
                      const mc = computedForSim?.metalCost   != null ? parseFloat(computedForSim.metalCost)   : costPriceForSim;
                      const hc = computedForSim?.hechuraCost != null ? parseFloat(computedForSim.hechuraCost) : 0;
                      const mM = (pl as any).marginMetal   != null ? parseFloat((pl as any).marginMetal)   : 0;
                      const mH = (pl as any).marginHechura != null ? parseFloat((pl as any).marginHechura) : 0;
                      return mc * (1 + mM / 100) + hc * (1 + mH / 100);
                    }
                    return null;
                  }
                  const simListPrice = simList ? calcListPrice(simList as PriceListRow) : null;

                  return (
                    <div className="rounded-xl border border-border bg-card p-4 space-y-5">
                      {/* Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-border/40">
                        <div className="flex items-center gap-2">
                          <ShoppingCart size={13} className="text-muted shrink-0" />
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Precio de venta — detalles</span>
                        </div>
                        <button type="button" onClick={() => setExpandedPanel(null)} className="text-xs text-primary hover:underline">Ocultar</button>
                      </div>

                      {/* TOP: Precio + Paso a paso | Simular */}
                      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4">
                        <div className="space-y-3">
                          <div className={cn(
                            "rounded-2xl border-2 px-5 py-5 flex items-center justify-between gap-4 transition",
                            spPriceV != null && !loadingSalePrice ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-card"
                          )}>
                            <div>
                              {spr && !loadingSalePrice && (
                                <div className="mb-2">
                                  <TPBadge tone={src === "PROMOTION" ? "warning" : src === "MANUAL_OVERRIDE" ? "primary" : src === "QUANTITY_DISCOUNT" ? "info" : src === "PRICE_LIST" ? "success" : "neutral"}>
                                    {PRICE_SOURCE_LABELS[spr.priceSource] ?? spr.priceSource}
                                  </TPBadge>
                                </div>
                              )}
                              <div className="text-4xl md:text-5xl font-light tracking-tight tabular-nums text-text leading-none">
                                {loadingSalePrice ? <Loader2 size={28} className="animate-spin text-muted" />
                                  : spPriceV != null ? fmtMoney(spPriceV, baseSym)
                                  : <span className="text-muted text-xl font-normal">Sin precio definido</span>}
                              </div>
                              {!loadingSalePrice && spr && (
                                <div className="mt-2 text-xs text-muted">
                                  {spr.partial ? "⚠ Estimación parcial" : `${simQty} u.${simClientId ? " · cliente seleccionado" : ""}`}
                                </div>
                              )}
                            </div>
                            <button type="button" onClick={() => id && void loadSalePrice(id, simQty, simClientId)}
                              className="h-8 w-8 rounded-lg grid place-items-center hover:bg-surface2 text-muted hover:text-text transition shrink-0" title="Recalcular">
                              {loadingSalePrice ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                            </button>
                          </div>

                          {steps.length >= 2 && !loadingSalePrice && (
                            <div className="rounded-xl border border-border/40 bg-surface2/30 px-4 py-3 space-y-2">
                              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted">Cómo se calculó</div>
                              <div className="flex flex-wrap items-stretch gap-1.5">
                                {steps.map((step, i) => (
                                  <React.Fragment key={i}>
                                    {i > 0 && i < steps.length - 1 && (
                                      <div className="flex items-center self-center">
                                        <span className={cn("text-base font-bold leading-none", step.type === "discount" || step.type === "promotion" ? "text-rose-500" : "text-muted/40")}>−</span>
                                      </div>
                                    )}
                                    {i === steps.length - 1 && i > 0 && (
                                      <div className="flex items-center self-center">
                                        <span className="text-base font-bold leading-none text-muted/40">=</span>
                                      </div>
                                    )}
                                    <div className={cn(
                                      "flex flex-col px-3 py-2 rounded-lg border text-xs",
                                      step.type === "final" ? "border-emerald-500/30 bg-emerald-500/10"
                                      : step.type === "promotion" || step.type === "discount" ? "border-rose-500/20 bg-rose-500/5"
                                      : "border-border bg-card"
                                    )}>
                                      {step.sublabel && <span className="text-[9px] uppercase tracking-wider text-muted/60 font-medium leading-none mb-0.5">{step.sublabel}</span>}
                                      <span className="text-[10px] text-muted leading-snug">{step.label}</span>
                                      <span className={cn("font-semibold tabular-nums mt-0.5",
                                        step.type === "final" ? "text-sm text-emerald-700 dark:text-emerald-400"
                                        : step.type === "promotion" || step.type === "discount" ? "text-rose-600 dark:text-rose-400"
                                        : "text-text"
                                      )}>{step.value}</span>
                                    </div>
                                  </React.Fragment>
                                ))}
                              </div>
                            </div>
                          )}

                          {spr?.partial && (
                            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                              <AlertCircle size={12} className="shrink-0" />
                              Estimación parcial — puede faltar configuración de cotizaciones o listas de precios.
                            </div>
                          )}
                        </div>

                        {/* Simular */}
                        <div className="rounded-xl border border-border/40 bg-surface2/20 p-4 space-y-3">
                          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted">Simular precio</div>
                          <TPField label="Cantidad" hint="Cambiá para ver descuentos por volumen.">
                            <TPNumberInput value={simQty} onChange={(v) => { const q = Math.max(1, Math.round(v ?? 1)); setSimQty(q); if (simQtyDebounceRef.current) clearTimeout(simQtyDebounceRef.current); simQtyDebounceRef.current = setTimeout(() => { if (id) void loadSalePrice(id, q, simClientId); }, 400); }} placeholder="1" min={1} decimals={0} />
                          </TPField>
                          <TPField label="Cliente (opcional)">
                            <TPComboFixed value={simClientId} onChange={(v) => { setSimClientId(v); if (id) void loadSalePrice(id, simQty, v); if (simClients.length === 0) void loadSimClients(); }}
                              options={[{ value: "", label: "Sin cliente" }, ...simClients.map(c => ({ value: c.id, label: c.displayName }))]} />
                          </TPField>
                          {allActiveLists.length > 0 && (
                            <div className="space-y-1.5 border-t border-border/30 pt-3">
                              <div className="text-[10px] text-muted uppercase tracking-wide font-medium">Probar lista</div>
                              <TPComboFixed value={simPriceListId} onChange={(v) => setSimPriceListId(v)}
                                options={[{ value: "", label: "— Auto (reglas activas)" }, ...allActiveLists.map(l => ({ value: l.id, label: l.name }))]} />
                              {simListPrice != null
                                ? <div className="flex items-center gap-1.5 text-sm font-semibold text-primary tabular-nums pt-1"><Tag size={13} />{fmtMoney(simListPrice, baseSym)}</div>
                                : simList ? <span className="text-xs text-muted">Sin costo base para calcular</span>
                                : null}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* CARDS: Promoción | Desc. cantidad | Lista */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <TPCard title="Promoción" right={<TPBadge tone={promoStatus === "aplica" ? "warning" : promoStatus === "disponible" ? "warning" : "neutral"} size="sm">{STATUS_CFG[promoStatus].label}</TPBadge>}>
                          {articlePromos.length === 0 ? (
                            <div className="flex flex-col items-center gap-3 py-4 text-center">
                              <Gem size={22} className="text-muted/50" />
                              <p className="text-sm text-muted">No hay promociones para este artículo.</p>
                              <TPButton variant="ghost" onClick={() => navigate("/configuracion-sistema/promociones")}>Nueva promoción</TPButton>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {promoStatus === "aplica" && spr?.appliedPromotionId && (
                                <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                                  <Gem size={12} className="shrink-0" />
                                  <span>Activa: <strong>{spr.appliedPromotionName ?? "Promoción"}</strong>{discAmt > 0 ? ` → −${fmtMoney(discAmt, baseSym)}` : ""}</span>
                                </div>
                              )}
                              <div className="overflow-x-auto rounded-lg border border-border">
                                <table className="w-full text-xs">
                                  <thead><tr className="border-b border-border bg-surface2/40">
                                    <th className="text-left px-3 py-2 font-medium text-muted">Nombre</th>
                                    <th className="text-right px-3 py-2 font-medium text-muted">Desc.</th>
                                    <th className="text-center px-3 py-2 font-medium text-muted">Activa</th>
                                  </tr></thead>
                                  <tbody>
                                    {articlePromos.map((p) => {
                                      const isApplied = spr?.appliedPromotionId === p.id;
                                      return (
                                        <tr key={p.id} className={cn("border-b border-border last:border-0", isApplied && "bg-amber-500/5")}>
                                          <td className="px-3 py-2 font-medium text-text">{p.name}{isApplied && <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold">● Aplica</span>}</td>
                                          <td className="px-3 py-2 text-right tabular-nums text-muted">{p.type === "PERCENTAGE" ? `${parseFloat(p.value)}%` : fmtMoney(p.value, baseSym)}</td>
                                          <td className="px-3 py-2 text-center"><TPActiveBadge active={p.isActive} /></td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                              <div className="flex justify-end"><TPButton variant="ghost" onClick={() => navigate("/configuracion-sistema/promociones")}>Editar</TPButton></div>
                            </div>
                          )}
                        </TPCard>

                        <TPCard title="Desc. por cantidad" right={<TPBadge tone={discountStatus === "aplica" ? "info" : discountStatus === "disponible" ? "info" : "neutral"} size="sm">{STATUS_CFG[discountStatus].label}</TPBadge>}>
                          {articleDiscounts.length === 0 ? (
                            <div className="flex flex-col items-center gap-3 py-4 text-center">
                              <Package size={22} className="text-muted/50" />
                              <p className="text-sm text-muted">Sin descuentos por volumen.</p>
                              <TPButton variant="ghost" onClick={() => navigate("/configuracion-sistema/descuentos-cantidad")}>Crear descuento</TPButton>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {discountStatus === "aplica" && (
                                <div className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 text-xs text-primary">
                                  <Package size={12} className="shrink-0" />
                                  <span>Aplicado por {simQty} u.{discAmt > 0 ? ` → −${fmtMoney(discAmt, baseSym)}` : ""}</span>
                                </div>
                              )}
                              {discountStatus === "descartada" && (
                                <div className="flex items-center gap-2 rounded-lg bg-orange-500/10 border border-orange-500/20 px-3 py-2 text-xs text-orange-600 dark:text-orange-400">
                                  <AlertCircle size={12} className="shrink-0" />
                                  Descartado — una promoción tuvo prioridad.
                                </div>
                              )}
                              <div className="overflow-x-auto rounded-lg border border-border">
                                <table className="w-full text-xs">
                                  <thead><tr className="border-b border-border bg-surface2/40">
                                    <th className="text-left px-3 py-2 font-medium text-muted">Desde</th>
                                    <th className="text-right px-3 py-2 font-medium text-muted">Desc.</th>
                                    <th className="text-center px-3 py-2 font-medium text-muted">Activo</th>
                                  </tr></thead>
                                  <tbody>
                                    {articleDiscounts.flatMap((d) => (d.tiers ?? []).map((t) => ({ ...t, ruleId: d.id, isActive: d.isActive })))
                                      .sort((a, b) => parseFloat(a.minQty) - parseFloat(b.minQty))
                                      .map((t, tIdx) => {
                                        const qty = parseFloat(t.minQty);
                                        const isApplied = spr?.appliedDiscountId === t.ruleId;
                                        const qualifies = simQty >= qty;
                                        return (
                                          <tr key={`${t.ruleId}-${tIdx}`} className={cn("border-b border-border last:border-0", isApplied && "bg-primary/5")}>
                                            <td className="px-3 py-2 font-medium text-text">
                                              {qty.toLocaleString("es-AR")} u.
                                              {isApplied  && <span className="ml-1 text-[10px] text-primary font-semibold">● Aplica</span>}
                                              {!isApplied && qualifies && <span className="ml-1 text-[10px] text-muted">(califica)</span>}
                                            </td>
                                            <td className="px-3 py-2 text-right tabular-nums text-muted">{t.type === "PERCENTAGE" ? `${parseFloat(t.value)}%` : fmtMoney(t.value, baseSym)}</td>
                                            <td className="px-3 py-2 text-center"><TPActiveBadge active={t.isActive} /></td>
                                          </tr>
                                        );
                                      })}
                                  </tbody>
                                </table>
                              </div>
                              {minDiscount && discountStatus === "no-aplica" && (
                                <p className="text-xs text-muted text-center">Desde <strong className="text-text">{parseFloat(minDiscount!.minQty).toLocaleString("es-AR")}</strong> u. se activa el descuento.</p>
                              )}
                              <div className="flex justify-end"><TPButton variant="ghost" onClick={() => navigate("/configuracion-sistema/descuentos-cantidad")}>Editar</TPButton></div>
                            </div>
                          )}
                        </TPCard>

                        <TPCard title="Lista de precios" right={<TPBadge tone={listStatus === "aplica" ? "success" : listStatus === "disponible" ? "info" : "neutral"} size="sm">{STATUS_CFG[listStatus].label}</TPBadge>}>
                          {listStatus === "aplica" && spr?.appliedPriceListId ? (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
                                <Tag size={12} className="shrink-0" />
                                <span>Activa: <strong>{spr.appliedPriceListName ?? "Lista"}</strong></span>
                              </div>
                              {basePrc != null && (
                                <div className="flex items-center justify-between text-xs border-t border-border/30 pt-2">
                                  <span className="text-muted">Precio con lista:</span>
                                  <span className="font-semibold tabular-nums text-text">{fmtMoney(basePrc, baseSym)}</span>
                                </div>
                              )}
                            </div>
                          ) : listStatus === "descartada" ? (
                            <div className="flex items-center gap-2 rounded-lg bg-orange-500/10 border border-orange-500/20 px-3 py-2 text-xs text-orange-600 dark:text-orange-400">
                              <AlertCircle size={12} className="shrink-0" />
                              Precio fijo manual activo — la lista no se aplica.
                            </div>
                          ) : allActiveLists.length === 0 ? (
                            <div className="flex flex-col items-center gap-3 py-4 text-center">
                              <Tag size={22} className="text-muted/50" />
                              <p className="text-sm text-muted">No hay listas de precios activas.</p>
                              <TPButton variant="ghost" onClick={() => navigate("/configuracion-sistema/listas-precio")}>Crear lista</TPButton>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <p className="text-xs text-muted mb-2">Listas activas disponibles:</p>
                              {allActiveLists.slice(0, 5).map(l => (
                                <div key={l.id} className="flex items-center justify-between text-xs py-1 border-b border-border/30 last:border-0">
                                  <span className="text-text font-medium">{l.name}</span>
                                  <span className="text-muted">{SCOPE_LABELS[(l as any).scope] ?? ""}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </TPCard>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Modal: editar variante ── */}
                {varEditId && (() => {
                  const editingVar = variants.find((v) => v.id === varEditId);
                  if (!editingVar || !id) return null;
                  return (
                    <EditVariantModal
                      open={varModal}
                      onClose={() => { setVarModal(false); setVarEditId(null); }}
                      articleId={id}
                      variant={editingVar}
                      onVariantChange={(updated) => setVariants(prev => prev.map(v => v.id === updated.id ? updated : v))}
                      variantStock={variantStockMap}
                      variants={variants}
                      onSwitchVariant={(nextId) => setVarEditId(nextId)}
                    />
                  );
                })()}

                {/* ── Modal: ver variante ── */}
                {viewVarId && (() => {
                  const viewingVar = variants.find((v) => v.id === viewVarId);
                  if (!viewingVar || !article) return null;
                  // El endpoint /articles/:id devuelve computedCostPrice.value y effectiveSalePrice
                  // en lugar de los campos planos computedCostBase y resolvedSalePrice que usa la lista.
                  // Mapeamos aquí para que ViewVariantModal reciba siempre la misma forma.
                  const a = article as any;
                  const articleRowForModal = {
                    ...a,
                    computedCostBase:  a.computedCostBase  ?? a.computedCostPrice?.value ?? null,
                    resolvedSalePrice: a.resolvedSalePrice ?? a.effectiveSalePrice        ?? null,
                  } as import("../../services/articles").ArticleRow;
                  return (
                    <ViewVariantModal
                      open
                      onClose={() => setViewVarId(null)}
                      variant={viewingVar}
                      articleRow={articleRowForModal}
                      stockQty={variantStockMap[viewingVar.id] ?? 0}
                      onEdit={() => { setViewVarId(null); openEditVariant(viewingVar); }}
                    />
                  );
                })()}

                {/* ── Confirm eliminar variante ── */}
                <ConfirmDeleteDialog
                  open={confirmDeleteVarId !== null}
                  title="Eliminar variante"
                  description={`¿Eliminás la variante "${variants.find(v => v.id === confirmDeleteVarId)?.name ?? ""}"? Esta acción no se puede deshacer.`}
                  busy={removingVar === confirmDeleteVarId}
                  onClose={() => setConfirmDeleteVarId(null)}
                  onConfirm={async () => { if (!confirmDeleteVarId) return; await removeVariant(confirmDeleteVarId); setConfirmDeleteVarId(null); }}
                />

                {/* Notas internas */}
                {(article as any).notes && (
                  <TPCard title="Notas internas">
                    <p className="text-sm text-text whitespace-pre-wrap">{(article as any).notes}</p>
                  </TPCard>
                )}

                {/* Atributos */}
                {attributes.length > 0 && (
                  <TPCard title="Atributos">
                    <div className="grid grid-cols-2 gap-y-2.5 gap-x-6">
                      {attributes.map((av) => (
                        <FactPair
                          key={av.id}
                          label={av.assignment.definition.name + (av.assignment.isRequired ? " *" : "")}
                          value={av.value || null}
                        />
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-muted">Los atributos se editan en la pantalla de categorías.</p>
                  </TPCard>
                )}

              </>
            );
          })()}

          {/* ── Vista modo creación: formulario ── */}
          {createMode && draft && (
            <>
              <TPCard title="Información básica">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <TPField label="Nombre *">
                    <TPInput
                      value={draft.name}
                      onChange={(v) => setDraft((p) => p && ({ ...p, name: v }))}
                      error={submitted && !draft.name.trim() ? "El nombre es obligatorio." : ""}
                    />
                  </TPField>

                  <TPField label="Código (se genera automáticamente si no se ingresa)">
                    <TPInput
                      value={draft.code}
                      onChange={(v) => setDraft((p) => p && ({ ...p, code: v }))}
                      placeholder="Ej: ART-0001"
                    />
                  </TPField>

                  <TPField label="Categoría">
                    <TPComboFixed
                      value={draft.categoryId ?? ""}
                      onChange={(v) => setDraft((p) => p && ({ ...p, categoryId: v || null }))}
                      options={[{ label: "Sin categoría", value: "" }, ...categoryOptions]}
                    />
                  </TPField>

                  <TPField label="Estado">
                    <TPComboFixed
                      value={draft.status}
                      onChange={(v) => setDraft((p) => p && ({ ...p, status: v as ArticleStatus }))}
                      options={statusOptions}
                    />
                  </TPField>

                  <TPField
                    label="Modo de venta"
                    hint="Combo comercial: el precio se calcula desde sus componentes y el stock se descuenta de ellos"
                  >
                    <TPComboFixed
                      value={draft.commercialMode}
                      onChange={(v) => setDraft((p) => p && ({ ...p, commercialMode: v as ArticleCommercialMode }))}
                      options={[
                        { value: "NORMAL",           label: "Producto normal" },
                        { value: "COMBO_COMMERCIAL", label: "Combo comercial" },
                      ]}
                    />
                  </TPField>

                  <div className="md:col-span-2">
                    <TPField label="Descripción">
                      <TPTextarea
                        value={draft.description}
                        onChange={(v) => setDraft((p) => p && ({ ...p, description: v }))}
                        rows={2}
                      />
                    </TPField>
                  </div>
                </div>
              </TPCard>

              {/* ── COMBO COMERCIAL — solo cuando commercialMode = COMBO_COMMERCIAL ────────
                  Sección visualmente diferenciada de "Composición del costo" para no
                  confundir al usuario: los componentes acá descuentan stock real al vender. */}
              {draft.commercialMode === "COMBO_COMMERCIAL" && (
                <TPCard
                  title="Combo comercial"
                  right={<TPBadge tone="info" size="sm">COMBO</TPBadge>}
                >
                  <div className="space-y-4">
                    {/* Aviso de stock dependiente */}
                    <div className="rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                      <strong>Este combo no tiene stock propio.</strong> Al venderlo se descontará
                      automáticamente el stock de cada uno de sus componentes según la cantidad indicada.
                    </div>

                    {/* Componentes del combo */}
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                        Artículos incluidos en el combo
                      </div>
                      <div className="space-y-2">
                        {draft.comboComponents.map((c, idx) => {
                          const lineSubtotal = c.unitPrice != null ? c.unitPrice * (c.quantity || 0) : null;
                          return (
                            <div
                              key={idx}
                              className="grid grid-cols-[1fr_120px_40px] items-end gap-2 rounded-lg border border-border bg-muted/5 px-3 py-2"
                            >
                              <div className="min-w-0">
                                <div className="text-sm text-text font-medium truncate">{c.name || "Sin nombre"}</div>
                                <div className="text-[11px] text-muted/70 font-mono flex items-center gap-2">
                                  <span>{c.code}</span>
                                  {c.stock != null && (
                                    <span className={cn(
                                      "rounded px-1 text-[10px]",
                                      c.stock > 0 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-red-500/10 text-red-700 dark:text-red-400",
                                    )} title="Stock actual del componente">
                                      stock {c.stock}
                                    </span>
                                  )}
                                  {c.unitPrice != null && (
                                    <span className="text-muted/60 tabular-nums" title="Precio unitario actual del componente">
                                      {fmtMoney(c.unitPrice, "$")}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <TPField label="Cantidad" hint="Por unidad de combo">
                                <TPNumberInput
                                  value={c.quantity}
                                  onChange={(v) => setDraft((p) => {
                                    if (!p) return p;
                                    const next = [...p.comboComponents];
                                    next[idx] = { ...next[idx], quantity: v ?? 1 };
                                    return { ...p, comboComponents: next };
                                  })}
                                  min={0.0001}
                                  decimals={4}
                                />
                                {lineSubtotal != null && (
                                  <p className="text-[10px] text-muted/60 tabular-nums mt-1 text-right">
                                    Subtotal: {fmtMoney(lineSubtotal, "$")}
                                  </p>
                                )}
                              </TPField>
                              <TPIconButton
                                title="Quitar componente"
                                onClick={() => setDraft((p) => p && ({
                                  ...p,
                                  comboComponents: p.comboComponents.filter((_, i) => i !== idx),
                                }))}
                                className="h-8 w-8"
                              >
                                <Trash2 size={14} />
                              </TPIconButton>
                            </div>
                          );
                        })}
                        {draft.comboComponents.length === 0 && (
                          <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted">
                            Aún no agregaste componentes. Buscá un artículo abajo para empezar.
                          </div>
                        )}
                      </div>

                      {/* Picker de artículo */}
                      <div className="mt-3">
                        <ArticleSearchSelect
                          selected={null}
                          onSelect={(row: ArticleRow) => {
                            // No permitir autoreferencia (en creación no hay aún ID, así que solo evitar duplicados)
                            setDraft((p) => {
                              if (!p) return p;
                              if (p.comboComponents.some(c => c.articleId === row.id)) {
                                toast.error("Este artículo ya está agregado como componente.");
                                return p;
                              }
                              // Snapshot de precio y stock para preview/UX en el editor.
                              // El cálculo definitivo lo hace el motor en backend al confirmar.
                              const unitPrice = row.salePrice != null ? parseFloat(String(row.salePrice)) : null;
                              const stock = row.stockData?.total ?? null;
                              return {
                                ...p,
                                comboComponents: [
                                  ...p.comboComponents,
                                  { articleId: row.id, code: row.code, name: row.name, quantity: 1, unitPrice, stock },
                                ],
                              };
                            });
                          }}
                          onClear={() => {}}
                          placeholder="Buscar artículo para agregar al combo…"
                          articleType="PRODUCT"
                        />
                      </div>
                    </div>

                    {/* Regla de precio del combo */}
                    <div className="border-t border-border/40 pt-4">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                        Regla de precio del combo
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <TPField label="Tipo de ajuste">
                          <TPComboFixed
                            value={draft.comboAdjustmentKind}
                            onChange={(v) => setDraft((p) => p && ({
                              ...p,
                              comboAdjustmentKind: v as ComboAdjustmentKind,
                              // Si pasa a NONE, descartar value
                              comboAdjustmentValue: v === "NONE" ? null : p.comboAdjustmentValue,
                            }))}
                            options={[
                              { value: "NONE",              label: "Suma directa (sin ajuste)" },
                              { value: "DISCOUNT_PERCENT",  label: "Descuento %" },
                              { value: "DISCOUNT_FIXED",    label: "Descuento fijo" },
                              { value: "SURCHARGE_PERCENT", label: "Recargo %" },
                            ]}
                          />
                        </TPField>
                        {draft.comboAdjustmentKind !== "NONE" && (
                          <TPField
                            label={
                              draft.comboAdjustmentKind === "DISCOUNT_FIXED"
                                ? "Monto a descontar"
                                : "Porcentaje (0–100)"
                            }
                          >
                            <TPNumberInput
                              value={draft.comboAdjustmentValue}
                              onChange={(v) => setDraft((p) => p && ({ ...p, comboAdjustmentValue: v }))}
                              min={0}
                              max={draft.comboAdjustmentKind === "DISCOUNT_FIXED" ? undefined : 100}
                              decimals={2}
                            />
                          </TPField>
                        )}
                      </div>
                      <p className="text-[11px] text-muted/70 mt-2">
                        El precio del combo se calcula automáticamente sumando el precio de cada componente
                        y aplicando este ajuste. Si cambia el precio de algún componente, el del combo se actualiza.
                      </p>

                      {/* SKELETON de preview del combo durante edición.
                          El cálculo DEFINITIVO lo hace el pricing-engine del backend al
                          guardar/confirmar. Este bloque solo muestra una estimación
                          optimista con los snapshots de salePrice cargados en cada
                          componente — puede diferir del precio final si el motor aplica
                          lista de precios, promoción, cupón, canal o redondeo.
                          Ver reglas en src/lib/pricing-engine/README.md (backend). */}
                      {(() => {
                        const comps = draft.comboComponents.filter(c => c.unitPrice != null);
                        if (comps.length === 0) return null;
                        const subtotal = comps.reduce((s, c) => s + (c.unitPrice ?? 0) * (c.quantity || 0), 0);
                        const k = draft.comboAdjustmentKind;
                        const v = draft.comboAdjustmentValue ?? 0;
                        // _previewComboSkeleton: replica local del ajuste de combo que hace
                        // applyComboAdjustment en src/lib/combo.utils.ts (backend). El backend
                        // es la única fuente de verdad; esto solo evita un round-trip por tecla.
                        let final = subtotal;
                        let adjAmount = 0;
                        if (k === "DISCOUNT_PERCENT")  { adjAmount = subtotal * v / 100; final = subtotal - adjAmount; }
                        if (k === "SURCHARGE_PERCENT") { adjAmount = subtotal * v / 100; final = subtotal + adjAmount; }
                        if (k === "DISCOUNT_FIXED")    { adjAmount = v;                  final = subtotal - v; }
                        if (final < 0) final = 0;
                        const allKnown = comps.length === draft.comboComponents.length;
                        return (
                          <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                                Preview de precio
                              </div>
                              <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                Estimado
                              </span>
                            </div>
                            <div className="flex justify-between text-xs text-muted">
                              <span>Subtotal componentes</span>
                              <span className="tabular-nums">{fmtMoney(subtotal, "$")}</span>
                            </div>
                            {k !== "NONE" && Math.abs(adjAmount) > 0.005 && (
                              <div className="flex justify-between text-xs text-muted">
                                <span>{k === "SURCHARGE_PERCENT" ? "Recargo" : "Descuento"}</span>
                                <span className={cn("tabular-nums", k === "SURCHARGE_PERCENT" ? "text-emerald-600" : "text-red-600")}>
                                  {k === "SURCHARGE_PERCENT" ? "+" : "−"}{fmtMoney(Math.abs(adjAmount), "$")}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm font-bold text-text border-t border-border/30 pt-1">
                              <span>Precio del combo</span>
                              <span className="tabular-nums text-primary">{fmtMoney(final, "$")}</span>
                            </div>
                            <p className="text-[10px] text-muted/70 italic border-t border-border/30 pt-1">
                              El precio definitivo lo calcula el motor de precios al guardar el combo.
                            </p>
                            {!allKnown && (
                              <p className="text-[10px] text-amber-600 dark:text-amber-400 italic">
                                Algunos componentes no tienen precio cargado: la estimación es parcial.
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </TPCard>
              )}

              <TPCard title="Stock y hechura">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <TPField
                    label="Modo de stock"
                    hint={draft.commercialMode === "COMBO_COMMERCIAL"
                      ? "Bloqueado: los combos no manejan stock propio (depende de los componentes)"
                      : undefined}
                  >
                    <TPComboFixed
                      value={draft.commercialMode === "COMBO_COMMERCIAL" ? "NO_STOCK" : draft.stockMode}
                      onChange={(v) => setDraft((p) => p && ({ ...p, stockMode: v as StockMode }))}
                      options={stockModeOptions}
                      disabled={draft.commercialMode === "COMBO_COMMERCIAL"}
                    />
                  </TPField>

                  <TPField label="Modo de hechura">
                    <TPComboFixed
                      value={draft.hechuraPriceMode}
                      onChange={(v) => setDraft((p) => p && ({ ...p, hechuraPriceMode: v as HechuraPriceMode }))}
                      options={hechuraModeOptions}
                    />
                  </TPField>

                  <TPField label={`Precio de hechura${draft.hechuraPriceMode === "PER_GRAM" ? " (por gramo)" : " (monto fijo)"}`}>
                    <TPNumberInput
                      value={draft.hechuraPrice}
                      onChange={(v) => setDraft((p) => p && ({ ...p, hechuraPrice: v }))}
                      min={0}
                      decimals={2}
                    />
                  </TPField>

                  <TPField label="Merma (%) — override de categoría">
                    <TPNumberInput
                      value={draft.mermaPercent}
                      onChange={(v) => setDraft((p) => p && ({ ...p, mermaPercent: v }))}
                      min={0}
                      max={100}
                      decimals={2}
                      placeholder="Heredado de categoría si vacío"
                    />
                  </TPField>
                </div>
              </TPCard>

              <TPCard title="Notas internas">
                <TPTextarea
                  value={draft.notes}
                  onChange={(v) => setDraft((p) => p && ({ ...p, notes: v }))}
                  rows={3}
                  placeholder="Notas visibles solo internamente…"
                />
              </TPCard>

              <div className="flex justify-end gap-2">
                <TPButton variant="ghost" onClick={() => navigate(-1)}>Cancelar</TPButton>
                <TPButton onClick={handleSave} disabled={busySave}>
                  {busySave ? "Creando…" : "Crear artículo"}
                </TPButton>
              </div>
            </>
          )}
        </div>
      )}

      {/* Stock adjust modal (accesible desde la card C del General) */}
      {stockModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setStockModal(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-xl">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="text-sm font-semibold text-text">Ajustar stock</div>
                <button type="button" onClick={() => setStockModal(false)} className="h-8 w-8 rounded-lg border border-border bg-card hover:bg-surface2 grid place-items-center text-muted hover:text-text transition">
                  <X size={14} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <TPField label="ID de almacén *">
                  <TPInput
                    value={stockWarehouseId}
                    onChange={(v) => setStockWarehouseId(v)}
                    placeholder="ID del almacén"
                  />
                </TPField>
                {variants.length > 0 && (
                  <TPField label="Variante (opcional)">
                    <TPComboFixed
                      value={stockVariantId ?? ""}
                      onChange={(v) => setStockVariantId(v || null)}
                      options={[
                        { label: "Sin variante", value: "" },
                        ...variants.map((v) => ({ label: v.name, value: v.id })),
                      ]}
                    />
                  </TPField>
                )}
                <TPField label="Cantidad *">
                  <TPNumberInput
                    value={stockQty}
                    onChange={setStockQty}
                    min={0}
                    decimals={0}
                  />
                </TPField>
              </div>
              <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
                <TPButton variant="ghost" onClick={() => setStockModal(false)}>Cancelar</TPButton>
                <TPButton
                  onClick={handleStockAdjust}
                  disabled={busyStock || !stockWarehouseId || stockQty == null}
                >
                  {busyStock ? "Ajustando…" : "Guardar"}
                </TPButton>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>{/* /space-y-4 py-4 (contenido de tabs) */}

      {/* ── Modal edición ────────────────────────────────────────────── */}
      {!createMode && id && (
        <ArticleModal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          articleId={id}
          onSaved={() => {
            setEditModalOpen(false);
            void fetchArticle();
            if (ventasLoaded && id) void loadSalePrice(id, simQty, simClientId);
          }}
        />
      )}

      {/* ── Confirmar eliminar artículo ─────────────────────────────── */}
      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        title="Eliminar artículo"
        description={`¿Eliminás "${article?.name ?? "este artículo"}"? Esta acción no se puede deshacer.`}
        busy={busyDeleteArt}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleArticleDelete}
      />

      {/* ── Lightbox de imágenes ──────────────────────────────────── */}
      {lightboxIdx !== null && images.length > 0 && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={() => setLightboxIdx(null)}
        >
          {/* Imagen */}
          <img
            src={images[lightboxIdx].url}
            alt={article?.name}
            className="max-w-[90vw] max-h-[90vh] rounded-2xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />

          {/* Botón cerrar */}
          <button
            type="button"
            onClick={() => setLightboxIdx(null)}
            className="absolute top-4 right-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition"
          >
            <X size={20} />
          </button>

          {/* Navegación anterior */}
          {images.length > 1 && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setLightboxIdx(i => i !== null ? (i - 1 + images.length) % images.length : 0); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-3 text-xl text-white hover:bg-black/70 transition leading-none"
            >
              ‹
            </button>
          )}

          {/* Navegación siguiente */}
          {images.length > 1 && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setLightboxIdx(i => i !== null ? (i + 1) % images.length : 0); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-3 text-xl text-white hover:bg-black/70 transition leading-none"
            >
              ›
            </button>
          )}

          {/* Miniaturas */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2" onClick={e => e.stopPropagation()}>
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setLightboxIdx(idx)}
                  className={cn(
                    "w-12 h-12 rounded-lg overflow-hidden border-2 transition",
                    idx === lightboxIdx ? "border-white opacity-100" : "border-transparent opacity-50 hover:opacity-80"
                  )}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Contador */}
          {images.length > 1 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
              {lightboxIdx + 1} / {images.length}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
