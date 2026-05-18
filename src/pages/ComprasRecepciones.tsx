// src/pages/ComprasRecepciones.tsx
// ============================================================================
// Recepciones de compra — vista consultiva + creación simple.
//
// Estado 100% local (useState). Sin backend, sin impacto en stock, sin deuda.
// Preparada para evolucionar a:
//   · ArticleMovement IN (sourceType=PURCHASE) con warehouse destino
//   · enganche con Órdenes de compra (prefill de líneas + estado OC parcial/cerrada)
//   · generación de factura proveedor + cuenta corriente
//
// Sigue el mismo patrón visual que ComprasOrdenes y las pantallas de Inventario:
//   TPSectionShell + TPKpiBar + TPTableKit v2 + Modal + TPCard + TPField.
// ============================================================================

import React, { useMemo, useState } from "react";
import {
  Truck,
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
import TPNumberInput from "../components/ui/TPNumberInput";
import TPSelect from "../components/ui/TPSelect";
import { Modal } from "../components/ui/Modal";
import { TPStatusBadge } from "../components/ui/TPStatusBadge";
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
import { TPMovementLinesEditor } from "../components/ui/TPMovementLinesEditor";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos locales
// ─────────────────────────────────────────────────────────────────────────────

type ReceiptStatus = "DRAFT" | "CONFIRMED" | "PARTIAL" | "CANCELLED";

type Receipt = {
  id: string;
  number: string;              // "REC-0001"
  date: string;                // ISO yyyy-mm-dd
  supplier: string;
  purchaseOrderNumber: string; // vacío si no hay OC asociada
  warehouse: string;
  notes: string;
  lines: MovementLine[];
  status: ReceiptStatus;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function receivedItemsCount(r: Receipt): number {
  return r.lines.reduce((s, l) => s + (Number.isFinite(l.movingQty) ? l.movingQty : 0), 0);
}

/**
 * Estado agregado de la recepción derivado de las líneas.
 * - Si ninguna línea recibe nada → DRAFT
 * - Si todas las líneas quedan completas (after === ordered) → CONFIRMED
 * - Si hay recepción pero todavía queda pendiente → PARTIAL
 */
function deriveAggregateStatus(lines: MovementLine[]): ReceiptStatus {
  if (lines.length === 0) return "DRAFT";
  const anyReceiving = lines.some((l) => l.movingQty > 0);
  if (!anyReceiving) return "DRAFT";
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
  { key: "number",   label: "Número",     width: "120px", sortKey: "number" },
  { key: "date",     label: "Fecha",      width: "120px", sortKey: "date" },
  { key: "supplier", label: "Proveedor",                  sortKey: "supplier" },
  { key: "po",       label: "OC",         width: "120px", sortKey: "po" },
  { key: "items",    label: "Ítems rec.", width: "110px", align: "right", sortKey: "items" },
  { key: "status",   label: "Estado",     width: "120px" },
  { key: "actions",  label: "",           width: "48px",  canHide: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// Pantalla
// ─────────────────────────────────────────────────────────────────────────────

type StatusFilter = "ALL" | ReceiptStatus;

export default function ComprasRecepciones() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [q, setQ]               = useState("");
  const [statusFilter, setStatusFilter]     = useState<StatusFilter>("ALL");
  const [supplierFilter, setSupplierFilter] = useState<string>("ALL");

  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft]           = useState<Receipt | null>(null);
  const [isNew, setIsNew]           = useState(true);

  // ── KPIs (sobre todo el set) ─────────────────────────────────────────────
  const kpis: TPKpiItem[] = useMemo(() => {
    const total     = receipts.length;
    const drafts    = receipts.filter((r) => r.status === "DRAFT").length;
    const confirmed = receipts.filter((r) => r.status === "CONFIRMED").length;
    const partial   = receipts.filter((r) => r.status === "PARTIAL").length;
    const cancelled = receipts.filter((r) => r.status === "CANCELLED").length;

    return [
      { id: "total",     label: "Total recepciones", value: total,     hint: "Todas las recepciones", tone: total > 0 ? "primary" : "neutral",    icon: <Truck size={12} /> },
      { id: "drafts",    label: "Borradores",        value: drafts,    hint: "En preparación",         tone: "neutral",                            icon: <FileText size={12} /> },
      { id: "confirmed", label: "Confirmadas",       value: confirmed, hint: "Recibidas 100%",         tone: confirmed > 0 ? "success" : "neutral", icon: <CheckCircle2 size={12} /> },
      { id: "partial",   label: "Parciales",         value: partial,   hint: "Recepción incompleta",   tone: partial > 0 ? "warning" : "neutral",   icon: <PackageCheck size={12} /> },
      { id: "cancelled", label: "Canceladas",        value: cancelled, hint: "Anuladas",               tone: cancelled > 0 ? "danger" : "neutral",  icon: <XCircle size={12} /> },
    ];
  }, [receipts]);

  // ── Filtrado ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return receipts.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (supplierFilter !== "ALL" && r.supplier !== supplierFilter) return false;
      if (!term) return true;
      return `${r.number} ${r.supplier} ${r.purchaseOrderNumber}`.toLowerCase().includes(term);
    });
  }, [receipts, q, statusFilter, supplierFilter]);

  // ── Opciones de filtros ──────────────────────────────────────────────────
  const supplierOptions = useMemo(() => {
    const uniq = Array.from(new Set(receipts.map((r) => r.supplier).filter(Boolean))).sort();
    return [
      { value: "ALL", label: "Todos los proveedores" },
      ...uniq.map((s) => ({ value: s, label: s })),
    ];
  }, [receipts]);

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "ALL",       label: "Todos los estados" },
    { value: "DRAFT",     label: "Borrador" },
    { value: "CONFIRMED", label: "Confirmada" },
    { value: "PARTIAL",   label: "Parcial" },
    { value: "CANCELLED", label: "Cancelada" },
  ];

  // ── Acciones del listado ─────────────────────────────────────────────────
  function openNew() {
    const blank: Receipt = {
      id:                  uid(),
      number:              nextDocNumber("REC", receipts),
      date:                todayISO(),
      supplier:            "",
      purchaseOrderNumber: "",
      warehouse:           "",
      notes:               "",
      lines:               [],
      status:              "DRAFT",
    };
    setDraft(blank);
    setIsNew(true);
    setEditorOpen(true);
  }

  function saveDraft() {
    if (!draft) return;

    // Validaciones básicas (el user pidió estas)
    if (!draft.supplier.trim())  { toast.error("El proveedor es obligatorio."); return; }
    if (!draft.warehouse.trim()) { toast.error("El almacén destino es obligatorio."); return; }
    if (!draft.date)             { toast.error("La fecha es obligatoria."); return; }
    if (draft.lines.length === 0) { toast.error("Agregá al menos una línea."); return; }

    for (const l of draft.lines) {
      if (l.movingQty < 0) {
        toast.error(`La cantidad a recibir no puede ser negativa (${l.article || "línea sin artículo"}).`);
        return;
      }
      const pending = Math.max(0, l.orderedQty - l.alreadyMovedQty);
      if (l.orderedQty > 0 && l.movingQty > pending) {
        toast.error(`"${l.article || "Línea"}" supera el pendiente (${fmtQty(pending)}).`);
        return;
      }
    }

    setReceipts((prev) => {
      const exists = prev.some((r) => r.id === draft.id);
      return exists ? prev.map((r) => (r.id === draft.id ? draft : r)) : [...prev, draft];
    });
    toast.success(isNew ? `Recepción ${draft.number} creada` : `Recepción ${draft.number} actualizada`);
    setEditorOpen(false);
    setDraft(null);
  }

  function confirmReceipt(r: Receipt) {
    // Placeholder de Fase 6: no impacta stock todavía. Solo cambia status local.
    // TODO (Fase 6): por cada línea con movingQty > 0 →
    //   · crear ArticleMovement { kind: "IN", sourceType: "PURCHASE", warehouseId, lines... }
    //   · actualizar cantidades acumuladas de alreadyMovedQty
    //   · si todas las líneas quedan completas, sincronizar estado con la OC padre
    if (r.status === "CANCELLED") {
      toast.error("No se puede confirmar una recepción cancelada.");
      return;
    }
    if (r.lines.length === 0 || r.lines.every((l) => l.movingQty <= 0)) {
      toast.error("No hay cantidades a recibir en esta recepción.");
      return;
    }
    const newStatus = deriveAggregateStatus(r.lines);
    setReceipts((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: newStatus } : x)));
    toast.success(`Recepción ${r.number} confirmada — impacto de stock próximamente`);
  }

  function cancelReceipt(r: Receipt) {
    // Placeholder: solo UI. Fase 6 agregará auditoría de cancelación.
    toast.info(`Cancelar ${r.number} — próximamente`);
  }

  // ── Row actions ──────────────────────────────────────────────────────────
  function rowActions(r: Receipt): TPActionsMenuItem[] {
    return [
      {
        label: "Ver recepción",
        icon: <Eye size={14} />,
        onClick: () => toast.info(`Ver recepción ${r.number} — próximamente`),
      },
      {
        label: "Editar",
        icon: <Pencil size={14} />,
        onClick: () => toast.info(`Editar recepción ${r.number} — próximamente`),
      },
      { type: "separator" },
      {
        label: "Confirmar recepción",
        icon: <CheckCheck size={14} />,
        onClick: () => confirmReceipt(r),
      },
      {
        label: "Cancelar",
        icon: <X size={14} />,
        onClick: () => cancelReceipt(r),
      },
      { type: "separator" },
      {
        label: "Imprimir",
        icon: <Printer size={14} />,
        onClick: () => toast.info("Impresión — próximamente"),
      },
    ];
  }

  // ── Render row ───────────────────────────────────────────────────────────
  function renderRow(
    r: Receipt,
    vis: Record<string, boolean>,
    _sel?: unknown,
    orderedKeys?: string[],
  ) {
    const cells: Record<string, React.ReactNode> = {
      number: <TPTd className="font-mono text-xs font-semibold text-text">{r.number}</TPTd>,
      date:   <TPTd className="text-sm text-text/80">{fmtDate(r.date)}</TPTd>,
      supplier: (
        <TPTd className="text-sm text-text truncate">
          {r.supplier || <span className="text-muted">Sin proveedor</span>}
        </TPTd>
      ),
      po: (
        <TPTd className="font-mono text-xs text-muted">
          {r.purchaseOrderNumber || <span className="text-muted/60">—</span>}
        </TPTd>
      ),
      items:   <TPTd className="text-right tabular-nums">{fmtQty(receivedItemsCount(r))}</TPTd>,
      status:  (
        <TPTd>
          <TPStatusBadge
            status={r.status}
            tone={r.status === "CONFIRMED" ? "success" : undefined}
            label={r.status === "CANCELLED" ? "Cancelada" : undefined}
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

  // ── Filtros en header ────────────────────────────────────────────────────
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
      title="Recepciones"
      subtitle="Ingreso de mercadería desde proveedores"
      right={
        <TPButton variant="primary" onClick={openNew} iconLeft={<Plus size={14} />}>
          Nueva recepción
        </TPButton>
      }
    >
      <div className="space-y-4">
        <TPKpiBar items={kpis} columns={5} />

        <TPTableKit<Receipt>
          rows={filtered}
          columns={COLS}
          storageKey="tp_purchase_receipts_cols"
          search={{
            value: q,
            onChange: setQ,
            placeholder: "Buscar por número, proveedor u OC…",
            debounceMs: 150,
          }}
          sortPersistKey="tp_purchase_receipts"
          columnPicker
          headerLeft={filters}
          countLabel={(n) => `${n} ${n === 1 ? "recepción" : "recepciones"}`}
          emptyText={
            q || statusFilter !== "ALL" || supplierFilter !== "ALL"
              ? "Sin resultados con los filtros aplicados."
              : "Todavía no hay recepciones. Creá la primera desde «Nueva recepción»."
          }
          renderRow={renderRow}
        />
      </div>

      {draft && (
        <ReceiptEditorModal
          open={editorOpen}
          draft={draft}
          isNew={isNew}
          onChange={setDraft}
          onSave={saveDraft}
          onClose={() => {
            setEditorOpen(false);
            setDraft(null);
          }}
        />
      )}
    </TPSectionShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de editor
// ─────────────────────────────────────────────────────────────────────────────

function ReceiptEditorModal(props: {
  open: boolean;
  draft: Receipt;
  isNew: boolean;
  onChange: (next: Receipt) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const { open, draft, isNew, onChange, onSave, onClose } = props;

  function patch<K extends keyof Receipt>(key: K, value: Receipt[K]) {
    onChange({ ...draft, [key]: value });
  }

  function addLine() {
    onChange({
      ...draft,
      lines: [
        ...draft.lines,
        {
          id: uid(),
          article: "",
          variant: "",
          orderedQty: 0,
          alreadyMovedQty: 0,
          movingQty: 0,
        },
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
      title={isNew ? "Nueva recepción" : `Editar recepción ${draft.number}`}
      subtitle={`Número ${draft.number}`}
      maxWidth="3xl"
      resizable
      maximizable
      maximizedMode="embedded"
      modalKey="compras-recepciones-editor"
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

            <TPField label="Orden de compra" hint="Opcional — número de OC asociada">
              <TPInput
                value={draft.purchaseOrderNumber}
                onChange={(v: string) => patch("purchaseOrderNumber", v.toUpperCase())}
                placeholder="OC-0001"
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

            <TPField label="Almacén destino" required>
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
                placeholder="Notas internas (remito, transporte, etc.)"
              />
            </TPField>
          </div>
        </TPCard>

        <TPCard
          title="Líneas recibidas"
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
              Sin líneas. Agregá artículos para registrar qué se está recibiendo.
            </div>
          ) : (
            <TPMovementLinesEditor
              lines={draft.lines}
              direction="IN"
              updateLine={patchLine}
              removeLine={removeLine}
            />
          )}
        </TPCard>
      </div>
    </Modal>
  );
}

