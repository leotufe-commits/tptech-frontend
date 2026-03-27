// src/pages/article-detail/ArticleDetail.tsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Calculator,
  DollarSign,
  Eye,
  FileText,
  Gem,
  Hash,
  Info,
  Layers,
  Loader2,
  Pencil,
  Package,
  Power,
  PowerOff,
  RefreshCw,
  Ruler,
  ScanBarcode,
  ShoppingCart,
  Star,
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
import { TPInfoCard } from "../../components/ui/TPInfoCard";
import ConfirmDeleteDialog from "../../components/ui/ConfirmDeleteDialog";
import { cn } from "../../components/ui/tp";
import { toast } from "../../lib/toast";
import ArticleModal from "./ArticleModal";
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
  ARTICLE_TYPE_LABELS,
  ARTICLE_TYPE_TONES,
  ARTICLE_STATUS_LABELS,
  ARTICLE_STATUS_COLORS,
  STOCK_MODE_LABELS,
  HECHURA_MODE_LABELS,
  COST_MODE_LABELS,
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
// Tabs
// ---------------------------------------------------------------------------
type Tab = "general" | "costos" | "variants" | "stock" | "ventas";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "general",  label: "General",          icon: <FileText size={14} /> },
  { key: "variants", label: "Variantes",         icon: <Layers size={14} /> },
  { key: "costos",   label: "Costos",            icon: <Calculator size={14} /> },
  { key: "ventas",   label: "Precio de venta",   icon: <ShoppingCart size={14} /> },
  { key: "stock",    label: "Stock",             icon: <Warehouse size={14} /> },
];

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

  // ---- Tabs ----
  const [activeTab, setActiveTab] = useState<Tab>("general");

  // ---- Edit modal ----
  const [editModalOpen, setEditModalOpen] = useState(false);

  // ---- Visibilidad pestaña Variantes ----
  // null = cargando (tab visible por defecto), false = sin ejes, true = tiene ejes
  const [categoryHasVariantAxes, setCategoryHasVariantAxes] = useState<boolean | null>(null);

  // ---- Lazy tab data ----
  const [variants, setVariants]               = useState<ArticleVariant[]>([]);
  const [variantsLoaded, setVariantsLoaded]   = useState(false);
  const [variantsLoading, setVariantsLoading] = useState(false);

  const [attributes, setAttributes]               = useState<ArticleAttributeValue[]>([]);
  const [attributesLoaded, setAttributesLoaded]   = useState(false);
  const [attributesLoading, setAttributesLoading] = useState(false);

  const [images, setImages]               = useState<ArticleImage[]>([]);
  const [imagesLoaded, setImagesLoaded]   = useState(false);
  const [imagesLoading, setImagesLoading] = useState(false);

  const [stock, setStock]               = useState<ArticleStock[]>([]);
  const [stockLoaded, setStockLoaded]   = useState(false);
  const [stockLoading, setStockLoading] = useState(false);

  // ---- Ventas / Precio de venta ----
  const [salePriceResolution, setSalePriceResolution] = useState<SalePriceResult | null>(null);
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
  const [varDraft, setVarDraft]     = useState<{ code: string; name: string; sku: string }>({
    code: "", name: "", sku: "",
  });
  const [busyVar,    setBusyVar]    = useState(false);
  const [busyVarImg, setBusyVarImg] = useState(false);
  const [removingVar, setRemovingVar] = useState<string | null>(null);
  const [confirmDeleteVarId, setConfirmDeleteVarId] = useState<string | null>(null);
  const varImgRef = useRef<HTMLInputElement>(null);

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

  async function fetchArticle() {
    setLoading(true);
    try {
      const data = await articlesApi.getOne(id!);
      setArticle(data);
      setDraft(articleToDraft(data));
      // pre-populate tab data from detail
      setVariants(data.variants);
      setVariantsLoaded(true);
      setAttributes(data.attributeValues);
      setAttributesLoaded(true);
      setImages(data.images);
      setImagesLoaded(true);
      // Determinar si la categoría tiene ejes de variante (tab Variantes visible/oculto)
      setCategoryHasVariantAxes(null); // resetear mientras carga
      if (data.categoryId) {
        void loadCategoryAxes(data.categoryId);
      } else {
        setCategoryHasVariantAxes(false);
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

  /* ==============================================================
     TAB CHANGE — lazy load
  ============================================================== */
  async function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    if (!id || createMode) return;
    if (tab === "stock" && !stockLoaded && !stockLoading) {
      setStockLoading(true);
      try {
        setStock(await articlesApi.stock.get(id));
        setStockLoaded(true);
      } catch (e: any) {
        toast.error(e?.message || "Error al cargar stock.");
      } finally {
        setStockLoading(false);
      }
    }
    if (tab === "costos" && !taxesLoaded) {
      setTaxesLoaded(true);
      void loadTaxes();
    }
    if (tab === "ventas") {
      if (!ventasLoaded) {
        void loadVentasData();           // primera vez: carga todo (precio, promos, listas)
      } else {
        void loadSalePrice(id, simQty, simClientId); // revisita: sólo refresca el precio
      }
    }
  }

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
      const res = await articlesApi.getSalePrice(articleId, { quantity: qty, clientId: clientId || null });
      setSalePriceResolution(res);
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
  function openEditVariant(v: ArticleVariant) {
    setVarEditId(v.id);
    setVarDraft({ code: v.code, name: v.name, sku: v.sku ?? "" });
    setVarModal(true);
  }

  async function saveVariant() {
    if (!id || !varEditId || !varDraft.name.trim()) return;
    setBusyVar(true);
    try {
      const updated = await articlesApi.variants.update(id, varEditId, {
        code: varDraft.code,
        name: varDraft.name.trim(),
        sku: varDraft.sku.trim() || undefined,
      });
      setVariants((prev) => prev.map((v) => (v.id === varEditId ? updated : v)));
      setVarModal(false);
      toast.success("Variante actualizada.");
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar variante.");
    } finally {
      setBusyVar(false);
    }
  }

  async function handleVarImgUpload(file: File) {
    if (!id || !varEditId) return;
    setBusyVarImg(true);
    try {
      const img = await articlesApi.variants.images.upload(id, varEditId, file, true);
      setVariants((prev) => prev.map((v) => {
        if (v.id !== varEditId) return v;
        return {
          ...v,
          imageUrl: img.url,
          images: [img, ...(v.images?.filter((i) => !i.isMain) ?? [])],
        };
      }));
    } catch (e: any) {
      toast.error(e?.message || "Error al subir imagen.");
    } finally {
      setBusyVarImg(false);
    }
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
    <div className="space-y-4 w-full">
      {/* ---- Header ---- */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="tp-btn-secondary h-9 w-9 !p-0 grid place-items-center shrink-0"
            title="Volver"
          >
            <ArrowLeft size={16} />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-text">
                {createMode ? "Nuevo artículo" : (article?.name ?? "Artículo")}
              </h1>
              {!createMode && article && (
                <>
                  <span className="font-mono text-xs text-muted border border-border rounded px-1.5 py-0.5">
                    {article.code}
                  </span>
                  <TPBadge
                    tone={
                      article.status === "ACTIVE"        ? "success"
                      : article.status === "DISCONTINUED" ? "warning"
                      : article.status === "ARCHIVED"     ? "danger"
                      : "neutral"
                    }
                    size="sm"
                  >
                    {ARTICLE_STATUS_LABELS[article.status]}
                  </TPBadge>
                  {article.isFavorite && (
                    <Star size={14} className="fill-yellow-400 text-yellow-400" />
                  )}
                </>
              )}
            </div>
            {!createMode && article?.category && (
              <div className="text-xs text-muted mt-0.5">{article.category.name}</div>
            )}
          </div>
        </div>

        {/* Edit action */}
        {!createMode && (
          <div className="flex items-center gap-2 shrink-0">
            <TPButton
              variant="primary"
              iconLeft={<Pencil size={14} />}
              onClick={() => setEditModalOpen(true)}
            >
              Editar
            </TPButton>
          </div>
        )}
      </div>

      {/* ---- Tabs ---- */}
      {!createMode && (
        <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
          {TABS.map((tab) => {
            // Solo mostrar stock si stockMode = BY_ARTICLE
            if (tab.key === "stock" && article?.stockMode !== "BY_ARTICLE") return null;
            // Solo mostrar variantes si la categoría tiene ejes de variante O el artículo ya tiene variantes
            // (null = cargando → visible para evitar parpadeo; false + sin variantes → oculto)
            if (tab.key === "variants" && categoryHasVariantAxes === false && variants.length === 0) return null;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={`
                  flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors
                  ${activeTab === tab.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted hover:text-text hover:border-border"}
                `}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ============================
          TAB: GENERAL
      ============================ */}
      {(activeTab === "general" || createMode) && (
        <div className="space-y-4">

          {/* ── Vista modo existente ── */}
          {!createMode && article && (
            <>
              {/* ── Encabezado: imagen + identidad ── */}
              <div className="flex items-start gap-4">
                {/* Imagen principal pequeña */}
                <div className="shrink-0">
                  <div className="h-16 w-16 rounded-xl overflow-hidden border border-border bg-surface2 flex items-center justify-center">
                    {(() => {
                      const mainImg = images.find((i) => i.isMain) ?? images[0];
                      return mainImg
                        ? <img src={mainImg.url} alt={article.name} className="w-full h-full object-cover" />
                        : <Package size={24} className="text-muted/30" />;
                    })()}
                  </div>
                </div>
                {/* Identidad */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <span className="text-lg font-semibold text-text leading-tight">{article.name}</span>
                    {article.isFavorite && <Star size={13} className="fill-yellow-400 text-yellow-400 mt-1 shrink-0" />}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="font-mono text-[11px] border border-border rounded px-1.5 py-0.5 text-muted">{article.code}</span>
                    <TPBadge tone={article.status === "ACTIVE" ? "success" : article.status === "DISCONTINUED" ? "warning" : article.status === "ARCHIVED" ? "danger" : "neutral"}>
                      {ARTICLE_STATUS_LABELS[article.status]}
                    </TPBadge>
                    <TPBadge tone={ARTICLE_TYPE_TONES[article.articleType]}>
                      {ARTICLE_TYPE_LABELS[article.articleType]}
                    </TPBadge>
                    {article.category && <span className="text-xs text-muted">{article.category.name}</span>}
                  </div>
                  {article.description && (
                    <p className="text-xs text-muted mt-1 line-clamp-2">{article.description}</p>
                  )}
                </div>
                {/* Fotos */}
                <div className="shrink-0 flex flex-col gap-1 items-end">
                  <TPButton variant="secondary" onClick={() => imgInputRef.current?.click()} disabled={busyImg} className="text-xs">
                    {busyImg ? "Subiendo…" : "+ Foto"}
                  </TPButton>
                  {images.length > 1 && (
                    <div className="flex gap-1">
                      {images.slice(0, 4).map((img) => (
                        <button key={img.id} type="button" onClick={() => void setMainImage(img.id)} title="Establecer como principal">
                          <img src={img.url} className={cn("h-7 w-7 rounded object-cover border transition", img.isMain ? "border-primary ring-1 ring-primary/40" : "border-border")} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input ref={imgInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImageUpload(f); e.target.value = ""; }} />
              </div>

              {/* ── Datos: tabla de clave/valor ── */}
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border">
                    {[
                      article.sku               && { label: "SKU",                value: article.sku },
                      article.barcode           && { label: "Código de barras",   value: article.barcode },
                      article.unitOfMeasure     && { label: "Unidad de medida",   value: article.unitOfMeasure },
                      article.brand             && { label: "Marca",              value: article.brand },
                      article.manufacturer      && { label: "Fabricante",         value: article.manufacturer },
                      article.preferredSupplier && { label: "Proveedor preferido",value: article.preferredSupplier.displayName },
                      (article as any).supplierCode && { label: "Cód. proveedor", value: (article as any).supplierCode },
                      article.reorderPoint != null && { label: "Punto de reposición", value: `${article.reorderPoint} u.` },
                      article.hechuraPrice != null  && { label: "Hechura",          value: fmtMoney(article.hechuraPrice) },
                      article.mermaPercent != null  && { label: "Merma",            value: `${article.mermaPercent}%` },
                      { label: "Modo stock",     value: STOCK_MODE_LABELS[article.stockMode] },
                      { label: "Modo hechura",   value: HECHURA_MODE_LABELS[article.hechuraPriceMode] },
                    ].filter(Boolean).map((row: any) => (
                      <tr key={row.label} className="hover:bg-surface2/30">
                        <td className="px-4 py-2.5 text-xs font-medium text-muted w-40 shrink-0">{row.label}</td>
                        <td className="px-4 py-2.5 text-xs text-text">{row.value}</td>
                      </tr>
                    ))}
                    {/* Flags en una fila */}
                    <tr className="hover:bg-surface2/30">
                      <td className="px-4 py-2.5 text-xs font-medium text-muted">Opciones</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { label: "Sin variantes",   value: article.sellWithoutVariants },
                            { label: "En tienda",       value: article.showInStore },
                            { label: "Retornable",      value: article.isReturnable },
                          ].map(({ label, value }) => (
                            <TPBadge key={label} tone={value ? "success" : "neutral"} size="sm">
                              {label}: {value ? "Sí" : "No"}
                            </TPBadge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Hint: variantes no disponibles en esta categoría */}
              {categoryHasVariantAxes === false && variants.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-muted border border-border rounded-lg px-3 py-2 bg-surface2/40">
                  <Info size={12} className="shrink-0" />
                  Esta categoría no tiene variantes configuradas. Para habilitar variantes, agregá ejes de variante en la configuración de categorías.
                </div>
              )}

              {/* Notas internas */}
              {(article as any).notes && (
                <TPCard title="Notas internas">
                  <p className="text-sm text-text whitespace-pre-wrap">{(article as any).notes}</p>
                </TPCard>
              )}

              {/* Atributos */}
              {attributes.length > 0 && (
                <TPCard title="Atributos">
                  <div className="space-y-1">
                    {attributes.map((av) => (
                      <div key={av.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                        <div className="text-xs font-medium text-muted">
                          {av.assignment.definition.name}
                          {av.assignment.isRequired && <span className="ml-1 text-red-400">*</span>}
                        </div>
                        <div className="text-sm text-text">{av.value || "—"}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-muted">Los atributos se editan en la pantalla de categorías.</div>
                </TPCard>
              )}
            </>
          )}

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

      {/* ============================
          TAB: COSTOS
      ============================ */}
      {activeTab === "costos" && !createMode && article && (() => {
        // ── Datos del artículo ──
        const costMode     = (article as any).costCalculationMode as string | undefined ?? "MANUAL";
        const computed     = (article as any).computedCostPrice as {
          value: string | null; mode: string; partial: boolean;
          metalCost?: string | null; hechuraCost?: string | null; totalGrams?: string | null;
        } | undefined;
        const costPrice    = computed?.value != null ? parseFloat(computed.value) : null;

        // Multiplier
        const multiplierBase  = (article as any).multiplierBase  as string | undefined;
        const multiplierValue = (article as any).multiplierValue != null ? parseFloat((article as any).multiplierValue) : null;
        const multiplierQty   = (article as any).multiplierQuantity != null ? parseFloat((article as any).multiplierQuantity) : null;

        // Manual cost params
        const manualBaseCost = (article as any).manualBaseCost != null ? parseFloat((article as any).manualBaseCost) : null;
        const manualAdjKind  = ((article as any).manualAdjustmentKind  as string | undefined) ?? "";
        const manualAdjType  = ((article as any).manualAdjustmentType  as string | undefined) ?? "";
        const manualAdjValue = (article as any).manualAdjustmentValue != null ? parseFloat((article as any).manualAdjustmentValue) : null;
        const manualTaxIds   = ((article as any).manualTaxIds as string[] | undefined) ?? [];

        // Cost lines
        type CostLineView = {
          type: string; label: string; quantity: string; unitValue: string;
          mermaPercent: string | null;
          metalVariant?: { name: string; purity: string; metal: { name: string } } | null;
          currency?: { code: string } | null;
        };
        const costLines = (article as any).costComposition as CostLineView[] | undefined ?? [];

        // ── Compute adjustment ──
        const rawBase   = manualBaseCost ?? 0;
        const adjAbsVal = Math.abs(manualAdjValue ?? 0);
        const adjSign   = manualAdjKind === "" ? 0 : manualAdjKind === "SURCHARGE" ? 1 : -1;
        const adjAmount = adjSign !== 0
          ? adjSign * (manualAdjType === "PERCENTAGE" ? rawBase * (adjAbsVal / 100) : adjAbsVal)
          : 0;
        const adjustedBase = costMode === "MANUAL" && manualBaseCost != null ? rawBase + adjAmount : null;

        // ── Taxes (reference only, NOT added to costPrice) ──
        const selectedTaxes = taxes.filter(t => manualTaxIds.includes(t.id));
        const taxRows = selectedTaxes.map(t => {
          const base = adjustedBase ?? costPrice ?? 0;
          const rate = t.rate != null ? parseFloat(t.rate) : 0;
          const amt  = t.calculationType === "PERCENTAGE" ? base * (rate / 100)
                     : t.fixedAmount != null ? parseFloat(t.fixedAmount) : 0;
          return { ...t, computedAmt: amt };
        });
        const totalTaxAmt = taxRows.reduce((s, r) => s + r.computedAmt, 0);

        // ── Cost lines grouped by type ──
        function subtotalForType(type: string) {
          return costLines
            .filter(l => l.type === type)
            .reduce((s, l) => {
              const merma = l.mermaPercent != null ? parseFloat(l.mermaPercent) : 0;
              return s + parseFloat(l.quantity) * parseFloat(l.unitValue) * (1 + merma / 100);
            }, 0);
        }
        const metalSubtotal   = subtotalForType("METAL");
        const hechuraSubtotal = subtotalForType("HECHURA");
        const productSubtotal = subtotalForType("PRODUCT");
        const serviceSubtotal = subtotalForType("SERVICE");

        function fmtN(n: number) {
          return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }

        // ── tipo de unidad por tipo de línea ──
        const hechuraMode = article.hechuraPriceMode;
        function unitForLine(type: string) {
          if (type === "METAL")   return "g";
          if (type === "HECHURA") return hechuraMode === "PER_GRAM" ? "g" : "pz";
          return "ud";
        }

        const compositionTotal = metalSubtotal + hechuraSubtotal + productSubtotal + serviceSubtotal;
        const typeCfg: Record<string, { label: string; tone: "neutral" | "primary" | "success" | "warning" | "info" }> = {
          METAL:   { label: "Metal",    tone: "primary"  },
          HECHURA: { label: "Hechura",  tone: "info"     },
          PRODUCT: { label: "Producto", tone: "success"  },
          SERVICE: { label: "Servicio", tone: "warning"  },
          MANUAL:  { label: "Manual",   tone: "neutral"  },
        };

        return (
          <div className="space-y-3">

            {/* ── Modo de cálculo — línea discreta ── */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <Calculator size={12} className="text-muted shrink-0" />
              <span className="font-medium text-text">
                {COST_MODE_LABELS[costMode as keyof typeof COST_MODE_LABELS] ?? costMode}
              </span>
              <span className="text-border">·</span>
              <span className="text-muted">
                {costMode === "MANUAL"              && "Costo ingresado manualmente con ajuste e impuestos de referencia."}
                {costMode === "MULTIPLIER"          && `Cantidad × valor unitario${multiplierBase ? ` (base: ${multiplierBase.toLowerCase()})` : ""}.`}
                {costMode === "METAL_MERMA_HECHURA" && "Composición por líneas de metal, hechura, productos y servicios."}
              </span>
              {computed?.partial && (
                <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">
                  <AlertCircle size={10} />
                  Estimación parcial
                </span>
              )}
              <button
                type="button"
                onClick={() => void refreshCostData()}
                disabled={refreshingCostos}
                className="ml-auto flex items-center gap-1 text-[11px] text-muted hover:text-text transition disabled:opacity-50"
                title="Recalcular costos desde el servidor"
              >
                <RefreshCw size={11} className={refreshingCostos ? "animate-spin" : ""} />
                {refreshingCostos ? "Actualizando…" : "Recalcular"}
              </button>
            </div>

            {/* ── Tabla principal de composición ── */}
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface2/60 border-b border-border">
                    <th className="text-left px-3 py-2 font-medium text-muted">Componente</th>
                    <th className="text-left px-3 py-2 font-medium text-muted">Tipo</th>
                    <th className="text-right px-3 py-2 font-medium text-muted">Cantidad</th>
                    <th className="text-left px-3 py-2 font-medium text-muted">Unidad</th>
                    <th className="text-right px-3 py-2 font-medium text-muted">Precio unit.</th>
                    <th className="text-right px-3 py-2 font-medium text-muted">Merma</th>
                    <th className="text-right px-3 py-2 font-medium text-muted">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">

                  {/* METAL_MERMA_HECHURA: una fila por línea */}
                  {costMode === "METAL_MERMA_HECHURA" && costLines.map((line, i) => {
                    const qty      = parseFloat(line.quantity);
                    const uv       = parseFloat(line.unitValue);
                    const merma    = line.mermaPercent != null ? parseFloat(line.mermaPercent) : 0;
                    const subtotal = qty * uv * (1 + merma / 100);
                    const tc = typeCfg[line.type] ?? { label: line.type, tone: "neutral" as const };
                    return (
                      <tr key={i} className="hover:bg-surface2/20 transition-colors">
                        <td className="px-3 py-2 font-medium text-text">
                          {line.metalVariant
                            ? `${line.metalVariant.metal.name} ${line.metalVariant.name}`
                            : line.label}
                          {line.currency && (
                            <span className="ml-1 text-[10px] text-muted">({line.currency.code})</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <TPBadge tone={tc.tone} size="sm">{tc.label}</TPBadge>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-text/80">{fmtN(qty)}</td>
                        <td className="px-3 py-2 text-muted">{unitForLine(line.type)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-text/80">{fmtMoney(uv)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-text/80">{merma > 0 ? `${merma}%` : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-text">{fmtMoney(subtotal)}</td>
                      </tr>
                    );
                  })}

                  {/* MULTIPLIER: fila única */}
                  {costMode === "MULTIPLIER" && (
                    <tr className="hover:bg-surface2/20 transition-colors">
                      <td className="px-3 py-2 font-medium text-text">Multiplicador</td>
                      <td className="px-3 py-2">
                        <TPBadge tone="info" size="sm">Multiplicador</TPBadge>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-text/80">
                        {multiplierQty != null ? fmtN(multiplierQty) : "—"}
                      </td>
                      <td className="px-3 py-2 text-muted">
                        {multiplierBase === "GRAMS" ? "g" : multiplierBase === "KILATES" ? "k" : multiplierBase === "UNITS" ? "ud" : (multiplierBase ?? "—")}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-text/80">
                        {multiplierValue != null ? fmtMoney(multiplierValue) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-muted">—</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-text">
                        {costPrice != null ? fmtMoney(costPrice) : "—"}
                      </td>
                    </tr>
                  )}

                  {/* MANUAL: fila única */}
                  {costMode === "MANUAL" && (
                    <tr className="hover:bg-surface2/20 transition-colors">
                      <td className="px-3 py-2 font-medium text-text">Costo base</td>
                      <td className="px-3 py-2">
                        <TPBadge tone="neutral" size="sm">Manual</TPBadge>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-text/80">1</td>
                      <td className="px-3 py-2 text-muted">ud</td>
                      <td className="px-3 py-2 text-right tabular-nums text-text/80">
                        {manualBaseCost != null ? fmtMoney(manualBaseCost) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-muted">—</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-text">
                        {manualBaseCost != null ? fmtMoney(manualBaseCost) : "—"}
                      </td>
                    </tr>
                  )}

                  {/* Estado vacío para METAL_MERMA_HECHURA sin líneas */}
                  {costMode === "METAL_MERMA_HECHURA" && costLines.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-muted">
                        Sin líneas de composición — editá el artículo para agregar componentes.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  {/* Subtotal composición (METAL_MERMA_HECHURA con múltiples líneas) */}
                  {costMode === "METAL_MERMA_HECHURA" && costLines.length > 1 && (
                    <tr className="border-t border-border bg-surface2/30">
                      <td colSpan={6} className="px-3 py-2 text-xs font-medium text-muted text-right">
                        Subtotal composición
                        {computed?.totalGrams != null && (
                          <span className="ml-2 text-[10px] font-normal">
                            · {parseFloat(computed.totalGrams).toLocaleString("es-AR", { minimumFractionDigits: 2 })} g totales
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold text-text">
                        {fmtMoney(compositionTotal)}
                      </td>
                    </tr>
                  )}
                  {/* Costo base (MANUAL con ajuste) */}
                  {costMode === "MANUAL" && manualBaseCost != null && adjAmount !== 0 && (
                    <tr className="border-t border-border/40">
                      <td colSpan={6} className="px-3 py-2 text-xs text-muted text-right">Costo base</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted">{fmtMoney(rawBase)}</td>
                    </tr>
                  )}
                  {/* Ajuste: bonificación o recargo */}
                  {manualAdjKind !== "" && adjAmount !== 0 && (
                    <tr className="border-t border-border/40">
                      <td colSpan={6} className="px-3 py-2 text-xs text-muted text-right">
                        {manualAdjKind === "BONUS" ? "Bonificación" : "Recargo"}
                        <span className="ml-1 text-[10px] opacity-70">
                          ({manualAdjType === "PERCENTAGE" ? `${Math.abs(manualAdjValue ?? 0)}%` : "fijo"})
                        </span>
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums font-medium ${adjSign < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                        {adjSign < 0 ? "−" : "+"}{fmtMoney(Math.abs(adjAmount))}
                      </td>
                    </tr>
                  )}
                  {/* Impuestos de referencia (no afectan costo) */}
                  {taxRows.map(t => (
                    <tr key={t.id} className="border-t border-border/30">
                      <td colSpan={6} className="px-3 py-2 text-xs text-muted text-right">
                        {t.name}
                        <span className="ml-1 text-[10px] opacity-60">({t.calculationType === "PERCENTAGE" ? `${t.rate}%` : "fijo"}, ref.)</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted">+{fmtMoney(t.computedAmt)}</td>
                    </tr>
                  ))}
                  {/* Costo registrado — siempre al final */}
                  <tr className="border-t-2 border-border bg-primary/5">
                    <td colSpan={6} className="px-3 py-3 text-xs font-semibold text-text text-right">Costo registrado</td>
                    <td className="px-3 py-3 text-right tabular-nums text-base font-bold text-text">
                      {costPrice != null ? fmtMoney(costPrice) : "—"}
                    </td>
                  </tr>
                  {/* Con impuestos (referencial) */}
                  {taxRows.length > 0 && costPrice != null && (
                    <tr className="border-t border-border/30 bg-surface2/40">
                      <td colSpan={6} className="px-3 py-2 text-xs text-muted text-right">Con impuestos (ref.)</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs font-semibold text-text">
                        {fmtMoney(costPrice + totalTaxAmt)}
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ============================
          TAB: VARIANTES
      ============================ */}
      {activeTab === "variants" && !createMode && (
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">
              {variants.length === 0
                ? "Sin variantes — para crear usá el botón Editar."
                : `${variants.length} variante${variants.length !== 1 ? "s" : ""}`}
            </p>
          </div>

          {variantsLoading && <div className="text-sm text-muted">Cargando…</div>}

          {!variantsLoading && variants.length === 0 && (
            <div className="rounded-xl border border-border border-dashed bg-card p-8 text-center text-sm text-muted">
              Para agregar variantes, usá el botón <strong>Editar</strong> del artículo.
            </div>
          )}

          {variants.map((v) => {
            // Prioridad: 1) galería propia  2) imageUrl legacy  3) fallback artículo padre
            const ownImg = v.images?.find((i) => i.isMain)?.url
              ?? v.images?.[0]?.url
              ?? (v.imageUrl || null);
            const articleImg = images.find((i) => i.isMain)?.url ?? images[0]?.url ?? null;
            const imgSrc = ownImg ?? articleImg;
            const isFallback = !ownImg && !!imgSrc;

            return (
              <div
                key={v.id}
                className={cn(
                  "flex items-start gap-3 rounded-xl border bg-card px-4 py-3",
                  v.isActive ? "border-border" : "border-border opacity-60"
                )}
              >
                {/* Imagen */}
                <div className="shrink-0 mt-0.5">
                  {imgSrc ? (
                    <img
                      src={imgSrc}
                      alt={v.name}
                      title={isFallback ? "Imagen del artículo padre" : undefined}
                      className={cn(
                        "w-12 h-12 rounded-lg object-cover border border-border",
                        isFallback && "opacity-40"
                      )}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-surface2 border border-border flex items-center justify-center">
                      <Layers size={18} className="text-muted/30" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {/* Nombre + código + estado */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-text">{v.name}</span>
                    <span className="font-mono text-[10px] text-muted bg-surface2 rounded px-1.5 py-0.5">
                      {v.code}
                    </span>
                    <TPActiveBadge active={v.isActive} size="sm" />
                  </div>

                  {/* SKU · barcode · peso · precio fijo */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted">
                    {v.sku && (
                      <span>SKU: <span className="font-mono text-text/70">{v.sku}</span></span>
                    )}
                    {v.barcode && (
                      <span className="flex items-center gap-1">
                        <ScanBarcode size={10} />
                        <span className="font-mono text-text/70">{v.barcode}</span>
                      </span>
                    )}
                    {v.weightOverride != null && (
                      <span>Peso: <span className="text-text/70">{v.weightOverride}g</span></span>
                    )}
                    {v.priceOverride != null && (
                      <span>Precio fijo: <span className="text-text/70 tabular-nums">{fmtMoney(v.priceOverride)}</span></span>
                    )}
                  </div>

                  {/* Punto de reposición + atributos */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted">
                    <span>
                      Repos.:{" "}
                      {v.reorderPoint != null && Number(v.reorderPoint) > 0
                        ? <span className="text-text/70 tabular-nums">{v.reorderPoint}</span>
                        : <span className="text-muted/50">Sin definir</span>}
                    </span>
                    {Array.isArray(v.attributeValues) && v.attributeValues.length > 0 && (
                      <span className="text-muted/60 truncate max-w-xs">
                        {(v.attributeValues as any[]).map((av) => av.value).join(" · ")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Acciones */}
                <div className="shrink-0">
                  <TPActionsMenu
                    title="Acciones de variante"
                    items={[
                      { label: "Editar identificación", icon: <Pencil size={13} />, onClick: () => openEditVariant(v) },
                      { type: "separator" },
                      {
                        label: v.isActive ? "Desactivar" : "Activar",
                        icon: v.isActive ? <PowerOff size={13} /> : <Power size={13} />,
                        onClick: () => void toggleVariant(v),
                      },
                      { label: "Eliminar", icon: <Trash2 size={13} />, onClick: () => setConfirmDeleteVarId(v.id), disabled: removingVar === v.id },
                    ]}
                  />
                </div>
              </div>
            );
          })}

          {/* ── Modal: editar identificación de variante ── */}
          {varModal && varEditId && (() => {
            const editingVar = variants.find((v) => v.id === varEditId);
            const ownImg = editingVar?.images?.find((i) => i.isMain)?.url
              ?? editingVar?.images?.[0]?.url
              ?? (editingVar?.imageUrl || null);
            const imgSrc = ownImg ?? (images.find((i) => i.isMain)?.url ?? images[0]?.url ?? null);
            const isFallback = !ownImg && !!imgSrc;

            return (
              <div className="fixed inset-0 z-50">
                <div className="absolute inset-0 bg-black/50" onClick={() => setVarModal(false)} />
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-xl">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-border px-5 py-4">
                      <div className="text-sm font-semibold text-text">Editar variante</div>
                      <TPButton variant="ghost" onClick={() => setVarModal(false)} className="h-8 w-8 !p-0">
                        <X size={14} />
                      </TPButton>
                    </div>

                    {/* Body */}
                    <div className="p-5 space-y-4">
                      {/* Imagen */}
                      <div className="flex items-center gap-4">
                        <div className="shrink-0">
                          {imgSrc ? (
                            <img
                              src={imgSrc}
                              alt="Imagen variante"
                              title={isFallback ? "Imagen del artículo padre" : undefined}
                              className={cn(
                                "w-20 h-20 rounded-xl object-cover border border-border",
                                isFallback && "opacity-40"
                              )}
                            />
                          ) : (
                            <div className="w-20 h-20 rounded-xl bg-surface2 border border-dashed border-border flex items-center justify-center">
                              <Layers size={24} className="text-muted/30" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <p className="text-xs text-muted">
                            {isFallback ? "Usando imagen del artículo padre" : ownImg ? "Imagen propia" : "Sin imagen"}
                          </p>
                          <TPButton
                            variant="secondary"
                            onClick={() => varImgRef.current?.click()}
                            disabled={busyVarImg}
                            className="text-xs"
                          >
                            {busyVarImg ? "Subiendo…" : ownImg ? "Cambiar foto" : "+ Subir foto"}
                          </TPButton>
                          <input
                            ref={varImgRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) void handleVarImgUpload(file);
                              e.target.value = "";
                            }}
                          />
                        </div>
                      </div>

                      {/* Código (sólo lectura) */}
                      <div>
                        <div className="text-xs text-muted mb-1">Código</div>
                        <div className="font-mono text-sm text-muted bg-surface2 border border-border rounded-lg px-3 py-2">
                          {varDraft.code}
                        </div>
                      </div>

                      {/* SKU */}
                      <TPField label="SKU">
                        <TPInput
                          value={varDraft.sku}
                          onChange={(val) => setVarDraft((p) => ({ ...p, sku: val }))}
                          placeholder="Código SKU"
                        />
                      </TPField>

                      {/* Nombre */}
                      <TPField label="Nombre *">
                        <TPInput
                          value={varDraft.name}
                          onChange={(val) => setVarDraft((p) => ({ ...p, name: val }))}
                          placeholder="Ej: Talla 18"
                        />
                      </TPField>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
                      <TPButton variant="ghost" onClick={() => setVarModal(false)}>Cancelar</TPButton>
                      <TPButton
                        onClick={saveVariant}
                        disabled={busyVar || !varDraft.name.trim()}
                      >
                        {busyVar ? "Guardando…" : "Guardar"}
                      </TPButton>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Confirm eliminar variante ── */}
          <ConfirmDeleteDialog
            open={confirmDeleteVarId !== null}
            title="Eliminar variante"
            description={`¿Eliminás la variante "${variants.find(v => v.id === confirmDeleteVarId)?.name ?? ""}"? Esta acción no se puede deshacer.`}
            busy={removingVar === confirmDeleteVarId}
            onClose={() => setConfirmDeleteVarId(null)}
            onConfirm={async () => {
              if (!confirmDeleteVarId) return;
              await removeVariant(confirmDeleteVarId);
              setConfirmDeleteVarId(null);
            }}
          />
        </div>
      )}

      {/* ============================
          TAB: STOCK
      ============================ */}
      {activeTab === "stock" && !createMode && article?.stockMode === "BY_ARTICLE" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted">Stock por almacén y variante.</div>
            <TPButton onClick={() => { setStockWarehouseId(""); setStockVariantId(null); setStockQty(null); setStockModal(true); }}>
              Ajustar stock
            </TPButton>
          </div>

          {stockLoading && <div className="text-sm text-muted">Cargando…</div>}

          {!stockLoading && stock.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted">
              Sin movimientos de stock registrados.
            </div>
          )}

          {stock.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
            >
              <div>
                <div className="text-sm font-medium text-text">{s.warehouse.name}</div>
                <div className="text-xs text-muted">
                  {s.warehouse.code}
                  {s.variant && ` · ${s.variant.name}`}
                </div>
              </div>
              <div className="text-lg font-bold text-text">{s.quantity}</div>
            </div>
          ))}

          {/* Stock adjust modal */}
          {stockModal && (
            <div className="fixed inset-0 z-50">
              <div className="absolute inset-0 bg-black/50" onClick={() => setStockModal(false)} />
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-xl">
                  <div className="flex items-center justify-between border-b border-border px-5 py-4">
                    <div className="text-sm font-semibold text-text">Ajustar stock</div>
                    <button type="button" onClick={() => setStockModal(false)} className="tp-btn-secondary h-8 w-8 !p-0 grid place-items-center">
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
        </div>
      )}

      {/* ============================
          TAB: VENTAS
      ============================ */}
      {activeTab === "ventas" && !createMode && (() => {
        function fmtN(n: number) {
          return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }

        const spr     = salePriceResolution;
        const src     = spr?.priceSource;
        const spPrice = spr?.unitPrice != null ? parseFloat(spr.unitPrice) : null;
        const basePrc = spr?.basePrice  != null ? parseFloat(spr.basePrice)  : null;
        const discAmt = spr?.discountAmount != null ? parseFloat(spr.discountAmount) : 0;

        // Aplanar tramos de todas las reglas para obtener el umbral mínimo global
        const allTiers = articleDiscounts.flatMap((d) =>
          (d.tiers ?? []).map((t) => ({ ...t, ruleId: d.id, isActive: d.isActive }))
        );
        const minDiscount = allTiers.length > 0
          ? allTiers.reduce((min, t) => parseFloat(t.minQty) < parseFloat(min.minQty) ? t : min, allTiers[0])
          : null;

        type RuleStatus = "aplica" | "no-aplica" | "disponible" | "descartada";
        const STATUS_CFG: Record<RuleStatus, { label: string }> = {
          "aplica":    { label: "✓ Aplica" },
          "disponible":{ label: "◎ Disponible" },
          "descartada":{ label: "↷ Descartada" },
          "no-aplica": { label: "— No aplica" },
        };
        const listStatus: RuleStatus =
          spr?.appliedPriceListId                                    ? "aplica"
          : src === "MANUAL_OVERRIDE"                                ? "descartada"
          : src != null && src !== "NONE" && src !== "MANUAL_FALLBACK" ? "disponible"
          : "no-aplica";
        const promoStatus: RuleStatus =
          spr?.appliedPromotionId   ? "aplica"
          : articlePromos.length > 0 ? "disponible"
          : "no-aplica";
        const discountStatus: RuleStatus =
          spr?.appliedDiscountId                              ? "aplica"
          : src === "PROMOTION" && articleDiscounts.length > 0 ? "descartada"
          : articleDiscounts.length > 0                         ? "disponible"
          : "no-aplica";

        const PRICE_SOURCE_LABELS: Record<string, string> = {
          PROMOTION:         "Promoción activa",
          MANUAL_OVERRIDE:   "Precio fijo manual",
          QUANTITY_DISCOUNT: "Descuento por cantidad",
          PRICE_LIST:        "Lista de precios",
          MANUAL_FALLBACK:   "Precio de referencia",
          NONE:              "Sin precio definido",
        };

        const SCOPE_LABELS: Record<string, string> = {
          GENERAL: "General", CATEGORY: "Por categoría", CHANNEL: "Por canal", CLIENT: "Por cliente",
        };

        const traceSteps: { label: string; value: string; highlight?: boolean; isDiscount?: boolean }[] = [];
        if (basePrc != null) traceSteps.push({ label: spr?.appliedPriceListName ? `Lista: ${spr.appliedPriceListName}` : "Precio base", value: fmtN(basePrc) });
        if (discAmt > 0) traceSteps.push({ label: spr?.appliedPromotionId ? (spr.appliedPromotionName ?? "Promoción") : "Desc. cantidad", value: `−${fmtN(discAmt)}`, isDiscount: true });
        if (spPrice != null) traceSteps.push({ label: "Precio final", value: fmtN(spPrice), highlight: true });

        const allActiveLists = priceLists.filter(l => l.isActive);

        // ── Precio simulado con lista seleccionada (client-side) ──
        const simList = simPriceListId ? allActiveLists.find(l => l.id === simPriceListId) : null;
        const computedForSim = (article as any).computedCostPrice as { value: string | null; metalCost?: string | null; hechuraCost?: string | null } | undefined;
        const costPriceForSim = computedForSim?.value != null ? parseFloat(computedForSim.value) : null;
        function calcListPrice(pl: PriceListRow): number | null {
          if (costPriceForSim == null) return null;
          const mode = pl.mode;
          if (mode === "MARGIN_TOTAL") {
            const m = (pl as any).marginTotal != null ? parseFloat((pl as any).marginTotal) : 0;
            return costPriceForSim * (1 + m / 100);
          }
          if (mode === "METAL_HECHURA") {
            const metalCost = computedForSim?.metalCost != null ? parseFloat(computedForSim.metalCost) : costPriceForSim;
            const hechuraCost = computedForSim?.hechuraCost != null ? parseFloat(computedForSim.hechuraCost) : 0;
            const mM = (pl as any).marginMetal != null ? parseFloat((pl as any).marginMetal) : 0;
            const mH = (pl as any).marginHechura != null ? parseFloat((pl as any).marginHechura) : 0;
            return metalCost * (1 + mM / 100) + hechuraCost * (1 + mH / 100);
          }
          return null;
        }
        const simListPrice = simList ? calcListPrice(simList) : null;

        return (
          <div className="space-y-4">

            {/* ══ CARD: Precio aplicado (destacado) ══ */}
            <TPCard
              title="Precio de venta"
              right={
                loadingSalePrice
                  ? <Loader2 size={12} className="animate-spin text-muted" />
                  : <button
                      type="button"
                      onClick={() => id && void loadSalePrice(id, simQty, simClientId)}
                      className="h-6 w-6 rounded grid place-items-center hover:bg-surface2 text-muted hover:text-text transition"
                      title="Recalcular"
                    >
                      <RefreshCw size={12} />
                    </button>
              }
            >
              <div className={`rounded-2xl border-2 px-6 py-7 text-center transition ${spPrice != null && !loadingSalePrice ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-card"}`}>
                {spr && !loadingSalePrice && (
                  <div className="mb-3">
                    <TPBadge
                      tone={
                        src === "PROMOTION"         ? "warning"
                        : src === "MANUAL_OVERRIDE"   ? "primary"
                        : src === "QUANTITY_DISCOUNT" ? "info"
                        : src === "PRICE_LIST"        ? "success"
                        : "neutral"
                      }
                    >
                      {PRICE_SOURCE_LABELS[spr.priceSource] ?? spr.priceSource}
                    </TPBadge>
                  </div>
                )}
                <div className="text-5xl md:text-6xl font-light tracking-tight tabular-nums text-text">
                  {loadingSalePrice
                    ? <Loader2 size={32} className="animate-spin text-muted mx-auto" />
                    : spPrice != null ? fmtMoney(spPrice)
                    : <span className="text-muted text-2xl font-normal">Sin precio definido</span>
                  }
                </div>
                <div className="mt-2 text-xs text-muted">
                  {!loadingSalePrice && (
                    spr?.partial
                      ? "⚠ Estimación parcial — puede variar con datos reales"
                      : spr
                        ? `Contexto: ${simQty} unidad${simQty !== 1 ? "es" : ""}${simClientId ? " · cliente seleccionado" : ""}`
                        : "El precio se calcula según las reglas comerciales activas"
                  )}
                </div>
              </div>

              {traceSteps.length > 1 && !loadingSalePrice && (
                <div className="mt-4">
                  <div className="text-xs font-medium text-muted mb-2 uppercase tracking-wide">Paso a paso</div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {traceSteps.map((step, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && <span className="text-muted text-xs">→</span>}
                        <div className={`flex flex-col items-center px-3 py-1.5 rounded-xl border text-xs ${step.highlight ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : step.isDiscount ? "border-rose-500/20 bg-rose-500/8 text-rose-600 dark:text-rose-400" : "border-border bg-surface2/40 text-muted"}`}>
                          <span className="text-[10px] font-medium opacity-70">{step.label}</span>
                          <span className={`font-semibold tabular-nums ${step.highlight ? "text-sm" : ""}`}>{step.value}</span>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              {spr?.partial && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                  <AlertCircle size={12} className="shrink-0" />
                  Estimación parcial — puede faltar configuración de cotizaciones o listas de precios.
                </div>
              )}

              {/* Simular con lista de precios */}
              {allActiveLists.length > 0 && (
                <div className="mt-4 flex items-center gap-3 flex-wrap border-t border-border pt-3">
                  <span className="text-xs text-muted shrink-0">Simular con lista:</span>
                  <div className="flex-1 min-w-[160px] max-w-xs">
                    <TPComboFixed
                      value={simPriceListId}
                      onChange={(v) => setSimPriceListId(v)}
                      options={[
                        { value: "", label: "— Auto (reglas activas)" },
                        ...allActiveLists.map(l => ({ value: l.id, label: l.name })),
                      ]}
                    />
                  </div>
                  {simListPrice != null && (
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-primary tabular-nums">
                      <Tag size={13} />
                      {fmtMoney(simListPrice)}
                    </div>
                  )}
                  {simList && simListPrice == null && (
                    <span className="text-xs text-muted">Sin costo base para calcular</span>
                  )}
                </div>
              )}
            </TPCard>

            {/* ══ GRID: Promoción + Descuentos ══ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Promoción */}
              <TPCard
                title="Promoción"
                right={
                  <TPBadge tone={promoStatus === "aplica" ? "warning" : promoStatus === "disponible" ? "warning" : "neutral"} size="sm">
                    {STATUS_CFG[promoStatus].label}
                  </TPBadge>
                }
              >
                {articlePromos.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <Gem size={22} className="text-muted/50" />
                    <p className="text-sm text-muted">No hay promociones configuradas para este artículo.</p>
                    <TPButton variant="ghost" onClick={() => navigate("/configuracion-sistema/promociones")}>
                      Nueva promoción
                    </TPButton>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {promoStatus === "aplica" && spr?.appliedPromotionId && (
                      <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                        <Gem size={12} className="shrink-0" />
                        <span>Activa: <strong>{spr.appliedPromotionName ?? "Promoción"}</strong>{discAmt > 0 ? ` → −${fmtMoney(discAmt)}` : ""}</span>
                      </div>
                    )}
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-surface2/40">
                            <th className="text-left px-3 py-2 font-medium text-muted">Nombre</th>
                            <th className="text-right px-3 py-2 font-medium text-muted">Descuento</th>
                            <th className="text-center px-3 py-2 font-medium text-muted">Activa</th>
                          </tr>
                        </thead>
                        <tbody>
                          {articlePromos.map((p) => {
                            const isApplied = spr?.appliedPromotionId === p.id;
                            return (
                              <tr key={p.id} className={cn("border-b border-border last:border-0", isApplied && "bg-amber-500/5")}>
                                <td className="px-3 py-2 font-medium text-text">
                                  {p.name}
                                  {isApplied && <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold">● Aplica</span>}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-muted">
                                  {p.type === "PERCENTAGE" ? `${parseFloat(p.value)}%` : fmtMoney(p.value)}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <TPActiveBadge active={p.isActive} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex justify-end">
                      <TPButton variant="ghost" onClick={() => navigate("/configuracion-sistema/promociones")}>
                        Editar promoción
                      </TPButton>
                    </div>
                  </div>
                )}
              </TPCard>

              {/* Descuentos por cantidad */}
              <TPCard
                title="Descuentos por cantidad"
                right={
                  <TPBadge tone={discountStatus === "aplica" ? "info" : discountStatus === "disponible" ? "info" : "neutral"} size="sm">
                    {STATUS_CFG[discountStatus].label}
                  </TPBadge>
                }
              >
                {articleDiscounts.length === 0 ? (
                  <div className="space-y-4">
                    {/* Simulación embebida */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <TPField label="Cantidad" hint="Cambiá para ver si se activa algún descuento.">
                        <TPNumberInput
                          value={simQty}
                          onChange={(v) => {
                            const q = Math.max(1, Math.round(v ?? 1));
                            setSimQty(q);
                            if (simQtyDebounceRef.current) clearTimeout(simQtyDebounceRef.current);
                            simQtyDebounceRef.current = setTimeout(() => {
                              if (id) void loadSalePrice(id, q, simClientId);
                            }, 400);
                          }}
                          placeholder="1" min={1} decimals={0}
                        />
                      </TPField>
                      <TPField label="Cliente (opcional)">
                        <TPComboFixed
                          value={simClientId}
                          onChange={(v) => {
                            setSimClientId(v);
                            if (id) void loadSalePrice(id, simQty, v);
                            if (simClients.length === 0) void loadSimClients();
                          }}
                          options={[
                            { value: "", label: "Sin cliente" },
                            ...simClients.map(c => ({ value: c.id, label: c.displayName })),
                          ]}
                        />
                      </TPField>
                    </div>
                    <div className="flex flex-col items-center gap-3 py-2 text-center">
                      <Package size={22} className="text-muted/50" />
                      <p className="text-sm text-muted">No hay descuentos por cantidad configurados.</p>
                      <TPButton variant="ghost" onClick={() => navigate("/configuracion-sistema/descuentos-cantidad")}>
                        Crear descuento
                      </TPButton>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Simulación embebida */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <TPField label="Cantidad" hint="Desde cierta cantidad se activan descuentos automáticos.">
                        <TPNumberInput
                          value={simQty}
                          onChange={(v) => {
                            const q = Math.max(1, Math.round(v ?? 1));
                            setSimQty(q);
                            if (simQtyDebounceRef.current) clearTimeout(simQtyDebounceRef.current);
                            simQtyDebounceRef.current = setTimeout(() => {
                              if (id) void loadSalePrice(id, q, simClientId);
                            }, 400);
                          }}
                          placeholder="1" min={1} decimals={0}
                        />
                      </TPField>
                      <TPField label="Cliente (opcional)">
                        <TPComboFixed
                          value={simClientId}
                          onChange={(v) => {
                            setSimClientId(v);
                            if (id) void loadSalePrice(id, simQty, v);
                            if (simClients.length === 0) void loadSimClients();
                          }}
                          options={[
                            { value: "", label: "Sin cliente" },
                            ...simClients.map(c => ({ value: c.id, label: c.displayName })),
                          ]}
                        />
                      </TPField>
                    </div>
                    {discountStatus === "aplica" && (
                      <div className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 text-xs text-primary">
                        <Package size={12} className="shrink-0" />
                        <span>Descuento aplicado por {simQty} unidades{discAmt > 0 ? ` → −${fmtMoney(discAmt)}` : ""}</span>
                      </div>
                    )}
                    {discountStatus === "descartada" && (
                      <div className="flex items-center gap-2 rounded-lg bg-orange-500/10 border border-orange-500/20 px-3 py-2 text-xs text-orange-600 dark:text-orange-400">
                        <AlertCircle size={12} className="shrink-0" />
                        Hay descuentos configurados, pero una promoción tuvo prioridad.
                      </div>
                    )}
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-surface2/40">
                            <th className="text-left px-3 py-2 font-medium text-muted">Desde</th>
                            <th className="text-right px-3 py-2 font-medium text-muted">Descuento</th>
                            <th className="text-center px-3 py-2 font-medium text-muted">Activo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {articleDiscounts
                            .flatMap((d) =>
                              (d.tiers ?? []).map((t) => ({ ...t, ruleId: d.id, isActive: d.isActive }))
                            )
                            .sort((a, b) => parseFloat(a.minQty) - parseFloat(b.minQty))
                            .map((t, tIdx) => {
                              const qty = parseFloat(t.minQty);
                              const isApplied = spr?.appliedDiscountId === t.ruleId;
                              const qualifies = simQty >= qty;
                              return (
                                <tr key={`${t.ruleId}-${tIdx}`} className={cn("border-b border-border last:border-0", isApplied && "bg-primary/5")}>
                                  <td className="px-3 py-2 font-medium text-text">
                                    {qty.toLocaleString("es-AR")} u.
                                    {isApplied && <span className="ml-1 text-[10px] text-primary font-semibold">● Aplica</span>}
                                    {!isApplied && qualifies && <span className="ml-1 text-[10px] text-muted">(califica)</span>}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums text-muted">
                                    {t.type === "PERCENTAGE" ? `${parseFloat(t.value)}%` : fmtMoney(t.value)}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <TPActiveBadge active={t.isActive} />
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                    {minDiscount && discountStatus === "no-aplica" && (
                      <p className="text-xs text-muted text-center">
                        Comprá desde <strong className="text-text">{parseFloat(minDiscount.minQty).toLocaleString("es-AR")}</strong> unidades para activar el descuento.
                      </p>
                    )}
                    <div className="flex justify-end">
                      <TPButton variant="ghost" onClick={() => navigate("/configuracion-sistema/descuentos-cantidad")}>
                        Editar descuento
                      </TPButton>
                    </div>
                  </div>
                )}
              </TPCard>
            </div>
          </div>
        );
      })()}

      {/* ── Modal edición ────────────────────────────────────────────── */}
      {!createMode && id && (
        <ArticleModal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          articleId={id}
          onSaved={() => {
            setEditModalOpen(false);
            void fetchArticle();
            // Si ventas ya estaba cargado, refrescar precio con el contexto actual
            if (ventasLoaded && id) void loadSalePrice(id, simQty, simClientId);
          }}
        />
      )}
    </div>
  );
}
