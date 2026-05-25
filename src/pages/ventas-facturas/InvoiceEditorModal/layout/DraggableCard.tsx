// src/pages/ventas-facturas/InvoiceEditorModal/layout/DraggableCard.tsx
// ============================================================================
// Wrapper de drag & drop sobre una card del aside. Fase 2.
//
// Contrato:
//   · Fuera del modo edición (`enabled=false`): renderiza el `children` SIN
//     handle ni efectos visuales. Cero diferencia con el JSX histórico.
//   · En modo edición (`enabled=true`): envuelve el children en un container
//     con `useSortable`, agrega un grip handle a la izquierda (touch target
//     suficiente, no interfiere con inputs internos del card), y aplica
//     `transform/transition` durante el drag.
//
// IMPORTANTE — separación handle / contenido:
//   El `listeners` de useSortable se asocia SOLO al grip handle, no al
//   children. Esto evita que un click/touch sobre un input interno (p.ej.
//   TPNumberInput) inicie un drag accidental. El handle es la única forma
//   de iniciar el drag.
// ============================================================================

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "../../../../components/ui/tp";
import { ResizeHandle } from "./ResizeHandle";
import type { CardId, Width } from "./types";

/** Mapeo width → clases Tailwind. Acoplado al container `flex flex-wrap`
 *  que `VentasFacturas` usa en el aside cuando hay modo edición — `basis-*`
 *  define el % de ancho y el `flex-wrap` permite que varios cards quepan
 *  en la misma fila si suman ≤ 100%. En mobile y modo lectura el container
 *  es `space-y-3` (columna) y el width se ignora (cero efecto visual). */
export const WIDTH_CLASS: Record<Width, string> = {
  full:         "basis-full",
  "two-thirds": "basis-full sm:basis-[calc(66.6667%-0.375rem)]",
  half:         "basis-full sm:basis-[calc(50%-0.375rem)]",
  third:        "basis-full sm:basis-[calc(33.3333%-0.5rem)]",
};

export type DraggableCardProps = {
  /** Id estable de la card (= layout.cards[i].id). Pasa al sortable como `id`. */
  id:       CardId;
  /** Si false, renderiza children tal cual (modo lectura). */
  enabled:  boolean;
  /** Width persistido de la card. En modo lectura NO se aplica (no se
   *  envuelve el children). En modo edición se mapea a `basis-*` para
   *  permitir multi-columna en el aside. */
  width?:   Width;
  /** Handler que se llama tras un snap del resize. Si no se pasa, el
   *  resize handle no se renderiza (solo drag). */
  onResizeWidth?: (next: Width) => void;
  /** Container DOM de referencia para calcular fracción del drag (típico:
   *  el `<aside>`). Solo se usa cuando hay onResizeWidth + enabled. */
  resizeContainerRef?: React.RefObject<HTMLElement | null>;
  /** Card real — un componente presentacional ya construido en VentasFacturas. */
  children: React.ReactNode;
};

export function DraggableCard({
  id, enabled, width, onResizeWidth, resizeContainerRef, children,
}: DraggableCardProps): React.ReactElement {
  const sortable = useSortable({ id, disabled: !enabled });
  const {
    setNodeRef,
    transform,
    transition,
    isDragging,
    attributes,
    listeners,
  } = sortable;

  // Fuera del modo edición — sin wrapper de drag, sin estilos, sin handle.
  // Cero diferencia visual con el render histórico de Fase 1.
  if (!enabled) {
    return <>{children}</>;
  }

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // El card "fantasma" del item arrastrado queda con opacidad reducida.
    // El item visible que sigue al cursor lo provee el DragOverlay del
    // contexto (LayoutDndContext) — separa el "origen" del "moving".
    opacity: isDragging ? 0.4 : 1,
  };

  // Width efectivo en modo edición. Fuera del modo edición no se aplica
  // (la rama anterior retorna {children} crudo).
  const widthClass = width ? WIDTH_CLASS[width] : "basis-full";

  return (
    <div
      ref={setNodeRef}
      style={style}
      // Borde discreto + sombra cuando está en modo edición pero NO siendo
      // arrastrado: indica al operador que es interactivo. Cuando isDragging
      // (origen) lo dejamos en su sitio con opacity 0.4 (placeholder).
      // `basis-*` define el ancho dentro del container `flex flex-wrap` del
      // aside (cuando hay modo edición). Mobile: `basis-full` siempre.
      className={cn(
        "relative rounded-md transition-shadow",
        widthClass,
        !isDragging && "ring-1 ring-dashed ring-border/40",
      )}
      {...attributes}
    >
      {/* Grip handle — único elemento con los listeners del drag. Tamaño
          generoso (touch target ≥ 24px) sin invadir el contenido del card.
          `cursor-grab` / `cursor-grabbing` según estado. */}
      <button
        type="button"
        aria-label="Arrastrar para reordenar"
        title="Arrastrar para reordenar"
        // `data-tp-enter="ignore"` mantiene la convención del proyecto:
        // el grip NO debe disparar guardados ni navegación con Enter.
        data-tp-enter="ignore"
        tabIndex={0}
        className={cn(
          "absolute left-1 top-1 z-10 inline-flex h-6 w-6 items-center justify-center",
          "rounded-md text-muted transition-colors",
          "hover:bg-surface2/60 hover:text-text",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
          isDragging ? "cursor-grabbing" : "cursor-grab",
        )}
        {...listeners}
      >
        <GripVertical size={14} aria-hidden />
      </button>
      {/* El contenido real del card. Vive en su propio div para que los
          inputs internos NO compartan el ref ni los listeners del drag. */}
      {children}
      {/* Resize handle — solo se renderiza si el caller pasa handler. Vive
          en la esquina inferior derecha, consume sus propios pointer events
          (stopPropagation) para no pisar el drag del grip. Oculto en mobile. */}
      {onResizeWidth && resizeContainerRef && (
        <ResizeHandle
          width={width ?? "full"}
          containerRef={resizeContainerRef}
          enabled={enabled}
          onChange={onResizeWidth}
        />
      )}
    </div>
  );
}
