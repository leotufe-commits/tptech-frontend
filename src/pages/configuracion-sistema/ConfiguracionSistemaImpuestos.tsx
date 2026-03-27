// src/pages/configuracion-sistema/ConfiguracionSistemaImpuestos.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useConfirmDelete } from "../../hooks/useConfirmDelete";
import {
  Plus,
  Save,
  Receipt,
  AlertTriangle,
  X,
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
import {
  TPTr,
  TPTd,
} from "../../components/ui/TPTable";
import { TPTableKit, type TPColDef } from "../../components/ui/TPTableKit";
import { TPStatusPill } from "../../components/ui/TPStatusPill";
import { TPRowActions } from "../../components/ui/TPRowActions";
import TPComboFixed from "../../components/ui/TPComboFixed";
import TPNumberInput from "../../components/ui/TPNumberInput";
import TPDateRangeInline from "../../components/ui/TPDateRangeInline";

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
   Badge de tipo de tributo
========================================================= */
const TAX_TYPE_COLORS: Record<TaxType, string> = {
  IVA: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  INTERNAL: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  PERCEPTION: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  RETENTION: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  OTHER: "bg-surface2 text-muted",
};

function SystemBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-medium text-violet-600 dark:text-violet-400 whitespace-nowrap">
      Sistema
    </span>
  );
}

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
   Column definitions
========================================================= */
const IMP_COLS: TPColDef[] = [
  { key: "name",     label: "Nombre / Código", canHide: false, sortKey: "name" },
  { key: "type",     label: "Tipo",             sortKey: "taxType" },
  { key: "calc",     label: "Cálculo" },
  { key: "base",     label: "Base" },
  { key: "vigencia", label: "Vigencia" },
  { key: "estado",   label: "Estado" },
  { key: "acciones", label: "Acciones",         canHide: false, align: "right" },
];

