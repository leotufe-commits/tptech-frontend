// src/pages/configuracion-sistema/ConfiguracionSistemaCategorias.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Pencil,
  Eye,
  Trash2,
  ShieldBan,
  ShieldCheck,
  Loader2,
  FolderOpen,
  FolderTree,
  ChevronRight,
} from "lucide-react";

import { cn } from "../../components/ui/tp";
import { TPSectionShell } from "../../components/ui/TPSectionShell";
import { TPButton } from "../../components/ui/TPButton";
import { TPSearchInput } from "../../components/ui/TPSearchInput";
import TPInput from "../../components/ui/TPInput";
import { TPField } from "../../components/ui/TPField";
import { TPCheckbox } from "../../components/ui/TPCheckbox";
import TPTextarea from "../../components/ui/TPTextarea";
import { Modal } from "../../components/ui/Modal";
import ConfirmDeleteDialog from "../../components/ui/ConfirmDeleteDialog";
import {
  TPTableWrap,
  TPTableHeader,
  TPTableXScroll,
  TPTableElBase,
  TPThead,
  TPTbody,
  TPTr,
  TPTd,
  TPTh,
  TPEmptyRow,
} from "../../components/ui/TPTable";

import { toast } from "../../lib/toast";
import { categoriesApi, type CategoryRow } from "../../services/categories";

/* =========================================================
   Pill de estado
========================================================= */
function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        active
          ? "bg-green-500/15 text-green-600 dark:text-green-400"
          : "bg-surface2 text-muted"
      )}
    >
      {active ? "Activa" : "Inactiva"}
    </span>
  );
}

