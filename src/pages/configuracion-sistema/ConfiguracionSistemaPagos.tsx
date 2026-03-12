// src/pages/configuracion-sistema/ConfiguracionSistemaPagos.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Save,
  Star,
  CreditCard,
  Trash2,
} from "lucide-react";

import { cn } from "../../components/ui/tp";
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
import TPComboFixed from "../../components/ui/TPComboFixed";
import TPNumberInput from "../../components/ui/TPNumberInput";

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
   COLUMN DEFINITIONS
========================================================= */
const PAY_COLS: TPColDef[] = [
  { key: "name",    label: "Nombre / Código", canHide: false, sortKey: "name" },
  { key: "tipo",    label: "Tipo",             sortKey: "tipo" },
  { key: "ajuste",  label: "Ajuste" },
  { key: "cuotas",  label: "Cuotas" },
  { key: "estado",  label: "Estado" },
  { key: "acciones", label: "Acciones",        canHide: false, align: "right" },
];

/* =========================================================
   MAIN PAGE
========================================================= */
export default function ConfiguracionSistemaPagos() {
  /* ---------- estado principal ---------- */
  const [rows, setRows] = useState<PaymentMethodRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  /* ---------- sort ---------- */
  type SortKey = "name" | "code";
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: string) {
    const k = key as SortKey;
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  }

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

  /* ---------- numeric state para TPNumberInput ---------- */
  const [adjustmentValueNum, setAdjustmentValueNum] = useState<number | null>(null);
  const [interestRateNums, setInterestRateNums] = useState<(number | null)[]>([]);

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

  /* ---------- filtrado y ordenamiento ---------- */
  const filteredRows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const filtered = s
      ? rows.filter(
          (r) =>
            r.name.toLowerCase().includes(s) ||
            r.code.toLowerCase().includes(s) ||
            PM_TYPE_LABELS[r.type].toLowerCase().includes(s)
        )
      : rows;

    return [...filtered].sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      return String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""), "es") * mul;
    });
  }, [rows, q, sortKey, sortDir]);

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
    setAdjustmentValueNum(null);
    setInterestRateNums([]);
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
    const adjNum = row.adjustmentValue ? parseFloat(row.adjustmentValue) : null;
    setAdjustmentValueNum(isNaN(adjNum as number) ? null : adjNum);
    setInterestRateNums(plans.map((p) => {
      const n = parseFloat(p.interestRate);
      return isNaN(n) ? null : n;
    }));
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
    setDraftField("installmentPlans", [
      ...draft.installmentPlans,
      { installments: "3", interestRate: "0", isActive: true },
    ]);
    setInterestRateNums((prev) => [...prev, 0]);
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
    setInterestRateNums((prev) => prev.filter((_, i) => i !== index));
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
      <TPTableKit
        columns={PAY_COLS}
        rows={filteredRows}
        storageKey="tptech_col_pagos"
        loading={loading}
        search={q}
        onSearchChange={setQ}
        searchPlaceholder="Buscar medios de pago..."
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={toggleSort}
        emptyText={q ? "No hay resultados para esa búsqueda." : "Todavía no hay medios de pago. Creá el primero."}
        countLabel={(n) => `${n} ${n === 1 ? "medio" : "medios"}`}
        responsive="stack"
        actions={
          <TPButton
            variant="primary"
            iconLeft={<Plus size={16} />}
            onClick={openCreate}
          >
            Nuevo método
          </TPButton>
        }
        renderRow={(row: PaymentMethodRow, vis) => {
          const activePlans = row.installmentPlans?.filter((p: any) => p.isActive) ?? [];

          return (
            <TPTr key={row.id} className={!row.isActive ? "opacity-60" : undefined}>
              {vis.name && (
                <TPTd>
                  <div className="flex items-center gap-2 min-w-0">
                    {row.isFavorite && (
                      <Star size={13} className="shrink-0 fill-amber-400 text-amber-400" />
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
              )}

              {vis.tipo && (
                <TPTd className="hidden md:table-cell">
                  <TypeBadge type={row.type} />
                </TPTd>
              )}

              {vis.ajuste && (
                <TPTd className="hidden md:table-cell">
                  {formatAdjustment(row.adjustmentType, row.adjustmentValue)}
                </TPTd>
              )}

              {vis.cuotas && (
                <TPTd className="hidden md:table-cell">
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
              )}

              {vis.estado && (
                <TPTd className="hidden md:table-cell">
                  <TPStatusPill active={row.isActive} />
                </TPTd>
              )}

              {vis.acciones && (
                <TPTd className="text-right">
                  <div className="flex items-center justify-end gap-1.5 flex-wrap">
                    <span className="md:hidden">
                      <TypeBadge type={row.type} />
                    </span>
                    <span className="md:hidden">
                      <TPStatusPill active={row.isActive} />
                    </span>
                    <TPRowActions
                      onFavorite={() => handleFavorite(row)}
                      isFavorite={row.isFavorite}
                      busyFavorite={!row.isActive}
                      onView={() => openView(row)}
                      onEdit={() => openEdit(row)}
                      onClone={() => handleClone(row)}
                      onToggle={() => handleToggle(row)}
                      isActive={row.isActive}
                      onDelete={() => openDelete(row)}
                    />
                  </div>
                </TPTd>
              )}
            </TPTr>
          );
        }}
      />

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
            <TPButton variant="primary" onClick={handleSave} loading={busySave} iconLeft={<Save size={16} />}>
              Guardar
            </TPButton>
          </>
        }
      >
        <div className="space-y-6">
          {/* ---- Sección: Identificación ---- */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                Identificación
              </span>
              <div className="flex-1 border-t border-border" />
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
                <TPComboFixed
                  value={draft.type}
                  onChange={(v) => {
                    const t = v as PaymentMethodType;
                    setDraftField("type", t);
                    // si cambia a algo que no es tarjeta de crédito, limpiar planes
                    if (t !== "CREDIT_CARD") {
                      setAllowsInstallments(false);
                    }
                  }}
                  disabled={busySave}
                  options={(Object.keys(PM_TYPE_LABELS) as PaymentMethodType[]).map((key) => ({
                    value: key,
                    label: PM_TYPE_LABELS[key],
                  }))}
                />
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
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                Ajuste de precio
              </span>
              <div className="flex-1 border-t border-border" />
            </div>
            <div className="space-y-4">
              {/* Tipo de ajuste */}
              <TPField label="Tipo de ajuste">
                <TPComboFixed
                  value={draft.adjustmentType}
                  onChange={(v) => {
                    const t = v as PaymentAdjustmentType;
                    setDraftField("adjustmentType", t);
                    if (t === "NONE") {
                      setDraftField("adjustmentValue", "");
                      setAdjustmentValueNum(null);
                    }
                  }}
                  disabled={busySave}
                  options={(Object.keys(ADJ_TYPE_LABELS) as PaymentAdjustmentType[]).map((key) => ({
                    value: key,
                    label: ADJ_TYPE_LABELS[key],
                  }))}
                />
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
                  <TPNumberInput
                    value={adjustmentValueNum}
                    onChange={(v) => {
                      setAdjustmentValueNum(v);
                      setDraftField("adjustmentValue", v != null ? String(v) : "");
                    }}
                    decimals={2}
                    step={0.01}
                    placeholder={draft.adjustmentType === "PERCENTAGE" ? "Ej: 5 o -3" : "Ej: 100 o -50"}
                    disabled={busySave}
                  />
                </TPField>
              )}
            </div>
          </div>

          {/* ---- Sección: Cuotas (solo CREDIT_CARD) ---- */}
          {draft.type === "CREDIT_CARD" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Cuotas
                </span>
                <div className="flex-1 border-t border-border" />
              </div>
              <div className="space-y-4">
                <TPField label="">
                  <TPCheckbox
                    checked={allowsInstallments}
                    onChange={(v) => {
                      setAllowsInstallments(v);
                      if (!v) {
                        setDraftField("installmentPlans", []);
                        setInterestRateNums([]);
                      }
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
                                  <TPNumberInput
                                    value={interestRateNums[i] ?? null}
                                    onChange={(v) => {
                                      const newNums = [...interestRateNums];
                                      newNums[i] = v;
                                      setInterestRateNums(newNums);
                                      updateInstallmentPlan(i, "interestRate", v != null ? String(v) : "0");
                                    }}
                                    decimals={2}
                                    step={0.01}
                                    min={0}
                                    disabled={busySave}
                                    className="w-24 text-sm"
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
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  General
                </span>
                <div className="flex-1 border-t border-border" />
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
                    {viewTarget.installmentPlans.map((plan: any, i: number) => (
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
                        <TPStatusPill active={plan.isActive} />
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
              <TPStatusPill active={viewTarget.isActive} />
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
