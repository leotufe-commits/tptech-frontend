// src/components/ui/__tests__/base-tables-format.test.tsx
// Las tablas base reciben contenido ya formateado por el caller; el único
// cell renderer compartido que formatea dinero es TPBalanceCell → debe
// respetar la región del tenant. (TPTable/TPTableKit/TPTreeTable/TPTotalCell/
// TPKpiBar no formatean números: passthrough — sin assertions numéricas.)
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TPBalanceCell } from "../TPBalanceCell";
import {
  setActiveNumberFormatConfig,
  DEFAULT_NUMBER_FORMAT_CONFIG,
  type NumberFormatConfig,
} from "../../../lib/number-format";

const US: NumberFormatConfig = { region: "US", custom: { thousands: ".", decimal: "," }, presets: {} };
afterEach(() => setActiveNumberFormatConfig(DEFAULT_NUMBER_FORMAT_CONFIG));

describe("TPBalanceCell — respeta la región del tenant", () => {
  it("Argentina: AR$ 801.709.356,72", () => {
    render(<TPBalanceCell value={801709356.72} currency="AR$" />);
    expect(screen.getByText("AR$ 801.709.356,72")).toBeTruthy();
  });
  it("USA: AR$ 801,709,356.72", () => {
    setActiveNumberFormatConfig(US);
    render(<TPBalanceCell value={801709356.72} currency="AR$" />);
    expect(screen.getByText("AR$ 801,709,356.72")).toBeTruthy();
  });
  it("cero → zeroDisplay (no formatea)", () => {
    render(<TPBalanceCell value={0} currency="AR$" zeroDisplay="—" />);
    expect(screen.getByText("—")).toBeTruthy();
  });
});
