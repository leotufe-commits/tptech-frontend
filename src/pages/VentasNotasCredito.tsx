// src/pages/VentasNotasCredito.tsx
// ============================================================================
// Notas de crédito de venta — ajustes económicos a favor del cliente.
//
// Estado 100% local (useState). Sin backend, sin impacto en stock, sin
// aplicación real a facturas. La NC solo ajusta cuenta corriente / deuda del
// cliente; la devolución real de mercadería es un documento separado.
//
// Pantalla construida sobre los componentes consolidados (Fase A/B/C).
// ============================================================================

import React, { useMemo, useState } from "react";
import {
  FileMinus,
  FileText,
  Clock,
  CheckCircle2,
  CheckCheck,
  X,
  Plus,
  Eye,
  Pencil,
  Send,
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
  type DocumentDiscountGlobal,
  CURRENCY_MOCK_OPTIONS,
  isBaseCurrency,
} from "../lib/document-types";
import { TPEntitySearchSelect } from "../components/ui/TPEntitySearchSelect";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

type CreditNoteStatus = "DRAFT" | "CONFIRMED" | "APPLIED" | "CANCELLED";

type SalesCreditNote = {
  id: string;
  number: string;             // "NCV-0001"
  date: string;               // ISO
  client: string;
  relatedDocument: string;    // ej. "FV-0001" — opcional
  reason: string;             // motivo del ajuste
  currency: string;
  /** Cotización a moneda base. Default 1. Editable solo si currency ≠ base. */
  fxRate: number;
  /** IVA % a nivel documento — placeholder hasta Fase 6 (pricing-engine). */
  taxPercent: number;
  notes: string;

  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;

  lines: DocumentLine[];
  status: CreditNoteStatus;

  /** Descuento global aplicado sobre el subtotal. */
  discountGlobal?: DocumentDiscountGlobal;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function calcLineTotal(l: Pick<DocumentLine, "quantity" | "unitPrice" | "discountAmount">): number {
  const qty   = Number.isFinite(l.quantity) ? l.quantity : 0;
  const price = Number.isFinite(l.unitPrice) ? l.unitPrice : 0;
  const disc  = Number.isFinite(l.discountAmount) ? l.discountAmount : 0;
  return Math.max(0, qty * price - disc);
}

function computeGlobalDiscount(subtotal: number, d?: DocumentDiscountGlobal): number {
  if (!d || !Number.isFinite(d.value) || d.value <= 0) return 0;
  if (d.type === "PERCENT") return Math.max(0, (subtotal * d.value) / 100);
  return Math.max(0, d.value);
}

function recomputeTotals(
  lines: DocumentLine[],
  taxPercent: number,
  discountGlobal?: DocumentDiscountGlobal,
): Pick<SalesCreditNote, "subtotal" | "discountAmount" | "taxAmount" | "total"> {
  let subtotal = 0;
  let lineDiscount = 0;
  for (const l of lines) {
    subtotal += l.lineTotal ?? 0;
    lineDiscount += l.discountAmount || 0;
  }
  const globalDiscount = computeGlobalDiscount(subtotal, discountGlobal);
  const netSubtotal    = Math.max(0, subtotal - globalDiscount);
  const taxRate        = Number.isFinite(taxPercent) && taxPercent >= 0 ? taxPercent : 0;
  const taxAmount      = netSubtotal * (taxRate / 100);
  const total          = netSubtotal + taxAmount;
  return {
    subtotal:       round2(subtotal),
    discountAmount: round2(lineDiscount + globalDiscount),
    taxAmount:      round2(taxAmount),
    total:          round2(total),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Columnas
// ─────────────────────────────────────────────────────────────────────────────

const COLS: TPColDef[] = [
  { key: "number",    label: "Número",    width: "120px", sortKey: "number" },
  { key: "date",      label: "Fecha",     width: "110px", sortKey: "date" },
  { key: "client",    label: "Cliente",                   sortKey: "client" },
  { key: "reference", label: "Documento", width: "130px" },
  { key: "reason",    label: "Motivo",    width: "220px" },
  { key: "total",     label: "Total",     width: "140px", align: "right", sortKey: "total" },
  { key: "status",    label: "Estado",    width: "120px" },
  { key: "actions",   label: "",          width: "48px",  canHide: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// Pantalla
// ─────────────────────────────────────────────────────────────────────────────

type StatusFilter = "ALL" | CreditNoteStatus;

export default function VentasNotasCredito() {
  const [notes, setNotes] = useState<SalesCreditNote[]>([]);
  const [q, setQ]                       = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [clientFilter, setClientFilter] = useState<string>("ALL");

  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft]           = useState<SalesCreditNote | null>(null);
  const [isNew, setIsNew]           = useState(true);

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const kpis: TPKpiItem[] = useMemo(() => {
    const total     = notes.length;
    const drafts    = notes.filter((n) => n.status === "DRAFT").length;
    const confirmed = notes.filter((n) => n.status === "CONFIRMED").length;
    const applied   = notes.filter((n) => n.status === "APPLIED").length;
    const cancelled = notes.filter((n) => n.status === "CANCELLED").length;

    return [
      { id: "total",     label: "Total notas",  value: total,     hint: "Todas las notas",     tone: total > 0 ? "primary" : "neutral",   icon: <FileMinus size={12} /> },
      { id: "drafts",    label: "Borradores",   value: drafts,    hint: "En preparación",       tone: "neutral",                            icon: <FileText size={12} /> },
      { id: "confirmed", label: "Confirmadas",  value: confirmed, hint: "Sin aplicar todavía",  tone: confirmed > 0 ? "info" : "neutral",   icon: <CheckCircle2 size={12} /> },
      { id: "applied",   label: "Aplicadas",    value: applied,   hint: "Aplicadas a factura",  tone: applied > 0 ? "success" : "neutral",  icon: <CheckCheck size={12} /> },
      { id: "cancelled", label: "Anuladas",     value: cancelled, hint: "Canceladas",           tone: cancelled > 0 ? "danger" : "neutral", icon: <X size={12} /> },
    ];
  }, [notes]);

  // ── Filtrado ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return notes.filter((n) => {
      if (statusFilter !== "ALL" && n.status !== statusFilter) return false;
      if (clientFilter !== "ALL" && n.client !== clientFilter) return false;
      if (!term) return true;
      return `${n.number} ${n.client} ${n.relatedDocument} ${n.reason}`.toLowerCase().includes(term);
    });
  }, [notes, q, statusFilter, clientFilter]);

  // ── Opciones de filtros ──────────────────────────────────────────────────
  const clientOptions = useMemo(() => {
    const uniq = Array.from(new Set(notes.map((n) => n.client).filter(Boolean))).sort();
    return [
      { value: "ALL", label: "Todos los clientes" },
      ...uniq.map((c) => ({ value: c, label: c })),
    ];
  }, [notes]);

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "ALL",       label: "Todos los estados" },
    { value: "DRAFT",     label: "Borrador" },
    { value: "CONFIRMED", label: "Confirmada" },
    { value: "APPLIED",   label: "Aplicada" },
    { value: "CANCELLED", label: "Anulada" },
  ];

  // ── Crear / editar ────────────────────────────────────────────────────────
  function openNew() {
    const draftObj: SalesCreditNote = {
      id:              uid(),
      number:          nextDocNumber("NCV", notes),
      date:            todayISO(),
      client:          "",
      relatedDocument: "",
      reason:          "",
      currency:        "ARS",
      fxRate:          1,
      taxPercent:      21,
      notes:           "",
      subtotal:        0,
      discountAmount:  0,
      taxAmount:       0,
      total:           0,
      lines:           [],
      status:          "DRAFT",
      discountGlobal:  { type: "PERCENT", value: 0, reason: "" },
    };
    setDraft(draftObj);
    setIsNew(true);
    setEditorOpen(true);
  }

  function openEdit(n: SalesCreditNote) {
    setDraft({ ...n, lines: n.lines.map((l) => ({ ...l })) });
    setIsNew(false);
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setDraft(null);
  }

  function saveDraft() {
    if (!draft) return;

    if (!draft.client.trim())     { toast.error("El cliente es obligatorio.");  return; }
    if (!draft.date)              { toast.error("La fecha es obligatoria.");    return; }
    if (!draft.currency.trim())   { toast.error("La moneda es obligatoria.");   return; }
    if (!draft.reason.trim())     { toast.error("El motivo es obligatorio.");   return; }
    if (draft.lines.length === 0) { toast.error("Agregá al menos una línea.");  return; }

    for (const l of draft.lines) {
      if (l.quantity <= 0)        { toast.error(`La cantidad debe ser mayor a 0 (${l.article || "línea"}).`); return; }
      if (l.unitPrice < 0)        { toast.error(`El precio no puede ser negativo (${l.article || "línea"}).`); return; }
      if ((l.lineTotal ?? 0) < 0) { toast.error(`El total de línea no puede ser negativo (${l.article || "línea"}).`); return; }
    }

    const totals = recomputeTotals(draft.lines, draft.taxPercent, draft.discountGlobal);
    if (totals.total < 0) { toast.error("El total no puede ser negativo."); return; }

    const normalized: SalesCreditNote = { ...draft, ...totals };

    setNotes((prev) => {
      const exists = prev.some((n) => n.id === normalized.id);
      return exists ? prev.map((n) => (n.id === normalized.id ? normalized : n)) : [normalized, ...prev];
    });
    toast.success(isNew ? "Nota de crédito creada" : "Nota de crédito actualizada");
    closeEditor();
  }

  // ── Row actions (placeholders) ────────────────────────────────────────────
  function confirmNote(n: SalesCreditNote) {
    if (n.status !== "DRAFT") { toast.info("Solo los borradores se pueden confirmar."); return; }
    setNotes((prev) => prev.map((x) => (x.id === n.id ? { ...x, status: "CONFIRMED" } : x)));
    toast.success(`Nota ${n.number} confirmada`);
  }
  function applyNote(n: SalesCreditNote) {
    if (n.status !== "CONFIRMED") { toast.info("Solo las confirmadas se pueden aplicar."); return; }
    setNotes((prev) => prev.map((x) => (x.id === n.id ? { ...x, status: "APPLIED" } : x)));
    toast.success(`Nota ${n.number} aplicada — (backend Fase 6)`);
  }
  function cancelNote(n: SalesCreditNote) {
    if (n.status === "CANCELLED") return;
    setNotes((prev) => prev.map((x) => (x.id === n.id ? { ...x, status: "CANCELLED" } : x)));
    toast.success(`Nota ${n.number} anulada`);
  }

  function rowActions(n: SalesCreditNote): TPActionsMenuItem[] {
    return [
      { label: "Ver",       icon: <Eye size={14} />,        onClick: () => openEdit(n) },
      { label: "Editar",    icon: <Pencil size={14} />,     onClick: () => openEdit(n), disabled: n.status === "APPLIED" || n.status === "CANCELLED" },
      { label: "Confirmar", icon: <Send size={14} />,       onClick: () => confirmNote(n), disabled: n.status !== "DRAFT" },
      { label: "Aplicar a factura / deuda", icon: <CheckCheck size={14} />, onClick: () => applyNote(n), disabled: n.status !== "CONFIRMED" },
      { label: "Anular",    icon: <X size={14} />,          onClick: () => cancelNote(n), disabled: n.status === "CANCELLED" },
      { type: "separator" },
      { label: "Imprimir",  icon: <Printer size={14} />,    onClick: () => toast.info("Impresión — próximamente") },
    ];
  }

  // ── Render row ───────────────────────────────────────────────────────────
  function renderRow(
    r: SalesCreditNote,
    vis: Record<string, boolean>,
    _sel?: unknown,
    orderedKeys?: string[],
  ) {
    const cells: Record<string, React.ReactNode> = {
      number:    <TPTd className="font-mono text-xs font-semibold text-text">{r.number}</TPTd>,
      date:      <TPTd className="text-sm text-text/80">{fmtDate(r.date)}</TPTd>,
      client:    <TPTd className="text-sm text-text truncate">{r.client || <span className="text-muted">Sin cliente</span>}</TPTd>,
      reference: <TPTd className="font-mono text-[11px] text-muted">{r.relatedDocument || "—"}</TPTd>,
      reason:    <TPTd className="text-sm text-text/80">{r.reason ? <span className="block truncate" title={r.reason}>{r.reason}</span> : <span className="text-muted">—</span>}</TPTd>,
      total:     <TPTd className="text-right tabular-nums font-semibold">{fmtMoney(r.total, r.currency)}</TPTd>,
      status: (
        <TPTd>
          <TPStatusBadge
            status={r.status}
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
          value={clientFilter}
          onChange={setClientFilter}
          options={clientOptions}
        />
      </div>
    </div>
  );

  return (
    <TPSectionShell
      title="Notas de crédito"
      subtitle="Ajustes económicos a favor del cliente"
      right={
        <TPButton variant="primary" onClick={openNew} iconLeft={<Plus size={14} />}>
          Nueva nota
        </TPButton>
      }
    >
      <div className="space-y-4">
        <TPKpiBar items={kpis} columns={5} />

        <TPTableKit<SalesCreditNote>
          rows={filtered}
          columns={COLS}
          storageKey="tp_sales_credit_notes_cols"
          search={{
            value: q,
            onChange: setQ,
            placeholder: "Buscar por número, cliente, documento o motivo…",
            debounceMs: 150,
          }}
          sortPersistKey="tp_sales_credit_notes"
          columnPicker
          headerLeft={filters}
          countLabel={(n) => `${n} ${n === 1 ? "nota" : "notas"}`}
          emptyText={
            q || statusFilter !== "ALL" || clientFilter !== "ALL"
              ? "Sin resultados con los filtros aplicados."
              : "Todavía no hay notas de crédito. Creá la primera desde «Nueva nota»."
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
  draft: SalesCreditNote;
  isNew: boolean;
  onChange: (next: SalesCreditNote) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const { open, draft, isNew, onChange, onSave, onClose } = props;

  function patch<K extends keyof SalesCreditNote>(key: K, value: SalesCreditNote[K]) {
    const next = { ...draft, [key]: value };
    if (key === "taxPercent" || key === "discountGlobal") {
      const totals = recomputeTotals(next.lines, next.taxPercent, next.discountGlobal);
      onChange({ ...next, ...totals });
      return;
    }
    onChange(next);
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
      const newTotal = calcLineTotal(merged);
      return { ...merged, subtotal: newTotal, lineTotal: newTotal };
    });
    const totals = recomputeTotals(nextLines, draft.taxPercent, draft.discountGlobal);
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
        lineTotal: 0,
      },
    ];
    const totals = recomputeTotals(nextLines, draft.taxPercent, draft.discountGlobal);
    onChange({ ...draft, lines: nextLines, ...totals });
  }

  function removeLine(lineId: string) {
    const nextLines = draft.lines.filter((l) => l.id !== lineId);
    const totals = recomputeTotals(nextLines, draft.taxPercent, draft.discountGlobal);
    onChange({ ...draft, lines: nextLines, ...totals });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? "Nueva nota de crédito" : `Editar nota ${draft.number}`}
      subtitle={`Número ${draft.number}`}
      maxWidth="7xl"
      className="!max-w-[1500px] w-[96vw]"
      resizable
      maximizable
      maximizedMode="embedded"
      modalKey="ventas-notas-credito-editor"
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
          title="Datos de la nota de crédito"
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
            <TPField label="FV origen">
              <TPInput
                value={draft.relatedDocument}
                onChange={(v: string) => patch("relatedDocument", v.toUpperCase())}
                placeholder="FV-0001"
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
            <TPField label="IVA %">
              <TPNumberInput
                value={draft.taxPercent}
                onChange={(v) => patch("taxPercent", v ?? 0)}
                decimals={2}
                min={0}
                max={100}
              />
            </TPField>
            <TPField label="Motivo" required className="col-span-2 sm:col-span-2 lg:col-span-2">
              <TPInput
                value={draft.reason}
                onChange={(v: string) => patch("reason", v)}
                placeholder="Ej: Devolución de producto defectuoso"
              />
            </TPField>
            <TPField label="Observaciones" className="col-span-2 sm:col-span-3 lg:col-span-3">
              <TPInput
                value={draft.notes}
                onChange={(v: string) => patch("notes", v)}
                placeholder="Detalles adicionales del ajuste"
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
                  Presioná «Línea vacía» para agregar un ítem al ajuste.
                </div>
              </div>
            ) : (
              <TPInvoiceLinesEditor
                lines={draft.lines}
                currency={draft.currency}
                updateLine={patchLine}
                removeLine={removeLine}
                taxColumnLabel="IVA %"
                taxEditable={false}
              />
            )}
          </TPCard>

          {/* ── Columna derecha: resumen sticky ── */}
          <aside className="space-y-3 lg:sticky lg:top-2 lg:self-start">
            {/* Hero Total */}
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Total a acreditar
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
          </aside>
        </div>
      </div>
    </Modal>
  );
}
