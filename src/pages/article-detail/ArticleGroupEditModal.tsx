// src/pages/article-detail/ArticleGroupEditModal.tsx
import React, { useEffect, useRef, useState } from "react";
import { GripVertical, Layers, Loader2, X } from "lucide-react";
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
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "../../components/ui/tp";
import { Modal }         from "../../components/ui/Modal";
import TPTableImage     from "../../components/ui/TPTableImage";
import { TPButton } from "../../components/ui/TPButton";
import { TPField } from "../../components/ui/TPField";
import TPComboFixed from "../../components/ui/TPComboFixed";
import ConfirmDeleteDialog from "../../components/ui/ConfirmDeleteDialog";
import { toast } from "../../lib/toast";
import {
  articleGroupsApi,
  type ArticleGroupRow,
  type GroupBatchChange,
} from "../../services/article-groups";
import { articlesApi, type ArticleRow } from "../../services/articles";

// Sentinel values para el selector de grupo por variante
const INHERIT = "__inherit__";
const NONE    = "__none__";
const SEP     = "__sep__";   // separador visual en el combo

type VariantLocalState = {
  variantId:    string;
  name:         string;
  code:         string;
  sku:          string;
  imageUrl:     string;
  isActive:     boolean;
  dbGroupId:    string | null;
  /** "__inherit__" | "__none__" | "uuid-de-grupo" */
  localGroupId: string;
};

