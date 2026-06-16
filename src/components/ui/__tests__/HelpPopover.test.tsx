// src/components/ui/__tests__/HelpPopover.test.tsx
// Comportamiento del HelpPopover (Ayuda rápida contextual): cerrado por
// default, abre al click en `?`, muestra la sección activa + el resto, y cierra
// con re-click o click fuera. Los textos se renderizan tal cual se pasan.
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { HelpPopover } from "../HelpPopover";

const ENTRIES = {
  a: { title: "Sección A", body: "Cuerpo A" },
  b: { title: "Sección B", body: "Cuerpo B" },
} as const;

describe("HelpPopover — ayuda rápida contextual", () => {
  afterEach(() => cleanup());

  it("cerrado por default: el contenido no se muestra", () => {
    render(<HelpPopover entries={ENTRIES} active="a" />);
    expect(screen.queryByText("Cuerpo A")).toBeNull();
  });

  it("click en ? abre el panel con la sección activa + el resto", () => {
    render(<HelpPopover entries={ENTRIES} active="a" />);
    fireEvent.click(screen.getByRole("button", { name: /ayuda/i }));
    expect(screen.getByText("Cuerpo A")).toBeInTheDocument(); // activa destacada
    expect(screen.getByText(/Sección B:/)).toBeInTheDocument(); // otras como referencia
  });

  it("re-click en ? cierra el panel", () => {
    render(<HelpPopover entries={ENTRIES} active="a" />);
    const btn = screen.getByRole("button", { name: /ayuda/i });
    fireEvent.click(btn);
    expect(screen.getByText("Cuerpo A")).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByText("Cuerpo A")).toBeNull();
  });

  it("click fuera cierra el panel", () => {
    render(
      <>
        <div data-testid="outside">fuera</div>
        <HelpPopover entries={ENTRIES} active="a" />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: /ayuda/i }));
    expect(screen.getByText("Cuerpo A")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByText("Cuerpo A")).toBeNull();
  });
});
