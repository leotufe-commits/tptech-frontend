// src/pages/DashboardRentabilidad.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Minus,
  Percent,
  AlertTriangle,
  RefreshCw,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

import { TPCard } from "../components/ui/TPCard";
import { dashboardProfitApi, type ProfitGroupBy, type ProfitSummary } from "../services/dashboard-profit";
import { fmtNumber2 } from "../lib/format";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(dateStr: string, groupBy: ProfitGroupBy): string {
  if (groupBy === "month") {
    const [y, m] = dateStr.split("-");
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    return `${months[parseInt(m, 10) - 1]} ${y}`;
  }
  // day or week — show "15 Mar"
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

function fmtPct(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}

function fmtShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (abs >= 1_000) return (n / 1_000).toFixed(0) + "k";
  return fmtNumber2(n);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type QuickRange = { label: string; from: string };

type SortKey = "margin" | "revenue" | "cost" | "marginPercent" | "quantity";

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: "blue" | "gray" | "green" | "red" | "amber";
}) {
  const colorMap = {
    blue:  { bg: "bg-blue-50 dark:bg-blue-900/20",   text: "text-blue-600 dark:text-blue-400",   icon: "text-blue-500" },
    gray:  { bg: "bg-gray-100 dark:bg-gray-800/40",  text: "text-gray-700 dark:text-gray-300",   icon: "text-gray-500" },
    green: { bg: "bg-green-50 dark:bg-green-900/20", text: "text-green-700 dark:text-green-400", icon: "text-green-500" },
    red:   { bg: "bg-red-50 dark:bg-red-900/20",     text: "text-red-700 dark:text-red-400",     icon: "text-red-500" },
    amber: { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400", icon: "text-amber-500" },
  };
  const c = colorMap[color];

  return (
    <TPCard>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted uppercase tracking-wide">{label}</p>
          <p className={`mt-1 text-2xl font-bold ${c.text}`}>{value}</p>
          {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${c.bg} ${c.icon} shrink-0`}>
          {icon}
        </div>
      </div>
    </TPCard>
  );
}

function SortHeader({
  label, sortKey, currentKey, dir, onSort,
}: {
  label: string; sortKey: SortKey; currentKey: SortKey; dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
}) {
  const active = sortKey === currentKey;
  return (
    <button
      className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-text transition select-none"
      onClick={() => onSort(sortKey)}
    >
      {label}
      {active ? (
        dir === "desc" ? <ChevronDown size={12} /> : <ChevronUp size={12} />
      ) : (
        <ChevronDown size={12} className="opacity-30" />
      )}
    </button>
  );
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, groupBy }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg px-3 py-2.5 text-sm min-w-[160px]">
      <p className="text-xs text-muted font-medium mb-1.5">
        {formatDateLabel(label, groupBy)}
      </p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span style={{ color: p.color }} className="font-medium">{p.name}</span>
          <span className="font-semibold text-text">${fmtNumber2(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardRentabilidad() {
  // Filters
  const [from, setFrom]     = useState(daysAgoStr(29));
  const [to, setTo]         = useState(todayStr);
  const [groupBy, setGroupBy] = useState<ProfitGroupBy>("day");

  // Data
  const [data, setData]     = useState<ProfitSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  // Table sort
  const [sortKey, setSortKey]   = useState<SortKey>("margin");
  const [sortDir, setSortDir]   = useState<"asc" | "desc">("desc");

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardProfitApi.get({ from, to, groupBy });
      setData(res.data);
    } catch (e: any) {
      setError(e?.message ?? "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [from, to, groupBy]);

  useEffect(() => { fetch(); }, [fetch]);

  // ── Quick ranges ─────────────────────────────────────────────────────────
  const quickRanges: QuickRange[] = useMemo(() => [
    { label: "7d",  from: daysAgoStr(6)   },
    { label: "30d", from: daysAgoStr(29)  },
    { label: "90d", from: daysAgoStr(89)  },
    { label: "1a",  from: daysAgoStr(364) },
  ], []);

  function applyQuick(r: QuickRange) {
    setFrom(r.from);
    setTo(todayStr());
  }

  // ── Sort handler ─────────────────────────────────────────────────────────
  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const sortedArticles = useMemo(() => {
    if (!data) return [];
    return [...data.topArticles].sort((a, b) => {
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [data, sortKey, sortDir]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const totals = data?.totals;
  const marginColor = (totals?.margin ?? 0) >= 0 ? "green" : "red";

  // ── Chart: add formatted date label for X axis ────────────────────────────
  const chartData = useMemo(
    () => (data?.series ?? []).map((p) => ({
      ...p,
      label: formatDateLabel(p.date, groupBy),
    })),
    [data, groupBy]
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Reportes</p>
          <h1 className="text-2xl font-bold text-text">Rentabilidad</h1>
          <p className="text-sm text-muted mt-0.5">
            Ingresos, costos y márgenes de ventas confirmadas.
          </p>
        </div>

        {/* Refresh */}
        <button
          onClick={fetch}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-text transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {/* ── Filters ── */}
      <TPCard>
        <div className="flex flex-wrap items-end gap-4">
          {/* Quick ranges */}
          <div className="flex items-center gap-1.5">
            {quickRanges.map((r) => (
              <button
                key={r.label}
                onClick={() => applyQuick(r)}
                className={[
                  "px-3 py-1 rounded-lg text-sm font-medium transition",
                  from === r.from && to === todayStr()
                    ? "bg-primary text-white"
                    : "bg-surface2 text-muted hover:text-text",
                ].join(" ")}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-muted whitespace-nowrap">Desde</label>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="text-sm border border-border rounded-lg px-2.5 py-1.5 bg-card text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-muted whitespace-nowrap">Hasta</label>
            <input
              type="date"
              value={to}
              min={from}
              max={todayStr()}
              onChange={(e) => setTo(e.target.value)}
              className="text-sm border border-border rounded-lg px-2.5 py-1.5 bg-card text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-muted whitespace-nowrap">Agrupar por</label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as ProfitGroupBy)}
              className="text-sm border border-border rounded-lg px-2.5 py-1.5 bg-card text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="day">Día</option>
              <option value="week">Semana</option>
              <option value="month">Mes</option>
            </select>
          </div>
        </div>
      </TPCard>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle size={15} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ── KPI Cards ── */}
      {(loading || totals) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Ingresos"
            value={loading ? "—" : `$${fmtShort(totals!.revenue)}`}
            sub={loading ? undefined : `${totals!.linesCount} líneas de venta`}
            icon={<DollarSign size={18} />}
            color="blue"
          />
          <KpiCard
            label="Costos"
            value={loading ? "—" : `$${fmtShort(totals!.cost)}`}
            sub={loading
              ? undefined
              : totals!.linesWithoutCost > 0
                ? `${totals!.linesWithoutCost} líneas sin costo`
                : `${totals!.linesWithCost} líneas con costo`}
            icon={<Minus size={18} />}
            color="gray"
          />
          <KpiCard
            label="Margen"
            value={loading ? "—" : `$${fmtShort(totals!.margin)}`}
            sub={loading ? undefined : `Neto sobre ventas confirmadas`}
            icon={(totals?.margin ?? 0) >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            color={loading ? "gray" : marginColor}
          />
          <KpiCard
            label="% Margen"
            value={loading ? "—" : fmtPct(totals!.marginPercent)}
            sub={loading
              ? undefined
              : totals!.linesWithoutCost > 0
                ? "Estimado (hay líneas sin costo)"
                : "Sobre ingresos netos"}
            icon={<Percent size={18} />}
            color={loading ? "gray" : (totals?.marginPercent ?? 0) >= 0 ? "green" : "red"}
          />
        </div>
      )}

      {/* ── Gráfico ── */}
      <TPCard>
        <h2 className="text-sm font-semibold text-text mb-4">Evolución temporal</h2>

        {loading && (
          <div className="flex items-center justify-center h-64 text-muted text-sm">
            Cargando…
          </div>
        )}

        {!loading && chartData.length === 0 && (
          <div className="flex items-center justify-center h-64 text-muted text-sm">
            Sin ventas confirmadas en el período seleccionado.
          </div>
        )}

        {!loading && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="grad-revenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id="grad-cost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6b7280" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#6b7280" stopOpacity={0.01} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />

              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--color-muted)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `$${fmtShort(v)}`}
                tick={{ fontSize: 11, fill: "var(--color-muted)" }}
                axisLine={false}
                tickLine={false}
                width={60}
              />

              <Tooltip content={<ChartTooltip groupBy={groupBy} />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
              />

              <Area
                type="monotone"
                dataKey="revenue"
                name="Ingresos"
                stroke="#2563eb"
                strokeWidth={2}
                fill="url(#grad-revenue)"
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="cost"
                name="Costos"
                stroke="#9ca3af"
                strokeWidth={2}
                fill="url(#grad-cost)"
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="margin"
                name="Margen"
                stroke="#16a34a"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </TPCard>

      {/* ── Top Artículos ── */}
      <TPCard>
        <h2 className="text-sm font-semibold text-text mb-4">
          Top artículos por rentabilidad
          {data && <span className="ml-2 font-normal text-muted">({sortedArticles.length})</span>}
        </h2>

        {loading && (
          <p className="text-sm text-muted text-center py-6">Cargando…</p>
        )}

        {!loading && sortedArticles.length === 0 && (
          <p className="text-sm text-muted text-center py-6">
            Sin datos para el período seleccionado.
          </p>
        )}

        {!loading && sortedArticles.length > 0 && (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted w-[30%]">
                    Producto
                  </th>
                  <th className="text-right px-3 py-2">
                    <SortHeader label="Uds." sortKey="quantity"      currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-right px-3 py-2">
                    <SortHeader label="Ingresos"  sortKey="revenue"  currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-right px-3 py-2">
                    <SortHeader label="Costos"    sortKey="cost"     currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-right px-3 py-2">
                    <SortHeader label="Margen $"  sortKey="margin"   currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-right px-3 py-2">
                    <SortHeader label="Margen %"  sortKey="marginPercent" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedArticles.map((art, i) => {
                  const isNeg = art.margin < 0;
                  return (
                    <tr
                      key={art.articleId}
                      className={[
                        "border-b border-border/50 transition-colors hover:bg-surface2",
                        isNeg ? "bg-red-50/40 dark:bg-red-900/10" : "",
                      ].join(" ")}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted w-5 shrink-0 text-right">{i + 1}</span>
                          <span className="font-medium text-text truncate max-w-[200px]" title={art.articleName}>
                            {art.articleName}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-muted">
                        {Number(art.quantity).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2.5 text-right text-text">
                        ${fmtNumber2(art.revenue)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-muted">
                        {art.cost > 0 ? `$${fmtNumber2(art.cost)}` : <span className="text-amber-500">Sin dato</span>}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-semibold ${isNeg ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>
                        ${fmtNumber2(art.margin)}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-medium ${isNeg ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>
                        {art.cost > 0 ? fmtPct(art.marginPercent) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </TPCard>

      {/* ── Alertas ── */}
      {data && (totals!.linesWithoutCost > 0 || totals!.salesWithNegativeMargin > 0) && (
        <TPCard>
          <h2 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-500" />
            Alertas
          </h2>
          <div className="space-y-2">
            {totals!.linesWithoutCost > 0 && (
              <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>
                  <strong>{totals!.linesWithoutCost}</strong> líneas sin costo registrado.
                  El margen real puede ser distinto al mostrado. Completá el costo de esos artículos para obtener datos exactos.
                </span>
              </div>
            )}
            {totals!.salesWithNegativeMargin > 0 && (
              <div className="flex items-start gap-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
                <TrendingDown size={14} className="shrink-0 mt-0.5" />
                <span>
                  <strong>{totals!.salesWithNegativeMargin}</strong> {totals!.salesWithNegativeMargin === 1 ? "venta" : "ventas"} con margen negativo
                  ({totals!.linesNegativeMargin} {totals!.linesNegativeMargin === 1 ? "línea" : "líneas"}).
                  Revisá los precios de venta y costos de esos artículos.
                </span>
              </div>
            )}
          </div>
        </TPCard>
      )}

      {/* Nota footer */}
      <p className="text-xs text-muted text-center pb-2">
        Los datos reflejan únicamente ventas confirmadas con snapshots de costo al momento de la confirmación.
        Ventas en borrador y artículos sin costo configurado no están incluidos en los totales de margen.
      </p>
    </div>
  );
}
