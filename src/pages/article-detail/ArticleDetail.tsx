// src/pages/article-detail/ArticleDetail.tsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  FileText,
  Gem,
  Image,
  Layers,
  Pencil,
  Package,
  Star,
  Sliders,
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
import { TPStatusPill } from "../../components/ui/TPStatusPill";
import { toast } from "../../lib/toast";
import {
  articlesApi,
  type ArticleDetail as ArticleDetailType,
  type ArticleComposition,
  type ArticleVariant,
  type ArticleAttributeValue,
  type ArticleImage,
  type ArticleStock,
  type ArticleStatus,
  type StockMode,
  type HechuraPriceMode,
  type ArticlePayload,
  type CompositionPayload,
  type VariantPayload,
  ARTICLE_STATUS_LABELS,
  ARTICLE_STATUS_COLORS,
  STOCK_MODE_LABELS,
  HECHURA_MODE_LABELS,
} from "../../services/articles";
import { categoriesApi, type CategoryRow } from "../../services/categories";
import { getMetals, getVariants, type MetalVariantRow } from "../../services/valuation";

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
type Tab = "general" | "compositions" | "variants" | "attributes" | "images" | "stock";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "general",      label: "General",       icon: <FileText size={14} /> },
  { key: "compositions", label: "Composición",   icon: <Gem size={14} /> },
  { key: "variants",     label: "Variantes",     icon: <Layers size={14} /> },
  { key: "attributes",   label: "Atributos",     icon: <Sliders size={14} /> },
  { key: "images",       label: "Imágenes",      icon: <Image size={14} /> },
  { key: "stock",        label: "Stock",         icon: <Warehouse size={14} /> },
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

  // ---- Lazy tab data ----
  const [compositions, setCompositions]               = useState<ArticleComposition[]>([]);
  const [compositionsLoaded, setCompositionsLoaded]   = useState(false);
  const [compositionsLoading, setCompositionsLoading] = useState(false);

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

  // ---- Pickers ----
  const [categories, setCategories] = useState<CategoryRow[]>([]);

  // ---- Edit form ----
  const [editing, setEditing] = useState(createMode);
  const [draft, setDraft]     = useState<Draft | null>(createMode ? { ...EMPTY_DRAFT } : null);
  const [submitted, setSubmitted] = useState(false);
  const [busySave, setBusySave]   = useState(false);

  // ---- Metal variants for composition picker ----
  const [metalVariants, setMetalVariants] = useState<MetalVariantRow[]>([]);

  // ---- Composition modal ----
  const [compModal, setCompModal]   = useState(false);
  const [compDraft, setCompDraft]   = useState({ variantId: "", grams: null as number | null, isBase: false });
  const [busyComp, setBusyComp]     = useState(false);
  const [removingComp, setRemovingComp] = useState<string | null>(null);

  // ---- Variant modal ----
  const [varModal, setVarModal]     = useState(false);
  const [varEditId, setVarEditId]   = useState<string | null>(null);
  const [varDraft, setVarDraft]     = useState<VariantPayload & { weightOverride?: number | null; hechuraPriceOverride?: number | null; priceOverride?: number | null }>({
    code: "", name: "", sortOrder: 0, weightOverride: null, hechuraPriceOverride: null, priceOverride: null,
  });
  const [busyVar, setBusyVar]         = useState(false);
  const [removingVar, setRemovingVar] = useState<string | null>(null);

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
    void loadMetalVariants();
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
      setCompositions(data.compositions);
      setCompositionsLoaded(true);
      setVariants(data.variants);
      setVariantsLoaded(true);
      setAttributes(data.attributeValues);
      setAttributesLoaded(true);
      setImages(data.images);
      setImagesLoaded(true);
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

  async function loadMetalVariants() {
    try {
      const metals = (await getMetals()) as { id: string; name: string }[];
      const all: MetalVariantRow[] = [];
      await Promise.all(
        metals.map(async (m) => {
          try {
            const vrs = (await getVariants(m.id)) as MetalVariantRow[];
            vrs.forEach((v) => all.push({ ...v, _metalName: m.name } as any));
          } catch {}
        })
      );
      setMetalVariants(all);
    } catch {}
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
     COMPOSITIONS
  ============================================================== */
  async function saveComposition() {
    if (!id || !compDraft.variantId || compDraft.grams == null) return;
    setBusyComp(true);
    try {
      const payload: CompositionPayload = {
        variantId: compDraft.variantId,
        grams: compDraft.grams,
        isBase: compDraft.isBase,
      };
      await articlesApi.compositions.upsert(id, payload);
      setCompositions(await articlesApi.compositions.list(id));
      setCompModal(false);
      setCompDraft({ variantId: "", grams: null, isBase: false });
      toast.success("Composición guardada.");
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar composición.");
    } finally {
      setBusyComp(false);
    }
  }

  async function removeComposition(compositionId: string) {
    if (!id) return;
    setRemovingComp(compositionId);
    try {
      await articlesApi.compositions.remove(id, compositionId);
      setCompositions((prev) => prev.filter((c) => c.id !== compositionId));
      toast.success("Composición eliminada.");
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar composición.");
    } finally {
      setRemovingComp(null);
    }
  }

  /* ==============================================================
     VARIANTS
  ============================================================== */
  function openNewVariant() {
    setVarEditId(null);
    setVarDraft({ code: "", name: "", sortOrder: 0, weightOverride: null, hechuraPriceOverride: null, priceOverride: null });
    setVarModal(true);
  }

  function openEditVariant(v: ArticleVariant) {
    setVarEditId(v.id);
    setVarDraft({
      code: v.code,
      name: v.name,
      sortOrder: v.sortOrder,
      weightOverride: v.weightOverride != null ? parseFloat(v.weightOverride) : null,
      hechuraPriceOverride: v.hechuraPriceOverride != null ? parseFloat(v.hechuraPriceOverride) : null,
      priceOverride: v.priceOverride != null ? parseFloat(v.priceOverride) : null,
    });
    setVarModal(true);
  }

  async function saveVariant() {
    if (!id || !varDraft.code.trim() || !varDraft.name.trim()) return;
    setBusyVar(true);
    try {
      const payload: VariantPayload = {
        code: varDraft.code.trim(),
        name: varDraft.name.trim(),
        sortOrder: varDraft.sortOrder,
        weightOverride: varDraft.weightOverride,
        hechuraPriceOverride: varDraft.hechuraPriceOverride,
        priceOverride: varDraft.priceOverride,
      };
      if (varEditId) {
        const updated = await articlesApi.variants.update(id, varEditId, payload);
        setVariants((prev) => prev.map((v) => (v.id === varEditId ? updated : v)));
      } else {
        const created = await articlesApi.variants.create(id, payload);
        setVariants((prev) => [...prev, created]);
      }
      setVarModal(false);
      toast.success(varEditId ? "Variante actualizada." : "Variante creada.");
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar variante.");
    } finally {
      setBusyVar(false);
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

  const metalVariantOptions = metalVariants.map((v) => ({
    label: `${(v as any)._metalName ? `${(v as any)._metalName} — ` : ""}${v.name} (${(v.purity * 100).toFixed(0)}%)`,
    value: v.id,
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
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ARTICLE_STATUS_COLORS[article.status]}`}
                  >
                    {ARTICLE_STATUS_LABELS[article.status]}
                  </span>
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

        {/* Edit / Save actions */}
        {!createMode && (
          <div className="flex items-center gap-2 shrink-0">
            {editing ? (
              <>
                <TPButton variant="ghost" onClick={() => { setEditing(false); setDraft(article ? articleToDraft(article) : EMPTY_DRAFT); }}>
                  <X size={14} className="mr-1" /> Cancelar
                </TPButton>
                <TPButton onClick={handleSave} disabled={busySave}>
                  <Check size={14} className="mr-1" /> {busySave ? "Guardando…" : "Guardar"}
                </TPButton>
              </>
            ) : (
              <TPButton variant="secondary" onClick={() => setEditing(true)}>
                <Pencil size={14} className="mr-1" /> Editar
              </TPButton>
            )}
          </div>
        )}
      </div>

      {/* ---- Tabs ---- */}
      {!createMode && (
        <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
          {TABS.map((tab) => {
            // Only show stock tab if stockMode = BY_ARTICLE
            if (tab.key === "stock" && article?.stockMode !== "BY_ARTICLE") return null;
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
      {(activeTab === "general" || createMode) && draft && (
        <div className="space-y-4">
          <TPCard title="Información básica">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TPField label="Nombre *">
                <TPInput
                  value={draft.name}
                  onChange={(v) => setDraft((p) => p && ({ ...p, name: v }))}
                  disabled={!editing}
                  error={submitted && !draft.name.trim() ? "El nombre es obligatorio." : ""}
                />
              </TPField>

              <TPField label="Código (se genera automáticamente si no se ingresa)">
                <TPInput
                  value={draft.code}
                  onChange={(v) => setDraft((p) => p && ({ ...p, code: v }))}
                  disabled={!editing}
                  placeholder="Ej: ART-0001"
                />
              </TPField>

              <TPField label="Categoría">
                <TPComboFixed
                  value={draft.categoryId ?? ""}
                  onChange={(v) => setDraft((p) => p && ({ ...p, categoryId: v || null }))}
                  options={[{ label: "Sin categoría", value: "" }, ...categoryOptions]}
                  disabled={!editing}
                />
              </TPField>

              <TPField label="Estado">
                <TPComboFixed
                  value={draft.status}
                  onChange={(v) => setDraft((p) => p && ({ ...p, status: v as ArticleStatus }))}
                  options={statusOptions}
                  disabled={!editing}
                />
              </TPField>

              <div className="md:col-span-2">
                <TPField label="Descripción">
                  <TPTextarea
                    value={draft.description}
                    onChange={(v) => setDraft((p) => p && ({ ...p, description: v }))}
                    disabled={!editing}
                    rows={2}
                  />
                </TPField>
              </div>
            </div>
          </TPCard>

          <TPCard title="Stock y precios">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TPField label="Modo de stock">
                <TPComboFixed
                  value={draft.stockMode}
                  onChange={(v) => setDraft((p) => p && ({ ...p, stockMode: v as StockMode }))}
                  options={stockModeOptions}
                  disabled={!editing}
                />
              </TPField>

              <TPField label="Modo de hechura">
                <TPComboFixed
                  value={draft.hechuraPriceMode}
                  onChange={(v) => setDraft((p) => p && ({ ...p, hechuraPriceMode: v as HechuraPriceMode }))}
                  options={hechuraModeOptions}
                  disabled={!editing}
                />
              </TPField>

              <TPField label={`Precio de hechura${draft.hechuraPriceMode === "PER_GRAM" ? " (por gramo)" : " (monto fijo)"}`}>
                <TPNumberInput
                  value={draft.hechuraPrice}
                  onChange={(v) => setDraft((p) => p && ({ ...p, hechuraPrice: v }))}
                  disabled={!editing}
                  min={0}
                  decimals={2}
                />
              </TPField>

              <TPField label="Merma (%) — override de categoría">
                <TPNumberInput
                  value={draft.mermaPercent}
                  onChange={(v) => setDraft((p) => p && ({ ...p, mermaPercent: v }))}
                  disabled={!editing}
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
              disabled={!editing}
              rows={3}
              placeholder="Notas visibles solo internamente…"
            />
          </TPCard>

          {createMode && (
            <div className="flex justify-end gap-2">
              <TPButton variant="ghost" onClick={() => navigate(-1)}>Cancelar</TPButton>
              <TPButton onClick={handleSave} disabled={busySave}>
                {busySave ? "Creando…" : "Crear artículo"}
              </TPButton>
            </div>
          )}
        </div>
      )}

      {/* ============================
          TAB: COMPOSICIÓN
      ============================ */}
      {activeTab === "compositions" && !createMode && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted">Metales que componen este artículo.</div>
            <TPButton onClick={() => { setCompDraft({ variantId: "", grams: null, isBase: false }); setCompModal(true); }}>
              + Agregar metal
            </TPButton>
          </div>

          {compositionsLoading && <div className="text-sm text-muted">Cargando…</div>}

          {!compositionsLoading && compositions.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted">
              Este artículo no tiene composición metálica definida.
            </div>
          )}

          {compositions.map((comp) => (
            <div
              key={comp.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
            >
              <div>
                <div className="text-sm font-medium text-text">{comp.metalVariant.name}</div>
                <div className="text-xs text-muted">
                  {comp.metalVariant.metal.name} · {comp.metalVariant.purity}
                  {comp.isBase && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                      Base
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm font-semibold text-text">{comp.grams} g</div>
                <button
                  type="button"
                  onClick={() => removeComposition(comp.id)}
                  disabled={removingComp === comp.id}
                  className="tp-btn-secondary h-8 w-8 !p-0 grid place-items-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  title="Eliminar"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}

          {/* Composition modal */}
          {compModal && (
            <div className="fixed inset-0 z-50">
              <div className="absolute inset-0 bg-black/50" onClick={() => setCompModal(false)} />
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl">
                  <div className="flex items-center justify-between border-b border-border px-5 py-4">
                    <div className="text-sm font-semibold text-text">Agregar metal</div>
                    <button
                      type="button"
                      onClick={() => setCompModal(false)}
                      className="tp-btn-secondary h-8 w-8 !p-0 grid place-items-center"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="p-5 space-y-4">
                    <TPField label="Variante de metal *">
                      <TPComboFixed
                        value={compDraft.variantId}
                        onChange={(v) => setCompDraft((p) => ({ ...p, variantId: v }))}
                        options={metalVariantOptions}
                      />
                    </TPField>
                    <TPField label="Gramos *">
                      <TPNumberInput
                        value={compDraft.grams}
                        onChange={(v) => setCompDraft((p) => ({ ...p, grams: v }))}
                        min={0}
                        decimals={4}
                      />
                    </TPField>
                    <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
                      <input
                        type="checkbox"
                        checked={compDraft.isBase}
                        onChange={(e) => setCompDraft((p) => ({ ...p, isBase: e.target.checked }))}
                        className="h-4 w-4 rounded border-border"
                      />
                      Es el metal base del artículo
                    </label>
                  </div>
                  <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
                    <TPButton variant="ghost" onClick={() => setCompModal(false)}>Cancelar</TPButton>
                    <TPButton
                      onClick={saveComposition}
                      disabled={busyComp || !compDraft.variantId || compDraft.grams == null}
                    >
                      {busyComp ? "Guardando…" : "Guardar"}
                    </TPButton>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================
          TAB: VARIANTES
      ============================ */}
      {activeTab === "variants" && !createMode && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted">Variantes comerciales (talle, color, etc.).</div>
            <TPButton onClick={openNewVariant}>+ Nueva variante</TPButton>
          </div>

          {variantsLoading && <div className="text-sm text-muted">Cargando…</div>}

          {!variantsLoading && variants.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted">
              Este artículo no tiene variantes.
            </div>
          )}

          {variants.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted border border-border rounded px-1.5 py-0.5">
                    {v.code}
                  </span>
                  <span className="text-sm font-medium text-text">{v.name}</span>
                  {!v.isActive && (
                    <span className="text-xs text-muted bg-surface2 rounded-full px-2 py-0.5">Inactiva</span>
                  )}
                </div>
                <div className="text-xs text-muted mt-0.5">
                  {v.weightOverride != null && `Peso: ${v.weightOverride}g`}
                  {v.priceOverride != null && ` · Precio fijo: ${v.priceOverride}`}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openEditVariant(v)}
                  className="tp-btn-secondary h-9 w-9 !p-0 grid place-items-center"
                  title="Editar"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => toggleVariant(v)}
                  className="tp-btn-secondary h-9 w-9 !p-0 grid place-items-center"
                  title={v.isActive ? "Desactivar" : "Activar"}
                >
                  {v.isActive
                    ? <span className="text-xs font-bold text-green-600">ON</span>
                    : <span className="text-xs font-bold text-muted">OFF</span>}
                </button>
                <button
                  type="button"
                  onClick={() => removeVariant(v.id)}
                  disabled={removingVar === v.id}
                  className="tp-btn-secondary h-9 w-9 !p-0 grid place-items-center text-red-500"
                  title="Eliminar"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}

          {/* Variant modal */}
          {varModal && (
            <div className="fixed inset-0 z-50">
              <div className="absolute inset-0 bg-black/50" onClick={() => setVarModal(false)} />
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl">
                  <div className="flex items-center justify-between border-b border-border px-5 py-4">
                    <div className="text-sm font-semibold text-text">
                      {varEditId ? "Editar variante" : "Nueva variante"}
                    </div>
                    <button type="button" onClick={() => setVarModal(false)} className="tp-btn-secondary h-8 w-8 !p-0 grid place-items-center">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <TPField label="Código *">
                        <TPInput
                          value={varDraft.code}
                          onChange={(v) => setVarDraft((p) => ({ ...p, code: v }))}
                          placeholder="Ej: T18"
                        />
                      </TPField>
                      <TPField label="Nombre *">
                        <TPInput
                          value={varDraft.name}
                          onChange={(v) => setVarDraft((p) => ({ ...p, name: v }))}
                          placeholder="Ej: Talla 18"
                        />
                      </TPField>
                    </div>
                    <TPField label="Peso override (g) — reemplaza peso base del artículo">
                      <TPNumberInput
                        value={varDraft.weightOverride ?? null}
                        onChange={(v) => setVarDraft((p) => ({ ...p, weightOverride: v }))}
                        min={0}
                        decimals={4}
                        placeholder="Sin override"
                      />
                    </TPField>
                    <TPField label="Hechura override — reemplaza hechura del artículo">
                      <TPNumberInput
                        value={varDraft.hechuraPriceOverride ?? null}
                        onChange={(v) => setVarDraft((p) => ({ ...p, hechuraPriceOverride: v }))}
                        min={0}
                        decimals={2}
                        placeholder="Sin override"
                      />
                    </TPField>
                    <TPField label="Precio fijo — saltea el motor de cálculo">
                      <TPNumberInput
                        value={varDraft.priceOverride ?? null}
                        onChange={(v) => setVarDraft((p) => ({ ...p, priceOverride: v }))}
                        min={0}
                        decimals={2}
                        placeholder="Sin precio fijo"
                      />
                    </TPField>
                  </div>
                  <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
                    <TPButton variant="ghost" onClick={() => setVarModal(false)}>Cancelar</TPButton>
                    <TPButton
                      onClick={saveVariant}
                      disabled={busyVar || !varDraft.code.trim() || !varDraft.name.trim()}
                    >
                      {busyVar ? "Guardando…" : "Guardar"}
                    </TPButton>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================
          TAB: ATRIBUTOS
      ============================ */}
      {activeTab === "attributes" && !createMode && (
        <div className="space-y-4">
          {attributesLoading && <div className="text-sm text-muted">Cargando…</div>}

          {!attributesLoading && attributes.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted">
              {article?.category
                ? "Esta categoría no tiene atributos definidos."
                : "Asigná una categoría al artículo para ver sus atributos."}
            </div>
          )}

          {attributes.length > 0 && (
            <TPCard title="Valores de atributos">
              <div className="space-y-3">
                {attributes.map((av) => (
                  <div key={av.id} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                    <div className="text-xs font-medium text-muted">
                      {av.assignment.definition.name}
                      {av.assignment.isRequired && <span className="ml-1 text-red-400">*</span>}
                    </div>
                    <div className="text-sm text-text">{av.value || "—"}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-muted">
                Los atributos se editan directamente en la pantalla de categorías.
              </div>
            </TPCard>
          )}
        </div>
      )}

      {/* ============================
          TAB: IMÁGENES
      ============================ */}
      {activeTab === "images" && !createMode && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted">Imágenes del artículo.</div>
            <TPButton onClick={() => imgInputRef.current?.click()} disabled={busyImg}>
              {busyImg ? "Subiendo…" : "+ Subir imagen"}
            </TPButton>
          </div>

          <input
            ref={imgInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImageUpload(file);
              e.target.value = "";
            }}
          />

          {imagesLoading && <div className="text-sm text-muted">Cargando…</div>}

          {!imagesLoading && images.length === 0 && (
            <div className="rounded-xl border border-border border-dashed bg-card p-12 text-center text-sm text-muted">
              No hay imágenes. Subí la primera.
            </div>
          )}

          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {images.map((img) => (
                <div
                  key={img.id}
                  className={`relative rounded-xl border overflow-hidden bg-surface2 ${
                    img.isMain ? "border-primary ring-2 ring-primary/30" : "border-border"
                  }`}
                >
                  <img
                    src={img.url}
                    alt={img.label || "Imagen"}
                    className="w-full aspect-square object-cover"
                  />
                  {img.isMain && (
                    <div className="absolute top-1.5 left-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      Principal
                    </div>
                  )}
                  <div className="absolute top-1.5 right-1.5 flex gap-1">
                    {!img.isMain && (
                      <button
                        type="button"
                        onClick={() => setMainImage(img.id)}
                        className="h-6 w-6 rounded-full bg-black/50 text-white grid place-items-center hover:bg-black/70"
                        title="Establecer como principal"
                      >
                        <Star size={11} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      disabled={removingImg === img.id}
                      className="h-6 w-6 rounded-full bg-black/50 text-white grid place-items-center hover:bg-red-600/70"
                      title="Eliminar"
                    >
                      <X size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
    </div>
  );
}
