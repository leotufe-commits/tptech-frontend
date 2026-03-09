// src/pages/configuracion-sistema/ConfiguracionSistemaVendedor.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Eye,
  Trash2,
  ShieldBan,
  ShieldCheck,
  Loader2,
  Users,
  Star,
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
import { apiFetch } from "../../lib/api";
import { sellersApi, type SellerRow, type CommissionType } from "../../services/sellers";

/* =========================================================
   Tipos auxiliares
========================================================= */
type WarehouseOption = { id: string; name: string; isActive: boolean };

/* =========================================================
   Constantes
========================================================= */
const COMMISSION_LABELS: Record<CommissionType, string> = {
  NONE: "Sin comisión",
  PERCENTAGE: "Porcentaje (%)",
  FIXED_AMOUNT: "Monto fijo ($)",
};

const EMPTY_DRAFT = {
  firstName: "",
  lastName: "",
  displayName: "",
  documentType: "",
  documentNumber: "",
  email: "",
  phone: "",
  commissionType: "NONE" as CommissionType,
  commissionValue: "",
  isActive: true,
  isFavorite: false,
  notes: "",
  warehouseIds: [] as string[],
};

/* =========================================================
   Helpers
========================================================= */
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

function formatCommission(row: SellerRow): string {
  if (row.commissionType === "NONE") return "Sin comisión";
  if (row.commissionType === "PERCENTAGE") {
    return row.commissionValue ? `${row.commissionValue}%` : "—";
  }
  if (row.commissionType === "FIXED_AMOUNT") {
    return row.commissionValue ? `$${row.commissionValue}` : "—";
  }
  return "—";
}

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
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

