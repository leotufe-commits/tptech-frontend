// src/pages/configuracion-sistema/ConfiguracionSistemaGruposArticulos.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useConfirmDelete } from "../../hooks/useConfirmDelete";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Image as ImageIcon,
  Layers,
  Package,
  Plus,
  Save,
  Search,
  X,
} from "lucide-react";

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
import { TPCard } from "../../components/ui/TPCard";

import { toast } from "../../lib/toast";
import {
  articleGroupsApi,
  type ArticleGroupRow,
  type ArticleGroupDetail,
  type ArticleGroupMember,
  type ArticleGroupAvailableArticle,
  type ArticleGroupPayload,
} from "../../services/article-groups";
import { fmtMoney } from "../../services/articles";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fmtStock(n: number): string {
  if (n === 0) return "—";
  return n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------------
// Column definitions (tabla principal)
// ---------------------------------------------------------------------------
const GROUP_COLS: TPColDef[] = [
  { key: "name",          label: "Nombre",    canHide: false },
  { key: "slug",          label: "Slug" },
  { key: "selectorLabel", label: "Selector" },
  { key: "articles",      label: "Artículos" },
  { key: "status",        label: "Estado" },
  { key: "actions",       label: "",          canHide: false },
];

// ---------------------------------------------------------------------------
// Draft (modal crear/editar grupo)
// ---------------------------------------------------------------------------
const EMPTY_DRAFT = {
  name: "",
  slug: "",
  description: "",
  mainImageUrl: "",
  selectorLabel: "",
  isActive: true,
};
type Draft = typeof EMPTY_DRAFT;

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function ConfiguracionSistemaGruposArticulos() {
  const navigate = useNavigate();
  const [rows, setRows]       = useState<ArticleGroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ]             = useState("");

  // Modal crear/editar
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editRow, setEditRow]     = useState<ArticleGroupRow | null>(null);
  const [draft, setDraft]         = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving]       = useState(false);

  // Modal detalle (gestión de artículos del grupo)
  const [detailId, setDetailId]           = useState<string | null>(null);
  const [detail, setDetail]               = useState<ArticleGroupDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Borrado
  const { askDelete, dialogProps: deleteDialogProps } = useConfirmDelete();

  // ── Carga inicial ──────────────────────────────────────────────────────────
  function load() {
    setLoading(true);
    articleGroupsApi.list()
      .then(setRows)
      .catch(() => toast.error("No se pudieron cargar los grupos."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  // ── Cargar detalle ──────────────────────────────────────────────────────────
  function loadDetail(id: string) {
    setDetailLoading(true);
    articleGroupsApi.get(id)
      .then(setDetail)
      .catch(() => toast.error("No se pudo cargar el detalle."))
      .finally(() => setDetailLoading(false));
  }

  useEffect(() => {
    if (!detailId) { setDetail(null); return; }
    loadDetail(detailId);
  }, [detailId]);

  // ── Filtro ─────────────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    if (!q.trim()) return rows;
    const lq = q.toLowerCase();
    return rows.filter(r =>
      r.name.toLowerCase().includes(lq) ||
      r.slug.toLowerCase().includes(lq) ||
      r.selectorLabel.toLowerCase().includes(lq)
    );
  }, [rows, q]);

  // ── Helpers de draft ────────────────────────────────────────────────────────
  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft(d => ({ ...d, [key]: value }));
  }

  function openCreate() {
    setDraft(EMPTY_DRAFT);
    setEditRow(null);
    setModalMode("create");
  }

  function openEdit(row: ArticleGroupRow) {
    setDraft({
      name:          row.name,
      slug:          row.slug,
      description:   row.description,
      mainImageUrl:  row.mainImageUrl,
      selectorLabel: row.selectorLabel,
      isActive:      row.isActive,
    });
    setEditRow(row);
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setEditRow(null);
  }

  // ── Guardar ─────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!draft.name.trim()) { toast.error("El nombre es obligatorio."); return; }
    setSaving(true);
    try {
      const payload: ArticleGroupPayload = {
        name:          draft.name.trim(),
        slug:          draft.slug.trim() || slugify(draft.name.trim()),
        description:   draft.description,
        mainImageUrl:  draft.mainImageUrl,
        selectorLabel: draft.selectorLabel,
        isActive:      draft.isActive,
      };
      if (modalMode === "create") {
        const created = await articleGroupsApi.create(payload);
        setRows(r => [created, ...r]);
        toast.success("Grupo creado.");
      } else if (editRow) {
        const updated = await articleGroupsApi.update(editRow.id, payload);
        setRows(r => r.map(x => x.id === updated.id ? updated : x));
        toast.success("Grupo actualizado.");
      }
      closeModal();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  // ── Toggle activo ───────────────────────────────────────────────────────────
  async function handleToggle(row: ArticleGroupRow) {
    try {
      const updated = await articleGroupsApi.toggle(row.id);
      setRows(r => r.map(x => x.id === updated.id ? updated : x));
    } catch {
      toast.error("No se pudo cambiar el estado.");
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <TPSectionShell
      title="Grupos de artículos"
      description="Agrupá artículos para mostrarlos juntos en catálogo o web, sin modificar precios ni lógica de inventario."
      icon={<Layers size={18} />}
    >
      <TPTableKit
        rows={filteredRows}
        columns={GROUP_COLS}
        storageKey="tptech_col_article_groups"
        search={q}
        onSearchChange={setQ}
        searchPlaceholder="Buscar grupos…"
        loading={loading}
        emptyText={q ? "No hay resultados para esa búsqueda." : "No hay grupos creados. Creá el primero."}
        pagination
        countLabel={(n) => `${n} ${n === 1 ? "grupo" : "grupos"}`}
        actions={
          <TPButton variant="primary" onClick={openCreate} iconLeft={<Plus size={14} />}>
            Nuevo grupo
          </TPButton>
        }
        renderRow={(row: ArticleGroupRow, vis) => (
          <TPTr key={row.id} className={!row.isActive ? "opacity-60" : undefined}>
            {vis.name && (
              <TPTd>
                <div className="flex items-center gap-2">
                  {row.mainImageUrl ? (
                    <img
                      src={row.mainImageUrl}
                      alt=""
                      className="w-7 h-7 rounded object-cover shrink-0 border border-border"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded border border-border bg-surface2/50 flex items-center justify-center shrink-0">
                      <ImageIcon size={12} className="text-muted" />
                    </div>
                  )}
                  <button
                    type="button"
                    className="font-medium text-text hover:text-primary hover:underline text-left text-sm"
                    onClick={() => setDetailId(row.id)}
                  >
                    {row.name}
                  </button>
                </div>
              </TPTd>
            )}
            {vis.slug && (
              <TPTd>
                <span className="font-mono text-xs text-muted">{row.slug}</span>
              </TPTd>
            )}
            {vis.selectorLabel && (
              <TPTd>
                {row.selectorLabel
                  ? <span className="text-sm">{row.selectorLabel}</span>
                  : <span className="text-muted text-sm">—</span>}
              </TPTd>
            )}
            {vis.articles && (
              <TPTd>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-muted hover:text-primary"
                  onClick={() => setDetailId(row.id)}
                >
                  <Package size={12} />
                  {row._count.articles}
                </button>
              </TPTd>
            )}
            {vis.status && (
              <TPTd>
                <TPStatusPill active={row.isActive} />
              </TPTd>
            )}
            {vis.actions && (
              <TPTd className="text-right">
                <TPRowActions
                  onEdit={() => openEdit(row)}
                  onToggle={() => handleToggle(row)}
                  isActive={row.isActive}
                  onDelete={() => askDelete({
                    entityName: "grupo",
                    entityLabel: row.name,
                    onDelete: () => articleGroupsApi.remove(row.id),
                    onAfterSuccess: load,
                  })}
                />
              </TPTd>
            )}
          </TPTr>
        )}
      />

      {/* ── Modal Crear / Editar ──────────────────────────────────────────── */}
      {modalMode && (
        <Modal
          open
          title={modalMode === "create" ? "Nuevo grupo" : "Editar grupo"}
          onClose={closeModal}
          maxWidth="md"
        >
          <div className="space-y-4 p-1">
            <TPCard title="Identidad">
              <TPField label="Nombre *">
                <TPInput
                  value={draft.name}
                  onChange={(v) => {
                    set("name", v);
                    if (!draft.slug || draft.slug === slugify(draft.name)) {
                      set("slug", slugify(v));
                    }
                  }}
                  placeholder="Ej: Anillos de compromiso"
                  autoFocus
                />
              </TPField>
              <TPField
                label="Slug"
                hint="Identificador único para web. Se genera automáticamente desde el nombre."
              >
                <TPInput
                  value={draft.slug}
                  onChange={(v) => set("slug", v)}
                  placeholder="anillos-de-compromiso"
                  className="font-mono text-sm"
                />
              </TPField>
              <TPField label="Descripción">
                <TPTextarea
                  value={draft.description}
                  onChange={(v) => set("description", v)}
                  placeholder="Descripción breve del grupo (visible en web)"
                  rows={2}
                />
              </TPField>
            </TPCard>

            <TPCard title="Presentación">
              <TPField
                label="Etiqueta del selector"
                hint='Cómo se llama la opción que diferencia los artículos. Ej: "Ancho", "Talle", "Color".'
              >
                <TPInput
                  value={draft.selectorLabel}
                  onChange={(v) => set("selectorLabel", v)}
                  placeholder="Ej: Ancho"
                />
              </TPField>
              <TPField
                label="URL de imagen principal"
                hint="Imagen representativa del grupo para catálogo o web."
              >
                <TPInput
                  value={draft.mainImageUrl}
                  onChange={(v) => set("mainImageUrl", v)}
                  placeholder="https://…"
                />
              </TPField>
            </TPCard>

            <TPCheckbox
              label="Grupo activo"
              checked={draft.isActive}
              onChange={(v) => set("isActive", v)}
            />

            <div className="flex justify-end gap-2 pt-1">
              <TPButton variant="secondary" onClick={closeModal} disabled={saving}>
                Cancelar
              </TPButton>
              <TPButton
                variant="primary"
                onClick={handleSave}
                loading={saving}
                iconLeft={<Save size={14} />}
              >
                {modalMode === "create" ? "Crear grupo" : "Guardar cambios"}
              </TPButton>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal Detalle / Gestión de artículos ─────────────────────────── */}
      {detailId && (
        <GroupDetailModal
          groupId={detailId}
          detail={detail}
          loading={detailLoading}
          onClose={() => setDetailId(null)}
          onReload={() => { if (detailId) loadDetail(detailId); load(); }}
          onNavigate={navigate}
        />
      )}

      {/* ── Confirm Delete ────────────────────────────────────────────────── */}
      <ConfirmDeleteDialog {...deleteDialogProps} />
    </TPSectionShell>
  );
}

// ===========================================================================
// GroupDetailModal — gestión completa de artículos en un grupo
// ===========================================================================
interface GroupDetailModalProps {
  groupId: string;
  detail: ArticleGroupDetail | null;
  loading: boolean;
  onClose: () => void;
  onReload: () => void;
  onNavigate: ReturnType<typeof useNavigate>;
}

function GroupDetailModal({ groupId, detail, loading, onClose, onReload, onNavigate }: GroupDetailModalProps) {
  const [articles, setArticles]       = useState<ArticleGroupMember[]>([]);
  const [reordering, setReordering]   = useState(false);

  // Búsqueda de artículos para agregar
  const [searchQ, setSearchQ]                     = useState("");
  const [searchResults, setSearchResults]         = useState<ArticleGroupAvailableArticle[]>([]);
  const [searchLoading, setSearchLoading]         = useState(false);
  const [showSearch, setShowSearch]               = useState(false);
  const searchTimeout                             = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sincronizar articles con detail
  useEffect(() => {
    if (detail) setArticles([...detail.articles]);
  }, [detail]);

  // Búsqueda con debounce
  useEffect(() => {
    if (!showSearch) return;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!searchQ.trim()) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await articleGroupsApi.searchAvailable(groupId, searchQ);
        setSearchResults(results);
      } catch {
        toast.error("Error al buscar artículos.");
      } finally {
        setSearchLoading(false);
      }
    }, 350);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [searchQ, showSearch, groupId]);

  // ── Reordenar con flechas ────────────────────────────────────────────────
  async function moveArticle(idx: number, dir: -1 | 1) {
    const next = [...articles];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setArticles(next);
    setReordering(true);
    try {
      await articleGroupsApi.reorderArticles(groupId, next.map(a => a.id));
    } catch {
      toast.error("No se pudo guardar el orden.");
      setArticles([...articles]); // revert
    } finally {
      setReordering(false);
    }
  }

  // ── Quitar artículo del grupo ────────────────────────────────────────────
  async function handleRemove(art: ArticleGroupMember) {
    try {
      await articleGroupsApi.removeArticle(groupId, art.id);
      setArticles(prev => prev.filter(a => a.id !== art.id));
      onReload();
      toast.success(`"${art.name}" quitado del grupo.`);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo quitar el artículo.");
    }
  }

  // ── Agregar artículo al grupo ─────────────────────────────────────────────
  async function handleAdd(art: ArticleGroupAvailableArticle) {
    try {
      await articleGroupsApi.addArticle(groupId, art.id);
      toast.success(`"${art.name}" agregado al grupo.`);
      setSearchQ("");
      setSearchResults([]);
      setShowSearch(false);
      onReload();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo agregar el artículo.");
    }
  }

  const title = detail ? detail.name : "Artículos del grupo";

  return (
    <Modal open title={title} onClose={onClose} maxWidth="lg">
      <div className="space-y-4 p-1">
        {loading ? (
          <div className="py-10 text-center text-sm text-muted">Cargando…</div>
        ) : detail ? (
          <>
            {/* Info del grupo */}
            {(detail.description || detail.selectorLabel) && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                {detail.description && (
                  <p className="text-sm text-muted">{detail.description}</p>
                )}
                {detail.selectorLabel && (
                  <span>
                    <span className="font-medium text-text/70">Selector:</span>{" "}
                    {detail.selectorLabel}
                  </span>
                )}
              </div>
            )}

            {/* Stats del grupo */}
            <GroupStats articles={articles} />

            {/* Bloque de artículos */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="bg-surface2/60 border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package size={11} />
                  Artículos del grupo ({articles.length})
                </div>
                <TPButton
                  variant="secondary"
                  onClick={() => { setShowSearch(s => !s); setSearchQ(""); setSearchResults([]); }}
                  iconLeft={<Plus size={12} />}
                >
                  Agregar artículo
                </TPButton>
              </div>

              {/* Buscador para agregar */}
              {showSearch && (
                <div className="border-b border-border bg-surface2/30 px-3 py-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                      <input
                        autoFocus
                        type="text"
                        placeholder="Buscar por nombre, código o SKU…"
                        value={searchQ}
                        onChange={e => setSearchQ(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-primary/40"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => { setShowSearch(false); setSearchQ(""); setSearchResults([]); }}
                      className="text-muted hover:text-text"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  {searchLoading && (
                    <p className="text-xs text-muted px-1">Buscando…</p>
                  )}
                  {!searchLoading && searchResults.length > 0 && (
                    <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
                      {searchResults.map(art => (
                        <div key={art.id} className="flex items-center gap-3 px-3 py-2 hover:bg-surface2/40 transition-colors">
                          {art.mainImageUrl ? (
                            <img src={art.mainImageUrl} alt="" className="w-7 h-7 rounded object-cover border border-border shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded border border-border bg-surface2/50 flex items-center justify-center shrink-0">
                              <Package size={11} className="text-muted" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{art.name}</div>
                            <div className="text-[11px] text-muted font-mono">{art.code}{art.sku ? ` · ${art.sku}` : ""}</div>
                          </div>
                          {art.salePrice && (
                            <span className="text-xs text-muted shrink-0">{fmtMoney(art.salePrice)}</span>
                          )}
                          <TPButton variant="primary" onClick={() => handleAdd(art)}>
                            Agregar
                          </TPButton>
                        </div>
                      ))}
                    </div>
                  )}
                  {!searchLoading && searchQ.trim() && searchResults.length === 0 && (
                    <p className="text-xs text-muted px-1">No se encontraron artículos disponibles.</p>
                  )}
                  {!searchQ.trim() && (
                    <p className="text-xs text-muted px-1">Escribí para buscar artículos sin grupo asignado.</p>
                  )}
                </div>
              )}

              {/* Lista de artículos del grupo */}
              {articles.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted">
                  No hay artículos en este grupo.
                  <p className="mt-1 text-xs">Usá el botón "Agregar artículo" o asigná el grupo desde la ficha del artículo.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {articles.map((art, idx) => (
                    <GroupArticleRow
                      key={art.id}
                      art={art}
                      idx={idx}
                      total={articles.length}
                      reordering={reordering}
                      onMove={moveArticle}
                      onRemove={handleRemove}
                      onOpen={() => onNavigate(`/articulos/${art.id}`)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}

// ===========================================================================
// GroupStats — resumen estadístico del grupo
// ===========================================================================
function GroupStats({ articles }: { articles: ArticleGroupMember[] }) {
  if (articles.length === 0) return null;

  const active   = articles.filter(a => a.isActive).length;
  const inactive = articles.length - active;
  const prices   = articles.filter(a => a.salePrice != null).map(a => Number(a.salePrice));
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
  const noImage  = articles.filter(a => !a.mainImageUrl).length;

  return (
    <div className="flex flex-wrap gap-3">
      <Stat label="Activos" value={`${active}`} color={active > 0 ? "emerald" : "muted"} />
      {inactive > 0 && <Stat label="Inactivos" value={`${inactive}`} color="amber" />}
      {minPrice !== null && minPrice === maxPrice && (
        <Stat label="Precio" value={fmtMoney(String(minPrice))} color="primary" />
      )}
      {minPrice !== null && maxPrice !== null && minPrice !== maxPrice && (
        <Stat label="Precio" value={`${fmtMoney(String(minPrice))} — ${fmtMoney(String(maxPrice))}`} color="primary" />
      )}
      {noImage > 0 && <Stat label="Sin imagen" value={`${noImage}`} color="amber" />}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  const cls = {
    emerald: "bg-emerald-500/10 text-emerald-700 border-emerald-400/20",
    amber:   "bg-amber-500/10 text-amber-700 border-amber-400/20",
    primary: "bg-primary/10 text-primary border-primary/20",
    muted:   "bg-surface2 text-muted border-border",
  }[color] ?? "bg-surface2 text-muted border-border";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      <span className="text-[11px] opacity-70">{label}:</span>
      <span>{value}</span>
    </span>
  );
}

// ===========================================================================
// GroupArticleRow — fila de artículo dentro del grupo
// ===========================================================================
interface GroupArticleRowProps {
  art: ArticleGroupMember;
  idx: number;
  total: number;
  reordering: boolean;
  onMove: (idx: number, dir: -1 | 1) => void;
  onRemove: (art: ArticleGroupMember) => void;
  onOpen: () => void;
}

function GroupArticleRow({ art, idx, total, reordering, onMove, onRemove, onOpen }: GroupArticleRowProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface2/30 transition-colors">
      {/* Controles de orden */}
      <div className="flex flex-col gap-0.5 shrink-0">
        <button
          type="button"
          disabled={idx === 0 || reordering}
          onClick={() => onMove(idx, -1)}
          className="p-0.5 rounded text-muted hover:text-text hover:bg-surface2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Subir"
        >
          <ArrowUp size={12} />
        </button>
        <button
          type="button"
          disabled={idx === total - 1 || reordering}
          onClick={() => onMove(idx, 1)}
          className="p-0.5 rounded text-muted hover:text-text hover:bg-surface2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Bajar"
        >
          <ArrowDown size={12} />
        </button>
      </div>

      {/* Imagen */}
      {art.mainImageUrl ? (
        <img
          src={art.mainImageUrl}
          alt=""
          className="w-9 h-9 rounded object-cover border border-border shrink-0"
        />
      ) : (
        <div className="w-9 h-9 rounded border border-border bg-surface2/50 flex items-center justify-center shrink-0">
          <Package size={13} className="text-muted" />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-text truncate">{art.name}</span>
          <TPStatusPill active={art.isActive} />
        </div>
        <div className="text-[11px] text-muted flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="font-mono">{art.code}</span>
          {art.sku && <span>· SKU {art.sku}</span>}
          {art.category && <span>· {art.category.name}</span>}
        </div>
      </div>

      {/* Precio y stock */}
      <div className="flex flex-col items-end gap-0.5 shrink-0 text-right">
        {art.salePrice ? (
          <span className="text-sm font-semibold text-text">{fmtMoney(art.salePrice)}</span>
        ) : (
          <span className="text-xs text-muted">Sin precio</span>
        )}
        <span className="text-[11px] text-muted">
          Stock: {fmtStock(art.stockTotal)}
        </span>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-1 shrink-0 ml-1">
        <button
          type="button"
          onClick={onOpen}
          className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors"
          title="Abrir artículo"
        >
          <ExternalLink size={13} />
        </button>
        <button
          type="button"
          onClick={() => onRemove(art)}
          className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
          title="Quitar del grupo"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
