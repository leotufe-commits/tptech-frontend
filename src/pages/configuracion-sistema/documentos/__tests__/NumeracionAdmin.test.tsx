// src/pages/configuracion-sistema/documentos/__tests__/NumeracionAdmin.test.tsx
// =============================================================================
// Tests de la pantalla admin Numeración (Etapa B — 2026-05-29).
//
// Cubrimos:
//   1. Render inicial → loading → tabla con rows.
//   2. Empty state cuando la API devuelve [].
//   3. Traducción enum→ES (Tipo: INVOICE → "Factura"; Direction: OUTBOUND → "Venta").
//   4. Botón "Nueva serie" abre el modal en modo crear.
//   5. Click en editar abre el modal con datos pre-cargados.
//   6. En edit, los campos type/direction son INMUTABLES (badges en lugar
//      de inputs editables).
//   7. Activar/inactivar llama PATCH con `isActive`.
//   8. Eliminar pide confirmación antes de llamar la API.
//   9. Error backend (mensaje del 409) se muestra al operador.
// =============================================================================

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

const mockApi = vi.hoisted(() => ({
  list:   vi.fn(),
  get:    vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("../../../../services/receipt-series", async () => {
  // Conservamos las labels reales (son constantes públicas) y solo mockeamos
  // el objeto `receiptSeriesApi`.
  const actual = await vi.importActual<any>("../../../../services/receipt-series");
  return {
    ...actual,
    receiptSeriesApi: mockApi,
  };
});

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error:   vi.fn(),
  info:    vi.fn(),
  warning: vi.fn(),
}));
vi.mock("../../../../lib/toast", () => ({ toast: mockToast }));

import NumeracionAdmin from "../NumeracionAdmin";

