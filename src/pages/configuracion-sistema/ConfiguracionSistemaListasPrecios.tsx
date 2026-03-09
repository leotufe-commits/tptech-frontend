// src/pages/configuracion-sistema/ConfiguracionSistemaListasPrecios.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Pencil,
  Eye,
  Trash2,
  ShieldBan,
  ShieldCheck,
  Copy,
  Loader2,
  Star,
  X,
} from "lucide-react";

import { cn } from "../../components/ui/tp";
import { TPSectionShell } from "../../components/ui/TPSectionShell";
import { TPButton } from "../../components/ui/TPButton";
import { TPSearchInput } from "../../components/ui/TPSearchInput";
import TPInput from "../../components/ui/TPInput";
import { TPField } from "../../components/ui/TPField";
import TPSelect from "../../components/ui/TPSelect";
import TPTextarea from "../../components/ui/TPTextarea";
import { TPCheckbox } from "../../components/ui/TPCheckbox";
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
  priceListsApi,
  type PriceListRow,
  type PriceListPayload,
  type PriceListScope,
  type PriceListMode,
  type RoundingTarget,
  type RoundingMode,
  type RoundingDirection,
} from "../../services/price-lists";
import { categoriesApi, type CategoryRow } from "../../services/categories";

/* =========================================================
   Label maps
========================================================= */
const SCOPE_LABELS: Record<PriceListScope, string> = {
  GENERAL: "General",
  CHANNEL: "Canal",
  CATEGORY: "Categoría",
  CLIENT: "Cliente",
};

