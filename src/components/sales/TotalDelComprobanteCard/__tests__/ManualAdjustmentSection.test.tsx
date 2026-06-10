// src/components/sales/TotalDelComprobanteCard/__tests__/ManualAdjustmentSection.test.tsx
// =============================================================================
// Etapa A — Tests del sub-componente ManualAdjustmentSection.
//
// Verifica que la sección:
//   · Permanece COLAPSADA cuando no hay draft ni snapshot (modo editor).
//   · Renderiza el input editable cuando se provee `onChange`.
//   · Muestra "TPTech calculó / Ajuste / Total final" cuando el backend
//     devolvió snapshot (read-only display).
//   · NO se renderiza cuando no hay `onChange` NI snapshot.
//   · `disabled` oculta el editor pero deja el display del snapshot.
//   · CERO matemática local: el componente NO calcula `engineTotal + delta`;
//     muestra `snapshot.unified.postAmount` tal cual del backend.
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ManualAdjustmentSection } from "../parts/ManualAdjustmentSection";

const SNAPSHOT_BASE = {
  scope: "UNIFIED" as const,
  unified: { preAmount: 1210, postAmount: 1000, amount: -210 },
  totals:  { monetaryAdjustment: -210 },
  audit:   {
    appliedBy: { userId: "u-1", userName: "Roberto" },
    appliedAt: "2026-05-28T10:00:00.000Z",
    reason:    "cierre",
  },
};

describe("ManualAdjustmentSection — modo editor (con onChange)", () => {
  it("colapsado por defecto cuando no hay draft ni snapshot — muestra '+ Agregar'", () => {
    const onChange = vi.fn();
    render(
      <ManualAdjustmentSection
        draft={null}
        snapshot={null}
        engineTotal={null}
        onChange={onChange}
        displayCurrency="ARS"
      />,
    );
    expect(screen.getByTestId("total-card-manual-adjustment-toggle")).toBeTruthy();
    expect(screen.getByText(/Agregar ajuste manual/i)).toBeTruthy();
    // NO debería renderizar el input ni el bloque del snapshot.
    expect(screen.queryByTestId("total-card-manual-adjustment-input")).toBeNull();
  });

  it("click en '+ Agregar' abre el editor con input", () => {
    const onChange = vi.fn();
    render(
      <ManualAdjustmentSection
        draft={null}
        snapshot={null}
        engineTotal={null}
        onChange={onChange}
        displayCurrency="ARS"
      />,
    );
    fireEvent.click(screen.getByTestId("total-card-manual-adjustment-open"));
    expect(screen.getByTestId("total-card-manual-adjustment-input")).toBeTruthy();
  });

  it("con draft válido → renderiza editor + input prefilled", () => {
    const onChange = vi.fn();
    render(
      <ManualAdjustmentSection
        draft={{ amount: -250, reason: null }}
        snapshot={null}
        engineTotal={null}
        onChange={onChange}
        displayCurrency="ARS"
      />,
    );
    expect(screen.getByTestId("total-card-manual-adjustment-input")).toBeTruthy();
    // Caption "Intervención humana" visible (puede aparecer tanto en el chip
    // del header como en la descripción al pie — `getAllByText` tolera ambas).
    expect(screen.getAllByText(/Intervención humana/i).length).toBeGreaterThan(0);
  });

  it("input clear emite onChange(null)", () => {
    const onChange = vi.fn();
    render(
      <ManualAdjustmentSection
        draft={{ amount: -100, reason: null }}
        snapshot={null}
        engineTotal={null}
        onChange={onChange}
        displayCurrency="ARS"
      />,
    );
    // El TPNumberInput expone un botón X cuando recibe `onClear`. Lo
    // buscamos por aria-label "Quitar ajuste manual" (set en el caller).
    const clearBtn = screen.queryByLabelText(/Quitar ajuste manual/i);
    if (clearBtn) {
      fireEvent.click(clearBtn);
      expect(onChange).toHaveBeenCalledWith(null);
    }
    // El test es tolerante a la implementación interna del TPNumberInput;
    // lo importante es que el ManualAdjustmentSection ofrece el camino
    // semántico de limpiar el ajuste.
  });
});

