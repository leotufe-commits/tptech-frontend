import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function Dashboard() {
  const data = [
    { day: "01", ventas: 220000 },
    { day: "03", ventas: 180000 },
    { day: "05", ventas: 260000 },
    { day: "07", ventas: 210000 },
    { day: "09", ventas: 320000 },
    { day: "11", ventas: 280000 },
    { day: "13", ventas: 350000 },
    { day: "15", ventas: 300000 },
    { day: "17", ventas: 420000 },
    { day: "19", ventas: 390000 },
    { day: "21", ventas: 460000 },
    { day: "23", ventas: 410000 },
    { day: "25", ventas: 520000 },
    { day: "27", ventas: 480000 },
    { day: "29", ventas: 610000 },
  ];

  const activity = [
    { d: "23 dic 2025", t: "Movimiento de entrada creado" },
    { d: "23 dic 2025", t: "Movimiento de entrada creado" },
    { d: "22 dic 2025", t: "Movimiento de salida creado" },
    { d: "22 dic 2025", t: "Paquete creado #PAX-0000033" },
    { d: "22 dic 2025", t: "Factura creada #FV-0000031" },
    { d: "22 dic 2025", t: "Recepción procesada #PR-0000036" },
    { d: "22 dic 2025", t: "Factura creada #FC-0000035" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="text-xs font-medium text-muted">TPTech</div>
        <h1 className="text-xl font-semibold text-text">Dashboard</h1>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          { label: "Ventas", value: "$ 12.450.000" },
          { label: "Órdenes", value: "128" },
          { label: "Clientes", value: "42" },
          { label: "Stock bajo", value: "6", highlight: true },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="text-sm text-muted">{c.label}</div>
            <div
              className={`mt-2 text-2xl font-semibold ${
                c.highlight ? "text-primary" : "text-text"
              }`}
            >
              {c.value}
            </div>
          </div>
        ))}
      </div>

      {/* Gráfico */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="text-sm font-medium text-text">
          Ventas últimos 30 días
        </div>

        <div className="mt-4 h-64 w-full rounded-xl bg-surface p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid
                stroke="var(--border)"
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 12, fill: "var(--muted)" }}
                axisLine={{ stroke: "var(--border)" }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "var(--muted)" }}
                axisLine={{ stroke: "var(--border)" }}
              />
              <Tooltip
                formatter={(v: any) =>
                  new Intl.NumberFormat("es-AR", {
                    style: "currency",
                    currency: "ARS",
                    maximumFractionDigits: 0,
                  }).format(Number(v))
                }
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  color: "var(--text)",
                }}
                labelFormatter={(l) => `Día ${l}`}
              />
              <Line
                type="monotone"
                dataKey="ventas"
                stroke="var(--primary)"
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Acciones rápidas */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="text-sm font-medium text-text">Acciones rápidas</div>

        <div className="mt-4 flex flex-wrap gap-3">
          {[
            "Nueva Venta",
            "Nueva Compra",
            "Revisar Inventario",
            "Generar Reportes",
          ].map((b) => (
            <button
              key={b}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* Actividad reciente */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="text-sm font-medium text-text">Actividad reciente</div>

        <div className="mt-4 space-y-3">
          {activity.map((item, idx) => (
            <div
              key={idx}
              className="flex items-start justify-between gap-4 rounded-xl border border-border bg-surface px-4 py-3 hover:bg-surface2/40"
            >
              <div className="text-sm text-text">{item.t}</div>
              <div className="shrink-0 text-xs font-medium text-muted">
                {item.d}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
