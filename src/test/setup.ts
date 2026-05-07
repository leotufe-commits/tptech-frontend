// src/test/setup.ts
// =============================================================================
// FASE 1.0 — Setup global de Vitest.
//
// Registra los matchers de @testing-library/jest-dom (toBeInTheDocument,
// toHaveTextContent, etc.) y limpia el DOM + mocks entre tests para evitar
// contaminación cruzada.
// =============================================================================

import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