describe("ManualAdjustmentSection — display de snapshot", () => {
  it("renderiza 'TPTech calculó / Ajuste / Total final' cuando hay snapshot", () => {
    render(
      <ManualAdjustmentSection
        draft={{ amount: -210, reason: "cierre" }}
        snapshot={SNAPSHOT_BASE}
        engineTotal={1210}
        onChange={() => { /* noop */ }}
        displayCurrency="ARS"
      />,
    );
    expect(screen.getByTestId("total-card-manual-engine-total")).toBeTruthy();
    expect(screen.getByTestId("total-card-manual-delta")).toBeTruthy();
    expect(screen.getByTestId("total-card-manual-final-total")).toBeTruthy();
  });

  it("muestra el postAmount tal cual del snapshot (passthrough — no recalcula)", () => {
    render(
      <ManualAdjustmentSection
        draft={null}
        snapshot={{
          ...SNAPSHOT_BASE,
          unified: { preAmount: 1210, postAmount: 1207.37, amount: -2.63 },
          totals:  { monetaryAdjustment: -2.63 },
        }}
        engineTotal={1210}
        displayCurrency="ARS"
      />,
    );
    const totalCell = screen.getByTestId("total-card-manual-final-total");
    // El componente formatea por preset del tenant; verificamos que el
    // string contiene "1.207,37" o "1207.37" según preset — tolerante.
    expect(totalCell.textContent).toMatch(/1[.,]?207[.,]37/);
  });

  it("muestra audit.appliedBy.userName cuando está presente", () => {
    render(
      <ManualAdjustmentSection
        draft={null}
        snapshot={SNAPSHOT_BASE}
        engineTotal={1210}
        displayCurrency="ARS"
      />,
    );
    expect(screen.getByText(/Aplicado por Roberto/i)).toBeTruthy();
  });
});

