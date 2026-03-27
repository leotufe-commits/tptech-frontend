import React, { useEffect, useMemo, useState } from "react";
import { useConfirmDelete } from "../../hooks/useConfirmDelete";
import {
  Plus,
  Save,
  Truck,
  Bookmark,
  Trash,
  Store,
  X,
  Copy,
  ShieldCheck,
  ShieldBan,
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

function SystemBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-medium text-violet-600 dark:text-violet-400 whitespace-nowrap">
      Sistema
    </span>
  );
}
import TPComboFixed from "../../components/ui/TPComboFixed";
import TPNumberInput from "../../components/ui/TPNumberInput";
import { TPCard } from "../../components/ui/TPCard";

import { apiFetch } from "../../lib/api";
import { toast } from "../../lib/toast";
import TPComboCreatableMulti from "../../components/ui/TPComboCreatableMulti";
import { useCatalog } from "../../hooks/useCatalog";
import type { CatalogItem } from "../../services/catalogs";
import {
  shippingApi,
  type ShippingCarrierRow,
  type ShippingCarrierPayload,
  type ShippingCalcMode,
  type ShippingCarrierType,
} from "../../services/shipping";

/* =========================================================
   Tipos
========================================================= */
type WarehouseOption = {
  id: string;
  name: string;
  isActive: boolean;
  street?: string;
  number?: string;
  city?: string;
  province?: string;
};

/* =========================================================
   Label maps
========================================================= */
const CALC_MODE_LABELS: Record<ShippingCalcMode, string> = {
  FIXED: "Precio fijo",
  BY_ZONE: "Por zona",
  BY_WEIGHT: "Por peso ($/kg)",
};

const CALC_MODE_ORDER: ShippingCalcMode[] = ["FIXED", "BY_ZONE", "BY_WEIGHT"];


/* =========================================================
   Draft de tarifa
========================================================= */
type RateDraft = {
  id?: string;
  name: string;
  zones: string[];
  province: string[];
  countries: string[];
  calculationMode: ShippingCalcMode;
  fixedPrice: string;
  pricePerKg: string;
  minWeight: string;
  maxWeight: string;
  isActive: boolean;
};

