// tptech-frontend/src/pages/Dashboard.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import { TPCard } from "../components/ui/TPCard";
import TPAlert from "../components/ui/TPAlert";
import { cn } from "../components/ui/tp";
import { apiFetch } from "../lib/api";
import { fmtNumber2 } from "../lib/format";

type RangeKey = "7d" | "30d" | "90d" | "1y";

function stableColorForKey(key: string) {
  const palette = [
    "#2563eb",
    "#16a34a",
    "#f59e0b",
    "#db2777",
    "#7c3aed",
    "#0ea5e9",
    "#ef4444",
    "#14b8a6",
    "#a3a3a3",
  ];
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

function Segmented({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (v: RangeKey) => void;
}) {
  const items: { k: RangeKey; label: string }[] = [
    { k: "7d", label: "7d" },
    { k: "30d", label: "30d" },
    { k: "90d", label: "90d" },
    { k: "1y", label: "1a" },
  ];

  return (
    <div className="inline-flex items-center rounded-xl border border-border bg-surface p-1 shadow-sm">
      {items.map((it) => {
        const active = value === it.k;

        return (
          <button
            key={it.k}
            type="button"
            onClick={() => onChange(it.k)}
            aria-pressed={active}
            className={cn(
              "inline-flex min-w-[46px] items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold leading-none transition-all duration-150",
              "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
              active
                ? "bg-primary text-white shadow-sm"
                : "text-muted hover:bg-white/5 hover:text-text"
            )}
          >
            {it.label}
          </button>
        );
      })}
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
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: p.color }}
                />
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
  payload,
  hidden,
  onToggle,
}: {
  payload?: any[];
  hidden: Set<string>;
  onToggle: (dataKey: string) => void;
}) {
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
            title={isOff ? "Mostrar" : "Ocultar"}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: p.color }}
            />
            <span className={cn(isOff ? "text-muted" : "text-text")}>{key}</span>
          </button>
        );
      })}
    </div>
  );
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

