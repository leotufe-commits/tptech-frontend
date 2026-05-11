// src/components/ui/__tests__/FactorBreakdownHint.test.tsx
// ============================================================================
// Fase 4.2 — tests del componente reutilizable que reemplaza el JSX duplicado
// del hint del factor efectivo (8 sitios consolidados a 1).
//
// Confirma:
//   1. Renderiza el texto exacto (`(${compactLine})`) cuando `hasDivergence`
//      es true y `compactLine` no es null.
//   2. Devuelve null en los casos negativos (no muestra nada).
//   3. Aplica las clases base + className opcional.
//   4. Snapshot del DOM resultante para regression guard.
// ============================================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import FactorBreakdownHint from "../FactorBreakdownHint";

describe("FactorBreakdownHint — renderiza cuando hasDivergence + compactLine", () => {
  it("muestra el texto entre paréntesis", () => {
    render(
      <FactorBreakdownHint
        hasDivergence={true}
        compactLine="lista +50% · ajuste −25% · efectivo 1,13"
      />
    );
    expect(
      screen.getByText("(lista +50% · ajuste −25% · efectivo 1,13)")
    ).toBeTruthy();
  });

  it("aplica las clases base de tono ámbar + monospace", () => {
    const { container } = render(
      <FactorBreakdownHint
        hasDivergence={true}
        compactLine="x"
      />
    );
    const el = container.querySelector("div");
    expect(el?.className).toMatch(/text-amber-600/);
    expect(el?.className).toMatch(/font-mono/);
    expect(el?.className).toMatch(/text-\[10px\]/);
  });

  it("permite override con className adicional", () => {
    const { container } = render(
      <FactorBreakdownHint
        hasDivergence={true}
        compactLine="x"
        className="ml-2 mt-1"
      />
    );
    const el = container.querySelector("div");
    expect(el?.className).toMatch(/ml-2/);
    expect(el?.className).toMatch(/mt-1/);
    // Las clases base siguen presentes (no se sobrescriben).
    expect(el?.className).toMatch(/text-amber-600/);
  });
});

describe("FactorBreakdownHint — null cuando NO debe mostrarse", () => {
  it("hasDivergence=false → null", () => {
    const { container } = render(
      <FactorBreakdownHint hasDivergence={false} compactLine="x" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("compactLine=null → null (aunque hasDivergence sea true)", () => {
    const { container } = render(
      <FactorBreakdownHint hasDivergence={true} compactLine={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("compactLine=undefined → null", () => {
    const { container } = render(
      <FactorBreakdownHint hasDivergence={true} compactLine={undefined} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("compactLine=string vacío → null (truthy check)", () => {
    const { container } = render(
      <FactorBreakdownHint hasDivergence={true} compactLine="" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("ambos flags falsos → null", () => {
    const { container } = render(
      <FactorBreakdownHint hasDivergence={false} compactLine={null} />
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("FactorBreakdownHint — paridad visual (JSX idéntico al duplicado original)", () => {
  it("snapshot: estructura mínima sin className extra", () => {
    const { container } = render(
      <FactorBreakdownHint
        hasDivergence={true}
        compactLine="lista +50% · ajuste −25% · efectivo 1,13"
      />
    );
    // Snapshot del HTML resultante. Si alguien cambia clases base por error,
    // este test salta.
    expect(container.innerHTML).toMatch(
      /^<div class="text-\[10px\] text-amber-600 dark:text-amber-400 font-mono leading-tight">\(lista \+50% · ajuste −25% · efectivo 1,13\)<\/div>$/
    );
  });

  it("snapshot: con className extra (caller agrega mt-0.5)", () => {
    const { container } = render(
      <FactorBreakdownHint
        hasDivergence={true}
        compactLine="x"
        className="mt-0.5"
      />
    );
    // mt-0.5 al final, separado por espacio.
    expect(container.innerHTML).toMatch(/class="[^"]* mt-0\.5"/);
  });
});