const EMPTY_RATE: RateDraft = {
  name: "",
  zones: [],
  province: [],
  countries: [],
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
  type: ShippingCarrierType;
  warehouseId: string;
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
  type: "DELIVERY",
  warehouseId: "",
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

function warehouseLabel(wh: WarehouseOption): string {
  const parts = [wh.name];
  if (wh.street) parts.push(wh.street + (wh.number ? ` ${wh.number}` : ""));
  if (wh.city) parts.push(wh.city);
  return parts.join(" · ");
}

/* =========================================================
   Componentes pequeños
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
      <span className="text-text text-right break-words min-w-0">
        {children}
      </span>
    </div>
  );
}

/* =========================================================
   Validación
========================================================= */
type FormErrors = {
  name?: string;
  warehouseId?: string;
  rateNames?: string;
};

function validate(draft: CarrierDraft, rates: RateDraft[]): FormErrors {
  const errors: FormErrors = {};

  if (!draft.name.trim()) {
    errors.name = "El nombre es obligatorio.";
  }

  if (draft.type === "PICKUP" && !draft.warehouseId) {
    errors.warehouseId = "Seleccioná un almacén para retiro en sucursal.";
  }

  const rateNameList = rates
    .map((r) => r.name.trim().toLowerCase())
    .filter(Boolean);

  if (rateNameList.some((n, i) => rateNameList.indexOf(n) !== i)) {
    errors.rateNames =
      "Hay tarifas con nombres duplicados. Cada nombre de envío debe ser único.";
  }

  return errors;
}

/* =========================================================
   Editor de tarifas (card por tarifa)
========================================================= */
function RatesEditor({
  rates,
  onChange,
  disabled,
  duplicateNames,
  cityItems,
  provinceItems,
  countryItems,
  onRefreshCity,
  onRefreshProvince,
  onRefreshCountry,
  onCreateCity,
  onCreateProvince,
  onCreateCountry,
}: {
  rates: RateDraft[];
  onChange: (rates: RateDraft[]) => void;
  disabled: boolean;
  duplicateNames: Set<string>;
  cityItems: CatalogItem[];
  provinceItems: CatalogItem[];
  countryItems: CatalogItem[];
  onRefreshCity: () => void;
  onRefreshProvince: () => void;
  onRefreshCountry: () => void;
  onCreateCity: (label: string) => Promise<void>;
  onCreateProvince: (label: string) => Promise<void>;
  onCreateCountry: (label: string) => Promise<void>;
}) {
  const newRateRef = React.useRef<HTMLDivElement | null>(null);

  function addRate() {
    onChange([...rates, { ...EMPTY_RATE }]);
    setTimeout(() => {
      newRateRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 50);
  }

  function removeRate(index: number) {
    onChange(rates.filter((_, i) => i !== index));
  }

  function cloneRate(index: number) {
    const original = rates[index];
    const baseName = original.name.trim() || "Tarifa";
    const existingNames = rates.map((r) => r.name.trim().toLowerCase());

    let candidateName = `${baseName} (copia)`;
    let counter = 2;

    while (existingNames.includes(candidateName.toLowerCase())) {
      candidateName = `${baseName} (copia ${counter})`;
      counter++;
    }

    const cloned: RateDraft = {
      ...original,
      id: undefined,
      name: candidateName,
    };

    const next = [...rates];
    next.splice(index + 1, 0, cloned);
    onChange(next);

    setTimeout(() => {
      newRateRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 50);
  }

  function patchRate(index: number, patch: Partial<RateDraft>) {
    onChange(rates.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-3">
      {rates.map((rate, idx) => {
        const normalizedName = rate.name.trim().toLowerCase();
        const isDuplicate =
          normalizedName !== "" && duplicateNames.has(normalizedName);
        const isLast = idx === rates.length - 1;

        return (
          <div
            key={idx}
            ref={isLast ? newRateRef : undefined}
            className={cn(
              "rounded-xl border overflow-hidden",
              isDuplicate ? "border-red-400" : "border-border"
            )}
          >
            <div className="flex items-center gap-2 bg-surface2/50 px-4 py-3">
              <span className="text-xs font-bold text-muted w-5 shrink-0 select-none">
                {idx + 1}
              </span>

              <div className="flex-1 min-w-0">
                <TPInput
                  value={rate.name}
                  onChange={(v) => patchRate(idx, { name: v })}
                  disabled={disabled}
                  placeholder="Nombre de envío"
                  className="text-sm font-medium"
                />
                {isDuplicate && (
                  <p className="mt-1 text-xs text-red-500">
                    Ya existe una tarifa con ese nombre.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <TPStatusPill active={rate.isActive} />
                <button
                  type="button"
                  onClick={() => patchRate(idx, { isActive: !rate.isActive })}
                  disabled={disabled}
                  title={rate.isActive ? "Desactivar" : "Activar"}
                  className="tp-btn-secondary h-8 w-8 !p-0 grid place-items-center shrink-0"
                >
                  {rate.isActive ? (
                    <ShieldCheck size={15} className="text-muted" />
                  ) : (
                    <ShieldBan size={15} className="text-muted" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => cloneRate(idx)}
                  disabled={disabled}
                  title="Clonar tarifa"
                  className="tp-btn-secondary h-8 w-8 !p-0 grid place-items-center shrink-0"
                >
                  <Copy size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => removeRate(idx)}
                  disabled={disabled}
                  title="Eliminar tarifa"
                  className="tp-btn-secondary h-8 w-8 !p-0 grid place-items-center shrink-0 text-red-500 hover:text-red-600"
                >
                  <Trash size={14} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 py-3 border-t border-border/60">
              <TPField label="Zonas / Ciudades">
                <TPComboCreatableMulti
                  type="CITY"
                  items={cityItems}
                  values={rate.zones}
                  onChange={(v) => patchRate(idx, { zones: v })}
                  disabled={disabled}
                  placeholder="Ej: CABA, GBA Norte"
                  mode="create"
                  noLabelSpace
                  onRefresh={onRefreshCity}
                  allowCreate
                  onCreate={onCreateCity}
                />
              </TPField>

              <TPField label="Provincia">
                <TPComboCreatableMulti
                  type="PROVINCE"
                  items={provinceItems}
                  values={rate.province}
                  onChange={(v) => patchRate(idx, { province: v })}
                  placeholder="Ej: Buenos Aires"
                  disabled={disabled}
                  mode="create"
                  noLabelSpace
                  onRefresh={onRefreshProvince}
                  allowCreate
                  onCreate={onCreateProvince}
                />
              </TPField>

              <TPField label="Países">
                <TPComboCreatableMulti
                  type="COUNTRY"
                  items={countryItems}
                  values={rate.countries}
                  onChange={(v) => patchRate(idx, { countries: v })}
                  disabled={disabled}
                  placeholder="Ej: Argentina"
                  mode="create"
                  noLabelSpace
                  onRefresh={onRefreshCountry}
                  allowCreate
                  onCreate={onCreateCountry}
                />
              </TPField>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 px-4 py-3 border-t border-border/60">
              <TPField label="Modo de cálculo" className="sm:w-[200px] shrink-0">
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
                  options={CALC_MODE_ORDER.map((k) => ({
                    value: k,
                    label: CALC_MODE_LABELS[k],
                  }))}
                  className="text-sm"
                />
              </TPField>

              {rate.calculationMode === "FIXED" && (
                <TPField label="Precio fijo" className="flex-1">
                  <TPNumberInput
                    value={rate.fixedPrice ? parseFloat(rate.fixedPrice) : null}
                    onChange={(v) =>
                      patchRate(idx, { fixedPrice: v != null ? String(v) : "" })
                    }
                    disabled={disabled}
                    placeholder="0,00"
                    decimals={2}
                    step={1}
                    min={0}
                    className="text-sm"
                    leftIcon={<span className="text-xs font-semibold">$</span>}
                  />
                </TPField>
              )}

              {rate.calculationMode === "BY_WEIGHT" && (
                <div className="flex flex-1 flex-wrap gap-3">
                  <TPField label="Por kg" className="w-[140px]">
                    <TPNumberInput
                      value={
                        rate.pricePerKg ? parseFloat(rate.pricePerKg) : null
                      }
                      onChange={(v) =>
                        patchRate(idx, {
                          pricePerKg: v != null ? String(v) : "",
                        })
                      }
                      disabled={disabled}
                      placeholder="0,00"
                      decimals={2}
                      step={1}
                      min={0}
                      className="text-sm"
                      leftIcon={<span className="text-xs font-semibold">$</span>}
                    />
                  </TPField>

                  <TPField label="Peso mín (kg)" className="w-[120px]">
                    <TPNumberInput
                      value={rate.minWeight ? parseFloat(rate.minWeight) : null}
                      onChange={(v) =>
                        patchRate(idx, {
                          minWeight: v != null ? String(v) : "",
                        })
                      }
                      disabled={disabled}
                      placeholder="0"
                      decimals={1}
                      step={0.1}
                      min={0}
                      className="text-sm"
                    />
                  </TPField>

                  <TPField label="Peso máx (kg)" className="w-[120px]">
                    <TPNumberInput
                      value={rate.maxWeight ? parseFloat(rate.maxWeight) : null}
                      onChange={(v) =>
                        patchRate(idx, {
                          maxWeight: v != null ? String(v) : "",
                        })
                      }
                      disabled={disabled}
                      placeholder="∞"
                      decimals={1}
                      step={0.1}
                      min={0}
                      className="text-sm"
                    />
                  </TPField>
                </div>
              )}

              {rate.calculationMode === "BY_ZONE" && (
                <TPField label="Precio por zona" className="flex-1">
                  <TPNumberInput
                    value={rate.fixedPrice ? parseFloat(rate.fixedPrice) : null}
                    onChange={(v) =>
                      patchRate(idx, { fixedPrice: v != null ? String(v) : "" })
                    }
                    disabled={disabled}
                    placeholder="0,00"
                    decimals={2}
                    step={1}
                    min={0}
                    className="text-sm"
                    leftIcon={<span className="text-xs font-semibold">$</span>}
                  />
                </TPField>
              )}
            </div>
          </div>
        );
      })}

      <TPButton
        variant="secondary"
        iconLeft={<Plus size={14} />}
        onClick={addRate}
        disabled={disabled}
      >
        Agregar tarifa
      </TPButton>
    </div>
  );
}

const ENV_COLS: TPColDef[] = [
  { key: "name", label: "Nombre / Código", canHide: false, sortKey: "name" },
  { key: "tipo", label: "Tipo", sortKey: "tipo" },
  { key: "tarifas", label: "Tarifas", sortKey: "tarifas" },
  { key: "enviogratis", label: "Envío gratis desde", sortKey: "enviogratis" },
  { key: "estado", label: "Estado", sortKey: "estado" },
  { key: "acciones", label: "Acciones", canHide: false, align: "right" },
];

/* =========================================================
   Página principal
========================================================= */
export default function ConfiguracionSistemaEnvios() {
  const [rows, setRows] = useState<ShippingCarrierRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [loading, setLoading] = useState(false);

  const cityCat = useCatalog("CITY");
  const provinceCat = useCatalog("PROVINCE");
  const countryCat = useCatalog("COUNTRY");
  const [q, setQ] = useState("");

  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ShippingCarrierRow | null>(null);
  const [draft, setDraft] = useState<CarrierDraft>(EMPTY_DRAFT);
  const [ratesDraft, setRatesDraft] = useState<RateDraft[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const [freeShippingNum, setFreeShippingNum] = useState<number | null>(null);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<ShippingCarrierRow | null>(null);

  const { askDelete, dialogProps: deleteDialogProps } = useConfirmDelete();

  const [busySave, setBusySave] = useState(false);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [favoritingId, setFavoritingId] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      const [data, whs] = await Promise.all([
        shippingApi.list(),
        apiFetch<WarehouseOption[]>("/warehouses", {
          method: "GET",
          on401: "throw",
        }),
      ]);
      setRows(data);
      setWarehouses(whs.filter((w) => w.isActive));
    } catch (e: any) {
      toast.error(e?.message || "No se pudo cargar la lista de transportistas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

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
      switch (sortKey) {
        case "tipo":
          return a.type.localeCompare(b.type, "es") * mul;
        case "tarifas":
          return ((a.rates?.length ?? 0) - (b.rates?.length ?? 0)) * mul;
        case "enviogratis": {
          const fa = parseFloat(a.freeShippingThreshold ?? "") || 0;
          const fb = parseFloat(b.freeShippingThreshold ?? "") || 0;
          return (fa - fb) * mul;
        }
        case "estado":
          return ((a.isActive ? 1 : 0) - (b.isActive ? 1 : 0)) * mul;
        default:
          return String(a.name ?? "").localeCompare(String(b.name ?? ""), "es") * mul;
      }
    });
  }, [rows, q, sortKey, sortDir]);

  const warehouseOptions = useMemo(
    () => warehouses.map((w) => ({ value: w.id, label: warehouseLabel(w) })),
    [warehouses]
  );

  function patchDraft(patch: Partial<CarrierDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function openCreate() {
    setEditTarget(null);
    setDraft(EMPTY_DRAFT);
    setRatesDraft([]);
    setFreeShippingNum(null);
    setSubmitted(false);
    setFormErrors({});
    setEditOpen(true);
  }

  function openEdit(row: ShippingCarrierRow) {
    setEditTarget(row);

    const threshold =
      row.freeShippingThreshold != null
        ? parseFloat(row.freeShippingThreshold)
        : null;

    setDraft({
      type: row.type,
      warehouseId: row.warehouseId ?? "",
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
        zones: Array.isArray(rate.zones) ? rate.zones : [],
        province: rate.province
          ? rate.province
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        countries: Array.isArray(rate.countries) ? rate.countries : [],
        calculationMode: rate.calculationMode,
        fixedPrice:
          rate.fixedPrice != null ? String(parseFloat(rate.fixedPrice)) : "",
        pricePerKg:
          rate.pricePerKg != null ? String(parseFloat(rate.pricePerKg)) : "",
        minWeight:
          rate.minWeight != null ? String(parseFloat(rate.minWeight)) : "",
        maxWeight:
          rate.maxWeight != null ? String(parseFloat(rate.maxWeight)) : "",
        isActive: rate.isActive,
      }))
    );

    setSubmitted(false);
    setFormErrors({});
    setEditOpen(true);
  }

  function openView(row: ShippingCarrierRow) {
    setViewTarget(row);
    setViewOpen(true);
  }


  async function handleSave() {
    setSubmitted(true);
    const errors = validate(draft, ratesDraft);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const isPickup = draft.type === "PICKUP";

    const payload: ShippingCarrierPayload = {
      name: draft.name.trim(),
      code: draft.code.trim() || undefined,
      trackingUrl: isPickup
        ? undefined
        : draft.trackingUrl.trim() || undefined,
      logoUrl: draft.logoUrl.trim() || undefined,
      freeShippingThreshold:
        !isPickup && draft.hasFreeShipping
          ? freeShippingNum != null
            ? freeShippingNum
            : null
          : null,
      warehouseId: isPickup ? draft.warehouseId : undefined,
      isFavorite: draft.isFavorite,
      isActive: draft.isActive,
      notes: draft.notes.trim(),
      rates: isPickup
        ? undefined
        : ratesDraft.map((r, idx) => ({
            id: r.id,
            name: r.name.trim(),
            zones: r.zones,
            province:
              r.province.length === 0
                ? ""
                : r.province.length === 1
                ? r.province[0]
                : r.province.join(", "),
            countries: r.countries,
            calculationMode: r.calculationMode,
            fixedPrice:
              (r.calculationMode === "FIXED" || r.calculationMode === "BY_ZONE") &&
              r.fixedPrice
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

    if (!editTarget) {
      payload.type = draft.type;
    }

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

  async function handleToggle(row: ShippingCarrierRow) {
    try {
      setTogglingId(row.id);
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, isActive: !r.isActive } : r))
      );
      await shippingApi.toggle(row.id);
      toast.success(
        row.isActive
          ? "Transportista desactivado."
          : "Transportista activado."
      );
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

  async function handleFavorite(row: ShippingCarrierRow) {
    try {
      setFavoritingId(row.id);
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, isFavorite: !r.isFavorite } : r
        )
      );
      await shippingApi.favorite(row.id);
      toast.success(
        row.isFavorite
          ? "Transportista removido de favoritos."
          : "Transportista marcado como favorito."
      );
      await load();
    } catch (e: any) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, isFavorite: row.isFavorite } : r
        )
      );
      toast.error(e?.message || "No se pudo actualizar el favorito.");
    } finally {
      setFavoritingId(null);
    }
  }

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


  const errors = submitted ? formErrors : {};
  const isPickupDraft = draft.type === "PICKUP";

  const duplicateRateNames = useMemo(() => {
    const nameCount = new Map<string, number>();
    ratesDraft.forEach((r) => {
      const n = r.name.trim().toLowerCase();
      if (n) nameCount.set(n, (nameCount.get(n) ?? 0) + 1);
    });

    return new Set(
      [...nameCount.entries()].filter(([, c]) => c > 1).map(([n]) => n)
    );
  }, [ratesDraft]);

  return (
    <TPSectionShell
      title="Envíos y Logística"
      subtitle="Transportistas, tarifas y parámetros de envío"
      icon={<Truck size={22} />}
    >
      <TPTableKit<ShippingCarrierRow>
        pagination
        rows={filteredRows}
        columns={ENV_COLS}
        storageKey="tptech_envios_colvis_v3"
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
        onRowClick={(row) => openView(row)}
        renderRow={(row, vis) => (
          <TPTr key={row.id} className={!row.isActive ? "opacity-60" : undefined}>
            {vis.name && (
              <TPTd>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-surface2 text-muted overflow-hidden">
                    {row.logoUrl ? (
                      <img
                        src={row.logoUrl}
                        alt={row.name}
                        className="h-full w-full object-contain p-1"
                      />
                    ) : row.type === "PICKUP" ? (
                      <Store size={16} />
                    ) : (
                      <Truck size={16} />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-text truncate">
                        {row.name}
                      </span>
                      {row.isSystem && <SystemBadge />}
                    </div>


                    {row.type === "PICKUP" && row.warehouse && (
                      <div className="text-xs text-muted mt-0.5 truncate">
                        {row.warehouse.name}
                        {row.warehouse.city ? ` · ${row.warehouse.city}` : ""}
                      </div>
                    )}
                  </div>
                </div>
              </TPTd>
            )}

            {vis.tipo && (
              <TPTd className="hidden md:table-cell">
                <span className="text-sm text-muted">
                  {row.type === "PICKUP" ? "Retiro" : "Envío"}
                </span>
              </TPTd>
            )}

            {vis.tarifas && (
              <TPTd className="hidden md:table-cell">
                {row.type === "PICKUP" ? (
                  <span className="text-sm text-muted">Gratis</span>
                ) : row.rates && row.rates.length > 0 ? (
                  <div className="space-y-0.5">
                    {row.rates.map((r, i) => {
                      const precio =
                        r.calculationMode === "BY_WEIGHT"
                          ? r.pricePerKg
                            ? `${formatCurrency(r.pricePerKg)}/kg`
                            : "—"
                          : r.fixedPrice
                          ? formatCurrency(r.fixedPrice)
                          : "—";
                      return (
                        <div key={r.id ?? i} className="text-xs space-y-0.5">
                          <div className="font-medium text-text truncate max-w-[200px]">{r.name}</div>
                          <div className="text-muted flex flex-wrap gap-x-1.5">
                            <span>{CALC_MODE_LABELS[r.calculationMode]}</span>
                            <span>·</span>
                            <span>{precio}</span>
                            {Array.isArray(r.zones) && r.zones.length > 0 && (
                              <>
                                <span>·</span>
                                <span className="truncate max-w-[120px]">{r.zones.join(", ")}</span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <span className="text-sm text-muted">Sin tarifas</span>
                )}
              </TPTd>
            )}

            {vis.enviogratis && (
              <TPTd className="hidden md:table-cell">
                <span className="text-sm text-muted">
                  {row.type === "PICKUP"
                    ? "—"
                    : row.freeShippingThreshold
                    ? formatCurrency(row.freeShippingThreshold)
                    : "No aplica"}
                </span>
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
                      entityName: "transportista",
                      entityLabel: row.name,
                      onDelete: () => shippingApi.remove(row.id),
                      onAfterSuccess: load,
                    })}
                  />
                </div>
              </TPTd>
            )}
          </TPTr>
        )}
      />

      <Modal
        open={editOpen}
        title={editTarget ? "Editar transportista" : "Nuevo transportista"}
        maxWidth="6xl"
        busy={busySave}
        onClose={() => !busySave && setEditOpen(false)}
        onEnter={handleSave}
        footer={
          <>
            <TPButton
              variant="secondary"
              iconLeft={<X size={16} />}
              onClick={() => setEditOpen(false)}
              disabled={busySave}
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
        <div className="space-y-4">

          {editTarget && draft.type === "PICKUP" && (
            <TPCard title="Almacén de retiro">
              <TPField label="Almacén" required error={errors.warehouseId}>
                <TPComboFixed
                  value={draft.warehouseId}
                  onChange={(v) => patchDraft({ warehouseId: v })}
                  options={[
                    { value: "", label: "Seleccioná un almacén…" },
                    ...warehouseOptions,
                  ]}
                  disabled={busySave}
                />
              </TPField>
            </TPCard>
          )}

          <TPCard title="Transportista" collapsible>
            <div className="space-y-4">
              <TPField label="Nombre" required error={errors.name}>
                <TPInput
                  value={draft.name}
                  onChange={(v) => patchDraft({ name: v })}
                  placeholder={
                    isPickupDraft
                      ? "Ej: Retiro San Martín"
                      : "Ej: OCA, Andreani, Correo Argentino"
                  }
                  disabled={busySave}
                  data-tp-autofocus="1"
                />
              </TPField>
            </div>
          </TPCard>

          {!isPickupDraft && (
            <TPCard title="Tarifas">
              <RatesEditor
                rates={ratesDraft}
                onChange={setRatesDraft}
                disabled={busySave}
                duplicateNames={duplicateRateNames}
                cityItems={cityCat.items}
                provinceItems={provinceCat.items}
                countryItems={countryCat.items}
                onRefreshCity={() => void cityCat.refresh()}
                onRefreshProvince={() => void provinceCat.refresh()}
                onRefreshCountry={() => void countryCat.refresh()}
                onCreateCity={cityCat.createItem}
                onCreateProvince={provinceCat.createItem}
                onCreateCountry={countryCat.createItem}
              />

              {errors.rateNames && (
                <p className="mt-2 text-sm text-red-500">{errors.rateNames}</p>
              )}
            </TPCard>
          )}

          {!isPickupDraft && (
            <TPCard title="Envío gratuito">
              <div className="space-y-3">
                <TPCheckbox
                  checked={draft.hasFreeShipping}
                  onChange={(v) => {
                    patchDraft({
                      hasFreeShipping: v,
                      freeShippingThreshold: "",
                    });
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
                  <TPField label="Envío gratis a partir de">
                    <TPNumberInput
                      value={freeShippingNum}
                      onChange={(v) => {
                        setFreeShippingNum(v);
                        patchDraft({
                          freeShippingThreshold: v != null ? String(v) : "",
                        });
                      }}
                      decimals={2}
                      step={1}
                      min={0}
                      placeholder="Ej: 5000"
                      disabled={busySave}
                      leftIcon={<span className="text-xs font-semibold">$</span>}
                    />
                  </TPField>
                )}
              </div>
            </TPCard>
          )}

          <TPCard title="Notas">
            <TPTextarea
              value={draft.notes}
              onChange={(v) => patchDraft({ notes: v })}
              placeholder="Notas internas opcionales…"
              disabled={busySave}
              minH={80}
            />
          </TPCard>
        </div>
      </Modal>

      <Modal
        open={viewOpen}
        title={viewTarget?.name ?? "Detalle de transportista"}
        maxWidth="4xl"
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

            {viewTarget.code && (
              <DetailRow label="Código">
                <span className="font-mono text-sm">{viewTarget.code}</span>
              </DetailRow>
            )}

            <DetailRow label="Favorito">
              {viewTarget.isFavorite ? "Sí ⭐" : "No"}
            </DetailRow>

            <DetailRow label="Tipo">
              {viewTarget.type === "PICKUP"
                ? "Retiro en sucursal"
                : "Envío a domicilio"}
            </DetailRow>


            {viewTarget.type === "PICKUP" ? (
              <DetailRow label="Almacén de retiro">
                {viewTarget.warehouse ? (
                  <div className="text-right">
                    <div className="font-medium">{viewTarget.warehouse.name}</div>
                    {(viewTarget.warehouse.street || viewTarget.warehouse.city) && (
                      <div className="text-xs text-muted mt-0.5">
                        {[
                          viewTarget.warehouse.street
                            ? `${viewTarget.warehouse.street}${
                                viewTarget.warehouse.number
                                  ? ` ${viewTarget.warehouse.number}`
                                  : ""
                              }`
                            : null,
                          viewTarget.warehouse.city,
                          viewTarget.warehouse.province,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-muted italic">
                    Sin almacén asignado
                  </span>
                )}
              </DetailRow>
            ) : (
              <>
                <DetailRow label="Envío gratis desde">
                  {viewTarget.freeShippingThreshold
                    ? formatCurrency(viewTarget.freeShippingThreshold)
                    : "No aplica"}
                </DetailRow>
              </>
            )}

            <DetailRow label="Estado">
              <TPStatusPill active={viewTarget.isActive} />
            </DetailRow>


            {viewTarget.type !== "PICKUP" &&
              (viewTarget.rates && viewTarget.rates.length > 0 ? (
                <div className="py-2 border-b border-border">
                  <div className="text-muted font-medium mb-2">
                    Tarifas ({viewTarget.rates.length})
                  </div>

                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_140px_140px_50px] gap-2 bg-surface2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
                      <div>Nombre</div>
                      <div>Zonas</div>
                      <div>Provincia / Países</div>
                      <div>Modo</div>
                      <div>Precio</div>
                      <div className="text-center">Activo</div>
                    </div>

                    <div className="divide-y divide-border">
                      {viewTarget.rates.map((rate, idx) => (
                        <div
                          key={rate.id ?? idx}
                          className="flex flex-col gap-1 px-3 py-2.5 md:grid md:grid-cols-[1fr_1fr_1fr_140px_140px_50px] md:items-center md:gap-2"
                        >
                          <div className="text-sm font-medium text-text">
                            {rate.name || (
                              <span className="text-muted italic">
                                Sin nombre
                              </span>
                            )}
                          </div>

                          <div className="text-sm text-muted">
                            {Array.isArray(rate.zones) && rate.zones.length > 0
                              ? rate.zones.join(", ")
                              : "—"}
                          </div>

                          <div className="text-sm text-muted">
                            {rate.province ? <div>{rate.province}</div> : null}

                            {Array.isArray(rate.countries) &&
                            rate.countries.length > 0 ? (
                              <div
                                className={cn(
                                  "text-xs",
                                  rate.province ? "mt-0.5" : ""
                                )}
                              >
                                {rate.countries.join(", ")}
                              </div>
                            ) : null}

                            {!rate.province &&
                              (!Array.isArray(rate.countries) ||
                                rate.countries.length === 0) &&
                              "—"}
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

                            {rate.calculationMode === "BY_ZONE" &&
                              (rate.fixedPrice
                                ? formatCurrency(rate.fixedPrice)
                                : "—")}
                          </div>

                          <div className="flex items-center md:justify-center">
                            <TPStatusPill active={rate.isActive} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <DetailRow label="Tarifas">
                  <span className="text-muted italic">
                    Sin tarifas configuradas
                  </span>
                </DetailRow>
              ))}

            <DetailRow label="Notas">
              {viewTarget.notes ? (
                <span className="whitespace-pre-wrap text-right">{viewTarget.notes}</span>
              ) : (
                <span className="text-muted italic">Sin notas</span>
              )}
            </DetailRow>

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