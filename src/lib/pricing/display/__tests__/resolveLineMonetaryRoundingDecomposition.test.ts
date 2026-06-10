// src/lib/pricing/display/__tests__/resolveLineMonetaryRoundingDecomposition.test.ts
// =============================================================================
// REGLA Lista Unificada — descomposición del MONETARIO en el detalle expandido:
//
//   Valor comercial (Y) → Redondeo comercial (Z) → Valor redondeado (X)
//   con  Y + Z = X.
//
//   · UNIFICADA (MARGIN_TOTAL / FINAL_PRICE): Z = redondeo del SALDO MONETARIO
//     (`hechuraRoundingMonetaryImpact` ≡ `saldoPost − saldoPre`). NUNCA
//     `totalPost − totalPre` (eso incluye `metalRoundingMonetaryImpact`, que es
//     redondeo del METAL, otro dominio). El helper recibe `unificadoImpact` ya
//     resuelto por el caller → estructuralmente NO puede mezclar el metal.
//   · DESGLOSADA: Z = `desglosadoImpact` (passthrough del caller). Intacto.
// =============================================================================

import { describe, it, expect } from "vitest";
import { resolveLineMonetaryRoundingDecomposition } from "../saleCompositionDisplay";

describe("resolveLineMonetaryRoundingDecomposition — Lista Unificada", () => {
  it("1) caso real: monetario 242.356,25 · redondeo saldo 19,86 ⇒ Y 242.336,39 / Z +19,86 / X 242.356,25", () => {
    const d = resolveLineMonetaryRoundingDecomposition({
      isLineDesglosada: false,
      monetarioFinal:   242_356.25,
      unificadoImpact:  19.86,        // hechuraRoundingMonetaryImpact (= saldoPost − saldoPre)
      desglosadoImpact: 0,
    });
    expect(d).not.toBeNull();
    expect(d!.redondeo).toBeCloseTo(19.86, 6);             // Z = redondeo del saldo
    expect(d!.valorComercial).toBeCloseTo(242_336.39, 6);  // Y = X − Z
    expect(d!.valorRedondeado).toBe(242_356.25);           // X
    expect(d!.valorComercial + d!.redondeo).toBeCloseTo(242_356.25, 6);
  });

  it("2) modelo chico: monetario 5,50 · redondeo saldo 0,25 ⇒ Y 5,25 / Z +0,25 / X 5,50", () => {
    const d = resolveLineMonetaryRoundingDecomposition({
      isLineDesglosada: false, monetarioFinal: 5.5, unificadoImpact: 0.25, desglosadoImpact: 0,
    });
    expect(d!.valorComercial).toBeCloseTo(5.25, 6);
    expect(d!.redondeo).toBeCloseTo(0.25, 6);
    expect(d!.valorRedondeado).toBe(5.5);
  });

  it("3) NO mezcla el metal: con redondeo de saldo 19,86, Z NO es 1.212,50 (metal) ni 1.232,36 (total)", () => {
    // El helper solo recibe `unificadoImpact` (redondeo del saldo). No conoce el
    // total ni el metalImpact → estructuralmente no puede mostrar 1.212,50/1.232,36.
    const d = resolveLineMonetaryRoundingDecomposition({
      isLineDesglosada: false, monetarioFinal: 242_356.25, unificadoImpact: 19.86, desglosadoImpact: 0,
    });
    expect(d!.redondeo).toBe(19.86);
    expect(d!.redondeo).not.toBe(1_212.5);     // metalRoundingMonetaryImpact
    expect(d!.redondeo).not.toBe(1_232.36);    // totalPost − totalPre
  });

  it("3b) sin redondeo de saldo (impact ~0) ⇒ null (no se muestra el detalle)", () => {
    expect(resolveLineMonetaryRoundingDecomposition({
      isLineDesglosada: false, monetarioFinal: 242_356.25, unificadoImpact: 0, desglosadoImpact: 1_212.5,
    })).toBeNull();
  });
});

describe("resolveLineMonetaryRoundingDecomposition — Lista Desglosada (intacta)", () => {
  it("4) usa el desglosadoImpact del caller: 24,79 ⇒ Y 185.475,21 / Z 24,79 / X 185.500", () => {
    const d = resolveLineMonetaryRoundingDecomposition({
      isLineDesglosada: true,
      monetarioFinal:   185_500,
      unificadoImpact:  999,          // NO debe usarse en desglosada
      desglosadoImpact: 24.79,
    });
    expect(d!.redondeo).toBe(24.79);                         // Z = desglosadoImpact (NO 999)
    expect(d!.valorComercial).toBeCloseTo(185_475.21, 6);    // Y = X − Z
    expect(d!.valorRedondeado).toBe(185_500);                // X
  });

  it("4b) Desglosada con impacto ~0 ⇒ null", () => {
    expect(resolveLineMonetaryRoundingDecomposition({
      isLineDesglosada: true, monetarioFinal: 185_500, unificadoImpact: 0, desglosadoImpact: 0,
    })).toBeNull();
  });
});
