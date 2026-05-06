// src/components/ui/TPTotalCell.tsx
// ============================================================================
// TPTotalCell — celda de total para cards de resumen en modales de documentos.
//
// Extracción de la función `TotalCell` que hoy está copiada literalmente en:
//   · ComprasFacturasProveedor
//   · VentasFacturas
//   · VentasPresupuestos
//   · VentasOrdenes
//
// API exactamente igual a las copias locales para que Fase B sea un simple
// reemplazo de import. Se exporta el tipo `TPTotalCellTone` para que las
// pantallas que quieran chequeo fuerte del tono no dependan del tipo interno.
// ============================================================================

import React from "react";

export type TPTotalCellTone = "primary" | "success" | "warning" | "danger";

export type TPTotalCellProps = {
  label: string;
  value: React.ReactNode;
  tone?: TPTotalCellTone;
  bold?: boolean;
};

export function TPTotalCell({ label, value, tone, bold }: TPTotalCellProps) {
  const color =
    tone === "primary" ? "text-primary"
    : tone === "success" ? "text-emerald-500 dark:text-emerald-400"
    : tone === "warning" ? "text-amber-500 dark:text-amber-400"
    : tone === "danger"  ? "text-red-500 dark:text-red-400"
    : "text-text";

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted truncate">
        {label}
      </div>
      <div
        className={`tabular-nums truncate ${bold ? "font-bold text-base" : "font-semibold text-sm"} ${color}`}
      >
        {value}
      </div>
    </div>
  );
}

export default TPTotalCell;
