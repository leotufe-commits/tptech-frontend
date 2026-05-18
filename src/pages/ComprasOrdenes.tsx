// src/pages/ComprasOrdenes.tsx
// ============================================================================
// Órdenes de compra — vista consultiva + creación simple.
//
// Estado local (useState): la pantalla es 100% frontend hoy, sin backend.
// Queda preparada para enchufarse cuando Fase 6 defina el módulo Compras
// en profundidad (recepción, impacto en stock, facturación, pagos).
//
// Aplica los estándares actuales del sistema:
//   · TPSectionShell + TPKpiBar + TPTableKit v2
//   · Modal + TPCard + TPField + TPInput/TPNumberInput/TPSelect
//   · Mismo look & feel que Stock por depósito y Reposición.
// ============================================================================

import React, { useMemo, useState } from "react";
import {
  ShoppingBag,
  FileText,
  Send,
  PackageCheck,
  CheckCircle2,
  Plus,
  Eye,
  Copy,
  Pencil,
  X,
  Trash2,
} from "lucide-react";

import { TPSectionShell } from "../components/ui/TPSectionShell";
import { TPKpiBar, type TPKpiItem } from "../components/ui/TPKpiBar";
import { TPTableKit, type TPColDef } from "../components/ui/TPTableKit";
import { TPTr, TPTd } from "../components/ui/TPTable";
import { TPButton } from "../components/ui/TPButton";
import { TPIconButton } from "../components/ui/TPIconButton";
import { TPActionsMenu, type TPActionsMenuItem } from "../components/ui/TPActionsMenu";
import { TPCard } from "../components/ui/TPCard";
import { TPField } from "../components/ui/TPField";
import TPInput from "../components/ui/TPInput";
import TPNumberInput from "../components/ui/TPNumberInput";
import TPSelect from "../components/ui/TPSelect";
import { Modal } from "../components/ui/Modal";
import { TPDocumentModalFooter } from "../components/ui/TPDocumentModalFooter";
import { TPProgressCell } from "../components/ui/TPProgressCell";
import { TPBalanceCell } from "../components/ui/TPBalanceCell";
import {
  TPDualStatusBadge,
  type TPDualStatusBadgeEntry,
} from "../components/ui/TPDualStatusBadge";
import {
  TPRowExpanded,
  TPRowExpandToggle,
} from "../components/ui/TPRowExpanded";
import {
  TPDocumentTimeline,
  type TPDocumentTimelineItem,
} from "../components/ui/TPDocumentTimeline";

import { toast } from "../lib/toast";
import {
  uid,
  todayISO,
  fmtDate,
  nextDocNumber,
} from "../lib/document-helpers";
// Dinero config-aware (región del tenant), misma semántica que el fmtMoney
// de document-helpers. Solo cambia el import; cero churn de call-sites.
import { formatMoneyDoc as fmtMoney } from "../lib/pricing/format";
import {
  type DocumentShipping,
  type DocumentDiscountGlobal,
  PRICE_LIST_MOCK_OPTIONS,
  SHIPPING_METHOD_MOCK_OPTIONS,
  CURRENCY_MOCK_OPTIONS,
  isBaseCurrency,
} from "../lib/document-types";
import { TPEntitySearchSelect } from "../components/ui/TPEntitySearchSelect";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos locales
// ─────────────────────────────────────────────────────────────────────────────

type POStatus = "DRAFT" | "SENT" | "PARTIAL" | "CLOSED" | "CANCELLED";

type POLine = {
  id: string;
  article: string;   // texto libre por ahora — se conectará a artículos reales luego
  quantity: number;
};

