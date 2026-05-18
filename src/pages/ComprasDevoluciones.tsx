// src/pages/ComprasDevoluciones.tsx
// ============================================================================
// Devoluciones a proveedor — salida de mercadería devuelta a proveedores.
//
// Estado 100% local (useState). Sin backend, sin impacto real en stock, sin
// generación automática de nota de crédito. La devolución SOLO mueve stock
// (OUT). El ajuste económico es un documento separado (Notas de crédito
// proveedor).
//
// Pantalla construida sobre los componentes consolidados (Fase A/B/C):
//   · TPSectionShell + TPKpiBar + TPTableKit v2
//   · Modal + TPCard + TPField
//   · TPMovementLinesEditor (direction="OUT")
//   · TPDocumentModalFooter (footer del modal)
//   · TPStatusBadge (estados)
//   · document-helpers + document-types
// ============================================================================

import React, { useMemo, useState } from "react";
import {
  Undo2,
  FileText,
  CheckCircle2,
  PackageCheck,
  XCircle,
  Plus,
  Eye,
  Pencil,
  CheckCheck,
  X,
  Printer,
} from "lucide-react";

import { TPSectionShell } from "../components/ui/TPSectionShell";
import { TPKpiBar, type TPKpiItem } from "../components/ui/TPKpiBar";
import { TPTableKit, type TPColDef } from "../components/ui/TPTableKit";
import { TPTr, TPTd } from "../components/ui/TPTable";
import { TPButton } from "../components/ui/TPButton";
import { TPActionsMenu, type TPActionsMenuItem } from "../components/ui/TPActionsMenu";
import { TPCard } from "../components/ui/TPCard";
import { TPField } from "../components/ui/TPField";
import TPInput from "../components/ui/TPInput";
import TPSelect from "../components/ui/TPSelect";
import { Modal } from "../components/ui/Modal";
import { TPStatusBadge } from "../components/ui/TPStatusBadge";
import { TPMovementLinesEditor } from "../components/ui/TPMovementLinesEditor";
import { TPDocumentModalFooter } from "../components/ui/TPDocumentModalFooter";

import { toast } from "../lib/toast";
import {
  uid,
  todayISO,
  fmtDate,
  nextDocNumber,
} from "../lib/document-helpers";
import { formatQty as fmtQty } from "../lib/pricing/format";
import { type MovementLine } from "../lib/document-types";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

type ReturnStatus = "DRAFT" | "CONFIRMED" | "PARTIAL" | "CANCELLED";

