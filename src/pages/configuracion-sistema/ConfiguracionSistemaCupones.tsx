// src/pages/configuracion-sistema/ConfiguracionSistemaCupones.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useConfirmDelete } from "../../hooks/useConfirmDelete";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CalendarClock,
  Plus,
  Ticket,
  X,
  Check,
} from "lucide-react";

import { cn } from "../../components/ui/tp";
import { TPSectionShell } from "../../components/ui/TPSectionShell";
import { TPButton } from "../../components/ui/TPButton";
import { TPField } from "../../components/ui/TPField";
import TPInput from "../../components/ui/TPInput";
import TPTextarea from "../../components/ui/TPTextarea";
import TPDateRangeInline from "../../components/ui/TPDateRangeInline";
import { CategoryTreePicker } from "../../components/ui/CategoryTreePicker";
import { Modal } from "../../components/ui/Modal";
import ConfirmDeleteDialog from "../../components/ui/ConfirmDeleteDialog";
import { TPTr, TPTd } from "../../components/ui/TPTable";
import { TPTableKit, type TPColDef } from "../../components/ui/TPTableKit";
import { TPStatusPill } from "../../components/ui/TPStatusPill";
import { TPRowActions } from "../../components/ui/TPRowActions";
import TPComboFixed from "../../components/ui/TPComboFixed";
import TPComboMulti, { type ComboMultiOption } from "../../components/ui/TPComboMulti";
import { TPArticleScopeSelect } from "../../components/ui/TPArticleScopeSelect";
import { MetalVariantPicker } from "../../components/ui/MetalVariantPicker";
import type { ScopeItem } from "../../services/articles";
import TPNumberInput from "../../components/ui/TPNumberInput";
import { toast } from "../../lib/toast";
import {
  couponsApi,
  type CouponRow,
  type CouponDiscountType,
  type CouponScope,
  type CouponPayload,
  COUPON_DISCOUNT_TYPE_LABELS,
  COUPON_SCOPE_LABELS,
} from "../../services/coupons";
import { categoriesApi, type CategoryRow } from "../../services/categories";
import { articleGroupsApi, groupsToComboOptions } from "../../services/article-groups";
import { articlesApi } from "../../services/articles";
import { commercialEntitiesApi } from "../../services/commercial-entities";

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit", month: "2-digit", year: "numeric",
    }).format(new Date(iso));
  } catch { return iso ?? "—"; }
}

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  } catch { return ""; }
}

function formatValue(row: CouponRow): string {
  const v = parseFloat(row.discountValue);
  if (row.discountType === "PERCENTAGE") return `${v.toFixed(0)}%`;
  return `$${v.toFixed(2)}`;
}

type VigenciaState = "active" | "expired" | "upcoming" | "permanent";

function vigenciaState(row: CouponRow): VigenciaState {
  const now  = new Date();
  const from = row.validFrom ? new Date(row.validFrom) : null;
  const to   = row.validTo   ? new Date(row.validTo)   : null;
  if (!from && !to) return "permanent";
  if (from && from > now) return "upcoming";
  if (to   && to   < now) return "expired";
  return "active";
}

function VigenciaBadge({ row }: { row: CouponRow }) {
  const state = vigenciaState(row);
  const cfg: Record<VigenciaState, { label: string; cls: string; Icon: React.ComponentType<{ size?: number }> }> = {
    permanent: { label: "Sin vencimiento", cls: "bg-gray-500/10 text-muted",                                   Icon: CalendarClock },
    active:    { label: "Vigente",         cls: "bg-green-500/15 text-green-600 dark:text-green-400",          Icon: CheckCircle2  },
    expired:   { label: "Vencido",         cls: "bg-red-500/15 text-red-600 dark:text-red-400",               Icon: AlertTriangle },
    upcoming:  { label: "Próximo",         cls: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",       Icon: Clock         },
  };
  const { label, cls, Icon } = cfg[state];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", cls)}>
      <Icon size={11} />
      {label}
    </span>
  );
}

