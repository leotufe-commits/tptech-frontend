// src/components/sales/SaleCompositionEditableGrid/parts/ColumnResizeHandle.tsx
// =============================================================================
// F23 — Handle de resize entre columnas. mousedown registra listeners en
// window; mousemove actualiza el ancho (clamped a min); mouseup persiste
// en localStorage. Doble click resetea al default. Visible solo en hover
// del header para no saturar.
// =============================================================================

import React from "react";
import { cn } from "../../../ui/tp";
import { COL_WIDTHS_DEFAULTS, COL_WIDTHS_MINS, RESIZABLE_COLS } from "../constants";

export function ColumnResizeHandle({
  index, widths, onChange,
}: {
  index: number;
  widths: number[];
  onChange: (next: number[]) => void;
}) {
  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = widths[index];
    const minW   = COL_WIDTHS_MINS[index];
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(minW, startW + (ev.clientX - startX));
      const arr  = widths.slice();
      arr[index] = Math.round(next);
      onChange(arr);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [index, widths, onChange]);

  const handleDoubleClick = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const arr = widths.slice();
    arr[index] = COL_WIDTHS_DEFAULTS[index];
    onChange(arr);
  }, [index, widths, onChange]);

  return (
    <span
      data-column-resize-handle={RESIZABLE_COLS[index].key}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      role="separator"
      aria-label={`Redimensionar columna ${RESIZABLE_COLS[index].label}`}
      title="Arrastrá para redimensionar · doble click para resetear"
      className={cn(
        // Hit area de 6px a la derecha del header (translado 50% del width).
        "absolute top-0 right-0 h-full w-1.5 cursor-col-resize",
        // Línea fina visible solo en hover/active (sutileza Linear/Excel).
        "after:absolute after:right-0 after:top-1 after:bottom-1 after:w-px",
        "after:bg-transparent hover:after:bg-primary/40 active:after:bg-primary/70",
        "after:transition-colors after:duration-150",
        "select-none",
      )}
    />
  );
}
