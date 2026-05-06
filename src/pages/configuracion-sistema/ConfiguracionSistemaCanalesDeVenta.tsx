// src/pages/configuracion-sistema/ConfiguracionSistemaCanalesDeVenta.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useConfirmDelete } from "../../hooks/useConfirmDelete";
import { Plus, X, Check, Star } from "lucide-react";

import { TPSectionShell } from "../../components/ui/TPSectionShell";
import { TPButton } from "../../components/ui/TPButton";
import { TPField } from "../../components/ui/TPField";
import TPInput from "../../components/ui/TPInput";
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
  salesChannelsApi,
  type SalesChannelRow,
  type SalesChannelAdjustmentType,
  type SalesChannelPayload,
} from "../../services/sales-channels";

/* ── Labels ─────────────────────────────────────────────────────────────────── */
const ADJ_TYPE_LABELS: Record<SalesChannelAdjustmentType, string> = {
  PERCENTAGE: "Porcentaje (%)",
  FIXED:      "Monto fijo ($)",
};

const ADJ_TYPE_OPTIONS = Object.entries(ADJ_TYPE_LABELS).map(([value, label]) => ({ value, label }));

/* ── Draft ───────────────────────────────────────────────────────────────────── */
type Draft = {
  name:            string;
  code:            string;
  adjustmentType:  SalesChannelAdjustmentType;
  adjustmentValue: number | null;
  isFavorite:      boolean;
  isActive:        boolean;
  notes:           string;
};

const EMPTY_DRAFT: Draft = {
  name: "", code: "", adjustmentType: "PERCENTAGE",
  adjustmentValue: null, isFavorite: false, isActive: true, notes: "",
};

/* ── Columnas ────────────────────────────────────────────────────────────────── */
const COL_DEFS: TPColDef[] = [
  { key: "name",            label: "Canal",   canHide: false, sortKey: "name" },
  { key: "adjustmentValue", label: "Ajuste",  sortKey: "adjustmentValue" },
  { key: "code",            label: "Código",  sortKey: "code", visible: false },
  { key: "isActive",        label: "Estado",  sortKey: "isActive" },
  { key: "actions",         label: "",        canHide: false, align: "right" },
];

/* ── Helpers ─────────────────────────────────────────────────────────────────── */
function formatAdjValue(row: SalesChannelRow): string {
  const val = parseFloat(row.adjustmentValue);
  if (row.adjustmentType === "PERCENTAGE") return `${val.toFixed(2)}%`;
  return `$${val.toFixed(2)}`;
}