/* =========================================================
   Página principal
========================================================= */
export default function ConfiguracionSistemaVendedor() {
  /* ---------- estado principal ---------- */
  const [rows, setRows] = useState<SellerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  /* ---------- almacenes ---------- */
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);

  /* ---------- modal crear/editar ---------- */
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SellerRow | null>(null);

  /* ---------- modal ver ---------- */
  const [viewOpen, setViewOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<SellerRow | null>(null);

  /* ---------- modal eliminar ---------- */
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SellerRow | null>(null);

  /* ---------- busy ---------- */
  const [busySave, setBusySave] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const [busyFavorite, setBusyFavorite] = useState<string | null>(null);

  /* ---------- draft ---------- */
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [submitted, setSubmitted] = useState(false);

  /* ---------- carga inicial ---------- */
  async function load() {
    try {
      setLoading(true);
      const data = await sellersApi.list();
      setRows(data);
    } catch (e: any) {
      toast.error(e?.message || "Ocurrió un error al cargar vendedores.");
    } finally {
      setLoading(false);
    }
  }

  async function loadWarehouses() {
    try {
      const data = await apiFetch<WarehouseOption[]>("/warehouses", {
        method: "GET",
        on401: "throw",
      });
      setWarehouses(Array.isArray(data) ? data : []);
    } catch {
      setWarehouses([]);
    }
  }

  useEffect(() => {
    load();
    loadWarehouses();
  }, []);

  /* ---------- filtrado ---------- */
  const filteredRows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.displayName.toLowerCase().includes(s) ||
        r.firstName.toLowerCase().includes(s) ||
        r.lastName.toLowerCase().includes(s) ||
        r.email.toLowerCase().includes(s) ||
        r.documentNumber.toLowerCase().includes(s)
    );
  }, [rows, q]);

  /* ---------- helpers de draft ---------- */
  function setDraftField<K extends keyof typeof EMPTY_DRAFT>(
    key: K,
    value: (typeof EMPTY_DRAFT)[K]
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function toggleWarehouse(id: string) {
    setDraft((prev) => {
      const ids = prev.warehouseIds;
      return {
        ...prev,
        warehouseIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
      };
    });
  }

  /* ---------- abrir crear ---------- */
  function openCreate() {
    setEditTarget(null);
    setDraft(EMPTY_DRAFT);
    setSubmitted(false);
    setEditOpen(true);
  }

  /* ---------- abrir editar ---------- */
  function openEdit(row: SellerRow) {
    setEditTarget(row);
    setDraft({
      firstName: row.firstName,
      lastName: row.lastName,
      displayName: row.displayName,
      documentType: row.documentType,
      documentNumber: row.documentNumber,
      email: row.email,
      phone: row.phone,
      commissionType: row.commissionType,
      commissionValue: row.commissionValue ?? "",
      isActive: row.isActive,
      isFavorite: row.isFavorite,
      notes: row.notes,
      warehouseIds: row.warehouses.map((w) => w.warehouseId),
    });
    setSubmitted(false);
    setEditOpen(true);
  }

  /* ---------- abrir ver ---------- */
  function openView(row: SellerRow) {
    setViewTarget(row);
    setViewOpen(true);
  }

  /* ---------- abrir eliminar ---------- */
  function openDelete(row: SellerRow) {
    setDeleteTarget(row);
    setDeleteOpen(true);
  }

  /* ---------- validación ---------- */
  function validate(): string | null {
    if (!draft.firstName.trim()) return "El nombre es obligatorio.";
    if (!draft.lastName.trim()) return "El apellido es obligatorio.";
    if (draft.commissionType !== "NONE") {
      const v = parseFloat(draft.commissionValue);
      if (!draft.commissionValue.trim() || isNaN(v) || v <= 0) {
        return "El valor de comisión debe ser mayor a 0.";
      }
    }
    return null;
  }

  /* ---------- guardar ---------- */
  async function handleSave() {
    setSubmitted(true);
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    const payload = {
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      displayName: draft.displayName.trim() || undefined,
      documentType: draft.documentType.trim() || undefined,
      documentNumber: draft.documentNumber.trim() || undefined,
      email: draft.email.trim() || undefined,
      phone: draft.phone.trim() || undefined,
      commissionType: draft.commissionType,
      commissionValue:
        draft.commissionType !== "NONE" && draft.commissionValue.trim()
          ? draft.commissionValue.trim()
          : null,
      isActive: draft.isActive,
      isFavorite: draft.isFavorite,
      notes: draft.notes.trim() || undefined,
      warehouseIds: draft.warehouseIds,
    };

    try {
      setBusySave(true);
      if (editTarget) {
        await sellersApi.update(editTarget.id, payload);
        toast.success("Vendedor actualizado.");
      } else {
        await sellersApi.create(payload);
        toast.success("Vendedor creado correctamente.");
      }
      setEditOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Ocurrió un error al guardar.");
    } finally {
      setBusySave(false);
    }
  }

  /* ---------- toggle activo/inactivo ---------- */
  async function handleToggle(row: SellerRow) {
    try {
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, isActive: !r.isActive } : r))
      );
      await sellersApi.toggle(row.id);
      toast.success(row.isActive ? "Vendedor desactivado." : "Vendedor activado.");
      await load();
    } catch (e: any) {
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, isActive: row.isActive } : r))
      );
      toast.error(e?.message || "Ocurrió un error.");
    }
  }

  /* ---------- toggle favorito ---------- */
  async function handleFavorite(row: SellerRow) {
    if (busyFavorite) return;
    const next = !row.isFavorite;
    setBusyFavorite(row.id);
    try {
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, isFavorite: next } : r))
      );
      await sellersApi.setFavorite(row.id, next);
      toast.success(next ? "Marcado como favorito." : "Quitado de favoritos.");
      await load();
    } catch (e: any) {
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, isFavorite: row.isFavorite } : r))
      );
      toast.error(e?.message || "Ocurrió un error.");
    } finally {
      setBusyFavorite(null);
    }
  }

  /* ---------- eliminar ---------- */
  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      setBusyDelete(true);
      await sellersApi.remove(deleteTarget.id);
      toast.success("Vendedor eliminado.");
      setDeleteOpen(false);
      setDeleteTarget(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Ocurrió un error al eliminar.");
    } finally {
      setBusyDelete(false);
    }
  }

  /* ---------- errores de validación en campos individuales ---------- */
  const firstNameError =
    submitted && !draft.firstName.trim() ? "El nombre es obligatorio." : null;
  const lastNameError =
    submitted && !draft.lastName.trim() ? "El apellido es obligatorio." : null;
  const commissionValueError =
    submitted &&
    draft.commissionType !== "NONE" &&
    (!draft.commissionValue.trim() || parseFloat(draft.commissionValue) <= 0)
      ? "El valor debe ser mayor a 0."
      : null;

  /* =========================================================
     RENDER
  ========================================================= */
  return (
    <TPSectionShell
      title="Vendedores"
      subtitle="Gestioná el equipo de vendedores y sus comisiones"
      icon={<Users size={22} />}
    >
      <TPTableWrap>
        {/* ---- header: contador + buscador + botón ---- */}
        <TPTableHeader
          left={
            <span className="text-sm text-muted">
              {filteredRows.length}{" "}
              {filteredRows.length === 1 ? "vendedor" : "vendedores"}
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
                Nuevo vendedor
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
                <TPTh className="hidden md:table-cell">Documento</TPTh>
                <TPTh className="hidden md:table-cell">Email / Teléfono</TPTh>
                <TPTh className="hidden md:table-cell">Comisión</TPTh>
                <TPTh className="hidden md:table-cell">Almacenes</TPTh>
                <TPTh className="hidden md:table-cell">Estado</TPTh>
                <TPTh className="text-right">Acciones</TPTh>
              </tr>
            </TPThead>

            <TPTbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-muted">
                    <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
                    Cargando…
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <TPEmptyRow
                  colSpan={7}
                  text={
                    q
                      ? "No hay resultados para esa búsqueda."
                      : "Todavía no hay vendedores. Creá el primero."
                  }
                />
              ) : (
                filteredRows.map((row) => (
                  <TPTr key={row.id}>
                    {/* Nombre */}
                    <TPTd label="Nombre">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-border bg-primary/10 text-primary">
                          <Users size={14} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-medium text-text truncate">
                              {row.displayName}
                            </span>
                            {row.isFavorite && (
                              <Star
                                size={12}
                                className="shrink-0 fill-yellow-400 text-yellow-400"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </TPTd>

                    {/* Documento */}
                    <TPTd label="Documento" className="hidden md:table-cell">
                      <span className="text-sm text-muted">
                        {row.documentType || row.documentNumber
                          ? `${row.documentType ? row.documentType + " " : ""}${row.documentNumber}`
                          : "—"}
                      </span>
                    </TPTd>

                    {/* Email / Teléfono */}
                    <TPTd label="Email / Teléfono" className="hidden md:table-cell">
                      <div className="text-sm space-y-0.5">
                        <div className="text-text">{row.email || "—"}</div>
                        {row.phone && (
                          <div className="text-muted text-xs">{row.phone}</div>
                        )}
                      </div>
                    </TPTd>

                    {/* Comisión */}
                    <TPTd label="Comisión" className="hidden md:table-cell">
                      <span className="text-sm text-muted">{formatCommission(row)}</span>
                    </TPTd>

                    {/* Almacenes */}
                    <TPTd label="Almacenes" className="hidden md:table-cell">
                      <span className="text-sm text-muted">
                        {row.warehouses.length === 0
                          ? "Todos"
                          : `${row.warehouses.length} asignado${row.warehouses.length > 1 ? "s" : ""}`}
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

                        {/* Favorito */}
                        <button
                          type="button"
                          title={row.isFavorite ? "Quitar favorito" : "Marcar favorito"}
                          onClick={() => handleFavorite(row)}
                          disabled={busyFavorite === row.id}
                          className="tp-btn-secondary h-9 w-9 !p-0 grid place-items-center shrink-0"
                        >
                          <Star
                            size={15}
                            className={
                              row.isFavorite
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted"
                            }
                          />
                        </button>

                        {/* Ver */}
                        <button
                          type="button"
                          title="Ver detalle"
                          onClick={() => openView(row)}
                          className="tp-btn-secondary h-9 w-9 !p-0 grid place-items-center shrink-0"
                        >
                          <Eye size={15} />
                        </button>

                        {/* Editar */}
                        <button
                          type="button"
                          title="Editar"
                          onClick={() => openEdit(row)}
                          className="tp-btn-secondary h-9 w-9 !p-0 grid place-items-center shrink-0"
                        >
                          <Pencil size={15} />
                        </button>

                        {/* Toggle activo */}
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

                        {/* Eliminar */}
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
        title={editTarget ? "Editar vendedor" : "Nuevo vendedor"}
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
            >
              Cancelar
            </TPButton>
            <TPButton variant="primary" onClick={handleSave} loading={busySave}>
              Guardar
            </TPButton>
          </>
        }
      >
        <div className="space-y-6">
          {/* ---- Sección: Datos personales ---- */}
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
              Datos personales
            </div>
            <div className="space-y-4">
              {/* Nombre */}
              <TPField
                label="Nombre"
                required
                error={firstNameError}
              >
                <TPInput
                  value={draft.firstName}
                  onChange={(v) => setDraftField("firstName", v)}
                  placeholder="Ej: Juan"
                  disabled={busySave}
                  data-tp-autofocus="1"
                />
              </TPField>

              {/* Apellido */}
              <TPField label="Apellido" required error={lastNameError}>
                <TPInput
                  value={draft.lastName}
                  onChange={(v) => setDraftField("lastName", v)}
                  placeholder="Ej: Pérez"
                  disabled={busySave}
                />
              </TPField>

              {/* Nombre para mostrar */}
              <TPField
                label="Nombre para mostrar"
                hint="Por defecto: Nombre + Apellido"
              >
                <TPInput
                  value={draft.displayName}
                  onChange={(v) => setDraftField("displayName", v)}
                  placeholder="Ej: Juancho"
                  disabled={busySave}
                />
              </TPField>

              {/* Tipo y número de documento */}
              <div className="grid grid-cols-2 gap-3">
                <TPField label="Tipo de documento">
                  <TPInput
                    value={draft.documentType}
                    onChange={(v) => setDraftField("documentType", v)}
                    placeholder="Ej: DNI"
                    disabled={busySave}
                  />
                </TPField>

                <TPField label="Número de documento">
                  <TPInput
                    value={draft.documentNumber}
                    onChange={(v) => setDraftField("documentNumber", v)}
                    placeholder="Ej: 30123456"
                    disabled={busySave}
                  />
                </TPField>
              </div>

              {/* Email */}
              <TPField label="Email">
                <TPInput
                  value={draft.email}
                  onChange={(v) => setDraftField("email", v)}
                  type="email"
                  placeholder="Ej: juan@example.com"
                  disabled={busySave}
                />
              </TPField>

              {/* Teléfono */}
              <TPField label="Teléfono">
                <TPInput
                  value={draft.phone}
                  onChange={(v) => setDraftField("phone", v)}
                  placeholder="Ej: +54 9 11 1234-5678"
                  disabled={busySave}
                />
              </TPField>
            </div>
          </div>

          {/* ---- Sección: Comisión ---- */}
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
              Comisión
            </div>
            <div className="space-y-4">
              {/* Tipo de comisión */}
              <TPField label="Tipo de comisión">
                <select
                  value={draft.commissionType}
                  onChange={(e) =>
                    setDraftField("commissionType", e.target.value as CommissionType)
                  }
                  disabled={busySave}
                  className="tp-select w-full"
                >
                  {(Object.keys(COMMISSION_LABELS) as CommissionType[]).map((key) => (
                    <option key={key} value={key}>
                      {COMMISSION_LABELS[key]}
                    </option>
                  ))}
                </select>
              </TPField>

              {/* Valor (solo si hay comisión) */}
              {draft.commissionType !== "NONE" && (
                <TPField
                  label={
                    draft.commissionType === "PERCENTAGE"
                      ? "Porcentaje (%)"
                      : "Monto fijo ($)"
                  }
                  required
                  error={commissionValueError}
                >
                  <TPInput
                    value={draft.commissionValue}
                    onChange={(v) => setDraftField("commissionValue", v)}
                    type="number"
                    placeholder={
                      draft.commissionType === "PERCENTAGE" ? "Ej: 5" : "Ej: 1000"
                    }
                    disabled={busySave}
                  />
                </TPField>
              )}
            </div>
          </div>

          {/* ---- Sección: Almacenes asignados ---- */}
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
              Almacenes asignados
            </div>
            <div className="mb-3 text-xs text-muted">
              {draft.warehouseIds.length === 0
                ? "Todos los almacenes (ninguno seleccionado)"
                : `${draft.warehouseIds.length} almacén${draft.warehouseIds.length > 1 ? "es" : ""} seleccionado${draft.warehouseIds.length > 1 ? "s" : ""}`}
            </div>

            {warehouses.length === 0 ? (
              <div className="text-sm text-muted italic">
                No hay almacenes disponibles.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto tp-scroll rounded-xl border border-border p-3">
                {warehouses.map((wh) => (
                  <TPCheckbox
                    key={wh.id}
                    checked={draft.warehouseIds.includes(wh.id)}
                    onChange={() => toggleWarehouse(wh.id)}
                    disabled={busySave}
                    label={
                      <span className="text-sm text-text">
                        {wh.name}
                        {!wh.isActive && (
                          <span className="ml-1 text-xs text-muted">(inactivo)</span>
                        )}
                      </span>
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* ---- Sección: General (solo modo editar) ---- */}
          {editTarget && (
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                General
              </div>
              <div className="space-y-3">
                <TPCheckbox
                  checked={draft.isFavorite}
                  onChange={(v) => setDraftField("isFavorite", v)}
                  disabled={busySave}
                  label={<span className="text-sm text-text">Marcar como favorito</span>}
                />

                <TPCheckbox
                  checked={draft.isActive}
                  onChange={(v) => setDraftField("isActive", v)}
                  disabled={busySave}
                  label={<span className="text-sm text-text">Vendedor activo</span>}
                />

                <TPField label="Notas">
                  <TPTextarea
                    value={draft.notes}
                    onChange={(v) => setDraftField("notes", v)}
                    placeholder="Notas adicionales sobre el vendedor…"
                    disabled={busySave}
                    minH={80}
                  />
                </TPField>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* =========================================================
          MODAL VER DETALLE
      ========================================================= */}
      <Modal
        open={viewOpen}
        title={viewTarget?.displayName ?? "Detalle de vendedor"}
        maxWidth="sm"
        onClose={() => setViewOpen(false)}
        footer={
          <TPButton variant="secondary" onClick={() => setViewOpen(false)}>
            Cerrar
          </TPButton>
        }
      >
        {viewTarget && (
          <div className="space-y-0 text-sm divide-y divide-border">
            <div className="flex justify-between gap-4 py-2">
              <span className="text-muted font-medium">Nombre completo</span>
              <span className="text-text text-right">
                {viewTarget.displayName}
                {viewTarget.isFavorite && (
                  <Star
                    size={12}
                    className="inline ml-1 fill-yellow-400 text-yellow-400"
                  />
                )}
              </span>
            </div>

            <div className="flex justify-between gap-4 py-2">
              <span className="text-muted font-medium">Documento</span>
              <span className="text-text text-right">
                {viewTarget.documentType || viewTarget.documentNumber
                  ? `${viewTarget.documentType ? viewTarget.documentType + " " : ""}${viewTarget.documentNumber}`
                  : "—"}
              </span>
            </div>

            <div className="flex justify-between gap-4 py-2">
              <span className="text-muted font-medium">Email</span>
              <span className="text-text text-right">{viewTarget.email || "—"}</span>
            </div>

            <div className="flex justify-between gap-4 py-2">
              <span className="text-muted font-medium">Teléfono</span>
              <span className="text-text text-right">{viewTarget.phone || "—"}</span>
            </div>

            <div className="flex justify-between gap-4 py-2">
              <span className="text-muted font-medium">Comisión</span>
              <span className="text-text text-right">{formatCommission(viewTarget)}</span>
            </div>

            <div className="flex justify-between gap-4 py-2">
              <span className="text-muted font-medium">Almacenes asignados</span>
              <span className="text-text text-right">
                {viewTarget.warehouses.length === 0 ? (
                  <span className="text-muted italic">Todos</span>
                ) : (
                  viewTarget.warehouses.map((w) => w.warehouse.name).join(", ")
                )}
              </span>
            </div>

            <div className="flex justify-between gap-4 py-2">
              <span className="text-muted font-medium">Estado</span>
              <StatusPill active={viewTarget.isActive} />
            </div>

            {viewTarget.notes && (
              <div className="flex flex-col gap-1 py-2">
                <span className="text-muted font-medium">Notas</span>
                <span className="text-text">{viewTarget.notes}</span>
              </div>
            )}

            <div className="flex justify-between gap-4 py-2">
              <span className="text-muted font-medium">Creado</span>
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
        title={`Eliminar "${deleteTarget?.displayName ?? ""}"`}
        description="¿Estás seguro que querés eliminar este vendedor? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        busy={busyDelete}
        onClose={() => {
          if (!busyDelete) {
            setDeleteOpen(false);
            setDeleteTarget(null);
          }
        }}
        onConfirm={handleDelete}
      />
    </TPSectionShell>
  );
}