/* ── Opciones de combos ───────────────────────────────────────────────────── */
const TYPE_OPTIONS  = Object.entries(COUPON_DISCOUNT_TYPE_LABELS).map(([value, label]) => ({ value, label }));
// Orden explícito según requerimiento de UX
const SCOPE_OPTIONS = (["ALL", "CLIENT", "GROUP", "CATEGORY", "BRAND", "ARTICLE", "METALS"] as CouponScope[])
  .map(value => ({ value, label: COUPON_SCOPE_LABELS[value] }));

/* ── Draft ───────────────────────────────────────────────────────────────── */
type Draft = {
  name:              string;
  code:              string;
  description:       string;
  discountType:      CouponDiscountType;
  discountValue:     number | null;
  validFrom:         string;
  validTo:           string;
  maxUsesTotal:      number | null;
  maxUsesPerClient:  number | null;
  applyScope:        CouponScope;
  isActive:          boolean;
  notes:             string;
  categoryIds:       string[];
  groupIds:          string[];
  clientIds:         string[];
  brandNames:        string[];
  metalVariantIds:   string[];
};

const EMPTY_DRAFT: Draft = {
  name: "", code: "", description: "",
  discountType: "PERCENTAGE", discountValue: null,
  validFrom: "", validTo: "",
  maxUsesTotal: null, maxUsesPerClient: null,
  applyScope: "ALL", isActive: true, notes: "",
  categoryIds: [], groupIds: [], clientIds: [], brandNames: [],
  metalVariantIds: [],
};

/* ── Columnas ─────────────────────────────────────────────────────────────── */
const COL_DEFS: TPColDef[] = [
  { key: "code",         label: "Código",    canHide: false, sortKey: "code"  },
  { key: "name",         label: "Nombre",    sortKey: "name"  },
  { key: "discountType", label: "Descuento", sortKey: "discountType" },
  { key: "scope",        label: "Alcance"   },
  { key: "vigencia",     label: "Vigencia"  },
  { key: "usos",         label: "Usos"      },
  { key: "isActive",     label: "Estado",    sortKey: "isActive" },
  { key: "actions",      label: "",          canHide: false, align: "right" },
];