function deriveParentGroup(variants: { groupId: string | null }[]): string {
  const ids = variants.map(v => v.groupId).filter((id): id is string => id !== null);
  if (ids.length === 0) return "";
  const counts: Record<string, number> = {};
  for (const id of ids) counts[id] = (counts[id] ?? 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function effectiveGroupId(v: VariantLocalState, parentGroupId: string): string | null {
  if (v.localGroupId === INHERIT) return parentGroupId || null;
  if (v.localGroupId === NONE)    return null;
  if (v.localGroupId === SEP)     return null;
  return v.localGroupId || null;
}

// ─── SortableVariantRow ────────────────────────────────────────────────────

type SortableVariantRowProps = {
  v:               VariantLocalState;
  parentGroupId:   string;
  articleImageUrl: string;
  options:         { value: string; label: string; isHeader?: boolean }[];
  onChangeGroup:   (value: string) => void;
  onClearGroup:    () => void;
};

function SortableVariantRow({
  v,
  parentGroupId,
  articleImageUrl,
  options,
  onChangeGroup,
  onClearGroup,
}: SortableVariantRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: v.variantId });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const effective = effectiveGroupId(v, parentGroupId);
  const isInherit  = v.localGroupId === INHERIT;
  const isNone     = v.localGroupId === NONE;
  const isOverride = !isInherit && !isNone;
  const canClear   = v.localGroupId !== NONE;

  // Imagen: prioridad variante → fallback artículo padre
  const imageSrc = v.imageUrl || articleImageUrl || null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-3 py-2 bg-card hover:bg-surface2/20 transition-colors",
        !v.isActive && "opacity-60",
        isDragging && "opacity-50 ring-1 ring-primary/40 z-50 rounded-xl",
      )}
    >
      {/* Handle de arrastre */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab active:cursor-grabbing text-muted/30 hover:text-muted/60 transition touch-none p-0.5"
        title="Arrastrar para reordenar"
        tabIndex={-1}
      >
        <GripVertical size={13} />
      </button>

      {/* Imagen */}
      <TPTableImage
        src={imageSrc}
        sizeClass="w-8 h-8"
        alt={v.name || v.code}
      />

      {/* Nombre / SKU */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-medium text-text truncate">{v.name || v.code}</span>
          {!v.isActive && (
            <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-muted bg-surface2 px-1 py-0.5 rounded">
              Inactivo
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] font-mono text-muted/70">{v.code}</span>
          {v.sku && v.sku !== v.code && (
            <span className="text-[10px] text-muted/50">· {v.sku}</span>
          )}
        </div>
      </div>

      {/* Badge de estado de grupo */}
      <div className="shrink-0 w-14 text-right">
        {isInherit && effective && (
          <span className="text-[10px] font-medium text-primary/70">Heredado</span>
        )}
        {isInherit && !effective && (
          <span className="text-[10px] text-muted/50">Sin grupo</span>
        )}
        {isOverride && (
          <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">Propio</span>
        )}
        {isNone && (
          <span className="text-[10px] text-muted/50">Sin grupo</span>
        )}
      </div>

      {/* Selector de grupo */}
      <div className="shrink-0 w-52">
        <TPComboFixed
          value={v.localGroupId}
          onChange={onChangeGroup}
          options={options}
        />
      </div>

      {/* X rápida para dejar sin grupo */}
      <div className="shrink-0 w-5 flex items-center justify-center">
        {canClear && (
          <button
            type="button"
            onClick={onClearGroup}
            className="text-muted/30 hover:text-red-500 transition-colors"
            title="Quitar grupo de esta variante"
            tabIndex={-1}
          >
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Props del modal ───────────────────────────────────────────────────────

export type ArticleGroupEditModalProps = {
  open:       boolean;
  onClose:    () => void;
  articleRow: ArticleRow;
  groups:     ArticleGroupRow[];
  onSaved:    (groupId: string | null, groupSlug: string | null, groupName: string | null) => void;
};

// ─── Componente principal ──────────────────────────────────────────────────

export default function ArticleGroupEditModal({
  open,
  onClose,
  articleRow,
  groups,
  onSaved,
}: ArticleGroupEditModalProps) {
  const [loading,       setLoading]       = useState(false);
  const [busy,          setBusy]          = useState(false);
  const [isSimple,      setIsSimple]      = useState(true);
  const [parentGroupId, setParentGroupId] = useState("");
  const [variantStates, setVariantStates] = useState<VariantLocalState[]>([]);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Orden inicial para detectar si cambió
  const initialOrderRef = useRef<string[]>([]);

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    articleGroupsApi.getArticleGroupState(articleRow.id)
      .then(state => {
        if (!state.hasVariants) {
          setIsSimple(true);
          setParentGroupId(state.articleGroupId ?? "");
          setVariantStates([]);
          initialOrderRef.current = [];
        } else {
          setIsSimple(false);
          const derived = deriveParentGroup(state.variants);
          setParentGroupId(derived);
          const vs: VariantLocalState[] = state.variants.map(v => ({
            variantId:    v.id,
            name:         v.name,
            code:         v.code,
            sku:          v.sku,
            imageUrl:     v.imageUrl ?? "",
            isActive:     v.isActive ?? true,
            dbGroupId:    v.groupId,
            localGroupId: v.groupId === null
              ? NONE
              : v.groupId === derived
                ? INHERIT
                : v.groupId,
          }));
          setVariantStates(vs);
          initialOrderRef.current = vs.map(v => v.variantId);
        }
      })
      .catch(() => toast.error("Error al cargar el estado del grupo."))
      .finally(() => setLoading(false));
  }, [open, articleRow.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeGroups   = groups.filter(g => g.isActive && !g.deletedAt);
  const parentGroupObj = activeGroups.find(g => g.id === parentGroupId) ?? null;

  // ── Estadísticas de estado ─────────────────────────────────────────────────
  const inheritCount  = variantStates.filter(v => v.localGroupId === INHERIT).length;
  const overrideCount = variantStates.filter(v => v.localGroupId !== INHERIT && v.localGroupId !== NONE).length;
  const noneCount     = variantStates.filter(v => v.localGroupId === NONE).length;
  const isMixed       = overrideCount > 0 && (inheritCount > 0 || noneCount > 0);

  const hasCurrentGroup = isSimple
    ? !!articleRow.groupId
    : variantStates.some(v => v.dbGroupId !== null);

  // ── Opciones ───────────────────────────────────────────────────────────────

  const parentOptions = [
    { value: "",   label: "— Sin grupo base —" },
    ...activeGroups.map(g => ({ value: g.id, label: g.name })),
  ];

  function variantGroupOptions(): { value: string; label: string; isHeader?: boolean }[] {
    return [
      {
        value: INHERIT,
        label: parentGroupId
          ? `Heredar del padre — ${parentGroupObj?.name ?? ""}`
          : "Heredar del padre (sin grupo base)",
      },
      ...activeGroups.map(g => ({
        value: g.id,
        label: g.id === parentGroupId ? `${g.name}  ← base` : g.name,
      })),
      // Separador visual antes de "Sin grupo"
      { value: SEP,  label: " ", isHeader: true },
      { value: NONE, label: "Sin grupo" },
    ];
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  function setVariantGroup(variantId: string, value: string) {
    if (value === SEP) return; // separador, ignorar
    setVariantStates(prev => prev.map(v =>
      v.variantId === variantId ? { ...v, localGroupId: value } : v,
    ));
  }

  function clearVariantGroup(variantId: string) {
    setVariantStates(prev => prev.map(v =>
      v.variantId === variantId ? { ...v, localGroupId: NONE } : v,
    ));
  }

  function resetAllToInherit() {
    setVariantStates(prev => prev.map(v => ({ ...v, localGroupId: INHERIT })));
  }

  function handleVariantDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setVariantStates(prev => {
      const oldIdx = prev.findIndex(v => v.variantId === active.id);
      const newIdx = prev.findIndex(v => v.variantId === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  }

  async function handleSave() {
    setBusy(true);
    try {
      // ── Cambios de grupo ────────────────────────────────────────────────
      const changes: GroupBatchChange[] = [];

      if (isSimple) {
        const newId = parentGroupId || null;
        if (newId !== (articleRow.groupId ?? null)) {
          changes.push({ type: "ARTICLE", id: articleRow.id, groupId: newId });
        }
      } else {
        for (const v of variantStates) {
          const effective = effectiveGroupId(v, parentGroupId);
          if (effective !== v.dbGroupId) {
            changes.push({ type: "VARIANT", id: v.variantId, groupId: effective });
          }
        }
      }

      // ── Cambios de orden ────────────────────────────────────────────────
      const newOrder = variantStates.map(v => v.variantId);
      const orderChanged = !isSimple && newOrder.some((id, i) => id !== (initialOrderRef.current[i] ?? ""));

      if (changes.length === 0 && !orderChanged) { onClose(); return; }

      await Promise.all([
        changes.length > 0
          ? articleGroupsApi.applyArticleGroupBatch(articleRow.id, changes)
          : Promise.resolve(),
        orderChanged
          ? articlesApi.variants.reorder(articleRow.id, newOrder)
          : Promise.resolve(),
      ]);

      // ── Resultado para actualizar la fila en tabla ──────────────────────
      let newGroupId: string | null = null;
      if (isSimple) {
        newGroupId = parentGroupId || null;
      } else {
        const eff = variantStates
          .map(v => effectiveGroupId(v, parentGroupId))
          .filter((id): id is string => id !== null);
        if (eff.length > 0) {
          const cnt: Record<string, number> = {};
          for (const id of eff) cnt[id] = (cnt[id] ?? 0) + 1;
          newGroupId = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
        }
      }

      const newGroup = newGroupId ? activeGroups.find(g => g.id === newGroupId) ?? null : null;
      toast.success("Grupo actualizado.");
      onSaved(newGroupId, newGroup?.slug ?? null, newGroup?.name ?? null);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar el grupo.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveAll() {
    setBusy(true);
    setConfirmRemove(false);
    try {
      const changes: GroupBatchChange[] = [];
      if (isSimple) {
        if (articleRow.groupId) changes.push({ type: "ARTICLE", id: articleRow.id, groupId: null });
      } else {
        for (const v of variantStates) {
          if (v.dbGroupId !== null) changes.push({ type: "VARIANT", id: v.variantId, groupId: null });
        }
      }
      if (changes.length > 0) await articleGroupsApi.applyArticleGroupBatch(articleRow.id, changes);
      toast.success("Artículo quitado del grupo.");
      onSaved(null, null, null);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Error al quitar del grupo.");
    } finally {
      setBusy(false);
    }
  }

  // ── Texto del confirm remove ───────────────────────────────────────────────
  const removeDescription = (() => {
    if (isSimple) {
      return `¿Quitar "${articleRow.name}" del grupo "${articleRow.group?.name}"? No se modifica stock ni precio.`;
    }
    const withGroup = variantStates.filter(v => v.dbGroupId !== null).length;
    const uniqueGroups = new Set(variantStates.map(v => v.dbGroupId).filter(Boolean));
    return `¿Quitar ${withGroup} variante${withGroup !== 1 ? "s" : ""} de su${withGroup !== 1 ? "s" : ""} grupo${uniqueGroups.size > 1 ? "s" : ""}?${uniqueGroups.size > 1 ? ` Tienen ${uniqueGroups.size} grupos distintos.` : ""} No se modifica stock ni precio.`;
  })();

  const cachedOptions = variantGroupOptions();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <Modal
        open={open}
        title={`Gestión de grupo — ${articleRow.name}`}
        maxWidth="lg"
        onClose={() => { if (!busy) onClose(); }}
        busy={busy}
        resizable
        maximizable
        maximizedMode="embedded"
        modalKey="articulos-grupos-editor"
        onEnter={() => { if (!busy && !loading) void handleSave(); }}
        footer={
          <div className="flex items-center justify-between gap-2 w-full">
            {/* Izquierda: acción destructiva */}
            <div>
              {hasCurrentGroup && (
                <TPButton
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setConfirmRemove(true)}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                >
                  Quitar del grupo
                </TPButton>
              )}
            </div>
            {/* Derecha: acciones normales */}
            <div className="flex items-center gap-2">
              <TPButton variant="secondary" disabled={busy} onClick={onClose}>
                Cancelar
              </TPButton>
              <TPButton loading={busy} disabled={loading} onClick={() => void handleSave()}>
                Aplicar
              </TPButton>
            </div>
          </div>
        }
      >
        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Cargando estado del grupo…</span>
          </div>
        ) : (
          <div className="space-y-4">

            {/* ── Resumen de estados (solo si hay variantes) ── */}
            {!isSimple && variantStates.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 rounded-xl bg-surface2/50 border border-border/40 text-xs">
                {inheritCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-primary/80">
                    <Layers size={10} />
                    {inheritCount} heredan del padre
                  </span>
                )}
                {overrideCount > 0 && (
                  <span className="text-amber-600 dark:text-amber-400">
                    {overrideCount} con grupo propio
                  </span>
                )}
                {noneCount > 0 && (
                  <span className="text-muted/70">{noneCount} sin grupo</span>
                )}
                <span className="ml-auto font-medium">
                  {isMixed
                    ? <span className="text-amber-600 dark:text-amber-400">Configuración mixta</span>
                    : inheritCount > 0 && overrideCount === 0 && noneCount === 0
                      ? <span className="text-muted/60">Todas en el mismo grupo</span>
                      : null
                  }
                </span>
              </div>
            )}

            {/* ── Grupo base / selector del padre ── */}
            <TPField
              label={isSimple ? "Grupo comercial" : "Grupo base del artículo"}
              hint={isSimple ? undefined : "Las variantes en modo 'Heredar del padre' usarán este grupo."}
            >
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <TPComboFixed
                    value={parentGroupId}
                    onChange={setParentGroupId}
                    options={parentOptions}
                    searchable
                  />
                </div>
                {!isSimple && variantStates.some(v => v.localGroupId !== INHERIT) && (
                  <button
                    type="button"
                    onClick={resetAllToInherit}
                    className="shrink-0 text-xs text-primary hover:text-primary/70 whitespace-nowrap transition-colors"
                    title="Poner todas las variantes en modo heredar"
                  >
                    Aplicar a todas
                  </button>
                )}
              </div>
            </TPField>

            {/* ── Lista de variantes con DnD ── */}
            {!isSimple && variantStates.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Variantes</p>
                <div className="rounded-xl border border-border/50 divide-y divide-border/30 overflow-hidden">
                  <DndContext
                    sensors={dndSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleVariantDragEnd}
                  >
                    <SortableContext
                      items={variantStates.map(v => v.variantId)}
                      strategy={verticalListSortingStrategy}
                    >
                      {variantStates.map(v => (
                        <SortableVariantRow
                          key={v.variantId}
                          v={v}
                          parentGroupId={parentGroupId}
                          articleImageUrl={articleRow.mainImageUrl ?? ""}
                          options={cachedOptions}
                          onChangeGroup={(val) => setVariantGroup(v.variantId, val)}
                          onClearGroup={() => clearVariantGroup(v.variantId)}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>
              </div>
            )}

          </div>
        )}
      </Modal>

      {/* ── Confirmación quitar del grupo ── */}
      <ConfirmDeleteDialog
        open={confirmRemove}
        title="Quitar del grupo"
        description={removeDescription}
        confirmText="Quitar del grupo"
        busy={busy}
        onConfirm={() => void handleRemoveAll()}
        onClose={() => setConfirmRemove(false)}
      />
    </>
  );
}
