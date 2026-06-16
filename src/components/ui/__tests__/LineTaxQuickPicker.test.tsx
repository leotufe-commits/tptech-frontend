// src/components/ui/__tests__/LineTaxQuickPicker.test.tsx
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { LineTaxQuickPicker, type AvailableLineTax } from "../LineTaxQuickPicker";

const TAXES: AvailableLineTax[] = [
  { id: "t1", name: "IVA", rate: 21 },
  { id: "t2", name: "Percepción IIBB", rate: 3 },
  { id: "t3", name: "Impuesto interno", rate: 5 },
];

function open(container: HTMLElement) {
  fireEvent.click(container.querySelector("[data-tp-tax-quick-toggle]")!);
}

describe("LineTaxQuickPicker — multi-selección con suma de tasas", () => {
  it("click en 'Impuestos' abre el dropdown con los impuestos del sistema", () => {
    const { container, getByText } = render(<LineTaxQuickPicker taxes={TAXES} onApply={vi.fn()} />);
    expect(container.querySelector("[data-tp-tax-quick-menu]")).toBeNull();
    open(container);
    expect(container.querySelector("[data-tp-tax-quick-menu]")).not.toBeNull();
    expect(getByText("IVA")).toBeInTheDocument();
    expect(getByText("Percepción IIBB")).toBeInTheDocument();
    expect(getByText("Impuesto interno")).toBeInTheDocument();
  });

  it("seleccionar un impuesto carga su tasa (onApply con 21)", () => {
    const onApply = vi.fn();
    const { container, getByText } = render(<LineTaxQuickPicker taxes={TAXES} onApply={onApply} />);
    open(container);
    fireEvent.click(getByText("IVA"));
    expect(onApply).toHaveBeenLastCalledWith(21);
  });

  it("seleccionar dos o más suma las tasas (21 + 3 + 5 = 29)", () => {
    const onApply = vi.fn();
    const { container, getByText } = render(<LineTaxQuickPicker taxes={TAXES} onApply={onApply} />);
    open(container);
    fireEvent.click(getByText("IVA"));               // 21
    fireEvent.click(getByText("Percepción IIBB"));   // 24
    fireEvent.click(getByText("Impuesto interno"));  // 29
    expect(onApply).toHaveBeenLastCalledWith(29);
    // "Total: 29%" visible.
    expect((container.querySelector("[data-tp-tax-quick-total]")?.textContent ?? "")).toMatch(/29/);
  });

  it("deseleccionar actualiza la suma (29 → 26 al quitar Percepción)", () => {
    const onApply = vi.fn();
    const { container, getByText } = render(<LineTaxQuickPicker taxes={TAXES} onApply={onApply} />);
    open(container);
    fireEvent.click(getByText("IVA"));               // 21
    fireEvent.click(getByText("Percepción IIBB"));   // 24
    fireEvent.click(getByText("Impuesto interno"));  // 29
    fireEvent.click(getByText("Percepción IIBB"));   // 29 - 3 = 26
    expect(onApply).toHaveBeenLastCalledWith(26);
  });

  it("sin seleccionados → suma 0 (limpia el override según contrato actual)", () => {
    const onApply = vi.fn();
    const { container, getByText } = render(<LineTaxQuickPicker taxes={TAXES} onApply={onApply} />);
    open(container);
    fireEvent.click(getByText("IVA"));  // 21
    fireEvent.click(getByText("IVA"));  // 0
    expect(onApply).toHaveBeenLastCalledWith(0);
  });

  it("tasas decimales suman sin ruido de punto flotante (10.5 + 3.3 = 13.8)", () => {
    const onApply = vi.fn();
    const decimals: AvailableLineTax[] = [
      { id: "d1", name: "A", rate: 10.5 },
      { id: "d2", name: "B", rate: 3.3 },
    ];
    const { container, getByText } = render(<LineTaxQuickPicker taxes={decimals} onApply={onApply} />);
    open(container);
    fireEvent.click(getByText("A"));
    fireEvent.click(getByText("B"));
    expect(onApply).toHaveBeenLastCalledWith(13.8);
  });

  it("Escape cierra el dropdown", () => {
    const { container } = render(<LineTaxQuickPicker taxes={TAXES} onApply={vi.fn()} />);
    open(container);
    expect(container.querySelector("[data-tp-tax-quick-menu]")).not.toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(container.querySelector("[data-tp-tax-quick-menu]")).toBeNull();
  });

  it("click FUERA del dropdown lo cierra", () => {
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    const { container } = render(<LineTaxQuickPicker taxes={TAXES} onApply={vi.fn()} />);
    open(container);
    expect(container.querySelector("[data-tp-tax-quick-menu]")).not.toBeNull();
    fireEvent.mouseDown(outside);
    expect(container.querySelector("[data-tp-tax-quick-menu]")).toBeNull();
    outside.remove();
  });

  it("click FUERA sobre un control que detiene la propagación (capture) IGUAL cierra", () => {
    // Reproduce el bug: un control hermano hace stopPropagation en mousedown.
    // El listener en FASE DE CAPTURA corre antes → el dropdown cierra igual.
    const outside = document.createElement("input");
    outside.addEventListener("mousedown", (e) => e.stopPropagation());
    document.body.appendChild(outside);
    const { container } = render(<LineTaxQuickPicker taxes={TAXES} onApply={vi.fn()} />);
    open(container);
    fireEvent.mouseDown(outside);
    expect(container.querySelector("[data-tp-tax-quick-menu]")).toBeNull();
    outside.remove();
  });

  it("click DENTRO del dropdown (item) NO lo cierra; mantiene multi-select abierto", () => {
    const { container, getByText } = render(<LineTaxQuickPicker taxes={TAXES} onApply={vi.fn()} />);
    open(container);
    fireEvent.mouseDown(getByText("IVA"));
    fireEvent.click(getByText("IVA"));
    // Sigue abierto tras seleccionar.
    expect(container.querySelector("[data-tp-tax-quick-menu]")).not.toBeNull();
    // Y puede seguir seleccionando.
    fireEvent.click(getByText("Percepción IIBB"));
    expect(container.querySelector("[data-tp-tax-quick-menu]")).not.toBeNull();
  });

  it("click en el label togglea abrir/cerrar", () => {
    const { container } = render(<LineTaxQuickPicker taxes={TAXES} onApply={vi.fn()} />);
    const toggle = container.querySelector("[data-tp-tax-quick-toggle]")!;
    fireEvent.click(toggle);
    expect(container.querySelector("[data-tp-tax-quick-menu]")).not.toBeNull();
    fireEvent.click(toggle);
    expect(container.querySelector("[data-tp-tax-quick-menu]")).toBeNull();
  });

  it("sin impuestos disponibles → label plano (no interactivo)", () => {
    const { container, getByText } = render(<LineTaxQuickPicker taxes={[]} onApply={vi.fn()} />);
    expect(container.querySelector("[data-tp-tax-quick-toggle]")).toBeNull();
    expect(getByText("Impuestos")).toBeInTheDocument();
  });

  it("disabled → label plano (no interactivo)", () => {
    const { container } = render(<LineTaxQuickPicker taxes={TAXES} onApply={vi.fn()} disabled />);
    expect(container.querySelector("[data-tp-tax-quick-toggle]")).toBeNull();
  });
});
