// src/pages/configuracion-sistema/ConfiguracionSistemaPagos.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Eye,
  Trash2,
  ShieldBan,
  ShieldCheck,
  Loader2,
  Copy,
  Star,
  CreditCard,
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
  paymentsApi,
  type PaymentMethodRow,
  type PaymentMethodType,
  type PaymentAdjustmentType,
} from "../../services/payments";

/* =========================================================
   LABEL MAPS
========================================================= */
const PM_TYPE_LABELS: Record<PaymentMethodType, string> = {
  CASH: "Efectivo",
  DEBIT_CARD: "Tarjeta de débito",
  CREDIT_CARD: "Tarjeta de crédito",
  TRANSFER: "Transferencia",
  QR: "QR / Billetera virtual",
  OTHER: "Otro",
};

const ADJ_TYPE_LABELS: Record<PaymentAdjustmentType, string> = {
  NONE: "Sin ajuste",
  PERCENTAGE: "Porcentaje",
  FIXED_AMOUNT: "Monto fijo",
};

const PM_TYPE_COLORS: Record<PaymentMethodType, string> = {
  CASH: "bg-green-500/15 text-green-700",
  DEBIT_CARD: "bg-blue-500/15 text-blue-700",
  CREDIT_CARD: "bg-purple-500/15 text-purple-700",
  TRANSFER: "bg-cyan-500/15 text-cyan-700",
  QR: "bg-orange-500/15 text-orange-700",
  OTHER: "bg-surface2 text-muted",
};

/* =========================================================
   DRAFT TYPE
========================================================= */
type DraftInstallmentPlan = {
  id?: string;
  installments: string;
  interestRate: string;
  isActive: boolean;
};

const EMPTY_DRAFT = {
  name: "",
  code: "",
  type: "CASH" as PaymentMethodType,
  adjustmentType: "NONE" as PaymentAdjustmentType,
  adjustmentValue: "",
  isFavorite: false,
  isActive: true,
  notes: "",
  installmentPlans: [] as DraftInstallmentPlan[],
};

/* =========================================================
   HELPERS
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

function formatAdjustment(
  adjustmentType: PaymentAdjustmentType,
  adjustmentValue: string | null
): React.ReactNode {
  if (adjustmentType === "NONE" || adjustmentValue === null || adjustmentValue === "") {
    return <span className="text-muted text-xs">Sin ajuste</span>;
  }

  const num = parseFloat(adjustmentValue);
  if (isNaN(num)) return <span className="text-muted text-xs">Sin ajuste</span>;

  const isPositive = num > 0;
  const isNegative = num < 0;

  if (adjustmentType === "PERCENTAGE") {
    const label = isPositive ? `+${num}%` : `${num}%`;
    return (
      <span
        className={cn(
          "text-xs font-medium",
          isPositive ? "text-amber-600" : isNegative ? "text-green-600" : "text-muted"
        )}
      >
        {label}
      </span>
    );
  }

  if (adjustmentType === "FIXED_AMOUNT") {
    const label = isPositive ? `+$${num}` : `$${num}`;
    return (
      <span
        className={cn(
          "text-xs font-medium",
          isPositive ? "text-amber-600" : isNegative ? "text-green-600" : "text-muted"
        )}
      >
        {label}
      </span>
    );
  }

  return <span className="text-muted text-xs">Sin ajuste</span>;
}

/* =========================================================
   STATUS PILL
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
   TYPE BADGE
========================================================= */
function TypeBadge({ type }: { type: PaymentMethodType }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        PM_TYPE_COLORS[type]
      )}
    >
      {PM_TYPE_LABELS[type]}
    </span>
  );
}

