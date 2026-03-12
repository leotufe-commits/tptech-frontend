// src/pages/configuracion-sistema/ConfiguracionSistemaEnvios.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Save,
  Truck,
  Star,
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
import { TPTr, TPTd } from "../../components/ui/TPTable";
import { TPTableKit, type TPColDef } from "../../components/ui/TPTableKit";
import { TPStatusPill } from "../../components/ui/TPStatusPill";
import { TPRowActions } from "../../components/ui/TPRowActions";
import TPComboFixed from "../../components/ui/TPComboFixed";
import TPNumberInput from "../../components/ui/TPNumberInput";

import { toast } from "../../lib/toast";
import {
  shippingApi,
  type ShippingCarrierRow,
  type ShippingCarrierPayload,
  type ShippingCalcMode,
} from "../../services/shipping";

/* =========================================================
   Label maps
========================================================= */
const CALC_MODE_LABELS: Record<ShippingCalcMode, string> = {
  FIXED: "Precio fijo",
  BY_WEIGHT: "Por peso ($/kg)",
  BY_ZONE: "Por zona",
};

/* =========================================================
   Draft de tarifa
========================================================= */
type RateDraft = {
  id?: string;
  name: string;
  zone: string;
  calculationMode: ShippingCalcMode;
  fixedPrice: string;
  pricePerKg: string;
  minWeight: string;
  maxWeight: string;
  isActive: boolean;
};

const EMPTY_RATE: RateDraft = {
  name: "",
  zone: "",
  calculationMode: "FIXED",
  fixedPrice: "",
  pricePerKg: "",
  minWeight: "",
  maxWeight: "",
  isActive: true,
};

/* =========================================================
   Draft del transportista
========================================================= */
type CarrierDraft = {
  name: string;
  code: string;
  trackingUrl: string;
  logoUrl: string;
  hasFreeShipping: boolean;
  freeShippingThreshold: string;
  isFavorite: boolean;
  isActive: boolean;
  notes: string;
};

const EMPTY_DRAFT: CarrierDraft = {
  name: "",
  code: "",
  trackingUrl: "",
  logoUrl: "",
  hasFreeShipping: false,
  freeShippingThreshold: "",
  isFavorite: false,
  isActive: true,
  notes: "",
};

