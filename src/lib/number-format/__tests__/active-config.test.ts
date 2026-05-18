// src/lib/number-format/__tests__/active-config.test.ts
// La config activa (puente Context → helpers puros) hace que los helpers
// centrales de pricing reflejen la región sin tocar cada call-site.
import { describe, it, expect, afterEach } from "vitest";
import {
  setActiveNumberFormatConfig,
  getActiveNumberFormatConfig,
  DEFAULT_NUMBER_FORMAT_CONFIG,
  type NumberFormatConfig,
} from "../index";
import { formatGrams, formatPercent, formatMoneyDisplay } from "../../pricing/format";

const US: NumberFormatConfig = { region: "US", custom: { thousands: ".", decimal: "," }, presets: {} };

afterEach(() => setActiveNumberFormatConfig(DEFAULT_NUMBER_FORMAT_CONFIG));

describe("config activa por defecto (AR) — sin regresión es-AR", () => {
  it("formatGrams 1234.5 → 1.234,50", () => {
    expect(formatGrams(1234.5, 2)).toBe("1.234,50");
  });
  it("formatPercent 10.5 → 10,50%", () => {
    expect(formatPercent(10.5)).toBe("10,50%");
  });
  it("formatMoneyDisplay 1000.5 → $1.000,50", () => {
    expect(formatMoneyDisplay(1000.5, 1, "$")).toBe("$1.000,50");
  });
});

describe("al cambiar la región a USA, los helpers reflejan el formato", () => {
  it("formatGrams 1234.5 → 1,234.50", () => {
    setActiveNumberFormatConfig(US);
    expect(formatGrams(1234.5, 2)).toBe("1,234.50");
  });
  it("formatMoneyDisplay 1000.5 → $1,000.50", () => {
    setActiveNumberFormatConfig(US);
    expect(formatMoneyDisplay(1000.5, 1, "$")).toBe("$1,000.50");
  });
  it("no altera el número (solo display)", () => {
    setActiveNumberFormatConfig(US);
    const raw = 1000.5;
    formatMoneyDisplay(raw, 1, "$");
    expect(raw).toBe(1000.5);
  });
});

describe("getActiveNumberFormatConfig refleja lo seteado", () => {
  it("default es AR", () => {
    expect(getActiveNumberFormatConfig().region).toBe("AR");
  });
});
