// src/components/sales/__tests__/no-pricing-validation-in-prod.guard.test.ts
// =============================================================================
// Guard estático — el panel `SalePricingPanel` (sección "Validación pricing
// (motor)") NO debe renderearse desde `VentasFacturas.tsx`. Es un panel de
// debugging técnico que agregaba ruido visual al operador normal y ya no
// vive en la UI de Factura (ni siquiera bajo `import.meta.env.DEV`).
//
// El componente `SalePricingPanel` y todos sus tests siguen intactos para
// debugging puntual / uso interno futuro. Lo que este guard fija es que
// `VentasFacturas.tsx` no lo monta más en el árbol del modal.
//
// Anti-regresión: si alguien vuelve a importar o renderizar el panel en
// VentasFacturas, este guard falla.
// =============================================================================
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const VENTAS_FACTURAS = join(process.cwd(), "src/pages/VentasFacturas.tsx");

describe("VentasFacturas — Validación pricing motor REMOVIDO del render", () => {
  it("el archivo VentasFacturas.tsx existe", () => {
    expect(existsSync(VENTAS_FACTURAS)).toBe(true);
  });

  it("NO renderea `<SalePricingPanel>` en ningún lugar", () => {
    const src = readFileSync(VENTAS_FACTURAS, "utf8");
    const matches = src.match(/<SalePricingPanel\b/g) ?? [];
    expect(matches.length).toBe(0);
  });

  it("NO importa `SalePricingPanel` (import muerto)", () => {
    const src = readFileSync(VENTAS_FACTURAS, "utf8");
    expect(/from\s+["'][^"']*SalePricingPanel["']/.test(src)).toBe(false);
  });

  it("NO contiene la etiqueta UI `Validación pricing` en el render", () => {
    const src = readFileSync(VENTAS_FACTURAS, "utf8");
    // Solo nos importan strings dentro de JSX (no comentarios). Eliminamos
    // bloques /* … */ y // … antes de chequear.
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(stripped.includes("Validación pricing")).toBe(false);
  });
});