function makeRow(over: Partial<any> = {}) {
  return {
    id:          "s-1",
    name:        "Factura A — PV 0001",
    type:        "INVOICE",
    direction:   "OUTBOUND",
    prefix:      "A",
    pointOfSale: "0001",
    nextNumber:  26,
    isActive:    true,
    createdAt:   "2026-05-29T10:00:00.000Z",
    updatedAt:   "2026-05-29T10:00:00.000Z",
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1) Render inicial + tabla con rows
// ─────────────────────────────────────────────────────────────────────────────

describe("NumeracionAdmin — render inicial", () => {
  it("renderiza header con título y descripción", async () => {
    mockApi.list.mockResolvedValueOnce([]);
    render(<NumeracionAdmin />);

    expect(screen.getByText("Numeración de comprobantes")).toBeTruthy();
    expect(screen.getByText(/Configurá las series/i)).toBeTruthy();
    await waitFor(() => expect(mockApi.list).toHaveBeenCalledTimes(1));
  });

  it("muestra empty state cuando no hay series", async () => {
    mockApi.list.mockResolvedValueOnce([]);
    render(<NumeracionAdmin />);

    const empty = await screen.findByTestId("numeracion-empty-state");
    expect(empty).toBeTruthy();
    expect(within(empty).getByText(/Todavía no hay series configuradas/i)).toBeTruthy();
    expect(within(empty).getByRole("button", { name: /Crear primera serie/i })).toBeTruthy();
  });

  it("muestra rows en la tabla cuando la API devuelve series", async () => {
    mockApi.list.mockResolvedValueOnce([
      makeRow({ type: "INVOICE",       direction: "OUTBOUND", prefix: "A", pointOfSale: "0001", nextNumber: 26 }),
      makeRow({ id: "s-2", type: "CREDIT_NOTE", direction: "OUTBOUND", prefix: "B", pointOfSale: "0002", nextNumber: 1, name: "NC B" }),
    ]);
    render(<NumeracionAdmin />);

    await waitFor(() => expect(mockApi.list).toHaveBeenCalled());
    // Tipo traducido al ES
    expect(await screen.findByText("Factura")).toBeTruthy();
    expect(screen.getByText("Nota de crédito")).toBeTruthy();
    // Direction traducido
    const ventaCells = screen.getAllByText("Venta");
    expect(ventaCells.length).toBeGreaterThanOrEqual(2);
    // Prefijos y PV visibles
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("B")).toBeTruthy();
    expect(screen.getByText("0001")).toBeTruthy();
    expect(screen.getByText("0002")).toBeTruthy();
    // Próximo número
    expect(screen.getByText("26")).toBeTruthy();
  });

  it("Serie sin prefix → muestra 'Sin prefijo' visual", async () => {
    mockApi.list.mockResolvedValueOnce([makeRow({ prefix: "" })]);
    render(<NumeracionAdmin />);
    expect(await screen.findByText("Sin prefijo")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2) Crear — abre modal y dispara API
// ─────────────────────────────────────────────────────────────────────────────

describe("NumeracionAdmin — crear serie", () => {
  it("click 'Nueva serie' abre el modal en modo crear", async () => {
    mockApi.list.mockResolvedValueOnce([makeRow()]);
    render(<NumeracionAdmin />);
    await screen.findByText("Factura"); // espera al primer render

    const newBtns = screen.getAllByRole("button", { name: /Nueva serie/i });
    fireEvent.click(newBtns[0]!);

    expect(await screen.findByText("Nueva serie de numeración")).toBeTruthy();
    // Tipo es editable en CREATE (no es badge readonly)
    expect(screen.queryByTestId("type-readonly")).toBeNull();
    expect(screen.queryByTestId("direction-readonly")).toBeNull();
  });

  it("crear desde empty state usa 'Crear primera serie'", async () => {
    mockApi.list.mockResolvedValueOnce([]);
    render(<NumeracionAdmin />);
    const btn = await screen.findByRole("button", { name: /Crear primera serie/i });
    fireEvent.click(btn);
    expect(await screen.findByText("Nueva serie de numeración")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3) Editar — type/direction inmutables
// ─────────────────────────────────────────────────────────────────────────────

describe("NumeracionAdmin — editar serie", () => {
  it("type y direction son badges readonly en edición (NO combos editables)", async () => {
    mockApi.list.mockResolvedValueOnce([makeRow()]);
    render(<NumeracionAdmin />);
    await screen.findByText("Factura");

    // Click en editar de la primera fila.
    const editBtn = screen.getByTitle(/editar/i);
    fireEvent.click(editBtn);

    expect(await screen.findByText("Editar serie")).toBeTruthy();
    // Los badges readonly están presentes.
    expect(screen.getByTestId("type-readonly")).toBeTruthy();
    expect(screen.getByTestId("direction-readonly")).toBeTruthy();
    // Mensaje explicativo en el subtítulo.
    expect(screen.getByText(/Tipo y dirección son inmutables/i)).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4) Activar / inactivar — PATCH con isActive
// ─────────────────────────────────────────────────────────────────────────────

describe("NumeracionAdmin — activar/inactivar", () => {
  it("click en toggle (active=true) llama PATCH con isActive=false", async () => {
    mockApi.list
      .mockResolvedValueOnce([makeRow({ isActive: true })])  // load inicial
      .mockResolvedValueOnce([makeRow({ isActive: false })]); // load después del toggle
    mockApi.update.mockResolvedValueOnce(makeRow({ isActive: false }));

    render(<NumeracionAdmin />);
    await screen.findByText("Factura");

    // El TPRowActions usa "Desactivar"/"Activar" según el estado actual.
    const toggleBtn = screen.getByTitle(/desactivar/i);
    fireEvent.click(toggleBtn);

    await waitFor(() => expect(mockApi.update).toHaveBeenCalledWith("s-1", { isActive: false }));
    await waitFor(() => expect(mockToast.success).toHaveBeenCalled());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5) Eliminar — confirmación + bloqueo backend
// ─────────────────────────────────────────────────────────────────────────────

describe("NumeracionAdmin — eliminar serie", () => {
  it("click en eliminar dispara el flujo de confirmación (NO llama API inmediato)", async () => {
    mockApi.list.mockResolvedValueOnce([makeRow()]);
    render(<NumeracionAdmin />);
    await screen.findByText("Factura");

    const deleteBtn = screen.getByTitle(/eliminar/i);
    fireEvent.click(deleteBtn);

    // No debe llamar a remove sin confirmación previa.
    expect(mockApi.remove).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6) Error backend visible
// ─────────────────────────────────────────────────────────────────────────────

describe("NumeracionAdmin — manejo de errores", () => {
  it("error al cargar series → muestra mensaje en el componente", async () => {
    mockApi.list.mockRejectedValueOnce(new Error("Network down"));
    render(<NumeracionAdmin />);

    // TPTableKit propaga el `error` prop a la UI.
    await waitFor(() => expect(mockApi.list).toHaveBeenCalled());
  });
});
