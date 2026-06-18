// src/pages/configuracion-sistema/__tests__/ConfiguracionSistemaPoliticaPrecios.metalDomain.test.tsx
// =============================================================================
// Redondeo financiero — metal SIEMPRE por gramos (PHYSICAL).
//
// El selector "Dominio del metal" se eliminó de la UI (simplificación
// 2026-06-17): el dominio queda fijo en PHYSICAL y los valores legacy MONETARY
// se coercionan a PHYSICAL al cargar. Estos tests cubren:
//   1. La tabla PHYSICAL (metales padre + "Otros metales") está SIEMPRE visible;
//      no hay selector de dominio ni bloque MONETARY — incluso si el backend
//      devolvió MONETARY (se coerciona a PHYSICAL).
//   2. Editar un metal y guardar envía el shape canónico con domain PHYSICAL.
//   3. Editar el fallback ("Otros metales") y guardar.
//   4. Payload final cumple { byMetalParentId, fallback } + domain PHYSICAL.
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

// Base "legacy": el backend devuelve MONETARY → la UI debe coercionar a PHYSICAL.
const ROUNDING_BREAKDOWN_BASE = {
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
    ...ROUNDING_BREAKDOWN_BASE, ...roundingOverrides,
  });
  mockCompany.fetchMetalParents.mockResolvedValue(METALS);
  mockCompany.updatePricingPolicyConfig.mockImplementation(async (p: any) => p);
  mockCompany.updateDocumentRoundingConfig.mockImplementation(async (p: any) => p);

  render(<ConfiguracionSistemaPoliticaPrecios />);
  await waitFor(() => expect(mockCompany.fetchDocumentRoundingConfig).toHaveBeenCalled());
  // Esperar a que termine la HIDRATACIÓN (no solo el fetch) antes de
  // interactuar. El autoguardado se saltea la primera corrida post-carga; si el
  // test edita antes de que `loading` pase a false, ese primer cambio no
  // dispararía el save y el waitFor del payload quedaría colgado (flaky).
  await waitFor(() => expect(screen.queryByTestId("rounding-metales-block")).not.toBeNull());
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────────────────────────────────
// 1 — Metal SIEMPRE por gramos (PHYSICAL), sin selector ni bloque MONETARY
// ──────────────────────────────────────────────────────────────────────────

describe("Metal por gramos — sin selector de dominio", () => {
  it("aun con backend MONETARY: tabla PHYSICAL visible, sin selector ni MONETARY", async () => {
    await setup(); // base devuelve MONETARY → debe coercionar a PHYSICAL.

    // Bloque metales visible (scope BREAKDOWN → coercionado a BOTH).
    expect(screen.getByTestId("rounding-metales-block")).toBeTruthy();
    // Tabla PHYSICAL siempre presente.
    expect(screen.getByTestId("rounding-metales-physical")).toBeTruthy();
    expect(screen.getByTestId("rounding-metal-row-oro-fino")).toBeTruthy();
    expect(screen.getByTestId("rounding-metal-row-plata-925")).toBeTruthy();
    expect(screen.getByTestId("rounding-metales-physical-fallback")).toBeTruthy();
    // El selector de dominio y el bloque MONETARY ya NO existen.
    expect(screen.queryByTestId("rounding-metal-domain-select")).toBeNull();
    expect(screen.queryByTestId("rounding-metales-monetary")).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 2 — Editar un metal + guardar
// ──────────────────────────────────────────────────────────────────────────

describe("Editar metal + guardar envía shape canónico (PHYSICAL)", () => {
  it("Oro → INTEGER NEAREST y guardar", async () => {
    await setup({
      documentRoundingMetalDomain: "PHYSICAL",
      documentPhysicalRoundingConfig: { byMetalParentId: {}, fallback: { mode: "NONE", direction: "NEAREST" } },
    });

    const row = screen.getByTestId("rounding-metal-row-oro-fino");
    const selects = row.querySelectorAll("select");
    fireEvent.change(selects[0]!, { target: { value: "INTEGER" } });
    fireEvent.change(selects[1]!, { target: { value: "NEAREST" } });

    // Autoguardado (sin botón).
    await waitFor(() => expect(mockCompany.updateDocumentRoundingConfig).toHaveBeenCalled(), { timeout: 3000 });
    const sent = mockCompany.updateDocumentRoundingConfig.mock.calls.at(-1)![0];
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
// 3 — Editar fallback ("Otros metales")
// ──────────────────────────────────────────────────────────────────────────

describe("Fallback se guarda", () => {
  it("cambiar fallback a HALF UP y guardar", async () => {
    await setup({
      documentRoundingMetalDomain: "PHYSICAL",
      documentPhysicalRoundingConfig: { byMetalParentId: {}, fallback: { mode: "NONE", direction: "NEAREST" } },
    });

    const fallbackBlock = screen.getByTestId("rounding-metales-physical-fallback");
    const selects = fallbackBlock.querySelectorAll("select");
    fireEvent.change(selects[0]!, { target: { value: "HALF" } });
    fireEvent.change(selects[1]!, { target: { value: "UP" } });

    // Autoguardado (sin botón).
    await waitFor(() => expect(mockCompany.updateDocumentRoundingConfig).toHaveBeenCalled(), { timeout: 3000 });
    const sent = mockCompany.updateDocumentRoundingConfig.mock.calls.at(-1)![0];
    expect(sent.documentPhysicalRoundingConfig.fallback).toEqual({
      mode: "HALF", direction: "UP",
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 4 — Payload final shape
// ──────────────────────────────────────────────────────────────────────────

describe("Payload final cumple el shape canónico", () => {
  it("editar un metal conserva el resto y manda { byMetalParentId, fallback } + PHYSICAL", async () => {
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

    // Editar el modo de Plata (HALF → INTEGER) dispara el autoguardado; el
    // resto de la config (Oro + fallback) debe preservarse en el patch.
    const row = screen.getByTestId("rounding-metal-row-plata-925");
    const selects = row.querySelectorAll("select");
    fireEvent.change(selects[0]!, { target: { value: "INTEGER" } });

    await waitFor(() => expect(mockCompany.updateDocumentRoundingConfig).toHaveBeenCalled(), { timeout: 3000 });
    const sent = mockCompany.updateDocumentRoundingConfig.mock.calls.at(-1)![0];
    expect(sent.documentRoundingMetalDomain).toBe("PHYSICAL");
    expect(sent.documentPhysicalRoundingConfig).toEqual({
      byMetalParentId: {
        "oro-fino":  { mode: "INTEGER", direction: "NEAREST" },
        "plata-925": { mode: "INTEGER", direction: "DOWN" },
      },
      fallback: { mode: "NONE", direction: "NEAREST" },
    });
  });
});