/* =========================================================
   COMPONENTE
========================================================= */
export default function ConfiguracionSistemaCanalesDeVenta() {
  const [rows, setRows]       = useState<SalesChannelRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ]             = useState("");

  type SortKey = "name" | "code" | "adjustmentValue" | "isActive";
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: string) {
    const k = key as SortKey;
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  }

  const [viewOpen,   setViewOpen]   = useState(false);
  const [viewTarget, setViewTarget] = useState<SalesChannelRow | null>(null);

  const [editOpen,   setEditOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState<SalesChannelRow | null>(null);
  const [draft,      setDraft]      = useState<Draft>({ ...EMPTY_DRAFT });
  const [submitted,  setSubmitted]  = useState(false);
  const [busySave,   setBusySave]   = useState(false);

  const { askDelete, dialogProps } = useConfirmDelete();

  /* ── Carga ──────────────────────────────────────────────────────────────── */
  async function load() {
    try {
      setLoading(true);
      setRows(await salesChannelsApi.list());
    } catch (e: any) {
      toast.error(e?.message || "Error al cargar canales.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  /* ── Filtrado y orden ───────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    const sq = q.trim().toLowerCase();
    const arr = sq
      ? rows.filter(r => r.name.toLowerCase().includes(sq) || r.code.toLowerCase().includes(sq))
      : rows;
    return [...arr].sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortKey === "adjustmentValue") {
        return (parseFloat(a.adjustmentValue) - parseFloat(b.adjustmentValue)) * mul;
      }
      if (sortKey === "isActive") return ((+b.isActive) - (+a.isActive)) * mul;
      return String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""), "es") * mul;
    });
  }, [rows, q, sortKey, sortDir]);

  /* ── Modales ────────────────────────────────────────────────────────────── */
  function openView(row: SalesChannelRow) {
    setViewTarget(row);
    setViewOpen(true);
  }

  function openCreate() {
    setEditTarget(null);
    setDraft({ ...EMPTY_DRAFT });
    setSubmitted(false);
    setEditOpen(true);
  }

  function openEdit(row: SalesChannelRow) {
    setEditTarget(row);
    setDraft({
      name:            row.name,
      code:            row.code,
      adjustmentType:  row.adjustmentType,
      adjustmentValue: parseFloat(row.adjustmentValue),
      isFavorite:      row.isFavorite,
      isActive:        row.isActive,
      notes:           row.notes ?? "",
    });
    setSubmitted(false);
    setEditOpen(true);
  }

  /* ── Validación ─────────────────────────────────────────────────────────── */
  const nameError = submitted && !draft.name.trim() ? "Requerido" : undefined;
  const valueError = submitted && draft.adjustmentValue === null ? "Requerido" : undefined;

  function validate(): boolean {
    return !draft.name.trim() || draft.adjustmentValue === null;
  }

  /* ── Guardar ────────────────────────────────────────────────────────────── */
  async function handleSave() {
    setSubmitted(true);
    if (validate()) return;

    const payload: SalesChannelPayload = {
      name:            draft.name.trim(),
      code:            draft.code.trim() || undefined,
      adjustmentType:  draft.adjustmentType,
      adjustmentValue: draft.adjustmentValue ?? 0,
      isFavorite:      draft.isFavorite,
      isActive:        draft.isActive,
      notes:           draft.notes.trim(),
    };

    try {
      setBusySave(true);
      if (editTarget) {
        await salesChannelsApi.update(editTarget.id, payload);
        toast.success("Canal actualizado.");
      } else {
        await salesChannelsApi.create(payload);
        toast.success("Canal creado.");
      }
      setEditOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar.");
    } finally {
      setBusySave(false);
    }
  }

  /* ── Toggle ─────────────────────────────────────────────────────────────── */
  async function handleToggle(row: SalesChannelRow) {
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, isActive: !r.isActive } : r));
    try {
      await salesChannelsApi.toggle(row.id);
      toast.success(row.isActive ? "Canal desactivado." : "Canal activado.");
      await load();
    } catch (e: any) {
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, isActive: row.isActive } : r));
      toast.error(e?.message || "Error al cambiar estado.");
    }
  }

  /* ── Favorito ───────────────────────────────────────────────────────────── */
  async function handleFavorite(row: SalesChannelRow) {
    try {
      await salesChannelsApi.favorite(row.id);
      toast.success(row.isFavorite ? "Favorito quitado." : "Canal marcado como favorito.");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Error al cambiar favorito.");
    }
  }

  /* ── JSX ─────────────────────────────────────────────────────────────────── */
  return (
    <TPSectionShell title="Canales de Venta" subtitle="Ajuste comercial adicional por canal (Mercado Libre, Mayorista, etc.)">
      <TPTableKit
        columns={COL_DEFS}
        rows={filtered}
        storageKey="tptech_col_canales_venta"
        loading={loading}
        search={q}
        onSearchChange={setQ}
        searchPlaceholder="Buscar canal..."
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={toggleSort}
        emptyText="No hay canales de venta creados todavía."
        onRowClick={(row) => openView(row)}
        actions={
          <TPButton variant="primary" iconLeft={<Plus size={16} />} onClick={openCreate}>
            Nuevo canal
          </TPButton>
        }
        renderRow={(row: SalesChannelRow, vis) => (
          <TPTr key={row.id} className={!row.isActive ? "opacity-60" : undefined}>
            {vis.name && (
              <TPTd>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">{row.name}</span>
                  {row.isFavorite && <Star size={12} className="shrink-0 fill-amber-400 text-amber-400" />}
                </div>
              </TPTd>
            )}
            {vis.adjustmentValue && (
              <TPTd className="hidden md:table-cell">
                <div className="tabular-nums font-medium text-sm">{formatAdjValue(row)}</div>
                <div className="text-xs text-muted">{ADJ_TYPE_LABELS[row.adjustmentType]}</div>
              </TPTd>
            )}
            {vis.code && (
              <TPTd className="hidden md:table-cell">
                <span className="font-mono text-xs text-muted">{row.code || "—"}</span>
              </TPTd>
            )}
            {vis.isActive && (
              <TPTd className="hidden md:table-cell"><TPStatusPill active={row.isActive} /></TPTd>
            )}
            {vis.actions && (
              <TPTd className="text-right">
                <TPRowActions
                  onView={() => openView(row)}
                  onFavorite={() => handleFavorite(row)}
                  isFavorite={row.isFavorite}
                  onEdit={() => openEdit(row)}
                  onToggle={() => handleToggle(row)}
                  isActive={row.isActive}
                  onDelete={() => askDelete({
                    entityName: "canal de venta",
                    entityLabel: row.name,
                    onDelete: () => salesChannelsApi.remove(row.id),
                    onAfterSuccess: load,
                  })}
                />
              </TPTd>
            )}
          </TPTr>
        )}
      />

      {/* ── Modal alta / edición ─────────────────────────────────────────────── */}
      <Modal
        open={editOpen}
        title={editTarget ? "Editar canal" : "Nuevo canal de venta"}
        maxWidth="md"
        busy={busySave}
        onClose={() => !busySave && setEditOpen(false)}
        onEnter={handleSave}
        footer={
          <>
            <TPButton variant="secondary" iconLeft={<X size={16} />} onClick={() => setEditOpen(false)} disabled={busySave}>
              Cancelar
            </TPButton>
            <TPButton variant="primary" iconLeft={<Check size={16} />} onClick={handleSave} loading={busySave}>
              Guardar
            </TPButton>
          </>
        }
      >
        <div className="space-y-5">
          {/* Identificación */}
          <div className="space-y-3">
            <TPField label="Nombre" required error={nameError}>
              <TPInput
                value={draft.name}
                onChange={v => setDraft(d => ({ ...d, name: v }))}
                placeholder="Ej: Mercado Libre, Mayorista, Showroom"
                data-tp-autofocus="1"
              />
            </TPField>
          </div>

          {/* Ajuste */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ajuste de precio</p>
            <TPField label="Tipo de ajuste">
              <TPComboFixed
                value={draft.adjustmentType}
                onChange={v => setDraft(d => ({ ...d, adjustmentType: v as SalesChannelAdjustmentType }))}
                options={ADJ_TYPE_OPTIONS}
              />
            </TPField>
            <TPField
              label="Valor"
              hint={draft.adjustmentType === "PERCENTAGE" ? "Use valores negativos para descuentos (ej: -10 = -10%)" : "Use valores negativos para descuentos"}
              required
              error={valueError}
            >
              <TPNumberInput
                value={draft.adjustmentValue}
                onChange={v => setDraft(d => ({ ...d, adjustmentValue: v }))}
                decimals={2}
                suffix={draft.adjustmentType === "PERCENTAGE" ? "%" : undefined}
                placeholder="30"
              />
            </TPField>
          </div>

          {/* Notas */}
          <TPField label="Notas internas">
            <TPTextarea
              value={draft.notes}
              onChange={v => setDraft(d => ({ ...d, notes: v }))}
              placeholder="Condiciones, acuerdos, observaciones..."
              minH={64}
            />
          </TPField>
        </div>
      </Modal>

      {/* ── Modal ver detalle ────────────────────────────────────────────────── */}
      <SalesChannelViewModal
        open={viewOpen}
        row={viewTarget}
        onClose={() => setViewOpen(false)}
      />

      <ConfirmDeleteDialog {...dialogProps} />
    </TPSectionShell>
  );
}

