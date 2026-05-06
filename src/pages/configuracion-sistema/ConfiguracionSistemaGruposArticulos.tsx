// src/pages/configuracion-sistema/ConfiguracionSistemaGruposArticulos.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useConfirmDelete } from "../../hooks/useConfirmDelete";
import {
  Camera,
  Check,
  ExternalLink,
  GripVertical,
  Image as ImageIcon,
  Layers,
  Loader2,
  Package,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

import { TPSectionShell } from "../../components/ui/TPSectionShell";
import { TPButton } from "../../components/ui/TPButton";
import TPInput from "../../components/ui/TPInput";
import { TPField } from "../../components/ui/TPField";
import TPTextarea from "../../components/ui/TPTextarea";
import { GroupArticleTreePicker } from "../../components/ui/GroupArticleTreePicker";
import { ArticleGroupCreateModal } from "../../components/ui/ArticleGroupCreateModal";
import { Modal } from "../../components/ui/Modal";
import ConfirmDeleteDialog from "../../components/ui/ConfirmDeleteDialog";
import { TPTr, TPTd } from "../../components/ui/TPTable";
import { TPTableKit, type TPColDef } from "../../components/ui/TPTableKit";
import { TPStatusPill } from "../../components/ui/TPStatusPill";
import { TPRowActions } from "../../components/ui/TPRowActions";
import TPImageLightbox from "../../components/ui/TPImageLightbox";
import TPTableImage from "../../components/ui/TPTableImage";
import { cn } from "../../components/ui/tp";
import { toast } from "../../lib/toast";
import {
  articleGroupsApi,
  type ArticleGroupRow,
  type ArticleGroupDetail,
  type ArticleGroupMember,
  type ArticleGroupPayload,
  type ArticleGroupImage,
} from "../../services/article-groups";
import { fmtMoney } from "../../services/articles";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtStock(n: number): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------------
// Column definitions (tabla principal)
// ---------------------------------------------------------------------------
const GROUP_COLS: TPColDef[] = [
  { key: "name",     label: "Nombre",    canHide: false, sortKey: "name" },
  { key: "articles", label: "Artículos",                 sortKey: "articles" },
  { key: "status",   label: "Estado",                    sortKey: "isActive" },
  { key: "actions",  label: "",          canHide: false },
];

// ---------------------------------------------------------------------------
// Draft (modal crear/editar grupo)
// ---------------------------------------------------------------------------
const EMPTY_DRAFT = {
  name: "",
  description: "",
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

  type SortKey = "name" | "articles" | "isActive";
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: string) {
    const k = key as SortKey;
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  }

  // Modal crear/editar
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editRow, setEditRow]     = useState<ArticleGroupRow | null>(null);
  const [draft, setDraft]         = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving]       = useState(false);

  // Imágenes en modal editar
  const [editModalImages, setEditModalImages]     = useState<ArticleGroupImage[]>([]);
  const [loadingEditImages, setLoadingEditImages] = useState(false);
  const [busyModalImg, setBusyModalImg]           = useState(false);
  const [busyAddModalImg, setBusyAddModalImg]     = useState(false);
  const [removingModalImgId, setRemovingModalImgId] = useState<string | null>(null);
  const addModalImgRef = useRef<HTMLInputElement>(null);

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

  // Sidebar quick-create
  useEffect(() => {
    function onQuickCreate(e: Event) {
      const { screen } = (e as CustomEvent).detail ?? {};
      if (screen === "grupos-articulos") openCreate();
    }
    window.addEventListener("tptech:sidebar_quick_create", onQuickCreate);
    return () => window.removeEventListener("tptech:sidebar_quick_create", onQuickCreate);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    let result = rows;
    if (q.trim()) {
      const lq = q.toLowerCase();
      result = rows.filter(r =>
        r.name.toLowerCase().includes(lq) ||
        r.slug.toLowerCase().includes(lq) ||
        r.selectorLabel.toLowerCase().includes(lq)
      );
    }
    return [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name")     cmp = a.name.localeCompare(b.name, "es");
      if (sortKey === "articles") cmp = a._count.items - b._count.items;
      if (sortKey === "isActive") cmp = Number(a.isActive) - Number(b.isActive);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, q, sortKey, sortDir]);

  // ── Helpers de draft ────────────────────────────────────────────────────────
  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft(d => ({ ...d, [key]: value }));
  }

  function openCreate() {
    setModalMode("create");
  }

  function openEdit(row: ArticleGroupRow) {
    setDraft({
      name:          row.name,
      description:   row.description,
      selectorLabel: row.selectorLabel,
      isActive:      row.isActive,
    });
    setEditRow(row);
    setEditModalImages([]);
    setLoadingEditImages(true);
    articleGroupsApi.listImages(row.id)
      .then(setEditModalImages)
      .catch(() => toast.error("No se pudieron cargar las imágenes."))
      .finally(() => setLoadingEditImages(false));
    setModalMode("edit");
  }

  function closeModal() {
    setEditModalImages([]);
    setModalMode(null);
    setEditRow(null);
  }

  // ── Guardar ─────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!editRow) return;
    if (!draft.name.trim()) { toast.error("El nombre es obligatorio."); return; }
    setSaving(true);
    try {
      const payload: ArticleGroupPayload = {
        name:          draft.name.trim(),
        description:   draft.description,
        selectorLabel: draft.selectorLabel.trim(),
        isActive:      draft.isActive,
        slug:          editRow.slug,
        mainImageUrl:  editRow.mainImageUrl,
      };
      const updated = await articleGroupsApi.update(editRow.id, payload);
      setRows(r => r.map(x => x.id === updated.id ? updated : x));
      toast.success("Grupo actualizado.");
      closeModal();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  // ── Handlers de imágenes (modal crear/editar) ──────────────────────────────

  function handleModalUploadMainImage(file: File) {
    if (!editRow) return;
    setBusyModalImg(true);
    articleGroupsApi.uploadImage(editRow.id, file)
      .then(img => {
        setEditModalImages(prev => [img, ...prev.map(i => ({ ...i, isMain: false }))]);
        setRows(r => r.map(x => x.id === editRow.id ? { ...x, mainImageUrl: img.url } : x));
      })
      .catch(e => toast.error(e?.message ?? "Error al subir imagen."))
      .finally(() => setBusyModalImg(false));
  }

  function handleModalDeleteMainImage() {
    const main = editModalImages.find(i => i.isMain) ?? editModalImages[0] ?? null;
    if (main) handleModalRemoveImage(main.id);
  }

  function handleModalAddImage(file: File) {
    if (!editRow) return;
    if (editModalImages.length >= 5) { toast.error("Máximo 5 imágenes."); return; }
    setBusyAddModalImg(true);
    articleGroupsApi.uploadImage(editRow.id, file)
      .then(img => setEditModalImages(prev => [...prev, img]))
      .catch(e => toast.error(e?.message ?? "Error al subir imagen."))
      .finally(() => setBusyAddModalImg(false));
  }

  function handleModalSetMainImage(imgId: string) {
    if (!editRow) return;
    articleGroupsApi.setMainImage(editRow.id, imgId)
      .then(updated => {
        setEditModalImages(updated);
        const main = updated.find(i => i.isMain);
        if (main) setRows(r => r.map(x => x.id === editRow.id ? { ...x, mainImageUrl: main.url } : x));
      })
      .catch(e => toast.error(e?.message ?? "Error al cambiar imagen principal."));
  }

  function handleModalRemoveImage(imgId: string) {
    if (!editRow) return;
    setRemovingModalImgId(imgId);
    articleGroupsApi.removeImage(editRow.id, imgId)
      .then(() => {
        const wasMain = editModalImages.find(i => i.id === imgId)?.isMain;
        setEditModalImages(prev => prev.filter(i => i.id !== imgId));
        if (wasMain) load();
      })
      .catch(e => toast.error(e?.message ?? "Error al eliminar imagen."))
      .finally(() => setRemovingModalImgId(null));
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
        storageKey="tptech_col_article_groups_v2"
        search={q}
        onSearchChange={setQ}
        searchPlaceholder="Buscar grupos…"
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={toggleSort}
        loading={loading}
        emptyText={q ? "No hay resultados para esa búsqueda." : "No hay grupos creados. Creá el primero."}
        pagination
        countLabel={(n) => `${n} ${n === 1 ? "grupo" : "grupos"}`}
        actions={
          <TPButton variant="primary" onClick={openCreate} iconLeft={<Plus size={14} />}>
            Nuevo grupo
          </TPButton>
        }
        onRowClick={(row: ArticleGroupRow) => setDetailId(row.id)}
        renderRow={(row: ArticleGroupRow, _vis, _sel, orderedKeys) => {
          const cells: Record<string, React.ReactNode> = {
            name: (
              <TPTd key="name">
                <div className="flex items-center gap-2">
                  <TPTableImage
                    src={row.mainImageUrl || null}
                    sizeClass="w-7 h-7"
                    fallback={<ImageIcon size={12} className="text-muted" />}
                  />
                  <span className="font-medium text-sm">{row.name}</span>
                </div>
              </TPTd>
            ),
            articles: (
              <TPTd key="articles">
                <div className="flex items-center gap-1 text-xs text-muted">
                  <Package size={12} />
                  {row._count.items}
                </div>
              </TPTd>
            ),
            status: (
              <TPTd key="status">
                <TPStatusPill active={row.isActive} />
              </TPTd>
            ),
            actions: (
              <TPTd key="actions" className="text-right">
                <TPRowActions
                  onView={() => setDetailId(row.id)}
                  onEdit={() => openEdit(row)}
                  onToggle={() => handleToggle(row)}
                  isActive={row.isActive}
                  onDelete={() => askDelete({
                    entityName: "grupo",
                    entityLabel: row.name,
                    confirmDescription: "Los artículos del grupo NO serán eliminados. Quedarán desvinculados y continuarán existiendo normalmente.",
                    onDelete: () => articleGroupsApi.remove(row.id),
                    onAfterSuccess: load,
                  })}
                />
              </TPTd>
            ),
          };
          return (
            <TPTr key={row.id} className={!row.isActive ? "opacity-60" : undefined}>
              {(orderedKeys ?? ["name", "articles", "status", "actions"]).map(k => cells[k] ?? null)}
            </TPTr>
          );
        }}
      />

      {/* ── Modal Crear — componente compartido (misma UX que desde Artículos) */}
      {modalMode === "create" && (
        <ArticleGroupCreateModal
          onCreated={() => { load(); closeModal(); }}
          onClose={closeModal}
        />
      )}

      {/* ── Modal Editar ──────────────────────────────────────────────────── */}
      {modalMode === "edit" && editRow && (() => {
        const mainImgSrc  = editModalImages.find(i => i.isMain)?.url ?? editModalImages[0]?.url ?? null;
        const mainImgId   = editModalImages.find(i => i.isMain)?.id ?? editModalImages[0]?.id ?? null;

        return (
          <Modal open title="Editar grupo" onClose={closeModal} maxWidth="3xl" busy={saving} bodyClassName="min-h-[480px]">
            <div className="space-y-4 p-1">
              {/* Imagen principal + galería */}
              <div className="rounded-xl border border-border bg-surface2/30 p-4 flex flex-col items-center gap-3">
                <div className="relative group w-36 h-36 rounded-xl overflow-hidden border border-border bg-surface2 shrink-0">
                  {loadingEditImages ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <Loader2 size={20} className="animate-spin text-muted" />
                    </div>
                  ) : mainImgSrc ? (
                    <>
                      <img src={mainImgSrc} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                        <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-medium cursor-pointer transition-colors">
                          <Camera size={13} /> Cambiar
                          <input type="file" accept="image/*" hidden
                            onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ""; if (f) handleModalUploadMainImage(f); }}
                          />
                        </label>
                        {mainImgId && (
                          <button type="button" onClick={handleModalDeleteMainImage} disabled={busyModalImg}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-red-500/60 text-white text-xs font-medium transition-colors">
                            {busyModalImg ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            Eliminar
                          </button>
                        )}
                      </div>
                      {busyModalImg && (
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
                          <Loader2 size={20} className="animate-spin text-white" />
                        </div>
                      )}
                    </>
                  ) : (
                    <label className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted hover:text-primary cursor-pointer transition-colors">
                      {busyModalImg
                        ? <Loader2 size={22} className="animate-spin" />
                        : <><ImageIcon size={26} className="opacity-40" /><span className="text-xs">Subir imagen</span></>
                      }
                      <input type="file" accept="image/*" hidden
                        onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ""; if (f) handleModalUploadMainImage(f); }}
                      />
                    </label>
                  )}
                </div>

                {/* Tira de miniaturas */}
                <div className="flex gap-1 flex-wrap justify-center">
                  {editModalImages.map(img => (
                    <div key={img.id} onClick={() => { if (!img.isMain) handleModalSetMainImage(img.id); }}
                      className={cn("relative group/t w-11 h-11 rounded-lg overflow-hidden border-2 shrink-0 bg-surface2 transition-all",
                        img.isMain ? "border-primary cursor-default" : "border-border hover:border-primary/60 cursor-pointer")}>
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                      {img.isMain && (
                        <div className="absolute top-0.5 left-0.5 bg-primary rounded-sm w-3.5 h-3.5 flex items-center justify-center">
                          <Check size={8} className="text-white" strokeWidth={3} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/t:opacity-100 transition-opacity flex items-center justify-center gap-0.5">
                        {!img.isMain && (
                          <button type="button" title="Hacer principal" onClick={(e) => { e.stopPropagation(); handleModalSetMainImage(img.id); }}
                            className="p-1 rounded text-white hover:text-primary transition-colors"><Check size={11} /></button>
                        )}
                        <button type="button" title="Eliminar" disabled={removingModalImgId === img.id}
                          onClick={(e) => { e.stopPropagation(); handleModalRemoveImage(img.id); }}
                          className="p-1 rounded text-white hover:text-red-400 transition-colors">
                          {removingModalImgId === img.id ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
                        </button>
                      </div>
                    </div>
                  ))}
                  {editModalImages.length < 5 && !loadingEditImages && (
                    <button type="button" title="Agregar imagen"
                      onClick={() => addModalImgRef.current?.click()}
                      disabled={busyAddModalImg}
                      className="w-11 h-11 rounded-lg border-2 border-dashed border-primary/30 hover:border-primary/70 bg-primary/5 hover:bg-primary/10 flex items-center justify-center text-primary/60 hover:text-primary transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">
                      {busyAddModalImg ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} strokeWidth={2.5} />}
                    </button>
                  )}
                  <input ref={addModalImgRef} type="file" accept="image/*" hidden
                    onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ""; if (f) handleModalAddImage(f); }}
                  />
                </div>
                <span className="text-[10px] text-muted">{editModalImages.length}/5 · PNG, JPG, WebP</span>
              </div>

              <TPField label="Nombre *">
                <TPInput value={draft.name} onChange={(v) => set("name", v)} placeholder="Ej: Anillos de compromiso" autoFocus />
              </TPField>
              <TPField label="Diferencia principal" hint="Define qué cambia entre los artículos. Ej: Medida, Color, Talle, Largo.">
                <TPInput value={draft.selectorLabel} onChange={(v) => set("selectorLabel", v)} placeholder="Ej: Medida" />
              </TPField>
              <TPField label="Descripción" hint="Visible en el detalle del grupo.">
                <TPTextarea value={draft.description} onChange={(v) => set("description", v)} placeholder="Descripción breve del grupo" rows={3} />
              </TPField>

              <div className="flex justify-end gap-2 pt-1">
                <TPButton variant="secondary" iconLeft={<X size={16} />} onClick={closeModal} disabled={saving}>
                  Cancelar
                </TPButton>
                <TPButton variant="primary" onClick={handleSave} loading={saving} iconLeft={<Save size={14} />}>
                  Guardar cambios
                </TPButton>
              </div>
            </div>
          </Modal>
        );
      })()}

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
// GroupDetailModal — gestión completa de variantes en un grupo
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
  const [items, setItems]           = useState<ArticleGroupMember[]>([]);
  const [reordering, setReordering] = useState(false);

  // Flujo de confirmación al quitar item del grupo
  const [pendingRemove,    setPendingRemove]    = useState<ArticleGroupMember | null>(null);
  const [removingItem,     setRemovingItem]     = useState(false);

  const dragSrcIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Recarga local de items tras una mutación (no depende del ciclo detail→prop→useEffect del padre)
  async function reloadItems() {
    try {
      const freshDetail = await articleGroupsApi.get(groupId);
      setItems([...freshDetail.items]);
    } catch {
      // silencioso — la lista puede estar desactualizada hasta el próximo reload completo
    }
  }

  // Imágenes
  const [images, setImages]           = useState<ArticleGroupImage[]>([]);
  const [busyImg, setBusyImg]         = useState(false);
  const [busyAddImg, setBusyAddImg]   = useState(false);
  const [removingImgId, setRemovingImgId] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const addImgRef                     = useRef<HTMLInputElement>(null);


  // Sincronizar items e images con detail
  useEffect(() => {
    if (detail) {
      setItems([...detail.items]);
      setImages([...(detail.images ?? [])]);
    }
  }, [detail]);

  // ── Handlers de imágenes ─────────────────────────────────────────────────
  function handleUploadMainImage(file: File) {
    setBusyImg(true);
    articleGroupsApi.uploadImage(groupId, file)
      .then(img => {
        setImages(prev => [img, ...prev.map(i => ({ ...i, isMain: false }))]);
        onReload();
      })
      .catch(e => toast.error(e?.message ?? "Error al subir imagen."))
      .finally(() => setBusyImg(false));
  }

  function handleDeleteMainImage() {
    const main = images.find(i => i.isMain) ?? images[0] ?? null;
    if (!main) return;
    handleRemoveImage(main.id);
  }

  function handleAddImage(file: File) {
    if (images.length >= 5) { toast.error("Máximo 5 imágenes."); return; }
    setBusyAddImg(true);
    articleGroupsApi.uploadImage(groupId, file)
      .then(img => setImages(prev => [...prev, img]))
      .catch(e => toast.error(e?.message ?? "Error al subir imagen."))
      .finally(() => setBusyAddImg(false));
  }

  function handleSetMain(imgId: string) {
    articleGroupsApi.setMainImage(groupId, imgId)
      .then(updated => { setImages(updated); onReload(); })
      .catch(e => toast.error(e?.message ?? "Error al cambiar imagen principal."));
  }

  function handleRemoveImage(imgId: string) {
    setRemovingImgId(imgId);
    articleGroupsApi.removeImage(groupId, imgId)
      .then(() => {
        const wasMain = images.find(i => i.id === imgId)?.isMain;
        setImages(prev => prev.filter(i => i.id !== imgId));
        if (wasMain) onReload();
      })
      .catch(e => toast.error(e?.message ?? "Error al eliminar imagen."))
      .finally(() => setRemovingImgId(null));
  }

  // ── Quitar item del grupo — abre confirmación ────────────────────────────
  function handleRemove(item: ArticleGroupMember) {
    setPendingRemove(item);
  }

  async function confirmRemove() {
    if (!pendingRemove) return;
    setRemovingItem(true);
    try {
      await articleGroupsApi.removeItem(groupId, pendingRemove.id);
      setItems(prev => prev.filter(x => x.id !== pendingRemove.id));
      onReload();
      const label = pendingRemove.itemType === "VARIANT"
        ? `"${pendingRemove.article.name} — ${pendingRemove.name}"`
        : `"${pendingRemove.name}"`;
      toast.success(`${label} quitado del grupo.`);
      setPendingRemove(null);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo quitar el item.");
    } finally {
      setRemovingItem(false);
    }
  }

  // ── Actualizar selector value ────────────────────────────────────────────
  async function handleUpdateSelectorValue(item: ArticleGroupMember, value: string) {
    try {
      const updated = await articleGroupsApi.updateSelectorValue(groupId, item.id, value);
      setItems(prev => prev.map(x => x.id === item.id ? { ...x, groupSelectorValue: updated.groupSelectorValue } : x));
    } catch {
      toast.error("No se pudo guardar el valor.");
      // Reset to the value from before the edit so the user can retry
      setItems(prev => prev.map(x => x.id === item.id ? { ...x, groupSelectorValue: item.groupSelectorValue } : x));
    }
  }

  // ── Drag and drop ────────────────────────────────────────────────────────
  function handleDragStart(idx: number) {
    dragSrcIdx.current = idx;
  }

  function handleDragOverRow(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragSrcIdx.current !== null && dragSrcIdx.current !== idx) {
      setDragOverIdx(idx);
    }
  }

  function handleDropRow(idx: number) {
    const src = dragSrcIdx.current;
    setDragOverIdx(null);
    dragSrcIdx.current = null;
    if (src === null || src === idx) return;
    const prev = [...items];
    const next = [...items];
    const [moved] = next.splice(src, 1);
    next.splice(idx, 0, moved);
    setItems(next);
    setReordering(true);
    articleGroupsApi.reorderItems(groupId, next.map(i => i.id))
      .catch(() => { toast.error("No se pudo guardar el orden."); setItems(prev); })
      .finally(() => setReordering(false));
  }

  function handleDragEndRow() {
    setDragOverIdx(null);
    dragSrcIdx.current = null;
  }

  const title = detail ? detail.name : "Items del grupo";
  const mainImgSrc = images.find(i => i.isMain)?.url ?? images[0]?.url ?? null;
  const mainImgId  = images.find(i => i.isMain)?.id ?? images[0]?.id ?? null;

  return (
    <Modal open title={title} onClose={onClose} maxWidth="4xl" bodyClassName="min-h-[520px]">
      <div className="space-y-5 p-1">
        <TPImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />

        {loading ? (
          <div className="py-10 text-center text-sm text-muted">Cargando…</div>
        ) : detail ? (
          <>
            {/* Ficha: descripción → imagen centrada → stats */}
            <div className="rounded-xl bg-surface2/40 border border-border/50 p-4 space-y-3">

              {/* Descripción + diferencia principal — arriba del todo */}
              <div className="space-y-1.5">
                {detail.description ? (
                  <p className="text-sm text-muted leading-relaxed">{detail.description}</p>
                ) : (
                  <p className="text-sm text-muted/40 italic">Sin descripción.</p>
                )}
                {detail.selectorLabel && (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/8 px-2.5 py-1">
                    <span className="text-[11px] text-primary/70 font-medium">Diferencia principal:</span>
                    <span className="text-[11px] text-primary font-semibold">{detail.selectorLabel}</span>
                  </div>
                )}
              </div>

              {/* Imagen centrada + galería */}
              <div className="flex flex-col items-center gap-2">

                {/* Imagen principal 144×144 */}
                <div className="relative group/main w-36 h-36 rounded-xl overflow-hidden border border-border bg-surface2 shrink-0">
                  {mainImgSrc ? (
                    <>
                      <img
                        src={mainImgSrc}
                        alt=""
                        className="w-full h-full object-cover cursor-zoom-in"
                        onClick={() => setLightboxSrc(mainImgSrc)}
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/main:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 pointer-events-none">
                        <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-medium cursor-pointer transition-colors pointer-events-auto"
                          onClick={(e) => e.stopPropagation()}>
                          <Camera size={13} /> Cambiar
                          <input type="file" accept="image/*" hidden
                            onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ""; if (f) handleUploadMainImage(f); }}
                          />
                        </label>
                        {mainImgId && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteMainImage(); }} disabled={busyImg}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-red-500/60 text-white text-xs font-medium transition-colors pointer-events-auto">
                            {busyImg ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            Eliminar
                          </button>
                        )}
                      </div>
                      {busyImg && (
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
                          <Loader2 size={22} className="animate-spin text-white" />
                        </div>
                      )}
                    </>
                  ) : (
                    <label className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted hover:text-primary cursor-pointer transition-colors">
                      {busyImg
                        ? <Loader2 size={22} className="animate-spin" />
                        : <><ImageIcon size={26} className="opacity-40" /><span className="text-xs">Subir imagen</span></>
                      }
                      <input type="file" accept="image/*" hidden
                        onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ""; if (f) handleUploadMainImage(f); }}
                      />
                    </label>
                  )}
                </div>

                {/* Tira de miniaturas + botón agregar */}
                <div className="flex gap-1 flex-wrap justify-center">
                  {images.map(img => (
                    <div key={img.id} onClick={() => { if (!img.isMain) handleSetMain(img.id); }}
                      className={cn("relative group/t w-11 h-11 rounded-lg overflow-hidden border-2 shrink-0 bg-surface2 transition-all",
                        img.isMain ? "border-primary cursor-default" : "border-border hover:border-primary/60 cursor-pointer")}>
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                      {img.isMain && (
                        <div className="absolute top-0.5 left-0.5 bg-primary rounded-sm w-3.5 h-3.5 flex items-center justify-center">
                          <Check size={8} className="text-white" strokeWidth={3} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/t:opacity-100 transition-opacity flex items-center justify-center gap-0.5">
                        {!img.isMain && (
                          <button type="button" title="Hacer principal" onClick={(e) => { e.stopPropagation(); handleSetMain(img.id); }}
                            className="p-1 rounded text-white hover:text-primary transition-colors"><Check size={11} /></button>
                        )}
                        <button type="button" title="Eliminar" disabled={removingImgId === img.id}
                          onClick={(e) => { e.stopPropagation(); handleRemoveImage(img.id); }}
                          className="p-1 rounded text-white hover:text-red-400 transition-colors">
                          {removingImgId === img.id ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
                        </button>
                      </div>
                    </div>
                  ))}
                  {images.length < 5 && (
                    <button type="button" title="Agregar imagen" onClick={() => addImgRef.current?.click()} disabled={busyAddImg}
                      className="w-11 h-11 rounded-lg border-2 border-dashed border-primary/30 hover:border-primary/70 bg-primary/5 hover:bg-primary/10 flex items-center justify-center text-primary/60 hover:text-primary transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">
                      {busyAddImg ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} strokeWidth={2.5} />}
                    </button>
                  )}
                  <input ref={addImgRef} type="file" accept="image/*" hidden
                    onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ""; if (f) handleAddImage(f); }}
                  />
                </div>
                <span className="text-[10px] text-muted">{images.length}/5 · PNG, JPG, WebP</span>
              </div>

              {/* Stats del grupo */}
              {items.length > 0 && (
                <div className="pt-1 border-t border-border/40">
                  <GroupStats items={items} />
                </div>
              )}
            </div>

            {/* ── Agregar artículos al grupo ──────────────────────────────── */}
            <GroupArticleTreePicker
              groupId={groupId}
              selectorLabel={detail?.selectorLabel ?? ""}
              onAdded={() => { reloadItems(); onReload(); }}
            />

            {/* ── Card 3: Listado de items agregados ─────────────────────── */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="bg-surface2/60 border-b border-border px-3 py-2 flex items-center gap-1.5">
                <Package size={14} className="text-muted" />
                <span className="text-sm font-semibold text-text">Items</span>
              </div>

              {items.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted">
                  No hay items en este grupo todavía.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {items.map((item, idx) => (
                    <GroupMemberRow
                      key={item.id}
                      member={item}
                      reordering={reordering}
                      selectorLabel={detail?.selectorLabel ?? ""}
                      onRemove={handleRemove}
                      onOpen={() => onNavigate(`/articulos/${item.article.id}`)}
                      onUpdateSelectorValue={handleUpdateSelectorValue}
                      isDragOver={dragOverIdx === idx}
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOverRow(e, idx)}
                      onDrop={() => handleDropRow(idx)}
                      onDragEnd={handleDragEndRow}
                    />
                  ))}
                </div>
              )}

              {/* Contador — abajo a la izquierda */}
              <div className="border-t border-border/50 px-3 py-1.5">
                <span className="text-[11px] text-muted">
                  {items.length === 0
                    ? "Sin items"
                    : `${items.length} ${items.length === 1 ? "item" : "items"}`}
                </span>
              </div>
            </div>

            {/* Botón cerrar — footer */}
            <div className="flex justify-end pt-1">
              <TPButton variant="secondary" iconLeft={<X size={16} />} onClick={onClose}>
                Cerrar
              </TPButton>
            </div>
          </>
        ) : null}
      </div>

      {/* ── Confirmación para quitar item del grupo ──────────────────────── */}
      <ConfirmDeleteDialog
        open={pendingRemove !== null}
        title="Quitar del grupo"
        description={
          pendingRemove
            ? `Vas a quitar "${
                pendingRemove.itemType === "VARIANT"
                  ? `${pendingRemove.article.name} — ${pendingRemove.name}`
                  : pendingRemove.name
              }" del grupo. El item no se eliminará del sistema, solo se desvinculará. No se afecta stock, precio ni costo.`
            : ""
        }
        confirmText="Quitar del grupo"
        busy={removingItem}
        onClose={() => { if (!removingItem) setPendingRemove(null); }}
        onConfirm={confirmRemove}
      />
    </Modal>
  );
}

