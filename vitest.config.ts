// vitest.config.ts
// =============================================================================
// FASE 1.0 — Infraestructura de testing.
//
// Setup minimalista. NO incluye tests todavía (eso viene en PR1).
//
// - environment: jsdom para que tests de componentes futuros tengan window/document
// - setupFiles: registra matchers de @testing-library/jest-dom y limpia mocks
// - coverage: v8 (rápido, builtin de Node), output HTML + text-summary en ./coverage
// - globals: false — preferimos `import { describe, it, expect } from "vitest"` explícito
// =============================================================================

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment:  "jsdom",
    setupFiles:   ["./src/test/setup.ts"],
    globals:      false,
    css:          false,
    include:      ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude:      ["node_modules", "dist", "dist-node"],
    coverage: {
      provider:  "v8",
      reporter:  ["text-summary", "html"],
      reportsDirectory: "./coverage",
      include:   ["src/**/*.{ts,tsx}"],
      exclude:   [
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/test/**",
        "src/main.tsx",
        "src/vite-env.d.ts",
      ],
    },
  },
});
