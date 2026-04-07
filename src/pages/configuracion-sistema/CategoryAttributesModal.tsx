// src/pages/configuracion-sistema/CategoryAttributesModal.tsx
import React, { useEffect, useState } from "react";
import {
  Loader2,
  X,
  Plus,
  Tags,
  GitBranch,
  PlusCircle,
  GripVertical,
} from "lucide-react";

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
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";

import { cn } from "../../components/ui/tp";
import { Modal } from "../../components/ui/Modal";
import { TPButton } from "../../components/ui/TPButton";
import { TPCard } from "../../components/ui/TPCard";
import ConfirmDeleteDialog from "../../components/ui/ConfirmDeleteDialog";
import { TPSearchInput } from "../../components/ui/TPSearchInput";

import { toast } from "../../lib/toast";
import {
  categoryAttributesApi,
  type CategoryAttribute,
  INPUT_TYPE_LABELS,
  INPUT_TYPE_COLOR,
} from "../../services/category-attributes";
import {
  attributeDefsApi,
  type AttributeDefRow,
} from "../../services/attribute-defs";

/* =========================================================
   TypePill auxiliar
========================================================= */
function TypePill({ inputType }: { inputType: CategoryAttribute["inputType"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0",
        INPUT_TYPE_COLOR[inputType]
      )}
    >
      {INPUT_TYPE_LABELS[inputType]}
    </span>
  );
}

/* =========================================================
   SortableAttrRow — fila arrastrable (solo atributos directos)
========================================================= */
interface SortableAttrRowProps {
  attr: CategoryAttribute;
  busyRemoveId: string | null;
  onRemoveClick: (attr: CategoryAttribute) => void;
}

function SortableAttrRow({ attr, busyRemoveId, onRemoveClick }: SortableAttrRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: attr.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    position: "relative",
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-2.5 bg-card"
    >
      {/* Handle de drag */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted/40 hover:text-muted shrink-0 touch-none select-none"
        aria-label="Arrastrar para reordenar"
        title="Arrastrar para reordenar"
      >
        <GripVertical size={14} />
      </button>

      {/* Datos del atributo */}
      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        <TypePill inputType={attr.inputType} />
        <span className="text-sm font-medium text-text truncate">{attr.name}</span>
        {attr.options && attr.options.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface2 px-2 py-0.5 text-xs text-muted">
            <Tags size={10} />
            {attr.options.length}
          </span>
        )}
      </div>

      {/* Badge Directo */}
      <span className="inline-flex items-center shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
        Directo
      </span>

      {/* Botón Quitar */}
      <TPButton
        variant="ghost"
        iconLeft={
          busyRemoveId === attr.id ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <X size={13} />
          )
        }
        onClick={() => onRemoveClick(attr)}
        disabled={busyRemoveId === attr.id}
        className="h-8 px-2.5 text-xs text-muted hover:text-red-400 shrink-0"
        title="Quitar asignación directa"
      >
        Quitar
      </TPButton>
    </div>
  );
}

/* =========================================================
   Props
========================================================= */
interface Props {
  open: boolean;
  categoryId: string;
  categoryName: string;
  onClose: () => void;
  onAttributesChanged?: () => void;
}

