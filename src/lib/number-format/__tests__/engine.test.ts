// src/lib/number-format/__tests__/engine.test.ts
import { describe, it, expect } from "vitest";
import {
  formatNumber,
  parseNumberInput,
  normalizeNumberInput,
  getNumberFormatConfig,
  type NumberFormatConfig,
} from "../index";

const AR: NumberFormatConfig = { region: "AR", custom: { thousands: ".", decimal: "," }, presets: {} };
const US: NumberFormatConfig = { region: "US", custom: { thousands: ".", decimal: "," }, presets: {} };

describe("Español / Argentina", () => {
  it("parsea 1.000,50 como 1000.50", () => {
    expect(parseNumberInput("1.000,50", AR)).toBe(1000.5);
  });
  it("muestra 1000.5 como 1.000,50 (MONEY)", () => {
    expect(formatNumber(1000.5, "MONEY", AR)).toBe("1.000,50");
  });
});

describe("Inglés / USA", () => {
  it("parsea 1,000.50 como 1000.50", () => {
    expect(parseNumberInput("1,000.50", US)).toBe(1000.5);
  });
  it("muestra 1000.5 como 1,000.50 (MONEY)", () => {
    expect(formatNumber(1000.5, "MONEY", US)).toBe("1,000.50");
  });
});

describe("MERMA_PERCENT", () => {
  it("muestra 10.5 como 10,50 % (AR)", () => {
    expect(formatNumber(10.5, "MERMA_PERCENT", AR)).toBe("10,50 %");
  });
  it("no altera el valor numérico de entrada", () => {
    const v = 10.5;
    formatNumber(v, "MERMA_PERCENT", AR);
    expect(v).toBe(10.5);
  });
});

describe("METAL_GRAMS", () => {
  it("muestra 1.25 como 1,250 g (AR, 3 decimales, sufijo g)", () => {
    expect(formatNumber(1.25, "METAL_GRAMS", AR)).toBe("1,250 g");
  });
});

describe("FX_RATE", () => {
  it("muestra 1250.123456 con 6 decimales (AR)", () => {
    expect(formatNumber(1250.123456, "FX_RATE", AR)).toBe("1.250,123456");
  });
});

describe("INTEGER", () => {
  it("muestra 10 sin decimales", () => {
    expect(formatNumber(10, "INTEGER", AR)).toBe("10");
  });
  it("redondea 10.6 a 11", () => {
    expect(formatNumber(10.6, "INTEGER", AR)).toBe("11");
  });
});

describe("AJUSTE_PERCENT — signo siempre visible", () => {
  it("positivo → +5,00 %", () => {
    expect(formatNumber(5, "AJUSTE_PERCENT", AR)).toBe("+5,00 %");
  });
  it("negativo → −5,00 %", () => {
    expect(formatNumber(-5, "AJUSTE_PERCENT", AR)).toBe("−5,00 %");
  });
});

describe("trimTrailingZeros (override)", () => {
  it("oculta ceros finales cuando se configura", () => {
    const cfg: NumberFormatConfig = {
      region: "AR",
      custom: { thousands: ".", decimal: "," },
      presets: { METAL_GRAMS: { trimTrailingZeros: true } },
    };
    expect(formatNumber(1.25, "METAL_GRAMS", cfg)).toBe("1,25 g");
  });
});

describe("override de decimales por tipo", () => {
  it("MONEY con 4 decimales si el tenant lo configura", () => {
    const cfg: NumberFormatConfig = {
      region: "AR",
      custom: { thousands: ".", decimal: "," },
      presets: { MONEY: { decimals: 4 } },
    };
    expect(getNumberFormatConfig("MONEY", cfg).decimals).toBe(4);
    expect(formatNumber(1250.1234, "MONEY", cfg)).toBe("1.250,1234");
  });
});

describe("CUSTOM separators", () => {
  it("respeta separadores libres (miles espacio, decimal punto)", () => {
    const cfg: NumberFormatConfig = {
      region: "CUSTOM",
      custom: { thousands: " ", decimal: "." },
      presets: {},
    };
    expect(formatNumber(1234567.5, "MONEY", cfg)).toBe("1 234 567.50");
  });
});

describe("normalizeNumberInput — tolerante a coma o punto", () => {
  it("acepta coma decimal", () => {
    expect(normalizeNumberInput("1,5")).toBe("1.5");
  });
  it("acepta punto decimal", () => {
    expect(normalizeNumberInput("1.5")).toBe("1.5");
  });
  it("preserva precisión completa mientras se edita", () => {
    expect(normalizeNumberInput("1,2548")).toBe("1.2548");
  });
  it("vacío → cadena vacía (no rompe cálculos)", () => {
    expect(parseNumberInput("", AR)).toBeNull();
  });
});

describe("nullish → blank", () => {
  it("null muestra — por defecto", () => {
    expect(formatNumber(null, "MONEY", AR)).toBe("—");
  });
  it("blank configurable", () => {
    expect(formatNumber(undefined, "MONEY", AR, { blank: "" })).toBe("");
  });
});