// ===========================================================================
// GroupStats — resumen estadístico del grupo
// ===========================================================================
function GroupStats({ items }: { items: ArticleGroupMember[] }) {
  if (items.length === 0) return null;

  const active   = items.filter(i => i.isActive).length;
  const inactive = items.length - active;
  const prices   = items.filter(i => (i.resolvedSalePriceWithTax ?? i.resolvedSalePrice) != null).map(i => Number(i.resolvedSalePriceWithTax ?? i.resolvedSalePrice));
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
  const noImage  = items.filter(i => !i.imageUrl && !i.article.mainImageUrl).length;

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
// GroupMemberRow — fila de un item (variante o artículo simple) dentro del grupo
// ===========================================================================
interface GroupMemberRowProps {
  member: ArticleGroupMember;
  reordering: boolean;
  selectorLabel: string;
  onRemove: (m: ArticleGroupMember) => void;
  onOpen: () => void;
  onUpdateSelectorValue: (m: ArticleGroupMember, value: string) => void;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

function GroupMemberRow({ member, reordering, selectorLabel, onRemove, onOpen, onUpdateSelectorValue, isDragOver, onDragStart, onDragOver, onDrop, onDragEnd }: GroupMemberRowProps) {
  const [localValue, setLocalValue] = useState(member.groupSelectorValue ?? "");
  const lastSaved = useRef(member.groupSelectorValue ?? "");
  // Ref al div raíz — permite activar draggable sincronamente solo desde el handle
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalValue(member.groupSelectorValue ?? "");
    lastSaved.current = member.groupSelectorValue ?? "";
  }, [member.groupSelectorValue]);

  function commitValue() {
    const trimmed = localValue.trim();
    if (trimmed !== lastSaved.current) {
      onUpdateSelectorValue(member, trimmed);
    }
  }

  const imgSrc = member.imageUrl || member.article.mainImageUrl || null;

  return (
    <div
      ref={rowRef}
      // draggable=false por defecto — el handle lo activa sincronamente via DOM
      // para evitar que el browser intercepte mousedown en inputs y rompa el foco.
      draggable={false}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={() => {
        if (rowRef.current) rowRef.current.draggable = false;
        onDragEnd();
      }}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 hover:bg-surface2/30 transition-colors select-none",
        !member.isActive && "opacity-60",
        isDragOver && "bg-primary/5 border-t-2 border-primary"
      )}
    >
      {/* Drag handle — activa draggable en el row solo cuando el usuario lo pulsa */}
      <div
        className="cursor-grab active:cursor-grabbing text-muted/50 hover:text-muted transition-colors shrink-0"
        title="Arrastrar para reordenar"
        onMouseDown={() => {
          if (!reordering && rowRef.current) rowRef.current.draggable = true;
        }}
        onMouseUp={() => {
          if (rowRef.current) rowRef.current.draggable = false;
        }}
      >
        <GripVertical size={13} />
      </div>

      {/* Imagen */}
      <TPTableImage
        src={imgSrc}
        sizeClass="w-9 h-9"
        fallback={<Package size={13} className="text-muted" />}
      />

      {/* Info — nombre + badges + código */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-medium text-text truncate min-w-0 flex-1">
            {member.itemType === "VARIANT"
              ? `${member.article.name} — ${member.name}`
              : member.name}
          </span>
          <span className={cn(
            "shrink-0 text-[10px] rounded-full px-1.5 py-0.5 font-medium leading-none",
            member.itemType === "VARIANT" ? "bg-blue-500/10 text-blue-600" : "bg-emerald-500/10 text-emerald-700"
          )}>
            {member.itemType === "VARIANT" ? "Variante" : "Artículo"}
          </span>
          <span className="shrink-0"><TPStatusPill active={member.isActive} /></span>
        </div>
        <div className="text-[11px] text-muted flex items-center gap-1.5 mt-0.5">
          {member.code && <span className="font-mono">{member.code}</span>}
          {member.sku && <><span className="text-muted/40">·</span><span>SKU {member.sku}</span></>}
          {member.article.category && <><span className="text-muted/40">·</span><span className="truncate">{member.article.category.name}</span></>}
        </div>
      </div>

      {/* Valor del selector — solo si el grupo tiene selectorLabel */}
      {selectorLabel && (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] text-muted whitespace-nowrap">{selectorLabel}:</span>
          <TPInput
            value={localValue}
            onChange={(v) => setLocalValue(v)}
            onBlur={commitValue}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            placeholder="—"
            className="!h-7 !leading-7 !py-0 !px-2 !text-xs !rounded-lg w-24"
            wrapClassName="!space-y-0"
          />
        </div>
      )}

      {/* Precio de lista + stock */}
      <div className="flex flex-col items-end gap-0.5 shrink-0 min-w-[96px] text-right">
        {(member.resolvedSalePriceWithTax ?? member.resolvedSalePrice) ? (
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] text-muted/70 leading-none">P. lista:</span>
            <span className="text-sm font-semibold text-text leading-none">{fmtMoney(member.resolvedSalePriceWithTax ?? member.resolvedSalePrice!)}</span>
          </div>
        ) : (
          <span className="text-xs text-muted italic">Sin precio</span>
        )}
        <span className="text-[11px] text-muted tabular-nums">
          Stock: {fmtStock(member.stockTotal)}
        </span>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-0.5 shrink-0">
        <TPButton variant="ghost" className="!h-7 !w-7 !p-0 flex items-center justify-center" iconLeft={<ExternalLink size={13} />}
          onClick={onOpen} title="Abrir artículo" tabIndex={-1} />
        <TPButton variant="ghost" className="!h-7 !w-7 !p-0 flex items-center justify-center text-muted hover:text-red-500 hover:bg-red-500/10" iconLeft={<X size={13} />}
          onClick={() => onRemove(member)} title="Quitar del grupo" tabIndex={-1} />
      </div>
    </div>
  );
}
