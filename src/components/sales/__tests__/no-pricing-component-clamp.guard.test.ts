// src/components/sales/__tests__/no-pricing-component-clamp.guard.test.ts
// =============================================================================
// Guard estático — el frontend NO debe clampear a cero ningún componente de
// pricing (METAL / HECHURA / PRODUCT / SERVICE / total de línea) ni ocultarlo
// visualmente. El motor del backend (`pricing-engine`) emite componentes
// negativos válidos cuando un descuento dirigido excede la base (ej. bonif
// manual 50% sobre "Solo metal" en una línea de Factura).
//
// Regla canónica (CLAUDE.md raíz, "Pricing-engine: componentes negativos son
// válidos"): el render renderiza el valor normalizado tal cual, con signo y
// color (`vt.colors.discount`). Sin `Math.max(0, …)`, sin `value < 0 ? 0 : v`,
// sin filtros que oculten negativos.
//
// Este guard previene la regresión del bug donde HECHURA quedaba en 0 cuando
// `totalWithTax − Σ(metales) < 0`.
// =============================================================================
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src");

// Archivos del flujo "display de composición de línea" en Factura.
// Si aparece otro archivo que toque `hechuraDisplayTotal`, `metalSale`,
// `componentSaleBreakdown.{metal,hechura}.final` para render, agregarlo acá.
const TARGET_FILES = [
  "components/ui/TPDocumentLineAdvancedEditor.tsx",
  "components/sales/SaleCompositionEditableGrid.tsx",
  "lib/pricing/display/saleCompositionDisplay.ts",
  "lib/pricing/adapters/saleSnapshotToNormalized.ts",
  "lib/pricing/normalizePricingPreviewResult.ts",
  "lib/sales/applySalePreviewToDraft.ts",
  "lib/sales/selectInvoiceLineView.ts",
].map((p) => join(ROOT, p)).filter(existsSync);

function linesMatching(file: string, re: RegExp): string[] {
  const src = readFileSync(file, "utf8").split("\n");
  const out: string[] = [];
  src.forEach((l, i) => {
    if (re.test(l) && !l.includes("pricing-clamp:ignore")) {
      out.push(`${file}:${i + 1}  →  ${l.trim()}`);
    }
  });
  return out;
}

describe("Factura — sin clamp a 0 de componentes de pricing", () => {
  it("se encontraron los archivos objetivo", () => {
    expect(TARGET_FILES.length).toBeGreaterThanOrEqual(5);
  });

  // El patrón clásico del bug: `Math.max(0, totalWithTax - sumMetalSale)` o
  // cualquier `Math.max(0, …)` aplicado a la diferencia de componentes /
  // totales de pricing. Inputs del usuario (manualPrice / discount value /
  // tax override) sí están protegidos por Math.max(0, …) y se marcan con
  // `pricing-clamp:ignore`; ver TPDocumentLineAdvancedEditor.tsx.
  it("ningún Math.max(0, …) clampea totales/componentes de pricing en display", () => {
    // Patrones prohibidos en líneas de DISPLAY (no en handlers de input):
    //   Math.max(0, totalWithTax …)         ← bug específico de hechura display
    //   Math.max(0, hechuraDisplayTotal …)
    //   Math.max(0, sumMetalSale …)
    //   Math.max(0, componentSale… .final…)
    //   Math.max(0, metal.final …)
    //   Math.max(0, hechura.final …)
    const forbidden = [
      /Math\.max\(\s*0\s*,\s*totalWithTax/,
      /Math\.max\(\s*0\s*,\s*hechuraDisplayTotal/,
      /Math\.max\(\s*0\s*,\s*sumMetalSale/,
      /Math\.max\(\s*0\s*,\s*componentSale/,
      /Math\.max\(\s*0\s*,\s*\w*\.metal\.final/,
      /Math\.max\(\s*0\s*,\s*\w*\.hechura\.final/,
    ];
    const off = TARGET_FILES.flatMap((f) =>
      forbidden.flatMap((re) => linesMatching(f, re)),
    );
    expect(off, off.join("\n")).toEqual([]);
  });

  it("ningún filtro `.filter(c => c.final > 0)` oculta componentes negativos", () => {
    const off = TARGET_FILES.flatMap((f) =>
      linesMatching(f, /\.filter\([^)]*\.(final|net|saleAmountLine|total)\s*[><!]=?\s*0/),
    );
    expect(off, off.join("\n")).toEqual([]);
  });

  it("`hasHechura` usa Math.abs(...) > umbral (NO `> 0.005` que oculta negativos)", () => {
    const editor = join(ROOT, "components/ui/TPDocumentLineAdvancedEditor.tsx");
    if (!existsSync(editor)) return;
    const src = readFileSync(editor, "utf8");
    // Debe contener la forma con Math.abs (acepta negativos).
    expect(
      src.match(/hasHechura\s*=\s*Math\.abs\(\s*hechuraDisplayTotal\s*\)\s*>/),
      "hasHechura debe usar Math.abs(hechuraDisplayTotal) para no ocultar negativos",
    ).not.toBeNull();
    // Y NO debe contener la forma vieja sin Math.abs.
    expect(
      src.match(/hasHechura\s*=\s*hechuraDisplayTotal\s*>\s*0\.005/),
      "hasHechura no debe comparar hechuraDisplayTotal > 0.005 (oculta negativos)",
    ).toBeNull();
  });

  it("`hechuraDisplayTotal` se renderiza con color condicional cuando es negativo", () => {
    const editor = join(ROOT, "components/ui/TPDocumentLineAdvancedEditor.tsx");
    if (!existsSync(editor)) return;
    const src = readFileSync(editor, "utf8");
    // Debe haber un ternario `hechuraDisplayTotal < 0 ? vt.colors.discount : …`
    // o equivalente que cambie el color cuando es negativo.
    expect(
      src.match(/hechuraDisplayTotal\s*<\s*0\s*\?\s*vt\.colors\.discount/),
      "Render de hechura negativa debe usar vt.colors.discount cuando < 0",
    ).not.toBeNull();
  });
});
