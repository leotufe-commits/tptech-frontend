// src/components/ui/__tests__/baseline-tp-quantity-field.test.tsx
// =============================================================================
// TPQuantityField — la "X" de Cantidad vive DENTRO del TPNumber (igual que
// Bonificación e Impuestos). Se eliminó el sidecar decorativo "×" externo
// (caja entre Cantidad y Precio que parecía "borrar línea").
//
// Reglas verificadas:
//   · NUNCA se renderiza un sidecar "×" externo (ni con compactInline true/false).
//   · Con `onClear` → el TPNumberInput muestra su "X" interna (botón
//     aria-label="Limpiar valor"), MISMO patrón que Bonif/Impuestos.
//   · Sin `onClear` → no hay ninguna "X".
//   · El input numérico de cantidad sigue siendo editable.
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TPQuantityField } from "../TPQuantityField";

const noopChange = vi.fn();

describe("TPQuantityField — X interna (sin sidecar externo)", () => {
  it("NO renderea el sidecar decorativo '×' (compactInline=true)", () => {
    render(
      <TPQuantityField
        value={2}
        onChange={noopChange}
        constraints={{ default: 1, step: 1 }}
        compactInline
      />,
    );
    expect(screen.queryByText("×")).toBeNull();
    expect(screen.queryByTitle("Multiplica por unitario")).toBeNull();
  });

  it("NO renderea el sidecar '×' (compactInline=false ni default)", () => {
    const { rerender } = render(
      <TPQuantityField
        value={2}
        onChange={noopChange}
        constraints={{ default: 1, step: 1 }}
        compactInline={false}
      />,
    );
    expect(screen.queryByText("×")).toBeNull();
    rerender(
      <TPQuantityField value={2} onChange={noopChange} constraints={{ default: 1, step: 1 }} />,
    );
    expect(screen.queryByText("×")).toBeNull();
  });

  it("con onClear → muestra la X interna del TPNumber (igual que Bonif/Impuestos) y dispara el handler", () => {
    const onClear = vi.fn();
    render(
      <TPQuantityField
        value={5}
        onChange={noopChange}
        constraints={{ default: 1, step: 1 }}
        compactInline
        onClear={onClear}
      />,
    );
    const x = screen.getByRole("button", { name: "Limpiar valor" });
    expect(x).toBeInTheDocument();
    fireEvent.click(x);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("sin onClear → no hay ninguna X de limpiar", () => {
    render(
      <TPQuantityField
        value={5}
        onChange={noopChange}
        constraints={{ default: 1, step: 1 }}
        compactInline
      />,
    );
    expect(screen.queryByRole("button", { name: "Limpiar valor" })).toBeNull();
  });

  it("el input de cantidad sigue siendo editable", () => {
    const onChange = vi.fn();
    render(
      <TPQuantityField
        value={2}
        onChange={onChange}
        constraints={{ default: 1, step: 1 }}
        compactInline
      />,
    );
    const input = document.querySelector("input") as HTMLInputElement;
    expect(input).toBeTruthy();
    fireEvent.change(input, { target: { value: "7" } });
    expect(onChange).toHaveBeenCalledWith(7);
  });
});
