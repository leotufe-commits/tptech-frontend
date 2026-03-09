// src/pages/configuracion-sistema/ConfiguracionSistemaImpuestos.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Eye,
  Trash2,
  ShieldBan,
  ShieldCheck,
  Copy,
  Loader2,
  Receipt,
  AlertTriangle,
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
import {
  taxesApi,
  type TaxRow,
  type TaxType,
  type TaxCalculationType,
  type TaxApplyOn,
  type TaxPayload,
} from "../../services/taxes";

/* =========================================================
   Label maps
========================================================= */
const TAX_TYPE_LABELS: Record<TaxType, string> = {
  IVA: "IVA",
  INTERNAL: "Impuesto interno",
  PERCEPTION: "Percepción",
  RETENTION: "Retención",
  OTHER: "Otro",
};

const CALC_TYPE_LABELS: Record<TaxCalculationType, string> = {
  PERCENTAGE: "Porcentaje",
  FIXED_AMOUNT: "Monto fijo",
  PERCENTAGE_PLUS_FIXED: "Porcentaje + Monto fijo",
};

const APPLY_ON_LABELS: Record<TaxApplyOn, string> = {
  TOTAL: "Total",
  METAL: "Solo metal",
  HECHURA: "Solo hechura",
  METAL_Y_HECHURA: "Metal + Hechura",
  SUBTOTAL_AFTER_DISCOUNT: "Subtotal (después del descuento)",
  SUBTOTAL_BEFORE_DISCOUNT: "Subtotal (antes del descuento)",
};

/* =========================================================
   Draft vacío
========================================================= */
const EMPTY_DRAFT = {
  name: "",
  code: "",
  taxType: "IVA" as TaxType,
  calculationType: "PERCENTAGE" as TaxCalculationType,
  rate: "",
  fixedAmount: "",
  applyOn: "TOTAL" as TaxApplyOn,
  includedInPrice: false,
  validFrom: "",
  validTo: "",
  isActive: true,
  notes: "",
};

type Draft = typeof EMPTY_DRAFT;

/* =========================================================
   Helpers
========================================================= */
function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
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

function isExpired(validTo: string | null): boolean {
  if (!validTo) return false;
  try {
    return new Date(validTo) < new Date();
  } catch {
    return false;
  }
}

function formatISOtoDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch {
    return "";
  }
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
      {active ? "Activa" : "Inactiva"}
    </span>
  );
}

/* =========================================================
   Badge de tipo de tributo
========================================================= */
const TAX_TYPE_COLORS: Record<TaxType, string> = {
  IVA: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  INTERNAL: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  PERCEPTION: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  RETENTION: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  OTHER: "bg-surface2 text-muted",
};

function TaxTypeBadge({ taxType }: { taxType: TaxType }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TAX_TYPE_COLORS[taxType]
      )}
    >
      {TAX_TYPE_LABELS[taxType]}
    </span>
  );
}

/* =========================================================
   Badge de vencido
========================================================= */
function ExpiredBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
      <AlertTriangle size={11} />
      Vencido
    </span>
  );
}

/* =========================================================
   Texto de cálculo para la tabla
========================================================= */
function CalcDisplay({
  calculationType,
  rate,
  fixedAmount,
}: {
  calculationType: TaxCalculationType;
  rate: string | null;
  fixedAmount: string | null;
}) {
  const parts: string[] = [];
  if (
    (calculationType === "PERCENTAGE" || calculationType === "PERCENTAGE_PLUS_FIXED") &&
    rate
  ) {
    parts.push(`${parseFloat(rate).toLocaleString("es-AR")}%`);
  }
  if (
    (calculationType === "FIXED_AMOUNT" || calculationType === "PERCENTAGE_PLUS_FIXED") &&
    fixedAmount
  ) {
    parts.push(`$${parseFloat(fixedAmount).toLocaleString("es-AR")}`);
  }
  return (
    <span className="text-sm text-text">
      {parts.length > 0 ? parts.join(" + ") : "—"}
    </span>
  );
}

