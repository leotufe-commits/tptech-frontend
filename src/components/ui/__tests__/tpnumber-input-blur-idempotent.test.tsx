// src/components/ui/__tests__/tpnumber-input-blur-idempotent.test.tsx
// ============================================================================
// Regresión: TPNumberInput.onBlur debe ser IDEMPOTENTE — TAB/focus no muta.
//
// Bug original: al navegar con TAB sobre un campo Bonificación precargado
// (heredado del cliente), el blur disparaba `onChange(valor)` con el mismo
// número que ya tenía, lo que el caller interpretaba como edición → marcaba
// override manual → el motor reemplazaba la composición auto por el manual
// con base de cálculo distinta → el valor terminaba cayendo a 0 o cambiando.
//
// Fix: el onBlur ahora compara contra `lastEmittedRef.current` y solo emite
// `onChange` cuando hubo edición real.
// ============================================================================

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TPNumberInput from "../TPNumberInput";

describe("TPNumberInput — blur idempotente", () => {
  it("focus + blur sin cambios NO dispara onChange (value heredado)", () => {
    const onChange = vi.fn();
    render(
      <TPNumberInput
        value={15}
        onChange={onChange}
        decimals={2}
      />,
    );
    const input = screen.getByRole("textbox") as HTMLInputElement;

    // Simular navegación con TAB: focus → blur sin edición.
    fireEvent.focus(input);
    fireEvent.blur(input);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("focus + blur sin cambios sobre value 0 NO dispara onChange", () => {
    const onChange = vi.fn();
    render(
      <TPNumberInput
        value={0}
        onChange={onChange}
        decimals={2}
      />,
    );
    const input = screen.getByRole("textbox") as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.blur(input);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("focus + blur sobre value null NO dispara onChange(null) redundante", () => {
    const onChange = vi.fn();
    render(
      <TPNumberInput
        value={null}
        onChange={onChange}
        decimals={2}
      />,
    );
    const input = screen.getByRole("textbox") as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.blur(input);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("editar el valor SÍ dispara onChange con el nuevo número", () => {
    const onChange = vi.fn();
    render(
      <TPNumberInput
        value={15}
        onChange={onChange}
        decimals={2}
      />,
    );
    const input = screen.getByRole("textbox") as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "20" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last).toBe(20);
  });

  it("borrar el contenido (campo a vacío) SÍ dispara onChange(null) una vez", () => {
    const onChange = vi.fn();
    render(
      <TPNumberInput
        value={15}
        onChange={onChange}
        decimals={2}
      />,
    );
    const input = screen.getByRole("textbox") as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toBeNull();
  });

  it("focus + blur múltiples veces sin cambios NO dispara onChange (TAB sucesivo)", () => {
    // Simula al operador pasando con TAB varias veces sobre el mismo
    // campo (entrar/salir tres veces). Ninguna debe disparar onChange.
    const onChange = vi.fn();
    render(
      <TPNumberInput
        value={15}
        onChange={onChange}
        decimals={2}
      />,
    );
    const input = screen.getByRole("textbox") as HTMLInputElement;

    for (let i = 0; i < 3; i++) {
      fireEvent.focus(input);
      fireEvent.blur(input);
    }
    expect(onChange).not.toHaveBeenCalled();
  });
});
