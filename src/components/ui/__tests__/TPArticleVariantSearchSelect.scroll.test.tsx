// src/components/ui/__tests__/TPArticleVariantSearchSelect.scroll.test.tsx
// ============================================================================
// Mejora UX — al navegar con flechas en el combo de artículos, la opción activa
// hace scroll automático para quedar SIEMPRE visible (scrollIntoView).
// No cambia diseño, ni mouse, ni Enter, ni búsqueda.
// ============================================================================
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { TPArticleVariantSearchSelect, type TPArticleLite } from "../TPArticleVariantSearchSelect";

const OPTIONS: TPArticleLite[] = Array.from({ length: 12 }, (_, i) => ({
  id: `a${i}`, article: `Artículo ${i}`, code: `C${i}`, itemKind: "ARTICLE_SIMPLE",
})) as any;

function setup() {
  const onChange = vi.fn();
  const utils = render(
    <TPArticleVariantSearchSelect value={null} onChange={onChange} options={OPTIONS} />,
  );
  const input = utils.container.querySelector("input") as HTMLInputElement;
  // Abrir el dropdown — "Artículo" matchea las 12 opciones.
  fireEvent.change(input, { target: { value: "Artículo" } });
  return { ...utils, input, onChange };
}

describe("TPArticleVariantSearchSelect — auto-scroll de la opción activa", () => {
  let scrollSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    scrollSpy = vi.fn();
    // jsdom no implementa scrollIntoView — lo instalamos para espiarlo.
    (Element.prototype as any).scrollIntoView = scrollSpy;
  });

  it("ArrowDown repetido: la opción activa llama scrollIntoView({ block: 'nearest' })", () => {
    const { input } = setup();
    scrollSpy.mockClear();
    for (let i = 0; i < 6; i++) fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(scrollSpy).toHaveBeenCalled();
    expect(scrollSpy).toHaveBeenCalledWith({ block: "nearest" });
    // La opción activa (aria-selected) existe y es única.
    const active = document.querySelectorAll("[role='option'][aria-selected='true']");
    expect(active.length).toBe(1);
  });

  it("ArrowUp también mantiene visible la opción activa", () => {
    const { input } = setup();
    for (let i = 0; i < 5; i++) fireEvent.keyDown(input, { key: "ArrowDown" });
    scrollSpy.mockClear();
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(scrollSpy).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("Enter selecciona la opción activa (no se rompe)", () => {
    const { input, onChange } = setup();
    fireEvent.keyDown(input, { key: "ArrowDown" }); // activa idx 1
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatchObject({ id: expect.any(String) });
  });

  it("Mouse sigue funcionando: hover activa la opción y mouseDown la commitea", () => {
    const { onChange } = setup();
    const options = document.querySelectorAll("[role='option']");
    // Hover sobre una opción la marca activa (mouse navigation intacta).
    fireEvent.mouseEnter(options[2]);
    expect(options[2].getAttribute("aria-selected")).toBe("true");
    // mouseDown commitea la selección (onChange del item).
    fireEvent.mouseDown(options[2]);
    expect(onChange).toHaveBeenCalled();
  });

  it("Búsqueda filtrada sigue funcionando (no rompe el filtro)", () => {
    const { input } = setup();
    fireEvent.change(input, { target: { value: "Artículo 1" } });
    const options = document.querySelectorAll("[role='option']");
    // "Artículo 1", "Artículo 10", "Artículo 11" → al menos 1, menos que todos.
    expect(options.length).toBeGreaterThan(0);
    expect(options.length).toBeLessThan(OPTIONS.length);
  });
});
