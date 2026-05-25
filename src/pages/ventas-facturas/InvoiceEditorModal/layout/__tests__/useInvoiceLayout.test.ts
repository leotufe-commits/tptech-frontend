// src/pages/ventas-facturas/InvoiceEditorModal/layout/__tests__/useInvoiceLayout.test.ts
// ============================================================================
// Garantías del hook:
//   · enabled=false → no fetch, layout = DEFAULT_LAYOUT.
//   · enabled=true sin preferencia guardada → DEFAULT_LAYOUT.
//   · enabled=true con preferencia guardada → reconciliado.
//   · setLayout actualiza state + persiste con debounce 800ms.
//   · resetLayout llama userPreferencesApi.update con invoiceLayoutConfig:null.
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// Mock del servicio antes de importar el hook (vi.hoisted equivalente).
const mockGet    = vi.fn();
const mockUpdate = vi.fn();
vi.mock("../../../../../services/user-preferences", () => ({
  userPreferencesApi: {
    get:    (...args: any[]) => mockGet(...args),
    update: (...args: any[]) => mockUpdate(...args),
  },
}));

import { useInvoiceLayout } from "../useInvoiceLayout";
import { DEFAULT_LAYOUT } from "../defaults";

beforeEach(() => {
  vi.clearAllMocks();
  // Por default usamos TIMERS REALES para que `waitFor` resuelva las
  // promesas del bootstrap. Los tests del debounce activan fake timers
  // SOLO en su scope (vi.useFakeTimers() dentro del test) y los restauran.
  vi.useRealTimers();
  mockGet.mockResolvedValue({ invoiceLayoutConfig: null });
  mockUpdate.mockResolvedValue({});
});

// Helper para tests post Etapa 3.5: el hook normaliza order/width vía el
// pipeline V1→V2→V1 (V2 es la SSOT, V1 es proyección). Las cards conservan
// IDs y slots, pero `order` se recomputa por sort de Y y `width` se snapea
// al bucket V1 inverso del W en columnas V2. Estos helpers permiten checks
// estructurales en lugar de igualdad literal con DEFAULT_LAYOUT.

/** IDs del DEFAULT_LAYOUT en el orden por slot — invariante estructural
 *  que sí se preserva por el round-trip V1→V2→V1. */
function structuralFingerprint(cfg: typeof DEFAULT_LAYOUT): string {
  return cfg.cards
    .slice()
    .sort((a, b) => (a.slot === b.slot ? a.order - b.order : a.slot.localeCompare(b.slot)))
    .map((c) => `${c.slot}:${c.id}`)
    .join("|");
}

