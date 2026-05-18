// src/pages/__tests__/no-inline-format-5.guard.test.ts
// Guard estático (iteración 5): Finanzas, Informes y print/labels no deben
// reintroducir formateo numérico inline. Display visual → motor central.
// Fechas (toLocaleString sin fracción) y CSS/keys marcados con
// `number-format:ignore` están permitidos.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src");

const TARGET_FILES = [
  "pages/FinanzasCuentaCorriente.tsx",
  "pages/FinanzasMovimientos.tsx",
  "pages/FinanzasSaldosMetal.tsx",
  "pages/FinanzasSaldosMoneda.tsx",
  "pages/InformesCompras.tsx",
  "pages/InformesFinanzas.tsx",
  "pages/InformesHub.tsx",
  "pages/InformesStock.tsx",
  "pages/InformesVentas.tsx",
  "lib/movementPrint.ts",
  "pages/article-detail/LabelPrintModal.tsx",
  "pages/entity-detail/EntityAccountStatement.tsx",
];

const FILES = TARGET_FILES.map((p) => join(ROOT, p)).filter(existsSync);

function linesWith(file: string, pred: (l: string) => boolean): string[] {
  const ls = readFileSync(file, "utf8").split("\n");
  const hits: string[] = [];
  ls.forEach((l, i) => { if (pred(l)) hits.push(`${file}:${i + 1}`); });
  return hits;
}

describe("Finanzas/Informes/print — sin formateo numérico inline", () => {
  it("se encontraron los archivos objetivo", () => {
    expect(FILES.length).toBeGreaterThanOrEqual(11);
  });

  it("ningún toLocaleString numérico (con opciones de fracción)", () => {
    const offenders = FILES.flatMap((f) =>
      linesWith(f, (l) =>
        /\.toLocaleString\([^)]*Fraction/.test(l) && !l.includes("number-format:ignore")),
    );
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("ningún Intl.NumberFormat", () => {
    const offenders = FILES.flatMap((f) =>
      linesWith(f, (l) => l.includes("Intl.NumberFormat") && !l.includes("number-format:ignore")),
    );
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("ningún .toFixed( de display (salvo CSS/cálculo marcado number-format:ignore)", () => {
    const offenders = FILES.flatMap((f) =>
      linesWith(f, (l) => l.includes(".toFixed(") && !l.includes("number-format:ignore")),
    );
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
