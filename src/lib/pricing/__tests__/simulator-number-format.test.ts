// src/lib/pricing/__tests__/simulator-number-format.test.ts
// Iteración 3 — el Simulador (PricingSimulator + PriceCompositionCards +
// PricingStepsBreakdown + CostCompositionBlock) formatea EXCLUSIVAMENTE vía
// estos helpers centrales. Si respetan la región acá, toda la superficie la
// respeta (el guard estático prueba que no quedó formateo inline).
import { describe, it, expect, afterEach } from "vitest";
import {
  setActiveNumberFormatConfig,
  DEFAULT_NUMBER_FORMAT_CONFIG,
  type NumberFormatConfig,
} from "../../number-format";
import {
  formatMoneyAmount,
  formatDecimal,
  formatDecimalUpTo,
  formatGrams,
  formatPercent,
} from "../format";

const US: NumberFormatConfig = { region: "US", custom: { thousands: ".", decimal: "," }, presets: {} };

afterEach(() => setActiveNumberFormatConfig(DEFAULT_NUMBER_FORMAT_CONFIG));

describe("Región Argentina (default) — sin regresión", () => {
  it("MONEY: $1.632.831,84 y $3.020.700,00", () => {
    expect(formatMoneyAmount(1632831.84, "$")).toBe("$1.632.831,84");
    expect(formatMoneyAmount(3020700, "$")).toBe("$3.020.700,00");
  });
  it("MARGIN_PERCENT 45,90 % / factor 1,10 (formatDecimal)", () => {
    expect(formatDecimal(45.9, 2)).toBe("45,90");
    expect(formatDecimal(1.1, 2)).toBe("1,10");
  });
  it("METAL_GRAMS / PURITY 3 dec (formatGrams): 0,750", () => {
    expect(formatGrams(0.75, 3)).toBe("0,750");
  });
  it("MERMA_PERCENT (formatPercent): 10,00%", () => {
    expect(formatPercent(10)).toBe("10,00%");
  });
  it("formatDecimalUpTo recorta ceros: 1,5 y 3", () => {
    expect(formatDecimalUpTo(1.5, 4)).toBe("1,5");
    expect(formatDecimalUpTo(3, 4)).toBe("3");
  });
});

describe("Región USA — la superficie respeta el formato regional", () => {
  it("MONEY: $1,632,831.84 y $3,020,700.00", () => {
    setActiveNumberFormatConfig(US);
    expect(formatMoneyAmount(1632831.84, "$")).toBe("$1,632,831.84");
    expect(formatMoneyAmount(3020700, "$")).toBe("$3,020,700.00");
  });
  it("MARGIN_PERCENT 45.90 / factor 1.10", () => {
    setActiveNumberFormatConfig(US);
    expect(formatDecimal(45.9, 2)).toBe("45.90");
    expect(formatDecimal(1.1, 2)).toBe("1.10");
  });
  it("PURITY 0.750 / MERMA 10.00%", () => {
    setActiveNumberFormatConfig(US);
    expect(formatGrams(0.75, 3)).toBe("0.750");
    expect(formatPercent(10)).toBe("10.00%");
  });
  it("formatDecimalUpTo: 1.5 / 3 (USA)", () => {
    setActiveNumberFormatConfig(US);
    expect(formatDecimalUpTo(1.5, 4)).toBe("1.5");
    expect(formatDecimalUpTo(3, 4)).toBe("3");
  });
  it("USD × cotización: monto base + tasa respetan región", () => {
    setActiveNumberFormatConfig(US);
    // formatMoneyAmount(x, "") (= fmtMoney aliasado en CostLineOtherRow)
    expect(formatMoneyAmount(10, "").trim()).toBe("10.00");
    expect(formatDecimalUpTo(1600, 2)).toBe("1,600");
  });
});

describe("display-only — no muta el valor (no toca cálculos)", () => {
  it("formatMoneyAmount/formatDecimal no mutan la entrada", () => {
    setActiveNumberFormatConfig(US);
    const v = 1632831.84;
    formatMoneyAmount(v, "$");
    formatDecimal(v, 2);
    expect(v).toBe(1632831.84);
  });
  it("nullish → — (contrato preservado)", () => {
    expect(formatMoneyAmount(null)).toBe("—");
    expect(formatDecimal(undefined)).toBe("—");
    expect(formatDecimalUpTo(NaN)).toBe("—");
  });
});
