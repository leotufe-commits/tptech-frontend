// src/lib/pricing/__tests__/factura-format.test.ts
// Factura de Ventas: total línea c/ imp., composición del costo, merma/margen
// y pureza formatean vía estos helpers centrales config-aware (los que ahora
// usan TPDocumentTotalsHero / SaleCompositionEditableGrid / saleCompositionDisplay).
import { describe, it, expect, afterEach } from "vitest";
import {
  setActiveNumberFormatConfig,
  DEFAULT_NUMBER_FORMAT_CONFIG,
  type NumberFormatConfig,
} from "../../number-format";
import { formatMoneyDoc, formatDecimal, formatGrams, fmtPurity3 } from "../format";

const US: NumberFormatConfig = { region: "US", custom: { thousands: ".", decimal: "," }, presets: {} };
afterEach(() => setActiveNumberFormatConfig(DEFAULT_NUMBER_FORMAT_CONFIG));

describe("Factura — región Argentina (default)", () => {
  it("Total línea c/ imp.: AR$ 3.020.738,90", () => {
    expect(`AR$ ${formatDecimal(3020738.9, 2)}`).toBe("AR$ 3.020.738,90");
    expect(formatMoneyDoc(192500, "AR$")).toBe("AR$ 192.500,00");
  });
  it("composición: costo total/venta/totales grupo", () => {
    expect(formatMoneyDoc(356125, "AR$")).toBe("AR$ 356.125,00");
    expect(formatMoneyDoc(1085524, "AR$")).toBe("AR$ 1.085.524,00");
  });
  it("merma/margen/pureza/gramos", () => {
    expect(formatDecimal(10, 2) + " %").toBe("10,00 %");
    expect(formatDecimal(85, 2) + " %").toBe("85,00 %");
    expect(fmtPurity3(0.75)).toBe("0,750");
    expect(formatGrams(1.1, 3)).toBe("1,100");
  });
});

describe("Factura — región USA", () => {
  it("Total línea c/ imp.: AR$ 3,020,738.90", () => {
    setActiveNumberFormatConfig(US);
    expect(`AR$ ${formatDecimal(3020738.9, 2)}`).toBe("AR$ 3,020,738.90");
    expect(formatMoneyDoc(192500, "AR$")).toBe("AR$ 192,500.00");
  });
  it("composición / merma / margen / pureza / gramos en USA", () => {
    setActiveNumberFormatConfig(US);
    expect(formatMoneyDoc(356125, "AR$")).toBe("AR$ 356,125.00");
    expect(formatMoneyDoc(1085524, "AR$")).toBe("AR$ 1,085,524.00");
    expect(formatDecimal(10, 2) + " %").toBe("10.00 %");
    expect(formatDecimal(85, 2) + " %").toBe("85.00 %");
    expect(fmtPurity3(0.75)).toBe("0.750");
    expect(formatGrams(1.1, 3)).toBe("1.100");
  });
});

describe("display-only — no muta valores", () => {
  it("no muta la entrada", () => {
    setActiveNumberFormatConfig(US);
    const v = 3020738.9;
    formatDecimal(v, 2);
    formatMoneyDoc(v, "AR$");
    expect(v).toBe(3020738.9);
  });
});

describe("Cards inferiores (Descuento/Envío/Cobro/Total a cobrar) — fmtCurrency=mFmt", () => {
  // mFmt = fmtMoney((amount)/rate, "AR$"); fmtMoney = formatMoneyDoc (central).
  it("Argentina", () => {
    expect(formatMoneyDoc(3500, "AR$")).toBe("AR$ 3.500,00");
    expect(formatMoneyDoc(801709356.72, "AR$")).toBe("AR$ 801.709.356,72");
    expect(formatMoneyDoc(4619372960.15, "AR$")).toBe("AR$ 4.619.372.960,15");
  });
  it("USA", () => {
    setActiveNumberFormatConfig(US);
    expect(formatMoneyDoc(3500, "AR$")).toBe("AR$ 3,500.00");
    expect(formatMoneyDoc(801709356.72, "AR$")).toBe("AR$ 801,709,356.72");
    expect(formatMoneyDoc(4619372960.15, "AR$")).toBe("AR$ 4,619,372,960.15");
  });
});
