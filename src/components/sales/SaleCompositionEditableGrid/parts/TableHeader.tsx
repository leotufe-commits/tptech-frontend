// src/components/sales/SaleCompositionEditableGrid/parts/TableHeader.tsx
// =============================================================================
// Header sticky de la tabla. Renderiza títulos centrados con handles de resize
// en el borde derecho de cada columna configurable.
// =============================================================================

import React from "react";
import { cn } from "../../../ui/tp";
import { RESIZABLE_COLS, TABLE_COLS_CLS } from "../constants";
import { buildGridTemplateColumns } from "../helpers";
import { ColumnResizeHandle } from "./ColumnResizeHandle";

export function TableHeader({
  widths, onWidthsChange,
}: {
  widths: number[];
  onWidthsChange: (next: number[]) => void;
}) {
  const gridStyle = React.useMemo(
    () => ({ gridTemplateColumns: buildGridTemplateColumns(widths) }),
    [widths],
  );
  return (
    <div
      className={cn(
        TABLE_COLS_CLS,
        // Fase 2.1 — header más compacto (px-1.5 / py-0.5).
        // Fase 4.4 — sticky top para que el header se mantenga visible
        // durante scroll vertical en composiciones largas. `bg-card`
        // evita que las filas debajo se vean a través del header
        // semi-transparente. `z-10` lo mantiene sobre las filas pero por
        // debajo del modal.
        "sticky top-0 z-10 bg-card",
        "px-1.5 py-1 border-b border-slate-200/40 dark:border-slate-700/30 text-[10px] font-medium normal-case text-muted/60",
      )}
      style={gridStyle}
    >
      <span aria-hidden />
      {/* FASE F23 — todos los títulos centrados, incluyendo Componente.
          Cada header tiene un ColumnResizeHandle en el borde derecho. */}
      {RESIZABLE_COLS.map((col, i) => (
        <span
          key={col.key}
          data-column-header={col.key}
          className="relative text-center px-1"
          title={
            col.key === "costoUnit"   ? "Costo base del componente"
          : col.key === "mermaAjuste" ? "Merma (METAL) o Bonif./Recargo (HECHURA/PRODUCT/SERVICE) editable"
          : col.key === "margen"      ? "Margen efectivo por línea (Venta − Costo Total). En listas con valor unificado, el margen se aplica al total y no se distribuye por línea (se muestra «—»)."
          : col.key === "costoTotal"  ? "Costo final del componente"
          : undefined
          }
        >
          {col.label}
          <ColumnResizeHandle
            index={i}
            widths={widths}
            onChange={onWidthsChange}
          />
        </span>
      ))}
      {/* FASE 12.2 — "P. unit venta", "Venta línea" y "Particip." quedan
          ocultos visualmente. Los datos siguen computándose en el caller
          (precioUnitVentaText / ventaLineaText / participacionText) por si
          se reactivan más adelante. */}
      <span aria-hidden />
    </div>
  );
}
