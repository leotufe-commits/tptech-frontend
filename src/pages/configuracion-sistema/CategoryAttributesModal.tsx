// src/pages/configuracion-sistema/CategoryAttributesModal.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  X,
  ArrowLeft,
  GitBranch,
  Copy,
  Tags,
  Check,
  Star,
  GripVertical,
  Pencil,
  ShieldBan,
  ShieldCheck,
} from "lucide-react";

import { cn } from "../../components/ui/tp";
import { Modal } from "../../components/ui/Modal";
import { TPButton } from "../../components/ui/TPButton";
import TPInput from "../../components/ui/TPInput";
import { TPField } from "../../components/ui/TPField";
import { TPCheckbox } from "../../components/ui/TPCheckbox";
import { TPCard } from "../../components/ui/TPCard";
import ConfirmDeleteDialog from "../../components/ui/ConfirmDeleteDialog";
import { TPSearchInput } from "../../components/ui/TPSearchInput";
import { TPStatusPill } from "../../components/ui/TPStatusPill";
import { TPRowActions } from "../../components/ui/TPRowActions";
import {
  TPTableWrap,
  TPTableHeader,
  TPTableXScroll,
  TPTableElBase,
  TPThead,
  TPTh,
  TPTbody,
  TPTr,
  TPTd,
  TPTableFooter,
} from "../../components/ui/TPTable";

import { SortArrows, type SortDir } from "../../components/ui/TPSort";

import { toast } from "../../lib/toast";
import {
  categoryAttributesApi,
  type CategoryAttribute,
  type AttributeInputType,
  INPUT_TYPE_LABELS,
  INPUT_TYPE_COLOR,
  HAS_OPTIONS,
} from "../../services/category-attributes";
import {
  attributeDefsApi,
  type AttributeDefRow,
} from "../../services/attribute-defs";

