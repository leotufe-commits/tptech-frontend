// src/pages/ComprasPagosProveedor.tsx
// ============================================================================
// Pagos a proveedores — vista consultiva + creación simple.
//
// Estado 100% local (useState). Sin backend, sin impacto real en cuenta
// corriente, sin impacto en stock. Preparada para Fase 6 (ver TODOs en
// saveDraft y en las row actions).
//
// Soporta:
//   · Medios de pago mixtos (efectivo + transferencia + tarjeta + USD/ARS + metal + otro)
//   · Aplicación a múltiples facturas (parcial o total)
//   · Saldo a favor (sobrepago → total pago > aplicado)
//
// Flujo conceptual completo (pipeline de compras):
//   Orden de compra → Recepción → Factura proveedor → Pago proveedor
// ============================================================================

import React, { useMemo, useState } from "react";
import {
  Wallet,
  Coins,
  Banknote,
  Inbox,
  CalendarDays,
  Plus,
  Eye,
  Pencil,
  FileText,
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
import { TPPaymentComponentsEditor } from "../components/ui/TPPaymentComponentsEditor";
import { TPPaymentAllocationsEditor } from "../components/ui/TPPaymentAllocationsEditor";
import { TPDocumentModalFooter } from "../components/ui/TPDocumentModalFooter";
import { TPProgressCell } from "../components/ui/TPProgressCell";
import { TPBalanceCell } from "../components/ui/TPBalanceCell";
import { TPMediosChips } from "../components/ui/TPMediosChips";
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
  type PaymentComponent,
  type PaymentAllocation,
} from "../lib/document-types";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

type SupplierPaymentStatus = "DRAFT" | "APPLIED" | "PARTIAL" | "UNAPPLIED" | "CANCELLED";

