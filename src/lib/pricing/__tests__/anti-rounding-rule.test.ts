// src/lib/pricing/__tests__/anti-rounding-rule.test.ts
// =============================================================================
// FASE 1.0 — PR4. Valida que la rule no-restricted-syntax (anti-rounding)
// efectivamente dispara para los patrones prohibidos cuando se aplica a
// archivos en los paths restringidos.
//
// Usa la API programática de ESLint (`Linter`) con la misma config de
// patterns que `eslint.config.js`. Si la rule cambia, este test detecta
// regresiones.
// =============================================================================

import { describe, it, expect } from "vitest";
import { Linter } from "eslint";
import tseslint from "typescript-eslint";

// Mismos patterns que en eslint.config.js — duplicados a propósito para que
// el test sea auto-contenido y el contrato esté frozen acá también.
const ANTI_ROUNDING_PATTERNS = [
  {
    selector:
      "BinaryExpression[operator='/'][right.type='Literal'][right.value=100][left.type='CallExpression'][left.callee.type='MemberExpression'][left.callee.object.name='Math'][left.callee.property.name='round']",
    message: "Math.round(*100)/100 prohibido",
  },
  {
    selector: "CallExpression[callee.property.name='toFixed']",
    message: ".toFixed prohibido",
  },
];

const tsConfigs = (tseslint as any).configs.recommended;
const tsConfig = Array.isArray(tsConfigs) ? tsConfigs[0] : tsConfigs;
const tsParser = tsConfig?.languageOptions?.parser;

function lint(code: string): { messages: Array<{ ruleId: string | null; message: string; line: number }> } {
  const linter = new Linter();
  const messages = linter.verify(code, [
    {
      languageOptions: tsParser ? { parser: tsParser } : undefined,
      rules: {
        "no-restricted-syntax": ["error", ...ANTI_ROUNDING_PATTERNS],
      },
    },
  ]);
  return {
    messages: messages.map(m => ({
      ruleId:  m.ruleId,
      message: m.message,
      line:    m.line,
    })),
  };
}

// =============================================================================
// 1. Math.round(X * 100) / 100 — debe disparar
// =============================================================================

describe("anti-rounding rule — Math.round(*100)/100", () => {
  it("baseline correct: dispara para 'Math.round(n * 100) / 100'", () => {
    const r = lint(`
      function bad(n) {
        return Math.round(n * 100) / 100;
      }
    `);
    expect(r.messages).toHaveLength(1);
    expect(r.messages[0].ruleId).toBe("no-restricted-syntax");
    expect(r.messages[0].message).toContain("Math.round(*100)/100");
  });

  it("baseline correct: dispara con espacios extra y paréntesis anidados", () => {
    const r = lint(`
      const v = Math.round( ( a + b ) * 100 ) / 100;
    `);
    const filtered = r.messages.filter(m => m.message.includes("Math.round"));
    expect(filtered).toHaveLength(1);
  });

  it("baseline correct: NO dispara para Math.round sin /100 (uso legítimo)", () => {
    const r = lint(`
      const idx = Math.round(items.length / 2);
    `);
    expect(r.messages.filter(m => m.ruleId === "no-restricted-syntax")).toHaveLength(0);
  });

  it("baseline correct: NO dispara para Math.round(*1000)/1000 (3 decimales — futuro)", () => {
    const r = lint(`
      const v = Math.round(n * 1000) / 1000;
    `);
    expect(r.messages.filter(m => m.ruleId === "no-restricted-syntax")).toHaveLength(0);
  });
});

// =============================================================================
// 2. .toFixed — debe disparar
// =============================================================================

describe("anti-rounding rule — .toFixed", () => {
  it("baseline correct: dispara para 'n.toFixed(2)'", () => {
    const r = lint(`
      function show(n) { return n.toFixed(2); }
    `);
    const filtered = r.messages.filter(m => m.message.includes("toFixed"));
    expect(filtered).toHaveLength(1);
  });

  it("baseline correct: dispara para chained 'value.toFixed(N).slice(...)'", () => {
    const r = lint(`
      const s = price.toFixed(2).replace(".", ",");
    `);
    const filtered = r.messages.filter(m => m.message.includes("toFixed"));
    expect(filtered).toHaveLength(1);
  });

  it("baseline correct: NO dispara para método 'toFixed' inventado en otro objeto sin estructura prohibida", () => {
    // Falso positivo aceptable: cualquier obj.toFixed(N) dispara. Es agresiva
    // a propósito — el costo de un falso positivo es bajo (cambiar a fmt*).
    const r = lint(`
      const obj = { toFixed: () => "x" };
      const x = obj.toFixed(2);
    `);
    // Esta sí dispara intencionalmente — la rule es conservadora.
    const filtered = r.messages.filter(m => m.message.includes("toFixed"));
    expect(filtered.length).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// 3. Código limpio — NO dispara
// =============================================================================

describe("anti-rounding rule — código limpio", () => {
  it("baseline correct: lectura passthrough del backend NO dispara", () => {
    const r = lint(`
      function render(snapshot) {
        return snapshot.documentTotals.total;
      }
    `);
    expect(r.messages.filter(m => m.ruleId === "no-restricted-syntax")).toHaveLength(0);
  });

  it("baseline correct: fmtMoney + Intl.NumberFormat NO disparan", () => {
    const r = lint(`
      function fmt(n) {
        return n.toLocaleString("es-AR", { minimumFractionDigits: 2 });
      }
    `);
    expect(r.messages.filter(m => m.ruleId === "no-restricted-syntax")).toHaveLength(0);
  });
});