/* =========================================================
   TypePill auxiliar
========================================================= */
function TypePill({ inputType }: { inputType: AttributeInputType }) {
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
   Props
========================================================= */
interface Props {
  open: boolean;
  categoryId: string;
  categoryName: string;
  onClose: () => void;
  onAttributesChanged?: () => void;
}

const EMPTY_DRAFT = {
  name: "",
  inputType: "SELECT" as AttributeInputType,
  unit: "",
  isRequired: false,
  isFilterable: true,
  isVariantAxis: false,
  inheritToChild: true,
  isActive: true,
};

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
  const [loading, setLoading] = useState(false);

  /* --- Biblioteca --------------------------------------- */
  const [library, setLibrary] = useState<AttributeDefRow[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryQ, setLibraryQ] = useState("");

  /* --- Navegación --------------------------------------- */
  const [view, setView] = useState<"list" | "form">("list");
  const [formMode, setFormMode] = useState<"new" | "existing">("new");
  const [formTarget, setFormTarget] = useState<CategoryAttribute | null>(null);
  /** IDs de las defs seleccionadas en modo "Usar existente" (multi-selección) */
  const [selectedDefIds, setSelectedDefIds] = useState<Set<string>>(new Set());

  /* --- Lista -------------------------------------------- */
  const [listQ, setListQ] = useState("");
  const [sortKey, setSortKey] = useState<"name" | "inputType" | "isActive">("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [busyAttrId, setBusyAttrId] = useState<string | null>(null);
  const [deleteAttr, setDeleteAttr] = useState<CategoryAttribute | null>(null);

  /* --- Formulario --------------------------------------- */
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT });
  const [submitted, setSubmitted] = useState(false);
  const [busySave, setBusySave] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  /* --- Opciones pendientes (modo Nuevo) ----------------- */
  const [pendingOptions, setPendingOptions] = useState<
    { label: string; colorHex: string; isActive: boolean }[]
  >([]);
  const [favOptIdx, setFavOptIdx] = useState<number | null>(null);
  const [editingOptIdx, setEditingOptIdx] = useState<number | null>(null);
  const [editingOptLabel, setEditingOptLabel] = useState("");
  const [newOptLabel, setNewOptLabel] = useState("");
  const [newOptColor, setNewOptColor] = useState("");
  const newOptRef = useRef<HTMLInputElement>(null);
  const dragIdx = useRef<number>(-1);
  const [dragOver, setDragOver] = useState<number>(-1);


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
      // Silencioso — el picker mostrará vacío
    } finally {
      setLibraryLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      setView("list");
      setFormTarget(null);
      setSelectedDefIds(new Set());
      setListQ("");
      setDeleteAttr(null);
      loadAttrs();
      loadLibrary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (view === "form" && formMode === "new") {
      const t = window.setTimeout(() => nameRef.current?.focus(), 50);
      return () => window.clearTimeout(t);
    }
  }, [view, formMode]);

  /* =========================================================
     Computed
  ========================================================= */
  const isEditMode = !!formTarget;
  const isAssignMode = formMode === "existing" && !isEditMode;
  const isColorDraft = draft.inputType === "COLOR";

  const filteredLibrary = libraryQ.trim()
    ? library.filter((d) => {
        const q = libraryQ.toLowerCase();
        return (
          d.name.toLowerCase().includes(q) ||
          d.code.toLowerCase().includes(q) ||
          INPUT_TYPE_LABELS[d.inputType].toLowerCase().includes(q)
        );
      })
    : library;

  /* =========================================================
     Navegación
  ========================================================= */
  function openCreate() {
    setFormTarget(null);
    setSelectedDefIds(new Set());
    setFormMode("new");
    setDraft({ ...EMPTY_DRAFT });
    setPendingOptions([]);
    setFavOptIdx(null);
    setEditingOptIdx(null);
    setEditingOptLabel("");
    setNewOptLabel("");
    setNewOptColor("");
    setLibraryQ("");
    setSubmitted(false);
    setView("form");
  }

  function openEdit(attr: CategoryAttribute) {
    setFormTarget(attr);
    setSelectedDefIds(new Set());
    setDraft({
      name: attr.name,
      inputType: attr.inputType,
      unit: attr.unit,
      isRequired: attr.isRequired,
      isFilterable: attr.isFilterable,
      isVariantAxis: attr.isVariantAxis,
      inheritToChild: attr.inheritToChild,
      isActive: attr.isActive,
    });
    setSubmitted(false);
    setView("form");
  }

  function overrideInherited(attr: CategoryAttribute) {
    // Construye pseudo-def desde los campos aplanados del CategoryAttribute
    setFormTarget(null);
    setSelectedDefIds(new Set([attr.definitionId]));
    setFormMode("existing");
    setDraft({
      ...EMPTY_DRAFT,
      isRequired: attr.isRequired,
      isFilterable: attr.isFilterable,
      isVariantAxis: attr.isVariantAxis,
      inheritToChild: attr.inheritToChild,
    });
    setLibraryQ("");
    setSubmitted(false);
    setView("form");
  }

  function goBack() {
    setView("list");
    setFormTarget(null);
    setSelectedDefIds(new Set());
    setPendingOptions([]);
    setFavOptIdx(null);
    setEditingOptIdx(null);
    setEditingOptLabel("");
    setNewOptLabel("");
    setNewOptColor("");
    setSubmitted(false);
  }

  function switchFormMode(mode: "new" | "existing") {
    setFormMode(mode);
    setSelectedDefIds(new Set());
    setDraft({ ...EMPTY_DRAFT });
    setPendingOptions([]);
    setFavOptIdx(null);
    setEditingOptIdx(null);
    setEditingOptLabel("");
    setNewOptLabel("");
    setNewOptColor("");
    setLibraryQ("");
    setSubmitted(false);
  }

  /* =========================================================
     Guardar
  ========================================================= */
  async function handleSave() {
    setSubmitted(true);

    try {
      setBusySave(true);

      if (isEditMode && formTarget) {
        /* ---- Editar asignación existente ---- */
        await categoryAttributesApi.update(formTarget.id, {
          isRequired: draft.isRequired,
          isFilterable: draft.isFilterable,
          isVariantAxis: draft.isVariantAxis,
          inheritToChild: draft.inheritToChild,
        });
        if (draft.isActive !== formTarget.isActive) {
          await categoryAttributesApi.toggle(formTarget.id);
        }
        toast.success("Asignación actualizada.");
        await loadAttrs();
        goBack();
        return;
      }

      if (isAssignMode) {
        /* ---- Asignar una o varias definiciones existentes ---- */
        if (selectedDefIds.size === 0) {
          setBusySave(false);
          return;
        }

        const defsToAssign = library.filter((d) => selectedDefIds.has(d.id));
        let successCount = 0;
        let errorCount = 0;

        for (const def of defsToAssign) {
          try {
            await categoryAttributesApi.create(categoryId, {
              definitionId: def.id,
              isRequired: draft.isRequired,
              isFilterable: draft.isFilterable,
              isVariantAxis: draft.isVariantAxis,
              inheritToChild: draft.inheritToChild,
            });
            successCount++;
          } catch {
            errorCount++;
          }
        }

        if (errorCount > 0 && successCount === 0) {
          toast.error("No se pudo asignar ningún atributo.");
        } else if (errorCount > 0) {
          toast.error(`${successCount} atributo(s) asignado(s), ${errorCount} falló.`);
        } else {
          toast.success(
            successCount === 1
              ? "Atributo asignado."
              : `${successCount} atributos asignados.`
          );
        }
        await loadAttrs();
        onAttributesChanged?.();
        goBack();
        return;
      }

      /* ---- Crear nueva definición + asignación ---- */
      if (!draft.name.trim()) {
        setBusySave(false);
        return;
      }

      // Advertir si ya existe un atributo con ese nombre en la biblioteca
      const nameNorm = draft.name.trim().toLowerCase();
      const duplicate = library.find((d) => d.name.toLowerCase() === nameNorm);
      if (duplicate) {
        toast.error(
          `Ya existe un atributo llamado "${duplicate.name}" en la biblioteca. Usá la pestaña "Usar existente" para asignarlo.`
        );
        setBusySave(false);
        return;
      }

      const created = await categoryAttributesApi.create(categoryId, {
        name: draft.name.trim(),
        inputType: draft.inputType,
        unit: draft.unit.trim(),
        isRequired: draft.isRequired,
        isFilterable: draft.isFilterable,
        isVariantAxis: draft.isVariantAxis,
        inheritToChild: draft.inheritToChild,
      });

      if (pendingOptions.length > 0) {
        const results = await Promise.allSettled(
          pendingOptions.map((opt) =>
            categoryAttributesApi.createOption(created.id, {
              label: opt.label,
              value: opt.label,
              colorHex: opt.colorHex,
            })
          )
        );
        const failed = results.filter((r) => r.status === "rejected").length;
        if (failed > 0) {
          toast.error(`Atributo creado, pero ${failed} opción(es) no se pudieron guardar.`);
        } else {
          toast.success("Atributo creado con opciones.");
        }
      } else {
        toast.success("Atributo creado.");
      }

      await loadAttrs();
      onAttributesChanged?.();
      goBack();
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar.");
    } finally {
      setBusySave(false);
    }
  }

  /* =========================================================
     Acciones lista
  ========================================================= */
  async function handleToggle(attr: CategoryAttribute) {
    try {
      setBusyAttrId(attr.id);
      await categoryAttributesApi.toggle(attr.id);
      await loadAttrs();
    } catch (e: any) {
      toast.error(e?.message || "Error.");
    } finally {
      setBusyAttrId(null);
    }
  }

  async function handleDelete() {
    if (!deleteAttr) return;
    try {
      setBusyAttrId(deleteAttr.id);
      await categoryAttributesApi.remove(deleteAttr.id);
      toast.success("Atributo desasignado.");
      setDeleteAttr(null);
      await loadAttrs();
      onAttributesChanged?.();
    } catch (e: any) {
      toast.error(e?.message || "Error al desasignar.");
    } finally {
      setBusyAttrId(null);
    }
  }

  /* =========================================================
     Opciones pendientes (modo Nuevo)
  ========================================================= */
  function handleAddPendingOption() {
    const label = newOptLabel.trim();
    if (!label) return;
    setPendingOptions((prev) => [
      ...prev,
      { label, colorHex: isColorDraft ? newOptColor.trim() : "", isActive: true },
    ]);
    setNewOptLabel("");
    setNewOptColor("");
    setTimeout(() => newOptRef.current?.focus(), 0);
  }

  function handleRemovePendingOption(idx: number) {
    if (favOptIdx === idx) setFavOptIdx(null);
    else if (favOptIdx !== null && favOptIdx > idx) setFavOptIdx(favOptIdx - 1);
    setPendingOptions((prev) => prev.filter((_, i) => i !== idx));
  }

  function confirmEditOpt(idx: number) {
    const label = editingOptLabel.trim();
    if (label) {
      setPendingOptions((prev) =>
        prev.map((o, i) => (i === idx ? { ...o, label } : o))
      );
    }
    setEditingOptIdx(null);
    setEditingOptLabel("");
  }

  function cancelEditOpt() {
    setEditingOptIdx(null);
    setEditingOptLabel("");
  }

  /* =========================================================
     Render — Card Definición
  ========================================================= */
  function renderDefinitionCard() {
    /* EDIT: readonly */
    if (isEditMode && formTarget) {
      return (
        <TPCard title="Definición del atributo">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                INPUT_TYPE_COLOR[formTarget.inputType]
              )}
            >
              {INPUT_TYPE_LABELS[formTarget.inputType]}
            </span>
            <span className="text-sm font-medium text-text">{formTarget.name}</span>
          </div>
          <p className="text-xs text-muted mt-2">
            Para cambiar la definición global usá la{" "}
            <strong>Biblioteca de atributos</strong>.
          </p>
        </TPCard>
      );
    }

    /* NUEVO: form editable + opciones */
    if (!isAssignMode) {
      return (
        <>
          <TPCard title="Identificación">
            <TPField
              label="Nombre"
              required
              error={
                submitted && !draft.name.trim()
                  ? "El nombre es obligatorio."
                  : null
              }
            >
              <TPInput
                inputRef={nameRef}
                value={draft.name}
                onChange={(v) => setDraft((p) => ({ ...p, name: v }))}
                placeholder="Ej: Material"
                disabled={busySave}
              />
            </TPField>
          </TPCard>

          <TPCard title="Opciones">
            <div className="space-y-3">
              {/* Input agregar */}
              <div className="flex items-center gap-2">
                {isColorDraft && (
                  <input
                    type="color"
                    value={newOptColor || "#000000"}
                    onChange={(e) => setNewOptColor(e.target.value)}
                    className="h-9 w-9 rounded-lg cursor-pointer border border-border shrink-0"
                    title="Color"
                  />
                )}
                <TPInput
                  inputRef={newOptRef}
                  value={newOptLabel}
                  onChange={setNewOptLabel}
                  wrapClassName="flex-1"
                  placeholder={isColorDraft ? "Nombre del color…" : "Nueva opción…"}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddPendingOption();
                    }
                  }}
                />
                <button
                  type="button"
                  title="Agregar opción"
                  onClick={handleAddPendingOption}
                  disabled={!newOptLabel.trim()}
                  className="tp-btn-primary h-9 px-3 flex items-center gap-1.5 shrink-0 disabled:opacity-50 text-sm font-medium"
                >
                  <Plus size={15} />
                </button>
              </div>

              {/* Lista */}
              {pendingOptions.length > 0 ? (
                <div className="rounded-xl border border-border overflow-hidden">
                  {pendingOptions.map((opt, idx) => (
                    <div
                      key={idx}
                      draggable
                      onDragStart={() => { dragIdx.current = idx; }}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(idx); }}
                      onDragLeave={() => setDragOver(-1)}
                      onDrop={() => {
                        const fromIdx = dragIdx.current;
                        if (fromIdx === -1 || fromIdx === idx) { setDragOver(-1); return; }
                        setPendingOptions((prev) => {
                          const next = [...prev];
                          const [moved] = next.splice(fromIdx, 1);
                          next.splice(idx, 0, moved);
                          if (favOptIdx !== null) {
                            if (favOptIdx === fromIdx) setFavOptIdx(idx);
                            else if (fromIdx < favOptIdx && idx >= favOptIdx) setFavOptIdx(favOptIdx - 1);
                            else if (fromIdx > favOptIdx && idx <= favOptIdx) setFavOptIdx(favOptIdx + 1);
                          }
                          return next;
                        });
                        dragIdx.current = -1;
                        setDragOver(-1);
                      }}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2.5 text-sm border-b border-border last:border-b-0 transition-colors",
                        !opt.isActive && "opacity-50",
                        dragOver === idx && "bg-primary/10"
                      )}
                    >
                      {/* Drag handle */}
                      <GripVertical size={14} className="shrink-0 text-muted cursor-grab active:cursor-grabbing" />

                      {isColorDraft && opt.colorHex && (
                        <span
                          className="h-4 w-4 rounded-full shrink-0 border border-border"
                          style={{ backgroundColor: opt.colorHex }}
                        />
                      )}

                      {/* Label o input inline */}
                      {editingOptIdx === idx ? (
                        <input
                          type="text"
                          value={editingOptLabel}
                          onChange={(e) => setEditingOptLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); confirmEditOpt(idx); }
                            if (e.key === "Escape") cancelEditOpt();
                          }}
                          onBlur={() => confirmEditOpt(idx)}
                          autoFocus
                          className="flex-1 rounded-lg border border-primary bg-transparent px-2 py-0.5 text-sm text-text outline-none"
                        />
                      ) : (
                        <span className="flex-1 text-text truncate">{opt.label}</span>
                      )}

                      {/* Star (favorita) */}
                      <button
                        type="button"
                        title={favOptIdx === idx ? "Quitar favorita" : "Marcar como favorita"}
                        onClick={() => setFavOptIdx(favOptIdx === idx ? null : idx)}
                        className="shrink-0 transition-colors"
                      >
                        <Star
                          size={14}
                          className={
                            favOptIdx === idx
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted hover:text-yellow-400"
                          }
                        />
                      </button>

                      {/* Editar / Confirmar edición */}
                      {editingOptIdx === idx ? (
                        <button
                          type="button"
                          title="Confirmar"
                          onClick={() => confirmEditOpt(idx)}
                          className="shrink-0 text-primary"
                        >
                          <Check size={13} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          title="Editar"
                          onClick={() => { setEditingOptIdx(idx); setEditingOptLabel(opt.label); }}
                          className="shrink-0 text-muted hover:text-text transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                      )}

                      {/* Toggle activo/inactivo */}
                      <button
                        type="button"
                        title={opt.isActive ? "Desactivar opción" : "Activar opción"}
                        onClick={() =>
                          setPendingOptions((prev) =>
                            prev.map((o, i) => i === idx ? { ...o, isActive: !o.isActive } : o)
                          )
                        }
                        className="shrink-0 text-muted hover:text-text transition-colors"
                      >
                        {opt.isActive ? <ShieldBan size={13} /> : <ShieldCheck size={13} />}
                      </button>

                      {/* Eliminar */}
                      <button
                        type="button"
                        title="Eliminar"
                        onClick={() => handleRemovePendingOption(idx)}
                        className="shrink-0 text-muted hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-xs text-muted py-3 italic">
                  Sin opciones todavía. Agregá la primera.
                </p>
              )}
            </div>
          </TPCard>
        </>
      );
    }

    /* EXISTENTE: picker multi-selección */
    return (
      <TPCard title="Seleccioná atributos a asignar">
        <div className="space-y-3">
          <TPSearchInput
            value={libraryQ}
            onChange={setLibraryQ}
            placeholder="Buscar por nombre, código o tipo…"
            className="h-9"
          />

          {libraryLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted" />
            </div>
          ) : library.length === 0 ? (
            <p className="text-center text-sm text-muted py-6">
              No hay atributos en la biblioteca.
            </p>
          ) : filteredLibrary.length === 0 ? (
            <p className="text-center text-sm text-muted py-6">Sin resultados.</p>
          ) : (
            <div className="max-h-56 overflow-y-auto rounded-xl border border-border divide-y divide-border">
              {filteredLibrary.map((def) => {
                const alreadyAssigned = ownAttrs.some((a) => a.definitionId === def.id);
                const isSelected = selectedDefIds.has(def.id);

                return (
                  <label
                    key={def.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 transition-colors",
                      alreadyAssigned
                        ? "opacity-50 cursor-not-allowed"
                        : "cursor-pointer hover:bg-primary/5"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={alreadyAssigned}
                      onChange={() => {
                        if (alreadyAssigned) return;
                        setSelectedDefIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(def.id)) next.delete(def.id);
                          else next.add(def.id);
                          return next;
                        });
                      }}
                      className="h-4 w-4 rounded border-border accent-primary shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            "shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                            INPUT_TYPE_COLOR[def.inputType]
                          )}
                        >
                          {INPUT_TYPE_LABELS[def.inputType]}
                        </span>
                        <span className="text-sm font-medium text-text">{def.name}</span>
                        {def.options.length > 0 && (
                          <span className="text-xs text-muted">
                            {def.options.length} opción{def.options.length !== 1 ? "es" : ""}
                          </span>
                        )}
                      </div>
                      {alreadyAssigned && (
                        <p className="text-xs text-muted italic mt-0.5">Ya asignado en esta categoría</p>
                      )}
                    </div>

                    {isSelected && !alreadyAssigned && (
                      <Check size={15} className="text-green-500 shrink-0" />
                    )}
                  </label>
                );
              })}
            </div>
          )}

          {selectedDefIds.size > 0 && (
            <p className="text-xs text-muted">
              {selectedDefIds.size} atributo{selectedDefIds.size !== 1 ? "s" : ""} seleccionado{selectedDefIds.size !== 1 ? "s" : ""}.
            </p>
          )}

          {submitted && selectedDefIds.size === 0 && (
            <p className="text-xs text-red-500">
              Seleccioná al menos un atributo de la biblioteca.
            </p>
          )}
        </div>
      </TPCard>
    );
  }

  /* =========================================================
     Render — Card Configuración
  ========================================================= */
  const configCard = (
    <TPCard title={`Configuración en "${categoryName}"`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TPCheckbox
          checked={draft.isRequired}
          onChange={(v) => setDraft((p) => ({ ...p, isRequired: v }))}
          disabled={busySave}
          label={
            <span className="text-sm">
              <span className="font-medium">Obligatorio</span>
              <span className="text-muted block text-xs">
                El usuario debe completarlo
              </span>
            </span>
          }
        />
        <TPCheckbox
          checked={draft.isFilterable}
          onChange={(v) => setDraft((p) => ({ ...p, isFilterable: v }))}
          disabled={busySave}
          label={
            <span className="text-sm">
              <span className="font-medium">Filtrable</span>
              <span className="text-muted block text-xs">
                Aparece en filtros de búsqueda
              </span>
            </span>
          }
        />
        <TPCheckbox
          checked={draft.isVariantAxis}
          onChange={(v) => setDraft((p) => ({ ...p, isVariantAxis: v }))}
          disabled={busySave}
          label={
            <span className="text-sm">
              <span className="font-medium">Eje de variante</span>
              <span className="text-muted block text-xs">
                Define variantes del artículo
              </span>
            </span>
          }
        />
        <TPCheckbox
          checked={draft.inheritToChild}
          onChange={(v) => setDraft((p) => ({ ...p, inheritToChild: v }))}
          disabled={busySave}
          label={
            <span className="text-sm">
              <span className="font-medium">Heredar a subcategorías</span>
              <span className="text-muted block text-xs">
                Las categorías hijas lo reciben
              </span>
            </span>
          }
        />
        {isEditMode && (
          <TPCheckbox
            checked={draft.isActive}
            onChange={(v) => setDraft((p) => ({ ...p, isActive: v }))}
            disabled={busySave}
            label={
              <span className="text-sm">
                <span className="font-medium">Activo en esta categoría</span>
                <span className="text-muted block text-xs">
                  Desactivar oculta el atributo sin eliminarlo
                </span>
              </span>
            }
          />
        )}
      </div>
    </TPCard>
  );

  /* =========================================================
     Vista formulario
  ========================================================= */
  const formView = (
    <div className="space-y-4">
      {/* Toggle modo (solo al crear) */}
      {!isEditMode && (
        <div className="flex rounded-xl border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => switchFormMode("new")}
            className={cn(
              "flex-1 py-2.5 text-sm font-medium transition-colors",
              formMode === "new"
                ? "bg-primary text-white"
                : "text-muted hover:text-text bg-transparent"
            )}
          >
            Nuevo atributo
          </button>
          <button
            type="button"
            onClick={() => switchFormMode("existing")}
            className={cn(
              "flex-1 py-2.5 text-sm font-medium transition-colors",
              formMode === "existing"
                ? "bg-primary text-white"
                : "text-muted hover:text-text bg-transparent"
            )}
          >
            Usar existente
          </button>
        </div>
      )}

      {renderDefinitionCard()}
      {configCard}
    </div>
  );

  /* =========================================================
     Vista lista — tabla
  ========================================================= */
  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  function sortAttrs(list: CategoryAttribute[]) {
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name")     cmp = a.name.localeCompare(b.name, "es");
      if (sortKey === "inputType") cmp = INPUT_TYPE_LABELS[a.inputType].localeCompare(INPUT_TYPE_LABELS[b.inputType], "es");
      if (sortKey === "isActive") cmp = Number(b.isActive) - Number(a.isActive);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }

  const filteredOwn = sortAttrs(
    listQ.trim()
      ? ownAttrs.filter((a) => a.name.toLowerCase().includes(listQ.toLowerCase()))
      : ownAttrs
  );
  const filteredInherited = sortAttrs(
    listQ.trim()
      ? inheritedAttrs.filter((a) => a.name.toLowerCase().includes(listQ.toLowerCase()))
      : inheritedAttrs
  );

  const listView = (
    <TPTableWrap>
      <TPTableHeader
        left={
          <TPSearchInput
            value={listQ}
            onChange={setListQ}
            placeholder="Buscar atributo…"
            className="h-9 w-full md:w-64"
          />
        }
      />
      <TPTableXScroll>
        <TPTableElBase>
          <TPThead>
            <tr>
              <TPTh>
                <button type="button" className="flex items-center gap-1" onClick={() => toggleSort("name")}>
                  Nombre <SortArrows dir={sortDir} active={sortKey === "name"} />
                </button>
              </TPTh>
              <TPTh className="hidden sm:table-cell">
                <button type="button" className="flex items-center gap-1" onClick={() => toggleSort("inputType")}>
                  Tipo <SortArrows dir={sortDir} active={sortKey === "inputType"} />
                </button>
              </TPTh>
              <TPTh className="hidden md:table-cell">Configuración</TPTh>
              <TPTh className="hidden sm:table-cell">
                <button type="button" className="flex items-center gap-1" onClick={() => toggleSort("isActive")}>
                  Estado <SortArrows dir={sortDir} active={sortKey === "isActive"} />
                </button>
              </TPTh>
              <TPTh className="text-right">Acciones</TPTh>
            </tr>
          </TPThead>
          <TPTbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted mx-auto" />
                </td>
              </tr>
            ) : ownAttrs.length === 0 && inheritedAttrs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted">
                  Esta categoría no tiene atributos todavía.
                  <div className="mt-3">
                    <TPButton variant="linkPrimary" onClick={openCreate}>
                      Crear el primer atributo
                    </TPButton>
                  </div>
                </td>
              </tr>
            ) : (
              <>
                {/* Sección: propios */}
                <tr>
                  <td colSpan={5} className="px-5 py-2 bg-surface2/50">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Asignados ({ownAttrs.length})
                    </span>
                  </td>
                </tr>
                {filteredOwn.length === 0 && listQ ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-4 text-center text-sm text-muted">
                      Sin resultados.
                    </td>
                  </tr>
                ) : (
                  filteredOwn.map((attr) => (
                    <TPTr key={attr.id} className={cn(!attr.isActive && "opacity-60")}>
                      <TPTd>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-text">{attr.name}</span>
                          {HAS_OPTIONS.includes(attr.inputType) && attr.options.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-surface2 px-2 py-0.5 text-xs text-muted">
                              <Tags size={10} />
                              {attr.options.length}
                            </span>
                          )}
                        </div>
                      </TPTd>
                      <TPTd className="hidden sm:table-cell">
                        <TypePill inputType={attr.inputType} />
                      </TPTd>
                      <TPTd className="hidden md:table-cell">
                        <div className="flex items-center gap-1 flex-wrap">
                          {attr.isRequired && <Chip label="Obligatorio" color="orange" />}
                          {attr.isFilterable && <Chip label="Filtrable" color="blue" />}
                          {attr.isVariantAxis && <Chip label="Variante" color="purple" />}
                          {attr.inheritToChild && <Chip label="Hereda" color="gray" />}
                        </div>
                      </TPTd>
                      <TPTd className="hidden sm:table-cell">
                        <TPStatusPill active={attr.isActive} activeLabel="Activo" inactiveLabel="Inactivo" />
                      </TPTd>
                      <TPTd>
                        <TPRowActions
                          className="flex-nowrap"
                          onEdit={() => openEdit(attr)}
                          onToggle={busyAttrId === attr.id ? undefined : () => void handleToggle(attr)}
                          isActive={attr.isActive}
                          onDelete={() => setDeleteAttr(attr)}
                        />
                      </TPTd>
                    </TPTr>
                  ))
                )}

                {/* Sección: heredados */}
                {inheritedAttrs.length > 0 && (
                  <>
                    <tr>
                      <td colSpan={5} className="px-5 py-2 bg-surface2/50">
                        <div className="flex items-center gap-1.5">
                          <GitBranch size={12} className="text-muted" />
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                            Heredados del padre ({inheritedAttrs.length})
                          </span>
                        </div>
                      </td>
                    </tr>
                    {filteredInherited.length === 0 && listQ ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-4 text-center text-sm text-muted">
                          Sin resultados.
                        </td>
                      </tr>
                    ) : (
                      filteredInherited.map((attr) => (
                        <TPTr key={attr.id} className="opacity-75">
                          <TPTd>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-text">{attr.name}</span>
                              {attr.sourceCategoryName && (
                                <span className="text-xs text-muted italic">
                                  — {attr.sourceCategoryName}
                                </span>
                              )}
                            </div>
                          </TPTd>
                          <TPTd className="hidden sm:table-cell">
                            <TypePill inputType={attr.inputType} />
                          </TPTd>
                          <TPTd className="hidden md:table-cell">
                            <div className="flex items-center gap-1 flex-wrap">
                              {attr.isRequired && <Chip label="Obligatorio" color="orange" />}
                              {attr.isFilterable && <Chip label="Filtrable" color="blue" />}
                              {attr.isVariantAxis && <Chip label="Variante" color="purple" />}
                            </div>
                          </TPTd>
                          <TPTd className="hidden sm:table-cell">
                            <span className="text-xs text-muted italic">Heredado</span>
                          </TPTd>
                          <TPTd>
                            <div className="flex justify-end">
                              <TPButton
                                variant="secondary"
                                onClick={() => overrideInherited(attr)}
                                iconLeft={<Copy size={13} />}
                                className="text-xs h-8 px-2.5"
                              >
                                <span className="hidden sm:inline">Asignar aquí</span>
                              </TPButton>
                            </div>
                          </TPTd>
                        </TPTr>
                      ))
                    )}
                  </>
                )}
              </>
            )}
          </TPTbody>
        </TPTableElBase>
      </TPTableXScroll>
      <TPTableFooter>
        {ownAttrs.length} propio{ownAttrs.length !== 1 ? "s" : ""}
        {inheritedAttrs.length > 0 &&
          `, ${inheritedAttrs.length} heredado${inheritedAttrs.length !== 1 ? "s" : ""}`}
      </TPTableFooter>
    </TPTableWrap>
  );

  /* =========================================================
     Footer
  ========================================================= */
  const modalTitle =
    view === "form"
      ? isEditMode
        ? `Editar: ${formTarget?.name}`
        : "Agregar atributo"
      : `Atributos de "${categoryName}"`;

  const modalFooter =
    view === "list" ? (
      <>
        <TPButton variant="secondary" onClick={onClose} iconLeft={<X size={16} />}>
          Cerrar
        </TPButton>
        <TPButton
          variant="primary"
          onClick={openCreate}
          iconLeft={<Plus size={15} />}
        >
          Agregar atributo
        </TPButton>
      </>
    ) : (
      <>
        <TPButton
          variant="secondary"
          onClick={goBack}
          disabled={busySave}
          iconLeft={<ArrowLeft size={15} />}
        >
          Volver
        </TPButton>
        <TPButton variant="primary" onClick={handleSave} loading={busySave}>
          {isEditMode
            ? "Guardar cambios"
            : isAssignMode
            ? selectedDefIds.size > 1
              ? `Asignar ${selectedDefIds.size} atributos`
              : "Asignar atributo"
            : "Crear atributo"}
        </TPButton>
      </>
    );

  return (
    <>
      <Modal
        open={open}
        title={modalTitle}
        maxWidth="4xl"
        busy={busySave}
        onClose={() => {
          if (view === "form" && !busySave) goBack();
          else onClose();
        }}
        footer={modalFooter}
      >
        {view === "list" ? listView : formView}
      </Modal>

      <ConfirmDeleteDialog
        open={deleteAttr !== null}
        title={`Desasignar "${deleteAttr?.name ?? ""}"`}
        description="El atributo se desasignará de esta categoría. La definición global no se elimina."
        confirmText="Desasignar"
        busy={busyAttrId === deleteAttr?.id}
        onClose={() => setDeleteAttr(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}

/* =========================================================
   Sub-componente: Chip
========================================================= */
function Chip({
  label,
  color,
}: {
  label: string;
  color: "orange" | "blue" | "purple" | "gray";
}) {
  const cls = {
    orange: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    blue: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    purple: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
    gray: "bg-surface2 text-muted",
  }[color];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        cls
      )}
    >
      {label}
    </span>
  );
}