describe("useInvoiceLayout — bootstrap", () => {
  it("enabled=false → state inicializado con todas las cards del default y NO se llama al API", () => {
    const { result } = renderHook(() => useInvoiceLayout(false));
    expect(structuralFingerprint(result.current.layout))
      .toBe(structuralFingerprint(DEFAULT_LAYOUT));
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("enabled=true sin preferencia guardada → layout con misma estructura del default", async () => {
    mockGet.mockResolvedValue({ invoiceLayoutConfig: null });
    const { result } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(structuralFingerprint(result.current.layout))
      .toBe(structuralFingerprint(DEFAULT_LAYOUT));
  });

  it("enabled=true con preferencia guardada válida → layout reconciliado", async () => {
    mockGet.mockResolvedValue({
      invoiceLayoutConfig: {
        version: 1,
        cards: [
          { id: "shipping", slot: "aside", order: 0, width: "full" },
          { id: "discount", slot: "aside", order: 1, width: "full" },
        ],
      },
    });
    const { result } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    // Las cards de saved van primero; las faltantes se agregan al final.
    const aside = result.current.layout.cards
      .filter((c) => c.slot === "aside")
      .sort((a, b) => a.order - b.order);
    expect(aside[0].id).toBe("shipping");
    expect(aside[1].id).toBe("discount");
  });

  it("enabled=true con preferencia inválida → defaults (fallback duro)", async () => {
    mockGet.mockResolvedValue({ invoiceLayoutConfig: { broken: true } });
    const { result } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(structuralFingerprint(result.current.layout))
      .toBe(structuralFingerprint(DEFAULT_LAYOUT));
  });
});

describe("useInvoiceLayout — setLayout (persistencia con debounce)", () => {
  it("setLayout cambia el orden visual de la card inmediatamente (V2 SSOT)", async () => {
    const { result } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });

    // Reordenar el aside: mover `discount` al FINAL (orden 99 → último).
    const newLayout = {
      ...result.current.layout,
      cards: result.current.layout.cards.map((c) =>
        c.id === "discount" ? { ...c, order: 99 } : c,
      ),
    };
    act(() => { result.current.setLayout(newLayout); });

    // El hook normaliza order al hacer round-trip V1→V2→V1. Lo que SÍ se
    // preserva es el ORDEN RELATIVO de las cards en el slot: discount
    // queda al final del aside (su `order` final = aside.length - 1).
    const aside = result.current.layout.cards
      .filter((c) => c.slot === "aside")
      .sort((a, b) => a.order - b.order);
    expect(aside[aside.length - 1].id).toBe("discount");
  });

  it("persistencia se debouncea a 800ms (Etapa 3.5: payload es V2)", async () => {
    const { result } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });
    mockUpdate.mockClear();
    vi.useFakeTimers();
    try {
      act(() => { result.current.setLayout(DEFAULT_LAYOUT); });
      // Aún no llamó al API.
      expect(mockUpdate).not.toHaveBeenCalled();

      // Avanzar 799ms — aún no llama.
      act(() => { vi.advanceTimersByTime(799); });
      expect(mockUpdate).not.toHaveBeenCalled();

      // Avanzar el 1ms restante (total 800ms) — ahora persiste.
      // El payload es V2 (version 2) — el contrato cambió en Etapa 3.5.
      act(() => { vi.advanceTimersByTime(1); });
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      const payload = mockUpdate.mock.calls[0][0];
      expect(payload.invoiceLayoutConfig.version).toBe(2);
      expect(payload.invoiceLayoutConfig.cards.length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("múltiples setLayout en ráfaga → solo una persistencia con el ÚLTIMO valor", async () => {
    const { result } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });
    mockUpdate.mockClear();
    vi.useFakeTimers();
    try {
      const a = { ...DEFAULT_LAYOUT, cards: [...DEFAULT_LAYOUT.cards] };
      const b = { ...DEFAULT_LAYOUT, cards: DEFAULT_LAYOUT.cards.map((c, i) => ({ ...c, order: i + 10 })) };
      const c = { ...DEFAULT_LAYOUT, cards: DEFAULT_LAYOUT.cards.map((c, i) => ({ ...c, order: i + 100 })) };

      act(() => { result.current.setLayout(a); });
      act(() => { vi.advanceTimersByTime(300); });
      act(() => { result.current.setLayout(b); });
      act(() => { vi.advanceTimersByTime(300); });
      act(() => { result.current.setLayout(c); });
      act(() => { vi.advanceTimersByTime(800); });

      // Solo UNA llamada al endpoint (las anteriores fueron debounceadas).
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      // Payload V2 con el último valor (no comparamos shape literal — el
      // round-trip normaliza order/width; lo que importa es que persistió
      // y el shape es V2).
      const payload = mockUpdate.mock.calls[0][0];
      expect(payload.invoiceLayoutConfig.version).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("useInvoiceLayout — resetLayout", () => {
  it("resetLayout llama userPreferencesApi.update con invoiceLayoutConfig=null", async () => {
    const { result } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });
    mockUpdate.mockClear();

    await act(async () => { await result.current.resetLayout(); });
    expect(mockUpdate).toHaveBeenCalledWith({ invoiceLayoutConfig: null });
  });

  it("resetLayout setea state local a la estructura del DEFAULT_LAYOUT", async () => {
    mockGet.mockResolvedValue({
      invoiceLayoutConfig: {
        version: 1,
        cards: [{ id: "shipping", slot: "aside", order: 0, width: "full" }],
      },
    });
    const { result } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });
    await waitFor(() => {
      const aside = result.current.layout.cards
        .filter((c) => c.slot === "aside")
        .sort((a, b) => a.order - b.order);
      expect(aside[0].id).toBe("shipping");
    });

    await act(async () => { await result.current.resetLayout(); });
    // Reset → vuelve a la estructura default (mismo fingerprint).
    expect(structuralFingerprint(result.current.layout))
      .toBe(structuralFingerprint(DEFAULT_LAYOUT));
  });

  it("resetLayout cancela una persistencia pendiente", async () => {
    const { result } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });
    mockUpdate.mockClear();
    vi.useFakeTimers();
    try {
      const modified = { ...DEFAULT_LAYOUT, cards: DEFAULT_LAYOUT.cards.map((c, i) => ({ ...c, order: i + 50 })) };
      act(() => { result.current.setLayout(modified); });
      // Antes de que el debounce dispare, llamamos reset:
      await act(async () => { await result.current.resetLayout(); });
      // Avanzar el timer — no debe haber persistencia del setLayout.
      act(() => { vi.advanceTimersByTime(2000); });

      // Solo la del reset (1 llamada).
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith({ invoiceLayoutConfig: null });
    } finally {
      vi.useRealTimers();
    }
  });
});

