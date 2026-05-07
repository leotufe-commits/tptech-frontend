// src/lib/pricing/__tests__/g4-10a-grouping.test.ts
// =============================================================================
// FASE F1.3 G4.x #10-A — tests del helper puro `groupCompositionItems`.
//
// Cubre TODAS las decisiones del usuario:
//   1. METAL agrupado por metalVariantId; orden de primera aparición.
//   2. METAL con mermas iguales → number compartido.
//   3. METAL con mermas distintas → VARIES (centinela).
//   4. METAL con 1 item → isEditableInline=true.
//   5. METAL con 2+ items → isEditableInline=false.
//   6. HECHURA NO agrupada — lista plana + agregado.
//   7. PRODUCT/SERVICE NO agrupados — lista plana + agregado.
//   8. Sumas Decimal-safe (sin float drift).
//   9. Cero matemática derivada — passthrough estructural.
//  10. Cero JSX, cero formateo, cero i18n (validación contractual).
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  groupCompositionItems,
  safeSumNumbers,
  VARIES,
  type GroupingMetalInput,
  type GroupingHechuraInput,
  type GroupingProductServiceInput,
} from "../grouping";

// ── Helpers ──────────────────────────────────────────────────────────────────

function metal(overrides: Partial<GroupingMetalInput>): GroupingMetalInput {
  return {
    costLineId:      null,
    metalVariantId:  null,
    metalName:       null,
    purity:          null,
    purityLabel:     null,
    appliedGrams:    null,
    appliedMermaPct: null,
    lineCost:        null,
    ...overrides,
  };
}

function hechura(overrides: Partial<GroupingHechuraInput>): GroupingHechuraInput {
  return {
    costLineId:    null,
    appliedAmount: null,
    lineCost:      null,
    lineLabel:     null,
    ...overrides,
  };
}

function ps(overrides: Partial<GroupingProductServiceInput>): GroupingProductServiceInput {
  return {
    costLineId: null,
    totalValue: 0,
    ...overrides,
  };
}

// =============================================================================
// 1. METAL — agrupación por metalVariantId
// =============================================================================

describe("F1.3 #10-A — METAL agrupación por metalVariantId", () => {
  it("baseline correct: 2 lines mismo metalVariantId → 1 grupo con count=2", () => {
    const r = groupCompositionItems({
      metals: [
        metal({ costLineId: "cl-1", metalVariantId: "mv-oro18k", metalName: "Oro",
                purity: 0.75, purityLabel: "18k", appliedGrams: 1.50,
                appliedMermaPct: 5, lineCost: 600 }),
        metal({ costLineId: "cl-2", metalVariantId: "mv-oro18k", metalName: "Oro",
                purity: 0.75, purityLabel: "18k", appliedGrams: 0.80,
                appliedMermaPct: 5, lineCost: 320 }),
      ],
    });
    expect(r.metals).toHaveLength(1);
    expect(r.metals[0].count).toBe(2);
    expect(r.metals[0].groupKey).toBe("mv-oro18k");
    expect(r.metals[0].metalName).toBe("Oro");
    expect(r.metals[0].totalAppliedGrams).toBeCloseTo(2.30, 6);
    expect(r.metals[0].totalLineCost).toBeCloseTo(920, 6);
    expect(r.metals[0].items).toHaveLength(2);
  });

  it("baseline correct: 2 metalVariantId distintos → 2 grupos (orden primera aparición)", () => {
    const r = groupCompositionItems({
      metals: [
        metal({ metalVariantId: "mv-plata", metalName: "Plata", appliedGrams: 0.50, lineCost: 100 }),
        metal({ metalVariantId: "mv-oro",   metalName: "Oro",   appliedGrams: 1.50, lineCost: 600 }),
        metal({ metalVariantId: "mv-plata", metalName: "Plata", appliedGrams: 0.30, lineCost: 60 }),
      ],
    });
    expect(r.metals).toHaveLength(2);
    // Primer grupo: Plata (apareció primero).
    expect(r.metals[0].groupKey).toBe("mv-plata");
    expect(r.metals[0].count).toBe(2);
    expect(r.metals[0].totalAppliedGrams).toBeCloseTo(0.80, 6);
    // Segundo grupo: Oro.
    expect(r.metals[1].groupKey).toBe("mv-oro");
    expect(r.metals[1].count).toBe(1);
  });

  it("baseline correct: metalVariantId null → groupKey '__unknown__'", () => {
    const r = groupCompositionItems({
      metals: [
        metal({ metalVariantId: null, appliedGrams: 1, lineCost: 100 }),
        metal({ metalVariantId: null, appliedGrams: 2, lineCost: 200 }),
      ],
    });
    expect(r.metals).toHaveLength(1);
    expect(r.metals[0].groupKey).toBe("__unknown__");
    expect(r.metals[0].count).toBe(2);
  });
});

// =============================================================================
// 2. METAL — appliedMermaPct VARIES vs compartida
// =============================================================================

