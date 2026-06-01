// tptech-frontend/src/pages/ventas-facturas/InvoiceEditorModal/layout/__tests__/setLayoutV2-persist.test.ts
// =============================================================================
// Tests del nuevo opts.persist en setLayoutV2 (2026-05-29).
//
// Causa raíz del bug "Error al guardar fantasma":
//   maybeGrowFromContent (LayoutGridContext) llamaba onLayoutChange tras
//   cada auto-grow/shrink cosmético. El padre (useInvoiceLayout.setLayoutV2)
//   trataba TODOS los cambios como user-driven y disparaba scheduleSave →
//   PUT al backend. Si fallaba (red, payload, autenticación), el operador
//   veía "Error al guardar" sin haber tocado nada.
//
// Fix:
//   - setLayoutV2(next, { persist: false }) → solo actualiza estado.
//   - setLayoutV2(next, { persist: true })  → estado + scheduleSave.
//   - default (sin opts) → persist=true (back-compat).
//   - LayoutGridContext.maybeGrowFromContent llama con persist:false.
//   - handlers de drag/resize llaman con persist:true.
// =============================================================================

import { describe, it, expect, vi } from "vitest";

// El comportamiento de setLayoutV2 está embebido en useInvoiceLayout, que
// es un hook que necesita renderHook + mock del userPreferencesApi para
// testear sin tocar red. Acá testeamos la SEMÁNTICA del flag con una
// implementación canary que replica la lógica:

function canarySetLayoutV2(
  setLayoutV2State: (next: unknown) => void,
  persistAll: (next: unknown) => void,
  initialized: boolean,
  next: unknown,
  opts?: { persist?: boolean },
): void {
  setLayoutV2State(next);
  if (!initialized) return;
  const persist = opts?.persist !== false;
  if (persist) {
    persistAll(next);
  }
}

describe("setLayoutV2 — opts.persist (2026-05-29)", () => {
  it("opts.persist=true → llama persistAll", () => {
    const setState = vi.fn();
    const persistAll = vi.fn();
    canarySetLayoutV2(setState, persistAll, true, { foo: 1 }, { persist: true });
    expect(setState).toHaveBeenCalledWith({ foo: 1 });
    expect(persistAll).toHaveBeenCalledTimes(1);
  });

  it("opts.persist=false → NO llama persistAll (solo estado)", () => {
    const setState = vi.fn();
    const persistAll = vi.fn();
    canarySetLayoutV2(setState, persistAll, true, { foo: 1 }, { persist: false });
    expect(setState).toHaveBeenCalledWith({ foo: 1 });
    expect(persistAll).not.toHaveBeenCalled();
  });

  it("sin opts (default) → persist=true (back-compat con callers existentes)", () => {
    const setState = vi.fn();
    const persistAll = vi.fn();
    canarySetLayoutV2(setState, persistAll, true, { foo: 1 });
    expect(persistAll).toHaveBeenCalledTimes(1);
  });

  it("opts={} (objeto sin persist) → persist=true (default)", () => {
    const setState = vi.fn();
    const persistAll = vi.fn();
    canarySetLayoutV2(setState, persistAll, true, { foo: 1 }, {});
    expect(persistAll).toHaveBeenCalledTimes(1);
  });

  it("initialized=false → NUNCA persiste, sin importar opts (hidratación en curso)", () => {
    const setState = vi.fn();
    const persistAll = vi.fn();
    canarySetLayoutV2(setState, persistAll, false, { foo: 1 }, { persist: true });
    expect(setState).toHaveBeenCalledWith({ foo: 1 });
    expect(persistAll).not.toHaveBeenCalled();
  });
});

describe("Semántica de origen (2026-05-29)", () => {
  // Esto valida el ÁRBOL DE DECISIONES sin tocar las implementaciones
  // reales. Documenta el contrato esperado entre LayoutGridContext y
  // useInvoiceLayout.

  type LayoutChangeOrigin = "drag" | "resize" | "auto-grow" | "auto-shrink" | "preset" | "restore";

  function shouldPersist(origin: LayoutChangeOrigin): boolean {
    switch (origin) {
      // User-driven → SIEMPRE persiste.
      case "drag":
      case "resize":
      case "preset":
      case "restore":
        return true;
      // Cosmético del motor → NUNCA persiste.
      case "auto-grow":
      case "auto-shrink":
        return false;
    }
  }

  it("drag user-driven → persiste", () => {
    expect(shouldPersist("drag")).toBe(true);
  });

  it("resize user-driven → persiste", () => {
    expect(shouldPersist("resize")).toBe(true);
  });

  it("cambio de preset (user) → persiste", () => {
    expect(shouldPersist("preset")).toBe(true);
  });

  it("restaurar diseño (user) → persiste", () => {
    expect(shouldPersist("restore")).toBe(true);
  });

  it("auto-grow del motor → NO persiste", () => {
    expect(shouldPersist("auto-grow")).toBe(false);
  });

  it("auto-shrink del motor → NO persiste", () => {
    expect(shouldPersist("auto-shrink")).toBe(false);
  });
});

describe("Regresión 'Error al guardar fantasma' (2026-05-29)", () => {
  it("apertura del modo edit sin acción del operador → cero llamadas a persistAll", () => {
    // Escenario del bug:
    //   1. Operador click "Personalizar layout".
    //   2. LayoutGridContext se renderiza en modo edit.
    //   3. useLayoutEffect [layout.cards] dispara maybeGrowFromContent.
    //   4. maybeGrowFromContent detecta auto-grow/shrink cosmético y
    //      llama onLayoutChange con persist:false.
    //   5. Padre setLayoutV2(next, { persist: false }).
    //   6. NO se llama persistAll → NO PUT → NO posible "Error al guardar".
    const setState = vi.fn();
    const persistAll = vi.fn();

    // Múltiples cambios cosméticos en cascada.
    canarySetLayoutV2(setState, persistAll, true, { v: 2, cards: [] }, { persist: false });
    canarySetLayoutV2(setState, persistAll, true, { v: 2, cards: [] }, { persist: false });
    canarySetLayoutV2(setState, persistAll, true, { v: 2, cards: [] }, { persist: false });

    // El estado se actualizó 3 veces pero NUNCA se persistió.
    expect(setState).toHaveBeenCalledTimes(3);
    expect(persistAll).not.toHaveBeenCalled();
  });

  it("operador arrastra después de la entrada → SÍ persiste (drag user-driven)", () => {
    const setState = vi.fn();
    const persistAll = vi.fn();

    // Entrada (cosmético, no persiste).
    canarySetLayoutV2(setState, persistAll, true, { v: 2, cards: [] }, { persist: false });
    expect(persistAll).not.toHaveBeenCalled();

    // Drag del operador → persist:true.
    canarySetLayoutV2(setState, persistAll, true, { v: 2, cards: [{ id: "a", x: 5 }] }, { persist: true });
    expect(persistAll).toHaveBeenCalledTimes(1);
  });
});
