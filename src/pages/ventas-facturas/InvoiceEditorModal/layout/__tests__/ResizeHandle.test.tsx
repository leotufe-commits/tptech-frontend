// src/pages/ventas-facturas/InvoiceEditorModal/layout/__tests__/ResizeHandle.test.tsx
// ============================================================================
// Garantías del ResizeHandle:
//   1) enabled=false → componente devuelve null (no se renderiza en modo lectura).
//   2) enabled=true  → handle visible con aria-label "Redimensionar ancho".
//   3) snapWidth → la fracción se redondea al width discreto más cercano.
//   4) Pointer drag horizontal → emite onChange cuando cruza el bucket.
//   5) Mobile: handle tiene clase `hidden sm:inline-flex` (oculto < sm).
// ============================================================================

import React, { useRef } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResizeHandle, snapWidth, WIDTH_FRACTION } from "../ResizeHandle";
import type { Width } from "../types";

/** Render harness — provee un container con clientWidth fijo. */
function Harness({
  enabled, width, onChange, containerWidth = 600,
}: {
  enabled: boolean;
  width: Width;
  onChange: (w: Width) => void;
  containerWidth?: number;
}) {
  const ref = useRef<HTMLElement | null>(null);
  // Fijar clientWidth simulado: jsdom no calcula layout, así que parcheamos
  // la prop directamente en el efecto inicial vía un attribute.
  return (
    <section
      ref={ref as any}
      style={{ width: containerWidth }}
      // jsdom no aplica layout, pero leemos el style.width — el componente
      // usa `clientWidth`. Simulamos vía `Object.defineProperty` sobre el
      // node real (ver test setup más abajo).
      data-testid="container"
    >
      <ResizeHandle
        width={width}
        containerRef={ref as React.RefObject<HTMLElement | null>}
        enabled={enabled}
        onChange={onChange}
      />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// snapWidth — pure function tests (más rápido y robusto que e2e del drag).
// ─────────────────────────────────────────────────────────────────────────────
describe("snapWidth — bucket más cercano", () => {
  it("fracción 1.0 → full", () => {
    expect(snapWidth(1.0)).toBe("full");
  });
  it("fracción 0.95 → full (umbral cercano)", () => {
    expect(snapWidth(0.95)).toBe("full");
  });
  it("fracción 0.66 → two-thirds", () => {
    expect(snapWidth(0.66)).toBe("two-thirds");
  });
  it("fracción 0.55 → half (más cerca de 0.5 que de 0.667)", () => {
    expect(snapWidth(0.55)).toBe("half");
  });
  it("fracción 0.45 → half (más cerca de 0.5 que de 0.333)", () => {
    expect(snapWidth(0.45)).toBe("half");
  });
  it("fracción 0.34 → third", () => {
    expect(snapWidth(0.34)).toBe("third");
  });
  it("fracción 0.20 → third (clamp inferior)", () => {
    expect(snapWidth(0.20)).toBe("third");
  });
  it("WIDTH_FRACTION valores canónicos", () => {
    expect(WIDTH_FRACTION.full).toBe(1.0);
    expect(WIDTH_FRACTION.half).toBe(0.5);
    expect(WIDTH_FRACTION.third).toBeCloseTo(1 / 3, 6);
    expect(WIDTH_FRACTION["two-thirds"]).toBeCloseTo(2 / 3, 6);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Render conditional.
// ─────────────────────────────────────────────────────────────────────────────
describe("ResizeHandle — render conditional", () => {
  it("enabled=false → devuelve null (no renderiza)", () => {
    render(<Harness enabled={false} width="full" onChange={vi.fn()} />);
    expect(screen.queryByLabelText("Redimensionar ancho")).toBeNull();
  });

  it("enabled=true → muestra el handle con aria-label", () => {
    render(<Harness enabled={true} width="full" onChange={vi.fn()} />);
    expect(screen.getByLabelText("Redimensionar ancho")).toBeInTheDocument();
  });

  it("handle es un <button> con cursor-ew-resize", () => {
    render(<Harness enabled={true} width="full" onChange={vi.fn()} />);
    const handle = screen.getByLabelText("Redimensionar ancho");
    expect(handle.tagName).toBe("BUTTON");
    expect(handle.className).toMatch(/cursor-ew-resize/);
  });

  it("handle oculto en mobile via clases responsive (hidden sm:inline-flex)", () => {
    render(<Harness enabled={true} width="full" onChange={vi.fn()} />);
    const handle = screen.getByLabelText("Redimensionar ancho");
    expect(handle.className).toMatch(/hidden/);
    expect(handle.className).toMatch(/sm:inline-flex/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pointer drag → onChange. Simulamos eventos del puntero forzando
// clientWidth del container vía Object.defineProperty (jsdom no layoutea).
// ─────────────────────────────────────────────────────────────────────────────
describe("ResizeHandle — drag horizontal emite onChange", () => {
  function setClientWidth(el: HTMLElement, w: number) {
    Object.defineProperty(el, "clientWidth", { configurable: true, value: w });
  }

  it("drag a la izquierda desde full → emite snap a width menor", () => {
    const onChange = vi.fn();
    const { container } = render(<Harness enabled={true} width="full" onChange={onChange} />);
    setClientWidth(container.querySelector("[data-testid=container]") as HTMLElement, 600);

    const handle = screen.getByLabelText("Redimensionar ancho");
    // pointerdown en x=600 → captura start.
    fireEvent.pointerDown(handle, { clientX: 600, pointerId: 1 });
    // pointermove a x=300 → delta=-300 → fracción 1.0 + (-300/600) = 0.5 → half
    fireEvent.pointerMove(handle, { clientX: 300, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 300, pointerId: 1 });

    expect(onChange).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith("half");
  });

  it("drag pasa por varios buckets emite onChange en cada cruce", () => {
    const onChange = vi.fn();
    const { container } = render(<Harness enabled={true} width="full" onChange={onChange} />);
    setClientWidth(container.querySelector("[data-testid=container]") as HTMLElement, 600);

    const handle = screen.getByLabelText("Redimensionar ancho");
    fireEvent.pointerDown(handle, { clientX: 600, pointerId: 1 });
    // x=450 → -150 → frac=0.75 → two-thirds (mucho más cerca de 0.667 que de 1.0)
    fireEvent.pointerMove(handle, { clientX: 450, pointerId: 1 });
    // x=300 → -300 → frac=0.5 → half
    fireEvent.pointerMove(handle, { clientX: 300, pointerId: 1 });
    // x=200 → -400 → frac=0.333 → third
    fireEvent.pointerMove(handle, { clientX: 200, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 200, pointerId: 1 });

    // Debe haber recibido al menos los 3 cambios: two-thirds → half → third
    const calls = onChange.mock.calls.map((c) => c[0]);
    expect(calls).toContain("two-thirds");
    expect(calls).toContain("half");
    expect(calls).toContain("third");
  });

  it("NO emite cambios cuando el delta queda en el mismo bucket", () => {
    const onChange = vi.fn();
    const { container } = render(<Harness enabled={true} width="full" onChange={onChange} />);
    setClientWidth(container.querySelector("[data-testid=container]") as HTMLElement, 600);

    const handle = screen.getByLabelText("Redimensionar ancho");
    fireEvent.pointerDown(handle, { clientX: 600, pointerId: 1 });
    // micro-move x=595 → delta=-5 → frac=0.9917 → sigue "full"
    fireEvent.pointerMove(handle, { clientX: 595, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 595, pointerId: 1 });
    expect(onChange).not.toHaveBeenCalled();
  });
});
