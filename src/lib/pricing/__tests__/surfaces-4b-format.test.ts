// src/lib/pricing/__tests__/surfaces-4b-format.test.ts
// Iteración 4B — Artículos, Inventario, Compras, Listados de Ventas, KPIs y
// Dashboard formatean vía estos helpers centrales config-aware. Si respetan
// la región acá, esas superficies la respetan (el guard estático prueba que
// no quedó formateo inline nuevo).
import { describe, it, expect, afterEach } from "vitest";
import {
  setActiveNumberFormatConfig,
  DEFAULT_NUMBER_FORMAT_CONFIG,
  type NumberFormatConfig,
} from "../../number-format";
import {
  formatMoneyDoc,
  formatQty,
  formatDecimal,
  formatDecimalUpTo,
  formatGrams,
  fmtNumber2,
  fmtMoney2,
  fmtNumberSmart,
  fmtPurity3,
} from "../format";

const US: NumberFormatConfig = { region: "US", custom: { thousands: ".", decimal: "," }, presets: {} };

afterEach(() => setActiveNumberFormatConfig(DEFAULT_NUMBER_FORMAT_CONFIG));

describe("Argentina (default) — listados/KPIs/tooltips sin regresión", () => {
  it("MONEY listado: 1.250.000,50", () => {
    expect(formatMoneyDoc(1250000.5)).toBe("1.250.000,50");
    expect(fmtMoney2("AR$", 1250000.5)).toBe("AR$ 1.250.000,50");
  });
  it("cantidad (formatQty) hasta 3 sin rellenar", () => {
    expect(formatQty(3)).toBe("3");
    expect(formatQty(1.5)).toBe("1,5");
  });
  it("KPI compresión usa decimal de región (Dashboard fmtYAxis/fmtShort)", () => {
    expect(formatDecimalUpTo(1.25, 1) + "M").toBe("1,3M"); // round half-up
    expect(formatDecimalUpTo(12, 0) + "k").toBe("12k");
  });
  it("% (margen/merma) 1-2 dec", () => {
    expect(formatDecimal(45.5, 1) + "%").toBe("45,5%");
    expect(formatDecimal(10.5, 2) + "%").toBe("10,50%");
  });
  it("gramos 2/3 dec y pureza 3 dec", () => {
    expect(formatGrams(1.25, 3)).toBe("1,250");
    expect(fmtPurity3(0.75)).toBe("0,750");
  });
});

describe("USA — toda la UI principal respeta la región", () => {
  it("MONEY: 1,250,000.50", () => {
    setActiveNumberFormatConfig(US);
    expect(formatMoneyDoc(1250000.5)).toBe("1,250,000.50");
    expect(fmtMoney2("AR$", 1250000.5)).toBe("AR$ 1,250,000.50");
  });
  it("cantidad / KPI / % / gramos en USA", () => {
    setActiveNumberFormatConfig(US);
    expect(formatQty(1.5)).toBe("1.5");
    expect(formatDecimalUpTo(1.25, 1) + "M").toBe("1.3M");
    expect(formatDecimal(45.5, 1) + "%").toBe("45.5%");
    expect(formatGrams(1.25, 3)).toBe("1.250");
    expect(fmtPurity3(0.75)).toBe("0.750");
    expect(fmtNumberSmart(1250000.5)).toBe("1,250,000.50");
  });
});

describe("display-only — no muta valores (no toca cálculos)", () => {
  it("formatMoneyDoc/formatDecimal no mutan la entrada", () => {
    setActiveNumberFormatConfig(US);
    const v = 1250000.5;
    formatMoneyDoc(v);
    formatDecimal(v, 2);
    expect(v).toBe(1250000.5);
  });
  it("nullish → — (contrato preservado)", () => {
    expect(formatMoneyDoc(NaN)).toBe("—");
    expect(formatQty(NaN)).toBe("—");
    expect(fmtNumber2(null)).toBe("—");
  });
});
