// src/components/ui/__tests__/base-tables-format.guard.test.ts
// Guard estático — componentes BASE de tabla y cell renderers compartidos no
// deben formatear números inline. Display numérico → motor central
// (lib/pricing/format → number-format). Fechas y casos marcados con
// `number-format:ignore` permitidos.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src");

const TARGET_FILES = [
  "components/ui/TPTable.tsx",
  "components/ui/TPTableKit.tsx",
  "components/ui/TPTreeTable.tsx",
  "components/ui/TPRowExpanded.tsx",
  "components/ui/TPTotalCell.tsx",
  "components/ui/TPKpiBar.tsx",
  "components/ui/TPBalanceCell.tsx",
  "components/ui/TPProgressCell.tsx",
  "components/ui/TPAgingCell.tsx",
  "components/ui/TPBalanceBreakdownKpis.tsx",
];

const FILES = TARGET_FILES.map((p) => join(ROOT, p)).filter(existsSync);

function linesWith(file: string, pred: (l: string) => boolean): string[] {
  const ls = readFileSync(file, "utf8").split("\n");
  const out: string[] = [];
  ls.forEach((l, i) => { if (pred(l)) out.push(`${file}:${i + 1}`); });
  return out;
}

describe("Tablas base + cell renderers — sin formateo numérico inline", () => {
  it("se encontraron los archivos objetivo", () => {
    expect(FILES.length).toBeGreaterThanOrEqual(9);
  });
  it("ningún toLocaleString numérico (con opciones de fracción)", () => {
    const off = FILES.flatMap((f) =>
      linesWith(f, (l) => /\.toLocaleString\([^)]*Fraction/.test(l) && !l.includes("number-format:ignore")));
    expect(off, off.join("\n")).toEqual([]);
  });
  it("ningún Intl.NumberFormat", () => {
    const off = FILES.flatMap((f) =>
      linesWith(f, (l) => l.includes("Intl.NumberFormat") && !l.includes("number-format:ignore")));
    expect(off, off.join("\n")).toEqual([]);
  });
  it("ningún .toFixed( de display (salvo marcado number-format:ignore)", () => {
    const off = FILES.flatMap((f) =>
      linesWith(f, (l) => l.includes(".toFixed(") && !l.includes("number-format:ignore")));
    expect(off, off.join("\n")).toEqual([]);
  });
  it("ningún import de fmtMoney/fmtQty es-AR desde document-helpers (usar central)", () => {
    const off = FILES.filter((f) => {
      const line = readFileSync(f, "utf8").split("\n").find((l) => l.includes("document-helpers")) ?? "";
      return /\bfmt(Money|Qty)\b/.test(line);
    });
    expect(off, off.join("\n")).toEqual([]);
  });
});
