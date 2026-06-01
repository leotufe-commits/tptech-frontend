// src/components/sales/__tests__/TPBalanceModeSelector.test.tsx
// =============================================================================
// T60 (Fase 4.2) — Tests del selector visual de Balance Mode Override.
//
// Cubren:
//   1. Render del badge con el modo efectivo.
//   2. Tag "Manual" solo cuando hay override explícito.
//   3. Tooltip / title con el origen legible.
//   4. Cambiar UNIFIED → BREAKDOWN llama onOverrideChange("BREAKDOWN").
//   5. Cambiar a Automático llama onOverrideChange(null).
//   6. Popover se cierra al clickear opción.
//   7. Disabled (venta confirmada) no abre el popover.
//   8. Sin effectiveMode no renderiza nada.
//   9. Mismo modo Auto vs Manual: el badge muestra Manual solo si hay override.
//  10. Multi-source label legible (ENTITY_DEFAULT → "Cliente", etc.).
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TPBalanceModeSelector } from "../TPBalanceModeSelector";

describe("TPBalanceModeSelector — render", () => {
  it("muestra el modo efectivo en el badge", () => {
    render(
      <TPBalanceModeSelector
        effectiveMode="BREAKDOWN"
        source="ENTITY_DEFAULT"
        onOverrideChange={() => {}}
      />,
    );
    expect(screen.getByText("Desglosado")).toBeTruthy();
  });

  it("UNIFIED se etiqueta como 'Unificado'", () => {
    render(
      <TPBalanceModeSelector
        effectiveMode="UNIFIED"
        source="TENANT_DEFAULT"
        onOverrideChange={() => {}}
      />,
    );
    expect(screen.getByText("Unificado")).toBeTruthy();
  });

  it("sin effectiveMode → no renderiza nada", () => {
    const { container } = render(
      <TPBalanceModeSelector onOverrideChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("override manual → renderiza el chip 'Manual'", () => {
    render(
      <TPBalanceModeSelector
        effectiveMode="BREAKDOWN"
        source="DOCUMENT_OVERRIDE"
        override="BREAKDOWN"
        onOverrideChange={() => {}}
      />,
    );
    expect(screen.getByTestId("balance-mode-override-tag")).toBeTruthy();
  });

  it("sin override (Automático) → NO renderiza chip 'Manual'", () => {
    render(
      <TPBalanceModeSelector
        effectiveMode="UNIFIED"
        source="ENTITY_DEFAULT"
        override={null}
        onOverrideChange={() => {}}
      />,
    );
    expect(screen.queryByTestId("balance-mode-override-tag")).toBeNull();
  });

  it("tooltip incluye el origen legible (ENTITY_DEFAULT → Cliente)", () => {
    render(
      <TPBalanceModeSelector
        effectiveMode="UNIFIED"
        source="ENTITY_DEFAULT"
        onOverrideChange={() => {}}
      />,
    );
    const badge = screen.getByTestId("balance-mode-selector-badge");
    expect(badge.getAttribute("title")).toContain("Cliente");
  });

  it("tooltip incluye '(override manual)' cuando hay override", () => {
    render(
      <TPBalanceModeSelector
        effectiveMode="BREAKDOWN"
        source="DOCUMENT_OVERRIDE"
        override="BREAKDOWN"
        onOverrideChange={() => {}}
      />,
    );
    const badge = screen.getByTestId("balance-mode-selector-badge");
    expect(badge.getAttribute("title")).toContain("override manual");
  });
});

describe("TPBalanceModeSelector — interacciones", () => {
  it("click en badge abre el popover con las 3 opciones", () => {
    render(
      <TPBalanceModeSelector
        effectiveMode="UNIFIED"
        source="ENTITY_DEFAULT"
        onOverrideChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("balance-mode-selector-badge"));
    expect(screen.getByTestId("balance-mode-selector-menu")).toBeTruthy();
    expect(screen.getByTestId("balance-mode-option-auto")).toBeTruthy();
    expect(screen.getByTestId("balance-mode-option-unified")).toBeTruthy();
    expect(screen.getByTestId("balance-mode-option-breakdown")).toBeTruthy();
  });

  it("cambiar a BREAKDOWN llama onOverrideChange('BREAKDOWN')", () => {
    const spy = vi.fn();
    render(
      <TPBalanceModeSelector
        effectiveMode="UNIFIED"
        source="TENANT_DEFAULT"
        onOverrideChange={spy}
      />,
    );
    fireEvent.click(screen.getByTestId("balance-mode-selector-badge"));
    fireEvent.click(screen.getByTestId("balance-mode-option-breakdown"));
    expect(spy).toHaveBeenCalledWith("BREAKDOWN");
  });

  it("cambiar a UNIFIED llama onOverrideChange('UNIFIED')", () => {
    const spy = vi.fn();
    render(
      <TPBalanceModeSelector
        effectiveMode="BREAKDOWN"
        source="ENTITY_DEFAULT"
        override="BREAKDOWN"
        onOverrideChange={spy}
      />,
    );
    fireEvent.click(screen.getByTestId("balance-mode-selector-badge"));
    fireEvent.click(screen.getByTestId("balance-mode-option-unified"));
    expect(spy).toHaveBeenCalledWith("UNIFIED");
  });

  it("cambiar a 'Automático' llama onOverrideChange(null)", () => {
    const spy = vi.fn();
    render(
      <TPBalanceModeSelector
        effectiveMode="BREAKDOWN"
        source="DOCUMENT_OVERRIDE"
        override="BREAKDOWN"
        onOverrideChange={spy}
      />,
    );
    fireEvent.click(screen.getByTestId("balance-mode-selector-badge"));
    fireEvent.click(screen.getByTestId("balance-mode-option-auto"));
    expect(spy).toHaveBeenCalledWith(null);
  });

  it("popover se cierra al seleccionar una opción", () => {
    render(
      <TPBalanceModeSelector
        effectiveMode="UNIFIED"
        source="TENANT_DEFAULT"
        onOverrideChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("balance-mode-selector-badge"));
    expect(screen.getByTestId("balance-mode-selector-menu")).toBeTruthy();
    fireEvent.click(screen.getByTestId("balance-mode-option-breakdown"));
    expect(screen.queryByTestId("balance-mode-selector-menu")).toBeNull();
  });

  it("disabled (venta confirmada) no abre el popover", () => {
    render(
      <TPBalanceModeSelector
        effectiveMode="UNIFIED"
        source="ENTITY_DEFAULT"
        onOverrideChange={() => {}}
        disabled
      />,
    );
    fireEvent.click(screen.getByTestId("balance-mode-selector-badge"));
    expect(screen.queryByTestId("balance-mode-selector-menu")).toBeNull();
  });
});

describe("TPBalanceModeSelector — labels de origen", () => {
  it.each([
    ["DOCUMENT_OVERRIDE",  "Manual del documento"],
    ["ENTITY_DEFAULT",     "Cliente"],
    ["PRICELIST_DEFAULT",  "Lista de precios"],
    ["TENANT_DEFAULT",     "Configuración del tenant"],
    ["FALLBACK_UNIFIED",   "Por defecto"],
  ])("source=%s → tooltip contiene '%s'", (src, label) => {
    render(
      <TPBalanceModeSelector
        effectiveMode="UNIFIED"
        source={src}
        onOverrideChange={() => {}}
      />,
    );
    const badge = screen.getByTestId("balance-mode-selector-badge");
    expect(badge.getAttribute("title")).toContain(label);
  });

  it("source desconocido → se muestra tal cual (passthrough)", () => {
    render(
      <TPBalanceModeSelector
        effectiveMode="UNIFIED"
        source="LEGACY_BALANCE_TYPE"
        onOverrideChange={() => {}}
      />,
    );
    const badge = screen.getByTestId("balance-mode-selector-badge");
    expect(badge.getAttribute("title")).toContain("LEGACY_BALANCE_TYPE");
  });
});
