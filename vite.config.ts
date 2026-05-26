// tptech-frontend/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Submodulo tptech-shared (vive en `../tptech-shared/src`). Permite
      // importar como `@tptech/shared/document-printables/SaleInvoicePrintable`
      // en vez de `../../../../../tptech-shared/src/...`. Mismo alias
      // configurado en tsconfig.app.json (paths) y en tptech-backend.
      "@tptech/shared": fileURLToPath(new URL("../tptech-shared/src", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      },
      "/uploads": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
