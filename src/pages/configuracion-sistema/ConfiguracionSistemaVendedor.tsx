// tptech-frontend/src/pages/ConfiguracionSistemaVendedor.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Store } from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function ConfiguracionSistemaVendedor() {
  const nav = useNavigate();

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted">Configuración del sistema</div>
          <h1 className="text-2xl font-semibold truncate">Vendedor</h1>
        </div>

        <button
          type="button"
          className={cn("tp-btn-secondary", "inline-flex items-center gap-2")}
          onClick={() => nav("/configuracion-sistema")}
        >
          <ChevronLeft className="h-4 w-4" />
          Volver
        </button>
      </div>

      {/* Card */}
      <div className="tp-card rounded-2xl border border-border p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-surface2 text-primary">
            <Store className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <div className="text-base font-semibold">Pantalla en construcción</div>
            <div className="text-sm text-muted mt-1">
              Acá vamos a configurar parámetros de vendedor (comisiones, objetivos, reglas, etc.).
            </div>

            <div className="mt-4 rounded-xl border border-border bg-surface2/40 p-4 text-sm">
              <div className="font-semibold mb-1">Pendientes típicos</div>
              <ul className="list-disc pl-5 space-y-1 text-muted">
                <li>Comisiones por venta / por categoría</li>
                <li>Objetivos mensuales</li>
                <li>Reglas de descuentos permitidos</li>
                <li>KPIs y reportes</li>
              </ul>
            </div>

            <div className="mt-4 text-[11px] text-muted">
              * Esta sección es un placeholder para no dejar el botón sin destino.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
