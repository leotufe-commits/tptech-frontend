// src/components/sales/SaleCompositionEditableGrid/__tests__/comboAdjustmentToCostAdjustmentData.test.ts
// ============================================================================
// El bloque ÚNICO "AJUSTE GLOBAL" (CostAdjustmentDetailSection) muestra el ajuste:
//   · Artículos NORMALES → `composition.costAdjustment` (manualAdjustment*).
//   · COMBO COMERCIAL    → `comboAdjustment*`, mapeado a ese MISMO shape por esta
//     función. Una sola superficie visual, sin tarjeta nueva.
//
// El mapeo NO calcula montos: `amount=null` (el monto en pesos del ajuste del
// combo no llega al frontend; el precio del input ya viene post-ajuste del motor).
// ============================================================================

import { describe, it, expect } from "vitest";
import { comboAdjustmentToCostAdjustmentData } from "../helpers";

describe("comboAdjustmentToCostAdjustmentData — combo → shape de AJUSTE GLOBAL", () => {
  it("DISCOUNT_PERCENT 10 → Bonificación %, sin monto (caso real ART-0004)", () => {
    expect(comboAdjustmentToCostAdjustmentData("DISCOUNT_PERCENT", 10)).toEqual({
      kind: "BONUS", type: "PERCENTAGE", value: 10, amount: null,
    });
  });
  it("SURCHARGE_PERCENT 15 → Recargo %", () => {
    expect(comboAdjustmentToCostAdjustmentData("SURCHARGE_PERCENT", 15)).toEqual({
      kind: "SURCHARGE", type: "PERCENTAGE", value: 15, amount: null,
    });
  });
  it("DISCOUNT_FIXED 500 → Bonificación monto fijo", () => {
    expect(comboAdjustmentToCostAdjustmentData("DISCOUNT_FIXED", 500)).toEqual({
      kind: "BONUS", type: "FIXED_AMOUNT", value: 500, amount: null,
    });
  });
  it("NONE → null (no renderea el bloque)", () => {
    expect(comboAdjustmentToCostAdjustmentData("NONE", null)).toBeNull();
    expect(comboAdjustmentToCostAdjustmentData("NONE", 10)).toBeNull();
  });
  it("sin valor → null (no inventa)", () => {
    expect(comboAdjustmentToCostAdjustmentData("DISCOUNT_PERCENT", null)).toBeNull();
    expect(comboAdjustmentToCostAdjustmentData(null, 10)).toBeNull();
    expect(comboAdjustmentToCostAdjustmentData(undefined, undefined)).toBeNull();
  });
});
