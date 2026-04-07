// src/pages/configuracion-sistema/ConfiguracionSistemaDescuentosCantidad.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useConfirmDelete } from "../../hooks/useConfirmDelete";
import {
  Eye,
  Layers,
  PackagePlus,
  Pencil,
  Plus,
  Save,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";

import { cn } from "../../components/ui/tp";
import { TPSectionShell } from "../../components/ui/TPSectionShell";
import { TPButton } from "../../components/ui/TPButton";
import { TPField } from "../../components/ui/TPField";
import { TPCheckbox } from "../../components/ui/TPCheckbox";
import { Modal } from "../../components/ui/Modal";
import ConfirmDeleteDialog from "../../components/ui/ConfirmDeleteDialog";
import { TPTr, TPTd } from "../../components/ui/TPTable";
import { TPTableKit, type TPColDef } from "../../components/ui/TPTableKit";
import { TPStatusPill } from "../../components/ui/TPStatusPill";
import { TPRowActions } from "../../components/ui/TPRowActions";
import TPComboFixed from "../../components/ui/TPComboFixed";
import TPComboMulti from "../../components/ui/TPComboMulti";
import TPNumberInput from "../../components/ui/TPNumberInput";
import { CategoryTreePicker } from "../../components/ui/CategoryTreePicker";

import { toast } from "../../lib/toast";
import {
  quantityDiscountsApi,
  type QuantityDiscountRow,
  type QuantityDiscountTier,
  type QuantityDiscountPayload,
  type QuantityDiscountEvaluationMode,
} from "../../services/quantity-discounts";
import { articlesApi } from "../../services/articles";
import type { PromotionType } from "../../services/promotions";
import { PROMOTION_TYPE_LABELS } from "../../services/promotions";
import type { ArticleRow, ArticleVariant } from "../../services/articles";
import { categoriesApi } from "../../services/categories";
import type { CategoryRow } from "../../services/categories";
import { getCurrencies, type CurrencyRow } from "../../services/valuation";
import { articleGroupsApi } from "../../services/article-groups";
import type { ArticleGroupRow } from "../../services/article-groups";

/* =========================================================
   Tipos locales
========================================================= */
type ScopeMode = "all" | "category" | "brand" | "article_variant" | "group";

type TierDraft = {
  key:    string;
  minQty: number | null;
  type:   PromotionType;
  value:  number | null;
};

/* =========================================================
   Helpers de visualización
========================================================= */
function tierValueDisplay(t: Pick<QuantityDiscountTier, "type" | "value">, baseSym = "$"): string {
  const v = parseFloat(t.value);
  if (isNaN(v)) return "—";
  if (t.type === "PERCENTAGE") return `${v.toLocaleString("es-AR")}%`;
  return `${baseSym} ${v.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
}

function qtyDisplay(minQty: string | number): string {
  const n = typeof minQty === "number" ? minQty : parseFloat(String(minQty));
  if (isNaN(n)) return String(minQty);
  return n % 1 === 0 ? String(n) : n.toLocaleString("es-AR");
}

function rowScopeLabel(row: QuantityDiscountRow): string {
  if (row.variant)  return `Variante: ${row.variant.name}`;
  if (row.article)  return `${row.article.name} (${row.article.code})`;
  if (row.category) return `Categ.: ${row.category.name}`;
  if (row.brand)    return `Marca: ${row.brand}`;
  if (row.group)    return `Grupo: ${row.group.name}`;
  return "Todos los artículos";
}

/* =========================================================
   Modo de evaluación
========================================================= */
const EVALUATION_MODE_LABELS: Record<QuantityDiscountEvaluationMode, string> = {
  LINE:           "Por línea",
  CATEGORY_TOTAL: "Por suma en categoría",
  BRAND_TOTAL:    "Por suma en marca",
  GROUP_TOTAL:    "Por suma en grupo",
};

/* =========================================================
   Badges
========================================================= */
const TYPE_COLORS: Record<PromotionType, string> = {
  FIXED:      "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  PERCENTAGE: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
};

function TypeBadge({ type, baseSym = "$" }: { type: PromotionType; baseSym?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
      TYPE_COLORS[type]
    )}>
      {type === "PERCENTAGE" ? "%" : baseSym} {PROMOTION_TYPE_LABELS[type]}
    </span>
  );
}

function ScopeBadge({ row }: { row: QuantityDiscountRow }) {
  if (row.variant)  return <span className="inline-flex items-center rounded-full bg-teal-500/15 text-teal-600 dark:text-teal-400 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">Variante</span>;
  if (row.article)  return <span className="inline-flex items-center rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">Artículo</span>;
  if (row.category) return <span className="inline-flex items-center rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">Categoría</span>;
  if (row.brand)    return <span className="inline-flex items-center rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">Marca</span>;
  if (row.group)    return <span className="inline-flex items-center rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">Grupo</span>;
  return <span className="inline-flex items-center rounded-full bg-gray-500/10 text-muted px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">Global</span>;
}

/* =========================================================
   Resumen de tramos (para tabla)
========================================================= */
function TiersSummary({ tiers, baseSym = "$" }: { tiers: QuantityDiscountTier[]; baseSym?: string }) {
  if (!tiers || tiers.length === 0) return <span className="text-xs text-muted italic">Sin tramos</span>;
  const sorted = [...tiers].sort((a, b) => parseFloat(a.minQty) - parseFloat(b.minQty));
  const visible = sorted.slice(0, 2);
  return (
    <div className="flex flex-col gap-0.5">
      {visible.map((t) => (
        <span key={t.id} className="text-xs text-text tabular-nums whitespace-nowrap">
          ≥{qtyDisplay(t.minQty)} → {tierValueDisplay(t, baseSym)}
        </span>
      ))}
      {sorted.length > 2 && (
        <span className="text-xs text-muted">+{sorted.length - 2} más</span>
      )}
    </div>
  );
}

/* =========================================================
   Separador de sección en modal
========================================================= */
function ModalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</span>
        <div className="flex-1 border-t border-border" />
      </div>
      {children}
    </div>
  );
}

/* =========================================================
   Detalle en modal ver
========================================================= */
function DetailRow({ label, children, borderBottom = true }: {
  label: string; children: React.ReactNode; borderBottom?: boolean;
}) {
  return (
    <div className={cn("flex justify-between gap-4 py-2", borderBottom && "border-b border-border")}>
      <span className="text-muted font-medium shrink-0">{label}</span>
      <span className="text-text text-right break-words min-w-0">{children}</span>
    </div>
  );
}

/* =========================================================
   Validación
========================================================= */
type FormErrors = {
  scope?: string;
  tiers?: string;
  tierErrors?: Record<number, { minQty?: string; value?: string }>;
};

function validate(
  scope: ScopeMode,
  selectedCategoryIds: string[],
  selectedBrands: string[],
  selectedArticles: ArticleRow[],
  selectedVariant: ArticleVariant | null,
  tiers: TierDraft[],
  selectedGroupIds?: string[],
): FormErrors {
  const errors: FormErrors = {};

  if (scope === "category" && selectedCategoryIds.length === 0) {
    errors.scope = "Seleccioná al menos una categoría.";
  } else if (scope === "brand" && selectedBrands.length === 0) {
    errors.scope = "Seleccioná al menos una marca.";
  } else if (scope === "article_variant" && selectedArticles.length === 0) {
    errors.scope = "Seleccioná al menos un artículo.";
  } else if (scope === "group" && (!selectedGroupIds || selectedGroupIds.length === 0)) {
    errors.scope = "Seleccioná al menos un grupo.";
  }

  if (tiers.length === 0) {
    errors.tiers = "Debe haber al menos un tramo.";
  } else {
    const tierErrors: Record<number, { minQty?: string; value?: string }> = {};
    let hasTierError = false;
    const qtys: number[] = [];

    tiers.forEach((t, i) => {
      const te: { minQty?: string; value?: string } = {};
      if (t.minQty == null || isNaN(t.minQty) || t.minQty <= 0) te.minQty = "Debe ser > 0";
      if (t.value == null || isNaN(t.value) || t.value < 0)     te.value  = "Debe ser ≥ 0";
      if (Object.keys(te).length > 0) { tierErrors[i] = te; hasTierError = true; }
      if (t.minQty != null) qtys.push(t.minQty);
    });

    if (hasTierError) errors.tierErrors = tierErrors;
    if (new Set(qtys).size !== qtys.length && !errors.tiers) {
      errors.tiers = "No puede haber cantidades mínimas duplicadas.";
    }
  }

  return errors;
}

/* =========================================================
   Columnas
========================================================= */
const QD_COLS: TPColDef[] = [
  { key: "alcance", label: "Alcance",   canHide: false, sortKey: "alcance" },
  { key: "tramos",  label: "Tramos",    sortKey: "tramos" },
  { key: "estado",  label: "Estado" },
  { key: "orden",   label: "Orden",     sortKey: "sortOrder" },
  { key: "acciones",label: "Acciones",  canHide: false },
];

const COL_STORAGE_KEY = "tptech_col_quantity_discounts";

/* =========================================================
   Página principal
========================================================= */
export default function ConfiguracionSistemaDescuentosCantidad() {
  /* ---- estado principal ---- */
  const [rows, setRows]       = useState<QuantityDiscountRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ]             = useState("");

  /* ---- filtros ---- */
  const [filterActive, setFilterActive] = useState<"" | "true" | "false">("");
  const [showFilters,  setShowFilters]  = useState(false);

  /* ---- sort ---- */
  type SortKey = "alcance" | "tramos" | "sortOrder";
  const [sortKey, setSortKey] = useState<SortKey>("alcance");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  function toggleSort(key: string) {
    const k = key as SortKey;
    if (sortKey === k) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  }

  /* ---- modal editar/crear ---- */
  const [editOpen,   setEditOpen]   = useState(false);
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [busySave,   setBusySave]   = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  /* ---- alcance ---- */
  const [scopeMode,           setScopeMode]           = useState<ScopeMode>("all");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedBrands,      setSelectedBrands]      = useState<string[]>([]);
  const [selectedArticles,    setSelectedArticles]    = useState<ArticleRow[]>([]);
  const [selectedVariant,     setSelectedVariant]     = useState<ArticleVariant | null>(null);
  const [variants,            setVariants]            = useState<ArticleVariant[]>([]);
  const [loadingVariants,     setLoadingVariants]     = useState(false);

  /* ---- tramos ---- */
  const [tiers, setTiers] = useState<TierDraft[]>([
    { key: "t0", minQty: null, type: "PERCENTAGE", value: null },
  ]);

  /* ---- modo de evaluación ---- */
  const [evaluationMode,    setEvaluationMode]    = useState<QuantityDiscountEvaluationMode>("LINE");
  const [defaultEvalMode,   setDefaultEvalMode]   = useState<QuantityDiscountEvaluationMode | null>(
    () => localStorage.getItem("tptech_default_qd_evalMode") as QuantityDiscountEvaluationMode | null
  );

  function handleSetDefaultEvalMode(v: string) {
    localStorage.setItem("tptech_default_qd_evalMode", v);
    setDefaultEvalMode(v as QuantityDiscountEvaluationMode);
  }

  /* ---- acumulabilidad ---- */
  const [isStackable, setIsStackable] = useState(false);

  /* ---- orden ---- */
  const [sortOrderNum, setSortOrderNum] = useState<number | null>(0);

  /* ---- catálogos pre-cargados ---- */
  const [allCategories, setAllCategories] = useState<CategoryRow[]>([]);
  const [allBrands,     setAllBrands]     = useState<string[]>([]);
  const [allArticles,   setAllArticles]   = useState<ArticleRow[]>([]);
  const [allGroups,     setAllGroups]     = useState<ArticleGroupRow[]>([]);

  /* ---- grupo seleccionado ---- */
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  /* ---- modal ver ---- */
  const [viewOpen,   setViewOpen]   = useState(false);
  const [viewTarget, setViewTarget] = useState<QuantityDiscountRow | null>(null);

  /* ---- moneda base ---- */
  const [currencies, setCurrencies] = useState<CurrencyRow[]>([]);
  const baseCurrency = currencies.find((c) => c.isBase);
  const baseCurrencySymbol = baseCurrency?.symbol ?? "$";
  const baseCurrencyCode   = baseCurrency?.code   ?? "";

  const { askDelete, dialogProps: deleteDialogProps } = useConfirmDelete();

  /* ---- toggle ---- */
  const [togglingId, setTogglingId] = useState<string | null>(null);

  /* ---- carga inicial ---- */
  async function load() {
    try {
      setLoading(true);
      const data = await quantityDiscountsApi.list({ take: 500 });
      setRows(data.data ?? []);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo cargar los descuentos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    categoriesApi.list()
      .then((cats) => setAllCategories((cats ?? []).filter((c) => c.isActive && !c.deletedAt)))
      .catch(() => {});
    articlesApi.listBrands()
      .then((res) => setAllBrands(res.brands ?? []))
      .catch(() => {});
    articlesApi.list({ take: 500, status: "ACTIVE" })
      .then((res) => setAllArticles(res.rows ?? []))
      .catch(() => {});
    articleGroupsApi.list()
      .then((res) => setAllGroups((Array.isArray(res) ? res : []).filter((g) => g.isActive && !g.deletedAt)))
      .catch(() => {});
    getCurrencies()
      .then((res: any) => setCurrencies(Array.isArray(res) ? res : (res?.rows ?? [])))
      .catch(() => {});
  }, []);

  /* ---- variantes cuando cambia el artículo seleccionado (solo si hay exactamente uno) ---- */
  const singleArticle = selectedArticles.length === 1 ? selectedArticles[0] : null;
  useEffect(() => {
    if (!singleArticle) { setVariants([]); setSelectedVariant(null); return; }
    setLoadingVariants(true);
    articlesApi.variants.list(singleArticle.id)
      .then((v) => setVariants((v ?? []).filter((x: ArticleVariant) => x.isActive)))
      .catch(() => setVariants([]))
      .finally(() => setLoadingVariants(false));
  }, [singleArticle]);

  /* ---- filtrado y ordenamiento ---- */
  const filteredRows = useMemo(() => {
    const s = q.trim().toLowerCase();
    let filtered = rows;
    if (s) {
      filtered = filtered.filter((r) =>
        (r.article?.name ?? "").toLowerCase().includes(s) ||
        (r.article?.code ?? "").toLowerCase().includes(s) ||
        (r.variant?.name ?? "").toLowerCase().includes(s) ||
        (r.category?.name ?? "").toLowerCase().includes(s) ||
        (r.brand ?? "").toLowerCase().includes(s) ||
        (r.group?.name ?? "").toLowerCase().includes(s)
      );
    }
    if (filterActive !== "") {
      const want = filterActive === "true";
      filtered = filtered.filter((r) => r.isActive === want);
    }
    return [...filtered].sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortKey === "alcance") {
        const aName = a.variant?.name ?? a.article?.name ?? a.category?.name ?? a.brand ?? "";
        const bName = b.variant?.name ?? b.article?.name ?? b.category?.name ?? b.brand ?? "";
        return aName.localeCompare(bName, "es") * mul;
      }
      if (sortKey === "tramos") return ((a.tiers?.length ?? 0) - (b.tiers?.length ?? 0)) * mul;
      if (sortKey === "sortOrder") return (a.sortOrder - b.sortOrder) * mul;
      return 0;
    });
  }, [rows, q, filterActive, sortKey, sortDir]);

  /* ---- helpers tiers ---- */
  function addTier() {
    setTiers((prev) => [
      ...prev,
      { key: `t${Date.now()}`, minQty: null, type: "PERCENTAGE", value: null },
    ]);
  }

  function removeTier(idx: number) {
    setTiers((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateTier(idx: number, patch: Partial<TierDraft>) {
    setTiers((prev) => prev.map((t, i) => i === idx ? { ...t, ...patch } : t));
  }

  /* ---- reset scope ---- */
  function resetScope() {
    setScopeMode("all");
    setSelectedCategoryIds([]);
    setSelectedBrands([]);
    setSelectedArticles([]);
    setSelectedVariant(null);
    setVariants([]);
    setSelectedGroupIds([]);
  }

  /* ---- abrir modal crear ---- */
  function openCreate() {
    setEditingId(null);
    resetScope();
    setTiers([{ key: "t0", minQty: null, type: "PERCENTAGE", value: null }]);
    setSortOrderNum(0);
    setIsStackable(false);
    setEvaluationMode(defaultEvalMode ?? "LINE");
    setSubmitted(false);
    setFormErrors({});
    setEditOpen(true);
  }

  /* ---- abrir modal editar ---- */
  function openEdit(row: QuantityDiscountRow) {
    setEditingId(row.id);

    if (row.variantId) {
      setScopeMode("article_variant");
      setSelectedArticles(row.article ? [{ id: row.articleId!, code: row.article.code, name: row.article.name } as ArticleRow] : []);
      setSelectedVariant(row.variant ? { id: row.variantId, code: row.variant.code, name: row.variant.name } as ArticleVariant : null);
      setSelectedCategoryIds([]);
      setSelectedBrands([]);
    } else if (row.articleId) {
      setScopeMode("article_variant");
      setSelectedArticles(row.article ? [{ id: row.articleId, code: row.article.code, name: row.article.name } as ArticleRow] : []);
      setSelectedVariant(null);
      setSelectedCategoryIds([]);
      setSelectedBrands([]);
    } else if (row.categoryId) {
      setScopeMode("category");
      setSelectedCategoryIds([row.categoryId]);
      setSelectedArticles([]);
      setSelectedVariant(null);
      setSelectedBrands([]);
    } else if (row.brand) {
      setScopeMode("brand");
      setSelectedBrands([row.brand]);
      setSelectedCategoryIds([]);
      setSelectedArticles([]);
      setSelectedVariant(null);
    } else if (row.groupId) {
      setScopeMode("group");
      setSelectedGroupIds([row.groupId]);
      setSelectedCategoryIds([]);
      setSelectedArticles([]);
      setSelectedVariant(null);
      setSelectedBrands([]);
    } else {
      setScopeMode("all");
      setSelectedCategoryIds([]);
      setSelectedArticles([]);
      setSelectedVariant(null);
      setSelectedBrands([]);
      setSelectedGroupIds([]);
    }

    const sortedTiers = [...(row.tiers ?? [])].sort((a, b) => parseFloat(a.minQty) - parseFloat(b.minQty));
    setTiers(
      sortedTiers.length > 0
        ? sortedTiers.map((t) => ({
            key:    t.id,
            minQty: parseFloat(t.minQty),
            type:   t.type,
            value:  parseFloat(t.value),
          }))
        : [{ key: "t0", minQty: null, type: "PERCENTAGE", value: null }]
    );

    setSortOrderNum(row.sortOrder ?? 0);
    setIsStackable(row.isStackable ?? true);
    setEvaluationMode(row.evaluationMode ?? "LINE");
    setSubmitted(false);
    setFormErrors({});
    setEditOpen(true);
  }

  /* ---- cerrar modal ---- */
  function closeEdit() {
    setEditOpen(false);
    setEditingId(null);
  }

  /* ---- guardar ---- */
  async function handleSave() {
    setSubmitted(true);
    const errors = validate(scopeMode, selectedCategoryIds, selectedBrands, selectedArticles, selectedVariant, tiers, selectedGroupIds);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const validTiers = tiers
      .filter((t) => t.minQty != null && t.value != null)
      .sort((a, b) => (a.minQty ?? 0) - (b.minQty ?? 0))
      .map((t) => ({ minQty: t.minQty!, type: t.type, value: t.value! }));

    const basePayload = {
      isActive:    true,
      isStackable,
      evaluationMode,
      sortOrder:   sortOrderNum ?? 0,
      tiers:       validTiers,
    };

    // Construir una lista de payloads: uno por cada ID seleccionado
    // En edición siempre es un solo registro; en creación puede ser N
    function buildPayloads(): QuantityDiscountPayload[] {
      if (scopeMode === "category") {
        const ids = editingId ? [selectedCategoryIds[0]] : selectedCategoryIds;
        return ids.filter(Boolean).map(id => ({ ...basePayload, categoryId: id, articleId: null, variantId: null, brand: null, groupId: null }));
      }
      if (scopeMode === "brand") {
        const vals = editingId ? [selectedBrands[0]] : selectedBrands;
        return vals.filter(Boolean).map(v => ({ ...basePayload, brand: v, articleId: null, variantId: null, categoryId: null, groupId: null }));
      }
      if (scopeMode === "group") {
        const ids = editingId ? [selectedGroupIds[0]] : selectedGroupIds;
        return ids.filter(Boolean).map(id => ({ ...basePayload, groupId: id, articleId: null, variantId: null, categoryId: null, brand: null }));
      }
      if (scopeMode === "article_variant") {
        const arts = editingId ? selectedArticles.slice(0, 1) : selectedArticles;
        return arts.map(art => ({
          ...basePayload,
          articleId: art.id,
          variantId: selectedVariant?.id ?? null,
          categoryId: null, brand: null, groupId: null,
        }));
      }
      // "all"
      return [{ ...basePayload, articleId: null, variantId: null, categoryId: null, brand: null, groupId: null }];
    }

    const payloads = buildPayloads();
    if (payloads.length === 0) return;

    try {
      setBusySave(true);
      if (editingId) {
        await quantityDiscountsApi.update(editingId, payloads[0]);
        toast.success("Descuento actualizado.");
      } else {
        await Promise.all(payloads.map(p => quantityDiscountsApi.create(p)));
        toast.success(payloads.length > 1 ? `${payloads.length} descuentos creados.` : "Descuento creado.");
      }
      closeEdit();
      await load();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar.");
    } finally {
      setBusySave(false);
    }
  }

  /* ---- toggle activo ---- */
  async function handleToggle(row: QuantityDiscountRow) {
    try {
      setTogglingId(row.id);
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, isActive: !r.isActive } : r));
      await quantityDiscountsApi.update(row.id, {
        isActive: !row.isActive,
        tiers: row.tiers.map((t) => ({ minQty: parseFloat(t.minQty), type: t.type, value: parseFloat(t.value) })),
      });
      toast.success(row.isActive ? "Descuento desactivado." : "Descuento activado.");
      await load();
    } catch (e: any) {
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, isActive: row.isActive } : r));
      toast.error(e?.message || "No se pudo cambiar el estado.");
    } finally {
      setTogglingId(null);
    }
  }

  /* ---- eliminar ---- */
  function handleDelete(row: QuantityDiscountRow) {
    askDelete({
      entityName: "regla de descuento",
      entityLabel: rowScopeLabel(row),
      onDelete: () => quantityDiscountsApi.remove(row.id),
      onAfterSuccess: load,
    });
  }

  /* ---- opciones para combos ---- */
  const categoryOptions = allCategories.map((c) => ({ value: c.id, label: c.name }));
  const brandOptions    = allBrands.map((b) => ({ value: b, label: b }));
  const articleOptions  = allArticles.map((a) => ({ value: a.id, label: `${a.name} (${a.code})` }));
  const variantOptions  = variants.map((v) => ({ value: v.id, label: `${v.name}${v.code ? ` (${v.code})` : ""}` }));

  /* =========================================================
     Render
  ========================================================= */
  return (
    <TPSectionShell
      title="Descuentos por cantidad"
      icon={<Layers size={20} />}
      subtitle="Reglas de descuento escalonadas según la cantidad vendida. Cada regla puede tener múltiples tramos."
    >
      <TPTableKit
        rows={filteredRows}
        columns={QD_COLS}
        storageKey={COL_STORAGE_KEY}
        search={q}
        onSearchChange={setQ}
        searchPlaceholder="Buscar por artículo, categoría, marca…"
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={toggleSort}
        loading={loading}
        emptyText={q || filterActive ? "Sin resultados para la búsqueda." : "No hay reglas de descuento. Creá la primera."}
        pagination={{ storageKey: "tptech:pageSize:quantityDiscounts" }}
        countLabel={(n) => `${n} ${n === 1 ? "regla" : "reglas"}`}
        actions={
          <TPButton
            variant="primary"
            iconLeft={<PackagePlus size={15} />}
            onClick={openCreate}
          >
            Nueva regla
          </TPButton>
        }
        renderRow={(row, vis) => (
          <TPTr key={row.id} className={cn(!row.isActive && "opacity-60")}>
            {vis.alcance && (
              <TPTd>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <ScopeBadge row={row} />
                  <span className="text-sm font-medium text-text truncate max-w-[200px]">{rowScopeLabel(row)}</span>
                </div>
              </TPTd>
            )}
            {vis.tramos && (
              <TPTd>
                <TiersSummary tiers={row.tiers ?? []} baseSym={baseCurrencySymbol} />
              </TPTd>
            )}
            {vis.estado && (
              <TPTd className="hidden md:table-cell">
                <TPStatusPill active={row.isActive} />
              </TPTd>
            )}
            {vis.orden && (
              <TPTd className="hidden lg:table-cell tabular-nums text-muted text-sm">
                {row.sortOrder}
              </TPTd>
            )}
            {vis.acciones && (
              <TPTd className="text-right">
                <span className="md:hidden mr-2"><TPStatusPill active={row.isActive} /></span>
                <TPRowActions
                  onView={() => { setViewTarget(row); setViewOpen(true); }}
                  onEdit={() => openEdit(row)}
                  onToggle={() => handleToggle(row)}
                  isActive={row.isActive}
                  toggleDisabled={togglingId === row.id}
                  busyToggle={togglingId === row.id}
                  onDelete={() => handleDelete(row)}
                />
              </TPTd>
            )}
          </TPTr>
        )}
      />

      {/* =========================================================
          MODAL CREAR / EDITAR
      ========================================================= */}
      <Modal
        open={editOpen}
        title={editingId ? "Editar regla de descuento" : "Nueva regla de descuento"}
        onClose={closeEdit}
        maxWidth="xl"
        className="h-[calc(100vh-3rem)]"
        footer={
          <div className="flex justify-end gap-2">
            <TPButton variant="ghost" onClick={closeEdit} disabled={busySave} iconLeft={<X size={14} />}>Cancelar</TPButton>
            <TPButton variant="primary" onClick={handleSave} loading={busySave} iconLeft={<Save size={14} />}>
              {editingId ? "Guardar cambios" : "Crear regla"}
            </TPButton>
          </div>
        }
      >
        <div className="space-y-6">

          {/* ---- BLOQUE 1: Alcance ---- */}
          <ModalSection title="Alcance">
            <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 100px" }}>
              <TPField label="¿A qué aplica este descuento?" required error={submitted ? formErrors.scope : undefined}>
                <TPComboFixed
                  value={scopeMode}
                  onChange={(v) => {
                    const newScope = v as ScopeMode;
                    setScopeMode(newScope);
                    setSelectedCategoryIds([]);
                    setSelectedBrands([]);
                    setSelectedArticles([]);
                    setSelectedVariant(null);
                    setVariants([]);
                    // Resetear modo de evaluación si el nuevo scope no lo soporta
                    if (newScope !== "category") setEvaluationMode((prev) => prev === "CATEGORY_TOTAL" ? "LINE" : prev);
                    if (newScope !== "brand")    setEvaluationMode((prev) => prev === "BRAND_TOTAL"    ? "LINE" : prev);
                    if (newScope !== "group")    setEvaluationMode((prev) => prev === "GROUP_TOTAL"    ? "LINE" : prev);
                  }}
                  disabled={busySave}
                  options={[
                    { value: "all",             label: "Todos los artículos" },
                    { value: "group",           label: "Grupo de artículos" },
                    { value: "category",        label: "Categoría" },
                    { value: "brand",           label: "Marca" },
                    { value: "article_variant", label: "Artículos y variantes" },
                  ]}
                />
              </TPField>
              <TPField label="Prioridad">
                <TPNumberInput
                  value={sortOrderNum}
                  onChange={setSortOrderNum}
                  decimals={0}
                  step={1}
                  min={0}
                  placeholder="0"
                  disabled={busySave}
                />
              </TPField>
            </div>

            {/* Categoría */}
            {scopeMode === "category" && (
              <TPField
                label="Categoría"
                required
                error={submitted ? formErrors.scope : undefined}
                hint={!editingId ? "Podés seleccionar varias — se creará una regla por categoría" : undefined}
              >
                <CategoryTreePicker
                  categories={allCategories}
                  value={selectedCategoryIds}
                  onChange={setSelectedCategoryIds}
                  disabled={busySave}
                />
              </TPField>
            )}

            {/* Marca */}
            {scopeMode === "brand" && (
              <TPField
                label="Marca"
                required
                error={submitted ? formErrors.scope : undefined}
                hint={!editingId ? "Podés seleccionar varias — se creará una regla por marca" : undefined}
              >
                <TPComboMulti
                  value={selectedBrands}
                  onChange={setSelectedBrands}
                  options={brandOptions}
                  placeholder="Buscar marca…"
                  disabled={busySave}
                />
              </TPField>
            )}

            {/* Artículo o Variante */}
            {scopeMode === "article_variant" && (
              <>
                <TPField
                  label="Artículo"
                  required
                  error={submitted && selectedArticles.length === 0 ? formErrors.scope : undefined}
                  hint={!editingId ? "Podés seleccionar varios — se creará una regla por artículo" : undefined}
                >
                  <TPComboMulti
                    value={selectedArticles.map(a => a.id)}
                    onChange={(ids) => {
                      const arts = ids.map(id => allArticles.find(a => a.id === id)).filter(Boolean) as ArticleRow[];
                      setSelectedArticles(arts);
                      if (arts.length !== 1) setSelectedVariant(null);
                    }}
                    options={articleOptions}
                    placeholder="Buscar artículo…"
                    disabled={busySave}
                  />
                </TPField>

                {/* Variante: solo disponible cuando hay exactamente un artículo seleccionado */}
                {selectedArticles.length === 1 && (
                  <TPField label="Variante" error={submitted && !selectedVariant ? formErrors.scope : undefined}>
                    {loadingVariants ? (
                      <p className="text-sm text-muted">Cargando variantes…</p>
                    ) : variants.length === 0 ? (
                      <p className="text-sm text-muted italic">Este artículo no tiene variantes activas.</p>
                    ) : (
                      <TPComboMulti
                        value={selectedVariant ? [selectedVariant.id] : []}
                        onChange={(ids) => {
                          const id = ids[ids.length - 1] ?? null;
                          const v = variants.find((x) => x.id === id) ?? null;
                          setSelectedVariant(v);
                        }}
                        options={variantOptions}
                        placeholder="Seleccionar variante…"
                        disabled={busySave}
                      />
                    )}
                  </TPField>
                )}
              </>
            )}

            {/* Grupo de artículos */}
            {scopeMode === "group" && (
              <TPField
                label="Grupo"
                required
                error={submitted ? formErrors.scope : undefined}
                hint={!editingId ? "Podés seleccionar varios — se creará una regla por grupo" : undefined}
              >
                {allGroups.length === 0 ? (
                  <p className="text-sm text-muted italic">No hay grupos de artículos activos.</p>
                ) : (
                  <TPComboMulti
                    value={selectedGroupIds}
                    onChange={setSelectedGroupIds}
                    options={allGroups.map((g) => ({ value: g.id, label: g.name }))}
                    placeholder="Seleccionar grupo…"
                    disabled={busySave}
                  />
                )}
              </TPField>
            )}
          </ModalSection>

          {/* ---- BLOQUE 2: Tipo de conteo ---- */}
          {(scopeMode === "category" || scopeMode === "brand" || scopeMode === "group") && (
            <ModalSection title="Tipo de conteo de unidades">
              <TPField
                label="Tipo de conteo de unidades"
                hint="Define si el descuento se aplica por cantidad de un mismo producto o sumando varios productos."
              >
                <TPComboFixed
                  value={evaluationMode}
                  onChange={(v) => setEvaluationMode(v as QuantityDiscountEvaluationMode)}
                  disabled={busySave}
                  favoriteValue={defaultEvalMode}
                  onSetFavorite={handleSetDefaultEvalMode}
                  options={[
                    { value: "LINE",           label: "Por producto (cada uno por separado)" },
                    ...(scopeMode === "category" ? [{ value: "CATEGORY_TOTAL", label: "Sumando productos de la categoría" }] : []),
                    ...(scopeMode === "brand"    ? [{ value: "BRAND_TOTAL",    label: "Sumando productos de la marca" }]    : []),
                    ...(scopeMode === "group"    ? [{ value: "GROUP_TOTAL",    label: "Sumando productos del grupo" }]      : []),
                  ]}
                />
              </TPField>
              <p className="text-xs text-muted/70">
                {evaluationMode === "LINE"
                  ? "Cada producto se cuenta por separado. El descuento se activa cuando ese producto supera la cantidad mínima del tramo."
                  : evaluationMode === "CATEGORY_TOTAL"
                    ? "Se suman las cantidades de todos los productos de la misma categoría en el comprobante. El descuento aplica a todos cuando el total alcanza el tramo."
                    : evaluationMode === "GROUP_TOTAL"
                      ? "Se suman las cantidades de todos los productos del mismo grupo en el comprobante. El descuento aplica a todos cuando el total alcanza el tramo."
                      : "Se suman las cantidades de todos los productos de la misma marca en el comprobante. El descuento aplica a todos cuando el total alcanza el tramo."}
              </p>
            </ModalSection>
          )}

          {/* ---- BLOQUE 4: Tramos ---- */}
          <ModalSection title="Tramos de descuento">
            {submitted && formErrors.tiers && (
              <p className="text-xs text-red-500">{formErrors.tiers}</p>
            )}

            <div className="space-y-3">
              {tiers.map((tier, i) => {
                const tierErr = formErrors.tierErrors?.[i];
                return (
                  <div key={tier.key} className="flex items-start gap-2 p-3 border border-border rounded-xl">
                    <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: "0.9fr 1.6fr 1.3fr" }}>
                      <TPField label="Cant. mínima" required error={submitted ? tierErr?.minQty : undefined}>
                        <TPNumberInput
                          value={tier.minQty}
                          onChange={(v) => updateTier(i, { minQty: v })}
                          decimals={0}
                          step={1}
                          min={1}
                          placeholder="3"
                          disabled={busySave}
                        />
                      </TPField>

                      <TPField label="Tipo" required>
                        <TPComboFixed
                          value={tier.type}
                          onChange={(v) => updateTier(i, { type: v as PromotionType })}
                          disabled={busySave}
                          options={[
                            { value: "PERCENTAGE", label: "Porcentaje (%)" },
                            { value: "FIXED",      label: `Monto fijo (${baseCurrencyCode || "$"})` },
                          ]}
                        />
                      </TPField>

                      <TPField label="Descuento" required error={submitted ? tierErr?.value : undefined}>
                        <TPNumberInput
                          value={tier.value}
                          onChange={(v) => updateTier(i, { value: v })}
                          decimals={2}
                          step={1}
                          min={0}
                          placeholder={tier.type === "PERCENTAGE" ? "10" : "500"}
                          disabled={busySave}
                          suffix={tier.type === "PERCENTAGE" ? "%" : undefined}
                          leftIcon={tier.type === "FIXED" ? <span className="text-[11px] font-semibold text-muted">{baseCurrencySymbol}</span> : undefined}
                        />
                        {tier.type === "FIXED" && (
                          <p className="text-xs text-muted mt-1.5">
                            El importe corresponde a la moneda base del sistema{baseCurrencyCode ? ` (${baseCurrencyCode})` : ""}.
                          </p>
                        )}
                      </TPField>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeTier(i)}
                      disabled={busySave || tiers.length <= 1}
                      className="mt-6 flex-shrink-0 p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-500/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Eliminar tramo"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>

            <TPButton
              variant="ghost"
              iconLeft={<Plus size={14} />}
              onClick={addTier}
              disabled={busySave}
              className="w-full border border-dashed border-border hover:border-primary"
            >
              Agregar tramo
            </TPButton>

            {/* Preview de los tramos */}
            {tiers.some((t) => t.minQty != null && t.value != null && t.value > 0) && (
              <div className="rounded-xl bg-primary/5 border border-primary/20 px-3 py-2 space-y-0.5">
                <p className="text-[11px] font-semibold text-primary uppercase tracking-wide mb-1">Resumen</p>
                {[...tiers]
                  .filter((t) => t.minQty != null && t.value != null)
                  .sort((a, b) => (a.minQty ?? 0) - (b.minQty ?? 0))
                  .map((t, idx) => (
                    <p key={idx} className="text-xs text-text tabular-nums">
                      Desde <strong>{qtyDisplay(t.minQty ?? 0)}</strong> unidades →{" "}
                      {t.type === "PERCENTAGE"
                        ? <strong>{t.value}% de descuento</strong>
                        : <strong>{baseCurrencySymbol} {(t.value ?? 0).toLocaleString("es-AR")} por unidad</strong>}
                    </p>
                  ))
                }
              </div>
            )}
          </ModalSection>

          {/* ---- BLOQUE 5: Acumulabilidad ---- */}
          <ModalSection title="Acumulabilidad">
            <TPCheckbox
              checked={isStackable}
              onChange={setIsStackable}
              disabled={busySave}
              label={<span className="text-sm text-text">Acumulable con otros beneficios</span>}
            />
            <p className="text-xs text-muted ml-6">
              {isStackable
                ? "Este descuento se puede combinar con promociones activas. Ambos se aplican en cadena."
                : "Si también aplica una promoción, se calculan por separado y solo se aplica el que deje el menor precio final."}
            </p>
          </ModalSection>

        </div>
      </Modal>

      {/* =========================================================
          MODAL VER DETALLE
      ========================================================= */}
      <Modal
        open={viewOpen}
        title="Detalle de regla"
        onClose={() => setViewOpen(false)}
        maxWidth="sm"
        footer={
          <div className="flex justify-end gap-2">
            <TPButton variant="ghost" onClick={() => setViewOpen(false)} iconLeft={<X size={14} />}>Cerrar</TPButton>
            {viewTarget && (
              <TPButton variant="primary" onClick={() => { setViewOpen(false); openEdit(viewTarget); }} iconLeft={<Pencil size={14} />}>
                Editar
              </TPButton>
            )}
          </div>
        }
      >
        {viewTarget && (
          <div className="text-sm">
            <DetailRow label="Alcance"><ScopeBadge row={viewTarget} /></DetailRow>
            <DetailRow label="Destino">
              {viewTarget.group
                ? <span>{viewTarget.group.name}</span>
                : rowScopeLabel(viewTarget)}
            </DetailRow>
            <DetailRow label="Modo de evaluación">{EVALUATION_MODE_LABELS[viewTarget.evaluationMode ?? "LINE"]}</DetailRow>
            <DetailRow label="Estado"><TPStatusPill active={viewTarget.isActive} /></DetailRow>
            <DetailRow label="Orden">{viewTarget.sortOrder}</DetailRow>

            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Tramos de descuento</p>
              {viewTarget.tiers && viewTarget.tiers.length > 0 ? (
                <div className="space-y-1.5">
                  {[...viewTarget.tiers]
                    .sort((a, b) => parseFloat(a.minQty) - parseFloat(b.minQty))
                    .map((t) => (
                      <div key={t.id} className="flex items-center justify-between px-3 py-2 bg-surface border border-border rounded-lg">
                        <div className="flex items-center gap-2">
                          <TypeBadge type={t.type} baseSym={baseCurrencySymbol} />
                          <span className="text-sm text-muted tabular-nums">≥ {qtyDisplay(t.minQty)}</span>
                        </div>
                        <span className="text-sm font-semibold text-text">{tierValueDisplay(t, baseCurrencySymbol)}</span>
                      </div>
                    ))
                  }
                </div>
              ) : (
                <p className="text-sm text-muted italic">Sin tramos.</p>
              )}
            </div>

            <DetailRow label="Creado el" borderBottom={false}>
              {new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(viewTarget.createdAt))}
            </DetailRow>
          </div>
        )}
      </Modal>

      <ConfirmDeleteDialog {...deleteDialogProps} />
    </TPSectionShell>
  );
}