describe("F1.3 #10-A — appliedMermaPct compartida vs VARIES", () => {
  it("baseline correct: misma merma en todas las lines → number compartido", () => {
    const r = groupCompositionItems({
      metals: [
        metal({ metalVariantId: "mv-1", appliedMermaPct: 5 }),
        metal({ metalVariantId: "mv-1", appliedMermaPct: 5 }),
      ],
    });
    expect(r.metals[0].appliedMermaPct).toBe(5);
  });

  it("baseline correct: mermas distintas → VARIES (centinela)", () => {
    const r = groupCompositionItems({
      metals: [
        metal({ metalVariantId: "mv-1", appliedMermaPct: 5 }),
        metal({ metalVariantId: "mv-1", appliedMermaPct: 3 }),
      ],
    });
    expect(r.metals[0].appliedMermaPct).toBe(VARIES);
    expect(VARIES).toBe("varies");
  });

  it("baseline correct: todas null → null (no es VARIES)", () => {
    const r = groupCompositionItems({
      metals: [
        metal({ metalVariantId: "mv-1", appliedMermaPct: null }),
        metal({ metalVariantId: "mv-1", appliedMermaPct: null }),
      ],
    });
    expect(r.metals[0].appliedMermaPct).toBeNull();
  });

  it("baseline correct: mix null + valor → toma el valor (null se ignora, NO marca VARIES)", () => {
    const r = groupCompositionItems({
      metals: [
        metal({ metalVariantId: "mv-1", appliedMermaPct: null }),
        metal({ metalVariantId: "mv-1", appliedMermaPct: 5 }),
      ],
    });
    expect(r.metals[0].appliedMermaPct).toBe(5);
  });
});

// =============================================================================
// 3. isEditableInline — count===1 vs count>=2
// =============================================================================

describe("F1.3 #10-A — isEditableInline (D1: edit solo cuando 1 line)", () => {
  it("baseline correct: count === 1 → isEditableInline = true", () => {
    const r = groupCompositionItems({
      metals: [metal({ metalVariantId: "mv-1", appliedGrams: 1, lineCost: 100 })],
    });
    expect(r.metals[0].isEditableInline).toBe(true);
  });

  it("baseline correct: count >= 2 → isEditableInline = false", () => {
    const r = groupCompositionItems({
      metals: [
        metal({ metalVariantId: "mv-1", appliedGrams: 1 }),
        metal({ metalVariantId: "mv-1", appliedGrams: 2 }),
      ],
    });
    expect(r.metals[0].isEditableInline).toBe(false);
  });
});

// =============================================================================
// 4. HECHURA — NO agrupada, lista plana + agregado
// =============================================================================

describe("F1.3 #10-A — HECHURA NO se agrupa (decisión usuario)", () => {
  it("baseline correct: 2 hechuras → lista plana de 2 items + agregado", () => {
    const r = groupCompositionItems({
      hechuras: [
        hechura({ costLineId: "cl-h1", appliedAmount: 200, lineCost: 200, lineLabel: "Mano de obra" }),
        hechura({ costLineId: "cl-h2", appliedAmount: 150, lineCost: 150, lineLabel: "Pulido" }),
      ],
    });
    expect(r.hechuras).toHaveLength(2);
    expect(r.hechuras[0].lineLabel).toBe("Mano de obra");
    expect(r.hechuras[1].lineLabel).toBe("Pulido");
    expect(r.hechurasAggregate.count).toBe(2);
    expect(r.hechurasAggregate.totalLineCost).toBeCloseTo(350, 6);
  });

  it("baseline correct: 0 hechuras → lista vacía + agregado count=0, total=null", () => {
    const r = groupCompositionItems({});
    expect(r.hechuras).toEqual([]);
    expect(r.hechurasAggregate.count).toBe(0);
    expect(r.hechurasAggregate.totalLineCost).toBeNull();
  });

  it("baseline correct: NO agrupa por lineLabel (regla del usuario)", () => {
    // Dos hechuras con MISMO lineLabel — NO deben colapsarse.
    const r = groupCompositionItems({
      hechuras: [
        hechura({ costLineId: "cl-1", appliedAmount: 100, lineCost: 100, lineLabel: "Mano de obra" }),
        hechura({ costLineId: "cl-2", appliedAmount: 200, lineCost: 200, lineLabel: "Mano de obra" }),
      ],
    });
    expect(r.hechuras).toHaveLength(2);
    expect(r.hechurasAggregate.count).toBe(2);
  });
});

// =============================================================================
// 5. PRODUCT / SERVICE — NO agrupados, lista plana + agregado
// =============================================================================

