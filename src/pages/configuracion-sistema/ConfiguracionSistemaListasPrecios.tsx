// src/pages/configuracion-sistema/ConfiguracionSistemaListasPrecios.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Save, Star, X } from "lucide-react";

import { cn } from "../../components/ui/tp";
import { TPSectionShell } from "../../components/ui/TPSectionShell";
import { TPButton } from "../../components/ui/TPButton";
import TPInput from "../../components/ui/TPInput";
import { TPField } from "../../components/ui/TPField";
import TPComboFixed from "../../components/ui/TPComboFixed";
import TPNumberInput from "../../components/ui/TPNumberInput";
import TPTextarea from "../../components/ui/TPTextarea";
import { TPCard } from "../../components/ui/TPCard";
import { Modal } from "../../components/ui/Modal";
import ConfirmDeleteDialog from "../../components/ui/ConfirmDeleteDialog";
import TPDateRangeInline, { type TPDateRangeValue } from "../../components/ui/TPDateRangeInline";
import { TPTr, TPTd } from "../../components/ui/TPTable";
import { TPTableKit, type TPColDef } from "../../components/ui/TPTableKit";
import { TPRowActions } from "../../components/ui/TPRowActions";
import TPStatusPill from "../../components/ui/TPStatusPill";

import { toast } from "../../lib/toast";
import {
  priceListsApi,
  type PriceListRow,
  type PriceListPayload,
  type PriceListMode,
  type RoundingTarget,
  type RoundingMode,
  type RoundingDirection,
} from "../../services/price-lists";

/* =========================================================
   Label maps
========================================================= */
const MODE_LABELS: Record<PriceListMode, string> = {
  MARGIN_TOTAL: "Margen total",
  METAL_HECHURA: "Metal + Hechura",
  COST_PER_GRAM: "Costo/g",
};

const ROUNDING_TARGET_LABELS: Record<RoundingTarget, string> = {
  NONE: "Sin redondeo",
  METAL: "Valor metal",
  FINAL_PRICE: "Precio final",
};

const ROUNDING_MODE_LABELS: Record<RoundingMode, string> = {
  NONE: "Sin redondeo",
  INTEGER: "Entero",
  DECIMAL_1: "1 decimal",
  DECIMAL_2: "2 decimales",
  TEN: "Decena",
  HUNDRED: "Centena",
};

const ROUNDING_DIRECTION_LABELS: Record<RoundingDirection, string> = {
  NEAREST: "Al más cercano",
  UP: "Hacia arriba",
  DOWN: "Hacia abajo",
};

/* =========================================================
   Helpers
========================================================= */
function fmt(v: string | null, suffix = "%") {
  if (v === null || v === "") return "-";
  const n = parseFloat(v);
  return Number.isFinite(n) ? `${n.toLocaleString("es-AR")}${suffix}` : "-";
}

function fmtDate(v: string | null) {
  if (!v) return "-";
  return new Date(v).toLocaleDateString("es-AR");
}

