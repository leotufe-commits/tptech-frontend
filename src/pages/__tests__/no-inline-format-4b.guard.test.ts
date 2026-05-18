// src/pages/__tests__/no-inline-format-4b.guard.test.ts
// Guard estático (iteración 4B): las superficies generales (Artículos,
// Inventario, Compras, Listados de Ventas, Dashboard/KPIs) no deben
// reintroducir formateo numérico inline. Todo el display pasa por el motor
// central (lib/pricing/format → number-format). Las fechas (toLocaleString
// sin opciones de fracción) y el cálculo/rounding/keys marcados con
// `number-format:ignore` están permitidos explícitamente.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src");

const TARGET_FILES = [
  "pages/InventarioArticulos.tsx",
  "pages/InventarioArticulosMovimientos.tsx",
  "pages/InventarioMovimientos.tsx",
  "pages/InventarioReposicion.tsx",
  "pages/InventarioStockPorDeposito.tsx",
  "pages/Caja.tsx",
  "pages/Ventas.tsx",
  "pages/VentasCobros.tsx",
  "pages/VentasDevoluciones.tsx",
  "pages/Dashboard.tsx",
  "pages/DashboardRentabilidad.tsx",
  "pages/articulos.utils.ts",
  "pages/ComprasProveedores.tsx",
  "pages/ComprasOrdenes.tsx",
  "pages/ComprasRecepciones.tsx",
  "pages/ComprasFacturasProveedor.tsx",
  "pages/ComprasNotasCreditoProveedor.tsx",
  "pages/ComprasPagosProveedor.tsx",
  "pages/ComprasDevoluciones.tsx",
  "pages/article-detail/CostRow.tsx",
  "pages/article-detail/CostosTab.tsx",
  "pages/article-detail/ArticleDetail.tsx",
  "pages/article-detail/ArticleModal.tsx",
  "pages/article-detail/ViewVariantModal.tsx",
  "components/sales/PriceFlowCards.tsx",
];

// LabelPrintModal = impresión de etiquetas → fuera de alcance 4B (PDFs/print).
// (No se incluye en TARGET_FILES.)

const FILES = TARGET_FILES.map((p) => join(ROOT, p)).filter(existsSync);

function linesWith(file: string, pred: (l: string) => boolean): number[] {
  const ls = readFileSync(file, "utf8").split("\n");
  const hits: number[] = [];
  ls.forEach((l, i) => { if (pred(l)) hits.push(i + 1); });
  return hits;
}

describe("Superficies 4B — sin formateo numérico inline", () => {
  it("se encontraron los archivos objetivo", () => {
    expect(FILES.length).toBeGreaterThanOrEqual(20);
  });

  it("ningún toLocaleString numérico (con opciones de fracción)", () => {
    const offenders = FILES.flatMap((f) =>
      linesWith(f, (l) =>
        /\.toLocaleString\([^)]*Fraction/.test(l) && !l.includes("number-format:ignore"),
      ).map((n) => `${f}:${n}`),
    );
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("ningún Intl.NumberFormat", () => {
    const offenders = FILES.flatMap((f) =>
      linesWith(f, (l) => l.includes("Intl.NumberFormat") && !l.includes("number-format:ignore"))
        .map((n) => `${f}:${n}`),
    );
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("ningún .toFixed( de display (salvo cálculo/key marcado number-format:ignore)", () => {
    const offenders = FILES.flatMap((f) =>
      linesWith(f, (l) => l.includes(".toFixed(") && !l.includes("number-format:ignore"))
        .map((n) => `${f}:${n}`),
    );
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
