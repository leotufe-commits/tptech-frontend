// src/pages/ventas-facturas/InvoiceEditorModal/layout/ResizeHandle.tsx
// ============================================================================
// Resize handle del card. Fase 3.
//
// Contrato:
//   · Visible SOLO cuando `enabled=true`. Oculto fuera del modo edición
//     (cero cambio visual en modo lectura).
//   · En mobile (`< sm`) se oculta vía clase Tailwind `hidden sm:flex` → el
//     resize no aplica con un solo column de ancho.
//   · El handle es un `<button>` con `cursor-ew-resize` y `pointer events`
//     que detecta drag horizontal sobre un contenedor de referencia (el
//     aside) y snapea al WIDTH discreto más cercano en cada cruce de
//     umbral. Llama `onChange(nextWidth)` SOLO cuando cambia el bucket.
//   · Cero cálculo comercial — solo geometría DOM relativa al aside.
//
// Importante — separación del grip de drag:
//   El handle vive en la ESQUINA INFERIOR DERECHA del card y consume sus
//   propios pointer events con `stopPropagation` para que el sortable del
//   drag no se confunda con un click sobre el resize.
// ============================================================================

import React, { useCallback, useEffect, useRef } from "react";
import { cn } from "../../../../components/ui/tp";
import { VALID_WIDTHS, type Width } from "./types";

export type ResizeHandleProps = {
  /** Width actual de la card. El handle muestra feedback visual cuando cambia. */
  width:    Width;
  /** Container DOM de referencia (típicamente el `<aside>`). El handle mide
   *  `containerEl.clientWidth` para calcular la fracción del drag y snapear
   *  al width discreto más cercano. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Si false, el componente devuelve `null` (no renderiza nada). */
  enabled:  boolean;
  /** Handler que recibe el nuevo width DESPUÉS del snap. El padre persiste
   *  vía `useInvoiceLayout.setLayout`. */
  onChange: (next: Width) => void;
};

// Mapeo width → fracción canónica (0..1). Usado para:
//   · derivar la fracción "actual" del card en el container.
//   · derivar el snapping desde la fracción "live" durante el drag.
const WIDTH_FRACTION: Record<Width, number> = {
  full:         1.0,
  "two-thirds": 2 / 3,
  half:         0.5,
  third:        1 / 3,
};

/** Devuelve el `Width` cuya fracción es más cercana al valor dado. */
function snapWidth(fraction: number): Width {
  let best: Width = "full";
  let bestDiff = Infinity;
  for (const w of VALID_WIDTHS) {
    const diff = Math.abs(fraction - WIDTH_FRACTION[w]);
    if (diff < bestDiff) { best = w; bestDiff = diff; }
  }
  return best;
}

export function ResizeHandle(props: ResizeHandleProps): React.ReactElement | null {
  const { width, containerRef, enabled, onChange } = props;

  // Trackeo del drag — startX y startFraction se capturan en pointerDown,
  // luego los movimientos comparan contra eso para calcular la fracción
  // "live" relativa al ancho del container.
  const dragRef = useRef<{
    startX:        number;
    startFraction: number;
    containerW:    number;
    lastEmitted:   Width;
  } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!enabled) return;
    const containerEl = containerRef.current;
    if (!containerEl) return;
    e.preventDefault();
    e.stopPropagation(); // evita iniciar drag del card (sortable)
    (e.target as HTMLButtonElement).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      startX:        e.clientX,
      startFraction: WIDTH_FRACTION[width],
      containerW:    containerEl.clientWidth,
      lastEmitted:   width,
    };
  }, [enabled, containerRef, width]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || d.containerW <= 0) return;
    // Delta horizontal en píxeles → delta de fracción → nueva fracción.
    const deltaPx     = e.clientX - d.startX;
    const newFraction = Math.min(1, Math.max(0.1, d.startFraction + deltaPx / d.containerW));
    const snapped     = snapWidth(newFraction);
    if (snapped !== d.lastEmitted) {
      d.lastEmitted = snapped;
      onChange(snapped);
    }
  }, [onChange]);

  const finishDrag = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d) return;
    (e.target as HTMLButtonElement).releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
  }, []);

  // Cleanup defensivo si el componente se desmonta a mitad de drag.
  useEffect(() => () => { dragRef.current = null; }, []);

  if (!enabled) return null;

  return (
    <button
      type="button"
      aria-label="Redimensionar ancho"
      title="Arrastrar horizontalmente para cambiar el ancho"
      // Convención del proyecto — el handle no dispara Enter ni navegación.
      data-tp-enter="ignore"
      tabIndex={-1}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      // Posicionado en la esquina inferior derecha del card. Oculto bajo
      // breakpoint `sm` (mobile = single-column siempre).
      className={cn(
        "absolute right-1 bottom-1 z-10 hidden h-6 w-6 items-center justify-center",
        "rounded-md text-muted transition-colors",
        "hover:bg-surface2/60 hover:text-text",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
        "cursor-ew-resize select-none touch-none sm:inline-flex",
      )}
    >
      {/* Icono "drag horizontal" — flecha doble. Sin lucide para no agregar
          dependencia: 2 chevrons inline en SVG ligero. */}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M8 7 4 12l4 5" />
        <path d="M16 7l4 5-4 5" />
      </svg>
    </button>
  );
}

// Exportamos `snapWidth` para tests unitarios — verifican que las fracciones
// del drag caen en el bucket esperado.
export { snapWidth, WIDTH_FRACTION };
