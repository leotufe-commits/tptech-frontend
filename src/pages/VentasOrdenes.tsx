// src/pages/VentasOrdenes.tsx
// ============================================================================
// Órdenes de venta — pedidos confirmados de clientes.
//
// Estado 100% local (useState). Sin backend, sin impacto en stock, sin deuda.
//
// Reusa la estructura de VentasPresupuestos (mismo modal de 3 cards, mismo
// cálculo de subtotales en vivo, mismos helpers de total/grid). La diferencia
// conceptual: una orden es un COMPROMISO confirmado → habilita flujos de
// entrega y facturación. Por ahora esas acciones son placeholders.
//
// Flujo conceptual:
//   Presupuesto → Orden de venta → Entrega → Factura de cliente → Cobro
// ============================================================================

import React, { useMemo, useState } from "react";
import {
  ShoppingCart,
  Clock,
  PackageCheck,
  Truck,
  CheckCircle2,
  Plus,
  Eye,
  Pencil,
  CheckCheck,
  Send,
  Receipt,
  FileText,
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
import { TPDocumentLineAdvancedEditor } from "../components/ui/TPDocumentLineAdvancedEditor";
import {
  TPArticleVariantSearchSelect,
  type TPArticleLite,
} from "../components/ui/TPArticleVariantSearchSelect";
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
  round2,
  fmtDate,
  fmtMoney,
  nextDocNumber,
} from "../lib/document-helpers";
import {
  type DocumentLine,
  type DocumentShipping,
  type DocumentDiscountGlobal,
  PRICE_LIST_MOCK_OPTIONS,
  SHIPPING_METHOD_MOCK_OPTIONS,
  CURRENCY_MOCK_OPTIONS,
  isBaseCurrency,
} from "../lib/document-types";
import { TPEntitySearchSelect } from "../components/ui/TPEntitySearchSelect";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

type SalesOrderStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "PARTIAL"
  | "DELIVERED"
  | "CLOSED";

