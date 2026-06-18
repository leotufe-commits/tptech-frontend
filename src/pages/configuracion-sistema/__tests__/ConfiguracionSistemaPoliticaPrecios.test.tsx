// src/pages/configuracion-sistema/__tests__/ConfiguracionSistemaPoliticaPrecios.test.tsx
// =============================================================================
// Verifica el flujo "activar toggles de riesgo y guardar" punta a punta a
// nivel UI:
//   1) Carga inicial pinta los valores recibidos del backend (toggles OFF).
//   2) Click en los 3 checkboxes los marca true en el estado local.
//   3) Click "Guardar configuración" envía los 3 toggles en true al service.
//   4) Tras el save exitoso se dispara el evento global
//      `tptech:pricing-policy-changed` para que otras pantallas abiertas
//      (Factura) invaliden la caché del preview.
// =============================================================================

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockCompany = vi.hoisted(() => ({
  fetchPricingPolicyConfig:        vi.fn(),
  updatePricingPolicyConfig:       vi.fn(),
  fetchDocumentRoundingConfig:     vi.fn(),
  updateDocumentRoundingConfig:    vi.fn(),
}));

vi.mock("../../../services/company", async () => {
  const actual = await vi.importActual<any>("../../../services/company");
  return {
    ...actual,
    fetchPricingPolicyConfig:     mockCompany.fetchPricingPolicyConfig,
    updatePricingPolicyConfig:    mockCompany.updatePricingPolicyConfig,
    fetchDocumentRoundingConfig:  mockCompany.fetchDocumentRoundingConfig,
    updateDocumentRoundingConfig: mockCompany.updateDocumentRoundingConfig,
  };
});

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error:   vi.fn(),
  info:    vi.fn(),
  warning: vi.fn(),
}));
vi.mock("../../../lib/toast", () => ({ toast: mockToast }));

import ConfiguracionSistemaPoliticaPrecios from "../ConfiguracionSistemaPoliticaPrecios";

const INITIAL_POLICY = {
  pricingLowMarginWarningPercent:  15,
  pricingLowMarginBlockPercent:    null,
  pricingBlockLossSale:            false,
  pricingBlockZeroOrNegativePrice: false,
  pricingBlockPartialData:         false,
};

const INITIAL_ROUNDING = {
  documentRoundingEnabled:   false,
  documentRoundingMode:      "NONE" as const,
  documentRoundingDirection: "NEAREST" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCompany.fetchPricingPolicyConfig.mockResolvedValue({ ...INITIAL_POLICY });
  mockCompany.fetchDocumentRoundingConfig.mockResolvedValue({ ...INITIAL_ROUNDING });
  // El update por convención devuelve el config persistido. Lo devolvemos
  // tal como llegó (lo que serviría como echo del backend).
  mockCompany.updatePricingPolicyConfig.mockImplementation(async (patch) => ({
    ...INITIAL_POLICY,
    ...patch,
  }));
  mockCompany.updateDocumentRoundingConfig.mockImplementation(async (patch) => ({
    ...INITIAL_ROUNDING,
    ...patch,
  }));
});

describe("ConfiguracionSistemaPoliticaPrecios — Riesgos comerciales", () => {
  it("activar los 3 toggles y guardar envía true al service y emite el evento global", async () => {
    // Listener para verificar el broadcast post-save.
    const eventListener = vi.fn();
    window.addEventListener("tptech:pricing-policy-changed", eventListener);

    try {
      render(<ConfiguracionSistemaPoliticaPrecios />);

      // Espera a que termine el loading inicial.
      await waitFor(() => {
        expect(screen.queryByText(/cargando/i)).toBeNull();
      });

      // El form tiene 4 checkboxes en orden visual:
      //   [0] Considerar crítica la venta con pérdida       → pricingBlockLossSale
      //   [1] Considerar crítico el precio cero o negativo  → pricingBlockZeroOrNegativePrice
      //   [2] Considerar crítico el cálculo parcial         → pricingBlockPartialData
      //   [3] Activar redondeo del comprobante              → documentRoundingEnabled
      // Buscamos por role para evitar acoplar al class names internos.
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes.length).toBeGreaterThanOrEqual(4);

      // Sanity: arrancan apagados (matchea el initial mock).
      expect((checkboxes[0] as HTMLInputElement).checked).toBe(false);
      expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);
      expect((checkboxes[2] as HTMLInputElement).checked).toBe(false);

      // Activar los 3 toggles de riesgo (no tocamos el de redondeo).
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);
      fireEvent.click(checkboxes[2]);

      // Confirmar que el estado local se reflejó.
      expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
      expect((checkboxes[1] as HTMLInputElement).checked).toBe(true);
      expect((checkboxes[2] as HTMLInputElement).checked).toBe(true);

      // Autoguardado (debounce) — ya no hay botón. El service recibe los 3
      // toggles en true.
      await waitFor(() => {
        expect(mockCompany.updatePricingPolicyConfig).toHaveBeenCalled();
      }, { timeout: 3000 });
      const arg = mockCompany.updatePricingPolicyConfig.mock.calls.at(-1)![0];
      expect(arg.pricingBlockLossSale).toBe(true);
      expect(arg.pricingBlockZeroOrNegativePrice).toBe(true);
      expect(arg.pricingBlockPartialData).toBe(true);
      // La UI neutraliza el umbral crítico legacy en cada save.
      expect(arg.pricingLowMarginBlockPercent).toBeNull();

      // El evento global se emite tras el save exitoso — gatilla el re-preview
      // en Factura de ventas para invalidar la caché stale.
      await waitFor(() => {
        expect(eventListener).toHaveBeenCalled();
      }, { timeout: 3000 });
    } finally {
      window.removeEventListener("tptech:pricing-policy-changed", eventListener);
    }
  });

  it("no emite el evento global si el save falla", async () => {
    mockCompany.updatePricingPolicyConfig.mockRejectedValueOnce(new Error("boom"));

    const eventListener = vi.fn();
    window.addEventListener("tptech:pricing-policy-changed", eventListener);

    try {
      render(<ConfiguracionSistemaPoliticaPrecios />);
      await waitFor(() => {
        expect(screen.queryByText(/cargando/i)).toBeNull();
      });

      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[0]);

      // El autoguardado dispara y falla → toast de error, sin evento global.
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      }, { timeout: 3000 });

      expect(eventListener).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("tptech:pricing-policy-changed", eventListener);
    }
  });
});