/* =========================================================
   Sección del modal con título separador
========================================================= */
function ModalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          {title}
        </span>
        <div className="flex-1 border-t border-border" />
      </div>
      {children}
    </div>
  );
}

/* =========================================================
   Fila detail en modal ver
========================================================= */
function DetailRow({
  label,
  children,
  borderBottom = true,
}: {
  label: string;
  children: React.ReactNode;
  borderBottom?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-4 py-2",
        borderBottom && "border-b border-border"
      )}
    >
      <span className="text-muted font-medium shrink-0">{label}</span>
      <span className="text-text text-right break-words min-w-0">{children}</span>
    </div>
  );
}

/* =========================================================
   Validación
========================================================= */
type FormErrors = {
  name?: string;
  rate?: string;
  fixedAmount?: string;
};

function validate(draft: Draft): FormErrors {
  const errors: FormErrors = {};
  if (!draft.name.trim()) {
    errors.name = "El nombre es obligatorio.";
  }
  if (
    draft.calculationType === "PERCENTAGE" ||
    draft.calculationType === "PERCENTAGE_PLUS_FIXED"
  ) {
    const v = parseFloat(draft.rate);
    if (!draft.rate.trim() || isNaN(v) || v <= 0) {
      errors.rate = "El porcentaje es obligatorio y debe ser mayor a 0.";
    }
  }
  if (
    draft.calculationType === "FIXED_AMOUNT" ||
    draft.calculationType === "PERCENTAGE_PLUS_FIXED"
  ) {
    const v = parseFloat(draft.fixedAmount);
    if (!draft.fixedAmount.trim() || isNaN(v) || v <= 0) {
      errors.fixedAmount = "El monto fijo es obligatorio y debe ser mayor a 0.";
    }
  }
  return errors;
}

