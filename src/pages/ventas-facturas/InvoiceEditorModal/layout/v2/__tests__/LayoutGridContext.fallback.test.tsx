// src/pages/ventas-facturas/InvoiceEditorModal/layout/v2/__tests__/LayoutGridContext.fallback.test.tsx
// ============================================================================
// Regresión: primer paint del `LayoutGridContext` con `containerWidth=0`.
//
// Antes del fix los cards quedaban apilados en (0,0) con `width=0px` durante
// el primer paint, porque `cellWidth` se calculaba como
// `(containerWidth - gap*(cols-1)) / cols` y `containerWidth` arrancaba en 0
// hasta que el `ResizeObserver` corría su primer tick.
//
// El fix usa `useLayoutEffect` para medir el ancho sincrónicamente ANTES del
// paint, y un fallback de 480px si la medición es 0 (entornos headless
// como JSDOM donde `clientWidth` siempre devuelve 0).
//
// Este test garantiza que TODOS los cards de la región tienen `width > 0px`
// inmediatamente tras montar — sin esperar al ResizeObserver.
// ============================================================================

import { describe, it, expect, beforeAll } from "vitest";
import { render } from "@testing-library/react";
import { LayoutGridContext } from "../LayoutGridContext";
import { LAYOUT_V2_COMPACT } from "../presetLayouts";

// JSDOM no implementa ResizeObserver; el LayoutGridContext lo usa para
// detectar resize del aside. Polyfill no-op suficiente para los tests
// (el comportamiento que validamos NO depende de la observación real,
// solo del primer render).
beforeAll(() => {
  if (typeof window.ResizeObserver === "undefined") {
    class ResizeObserverMock {
      observe(): void { /* no-op */ }
      unobserve(): void { /* no-op */ }
      disconnect(): void { /* no-op */ }
    }
    (window as unknown as { ResizeObserver: typeof ResizeObserverMock })
      .ResizeObserver = ResizeObserverMock;
  }
});

describe("LayoutGridContext — primer paint sin medición de ancho", () => {
  it("aplica width > 0 a cada card aunque containerWidth todavía sea 0 (JSDOM)", () => {
    const { container } = render(
      <LayoutGridContext
        layout={LAYOUT_V2_COMPACT}
        region="aside"
        regionOriginX={8}
        regionColumns={4}
        onLayoutChange={() => { /* no-op */ }}
        renderCard={(id) => <div data-testid={`card-${id}`}>{id}</div>}
        readOnly={true}
      />,
    );

    // Todas las cards aside del layout COMPACT deben tener width inline > 0.
    const cards = container.querySelectorAll<HTMLDivElement>(
      "[data-tp-invoice-layout-grid-card]",
    );
    expect(cards.length).toBeGreaterThan(0);

    for (const cardWrapper of Array.from(cards)) {
      const positioned = cardWrapper.parentElement as HTMLDivElement | null;
      expect(positioned).not.toBeNull();
      const style = positioned!.style;
      // El cellWidth derivado del fallback 480 debe producir width > 0 px.
      const widthPx = parseFloat(style.width);
      expect(widthPx).toBeGreaterThan(0);
      const heightPx = parseFloat(style.height);
      expect(heightPx).toBeGreaterThan(0);
    }
  });
});
