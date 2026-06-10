// src/components/sales/TotalDelComprobanteCard/__tests__/sumLineCommercialMonetaryRoundingImpact.test.ts
// ============================================================================
// Tests del helper PURO `sumLineCommercialMonetaryRoundingImpact` — Σ del
// impacto del redondeo comercial MONETARIO por línea
// (`lineCommercialSummary.monetary.roundingImpact`). Passthrough (Σ), sin
// matemática comercial.
// ============================================================================

import { describe, it, expect } from "vitest";
import { sumLineCommercialMonetaryRoundingImpact } from "../helpers";

const lineWith = (roundingImpact: number | null, amount = 100) => ({
  lineCommercialSummary: { monetary: { amount, roundingImpact } },
});

describe("sumLineCommercialMonetaryRoundingImpact", () => {
  it("suma el impacto de las líneas (positivo)", () => {
    const r = sumLineCommercialMonetaryRoundingImpact([lineWith(0.7), lineWith(0.3)]);
    expect(r).toBe(1.0);
  });

  it("preserva impacto negativo", () => {
    const r = sumLineCommercialMonetaryRoundingImpact([lineWith(-1.2)]);
    expect(r).toBe(-1.2);
  });

  it("lista UNIFICADA (roundingImpact = 0) → Σ = 0", () => {
    const r = sumLineCommercialMonetaryRoundingImpact([lineWith(0), lineWith(0)]);
    expect(r).toBe(0);
  });

  it("lee también desde pricingMeta.lineCommercialSummary (draft)", () => {
    const r = sumLineCommercialMonetaryRoundingImpact([
      { pricingMeta: { lineCommercialSummary: { monetary: { amount: 50, roundingImpact: 0.45 } } } },
    ]);
    expect(r).toBe(0.45);
  });

  it("devuelve null cuando ninguna línea trae el contrato (back-compat)", () => {
    const r = sumLineCommercialMonetaryRoundingImpact([{ foo: 1 }, null, "x"]);
    expect(r).toBeNull();
  });

  it("ignora valores no finitos pero cuenta los válidos", () => {
    const r = sumLineCommercialMonetaryRoundingImpact([
      lineWith(NaN as unknown as number),
      lineWith(0.7),
    ]);
    expect(r).toBe(0.7);
  });

  it("no es array → null", () => {
    expect(sumLineCommercialMonetaryRoundingImpact(undefined as unknown as [])).toBeNull();
  });
});