/** ✅ Dashboard: SIEMPRE 2 decimales "1,00" */
function formatMaybe(n: number | null) {
  return fmtNumber2(n);
}

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
  variants: Array<{ id: string; metalId: string; name: string; sku: string; purity: number; saleFactor: number; value: number | null }>;
  series: {
    fx: Array<Record<string, any>>;
    metals: Array<Record<string, any>>;
  };
  activity: Array<{
    id: string;
    action: string;
    success: boolean;
    createdAt: string;
    userId?: string;
  }>;
};

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
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleMetal(key: string) {
    setHiddenMetals((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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
        if (alive) setData(res.data);
      } catch (e: any) {
        if (alive) setErr(e?.message || "Error cargando dashboard");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [range]);

  const kpis = data?.kpis;

  const fxData = data?.series?.fx ?? [];
  const metalsData = data?.series?.metals ?? [];

  const fxKeys = useMemo(() => (data?.currencies?.map((c) => c.code) ?? []), [data]);
  const metalKeys = useMemo(() => (data?.metals?.map((m) => m.name) ?? []), [data]);

  const baseSymbol = kpis?.baseCurrency?.symbol || kpis?.baseCurrency?.code || "";
  const baseCode = kpis?.baseCurrency?.code || "";
  const baseName = kpis?.baseCurrency?.name || "";

  // ✅ Valores actuales (Monedas) — Opción B:
  // No se muestra la moneda base en el listado.
  const currentFx = useMemo(() => {
    const list = (data?.currencies ?? [])
      .filter((c) => !c.isBase)
      .map((c) => ({
        code: c.code,
        name: c.name,
        symbol: c.symbol,
        isBase: c.isBase,
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

  // ✅ Texto aclaratorio (Opción B)
  const fxNote = useMemo(() => {
    const active = kpis?.currenciesActiveCount;
    if (!active || active <= 0) return "Mostrando cotizaciones (excluye moneda base).";
    if (!baseCode) return "Mostrando cotizaciones (excluye moneda base).";
    return `Mostrando cotizaciones (excluye moneda base ${baseCode}).`;
  }, [kpis?.currenciesActiveCount, baseCode]);

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

      {/* Estado carga */}
      {loading ? (
        <div className="text-sm text-muted">Trayendo información real del sistema…</div>
      ) : err ? (
        <TPAlert tone="danger" title="Error cargando dashboard">
          {err}
        </TPAlert>
      ) : null}

      {/* ✅ ARRIBA: GRÁFICOS */}
      {!loading && !err && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <TPCard
            title={
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-text">Monedas</div>
                <div className="text-xs text-muted">Historial (multi-línea)</div>
              </div>
            }
            className="p-4"
          >
            <div className="rounded-2xl border border-border bg-surface p-3">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={fxData} margin={{ top: 8, right: 14, left: 6, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      tickFormatter={(v) =>
                        Number(v).toLocaleString("es-AR", { maximumFractionDigits: 6 })
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
                    <Legend
                      verticalAlign="top"
                      align="left"
                      content={(props) => (
                        <div className="mb-2">
                          <LegendToggle payload={props.payload as any[]} hidden={hiddenFx} onToggle={toggleFx} />
                        </div>
                      )}
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
              </div>

              <div className="mt-2 text-xs text-muted">
                Hover para valores. Click en leyenda para ocultar/mostrar líneas.
              </div>
            </div>
          </TPCard>

          <TPCard
            title={
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-text">Metales padres</div>
                <div className="text-xs text-muted">Historial valor de referencia (multi-línea)</div>
              </div>
            }
            className="p-4"
          >
            <div className="rounded-2xl border border-border bg-surface p-3">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metalsData} margin={{ top: 8, right: 14, left: 6, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      tickFormatter={(v) =>
                        Number(v).toLocaleString("es-AR", { maximumFractionDigits: 6 })
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
                    <Legend
                      verticalAlign="top"
                      align="left"
                      content={(props) => (
                        <div className="mb-2">
                          <LegendToggle
                            payload={props.payload as any[]}
                            hidden={hiddenMetals}
                            onToggle={toggleMetal}
                          />
                        </div>
                      )}
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
              </div>

              <div className="mt-2 text-xs text-muted">
                Hover para valores. Click en leyenda para ocultar/mostrar líneas.
              </div>
            </div>
          </TPCard>
        </div>
      )}

      {/* ✅ ABAJO: CARDS CHICOS (KPIs) */}
      {!loading && !err && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <TPCard className="p-5">
            <div className="text-sm text-muted">Moneda base</div>
            <div className="mt-2 text-2xl font-semibold text-text">
              {kpis?.baseCurrency?.code
                ? `${kpis.baseCurrency.code} ${kpis.baseCurrency.symbol}`
                : "—"}
            </div>
            <div className="mt-1 text-xs text-muted">{baseName || "—"}</div>
          </TPCard>

          <TPCard className="p-5">
            <div className="text-sm text-muted">Monedas activas</div>
            <div className="mt-2 text-2xl font-semibold text-text">
              {kpis?.currenciesActiveCount ?? "—"}
            </div>
            <div className="mt-1 text-xs text-muted">En valuación</div>
          </TPCard>

          <TPCard className="p-5">
            <div className="text-sm text-muted">Metales activos</div>
            <div className="mt-2 text-2xl font-semibold text-text">
              {kpis?.metalsActiveCount ?? "—"}
            </div>
            <div className="mt-1 text-xs text-muted">Metales padres</div>
          </TPCard>

          <TPCard className="p-5">
            <div className="text-sm text-muted">Usuarios</div>
            <div className="mt-2 text-2xl font-semibold text-text">
              {kpis?.users?.total ?? "—"}
            </div>
            <div className="mt-1 text-xs text-muted">
              Activos {kpis?.users?.ACTIVE ?? 0} · Pend {kpis?.users?.PENDING ?? 0} · Bloq{" "}
              {kpis?.users?.BLOCKED ?? 0}
            </div>
          </TPCard>
        </div>
      )}

      {/* ✅ Valores actuales (Monedas + Metales) */}
      {!loading && !err && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <TPCard
            title={
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-text">Valores actuales</div>
                <div className="text-xs text-muted">Último valor disponible dentro del rango</div>
              </div>
            }
            className="p-4"
          >
            <div className="space-y-4">
              {/* Monedas */}
              <div>
                <div className="flex items-end justify-between gap-3">
                  <div className="text-xs font-semibold text-text">Monedas</div>

                  {/* ✅ Opción B: aclaración por qué no coincide con "Monedas activas" */}
                  <div className="text-[11px] text-muted">{fxNote}</div>
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

                        {/* ✅ SIEMPRE 2 decimales */}
                        <div className="shrink-0 text-sm font-semibold text-text">
                          {formatMaybe(c.value)} {baseSymbol}
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
                          {/* Metal padre */}
                          <div className="flex items-center justify-between gap-3 px-4 py-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-block h-2.5 w-2.5 rounded-full"
                                  style={{ background: stableColorForKey(m.name) }}
                                />
                                <div className="truncate text-sm font-semibold text-text">
                                  {m.symbol ? `${m.symbol} · ` : ""}
                                  {m.name}
                                </div>
                              </div>
                              <div className="truncate text-xs text-muted">Valor de referencia</div>
                            </div>
                            <div className="shrink-0 text-sm font-semibold text-text">
                              {formatMaybe(m.value)} {baseSymbol}
                            </div>
                          </div>

                          {/* Variantes */}
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
                                    {formatMaybe(v.value)} {baseSymbol}
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

          {/* Resumen */}
          <TPCard title="Resumen" className="p-4">
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-surface px-4 py-3">
                <div className="text-xs font-semibold text-text">Almacenes activos</div>
                <div className="mt-1 text-sm font-semibold text-text">
                  {kpis?.warehousesActiveCount ?? "—"}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface px-4 py-3">
                <div className="text-xs font-semibold text-text">Tip</div>
                <div className="mt-1 text-xs text-muted">
                  Si querés que el “valor actual” sea <b>sí o sí el último real</b> aunque esté fuera del
                  rango, hacemos que el backend consulte el último registro global por moneda/metal.
                </div>
              </div>
            </div>
          </TPCard>
        </div>
      )}
    </div>
  );
}