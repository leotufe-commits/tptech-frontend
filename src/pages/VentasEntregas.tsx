// src/pages/VentasEntregas.tsx
// ============================================================================
// Entregas (remitos) — salida de mercadería a clientes.
//
// Espejo conceptual de ComprasRecepciones: misma estructura, mismo editor de
// líneas con soporte de entrega parcial. Sin backend, sin impacto real en
// stock, sin facturación.
//
// Preparada para Fase 6: la acción "Confirmar entrega" ya deriva el status
// (CONFIRMED / PARTIAL) y muestra un toast que anticipa el movimiento real de
// stock. Cuando se conecte al backend, el hook reemplazará el toast por un
// ArticleMovement OUT con sourceType=SALE.
// ============================================================================

import React, { useMemo, useState } from "react";
import {
  PackageCheck,
  FileText,
  CheckCircle2,
  PackageOpen,
  XCircle,
  Plus,
  Eye,
  Pencil,
  CheckCheck,
  X,
  Printer,
  History,
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
import { TPMovementLinesEditor } from "../components/ui/TPMovementLinesEditor";
import { TPDocumentModalFooter } from "../components/ui/TPDocumentModalFooter";

import { toast } from "../lib/toast";
import {
  uid,
  todayISO,
  fmtDate,
  fmtQty,
  nextDocNumber,
} from "../lib/document-helpers";
import { type MovementLine } from "../lib/document-types";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

type DeliveryStatus = "DRAFT" | "CONFIRMED" | "PARTIAL" | "CANCELLED";

type Delivery = {
  id: string;
  number: string;           // "REM-0001"
  date: string;             // ISO
  client: string;
  salesOrderNumber: string; // referencia a OV
  warehouse: string;        // almacén ORIGEN
  notes: string;
  lines: MovementLine[];
  status: DeliveryStatus;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function deliveredItemsCount(d: Delivery): number {
  return d.lines.reduce((s, l) => s + (Number.isFinite(l.movingQty) ? l.movingQty : 0), 0);
}

function deriveAggregateStatus(lines: MovementLine[]): DeliveryStatus {
  if (lines.length === 0) return "DRAFT";
  const anyDelivering = lines.some((l) => l.movingQty > 0);
  if (!anyDelivering) return "DRAFT";
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
  { key: "number",   label: "Número",           width: "120px", sortKey: "number" },
  { key: "date",     label: "Fecha",            width: "120px", sortKey: "date" },
  { key: "client",   label: "Cliente",                          sortKey: "client" },
  { key: "order",    label: "Orden",            width: "120px", sortKey: "order" },
  { key: "items",    label: "Ítems entregados", width: "140px", align: "right", sortKey: "items" },
  { key: "status",   label: "Estado",           width: "120px" },
  { key: "actions",  label: "",                 width: "48px",  canHide: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// Pantalla
// ─────────────────────────────────────────────────────────────────────────────

type StatusFilter = "ALL" | DeliveryStatus;

export default function VentasEntregas() {
  const [deliveries, setDeliveries]     = useState<Delivery[]>([]);
  const [q, setQ]                       = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [clientFilter, setClientFilter] = useState<string>("ALL");

  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft]           = useState<Delivery | null>(null);
  const [isNew, setIsNew]           = useState(true);

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const kpis: TPKpiItem[] = useMemo(() => {
    const total     = deliveries.length;
    const drafts    = deliveries.filter((d) => d.status === "DRAFT").length;
    const confirmed = deliveries.filter((d) => d.status === "CONFIRMED").length;
    const partial   = deliveries.filter((d) => d.status === "PARTIAL").length;
    const cancelled = deliveries.filter((d) => d.status === "CANCELLED").length;

    return [
      { id: "total",     label: "Total entregas", value: total,     hint: "Todos los remitos",    tone: total > 0 ? "primary" : "neutral",    icon: <PackageCheck size={12} /> },
      { id: "drafts",    label: "Borradores",     value: drafts,    hint: "En preparación",       tone: "neutral",                            icon: <FileText size={12} /> },
      { id: "confirmed", label: "Confirmadas",    value: confirmed, hint: "Entregadas al 100%",   tone: confirmed > 0 ? "success" : "neutral", icon: <CheckCircle2 size={12} /> },
      { id: "partial",   label: "Parciales",      value: partial,   hint: "Entrega incompleta",   tone: partial > 0 ? "warning" : "neutral",   icon: <PackageOpen size={12} /> },
      { id: "cancelled", label: "Canceladas",     value: cancelled, hint: "Anuladas",             tone: cancelled > 0 ? "danger" : "neutral",  icon: <XCircle size={12} /> },
    ];
  }, [deliveries]);

  // ── Filtrado ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return deliveries.filter((d) => {
      if (statusFilter !== "ALL" && d.status !== statusFilter) return false;
      if (clientFilter !== "ALL" && d.client !== clientFilter) return false;
      if (!term) return true;
      return `${d.number} ${d.client} ${d.salesOrderNumber}`.toLowerCase().includes(term);
    });
  }, [deliveries, q, statusFilter, clientFilter]);

  // ── Opciones de filtros ──────────────────────────────────────────────────
  const clientOptions = useMemo(() => {
    const uniq = Array.from(new Set(deliveries.map((d) => d.client).filter(Boolean))).sort();
    return [
      { value: "ALL", label: "Todos los clientes" },
      ...uniq.map((c) => ({ value: c, label: c })),
    ];
  }, [deliveries]);

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "ALL",       label: "Todos los estados" },
    { value: "DRAFT",     label: "Borrador" },
    { value: "CONFIRMED", label: "Confirmada" },
    { value: "PARTIAL",   label: "Parcial" },
    { value: "CANCELLED", label: "Cancelada" },
  ];

  // ── Acciones ─────────────────────────────────────────────────────────────
  function openNew() {
    const blank: Delivery = {
      id:               uid(),
      number:           nextDocNumber("REM", deliveries),
      date:             todayISO(),
      client:           "",
      salesOrderNumber: "",
      warehouse:        "",
      notes:            "",
      lines:            [],
      status:           "DRAFT",
    };
    setDraft(blank);
    setIsNew(true);
    setEditorOpen(true);
  }

  function saveDraft() {
    if (!draft) return;
    if (!draft.client.trim())     { toast.error("El cliente es obligatorio."); return; }
    if (!draft.warehouse.trim())  { toast.error("El almacén origen es obligatorio."); return; }
    if (!draft.date)              { toast.error("La fecha es obligatoria."); return; }
    if (draft.lines.length === 0) { toast.error("Agregá al menos una línea."); return; }

    for (const l of draft.lines) {
      if (l.movingQty < 0) {
        toast.error(`La cantidad a entregar no puede ser negativa (${l.article || "línea"}).`);
        return;
      }
      const pending = Math.max(0, l.orderedQty - l.alreadyMovedQty);
      if (l.orderedQty > 0 && l.movingQty > pending) {
        toast.error(`"${l.article || "Línea"}" supera el pendiente (${fmtQty(pending)}).`);
        return;
      }
    }

    setDeliveries((prev) => {
      const exists = prev.some((d) => d.id === draft.id);
      return exists ? prev.map((d) => (d.id === draft.id ? draft : d)) : [...prev, draft];
    });
    toast.success(isNew ? `Entrega ${draft.number} creada` : `Entrega ${draft.number} actualizada`);
    setEditorOpen(false);
    setDraft(null);
  }

  function confirmDelivery(d: Delivery) {
    // Placeholder de Fase 6: no mueve stock real. Solo deriva status local.
    // TODO (Fase 6): por cada línea con movingQty > 0 →
    //   · ArticleMovement { kind: "OUT", sourceType: "SALE", warehouseId, lines }
    //   · actualizar alreadyMovedQty acumulado
    //   · si todas las líneas quedan completas, sincronizar estado con la orden padre (DELIVERED/PARTIAL)
    if (d.status === "CANCELLED") {
      toast.error("No se puede confirmar una entrega cancelada.");
      return;
    }
    if (d.lines.length === 0 || d.lines.every((l) => l.movingQty <= 0)) {
      toast.error("No hay cantidades a entregar en este remito.");
      return;
    }
    const newStatus = deriveAggregateStatus(d.lines);
    setDeliveries((prev) => prev.map((x) => (x.id === d.id ? { ...x, status: newStatus } : x)));
    toast.success(`Entrega ${d.number} confirmada — impacto de stock próximamente`);
  }

  // ── Row actions ──────────────────────────────────────────────────────────
  function rowActions(d: Delivery): TPActionsMenuItem[] {
    return [
      {
        label: "Ver entrega",
        icon: <Eye size={14} />,
        onClick: () => toast.info(`Ver remito ${d.number} — próximamente`),
      },
      {
        label: "Editar",
        icon: <Pencil size={14} />,
        onClick: () => toast.info(`Editar ${d.number} — próximamente`),
      },
      { type: "separator" },
      {
        label: "Confirmar entrega",
        icon: <CheckCheck size={14} />,
        onClick: () => confirmDelivery(d),
      },
      {
        label: "Ver movimientos",
        icon: <History size={14} />,
        // TODO (Fase 6): navegar a /inventario/movimientos-articulos filtrando por ref=remito.
        onClick: () => toast.info(`Movimientos de ${d.number} — próximamente`),
      },
      {
        label: "Cancelar",
        icon: <X size={14} />,
        onClick: () => toast.info(`Cancelar ${d.number} — próximamente`),
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
    r: Delivery,
    vis: Record<string, boolean>,
    _sel?: unknown,
    orderedKeys?: string[],
  ) {
    const cells: Record<string, React.ReactNode> = {
      number: <TPTd className="font-mono text-xs font-semibold text-text">{r.number}</TPTd>,
      date:   <TPTd className="text-sm text-text/80">{fmtDate(r.date)}</TPTd>,
      client: (
        <TPTd className="text-sm text-text truncate">
          {r.client || <span className="text-muted">Sin cliente</span>}
        </TPTd>
      ),
      order: (
        <TPTd className="font-mono text-xs text-muted">
          {r.salesOrderNumber || <span className="text-muted/60">—</span>}
        </TPTd>
      ),
      items:   <TPTd className="text-right tabular-nums">{fmtQty(deliveredItemsCount(r))}</TPTd>,
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
          value={clientFilter}
          onChange={setClientFilter}
          options={clientOptions}
        />
      </div>
    </div>
  );

  return (
    <TPSectionShell
      title="Entregas"
      subtitle="Salida de mercadería a clientes"
      right={
        <TPButton variant="primary" onClick={openNew} iconLeft={<Plus size={14} />}>
          Nueva entrega
        </TPButton>
      }
    >
      <div className="space-y-4">
        <TPKpiBar items={kpis} columns={5} />

        <TPTableKit<Delivery>
          rows={filtered}
          columns={COLS}
          storageKey="tp_sales_deliveries_cols"
          search={{
            value: q,
            onChange: setQ,
            placeholder: "Buscar por número, cliente u orden…",
            debounceMs: 150,
          }}
          sortPersistKey="tp_sales_deliveries"
          columnPicker
          headerLeft={filters}
          countLabel={(n) => `${n} ${n === 1 ? "entrega" : "entregas"}`}
          emptyText={
            q || statusFilter !== "ALL" || clientFilter !== "ALL"
              ? "Sin resultados con los filtros aplicados."
              : "Todavía no hay entregas. Creá la primera desde «Nueva entrega»."
          }
          renderRow={renderRow}
        />
      </div>

      {draft && (
        <DeliveryEditorModal
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
// Modal editor
// ─────────────────────────────────────────────────────────────────────────────

function DeliveryEditorModal(props: {
  open: boolean;
  draft: Delivery;
  isNew: boolean;
  onChange: (next: Delivery) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const { open, draft, isNew, onChange, onSave, onClose } = props;

  function patch<K extends keyof Delivery>(key: K, value: Delivery[K]) {
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
      title={isNew ? "Nueva entrega" : `Editar entrega ${draft.number}`}
      subtitle={`Número ${draft.number}`}
      maxWidth="3xl"
      resizable
      maximizable
      maximizedMode="embedded"
      modalKey="ventas-entregas-editor"
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
            <TPField label="Cliente" required>
              <TPInput
                value={draft.client}
                onChange={(v: string) => patch("client", v)}
                placeholder="Nombre del cliente"
              />
            </TPField>

            <TPField label="Orden de venta" hint="Opcional — número de OV asociada">
              <TPInput
                value={draft.salesOrderNumber}
                onChange={(v: string) => patch("salesOrderNumber", v.toUpperCase())}
                placeholder="OV-0001"
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
                placeholder="Notas internas (transporte, receptor, etc.)"
              />
            </TPField>
          </div>
        </TPCard>

        <TPCard
          title="Líneas a entregar"
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
              Sin líneas. Agregá artículos para registrar qué se está entregando.
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

