// src/lib/pricing/display/__tests__/lineHechuraUnified.test.ts
// ============================================================================
// T13 — `buildLineHechuraSaleUnified` produce el HECHURA TOTAL unificado de
// una línea de venta (paridad con el card HECHURA del Simulador).
//
// Reglas que fija este archivo:
//   · subtotal hechura = hechuraSale per-unit × qty.
//   · + Σ products.totalValue (composition.products[].totalValue, scope línea).
//   · + Σ services.totalValue (composition.services[].totalValue, scope línea).
//   · + impuesto imputado a hechura:
//        - applyOn=HECHURA → 100% al hechura.
//        - applyOn=METAL   → 0% al hechura.
//        - applyOn=TOTAL   → proporcional a hechuraSubtotal / (metal + hechura).
//   · Cero matemática nueva: agregaciones puras de bases ya emitidas por el
//     motor (passthrough estricto — POLICY R6).
// ============================================================================

import { describe, it, expect } from "vitest";
import { buildLineHechuraSaleUnified } from "../saleCompositionDisplay";

describe("buildLineHechuraSaleUnified", () => {
  it("solo subtotal hechura (sin productos/servicios/impuestos)", () => {
    const r = buildLineHechuraSaleUnified({
      metalSaleUnit:   null,
      hechuraSaleUnit: 40,
      quantity:        2,
    });
    expect(r.hechuraSubtotal).toBe(80);
    expect(r.productsTotal).toBe(0);
    expect(r.servicesTotal).toBe(0);
    expect(r.taxOnHechura).toBe(0);
    expect(r.total).toBe(80);
  });

  it("suma productos y servicios (totalValue scope línea)", () => {
    const r = buildLineHechuraSaleUnified({
      metalSaleUnit:   100,
      hechuraSaleUnit: 40,
      quantity:        1,
      products: [
        { totalValue: 50 },
        { totalValue: 30 },
      ],
      services: [{ totalValue: 12 }],
    });
    expect(r.productsTotal).toBe(80);
    expect(r.servicesTotal).toBe(12);
    expect(r.total).toBe(40 + 80 + 12);
  });

  it("impuesto applyOn=TOTAL se reparte proporcional a las bases", () => {
    // metalSub=100, hechuraSub=40 → hechura recibe 40/(100+40) = 28.57% del IVA.
    const r = buildLineHechuraSaleUnified({
      metalSaleUnit:   100,
      hechuraSaleUnit: 40,
      quantity:        1,
      taxBreakdown: [{ name: "IVA", rate: 21, taxAmount: 29.4, applyOn: "TOTAL" }],
    });
    // 29.4 × (40 / 140) = 8.4
    expect(r.taxOnHechura).toBeCloseTo(8.4, 4);
    expect(r.total).toBeCloseTo(40 + 0 + 0 + 8.4, 4);
  });

  it("impuesto applyOn=HECHURA va 100% al hechura", () => {
    const r = buildLineHechuraSaleUnified({
      metalSaleUnit:   100,
      hechuraSaleUnit: 40,
      quantity:        1,
      taxBreakdown: [{ name: "IVA hechura", rate: 21, taxAmount: 8.4, applyOn: "HECHURA" }],
    });
    expect(r.taxOnHechura).toBe(8.4);
  });

  it("impuesto applyOn=METAL NO contribuye al total hechura", () => {
    const r = buildLineHechuraSaleUnified({
      metalSaleUnit:   100,
      hechuraSaleUnit: 40,
      quantity:        1,
      taxBreakdown: [{ name: "IVA metal", rate: 21, taxAmount: 21, applyOn: "METAL" }],
    });
    expect(r.taxOnHechura).toBe(0);
    expect(r.total).toBe(40);
  });

  it("qty > 1 multiplica el subtotal hechura per-unit (productos/servicios ya son línea)", () => {
    const r = buildLineHechuraSaleUnified({
      metalSaleUnit:   100,
      hechuraSaleUnit: 40,
      quantity:        3,
      products: [{ totalValue: 50 }],
    });
    expect(r.hechuraSubtotal).toBe(120); // 40 × 3
    expect(r.productsTotal).toBe(50);    // ya es escala línea
    expect(r.total).toBeCloseTo(170, 6);
  });

  it("sin datos → total 0 (no rompe, no inventa)", () => {
    const r = buildLineHechuraSaleUnified({
      metalSaleUnit:   null,
      hechuraSaleUnit: null,
      quantity:        1,
    });
    expect(r.total).toBe(0);
  });
});