/* =========================================================
   MAIN PAGE
========================================================= */
export default function ConfiguracionSistemaPagos() {
  /* ---------- estado principal ---------- */
  const [rows, setRows] = useState<PaymentMethodRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  /* ---------- modal editar/crear ---------- */
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PaymentMethodRow | null>(null);

  /* ---------- modal ver ---------- */
  const [viewOpen, setViewOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<PaymentMethodRow | null>(null);

  /* ---------- modal eliminar ---------- */
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PaymentMethodRow | null>(null);

  /* ---------- busy ---------- */
  const [busySave, setBusySave] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const [busyCloningId, setBusyCloningId] = useState<string | null>(null);

  /* ---------- validación ---------- */
  const [submitted, setSubmitted] = useState(false);

  /* ---------- draft ---------- */
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT });

  /* ---------- cuotas toggle ---------- */
  const [allowsInstallments, setAllowsInstallments] = useState(false);

  /* ---------- carga inicial ---------- */
  async function load() {
    try {
      setLoading(true);
      const data = await paymentsApi.list();
      setRows(data);
    } catch (e: any) {
      toast.error(e?.message || "Ocurrió un error al cargar los medios de pago.");
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
        r.code.toLowerCase().includes(s) ||
        PM_TYPE_LABELS[r.type].toLowerCase().includes(s)
    );
  }, [rows, q]);

  /* ---------- helpers de draft ---------- */
  function setDraftField<K extends keyof typeof EMPTY_DRAFT>(
    key: K,
    value: (typeof EMPTY_DRAFT)[K]
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  /* ---------- abrir modal crear ---------- */
  function openCreate() {
    setEditTarget(null);
    setDraft({ ...EMPTY_DRAFT });
    setAllowsInstallments(false);
    setSubmitted(false);
    setEditOpen(true);
  }

  /* ---------- abrir modal editar ---------- */
  function openEdit(row: PaymentMethodRow) {
    setEditTarget(row);
    const plans: DraftInstallmentPlan[] = (row.installmentPlans ?? []).map((p) => ({
      id: p.id,
      installments: String(p.installments),
      interestRate: p.interestRate,
      isActive: p.isActive,
    }));
    setDraft({
      name: row.name,
      code: row.code,
      type: row.type,
      adjustmentType: row.adjustmentType,
      adjustmentValue: row.adjustmentValue ?? "",
      isFavorite: row.isFavorite,
      isActive: row.isActive,
      notes: row.notes ?? "",
      installmentPlans: plans,
    });
    setAllowsInstallments(plans.length > 0);
    setSubmitted(false);
    setEditOpen(true);
  }

  /* ---------- abrir modal ver ---------- */
  function openView(row: PaymentMethodRow) {
    setViewTarget(row);
    setViewOpen(true);
  }

  /* ---------- abrir modal eliminar ---------- */
  function openDelete(row: PaymentMethodRow) {
    setDeleteTarget(row);
    setDeleteOpen(true);
  }

  /* ---------- validación ---------- */
  function validateDraft(): string | null {
    if (!draft.name.trim()) return "El nombre es obligatorio.";
    if (
      draft.adjustmentType !== "NONE" &&
      (draft.adjustmentValue.trim() === "" || draft.adjustmentValue.trim() === "0")
    ) {
      return "El valor del ajuste es obligatorio y no puede ser cero.";
    }
    return null;
  }

  /* ---------- guardar ---------- */
  async function handleSave() {
    setSubmitted(true);
    const err = validateDraft();
    if (err) return;

    const plans = allowsInstallments && draft.type === "CREDIT_CARD"
      ? draft.installmentPlans.map((p, i) => ({
          ...(p.id ? { id: p.id } : {}),
          installments: parseInt(p.installments, 10) || 1,
          interestRate: p.interestRate || "0",
          isActive: p.isActive,
          sortOrder: i,
        }))
      : [];

    const payload = {
      name: draft.name.trim(),
      code: draft.code.trim() || undefined,
      type: draft.type,
      adjustmentType: draft.adjustmentType,
      adjustmentValue:
        draft.adjustmentType !== "NONE" ? draft.adjustmentValue.trim() || null : null,
      isFavorite: draft.isFavorite,
      isActive: draft.isActive,
      notes: draft.notes.trim(),
      installmentPlans: plans,
    };

    try {
      setBusySave(true);
      if (editTarget) {
        await paymentsApi.update(editTarget.id, payload);
        toast.success("Medio de pago actualizado.");
      } else {
        await paymentsApi.create(payload);
        toast.success("Medio de pago creado correctamente.");
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
  async function handleToggle(row: PaymentMethodRow) {
    try {
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, isActive: !r.isActive } : r))
      );
      await paymentsApi.toggle(row.id);
      toast.success(row.isActive ? "Medio de pago desactivado." : "Medio de pago activado.");
      await load();
    } catch (e: any) {
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, isActive: row.isActive } : r))
      );
      toast.error(e?.message || "Ocurrió un error.");
    }
  }

  /* ---------- favorito ---------- */
  async function handleFavorite(row: PaymentMethodRow) {
    try {
      // optimistic: unset all, set clicked
      setRows((prev) =>
        prev.map((r) => ({
          ...r,
          isFavorite: r.id === row.id ? !row.isFavorite : false,
        }))
      );
      await paymentsApi.setFavorite(row.id);
      await load();
    } catch (e: any) {
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, isFavorite: row.isFavorite } : r))
      );
      toast.error(e?.message || "Ocurrió un error al marcar como favorito.");
    }
  }

  /* ---------- clonar ---------- */
  async function handleClone(row: PaymentMethodRow) {
    try {
      setBusyCloningId(row.id);
      await paymentsApi.clone(row.id);
      toast.success(`"${row.name}" clonado correctamente.`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Ocurrió un error al clonar.");
    } finally {
      setBusyCloningId(null);
    }
  }

  /* ---------- eliminar ---------- */
  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      setBusyDelete(true);
      await paymentsApi.remove(deleteTarget.id);
      toast.success("Medio de pago eliminado.");
      setDeleteOpen(false);
      setDeleteTarget(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Ocurrió un error al eliminar.");
    } finally {
      setBusyDelete(false);
    }
  }

  /* ---------- planes de cuotas ---------- */
  function addInstallmentPlan() {
    const nextSort = draft.installmentPlans.length;
    setDraftField("installmentPlans", [
      ...draft.installmentPlans,
      { installments: "3", interestRate: "0", isActive: true },
    ]);
  }

  function updateInstallmentPlan(
    index: number,
    field: keyof DraftInstallmentPlan,
    value: string | boolean
  ) {
    setDraftField(
      "installmentPlans",
      draft.installmentPlans.map((p, i) =>
        i === index ? { ...p, [field]: value } : p
      )
    );
  }

  function removeInstallmentPlan(index: number) {
    setDraftField(
      "installmentPlans",
      draft.installmentPlans.filter((_, i) => i !== index)
    );
  }

  /* ---------- error names para validación ---------- */
  const nameError =
    submitted && !draft.name.trim() ? "El nombre es obligatorio." : null;
  const adjValueError =
    submitted &&
    draft.adjustmentType !== "NONE" &&
    (draft.adjustmentValue.trim() === "" || draft.adjustmentValue.trim() === "0")
      ? "El valor del ajuste es obligatorio y no puede ser cero."
      : null;

  /* =========================================================
     RENDER
  ========================================================= */
  return (
    <TPSectionShell
      title="Medios de Pago"
      subtitle="Configurá los métodos de pago aceptados en la joyería"
      icon={<CreditCard size={22} />}
    >
      <TPTableWrap>
        {/* ---- header: contador + buscador + botón ---- */}
        <TPTableHeader
          left={
            <span className="text-sm text-muted">
              {filteredRows.length}{" "}
              {filteredRows.length === 1 ? "medio de pago" : "medios de pago"}
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
                Nuevo método
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
                <TPTh className="hidden md:table-cell">Ajuste</TPTh>
                <TPTh className="hidden md:table-cell">Cuotas</TPTh>
                <TPTh className="hidden md:table-cell">Estado</TPTh>
                <TPTh className="text-right">Acciones</TPTh>
              </tr>
            </TPThead>

            <TPTbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-muted">
                    <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
                    Cargando…
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <TPEmptyRow
                  colSpan={6}
                  text={
                    q
                      ? "No hay resultados para esa búsqueda."
                      : "Todavía no hay medios de pago. Creá el primero."
                  }
                />
              ) : (
                filteredRows.map((row) => {
                  const activePlans = row.installmentPlans?.filter((p) => p.isActive) ?? [];
                  const isCloning = busyCloningId === row.id;

                  return (
                    <TPTr key={row.id}>
                      {/* Nombre + Código */}
                      <TPTd label="Nombre / Código">
                        <div className="flex items-center gap-2 min-w-0">
                          {row.isFavorite && (
                            <Star
                              size={13}
                              className="shrink-0 fill-amber-400 text-amber-400"
                            />
                          )}
                          <div className="min-w-0">
                            <span className="block text-sm font-medium text-text truncate">
                              {row.name}
                            </span>
                            {row.code && (
                              <span className="block text-xs text-muted font-mono">
                                {row.code}
                              </span>
                            )}
                          </div>
                        </div>
                      </TPTd>

                      {/* Tipo */}
                      <TPTd label="Tipo" className="hidden md:table-cell">
                        <TypeBadge type={row.type} />
                      </TPTd>

                      {/* Ajuste */}
                      <TPTd label="Ajuste" className="hidden md:table-cell">
                        {formatAdjustment(row.adjustmentType, row.adjustmentValue)}
                      </TPTd>

                      {/* Cuotas */}
                      <TPTd label="Cuotas" className="hidden md:table-cell">
                        {row.type === "CREDIT_CARD" ? (
                          <span className="text-sm text-text">
                            {activePlans.length > 0 ? (
                              <span className="inline-flex items-center gap-1 text-xs">
                                <CreditCard size={12} className="shrink-0" />
                                {activePlans.length}{" "}
                                {activePlans.length === 1 ? "plan" : "planes"}
                              </span>
                            ) : (
                              <span className="text-muted text-xs">Sin planes</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted text-xs">—</span>
                        )}
                      </TPTd>

                      {/* Estado */}
                      <TPTd label="Estado" className="hidden md:table-cell">
                        <StatusPill active={row.isActive} />
                      </TPTd>

                      {/* Acciones */}
                      <TPTd label="Acciones" className="text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          {/* tipo en mobile */}
                          <span className="md:hidden">
                            <TypeBadge type={row.type} />
                          </span>
                          {/* estado en mobile */}
                          <span className="md:hidden">
                            <StatusPill active={row.isActive} />
                          </span>

                          {/* Favorito */}
                          <button
                            type="button"
                            title={row.isFavorite ? "Quitar favorito" : "Marcar como favorito"}
                            onClick={() => handleFavorite(row)}
                            className={cn(
                              "tp-btn-secondary h-9 w-9 !p-0 grid place-items-center shrink-0",
                              row.isFavorite && "text-amber-400"
                            )}
                          >
                            <Star
                              size={15}
                              className={row.isFavorite ? "fill-amber-400" : ""}
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

                          {/* Clonar */}
                          <button
                            type="button"
                            title="Clonar"
                            onClick={() => handleClone(row)}
                            disabled={isCloning}
                            className="tp-btn-secondary h-9 w-9 !p-0 grid place-items-center shrink-0 disabled:opacity-50"
                          >
                            {isCloning ? (
                              <Loader2 size={15} className="animate-spin" />
                            ) : (
                              <Copy size={15} />
                            )}
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
                  );
                })
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
        title={editTarget ? "Editar medio de pago" : "Nuevo medio de pago"}
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
          {/* ---- Sección: Identificación ---- */}
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
              Identificación
            </div>
            <div className="space-y-4">
              {/* Nombre */}
              <TPField
                label="Nombre"
                required
                error={nameError}
              >
                <TPInput
                  value={draft.name}
                  onChange={(v) => {
                    setDraftField("name", v);
                    if (submitted && v.trim()) setSubmitted(false);
                  }}
                  placeholder="Ej: Tarjeta de crédito Visa"
                  disabled={busySave}
                  data-tp-autofocus="1"
                />
              </TPField>

              {/* Tipo */}
              <TPField label="Tipo" required>
                <select
                  value={draft.type}
                  onChange={(e) => {
                    const t = e.target.value as PaymentMethodType;
                    setDraftField("type", t);
                    // si cambia a algo que no es tarjeta de crédito, limpiar planes
                    if (t !== "CREDIT_CARD") {
                      setAllowsInstallments(false);
                    }
                  }}
                  disabled={busySave}
                  className="tp-select w-full"
                >
                  {(Object.keys(PM_TYPE_LABELS) as PaymentMethodType[]).map((key) => (
                    <option key={key} value={key}>
                      {PM_TYPE_LABELS[key]}
                    </option>
                  ))}
                </select>
              </TPField>

              {/* Código */}
              <TPField
                label="Código"
                hint="Opcional. Si no lo completás, se genera automáticamente."
              >
                <TPInput
                  value={draft.code}
                  onChange={(v) => setDraftField("code", v)}
                  placeholder="Ej: VISA_CRED"
                  disabled={busySave}
                />
              </TPField>
            </div>
          </div>

          {/* ---- Sección: Ajuste de precio ---- */}
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
              Ajuste de precio
            </div>
            <div className="space-y-4">
              {/* Tipo de ajuste */}
              <TPField label="Tipo de ajuste">
                <select
                  value={draft.adjustmentType}
                  onChange={(e) => {
                    const t = e.target.value as PaymentAdjustmentType;
                    setDraftField("adjustmentType", t);
                    if (t === "NONE") setDraftField("adjustmentValue", "");
                  }}
                  disabled={busySave}
                  className="tp-select w-full"
                >
                  {(Object.keys(ADJ_TYPE_LABELS) as PaymentAdjustmentType[]).map((key) => (
                    <option key={key} value={key}>
                      {ADJ_TYPE_LABELS[key]}
                    </option>
                  ))}
                </select>
              </TPField>

              {/* Valor del ajuste — solo si no es NONE */}
              {draft.adjustmentType !== "NONE" && (
                <TPField
                  label={
                    draft.adjustmentType === "PERCENTAGE"
                      ? "Porcentaje (%)"
                      : "Monto fijo ($)"
                  }
                  hint="Positivo = recargo, negativo = descuento"
                  error={adjValueError}
                >
                  <TPInput
                    value={draft.adjustmentValue}
                    onChange={(v) => setDraftField("adjustmentValue", v)}
                    type="number"
                    placeholder={draft.adjustmentType === "PERCENTAGE" ? "Ej: 5 o -3" : "Ej: 100 o -50"}
                    disabled={busySave}
                  />
                </TPField>
              )}
            </div>
          </div>

          {/* ---- Sección: Cuotas (solo CREDIT_CARD) ---- */}
          {draft.type === "CREDIT_CARD" && (
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
                Cuotas
              </div>
              <div className="space-y-4">
                <TPField label="">
                  <TPCheckbox
                    checked={allowsInstallments}
                    onChange={(v) => {
                      setAllowsInstallments(v);
                      if (!v) setDraftField("installmentPlans", []);
                    }}
                    disabled={busySave}
                    label={
                      <span className="text-sm text-text">¿Permite cuotas?</span>
                    }
                  />
                </TPField>

                {allowsInstallments && (
                  <div className="space-y-2">
                    {draft.installmentPlans.length > 0 ? (
                      <div className="rounded-xl border border-border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-surface2 text-xs uppercase tracking-wide text-muted">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold">Cuotas</th>
                              <th className="px-3 py-2 text-left font-semibold">Interés %</th>
                              <th className="px-3 py-2 text-left font-semibold">Activo</th>
                              <th className="px-3 py-2 text-right font-semibold">
                                <span className="sr-only">Eliminar</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {draft.installmentPlans.map((plan, i) => (
                              <tr key={i} className="hover:bg-surface2/30 transition">
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={plan.installments}
                                    onChange={(e) =>
                                      updateInstallmentPlan(i, "installments", e.target.value)
                                    }
                                    disabled={busySave}
                                    className="tp-input w-20 text-sm"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={plan.interestRate}
                                    onChange={(e) =>
                                      updateInstallmentPlan(i, "interestRate", e.target.value)
                                    }
                                    disabled={busySave}
                                    className="tp-input w-24 text-sm"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <TPCheckbox
                                    checked={plan.isActive}
                                    onChange={(v) => updateInstallmentPlan(i, "isActive", v)}
                                    disabled={busySave}
                                  />
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() => removeInstallmentPlan(i)}
                                    disabled={busySave}
                                    className="text-red-400 hover:text-red-500 disabled:opacity-50 transition"
                                    title="Eliminar plan"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted py-2">
                        No hay planes de cuotas. Hacé clic en "Agregar plan" para agregar uno.
                      </p>
                    )}

                    <TPButton
                      variant="secondary"
                      onClick={addInstallmentPlan}
                      disabled={busySave}
                      iconLeft={<Plus size={14} />}
                      className="h-8 text-xs"
                    >
                      Agregar plan
                    </TPButton>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ---- Sección: General (solo en modo editar) ---- */}
          {editTarget && (
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
                General
              </div>
              <div className="space-y-4">
                <TPField label="">
                  <TPCheckbox
                    checked={draft.isFavorite}
                    onChange={(v) => setDraftField("isFavorite", v)}
                    disabled={busySave}
                    label={
                      <span className="text-sm text-text">Marcar como favorito</span>
                    }
                  />
                </TPField>

                <TPField label="">
                  <TPCheckbox
                    checked={draft.isActive}
                    onChange={(v) => setDraftField("isActive", v)}
                    disabled={busySave}
                    label={
                      <span className="text-sm text-text">Medio de pago activo</span>
                    }
                  />
                </TPField>

                <TPField label="Notas">
                  <TPTextarea
                    value={draft.notes}
                    onChange={(v) => setDraftField("notes", v)}
                    placeholder="Observaciones internas, condiciones especiales…"
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
        title={viewTarget?.name ?? "Detalle de medio de pago"}
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
              <span className="text-text text-right font-medium">{viewTarget.name}</span>
            </div>

            {viewTarget.code && (
              <div className="flex justify-between gap-4 py-2 border-b border-border">
                <span className="text-muted font-medium">Código</span>
                <span className="text-text text-right font-mono text-xs">
                  {viewTarget.code}
                </span>
              </div>
            )}

            <div className="flex justify-between gap-4 py-2 border-b border-border">
              <span className="text-muted font-medium">Tipo</span>
              <TypeBadge type={viewTarget.type} />
            </div>

            <div className="flex justify-between gap-4 py-2 border-b border-border">
              <span className="text-muted font-medium">Ajuste</span>
              <span className="text-right">
                {formatAdjustment(viewTarget.adjustmentType, viewTarget.adjustmentValue)}
              </span>
            </div>

            {viewTarget.type === "CREDIT_CARD" && (
              <div className="flex flex-col gap-2 py-2 border-b border-border">
                <span className="text-muted font-medium">Planes de cuotas</span>
                {viewTarget.installmentPlans && viewTarget.installmentPlans.length > 0 ? (
                  <div className="space-y-1">
                    {viewTarget.installmentPlans.map((plan, i) => (
                      <div
                        key={plan.id ?? i}
                        className="flex items-center justify-between text-xs text-text bg-surface2/50 rounded-xl px-3 py-1.5"
                      >
                        <span>{plan.installments} cuotas</span>
                        <span className="text-muted">
                          {parseFloat(plan.interestRate) === 0
                            ? "Sin interés"
                            : `${plan.interestRate}% interés`}
                        </span>
                        <StatusPill active={plan.isActive} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted text-xs italic">Sin planes</span>
                )}
              </div>
            )}

            <div className="flex justify-between gap-4 py-2 border-b border-border">
              <span className="text-muted font-medium">Estado</span>
              <StatusPill active={viewTarget.isActive} />
            </div>

            <div className="flex justify-between gap-4 py-2 border-b border-border">
              <span className="text-muted font-medium">Favorito</span>
              <span className="flex items-center gap-1 text-text">
                {viewTarget.isFavorite ? (
                  <>
                    <Star size={13} className="fill-amber-400 text-amber-400" />
                    <span className="text-xs">Sí</span>
                  </>
                ) : (
                  <span className="text-muted text-xs italic">No</span>
                )}
              </span>
            </div>

            {viewTarget.notes && (
              <div className="flex flex-col gap-1 py-2 border-b border-border">
                <span className="text-muted font-medium">Notas</span>
                <span className="text-text text-xs">{viewTarget.notes}</span>
              </div>
            )}

            <div className="flex justify-between gap-4 py-2">
              <span className="text-muted font-medium">Fecha de creación</span>
              <span className="text-text text-right">{formatDate(viewTarget.createdAt)}</span>
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
        description="¿Estás seguro que querés eliminar este medio de pago? Esta acción no se puede deshacer."
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