const MODE_LABELS: Record<PriceListMode, string> = {
  MARGIN_TOTAL: "Margen total",
  METAL_HECHURA: "Metal + Hechura",
  COST_PER_GRAM: "Costo por gramo",
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

function toDateInput(v: string | null): string {
  if (!v) return "";
  return v.slice(0, 10);
}

/* =========================================================
   Form draft
========================================================= */
type Draft = {
  name: string;
  code: string;
  description: string;
  scope: PriceListScope;
  categoryId: string;
  mode: PriceListMode;
  marginTotal: string;
  marginMetal: string;
  marginHechura: string;
  costPerGram: string;
  surcharge: string;
  minimumPrice: string;
  roundingTarget: RoundingTarget;
  roundingMode: RoundingMode;
  roundingDirection: RoundingDirection;
  validFrom: string;
  validTo: string;
  isFavorite: boolean;
  notes: string;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  code: "",
  description: "",
  scope: "GENERAL",
  categoryId: "",
  mode: "MARGIN_TOTAL",
  marginTotal: "",
  marginMetal: "",
  marginHechura: "",
  costPerGram: "",
  surcharge: "",
  minimumPrice: "",
  roundingTarget: "NONE",
  roundingMode: "NONE",
  roundingDirection: "NEAREST",
  validFrom: "",
  validTo: "",
  isFavorite: false,
  notes: "",
};

function rowToDraft(r: PriceListRow): Draft {
  return {
    name: r.name,
    code: r.code,
    description: r.description,
    scope: r.scope,
    categoryId: r.categoryId ?? "",
    mode: r.mode,
    marginTotal: r.marginTotal ?? "",
    marginMetal: r.marginMetal ?? "",
    marginHechura: r.marginHechura ?? "",
    costPerGram: r.costPerGram ?? "",
    surcharge: r.surcharge ?? "",
    minimumPrice: r.minimumPrice ?? "",
    roundingTarget: r.roundingTarget,
    roundingMode: r.roundingMode,
    roundingDirection: r.roundingDirection,
    validFrom: toDateInput(r.validFrom),
    validTo: toDateInput(r.validTo),
    isFavorite: r.isFavorite,
    notes: r.notes,
  };
}

function draftToPayload(d: Draft): PriceListPayload {
  return {
    name: d.name.trim(),
    code: d.code.trim() || undefined,
    description: d.description.trim(),
    scope: d.scope,
    categoryId: d.scope === "CATEGORY" ? (d.categoryId || null) : null,
    mode: d.mode,
    marginTotal: d.mode === "MARGIN_TOTAL" ? (d.marginTotal || null) : null,
    marginMetal: d.mode === "METAL_HECHURA" ? (d.marginMetal || null) : null,
    marginHechura: d.mode === "METAL_HECHURA" ? (d.marginHechura || null) : null,
    costPerGram: d.mode === "COST_PER_GRAM" ? (d.costPerGram || null) : null,
    surcharge: d.surcharge || null,
    minimumPrice: d.minimumPrice || null,
    roundingTarget: d.roundingTarget,
    roundingMode: d.roundingMode,
    roundingDirection: d.roundingMode !== "NONE" ? d.roundingDirection : undefined,
    validFrom: d.validFrom || null,
    validTo: d.validTo || null,
    isFavorite: d.isFavorite,
    notes: d.notes.trim(),
  };
}

/* =========================================================
   Main page
========================================================= */
export default function ConfiguracionSistemaListasPrecios() {
  const [rows, setRows] = useState<PriceListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<CategoryRow[]>([]);

  // Modals
  const [editRow, setEditRow] = useState<PriceListRow | null>(null);
  const [viewRow, setViewRow] = useState<PriceListRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<PriceListRow | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Form
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Load
  useEffect(() => {
    load();
    loadCategories();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await priceListsApi.list();
      setRows(data);
    } catch {
      toast.error("No se pudieron cargar las listas de precios.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const data = await categoriesApi.list();
      setCategories(data.filter((c) => c.isActive));
    } catch {
      // silencioso — categorías no son críticas
    }
  }

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        SCOPE_LABELS[r.scope].toLowerCase().includes(q) ||
        MODE_LABELS[r.mode].toLowerCase().includes(q)
    );
  }, [rows, search]);

  /* ---------- autofocus ---------- */
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

  /* ---------- helpers ---------- */
  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function validateDraft(): boolean {
    if (!draft.name.trim()) return false;
    if (draft.mode === "MARGIN_TOTAL" && !draft.marginTotal) return false;
    if (draft.mode === "METAL_HECHURA" && (!draft.marginMetal || !draft.marginHechura)) return false;
    if (draft.mode === "COST_PER_GRAM" && !draft.costPerGram) return false;
    return true;
  }

  /* ---------- CRUD ---------- */
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
      // Si se marcó como favorita, quitar favorita de otras del mismo scope
      if (saved.isFavorite) {
        setRows((prev) =>
          prev.map((r) =>
            r.id !== saved.id && r.scope === saved.scope ? { ...r, isFavorite: false } : r
          )
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
      toast.success(`Lista "${r.name}" duplicada.`);
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
          if (x.scope === updated.scope && x.isFavorite) return { ...x, isFavorite: false };
          return x;
        })
      );
    } catch (e: any) {
      toast.error(e?.data?.message ?? e?.message ?? "Error al marcar como favorita.");
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

  /* ---------- form key handler ---------- */
  function handleFormKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  }

  /* =========================================================
     Render
  ========================================================= */
  return (
    <TPSectionShell
      title="Listas de precios"
      description="Definí las listas de precios con sus márgenes, redondeos y vigencia."
    >
      {/* Toolbar */}
      <TPTableHeader>
        <TPSearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre, código, alcance..."
          className="w-full md:w-72"
        />
        <TPButton
          variant="primary"
          icon={<Plus size={16} />}
          onClick={openCreate}
          className="shrink-0"
        >
          Nueva lista
        </TPButton>
      </TPTableHeader>

      {/* Table */}
      <TPTableWrap>
        <TPTableXScroll>
          <TPTableElBase responsive="stack">
            <TPThead>
              <TPTr>
                <TPTh>Nombre</TPTh>
                <TPTh>Código</TPTh>
                <TPTh>Alcance</TPTh>
                <TPTh>Modo</TPTh>
                <TPTh>Márgenes</TPTh>
                <TPTh>Vigencia</TPTh>
                <TPTh align="right">Acciones</TPTh>
              </TPTr>
            </TPThead>
            <TPTbody>
              {loading ? (
                <TPEmptyRow colSpan={7}>
                  <Loader2 size={18} className="animate-spin text-muted" />
                </TPEmptyRow>
              ) : filtered.length === 0 ? (
                <TPEmptyRow colSpan={7}>
                  {search ? "Sin resultados." : "No hay listas de precios creadas."}
                </TPEmptyRow>
              ) : (
                filtered.map((r) => (
                  <TPTr key={r.id} muted={!r.isActive}>
                    <TPTd label="Nombre">
                      <div className="flex items-center gap-2">
                        {r.isFavorite && (
                          <Star size={13} className="text-primary fill-primary shrink-0" />
                        )}
                        <span className={cn("font-medium", !r.isActive && "opacity-50")}>
                          {r.name}
                        </span>
                      </div>
                    </TPTd>

                    <TPTd label="Código">
                      <span className="font-mono text-sm">{r.code}</span>
                    </TPTd>

                    <TPTd label="Alcance">
                      <span className="text-sm">{SCOPE_LABELS[r.scope]}</span>
                      {r.category && (
                        <div className="text-xs text-muted">{r.category.name}</div>
                      )}
                    </TPTd>

                    <TPTd label="Modo">
                      <span className="text-sm">{MODE_LABELS[r.mode]}</span>
                    </TPTd>

                    <TPTd label="Márgenes">
                      <div className="text-sm space-y-0.5">
                        {r.mode === "MARGIN_TOTAL" && (
                          <div>Total: {fmt(r.marginTotal)}</div>
                        )}
                        {r.mode === "METAL_HECHURA" && (
                          <>
                            <div>Metal: {fmt(r.marginMetal)}</div>
                            <div>Hechura: {fmt(r.marginHechura)}</div>
                          </>
                        )}
                        {r.mode === "COST_PER_GRAM" && (
                          <div>Costo/g: {fmt(r.costPerGram, "")}</div>
                        )}
                        {r.surcharge && (
                          <div className="text-xs text-muted">Recargo: {fmt(r.surcharge)}</div>
                        )}
                      </div>
                    </TPTd>

                    <TPTd label="Vigencia">
                      <div className="text-sm">
                        {r.validFrom || r.validTo ? (
                          <>
                            <div>{r.validFrom ? fmtDate(r.validFrom) : "Sin inicio"}</div>
                            <div>{r.validTo ? fmtDate(r.validTo) : "Sin vencimiento"}</div>
                          </>
                        ) : (
                          <span className="text-muted text-xs">Indefinida</span>
                        )}
                      </div>
                    </TPTd>

                    <TPTd label="Acciones" align="right">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        {/* Favorita */}
                        <button
                          type="button"
                          onClick={() => handleFavorite(r)}
                          title={r.isFavorite ? "Quitar favorita" : "Marcar como favorita"}
                          className={cn(
                            "p-1.5 rounded-lg transition-colors",
                            r.isFavorite
                              ? "text-primary"
                              : "text-muted hover:text-primary"
                          )}
                        >
                          <Star
                            size={14}
                            className={r.isFavorite ? "fill-primary" : ""}
                          />
                        </button>

                        {/* Ver */}
                        <button
                          type="button"
                          onClick={() => setViewRow(r)}
                          title="Ver detalle"
                          className="p-1.5 rounded-lg text-muted hover:text-text transition-colors"
                        >
                          <Eye size={14} />
                        </button>

                        {/* Editar */}
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          title="Editar"
                          className="p-1.5 rounded-lg text-muted hover:text-text transition-colors"
                        >
                          <Pencil size={14} />
                        </button>

                        {/* Clonar */}
                        <button
                          type="button"
                          onClick={() => handleClone(r)}
                          title="Duplicar"
                          className="p-1.5 rounded-lg text-muted hover:text-text transition-colors"
                        >
                          <Copy size={14} />
                        </button>

                        {/* Activar/inactivar */}
                        <button
                          type="button"
                          onClick={() => handleToggle(r)}
                          title={r.isActive ? "Desactivar" : "Activar"}
                          className={cn(
                            "p-1.5 rounded-lg transition-colors",
                            r.isActive
                              ? "text-muted hover:text-danger"
                              : "text-muted hover:text-success"
                          )}
                        >
                          {r.isActive ? <ShieldBan size={14} /> : <ShieldCheck size={14} />}
                        </button>

                        {/* Eliminar */}
                        <button
                          type="button"
                          onClick={() => setDeleteRow(r)}
                          title="Eliminar"
                          className="p-1.5 rounded-lg text-muted hover:text-danger transition-colors"
                        >
                          <Trash2 size={14} />
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

      {/* ===== Modal Crear / Editar ===== */}
      {(showCreate || editRow !== null) && (
        <PriceListFormModal
          draft={draft}
          set={set}
          submitted={submitted}
          saving={saving}
          categories={categories}
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

      {/* ===== Modal Ver ===== */}
      {viewRow && (
        <Modal
          title="Detalle de lista de precios"
          onClose={() => setViewRow(null)}
        >
          <PriceListViewContent row={viewRow} categories={categories} />
          <div className="mt-6 flex justify-end">
            <TPButton variant="secondary" onClick={() => setViewRow(null)}>
              Cerrar
            </TPButton>
          </div>
        </Modal>
      )}

      {/* ===== Confirm Delete ===== */}
      {deleteRow && (
        <ConfirmDeleteDialog
          title="Eliminar lista de precios"
          description={`¿Eliminar "${deleteRow.name}"? Esta acción no se puede deshacer.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteRow(null)}
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
  categories,
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
  categories: CategoryRow[];
  isEdit: boolean;
  firstInputRef: React.RefObject<HTMLInputElement>;
  onSave: () => void;
  onClose: () => void;
  onKey: (e: React.KeyboardEvent) => void;
}) {
  const marginTotalError =
    submitted && draft.mode === "MARGIN_TOTAL" && !draft.marginTotal
      ? "Campo requerido."
      : null;
  const marginMetalError =
    submitted && draft.mode === "METAL_HECHURA" && !draft.marginMetal
      ? "Campo requerido."
      : null;
  const marginHechuraError =
    submitted && draft.mode === "METAL_HECHURA" && !draft.marginHechura
      ? "Campo requerido."
      : null;
  const costPerGramError =
    submitted && draft.mode === "COST_PER_GRAM" && !draft.costPerGram
      ? "Campo requerido."
      : null;

  return (
    <Modal
      title={isEdit ? "Editar lista de precios" : "Nueva lista de precios"}
      onClose={onClose}
      size="lg"
    >
      <div className="space-y-5" onKeyDown={onKey}>
        {/* Nombre + Código */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TPField
            label="Nombre *"
            error={submitted && !draft.name.trim() ? "Campo requerido." : null}
          >
            <TPInput
              ref={firstInputRef}
              value={draft.name}
              onChange={(v) => set("name", v)}
              placeholder="Ej: Lista minorista"
            />
          </TPField>

          <TPField label="Código">
            <TPInput
              value={draft.code}
              onChange={(v) => set("code", v)}
              placeholder="Auto-generado si se deja vacío"
            />
          </TPField>
        </div>

        {/* Alcance + Categoría */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TPField label="Alcance *">
            <TPSelect
              value={draft.scope}
              onChange={(v) => set("scope", v as PriceListScope)}
              options={[
                { value: "GENERAL", label: "General" },
                { value: "CHANNEL", label: "Canal" },
                { value: "CATEGORY", label: "Categoría" },
                { value: "CLIENT", label: "Cliente" },
              ]}
            />
          </TPField>

          {draft.scope === "CATEGORY" && (
            <TPField label="Categoría">
              <TPSelect
                value={draft.categoryId}
                onChange={(v) => set("categoryId", v)}
                options={[
                  { value: "", label: "Seleccionar categoría..." },
                  ...categories.map((c) => ({
                    value: c.id,
                    label: c.parent ? `${c.parent.name} › ${c.name}` : c.name,
                  })),
                ]}
              />
            </TPField>
          )}
        </div>

        {/* Modo de margen */}
        <TPField label="Modo de cálculo *">
          <TPSelect
            value={draft.mode}
            onChange={(v) => set("mode", v as PriceListMode)}
            options={[
              { value: "MARGIN_TOTAL", label: "Margen total (%)" },
              { value: "METAL_HECHURA", label: "Metal + Hechura por separado" },
              { value: "COST_PER_GRAM", label: "Costo por gramo (precio fijo)" },
            ]}
          />
        </TPField>

        {/* Campos condicionales */}
        {draft.mode === "MARGIN_TOTAL" && (
          <TPField label="Margen total *" error={marginTotalError}>
            <TPInput
              value={draft.marginTotal}
              onChange={(v) => set("marginTotal", v)}
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="Ej: 30 (= 30%)"
              suffix="%"
            />
          </TPField>
        )}

        {draft.mode === "METAL_HECHURA" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TPField label="Margen sobre metal *" error={marginMetalError}>
              <TPInput
                value={draft.marginMetal}
                onChange={(v) => set("marginMetal", v)}
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="Ej: 20"
                suffix="%"
              />
            </TPField>
            <TPField label="Margen sobre hechura *" error={marginHechuraError}>
              <TPInput
                value={draft.marginHechura}
                onChange={(v) => set("marginHechura", v)}
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="Ej: 40"
                suffix="%"
              />
            </TPField>
          </div>
        )}

        {draft.mode === "COST_PER_GRAM" && (
          <TPField label="Costo por gramo *" error={costPerGramError}>
            <TPInput
              value={draft.costPerGram}
              onChange={(v) => set("costPerGram", v)}
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="Ej: 15000"
            />
          </TPField>
        )}

        {/* Recargo y precio mínimo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TPField label="Recargo adicional">
            <TPInput
              value={draft.surcharge}
              onChange={(v) => set("surcharge", v)}
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="Ej: 5 (= 5%)"
              suffix="%"
            />
          </TPField>
          <TPField label="Precio mínimo">
            <TPInput
              value={draft.minimumPrice}
              onChange={(v) => set("minimumPrice", v)}
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="Ej: 1000"
            />
          </TPField>
        </div>

        {/* Redondeo */}
        <div className="rounded-lg border border-border p-4 space-y-4">
          <div className="text-sm font-medium text-text">Redondeo</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TPField label="Aplicar redondeo en">
              <TPSelect
                value={draft.roundingTarget}
                onChange={(v) => set("roundingTarget", v as RoundingTarget)}
                options={[
                  { value: "NONE", label: "Sin redondeo" },
                  { value: "METAL", label: "Valor metal" },
                  { value: "FINAL_PRICE", label: "Precio final" },
                ]}
              />
            </TPField>

            <TPField label="Precisión">
              <TPSelect
                value={draft.roundingMode}
                onChange={(v) => set("roundingMode", v as RoundingMode)}
                disabled={draft.roundingTarget === "NONE"}
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
              <TPSelect
                value={draft.roundingDirection}
                onChange={(v) => set("roundingDirection", v as RoundingDirection)}
                disabled={draft.roundingTarget === "NONE" || draft.roundingMode === "NONE"}
                options={[
                  { value: "NEAREST", label: "Al más cercano" },
                  { value: "UP", label: "Hacia arriba" },
                  { value: "DOWN", label: "Hacia abajo" },
                ]}
              />
            </TPField>
          </div>
        </div>

        {/* Vigencia */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TPField label="Válida desde">
            <TPInput
              value={draft.validFrom}
              onChange={(v) => set("validFrom", v)}
              type="date"
            />
          </TPField>
          <TPField label="Válida hasta">
            <TPInput
              value={draft.validTo}
              onChange={(v) => set("validTo", v)}
              type="date"
            />
          </TPField>
        </div>

        {/* Descripción */}
        <TPField label="Descripción">
          <TPTextarea
            value={draft.description}
            onChange={(v) => set("description", v)}
            rows={2}
            placeholder="Descripción opcional..."
          />
        </TPField>

        {/* Notas */}
        <TPField label="Notas internas">
          <TPTextarea
            value={draft.notes}
            onChange={(v) => set("notes", v)}
            rows={2}
            placeholder="Notas internas opcionales..."
          />
        </TPField>

        {/* Favorita */}
        <TPCheckbox
          checked={draft.isFavorite}
          onChange={(v) => set("isFavorite", v)}
          label="Marcar como lista favorita en este alcance"
        />

        {/* Botones */}
        <div className="flex justify-end gap-2 pt-2">
          <TPButton variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </TPButton>
          <TPButton
            variant="primary"
            onClick={onSave}
            loading={saving}
            icon={saving ? <Loader2 size={14} className="animate-spin" /> : undefined}
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
function PriceListViewContent({
  row,
  categories,
}: {
  row: PriceListRow;
  categories: CategoryRow[];
}) {
  function item(label: string, value: React.ReactNode) {
    return (
      <div>
        <div className="text-xs text-muted mb-0.5">{label}</div>
        <div className="text-sm text-text">{value || <span className="text-muted">-</span>}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        {item("Nombre", row.name)}
        {item("Código", <span className="font-mono">{row.code}</span>)}
        {item("Alcance", SCOPE_LABELS[row.scope])}
        {item(
          "Categoría",
          row.category?.name ?? (row.categoryId ? row.categoryId : "-")
        )}
        {item("Modo de cálculo", MODE_LABELS[row.mode])}
        {item(
          "Estado",
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
              row.isActive
                ? "bg-success/10 text-success"
                : "bg-muted/10 text-muted"
            )}
          >
            {row.isActive ? "Activa" : "Inactiva"}
          </span>
        )}
      </div>

      {/* Márgenes */}
      <div className="rounded-lg bg-surface p-3 space-y-2">
        <div className="text-xs font-semibold text-muted uppercase tracking-wide">
          Márgenes y precios
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {row.mode === "MARGIN_TOTAL" && item("Margen total", fmt(row.marginTotal))}
          {row.mode === "METAL_HECHURA" && (
            <>
              {item("Margen metal", fmt(row.marginMetal))}
              {item("Margen hechura", fmt(row.marginHechura))}
            </>
          )}
          {row.mode === "COST_PER_GRAM" && item("Costo por gramo", fmt(row.costPerGram, ""))}
          {item("Recargo", fmt(row.surcharge))}
          {item(
            "Precio mínimo",
            row.minimumPrice
              ? parseFloat(row.minimumPrice).toLocaleString("es-AR")
              : "-"
          )}
        </div>
      </div>

      {/* Redondeo */}
      <div className="rounded-lg bg-surface p-3 space-y-2">
        <div className="text-xs font-semibold text-muted uppercase tracking-wide">
          Redondeo
        </div>
        <div className="grid grid-cols-3 gap-x-6 gap-y-2">
          {item("Aplicar en", ROUNDING_TARGET_LABELS[row.roundingTarget])}
          {item("Precisión", ROUNDING_MODE_LABELS[row.roundingMode])}
          {item("Dirección", ROUNDING_DIRECTION_LABELS[row.roundingDirection])}
        </div>
      </div>

      {/* Vigencia */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        {item("Válida desde", fmtDate(row.validFrom))}
        {item("Válida hasta", fmtDate(row.validTo))}
      </div>

      {row.description && item("Descripción", row.description)}
      {row.notes && item("Notas internas", row.notes)}

      {item(
        "Favorita",
        row.isFavorite ? (
          <span className="inline-flex items-center gap-1 text-primary text-xs font-medium">
            <Star size={12} className="fill-primary" /> Sí
          </span>
        ) : (
          "No"
        )
      )}
    </div>
  );
}
