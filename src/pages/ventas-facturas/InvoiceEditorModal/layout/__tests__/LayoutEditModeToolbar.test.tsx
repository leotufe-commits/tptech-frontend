// src/pages/ventas-facturas/InvoiceEditorModal/layout/__tests__/LayoutEditModeToolbar.test.tsx
// ============================================================================
// Garantías de la toolbar:
//   · editing=false → NO renderiza "Personalizar layout" ni botones edición
//     (el entry vive ahora en el modal de Configuración del header).
//   · editing=true  → muestra "Restaurar diseño" + "Listo". Clicks llaman
//     a sus handlers respectivos.
// ============================================================================

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LayoutEditModeToolbar } from "../LayoutEditModeToolbar";

describe("LayoutEditModeToolbar — editing=false", () => {
  it("NO muestra 'Personalizar layout' ni botones de edición (modo lectura limpio)", () => {
    render(
      <LayoutEditModeToolbar
        editing={false}
        onEnter={vi.fn()} onExit={vi.fn()} onReset={vi.fn()}
      />,
    );
    expect(screen.queryByText("Personalizar layout")).toBeNull();
    expect(screen.queryByText("Restaurar diseño")).toBeNull();
    expect(screen.queryByText("Listo")).toBeNull();
  });
});

describe("LayoutEditModeToolbar — editing=true", () => {
  it("muestra 'Restaurar diseño' + 'Listo' y oculta 'Personalizar layout'", () => {
    render(
      <LayoutEditModeToolbar
        editing={true}
        onEnter={vi.fn()} onExit={vi.fn()} onReset={vi.fn()}
      />,
    );
    expect(screen.getByText("Restaurar diseño")).toBeInTheDocument();
    expect(screen.getByText("Listo")).toBeInTheDocument();
    expect(screen.queryByText("Personalizar layout")).toBeNull();
  });

  it("click en 'Restaurar diseño' llama onReset (sin cerrar el modo)", () => {
    const onReset = vi.fn();
    const onExit = vi.fn();
    render(
      <LayoutEditModeToolbar
        editing={true}
        onEnter={vi.fn()} onExit={onExit} onReset={onReset}
      />,
    );
    fireEvent.click(screen.getByText("Restaurar diseño"));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onExit).not.toHaveBeenCalled();
  });

  it("click en 'Listo' llama onExit", () => {
    const onExit = vi.fn();
    render(
      <LayoutEditModeToolbar
        editing={true}
        onEnter={vi.fn()} onExit={onExit} onReset={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Listo"));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Etapa 3 — onCancelChanges (botón "Cancelar cambios")
// ─────────────────────────────────────────────────────────────────────────────

describe("LayoutEditModeToolbar — Cancelar cambios (Etapa 3)", () => {
  it("sin onCancelChanges → NO renderiza el botón 'Cancelar cambios' (back-compat)", () => {
    render(
      <LayoutEditModeToolbar
        editing={true}
        onEnter={vi.fn()} onExit={vi.fn()} onReset={vi.fn()}
      />,
    );
    expect(screen.queryByText("Cancelar cambios")).toBeNull();
  });

  it("con onCancelChanges → renderiza el botón y click llama el handler", () => {
    const onCancelChanges = vi.fn();
    render(
      <LayoutEditModeToolbar
        editing={true}
        onEnter={vi.fn()} onExit={vi.fn()} onReset={vi.fn()}
        onCancelChanges={onCancelChanges}
      />,
    );
    const btn = screen.getByText("Cancelar cambios");
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onCancelChanges).toHaveBeenCalledTimes(1);
  });

  it("Cancelar cambios NO se renderiza en editing=false (no aplica fuera de edit mode)", () => {
    render(
      <LayoutEditModeToolbar
        editing={false}
        onEnter={vi.fn()} onExit={vi.fn()} onReset={vi.fn()}
        onCancelChanges={vi.fn()}
      />,
    );
    expect(screen.queryByText("Cancelar cambios")).toBeNull();
  });
});