/* =========================================================
   Página principal
========================================================= */
export default function ConfiguracionSistemaImpuestos() {
  /* ---- estado principal ---- */
  const [rows, setRows] = useState<TaxRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  /* ---- modal editar/crear ---- */
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TaxRow | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [submitted, setSubmitted] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  /* ---- modal ver ---- */
  const [viewOpen, setViewOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<TaxRow | null>(null);

  /* ---- modal eliminar ---- */
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TaxRow | null>(null);

  /* ---- busy ---- */
  const [busySave, setBusySave] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const [cloningId, setCloningId] = useState<string | null>(null);

  /* ---- carga inicial ---- */
  async function load() {
    try {
      setLoading(true);
      const data = await taxesApi.list();
      setRows(data);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo cargar la lista de impuestos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  /* ---- filtrado ---- */
  const filteredRows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(s) ||
        r.code.toLowerCase().includes(s) ||
        TAX_TYPE_LABELS[r.taxType].toLowerCase().includes(s)
    );
  }, [rows, q]);

  /* ---- helpers draft ---- */
  function patchDraft(patch: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  /* ---- abrir modal crear ---- */
  function openCreate() {
    setEditTarget(null);
    setDraft(EMPTY_DRAFT);
    setSubmitted(false);
    setFormErrors({});
    setEditOpen(true);
  }

  /* ---- abrir modal editar ---- */
  function openEdit(row: TaxRow) {
    setEditTarget(row);
    setDraft({
      name: row.name,
      code: row.code,
      taxType: row.taxType,
      calculationType: row.calculationType,
      rate: row.rate != null ? String(parseFloat(row.rate)) : "",
      fixedAmount: row.fixedAmount != null ? String(parseFloat(row.fixedAmount)) : "",
      applyOn: row.applyOn,
      includedInPrice: row.includedInPrice,
      validFrom: formatISOtoDateInput(row.validFrom),
      validTo: formatISOtoDateInput(row.validTo),
      isActive: row.isActive,
      notes: row.notes ?? "",
    });
    setSubmitted(false);
    setFormErrors({});
    setEditOpen(true);
  }

  /* ---- abrir modal ver ---- */
  function openView(row: TaxRow) {
    setViewTarget(row);
    setViewOpen(true);
  }

  /* ---- abrir modal eliminar ---- */
  function openDelete(row: TaxRow) {
    setDeleteTarget(row);
    setDeleteOpen(true);
  }

  /* ---- guardar ---- */
  async function handleSave() {
    setSubmitted(true);
    const errors = validate(draft);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const payload: TaxPayload = {
      name: draft.name.trim(),
      code: draft.code.trim() || undefined,
      taxType: draft.taxType,
      calculationType: draft.calculationType,
      rate:
        draft.calculationType === "PERCENTAGE" ||
        draft.calculationType === "PERCENTAGE_PLUS_FIXED"
          ? parseFloat(draft.rate)
          : null,
      fixedAmount:
        draft.calculationType === "FIXED_AMOUNT" ||
        draft.calculationType === "PERCENTAGE_PLUS_FIXED"
          ? parseFloat(draft.fixedAmount)
          : null,
      applyOn: draft.applyOn,
      includedInPrice: draft.includedInPrice,
      validFrom: draft.validFrom || null,
      validTo: draft.validTo || null,
      isActive: draft.isActive,
      notes: draft.notes.trim(),
    };

    try {
      setBusySave(true);
      if (editTarget) {
        await taxesApi.update(editTarget.id, payload);
        toast.success("Impuesto actualizado.");
      } else {
        await taxesApi.create(payload);
        toast.success("Impuesto creado correctamente.");
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
  async function handleToggle(row: TaxRow) {
    try {
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, isActive: !r.isActive } : r))
      );
      await taxesApi.toggle(row.id);
      toast.success(row.isActive ? "Impuesto desactivado." : "Impuesto activado.");
      await load();
    } catch (e: any) {
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, isActive: row.isActive } : r))
      );
      toast.error(e?.message || "No se pudo cambiar el estado.");
    }
  }

  /* ---- clonar ---- */
  async function handleClone(row: TaxRow) {
    try {
      setCloningId(row.id);
      await taxesApi.clone(row.id);
      toast.success("Impuesto clonado. Revisá y activá la copia.");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo clonar el impuesto.");
    } finally {
      setCloningId(null);
    }
  }

  /* ---- eliminar ---- */
  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      setBusyDelete(true);
      await taxesApi.remove(deleteTarget.id);
      toast.success("Impuesto eliminado.");
      setDeleteOpen(false);
      setDeleteTarget(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo eliminar el impuesto.");
    } finally {
      setBusyDelete(false);
    }
  }

  /* ---- mostrar tasa/monto en vista ---- */
  function rateDisplay(row: TaxRow): string {
    const parts: string[] = [];
    if (
      (row.calculationType === "PERCENTAGE" ||
        row.calculationType === "PERCENTAGE_PLUS_FIXED") &&
      row.rate
    ) {
      parts.push(`${parseFloat(row.rate).toLocaleString("es-AR")}%`);
    }
    if (
      (row.calculationType === "FIXED_AMOUNT" ||
        row.calculationType === "PERCENTAGE_PLUS_FIXED") &&
      row.fixedAmount
    ) {
      parts.push(`$${parseFloat(row.fixedAmount).toLocaleString("es-AR")}`);
    }
    return parts.length > 0 ? parts.join(" + ") : "—";
  }

  /* ---- errores en tiempo real ---- */
  const errors = submitted ? formErrors : {};

  /* =========================================================
     RENDER
  ========================================================= */
  return (
    <TPSectionShell
      title="Impuestos y Tributos"
      subtitle="Configurá los impuestos aplicables a las ventas"
      icon={<Receipt size={22} />}
    >
      <TPTableWrap>
        {/* ---- header ---- */}
        <TPTableHeader
          left={
            <span className="text-sm text-muted">
              {filteredRows.length}{" "}
              {filteredRows.length === 1 ? "impuesto" : "impuestos"}
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
                Nuevo impuesto
              </TPButton>
            </div>
          }
        />

        {/* ---- tabla ---- */}
        <TPTableXScroll>
          <TPTableElBase responsive="stack">
            <TPThead>
              <tr>
                <TPTh>Nombre / Código</TPTh>
                <TPTh className="hidden md:table-cell">Tipo</TPTh>
                <TPTh className="hidden md:table-cell">Cálculo</TPTh>
                <TPTh className="hidden lg:table-cell">Base</TPTh>
                <TPTh className="hidden lg:table-cell">Vigencia</TPTh>
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
                      : "Todavía no hay impuestos configurados. Creá el primero."
                  }
                />
              ) : (
                filteredRows.map((row) => (
                  <TPTr key={row.id}>
                    {/* Nombre / Código */}
                    <TPTd label="Nombre / Código">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-text truncate">
                          {row.name}
                        </div>
                        {row.code && (
                          <div className="text-xs text-muted font-mono mt-0.5">
                            {row.code}
                          </div>
                        )}
                      </div>
                    </TPTd>

                    {/* Tipo */}
                    <TPTd label="Tipo" className="hidden md:table-cell">
                      <TaxTypeBadge taxType={row.taxType} />
                    </TPTd>

                    {/* Cálculo */}
                    <TPTd label="Cálculo" className="hidden md:table-cell">
                      <div className="space-y-0.5">
                        <div className="text-xs text-muted">
                          {CALC_TYPE_LABELS[row.calculationType]}
                        </div>
                        <CalcDisplay
                          calculationType={row.calculationType}
                          rate={row.rate}
                          fixedAmount={row.fixedAmount}
                        />
                      </div>
                    </TPTd>

                    {/* Base */}
                    <TPTd label="Base" className="hidden lg:table-cell">
                      <span className="text-sm text-muted truncate block max-w-[160px]">
                        {APPLY_ON_LABELS[row.applyOn]}
                      </span>
                    </TPTd>

                    {/* Vigencia */}
                    <TPTd label="Vigencia" className="hidden lg:table-cell">
                      <div className="space-y-1">
                        {row.validFrom || row.validTo ? (
                          <div className="text-xs text-muted whitespace-nowrap">
                            {formatDate(row.validFrom)} — {row.validTo ? formatDate(row.validTo) : "Sin vencimiento"}
                          </div>
                        ) : (
                          <span className="text-xs text-muted">Sin vencimiento</span>
                        )}
                        {isExpired(row.validTo) && <ExpiredBadge />}
                      </div>
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
                        {/* tipo en mobile */}
                        <span className="md:hidden">
                          <TaxTypeBadge taxType={row.taxType} />
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
                          title="Clonar"
                          disabled={cloningId === row.id}
                          onClick={() => handleClone(row)}
                          className="tp-btn-secondary h-9 w-9 !p-0 grid place-items-center shrink-0 disabled:opacity-50"
                        >
                          {cloningId === row.id ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <Copy size={15} />
                          )}
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
        title={editTarget ? "Editar impuesto" : "Nuevo impuesto"}
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
        <div className="space-y-6">
          {/* ---- Sección: Identificación ---- */}
          <ModalSection title="Identificación">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Nombre */}
              <TPField
                label="Nombre"
                required
                error={errors.name}
                className="sm:col-span-2"
              >
                <TPInput
                  value={draft.name}
                  onChange={(v) => patchDraft({ name: v })}
                  placeholder="Ej: IVA 21%"
                  disabled={busySave}
                  data-tp-autofocus="1"
                />
              </TPField>

              {/* Tipo de tributo */}
              <TPField label="Tipo de tributo" required>
                <select
                  value={draft.taxType}
                  onChange={(e) =>
                    patchDraft({ taxType: e.target.value as TaxType })
                  }
                  disabled={busySave}
                  className="tp-select w-full"
                >
                  {(Object.keys(TAX_TYPE_LABELS) as TaxType[]).map((k) => (
                    <option key={k} value={k}>
                      {TAX_TYPE_LABELS[k]}
                    </option>
                  ))}
                </select>
              </TPField>

              {/* Código */}
              <TPField
                label="Código"
                hint="Se genera automáticamente si lo dejás vacío."
              >
                <TPInput
                  value={draft.code}
                  onChange={(v) => patchDraft({ code: v })}
                  placeholder="Ej: IVA21"
                  disabled={busySave}
                />
              </TPField>
            </div>
          </ModalSection>

          {/* ---- Sección: Cálculo ---- */}
          <ModalSection title="Cálculo">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Modo de cálculo */}
              <TPField label="Modo de cálculo" required className="sm:col-span-2">
                <select
                  value={draft.calculationType}
                  onChange={(e) =>
                    patchDraft({ calculationType: e.target.value as TaxCalculationType })
                  }
                  disabled={busySave}
                  className="tp-select w-full"
                >
                  {(Object.keys(CALC_TYPE_LABELS) as TaxCalculationType[]).map((k) => (
                    <option key={k} value={k}>
                      {CALC_TYPE_LABELS[k]}
                    </option>
                  ))}
                </select>
              </TPField>

              {/* Porcentaje — solo si aplica */}
              {(draft.calculationType === "PERCENTAGE" ||
                draft.calculationType === "PERCENTAGE_PLUS_FIXED") && (
                <TPField label="Porcentaje (%)" required error={errors.rate}>
                  <TPInput
                    value={draft.rate}
                    onChange={(v) => patchDraft({ rate: v })}
                    type="number"
                    placeholder="Ej: 21"
                    min="0"
                    step="0.01"
                    disabled={busySave}
                  />
                </TPField>
              )}

              {/* Monto fijo — solo si aplica */}
              {(draft.calculationType === "FIXED_AMOUNT" ||
                draft.calculationType === "PERCENTAGE_PLUS_FIXED") && (
                <TPField label="Monto fijo ($)" required error={errors.fixedAmount}>
                  <TPInput
                    value={draft.fixedAmount}
                    onChange={(v) => patchDraft({ fixedAmount: v })}
                    type="number"
                    placeholder="Ej: 100"
                    min="0"
                    step="0.01"
                    disabled={busySave}
                  />
                </TPField>
              )}

              {/* Base de aplicación */}
              <TPField
                label="Base de aplicación"
                required
                className={
                  draft.calculationType === "PERCENTAGE_PLUS_FIXED"
                    ? "sm:col-span-2"
                    : ""
                }
              >
                <select
                  value={draft.applyOn}
                  onChange={(e) =>
                    patchDraft({ applyOn: e.target.value as TaxApplyOn })
                  }
                  disabled={busySave}
                  className="tp-select w-full"
                >
                  {(Object.keys(APPLY_ON_LABELS) as TaxApplyOn[]).map((k) => (
                    <option key={k} value={k}>
                      {APPLY_ON_LABELS[k]}
                    </option>
                  ))}
                </select>
              </TPField>

              {/* Incluido en el precio */}
              <div className="sm:col-span-2 mt-1">
                <TPCheckbox
                  checked={draft.includedInPrice}
                  onChange={(v) => patchDraft({ includedInPrice: v })}
                  disabled={busySave}
                  label={
                    <span className="text-sm text-text">
                      Incluido en el precio (no se suma al total)
                    </span>
                  }
                />
              </div>
            </div>
          </ModalSection>

          {/* ---- Sección: Vigencia ---- */}
          <ModalSection title="Vigencia">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TPField label="Válido desde">
                <input
                  type="date"
                  value={draft.validFrom}
                  onChange={(e) => patchDraft({ validFrom: e.target.value })}
                  disabled={busySave}
                  className="tp-select w-full"
                />
              </TPField>
              <TPField label="Válido hasta">
                <input
                  type="date"
                  value={draft.validTo}
                  onChange={(e) => patchDraft({ validTo: e.target.value })}
                  disabled={busySave}
                  className="tp-select w-full"
                />
              </TPField>
            </div>
          </ModalSection>

          {/* ---- Sección: General (solo en edición) ---- */}
          {editTarget && (
            <ModalSection title="General">
              <div className="space-y-3">
                <TPCheckbox
                  checked={draft.isActive}
                  onChange={(v) => patchDraft({ isActive: v })}
                  disabled={busySave}
                  label={
                    <span className="text-sm text-text">Impuesto activo</span>
                  }
                />
                <TPField label="Notas">
                  <TPTextarea
                    value={draft.notes}
                    onChange={(v) => patchDraft({ notes: v })}
                    placeholder="Notas internas opcionales…"
                    disabled={busySave}
                    minH={80}
                  />
                </TPField>
              </div>
            </ModalSection>
          )}
        </div>
      </Modal>

      {/* =========================================================
          MODAL VER DETALLE
      ========================================================= */}
      <Modal
        open={viewOpen}
        title={viewTarget?.name ?? "Detalle de impuesto"}
        subtitle={viewTarget ? TAX_TYPE_LABELS[viewTarget.taxType] : undefined}
        maxWidth="sm"
        onClose={() => setViewOpen(false)}
        footer={
          <TPButton variant="secondary" onClick={() => setViewOpen(false)}>
            Cerrar
          </TPButton>
        }
      >
        {viewTarget && (
          <div className="space-y-0 text-sm">
            <DetailRow label="Nombre">{viewTarget.name}</DetailRow>
            <DetailRow label="Código">
              {viewTarget.code ? (
                <span className="font-mono">{viewTarget.code}</span>
              ) : (
                <span className="text-muted italic">Sin código</span>
              )}
            </DetailRow>
            <DetailRow label="Tipo de tributo">
              <TaxTypeBadge taxType={viewTarget.taxType} />
            </DetailRow>
            <DetailRow label="Modo de cálculo">
              {CALC_TYPE_LABELS[viewTarget.calculationType]}
            </DetailRow>
            <DetailRow label="Tasa / Monto">{rateDisplay(viewTarget)}</DetailRow>
            <DetailRow label="Base de aplicación">
              {APPLY_ON_LABELS[viewTarget.applyOn]}
            </DetailRow>
            <DetailRow label="Incluido en precio">
              {viewTarget.includedInPrice ? "Sí" : "No"}
            </DetailRow>
            <DetailRow label="Válido desde">
              {viewTarget.validFrom ? formatDate(viewTarget.validFrom) : <span className="text-muted italic">Sin fecha</span>}
            </DetailRow>
            <DetailRow label="Válido hasta">
              <div className="flex items-center gap-2 justify-end flex-wrap">
                {viewTarget.validTo ? (
                  <>
                    <span>{formatDate(viewTarget.validTo)}</span>
                    {isExpired(viewTarget.validTo) && <ExpiredBadge />}
                  </>
                ) : (
                  <span className="text-muted italic">Sin vencimiento</span>
                )}
              </div>
            </DetailRow>
            <DetailRow label="Estado">
              <StatusPill active={viewTarget.isActive} />
            </DetailRow>
            {viewTarget.notes && (
              <div className="flex flex-col gap-1 py-2 border-b border-border">
                <span className="text-muted font-medium">Notas</span>
                <span className="text-text">{viewTarget.notes}</span>
              </div>
            )}
            <DetailRow label="Fecha de creación" borderBottom={false}>
              {formatDate(viewTarget.createdAt)}
            </DetailRow>
          </div>
        )}
      </Modal>

      {/* =========================================================
          CONFIRM DELETE
      ========================================================= */}
      <ConfirmDeleteDialog
        open={deleteOpen}
        title={`Eliminar "${deleteTarget?.name ?? ""}"`}
        description="¿Estás seguro que querés eliminar este impuesto? Esta acción no se puede deshacer."
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
