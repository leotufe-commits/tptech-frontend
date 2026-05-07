// src/components/ui/__tests__/baseline-tp-quantity-field.test.tsx
// =============================================================================
// TPQuantityField — sidecar "×" (uniformidad visual con Bonificación / Impuestos).
//
// Reglas verificadas:
//   · compactInline=true  → renderea sidecar "×" (span no clickeable) al lado
//     del TPNumberInput. Mismas clases visuales que el sidecar %/$ de
//     Bonificación/Impuestos (h-[42px], rounded-md, border, bg-card, text-muted/60).
//   · compactInline=false → NO renderea sidecar (preserva pantallas legacy:
//     Compras / Presupuestos / Órdenes).
//   · "×" es un span con aria-hidden="true" — semánticamente NO interactivo,
//     solo indicador visual de multiplicador.
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TPQuantityField } from "../TPQuantityField";

const noopChange = vi.fn();

describe("TPQuantityField — sidecar × en compactInline", () => {
  it("baseline correct: compactInline=true renderea sidecar '×'", () => {
    render(
      <TPQuantityField
        value={2}
        onChange={noopChange}
        constraints={{ default: 1, step: 1 }}
        compactInline
      />,
    );
    const sidecar = screen.getByText("×");
    expect(sidecar).toBeInTheDocument();
    // Es un <span>, NO un <button>.
    expect(sidecar.tagName).toBe("SPAN");
    // Tooltip aclaratorio.
    expect(sidecar.getAttribute("title")).toBe("Multiplica por unitario");
    // aria-hidden — no interactivo.
    expect(sidecar.getAttribute("aria-hidden")).toBe("true");
  });

  it("baseline correct: sidecar usa las mismas clases visuales que Bonif/Impuestos", () => {
    render(
      <TPQuantityField
        value={2}
        onChange={noopChange}
        constraints={{ default: 1, step: 1 }}
        compactInline
      />,
    );
    const sidecar = screen.getByText("×");
    // Replica idéntica del sidecar de Bonificación/Impuestos:
    // inline-flex h-[42px] shrink-0 items-center justify-center
    // rounded-md border border-border bg-card px-1.5 text-[11px]
    // font-semibold text-muted/60
    expect(sidecar.className).toMatch(/inline-flex/);
    expect(sidecar.className).toMatch(/h-\[42px\]/);
    expect(sidecar.className).toMatch(/rounded-md/);
    expect(sidecar.className).toMatch(/border/);
    expect(sidecar.className).toMatch(/bg-card/);
    expect(sidecar.className).toMatch(/text-\[11px\]/);
    expect(sidecar.className).toMatch(/font-semibold/);
    expect(sidecar.className).toMatch(/text-muted\/60/);
  });

  it("baseline correct: compactInline=false NO renderea sidecar (legacy intacto)", () => {
    render(
      <TPQuantityField
        value={2}
        onChange={noopChange}
        constraints={{ default: 1, step: 1 }}
        compactInline={false}
      />,
    );
    expect(screen.queryByText("×")).toBeNull();
  });

  it("baseline correct: compactInline omitido (default) tampoco renderea sidecar", () => {
    render(
      <TPQuantityField
        value={2}
        onChange={noopChange}
        constraints={{ default: 1, step: 1 }}
      />,
    );
    expect(screen.queryByText("×")).toBeNull();
  });
});