/* =========================================================
   Página principal
========================================================= */
export default function ConfiguracionSistemaImpuestos() {
  /* ---- estado principal ---- */
  const [rows, setRows] = useState<TaxRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  /* ---- sort ---- */
  type SortKey = "name" | "taxType" | "createdAt";
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  /* ---- modal editar/crear ---- */
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TaxRow | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [submitted, setSubmitted] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  /* ---- numeric state para TPNumberInput ---- */
  const [rateNum, setRateNum] = useState<number | null>(null);
  const [fixedAmountNum, setFixedAmountNum] = useState<number | null>(null);

  /* ---- modal ver ---- */
  const [viewOpen, setViewOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<TaxRow | null>(null);

  const { askDelete, dialogProps: deleteDialogProps } = useConfirmDelete();

  /* ---- busy ---- */
  const [busySave, setBusySave] = useState(false);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [favoritingId, setFavoritingId] = useState<string | null>(null);

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

  /* ---- filtrado y ordenamiento ---- */
  const filteredRows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const filtered = s
      ? rows.filter(
          (r) =>
            r.name.toLowerCase().includes(s) ||
            r.code.toLowerCase().includes(s) ||
            TAX_TYPE_LABELS[r.taxType].toLowerCase().includes(s)
        )
      : rows;

    return [...filtered].sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") {
        return String(a.name ?? "").localeCompare(String(b.name ?? ""), "es") * mul;
      }
      if (sortKey === "taxType") {
        return String(TAX_TYPE_LABELS[a.taxType] ?? "").localeCompare(
          String(TAX_TYPE_LABELS[b.taxType] ?? ""),
          "es"
        ) * mul;
      }
      if (sortKey === "createdAt") {
        return (String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? ""), "es")) * mul;
      }
      return 0;
    });
  }, [rows, q, sortKey, sortDir]);

  /* ---- helpers draft ---- */
  function patchDraft(patch: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  /* ---- abrir modal crear ---- */
  function openCreate() {
    setEditTarget(null);
    setDraft(EMPTY_DRAFT);
    setRateNum(null);
    setFixedAmountNum(null);
    setSubmitted(false);
    setFormErrors({});
    setEditOpen(true);
  }

  /* ---- abrir modal editar ---- */
  function openEdit(row: TaxRow) {
    setEditTarget(row);
    const rateVal = row.rate != null ? parseFloat(row.rate) : null;
    const fixedVal = row.fixedAmount != null ? parseFloat(row.fixedAmount) : null;
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
    setRateNum(rateVal);
    setFixedAmountNum(fixedVal);
    setSubmitted(false);
    setFormErrors({});
    setEditOpen(true);
  }

  /* ---- abrir modal ver ---- */
  function openView(row: TaxRow) {
    setViewTarget(row);
    setViewOpen(true);
  }

  /* ---- guardar ---- */
  async function handleSave() {
    // sync numeric values back to draft strings before validation
    const currentDraft: Draft = {
      ...draft,
      rate: rateNum != null ? String(rateNum) : "",
      fixedAmount: fixedAmountNum != null ? String(fixedAmountNum) : "",
    };
    setDraft(currentDraft);

    setSubmitted(true);
    const errors = validate(currentDraft);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const payload: TaxPayload = {
      name: currentDraft.name.trim(),
      code: currentDraft.code.trim() || undefined,
      taxType: currentDraft.taxType,
      calculationType: currentDraft.calculationType,
      rate:
        currentDraft.calculationType === "PERCENTAGE" ||
        currentDraft.calculationType === "PERCENTAGE_PLUS_FIXED"
          ? rateNum
          : null,
      fixedAmount:
        currentDraft.calculationType === "FIXED_AMOUNT" ||
        currentDraft.calculationType === "PERCENTAGE_PLUS_FIXED"
          ? fixedAmountNum
          : null,
      applyOn: currentDraft.applyOn,
      includedInPrice: currentDraft.includedInPrice,
      validFrom: currentDraft.validFrom || null,
      validTo: currentDraft.validTo || null,
      isActive: currentDraft.isActive,
      notes: currentDraft.notes.trim(),
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

  /* ---- favorito ---- */
  async function handleFavorite(row: TaxRow) {
    try {
      setFavoritingId(row.id);
      setRows((prev) =>
        prev.map((r) => ({ ...r, isFavorite: r.id === row.id ? !r.isFavorite : false }))
      );
      await taxesApi.favorite(row.id);
      await load();
    } catch (e: any) {
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, isFavorite: row.isFavorite } : r))
      );
      toast.error(e?.message || "No se pudo cambiar el favorito.");
    } finally {
      setFavoritingId(null);
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

  // suppress unused warning — cloningId is set during clone operations
  void cloningId;

  /* =========================================================
     RENDER
  ========================================================= */
  return (
    <TPSectionShell
      title="Impuestos y Tributos"
      subtitle="Configurá los impuestos aplicables a las ventas"
      icon={<Receipt size={22} />}
    >
      <TPTableKit
        rows={filteredRows}
        columns={IMP_COLS}
        storageKey="tptech_col_impuestos"
        search={q}
        onSearchChange={setQ}
        searchPlaceholder="Buscar impuestos..."
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={(key) => toggleSort(key as SortKey)}
        loading={loading}
        emptyText={q ? "No hay resultados para esa búsqueda." : "Todavía no hay impuestos configurados. Creá el primero."}
        pagination
        countLabel={(n) => `${n} ${n === 1 ? "impuesto" : "impuestos"}`}
        responsive="stack"
        actions={
          <TPButton
            variant="primary"
            iconLeft={<Plus size={16} />}
            onClick={openCreate}
          >
            Nuevo impuesto
          </TPButton>
        }
        onRowClick={(row) => openView(row)}
        renderRow={(row, vis) => (
          <TPTr key={row.id} className={!row.isActive ? "opacity-60" : undefined}>
            {vis.name && (
              <TPTd>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="text-sm font-medium text-text truncate">{row.name}</div>
                  {row.isSystem && <SystemBadge />}
                </div>
              </TPTd>
            )}
            {vis.type && (
              <TPTd className="hidden md:table-cell">
                <TaxTypeBadge taxType={row.taxType} />
              </TPTd>
            )}
            {vis.calc && (
              <TPTd className="hidden md:table-cell">
                <div className="space-y-0.5">
                  <div className="text-xs text-muted">{CALC_TYPE_LABELS[row.calculationType]}</div>
                  <CalcDisplay
                    calculationType={row.calculationType}
                    rate={row.rate}
                    fixedAmount={row.fixedAmount}
                  />
                </div>
              </TPTd>
            )}
            {vis.base && (
              <TPTd className="hidden lg:table-cell">
                <span className="text-sm text-muted truncate block max-w-[160px]">
                  {APPLY_ON_LABELS[row.applyOn]}
                </span>
              </TPTd>
            )}
            {vis.vigencia && (
              <TPTd className="hidden lg:table-cell">
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
                    <TPStatusPill active={row.isActive} />
                  </span>
                  <span className="md:hidden">
                    <TaxTypeBadge taxType={row.taxType} />
                  </span>
                  <TPRowActions
                    onFavorite={() => handleFavorite(row)}
                    isFavorite={row.isFavorite}
                    busyFavorite={favoritingId === row.id}
                    onView={() => openView(row)}
                    onEdit={() => openEdit(row)}
                    onClone={() => handleClone(row)}
                    onToggle={() => handleToggle(row)}
                    isActive={row.isActive}
                    onDelete={() => askDelete({
                      entityName: "impuesto",
                      entityLabel: row.name,
                      onDelete: () => taxesApi.remove(row.id),
                      onAfterSuccess: load,
                    })}
                  />
                </div>
              </TPTd>
            )}
          </TPTr>
        )}
      />

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
              iconLeft={<X size={16} />}
            >
              Cancelar
            </TPButton>
            <TPButton
              variant="primary"
              onClick={handleSave}
              loading={busySave}
              iconLeft={<Save size={16} />}
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
              <TPField label="Tipo de tributo" required className="sm:col-span-2">
                <TPComboFixed
                  value={draft.taxType}
                  onChange={(v) => patchDraft({ taxType: v as TaxType })}
                  disabled={busySave}
                  options={(Object.keys(TAX_TYPE_LABELS) as TaxType[]).map((k) => ({
                    value: k,
                    label: TAX_TYPE_LABELS[k],
                  }))}
                />
              </TPField>

            </div>
          </ModalSection>

          {/* ---- Sección: Cálculo ---- */}
          <ModalSection title="Cálculo">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Modo de cálculo */}
              <TPField label="Modo de cálculo" required className="sm:col-span-2">
                <TPComboFixed
                  value={draft.calculationType}
                  onChange={(v) => {
                    patchDraft({ calculationType: v as TaxCalculationType });
                    // reset numeric values when mode changes
                    setRateNum(null);
                    setFixedAmountNum(null);
                  }}
                  disabled={busySave}
                  options={(Object.keys(CALC_TYPE_LABELS) as TaxCalculationType[]).map((k) => ({
                    value: k,
                    label: CALC_TYPE_LABELS[k],
                  }))}
                />
              </TPField>

              {/* Porcentaje — solo si aplica */}
              {(draft.calculationType === "PERCENTAGE" ||
                draft.calculationType === "PERCENTAGE_PLUS_FIXED") && (
                <TPField label="Porcentaje" required error={errors.rate}>
                  <TPNumberInput
                    value={rateNum}
                    onChange={(v) => {
                      setRateNum(v);
                      patchDraft({ rate: v != null ? String(v) : "" });
                    }}
                    decimals={2}
                    step={1}
                    min={0}
                    placeholder="Ej: 21"
                    disabled={busySave}
                    suffix="%"
                  />
                </TPField>
              )}

              {/* Monto fijo — solo si aplica */}
              {(draft.calculationType === "FIXED_AMOUNT" ||
                draft.calculationType === "PERCENTAGE_PLUS_FIXED") && (
                <TPField label="Monto fijo" required error={errors.fixedAmount}>
                  <TPNumberInput
                    value={fixedAmountNum}
                    onChange={(v) => {
                      setFixedAmountNum(v);
                      patchDraft({ fixedAmount: v != null ? String(v) : "" });
                    }}
                    decimals={2}
                    step={1}
                    min={0}
                    placeholder="Ej: 100"
                    disabled={busySave}
                    leftIcon="$"
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
                <TPComboFixed
                  value={draft.applyOn}
                  onChange={(v) => patchDraft({ applyOn: v as TaxApplyOn })}
                  disabled={busySave}
                  options={(Object.keys(APPLY_ON_LABELS) as TaxApplyOn[]).map((k) => ({
                    value: k,
                    label: APPLY_ON_LABELS[k],
                  }))}
                />
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
            <TPDateRangeInline
              showPresets={false}
              fromLabel="Válido desde"
              toLabel="Válido hasta"
              disabled={busySave}
              value={{
                from: draft.validFrom ? new Date(draft.validFrom + "T00:00:00") : null,
                to: draft.validTo ? new Date(draft.validTo + "T00:00:00") : null,
              }}
              onChange={(v) => {
                const fmt = (d: Date | null) =>
                  d
                    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
                    : "";
                patchDraft({ validFrom: fmt(v.from), validTo: fmt(v.to) });
              }}
            />
          </ModalSection>

          {/* ---- Sección: General (solo en edición) ---- */}
          {editTarget && (
            <ModalSection title="General">
              <div className="space-y-3">
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
              <TPStatusPill active={viewTarget.isActive} />
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

      <ConfirmDeleteDialog {...deleteDialogProps} />
    </TPSectionShell>
  );
}
