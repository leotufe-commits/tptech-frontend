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
      <div>
        <div className="text-xs font-medium text-zinc-500">TPTech</div>
        <h1 className="text-xl font-semibold text-zinc-900">Dashboard</h1>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="text-sm text-zinc-500">Ventas</div>
          <div className="mt-2 text-2xl font-semibold text-zinc-900">
            $ 12.450.000
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="text-sm text-zinc-500">Órdenes</div>
          <div className="mt-2 text-2xl font-semibold text-zinc-900">128</div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="text-sm text-zinc-500">Clientes</div>
          <div className="mt-2 text-2xl font-semibold text-zinc-900">42</div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="text-sm text-zinc-500">Stock bajo</div>
          <div className="mt-2 text-2xl font-semibold text-orange-600">6</div>
        </div>
      </div>

      {/* Gráfico */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="text-sm font-medium text-zinc-900">
          Ventas últimos 30 días
        </div>

        <div className="mt-4 h-64 w-full rounded-xl bg-zinc-50 p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(v: any) =>
                  new Intl.NumberFormat("es-AR", {
                    style: "currency",
                    currency: "ARS",
                    maximumFractionDigits: 0,
                  }).format(Number(v))
                }
                labelFormatter={(l) => `Día ${l}`}
              />
              <Line
                type="monotone"
                dataKey="ventas"
                stroke="#F97316"
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Acciones rápidas */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="text-sm font-medium text-zinc-900">Acciones rápidas</div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600">
            Nueva Venta
          </button>
          <button className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600">
            Nueva Compra
          </button>
          <button className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600">
            Revisar Inventario
          </button>
          <button className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600">
            Generar Reportes
          </button>
        </div>
      </div>

      {/* Actividad reciente */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="text-sm font-medium text-zinc-900">Actividad reciente</div>

        <div className="mt-4 space-y-3">
          {activity.map((item, idx) => (
            <div
              key={idx}
              className="flex items-start justify-between gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 hover:bg-zinc-50"
            >
              <div className="text-sm text-zinc-700">{item.t}</div>
              <div className="shrink-0 text-xs font-medium text-zinc-500">{item.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