/* =========================================================
   Helpers
========================================================= */
function formatCurrency(value: string | null | undefined): string {
  if (!value) return "No aplica";
  const n = parseFloat(value);
  if (isNaN(n)) return "No aplica";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

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

/* =========================================================
   Componentes pequeños
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
};

function validate(draft: CarrierDraft): FormErrors {
  const errors: FormErrors = {};
  if (!draft.name.trim()) {
    errors.name = "El nombre es obligatorio.";
  }
  return errors;
}

/* =========================================================
   Tabla inline de tarifas (dentro del modal)
========================================================= */
function RatesEditor({
  rates,
  onChange,
  disabled,
}: {
  rates: RateDraft[];
  onChange: (rates: RateDraft[]) => void;
  disabled: boolean;
}) {
  function addRate() {
    onChange([...rates, { ...EMPTY_RATE }]);
  }

  function removeRate(index: number) {
    onChange(rates.filter((_, i) => i !== index));
  }

  function patchRate(index: number, patch: Partial<RateDraft>) {
    onChange(
      rates.map((r, i) => (i === index ? { ...r, ...patch } : r))
    );
  }

  return (
    <div className="space-y-3">
      {rates.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          {/* Cabecera tabla */}
          <div className="hidden md:grid grid-cols-[1fr_1fr_160px_160px_60px_36px] gap-2 bg-surface2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
            <div>Nombre</div>
            <div>Zona</div>
            <div>Modo</div>
            <div>Precio / $/kg</div>
            <div className="text-center">Activo</div>
            <div />
          </div>

          <div className="divide-y divide-border">
            {rates.map((rate, idx) => (
              <div
                key={idx}
                className="flex flex-col gap-2 px-3 py-3 md:grid md:grid-cols-[1fr_1fr_160px_160px_60px_36px] md:items-center md:gap-2"
              >
                {/* Nombre */}
                <div>
                  <div className="mb-1 text-xs text-muted md:hidden">Nombre</div>
                  <input
                    type="text"
                    value={rate.name}
                    onChange={(e) => patchRate(idx, { name: e.target.value })}
                    disabled={disabled}
                    placeholder="Ej: Envío estándar"
                    className="tp-input w-full text-sm"
                  />
                </div>

                {/* Zona */}
                <div>
                  <div className="mb-1 text-xs text-muted md:hidden">Zona</div>
                  <input
                    type="text"
                    value={rate.zone}
                    onChange={(e) => patchRate(idx, { zone: e.target.value })}
                    disabled={disabled}
                    placeholder="Ej: CABA"
                    className="tp-input w-full text-sm"
                  />
                </div>

                {/* Modo */}
                <div>
                  <div className="mb-1 text-xs text-muted md:hidden">Modo de cálculo</div>
                  <TPComboFixed
                    value={rate.calculationMode}
                    onChange={(v) =>
                      patchRate(idx, {
                        calculationMode: v as ShippingCalcMode,
                        fixedPrice: "",
                        pricePerKg: "",
                        minWeight: "",
                        maxWeight: "",
                      })
                    }
                    disabled={disabled}
                    options={(Object.keys(CALC_MODE_LABELS) as ShippingCalcMode[]).map((k) => ({
                      value: k,
                      label: CALC_MODE_LABELS[k],
                    }))}
                    className="text-sm"
                  />
                </div>

                {/* Precio fijo / $/kg */}
                <div>
                  {rate.calculationMode === "FIXED" && (
                    <>
                      <div className="mb-1 text-xs text-muted md:hidden">Precio fijo ($)</div>
                      <TPNumberInput
                        value={rate.fixedPrice ? parseFloat(rate.fixedPrice) : null}
                        onChange={(v) => patchRate(idx, { fixedPrice: v != null ? String(v) : "" })}
                        disabled={disabled}
                        placeholder="0,00"
                        decimals={2}
                        step={1}
                        min={0}
                        className="text-sm"
                      />
                    </>
                  )}
                  {rate.calculationMode === "BY_WEIGHT" && (
                    <div className="space-y-1.5">
                      <div>
                        <div className="mb-1 text-xs text-muted md:hidden">$/kg</div>
                        <TPNumberInput
                          value={rate.pricePerKg ? parseFloat(rate.pricePerKg) : null}
                          onChange={(v) => patchRate(idx, { pricePerKg: v != null ? String(v) : "" })}
                          disabled={disabled}
                          placeholder="$/kg"
                          decimals={2}
                          step={1}
                          min={0}
                          className="text-sm"
                        />
                      </div>
                      <div className="flex gap-1.5">
                        <TPNumberInput
                          value={rate.minWeight ? parseFloat(rate.minWeight) : null}
                          onChange={(v) => patchRate(idx, { minWeight: v != null ? String(v) : "" })}
                          disabled={disabled}
                          placeholder="Min kg"
                          decimals={1}
                          step={0.1}
                          min={0}
                          className="text-xs"
                        />
                        <TPNumberInput
                          value={rate.maxWeight ? parseFloat(rate.maxWeight) : null}
                          onChange={(v) => patchRate(idx, { maxWeight: v != null ? String(v) : "" })}
                          disabled={disabled}
                          placeholder="Max kg"
                          decimals={1}
                          step={0.1}
                          min={0}
                          className="text-xs"
                        />
                      </div>
                    </div>
                  )}
                  {rate.calculationMode === "BY_ZONE" && (
                    <span className="text-sm text-muted">—</span>
                  )}
                </div>

                {/* Activo */}
                <div className="flex items-center justify-start md:justify-center">
                  <div className="flex items-center gap-2 md:gap-0">
                    <span className="text-xs text-muted md:hidden">Activo:</span>
                    <input
                      type="checkbox"
                      checked={rate.isActive}
                      onChange={(e) => patchRate(idx, { isActive: e.target.checked })}
                      disabled={disabled}
                      className="h-4 w-4 cursor-pointer accent-primary"
                    />
                  </div>
                </div>

                {/* Eliminar */}
                <div className="flex items-center justify-end md:justify-center">
                  <button
                    type="button"
                    onClick={() => removeRate(idx)}
                    disabled={disabled}
                    title="Eliminar tarifa"
                    className="grid h-8 w-8 place-items-center rounded-lg border border-border text-red-400 hover:bg-red-500/10 hover:text-red-500 disabled:opacity-40 transition"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={addRate}
        disabled={disabled}
        className="tp-btn-secondary inline-flex items-center gap-1.5 text-sm disabled:opacity-50"
      >
        <Plus size={14} />
        Agregar tarifa
      </button>
    </div>
  );
}

const ENV_COLS: TPColDef[] = [
  { key: "name",        label: "Nombre / Código",  canHide: false, sortKey: "name" },
  { key: "tarifas",     label: "Tarifas" },
  { key: "enviogratis", label: "Envío gratis desde" },
  { key: "estado",      label: "Estado" },
  { key: "acciones",    label: "Acciones",          canHide: false, align: "right" },
];

/* =========================================================
   Página principal
========================================================= */
export default function ConfiguracionSistemaEnvios() {
  /* ---- estado principal ---- */
  const [rows, setRows] = useState<ShippingCarrierRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  /* ---- sort ---- */
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  /* ---- modal editar/crear ---- */
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ShippingCarrierRow | null>(null);
  const [draft, setDraft] = useState<CarrierDraft>(EMPTY_DRAFT);
  const [ratesDraft, setRatesDraft] = useState<RateDraft[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  /* ---- numeric state para freeShippingThreshold ---- */
  const [freeShippingNum, setFreeShippingNum] = useState<number | null>(null);

  /* ---- modal ver ---- */
  const [viewOpen, setViewOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<ShippingCarrierRow | null>(null);

  /* ---- modal eliminar ---- */
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ShippingCarrierRow | null>(null);

  /* ---- busy ---- */
  const [busySave, setBusySave] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [favoritingId, setFavoritingId] = useState<string | null>(null);

  /* ---- carga inicial ---- */
  async function load() {
    try {
      setLoading(true);
      const data = await shippingApi.list();
      setRows(data);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo cargar la lista de transportistas.");
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
            r.code.toLowerCase().includes(s)
        )
      : rows;

    return [...filtered].sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      return String(a.name ?? "").localeCompare(String(b.name ?? ""), "es") * mul;
    });
  }, [rows, q, sortKey, sortDir]);

  /* ---- helpers draft ---- */
  function patchDraft(patch: Partial<CarrierDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  /* ---- abrir modal crear ---- */
  function openCreate() {
    setEditTarget(null);
    setDraft(EMPTY_DRAFT);
    setRatesDraft([]);
    setFreeShippingNum(null);
    setSubmitted(false);
    setFormErrors({});
    setEditOpen(true);
  }

  /* ---- abrir modal editar ---- */
  function openEdit(row: ShippingCarrierRow) {
    setEditTarget(row);
    const threshold = row.freeShippingThreshold != null
      ? parseFloat(row.freeShippingThreshold)
      : null;
    setDraft({
      name: row.name,
      code: row.code ?? "",
      trackingUrl: row.trackingUrl ?? "",
      logoUrl: row.logoUrl ?? "",
      hasFreeShipping: row.freeShippingThreshold != null,
      freeShippingThreshold:
        row.freeShippingThreshold != null
          ? String(parseFloat(row.freeShippingThreshold))
          : "",
      isFavorite: row.isFavorite,
      isActive: row.isActive,
      notes: row.notes ?? "",
    });
    setFreeShippingNum(threshold && !isNaN(threshold) ? threshold : null);
    setRatesDraft(
      (row.rates ?? []).map((rate) => ({
        id: rate.id,
        name: rate.name,
        zone: rate.zone,
        calculationMode: rate.calculationMode,
        fixedPrice: rate.fixedPrice != null ? String(parseFloat(rate.fixedPrice)) : "",
        pricePerKg: rate.pricePerKg != null ? String(parseFloat(rate.pricePerKg)) : "",
        minWeight: rate.minWeight != null ? String(parseFloat(rate.minWeight)) : "",
        maxWeight: rate.maxWeight != null ? String(parseFloat(rate.maxWeight)) : "",
        isActive: rate.isActive,
      }))
    );
    setSubmitted(false);
    setFormErrors({});
    setEditOpen(true);
  }

  /* ---- abrir modal ver ---- */
  function openView(row: ShippingCarrierRow) {
    setViewTarget(row);
    setViewOpen(true);
  }

  /* ---- abrir modal eliminar ---- */
  function openDelete(row: ShippingCarrierRow) {
    setDeleteTarget(row);
    setDeleteOpen(true);
  }

  /* ---- guardar ---- */
  async function handleSave() {
    setSubmitted(true);
    const errors = validate(draft);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const payload: ShippingCarrierPayload = {
      name: draft.name.trim(),
      code: draft.code.trim() || undefined,
      trackingUrl: draft.trackingUrl.trim() || undefined,
      logoUrl: draft.logoUrl.trim() || undefined,
      freeShippingThreshold: draft.hasFreeShipping
        ? freeShippingNum != null
          ? freeShippingNum
          : null
        : null,
      isFavorite: draft.isFavorite,
      isActive: draft.isActive,
      notes: draft.notes.trim(),
      rates: ratesDraft.map((r, idx) => ({
        id: r.id,
        name: r.name.trim(),
        zone: r.zone.trim(),
        calculationMode: r.calculationMode,
        fixedPrice:
          r.calculationMode === "FIXED" && r.fixedPrice
            ? parseFloat(r.fixedPrice)
            : null,
        pricePerKg:
          r.calculationMode === "BY_WEIGHT" && r.pricePerKg
            ? parseFloat(r.pricePerKg)
            : null,
        minWeight:
          r.calculationMode === "BY_WEIGHT" && r.minWeight
            ? parseFloat(r.minWeight)
            : null,
        maxWeight:
          r.calculationMode === "BY_WEIGHT" && r.maxWeight
            ? parseFloat(r.maxWeight)
            : null,
        isActive: r.isActive,
        sortOrder: idx,
      })),
    };

    try {
      setBusySave(true);
      if (editTarget) {
        await shippingApi.update(editTarget.id, payload);
        toast.success("Transportista actualizado.");
      } else {
        await shippingApi.create(payload);
        toast.success("Transportista creado correctamente.");
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
  async function handleToggle(row: ShippingCarrierRow) {
    try {
      setTogglingId(row.id);
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, isActive: !r.isActive } : r))
      );
      await shippingApi.toggle(row.id);
      toast.success(row.isActive ? "Transportista desactivado." : "Transportista activado.");
      await load();
    } catch (e: any) {
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, isActive: row.isActive } : r))
      );
      toast.error(e?.message || "No se pudo cambiar el estado.");
    } finally {
      setTogglingId(null);
    }
  }

  /* ---- favorito ---- */
  async function handleFavorite(row: ShippingCarrierRow) {
    try {
      setFavoritingId(row.id);
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, isFavorite: !r.isFavorite } : r))
      );
      await shippingApi.favorite(row.id);
      toast.success(
        row.isFavorite ? "Transportista removido de favoritos." : "Transportista marcado como favorito."
      );
      await load();
    } catch (e: any) {
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, isFavorite: row.isFavorite } : r))
      );
      toast.error(e?.message || "No se pudo actualizar el favorito.");
    } finally {
      setFavoritingId(null);
    }
  }

  /* ---- clonar ---- */
  async function handleClone(row: ShippingCarrierRow) {
    try {
      setCloningId(row.id);
      await shippingApi.clone(row.id);
      toast.success("Transportista clonado. Revisá y activá la copia.");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo clonar el transportista.");
    } finally {
      setCloningId(null);
    }
  }

  /* ---- eliminar ---- */
  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      setBusyDelete(true);
      await shippingApi.remove(deleteTarget.id);
      toast.success("Transportista eliminado.");
      setDeleteOpen(false);
      setDeleteTarget(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo eliminar el transportista.");
    } finally {
      setBusyDelete(false);
    }
  }

  /* ---- errores en tiempo real ---- */
  const errors = submitted ? formErrors : {};

  /* =========================================================
     RENDER
  ========================================================= */
  return (
    <TPSectionShell
      title="Envíos y Logística"
      subtitle="Transportistas, tarifas y parámetros de envío"
      icon={<Truck size={22} />}
    >
      <TPTableKit<ShippingCarrierRow>
        rows={filteredRows}
        columns={ENV_COLS}
        storageKey="tptech_envios_colvis"
        search={q}
        onSearchChange={setQ}
        searchPlaceholder="Buscar..."
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={toggleSort}
        loading={loading}
        emptyText={
          q
            ? "No hay resultados para esa búsqueda."
            : "Todavía no hay transportistas. Creá el primero."
        }
        actions={
          <TPButton
            variant="primary"
            iconLeft={<Plus size={16} />}
            onClick={openCreate}
          >
            Nuevo transportista
          </TPButton>
        }
        renderRow={(row, vis) => (
          <TPTr key={row.id} className={!row.isActive ? "opacity-60" : undefined}>
            {/* Nombre / Código */}
            {vis.name && (
              <TPTd>
                <div className="flex items-center gap-2 min-w-0">
                  {/* Logo o ícono */}
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-surface2 text-muted overflow-hidden">
                    {row.logoUrl ? (
                      <img
                        src={row.logoUrl}
                        alt={row.name}
                        className="h-full w-full object-contain p-1"
                      />
                    ) : (
                      <Truck size={16} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-text truncate">
                        {row.name}
                      </span>
                      {row.isFavorite && (
                        <Star
                          size={12}
                          className="shrink-0 fill-yellow-400 text-yellow-400"
                        />
                      )}
                    </div>
                    {row.code && (
                      <div className="text-xs text-muted font-mono mt-0.5">
                        {row.code}
                      </div>
                    )}
                  </div>
                </div>
              </TPTd>
            )}

            {/* Tarifas */}
            {vis.tarifas && (
              <TPTd className="hidden md:table-cell">
                <span className="text-sm text-muted">
                  {row.rates && row.rates.length > 0
                    ? `${row.rates.length} tarifa${row.rates.length !== 1 ? "s" : ""}`
                    : "Sin tarifas"}
                </span>
              </TPTd>
            )}

            {/* Envío gratis */}
            {vis.enviogratis && (
              <TPTd className="hidden md:table-cell">
                <span className="text-sm text-muted">
                  {row.freeShippingThreshold
                    ? formatCurrency(row.freeShippingThreshold)
                    : "No aplica"}
                </span>
              </TPTd>
            )}

            {/* Estado */}
            {vis.estado && (
              <TPTd className="hidden md:table-cell">
                <TPStatusPill active={row.isActive} />
              </TPTd>
            )}

            {/* Acciones */}
            {vis.acciones && (
              <TPTd className="text-right">
                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                  {/* estado en mobile */}
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
        )}
      />

      {/* =========================================================
          MODAL CREAR / EDITAR
      ========================================================= */}
      <Modal
        open={editOpen}
        title={editTarget ? "Editar transportista" : "Nuevo transportista"}
        maxWidth="2xl"
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
          {/* ---- Sección: Transportista ---- */}
          <ModalSection title="Transportista">
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
                  placeholder="Ej: OCA, Andreani, Correo Argentino"
                  disabled={busySave}
                  data-tp-autofocus="1"
                />
              </TPField>

              {/* Código */}
              <TPField
                label="Código"
                hint="Se genera automáticamente si lo dejás vacío."
              >
                <TPInput
                  value={draft.code}
                  onChange={(v) => patchDraft({ code: v })}
                  placeholder="Ej: OCA"
                  disabled={busySave}
                />
              </TPField>

              {/* URL de seguimiento */}
              <TPField
                label="URL de seguimiento"
                hint='Usá {CODIGO} como placeholder para el número de seguimiento.'
              >
                <TPInput
                  value={draft.trackingUrl}
                  onChange={(v) => patchDraft({ trackingUrl: v })}
                  placeholder="https://..."
                  disabled={busySave}
                />
              </TPField>

              {/* Logo URL */}
              <TPField
                label="Logo URL"
                className="sm:col-span-2"
              >
                <TPInput
                  value={draft.logoUrl}
                  onChange={(v) => patchDraft({ logoUrl: v })}
                  placeholder="https://..."
                  disabled={busySave}
                />
                {draft.logoUrl.trim() && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-surface2 overflow-hidden">
                      <img
                        src={draft.logoUrl.trim()}
                        alt="Vista previa del logo"
                        className="h-full w-full object-contain p-1"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted">Vista previa</span>
                  </div>
                )}
              </TPField>
            </div>
          </ModalSection>

          {/* ---- Sección: Envío gratuito ---- */}
          <ModalSection title="Envío gratuito">
            <div className="space-y-3">
              <TPCheckbox
                checked={draft.hasFreeShipping}
                onChange={(v) => {
                  patchDraft({ hasFreeShipping: v, freeShippingThreshold: "" });
                  if (!v) setFreeShippingNum(null);
                }}
                disabled={busySave}
                label={
                  <span className="text-sm text-text">
                    ¿Tiene envío gratuito?
                  </span>
                }
              />

              {draft.hasFreeShipping && (
                <TPField label="Envío gratis a partir de $">
                  <TPNumberInput
                    value={freeShippingNum}
                    onChange={(v) => {
                      setFreeShippingNum(v);
                      patchDraft({ freeShippingThreshold: v != null ? String(v) : "" });
                    }}
                    decimals={2}
                    step={1}
                    min={0}
                    placeholder="Ej: 5000"
                    disabled={busySave}
                  />
                </TPField>
              )}
            </div>
          </ModalSection>

          {/* ---- Sección: Tarifas ---- */}
          <ModalSection title="Tarifas">
            <RatesEditor
              rates={ratesDraft}
              onChange={setRatesDraft}
              disabled={busySave}
            />
          </ModalSection>

          {/* ---- Sección: General (solo en edición) ---- */}
          {editTarget && (
            <ModalSection title="General">
              <div className="space-y-3">
                <TPCheckbox
                  checked={draft.isFavorite}
                  onChange={(v) => patchDraft({ isFavorite: v })}
                  disabled={busySave}
                  label={
                    <span className="text-sm text-text">Favorito</span>
                  }
                />
                <TPCheckbox
                  checked={draft.isActive}
                  onChange={(v) => patchDraft({ isActive: v })}
                  disabled={busySave}
                  label={
                    <span className="text-sm text-text">Transportista activo</span>
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
        title={viewTarget?.name ?? "Detalle de transportista"}
        maxWidth="lg"
        onClose={() => setViewOpen(false)}
        footer={
          <TPButton variant="secondary" onClick={() => setViewOpen(false)}>
            Cerrar
          </TPButton>
        }
      >
        {viewTarget && (
          <div className="space-y-1 text-sm">
            <DetailRow label="Nombre">{viewTarget.name}</DetailRow>

            <DetailRow label="Código">
              {viewTarget.code ? (
                <span className="font-mono">{viewTarget.code}</span>
              ) : (
                <span className="text-muted italic">Sin código</span>
              )}
            </DetailRow>

            <DetailRow label="URL de seguimiento">
              {viewTarget.trackingUrl ? (
                <a
                  href={viewTarget.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 break-all"
                >
                  {viewTarget.trackingUrl}
                </a>
              ) : (
                <span className="text-muted italic">Sin URL</span>
              )}
            </DetailRow>

            <DetailRow label="Envío gratis desde">
              {viewTarget.freeShippingThreshold
                ? formatCurrency(viewTarget.freeShippingThreshold)
                : "No aplica"}
            </DetailRow>

            <DetailRow label="Estado">
              <TPStatusPill active={viewTarget.isActive} />
            </DetailRow>

            <DetailRow label="Favorito">
              {viewTarget.isFavorite ? "Sí" : "No"}
            </DetailRow>

            {/* Tabla de tarifas */}
            {viewTarget.rates && viewTarget.rates.length > 0 ? (
              <div className="py-2 border-b border-border">
                <div className="text-muted font-medium mb-2">
                  Tarifas ({viewTarget.rates.length})
                </div>
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="hidden md:grid grid-cols-[1fr_1fr_160px_160px_60px] gap-2 bg-surface2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    <div>Nombre</div>
                    <div>Zona</div>
                    <div>Modo</div>
                    <div>Precio</div>
                    <div className="text-center">Activo</div>
                  </div>
                  <div className="divide-y divide-border">
                    {viewTarget.rates.map((rate, idx) => (
                      <div
                        key={rate.id ?? idx}
                        className="flex flex-col gap-1 px-3 py-2.5 md:grid md:grid-cols-[1fr_1fr_160px_160px_60px] md:items-center md:gap-2"
                      >
                        <div className="text-sm font-medium text-text">
                          {rate.name || <span className="text-muted italic">Sin nombre</span>}
                        </div>
                        <div className="text-sm text-muted">
                          {rate.zone || "—"}
                        </div>
                        <div className="text-xs text-muted">
                          {CALC_MODE_LABELS[rate.calculationMode]}
                        </div>
                        <div className="text-sm text-text">
                          {rate.calculationMode === "FIXED" &&
                            (rate.fixedPrice
                              ? formatCurrency(rate.fixedPrice)
                              : "—")}
                          {rate.calculationMode === "BY_WEIGHT" && (
                            <div>
                              {rate.pricePerKg
                                ? `${formatCurrency(rate.pricePerKg)}/kg`
                                : "—"}
                              {(rate.minWeight || rate.maxWeight) && (
                                <div className="text-xs text-muted mt-0.5">
                                  {rate.minWeight
                                    ? `Min: ${parseFloat(rate.minWeight)} kg`
                                    : ""}
                                  {rate.minWeight && rate.maxWeight ? " / " : ""}
                                  {rate.maxWeight
                                    ? `Max: ${parseFloat(rate.maxWeight)} kg`
                                    : ""}
                                </div>
                              )}
                            </div>
                          )}
                          {rate.calculationMode === "BY_ZONE" && "—"}
                        </div>
                        <div className="flex items-center gap-1.5 md:justify-center">
                          <span className="text-xs text-muted md:hidden">Activo:</span>
                          <span
                            className={cn(
                              "inline-flex h-2 w-2 rounded-full",
                              rate.isActive ? "bg-green-500" : "bg-surface2"
                            )}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <DetailRow label="Tarifas">
                <span className="text-muted italic">Sin tarifas configuradas</span>
              </DetailRow>
            )}

            {viewTarget.notes && (
              <div className="flex flex-col gap-1 py-2 border-b border-border">
                <span className="text-muted font-medium">Notas</span>
                <span className="text-text whitespace-pre-wrap">{viewTarget.notes}</span>
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
        description="¿Estás seguro que querés eliminar este transportista? Esta acción no se puede deshacer."
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
