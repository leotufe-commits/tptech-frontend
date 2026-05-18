// src/components/valuation/__tests__/no-inline-format.guard.test.ts
// Guard estático (iteración 4A): Comparador + Divisas/Valuation no deben
// reintroducir formateo numérico inline. Todo el display pasa por el motor
// central (lib/pricing/format → number-format). Las fechas (toLocaleString
// sin opciones de fracción) y las claves/rounding de cálculo marcadas con
// `number-format:ignore` están permitidas explícitamente.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src");

const TARGETS = [
  "pages/dev/PricingCompare.tsx",
  "pages/Divisas.tsx",
  "components/valuation",
  "hooks/useValuation.ts",
];

// CreateVariantModal usa .toFixed() para REDONDEO DE CÁLCULO/ESTADO
// (setSaleFactor/saleFinal/comparaciones), NO para display. Auditado en
// iteración 4A: fuera del alcance "no tocar cálculos/rounding".
const TOFIXED_CALC_ALLOW = ["CreateVariantModal.tsx"];

function collect(rel: string): string[] {
  const abs = join(ROOT, rel);
  const st = statSync(abs);
  if (st.isFile()) return [abs];
  const out: string[] = [];
  for (const name of readdirSync(abs)) {
    if (name === "__tests__") continue;
    const child = join(abs, name);
    if (statSync(child).isDirectory()) out.push(...collect(join(rel, name)));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(child);
  }
  return out;
}

const FILES = TARGETS.flatMap(collect);

function linesWith(file: string, pred: (l: string) => boolean): number[] {
  const ls = readFileSync(file, "utf8").split("\n");
  const hits: number[] = [];
  ls.forEach((l, i) => { if (pred(l)) hits.push(i + 1); });
  return hits;
}

describe("Comparador + Valuation — sin formateo numérico inline", () => {
  it("hay archivos para auditar", () => {
    expect(FILES.length).toBeGreaterThan(8);
  });

  it("ningún toLocaleString numérico (con opciones de fracción)", () => {
    // Las fechas usan toLocaleString("es-AR") SIN segundo arg → permitidas.
    const offenders = FILES.flatMap((f) =>
      linesWith(f, (l) => /\.toLocaleString\([^)]*Fraction/.test(l)).map((n) => `${f}:${n}`),
    );
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("ningún Intl.NumberFormat", () => {
    const offenders = FILES.filter((f) => readFileSync(f, "utf8").includes("Intl.NumberFormat"));
    expect(offenders).toEqual([]);
  });

  it("ningún .toFixed( de display (salvo cálculo permitido o marcado)", () => {
    const offenders = FILES.flatMap((f) => {
      if (TOFIXED_CALC_ALLOW.some((a) => f.endsWith(a))) return [];
      return linesWith(
        f,
        (l) => l.includes(".toFixed(") && !l.includes("number-format:ignore"),
      ).map((n) => `${f}:${n}`);
    });
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
