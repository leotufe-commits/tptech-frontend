// src/components/sales/__tests__/TPBalanceModeSelector.test.tsx
// =============================================================================
// Tests del selector de Balance Mode — Etapa UX 2.1 (switch solo-modo + línea
// de origen separada + link "Volver a automático").
//
// Cubren:
//   1. Render de los dos segmentos con el modo efectivo resaltado.
//   2. Línea "Origen:" siempre visible con la etiqueta legible.
//   3. Override manual → Origen "Manual" + link "Volver a automático".
//   4. Sin override → Origen = fuente real, sin link de reset.
//   5. Click segmento Unificado/Desglosado → onOverrideChange(modo).
//   6. Click "Volver a automático" → onOverrideChange(null).
//   7. Disabled no dispara cambios.
//   8. Sin effectiveMode no renderiza nada.
//   9. Mapeo de orígenes (incluye USER_PREFERENCE → "Preferencia usuario").
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TPBalanceModeSelector } from "../TPBalanceModeSelector";

describe("TPBalanceModeSelector — switch (solo modo)", () => {
  it("muestra ambos segmentos con el modo efectivo resaltado", () => {
    render(
      <TPBalanceModeSelector
        effectiveMode="BREAKDOWN"
        source="ENTITY_DEFAULT"
        onOverrideChange={() => {}}
      />,
    );
    expect(screen.getByTestId("balance-mode-segment-breakdown").getAttribute("data-active")).toBe("true");
    expect(screen.getByTestId("balance-mode-segment-unified").getAttribute("data-active")).toBe("false");
  });

  it("sin effectiveMode → no renderiza nada", () => {
    const { container } = render(<TPBalanceModeSelector onOverrideChange={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("TPBalanceModeSelector — línea de origen", () => {
  it("automático → Origen = fuente real, SIN link de reset", () => {
    render(
      <TPBalanceModeSelector
        effectiveMode="UNIFIED"
        source="ENTITY_DEFAULT"
        override={null}
        onOverrideChange={() => {}}
      />,
    );
    const origin = screen.getByTestId("balance-mode-origin");
    expect(origin.textContent).toContain("Cliente");
    expect(screen.queryByTestId("balance-mode-reset")).toBeNull();
  });

  it("override manual → Origen 'Manual' + link 'Volver a automático'", () => {
    render(
      <TPBalanceModeSelector
        effectiveMode="BREAKDOWN"
        source="DOCUMENT_OVERRIDE"
        override="BREAKDOWN"
        onOverrideChange={() => {}}
      />,
    );
    const origin = screen.getByTestId("balance-mode-origin");
    expect(origin.textContent).toContain("Manual");
    expect(screen.getByTestId("balance-mode-reset")).toBeTruthy();
  });

  it("override manual → Origen 'Manual' aunque el source aún no sea DOCUMENT_OVERRIDE", () => {
    // Antes de que el preview vuelva, el override ya implica Manual.
    render(
      <TPBalanceModeSelector
        effectiveMode="UNIFIED"
        source="ENTITY_DEFAULT"
        override="UNIFIED"
        onOverrideChange={() => {}}
      />,
    );
    expect(screen.getByTestId("balance-mode-origin").textContent).toContain("Manual");
  });
});

describe("TPBalanceModeSelector — interacciones", () => {
  it("click en segmento Desglosado → onOverrideChange('BREAKDOWN')", () => {
    const spy = vi.fn();
    render(
      <TPBalanceModeSelector effectiveMode="UNIFIED" source="TENANT_DEFAULT" onOverrideChange={spy} />,
    );
    fireEvent.click(screen.getByTestId("balance-mode-segment-breakdown"));
    expect(spy).toHaveBeenCalledWith("BREAKDOWN");
  });

  it("click en segmento Unificado → onOverrideChange('UNIFIED')", () => {
    const spy = vi.fn();
    render(
      <TPBalanceModeSelector
        effectiveMode="BREAKDOWN"
        source="ENTITY_DEFAULT"
        override="BREAKDOWN"
        onOverrideChange={spy}
      />,
    );
    fireEvent.click(screen.getByTestId("balance-mode-segment-unified"));
    expect(spy).toHaveBeenCalledWith("UNIFIED");
  });

  it("click en 'Volver a automático' → onOverrideChange(null)", () => {
    const spy = vi.fn();
    render(
      <TPBalanceModeSelector
        effectiveMode="BREAKDOWN"
        source="DOCUMENT_OVERRIDE"
        override="BREAKDOWN"
        onOverrideChange={spy}
      />,
    );
    fireEvent.click(screen.getByTestId("balance-mode-reset"));
    expect(spy).toHaveBeenCalledWith(null);
  });

  it("disabled no dispara cambios", () => {
    const spy = vi.fn();
    render(
      <TPBalanceModeSelector effectiveMode="UNIFIED" source="ENTITY_DEFAULT" onOverrideChange={spy} disabled />,
    );
    fireEvent.click(screen.getByTestId("balance-mode-segment-breakdown"));
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("TPBalanceModeSelector — mapeo de orígenes", () => {
  it.each([
    ["ENTITY_DEFAULT",     "Cliente"],
    ["USER_PREFERENCE",    "Preferencia usuario"],
    ["PRICELIST_DEFAULT",  "Lista de precios"],
    ["TENANT_DEFAULT",     "Sistema"],
    ["FALLBACK_UNIFIED",   "Sistema (por defecto)"],
  ])("source=%s → Origen '%s'", (src, label) => {
    render(
      <TPBalanceModeSelector
        effectiveMode="UNIFIED"
        source={src}
        override={null}
        onOverrideChange={() => {}}
      />,
    );
    expect(screen.getByTestId("balance-mode-origin").textContent).toContain(label);
  });

  it("source desconocido → se muestra tal cual (passthrough)", () => {
    render(
      <TPBalanceModeSelector
        effectiveMode="UNIFIED"
        source="LEGACY_BALANCE_TYPE"
        override={null}
        onOverrideChange={() => {}}
      />,
    );
    expect(screen.getByTestId("balance-mode-origin").textContent).toContain("LEGACY_BALANCE_TYPE");
  });
});
