// src/components/sales/SaleCompositionEditableGrid/__tests__/sumGroupLineSaleDisplay-prerounding.test.ts
// ============================================================================
// CONTRATO: la tabla "Composición del costo del artículo" muestra la RECETA BASE
// (PRE redondeo) y el FOOTER de cada grupo = Σ filas detalle POR CONSTRUCCIÓN
// (mismo origen de datos, cero diferencia detalle↔footer).
//
// `sumGroupLineSaleDisplay` usa por fila `lineSalePreRounding ?? lineSale` — el
// MISMO valor que la fila detalle del grid. El metal contaminado (`lineSale`
// POST = 574.331,25) NUNCA se muestra; se usa el PRE (572.343,75). El redondeo
// vive en el Resumen Comercial, no en la composición.
// ============================================================================

import { describe, it, expect } from "vitest";
import { sumGroupLineSaleDisplay } from "../helpers";

const ctx = { qtyLine: 1, marginUnattributable: false, unifiedFactor: null, canonical: null as number | null };

describe("sumGroupLineSaleDisplay — footer = Σ filas detalle (receta BASE, mismo origen)", () => {
  it("metal: usa lineSalePreRounding por fila (PRE 572.343,75), NO lineSale (POST 574.331,25)", () => {
    const metals = [{ lineCost: 400000, lineSale: 574331.25, lineSalePreRounding: 572343.75 }];
    const v = sumGroupLineSaleDisplay(metals, ctx);
    expect(v).toBe(572343.75);          // PRE
    expect(v).not.toBe(574331.25);      // NO el POST contaminado
  });

  it("multi-metal: footer = Σ lineSalePreRounding (= mismo valor que suma el detalle)", () => {
    const metals = [
      { lineCost: 300000, lineSale: 430748.4375, lineSalePreRounding: 429257.8125 },
      { lineCost: 100000, lineSale: 143582.8125, lineSalePreRounding: 143085.9375 },
    ];
    // PRE: 429257.8125 + 143085.9375 = 572343.75  (POST sumaría 574331.25)
    expect(sumGroupLineSaleDisplay(metals, ctx)).toBeCloseTo(572343.75, 4);
  });

  it("sin lineSalePreRounding → cae a lineSale (hechura/productos/servicios = margen, ya PRE)", () => {
    const hechuras = [{ lineCost: 90000, lineSale: 175755.55 }];
    expect(sumGroupLineSaleDisplay(hechuras, ctx)).toBe(175755.55);
  });

  it("qty > 1: escala × qty igual que la fila detalle", () => {
    const metals = [{ lineCost: 100, lineSale: 120, lineSalePreRounding: 110 }];
    expect(sumGroupLineSaleDisplay(metals, { ...ctx, qtyLine: 2 })).toBe(220);  // 110 × 2 (PRE), no 240
  });
});
