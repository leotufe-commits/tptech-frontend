// src/components/sales/SaleCompositionEditableGrid/parts/TypeGroupFooter.tsx
// =============================================================================
// FASE F7 — Fila de "Total <grupo>" al cierre de cada bloque visible.
// Display only — sin inputs ni iconos editables. Refleja sumas ya
// emitidas por el motor backend; cero matemática comercial nueva.
// Layout: usa TABLE_COLS_CLS para alinear con la grilla; las columnas
// "Costo Total" y "Costo de Venta" muestran los montos en tabular-nums.
// =============================================================================

import React from "react";
import { cn } from "../../../ui/tp";
import {
  COMPONENT_TYPE_TEXT,
  type ComponentTypeKey,
} from "../../../../lib/pricing/component-type-colors";
import { formatByType, formatDecimal } from "../../../../lib/pricing/format";
import { GROUP_HEADER_BG, TABLE_COLS_CLS } from "../constants";
import { TableLayoutContext } from "../context";

export function TypeGroupFooter({
  label, costTotal, saleTotal, currency, type, quantityTotal = null,
}: {
  label:     string;
  costTotal: number | null;
  saleTotal: number | null;
  currency:  string;
  type:      ComponentTypeKey;
  /** Suma de la columna "Cantidad" del grupo. Display only — NO altera
   *  ningún cálculo financiero. Se muestra SIEMPRE (incluso 1 línea). */
  quantityTotal?: number | null;
}) {
  const gridTpl = React.useContext(TableLayoutContext);
  const fmt = (v: number) => `${currency} ${formatDecimal(v, 2)}`;
  return (
    <div
      data-group-footer={type}
      className={cn(
        TABLE_COLS_CLS,
        // FASE F19 — sin border-top. F23 — grid layout viene del context.
        "mt-1 mb-2 rounded-b px-1.5 py-1",
        GROUP_HEADER_BG[type],
      )}
      style={{ gridTemplateColumns: gridTpl }}
    >
      {/* Col 1 — icono */}
      <span aria-hidden />
      {/* Col 2 — Componente */}
      <span className={cn("text-[11px] font-semibold", COMPONENT_TYPE_TEXT[type])}>
        Total {label}
      </span>
      {/* Col 3 — Cantidad: total del grupo (siempre, incluso 1 línea).
          Centrado para alinear con la celda Cantidad de cada fila. */}
      <span className="text-center text-[11px] tabular-nums font-semibold text-text/85">
        {quantityTotal != null && Number.isFinite(quantityTotal)
          ? formatByType(quantityTotal, "QUANTITY", { bare: true })
          : "—"}
      </span>
      {/* Col 4 — Unidad (FASE F21) */}
      <span aria-hidden />
      {/* Col 5 — Costo unit. */}
      <span aria-hidden />
      {/* Col 6 — Merma / Ajuste (FASE F22) */}
      <span aria-hidden />
      {/* Col 7 — Costo Total (FASE F24: vuelve antes de Margen) */}
      <span className="text-center text-[11px] tabular-nums font-semibold text-text/85">
        {costTotal != null && Number.isFinite(costTotal) ? fmt(costTotal) : "—"}
      </span>
      {/* Col 8 — Margen (FASE F24) — vacío en totales (sin margen agregado a nivel grupo) */}
      <span className="text-center text-[11px] tabular-nums text-muted/40">—</span>
      {/* Col 9 — Costo de Venta */}
      <span className="text-center text-[11px] tabular-nums font-semibold text-text/85">
        {saleTotal != null && Number.isFinite(saleTotal) ? fmt(saleTotal) : "—"}
      </span>
      {/* Col 10 — acciones */}
      <span aria-hidden />
    </div>
  );
}