type PurchaseReturn = {
  id: string;
  number: string;           // "DVP-0001"
  date: string;             // ISO
  supplier: string;
  sourceDocument: string;   // "FP-0001" / "REC-0001" — opcional
  warehouse: string;        // almacén ORIGEN
  notes: string;
  lines: MovementLine[];
  status: ReturnStatus;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function returnedItemsCount(r: PurchaseReturn): number {
  return r.lines.reduce((s, l) => s + (Number.isFinite(l.movingQty) ? l.movingQty : 0), 0);
}

/**
 * Estado agregado de la devolución derivado de las líneas.
 * - Si ninguna línea devuelve nada → DRAFT
 * - Si todas las líneas quedan completas (after === ordered) → CONFIRMED
 * - Si hay devolución pero todavía queda pendiente → PARTIAL
 */
function deriveAggregateStatus(lines: MovementLine[]): ReturnStatus {
  if (lines.length === 0) return "DRAFT";
  const anyReturning = lines.some((l) => l.movingQty > 0);
  if (!anyReturning) return "DRAFT";
  const allComplete = lines.every((l) => {
    if (l.orderedQty <= 0) return true;
    return l.alreadyMovedQty + l.movingQty >= l.orderedQty;
  });
  return allComplete ? "CONFIRMED" : "PARTIAL";
}

// ─────────────────────────────────────────────────────────────────────────────
// Columnas
// ─────────────────────────────────────────────────────────────────────────────

const COLS: TPColDef[] = [
  { key: "number",    label: "Número",           width: "120px", sortKey: "number" },
  { key: "date",      label: "Fecha",            width: "110px", sortKey: "date" },
  { key: "supplier",  label: "Proveedor",                        sortKey: "supplier" },
  { key: "source",    label: "Documento origen", width: "140px" },
  { key: "items",     label: "Ítems devueltos",  width: "130px", align: "right", sortKey: "items" },
  { key: "status",    label: "Estado",           width: "120px" },
  { key: "actions",   label: "",                 width: "48px",  canHide: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// Pantalla
// ─────────────────────────────────────────────────────────────────────────────

type StatusFilter = "ALL" | ReturnStatus;

export default function ComprasDevoluciones() {
  const [returns, setReturns] = useState<PurchaseReturn[]>([]);
  const [q, setQ]                           = useState("");
  const [statusFilter, setStatusFilter]     = useState<StatusFilter>("ALL");
  const [supplierFilter, setSupplierFilter] = useState<string>("ALL");

  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft]           = useState<PurchaseReturn | null>(null);
  const [isNew, setIsNew]           = useState(true);

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const kpis: TPKpiItem[] = useMemo(() => {
    const total     = returns.length;
    const drafts    = returns.filter((r) => r.status === "DRAFT").length;
    const confirmed = returns.filter((r) => r.status === "CONFIRMED").length;
    const partial   = returns.filter((r) => r.status === "PARTIAL").length;
    const cancelled = returns.filter((r) => r.status === "CANCELLED").length;

    return [
      { id: "total",     label: "Total devoluciones", value: total,     hint: "Todas",                tone: total > 0 ? "primary" : "neutral",    icon: <Undo2 size={12} /> },
      { id: "drafts",    label: "Borradores",         value: drafts,    hint: "En preparación",       tone: "neutral",                            icon: <FileText size={12} /> },
      { id: "confirmed", label: "Confirmadas",        value: confirmed, hint: "Devueltas 100%",        tone: confirmed > 0 ? "success" : "neutral", icon: <CheckCircle2 size={12} /> },
      { id: "partial",   label: "Parciales",          value: partial,   hint: "Devolución incompleta", tone: partial > 0 ? "warning" : "neutral",   icon: <PackageCheck size={12} /> },
      { id: "cancelled", label: "Anuladas",           value: cancelled, hint: "Canceladas",            tone: cancelled > 0 ? "danger" : "neutral",  icon: <XCircle size={12} /> },
    ];
  }, [returns]);

  // ── Filtrado ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return returns.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (supplierFilter !== "ALL" && r.supplier !== supplierFilter) return false;
      if (!term) return true;
      return `${r.number} ${r.supplier} ${r.sourceDocument}`.toLowerCase().includes(term);
    });
  }, [returns, q, statusFilter, supplierFilter]);

  // ── Opciones de filtros ──────────────────────────────────────────────────
  const supplierOptions = useMemo(() => {
    const uniq = Array.from(new Set(returns.map((r) => r.supplier).filter(Boolean))).sort();
    return [
      { value: "ALL", label: "Todos los proveedores" },
      ...uniq.map((s) => ({ value: s, label: s })),
    ];
  }, [returns]);

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "ALL",       label: "Todos los estados" },
    { value: "DRAFT",     label: "Borrador" },
    { value: "CONFIRMED", label: "Confirmada" },
    { value: "PARTIAL",   label: "Parcial" },
    { value: "CANCELLED", label: "Anulada" },
  ];

  // ── Crear / editar ────────────────────────────────────────────────────────
  function openNew() {
    const blank: PurchaseReturn = {
      id:             uid(),
      number:         nextDocNumber("DVP", returns),
      date:           todayISO(),
      supplier:       "",
      sourceDocument: "",
      warehouse:      "",
      notes:          "",
      lines:          [],
      status:         "DRAFT",
    };
    setDraft(blank);
    setIsNew(true);
    setEditorOpen(true);
  }

  function openEdit(r: PurchaseReturn) {
    setDraft({ ...r, lines: r.lines.map((l) => ({ ...l })) });
    setIsNew(false);
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setDraft(null);
  }

  function saveDraft() {
    if (!draft) return;

    if (!draft.supplier.trim())   { toast.error("El proveedor es obligatorio.");       return; }
    if (!draft.date)              { toast.error("La fecha es obligatoria.");           return; }
    if (!draft.warehouse.trim())  { toast.error("El almacén origen es obligatorio.");  return; }
    if (draft.lines.length === 0) { toast.error("Agregá al menos una línea.");         return; }

    for (const l of draft.lines) {
      if (l.movingQty <= 0) {
        toast.error(`La cantidad a devolver debe ser mayor a 0 (${l.article || "línea sin artículo"}).`);
        return;
      }
      const pending = Math.max(0, l.orderedQty - l.alreadyMovedQty);
      if (l.orderedQty > 0 && l.movingQty > pending) {
        toast.error(`"${l.article || "Línea"}" supera el pendiente (${fmtQty(pending)}).`);
        return;
      }
    }

    setReturns((prev) => {
      const exists = prev.some((r) => r.id === draft.id);
      return exists ? prev.map((r) => (r.id === draft.id ? draft : r)) : [draft, ...prev];
    });
    toast.success(isNew ? `Devolución ${draft.number} creada` : `Devolución ${draft.number} actualizada`);
    closeEditor();
  }

  function confirmReturn(r: PurchaseReturn) {
    // Placeholder: en Fase 6 generará ArticleMovement OUT (sourceType=PURCHASE_RETURN)
    if (r.status === "CANCELLED") { toast.error("No se puede confirmar una devolución cancelada."); return; }
    if (r.lines.length === 0 || r.lines.every((l) => l.movingQty <= 0)) {
      toast.error("No hay cantidades a devolver en esta devolución.");
      return;
    }
    const newStatus = deriveAggregateStatus(r.lines);
    setReturns((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: newStatus } : x)));
    toast.success(`Devolución ${r.number} confirmada — impacto de stock próximamente`);
  }

  function cancelReturn(r: PurchaseReturn) {
    if (r.status === "CANCELLED") return;
    setReturns((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: "CANCELLED" } : x)));
    toast.success(`Devolución ${r.number} anulada`);
  }

  function rowActions(r: PurchaseReturn): TPActionsMenuItem[] {
    return [
      { label: "Ver detalle", icon: <Eye size={14} />,      onClick: () => openEdit(r) },
      { label: "Editar",      icon: <Pencil size={14} />,   onClick: () => openEdit(r), disabled: r.status === "CANCELLED" },
      { type: "separator" },
      { label: "Confirmar devolución", icon: <CheckCheck size={14} />, onClick: () => confirmReturn(r), disabled: r.status === "CANCELLED" },
      { label: "Anular",      icon: <X size={14} />,        onClick: () => cancelReturn(r), disabled: r.status === "CANCELLED" },
      { type: "separator" },
      { label: "Imprimir",    icon: <Printer size={14} />,  onClick: () => toast.info("Impresión — próximamente") },
    ];
  }

  // ── Render row ───────────────────────────────────────────────────────────
  function renderRow(
    r: PurchaseReturn,
    vis: Record<string, boolean>,
    _sel?: unknown,
    orderedKeys?: string[],
  ) {
    const cells: Record<string, React.ReactNode> = {
      number:   <TPTd className="font-mono text-xs font-semibold text-text">{r.number}</TPTd>,
      date:     <TPTd className="text-sm text-text/80">{fmtDate(r.date)}</TPTd>,
      supplier: <TPTd className="text-sm text-text truncate">{r.supplier || <span className="text-muted">Sin proveedor</span>}</TPTd>,
      source:   <TPTd className="font-mono text-[11px] text-muted">{r.sourceDocument || "—"}</TPTd>,
      items:    <TPTd className="text-right tabular-nums">{fmtQty(returnedItemsCount(r))}</TPTd>,
      status: (
        <TPTd>
          <TPStatusBadge
            status={r.status}
            tone={r.status === "CONFIRMED" ? "success" : undefined}
            label={r.status === "CANCELLED" ? "Anulada" : undefined}
          />
        </TPTd>
      ),
      actions: (
        <TPTd className="text-right px-2" data-tp-actions>
          <TPActionsMenu items={rowActions(r)} title="Acciones" />
        </TPTd>
      ),
    };

    const keys = orderedKeys && orderedKeys.length > 0
      ? orderedKeys
      : COLS.filter((c) => vis[c.key] !== false).map((c) => c.key);

    return (
      <TPTr key={r.id}>
        {keys.map((k) => (
          <React.Fragment key={k}>{cells[k]}</React.Fragment>
        ))}
      </TPTr>
    );
  }

  // ── Filtros ──────────────────────────────────────────────────────────────
  const filters = (
    <div className="flex items-center gap-2">
      <div className="w-44">
        <TPSelect
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
          options={statusOptions}
        />
      </div>
      <div className="w-48">
        <TPSelect
          value={supplierFilter}
          onChange={setSupplierFilter}
          options={supplierOptions}
        />
      </div>
    </div>
  );

  return (
    <TPSectionShell
      title="Devoluciones a proveedor"
      subtitle="Salida de mercadería devuelta a proveedores"
      right={
        <TPButton variant="primary" onClick={openNew} iconLeft={<Plus size={14} />}>
          Nueva devolución
        </TPButton>
      }
    >
      <div className="space-y-4">
        <TPKpiBar items={kpis} columns={5} />

        <TPTableKit<PurchaseReturn>
          rows={filtered}
          columns={COLS}
          storageKey="tp_purchase_returns_cols"
          search={{
            value: q,
            onChange: setQ,
            placeholder: "Buscar por número, proveedor o documento origen…",
            debounceMs: 150,
          }}
          sortPersistKey="tp_purchase_returns"
          columnPicker
          headerLeft={filters}
          countLabel={(n) => `${n} ${n === 1 ? "devolución" : "devoluciones"}`}
          emptyText={
            q || statusFilter !== "ALL" || supplierFilter !== "ALL"
              ? "Sin resultados con los filtros aplicados."
              : "Todavía no hay devoluciones. Creá la primera desde «Nueva devolución»."
          }
          renderRow={renderRow}
        />
      </div>

      {draft && (
        <EditorModal
          open={editorOpen}
          draft={draft}
          isNew={isNew}
          onChange={setDraft}
          onSave={saveDraft}
          onClose={closeEditor}
        />
      )}
    </TPSectionShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal (editor)
// ─────────────────────────────────────────────────────────────────────────────

function EditorModal(props: {
  open: boolean;
  draft: PurchaseReturn;
  isNew: boolean;
  onChange: (next: PurchaseReturn) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const { open, draft, isNew, onChange, onSave, onClose } = props;

  function patch<K extends keyof PurchaseReturn>(key: K, value: PurchaseReturn[K]) {
    onChange({ ...draft, [key]: value });
  }

  function addLine() {
    onChange({
      ...draft,
      lines: [
        ...draft.lines,
        { id: uid(), article: "", variant: "", orderedQty: 0, alreadyMovedQty: 0, movingQty: 0 },
      ],
    });
  }

  function patchLine(lineId: string, p: Partial<MovementLine>) {
    onChange({
      ...draft,
      lines: draft.lines.map((l) => (l.id === lineId ? { ...l, ...p } : l)),
    });
  }

  function removeLine(lineId: string) {
    onChange({
      ...draft,
      lines: draft.lines.filter((l) => l.id !== lineId),
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? "Nueva devolución a proveedor" : `Editar devolución ${draft.number}`}
      subtitle={`Número ${draft.number}`}
      maxWidth="3xl"
      resizable
      maximizable
      maximizedMode="embedded"
      modalKey="compras-devoluciones-editor"
      onEnter={onSave}
      footer={
        <TPDocumentModalFooter
          isNew={isNew}
          onCancel={onClose}
          onSave={onSave}
        />
      }
    >
      <div className="space-y-4">
        <TPCard title="Datos principales">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TPField label="Proveedor" required>
              <TPInput
                value={draft.supplier}
                onChange={(v: string) => patch("supplier", v)}
                placeholder="Nombre del proveedor"
              />
            </TPField>

            <TPField label="Documento origen" hint="Ej: FP-0001 / REC-0001 (opcional)">
              <TPInput
                value={draft.sourceDocument}
                onChange={(v: string) => patch("sourceDocument", v.toUpperCase())}
                placeholder="FP-0001"
              />
            </TPField>

            <TPField label="Fecha" required>
              <input
                type="date"
                value={draft.date}
                onChange={(e) => patch("date", e.target.value)}
                className="tp-input w-full"
              />
            </TPField>

            <TPField label="Almacén origen" required>
              <TPInput
                value={draft.warehouse}
                onChange={(v: string) => patch("warehouse", v)}
                placeholder="Nombre del almacén"
              />
            </TPField>

            <TPField label="Observaciones" className="sm:col-span-2">
              <TPInput
                value={draft.notes}
                onChange={(v: string) => patch("notes", v)}
                placeholder="Motivo de devolución, estado de los ítems, etc."
              />
            </TPField>
          </div>
        </TPCard>

        <TPCard
          title="Líneas a devolver"
          right={
            <TPButton
              variant="secondary"
              onClick={addLine}
              iconLeft={<Plus size={14} />}
              className="h-8 text-xs"
            >
              Agregar línea
            </TPButton>
          }
        >
          {draft.lines.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
              Sin líneas. Agregá artículos para registrar qué se está devolviendo al proveedor.
            </div>
          ) : (
            <TPMovementLinesEditor
              lines={draft.lines}
              direction="OUT"
              updateLine={patchLine}
              removeLine={removeLine}
            />
          )}
        </TPCard>
      </div>
    </Modal>
  );
}
