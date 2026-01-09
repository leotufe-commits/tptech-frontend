export default function Dashboard() {
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

      {/* “Chart” placeholder */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="text-sm font-medium text-text">Ventas últimos 30 días</div>

        <div className="mt-4 h-64 w-full rounded-xl bg-surface p-4 border border-border flex items-center justify-center">
          <div className="text-sm text-muted">
            Gráfico pendiente (recharts). Primero dejamos la navegación 100% estable.
          </div>
        </div>
      </div>

      {/* Acciones rápidas */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="text-sm font-medium text-text">Acciones rápidas</div>

        <div className="mt-4 flex flex-wrap gap-3">
          {["Nueva Venta", "Nueva Compra", "Revisar Inventario", "Generar Reportes"].map((b) => (
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
              <div className="shrink-0 text-xs font-medium text-muted">{item.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
