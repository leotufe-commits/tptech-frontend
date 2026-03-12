// src/pages/configuracion-sistema/AttributeLibraryModal.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  Plus,
  Loader2,
  ArrowLeft,
  X,
  Check,
  Tags,
  Save,
  Star,
  Pencil,
  Trash2,
  ShieldBan,
  ShieldCheck,
  GripVertical,
} from "lucide-react";

import { cn } from "../../components/ui/tp";
import { Modal } from "../../components/ui/Modal";
import { TPButton } from "../../components/ui/TPButton";
import TPInput from "../../components/ui/TPInput";
import { TPField } from "../../components/ui/TPField";
import { TPCard } from "../../components/ui/TPCard";
import TPComboFixed from "../../components/ui/TPComboFixed";
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
  TPEmptyRow,
  TPTableFooter,
} from "../../components/ui/TPTable";
import { SortArrows, type SortDir } from "../../components/ui/TPSort";

import { toast } from "../../lib/toast";
import {
  attributeDefsApi,
  type AttributeDefRow,
} from "../../services/attribute-defs";
import {
  INPUT_TYPE_LABELS,
  INPUT_TYPE_OPTIONS,
  INPUT_TYPE_COLOR,
  HAS_OPTIONS,
  type AttributeInputType,
} from "../../services/category-attributes";

/* =========================================================
   Props
========================================================= */
interface Props {
  open: boolean;
  onClose: () => void;
}

type View = "list" | "form";
type DraftInputType = AttributeInputType | "";

const EMPTY_DRAFT = {
  name: "",
  inputType: "SELECT" as DraftInputType,
  unit: "",
  defaultValue: "",
};