type SalesOrder = {
  id: string;
  number: string;           // "OV-0001"
  date: string;             // ISO
  client: string;
  seller: string;
  currency: string;
  /** Cotización a moneda base. Default 1. Editable solo si currency ≠ base. */
  fxRate: number;
  /** IVA % placeholder — se reemplazará por pricing-engine en Fase 6 */
  taxPercent: number;
  notes: string;

  // Totales calculados
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;

  lines: DocumentLine[];
  status: SalesOrderStatus;

  // ── Campos mock de avance (Fase 7: vendrán agregados del backend) ────────
  /** Suma de cantidades ya entregadas en remitos derivados. Mock = 0. */
  deliveredQtyTotal: number;
  /** Suma de cantidades ya facturadas en FV derivadas. Mock = 0. */
  invoicedQtyTotal: number;
  /** Monto ya facturado (suma de facturas derivadas). Mock = 0. */
  invoicedAmount: number;

  // ── Estructura doc-level agregada en esta fase ─────────────────────────
  /** Lista de precios aplicada. Mock; Fase 7 tomará el id real. */
  priceListId?: string;
  /** Datos de envío — no se modela como línea. */
  shipping?: DocumentShipping;
  /** Descuento global aplicado sobre el subtotal. */
  discountGlobal?: DocumentDiscountGlobal;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function calcLineSubtotal(l: Pick<DocumentLine, "quantity" | "unitPrice" | "discountAmount">): number {
  const qty   = Number.isFinite(l.quantity) ? l.quantity : 0;
  const price = Number.isFinite(l.unitPrice) ? l.unitPrice : 0;
  const disc  = Number.isFinite(l.discountAmount) ? l.discountAmount : 0;
  return Math.max(0, qty * price - disc);
}

/**
 * Calcula el monto de descuento global en la moneda del documento.
 * PERCENT → `value` % del subtotal. AMOUNT → `value` directo.
 */
function computeGlobalDiscount(subtotal: number, d?: DocumentDiscountGlobal): number {
  if (!d || !Number.isFinite(d.value) || d.value <= 0) return 0;
  if (d.type === "PERCENT") return Math.max(0, (subtotal * d.value) / 100);
  return Math.max(0, d.value);
}

function recomputeTotals(
  lines: DocumentLine[],
  taxPercent: number,
  discountGlobal?: DocumentDiscountGlobal,
  shipping?: DocumentShipping,
): Pick<SalesOrder, "subtotal" | "discountAmount" | "taxAmount" | "total"> {
  let subtotal = 0;
  let lineDiscount = 0;
  for (const l of lines) {
    subtotal     += l.subtotal;
    lineDiscount += l.discountAmount || 0;
  }
  const globalDiscount = computeGlobalDiscount(subtotal, discountGlobal);
  const netSubtotal    = Math.max(0, subtotal - globalDiscount);
  const taxRate        = Number.isFinite(taxPercent) && taxPercent >= 0 ? taxPercent : 0;
  const taxAmount      = netSubtotal * (taxRate / 100);
  const shippingCost   = Number.isFinite(shipping?.cost) ? (shipping?.cost ?? 0) : 0;
  const total          = netSubtotal + taxAmount + shippingCost;

  return {
    subtotal:       round2(subtotal),
    discountAmount: round2(lineDiscount + globalDiscount),
    taxAmount:      round2(taxAmount),
    total:          round2(total),
  };
}

function itemsCount(o: SalesOrder): number {
  return o.lines.reduce((s, l) => s + (Number.isFinite(l.quantity) ? l.quantity : 0), 0);
}

// ── Derivación de estado dual (entrega + facturación) ──────────────────────
//
// Estos helpers operan sobre los mock fields del draft. En Fase 7 el backend
// devolverá `deliveredQtyTotal` / `invoicedQtyTotal` reales y esta lógica
// queda igual.

function deriveDeliveryEntry(delivered: number, ordered: number): TPDualStatusBadgeEntry {
  if (ordered <= 0)           return { status: "DRAFT",     label: "Sin ítems",    tone: "neutral" };
  if (delivered <= 0)         return { status: "DRAFT",     label: "No entregada", tone: "neutral" };
  if (delivered >= ordered)   return { status: "DELIVERED", label: "Entregada",    tone: "success" };
  return                             { status: "PARTIAL",   label: "Parcial",      tone: "warning" };
}

function deriveInvoicingEntry(invoiced: number, ordered: number): TPDualStatusBadgeEntry {
  if (ordered <= 0)           return { status: "DRAFT",    label: "Sin ítems",    tone: "neutral" };
  if (invoiced <= 0)          return { status: "DRAFT",    label: "No facturada", tone: "neutral" };
  if (invoiced >= ordered)    return { status: "PAID",     label: "Facturada",    tone: "success" };
  return                             { status: "PARTIAL",  label: "Parcial",      tone: "warning" };
}

// ── Mock de documentos derivados ────────────────────────────────────────────
//
// Placeholder visual: genera 1 remito y/o 1 factura si la orden tiene avance
// de entrega/facturación. Fase 7 reemplaza esto con documentos reales que el
// backend devuelva agregados a la OV.

function mockDerivedDocuments(o: SalesOrder): TPDocumentTimelineItem[] {
  const items: TPDocumentTimelineItem[] = [];
  const orderedQty = itemsCount(o);

  if (o.deliveredQtyTotal > 0) {
    const isComplete = o.deliveredQtyTotal >= orderedQty && orderedQty > 0;
    items.push({
      id: `${o.id}-rem-1`,
      type: "REM",
      number: "REM-0001",
      date: o.date,
      quantity: o.deliveredQtyTotal,
      status: "CONFIRMED",
      statusLabel: isComplete ? "Confirmada" : "Parcial",
      statusTone: isComplete ? "success" : "warning",
    });
  }

  if (o.invoicedAmount > 0) {
    const isComplete = o.invoicedAmount >= o.total && o.total > 0;
    items.push({
      id: `${o.id}-fv-1`,
      type: "FV",
      number: "FV-0001",
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
  { key: "number",    label: "Número",      width: "110px", sortKey: "number" },
  { key: "date",      label: "Fecha",       width: "110px", sortKey: "date" },
  { key: "client",    label: "Cliente",                     sortKey: "client" },
  { key: "delivery",  label: "Entrega",     width: "150px" },
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

type StatusFilter = "ALL" | SalesOrderStatus;

export default function VentasOrdenes() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [q, setQ]                           = useState("");
  const [statusFilter, setStatusFilter]     = useState<StatusFilter>("ALL");
  const [clientFilter, setClientFilter]     = useState<string>("ALL");

  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft]           = useState<SalesOrder | null>(null);
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

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const kpis: TPKpiItem[] = useMemo(() => {
    const total     = orders.length;
    const pending   = orders.filter((o) => o.status === "DRAFT" || o.status === "CONFIRMED").length;
    const prepared  = orders.filter((o) => o.status === "CONFIRMED").length;
    const partial   = orders.filter((o) => o.status === "PARTIAL").length;
    const closed    = orders.filter((o) => o.status === "CLOSED" || o.status === "DELIVERED").length;

    return [
      { id: "total",    label: "Total órdenes",      value: total,    hint: "Todas",                   tone: total > 0 ? "primary" : "neutral",    icon: <ShoppingCart size={12} /> },
      { id: "pending",  label: "Pendientes",         value: pending,  hint: "Borradores + confirmadas", tone: pending > 0 ? "warning" : "neutral",  icon: <Clock size={12} /> },
      { id: "prepared", label: "Preparadas",         value: prepared, hint: "Confirmadas sin entregar", tone: prepared > 0 ? "info" : "neutral",    icon: <PackageCheck size={12} /> },
      { id: "partial",  label: "Entregas parciales", value: partial,  hint: "Parcialmente entregadas",  tone: partial > 0 ? "warning" : "neutral",  icon: <Truck size={12} /> },
      { id: "closed",   label: "Cerradas",           value: closed,   hint: "Entregadas / cerradas",    tone: closed > 0 ? "success" : "neutral",   icon: <CheckCircle2 size={12} /> },
    ];
  }, [orders]);

  // ── Filtrado ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
      if (clientFilter !== "ALL" && o.client !== clientFilter) return false;
      if (!term) return true;
      return `${o.number} ${o.client}`.toLowerCase().includes(term);
    });
  }, [orders, q, statusFilter, clientFilter]);

  // ── Opciones ─────────────────────────────────────────────────────────────
  const clientOptions = useMemo(() => {
    const uniq = Array.from(new Set(orders.map((o) => o.client).filter(Boolean))).sort();
    return [
      { value: "ALL", label: "Todos los clientes" },
      ...uniq.map((c) => ({ value: c, label: c })),
    ];
  }, [orders]);

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "ALL",       label: "Todos los estados" },
    { value: "DRAFT",     label: "Borrador" },
    { value: "CONFIRMED", label: "Confirmada" },
    { value: "PARTIAL",   label: "Entrega parcial" },
    { value: "DELIVERED", label: "Entregada" },
    { value: "CLOSED",    label: "Cerrada" },
  ];

  // ── Acciones globales ────────────────────────────────────────────────────
  function openNew() {
    const blank: SalesOrder = {
      id:                uid(),
      number:            nextDocNumber("OV", orders),
      date:              todayISO(),
      client:            "",
      seller:            "",
      currency:          "ARS",
      fxRate:            1,
      taxPercent:        0,
      notes:             "",
      subtotal:          0,
      discountAmount:    0,
      taxAmount:         0,
      total:             0,
      lines:             [],
      status:            "DRAFT",
      deliveredQtyTotal: 0,
      invoicedQtyTotal:  0,
      invoicedAmount:    0,
      priceListId:       "retail",
      shipping:          { methodId: "pickup", cost: 0, address: "", carrier: "" },
      discountGlobal:    { type: "PERCENT", value: 0, reason: "" },
    };
    setDraft(blank);
    setIsNew(true);
    setEditorOpen(true);
  }

  function saveDraft() {
    if (!draft) return;

    if (!draft.client.trim())     { toast.error("El cliente es obligatorio."); return; }
    if (!draft.date)              { toast.error("La fecha es obligatoria.");   return; }
    if (!draft.currency.trim())   { toast.error("La moneda es obligatoria."); return; }
    if (draft.lines.length === 0) { toast.error("Agregá al menos una línea."); return; }

    for (const l of draft.lines) {
      if (l.quantity <= 0)      { toast.error(`La cantidad debe ser mayor a 0 (${l.article || "línea"}).`); return; }
      if (l.unitPrice < 0)      { toast.error(`El precio no puede ser negativo (${l.article || "línea"}).`); return; }
      if (l.discountAmount < 0) { toast.error(`El descuento no puede ser negativo (${l.article || "línea"}).`); return; }
    }

    const totals = recomputeTotals(draft.lines, draft.taxPercent, draft.discountGlobal, draft.shipping);
    const saved: SalesOrder = { ...draft, ...totals };

    setOrders((prev) => {
      const exists = prev.some((o) => o.id === saved.id);
      return exists ? prev.map((o) => (o.id === saved.id ? saved : o)) : [...prev, saved];
    });

    // TODO (Fase 6):
    // - confirmar pedido → crear venta vía onSaleConfirmed del pricing-engine
    //   (genera Receipt + stock movement + CurrentAccountMovement)
    // - entrega parcial → ArticleMovement OUT con sourceType=SALE por parte
    //   de las líneas; cuando todas se completan → status=DELIVERED
    // - facturar → emitir Receipt tipo INVOICE direction=OUTBOUND
    // - re-cálculos de precio → resolveFinalSalePrice del pricing-engine
    toast.success(isNew ? `Orden ${saved.number} creada` : `Orden ${saved.number} actualizada`);
    setEditorOpen(false);
    setDraft(null);
  }

  function confirmOrder(o: SalesOrder) {
    // Placeholder: solo UI. Fase 6 disparará onSaleConfirmed.
    if (o.status !== "DRAFT") {
      toast.error("Solo se pueden confirmar órdenes en borrador.");
      return;
    }
    setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, status: "CONFIRMED" } : x)));
    toast.success(`Orden ${o.number} confirmada — stock y facturación próximamente`);
  }

  // ── Row actions ──────────────────────────────────────────────────────────
  function rowActions(o: SalesOrder): TPActionsMenuItem[] {
    return [
      {
        label: "Ver",
        icon: <Eye size={14} />,
        onClick: () => toast.info(`Ver ${o.number} — próximamente`),
      },
      {
        label: "Editar",
        icon: <Pencil size={14} />,
        onClick: () => toast.info(`Editar ${o.number} — próximamente`),
      },
      { type: "separator" },
      {
        label: "Confirmar pedido",
        icon: <CheckCheck size={14} />,
        onClick: () => confirmOrder(o),
      },
      {
        label: "Generar entrega",
        icon: <Send size={14} />,
        // TODO (Fase 6): abrir modal de entrega parcial/total → ArticleMovement OUT.
        onClick: () => toast.info(`Entrega de ${o.number} — próximamente`),
      },
      {
        label: "Facturar",
        icon: <Receipt size={14} />,
        // TODO (Fase 6): emitir Receipt tipo INVOICE, direction=OUTBOUND.
        onClick: () => toast.info(`Facturar ${o.number} — próximamente`),
      },
    ];
  }

  // ── Render row ───────────────────────────────────────────────────────────
  function renderRow(
    r: SalesOrder,
    vis: Record<string, boolean>,
    _sel?: unknown,
    orderedKeys?: string[],
  ) {
    const orderedQty  = itemsCount(r);
    const balance     = r.total - r.invoicedAmount;
    const isExpanded  = expandedIds.has(r.id);

    const cells: Record<string, React.ReactNode> = {
      expander: (
        <TPTd className="px-1">
          <TPRowExpandToggle
            isExpanded={isExpanded}
            onToggle={() => toggleExpanded(r.id)}
            title={isExpanded ? "Ocultar detalle" : "Ver detalle"}
          />
        </TPTd>
      ),
      number: <TPTd className="font-mono text-xs font-semibold text-text">{r.number}</TPTd>,
      date:   <TPTd className="text-sm text-text/80">{fmtDate(r.date)}</TPTd>,
      client: (
        <TPTd className="text-sm text-text truncate">
          {r.client || <span className="text-muted">Sin cliente</span>}
        </TPTd>
      ),
      delivery: (
        <TPTd>
          <TPProgressCell value={r.deliveredQtyTotal} total={orderedQty} />
        </TPTd>
      ),
      invoicing: (
        <TPTd>
          <TPProgressCell value={r.invoicedQtyTotal} total={orderedQty} />
        </TPTd>
      ),
      total:    <TPTd className="text-right tabular-nums font-semibold">{fmtMoney(r.total, r.currency)}</TPTd>,
      invoiced: (
        <TPTd className="text-right tabular-nums">
          {r.invoicedAmount > 0
            ? <span className="font-semibold text-text">{fmtMoney(r.invoicedAmount, r.currency)}</span>
            : <span className="text-muted">—</span>}
        </TPTd>
      ),
      balance: (
        <TPTd className="text-right">
          <TPBalanceCell value={balance} currency={r.currency} />
        </TPTd>
      ),
      status: (
        <TPTd>
          <TPDualStatusBadge
            orientation="stacked"
            size="sm"
            primary={deriveDeliveryEntry(r.deliveredQtyTotal, orderedQty)}
            secondary={deriveInvoicingEntry(r.invoicedQtyTotal, orderedQty)}
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
      <React.Fragment key={r.id}>
        <TPTr>
          {keys.map((k) => (
            <React.Fragment key={k}>{cells[k]}</React.Fragment>
          ))}
        </TPTr>
        <TPRowExpanded isExpanded={isExpanded} colSpan={keys.length}>
          <TPDocumentTimeline
            title="Documentos derivados"
            items={mockDerivedDocuments(r)}
            emptyText="Todavía no se generaron remitos ni facturas para esta orden."
          />
        </TPRowExpanded>
      </React.Fragment>
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
          value={clientFilter}
          onChange={setClientFilter}
          options={clientOptions}
        />
      </div>
    </div>
  );

  return (
    <TPSectionShell
      title="Órdenes de venta"
      subtitle="Pedidos confirmados de clientes"
      right={
        <TPButton variant="primary" onClick={openNew} iconLeft={<Plus size={14} />}>
          Nueva orden
        </TPButton>
      }
    >
      <div className="space-y-4">
        <TPKpiBar items={kpis} columns={5} />

        <TPTableKit<SalesOrder>
          rows={filtered}
          columns={COLS}
          storageKey="tp_sales_orders_cols"
          search={{
            value: q,
            onChange: setQ,
            placeholder: "Buscar por número o cliente…",
            debounceMs: 150,
          }}
          sortPersistKey="tp_sales_orders"
          columnPicker
          headerLeft={filters}
          countLabel={(n) => `${n} ${n === 1 ? "orden" : "órdenes"}`}
          emptyText={
            q || statusFilter !== "ALL" || clientFilter !== "ALL"
              ? "Sin resultados con los filtros aplicados."
              : "Todavía no hay órdenes. Creá la primera desde «Nueva orden»."
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
// Modal editor — misma estructura que VentasPresupuestos
// ─────────────────────────────────────────────────────────────────────────────

function OrderEditorModal(props: {
  open: boolean;
  draft: SalesOrder;
  isNew: boolean;
  onChange: (next: SalesOrder) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const { open, draft, isNew, onChange, onSave, onClose } = props;

  function patch<K extends keyof SalesOrder>(key: K, value: SalesOrder[K]) {
    const next = { ...draft, [key]: value };
    // Cualquier cambio que afecte totales → recalcular.
    if (key === "taxPercent" || key === "discountGlobal" || key === "shipping") {
      const totals = recomputeTotals(next.lines, next.taxPercent, next.discountGlobal, next.shipping);
      onChange({ ...next, ...totals });
      return;
    }
    onChange(next);
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

  function patchLine(lineId: string, p: Partial<DocumentLine>) {
    const nextLines = draft.lines.map((l) => {
      if (l.id !== lineId) return l;
      const merged = { ...l, ...p };
      return { ...merged, subtotal: calcLineSubtotal(merged) };
    });
    const totals = recomputeTotals(nextLines, draft.taxPercent, draft.discountGlobal, draft.shipping);
    onChange({ ...draft, lines: nextLines, ...totals });
  }

  function addLine() {
    const nextLines = [
      ...draft.lines,
      { id: uid(), article: "", variant: "", quantity: 1, unitPrice: 0, discountAmount: 0, subtotal: 0 },
    ];
    const totals = recomputeTotals(nextLines, draft.taxPercent, draft.discountGlobal, draft.shipping);
    onChange({ ...draft, lines: nextLines, ...totals });
  }

  function removeLine(lineId: string) {
    const nextLines = draft.lines.filter((l) => l.id !== lineId);
    const totals = recomputeTotals(nextLines, draft.taxPercent, draft.discountGlobal, draft.shipping);
    onChange({ ...draft, lines: nextLines, ...totals });
  }

  function duplicateLine(lineId: string) {
    const idx = draft.lines.findIndex((l) => l.id === lineId);
    if (idx < 0) return;
    const original = draft.lines[idx];
    const clone: DocumentLine = { ...original, id: uid() };
    const nextLines = [
      ...draft.lines.slice(0, idx + 1),
      clone,
      ...draft.lines.slice(idx + 1),
    ];
    const totals = recomputeTotals(nextLines, draft.taxPercent, draft.discountGlobal, draft.shipping);
    onChange({ ...draft, lines: nextLines, ...totals });
  }

  /** Agrega una línea pre-cargada con los datos del artículo seleccionado
   *  desde el quick-add que vive arriba del listado. */
  function addLineFromArticle(item: TPArticleLite) {
    const price = item.price ?? 0;
    const newLine: DocumentLine = {
      id:             uid(),
      article:        item.article,
      variant:        item.variant ?? "",
      quantity:       1,
      unitPrice:      price,
      discountAmount: 0,
      subtotal:       price,
    };
    const nextLines = [...draft.lines, newLine];
    const totals = recomputeTotals(nextLines, draft.taxPercent, draft.discountGlobal, draft.shipping);
    onChange({ ...draft, lines: nextLines, ...totals });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? "Nueva orden de venta" : `Editar orden ${draft.number}`}
      subtitle={`Número ${draft.number}`}
      maxWidth="7xl"
      className="!max-w-[1500px] w-[96vw]"
      resizable
      maximizable
      maximizedMode="embedded"
      modalKey="ventas-ordenes-editor"
      onEnter={onSave}
      footer={
        <TPDocumentModalFooter
          isNew={isNew}
          onCancel={onClose}
          onSave={onSave}
          summary={
            <div className="text-xs text-muted">
              Subtotal: <span className="font-semibold text-text">{fmtMoney(draft.subtotal, draft.currency)}</span>
              <span className="mx-2 text-border">·</span>
              Impuestos: <span className="font-semibold text-text">{fmtMoney(draft.taxAmount, draft.currency)}</span>
              <span className="mx-2 text-border">·</span>
              Total: <span className="font-bold text-primary">{fmtMoney(draft.total, draft.currency)}</span>
            </div>
          }
        />
      }
    >
      <div className="space-y-3">
        {/* ── Header compacto: cliente + fecha + vendedor + moneda + cotización + lista + IVA ── */}
        <TPCard
          title="Datos de la orden"
          bodyClassName="!p-3"
          headerClassName="!py-2"
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <TPField label="Cliente" required className="col-span-2 sm:col-span-3 lg:col-span-2">
              <TPEntitySearchSelect
                type="client"
                value={draft.client ? { id: draft.client, name: draft.client } : null}
                onChange={(e) => patch("client", e?.name ?? "")}
                onCreateNew={() => toast.info("Crear cliente — próximamente")}
                onViewDetail={(e) => toast.info(`Ver ficha de ${e.name} — próximamente`)}
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
            <TPField label="Vendedor">
              <TPInput
                value={draft.seller}
                onChange={(v: string) => patch("seller", v)}
                placeholder="Opcional"
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
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <TPField label="Lista">
              <TPSelect
                value={draft.priceListId ?? ""}
                onChange={(v) => patch("priceListId", v || undefined)}
                options={PRICE_LIST_MOCK_OPTIONS.map((p) => ({ value: p.id, label: p.label }))}
              />
            </TPField>
            <TPField label="IVA %">
              <TPNumberInput
                value={draft.taxPercent}
                onChange={(v) => patch("taxPercent", v ?? 0)}
                decimals={2}
                min={0}
                max={100}
              />
            </TPField>
            <TPField label="Observaciones" className="col-span-2 sm:col-span-3 lg:col-span-4">
              <TPInput
                value={draft.notes}
                onChange={(v: string) => patch("notes", v)}
                placeholder="Notas internas o para el cliente"
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
            <div className="mb-3">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                Agregar rápido por código o nombre
              </div>
              <TPArticleVariantSearchSelect
                value={null}
                onChange={(item) => { if (item) addLineFromArticle(item); }}
                placeholder="Buscá por SKU o nombre del artículo…"
              />
            </div>

            {draft.lines.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-surface2/20 px-4 py-8 text-center">
                <FileText size={24} className="mx-auto text-muted" />
                <div className="mt-2 text-sm font-semibold text-text">
                  Todavía no hay líneas
                </div>
                <div className="mt-1 text-xs text-muted">
                  Buscá arriba un artículo o presioná «Línea vacía» para una fila en blanco.
                </div>
              </div>
            ) : (
              <TPDocumentLineAdvancedEditor
                lines={draft.lines}
                currency={draft.currency}
                updateLine={patchLine}
                removeLine={removeLine}
                duplicateLine={duplicateLine}
                priceListId={draft.priceListId}
              />
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
                {fmtMoney(draft.total, draft.currency)}
              </div>
              <div className="mt-2 space-y-0.5 border-t border-border/60 pt-2 text-[11px] text-muted">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="tabular-nums font-semibold text-text">{fmtMoney(draft.subtotal, draft.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Descuentos</span>
                  <span className="tabular-nums font-semibold text-amber-500">{fmtMoney(draft.discountAmount, draft.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Impuestos{draft.taxPercent > 0 ? ` (${draft.taxPercent}%)` : ""}</span>
                  <span className="tabular-nums font-semibold text-text">{fmtMoney(draft.taxAmount, draft.currency)}</span>
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
                    placeholder="Fidelidad, promo, etc."
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

