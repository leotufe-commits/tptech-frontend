// src/pages/ventas-facturas/InvoiceEditorModal/layout/__tests__/DraggableCard.test.tsx
// ============================================================================
// Garantías del wrapper:
//   · `enabled=false` → renderiza children SIN handle ni ring → cero
//     cambio visual respecto del JSX histórico.
//   · `enabled=true`  → muestra el grip handle con aria-label, y aplica
//     ring punteado al wrapper.
//   · El handle tiene aria-label "Arrastrar para reordenar" (a11y).
//   · El children sigue renderizándose intacto en ambos modos.
//
// NO testeamos el comportamiento de drag aquí — eso lo cubre el test del
// LayoutDndContext (que arma el contexto completo).
// ============================================================================

import React, { useRef } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DraggableCard, WIDTH_CLASS } from "../DraggableCard";

/** Helper: el `useSortable` requiere estar dentro de DndContext + SortableContext.
 *  En modo edición montamos un wrapper mínimo solo para no romper el hook. */
function withDndContext(children: React.ReactNode, items: string[]) {
  return (
    <DndContext>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

describe("DraggableCard — modo lectura (enabled=false)", () => {
  it("renderiza el children SIN handle ni atributos de drag", () => {
    render(
      <DraggableCard id="discount" enabled={false}>
        <div data-testid="contenido">child</div>
      </DraggableCard>,
    );
    expect(screen.getByTestId("contenido")).toBeInTheDocument();
    // No hay grip handle.
    expect(screen.queryByLabelText("Arrastrar para reordenar")).toBeNull();
  });

  it("NO envuelve el children en div extra (return <>...</>)", () => {
    const { container } = render(
      <DraggableCard id="discount" enabled={false}>
        <div data-testid="contenido">child</div>
      </DraggableCard>,
    );
    // El primer hijo del container es directamente el children original,
    // sin wrapper agregado por el componente.
    expect(container.firstChild).toHaveAttribute("data-testid", "contenido");
  });
});

describe("DraggableCard — modo edición (enabled=true)", () => {
  it("renderiza el children DENTRO del wrapper draggable", () => {
    render(
      withDndContext(
        <DraggableCard id="discount" enabled={true}>
          <div data-testid="contenido">child</div>
        </DraggableCard>,
        ["discount"],
      ),
    );
    expect(screen.getByTestId("contenido")).toBeInTheDocument();
  });

  it("muestra el grip handle con aria-label 'Arrastrar para reordenar'", () => {
    render(
      withDndContext(
        <DraggableCard id="discount" enabled={true}>
          <div>child</div>
        </DraggableCard>,
        ["discount"],
      ),
    );
    expect(screen.getByLabelText("Arrastrar para reordenar")).toBeInTheDocument();
  });

  it("el handle es un <button> (no inicia drag accidental sobre inputs internos)", () => {
    render(
      withDndContext(
        <DraggableCard id="discount" enabled={true}>
          <input data-testid="input-interno" />
        </DraggableCard>,
        ["discount"],
      ),
    );
    const handle = screen.getByLabelText("Arrastrar para reordenar");
    expect(handle.tagName).toBe("BUTTON");
    // El input interno sigue presente y NO es el handle.
    expect(screen.getByTestId("input-interno")).toBeInTheDocument();
  });
});

// ============================================================================
// Fase 3 — Resize handle integrado en DraggableCard.
// ============================================================================
function ResizeHarness(props: {
  enabled: boolean;
  width: "full" | "half" | "third" | "two-thirds";
  onResizeWidth?: (w: any) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  return (
    <div ref={ref}>
      {withDndContext(
        <DraggableCard
          id="discount"
          enabled={props.enabled}
          width={props.width}
          onResizeWidth={props.onResizeWidth}
          resizeContainerRef={ref as React.RefObject<HTMLElement | null>}
        >
          <div data-testid="contenido">child</div>
        </DraggableCard>,
        ["discount"],
      )}
    </div>
  );
}

describe("DraggableCard — width / resize integrado", () => {
  it("aplica la clase de width al wrapper en modo edición", () => {
    const { container } = render(
      <ResizeHarness enabled={true} width="half" onResizeWidth={vi.fn()} />,
    );
    // El wrapper del card debe contener `basis-` indicando width discreto.
    const wrapper = container.querySelector("[role='button']")
      ?? container.querySelector(".relative.rounded-md");
    expect(wrapper).toBeTruthy();
    expect((wrapper as HTMLElement).className).toMatch(/basis-/);
  });

  it("WIDTH_CLASS mapea correctamente cada width", () => {
    expect(WIDTH_CLASS.full).toMatch(/basis-full/);
    expect(WIDTH_CLASS.half).toMatch(/basis-/);
    expect(WIDTH_CLASS.third).toMatch(/basis-/);
    expect(WIDTH_CLASS["two-thirds"]).toMatch(/basis-/);
  });

  it("muestra el ResizeHandle cuando enabled=true + onResizeWidth", () => {
    render(<ResizeHarness enabled={true} width="full" onResizeWidth={vi.fn()} />);
    expect(screen.getByLabelText("Redimensionar ancho")).toBeInTheDocument();
  });

  it("NO muestra ResizeHandle cuando enabled=false (modo lectura)", () => {
    // En modo lectura el componente retorna children crudo → no hay ningún
    // handle (ni grip ni resize).
    render(<ResizeHarness enabled={false} width="full" onResizeWidth={vi.fn()} />);
    expect(screen.queryByLabelText("Redimensionar ancho")).toBeNull();
    expect(screen.queryByLabelText("Arrastrar para reordenar")).toBeNull();
  });

  it("NO muestra ResizeHandle si no se pasa onResizeWidth (drag-only mode)", () => {
    render(
      withDndContext(
        <DraggableCard id="discount" enabled={true} width="full">
          <div>x</div>
        </DraggableCard>,
        ["discount"],
      ),
    );
    expect(screen.queryByLabelText("Redimensionar ancho")).toBeNull();
    // Grip de drag sigue ahí.
    expect(screen.getByLabelText("Arrastrar para reordenar")).toBeInTheDocument();
  });
});
