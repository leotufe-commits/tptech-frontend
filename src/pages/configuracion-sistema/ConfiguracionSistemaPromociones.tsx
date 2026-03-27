// src/pages/configuracion-sistema/ConfiguracionSistemaPromociones.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useConfirmDelete } from "../../hooks/useConfirmDelete";
import {
  AlertTriangle,
  BadgePercent,
  CalendarClock,
  CheckCircle2,
  Clock,
  Package,
  Plus,
  Save,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { cn } from "../../components/ui/tp";
import { TPSectionShell } from "../../components/ui/TPSectionShell";
import { TPButton } from "../../components/ui/TPButton";
import TPInput from "../../components/ui/TPInput";
import { TPField } from "../../components/ui/TPField";
import { TPCheckbox } from "../../components/ui/TPCheckbox";
import TPTextarea from "../../components/ui/TPTextarea";
import { Modal } from "../../components/ui/Modal";
import ConfirmDeleteDialog from "../../components/ui/ConfirmDeleteDialog";
import { TPTr, TPTd } from "../../components/ui/TPTable";
import { TPTableKit, type TPColDef } from "../../components/ui/TPTableKit";
import { TPStatusPill } from "../../components/ui/TPStatusPill";
import { TPRowActions } from "../../components/ui/TPRowActions";
import TPComboFixed from "../../components/ui/TPComboFixed";
import TPComboMulti from "../../components/ui/TPComboMulti";
import type { ComboMultiOption } from "../../components/ui/TPComboMulti";
import TPNumberInput from "../../components/ui/TPNumberInput";
import TPDateRangeInline from "../../components/ui/TPDateRangeInline";
import { CategoryTreePicker } from "../../components/ui/CategoryTreePicker";

import { toast } from "../../lib/toast";
import {
  promotionsApi,
  type PromotionRow,
  type PromotionType,
  type PromotionScope,
  type PromotionPayload,
  PROMOTION_TYPE_LABELS,
  PROMOTION_SCOPE_LABELS,
} from "../../services/promotions";
import { articlesApi } from "../../services/articles";
import type { ArticleRow } from "../../services/articles";
import { categoriesApi } from "../../services/categories";
import type { CategoryRow } from "../../services/categories";

/* Variante enriquecida con referencia al artículo padre */
type VariantOption = ComboMultiOption & { articleId: string };

type ScopeMode = "all" | "category" | "article_variant" | "brand";

/* =========================================================
   Label maps
========================================================= */
const TYPE_COLORS: Record<PromotionType, string> = {
  FIXED:      "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  PERCENTAGE: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
};

/* =========================================================
   Helpers
========================================================= */
function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit", month: "2-digit", year: "numeric",
    }).format(new Date(iso));
  } catch { return iso ?? "—"; }
}

function formatISOtoDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  } catch { return ""; }
}

type VigenciaState = "active" | "expired" | "upcoming" | "permanent";

function vigenciaState(row: PromotionRow): VigenciaState {
  const now = new Date();
  const from = row.validFrom ? new Date(row.validFrom) : null;
  const to   = row.validTo   ? new Date(row.validTo)   : null;
  if (!from && !to) return "permanent";
  if (from && from > now) return "upcoming";
  if (to && to < now)     return "expired";
  return "active";
}

/* =========================================================
   Badges
========================================================= */
function TypeBadge({ type }: { type: PromotionType }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
      TYPE_COLORS[type]
    )}>
      {type === "PERCENTAGE" ? "%" : "$"} {PROMOTION_TYPE_LABELS[type]}
    </span>
  );
}

function VigenciaBadge({ row }: { row: PromotionRow }) {
  const state = vigenciaState(row);
  const cfg: Record<VigenciaState, { label: string; cls: string; Icon: React.ComponentType<{ size?: number }> }> = {
    permanent: { label: "Siempre activa", cls: "bg-gray-500/10 text-muted",                                      Icon: CalendarClock },
    active:    { label: "Vigente",        cls: "bg-green-500/15 text-green-600 dark:text-green-400",             Icon: CheckCircle2 },
    expired:   { label: "Vencida",        cls: "bg-red-500/15 text-red-600 dark:text-red-400",                   Icon: AlertTriangle },
    upcoming:  { label: "Próxima",        cls: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",          Icon: Clock },
  };
  const { label, cls, Icon } = cfg[state];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", cls)}>
      <Icon size={11} />
      {label}
    </span>
  );
}

function StockBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">
      <Package size={11} />
      Hasta stock
    </span>
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
   Fila detail en modal ver
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
   Formato de valor de promo