function strToNumOrNull(v: string | null | undefined): number | null {
  if (!v || v.trim() === "") return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function numToStr(v: number | null): string {
  return v === null || v === undefined ? "" : String(v);
}

/* =========================================================
   Draft
========================================================= */
type Draft = {
  name: string;
  mode: PriceListMode;
  marginTotal: number | null;
  marginMetal: number | null;
  marginHechura: number | null;
  costPerGram: number | null;
  surcharge: number | null;
  roundingTarget: RoundingTarget;
  roundingMode: RoundingMode;
  roundingDirection: RoundingDirection;
  roundingValueMetal: number | null;
  roundingValueHechura: number | null;
  vigenciaActiva: boolean;
  validityRange: TPDateRangeValue;
  notes: string;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  mode: "MARGIN_TOTAL",
  marginTotal: null,
  marginMetal: null,
  marginHechura: null,
  costPerGram: null,
  surcharge: null,
  roundingTarget: "NONE",
  roundingMode: "NONE",
  roundingDirection: "NEAREST",
  roundingValueMetal: null,
  roundingValueHechura: null,
  vigenciaActiva: false,
  validityRange: { from: null, to: null },
  notes: "",
};

function parseDateStr(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateToStr(d: Date | null): string | null {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function rowToDraft(r: PriceListRow): Draft {
  return {
    name: r.name,
    mode: r.mode,
    marginTotal: strToNumOrNull(r.marginTotal),
    marginMetal: strToNumOrNull(r.marginMetal),
    marginHechura: strToNumOrNull(r.marginHechura),
    costPerGram: strToNumOrNull(r.costPerGram),
    surcharge: strToNumOrNull(r.surcharge),
    roundingTarget: r.roundingTarget,
    roundingMode: r.roundingMode,
    roundingDirection: r.roundingDirection,
    roundingValueMetal: strToNumOrNull(r.roundingValueMetal),
    roundingValueHechura: strToNumOrNull(r.roundingValueHechura),
    vigenciaActiva: !!(r.validFrom || r.validTo),
    validityRange: {
      from: parseDateStr(r.validFrom),
      to: parseDateStr(r.validTo),
    },
    notes: r.notes,
  };
}

function draftToPayload(d: Draft): PriceListPayload {
  const validFrom = d.vigenciaActiva ? dateToStr(d.validityRange.from) : null;
  const validTo = d.vigenciaActiva ? dateToStr(d.validityRange.to) : null;

  const roundingTarget: RoundingTarget = d.roundingTarget;
  const roundingMode: RoundingMode = roundingTarget === "NONE" ? "NONE" : d.roundingMode;
  const roundingDirection: RoundingDirection =
    roundingTarget === "NONE" || roundingMode === "NONE" ? "NEAREST" : d.roundingDirection;
  const roundingValueMetal =
    roundingTarget !== "NONE" && d.roundingValueMetal !== null
      ? numToStr(d.roundingValueMetal)
      : null;
  const roundingValueHechura =
    roundingTarget !== "NONE" && d.roundingValueHechura !== null
      ? numToStr(d.roundingValueHechura)
      : null;

  return {
    name: d.name.trim(),
    scope: "GENERAL",
    mode: d.mode,
    marginTotal:
      d.mode === "MARGIN_TOTAL" && d.marginTotal !== null ? numToStr(d.marginTotal) : null,
    marginMetal:
      d.mode === "METAL_HECHURA" && d.marginMetal !== null ? numToStr(d.marginMetal) : null,
    marginHechura:
      d.mode === "METAL_HECHURA" && d.marginHechura !== null ? numToStr(d.marginHechura) : null,
    costPerGram:
      d.mode === "COST_PER_GRAM" && d.costPerGram !== null ? numToStr(d.costPerGram) : null,
    surcharge: d.surcharge !== null ? numToStr(d.surcharge) : null,
    roundingTarget,
    roundingMode,
    roundingDirection,
    roundingValueMetal,
    roundingValueHechura,
    validFrom,
    validTo,
    isFavorite: false,
    notes: d.notes.trim(),
  };
}

/* =========================================================
   Table columns
========================================================= */
const PL_COLS: TPColDef[] = [
  { key: "name", label: "Nombre", canHide: false, sortKey: "name" },
  { key: "mode", label: "Modo" },
  { key: "margins", label: "Márgenes" },
  { key: "validity", label: "Vigencia" },
  { key: "estado", label: "Estado" },
  { key: "acciones", label: "Acciones", canHide: false, align: "right" },
];

/* =========================================================
   Main page
========================================================= */
export default function ConfiguracionSistemaListasPrecios() {
  const [rows, setRows] = useState<PriceListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [editRow, setEditRow] = useState<PriceListRow | null>(null);
  const [viewRow, setViewRow] = useState<PriceListRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<PriceListRow | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      setRows(await priceListsApi.list());
    } catch {
      toast.error("No se pudieron cargar las listas de precios.");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = q
      ? rows.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.code.toLowerCase().includes(q) ||
            MODE_LABELS[r.mode].toLowerCase().includes(q)
        )
      : rows;

    return [...result].sort((a, b) => {
      const cmp = a.name.localeCompare(b.name, "es");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, search, sortDir]);

  function openCreate() {
    setDraft(EMPTY_DRAFT);
    setSubmitted(false);
    setShowCreate(true);
    setTimeout(() => firstInputRef.current?.focus(), 50);
  }

  function openEdit(r: PriceListRow) {
    setDraft(rowToDraft(r));
    setSubmitted(false);
    setEditRow(r);
    setTimeout(() => firstInputRef.current?.focus(), 50);
  }

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function validateDraft(): boolean {
    if (!draft.name.trim()) return false;
    if (draft.mode === "MARGIN_TOTAL" && draft.marginTotal === null) return false;
    if (
      draft.mode === "METAL_HECHURA" &&
      (draft.marginMetal === null || draft.marginHechura === null)
    )
      return false;
    if (draft.mode === "COST_PER_GRAM" && draft.costPerGram === null) return false;
    if (draft.vigenciaActiva) {
      const { from, to } = draft.validityRange;
      if (from && to && to < from) return false;
    }
    return true;
  }

  async function handleSave() {
    setSubmitted(true);
    if (!validateDraft()) return;

    setSaving(true);
    try {
      const payload = draftToPayload(draft);
      let saved: PriceListRow;

      if (editRow) {
        saved = await priceListsApi.update(editRow.id, payload);
        setRows((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
        setEditRow(null);
        toast.success("Lista de precios actualizada.");
      } else {
        saved = await priceListsApi.create(payload);
        setRows((prev) => [saved, ...prev]);
        setShowCreate(false);
        toast.success("Lista de precios creada.");
      }

      if (saved.isFavorite) {
        setRows((prev) =>
          prev.map((r) => (r.id !== saved.id && r.isFavorite ? { ...r, isFavorite: false } : r))
        );
      }
    } catch (e: any) {
      toast.error(e?.data?.message ?? e?.message ?? "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleClone(r: PriceListRow) {
    try {
      const cloned = await priceListsApi.clone(r.id);
      setRows((prev) => [cloned, ...prev]);
      toast.success(`"${r.name}" duplicada correctamente.`);
    } catch (e: any) {
      toast.error(e?.data?.message ?? e?.message ?? "Error al clonar.");
    }
  }

  async function handleToggle(r: PriceListRow) {
    try {
      const updated = await priceListsApi.toggle(r.id);
      setRows((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e: any) {
      toast.error(e?.data?.message ?? e?.message ?? "Error al cambiar estado.");
    }
  }

  async function handleFavorite(r: PriceListRow) {
    try {
      const updated = await priceListsApi.setFavorite(r.id);
      setRows((prev) =>
        prev.map((x) => {
          if (x.id === updated.id) return updated;
          if (x.isFavorite) return { ...x, isFavorite: false };
          return x;
        })
      );
    } catch (e: any) {
      toast.error(e?.data?.message ?? e?.message ?? "Error al marcar favorita.");
    }
  }

  async function handleDelete() {
    if (!deleteRow) return;
    try {
      await priceListsApi.remove(deleteRow.id);
      setRows((prev) => prev.filter((r) => r.id !== deleteRow.id));
      setDeleteRow(null);
      toast.success("Lista eliminada.");
    } catch (e: any) {
      toast.error(e?.data?.message ?? e?.message ?? "Error al eliminar.");
    }
  }

  function handleFormKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  }

  return (
    <TPSectionShell
      title="Listas de precios"
      description="Definí las listas de precios con sus márgenes, redondeos y vigencia."
    >
      <TPTableKit
        rows={filtered}
        columns={PL_COLS}
        storageKey="tptech_col_pricelists"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nombre o modo..."
        sortKey="name"
        sortDir={sortDir}
        onSort={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
        loading={loading}
        emptyText={search ? "Sin resultados." : "No hay listas de precios creadas."}
        countLabel={(n) => `${n} ${n === 1 ? "lista" : "listas"}`}
        actions={
          <TPButton
            variant="primary"
            iconLeft={<Plus size={16} />}
            onClick={openCreate}
            className="shrink-0"
          >
            Nueva lista
          </TPButton>
        }
        renderRow={(r, vis) => (
          <TPTr key={r.id} className={!r.isActive ? "opacity-60" : undefined}>
            {/* Nombre */}
            {vis.name && (
              <TPTd>
                <span className="font-medium text-sm">{r.name}</span>
              </TPTd>
            )}

            {/* Modo */}
            {vis.mode && (
              <TPTd>
                <span className="text-sm text-muted">{MODE_LABELS[r.mode]}</span>
              </TPTd>
            )}

            {/* Márgenes */}
            {vis.margins && (
              <TPTd>
                <div className="text-sm space-y-0.5">
                  {r.mode === "MARGIN_TOTAL" && <span>{fmt(r.marginTotal)}</span>}
                  {r.mode === "METAL_HECHURA" && (
                    <>
                      <div>Metal: {fmt(r.marginMetal)}</div>
                      <div>Hechura: {fmt(r.marginHechura)}</div>
                    </>
                  )}
                  {r.mode === "COST_PER_GRAM" && <span>{fmt(r.costPerGram)}</span>}
                </div>
              </TPTd>
            )}

            {/* Vigencia */}
            {vis.validity && (
              <TPTd>
                <div className="text-sm space-y-0.5">
                  {r.validFrom || r.validTo ? (
                    <>
                      <div>{r.validFrom ? fmtDate(r.validFrom) : "Sin inicio"}</div>
                      <div className="text-muted text-xs">
                        {r.validTo ? fmtDate(r.validTo) : "Sin vencimiento"}
                      </div>
                    </>
                  ) : (
                    <span className="text-muted text-xs">Indefinida</span>
                  )}
                </div>
              </TPTd>
            )}

            {/* Estado */}
            {vis.estado && (
              <TPTd>
                <TPStatusPill
                  active={r.isActive}
                  activeLabel="Activa"
                  inactiveLabel="Inactiva"
                />
              </TPTd>
            )}

            {/* Acciones */}
            {vis.acciones && (
              <TPTd className="text-right">
                <TPRowActions
                  onFavorite={() => { if (r.isActive) handleFavorite(r); }}
                  busyFavorite={!r.isActive}
                  isFavorite={r.isFavorite}
                  onView={() => setViewRow(r)}
                  onEdit={() => openEdit(r)}
                  onClone={() => handleClone(r)}
                  onToggle={() => handleToggle(r)}
                  isActive={r.isActive}
                  onDelete={() => setDeleteRow(r)}
                />
              </TPTd>
            )}
          </TPTr>
        )}
      />

      {/* Modal crear / editar */}
      {(showCreate || editRow !== null) && (
        <PriceListFormModal
          draft={draft}
          set={set}
          submitted={submitted}
          saving={saving}
          isEdit={editRow !== null}
          firstInputRef={firstInputRef}
          onSave={handleSave}
          onClose={() => {
            setShowCreate(false);
            setEditRow(null);
          }}
          onKey={handleFormKey}
        />
      )}

      {/* Modal ver */}
      {viewRow && (
        <Modal
          open
          title="Detalle de lista de precios"
          onClose={() => setViewRow(null)}
          maxWidth="lg"
        >
          <PriceListViewContent row={viewRow} />
          <div className="mt-6 flex justify-end">
            <TPButton variant="secondary" onClick={() => setViewRow(null)}>
              Cerrar
            </TPButton>
          </div>
        </Modal>
      )}

      {/* Confirmar eliminación */}
      {deleteRow && (
        <ConfirmDeleteDialog
          open
          title="Eliminar lista de precios"
          description={`¿Eliminar "${deleteRow.name}"? Esta acción no se puede deshacer.`}
          onConfirm={handleDelete}
          onClose={() => setDeleteRow(null)}
        />
      )}
    </TPSectionShell>
  );
}

/* =========================================================
   Form Modal
========================================================= */
function PriceListFormModal({
  draft,
  set,
  submitted,
  saving,
  isEdit,
  firstInputRef,
  onSave,
  onClose,
  onKey,
}: {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  submitted: boolean;
  saving: boolean;
  isEdit: boolean;
  firstInputRef: React.RefObject<HTMLInputElement | null>;
  onSave: () => void;
  onClose: () => void;
  onKey: (e: React.KeyboardEvent) => void;
}) {
  const nameError = submitted && !draft.name.trim() ? "Campo requerido." : null;
  const marginTotalError =
    submitted && draft.mode === "MARGIN_TOTAL" && draft.marginTotal === null
      ? "Campo requerido."
      : null;
  const marginMetalError =
    submitted && draft.mode === "METAL_HECHURA" && draft.marginMetal === null
      ? "Campo requerido."
      : null;
  const marginHechuraError =
    submitted && draft.mode === "METAL_HECHURA" && draft.marginHechura === null
      ? "Campo requerido."
      : null;
  const costPerGramError =
    submitted && draft.mode === "COST_PER_GRAM" && draft.costPerGram === null
      ? "Campo requerido."
      : null;
  const validityError =
    submitted &&
    draft.vigenciaActiva &&
    draft.validityRange.from &&
    draft.validityRange.to &&
    draft.validityRange.to < draft.validityRange.from
      ? "La fecha hasta no puede ser menor que la fecha desde."
      : null;

  const hasRounding = draft.roundingTarget !== "NONE";

  function changeMode(next: PriceListMode) {
    set("mode", next);
    if (next !== "MARGIN_TOTAL") set("marginTotal", null);
    if (next !== "METAL_HECHURA") {
      set("marginMetal", null);
      set("marginHechura", null);
    }
    if (next !== "COST_PER_GRAM") set("costPerGram", null);
  }

  function changeRoundingTarget(next: RoundingTarget) {
    set("roundingTarget", next);
    if (next === "NONE") {
      set("roundingMode", "NONE");
      set("roundingDirection", "NEAREST");
      set("roundingValueMetal", null);
      set("roundingValueHechura", null);
    }
  }

  function changeRoundingMode(next: RoundingMode) {
    set("roundingMode", next);
    if (next === "NONE") set("roundingDirection", "NEAREST");
  }

  return (
    <Modal
      open
      title={isEdit ? "Editar lista de precios" : "Nueva lista de precios"}
      onClose={onClose}
      maxWidth="2xl"
    >
      <div className="space-y-4" onKeyDown={onKey}>

        {/* A. Identificación */}
        <TPCard title="Identificación">
          <TPField label="Nombre *" error={nameError}>
            <TPInput
              inputRef={firstInputRef}
              value={draft.name}
              onChange={(v) => set("name", v)}
              placeholder="Ej: Lista minorista"
            />
          </TPField>
        </TPCard>

        {/* B. Cálculo */}
        <TPCard title="Cálculo">
          <div className="space-y-4">
            <TPField label="Modo de cálculo *">
              <TPComboFixed
                value={draft.mode}
                onChange={(v) => changeMode(v as PriceListMode)}
                options={[
                  { value: "MARGIN_TOTAL", label: "Margen total (%)" },
                  { value: "METAL_HECHURA", label: "Metal + Hechura por separado (%)" },
                  { value: "COST_PER_GRAM", label: "Costo por gramo (%)" },
                ]}
              />
            </TPField>

            {draft.mode === "MARGIN_TOTAL" && (
              <TPField label="Margen total *" error={marginTotalError}>
                <TPNumberInput
                  rightAddon="%"
                  value={draft.marginTotal}
                  onChange={(v) => set("marginTotal", v)}
                  decimals={2}
                  step={1}
                  min={0}
                  placeholder="30.00"
                />
              </TPField>
            )}

            {draft.mode === "METAL_HECHURA" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TPField label="Margen metal *" error={marginMetalError}>
                  <TPNumberInput
                    rightAddon="%"
                    value={draft.marginMetal}
                    onChange={(v) => set("marginMetal", v)}
                    decimals={2}
                    step={1}
                    min={0}
                    placeholder="20.00"
                  />
                </TPField>
                <TPField label="Margen hechura *" error={marginHechuraError}>
                  <TPNumberInput
                    rightAddon="%"
                    value={draft.marginHechura}
                    onChange={(v) => set("marginHechura", v)}
                    decimals={2}
                    step={1}
                    min={0}
                    placeholder="40.00"
                  />
                </TPField>
              </div>
            )}

            {draft.mode === "COST_PER_GRAM" && (
              <TPField label="Costo por gramo *" error={costPerGramError}>
                <TPNumberInput
                  rightAddon="%"
                  value={draft.costPerGram}
                  onChange={(v) => set("costPerGram", v)}
                  decimals={2}
                  step={1}
                  min={0}
                  placeholder="15.00"
                />
              </TPField>
            )}
          </div>
        </TPCard>

        {/* C. Redondeo */}
        <TPCard title="Redondeo">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TPField label="Aplicar redondeo en">
                <TPComboFixed
                  value={draft.roundingTarget}
                  onChange={(v) => changeRoundingTarget(v as RoundingTarget)}
                  options={[
                    { value: "NONE", label: "Sin redondeo" },
                    { value: "METAL", label: "Valor metal" },
                    { value: "FINAL_PRICE", label: "Precio final" },
                  ]}
                />
              </TPField>

              <TPField label="Precisión">
                <TPComboFixed
                  value={draft.roundingMode}
                  onChange={(v) => changeRoundingMode(v as RoundingMode)}
                  disabled={!hasRounding}
                  options={[
                    { value: "NONE", label: "Sin redondeo" },
                    { value: "INTEGER", label: "Entero" },
                    { value: "DECIMAL_1", label: "1 decimal" },
                    { value: "DECIMAL_2", label: "2 decimales" },
                    { value: "TEN", label: "Decena" },
                    { value: "HUNDRED", label: "Centena" },
                  ]}
                />
              </TPField>

              <TPField label="Dirección">
                <TPComboFixed
                  value={draft.roundingDirection}
                  onChange={(v) => set("roundingDirection", v as RoundingDirection)}
                  disabled={!hasRounding || draft.roundingMode === "NONE"}
                  options={[
                    { value: "NEAREST", label: "Al más cercano" },
                    { value: "UP", label: "Hacia arriba" },
                    { value: "DOWN", label: "Hacia abajo" },
                  ]}
                />
              </TPField>
            </div>

            {hasRounding && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TPField label="Valor a redondear — Metal">
                  <TPNumberInput
                    value={draft.roundingValueMetal}
                    onChange={(v) => set("roundingValueMetal", v)}
                    decimals={4}
                    step={0.01}
                    min={0}
                    placeholder="Ej: 0.50"
                  />
                </TPField>
                <TPField label="Valor a redondear — Hechura">
                  <TPNumberInput
                    value={draft.roundingValueHechura}
                    onChange={(v) => set("roundingValueHechura", v)}
                    decimals={4}
                    step={0.01}
                    min={0}
                    placeholder="Ej: 10"
                  />
                </TPField>
              </div>
            )}
          </div>
        </TPCard>

        {/* D. Vigencia */}
        <TPCard title="Vigencia">
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={draft.vigenciaActiva}
                onChange={(e) => {
                  const active = e.target.checked;
                  set("vigenciaActiva", active);
                  if (active) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const to = new Date(today);
                    to.setDate(to.getDate() + 30);
                    set("validityRange", { from: today, to });
                  } else {
                    set("validityRange", { from: null, to: null });
                  }
                }}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span className="text-sm text-text">Activar vigencia</span>
            </label>

            <div className="w-full md:w-auto md:min-w-[320px]">
              <TPDateRangeInline
                value={draft.validityRange}
                onChange={(v) => set("validityRange", v)}
                showPresets={false}
                disabled={!draft.vigenciaActiva}
              />
            </div>
          </div>
          {validityError && (
            <p className="text-xs text-red-500 mt-2">{validityError}</p>
          )}
        </TPCard>

        {/* E. Notas */}
        <TPCard title="Notas">
          <TPField label="Notas internas">
            <TPTextarea
              value={draft.notes}
              onChange={(v) => set("notes", v)}
              rows={2}
              placeholder="Información interna sobre esta lista..."
            />
          </TPField>
        </TPCard>

        <div className="flex justify-end gap-2 pt-1">
          <TPButton variant="secondary" onClick={onClose} disabled={saving} iconLeft={<X size={16} />}>
            Cancelar
          </TPButton>
          <TPButton
            variant="primary"
            onClick={onSave}
            loading={saving}
            iconLeft={isEdit ? <Save size={16} /> : <Plus size={16} />}
          >
            {isEdit ? "Guardar cambios" : "Crear lista"}
          </TPButton>
        </div>
      </div>
    </Modal>
  );
}

/* =========================================================
   View Content
========================================================= */
function PriceListViewContent({ row }: { row: PriceListRow }) {
  function item(label: string, value: React.ReactNode) {
    return (
      <div>
        <div className="text-xs text-muted mb-0.5">{label}</div>
        <div className="text-sm text-text">{value ?? <span className="text-muted">—</span>}</div>
      </div>
    );
  }

  const hasRounding = row.roundingTarget !== "NONE";

  return (
    <div className="space-y-5">
      {/* Identificación */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        {item("Nombre", <span className="font-medium">{row.name}</span>)}
        {item("Código", <span className="font-mono text-sm">{row.code}</span>)}
        {item("Modo de cálculo", MODE_LABELS[row.mode])}
        {item(
          "Estado",
          <TPStatusPill active={row.isActive} activeLabel="Activa" inactiveLabel="Inactiva" />
        )}
        {item(
          "Favorita",
          row.isFavorite ? (
            <span className="inline-flex items-center gap-1 text-sm font-medium">
              <Star size={13} className="fill-yellow-400 text-yellow-400" />
              Sí, predeterminada
            </span>
          ) : (
            "No"
          )
        )}
      </div>

      {/* Márgenes */}
      <div className="rounded-lg bg-surface border border-border/50 p-3 space-y-2">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide">Márgenes</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {row.mode === "MARGIN_TOTAL" && item("Margen total", fmt(row.marginTotal))}
          {row.mode === "METAL_HECHURA" && (
            <>
              {item("Margen metal", fmt(row.marginMetal))}
              {item("Margen hechura", fmt(row.marginHechura))}
            </>
          )}
          {row.mode === "COST_PER_GRAM" && item("Costo por gramo (%)", fmt(row.costPerGram))}
        </div>
      </div>

      {/* Redondeo */}
      {hasRounding && (
        <div className="rounded-lg bg-surface border border-border/50 p-3 space-y-2">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">Redondeo</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {item("Aplicar en", ROUNDING_TARGET_LABELS[row.roundingTarget])}
            {item("Precisión", ROUNDING_MODE_LABELS[row.roundingMode])}
            {item("Dirección", ROUNDING_DIRECTION_LABELS[row.roundingDirection])}
            {row.roundingValueMetal &&
              item("Valor metal", parseFloat(row.roundingValueMetal).toLocaleString("es-AR"))}
            {row.roundingValueHechura &&
              item(
                "Valor hechura",
                parseFloat(row.roundingValueHechura).toLocaleString("es-AR")
              )}
          </div>
        </div>
      )}

      {/* Vigencia */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        {item("Válida desde", fmtDate(row.validFrom))}
        {item("Válida hasta", fmtDate(row.validTo))}
      </div>

      {row.notes && item("Notas internas", row.notes)}
    </div>
  );
}
