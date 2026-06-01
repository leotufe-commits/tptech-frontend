// src/pages/configuracion-sistema/__tests__/ConfiguracionSistemaPoliticaPrecios.metalDomain.test.tsx
// =============================================================================
// Etapa D4 — Tests del bloque "Dominio del metal" + tabla PHYSICAL + fallback.
//
// Cubre el brief al pie de la letra:
//   1. Render default MONETARY → muestra metales monetarios (capa 15 histórica)
//      y NO muestra la tabla PHYSICAL.
//   2. Cambiar dominio a PHYSICAL → muestra tabla con metales padre + fallback.
//   3. Editar un metal y guardar envía el shape canónico.
//   4. Editar el fallback y guardar.
//   5. Volver de PHYSICAL a MONETARY no destruye la config física guardada
//      (se persiste tal cual en el state y vuelve si el usuario re-selecciona
//      PHYSICAL antes de save).
//   6. Payload final cumple el shape:
//        { byMetalParentId: { id: { mode, direction } }, fallback: { mode, direction } }
// =============================================================================

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockCompany = vi.hoisted(() => ({
  fetchPricingPolicyConfig:     vi.fn(),
  updatePricingPolicyConfig:    vi.fn(),
  fetchDocumentRoundingConfig:  vi.fn(),
  updateDocumentRoundingConfig: vi.fn(),
  fetchMetalParents:            vi.fn(),
}));

vi.mock("../../../services/company", async () => {
  const actual = await vi.importActual<any>("../../../services/company");
  return {
    ...actual,
    fetchPricingPolicyConfig:     mockCompany.fetchPricingPolicyConfig,
    updatePricingPolicyConfig:    mockCompany.updatePricingPolicyConfig,
    fetchDocumentRoundingConfig:  mockCompany.fetchDocumentRoundingConfig,
    updateDocumentRoundingConfig: mockCompany.updateDocumentRoundingConfig,
    fetchMetalParents:            mockCompany.fetchMetalParents,
  };
});

const mockToast = vi.hoisted(() => ({
  success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(),
}));
vi.mock("../../../lib/toast", () => ({ toast: mockToast }));

import ConfiguracionSistemaPoliticaPrecios from "../ConfiguracionSistemaPoliticaPrecios";

const POLICY_BASE = {
  pricingLowMarginWarningPercent:  15,
  pricingLowMarginBlockPercent:    null,
  pricingBlockLossSale:            false,
  pricingBlockZeroOrNegativePrice: false,
  pricingBlockPartialData:         false,
};

const ROUNDING_BREAKDOWN_MONETARY_BASE = {
  documentRoundingEnabled:          true,
  documentRoundingScope:            "BREAKDOWN" as const,
  documentRoundingMode:             "NONE"      as const,
  documentRoundingDirection:        "NEAREST"   as const,
  documentRoundingModeMetal:        "INTEGER"   as const,
  documentRoundingDirectionMetal:   "NEAREST"   as const,
  documentRoundingModeHechura:      "INTEGER"   as const,
  documentRoundingDirectionHechura: "NEAREST"   as const,
  documentRoundingMetalDomain:      "MONETARY"  as const,
  documentPhysicalRoundingConfig:   null,
};

const METALS = [
  { id: "oro-fino",  name: "Oro Fino" },
  { id: "plata-925", name: "Plata"    },
];

