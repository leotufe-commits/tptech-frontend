// src/pages/VentasPresupuestos.tsx
// ============================================================================
// Presupuestos de venta — cotizaciones a clientes.
//
// Estado 100% local (useState). Sin backend, sin impacto en stock, sin deuda.
//
// Este módulo está preparado para reutilizar el simulador real del pricing-engine
// cuando se conecte en Fase 6. Por ahora:
//   · las líneas se editan manualmente (artículo / variante texto libre)
//   · IVA% es un campo declarativo del header que aplica sobre el subtotal
//   · los totales se recalculan en vivo en cada keystroke
//
// Sigue el mismo patrón visual que las pantallas de Compras:
//   TPSectionShell + TPKpiBar + TPTableKit v2 + Modal con 3 TPCard.
// ============================================================================

import React, { useMemo, useState } from "react";
import {
  FileText,
  Clock,
  Send,
  ThumbsUp,
  ThumbsDown,
  Plus,
  Eye,
  Pencil,
  Copy,
  CheckCircle2,
  ArrowRight,
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
import { TPDocumentLineAdvancedEditor } from "../components/ui/TPDocumentLineAdvancedEditor";
import {
  TPArticleVariantSearchSelect,
  type TPArticleLite,
} from "../components/ui/TPArticleVariantSearchSelect";
import { TPDocumentModalFooter } from "../components/ui/TPDocumentModalFooter";

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
import { toast } from "../lib/toast";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

type QuoteStatus = "DRAFT" | "SENT" | "APPROVED" | "REJECTED";

type Quote = {
  id: string;
  number: string;          // "PR-0001"
  date: string;            // ISO
  client: string;
  priceList: string;
  currency: string;
  /** Cotización a moneda base. Default 1. Editable solo si currency ≠ base. */
  fxRate: number;
  seller: string;
  notes: string;

  /** % de IVA declarativo — placeholder hasta integrar pricing-engine (Fase 6) */
  taxPercent: number;

  // Totales calculados (persistidos en memoria para la tabla)
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;

  lines: DocumentLine[];
  status: QuoteStatus;

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
): Pick<Quote, "subtotal" | "discountAmount" | "taxAmount" | "total"> {
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

function itemsCount(q: Quote): number {
  return q.lines.reduce((s, l) => s + (Number.isFinite(l.quantity) ? l.quantity : 0), 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Columnas
// ─────────────────────────────────────────────────────────────────────────────

const COLS: TPColDef[] = [
  { key: "number",  label: "Número",   width: "110px", sortKey: "number" },
  { key: "date",    label: "Fecha",    width: "110px", sortKey: "date" },
  { key: "client",  label: "Cliente",                  sortKey: "client" },
  { key: "items",   label: "Ítems",    width: "90px",  align: "right", sortKey: "items" },
  { key: "total",   label: "Total",    width: "140px", align: "right", sortKey: "total" },
  { key: "status",  label: "Estado",   width: "120px" },
  { key: "actions", label: "",         width: "48px",  canHide: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// Pantalla
// ─────────────────────────────────────────────────────────────────────────────

type StatusFilter = "ALL" | QuoteStatus;

export default function VentasPresupuestos() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [q, setQ]                           = useState("");
  const [statusFilter, setStatusFilter]     = useState<StatusFilter>("ALL");
  const [clientFilter, setClientFilter]     = useState<string>("ALL");

  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft]           = useState<Quote | null>(null);
  const [isNew, setIsNew]           = useState(true);

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const kpis: TPKpiItem[] = useMemo(() => {
    const total    = quotes.length;
    const drafts   = quotes.filter((x) => x.status === "DRAFT").length;
    const sent     = quotes.filter((x) => x.status === "SENT").length;
    const approved = quotes.filter((x) => x.status === "APPROVED").length;
    const rejected = quotes.filter((x) => x.status === "REJECTED").length;

    return [
      { id: "total",    label: "Total presupuestos", value: total,    hint: "Todos",                  tone: total > 0 ? "primary" : "neutral",    icon: <FileText size={12} /> },
      { id: "drafts",   label: "Borradores",         value: drafts,   hint: "En preparación",         tone: "neutral",                            icon: <Clock size={12} /> },
      { id: "sent",     label: "Enviados",           value: sent,     hint: "A la espera de respuesta", tone: sent > 0 ? "info" : "neutral",       icon: <Send size={12} /> },
      { id: "approved", label: "Aprobados",          value: approved, hint: "Clientes confirmaron",   tone: approved > 0 ? "success" : "neutral", icon: <ThumbsUp size={12} /> },
      { id: "rejected", label: "Rechazados",         value: rejected, hint: "Cliente desistió",       tone: rejected > 0 ? "danger" : "neutral",  icon: <ThumbsDown size={12} /> },
    ];
  }, [quotes]);

  // ── Filtrado ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return quotes.filter((x) => {
      if (statusFilter !== "ALL" && x.status !== statusFilter) return false;
      if (clientFilter !== "ALL" && x.client !== clientFilter) return false;
      if (!term) return true;
      return `${x.number} ${x.client}`.toLowerCase().includes(term);
    });
  }, [quotes, q, statusFilter, clientFilter]);

  // ── Opciones ─────────────────────────────────────────────────────────────
  const clientOptions = useMemo(() => {
    const uniq = Array.from(new Set(quotes.map((x) => x.client).filter(Boolean))).sort();
    return [
      { value: "ALL", label: "Todos los clientes" },
      ...uniq.map((c) => ({ value: c, label: c })),
    ];
  }, [quotes]);

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "ALL",      label: "Todos los estados" },
    { value: "DRAFT",    label: "Borrador" },
    { value: "SENT",     label: "Enviado" },
    { value: "APPROVED", label: "Aprobado" },
    { value: "REJECTED", label: "Rechazado" },
  ];

  // ── Acciones globales ────────────────────────────────────────────────────
  function openNew() {
    const blank: Quote = {
      id:             uid(),
      number:         nextDocNumber("PR", quotes),
      date:           todayISO(),
      client:         "",
      priceList:      "",
      currency:       "ARS",
      fxRate:         1,
      seller:         "",
      notes:          "",
      taxPercent:     0,
      subtotal:       0,
      discountAmount: 0,
      taxAmount:      0,
      total:          0,
      lines:          [],
      status:         "DRAFT",
      priceListId:    "retail",
      shipping:       { methodId: "pickup", cost: 0, address: "", carrier: "" },
      discountGlobal: { type: "PERCENT", value: 0, reason: "" },
    };
    setDraft(blank);
    setIsNew(true);
    setEditorOpen(true);
  }

  function duplicate(q0: Quote) {
    const copy: Quote = {
      ...q0,
      id:     uid(),
      number: nextDocNumber("PR", quotes),
      date:   todayISO(),
      status: "DRAFT",
      lines:  q0.lines.map((l) => ({ ...l, id: uid() })),
    };
    setQuotes((prev) => [...prev, copy]);
    toast.success(`Presupuesto duplicado como ${copy.number}`);
  }

  function saveDraft() {
    if (!draft) return;

    // Validaciones (mínimas)
    if (!draft.client.trim())    { toast.error("El cliente es obligatorio."); return; }
    if (!draft.date)             { toast.error("La fecha es obligatoria.");  return; }
    if (!draft.currency.trim())  { toast.error("La moneda es obligatoria."); return; }
    if (draft.lines.length === 0) { toast.error("Agregá al menos una línea."); return; }

    for (const l of draft.lines) {
      if (l.quantity <= 0)      { toast.error(`La cantidad debe ser mayor a 0 (${l.article || "línea"}).`); return; }
      if (l.unitPrice < 0)      { toast.error(`El precio no puede ser negativo (${l.article || "línea"}).`); return; }
      if (l.discountAmount < 0) { toast.error(`El descuento no puede ser negativo (${l.article || "línea"}).`); return; }
    }

    const totals = recomputeTotals(draft.lines, draft.taxPercent, draft.discountGlobal, draft.shipping);

    const saved: Quote = { ...draft, ...totals };

    setQuotes((prev) => {
      const exists = prev.some((x) => x.id === saved.id);
      return exists ? prev.map((x) => (x.id === saved.id ? saved : x)) : [...prev, saved];
    });

    // TODO (Fase 6):
    // - conectar con el simulador real (resolveFinalSalePrice del pricing-engine)
    // - permitir combos comerciales (itemKind=COMBO con comboComponents)
    // - aplicar cupones (applyCouponAdjustment) — línea o header
    // - aplicar canales de venta (applySalesChannelAdjustment)
    // - aplicar medio de pago + cuotas (resolveCheckoutPrice)
    // - al aprobar → convertir a pedido/venta real, disparando onSaleConfirmed hook

    toast.success(isNew ? `Presupuesto ${saved.number} creado` : `Presupuesto ${saved.number} actualizado`);
    setEditorOpen(false);
    setDraft(null);
  }

  // ── Row actions ──────────────────────────────────────────────────────────
  function rowActions(qt: Quote): TPActionsMenuItem[] {
    return [
      {
        label: "Ver",
        icon: <Eye size={14} />,
        onClick: () => toast.info(`Ver ${qt.number} — próximamente`),
      },
      {
        label: "Editar",
        icon: <Pencil size={14} />,
        onClick: () => toast.info(`Editar ${qt.number} — próximamente`),
      },
      {
        label: "Duplicar",
        icon: <Copy size={14} />,
        onClick: () => duplicate(qt),
      },
      { type: "separator" },
      {
        label: "Marcar como aprobado",
        icon: <CheckCircle2 size={14} />,
        onClick: () => toast.info(`Aprobar ${qt.number} — próximamente`),
      },
      {
        label: "Convertir a pedido",
        icon: <ArrowRight size={14} />,
        // TODO (Fase 6): convertir a venta real vía onSaleConfirmed del pricing-engine.
        onClick: () => toast.info(`Convertir ${qt.number} a pedido — próximamente`),
      },
    ];
  }

  // ── Render row ───────────────────────────────────────────────────────────
  function renderRow(
    r: Quote,
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
      items:  <TPTd className="text-right tabular-nums">{itemsCount(r)}</TPTd>,
      total:  <TPTd className="text-right tabular-nums font-semibold">{fmtMoney(r.total, r.currency)}</TPTd>,
      status: <TPTd><TPStatusBadge status={r.status} /></TPTd>,
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

  // ── Filtros de header ────────────────────────────────────────────────────
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
      title="Presupuestos"
      subtitle="Cotizaciones a clientes"
      right={
        <TPButton variant="primary" onClick={openNew} iconLeft={<Plus size={14} />}>
          Nuevo presupuesto
        </TPButton>
      }
    >
      <div className="space-y-4">
        <TPKpiBar items={kpis} columns={5} />

        <TPTableKit<Quote>
          rows={filtered}
          columns={COLS}
          storageKey="tp_sales_quotes_cols"
          search={{
            value: q,
            onChange: setQ,
            placeholder: "Buscar por número o cliente…",
            debounceMs: 150,
          }}
          sortPersistKey="tp_sales_quotes"
          columnPicker
          headerLeft={filters}
          countLabel={(n) => `${n} ${n === 1 ? "presupuesto" : "presupuestos"}`}
          emptyText={
            q || statusFilter !== "ALL" || clientFilter !== "ALL"
              ? "Sin resultados con los filtros aplicados."
              : "Todavía no hay presupuestos. Creá el primero desde «Nuevo presupuesto»."
          }
          renderRow={renderRow}
        />
      </div>

      {draft && (
        <QuoteEditorModal
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
// Modal del editor (estilo simulador)
// ─────────────────────────────────────────────────────────────────────────────

function QuoteEditorModal(props: {
  open: boolean;
  draft: Quote;
  isNew: boolean;
  onChange: (next: Quote) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const { open, draft, isNew, onChange, onSave, onClose } = props;

  function patch<K extends keyof Quote>(key: K, value: Quote[K]) {
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
      {
        id: uid(),
        article: "",
        variant: "",
        quantity: 1,
        unitPrice: 0,
        discountAmount: 0,
        subtotal: 0,
      },
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
      title={isNew ? "Nuevo presupuesto" : `Editar presupuesto ${draft.number}`}
      subtitle={`Número ${draft.number}`}
      maxWidth="7xl"
      className="!max-w-[1500px] w-[96vw]"
      resizable
      maximizable
      maximizedMode="embedded"
      modalKey="ventas-presupuestos-editor"
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
        {/* ── Header compacto: cliente + fecha + moneda + cotización + lista + IVA ── */}
        <TPCard
          title="Datos del presupuesto"
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
                placeholder="Notas internas o mensaje para el cliente"
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
                Total del presupuesto
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

