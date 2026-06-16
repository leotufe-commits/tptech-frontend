// Reproducción del bug "solo un carácter / el foco salta a Nombre" en Canales.
//
// CAUSA RAÍZ: el componente `Shell` está definido DENTRO del render de la página
// (ConfiguracionSistemaCanalesDeVenta.tsx) y se usa como `<Shell>...</Shell>`.
// En cada render `Shell` es una NUEVA identidad de función → React desmonta y
// REMONTA todo el subtree (tabla + Modal + inputs) en cada `setState`. Como
// cualquier tecleo dispara `setState`, los inputs reciben un nodo DOM nuevo en
// cada tecla: se pierde el foco y el autofocus del Modal se rearma → el cursor
// vuelve a "Nombre". El estado vive en el componente externo, así que el valor
// "acumula", pero el nodo cambia.
//
// Evidencia: tras un `setState` (tipear en el buscador, que vive dentro del
// árbol de la página), el input NO debe cambiar de identidad DOM. Un input
// controlado se actualiza in-place. Si el nodo es otro → remount → bug.
//
// FIX (2026-06-14): se eliminó el `Shell` inline; la página arma un `content`
// estable y elige el wrapper afuera. Este test es ahora el guard de regresión:
// pasa porque el subtree ya NO remonta. Si alguien reintroduce un componente
// definido dentro del render, vuelve a fallar.
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

vi.mock("../../../services/sales-channels", () => ({
  salesChannelsApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    toggle: vi.fn().mockResolvedValue({}),
    favorite: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue({}),
  },
}));
vi.mock("../../../lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import ConfiguracionSistemaCanalesDeVenta from "../ConfiguracionSistemaCanalesDeVenta";

describe("Canales — la página NO debe remontar el subtree al cambiar estado", () => {
  afterEach(() => cleanup());

  it("el input conserva su identidad DOM tras un setState (sin remount del Shell)", async () => {
    render(<ConfiguracionSistemaCanalesDeVenta embedded />);
    await screen.findByRole("button", { name: /Nuevo canal/i });

    const input1 = screen.getByPlaceholderText(/Buscar canal/i);
    fireEvent.change(input1, { target: { value: "a" } }); // dispara setQ → re-render
    const input2 = screen.getByPlaceholderText(/Buscar canal/i);

    // Si el `Shell` inline remonta el subtree, input1 !== input2 (nodo nuevo).
    expect(input2).toBe(input1); // identidad estable = NO remount
  });
});
