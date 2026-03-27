// src/pages/Caja.tsx
import React, { useCallback, useEffect, useState } from "react";
import { ArrowDownCircle, BanknoteIcon, CalendarDays, Clock, CreditCard, RefreshCw } from "lucide-react";

import TPSectionShell from "../components/ui/TPSectionShell";
import TPInput from "../components/ui/TPInput";
import { TPButton } from "../components/ui/TPButton";
import { TPTableKit, type TPColDef } from "../components/ui/TPTableKit";
import { TPTd, TPTr } from "../components/ui/TPTable";

import { salesApi, type CajaDaySummary, type CajaPaymentRow, SALE_STATUS_LABELS } from "../services/sales";
import { toast } from "../lib/toast";

/* ──────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────── */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmt(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

/* ──────────────────────────────────────────────────────────
   Column definitions
────────────────────────────────────────────────────────── */
const COLS: TPColDef[] = [
  { key: "hora",    label: "Hora",    canHide: false, sortKey: "paidAt" },
  { key: "venta",   label: "Venta",   canHide: false, sortKey: "saleCode" },
  { key: "metodo",  label: "Método",  sortKey: "paymentMethodName" },
  { key: "ref",     label: "Referencia" },
  { key: "monto",   label: "Monto",   canHide: false, sortKey: "amount", align: "right" },
];

/* ──────────────────────────────────────────────────────────
   Summary card
────────────────────────────────────────────────────────── */
function SummaryCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border px-4 py-3 flex flex-col gap-0.5">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-xl font-bold tabular-nums ${color ?? "text-text"}`}>{value}</span>
      {sub && <span className="text-xs text-muted opacity-70">{sub}</span>}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Page
────────────────────────────────────────────────────────── */
export default function Caja() {
  const [date, setDate] = useState(todayStr());
  const [summary, setSummary] = useState<CajaDaySummary | null>(null);
  const [loading, setLoading] = useState(false);

  // Table state
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState("paidAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const loadData = useCallback(async (d: string) => {
    setLoading(true);
    try {
      const data = await salesApi.caja(d);
      setSummary(data);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al cargar caja.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(date);
  }, [date, loadData]);

  // Filter + sort payments
  const filteredPayments: CajaPaymentRow[] = React.useMemo(() => {
    if (!summary) return [];
    let rows = summary.payments;
    if (q) {
      const lq = q.toLowerCase();
      rows = rows.filter(
        (p) =>
          p.saleCode.toLowerCase().includes(lq) ||
          p.paymentMethodName.toLowerCase().includes(lq) ||
          p.reference.toLowerCase().includes(lq)
      );
    }
    rows = [...rows].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      if (sortKey === "paidAt") { av = a.paidAt; bv = b.paidAt; }
      else if (sortKey === "saleCode") { av = a.saleCode; bv = b.saleCode; }
      else if (sortKey === "paymentMethodName") { av = a.paymentMethodName; bv = b.paymentMethodName; }
      else if (sortKey === "amount") { av = parseFloat(a.amount); bv = parseFloat(b.amount); }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [summary, q, sortKey, sortDir]);

  return (
    <TPSectionShell
      title="Caja del día"
      subtitle="Resumen de cobros por método de pago"
      icon={<BanknoteIcon className="w-5 h-5" />}
    >
      {/* ── Date picker ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="w-4 h-4 text-muted opacity-50" />
          <TPInput
            type="date"
            value={date}
            onChange={(v) => setDate(v)}
            className="w-44"
          />
        </div>
        <TPButton
          variant="secondary"
          onClick={() => setDate(todayStr())}
          disabled={date === todayStr()}
        >
          Hoy
        </TPButton>
        <TPButton
          variant="ghost"
          onClick={() => loadData(date)}
          loading={loading}
        >
          <RefreshCw className="w-4 h-4" />
        </TPButton>
      </div>

      {/* ── Summary cards ──────────────────────────────────────── */}
      {summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <SummaryCard
              label="Ventas del día"
              value={String(summary.salesCount)}
              sub="no canceladas"
            />
            <SummaryCard
              label="Total facturado"
              value={`$${fmt(summary.totalSalesAmount)}`}
            />
            <SummaryCard
              label="Total cobrado"
              value={`$${fmt(summary.totalPaid)}`}
              color="text-green-600"
            />
            <SummaryCard
              label="Pendiente de cobro"
              value={`$${fmt(summary.totalPending)}`}
              color={summary.totalPending > 0 ? "text-yellow-600" : "text-text"}
            />
          </div>

          {/* ── By method ──────────────────────────────────────── */}
          {summary.paymentsByMethod.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-text mb-2 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-muted opacity-60" />
                Cobros por método
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {summary.paymentsByMethod.map((m) => (
                  <div
                    key={m.paymentMethodName}
                    className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-text">{m.paymentMethodName}</p>
                      <p className="text-xs text-muted opacity-70">
                        {m.count} cobro{m.count !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <p className="text-base font-bold tabular-nums text-text">
                      ${fmt(m.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Payments list ──────────────────────────────────── */}
          <h3 className="text-sm font-semibold text-text mb-2 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-muted opacity-60" />
            Detalle de cobros
          </h3>
          <TPTableKit
            rows={filteredPayments}
            columns={COLS}
            storageKey="tptech_col_caja"
            search={q}
            onSearchChange={setQ}
            searchPlaceholder="Buscar por venta, método…"
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={toggleSort}
            emptyText={loading ? "Cargando…" : "No hay cobros en esta fecha."}
            countLabel="cobros"
            renderRow={(row: CajaPaymentRow, vis) => (
              <TPTr key={row.id}>
                {vis.hora   && <TPTd className="text-xs text-muted tabular-nums">{fmtTime(row.paidAt)}</TPTd>}
                {vis.venta  && (
                  <TPTd>
                    <span className="font-medium text-sm">{row.saleCode}</span>
                    {row.saleStatus && (
                      <span className="ml-2 text-xs text-muted opacity-60">
                        {SALE_STATUS_LABELS[row.saleStatus as keyof typeof SALE_STATUS_LABELS] ?? row.saleStatus}
                      </span>
                    )}
                  </TPTd>
                )}
                {vis.metodo && <TPTd className="text-sm">{row.paymentMethodName}</TPTd>}
                {vis.ref    && <TPTd className="text-xs text-muted">{row.reference || "—"}</TPTd>}
                {vis.monto  && (
                  <TPTd className="text-right font-semibold tabular-nums text-sm">
                    ${fmt(parseFloat(row.amount))}
                  </TPTd>
                )}
              </TPTr>
            )}
          />
        </>
      )}

      {!summary && !loading && (
        <div className="py-10 text-center text-muted opacity-60">
          <ArrowDownCircle className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">Seleccioná una fecha para ver el resumen.</p>
        </div>
      )}
    </TPSectionShell>
  );
}
