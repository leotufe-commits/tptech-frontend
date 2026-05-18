// src/components/ui/__tests__/tp-number-input-format.test.tsx
// TPNumber/TPNumberInput: acepta coma o punto, no recalcula en frontend
// (onChange devuelve number puro), no pierde foco al editar, y con
// `formatType` muestra el separador decimal de la región configurada.
import React, { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TPNumberInput from "../TPNumberInput";

function Harness(props: any) {
  const [v, setV] = useState<number | null>(props.initial ?? null);
  return (
    <TPNumberInput
      value={v}
      onChange={(n) => { setV(n); props.onChange?.(n); }}
      showArrows={false}
      {...props.extra}
    />
  );
}

function input(): HTMLInputElement {
  return screen.getByRole("textbox") as HTMLInputElement;
}

describe("TPNumberInput — acepta coma o punto (universal, sin formatType)", () => {
  it("escribir con coma normaliza a number puro", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.change(input(), { target: { value: "1,5" } });
    expect(onChange).toHaveBeenLastCalledWith(1.5);
  });

  it("escribir con punto normaliza a number puro", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.change(input(), { target: { value: "1.5" } });
    expect(onChange).toHaveBeenLastCalledWith(1.5);
  });

  it("onChange devuelve number (no string formateado) — no recalcula en FE", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.change(input(), { target: { value: "1.000,25" } });
    const arg = onChange.mock.calls.at(-1)![0];
    expect(typeof arg).toBe("number");
    expect(arg).toBe(1000.25);
  });

  it("no pierde el foco al editar (sigue siendo activeElement)", () => {
    render(<Harness />);
    const el = input();
    el.focus();
    fireEvent.change(el, { target: { value: "12,3" } });
    expect(document.activeElement).toBe(el);
  });

  it("sin formatType el display histórico no cambia (punto, decimals=2)", () => {
    render(<Harness initial={1000.5} extra={{ decimals: 2 }} />);
    expect(input().value).toBe("1000.50");
  });
});

describe("TPNumberInput — con formatType usa la región (default AR)", () => {
  it("MONEY muestra miles + decimal de la región (AR: 1.000,50)", () => {
    render(<Harness initial={1000.5} extra={{ formatType: "MONEY" }} />);
    expect(input().value).toBe("1.000,50");
  });

  it("MONEY agrupa miles en montos grandes (2496478.53 → 2.496.478,53)", () => {
    render(<Harness initial={2496478.53} extra={{ formatType: "MONEY" }} />);
    expect(input().value).toBe("2.496.478,53");
  });

  it("QUANTITY: 3 → 3,00 (preset 2 decimales)", () => {
    render(<Harness initial={3} extra={{ formatType: "QUANTITY" }} />);
    expect(input().value).toBe("3,00");
  });

  it("TAX_PERCENT: 21 → 21,00 (sin agrupar, sin sufijo en el input)", () => {
    render(<Harness initial={21} extra={{ formatType: "TAX_PERCENT" }} />);
    expect(input().value).toBe("21,00");
  });

  it("PERCENT (bonificación): 10 → 10,00 sin signo forzado", () => {
    render(<Harness initial={10} extra={{ formatType: "PERCENT" }} />);
    expect(input().value).toBe("10,00");
  });

  it("METAL_GRAMS usa 3 decimales del preset", () => {
    render(<Harness initial={1.25} extra={{ formatType: "METAL_GRAMS" }} />);
    expect(input().value).toBe("1,250");
  });

  it("acepta entrada con miles y coma y emite number puro", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} extra={{ formatType: "MONEY" }} />);
    fireEvent.change(input(), { target: { value: "1.234,56" } });
    expect(onChange).toHaveBeenLastCalledWith(1234.56);
  });

  it("blur reformatea según preset (1,2548 → 1,255 con METAL_GRAMS)", () => {
    render(<Harness initial={1} extra={{ formatType: "METAL_GRAMS" }} />);
    const el = input();
    fireEvent.focus(el);
    fireEvent.change(el, { target: { value: "1,2548" } });
    fireEvent.blur(el);
    expect(el.value).toBe("1,255");
  });
});
