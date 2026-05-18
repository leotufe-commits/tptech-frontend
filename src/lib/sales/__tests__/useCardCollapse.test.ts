// src/lib/sales/__tests__/useCardCollapse.test.ts
// ============================================================================
// Tests del hook extraído en FASE 8.2.4.
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCardCollapse, readBoolPref } from "../useCardCollapse";

const KEY = "test:card-collapse:k1";

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  window.localStorage.clear();
});

describe("readBoolPref", () => {
  it("devuelve true cuando localStorage tiene 'true'", () => {
    window.localStorage.setItem(KEY, "true");
    expect(readBoolPref(KEY, false)).toBe(true);
  });

  it("devuelve false cuando localStorage tiene 'false'", () => {
    window.localStorage.setItem(KEY, "false");
    expect(readBoolPref(KEY, true)).toBe(false);
  });

  it("devuelve fallback cuando localStorage no tiene la clave", () => {
    expect(readBoolPref(KEY, true)).toBe(true);
    expect(readBoolPref(KEY, false)).toBe(false);
  });

  it("devuelve fallback cuando el valor no es 'true' ni 'false'", () => {
    window.localStorage.setItem(KEY, "yes");
    expect(readBoolPref(KEY, true)).toBe(true);
    window.localStorage.setItem(KEY, "1");
    expect(readBoolPref(KEY, false)).toBe(false);
  });
});

describe("useCardCollapse", () => {
  it("usa defaultOpen=true cuando no hay valor previo", () => {
    const { result } = renderHook(() => useCardCollapse(KEY, true));
    expect(result.current[0]).toBe(true);
  });

  it("usa defaultOpen=false cuando no hay valor previo", () => {
    const { result } = renderHook(() => useCardCollapse(KEY, false));
    expect(result.current[0]).toBe(false);
  });

  it("respeta valor 'true' previo en localStorage", () => {
    window.localStorage.setItem(KEY, "true");
    const { result } = renderHook(() => useCardCollapse(KEY, false));
    expect(result.current[0]).toBe(true);
  });

  it("respeta valor 'false' previo en localStorage (ignora defaultOpen)", () => {
    window.localStorage.setItem(KEY, "false");
    const { result } = renderHook(() => useCardCollapse(KEY, true));
    expect(result.current[0]).toBe(false);
  });

  it("persiste 'true' en localStorage al cambiar a true", () => {
    const { result } = renderHook(() => useCardCollapse(KEY, false));
    act(() => result.current[1](true));
    expect(window.localStorage.getItem(KEY)).toBe("true");
    expect(result.current[0]).toBe(true);
  });

  it("persiste 'false' en localStorage al cambiar a false", () => {
    const { result } = renderHook(() => useCardCollapse(KEY, true));
    act(() => result.current[1](false));
    expect(window.localStorage.getItem(KEY)).toBe("false");
    expect(result.current[0]).toBe(false);
  });

  it("acepta updater function como useState", () => {
    const { result } = renderHook(() => useCardCollapse(KEY, false));
    act(() => result.current[1]((prev) => !prev));
    expect(result.current[0]).toBe(true);
    act(() => result.current[1]((prev) => !prev));
    expect(result.current[0]).toBe(false);
  });

  it("persiste el valor inicial 'true' al mount (write-through)", () => {
    expect(window.localStorage.getItem(KEY)).toBeNull();
    renderHook(() => useCardCollapse(KEY, true));
    expect(window.localStorage.getItem(KEY)).toBe("true");
  });

  it("setter es estable entre renders (no fuerza re-render de consumers)", () => {
    const { result, rerender } = renderHook(() => useCardCollapse(KEY, true));
    const firstSetter = result.current[1];
    rerender();
    expect(result.current[1]).toBe(firstSetter);
  });
});
