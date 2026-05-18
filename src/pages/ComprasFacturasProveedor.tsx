// src/pages/ComprasFacturasProveedor.tsx
// ============================================================================
// Facturas de proveedor — vista consultiva + creación simple.
//
// Estado 100% local (useState). Sin backend, sin deuda real, sin pagos, sin
// impacto en stock. Preparada para Fase 6 (ver comentarios TODO en confirm/
// registerPayment): allí se generará EntityBalanceEntry, se enchufará la
// cuenta corriente del proveedor y se registrarán los pagos reales.
//
// Flujo conceptual:
//   Orden de compra → Recepción → Factura proveedor → Pago proveedor
//
// Mantiene el mismo patrón visual que ComprasOrdenes y ComprasRecepciones:
//   TPSectionShell + TPKpiBar + TPTableKit v2 + Modal + TPCard + TPField.
// ============================================================================

import React, { useMemo, useState } from "react";
import {
  Receipt,
  FileText,
  Clock,
  CreditCard,
  CheckCircle2,
  Plus,
  Eye,
  Pencil,
  Wallet,
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
import { TPInvoiceLinesEditor } from "../components/ui/TPInvoiceLinesEditor";
import { TPDocumentModalFooter } from "../components/ui/TPDocumentModalFooter";
import { TPTotalCell } from "../components/ui/TPTotalCell";
import { cn } from "../components/ui/tp";
import { TPProgressCell } from "../components/ui/TPProgressCell";
import { TPBalanceCell } from "../components/ui/TPBalanceCell";
import { TPAgingCell } from "../components/ui/TPAgingCell";
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
  nextDocNumber,
} from "../lib/document-helpers";
import { formatMoneyDoc as fmtMoney } from "../lib/pricing/format";
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

type SupplierInvoiceStatus =
  | "DRAFT"
  | "PENDING"
  | "PARTIALLY_PAID"
  | "PAID"
  | "CANCELLED";

type SupplierInvoice = {
  id: string;
  number: string;              // interno "FP-0001"
  supplierNumber: string;      // número del proveedor (impreso en la factura real)
  date: string;                // ISO yyyy-mm-dd
  dueDate: string;             // ISO — opcional
  supplier: string;
  purchaseOrderNumber: string; // opcional — referencia a OC
  receiptNumber: string;       // opcional — referencia a Recepción
  currency: string;
  fxRate: number;              // cotización a moneda base. Default 1.
  notes: string;

  // Totales (calculados en saveDraft; quedan persistidos en memoria)
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;

  // Pagos (por ahora siempre 0 — se manejará en Fase 6)
  paidAmount: number;

  lines: DocumentLine[];
  status: SupplierInvoiceStatus;

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
  const qty  = Number.isFinite(l.quantity) ? l.quantity : 0;
  const cost = Number.isFinite(l.unitPrice) ? l.unitPrice : 0;
  const disc = Number.isFinite(l.discountAmount) ? l.discountAmount : 0;
  return Math.max(0, qty * cost - disc);
}

function calcLineTotal(l: Pick<DocumentLine, "quantity" | "unitPrice" | "discountAmount" | "taxAmount">): number {
  const tax = l.taxAmount !== undefined && Number.isFinite(l.taxAmount) ? l.taxAmount : 0;
  return Math.max(0, calcLineSubtotal(l) + tax);
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
  discountGlobal?: DocumentDiscountGlobal,
  shipping?: DocumentShipping,
): Pick<SupplierInvoice, "subtotal" | "discountAmount" | "taxAmount" | "total"> {
  let subtotal = 0;
  let lineDiscount = 0;
  let taxAmount = 0;
  let lineTotalSum = 0;
  for (const l of lines) {
    subtotal     += (l.quantity || 0) * (l.unitPrice || 0);
    lineDiscount += l.discountAmount || 0;
    taxAmount    += l.taxAmount ?? 0;
    lineTotalSum += l.lineTotal ?? 0;
  }
  const globalDiscount = computeGlobalDiscount(subtotal, discountGlobal);
  const shippingCost   = Number.isFinite(shipping?.cost) ? (shipping?.cost ?? 0) : 0;
  const total          = Math.max(0, lineTotalSum - globalDiscount) + shippingCost;

  return {
    subtotal:       round2(subtotal),
    discountAmount: round2(lineDiscount + globalDiscount),
    taxAmount:      round2(taxAmount),
    total:          round2(total),
  };
}