// ============================================================================
// Auditoría post-Fase 3 — FLUSH al desmontar.
//
// Si el operador hace un drag/resize y cierra el modal antes de los 800ms
// del debounce, el cleanup del useEffect ahora HACE FLUSH del pendiente en
// vez de descartarlo. Antes el cambio se perdía silenciosamente (operador:
// "guardé pero no quedó"). Este test fija ese contrato.
// ============================================================================
describe("useInvoiceLayout — flush al desmontar (auditoría post-Fase 3)", () => {
  it("desmontar con persistencia pendiente → FLUSH inmediato (no pierde el último cambio)", async () => {
    const { result, unmount } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });
    mockUpdate.mockClear();

    const modified = {
      ...DEFAULT_LAYOUT,
      cards: DEFAULT_LAYOUT.cards.map((c, i) => ({ ...c, order: i + 77 })),
    };
    act(() => { result.current.setLayout(modified); });
    // El debounce todavía NO disparó.
    expect(mockUpdate).not.toHaveBeenCalled();

    // Desmonta el hook (= modal cerrado).
    unmount();

    // El cleanup hizo flush sincrónico del pending. Etapa 3.5: payload es
    // V2 (no comparamos shape literal — el round-trip normaliza order).
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const payload = mockUpdate.mock.calls[0][0];
    expect(payload.invoiceLayoutConfig.version).toBe(2);
  });

  it("desmontar SIN cambios pendientes → NO se llama update (cero noise)", async () => {
    const { unmount } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });
    mockUpdate.mockClear();

    // No se llama setLayout — no hay pending.
    unmount();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Auditoría: handleCardResize en VentasFacturas opera con la misma lógica