/* =========================================================
   Componente principal
========================================================= */
export function CategoryAttributesModal({
  open,
  categoryId,
  categoryName,
  onClose,
  onAttributesChanged,
}: Props) {
  /* --- Datos -------------------------------------------- */
  const [ownAttrs, setOwnAttrs] = useState<CategoryAttribute[]>([]);
  const [inheritedAttrs, setInheritedAttrs] = useState<CategoryAttribute[]>([]);
  const [library, setLibrary] = useState<AttributeDefRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);

  /* --- Búsqueda ----------------------------------------- */
  const [assignedQ, setAssignedQ] = useState("");
  const [availableQ, setAvailableQ] = useState("");

  /* --- Acciones ----------------------------------------- */
  const [busyAssignId, setBusyAssignId] = useState<string | null>(null); // def.id
  const [busyRemoveId, setBusyRemoveId] = useState<string | null>(null); // attr.id
  const [deleteAttr, setDeleteAttr] = useState<CategoryAttribute | null>(null);
  const [reordering, setReordering] = useState(false);

  /* --- DnD sensors -------------------------------------- */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  /* =========================================================
     Carga
  ========================================================= */
  async function loadAttrs() {
    if (!categoryId) return;
    try {
      setLoading(true);
      const [own, effective] = await Promise.all([
        categoryAttributesApi.list(categoryId),
        categoryAttributesApi.effectiveList(categoryId),
      ]);
      setOwnAttrs(own);
      setInheritedAttrs(effective.filter((a) => a.inherited));
    } catch (e: any) {
      toast.error(e?.message || "Error al cargar atributos.");
    } finally {
      setLoading(false);
    }
  }

  async function loadLibrary() {
    try {
      setLibraryLoading(true);
      const data = await attributeDefsApi.list();
      setLibrary(data.filter((d) => d.isActive));
    } catch {
      // Silencioso
    } finally {
      setLibraryLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      setAssignedQ("");
      setAvailableQ("");
      setDeleteAttr(null);
      loadAttrs();
      loadLibrary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* =========================================================
     Drag & Drop — reordenamiento de atributos directos
  ========================================================= */
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = ownAttrs.findIndex((a) => a.id === active.id);
    const newIndex = ownAttrs.findIndex((a) => a.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(ownAttrs, oldIndex, newIndex);
    // Actualización optimista inmediata
    setOwnAttrs(reordered);

    setReordering(true);
    try {
      await Promise.all(
        reordered.map((attr, idx) =>
          categoryAttributesApi.update(attr.id, { sortOrder: (idx + 1) * 10 })
        )
      );
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar el orden.");
      // Revertir al orden previo
      setOwnAttrs(ownAttrs);
    } finally {
      setReordering(false);
    }
  }

  /* =========================================================
     Computed
  ========================================================= */
  const assignedDefIds = new Set(ownAttrs.map((a) => a.definitionId));
  const inheritedDefIds = new Set(inheritedAttrs.map((a) => a.definitionId));

  // Lista combinada: directos primero, heredados después
  const allAssigned = [
    ...ownAttrs.map((a) => ({ ...a, inherited: false as const })),
    ...inheritedAttrs.map((a) => ({ ...a, inherited: true as const })),
  ];
  const totalAssigned = allAssigned.length;

  const filteredAssigned = assignedQ.trim()
    ? allAssigned.filter((a) => a.name.toLowerCase().includes(assignedQ.toLowerCase()))
    : allAssigned;

  // Disponibles: excluir tanto directos como heredados (evitar duplicidad)
  const available = library.filter(
    (def) => !assignedDefIds.has(def.id) && !inheritedDefIds.has(def.id)
  );

  const filteredAvailable = availableQ.trim()
    ? available.filter((d) =>
        d.name.toLowerCase().includes(availableQ.toLowerCase()) ||
        INPUT_TYPE_LABELS[d.inputType].toLowerCase().includes(availableQ.toLowerCase())
      )
    : available;

  // DnD solo activo cuando no hay búsqueda (no tiene sentido reordenar filtrando)
  const isDndActive = !assignedQ.trim();

  /* =========================================================
     Acciones
  ========================================================= */
  async function handleAssign(def: AttributeDefRow) {
    try {
      setBusyAssignId(def.id);
      await categoryAttributesApi.create(categoryId, {
        definitionId: def.id,
        isRequired: false,
        isFilterable: true,
        isVariantAxis: true,
        inheritToChild: true,
      });
      toast.success(`"${def.name}" asignado.`);
      await loadAttrs();
      onAttributesChanged?.();
    } catch (e: any) {
      toast.error(e?.message || "Error al asignar.");
    } finally {
      setBusyAssignId(null);
    }
  }

  async function handleRemove() {
    if (!deleteAttr) return;
    try {
      setBusyRemoveId(deleteAttr.id);
      await categoryAttributesApi.remove(deleteAttr.id);
      toast.success(`"${deleteAttr.name}" quitado.`);
      setDeleteAttr(null);
      await loadAttrs();
      onAttributesChanged?.();
    } catch (e: any) {
      toast.error(e?.message || "Error al quitar el atributo.");
    } finally {
      setBusyRemoveId(null);
    }
  }

  /* =========================================================
     Render — sección Asignados
  ========================================================= */
  function renderAssigned() {
    return (
      <TPCard title={`Atributos de esta categoría (${totalAssigned})`}>
        {totalAssigned > 4 && (
          <TPSearchInput
            value={assignedQ}
            onChange={setAssignedQ}
            placeholder="Filtrar atributos…"
            className="h-9 mb-3"
          />
        )}

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted" />
          </div>
        ) : totalAssigned === 0 ? (
          <p className="text-center text-sm text-muted py-4 italic">
            Esta categoría no tiene atributos todavía.
          </p>
        ) : filteredAssigned.length === 0 ? (
          <p className="text-center text-sm text-muted py-4">Sin resultados.</p>
        ) : (
          <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
            {isDndActive ? (
              /* ── Modo DnD: directos arrastrables + heredados fijos abajo ── */
              <>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                  modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                >
                  <SortableContext
                    items={ownAttrs.map((a) => a.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {ownAttrs.map((attr) => (
                      <SortableAttrRow
                        key={attr.id}
                        attr={attr}
                        busyRemoveId={busyRemoveId}
                        onRemoveClick={setDeleteAttr}
                      />
                    ))}
                  </SortableContext>
                </DndContext>

                {/* Atributos heredados (no arrastrables) */}
                {inheritedAttrs.map((attr) => (
                  <div
                    key={attr.id}
                    className="flex items-center gap-2 px-3 py-2.5 opacity-80"
                  >
                    {/* Espaciador — alinea con el handle de directos */}
                    <span className="w-[14px] shrink-0" />

                    <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                      <TypePill inputType={attr.inputType} />
                      <span className="text-sm font-medium text-text truncate">{attr.name}</span>
                      {attr.options && attr.options.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface2 px-2 py-0.5 text-xs text-muted">
                          <Tags size={10} />
                          {attr.options.length}
                        </span>
                      )}
                    </div>

                    <span className="inline-flex items-center gap-1 shrink-0 rounded-full bg-surface2 border border-border px-2 py-0.5 text-xs text-muted">
                      <GitBranch size={10} />
                      {attr.sourceCategoryName
                        ? `Heredado de: ${attr.sourceCategoryName}`
                        : "Heredado"}
                    </span>

                    <span
                      className="text-xs text-muted shrink-0 px-2.5"
                      title="Los atributos heredados se administran desde la categoría padre"
                    >
                      —
                    </span>
                  </div>
                ))}
              </>
            ) : (
              /* ── Modo búsqueda: filas planas sin DnD ── */
              filteredAssigned.map((attr) => (
                <div
                  key={attr.id}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5",
                    attr.inherited && "opacity-80"
                  )}
                >
                  <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                    <TypePill inputType={attr.inputType} />
                    <span className="text-sm font-medium text-text truncate">{attr.name}</span>
                    {attr.options && attr.options.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface2 px-2 py-0.5 text-xs text-muted">
                        <Tags size={10} />
                        {attr.options.length}
                      </span>
                    )}
                  </div>

                  {attr.inherited ? (
                    <span className="inline-flex items-center gap-1 shrink-0 rounded-full bg-surface2 border border-border px-2 py-0.5 text-xs text-muted">
                      <GitBranch size={10} />
                      {attr.sourceCategoryName
                        ? `Heredado de: ${attr.sourceCategoryName}`
                        : "Heredado"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Directo
                    </span>
                  )}

                  {!attr.inherited ? (
                    <TPButton
                      variant="ghost"
                      iconLeft={
                        busyRemoveId === attr.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <X size={13} />
                        )
                      }
                      onClick={() => setDeleteAttr(attr)}
                      disabled={busyRemoveId === attr.id}
                      className="h-8 px-2.5 text-xs text-muted hover:text-red-400 shrink-0"
                      title="Quitar asignación directa"
                    >
                      Quitar
                    </TPButton>
                  ) : (
                    <span
                      className="text-xs text-muted shrink-0 px-2.5"
                      title="Los atributos heredados se administran desde la categoría padre"
                    >
                      —
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Indicador de guardado de orden */}
        {reordering && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted">
            <Loader2 size={12} className="animate-spin" />
            Guardando orden…
          </div>
        )}
      </TPCard>
    );
  }

  /* =========================================================
     Render — sección Disponibles
  ========================================================= */
  function renderAvailable() {
    return (
      <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
        {/* Encabezado */}
        <div className="flex items-start gap-2">
          <PlusCircle size={18} className="text-primary shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-text">
              Disponibles para asignar
              {available.length > 0 && (
                <span className="ml-1.5 text-xs font-normal text-muted">({available.length})</span>
              )}
            </div>
            <p className="text-xs text-muted mt-0.5">
              Hacé click en <strong>Asignar</strong> para agregar un atributo a esta categoría.
            </p>
          </div>
        </div>

        {/* Buscador */}
        {available.length > 5 && (
          <TPSearchInput
            value={availableQ}
            onChange={setAvailableQ}
            placeholder="Buscar atributo…"
            className="h-9"
          />
        )}

        {/* Lista */}
        {libraryLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted" />
          </div>
        ) : library.length === 0 ? (
          <p className="text-center text-sm text-muted py-4 italic">
            No hay atributos en la biblioteca.
          </p>
        ) : available.length === 0 ? (
          <p className="text-center text-sm text-muted py-4 italic">
            Todos los atributos ya están asignados a esta categoría.
          </p>
        ) : filteredAvailable.length === 0 ? (
          <p className="text-center text-sm text-muted py-4">Sin resultados.</p>
        ) : (
          <div className="rounded-xl border border-primary/20 bg-surface divide-y divide-border overflow-hidden max-h-72 overflow-y-auto">
            {filteredAvailable.map((def) => (
              <div key={def.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-primary/5 transition-colors">
                <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                  <TypePill inputType={def.inputType} />
                  <span className="text-sm font-medium text-text truncate">{def.name}</span>
                  {def.options.length > 0 && (
                    <span className="text-xs text-muted">
                      {def.options.length} opc.
                    </span>
                  )}
                </div>
                <TPButton
                  variant="primary"
                  iconLeft={
                    busyAssignId === def.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Plus size={13} />
                    )
                  }
                  onClick={() => void handleAssign(def)}
                  disabled={busyAssignId !== null}
                  className="h-8 px-3 text-xs shrink-0"
                  title="Asignar este atributo"
                >
                  Asignar
                </TPButton>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* =========================================================
     Render principal
  ========================================================= */
  return (
    <>
      <Modal
        open={open}
        title={`Atributos de "${categoryName}"`}
        maxWidth="2xl"
        onClose={onClose}
        footer={
          <TPButton variant="secondary" onClick={onClose} iconLeft={<X size={16} />}>
            Cerrar
          </TPButton>
        }
      >
        <div className="space-y-4">
          {renderAssigned()}
          {renderAvailable()}
        </div>
      </Modal>

      <ConfirmDeleteDialog
        open={deleteAttr !== null}
        title={`Quitar "${deleteAttr?.name ?? ""}"`}
        description="Se quitará la asignación de este atributo en esta categoría. La definición global no se elimina."
        confirmText="Quitar"
        busy={busyRemoveId === deleteAttr?.id}
        onClose={() => setDeleteAttr(null)}
        onConfirm={handleRemove}
      />
    </>
  );
}