/**
 * Deriva el estado según el total y lo pagado.
 * No sobrescribe CANCELLED ni DRAFT (que se setean manualmente).
 */
// ── Mock de documentos relacionados ────────────────────────────────────────
//
// Genera una mini-timeline a partir de los campos actuales de la factura:
//   · OC origen (`purchaseOrderNumber`)
//   · REC origen (`receiptNumber`)
//   · PP derivado si hay paidAmount > 0 (1 pago mock que representa la suma
//     pagada; Fase 7 expondrá el set real de pagos aplicados)
//
// La aplicación de notas de crédito proveedor queda pendiente: el modelo
// actual de SupplierInvoice no trackea NCP aplicadas — Fase 7 agregará ese
// link.

function mockDerivedDocuments(i: SupplierInvoice): TPDocumentTimelineItem[] {
  const items: TPDocumentTimelineItem[] = [];

  if (i.purchaseOrderNumber) {
    items.push({
      id:          `${i.id}-oc-origin`,
      type:        "OC",
      number:      i.purchaseOrderNumber,
      date:        i.date,
      status:      "CONFIRMED",
      statusLabel: "Origen",
      statusTone:  "neutral",
    });
  }

  if (i.receiptNumber) {
    items.push({
      id:          `${i.id}-rec-origin`,
      type:        "REC",
      number:      i.receiptNumber,
      date:        i.date,
      status:      "CONFIRMED",
      statusLabel: "Origen",
      statusTone:  "neutral",
    });
  }

  if (i.paidAmount > 0) {
    const isComplete = i.paidAmount >= i.total && i.total > 0;
    items.push({
      id:          `${i.id}-pp-1`,
      type:        "PP",
      number:      "PP-0001",
      date:        i.date,
      amount:      i.paidAmount,
      currency:    i.currency,
      status:      isComplete ? "APPLIED" : "PARTIAL",
      statusLabel: isComplete ? "Aplicado" : "Parcial",
      statusTone:  isComplete ? "success" : "warning",
    });
  }

  return items;
}

function derivePaymentStatus(total: number, paid: number): SupplierInvoiceStatus {
  if (total <= 0) return "DRAFT";
  if (paid <= 0) return "PENDING";
  if (paid < total) return "PARTIALLY_PAID";
  return "PAID";
}

// ─────────────────────────────────────────────────────────────────────────────
// Columnas de la tabla principal
// ─────────────────────────────────────────────────────────────────────────────

