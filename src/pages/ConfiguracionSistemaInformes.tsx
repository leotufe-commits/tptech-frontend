import React from "react";
import { BarChart3, Sparkles, FileText, Clock } from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Card({
  title,
  desc,
  icon,
  badge,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-4",
        "shadow-[0_1px_0_0_rgba(0,0,0,0.05)]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-surface2 text-primary">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-base font-semibold text-text truncate">{title}</div>
              {badge}
            </div>
            <div className="text-sm text-muted mt-0.5">{desc}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface2 px-2 py-0.5 text-[11px] font-semibold text-muted">
      {children}
    </span>
  );
}

export default function ConfiguracionSistemaInformes() {
  return (
    <div className="p-6">
      <div className="mb-5">
        <div className="text-sm text-muted">Configuración del sistema</div>
        <h1 className="text-2xl font-bold text-text">Informes</h1>
        <div className="mt-1 text-sm text-muted">
          Base para reportes, tableros y exportaciones. Vamos a ir sumando módulos por prioridad.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card
          title="Reportes operativos"
          desc="Ventas, compras, movimientos, stock y auditoría."
          icon={<FileText size={20} />}
          badge={<Pill>próximo</Pill>}
        />
        <Card
          title="Tableros"
          desc="KPIs y gráficos (más adelante con charts)."
          icon={<BarChart3 size={20} />}
          badge={<Pill>en diseño</Pill>}
        />
        <Card
          title="Exportaciones"
          desc="CSV / PDF / impresión según necesidad."
          icon={<Sparkles size={20} />}
          badge={<Pill>pendiente</Pill>}
        />
        <Card
          title="Histórico"
          desc="Comparativas por período y tendencias."
          icon={<Clock size={20} />}
          badge={<Pill>más adelante</Pill>}
        />
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card p-4" style={{ boxShadow: "var(--shadow)" }}>
        <div className="text-sm font-semibold text-text">Siguiente paso sugerido</div>
        <div className="mt-1 text-sm text-muted">
          Arrancamos con un informe simple (por ejemplo “Stock bajo” o “Ventas por período”) para validar el formato y la UX,
          y después escalamos.
        </div>
      </div>
    </div>
  );
}
