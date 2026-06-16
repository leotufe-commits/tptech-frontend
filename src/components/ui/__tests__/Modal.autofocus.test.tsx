// src/components/ui/__tests__/Modal.autofocus.test.tsx
// ============================================================================
// UX fix (2026-06-13) — Bug "solo queda un carácter" en modales de edición.
//
// Causa raíz: el autofocus del Modal hacía `focus()` + `select()` (select-all)
// sobre el campo `data-tp-autofocus`. En modo edición (campo precargado) eso
// dejaba TODO el texto seleccionado, así que la primera tecla REEMPLAZABA el
// valor completo. Fix: colapsar el caret al FINAL del texto en vez de
// seleccionar todo. El autofocus sigue funcionando (campo enfocado), pero NO
// pisa el contenido existente.
//
// Nota jsdom: `isFocusable()` del Modal exige caja de layout
// (`getClientRects().length`), que jsdom no calcula. Lo mockeamos para que el
// autofocus pueda enfocar el input real (si no, caería al header del modal).
// ============================================================================
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Modal } from "../Modal";

describe("Modal — autofocus coloca el caret al final (no select-all)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue(
      [{ width: 10, height: 10 } as DOMRect] as unknown as DOMRectList,
    );
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    cleanup();
  });

  // El autofocus corre vía setTimeout(0) + raf + setTimeout(60/180). Avanzamos
  // los timers para que el efecto enfoque el campo.
  function runAutofocus() {
    vi.advanceTimersByTime(200);
  }

  it("EDIT — campo precargado: enfoca pero NO selecciona todo (caret al final)", () => {
    const ref = React.createRef<HTMLInputElement>();
    render(
      <Modal open title="Editar canal" onClose={() => {}}>
        <input ref={ref} data-tp-autofocus="1" defaultValue="Mercado Libre" />
      </Modal>,
    );
    runAutofocus();

    const input = ref.current!;
    // El autofocus sigue siendo útil: el campo queda enfocado.
    expect(document.activeElement).toBe(input);
    // NO select-all: el rango NO es [0, length]. Caret colapsado al final.
    expect(input.selectionStart).toBe(input.value.length);
    expect(input.selectionEnd).toBe(input.value.length);
    expect(input.selectionStart).toBe(input.selectionEnd); // sin selección
  });

  it("CREATE — campo vacío: enfoca con caret al inicio (longitud 0)", () => {
    const ref = React.createRef<HTMLInputElement>();
    render(
      <Modal open title="Nuevo canal" onClose={() => {}}>
        <input ref={ref} data-tp-autofocus="1" defaultValue="" />
      </Modal>,
    );
    runAutofocus();

    const input = ref.current!;
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(0);
  });

  it("No devuelve el foco a Nombre tras enfocar Valor (cancela la reafirmación)", () => {
    const nombreRef = React.createRef<HTMLInputElement>();
    const valorRef = React.createRef<HTMLInputElement>();
    render(
      <Modal open title="Editar canal" onClose={() => {}}>
        <input ref={nombreRef} data-tp-autofocus="1" defaultValue="Mercado Libre" />
        <input ref={valorRef} aria-label="valor" defaultValue="" />
      </Modal>,
    );
    runAutofocus(); // autofocus inicial → Nombre
    // El usuario mueve el foco a Valor.
    valorRef.current!.focus();
    expect(document.activeElement).toBe(valorRef.current);
    // Simula el "race": un re-render deja el foco fuera del modal un instante.
    (document.activeElement as HTMLElement).blur();
    vi.advanceTimersByTime(400); // varios ticks del guard (50 ms)
    // El intervalo fue cancelado → el foco NO fue robado de vuelta a Nombre.
    expect(document.activeElement).not.toBe(nombreRef.current);
  });

  it("No devuelve el foco a Nombre tras enfocar Notas (textarea)", () => {
    const nombreRef = React.createRef<HTMLInputElement>();
    const notasRef = React.createRef<HTMLTextAreaElement>();
    render(
      <Modal open title="Editar canal" onClose={() => {}}>
        <input ref={nombreRef} data-tp-autofocus="1" defaultValue="Mercado Libre" />
        <textarea ref={notasRef} aria-label="notas" defaultValue="" />
      </Modal>,
    );
    runAutofocus();
    notasRef.current!.focus();
    expect(document.activeElement).toBe(notasRef.current);
    (document.activeElement as HTMLElement).blur();
    vi.advanceTimersByTime(400);
    expect(document.activeElement).not.toBe(nombreRef.current);
  });
});
