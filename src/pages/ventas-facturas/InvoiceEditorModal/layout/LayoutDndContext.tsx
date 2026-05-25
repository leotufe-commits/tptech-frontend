// src/pages/ventas-facturas/InvoiceEditorModal/layout/LayoutDndContext.tsx
// ============================================================================
// Contexto de drag & drop del aside. Fase 2.
//
// Responsabilidades:
//   · Montar `<DndContext>` + `<SortableContext>` con la lista de ids del
//     slot "aside" en su orden actual.
//   · Configurar sensores (Pointer + Keyboard) con activación por
//     distance/keyCode para que micro-clicks no inicien drag.
//   · Convertir el evento `onDragEnd` en un nuevo `LayoutConfig` y dispararlo
//     vía `onLayoutChange` (el padre llama `setLayout` del hook).
//   · Renderizar un `DragOverlay` minimalista con el card "fantasma" que
//     sigue al cursor.
//
// Cero impacto en lectura: cuando `enabled=false`, este componente NO se
// monta — el padre renderiza el aside como antes.
// ============================================================================

import React, { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import type { CardId, LayoutConfig, Slot } from "./types";

export type LayoutDndContextProps = {
  /** Layout actual (proviene del hook `useInvoiceLayout`). */
  layout:          LayoutConfig;
  /** Slot que se está reordenando. Fase 2 solo soporta "aside" pero el
   *  componente acepta cualquiera para futuras fases. */
  slot:            Slot;
  /** Callback con el layout NUEVO tras un drop. El padre lo persiste vía
   *  `useInvoiceLayout.setLayout`. */
  onLayoutChange:  (next: LayoutConfig) => void;
  /** Hijos = los `<DraggableCard>` ya iterados por el padre. */
  children:        React.ReactNode;
};

export function LayoutDndContext(props: LayoutDndContextProps): React.ReactElement {
  const { layout, slot, onLayoutChange, children } = props;

  // Etapa 3 — Trackeamos el id activo durante el drag para alimentar el
  // DragOverlay enriquecido (ghost placeholder que sigue al cursor con
  // anillo + sombra, en vez del DragOverlay vacío del Fase 2). El ghost
  // NO es el contenido real del card (eso requeriría un map id→ReactNode
  // del padre), solo un placeholder estilizado que comunica "arrastrando".
  const [activeId, setActiveId] = useState<CardId | null>(null);

  // Lista de ids del slot en su orden actual — alimenta `SortableContext`.
  // Memoizada por referencia estable de `layout.cards` para no recrear el
  // contexto en cada render.
  const itemIds = useMemo<CardId[]>(
    () =>
      layout.cards
        .filter((c) => c.slot === slot)
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((c) => c.id),
    [layout.cards, slot],
  );

  // Sensores:
  //  · Pointer con `distance: 4px` → no se dispara drag con un click simple
  //    (deja pasar el focus a inputs internos / botones del card).
  //  · Keyboard con coordinator vertical → Tab + Space + arrow keys mueven
  //    cards entre posiciones del slot (a11y nativa).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as CardId);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = itemIds.indexOf(active.id as CardId);
    const newIndex = itemIds.indexOf(over.id as CardId);
    if (oldIndex < 0 || newIndex < 0) return;

    const newSlotOrder = arrayMove(itemIds, oldIndex, newIndex);

    // Reconstruir el layout: las cards del slot se reasignan con
    // `order = índice en newSlotOrder`. Las cards de OTROS slots quedan
    // intactas. Cero impacto comercial — solo `order` cambia.
    const orderById = new Map<CardId, number>();
    newSlotOrder.forEach((id, i) => orderById.set(id, i));
    const nextCards = layout.cards.map((c) =>
      c.slot === slot
        ? { ...c, order: orderById.get(c.id) ?? c.order }
        : c,
    );
    onLayoutChange({ ...layout, cards: nextCards });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
      // Restricciones: solo movimiento vertical, dentro del slot. Evita que
      // el operador arrastre una card del aside fuera de la columna.
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
      {/* Etapa 3 — DragOverlay enriquecido: cuando hay drag activo,
          renderea un "ghost rectangle" estilizado siguiendo al cursor.
          El placeholder muestra el id de la card (debug-friendly) y un
          anillo + sombra que comunica claramente "estás arrastrando esto".
          Si no hay drag activo, devuelve null — cero impacto en lectura. */}
      <DragOverlay dropAnimation={null}>
        {activeId ? (
          <div
            className="pointer-events-none rounded-md border-2 border-dashed border-primary/70 bg-primary/5 px-3 py-2 shadow-lg ring-1 ring-primary/30"
            data-tp-invoice-layout-drag-ghost={activeId}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
              {activeId}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