/* =========================================================
   COMPONENTE
========================================================= */
export default function ConfiguracionSistemaCupones() {
  const [rows, setRows]       = useState<CouponRow[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(false);
  const [q, setQ]             = useState("");

  type SortKey = "code" | "name" | "discountType" | "isActive";
  const [sortKey, setSortKey] = useState<SortKey>("code");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: string) {
    const k = key as SortKey;
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  }

  const [viewOpen,   setViewOpen]   = useState(false);
  const [viewTarget, setViewTarget] = useState<CouponRow | null>(null);

  const [editOpen,   setEditOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState<CouponRow | null>(null);
  const [draft,      setDraft]      = useState<Draft>({ ...EMPTY_DRAFT });
  const [submitted,  setSubmitted]  = useState(false);
  const [busySave,   setBusySave]   = useState(false);

  const { askDelete, dialogProps } = useConfirmDelete();

  /* ── Opciones para selectores de alcance ────────────────────────────────── */
  const [allCategories, setAllCategories] = useState<CategoryRow[]>([]);
  const [grpOpts,      setGrpOpts]        = useState<ComboMultiOption[]>([]);
  const [brdOpts,      setBrdOpts]        = useState<ComboMultiOption[]>([]);
  const [cliOpts,      setCliOpts]        = useState<ComboMultiOption[]>([]);
  const [scopeLoading, setScopeLoading]   = useState(false);
  const [selectedScopeItems, setSelectedScopeItems] = useState<ScopeItem[]>([]);

  useEffect(() => {
    if (!editOpen) return;
    setScopeLoading(true);
    Promise.allSettled([
      categoriesApi.list(),
      articleGroupsApi.list(),
      articlesApi.listBrands(),
      commercialEntitiesApi.list({ role: "client", take: 200 }),
    ]).then(([catsR, grpsR, brdsR, clisR]) => {
      if (catsR.status === "fulfilled") setAllCategories(catsR.value);
      if (grpsR.status === "fulfilled") setGrpOpts(groupsToComboOptions(grpsR.value));
      if (brdsR.status === "fulfilled") setBrdOpts(brdsR.value.brands.map(b => ({ value: b, label: b })));
      if (clisR.status === "fulfilled") setCliOpts(clisR.value.rows.map(c => ({ value: c.id, label: c.displayName })));
    }).finally(() => setScopeLoading(false));
  }, [editOpen]);

  /* ── Carga ──────────────────────────────────────────────────────────────── */
  async function load() {
    try {
      setLoading(true);
      const res = await couponsApi.list({ q: q.trim() || undefined, take: 200 });
      setRows(res.data);
      setTotal(res.total);
    } catch (e: any) {
      toast.error(e?.message || "Error al cargar cupones.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  /* ── Filtrado y orden local ─────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    const sq = q.trim().toLowerCase();
    const arr = sq
      ? rows.filter(r =>
          r.name.toLowerCase().includes(sq) ||
          r.code.toLowerCase().includes(sq)
        )
      : rows;
    return [...arr].sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortKey === "isActive") return ((+b.isActive) - (+a.isActive)) * mul;
      return String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""), "es") * mul;
    });
  }, [rows, q, sortKey, sortDir]);

  /* ── Modales ────────────────────────────────────────────────────────────── */
  function openView(row: CouponRow) {
    setViewTarget(row);
    setViewOpen(true);
  }

  function openCreate() {
    setEditTarget(null);
    setDraft({ ...EMPTY_DRAFT });
    setSelectedScopeItems([]);
    setSubmitted(false);
    setEditOpen(true);
  }

  function openEdit(row: CouponRow) {
    setEditTarget(row);
    setDraft({
      name:             row.name,
      code:             row.code,
      description:      row.description ?? "",
      discountType:     row.discountType,
      discountValue:    parseFloat(row.discountValue),
      validFrom:        toDateInput(row.validFrom),
      validTo:          toDateInput(row.validTo),
      maxUsesTotal:     row.maxUsesTotal ?? null,
      maxUsesPerClient: row.maxUsesPerClient ?? null,
      applyScope:       row.applyScope,
      isActive:         row.isActive,
      notes:            row.notes ?? "",
      categoryIds:      row.categories?.map(c => c.category.id)    ?? [],
      groupIds:         row.groups?.map(g => g.group.id)           ?? [],
      clientIds:        row.clients?.map(c => c.client.id)         ?? [],
      brandNames:       row.brands?.map(b => b.brandName)          ?? [],
      metalVariantIds:  row.metalVariants?.map(m => m.metalVariantId) ?? [],
    });
    // Reconstruir scope items desde artículos y variantes guardados
    const scopeItems: ScopeItem[] = [
      ...(row.articles ?? []).map(a => ({
        kind:        "ARTICLE" as const,
        id:          a.article.id,
        name:        a.article.name,
        code:        "",
        imageUrl:    null,
        articleId:   a.article.id,
        articleName: a.article.name,
      })),
      ...(row.variants ?? []).map(v => ({
        kind:        "VARIANT" as const,
        id:          v.variant.id,
        name:        v.variant.name || v.variant.code,
        code:        v.variant.code,
        imageUrl:    null,
        articleId:   v.variant.articleId,
        articleName: v.variant.article.name,
      })),
    ];
    setSelectedScopeItems(scopeItems);
    setSubmitted(false);
    setEditOpen(true);
  }

  /* ── Validación ─────────────────────────────────────────────────────────── */
  function getScopeSelection(d: Draft): string[] {
    if (d.applyScope === "ARTICLE")  return selectedScopeItems.map(i => i.id);
    if (d.applyScope === "CATEGORY") return d.categoryIds;
    if (d.applyScope === "GROUP")    return d.groupIds;
    if (d.applyScope === "CLIENT")   return d.clientIds;
    if (d.applyScope === "BRAND")    return d.brandNames;
    if (d.applyScope === "METALS")   return d.metalVariantIds;
    return [];
  }

  const nameError  = submitted && !draft.name.trim()                                       ? "Requerido" : undefined;
  const valueError = submitted && draft.discountValue === null                              ? "Requerido" : undefined;
  const scopeError = submitted && draft.applyScope !== "ALL" && getScopeSelection(draft).length === 0
    ? "Seleccione al menos un elemento" : undefined;

  function validate(): boolean {
    if (!draft.name.trim() || draft.discountValue === null) return true;
    if (draft.applyScope !== "ALL" && getScopeSelection(draft).length === 0) return true;
    return false;
  }

  /* ── Guardar ────────────────────────────────────────────────────────────── */
  async function handleSave() {
    setSubmitted(true);
    if (validate()) return;

    const payload: CouponPayload = {
      name:             draft.name.trim(),
      code:             draft.code.trim() || undefined,
      description:      draft.description.trim(),
      discountType:     draft.discountType,
      discountValue:    draft.discountValue ?? 0,
      validFrom:        draft.validFrom ? new Date(draft.validFrom).toISOString() : null,
      validTo:          draft.validTo   ? new Date(draft.validTo).toISOString()   : null,
      maxUsesTotal:     draft.maxUsesTotal     ?? null,
      maxUsesPerClient: draft.maxUsesPerClient ?? null,
      applyScope:       draft.applyScope,
      isActive:         draft.isActive,
      notes:            draft.notes.trim(),
      articleIds:       draft.applyScope === "ARTICLE"  ? selectedScopeItems.filter(i => i.kind === "ARTICLE").map(i => i.id)  : [],
      variantIds:       draft.applyScope === "ARTICLE"  ? selectedScopeItems.filter(i => i.kind === "VARIANT").map(i => i.id)  : [],
      categoryIds:      draft.applyScope === "CATEGORY" ? draft.categoryIds : [],
      groupIds:         draft.applyScope === "GROUP"    ? draft.groupIds    : [],
      clientIds:        draft.applyScope === "CLIENT"   ? draft.clientIds   : [],
      brandNames:       draft.applyScope === "BRAND"    ? draft.brandNames  : [],
      metalVariantIds:  draft.applyScope === "METALS"   ? draft.metalVariantIds : [],
    };

    try {
      setBusySave(true);
      if (editTarget) {
        await couponsApi.update(editTarget.id, payload);
        toast.success("Cupón actualizado.");
      } else {
        await couponsApi.create(payload);
        toast.success("Cupón creado.");
      }
      setEditOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar.");
    } finally {
      setBusySave(false);
    }
  }

  /* ── Toggle ─────────────────────────────────────────────────────────────── */
  async function handleToggle(row: CouponRow) {
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, isActive: !r.isActive } : r));
    try {
      await couponsApi.toggle(row.id);
      toast.success(row.isActive ? "Cupón desactivado." : "Cupón activado.");
      await load();
    } catch (e: any) {
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, isActive: row.isActive } : r));
      toast.error(e?.message || "Error al cambiar estado.");
    }
  }

  /* ── JSX ─────────────────────────────────────────────────────────────────── */
  return (
    <TPSectionShell
      title="Cupones de descuento"
      subtitle="Códigos de descuento que los clientes pueden ingresar al momento de la venta."
    >
      <TPTableKit
        columns={COL_DEFS}
        rows={filtered}
        storageKey="tptech_col_cupones"
        loading={loading}
        search={q}
        onSearchChange={setQ}
        searchPlaceholder="Buscar cupón..."
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={toggleSort}
        emptyText="No hay cupones creados todavía."
        onRowClick={(row) => openView(row)}
        actions={
          <TPButton variant="primary" iconLeft={<Plus size={16} />} onClick={openCreate}>
            Nuevo cupón
          </TPButton>
        }
        renderRow={(row: CouponRow, vis) => (
          <TPTr key={row.id} className={!row.isActive ? "opacity-60" : undefined}>
            {vis.code && (
              <TPTd>
                <div className="flex items-center gap-2">
                  <Ticket size={14} className="text-primary shrink-0" />
                  <span className="font-mono font-semibold text-sm">{row.code}</span>
                </div>
              </TPTd>
            )}
            {vis.name && (
              <TPTd>
                <span className="font-medium">{row.name}</span>
                {row.description && (
                  <p className="text-xs text-muted line-clamp-1">{row.description}</p>
                )}
              </TPTd>
            )}
            {vis.discountType && (
              <TPTd className="hidden md:table-cell">
                <div className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums text-primary">
                    {formatValue(row)}
                  </span>
                  <span className="text-xs text-muted">
                    {COUPON_DISCOUNT_TYPE_LABELS[row.discountType]}
                  </span>
                </div>
              </TPTd>
            )}
            {vis.scope && (
              <TPTd className="hidden lg:table-cell">
                <span className="text-xs text-muted">
                  {COUPON_SCOPE_LABELS[row.applyScope]}
                </span>
              </TPTd>
            )}
            {vis.vigencia && (
              <TPTd className="hidden lg:table-cell">
                <VigenciaBadge row={row} />
                {(row.validFrom || row.validTo) && (
                  <p className="text-[10px] text-muted/60 mt-0.5">
                    {formatDate(row.validFrom)} — {formatDate(row.validTo)}
                  </p>
                )}
              </TPTd>
            )}
            {vis.usos && (
              <TPTd className="hidden xl:table-cell tabular-nums text-xs">
                {row._count != null ? (
                  <span>
                    {row._count.redemptions} uso{row._count.redemptions !== 1 ? "s" : ""}
                    {row.maxUsesTotal != null && (
                      <span className="text-muted"> / {row.maxUsesTotal}</span>
                    )}
                  </span>
                ) : "—"}
              </TPTd>
            )}
            {vis.isActive && (
              <TPTd className="hidden md:table-cell">
                <TPStatusPill active={row.isActive} />
              </TPTd>
            )}
            {vis.actions && (
              <TPTd className="text-right">
                <TPRowActions
                  onView={() => openView(row)}
                  onEdit={() => openEdit(row)}
                  onToggle={() => handleToggle(row)}
                  isActive={row.isActive}
                  onDelete={() => askDelete({
                    entityName: "cupón",
                    entityLabel: `${row.code} — ${row.name}`,
                    onDelete: () => couponsApi.remove(row.id),
                    onAfterSuccess: load,
                  })}
                />
              </TPTd>
            )}
          </TPTr>
        )}
      />

      {/* ── Modal alta / edición ──────────────────────────────────────────── */}
      <Modal
        open={editOpen}
        title={editTarget ? "Editar cupón" : "Nuevo cupón de descuento"}
        maxWidth="xl"
        busy={busySave}
        onClose={() => !busySave && setEditOpen(false)}
        onEnter={handleSave}
        bodyClassName="overflow-y-auto pb-4"
        footer={
          <>
            <TPButton variant="secondary" iconLeft={<X size={16} />} onClick={() => setEditOpen(false)} disabled={busySave}>
              Cancelar
            </TPButton>
            <TPButton variant="primary" iconLeft={<Check size={16} />} onClick={handleSave} loading={busySave}>
              Guardar
            </TPButton>
          </>
        }
      >
        <div className="space-y-4">

          {/* ── Datos del cupón (identidad + beneficio) ────────────────────── */}
          <Section title="Datos del cupón">
            <div className="grid grid-cols-2 gap-3">
              <TPField label="Nombre" required error={nameError}>
                <TPInput
                  value={draft.name}
                  onChange={v => setDraft(d => ({ ...d, name: v }))}
                  placeholder="Ej: Promo verano, Descuento VIP"
                  data-tp-autofocus="1"
                />
              </TPField>
              <TPField label="Código" hint="Vacío = se genera en mayúsculas automáticamente">
                <TPInput
                  value={draft.code}
                  onChange={v => setDraft(d => ({ ...d, code: v.toUpperCase() }))}
                  placeholder="VERANO20"
                />
              </TPField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TPField label="Tipo de descuento">
                <TPComboFixed
                  value={draft.discountType}
                  onChange={v => setDraft(d => ({ ...d, discountType: v as CouponDiscountType }))}
                  options={TYPE_OPTIONS}
                />
              </TPField>
              <TPField
                label="Valor"
                hint={draft.discountType === "PERCENTAGE"
                  ? "Porcentaje de descuento (ej: 20 = 20%)"
                  : "Monto fijo en moneda base"}
                required
                error={valueError}
              >
                <TPNumberInput
                  value={draft.discountValue}
                  onChange={v => setDraft(d => ({ ...d, discountValue: v }))}
                  decimals={2}
                  min={0}
                  max={draft.discountType === "PERCENTAGE" ? 100 : undefined}
                  suffix={draft.discountType === "PERCENTAGE" ? "%" : undefined}
                  placeholder={draft.discountType === "PERCENTAGE" ? "20" : "500"}
                />
              </TPField>
            </div>
          </Section>

          {/* ── Vigencia y límites ─────────────────────────────────────────── */}
          <Section title="Vigencia y límites">
            <TPDateRangeInline
              showPresets={false}
              fromLabel="Válido desde"
              toLabel="Válido hasta"
              disabled={busySave}
              value={{
                from: draft.validFrom ? new Date(draft.validFrom + "T00:00:00") : null,
                to:   draft.validTo   ? new Date(draft.validTo   + "T00:00:00") : null,
              }}
              onChange={v => {
                const fmt = (d: Date | null) =>
                  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "";
                setDraft(d => ({ ...d, validFrom: fmt(v.from), validTo: fmt(v.to) }));
              }}
            />
            <div className="grid grid-cols-2 gap-3">
              <TPField label="Usos totales máximos" hint="Vacío = ilimitado">
                <TPNumberInput
                  value={draft.maxUsesTotal}
                  onChange={v => setDraft(d => ({ ...d, maxUsesTotal: v }))}
                  decimals={0}
                  min={1}
                  placeholder="Ilimitado"
                />
              </TPField>
              <TPField label="Usos por cliente" hint="Vacío = ilimitado">
                <TPNumberInput
                  value={draft.maxUsesPerClient}
                  onChange={v => setDraft(d => ({ ...d, maxUsesPerClient: v }))}
                  decimals={0}
                  min={1}
                  placeholder="Ilimitado"
                />
              </TPField>
            </div>
          </Section>

          {/* ── Alcance ────────────────────────────────────────────────────── */}
          <Section title="Alcance">
            <TPField label="Aplicar a">
              <TPComboFixed
                value={draft.applyScope}
                onChange={v => {
                setDraft(d => ({
                  ...d,
                  applyScope:       v as CouponScope,
                  categoryIds:      [],
                  groupIds:         [],
                  clientIds:        [],
                  brandNames:       [],
                  metalVariantIds:  [],
                }));
                setSelectedScopeItems([]);
              }}
                options={SCOPE_OPTIONS}
              />
            </TPField>
            {draft.applyScope === "CATEGORY" && (
              <TPField label="Categorías de artículos" error={scopeError}>
                <CategoryTreePicker
                  categories={allCategories}
                  value={draft.categoryIds}
                  onChange={v => setDraft(d => ({ ...d, categoryIds: v }))}
                  disabled={scopeLoading || busySave}
                  listMaxHeight="max-h-28"
                />
              </TPField>
            )}
            {draft.applyScope === "GROUP" && (
              <TPField label="Grupos de artículos" error={scopeError}>
                <TPComboMulti
                  value={draft.groupIds}
                  onChange={v => setDraft(d => ({ ...d, groupIds: v }))}
                  options={grpOpts}
                  placeholder={scopeLoading ? "Cargando…" : "Seleccionar grupos…"}
                  disabled={scopeLoading}
                />
              </TPField>
            )}
            {draft.applyScope === "ARTICLE" && (
              <TPField label="Artículos y variantes" error={scopeError}>
                <TPArticleScopeSelect
                  value={selectedScopeItems}
                  onChange={setSelectedScopeItems}
                  multiple
                  includeVariants
                  placeholder="Buscar artículo o variante…"
                  disabled={busySave}
                />
              </TPField>
            )}
            {draft.applyScope === "CLIENT" && (
              <TPField label="Clientes" error={scopeError}>
                <TPComboMulti
                  value={draft.clientIds}
                  onChange={v => setDraft(d => ({ ...d, clientIds: v }))}
                  options={cliOpts}
                  placeholder={scopeLoading ? "Cargando…" : "Buscar clientes…"}
                  disabled={scopeLoading}
                />
              </TPField>
            )}
            {draft.applyScope === "BRAND" && (
              <TPField label="Marcas" error={scopeError}>
                <TPComboMulti
                  value={draft.brandNames}
                  onChange={v => setDraft(d => ({ ...d, brandNames: v }))}
                  options={brdOpts}
                  placeholder={scopeLoading ? "Cargando…" : "Seleccionar marcas…"}
                  disabled={scopeLoading}
                />
              </TPField>
            )}
            {draft.applyScope === "METALS" && (
              <TPField label="Variantes de metal" error={scopeError}>
                <MetalVariantPicker
                  selected={draft.metalVariantIds}
                  onChange={v => setDraft(d => ({ ...d, metalVariantIds: v }))}
                  disabled={busySave}
                  placeholder="Seleccionar variantes (Oro 18K, Plata 925, …)"
                />
              </TPField>
            )}
          </Section>

          {/* ── Notas internas ─────────────────────────────────────────────── */}
          <Section title="Notas internas">
            <TPTextarea
              value={draft.notes}
              onChange={v => setDraft(d => ({ ...d, notes: v }))}
              placeholder="Observaciones internas, condiciones especiales..."
              minH={64}
            />
          </Section>

        </div>
      </Modal>

      {/* ── Modal ver detalle ────────────────────────────────────────────────── */}
      <CouponViewModal
        open={viewOpen}
        row={viewTarget}
        onClose={() => setViewOpen(false)}
      />

      <ConfirmDeleteDialog {...dialogProps} />
    </TPSectionShell>
  );
}

