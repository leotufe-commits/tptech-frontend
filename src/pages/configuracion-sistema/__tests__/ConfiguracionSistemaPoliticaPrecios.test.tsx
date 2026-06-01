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

      // Click "Guardar configuración".
      fireEvent.click(screen.getByRole("button", { name: /guardar configuración/i }));

      // Verificar que el service recibió los 3 toggles en true.
      await waitFor(() => {
        expect(mockCompany.updatePricingPolicyConfig).toHaveBeenCalledTimes(1);
      });
      const arg = mockCompany.updatePricingPolicyConfig.mock.calls[0][0];
      expect(arg.pricingBlockLossSale).toBe(true);
      expect(arg.pricingBlockZeroOrNegativePrice).toBe(true);
      expect(arg.pricingBlockPartialData).toBe(true);
      // La UI simplificada neutraliza el umbral crítico legacy en cada
      // save — el operador ya no lo puede editar y mantener un valor
      // viejo escalaría a CRITICAL por margen bajo de forma invisible.
      expect(arg.pricingLowMarginBlockPercent).toBeNull();

      // El evento global se emite tras el save exitoso — esto es lo que
      // gatilla el re-preview en Factura de ventas para que la caché stale
      // no sirva datos con `policy.blockingAlerts` viejos.
      await waitFor(() => {
        expect(eventListener).toHaveBeenCalledTimes(1);
      });
      expect(mockToast.success).toHaveBeenCalledWith("Configuración guardada.");
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
      fireEvent.click(screen.getByRole("button", { name: /guardar configuración/i }));

      // Espera a que el save resuelva (rechaza) — el botón vuelve a estar habilitado.
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      });

      expect(eventListener).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("tptech:pricing-policy-changed", eventListener);
    }
  });
});