type SupplierPayment = {
  id: string;
  number: string;      // "PP-0001"
  date: string;
  supplier: string;
  currency: string;    // moneda de referencia del pago
  fxRate: number;
  notes: string;
  components: PaymentComponent[];
  allocations: PaymentAllocation[];

  // Totales calculados (quedan persistidos en memoria para la tabla)
  totalAmount:   number;   // Σ components.amount (sin convertir — ver TODO Fase 6)
  appliedAmount: number;   // Σ allocations.amountApplied

  status: SupplierPaymentStatus;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function sumComponents(components: PaymentComponent[]): number {
  // Suma naive — los montos pueden estar en distintas monedas. El MVP no los
  // convierte. Fase 6 resolverá conversión a moneda base del tenant.
  return round2(components.reduce((s, c) => s + (Number.isFinite(c.amount) ? c.amount : 0), 0));
}

function sumAllocations(allocations: PaymentAllocation[]): number {
  return round2(
    allocations.reduce((s, a) => s + (Number.isFinite(a.amountApplied) ? a.amountApplied : 0), 0),
  );
}

/**
 * Deriva el estado del pago según total vs aplicado.
 * No sobrescribe CANCELLED (se setea explícitamente).
 */
function derivePaymentStatus(total: number, applied: number): SupplierPaymentStatus {
  if (total <= 0) return "DRAFT";
  if (applied <= 0) return "UNAPPLIED";
  if (applied < total) return "PARTIAL";
  return "APPLIED";
}

// Monedas mezcladas en los componentes del pago
function hasMixedCurrencies(components: PaymentComponent[]): boolean {
  const seen = new Set<string>();
  for (const c of components) {
    const cur = (c.currency || "").trim().toUpperCase();
    if (cur) seen.add(cur);
    if (seen.size > 1) return true;
  }
  return false;
}

// ── Mock de documentos relacionados ────────────────────────────────────────
//
// Genera una mini-timeline a partir de las allocations del pago:
//   · una entrada por cada factura de proveedor con `amountApplied > 0`
//
// Fase 7 reemplaza con referencias reales a FP (y NCP si se agrega el link).

function mockDerivedDocuments(p: SupplierPayment): TPDocumentTimelineItem[] {
  const items: TPDocumentTimelineItem[] = [];
  for (const a of p.allocations) {
    if (!a.invoiceNumber || a.amountApplied <= 0) continue;
    const isComplete = a.invoicePending > 0 && a.amountApplied >= a.invoicePending;
    items.push({
      id:          `${p.id}-alloc-${a.id}`,
      type:        "FP",
      number:      a.invoiceNumber,
      date:        p.date,
      amount:      a.amountApplied,
      currency:    p.currency,
      status:      isComplete ? "PAID" : "PARTIAL",
      statusLabel: isComplete ? "Saldada" : "Parcial",
      statusTone:  isComplete ? "success" : "warning",
    });
  }
  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// Columnas
// ─────────────────────────────────────────────────────────────────────────────

const COLS: TPColDef[] = [
  { key: "expander", label: "",            width: "32px",  canHide: false },
  { key: "number",   label: "Número",      width: "110px", sortKey: "number" },
  { key: "date",     label: "Fecha",       width: "110px", sortKey: "date" },
  { key: "supplier", label: "Proveedor",                   sortKey: "supplier" },
  { key: "medios",   label: "Medios",      width: "220px" },
  { key: "applied",  label: "Aplicado",    width: "150px" },
  { key: "total",    label: "Total",       width: "130px", align: "right", sortKey: "total" },
  { key: "pending",  label: "Pendiente",   width: "130px", align: "right", sortKey: "pending" },
  { key: "status",   label: "Estado",      width: "120px" },
  { key: "actions",  label: "",            width: "48px",  canHide: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// Pantalla
// ─────────────────────────────────────────────────────────────────────────────

type StatusFilter = "ALL" | SupplierPaymentStatus;

export default function ComprasPagosProveedor() {
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [q, setQ]               = useState("");
  const [statusFilter, setStatusFilter]     = useState<StatusFilter>("ALL");
  const [supplierFilter, setSupplierFilter] = useState<string>("ALL");

  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft]           = useState<SupplierPayment | null>(null);

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
    const total           = payments.length;
    const totalAmount     = payments.reduce((s, p) => s + (p.status === "CANCELLED" ? 0 : p.totalAmount), 0);
    const unappliedCount  = payments.filter((p) => p.status === "UNAPPLIED" || p.status === "PARTIAL").length;
    const creditBalance   = payments.reduce((s, p) => {
      if (p.status === "CANCELLED") return s;
      const surplus = Math.max(0, p.totalAmount - p.appliedAmount);
      return s + surplus;
    }, 0);
    const today           = todayISO();
    const todayCount      = payments.filter((p) => p.date === today && p.status !== "CANCELLED").length;

    return [
      { id: "total",     label: "Total pagos",          value: total,                          hint: "Todos los pagos registrados", tone: total > 0 ? "primary" : "neutral",                icon: <Wallet size={12} /> },
      { id: "amount",    label: "Monto total pagado",   value: fmtMoney(totalAmount, ""),      hint: "Suma de pagos no anulados",   tone: totalAmount > 0 ? "info" : "neutral",             icon: <Banknote size={12} /> },
      { id: "pendAppl",  label: "Pend. de aplicar",     value: unappliedCount,                 hint: "Sin aplicar o parciales",     tone: unappliedCount > 0 ? "warning" : "neutral",       icon: <Inbox size={12} /> },
      { id: "credit",    label: "Saldo a favor",        value: fmtMoney(creditBalance, ""),    hint: "Sobrepago acumulado",         tone: creditBalance > 0 ? "success" : "neutral",        icon: <Coins size={12} /> },
      { id: "today",     label: "Pagos del día",        value: todayCount,                     hint: "Fechados hoy",                tone: todayCount > 0 ? "primary" : "neutral",           icon: <CalendarDays size={12} /> },
    ];
  }, [payments]);

  // ── Filtrado ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return payments.filter((p) => {
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (supplierFilter !== "ALL" && p.supplier !== supplierFilter) return false;
      if (!term) return true;
      return `${p.number} ${p.supplier}`.toLowerCase().includes(term);
    });
  }, [payments, q, statusFilter, supplierFilter]);

  // ── Opciones ─────────────────────────────────────────────────────────────
  const supplierOptions = useMemo(() => {
    const uniq = Array.from(new Set(payments.map((p) => p.supplier).filter(Boolean))).sort();
    return [
      { value: "ALL", label: "Todos los proveedores" },
      ...uniq.map((s) => ({ value: s, label: s })),
    ];
  }, [payments]);

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "ALL",       label: "Todos los estados" },
    { value: "DRAFT",     label: "Borrador" },
    { value: "UNAPPLIED", label: "Sin aplicar" },
    { value: "PARTIAL",   label: "Parcial" },
    { value: "APPLIED",   label: "Aplicado" },
    { value: "CANCELLED", label: "Anulado" },
  ];

  // ── Acciones globales ────────────────────────────────────────────────────
  function openNew() {
    const blank: SupplierPayment = {
      id:            uid(),
      number:        nextDocNumber("PP", payments),
      date:          todayISO(),
      supplier:      "",
      currency:      "ARS",
      fxRate:        1,
      notes:         "",
      components:    [],
      allocations:   [],
      totalAmount:   0,
      appliedAmount: 0,
      status:        "DRAFT",
    };
    setDraft(blank);
    setIsNew(true);
    setEditorOpen(true);
  }

  function saveDraft() {
    if (!draft) return;

    // Validaciones
    if (!draft.supplier.trim())   { toast.error("El proveedor es obligatorio."); return; }
    if (draft.components.length === 0) { toast.error("Agregá al menos un medio de pago."); return; }

    // Totales frescos
    const total   = sumComponents(draft.components);
    const applied = sumAllocations(draft.allocations);

    if (total <= 0) { toast.error("El total del pago debe ser mayor a 0."); return; }

    // Línea-por-línea: aplicación no supera pendiente
    for (const a of draft.allocations) {
      if (a.amountApplied < 0) {
        toast.error(`El monto a aplicar no puede ser negativo (${a.invoiceNumber || "factura sin nº"}).`);
        return;
      }
      if (a.invoicePending > 0 && a.amountApplied > a.invoicePending) {
        toast.error(`"${a.invoiceNumber || "Factura"}" supera el pendiente (${fmtMoney(a.invoicePending, draft.currency)}).`);
        return;
      }
    }

    if (applied > total + 0.0001) {
      toast.error(`Lo aplicado (${fmtMoney(applied, draft.currency)}) supera el total del pago (${fmtMoney(total, draft.currency)}).`);
      return;
    }

    const nextStatus: SupplierPaymentStatus =
      draft.status === "CANCELLED"
        ? "CANCELLED"
        : derivePaymentStatus(total, applied);

    const saved: SupplierPayment = {
      ...draft,
      totalAmount:   total,
      appliedAmount: applied,
      status:        nextStatus,
    };

    setPayments((prev) => {
      const exists = prev.some((p) => p.id === saved.id);
      return exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [...prev, saved];
    });

    // TODO (Fase 6):
    // - crear EntityBalanceEntry tipo PAYMENT (role=SUPPLIER, documentRef=saved.number,
    //     amount=total, currency, breakdownSnapshot={ components, allocations, fxRate })
    // - soportar moneda + metales (convertir componentes a moneda base del tenant vía fxRate
    //     y/o cotización de metal vigente)
    // - registrar saldo a favor como nota de crédito interna si applied < total
    // - aplicar a múltiples facturas (por cada allocation →  decrementar pending en la factura
    //     destino y recalcular su estado via derivePaymentStatus de ComprasFacturasProveedor)
    // - al anular un pago: generar movimientos inversos en cuenta corriente + revertir aplicaciones

    toast.success(
      isNew
        ? `Pago ${saved.number} registrado — aplicación y cuenta corriente próximamente`
        : `Pago ${saved.number} actualizado`,
    );

    setEditorOpen(false);
    setDraft(null);
  }

  // ── Row actions ──────────────────────────────────────────────────────────
  function rowActions(p: SupplierPayment): TPActionsMenuItem[] {
    return [
      {
        label: "Ver pago",
        icon: <Eye size={14} />,
        onClick: () => toast.info(`Ver pago ${p.number} — próximamente`),
      },
      {
        label: "Editar",
        icon: <Pencil size={14} />,
        onClick: () => toast.info(`Editar pago ${p.number} — próximamente`),
      },
      { type: "separator" },
      {
        label: "Aplicar a facturas",
        icon: <FileText size={14} />,
        // TODO (Fase 6): abrir modal que liste facturas pendientes del proveedor
        // y permita aplicar el remanente (total - applied) repartido en montos.
        onClick: () => toast.info(`Aplicar ${p.number} a facturas — próximamente`),
      },
      {
        label: "Anular",
        icon: <X size={14} />,
        onClick: () => toast.info(`Anular ${p.number} — próximamente`),
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
    p: SupplierPayment,
    vis: Record<string, boolean>,
    _sel?: unknown,
    orderedKeys?: string[],
  ) {
    const pendingToApply = Math.max(0, p.totalAmount - p.appliedAmount);
    const isExpanded     = expandedIds.has(p.id);

    const cells: Record<string, React.ReactNode> = {
      expander: (
        <TPTd className="px-1">
          <TPRowExpandToggle
            isExpanded={isExpanded}
            onToggle={() => toggleExpanded(p.id)}
            title={isExpanded ? "Ocultar detalle" : "Ver detalle"}
          />
        </TPTd>
      ),
      number:   <TPTd className="font-mono text-xs font-semibold text-text">{p.number}</TPTd>,
      date:     <TPTd className="text-sm text-text/80">{fmtDate(p.date)}</TPTd>,
      supplier: <TPTd className="text-sm text-text truncate">{p.supplier || <span className="text-muted">Sin proveedor</span>}</TPTd>,
      medios: (
        <TPTd>
          <TPMediosChips components={p.components} maxVisible={3} />
        </TPTd>
      ),
      applied: (
        <TPTd>
          <TPProgressCell value={p.appliedAmount} total={p.totalAmount} />
        </TPTd>
      ),
      total:    <TPTd className="text-right tabular-nums font-semibold">{fmtMoney(p.totalAmount, p.currency)}</TPTd>,
      pending: (
        <TPTd className="text-right">
          <TPBalanceCell value={pendingToApply} currency={p.currency} positiveTone="warning" />
        </TPTd>
      ),
      status: (
        <TPTd>
          <TPStatusBadge
            status={p.status}
            tone={p.status === "PARTIAL" ? "info" : undefined}
            label={p.status === "CANCELLED" ? "Anulado" : undefined}
          />
        </TPTd>
      ),
      actions: (
        <TPTd className="text-right px-2" data-tp-actions>
          <TPActionsMenu items={rowActions(p)} title="Acciones" />
        </TPTd>
      ),
    };

    const keys = orderedKeys && orderedKeys.length > 0
      ? orderedKeys
      : COLS.filter((c) => vis[c.key] !== false).map((c) => c.key);

    return (
      <React.Fragment key={p.id}>
        <TPTr>
          {keys.map((k) => (
            <React.Fragment key={k}>{cells[k]}</React.Fragment>
          ))}
        </TPTr>
        <TPRowExpanded isExpanded={isExpanded} colSpan={keys.length}>
          <TPDocumentTimeline
            title="Facturas aplicadas"
            items={mockDerivedDocuments(p)}
            emptyText="Este pago todavía no se aplicó a ninguna factura."
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
      title="Pagos a proveedores"
      subtitle="Registro de pagos y cancelaciones de deuda"
      right={
        <TPButton variant="primary" onClick={openNew} iconLeft={<Plus size={14} />}>
          Nuevo pago
        </TPButton>
      }
    >
      <div className="space-y-4">
        <TPKpiBar items={kpis} columns={5} />

        <TPTableKit<SupplierPayment>
          rows={filtered}
          columns={COLS}
          storageKey="tp_supplier_payments_cols"
          search={{
            value: q,
            onChange: setQ,
            placeholder: "Buscar por número o proveedor…",
            debounceMs: 150,
          }}
          sortPersistKey="tp_supplier_payments"
          columnPicker
          headerLeft={filters}
          countLabel={(n) => `${n} ${n === 1 ? "pago" : "pagos"}`}
          emptyText={
            q || statusFilter !== "ALL" || supplierFilter !== "ALL"
              ? "Sin resultados con los filtros aplicados."
              : "Todavía no hay pagos registrados. Creá el primero desde «Nuevo pago»."
          }
          renderRow={renderRow}
        />
      </div>

      {draft && (
        <PaymentEditorModal
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

function PaymentEditorModal(props: {
  open: boolean;
  draft: SupplierPayment;
  isNew: boolean;
  onChange: (next: SupplierPayment) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const { open, draft, isNew, onChange, onSave, onClose } = props;

  function patch<K extends keyof SupplierPayment>(key: K, value: SupplierPayment[K]) {
    onChange({ ...draft, [key]: value });
  }

  // ── Componentes (medios de pago) ─────────────────────────────────────────
  function addComponent() {
    const nextComponents: PaymentComponent[] = [
      ...draft.components,
      { id: uid(), type: "CASH", amount: 0, currency: draft.currency || "ARS", reference: "" },
    ];
    onChange({
      ...draft,
      components:  nextComponents,
      totalAmount: sumComponents(nextComponents),
    });
  }

  function patchComponent(id: string, p: Partial<PaymentComponent>) {
    const nextComponents = draft.components.map((c) => (c.id === id ? { ...c, ...p } : c));
    onChange({
      ...draft,
      components:  nextComponents,
      totalAmount: sumComponents(nextComponents),
    });
  }

  function removeComponent(id: string) {
    const nextComponents = draft.components.filter((c) => c.id !== id);
    onChange({
      ...draft,
      components:  nextComponents,
      totalAmount: sumComponents(nextComponents),
    });
  }

  // ── Aplicaciones (facturas) ──────────────────────────────────────────────
  function addAllocation() {
    const nextAllocations: PaymentAllocation[] = [
      ...draft.allocations,
      { id: uid(), invoiceNumber: "", invoiceTotal: 0, invoicePending: 0, amountApplied: 0 },
    ];
    onChange({
      ...draft,
      allocations:   nextAllocations,
      appliedAmount: sumAllocations(nextAllocations),
    });
  }

  function patchAllocation(id: string, p: Partial<PaymentAllocation>) {
    const nextAllocations = draft.allocations.map((a) => (a.id === id ? { ...a, ...p } : a));
    onChange({
      ...draft,
      allocations:   nextAllocations,
      appliedAmount: sumAllocations(nextAllocations),
    });
  }

  function removeAllocation(id: string) {
    const nextAllocations = draft.allocations.filter((a) => a.id !== id);
    onChange({
      ...draft,
      allocations:   nextAllocations,
      appliedAmount: sumAllocations(nextAllocations),
    });
  }

  // ── Aplicación rápida: distribuir el remanente sobre las filas existentes
  function autoApplyRemainder() {
    const total   = draft.totalAmount;
    const applied = draft.appliedAmount;
    let remainder = Math.max(0, total - applied);
    if (remainder <= 0) {
      toast.info("El pago ya está totalmente aplicado.");
      return;
    }
    const next = draft.allocations.map((a) => {
      if (remainder <= 0) return a;
      const pending = Math.max(0, a.invoicePending - a.amountApplied);
      if (pending <= 0) return a;
      const add = Math.min(pending, remainder);
      remainder = round2(remainder - add);
      return { ...a, amountApplied: round2(a.amountApplied + add) };
    });
    onChange({
      ...draft,
      allocations:   next,
      appliedAmount: sumAllocations(next),
    });
  }

  const pendingToApply = Math.max(0, draft.totalAmount - draft.appliedAmount);
  const mixedCurrencies = hasMixedCurrencies(draft.components);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? "Nuevo pago a proveedor" : `Editar pago ${draft.number}`}
      subtitle={`Número ${draft.number}`}
      maxWidth="5xl"
      resizable
      maximizable
      maximizedMode="embedded"
      modalKey="compras-pagos-proveedor-editor"
      onEnter={onSave}
      footer={
        <TPDocumentModalFooter
          isNew={isNew}
          onCancel={onClose}
          onSave={onSave}
          saveLabelCreate="Registrar"
          summary={
            <div className="text-xs text-muted">
              Total: <span className="font-semibold text-text">{fmtMoney(draft.totalAmount, draft.currency)}</span>
              <span className="mx-2 text-border">·</span>
              Aplicado: <span className="font-semibold text-text">{fmtMoney(draft.appliedAmount, draft.currency)}</span>
              <span className="mx-2 text-border">·</span>
              Pend. aplicar:{" "}
              <span className={`font-semibold ${pendingToApply > 0 ? "text-amber-500" : "text-emerald-500"}`}>
                {fmtMoney(pendingToApply, draft.currency)}
              </span>
            </div>
          }
        />
      }
    >
      <div className="space-y-4">
        {/* ── Card 1 ─── */}
        <TPCard title="Datos principales">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <TPField label="Proveedor" required>
              <TPInput
                value={draft.supplier}
                onChange={(v: string) => patch("supplier", v)}
                placeholder="Nombre del proveedor"
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

            <TPField label="Moneda de referencia">
              <TPInput
                value={draft.currency}
                onChange={(v: string) => patch("currency", v.toUpperCase())}
                placeholder="ARS"
              />
            </TPField>

            <TPField label="Cotización" hint="A moneda base del tenant">
              <TPNumberInput
                value={draft.fxRate}
                onChange={(v) => patch("fxRate", v ?? 1)}
                decimals={6}
                min={0}
              />
            </TPField>

            <TPField label="Observaciones" className="sm:col-span-2">
              <TPInput
                value={draft.notes}
                onChange={(v: string) => patch("notes", v)}
                placeholder="Notas internas"
              />
            </TPField>
          </div>
        </TPCard>

        {/* ── Card 2 ─── */}
        <TPCard
          title="Medios de pago"
          right={
            <TPButton
              variant="secondary"
              onClick={addComponent}
              iconLeft={<Plus size={14} />}
              className="h-8 text-xs"
            >
              Agregar medio
            </TPButton>
          }
        >
          {draft.components.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
              Sin medios de pago. Agregá efectivo, transferencia, tarjeta, USD, metales, etc.
            </div>
          ) : (
            <TPPaymentComponentsEditor
              components={draft.components}
              updateComponent={patchComponent}
              removeComponent={removeComponent}
              currencyDefault={draft.currency}
            />
          )}
          {mixedCurrencies && draft.components.length > 1 && (
            <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400">
              ⚠ Los medios tienen distintas monedas. El total mostrado es la suma aritmética —
              la conversión a moneda base se resolverá cuando se conecte cuenta corriente (Fase 6).
            </div>
          )}
        </TPCard>

        {/* ── Card 3 ─── */}
        <TPCard
          title="Aplicación a facturas"
          right={
            <div className="flex items-center gap-2">
              <TPButton
                variant="ghost"
                onClick={autoApplyRemainder}
                className="h-8 text-xs"
                title="Distribuir el remanente del pago en las facturas listadas"
              >
                Aplicar remanente
              </TPButton>
              <TPButton
                variant="secondary"
                onClick={addAllocation}
                iconLeft={<Plus size={14} />}
                className="h-8 text-xs"
              >
                Agregar factura
              </TPButton>
            </div>
          }
        >
          {draft.allocations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
              Sin aplicaciones. Agregá facturas o dejá el pago sin aplicar (saldo a favor del proveedor).
            </div>
          ) : (
            <TPPaymentAllocationsEditor
              allocations={draft.allocations}
              currency={draft.currency}
              updateAllocation={patchAllocation}
              removeAllocation={removeAllocation}
              invoicePlaceholder="FP-0001"
            />
          )}
        </TPCard>
      </div>
    </Modal>
  );
}

