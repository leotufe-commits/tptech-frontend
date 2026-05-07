// src/test/msw-server.ts
// =============================================================================
// FASE 1.0 — PR5. MSW server para tests de integración / E2E.
//
// Setup compartido por todos los tests que necesiten interceptar fetch a
// `/api/...`. Cada test puede sumar handlers locales con `server.use(...)`.
//
// Lifecycle (registrado en src/test/setup.ts):
//   beforeAll: start
//   afterEach: resetHandlers (limpia handlers locales del test)
//   afterAll:  close
// =============================================================================

import { setupServer } from "msw/node";

// Arrancamos sin handlers default — cada test declara los suyos.
// Para handlers compartidos en el futuro, importar de "./msw-handlers".
export const server = setupServer();
