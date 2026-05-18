// src/lib/pricing/__tests__/finanzas-print-format.test.ts
// Iteración 5 — Finanzas, Informes y print/labels formatean vía helpers
// centrales config-aware. Export machine-readable (CSV) queda RAW.
import { describe, it, expect, afterEach } from "vitest";
import {
  setActiveNumberFormatConfig,
  DEFAULT_NUMBER_FORMAT_CONFIG,
  type NumberFormatConfig,
} from "../../number-format";
import { formatMoneyDoc, formatQty, formatGrams, formatDecimal } from "../format";
import { rowsToCSV, csvCell } from "../../../pages/articulos.utils";

const US: NumberFormatConfig = { region: "US", custom: { thousands: ".", decimal: "," }, presets: {} };
afterEach(() => setActiveNumberFormatConfig(DEFAULT_NUMBER_FORMAT_CONFIG));

describe("Finanzas/Informes/print — Argentina (default)", () => {
  it("MONEY estado de cuenta / KPIs", () => {
    expect(formatMoneyDoc(1250000.5)).toBe("1.250.000,50");
    expect(formatMoneyDoc(1250000.5, "AR$")).toBe("AR$ 1.250.000,50");
  });
  it("gramos print (3 dec) y cantidad", () => {
    expect(formatGrams(12.5, 3)).toBe("12,500");
    expect(formatQty(3)).toBe("3");
  });
});

describe("Finanzas/Informes/print — USA", () => {
  it("MONEY/gramos respetan región", () => {
    setActiveNumberFormatConfig(US);
    expect(formatMoneyDoc(1250000.5, "AR$")).toBe("AR$ 1,250,000.50");
    expect(formatGrams(12.5, 3)).toBe("12.500");
    expect(formatDecimal(10.5, 2)).toBe("10.50");
  });
});

describe("Export machine-readable — NO se formatea (raw)", () => {
  it("rowsToCSV preserva el número crudo, sin separadores de región", () => {
    setActiveNumberFormatConfig(US); // aunque cambie la región…
    const csv = rowsToCSV([{ sku: "A1", precio: 1250000.5, stock: 3 }]);
    // …el CSV mantiene el valor raw (1250000.5), NO "1,250,000.50".
    expect(csv).toContain("1250000.5");
    expect(csv).not.toContain("1,250,000.50");
    expect(csv).not.toContain("1.250.000,50");
  });
  it("csvCell no toca números (machine-readable)", () => {
    expect(csvCell(1250000.5)).toBe("1250000.5");
    expect(csvCell(3)).toBe("3");
  });
});
