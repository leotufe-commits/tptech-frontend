// src/lib/pricing/__tests__/g4-11d-cost-line-overrides-patch.test.ts
// =============================================================================
// FASE F1.4 G5 #11-D — patchCostLineOverride helper.
//
// Cubre el contrato del helper que reconstruye el array de overrides al
// editar una celda de la tabla ERP.
//
// Reglas:
//   · Indexación por costLineId — NUNCA por índice visual.
//   · Cero mutación — devuelve array nuevo.
//   · undefined en patch → no toca el campo.
//   · null en adjustment* → semántica "limpiar ajuste" (preservada en merge).
//   · null en quantity/unitValue/merma → tratado igual que valor numérico
//     null (el backend lo interpreta como "sin override" después).
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  patchCostLineOverride,
  findCostLineOverride,
} from "../cost-line-overrides";
import type { CostLineOverride } from "../../../services/sales";

// =============================================================================
// 1. Array vacío / undefined
// =============================================================================

describe("F1.4 #11-D — patchCostLineOverride: array inicial vacío", () => {
  it("baseline correct: undefined inicial → array con 1 entry nueva", () => {
    const r = patchCostLineOverride(undefined, "cl-m1", "METAL", { quantityOverride: 5 });
    expect(r).toHaveLength(1);
    expect(r[0]).toEqual({ costLineId: "cl-m1", type: "METAL", quantityOverride: 5 });
  });

  it("baseline correct: array vacío → array con 1 entry nueva", () => {
    const r = patchCostLineOverride([], "cl-h1", "HECHURA", { unitValueOverride: 200 });
    expect(r).toHaveLength(1);
    expect(r[0]).toEqual({ costLineId: "cl-h1", type: "HECHURA", unitValueOverride: 200 });
  });
});

// =============================================================================
// 2. Edición de entry existente
// =============================================================================

describe("F1.4 #11-D — patchCostLineOverride: merge sobre entry existente", () => {
  it("baseline correct: edita campo existente sin tocar otros", () => {
    const init: CostLineOverride[] = [
      { costLineId: "cl-m1", type: "METAL", quantityOverride: 5, mermaPercentOverride: 10 },
    ];
    const r = patchCostLineOverride(init, "cl-m1", "METAL", { quantityOverride: 7 });
    expect(r).toHaveLength(1);
    expect(r[0].quantityOverride).toBe(7);
    expect(r[0].mermaPercentOverride).toBe(10);     // preservado
  });

  it("baseline correct: undefined en patch NO sobreescribe el campo existente", () => {
    const init: CostLineOverride[] = [
      { costLineId: "cl-m1", type: "METAL", quantityOverride: 5 },
    ];
    const r = patchCostLineOverride(init, "cl-m1", "METAL", { /* sin quantityOverride */ });
    expect(r[0].quantityOverride).toBe(5);
  });

  it("baseline correct: null en adjustmentKind LIMPIA el ajuste (preserva null)", () => {
    const init: CostLineOverride[] = [
      { costLineId: "cl-h1", type: "HECHURA", adjustmentKind: "BONUS", adjustmentValue: 10 },
    ];
    const r = patchCostLineOverride(init, "cl-h1", "HECHURA", {
      adjustmentKind: null, adjustmentType: null, adjustmentValue: null,
    });
    expect(r[0].adjustmentKind).toBeNull();
    expect(r[0].adjustmentType).toBeNull();
    expect(r[0].adjustmentValue).toBeNull();
  });
});

// =============================================================================
// 3. Múltiples entries — caso crítico 2 metales
// =============================================================================

describe("F1.4 #11-D — múltiples entries: caso crítico 2 metales", () => {
  it("baseline correct: editar cl-m2 NO afecta cl-m1", () => {
    const init: CostLineOverride[] = [
      { costLineId: "cl-m1", type: "METAL", quantityOverride: 1 },
    ];
    const r = patchCostLineOverride(init, "cl-m2", "METAL", { quantityOverride: 5 });
    expect(r).toHaveLength(2);
    expect(r.find(o => o.costLineId === "cl-m1")?.quantityOverride).toBe(1);   // intacto
    expect(r.find(o => o.costLineId === "cl-m2")?.quantityOverride).toBe(5);   // nuevo
  });

  it("baseline correct: editar cl-m2 luego cl-m1 → ambas entries con valores correctos", () => {
    let arr: CostLineOverride[] = [];
    arr = patchCostLineOverride(arr, "cl-m1", "METAL", { quantityOverride: 1.5 });
    arr = patchCostLineOverride(arr, "cl-m2", "METAL", { quantityOverride: 0.8 });
    expect(arr).toHaveLength(2);
    expect(arr[0].costLineId).toBe("cl-m1");
    expect(arr[1].costLineId).toBe("cl-m2");
  });

  it("baseline correct: re-editar cl-m1 mantiene posición en el array", () => {
    let arr: CostLineOverride[] = [
      { costLineId: "cl-m1", type: "METAL", quantityOverride: 1 },
      { costLineId: "cl-m2", type: "METAL", quantityOverride: 2 },
    ];
    arr = patchCostLineOverride(arr, "cl-m1", "METAL", { quantityOverride: 99 });
    expect(arr).toHaveLength(2);
    expect(arr[0].costLineId).toBe("cl-m1");   // mismo orden
    expect(arr[0].quantityOverride).toBe(99);
    expect(arr[1].costLineId).toBe("cl-m2");
  });
});