type PurchaseOrder = {
  id: string;
  number: string;    // "OC-0001"
  supplier: string;
  date: string;      // ISO yyyy-mm-dd
  currency: string;  // "ARS" | "USD" | texto libre
  /** Cotización a moneda base. Default 1. Editable solo si currency ≠ base. */
  fxRate: number;
  notes: string;
  lines: POLine[];
  status: POStatus;

  // ── Campos mock de avance (Fase 7: vendrán agregados del backend) ────────
  /** Monto total de la orden (mock — hoy sin precios por línea). Default 0. */
  totalAmount: number;
  /** Suma de cantidades ya recibidas en recepciones derivadas. Mock = 0. */
  receivedQtyTotal: number;
  /** Suma de cantidades ya facturadas en FP derivadas. Mock = 0. */
  invoicedQtyTotal: number;
  /** Monto ya facturado (suma de facturas proveedor derivadas). Mock = 0. */
  invoicedAmount: number;

  // ── Estructura doc-level agregada en esta fase ─────────────────────────
  /**
   * Lista de precios aplicada. Mock; Fase 7 tomará el id real. En
   * ComprasOrdenes hoy no hay precio por línea, pero se guarda igualmente
   * para poder heredarlo cuando el draft derive en Recepción/Factura.
   */
  priceListId?: string;
  /**
   * Datos de envío — no se modela como línea. Hoy no impacta totalAmount
   * porque ComprasOrdenes no calcula total real; el dato queda guardado
   * en el draft para futuras derivaciones.
   */
  shipping?: DocumentShipping;
  /**
   * Descuento global. Igual que shipping: se guarda en el draft pero
   * hoy no impacta totalAmount (que sigue siendo mock manual).
   */
  discountGlobal?: DocumentDiscountGlobal;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function itemsCount(order: PurchaseOrder): number {
  return order.lines.reduce((s, l) => s + (Number.isFinite(l.quantity) ? l.quantity : 0), 0);
}

// ── Derivación de estado dual (recepción + facturación) ────────────────────
//
// En Fase 7 el backend devolverá `receivedQtyTotal` / `invoicedQtyTotal` reales
// y esta lógica queda igual.

function deriveReceptionEntry(received: number, ordered: number): TPDualStatusBadgeEntry {
  if (ordered <= 0)          return { status: "DRAFT",     label: "Sin ítems",   tone: "neutral" };
  if (received <= 0)         return { status: "DRAFT",     label: "No recibida", tone: "neutral" };
  if (received >= ordered)   return { status: "DELIVERED", label: "Recibida",    tone: "success" };
  return                            { status: "PARTIAL",   label: "Parcial",     tone: "warning" };
}

function deriveInvoicingEntry(invoiced: number, ordered: number): TPDualStatusBadgeEntry {
  if (ordered <= 0)          return { status: "DRAFT",    label: "Sin ítems",    tone: "neutral" };
  if (invoiced <= 0)         return { status: "DRAFT",    label: "No facturada", tone: "neutral" };
  if (invoiced >= ordered)   return { status: "PAID",     label: "Facturada",    tone: "success" };
  return                            { status: "PARTIAL",  label: "Parcial",      tone: "warning" };
}

// ── Mock de documentos derivados ────────────────────────────────────────────
//
// Placeholder visual: 1 recepción (REC) si hubo recepción parcial/total, y/o
// 1 factura proveedor (FP) si hubo monto facturado. Fase 7 reemplaza con
// documentos reales agregados a la OC por el backend.

function mockDerivedDocuments(o: PurchaseOrder): TPDocumentTimelineItem[] {
  const items: TPDocumentTimelineItem[] = [];
  const orderedQty = itemsCount(o);

  if (o.receivedQtyTotal > 0) {
    const isComplete = o.receivedQtyTotal >= orderedQty && orderedQty > 0;
    items.push({
      id: `${o.id}-rec-1`,
      type: "REC",
      number: "REC-0001",
      date: o.date,
      quantity: o.receivedQtyTotal,
      status: "CONFIRMED",
      statusLabel: isComplete ? "Confirmada" : "Parcial",
      statusTone: isComplete ? "success" : "warning",
    });
  }

  if (o.invoicedAmount > 0) {
    const isComplete = o.invoicedAmount >= o.totalAmount && o.totalAmount > 0;
    items.push({
      id: `${o.id}-fp-1`,
      type: "FP",
      number: "FP-0001",
      date: o.date,
      amount: o.invoicedAmount,
      currency: o.currency,
      status: isComplete ? "PAID" : "PARTIAL",
      statusLabel: isComplete ? "Facturada" : "Parcial",
      statusTone: isComplete ? "success" : "warning",
    });
  }

  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// Columnas
// ─────────────────────────────────────────────────────────────────────────────

const COLS: TPColDef[] = [
  { key: "expander",  label: "",            width: "32px",  canHide: false },
  { key: "number",    label: "Número",      width: "120px", sortKey: "number" },
  { key: "date",      label: "Fecha",       width: "110px", sortKey: "date" },
  { key: "supplier",  label: "Proveedor",                   sortKey: "supplier" },
  { key: "reception", label: "Recepción",   width: "150px" },
  { key: "invoicing", label: "Facturación", width: "150px" },
  { key: "total",     label: "Total",       width: "130px", align: "right", sortKey: "total" },
  { key: "invoiced",  label: "Facturado",   width: "130px", align: "right" },
  { key: "balance",   label: "Saldo",       width: "130px", align: "right" },
  { key: "status",    label: "Estado",      width: "200px" },
  { key: "actions",   label: "",            width: "48px",  canHide: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// Pantalla
// ─────────────────────────────────────────────────────────────────────────────

type StatusFilter = "ALL" | POStatus;

export default function ComprasOrdenes() {
  const [orders, setOrders]     = useState<PurchaseOrder[]>([]);
  const [q, setQ]               = useState("");
  const [statusFilter, setStatusFilter]     = useState<StatusFilter>("ALL");
  const [supplierFilter, setSupplierFilter] = useState<string>("ALL");

  // Modal de creación / edición
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft]           = useState<PurchaseOrder | null>(null);
  const [isNew, setIsNew]           = useState(true);

  // Ids de filas expandidas (detalle con documentos derivados).
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ── KPIs (todas las órdenes, no las filtradas) ───────────────────────────
  const kpis: TPKpiItem[] = useMemo(() => {
    const total   = orders.length;
    const drafts  = orders.filter((o) => o.status === "DRAFT").length;
    const sent    = orders.filter((o) => o.status === "SENT").length;
    const partial = orders.filter((o) => o.status === "PARTIAL").length;
    const closed  = orders.filter((o) => o.status === "CLOSED").length;

    return [
      { id: "total",   label: "Total órdenes",      value: total,   hint: "Excluye canceladas por defecto", tone: total > 0 ? "primary" : "neutral",   icon: <ShoppingBag size={12} /> },
      { id: "drafts",  label: "Borradores",         value: drafts,  hint: "En preparación",                 tone: drafts > 0 ? "neutral" : "neutral",  icon: <FileText size={12} /> },
      { id: "sent",    label: "Enviadas",           value: sent,    hint: "Esperando recepción",            tone: sent > 0 ? "info" : "neutral",       icon: <Send size={12} /> },
      { id: "partial", label: "Recibidas parcial.", value: partial, hint: "Recepción incompleta",           tone: partial > 0 ? "warning" : "neutral", icon: <PackageCheck size={12} /> },
      { id: "closed",  label: "Cerradas",           value: closed,  hint: "Recibidas 100%",                 tone: closed > 0 ? "success" : "neutral",  icon: <CheckCircle2 size={12} /> },
    ];
  }, [orders]);

  // ── Filtrado client-side ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
      if (supplierFilter !== "ALL" && o.supplier !== supplierFilter) return false;
      if (!term) return true;
      return `${o.number} ${o.supplier}`.toLowerCase().includes(term);
    });
  }, [orders, q, statusFilter, supplierFilter]);

  // ── Opciones de filtros ──────────────────────────────────────────────────
  const supplierOptions = useMemo(() => {
    const uniq = Array.from(new Set(orders.map((o) => o.supplier).filter(Boolean))).sort();
    return [
      { value: "ALL", label: "Todos los proveedores" },
      ...uniq.map((s) => ({ value: s, label: s })),
    ];
  }, [orders]);

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "ALL",       label: "Todos los estados" },
    { value: "DRAFT",     label: "Borrador" },
    { value: "SENT",      label: "Enviada" },
    { value: "PARTIAL",   label: "Parcial" },
    { value: "CLOSED",    label: "Cerrada" },
    { value: "CANCELLED", label: "Cancelada" },
  ];

  // ── Acciones sobre órdenes (locales) ─────────────────────────────────────
  function openNew() {
    const blank: PurchaseOrder = {
      id:               uid(),
      number:           nextDocNumber("OC", orders),
      supplier:         "",
      date:             todayISO(),
      currency:         "ARS",
      fxRate:           1,
      notes:            "",
      lines:            [],
      status:           "DRAFT",
      totalAmount:      0,
      receivedQtyTotal: 0,
      invoicedQtyTotal: 0,
      invoicedAmount:   0,
      priceListId:      "retail",
      shipping:         { methodId: "pickup", cost: 0, address: "", carrier: "" },
      discountGlobal:   { type: "PERCENT", value: 0, reason: "" },
    };
    setDraft(blank);
    setIsNew(true);
    setEditorOpen(true);
  }

  function duplicate(order: PurchaseOrder) {
    const copy: PurchaseOrder = {
      ...order,
      id:               uid(),
      number:           nextDocNumber("OC", orders),
      date:             todayISO(),
      status:           "DRAFT",
      lines:            order.lines.map((l) => ({ ...l, id: uid() })),
      // El duplicado arranca sin avance; totalAmount se preserva como estimación.
      receivedQtyTotal: 0,
      invoicedQtyTotal: 0,
      invoicedAmount:   0,
    };
    setOrders((prev) => [...prev, copy]);
    toast.success(`Orden duplicada como ${copy.number}`);
  }

  function saveDraft() {
    if (!draft) return;
    if (!draft.supplier.trim()) {
      toast.error("El proveedor es obligatorio.");
      return;
    }
    setOrders((prev) => {
      const exists = prev.some((o) => o.id === draft.id);
      return exists ? prev.map((o) => (o.id === draft.id ? draft : o)) : [...prev, draft];
    });
    toast.success(isNew ? `Orden ${draft.number} creada` : `Orden ${draft.number} actualizada`);
    setEditorOpen(false);
    setDraft(null);
  }

  // ── Row actions ──────────────────────────────────────────────────────────
  function rowActions(o: PurchaseOrder): TPActionsMenuItem[] {
    return [
      {
        label: "Ver orden",
        icon: <Eye size={14} />,
        onClick: () => toast.info(`Ver orden ${o.number} — próximamente`),
      },
      {
        label: "Editar",
        icon: <Pencil size={14} />,
        onClick: () => toast.info(`Editar orden ${o.number} — próximamente`),
      },
      {
        label: "Duplicar",
        icon: <Copy size={14} />,
        onClick: () => duplicate(o),
      },
      { type: "separator" },
      {
        label: "Cancelar",
        icon: <X size={14} />,
        onClick: () => toast.info(`Cancelar orden ${o.number} — próximamente`),
      },
    ];
  }

  // ── Render row ───────────────────────────────────────────────────────────
  function renderRow(
    o: PurchaseOrder,
    vis: Record<string, boolean>,
    _sel?: unknown,
    orderedKeys?: string[],
  ) {
    const orderedQty = itemsCount(o);
    const balance    = o.totalAmount - o.invoicedAmount;
    const isExpanded = expandedIds.has(o.id);

    const cells: Record<string, React.ReactNode> = {
      expander: (
        <TPTd className="px-1">
          <TPRowExpandToggle
            isExpanded={isExpanded}
            onToggle={() => toggleExpanded(o.id)}
            title={isExpanded ? "Ocultar detalle" : "Ver detalle"}
          />
        </TPTd>
      ),
      number: (
        <TPTd className="font-mono text-xs font-semibold text-text">{o.number}</TPTd>
      ),
      date: (
        <TPTd className="text-sm text-text/80">{fmtDate(o.date)}</TPTd>
      ),
      supplier: (
        <TPTd className="text-sm text-text truncate">
          {o.supplier || <span className="text-muted">Sin proveedor</span>}
        </TPTd>
      ),
      reception: (
        <TPTd>
          <TPProgressCell value={o.receivedQtyTotal} total={orderedQty} />
        </TPTd>
      ),
      invoicing: (
        <TPTd>
          <TPProgressCell value={o.invoicedQtyTotal} total={orderedQty} />
        </TPTd>
      ),
      total: (
        <TPTd className="text-right tabular-nums">
          {o.totalAmount > 0
            ? <span className="font-semibold text-text">{fmtMoney(o.totalAmount, o.currency)}</span>
            : <span className="text-muted">—</span>}
        </TPTd>
      ),
      invoiced: (
        <TPTd className="text-right tabular-nums">
          {o.invoicedAmount > 0
            ? <span className="font-semibold text-text">{fmtMoney(o.invoicedAmount, o.currency)}</span>
            : <span className="text-muted">—</span>}
        </TPTd>
      ),
      balance: (
        <TPTd className="text-right">
          <TPBalanceCell value={balance} currency={o.currency} />
        </TPTd>
      ),
      status: (
        <TPTd>
          <TPDualStatusBadge
            orientation="stacked"
            size="sm"
            primary={deriveReceptionEntry(o.receivedQtyTotal, orderedQty)}
            secondary={deriveInvoicingEntry(o.invoicedQtyTotal, orderedQty)}
          />
        </TPTd>
      ),
      actions: (
        <TPTd className="text-right px-2" data-tp-actions>
          <TPActionsMenu items={rowActions(o)} title="Acciones" />
        </TPTd>
      ),
    };

    const keys = orderedKeys && orderedKeys.length > 0
      ? orderedKeys
      : COLS.filter((c) => vis[c.key] !== false).map((c) => c.key);

    return (
      <React.Fragment key={o.id}>
        <TPTr>
          {keys.map((k) => (
            <React.Fragment key={k}>{cells[k]}</React.Fragment>
          ))}
        </TPTr>
        <TPRowExpanded isExpanded={isExpanded} colSpan={keys.length}>
          <TPDocumentTimeline
            title="Documentos derivados"
            items={mockDerivedDocuments(o)}
            emptyText="Todavía no se generaron recepciones ni facturas para esta orden."
          />
        </TPRowExpanded>
      </React.Fragment>
    );
  }

  // ── Filtros (headerLeft de TPTableKit) ───────────────────────────────────
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
      title="Órdenes de compra"
      subtitle="Pedidos a proveedores"
      right={
        <TPButton variant="primary" onClick={openNew} iconLeft={<Plus size={14} />}>
          Nueva orden
        </TPButton>
      }
    >
      <div className="space-y-4">
        <TPKpiBar items={kpis} columns={5} />

        <TPTableKit<PurchaseOrder>
          rows={filtered}
          columns={COLS}
          storageKey="tp_purchase_orders_cols"
          search={{
            value: q,
            onChange: setQ,
            placeholder: "Buscar por número o proveedor…",
            debounceMs: 150,
          }}
          sortPersistKey="tp_purchase_orders"
          columnPicker
          headerLeft={filters}
          countLabel={(n) => `${n} ${n === 1 ? "orden" : "órdenes"}`}
          emptyText={
            q || statusFilter !== "ALL" || supplierFilter !== "ALL"
              ? "Sin resultados con los filtros aplicados."
              : "Todavía no hay órdenes de compra. Creá la primera desde «Nueva orden»."
          }
          renderRow={renderRow}
        />
      </div>

      {draft && (
        <OrderEditorModal
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
// Modal de editor (simple)
// ─────────────────────────────────────────────────────────────────────────────

function OrderEditorModal(props: {
  open: boolean;
  draft: PurchaseOrder;
  isNew: boolean;
  onChange: (next: PurchaseOrder) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const { open, draft, isNew, onChange, onSave, onClose } = props;

  function patch<K extends keyof PurchaseOrder>(key: K, value: PurchaseOrder[K]) {
    onChange({ ...draft, [key]: value });
  }

  function patchShipping(p: Partial<DocumentShipping>) {
    const nextShipping: DocumentShipping = { ...(draft.shipping ?? {}), ...p };
    patch("shipping", nextShipping);
  }

  function patchDiscountGlobal(p: Partial<DocumentDiscountGlobal>) {
    const current = draft.discountGlobal ?? { type: "PERCENT" as const, value: 0 };
    const nextDiscount: DocumentDiscountGlobal = { ...current, ...p };
    patch("discountGlobal", nextDiscount);
  }

  function addLine() {
    onChange({
      ...draft,
      lines: [...draft.lines, { id: uid(), article: "", quantity: 1 }],
    });
  }

  function patchLine(lineId: string, patchObj: Partial<POLine>) {
    onChange({
      ...draft,
      lines: draft.lines.map((l) => (l.id === lineId ? { ...l, ...patchObj } : l)),
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
      title={isNew ? "Nueva orden de compra" : `Editar orden ${draft.number}`}
      subtitle={`Número ${draft.number}`}
      maxWidth="7xl"
      className="!max-w-[1500px] w-[96vw]"
      resizable
      maximizable
      maximizedMode="embedded"
      modalKey="compras-ordenes-editor"
      onEnter={onSave}
      footer={
        <TPDocumentModalFooter
          isNew={isNew}
          onCancel={onClose}
          onSave={onSave}
          summary={
            <div className="text-xs text-muted">
              Total estimado: <span className="font-bold text-primary">{fmtMoney(draft.totalAmount, draft.currency)}</span>
            </div>
          }
        />
      }
    >
      <div className="space-y-3">
        {/* ── Header compacto: proveedor + fecha + moneda + cotización + lista ── */}
        <TPCard
          title="Datos de la orden"
          bodyClassName="!p-3"
          headerClassName="!py-2"
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <TPField label="Proveedor" required className="col-span-2 sm:col-span-3 lg:col-span-2">
              <TPEntitySearchSelect
                type="supplier"
                value={draft.supplier ? { id: draft.supplier, name: draft.supplier } : null}
                onChange={(e) => patch("supplier", e?.name ?? "")}
                onCreateNew={() => toast.info("Crear proveedor — próximamente")}
                onViewDetail={(e) => toast.info(`Ver ficha de ${e.name} — próximamente`)}
              />
            </TPField>
            <TPField label="Fecha">
              <input
                type="date"
                value={draft.date}
                onChange={(e) => patch("date", e.target.value)}
                className="tp-input w-full"
              />
            </TPField>
            <TPField label="Moneda" required>
              <TPSelect
                value={draft.currency || "ARS"}
                onChange={(v) => {
                  if (isBaseCurrency(v)) {
                    onChange({ ...draft, currency: v, fxRate: 1 });
                  } else {
                    patch("currency", v);
                  }
                }}
                options={CURRENCY_MOCK_OPTIONS.map((c) => ({ value: c.id, label: c.label }))}
              />
            </TPField>
            <TPField label="Cotización" hint={isBaseCurrency(draft.currency) ? "Fija en 1 (moneda base)" : "A moneda base del tenant"}>
              <TPNumberInput
                value={draft.fxRate}
                onChange={(v) => patch("fxRate", v ?? 1)}
                decimals={4}
                disabled={isBaseCurrency(draft.currency)}
              />
            </TPField>
            <TPField label="Lista">
              <TPSelect
                value={draft.priceListId ?? ""}
                onChange={(v) => patch("priceListId", v || undefined)}
                options={PRICE_LIST_MOCK_OPTIONS.map((p) => ({ value: p.id, label: p.label }))}
              />
            </TPField>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <TPField label="Observaciones" className="col-span-2 sm:col-span-3 lg:col-span-6">
              <TPInput
                value={draft.notes}
                onChange={(v) => patch("notes", v)}
                placeholder="Notas internas para esta orden"
              />
            </TPField>
          </div>
        </TPCard>

        {/* ── 2-col: izquierda líneas · derecha resumen sticky ── */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr]">
          {/* ── Columna izquierda: Líneas ── */}
          <TPCard
            title="Líneas"
            bodyClassName="!p-3"
            headerClassName="!py-2"
            right={
              <TPButton
                variant="secondary"
                onClick={addLine}
                iconLeft={<Plus size={14} />}
                className="h-7 text-xs"
              >
                Línea vacía
              </TPButton>
            }
          >
            {draft.lines.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-surface2/20 px-4 py-8 text-center">
                <FileText size={24} className="mx-auto text-muted" />
                <div className="mt-2 text-sm font-semibold text-text">
                  Todavía no hay líneas
                </div>
                <div className="mt-1 text-xs text-muted">
                  Presioná «Línea vacía» para agregar un artículo a la orden.
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_120px_32px] gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                  <div>Artículo</div>
                  <div className="text-right">Cantidad</div>
                  <div />
                </div>
                {draft.lines.map((l) => (
                  <div
                    key={l.id}
                    className="grid grid-cols-[1fr_120px_32px] items-center gap-2"
                  >
                    <TPInput
                      value={l.article}
                      onChange={(v) => patchLine(l.id, { article: v })}
                      placeholder="Artículo / descripción"
                    />
                    <TPNumberInput
                      value={l.quantity}
                      onChange={(v) => patchLine(l.id, { quantity: v ?? 0 })}
                      decimals={2}
                      min={0}
                    />
                    <TPIconButton
                      onClick={() => removeLine(l.id)}
                      className="h-8 w-8 hover:text-red-400 hover:border-red-400/40"
                      title="Eliminar línea"
                    >
                      <Trash2 size={14} />
                    </TPIconButton>
                  </div>
                ))}
              </div>
            )}
          </TPCard>

          {/* ── Columna derecha: resumen sticky ── */}
          <aside className="space-y-3 lg:sticky lg:top-2 lg:self-start">
            {/* Hero Total */}
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Total de la orden
              </div>
              <div className="mt-0.5 text-2xl font-bold tabular-nums text-primary">
                {fmtMoney(draft.totalAmount, draft.currency)}
              </div>
              <div className="mt-2 space-y-0.5 border-t border-border/60 pt-2 text-[11px] text-muted">
                <div className="flex justify-between">
                  <span>Ítems</span>
                  <span className="tabular-nums font-semibold text-text">{itemsCount(draft)}</span>
                </div>
                {(draft.shipping?.cost ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span>Envío</span>
                    <span className="tabular-nums font-semibold text-text">{fmtMoney(draft.shipping?.cost ?? 0, draft.currency)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Descuento global (compact) */}
            <TPCard
              title="Descuento global"
              bodyClassName="!p-3"
              headerClassName="!py-2"
            >
              <div className="grid grid-cols-2 gap-2">
                <TPField label="Tipo">
                  <TPSelect
                    value={draft.discountGlobal?.type ?? "PERCENT"}
                    onChange={(v) => patchDiscountGlobal({ type: (v as "PERCENT" | "AMOUNT") })}
                    options={[
                      { value: "PERCENT", label: "%" },
                      { value: "AMOUNT",  label: "$" },
                    ]}
                  />
                </TPField>
                <TPField label="Valor">
                  <TPNumberInput
                    value={draft.discountGlobal?.value ?? 0}
                    onChange={(v) => patchDiscountGlobal({ value: v ?? 0 })}
                    decimals={2}
                    min={0}
                    max={draft.discountGlobal?.type === "PERCENT" ? 100 : undefined}
                  />
                </TPField>
                <TPField label="Motivo" className="col-span-2">
                  <TPInput
                    value={draft.discountGlobal?.reason ?? ""}
                    onChange={(v: string) => patchDiscountGlobal({ reason: v })}
                    placeholder="Bonificación, ajuste, etc."
                  />
                </TPField>
              </div>
            </TPCard>

            {/* Envío (compact, movido del header) */}
            <TPCard
              title="Envío"
              bodyClassName="!p-3"
              headerClassName="!py-2"
            >
              <div className="grid grid-cols-2 gap-2">
                <TPField label="Método">
                  <TPSelect
                    value={draft.shipping?.methodId ?? ""}
                    onChange={(v) => patchShipping({ methodId: v || undefined })}
                    options={SHIPPING_METHOD_MOCK_OPTIONS.map((m) => ({ value: m.id, label: m.label }))}
                  />
                </TPField>
                <TPField label="Costo">
                  <TPNumberInput
                    value={draft.shipping?.cost ?? 0}
                    onChange={(v) => patchShipping({ cost: v ?? 0 })}
                    decimals={2}
                    min={0}
                  />
                </TPField>
                <TPField label="Dirección" className="col-span-2">
                  <TPInput
                    value={draft.shipping?.address ?? ""}
                    onChange={(v: string) => patchShipping({ address: v })}
                    placeholder="Calle, número, ciudad"
                  />
                </TPField>
                <TPField label="Transporte" className="col-span-2">
                  <TPInput
                    value={draft.shipping?.carrier ?? ""}
                    onChange={(v: string) => patchShipping({ carrier: v })}
                    placeholder="Responsable / transportista"
                  />
                </TPField>
              </div>
            </TPCard>
          </aside>
        </div>
      </div>
    </Modal>
  );
}
