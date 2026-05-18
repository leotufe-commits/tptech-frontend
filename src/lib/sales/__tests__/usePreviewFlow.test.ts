// src/lib/sales/__tests__/usePreviewFlow.test.ts
// ============================================================================
// Tests del hook reutilizable de preview flow (FASE 8.2.4b).
//
// Cubren:
//   - status machine (idle ↔ loading ↔ ok / error)
//   - debounce
//   - anti-stale guard (cambio de signature en medio del fetch)
//   - anti-stale guard mutado externamente (otro consumidor ++ref)
//   - cancellation cleanup en unmount
//   - disabled / signature=null
//   - cache de signature+result
// ============================================================================

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePreviewFlow } from "../usePreviewFlow";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("usePreviewFlow", () => {
  it("status='idle' y cached=null cuando signature=null", () => {
    const requestIdRef = { current: 0 };
    const { result } = renderHook(() =>
      usePreviewFlow({
        signature: null,
        requestIdRef,
        executePreview: async () => "X",
        onApplyPreview: () => {},
      })
    );
    expect(result.current.status).toBe("idle");
    expect(result.current.cached).toBeNull();
  });

  it("status='idle' cuando enabled=false (aunque signature exista)", () => {
    const requestIdRef = { current: 0 };
    const { result } = renderHook(() =>
      usePreviewFlow({
        signature: "sig-1",
        enabled: false,
        requestIdRef,
        executePreview: async () => "X",
        onApplyPreview: () => {},
      })
    );
    expect(result.current.status).toBe("idle");
  });

  it("transiciona idle → loading → ok con executePreview success", async () => {
    const requestIdRef = { current: 0 };
    const onApply = vi.fn();
    const { result } = renderHook(() =>
      usePreviewFlow({
        signature: "sig-1",
        requestIdRef,
        executePreview: async () => "RESULT_A",
        onApplyPreview: onApply,
      })
    );
    // Status loading después del render (signature válida)
    expect(result.current.status).toBe("loading");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(result.current.status).toBe("ok");
    expect(result.current.cached).toEqual({ signature: "sig-1", result: "RESULT_A" });
    expect(onApply).toHaveBeenCalledWith("RESULT_A");
  });

  it("transiciona loading → error cuando executePreview rechaza", async () => {
    const requestIdRef = { current: 0 };
    const onError = vi.fn();
    const { result } = renderHook(() =>
      usePreviewFlow({
        signature: "sig-1",
        requestIdRef,
        executePreview: async () => { throw new Error("oops"); },
        onApplyPreview: () => {},
        onPreviewError: onError,
      })
    );
    expect(result.current.status).toBe("loading");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(result.current.status).toBe("error");
    expect(onError).toHaveBeenCalled();
    expect((onError.mock.calls[0][0] as Error).message).toBe("oops");
  });

  it("descarta respuesta stale cuando cambia signature en medio del fetch", async () => {
    const requestIdRef = { current: 0 };
    const onApply = vi.fn();
    // Queue de resolvers — cada call a exec empuja su resolver para que
    // podamos resolver llamadas específicas en cualquier orden.
    const pending: Array<(v: string) => void> = [];
    const exec = vi.fn(async () => new Promise<string>((res) => { pending.push(res); }));

    const { result, rerender } = renderHook(
      (props: { sig: string }) => usePreviewFlow({
        signature: props.sig,
        requestIdRef,
        executePreview: exec,
        onApplyPreview: onApply,
      }),
      { initialProps: { sig: "sig-1" } }
    );
    // Disparar timeout de sig-1 → exec call #0 pending
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(pending.length).toBe(1);

    // Cambiamos a sig-2 ANTES de que pending[0] resuelva.
    rerender({ sig: "sig-2" });
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(pending.length).toBe(2);

    // Resolvemos sig-1 DESPUÉS de cambiar a sig-2 — debe descartarse.
    await act(async () => { pending[0]("STALE_RESULT_A"); });
    expect(onApply).not.toHaveBeenCalledWith("STALE_RESULT_A");

    // Resolvemos sig-2 — éste sí debe aplicarse.
    await act(async () => { pending[1]("FRESH_RESULT_B"); });
    expect(onApply).toHaveBeenCalledWith("FRESH_RESULT_B");
    expect(result.current.cached?.signature).toBe("sig-2");
  });

  it("anti-stale por ref externo: otro consumidor mutea requestIdRef ++", async () => {
    const requestIdRef = { current: 0 };
    const onApply = vi.fn();
    let resolveA: (v: string) => void = () => {};
    const exec = vi.fn(async () => new Promise<string>((res) => { resolveA = res; }));

    renderHook(() => usePreviewFlow({
      signature: "sig-1",
      requestIdRef,
      executePreview: exec,
      onApplyPreview: onApply,
    }));
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });

    // Otro consumidor invalida el id externamente (handleClientPick típico).
    requestIdRef.current = 999;

    await act(async () => { resolveA("RESULT_INVALIDATED"); });
    // onApply no se llama porque el reqId interno ya no coincide.
    expect(onApply).not.toHaveBeenCalled();
  });

  it("limpia el timeout en unmount (no llama executePreview)", () => {
    const requestIdRef = { current: 0 };
    const exec = vi.fn(async () => "X");

    const { unmount } = renderHook(() => usePreviewFlow({
      signature: "sig-1",
      requestIdRef,
      executePreview: exec,
      onApplyPreview: () => {},
    }));
    unmount();
    // Avanzar tiempo después de unmount — el timeout no debería disparar.
    act(() => { vi.advanceTimersByTime(500); });
    expect(exec).not.toHaveBeenCalled();
  });

  it("acepta debounceMs custom", async () => {
    const requestIdRef = { current: 0 };
    const exec = vi.fn(async () => "X");
    const { result } = renderHook(() => usePreviewFlow({
      signature: "sig-1",
      requestIdRef,
      debounceMs: 500,
      executePreview: exec,
      onApplyPreview: () => {},
    }));
    // Después de 200ms (default) no debe disparar todavía.
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(exec).not.toHaveBeenCalled();
    expect(result.current.status).toBe("loading");
    // Después de 500ms total, sí.
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it("resetea cache cuando signature pasa a null", async () => {
    const requestIdRef = { current: 0 };
    const { result, rerender } = renderHook(
      (props: { sig: string | null }) => usePreviewFlow({
        signature: props.sig,
        requestIdRef,
        executePreview: async () => "X",
        onApplyPreview: () => {},
      }),
      { initialProps: { sig: "sig-1" } }
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(result.current.cached?.signature).toBe("sig-1");

    rerender({ sig: null });
    expect(result.current.status).toBe("idle");
    expect(result.current.cached).toBeNull();
  });

  it("mutea requestIdRef incrementando cada vez que dispara un fetch", async () => {
    const requestIdRef = { current: 5 };  // arranca en 5
    const exec = vi.fn(async () => "X");
    const { rerender } = renderHook(
      (props: { sig: string }) => usePreviewFlow({
        signature: props.sig,
        requestIdRef,
        executePreview: exec,
        onApplyPreview: () => {},
      }),
      { initialProps: { sig: "sig-1" } }
    );
    expect(requestIdRef.current).toBe(6);  // ++5 = 6
    rerender({ sig: "sig-2" });
    expect(requestIdRef.current).toBe(7);  // ++6 = 7
  });
});