// =============================================================================
// 4. Cero mutación
// =============================================================================

describe("F1.4 #11-D — cero mutación del input", () => {
  it("baseline correct: el helper devuelve array NUEVO (no muta input)", () => {
    const init: CostLineOverride[] = [
      { costLineId: "cl-m1", type: "METAL", quantityOverride: 5 },
    ];
    const before = JSON.stringify(init);
    const r = patchCostLineOverride(init, "cl-m1", "METAL", { quantityOverride: 99 });
    expect(r).not.toBe(init);
    expect(JSON.stringify(init)).toBe(before);
  });
});

// =============================================================================
// 5. findCostLineOverride
// =============================================================================

describe("F1.4 #11-D — findCostLineOverride", () => {
  it("baseline correct: encuentra entry por costLineId", () => {
    const arr: CostLineOverride[] = [
      { costLineId: "cl-m1", type: "METAL", quantityOverride: 5 },
      { costLineId: "cl-h1", type: "HECHURA", unitValueOverride: 200 },
    ];
    expect(findCostLineOverride(arr, "cl-m1")?.quantityOverride).toBe(5);
    expect(findCostLineOverride(arr, "cl-h1")?.unitValueOverride).toBe(200);
  });

  it("baseline correct: undefined cuando no existe", () => {
    expect(findCostLineOverride([], "cl-x")).toBeUndefined();
    expect(findCostLineOverride(undefined, "cl-x")).toBeUndefined();
  });
});

// =============================================================================
// 6. Casos por tipo de cost line
// =============================================================================

describe("F1.4 #11-D — patches por tipo", () => {
  it("baseline correct: METAL — quantityOverride", () => {
    const r = patchCostLineOverride([], "cl-m1", "METAL", { quantityOverride: 5 });
    expect(r[0]).toEqual({ costLineId: "cl-m1", type: "METAL", quantityOverride: 5 });
  });

  it("baseline correct: METAL — mermaPercentOverride", () => {
    const r = patchCostLineOverride([], "cl-m1", "METAL", { mermaPercentOverride: 8 });
    expect(r[0].mermaPercentOverride).toBe(8);
  });

  it("baseline correct: HECHURA — unitValueOverride", () => {
    const r = patchCostLineOverride([], "cl-h1", "HECHURA", { unitValueOverride: 250 });
    expect(r[0].unitValueOverride).toBe(250);
  });

  it("baseline correct: PRODUCT — quantityOverride + unitValueOverride combinables", () => {
    let arr: CostLineOverride[] = [];
    arr = patchCostLineOverride(arr, "cl-p1", "PRODUCT", { quantityOverride: 3 });
    arr = patchCostLineOverride(arr, "cl-p1", "PRODUCT", { unitValueOverride: 80 });
    expect(arr).toHaveLength(1);
    expect(arr[0].quantityOverride).toBe(3);
    expect(arr[0].unitValueOverride).toBe(80);
  });

  it("baseline correct: SERVICE — adjustment full set", () => {
    const r = patchCostLineOverride([], "cl-s1", "SERVICE", {
      adjustmentKind: "BONUS", adjustmentType: "PERCENTAGE", adjustmentValue: 10,
    });
    expect(r[0]).toMatchObject({
      costLineId: "cl-s1", type: "SERVICE",
      adjustmentKind: "BONUS", adjustmentType: "PERCENTAGE", adjustmentValue: 10,
    });
  });
});

// =============================================================================
// 7. Roundtrip — find después de patch
// =============================================================================

describe("F1.4 #11-D — roundtrip find ↔ patch", () => {
  it("baseline correct: patch → find devuelve la entry", () => {
    const arr = patchCostLineOverride(undefined, "cl-x", "PRODUCT", { quantityOverride: 7 });
    const found = findCostLineOverride(arr, "cl-x");
    expect(found?.quantityOverride).toBe(7);
  });

  it("baseline correct: lookup O(1) por costLineId — patrón Map listo para tabla", () => {
    const arr: CostLineOverride[] = [
      { costLineId: "cl-m1", type: "METAL",   quantityOverride: 1 },
      { costLineId: "cl-h1", type: "HECHURA", unitValueOverride: 200 },
      { costLineId: "cl-p1", type: "PRODUCT", quantityOverride: 3 },
    ];
    const map = new Map(arr.map(o => [o.costLineId, o]));
    expect(map.get("cl-m1")?.quantityOverride).toBe(1);
    expect(map.get("cl-h1")?.unitValueOverride).toBe(200);
    expect(map.get("cl-p1")?.quantityOverride).toBe(3);
  });
});
