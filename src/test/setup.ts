// src/test/setup.ts
// =============================================================================
// FASE 1.0 — Setup global de Vitest.
//
// - Registra los matchers de @testing-library/jest-dom.
// - Limpia el DOM entre tests (cleanup de testing-library/react).
// - Levanta el server de MSW para interceptar fetch a /api/* en tests
//   que lo necesiten. Tests que NO usen MSW no se ven afectados.
// =============================================================================

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, afterAll } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./msw-server";

// MSW lifecycle. `onUnhandledRequest: "bypass"` permite que tests sin
// handlers MSW funcionen normalmente (no pasan por la red porque jsdom
// rechaza, pero MSW no aborta).
beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