async function setup(roundingOverrides: any = {}) {
  mockCompany.fetchPricingPolicyConfig.mockResolvedValue(POLICY_BASE);
  mockCompany.fetchDocumentRoundingConfig.mockResolvedValue({
    ...ROUNDING_BREAKDOWN_MONETARY_BASE, ...roundingOverrides,
  });
  mockCompany.fetchMetalParents.mockResolvedValue(METALS);
  mockCompany.updatePricingPolicyConfig.mockImplementation(async (p: any) => p);
  mockCompany.updateDocumentRoundingConfig.mockImplementation(async (p: any) => p);

  render(<ConfiguracionSistemaPoliticaPrecios />);
  await waitFor(() => expect(mockCompany.fetchDocumentRoundingConfig).toHaveBeenCalled());
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────────────────────────────────
// 1 — Render default MONETARY
// ──────────────────────────────────────────────────────────────────────────

describe("Etapa D4 — render default MONETARY", () => {
  it("muestra layout monetario tradicional y NO muestra tabla PHYSICAL", async () => {
    await setup();
    // Bloque metales visible (BREAKDOWN scope).
    expect(screen.getByTestId("rounding-metales-block")).toBeTruthy();
    // Sub-bloque MONETARY visible.
    expect(screen.getByTestId("rounding-metales-monetary")).toBeTruthy();
    // Sub-bloque PHYSICAL ausente.
    expect(screen.queryByTestId("rounding-metales-physical")).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 2 — Cambiar a PHYSICAL muestra tabla
// ──────────────────────────────────────────────────────────────────────────

describe("Etapa D4 — cambiar dominio a PHYSICAL muestra la tabla", () => {
  it("toggle Dominio → PHYSICAL hace aparecer tabla y fallback", async () => {
    await setup();

    // Encontrar el TPSelect del dominio. El componente renderiza un <select>
    // nativo (o portal). Lo localizamos por su label.
    const domainSelect = screen.getByTestId("rounding-metal-domain-select") as HTMLSelectElement;
    fireEvent.change(domainSelect, { target: { value: "PHYSICAL" } });

    await waitFor(() => {
      expect(screen.getByTestId("rounding-metales-physical")).toBeTruthy();
    });
    // El bloque MONETARY desaparece.
    expect(screen.queryByTestId("rounding-metales-monetary")).toBeNull();
    // Las filas de los metales aparecen.
    expect(screen.getByTestId("rounding-metal-row-oro-fino")).toBeTruthy();
    expect(screen.getByTestId("rounding-metal-row-plata-925")).toBeTruthy();
    // Bloque fallback visible.
    expect(screen.getByTestId("rounding-metales-physical-fallback")).toBeTruthy();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 3 — Editar un metal + guardar
// ──────────────────────────────────────────────────────────────────────────

describe("Etapa D4 — guardar config válida", () => {
  it("editar Oro → INTEGER NEAREST y guardar envía shape canónico", async () => {
    await setup({
      documentRoundingMetalDomain: "PHYSICAL",
      documentPhysicalRoundingConfig: { byMetalParentId: {}, fallback: { mode: "NONE", direction: "NEAREST" } },
    });

    // Editar Mode del Oro.
    const row = screen.getByTestId("rounding-metal-row-oro-fino");
    const modeSelect = row.querySelector("select[role], select") as HTMLSelectElement;
    // El primer select de la fila es Modo.
    const selects = row.querySelectorAll("select");
    fireEvent.change(selects[0]!, { target: { value: "INTEGER" } });
    fireEvent.change(selects[1]!, { target: { value: "NEAREST" } });

    // Guardar.
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockCompany.updateDocumentRoundingConfig).toHaveBeenCalled());
    const sent = mockCompany.updateDocumentRoundingConfig.mock.calls[0]![0];
    expect(sent.documentRoundingMetalDomain).toBe("PHYSICAL");
    expect(sent.documentPhysicalRoundingConfig).toEqual({
      byMetalParentId: {
        "oro-fino": { mode: "INTEGER", direction: "NEAREST" },
      },
      fallback: { mode: "NONE", direction: "NEAREST" },
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 4 — Editar fallback
// ──────────────────────────────────────────────────────────────────────────

describe("Etapa D4 — fallback se guarda", () => {
  it("cambiar fallback a HALF UP y guardar envía el shape correcto", async () => {
    await setup({
      documentRoundingMetalDomain: "PHYSICAL",
      documentPhysicalRoundingConfig: { byMetalParentId: {}, fallback: { mode: "NONE", direction: "NEAREST" } },
    });

    const fallbackBlock = screen.getByTestId("rounding-metales-physical-fallback");
    const selects = fallbackBlock.querySelectorAll("select");
    fireEvent.change(selects[0]!, { target: { value: "HALF" } });
    fireEvent.change(selects[1]!, { target: { value: "UP" } });

    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockCompany.updateDocumentRoundingConfig).toHaveBeenCalled());
    const sent = mockCompany.updateDocumentRoundingConfig.mock.calls[0]![0];
    expect(sent.documentPhysicalRoundingConfig.fallback).toEqual({
      mode: "HALF", direction: "UP",
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 5 — Volver a MONETARY preserva config física en el state
// ──────────────────────────────────────────────────────────────────────────

describe("Etapa D4 — volver a MONETARY no destruye la config física", () => {
  it("toggle PHYSICAL → MONETARY → PHYSICAL preserva el estado intermedio", async () => {
    await setup({
      documentRoundingMetalDomain: "PHYSICAL",
      documentPhysicalRoundingConfig: {
        byMetalParentId: { "oro-fino": { mode: "INTEGER", direction: "NEAREST" } },
        fallback: { mode: "HALF", direction: "DOWN" },
      },
    });

    // Tabla y oro visible con el valor cargado.
    const row = screen.getByTestId("rounding-metal-row-oro-fino");
    const orig = row.querySelectorAll("select");
    expect((orig[0]! as HTMLSelectElement).value).toBe("INTEGER");

    // Cambiar a MONETARY.
    const domainSelect = screen.getByTestId("rounding-metal-domain-select") as HTMLSelectElement;
    fireEvent.change(domainSelect, { target: { value: "MONETARY" } });

    // Tabla desaparece.
    expect(screen.queryByTestId("rounding-metales-physical")).toBeNull();

    // Volver a PHYSICAL.
    fireEvent.change(domainSelect, { target: { value: "PHYSICAL" } });

    await waitFor(() => {
      // Tabla reaparece con el mismo valor que tenía antes.
      const row2 = screen.getByTestId("rounding-metal-row-oro-fino");
      const selects2 = row2.querySelectorAll("select");
      expect((selects2[0]! as HTMLSelectElement).value).toBe("INTEGER");
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 6 — Payload final shape
// ──────────────────────────────────────────────────────────────────────────

describe("Etapa D4 — payload final cumple el shape canónico", () => {
  it("el patch enviado tiene exactamente { byMetalParentId, fallback }", async () => {
    await setup({
      documentRoundingMetalDomain: "PHYSICAL",
      documentPhysicalRoundingConfig: {
        byMetalParentId: {
          "oro-fino":  { mode: "INTEGER", direction: "NEAREST" },
          "plata-925": { mode: "HALF",    direction: "DOWN" },
        },
        fallback: { mode: "NONE", direction: "NEAREST" },
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => expect(mockCompany.updateDocumentRoundingConfig).toHaveBeenCalled());
    const sent = mockCompany.updateDocumentRoundingConfig.mock.calls[0]![0];
    expect(sent.documentRoundingMetalDomain).toBe("PHYSICAL");
    expect(sent.documentPhysicalRoundingConfig).toEqual({
      byMetalParentId: {
        "oro-fino":  { mode: "INTEGER", direction: "NEAREST" },
        "plata-925": { mode: "HALF",    direction: "DOWN" },
      },
      fallback: { mode: "NONE", direction: "NEAREST" },
    });
  });
});
