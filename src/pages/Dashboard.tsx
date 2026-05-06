// tptech-frontend/src/pages/Dashboard.tsx
import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import { TPCard } from "../components/ui/TPCard";
import TPAlert from "../components/ui/TPAlert";
import { cn } from "../components/ui/tp";
import { apiFetch } from "../lib/api";
import { fmtNumber2, fmtMoney2 } from "../lib/format";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

type RangeKey = "7d" | "30d" | "90d" | "1y";

type DashboardSummary = {
  kpis: {
    baseCurrency: { code: string; symbol: string; name: string } | null;
    currenciesActiveCount: number;
    metalsActiveCount: number;
    warehousesActiveCount: number;
    users: { ACTIVE: number; PENDING: number; BLOCKED: number; total: number };
  };
  currencies: Array<{ id: string; code: string; name: string; symbol: string; isBase: boolean }>;
  metals: Array<{ id: string; name: string; symbol: string; sortOrder: number }>;
  variants: Array<{
    id: string; metalId: string; name: string; sku: string;
    purity: number; saleFactor: number; value: number | null;
  }>;
  series: {
    fx: Array<Record<string, any>>;
    metals: Array<Record<string, any>>;
  };
  activity: Array<{ id: string; action: string; success: boolean; createdAt: string; userId?: string }>;
  salesKpis?: {
    today: { revenue: number; ticketCount: number; avgTicket: number };
    month: { revenue: number; ticketCount: number; avgTicket: number };
    range: {
      revenue: number;
      ticketCount: number;
      margin: number | null;
      marginPercent: number | null;
      linesWithoutCost: number;
    };
  };
  salesSeries?: Array<{ date: string; revenue: number; margin: number | null }>;
  inventory?: {
    articlesActive: number;
    stockTrackedCount: number;
    outOfStockCount: number;
    topOutOfStock: Array<{ id: string; code: string; name: string }>;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function stableColorForKey(key: string) {
  const palette = [
    "#2563eb", "#16a34a", "#f59e0b", "#db2777",
    "#7c3aed", "#0ea5e9", "#ef4444", "#14b8a6", "#a3a3a3",
  ];
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

function getLatestValue(series: Array<Record<string, any>>, key: string): number | null {
  if (!series?.length) return null;
  for (let i = series.length - 1; i >= 0; i--) {
    const v = series[i]?.[key];
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Fill-forward: para cada key, si un punto no tiene valor, propaga
 * el último valor conocido. Así Recharts puede dibujar una línea continua
 * aunque el backend solo envíe puntos en los días con datos reales.
 */
function fillForwardSeries(
  series: Array<Record<string, any>>,
  keys: string[]
): Array<Record<string, any>> {
  const last: Record<string, number> = {};
  return series.map((point) => {
    const row: Record<string, any> = { date: point.date };
    for (const k of keys) {
      const raw = point[k];
      if (raw != null) {
        const n = Number(raw);
        if (Number.isFinite(n)) last[k] = n;
      }
      if (last[k] != null) row[k] = last[k];
    }
    return row;
  });
}

function fmtDateShort(v: string): string {
  const parts = String(v ?? "").split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : v;
}

function fmtYAxis(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })}M`;
  if (v >= 1_000) return `${(v / 1_000).toLocaleString("es-AR", { maximumFractionDigits: 0 })}k`;
  return v.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function fmtPct(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
}

const RANGE_LABEL: Record<RangeKey, string> = {
  "7d": "últimos 7 días",
  "30d": "últimos 30 días",
  "90d": "últimos 90 días",
  "1y": "último año",
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────────────────────

function Segmented({ value, onChange }: { value: RangeKey; onChange: (v: RangeKey) => void }) {
  const items: { k: RangeKey; label: string }[] = [
    { k: "7d", label: "7d" },
    { k: "30d", label: "30d" },
    { k: "90d", label: "90d" },
    { k: "1y", label: "1a" },
  ];
  return (
    <div className="inline-flex items-center rounded-xl border border-border bg-surface p-1 shadow-sm">
      {items.map((it) => (
        <button
          key={it.k}
          type="button"
          onClick={() => onChange(it.k)}
          aria-pressed={value === it.k}
          className={cn(
            "inline-flex min-w-[46px] items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold leading-none transition-all duration-150",
            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
            value === it.k
              ? "bg-primary text-white shadow-sm"
              : "text-muted hover:bg-white/5 hover:text-text"
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function NiceTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: any & { valueFormatter?: (k: string, v: number) => string }) {
  if (!active || !payload?.length) return null;
  const rows = [...payload].sort((a, b) => (b?.value ?? 0) - (a?.value ?? 0));
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
      <div className="text-xs font-semibold text-text">{label}</div>
      <div className="mt-2 space-y-1">
        {rows.map((p: any) => {
          const name = String(p.name ?? "");
          const v = Number(p.value);
          const txt = valueFormatter ? valueFormatter(name, v) : v.toLocaleString("es-AR");
          return (
            <div key={name} className="flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                <span className="text-muted">{name}</span>
              </div>
              <div className="font-semibold text-text">{txt}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LegendToggle({
  payload, hidden, onToggle,
}: { payload?: any[]; hidden: Set<string>; onToggle: (k: string) => void }) {
  if (!payload?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {payload.map((p: any) => {
        const key = String(p.dataKey ?? p.value ?? "");
        const isOff = hidden.has(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(key)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold",
              "transition hover:bg-surface focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
              isOff ? "opacity-45" : "opacity-100"
            )}
          >
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
            <span className={isOff ? "text-muted" : "text-text"}>{key}</span>
          </button>
        );
      })}
    </div>
  );
}

// KPI card pequeño
function KpiCard({
  label, value, sub, tone = "normal",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "normal" | "success" | "warning" | "danger";
}) {
  const valueClass = cn(
    "mt-1.5 text-lg font-bold leading-tight break-all",
    tone === "success" && "text-green-600",
    tone === "warning" && "text-amber-500",
    tone === "danger" && "text-red-500",
    tone === "normal" && "text-text"
  );
  return (
    <TPCard className="p-5">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className={valueClass}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-muted leading-snug">{sub}</div>}
    </TPCard>
  );
}

// Placeholder cuando no hay datos para un gráfico
function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center">
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard principal
// ─────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<DashboardSummary | null>(null);

  const [hiddenFx, setHiddenFx] = useState<Set<string>>(() => new Set());
  const [hiddenMetals, setHiddenMetals] = useState<Set<string>>(() => new Set());

  function toggleFx(key: string) {
    setHiddenFx((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }
  function toggleMetal(key: string) {
    setHiddenMetals((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await apiFetch(`/dashboard/summary?range=${range}`);
        if (!res?.ok) throw new Error(res?.message || "Error");
        if (alive) {
          // DEBUG: inspeccionar payload crudo de valuación
          console.log("[Dashboard] raw fx series (primeros 5):", res.data?.series?.fx?.slice(0, 5));
          console.log("[Dashboard] raw metals series (primeros 5):", res.data?.series?.metals?.slice(0, 5));
          console.log("[Dashboard] currencies:", res.data?.currencies);
          console.log("[Dashboard] metals:", res.data?.metals);
          setData(res.data);
        }
      } catch (e: any) {
        if (alive) setErr(e?.message || "Error cargando dashboard");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [range]);

  // ── Datos derivados ────────────────────────────────────────────────────────
  const kpis = data?.kpis;
  const salesKpis = data?.salesKpis;
  const inventory = data?.inventory;
  const baseSymbol = kpis?.baseCurrency?.symbol || "$";
  const baseCode = kpis?.baseCurrency?.code || "";

  const fxData = data?.series?.fx ?? [];
  const metalsData = data?.series?.metals ?? [];

  const fxKeys = useMemo(
    () => (data?.currencies ?? []).filter((c) => !c.isBase).map((c) => c.code),
    [data]
  );
  const metalKeys = useMemo(
    () => (data?.metals ?? []).map((m) => m.name),
    [data]
  );

  // Series con fill-forward: propaga el último valor conocido en días sin datos
  const fxDataFilled = useMemo(
    () => fillForwardSeries(fxData, fxKeys),
    [fxData, fxKeys]
  );
  const metalsDataFilled = useMemo(
    () => fillForwardSeries(metalsData, metalKeys),
    [metalsData, metalKeys]
  );

  // Hay datos reales si al menos un punto tiene alguna key con valor
  const hasFxData = useMemo(
    () => fxKeys.length > 0 && fxKeys.some((k) => fxData.some((p) => p[k] != null)),
    [fxData, fxKeys]
  );
  const hasMetalsData = useMemo(
    () => metalKeys.length > 0 && metalKeys.some((k) => metalsData.some((p) => p[k] != null)),
    [metalsData, metalKeys]
  );

  const salesSeries = data?.salesSeries ?? [];
  const hasSalesData = salesSeries.some((s) => s.revenue > 0);
  const hasMarginData = salesSeries.some((s) => s.margin != null && s.margin !== 0);

  const currentFx = useMemo(() => {
    const list = (data?.currencies ?? [])
      .filter((c) => !c.isBase)
      .map((c) => ({
        code: c.code,
        name: c.name,
        symbol: c.symbol,
        value: getLatestValue(fxData, c.code),
      }));
    list.sort((a, b) => a.code.localeCompare(b.code));
    return list;
  }, [data, fxData]);

  const currentMetals = useMemo(() => {
    const list = (data?.metals ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      symbol: m.symbol,
      sortOrder: m.sortOrder,
      value: getLatestValue(metalsData, m.name),
    }));
    list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
    return list;
  }, [data, metalsData]);

  type VariantItem = NonNullable<DashboardSummary["variants"]>[number];
  const variantsByMetal = useMemo(() => {
    const map = new Map<string, VariantItem[]>();
    for (const v of data?.variants ?? []) {
      const arr = map.get(v.metalId) ?? [];
      arr.push(v);
      map.set(v.metalId, arr);
    }
    return map;
  }, [data]);

  // ── KPI helpers ────────────────────────────────────────────────────────────
  const fmtCurrency = (n: number) => fmtMoney2(baseSymbol, n);

  const marginTone = (() => {
    const pct = salesKpis?.range?.marginPercent;
    if (pct == null) return "normal" as const;
    if (pct < 0) return "danger" as const;
    if (pct < 15) return "warning" as const;
    return "success" as const;
  })();

  const stockTone = (() => {
    const count = inventory?.outOfStockCount ?? 0;
    if (count === 0) return "success" as const;
    if (count <= 5) return "warning" as const;
    return "danger" as const;
  })();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-muted">TPTech</div>
          <h1 className="text-xl font-semibold text-text">Dashboard</h1>
        </div>
        <Segmented value={range} onChange={setRange} />
      </div>

      {/* Estado de carga / error */}
      {loading && (
        <div className="text-sm text-muted">Cargando información…</div>
      )}
      {!loading && err && (
        <TPAlert tone="danger" title="Error cargando dashboard">{err}</TPAlert>
      )}

      {!loading && !err && (
        <>
          {/* ── FILA 1: KPIs ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
            <KpiCard
              label="Ventas hoy"
              value={fmtCurrency(salesKpis?.today?.revenue ?? 0)}
              sub="Confirmadas hoy"
            />
            <KpiCard
              label="Ventas del mes"
              value={fmtCurrency(salesKpis?.month?.revenue ?? 0)}
              sub="Mes en curso"
            />
            <KpiCard
              label="Tickets hoy"
              value={String(salesKpis?.today?.ticketCount ?? 0)}
              sub="Ventas confirmadas"
            />
            <KpiCard
              label="Ticket promedio"
              value={fmtCurrency(salesKpis?.range?.ticketCount
                ? (salesKpis.range.revenue / salesKpis.range.ticketCount)
                : 0)}
              sub={RANGE_LABEL[range]}
            />
            <KpiCard
              label="Margen bruto"
              value={fmtPct(salesKpis?.range?.marginPercent ?? null)}
              sub={
                salesKpis?.range?.marginPercent == null
                  ? "Sin costo en artículos"
                  : salesKpis.range.linesWithoutCost > 0
                    ? `⚠ ${salesKpis.range.linesWithoutCost} líneas sin costo`
                    : RANGE_LABEL[range]
              }
              tone={marginTone}
            />
            <KpiCard
              label="Sin stock"
              value={String(inventory?.outOfStockCount ?? "—")}
              sub={
                inventory == null
                  ? "—"
                  : inventory.outOfStockCount === 0
                    ? "Todo en orden"
                    : `de ${inventory.stockTrackedCount} seguidos`
              }
              tone={stockTone}
            />
          </div>

          {/* ── FILA 2: Evolución de ventas (ancho completo) ─────────────── */}
          <TPCard
            title={
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-text">Evolución de ventas</div>
                <div className="text-xs text-muted">
                  Ventas confirmadas — {RANGE_LABEL[range]}
                </div>
              </div>
            }
            className="p-4"
          >
            <div className="rounded-2xl border border-border bg-surface p-3">
              {hasSalesData ? (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={salesSeries} margin={{ top: 8, right: 14, left: 6, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                        </linearGradient>
                        {hasMarginData && (
                          <linearGradient id="gradMargin" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#16a34a" stopOpacity={0.18} />
                            <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                          </linearGradient>
                        )}
                      </defs>
                      <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={fmtDateShort}
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={48}
                        tickFormatter={fmtYAxis}
                      />
                      <Tooltip
                        content={
                          <NiceTooltip
                            valueFormatter={(_k: string, v: number) =>
                              fmtMoney2(baseSymbol, v)
                            }
                          />
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        name="Ventas"
                        stroke="#2563eb"
                        fill="url(#gradRevenue)"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                      {hasMarginData && (
                        <Area
                          type="monotone"
                          dataKey="margin"
                          name="Margen"
                          stroke="#16a34a"
                          fill="url(#gradMargin)"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                          connectNulls={false}
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-4 rounded-full bg-[#2563eb]" />
                      Ventas
                    </span>
                    {hasMarginData && (
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-4 rounded-full bg-[#16a34a]" />
                        Margen
                      </span>
                    )}
                    {!hasMarginData && salesKpis?.range?.linesWithoutCost != null && (
                      <span className="text-muted opacity-70">
                        Margen no disponible — cargá costo en los artículos
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <EmptyChart message={`Sin ventas confirmadas en los ${RANGE_LABEL[range]}`} />
              )}
            </div>
          </TPCard>

          {/* ── FILA 3: Gráficos de valuación ────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {/* Monedas */}
            <TPCard
              title={
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-text">Monedas</div>
                  <div className="text-xs text-muted">
                    Historial de tipo de cambio
                    {baseCode ? ` (base: ${baseCode})` : ""}
                  </div>
                </div>
              }
              className="p-4"
            >
              <div className="rounded-2xl border border-border bg-surface p-3">
                {!hasFxData ? (
                  <EmptyChart message="Sin datos de monedas" />
                ) : (
                  <>
                    <div className="mb-2">
                      <LegendToggle
                        payload={fxKeys.map((k) => ({ dataKey: k, value: k, color: stableColorForKey(k) }))}
                        hidden={hiddenFx}
                        onToggle={toggleFx}
                      />
                    </div>
                    {/* ✅ height número fijo — elimina el warning width(-1) height(-1) */}
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={fxDataFilled} margin={{ top: 4, right: 14, left: 6, bottom: 0 }}>
                        <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickFormatter={fmtDateShort}
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          width={44}
                          tickFormatter={(v) =>
                            Number(v).toLocaleString("es-AR", { maximumFractionDigits: 4 })
                          }
                        />
                        <Tooltip
                          content={
                            <NiceTooltip
                              valueFormatter={(_k: string, v: number) =>
                                v.toLocaleString("es-AR", { maximumFractionDigits: 6 })
                              }
                            />
                          }
                        />
                        {fxKeys.map((k) => (
                          <Line
                            key={k}
                            type="monotone"
                            dataKey={k}
                            name={k}
                            stroke={stableColorForKey(k)}
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{ r: 4 }}
                            hide={hiddenFx.has(k)}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </>
                )}
              </div>
            </TPCard>

            {/* Metales */}
            <TPCard
              title={
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-text">Metales</div>
                  <div className="text-xs text-muted">Valor de referencia histórico</div>
                </div>
              }
              className="p-4"
            >
              <div className="rounded-2xl border border-border bg-surface p-3">
                {!hasMetalsData ? (
                  <EmptyChart message="Sin datos de metales" />
                ) : (
                  <>
                    <div className="mb-2">
                      <LegendToggle
                        payload={metalKeys.map((k) => ({ dataKey: k, value: k, color: stableColorForKey(k) }))}
                        hidden={hiddenMetals}
                        onToggle={toggleMetal}
                      />
                    </div>
                    {/* ✅ height número fijo */}
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={metalsDataFilled} margin={{ top: 4, right: 14, left: 6, bottom: 0 }}>
                        <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickFormatter={fmtDateShort}
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          width={44}
                          tickFormatter={(v) =>
                            Number(v).toLocaleString("es-AR", { maximumFractionDigits: 4 })
                          }
                        />
                        <Tooltip
                          content={
                            <NiceTooltip
                              valueFormatter={(_k: string, v: number) =>
                                v.toLocaleString("es-AR", { maximumFractionDigits: 6 })
                              }
                            />
                          }
                        />
                        {metalKeys.map((k) => (
                          <Line
                            key={k}
                            type="monotone"
                            dataKey={k}
                            name={k}
                            stroke={stableColorForKey(k)}
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{ r: 4 }}
                            hide={hiddenMetals.has(k)}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </>
                )}
              </div>
            </TPCard>
          </div>

          {/* ── FILA 4: Valores actuales + Inventario / Operaciones ───────── */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">

            {/* Valores actuales (monedas + metales) */}
            <TPCard
              title={
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-text">Valores actuales</div>
                  <div className="text-xs text-muted">Último valor disponible en el rango</div>
                </div>
              }
              className="p-4"
            >
              <div className="space-y-4">
                {/* Monedas */}
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold text-text">Monedas</div>
                    {baseCode && (
                      <div className="text-[11px] text-muted">
                        Excluye moneda base ({baseCode})
                      </div>
                    )}
                  </div>
                  <div className="mt-2 space-y-2">
                    {currentFx.length === 0 ? (
                      <div className="text-sm text-muted">—</div>
                    ) : (
                      currentFx.map((c) => (
                        <div
                          key={c.code}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full"
                                style={{ background: stableColorForKey(c.code) }}
                              />
                              <div className="truncate text-sm font-semibold text-text">{c.code}</div>
                            </div>
                            <div className="truncate text-xs text-muted">{c.name}</div>
                          </div>
                          <div className="shrink-0 text-sm font-semibold text-text">
                            {fmtNumber2(c.value)} {baseSymbol}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Metales */}
                <div>
                  <div className="text-xs font-semibold text-text">Metales</div>
                  <div className="mt-2 space-y-2">
                    {currentMetals.length === 0 ? (
                      <div className="text-sm text-muted">—</div>
                    ) : (
                      currentMetals.map((m) => {
                        const mVariants = variantsByMetal.get(m.id) ?? [];
                        return (
                          <div key={m.name} className="rounded-xl border border-border bg-surface overflow-hidden">
                            <div className="flex items-center justify-between gap-3 px-4 py-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="inline-block h-2.5 w-2.5 rounded-full"
                                    style={{ background: stableColorForKey(m.name) }}
                                  />
                                  <div className="truncate text-sm font-semibold text-text">
                                    {m.symbol ? `${m.symbol} · ` : ""}{m.name}
                                  </div>
                                </div>
                                <div className="truncate text-xs text-muted">Valor de referencia</div>
                              </div>
                              <div className="shrink-0 text-sm font-semibold text-text">
                                {fmtNumber2(m.value)} {baseSymbol}
                              </div>
                            </div>
                            {mVariants.length > 0 && (
                              <div className="border-t border-border divide-y divide-border">
                                {mVariants.map((v) => (
                                  <div
                                    key={v.id}
                                    className="flex items-center justify-between gap-3 bg-card px-4 py-2 pl-8"
                                  >
                                    <div className="min-w-0">
                                      <div className="truncate text-xs font-medium text-text">{v.name}</div>
                                      <div className="text-[11px] text-muted">
                                        Ley {v.purity.toLocaleString("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                                        {" · "}SKU {v.sku}
                                      </div>
                                    </div>
                                    <div className="shrink-0 text-xs font-semibold text-text">
                                      {fmtNumber2(v.value)} {baseSymbol}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </TPCard>

            {/* Inventario + Operaciones */}
            <div className="space-y-4">

              {/* Inventario */}
              {inventory && inventory.stockTrackedCount > 0 && (
                <TPCard title="Inventario" className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
                      <div className="text-xs font-medium text-muted">Artículos con stock activo</div>
                      <div className="text-sm font-semibold text-text">{inventory.articlesActive}</div>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
                      <div className="text-xs font-medium text-muted">Sin stock</div>
                      <div className={cn(
                        "text-sm font-semibold",
                        inventory.outOfStockCount === 0 ? "text-green-600" : "text-amber-500"
                      )}>
                        {inventory.outOfStockCount === 0
                          ? "Todo en orden"
                          : `${inventory.outOfStockCount} artículos`}
                      </div>
                    </div>
                    {inventory.topOutOfStock.length > 0 && (
                      <div className="rounded-xl border border-border bg-surface overflow-hidden">
                        <div className="border-b border-border px-4 py-2 text-xs font-semibold text-text">
                          Artículos sin stock
                        </div>
                        <div className="divide-y divide-border">
                          {inventory.topOutOfStock.map((a) => (
                            <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-2">
                              <div className="min-w-0">
                                <div className="truncate text-xs font-medium text-text">{a.name}</div>
                                <div className="text-[11px] text-muted">{a.code}</div>
                              </div>
                              <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                                Sin stock
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </TPCard>
              )}

              {/* Resumen operativo */}
              <TPCard title="Operaciones" className="p-4">
                <div className="space-y-2">
                  {[
                    { label: "Moneda base", value: kpis?.baseCurrency ? `${kpis.baseCurrency.code} — ${kpis.baseCurrency.name}` : "—" },
                    { label: "Monedas activas", value: String(kpis?.currenciesActiveCount ?? "—") },
                    { label: "Metales activos", value: String(kpis?.metalsActiveCount ?? "—") },
                    { label: "Almacenes activos", value: String(kpis?.warehousesActiveCount ?? "—") },
                    { label: "Usuarios totales", value: kpis?.users ? `${kpis.users.total} (${kpis.users.ACTIVE} activos)` : "—" },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2.5"
                    >
                      <div className="text-xs text-muted">{row.label}</div>
                      <div className="text-xs font-semibold text-text">{row.value}</div>
                    </div>
                  ))}
                </div>
              </TPCard>

            </div>
          </div>
        </>
      )}
    </div>
  );
}
