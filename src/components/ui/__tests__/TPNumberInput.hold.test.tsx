// src/components/ui/__tests__/TPNumberInput.hold.test.tsx
// =============================================================================
// Etapa 2F — Press-and-hold de los spinners (↑/↓) del TPNumberInput.
//
//   · Click (sin pointer) → incrementa 1× (back-compat).
//   · Mantener presionado (pointerDown) → incremento inmediato + repetición.
//   · Soltar (pointerUp) → se detiene.
//   · Respeta step / min / max (lógica de `inc`, no cambia).
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import TPNumberInput from "../TPNumberInput";

describe("TPNumberInput — press-and-hold de arrows", () => {
  it("click en ↑ incrementa una vez (back-compat, sin pointer)", () => {
    const onChange = vi.fn();
    render(<TPNumberInput value={1} step={1} onChange={onChange} formatType="INTEGER" />);
    fireEvent.click(screen.getByLabelText("Incrementar"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(2);
  });

  it("click en ↓ decrementa una vez", () => {
    const onChange = vi.fn();
    render(<TPNumberInput value={5} step={1} onChange={onChange} formatType="INTEGER" />);
    fireEvent.click(screen.getByLabelText("Disminuir"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(4);
  });

  it("respeta min/max en el incremento", () => {
    const onChange = vi.fn();
    render(<TPNumberInput value={9} step={1} max={10} onChange={onChange} formatType="INTEGER" />);
    fireEvent.click(screen.getByLabelText("Incrementar")); // 9 → 10
    fireEvent.click(screen.getByLabelText("Incrementar")); // 10 → 10 (clamp)
    expect(onChange).toHaveBeenLastCalledWith(10);
  });

  describe("hold con timers falsos", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("pointerDown sostenido repite el incremento; pointerUp lo detiene", () => {
      const onChange = vi.fn();
      render(<TPNumberInput value={0} step={1} onChange={onChange} formatType="INTEGER" />);
      const up = screen.getByLabelText("Incrementar");

      // pointerDown → incremento inmediato.
      act(() => { fireEvent.pointerDown(up); });
      const afterImmediate = onChange.mock.calls.length;
      expect(afterImmediate).toBeGreaterThanOrEqual(1);

      // Avanzar más allá del delay inicial + varias repeticiones.
      act(() => { vi.advanceTimersByTime(350 + 70 * 4); });
      const afterHold = onChange.mock.calls.length;
      expect(afterHold).toBeGreaterThan(afterImmediate); // repitió

      // pointerUp → detiene; avanzar no agrega más llamadas.
      act(() => { fireEvent.pointerUp(up); });
      const atRelease = onChange.mock.calls.length;
      act(() => { vi.advanceTimersByTime(70 * 5); });
      expect(onChange.mock.calls.length).toBe(atRelease);
    });

    it("pointerDown + click posterior NO duplica (anti-doble del mouse real)", () => {
      const onChange = vi.fn();
      render(<TPNumberInput value={0} step={1} onChange={onChange} formatType="INTEGER" />);
      const up = screen.getByLabelText("Incrementar");
      act(() => { fireEvent.pointerDown(up); });
      act(() => { fireEvent.pointerUp(up); });
      const afterPointer = onChange.mock.calls.length;
      // El click que dispara el mouse real tras pointerup debe ignorarse.
      act(() => { fireEvent.click(up); });
      expect(onChange.mock.calls.length).toBe(afterPointer);
    });
  });
});