const COLS: TPColDef[] = [
  { key: "expander",       label: "",            width: "32px",  canHide: false },
  { key: "number",         label: "Nº interno",  width: "110px", sortKey: "number" },
  { key: "supplierNumber", label: "Nº proveedor",width: "130px", sortKey: "supplierNumber" },
  { key: "date",           label: "Fecha",       width: "110px", sortKey: "date" },
  { key: "supplier",       label: "Proveedor",                   sortKey: "supplier" },
  { key: "reference",      label: "Doc. origen", width: "150px" },
  { key: "payment",        label: "Pago",        width: "150px" },
  { key: "total",          label: "Total",       width: "130px", align: "right", sortKey: "total" },
  { key: "balance",        label: "Saldo",       width: "130px", align: "right", sortKey: "balance" },
  { key: "aging",          label: "Aging",       width: "100px", align: "right" },
  { key: "status",         label: "Estado",      width: "120px" },
  { key: "actions",        label: "",            width: "48px",  canHide: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// Pantalla
// ─────────────────────────────────────────────────────────────────────────────

type StatusFilter = "ALL" | SupplierInvoiceStatus;

export default function ComprasFacturasProveedor() {
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [q, setQ]               = useState("");
  const [statusFilter, setStatusFilter]     = useState<StatusFilter>("ALL");
  const [supplierFilter, setSupplierFilter] = useState<string>("ALL");

  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft]           = useState<SupplierInvoice | null>(null);

  // Ids de filas expandidas (detalle con documentos relacionados).
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  const [isNew, setIsNew]           = useState(true);

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const kpis: TPKpiItem[] = useMemo(() => {
    const total          = invoices.length;
    const drafts         = invoices.filter((i) => i.status === "DRAFT").length;
    const pending        = invoices.filter((i) => i.status === "PENDING").length;
    const partiallyPaid  = invoices.filter((i) => i.status === "PARTIALLY_PAID").length;
    const paid           = invoices.filter((i) => i.status === "PAID").length;

    return [
      { id: "total",    label: "Total facturas",        value: total,         hint: "Todas las facturas",      tone: total > 0 ? "primary" : "neutral",        icon: <Receipt size={12} /> },
      { id: "drafts",   label: "Borradores",            value: drafts,        hint: "En preparación",          tone: "neutral",                                icon: <FileText size={12} /> },
      { id: "pending",  label: "Pendientes",            value: pending,       hint: "Sin pagos",               tone: pending > 0 ? "warning" : "neutral",      icon: <Clock size={12} /> },
      { id: "partial",  label: "Parcialmente pagadas",  value: partiallyPaid, hint: "Pago incompleto",         tone: partiallyPaid > 0 ? "info" : "neutral",   icon: <CreditCard size={12} /> },
      { id: "paid",     label: "Pagadas",               value: paid,          hint: "Canceladas al 100%",      tone: paid > 0 ? "success" : "neutral",         icon: <CheckCircle2 size={12} /> },
    ];
  }, [invoices]);

  // ── Filtrado ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return invoices.filter((i) => {
      if (statusFilter !== "ALL" && i.status !== statusFilter) return false;
      if (supplierFilter !== "ALL" && i.supplier !== supplierFilter) return false;
      if (!term) return true;
      return `${i.number} ${i.supplierNumber} ${i.supplier} ${i.purchaseOrderNumber} ${i.receiptNumber}`
        .toLowerCase()
        .includes(term);
    });
  }, [invoices, q, statusFilter, supplierFilter]);

  // ── Opciones ─────────────────────────────────────────────────────────────
  const supplierOptions = useMemo(() => {
    const uniq = Array.from(new Set(invoices.map((i) => i.supplier).filter(Boolean))).sort();
    return [
      { value: "ALL", label: "Todos los proveedores" },
      ...uniq.map((s) => ({ value: s, label: s })),
    ];
  }, [invoices]);

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "ALL",            label: "Todos los estados" },
    { value: "DRAFT",          label: "Borrador" },
    { value: "PENDING",        label: "Pendiente" },
    { value: "PARTIALLY_PAID", label: "Parcial" },
    { value: "PAID",           label: "Pagada" },
    { value: "CANCELLED",      label: "Cancelada" },
  ];

  // ── Acciones globales ────────────────────────────────────────────────────
  function openNew() {
    const blank: SupplierInvoice = {
      id:                  uid(),
      number:              nextDocNumber("FP", invoices),
      supplierNumber:      "",
      date:                todayISO(),
      dueDate:             "",
      supplier:            "",
      purchaseOrderNumber: "",
      receiptNumber:       "",
      currency:            "ARS",
      fxRate:              1,
      notes:               "",
      subtotal:            0,
      discountAmount:      0,
      taxAmount:           0,
      total:               0,
      paidAmount:          0,
      lines:               [],
      status:              "DRAFT",
      priceListId:         "retail",
      shipping:            { methodId: "pickup", cost: 0, address: "", carrier: "" },
      discountGlobal:      { type: "PERCENT", value: 0, reason: "" },
    };
    setDraft(blank);
    setIsNew(true);
    setEditorOpen(true);
  }

  function saveDraft() {
    if (!draft) return;

    // Validaciones (mínimas, explícitas — el user las listó)
    if (!draft.supplier.trim())       { toast.error("El proveedor es obligatorio.");         return; }
    if (!draft.supplierNumber.trim()) { toast.error("El número del proveedor es obligatorio."); return; }
    if (!draft.date)                  { toast.error("La fecha es obligatoria.");             return; }
    if (!draft.currency.trim())       { toast.error("La moneda es obligatoria.");            return; }
    if (draft.lines.length === 0)     { toast.error("Agregá al menos una línea.");           return; }

    for (const l of draft.lines) {
      if (l.quantity <= 0)    { toast.error(`La cantidad debe ser mayor a 0 (${l.article || "línea"}).`); return; }
      if (l.unitPrice < 0)     { toast.error(`El costo unitario no puede ser negativo (${l.article || "línea"}).`); return; }
      if ((l.lineTotal ?? 0) < 0) { toast.error(`El total de línea no puede ser negativo (${l.article || "línea"}).`); return; }
    }

    // Totales y estado
    const totals = recomputeTotals(draft.lines, draft.discountGlobal, draft.shipping);
    if (totals.total < 0) {
      toast.error("El total no puede ser negativo.");
      return;
    }

    // Si estaba CANCELLED no sobreescribimos. Si no, derivamos según pago.
    const nextStatus: SupplierInvoiceStatus =
      draft.status === "CANCELLED"
        ? "CANCELLED"
        : totals.total <= 0
        ? "DRAFT"
        : derivePaymentStatus(totals.total, draft.paidAmount);

    const saved: SupplierInvoice = { ...draft, ...totals, status: nextStatus };

    setInvoices((prev) => {
      const exists = prev.some((i) => i.id === saved.id);
      return exists ? prev.map((i) => (i.id === saved.id ? saved : i)) : [...prev, saved];
    });

    // Marcador para Fase 6: este punto es donde se emitirá la deuda real.
    // TODO (Fase 6): al confirmar factura (status≠DRAFT/CANCELLED) →
    //   · crear EntityBalanceEntry({
    //       entityId: supplierId, role: "SUPPLIER",
    //       entryType: "PURCHASE_INVOICE",
    //       amount: totals.total, currency, documentRef: saved.number,
    //       breakdownSnapshot: { lines, supplier, taxes, fxRate, supplierNumber }
    //     })
    //   · registrar impacto en cuenta corriente del proveedor
    //   · respetar moneda + fxRate para convertir a moneda base del tenant
    toast.success(
      isNew
        ? `Factura ${saved.number} creada — cuenta corriente próximamente`
        : `Factura ${saved.number} actualizada`,
    );

    setEditorOpen(false);
    setDraft(null);
  }

  // ── Row actions ──────────────────────────────────────────────────────────
  function rowActions(i: SupplierInvoice): TPActionsMenuItem[] {
    return [
      {
        label: "Ver factura",
        icon: <Eye size={14} />,
        onClick: () => toast.info(`Ver factura ${i.number} — próximamente`),
      },
      {
        label: "Editar",
        icon: <Pencil size={14} />,
        onClick: () => toast.info(`Editar factura ${i.number} — próximamente`),
      },
      { type: "separator" },
      {
        label: "Registrar pago",
        icon: <Wallet size={14} />,
        // TODO (Fase 6): abrir modal de pago → crear EntityBalanceEntry de pago + actualizar paidAmount + recalcular status via derivePaymentStatus.
        onClick: () => toast.info("Pago proveedor — próximamente"),
      },
      {
        label: "Cancelar",
        icon: <X size={14} />,
        onClick: () => toast.info(`Cancelar factura ${i.number} — próximamente`),
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
    r: SupplierInvoice,
    vis: Record<string, boolean>,
    _sel?: unknown,
    orderedKeys?: string[],
  ) {
    const balance = Math.max(0, r.total - r.paidAmount);
    const reference =
      r.receiptNumber || r.purchaseOrderNumber
        ? [r.receiptNumber, r.purchaseOrderNumber].filter(Boolean).join(" · ")
        : "—";
    const isExpanded = expandedIds.has(r.id);
    const showAging  = r.status !== "PAID" && r.status !== "CANCELLED" && balance > 0;

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
      number:         <TPTd className="font-mono text-xs font-semibold text-text">{r.number}</TPTd>,
      supplierNumber: <TPTd className="font-mono text-xs text-text/80">{r.supplierNumber || <span className="text-muted">—</span>}</TPTd>,
      date:           <TPTd className="text-sm text-text/80">{fmtDate(r.date)}</TPTd>,
      supplier:       <TPTd className="text-sm text-text truncate">{r.supplier || <span className="text-muted">Sin proveedor</span>}</TPTd>,
      reference:      <TPTd className="font-mono text-[11px] text-muted">{reference}</TPTd>,
      payment: (
        <TPTd>
          <TPProgressCell value={r.paidAmount} total={r.total} />
        </TPTd>
      ),
      total:          <TPTd className="text-right tabular-nums font-semibold">{fmtMoney(r.total, r.currency)}</TPTd>,
      balance: (
        <TPTd className="text-right">
          <TPBalanceCell value={balance} currency={r.currency} />
        </TPTd>
      ),
      aging: (
        <TPTd className="text-right text-xs">
          {showAging
            ? <TPAgingCell dueDate={r.dueDate || undefined} />
            : <span className="text-muted">—</span>}
        </TPTd>
      ),
      status: (
        <TPTd>
          <TPStatusBadge
            status={r.status}
            tone={r.status === "PARTIALLY_PAID" ? "info" : undefined}
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
      <React.Fragment key={r.id}>
        <TPTr>
          {keys.map((k) => (
            <React.Fragment key={k}>{cells[k]}</React.Fragment>
          ))}
        </TPTr>
        <TPRowExpanded isExpanded={isExpanded} colSpan={keys.length}>
          <TPDocumentTimeline
            title="Documentos relacionados"
            items={mockDerivedDocuments(r)}
            emptyText="Todavía no hay pagos aplicados ni documento origen vinculado."
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
          value={supplierFilter}
          onChange={setSupplierFilter}
          options={supplierOptions}
        />
      </div>
    </div>
  );

  return (
    <TPSectionShell
      title="Facturas proveedor"
      subtitle="Comprobantes económicos recibidos de proveedores"
      right={
        <TPButton variant="primary" onClick={openNew} iconLeft={<Plus size={14} />}>
          Nueva factura
        </TPButton>
      }
    >
      <div className="space-y-4">
        <TPKpiBar items={kpis} columns={5} />

        <TPTableKit<SupplierInvoice>
          rows={filtered}
          columns={COLS}
          storageKey="tp_supplier_invoices_cols"
          search={{
            value: q,
            onChange: setQ,
            placeholder: "Buscar por número, proveedor, OC o recepción…",
            debounceMs: 150,
          }}
          sortPersistKey="tp_supplier_invoices"
          columnPicker
          headerLeft={filters}
          countLabel={(n) => `${n} ${n === 1 ? "factura" : "facturas"}`}
          emptyText={
            q || statusFilter !== "ALL" || supplierFilter !== "ALL"
              ? "Sin resultados con los filtros aplicados."
              : "Todavía no hay facturas de proveedor. Creá la primera desde «Nueva factura»."
          }
          renderRow={renderRow}
        />
      </div>

      {draft && (
        <InvoiceEditorModal
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

function InvoiceEditorModal(props: {
  open: boolean;
  draft: SupplierInvoice;
  isNew: boolean;
  onChange: (next: SupplierInvoice) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const { open, draft, isNew, onChange, onSave, onClose } = props;

  function patch<K extends keyof SupplierInvoice>(key: K, value: SupplierInvoice[K]) {
    const next = { ...draft, [key]: value };
    // Cualquier cambio que afecte totales → recalcular.
    if (key === "discountGlobal" || key === "shipping") {
      const totals = recomputeTotals(next.lines, next.discountGlobal, next.shipping);
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
      return {
        ...merged,
        subtotal:  calcLineSubtotal(merged),
        lineTotal: calcLineTotal(merged),
      };
    });
    const totals = recomputeTotals(nextLines, draft.discountGlobal, draft.shipping);
    onChange({ ...draft, lines: nextLines, ...totals });
  }

  function addLine() {
    const nextLines: DocumentLine[] = [
      ...draft.lines,
      {
        id: uid(),
        article: "",
        variant: "",
        quantity: 1,
        unitPrice: 0,
        discountAmount: 0,
        subtotal: 0,
        taxAmount: 0,
        lineTotal: 0,
      },
    ];
    const totals = recomputeTotals(nextLines, draft.discountGlobal, draft.shipping);
    onChange({ ...draft, lines: nextLines, ...totals });
  }

  function removeLine(lineId: string) {
    const nextLines = draft.lines.filter((l) => l.id !== lineId);
    const totals = recomputeTotals(nextLines, draft.discountGlobal, draft.shipping);
    onChange({ ...draft, lines: nextLines, ...totals });
  }

  const balance = Math.max(0, draft.total - draft.paidAmount);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? "Nueva factura de proveedor" : `Editar factura ${draft.number}`}
      subtitle={`Nº interno ${draft.number}`}
      maxWidth="7xl"
      className="!max-w-[1500px] w-[96vw]"
      resizable
      maximizable
      maximizedMode="embedded"
      modalKey="compras-facturas-proveedor-editor"
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
        {/* ── Header compacto ── */}
        <TPCard
          title="Datos de la factura"
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
            <TPField label="Nº proveedor" required>
              <TPInput
                value={draft.supplierNumber}
                onChange={(v: string) => patch("supplierNumber", v)}
                placeholder="A-0001-00001234"
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
            <TPField label="Vencimiento">
              <input
                type="date"
                value={draft.dueDate}
                onChange={(e) => patch("dueDate", e.target.value)}
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
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <TPField label="Cotización" hint={isBaseCurrency(draft.currency) ? "Fija en 1 (moneda base)" : "A moneda base del tenant"}>
              <TPNumberInput
                value={draft.fxRate}
                onChange={(v) => patch("fxRate", v ?? 1)}
                decimals={6}
                disabled={isBaseCurrency(draft.currency)}
                min={0}
              />
            </TPField>
            <TPField label="OC origen">
              <TPInput
                value={draft.purchaseOrderNumber}
                onChange={(v: string) => patch("purchaseOrderNumber", v.toUpperCase())}
                placeholder="OC-0001"
              />
            </TPField>
            <TPField label="Recepción">
              <TPInput
                value={draft.receiptNumber}
                onChange={(v: string) => patch("receiptNumber", v.toUpperCase())}
                placeholder="REC-0001"
              />
            </TPField>
            <TPField label="Lista">
              <TPSelect
                value={draft.priceListId ?? ""}
                onChange={(v) => patch("priceListId", v || undefined)}
                options={PRICE_LIST_MOCK_OPTIONS.map((p) => ({ value: p.id, label: p.label }))}
              />
            </TPField>
            <TPField label="Observaciones" className="col-span-2 sm:col-span-3 lg:col-span-2">
              <TPInput
                value={draft.notes}
                onChange={(v: string) => patch("notes", v)}
                placeholder="Notas internas"
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
                  Presioná «Línea vacía» para agregar un ítem a la factura.
                </div>
              </div>
            ) : (
              <TPInvoiceLinesEditor
                lines={draft.lines}
                currency={draft.currency}
                updateLine={patchLine}
                removeLine={removeLine}
                priceColumnLabel="Costo unit."
              />
            )}
          </TPCard>

          {/* ── Columna derecha: resumen sticky ── */}
          <aside className="space-y-3 lg:sticky lg:top-2 lg:self-start">
            {/* Hero Total */}
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Total a pagar
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
                  <span>Impuestos</span>
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
                    placeholder="Bonificación, ajuste, etc."
                  />
                </TPField>
              </div>
            </TPCard>

            {/* Envío (compact) */}
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

            {/* Pago */}
            <TPCard title="Pago" bodyClassName="!p-3" headerClassName="!py-2">
              <div className="grid grid-cols-2 gap-2">
                <TPTotalCell
                  label="Pagado"
                  value={draft.paidAmount > 0 ? fmtMoney(draft.paidAmount, draft.currency) : "—"}
                />
                <TPTotalCell
                  label="Saldo"
                  value={balance > 0 ? fmtMoney(balance, draft.currency) : "—"}
                  tone={balance > 0 ? "danger" : "success"}
                  bold
                />
              </div>
              <div className="mt-2 rounded bg-surface2/40 px-2 py-1 text-center text-[10px] uppercase tracking-wide">
                <span className={cn(
                  "font-semibold",
                  balance <= 0 ? "text-emerald-500"
                  : draft.paidAmount > 0 ? "text-amber-500"
                  : "text-amber-500"
                )}>
                  {balance <= 0 ? "Pagada"
                    : draft.paidAmount > 0 ? "Parcial"
                    : "Pendiente"}
                </span>
              </div>
            </TPCard>
          </aside>
        </div>
      </div>
    </Modal>
  );
}