========================================================= */
function valueDisplay(row: PromotionRow): string {
  const v = parseFloat(row.value);
  if (isNaN(v)) return "—";
  if (row.type === "PERCENTAGE") return `${v.toLocaleString("es-AR")}%`;
  return `$${v.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
}

/* =========================================================
   Draft y validación
========================================================= */
const EMPTY_DRAFT = {
  name:          "",
  type:          "PERCENTAGE" as PromotionType,
  value:         "",
  priority:      "",
  validFrom:     "",
  validTo:       "",
  untilStockEnd: false,
  isActive:      true,
  notes:         "",
};

type Draft = typeof EMPTY_DRAFT;

type FormErrors = {
  name?:  string;
  value?: string;
  scope?: string;
};

function validate(
  draft: Draft,
  valueNum: number | null,
  scope: ScopeMode,
  articles: ArticleRow[],
  variantIds: string[],
  showVariantPicker: boolean,
  categoryIds: string[],
  brands: string[]
): FormErrors {
  const errors: FormErrors = {};
  if (!draft.name.trim()) errors.name = "El nombre es obligatorio.";
  if (valueNum == null || isNaN(valueNum) || valueNum <= 0) {
    errors.value = "El valor debe ser mayor a 0.";
  }
  if (scope === "category" && categoryIds.length === 0) {
    errors.scope = "Seleccioná al menos una categoría.";
  } else if (scope === "article_variant" && articles.length === 0) {
    errors.scope = "Seleccioná al menos un artículo.";
  } else if (scope === "article_variant" && showVariantPicker && variantIds.length === 0) {
    errors.scope = "Seleccioná al menos una variante, o desactivá el filtro por variante.";
  } else if (scope === "brand" && brands.length === 0) {
    errors.scope = "Seleccioná al menos una marca.";
  }
  return errors;
}

/* =========================================================
   Columnas
========================================================= */
const PROMO_COLS: TPColDef[] = [
  { key: "name",     label: "Nombre",    canHide: false, sortKey: "name" },
  { key: "tipo",     label: "Tipo",      sortKey: "type" },
  { key: "valor",    label: "Valor" },
  { key: "alcance",  label: "Alcance" },
  { key: "vigencia", label: "Vigencia" },
  { key: "prioridad",label: "Prioridad", sortKey: "priority" },
  { key: "estado",   label: "Estado" },
  { key: "acciones", label: "Acciones",  canHide: false, align: "right" },
];

/* =========================================================
   CategoryTreePicker — importado de components/ui/CategoryTreePicker
========================================================= */

/* =========================================================
   Página principal
========================================================= */
export default function ConfiguracionSistemaPromociones() {
  /* ---- estado principal ---- */
  const [rows, setRows]       = useState<PromotionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ]             = useState("");

  /* ---- filtros adicionales ---- */
  const [filterType,    setFilterType]    = useState<PromotionType | "">("");
  const [filterActive,  setFilterActive]  = useState<"" | "true" | "false">("");
  const [filterVigencia, setFilterVigencia] = useState<VigenciaState | "">("");
  const [showFilters,   setShowFilters]   = useState(false);

  const activeFilterCount = [filterType, filterActive, filterVigencia].filter(Boolean).length;
  function clearFilters() {
    setFilterType("");
    setFilterActive("");
    setFilterVigencia("");
  }

  /* ---- sort ---- */
  type SortKey = "name" | "type" | "priority" | "createdAt";
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  /* ---- modal editar/crear ---- */
  const [editOpen,   setEditOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState<PromotionRow | null>(null);
  const [draft, setDraft]           = useState<Draft>(EMPTY_DRAFT);
  const [submitted, setSubmitted]   = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [valueNum, setValueNum]     = useState<number | null>(null);
  const [priorityNum, setPriorityNum] = useState<number | null>(null);

  /* ---- catálogos para el selector de alcance ---- */
  const [allCategories, setAllCategories] = useState<CategoryRow[]>([]);
  const [allBrands, setAllBrands]         = useState<string[]>([]);
  const [allArticles, setAllArticles]     = useState<ArticleRow[]>([]);

  /* ---- selector de alcance ---- */
  const [scopeMode, setScopeMode]                   = useState<ScopeMode>("all");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands]           = useState<string[]>([]);
  const [selectedArticles, setSelectedArticles]       = useState<ArticleRow[]>([]);
  const [variantOptions, setVariantOptions]           = useState<VariantOption[]>([]);
  const [selectedVariantIds, setSelectedVariantIds]   = useState<string[]>([]);
  const [loadingVariants, setLoadingVariants]         = useState(false);
  const [showVariantPicker, setShowVariantPicker]     = useState(false);

  /* ---- modal ver ---- */
  const [viewOpen,   setViewOpen]   = useState(false);
  const [viewTarget, setViewTarget] = useState<PromotionRow | null>(null);

  const { askDelete, dialogProps: deleteDialogProps } = useConfirmDelete();

  /* ---- busy ---- */
  const [busySave, setBusySave]     = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  /* ---- carga inicial ---- */
  async function load() {
    try {
      setLoading(true);
      const data = await promotionsApi.list({ take: 200 });
      setRows(data.data ?? []);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo cargar la lista de promociones.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // Cargar catálogos para el selector de alcance
    categoriesApi.list()
      .then((cats) => setAllCategories((cats ?? []).filter((c) => c.isActive && !c.deletedAt)))
      .catch(() => {});
    articlesApi.listBrands()
      .then((res) => setAllBrands(res.brands ?? []))
      .catch(() => {});
    articlesApi.list({ take: 500, status: "ACTIVE" })
      .then((res) => setAllArticles(res.rows ?? []))
      .catch(() => {});
  }, []);

  /* ---- cargar variantes cuando cambian los artículos seleccionados ---- */
  useEffect(() => {
    if (selectedArticles.length === 0) {
      setVariantOptions([]);
      setSelectedVariantIds([]);
      return;
    }
    setLoadingVariants(true);
    Promise.all(
      selectedArticles.map((a) =>
        articlesApi.variants.list(a.id).then((vars) =>
          (vars ?? [])
            .filter((v) => v.isActive)
            .map((v): VariantOption => ({
              value:     v.id,
              label:     v.name + (v.sku ? ` (${v.sku})` : ""),
              sublabel:  a.name,
              articleId: a.id,
            }))
        )
      )
    )
      .then((results) => {
        const all = results.flat();
        setVariantOptions(all);
        // Eliminar variantes ya no disponibles
        setSelectedVariantIds((prev) => prev.filter((id) => all.some((v) => v.value === id)));
      })
      .catch(() => setVariantOptions([]))
      .finally(() => setLoadingVariants(false));
  }, [selectedArticles]);

  /* ---- filtrado y ordenamiento ---- */
  const filteredRows = useMemo(() => {
    const s = q.trim().toLowerCase();
    let filtered = rows;

    if (s) {
      filtered = filtered.filter((r) => {
        if (r.name.toLowerCase().includes(s)) return true;
        if (r.articles.some((a) => a.article.name.toLowerCase().includes(s) || a.article.code.toLowerCase().includes(s))) return true;
        if (r.variants.some((v) => v.variant.name.toLowerCase().includes(s))) return true;
        if (r.categories.some((c) => c.category.name.toLowerCase().includes(s))) return true;
        if (r.brands.some((b) => b.brand.toLowerCase().includes(s))) return true;
        return false;
      });
    }
    if (filterType)   filtered = filtered.filter((r) => r.type === filterType);
    if (filterActive !== "") {
      const want = filterActive === "true";
      filtered = filtered.filter((r) => r.isActive === want);
    }
    if (filterVigencia !== "") {
      filtered = filtered.filter((r) => vigenciaState(r) === filterVigencia);
    }

    return [...filtered].sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name")     return a.name.localeCompare(b.name, "es") * mul;
      if (sortKey === "type")     return a.type.localeCompare(b.type)       * mul;
      if (sortKey === "priority") return (a.priority - b.priority)          * mul;
      if (sortKey === "createdAt")return a.createdAt.localeCompare(b.createdAt) * mul;
      return 0;
    });
  }, [rows, q, filterType, filterActive, filterVigencia, sortKey, sortDir]);

  /* ---- helpers draft ---- */
  function patchDraft(patch: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  /* ---- abrir modal crear ---- */
  function openCreate() {
    setEditTarget(null);
    setDraft(EMPTY_DRAFT);
    setValueNum(null);
    setPriorityNum(null);
    setScopeMode("all");
    setSelectedCategoryIds([]);
    setSelectedBrands([]);
    setSelectedArticles([]);
    setVariantOptions([]);
    setSelectedVariantIds([]);
    setShowVariantPicker(false);
    setSubmitted(false);
    setFormErrors({});
    setEditOpen(true);
  }

  /* ---- abrir modal editar ---- */
  function openEdit(row: PromotionRow) {
    setEditTarget(row);
    setValueNum(parseFloat(row.value) || null);
    setPriorityNum(row.priority ?? 0);
    setDraft({
      name:          row.name,
      type:          row.type,
      value:         row.value,
      priority:      String(row.priority ?? 0),
      validFrom:     formatISOtoDateInput(row.validFrom),
      validTo:       formatISOtoDateInput(row.validTo),
      untilStockEnd: row.untilStockEnd,
      isActive:      row.isActive,
      notes:         row.notes ?? "",
    });
    // Inferir modo de alcance desde el campo scope (4 opciones en UI)
    if (row.scope === "ARTICLE" || row.scope === "VARIANT") {
      setScopeMode("article_variant");
    } else if (row.scope === "CATEGORY") {
      setScopeMode("category");
    } else if (row.scope === "BRAND") {
      setScopeMode("brand");
    } else {
      setScopeMode("all");
    }

    // Inicializar selectores desde las tablas junction
    setSelectedCategoryIds(row.categories.map((c) => c.categoryId));
    setSelectedBrands(row.brands.map((b) => b.brand));

    if (row.scope === "VARIANT") {
      // Para variantes: reconstruir los artículos padre desde las variantes
      const articleMap = new Map<string, ArticleRow>();
      row.variants.forEach((v) => {
        if (v.variant.article) {
          articleMap.set(v.variant.articleId, v.variant.article as unknown as ArticleRow);
        }
      });
      setSelectedArticles([...articleMap.values()]);
      setSelectedVariantIds(row.variants.map((v) => v.variantId));
      setShowVariantPicker(true);
    } else if (row.scope === "ARTICLE") {
      setSelectedArticles(row.articles.map((a) => a.article as unknown as ArticleRow));
      setSelectedVariantIds([]);
      setShowVariantPicker(false);
    } else {
      setSelectedArticles([]);
      setSelectedVariantIds([]);
      setShowVariantPicker(false);
    }
    setVariantOptions([]);
    setSubmitted(false);
    setFormErrors({});
    setEditOpen(true);
  }

  /* ---- abrir modal ver ---- */
  function openView(row: PromotionRow) {
    setViewTarget(row);
    setViewOpen(true);
  }

  /* ---- guardar ---- */
  async function handleSave() {
    setSubmitted(true);
    const errors = validate(draft, valueNum, scopeMode, selectedArticles, selectedVariantIds, showVariantPicker, selectedCategoryIds, selectedBrands);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    // Resolver scope backend desde las 4 opciones UI
    let scope: PromotionScope;
    if (scopeMode === "all")            scope = "ALL";
    else if (scopeMode === "category")  scope = "CATEGORY";
    else if (scopeMode === "brand")     scope = "BRAND";
    else if (showVariantPicker && selectedVariantIds.length > 0) scope = "VARIANT";
    else                                scope = "ARTICLE";

    const payload: PromotionPayload = {
      name:          draft.name.trim(),
      type:          draft.type,
      value:         valueNum!,
      scope,
      articleIds:    scope === "ARTICLE" ? selectedArticles.map((a) => a.id) : [],
      variantIds:    scope === "VARIANT"  ? selectedVariantIds : [],
      categoryIds:   scope === "CATEGORY" ? selectedCategoryIds : [],
      brands:        scope === "BRAND"    ? selectedBrands : [],
      priority:      priorityNum ?? 0,
      validFrom:     draft.validFrom || null,
      validTo:       draft.validTo   || null,
      untilStockEnd: draft.untilStockEnd,
      isActive:      draft.isActive,
      notes:         draft.notes.trim(),
    };

    try {
      setBusySave(true);
      if (editTarget) {
        await promotionsApi.update(editTarget.id, payload);
        toast.success("Promoción actualizada.");
      } else {
        await promotionsApi.create(payload);
        toast.success("Promoción creada correctamente.");
      }
      setEditOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Ocurrió un error al guardar.");
    } finally {
      setBusySave(false);
    }
  }

  /* ---- toggle activo/inactivo ---- */
  async function handleToggle(row: PromotionRow) {
    try {
      setTogglingId(row.id);
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, isActive: !r.isActive } : r));
      await promotionsApi.update(row.id, { isActive: !row.isActive });
      toast.success(row.isActive ? "Promoción desactivada." : "Promoción activada.");
      await load();
    } catch (e: any) {
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, isActive: row.isActive } : r));
      toast.error(e?.message || "No se pudo cambiar el estado.");
    } finally {
      setTogglingId(null);
    }
  }

  /* ---- errores en tiempo real ---- */
  const errors = submitted ? formErrors : {};

  /* =========================================================
     RENDER
  ========================================================= */
  return (
    <TPSectionShell
      title="Promociones"
      subtitle="Descuentos especiales por tiempo o evento, aplicados con máxima prioridad en el punto de venta"
      icon={<BadgePercent size={22} />}
    >
      <TPTableKit
        rows={filteredRows}
        columns={PROMO_COLS}
        storageKey="tptech_col_promociones"
        search={q}
        onSearchChange={setQ}
        searchPlaceholder="Buscar por nombre o artículo…"
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={(key) => toggleSort(key as SortKey)}
        loading={loading}
        emptyText={
          q || filterType || filterActive || filterVigencia
            ? "No hay resultados para esos filtros."
            : "Todavía no hay promociones. Creá la primera."
        }
        pagination
        countLabel={(n) => `${n} ${n === 1 ? "promoción" : "promociones"}`}
        responsive="stack"
        actions={
          <div className="flex items-center gap-2">
            <TPButton
              variant="secondary"
              iconLeft={<SlidersHorizontal size={14} />}
              onClick={() => setShowFilters((v) => !v)}
              className={cn((showFilters || activeFilterCount > 0) && "border-primary/40 text-primary")}
            >
              <span className="hidden sm:inline">Filtros</span>
              {activeFilterCount > 0 && (
                <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ml-0.5">
                  {activeFilterCount}
                </span>
              )}
            </TPButton>
            <TPButton variant="primary" iconLeft={<Plus size={16} />} onClick={openCreate}>
              Nueva promoción
            </TPButton>
          </div>
        }
        belowHeader={showFilters ? (
          <div className="px-4 pb-4 pt-3 border-b border-border bg-surface/30">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <TPComboFixed
                value={filterType}
                onChange={(v) => setFilterType(v as PromotionType | "")}
                placeholder="Tipo: todos"
                options={[
                  { value: "", label: "Tipo: todos" },
                  { value: "FIXED",      label: "Monto fijo ($)" },
                  { value: "PERCENTAGE", label: "Porcentaje (%)" },
                ]}
              />
              <TPComboFixed
                value={filterActive}
                onChange={(v) => setFilterActive(v as "" | "true" | "false")}
                placeholder="Estado: todos"
                options={[
                  { value: "",      label: "Estado: todos" },
                  { value: "true",  label: "Activas" },
                  { value: "false", label: "Inactivas" },
                ]}
              />
              <TPComboFixed
                value={filterVigencia}
                onChange={(v) => setFilterVigencia(v as VigenciaState | "")}
                placeholder="Vigencia: todas"
                options={[
                  { value: "",          label: "Vigencia: todas" },
                  { value: "active",    label: "Vigentes" },
                  { value: "upcoming",  label: "Próximas" },
                  { value: "expired",   label: "Vencidas" },
                  { value: "permanent", label: "Sin vencimiento" },
                ]}
              />
            </div>
            {activeFilterCount > 0 && (
              <div className="mt-3 flex justify-end">
                <TPButton
                  variant="ghost"
                  iconLeft={<X size={11} />}
                  onClick={clearFilters}
                  className="text-xs text-muted hover:text-primary"
                >
                  Limpiar filtros
                </TPButton>
              </div>
            )}
          </div>
        ) : undefined}
        onRowClick={(row) => openView(row)}
        renderRow={(row, vis) => (
          <TPTr key={row.id} className={!row.isActive ? "opacity-60" : undefined}>
            {vis.name && (
              <TPTd>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-medium text-text truncate">{row.name}</span>
                  {row.untilStockEnd && <StockBadge />}
                </div>
              </TPTd>
            )}
            {vis.tipo && (
              <TPTd className="hidden md:table-cell">
                <TypeBadge type={row.type} />
              </TPTd>
            )}
            {vis.valor && (
              <TPTd className="hidden md:table-cell">
                <span className="text-sm font-semibold text-text">{valueDisplay(row)}</span>
              </TPTd>
            )}
            {vis.alcance && (
              <TPTd className="hidden lg:table-cell">
                {row.scope === "ALL" ? (
                  <span className="text-xs text-muted italic">Todos los artículos</span>
                ) : (
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[10px] font-semibold uppercase text-muted tracking-wide">
                      {PROMOTION_SCOPE_LABELS[row.scope]}
                    </span>
                    <span className="text-sm text-text truncate max-w-[200px]">
                      {row.scope === "ARTICLE"
                        ? row.articles.map((a) => a.article.name).join(", ") || "—"
                        : row.scope === "VARIANT"
                        ? row.variants.map((v) => v.variant.name).join(", ") || "—"
                        : row.scope === "CATEGORY"
                        ? row.categories.map((c) => c.category.name).join(", ") || "—"
                        : row.scope === "BRAND"
                        ? row.brands.map((b) => b.brand).join(", ") || "—"
                        : "—"}
                    </span>
                  </div>
                )}
              </TPTd>
            )}
            {vis.vigencia && (
              <TPTd className="hidden lg:table-cell">
                <div className="flex flex-col gap-1">
                  {row.validFrom || row.validTo ? (
                    <div className="text-xs text-muted whitespace-nowrap flex items-center gap-1">
                      <CalendarClock size={12} className="text-muted shrink-0" />
                      {formatDate(row.validFrom)} — {row.validTo ? formatDate(row.validTo) : "∞"}
                    </div>
                  ) : (
                    <span className="text-xs text-muted italic">Sin vencimiento</span>
                  )}
                  <VigenciaBadge row={row} />
                </div>
              </TPTd>
            )}
            {vis.prioridad && (
              <TPTd className="hidden md:table-cell">
                <span className="text-sm text-text">{row.priority}</span>
              </TPTd>
            )}
            {vis.estado && (
              <TPTd className="hidden md:table-cell">
                <TPStatusPill active={row.isActive} />
              </TPTd>
            )}
            {vis.acciones && (
              <TPTd className="text-right">
                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                  {/* Mobile: mostrar badges inline */}
                  <span className="md:hidden"><TypeBadge type={row.type} /></span>
                  <span className="md:hidden"><TPStatusPill active={row.isActive} /></span>
                  <TPRowActions
                    onView={() => openView(row)}
                    onEdit={() => openEdit(row)}
                    onToggle={() => handleToggle(row)}
                    isActive={row.isActive}
                    toggleDisabled={togglingId === row.id}
                    busyToggle={togglingId === row.id}
                    onDelete={() =>
                      askDelete({
                        entityName: "promoción",
                        entityLabel: row.name,
                        onDelete: () => promotionsApi.remove(row.id),
                        onAfterSuccess: load,
                      })
                    }
                  />
                </div>
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
        title={editTarget ? "Editar promoción" : "Nueva promoción"}
        maxWidth="lg"
        busy={busySave}
        onClose={() => !busySave && setEditOpen(false)}
        onEnter={handleSave}
        footer={
          <>
            <TPButton
              variant="secondary"
              onClick={() => setEditOpen(false)}
              disabled={busySave}
              iconLeft={<X size={16} />}
            >
              Cancelar
            </TPButton>
            <TPButton
              variant="primary"
              onClick={handleSave}
              loading={busySave}
              iconLeft={<Save size={16} />}
            >
              Guardar
            </TPButton>
          </>
        }
      >
        <div className="space-y-6">

          {/* Bloque 1: Nombre + Tipo + Valor + Prioridad */}
          <ModalSection title="Descripción y descuento">
            <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 100px" }}>
              <TPField label="Nombre" required error={errors.name}>
                <TPInput
                  value={draft.name}
                  onChange={(v) => patchDraft({ name: v })}
                  placeholder="Ej: Promo de verano, Liquidación anillos…"
                  disabled={busySave}
                  data-tp-autofocus="1"
                />
              </TPField>
              <TPField label="Prioridad">
                <TPNumberInput
                  value={priorityNum}
                  onChange={setPriorityNum}
                  decimals={0}
                  step={1}
                  min={0}
                  placeholder="0"
                  disabled={busySave}
                />
              </TPField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TPField label="Tipo de descuento">
                <TPComboFixed
                  value={draft.type}
                  onChange={(v) => patchDraft({ type: v as PromotionType })}
                  disabled={busySave}
                  options={[
                    { value: "PERCENTAGE", label: "Porcentaje (%)" },
                    { value: "FIXED",      label: "Monto fijo ($)" },
                  ]}
                />
              </TPField>
              <TPField
                label={draft.type === "PERCENTAGE" ? "% Descuento" : "Monto ($)"}
                required
                error={errors.value}
              >
                <TPNumberInput
                  value={valueNum}
                  onChange={setValueNum}
                  decimals={2}
                  step={1}
                  min={0}
                  placeholder={draft.type === "PERCENTAGE" ? "15" : "500"}
                  disabled={busySave}
                  suffix={draft.type === "PERCENTAGE" ? "%" : undefined}
                  leftIcon={draft.type === "FIXED" ? "$" : undefined}
                />
              </TPField>
            </div>
            <p className="text-xs text-muted -mt-1">
              {draft.type === "PERCENTAGE" && valueNum != null && valueNum > 0
                ? `Descuento del ${valueNum}% sobre el precio de venta. Menor número de prioridad = mayor precedencia.`
                : draft.type === "FIXED" && valueNum != null && valueNum > 0
                  ? `Se resta $${valueNum.toLocaleString("es-AR")} al precio de venta. Menor número de prioridad = mayor precedencia.`
                  : "Menor número de prioridad = mayor precedencia sobre otras promociones activas."}
            </p>
          </ModalSection>

          {/* Bloque 2: Alcance */}
          <ModalSection title="Alcance">
            <TPField label="¿A quién aplica esta promoción?">
              <TPComboFixed
                value={scopeMode}
                onChange={(v) => {
                  setScopeMode(v as ScopeMode);
                  setSelectedCategoryIds([]);
                  setSelectedBrands([]);
                  setSelectedArticles([]);
                  setVariantOptions([]);
                  setSelectedVariantIds([]);
                  setShowVariantPicker(false);
                }}
                disabled={busySave}
                options={[
                  { value: "all",            label: "Todos los artículos" },
                  { value: "category",       label: "Categorías" },
                  { value: "brand",          label: "Marcas" },
                  { value: "article_variant",label: "Artículos y variantes" },
                ]}
              />
            </TPField>

            {/* Categorías — árbol jerárquico con cascade */}
            {scopeMode === "category" && (
              <TPField label="Categorías" required>
                <CategoryTreePicker
                  categories={allCategories}
                  value={selectedCategoryIds}
                  onChange={setSelectedCategoryIds}
                  disabled={busySave}
                />
              </TPField>
            )}

            {/* Artículos y variantes */}
            {scopeMode === "article_variant" && (
              <>
                <TPField label="Artículos" required>
                  <TPComboMulti
                    value={selectedArticles.map((a) => a.id)}
                    onChange={(ids) => {
                      const next = [
                        ...selectedArticles.filter((a) => !allArticles.some((b) => b.id === a.id)),
                        ...allArticles.filter((a) => ids.includes(a.id)),
                      ];
                      setSelectedArticles(next);
                      if (next.length === 0) {
                        setSelectedVariantIds([]);
                        setShowVariantPicker(false);
                      }
                    }}
                    options={[
                      ...selectedArticles
                        .filter((a) => !allArticles.some((b) => b.id === a.id))
                        .map((a) => ({ value: a.id, label: a.name, sublabel: a.code })),
                      ...allArticles.map((a) => ({ value: a.id, label: a.name, sublabel: a.code })),
                    ]}
                    placeholder="Seleccionar artículos…"
                    disabled={busySave}
                  />
                </TPField>

                {selectedArticles.length > 0 && (
                  <div className="flex items-center gap-2">
                    <TPCheckbox
                      checked={showVariantPicker}
                      onChange={(v) => {
                        setShowVariantPicker(v);
                        if (!v) setSelectedVariantIds([]);
                      }}
                      disabled={busySave}
                      label={
                        <span className="text-sm text-text">
                          Restringir a variantes específicas
                        </span>
                      }
                    />
                  </div>
                )}

                {showVariantPicker && selectedArticles.length > 0 && (
                  <TPField label="Variantes" required>
                    {loadingVariants ? (
                      <div className="text-xs text-muted py-2">Cargando variantes…</div>
                    ) : variantOptions.length === 0 ? (
                      <p className="text-xs text-muted py-2 italic">
                        Los artículos seleccionados no tienen variantes activas.
                      </p>
                    ) : (
                      <TPComboMulti
                        value={selectedVariantIds}
                        onChange={setSelectedVariantIds}
                        options={variantOptions}
                        placeholder="Seleccionar variantes…"
                        disabled={busySave}
                      />
                    )}
                  </TPField>
                )}
              </>
            )}

            {/* Marcas */}
            {scopeMode === "brand" && (
              <TPField label="Marcas" required>
                {allBrands.length === 0 ? (
                  <p className="text-xs text-muted py-2 italic">
                    No hay marcas registradas en artículos activos.
                  </p>
                ) : (
                  <TPComboMulti
                    value={selectedBrands}
                    onChange={setSelectedBrands}
                    options={allBrands.map((b) => ({ value: b, label: b }))}
                    placeholder="Seleccionar marcas…"
                    disabled={busySave}
                  />
                )}
              </TPField>
            )}

            {/* Info: una promo puede incluir múltiples items */}
            {scopeMode !== "all" && (() => {
              const count =
                scopeMode === "category"       ? selectedCategoryIds.length :
                scopeMode === "brand"          ? selectedBrands.length :
                scopeMode === "article_variant" && showVariantPicker ? selectedVariantIds.length :
                scopeMode === "article_variant" ? selectedArticles.length : 0;
              if (count <= 1) return null;
              return (
                <div className="flex items-center gap-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2 text-xs text-blue-600 dark:text-blue-400">
                  <Package size={13} className="shrink-0" />
                  Esta promoción aplicará a los {count} ítems seleccionados.
                </div>
              );
            })()}

            {errors.scope && (
              <p className="text-xs text-red-500">{errors.scope}</p>
            )}
          </ModalSection>

          {/* Bloque 3: Vigencia */}
          <ModalSection title="Vigencia">
            <TPDateRangeInline
              showPresets={false}
              fromLabel="Válida desde"
              toLabel="Válida hasta"
              disabled={busySave}
              value={{
                from: draft.validFrom ? new Date(draft.validFrom + "T00:00:00") : null,
                to:   draft.validTo   ? new Date(draft.validTo   + "T00:00:00") : null,
              }}
              onChange={(v) => {
                const fmt = (d: Date | null) =>
                  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "";
                patchDraft({ validFrom: fmt(v.from), validTo: fmt(v.to) });
              }}
            />
            <div className="mt-3">
              <TPCheckbox
                checked={draft.untilStockEnd}
                onChange={(v) => patchDraft({ untilStockEnd: v })}
                disabled={busySave}
                label={<span className="text-sm text-text">Mantener hasta agotar stock</span>}
              />
              {draft.untilStockEnd && (
                <p className="mt-1 ml-6 text-xs text-muted">
                  Marca de gestión interna: indica que la promoción debe mantenerse hasta agotar el stock disponible. No reemplaza la fecha de vencimiento.
                </p>
              )}
            </div>
            {draft.validTo && draft.untilStockEnd && (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>La fecha de vencimiento tiene prioridad. La promoción dejará de aplicarse cuando alcance la fecha "Válida hasta", independientemente del stock restante.</span>
              </div>
            )}
          </ModalSection>

          {/* Bloque 4: Notas */}
          <ModalSection title="Notas internas">
            <TPTextarea
              value={draft.notes}
              onChange={(v) => patchDraft({ notes: v })}
              placeholder="Notas internas opcionales para el equipo…"
              disabled={busySave}
              minH={72}
            />
          </ModalSection>

        </div>
      </Modal>

      {/* =========================================================
          MODAL VER DETALLE
      ========================================================= */}
      <Modal
        open={viewOpen}
        title={viewTarget?.name ?? "Detalle de promoción"}
        subtitle={viewTarget ? PROMOTION_TYPE_LABELS[viewTarget.type] : undefined}
        maxWidth="sm"
        onClose={() => setViewOpen(false)}
        footer={
          <div className="flex gap-2">
            <TPButton variant="secondary" onClick={() => {
              setViewOpen(false);
              if (viewTarget) openEdit(viewTarget);
            }}>
              Editar
            </TPButton>
            <TPButton variant="secondary" onClick={() => setViewOpen(false)}>
              Cerrar
            </TPButton>
          </div>
        }
      >
        {viewTarget && (
          <div className="space-y-0 text-sm">
            <DetailRow label="Nombre">{viewTarget.name}</DetailRow>
            <DetailRow label="Tipo">
              <TypeBadge type={viewTarget.type} />
            </DetailRow>
            <DetailRow label="Valor">
              <span className="font-semibold">{valueDisplay(viewTarget)}</span>
            </DetailRow>
            <DetailRow label="Prioridad">{viewTarget.priority}</DetailRow>
            <DetailRow label="Alcance">
              {viewTarget.scope === "ALL" ? (
                <span className="text-muted italic">Todos los artículos</span>
              ) : viewTarget.scope === "ARTICLE" ? (
                <div className="text-right">
                  <span className="text-[10px] uppercase font-semibold text-muted block">Artículos</span>
                  {viewTarget.articles.map((a) => (
                    <div key={a.articleId} className="text-sm"><strong>{a.article.name}</strong> <span className="text-muted">({a.article.code})</span></div>
                  ))}
                </div>
              ) : viewTarget.scope === "VARIANT" ? (
                <div className="text-right">
                  <span className="text-[10px] uppercase font-semibold text-muted block">Variantes</span>
                  {viewTarget.variants.map((v) => (
                    <div key={v.variantId} className="text-sm"><strong>{v.variant.name}</strong>{v.variant.article && <span className="text-muted"> — {v.variant.article.name}</span>}</div>
                  ))}
                </div>
              ) : viewTarget.scope === "CATEGORY" ? (
                <div className="text-right">
                  <span className="text-[10px] uppercase font-semibold text-muted block">Categorías</span>
                  {viewTarget.categories.map((c) => (
                    <div key={c.categoryId} className="text-sm"><strong>{c.category.name}</strong></div>
                  ))}
                </div>
              ) : viewTarget.scope === "BRAND" ? (
                <div className="text-right">
                  <span className="text-[10px] uppercase font-semibold text-muted block">Marcas</span>
                  {viewTarget.brands.map((b) => (
                    <div key={b.brand} className="text-sm"><strong>{b.brand}</strong></div>
                  ))}
                </div>
              ) : null}
            </DetailRow>
            <DetailRow label="Válida desde">
              {viewTarget.validFrom ? formatDate(viewTarget.validFrom) : <span className="text-muted italic">Sin fecha</span>}
            </DetailRow>
            <DetailRow label="Válida hasta">
              <div className="flex items-center gap-2 justify-end flex-wrap">
                {viewTarget.validTo
                  ? <><span>{formatDate(viewTarget.validTo)}</span><VigenciaBadge row={viewTarget} /></>
                  : <span className="text-muted italic">Sin vencimiento</span>
                }
              </div>
            </DetailRow>
            <DetailRow label="Hasta agotar stock">
              {viewTarget.untilStockEnd
                ? <div className="flex items-center gap-2 justify-end"><span>Sí</span><StockBadge /></div>
                : "No"
              }
            </DetailRow>
            <DetailRow label="Estado">
              <TPStatusPill active={viewTarget.isActive} />
            </DetailRow>
            {viewTarget.notes && (
              <div className="flex flex-col gap-1 py-2 border-b border-border">
                <span className="text-muted font-medium">Notas</span>
                <span className="text-text">{viewTarget.notes}</span>
              </div>
            )}
            <DetailRow label="Creada el" borderBottom={false}>
              {formatDate(viewTarget.createdAt)}
            </DetailRow>
          </div>
        )}
      </Modal>

      <ConfirmDeleteDialog {...deleteDialogProps} />
    </TPSectionShell>
  );
}
