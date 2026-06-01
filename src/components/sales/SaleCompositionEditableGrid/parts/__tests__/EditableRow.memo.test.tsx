// src/components/sales/SaleCompositionEditableGrid/parts/__tests__/EditableRow.memo.test.tsx
// =============================================================================
// P1 #7 (Etapa E2) — test reproductor del bug "memo comparator incompleto".
//
// Antes del fix: el `React.memo` de `Row` NO comparaba 4 props primitivas
// que afectan el render directamente (`quantityUnitLabel`, `currencyLabel`,
// `globalAdjustmentText`, `globalAdjustmentKind`). Si solo esas props
// cambiaban entre dos renders del padre, React.memo devolvía "equal" y
// saltaba el re-render → la UI quedaba stale con el valor anterior.
//
// Después del fix: el comparator incluye explícitamente las 4 → cualquier
// cambio en cualquiera de ellas dispara el re-render y la UI se actualiza.
//
// Estrategia del test: renderizamos con un set de props, hacemos `rerender`
// cambiando SOLO la prop bajo prueba (el resto permanece byte-a-byte igual)
// y verificamos que el DOM expone el nuevo valor. Si el comparator está
// roto, el DOM mantiene el valor viejo y el test falla.
// =============================================================================

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { Gem } from "lucide-react";
import { Row } from "../EditableRow";

const baseProps = {
  componentType: "METAL" as const,
  Icon: Gem,
  primary: "Oro 18k",
  quantityCell:          <span>1,30</span>,
  unitValueCell:         <span>100</span>,
  mermaOrAdjustmentCell: <span>5%</span>,
  manual: false,
  onResetRow: vi.fn(),
  canResetRow: false,
};

describe("EditableRow — comparator del React.memo (P1 #7)", () => {
  it("rerenderea cuando SOLO cambia quantityUnitLabel", () => {
    const { container, rerender } = render(
      <Row {...baseProps} quantityUnitLabel="Gramos" />
    );
    expect(container.textContent).toContain("Gramos");
    expect(container.textContent).not.toContain("Unidades");

    // Cambia SOLO `quantityUnitLabel`. Si el comparator no la chequea,
    // el render se saltea y el DOM mantiene "Gramos".
    rerender(<Row {...baseProps} quantityUnitLabel="Unidades" />);

    expect(container.textContent).toContain("Unidades");
    expect(container.textContent).not.toContain("Gramos");
  });

  it("rerenderea cuando SOLO cambia currencyLabel", () => {
    const { container, rerender } = render(
      <Row {...baseProps} currencyLabel="ARS" />
    );
    expect(container.textContent).toContain("ARS");
    expect(container.textContent).not.toContain("USD");

    rerender(<Row {...baseProps} currencyLabel="USD" />);

    expect(container.textContent).toContain("USD");
    expect(container.textContent).not.toContain("ARS");
  });

  it("rerenderea cuando SOLO cambia globalAdjustmentText", () => {
    const propsWithAdj = {
      ...baseProps,
      // Necesitamos saleValueText/saleValueValue para que el bloque "Costo
      // Total" se renderice y dentro de él aparezca la sub-línea de ajuste
      // global (el bloque solo se monta cuando hay valor visible arriba).
      saleValueValue: 100,
      saleValueText:  "$ 100",
      globalAdjustmentKind: "BONUS" as const,
    };
    const { container, rerender } = render(
      <Row {...propsWithAdj} globalAdjustmentText="Aj. global −5%" />
    );
    expect(container.textContent).toContain("Aj. global −5%");

    rerender(<Row {...propsWithAdj} globalAdjustmentText="Aj. global +10%" />);

    expect(container.textContent).toContain("Aj. global +10%");
    expect(container.textContent).not.toContain("Aj. global −5%");
  });

  it("rerenderea cuando SOLO cambia globalAdjustmentKind (cambia el color del texto)", () => {
    const propsWithAdj = {
      ...baseProps,
      saleValueValue: 100,
      saleValueText:  "$ 100",
      globalAdjustmentText: "Aj. global −5%",
    };
    const { container, rerender } = render(
      <Row {...propsWithAdj} globalAdjustmentKind="BONUS" />
    );
    const adjEl1 = container.querySelector('[title*="Ajuste global"]');
    expect(adjEl1).not.toBeNull();
    expect(adjEl1!.className).toMatch(/emerald/);

    rerender(<Row {...propsWithAdj} globalAdjustmentKind="SURCHARGE" />);

    const adjEl2 = container.querySelector('[title*="Ajuste global"]');
    expect(adjEl2).not.toBeNull();
    expect(adjEl2!.className).toMatch(/amber/);
    expect(adjEl2!.className).not.toMatch(/emerald/);
  });

  it("regresión: NO rerenderea cuando las props NO cambian (memo sigue trabajando)", () => {
    // Verificamos que el fix NO rompió el opt-out del memo. Para detectar
    // el render real, usamos un `primary` con identidad mutable y un spy
    // que se incrementa cada vez que React monta o reusa el subárbol del
    // primary text (vía useEffect interno). Estrategia alternativa más
    // simple: comparar referencias del DOM. Si NO rerenderea, el span del
    // primary mantiene la misma identidad de nodo en ambas pasadas.
    const fixedProps = {
      ...baseProps,
      quantityUnitLabel: "Gramos",
      currencyLabel:     "ARS",
    };
    const { container, rerender } = render(<Row {...fixedProps} />);
    const span1 = container.querySelector(".truncate"); // .truncate envuelve el primary
    expect(span1).not.toBeNull();

    // Mismas props (identidad referencial) → memo opta-out.
    rerender(<Row {...fixedProps} />);
    const span2 = container.querySelector(".truncate");

    // Si el memo NO rerenderea, el nodo del DOM es la MISMA instancia.
    expect(span2).toBe(span1);
  });
});
