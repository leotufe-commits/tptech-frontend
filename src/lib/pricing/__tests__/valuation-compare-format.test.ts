// src/lib/pricing/__tests__/valuation-compare-format.test.ts
// Iteración 4A — Comparador y Divisas/Valuation formatean vía estos helpers
// centrales config-aware. Si respetan la región acá, ambas superficies la
// respetan (el guard estático prueba que no quedó formateo inline).
import { describe, it, expect, afterEach } from "vitest";
import {
  setActiveNumberFormatConfig,
  DEFAULT_NUMBER_FORMAT_CONFIG,
  parseNumberInput,
  type NumberFormatConfig,
} from "../../number-format";
import {
  formatMoneyDoc,
  fmtRateSmart,
  fmtMoneySmart,
  fmtNumberSmart,
  fmtNumber2,
  fmtPurity3,
  fmtPurity2,
  fmtFactor,
  formatDecimalUpTo,
} from "../format";

const US: NumberFormatConfig = { region: "US", custom: { thousands: ".", decimal: "," }, presets: {} };

afterEach(() => setActiveNumberFormatConfig(DEFAULT_NUMBER_FORMAT_CONFIG));

describe("Argentina (default) — sin regresión es-AR", () => {
  it("Comparador MONEY: formatMoneyDoc", () => {
    expect(formatMoneyDoc(1250000.5)).toBe("1.250.000,50");
    expect(formatMoneyDoc(1250000.5, "AR$")).toBe("AR$ 1.250.000,50");
    expect(formatMoneyDoc(NaN)).toBe("—");
  });
  it("FX_RATE smart: ≥1 2dec, <1 hasta 10 sin rellenar", () => {
    expect(fmtRateSmart(1600)).toBe("1.600,00");
    expect(fmtRateSmart(0.0025)).toBe("0,0025");
    expect(fmtRateSmart(null)).toBe("—");
  });
  it("MONEY_EXTENDED smart con símbolo", () => {
    expect(fmtMoneySmart("AR$", 1250000.5)).toBe("AR$ 1.250.000,50");
    expect(fmtNumberSmart(1250000.5)).toBe("1.250.000,50");
  });
  it("PURITY 3 y 4 dec", () => {
    expect(fmtPurity3(0.75)).toBe("0,750");
    expect(fmtPurity2(0.585)).toBe("0,5850");
  });
  it("fmtNumber2 / fmtFactor", () => {
    expect(fmtNumber2(10.5)).toBe("10,50");
    expect(fmtFactor(1.1)).toBe("+10%");
    expect(fmtFactor(1.105)).toBe("+10,50%");
  });
  it("formatDecimalUpTo (cotización banner): hasta 4 sin rellenar", () => {
    expect(formatDecimalUpTo(1600, 4)).toBe("1.600");
    expect(formatDecimalUpTo(1234.5, 4)).toBe("1.234,5");
  });
});

describe("USA — Comparador y Divisas respetan la región", () => {
  it("MONEY: 1,250,000.50", () => {
    setActiveNumberFormatConfig(US);
    expect(formatMoneyDoc(1250000.5)).toBe("1,250,000.50");
    expect(formatMoneyDoc(1250000.5, "AR$")).toBe("AR$ 1,250,000.50");
  });
  it("FX_RATE: 1,600.00 / 0.0025", () => {
    setActiveNumberFormatConfig(US);
    expect(fmtRateSmart(1600)).toBe("1,600.00");
    expect(fmtRateSmart(0.0025)).toBe("0.0025");
  });
  it("MONEY_EXTENDED / PURITY en USA", () => {
    setActiveNumberFormatConfig(US);
    expect(fmtMoneySmart("AR$", 1250000.5)).toBe("AR$ 1,250,000.50");
    expect(fmtPurity3(0.75)).toBe("0.750");
  });
  it("cotización banner: 1,234.5", () => {
    setActiveNumberFormatConfig(US);
    expect(formatDecimalUpTo(1234.5, 4)).toBe("1,234.5");
  });
});

describe("Inputs — coma o punto → number puro (no recalcula nada)", () => {
  it("AddQuoteModal-style parse acepta coma y punto", () => {
    // patrón usado en submit(): parseNumberInput(price, activeCfg)
    expect(parseNumberInput("120000,5", DEFAULT_NUMBER_FORMAT_CONFIG)).toBe(120000.5);
    expect(parseNumberInput("120000.5", DEFAULT_NUMBER_FORMAT_CONFIG)).toBe(120000.5);
    expect(parseNumberInput("1.250.000,50", DEFAULT_NUMBER_FORMAT_CONFIG)).toBe(1250000.5);
    expect(parseNumberInput("", DEFAULT_NUMBER_FORMAT_CONFIG)).toBeNull();
  });
  it("no muta el valor (display-only)", () => {
    setActiveNumberFormatConfig(US);
    const v = 1250000.5;
    formatMoneyDoc(v);
    fmtRateSmart(v);
    expect(v).toBe(1250000.5);
  });
});