/* ── Componente de sección en modal ─────────────────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted/80">{title}</span>
        <div className="flex-1 border-t border-border/70" />
      </div>
      {children}
    </div>
  );
}

/* ── Modal de detalle (solo lectura) ────────────────────────────────────────── */
function CouponViewModal({
  open, row, onClose,
}: {
  open: boolean;
  row: CouponRow | null;
  onClose: () => void;
}) {
  if (!row) return null;

  const scopeDetail = (): string => {
    if (row.applyScope === "ALL") return "Todos los artículos";
    if (row.applyScope === "CATEGORY" && row.categories?.length)
      return row.categories.map(c => c.category.name).join(", ");
    if (row.applyScope === "GROUP" && row.groups?.length)
      return row.groups.map(g => g.group.name).join(", ");
    if (row.applyScope === "ARTICLE") {
      const parts: string[] = [];
      if (row.articles?.length) parts.push(...row.articles.map(a => a.article.name));
      if (row.variants?.length) parts.push(...row.variants.map(v => `${v.variant.article.name} — ${v.variant.name || v.variant.code}`));
      if (parts.length) return parts.join(", ");
    }
    if (row.applyScope === "CLIENT" && row.clients?.length)
      return row.clients.map(c => c.client.displayName).join(", ");
    if (row.applyScope === "BRAND" && row.brands?.length)
      return row.brands.map(b => b.brandName).join(", ");
    return COUPON_SCOPE_LABELS[row.applyScope];
  };

  const usesText = row._count != null
    ? `${row._count.redemptions} uso${row._count.redemptions !== 1 ? "s" : ""}${row.maxUsesTotal != null ? ` de ${row.maxUsesTotal}` : " (ilimitado)"}`
    : "—";

  const fields: [string, string][] = [
    ["Código",           row.code],
    ["Nombre",           row.name],
    ["Tipo de descuento", COUPON_DISCOUNT_TYPE_LABELS[row.discountType]],
    ["Valor",            formatValue(row)],
    ["Alcance",          scopeDetail()],
    ["Vigencia desde",   formatDate(row.validFrom)],
    ["Vigencia hasta",   formatDate(row.validTo)],
    ["Usos",             usesText],
    ["Usos por cliente", row.maxUsesPerClient != null ? `Máx. ${row.maxUsesPerClient}` : "Sin límite"],
    ["Estado",           row.isActive ? "Activo" : "Inactivo"],
  ];

  return (
    <Modal
      open={open}
      title={`${row.code} — ${row.name}`}
      maxWidth="sm"
      onClose={onClose}
      footer={
        <TPButton variant="secondary" onClick={onClose}>
          Cerrar
        </TPButton>
      }
    >
      <div className="space-y-1">
        {row.description && (
          <p className="text-sm text-muted pb-2">{row.description}</p>
        )}
        <div className="text-sm divide-y divide-border">
          {fields.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-2">
              <span className="text-muted font-medium shrink-0">{label}</span>
              <span className="text-text text-right">{value}</span>
            </div>
          ))}
          {row.notes && (
            <div className="flex flex-col gap-1 py-2">
              <span className="text-muted font-medium">Notas internas</span>
              <span className="text-text whitespace-pre-line">{row.notes}</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
