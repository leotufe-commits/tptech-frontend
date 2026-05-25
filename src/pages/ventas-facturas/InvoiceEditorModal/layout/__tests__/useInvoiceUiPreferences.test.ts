// src/pages/ventas-facturas/InvoiceEditorModal/layout/__tests__/useInvoiceUiPreferences.test.ts
// ============================================================================
// Garantías del hook (regresión de UX.21 "Cards visibles"):
//   · Deep merge sobre `visibleCards`: actualizar una key no resucita las
//     keys destildadas previamente.
//   · Updates consecutivos sin esperar re-render mantienen el acumulado
//     (race condition entre clicks rápidos).
//   · Patches de hermanos (`density`, `stickyActions`, etc.) NO resetean
//     `visibleCards`.
//   · `update(null)` limpia completo.
//   · Re-hidratación desde el backend conserva múltiples toggles persistidos.
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// Mock del servicio ANTES de importar el hook.
const mockGet    = vi.fn();
const mockUpdate = vi.fn();
vi.mock("../../../../../services/user-preferences", () => ({
  userPreferencesApi: {
    get:    (...args: any[]) => mockGet(...args),
    update: (...args: any[]) => mockUpdate(...args),
  },
}));

import { useInvoiceUiPreferences } from "../useInvoiceUiPreferences";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  mockGet.mockResolvedValue({ invoiceUiPreferences: null });
  mockUpdate.mockResolvedValue({});
});

async function bootstrap(initial: Record<string, unknown> | null = null) {
  mockGet.mockResolvedValue({ invoiceUiPreferences: initial });
  const hook = renderHook(() => useInvoiceUiPreferences(true));
  await act(async () => { await Promise.resolve(); });
  await waitFor(() => expect(mockGet).toHaveBeenCalled());
  return hook;
}

describe("useInvoiceUiPreferences — visibleCards deep merge (UX.21)", () => {
  it("1) destildar shipping y luego coupon mantiene ambos en false", async () => {
    const { result } = await bootstrap(null);

    act(() => {
      result.current.update({ visibleCards: { shipping: false } });
    });
    expect(result.current.resolved.visibleCards.shipping).toBe(false);
    expect(result.current.resolved.visibleCards.coupon).toBe(true);

    act(() => {
      result.current.update({ visibleCards: { coupon: false } });
    });
    expect(result.current.resolved.visibleCards.shipping).toBe(false);
    expect(result.current.resolved.visibleCards.coupon).toBe(false);
  });

  it("2) destildar 3 cards seguidos mantiene los 3 en false", async () => {
    const { result } = await bootstrap(null);

    act(() => {
      result.current.update({ visibleCards: { shipping: false } });
    });
    act(() => {
      result.current.update({ visibleCards: { coupon: false } });
    });
    act(() => {
      result.current.update({ visibleCards: { payments: false } });
    });

    expect(result.current.resolved.visibleCards.shipping).toBe(false);
    expect(result.current.resolved.visibleCards.coupon).toBe(false);
    expect(result.current.resolved.visibleCards.payments).toBe(false);
    // El resto sigue visible.
    expect(result.current.resolved.visibleCards.discount).toBe(true);
    expect(result.current.resolved.visibleCards.totals).toBe(true);
  });

  it("3) volver a tildar una no modifica las otras", async () => {
    const { result } = await bootstrap(null);

    act(() => { result.current.update({ visibleCards: { shipping: false } }); });
    act(() => { result.current.update({ visibleCards: { coupon: false } }); });
    act(() => { result.current.update({ visibleCards: { shipping: true } }); });

    expect(result.current.resolved.visibleCards.shipping).toBe(true);
    expect(result.current.resolved.visibleCards.coupon).toBe(false);
  });

  it("4) refresh/re-hidratación conserva varios false persistidos", async () => {
    const { result } = await bootstrap({
      visibleCards: { shipping: false, coupon: false, payments: false },
    });
    expect(result.current.resolved.visibleCards.shipping).toBe(false);
    expect(result.current.resolved.visibleCards.coupon).toBe(false);
    expect(result.current.resolved.visibleCards.payments).toBe(false);
    expect(result.current.resolved.visibleCards.discount).toBe(true);
  });

  it("5) defaults siguen funcionando para keys no presentes en el patch", async () => {
    const { result } = await bootstrap(null);
    act(() => { result.current.update({ visibleCards: { shipping: false } }); });

    // discount nunca fue tocada → default true.
    expect(result.current.resolved.visibleCards.discount).toBe(true);
    expect(result.current.resolved.visibleCards.observations).toBe(true);
  });

  it("6) un patch parcial de invoiceUiPreferences NO pisa visibleCards existente", async () => {
    const { result } = await bootstrap({
      visibleCards: { shipping: false, coupon: false },
    });

    // Cambio de density (sin tocar visibleCards) — no debe afectar toggles.
    act(() => { result.current.update({ density: "COMFORTABLE" }); });

    expect(result.current.resolved.density).toBe("COMFORTABLE");
    expect(result.current.resolved.visibleCards.shipping).toBe(false);
    expect(result.current.resolved.visibleCards.coupon).toBe(false);
  });

  it("7) cambiar density no resetea visibleCards", async () => {
    const { result } = await bootstrap(null);

    act(() => { result.current.update({ visibleCards: { shipping: false } }); });
    act(() => { result.current.update({ density: "COMPACT" }); });
    act(() => { result.current.update({ density: "COMFORTABLE" }); });

    expect(result.current.resolved.density).toBe("COMFORTABLE");
    expect(result.current.resolved.visibleCards.shipping).toBe(false);
  });

  it("8) cambiar stickyActions no resetea visibleCards", async () => {
    const { result } = await bootstrap(null);

    act(() => { result.current.update({ visibleCards: { shipping: false } }); });
    act(() => { result.current.update({ stickyActions: false }); });

    expect(result.current.resolved.stickyActions).toBe(false);
    expect(result.current.resolved.visibleCards.shipping).toBe(false);
  });
});

describe("useInvoiceUiPreferences — persistencia al backend", () => {
  it("cada toggle persiste el objeto acumulado (no solo el delta)", async () => {
    const { result } = await bootstrap(null);

    act(() => { result.current.update({ visibleCards: { shipping: false } }); });
    act(() => { result.current.update({ visibleCards: { coupon: false } }); });

    // El último PUT debe llevar AMBAS keys en false (no solo coupon).
    const lastCall = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1][0];
    expect(lastCall.invoiceUiPreferences.visibleCards.shipping).toBe(false);
    expect(lastCall.invoiceUiPreferences.visibleCards.coupon).toBe(false);
  });

  it("update(null) limpia el objeto completo y persiste null", async () => {
    const { result } = await bootstrap({
      visibleCards: { shipping: false },
      density: "COMFORTABLE",
    });

    act(() => { result.current.update(null); });

    expect(result.current.raw).toBeNull();
    // Defaults vuelven a aplicarse.
    expect(result.current.resolved.density).toBe("NORMAL");
    expect(result.current.resolved.visibleCards.shipping).toBe(true);

    const lastCall = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1][0];
    expect(lastCall.invoiceUiPreferences).toBeNull();
  });
});
