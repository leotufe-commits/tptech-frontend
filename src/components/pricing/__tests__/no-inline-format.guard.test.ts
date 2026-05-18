// src/components/pricing/__tests__/no-inline-format.guard.test.ts
// Guard estático (iteración 3): la superficie del Simulador NO debe tener
// formateo inline (toFixed / toLocaleString / Intl.NumberFormat). Todo el
// formato pasa por el motor central (lib/pricing/format → number-format).
// Esto garantiza que la región se respete en TODA la superficie sin tener
// que renderizar cada componente, y que no se reintroduzca formato crudo.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src");

const TARGETS = [
  "pages/PricingSimulator.tsx",
  "components/pricing/PriceCompositionCards",
  "components/pricing/PricingStepsBreakdown",
  "components/pricing/CostCompositionBlock",
];

function collect(rel: string): string[] {
  const abs = join(ROOT, rel);
  const st = statSync(abs);
  if (st.isFile()) return [abs];
  const out: string[] = [];
  for (const name of readdirSync(abs)) {
    if (name === "__tests__") continue;
    const child = join(abs, name);
    if (statSync(child).isDirectory()) {
      out.push(...collect(join(rel, name)));
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(child);
    }
  }
  return out;
}

const FILES = TARGETS.flatMap(collect);

describe("Superficie Simulador — sin formateo inline", () => {
  it("hay archivos para auditar", () => {
    expect(FILES.length).toBeGreaterThan(5);
  });

  it("ningún .toFixed( inline", () => {
    const offenders = FILES.filter((f) => readFileSync(f, "utf8").includes(".toFixed("));
    expect(offenders, `Usar formatDecimal/formatGrams del motor central:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("ningún .toLocaleString( inline", () => {
    const offenders = FILES.filter((f) => readFileSync(f, "utf8").includes(".toLocaleString("));
    expect(offenders, `Usar helpers centrales:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("ningún Intl.NumberFormat inline", () => {
    const offenders = FILES.filter((f) => readFileSync(f, "utf8").includes("Intl.NumberFormat"));
    expect(offenders).toEqual([]);
  });
});