// pura — solo cambia el `width` de UNA card, las otras quedan intactas.
// Replicamos el cálculo aquí para fijar el contrato del helper.
// ============================================================================
describe("handleCardResize — lógica pura (auditoría)", () => {
  function applyResize(layout: typeof DEFAULT_LAYOUT, cardId: string, nextWidth: "full" | "half" | "third" | "two-thirds") {
    return {
      ...layout,
      cards: layout.cards.map((c) =>
        c.id === cardId ? { ...c, width: nextWidth } : c,
      ),
    };
  }

  it("cambia el width de la card target, todas las demás quedan intactas", () => {
    const next = applyResize(DEFAULT_LAYOUT, "discount", "half");
    expect(next.cards.find((c) => c.id === "discount")!.width).toBe("half");
    const others = next.cards.filter((c) => c.id !== "discount");
    others.forEach((c) => expect(c.width).toBe("full"));
  });

  it("no cambia el slot ni el order de la card target", () => {
    const orig = DEFAULT_LAYOUT.cards.find((c) => c.id === "discount")!;
    const next = applyResize(DEFAULT_LAYOUT, "discount", "third");
    const updated = next.cards.find((c) => c.id === "discount")!;
    expect(updated.slot).toBe(orig.slot);
    expect(updated.order).toBe(orig.order);
    expect(updated.id).toBe(orig.id);
  });

  it("cardId desconocido → layout idéntico (no crashea)", () => {
    const next = applyResize(DEFAULT_LAYOUT, "FAKE" as any, "half");
    expect(next.cards).toHaveLength(DEFAULT_LAYOUT.cards.length);
    next.cards.forEach((c) => expect(c.width).toBe("full"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Etapa 2 — layoutV2 derivado del V1 vía migrateV1ToV2.
// ─────────────────────────────────────────────────────────────────────────────

describe("useInvoiceLayout — layoutV2 derivado (Etapa 2)", () => {
  it("expone layoutV2 con version=2 derivado del layout V1 actual", async () => {
    mockGet.mockResolvedValue({ invoiceLayoutConfig: null });
    const { result } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(result.current.layoutV2).toBeDefined();
    expect(result.current.layoutV2.version).toBe(2);
    expect(result.current.layoutV2.cards.length).toBeGreaterThan(0);
  });

  it("layoutV2 preserva el orden visual del V1 (mismas cards en mismo orden por region)", async () => {
    mockGet.mockResolvedValue({
      invoiceLayoutConfig: {
        version: 1,
        cards: [
          { id: "header",   slot: "top",   order: 0, width: "full" },
          { id: "lines",    slot: "main",  order: 0, width: "full" },
          { id: "shipping", slot: "aside", order: 0, width: "full" },
          { id: "discount", slot: "aside", order: 1, width: "full" },
          { id: "totals",   slot: "aside", order: 2, width: "full" },
        ],
      },
    });
    const { result } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });
    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    // V1 aside (sorted by order)
    const asideV1 = result.current.layout.cards
      .filter((c) => c.slot === "aside")
      .sort((a, b) => a.order - b.order)
      .map((c) => c.id);

    // V2 aside (sorted by y)
    const asideV2 = result.current.layoutV2.cards
      .filter((c) => c.region === "aside")
      .sort((a, b) => a.y - b.y)
      .map((c) => c.id);

    // El prefix debe coincidir — los ids agregados por reconcile (que no
    // estaban en saved) aparecen al final tanto en V1 como en V2.
    expect(asideV2.slice(0, asideV1.length)).toEqual(asideV1);
  });

  it("layoutV2 se actualiza cuando setLayout cambia el V1 (memo invalidation)", async () => {
    const { result } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });
    const v2Before = result.current.layoutV2;

    // Forzar cambio en V1 (re-asignar referencia, no mutar).
    const newV1 = {
      ...result.current.layout,
      cards: result.current.layout.cards.slice(),
    };
    act(() => { result.current.setLayout(newV1); });

    // La referencia de layoutV2 debe cambiar (useMemo re-evalúa con
    // dep [layout]).
    expect(result.current.layoutV2).not.toBe(v2Before);
    // Pero el shape sigue siendo válido.
    expect(result.current.layoutV2.version).toBe(2);
  });

  it("layoutV2 incluye los campos extendidos con sus defaults (z, sticky, collapsed, visible)", async () => {
    const { result } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    const discount = result.current.layoutV2.cards.find((c) => c.id === "discount");
    expect(discount).toBeDefined();
    expect(discount!.z).toBe(0);
    expect(discount!.sticky).toBe(false);
    expect(discount!.collapsed).toBe(false);
    expect(discount!.visible).toBe(true);
  });

  it("structural lock: header/lines tienen locked=true en layoutV2", async () => {
    const { result } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    const header = result.current.layoutV2.cards.find((c) => c.id === "header");
    const lines  = result.current.layoutV2.cards.find((c) => c.id === "lines");
    expect(header?.locked).toBe(true);
    expect(lines?.locked).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Etapa 3 — Snapshot / restoreSnapshot ("Cancelar cambios" en edit mode)
// ─────────────────────────────────────────────────────────────────────────────

describe("useInvoiceLayout — snapshot / restoreSnapshot (Etapa 3)", () => {
  it("restoreSnapshot devuelve false si nunca se llamó takeSnapshot", () => {
    const { result } = renderHook(() => useInvoiceLayout(false));
    expect(result.current.restoreSnapshot()).toBe(false);
  });

  // Helper para tests de snapshot: identifica la posición de una card
  // dentro del slot aside (índice 0..N) — el "order" canónico que el
  // hook normaliza.
  const asidePositionOf = (layout: typeof DEFAULT_LAYOUT, id: string): number => {
    const aside = layout.cards
      .filter((c) => c.slot === "aside")
      .sort((a, b) => a.order - b.order);
    return aside.findIndex((c) => c.id === id);
  };

  it("takeSnapshot + cambios + restoreSnapshot vuelve al estado snapshotado", async () => {
    const { result } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });
    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    const originalDiscountPos = asidePositionOf(result.current.layout, "discount");

    // 1) Snapshot del estado actual.
    act(() => { result.current.takeSnapshot(); });

    // 2) Mutar el layout: mover discount al FINAL del aside (order=99).
    const mutated = {
      ...result.current.layout,
      cards: result.current.layout.cards.map((c) =>
        c.id === "discount" ? { ...c, order: 99 } : c,
      ),
    };
    act(() => { result.current.setLayout(mutated); });
    // Discount quedó AL FINAL del aside (último índice).
    const aside = result.current.layout.cards
      .filter((c) => c.slot === "aside")
      .sort((a, b) => a.order - b.order);
    expect(aside[aside.length - 1].id).toBe("discount");

    // 3) Restaurar el snapshot → discount vuelve a su posición original.
    let restored: boolean = false;
    act(() => { restored = result.current.restoreSnapshot(); });
    expect(restored).toBe(true);
    expect(asidePositionOf(result.current.layout, "discount")).toBe(originalDiscountPos);
  });

  it("takeSnapshot capturado DESPUÉS de un cambio guarda ese cambio (no el original)", async () => {
    const { result } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });

    // 1) Cambio: mover shipping al FINAL del aside.
    const change1 = {
      ...result.current.layout,
      cards: result.current.layout.cards.map((c) =>
        c.id === "shipping" ? { ...c, order: 50 } : c,
      ),
    };
    act(() => { result.current.setLayout(change1); });
    const shippingPosAfterChange1 = asidePositionOf(result.current.layout, "shipping");

    // 2) Snapshot AHORA (con shipping al final).
    act(() => { result.current.takeSnapshot(); });

    // 3) Otro cambio: mover shipping al PRINCIPIO.
    const change2 = {
      ...result.current.layout,
      cards: result.current.layout.cards.map((c) =>
        c.id === "shipping" ? { ...c, order: -100 } : c,
      ),
    };
    act(() => { result.current.setLayout(change2); });
    expect(asidePositionOf(result.current.layout, "shipping")).toBe(0);

    // 4) Restore → vuelve al snapshot (shipping al final, no al principio).
    act(() => { result.current.restoreSnapshot(); });
    expect(asidePositionOf(result.current.layout, "shipping")).toBe(shippingPosAfterChange1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Etapa 4 fix — bug crítico de persistencia: V2 → backend → V2 round-trip
  // debe preservar EXACTAMENTE x/y/w/h (no proyectar a V1 y perder datos).
  // ─────────────────────────────────────────────────────────────────────────

  it("Etapa 4 fix — V2 persistido se hidrata con x/y/w/h exactos en el próximo open", async () => {
    // Setup: persisted V2 con una card movida a posición custom y
    // redimensionada.
    const customV2 = {
      version: 2,
      presetBase: "COMPACT",
      grid: { columns: 12, rowHeight: 16, gap: 12 },
      cards: [
        // Header y lines en defaults estructurales (locked).
        { id: "header", region: "header", x: 0, y: 0, w: 12, h: 4, locked: true },
        { id: "lines",  region: "main",   x: 0, y: 4, w: 8,  h: 20, locked: true },
        // Discount movida y redimensionada (custom layout del usuario):
        { id: "discount", region: "aside", x: 10, y: 7, w: 2, h: 6, sticky: true, z: 3 },
        // Las demás aside con defaults.
        { id: "shipping", region: "aside", x: 8,  y: 0,  w: 4, h: 4 },
        { id: "coupon",   region: "aside", x: 8,  y: 4,  w: 4, h: 4 },
        { id: "totals",   region: "aside", x: 8,  y: 13, w: 4, h: 8 },
        { id: "payments", region: "aside", x: 8,  y: 21, w: 4, h: 6 },
        { id: "account-impact", region: "aside", x: 8, y: 27, w: 4, h: 4 },
        { id: "observations",   region: "aside", x: 8, y: 31, w: 4, h: 6 },
      ],
    };
    mockGet.mockResolvedValue({ invoiceLayoutConfig: customV2 });

    const { result } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });
    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    // El hook hidrata layoutV2 preservando x/y/w/h EXACTOS.
    const discount = result.current.layoutV2.cards.find((c) => c.id === "discount");
    expect(discount).toBeDefined();
    expect(discount!.x).toBe(10);
    expect(discount!.y).toBe(7);
    expect(discount!.w).toBe(2);
    expect(discount!.h).toBe(6);
    expect(discount!.sticky).toBe(true);
    expect(discount!.z).toBe(3);
  });

  it("Etapa 4 fix — setLayoutV2(custom) + flush → backend recibe x/y/w/h EXACTOS (no aplanados)", async () => {
    const { result, unmount } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });
    mockUpdate.mockClear();

    // Simular un drag/resize del usuario: mover discount a (10, 7) con
    // w=2 h=6.
    const next = {
      ...result.current.layoutV2,
      cards: result.current.layoutV2.cards.map((c) =>
        c.id === "discount"
          ? { ...c, x: 10, y: 7, w: 2, h: 6 }
          : c,
      ),
    };
    act(() => { result.current.setLayoutV2(next); });

    // Desmontar el hook → flush sincrónico del pending.
    unmount();

    // El payload V2 enviado al backend tiene EXACTAMENTE x=10, y=7, w=2, h=6
    // para discount — sin pasar por v2ToV1 ni perder coordenadas.
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const payload = mockUpdate.mock.calls[0][0];
    expect(payload.invoiceLayoutConfig.version).toBe(2);
    const persistedDiscount = payload.invoiceLayoutConfig.cards.find(
      (c: { id: string }) => c.id === "discount",
    );
    expect(persistedDiscount).toBeDefined();
    expect(persistedDiscount.x).toBe(10);
    expect(persistedDiscount.y).toBe(7);
    expect(persistedDiscount.w).toBe(2);
    expect(persistedDiscount.h).toBe(6);
  });

  it("Etapa 4 fix — setLayoutV2 inmediato refleja x/y/w/h en layoutV2 (no espera al debounce)", async () => {
    const { result } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });

    const next = {
      ...result.current.layoutV2,
      cards: result.current.layoutV2.cards.map((c) =>
        c.id === "totals" ? { ...c, x: 9, y: 25, w: 3, h: 10 } : c,
      ),
    };
    act(() => { result.current.setLayoutV2(next); });

    // Sin esperar al debounce, el state local ya refleja el cambio.
    const totals = result.current.layoutV2.cards.find((c) => c.id === "totals");
    expect(totals!.x).toBe(9);
    expect(totals!.y).toBe(25);
    expect(totals!.w).toBe(3);
    expect(totals!.h).toBe(10);
  });

  it("snapshots múltiples — el último gana", async () => {
    const { result } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });

    // Snapshot inicial.
    act(() => { result.current.takeSnapshot(); });

    // Cambiar layout: coupon al final.
    const mutated = {
      ...result.current.layout,
      cards: result.current.layout.cards.map((c) =>
        c.id === "coupon" ? { ...c, order: 88 } : c,
      ),
    };
    act(() => { result.current.setLayout(mutated); });
    const couponPosMid = asidePositionOf(result.current.layout, "coupon");

    // RE-snapshot — el nuevo snapshot pisa el anterior.
    act(() => { result.current.takeSnapshot(); });

    // Otro cambio: coupon al principio (order muy negativo).
    const mutated2 = {
      ...result.current.layout,
      cards: result.current.layout.cards.map((c) =>
        c.id === "coupon" ? { ...c, order: -77 } : c,
      ),
    };
    act(() => { result.current.setLayout(mutated2); });
    expect(asidePositionOf(result.current.layout, "coupon")).toBe(0);

    // Restore → vuelve al ÚLTIMO snapshot (coupon en couponPosMid).
    act(() => { result.current.restoreSnapshot(); });
    expect(asidePositionOf(result.current.layout, "coupon")).toBe(couponPosMid);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Etapa 5 — Presets de usuario ("Mis vistas")
// ─────────────────────────────────────────────────────────────────────────────

describe("useInvoiceLayout — presets (Etapa 5)", () => {
  it("bootstrap con presets persistidos los hidrata correctamente", async () => {
    mockGet.mockResolvedValue({
      invoiceLayoutConfig: null,
      invoiceLayoutPresets: [
        { id: "p1", name: "Venta rápida", isDefault: true,  config: null },
        { id: "p2", name: "Compacta",     isDefault: false, config: null },
      ],
    });
    const { result } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });
    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    expect(result.current.presets).toHaveLength(2);
    expect(result.current.presets[0].name).toBe("Venta rápida");
    expect(result.current.presets[0].isDefault).toBe(true);
    expect(result.current.presets[1].name).toBe("Compacta");
    expect(result.current.presets[1].isDefault).toBe(false);
  });

  it("savePresetAs guarda el layoutV2 actual con el nombre dado", async () => {
    const { result } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });

    let presetId = "";
    act(() => { presetId = result.current.savePresetAs("Mi vista"); });

    expect(presetId).toBeTruthy();
    expect(result.current.presets).toHaveLength(1);
    expect(result.current.presets[0].id).toBe(presetId);
    expect(result.current.presets[0].name).toBe("Mi vista");
    expect(result.current.presets[0].isDefault).toBe(false);
    // El config del preset es un snapshot completo del layoutV2 actual.
    expect(result.current.presets[0].config.cards.length).toBeGreaterThan(0);
  });

  it("applyPreset reemplaza layoutV2 con el config del preset", async () => {
    const { result } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });

    // 1) Modificar el layoutV2 (mover discount a posición custom).
    const modified = {
      ...result.current.layoutV2,
      cards: result.current.layoutV2.cards.map((c) =>
        c.id === "discount" ? { ...c, x: 10, y: 7, w: 2, h: 6 } : c,
      ),
    };
    act(() => { result.current.setLayoutV2(modified); });

    // 2) Guardar como preset.
    let presetId = "";
    act(() => { presetId = result.current.savePresetAs("Custom"); });

    // 3) Mutar el layoutV2 a otra cosa (volver al default).
    act(() => { result.current.resetLayout(); });
    expect(
      result.current.layoutV2.cards.find((c) => c.id === "discount")?.x,
    ).not.toBe(10);

    // 4) Aplicar el preset → recupera la geometría custom.
    let applied = false;
    act(() => { applied = result.current.applyPreset(presetId); });
    expect(applied).toBe(true);
    const discount = result.current.layoutV2.cards.find((c) => c.id === "discount");
    expect(discount?.x).toBe(10);
    expect(discount?.y).toBe(7);
    expect(discount?.w).toBe(2);
    expect(discount?.h).toBe(6);
  });

  it("applyPreset con id inexistente devuelve false sin cambiar layout", async () => {
    const { result } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });
    const before = result.current.layoutV2;
    let applied = true;
    act(() => { applied = result.current.applyPreset("FAKE_ID"); });
    expect(applied).toBe(false);
    expect(result.current.layoutV2).toBe(before); // misma referencia
  });

  it("renamePreset cambia el nombre", async () => {
    const { result } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });

    let id = "";
    act(() => { id = result.current.savePresetAs("Vista A"); });
    act(() => { result.current.renamePreset(id, "Vista renombrada"); });
    expect(result.current.presets[0].name).toBe("Vista renombrada");
  });

  it("duplicatePreset crea una copia con sufijo y nuevo id", async () => {
    const { result } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });

    let id = "";
    act(() => { id = result.current.savePresetAs("A"); });
    act(() => { result.current.duplicatePreset(id); });

    expect(result.current.presets).toHaveLength(2);
    expect(result.current.presets[1].name).toBe("A (copia)");
    expect(result.current.presets[1].id).not.toBe(id);
  });

  it("deletePreset remueve el preset por id", async () => {
    const { result } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });

    let id = "";
    act(() => { id = result.current.savePresetAs("A"); });
    expect(result.current.presets).toHaveLength(1);

    act(() => { result.current.deletePreset(id); });
    expect(result.current.presets).toHaveLength(0);
  });

  it("setDefaultPresetId aplica mutex — solo uno default a la vez", async () => {
    const { result } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });

    let idA = "", idB = "";
    act(() => { idA = result.current.savePresetAs("A"); });
    act(() => { idB = result.current.savePresetAs("B"); });

    act(() => { result.current.setDefaultPresetId(idA); });
    expect(result.current.presets.find((p) => p.id === idA)?.isDefault).toBe(true);
    expect(result.current.presets.find((p) => p.id === idB)?.isDefault).toBe(false);

    // Cambiar default → A queda false, B queda true.
    act(() => { result.current.setDefaultPresetId(idB); });
    expect(result.current.presets.find((p) => p.id === idA)?.isDefault).toBe(false);
    expect(result.current.presets.find((p) => p.id === idB)?.isDefault).toBe(true);

    // null → ninguno default.
    act(() => { result.current.setDefaultPresetId(null); });
    expect(result.current.presets.every((p) => !p.isDefault)).toBe(true);
  });

  it("persistencia — savePresetAs + flush envía invoiceLayoutPresets al backend", async () => {
    const { result, unmount } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });
    mockUpdate.mockClear();

    act(() => { result.current.savePresetAs("Mi vista"); });
    unmount(); // flush al desmontar

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const payload = mockUpdate.mock.calls[0][0];
    expect(payload.invoiceLayoutPresets).toBeDefined();
    expect(payload.invoiceLayoutPresets).toHaveLength(1);
    expect(payload.invoiceLayoutPresets[0].name).toBe("Mi vista");
  });

  it("persistencia atómica — múltiples acciones se combinan en un único patch", async () => {
    const { result, unmount } = renderHook(() => useInvoiceLayout(true));
    await act(async () => { await Promise.resolve(); });
    mockUpdate.mockClear();

    // Ráfaga: cambio de layout + guardar preset → un solo flush.
    act(() => {
      result.current.setLayoutV2({
        ...result.current.layoutV2,
        cards: result.current.layoutV2.cards.slice(),
      });
    });
    act(() => { result.current.savePresetAs("Combo"); });

    unmount();
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const payload = mockUpdate.mock.calls[0][0];
    expect(payload.invoiceLayoutConfig).toBeDefined();
    expect(payload.invoiceLayoutPresets).toBeDefined();
    expect(payload.invoiceLayoutPresets).toHaveLength(1);
  });
});
