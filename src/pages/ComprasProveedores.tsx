// src/pages/ComprasProveedores.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ShoppingBag,
  Plus,
  CheckCircle,
  XCircle,
  CreditCard,
  Coins,
  Trash2,
  Eye,
} from "lucide-react";
import { toast } from "../lib/toast";
import { cn } from "../components/ui/tp";

import { TPSectionShell } from "../components/ui/TPSectionShell";
import { TPTableKit, type TPColDef } from "../components/ui/TPTableKit";
import { TPButton } from "../components/ui/TPButton";
import TPInput from "../components/ui/TPInput";
import { TPField } from "../components/ui/TPField";
import TPNumberInput from "../components/ui/TPNumberInput";
import TPSelect from "../components/ui/TPSelect";
import TPTextarea from "../components/ui/TPTextarea";
import { Modal } from "../components/ui/Modal";
import ConfirmDeleteDialog from "../components/ui/ConfirmDeleteDialog";
import { TPTr, TPTd } from "../components/ui/TPTable";
import { TPRowActions } from "../components/ui/TPRowActions";
import { TPActionsMenu, type TPActionsMenuItem } from "../components/ui/TPActionsMenu";
import TPCard from "../components/ui/TPCard";
import EntitySearchSelect from "../components/ui/EntitySearchSelect";
import ArticleSearchSelect from "../components/ui/ArticleSearchSelect";

import type { EntityRow } from "../services/commercial-entities";
import type { ArticleRow } from "../services/articles";
import {
  purchasesService,
  type PurchaseRow,
  type PurchaseDetail,
  type PurchaseStatus,
  type PaymentComponentInput,
} from "../services/purchases";
import { getCurrencies, type CurrencyRow } from "../services/valuation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtMoney(v: string | number | null | undefined): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-AR");
}

const STATUS_LABELS: Record<PurchaseStatus, string> = {
  DRAFT:         "Borrador",
  CONFIRMED:     "Confirmada",
  PARTIALLY_PAID:"Pago parcial",
  PAID:          "Pagada",
  CANCELLED:     "Cancelada",
};