describe("F1.3 #10-A — PRODUCT / SERVICE no se agrupan", () => {
  it("baseline correct: 2 products → lista plana + agregado totalValue", () => {
    const r = groupCompositionItems({
      products: [
        ps({ costLineId: "cl-p1", totalValue: 100 }),
        ps({ costLineId: "cl-p2", totalValue: 80 }),
      ],
    });
    expect(r.products).toHaveLength(2);
    expect(r.productsAggregate.count).toBe(2);
    expect(r.productsAggregate.totalValue).toBeCloseTo(180, 6);
  });

  it("baseline correct: services agregado idéntico a products", () => {
    const r = groupCompositionItems({
      services: [
        ps({ costLineId: "cl-s1", totalValue: 50 }),
        ps({ costLineId: "cl-s2", totalValue: 70 }),
      ],
    });
    expect(r.services).toHaveLength(2);
    expect(r.servicesAggregate.totalValue).toBeCloseTo(120, 6);
  });

  it("baseline correct: ningún product/service → arrays [] y agregados null", () => {
    const r = groupCompositionItems({});
    expect(r.products).toEqual([]);
    expect(r.services).toEqual([]);
    expect(r.productsAggregate.totalValue).toBeNull();
    expect(r.servicesAggregate.totalValue).toBeNull();
  });
});

// =============================================================================
// 6. Decimal safety — sumas SIN drift de float
// =============================================================================

describe("F1.3 #10-A — safeSumNumbers Decimal-safe", () => {
  it("baseline correct: 0.1 + 0.2 = 0.3 exacto (sin 0.30000000000000004)", () => {
    expect(safeSumNumbers([0.1, 0.2])).toBe(0.3);
  });

  it("baseline correct: 0.1 + 0.2 + 0.3 = 0.6 exacto", () => {
    expect(safeSumNumbers([0.1, 0.2, 0.3])).toBe(0.6);
  });

  it("baseline correct: ningún valor finito → null (no 0)", () => {
    expect(safeSumNumbers([null, undefined, NaN])).toBeNull();
    expect(safeSumNumbers([])).toBeNull();
  });

  it("baseline correct: mix null + finitos → suma solo los finitos", () => {
    expect(safeSumNumbers([null, 1.5, undefined, 2.5, NaN])).toBe(4);
  });

  it("baseline correct: gramos típicos (1.30 + 1.50 + 0.80 = 3.60)", () => {
    expect(safeSumNumbers([1.30, 1.50, 0.80])).toBe(3.60);
  });

  it("baseline correct: totales monetarios (100.50 + 200.30 = 300.80)", () => {
    expect(safeSumNumbers([100.50, 200.30])).toBe(300.80);
  });

  it("baseline correct: 100 valores con drift → suma exacta", () => {
    const vals = Array.from({ length: 100 }, () => 0.01);
    expect(safeSumNumbers(vals)).toBe(1.0);
  });
});

// =============================================================================
// 7. Mix completo — orden visual fijo (METAL → HECHURA → PRODUCT → SERVICE)
// =============================================================================

describe("F1.3 #10-A — mix completo + grupos vacíos preservan estructura", () => {
  it("baseline correct: input completo → output con todos los buckets", () => {
    const r = groupCompositionItems({
      metals: [metal({ metalVariantId: "mv-1", appliedGrams: 1, lineCost: 100 })],
      hechuras: [hechura({ appliedAmount: 50, lineCost: 50 })],
      products: [ps({ totalValue: 30 })],
      services: [ps({ totalValue: 20 })],
    });
    expect(r.metals).toHaveLength(1);
    expect(r.hechuras).toHaveLength(1);
    expect(r.products).toHaveLength(1);
    expect(r.services).toHaveLength(1);
  });

  it("baseline correct: input vacío → todos los buckets [] / aggregates null", () => {
    const r = groupCompositionItems({});
    expect(r.metals).toEqual([]);
    expect(r.hechuras).toEqual([]);
    expect(r.products).toEqual([]);
    expect(r.services).toEqual([]);
    expect(r.hechurasAggregate.count).toBe(0);
    expect(r.hechurasAggregate.totalLineCost).toBeNull();
    expect(r.productsAggregate.count).toBe(0);
    expect(r.servicesAggregate.count).toBe(0);
  });

  it("baseline correct: undefined inputs → trato como vacío", () => {
    const r = groupCompositionItems({
      metals:   undefined,
      hechuras: undefined,
      products: undefined,
      services: undefined,
    });
    expect(r.metals).toEqual([]);
    expect(r.hechuras).toEqual([]);
    expect(r.products).toEqual([]);
    expect(r.services).toEqual([]);
  });
});

// =============================================================================
// 8. Reader-only contractual — items por referencia, sin mutación
// =============================================================================

describe("F1.3 #10-A — passthrough estructural sin mutación", () => {
  it("baseline correct: items.* es referencia al objeto original (no copia)", () => {
    const item1 = metal({ costLineId: "cl-1", metalVariantId: "mv-1", appliedGrams: 1 });
    const r = groupCompositionItems({ metals: [item1] });
    expect(r.metals[0].items[0]).toBe(item1);
  });

  it("baseline correct: el helper NO muta el input", () => {
    const inputMetals = [metal({ metalVariantId: "mv-1", appliedGrams: 1.5 })];
    const beforeJSON = JSON.stringify(inputMetals);
    groupCompositionItems({ metals: inputMetals });
    expect(JSON.stringify(inputMetals)).toBe(beforeJSON);
  });
});