/* =========================================================
   Tipo pill auxiliar
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
   Componente principal
========================================================= */
export function AttributeLibraryModal({ open, onClose }: Props) {
  const [defs, setDefs] = useState<AttributeDefRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  const [view, setView] = useState<View>("list");
  const [formTarget, setFormTarget] = useState<AttributeDefRow | null>(null);
  const [viewTarget, setViewTarget] = useState<AttributeDefRow | null>(null);

  const [draft, setDraft] = useState({ ...EMPTY_DRAFT });
  const [submitted, setSubmitted] = useState(false);
  const [busySave, setBusySave] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const [pendingOptions, setPendingOptions] = useState<
    { label: string; colorHex: string; isActive: boolean }[]
  >([]);
  const [favOptIdx, setFavOptIdx] = useState<number | null>(null);
  const [editingOptIdx, setEditingOptIdx] = useState<number | null>(null);
  const [editingOptLabel, setEditingOptLabel] = useState("");

  const newOptInputRef = useRef<HTMLInputElement>(null);
  const [newOptLabel, setNewOptLabel] = useState("");
  const [newOptColor, setNewOptColor] = useState("");
  const [busyNewOpt, setBusyNewOpt] = useState(false);
  const [busyOptId, setBusyOptId] = useState<string | null>(null);
  const [busyToggleOptId, setBusyToggleOptId] = useState<string | null>(null);

  const dragIdx = useRef<number>(-1);
  const [dragOver, setDragOver] = useState<number>(-1);

  const [busyId, setBusyId] = useState<string | null>(null);

  const [deleteDef, setDeleteDef] = useState<AttributeDefRow | null>(null);

  const [sortKey, setSortKey] = useState<"name" | "inputType" | "isActive" | "assignmentCount">("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  /* =========================================================
     Carga
  ========================================================= */
  async function load() {
    try {
      setLoading(true);
      const data = await attributeDefsApi.list();
      setDefs(data);
    } catch (e: any) {
      toast.error(e?.message || "Error al cargar la biblioteca.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      setView("list");
      setQ("");
      setViewTarget(null);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (view === "form") {
      const t = window.setTimeout(() => nameRef.current?.focus(), 50);
      return () => window.clearTimeout(t);
    }
  }, [view]);

  /* =========================================================
     Computed
  ========================================================= */
  const filtered = q.trim()
    ? defs.filter((d) => {
        const lq = q.toLowerCase();
        return (
          d.name.toLowerCase().includes(lq) ||
          d.code.toLowerCase().includes(lq) ||
          INPUT_TYPE_LABELS[d.inputType].toLowerCase().includes(lq)
        );
      })
    : defs;

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "name")            cmp = a.name.localeCompare(b.name, "es");
    if (sortKey === "inputType")       cmp = INPUT_TYPE_LABELS[a.inputType].localeCompare(INPUT_TYPE_LABELS[b.inputType], "es");
    if (sortKey === "isActive")        cmp = Number(b.isActive) - Number(a.isActive);
    if (sortKey === "assignmentCount") cmp = a.assignmentCount - b.assignmentCount;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const hasOptionsInDraft =
    draft.inputType !== "" && HAS_OPTIONS.includes(draft.inputType as AttributeInputType);
  const isColorDraft = draft.inputType === "COLOR";

  const currentEditOptions = formTarget
    ? (defs.find((d) => d.id === formTarget.id)?.options ?? formTarget.options)
    : [];

  /* =========================================================
     Navegación
  ========================================================= */
  function openCreate() {
    setFormTarget(null);
    setDraft({ ...EMPTY_DRAFT });
    setPendingOptions([]);
    setFavOptIdx(null);
    setEditingOptIdx(null);
    setEditingOptLabel("");
    setNewOptLabel("");
    setNewOptColor("");
    setSubmitted(false);
    setView("form");
  }

  function openEdit(def: AttributeDefRow) {
    setFormTarget(def);
    setDraft({
      name: def.name,
      inputType: def.inputType,
      unit: def.unit,
      defaultValue: def.defaultValue,
    });
    setPendingOptions([]);
    setNewOptLabel("");
    setNewOptColor("");
    setSubmitted(false);
    setView("form");
  }

  function openView(def: AttributeDefRow) {
    setViewTarget(def);
  }

  function closeView() {
    setViewTarget(null);
  }

  function goBack() {
    setView("list");
    setFormTarget(null);
    setPendingOptions([]);
    setFavOptIdx(null);
    setEditingOptIdx(null);
    setEditingOptLabel("");
    setNewOptLabel("");
    setNewOptColor("");
    setSubmitted(false);
  }

  /* =========================================================
     Guardar
  ========================================================= */
  async function handleSave() {
    setSubmitted(true);
    if (!draft.name.trim()) return;
    if (!draft.inputType) return;

    // Validar nombre duplicado
    const nameNorm = draft.name.trim().toLowerCase();
    const isDuplicate = defs.some(
      (d) => d.name.toLowerCase() === nameNorm && d.id !== formTarget?.id
    );
    if (isDuplicate) {
      toast.error("Ya existe un atributo con ese nombre.");
      return;
    }

    const favLabel =
      favOptIdx !== null && pendingOptions[favOptIdx]
        ? pendingOptions[favOptIdx].label
        : draft.defaultValue.trim();

    const payload = {
      name: draft.name.trim(),
      code: "",
      inputType: draft.inputType as AttributeInputType,
      helpText: "",
      unit: draft.unit.trim(),
      defaultValue: favLabel,
    };

    try {
      setBusySave(true);

      if (formTarget) {
        const updated = await attributeDefsApi.update(formTarget.id, payload);
        setDefs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
        toast.success("Atributo actualizado.");
        goBack();
      } else {
        const created = await attributeDefsApi.create(payload);

        if (pendingOptions.length > 0) {
          const results = await Promise.allSettled(
            pendingOptions.map((opt) =>
              attributeDefsApi.createOption(created.id, {
                label: opt.label,
                value: opt.label,
                colorHex: opt.colorHex,
              })
            )
          );
          const failed = results.filter((r) => r.status === "rejected").length;
          if (failed > 0) {
            toast.error(
              `Atributo creado, pero ${failed} opción${
                failed !== 1 ? "es" : ""
              } no se ${failed !== 1 ? "pudieron" : "pudo"} guardar.`
            );
          } else {
            toast.success("Atributo creado con opciones.");
          }
          await load();
        } else {
          setDefs((prev) => [created, ...prev]);
          toast.success("Atributo creado.");
        }

        goBack();
      }
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar.");
    } finally {
      setBusySave(false);
    }
  }

  /* =========================================================
     Toggle / Eliminar
  ========================================================= */
  async function handleToggle(def: AttributeDefRow) {
    try {
      setBusyId(def.id);
      const updated = await attributeDefsApi.toggle(def.id);
      setDefs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      if (viewTarget?.id === updated.id) setViewTarget(updated);
    } catch (e: any) {
      toast.error(e?.message || "Error.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!deleteDef) return;
    try {
      setBusyId(deleteDef.id);
      await attributeDefsApi.remove(deleteDef.id);
      setDefs((prev) => prev.filter((d) => d.id !== deleteDef.id));
      if (viewTarget?.id === deleteDef.id) setViewTarget(null);
      toast.success("Atributo eliminado.");
      setDeleteDef(null);
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar.");
    } finally {
      setBusyId(null);
    }
  }

  /* =========================================================
     Opciones — edición
  ========================================================= */
  async function handleAddOptionEdit() {
    if (!formTarget) return;
    const label = newOptLabel.trim();
    if (!label) return;
    const defIsColor = formTarget.inputType === "COLOR";

    try {
      setBusyNewOpt(true);
      const created = await attributeDefsApi.createOption(formTarget.id, {
        label,
        value: label,
        colorHex: defIsColor ? newOptColor.trim() : "",
      });
      setDefs((prev) =>
        prev.map((d) =>
          d.id === formTarget.id ? { ...d, options: [...d.options, created] } : d
        )
      );
      setNewOptLabel("");
      setNewOptColor("");
    } catch (e: any) {
      toast.error(e?.message || "Error al agregar opción.");
    } finally {
      setBusyNewOpt(false);
    }
  }

  async function handleToggleOptionEdit(optId: string) {
    if (!formTarget) return;
    try {
      setBusyToggleOptId(optId);
      const result = await attributeDefsApi.toggleOption(optId);
      setDefs((prev) =>
        prev.map((d) =>
          d.id === formTarget.id
            ? {
                ...d,
                options: d.options.map((o) =>
                  o.id === optId ? { ...o, isActive: result.isActive } : o
                ),
              }
            : d
        )
      );
    } catch (e: any) {
      toast.error(e?.message || "Error al cambiar estado de la opción.");
    } finally {
      setBusyToggleOptId(null);
    }
  }

  async function handleReorderEditOptions(newOrder: typeof currentEditOptions) {
    if (!formTarget) return;
    // Optimistic update
    setDefs((prev) =>
      prev.map((d) =>
        d.id === formTarget.id ? { ...d, options: newOrder } : d
      )
    );
    try {
      await attributeDefsApi.reorderOptions(
        formTarget.id,
        newOrder.map((o) => o.id)
      );
    } catch (e: any) {
      toast.error(e?.message || "Error al reordenar opciones.");
      // Revert on error
      await load();
    }
  }

  async function handleRemoveOptionEdit(optId: string) {
    if (!formTarget) return;
    try {
      setBusyOptId(optId);
      await attributeDefsApi.removeOption(optId);
      setDefs((prev) =>
        prev.map((d) =>
          d.id === formTarget.id
            ? { ...d, options: d.options.filter((o) => o.id !== optId) }
            : d
        )
      );
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar opción.");
    } finally {
      setBusyOptId(null);
    }
  }

  /* =========================================================
     Opciones — creación local
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
    setTimeout(() => newOptInputRef.current?.focus(), 0);
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
     Render opciones
  ========================================================= */
  function renderOptionsSection() {
    const isEditMode = !!formTarget;

    function handleDrop(toIdx: number) {
      const fromIdx = dragIdx.current;
      if (fromIdx === -1 || fromIdx === toIdx) {
        setDragOver(-1);
        return;
      }
      if (isEditMode) {
        const next = [...currentEditOptions];
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        void handleReorderEditOptions(next);
      } else {
        setPendingOptions((prev) => {
          const next = [...prev];
          const [moved] = next.splice(fromIdx, 1);
          next.splice(toIdx, 0, moved);
          // Ajustar favOptIdx
          if (favOptIdx !== null) {
            if (favOptIdx === fromIdx) setFavOptIdx(toIdx);
            else if (fromIdx < favOptIdx && toIdx >= favOptIdx) setFavOptIdx(favOptIdx - 1);
            else if (fromIdx > favOptIdx && toIdx <= favOptIdx) setFavOptIdx(favOptIdx + 1);
          }
          return next;
        });
      }
      dragIdx.current = -1;
      setDragOver(-1);
    }

    const optList = isEditMode ? currentEditOptions : pendingOptions;

    return (
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
            inputRef={newOptInputRef}
            value={newOptLabel}
            onChange={setNewOptLabel}
            placeholder={isColorDraft ? "Nombre del color…" : "Nueva opción…"}
            wrapClassName="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (isEditMode) void handleAddOptionEdit();
                else handleAddPendingOption();
              }
            }}
          />
          <button
            type="button"
            title="Agregar opción"
            onClick={() => {
              if (isEditMode) void handleAddOptionEdit();
              else handleAddPendingOption();
            }}
            disabled={busyNewOpt || !newOptLabel.trim()}
            className="tp-btn-primary h-9 px-3 flex items-center gap-1.5 shrink-0 disabled:opacity-50 text-sm font-medium"
          >
            {busyNewOpt ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={15} />
            )}
          </button>
        </div>

        {/* Lista */}
        {optList.length > 0 ? (
          <div className="rounded-xl border border-border overflow-hidden">
            {isEditMode
              ? currentEditOptions.map((opt, idx) => {
                  const isToggleBusy = busyToggleOptId === opt.id;
                  const isDeleteBusy = busyOptId === opt.id;
                  return (
                    <div
                      key={opt.id}
                      draggable
                      onDragStart={() => { dragIdx.current = idx; }}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(idx); }}
                      onDragLeave={() => setDragOver(-1)}
                      onDrop={() => handleDrop(idx)}
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
                      <span className="flex-1 text-text truncate">{opt.label}</span>

                      {/* Star (favorita) */}
                      <button
                        type="button"
                        title={draft.defaultValue === opt.label ? "Quitar favorita" : "Marcar como favorita"}
                        onClick={() =>
                          setDraft((p) => ({
                            ...p,
                            defaultValue: p.defaultValue === opt.label ? "" : opt.label,
                          }))
                        }
                        className="shrink-0 transition-colors"
                      >
                        <Star
                          size={14}
                          className={
                            draft.defaultValue === opt.label
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted hover:text-yellow-400"
                          }
                        />
                      </button>

                      {/* Toggle activo/inactivo */}
                      <button
                        type="button"
                        title={opt.isActive ? "Desactivar opción" : "Activar opción"}
                        onClick={() => void handleToggleOptionEdit(opt.id)}
                        disabled={isToggleBusy || isDeleteBusy}
                        className="shrink-0 text-muted hover:text-text transition-colors disabled:opacity-50"
                      >
                        {isToggleBusy ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : opt.isActive ? (
                          <ShieldBan size={13} />
                        ) : (
                          <ShieldCheck size={13} />
                        )}
                      </button>

                      {/* Eliminar */}
                      <button
                        type="button"
                        title="Eliminar opción"
                        onClick={() => void handleRemoveOptionEdit(opt.id)}
                        disabled={isDeleteBusy || isToggleBusy}
                        className="shrink-0 text-muted hover:text-red-400 transition-colors disabled:opacity-50"
                      >
                        {isDeleteBusy ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Trash2 size={13} />
                        )}
                      </button>
                    </div>
                  );
                })
              : pendingOptions.map((opt, idx) => (
                  <div
                    key={idx}
                    draggable
                    onDragStart={() => { dragIdx.current = idx; }}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(idx); }}
                    onDragLeave={() => setDragOver(-1)}
                    onDrop={() => handleDrop(idx)}
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

                    {/* Toggle activo/inactivo (local) */}
                    <button
                      type="button"
                      title={opt.isActive ? "Desactivar opción" : "Activar opción"}
                      onClick={() =>
                        setPendingOptions((prev) =>
                          prev.map((o, i) =>
                            i === idx ? { ...o, isActive: !o.isActive } : o
                          )
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
    );
  }

  /* =========================================================
     Vista lista
  ========================================================= */
  const listView = (
    <TPTableWrap>
      <TPTableHeader
        left={
          <TPSearchInput
            value={q}
            onChange={setQ}
            placeholder="Buscar por nombre, código o tipo…"
            className="h-9 w-full md:w-72"
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
              <TPTh className="hidden sm:table-cell">
                <button type="button" className="flex items-center gap-1" onClick={() => toggleSort("isActive")}>
                  Estado <SortArrows dir={sortDir} active={sortKey === "isActive"} />
                </button>
              </TPTh>
              <TPTh className="hidden md:table-cell">
                <button type="button" className="flex items-center gap-1" onClick={() => toggleSort("assignmentCount")}>
                  Usado en <SortArrows dir={sortDir} active={sortKey === "assignmentCount"} />
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
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted">
                  {q ? "Sin resultados para esa búsqueda." : "No hay atributos en la biblioteca todavía."}
                  {!q && (
                    <div className="mt-3">
                      <TPButton variant="linkPrimary" onClick={openCreate}>
                        Crear el primer atributo
                      </TPButton>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              sorted.map((def) => {
                const hasOptions = HAS_OPTIONS.includes(def.inputType);
                const isBusy = busyId === def.id;
                return (
                  <TPTr key={def.id} className={cn(!def.isActive && "opacity-60")}>
                    <TPTd label="Nombre">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-text">{def.name}</span>
                        {hasOptions && def.options.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-surface2 px-2 py-0.5 text-xs text-muted">
                            <Tags size={10} />
                            {def.options.length}
                          </span>
                        )}
                      </div>
                    </TPTd>
                    <TPTd label="Tipo" className="hidden sm:table-cell">
                      <TypePill inputType={def.inputType} />
                    </TPTd>
                    <TPTd label="Estado" className="hidden sm:table-cell">
                      <TPStatusPill active={def.isActive} activeLabel="Activo" inactiveLabel="Inactivo" />
                    </TPTd>
                    <TPTd label="Usado en" className="hidden md:table-cell">
                      {def.assignmentCount === 0 ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {def.assignedCategories.slice(0, 3).map((cat) => (
                            <span
                              key={cat.id}
                              className="inline-flex items-center rounded-full bg-surface2 px-2 py-0.5 text-xs text-text"
                            >
                              {cat.name}
                            </span>
                          ))}
                          {def.assignmentCount > 3 && (
                            <span className="inline-flex items-center rounded-full bg-surface2 px-2 py-0.5 text-xs text-muted">
                              +{def.assignmentCount - 3} más
                            </span>
                          )}
                        </div>
                      )}
                    </TPTd>
                    <TPTd>
                      <TPRowActions
                        className="flex-nowrap"
                        onView={() => openView(def)}
                        onEdit={() => openEdit(def)}
                        onToggle={isBusy ? undefined : () => void handleToggle(def)}
                        isActive={def.isActive}
                        onDelete={() => setDeleteDef(def)}
                      />
                    </TPTd>
                  </TPTr>
                );
              })
            )}
          </TPTbody>
        </TPTableElBase>
      </TPTableXScroll>

      <TPTableFooter>
        {defs.length} atributo{defs.length !== 1 ? "s" : ""} en total
      </TPTableFooter>
    </TPTableWrap>
  );

  /* =========================================================
     Vista formulario
  ========================================================= */
  const formView = (
    <div className="space-y-4">
      <TPCard title="Identificación">
        <div className="space-y-4">
          <TPField
            label="Nombre"
            required
            error={submitted && !draft.name.trim() ? "El nombre es obligatorio." : null}
          >
            <TPInput
              inputRef={nameRef}
              value={draft.name}
              onChange={(v) => setDraft((p) => ({ ...p, name: v }))}
              placeholder="Ej: Material"
              disabled={busySave}
            />
          </TPField>

          {(draft.inputType === "NUMBER" || draft.inputType === "DECIMAL") && (
            <TPField label="Unidad" hint="Ej: cm, kg, mm">
              <TPInput
                value={draft.unit}
                onChange={(v) => setDraft((p) => ({ ...p, unit: v }))}
                placeholder="Ej: gramos"
                disabled={busySave}
              />
            </TPField>
          )}
        </div>
      </TPCard>

      {hasOptionsInDraft && (
        <TPCard title="Opciones">
          {renderOptionsSection()}
        </TPCard>
      )}
    </div>
  );

  /* =========================================================
     Modal
  ========================================================= */
  const modalTitle =
    view === "form"
      ? formTarget
        ? `Editar: ${formTarget.name}`
        : "Nuevo atributo"
      : "Biblioteca de atributos";

  const modalFooter =
    view === "list" ? (
      <>
        <TPButton variant="secondary" onClick={onClose} iconLeft={<X size={16} />}>
          Cerrar
        </TPButton>
        <TPButton variant="primary" onClick={openCreate} iconLeft={<Plus size={15} />}>
          Nuevo atributo
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
        <TPButton
          variant="primary"
          onClick={handleSave}
          loading={busySave}
          iconLeft={<Save size={15} />}
        >
          {formTarget ? "Guardar cambios" : "Crear atributo"}
        </TPButton>
      </>
    );

  const currentViewDef =
    viewTarget ? defs.find((d) => d.id === viewTarget.id) ?? viewTarget : null;

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
        onEnter={view === "form" && !hasOptionsInDraft ? handleSave : undefined}
        footer={modalFooter}
      >
        {view === "list" ? listView : formView}
      </Modal>

      <Modal
        open={!!currentViewDef}
        title={currentViewDef ? `Ver atributo: ${currentViewDef.name}` : "Ver atributo"}
        maxWidth="sm"
        onClose={closeView}
        footer={
          <TPButton variant="secondary" onClick={closeView} iconLeft={<X size={16} />}>
            Cerrar
          </TPButton>
        }
      >
        {currentViewDef && (
          <div className="divide-y divide-border text-sm">
            <div className="flex justify-between gap-4 py-2">
              <span className="text-muted font-medium">Nombre</span>
              <span className="text-text text-right">{currentViewDef.name}</span>
            </div>

            <div className="flex justify-between gap-4 py-2">
              <span className="text-muted font-medium">Tipo de campo</span>
              <TypePill inputType={currentViewDef.inputType} />
            </div>

            <div className="flex justify-between gap-4 py-2">
              <span className="text-muted font-medium">Estado</span>
              <TPStatusPill
                active={currentViewDef.isActive}
                activeLabel="Activo"
                inactiveLabel="Inactivo"
              />
            </div>

            <div className="flex flex-col gap-1.5 py-2">
              <span className="text-muted font-medium">
                Categorías asignadas
                {currentViewDef.assignmentCount > 0 && (
                  <span className="ml-1.5 text-xs font-normal text-muted/70">
                    ({currentViewDef.assignmentCount})
                  </span>
                )}
              </span>
              {currentViewDef.assignmentCount === 0 ? (
                <span className="text-muted italic">Sin asignar</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {currentViewDef.assignedCategories.map((cat) => (
                    <span
                      key={cat.id}
                      className="inline-flex items-center rounded-full bg-surface2 px-2.5 py-0.5 text-xs text-text"
                    >
                      {cat.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {(currentViewDef.inputType === "NUMBER" ||
              currentViewDef.inputType === "DECIMAL") && (
              <div className="flex justify-between gap-4 py-2">
                <span className="text-muted font-medium">Unidad</span>
                <span className="text-text text-right">
                  {currentViewDef.unit || "—"}
                </span>
              </div>
            )}

            {currentViewDef.defaultValue && (
              <div className="flex justify-between gap-4 py-2">
                <span className="text-muted font-medium">Valor por defecto</span>
                <span className="text-text text-right">
                  {currentViewDef.defaultValue}
                </span>
              </div>
            )}

            {HAS_OPTIONS.includes(currentViewDef.inputType) && (
              <div className="flex flex-col gap-2 py-2">
                <span className="text-muted font-medium">Opciones</span>
                {currentViewDef.options.length === 0 ? (
                  <span className="text-muted italic">Sin opciones</span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {currentViewDef.options.map((opt) => (
                      <span
                        key={opt.id}
                        className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs text-text"
                      >
                        {currentViewDef.inputType === "COLOR" && opt.colorHex && (
                          <span
                            className="h-3 w-3 rounded-full border border-border"
                            style={{ backgroundColor: opt.colorHex }}
                          />
                        )}
                        {opt.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between gap-4 py-2">
              <span className="text-muted font-medium">Fecha de creación</span>
              <span className="text-text text-right">
                {new Date(currentViewDef.createdAt).toLocaleDateString("es-AR")}
              </span>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDeleteDialog
        open={deleteDef !== null}
        title={`Eliminar "${deleteDef?.name ?? ""}"`}
        description={
          deleteDef && deleteDef.assignmentCount > 0
            ? `Este atributo está asignado a ${deleteDef.assignmentCount} categoría(s). Desasignalo primero para poder eliminarlo.`
            : "¿Estás seguro? Esta acción eliminará el atributo de la biblioteca."
        }
        confirmText="Eliminar"
        busy={busyId === deleteDef?.id}
        onClose={() => setDeleteDef(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}