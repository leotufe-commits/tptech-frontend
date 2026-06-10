// src/components/sales/TotalDelComprobanteCard/__tests__/TraceTooltipBody.test.tsx
// =============================================================================
// Render del renderer genérico de trazabilidad. Verifica los 3 bloques
// (Origen · Cuenta · Impacto), los ítems y el aviso PARTIAL.
// =============================================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TraceTooltipBody } from "../parts/TraceTooltipBody";
import type { ComponentTrace } from "../traceability";

describe("TraceTooltipBody", () => {
  it("cupón COMPLETE → muestra Origen, Base, Regla e Impacto", () => {
    const trace: ComponentTrace = {
      kind: "COUPON",
      title: "Cupón",
      origin: { sourceType: "COUPON", sourceName: "CUPON" },
      base: 673289.41,
      rule: { kind: "PERCENT", value: 15 },
      impact: -100993.41,
      completeness: "COMPLETE",
    };
    render(<TraceTooltipBody trace={trace} currency="ARS" />);
    expect(screen.getByText("Origen")).toBeInTheDocument();
    expect(screen.getByText("CUPON")).toBeInTheDocument();
    expect(screen.getByText("Base")).toBeInTheDocument();
    expect(screen.getByText("Regla")).toBeInTheDocument();
    expect(screen.getByText("Impacto")).toBeInTheDocument();
    expect(screen.queryByTestId("trace-body-partial-note")).toBeNull();
  });

  it("canal PARTIAL → muestra aviso de dato parcial con el campo faltante", () => {
    const trace: ComponentTrace = {
      kind: "CHANNEL",
      title: "Sitio",
      origin: { sourceType: "CHANNEL", sourceName: "Sitio" },
      base: 626000,
      rule: { kind: "PERCENT", value: 2, label: "Ajuste (estimado)" },
      impact: 12520,
      completeness: "PARTIAL",
      missingField: "channelResult.adjustmentType + adjustmentValue",
    };
    render(<TraceTooltipBody trace={trace} currency="ARS" />);
    const note = screen.getByTestId("trace-body-partial-note");
    expect(note).toBeInTheDocument();
    // Lenguaje de operador (sin nombres técnicos del backend).
    expect(note.textContent).toMatch(/Detalle estimado/);
    expect(note.textContent).not.toMatch(/adjustmentType/);
    // El campo técnico queda solo como atributo de diagnóstico (no visible).
    expect(note.getAttribute("data-tp-missing")).toMatch(/adjustmentType/);
  });

  it("impuestos con items → renderiza cada sub-impuesto", () => {
    const trace: ComponentTrace = {
      kind: "TAXES",
      title: "Impuestos",
      origin: { sourceType: "TENANT", sourceName: "Impuestos sobre base imponible" },
      base: 100,
      impact: 30,
      items: [
        { kind: "TAXES", title: "IVA 21%", origin: { sourceType: "TENANT", sourceName: "IVA" }, base: 100, rule: { kind: "PERCENT", value: 21 }, impact: 21, completeness: "COMPLETE" },
        { kind: "TAXES", title: "Ingresos Brutos 9%", origin: { sourceType: "TENANT", sourceName: "Ingresos Brutos" }, base: 100, rule: { kind: "PERCENT", value: 9 }, impact: 9, completeness: "COMPLETE" },
      ],
      completeness: "COMPLETE",
    };
    render(<TraceTooltipBody trace={trace} currency="ARS" />);
    expect(screen.getByText("IVA 21%")).toBeInTheDocument();
    expect(screen.getByText("Ingresos Brutos 9%")).toBeInTheDocument();
  });

  it("redondeo → muestra Antes y Después", () => {
    const trace: ComponentTrace = {
      kind: "FINANCIAL_ROUNDING",
      title: "Redondeo financiero",
      origin: { sourceType: "TENANT", sourceName: "Política del tenant" },
      rule: { kind: "ROUNDING", label: "HUNDRED NEAREST" },
      preValue: 1234567.89,
      postValue: 1234600,
      impact: 32.11,
      completeness: "COMPLETE",
    };
    render(<TraceTooltipBody trace={trace} currency="ARS" />);
    expect(screen.getByText("Antes")).toBeInTheDocument();
    expect(screen.getByText("Después")).toBeInTheDocument();
  });
});