/* =========================================================
   Página principal
========================================================= */
export default function ConfiguracionSistemaCategorias() {
  /* ---------- estado principal ---------- */
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  /* ---------- modal editar/crear ---------- */
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CategoryRow | null>(null);

  /* ---------- modal ver ---------- */
  const [viewOpen, setViewOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<CategoryRow | null>(null);

  /* ---------- modal eliminar ---------- */
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null);

  /* ---------- busy ---------- */
  const [busySave, setBusySave] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);

  /* ---------- draft del modal ---------- */
  const [draftName, setDraftName] = useState("");
  const [draftParentId, setDraftParentId] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftSortOrder, setDraftSortOrder] = useState("0");
  const [draftIsActive, setDraftIsActive] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  /* ---------- autofocus en modal ---------- */
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editOpen) {
      const t = window.setTimeout(() => {
        nameRef.current?.focus();
        nameRef.current?.select();
      }, 50);
      return () => window.clearTimeout(t);
    }
  }, [editOpen]);

  /* ---------- carga inicial ---------- */
  async function load() {
    try {
      setLoading(true);
      const data = await categoriesApi.list();
      setRows(data);
    } catch (e: any) {
      toast.error(e?.message || "Ocurrió un error.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  /* ---------- filtrado ---------- */
  const filteredRows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(s) ||
        (r.parent?.name ?? "").toLowerCase().includes(s)
    );
  }, [rows, q]);

  /* ---------- opciones de padre en selector ---------- */
  const parentOptions = useMemo(() => {
    return rows.filter(
      (r) => r.isActive && r.deletedAt === null && r.id !== editTarget?.id
    );
  }, [rows, editTarget]);

  /* ---------- abrir modal crear ---------- */
  function openCreate() {
    setEditTarget(null);
    setDraftName("");
    setDraftParentId("");
    setDraftDescription("");
    setDraftSortOrder("0");
    setDraftIsActive(true);
    setSubmitted(false);
    setEditOpen(true);
  }

  /* ---------- abrir modal editar ---------- */
  function openEdit(row: CategoryRow) {
    setEditTarget(row);
    setDraftName(row.name);
    setDraftParentId(row.parentId ?? "");
    setDraftDescription(row.description ?? "");
    setDraftSortOrder(String(row.sortOrder ?? 0));
    setDraftIsActive(row.isActive);
    setSubmitted(false);
    setEditOpen(true);
  }

  /* ---------- abrir modal ver ---------- */
  function openView(row: CategoryRow) {
    setViewTarget(row);
    setViewOpen(true);
  }

  /* ---------- abrir modal eliminar ---------- */
  function openDelete(row: CategoryRow) {
    setDeleteTarget(row);
    setDeleteOpen(true);
  }

  /* ---------- guardar ---------- */
  async function handleSave() {
    setSubmitted(true);
    const name = draftName.trim();
    if (!name) return;

    const payload = {
      name,
      parentId: draftParentId || null,
      description: draftDescription.trim(),
      sortOrder: parseInt(draftSortOrder, 10) || 0,
      isActive: draftIsActive,
    };

    try {
      setBusySave(true);
      if (editTarget) {
        await categoriesApi.update(editTarget.id, payload);
        toast.success("Categoría actualizada.");
      } else {
        await categoriesApi.create(payload);
        toast.success("Categoría creada correctamente.");
      }
      setEditOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Ocurrió un error.");
    } finally {
      setBusySave(false);
    }
  }

  /* ---------- toggle activo/inactivo ---------- */
  async function handleToggle(row: CategoryRow) {
    try {
      // optimistic update
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, isActive: !r.isActive } : r))
      );
      await categoriesApi.toggle(row.id);
      toast.success(
        row.isActive ? "Categoría desactivada." : "Categoría activada."
      );
      await load();
    } catch (e: any) {
      // revertir en caso de error
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, isActive: row.isActive } : r))
      );
      toast.error(e?.message || "Ocurrió un error.");
    }
  }

  /* ---------- eliminar ---------- */
  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      setBusyDelete(true);
      await categoriesApi.remove(deleteTarget.id);
      toast.success("Categoría eliminada.");
      setDeleteOpen(false);
      setDeleteTarget(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Ocurrió un error.");
    } finally {
      setBusyDelete(false);
    }
  }

  /* ---------- formato fecha ---------- */
  function formatDate(iso: string) {
    try {
      return new Intl.DateTimeFormat("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  /* =========================================================
     RENDER
  ========================================================= */
  return (
    <TPSectionShell
      title="Categorías de Artículos"
      subtitle="Clasificación jerárquica del catálogo"
      icon={<FolderTree size={22} />}
    >
      <TPTableWrap>
        {/* ---- header: contador + buscador + botón ---- */}
        <TPTableHeader
          left={
            <span className="text-sm text-muted">
              {filteredRows.length}{" "}
              {filteredRows.length === 1 ? "categoría" : "categorías"}
            </span>
          }
          right={
            <div className="flex items-center gap-2 w-full md:w-auto">
              <TPSearchInput
                value={q}
                onChange={setQ}
                placeholder="Buscar…"
                className="h-9 w-full md:w-64"
              />
              <TPButton
                variant="primary"
                onClick={openCreate}
                iconLeft={<Plus size={16} />}
                className="h-9 whitespace-nowrap shrink-0"
              >
                Nueva categoría
              </TPButton>
            </div>
          }
        />

        {/* ---- tabla ---- */}
        <TPTableXScroll>
          <TPTableElBase responsive="stack">
            <TPThead>
              <tr>
                <TPTh>Nombre</TPTh>
                <TPTh className="hidden md:table-cell">Sub-categorías</TPTh>
                <TPTh className="hidden md:table-cell">Estado</TPTh>
                <TPTh className="text-right">Acciones</TPTh>
              </tr>
            </TPThead>

            <TPTbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-sm text-muted">
                    <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
                    Cargando…
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <TPEmptyRow
                  colSpan={4}
                  text={
                    q
                      ? "No hay resultados para esa búsqueda."
                      : "Todavía no hay categorías. Creá la primera."
                  }
                />
              ) : (
                filteredRows.map((row) => (
                  <TPTr key={row.id}>
                    {/* Nombre */}
                    <TPTd label="Nombre">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={cn(
                            "grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-border",
                            row.parent
                              ? "bg-surface2 text-muted"
                              : "bg-primary/10 text-primary"
                          )}
                        >
                          {row.parent ? (
                            <FolderOpen size={14} />
                          ) : (
                            <FolderTree size={14} />
                          )}
                        </div>
                        <div className="min-w-0">
                          {row.parent ? (
                            <div className="flex items-center gap-1 text-sm min-w-0 flex-wrap">
                              <span className="text-muted truncate max-w-[120px]">
                                {row.parent.name}
                              </span>
                              <ChevronRight size={12} className="text-muted shrink-0" />
                              <span className="font-medium text-text truncate">
                                {row.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm font-medium text-text truncate block">
                              {row.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </TPTd>

                    {/* Sub-categorías */}
                    <TPTd label="Sub-categorías" className="hidden md:table-cell">
                      <span className="text-sm text-muted">
                        {row.childrenCount > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <FolderOpen size={13} />
                            {row.childrenCount}
                          </span>
                        ) : (
                          "—"
                        )}
                      </span>
                    </TPTd>

                    {/* Estado */}
                    <TPTd label="Estado" className="hidden md:table-cell">
                      <StatusPill active={row.isActive} />
                    </TPTd>

                    {/* Acciones */}
                    <TPTd label="Acciones" className="text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* estado en mobile */}
                        <span className="md:hidden">
                          <StatusPill active={row.isActive} />
                        </span>

                        <button
                          type="button"
                          title="Ver detalle"
                          onClick={() => openView(row)}
                          className="tp-btn-secondary h-9 w-9 !p-0 grid place-items-center shrink-0"
                        >
                          <Eye size={15} />
                        </button>

                        <button
                          type="button"
                          title="Editar"
                          onClick={() => openEdit(row)}
                          className="tp-btn-secondary h-9 w-9 !p-0 grid place-items-center shrink-0"
                        >
                          <Pencil size={15} />
                        </button>

                        <button
                          type="button"
                          title={row.isActive ? "Desactivar" : "Activar"}
                          onClick={() => handleToggle(row)}
                          className="tp-btn-secondary h-9 w-9 !p-0 grid place-items-center shrink-0"
                        >
                          {row.isActive ? (
                            <ShieldBan size={15} />
                          ) : (
                            <ShieldCheck size={15} className="text-green-500" />
                          )}
                        </button>

                        <button
                          type="button"
                          title="Eliminar"
                          onClick={() => openDelete(row)}
                          className="tp-btn-secondary h-9 w-9 !p-0 grid place-items-center shrink-0 text-red-400 hover:text-red-500"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </TPTd>
                  </TPTr>
                ))
              )}
            </TPTbody>
          </TPTableElBase>
        </TPTableXScroll>
      </TPTableWrap>

      {/* =========================================================
          MODAL CREAR / EDITAR
      ========================================================= */}
      <Modal
        open={editOpen}
        title={editTarget ? "Editar categoría" : "Nueva categoría"}
        maxWidth="md"
        busy={busySave}
        onClose={() => !busySave && setEditOpen(false)}
        onEnter={handleSave}
        footer={
          <>
            <TPButton
              variant="secondary"
              onClick={() => setEditOpen(false)}
              disabled={busySave}
            >
              Cancelar
            </TPButton>
            <TPButton
              variant="primary"
              onClick={handleSave}
              loading={busySave}
            >
              Guardar
            </TPButton>
          </>
        }
      >
        <div className="space-y-4">
          {/* Nombre */}
          <TPField
            label="Nombre"
            required
            error={submitted && !draftName.trim() ? "El nombre es obligatorio." : null}
          >
            <TPInput
              value={draftName}
              onChange={(v) => {
                setDraftName(v);
                if (submitted && v.trim()) setSubmitted(false);
              }}
              placeholder="Ej: Anillos"
              disabled={busySave}
              inputRef={nameRef}
              data-tp-autofocus="1"
            />
          </TPField>

          {/* Categoría padre */}
          <TPField label="Categoría padre">
            <select
              value={draftParentId}
              onChange={(e) => setDraftParentId(e.target.value)}
              disabled={busySave}
              className="tp-select w-full"
            >
              <option value="">Sin padre (categoría raíz)</option>
              {parentOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.parent ? `${opt.parent.name} › ${opt.name}` : opt.name}
                </option>
              ))}
            </select>
          </TPField>

          {/* Descripción */}
          <TPField label="Descripción">
            <TPTextarea
              value={draftDescription}
              onChange={setDraftDescription}
              placeholder="Descripción opcional de la categoría…"
              disabled={busySave}
              minH={80}
            />
          </TPField>

          {/* Orden */}
          <TPField label="Orden">
            <TPInput
              value={draftSortOrder}
              onChange={setDraftSortOrder}
              type="number"
              placeholder="0"
              disabled={busySave}
            />
          </TPField>

          {/* Activo — solo en modo editar */}
          {editTarget && (
            <TPField label="">
              <TPCheckbox
                checked={draftIsActive}
                onChange={setDraftIsActive}
                disabled={busySave}
                label={
                  <span className="text-sm text-text">
                    Categoría activa
                  </span>
                }
              />
            </TPField>
          )}
        </div>
      </Modal>

      {/* =========================================================
          MODAL VER DETALLE
      ========================================================= */}
      <Modal
        open={viewOpen}
        title={viewTarget?.name ?? "Detalle de categoría"}
        maxWidth="sm"
        onClose={() => setViewOpen(false)}
        footer={
          <TPButton variant="secondary" onClick={() => setViewOpen(false)}>
            Cerrar
          </TPButton>
        }
      >
        {viewTarget && (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-4 py-2 border-b border-border">
              <span className="text-muted font-medium">Nombre</span>
              <span className="text-text text-right">{viewTarget.name}</span>
            </div>

            <div className="flex justify-between gap-4 py-2 border-b border-border">
              <span className="text-muted font-medium">Categoría padre</span>
              <span className="text-text text-right">
                {viewTarget.parent?.name ?? (
                  <span className="text-muted italic">Sin padre (raíz)</span>
                )}
              </span>
            </div>

            {viewTarget.description && (
              <div className="flex flex-col gap-1 py-2 border-b border-border">
                <span className="text-muted font-medium">Descripción</span>
                <span className="text-text">{viewTarget.description}</span>
              </div>
            )}

            <div className="flex justify-between gap-4 py-2 border-b border-border">
              <span className="text-muted font-medium">Sub-categorías</span>
              <span className="text-text text-right">
                {viewTarget.childrenCount}
              </span>
            </div>

            <div className="flex justify-between gap-4 py-2 border-b border-border">
              <span className="text-muted font-medium">Estado</span>
              <StatusPill active={viewTarget.isActive} />
            </div>

            <div className="flex justify-between gap-4 py-2">
              <span className="text-muted font-medium">Fecha de creación</span>
              <span className="text-text text-right">
                {formatDate(viewTarget.createdAt)}
              </span>
            </div>
          </div>
        )}
      </Modal>

      {/* =========================================================
          CONFIRM DELETE
      ========================================================= */}
      <ConfirmDeleteDialog
        open={deleteOpen}
        title={`Eliminar "${deleteTarget?.name ?? ""}"`}
        description={
          deleteTarget && deleteTarget.childrenCount > 0
            ? `Esta categoría tiene ${deleteTarget.childrenCount} sub-categoría${deleteTarget.childrenCount > 1 ? "s" : ""} y no se puede eliminar.`
            : "¿Estás seguro que querés eliminar esta categoría? Esta acción no se puede deshacer."
        }
        confirmText={
          deleteTarget && deleteTarget.childrenCount > 0
            ? "Entendido"
            : "Eliminar"
        }
        busy={busyDelete}
        onClose={() => {
          if (!busyDelete) {
            setDeleteOpen(false);
            setDeleteTarget(null);
          }
        }}
        onConfirm={
          deleteTarget && deleteTarget.childrenCount > 0
            ? () => {
                setDeleteOpen(false);
                setDeleteTarget(null);
              }
            : handleDelete
        }
      />
    </TPSectionShell>
  );
}
