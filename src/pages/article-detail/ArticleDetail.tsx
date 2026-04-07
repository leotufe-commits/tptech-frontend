// src/pages/article-detail/ArticleDetail.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Barcode,
  Calculator,
  DollarSign,
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
import EditVariantModal from "./EditVariantModal";
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
import { fmtMoney } from "../../services/articles";

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
};

function articleToDraft(a: ArticleDetailType): Draft {
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
};

function draftToPayload(d: Draft): ArticlePayload {
  return {
    name: d.name.trim(),
    code: d.code.trim() || undefined,
    description: d.description.trim() || undefined,
    categoryId: d.categoryId || null,
    status: d.status,
    stockMode: d.stockMode,
    hechuraPriceMode: d.hechuraPriceMode,
    hechuraPrice: d.hechuraPrice,
    mermaPercent: d.mermaPercent,
    notes: d.notes.trim() || undefined,
    salePrice: d.salePrice,
    useManualSalePrice: d.useManualSalePrice,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export default function ArticleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

  async function fetchArticle() {
    setLoading(true);
    try {
      const data = await articlesApi.getOne(id!);
      setArticle(data);
      setDraft(articleToDraft(data));
      // pre-populate tab data from detail
      setVariants(data.variants);
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
      setVariants(data.variants);
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

                    {/* Badges: tipo + variantes + categoría */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <TPBadge tone={ARTICLE_TYPE_TONES[article.articleType]}>
                        {ARTICLE_TYPE_LABELS[article.articleType]}
                      </TPBadge>
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
              <TPButton variant="secondary" onClick={() => navigate(-1)} iconLeft={<ArrowLeft size={14} />}>
                Volver
              </TPButton>
              {!createMode && article && (
                <>
                  <TPButton variant="secondary" onClick={() => navigate(`/herramientas/simulador-precios?articleId=${id}`)} iconLeft={<Calculator size={14} />}>
                    Simulador
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
              return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }

            return (
              <>

                {/* ── KPI comercial ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 border-b border-border pb-4">

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

                  {/* ── Card PRECIO DE VENTA ── */}
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
                            Neto: {baseSym} {fmtN(spPrice)}{" · "}imp.: +{baseSym} {fmtN(taxAmt)}
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

                  {/* Margen */}
                  <div className="rounded-xl border border-border/50 bg-card px-4 py-3 space-y-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Margen</div>
                    {margin != null
                      ? <>
                          <div className={cn("text-xl font-bold tabular-nums", margin >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500")}>
                            {margin >= 0 ? "+" : ""}{fmtN(margin)}%
                          </div>
                          <div className="text-[11px] text-muted">sobre precio neto</div>
                        </>
                      : <div className="text-sm text-muted/50 italic">Sin datos</div>}
                  </div>

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
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Hash size={13} className="text-muted shrink-0" />
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Identificación</span>
                        </div>
                        <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                          <FactPair label="Código"            value={article.code} mono />
                          {article.sku           && <FactPair label="SKU"               value={article.sku} mono />}
                          {article.barcode       && <FactPair label="Código de barras"   value={article.barcode} mono />}
                          {(article as any).barcodeType && <FactPair label="Tipo de código"   value={(article as any).barcodeType} />}
                          {article.unitOfMeasure && <FactPair label="Unidad de medida"   value={article.unitOfMeasure} />}
                          {article.brand         && <FactPair label="Marca"              value={article.brand} />}
                          {article.manufacturer  && <FactPair label="Fabricante"         value={article.manufacturer} />}
                          {article.preferredSupplier && <FactPair label="Proveedor pref." value={article.preferredSupplier.displayName} />}
                          {(article as any).supplierCode && <FactPair label="Cód. proveedor" value={(article as any).supplierCode} mono />}
                        </div>
                      </div>

                      <div className="border-t border-border/30 pt-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <Settings2 size={13} className="text-muted shrink-0" />
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Configuración</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <TPBadge tone={article.showInStore   ? "success" : "neutral"} size="sm">
                            <Store size={10} className="mr-1 inline" />
                            En tienda: {article.showInStore ? "Sí" : "No"}
                          </TPBadge>
                          <TPBadge tone={article.isReturnable  ? "success" : "neutral"} size="sm">
                            Retornable: {article.isReturnable ? "Sí" : "No"}
                          </TPBadge>
                          <TPBadge tone={article.sellWithoutVariants ? "info" : "neutral"} size="sm">
                            Variantes: {article.sellWithoutVariants ? "Sin variantes" : "Con variantes"}
                          </TPBadge>
                        </div>
                        <div className="grid grid-cols-2 gap-y-2.5 gap-x-6">
                          <FactPair label="Modo de stock"  value={STOCK_MODE_LABELS[article.stockMode]} />
                          <FactPair label="Modo hechura"   value={HECHURA_MODE_LABELS[article.hechuraPriceMode]} />
                          <FactPair label="Tipo de precio" value={(article as any).useManualSalePrice ? "Manual" : "Por lista"} />
                          {article.hechuraPrice != null && <FactPair label="Hechura"    value={fmtMoney(article.hechuraPrice, baseSym)} />}
                          {article.mermaPercent != null && <FactPair label="Merma"      value={`${article.mermaPercent}%`} />}
                          {article.reorderPoint != null && <FactPair label="Reposición" value={`${article.reorderPoint} u.`} />}
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
                            return (
                              <div
                                key={v.id}
                                draggable
                                onDragStart={() => setDragIdx(idx)}
                                onDragOver={(e) => { e.preventDefault(); setOverIdx(idx); }}
                                onDragEnd={() => {
                                  if (dragIdx !== null && overIdx !== null && dragIdx !== overIdx) {
                                    setVariants((prev) => {
                                      const next = [...prev];
                                      const [moved] = next.splice(dragIdx, 1);
                                      next.splice(overIdx, 0, moved);
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
                                  isOver && "border-primary ring-1 ring-primary/30"
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
                                    {v.priceOverride != null && <span>Precio fijo: <span className="text-text/70 tabular-nums">{fmtMoney(v.priceOverride)}</span></span>}
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
                                </div>
                                <div className="shrink-0 flex items-center gap-1">
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
                    return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  }
                  const spr     = salePriceResolution;
                  const src     = spr?.priceSource;
                  const spPriceV = spr?.unitPrice     != null ? parseFloat(spr.unitPrice)     : null;
                  const basePrc  = spr?.basePrice     != null ? parseFloat(spr.basePrice)     : null;
                  const discAmt  = spr?.discountAmount != null ? parseFloat(spr.discountAmount) : 0;

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
                    if (spPriceV != null) steps.push({ label: "Precio manual", value: baseSym + fmtN(spPriceV), type: "base" });
                  } else {
                    if (basePrc != null) {
                      steps.push({
                        label: spr?.appliedPriceListName ? `Lista: ${spr.appliedPriceListName}` : "Precio base",
                        sublabel: spr?.appliedPriceListId ? "Lista de precios" : undefined,
                        value: baseSym + fmtN(basePrc), type: "base",
                      });
                    }
                    if (discAmt > 0 && spr?.appliedPromotionId) {
                      steps.push({ label: spr.appliedPromotionName ?? "Promoción", sublabel: "Descuento especial", value: `−${baseSym}${fmtN(discAmt)}`, type: "promotion" });
                    } else if (discAmt > 0) {
                      steps.push({ label: `Desc. ×${simQty} u.`, sublabel: "Desc. por cantidad", value: `−${baseSym}${fmtN(discAmt)}`, type: "discount" });
                    }
                    if (spPriceV != null && steps.length > 0) {
                      steps.push({ label: "Precio final", value: baseSym + fmtN(spPriceV), type: "final" });
                    }
                  }

                  const allActiveLists = priceLists.filter(l => l.isActive);
                  const simList = simPriceListId ? allActiveLists.find(l => l.id === simPriceListId) : null;
                  const computedForSim = (article as any).computedCostPrice as { value: string | null; metalCost?: string | null; hechuraCost?: string | null } | undefined;
                  const costPriceForSim = computedForSim?.value != null ? parseFloat(computedForSim.value) : null;
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
                  const simListPrice = simList ? calcListPrice(simList) : null;

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
                                <p className="text-xs text-muted text-center">Desde <strong className="text-text">{parseFloat(minDiscount.minQty).toLocaleString("es-AR")}</strong> u. se activa el descuento.</p>
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

              <TPCard title="Stock y hechura">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <TPField label="Modo de stock">
                    <TPComboFixed
                      value={draft.stockMode}
                      onChange={(v) => setDraft((p) => p && ({ ...p, stockMode: v as StockMode }))}
                      options={stockModeOptions}
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