function StatusBadge({ status }: { status: PurchaseStatus }) {
  const classes: Record<PurchaseStatus, string> = {
    DRAFT:         "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
    CONFIRMED:     "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    PARTIALLY_PAID:"bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    PAID:          "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    CANCELLED:     "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", classes[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Column defs
// ---------------------------------------------------------------------------

const COLS: TPColDef[] = [
  { key: "code",     label: "Nro.",        canHide: false },
  { key: "date",     label: "Fecha" },
  { key: "supplier", label: "Proveedor",   canHide: false },
  { key: "total",    label: "Total",       align: "right" },
  { key: "paid",     label: "Pagado",      align: "right" },
  { key: "status",   label: "Estado" },
];

// ---------------------------------------------------------------------------
// Draft line type
// ---------------------------------------------------------------------------

type DraftLine = {
  key: string;
  articleId: string | null;
  variantId: string | null;
  articleName: string;
  quantity: number;
  unitCost: number;
  discountPct: number;
};

function lineTotal(line: DraftLine): number {
  return line.quantity * line.unitCost * (1 - line.discountPct / 100);
}

function newLine(): DraftLine {
  return {
    key: crypto.randomUUID(),
    articleId: null,
    variantId: null,
    articleName: "",
    quantity: 1,
    unitCost: 0,
    discountPct: 0,
  };
}

// ---------------------------------------------------------------------------
// Payment component draft
// ---------------------------------------------------------------------------

type DraftMoneyComp = {
  key: string;
  componentType: "MONEY";
  amount: number;
  currency: string;
};

type DraftMetalComp = {
  key: string;
  componentType: "METAL";
  metalId: string;
  variantId: string;
  gramsOriginal: number;
  purity: number;
  gramsPure: number;
};

type DraftComponent = DraftMoneyComp | DraftMetalComp;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ComprasProveedores() {
  // ── State: list ─────────────────────────────────────────────────────────
  const [rows, setRows]       = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ]             = useState("");

  // ── State: create modal ──────────────────────────────────────────────────
  const [showCreate, setShowCreate]             = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<EntityRow | null>(null);
  const [purchaseDate, setPurchaseDate]         = useState("");
  const [notes, setNotes]                       = useState("");
  const [draftLines, setDraftLines]             = useState<DraftLine[]>([newLine()]);
  const [saving, setSaving]                     = useState(false);

  // ── State: detail modal ──────────────────────────────────────────────────
  const [detail, setDetail]               = useState<PurchaseDetail | null>(null);
  const [showDetail, setShowDetail]       = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // ── State: cancel modal ──────────────────────────────────────────────────
  const [cancelId, setCancelId]     = useState<string | null>(null);
  const [cancelNote, setCancelNote] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // ── State: payment modal ─────────────────────────────────────────────────
  const [showPayment, setShowPayment]               = useState(false);
  const [paymentSupplierId, setPaymentSupplierId]   = useState<string | null>(null);
  const [paymentPurchaseId, setPaymentPurchaseId]   = useState<string | null>(null);
  const [paymentNote, setPaymentNote]               = useState("");
  const [paymentComponents, setPaymentComponents]   = useState<DraftComponent[]>([
    { key: crypto.randomUUID(), componentType: "MONEY", amount: 0, currency: "ARS" },
  ]);
  const [paymentSaving, setPaymentSaving] = useState(false);

  // ── Currencies ───────────────────────────────────────────────────────────
  const [currencies, setCurrencies] = useState<CurrencyRow[]>([]);

  useEffect(() => {
    getCurrencies().then((res: any) => setCurrencies(Array.isArray(res) ? res : (res?.rows ?? []))).catch(() => {});
  }, []);

  const baseCurrencyCode = currencies.find((c) => c.isBase)?.code ?? "ARS";

  // ── Load list ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await purchasesService.list({ take: 100 });
      setRows(r.items);
    } catch {
      toast.error("No se pudieron cargar las compras.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Filtered rows ────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    if (!q) return rows;
    const lq = q.toLowerCase();
    return rows.filter(
      (r) =>
        r.code.toLowerCase().includes(lq) ||
        r.supplier.displayName.toLowerCase().includes(lq)
    );
  }, [rows, q]);

  // ── Create ───────────────────────────────────────────────────────────────
  function openCreate() {
    setSelectedSupplier(null);
    setPurchaseDate("");
    setNotes("");
    setDraftLines([newLine()]);
    setShowCreate(true);
  }

  async function handleCreate() {
    if (!selectedSupplier) { toast.error("Seleccioná un proveedor."); return; }
    const validLines = draftLines.filter((l) => l.quantity > 0 && l.unitCost > 0);
    if (!validLines.length) { toast.error("Ingresá al menos una línea válida."); return; }

    setSaving(true);
    try {
      await purchasesService.create({
        supplierId: selectedSupplier.id,
        purchaseDate: purchaseDate || undefined,
        notes,
        lines: validLines.map((l) => ({
          articleId: l.articleId,
          variantId: l.variantId,
          quantity: l.quantity,
          unitCost: l.unitCost,
          discountPct: l.discountPct,
        })),
      });
      toast.success("Compra creada como borrador.");
      setShowCreate(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Error al crear la compra.");
    } finally {
      setSaving(false);
    }
  }

  // ── Confirm ──────────────────────────────────────────────────────────────
  async function handleConfirm(id: string) {
    try {
      await purchasesService.confirm(id);
      toast.success("Compra confirmada.");
      load();
      if (detail?.id === id) {
        const updated = await purchasesService.get(id);
        setDetail(updated);
      }
    } catch (e: any) {
      toast.error(e?.message || "Error al confirmar.");
    }
  }

  // ── Cancel ───────────────────────────────────────────────────────────────
  function openCancel(id: string) {
    setCancelId(id);
    setCancelNote("");
  }

  async function handleCancel() {
    if (!cancelId) return;
    setCancelling(true);
    try {
      await purchasesService.cancel(cancelId, cancelNote);
      toast.success("Compra cancelada.");
      setCancelId(null);
      load();
      if (detail?.id === cancelId) setShowDetail(false);
    } catch (e: any) {
      toast.error(e?.message || "Error al cancelar.");
    } finally {
      setCancelling(false);
    }
  }

  // ── Detail ───────────────────────────────────────────────────────────────
  async function openDetail(id: string) {
    setShowDetail(true);
    setLoadingDetail(true);
    try {
      const d = await purchasesService.get(id);
      setDetail(d);
    } catch {
      toast.error("No se pudo cargar el detalle.");
      setShowDetail(false);
    } finally {
      setLoadingDetail(false);
    }
  }

  // ── Payment modal ────────────────────────────────────────────────────────
  function openPayment(suppId: string, purchId: string | null) {
    setPaymentSupplierId(suppId);
    setPaymentPurchaseId(purchId);
    setPaymentNote("");
    setPaymentComponents([
      { key: crypto.randomUUID(), componentType: "MONEY", amount: 0, currency: baseCurrencyCode },
    ]);
    setShowPayment(true);
  }

  function updateMoneyComp(key: string, patch: Partial<DraftMoneyComp>) {
    setPaymentComponents((prev) =>
      prev.map((c) => (c.key === key && c.componentType === "MONEY" ? { ...c, ...patch } : c))
    );
  }

  function updateMetalComp(key: string, patch: Partial<DraftMetalComp>) {
    setPaymentComponents((prev) =>
      prev.map((c) => (c.key === key && c.componentType === "METAL" ? { ...c, ...patch } : c))
    );
  }

  async function handleRegisterPayment() {
    if (!paymentSupplierId) return;
    const valid = paymentComponents.filter((c) => {
      if (c.componentType === "MONEY") return c.amount > 0;
      return (c as DraftMetalComp).metalId && (c as DraftMetalComp).gramsPure > 0;
    });
    if (!valid.length) { toast.error("Ingresá al menos un componente válido."); return; }

    setPaymentSaving(true);
    try {
      const components: PaymentComponentInput[] = valid.map((c) => {
        if (c.componentType === "MONEY") {
          return { componentType: "MONEY", amount: c.amount, currency: c.currency };
        }
        const m = c as DraftMetalComp;
        return {
          componentType: "METAL",
          metalId: m.metalId,
          variantId: m.variantId,
          gramsOriginal: m.gramsOriginal,
          purity: m.purity,
          gramsPure: m.gramsPure,
        };
      });

      await purchasesService.registerPayment(paymentSupplierId, {
        purchaseId: paymentPurchaseId,
        note: paymentNote,
        components,
      });

      toast.success("Pago registrado correctamente.");
      setShowPayment(false);
      load();
      if (detail && paymentPurchaseId === detail.id) {
        const updated = await purchasesService.get(detail.id);
        setDetail(updated);
      }
    } catch (e: any) {
      toast.error(e?.message || "Error al registrar el pago.");
    } finally {
      setPaymentSaving(false);
    }
  }

  // ── Line helpers ─────────────────────────────────────────────────────────
  function updateLine(key: string, patch: Partial<DraftLine>) {
    setDraftLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setDraftLines((prev) => prev.filter((l) => l.key !== key));
  }

  const draftSubtotal = draftLines.reduce((s, l) => s + lineTotal(l), 0);

  // ── Row actions builder ───────────────────────────────────────────────────
  function rowActions(row: PurchaseRow): TPActionsMenuItem[] {
    const items: TPActionsMenuItem[] = [
      { label: "Ver detalle", icon: <Eye size={14} />, onClick: () => openDetail(row.id) },
    ];
    if (row.status === "DRAFT") {
      items.push({
        label: "Confirmar compra",
        icon: <CheckCircle size={14} />,
        onClick: () => handleConfirm(row.id),
      });
    }
    if (row.status === "CONFIRMED" || row.status === "PARTIALLY_PAID") {
      items.push({
        label: "Registrar pago",
        icon: <CreditCard size={14} />,
        onClick: () => openPayment(row.supplier.id, row.id),
      });
    }
    if (!["CANCELLED", "PAID"].includes(row.status)) {
      items.push({ type: "separator" });
      items.push({
        label: "Cancelar compra",
        icon: <XCircle size={14} />,
        onClick: () => openCancel(row.id),
      });
    }
    return items;
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <TPSectionShell
      title="Compras a Proveedores"
      subtitle="Registrá compras, seguí el saldo y gestioná pagos"
      icon={<ShoppingBag size={22} />}
    >
      <TPTableKit
        rows={filteredRows}
        columns={COLS}
        storageKey="tptech_col_compras"
        search={q}
        onSearchChange={setQ}
        searchPlaceholder="Buscar por número o proveedor..."
        loading={loading}
        emptyText={q ? "Sin resultados." : "Todavía no hay compras registradas."}
        pagination
        countLabel={(n) => `${n} ${n === 1 ? "compra" : "compras"}`}
        actions={
          <TPButton variant="primary" iconLeft={<Plus size={16} />} onClick={openCreate}>
            Nueva compra
          </TPButton>
        }
        onRowClick={(row) => openDetail(row.id)}
        renderRow={(row, vis) => (
          <TPTr
            key={row.id}
            className={row.status === "CANCELLED" ? "opacity-50" : undefined}
          >
            {vis.code && (
              <TPTd>
                <span className="font-mono text-sm font-medium">{row.code}</span>
              </TPTd>
            )}
            {vis.date && (
              <TPTd className="hidden md:table-cell text-sm text-muted">
                {fmtDate(row.purchaseDate)}
              </TPTd>
            )}
            {vis.supplier && (
              <TPTd>
                <span className="text-sm">{row.supplier.displayName}</span>
              </TPTd>
            )}
            {vis.total && (
              <TPTd className="text-right">
                <span className="text-sm tabular-nums font-medium">${fmtMoney(row.total)}</span>
              </TPTd>
            )}
            {vis.paid && (
              <TPTd className="text-right hidden md:table-cell">
                <span className="text-sm tabular-nums text-muted">${fmtMoney(row.paidAmount)}</span>
              </TPTd>
            )}
            {vis.status && (
              <TPTd>
                <StatusBadge status={row.status} />
              </TPTd>
            )}
            <TPTd className="w-10" onClick={(e) => e.stopPropagation()}>
              <TPActionsMenu items={rowActions(row)} />
            </TPTd>
          </TPTr>
        )}
      />

      {/* ── Modal: Nueva compra ──────────────────────────────────────────── */}
      <Modal
        open={showCreate}
        onClose={() => !saving && setShowCreate(false)}
        title="Nueva compra"
        maxWidth="2xl"
        busy={saving}
        footer={
          <div className="flex gap-2 justify-end">
            <TPButton variant="ghost" onClick={() => setShowCreate(false)} disabled={saving}>
              Cancelar
            </TPButton>
            <TPButton
              variant="primary"
              onClick={handleCreate}
              disabled={saving || !selectedSupplier}
            >
              {saving ? "Guardando…" : "Guardar borrador"}
            </TPButton>
          </div>
        }
      >
        <div className="space-y-4">
          <TPCard title="Datos generales">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TPField label="Proveedor" required>
                <EntitySearchSelect
                  selected={selectedSupplier}
                  onSelect={(row) => setSelectedSupplier(row)}
                  onClear={() => setSelectedSupplier(null)}
                  role="supplier"
                  placeholder="Buscar proveedor…"
                />
              </TPField>
              <TPField label="Fecha de compra">
                <TPInput
                  type="date"
                  value={purchaseDate}
                  onChange={setPurchaseDate}
                />
              </TPField>
            </div>
            <TPField label="Notas" className="mt-3">
              <TPTextarea
                value={notes}
                onChange={setNotes}
                rows={2}
                placeholder="Referencia, remito, notas internas…"
              />
            </TPField>
          </TPCard>

          <TPCard title="Líneas de compra">
            <div className="space-y-3">
              {draftLines.map((line, idx) => (
                <div
                  key={line.key}
                  className="border border-border rounded-lg p-3 space-y-2 bg-surface"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted">Línea {idx + 1}</span>
                    {draftLines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        className="text-danger hover:text-danger/80 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <TPField label="Artículo (opcional)">
                      <ArticleSearchSelect
                        selected={null}
                        onSelect={(row: ArticleRow) =>
                          updateLine(line.key, { articleId: row.id, articleName: row.name })
                        }
                        onClear={() =>
                          updateLine(line.key, { articleId: null, articleName: "" })
                        }
                        placeholder="Buscar artículo…"
                      />
                    </TPField>
                    <TPField label="Descripción / nombre">
                      <TPInput
                        value={line.articleName}
                        onChange={(v) => updateLine(line.key, { articleName: v })}
                        placeholder="Nombre o descripción"
                      />
                    </TPField>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <TPField label="Cantidad">
                      <TPNumberInput
                        value={line.quantity}
                        onChange={(v) => updateLine(line.key, { quantity: v ?? 0 })}
                        min={0}
                        decimals={4}
                      />
                    </TPField>
                    <TPField label="Costo unitario ($)">
                      <TPNumberInput
                        value={line.unitCost}
                        onChange={(v) => updateLine(line.key, { unitCost: v ?? 0 })}
                        min={0}
                        decimals={4}
                      />
                    </TPField>
                    <TPField label="Descuento (%)">
                      <TPNumberInput
                        value={line.discountPct}
                        onChange={(v) => updateLine(line.key, { discountPct: v ?? 0 })}
                        min={0}
                        max={100}
                        decimals={2}
                      />
                    </TPField>
                  </div>
                  <div className="text-xs text-right text-muted">
                    Subtotal línea:{" "}
                    <span className="font-semibold text-text">${fmtMoney(lineTotal(line))}</span>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => setDraftLines((p) => [...p, newLine()])}
                className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
              >
                <Plus size={14} />
                Agregar línea
              </button>

              <div className="text-right text-sm font-semibold border-t border-border pt-2">
                Total: <span className="tabular-nums">${fmtMoney(draftSubtotal)}</span>
              </div>
            </div>
          </TPCard>
        </div>
      </Modal>

      {/* ── Modal: Detalle de compra ─────────────────────────────────────── */}
      <Modal
        open={showDetail}
        onClose={() => setShowDetail(false)}
        title={detail ? `Compra ${detail.code}` : "Cargando…"}
        maxWidth="2xl"
      >
        {loadingDetail && (
          <div className="py-8 text-center text-muted text-sm">Cargando…</div>
        )}
        {detail && !loadingDetail && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-[10px] uppercase text-muted font-semibold mb-1">Estado</p>
                <StatusBadge status={detail.status} />
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted font-semibold">Proveedor</p>
                <p className="font-medium">{detail.supplier.displayName}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted font-semibold">Fecha</p>
                <p>{fmtDate(detail.purchaseDate)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted font-semibold">Total</p>
                <p className="font-semibold tabular-nums">${fmtMoney(detail.total)}</p>
              </div>
            </div>

            {/* Líneas */}
            <TPCard title="Líneas">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] text-muted uppercase border-b border-border">
                    <th className="text-left pb-1">Artículo</th>
                    <th className="text-right pb-1">Cant.</th>
                    <th className="text-right pb-1">Costo unit.</th>
                    <th className="text-right pb-1">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.map((line) => (
                    <tr key={line.id} className="border-b border-border/40">
                      <td className="py-1.5">{line.articleName || "—"}</td>
                      <td className="text-right py-1.5 tabular-nums">
                        {parseFloat(line.quantity).toLocaleString("es-AR")}
                      </td>
                      <td className="text-right py-1.5 tabular-nums">
                        ${fmtMoney(line.unitCost)}
                      </td>
                      <td className="text-right py-1.5 tabular-nums font-medium">
                        ${fmtMoney(line.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="pt-2 text-right font-semibold text-sm">
                      Total compra:
                    </td>
                    <td className="pt-2 text-right font-bold tabular-nums">
                      ${fmtMoney(detail.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </TPCard>

            {/* Pagos */}
            {detail.payments.length > 0 && (
              <TPCard title="Pagos registrados">
                <div className="space-y-2">
                  {detail.payments.map((p) => (
                    <div key={p.id} className="border border-border rounded-lg p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted">{fmtDate(p.paymentDate)}</span>
                        {p.note && <span className="text-muted text-xs">{p.note}</span>}
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {p.components.map((c) => (
                          <div key={c.id} className="flex items-center gap-2 text-xs">
                            {c.componentType === "MONEY" ? (
                              <>
                                <CreditCard size={12} className="text-emerald-500" />
                                <span>Dinero: ${fmtMoney(c.amount)}</span>
                              </>
                            ) : (
                              <>
                                <Coins size={12} className="text-amber-500" />
                                <span>
                                  Metal: {parseFloat(c.gramsPure ?? "0").toFixed(4)} g puros
                                </span>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </TPCard>
            )}

            {/* Acciones */}
            {detail.status !== "CANCELLED" && detail.status !== "PAID" && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                {detail.status === "DRAFT" && (
                  <TPButton
                    variant="primary"
                    iconLeft={<CheckCircle size={16} />}
                    onClick={() => handleConfirm(detail.id)}
                  >
                    Confirmar compra
                  </TPButton>
                )}
                {(detail.status === "CONFIRMED" || detail.status === "PARTIALLY_PAID") && (
                  <TPButton
                    variant="secondary"
                    iconLeft={<CreditCard size={16} />}
                    onClick={() => openPayment(detail.supplier.id, detail.id)}
                  >
                    Registrar pago
                  </TPButton>
                )}
                <TPButton
                  variant="ghost"
                  iconLeft={<XCircle size={16} />}
                  onClick={() => { setShowDetail(false); openCancel(detail.id); }}
                >
                  Cancelar compra
                </TPButton>
              </div>
            )}

            {detail.status === "CANCELLED" && detail.cancelNote && (
              <p className="text-xs text-muted italic">
                Motivo de cancelación: {detail.cancelNote}
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* ── Modal: Cancelar compra ───────────────────────────────────────── */}
      {cancelId && (
        <Modal
          open={!!cancelId}
          onClose={() => !cancelling && setCancelId(null)}
          title="Cancelar compra"
          maxWidth="sm"
          busy={cancelling}
          footer={
            <div className="flex gap-2 justify-end">
              <TPButton variant="ghost" onClick={() => setCancelId(null)} disabled={cancelling}>
                Volver
              </TPButton>
              <TPButton variant="danger" onClick={handleCancel} disabled={cancelling}>
                {cancelling ? "Cancelando…" : "Sí, cancelar"}
              </TPButton>
            </div>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-muted">
              La compra pasará a estado CANCELADO. Si ya estaba confirmada, se revertirán los
              movimientos de saldo del proveedor.
            </p>
            <TPField label="Motivo (opcional)">
              <TPInput
                value={cancelNote}
                onChange={setCancelNote}
                placeholder="Ingresá el motivo…"
              />
            </TPField>
          </div>
        </Modal>
      )}

      {/* ── Modal: Registrar pago ────────────────────────────────────────── */}
      <Modal
        open={showPayment}
        onClose={() => !paymentSaving && setShowPayment(false)}
        title="Registrar pago al proveedor"
        maxWidth="lg"
        busy={paymentSaving}
        footer={
          <div className="flex gap-2 justify-end">
            <TPButton
              variant="ghost"
              onClick={() => setShowPayment(false)}
              disabled={paymentSaving}
            >
              Cancelar
            </TPButton>
            <TPButton
              variant="primary"
              onClick={handleRegisterPayment}
              disabled={paymentSaving}
            >
              {paymentSaving ? "Guardando…" : "Registrar pago"}
            </TPButton>
          </div>
        }
      >
        <div className="space-y-4">
          <TPField label="Nota (opcional)">
            <TPInput
              value={paymentNote}
              onChange={setPaymentNote}
              placeholder="Referencia de pago, observaciones…"
            />
          </TPField>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Componentes de pago</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPaymentComponents((prev) => [
                      ...prev,
                      { key: crypto.randomUUID(), componentType: "MONEY", amount: 0, currency: baseCurrencyCode },
                    ])
                  }
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 border border-border rounded px-2 py-1"
                >
                  <CreditCard size={12} />
                  + Dinero
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPaymentComponents((prev) => [
                      ...prev,
                      {
                        key: crypto.randomUUID(),
                        componentType: "METAL",
                        metalId: "",
                        variantId: "",
                        gramsOriginal: 0,
                        purity: 0.75,
                        gramsPure: 0,
                      } as DraftMetalComp,
                    ])
                  }
                  className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 border border-border rounded px-2 py-1"
                >
                  <Coins size={12} />
                  + Metal
                </button>
              </div>
            </div>

            {paymentComponents.map((comp) => (
              <div
                key={comp.key}
                className="border border-border rounded-lg p-3 space-y-2 bg-surface"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {comp.componentType === "MONEY" ? (
                      <>
                        <CreditCard size={14} className="text-emerald-500" />
                        Pago en dinero
                      </>
                    ) : (
                      <>
                        <Coins size={14} className="text-amber-500" />
                        Entrega de metal
                      </>
                    )}
                  </div>
                  {paymentComponents.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentComponents((prev) => prev.filter((c) => c.key !== comp.key))
                      }
                      className="text-danger hover:text-danger/80"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {comp.componentType === "MONEY" ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <TPField label="Importe">
                        <TPNumberInput
                          value={comp.amount}
                          onChange={(v) => updateMoneyComp(comp.key, { amount: v ?? 0 })}
                          min={0}
                          decimals={2}
                        />
                      </TPField>
                      <TPField label="Moneda">
                        <TPSelect
                          value={comp.currency}
                          onChange={(v) => updateMoneyComp(comp.key, { currency: v })}
                          options={currencies
                            .filter((c) => c.isActive)
                            .map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))}
                        />
                      </TPField>
                    </div>
                    {(() => {
                      const selCurr = currencies.find((c) => c.code === comp.currency);
                      if (selCurr && !selCurr.isBase && !selCurr.latestRate) {
                        return (
                          <p className="text-xs text-amber-400 mt-1">
                            {selCurr.code} no tiene cotización vigente. Sin ella el sistema no puede calcular el equivalente en moneda base, por lo que el total del pago quedará registrado sin conversión.
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <TPField label="Gramos originales">
                      <TPNumberInput
                        value={comp.gramsOriginal}
                        onChange={(v) => {
                          const gOrig = v ?? 0;
                          updateMetalComp(comp.key, {
                            gramsOriginal: gOrig,
                            gramsPure: parseFloat((gOrig * comp.purity).toFixed(6)),
                          });
                        }}
                        min={0}
                        decimals={4}
                      />
                    </TPField>
                    <TPField label="Pureza (ej: 0.75)">
                      <TPNumberInput
                        value={comp.purity}
                        onChange={(v) => {
                          const pur = v ?? 0;
                          updateMetalComp(comp.key, {
                            purity: pur,
                            gramsPure: parseFloat((comp.gramsOriginal * pur).toFixed(6)),
                          });
                        }}
                        min={0}
                        max={1}
                        decimals={4}
                      />
                    </TPField>
                    <TPField label="Gramos puros (calc.)">
                      <TPInput value={comp.gramsPure.toFixed(6)} onChange={() => {}} readOnly />
                    </TPField>
                    <TPField label="ID de metal">
                      <TPInput
                        value={comp.metalId}
                        onChange={(v) => updateMetalComp(comp.key, { metalId: v })}
                        placeholder="ID del metal…"
                      />
                    </TPField>
                  </div>
                )}
              </div>
            ))}

            {/* Resumen */}
            {paymentComponents.length > 0 && (
              <div className="text-xs text-muted space-y-0.5 border-t border-border pt-2">
                <p className="font-semibold text-text mb-1">Resumen:</p>
                {paymentComponents
                  .filter((c) => c.componentType === "MONEY" && (c as DraftMoneyComp).amount > 0)
                  .map((c) => (
                    <p key={c.key}>
                      💵 Dinero: ${fmtMoney((c as DraftMoneyComp).amount)} {(c as DraftMoneyComp).currency}
                    </p>
                  ))}
                {paymentComponents
                  .filter((c) => c.componentType === "METAL" && (c as DraftMetalComp).gramsPure > 0)
                  .map((c) => (
                    <p key={c.key}>
                      🔶 Metal: {(c as DraftMetalComp).gramsPure.toFixed(4)} g puros
                    </p>
                  ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </TPSectionShell>
  );
}