/* ── Modal de detalle (solo lectura) ────────────────────────────────────────── */
function SalesChannelViewModal({
  open, row, onClose,
}: {
  open: boolean;
  row: SalesChannelRow | null;
  onClose: () => void;
}) {
  if (!row) return null;

  const fields: [string, string][] = [
    ["Nombre",        row.name],
    ["Código",        row.code || "—"],
    ["Tipo de ajuste", ADJ_TYPE_LABELS[row.adjustmentType]],
    ["Valor",         formatAdjValue(row)],
    ["Favorito",      row.isFavorite ? "Sí" : "No"],
    ["Estado",        row.isActive   ? "Activo" : "Inactivo"],
  ];

  return (
    <Modal
      open={open}
      title={row.name}
      maxWidth="sm"
      onClose={onClose}
      footer={
        <TPButton variant="secondary" onClick={onClose}>
          Cerrar
        </TPButton>
      }
    >
      <div className="text-sm divide-y divide-border">
        {fields.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-2">
            <span className="text-muted font-medium shrink-0">{label}</span>
            <span className="text-text text-right">{value}</span>
          </div>
        ))}
        {row.notes && (
          <div className="flex flex-col gap-1 py-2">
            <span className="text-muted font-medium">Notas</span>
            <span className="text-text whitespace-pre-line">{row.notes}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