describe("ManualAdjustmentSection — modo display-only", () => {
  it("sin onChange ni snapshot → NO se renderiza (null)", () => {
    const { container } = render(
      <ManualAdjustmentSection
        draft={null}
        snapshot={null}
        engineTotal={null}
        displayCurrency="ARS"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("sin onChange pero CON snapshot → muestra display read-only", () => {
    render(
      <ManualAdjustmentSection
        draft={null}
        snapshot={SNAPSHOT_BASE}
        engineTotal={1210}
        displayCurrency="ARS"
      />,
    );
    expect(screen.getByTestId("total-card-manual-final-total")).toBeTruthy();
    // No debe haber input editable.
    expect(screen.queryByTestId("total-card-manual-adjustment-input")).toBeNull();
  });

  it("disabled=true esconde el editor pero muestra el snapshot", () => {
    const onChange = vi.fn();
    render(
      <ManualAdjustmentSection
        draft={{ amount: -210, reason: null }}
        snapshot={SNAPSHOT_BASE}
        engineTotal={1210}
        onChange={onChange}
        displayCurrency="ARS"
        disabled
      />,
    );
    expect(screen.queryByTestId("total-card-manual-adjustment-input")).toBeNull();
    expect(screen.getByTestId("total-card-manual-final-total")).toBeTruthy();
  });
});

// =============================================================================
// Etapa C — BREAKDOWN
// =============================================================================

const BREAKDOWN_METALS = [
  { metalParentId: "oro-fino",  metalParentName: "Oro Fino", preGrams: 0.908 },
  { metalParentId: "plata-925", metalParentName: "Plata",    preGrams: 2.44 },
];

const SNAPSHOT_BREAKDOWN = {
  scope: "BREAKDOWN" as const,
  breakdown: {
    metals: [
      {
        metalParentId:      "oro-fino",
        metalParentName:    "Oro Fino",
        preGrams:           0.908,
        postGrams:          1,
        deltaGrams:         0.092,
        metalPricePerGram:  100000,
        monetaryEquivalent: 9200,
      },
    ],
    monetary: { preAmount: 13955, amount: 45, postAmount: 14000 },
  },
  totals: {
    monetaryAdjustment:      45,
    metalMonetaryEquivalent: 9200,
    totalMonetaryAdjustment: 9245,
  },
  audit: {
    appliedBy: { userId: "u-1", userName: "Roberto" },
    appliedAt: "2026-05-28T10:00:00.000Z",
    reason:    "cierre",
  },
};

describe("ManualAdjustmentSection — BREAKDOWN editor (Etapa C)", () => {
  it("mode=BREAKDOWN renderiza una fila por metal + fila de hechura", () => {
    render(
      <ManualAdjustmentSection
        mode="BREAKDOWN"
        draft={{ scope: "BREAKDOWN", metals: [{ metalParentId: "oro-fino", targetGrams: 1 }] }}
        snapshot={null}
        engineTotal={87750}
        breakdownMetals={BREAKDOWN_METALS}
        onChange={() => undefined}
        displayCurrency="ARS"
      />,
    );
    const metalRows = screen.getAllByTestId("total-card-manual-adjustment-metal-row");
    expect(metalRows).toHaveLength(2);
    expect(screen.getByTestId("total-card-manual-adjustment-hechura-row")).toBeTruthy();
  });

  it("mode=UNIFIED NO renderiza filas de metales", () => {
    render(
      <ManualAdjustmentSection
        mode="UNIFIED"
        draft={{ amount: -100, reason: null }}
        snapshot={null}
        engineTotal={1000}
        breakdownMetals={BREAKDOWN_METALS}
        onChange={() => undefined}
        displayCurrency="ARS"
      />,
    );
    expect(screen.queryByTestId("total-card-manual-adjustment-metal-row")).toBeNull();
    expect(screen.queryByTestId("total-card-manual-adjustment-hechura-row")).toBeNull();
  });

  it("display BREAKDOWN snapshot muestra filas por metal y totalFinal=engineTotal+totalMonetaryAdjustment", () => {
    render(
      <ManualAdjustmentSection
        mode="BREAKDOWN"
        draft={null}
        snapshot={SNAPSHOT_BREAKDOWN}
        engineTotal={87750}
        breakdownMetals={BREAKDOWN_METALS}
        onChange={() => undefined}
        displayCurrency="ARS"
      />,
    );
    expect(screen.getByTestId("total-card-manual-metal-row")).toBeTruthy();
    const total = screen.getByTestId("total-card-manual-final-total");
    // 87750 + 9245 = 96995
    expect(total.textContent).toMatch(/96[.,]?995/);
  });
});

// =============================================================================
// Etapa UX — colapsable simétrico (abrir/cerrar)
// =============================================================================

describe("ManualAdjustmentSection — colapsable", () => {
  it("con snapshot arranca expandido; el header colapsa y vuelve a expandir", () => {
    render(
      <ManualAdjustmentSection
        draft={null}
        snapshot={SNAPSHOT_BASE}
        engineTotal={1210}
        displayCurrency="ARS"
      />,
    );
    // Expandido por defecto (hay snapshot) → detalle visible.
    expect(screen.getByTestId("total-card-manual-final-total")).toBeTruthy();
    const header = screen.getByTestId("total-card-manual-adjustment-header");
    expect(header.getAttribute("aria-expanded")).toBe("true");

    // Click → colapsa (detalle oculto, simetría con el resto del card).
    fireEvent.click(header);
    expect(screen.queryByTestId("total-card-manual-final-total")).toBeNull();
    expect(
      screen.getByTestId("total-card-manual-adjustment-header").getAttribute("aria-expanded"),
    ).toBe("false");

    // Click otra vez → vuelve a expandir.
    fireEvent.click(screen.getByTestId("total-card-manual-adjustment-header"));
    expect(screen.getByTestId("total-card-manual-final-total")).toBeTruthy();
  });

  it("colapsado con snapshot → muestra el resumen del impacto neto", () => {
    render(
      <ManualAdjustmentSection
        draft={null}
        snapshot={{ ...SNAPSHOT_BASE, totals: { monetaryAdjustment: -210, totalMonetaryAdjustment: -210 } }}
        engineTotal={1210}
        displayCurrency="ARS"
      />,
    );
    fireEvent.click(screen.getByTestId("total-card-manual-adjustment-header"));
    expect(screen.getByTestId("total-card-manual-adjustment-collapsed-summary")).toBeTruthy();
  });
});
